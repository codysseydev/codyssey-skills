import contextlib
import io
import json
import os
import shutil
import subprocess
import unittest
from unittest import mock

import fixture_support as fs
from fixture_support import RECORDS, TempDirs, git, load_script, put, run_json, run_script
from fixture_support import read as read_text


def inv():
    return load_script("inventory.py")


class Inventory(TempDirs):
    def policy(self, repo, record="allowing.md"):
        code, out, err = run_script("check-policy.py", "--record", os.path.join(RECORDS, record), "--repo", repo, "--model", fs.MODEL)
        self.assertEqual(code, 0, out)
        path = os.path.join(self.tmp(), "policy.json")
        put(os.path.dirname(path), os.path.basename(path), out)
        return path

    def run_inventory(self, repo, policy):
        return run_json("inventory.py", "--policy", policy, "--repo", repo)

    def plain_repo(self, files):
        repo = self.tmp()
        git(repo, "init", "-q", "-b", "main")
        for rel, content in files.items():
            put(repo, rel, content)
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "init")
        return repo

    def fake_policy(self, warnings=(), result="continue"):
        path = os.path.join(self.tmp(), "policy.json")
        put(os.path.dirname(path), "policy.json", json.dumps({"result": result, "blocking": [], "warnings": list(warnings)}))
        return path


class InventoryOfTheFixture(Inventory):
    def test_inventory_of_the_fixture(self):
        repo, info = self.client()
        code, out = self.run_inventory(repo, self.policy(repo))
        self.assertEqual(code, 0)
        self.assertEqual(out["result"], "inventory")
        self.assertEqual(out["read_at"], git(repo, "rev-parse", "HEAD"))
        self.assertEqual(out["ignored"], ["app/Legacy/OldBilling.php"])
        self.assertEqual(
            out["sources"],
            {
                "instructions": ["CLAUDE.md"],
                "docs": [],
                "linters": [".php-cs-fixer.dist.php"],
                "ci": [],
                "scripts": ["composer.json"],
                "pr_templates": [],
            },
        )
        self.assertEqual(out["code_files"], 4)
        self.assertEqual(
            out["siblings"],
            {
                "Controller": ["app/Http/Controllers/OrderController.php"],
                "Handler": ["app/Orders/CancelOrderHandler.php", "app/Orders/CreateOrderHandler.php"],
                "Test": ["tests/Orders/CreateOrderHandlerTest.php"],
            },
        )
        self.assertEqual(
            out["commit_subjects"],
            ["feat(orders): order handlers", "feat(orders): create and cancel handlers", "chore: project setup"],
        )
        self.assertEqual(out["branches"], ["feature/ORD-12-cancel-refund", "main"])

    def test_an_ignored_path_appears_in_no_other_list(self):
        repo, _ = self.client()
        _, out = self.run_inventory(repo, self.policy(repo))
        listed = [p for paths in out["sources"].values() for p in paths] + [p for v in out["siblings"].values() for p in v]
        self.assertNotIn("app/Legacy/OldBilling.php", listed)
        self.assertNotIn("Billing", out["siblings"])

    def test_siblings_are_the_three_most_recently_committed(self):
        repo, _ = self.client()
        for name in ("A", "B", "C"):
            put(repo, f"app/Orders/{name}Handler.php", "<?php\n")
            git(repo, "add", "-A")
            git(repo, "commit", "-q", "-m", f"add {name}")
        _, out = self.run_inventory(repo, self.policy(repo))
        self.assertEqual(out["siblings"]["Handler"], ["app/Orders/CHandler.php", "app/Orders/BHandler.php", "app/Orders/AHandler.php"])

    def test_sources_cover_every_kind_the_issue_names(self):
        files = {
            "README.md": "# r\n", "CONTRIBUTING.md": "c\n", ".github/CONTRIBUTING.md": "c\n", "docs/adr/0001.md": "a\n",
            "docs/img.png": "x", "AGENTS.md": "a\n", "packages/x/CLAUDE.md": "c\n", ".cursor/rules/a.mdc": "r\n",
            ".cursorrules": "r\n", ".github/copilot-instructions.md": "c\n", "pint.json": "{}\n", "phpcs.xml.dist": "<x/>\n",
            "phpstan.neon": "\n", "deptrac.yaml": "\n", "phparkitect.php": "<?php\n", "rector.php": "<?php\n",
            "eslint.config.mjs": "\n", ".eslintrc.json": "{}\n", ".github/workflows/ci.yml": "on: push\n",
            ".gitlab-ci.yml": "\n", "bitbucket-pipelines.yml": "\n", "Jenkinsfile": "\n", "package.json": "{}\n",
            ".github/pull_request_template.md": "t\n", "vendor/pkg/CLAUDE.md": "dropped\n", "node_modules/x/package.json": "{}\n",
        }
        repo = self.plain_repo(files)
        _, out = self.run_inventory(repo, self.fake_policy())
        src = out["sources"]
        self.assertEqual(src["instructions"], [".cursor/rules/a.mdc", ".cursorrules", ".github/copilot-instructions.md", "AGENTS.md", "packages/x/CLAUDE.md"])
        self.assertEqual(src["docs"], [".github/CONTRIBUTING.md", "CONTRIBUTING.md", "README.md", "docs/adr/0001.md"])
        self.assertEqual(
            src["linters"],
            [".eslintrc.json", "deptrac.yaml", "eslint.config.mjs", "phparkitect.php", "phpcs.xml.dist", "phpstan.neon", "pint.json", "rector.php"],
        )
        self.assertEqual(src["ci"], [".github/workflows/ci.yml", ".gitlab-ci.yml", "Jenkinsfile", "bitbucket-pipelines.yml"])
        self.assertEqual(src["scripts"], ["package.json"])
        self.assertEqual(src["pr_templates"], [".github/pull_request_template.md"])


