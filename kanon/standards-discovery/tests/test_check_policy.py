import contextlib
import importlib.util
import io
import json
import os
import shutil
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
    data = content if isinstance(content, bytes) else content.encode("utf-8")
    with open(path, "wb") as handle:
        handle.write(data)


def record(name):
    with open(os.path.join(RECORDS, name), encoding="utf-8") as handle:
        return cp.parse_frontmatter(handle.read())


def fields(blocking):
    return [b["field"] for b in blocking]


class TempDirs(unittest.TestCase):
    def tmp(self):
        path = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, path, True)
        return path

    def origin_repo(self, kanon_yml=None):
        repo = self.tmp()
        git(repo, "init", "-q", "-b", "main")
        put(repo, "README.md", "hello\n")
        if kanon_yml is not None:
            put(repo, ".ai/kanon.yml", kanon_yml)
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "init")
        git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
        return repo


class RecordCheck(TempDirs):
    def test_missing_record_stops_on_record(self):
        out = io.StringIO()
        gone = os.path.join(self.tmp(), "nope.md")
        with contextlib.redirect_stdout(out):
            code = cp.main(["--record", gone, "--repo", self.tmp(), "--model", "claude-opus-5-5"])
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


class ClientDetection(TempDirs):
    def test_no_file_and_no_entry_is_not_a_client(self):
        repo = self.origin_repo()
        self.assertEqual(cp.client_record({}, "o/r", repo), ("canon-first", None, []))

    def test_registry_wins_over_an_absent_file(self):
        repo = self.origin_repo()
        self.assertEqual(cp.client_record({"o/r": "/x.md"}, "o/r", repo), ("canon-first", "/x.md", []))

    def test_registry_names_match_without_regard_to_case(self):
        repo = self.origin_repo()
        self.assertEqual(cp.client_record({"Acme/Shop": "/x.md"}, "acme/shop", repo), ("canon-first", "/x.md", []))
        self.assertEqual(cp.client_record({"acme/shop": "/x.md"}, "Acme/Shop", repo), ("canon-first", "/x.md", []))

    def test_a_record_path_in_the_registry_expands_the_home_folder(self):
        repo = self.origin_repo()
        path = cp.client_record({"o/r": "~/x.md"}, "o/r", repo)[1]
        self.assertEqual(path, os.path.expanduser("~/x.md"))
        self.assertFalse(path.startswith("~"))

    def test_project_first_without_an_entry_stops_on_record(self):
        repo = self.origin_repo("mode: project-first\n")
        mode, rec, blocking = cp.client_record({"other/repo": "/x.md"}, "o/r", repo)
        self.assertEqual((mode, rec), ("project-first", None))
        self.assertEqual(blocking, [{"field": "record", "reason": "missing, no registry entry"}])

    def test_project_first_with_an_entry_uses_it(self):
        repo = self.origin_repo("# overlay\nmode: project-first\n")
        self.assertEqual(cp.client_record({"o/r": "/x.md"}, "o/r", repo), ("project-first", "/x.md", []))

    def test_bad_mode_stops_on_mode(self):
        repo = self.origin_repo("mode: fast\n")
        blocking = cp.client_record({}, "o/r", repo)[2]
        self.assertEqual(fields(blocking), ["mode"])
        self.assertTrue(blocking[0]["reason"].startswith("not an allowed value"))

    def test_file_without_a_mode_key_is_canon_first(self):
        repo = self.origin_repo("rules: []\n")
        self.assertEqual(cp.client_record({}, "o/r", repo), ("canon-first", None, []))

    def test_a_byte_order_mark_does_not_hide_the_mode(self):
        repo = self.origin_repo("\ufeffmode: project-first\n")
        self.assertEqual(cp.client_record({}, "o/r", repo)[0:2], ("project-first", None))

    def test_yaml_spellings_of_the_mode_key(self):
        for line in ("mode : project-first", '"mode": project-first', "'mode': project-first"):
            with self.subTest(line):
                repo = self.origin_repo(line + "\n")
                mode, rec, blocking = cp.client_record({}, "o/r", repo)
                self.assertEqual((mode, rec), ("project-first", None))
                self.assertEqual(fields(blocking), ["record"])

    def test_a_nested_mode_key_is_not_the_mode(self):
        repo = self.origin_repo("rules:\n  mode: project-first\n")
        self.assertEqual(cp.client_record({}, "o/r", repo), ("canon-first", None, []))

    def test_a_tag_named_origin_main_does_not_shadow_the_remote_ref(self):
        repo = self.origin_repo()
        git(repo, "tag", "origin/main")
        put(repo, ".ai/kanon.yml", "mode: project-first\n")
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "overlay")
        git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
        mode, rec, blocking = cp.client_record({}, "o/r", repo)
        self.assertEqual((mode, rec), ("project-first", None))
        self.assertEqual(fields(blocking), ["record"])

    def test_a_worktree_without_the_file_still_reads_origin_main(self):
        repo = self.tmp()
        git(repo, "init", "-q", "-b", "main")
        put(repo, "README.md", "hello\n")
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "before")
        git(repo, "branch", "run")
        put(repo, ".ai/kanon.yml", "mode: project-first\n")
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "overlay")
        git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
        worktree = os.path.join(self.tmp(), "run")
        git(repo, "worktree", "add", "-q", worktree, "run")
        self.assertFalse(os.path.exists(os.path.join(worktree, ".ai")))
        self.assertEqual(cp.client_record({}, "o/r", worktree)[0:2], ("project-first", None))
        put(repo, ".ai/kanon.yml", "mode: canon-first\n")
        self.assertEqual(cp.client_record({}, "o/r", repo)[0], "project-first")

    def test_a_folder_that_is_not_a_repo_stops_on_mode(self):
        blocking = cp.client_record({}, "o/r", self.tmp())[2]
        self.assertEqual(fields(blocking), ["mode"])
        self.assertTrue(blocking[0]["reason"].startswith("unreadable"))

    def test_a_subfolder_of_a_project_first_repo_stops_on_mode(self):
        repo = self.origin_repo("mode: project-first\n")
        sub = os.path.join(repo, "app")
        os.makedirs(sub)
        blocking = cp.client_record({}, "o/r", sub)[2]
        self.assertEqual(fields(blocking), ["mode"])
        self.assertIn("top level", blocking[0]["reason"])

    def test_a_plain_folder_inside_another_repo_stops_on_mode(self):
        repo = self.origin_repo()
        plain = os.path.join(repo, "plain")
        os.makedirs(plain)
        blocking = cp.client_record({}, "o/r", plain)[2]
        self.assertEqual(fields(blocking), ["mode"])
        self.assertIn("top level", blocking[0]["reason"])

    def test_the_kanon_file_is_looked_up_from_the_tree_root_not_the_folder(self):
        repo = self.origin_repo("mode: project-first\n")
        sub = os.path.join(repo, "app")
        os.makedirs(sub)
        self.assertEqual(cp.kanon_yml_at(sub), "mode: project-first\n")

    def test_a_repo_given_through_a_symlink_is_still_the_top_level(self):
        repo = self.origin_repo("mode: project-first\n")
        link = os.path.join(self.tmp(), "link")
        os.symlink(repo, link)
        mode, rec, blocking = cp.client_record({}, "o/r", link)
        self.assertEqual((mode, rec, fields(blocking)), ("project-first", None, ["record"]))

    def test_a_repo_without_origin_main_stops_on_mode(self):
        repo = self.tmp()
        git(repo, "init", "-q", "-b", "main")
        self.assertEqual(fields(cp.client_record({}, "o/r", repo)[2]), ["mode"])


