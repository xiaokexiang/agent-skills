#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_TIMEOUT_MS = 30000;
const require = createRequire(import.meta.url);
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
let jiraSdkPromise;

// ─── .env helpers ──────────────────────────────────────────────────────

const JIRA_ENV_KEYS = ['JIRA_HOST', 'JIRA_USERNAME', 'JIRA_PASSWORD'];

function findEnvFile() {
  // Search from cwd upward to currentDir
  let dir = process.cwd();
  const envPath = path.join(dir, '.env');
  if (fs.existsSync(envPath)) {
    return envPath;
  }
  // Fallback: cwd/.env or currentDir/.env
  const cwdEnv = path.join(process.cwd(), '.env');
  if (fs.existsSync(cwdEnv)) {
    return cwdEnv;
  }
  const dirEnv = path.join(currentDir, '.env');
  if (fs.existsSync(dirEnv)) {
    return dirEnv;
  }
  return cwdEnv; // default to cwd/.env
}

function parseEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function writeEnvFile(envPath, updates) {
  const existing = parseEnvFile(envPath);
  // Merge updates into existing (only JIRA_* keys)
  const merged = { ...existing };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      merged[key] = String(value);
    }
  }
  // Build output: put JIRA_* keys first, then others
  const lines = [];
  for (const jiraKey of JIRA_ENV_KEYS) {
    if (merged[jiraKey] !== undefined) {
      lines.push(`${jiraKey}=${merged[jiraKey]}`);
      delete merged[jiraKey];
    }
  }
  // Append remaining keys (from other skills)
  for (const [key, value] of Object.entries(merged)) {
    lines.push(`${key}=${value}`);
  }
  // Ensure directory exists
  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
}

export function loadJiraCredentials() {
  const envPath = findEnvFile();
  const env = parseEnvFile(envPath);
  return {
    host: env.JIRA_HOST,
    username: env.JIRA_USERNAME,
    password: env.JIRA_PASSWORD,
  };
}

export function saveJiraCredentials(credentials) {
  const envPath = findEnvFile();
  writeEnvFile(envPath, {
    JIRA_HOST: credentials.host,
    JIRA_USERNAME: credentials.username,
    JIRA_PASSWORD: credentials.password,
  });
}

// ─── Credential resolution ────────────────────────────────────────────

export function normalizeHost(host) {
  if (!host) {
    throw new Error('Missing Jira host. Use --host, set JIRA_HOST in .env, or run auth-test first.');
  }

  const normalized = host.replace(/\/+$/u, '');
  new URL(normalized);
  return normalized;
}

export function resolveCredentials(overrides = {}) {
  const defaults = loadJiraCredentials();
  const host = normalizeHost(overrides.host ?? defaults.host);
  const username = overrides.username ?? defaults.username;
  const password = overrides.password ?? defaults.password;

  if (!username || !password) {
    throw new Error('Missing Jira credentials. Use --username --password, set JIRA_USERNAME/JIRA_PASSWORD in .env, or run auth-test first.');
  }

  return { host, username, password };
}

export function extractCookieHeader(setCookieHeaders) {
  if (!Array.isArray(setCookieHeaders) || setCookieHeaders.length === 0) {
    throw new Error('Jira login succeeded but no Set-Cookie header was returned.');
  }

  const cookies = setCookieHeaders
    .map((entry) => String(entry).split(';')[0]?.trim())
    .filter(Boolean);

  if (cookies.length === 0) {
    throw new Error('Failed to extract cookie values from Set-Cookie headers.');
  }

  return cookies.join('; ');
}

