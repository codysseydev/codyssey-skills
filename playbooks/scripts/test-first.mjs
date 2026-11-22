// Test-first gate for a factory bug fix: prove the failing test was committed on its own, before
// the fix, and that it fails at that commit and passes at HEAD.
//
// Usage:
//   node test-first.mjs --dir <worktree> --issue <n> --command '<test command>' [--base origin/main]
//                       [--test-path <prefix-or-glob>]... [--timeout-min <minutes>]
//   node test-first.mjs --issue <n> --none "<reason>"
//
// Prints one JSON object on stdout. Exit 0 whenever it prints a result (the `result` field says
// pass, fail or not_exercised; the top-level `exit_code` is the gate row's exit code). Exit 2 when
// it refuses (dirty tree, no test commit, more than one test commit, bad usage), with a message on
// stderr. Exit 1 on an unexpected error. It never prints environment variables.
//
// The command runs in the given worktree: first at the test commit (detached), then at the original
// branch. After each run it discards what the command left behind (tracked edits and untracked files
// that are not ignored; ignored dependency folders stay) and the original branch is restored with a
// forced checkout, also on SIGINT and SIGTERM. If the restore fails twice the JSON carries
// `restore_failed: true` and the result is fail.
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export class UsageError extends Error {}

const TAIL_LINES = 40;
const KEEP_BYTES = 1024 * 1024; // the rolling window of output kept per run
export const DEFAULT_TIMEOUT_MIN = 10;
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

// A plain spec is a path or a directory: `tests` matches `tests` and `tests/a.php`, not `tests-helper/a.php`.
export function matchesTestPath(path, spec) {
  if (/[*?]/.test(spec)) return globToRegExp(spec).test(path);
  const dir = spec.endsWith('/') ? spec : `${spec}/`;
  return path === spec || path.startsWith(dir);
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

// A failure only counts when the command ran and reported failure: not killed, not timed out, not
// "cannot execute" (126) or "not found" (127), and no spawn error.
export function isValidFailure(run) {
  return run.exit_code !== null && run.exit_code !== 0 && run.exit_code !== 126 && run.exit_code !== 127
    && !run.signal && !run.timed_out && !run.error;
}

export function isCleanPass(run) {
  return run.exit_code === 0 && !run.signal && !run.timed_out && !run.error;
}

export function noneResult(reason) {
  return { gate: 'test-first', command: 'none', exit_code: 0, result: 'not_exercised', reason };
}

// ---------- git and process ----------

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

// Throw away what a test run left behind. `git clean -fd` without -x leaves ignored files alone, so
// vendor and node_modules stay.
export function discardChanges(dir) {
  git(dir, ['reset', '-q', '--hard']);
  git(dir, ['clean', '-q', '-fd']);
}

// Forced checkout of the original branch (or commit when the run started detached). Retries once.
export function restore(dir, original) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      git(dir, ['checkout', '-q', '-f', original]);
      discardChanges(dir);
      return true;
    } catch {
      // try again once
    }
  }
  return false;
}

// stderr is folded into stdout so the tail keeps the order a developer would see. The command runs
// in its own process group so a timeout or a signal kills it and everything it started.
export function runCommand(dir, command, { timeoutMs = DEFAULT_TIMEOUT_MIN * 60_000, onChild } = {}) {
  return new Promise((resolve) => {
    let out = '';
    let timedOut = false;
    let settled = false;
    const finish = (r) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      onChild?.(undefined);
      resolve({ exit_code: null, signal: null, timed_out: timedOut, ...r, output_tail: tailLines(out) });
    };
    let child;
    try {
      child = spawn('sh', ['-c', `exec 2>&1\n${command}`], { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'], detached: true });
    } catch (e) {
      finish({ error: String(e?.message ?? e) });
      return;
    }
    onChild?.(child);
    const killGroup = () => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        try { child.kill('SIGKILL'); } catch { /* already gone */ }
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      out += d;
      if (out.length > KEEP_BYTES * 2) out = out.slice(-KEEP_BYTES);
    });
    child.on('error', (e) => finish({ error: String(e?.message ?? e) }));
    child.on('exit', (code, signal) => {
      // Grandchildren can keep the pipe open; do not wait for it forever.
      setTimeout(() => finish({ exit_code: code, signal }), 200);
    });
  });
}

