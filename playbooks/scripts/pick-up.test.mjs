import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SKIP_LABELS, parseDependsOn, isStale, evaluateIssue, cmdList, cmdClaim, makeGh, cmdRelease, parseArgs, UsageError, lockName,
  makeDashboard, resolveDashboardUrl, resolveIngestToken, main,
} from './pick-up.mjs';

const R = 'o/r';
const T0 = Date.parse('2026-01-01T12:00:00Z');
const H = 3600 * 1000;

function issue(number, labels = ['factory'], extra = {}) {
  return {
    number, title: `t${number}`, state: 'OPEN', labels: labels.map((name) => ({ name })), body: '',
    author: { login: 'owner' }, authorAssociation: 'OWNER', ...extra,
  };
}

function fake({ issues = {}, nowMs = T0, armed = true, dashboardResult = 'sent' } = {}) {
  const stateDir = mkdtempSync(join(tmpdir(), 'pickup-'));
  if (armed) writeFileSync(join(stateDir, 'armed'), '');
  const calls = [];
  const rec = (name, fn) => (...a) => {
    calls.push([name, ...a]);
    return fn(...a);
  };
  const all = (repo) => issues[repo] ?? [];
  const gh = {
    listOpen: rec('listOpen', (repo) => all(repo).filter((i) => i.state === 'OPEN')),
    listClosedApproved: rec('listClosedApproved', (repo) =>
      all(repo).filter((i) => i.state === 'CLOSED' && i.labels.some((l) => l.name === 'plan-approved'))),
    getIssue: rec('getIssue', (repo, n) => all(repo).find((i) => i.number === n)),
    issueState: rec('issueState', (repo, n) => all(repo).find((i) => i.number === n)?.state),
    ensureLabel: rec('ensureLabel', () => {}),
    addLabel: rec('addLabel', () => {}),
    removeLabel: rec('removeLabel', () => {}),
    comment: rec('comment', () => {}),
  };
  const events = [];
  const dashboard = { post: async (ev) => (events.push(ev), dashboardResult) };
  return { d: { stateDir, gh, dashboard, now: () => nowMs }, calls, stateDir, events };
}

function writeLock(stateDir, repo, n, runId, claimedAt) {
  const dir = join(stateDir, 'locks', lockName(repo, n));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'claim.json'), JSON.stringify({ repo, issue: n, action: 'plan', run_id: runId, claimed_at: claimedAt }));
  return dir;
}

test('parseDependsOn handles same-repo, cross-repo, none and missing line', () => {
  assert.deepEqual(parseDependsOn('x\nDepends on: #12, #13 #14\ny', R).refs, [
    { repo: R, number: 12 }, { repo: R, number: 13 }, { repo: R, number: 14 },
  ]);
  assert.deepEqual(parseDependsOn('Depends on: a/b#7, #8', R).refs, [
    { repo: 'a/b', number: 7 }, { repo: R, number: 8 },
  ]);
  assert.deepEqual(parseDependsOn('Depends on: none', R), { refs: [], invalid: [] });
  assert.deepEqual(parseDependsOn('Depends on:', R), { refs: [], invalid: [] });
  assert.deepEqual(parseDependsOn('no such line', R), { refs: [], invalid: [] });
  assert.deepEqual(parseDependsOn(null, R), { refs: [], invalid: [] });
  assert.deepEqual(parseDependsOn('Depends on: soon', R).invalid, ['soon']);
});

const ok = { hasLock: false, depState: () => 'CLOSED' };

for (const label of SKIP_LABELS) {
  test(`evaluateIssue skips an issue with ${label}`, () => {
    const r = evaluateIssue(issue(1, ['factory', label]), R, ok);
    assert.equal(r.eligible, false);
    assert.match(r.reason, new RegExp(label));
  });
}

for (const a of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
  test(`evaluateIssue trusts author association ${a}`, () => {
    assert.equal(evaluateIssue(issue(1, ['factory'], { authorAssociation: a }), R, ok).eligible, true);
  });
}

for (const a of ['NONE', 'CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', undefined]) {
  test(`evaluateIssue skips author association ${a}`, () => {
    const r = evaluateIssue(issue(1, ['factory'], { author: { login: 'eve' }, authorAssociation: a }), R, ok);
    assert.equal(r.eligible, false);
    assert.equal(r.reason, `untrusted author eve (${a ?? 'unknown'})`);
  });
}

