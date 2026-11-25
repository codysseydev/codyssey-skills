import json
import os
import shutil
import subprocess
import tempfile
import unittest

import fixture_support as fs
from fixture_support import REPO_ROOT, TempDirs, git, load_script, put, read, run_json, run_script

ORCH_011 = "  - id: ORCH-011\n    effect: adopt\n    evidence:\n      - .php-cs-fixer.dist.php:9\n"
TEST_CASE_SENTENCE = "Every test that boots the application **MUST** extend the project's `Tests\\TestCase`."


def co():
    return load_script("check-overlay.py")


def cp():
    return load_script("check-policy.py")


class Golden(TempDirs):
    """The fixture client, its golden work folder, and a way to run the checker on a mutated copy."""

    def setUp(self):
        self.repo, self.info = self.client()
        self.work = self.work_for(self.repo, self.info)

    def check(self, *extra):
        return run_json("check-overlay.py", "--work", self.work, "--repo", self.repo, "--kanon-root", REPO_ROOT, *extra)

    def edit(self, rel, old, new):
        text = read(self.work, rel)
        self.assertIn(old, text, f"{rel} has no {old!r}")
        put(self.work, rel, text.replace(old, new, 1))

    def problems(self):
        code, result = self.check()
        self.assertEqual(code, 1, result)
        self.assertEqual(result["result"], "invalid")
        return json.dumps(result["problems"])

    def assertProblem(self, *needles):
        text = self.problems()
        for needle in needles:
            self.assertIn(needle, text)


class GoldenPass(Golden):
    def test_golden_overlay_and_report_pass(self):
        code, result = self.check()
        self.assertEqual((code, result), (0, {"result": "ok", "problems": []}))

    def test_the_golden_report_cites_each_source_and_form(self):
        report, problems = co().parse_report(read(self.work, "standards-report.md"))
        self.assertEqual(problems, [])
        kinds = {c["kind"] for row in report["rows"] for c in row["citations"]}
        self.assertEqual(kinds, {"file", "commit", "branch"})
        self.assertEqual({row["source"] for row in report["rows"]}, {"written down", "configured", "pattern in code"})
        self.assertEqual({row["effect"] for row in report["rows"]}, {"adopt", "change", "off", "project-only"})
        self.assertIn("composer.json:7", [c.get("ref") for row in report["rows"] for c in row["citations"]])


class SchemaMutations(Golden):
    def test_an_unknown_effect_is_named_with_its_path(self):
        self.edit(".ai/kanon.yml", "effect: adopt", "effect: enable")
        self.assertProblem("overlay[0].effect", "must be one of")

    def test_empty_evidence_is_named_with_its_path(self):
        self.edit(".ai/kanon.yml", "    evidence:\n      - .php-cs-fixer.dist.php:9\n", "    evidence:\n")
        self.assertProblem("overlay[0].evidence", "at least 1")

    def test_an_unknown_key_is_named(self):
        self.edit(".ai/kanon.yml", "    effect: adopt\n", "    effect: adopt\n    owner: me\n")
        self.assertProblem("overlay[0]", 'unknown property \\"owner\\"')

    def test_id_and_file_in_one_entry_fail(self):
        self.edit(".ai/kanon.yml", "  - id: ORCH-011\n", "  - id: ORCH-011\n    file: kanon/laravel-kanon/references/testing.md\n")
        self.assertProblem("overlay[0]", "unknown property")

    def test_a_missing_mode_fails(self):
        self.edit(".ai/kanon.yml", "mode: project-first\n", "")
        self.assertProblem('missing required property \\"mode\\"')

    def test_a_mode_outside_the_schema_fails(self):
        self.edit(".ai/kanon.yml", "mode: project-first", "mode: both")
        self.assertProblem("mode", "must be one of")

    def test_canon_first_fails_because_discovery_writes_project_first(self):
        self.edit(".ai/kanon.yml", "mode: project-first", "mode: canon-first")
        self.assertProblem("mode", "project-first")

    def test_an_empty_overlay_key_fails(self):
        # YAML readers take a bare `overlay:` as null, not as an empty list.
        put(self.work, ".ai/kanon.yml", "mode: project-first\noverlay:\n")
        self.assertProblem("overlay", "at least 1")

    def test_an_evidence_item_without_a_line_number_fails(self):
        self.edit(".ai/kanon.yml", "      - .php-cs-fixer.dist.php:9", "      - .php-cs-fixer.dist.php")
        self.assertProblem("overlay[0].evidence[0]", "does not match")


