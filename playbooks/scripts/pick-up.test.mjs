import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FACTORY_LABELS, ensureLabels, SKIP_LABELS, parseDependsOn, isStale, evaluateIssue, cmdList, cmdClaim, makeGh, cmdRelease, parseArgs, UsageError, lockName,
  makeDashboard, resolveDashboardUrl, resolveIngestToken, main,
} from './pick-up.mjs';

const R = 'o/r';
const T0 = Date.parse('2026-01-01T12:00:00Z');
const H = 3600 * 1000;
const ISO0 = new Date(T0).toISOString();

function issue(number, labels = ['factory'], extra = {}) {
  return {
    number, title: `t${number}`, state: 'OPEN', labels: labels.map((name) => ({ name })), body: '',
    author: { login: 'owner' }, authorAssociation: 'OWNER', ...extra,
  };
}

function fake({ issues = {}, labels = {}, nowMs = T0, armed = true, dashboardResult = 'sent' } = {}) {
  const stateDir = mkdtempSync(join(tmpdir(), 'pickup-'));
  if (armed) writeFileSync(join(stateDir, 'armed'), '');
  const calls = [];
  const rec = (name, fn) => (...a) => {
    calls.push([name, ...a]);
    return fn(...a);
  };
  const all = (repo) => issues[repo] ?? [];
  const labelState = Object.fromEntries(Object.entries(labels).map(([repo, ls]) => [repo, [...ls]]));
  const gh = {
    listOpen: rec('listOpen', (repo) => all(repo).filter((i) => i.state === 'OPEN')),
    listClosedApproved: rec('listClosedApproved', (repo) =>
      all(repo).filter((i) => i.state === 'CLOSED' && i.labels.some((l) => l.name === 'plan-approved'))),
    getIssue: rec('getIssue', (repo, n) => all(repo).find((i) => i.number === n)),
    issueState: rec('issueState', (repo, n) => all(repo).find((i) => i.number === n)?.state),
    listLabels: rec('listLabels', (repo) => (labelState[repo] ?? []).map((l) => l.name)),
    createLabel: rec('createLabel', (repo, label) => void (labelState[repo] ??= []).push({ ...label })),
    addLabel: rec('addLabel', () => {}),
    removeLabel: rec('removeLabel', () => {}),
    comment: rec('comment', () => {}),
  };
  const events = [];
  const dashboard = { post: async (ev) => (events.push(ev), dashboardResult) };
  return { d: { stateDir, gh, dashboard, now: () => nowMs }, calls, stateDir, events, labelState };
}

const FACTORY_ONLY = { [R]: [{ name: 'factory', color: '47cbb0', description: '' }] };
const allLabels = () => ({ [R]: FACTORY_LABELS.map((l) => ({ ...l })) });
const created = (calls) => calls.filter(([n]) => n === 'createLabel').map(([, , l]) => l.name);

function writeLock(stateDir, repo, n, runId, claimedAt) {
  const dir = join(stateDir, 'locks', lockName(repo, n));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'claim.json'), JSON.stringify({ repo, issue: n, action: 'plan', run_id: runId, claimed_at: claimedAt }));
  return dir;
}

