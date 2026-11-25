# Plan for #91, nextjs-kanon: the types-and-tests rules

Issue codysseydev/codyssey-skills#91. Base origin/main 339f740. Branch `factory/91`. Kind: feature.

## Goal

Fill `kanon/nextjs-kanon/references/types-and-tests.md` with 38 rule entries in the entry format of `references/index.md`: 31 core rules, 6 core parts of split rules and the new rule NX-14. The pack ids TYPES-022 (T12) and TYPES-036 (T19) stay unused. #95 writes those two after this issue merges. No other file changes, unless the owner answers Q5 with (b).

## Inputs read

- Frontend rule text: `codysseydev/codyssey-frontend` at `abdfd9f2`, `.ai/rules/types-and-tests.md`, 39 rules.
- `references/index.md` from #88. It holds the id map rows TYPES-001 to TYPES-040, the entry format, the notes and source policies, the names table, the guard-test rows and the count table (33 core, 6 split, 1 NX, 40 total).
- Vault notes: `Rule Recount.md` (per-rule table and guard-test notes), `Public Safety Pass.md` (fix type and policy column per rule), `Content Extraction.md` and the decisions note (decisions 5, 9, 11, 12 and 23).
- Review sheet, revision 26, read from an export of the sheet. Candidates NX-14, Clauses X1, Conflicts C10, Layer calls T17, T21 and T32, and the 18 Sources rows on types-and-tests rules.
- #95's body. It words T12 and T19 from its Vite+ checks and adds them to this file after #91 merges.

After the owner's decisions, the recount lists 33 core rules, 5 split rules and 1 rule of the source project's overlay (T21) for this file, 39 in all. The sheet's T21 layer call moves T21 to split, which gives the 33 core and 6 split in `index.md`. NX-14 makes 40. This is not a mismatch.

## Entries

The file's existing sections hold the entries in the frontend's prose order, which is the id map order: `Typing` (TYPES-001 to 016), `Test placement and shape` (TYPES-017 to 034), `What a change ships with` (TYPES-035 to 040). No MUST, SHOULD or MAY level changes. T38 and T39 lose their new-code scope (reading 4). The issue's decisions set T17, T21, T27, T32 and T34 as core and keep their keywords. Clause X1 adds text to T24 but does not change its keyword.

Column key:
- **Kw**: the keyword in the frontend rule.
- **Planned**: the keyword this plan writes, and the decision that sets it.
- **Safety fix**: the fix type from `Public Safety Pass.md`.
- **Sources**: live means the URL on https://codyssey.dev/ returned the page on 2026-11-25. Scheduled and draft sources cite the vault path.
- **Check**: the planned `Check:` line.
- **Cites**: other rules this entry cites, by pack id.