class ParseErrors(unittest.TestCase):
    def fails(self, text, line, *words):
        with self.assertRaises(ValueError) as raised:
            co().parse_kanon_yml(text)
        message = str(raised.exception)
        self.assertIn(f"line {line}", message)
        for word in words:
            self.assertIn(word, message)

    def test_plain_off_is_refused_with_its_line(self):
        self.fails("mode: project-first\noverlay:\n  - id: ORCH-011\n    effect: off\n", 4, "quote this value")

    def test_every_yaml_boolean_word_needs_quotes(self):
        for word in ("on", "yes", "no", "true", "false", "y", "n", "null", "~", "Off", "TRUE"):
            with self.assertRaises(ValueError, msg=word):
                co().parse_kanon_yml(f"mode: project-first\noverlay:\n  - id: ORCH-011\n    effect: {word}\n")

    def test_a_comment_after_a_value_is_refused(self):
        self.fails("mode: project-first # note\n", 1, "quote this value")

    def test_a_colon_and_space_in_a_plain_value_is_refused(self):
        self.fails("mode: project-first\noverlay:\n  - id: ORCH-011\n    effect: adopt: yes\n", 4, "quote this value")

    def test_a_tab_is_refused(self):
        self.fails("mode: project-first\noverlay:\n\t- id: ORCH-011\n", 3, "tab")

    def test_a_duplicate_key_in_an_entry_is_refused(self):
        self.fails("mode: project-first\noverlay:\n  - id: ORCH-011\n    effect: adopt\n    effect: change\n", 5, "twice")

    def test_a_wrong_indent_is_refused(self):
        self.fails("mode: project-first\noverlay:\n   - id: ORCH-011\n", 3, "form")

    def test_a_second_mode_is_refused(self):
        self.fails("mode: project-first\nmode: canon-first\n", 2, "twice")

    def test_a_plain_value_that_looks_like_a_number_needs_quotes(self):
        self.fails("mode: project-first\noverlay:\n  - id: ORCH-011\n    evidence:\n      - 12:30\n", 5, "quote this value")

    def test_a_single_quoted_string_keeps_backslashes_and_doubles_its_quotes(self):
        parsed = co().parse_kanon_yml("mode: project-first\noverlay:\n  - note: 'the project''s `Tests\\TestCase`.'\n")
        self.assertEqual(parsed["overlay"][0]["note"], "the project's `Tests\\TestCase`.")

    def test_a_json_double_quoted_string_is_read(self):
        parsed = co().parse_kanon_yml('mode: project-first\noverlay:\n  - note: "a \\"b\\" c"\n')
        self.assertEqual(parsed["overlay"][0]["note"], 'a "b" c')

    def test_the_golden_file_parses_to_the_shape_check_policy_reads(self):
        parsed = co().parse_kanon_yml(read(fs.EXPECTED, ".ai/kanon.yml"))
        self.assertEqual(parsed["mode"], "project-first")
        self.assertEqual(parsed["overlay"][1], {"id": "ORCH-008", "effect": "off", "evidence": ["CLAUDE.md:12"]})
        self.assertEqual(len(parsed["overlay"]), 4)

    def test_a_path_with_spaces_passes_when_quoted(self):
        module = co()
        parsed = module.parse_kanon_yml(
            "mode: project-first\noverlay:\n  - id: ORCH-011\n    effect: adopt\n    evidence:\n      - 'docs/Coding Standards.md:3'\n"
        )
        schema = json.loads(read(os.path.join(fs.SKILL, "references"), "kanon-yml.schema.json"))
        self.assertEqual(module.validate(schema, parsed), [])