class InventoryNeedsAContinue(Inventory):
    def test_a_stop_policy_exits_1_and_runs_no_git_command(self):
        stop = self.fake_policy(result="stop")
        out = io.StringIO()
        with mock.patch.object(subprocess, "run", side_effect=AssertionError("git ran")), contextlib.redirect_stdout(out):
            code = inv().main(["--policy", stop, "--repo", self.tmp()])
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(out.getvalue())["result"], "stop")

    def test_an_unreadable_policy_exits_1(self):
        code, out = run_json("inventory.py", "--policy", os.path.join(self.tmp(), "none.json"), "--repo", self.tmp())
        self.assertEqual((code, out["result"]), (1, "stop"))


class IgnorePatterns(Inventory):
    def setUp(self):
        self.repo = self.plain_repo(
            {
                "secrets/k.php": "<?php\n", "secrets/keep.php": "<?php\n", "a/secrets/k.php": "<?php\n",
                "b/secret_x.php": "<?php\n", "root.php": "<?php\n", "a/root.php": "<?php\n", "ok.php": "<?php\n",
            }
        )
        self.head = git(self.repo, "rev-parse", "HEAD")

    def test_a_bare_name_matches_at_any_depth(self):
        self.assertEqual(inv().ignored_by(self.repo, ["secrets"], self.head), {"secrets/k.php", "secrets/keep.php", "a/secrets/k.php"})

    def test_a_double_star_pattern_matches(self):
        self.assertIn("secrets/k.php", inv().ignored_by(self.repo, ["**/secret*"], self.head))
        self.assertIn("b/secret_x.php", inv().ignored_by(self.repo, ["**/secret*"], self.head))

    def test_a_rooted_pattern_matches_only_the_root(self):
        self.assertEqual(inv().ignored_by(self.repo, ["/root.php"], self.head), {"root.php"})

    def test_a_negated_child_of_an_ignored_folder_stays_ignored(self):
        got = inv().ignored_by(self.repo, ["secrets/", "!secrets/keep.php"], self.head)
        self.assertIn("secrets/keep.php", got)
        self.assertIn("secrets/k.php", got)

    def test_no_patterns_ignore_nothing(self):
        self.assertEqual(inv().ignored_by(self.repo, [], self.head), set())


