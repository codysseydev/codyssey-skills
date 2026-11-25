import importlib.util, json, os, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "scripts", "write-playbook.py")
SECTIONS = ["Checks", "Review", "Scaffolding", "Local setup", "Cleanup", "Notes", "Post-merge"]

RECIPE = """version: 1
setup:
  - name: install
    run: composer install --no-interaction
  - name: env
    run: cp .env.example .env
checks:
  - name: phpunit
    run: php artisan test
teardown:
  - name: down
    run: docker compose down
"""


def make_repo(files, folder=None):
    d = tempfile.mkdtemp()
    if folder:
        d = os.path.join(d, folder)
        os.makedirs(d)
    git = lambda *a: subprocess.run(["git", *a], cwd=d, check=True, capture_output=True)
    git("init", "-q", "-b", "main")
    for rel, content in files.items():
        path = os.path.join(d, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            f.write(content)
    return d


def run(repo, *extra):
    p = subprocess.run([sys.executable, SCRIPT, repo, *extra], capture_output=True, text=True)
    return p.returncode, (json.loads(p.stdout) if p.stdout.strip() else None), p.stderr


def read(repo):
    with open(os.path.join(repo, ".factory", "playbook.md")) as f:
        return f.read()


def section(text, name):
    parts = text.split(f"## {name}\n", 1)[1]
    return parts.split("\n## ", 1)[0].strip()


class FreshTest(unittest.TestCase):
    def test_with_recipe(self):
        repo = make_repo({
            ".factory/recipe.yml": RECIPE,
            "composer.json": json.dumps({"scripts": {"test": "@php artisan test", "pint": "pint --test",
                                                     "phpstan": "phpstan analyse", "post-autoload-dump": "x"}}),
            ".claude/skills/code-review/SKILL.md": "x",
            ".claude/skills/new-slice/SKILL.md": "x",
            ".claude/skills/other/SKILL.md": "x",
            ".claude/agents/acme-implementer.md": "x",
            ".ai/rules/a.md": "x",
        })
        code, out, _ = run(repo)
        self.assertEqual(code, 0)
        self.assertTrue(out["created"] and out["passed"])
        self.assertEqual(out["added_sections"], SECTIONS)
        text = read(repo)
        self.assertTrue(text.startswith("# Factory project file: " + os.path.basename(repo)))
        self.assertEqual([l[3:] for l in text.splitlines() if l.startswith("## ")], SECTIONS)
        checks = section(text, "Checks")
        self.assertIn("`.factory/recipe.yml`", checks.splitlines()[0])
        self.assertNotIn("composer test", checks)  # the recipe runs `php artisan test`, the script's body
        self.assertIn("| pint | `composer pint` |", checks)  # not in the recipe
        self.assertIn("| phpstan | `composer phpstan` |", checks)
        self.assertNotIn("post-autoload", checks)
        self.assertIn("`code-review`", section(text, "Review"))
        self.assertIn("`.ai/rules/`", section(text, "Review"))
        self.assertIn("`new-slice`", section(text, "Scaffolding"))
        self.assertIn(".claude/agents/acme-implementer.md", section(text, "Scaffolding"))
        self.assertIn("1. `install`: `composer install --no-interaction`", section(text, "Local setup"))
        self.assertIn("2. `env`: `cp .env.example .env`", section(text, "Local setup"))
        self.assertIn("1. `down`: `docker compose down`", section(text, "Cleanup"))
        self.assertEqual(section(text, "Notes"), "None yet.")
        post = section(text, "Post-merge")
        self.assertIn("archive run", post.splitlines()[0])
        self.assertEqual(post.splitlines()[-2:], ["- Deploy check: none", "- Sentry: none"])
        self.assertEqual(out["unresolved"], [])
        # nothing committed by the script
        self.assertIn("??", subprocess.run(["git", "status", "--short"], cwd=repo, capture_output=True, text=True).stdout)

    def test_recipe_covers_every_gate(self):
        repo = make_repo({".factory/recipe.yml": RECIPE, "composer.json": json.dumps({"scripts": {"test": "php artisan test"}})})
        run(repo)
        self.assertEqual(section(read(repo), "Checks").splitlines()[-1], "None yet.")

    def test_without_recipe_uses_table(self):
        repo = make_repo({
            "package.json": json.dumps({"scripts": {"lint": "eslint .", "analyse": "phpstan", "test:unit": "vitest", "dev": "vite",
                                                    "lint:fix": "eslint --fix .", "format": "prettier --write .", "build": "vite build"}}),
            "pnpm-lock.yaml": "",
        })
        code, out, _ = run(repo)
        self.assertEqual(code, 0)
        text = read(repo)
        checks = section(text, "Checks")
        self.assertIn("| Gate | Command |", checks)
        self.assertIn("| lint | `pnpm lint` |", checks)
        self.assertIn("| test:unit | `pnpm test:unit` |", checks)
        self.assertIn("| build | `pnpm build` |", checks)
        self.assertIn("| analyse | `pnpm analyse` |", checks)
        self.assertNotIn("dev", checks)
        self.assertNotIn("lint:fix", checks)
        self.assertNotIn("format", checks)
        for name in ("Review", "Scaffolding", "Local setup", "Cleanup", "Notes"):
            self.assertEqual(section(text, name), "None yet.")

    def test_cs_script_is_a_gate_and_cs_fix_is_not(self):
        repo = make_repo({"composer.json": json.dumps({"scripts": {"cs": "php-cs-fixer fix --dry-run --diff", "cs-fix": "php-cs-fixer fix"}})})
        code, out, _ = run(repo)
        self.assertEqual(code, 0)
        checks = section(read(repo), "Checks")
        self.assertIn("| cs | `composer cs` |", checks)
        self.assertNotIn("cs-fix", checks)

    def test_npm_and_nothing_found(self):
        repo = make_repo({"package.json": json.dumps({"scripts": {"test": "jest"}}), "README.md": "x"})
        run(repo)
        self.assertIn("`npm run test`", read(repo))
        repo = make_repo({"README.md": "x"})
        run(repo)
        self.assertEqual(section(read(repo), "Checks"), "None yet.")

    def test_title_uses_origin_repo_name(self):
        repo = make_repo({"README.md": "x"}, folder="worktree-name")
        git = lambda *a: subprocess.run(["git", *a], cwd=repo, check=True, capture_output=True)
        git("remote", "add", "origin", "https://github.com/acme/real-repo.git")
        run(repo)
        https = read(repo)
        git("remote", "set-url", "origin", "git@github.com:acme/real-repo.git")
        os.remove(os.path.join(repo, ".factory", "playbook.md"))
        run(repo)
        for text in (https, read(repo)):
            self.assertEqual(text.splitlines()[0], "# Factory project file: real-repo")
            self.assertIn("Holds real-repo's specifics", text)

    def test_title_falls_back_to_folder_name(self):
        repo = make_repo({"README.md": "x"}, folder="worktree-name")
        run(repo)
        self.assertEqual(read(repo).splitlines()[0], "# Factory project file: worktree-name")
        subprocess.run(["git", "remote", "add", "origin", "/tmp/x/other.git"], cwd=repo, check=True, capture_output=True)
        os.remove(os.path.join(repo, ".factory", "playbook.md"))
        run(repo)
        self.assertEqual(read(repo).splitlines()[0], "# Factory project file: worktree-name")

    def test_bad_recipe_is_an_error(self):
        repo = make_repo({".factory/recipe.yml": "version: 1\nbogus: x\n"})
        code, out, err = run(repo)
        self.assertEqual(code, 2)
        self.assertIn("unknown key", err)
        self.assertFalse(os.path.exists(os.path.join(repo, ".factory", "playbook.md")))


EXISTING = """# Factory project file: hand written

Intro that a human wrote.   Keep   my spacing.

## Checks

Run `composer test` and read `.ai/rules/`.

## Review

Use the reviewer skill.

## Scaffolding

- `/new-slice`

## Cleanup

Drop the databases.

## Notes

Mind the `docs/gone.md` file.

## Post-merge

- Deploy check: none
- Sentry: none
"""


class ExistingTest(unittest.TestCase):
    def test_keeps_text_and_adds_missing_section_in_order(self):
        repo = make_repo({"composer.json": json.dumps({"scripts": {"test": "x"}}), ".ai/rules/a.md": "x",
                          ".factory/playbook.md": EXISTING})
        code, out, _ = run(repo)
        self.assertEqual(code, 0)
        self.assertFalse(out["created"])
        self.assertEqual(out["added_sections"], ["Local setup"])
        self.assertEqual(out["placement"], {"Local setup": "before Cleanup"})
        new = read(repo)
        added = "## Local setup\n\nNone yet.\n\n"
        self.assertIn(added, new)
        self.assertEqual(new.replace(added, "", 1), EXISTING)  # byte for byte, only the section is new

    def test_added_section_is_none_even_with_a_recipe(self):
        repo = make_repo({".factory/recipe.yml": RECIPE, ".factory/playbook.md": EXISTING})
        run(repo)
        self.assertEqual(section(read(repo), "Local setup"), "None yet.")

    def test_missing_last_section_is_appended_at_end(self):
        repo = make_repo({".factory/playbook.md": EXISTING.split("## Notes")[0]})
        code, out, _ = run(repo)
        self.assertEqual(out["added_sections"], ["Local setup", "Notes", "Post-merge"])
        self.assertEqual(out["placement"], {"Local setup": "before Cleanup", "Notes": "end", "Post-merge": "end"})
        new = read(repo)
        self.assertTrue(new.startswith(EXISTING.split("## Notes")[0].split("## Cleanup")[0]))
        self.assertIn("## Notes\n\nNone yet.\n\n## Post-merge\n\n", new)
        self.assertTrue(new.endswith("- Deploy check: none\n- Sentry: none\n\n"))

    def test_missing_post_merge_gets_the_stub_not_none_yet(self):
        old = EXISTING.replace("## Cleanup", "## Local setup\n\nx\n\n## Cleanup").split("## Post-merge")[0]
        repo = make_repo({".factory/playbook.md": old})
        code, out, _ = run(repo)
        self.assertEqual((code, out["added_sections"]), (0, ["Post-merge"]))
        post = section(read(repo), "Post-merge")
        self.assertEqual(post.splitlines()[-2:], ["- Deploy check: none", "- Sentry: none"])
        self.assertNotIn("None yet.", post)
        self.assertTrue(read(repo).startswith(old))

    def test_complete_file_is_untouched(self):
        repo = make_repo({".factory/playbook.md": EXISTING.replace("## Cleanup", "## Local setup\n\nx\n\n## Cleanup")})
        before = read(repo)
        code, out, _ = run(repo)
        self.assertEqual((code, out["added_sections"]), (0, []))
        self.assertEqual(read(repo), before)

    def test_headings_inside_code_fences_do_not_count(self):
        repo = make_repo({".factory/playbook.md": "# T\n\n```\n## Checks\n```\n"})
        code, out, _ = run(repo)
        self.assertIn("Checks", out["added_sections"])

    def test_unresolved_items(self):
        repo = make_repo({
            "composer.json": json.dumps({"scripts": {"test": "x"}}),
            "package.json": json.dumps({"scripts": {"lint": "x"}}),
            ".ai/rules/a.md": "x",
            ".gitignore": "vendor/\n.env\n",
            ".factory/playbook.md": (
                "# T\n\n## Checks\n\n"
                "`composer test` `composer stan` `composer install` `pnpm lint` `pnpm typecheck` `npm run lint` "
                "`yarn nope` `pnpm install` `composer run-script stan`\n\n"
                "## Notes\n\n"
                "`.ai/rules/` `docs/gone.md` `.missing/x.yml` `vendor/` `.env` `/new-slice` `https://x.dev/a/b` "
                "`origin/main` `a/*.md` `some words/here` `.claude/skills/`\n"),
        })
        git = lambda *a: subprocess.run(["git", "-c", "user.email=t@e.x", "-c", "user.name=t", *a], cwd=repo, check=True, capture_output=True)
        git("add", "-A")
        git("commit", "-q", "-m", "init")
        git("update-ref", "refs/remotes/origin/main", "HEAD")
        code, out, _ = run(repo)
        got = [(u["section"], u["token"]) for u in out["unresolved"]]
        self.assertEqual(got, [
            ("Checks", "composer stan"), ("Checks", "pnpm typecheck"), ("Checks", "yarn nope"),
            ("Checks", "composer run-script stan"),
            ("Notes", "docs/gone.md"), ("Notes", ".missing/x.yml"), ("Notes", ".claude/skills/"),
        ])
        first = out["unresolved"][0]
        self.assertEqual(first["line"], 5)
        self.assertIn("composer.json", first["why"])
        self.assertIn("path does not exist", out["unresolved"][4]["why"])

    def test_no_package_json_is_reported(self):
        repo = make_repo({".factory/playbook.md": "# T\n\n## Checks\n\n`pnpm lint`\n"})
        code, out, _ = run(repo)
        self.assertEqual(out["unresolved"][0]["why"], "package.json does not exist")


class CheckTest(unittest.TestCase):
    def test_missing_file_fails(self):
        repo = make_repo({"README.md": "x"})
        code, out, _ = run(repo, "--check")
        self.assertEqual(code, 1)
        self.assertFalse(out["exists"] or out["passed"])
        self.assertEqual(out["missing_sections"], SECTIONS)
        self.assertFalse(os.path.exists(os.path.join(repo, ".factory")))  # --check writes nothing

    def test_missing_heading_fails_and_complete_passes(self):
        repo = make_repo({".factory/playbook.md": EXISTING})
        code, out, _ = run(repo, "--check")
        self.assertEqual((code, out["missing_sections"]), (1, ["Local setup"]))
        old = EXISTING.replace("## Cleanup", "## Local setup\n\nx\n\n## Cleanup").split("## Post-merge")[0]
        repo2 = make_repo({".factory/playbook.md": old})
        self.assertEqual(run(repo2, "--check")[1]["missing_sections"], ["Post-merge"])
        self.assertEqual(read(repo), EXISTING)
        run(repo)
        code, out, _ = run(repo, "--check")
        self.assertEqual((code, out["passed"], out["missing_sections"]), (0, True, []))

    def test_check_passes_on_a_fresh_file(self):
        repo = make_repo({".factory/recipe.yml": RECIPE})
        run(repo)
        self.assertEqual(run(repo, "--check")[0], 0)

    def test_not_a_directory(self):
        self.assertEqual(run("/nonexistent-dir-xyz")[0], 2)


if __name__ == "__main__":
    unittest.main()
