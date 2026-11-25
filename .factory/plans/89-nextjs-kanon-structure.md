# Plan for #89, nextjs-kanon: the structure rules

Issue codysseydev/codyssey-skills#89. Base origin/main 339f740. Branch `factory/89`. Kind: feature.

## Goal

Fill `kanon/nextjs-kanon/references/structure.md` with the 33 entries the id map in `references/index.md` gives it: 29 whole rules and 4 core parts, derived from `.ai/rules/structure.md` of `codysseydev/codyssey-frontend` at `abdfd9f2`. Each entry follows the entry format in `index.md`, has the safety-pass fixes and the notes policy applied, carries the owner decisions on S12, S22, S27 and S29, cites the approved sources, and names other rules by pack id. No other file changes.

## Inputs read

- The frontend rule file at `abdfd9f2`: 34 rules, S1 to S34. S26 is dropped by the issue.
- `kanon/nextjs-kanon/references/index.md` at 339f740: entry format, notes and source policies, names table, guard-test rows, the "Checks the template may ship" table, and the 33 `STRUCT` rows of the id map.
- The stub `kanon/nextjs-kanon/references/structure.md`: `paths:` frontmatter, severity paragraph and ten `##` headings.
- Vault: Rule Recount (per-rule table, split clauses, guard-test notes), Public Safety Pass (the 8 structure rows), Content Extraction (conflict C9 and chapter 08 rows C1, C2 and C7), and decisions 1 to 23.
- Review sheet revision 26, read from an exported snapshot: Sources tab (6 approved S rows) and Conflicts tab (C9 approved). No Candidates, Clauses or Layer calls row touches a structure rule.
- `.factory/plans/88-nextjs-kanon-skeleton.md`: the owner decisions of 2026-11-24.

## Layout

Entries go under the stub's headings in the frontend's prose order, which is the id map's order:

| heading | entries |
|---|---|
| Features | STRUCT-001 to STRUCT-008 |
| Exports | STRUCT-009 |
| Imports and dependency direction | STRUCT-010 to STRUCT-014 |
| Server and client components | STRUCT-015 to STRUCT-019 |
| File naming | STRUCT-020 to STRUCT-023 |
| Where types and enums live | STRUCT-024 to STRUCT-027 |
| Shared code and pages | STRUCT-028 to STRUCT-031 |
| What stays out of the tree | STRUCT-032 |
| Docs and rule files | STRUCT-033 |
| What is NOT a violation | three bullets, no ids |

The frontend writes S17, S24, S29 and S32 as bold paragraphs. In the pack each becomes a `- **STRUCT-NNN.` list item, so the count grep finds it. The S17 suffix table sits inside its list item, indented two spaces. A GFM render through `gh api markdown` puts the table inside the entry's `<li>`.

The three "What is NOT a violation" bullets carry over without ids. The T9 reference becomes TYPES-018.

Neutral example domain for every rename: an inventory app with the features `inventory` and `shipments`. No example uses a folder, component or hook name of the source project.

## Entries

Keywords: no decision changes a structure keyword, so every entry keeps its frontend keyword. S15 and S31 stay MUST and the rest stay SHOULD. The PR's table of keyword changes says "none". "Safety fix" names the fix type of the rule's row in the Public Safety Pass. Every other row gets the notes policy only.

