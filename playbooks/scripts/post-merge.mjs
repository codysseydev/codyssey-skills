// Post-merge helper for the factory's archive stage: read the facts about a merged PR, or open
// a revert branch for it.
//
// Usage:
//   node post-merge.mjs facts  --repo <owner/name> --pr <n> --checkout <path> --verified-sha <sha> [--deploy-check '<name>']
//   node post-merge.mjs revert --repo <owner/name> --pr <n> --checkout <path> --merge-sha <sha> --base <ref>
//
// facts prints one JSON object: {merged, merge_sha, head_sha, head_matches_verified, merged_at, base,
// title, parents, merge_method, tree_equals_head, deploy}. head_sha is the PR head at merge time.
// --verified-sha is the head the factory run verified (at least 7 hex characters), and
// tree_equals_head is true only when the merge commit's tree equals that commit's tree.
// merge_method is merge (two parents), squash, or rebase (one parent, more than one PR commit, and a
// subject that does not end with ` (#<n>)`). `deploy` is null without --deploy-check, else
// {name, state, completed_at} with state success, failure, pending, not_exercised or none. facts
// only fetches into the checkout. It never changes its working tree, index or branch.
//
// revert makes a temporary worktree from origin/<base>, creates branch factory/revert-<n>, runs
// `git revert --no-edit` (with `-m 1` for a merge commit), pushes the branch with `-u origin`,
// and removes the worktree, temp dir and local branch in every case. It prints {branch, head_sha}.
// It prints {error} and exits 1 on a rebase merge, when the branch already exists on origin, on a
// revert conflict (after `git revert --abort`) and on a failed push.
//
// The script never reads or prints a token: git uses the checkout's own remote and credentials,
// and any `user:secret@` in an error message is redacted.
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

// owner/name with no `..` and no segment that starts with `-`.
export const validRepo = (r) =>
  REPO_RE.test(r) && r.split('/').every((seg) => !seg.startsWith('-') && seg !== '.' && !seg.includes('..'));

// ---------- pure logic ----------

