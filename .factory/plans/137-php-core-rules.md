# Plan for #137, Kanon php-core: add the 39 plain-PHP rules raised by the Symfony overlay

Issue codysseydev/codyssey-skills#137. Base origin/main 99bd2e6. Branch `factory/137`. Kind: feature.

## Goal

Add 39 `scope: php-core` entries to `kanon/catalog/php-core.json`, one per row the owner kept in the #131 php-core table (https://github.com/codysseydev/codyssey-skills/pull/131#issuecomment-7185815574). IDs continue from PHP-009.

## Measured before planning

- `php-core.json` holds PHP-001 to PHP-008 in four sections. The generated `php-core.md` sits in `kanon/laravel-kanon/references/` and is required reading for every Laravel production class (`kanon/laravel-kanon/SKILL.md:59`, `:68`) and every Symfony change (`kanon/symfony-kanon/SKILL.md:48`). Every new rule therefore binds Laravel and Symfony code.
- Clash sweep of the 39 rows against the Laravel catalog and `symfony.json`: 21 rows need a scope or carve-out so they hold in both frameworks; 18 only point at their Laravel counterpart. The main clashes: P-42 (Laravel's domain model is the Eloquent model, ORCH-008 requires `Illuminate\Contracts` imports), P-44 (Laravel has no repository layer; MD-006 and ORCH-006 put finders on the model), P-46 (ORCH-008 allows `CarbonImmutable::now()`), P-48 (TEST-011 and TEST-012 use facade fakes), P-43 (MD-032, MD-030 and ORCH-006 keep the `findOrFail()` carve-out), P-32 (SYM-017 makes Symfony command handlers return void), P-09, P-18, P-28 (the php-core intro hands file shape to `orchestration-di.md`), P-22 (MD-012's allowed-trait list is Laravel-only), P-07 (MD-006 finders on the model against SYM-064), P-16 against SYM-070 and P-15.
- Sources: published lessons back Anemic, EvtBus, DomSvc (read as "The Service Pattern"), FwCoupling, Repo, InputVal, DI and CmdBus, and quick tip 09 ("Throw a Domain Exception, Not a Framework One") backs P-43. The draft insight and the Anti-Corruption Layer lesson are unpublished and are not cited. No Laravel counterpart has `sources` at the base commit.
- Overlap with running sessions: #49 adds `sources` to PHP-001, 003, 004, 005, 007 and 008 and changes `kanon/scripts/catalog.test.mjs`. #47 changes PHPArkitect `checks` status in `symfony.json`. #44 rewrites `kanon/laravel-kanon-audit/SKILL.md`, whose php-core topic line (`:83`) goes stale once these rules land. #51, #52 and #54 later extract from the same published lessons and should skip ideas linked here.
- #139 (the MockHttpClient rule) does not block this plan. P-48 names no HTTP client.

## Owner decisions (2026-11-26, in session, before this comment)

1. Per-row wording and keyword reach the owner as a PR-body table, as in #131. Entries open as `status: candidate`. After the owner's PR-comment decisions they become `active`, rejected ones are removed (their IDs leave gaps), and the generated files are regenerated.
2. The rows that clash with Laravel Kanon are drafted with a scope that holds in Laravel too: P-42 bans HTTP or request-scoped and persistence-driver types in domain code only; P-44 applies where a repository exists; P-46 has a class that reads the time receive a clock or the overlay's sanctioned clock call; P-48 applies where commands go through a bus; P-43 keeps the plain id lookup carve-out. The PR table quotes each clash.
3. The php-core intro line on lane boundaries and PHP-001's `lane_note` are rewritten: php-core owns the plain-PHP file shape (`strict_types`, `final readonly`, constructor promotion) for every framework, and `orchestration-di.md` keeps the Laravel calls and the Laravel-only file kinds. No Laravel entry changes.
4. New entries cite published codyssey.dev URLs only. P-43 cites quick tip 09. The DomSvc reading is flagged in the table.
5. P-32 follows PHP-008. Its `lane_note` says SYM-017 narrows command handlers to void in Symfony. No Symfony entry changes.
6. Merge order: #49 first. After #49 merges, origin/main is merged into this branch (never rebased or force-pushed, since the branch is pushed), then `generate` and every gate are rerun. This change does not touch `kanon/laravel-kanon-audit/SKILL.md`; the #44 session gets the new topic list.

## Changes

### `kanon/catalog/php-core.json`

- The intro line and PHP-001 `lane_note` as in decision 3. PHP-001 to PHP-008 keep their wording, keyword and section.
- New sections after the existing four, in this order, with IDs given in section order from PHP-009 at PR open and never changed:
  - Naming: P-01, P-02, P-04, P-05, P-06.
  - File shape: P-09, P-13, P-22, P-28, P-33.
  - Domain model: P-07, P-08, P-23, P-24, P-25, P-26, P-27, P-29, P-30, P-31, P-32, P-43.
  - Boundaries and integrations: P-15, P-16, P-17, P-18, P-19, P-42, P-44.
  - Input and authorization: P-21, P-45.
  - Time and caching: P-14, P-46.
  - Events: P-41.
  - Testing: P-35, P-36, P-37, P-38, P-48.
- Every entry has `id`, `family: php-core`, `scope: php-core`, `keyword` (starting from the Laravel counterpart's), a one-line `rule` whose first bold keyword equals `keyword`, `status: candidate`, `examples` with a short bad and good plain PHP 8.4 snippet that imports no framework, and a `lane_note` naming the Laravel counterpart ID or stating there is none, plus the Symfony counterpart where the issue names one. `sources` where a published item backs it. `detect` and `checks` (PHPStan, PHPArkitect or Deptrac, status `draft`, never Pest) where they fit. `why` only as a literal substring of `rule`. No `duplicate_of` (#129 owns that question).
- Laravel-only and Symfony-only parts found in the sweep stay in their framework entries and are not copied.

### `kanon/laravel-kanon/references/php-core.md` and `kanon/scripts/fixtures/php-core.base.md`

- Generated with `node kanon/scripts/catalog.mjs generate`, never hand-edited. At PR open the new sections render as bare headings and the intro rewrite renders in full; the fixture is regenerated to match. After the decisions both are regenerated again.

## Diagrams

No diagrams: no trigger fired.

## How it gets built

1. Draft the eight sections in parallel into scratch fragments, merge them into `php-core.json` in one pass and run `generate`.
2. Check each draft against its Laravel counterpart and `symfony.json` for the clashes above.
3. Run every recipe gate at the head commit from a clean tree and open a ready PR with the draft table (P row, ID, section, rule, keyword, Laravel counterpart, Symfony counterpart, source, clash note) and the gate evidence.
4. Apply the owner's PR-comment decisions, regenerate, rerun the gates, update the evidence, merge origin/main into the branch after #49 lands and rerun `generate` and the gates, and wait for the merge word.

## Verification

From the worktree root at the head commit, clean tree: every check in `.factory/recipe.yml`, including `node kanon/scripts/catalog.mjs check --base origin/main` and `node --test kanon/scripts/catalog.test.mjs`. `git diff origin/main -- kanon/catalog ':!kanon/catalog/php-core.json'` is empty. Each of the 39 entries has a `lane_note`.

## Out of scope

- Any Laravel or Symfony entry's wording or keyword.
- The 8 dropped rows and the 2 rows kept in Laravel only (P-20, P-49).
- `kanon/laravel-kanon-audit/SKILL.md` (#44), `duplicate_of` (#129), #138 and #139.