| pack id | From | frontend keyword | planned keyword (decision) | safety fix | sources planned | Check planned | cross-references |
|---|---|---|---|---|---|---|---|
| STRUCT-001 | S1 | SHOULD | SHOULD | generalize | lesson "Feature Modules" (draft, vault path); insight "Why Your Laravel Codebase Is Unmaintainable" (scheduled for 2026-11-30, `vault: Content/Insights/Why Your Laravel Codebase Is Unmaintainable.md` until live) | none | none |
| STRUCT-002 | S2 | SHOULD | SHOULD | none | insight "Stop Putting Business Logic in Symfony Controllers" (draft, `vault: Content/Insights/Stop Putting Business Logic in Symfony Controllers.md`) | none | none |
| STRUCT-003 | S3 | SHOULD | SHOULD | none | quick tip https://codyssey.dev/quick-tips/never-inject-a-controller-into-another-controller (live, checked 2026-11-25) | none | DESIGN-002 |
| STRUCT-004 | S4 | SHOULD | SHOULD | none | none | none | STRUCT-008, STRUCT-030 |
| STRUCT-005 | S5 | SHOULD | SHOULD | none | none | none | STRUCT-009 |
| STRUCT-006 | S6 | SHOULD | SHOULD | none | none | none | none |
| STRUCT-007 | S7 | SHOULD | SHOULD | none | none | none | none |
| STRUCT-008 | S23 (core part) | SHOULD | SHOULD | none | none | none | none (HEROICONS-002 holds the clause) |
| STRUCT-009 | S21 | SHOULD | SHOULD | none | none | none | none |
| STRUCT-010 | S8 | SHOULD | SHOULD | none | none | none | none |
| STRUCT-011 | S9 (core part) | SHOULD | SHOULD | move to the source project's overlay | none | none | STRUCT-014 |
| STRUCT-012 | S10 | SHOULD | SHOULD | none | none | none | none |
| STRUCT-013 | S11 (core part) | SHOULD | SHOULD | none | the rule's own Next.js docs source, "Preventing environment poisoning", https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning | guard-test row STRUCT-013 | none (CF-010 holds the clause) |
| STRUCT-014 | S12 | SHOULD | SHOULD (issue: empty allowed-pairs list) | none | insight https://codyssey.dev/insights/7-php-tools-that-pay-off-three-years-from-now (live, checked 2026-11-25); lesson "Feature Modules" (draft, vault path) | guard-test row STRUCT-014 | STRUCT-011, STRUCT-012 |
| STRUCT-015 | S13 | SHOULD | SHOULD | drop | none | none | none |
| STRUCT-016 | S14 | SHOULD | SHOULD | none | none | none | none |
| STRUCT-017 | S15 | MUST | MUST | none | none | none | none |
| STRUCT-018 | S16 | SHOULD | SHOULD | none | Q4 | none | none |
| STRUCT-019 | S22 | SHOULD | SHOULD (decision 4: core, host-neutral reason) | none | Q4 | none | none |
| STRUCT-020 | S17 | SHOULD | SHOULD | none | none | none | STRUCT-013, TYPES-017, TYPES-018 |
| STRUCT-021 | S24 | SHOULD | SHOULD | neutral enum example (possible miss) | none | none | none |
| STRUCT-022 | S29 | SHOULD | SHOULD (conflict C9: keep, one line on the PHP lesson) | none | Q6 | none | none |
| STRUCT-023 | S32 | SHOULD | SHOULD | none | none | none | none |
| STRUCT-024 | S18 | SHOULD | SHOULD | none | none | none | none |
| STRUCT-025 | S19 | SHOULD | SHOULD | none | none | none | none |
| STRUCT-026 | S20 | SHOULD | SHOULD | none | none | none | none |
| STRUCT-027 | S31 | MUST | MUST | generalize | none | guard-test row STRUCT-027 | STRUCT-007 |
| STRUCT-028 | S28 (core part) | SHOULD | SHOULD | move to the source project's overlay | none | none | DATA-059, ACCESS-003, ACCESS-008, DATA-032 (Q5) |
| STRUCT-029 | S30 | SHOULD | SHOULD | none | none | none | none |
| STRUCT-030 | S33 | SHOULD | SHOULD | drop | none | none | ACCESS-002, DATA-044 |
| STRUCT-031 | S34 | SHOULD | SHOULD | none | none | none | none |
| STRUCT-032 | S27 | SHOULD | SHOULD (decision 5: knip is on the fixed stack, so core) | drop | none | none | none |
| STRUCT-033 | S25 | SHOULD | SHOULD | none | none | none | none |

Counts: 33 entries, 29 whole rules and 4 core parts, equal to the 33 `STRUCT` rows of the id map and the issue's scope table.