// One check run -> 'success' | 'failure' | 'pending' | 'not_exercised'. A run that has not
// completed is pending. Only success is success, and only failure and timed_out are red. Any other
// conclusion (cancelled, stale, skipped, neutral, action_required, startup_failure) says nothing
// about the code, so it is not exercised.
export function checkRunState(run) {
  if (run.status !== 'completed') return 'pending';
  if (run.conclusion === 'success') return 'success';
  return ['failure', 'timed_out'].includes(run.conclusion) ? 'failure' : 'not_exercised';
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

// Whether two shas name the same commit, comparing prefixes in both directions.
// Both need at least 7 hex characters.
export function shaMatches(a, b) {
  const x = String(a ?? '').toLowerCase();
  const y = String(b ?? '').toLowerCase();
  if (x.length < 7 || y.length < 7 || !/^[0-9a-f]+$/.test(x + y)) return false;
  return x.startsWith(y) || y.startsWith(x);
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

function countPrCommits(gh, repo, pr) {
  const out = gh(['api', '--paginate', '--slurp', `repos/${repo}/pulls/${pr}/commits?per_page=100`]);
  return JSON.parse(out || '[]').flat().length;
}

// 'merge' for two parents. For one parent: 'rebase' when the PR had more than one commit and the
// commit subject lacks the ` (#<n>)` suffix GitHub adds to a squash, else 'squash'.
export function mergeMethod({ gh, git, repo, pr, checkout, mergeSha, parents }) {
  if (parents >= 2) return 'merge';
  if (parents !== 1) return null;
  if (countPrCommits(gh, repo, pr) <= 1) return 'squash';
  const subject = git(['-C', checkout, 'log', '-1', '--format=%s', mergeSha]).trim();
  return subject.endsWith(` (#${pr})`) ? 'squash' : 'rebase';
}

// ---------- commands ----------

export function cmdFacts({ repo, pr, checkout, verifiedSha, deployCheck }, { gh, git }) {
  const p = JSON.parse(gh(['api', `repos/${repo}/pulls/${pr}`]));
  const base = {
    merged: Boolean(p.merged),
    merge_sha: p.merge_commit_sha ?? null,
    head_sha: p.head?.sha ?? null,
    head_matches_verified: null,
    merged_at: p.merged_at ?? null,
    base: p.base?.ref ?? null,
    title: p.title ?? null,
    parents: null,
    merge_method: null,
    tree_equals_head: null,
    deploy: deployCheck ? { name: deployCheck, state: 'none', completed_at: null } : null,
  };
  if (!base.merged || !base.merge_sha) return { ...base, merged: false };

  // Fetch only. Remote-tracking refs and FETCH_HEAD change, the working tree and branch do not.
  git(['-C', checkout, 'fetch', '-q', 'origin']);
  if (!hasCommit(git, checkout, base.head_sha) || !hasCommit(git, checkout, verifiedSha)) {
    tryGit(git, ['-C', checkout, 'fetch', '-q', 'origin', `pull/${pr}/head`]);
  }
  const treeOf = (sha) => {
    const r = tryGit(git, ['-C', checkout, 'rev-parse', '--verify', '-q', `${sha}^{tree}`]);
    return r.ok ? r.out.trim() : null;
  };
  const parents = countParents(git(['-C', checkout, 'rev-list', '--parents', '-n', '1', base.merge_sha]));
  const mergeTree = treeOf(base.merge_sha);
  const verifiedTree = treeOf(verifiedSha);
  const result = {
    ...base,
    head_matches_verified: shaMatches(base.head_sha, verifiedSha),
    parents,
    merge_method: mergeMethod({ gh, git, repo, pr, checkout, mergeSha: base.merge_sha, parents }),
    // A verified sha that cannot be resolved never counts as equal, so the gates run.
    tree_equals_head: mergeTree !== null && verifiedTree !== null && mergeTree === verifiedTree,
  };
  if (deployCheck) result.deploy = deployFromCheckRuns(readChecks(gh, repo, base.merge_sha), deployCheck);
  return result;
}

const why = (e) => e?.stderr || e?.message || e;
const failure = (message) => ({ error: redact(message) });

export function cmdRevert({ repo, pr, checkout, mergeSha, base }, { gh, git }) {
  const branch = `factory/revert-${pr}`;
  try {
    git(['-C', checkout, 'fetch', '-q', 'origin']);
    if (git(['-C', checkout, 'ls-remote', '--heads', 'origin', branch]).trim()) {
      return failure(`${branch} already exists on origin; delete it or revert by hand`);
    }
    const parents = countParents(git(['-C', checkout, 'rev-list', '--parents', '-n', '1', mergeSha]));
    if (parents < 1 || parents > 2) return failure(`merge commit has ${parents} parents; revert by hand`);
    if (mergeMethod({ gh, git, repo, pr, checkout, mergeSha, parents }) === 'rebase') {
      return failure('rebase merge, revert by hand');
    }
    return revertInWorktree({ git, checkout, branch, base, mergeSha, parents });
  } catch (e) {
    return failure(`revert could not start: ${why(e)}`);
  }
}

function revertInWorktree({ git, checkout, branch, base, mergeSha, parents }) {
  const tmp = mkdtempSync(join(tmpdir(), 'factory-revert-'));
  const wt = join(tmp, 'wt');
  try {
    try {
      git(['-C', checkout, 'worktree', 'add', '-q', '-B', branch, wt, `origin/${base}`]);
    } catch (e) {
      return failure(`could not prepare the revert worktree: ${why(e)}`);
    }
    const reverted = tryGit(git, ['-C', wt, 'revert', '--no-edit', ...(parents === 2 ? ['-m', '1'] : []), mergeSha]);
    if (!reverted.ok) {
      tryGit(git, ['-C', wt, 'revert', '--abort']);
      return failure(`git revert failed: ${why(reverted.error)}`);
    }
    const headSha = git(['-C', wt, 'rev-parse', 'HEAD']).trim();
    const pushed = tryGit(git, ['-C', wt, 'push', '-q', '-u', 'origin', branch]);
    if (!pushed.ok) return failure(`git push failed: ${why(pushed.error)}`);
    return { branch, head_sha: headSha };
  } finally {
    // Always remove the worktree, the temp dir and the local branch. A pushed branch stays on origin.
    tryGit(git, ['-C', checkout, 'worktree', 'remove', '--force', wt]);
    rmSync(tmp, { recursive: true, force: true });
    tryGit(git, ['-C', checkout, 'worktree', 'prune']);
    tryGit(git, ['-C', checkout, 'branch', '-D', branch]);
  }
}

// ---------- CLI ----------

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!['facts', 'revert'].includes(cmd)) throw new UsageError('command must be facts or revert');
  const o = { cmd };
  const flags = {
    '--repo': 'repo', '--pr': 'pr', '--checkout': 'checkout', '--deploy-check': 'deployCheck',
    '--merge-sha': 'mergeSha', '--base': 'base', '--verified-sha': 'verifiedSha',
  };
  for (let i = 0; i < rest.length; i++) {
    const key = flags[rest[i]];
    if (!key) throw new UsageError(`unknown flag: ${rest[i]}`);
    if (i + 1 >= rest.length) throw new UsageError(`${rest[i]} needs a value`);
    const value = rest[++i];
    if (value.startsWith('-')) throw new UsageError(`${rest[i - 1]} value must not start with -`);
    o[key] = value;
  }
  const need = (k, flag) => {
    if (o[k] === undefined || o[k] === '') throw new UsageError(`${flag} is required`);
  };
  need('repo', '--repo');
  need('pr', '--pr');
  need('checkout', '--checkout');
  if (!validRepo(o.repo)) throw new UsageError(`bad repo: ${o.repo}`);
  if (!/^\d+$/.test(o.pr)) throw new UsageError(`bad pr number: ${o.pr}`);
  o.pr = Number(o.pr);
  if (cmd === 'facts') {
    for (const k of ['mergeSha', 'base']) {
      if (o[k] !== undefined) throw new UsageError('facts takes only --repo, --pr, --checkout, --verified-sha and --deploy-check');
    }
    need('verifiedSha', '--verified-sha');
    if (!SHA_RE.test(o.verifiedSha)) throw new UsageError(`bad verified sha: ${o.verifiedSha}`);
    return o;
  }
  if (o.deployCheck !== undefined || o.verifiedSha !== undefined) {
    throw new UsageError('revert takes no --deploy-check or --verified-sha');
  }
  need('mergeSha', '--merge-sha');
  need('base', '--base');
  if (!SHA_RE.test(o.mergeSha)) throw new UsageError(`bad merge sha: ${o.mergeSha}`);
  if (!REF_RE.test(o.base) || o.base.includes('..')) throw new UsageError(`bad base ref: ${o.base}`);
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
