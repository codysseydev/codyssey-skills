// Post-merge helper for the factory's archive stage: read the facts about a merged PR, or open
// a revert branch for it.
//
// Usage:
//   node post-merge.mjs facts  --repo <owner/name> --pr <n> --checkout <path> [--deploy-check "<name>"]
//   node post-merge.mjs revert --repo <owner/name> --pr <n> --checkout <path> --merge-sha <sha> --base <ref> --parents <1|2>
//
// facts prints one JSON object: {merged, merge_sha, head_sha, merged_at, base, title, parents,
// tree_equals_head, deploy}. `deploy` is null without --deploy-check, else {name, state, completed_at}
// with state success, failure, pending or none. facts only fetches into the checkout. It never
// changes its working tree, index or branch.
//
// revert makes a temporary worktree from origin/<base>, creates branch factory/revert-<n>, runs
// `git revert --no-edit` (with `-m 1` for a merge commit), pushes the branch with `-u origin`,
// removes the worktree and prints {branch, head_sha}. On a revert conflict it aborts, removes the
// worktree, prints {error} and exits 1. The script never reads or prints a token: git uses the
// checkout's own remote and credentials, and any `user:secret@` in an error message is redacted.
//
// Exit 0 for a normal outcome, 1 when a revert fails or on an unexpected error, 2 on bad usage.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export class UsageError extends Error {}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const SHA_RE = /^[0-9a-f]{7,40}$/i;
const REF_RE = /^[\w][\w./-]*$/;

// ---------- pure logic ----------

// One check run -> 'success' | 'failure' | 'pending'. A run that has not completed is pending.
export function checkRunState(run) {
  if (run.status !== 'completed') return 'pending';
  return ['success', 'neutral', 'skipped'].includes(run.conclusion) ? 'success' : 'failure';
}

// Check runs on a commit -> {name, state, completed_at} for the run with this exact name.
// With several runs of that name (a rerun), the newest one counts.
export function deployFromCheckRuns(runs, name) {
  const named = (runs ?? []).filter((r) => r.name === name);
  if (!named.length) return { name, state: 'none', completed_at: null };
  const newest = named.reduce((a, b) => {
    const ta = Date.parse(a.started_at ?? a.completed_at ?? '') || 0;
    const tb = Date.parse(b.started_at ?? b.completed_at ?? '') || 0;
    return tb > ta || (tb === ta && (b.id ?? 0) > (a.id ?? 0)) ? b : a;
  });
  const state = checkRunState(newest);
  return { name, state, completed_at: state === 'pending' ? null : newest.completed_at ?? null };
}

// `git rev-list --parents -n 1 <sha>` output -> number of parents.
export function countParents(line) {
  return line.trim().split(/\s+/).filter(Boolean).length - 1;
}

// Strip credentials from a URL-like string before it reaches a message.
export function redact(text) {
  return String(text ?? '').replace(/(\w+:\/\/)[^\s/@]+@/g, '$1***@');
}

// ---------- boundary (gh + git) ----------

function defaultGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