class Scan(TempDirs):
    def repo_with_policy_files(self):
        repo = self.tmp()
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

    def test_scan_reads_every_listed_form_and_nothing_else(self):
        repo = self.tmp()
        put(repo, ".cursorignore", "build/\n")
        put(repo, "CONTRIBUTING", "Copilot is fine.\n")
        put(repo, "README.txt", "Intro.\n")
        put(repo, ".github/CONTRIBUTING.md", "LLMs are welcome.\n")
        put(repo, "docs/contributing.rst", "Intro.\n")
        for outside in ("src/README.md", ".github/workflows/CONTRIBUTING.md", "docs/guide/CONTRIBUTING.md", "NOTES.md"):
            put(repo, outside, "AI\n")
        with opened_files() as paths:
            warnings = cp.scan(repo)
        listed = [
            ".cursorignore",
            "CONTRIBUTING",
            os.path.join(".github", "CONTRIBUTING.md"),
            "README.txt",
            os.path.join("docs", "contributing.rst"),
        ]
        self.assertEqual(under(paths, repo), sorted(listed))
        self.assertEqual(
            sorted((w["file"], w["signal"]) for w in warnings),
            sorted([
                (".cursorignore", "ignore-file"),
                ("CONTRIBUTING", "ai-clause"),
                (os.path.join(".github", "CONTRIBUTING.md"), "ai-clause"),
            ]),
        )

    def test_a_dotted_abbreviation_is_an_ai_clause(self):
        repo = self.tmp()
        put(repo, "README.md", "Use of A.I. tools is banned.\n")
        self.assertEqual(
            cp.scan(repo),
            [{"file": "README.md", "line": 1, "signal": "ai-clause", "text": "Use of A.I. tools is banned."}],
        )

    def test_a_policy_name_that_is_not_a_regular_file_is_unreadable(self):
        repo = self.tmp()
        put(repo, "README/inner.md", "AI\n")
        os.mkdir(os.path.join(repo, ".aiignore"))
        with opened_files() as paths:
            warnings = cp.scan(repo)
        self.assertEqual(
            sorted((w["file"], w["signal"]) for w in warnings),
            [(".aiignore", "unreadable"), ("README", "unreadable")],
        )
        self.assertEqual(under(paths, repo), [])

    @unittest.skipIf(os.geteuid() == 0, "root ignores file modes")
    def test_a_file_or_folder_that_cannot_be_read_is_unreadable(self):
        repo = self.tmp()
        put(repo, "README.md", "AI\n")
        put(repo, "docs/CONTRIBUTING.md", "AI\n")
        for rel in ("README.md", "docs"):
            os.chmod(os.path.join(repo, rel), 0)
            self.addCleanup(os.chmod, os.path.join(repo, rel), 0o755)
        self.assertEqual(
            sorted((w["file"], w["signal"]) for w in cp.scan(repo)),
            [("README.md", "unreadable"), ("docs", "unreadable")],
        )

    def test_a_symlinked_policy_file_is_not_opened(self):
        repo = self.tmp()
        put(repo, "app/x.php", "<?php // AI\n")
        os.symlink(os.path.join("app", "x.php"), os.path.join(repo, "README.md"))
        with opened_files() as paths:
            warnings = cp.scan(repo)
        self.assertEqual(warnings, [{"file": "README.md", "signal": "symlink"}])
        self.assertEqual(under(paths, repo), [])

    def test_a_symlinked_docs_folder_is_not_listed(self):
        repo = self.tmp()
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


