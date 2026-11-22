import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkRunState, deployFromCheckRuns, countParents, redact, shaMatches, validRepo, parseArgs, UsageError, cmdFacts, cmdRevert, makeDeps, main,
} from './post-merge.mjs';

// Commits made by the helpers and by the script under test need an identity and no signing.
Object.assign(process.env, {
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@example.test',
  GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'commit.gpgsign', GIT_CONFIG_VALUE_0: 'false',
});

const R = 'o/r';
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const write = (dir, file, text) => writeFileSync(join(dir, file), text);
const commitAll = (dir, msg) => {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', msg);
  return git(dir, 'rev-parse', 'HEAD');
};

// A bare origin, a seed clone that makes the history, and a separate checkout that has fetched
// nothing yet. `seed` is on main with one commit; the PR branch is not created yet.
function world() {
  const root = mkdtempSync(join(tmpdir(), 'post-merge-'));
  const origin = join(root, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  const seed = join(root, 'seed');
  execFileSync('git', ['clone', '-q', origin, seed], { stdio: 'ignore' });
  git(seed, 'checkout', '-q', '-b', 'main');
  write(seed, 'a.txt', 'a\n');
  const c1 = commitAll(seed, 'c1');
  git(seed, 'push', '-q', 'origin', 'main');
  const checkout = join(root, 'checkout');
  execFileSync('git', ['clone', '-q', origin, checkout], { stdio: 'ignore' });
  return { root, origin, seed, checkout, c1 };
}

// The PR branch adds b.txt. Its head is published as refs/pull/1/head, like GitHub does.
function prBranch(w) {
  git(w.seed, 'checkout', '-q', '-b', 'pr', w.c1);
  write(w.seed, 'b.txt', 'b\n');
  const head = commitAll(w.seed, 'pr change');
  git(w.seed, 'push', '-q', 'origin', `${head}:refs/pull/1/head`);
  git(w.seed, 'checkout', '-q', 'main');
  return head;
}

// Squash merge: one parent, the PR head's tree.
function squash(w, head) {
  git(w.seed, 'merge', '-q', '--squash', 'pr');
  git(w.seed, 'commit', '-q', '-m', 'squash (#1)');
  git(w.seed, 'push', '-q', 'origin', 'main');
  assert.equal(git(w.seed, 'rev-parse', 'HEAD^{tree}'), git(w.seed, 'rev-parse', `${head}^{tree}`));
  return git(w.seed, 'rev-parse', 'HEAD');
}

// Main moves under the PR, then a merge commit joins them: two parents, a tree the PR never had.
function mergeAfterMainMoved(w) {
  write(w.seed, 'c.txt', 'c\n');
  commitAll(w.seed, 'main moves');
  git(w.seed, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #1', 'pr');
  git(w.seed, 'push', '-q', 'origin', 'main');
  return git(w.seed, 'rev-parse', 'HEAD');
}

function fakeGh({ merged = true, mergeSha, head, runs = [], title = 'Add b', commits = 1 } = {}) {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    const path = args.find((a) => a.startsWith('repos/'));
    if (/\/pulls\/1$/.test(path)) {
      return JSON.stringify({
        merged, merge_commit_sha: merged ? mergeSha : null, head: { sha: head }, merged_at: '2026-01-01T10:00:00Z',
        base: { ref: 'main' }, title,
      });
    }
    if (/\/pulls\/1\/commits/.test(path)) return JSON.stringify([Array.from({ length: commits }, (_, i) => ({ sha: `c${i}` }))]);
    if (/\/commits\/[0-9a-f]+\/check-runs/.test(path)) return JSON.stringify([{ total_count: runs.length, check_runs: runs }]);
    throw new Error(`unexpected gh call: ${args.join(' ')}`);
  };
  return { gh, calls };
}

const facts = (w, verifiedSha, gh, deployCheck) =>
  cmdFacts({ repo: R, pr: 1, checkout: w.checkout, verifiedSha, deployCheck }, makeDeps({ gh }));

// ---------- pure logic ----------

test('checkRunState maps status and conclusion', () => {
  assert.equal(checkRunState({ status: 'queued' }), 'pending');
  assert.equal(checkRunState({ status: 'in_progress', conclusion: null }), 'pending');
  assert.equal(checkRunState({ status: 'completed', conclusion: 'success' }), 'success');
  for (const c of ['failure', 'timed_out']) assert.equal(checkRunState({ status: 'completed', conclusion: c }), 'failure', c);
  for (const c of ['neutral', 'skipped', 'cancelled', 'action_required', 'startup_failure', 'stale', null]) {
    assert.equal(checkRunState({ status: 'completed', conclusion: c }), 'not_exercised', String(c));
  }
});

test('deployFromCheckRuns matches the exact name and takes the newest rerun', () => {
  const done = (id, conclusion, at) => ({ id, name: 'Workers Builds: x', status: 'completed', conclusion, started_at: at, completed_at: at });
  assert.deepEqual(deployFromCheckRuns([], 'Workers Builds: x'), { name: 'Workers Builds: x', state: 'none', completed_at: null });
  const other = { id: 9, name: 'Workers Builds: x (preview)', status: 'completed', conclusion: 'failure', completed_at: '2026-01-01T00:00:00Z' };
  assert.equal(deployFromCheckRuns([other], 'Workers Builds: x').state, 'none');
  const rerun = deployFromCheckRuns([done(1, 'failure', '2026-01-01T10:00:00Z'), done(2, 'success', '2026-01-01T10:05:00Z')], 'Workers Builds: x');
  assert.deepEqual(rerun, { name: 'Workers Builds: x', state: 'success', completed_at: '2026-01-01T10:05:00Z' });
  const pending = deployFromCheckRuns([{ id: 3, name: 'Workers Builds: x', status: 'in_progress', conclusion: null, started_at: '2026-01-01T10:00:00Z' }], 'Workers Builds: x');
  assert.deepEqual(pending, { name: 'Workers Builds: x', state: 'pending', completed_at: null });
});

test('countParents and redact', () => {
  assert.equal(countParents('aaa\n'), 0);
  assert.equal(countParents('aaa bbb\n'), 1);
  assert.equal(countParents('aaa bbb ccc\n'), 2);
  assert.equal(redact('fatal: https://user:tok3n@github.com/o/r.git'), 'fatal: https://***@github.com/o/r.git');
});

test('shaMatches compares prefixes both ways and needs 7 hex characters', () => {
  const full = 'aede02ff3aad07d3b5b8c97680b248ca8fabf467';
  assert.equal(shaMatches(full, full), true);
  assert.equal(shaMatches(full, 'aede02f'), true);
  assert.equal(shaMatches('AEDE02F', full), true);
  assert.equal(shaMatches(full, 'aede02'), false);
  assert.equal(shaMatches(full, 'aede02fffff'), false);
  assert.equal(shaMatches(full, 'zzzzzzz'), false);
  assert.equal(shaMatches(null, full), false);
});

test('validRepo rejects dot-dot segments and a leading dash', () => {
  assert.equal(validRepo('o/r'), true);
  assert.equal(validRepo('codysseydev/codyssey-frontend'), true);
  for (const bad of ['../r', 'o/..', 'o/r..x', '-o/r', 'o/-r', 'o', 'o/r/x', './r']) assert.equal(validRepo(bad), false, bad);
});

test('parseArgs validates both commands', () => {
  const f = ['facts', '--repo', R, '--pr', '7', '--checkout', '/x', '--verified-sha', 'abc1234'];
  assert.deepEqual(parseArgs([...f, '--deploy-check', 'Workers Builds: a']), {
    cmd: 'facts', repo: R, pr: 7, checkout: '/x', verifiedSha: 'abc1234', deployCheck: 'Workers Builds: a',
  });
  const r = ['revert', '--repo', R, '--pr', '7', '--checkout', '/x', '--merge-sha', 'abc1234', '--base', 'main'];
  assert.equal(parseArgs(r).base, 'main');
  assert.throws(() => parseArgs(['nope']), UsageError);
  assert.throws(() => parseArgs(['facts', '--repo', R]), /--pr is required/);
  assert.throws(() => parseArgs(f.slice(0, -2)), /--verified-sha is required/);
  assert.throws(() => parseArgs(f.map((a) => (a === 'abc1234' ? 'abc12' : a))), /bad verified sha/);
  assert.throws(() => parseArgs([...f, '--merge-sha', 'abc1234']), UsageError);
  assert.throws(() => parseArgs([...r, '--parents', '2']), /unknown flag/);
  assert.throws(() => parseArgs([...r, '--deploy-check', 'x']), UsageError);
  assert.throws(() => parseArgs([...r, '--verified-sha', 'abc1234']), UsageError);
  assert.throws(() => parseArgs(r.map((a) => (a === 'main' ? '--force' : a))), /must not start with -/);
  assert.throws(() => parseArgs(['facts', '--repo', 'bad', '--pr', '1', '--checkout', '/x', '--verified-sha', 'abc1234']), /bad repo/);
  assert.throws(() => parseArgs(f.map((a) => (a === R ? '../r' : a))), /bad repo/);
  assert.throws(() => parseArgs(f.map((a) => (a === '/x' ? '-C' : a))), /must not start with -/);
  assert.throws(() => parseArgs([...f, '--deploy-check', '--x']), /must not start with -/);
});

// ---------- facts ----------

test('facts: a squash merge has one parent and the verified head tree', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  const out = facts(w, head, fakeGh({ mergeSha, head }).gh);
  assert.deepEqual(out, {
    merged: true, merge_sha: mergeSha, head_sha: head, head_matches_verified: true, merged_at: '2026-01-01T10:00:00Z',
    base: 'main', title: 'Add b', parents: 1, merge_method: 'squash', tree_equals_head: true, deploy: null,
  });
  // a 7 character prefix of the verified sha works the same
  assert.equal(facts(w, head.slice(0, 7), fakeGh({ mergeSha, head }).gh).tree_equals_head, true);
});