function defaultGit(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

export function makeDeps({ gh = defaultGh, git = defaultGit } = {}) {
  return { gh, git };
}

function tryGit(git, args) {
  try {
    return { ok: true, out: git(args) };
  } catch (e) {
    return { ok: false, out: '', error: e };
  }
}

function hasCommit(git, checkout, sha) {
  return tryGit(git, ['-C', checkout, 'cat-file', '-e', `${sha}^{commit}`]).ok;
}

function readChecks(gh, repo, sha) {
  const out = gh(['api', '--paginate', '--slurp', `repos/${repo}/commits/${sha}/check-runs?per_page=100`]);
  return JSON.parse(out || '[]').flatMap((page) => page.check_runs ?? []);
}

// ---------- commands ----------

export function cmdFacts({ repo, pr, checkout, deployCheck }, { gh, git }) {
  const p = JSON.parse(gh(['api', `repos/${repo}/pulls/${pr}`]));
  const base = {
    merged: Boolean(p.merged),
    merge_sha: p.merge_commit_sha ?? null,
    head_sha: p.head?.sha ?? null,
    merged_at: p.merged_at ?? null,
    base: p.base?.ref ?? null,
    title: p.title ?? null,
    parents: null,
    tree_equals_head: null,
    deploy: deployCheck ? { name: deployCheck, state: 'none', completed_at: null } : null,
  };
  if (!base.merged || !base.merge_sha) return { ...base, merged: false };

  // Fetch only. Remote-tracking refs and FETCH_HEAD change, the working tree and branch do not.
  git(['-C', checkout, 'fetch', '-q', 'origin']);
  if (!hasCommit(git, checkout, base.head_sha)) {
    git(['-C', checkout, 'fetch', '-q', 'origin', `pull/${pr}/head`]);
  }
  const tree = (sha) => git(['-C', checkout, 'rev-parse', '--verify', '-q', `${sha}^{tree}`]).trim();
  const parents = countParents(git(['-C', checkout, 'rev-list', '--parents', '-n', '1', base.merge_sha]));
  const result = {
    ...base,
    parents,
    tree_equals_head: tree(base.merge_sha) === tree(base.head_sha),
  };
  if (deployCheck) result.deploy = deployFromCheckRuns(readChecks(gh, repo, base.merge_sha), deployCheck);
  return result;
}

export function cmdRevert({ repo, pr, checkout, mergeSha, base, parents }, { git }) {
  const branch = `factory/revert-${pr}`;
  const wt = join(mkdtempSync(join(tmpdir(), 'factory-revert-')), 'wt');
  const cleanup = () => {
    tryGit(git, ['-C', checkout, 'worktree', 'remove', '--force', wt]);
    rmSync(join(wt, '..'), { recursive: true, force: true });
    tryGit(git, ['-C', checkout, 'worktree', 'prune']);
  };
  const fail = (message) => {
    cleanup();
    return { error: redact(message) };
  };
  try {
    git(['-C', checkout, 'fetch', '-q', 'origin']);
    git(['-C', checkout, 'worktree', 'add', '-q', '-B', branch, wt, `origin/${base}`]);
  } catch (e) {
    return fail(`could not prepare the revert worktree: ${e?.stderr || e?.message || e}`);
  }
  const revertArgs = ['-C', wt, 'revert', '--no-edit', ...(parents === 2 ? ['-m', '1'] : []), mergeSha];
  const reverted = tryGit(git, revertArgs);
  if (!reverted.ok) {
    tryGit(git, ['-C', wt, 'revert', '--abort']);
    tryGit(git, ['-C', checkout, 'worktree', 'remove', '--force', wt]);
    tryGit(git, ['-C', checkout, 'branch', '-D', branch]);
    return fail(`git revert failed: ${reverted.error?.stderr || reverted.error?.message || reverted.error}`);
  }
  const headSha = git(['-C', wt, 'rev-parse', 'HEAD']).trim();
  const pushed = tryGit(git, ['-C', wt, 'push', '-q', '-u', 'origin', branch]);
  if (!pushed.ok) {
    tryGit(git, ['-C', checkout, 'worktree', 'remove', '--force', wt]);
    tryGit(git, ['-C', checkout, 'branch', '-D', branch]);
    return fail(`git push failed: ${pushed.error?.stderr || pushed.error?.message || pushed.error}`);
  }
  cleanup();
  return { branch, head_sha: headSha };
}

// ---------- CLI ----------

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!['facts', 'revert'].includes(cmd)) throw new UsageError('command must be facts or revert');
  const o = { cmd };
  const flags = {
    '--repo': 'repo', '--pr': 'pr', '--checkout': 'checkout', '--deploy-check': 'deployCheck',
    '--merge-sha': 'mergeSha', '--base': 'base', '--parents': 'parents',
  };
  for (let i = 0; i < rest.length; i++) {
    const key = flags[rest[i]];
    if (!key) throw new UsageError(`unknown flag: ${rest[i]}`);
    if (i + 1 >= rest.length) throw new UsageError(`${rest[i]} needs a value`);
    o[key] = rest[++i];
  }
  const need = (k, flag) => {
    if (o[k] === undefined || o[k] === '') throw new UsageError(`${flag} is required`);
  };
  need('repo', '--repo');
  need('pr', '--pr');
  need('checkout', '--checkout');
  if (!REPO_RE.test(o.repo)) throw new UsageError(`bad repo: ${o.repo}`);
  if (!/^\d+$/.test(o.pr)) throw new UsageError(`bad pr number: ${o.pr}`);
  o.pr = Number(o.pr);
  if (cmd === 'facts') {
    for (const k of ['mergeSha', 'base', 'parents']) {
      if (o[k] !== undefined) throw new UsageError('facts takes only --repo, --pr, --checkout and --deploy-check');
    }
    return o;
  }
  if (o.deployCheck !== undefined) throw new UsageError('revert takes no --deploy-check');
  need('mergeSha', '--merge-sha');
  need('base', '--base');
  need('parents', '--parents');
  if (!SHA_RE.test(o.mergeSha)) throw new UsageError(`bad merge sha: ${o.mergeSha}`);
  if (!REF_RE.test(o.base) || o.base.includes('..')) throw new UsageError(`bad base ref: ${o.base}`);
  if (!['1', '2'].includes(o.parents)) throw new UsageError('--parents must be 1 or 2');
  o.parents = Number(o.parents);
  return o;
}

export function main(argv, deps = makeDeps()) {
  const o = parseArgs(argv);
  return o.cmd === 'facts' ? cmdFacts(o, deps) : cmdRevert(o, deps);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const out = main(process.argv.slice(2));
    console.log(JSON.stringify(out));
    if (out.error) process.exit(1);
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`usage error: ${e.message}`);
      process.exit(2);
    }
    console.error(`post-merge failed: ${redact(e?.stderr || e?.message || e)}`);
    process.exit(1);
  }
}
