// Install script for the factory's installed copies: sync `playbooks/`, the factory skills and the
// scheduled task prompts from a commit of this repo into ~/.agents/playbooks/,
// ~/.claude/skills/<name>/ and ~/.claude/scheduled-tasks/<name>/.
//
// Usage:
//   node install.mjs --source <codyssey-skills checkout> [--ref <ref>]
//
// Without --ref it runs `git fetch -q origin` in the checkout and installs origin/main. With
// --ref it does not fetch. Files come from the commit (`git ls-tree`, `git cat-file`), never from
// the working tree, so a stale or dirty checkout does not matter. A file is written only when its
// bytes or its executable bit differ, so a second run with nothing new moves no mtime. Nothing is
// ever deleted. The installed sha goes to ~/.agents/playbooks/.installed-sha, written last.
//
// A task prompt is written only when its task folder exists. Claude Desktop creates that folder
// when the task is created, so the install updates a task and never creates one. A missing task
// folder is listed under `skipped`.
//
// The install refuses while a live claim lock exists in $FACTORY_HOME/locks (same stale rule as
// pick-up.mjs): a run's claim and release must not see two versions of the scripts.
//
// Targets: FACTORY_AGENTS_DIR (default ~/.agents), FACTORY_SKILLS_DIR (default ~/.claude/skills),
// FACTORY_TASKS_DIR (default ~/.claude/scheduled-tasks), FACTORY_HOME (default ~/.factory).
// One JSON object on stdout, errors on stderr.
// Exit 0 installed (also when nothing changed), 1 unexpected error, 2 bad usage, 3 refused.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageError, inspectLock, lockIsStale, locksDir } from './pick-up.mjs';

export const FACTORY_SKILLS = ['bootstrap', 'brief-to-backlog', 'brief-writer', 'event-model', 'factory-onboard'];
export const FACTORY_TASKS = ['factory-pickup', 'factory-pickup-frontend', 'factory-pickup-tools'];
export const DEFAULT_REF = 'origin/main';
const INSTALLER_SRC = 'playbooks/scripts/install.mjs';

// The only place the install list lives: a path prefix in the commit -> its folder on disk.
// `existingOnly` targets are updated but never created.
export function installMap({ agentsDir, skillsDir, tasksDir }) {
  return [
    { prefix: 'playbooks/', dir: join(agentsDir, 'playbooks') },
    ...FACTORY_SKILLS.map((name) => ({ prefix: `factory/${name}/`, dir: join(skillsDir, name) })),
    ...FACTORY_TASKS.map((name) => ({ prefix: `scheduled-tasks/${name}/`, dir: join(tasksDir, name), existingOnly: true })),
  ];
}

const shaFile = (d) => join(d.agentsDir, 'playbooks', '.installed-sha');

// ---------- boundary (git + filesystem + clock) ----------

function defaultGit(args) {
  return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
}

export function makeDeps(env = process.env) {
  return {
    stateDir: env.FACTORY_HOME || join(homedir(), '.factory'),
    agentsDir: env.FACTORY_AGENTS_DIR || join(homedir(), '.agents'),
    skillsDir: env.FACTORY_SKILLS_DIR || join(homedir(), '.claude', 'skills'),
    tasksDir: env.FACTORY_TASKS_DIR || join(homedir(), '.claude', 'scheduled-tasks'),
    git: defaultGit,
    now: () => Date.now(),
  };
}

// ---------- logic ----------

// Lock folders that are not stale, as paths. Entries that are not folders are ignored.
export function liveLocks(d) {
  if (!existsSync(locksDir(d))) return [];
  return readdirSync(locksDir(d))
    .filter((name) => {
      const lock = inspectLock(join(locksDir(d), name));
      return lock.kind !== 'gone' && !lockIsStale(lock, d.now());
    })
    .sort()
    .map((name) => join(locksDir(d), name));
}

// The real path of a path that may not exist yet: the nearest existing ancestor, resolved, plus the rest.
function realPathOfNearest(path) {
  const rest = [];
  let cur = path;
  while (!lstatSync(cur, { throwIfNoEntry: false })) {
    const parent = dirname(cur);
    if (parent === cur) return path;
    rest.unshift(basename(cur));
    cur = parent;
  }
  return join(realpathSync(cur), ...rest);
}

