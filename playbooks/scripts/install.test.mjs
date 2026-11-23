import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACTORY_SKILLS, FACTORY_TASKS, install, makeDeps } from './install.mjs';

// The real ~/.claude/scheduled-tasks holds the live Desktop task prompts. Every run below gets its
// own FACTORY_TASKS_DIR; this default only catches a run that forgets it.
process.env.FACTORY_TASKS_DIR = mkdtempSync(join(tmpdir(), 'install-tasks-'));

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'install.mjs');
const REPO = join(dirname(SCRIPT), '..', '..');
const H = 3600 * 1000;

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@example.com',
};
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function put(root, path, content, mode) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  if (mode) chmodSync(file, mode);
}

function commit(wc, files, message) {
  for (const [path, content, mode] of files) put(wc, path, content, mode);
  git(wc, 'add', '-A');
  git(wc, 'commit', '-q', '-m', message);
  return git(wc, 'rev-parse', 'HEAD');
}

const baseFiles = (v) => [
  ['playbooks/factory.md', `playbook ${v}\n`],
  ['playbooks/scripts/pick-up.mjs', `pick-up ${v}\n`],
  ['playbooks/scripts/install.mjs', `install ${v}\n`],
  ['playbooks/scripts/run.sh', `#!/bin/sh\necho ${v}\n`, 0o755],
  ...FACTORY_SKILLS.map((name) => [`factory/${name}/SKILL.md`, `${name} ${v}\n`]),
  ['factory/event-model/scripts/check.py', `check ${v}\n`],
  ['factory/not-listed/SKILL.md', 'not listed\n'],
  ...FACTORY_TASKS.map((name) => [`scheduled-tasks/${name}/SKILL.md`, `${name} prompt ${v}\n`]),
  ['scheduled-tasks/not-listed/SKILL.md', 'not listed\n'],
  ['README.md', `readme ${v}\n`],
];

// A bare repo, a seed clone to push from, and a clone as the install's --source. Targets and
// FACTORY_HOME are temp dirs, so nothing here touches the real home.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'install-'));
  const bare = join(root, 'origin.git');
  const seed = join(root, 'seed');
  const source = join(root, 'source');
  git(root, 'init', '-q', '--bare', '-b', 'main', bare);
  git(root, 'clone', '-q', bare, seed);
  git(seed, 'checkout', '-q', '-b', 'main');
  const sha1 = commit(seed, baseFiles('v1'), 'v1');
  git(seed, 'push', '-q', 'origin', 'main');
  git(root, 'clone', '-q', bare, source);
  const agentsDir = join(root, 'agents');
  const skillsDir = join(root, 'skills');
  const tasksDir = join(root, 'tasks');
  const home = join(root, 'home');
  for (const dir of [agentsDir, skillsDir, home]) mkdirSync(dir);
  // Desktop makes a task's folder when the task is created; the fixture has every listed task.
  for (const name of FACTORY_TASKS) mkdirSync(join(tasksDir, name), { recursive: true });
  const runScript = (script, ...args) => {
    const r = spawnSync('node', [script, ...args], {
      encoding: 'utf8',
      env: { ...process.env, FACTORY_HOME: home, FACTORY_AGENTS_DIR: agentsDir, FACTORY_SKILLS_DIR: skillsDir, FACTORY_TASKS_DIR: tasksDir },
    });
    let out;
    try {
      out = JSON.parse(r.stdout);
    } catch {
      out = undefined;
    }
    return { code: r.status, out, stderr: r.stderr };
  };
  const run = (...args) => runScript(SCRIPT, ...args);
  return { root, bare, seed, source, agentsDir, skillsDir, tasksDir, home, sha1, run, runScript };
}

const read = (...p) => readFileSync(join(...p), 'utf8');

// Every file under a dir, as sorted relative paths.
function listFiles(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listFiles(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]))
    .sort();
}

function writeLock(home, name, claimedAt) {
  const dir = join(home, 'locks', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'claim.json'), JSON.stringify({ repo: 'o/r', issue: 1, action: 'plan', run_id: 'r', claimed_at: new Date(claimedAt).toISOString() }));
  return dir;
}

function rawLock(home, name, content, mtimeMs) {
  const dir = join(home, 'locks', name);
  mkdirSync(dir, { recursive: true });
  if (content !== undefined) writeFileSync(join(dir, 'claim.json'), content);
  utimesSync(dir, new Date(mtimeMs), new Date(mtimeMs));
  return dir;
}

