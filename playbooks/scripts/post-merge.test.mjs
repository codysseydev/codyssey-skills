import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkRunState, deployFromCheckRuns, countParents, redact, parseArgs, UsageError, cmdFacts, cmdRevert, makeDeps, main,
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

function fakeGh({ merged = true, mergeSha, head, runs = [], title = 'Add b' } = {}) {
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
    if (/\/commits\/[0-9a-f]+\/check-runs/.test(path)) return JSON.stringify([{ total_count: runs.length, check_runs: runs }]);
    throw new Error(`unexpected gh call: ${args.join(' ')}`);
  };
  return { gh, calls };
}

const facts = (w, extra, gh, deployCheck) =>
  cmdFacts({ repo: R, pr: 1, checkout: w.checkout, deployCheck }, makeDeps({ gh, ...extra }));

// ---------- pure logic ----------

test('checkRunState maps status and conclusion', () => {
  assert.equal(checkRunState({ status: 'queued' }), 'pending');
  assert.equal(checkRunState({ status: 'in_progress', conclusion: null }), 'pending');
  for (const c of ['success', 'neutral', 'skipped']) assert.equal(checkRunState({ status: 'completed', conclusion: c }), 'success');
  for (const c of ['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale']) {
    assert.equal(checkRunState({ status: 'completed', conclusion: c }), 'failure', c);
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

test('parseArgs validates both commands', () => {
  const f = ['facts', '--repo', R, '--pr', '7', '--checkout', '/x'];
  assert.deepEqual(parseArgs([...f, '--deploy-check', 'Workers Builds: a']), {
    cmd: 'facts', repo: R, pr: 7, checkout: '/x', deployCheck: 'Workers Builds: a',
  });
  const r = ['revert', '--repo', R, '--pr', '7', '--checkout', '/x', '--merge-sha', 'abc1234', '--base', 'main', '--parents', '2'];
  assert.equal(parseArgs(r).parents, 2);
  assert.throws(() => parseArgs(['nope']), UsageError);
  assert.throws(() => parseArgs(['facts', '--repo', R]), /--pr is required/);
  assert.throws(() => parseArgs([...f, '--parents', '1']), UsageError);
  assert.throws(() => parseArgs([...r, '--deploy-check', 'x']), UsageError);
  assert.throws(() => parseArgs(r.map((a) => (a === '2' ? '3' : a))), /--parents/);
  assert.throws(() => parseArgs(r.map((a) => (a === 'main' ? '--force' : a))), UsageError);
  assert.throws(() => parseArgs(['facts', '--repo', 'bad', '--pr', '1', '--checkout', '/x']), /bad repo/);
});

// ---------- facts ----------

test('facts: a squash merge has one parent and the PR head tree', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  const out = facts(w, {}, fakeGh({ mergeSha, head }).gh);
  assert.deepEqual(out, {
    merged: true, merge_sha: mergeSha, head_sha: head, merged_at: '2026-01-01T10:00:00Z', base: 'main', title: 'Add b',
    parents: 1, tree_equals_head: true, deploy: null,
  });
});

test('facts: a merge commit made after main moved has two parents and a different tree', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = mergeAfterMainMoved(w);
  const out = facts(w, {}, fakeGh({ mergeSha, head }).gh);
  assert.equal(out.parents, 2);
  assert.equal(out.tree_equals_head, false);
  assert.equal(out.merge_sha, mergeSha);
});

test('facts: a PR that is not merged reports merged false and touches nothing', () => {
  const w = world();
  const head = prBranch(w);
  const { gh, calls } = fakeGh({ merged: false, head });
  const out = facts(w, {}, gh, 'Workers Builds: x');
  assert.equal(out.merged, false);
  assert.equal(out.merge_sha, null);
  assert.equal(out.tree_equals_head, null);
  assert.equal(calls.length, 1);
});

test('facts: deploy check states success, failure, pending and none', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  const name = 'Workers Builds: codyssey-frontend';
  const run = (extra) => ({ id: 1, name, status: 'completed', conclusion: 'success', started_at: '2026-01-01T10:01:00Z', completed_at: '2026-01-01T10:03:00Z', ...extra });
  const read = (runs) => facts(w, {}, fakeGh({ mergeSha, head, runs }).gh, name).deploy;
  assert.deepEqual(read([run()]), { name, state: 'success', completed_at: '2026-01-01T10:03:00Z' });
  assert.deepEqual(read([run({ conclusion: 'failure' })]), { name, state: 'failure', completed_at: '2026-01-01T10:03:00Z' });
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
  const out = facts(w, {}, fakeGh({ mergeSha, head }).gh);
  assert.equal(out.parents, 2);
  assert.deepEqual(snapshot(), before);
  // the objects arrived: the PR head came from pull/1/head, the merge commit from origin
  assert.equal(git(w.checkout, 'cat-file', '-t', head), 'commit');
  assert.equal(git(w.checkout, 'cat-file', '-t', mergeSha), 'commit');
});