class RuleResolution(unittest.TestCase):
    def kanon(self):
        return co().load_kanon(REPO_ROOT)

    def resolve(self, **entry):
        return co().resolve(entry, self.kanon())

    def test_a_real_id_resolves_to_its_family(self):
        family, key, problem = self.resolve(id="ORCH-011")
        self.assertEqual((family, problem), ("orchestration-di", None))
        self.assertEqual(key, ("id", "ORCH-011"))
        self.assertEqual(self.resolve(id="TEST-003")[0], "testing")

    def test_a_made_up_id_fails(self):
        self.assertIn("no such", self.resolve(id="ORCH-099")[2])
        self.assertIn("no such", self.resolve(id="TEST-099")[2])
        self.assertIn("no such", self.resolve(id="NOPE-001")[2])

    def test_an_id_of_a_family_without_a_catalog_file_names_the_family(self):
        root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, root, True)
        families = [
            {"family": "x", "prefix": "X", "reference": "kanon/x/references/x.md"},
            {"family": "y", "prefix": "Y", "reference": "kanon/y/references/y.md"},
        ]
        put(root, "kanon/catalog/families.json", json.dumps(families))
        put(root, "kanon/catalog/x.json", json.dumps({"sections": [{"entries": [{"id": "X-001", "rule": "Code **MUST** be tidy."}]}]}))
        kanon = co().load_kanon(root)
        family, _, problem = co().resolve({"id": "X-001"}, kanon)
        self.assertEqual((family, problem), ("x", None))
        problem = co().resolve({"id": "Y-001"}, kanon)[2]
        self.assertIn("y", problem)
        self.assertIn("no catalog file", problem)

    def test_an_entry_by_file_and_sentence_is_refused_by_the_schema(self):
        schema = json.loads(read(os.path.join(fs.SKILL, "references"), "kanon-yml.schema.json"))
        entry = {"file": "kanon/laravel-kanon/references/testing.md", "sentence": TEST_CASE_SENTENCE, "effect": "adopt", "evidence": ["CLAUDE.md:7"]}
        errors = co().validate(schema, {"mode": "project-first", "overlay": [entry]})
        self.assertIn('unknown property "file"', [error["message"] for error in errors])

    def test_a_report_row_naming_a_file_and_sentence_is_refused(self):
        rule, problem = co().parse_rule_cell('`kanon/laravel-kanon/references/testing.md` "' + TEST_CASE_SENTENCE + '"')
        self.assertIsNone(rule)
        self.assertIn("ID", problem)


class OneEntryPerRule(Golden):
    def test_two_entries_with_the_same_id_fail(self):
        self.edit(".ai/kanon.yml", "overlay:\n", "overlay:\n" + ORCH_011)
        self.assertProblem("ORCH-011", "twice")


class OverlayEvidence(Golden):
    def test_an_evidence_item_on_a_blank_line_fails(self):
        self.edit(".ai/kanon.yml", "CLAUDE.md:12", "CLAUDE.md:11")
        self.assertProblem("CLAUDE.md:11", "blank")

    def test_an_evidence_item_past_the_end_fails(self):
        self.edit(".ai/kanon.yml", "CLAUDE.md:12", "CLAUDE.md:99")
        self.assertProblem("CLAUDE.md:99", "past the end")

    def test_an_evidence_item_missing_from_its_row_fails(self):
        self.edit(".ai/kanon.yml", "CLAUDE.md:12", "CLAUDE.md:8")
        self.assertProblem("CLAUDE.md:8", "not among the citations")


