import datetime
import os
import subprocess
import sys
import unittest

import fixture_support as fs
from fixture_support import (
    MODEL, RECORDS, RECORDS_DISCOVERY, REPO_ROOT, TempDirs, git, put, read, run_json, run_script, snapshot,
)

ALLOWING = os.path.join(RECORDS, "allowing.md")
ALLOWING_COMMIT = os.path.join(RECORDS_DISCOVERY, "allowing-commit.md")
FORBIDDING = os.path.join(RECORDS, "forbidding.md")
OVERLAY_FILES = [".ai/kanon.yml", ".ai/rules/project/testing.md", ".ai/standards-report.md"]


class Placement(TempDirs):
    def setUp(self):
        self.repo, self.info = self.client()
        self.work = self.work_for(self.repo, self.info)

    def place(self, record=ALLOWING, *extra, repo=None):
        return run_json(
            "place-overlay.py", "place", "--record", record, "--model", MODEL, "--work", self.work,
            "--repo", repo or self.repo, *extra,
        )

    def load(self, record=ALLOWING, repo=None):
        return run_json(
            "place-overlay.py", "load", "--record", record, "--model", MODEL, "--work", self.work, "--repo", repo or self.repo,
        )

    def status(self, repo):
        return git(repo, "--no-optional-locks", "status", "--porcelain")


class ForbiddingRecordWritesNothing(Placement):
    def test_inventory_check_and_place_in_a_row_leave_the_repo_unchanged(self):
        before = snapshot(self.repo)
        code, _, _ = run_script("check-policy.py", "--record", ALLOWING, "--repo", self.repo, "--model", MODEL)
        self.assertEqual(code, 0)
        code, out = run_json("inventory.py", "--policy", os.path.join(self.work, "policy.json"), "--repo", self.repo)
        self.assertEqual(out["result"], "inventory")
        code, out = run_json("check-overlay.py", "--work", self.work, "--repo", self.repo, "--kanon-root", REPO_ROOT)
        self.assertEqual((code, out["result"]), (0, "ok"))
        code, out = self.place()
        self.assertEqual((code, out["result"]), (0, "kept-in-brain"))
        self.assertIn("load", out["next"])
        self.assertEqual(snapshot(self.repo), before)
        self.assertEqual(self.status(self.repo), "")

    def test_the_work_folder_is_left_as_it_was(self):
        before = snapshot(self.work)
        self.place()
        self.assertEqual(snapshot(self.work), before)