class IgnoreFilesAtReadAt(Inventory):
    """The ignore files are read from the read_at commit through git, never from policy.json."""

    def listed(self, out):
        return [p for paths in out["sources"].values() for p in paths] + [p for v in out["siblings"].values() for p in v]

    def test_a_negation_in_one_file_cannot_unignore_what_the_other_hides(self):
        repo = self.plain_repo({
            ".aiignore": "config/secrets.php\n", ".cursorignore": "*.log\n!*.php\n",
            "config/secrets.php": "<?php return ['key' => 'live'];\n", "app/AHandler.php": "<?php\n", "CLAUDE.md": "x\n",
        })
        code, out = self.run_inventory(repo, self.policy(repo))
        self.assertEqual(code, 0, out)
        self.assertIn("config/secrets.php", out["ignored"])
        self.assertNotIn("config/secrets.php", self.listed(out))

    def test_a_policy_json_without_ignore_warnings_still_ignores(self):
        repo, _ = self.client()
        code, out = self.run_inventory(repo, self.fake_policy())
        self.assertEqual(code, 0, out)
        self.assertEqual(out["ignored"], ["app/Legacy/OldBilling.php"])
        self.assertNotIn("Billing", out["siblings"])

    def test_an_uncommitted_ignore_line_stops(self):
        repo, _ = self.client()
        policy = self.policy(repo)
        put(repo, ".aiignore", read_text(repo, ".aiignore") + "app/Orders/\n")
        code, out = self.run_inventory(repo, policy)
        self.assertEqual((code, out["result"]), (1, "stop"))
        self.assertIn(".aiignore", out["reason"])
        self.assertNotIn("sources", out)

    def test_an_untracked_cursorignore_stops(self):
        repo, _ = self.client()
        policy = self.policy(repo)
        put(repo, ".cursorignore", "app/Orders/\n")
        code, out = self.run_inventory(repo, policy)
        self.assertEqual(code, 1)
        self.assertIn(".cursorignore", out["reason"])

    def test_a_deleted_ignore_file_in_the_working_tree_stops(self):
        repo, _ = self.client()
        policy = self.policy(repo)
        os.remove(os.path.join(repo, ".aiignore"))
        self.assertEqual(self.run_inventory(repo, policy)[0], 1)

    def commit_ignore_entry(self, repo, kind):
        os.remove(os.path.join(repo, ".aiignore"))
        if kind == "symlink":
            os.symlink("/etc/hosts", os.path.join(repo, ".aiignore"))
        elif kind == "folder":
            put(repo, ".aiignore/patterns", "app/Legacy/\n")
        git(repo, "add", "-A")
        if kind == "gitlink":
            git(repo, "update-index", "--add", "--cacheinfo", f"160000,{git(repo, 'rev-parse', 'HEAD')},.aiignore")
        git(repo, "commit", "-q", "-m", f"ignore file as a {kind}")

    def test_an_ignore_file_that_is_a_symlink_folder_or_gitlink_at_read_at_stops(self):
        for kind in ("symlink", "folder", "gitlink"):
            with self.subTest(kind=kind):
                repo, _ = self.client()
                self.commit_ignore_entry(repo, kind)
                code, out = self.run_inventory(repo, self.fake_policy())
                self.assertEqual((code, out["result"]), (1, "stop"), out)
                self.assertIn(".aiignore", out["reason"])
                self.assertNotIn("sources", out)

    def test_a_symlink_warning_on_another_file_does_not_stop(self):
        repo, _ = self.client()
        policy = self.fake_policy([{"file": "docs", "signal": "symlink"}])
        self.assertEqual(self.run_inventory(repo, policy)[0], 0)