The cross-references come from a script. It reads each frontend rule's text, finds every frontend id in it, and maps each one through the id map to its core pack id. Two references have no core target and are left out: A6, inside the S28 clause that leaves, and D39, which is SENTRY-001 in an add-on. STRUCT-011's reference to STRUCT-014 depends on keeping the slot sentence (see Readings).

## Sources

Sheet rows written (6, all approved on the Sources tab):

| rule | title | status on 2026-11-25 | cited as |
|---|---|---|---|
| S1 | Feature Modules (lesson) | draft | vault path |
| S1 | Why Your Laravel Codebase Is Unmaintainable (insight) | scheduled for 2026-11-30 | `vault: Content/Insights/Why Your Laravel Codebase Is Unmaintainable.md`, re-checked at build |
| S2 | Stop Putting Business Logic in Symfony Controllers (insight) | draft | `vault: Content/Insights/Stop Putting Business Logic in Symfony Controllers.md` |
| S3 | Never Inject a Controller Into Another Controller (quick tip) | live | https://codyssey.dev/quick-tips/never-inject-a-controller-into-another-controller |
| S12 | 7 PHP Code Quality Tools That Pay Off Years Later (insight) | live | https://codyssey.dev/insights/7-php-tools-that-pay-off-three-years-from-now |
| S12 | Feature Modules (lesson) | draft | vault path |

Status checks: the vault file's status tag and its `published` field, then the live page. The S1 insight's vault tag says published, but its `published` field is false, and the site shows a "Coming Nov 30, 2026" page. The source policy calls that not live, so it cites the vault path. The build re-checks it on the day the entries are written. Build check, 2026-11-25 08:40 UTC: the page title still reads "Coming Nov 30, 2026", so the entry cites the vault path. Recheck before the PR, 2026-11-25 23:33 UTC: the S1 insight's title still reads "Coming Nov 30, 2026", and the S2 insight and the Feature Modules lesson (and its course page) return 404, with draft status in the vault. No Source line switches to a URL. When one entry cites two sources, each gets its own `- Source:` line.

Sources the rules carry themselves, kept under the notes policy: S11's Next.js docs page, under its current heading. Q4 covers S16 and S22.

## Readings of the issue

These follow from the inputs. The PR lists them so the owner can change any of them.

- S9 core part. It keeps the shared-`global-ui` rule, the cycle ban, the one-way rule for `global-ui`, and where shared types, enums, constants, functions and components go. It also keeps the slot sentence: a `global-ui` component takes a feature's control as a slot, and the app shell passes it in. The safety pass moves the two allowed-import bullets, and those are left out. The frontend's names of other features become "another feature".
- S11 core part. The file list becomes "every `*.server.ts` module and any other module that must never reach the browser". The exclusion clause is CF-010, which #96 writes.
- S12. The allowed-pairs list starts empty. The open-owner sentence and the "no allowlist entries" state note are dropped.
- S23 core part. Shared icon components live in `src/features/global-ui/icons/` with PascalCase file names. The custom-icon clause is HEROICONS-002, which #96 writes.
- S27. The knip check stays in the rule text, and the entry has no `Check:` line, because the issue names Check lines only for S11, S12 and S31. The dated count is dropped.
- S30. The helper names `loadOrNotFound` and `assertInRange` stay. The file is `src/lib/pageData.ts` (Q2). The constraint bullet that names a test keeps its behaviour without the test name: a page with a `catch` outside `generateMetadata` and no rethrow is a finding, even when it also calls the helper, and a page whose only error handling goes through the helper passes (answer 4 below).
- S31. Generalized per the safety pass: a value several features must agree on, such as the page size, is defined once in `src/constants/`.
- Test names the frontend rules cite are dropped from the entries and listed in the PR for stage 2: `importBoundaries.test.ts` (S12, now the STRUCT-014 row), the "classifies every page" test and the rethrow test of the page helper (S30), and the page-size test (S31). `architectureRules.test.ts` is the template's guard test in the names table, so it is not on that list.
- S28 case i names a rule that sits in the Sentry add-on. The core entry cites DATA-032 only.