export async function checkTestFirst({
  dir, issue, command, base = 'origin/main', testPaths = [], timeoutMin = DEFAULT_TIMEOUT_MIN,
}) {
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
  const problems = [];
  const parents = git(dir, ['rev-list', '--parents', '-n', '1', testCommit]).trim().split(/\s+/).length - 1;
  if (parents !== 1) problems.push(`the test commit has ${parents} parents, expected exactly 1`);
  const files = git(dir, ['show', '--no-renames', '--name-only', '--format=', '-z', testCommit])
    .split('\0').filter(Boolean);
  const nonTestFiles = files.filter((f) => !isTestFile(f, testPaths));
  if (files.length === 0) problems.push('the test commit changes no files');
  else if (nonTestFiles.length === files.length) problems.push('the test commit changes no test file');
  if (nonTestFiles.length > 0) problems.push('the test commit changes files that are not test files');

  let original;
  try {
    original = git(dir, ['symbolic-ref', '-q', '--short', 'HEAD']).trim();
  } catch {
    original = git(dir, ['rev-parse', 'HEAD']).trim(); // started detached
  }

  const timeoutMs = Math.round(timeoutMin * 60_000);
  let child;
  const onSignal = (sig) => {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* no child */ }
    restore(dir, original);
    process.exit(sig === 'SIGINT' ? 130 : 143);
  };
  const handlers = ['SIGINT', 'SIGTERM'].map((sig) => {
    const h = () => onSignal(sig);
    process.on(sig, h);
    return [sig, h];
  });
  const track = (c) => { child = c; };

  let atTestCommit;
  let atHead;
  let restoreFailed = false;
  try {
    git(dir, ['checkout', '-q', '--detach', testCommit]);
    atTestCommit = await runCommand(dir, command, { timeoutMs, onChild: track });
    discardChanges(dir);
  } catch (e) {
    atTestCommit ??= { exit_code: null, signal: null, timed_out: false, error: String(e?.message ?? e), output_tail: '' };
  } finally {
    restoreFailed = !restore(dir, original);
  }
  let headSha = null;
  if (!restoreFailed) {
    headSha = git(dir, ['rev-parse', 'HEAD']).trim();
    if (git(dir, ['status', '--porcelain']).trim() !== '') {
      atHead = { exit_code: null, signal: null, timed_out: false, error: 'the tree is not clean after the restore', output_tail: '' };
    } else {
      atHead = await runCommand(dir, command, { timeoutMs, onChild: track });
      try {
        discardChanges(dir);
      } catch { /* checked below */ }
    }
    if (git(dir, ['status', '--porcelain']).trim() !== '' && !restore(dir, original)) restoreFailed = true;
  } else {
    atHead = { exit_code: null, signal: null, timed_out: false, error: 'could not restore the original branch', output_tail: '' };
  }
  for (const [sig, h] of handlers) process.off(sig, h);

  const pass = problems.length === 0 && !restoreFailed && isValidFailure(atTestCommit) && isCleanPass(atHead);
  const out = {
    gate: 'test-first',
    command,
    exit_code: pass ? 0 : 1,
    result: pass ? 'pass' : 'fail',
    test_commit: testCommit,
    head_sha: headSha,
    non_test_files: nonTestFiles,
    at_test_commit: atTestCommit,
    at_head: atHead,
  };
  if (problems.length) out.problems = problems;
  if (restoreFailed) out.restore_failed = true;
  return out;
}

// ---------- CLI ----------

export function parseArgs(argv) {
  const o = { base: 'origin/main', testPaths: [], timeoutMin: DEFAULT_TIMEOUT_MIN };
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
    else if (f === '--base') {
      o.base = val();
      if (o.base.startsWith('-')) throw new UsageError(`bad --base: ${o.base}`);
    } else if (f === '--test-path') o.testPaths.push(val());
    else if (f === '--timeout-min') {
      const m = Number(val());
      if (!(m > 0) || !Number.isFinite(m)) throw new UsageError('--timeout-min must be a positive number');
      o.timeoutMin = m;
    } else if (f === '--none') o.none = val();
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

export async function main(argv) {
  const o = parseArgs(argv);
  if (o.none !== undefined) return noneResult(o.none);
  return checkTestFirst(o);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(JSON.stringify(await main(process.argv.slice(2))));
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`usage error: ${e.message}`);
      process.exit(2);
    }
    console.error(`test-first failed: ${e?.stderr || e?.message || e}`);
    process.exit(1);
  }
}