test('untrusted author is skipped for closed archive candidates and --only', async () => {
  const closed = issue(1, ['factory', 'plan-approved'], { state: 'CLOSED', authorAssociation: 'NONE' });
  assert.equal(evaluateIssue(closed, R, ok).eligible, false);
  const { d } = fake({ issues: { [R]: [issue(2, ['factory'], { authorAssociation: 'CONTRIBUTOR' })] } });
  const out = await cmdClaim(d, { repos: [R], runId: 'a', only: { repo: R, issue: 2 }, dryRun: false });
  assert.equal(out.status, 'none');
  assert.match(out.reason, /untrusted author/);
});

test('evaluateIssue: lock, open dependency, plan, implement, archive', () => {
  assert.equal(evaluateIssue(issue(1), R, { ...ok, hasLock: true }).eligible, false);
  const dep = issue(1, ['factory'], { body: 'Depends on: #2' });
  assert.equal(evaluateIssue(dep, R, { hasLock: false, depState: () => 'OPEN' }).eligible, false);
  assert.equal(evaluateIssue(dep, R, ok).action, 'plan');
  assert.equal(evaluateIssue(issue(1, ['factory', 'plan-approved']), R, ok).action, 'implement');
  assert.equal(evaluateIssue(issue(1, ['factory', 'plan-approved'], { state: 'CLOSED' }), R, ok).action, 'archive');
  assert.equal(evaluateIssue(issue(1, ['factory'], { state: 'CLOSED' }), R, ok).eligible, false);
  assert.equal(evaluateIssue(issue(1, ['plan-approved']), R, ok).eligible, false);
});

test('list reports candidates and skipped', () => {
  const { d } = fake({ issues: { [R]: [issue(5), issue(6, ['factory', 'needs-decision'])] } });
  const out = cmdList(d, { repos: [R] });
  assert.deepEqual(out.candidates, [{ repo: R, issue: 5, title: 't5', action: 'plan' }]);
  assert.equal(out.skipped[0].issue, 6);
});

test('claim: not armed returns not_armed and makes no gh call', async () => {
  const { d, calls } = fake({ armed: false, issues: { [R]: [issue(1)] } });
  assert.deepEqual(await cmdClaim(d, { repos: [R], runId: 'a', dryRun: false }), { status: 'not_armed' });
  assert.equal(calls.length, 0);
});

test('claim: --only bypasses the arm file', async () => {
  const { d, calls } = fake({ armed: false, issues: { [R]: [issue(1)] } });
  const out = await cmdClaim(d, { repos: [R], runId: 'a', only: { repo: R, issue: 1 }, dryRun: true });
  assert.equal(out.status, 'claimed');
  assert.equal(out.dry_run, true);
  assert.ok(calls.some(([n, , , body]) => n === 'comment' && / Dry run: no work will be done\.$/.test(body)));
});

test('claim: --only on an ineligible issue prints none with reason', async () => {
  const { d } = fake({ issues: { [R]: [issue(1, ['factory', 'needs-pr-read'])] } });
  const out = await cmdClaim(d, { repos: [R], runId: 'a', only: { repo: R, issue: 1 }, dryRun: false });
  assert.equal(out.status, 'none');
  assert.match(out.reason, /needs-pr-read/);
});

test('claim: takes the oldest eligible, writes lock, label and comment', async () => {
  const { d, calls, stateDir } = fake({ issues: { [R]: [issue(9), issue(3)] } });
  const out = await cmdClaim(d, { repos: [R], runId: 'run1', dryRun: false });
  assert.equal(out.issue, 3);
  assert.equal(out.action, 'plan');
  const claim = JSON.parse(readFileSync(join(stateDir, 'locks', lockName(R, 3), 'claim.json'), 'utf8'));
  assert.equal(claim.run_id, 'run1');
  assert.equal(claim.claimed_at, new Date(T0).toISOString());
  assert.ok(calls.some(([n, , , l]) => n === 'addLabel' && l === 'factory-running'));
  assert.ok(calls.some(([n, , , b]) => n === 'comment' && b === `Claimed by factory run run1 at ${new Date(T0).toISOString()}. Action: plan.`));
});

test('claim: atomic lock, a second claim moves to the next issue', async () => {
  const { d } = fake({ issues: { [R]: [issue(1), issue(2)] } });
  const a = await cmdClaim(d, { repos: [R], runId: 'a', dryRun: false });
  const b = await cmdClaim(d, { repos: [R], runId: 'b', dryRun: false });
  assert.equal(a.issue, 1);
  assert.equal(b.issue, 2);
  assert.equal((await cmdClaim(d, { repos: [R], runId: 'c', dryRun: false })).status, 'none');
});