export async function createLegacySession(credentials, options = {}) {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const loginPath = options.loginPath ?? '/rest/api/2/myself';
  const loginUrl = new URL(loginPath, credentials.host).toString();

  const authValue = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
  const response = await fetch(loginUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${authValue}`,
      ...options.headers,
    },
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    throw new Error(`Session bootstrap failed: HTTP ${response.status} ${response.statusText}`);
  }

  const setCookieHeaders = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  const cookieHeader = extractCookieHeader(setCookieHeaders);
  const user = await response.json();

  return {
    cookieHeader,
    cookies: cookieHeader.split('; ').map((entry) => entry.split('=')[0]),
    user,
    response,
  };
}

export function createRawClient(host, cookieHeader, options = {}) {
  const baseHeaders = {
    Accept: 'application/json',
    Cookie: cookieHeader,
    ...options.headers,
  };
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

  return {
    async request(requestOptions = {}) {
      const url = new URL(requestOptions.url || '/', host);

      if (requestOptions.params && typeof requestOptions.params === 'object') {
        for (const [key, value] of Object.entries(requestOptions.params)) {
          if (value === undefined || value === null) {
            continue;
          }

          if (Array.isArray(value)) {
            url.searchParams.set(key, value.join(','));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      }

      const response = await fetch(url, {
        method: requestOptions.method || 'GET',
        headers: {
          ...baseHeaders,
          ...requestOptions.headers,
        },
        body: requestOptions.data === undefined
          ? undefined
          : typeof requestOptions.data === 'string'
            ? requestOptions.data
            : JSON.stringify(requestOptions.data),
        signal: AbortSignal.timeout(timeout),
      });

      const text = await response.text();
      let data = text;

      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      };
    },
    async get(url, requestOptions = {}) {
      return this.request({
        ...requestOptions,
        url,
        method: 'GET',
      });
    },
  };
}

export function createLegacyJiraConfig(host, cookieHeader, options = {}) {
  return {
    host,
    noCheckAtlassianToken: true,
    baseRequestConfig: {
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      headers: {
        Accept: 'application/json',
        Cookie: cookieHeader,
        ...options.headers,
      },
    },
  };
}

export function createLegacyJiraClients(host, cookieHeader, options = {}) {
  throw new Error('createLegacyJiraClients must be initialized after jira.js is loaded.');
}

async function loadJiraSdk() {
  if (!jiraSdkPromise) {
    jiraSdkPromise = (async () => {
      const searchBases = [process.cwd(), currentDir];

      for (const base of searchBases) {
        try {
          const resolved = require.resolve('jira.js', { paths: [base] });
          return import(pathToFileURL(resolved).href);
        } catch {
          // continue
        }
      }

      process.stderr.write("Missing dependency 'jira.js'. Installing it in the current workspace...\n");
      installJiraSdk();

      for (const base of searchBases) {
        try {
          const resolved = require.resolve('jira.js', { paths: [base] });
          return import(pathToFileURL(resolved).href);
        } catch {
          // continue
        }
      }

      throw new Error("Failed to load dependency 'jira.js' after installation.");
    })();
  }

  return jiraSdkPromise;
}

function installJiraSdk() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['install', 'jira.js'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw new Error(`Failed to install jira.js: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Failed to install jira.js: exit code ${result.status}`);
  }
}

export async function createJiraClients(host, cookieHeader, options = {}) {
  const sdk = await loadJiraSdk();
  const config = createLegacyJiraConfig(host, cookieHeader, options);

  return {
    config,
    v2: new sdk.Version2Client(config),
    v3: new sdk.Version3Client(config),
    agile: new sdk.AgileClient(config),
    serviceDesk: new sdk.ServiceDeskClient(config),
  };
}

export async function createLegacyJiraAuth(overrides = {}, options = {}) {
  const credentials = resolveCredentials(overrides);
  const session = await createLegacySession(credentials, options.session);
  const clients = await createJiraClients(credentials.host, session.cookieHeader, options.client);
  const raw = createRawClient(credentials.host, session.cookieHeader, options.raw);

  return {
    credentials,
    session,
    raw,
    ...clients,
  };
}

// ─── Table output ─────────────────────────────────────────────────────

function flattenObject(row, prefix = '') {
  const flat = {};
  for (const [key, value] of Object.entries(row)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Extract meaningful sub-fields (name, displayName, key, etc.)
      if (value.name) {
        flat[fullKey] = value.name;
      } else if (value.displayName) {
        flat[fullKey] = value.displayName;
      } else if (value.key) {
        flat[fullKey] = value.key;
      } else {
        Object.assign(flat, flattenObject(value, fullKey));
      }
    } else if (Array.isArray(value)) {
      flat[fullKey] = value.map(item =>
        item && typeof item === 'object'
          ? (item.name || item.key || item.displayName || JSON.stringify(item))
          : String(item ?? '')
      ).join(', ');
    } else {
      flat[fullKey] = value === null || value === undefined ? '' : String(value);
    }
  }
  return flat;
}

function formatCell(text, width) {
  const padded = text.padEnd(width, ' ');
  // Handle ANSI-safe: just truncate by char count for simplicity
  if (padded.length > width) {
    return ` ${padded.slice(0, width - 2)} `;
  }
  return ` ${padded} `;
}

export function printTable(data) {
  if (!data) {
    process.stdout.write('(empty)\n');
    return;
  }

  // Normalize data into array of rows
  let rows;
  if (Array.isArray(data)) {
    rows = data;
  } else if (typeof data === 'object') {
    // If it has 'issues' array (search results), use that
    if (Array.isArray(data.issues)) {
      rows = data.issues;
    } else {
      // Single object: wrap in array
      rows = [data];
    }
  } else {
    process.stdout.write(`${String(data)}\n`);
    return;
  }

  if (rows.length === 0) {
    process.stdout.write('(empty)\n');
    return;
  }

  // Flatten all rows and collect all unique columns in order
  const flatRows = rows.map(row => flattenObject(row));
  const columns = [];
  const columnSet = new Set();
  for (const row of flatRows) {
    for (const key of Object.keys(row)) {
      if (!columnSet.has(key)) {
        columns.push(key);
        columnSet.add(key);
      }
    }
  }

  if (columns.length === 0) {
    process.stdout.write('(empty)\n');
    return;
  }

  // Calculate column widths (min 3, max 50)
  const widths = columns.map(col => {
    const headerWidth = col.length;
    const maxDataWidth = Math.max(...flatRows.map(row => (row[col] || '').length));
    return Math.min(Math.max(headerWidth, maxDataWidth, 3), 50);
  });

  // Build separator line
  const separator = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';

  // Print header
  process.stdout.write(`${separator}\n`);
  process.stdout.write(`${columns.map((col, i) => formatCell(col, widths[i])).join('|')}\n`);
  process.stdout.write(`${separator}\n`);

  // Print rows
  for (const row of flatRows) {
    const line = columns.map((col, i) => formatCell(row[col] || '', widths[i])).join('|');
    process.stdout.write(`${line}\n`);
  }

  process.stdout.write(`${separator}\n`);
}

// ─── CLI parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const options = {
    host: undefined,
    username: undefined,
    password: undefined,
    project: undefined,
    key: undefined,
    jql: undefined,
    fields: undefined,
    expand: undefined,
    properties: undefined,
    maxResults: undefined,
    startAt: undefined,
    method: 'GET',
    path: undefined,
    query: undefined,
    data: undefined,
    headers: undefined,
    help: false,
  };

  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const next = argv[index + 1];
    switch (token) {
      case '--host':
        options.host = next;
        index += 1;
        break;
      case '--username':
        options.username = next;
        index += 1;
        break;
      case '--password':
        options.password = next;
        index += 1;
        break;
      case '--key':
        options.key = next;
        index += 1;
        break;
      case '--project':
        options.project = next;
        index += 1;
        break;
      case '--jql':
        options.jql = next;
        index += 1;
        break;
      case '--fields':
        options.fields = next;
        index += 1;
        break;
      case '--expand':
        options.expand = next;
        index += 1;
        break;
      case '--properties':
        options.properties = next;
        index += 1;
        break;
      case '--max-results':
        options.maxResults = Number.parseInt(next, 10);
        index += 1;
        break;
      case '--start-at':
        options.startAt = Number.parseInt(next, 10);
        index += 1;
        break;
      case '--method':
        options.method = String(next || 'GET').toUpperCase();
        index += 1;
        break;
      case '--path':
        options.path = next;
        index += 1;
        break;
      case '--query':
        options.query = parseJsonOption(next, '--query');
        index += 1;
        break;
      case '--data':
        options.data = parseJsonOption(next, '--data');
        index += 1;
        break;
      case '--headers':
        options.headers = parseJsonOption(next, '--headers');
        index += 1;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${token}`);
    }
  }

  return {
    command: positionals[0],
    subcommand: positionals[1],
    options,
  };
}