test('facts: a merge commit made after main moved has two parents and a different tree', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = mergeAfterMainMoved(w);
  const out = facts(w, head, fakeGh({ mergeSha, head }).gh);
  assert.equal(out.parents, 2);
  assert.equal(out.merge_method, 'merge');
  assert.equal(out.tree_equals_head, false);
  assert.equal(out.head_matches_verified, true);
  assert.equal(out.merge_sha, mergeSha);
});

test('facts: a late push after verification is caught, so the gates are not skipped', () => {
  const w = world();
  const verified = prBranch(w);
  // the owner merged a later head: one more commit on the PR branch after the run verified
  git(w.seed, 'checkout', '-q', 'pr');
  write(w.seed, 'late.txt', 'late\n');
  const late = commitAll(w.seed, 'late push');
  git(w.seed, 'push', '-q', 'origin', `${late}:refs/pull/1/head`);
  git(w.seed, 'checkout', '-q', 'main');
  const mergeSha = squash(w, late);
  const out = facts(w, verified, fakeGh({ mergeSha, head: late }).gh);
  assert.equal(out.head_sha, late);
  assert.equal(out.head_matches_verified, false);
  // the merge tree equals the PR head at merge time but not the verified head
  assert.equal(out.tree_equals_head, false);
});

test('facts: a verified sha the checkout cannot resolve never counts as equal', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  const out = facts(w, 'deadbeefdeadbeef', fakeGh({ mergeSha, head }).gh);
  assert.equal(out.tree_equals_head, false);
  assert.equal(out.head_matches_verified, false);
});