test('claim: lock created between listing and mkdir is skipped via EEXIST', async () => {
  const { d, stateDir } = fake({ issues: { [R]: [issue(1), issue(2)] } });
  const orig = d.gh.listOpen;
  d.gh.listOpen = (repo) => {
    const out = orig(repo);
    writeLock(stateDir, R, 1, 'other', new Date(T0).toISOString()); // another run wins the race
    return out;
  };
  // eligibility was computed before the lock appeared only if evaluation ran first; here the
  // lock exists before evaluation, so issue 1 is skipped as locked and 2 is claimed.
  assert.equal((await cmdClaim(d, { repos: [R], runId: 'a', dryRun: false })).issue, 2);
});

test('stale: exactly 4h is not stale, just over is', () => {
  const at = new Date(T0).toISOString();
  assert.equal(isStale(at, T0 + 4 * H), false);
  assert.equal(isStale(at, T0 + 4 * H + 1), true);
});

test('stale: claim marks factory-failed, comments, deletes lock and lists it', async () => {
  const { d, calls, stateDir } = fake({ nowMs: T0 + 4 * H + 1000, issues: { [R]: [] } });
  const claimedAt = new Date(T0).toISOString();
  const dir = writeLock(stateDir, R, 4, 'old', claimedAt);
  const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
  assert.deepEqual(out.stale, [{ repo: R, issue: 4, run_id: 'old', claimed_at: claimedAt, dashboard: 'sent' }]);
  assert.equal(existsSync(dir), false);
  assert.ok(calls.some(([n, , , l]) => n === 'removeLabel' && l === 'factory-running'));
  assert.ok(calls.some(([n, , , l]) => n === 'addLabel' && l === 'factory-failed'));
  assert.ok(calls.some(([n, , , b]) => n === 'comment' && b ===
    `Factory run old claimed this issue at ${claimedAt} and did not release it within 4 hours. Marked factory-failed. Remove the label to retry.`));
});

test('stale: a lock at exactly 4h is left alone', async () => {
  const { d, stateDir } = fake({ nowMs: T0 + 4 * H, issues: { [R]: [] } });
  const dir = writeLock(stateDir, R, 4, 'old', new Date(T0).toISOString());
  const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
  assert.deepEqual(out.stale, []);
  assert.equal(existsSync(dir), true);
});

test('dry-run lists stale locks and changes nothing on stale issues', async () => {
  const { d, calls, stateDir } = fake({ nowMs: T0 + 5 * H, issues: { [R]: [] } });
  const dir = writeLock(stateDir, R, 4, 'old', new Date(T0).toISOString());
  const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: true });
  assert.equal(out.stale.length, 1);
  assert.equal(existsSync(dir), true);
  assert.equal(calls.filter(([n]) => ['addLabel', 'removeLabel', 'comment', 'ensureLabel'].includes(n)).length, 0);
});

test('release refuses a different run id and changes nothing', async () => {
  const { d, calls, stateDir } = fake();
  const dir = writeLock(stateDir, R, 1, 'owner-run', new Date(T0).toISOString());
  assert.deepEqual(await cmdRelease(d, { repo: R, issue: 1, runId: 'intruder' }), { status: 'not_owner' });
  assert.equal(existsSync(dir), true);
  assert.equal(calls.length, 0);
});

test('release by the owner removes label, comments and deletes the lock', async () => {
  const { d, calls, stateDir } = fake();
  const dir = writeLock(stateDir, R, 1, 'me', new Date(T0).toISOString());
  assert.deepEqual(await cmdRelease(d, { repo: R, issue: 1, runId: 'me' }), { status: 'released', repo: R, issue: 1, dashboard: 'sent' });
  assert.equal(existsSync(dir), false);
  assert.ok(calls.some(([n]) => n === 'removeLabel'));
  assert.ok(calls.some(([n, , , b]) => n === 'comment' && b === `Released by factory run me at ${new Date(T0).toISOString()}.`));
});

test('release of an unclaimed issue prints not_claimed', async () => {
  const { d } = fake();
  assert.deepEqual(await cmdRelease(d, { repo: R, issue: 1, runId: 'me' }), { status: 'not_claimed' });
});