class QuoteAndPathForms(Golden):
    def test_a_quote_holding_a_double_quote_fails(self):
        self.edit("standards-report.md", '"Use Laravel facades"', '"Use "Laravel" facades"')
        self.assertProblem("Facades are used")

    def test_a_quote_holding_a_pipe_fails(self):
        self.edit("standards-report.md", '"Use Laravel facades"', '"Use Laravel | facades"')
        self.assertProblem("cannot hold |")

    def test_a_path_with_spaces_parses_in_a_report_citation(self):
        text = (
            "# Standards report: a/b\n\nRead at: " + "a" * 40 + "\nFramework: laravel\n\n## Conventions\n\n"
            "| Convention | Evidence | Source | Kanon rule | Effect |\n|---|---|---|---|---|\n"
            '| Docs | `docs/Coding Standards.md:3` "Use tabs" | written down | none | project-only |\n\n## Silent on\n\n- http-api\n'
        )
        report, problems = co().parse_report(text)
        self.assertEqual(problems, [])
        self.assertEqual(report["rows"][0]["citations"][0]["path"], "docs/Coding Standards.md")


class ChangeAndRuleFiles(Golden):
    def test_change_without_a_rule_fails(self):
        self.edit(".ai/kanon.yml", "    rule: .ai/rules/project/testing.md\n", "")
        self.assertProblem("change", "rule")

    def test_adopt_with_a_rule_fails(self):
        self.edit(".ai/kanon.yml", "    effect: adopt\n    evidence:\n      - .php-cs-fixer", "    effect: adopt\n    rule: .ai/rules/project/testing.md\n    evidence:\n      - .php-cs-fixer")
        self.assertProblem("adopt", "no rule")

    def test_a_rule_path_that_does_not_exist_fails(self):
        os.remove(os.path.join(self.work, ".ai/rules/project/testing.md"))
        self.assertProblem(".ai/rules/project/testing.md", "does not exist")

    def test_a_rule_file_without_paths_fails(self):
        put(self.work, ".ai/rules/project/testing.md", "# Testing\n\n- Tests **MUST** start with `test_`.\n")
        self.assertProblem(".ai/rules/project/testing.md", "paths")

    def test_a_rule_file_with_an_empty_paths_list_fails(self):
        put(self.work, ".ai/rules/project/testing.md", "---\npaths:\n---\n\n# Testing\n")
        self.assertProblem(".ai/rules/project/testing.md", "paths")


class CitationStrictness(Golden):
    def test_a_quote_of_spaces_fails(self):
        self.edit("standards-report.md", '`composer.json:7` "php-cs-fixer fix --dry-run --diff"', '`composer.json:2` " "')
        self.assertProblem("composer lint")

    def test_a_one_letter_quote_fails(self):
        self.edit("standards-report.md", '`composer.json:7` "php-cs-fixer fix --dry-run --diff"', '`composer.json:3` "e"')
        self.assertProblem("composer.json:3", "3 characters")

    def test_a_quote_of_punctuation_only_fails(self):
        self.edit("standards-report.md", '"DB::transaction"', '"::("')
        self.assertProblem("app/Orders/CreateOrderHandler.php:13", "letter or digit")

    def test_a_commit_quote_follows_the_same_rule(self):
        self.edit("standards-report.md", '"feat(orders)"', '"f"')
        self.assertProblem("commit:", "3 characters")

    def test_a_range_over_20_lines_fails(self):
        self.edit("standards-report.md", '`app/Orders/CreateOrderHandler.php:9` "final class"', '`app/Orders/CreateOrderHandler.php:1-21` "final class"')
        self.assertProblem("app/Orders/CreateOrderHandler.php:1-21", "20 lines")

    def test_an_overlay_range_over_20_lines_fails(self):
        self.edit(".ai/kanon.yml", "CLAUDE.md:12", "CLAUDE.md:1-21")
        self.assertProblem("CLAUDE.md:1-21", "20 lines")

    def test_a_table_without_its_separator_row_fails_and_checks_row_1(self):
        bad = '| Billing is legacy | `app/Legacy/OldBilling.php:2` "anything" | pattern in code | none | project-only |\n'
        self.edit("standards-report.md", "|---|---|---|---|---|\n", bad)
        text = self.problems()
        self.assertIn("separator", text)
        self.assertIn("ignored", text)

    def test_a_separator_with_alignment_colons_passes(self):
        self.edit("standards-report.md", "|---|---|---|---|---|\n", "| :--- | --- | :---: | --- | ---: |\n")
        self.assertEqual(self.check()[0], 0)


