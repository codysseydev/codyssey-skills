#!/usr/bin/env python3
"""List what the discovery pass may read in a client's repo.

  inventory.py --policy <policy.json> --repo <dir>

--policy is the JSON that check-policy.py printed on `continue`. One JSON object on stdout.
Exit 0 for `inventory` and `no-code`, 1 for `stop`, 2 for bad usage.

The universe is the tree of the `read_at` commit, never a folder walk. Paths the client's ignore
files cover, symlinks and submodules appear in no list. The ignore files are read from `read_at`
through git, never from policy.json, and a working-tree copy that differs stops the run. A listed
file whose working-tree bytes differ from `read_at` stops it too. The script never reads the repo's
index (reading a split index changes the mtime of its shared file) and runs no command that writes
in the repo: every call is `git --no-optional-locks`, with hooks, fsmonitor and the split index
turned off. Stdlib only.
"""
import argparse
import collections
import importlib.util
import json
import os
import re
import stat
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
IGNORE_FILES = (".aiignore", ".cursorignore")
DROPPED_FOLDERS = ("vendor", "node_modules")
SYMLINK, GITLINK = "120000", "160000"
REGULAR = ("100644", "100755")
NOT_A_FILE = {SYMLINK: "symlink", GITLINK: "gitlink", "040000": "folder"}
GIT_CONFIG = (
    "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "core.splitIndex=false",
    "-c", "log.showSignature=false",
)

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


def git(repo, *args, index=None, input=None):
    """The one git runner of the three scripts. Returns the CompletedProcess.

    It drops every GIT_* variable of the caller, so no outside GIT_DIR, GIT_INDEX_FILE or config
    reaches git, and sets GIT_INDEX_FILE only when index is given. Replace refs and lazy fetches
    from a promisor remote are off, and the client's hooks, fsmonitor, split index and signature
    checks (which run gpg.program) never run.
    """
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env.update(GIT_NO_REPLACE_OBJECTS="1", GIT_NO_LAZY_FETCH="1")
    if index:
        env["GIT_INDEX_FILE"] = index
    return subprocess.run(["git", "--no-optional-locks", *GIT_CONFIG, "-C", repo, *args], capture_output=True, env=env, input=input)


def require_top_level(repo):
    """Raises Stop unless repo is the top level of a git work tree. Every path in the output is relative to it."""
    spec = importlib.util.spec_from_file_location("check_policy", os.path.join(HERE, "check-policy.py"))
    policy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(policy)
    try:
        policy.require_top_level(repo)
    except RuntimeError as error:
        raise Stop(str(error))


def _text(proc):
    return proc.stdout.decode("utf-8", "replace")


def _names(proc):
    return [name for name in _text(proc).split("\0") if name]


def ignore_files_at(repo, sha):
    """{name: bytes} of the root ignore files at sha, names matched without regard to case.

    Raises Stop when one is a symlink, a folder or a gitlink, or cannot be read: its patterns are unknown.
    """
    listed = git(repo, "ls-tree", "-z", "--full-tree", sha)
    if listed.returncode != 0:
        raise Stop(f"cannot list the tree of {sha}")
    found = {}
    for entry in _names(listed):
        meta, _, name = entry.partition("\t")
        mode, _, oid = meta.split()
        if name.casefold() not in IGNORE_FILES:
            continue
        if mode not in REGULAR:
            kind = NOT_A_FILE.get(mode, f"mode {mode}")
            raise Stop(f"{name} at {sha[:7]} is a {kind}, not a regular file, so the ignore patterns are unknown")
        shown = git(repo, "cat-file", "blob", oid)
        if shown.returncode != 0:
            raise Stop(f"cannot read {name} at {sha[:7]}, so the ignore patterns are unknown")
        found[name] = shown.stdout
    return found


def require_same_ignore_files(repo, committed):
    """Raises Stop when a root ignore file in the working tree differs from the committed one, or exists on one side only."""
    try:
        names = [name for name in os.listdir(repo) if name.casefold() in IGNORE_FILES]
        on_disk = {}
        for name in names:
            path = os.path.join(repo, name)
            if stat.S_ISREG(os.lstat(path).st_mode):
                with open(path, "rb") as handle:
                    on_disk[name] = handle.read()
            else:
                on_disk[name] = None
    except OSError as error:
        raise Stop(f"cannot read the ignore files in the working tree: {error}")
    differ = sorted(name for name in set(on_disk) | set(committed) if on_disk.get(name) is None or on_disk[name] != committed.get(name))
    if differ:
        raise Stop(", ".join(differ) + " in the working tree differs from read_at. Commit or restore it, then rerun")


def ignored_paths(repo, sha, committed):
    """Every path in the tree of sha that an ignore file at sha covers.

    Each file is matched in its own git run and the results are joined, so a `!` line in one file
    cannot bring back a path the other hides.
    """
    ignored = set()
    for blob in committed.values():
        ignored |= ignored_by(repo, blob, sha)
    return ignored