// A lock folder with an optional raw claim.json, its folder mtime set after the write.
function rawLock(stateDir, name, content, mtimeMs) {
  const dir = join(stateDir, 'locks', name);
  mkdirSync(dir, { recursive: true });
  if (content !== undefined) writeFileSync(join(dir, 'claim.json'), content);
  utimesSync(dir, new Date(mtimeMs), new Date(mtimeMs));
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

test('evaluateIssue: an open plan-approved issue with post-merge-check is archive', () => {
  const open = (labels, extra) => issue(1, ['factory', 'plan-approved', ...labels], extra);
  assert.equal(evaluateIssue(open(['post-merge-check']), R, ok).action, 'archive');
  // checked before the Depends on rule: an open dependency does not hold it back
  const dep = open(['post-merge-check'], { body: 'Depends on: #9' });
  assert.equal(evaluateIssue(dep, R, { hasLock: false, depState: () => 'OPEN' }).action, 'archive');
  // the skip labels still win, so a pending owner answer is not picked up
  for (const label of SKIP_LABELS) {
    const r = evaluateIssue(open(['post-merge-check', label]), R, ok);
    assert.equal(r.eligible, false, label);
    assert.equal(r.reason, `has label ${label}`);
  }
  assert.equal(evaluateIssue(open(['post-merge-check']), R, { ...ok, hasLock: true }).eligible, false);
  // without plan-approved the label alone is not enough
  assert.equal(evaluateIssue(issue(1, ['factory', 'post-merge-check']), R, ok).action, 'plan');
  // after a revert the issue keeps plan-approved and factory-failed: skipped until the owner retries
  assert.equal(evaluateIssue(open(['factory-failed']), R, ok).eligible, false);
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

test('claim: lock created after evaluation is skipped via EEXIST', async () => {
  const { d, stateDir } = fake({ issues: { [R]: [issue(1, ['factory'], { body: 'Depends on: #99' }), issue(2)] } });
  // The dependency lookup runs after hasLock was read for issue 1, so issue 1 is still eligible
  // and the claim meets the other run's lock at mkdir.
  d.gh.issueState = () => {
    writeLock(stateDir, R, 1, 'other', new Date(T0).toISOString());
    return 'CLOSED';
  };
  const out = await cmdClaim(d, { repos: [R], runId: 'a', dryRun: false });
  assert.equal(out.issue, 2);
  const claim = JSON.parse(readFileSync(join(stateDir, 'locks', lockName(R, 1), 'claim.json'), 'utf8'));
  assert.equal(claim.run_id, 'other');
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
  assert.deepEqual(out.stale, [{ lock: 'o-r-4', repo: R, issue: 4, run_id: 'old', claimed_at: claimedAt, dashboard: 'sent' }]);
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
  assert.equal(calls.filter(([n]) => ['createLabel', 'addLabel', 'removeLabel', 'comment'].includes(n)).length, 0);
});

// ---------- unreadable and contested stale locks ----------

const OLD = T0 + 4 * H + 1000;
const GH_WRITES = ['createLabel', 'addLabel', 'removeLabel', 'comment'];
const unreadableComment = (reason) =>
  `A factory run left an unreadable lock on this issue (${reason}), last changed at ${ISO0}, more than 4 hours ago. Marked factory-failed. Remove the label to retry.`;

test('stale: an old lock folder with no claim.json is removed and listed', async () => {
  const { d, stateDir } = fake({ nowMs: OLD, issues: { [R]: [] } });
  const dir = rawLock(stateDir, lockName(R, 4), undefined, T0);
  const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
  assert.deepEqual(out.stale, [{ lock: 'o-r-4', repo: R, issue: 4, reason: 'no claim.json', changed_at: ISO0 }]);
  assert.equal(existsSync(dir), false);
  assert.deepEqual(readdirSync(join(stateDir, 'expired')), []);
});

for (const [name, content, reason] of [
  ['stale: an old lock with unparseable claim.json is removed and listed', '{not json', 'claim.json does not parse'],
  [
    'stale: an old lock whose claimed_at is not a date is removed and listed',
    JSON.stringify({ repo: R, issue: 4, action: 'plan', run_id: 'old', claimed_at: 'yesterday' }),
    'claimed_at is not a date',
  ],
]) {
  test(name, async () => {
    const { d, stateDir, events } = fake({ nowMs: OLD, issues: { [R]: [] } });
    const dir = rawLock(stateDir, lockName(R, 4), content, T0);
    const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
    assert.deepEqual(out.stale, [{ lock: 'o-r-4', repo: R, issue: 4, reason, changed_at: ISO0 }]);
    assert.equal(existsSync(dir), false);
    assert.deepEqual(events, []);
  });
}

test('stale: a young lock folder with no claim.json is kept and its issue stays locked', async () => {
  const { d, stateDir } = fake({ nowMs: T0 + 3 * H, issues: { [R]: [issue(4)] } });
  const dir = rawLock(stateDir, lockName(R, 4), undefined, T0);
  const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
  assert.deepEqual(out, { status: 'none', stale: [] });
  assert.equal(existsSync(dir), true);
  assert.deepEqual(cmdList(d, { repos: [R] }).skipped, [{ repo: R, issue: 4, reason: 'locked' }]);
});

test('stale: an unreadable lock matching a --repo marks the issue factory-failed', async () => {
  const { d, calls, stateDir, events } = fake({ nowMs: OLD, issues: { [R]: [] }, labels: allLabels() });
  rawLock(stateDir, lockName(R, 4), undefined, T0);
  const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
  assert.equal(out.stale[0].repo, R);
  assert.equal(out.stale[0].issue, 4);
  assert.deepEqual(calls.filter(([n]) => GH_WRITES.includes(n)), [
    ['removeLabel', R, 4, 'factory-running'],
    ['addLabel', R, 4, 'factory-failed'],
    ['comment', R, 4, unreadableComment('no claim.json')],
  ]);
  assert.deepEqual(events, []);
});

test('stale: an unreadable lock matching no --repo is listed by folder only with no gh call', async () => {
  const { d, calls, stateDir } = fake({ nowMs: OLD, issues: { [R]: [] } });
  const dir = rawLock(stateDir, 'other-repo-7', undefined, T0);
  const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
  assert.deepEqual(out.stale, [{ lock: 'other-repo-7', reason: 'no claim.json', changed_at: ISO0 }]);
  assert.equal(existsSync(dir), false);
  assert.deepEqual(calls.filter(([n]) => GH_WRITES.includes(n)), []);
});

test('stale: a folder name matching two --repo values is treated as no match', async () => {
  const { d, calls, stateDir } = fake({ nowMs: OLD });
  const dir = rawLock(stateDir, 'a-b-c-5', undefined, T0);
  const out = await cmdClaim(d, { repos: ['a/b-c', 'a-b/c'], runId: 'new', dryRun: false });
  assert.deepEqual(out.stale, [{ lock: 'a-b-c-5', reason: 'no claim.json', changed_at: ISO0 }]);
  assert.equal(existsSync(dir), false);
  assert.deepEqual(calls.filter(([n]) => GH_WRITES.includes(n)), []);
});

test('dry-run lists a stale unreadable lock and changes nothing', async () => {
  const { d, calls, stateDir, events } = fake({ nowMs: OLD, issues: { [R]: [] } });
  const dir = rawLock(stateDir, lockName(R, 4), undefined, T0);
  const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: true });
  assert.deepEqual(out.stale, [{ lock: 'o-r-4', repo: R, issue: 4, reason: 'no claim.json', changed_at: ISO0 }]);
  assert.equal(existsSync(dir), true);
  assert.equal(existsSync(join(stateDir, 'expired')), false);
  assert.deepEqual(calls.filter(([n]) => GH_WRITES.includes(n)), []);
  assert.deepEqual(events, []);
});

test('stale: two claims sweeping one lock comment, label and post once', async () => {
  const { d, calls, stateDir, events } = fake({ nowMs: OLD, issues: { [R]: [] } });
  writeLock(stateDir, R, 4, 'old', ISO0);
  // Claim B starts inside claim A's first clock read: after A read the lock, before A takes it.
  const dB = { ...d };
  let claimB;
  d.now = () => {
    claimB ??= cmdClaim(dB, { repos: [R], runId: 'b', dryRun: false });
    return OLD;
  };
  const a = await cmdClaim(d, { repos: [R], runId: 'a', dryRun: false });
  const b = await claimB;
  assert.equal(a.stale.length + b.stale.length, 1);
  assert.equal(calls.filter(([n]) => n === 'comment').length, 1);
  assert.equal(calls.filter(([n, , , l]) => n === 'addLabel' && l === 'factory-failed').length, 1);
  assert.deepEqual(events.map((e) => e.event), ['expired']);
});

test('stale: a gh error after the take puts the lock back and throws', async () => {
  for (const content of [JSON.stringify({ repo: R, issue: 4, action: 'plan', run_id: 'old', claimed_at: ISO0 }), undefined]) {
    const { d, stateDir } = fake({ nowMs: OLD, issues: { [R]: [] } });
    const dir = rawLock(stateDir, lockName(R, 4), content, T0);
    const addLabel = d.gh.addLabel;
    d.gh.addLabel = () => { throw new Error('gh down'); };
    await assert.rejects(cmdClaim(d, { repos: [R], runId: 'new', dryRun: false }), /gh down/);
    assert.equal(existsSync(dir), true);
    assert.equal(existsSync(join(dir, 'claim.json')), content !== undefined);
    assert.deepEqual(readdirSync(join(stateDir, 'expired')), []);
    d.gh.addLabel = addLabel;
    const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
    assert.equal(out.stale.length, 1);
    assert.equal(existsSync(dir), false);
  }
});

test('stale: a gh error after another claim relocked the issue throws the gh error and keeps that lock', async () => {
  const { d, stateDir } = fake({ nowMs: OLD, issues: { [R]: [] } });
  writeLock(stateDir, R, 4, 'old', ISO0);
  let fresh;
  d.gh.addLabel = () => {
    fresh = readFileSync(join(writeLock(stateDir, R, 4, 'other', new Date(OLD).toISOString()), 'claim.json'), 'utf8');
    throw new Error('gh down');
  };
  await assert.rejects(cmdClaim(d, { repos: [R], runId: 'new', dryRun: false }), /gh down/);
  assert.equal(readFileSync(join(stateDir, 'locks', lockName(R, 4), 'claim.json'), 'utf8'), fresh);
});

test('stale: a plain file in locks/ is ignored', async () => {
  const { d, stateDir } = fake({ nowMs: OLD, issues: { [R]: [] } });
  mkdirSync(join(stateDir, 'locks'));
  const file = join(stateDir, 'locks', '.DS_Store');
  writeFileSync(file, '');
  utimesSync(file, new Date(T0), new Date(T0));
  const out = await cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
  assert.deepEqual(out.stale, []);
  assert.equal(existsSync(file), true);
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

// ---------- factory labels ----------

const OTHER_LABELS = FACTORY_LABELS.filter((l) => l.name !== 'factory');

test('FACTORY_LABELS holds eight unique names and factory-failed is b60205', () => {
  const names = FACTORY_LABELS.map((l) => l.name);
  assert.equal(names.length, 8);
  assert.equal(new Set(names.map((n) => n.toLowerCase())).size, 8);
  assert.equal(FACTORY_LABELS.find((l) => l.name === 'factory-failed').color, 'b60205');
});

test('claim creates the seven missing factory labels with the table values, then none on the next claim', async () => {
  const { d, calls, labelState } = fake({ issues: { [R]: [issue(1), issue(2)] }, labels: FACTORY_ONLY });
  await cmdClaim(d, { repos: [R], runId: 'a', dryRun: false });
  assert.deepEqual(created(calls), OTHER_LABELS.map((l) => l.name));
  assert.deepEqual(labelState[R].filter((l) => l.name !== 'factory'), OTHER_LABELS);
  calls.length = 0;
  await cmdClaim(d, { repos: [R], runId: 'b', dryRun: false });
  assert.deepEqual(created(calls), []);
});

test('claim creates the labels before it adds factory-running', async () => {
  const { d, calls } = fake({ issues: { [R]: [issue(1)] }, labels: FACTORY_ONLY });
  await cmdClaim(d, { repos: [R], runId: 'a', dryRun: false });
  const names = calls.map(([n]) => n);
  assert.ok(names.lastIndexOf('createLabel') < names.indexOf('addLabel'));
});

test('claim leaves an existing label with another colour alone', async () => {
  const labels = { [R]: [{ name: 'factory', color: '47cbb0', description: '' }, { name: 'factory-failed', color: 'D93F0B', description: 'mine' }] };
  const { d, calls, labelState } = fake({ issues: { [R]: [issue(1)] }, labels });
  await cmdClaim(d, { repos: [R], runId: 'a', dryRun: false });
  assert.ok(!created(calls).includes('factory-failed'));
  assert.deepEqual(labelState[R].find((l) => l.name === 'factory-failed'), { name: 'factory-failed', color: 'D93F0B', description: 'mine' });
});

test('claim matches existing label names case-insensitively', async () => {
  const labels = { [R]: [{ name: 'factory' }, { name: 'Factory-Running' }] };
  const { d, calls } = fake({ issues: { [R]: [issue(1)] }, labels });
  await cmdClaim(d, { repos: [R], runId: 'a', dryRun: false });
  assert.ok(!created(calls).includes('factory-running'));
  assert.equal(created(calls).length, 6);
});

test('dry-run claim still creates labels because it adds factory-running for real', async () => {
  const { d, calls } = fake({ issues: { [R]: [issue(1)] }, labels: FACTORY_ONLY });
  const out = await cmdClaim(d, { repos: [R], runId: 'a', dryRun: true });
  assert.equal(out.status, 'claimed');
  assert.equal(created(calls).length, 7);
  assert.ok(calls.some(([n, , , l]) => n === 'addLabel' && l === 'factory-running'));
});

test('dry-run stale sweep creates no labels', async () => {
  const { d, calls, stateDir } = fake({ nowMs: T0 + 5 * H, issues: { [R]: [] }, labels: FACTORY_ONLY });
  writeLock(stateDir, R, 4, 'old', ISO0);
  await cmdClaim(d, { repos: [R], runId: 'new', dryRun: true });
  assert.deepEqual(created(calls), []);
});

test('stale sweep creates missing labels before it adds factory-failed', async () => {
  const { d, calls, stateDir } = fake({ nowMs: OLD, issues: { [R]: [] }, labels: FACTORY_ONLY });
  writeLock(stateDir, R, 4, 'old', ISO0);
  await cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
  const writes = calls.filter(([n]) => GH_WRITES.includes(n)).map(([n]) => n);
  assert.deepEqual(created(calls), OTHER_LABELS.map((l) => l.name));
  assert.ok(writes.lastIndexOf('createLabel') < writes.indexOf('addLabel'));
});

test('a label failure during claim releases the lock and adds no label', async () => {
  const { d, calls, stateDir } = fake({ issues: { [R]: [issue(1)] }, labels: FACTORY_ONLY });
  d.gh.createLabel = () => { throw new Error('gh down'); };
  await assert.rejects(cmdClaim(d, { repos: [R], runId: 'a', dryRun: false }), /gh down/);
  assert.equal(existsSync(join(stateDir, 'locks', lockName(R, 1))), false);
  assert.deepEqual(calls.filter(([n]) => n === 'addLabel' || n === 'comment'), []);
});

test('a label failure during the stale sweep puts the lock back', async () => {
  const { d, stateDir } = fake({ nowMs: OLD, issues: { [R]: [] }, labels: FACTORY_ONLY });
  const dir = writeLock(stateDir, R, 4, 'old', ISO0);
  d.gh.listLabels = () => { throw new Error('gh down'); };
  await assert.rejects(cmdClaim(d, { repos: [R], runId: 'new', dryRun: false }), /gh down/);
  assert.equal(existsSync(join(dir, 'claim.json')), true);
});

test('ensureLabels returns the created names and creates nothing when all exist', () => {
  const { d } = fake({ labels: allLabels() });
  assert.deepEqual(ensureLabels(d.gh, R), []);
});

test('ensureLabels on a factory-only repo returns the other seven names in table order', () => {
  const { d } = fake({ labels: FACTORY_ONLY });
  assert.deepEqual(ensureLabels(d.gh, R), FACTORY_LABELS.slice(1).map((l) => l.name));
});

test('makeGh lists and creates labels with the expected gh arguments', () => {
  const seen = [];
  const gh = makeGh((args) => {
    seen.push(args);
    return JSON.stringify([{ name: 'bug' }, { name: 'factory' }]);
  });
  assert.deepEqual(gh.listLabels(R), ['bug', 'factory']);
  assert.deepEqual(seen[0], ['label', 'list', '--repo', R, '--limit', '1000', '--json', 'name']);
  gh.createLabel(R, FACTORY_LABELS[2]);
  assert.deepEqual(seen[1], [
    'label', 'create', 'factory-failed', '--repo', R, '--color', 'b60205', '--description', 'Factory: run gave up; see the last comment',
  ]);
  assert.ok(!seen[1].includes('--force'));
});

test('makeGh createLabel ignores an already-exists error and throws any other', () => {
  const failing = (stderr) => makeGh(() => { throw Object.assign(new Error('exit 1'), { stderr }); });
  assert.doesNotThrow(() => failing('label with name "factory" already exists').createLabel(R, FACTORY_LABELS[0]));
  assert.throws(() => failing('HTTP 403: forbidden').createLabel(R, FACTORY_LABELS[0]), /exit 1/);
});

const SKILL_PATH = fileURLToPath(new URL('../../factory/brief-to-backlog/SKILL.md', import.meta.url));

test('brief-to-backlog creates factory and needs-decision with the table values', {
  skip: existsSync(SKILL_PATH) ? false : `${SKILL_PATH} not found (installed copy)`,
}, () => {
  const skill = readFileSync(SKILL_PATH, 'utf8');
  const lines = skill.match(/`gh label create [^`]+`/g) ?? [];
  for (const name of ['factory', 'needs-decision']) {
    const line = lines.find((l) => l.includes(`gh label create ${name} `));
    assert.ok(line, `no gh label create line for ${name}`);
    const row = FACTORY_LABELS.find((l) => l.name === name);
    assert.equal(/--color (\w+)/.exec(line)?.[1].toLowerCase(), row.color.toLowerCase());
    assert.equal(/--description "([^"]*)"/.exec(line)?.[1] ?? '', row.description);
  }
});

// ---------- dashboard events ----------

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
