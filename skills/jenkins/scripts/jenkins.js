#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_TIMEOUT_MS = 30000;
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const skillDir = path.dirname(currentDir);
const envFilePath = path.join(skillDir, '.env');

// ─── .env helpers ──────────────────────────────────────────────────────

const JENKINS_ENV_KEYS = ['JENKINS_HOST', 'JENKINS_USERNAME', 'JENKINS_TOKEN', 'JENKINS_PASSWORD'];

function parseEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
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
  const merged = { ...existing };
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined || v === null || v === '') {
      delete merged[k];
    } else {
      merged[k] = String(v);
    }
  }
  const lines = [];
  for (const k of JENKINS_ENV_KEYS) {
    if (merged[k] !== undefined) {
      lines.push(`${k}=${merged[k]}`);
      delete merged[k];
    }
  }
  for (const [k, v] of Object.entries(merged)) {
    lines.push(`${k}=${v}`);
  }
  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
}

export function loadJenkinsCredentials() {
  const env = parseEnvFile(envFilePath);
  return {
    host: env.JENKINS_HOST,
    username: env.JENKINS_USERNAME,
    token: env.JENKINS_TOKEN,
    password: env.JENKINS_PASSWORD,
  };
}

export function saveJenkinsCredentials(creds) {
  writeEnvFile(envFilePath, {
    JENKINS_HOST: creds.host,
    JENKINS_USERNAME: creds.username,
    JENKINS_TOKEN: creds.token || '',
    JENKINS_PASSWORD: creds.password || '',
  });
}

// ─── Credential resolution ────────────────────────────────────────────

export function normalizeHost(host) {
  if (!host) {
    throw new Error('Missing Jenkins host. Use --host, set JENKINS_HOST in .env, or run auth-test first.');
  }
  const normalized = host.replace(/\/+$/u, '');
  new URL(normalized);
  return normalized;
}

export function resolveCredentials(overrides = {}) {
  const defaults = loadJenkinsCredentials();
  const host = normalizeHost(overrides.host ?? defaults.host);
  const username = overrides.username ?? defaults.username;
  const token = overrides.token ?? defaults.token;
  const password = overrides.password ?? defaults.password;
  const secret = token || password;
  if (!username || !secret) {
    throw new Error('Missing Jenkins credentials. Provide --username and (--token or --password), set them in .env, or run auth-test first.');
  }
  return { host, username, token, password, secret, secretKind: token ? 'token' : 'password' };
}

// ─── HTTP client ──────────────────────────────────────────────────────

function basicAuthHeader(username, secret) {
  return 'Basic ' + Buffer.from(`${username}:${secret}`).toString('base64');
}

