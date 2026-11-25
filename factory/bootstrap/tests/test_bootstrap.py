import json, os, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "scripts", "bootstrap.py")

FAKE_BRAIN = '''
import argparse, os, subprocess
ap = argparse.ArgumentParser()
for a in ("name", "slug", "pitch", "target", "date"):
    ap.add_argument("--" + a)
a = ap.parse_args()
os.makedirs(os.path.join(a.target, "Architecture"))
open(os.path.join(a.target, ".gitignore"), "w").write("__pycache__/\\n")
open(os.path.join(a.target, "README.md"), "w").write(a.name + "\\n")
subprocess.run(["git", "init", "-q", "-b", "main"], cwd=a.target, check=True)
subprocess.run(["git", "add", "-A"], cwd=a.target, check=True)
subprocess.run(["git", "-c", "user.email=t@e.x", "-c", "user.name=t", "commit", "-q", "-m", "init"], cwd=a.target, check=True)
'''

FAKE_PACK = '''
import argparse, os, subprocess
ap = argparse.ArgumentParser()
for a in ("name", "slug", "pitch", "target", "date", "modules", "namespace"):
    ap.add_argument("--" + a)
ap.add_argument("--no-git", action="store_true")
a = ap.parse_args()
os.makedirs(os.path.join(a.target, ".factory"))
open(os.path.join(a.target, ".factory", "recipe.yml"), "w").write(
    "version: 1\\nchecks:\\n  - name: modules\\n    run: echo %s\\n" % (a.modules or "none"))
subprocess.run(["git", "init", "-q", "-b", "main"], cwd=a.target, check=True)
subprocess.run(["git", "add", "-A"], cwd=a.target, check=True)
subprocess.run(["git", "-c", "user.email=t@e.x", "-c", "user.name=t", "commit", "-q", "-m", "init"], cwd=a.target, check=True)
'''


def fake(tmp, name, body):
    d = os.path.join(tmp, name)
    os.makedirs(os.path.join(d, "scripts"))
    with open(os.path.join(d, "scripts", "new-brain.py" if name == "brain" else "new-repo.py"), "w") as f:
        f.write(body)
    return d


class BootstrapTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.brain_tpl = fake(self.tmp, "brain", FAKE_BRAIN)
        self.pack = fake(self.tmp, "pack", FAKE_PACK)
        self.root = os.path.join(self.tmp, "root")

    def run_it(self, *extra, slug="acme-app"):
        return subprocess.run([sys.executable, SCRIPT, "--name", "Acme App", "--slug", slug, "--pitch", "x",
                               "--modules", "Billing,Catalog", "--root", self.root, "--brain-template", self.brain_tpl,
                               "--pack", self.pack, *extra], capture_output=True, text=True)

    def test_creates_both_and_proves(self):
        p = self.run_it("--dry-run")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        report = json.loads(p.stdout)
        self.assertTrue(report["passed"] and report["evidence"]["passed"])
        self.assertEqual(report["evidence"]["steps"][0]["output_tail"].strip(), "Billing,Catalog")
        gi = open(os.path.join(self.root, "acme-app-docs", ".gitignore")).read()
        self.assertIn(".wb/", gi.split())
        product = open(os.path.join(self.root, "acme-app-docs", "Architecture", "event-model-generator", "product.py")).read()
        self.assertIn("'name': 'Acme App'", product)
        self.assertNotIn("Bike", product)
        j01 = open(os.path.join(self.root, "acme-app-docs", "Architecture", "event-model-generator", "j01.py")).read()
        self.assertIn("lanes=[], slices=[]", j01)
        self.assertIn("Acme App", j01)
        self.assertNotIn("bike", j01.lower())
        repo = os.path.join(self.root, "acme-app")
        playbook = open(os.path.join(repo, ".factory", "playbook.md")).read()
        self.assertEqual([l[3:] for l in playbook.splitlines() if l.startswith("## ")],
                         ["Checks", "Review", "Scaffolding", "Local setup", "Cleanup", "Notes", "Post-merge"])
        self.assertEqual(subprocess.run(["git", "status", "--porcelain"], cwd=repo, capture_output=True, text=True).stdout, "")
        repo_log = subprocess.run(["git", "log", "--format=%s"], cwd=repo, capture_output=True, text=True).stdout.splitlines()
        self.assertEqual(repo_log[0], "Add the factory project file")
        self.assertEqual(report["steps"][-2:], ["playbook written, checked and committed", "recipe proved from a clean clone"])
        self.assertEqual(report["playbook"]["added_sections"][0], "Checks")
        log = subprocess.run(["git", "log", "--oneline"], cwd=os.path.join(self.root, "acme-app-docs"),
                             capture_output=True, text=True).stdout
        self.assertIn("event model journey setup", log)

    def run_stack(self, env, *extra, slug="acme-app", root=None):
        return subprocess.run([sys.executable, SCRIPT, "--name", "Acme App", "--slug", slug, "--pitch", "x",
                               "--modules", "Billing", "--root", root or self.root, "--brain-template", self.brain_tpl,
                               "--dry-run", *extra], capture_output=True, text=True, env=env)

    def test_stack_picks_its_pack(self):
        laravel = fake(self.tmp, "laravel-pack", FAKE_PACK.replace("echo %s", "echo laravel-%s"))
        symfony = fake(self.tmp, "symfony-pack", FAKE_PACK.replace("echo %s", "echo symfony-%s"))
        env = dict(os.environ, FACTORY_LARAVEL_PACK=laravel, FACTORY_SYMFONY_PACK=symfony)
        for n, (extra, marker) in enumerate((
                (("--stack", "symfony"), "symfony-Billing"),
                (("--stack", "laravel"), "laravel-Billing"),
                ((), "laravel-Billing"))):
            with self.subTest(extra=extra):
                p = self.run_stack(env, *extra, root=os.path.join(self.tmp, f"root{n}"))
                self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
                report = json.loads(p.stdout)
                self.assertTrue(report["passed"])
                self.assertEqual(report["evidence"]["steps"][0]["output_tail"].strip(), marker)

    def test_unknown_stack_refused(self):
        p = self.run_stack(dict(os.environ), "--stack", "rails")
        self.assertEqual(p.returncode, 2)
        self.assertFalse(os.path.exists(os.path.join(self.root, "acme-app")))
        self.assertFalse(os.path.exists(os.path.join(self.root, "acme-app-docs")))

    def test_refuses_non_empty_target(self):
        os.makedirs(os.path.join(self.root, "acme-app"))
        open(os.path.join(self.root, "acme-app", "f"), "w").close()
        p = self.run_it()
        self.assertEqual(p.returncode, 2)
        self.assertIn("refusing", p.stderr)
        self.assertFalse(os.path.exists(os.path.join(self.root, "acme-app-docs")))

    def test_bad_slug_and_module(self):
        self.assertEqual(self.run_it(slug="Acme_App").returncode, 2)
        p = subprocess.run([sys.executable, SCRIPT, "--name", "A", "--slug", "a", "--pitch", "x", "--modules", "billing",
                            "--root", self.root], capture_output=True, text=True)
        self.assertEqual(p.returncode, 2)


if __name__ == "__main__":
    unittest.main()