class Citations(TempDirs):
    def setUp(self):
        self.repo, self.info = self.client()
        self.sha = self.info["read_at"]

    def cite(self, **item):
        item.setdefault("kind", "file")
        item.setdefault("quote", None)
        item.setdefault("end", None)
        ignored = {"app/Legacy/OldBilling.php"}
        listed = co().inventory.listed_paths(co().inventory.listing(self.repo, self.sha, ignored))
        return co().check_citation(self.repo, self.sha, item, ignored, listed)

    def test_a_line_with_its_quote_passes(self):
        self.assertIsNone(self.cite(path="CLAUDE.md", start=7, quote="Test methods use the"))

    def test_a_range_passes_and_a_reversed_range_fails(self):
        self.assertIsNone(self.cite(path="CLAUDE.md", start=7, end=8))
        self.assertIn("range", self.cite(path="CLAUDE.md", start=8, end=7))

    def test_a_range_of_20_lines_is_allowed_and_21_is_not(self):
        self.assertNotIn("20 lines", self.cite(path="CLAUDE.md", start=1, end=20))
        self.assertIn("20 lines", self.cite(path="CLAUDE.md", start=1, end=21))

    def test_past_the_end_fails(self):
        self.assertIn("past the end", self.cite(path="CLAUDE.md", start=99))

    def test_a_quote_not_on_the_line_fails(self):
        self.assertIn("quote", self.cite(path="CLAUDE.md", start=7, quote="Use Laravel facades"))

    def test_a_path_in_ignored_fails(self):
        self.assertIn("ignored", self.cite(path="app/Legacy/OldBilling.php", start=3, quote="secret pricing"))

    def test_a_parent_path_and_an_absolute_path_fail(self):
        self.assertIn("repo-relative", self.cite(path="../x", start=1))
        self.assertIn("repo-relative", self.cite(path="/etc/hosts", start=1))

    def test_a_blank_line_fails(self):
        self.assertIn("blank", self.cite(path="CLAUDE.md", start=11))

    def test_a_file_absent_at_read_at_fails(self):
        put(self.repo, "later.php", "<?php\n")
        self.assertIn("not a path the inventory lists", self.cite(path="later.php", start=1))
        self.assertIn("not a path the inventory lists", self.cite(path="nope.php", start=1))

    def test_a_folder_fails(self):
        self.assertIn("not a path the inventory lists", self.cite(path="app", start=1))

    def test_the_file_is_read_at_the_commit_not_the_working_tree(self):
        put(self.repo, "CLAUDE.md", "changed\n")
        self.assertIsNone(self.cite(path="CLAUDE.md", start=7, quote="Test methods use the"))

    def test_a_commit_in_history_passes_with_a_subject_quote(self):
        item = {"kind": "commit", "sha": self.info["commit_2"], "quote": "feat(orders)"}
        self.assertIsNone(co().check_citation(self.repo, self.sha, item, set(), set()))

    def test_an_unknown_commit_fails(self):
        item = {"kind": "commit", "sha": "deadbeef", "quote": "x"}
        self.assertIn("commit", co().check_citation(self.repo, self.sha, item, set(), set()))

    def test_a_commit_not_reachable_from_read_at_fails(self):
        tree = git(self.repo, "rev-parse", "HEAD^{tree}")
        later = git(self.repo, "commit-tree", tree, "-p", "HEAD", "-m", "feat: later")
        item = {"kind": "commit", "sha": later[:10], "quote": "later"}
        self.assertIn("reachable", co().check_citation(self.repo, self.sha, item, set(), set()))

    def test_a_commit_quote_not_in_the_subject_fails(self):
        item = {"kind": "commit", "sha": self.info["commit_2"], "quote": "fix(orders)"}
        self.assertIn("subject", co().check_citation(self.repo, self.sha, item, set(), set()))

    def test_a_known_branch_passes_and_an_unknown_one_fails(self):
        known = {"kind": "branch", "name": "feature/ORD-12-cancel-refund"}
        self.assertIsNone(co().check_citation(self.repo, self.sha, known, set(), set()))
        self.assertIn("branch", co().check_citation(self.repo, self.sha, {"kind": "branch", "name": "nope"}, set(), set()))


