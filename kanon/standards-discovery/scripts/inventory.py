#!/usr/bin/env python3
"""List what the discovery pass may read in a client's repo.

  inventory.py --policy <policy.json> --repo <dir>

--policy is the JSON that check-policy.py printed on `continue`. One JSON object on stdout.
Exit 0 for `inventory` and `no-code`, 1 for `stop`, 2 for bad usage.

The universe is the tracked files (`git ls-files`), never a folder walk. Paths the client's ignore
files cover, symlinks and submodules appear in no list. The script reads through git only and runs
no command that writes: every call is `git --no-optional-locks`. Stdlib only.
"""
import argparse
import collections
import json
import os
import re
import subprocess
import sys

IGNORE_FILES = (".aiignore", ".cursorignore")
DROPPED_FOLDERS = ("vendor", "node_modules")
SYMLINK, GITLINK = "120000", "160000"

_DOCS_TEXT = r"(\.(md|markdown|rst|txt))?"
SOURCE_KINDS = {
    "instructions": [
        r"(.*/)?CLAUDE\.md", r"(.*/)?AGENTS\.md", r"\.cursor/rules/.*", r"\.cursorrules", r"\.github/copilot-instructions\.md",
    ],
    "docs": [
        rf"(?i)readme{_DOCS_TEXT}", rf"(?i)(\.github/|docs/)?contributing{_DOCS_TEXT}", r"docs/.*\.(md|markdown|rst|txt)",
    ],
    "linters": [
        r"(.*/)?\.php-cs-fixer(\.dist)?\.php", r"(.*/)?pint\.json", r"(.*/)?\.?phpcs\.xml(\.dist)?",
        r"(.*/)?phpstan(\.dist)?\.neon(\.dist)?", r"(.*/)?deptrac\.ya?ml", r"(.*/)?phparkitect\.php", r"(.*/)?rector\.php",
        r"(.*/)?eslint\.config\.(js|mjs|cjs|ts|mts|cts)", r"(.*/)?\.eslintrc(\.(js|cjs|json|ya?ml))?",
    ],
    "ci": [r"\.github/workflows/.*\.ya?ml", r"\.gitlab-ci\.yml", r"bitbucket-pipelines\.yml", r"Jenkinsfile"],
    "scripts": [r"(.*/)?composer\.json", r"(.*/)?package\.json"],
    "pr_templates": [
        r"(?i)(\.github/|docs/)?pull_request_template\.md", r"(?i)\.github/pull_request_template/.*\.md",
    ],
}
SOURCE_RE = {kind: [re.compile(p) for p in patterns] for kind, patterns in SOURCE_KINDS.items()}
CODE_FILE = re.compile(r".*\.(php|js|jsx|ts|tsx|mjs|cjs|vue|py|rb|go|java|kt|cs|rs)")
CONFIG_FILE = re.compile(r".*\.config\.[a-z]+")


class Stop(Exception):
    pass


def git(repo, *args):
    """Run a read-only git command in repo. Returns the CompletedProcess."""
    return subprocess.run(
        ["git", "--no-optional-locks", "-c", "core.fsmonitor=false", "-C", repo, *args], capture_output=True,
    )


def _text(proc):
    return proc.stdout.decode("utf-8", "replace")


def _names(proc):
    return [name for name in _text(proc).split("\0") if name]


def ignore_patterns(policy):
    """The patterns of every ignore-file warning. Raises Stop when an ignore file was not read."""
    patterns = []
    for warning in policy.get("warnings", []):
        if warning.get("file") in IGNORE_FILES and warning.get("signal") in ("symlink", "unreadable"):
            raise Stop(f"{warning['file']} was not read ({warning['signal']}), so the ignore patterns are unknown")
        if warning.get("signal") == "ignore-file":
            patterns.extend(warning.get("patterns", []))
    return patterns


def ignored_by(repo, patterns):
    """The tracked paths that git's own matcher says the patterns cover."""
    if not patterns:
        return set()
    args = ["ls-files", "-z", "-c", "-i"]
    for pattern in patterns:
        args += ["-x", pattern]
    proc = git(repo, *args)
    if proc.returncode != 0:
        raise Stop(f"git ls-files failed: {proc.stderr.decode('utf-8', 'replace').strip()}")
    return set(_names(proc))


