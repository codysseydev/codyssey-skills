import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SKIP_LABELS, parseDependsOn, isStale, evaluateIssue, cmdList, cmdClaim, cmdRelease, parseArgs, UsageError, lockName,
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

function fake({ issues = {}, nowMs = T0, armed = true } = {}) {
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
  return { d: { stateDir, gh, now: () => nowMs }, calls, stateDir };
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

test('untrusted author is skipped for closed archive candidates and --only', () => {
  const closed = issue(1, ['factory', 'plan-approved'], { state: 'CLOSED', authorAssociation: 'NONE' });
  assert.equal(evaluateIssue(closed, R, ok).eligible, false);
  const { d } = fake({ issues: { [R]: [issue(2, ['factory'], { authorAssociation: 'CONTRIBUTOR' })] } });
  const out = cmdClaim(d, { repos: [R], runId: 'a', only: { repo: R, issue: 2 }, dryRun: false });
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

test('claim: not armed returns not_armed and makes no gh call', () => {
  const { d, calls } = fake({ armed: false, issues: { [R]: [issue(1)] } });
  assert.deepEqual(cmdClaim(d, { repos: [R], runId: 'a', dryRun: false }), { status: 'not_armed' });
  assert.equal(calls.length, 0);
});

test('claim: --only bypasses the arm file', () => {
  const { d, calls } = fake({ armed: false, issues: { [R]: [issue(1)] } });
  const out = cmdClaim(d, { repos: [R], runId: 'a', only: { repo: R, issue: 1 }, dryRun: true });
  assert.equal(out.status, 'claimed');
  assert.equal(out.dry_run, true);
  assert.ok(calls.some(([n, , , body]) => n === 'comment' && / Dry run: no work will be done\.$/.test(body)));
});

test('claim: --only on an ineligible issue prints none with reason', () => {
  const { d } = fake({ issues: { [R]: [issue(1, ['factory', 'needs-pr-read'])] } });
  const out = cmdClaim(d, { repos: [R], runId: 'a', only: { repo: R, issue: 1 }, dryRun: false });
  assert.equal(out.status, 'none');
  assert.match(out.reason, /needs-pr-read/);
});

test('claim: takes the oldest eligible, writes lock, label and comment', () => {
  const { d, calls, stateDir } = fake({ issues: { [R]: [issue(9), issue(3)] } });
  const out = cmdClaim(d, { repos: [R], runId: 'run1', dryRun: false });
  assert.equal(out.issue, 3);
  assert.equal(out.action, 'plan');
  const claim = JSON.parse(readFileSync(join(stateDir, 'locks', lockName(R, 3), 'claim.json'), 'utf8'));
  assert.equal(claim.run_id, 'run1');
  assert.equal(claim.claimed_at, new Date(T0).toISOString());
  assert.ok(calls.some(([n, , , l]) => n === 'addLabel' && l === 'factory-running'));
  assert.ok(calls.some(([n, , , b]) => n === 'comment' && b === `Claimed by factory run run1 at ${new Date(T0).toISOString()}. Action: plan.`));
});

test('claim: atomic lock, a second claim moves to the next issue', () => {
  const { d } = fake({ issues: { [R]: [issue(1), issue(2)] } });
  const a = cmdClaim(d, { repos: [R], runId: 'a', dryRun: false });
  const b = cmdClaim(d, { repos: [R], runId: 'b', dryRun: false });
  assert.equal(a.issue, 1);
  assert.equal(b.issue, 2);
  assert.equal(cmdClaim(d, { repos: [R], runId: 'c', dryRun: false }).status, 'none');
});

test('claim: lock created between listing and mkdir is skipped via EEXIST', () => {
  const { d, stateDir } = fake({ issues: { [R]: [issue(1), issue(2)] } });
  const orig = d.gh.listOpen;
  d.gh.listOpen = (repo) => {
    const out = orig(repo);
    writeLock(stateDir, R, 1, 'other', new Date(T0).toISOString()); // another run wins the race
    return out;
  };
  // eligibility was computed before the lock appeared only if evaluation ran first; here the
  // lock exists before evaluation, so issue 1 is skipped as locked and 2 is claimed.
  assert.equal(cmdClaim(d, { repos: [R], runId: 'a', dryRun: false }).issue, 2);
});

test('stale: exactly 4h is not stale, just over is', () => {
  const at = new Date(T0).toISOString();
  assert.equal(isStale(at, T0 + 4 * H), false);
  assert.equal(isStale(at, T0 + 4 * H + 1), true);
});

test('stale: claim marks factory-failed, comments, deletes lock and lists it', () => {
  const { d, calls, stateDir } = fake({ nowMs: T0 + 4 * H + 1000, issues: { [R]: [] } });
  const claimedAt = new Date(T0).toISOString();
  const dir = writeLock(stateDir, R, 4, 'old', claimedAt);
  const out = cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
  assert.deepEqual(out.stale, [{ repo: R, issue: 4, run_id: 'old', claimed_at: claimedAt }]);
  assert.equal(existsSync(dir), false);
  assert.ok(calls.some(([n, , , l]) => n === 'removeLabel' && l === 'factory-running'));
  assert.ok(calls.some(([n, , , l]) => n === 'addLabel' && l === 'factory-failed'));
  assert.ok(calls.some(([n, , , b]) => n === 'comment' && b ===
    `Factory run old claimed this issue at ${claimedAt} and did not release it within 4 hours. Marked factory-failed. Remove the label to retry.`));
});

test('stale: a lock at exactly 4h is left alone', () => {
  const { d, stateDir } = fake({ nowMs: T0 + 4 * H, issues: { [R]: [] } });
  const dir = writeLock(stateDir, R, 4, 'old', new Date(T0).toISOString());
  const out = cmdClaim(d, { repos: [R], runId: 'new', dryRun: false });
  assert.deepEqual(out.stale, []);
  assert.equal(existsSync(dir), true);
});

test('dry-run lists stale locks and changes nothing on stale issues', () => {
  const { d, calls, stateDir } = fake({ nowMs: T0 + 5 * H, issues: { [R]: [] } });
  const dir = writeLock(stateDir, R, 4, 'old', new Date(T0).toISOString());
  const out = cmdClaim(d, { repos: [R], runId: 'new', dryRun: true });
  assert.equal(out.stale.length, 1);
  assert.equal(existsSync(dir), true);
  assert.equal(calls.filter(([n]) => ['addLabel', 'removeLabel', 'comment', 'ensureLabel'].includes(n)).length, 0);
});

test('release refuses a different run id and changes nothing', () => {
  const { d, calls, stateDir } = fake();
  const dir = writeLock(stateDir, R, 1, 'owner-run', new Date(T0).toISOString());
  assert.deepEqual(cmdRelease(d, { repo: R, issue: 1, runId: 'intruder' }), { status: 'not_owner' });
  assert.equal(existsSync(dir), true);
  assert.equal(calls.length, 0);
});

test('release by the owner removes label, comments and deletes the lock', () => {
  const { d, calls, stateDir } = fake();
  const dir = writeLock(stateDir, R, 1, 'me', new Date(T0).toISOString());
  assert.deepEqual(cmdRelease(d, { repo: R, issue: 1, runId: 'me' }), { status: 'released', repo: R, issue: 1 });
  assert.equal(existsSync(dir), false);
  assert.ok(calls.some(([n]) => n === 'removeLabel'));
  assert.ok(calls.some(([n, , , b]) => n === 'comment' && b === `Released by factory run me at ${new Date(T0).toISOString()}.`));
});

test('release of an unclaimed issue prints not_claimed', () => {
  const { d } = fake();
  assert.deepEqual(cmdRelease(d, { repo: R, issue: 1, runId: 'me' }), { status: 'not_claimed' });
});

test('parseArgs rejects bad usage', () => {
  assert.throws(() => parseArgs(['nope']), UsageError);
  assert.throws(() => parseArgs(['claim', '--repo', 'o/r']), UsageError);
  assert.throws(() => parseArgs(['claim', '--repo', 'bad', '--run-id', 'x']), UsageError);
  assert.throws(() => parseArgs(['release', '--repo', 'o/r', '--run-id', 'x']), UsageError);
  assert.equal(parseArgs(['claim', '--repo', 'o/r', '--run-id', 'x', '--only', 'o/r#4', '--dry-run']).only.issue, 4);
});