const nothingWritten = (f) => {
  assert.deepEqual(listFiles(f.agentsDir), []);
  assert.deepEqual(listFiles(f.skillsDir), []);
  assert.deepEqual(listFiles(f.tasksDir), []);
  assert.deepEqual(readdirSync(f.tasksDir).sort(), [...FACTORY_TASKS].sort());
};

test('installs playbooks and the five skills from the ref and records the sha', () => {
  const f = fixture();
  const { code, out } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.equal(code, 0);
  assert.equal(out.status, 'installed');
  assert.equal(out.sha, f.sha1);
  assert.equal(read(f.agentsDir, 'playbooks/factory.md'), 'playbook v1\n');
  assert.equal(read(f.agentsDir, 'playbooks/scripts/pick-up.mjs'), 'pick-up v1\n');
  for (const name of FACTORY_SKILLS) assert.equal(read(f.skillsDir, name, 'SKILL.md'), `${name} v1\n`);
  assert.equal(read(f.skillsDir, 'event-model/scripts/check.py'), 'check v1\n');
  assert.equal(read(f.agentsDir, 'playbooks/.installed-sha'), `${f.sha1}\n`);
  assert.ok(statSync(join(f.agentsDir, 'playbooks/scripts/run.sh')).mode & 0o100, 'executable bit kept');
  assert.equal(statSync(join(f.agentsDir, 'playbooks/factory.md')).mode & 0o111, 0);
  assert.ok(out.changed.includes(join(f.agentsDir, 'playbooks/factory.md')));
  assert.ok(out.changed.includes(join(f.agentsDir, 'playbooks/.installed-sha')));
  assert.equal(out.changed.length, listFiles(f.agentsDir).length + listFiles(f.skillsDir).length + listFiles(f.tasksDir).length);
});

test('a dirty working tree in the source is not installed', () => {
  const f = fixture();
  put(f.source, 'playbooks/factory.md', 'dirty edit\n');
  put(f.source, 'playbooks/untracked.md', 'untracked\n');
  put(f.source, 'factory/bootstrap/SKILL.md', 'dirty skill\n');
  const { code } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.equal(code, 0);
  assert.equal(read(f.agentsDir, 'playbooks/factory.md'), 'playbook v1\n');
  assert.equal(read(f.skillsDir, 'bootstrap/SKILL.md'), 'bootstrap v1\n');
  assert.ok(!existsSync(join(f.agentsDir, 'playbooks/untracked.md')));
});

test('files from the commit, not the checked-out files, when HEAD is behind the ref', () => {
  const f = fixture();
  const sha2 = commit(f.seed, [['playbooks/factory.md', 'playbook v2\n']], 'v2');
  git(f.seed, 'push', '-q', 'origin', 'main');
  git(f.source, 'fetch', '-q', 'origin');
  const { code, out } = f.run('--source', f.source, '--ref', 'origin/main');
  assert.equal(code, 0);
  assert.equal(out.sha, sha2);
  assert.equal(read(f.agentsDir, 'playbooks/factory.md'), 'playbook v2\n');
  assert.equal(read(f.source, 'playbooks/factory.md'), 'playbook v1\n');
});

test('without --ref it fetches and installs origin/main', () => {
  const f = fixture();
  const sha2 = commit(f.seed, [['playbooks/factory.md', 'playbook v2\n'], ['factory/brief-writer/SKILL.md', 'new brief-writer\n']], 'v2');
  git(f.seed, 'push', '-q', 'origin', 'main');
  assert.notEqual(git(f.source, 'rev-parse', 'origin/main'), sha2, 'the clone has not seen v2 yet');
  const { code, out } = f.run('--source', f.source);
  assert.equal(code, 0);
  assert.equal(out.sha, sha2);
  assert.equal(read(f.agentsDir, 'playbooks/factory.md'), 'playbook v2\n');
  assert.equal(read(f.skillsDir, 'brief-writer/SKILL.md'), 'new brief-writer\n');
  assert.equal(read(f.agentsDir, 'playbooks/.installed-sha'), `${sha2}\n`);
});

test('a second run with nothing new changes no file and no mtime', () => {
  const f = fixture();
  assert.equal(f.run('--source', f.source, '--ref', 'HEAD').code, 0);
  const old = new Date('2020-01-01T00:00:00Z');
  const files = [
    ...listFiles(f.agentsDir).map((p) => join(f.agentsDir, p)),
    ...listFiles(f.skillsDir).map((p) => join(f.skillsDir, p)),
    ...listFiles(f.tasksDir).map((p) => join(f.tasksDir, p)),
  ];
  for (const file of files) utimesSync(file, old, old);
  const { code, out } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.equal(code, 0);
  assert.equal(out.status, 'installed');
  assert.deepEqual(out.changed, []);
  for (const file of files) assert.equal(statSync(file).mtimeMs, old.getTime(), file);
});

