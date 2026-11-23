import contextlib
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "scripts", "check-policy.py")
RECORDS = os.path.join(HERE, "fixtures", "records")
spec = importlib.util.spec_from_file_location("check_policy", SCRIPT)
cp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cp)

CTX = {"tool": "claude-code", "model": "claude-opus-5-5"}
GIT_ENV = {
    **os.environ,
    "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_AUTHOR_NAME": "t",
    "GIT_AUTHOR_EMAIL": "t@example.com",
    "GIT_COMMITTER_NAME": "t",
    "GIT_COMMITTER_EMAIL": "t@example.com",
}

# sys.addaudithook cannot be removed, so one hook stays installed and records only while a
# test turns it on around the code under test.
_recording = {"on": False, "paths": []}


def _record_opens(event, args):
    if _recording["on"] and event == "open" and isinstance(args[0], (str, bytes)):
        _recording["paths"].append(os.fsdecode(args[0]))


sys.addaudithook(_record_opens)


@contextlib.contextmanager
def opened_files():
    _recording["paths"] = []
    _recording["on"] = True
    try:
        yield _recording["paths"]
    finally:
        _recording["on"] = False


def under(paths, root):
    return sorted(os.path.relpath(p, root) for p in paths if p.startswith(root + os.sep))


def git(cwd, *args):
    return subprocess.run(
        ["git", *args], cwd=cwd, env=GIT_ENV, check=True, capture_output=True, text=True
    ).stdout.strip()


def put(root, rel, content=""):
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(content)


def record(name):
    with open(os.path.join(RECORDS, name), encoding="utf-8") as handle:
        return cp.parse_frontmatter(handle.read())


def fields(blocking):
    return [b["field"] for b in blocking]


def make_origin_repo(kanon_yml=None):
    """A repo whose refs/remotes/origin/main holds .ai/kanon.yml (or not)."""
    repo = tempfile.mkdtemp()
    git(repo, "init", "-q", "-b", "main")
    put(repo, "README.md", "hello\n")
    if kanon_yml is not None:
        put(repo, ".ai/kanon.yml", kanon_yml)
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "init")
    git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
    return repo


