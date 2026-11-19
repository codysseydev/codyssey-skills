// Pick-up script for the factory's scheduled task: claim one eligible `factory` issue,
// release it afterwards, or list what would be picked up.
//
// Usage:
//   node pick-up.mjs list    --repo <owner/name> [--repo ...]
//   node pick-up.mjs claim   --repo <owner/name> [--repo ...] --run-id <id> [--only <owner/name#n>] [--dry-run]
//   node pick-up.mjs release --repo <owner/name> --issue <n> --run-id <id>
//
// State lives in $FACTORY_HOME (default ~/.factory): `armed` (arm file) and
// `locks/<owner>-<repo>-<issue>/claim.json`. One JSON object on stdout, errors on stderr.
// Exit 0 for every normal outcome, 1 on an unexpected error, 2 on bad usage.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
const RUNNING = 'factory-running';
const FAILED = 'factory-failed';
const LABEL_META = {
  [RUNNING]: { description: 'A factory run holds this issue', color: 'FBCA04' },
  [FAILED]: { description: 'The factory run gave up on this issue', color: 'D93F0B' },
};

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
    JSON.parse(run(['api', `repos/${repo}/issues?labels=${labels}&state=${state}&per_page=100`]) || '[]')
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
    ensureLabel(repo, name) {
      const meta = LABEL_META[name] ?? { description: '', color: 'EDEDED' };
      try {
        run(['label', 'create', name, '--repo', repo, '--description', meta.description, '--color', meta.color]);
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

export function makeDeps(env = process.env) {
  return {
    stateDir: env.FACTORY_HOME || join(homedir(), '.factory'),
    gh: makeGh(),
    now: () => Date.now(),
  };
}

const locksDir = (d) => join(d.stateDir, 'locks');
const lockPath = (d, repo, issue) => join(locksDir(d), lockName(repo, issue));
const iso = (d) => new Date(d.now()).toISOString();

function readClaims(d) {
  if (!existsSync(locksDir(d))) return [];
  const out = [];
  for (const name of readdirSync(locksDir(d))) {
    const file = join(locksDir(d), name, 'claim.json');
    try {
      out.push({ dir: join(locksDir(d), name), claim: JSON.parse(readFileSync(file, 'utf8')) });
    } catch {
      console.error(`pick-up: ignoring unreadable lock ${name}`);
    }
  }
  return out;
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

function handleStale(d, runId, dryRun) {
  const stale = [];
  for (const { dir, claim } of readClaims(d)) {
    if (!isStale(claim.claimed_at, d.now())) continue;
    stale.push({ repo: claim.repo, issue: claim.issue, run_id: claim.run_id, claimed_at: claim.claimed_at });
    if (dryRun) continue;
    ignoreFailure(() => d.gh.removeLabel(claim.repo, claim.issue, RUNNING));
    d.gh.ensureLabel(claim.repo, FAILED);
    d.gh.addLabel(claim.repo, claim.issue, FAILED);
    d.gh.comment(
      claim.repo,
      claim.issue,
      `Factory run ${claim.run_id} claimed this issue at ${claim.claimed_at} and did not release it within 4 hours. Marked factory-failed. Remove the label to retry.`
    );
    rmSync(dir, { recursive: true, force: true });
  }
  return stale;
}

export function cmdClaim(d, { repos, runId, only, dryRun }) {
  if (!only && !existsSync(join(d.stateDir, 'armed'))) return { status: 'not_armed' };
  const stale = handleStale(d, runId, dryRun);

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
      d.gh.ensureLabel(e.repo, RUNNING);
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
    return {
      status: 'claimed',
      repo: e.repo,
      issue: e.issue.number,
      title: e.issue.title,
      action,
      run_id: runId,
      dry_run: dryRun,
      stale,
    };
  }
  return { status: 'none', stale };
}

export function cmdRelease(d, { repo, issue, runId }) {
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
  d.gh.comment(repo, issue, `Released by factory run ${runId} at ${iso(d)}.`);
  rmSync(dir, { recursive: true, force: true });
  return { status: 'released', repo, issue };
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

export function main(argv, d = makeDeps()) {
  const o = parseArgs(argv);
  if (o.cmd === 'list') return cmdList(d, o);
  if (o.cmd === 'claim') return cmdClaim(d, o);
  return cmdRelease(d, { repo: o.repos[0], issue: o.issue, runId: o.runId });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(JSON.stringify(main(process.argv.slice(2))));
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`usage error: ${e.message}`);
      process.exit(2);
    }
    console.error(`pick-up failed: ${e?.stderr || e?.message || e}`);
    process.exit(1);
  }
}