class GitConfigOfTheClient(Inventory):
    def test_a_split_index_repo_is_left_unchanged(self):
        repo, info = self.client()
        git(repo, "config", "core.splitIndex", "true")
        git(repo, "update-index", "--split-index")
        work = fs.make_work(info, os.path.join(self.tmp(), "work"), os.path.join(RECORDS, "allowing.md"), repo)
        before = fs.snapshot(repo)
        code, _ = self.run_inventory(repo, os.path.join(work, "policy.json"))
        self.assertEqual(code, 0)
        code, out = run_json("check-overlay.py", "--work", work, "--repo", repo, "--kanon-root", fs.REPO_ROOT)
        self.assertEqual((code, out["result"]), (0, "ok"), out)
        self.assertEqual(fs.snapshot(repo), before)

    def test_no_script_reads_the_real_index(self):
        # git refreshes the mtime of a split index's shared index on every read of the index, so the
        # scripts read the read_at tree and the working tree only. A broken index proves it.
        repo, info = self.client()
        work = fs.make_work(info, os.path.join(self.tmp(), "work"), os.path.join(RECORDS, "allowing.md"), repo)
        code, expected = self.run_inventory(repo, os.path.join(work, "policy.json"))
        put(repo, ".git/index", b"not an index")
        self.assertNotEqual(subprocess.run(["git", "-C", repo, "ls-files"], capture_output=True).returncode, 0)
        self.assertEqual(self.run_inventory(repo, os.path.join(work, "policy.json")), (code, expected))
        code, out = run_json("check-overlay.py", "--work", work, "--repo", repo, "--kanon-root", fs.REPO_ROOT)
        self.assertEqual((code, out["result"]), (0, "ok"), out)

    def test_a_folder_inside_the_repo_stops(self):
        repo, _ = self.client()
        code, out = self.run_inventory(os.path.join(repo, "app"), self.fake_policy())
        self.assertEqual((code, out["result"]), (1, "stop"))
        self.assertIn("top level", out["reason"])


class SymlinksAndDirtyPaths(Inventory):
    def test_a_tracked_symlink_and_a_submodule_appear_in_no_list(self):
        repo, info = self.client()
        os.symlink("/etc/hosts", os.path.join(repo, "docs-link.md"))
        os.makedirs(os.path.join(repo, "docs"))
        os.symlink("/etc/hosts", os.path.join(repo, "docs", "hosts.md"))
        os.symlink("/etc/hosts", os.path.join(repo, "app", "LinkHandler.php"))
        git(repo, "add", "-A")
        git(repo, "update-index", "--add", "--cacheinfo", f"160000,{info['read_at']},app/SubHandler.php")
        git(repo, "commit", "-q", "-m", "links")
        _, out = self.run_inventory(repo, self.policy(repo))
        shown = json.dumps(out)
        for name in ("docs-link.md", "docs/hosts.md", "LinkHandler", "SubHandler"):
            self.assertNotIn(name, shown)

    def test_an_edited_instruction_file_stops_with_its_path(self):
        repo, _ = self.client()
        policy = self.policy(repo)
        put(repo, "CLAUDE.md", "edited\n")
        code, out = self.run_inventory(repo, policy)
        self.assertEqual((code, out["result"]), (1, "stop"))
        self.assertIn("CLAUDE.md", json.dumps(out))

    def test_a_staged_edit_to_a_listed_sibling_stops(self):
        repo, _ = self.client()
        policy = self.policy(repo)
        put(repo, "app/Orders/CreateOrderHandler.php", "<?php\n// edited\n")
        git(repo, "add", "-A")
        code, out = self.run_inventory(repo, policy)
        self.assertEqual(code, 1)
        self.assertIn("app/Orders/CreateOrderHandler.php", json.dumps(out))

    def test_an_untracked_file_does_not_stop_and_is_not_listed(self):
        repo, _ = self.client()
        policy = self.policy(repo)
        put(repo, "NOTES.md", "mine\n")
        put(repo, "vendor/x/y.php", "<?php\n")
        code, out = self.run_inventory(repo, policy)
        self.assertEqual(code, 0)
        self.assertNotIn("NOTES.md", json.dumps(out))

    def test_a_listed_file_replaced_by_a_symlink_stops(self):
        repo, _ = self.client()
        policy = self.policy(repo)
        target = os.path.join(self.tmp(), "CLAUDE.md")
        put(os.path.dirname(target), "CLAUDE.md", read_text(repo, "CLAUDE.md"))
        os.remove(os.path.join(repo, "CLAUDE.md"))
        os.symlink(target, os.path.join(repo, "CLAUDE.md"))
        code, out = self.run_inventory(repo, policy)
        self.assertEqual(code, 1)
        self.assertIn("CLAUDE.md", out["reason"])

    def test_a_listed_file_under_a_symlinked_folder_stops(self):
        repo, _ = self.client()
        policy = self.policy(repo)
        elsewhere = os.path.join(self.tmp(), "Orders")
        shutil.copytree(os.path.join(repo, "app", "Orders"), elsewhere)
        shutil.rmtree(os.path.join(repo, "app", "Orders"))
        os.symlink(elsewhere, os.path.join(repo, "app", "Orders"))
        code, out = self.run_inventory(repo, policy)
        self.assertEqual(code, 1)
        self.assertIn("app/Orders/", out["reason"])

    def test_a_dirty_file_the_inventory_ignores_does_not_stop(self):
        repo, _ = self.client()
        policy = self.policy(repo)
        put(repo, "app/Legacy/OldBilling.php", "<?php\n// edited\n")
        self.assertEqual(self.run_inventory(repo, policy)[0], 0)