export function createJenkinsClient(credentials, options = {}) {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const auth = basicAuthHeader(credentials.username, credentials.secret);
  let crumbCache = null;
  let sessionCookie = null;

  function captureSessionCookie(resp) {
    const setCookies = typeof resp.headers.getSetCookie === 'function'
      ? resp.headers.getSetCookie()
      : [];
    if (setCookies.length === 0) return;
    const pairs = setCookies
      .map((c) => String(c).split(';')[0]?.trim())
      .filter(Boolean);
    if (pairs.length > 0) sessionCookie = pairs.join('; ');
  }

  async function getCrumb() {
    if (crumbCache !== null) return crumbCache;
    const url = new URL('/crumbIssuer/api/json', credentials.host);
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: auth },
        signal: AbortSignal.timeout(timeout),
      });
      if (resp.status === 404) {
        // CSRF disabled
        crumbCache = { field: null, value: null };
        return crumbCache;
      }
      if (!resp.ok) {
        throw new Error(`crumb fetch failed: HTTP ${resp.status} ${resp.statusText}`);
      }
      // Jenkins 2.176+ binds crumb to the HTTP session — capture JSESSIONID
      // so subsequent POSTs are recognized as the same session.
      captureSessionCookie(resp);
      const data = await resp.json();
      crumbCache = { field: data.crumbRequestField, value: data.crumb };
      return crumbCache;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('crumb fetch timed out');
      throw err;
    }
  }

  async function request(opts = {}) {
    const url = new URL(opts.url || '/', credentials.host);
    if (opts.params && typeof opts.params === 'object') {
      for (const [k, v] of Object.entries(opts.params)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
      }
    }

    const method = (opts.method || 'GET').toUpperCase();
    const headers = {
      Accept: opts.accept || 'application/json',
      Authorization: auth,
      ...opts.headers,
    };

    if (method !== 'GET' && method !== 'HEAD') {
      const crumb = await getCrumb();
      if (crumb.field) headers[crumb.field] = crumb.value;
      // Crumb is session-bound — reuse the JSESSIONID captured during crumb fetch.
      if (sessionCookie && !headers.Cookie && !headers.cookie) {
        headers.Cookie = sessionCookie;
      }
    }

    let body;
    if (opts.body !== undefined && opts.body !== null) {
      if (typeof opts.body === 'string' || opts.body instanceof URLSearchParams) {
        body = opts.body;
        if (opts.body instanceof URLSearchParams && !headers['Content-Type']) {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      } else {
        body = JSON.stringify(opts.body);
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      }
    }

    const signal = opts.noTimeout ? undefined : AbortSignal.timeout(opts.timeout ?? timeout);

    const resp = await fetch(url, { method, headers, body, signal });

    if (opts.raw) return resp;

    const text = await resp.text();
    let data = text;
    if (text) {
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        try { data = JSON.parse(text); } catch { data = text; }
      }
    }
    return {
      status: resp.status,
      statusText: resp.statusText,
      headers: Object.fromEntries(resp.headers.entries()),
      data,
    };
  }

  return {
    credentials,
    getCrumb,
    request,
    get: (url, opts = {}) => request({ ...opts, url, method: 'GET' }),
    post: (url, opts = {}) => request({ ...opts, url, method: 'POST' }),
  };
}

export async function createJenkinsAuth(overrides = {}, options = {}) {
  const credentials = resolveCredentials(overrides);
  const client = createJenkinsClient(credentials, options);
  return { credentials, client };
}

// ─── Job path helpers ─────────────────────────────────────────────────

export function jobPath(name) {
  if (!name) throw new Error('Job name is required');
  if (name.startsWith('/')) return name.replace(/\/+$/u, '');
  if (name.startsWith('job/')) return '/' + name.replace(/\/+$/u, '');
  const segments = name.split('/').filter(Boolean).map(encodeURIComponent);
  return '/job/' + segments.join('/job/');
}