function parseJsonOption(value, flagName) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${flagName} must be valid JSON: ${error.message}`);
  }
}

function parseCsv(value) {
  if (!value) {
    return undefined;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeApiPath(value) {
  if (!value) {
    return value;
  }

  return value.startsWith('/') ? value : `/${value}`;
}

// ─── Command dispatch ─────────────────────────────────────────────────

async function runCommand(command, subcommand, options, auth) {
  if (!command || options.help) {
    showHelp();
    return;
  }

  switch (command) {
    case 'auth-test': {
      printTable({
        ok: true,
        authMode: 'basic-bootstrap-cookie-session',
        user: auth.session.user.displayName || auth.session.user.name,
        emailAddress: auth.session.user.emailAddress || '',
        cookies: auth.session.cookies.join(', '),
      });
      // Save credentials to .env after successful auth
      try {
        saveJiraCredentials(auth.credentials);
        process.stdout.write(`Credentials saved to ${findEnvFile()}\n`);
      } catch (err) {
        process.stderr.write(`Warning: could not save .env file: ${err.message}\n`);
      }
      return;
    }

    case 'myself': {
      const data = await auth.v2.myself.getCurrentUser({
        expand: options.expand,
      });
      printTable(data);
      return;
    }

    case 'issue': {
      if (subcommand !== 'get') {
        throw new Error('Supported issue subcommands: get');
      }
      if (!options.key) {
        throw new Error('issue get requires --key');
      }
      const data = await auth.v2.issues.getIssue({
        issueIdOrKey: options.key,
        fields: parseCsv(options.fields),
        expand: options.expand,
        properties: parseCsv(options.properties),
      });
      // Extract key fields for display
      const fields = data.fields || {};
      printTable([{
        key: data.key,
        summary: fields.summary || '',
        status: fields.status?.name || '',
        assignee: fields.assignee?.displayName || fields.assignee?.name || '',
        reporter: fields.reporter?.displayName || fields.reporter?.name || '',
        priority: fields.priority?.name || '',
        issuetype: fields.issuetype?.name || '',
        created: fields.created || '',
        updated: fields.updated || '',
        description: (fields.description || '').slice(0, 200),
      }]);
      return;
    }

    case 'search': {
      if (!options.jql) {
        throw new Error('search requires --jql');
      }
      const data = await auth.v2.issueSearch.searchForIssuesUsingJql({
        jql: options.jql,
        fields: parseCsv(options.fields),
        expand: parseCsv(options.expand),
        properties: parseCsv(options.properties),
        maxResults: Number.isFinite(options.maxResults) ? options.maxResults : 50,
        startAt: Number.isFinite(options.startAt) ? options.startAt : 0,
      });
      // Wrap with total count info
      const issues = (data.issues || []).map(issue => {
        const fields = issue.fields || {};
        return {
          key: issue.key,
          summary: fields.summary || '',
          status: fields.status?.name || '',
          assignee: fields.assignee?.displayName || fields.assignee?.name || '',
          priority: fields.priority?.name || '',
          issuetype: fields.issuetype?.name || '',
        };
      });
      printTable(issues);
      process.stdout.write(`Total: ${data.total} issues\n`);
      return;
    }

    case 'bug': {
      if (!options.project) {
        throw new Error('bug commands require --project');
      }

      const jql = `project = ${options.project} AND issuetype = Bug`;

      if (subcommand === 'count') {
        const data = await auth.v2.issueSearch.searchForIssuesUsingJql({
          jql,
          maxResults: 0,
          startAt: 0,
        });
        printTable([{ project: options.project, issuetype: 'Bug', total: data.total }]);
        return;
      }

      if (subcommand === 'list') {
        const data = await auth.v2.issueSearch.searchForIssuesUsingJql({
          jql,
          fields: parseCsv(options.fields) || ['summary', 'status', 'assignee'],
          maxResults: Number.isFinite(options.maxResults) ? options.maxResults : 20,
          startAt: Number.isFinite(options.startAt) ? options.startAt : 0,
        });
        const issues = (data.issues || []).map(issue => {
          const fields = issue.fields || {};
          return {
            key: issue.key,
            summary: fields.summary || '',
            status: fields.status?.name || '',
            assignee: fields.assignee?.displayName || fields.assignee?.name || '',
            priority: fields.priority?.name || '',
          };
        });
        printTable(issues);
        process.stdout.write(`Total: ${data.total} bugs\n`);
        return;
      }

      throw new Error('Supported bug subcommands: count, list');
    }

    case 'project': {
      if (subcommand === 'list') {
        const response = await auth.raw.get('/rest/api/2/project');
        ensureHttpSuccess(response.status, response.statusText, 'project list');
        const projects = (response.data || []).map(project => ({
          key: project.key,
          name: project.name,
          lead: project.lead?.displayName || project.lead?.name || '',
          type: project.projectTypeKey || project.type || '',
        }));
        printTable(projects);
        return;
      }

      if (subcommand === 'get') {
        if (!options.key) {
          throw new Error('project get requires --key');
        }
        const data = await auth.v2.projects.getProject({
          projectIdOrKey: options.key,
          expand: options.expand,
          properties: parseCsv(options.properties),
        });
        printTable([{
          key: data.key,
          name: data.name,
          lead: data.lead?.displayName || data.lead?.name || '',
          type: data.projectTypeKey || data.type || '',
          description: data.description || '',
          url: data.url || '',
        }]);
        return;
      }

      throw new Error('Supported project subcommands: list, get');
    }

    case 'raw': {
      if (!options.path) {
        throw new Error('raw requires --path');
      }
      const apiPath = normalizeApiPath(options.path);
      const response = await auth.raw.request({
        url: apiPath,
        method: options.method,
        params: options.query,
        data: options.data,
        headers: options.headers,
      });
      ensureHttpSuccess(response.status, response.statusText, `raw ${options.method} ${apiPath}`);
      // For raw output, try table if it's array/object, fallback to JSON
      const data = response.data;
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        printTable(data);
      } else if (data && typeof data === 'object' && !Array.isArray(data)) {
        printTable(data);
      } else {
        process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      }
      return;
    }

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function ensureHttpSuccess(status, statusText, context) {
  if (status >= 200 && status < 300) {
    return;
  }

  throw new Error(`${context} failed: HTTP ${status} ${statusText}`);
}

function showHelp() {
  process.stdout.write(`Jira CLI for legacy Jira Server