test('facts: merge_method is rebase for one parent, several PR commits and no (#n) subject', () => {
  const w = world();
  const head = prBranch(w);
  // fast-forward: main gets the PR commit itself, subject "pr change"
  git(w.seed, 'merge', '-q', '--ff-only', 'pr');
  git(w.seed, 'push', '-q', 'origin', 'main');
  const mergeSha = git(w.seed, 'rev-parse', 'HEAD');
  assert.equal(facts(w, head, fakeGh({ mergeSha, head, commits: 3 }).gh).merge_method, 'rebase');
  // one commit in the PR cannot be told from a squash
  assert.equal(facts(w, head, fakeGh({ mergeSha, head, commits: 1 }).gh).merge_method, 'squash');
  // a squash subject ends with (#1), so several PR commits are still a squash
  const w2 = world();
  const head2 = prBranch(w2);
  const squashSha = squash(w2, head2);
  assert.equal(facts(w2, head2, fakeGh({ mergeSha: squashSha, head: head2, commits: 3 }).gh).merge_method, 'squash');
});

test('facts: a PR that is not merged reports merged false and touches nothing', () => {
  const w = world();
  const head = prBranch(w);
  const { gh, calls } = fakeGh({ merged: false, head });
  const out = facts(w, head, gh, 'Workers Builds: x');
  assert.equal(out.merged, false);
  assert.equal(out.merge_sha, null);
  assert.equal(out.tree_equals_head, null);
  assert.equal(calls.length, 1);
});