class ReportCitations(Golden):
    def test_a_row_with_no_citation_fails(self):
        self.edit("standards-report.md", '| `composer.json:7` "php-cs-fixer fix --dry-run --diff" |', "|  |")
        self.assertProblem("composer lint", "citation")

    def test_a_file_citation_without_a_quote_fails(self):
        self.edit("standards-report.md", '`composer.json:7` "php-cs-fixer fix --dry-run --diff"', "`composer.json:7`")
        self.assertProblem("composer.json:7", "quote")

    def test_a_wrong_quote_is_named_with_its_row(self):
        self.edit("standards-report.md", '"DB::transaction"', '"DB::nothing"')
        self.assertProblem("Facades are used", "quote")

    def test_a_citation_into_an_ignored_path_fails(self):
        self.edit("standards-report.md", '`app/Orders/CreateOrderHandler.php:13` "DB::transaction"', '`app/Legacy/OldBilling.php:3` "secret pricing"')
        self.assertProblem("ignored")

    def test_an_unknown_branch_fails(self):
        self.edit("standards-report.md", "branch:feature/ORD-12-cancel-refund", "branch:feature/nope")
        self.assertProblem("branch")

    def test_a_read_at_that_is_not_a_commit_fails(self):
        self.edit("standards-report.md", "Read at: " + self.info["read_at"], "Read at: " + "0" * 40)
        self.assertProblem("Read at")


