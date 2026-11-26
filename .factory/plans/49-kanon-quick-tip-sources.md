# Plan for #49, link the 58 quick tips as sources

Issue codysseydev/codyssey-skills#49. Base origin/main 99bd2e6. Branch `claude/factory-49-665980`. Kind: feature.

Approved by the owner on 2026-11-26: the recommended option for all four open decisions.

## Goal

Each Codyssey quick tip that backs a Kanon rule is linked from that rule's catalog entry through `sources`. Every one of the 58 tips is either linked or listed in the PR with the reason it is not. No entry's `keyword`, `rule` or `items` changes.

## Measured on origin/main 99bd2e6

- Source of the mapping: the owner's review sheet "Kanon catalog pilot: quick tip review" (2026-11-19), 58 rows: 43 candidates (31 approved, 11 edited, 1 rejected), 11 matches, 4 not a code rule. Its proposed IDs (`HTTP-108`, `MD-104`, ...) and its `ORCH-0xx` IDs come from the pilot and are stale: #33 to #42 renumbered every rule. The mapping below matches by rule wording against the current catalog, and by the pre-conversion line numbers in `c315e0e^` where the sheet cites `file.md Lnn`. The full table is in the run notes (`issue49-tip-mapping.tsv`).
- Codyssey MCP, 2026-11-26: the catalog holds exactly these 58 quick tips. 29 are published. 29 are scheduled, with publish dates from 2026-11-27 to 2027-01-15. Each URL comes from the MCP `fetch` response and has the form `https://codyssey.dev/quick-tips/<slug>`.
- Only `symfony.json` has quick tip sources today, from #62: `inject-symfony-services-dont-fetch-them` on SYM-001 and SYM-006, `use-messenger-for-commands-not-just-async-jobs` on SYM-002, SYM-012, SYM-026, SYM-027 and SYM-036, `throw-a-domain-exception-not-a-framework-one` on SYM-069. The first two are scheduled (2026-12-23 and 2027-01-14).
- `catalog.mjs` never reads `sources`, so `generate` leaves every reference unchanged. The diff is JSON only.
- `catalog.test.mjs:691-704` asserts that no `orchestration-di` entry has `sources`. That is #33's "converted with sources empty" criterion, and linking ORCH entries breaks it.

## Changes

### `kanon/catalog/*.json`

Add `sources` (or append to an existing array) on these entries, published tips only (decision 1). One primary entry per tip, plus a second entry only where the review sheet itself names two targets (decision 2).

| Row | Tip slug | Entry |
|---|---|---|
| 4 | service-location-is-a-hidden-dependency | ORCH-008, PHP-001 |
| 7 | allowlist-sort-columns-with-an-enum | HTTP-013 |
| 8 | dont-spread-validated-into-create | HTTP-015 |
| 9 | give-each-intent-its-own-endpoint | HTTP-002 |
| 13 | the-date-rule-accepts-dates-your-query-doesnt | HTTP-012 |
| 15 | a-string-is-not-an-email | MD-025 |
| 16 | dont-save-the-row-from-its-own-observer | MD-008 |
| 17 | never-run-a-query-inside-an-accessor | MD-009 |
| 20 | never-inject-a-controller-into-another-controller | ORCH-022 |
| 21 | dont-filter-in-php-what-the-database-can-filter | PERF-001 |
| 22 | dont-fix-a-lazy-loading-exception-with-with | PERF-002 |
| 23 | keep-the-foreign-keys-in-your-select | PERF-004 |
| 24 | stop-eager-loading-on-the-model | PERF-003 |
| 25 | stop-selecting-every-column | PERF-005 |
| 27 | composition-over-inheritance | PHP-003 |
| 28 | guard-clauses-beat-nested-ifs | PHP-005 |
| 29 | replace-null-checks-with-a-null-object | PHP-004 |
| 31 | readonly-is-not-immutability | PHP-007 |
| 35 | one-form-request-per-write-action | HTTP-009 |
| 38 | named-constructors-over-new-plus-setters | MD-027 |
| 40 | throw-a-domain-exception-not-a-framework-one | MD-032 (SYM-069 already linked) |
| 42 | dont-read-auth-user-inside-a-use-case | ORCH-021 |
| 44 | commands-change-state-queries-return-it | PHP-008 |
| 47 | dont-put-business-rules-in-traits | MD-012 |
| 49 | a-facade-is-service-location-too | ORCH-008, ORCH-028 |
| 55 | tell-dont-ask | ORCH-005 (decision 3) |

Not linked in this PR, each listed in the PR body with its reason:

- Rows 56, 57, 59 (published) and 58 (scheduled): load-testing practice, not a code rule. No catalog entry covers load testing.
- The 29 scheduled tips other than row 58 wait for their publish date (decision 1). Their mapping is ready: 2 INT-003 (the owner's 2026-11-19 decision), 3 MD-031, 5 PERF-006, 6 TEST-002, 10 HTTP-014, 11 HTTP-011, 12 HTTP-010, 14 INT-013, 18 MD-026, 19 MD-011, 26 PHP-002, 30 PHP-006, 32 REL-001, 33 SYM-001 (linked by #62), 34 SYM-002 (linked by #62), 36 HTTP-001, 37 INT-004, 39 MD-007, 41 ORCH-036, 43 ORCH-032, 45 ARCH-009, 46 ISO-005 and PERS-004, 48 MD-021, 50 MD-006, 51 see decision 3, 52 ORCH-018, 53 ORCH-028, 54 ORCH-031 and HTTP-029.
- Publish status is checked again through the MCP right before the PR. A tip that went live by then (row 30 on 2026-11-27, row 11 on 2026-11-30) moves into the table.

Each entry keeps its key order: `sources` goes where the schema lists it, after `examples` and before `lane_note`, `duplicate_of` and `status`, matching the existing `symfony.json` entries. No other field changes.

### `kanon/scripts/catalog.test.mjs`

- The test at lines 691-704 drops its `sources` assertion and is renamed to "why is a substring of rule (criterion 3)". The 37-ID sequence and `why` checks stay (decision 4).

## For the owner, no change made

- Row 51 "Don't Return the Eloquent Model From a Handler": no rule says a handler must not return an Eloquent model. ORCH-020 says handlers return typed Result DTOs, never associative arrays. Wording is the owner's call.
- Row 43 "Stop Passing Eloquent Models Everywhere": the tip covers more than queued jobs. ORCH-032 (jobs) and MD-022 (events) each cover one case.
- Row 2 stays a source for INT-003's conditional SHOULD, per the 2026-11-19 decision.

## Overlap with other open work

- #137 (39 plain-PHP rules into `php-core.json`) and #138 (5 Symfony rules into `symfony.json`) run in a sibling session, and #47 may write catalog files. This PR edits `php-core.json` (PHP-001, PHP-003, PHP-004, PHP-005, PHP-007, PHP-008) and not `symfony.json`. The change is a few added lines per entry, so a conflict is a local merge. Right before the PR: rebase onto origin/main, run `node kanon/scripts/catalog.mjs generate`, and re-check rows 26 to 31, 44 and 55 against any new php-core rule that fits them better.
- Row 40 ("Throw a Domain Exception, Not a Framework One") is linked here from MD-032. #137 plans a new php-core rule backed by the same tip (its candidate P-43). Whether that new entry also cites the tip is asked in #137's plan, not here.

## Acceptance evidence

1. Every tip accounted for: a table in the PR with all 58 rows, each linked (entry IDs) or not linked (reason).
2. No wording change: `git diff origin/main -- kanon/catalog` shows only added `sources` lines.
3. References unchanged: `generate` leaves `git status` clean for every `references/*.md`.
4. Every linked URL equals the `url` field of the MCP `fetch` response for that tip, and the tip's MCP status is `published` on the day of the PR.

## Gates

The 12 recipe checks from the worktree root at the head commit, clean tree. No Kanon audit: the repo has no PHP. Diagrams: no trigger fired. Event model and boards: none, internal data change.

## Out of scope

- New rules and any rule wording change.
- Linking the scheduled tips: a follow-up issue after the last publish date (2027-01-15).
- Course lessons, code reviews, insights and project briefs: #50 to #57.

## Open decisions

The plan implements the recommended option of each unless the owner picks otherwise.

1. Scheduled tips. Recommended: link only published tips now and keep #62's two scheduled links in `symfony.json`; a follow-up issue links the rest after 2027-01-15. Alternatives: link all 58 now; or link only published tips and also remove #62's two scheduled links.
2. Link scope. Recommended: one primary entry per tip, plus a second entry where the sheet names two targets. Alternative: also link the php-core parent and the Symfony counterpart of each Laravel rule, as #62 did with one tip on five SYM entries.
3. Rows 55 and 51. Recommended: row 55 to ORCH-005 (condition-plus-action on the model, the rule the sheet pointed at); row 51 not linked until its wording question is answered. Alternatives: row 55 to MD-006, which names "Tell, Don't Ask"; row 51 to ORCH-020 as the nearest rule.
4. Test change. Recommended: drop only the `sources` assertion in `catalog.test.mjs:701`. Alternative: replace it with a check that every `sources` item is an `https://` URL.