class AllowingRecordMakesABranch(Placement):
    def test_a_branch_with_one_commit_holding_exactly_the_overlay_and_the_report(self):
        put(self.repo, "CLAUDE.md", "an uncommitted edit\n")
        head = git(self.repo, "rev-parse", "HEAD")
        code, out = self.place(ALLOWING_COMMIT)
        self.assertEqual((code, out["result"]), (0, "placed"))
        branch = "standards-discovery/" + datetime.date.today().isoformat()
        self.assertEqual(out["branch"], branch)
        self.assertEqual(git(self.repo, "rev-list", "--count", f"{head}..{branch}"), "1")
        self.assertEqual(git(self.repo, "rev-parse", f"{branch}~1"), head)
        changed = git(self.repo, "diff-tree", "--no-commit-id", "--name-only", "-r", branch).splitlines()
        self.assertEqual(sorted(changed), OVERLAY_FILES)
        self.assertEqual(git(self.repo, "log", "-1", "--format=%s", branch), "docs(ai): project overlay from standards-discovery")
        self.assertEqual(git(self.repo, "show", f"{branch}:.ai/kanon.yml"), read(self.work, ".ai/kanon.yml").strip())
        self.assertEqual(git(self.repo, "show", f"{branch}:.ai/standards-report.md"), read(self.work, "standards-report.md").strip())

    def test_the_owners_checkout_keeps_its_branch_head_and_uncommitted_edit(self):
        put(self.repo, "CLAUDE.md", "an uncommitted edit\n")
        head = git(self.repo, "rev-parse", "HEAD")
        self.place(ALLOWING_COMMIT)
        self.assertEqual(git(self.repo, "rev-parse", "--abbrev-ref", "HEAD"), "main")
        self.assertEqual(git(self.repo, "rev-parse", "HEAD"), head)
        self.assertEqual(self.status(self.repo), "M CLAUDE.md")
        self.assertEqual(read(self.repo, "CLAUDE.md"), "an uncommitted edit\n")
        self.assertFalse(os.path.exists(os.path.join(self.repo, ".ai")))
        self.assertEqual(len(git(self.repo, "worktree", "list").splitlines()), 1)

    def test_branch_and_subject_are_used_when_given(self):
        code, out = self.place(ALLOWING_COMMIT, "--branch", "chore/ai-overlay", "--subject", "chore(ai): add project overlay")
        self.assertEqual((code, out["branch"]), (0, "chore/ai-overlay"))
        self.assertEqual(git(self.repo, "log", "-1", "--format=%s", "chore/ai-overlay"), "chore(ai): add project overlay")

    def test_a_rerun_is_a_no_op(self):
        self.place(ALLOWING_COMMIT)
        branch = "standards-discovery/" + datetime.date.today().isoformat()
        tip = git(self.repo, "rev-parse", branch)
        code, out = self.place(ALLOWING_COMMIT)
        self.assertEqual((code, out["result"]), (0, "already-placed"))
        self.assertEqual(git(self.repo, "rev-parse", branch), tip)

    def test_a_branch_of_that_name_with_other_files_stops(self):
        self.place(ALLOWING_COMMIT)
        put(self.work, ".ai/rules/project/testing.md", read(self.work, ".ai/rules/project/testing.md") + "\n- More.\n")
        code, out = self.place(ALLOWING_COMMIT)
        self.assertEqual((code, out["result"]), (1, "stop"))
        self.assertIn("standards-discovery/", out["reason"])

    def test_a_bad_branch_name_is_refused_before_anything_is_made(self):
        before = snapshot(self.repo)
        code, out, err = run_script(
            "place-overlay.py", "place", "--record", ALLOWING_COMMIT, "--model", MODEL, "--work", self.work,
            "--repo", self.repo, "--branch", "bad..name",
        )
        self.assertEqual(code, 2)
        self.assertIn("branch", err)
        self.assertEqual(snapshot(self.repo), before)

    def test_a_failure_after_the_branch_is_made_leaves_no_branch_or_worktree(self):
        git(self.repo, "config", "user.useConfigOnly", "true")
        env = {k: v for k, v in fs.GIT_ENV.items() if not k.startswith(("GIT_AUTHOR", "GIT_COMMITTER"))}
        done = subprocess.run(
            [sys.executable, os.path.join(fs.SCRIPTS, "place-overlay.py"), "place", "--record", ALLOWING_COMMIT, "--model", MODEL,
             "--work", self.work, "--repo", self.repo],
            env=env, capture_output=True, text=True,
        )
        self.assertEqual(done.returncode, 1, done.stderr)
        self.assertEqual(git(self.repo, "branch", "--list", "standards-discovery/*"), "")
        self.assertEqual(len(git(self.repo, "worktree", "list").splitlines()), 1)


class PlaceRefuses(Placement):
    def test_a_failing_overlay_check_refuses_and_writes_nothing(self):
        put(self.work, ".ai/kanon.yml", read(self.work, ".ai/kanon.yml").replace("effect: adopt", "effect: enable", 1))
        before = snapshot(self.repo)
        for record in (ALLOWING, ALLOWING_COMMIT):
            code, out = self.place(record)
            self.assertEqual((code, out["result"]), (1, "stop"))
            self.assertTrue(out["problems"])
        self.assertEqual(snapshot(self.repo), before)

    def test_a_forbidding_record_stops_on_the_policy_fields_and_writes_nothing(self):
        before = snapshot(self.repo)
        code, out = self.place(FORBIDDING)
        self.assertEqual((code, out["result"]), (1, "stop"))
        self.assertEqual([b["field"] for b in out["blocking"]], ["ai_allowed", "code_leaves_machine"])
        self.assertEqual(snapshot(self.repo), before)

    def test_a_missing_record_stops(self):
        code, out = self.place(os.path.join(self.tmp(), "none.md"))
        self.assertEqual((code, out["result"]), (1, "stop"))

    def test_a_branch_is_never_made_for_a_forbidding_record(self):
        self.place(FORBIDDING)
        self.assertEqual(git(self.repo, "branch", "--list", "standards-discovery/*"), "")


