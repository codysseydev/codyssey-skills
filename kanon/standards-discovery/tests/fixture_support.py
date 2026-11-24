"""Shared helpers for the discovery tests: the fixture client repo, the work folder, a snapshot."""
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
SCRIPTS = os.path.join(SKILL, "scripts")
REPO_ROOT = os.path.dirname(os.path.dirname(SKILL))
FIXTURES = os.path.join(HERE, "fixtures")
CLIENT = os.path.join(FIXTURES, "client")
EXPECTED = os.path.join(FIXTURES, "expected")
RECORDS = os.path.join(FIXTURES, "records")
RECORDS_DISCOVERY = os.path.join(FIXTURES, "records-discovery")
MODEL = "claude-opus-5-5"

GIT_ENV = {
    **os.environ,
    "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_AUTHOR_NAME": "t",
    "GIT_AUTHOR_EMAIL": "t@example.com",
    "GIT_COMMITTER_NAME": "t",
    "GIT_COMMITTER_EMAIL": "t@example.com",
}


def load_script(name):
    """Load a script from scripts/ by path. Raises FileNotFoundError when the script is missing."""
    path = os.path.join(SCRIPTS, name)
    spec = importlib.util.spec_from_file_location(name.replace("-", "_").removesuffix(".py"), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def git(cwd, *args):
    return subprocess.run(
        ["git", *args], cwd=cwd, env=GIT_ENV, check=True, capture_output=True, text=True
    ).stdout.strip()


def put(root, rel, content=""):
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = content if isinstance(content, bytes) else content.encode("utf-8")
    with open(path, "wb") as handle:
        handle.write(data)


def read(root, rel):
    with open(os.path.join(root, rel), encoding="utf-8") as handle:
        return handle.read()


def run_script(name, *args, cwd=None):
    """Run scripts/<name> as a command. Returns (exit code, stdout, stderr)."""
    done = subprocess.run(
        [sys.executable, os.path.join(SCRIPTS, name), *args],
        cwd=cwd, env=GIT_ENV, capture_output=True, text=True,
    )
    return done.returncode, done.stdout, done.stderr


def run_json(name, *args, cwd=None):
    code, out, err = run_script(name, *args, cwd=cwd)
    try:
        return code, json.loads(out)
    except ValueError:
        raise AssertionError(f"{name} printed no JSON (exit {code}): {out!r} {err!r}")


def snapshot(root):
    """Every file under root, .git included: bytes (or link target) and mtime, plus every folder."""
    seen = {}
    for folder, dirs, files in os.walk(root):
        for name in dirs:
            seen[os.path.relpath(os.path.join(folder, name), root) + "/"] = None
        for name in files:
            path = os.path.join(folder, name)
            stat = os.lstat(path)
            if os.path.islink(path):
                content = "link:" + os.readlink(path)
            else:
                with open(path, "rb") as handle:
                    content = hashlib.sha256(handle.read()).hexdigest()
            seen[os.path.relpath(path, root)] = (content, stat.st_mtime_ns)
    return seen


def build_client(dest):
    """The fixture repo in dest: three commits, a feature branch, CLAUDE.fixture.md as CLAUDE.md.

    Returns {"read_at", "commit_2"}. The rename keeps a second CLAUDE.md out of this repo's tree.
    """
    shutil.copytree(CLIENT, dest)
    os.rename(os.path.join(dest, "CLAUDE.fixture.md"), os.path.join(dest, "CLAUDE.md"))
    git(dest, "init", "-q", "-b", "main")
    setup = ["CLAUDE.md", ".php-cs-fixer.dist.php", "composer.json", ".aiignore", "app/Legacy/OldBilling.php"]
    handlers = ["app/Orders/CreateOrderHandler.php", "app/Orders/CancelOrderHandler.php"]
    rest = ["app/Http/Controllers/OrderController.php", "tests/Orders/CreateOrderHandlerTest.php"]
    shas = []
    for paths, subject in (
        (setup, "chore: project setup"),
        (handlers, "feat(orders): create and cancel handlers"),
        (rest, "feat(orders): order handlers"),
    ):
        git(dest, "add", "--", *paths)
        git(dest, "commit", "-q", "-m", subject)
        shas.append(git(dest, "rev-parse", "HEAD"))
    git(dest, "branch", "feature/ORD-12-cancel-refund")
    return {"read_at": shas[2], "commit_2": shas[1][:10]}


def make_work(client, dest, record, repo):
    """A work folder for the fixture client: the expected files with their placeholders filled,
    and policy.json written by the real policy check."""
    shutil.copytree(EXPECTED, dest)
    text = read(dest, "standards-report.md").replace("READ_AT", client["read_at"]).replace("COMMIT_2", client["commit_2"])
    put(dest, "standards-report.md", text)
    code, out, err = run_script("check-policy.py", "--record", record, "--repo", repo, "--model", MODEL)
    assert code == 0, (out, err)
    put(dest, "policy.json", out)
    return dest


class TempDirs(unittest.TestCase):
    def tmp(self):
        path = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, path, True)
        return path

    def client(self):
        repo = os.path.join(self.tmp(), "client")
        info = build_client(repo)
        return repo, info

    def work_for(self, repo, info, record=None):
        record = record or os.path.join(RECORDS, "allowing.md")
        return make_work(info, os.path.join(self.tmp(), "work"), record, repo)