test('a changed file and a changed mode are rewritten, the rest is left alone', () => {
  const f = fixture();
  f.run('--source', f.source, '--ref', 'HEAD');
  const old = new Date('2020-01-01T00:00:00Z');
  const untouched = join(f.agentsDir, 'playbooks/scripts/pick-up.mjs');
  utimesSync(untouched, old, old);
  writeFileSync(join(f.agentsDir, 'playbooks/factory.md'), 'hand edit\n');
  chmodSync(join(f.agentsDir, 'playbooks/scripts/run.sh'), 0o644);
  const { out } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.deepEqual(out.changed.sort(), [join(f.agentsDir, 'playbooks/factory.md'), join(f.agentsDir, 'playbooks/scripts/run.sh')]);
  assert.equal(read(f.agentsDir, 'playbooks/factory.md'), 'playbook v1\n');
  assert.ok(statSync(join(f.agentsDir, 'playbooks/scripts/run.sh')).mode & 0o100);
  assert.equal(statSync(untouched).mtimeMs, old.getTime());
});

test('a file the repo lacks survives, and no temp file is left behind', () => {
  const f = fixture();
  put(f.agentsDir, 'playbooks/extra.md', 'mine\n');
  put(f.agentsDir, 'other.txt', 'mine\n');
  put(f.skillsDir, 'bootstrap/local.txt', 'mine\n');
  put(f.skillsDir, 'unrelated/SKILL.md', 'mine\n');
  commit(f.seed, [['playbooks/gone.md', 'x\n']], 'add gone');
  git(f.seed, 'push', '-q', 'origin', 'main');
  assert.equal(f.run('--source', f.source).code, 0);
  git(f.seed, 'rm', '-q', 'playbooks/gone.md');
  git(f.seed, 'commit', '-q', '-m', 'remove gone');
  git(f.seed, 'push', '-q', 'origin', 'main');
  assert.equal(f.run('--source', f.source).code, 0);
  assert.equal(read(f.agentsDir, 'playbooks/extra.md'), 'mine\n');
  assert.equal(read(f.agentsDir, 'other.txt'), 'mine\n');
  assert.equal(read(f.skillsDir, 'bootstrap/local.txt'), 'mine\n');
  assert.equal(read(f.skillsDir, 'unrelated/SKILL.md'), 'mine\n');
  assert.equal(read(f.agentsDir, 'playbooks/gone.md'), 'x\n', 'a file removed from the repo stays installed');
  assert.deepEqual([...listFiles(f.agentsDir), ...listFiles(f.skillsDir)].filter((p) => p.endsWith('.tmp')), []);
});

test('a live lock refuses with exit 3, names the folder and writes nothing', () => {
  const f = fixture();
  const dir = writeLock(f.home, 'o-r-1', Date.now() - 1 * H);
  const { code, out, stderr } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.equal(code, 3);
  assert.deepEqual(out, { status: 'refused', locks: [dir] });
  assert.ok(stderr.includes(dir), stderr);
  nothingWritten(f);
});

test('a live lock refuses before it fetches', () => {
  const f = fixture();
  writeLock(f.home, 'o-r-1', Date.now());
  commit(f.seed, [['playbooks/factory.md', 'playbook v2\n']], 'v2');
  git(f.seed, 'push', '-q', 'origin', 'main');
  const before = git(f.source, 'rev-parse', 'origin/main');
  assert.equal(f.run('--source', f.source).code, 3);
  assert.equal(git(f.source, 'rev-parse', 'origin/main'), before);
});

test('only stale locks, readable or not, do not block the install', () => {
  const f = fixture();
  writeLock(f.home, 'o-r-1', Date.now() - 5 * H);
  rawLock(f.home, 'o-r-2', undefined, Date.now() - 5 * H);
  rawLock(f.home, 'o-r-3', '{not json', Date.now() - 5 * H);
  writeFileSync(join(f.home, 'locks', '.DS_Store'), 'junk');
  const { code, out } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.equal(code, 0);
  assert.equal(out.status, 'installed');
  assert.equal(read(f.agentsDir, 'playbooks/factory.md'), 'playbook v1\n');
});

test('a young lock folder with no claim.json refuses', () => {
  const f = fixture();
  const dir = rawLock(f.home, 'o-r-4', undefined, Date.now() - 1 * H);
  const { code, out } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.equal(code, 3);
  assert.deepEqual(out.locks, [dir]);
  nothingWritten(f);
});