def tracked_files(repo):
    """Regular tracked files, without links and submodules and without vendor folders."""
    proc = git(repo, "ls-files", "-z", "-s")
    if proc.returncode != 0:
        raise Stop(f"git ls-files failed: {proc.stderr.decode('utf-8', 'replace').strip()}")
    paths = set()
    for entry in _text(proc).split("\0"):
        if not entry:
            continue
        meta, _, path = entry.partition("\t")
        if meta.split()[0] in (SYMLINK, GITLINK):
            continue
        if set(path.split("/")) & set(DROPPED_FOLDERS):
            continue
        paths.add(path)
    return sorted(paths)


def classify(files):
    return {kind: sorted(f for f in files if any(p.fullmatch(f) for p in patterns)) for kind, patterns in SOURCE_RE.items()}


def sibling_kind(path):
    stem = path.rsplit("/", 1)[-1].removesuffix(".php")
    last_word = re.search(r"[A-Z][a-z0-9]+$", stem)
    return last_word.group(0) if last_word else stem


def siblings(repo, php_files):
    """Up to 3 PHP files per class kind, the most recently committed first."""
    order = _names(git(repo, "log", "--format=", "--name-only", "-z"))
    rank = {}
    for index, name in enumerate(order):
        rank.setdefault(name, index)
    kinds = collections.defaultdict(list)
    for path in php_files:
        kinds[sibling_kind(path)].append(path)
    return {kind: sorted(paths, key=lambda p: (rank.get(p, len(order)), p))[:3] for kind, paths in sorted(kinds.items())}


def branches(repo):
    names = []
    for ref in _text(git(repo, "for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes")).splitlines():
        if ref.endswith("/HEAD"):
            continue
        names.append(ref.removeprefix("refs/heads/").removeprefix("refs/remotes/"))
    return sorted(names)


def build(repo, policy):
    """The inventory for repo. Raises Stop when the policy or the tree says not to read."""
    patterns = ignore_patterns(policy)
    if git(repo, "rev-parse", "--git-dir").returncode != 0:
        raise Stop(f"{repo} is not a git repo")
    head_proc = git(repo, "rev-parse", "--verify", "-q", "HEAD^{commit}")
    read_at = _text(head_proc).strip() or None
    universe = tracked_files(repo)
    ignored = ignored_by(repo, patterns)
    files = [f for f in universe if f not in ignored]
    if read_at is None and files:
        raise Stop("the branch has no commit, so there is nothing to read at a commit")
    sources = classify(files)
    code = [f for f in files if CODE_FILE.fullmatch(f) and not CONFIG_FILE.fullmatch(f.rsplit("/", 1)[-1]) and f not in sources["linters"]]
    php = [f for f in code if f.endswith(".php")]
    sib = siblings(repo, php) if read_at else {}
    listed = {p for paths in sources.values() for p in paths} | {p for paths in sib.values() for p in paths}
    if read_at:
        differs = set(_names(git(repo, "diff", "--name-only", "-z", "HEAD")))
        dirty = sorted(listed & differs)
        if dirty:
            raise Stop("these files differ from HEAD, and the checker reads the commit: " + ", ".join(dirty))
    rule_sources = sources["instructions"] + sources["linters"] + [
        f for f in sources["docs"] if f.startswith("docs/") or "contributing" in f.lower()
    ]
    return {
        "result": "inventory" if code or rule_sources else "no-code",
        "read_at": read_at,
        "ignored": sorted(ignored & set(universe)),
        "sources": sources,
        "code_files": len(code),
        "siblings": sib,
        "commit_subjects": _text(git(repo, "log", "-50", "--format=%s")).splitlines() if read_at else [],
        "branches": branches(repo),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="List what the discovery pass may read in a client's repo.")
    parser.add_argument("--policy", required=True, help="the JSON check-policy.py printed")
    parser.add_argument("--repo", required=True)
    args = parser.parse_args(argv)
    if not os.path.isdir(args.repo):
        parser.error(f"--repo is not a directory: {args.repo}")
    try:
        try:
            with open(args.policy, encoding="utf-8") as handle:
                policy = json.load(handle)
        except (OSError, ValueError) as error:
            raise Stop(f"cannot read the policy JSON: {error}")
        if not isinstance(policy, dict) or policy.get("result") != "continue":
            raise Stop("the policy check did not say continue")
        result = build(args.repo, policy)
    except Stop as stop:
        print(json.dumps({"result": "stop", "reason": str(stop)}, indent=2))
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