function colorToStatus(color) {
  if (!color) return '';
  const anime = color.endsWith('_anime');
  const base = anime ? color.slice(0, -'_anime'.length) : color;
  const map = {
    blue: 'SUCCESS',
    red: 'FAILURE',
    yellow: 'UNSTABLE',
    aborted: 'ABORTED',
    notbuilt: 'NOT_BUILT',
    disabled: 'DISABLED',
    grey: 'PENDING',
  };
  const status = map[base] || base.toUpperCase();
  return anime ? `${status}/BUILDING` : status;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${m}m${sec}s`;
  if (m > 0) return `${m}m${sec}s`;
  return `${sec}s`;
}

function formatTimestamp(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  return new Date(ms).toISOString().replace('T', ' ').replace(/\..+$/, '');
}

// ─── Table output ─────────────────────────────────────────────────────

function flattenObject(row, prefix = '') {
  const flat = {};
  for (const [key, value] of Object.entries(row)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (value.name) flat[full] = value.name;
      else if (value.displayName) flat[full] = value.displayName;
      else if (value.fullName) flat[full] = value.fullName;
      else Object.assign(flat, flattenObject(value, full));
    } else if (Array.isArray(value)) {
      flat[full] = value.map((item) =>
        item && typeof item === 'object'
          ? (item.name || item.fullName || item.displayName || JSON.stringify(item))
          : String(item ?? '')
      ).join(', ');
    } else {
      flat[full] = value === null || value === undefined ? '' : String(value);
    }
  }
  return flat;
}

function formatCell(text, width) {
  const padded = String(text).padEnd(width, ' ');
  if (padded.length > width) return ` ${padded.slice(0, width - 2)}… `;
  return ` ${padded} `;
}

export function printTable(data) {
  if (!data) {
    process.stdout.write('(empty)\n');
    return;
  }
  let rows;
  if (Array.isArray(data)) rows = data;
  else if (typeof data === 'object') rows = [data];
  else { process.stdout.write(`${String(data)}\n`); return; }
  if (rows.length === 0) { process.stdout.write('(empty)\n'); return; }

  const flat = rows.map((r) => flattenObject(r));
  const columns = [];
  const seen = new Set();
  for (const row of flat) for (const k of Object.keys(row)) {
    if (!seen.has(k)) { columns.push(k); seen.add(k); }
  }
  if (columns.length === 0) { process.stdout.write('(empty)\n'); return; }

  const widths = columns.map((c) => {
    const h = c.length;
    const m = Math.max(...flat.map((r) => (r[c] || '').length), 0);
    return Math.min(Math.max(h, m, 3), 60);
  });

  const sep = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  process.stdout.write(`${sep}\n`);
  process.stdout.write(columns.map((c, i) => formatCell(c, widths[i])).join('|') + '\n');
  process.stdout.write(`${sep}\n`);
  for (const row of flat) {
    process.stdout.write(columns.map((c, i) => formatCell(row[c] || '', widths[i])).join('|') + '\n');
  }
  process.stdout.write(`${sep}\n`);
}

// ─── CLI parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const options = {
    host: undefined, username: undefined, token: undefined, password: undefined,
    name: undefined, number: undefined, params: undefined,
    follow: false, interval: 1000, start: 0,
    path: undefined, method: 'GET', query: undefined, data: undefined, headers: undefined,
    tree: undefined, depth: undefined, help: false,
  };
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) { positionals.push(t); continue; }
    const next = argv[i + 1];
    switch (t) {
      case '--host': options.host = next; i += 1; break;
      case '--username': options.username = next; i += 1; break;
      case '--token': options.token = next; i += 1; break;
      case '--password': options.password = next; i += 1; break;
      case '--name': options.name = next; i += 1; break;
      case '--number': options.number = next; i += 1; break;
      case '--params': options.params = parseJsonOption(next, '--params'); i += 1; break;
      case '--follow': case '-f': options.follow = true; break;
      case '--interval': options.interval = Number.parseInt(next, 10); i += 1; break;
      case '--start': options.start = Number.parseInt(next, 10); i += 1; break;
      case '--path': options.path = next; i += 1; break;
      case '--method': options.method = String(next || 'GET').toUpperCase(); i += 1; break;
      case '--query': options.query = parseJsonOption(next, '--query'); i += 1; break;
      case '--data': options.data = parseJsonOption(next, '--data'); i += 1; break;
      case '--headers': options.headers = parseJsonOption(next, '--headers'); i += 1; break;
      case '--tree': options.tree = next; i += 1; break;
      case '--depth': options.depth = Number.parseInt(next, 10); i += 1; break;
      case '--help': case '-h': options.help = true; break;
      default: throw new Error(`Unknown option: ${t}`);
    }
  }
  return { command: positionals[0], subcommand: positionals[1], options };
}

function parseJsonOption(value, flag) {
  if (!value) return undefined;
  try { return JSON.parse(value); }
  catch (e) { throw new Error(`${flag} must be valid JSON: ${e.message}`); }
}

function ensureHttpSuccess(resp, context) {
  if (resp.status >= 200 && resp.status < 300) return;
  let detail = '';
  if (typeof resp.data === 'string' && resp.data) detail = ` — ${resp.data.slice(0, 200)}`;
  throw new Error(`${context} failed: HTTP ${resp.status} ${resp.statusText}${detail}`);
}

function normalizeApiPath(value) {
  if (!value) return value;
  return value.startsWith('/') ? value : `/${value}`;
}

// ─── Commands ─────────────────────────────────────────────────────────

async function cmdAuthTest(client, credentials) {
  const resp = await client.get('/whoAmI/api/json');
  ensureHttpSuccess(resp, 'whoAmI');
  const crumb = await client.getCrumb();
  printTable([{
    ok: true,
    host: credentials.host,
    user: resp.data.name || credentials.username,
    authenticated: resp.data.authenticated,
    authorities: Array.isArray(resp.data.authorities) ? resp.data.authorities.join(', ') : '',
    secretKind: credentials.secretKind,
    csrf: crumb.field ? `enabled (${crumb.field})` : 'disabled',
  }]);
  try {
    saveJenkinsCredentials(credentials);
    process.stdout.write(`Credentials saved to ${envFilePath}\n`);
  } catch (err) {
    process.stderr.write(`Warning: could not save .env: ${err.message}\n`);
  }
}

async function cmdWhoami(client) {
  const resp = await client.get('/whoAmI/api/json');
  ensureHttpSuccess(resp, 'whoAmI');
  printTable([{
    name: resp.data.name,
    authenticated: resp.data.authenticated,
    anonymous: resp.data.anonymous,
    authorities: Array.isArray(resp.data.authorities) ? resp.data.authorities.join(', ') : '',
  }]);
}

async function cmdJobList(client, options) {
  const tree = options.tree || 'jobs[name,fullName,url,color,buildable]';
  const resp = await client.get('/api/json', { params: { tree } });
  ensureHttpSuccess(resp, 'job list');
  const jobs = (resp.data.jobs || []).map((j) => ({
    name: j.fullName || j.name,
    status: colorToStatus(j.color),
    buildable: j.buildable ?? '',
    url: j.url || '',
  }));
  printTable(jobs);
  process.stdout.write(`Total: ${jobs.length} jobs\n`);
}

async function cmdJobGet(client, options) {
  if (!options.name) throw new Error('job get requires --name');
  const resp = await client.get(`${jobPath(options.name)}/api/json`, {
    params: options.depth !== undefined ? { depth: options.depth } : undefined,
  });
  ensureHttpSuccess(resp, `job get ${options.name}`);
  const d = resp.data;
  printTable([{
    name: d.fullName || d.name,
    displayName: d.displayName || '',
    status: colorToStatus(d.color),
    buildable: d.buildable ?? '',
    inQueue: d.inQueue ?? '',
    nextBuildNumber: d.nextBuildNumber ?? '',
    lastBuild: d.lastBuild?.number ?? '',
    lastSuccess: d.lastSuccessfulBuild?.number ?? '',
    lastFailure: d.lastFailedBuild?.number ?? '',
    url: d.url || '',
    description: (d.description || '').slice(0, 200),
  }]);
}

async function cmdBuildGet(client, options) {
  if (!options.name) throw new Error('build get requires --name');
  if (!options.number) throw new Error('build get requires --number');
  const resp = await client.get(`${jobPath(options.name)}/${options.number}/api/json`);
  ensureHttpSuccess(resp, `build get ${options.name} #${options.number}`);
  printBuild(resp.data, options.name);
}

