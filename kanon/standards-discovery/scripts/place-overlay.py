#!/usr/bin/env python3
"""Place the checked report and overlay where the AI policy record allows.

  place-overlay.py place --record <file> --model <id> --work <dir> --repo <client repo>
                         [--tool claude-code] [--branch <name>] [--subject <text>]
  place-overlay.py load  --record <file> --model <id> --work <dir> --repo <client repo> [--tool claude-code]

Both re-run the `read-code` policy check on the record and the overlay check on the work folder,
and stop on any blocking field or problem without writing anything.

place, commit_ai_files yes: one commit on a new branch of the client repo. Its parent is the `Read at`
  commit of the checked report, and it is built with git plumbing on a temporary index, so the owner's
  checkout keeps its index, branch, HEAD and uncommitted files, and no hook runs. The commit holds
  .ai/kanon.yml, .ai/rules/project/*.md and .ai/standards-report.md. A symlink, file or gitlink where
  .ai, its folders or a target sits at `Read at` stops the run.
place, commit_ai_files no: writes nothing under the repo, .git included. The files stay in the work folder.
load, commit_ai_files no: copies .ai/kanon.yml and .ai/rules/project/ into the working tree and adds
  two lines to info/exclude, so git status stays empty. Stops when a target path is committed at HEAD.

One JSON object on stdout. Exit 0 on success, 1 on `stop`, a failed git command or a file error, 2 for bad usage.
Stdlib only.
"""
import argparse
import datetime
import importlib.util
import json
import os
import shlex
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
OVERLAY = ".ai/kanon.yml"
RULES_DIR = ".ai/rules/project"
REPORT_IN_WORK, REPORT_IN_REPO = "standards-report.md", ".ai/standards-report.md"
EXCLUDE_LINES = ["/.ai/kanon.yml", "/.ai/rules/project/"]
DEFAULT_SUBJECT = "docs(ai): project overlay from standards-discovery"


class GitError(Exception):
    pass


