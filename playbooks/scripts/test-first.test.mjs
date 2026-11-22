import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTestFile, isValidFailure, runCommand, subjectMatches, tailLines } from './test-first.mjs';
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'test-first.mjs');
const CMD = 'sh tests/check.sh';

function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
}

function put(dir, path, text) {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
}

function commit(dir, subject, files) {
  for (const [p, t] of Object.entries(files)) put(dir, p, t);
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', subject);
  return git(dir, 'rev-parse', 'HEAD');
}

// A repo on branch `fix` with origin/main at the first commit. src/value.txt holds the value the
// test script checks.
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'testfirst-'));
  git(dir, 'init', '-q', '-b', 'main');
  commit(dir, 'base', { 'src/value.txt': 'bad\n', 'README.md': 'x\n' });
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(dir, 'checkout', '-q', '-b', 'fix');
  return dir;
}

const TEST_SH = 'grep -q good src/value.txt || { echo "assertion failed: value is bad"; exit 1; }\n';

function gate(dir, extra = [], { issue = '7', command = CMD, env } = {}) {
  const r = spawnSync('node', [SCRIPT, '--dir', dir, '--issue', issue, '--command', command, ...extra], { encoding: 'utf8', env: env ?? process.env });
  return { code: r.status, out: r.stdout, err: r.stderr, json: r.stdout ? JSON.parse(r.stdout) : undefined };
}

test('pass: failing test first, fix later', () => {
  const dir = repo();
  const t = commit(dir, 'test: failing test for #7', { 'tests/check.sh': TEST_SH });
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  const r = gate(dir);
  assert.equal(r.code, 0);
  assert.equal(r.json.gate, 'test-first');
  assert.equal(r.json.result, 'pass');
  assert.equal(r.json.exit_code, 0);
  assert.equal(r.json.command, CMD);
  assert.equal(r.json.test_commit, t);
  assert.deepEqual(r.json.non_test_files, []);
  assert.notEqual(r.json.at_test_commit.exit_code, 0);
  assert.match(r.json.at_test_commit.output_tail, /assertion failed: value is bad/);
  assert.equal(r.json.at_head.exit_code, 0);
});

test('the original branch is checked out afterwards, not a detached head', () => {
  const dir = repo();
  commit(dir, 'test: failing test for #7', { 'tests/check.sh': TEST_SH });
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  const head = git(dir, 'rev-parse', 'HEAD');
  gate(dir);
  assert.equal(git(dir, 'symbolic-ref', '--short', 'HEAD'), 'fix');
  assert.equal(git(dir, 'rev-parse', 'HEAD'), head);
  assert.equal(git(dir, 'status', '--porcelain'), '');
});

test('the original branch is checked out afterwards when the command fails', () => {
  const dir = repo();
  commit(dir, 'test: failing test for #7', { 'tests/check.sh': TEST_SH });
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  const r = gate(dir, [], { command: 'exit 3' });
  assert.equal(r.json.result, 'fail');
  assert.equal(r.json.at_test_commit.exit_code, 3);
  assert.equal(git(dir, 'symbolic-ref', '--short', 'HEAD'), 'fix');
});

test('untracked dependency folders stay in place', () => {
  const dir = repo();
  commit(dir, 'ignore vendor', { '.gitignore': 'vendor/\n' });
  commit(dir, 'test: failing test for #7', { 'tests/check.sh': 'test -f vendor/dep.txt && ' + TEST_SH });
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  put(dir, 'vendor/dep.txt', 'dep\n');
  const r = gate(dir);
  assert.equal(r.json.result, 'pass');
});

test('fail: the fix was committed before the test (test passes at the test commit)', () => {
  const dir = repo();
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  commit(dir, 'test: failing test for #7', { 'tests/check.sh': TEST_SH });
  const r = gate(dir);
  assert.equal(r.code, 0);
  assert.equal(r.json.result, 'fail');
  assert.equal(r.json.exit_code, 1);
  assert.equal(r.json.at_test_commit.exit_code, 0);
});

test('fail: the test commit touches a source file', () => {
  const dir = repo();
  commit(dir, 'test: failing test for #7', { 'tests/check.sh': TEST_SH, 'src/other.txt': 'x\n' });
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  const r = gate(dir);
  assert.equal(r.json.result, 'fail');
  assert.deepEqual(r.json.non_test_files, ['src/other.txt']);
});

test('fail: the test still fails at HEAD', () => {
  const dir = repo();
  commit(dir, 'test: failing test for #7', { 'tests/check.sh': TEST_SH });
  commit(dir, 'chore: unrelated', { 'README.md': 'y\n' });
  const r = gate(dir);
  assert.equal(r.json.result, 'fail');
  assert.equal(r.json.exit_code, 1);
  assert.notEqual(r.json.at_head.exit_code, 0);
});