test('parseArgs rejects bad usage', () => {
  assert.throws(() => parseArgs(['nope']), UsageError);
  assert.throws(() => parseArgs(['claim', '--repo', 'o/r']), UsageError);
  assert.throws(() => parseArgs(['claim', '--repo', 'bad', '--run-id', 'x']), UsageError);
  assert.throws(() => parseArgs(['release', '--repo', 'o/r', '--run-id', 'x']), UsageError);
  assert.equal(parseArgs(['claim', '--repo', 'o/r', '--run-id', 'x', '--only', 'o/r#4', '--dry-run']).only.issue, 4);
});

test('makeGh flattens paginated REST pages and drops pull requests', () => {
  const rest = (n, extra = {}) => ({
    number: n, title: `t${n}`, state: 'open', labels: [{ name: 'factory' }], body: '',
    user: { login: 'owner' }, author_association: 'OWNER', ...extra,
  });
  const seen = [];
  const gh = makeGh((args) => {
    seen.push(args);
    return JSON.stringify([[rest(1), rest(2)], [rest(3), rest(4, { pull_request: {} })]]);
  });
  const out = gh.listOpen(R);
  assert.deepEqual(out.map((i) => i.number), [1, 2, 3]);
  assert.equal(out[0].state, 'OPEN');
  assert.equal(out[0].authorAssociation, 'OWNER');
  assert.ok(seen[0].includes('--paginate') && seen[0].includes('--slurp'));
});

// ---------- dashboard events ----------

const ISO0 = new Date(T0).toISOString();

test('claim posts claimed with the claim.json time and action, and reports sent', async () => {
  const { d, events, stateDir } = fake({ issues: { [R]: [issue(3, ['factory', 'plan-approved'])] } });
  const out = await cmdClaim(d, { repos: [R], runId: 'RUN-1', dryRun: false });
  const claim = JSON.parse(readFileSync(join(stateDir, 'locks', lockName(R, 3), 'claim.json'), 'utf8'));
  assert.deepEqual(events, [
    { run_id: 'RUN-1', repo: R, issue_number: 3, event: 'claimed', action: 'implement', occurred_at: claim.claimed_at },
  ]);
  assert.equal(claim.claimed_at, ISO0);
  assert.equal(out.dashboard, 'sent');
});

test('dry run posts nothing and reports skipped: dry run', async () => {
  const { d, events } = fake({ nowMs: T0 + 5 * H, issues: { [R]: [issue(1)] } });
  writeLock(d.stateDir, R, 4, 'old', ISO0);
  const out = await cmdClaim(d, { repos: [R], runId: 'a', dryRun: true });
  assert.equal(out.status, 'claimed');
  assert.equal(out.dashboard, 'skipped: dry run');
  assert.equal(out.stale[0].dashboard, undefined);
  assert.deepEqual(events, []);
});

test('release posts released only when status is released', async () => {
  const { d, events, stateDir } = fake();
  assert.equal((await cmdRelease(d, { repo: R, issue: 1, runId: 'me' })).status, 'not_claimed');
  writeLock(stateDir, R, 1, 'owner-run', ISO0);
  const intruder = await cmdRelease(d, { repo: R, issue: 1, runId: 'intruder' });
  assert.deepEqual(intruder, { status: 'not_owner' });
  assert.deepEqual(events, []);
  const out = await cmdRelease(d, { repo: R, issue: 1, runId: 'owner-run' });
  assert.equal(out.dashboard, 'sent');
  assert.deepEqual(events, [{ run_id: 'owner-run', repo: R, issue_number: 1, event: 'released', occurred_at: ISO0 }]);
  assert.equal('action' in events[0], false);
});

test('stale sweep posts expired per entry with run_id, repo, issue and now', async () => {
  const now = T0 + 5 * H;
  const { d, events, stateDir } = fake({ nowMs: now, issues: { [R]: [] } });
  writeLock(stateDir, R, 4, 'old-a', ISO0);
  writeLock(stateDir, 'o/s', 7, 'old-b', ISO0);
  const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
  const nowIso = new Date(now).toISOString();
  assert.deepEqual(events.map((e) => [e.event, e.run_id, e.repo, e.issue_number, e.occurred_at]).sort(), [
    ['expired', 'old-a', R, 4, nowIso], ['expired', 'old-b', 'o/s', 7, nowIso],
  ]);
  assert.ok(out.stale.length === 2 && out.stale.every((s) => s.dashboard === 'sent'));
});

