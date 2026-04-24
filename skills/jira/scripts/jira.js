#!/usr/bin/env node

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

export function normalizeHost(host) {
  if (!host) {
    throw new Error('Missing Jira host. Use --host or set JIRA_HOST.');
  }

  const normalized = host.replace(/\/+$/u, '');
  new URL(normalized);
  return normalized;
}

export function resolveCredentials(overrides = {}) {
  const host = normalizeHost(overrides.host);
  const username = overrides.username;
  const password = overrides.password;

  if (!username || !password) {
    throw new Error('Missing Jira credentials. Use --host --username --password.');
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

function printJson(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

async function runCommand(command, subcommand, options, auth) {
  if (!command || options.help) {
    showHelp();
    return;
  }

  switch (command) {
    case 'auth-test':
      printJson({
        ok: true,
        authMode: 'basic-bootstrap-cookie-session',
        user: auth.session.user,
        cookies: auth.session.cookies,
        clients: ['v2', 'v3', 'agile', 'serviceDesk'],
      });
      return;

    case 'myself': {
      const data = await auth.v2.myself.getCurrentUser({
        expand: options.expand,
      });
      printJson(data);
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
      printJson(data);
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
      printJson(data);
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
        printJson({
          project: options.project,
          issuetype: 'Bug',
          total: data.total,
        });
        return;
      }

      if (subcommand === 'list') {
        const data = await auth.v2.issueSearch.searchForIssuesUsingJql({
          jql,
          fields: parseCsv(options.fields) || ['summary', 'status', 'assignee'],
          maxResults: Number.isFinite(options.maxResults) ? options.maxResults : 20,
          startAt: Number.isFinite(options.startAt) ? options.startAt : 0,
        });
        printJson(data);
        return;
      }

      throw new Error('Supported bug subcommands: count, list');
    }

    case 'project': {
      if (subcommand === 'list') {
        const response = await auth.raw.get('/rest/api/2/project');
        ensureHttpSuccess(response.status, response.statusText, 'project list');
        printJson(response.data);
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
        printJson(data);
        return;
      }

      throw new Error('Supported project subcommands: list, get');
    }

    case 'raw': {
      if (!options.path) {
        throw new Error('raw requires --path');
      }
      const response = await auth.raw.request({
        url: options.path,
        method: options.method,
        params: options.query,
        data: options.data,
        headers: options.headers,
      });
      ensureHttpSuccess(response.status, response.statusText, `raw ${options.method} ${options.path}`);
      printJson(response.data);
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
  process.stdout.write(`Jira CLI for legacy Jira Server\n\n`);
  process.stdout.write(`Most common:\n`);
  process.stdout.write(`  npm run jira -- auth-test --host http://host:port --username user --password pass\n`);
  process.stdout.write(`  npm run jira -- project list --host http://host:port --username user --password pass\n`);
  process.stdout.write(`  npm run jira -- issue get --key BOCLAWEE-291 --expand renderedFields --host http://host:port --username user --password pass\n`);
  process.stdout.write(`  npm run jira -- bug count --project BOCLAWEE --host http://host:port --username user --password pass\n`);
  process.stdout.write(`  npm run jira -- bug list --project BOCLAWEE --host http://host:port --username user --password pass\n`);
  process.stdout.write(`  npm run jira -- search --jql "project = BOCLAWEE AND issuetype = Bug" --host http://host:port --username user --password pass\n`);
  process.stdout.write(`  npm run jira -- raw --path /rest/api/2/serverInfo --host http://host:port --username user --password pass\n\n`);
  process.stdout.write(`Credentials:\n`);
  process.stdout.write(`  command line only\n`);
}

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
