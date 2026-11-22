// Pick-up script for the factory's scheduled task: claim one eligible `factory` issue,
// release it afterwards, or list what would be picked up.
//
// Usage:
//   node pick-up.mjs list    --repo <owner/name> [--repo ...]
//   node pick-up.mjs claim   --repo <owner/name> [--repo ...] --run-id <id> [--only <owner/name#n>] [--dry-run]
//   node pick-up.mjs release --repo <owner/name> --issue <n> --run-id <id>
//
// State lives in $FACTORY_HOME (default ~/.factory): `armed` (arm file),
// `locks/<owner>-<repo>-<issue>/claim.json`, and `expired/<lock>.<takenAtMs>.<uuid>`, where the
// stale sweep moves a lock before it handles it. The sweep also finishes folders a killed sweep
// left there. One JSON object on stdout, errors on stderr.
// Exit 0 for every normal outcome, 1 on an unexpected error, 2 on bad usage.
//
// claim, release and the stale sweep also POST run events (claimed, released, expired) to the
// dashboard's /api/runs. FACTORY_DASHBOARD_URL overrides https://factory.codyssey.dev;
// FACTORY_INGEST_TOKEN overrides the Keychain item `codyssey-factory-ingest`. A dashboard
// failure never changes the command result: it shows up as the `dashboard` field and one
// stderr line.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKIP_LABELS = [
  'factory-failed',
  'factory-running',
  'needs-plan-approval',
  'needs-decision',
  'needs-pr-read',
];
export const TRUSTED_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR'];
export const STALE_MS = 4 * 60 * 60 * 1000;
export const DEFAULT_DASHBOARD_URL = 'https://factory.codyssey.dev';
export const KEYCHAIN_SERVICE = 'codyssey-factory-ingest';
const POST_TIMEOUT_MS = 10_000;
const RETRY_WAITS_MS = [500, 1000]; // 3 attempts in all, same policy as the report_stage MCP tool
const RUNNING = 'factory-running';
const FAILED = 'factory-failed';
export const FACTORY_LABELS = [
  { name: 'factory', color: '47cbb0', description: '' },
  { name: RUNNING, color: 'FBCA04', description: 'A factory run holds this issue' },
  { name: FAILED, color: 'b60205', description: 'Factory: run gave up; see the last comment' },
  { name: 'needs-plan-approval', color: 'fbca04', description: 'Factory: plan posted on the issue, waiting for the owner' },
  { name: 'plan-approved', color: '0e8a16', description: 'Factory: owner approved the plan; the build may start' },
  { name: 'needs-decision', color: 'd93f0b', description: 'Factory: blocked on a question for the owner' },
  { name: 'needs-pr-read', color: 'FBCA04', description: "Factory: the PR waits for the owner's diff read" },
];

export class UsageError extends Error {}

// ---------- pure logic ----------

// `Depends on:` line -> {refs: [{repo, number}], invalid: [token]}. `none` or empty -> no refs.
export function parseDependsOn(body, repo) {
  const m = /^[ \t]*Depends on:(.*)$/im.exec(body ?? '');
  if (!m) return { refs: [], invalid: [] };
  const refs = [];
  const invalid = [];
  for (const raw of m[1].split(/[,\s]+/)) {
    const tok = raw.trim();
    if (!tok || tok.toLowerCase() === 'none') continue;
    const x = /^(?:([\w.-]+\/[\w.-]+))?#(\d+)$/.exec(tok);
    if (x) refs.push({ repo: x[1] ?? repo, number: Number(x[2]) });
    else invalid.push(tok);
  }
  return { refs, invalid };
}

export function lockName(repo, issue) {
  return `${repo.replace('/', '-')}-${issue}`;
}

// Lock folder name -> {repo, issue} when exactly one repo's lockName prefix fits, else undefined.
// Names cannot be split back on their own, because owner and repo names contain hyphens.
export function matchLockName(name, repos) {
  const hits = [];
  for (const repo of new Set(repos)) {
    const prefix = `${repo.replace('/', '-')}-`;
    const rest = name.slice(prefix.length);
    if (name.startsWith(prefix) && /^\d+$/.test(rest)) hits.push({ repo, issue: Number(rest) });
  }
  return hits.length === 1 ? hits[0] : undefined;
}

// Strictly older than 4 hours. Exactly 4 hours is not stale.
export function isStale(claimedAt, nowMs) {
  const t = Date.parse(claimedAt);
  if (Number.isNaN(t)) return false;
  return nowMs - t > STALE_MS;
}