async function cmdBuildLast(client, options) {
  if (!options.name) throw new Error('build last requires --name');
  const resp = await client.get(`${jobPath(options.name)}/lastBuild/api/json`);
  ensureHttpSuccess(resp, `build last ${options.name}`);
  printBuild(resp.data, options.name);
}

function printBuild(d, jobName) {
  const params = (d.actions || [])
    .filter((a) => Array.isArray(a?.parameters))
    .flatMap((a) => a.parameters.map((p) => `${p.name}=${p.value}`))
    .join(', ');
  const causes = (d.actions || [])
    .filter((a) => Array.isArray(a?.causes))
    .flatMap((a) => a.causes.map((c) => c.shortDescription || c._class))
    .join('; ');
  printTable([{
    job: jobName,
    number: d.number,
    result: d.result || (d.building ? 'BUILDING' : ''),
    building: d.building ?? '',
    duration: formatDuration(d.duration),
    timestamp: formatTimestamp(d.timestamp),
    builtOn: d.builtOn || '',
    cause: causes,
    parameters: params,
    url: d.url || '',
  }]);
}

async function cmdConsole(client, options) {
  if (!options.name) throw new Error('console requires --name');
  const buildRef = options.number || 'lastBuild';
  const base = `${jobPath(options.name)}/${buildRef}`;

  if (!options.follow) {
    const resp = await client.get(`${base}/consoleText`, {
      accept: 'text/plain',
      timeout: 60000,
    });
    ensureHttpSuccess(resp, `console ${options.name} #${buildRef}`);
    process.stdout.write(typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data));
    if (typeof resp.data === 'string' && !resp.data.endsWith('\n')) process.stdout.write('\n');
    return;
  }

  // Follow mode: progressive log
  let start = Number.isFinite(options.start) ? options.start : 0;
  const interval = Number.isFinite(options.interval) && options.interval >= 100 ? options.interval : 1000;
  let stopped = false;
  const onSignal = () => { stopped = true; };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  try {
    while (!stopped) {
      const resp = await client.get(`${base}/logText/progressiveText`, {
        params: { start },
        accept: 'text/plain',
        raw: true,
        timeout: 60000,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`console follow failed: HTTP ${resp.status} ${resp.statusText}${text ? ' — ' + text.slice(0, 200) : ''}`);
      }
      const chunk = await resp.text();
      if (chunk) process.stdout.write(chunk);
      const nextSize = resp.headers.get('x-text-size');
      const moreData = resp.headers.get('x-more-data');
      if (nextSize) start = Number.parseInt(nextSize, 10);
      if (moreData !== 'true') break;
      await new Promise((r) => setTimeout(r, interval));
    }
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}

