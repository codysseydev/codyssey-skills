# Plan for #90, nextjs-kanon: the data-and-rendering rules

Issue codysseydev/codyssey-skills#90. Base origin/main 339f740. Branch `factory/90`. Kind: feature.

## Goal

Fill `kanon/nextjs-kanon/references/data-and-rendering.md` with its 71 entries: 55 whole core rules, 11 core parts of split rows and 5 new rules from the review sheet. Each entry uses the pack id from the id map in `references/index.md`, the entry format there, the safety-pass fix of its row, the rewording table, the owner decisions the issue lists and the sheet decisions. No other file changes.

## Inputs read

- The source rule file `.ai/rules/data-and-rendering.md` of `codysseydev/codyssey-frontend` at `abdfd9f2` (78 rules: the 66 in scope, 11 add-on rules for #96, one rule of the source project's overlay).
- `kanon/nextjs-kanon/SKILL.md` (fixed stack, store mapping line, clash list) and `references/index.md` (id map, entry format, notes and source policies, names table, guard-test rows, checks table).
- `.factory/plans/88-nextjs-kanon-skeleton.md`, owner decisions of 2026-11-24.
- The vault notes the issue names: Rule Recount, Public Safety Pass, Content Extraction and the Prerequisites note (decisions 1 to 23, rewording table).
- The review sheet at revision 26: Candidates, Clauses, Layer calls and Sources tabs, each row's Decision and Decision note.
- Source status: each vault file's frontmatter, and the page title on https://codyssey.dev/. A scheduled item answers 200 with a "Coming <date>" title, so a 200 alone does not mean live.

## Id map check

A script outside the repo parses the DATA rows of the id map and the issue's scope table. Result at base: 71 map rows, scope 55 + 11 + 5 = 71, no id in one set and not the other, no duplicate `From:` value. The same script, given the rule file, checks that each entry has exactly one `From:` line equal to its map row. Run on the prototype entries: 8 entries, 0 mismatches.

## Entries

In file order. Columns:

- **kw src / kw pack**: the source keyword and the planned one, with the decision when they differ.
- **safety**: the fix type from the safety pass. Every row of this file is "generalize".
- **reword**: Zod for Standard Schema with Zod as the named implementation, store for the library-neutral store wording (XState Store named, no per-rule Zustand line).
- **sources**: approved sheet rows and public docs the source rule quotes. A draft is cited by its vault path. A scheduled item is cited by its vault path, or by its URL if it is live when the rule is written.
- **check**: a guard-test row named by pack id, or the sheet's check idea.
- **refs**: rules cited, by pack id.
- **notes**: text that would trip an acceptance grep or leave with a clause, and the fix.

### Public pages are prerendered

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-001 | D1 (core part) | MUST / MUST | | | Why Not Inertia or Livewire (draft, vault path) | | DATA-011 | Layer calls tab: `force-static` plus a `revalidate` the project picks. The edge-cache fetch option and the one-day value go to CF-011. Condition line per Q3. |
| DATA-002 | D2 | MUST / MUST | | | SEO in a Decoupled Architecture (draft, vault path) | | STRUCT-029 | |
| DATA-003 | D3 | MUST, SHOULD for the public-path helper / same | | | | | DATA-064 | The rewrite test tied to one source enum is dropped. Condition line per Q3. |
| DATA-004 | D4 | SHOULD / SHOULD | | | | | | The one-page exception is dropped (recount: drop-clause). |
| DATA-005 | D5 | MUST / MUST | | | | | DATA-064 | Condition line per Q3. |
| DATA-006 | D6 | MUST for the list, SHOULD for the comment / same | | | | | | Condition line per Q3. |
| DATA-007 | D7 | MUST / MUST | generalize | | SEO in a Decoupled Architecture (draft, vault path) | | | Condition line per Q3. |
| DATA-008 | D8 (core part) | MUST / MUST | | | | | | Decision 1: host-neutral Why. The `s-maxage` wording goes to CF-012. |
| DATA-009 | D9 | MUST, SHOULD for the canonical / same | | | | | | |
| DATA-010 | D10 | MUST / MUST | | | | | DATA-011 | |
| DATA-011 | D11 | SHOULD / SHOULD | | | SEO in a Decoupled Architecture (draft, vault path) | | | Error-class and helper names follow Q1. |

### Seeding server data into client queries

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-012 | D12 | MUST / MUST | | | XState Store and TanStack Query (draft, vault path) | | | Seed helper names follow Q1. |
| DATA-013 | D13 | MUST / MUST | generalize | | | | DATA-062 | |
| DATA-014 | D14 | SHOULD / SHOULD | | | | | | |
| DATA-015 | D72 | SHOULD / SHOULD | generalize | | | | | The rejected D72 source row is skipped. |

### Query-string-dependent UI

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-016 | D15 | MUST / MUST | | | | DATA-016 | | |
| DATA-017 | D73 | SHOULD / SHOULD | | | Allowlist Sort Columns With an Enum (live), for clause X5 | | DATA-016 | Clause X5 added. Model file names dropped. |
| DATA-018 | NX-07 | new / SHOULD (sheet) | | | Stop Writing Laravel APIs Like This (live 2026-11-30), Allowlist Sort Columns With an Enum (live) | sheet idea IN4 | DATA-048 | The check idea's helper names follow Q1. |

### Lazy loading

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-019 | D16 (core part) | MUST / MUST (clash list) | generalize | | Next.js lazy loading guide | DATA-019 | | Names Vercel `bundle-dynamic-imports`. The widget example, the dialog-library clause and the highlighter example leave the core text. |

### Content images

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-020 | D18 (core part) | MUST / MUST | | | | DATA-020 | | The sanitizer clause goes to UNTRUSTED-008. |

### State management

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-021 | D19 (core part) | SHOULD / SHOULD | | store | XState Store and TanStack Query (draft, vault path) | | DATA-032 | The error-report clause goes to the error-reporting add-on (SENTRY-003). |
| DATA-022 | D20 | SHOULD / SHOULD | | | XState Store and TanStack Query (draft, vault path) | | | |
| DATA-023 | D21 | SHOULD / SHOULD | | | XState Store and TanStack Query (draft, vault path); TanStack Query `queryOptions` guide | | STRUCT-032 | |
| DATA-024 | D22 | SHOULD / SHOULD | | | | | DATA-022 | |
| DATA-025 | D23 | SHOULD / SHOULD | generalize | | TanStack Query v5 migration guide | | | |
| DATA-026 | D24 | SHOULD / SHOULD | | | XState Store and TanStack Query (draft, vault path) | | DATA-071, DATA-027 | "Mutation hooks decide their own retry" points at DATA-027. Two D24 rows skipped or moved (see Sources). |
| DATA-027 | NX-06 | new / SHOULD (sheet) | | | XState Store and TanStack Query (draft, vault path); The Decorator Pattern (live), moved from D24 | sheet idea | DATA-026, DATA-032 | Decision note adds: a write that is not idempotent and has no idempotency key is not retried. |
| DATA-028 | D25 | MUST / MUST | | store | XState Store and TanStack Query (draft, vault path) | | DATA-029 | NX-09 removes the "one event per field" allowance. The four store checks of the source guard test are listed in the PR. |
| DATA-029 | NX-09 | new / SHOULD (sheet) | | store | Tell, Don't Ask (live); Q4 | sheet idea | DATA-028 | Past-tense event names, with the examples from the decision note. |
| DATA-030 | D26 | SHOULD / SHOULD | | | | | | |
| DATA-031 | D55 | SHOULD / SHOULD | generalize | | | | | |
| DATA-032 | D69 (core part) | SHOULD / SHOULD | generalize | store | XState Store and TanStack Query (draft, vault path) | | DATA-021 | The report clause goes to SENTRY-004. |
| DATA-033 | D74 | SHOULD / SHOULD | | | XState Store and TanStack Query (draft, vault path) | | | Timing constant names follow Q1. |

### Forms

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-034 | D43 | SHOULD / SHOULD | | Zod | | | | The section intro is rewritten for Zod and loses its file list. |
| DATA-035 | D44 | SHOULD / SHOULD | generalize | Zod | Input Validation vs Domain Validation (live); Put the Date Rule in a DateRange (live 2026-12-21); One Form Request per Write Action (live 2026-11-26), for X2; Require Every Field the Controller Reads (live 2026-12-07), for X3 | | | Clauses X2 and X3 added. The rejected D44 row is skipped. |
| DATA-036 | NX-05 | new / SHOULD (sheet) | | Zod | Input Validation vs Domain Validation (live); Value Objects (live); Keep the Form Request Rule When the Value Object Checks It Too (live 2027-01-04) | sheet idea PC3 | DATA-035, DATA-037 | |
| DATA-037 | D45 | SHOULD / SHOULD | | | | | DATA-039 | The captcha example belongs to an add-on; a neutral single-field form takes its place. |
| DATA-038 | D46 | SHOULD / SHOULD | | store | | | | The non-public source quote is dropped. A UI-only flag such as show-password replaces the captcha example. |

### API calls and configuration

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-039 | D27 (core part) | SHOULD / Q2 | generalize | | | DATA-039 | | The HTTP-library clause goes to AXIOS-001 and the edge endpoint clause to CF-013. The rejected D27 row is skipped. |
| DATA-040 | D28 | SHOULD / SHOULD | | | Exception Handling as Design (live) | | DATA-047 | |
| DATA-041 | D29 | SHOULD / SHOULD | | | | | TYPES-003, DESIGN-006 | |
| DATA-042 | D30 (core part) | MUST / MUST | | | | DATA-042 (env module guard) | | The runtime clause goes to CF-014, the init-file clause to SENTRY-005, the site-key example to TURNSTILE-004. The rejected D30 row is skipped. |
| DATA-043 | D38 | SHOULD / SHOULD | | | | | | The non-public source quote and the deploy how-to are dropped. |
| DATA-044 | D49 | SHOULD / Q2 | | | Feature Modules (draft, vault path) | DATA-044 | DATA-048 | |
| DATA-045 | D70 | SHOULD / SHOULD | | | Don't Read Auth::user() Inside a Use Case (live); The Command Pattern (live); Why Your Laravel Codebase Is Unmaintainable (live 2026-11-30) | | | A neutral store value replaces the captcha example in the Why. |
| DATA-046 | NX-04 | new / SHOULD (sheet) | | | Command-Query Separation (live); Queries and Query Handlers (live); Commands Change State, Queries Return It (live) | sheet idea QT2, with the allowlist | DATA-045, TYPES-027 | Wide scope per the decision note. |
| DATA-047 | D71 (core part) | SHOULD / SHOULD | generalize | | Domain Exceptions vs Framework Exceptions (live); Throw a Domain Exception, Not a Framework One (live) | | | The library-named failure becomes "a transport failure". The typed-error clause goes to AXIOS-002. |
| DATA-048 | D77 | SHOULD / SHOULD | generalize | | | | | The library-named `params` becomes "the API client's `params` option". |

### Loading, success and error

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-049 | D31 | MUST for an empty `catch`, SHOULD for the states / same | | | Guard Clauses and Defensive Programming (live) | | | |
| DATA-050 | D32 | SHOULD / SHOULD | | | | | | |
| DATA-051 | D33 | SHOULD / SHOULD | | | | | | |

### Reporting errors

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-052 | D41 (core part) | SHOULD / SHOULD | | | | | | Core keeps the digest on screen. The report clause goes to SENTRY-006 and the analytics clause to PLAUSIBLE-002. The section intro about automatic reports goes with them. |
| DATA-053 | D42 | MUST / MUST | | | | Q7 | Q6 | The cross-reference to an add-on rule is Q6. |

### Browser storage, session and navigation

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-054 | D51 | SHOULD / SHOULD | generalize | | Vercel `client-localstorage-schema` rule | | ACCESS-005 | Keys use an `<app>_<snake_case>` placeholder prefix. |
| DATA-055 | D52 | SHOULD / SHOULD | generalize | | Q5 | | | NX-03: the session-end sentence moves into the rule text. |
| DATA-056 | D53 | SHOULD / SHOULD | generalize | | | | | |
| DATA-057 | D54 | SHOULD / SHOULD | generalize | | | | | |
| DATA-058 | D60 | SHOULD / SHOULD | generalize | | | Q7 | | |
| DATA-059 | D61 | MUST for `timeZone`, SHOULD for the rest / same | generalize | | Queries and Query Handlers (live); The date Rule Accepts Dates Your Query Doesn't (live), for X4; MDN `Date.parse` | DATA-059 | | The clause step 4 names is dropped. Clause X4 is added without its "Unverified" sentence: MDN says non-ISO formats are implementation-defined. |
| DATA-060 | D78 | SHOULD / SHOULD | generalize | | | | | One model stays, the auth events in `src/lib/authSession.ts`. |
| DATA-061 | D68 | SHOULD / SHOULD | generalize | | | | ACCESS-015, ACCESS-011 | Decision 8: the consent part follows the core consent principle. A neutral loader and a neutral form-protection script replace the vendor examples. |

### Hydration, layout and caching

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-062 | D56 | SHOULD, MUST once a scan test exists / SHOULD | generalize | | | | STRUCT-016, DATA-013 | The "MUST once" clause goes: no such check is in `index.md`. |
| DATA-063 | D76 | SHOULD / SHOULD | generalize | | | | | |
| DATA-064 | D57 (core part) | MUST / MUST | generalize | | | DATA-064 | DATA-003, DATA-005 | Decision 2. The edge-cache reason goes to CF-015. |
| DATA-065 | D58 | MUST for the file, SHOULD for `Suspense` / same (clash list) | generalize | | Next.js `loading.js` reference | DATA-065 | | Condition line on the `Suspense` half (Q3). The Why comes from the docs' status-code section. |
| DATA-066 | D66 | SHOULD / SHOULD | | | The Singleton Pattern (live); Vercel `server-no-shared-module-state` rule | | | The host-specific Why becomes "one server instance serves many requests". |

### React and effects

| id | From | kw src / kw pack | safety | reword | sources | check | refs | notes |
|---|---|---|---|---|---|---|---|---|
| DATA-067 | D62 | SHOULD / SHOULD (clash list) | | | react.dev React Compiler; Next.js `reactCompiler` reference | | | Condition line: the React Compiler is on. Names Vercel `rerender-memo`. The kept-uses list and the migration note go. |
| DATA-068 | D63 | SHOULD / SHOULD | | | react.dev You Might Not Need an Effect | | TYPES-039 | |
| DATA-069 | D64 | SHOULD / SHOULD | | | | | | |
| DATA-070 | D65 | SHOULD / MUST (owner decision 2026-11-23, clash list) | | | Next.js data security guide | | | Vercel `server-auth-actions` is marked not applicable. |
| DATA-071 | D67 | SHOULD / SHOULD | generalize | | Guard Clauses and Defensive Programming (live) | | DATA-026 | |

### What is NOT a violation

The source items, generalized for the core rules: the two server fetch helpers, the `useSearchParams` allowlist, per-viewer data on a prerendered page, and JSON-LD escaping `<`. The add-on item and the memoization clean-up item go.

## Readings of the issue

The PR lists these, so the owner can change any of them.

- A source note is dropped when it is Observed, Not migrated, Migrated, Audit, an incident, a How-to or Model link into the source project's docs, or a file and line reference. A Why stays, with a neutral example. NX-03's sentence is the one Migrated text that survives, as rule text.
- A condition the issue or the clash list asks for is a `- Condition:` sub-line under the rule text. The upstream rule or doc an entry overrides is named in the rule text, as in the clash list.
- A source the source rule quotes from a public doc keeps a Source line with the doc's URL (TanStack Query, react.dev, the Vercel rules). A non-public source is dropped. No source is added beyond the approved sheet rows, the docs the clash list names, and MDN for X4.
- Mixed keywords keep the source's split form, for example "**MUST** for the file; **SHOULD** for the `Suspense` half".
- A Check line names a guard-test row by pack id, or the sheet's check idea for an NX row. Other tests the source rule cites go to a PR list for stage 2: the page-classification, force-dynamic, cache-header, internal-route, seed, fetch-indicator, store and route-slug tests (D1 to D9, D12, D13, D25, D77).
- For NX-05 the Check line carries the PC3 idea, the one that names async validators, which the decision note relies on.
- The D16 chunk-failure sentence stays in core in library-neutral form. The dialog-library clause adds its primitive.

## Verification

From the worktree root at the head commit, clean tree:

1. Every acceptance command in #90, with its output in the PR: the 71-entry count, the add-on grep, the source-name grep, the dropped-notes grep, the Source-line grep, the Yup grep, and an XState grep whose lines the PR lists. Every XState line is a rule naming XState Store as the implementation, or the title of the draft source "XState Store and TanStack Query".
2. The id map script with the rule file: 71 entries, 0 `From:` mismatches. The script source goes in the PR body. The script is not committed.
3. A check that the `Check:` lines of step 8 exist: DATA-016, 019, 020, 039, 042, 044, 059, 064, 065. Each NX entry carries its sheet check idea.
4. A grep for source ids written as cross-references (`\bD[0-9]+\b` and `\b[SPTUAC][0-9]+\b` outside `From:` lines) prints nothing.
5. Source status re-checked on the day the rules are written: vault frontmatter, plus the page title on https://codyssey.dev/ ("Coming <date>" means not live). On 2026-11-25 the scheduled ones are One Form Request per Write Action (2026-11-26), Stop Writing Laravel APIs Like This and Why Your Laravel Codebase Is Unmaintainable (2026-11-30), Require Every Field the Controller Reads (2026-12-07), Name Your Events in the Past Tense (2026-12-14), Put the Date Rule in a DateRange (2026-12-21) and Keep the Form Request Rule When the Value Object Checks It Too (2027-01-04). The five decoupled-frontend lessons are drafts.
6. Every check in `.factory/recipe.yml`.
7. The PR body has the three tables the issue asks for: the 24 safety fixes, the keyword changes with their decision, and every source row written, skipped or moved.

## Sources

- Written: the 25 approved rows on core rules of this file (D1, D2, D7, D11, D12, D19, D20, D21, D24, D25, D28, D31, D44 twice, D49, D61, D66, D67, D69, D70 three times, D71 twice, D74), the sources of NX-04, NX-05, NX-06, NX-07 and NX-09, and those of X2 to X5.
- Moved: The Decorator Pattern, from D24 to NX-06's idempotency clause.
- Skipped: the rejected rows on D24, D27, D30, D44 and D72.
- Not here: the rows on D34, D40 and D50 (#96).

## Out of scope

- Every other rule file, the add-on files and the overlay (#89, #91 to #96), and the audit (#97).
- `SKILL.md` and `references/index.md`. A name or a stack line they lack is a follow-up, not an edit here.
- The template repository, its guard test, and `bootstrap --frontend nextjs`.
- Any change to `codysseydev/codyssey-frontend`.

## Inputs that disagree

- The Rule Recount table gives D62 the keyword MUST. The source text and the clash list give SHOULD, and the issue settles it as SHOULD.
- The Rule Recount says D8's guard check stays portable in core. The guard-test rows in `index.md` do not list it, and step 8 drops it. The plan follows the issue and lists the test for stage 2.
- The recount routes D16's chunk-failure clause to the dialog-library add-on, and its U39 note calls the same clause specific to the source project. The plan keeps a library-neutral sentence in core.
- NX-09's decision note bases the past-tense convention on the quick tip "Name Your Events in the Past Tense". The Sources column cites only Tell, Don't Ask (Q4).
- D27 and D49 say SHOULD, while the source file's severity note says a rule a test enforces is MUST, and both have guard-test rows (Q2).
- D1, D3 and D5 to D7 rely on the `dynamic` and `revalidate` exports. Next.js 16 removes them when Cache Components is on, and the fixed stack does not say whether it is on (Q3).

## Open questions

Q1. Helper and file names the rules use but the names table lacks (the server fetch helpers, the page-data, seed, retry, timing, storage, navigation, date, price and error-mapping modules, the fetch indicator, the internal rewrite folder). `index.md` says a rule that needs a name adds it there, and #90 touches no other file.
- **A. Role wording, and the PR lists every source name for a names-table follow-up (recommended).** For example "the shared date formatter", as guard-test row DATA-059 already reads. A folder the rule itself defines, such as the internal rewrite folder of DATA-003, stays literal and is listed too.
- B. Keep the source names as they are and list them in the PR.
- C. Add the names to `index.md` in this PR, against the issue's file scope.

Q2. D27 (DATA-039) and D49 (DATA-044) are SHOULD in the source, yet a guard-test row checks each.
- **A. Keep SHOULD with the Check line, since no decision changes them (recommended).**
- B. Raise both to MUST to match the guard test.

Q3. Next.js 16 removes `dynamic` and `revalidate` when Cache Components is on, and the fixed stack does not say whether it is on.
- **A. A condition line "Cache Components is off" on DATA-001, DATA-003, DATA-005 to DATA-007 and the `Suspense` half of DATA-065, plus a follow-up to add it to the stack line in `SKILL.md` (recommended).** The decided DATA-001 text only builds with Cache Components off, so leaving it unstated ships a decided rule that fails on a template with it on.
- B. No condition line here, and a follow-up issue decides the stack line first.
- C. One sentence under the section heading instead of a line per entry.

Q4. NX-09 (DATA-029): add the quick tip "Name Your Events in the Past Tense" (live 2026-12-14, vault path until then) as a second Source line?
- **A. Yes, since the decision note names it as the basis of the convention (recommended).**
- B. No, only the Sources column row Tell, Don't Ask.

Q5. D52 (DATA-055) takes NX-03's sentence. Does it take NX-03's source, the draft lesson "Authentication Across the Boundary"?
- **A. Yes, by vault path, since the sentence comes from that lesson (recommended).**
- B. No, step 7 does not list it.

Q6. D42 (DATA-053) says an error the UI absorbs follows D39, a rule of the error-reporting add-on. A core entry that cites that add-on's id fails the add-on grep.
- **A. Write "report it through the project's error reporter" with no add-on id; the add-on rule already covers its own case (recommended).**
- B. Cite SENTRY-001 and explain the grep line in the PR.
- C. Drop the clause.

Q7. D42 (DATA-053) names the `no-console` lint rule, and D60 (DATA-058) names a Next.js lint rule on relative `location` assignment that is not in the rules table of the Next.js ESLint plugin docs (checked 2026-11-25). No guard-test row names either, and whether `tooling.md` (#95) ships them is not known here.
- **A. No Check line; DATA-058 drops the lint rule name; the PR lists both for #95 and stage 2 (recommended).**
- B. A Check line naming each lint rule as the source names it.

## Decisions (owner, 2026-11-25)

The owner approved this plan in an interactive session on 2026-11-25.

- Q1: settled by owner decision 1 below. Rules cite concrete generic file and helper names, and the PR lists each one for a names-table follow-up. `index.md` is not edited.
- Q2: A. DATA-039 and DATA-044 stay SHOULD with their Check lines.
- Q3: A, without the `SKILL.md` edit. A "Cache Components is off" condition line goes on DATA-001, DATA-003, DATA-005 to DATA-007 and the `Suspense` half of DATA-065. The stack line comes in a later follow-up PR.
- Q4: A. DATA-029 also cites "Name Your Events in the Past Tense", by vault path until it is live.
- Q5: A. DATA-055 also cites "Authentication Across the Boundary", by vault path.
- Q6: A. DATA-053 says "the project's error reporter" with no add-on id.
- Q7: A. No Check line on DATA-053 or DATA-058; DATA-058 drops the lint rule name; both are listed in the PR for #95.

Owner decisions for every rule issue:

1. Rules cite concrete generic file and helper names even when the names table lacks them. The PR lists every name introduced under "Names for the index.md follow-up".
2. Every entry has a one-line `Why:`. The PR lists each Why written fresh.
3. Source lines are `- Source: <title> <URL>` or `- Source: <title> vault: Content/<path>.md`, with no quote. A lesson's point goes into the Why. A source citing the retired `next-best-practices` skill is replaced by the matching nextjs.org page.
4. A source is live only if its codyssey.dev page title is not "Coming <date>". Otherwise it cites the vault path.
5. Cases a and h of S28 belong to the untrusted-content add-on (#96).
6. The issue's acceptance greps decide what counts as a Codyssey name; `vault: Content/` paths may carry the course name.
7. Cross-references use pack ids from the id map only.

Storage keys use the placeholder prefix `<app>_`, shared with #94. Plan comment: https://github.com/codysseydev/codyssey-skills/issues/90#issuecomment-7157424603

## Decisions after the independent review (owner, 2026-11-25 and 2026-11-26)

The owner answered the independent review's questions over these two days. The answers are not split by day here.

1. DATA-029: the Check line drops its review half (the sentence calling a `(field, value)` action a setter). The guard-test half stays.
2. DATA-042: the core sentence stays as written: `next.config` reads the build variables before the app runs and stays outside the env module.
3. DATA-028: no longer says names "follow DATA-029"; it states its own naming rule in place. Written as a past-tense clause marked **SHOULD** inline, so the entry's **MUST** does not raise the naming rule above DATA-029's keyword.
4. DATA-027: the Check line leads with "the provider default retries queries only; a mutation opts in per hook", consistent with the NX-06 clause and DATA-026. The NX-06 unit-test and grep idea stays after it, since step 8 keeps the sheet's check idea on NX rows. The rule text no longer says the mutation default lives in the provider; it says each mutation hook opts in through `shouldRetryMutation`.
5. DATA-062: one exception for DATA-012's read of the seed timestamp (`perViewerSeedUpdatedAt()` reads the stored auth flag in render; the value changes query timing, never markup).
6. DATA-006: "the guard test's `DYNAMIC_PAGES` list" becomes "the page list the guard test reads (stage 2)". `DYNAMIC_PAGES` leaves the names list.
7. DATA-012: "must also open for a signed-out visitor" is a requirement again.
8. DATA-053: the Why drops the assumption that the build strips console calls.
9. DATA-057: the Why says invalidation marks the query stale and the active query refetches (TanStack Query invalidation guide), so a later `fetchQuery` within the provider's `staleTime` resolves from the cache. No Source line is added (the source reading above).
10. Every rule file's intro sentence about Check lines matches the entry format of `index.md`: a `Check:` line names the guard-test row, the lint rule, or the sheet's check idea for a rule, where one exists. This PR changes this file only; the other rule files take it in their own PRs.

Source status, rechecked on 2026-11-26 before the PR: every source cited by vault path still has a "Coming <date>" page title or no public page, One Form Request per Write Action included, so every vault path stays.

The `- Condition:` sub-line is not in the entry format of `index.md`. The PR lists it as a follow-up for `index.md` and #97.