def ignored_by(repo, blob, sha):
    """The paths of the tree of sha that an ignore file holding blob covers, by git's own matcher.

    git reads the bytes as it reads any ignore file (a BOM, comments, escaped spaces), from a copy
    outside the repo. The tree is read into a temporary index there too; the repo's index is never read.
    """
    with tempfile.TemporaryDirectory(prefix="ignored-by-") as scratch:
        patterns = os.path.join(scratch, "patterns")
        with open(patterns, "wb") as handle:
            handle.write(blob)
        index = os.path.join(scratch, "index")
        if git(repo, "read-tree", sha, index=index).returncode != 0:
            raise Stop(f"cannot read the tree of {sha}")
        proc = git(repo, "ls-files", "-z", "-c", "-i", f"--exclude-from={patterns}", index=index)
    if proc.returncode != 0:
        raise Stop(f"git ls-files failed: {proc.stderr.decode('utf-8', 'replace').strip()}")
    return set(_names(proc))


def tracked_files(repo, sha):
    """The regular files in the tree of sha, without links and submodules and without vendor folders."""
    proc = git(repo, "ls-tree", "-r", "-z", "--full-tree", sha)
    if proc.returncode != 0:
        raise Stop(f"git ls-tree failed: {proc.stderr.decode('utf-8', 'replace').strip()}")
    paths = set()
    for entry in _names(proc):
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


def siblings(repo, php_files, sha):
    """Up to 3 PHP files per class kind, the most recently committed before sha first."""
    order = _names(git(repo, "log", "--format=", "--name-only", "-z", sha, "--"))
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


def listing(repo, sha, ignored):
    """What may be read at commit sha: {"tracked", "sources", "code", "siblings"}, ignored paths left out of all but tracked.

    check-overlay.py calls this too, so the paths a citation may name never come from inventory.json.
    """
    tracked = tracked_files(repo, sha)
    files = [f for f in tracked if f not in ignored]
    sources = classify(files)
    code = [f for f in files if CODE_FILE.fullmatch(f) and not CONFIG_FILE.fullmatch(f.rsplit("/", 1)[-1]) and f not in sources["linters"]]
    php = [f for f in code if f.endswith(".php")]
    return {"tracked": tracked, "sources": sources, "code": code, "siblings": siblings(repo, php, sha)}


def listed_paths(found):
    """The paths the agent may read: every source and every sibling."""
    return {p for paths in found["sources"].values() for p in paths} | {p for paths in found["siblings"].values() for p in paths}


def differs_from(repo, sha, path):
    """True when the working-tree file at path is not a regular file with the bytes path has at sha.

    A symlink at path or at a folder above it counts as different, so the agent never reads through one.
    """
    here = repo
    for part in path.split("/"):
        here = os.path.join(here, part)
        if os.path.islink(here):
            return True
    shown = git(repo, "cat-file", "blob", f"{sha}:{path}")
    try:
        if not stat.S_ISREG(os.lstat(here).st_mode):
            return True
        with open(here, "rb") as handle:
            return shown.returncode != 0 or handle.read() != shown.stdout
    except OSError:
        return True


EMPTY = {"tracked": [], "sources": {kind: [] for kind in SOURCE_KINDS}, "code": [], "siblings": {}}


def build(repo):
    """The inventory for repo. Raises Stop when the tree says not to read."""
    require_top_level(repo)
    head_proc = git(repo, "rev-parse", "--verify", "-q", "HEAD^{commit}")
    read_at = _text(head_proc).strip() or None
    if read_at is None:
        if any(name != ".git" for name in os.listdir(repo)):
            raise Stop("the branch has no commit, so there is nothing to read at a commit")
        found, ignored = EMPTY, set()
    else:
        committed = ignore_files_at(repo, read_at)
        require_same_ignore_files(repo, committed)
        ignored = ignored_paths(repo, read_at, committed)
        found = listing(repo, read_at, ignored)
        dirty = [path for path in sorted(listed_paths(found)) if differs_from(repo, read_at, path)]
        if dirty:
            raise Stop("these files differ from HEAD, and the checker reads the commit: " + ", ".join(dirty))
    sources = found["sources"]
    rule_sources = sources["instructions"] + sources["linters"] + [
        f for f in sources["docs"] if f.startswith("docs/") or "contributing" in f.lower()
    ]
    return {
        "result": "inventory" if found["code"] or rule_sources else "no-code",
        "read_at": read_at,
        "ignored": sorted(ignored & set(found["tracked"])),
        "sources": sources,
        "code_files": len(found["code"]),
        "siblings": found["siblings"],
        "commit_subjects": _text(git(repo, "log", "-50", "--format=%s", read_at, "--")).splitlines() if read_at else [],
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
        result = build(args.repo)
    except Stop as stop:
        print(json.dumps({"result": "stop", "reason": str(stop)}, indent=2))
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