async function cmdBuildTrigger(client, options) {
  if (!options.name) throw new Error('build trigger requires --name');
  const base = jobPath(options.name);
  let url, body;
  if (options.params && Object.keys(options.params).length > 0) {
    url = `${base}/buildWithParameters`;
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(options.params)) {
      form.append(k, v === null || v === undefined ? '' : String(v));
    }
    body = form;
  } else {
    url = `${base}/build`;
  }

  const resp = await client.request({ url, method: 'POST', body, raw: true });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`build trigger failed: HTTP ${resp.status} ${resp.statusText}${text ? ' — ' + text.slice(0, 200) : ''}`);
  }
  const location = resp.headers.get('location') || '';
  const queueIdMatch = location.match(/\/queue\/item\/(\d+)/u);
  printTable([{
    job: options.name,
    triggered: true,
    queueItem: queueIdMatch ? queueIdMatch[1] : '',
    location,
    params: options.params ? JSON.stringify(options.params) : '',
  }]);
}

async function cmdQueueList(client) {
  const resp = await client.get('/queue/api/json');
  ensureHttpSuccess(resp, 'queue list');
  const items = (resp.data.items || []).map((item) => ({
    id: item.id,
    task: item.task?.fullName || item.task?.name || '',
    why: item.why || '',
    stuck: item.stuck ?? '',
    blocked: item.blocked ?? '',
    buildable: item.buildable ?? '',
    inQueueSince: formatTimestamp(item.inQueueSince),
  }));
  printTable(items);
  process.stdout.write(`Total: ${items.length} queue items\n`);
}

async function cmdNodeList(client) {
  const resp = await client.get('/computer/api/json', {
    params: { tree: 'computer[displayName,offline,temporarilyOffline,numExecutors,executors[number,idle],monitorData[*]]' },
  });
  ensureHttpSuccess(resp, 'node list');
  const nodes = (resp.data.computer || []).map((c) => ({
    name: c.displayName,
    offline: c.offline ?? '',
    temporarilyOffline: c.temporarilyOffline ?? '',
    executors: c.numExecutors ?? (c.executors?.length ?? ''),
    idleExecutors: Array.isArray(c.executors) ? c.executors.filter((e) => e.idle).length : '',
  }));
  printTable(nodes);
  process.stdout.write(`Total: ${nodes.length} nodes\n`);
}

async function cmdRaw(client, options) {
  if (!options.path) throw new Error('raw requires --path');
  const apiPath = normalizeApiPath(options.path);
  const resp = await client.request({
    url: apiPath,
    method: options.method,
    params: options.query,
    body: options.data,
    headers: options.headers,
  });
  ensureHttpSuccess(resp, `raw ${options.method} ${apiPath}`);
  const data = resp.data;
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    printTable(data);
  } else if (data && typeof data === 'object' && !Array.isArray(data)) {
    printTable(data);
  } else {
    process.stdout.write(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    process.stdout.write('\n');
  }
}