class RecordCheck(unittest.TestCase):
    def test_missing_record_stops_on_record(self):
        out = io.StringIO()
        gone = os.path.join(tempfile.mkdtemp(), "nope.md")
        with contextlib.redirect_stdout(out):
            code = cp.main(["--record", gone, "--repo", tempfile.mkdtemp(), "--model", "claude-opus-5-5"])
        result = json.loads(out.getvalue())
        self.assertEqual(code, 1)
        self.assertEqual(result["blocking"], [{"field": "record", "reason": "missing"}])

    def test_forbidding_record_stops_and_names_the_field(self):
        blocking = cp.check(record("forbidding.md"), "read-code", CTX)
        self.assertEqual(fields(blocking), ["ai_allowed", "code_leaves_machine"])
        self.assertEqual(blocking[0]["reason"], "forbids read-code: no")

    def test_allowing_record_continues(self):
        self.assertEqual(cp.check(record("allowing.md"), "read-code", CTX), [])

    def test_incomplete_record_names_each_gap(self):
        blocking = cp.check(record("incomplete.md"), "read-code", CTX)
        self.assertEqual(fields(blocking), ["code_leaves_machine", "commit_ai_files", "retention"])
        self.assertTrue(blocking[0]["reason"].startswith("not an allowed value"))
        self.assertEqual(blocking[1]["reason"], "missing")
        self.assertEqual(blocking[2]["reason"], "missing")

    def test_each_fields_forbid_rule(self):
        base = {
            "ai_allowed": "yes",
            "tools": ["claude-code"],
            "models": ["claude"],
            "code_leaves_machine": "model-provider",
            "cloud_sessions": "yes",
            "commit_ai_files": "yes",
            "retention": "30d",
        }
        forbidding = {
            "ai_allowed": "no",
            "tools": ["gemini-cli"],
            "models": ["gpt"],
            "code_leaves_machine": "no",
            "cloud_sessions": "no",
            "commit_ai_files": "no",
            "retention": "none",
        }
        blocks = {
            "read-code": {"ai_allowed", "tools", "models", "code_leaves_machine"},
            "factory-run": {"ai_allowed", "tools", "models", "code_leaves_machine", "commit_ai_files"},
        }
        self.assertEqual(set(cp.FIELDS), set(base))
        self.assertEqual(set(cp.STEPS), set(blocks))
        for step in cp.STEPS:
            self.assertEqual(cp.check(base, step, CTX), [], step)
            for key in cp.FIELDS:
                got = fields(cp.check({**base, key: forbidding[key]}, step, CTX))
                self.assertEqual(got, [key] if key in blocks[step] else [], f"{step} {key}")

    def test_frontmatter_forms(self):
        parsed = cp.parse_frontmatter(
            "---\n# note\ntools: [a, 'b']\nmodels:\n  - c\n  - \"d\"\nai_allowed: TRUE\nretention: \"30d\"\n---\nbody: ignored\n"
        )
        self.assertEqual(parsed["tools"], ["a", "b"])
        self.assertEqual(parsed["models"], ["c", "d"])
        self.assertEqual(parsed["retention"], "30d")
        base = record("allowing.md")
        for yes in ("TRUE", "Yes", "true"):
            self.assertEqual(cp.check({**base, "ai_allowed": yes}, "read-code", CTX), [])
        for no in ("false", "No"):
            self.assertEqual(fields(cp.check({**base, "ai_allowed": no}, "read-code", CTX)), ["ai_allowed"])
        self.assertEqual(cp.check({**base, "tools": "claude-code"}, "read-code", CTX), [])
        for bad in (
            "---\nai_allowed: yes\nai_allowed: no\n---\n",
            "no frontmatter\n",
            "---\nnot a pair\n---\n",
            "---\nai_allowed: yes\n",
        ):
            with self.assertRaises(ValueError, msg=bad):
                cp.parse_frontmatter(bad)

    def test_model_prefix_match(self):
        base = record("allowing.md")

        def blocked(models, model="claude-opus-5-5"):
            ctx = {"tool": "claude-code", "model": model}
            return fields(cp.check({**base, "models": models}, "read-code", ctx))

        self.assertEqual(blocked(["claude"]), [])
        self.assertEqual(blocked(["claude-opus"]), [])
        self.assertEqual(blocked(["claude-opus-5-5"]), [])
        self.assertEqual(blocked(["claude-o"]), ["models"])
        self.assertEqual(blocked(["any"], "gpt-5"), [])
        self.assertEqual(blocked(["claude"], "gpt-5"), ["models"])

    def test_factory_run_blocks_on_commit_ai_files_no(self):
        allowing = record("allowing.md")
        self.assertEqual(cp.check(allowing, "read-code", CTX), [])
        blocking = cp.check(allowing, "factory-run", CTX)
        self.assertEqual(blocking, [{"field": "commit_ai_files", "reason": "forbids factory-run: no"}])