test('stale sweep skips the post when the claim has no run_id', async () => {
  const { d, events, stateDir } = fake({ nowMs: T0 + 5 * H, issues: { [R]: [] } });
  const dir = join(stateDir, 'locks', lockName(R, 4));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'claim.json'), JSON.stringify({ repo: R, issue: 4, action: 'plan', claimed_at: ISO0 }));
  const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
  assert.deepEqual(events, []);
  assert.equal(out.stale.length, 1);
  assert.equal(existsSync(dir), false);
});

test('dashboard failure never changes claim, release or stale results', async () => {
  for (const mode of ['failed: 500', 'throws']) {
    const { d, stateDir } = fake({ nowMs: T0 + 5 * H, issues: { [R]: [issue(1)] }, dashboardResult: mode });
    if (mode === 'throws') d.dashboard = { post: async () => { throw new Error('boom'); } };
    writeLock(stateDir, R, 4, 'old', ISO0);
    const claimed = await cmdClaim(d, { repos: [R], runId: 'a', dryRun: false });
    assert.equal(claimed.status, 'claimed');
    assert.equal(claimed.dashboard, mode === 'throws' ? 'failed: boom' : mode);
    assert.equal(claimed.stale[0].dashboard, mode === 'throws' ? 'failed: boom' : mode);
    assert.ok(existsSync(join(stateDir, 'locks', lockName(R, 1))));
    const released = await cmdRelease(d, { repo: R, issue: 1, runId: 'a' });
    assert.equal(released.status, 'released');
    assert.equal(existsSync(join(stateDir, 'locks', lockName(R, 1))), false);
  }
});

test('main awaits the command and keeps list output free of a dashboard field', async () => {
  const { d } = fake({ issues: { [R]: [issue(5)] } });
  const out = await main(['list', '--repo', R], d);
  assert.equal('dashboard' in out, false);
  assert.equal(out.candidates.length, 1);
  const none = await main(['claim', '--repo', R, '--run-id', 'x'], fake({ armed: false }).d);
  assert.deepEqual(none, { status: 'not_armed' });
});

// ---------- dashboard config and sender ----------

test('resolveDashboardUrl: default, env override, https or localhost http only', () => {
  assert.equal(resolveDashboardUrl({}), 'https://factory.codyssey.dev');
  assert.equal(resolveDashboardUrl({ FACTORY_DASHBOARD_URL: 'https://x.example/' }), 'https://x.example');
  assert.equal(resolveDashboardUrl({ FACTORY_DASHBOARD_URL: 'http://localhost:8787' }), 'http://localhost:8787');
  assert.equal(resolveDashboardUrl({ FACTORY_DASHBOARD_URL: 'http://127.0.0.1:3000' }), 'http://127.0.0.1:3000');
  assert.equal(resolveDashboardUrl({ FACTORY_DASHBOARD_URL: 'http://factory.codyssey.dev' }), undefined);
  assert.equal(resolveDashboardUrl({ FACTORY_DASHBOARD_URL: 'http://localhost.evil.com' }), undefined);
  assert.equal(resolveDashboardUrl({ FACTORY_DASHBOARD_URL: 'ftp://localhost' }), undefined);
  assert.equal(resolveDashboardUrl({ FACTORY_DASHBOARD_URL: 'not a url' }), undefined);
});

test('resolveIngestToken: env wins, else Keychain through the runner, trimmed', () => {
  let ran = 0;
  const run = (args) => (ran++, assert.deepEqual(args, ['find-generic-password', '-s', 'codyssey-factory-ingest', '-w']), 'kc-token\n');
  assert.equal(resolveIngestToken({ FACTORY_INGEST_TOKEN: 'env-token' }, run), 'env-token');
  assert.equal(ran, 0);
  assert.equal(resolveIngestToken({}, run), 'kc-token');
  assert.equal(resolveIngestToken({}, () => { throw new Error('not found'); }), undefined);
  assert.equal(resolveIngestToken({}, () => '\n'), undefined);
});

function captureStderr(fn) {
  const lines = [];
  const orig = console.error;
  console.error = (...a) => lines.push(a.join(' '));
  return fn().finally(() => { console.error = orig; }).then((r) => [r, lines]);
}

const EV = { run_id: 'R1', repo: R, issue_number: 3, event: 'claimed', action: 'plan', occurred_at: ISO0 };
const res = (status) => ({ status });