test('one live lock among stale ones refuses and names only the live one', () => {
  const f = fixture();
  writeLock(f.home, 'o-r-1', Date.now() - 5 * H);
  const live = writeLock(f.home, 'o-r-2', Date.now());
  const { code, out } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.equal(code, 3);
  assert.deepEqual(out.locks, [live]);
});

test('a folder under factory/ that is not in the list is not installed', () => {
  const f = fixture();
  assert.equal(f.run('--source', f.source, '--ref', 'HEAD').code, 0);
  assert.ok(!existsSync(join(f.skillsDir, 'not-listed')));
  assert.ok(!existsSync(join(f.agentsDir, 'README.md')));
  assert.deepEqual(readdirSync(f.skillsDir).sort(), [...FACTORY_SKILLS].sort());
  assert.deepEqual(readdirSync(f.tasksDir).sort(), [...FACTORY_TASKS].sort());
});

test('a bad ref exits 1 and writes nothing', () => {
  const f = fixture();
  const { code, stderr } = f.run('--source', f.source, '--ref', 'no-such-ref');
  assert.equal(code, 1);
  assert.match(stderr, /install failed/);
  nothingWritten(f);
});

test('a source that is not a checkout exits 1 and writes nothing', () => {
  const f = fixture();
  const { code } = f.run('--source', join(f.root, 'missing'), '--ref', 'HEAD');
  assert.equal(code, 1);
  nothingWritten(f);
});

test('a skill folder that is a symlink exits 1 and the link target is untouched', () => {
  const f = fixture();
  const elsewhere = join(f.root, 'elsewhere');
  put(elsewhere, 'SKILL.md', 'checkout copy\n');
  symlinkSync(elsewhere, join(f.skillsDir, 'bootstrap'));
  const { code, stderr } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.equal(code, 1);
  assert.match(stderr, /symlink/);
  assert.equal(read(elsewhere, 'SKILL.md'), 'checkout copy\n');
  assert.deepEqual(listFiles(f.agentsDir), []);
});

test('usage errors exit 2 and write nothing', () => {
  const f = fixture();
  for (const args of [[], ['--ref', 'HEAD'], ['--source'], ['--source', f.source, '--ref', '--upload-pack=x'], ['--source', f.source, '--nope']]) {
    const { code, stderr } = f.run(...args);
    assert.equal(code, 2, args.join(' '));
    assert.match(stderr, /usage error/);
  }
  nothingWritten(f);
});

// install() with a git dep that wraps the real one, for failures the CLI cannot be made to hit.
function depsWith(f, wrap) {
  const real = makeDeps({ FACTORY_TASKS_DIR: f.tasksDir }).git;
  return {
    stateDir: f.home,
    agentsDir: f.agentsDir,
    skillsDir: f.skillsDir,
    tasksDir: f.tasksDir,
    git: (args) => wrap(args, real),
    now: () => Date.now(),
  };
}

test('a git failure while reading a blob writes nothing', () => {
  const f = fixture();
  let reads = 0;
  const d = depsWith(f, (args, real) => {
    if (args[2] === 'cat-file' && ++reads === 5) throw new Error('git cat-file failed');
    return real(args);
  });
  assert.throws(() => install(d, { source: f.source, ref: 'HEAD' }), /git cat-file failed/);
  assert.equal(reads, 5);
  nothingWritten(f);
});

test('the installed install.mjs is written last, just before the sha file', () => {
  const f = fixture();
  const { out } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.deepEqual(out.changed.slice(-2), [
    join(f.agentsDir, 'playbooks/scripts/install.mjs'),
    join(f.agentsDir, 'playbooks/.installed-sha'),
  ]);
});

test('running the script through a symlinked folder still installs', () => {
  const f = fixture();
  const link = join(f.root, 'linked-scripts');
  symlinkSync(dirname(SCRIPT), link);
  const { code, out } = f.runScript(join(link, 'install.mjs'), '--source', f.source, '--ref', 'HEAD');
  assert.equal(code, 0);
  assert.equal(out.status, 'installed');
  assert.equal(read(f.agentsDir, 'playbooks/factory.md'), 'playbook v1\n');
});

test('a folder below a target root that is a symlink out exits 1 and writes nothing', () => {
  const f = fixture();
  const outside = join(f.root, 'outside');
  mkdirSync(outside);
  mkdirSync(join(f.agentsDir, 'playbooks'));
  symlinkSync(outside, join(f.agentsDir, 'playbooks/scripts'));
  const { code, stderr } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.equal(code, 1);
  assert.match(stderr, /symlink/);
  assert.deepEqual(listFiles(outside), []);
  assert.deepEqual(listFiles(f.agentsDir), ['playbooks/scripts'], 'only the pre-made link');
  assert.deepEqual(listFiles(f.skillsDir), []);
});

