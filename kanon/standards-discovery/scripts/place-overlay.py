#!/usr/bin/env python3
"""Place the checked report and overlay where the AI policy record allows.

  place-overlay.py place --record <file> --model <id> --work <dir> --repo <client repo>
                         [--tool claude-code] [--branch <name>] [--subject <text>]
  place-overlay.py load  --record <file> --model <id> --work <dir> --repo <client repo> [--tool claude-code]

Both re-run the `read-code` policy check on the record and the overlay check on the work folder,
and stop on any blocking field or problem without writing anything.

place, commit_ai_files yes: one commit on a new branch of the client repo, made in a temporary
  worktree, so the owner's checkout keeps its branch, HEAD and uncommitted files. The commit holds
  .ai/kanon.yml, .ai/rules/project/*.md and .ai/standards-report.md.
place, commit_ai_files no: writes nothing under the repo, .git included. The files stay in the work folder.
load, commit_ai_files no: copies .ai/kanon.yml and .ai/rules/project/ into the working tree and adds
  two lines to info/exclude, so git status stays empty. Stops when a target path is tracked.

One JSON object on stdout. Exit 0 on success, 1 on `stop` or a failed git command, 2 for bad usage.
Stdlib only.
"""
import argparse
import datetime
import importlib.util
import json
import os
import shutil
import subprocess
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


def git(cwd, *args, check=True):
    """Run git in cwd. Raises GitError on a failed command unless check is False."""
    done = subprocess.run(
        ["git", "--no-optional-locks", "-c", "core.fsmonitor=false", "-C", cwd, *args], capture_output=True,
    )
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

def place_on_branch(repo, work, branch, subject):
    files = files_to_place(work)
    if git(repo, "rev-parse", "--verify", "-q", "HEAD^{commit}", check=False).returncode != 0:
        return stop(reason="the repo has no commit to branch from")
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
    scratch = tempfile.mkdtemp(prefix="standards-discovery-")
    tree = os.path.join(scratch, "tree")
    made = False
    try:
        git(repo, "worktree", "add", "-q", "-b", branch, tree, "HEAD")
        made = True
        for rel, src in files:
            target = os.path.join(tree, rel)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copyfile(src, target)
        git(tree, "add", "--", *[rel for rel, _ in files])
        git(tree, "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "commit", "-q", "--no-verify", "-m", subject)
        sha = text_of(git(tree, "rev-parse", "HEAD"))
        git(repo, "worktree", "remove", "--force", tree)
        made = False
    except GitError:
        if os.path.isdir(tree):
            git(repo, "worktree", "remove", "--force", tree, check=False)
        git(repo, "worktree", "prune", check=False)
        if made:
            git(repo, "branch", "-D", branch, check=False)
        raise
    finally:
        shutil.rmtree(scratch, ignore_errors=True)
    return emit(
        {
            "result": "placed", "branch": branch, "commit": sha, "files": [rel for rel, _ in files],
            "next": "ask the owner, then push the branch and open the pull request",
        },
        0,
    )


# ---------- load ----------

def _through_a_link(repo, rel):
    """True when rel, or a folder above it inside the repo, is a symlink."""
    path = repo
    for part in rel.split("/"):
        path = os.path.join(path, part)
        if os.path.islink(path):
            return True
    return False


def load_into_tree(repo, work):
    files = [(rel, src) for rel, src in files_to_place(work) if rel != REPORT_IN_REPO]
    tracked = [p for p in text_of(git(repo, "ls-files", "-z", "--", OVERLAY, RULES_DIR)).split("\0") if p]
    if tracked:
        return stop(reason="tracked in the repo, so loading would show as a change: " + ", ".join(tracked))
    linked = [rel for rel, _ in files if _through_a_link(repo, rel)]
    if linked:
        return stop(reason="a symlink is in the way: " + ", ".join(linked))
    exclude = text_of(git(repo, "rev-parse", "--git-path", "info/exclude"))
    exclude = exclude if os.path.isabs(exclude) else os.path.join(repo, exclude)
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
        if subprocess.run(["git", "check-ref-format", f"refs/heads/{branch}"], capture_output=True).returncode != 0:
            parser.error(f"--branch is not a valid branch name: {branch}")

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
    if root is None or not os.path.isfile(os.path.join(root, overlay.FAMILIES)):
        print("no kanon/catalog/families.json found: pass --kanon-root", file=sys.stderr)
        return 2
    problems = overlay.check_work(args.work, args.repo, root)
    if problems:
        return stop(problems=problems)

    try:
        if args.command == "place":
            if commit_ai_files == "no":
                cmd = f"python3 {os.path.join(HERE, 'place-overlay.py')} load --record {args.record} --model {args.model} --work {args.work} --repo {args.repo}"
                return emit(
                    {
                        "result": "kept-in-brain", "work": args.work,
                        "next": f"nothing was written under the repo. To use the overlay locally, run: {cmd}",
                    },
                    0,
                )
            return place_on_branch(args.repo, args.work, branch, args.subject)
        if commit_ai_files != "no":
            return stop(reason="the record says commit_ai_files: yes, so the overlay goes to a branch with `place`, not into the working tree")
        return load_into_tree(args.repo, args.work)
    except GitError as error:
        print(str(error), file=sys.stderr)
        return emit({"result": "error", "reason": str(error)}, 1)


if __name__ == "__main__":
    sys.exit(main())