test('facts: deploy check states success, failure, not_exercised, pending and none', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  const name = 'Workers Builds: codyssey-frontend';
  const run = (extra) => ({ id: 1, name, status: 'completed', conclusion: 'success', started_at: '2026-01-01T10:01:00Z', completed_at: '2026-01-01T10:03:00Z', ...extra });
  const read = (runs) => facts(w, head, fakeGh({ mergeSha, head, runs }).gh, name).deploy;
  const done = '2026-01-01T10:03:00Z';
  assert.deepEqual(read([run()]), { name, state: 'success', completed_at: done });
  assert.deepEqual(read([run({ conclusion: 'failure' })]), { name, state: 'failure', completed_at: done });
  assert.deepEqual(read([run({ conclusion: 'timed_out' })]), { name, state: 'failure', completed_at: done });
  for (const c of ['cancelled', 'stale', 'skipped', 'neutral', 'action_required', 'startup_failure']) {
    assert.deepEqual(read([run({ conclusion: c })]), { name, state: 'not_exercised', completed_at: done }, c);
  }
  assert.deepEqual(read([run({ status: 'in_progress', conclusion: null, completed_at: null })]), { name, state: 'pending', completed_at: null });
  assert.deepEqual(read([]), { name, state: 'none', completed_at: null });
  assert.deepEqual(read([run({ name: 'Workers Builds: other' })]), { name, state: 'none', completed_at: null });
});

test('facts: leaves the checkout branch, HEAD, index and working tree alone', () => {
  const w = world();
  git(w.checkout, 'checkout', '-q', '-b', 'my-work');
  write(w.checkout, 'a.txt', 'local edit\n');
  write(w.checkout, 'untracked.txt', 'u\n');
  git(w.checkout, 'add', 'a.txt');
  write(w.checkout, 'a.txt', 'local edit, unstaged\n');
  const snapshot = () => ({
    head: git(w.checkout, 'rev-parse', 'HEAD'),
    branch: git(w.checkout, 'symbolic-ref', '--short', 'HEAD'),
    status: git(w.checkout, 'status', '--porcelain=v1'),
    a: readFileSync(join(w.checkout, 'a.txt'), 'utf8'),
    local: git(w.checkout, 'for-each-ref', 'refs/heads'),
  });
  const before = snapshot();
  const head = prBranch(w);
  const mergeSha = mergeAfterMainMoved(w);
  const out = facts(w, head, fakeGh({ mergeSha, head }).gh);
  assert.equal(out.parents, 2);
  assert.deepEqual(snapshot(), before);
  // the objects arrived: the PR head came from pull/1/head, the merge commit from origin
  assert.equal(git(w.checkout, 'cat-file', '-t', head), 'commit');
  assert.equal(git(w.checkout, 'cat-file', '-t', mergeSha), 'commit');
});

test('facts: runs through main with an injected gh', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  const out = main(['facts', '--repo', R, '--pr', '1', '--checkout', w.checkout, '--verified-sha', head], makeDeps({ gh: fakeGh({ mergeSha, head }).gh }));
  assert.equal(out.tree_equals_head, true);
});

// ---------- revert ----------

const revertArgs = (w, mergeSha) => ({ repo: R, pr: 1, checkout: w.checkout, mergeSha, base: 'main' });
const revert = (w, mergeSha, gh = fakeGh({ mergeSha }).gh, git2) => cmdRevert(revertArgs(w, mergeSha), makeDeps({ gh, ...(git2 ? { git: git2 } : {}) }));
const noTempLeft = (w) => {
  assert.equal(git(w.checkout, 'worktree', 'list').split('\n').length, 1);
  assert.equal(git(w.checkout, 'for-each-ref', 'refs/heads/factory'), '');
  assert.equal(git(w.checkout, 'status', '--porcelain'), '');
};

test('revert: a merge commit with two parents is reverted with -m 1 and pushed', () => {
  const w = world();
  prBranch(w);
  const mergeSha = mergeAfterMainMoved(w);
  const out = revert(w, mergeSha);
  assert.equal(out.branch, 'factory/revert-1');
  assert.match(out.head_sha, /^[0-9a-f]{40}$/);
  assert.equal(git(w.origin, 'rev-parse', 'factory/revert-1'), out.head_sha);
  // the PR's file is gone and the change that landed on main first stays
  assert.equal(git(w.origin, 'cat-file', '-e', `${out.head_sha}:a.txt`), '');
  assert.equal(git(w.origin, 'cat-file', '-e', `${out.head_sha}:c.txt`), '');
  assert.throws(() => git(w.origin, 'cat-file', '-e', `${out.head_sha}:b.txt`));
  assert.equal(git(w.origin, 'rev-list', '--parents', '-n', '1', out.head_sha).split(' ').length, 2);
  assert.match(git(w.origin, 'log', '-1', '--format=%s', out.head_sha), /^Revert "Merge pull request #1"/);
  // the temp worktree, temp dir and local branch are gone, and the checkout is untouched
  noTempLeft(w);
  assert.equal(git(w.checkout, 'symbolic-ref', '--short', 'HEAD'), 'main');
});

