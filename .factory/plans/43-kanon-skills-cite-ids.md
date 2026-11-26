# Plan for #43, Kanon skills cite rule IDs

Issue codysseydev/codyssey-skills#43. Base origin/main 1d7bf78. Branch `claude/nostalgic-clarke-136a4f`. Kind: feature.

Approved by the owner on 2026-11-26: option A for all four open decisions.

## Goal

The two writing skills and the audit work from rule IDs. An audit finding cites the violated rule's ID, and a finding with no catalog ID is dropped. `laravel-kanon` and `symfony-kanon` list unsatisfied rules by ID. Each generated reference starts with a line saying it is generated and naming the command. The README says how to add, change or deprecate a rule. `duplicate_of` is set in one pass, and the catalog check fails when a target ID does not exist.

## Measured on origin/main 1d7bf78

- 14 family files, 209 entries. Every reference already prints each rule's ID as a leading code span (``- `ORCH-008` ...``), since #33. No entry sets `duplicate_of`.
- `laravel-kanon-audit/SKILL.md` inlines each reference whole into its auditor prompt (step 2). Its contract asks for `path:line - <rule, quoted with its MUST/SHOULD keyword> - why - fix - severity` (line 104) and never asks for the ID. Its last note says to edit the rules in `references/`, which is wrong since #33: the references are generated.
- `laravel-kanon/SKILL.md:61` and `symfony-kanon/SKILL.md:42` say "list any canon rules you could not satisfy and why", with no ID.
- README `## kanon/` says nothing about the catalog.
- The catalog tests compare each generated reference, IDs stripped, against `kanon/scripts/fixtures/<family>.base.md` (words and code spans), and the shapes render against `shapes.expected.md`. A header line changes both, so the comparisons strip it.
- The paths test collects every backticked lowercase `name.md` in the three Kanon `SKILL.md` files and requires it to exist in a references folder. New `SKILL.md` text names no other `.md` file in backticks.
- Baseline gates, all 12 exit 0: pick-up 108, post-merge 23, capture-ui 115, trial-decision 39, test-first 36, bootstrap 3, event-model 4, factory-onboard 28, standards-discovery 71, install 30, catalog check "14 family file(s), 209 entries", catalog tests 36.

## Changes

### `kanon/scripts/catalog.mjs`

- `render()` writes one header line before `# title` (decision 1). It names the family's catalog file, the codysseydev/codyssey-skills repo (references are copied into other projects) and `node kanon/scripts/catalog.mjs generate`.
- `check`: every `duplicate_of` names an ID that exists in the catalog (any family, any status) and is not the entry's own ID. The problem line names the file, the entry and the missing ID.

### `kanon/catalog/*.json`

- `duplicate_of` on the pairs of decision 3. No other field changes: no `rule`, `items` or `keyword` edit.

### References (regenerated)

- All 14 gain the header line and nothing else.

### `kanon/scripts/catalog.test.mjs` and fixtures

- Header: each generated reference's first line is the header naming its own catalog file and the generate command. A reference with the header removed fails `check` (the existing hand-edit check covers it, the test proves it).
- The base-fixture and shapes comparisons strip the header line. `shapes.expected.md` gains it.
- `duplicate_of`: an unknown target fails and the line names it; a self target fails; an existing target passes.
- Audit fixture (decision 4): the IDs the fixture must report are active catalog rules.

### `kanon/laravel-kanon-audit/SKILL.md`

- Contract finding format: `path:line - <ID> <rule, quoted with its keyword> - why - fix - severity`. The ID is the code span at the start of the rule's bullet or numbered item in the reference; a violation of a nested item cites its parent's ID. A finding with no catalog ID is dropped.
- Synthesis drops any finding whose ID is not in the inlined references. Deduplication stays per `path:line` as today (one line flagged by two families keeps the better-cited finding). The report template lines carry the ID.
- Notes: the references are generated from `kanon/catalog/` in codyssey-skills. Edit the catalog, not the references.

### `kanon/laravel-kanon/SKILL.md` and `kanon/symfony-kanon/SKILL.md`