test('exit 2 when no commit has the subject', () => {
  const dir = repo();
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  const r = gate(dir);
  assert.equal(r.code, 2);
  assert.match(r.err, /no commit/);
  assert.equal(r.out, '');
});

test('exit 2 when the only matching subject names a longer issue number', () => {
  const dir = repo();
  commit(dir, 'test: failing test for #70', { 'tests/check.sh': TEST_SH });
  assert.equal(gate(dir).code, 2);
});

test('exit 2 when two commits have the subject', () => {
  const dir = repo();
  commit(dir, 'test: failing test for #7', { 'tests/check.sh': TEST_SH });
  commit(dir, 'test: failing test for #7 again', { 'tests/other.sh': 'true\n' });
  const r = gate(dir);
  assert.equal(r.code, 2);
  assert.match(r.err, /2 commits/);
});

test('exit 2 when the tree is dirty', () => {
  const dir = repo();
  commit(dir, 'test: failing test for #7', { 'tests/check.sh': TEST_SH });
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  put(dir, 'src/value.txt', 'edited\n');
  const r = gate(dir);
  assert.equal(r.code, 2);
  assert.match(r.err, /dirty/);
});

test('--test-path widens the test-file rule', () => {
  const dir = repo();
  commit(dir, 'test: failing test for #7', { 'tests/check.sh': TEST_SH, 'fixtures/data.json': '{}\n' });
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  assert.equal(gate(dir).json.result, 'fail');
  assert.equal(gate(dir, ['--test-path', 'fixtures/']).json.result, 'pass');
  assert.equal(gate(dir, ['--test-path', 'fixtures/*.json']).json.result, 'pass');
  assert.equal(gate(dir, ['--test-path', 'other/']).json.result, 'fail');
});

test('--none prints a not_exercised row and does not touch git', () => {
  const r = spawnSync('node', [SCRIPT, '--issue', '7', '--none', 'deploy-only fault'], { encoding: 'utf8', cwd: tmpdir() });
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), {
    gate: 'test-first', command: 'none', exit_code: 0, result: 'not_exercised', reason: 'deploy-only fault',
  });
});

test('bad usage exits 2', () => {
  for (const args of [[], ['--issue', 'x'], ['--issue', '7'], ['--issue', '7', '--none', ' ']]) {
    assert.equal(spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' }).status, 2);
  }
});

test('isTestFile default rule', () => {
  for (const p of ['tests/a.js', 'src/test/a.js', 'a/__tests__/b.js', 'spec/x.rb', 'a.test.ts', 'b/c.spec.js', 'tests/Feature/FooTest.php', 'app/FooTest.php', 'test_foo.py', 'x/foo_test.py', 'pkg/foo_test.go']) {
    assert.equal(isTestFile(p), true, p);
  }
  for (const p of ['src/a.js', 'README.md', 'src/contest/a.js', 'latest.js', 'testing/a.js']) {
    assert.equal(isTestFile(p), false, p);
  }
});

test('subjectMatches and tailLines', () => {
  assert.equal(subjectMatches('test: failing test for #7', 7), true);
  assert.equal(subjectMatches('test: failing test for #7: detail', 7), true);
  assert.equal(subjectMatches('test: failing test for #77', 7), false);
  assert.equal(subjectMatches('fix: x', 7), false);
  const text = Array.from({ length: 100 }, (_, i) => `l${i}`).join('\n') + '\n';
  const lines = tailLines(text).split('\n');
  assert.equal(lines.length, 40);
  assert.equal(lines.at(-1), 'l99');
});

// ---------- review fixes ----------

function fixed(dir) {
  const t = commit(dir, 'test: failing test for #7', { 'tests/check.sh': TEST_SH });
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  return t;
}

test('a command that edits tracked files at the test commit: JSON, branch restored, tree clean', () => {
  const dir = repo();
  fixed(dir);
  const head = git(dir, 'rev-parse', 'HEAD');
  const r = gate(dir, [], { command: 'echo junk >> src/value.txt; echo junk >> tests/check.sh; exit 1' });
  assert.equal(r.code, 0);
  assert.equal(r.json.result, 'fail');
  assert.equal(git(dir, 'symbolic-ref', '--short', 'HEAD'), 'fix');
  assert.equal(git(dir, 'rev-parse', 'HEAD'), head);
  assert.equal(git(dir, 'status', '--porcelain'), '');
});

test('a command that leaves untracked files is cleaned, ignored folders stay', () => {
  const dir = repo();
  commit(dir, 'ignore vendor', { '.gitignore': 'vendor/\n' });
  fixed(dir);
  put(dir, 'vendor/dep.txt', 'dep\n');
  const r = gate(dir, [], { command: 'touch stray.txt; test -f vendor/dep.txt && grep -q good src/value.txt' });
  assert.equal(r.json.result, 'pass');
  assert.equal(git(dir, 'status', '--porcelain'), '');
  assert.equal(readFileSync(join(dir, 'vendor/dep.txt'), 'utf8'), 'dep\n');
});

test('a command that dirties the tree at HEAD leaves it clean', () => {
  const dir = repo();
  fixed(dir);
  const r = gate(dir, [], { command: 'grep -q good src/value.txt || exit 1; echo junk >> README.md; touch stray.txt' });
  assert.equal(r.json.result, 'pass');
  assert.equal(git(dir, 'status', '--porcelain'), '');
});

test('fail: an empty test commit', () => {
  const dir = repo();
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'test: failing test for #7');
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  const r = gate(dir, [], { command: 'grep -q good src/value.txt' });
  assert.equal(r.code, 0);
  assert.equal(r.json.result, 'fail');
  assert.match(r.json.problems.join(' '), /no files/);
});

