import importlib.util, json, os, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "scripts", "prove-recipe.py")
spec = importlib.util.spec_from_file_location("prove_recipe", SCRIPT)
pr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pr)

GOOD = """version: 1
# comment
setup:
  - name: install
    run: echo setup > setup.txt
checks:
  - name: has-setup
    run: test -f setup.txt
  - name: quoted
    run: "echo 'hi there'"
teardown:
  - name: done
    run: echo teardown
"""


def make_repo(recipe, untracked=True):
    d = tempfile.mkdtemp()
    run = lambda *a: subprocess.run(a, cwd=d, check=True, capture_output=True)
    run("git", "init", "-q", "-b", "main")
    run("git", "config", "user.email", "t@example.com")
    run("git", "config", "user.name", "t")
    os.makedirs(os.path.join(d, ".factory"))
    with open(os.path.join(d, ".factory", "recipe.yml"), "w") as f:
        f.write(recipe)
    run("git", "add", "-A")
    run("git", "commit", "-q", "-m", "init")
    if untracked:
        with open(os.path.join(d, "untracked.txt"), "w") as f:
            f.write("x")
    return d


class ParserTest(unittest.TestCase):
    def test_good(self):
        r = pr.parse_recipe(GOOD)
        self.assertEqual([s["name"] for s in r["setup"]], ["install"])
        self.assertEqual(r["checks"][1]["run"], "echo 'hi there'")
        self.assertEqual(r["teardown"][0]["run"], "echo teardown")

    def test_empty_sections(self):
        r = pr.parse_recipe("version: 1\nsetup: []\nchecks:\n  - name: a\n    run: true\nteardown: []\n")
        self.assertEqual(r["setup"], [])

    def assertBad(self, text, fragment):
        with self.assertRaises(pr.RecipeError) as c:
            pr.parse_recipe(text)
        self.assertIn(fragment, str(c.exception))

    def test_errors(self):
        c = "checks:\n  - name: a\n    run: true\n"
        self.assertBad(c, "missing 'version: 1'")
        self.assertBad("version: 2\n" + c, "version must be 1")
        self.assertBad("version: 1\nsteps:\n", "unknown key")
        self.assertBad("version: 1\nchecks:\n  - name: a\n", "no run")
        self.assertBad("version: 1\nchecks:\n  - name: a\n    run: |\n      x\n", "plain or quoted")
        self.assertBad("version: 1\nchecks:\n  - name: a\n    run: true\n  - name: a\n    run: true\n", "duplicate")
        self.assertBad("version: 1\nchecks:\n  - name: a b\n    run: true\n", "must match")
        self.assertBad("version: 1\nchecks:\n  - name: a\n    run: true\n    env: x\n", "unexpected line")
        self.assertBad("version: 1\nchecks:\n\t- name: a\n", "tabs")
        self.assertBad("version: 1\nsetup: []\n", "at least one check")


class ProveTest(unittest.TestCase):
    def run_script(self, repo, *extra):
        out = os.path.join(repo, "..", os.path.basename(repo) + ".json")
        p = subprocess.run([sys.executable, SCRIPT, repo, "--out", out, *extra], capture_output=True, text=True)
        with open(out) as f:
            return p.returncode, json.load(f)

    def test_pass_uses_clean_copy(self):
        repo = make_repo(GOOD)
        code, ev = self.run_script(repo)
        self.assertEqual(code, 0, ev)
        self.assertTrue(ev["passed"] and ev["clean"])
        self.assertEqual([s["phase"] for s in ev["steps"]], ["setup", "checks", "checks", "teardown"])
        self.assertEqual(len(ev["head"]), 40)

    def test_untracked_file_not_in_copy(self):
        recipe = "version: 1\nchecks:\n  - name: no-untracked\n    run: test ! -e untracked.txt\n"
        code, ev = self.run_script(make_repo(recipe))
        self.assertEqual(code, 0, ev)

    def test_setup_failure_stops_and_teardown_runs(self):
        recipe = ("version: 1\nsetup:\n  - name: bad\n    run: 'false'\nchecks:\n  - name: c\n    run: true\n"
                  "teardown:\n  - name: t\n    run: echo bye\n")
        code, ev = self.run_script(make_repo(recipe))
        self.assertEqual(code, 1)
        self.assertEqual([s["name"] for s in ev["steps"]], ["bad", "t"])

    def test_check_failure_stops_unless_keep_going(self):
        recipe = ("version: 1\nchecks:\n  - name: a\n    run: 'false'\n  - name: b\n    run: echo b\n"
                  "teardown:\n  - name: t\n    run: echo t\n")
        code, ev = self.run_script(make_repo(recipe))
        self.assertEqual((code, [s["name"] for s in ev["steps"]]), (1, ["a", "t"]))
        code, ev = self.run_script(make_repo(recipe), "--keep-going")
        self.assertEqual((code, [s["name"] for s in ev["steps"]]), (1, ["a", "b", "t"]))
        self.assertIn("b", ev["steps"][1]["output_tail"])

    def test_uncommitted_recipe_is_refused(self):
        repo = make_repo(GOOD)
        subprocess.run(["git", "rm", "-q", "-r", ".factory"], cwd=repo, check=True)
        subprocess.run(["git", "commit", "-q", "-m", "rm"], cwd=repo, check=True)
        os.makedirs(os.path.join(repo, ".factory"))
        with open(os.path.join(repo, ".factory", "recipe.yml"), "w") as f:
            f.write(GOOD)
        code, ev = self.run_script(repo)
        self.assertEqual(code, 2)
        self.assertIn("not committed", ev["error"])

    def test_bad_recipe_exit_2(self):
        code, ev = self.run_script(make_repo("version: 1\nbogus: x\n"))
        self.assertEqual(code, 2)
        self.assertIn("unknown key", ev["error"])


if __name__ == "__main__":
    unittest.main()