- "When you finish, list by ID (for example `ORCH-008`) any canon rules you could not satisfy and why." Plus one line: each rule in the references starts with its ID.

### `README.md`

- New `### Changing a rule` under `## kanon/`: add a rule (next free number after the family prefix from `kanon/catalog/families.json`, never reuse an ID), change one, or deprecate one (`"status": "deprecated"`, never delete: `check --base origin/main` fails on a deleted ID), then run `generate` and `check --base origin/main`. It says that `check` fails when a generated reference is edited by hand.

## Acceptance evidence

1. Audit on a fixture diff: a subagent follows `laravel-kanon-audit/SKILL.md` on the fixture diff in a scratch git repo. Its report names the expected ID. The report goes in the PR under `## Verification`.
2. Hand edit fails the check: the existing test plus the new header test, and the README says so.
3. No wording change: `git diff origin/main -- kanon/catalog` shows only added `duplicate_of` lines, and the base-fixture test passes.

## Gates

The 12 recipe checks from the worktree root at the head commit, clean tree. No Kanon audit of this repo: it has no PHP. The fixture audit run is acceptance evidence, not a gate.

## Out of scope

- Splitting the audit (#44), `kanon-compile` (#47).
- Resyncing the reference copies in laravel-template and symfony-template with their `scripts/sync-rules.py`. Their drift tests trip on the header line. Follow-up, named in the PR.
- The open wording and keyword questions on #35, #36, #38 and #41. Untouched.
- Duplicate pairs left unset by decision 3 go to one question comment on #43.
- Diagrams: no trigger fired. Event model and boards: none, internal tooling.

## Open decisions

The plan implements option A of each unless the owner picks otherwise.

1. Header line.
   - **A. HTML comment on line 1 (recommended):** `<!-- Generated from kanon/catalog/<family>.json in codysseydev/codyssey-skills by "node kanon/scripts/catalog.mjs generate". Do not edit by hand. -->`. Agents and editors see it; rendered markdown does not.
   - **B. Visible italic line on line 1:** `_Generated from kanon/catalog/<family>.json in codysseydev/codyssey-skills by ... Do not edit by hand._`. Shows in rendered views too.
2. What `duplicate_of` does.
   - **A. Catalog metadata only (recommended).** The generated references stay as they are apart from the header, so no rule leaves the text agents read. #44 and #47 can read the link later.
   - **B. The generator marks the duplicate in the reference** (for example a trailing "(see `X-000`)"), so the audit skips it. Adds text to rule lines, which breaks the base-fixture word test and acceptance criterion 3 (no wording change) unless both are relaxed.
3. Which pairs get `duplicate_of`. Overlays (SYM-001 and ORCH-008 of PHP-001, FIL-002, FIL-006, FIL-007, FIL-010, SYM-002, PERS-002, PERS-003, PERS-004) stay unlinked in every option.
   - **A. Seven pairs where one entry adds nothing or cites the other (recommended):** ARCH-012 to ARCH-003, INT-014 to ORCH-029, PERS-010 to ORCH-010, PERS-007 to INT-011, HTTP-008 to AUTH-006, ORCH-024 to MD-029, AUTH-005 to ORCH-025. The four with a contested direction (HTTP-005 and ORCH-037, MD-003 and PERS-011, MD-030 and ORCH-006, MD-024 and ORCH-012/ORCH-014) stay unset and go to a question comment on #43.
   - **B. Only the four pairs the conversion PRs flagged for #43:** ARCH-012 to ARCH-003, PERS-007 to INT-011, AUTH-005 to ORCH-025, HTTP-008 to AUTH-006. MD-024, also flagged, waits on #36.
   - **C. None now.** Ship the check only and ask about every pair on #43.
4. Audit fixture.
   - **A. Committed fixture plus test (recommended):** `kanon/scripts/fixtures/audit/` holds a small diff adding a handler that calls the `Log` facade (ORCH-008) and `expected.json` naming `ORCH-008`. A catalog test asserts each expected ID is an active rule, so the fixture cannot rot when a rule is deprecated.
   - **B. Evidence only:** the fixture lives in the scratchpad and only the run output goes in the PR.
