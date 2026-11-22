import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTestFile, subjectMatches, tailLines } from './test-first.mjs';

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

function gate(dir, extra = [], { issue = '7', command = CMD } = {}) {
  const r = spawnSync('node', [SCRIPT, '--dir', dir, '--issue', issue, '--command', command, ...extra], { encoding: 'utf8' });
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