class Load(Placement):
    def linked_worktree(self):
        path = os.path.join(self.tmp(), "linked")
        git(self.repo, "worktree", "add", "-q", "--detach", path, "HEAD")
        return path

    def exclude_lines(self):
        path = git(self.repo, "rev-parse", "--path-format=absolute", "--git-path", "info/exclude")
        return [line for line in read("/", path).splitlines() if line.strip() and not line.startswith("#")]

    def test_in_a_linked_worktree_the_files_land_and_status_stays_empty(self):
        linked = self.linked_worktree()
        code, out = self.load(repo=linked)
        self.assertEqual((code, out["result"]), (0, "loaded"))
        self.assertEqual(read(linked, ".ai/kanon.yml"), read(self.work, ".ai/kanon.yml"))
        self.assertEqual(read(linked, ".ai/rules/project/testing.md"), read(self.work, ".ai/rules/project/testing.md"))
        self.assertEqual(self.exclude_lines(), ["/.ai/kanon.yml", "/.ai/rules/project/"])
        self.assertEqual(self.status(linked), "")

    def test_a_second_run_changes_nothing(self):
        linked = self.linked_worktree()
        self.load(repo=linked)
        exclude = self.exclude_lines()
        code, out = self.load(repo=linked)
        self.assertEqual(code, 0)
        self.assertEqual(self.exclude_lines(), exclude)
        self.assertEqual(self.status(linked), "")
        self.assertEqual(read(linked, ".ai/kanon.yml"), read(self.work, ".ai/kanon.yml"))

    def test_load_in_a_plain_checkout_also_leaves_status_empty(self):
        code, out = self.load()
        self.assertEqual(code, 0)
        self.assertEqual(self.status(self.repo), "")
        self.assertEqual(self.exclude_lines(), ["/.ai/kanon.yml", "/.ai/rules/project/"])

    def test_an_exclude_file_without_a_final_newline_keeps_its_lines(self):
        path = git(self.repo, "rev-parse", "--path-format=absolute", "--git-path", "info/exclude")
        put("/", path, "*.log")
        self.load()
        self.assertEqual(self.exclude_lines(), ["*.log", "/.ai/kanon.yml", "/.ai/rules/project/"])

    def test_a_tracked_kanon_yml_stops(self):
        put(self.repo, ".ai/kanon.yml", "mode: canon-first\n")
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-q", "-m", "track the overlay")
        before = snapshot(self.repo)
        code, out = self.load()
        self.assertEqual((code, out["result"]), (1, "stop"))
        self.assertIn(".ai/kanon.yml", out["reason"])
        self.assertEqual(snapshot(self.repo), before)

    def test_a_tracked_rule_file_stops(self):
        put(self.repo, ".ai/rules/project/testing.md", "---\npaths:\n  - x\n---\n")
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-q", "-m", "track a rule")
        self.assertEqual(self.load()[0], 1)

    def test_a_record_that_allows_commits_stops(self):
        before = snapshot(self.repo)
        code, out = self.load(ALLOWING_COMMIT)
        self.assertEqual((code, out["result"]), (1, "stop"))
        self.assertIn("commit_ai_files", out["reason"])
        self.assertEqual(snapshot(self.repo), before)

    def test_a_forbidding_record_stops(self):
        before = snapshot(self.repo)
        self.assertEqual(self.load(FORBIDDING)[0], 1)
        self.assertEqual(snapshot(self.repo), before)

    def test_a_failing_overlay_check_refuses_to_load(self):
        put(self.work, ".ai/kanon.yml", "mode: project-first\noverlay:\n  - id: ORCH-099\n    effect: adopt\n    evidence:\n      - CLAUDE.md:7\n")
        before = snapshot(self.repo)
        self.assertEqual(self.load()[0], 1)
        self.assertEqual(snapshot(self.repo), before)


if __name__ == "__main__":
    unittest.main()
