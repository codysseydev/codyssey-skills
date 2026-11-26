# Plan for #62, Symfony pack stage 1: grow the Symfony overlay into a full rule set

Issue codysseydev/codyssey-skills#62. Base origin/main 1d7bf78. Branch `factory/62`. Kind: feature. Outside the shared conversion plan, so it has its own plan stop.

## Goal

Add Symfony candidates to `kanon/catalog/symfony.json` as `scope: symfony` entries: the Symfony counterparts of the Laravel families converted in #34 to #41, and rules from Codyssey's Symfony content. The owner decides each candidate from a table in the PR body; the run applies those decisions before the merge.

## Measured before planning

- 125 drafted candidates in 12 sections, 3 "add a source" rows on SYM-001 and SYM-002, 49 rules that hold in plain PHP (php-core questions), and 13 Laravel-only rules plus the Filament family, which get no Symfony form.
- Content: 45 lessons in Building Maintainable PHP Applications 1 to 5 mention Symfony (4, 26, 5, 5, 5). The 35 in courses 1 to 3 are published; the 10 in courses 4 and 5 are not. 31 rule ideas came from the content, 28 of them merged into candidates.
- APIs: 66 Symfony and Doctrine APIs named by the drafts were checked against the symfony/symfony 8.1 branch, the symfony-docs 8.1 branch and the Doctrine, Foundry, DAMA and Nelmio sources. 54 exist as named, 7 have a different shape, 1 does not exist (a bus option enforcing one handler), 4 could not be checked. Examples use only the checked forms.
- Catalog dry run in a scratch clone: `render()` skips every entry that is not `active`; a section with only candidates still renders a bare heading, which fails the base-fixture test; the "why is a substring of rule or items" test reads candidates too; with approved entries active and `kanon/scripts/fixtures/symfony.base.md` regenerated from the new reference (IDs stripped), all 36 catalog tests pass.

## Owner decisions (2026-11-26, plan stop)

1. One family file. Every candidate goes in `kanon/catalog/symfony.json` with IDs from SYM-003, in topic sections. No `families.json`, schema, generator or test change.
2. Approved candidates become `status: active` before the merge and render into `symfony.md`. Rejected candidates are removed (they were never on main). `kanon/scripts/fixtures/symfony.base.md` is regenerated from the new reference.
3. The 49 php-core rows go in a second table in the PR body as questions. No catalog entry is added for them. A follow-up issue adds the php-core entries the owner keeps.
4. Sources: the two scheduled quick tips are cited by their MCP URLs ("Inject Symfony Services, Don't Fetch Them", publishing 2026-12-23; "Use Messenger for Commands, Not Just Async Jobs", publishing 2027-01-14). The draft insight "Stop Putting Business Logic in Symfony Controllers" and the 5 unpublished course 4 and 5 lessons are not cited; the PR body names them as pending sources with their vault paths.
5. Domain events go on a third Messenger bus, `event.bus`, with `allow_no_handlers`, dispatched with `DispatchAfterCurrentBusStamp` so listeners run after the command's transaction commits. The template gains the bus in a stage 2 follow-up.
6. Command handlers return nothing. The caller creates the id and puts it in the command. This narrows PHP-008's MAY for Symfony without changing PHP-008.
7. Handlers are `{Action}CommandHandler` and `{Action}QueryHandler` with `__invoke` and `#[AsMessageHandler(bus: ...)]` on every handler. A draft PHPStan or PHPArkitect check covers "one handler per message", since Messenger has no bus option for it.
8. `command.bus` carries the `doctrine_transaction` middleware (DoctrineBundle). Handlers never open, commit or flush a transaction themselves.
9. Plan approved as written. The six drafting defaults below are drafted as listed; the PR table names each alternative and the owner settles it in the PR comment.
10. The branch stays local until the PR opens and is rebased onto origin/main right before. After it is pushed, origin/main is merged into it, with no force-push. `symfony.md` and `symfony.base.md` are always regenerated, never hand-merged.
11. Candidate IDs are given in section order at PR open and never change. Rejected IDs leave gaps.

## Changes

### `kanon/catalog/symfony.json`