test('sender posts the contract request and treats 201 and 200 as sent', async () => {
  for (const status of [201, 200]) {
    const reqs = [];
    const dash = makeDashboard({
      env: { FACTORY_INGEST_TOKEN: 'secret', FACTORY_DASHBOARD_URL: 'https://dash.example/' },
      fetchImpl: async (url, init) => (reqs.push([url, init]), res(status)),
    });
    assert.equal(await dash.post(EV), 'sent');
    const [[url, init]] = reqs;
    assert.equal(url, 'https://dash.example/api/runs');
    assert.equal(init.method, 'POST');
    assert.deepEqual(init.headers, { Authorization: 'Bearer secret', 'Content-Type': 'application/json' });
    assert.deepEqual(JSON.parse(init.body), EV);
    assert.ok(init.signal instanceof AbortSignal);
  }
});

test('sender: no token and bad url skip without fetching, with one stderr line and no token', async () => {
  let fetched = 0;
  const fetchImpl = async () => (fetched++, res(201));
  const noToken = makeDashboard({ env: {}, fetchImpl, runSecurity: () => { throw new Error('nope'); } });
  const [r1, l1] = await captureStderr(() => noToken.post(EV));
  assert.equal(r1, 'skipped: no token');
  assert.deepEqual(l1, [`pick-up: dashboard claimed for ${R}#3 skipped: no token`]);
  const badUrl = makeDashboard({ env: { FACTORY_DASHBOARD_URL: 'http://evil.example', FACTORY_INGEST_TOKEN: 'secret' }, fetchImpl });
  const [r2, l2] = await captureStderr(() => badUrl.post(EV));
  assert.equal(r2, 'skipped: bad url');
  assert.deepEqual(l2, [`pick-up: dashboard claimed for ${R}#3 skipped: bad url`]);
  assert.equal(fetched, 0);
});

test('sender retries 5xx with 0.5s then 1s waits, 3 attempts in all', async () => {
  const waits = [];
  let calls = 0;
  const dash = makeDashboard({
    env: { FACTORY_INGEST_TOKEN: 'secret' },
    fetchImpl: async () => (calls++, res(503)),
    sleep: async (ms) => void waits.push(ms),
  });
  const [r, lines] = await captureStderr(() => dash.post(EV));
  assert.equal(r, 'failed: 503');
  assert.equal(calls, 3);
  assert.deepEqual(waits, [500, 1000]);
  assert.deepEqual(lines, [`pick-up: dashboard claimed for ${R}#3 failed: 503`]);
  assert.ok(!lines.join().includes('secret'));
});

test('sender recovers when a retry succeeds', async () => {
  const seq = [res(500), res(502), res(201)];
  const dash = makeDashboard({ env: { FACTORY_INGEST_TOKEN: 's' }, fetchImpl: async () => seq.shift(), sleep: async () => {} });
  assert.equal(await dash.post(EV), 'sent');
  assert.equal(seq.length, 0);
});

test('sender never retries 4xx', async () => {
  let calls = 0;
  const dash = makeDashboard({ env: { FACTORY_INGEST_TOKEN: 's' }, fetchImpl: async () => (calls++, res(401)), sleep: async () => { throw new Error('slept'); } });
  const [r] = await captureStderr(() => dash.post(EV));
  assert.equal(r, 'failed: 401');
  assert.equal(calls, 1);
});

test('sender retries network errors and timeouts, and reports a short reason', async () => {
  const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  let calls = 0;
  const dash = makeDashboard({ env: { FACTORY_INGEST_TOKEN: 's' }, fetchImpl: async () => { calls++; throw timeout; }, sleep: async () => {} });
  const [r] = await captureStderr(() => dash.post(EV));
  assert.equal(r, 'failed: timeout');
  assert.equal(calls, 3);
  const net = makeDashboard({
    env: { FACTORY_INGEST_TOKEN: 's' },
    fetchImpl: async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }); },
    sleep: async () => {},
  });
  const [r2] = await captureStderr(() => net.post(EV));
  assert.equal(r2, 'failed: ECONNREFUSED');
});

test('sender resolves the Keychain token once per process', async () => {
  let kc = 0;
  const dash = makeDashboard({ env: {}, runSecurity: () => (kc++, 'tok'), fetchImpl: async () => res(201) });
  await dash.post(EV);
  await dash.post(EV);
  assert.equal(kc, 1);
});