const isInside = (root, path) => {
  const rel = relative(root, path);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

// {entries: [{src, dest, mode, blob}], skipped: [dir]}: every file of the commit that the map
// installs, and each `existingOnly` folder that is missing, whose files are left out.
export function planInstall(d, { source, sha }) {
  const map = installMap(d);
  for (const { dir } of map) {
    if (lstatSync(dir, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`${dir} is a symlink; refusing to write through it`);
  }
  const skipped = map
    .filter((t) => t.existingOnly && !lstatSync(t.dir, { throwIfNoEntry: false })?.isDirectory())
    .map((t) => t.dir);
  const realRoots = new Map(map.map(({ dir }) => [dir, realPathOfNearest(dir)]));
  const checkedDirs = new Set();
  const listing = d.git(['-C', source, 'ls-tree', '-r', '-z', sha]).toString('utf8');
  const entries = [];
  for (const rec of listing.split('\0')) {
    if (!rec) continue;
    const m = /^(\d+) (\w+) (\w+)\t(.*)$/s.exec(rec);
    if (!m) throw new Error(`cannot parse ls-tree entry: ${rec}`);
    const [, mode, type, blob, src] = m;
    const target = map.find((t) => src.startsWith(t.prefix));
    if (!target || skipped.includes(target.dir)) continue;
    if (type !== 'blob' || (mode !== '100644' && mode !== '100755')) {
      throw new Error(`${src} is a ${type} with mode ${mode}; only regular files install`);
    }
    const dest = join(target.dir, src.slice(target.prefix.length));
    const destDir = dirname(dest);
    if (!checkedDirs.has(destDir)) {
      if (!isInside(realRoots.get(target.dir), realPathOfNearest(destDir))) {
        throw new Error(`${destDir} resolves outside ${target.dir} through a symlink; refusing to write through it`);
      }
      checkedDirs.add(destDir);
    }
    entries.push({ src, dest, mode, blob });
  }
  if (!entries.length) throw new Error(`${sha} has no files to install`);
  return { entries, skipped };
}

// Writes bytes through a temp file in the same folder and a rename. False when nothing differs.
function syncFile(dest, bytes, executable) {
  const st = lstatSync(dest, { throwIfNoEntry: false });
  if (st?.isFile() && ((st.mode & 0o111) !== 0) === executable && readFileSync(dest).equals(bytes)) return false;
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = join(dirname(dest), `.${basename(dest)}.${randomUUID()}.tmp`);
  const perm = executable ? 0o755 : 0o644;
  try {
    writeFileSync(tmp, bytes, { mode: perm });
    chmodSync(tmp, perm); // writeFileSync's mode is cut by the umask
    renameSync(tmp, dest);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
  return true;
}

// -> {status: 'refused', locks} | {status: 'installed', sha, changed: [dest paths], skipped: [dirs]}
export function install(d, { source, ref }) {
  const refusal = () => {
    const locks = liveLocks(d);
    return locks.length ? { status: 'refused', locks } : undefined;
  };
  const first = refusal();
  if (first) return first;
  let target = ref;
  if (target === undefined) {
    d.git(['-C', source, 'fetch', '-q', 'origin']);
    target = DEFAULT_REF;
  }
  const sha = d.git(['-C', source, 'rev-parse', '--verify', `${target}^{commit}`]).toString('utf8').trim();
  const second = refusal();
  if (second) return second;
  const { entries, skipped } = planInstall(d, { source, sha });
  // Every blob is read before the first write, so a git failure leaves the install untouched.
  // install.mjs is written after every other file: the new one imports exports that only the new
  // pick-up.mjs has, so a failure between the two writes must not leave a new installer on old scripts.
  const items = entries
    .map((e) => ({ e, bytes: d.git(['-C', source, 'cat-file', 'blob', e.blob]) }))
    .sort((a, b) => (a.e.src === INSTALLER_SRC) - (b.e.src === INSTALLER_SRC));
  const changed = [];
  for (const { e, bytes } of items) {
    if (syncFile(e.dest, bytes, e.mode === '100755')) changed.push(e.dest);
  }
  if (syncFile(shaFile(d), Buffer.from(`${sha}\n`), false)) changed.push(shaFile(d));
  return { status: 'installed', sha, changed, skipped };
}

// ---------- CLI ----------

export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new UsageError(`${f} needs a value`);
      return argv[++i];
    };
    if (f === '--source') o.source = resolve(val());
    else if (f === '--ref') {
      o.ref = val();
      if (!o.ref || o.ref.startsWith('-')) throw new UsageError(`bad ref: ${o.ref}`);
    } else throw new UsageError(`unknown flag: ${f}`);
  }
  if (!o.source) throw new UsageError('--source is required');
  return o;
}

export function main(argv, d = makeDeps()) {
  return install(d, parseArgs(argv));
}

// argv[1] may be a symlink; import.meta.url is already the real path.
if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  try {
    const result = main(process.argv.slice(2));
    console.log(JSON.stringify(result));
    if (result.status === 'refused') {
      console.error(`install refused: live claim locks, nothing written: ${result.locks.join(', ')}`);
      process.exitCode = 3;
    }
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`usage error: ${e.message}`);
      process.exit(2);
    }
    console.error(`install failed: ${e?.stderr?.toString().trim() || e?.message || e}`);
    process.exit(1);
  }
}