## Verification

From the worktree root at the head commit, with a clean tree:

1. The acceptance commands of #89, each with its output:

   ```sh
   F=kanon/nextjs-kanon/references/structure.md
   grep -cE '^- \*\*STRUCT-[0-9]{3}\.' $F                                         # 33
   grep -niE 'codyssey' $F | grep -vE 'https://codyssey\.dev/|vault: Content/'     # empty
   grep -niE 'heroicons|opennext|wrangler|worker\.js|sanitiz' $F                   # empty
   grep -nE 'Not migrated|Migrated:|Observed:|Audit(ed)?:|PR #[0-9]+|#[0-9]{3,4}\b|\b[0-9a-f]{8,40}\b' $F   # empty
   grep -nE '^\s*- Source:' $F | grep -vE 'https://|vault: Content/'               # empty
   ```

2. `check_from.py`, which runs outside the repo. Its source and output go in the PR body. For each `STRUCT` entry it checks that there is exactly one `From:` line and that the value equals the id map row. It also checks that the ids run in map order and that the map holds 33 rows, 29 whole and 4 `(core part)`. A run on the scratch drafts passed with `--partial`. Without the flag, the same run fails on the 28 missing entries.
3. The cross-reference script, run again on the built file: every pack id cited in an entry exists in the id map, and none points to an add-on or overlay file.
4. A grep of the S29 entry for the PHP lesson line, and a grep for the three `Check:` lines naming STRUCT-013, STRUCT-014 and STRUCT-027.
5. Every check in `.factory/recipe.yml`. At base 339f740 all 12 pass. `kanon-catalog-check` runs again after the commit, since it diffs against origin/main.