class ClientDetection(unittest.TestCase):
    def test_no_file_and_no_entry_is_not_a_client(self):
        repo = make_origin_repo()
        self.assertEqual(cp.client_record({}, "o/r", repo), ("canon-first", None, []))

    def test_registry_wins_over_an_absent_file(self):
        repo = make_origin_repo()
        self.assertEqual(cp.client_record({"o/r": "/x.md"}, "o/r", repo), ("canon-first", "/x.md", []))

    def test_project_first_without_an_entry_stops_on_record(self):
        repo = make_origin_repo("mode: project-first\n")
        mode, rec, blocking = cp.client_record({"other/repo": "/x.md"}, "o/r", repo)
        self.assertEqual((mode, rec), ("project-first", None))
        self.assertEqual(blocking, [{"field": "record", "reason": "missing, no registry entry"}])

    def test_project_first_with_an_entry_uses_it(self):
        repo = make_origin_repo("# overlay\nmode: project-first\n")
        self.assertEqual(cp.client_record({"o/r": "/x.md"}, "o/r", repo), ("project-first", "/x.md", []))

    def test_bad_mode_stops_on_mode(self):
        repo = make_origin_repo("mode: fast\n")
        blocking = cp.client_record({}, "o/r", repo)[2]
        self.assertEqual(fields(blocking), ["mode"])
        self.assertTrue(blocking[0]["reason"].startswith("not an allowed value"))

    def test_file_without_a_mode_key_is_canon_first(self):
        repo = make_origin_repo("rules: []\n")
        self.assertEqual(cp.client_record({}, "o/r", repo), ("canon-first", None, []))

    def test_a_worktree_without_the_file_still_reads_origin_main(self):
        repo = tempfile.mkdtemp()
        git(repo, "init", "-q", "-b", "main")
        put(repo, "README.md", "hello\n")
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "before")
        git(repo, "branch", "run")
        put(repo, ".ai/kanon.yml", "mode: project-first\n")
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "overlay")
        git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
        worktree = os.path.join(tempfile.mkdtemp(), "run")
        git(repo, "worktree", "add", "-q", worktree, "run")
        self.assertFalse(os.path.exists(os.path.join(worktree, ".ai")))
        self.assertEqual(cp.client_record({}, "o/r", worktree)[0:2], ("project-first", None))
        put(repo, ".ai/kanon.yml", "mode: canon-first\n")
        self.assertEqual(cp.client_record({}, "o/r", repo)[0], "project-first")

    def test_a_folder_that_is_not_a_repo_stops_on_mode(self):
        blocking = cp.client_record({}, "o/r", tempfile.mkdtemp())[2]
        self.assertEqual(fields(blocking), ["mode"])
        self.assertTrue(blocking[0]["reason"].startswith("unreadable"))

    def test_a_repo_without_origin_main_stops_on_mode(self):
        repo = tempfile.mkdtemp()
        git(repo, "init", "-q", "-b", "main")
        self.assertEqual(fields(cp.client_record({}, "o/r", repo)[2]), ["mode"])


class Scan(unittest.TestCase):
    def repo_with_policy_files(self):
        repo = tempfile.mkdtemp()
        put(repo, "README.md", "Intro.\nWe use AI tools here.\n")
        put(repo, ".aiignore", "# secrets\nsecrets/\n\n*.env\n")
        put(repo, "docs/CONTRIBUTING.md", "Do not paste code into ChatGPT.\n")
        put(repo, "docs/README.md", "AI in docs readme\n")
        put(repo, "app/Secret.php", "<?php // AI\n")
        put(repo, "composer.json", '{"description": "AI"}\n')
        return repo

    def test_scan_opens_only_the_policy_files(self):
        repo = self.repo_with_policy_files()
        with opened_files() as paths:
            cp.scan(repo)
        self.assertEqual(under(paths, repo), [".aiignore", "README.md", os.path.join("docs", "CONTRIBUTING.md")])

    def test_scan_warnings(self):
        repo = self.repo_with_policy_files()
        warnings = cp.scan(repo)
        self.assertIn({"file": ".aiignore", "signal": "ignore-file", "patterns": ["secrets/", "*.env"]}, warnings)
        self.assertIn({"file": "README.md", "line": 2, "signal": "ai-clause", "text": "We use AI tools here."}, warnings)
        self.assertIn(
            {
                "file": os.path.join("docs", "CONTRIBUTING.md"),
                "line": 1,
                "signal": "ai-clause",
                "text": "Do not paste code into ChatGPT.",
            },
            warnings,
        )
        self.assertEqual(len(warnings), 3)

    def test_a_symlinked_policy_file_is_not_opened(self):
        repo = tempfile.mkdtemp()
        put(repo, "app/x.php", "<?php // AI\n")
        os.symlink(os.path.join("app", "x.php"), os.path.join(repo, "README.md"))
        with opened_files() as paths:
            warnings = cp.scan(repo)
        self.assertEqual(warnings, [{"file": "README.md", "signal": "symlink"}])
        self.assertEqual(under(paths, repo), [])

    def test_a_symlinked_docs_folder_is_not_listed(self):
        repo = tempfile.mkdtemp()
        put(repo, "app/CONTRIBUTING.md", "AI\n")
        os.symlink("app", os.path.join(repo, "docs"))
        self.assertEqual(cp.scan(repo), [{"file": "docs", "signal": "symlink"}])

    def test_no_scan_on_a_stop(self):
        repo = self.repo_with_policy_files()
        out = io.StringIO()
        argv = ["--record", os.path.join(RECORDS, "forbidding.md"), "--repo", repo, "--model", "claude-opus-5-5"]
        with opened_files() as paths, contextlib.redirect_stdout(out):
            code = cp.main(argv)
        result = json.loads(out.getvalue())
        self.assertEqual(code, 1)
        self.assertEqual(result["warnings"], [])
        self.assertEqual(under(paths, repo), [])