test('revert: a squash commit with one parent is reverted without -m', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  const out = revert(w, mergeSha, fakeGh({ mergeSha, commits: 3 }).gh);
  assert.equal(out.branch, 'factory/revert-1');
  assert.throws(() => git(w.origin, 'cat-file', '-e', `${out.head_sha}:b.txt`));
  assert.equal(git(w.origin, 'cat-file', '-e', `${out.head_sha}:a.txt`), '');
  noTempLeft(w);
});

test('revert: computes the parent count itself and passes -m 1 only for two parents', () => {
  const seen = [];
  const mk = (revParents) => (args) => {
    seen.push(args);
    if (args.includes('rev-list')) return revParents;
    if (args.includes('revert') && !args.includes('--abort')) throw Object.assign(new Error('stop'), { stderr: 'stop' });
    return '';
  };
  const gh = fakeGh({ commits: 1 }).gh;
  for (const [line, expected] of [['m a b', ['revert', '--no-edit', '-m', '1', 'abc1234']], ['m a', ['revert', '--no-edit', 'abc1234']]]) {
    seen.length = 0;
    const out = cmdRevert({ repo: R, pr: 1, checkout: '/nowhere', mergeSha: 'abc1234', base: 'main' }, { gh, git: mk(line) });
    assert.match(out.error, /git revert failed/);
    const call = seen.find((a) => a.includes('revert') && !a.includes('--abort'));
    assert.deepEqual(call.slice(2), expected);
  }
});

test('revert: refuses a rebase merge before touching anything', () => {
  const w = world();
  const head = prBranch(w);
  git(w.seed, 'merge', '-q', '--ff-only', 'pr');
  git(w.seed, 'push', '-q', 'origin', 'main');
  const mergeSha = git(w.seed, 'rev-parse', 'HEAD');
  const out = revert(w, mergeSha, fakeGh({ mergeSha, head, commits: 3 }).gh);
  assert.deepEqual(out, { error: 'rebase merge, revert by hand' });
  noTempLeft(w);
  assert.equal(git(w.origin, 'for-each-ref', 'refs/heads/factory'), '');
});

test('revert: refuses when the revert branch already exists on origin', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  git(w.seed, 'push', '-q', 'origin', 'HEAD:refs/heads/factory/revert-1');
  const before = git(w.origin, 'rev-parse', 'factory/revert-1');
  const out = revert(w, mergeSha);
  assert.deepEqual(out, { error: 'factory/revert-1 already exists on origin; delete it or revert by hand' });
  assert.equal(git(w.origin, 'rev-parse', 'factory/revert-1'), before);
  noTempLeft(w);
});

test('revert: a conflict aborts, removes the worktree and the branch, and pushes nothing', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  // a later commit edits the file the PR added, so reverting the PR no longer applies cleanly
  write(w.seed, 'b.txt', 'b changed later\n');
  commitAll(w.seed, 'later change');
  git(w.seed, 'push', '-q', 'origin', 'main');
  const out = revert(w, mergeSha);
  assert.ok(out.error);
  assert.match(out.error, /revert/);
  noTempLeft(w);
  assert.equal(git(w.origin, 'for-each-ref', 'refs/heads/factory'), '');
  assert.equal(existsSync(join(w.checkout, '.git', 'REVERT_HEAD')), false);
});

test('revert: a refused push is an error with the worktree and local branch removed', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  write(w.origin, 'hooks/pre-receive', '#!/bin/sh\necho "push refused: https://user:s3cret@host/x" >&2\nexit 1\n');
  execFileSync('chmod', ['+x', join(w.origin, 'hooks/pre-receive')]);
  const out = revert(w, mergeSha);
  assert.match(out.error, /git push failed/);
  assert.doesNotMatch(out.error, /s3cret/);
  noTempLeft(w);
});

test('revert: the temp dir is removed after a successful push and the remote branch stays', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  const tmpDirs = [];
  const real = makeDeps().git;
  const spy = (args) => {
    if (args.includes('worktree') && args.includes('add')) tmpDirs.push(args[args.length - 2]);
    return real(args);
  };
  const out = revert(w, mergeSha, fakeGh({ mergeSha }).gh, spy);
  assert.equal(out.branch, 'factory/revert-1');
  assert.equal(tmpDirs.length, 1);
  assert.equal(existsSync(tmpDirs[0]), false);
  assert.equal(existsSync(join(tmpDirs[0], '..')), false);
  assert.equal(git(w.origin, 'rev-parse', 'factory/revert-1'), out.head_sha);
  noTempLeft(w);
});