test('a lock that appears during the fetch refuses and writes nothing', () => {
  const f = fixture();
  const d = depsWith(f, (args, real) => {
    const out = real(args);
    if (args[2] === 'fetch') writeLock(f.home, 'o-r-1', Date.now());
    return out;
  });
  const result = install(d, { source: f.source });
  assert.equal(result.status, 'refused');
  assert.deepEqual(result.locks, [join(f.home, 'locks', 'o-r-1')]);
  nothingWritten(f);
});

// ---------- scheduled task prompts ----------

const prompt = (f, name) => join(f.tasksDir, name, 'SKILL.md');
const repoPrompt = (name) => readFileSync(join(REPO, 'scheduled-tasks', name, 'SKILL.md'));

test('installs each task prompt byte for byte into its existing task folder', () => {
  const f = fixture();
  commit(f.seed, FACTORY_TASKS.map((name) => [`scheduled-tasks/${name}/SKILL.md`, repoPrompt(name)]), 'real prompts');
  git(f.seed, 'push', '-q', 'origin', 'main');
  const { code, out } = f.run('--source', f.source);
  assert.equal(code, 0);
  assert.deepEqual(out.skipped, []);
  for (const name of FACTORY_TASKS) {
    assert.ok(readFileSync(prompt(f, name)).equals(repoPrompt(name)), name);
    assert.ok(out.changed.includes(prompt(f, name)), name);
  }
});

test('a rerun leaves the installed prompts and their mtimes alone', () => {
  const f = fixture();
  assert.equal(f.run('--source', f.source, '--ref', 'HEAD').code, 0);
  const old = new Date('2020-01-01T00:00:00Z');
  for (const name of FACTORY_TASKS) utimesSync(prompt(f, name), old, old);
  const { code, out } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.equal(code, 0);
  assert.deepEqual(out.changed, []);
  for (const name of FACTORY_TASKS) assert.equal(statSync(prompt(f, name)).mtimeMs, old.getTime(), name);
});

test('a live lock refuses and leaves the installed prompts as they were', () => {
  const f = fixture();
  assert.equal(f.run('--source', f.source, '--ref', 'HEAD').code, 0);
  commit(f.seed, FACTORY_TASKS.map((name) => [`scheduled-tasks/${name}/SKILL.md`, `${name} prompt v2\n`]), 'v2 prompts');
  git(f.seed, 'push', '-q', 'origin', 'main');
  writeLock(f.home, 'o-r-1', Date.now());
  assert.equal(f.run('--source', f.source).code, 3);
  for (const name of FACTORY_TASKS) assert.equal(read(prompt(f, name)), `${name} prompt v1\n`);
});

test('a missing task folder is not created and is listed under skipped', () => {
  const f = fixture();
  const [missing, ...present] = FACTORY_TASKS;
  rmSync(join(f.tasksDir, missing), { recursive: true });
  const { code, out } = f.run('--source', f.source, '--ref', 'HEAD');
  assert.equal(code, 0);
  assert.deepEqual(out.skipped, [join(f.tasksDir, missing)]);
  assert.ok(!existsSync(join(f.tasksDir, missing)));
  for (const name of present) assert.equal(read(prompt(f, name)), `${name} prompt v1\n`);
  assert.equal(read(f.agentsDir, 'playbooks/factory.md'), 'playbook v1\n');
});

test('each repo prompt has the frontmatter Desktop reads and no home path', () => {
  for (const name of FACTORY_TASKS) {
    const text = repoPrompt(name).toString('utf8');
    const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
    assert.ok(front, `${name}: no frontmatter`);
    assert.match(front[1], new RegExp(`^name: ${name}$`, 'm'), name);
    assert.match(front[1], /^description: \S/m, name);
    assert.ok(!text.includes('/Users/'), `${name}: has a /Users/ path`);
  }
});

test('each repo prompt runs the install before it claims', () => {
  for (const name of FACTORY_TASKS) {
    const text = repoPrompt(name).toString('utf8');
    const installAt = text.indexOf('scripts/install.mjs');
    const claimAt = text.indexOf('scripts/pick-up.mjs claim');
    assert.ok(installAt !== -1 && claimAt !== -1, name);
    assert.ok(installAt < claimAt, `${name}: install comes after claim`);
  }
});

test('scheduled-tasks/ in the repo holds exactly the listed task folders', () => {
  assert.deepEqual(readdirSync(join(REPO, 'scheduled-tasks')).sort(), [...FACTORY_TASKS].sort());
});