class ReadAtAndIgnoredPaths(Golden):
    def test_a_read_at_that_differs_from_the_inventorys_stops(self):
        tree = git(self.repo, "rev-parse", "HEAD^{tree}")
        other = git(self.repo, "commit-tree", tree, "-p", "HEAD", "-m", "feat: other")
        self.edit("standards-report.md", "Read at: " + self.info["read_at"], "Read at: " + other)
        self.assertProblem("inventory.json", "Read at")

    def test_a_missing_inventory_json_is_a_problem(self):
        os.remove(os.path.join(self.work, "inventory.json"))
        self.assertProblem("inventory.json")

    def test_a_citation_into_a_path_at_read_at_but_not_in_the_index_is_ignored(self):
        git(self.repo, "rm", "-q", "--cached", "app/Legacy/OldBilling.php")
        self.edit(
            "standards-report.md",
            '`app/Orders/CreateOrderHandler.php:13` "DB::transaction"',
            '`app/Legacy/OldBilling.php:3` "secret pricing"',
        )
        self.assertProblem("ignored")

    def test_a_branch_that_is_not_in_the_inventory_list_fails(self):
        git(self.repo, "branch", "feature/later")
        self.edit("standards-report.md", "branch:feature/ORD-12-cancel-refund", "branch:feature/later")
        self.assertProblem("inventory.json", "feature/later")

    def test_a_policy_json_edited_to_drop_the_warnings_still_ignores(self):
        policy = json.loads(read(self.work, "policy.json"))
        policy["warnings"] = [w for w in policy["warnings"] if w.get("signal") != "ignore-file"]
        put(self.work, "policy.json", json.dumps(policy))
        self.edit(
            "standards-report.md",
            '`app/Orders/CreateOrderHandler.php:13` "DB::transaction"',
            '`app/Legacy/OldBilling.php:3` "secret pricing"',
        )
        self.assertProblem("app/Legacy/OldBilling.php:3", "ignored")

    def test_an_uncommitted_ignore_line_is_a_problem(self):
        put(self.repo, ".aiignore", read(self.repo, ".aiignore") + "app/Orders/\n")
        self.assertProblem(".aiignore", "differs")

    def test_a_citation_outside_the_listed_paths_fails_even_when_inventory_json_lists_it(self):
        listing = json.loads(read(self.work, "inventory.json"))
        listing["sources"]["docs"].append(".aiignore")
        put(self.work, "inventory.json", json.dumps(listing))
        self.edit("standards-report.md", '`composer.json:7` "php-cs-fixer fix --dry-run --diff"', '`.aiignore:2` "app/Legacy/"')
        self.assertProblem(".aiignore:2", "not a path the inventory lists")

    def test_overlay_evidence_outside_the_listed_paths_fails(self):
        self.edit("standards-report.md", '`CLAUDE.md:12` "Use Laravel facades"', '`.aiignore:2` "app/Legacy/"')
        self.edit(".ai/kanon.yml", "CLAUDE.md:12", ".aiignore:2")
        self.assertProblem("overlay[1]", ".aiignore:2", "not a path the inventory lists")

    def test_a_fourth_sibling_of_a_kind_is_not_listed(self):
        for name in ("A", "B", "C"):
            put(self.repo, f"app/Orders/{name}Handler.php", "<?php\n")
            git(self.repo, "add", "-A")
            git(self.repo, "commit", "-q", "-m", f"add {name}")
        listed = co().inventory.listed_paths(co().inventory.listing(self.repo, git(self.repo, "rev-parse", "HEAD"), set()))
        self.assertIn("app/Orders/CHandler.php", listed)
        self.assertNotIn("app/Orders/CreateOrderHandler.php", listed)

    def test_a_folder_inside_the_repo_is_a_problem(self):
        code, result = run_json("check-overlay.py", "--work", self.work, "--repo", os.path.join(self.repo, "app"), "--kanon-root", REPO_ROOT)
        self.assertEqual(code, 1)
        self.assertIn("top level", json.dumps(result["problems"]))

    def test_ignored_by_matches_the_tree_of_a_commit_not_the_index(self):
        git(self.repo, "rm", "-q", "--cached", "app/Legacy/OldBilling.php")
        inventory = load_script("inventory.py")
        self.assertEqual(inventory.ignored_by(self.repo, ["app/Legacy/"], self.info["read_at"]), {"app/Legacy/OldBilling.php"})


class ReportAndOverlayAgree(Golden):
    def test_a_row_with_no_entry_fails(self):
        self.edit(".ai/kanon.yml", ORCH_011, "")
        self.assertProblem("ORCH-011", "no overlay entry")

    def test_an_entry_with_no_row_fails(self):
        text = read(self.work, "standards-report.md")
        kept = [line for line in text.splitlines(True) if not line.startswith("| Every PHP file opens")]
        put(self.work, "standards-report.md", "".join(kept))
        self.assertProblem("ORCH-011", "no row")

    def test_a_row_whose_effect_differs_from_its_entry_fails(self):
        self.edit("standards-report.md", "| configured | ORCH-011 | adopt |", "| configured | ORCH-011 | off |")
        self.assertProblem("ORCH-011", "effect")

    def test_project_only_with_a_rule_fails_and_adopt_with_none_fails(self):
        self.edit("standards-report.md", "| configured | none | project-only |\n| `composer", "| configured | ORCH-011 | project-only |\n| `composer")
        self.assertProblem("project-only")