export function labelNames(issue) {
  return (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
}

// Returns {eligible: true, action} or {eligible: false, reason}.
// issue: {number, title, state: 'OPEN'|'CLOSED', labels, body, author: {login}, authorAssociation}
// A missing authorAssociation fails closed.
// hasLock: boolean. depState: (ref) => 'OPEN' | 'CLOSED' | undefined.
export function evaluateIssue(issue, repo, { hasLock, depState }) {
  const labels = labelNames(issue);
  if (!labels.includes('factory')) return { eligible: false, reason: 'missing label factory' };
  const assoc = issue.authorAssociation;
  if (!TRUSTED_ASSOCIATIONS.includes(assoc)) {
    return { eligible: false, reason: `untrusted author ${issue.author?.login ?? 'unknown'} (${assoc ?? 'unknown'})` };
  }
  for (const l of SKIP_LABELS) {
    if (labels.includes(l)) return { eligible: false, reason: `has label ${l}` };
  }
  if (hasLock) return { eligible: false, reason: 'locked' };
  const closed = String(issue.state).toUpperCase() === 'CLOSED';
  if (closed) {
    if (labels.includes('plan-approved')) return { eligible: true, action: 'archive' };
    return { eligible: false, reason: 'closed' };
  }
  const { refs, invalid } = parseDependsOn(issue.body, repo);
  if (invalid.length) return { eligible: false, reason: `unparseable Depends on: ${invalid.join(' ')}` };
  for (const ref of refs) {
    const s = depState(ref);
    const name = `${ref.repo}#${ref.number}`;
    if (s === undefined) return { eligible: false, reason: `dependency ${name} unreadable` };
    if (String(s).toUpperCase() !== 'CLOSED') return { eligible: false, reason: `open dependency ${name}` };
  }
  return { eligible: true, action: labels.includes('plan-approved') ? 'implement' : 'plan' };
}

// ---------- boundary (gh + filesystem + clock) ----------

export function makeGh(run = defaultRun) {
  // `gh issue list/view --json` has no author association field, so issues come from the
  // REST API, which returns `author_association`. Entries with a `pull_request` key are PRs.
  const normalize = (i) => ({
    number: i.number,
    title: i.title,
    state: String(i.state).toUpperCase(),
    labels: (i.labels ?? []).map((l) => (typeof l === 'string' ? { name: l } : { name: l.name })),
    body: i.body ?? '',
    author: { login: i.user?.login },
    authorAssociation: i.author_association,
  });
  const list = (repo, labels, state) =>
    JSON.parse(run(['api', '--paginate', '--slurp', `repos/${repo}/issues?labels=${labels}&state=${state}&per_page=100`]) || '[]')
      .flat()
      .filter((i) => !i.pull_request)
      .map(normalize);
  return {
    listOpen: (repo) => list(repo, 'factory', 'open'),
    listClosedApproved: (repo) => list(repo, 'factory,plan-approved', 'closed'),
    getIssue(repo, n) {
      const i = JSON.parse(run(['api', `repos/${repo}/issues/${n}`]));
      return i.pull_request ? null : normalize(i);
    },
    issueState: (repo, n) => JSON.parse(run(['issue', 'view', String(n), '--repo', repo, '--json', 'state'])).state,
    listLabels: (repo) => JSON.parse(run(['label', 'list', '--repo', repo, '--limit', '1000', '--json', 'name']) || '[]').map((l) => l.name),
    createLabel(repo, { name, color, description }) {
      try {
        run(['label', 'create', name, '--repo', repo, '--color', color, '--description', description]);
      } catch (e) {
        if (!/already exists/i.test(`${e.stderr ?? ''}${e.message}`)) throw e;
      }
    },
    addLabel: (repo, n, name) => void run(['issue', 'edit', String(n), '--repo', repo, '--add-label', name]),
    removeLabel: (repo, n, name) => void run(['issue', 'edit', String(n), '--repo', repo, '--remove-label', name]),
    comment: (repo, n, body) => void run(['issue', 'comment', String(n), '--repo', repo, '--body', body]),
  };
}

function defaultRun(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// ---------- dashboard boundary (fetch + Keychain + clock) ----------

// URL must be https, or http for localhost / 127.0.0.1 only. Returns the origin+path or undefined.
export function resolveDashboardUrl(env = process.env) {
  const raw = (env.FACTORY_DASHBOARD_URL || DEFAULT_DASHBOARD_URL).trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    return undefined;
  }
  const localHttp = u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  if (u.protocol !== 'https:' && !localHttp) return undefined;
  return raw.replace(/\/+$/, '');
}

// Env var first, then the Keychain through an injectable runner. Never throws, never logs the token.
export function resolveIngestToken(env = process.env, runSecurity = defaultSecurity) {
  const fromEnv = (env.FACTORY_INGEST_TOKEN ?? '').trim();
  if (fromEnv) return fromEnv;
  try {
    return String(runSecurity(['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'])).trim() || undefined;
  } catch {
    return undefined;
  }
}

function defaultSecurity(args) {
  return execFileSync('security', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shortError = (e) => {
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'timeout';
  return String(e?.cause?.code ?? e?.message ?? e).replace(/\s+/g, ' ').slice(0, 80);
};

// post(event) resolves to the `dashboard` field value and writes one stderr line on anything but "sent".
// event: {event, run_id, repo, issue_number, action?, occurred_at}.
export function makeDashboard({
  env = process.env, fetchImpl = globalThis.fetch, sleep = defaultSleep, runSecurity = defaultSecurity,
  timeoutMs = POST_TIMEOUT_MS, retryWaitsMs = RETRY_WAITS_MS,
} = {}) {
  let token; // resolved once per process, on first use
  let tokenResolved = false;
  const getToken = () => {
    if (!tokenResolved) {
      token = resolveIngestToken(env, runSecurity);
      tokenResolved = true;
    }
    return token;
  };
  return {
    async post(ev) {
      const fail = (result) => {
        console.error(`pick-up: dashboard ${ev.event} for ${ev.repo}#${ev.issue_number} ${result}`);
        return result;
      };
      const url = resolveDashboardUrl(env);
      if (!url) return fail('skipped: bad url');
      const bearer = getToken();
      if (!bearer) return fail('skipped: no token');
      const body = JSON.stringify(ev);
      let result = 'failed: unknown';
      for (let attempt = 0; attempt <= retryWaitsMs.length; attempt++) {
        let retry = true;
        try {
          const res = await fetchImpl(`${url}/api/runs`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
            body,
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (res.status === 200 || res.status === 201) return 'sent';
          result = `failed: ${res.status}`;
          retry = res.status >= 500;
        } catch (e) {
          result = `failed: ${shortError(e)}`;
        }
        if (!retry || attempt === retryWaitsMs.length) break;
        await sleep(retryWaitsMs[attempt]);
      }
      return fail(result);
    },
  };
}

// Dashboard failure never changes a command result, so a throwing sender is folded into the field.
async function sendEvent(d, ev) {
  try {
    return await d.dashboard.post(ev);
  } catch (e) {
    const result = `failed: ${shortError(e)}`;
    console.error(`pick-up: dashboard ${ev.event} for ${ev.repo}#${ev.issue_number} ${result}`);
    return result;
  }
}

export function makeDeps(env = process.env) {
  return {
    stateDir: env.FACTORY_HOME || join(homedir(), '.factory'),
    gh: makeGh(),
    dashboard: makeDashboard({ env }),
    now: () => Date.now(),
  };
}

export const locksDir = (d) => join(d.stateDir, 'locks');
const expiredDir = (d) => join(d.stateDir, 'expired');
const lockPath = (d, repo, issue) => join(locksDir(d), lockName(repo, issue));
const iso = (d) => new Date(d.now()).toISOString();

// expired/ name `<lock>.<takenAtMs>.<uuid>` -> {lock, takenAtMs}. A #10 name `<lock>.<uuid>` has no
// take time and counts as taken at 0. Any other name -> null. Lock names may contain dots.
const TAKEN_RE = /^(.+?)(?:\.(\d+))?\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function parseTaken(name) {
  const m = TAKEN_RE.exec(name);
  return m && { lock: m[1], takenAtMs: Number(m[2] ?? 0) };
}

// {kind: 'gone'} | {kind: 'unreadable', reason, mtimeMs} | {kind: 'readable', claim}.
// `gone` is an entry that vanished after the listing or is not a folder.
export function inspectLock(dir) {
  let st;
  try {
    st = statSync(dir);
  } catch (e) {
    if (e.code === 'ENOENT') return { kind: 'gone' };
    throw e;
  }
  if (!st.isDirectory()) return { kind: 'gone' };
  const unreadable = (reason) => ({ kind: 'unreadable', reason, mtimeMs: st.mtimeMs });
  let text;
  try {
    text = readFileSync(join(dir, 'claim.json'), 'utf8');
  } catch (e) {
    return unreadable(e.code === 'ENOENT' ? 'no claim.json' : 'claim.json cannot be read');
  }
  let claim;
  try {
    claim = JSON.parse(text);
  } catch {
    return unreadable('claim.json does not parse');
  }
  if (Number.isNaN(Date.parse(claim?.claimed_at))) return unreadable('claimed_at is not a date');
  return { kind: 'readable', claim };
}

// Stale = a readable claim older than 4 hours, or an unreadable lock folder untouched for 4 hours.
export function lockIsStale(lock, nowMs) {
  if (lock.kind === 'readable') return isStale(lock.claim.claimed_at, nowMs);
  if (lock.kind === 'unreadable') return nowMs - lock.mtimeMs > STALE_MS;
  return false;
}

// Moves a folder to expired/<lock>.<now>.<uuid> so only one claim handles it. The name carries the
// take time, since a rename keeps the folder mtime. Undefined when another claim took it first.
function takeLock(d, from, lock) {
  mkdirSync(expiredDir(d), { recursive: true });
  const taken = join(expiredDir(d), `${lock}.${d.now()}.${randomUUID()}`);
  try {
    renameSync(from, taken);
  } catch (e) {
    if (e.code === 'ENOENT') return undefined;
    throw e;
  }
  return taken;
}

// A folder left in expired/ is still a stuck issue only while the issue keeps factory-running and no
// claim holds it. Lock, labels, lock again: a claim makes its lock before it adds the label, and a
// release removes the label before the lock.
function stillStuck(d, { repo, issue }) {
  const held = () => existsSync(lockPath(d, repo, issue));
  if (held()) return false;
  const found = d.gh.getIssue(repo, issue);
  return Boolean(found) && labelNames(found).includes(RUNNING) && !held();
}

export function ensureLabels(gh, repo) {
  const have = new Set(gh.listLabels(repo).map((n) => n.toLowerCase()));
  const created = [];
  for (const label of FACTORY_LABELS) {
    if (have.has(label.name.toLowerCase())) continue;
    gh.createLabel(repo, label);
    created.push(label.name);
  }
  return created;
}

function ignoreFailure(fn) {
  try {
    fn();
  } catch {
    /* label already absent */
  }
}

// ---------- commands ----------

function gatherIssues(d, repos) {
  const rows = [];
  repos.forEach((repo, order) => {
    const seen = new Set();
    for (const issue of [...d.gh.listOpen(repo), ...d.gh.listClosedApproved(repo)]) {
      if (seen.has(issue.number)) continue;
      seen.add(issue.number);
      rows.push({ repo, order, issue });
    }
  });
  rows.sort((a, b) => a.issue.number - b.issue.number || a.order - b.order);
  return rows;
}

function evaluateRows(d, rows) {
  const cache = new Map();
  const depState = (ref) => {
    const key = `${ref.repo}#${ref.number}`;
    if (!cache.has(key)) {
      let s;
      try {
        s = d.gh.issueState(ref.repo, ref.number);
      } catch {
        s = undefined;
      }
      cache.set(key, s);
    }
    return cache.get(key);
  };
  return rows.map((r) => ({
    ...r,
    result: evaluateIssue(r.issue, r.repo, { hasLock: existsSync(lockPath(d, r.repo, r.issue.number)), depState }),
  }));
}

export function cmdList(d, { repos }) {
  const evaluated = evaluateRows(d, gatherIssues(d, repos));
  return {
    candidates: evaluated
      .filter((e) => e.result.eligible)
      .map((e) => ({ repo: e.repo, issue: e.issue.number, title: e.issue.title, action: e.result.action })),
    skipped: evaluated
      .filter((e) => !e.result.eligible)
      .map((e) => ({ repo: e.repo, issue: e.issue.number, reason: e.result.reason })),
  };
}

// Sweeps locks/ and the folders a killed sweep left in expired/. Inspect, staleness check and take
// run back to back with no await or gh call between them, so two claims handle each folder once.
async function handleStale(d, repos, dryRun) {
  const stale = [];
  const list = (dir) => (existsSync(dir) ? readdirSync(dir) : []);
  const found = [
    ...list(locksDir(d)).map((name) => ({ path: join(locksDir(d), name), name })),
    ...list(expiredDir(d)).flatMap((n) => {
      const t = parseTaken(n);
      return t ? [{ path: join(expiredDir(d), n), name: t.lock, takenAtMs: t.takenAtMs }] : [];
    }),
  ];
  for (const { path, name, takenAtMs } of found) {
    const lock = inspectLock(path);
    if (lock.kind === 'gone') continue;
    // A folder in locks/ is stale by its claim or mtime; one left in expired/ by its take time.
    const retake = takenAtMs !== undefined;
    if (retake ? d.now() - takenAtMs <= STALE_MS : !lockIsStale(lock, d.now())) continue;
    let entry;
    let body;
    if (lock.kind === 'readable') {
      const { claim } = lock;
      entry = { lock: name, repo: claim.repo, issue: claim.issue, run_id: claim.run_id, claimed_at: claim.claimed_at };
      body = `Factory run ${claim.run_id} claimed this issue at ${claim.claimed_at} and did not release it within 4 hours. Marked factory-failed. Remove the label to retry.`;
    } else {
      const changedAt = new Date(lock.mtimeMs).toISOString();
      entry = { lock: name, ...matchLockName(name, repos), reason: lock.reason, changed_at: changedAt };
      body = `A factory run left an unreadable lock on this issue (${lock.reason}), last changed at ${changedAt}, more than 4 hours ago. Marked factory-failed. Remove the label to retry.`;
    }
    let taken;
    if (!dryRun) {
      taken = takeLock(d, path, name);
      if (!taken) continue;
    }
    try {
      if (retake && entry.repo && !stillStuck(d, entry)) {
        if (taken) rmSync(taken, { recursive: true, force: true });
        continue;
      }
      stale.push(entry);
      if (dryRun) continue;
      if (entry.repo) {
        // factory-running goes last: stillStuck reads it, so a retry after any partial run finishes the issue.
        ensureLabels(d.gh, entry.repo);
        d.gh.addLabel(entry.repo, entry.issue, FAILED);
        d.gh.comment(entry.repo, entry.issue, body);
        ignoreFailure(() => d.gh.removeLabel(entry.repo, entry.issue, RUNNING));
        const after = d.gh.getIssue(entry.repo, entry.issue);
        if (after && labelNames(after).includes(RUNNING)) throw new Error(`${RUNNING} is still on ${entry.repo}#${entry.issue}`);
      }
    } catch (err) {
      if (taken) {
        try {
          renameSync(taken, path); // the next tick retries, as before the take
        } catch {
          /* another claim relocked the issue; keep its lock */
        }
      }
      throw err;
    }
    rmSync(taken, { recursive: true, force: true });
    if (entry.run_id) {
      entry.dashboard = await sendEvent(d, {
        run_id: entry.run_id, repo: entry.repo, issue_number: entry.issue, event: 'expired', occurred_at: iso(d),
      });
    }
  }
  return stale;
}

export async function cmdClaim(d, { repos, runId, only, dryRun }) {
  if (!only && !existsSync(join(d.stateDir, 'armed'))) return { status: 'not_armed' };
  const stale = await handleStale(d, repos, dryRun);

  let rows;
  if (only) {
    const one = d.gh.getIssue(only.repo, only.issue);
    if (!one) return { status: 'none', reason: 'not an issue', stale };
    rows = [{ repo: only.repo, order: 0, issue: one }];
  } else {
    rows = gatherIssues(d, repos);
  }
  const evaluated = evaluateRows(d, rows);
  const eligible = evaluated.filter((e) => e.result.eligible);
  if (only && !eligible.length) return { status: 'none', reason: evaluated[0].result.reason, stale };

  mkdirSync(locksDir(d), { recursive: true });
  for (const e of eligible) {
    const dir = lockPath(d, e.repo, e.issue.number);
    try {
      mkdirSync(dir); // atomic claim: fails with EEXIST when another run holds it
    } catch (err) {
      if (err.code === 'EEXIST') continue;
      throw err;
    }
    const claimedAt = iso(d);
    const action = e.result.action;
    try {
      writeFileSync(
        join(dir, 'claim.json'),
        JSON.stringify({ repo: e.repo, issue: e.issue.number, action, run_id: runId, claimed_at: claimedAt }, null, 2)
      );
      ensureLabels(d.gh, e.repo);
      d.gh.addLabel(e.repo, e.issue.number, RUNNING);
      d.gh.comment(
        e.repo,
        e.issue.number,
        `Claimed by factory run ${runId} at ${claimedAt}. Action: ${action}.${dryRun ? ' Dry run: no work will be done.' : ''}`
      );
    } catch (err) {
      rmSync(dir, { recursive: true, force: true });
      throw err;
    }
    const dashboard = dryRun
      ? 'skipped: dry run'
      : await sendEvent(d, {
          run_id: runId, repo: e.repo, issue_number: e.issue.number, event: 'claimed', action, occurred_at: claimedAt,
        });
    return {
      status: 'claimed',
      repo: e.repo,
      issue: e.issue.number,
      title: e.issue.title,
      action,
      run_id: runId,
      dry_run: dryRun,
      dashboard,
      stale,
    };
  }
  return { status: 'none', stale };
}

export async function cmdRelease(d, { repo, issue, runId }) {
  const dir = lockPath(d, repo, issue);
  if (!existsSync(dir)) return { status: 'not_claimed' };
  let claim;
  try {
    claim = JSON.parse(readFileSync(join(dir, 'claim.json'), 'utf8'));
  } catch {
    claim = {};
  }
  if (claim.run_id !== runId) return { status: 'not_owner' };
  ignoreFailure(() => d.gh.removeLabel(repo, issue, RUNNING));
  const releasedAt = iso(d);
  d.gh.comment(repo, issue, `Released by factory run ${runId} at ${releasedAt}.`);
  rmSync(dir, { recursive: true, force: true });
  const dashboard = await sendEvent(d, {
    run_id: runId, repo, issue_number: issue, event: 'released', occurred_at: releasedAt,
  });
  return { status: 'released', repo, issue, dashboard };
}

// ---------- CLI ----------

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!['list', 'claim', 'release'].includes(cmd)) throw new UsageError('command must be list, claim or release');
  const o = { cmd, repos: [], dryRun: false };
  for (let i = 0; i < rest.length; i++) {
    const f = rest[i];
    const val = () => {
      if (i + 1 >= rest.length) throw new UsageError(`${f} needs a value`);
      return rest[++i];
    };
    if (f === '--repo') {
      const r = val();
      if (!REPO_RE.test(r)) throw new UsageError(`bad repo: ${r}`);
      o.repos.push(r);
    } else if (f === '--run-id') o.runId = val();
    else if (f === '--issue') {
      const n = val();
      if (!/^\d+$/.test(n)) throw new UsageError(`bad issue number: ${n}`);
      o.issue = Number(n);
    } else if (f === '--only') {
      const m = /^([\w.-]+\/[\w.-]+)#(\d+)$/.exec(val());
      if (!m) throw new UsageError('--only must look like owner/name#n');
      o.only = { repo: m[1], issue: Number(m[2]) };
    } else if (f === '--dry-run') o.dryRun = true;
    else throw new UsageError(`unknown flag: ${f}`);
  }
  if (!o.repos.length) throw new UsageError('at least one --repo is required');
  if (cmd !== 'list' && !o.runId) throw new UsageError('--run-id is required');
  if (cmd === 'release') {
    if (o.issue === undefined) throw new UsageError('--issue is required');
    if (o.repos.length !== 1) throw new UsageError('release takes exactly one --repo');
    if (o.only || o.dryRun) throw new UsageError('release takes no --only or --dry-run');
  }
  if (cmd === 'list' && (o.only || o.dryRun || o.runId || o.issue !== undefined)) {
    throw new UsageError('list takes only --repo');
  }
  if (cmd === 'claim') {
    if (o.issue !== undefined) throw new UsageError('claim takes no --issue');
    if (o.only && !o.repos.includes(o.only.repo)) throw new UsageError('--only repo must also be passed as --repo');
  }
  return o;
}

export async function main(argv, d = makeDeps()) {
  const o = parseArgs(argv);
  if (o.cmd === 'list') return cmdList(d, o);
  if (o.cmd === 'claim') return await cmdClaim(d, o);
  return await cmdRelease(d, { repo: o.repos[0], issue: o.issue, runId: o.runId });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(JSON.stringify(await main(process.argv.slice(2))));
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`usage error: ${e.message}`);
      process.exit(2);
    }
    console.error(`pick-up failed: ${e?.stderr || e?.message || e}`);
    process.exit(1);
  }
}