test('fail: a test commit with no test file among its changes', () => {
  const dir = repo();
  commit(dir, 'test: failing test for #7', { 'src/value.txt': 'bad2\n' });
  const r = gate(dir, [], { command: 'false' });
  assert.equal(r.json.result, 'fail');
});

test('fail: a merge commit with the test subject', () => {
  const dir = repo();
  git(dir, 'checkout', '-q', '-b', 'side');
  commit(dir, 'side work', { 'tests/side.sh': 'true\n' });
  git(dir, 'checkout', '-q', 'fix');
  commit(dir, 'fix work', { 'README.md': 'z\n' });
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'merge', '--no-ff', '-q', '-m', 'test: failing test for #7', 'side');
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  const r = gate(dir, [], { command: 'grep -q good src/value.txt' });
  assert.equal(r.json.result, 'fail');
  assert.match(r.json.problems.join(' '), /parents/);
});

test('timeout: a run that hangs is killed and the gate fails', () => {
  const dir = repo();
  fixed(dir);
  const r = gate(dir, ['--timeout-min', '0.02'], { command: 'sleep 30' });
  assert.equal(r.code, 0);
  assert.equal(r.json.result, 'fail');
  assert.equal(r.json.at_test_commit.timed_out, true);
  assert.equal(r.json.at_test_commit.signal, 'SIGTERM');
  assert.equal(git(dir, 'symbolic-ref', '--short', 'HEAD'), 'fix');
});

test('exit 127 and 126 at the test commit are not a valid failure', () => {
  for (const [command, code] of [['no_such_command_xyz', 127], ['exit 126', 126]]) {
    const dir = repo();
    fixed(dir);
    const r = gate(dir, [], { command: `if grep -q good src/value.txt; then exit 0; fi; ${command}` });
    assert.equal(r.json.at_test_commit.exit_code, code);
    assert.equal(r.json.result, 'fail');
  }
});

test('--test-path matches on a directory boundary', () => {
  const dir = repo();
  commit(dir, 'test: failing test for #7', { 'tests/check.sh': TEST_SH, 'helpers-x/prod.php': 'x\n', 'helpers/ok.php': 'x\n' });
  commit(dir, 'fix: use the good value', { 'src/value.txt': 'good\n' });
  assert.equal(gate(dir, ['--test-path', 'helpers']).json.result, 'fail');
  assert.equal(gate(dir, ['--test-path', 'helpers', '--test-path', 'helpers-x']).json.result, 'pass');
  assert.equal(isTestFile('tests-helper/prod.php', ['tests']), false);
  assert.equal(isTestFile('lib/tests-helper/prod.php', ['lib/tests']), false);
  assert.equal(isTestFile('lib/tests/a.php', ['lib/tests']), true);
  assert.equal(isTestFile('lib/tests', ['lib/tests']), true);
});

test('head_sha is the commit the head run used', () => {
  const dir = repo();
  fixed(dir);
  const r = gate(dir);
  assert.equal(r.json.head_sha, git(dir, 'rev-parse', 'HEAD'));
});

test('--base starting with a dash is rejected', () => {
  const dir = repo();
  fixed(dir);
  assert.equal(gate(dir, ['--base', '--output=x']).code, 2);
});

// ---------- round two ----------

// A fake `docker` on PATH: `ps` prints one container id, every call is logged.
function fakeDocker() {
  const bin = mkdtempSync(join(tmpdir(), 'fakedocker-'));
  const log = join(bin, 'calls.log');
  writeFileSync(join(bin, 'docker'), `#!/bin/sh\necho "$@" >> "${log}"\n[ "$1" = ps ] && echo abc123\nexit 0\n`);
  chmodSync(join(bin, 'docker'), 0o755);
  return { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, log };
}