// ─── Dispatch ─────────────────────────────────────────────────────────

async function runCommand(command, subcommand, options) {
  if (!command || options.help) { showHelp(); return; }

  const { credentials, client } = await createJenkinsAuth({
    host: options.host,
    username: options.username,
    token: options.token,
    password: options.password,
  });

  switch (command) {
    case 'auth-test': return cmdAuthTest(client, credentials);
    case 'whoami': return cmdWhoami(client);
    case 'job': {
      if (subcommand === 'list') return cmdJobList(client, options);
      if (subcommand === 'get') return cmdJobGet(client, options);
      throw new Error('Supported job subcommands: list, get');
    }
    case 'build': {
      if (subcommand === 'get') return cmdBuildGet(client, options);
      if (subcommand === 'last') return cmdBuildLast(client, options);
      if (subcommand === 'trigger') return cmdBuildTrigger(client, options);
      throw new Error('Supported build subcommands: get, last, trigger');
    }
    case 'console': return cmdConsole(client, options);
    case 'queue': {
      if (subcommand === 'list' || subcommand === undefined) return cmdQueueList(client);
      throw new Error('Supported queue subcommands: list');
    }
    case 'node': {
      if (subcommand === 'list' || subcommand === undefined) return cmdNodeList(client);
      throw new Error('Supported node subcommands: list');
    }
    case 'raw': return cmdRaw(client, options);
    default: throw new Error(`Unknown command: ${command}`);
  }
}

function showHelp() {
  process.stdout.write(`Jenkins CLI for Jenkins 2.x (REST API, zero deps)

Credentials: .env file (auto-saved after auth-test) or --host --username --token|--password
  Priority: --token > --password ; JENKINS_TOKEN > JENKINS_PASSWORD

First-time setup:
  node scripts/jenkins.js auth-test --host http://jenkins:8080 --username user --token abc...
  node scripts/jenkins.js auth-test --host http://jenkins:8080 --username user --password p

Common commands:
  node scripts/jenkins.js whoami
  node scripts/jenkins.js job list
  node scripts/jenkins.js job get --name my-job
  node scripts/jenkins.js job get --name folder/sub-job
  node scripts/jenkins.js build last --name my-job
  node scripts/jenkins.js build get --name my-job --number 42
  node scripts/jenkins.js build trigger --name my-job
  node scripts/jenkins.js build trigger --name my-job --params '{"BRANCH":"main","RUN_TESTS":"true"}'
  node scripts/jenkins.js console --name my-job --number 42
  node scripts/jenkins.js console --name my-job --follow                  # tail -f lastBuild
  node scripts/jenkins.js console --name my-job --number 42 --follow      # tail -f specific build
  node scripts/jenkins.js queue list
  node scripts/jenkins.js node list
  node scripts/jenkins.js raw --path api/json
  node scripts/jenkins.js raw --path api/json --query '{"tree":"jobs[name,color]"}'

Folder jobs: pass --name as "folder/sub" or "folder/sub/leaf" (auto-translated to /job/.../job/...).

Optional flags:
  --tree <expr>      Jenkins tree filter (job list)
  --depth <n>        Jenkins depth param (job get)
  --interval <ms>    follow polling interval, default 1000
  --start <bytes>    follow start offset, default 0
  --method <verb>    raw HTTP method, default GET
  --query <json>     raw query string params
  --data <json>      raw request body
  --headers <json>   raw extra headers

.env keys:
  JENKINS_HOST  JENKINS_USERNAME  JENKINS_TOKEN  JENKINS_PASSWORD
`);
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  const { command, subcommand, options } = parseArgs(process.argv.slice(2));
  if (!command || options.help) { showHelp(); return; }
  await runCommand(command, subcommand, options);
}

const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (currentFile === entryFile) {
  main().catch((err) => {
    process.stderr.write(`Jenkins CLI error: ${err.message}\n`);
    process.exit(1);
  });
}