class NoCode(Inventory):
    def test_an_unborn_repo_is_no_code(self):
        repo = self.tmp()
        git(repo, "init", "-q", "-b", "main")
        code, out = self.run_inventory(repo, self.fake_policy())
        self.assertEqual((code, out["result"], out["read_at"]), (0, "no-code", None))

    def test_readme_and_composer_json_are_no_code(self):
        repo = self.plain_repo({"README.md": "# r\n", "composer.json": "{}\n", "LICENSE": "x\n"})
        code, out = self.run_inventory(repo, self.fake_policy())
        self.assertEqual((code, out["result"], out["code_files"]), (0, "no-code", 0))

    def test_a_config_file_is_not_code(self):
        repo = self.plain_repo({"README.md": "# r\n", "vite.config.js": "x\n", "tailwind.config.ts": "x\n"})
        self.assertEqual(self.run_inventory(repo, self.fake_policy())[1]["result"], "no-code")

    def test_readme_and_claude_md_give_an_inventory(self):
        repo = self.plain_repo({"README.md": "# r\n", "CLAUDE.md": "rules\n"})
        code, out = self.run_inventory(repo, self.fake_policy())
        self.assertEqual((code, out["result"]), (0, "inventory"))

    def test_a_source_file_alone_gives_an_inventory(self):
        repo = self.plain_repo({"app/Foo.php": "<?php\n"})
        self.assertEqual(self.run_inventory(repo, self.fake_policy())[1]["result"], "inventory")

    def test_an_unborn_repo_with_staged_files_stops(self):
        repo = self.tmp()
        git(repo, "init", "-q", "-b", "main")
        put(repo, "CLAUDE.md", "x\n")
        git(repo, "add", "-A")
        self.assertEqual(self.run_inventory(repo, self.fake_policy())[0], 1)

    def test_a_folder_that_is_not_a_repo_stops(self):
        self.assertEqual(self.run_inventory(self.tmp(), self.fake_policy())[0], 1)


class InventoryWritesNothing(Inventory):
    def test_a_snapshot_of_the_repo_is_the_same_after(self):
        repo, _ = self.client()
        policy = self.policy(repo)
        before = fs.snapshot(repo)
        code, out = self.run_inventory(repo, policy)
        self.assertEqual(code, 0)
        self.assertEqual(fs.snapshot(repo), before)

    def test_a_stop_for_a_dirty_path_writes_nothing_either(self):
        repo, _ = self.client()
        policy = self.policy(repo)
        put(repo, "CLAUDE.md", "edited\n")
        before = fs.snapshot(repo)
        self.assertEqual(self.run_inventory(repo, policy)[0], 1)
        self.assertEqual(fs.snapshot(repo), before)


if __name__ == "__main__":
    unittest.main()