test('facts: reads the real git and gh runners through main with an injected gh', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  const out = main(['facts', '--repo', R, '--pr', '1', '--checkout', w.checkout], makeDeps({ gh: fakeGh({ mergeSha, head }).gh }));
  assert.equal(out.tree_equals_head, true);
});

// ---------- revert ----------

const revertArgs = (w, mergeSha, parents) => ({ repo: R, pr: 1, checkout: w.checkout, mergeSha, base: 'main', parents });

test('revert: a merge commit with two parents is reverted with -m 1 and pushed', () => {
  const w = world();
  prBranch(w);
  const mergeSha = mergeAfterMainMoved(w);
  const out = cmdRevert(revertArgs(w, mergeSha, 2), makeDeps());
  assert.equal(out.branch, 'factory/revert-1');
  assert.match(out.head_sha, /^[0-9a-f]{40}$/);
  assert.equal(git(w.origin, 'rev-parse', 'factory/revert-1'), out.head_sha);
  // the PR's file is gone and the change that landed on main first stays
  assert.equal(git(w.origin, 'cat-file', '-e', `${out.head_sha}:a.txt`), '');
  assert.equal(git(w.origin, 'cat-file', '-e', `${out.head_sha}:c.txt`), '');
  assert.throws(() => git(w.origin, 'cat-file', '-e', `${out.head_sha}:b.txt`));
  assert.equal(git(w.origin, 'rev-list', '--parents', '-n', '1', out.head_sha).split(' ').length, 2);
  assert.match(git(w.origin, 'log', '-1', '--format=%s', out.head_sha), /^Revert "Merge pull request #1"/);
  // the temp worktree is gone and the checkout is untouched
  assert.equal(git(w.checkout, 'worktree', 'list').split('\n').length, 1);
  assert.equal(git(w.checkout, 'status', '--porcelain'), '');
  assert.equal(git(w.checkout, 'symbolic-ref', '--short', 'HEAD'), 'main');
});

test('revert: a squash commit with one parent is reverted without -m', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  const out = cmdRevert(revertArgs(w, mergeSha, 1), makeDeps());
  assert.equal(out.branch, 'factory/revert-1');
  assert.throws(() => git(w.origin, 'cat-file', '-e', `${out.head_sha}:b.txt`));
  assert.equal(git(w.origin, 'cat-file', '-e', `${out.head_sha}:a.txt`), '');
});

test('revert: -m 1 is passed for two parents and left out for one', () => {
  const seen = [];
  const git2 = (args) => {
    seen.push(args);
    if (args.includes('revert') && !args.includes('--abort')) throw Object.assign(new Error('stop'), { stderr: 'stop' });
    return '';
  };
  for (const [parents, expected] of [[2, ['revert', '--no-edit', '-m', '1', 'abc1234']], [1, ['revert', '--no-edit', 'abc1234']]]) {
    seen.length = 0;
    const out = cmdRevert({ repo: R, pr: 1, checkout: '/nowhere', mergeSha: 'abc1234', base: 'main', parents }, { git: git2 });
    assert.match(out.error, /git revert failed/);
    const call = seen.find((a) => a.includes('revert') && !a.includes('--abort'));
    assert.deepEqual(call.slice(2), expected);
  }
});

test('revert: a conflict aborts, removes the worktree and the branch, and pushes nothing', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  // a later commit edits the file the PR added, so reverting the PR no longer applies cleanly
  write(w.seed, 'b.txt', 'b changed later\n');
  commitAll(w.seed, 'later change');
  git(w.seed, 'push', '-q', 'origin', 'main');
  const out = cmdRevert(revertArgs(w, mergeSha, 1), makeDeps());
  assert.ok(out.error);
  assert.match(out.error, /revert/);
  assert.equal(git(w.checkout, 'worktree', 'list').split('\n').length, 1);
  assert.equal(git(w.checkout, 'for-each-ref', 'refs/heads/factory'), '');
  assert.equal(git(w.origin, 'for-each-ref', 'refs/heads/factory'), '');
  assert.equal(git(w.checkout, 'status', '--porcelain'), '');
  assert.equal(existsSync(join(w.checkout, '.git', 'REVERT_HEAD')), false);
});

test('revert: a refused push is an error with the worktree and local branch removed', () => {
  const w = world();
  const head = prBranch(w);
  const mergeSha = squash(w, head);
  write(w.origin, 'hooks/pre-receive', '#!/bin/sh\necho "push refused: https://user:s3cret@host/x" >&2\nexit 1\n');
  execFileSync('chmod', ['+x', join(w.origin, 'hooks/pre-receive')]);
  const out = cmdRevert(revertArgs(w, mergeSha, 1), makeDeps());
  assert.match(out.error, /git push failed/);
  assert.doesNotMatch(out.error, /s3cret/);
  assert.equal(git(w.checkout, 'worktree', 'list').split('\n').length, 1);
  assert.equal(git(w.checkout, 'for-each-ref', 'refs/heads/factory'), '');
});