- SYM-001 and SYM-002 keep their wording, keyword and section. Content that matches them adds `sources` to them, not a new entry.
- Sections after the two existing ones, in this order: Messenger slices, Controllers, HTTP API, Authorization, Domain model, Doctrine persistence, Integrations, Console and scheduling, Performance, Module isolation, Testing. Dependency injection candidates join the existing "Dependency injection" section.
- Every candidate has `id`, `family: symfony`, `scope: symfony`, `keyword`, `rule` (one line, first bold keyword equal to `keyword`), `status: candidate`, `examples` with a short bad and good Symfony 8.1 snippet, and either `sources` (public codyssey.dev URLs from the MCP only) or a `lane_note` naming the Laravel counterpart IDs, or both. `why` only when it is a literal substring of `rule` or an item. `detect`, `checks` (PHPArkitect, PHPStan or Deptrac, status `draft`, never Pest), `applies_to` and `allowed_in` where they fit.
- Keywords start equal to the Laravel counterpart's. Where merged sources disagree on a keyword, the table shows both and the owner picks.

### `kanon/symfony-kanon/references/symfony.md` and `kanon/scripts/fixtures/symfony.base.md`

- Generated with `node kanon/scripts/catalog.mjs generate`, never hand-edited. At PR open the new sections render as bare headings and the fixture is regenerated to match, so the gates pass. After the decisions are applied, both are regenerated again.

### `kanon/symfony-kanon/SKILL.md`

- The reading table gets one row per new section of `references/symfony.md`.
- The Status line "Early overlay with two rules. More Symfony rules come with the rule catalog." is dropped. The frontmatter description's "It is an early overlay: two Symfony rules" is reworded to say the overlay covers Symfony on top of `php-core.md` and `reliability.md`.

## Drafting defaults that the PR table puts to the owner

- Entities live per slice, as the template decided, not in an entity concept folder.
- The application-isolation candidates are kept, marked as applying once a second application exists.
- The Doctrine performance candidates are included, although the template's rule copies treat performance as Eloquent-only.
- Authorization uses Voters with `#[IsGranted]` after the entity loads.
- A product exception maps to HTTP with `#[WithHttpStatus]` (inherited by subclasses in 8.1), as the template decided.
- Test data and isolation use zenstruck/foundry 2 with `FoundryExtension` and `#[ResetDatabase]` (the traits are deprecated since 2.9).
- The 25 per-rule decisions (error body shape, API docs generator, not-found lookups, raw DBAL, closed service locators, the SYM-002 MUST against the lesson that makes the bus optional, and the rest) appear in the table's notes column.

## Findings in the sources

- The unpublished "Persisting Aggregates" lesson says a Doctrine repository throws Laravel's `ModelNotFoundException`.
- The draft insight puts `#[Assert\Choice]` on a controller argument with no `#[MapQueryParameter]` or `#[MapRequestPayload]`, so the constraint is not applied, and injects an unused `ValidatorInterface`.
- The Command Bus lesson and the Messenger quick tip disagree on where the transaction opens and on command return values.
- The Laravel MD-024 rule has no subject. It is not changed here.

None of these passages is cited.

## How it gets built

1. Draft each section's entries in parallel into scratch JSON fragments, then merge them into `symfony.json` in one pass and run `generate`.
2. Check every example against the checked API list and the Symfony 8.1 sources.
3. Run every recipe gate from a clean tree at the head commit, open the PR with the candidate table, the php-core table and the gate evidence.
4. Apply the owner's PR-comment decisions, regenerate, rerun the gates, update the evidence, and wait for the merge word.

## Verification

From the worktree root at the head commit, clean tree: every check in `.factory/recipe.yml`, including `node kanon/scripts/catalog.mjs check --base origin/main` and `node --test kanon/scripts/catalog.test.mjs`. A diff of every Laravel and php-core catalog file against origin/main is empty.

## Out of scope

- The Symfony template and the bootstrap flag (#63, #64), the template's `symfony.md` resync, and adding `event.bus` to the template.
- php-core entries for the 49 questions.
- A Symfony audit skill (`kanon-pr-audit`, #44).
- Any change to a Laravel or php-core entry's wording or keyword.

## Owner decisions (2026-11-26, PR comment)

Posted decisions: https://github.com/codysseydev/codyssey-skills/pull/131#issuecomment-7185815574

- SYM-071 and SYM-084 rejected; their IDs are not reused.
- SYM-024 and SYM-025 are MUST.
- Ten rules reworded: SYM-003, SYM-007, SYM-026, SYM-051, SYM-059, SYM-068, SYM-070, SYM-074, SYM-101, SYM-102.
- Two contradictions resolved: read models may be a DTO or a readOnly entity (SYM-068 against SYM-075); SYM-101 exempts published events and consumer-owned contracts (against SYM-102).
- The six defaults are kept, with authorization as Voters checked in the handler.
- Event listeners that change state dispatch a command onto `command.bus`.
- php-core rows: 39 add to php-core later, 2 keep in Laravel only (P-20, P-49), 8 drop.