def _sibling(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_").removesuffix(".py"), os.path.join(HERE, name))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


inventory = _sibling("inventory.py")


def git(cwd, *args, check=True, index=None, input=None):
    """inventory.git, raising GitError on a failed command unless check is False."""
    done = inventory.git(cwd, *args, index=index, input=input)
    if check and done.returncode != 0:
        raise GitError(f"git {args[0]} failed: " + done.stderr.decode("utf-8", "replace").strip())
    return done


def text_of(done):
    return done.stdout.decode("utf-8", "replace").strip()


def emit(result, code):
    print(json.dumps(result, indent=2))
    return code


def stop(**fields):
    return emit({"result": "stop", **fields}, 1)


def files_to_place(work):
    """[(path in the repo, path in the work folder)]: the overlay, each prose rule file, the report."""
    files = [(OVERLAY, os.path.join(work, OVERLAY))]
    rules = os.path.join(work, RULES_DIR)
    for name in sorted(os.listdir(rules)) if os.path.isdir(rules) else []:
        if name.endswith(".md"):
            files.append((f"{RULES_DIR}/{name}", os.path.join(rules, name)))
    files.append((REPORT_IN_REPO, os.path.join(work, REPORT_IN_WORK)))
    return files


def read_bytes(path):
    with open(path, "rb") as handle:
        return handle.read()


# ---------- place ----------

FOLDERS = (".ai", ".ai/rules", RULES_DIR)


def mode_at(repo, sha, path):
    """The git mode of path in the tree of sha, or None when it is absent."""
    listed = git(repo, "ls-tree", "-z", "--full-tree", sha, "--", path).stdout.decode("utf-8", "replace")
    for entry in listed.split("\0"):
        meta, _, name = entry.partition("\t")
        if name == path:
            return meta.split()[0]
    return None


def in_the_way_at(repo, sha, files):
    """Why the files cannot be added to the tree of sha without --replace, or None.

    The folders on the way must be absent or folders, and each file absent or a regular file.
    """
    kinds = {"120000": "symlink", "160000": "gitlink", "040000": "folder"}
    for path in FOLDERS:
        mode = mode_at(repo, sha, path)
        if mode not in (None, "040000"):
            return f"{path} is a {kinds.get(mode, 'file')} at {sha[:7]}, not a folder"
    for rel, _ in files:
        mode = mode_at(repo, sha, rel)
        if mode not in (None, "100644", "100755"):
            return f"{rel} is a {kinds.get(mode, 'file of mode ' + mode)} at {sha[:7]}, not a regular file"
    return None


def place_on_branch(repo, work, branch, subject, read_at):
    """One commit on a new branch, parent read_at, made with plumbing on a temporary index.

    Nothing touches the owner's index, working tree or HEAD, and no hook runs.
    """
    files = files_to_place(work)
    exists = git(repo, "rev-parse", "--verify", "-q", f"refs/heads/{branch}", check=False).returncode == 0
    if exists:
        same = all(
            (shown := git(repo, "cat-file", "blob", f"refs/heads/{branch}:{rel}", check=False)).returncode == 0
            and shown.stdout == read_bytes(src)
            for rel, src in files
        )
        if same:
            return emit({"result": "already-placed", "branch": branch}, 0)
        return stop(reason=f"branch {branch} exists with other content; pass --branch to use another name")
    blocked = in_the_way_at(repo, read_at, files)
    if blocked:
        return stop(reason=blocked)
    with tempfile.TemporaryDirectory(prefix="standards-discovery-") as scratch:
        index = os.path.join(scratch, "index")
        git(repo, "read-tree", read_at, index=index)
        for rel, src in files:
            blob = text_of(git(repo, "hash-object", "-w", "--no-filters", "--stdin", input=read_bytes(src)))
            git(repo, "update-index", "--add", "--cacheinfo", f"100644,{blob},{rel}", index=index)
        tree = text_of(git(repo, "write-tree", index=index))
        listed = git(repo, "diff-tree", "-r", "-z", "--no-renames", "--name-only", read_at, tree, index=index)
    changed = {p for p in listed.stdout.decode("utf-8", "replace").split("\0") if p}
    if changed != {rel for rel, _ in files}:
        return stop(reason="the new tree differs from Read at in other paths than the placed files: " + ", ".join(sorted(changed ^ {rel for rel, _ in files})))
    sha = text_of(git(repo, "commit-tree", "--no-gpg-sign", tree, "-p", read_at, "-m", subject))
    git(repo, "update-ref", f"refs/heads/{branch}", sha, "")
    return emit(
        {
            "result": "placed", "branch": branch, "commit": sha, "parent": read_at, "files": [rel for rel, _ in files],
            "next": "ask the owner, then push the branch and open the pull request",
        },
        0,
    )


# ---------- load ----------

def _in_the_way(repo, rel):
    """True when rel, or a folder above it inside the repo, is a symlink, or a folder above it is not a folder."""
    path, parts = repo, rel.split("/")
    for depth, part in enumerate(parts, start=1):
        path = os.path.join(path, part)
        if os.path.islink(path) or (depth < len(parts) and os.path.lexists(path) and not os.path.isdir(path)):
            return True
    return False


def load_into_tree(repo, work):
    files = [(rel, src) for rel, src in files_to_place(work) if rel != REPORT_IN_REPO]
    head = git(repo, "rev-parse", "--verify", "-q", "HEAD^{commit}", check=False)
    listed = git(repo, "ls-tree", "-r", "-z", "--name-only", "--full-tree", "HEAD", "--", OVERLAY, RULES_DIR) if head.returncode == 0 else None
    tracked = [p for p in text_of(listed).split("\0") if p] if listed else []
    if tracked:
        return stop(reason="committed at HEAD, so loading would show as a change: " + ", ".join(tracked))
    blocked = [rel for rel, _ in files if _in_the_way(repo, rel)]
    if blocked:
        return stop(reason="a symlink or a file is in the way: " + ", ".join(blocked))
    differ = [
        rel for rel, src in files
        if os.path.lexists(os.path.join(repo, rel)) and (
            not os.path.isfile(os.path.join(repo, rel)) or read_bytes(os.path.join(repo, rel)) != read_bytes(src)
        )
    ]
    if differ:
        return stop(reason="already in the working tree with other content, so loading would overwrite it: " + ", ".join(differ))
    exclude = text_of(git(repo, "rev-parse", "--git-path", "info/exclude"))
    exclude = exclude if os.path.isabs(exclude) else os.path.join(repo, exclude)
    linked = [path for path in (os.path.dirname(exclude), exclude) if os.path.islink(path)]
    if linked:
        return stop(reason="a symlink is in the way of info/exclude, so loading could write outside the repo: " + ", ".join(linked))
    existing = open(exclude, encoding="utf-8").read() if os.path.exists(exclude) else ""
    missing = [line for line in EXCLUDE_LINES if line not in existing.splitlines()]
    if missing:
        os.makedirs(os.path.dirname(exclude), exist_ok=True)
        with open(exclude, "a", encoding="utf-8") as handle:
            handle.write(("\n" if existing and not existing.endswith("\n") else "") + "".join(line + "\n" for line in missing))
    for rel, src in files:
        target = os.path.join(repo, rel)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copyfile(src, target)
    return emit({"result": "loaded", "exclude": exclude, "files": [rel for rel, _ in files]}, 0)


# ---------- the command ----------

def main(argv=None):
    parser = argparse.ArgumentParser(description="Place the checked report and overlay where the AI policy record allows.")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("place", "load"):
        sub = commands.add_parser(name)
        sub.add_argument("--record", required=True, help="the policy record")
        sub.add_argument("--model", required=True)
        sub.add_argument("--tool", default="claude-code")
        sub.add_argument("--work", required=True)
        sub.add_argument("--repo", required=True)
        sub.add_argument("--kanon-root")
        if name == "place":
            sub.add_argument("--branch")
            sub.add_argument("--subject", default=DEFAULT_SUBJECT)
    args = parser.parse_args(argv)
    for flag in ("work", "repo"):
        if not os.path.isdir(getattr(args, flag)):
            parser.error(f"--{flag} is not a directory: {getattr(args, flag)}")
    branch = None
    if args.command == "place":
        branch = args.branch or "standards-discovery/" + datetime.date.today().isoformat()
        if inventory.git(args.repo, "check-ref-format", f"refs/heads/{branch}").returncode != 0:
            parser.error(f"--branch is not a valid branch name: {branch}")

    try:
        return run(args, branch)
    except (GitError, OSError) as error:
        return emit({"result": "error", "reason": str(error)}, 1)


def run(args, branch):
    policy, overlay = _sibling("check-policy.py"), _sibling("check-overlay.py")
    try:
        with open(os.path.expanduser(args.record), encoding="utf-8") as handle:
            raw = policy.parse_frontmatter(handle.read())
    except FileNotFoundError:
        return stop(blocking=[{"field": "record", "reason": "missing"}])
    except (OSError, ValueError) as error:
        return stop(blocking=[{"field": "record", "reason": f"unreadable: {error}"}])
    blocking = policy.check(raw, "read-code", {"tool": args.tool, "model": args.model})
    if blocking:
        return stop(blocking=blocking)
    commit_ai_files = policy.FIELDS["commit_ai_files"][0](raw["commit_ai_files"])

    root = args.kanon_root or overlay.default_kanon_root(SKILL)
    if root is None:
        print("no kanon/catalog/families.json found: pass --kanon-root", file=sys.stderr)
        return 2
    problem = overlay.root_problem(root, args.work, args.repo) if args.kanon_root else None
    if problem:
        print(problem, file=sys.stderr)
        return 2
    try:
        inventory.require_top_level(args.repo)
    except inventory.Stop as error:
        return stop(reason=str(error))
    problems, read_at = overlay.check_work(args.work, args.repo, root)
    if problems:
        return stop(problems=problems)

    if args.command == "place":
        if commit_ai_files == "no":
            cmd = shlex.join([
                "python3", os.path.join(HERE, "place-overlay.py"), "load", "--record", args.record,
                "--model", args.model, "--work", args.work, "--repo", args.repo,
            ])
            return emit(
                {
                    "result": "kept-in-brain", "work": args.work,
                    "next": f"nothing was written under the repo. To use the overlay locally, run: {cmd}",
                },
                0,
            )
        return place_on_branch(args.repo, args.work, branch, args.subject, read_at)
    if commit_ai_files != "no":
        return stop(reason="the record says commit_ai_files: yes, so the overlay goes to a branch with `place`, not into the working tree")
    return load_into_tree(args.repo, args.work)


if __name__ == "__main__":
    sys.exit(main())