| pack id | From | Kw | Planned | Safety fix | Sources | Check | Cites |
|---|---|---|---|---|---|---|---|
| TYPES-001 | T1 | MUST | MUST | none | none | none (tsc) | none |
| TYPES-002 | T2 | MUST | MUST | none | none | Oxlint `typescript/no-explicit-any` (Q6) | none |
| TYPES-003 | T3 | SHOULD | SHOULD | none | none | none | TYPES-002 |
| TYPES-004 | T4 | SHOULD | SHOULD | none | The Honest Cost of Two Repos (draft lesson, vault path) | none | none |
| TYPES-005 | T5 | MUST | MUST | none | none | Oxlint `typescript/consistent-type-definitions` (Q6) | none |
| TYPES-006 | T6 (core part) | SHOULD | SHOULD | move to the source project's overlay (left out) | none | none | STRUCT-020 |
| TYPES-007 | T7 | SHOULD | SHOULD | none | none | none | STRUCT-024, STRUCT-025 |
| TYPES-008 | T24 | SHOULD | SHOULD; clause X1 appended as written | drop clause | Test Doubles - Mocks, Stubs, Fakes and Spies (live); The Honest Cost of Two Repos (draft, vault path); Don't Spread validated() Into create() (live, for X1). The rejected row is skipped. | none | DESIGN-009 |
| TYPES-009 | T34 (core part) | SHOULD | SHOULD; issue decision on T34: "the CDN or cache window" | generalize | none | none | STRUCT-032 |
| TYPES-010 | T35 (core part) | SHOULD | SHOULD | generalize | none | none | TYPES-002 |
| TYPES-011 | T36 | SHOULD | SHOULD | generalize | none | none | TYPES-004 |
| TYPES-012 | T37 (core part) | SHOULD | SHOULD | move to the source project's overlay (left out) | none | none | none |
| TYPES-013 | T38 | SHOULD, new code | SHOULD (reading 4) | none | none | none | none |
| TYPES-014 | T39 | SHOULD, new code | SHOULD (reading 4) | possible miss: neutral enum | none | none | none |
| TYPES-015 | T26 | MUST | MUST | drop clause | The State Pattern (live) | guard row TYPES-015 | DESIGN-015 |
| TYPES-016 | T28 | MUST | MUST | none | none | none (tsc) | TOOLING-007 |
| TYPES-017 | T8 | SHOULD | SHOULD | none | none | none | none |
| TYPES-018 | T9 | MAY | MAY | none | none | none | none |
| TYPES-019 | T10 | SHOULD | SHOULD | none | Test Business Rules Without Booting Laravel (scheduled 2026-12-09, vault path) | none | none |
| TYPES-020 | T11 | SHOULD | SHOULD | none | Test Doubles - Mocks, Stubs, Fakes and Spies (live) | none | none |
| TYPES-021 | NX-14 | new | SHOULD (Candidates NX-14: "SHOULD as written, no coverage clause") | none | Your Tests Are Green and the Bug Shipped Anyway (draft, vault path) | the sheet's check idea (Q6) | none |
| TYPES-022 | T12 | | reserved for #95, not written | | | | |
| TYPES-023 | T13 | SHOULD | SHOULD | none | none | none | TYPES-034 |
| TYPES-024 | T14 | SHOULD | SHOULD | none | Test Doubles - Mocks, Stubs, Fakes and Spies (live) | none | none |
| TYPES-025 | T15 | SHOULD | SHOULD | none | none | none | none |
| TYPES-026 | T16 | SHOULD | SHOULD | none | Anemic Domain Model vs Rich Domain Model (live); Test Business Rules Without Booting Laravel (scheduled, vault path) | none | STRUCT-003 |
| TYPES-027 | T17 | MUST | MUST; Layer calls T17 and conflict C10 | none | Claude Code Found 14 Rule Breaks in Merged Laravel Code (live, the edited row's cleaned quote) | the guard test file | none |
| TYPES-028 | T23 | SHOULD | SHOULD | none | the Storybook CSF docs, which the frontend rule cites (reading 6) | none | TYPES-040 |
| TYPES-029 | T25 | MUST | MUST | generalize | none | guard row TYPES-029 | none |
| TYPES-030 | T29 | SHOULD | SHOULD | none | Avoid the Singleton (scheduled 2026-12-03, vault path); The Singleton Pattern (live); the Vitest config docs, which the frontend rule cites (reading 6) | none | none |
| TYPES-031 | T30 | SHOULD | SHOULD | none | Behavior-Driven Development (live) | none | none |
| TYPES-032 | T31 (core part) | MUST | MUST | move to the source project's overlay (left out) | none | none | none |
| TYPES-033 | T32 | MUST | MUST; Layer calls T32 | none | none | the guard test file | none |
| TYPES-034 | T33 | SHOULD | SHOULD (reading 4) | none | none | none | none |
| TYPES-035 | T18 | SHOULD | SHOULD | none | Refactoring Is Not Rewriting (draft, vault path); Refactoring as a Discipline (live) | none | none |
| TYPES-036 | T19 | | reserved for #95, not written | | | | |
| TYPES-037 | T20 | MUST | MUST | none | none | none | none |
| TYPES-038 | T21 (core part) | MUST | MUST; Layer calls T21: the core one-liner | move to the source project's overlay (left out) | none | the guard test file | none |
| TYPES-039 | T27 | MUST | MUST; decisions 5 and 23 (React Compiler in the fixed stack, on by default) | none | Claude Code Found 14 Rule Breaks in Merged Laravel Code (live) | Oxlint `--max-warnings 0`, unused directives as errors (Q6) | none |
| TYPES-040 | T22 | MAY | MAY | none | none | none | none |

Counts:
- Entries: 38. Core: 31. Core parts: 6. NX: 1.
- Safety fixes: 10, all from the issue's list.
  - generalize: T25, T34, T35, T36
  - move to the source project's overlay: T6, T31, T37
  - drop clause: T24, T26
  - possible miss: T39
- Sheet source rows written: the 15 approved rows on T4, T10, T11, T14, T16 (two), T18 (two), T24 (two), T26, T27, T29 (two) and T30, plus the edited T17 row, X1's source and NX-14's source.
- Sheet source rows skipped: the rejected T24 row. The edited T19 row is #95's.

### Per-rule notes

- **T17.** The frontend's file names become the guard test `src/lib/tests/architectureRules.test.ts` and the rule folder `.ai/rules/`. The C10 sentence is written as its Decision note words it. The source's architecture-doc pointer is dropped.
- **T21.** Only the one-liner is written: a new route updates the guard-test rows it touches in `src/lib/tests/architectureRules.test.ts`. The named page tests, the shared registry and the hand-edited lists stay out.
- **T24.**
  - The safety pass drops the Source and Audited bullets and the named source types. Neutral types replace them, for example `Order['customer']`.
  - X1 is appended as its own sentence.
  - The two sub-bullets stay: widen a type that the backend sends wider, and type a null payload `| null` on the envelope.
- **T25.** The flake history becomes a neutral Why. The fixed 10 s value is dropped. The rule says each assertion inherits the one deadline the test setup configures, and stage 2 picks the number.
- **T27.** The production-only compiler flag is dropped, by decision 23. Q4 covers the lint script and config key.
- **T31.** The core example is a TypeScript copy of a theme color that a test compares with the `@theme` block of the global stylesheet. The skew-mapping clause goes to CF-017 (#96). The cross-repo vectors clause is left out.
- **T32.** Read in pack terms:
  - The check ships inside the one guard test, not in the source's separate test file.
  - A rule cites a row in its `Check:` line.
  - The heading form to count is `- **<PREFIX>-<NNN>. <title>**`.
  - The source's second heading form for design principles is dropped, because the pack's `design-principles.md` uses the entry format (plan 88).
- **T34.** The two cache names become "the CDN or cache window". The removal-condition sentence for temporary compat code stays, with a neutral example, and cites STRUCT-032. The source's own example is dropped.
- **T35.** The sanitized-HTML brand clause goes to UNTRUSTED-009 (#96). The core part keeps "a branded type". The cast comment cites `TYPES-010`, not `T35`. The example becomes a neutral `renderBlock` table.
- **T36 and T39.** Neutral examples replace the source's shared fields and enum: a `slug` and `created_at` shared field, and an `OrderStatus` enum.

## Readings of the issue

These follow from the issue and `index.md`. The PR lists them so the owner can change any of them.

1. **Notes policy.** Every Observed, Not migrated, Migrated, Audited and incident note is dropped. So are commit hashes, issue numbers and counts. Links to the source project's guides (`docs/guides/...`, `docs/architecture/...`) and its `CLAUDE.md` quotes are dropped. Source-project names are renamed to neutral ones, for example `CourseResponse` becomes `OrderResponse`.
2. **Test file names dropped and listed in the PR.** These are the frontend tests that #91 does not name, for stage 2 to decide:
   - the separate rule-reference test (T32)
   - the brand-color sync rows (T31)
   - the four page-level tests T21 names
   - `src/lib/testing/createTestQueryClient.ts`, `src/lib/testing/at.ts` and `src/lib/exhaustiveFallback.ts`, if Q5 is answered (a)
3. **Guard test named in the text.** T17, T21 and T32 name `src/lib/tests/architectureRules.test.ts` in the rule text and in their `Check:` line. T25 and T26 name their guard row by pack id, as `index.md` asks.
4. **"New code" scope.** The frontend scopes four rules to new code or to files being touched: T27 ("not allowed in new code"), T33 ("applies to new tests; convert on touch"), T38 and T39 ("SHOULD, new code"). T23's "existing stories keep" is the same kind of scope. All of these exist only because of the Not migrated notes, so they drop with those notes and the keyword stays. The PR's keyword table lists T38 and T39, because their keyword cell changes from "SHOULD, new code" to "SHOULD".
5. **"What is NOT a violation".** The section stays, with three bullets:
   - A `.test.ts` without the node pragma that renders or reads browser globals.
   - `as` inside a type-guard body, `as const`, a branded type, and `as unknown as` in a test.
   - A `declare global` augmentation of a built-in, for example `Window`, with a `-- declaration merging only` disable.

   The brand name and the source-project file names in the source bullets are dropped. The brand name would also fail the issue's add-on grep.
6. **Public docs the frontend rule already cites.** T23 cites the Storybook CSF docs and T29 cites the Vitest config docs, both without a URL. The notes policy keeps a Source line that cites a public doc, so they become `Source:` lines with https://storybook.js.org/docs/api/csf and https://vitest.dev/config/clearmocks. Both returned the page on 2026-11-25. These two are not sheet rows. The PR lists them apart from the sheet rows.
7. **Source status is re-checked at write time.** Each source's status is checked again when the rule is written: the vault frontmatter, then the public URL. On 2026-11-25 the two scheduled quick tips returned a "Coming" page, which counts as not live, so they cite the vault path. A tip that has gone live by write time cites its URL.
8. **Why lines.** Each source Why is kept, moved out of the rule text where the source puts it inline. Q2 covers entries whose source states no reason.

## Leaving TYPES-022 and TYPES-036 for #95

- Write no entry with either id. The From script below fails if one appears.
- The file holds TYPES-021 followed by TYPES-023, and TYPES-035 followed by TYPES-037. Q1 asks whether a marker line sits in each gap.
- No entry of this file cites T12 or T19, so no cross-reference waits on #95. T29 describes the shared Vitest reset config without citing T12.
- After #95, the file holds 40 entries. That is #95's acceptance check, not #91's.

## Verification

From the worktree root, at the head commit, on a clean tree:

1. Every acceptance command of #91, with its output:
   - The `TYPES-` entry count prints 38.
   - The source-name grep, the add-on and Cloudflare grep, the dropped-notes grep and the Source-line grep each print nothing.
2. A From script, run outside the repo, with its source and output in the PR body. It:
   - reads the id map rows for `types-and-tests.md` minus TYPES-022 and TYPES-036
   - reads each `- **TYPES-NNN.` entry of the rule file
   - fails unless each entry has exactly one `From:` line
   - fails unless the ordered (pack id, From) pairs equal the map
   - fails if the file holds a TYPES-022 or TYPES-036 heading

   A prototype was run against the base stub, a synthetic 38-entry file and a file with a doubled `From:` line. It reported 0 entries, OK, and one failure, as expected.
3. A cross-reference grep. Every frontend-style id left in the file must appear inside a `From:` line:

   ```
   grep -nE '\b[SDTUPAIC][0-9]{1,2}\b' kanon/nextjs-kanon/references/types-and-tests.md | grep -v 'From:'
   ```

   It prints nothing. Every pack id cited in the text must exist in the id map.
4. The PR body tables:
   - the 10 safety fixes
   - the keyword-change table (T38 and T39, reading 4)
   - the source rows written and skipped
   - the dropped test file names
5. The 12 checks in `.factory/recipe.yml`. All 12 pass at base 339f740 (run on 2026-11-25). `kanon-catalog-check` validates `kanon/catalog/*.json` only and does not read `kanon/nextjs-kanon/`, so the TYPES entries cannot fail it.

## Out of scope

- T12 and T19 (#95).
- The Cloudflare clauses of T31 and T34, the untrusted-content clause of T35, and NX-15 (#96).
- The other rule files (#89, #90, #92, #93, #94, #96) and the audit (#97).
- `index.md`, unless the owner answers Q5 with (b).
- The template repository and its guard test (stage 2), and `bootstrap --frontend nextjs` (stage 3).
- Any change to `codysseydev/codyssey-frontend`.

## Open questions

The prototype entries for these are in a scratch file outside the repo.

- **Q1. Reserved slots.** Should the gaps at TYPES-022 and TYPES-036 hold any line?
  - (a) **Recommended.** A bare gap: no line, since the id map already reserves both ids.
  - (b) One HTML comment per gap that names only the reserved pack id, with no source id and no issue number, so the cross-reference grep stays clean. #95 deletes it.
- **Q2. Why lines.** Most source rules state no reason. Examples are T1, T4 to T9, T13 to T17 and T20 to T23. What does such an entry get?
  - (a) **Recommended.** A one-line Why written fresh from the rule's own wording or its sheet source. The PR lists every fresh Why for review.
  - (b) A Why line only where the source states a reason.
- **Q3. Source line shape.** The entry format shows title and link. The T17 decision asks for a cleaned quote, and four rules carry two or three sources (T16, T18, T24, T29). What does a Source line hold?
  - (a) **Recommended.** One `- Source:` line per source: title, the sheet's quote, then the URL or vault path.
  - (b) Title and URL or vault path only, with no quote anywhere.
  - (c) Title and URL, plus the quote on T17 only.

  The answer binds the sibling rule issues too.
- **Q4. Commands and config the template's tooling sets.** Four entries name them:
  - T1 and T28 name `pnpm typecheck`.
  - T2 names `vite.config.ts` as the Oxlint config.
  - T27 names `pnpm lint` and a `lint.options` key of the Vite+ config.

  How are they worded?
  - (a) **Recommended.** Name the tool behaviour only, for example "Oxlint runs with `--max-warnings 0`" and "the typecheck script".
  - (b) Copy the source names, and let #95 reword them with T12 and T19.
- **Q5. Does #91 edit `index.md`?** Three helpers are not in the names table: T26's exhaustive fallback, T28's test indexing helper and T33's QueryClient helper. T32's check also has no guard-test row.
  - (a) **Recommended.** No. Describe the helpers without a path, name the T32 check in its rule only, and list all four in the PR for stage 2.
  - (b) Yes. Add the three helper names to the names table and a TYPES-033 row to the guard-test rows. This touches a file that the six parallel rule issues also read.
- **Q6. Check lines beyond the issue's list.** The issue lists T25 and T26, plus the guard-test name on T17, T21 and T32. Should more entries get a `Check:` line?
  - (a) **Recommended.** Also add Check lines for the Oxlint rules the source names on T2, T5 and T27, and NX-14's check idea from the sheet, marked unconfirmed until #95's Oxlint check runs.
  - (b) Only the issue's list.
- **Q7. T28's two flags that are left off.** T28 says `verbatimModuleSyntax` and `exactOptionalPropertyTypes` are not worth their cost. The source measured that cost on existing files. How does the pack treat them?
  - (a) **Recommended.** Keep the sentence without the counts: both flags stay off.
  - (b) Drop the sentence, and leave the two flags unmentioned.
  - (c) Turn both flags on in the pack. This changes the rule.

## Decisions (2026-11-25)

The owner approved this plan in an interactive session on 2026-11-25. Answers:

- **Q1.** (a) A bare gap. TYPES-021 is followed by TYPES-023, and TYPES-035 by TYPES-037, with no line between.
- **Q2.** (a) Every entry gets a neutral one-line `Why:`. The PR lists every Why written fresh, that is, every Why with no reason in the source rule or its sheet row.
- **Q3.** Neither option as written. A Source line is `- Source: <title> <URL>` or `- Source: <title> vault: Content/<path>.md`, with no quote. The point of the quote goes into the Why. A source that cites the retired `next-best-practices` skill is replaced by the matching nextjs.org docs page.
- **Q4.** (a) Name what the tool does: "the typecheck script", "Oxlint runs with `--max-warnings 0`". #95 rewords them with T12 and T19.
- **Q5.** No `index.md` edit, as in (a). Rules cite concrete generic file and helper names even when the names table lacks them, for example `src/lib/exhaustiveFallback.ts`, `src/lib/testing/at.ts` and `src/lib/testing/createTestQueryClient.ts`. The PR lists every name the file adds under "Names for the index.md follow-up".
- **Q6.** (a) Check lines on T2, T5 and T27 for the Oxlint rules the source names, and on NX-14 for the sheet's check idea, marked unconfirmed until #95's Oxlint check runs.
- **Q7.** (a) Both flags stay off. The counts are dropped.
- **Reading 4.** T38 and T39 lose their new-code scope. The PR's keyword table lists the cell change from "SHOULD, new code" to "SHOULD". The same reading drops T11's "in new tests".
- **Reading 6.** T23 and T29 keep their public-doc Source lines.
- **T25.** The 10-second value is dropped.
- **What is NOT a violation.** Three generic bullets.
- **Source status.** A source is live only if its https://codyssey.dev/ page title is not "Coming <date>". A scheduled page answers 200 with that title, so it cites the vault path. Checked at write time.
- **Codyssey names.** The issue's acceptance greps decide what counts. A `vault: Content/` path may carry the course name.
- **Cross-references.** By pack id from the id map only.
