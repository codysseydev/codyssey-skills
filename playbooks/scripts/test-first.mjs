// Test-first gate for a factory bug fix: prove the failing test was committed on its own, before
// the fix, and that it fails at that commit and passes at HEAD.
//
// Usage:
//   node test-first.mjs --dir <worktree> --issue <n> --command '<test command>' [--base origin/main] [--test-path <prefix-or-glob>]...
//   node test-first.mjs --issue <n> --none "<reason>"
//
// Prints one JSON object on stdout. Exit 0 whenever it prints a result (the `result` field says
// pass, fail or not_exercised; the top-level `exit_code` is the gate row's exit code). Exit 2 when
// it refuses (dirty tree, no test commit, more than one test commit, bad usage), with a message on
// stderr. Exit 1 on an unexpected error. It never prints environment variables.
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export class UsageError extends Error {}

const TAIL_LINES = 40;
const TEST_DIRS = new Set(['tests', 'test', '__tests__', 'spec']);
const TEST_NAMES = [/\.test\./, /\.spec\./, /Test\.php$/, /^test_.*\.py$/, /_test\.py$/, /_test\.go$/];

// ---------- pure logic ----------

export function subjectMatches(subject, issue) {
  const prefix = `test: failing test for #${issue}`;
  return subject.startsWith(prefix) && !/^\d/.test(subject.slice(prefix.length));
}

// Simple glob: `**` any characters, `*` any characters but `/`, `?` one character but `/`.
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function matchesTestPath(path, spec) {
  if (/[*?]/.test(spec)) return globToRegExp(spec).test(path);
  return path.startsWith(spec);
}

export function isTestFile(path, extraPaths = []) {
  const parts = path.split('/');
  const base = parts[parts.length - 1];
  if (parts.slice(0, -1).some((p) => TEST_DIRS.has(p))) return true;
  if (TEST_NAMES.some((re) => re.test(base))) return true;
  return extraPaths.some((spec) => matchesTestPath(path, spec));
}

export function tailLines(text, n = TAIL_LINES) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  return lines.slice(-n).join('\n');
}

export function decide({ nonTestFiles, atTestCommit, atHead }) {
  return nonTestFiles.length === 0 && atTestCommit !== 0 && atHead === 0 ? 'pass' : 'fail';
}

export function noneResult(reason) {
  return { gate: 'test-first', command: 'none', exit_code: 0, result: 'not_exercised', reason };
}

// ---------- git and process ----------

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

// stderr is folded into stdout so the tail keeps the order a developer would see.
export function runCommand(dir, command) {
  const r = spawnSync('sh', ['-c', `exec 2>&1\n${command}`], {
    cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  return { exit_code: r.status ?? 1, output_tail: tailLines(r.stdout ?? '') };
}

export function checkTestFirst({ dir, issue, command, base = 'origin/main', testPaths = [] }) {
  if (git(dir, ['status', '--porcelain']).trim() !== '') {
    throw new UsageError('refusing: the working tree is dirty. Commit or remove changes and run again from a clean tree.');
  }
  const matches = git(dir, ['log', '--format=%H%x09%s', `${base}..HEAD`])
    .split('\n').filter(Boolean)
    .map((l) => ({ sha: l.slice(0, l.indexOf('\t')), subject: l.slice(l.indexOf('\t') + 1) }))
    .filter((c) => subjectMatches(c.subject, issue));
  if (matches.length === 0) {
    throw new UsageError(`refusing: no commit in ${base}..HEAD has a subject starting "test: failing test for #${issue}".`);
  }
  if (matches.length > 1) {
    throw new UsageError(`refusing: ${matches.length} commits in ${base}..HEAD have a subject starting "test: failing test for #${issue}" (${matches.map((c) => c.sha.slice(0, 7)).join(', ')}). Exactly one is allowed.`);
  }
  const testCommit = matches[0].sha;
  const files = git(dir, ['show', '--no-renames', '--name-only', '--format=', '-z', testCommit])
    .split('\0').filter(Boolean);
  const nonTestFiles = files.filter((f) => !isTestFile(f, testPaths));

  let original;
  try {
    original = git(dir, ['symbolic-ref', '-q', '--short', 'HEAD']).trim();
  } catch {
    original = git(dir, ['rev-parse', 'HEAD']).trim(); // started detached
  }
  let atTestCommit;
  try {
    git(dir, ['checkout', '-q', '--detach', testCommit]);
    atTestCommit = runCommand(dir, command);
  } finally {
    git(dir, ['checkout', '-q', original]);
  }
  const atHead = runCommand(dir, command);

  const result = decide({ nonTestFiles, atTestCommit: atTestCommit.exit_code, atHead: atHead.exit_code });
  return {
    gate: 'test-first',
    command,
    exit_code: result === 'pass' ? 0 : 1,
    result,
    test_commit: testCommit,
    non_test_files: nonTestFiles,
    at_test_commit: atTestCommit,
    at_head: atHead,
  };
}

// ---------- CLI ----------

export function parseArgs(argv) {
  const o = { base: 'origin/main', testPaths: [] };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new UsageError(`${f} needs a value`);
      return argv[++i];
    };
    if (f === '--dir') o.dir = val();
    else if (f === '--issue') {
      const n = val();
      if (!/^\d+$/.test(n)) throw new UsageError(`bad issue number: ${n}`);
      o.issue = Number(n);
    } else if (f === '--command') o.command = val();
    else if (f === '--base') o.base = val();
    else if (f === '--test-path') o.testPaths.push(val());
    else if (f === '--none') o.none = val();
    else throw new UsageError(`unknown flag: ${f}`);
  }
  if (o.issue === undefined) throw new UsageError('--issue is required');
  if (o.none !== undefined) {
    if (!o.none.trim()) throw new UsageError('--none needs a reason');
    if (o.dir || o.command) throw new UsageError('--none takes only --issue');
    return o;
  }
  if (!o.dir) throw new UsageError('--dir is required');
  if (!o.command) throw new UsageError('--command is required');
  return o;
}

export function main(argv) {
  const o = parseArgs(argv);
  if (o.none !== undefined) return noneResult(o.none);
  return checkTestFirst(o);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(JSON.stringify(main(process.argv.slice(2))));
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`usage error: ${e.message}`);
      process.exit(2);
    }
    console.error(`test-first failed: ${e?.stderr || e?.message || e}`);
    process.exit(1);
  }
}