class SilentOn(Golden):
    def test_a_family_missing_from_the_list_fails(self):
        self.edit("standards-report.md", "- http-api\n", "")
        self.assertProblem("Silent on", "http-api")

    def test_a_family_that_has_an_entry_fails(self):
        self.edit("standards-report.md", "- http-api\n", "- http-api\n- orchestration-di\n")
        self.assertProblem("Silent on", "orchestration-di")

    def test_symfony_listed_for_laravel_fails(self):
        self.edit("standards-report.md", "- http-api\n", "- http-api\n- symfony\n")
        self.assertProblem("Silent on", "symfony")

    def test_an_entry_outside_the_reports_framework_fails(self):
        self.edit("standards-report.md", "Framework: laravel", "Framework: symfony")
        self.assertProblem("overlay[0]", "ORCH-011", "not a symfony family")

    def test_the_symfony_set_is_symfony_php_core_and_reliability(self):
        module = co()
        kanon = module.load_kanon(REPO_ROOT)
        self.assertEqual(module.silent_set(kanon, "symfony", set()), {"symfony", "php-core", "reliability"})
        self.assertNotIn("symfony", module.silent_set(kanon, "laravel", set()))
        self.assertEqual(len(module.silent_set(kanon, "laravel", set())), 13)


class CheckPolicyReadsTheOverlay(TempDirs):
    def test_check_policy_reads_the_golden_overlays_mode(self):
        text = read(fs.EXPECTED, ".ai/kanon.yml")
        repo = self.tmp()
        git(repo, "init", "-q", "-b", "main")
        put(repo, "README.md", "hello\n")
        put(repo, ".ai/kanon.yml", text)
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "init")
        git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
        mode, path, blocking = cp().client_record({}, "acme/shop", repo)
        self.assertEqual(mode, "project-first")
        self.assertIsNone(path)
        self.assertEqual([b["field"] for b in blocking], ["record"])
        self.assertEqual(co().parse_kanon_yml(text)["mode"], mode)


class KanonRoot(Golden):
    def installed_layout(self):
        root = self.tmp()
        for rel in ("kanon/catalog", "kanon/laravel-kanon/references", "kanon/symfony-kanon/references"):
            shutil.copytree(os.path.join(REPO_ROOT, rel), os.path.join(root, rel))
        return root

    def test_a_copy_laid_out_as_the_installed_skill_folder_resolves(self):
        root = self.installed_layout()
        code, result = run_json("check-overlay.py", "--work", self.work, "--repo", self.repo, "--kanon-root", root)
        self.assertEqual((code, result["result"]), (0, "ok"))

    def test_a_root_without_families_json_exits_2(self):
        code, out, err = run_script("check-overlay.py", "--work", self.work, "--repo", self.repo, "--kanon-root", self.tmp())
        self.assertEqual(code, 2)
        self.assertIn("families.json", err)

    def test_the_default_root_is_the_skill_folder_then_the_repo_root(self):
        module = co()
        skill = self.tmp()
        self.assertIsNone(module.default_kanon_root(skill))
        shutil.copytree(os.path.join(self.installed_layout(), "kanon"), os.path.join(skill, "kanon"))
        self.assertEqual(module.default_kanon_root(skill), skill)
        self.assertEqual(module.default_kanon_root(fs.SKILL), REPO_ROOT)

    def test_without_a_root_flag_the_repo_layout_resolves(self):
        code, result = run_json("check-overlay.py", "--work", self.work, "--repo", self.repo)
        self.assertEqual((code, result["result"]), (0, "ok"))


class Usage(Golden):
    def test_a_missing_policy_json_is_a_problem(self):
        os.remove(os.path.join(self.work, "policy.json"))
        self.assertProblem("policy.json")

    def test_a_missing_overlay_is_a_problem(self):
        os.remove(os.path.join(self.work, ".ai/kanon.yml"))
        self.assertProblem(".ai/kanon.yml")

    def test_a_repo_that_is_not_a_folder_exits_2(self):
        code, out, err = run_script("check-overlay.py", "--work", self.work, "--repo", "/no/such/dir", "--kanon-root", REPO_ROOT)
        self.assertEqual(code, 2)
        self.assertIn("--repo", err)

    def test_the_check_runs_no_command_that_writes_in_the_repo(self):
        before = fs.snapshot(self.repo)
        self.assertEqual(self.check()[0], 0)
        self.assertEqual(fs.snapshot(self.repo), before)


if __name__ == "__main__":
    unittest.main()