class Cli(TempDirs):
    def run_cli(self, *args, env=None):
        env = {**GIT_ENV, **(env or {})}
        proc = subprocess.run([sys.executable, SCRIPT, *args], capture_output=True, text=True, env=env)
        try:
            out = json.loads(proc.stdout)
        except ValueError:
            out = None
        return proc.returncode, out, proc.stderr

    def test_exit_codes(self):
        repo = self.origin_repo()
        put(repo, "README.md", "Uses AI.\n")
        common = ["--repo", repo, "--model", "claude-opus-5-5"]
        allowing = os.path.join(RECORDS, "allowing.md")
        registry_dir = self.tmp()
        registry = os.path.join(registry_dir, "ai-policy.json")

        with self.subTest("allowing record continues"):
            code, out, _ = self.run_cli("--record", allowing, *common)
            self.assertEqual((code, out["result"]), (0, "continue"))
            self.assertEqual(out["blocking"], [])
            self.assertEqual(out["warnings"][0]["signal"], "ai-clause")

        with self.subTest("forbidding record stops"):
            code, out, _ = self.run_cli("--record", os.path.join(RECORDS, "forbidding.md"), *common)
            self.assertEqual((code, out["result"]), (1, "stop"))
            self.assertEqual(fields(out["blocking"]), ["ai_allowed", "code_leaves_machine"])

        with self.subTest("factory-run step stops on commit_ai_files"):
            code, out, _ = self.run_cli("--record", allowing, "--step", "factory-run", *common)
            self.assertEqual((code, out["result"]), (1, "stop"))
            self.assertEqual(fields(out["blocking"]), ["commit_ai_files"])

        with self.subTest("empty registry is not a client"):
            put(registry_dir, "ai-policy.json", "{}")
            code, out, _ = self.run_cli("--registry", registry, "--repo-name", "o/r", *common)
            self.assertEqual((code, out["result"], out["mode"]), (0, "not-client", "canon-first"))
            self.assertEqual(out["warnings"], [])

        with self.subTest("registry entry runs the record"):
            put(registry_dir, "ai-policy.json", json.dumps({"o/r": allowing}))
            code, out, _ = self.run_cli("--registry", registry, "--repo-name", "o/r", "--step", "factory-run", *common)
            self.assertEqual((code, out["result"]), (1, "stop"))
            self.assertEqual(fields(out["blocking"]), ["commit_ai_files"])

        with self.subTest("a folder that is not a repo stops on mode"):
            code, out, _ = self.run_cli(
                "--registry", registry, "--repo-name", "o/r", "--repo", self.tmp(), "--model", "m"
            )
            self.assertEqual((code, out["result"], fields(out["blocking"])), (1, "stop", ["mode"]))

    def test_a_kanon_yml_that_is_not_utf8_stops_on_mode(self):
        repo = self.origin_repo(b"mode: \xff\xfe\n")
        registry_dir = self.tmp()
        put(registry_dir, "ai-policy.json", "{}")
        code, out, _ = self.run_cli(
            "--registry", os.path.join(registry_dir, "ai-policy.json"), "--repo-name", "o/r",
            "--repo", repo, "--model", "m",
        )
        self.assertEqual((code, fields(out["blocking"])), (1, ["mode"]))
        self.assertTrue(out["blocking"][0]["reason"].startswith("unreadable"))

    def test_tilde_paths_expand_to_the_home_folder(self):
        home = self.tmp()
        shutil.copy(os.path.join(RECORDS, "allowing.md"), os.path.join(home, "record.md"))
        put(home, "ai-policy.json", json.dumps({"o/r": "~/record.md"}))
        common = ["--repo", self.origin_repo(), "--model", "claude-opus-5-5"]
        for args in (("--record", "~/record.md"), ("--registry", "~/ai-policy.json", "--repo-name", "o/r")):
            with self.subTest(args[0]):
                code, out, _ = self.run_cli(*args, *common, env={"HOME": home})
                self.assertEqual((code, out["result"], out["blocking"]), (0, "continue", []))

    def test_usage_errors_exit_2(self):
        common = ["--repo", self.tmp(), "--model", "m"]
        record_path = os.path.join(RECORDS, "allowing.md")
        self.assertEqual(self.run_cli("--record", record_path, "--registry", "r.json", "--repo-name", "o/r", *common)[0], 2)
        self.assertEqual(self.run_cli(*common)[0], 2)
        self.assertEqual(self.run_cli("--registry", "r.json", *common)[0], 2)

    def test_a_repo_that_is_not_a_directory_exits_2(self):
        record_path = os.path.join(RECORDS, "allowing.md")
        for repo in (os.path.join(self.tmp(), "missing"), record_path):
            with self.subTest(repo):
                self.assertEqual(self.run_cli("--record", record_path, "--repo", repo, "--model", "m")[0], 2)

    def test_unreadable_registry_stops_on_record(self):
        directory = self.tmp()
        put(directory, "ai-policy.json", "[1]")
        code, out, _ = self.run_cli(
            "--registry", os.path.join(directory, "ai-policy.json"), "--repo-name", "o/r",
            "--repo", self.origin_repo(), "--model", "m",
        )
        self.assertEqual((code, fields(out["blocking"])), (1, ["record"]))
        self.assertIn("mode", out)
        self.assertIsNone(out["mode"])


if __name__ == "__main__":
    unittest.main()