The PR body carries the 8-row safety-fix table (S1, S31 generalize; S13, S27, S33 drop; S9, S28 move to the source project's overlay; S24 neutral example). It also carries the empty keyword-change table, the 6 source rows written, and the dropped test names. No problem cell from the safety pass is quoted.

## Out of scope

- Every other file in `kanon/nextjs-kanon/`, including `index.md` and its names table, and the add-on and overlay files (#90 to #96).
- The audit (#97), the template repository and its guard test (stage 2), and `bootstrap --frontend nextjs` (stage 3).
- Any change to `codysseydev/codyssey-frontend`, including the chapter 08 code fixes for S9 and S28.

## Decisions

The owner approved the plan in an interactive session on 2026-11-25 and accepted the recommended option of every question. Each option list puts the recommendation first.

- **Q1. S4, S10 and S12 name `src/api/` for API client setup, but the frontend tree at `abdfd9f2` has no `src/api/`, and the names table puts the client at `src/lib/apiClient.ts`. What do the entries say?**
  (a) Drop `src/api` from all three, and S4 names `src/lib/apiClient.ts` for the API client. (b) Keep `src/api/` as a leaf folder beside `src/lib`.
  Answer (owner, 2026-11-25): (a).
- **Q2. The entries need names that the "Names rules may cite" table lacks: `src/providers/`, `src/types/`, `src/constants/` and `src/lib/` as folders, `src/features/global-ui/icons/`, `knip.json`, and the page helper module of S30. #89 touches only `structure.md`. How are they handled?**
  (a) Use them in `structure.md` and list them in the PR for one follow-up edit of the names table after #89 to #96 land. (b) Add them to `index.md` in this PR, beside the parallel issues that may edit the same table. (c) Rewrite the entries around them, for example "one module in `src/lib`".
  Answer (owner, 2026-11-25): (a). Entries cite concrete generic file and helper names; `index.md` is not edited, and the PR lists every name it introduced.
- **Q3. Most frontend rules point to the source project's how-to guides (`docs/guides/...`, `docs/architecture/...`), which the template does not have. The notes policy does not name them. What happens to them?**
  (a) Drop each pointer and keep any rule sentence written inside one, such as "a component and its file carry the same name". (b) Keep them as generic "see the project's feature guide" lines.
  Answer (owner, 2026-11-25): (a).
- **Q4. The Source lines of S16 and S22 cite a local copy of a skill from the unlicensed upstream that decision 13 replaced, so they fail the source policy and the Source grep. What do those entries cite?**
  (a) The matching public Next.js page: the server and client components page for S16, and the route segment config page for S22, which also grounds decision 4's host-neutral reason. (b) No Source line.
  Answer (owner, 2026-11-25): (a).
- **Q5. Where does the S28 core part end? The recount sends case h's CMS document page to the untrusted-content add-on, case a's tag-strip and entity-decode helpers there only "if the pack keeps them", and case j to the source project's overlay. The id map has one clause entry, UNTRUSTED-007, which #96 writes.**
  (a) Core keeps cases a to i, minus the tag-strip and entity-decode helpers of a and the CMS document sentence of h, which both go to UNTRUSTED-007. Rendering CMS HTML is an add-on by the app premise. (b) Only the CMS sentence of h leaves, and case a stays whole in core. (c) Cases a and h leave whole. #96 needs the same answer.
  Answer (owner, 2026-11-25): (a). The tag-strip and entity-decode helpers of case a and the CMS-rendered page of case h go to UNTRUSTED-007.
- **Q6. Conflict C9 asks for one line on why S29 differs from the PHP lesson "The Service Pattern". The lesson is live at https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-service-pattern, and the Sources tab has no S29 row. How is the lesson cited?**
  (a) Link it inside that line in the Why, with no Source line. (b) Add a Source line for it. (c) Name it without a link.
  Answer (owner, 2026-11-25): (a).
- **Q7. The entry format shows a Why line on every entry. Only 3 of the 33 frontend rules have one (S8, S9, S13), and the Why of S9 and S13 only quotes the source project's own CLAUDE.md. What do entries without a usable Why get?**
  (a) A one-line neutral Why for every entry, taken from the rule's own reasoning or its approved source where there is one. (b) A Why only on S8, S9 and S13, with S9 and S13 reworded to a neutral reason. (c) A Why only on S8. S9 and S13 lose theirs.
  Answer (owner, 2026-11-25): (a). The PR lists every Why written fresh, with no reason in the source rule or the sheet.

Owner decisions for every rule issue, 2026-11-25:

- Every entry gets a one-line neutral `Why:` (Q7).
- Source lines are `- Source: <title> <URL>` or `- Source: <title> vault: Content/<path>.md`, with no quote. A lesson's point goes into the Why. A source that cites the retired upstream skill is replaced by the matching nextjs.org page.
- A codyssey.dev source is live only when its page title is not "Coming <date>". Checked at write time.
- The issue's acceptance greps decide what counts as a project name. `vault: Content/` paths may carry the course name.
- Rules cite other rules by pack id from the id map only.

Drafts of STRUCT-014, STRUCT-019, STRUCT-020, STRUCT-022 and STRUCT-028, written with the recommended options, tested the entry format, the acceptance greps and `check_from.py`. They are kept outside the repo.

Owner answers to the independent review (diff only):

1. STRUCT-018 (2026-11-25): props that cross to a client component cannot be functions or class instances, and `Date`, `Map` and `Set` are serializable, per the React docs the Next.js Source page links. The rule text and the Why say so. The text keeps the React docs' exception for Server Functions.
2. STRUCT-028 (2026-11-25): the English pluralizer clause applies to an app with one language. Case b starts with that scope, because the pack states no language premise.
3. STRUCT-014 (2026-11-25): imports of `src/features/global-ui/` do not count as feature-to-feature imports for the boundary test.
4. STRUCT-029 (2026-11-25): S30's check is restored. A page with a `catch` outside `generateMetadata` and no rethrow is a finding. The `dynamic` and `revalidate` sentence gets a `Condition:` line for Cache Components off, which the pack assumes. index.md's entry format has no `Condition:` slot, so the PR lists it for the follow-up.
5. All rule files (2026-11-26): the intro sentence about Check lines matches index.md's entry format: a `Check:` line names the guard-test row, the lint rule, or the sheet's check idea for a rule, where one exists. This PR edits the intro of `structure.md` only.