class Cli(unittest.TestCase):
    def run_cli(self, *args):
        proc = subprocess.run([sys.executable, SCRIPT, *args], capture_output=True, text=True, env=GIT_ENV)
        try:
            out = json.loads(proc.stdout)
        except ValueError:
            out = None
        return proc.returncode, out, proc.stderr

    def test_exit_codes(self):
        repo = make_origin_repo()
        put(repo, "README.md", "Uses AI.\n")
        common = ["--repo", repo, "--model", "claude-opus-5-5"]

        code, out, _ = self.run_cli("--record", os.path.join(RECORDS, "allowing.md"), *common)
        self.assertEqual((code, out["result"]), (0, "continue"))
        self.assertEqual(out["blocking"], [])
        self.assertEqual(out["warnings"][0]["signal"], "ai-clause")

        code, out, _ = self.run_cli("--record", os.path.join(RECORDS, "forbidding.md"), *common)
        self.assertEqual((code, out["result"]), (1, "stop"))
        self.assertEqual(fields(out["blocking"]), ["ai_allowed", "code_leaves_machine"])

        code, out, _ = self.run_cli("--record", os.path.join(RECORDS, "allowing.md"), "--step", "factory-run", *common)
        self.assertEqual((code, out["result"]), (1, "stop"))
        self.assertEqual(fields(out["blocking"]), ["commit_ai_files"])

        registry_dir = tempfile.mkdtemp()
        registry = os.path.join(registry_dir, "ai-policy.json")
        put(registry_dir, "ai-policy.json", "{}")
        code, out, _ = self.run_cli("--registry", registry, "--repo-name", "o/r", *common)
        self.assertEqual((code, out["result"], out["mode"]), (0, "not-client", "canon-first"))
        self.assertEqual(out["warnings"], [])

        put(registry_dir, "ai-policy.json", json.dumps({"o/r": os.path.join(RECORDS, "allowing.md")}))
        code, out, _ = self.run_cli("--registry", registry, "--repo-name", "o/r", "--step", "factory-run", *common)
        self.assertEqual((code, out["result"]), (1, "stop"))
        self.assertEqual(fields(out["blocking"]), ["commit_ai_files"])

        code, out, _ = self.run_cli(
            "--registry", registry, "--repo-name", "o/r", "--repo", tempfile.mkdtemp(), "--model", "m"
        )
        self.assertEqual((code, out["result"], fields(out["blocking"])), (1, "stop", ["mode"]))

    def test_usage_errors_exit_2(self):
        common = ["--repo", tempfile.mkdtemp(), "--model", "m"]
        record_path = os.path.join(RECORDS, "allowing.md")
        self.assertEqual(self.run_cli("--record", record_path, "--registry", "r.json", "--repo-name", "o/r", *common)[0], 2)
        self.assertEqual(self.run_cli(*common)[0], 2)
        self.assertEqual(self.run_cli("--registry", "r.json", *common)[0], 2)

    def test_unreadable_registry_stops_on_record(self):
        directory = tempfile.mkdtemp()
        put(directory, "ai-policy.json", "[1]")
        code, out, _ = self.run_cli(
            "--registry", os.path.join(directory, "ai-policy.json"), "--repo-name", "o/r",
            "--repo", make_origin_repo(), "--model", "m",
        )
        self.assertEqual((code, fields(out["blocking"])), (1, ["record"]))


if __name__ == "__main__":
    unittest.main()