Credentials: .env file (auto-saved after auth-test) or --host --username --password

Most common:
  node scripts/jira.js auth-test --host http://host:port --username user --password pass
  node scripts/jira.js project list
  node scripts/jira.js issue get --key BOCLAWEE-291
  node scripts/jira.js bug count --project BOCLAWEE
  node scripts/jira.js bug list --project BOCLAWEE --max-results 20
  node scripts/jira.js search --jql "project = BOCLAWEE AND issuetype = Bug"
  node scripts/jira.js raw --path rest/api/2/serverInfo

Optional:
  --fields <csv>       --expand <value>    --max-results <n>
  --properties <csv>   --query <json>      --data <json>
  --method <verb>      --headers <json>

.env keys:
  JIRA_HOST      JIRA_USERNAME      JIRA_PASSWORD
`);
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  const { command, subcommand, options } = parseArgs(process.argv.slice(2));

  if (!command || options.help) {
    showHelp();
    return;
  }

  const auth = await createLegacyJiraAuth({
    host: options.host,
    username: options.username,
    password: options.password,
  });

  await runCommand(command, subcommand, options, auth);
}

const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (currentFile === entryFile) {
  main().catch((error) => {
    process.stderr.write(`Jira CLI error: ${error.message}\n`);
    process.exit(1);
  });
}