test('TEST_FIRST_RUN_ID is in the command environment and containers with it are removed', () => {
  const dir = repo();
  fixed(dir);
  const d = fakeDocker();
  const r = gate(dir, [], { command: 'echo "id=$TEST_FIRST_RUN_ID"; grep -q good src/value.txt', env: d.env });
  assert.match(r.json.at_test_commit.output_tail, /id=tf-7-\d+-1/);
  assert.match(r.json.at_head.output_tail, /id=tf-7-\d+-2/);
  const calls = readFileSync(d.log, 'utf8');
  assert.match(calls, /ps -aq --filter label=test-first=tf-7-\d+-1/);
  assert.match(calls, /rm -f abc123/);
});

test('a missing docker is skipped silently', () => {
  const dir = repo();
  fixed(dir);
  assert.equal(gate(dir).json.result, 'pass');
});

test('a command that exits leaving a background job: the job is stopped, nothing lands later', async () => {
  const dir = repo();
  fixed(dir);
  const r = gate(dir, [], { command: 'grep -q good src/value.txt && exit 0; (sleep 2; echo late > late.txt) & exit 1' });
  assert.equal(r.json.result, 'pass');
  await new Promise((res) => setTimeout(res, 3000));
  assert.equal(existsSync(join(dir, 'late.txt')), false);
  assert.equal(git(dir, 'status', '--porcelain'), '');
});

test('a command that ignores SIGTERM is killed after the grace period', () => {
  const dir = repo();
  fixed(dir);
  const t0 = Date.now();
  const r = gate(dir, ['--timeout-min', '0.02', '--kill-grace-sec', '1'], { command: "trap '' TERM; sleep 30" });
  assert.equal(r.json.result, 'fail');
  assert.equal(r.json.at_test_commit.timed_out, true);
  assert.ok(Date.now() - t0 < 25_000);
  assert.equal(git(dir, 'symbolic-ref', '--short', 'HEAD'), 'fix');
});

test('untracked files that existed before the run survive, even when .gitignore changes later', () => {
  const dir = repo();
  commit(dir, 'test: failing test for #7', { 'tests/check.sh': TEST_SH });
  commit(dir, 'fix: use the good value and ignore vendor', { 'src/value.txt': 'good\n', '.gitignore': 'vendor/\n' });
  put(dir, 'vendor/dep.txt', 'dep\n');
  const r = gate(dir, [], { command: 'touch stray.txt; mkdir -p scratch; touch scratch/x; echo more > vendor/new.txt; grep -q good src/value.txt' });
  assert.equal(r.json.result, 'pass');
  assert.equal(readFileSync(join(dir, 'vendor/dep.txt'), 'utf8'), 'dep\n');
  assert.equal(existsSync(join(dir, 'stray.txt')), false);
  assert.equal(existsSync(join(dir, 'scratch/x')), false);
});

test('a new ignored folder is removed, a pre-existing ignored folder stays', () => {
  const dir = repo();
  commit(dir, 'ignore', { '.gitignore': 'vendor/\ncache/\n' });
  fixed(dir);
  put(dir, 'vendor/dep.txt', 'dep\n');
  gate(dir, [], { command: 'mkdir -p cache; echo c > cache/c.txt; grep -q good src/value.txt' });
  assert.equal(existsSync(join(dir, 'vendor/dep.txt')), true);
  assert.equal(existsSync(join(dir, 'cache')), false);
});

test('exit 125 at the test commit is not a valid failure', () => {
  const dir = repo();
  fixed(dir);
  const r = gate(dir, [], { command: 'grep -q good src/value.txt || exit 125' });
  assert.equal(r.json.at_test_commit.exit_code, 125);
  assert.equal(r.json.result, 'fail');
  assert.equal(isValidFailure({ exit_code: 125 }), false);
  assert.equal(isValidFailure({ exit_code: 1 }), true);
});

test('a spawn that throws resolves with an error instead of throwing', async () => {
  const run = await runCommand(tmpdir(), 'true\0false');
  assert.equal(typeof run.error, 'string');
  assert.equal(run.exit_code, null);
});

test('SIGTERM mid-run restores the branch', async () => {
  const dir = repo();
  fixed(dir);
  const child = spawn('node', [SCRIPT, '--dir', dir, '--issue', '7', '--command', 'echo junk >> src/value.txt; sleep 30'], { stdio: 'ignore' });
  const exited = new Promise((res) => child.on('exit', (code) => res(code)));
  for (let i = 0; i < 100; i++) {
    let detached = false;
    try { git(dir, 'symbolic-ref', '-q', 'HEAD'); } catch { detached = true; }
    if (detached) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  await new Promise((r) => setTimeout(r, 300));
  child.kill('SIGTERM');
  assert.equal(await exited, 143);
  assert.equal(git(dir, 'symbolic-ref', '--short', 'HEAD'), 'fix');
  assert.equal(git(dir, 'status', '--porcelain'), '');
});
