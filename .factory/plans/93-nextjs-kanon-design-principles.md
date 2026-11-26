# Plan for #93, nextjs-kanon: the design-principles rules

Issue codysseydev/codyssey-skills#93. Base origin/main 339f740. Branch `factory/93`. Kind: feature.

## Goal

Fill `kanon/nextjs-kanon/references/design-principles.md` with its 20 entries: 15 core rules (P1, P2, P4 to P16), the core part of P3, and the four new rules NX-10 to NX-13 from the review sheet. Each entry uses the entry format of `references/index.md`, carries the pack id the id map gives, and applies the safety-pass fix, the notes policy, the rewording table, the approved clauses X6 and X7, and the approved sources. The file also gets the course line in its intro and the "Considered and not proposed" list. No other file changes.

## Inputs read

- Frontend rule text: `codysseydev/codyssey-frontend` at `abdfd9f2`, `.ai/rules/design-principles.md` (P1 to P16 and "Considered and not proposed").
- `kanon/nextjs-kanon/references/index.md` at 339f740: id map rows DESIGN-001 to DESIGN-020, entry format, notes and source policies, "Names rules may cite", guard-test rows. `SKILL.md`: the store line of the fixed stack.
- `.factory/plans/88-nextjs-kanon-skeleton.md`: NX-10 then NX-12 after P3, NX-11 after P4, NX-13 after P9 (owner decision 2 of 2026-11-24); `design-principles.md` has no `##` sections (owner decision, readings section).
- Vault: `Technical/React and Next.js Pack Prerequisites.md` (decisions 9, 11, 16 and the rewording table), and `Public Safety Pass.md`, `Rule Recount.md` and `Content Extraction.md` in `Technical/Research Notes/React and Next.js Pack Prerequisites/`.
- Review sheet, revision 26, read from a snapshot of 2026-11-24: Candidates NX-10 to NX-13, Clauses X6 and X7, Conflicts C8 and C9, Sources (the 38 approved rows on P rules).

## Entries

In file order. The pack id and `From:` value are the id map's. Keyword "SHOULD" in the frontend column is the frontend rule's own keyword. Fix types are the safety pass's names; "notes" means the notes policy only (drop Observed, Not migrated, Migrated, audit and incident notes, keep each Why with a neutral example).

| # | pack id | From | keyword: frontend, planned (what sets it) | safety-pass fix and other text changes | Check line | cross-references |
|---|---|---|---|---|---|---|
| 1 | DESIGN-001 | P1 | SHOULD, SHOULD (frontend) | none flagged; notes | none | none |
| 2 | DESIGN-002 | P2 | SHOULD, SHOULD (frontend) | generalize: drop the file and vendor names and the counts, keep the layer table; rewording table: the Store row and the store bullet say "client-only UI state in a small external store with selector subscriptions, XState Store as the named implementation"; the model store action becomes a neutral example with no feature path; drop "This applies to new code"; drop the non-public Source line | none | TYPES-019 (T10), DATA-032 (D69) |
| 3 | DESIGN-003 | P3 (core part) | SHOULD, SHOULD (frontend) | move to the source project's overlay: the clause, its how-to and its notes are left out; neutral examples in the lead sentence, the pure-function example and the double-negation example; drop the PR reference | none | DESIGN-010 (P7), TYPES-019 (T10) |
| 4 | DESIGN-004 | NX-10 | none, SHOULD (NX-10 decision note: MUST once a lint rule is confirmed and turned on, said in the entry) | new rule, merged scope: `utils/`, `src/lib/`, and data from a query, a store or props | the check idea (`readonly` makes `sort` and `push` a `tsc` error; candidate guard-test regex and lint rules marked unconfirmed); no claim that a lint rule exists | none |
| 5 | DESIGN-005 | NX-12 | none, SHOULD (NX-12 decision note) | new rule: one `Record<Status, readonly Status[]>`, `canTransition({ from, to })` (owner answer 1 of 2026-11-26), the store path for flows with effects (question d), UI gating is a hint | question g | ACCESS-007 (A4); DATA-021 (D19) if question d takes option A |
| 6 | DESIGN-006 | P4 | SHOULD, SHOULD (frontend) | notes; drop the how-to and doc links; keep the input-limit bullet without its link | none | TYPES-003 (T3), DESIGN-009 (P6) |
| 7 | DESIGN-007 | NX-11 | none, SHOULD (NX-11 decision note: N = 2, review only) | new rule: two property levels, deeper values from a mapper, a query `select` or a selector; exemptions per question e | review only, lint check only after its noise is measured (question g) | DESIGN-006 (P4) |
| 8 | DESIGN-008 | P5 | SHOULD, SHOULD (frontend) | notes; the "none today" sentence on value objects becomes general advice; branded ids stay in "Considered and not proposed" | none | DESIGN-003 (P3) |
| 9 | DESIGN-009 | P6 | SHOULD, SHOULD (frontend) | possible miss from the regex scan, rename: neutral mapper names in the lead and the examples; drop the Migrated and Known exception notes and the doc link | none | none |
| 10 | DESIGN-010 | P7 | SHOULD, SHOULD (frontend) | possible miss from the regex scan, rename: neutral wrapper and file names; the Why keeps its point (server and browser time zones can differ) with no host or test file names; drop the Migrated and Exempt notes and the doc link; clause X7: a bullet for randomness (`Math.random()` and `crypto.randomUUID()` inside `utils/` logic are hidden dependencies) | none | DATA-042 (D30) |
| 11 | DESIGN-011 | P8 | SHOULD, SHOULD (frontend) | notes | none | DESIGN-003 (P3) |
| 12 | DESIGN-012 | P9 | SHOULD, SHOULD (frontend) | drop clause: the flagged sentence goes; drop the Not migrated block; the named-error example is neutral; one added line points at DESIGN-013 (outcomes the user's input causes, from a pure function, never from a `queryFn` or `mutationFn`); the rule text is unchanged | none | DESIGN-013 (NX-13) |
| 13 | DESIGN-013 | NX-13 | none, question c | new rule from the C8 split: named errors stay for faults and not-found, a discriminated union for outcomes the user's input causes, returned by a pure function, never by a `queryFn` or `mutationFn` | question g | DESIGN-012 (P9), TYPES-015 (T26), DATA-025 (D23), DATA-026 (D24) |
| 14 | DESIGN-014 | P10 | SHOULD, SHOULD (frontend) | drop: the PR reference goes, the "one object through three components" example stays generic; drop the Observed and Migrated notes and the doc link | none | none |
| 15 | DESIGN-015 | P11 | SHOULD, SHOULD (frontend) | drop: the PR number goes; drop the Observed note and the doc link; the sentence saying the Strategy lesson is unpublished goes (decision 11, the lesson is live and is an approved source) | TYPES-015, the guard-test row for a remaining `switch` | TYPES-015 (T26) |
| 16 | DESIGN-016 | P12 | none, question b | none flagged | none | STRUCT-011 (S9 core part), STRUCT-012 (S10) |
| 17 | DESIGN-017 | P13 | SHOULD, SHOULD (frontend) | notes; drop the how-to doc link | none | none |
| 18 | DESIGN-018 | P14 | SHOULD, SHOULD (frontend) | drop: the Not migrated block goes; neutral field names in the example | none | none |
| 19 | DESIGN-019 | P15 | SHOULD, SHOULD (frontend) | drop: the PR Source lines and the Not migrated note go; a neutral function replaces the frontend's example; drop "For new code"; clause X6: the trigger, and so the title, also covers two or more positional parameters of the same primitive type (for example two string ids); the `queryOptions` `enabled` exception stays | none | DESIGN-014 (P10) |
| 20 | DESIGN-020 | P16 | SHOULD, SHOULD (frontend) | drop: the PR Source line, the site count and the doc link go | none | none |

Ten entries carry a safety-pass row: P2 (generalize), P3 (move to the source project's overlay), P6 and P7 (possible misses, rename), P9 (drop clause), P10, P11, P14, P15 and P16 (drop). The PR's fix table lists these ten.

### The rest of the file

- Intro: the #88 stub's title, scope paragraph and severity paragraph stay. One paragraph is added: the course name with its https://codyssey.dev/ URL on one physical line, and the sentence that the course is PHP, so each rule says what its term means in TypeScript. The frontend's lines on rule ids, schedule dates, unpublished lessons, the Not migrated regime and research dates are dropped (decisions 9 and 11).
- "Considered and not proposed", after DESIGN-020, in the form question a settles. Items: branded id types (DESIGN-008); a repository or adapter layer over `apiClient`, the "chain of the same fields" trap of DESIGN-001, with the Repository Pattern lesson linked (the sheet row covers this bullet); runtime schema validation of API responses; factory classes; Server Actions for mutations, which some vendored Next.js skills recommend (DATA-070); turning on `cacheComponents`, since caching is decided by DATA-001 to DATA-008; Suspense around async content and wider `next/dynamic` use (DATA-001, DATA-019); `<ViewTransition>`. Dropped: counts, PR ranges, the claim that a guard test enforces the caching rules (no guard-test row in `index.md` covers DATA-001 to DATA-008), and the deploy-host remark on view transitions.

## Sources

Each entry's Source lines join the frontend's lesson citations (decision 11), the approved Sources-tab rows, and the NX and X rows, deduplicated by URL within an entry. Status checked on 2026-11-25 against the page title on https://codyssey.dev/ ("Coming <date>" means scheduled; the site answers HTTP 200 either way) and the vault file's `date` and status tag. A live item cites its URL; a scheduled or draft item cites `vault: Content/<path>.md` (source policy). The run checks the status again when it writes the file.

Origin: F = frontend lesson citation, S = Sources-tab row, N = NX row, X = clause row.

| pack id | source | origin | status |
|---|---|---|---|
| DESIGN-001 | Introduction - Tools, Not Rules | F | live |
| DESIGN-001 | Data Transfer Objects | F | live |
| DESIGN-001 | CQRS: Separate Models for Reads and Writes | S | live |
| DESIGN-001 | Refactoring Legacy Code: The Course Capstone | S | live |
| DESIGN-001 | SOLID Principles Explained With Real Code | S | live |
| DESIGN-001 | The Builder Pattern | S | live |
| DESIGN-001 | The Factory Design Pattern | S | live |
| DESIGN-001 | The Repository Pattern (also on the "Considered and not proposed" repository bullet) | S | live |
| DESIGN-001 | When Event Sourcing Is Worth It, and When It Isn't (`Content/Insights/`) | S | draft |
| DESIGN-002 | Anemic Domain Model vs Rich Domain Model | S | live |
| DESIGN-002 | CQRS: Separate Models for Reads and Writes | S | live |
| DESIGN-002 | Why Your Laravel Codebase Is Unmaintainable (`Content/Insights/`) | S | scheduled 2026-11-30 |
| DESIGN-003 | Tell, Don't Ask (course lesson) | F | live |
| DESIGN-003 | Tell, Don't Ask (quick tip) | S | live |
| DESIGN-003 | Anemic Domain Model vs Rich Domain Model | S | live |
| DESIGN-003 | The Specification Pattern | S | live |
| DESIGN-003 | A Rich Model Beats an Anemic One (`Content/Quick Tips/23 - ...`) | S | scheduled 2026-12-08 |
| DESIGN-003 | The Specification Pattern for Reusable Query Rules (`Content/Quick Tips/15 - ...`) | S | scheduled 2027-01-05 |
| DESIGN-003 | Your Service Classes Are Where Logic Goes to Die (`Content/Insights/`) | S | draft |
| DESIGN-004 | Immutable Objects (listed twice on the row) | N | live |
| DESIGN-004 | readonly Is Not Immutability | N | live |
| DESIGN-005 | The State Pattern | N | live |
| DESIGN-005 | Your Service Classes Are Where Logic Goes to Die (`Content/Insights/`) | N | draft |
| DESIGN-006 | Data Transfer Objects | F | live |
| DESIGN-006 | Guard Clauses and Defensive Programming | F | live |
| DESIGN-006 | Input Validation vs Domain Validation: Where Each Belongs | S | live |
| DESIGN-006 | The Repository Pattern | S | live |
| DESIGN-006 | Don't Return the Eloquent Model From a Handler (`Content/Quick Tips/50 - ...`) | S | scheduled 2026-12-11 |
| DESIGN-006 | Turn Decoded JSON Into a DTO at the Edge (`Content/Quick Tips/49 - ...`) | S | scheduled 2026-12-16 |
| DESIGN-006 | Your Laravel Code Needs More Objects (`Content/Insights/`) | S | scheduled 2026-11-30 |
| DESIGN-006 | Feature Modules (draft lesson, chapter 08 of the course about the source project's own frontend, under `Content/Courses/`) | S | draft |
| DESIGN-007 | The Law of Demeter (listed twice on the row) | N | live |
| DESIGN-007 | Stop Chaining Through Objects (`Content/Quick Tips/18 - ...`) | N | scheduled 2026-11-27 |
| DESIGN-008 | Data Transfer Objects | F | live |
| DESIGN-008 | Value Objects | F | live |
| DESIGN-009 | Named Constructors | F | live |
| DESIGN-009 | Named Constructors Over new Plus Setters | S | live |
| DESIGN-010 | Dependency Injection vs the Service Locator Pattern (also the X7 row) | F, X | live |
| DESIGN-010 | A Facade Is Service Location Too | S | live |
| DESIGN-010 | Service Location Is a Hidden Dependency | S | live |
| DESIGN-010 | The Singleton Pattern | S | live |
| DESIGN-010 | Why Your Laravel Codebase Is Unmaintainable (`Content/Insights/`) | S | scheduled 2026-11-30 |
| DESIGN-011 | Guard Clauses and Defensive Programming | F | live |
| DESIGN-011 | Guard Clauses Beat Nested Ifs | S | live |
| DESIGN-012 | Guard Clauses and Defensive Programming | F | live |
| DESIGN-012 | Exception Handling as Design | S | live |
| DESIGN-012 | Throw a Domain Exception, Not a Framework One | S | live |
| DESIGN-012 | Skip Bad Rows, Don't Fail the Import (`Content/Quick Tips/58 - ...`) | S | scheduled 2027-01-13 |
| DESIGN-013 | The Result Pattern: An Alternative to Throwing Exceptions | N | live |
| DESIGN-013 | Result Objects When Failure Isn't Exceptional (`Content/Quick Tips/10 - ...`, listed twice on the row) | N | scheduled 2026-12-17 |
| DESIGN-014 | Composition vs Inheritance | F | live |
| DESIGN-014 | Composition Over Inheritance | S | live |
| DESIGN-015 | The Factory Design Pattern | S | live |
| DESIGN-015 | The State Pattern | S | live |
| DESIGN-015 | The Strategy Pattern | S | live |
| DESIGN-016 | Dependency Injection vs the Service Locator Pattern | F | live |
| DESIGN-017 | Vercel composition rule `react19-no-forwardref`, https://github.com/vercel-labs/agent-skills/blob/main/skills/composition-patterns/rules/react19-no-forwardref.md | F | public doc |
| DESIGN-018 | Queries and Query Handlers | S | live |
| DESIGN-019 | Primitive Obsession (also the X6 row) | S, X | live |
| DESIGN-019 | The Builder Pattern | S | live |

Totals: 60 Source lines. 38 come from the 38 approved Sources-tab rows (27 live, 8 scheduled, 3 draft, matching `Content Extraction.md`), 8 from NX rows (11 listed, 3 duplicates), 14 from frontend lesson citations, and 0 extra from X6 and X7, which repeat a line already planned. DESIGN-020 has none.

## Readings of the issue

These follow from the inputs. The PR lists them so the owner can change any of them.

- Entry shape: the rule text ends with the keyword. Requirement bullets of the frontend rule stay as unlabeled sub-bullets before `Why:`, as the issue's "a bullet" for X7 implies. P2's layer table stays as a table indented inside the entry.
- Example names (owner decision 1 of 2026-11-25): examples cite concrete generic file and helper names even when "Names rules may cite" lacks them. `index.md` is not edited; the PR lists every name the file introduces under "Names for the index.md follow-up".
- How-to lines and links into the source project's `docs/guides/` are dropped. The template has no such guides.
- "For new code" qualifiers in P2 and P15 belong to the frontend's Not migrated regime and are dropped.
- The intro line naming the course keeps the course URL on the same physical line, so the acceptance grep prints nothing for it, which meets the criterion.
- The draft P4 source from chapter 08 of the course about the source project's frontend is cited by its `vault: Content/Courses/...` path. The approved Sources-tab row names it, and the issue's acceptance grep exempts `vault: Content/` lines.
- Long tables (the fix table, the keyword table, the source list, the from-check output) go in a PR comment linked from the body, per the operator's PR body rule.
- The keyword table in the PR lists P12 and the four NX rows. Every other entry keeps the frontend's SHOULD.

## Verification

From the worktree root at the head commit, clean tree.

1. The issue's acceptance commands, with output:
   - `grep -cE '^- \*\*DESIGN-[0-9]{3}\.' kanon/nextjs-kanon/references/design-principles.md` prints 20.
   - `grep -niE 'codyssey' kanon/nextjs-kanon/references/design-principles.md | grep -vE 'https://codyssey\.dev/|vault: Content/'` prints nothing or only the intro line naming the course.
   - `grep -nE 'Not migrated|Migrated:|Observed:|Audit(ed)?:|PR #[0-9]+|#[0-9]{3,4}\b|\b[0-9a-f]{8,40}\b|20[0-9]{2}-[0-9]{2}-[0-9]{2}' kanon/nextjs-kanon/references/design-principles.md` prints nothing.
   - `grep -nE '^\s*- Source:' kanon/nextjs-kanon/references/design-principles.md | grep -vE 'https://|vault: Content/'` prints nothing.
   - `grep -n 'DESIGN-013' kanon/nextjs-kanon/references/design-principles.md` shows the DESIGN-012 pointer line, and the DESIGN-013 entry names `queryFn` and `mutationFn`.
2. The from-check script (run outside the repo, source and output in the PR comment). It compares each entry's single `From:` line with the id map row, in order. Tested on 2026-11-25 against a 20-entry fixture (passes), a fixture with a swapped `From:` and a doubled `From:` (fails on both), and the stub (fails with 0 entries).

   ```python
   import re, sys
   index_path, rule_path, file_name = sys.argv[1:4]
   expected = []
   for line in open(index_path, encoding="utf-8"):
       m = re.match(r"^\| ([A-Z]+-\d{3}) \| `([^`]+)` \| [^|]+ \| ([^|]+?) \|", line)
       if m and m.group(2) == file_name:
           expected.append((m.group(1), m.group(3).strip()))
   entries, current = [], None
   for line in open(rule_path, encoding="utf-8"):
       m = re.match(r"^- \*\*([A-Z]+-\d{3})\. ", line)
       if m:
           current = [m.group(1), []]
           entries.append(current)
           continue
       f = re.match(r"^\s+- From: (.+?)\s*$", line)
       if f and current:
           current[1].append(f.group(1))
   problems = [f"{p}: {len(fs)} From: lines" for p, fs in entries if len(fs) != 1]
   got = [(p, fs[0] if fs else None) for p, fs in entries]
   if got != expected:
       problems.append(f"file {got}\nmap  {expected}")
   print(f"map rows: {len(expected)}, entries: {len(entries)}")
   print("\n".join(problems) or "OK")
   sys.exit(1 if problems else 0)
   ```

   Run: `python3 -I check_from.py kanon/nextjs-kanon/references/index.md kanon/nextjs-kanon/references/design-principles.md design-principles.md`.
3. Source status: for every `https://codyssey.dev/` URL on a Source line, fetch the page and check that its `<title>` does not contain "| Coming" and is not "Page not found". For every `vault: Content/` line, check that the vault file exists and that its status is draft or its `date` is after the write date. A source that went live between the plan and the build cites its URL instead.
4. Count check: 60 Source lines, and each of the 38 Sources-tab titles appears on the entry its row names.
5. Leftover check: `grep -nE 'docs/guides|Known exception|Exempt|For new code|This applies to new code' kanon/nextjs-kanon/references/design-principles.md` prints nothing.
6. Every check in `.factory/recipe.yml`. At base 339f740 all 12 pass.

## Out of scope

- Every other file: the other core rule files, the add-ons and the overlay (#89 to #92, #94 to #96), `index.md`, `SKILL.md`, and the audit (#97).
- The template repository `codysseydev/nextjs-template`, its guard test, and `bootstrap --frontend nextjs`.
- Any change to `codysseydev/codyssey-frontend`, including the chapter 08 code fixes.
- The Kanon catalog conversion (#33 to #43) and the move of these principles to a language-agnostic layer.
- C9 (S29 against the Service Pattern lesson) lands in `structure.md` (#89). This file only drops the frontend intro's note that the lesson was unpublished.
- Confirming which Oxlint rules exist for NX-10. The entry says it becomes MUST once one is confirmed and turned on.

## Decisions

The owner approved this plan in an interactive session on 2026-11-25 and accepted the recommended answer to every open question below: a A, b A, c A, d A, e A, f A, g A.

Owner decisions of 2026-11-25 for every rule issue:

1. Names: rules cite concrete generic file and helper names even when the `index.md` names table lacks them. `index.md` is not edited; the PR lists the names under "Names for the index.md follow-up".
2. Every entry gets a neutral one-line `Why:`. The PR lists every Why written fresh (no reason in the source rule or the sheet).
3. Source lines are `- Source: <title> <URL>` or `- Source: <title> vault: Content/<path>.md`, with no quote; a lesson's point goes into the Why. A source that cites the retired, unlicensed `next-best-practices` skill is replaced by the matching nextjs.org docs page.
4. A source is live only if its codyssey.dev page title is not "Coming <date>". Not live means the vault path. Checked at write time.
5. S28 cases a and h belong to the untrusted-content add-on (#96).
6. The issue's acceptance greps decide what counts as a Codyssey name; `vault: Content/` paths may carry the course name.
7. Rules cite other rules by pack id from the id map only.

Owner answers of 2026-11-26, after the independent review:

1. DESIGN-005 asks `canTransition({ from, to })` instead of `canTransition(from, to)`, so the rule's own example obeys DESIGN-019 (two positional parameters of the same type take an options object).
2. DESIGN-016 points at STRUCT-011 and STRUCT-012 without restating what they say.
3. The phrase "which the vendored React skills suggest" is dropped. The owner placed it in DESIGN-020; it stood in the Suspense bullet of "Considered and not proposed", right after DESIGN-020, and is dropped there.
4. The intro sentence about `Check:` lines matches the entry format of `index.md`: a `Check:` line names the guard-test row, the lint rule, or the sheet's check idea for a rule, where one exists. The answer covers every rule file in the batch; this branch applies it to `design-principles.md` only, and each sibling issue applies it to its own file.

## Open questions (answered)

Each had a first answer in the prototype drafts. None reopens a decided point. The recommended option of each is the decided one.

a. Form of "Considered and not proposed". The issue asks for the section; the owner confirmed that `design-principles.md` has no `##` sections.
   - **A. A bold label line, `**Considered and not proposed.**`, followed by the bullets, with no heading (recommended).** It keeps the no-`##` decision literally and does not touch the entry count.
   - B. One `## Considered and not proposed` heading as a stated exception, since the decision was about rule sections.
   - C. A `###` heading.

b. P12's keyword. The frontend P12 has none (the recount lists "none"), and the entry format ends every entry with one.
   - **A. SHOULD, the keyword of STRUCT-011 and STRUCT-012, which P12 points to (recommended).**
   - B. No keyword: a pointer entry that only restates STRUCT-011 and STRUCT-012.
   - C. MUST.

c. NX-13's keyword. The sheet's keyword column says SHOULD, the decision note says a union "is allowed", and the issue gives none.
   - **A. SHOULD: an outcome the user's input causes is returned as a union by a pure function, never by a `queryFn` or `mutationFn` (recommended).** It follows the sheet's keyword column.
   - B. MAY, matching "is allowed": the union is an option, and named errors stay the default.

d. NX-12's "XState Store machine". The decision note names one for flows with effects. XState Store's docs compare it to Zustand and point to full XState for complex state, so XState Store has no machine, and the Zustand mapping in `SKILL.md` has no counterpart.
   - **A. "A flow with effects keeps its moves in one action of the client store (DATA-021)" (recommended).** Library-neutral, and true of XState Store and Zustand.
   - B. Write "an XState Store machine" as the note says.
   - C. Name a full XState machine, which is outside the fixed stack.

e. NX-11's exemptions. The issue text has none. The sheet's proposed rule exempts fluent builders, config objects and one-hop reads, and the decision note changed only N.
   - **A. Keep "fluent builders, array method chains and config objects are exempt"; drop "one-hop reads", which N = 2 already allows (recommended).**
   - B. No exemptions, as the issue text reads.

f. Lesson quotes and Why lines. Decision 11 keeps the frontend's lesson quotes "as Source lines"; the entry format's Source line is `<title> <url>` with no quote, and most frontend P rules have no Why.
   - **A. Source lines are title and URL. A quote that gives the reason moves into a Why line in plain words. An entry with no frontend Why gets one written from its rule text or its lesson, and the PR lists every written Why (recommended).**
   - B. The frontend lesson Source lines keep their quote after the URL; sheet rows do not; Why lines only where the frontend has one.
   - C. Quotes dropped; Why lines only where the frontend has one.

g. Check lines on NX-11, NX-12 and NX-13. The issue settles P11 and NX-10 only. NX-13's sheet idea asks that "a service ... declares a union return type", which the C8 split no longer allows.
   - **A. NX-11: "review only", and a lint check only after its noise is measured. NX-12: the sheet's idea, marked "not shipped". NX-13: no Check line (recommended).**
   - B. A, plus NX-13 keeps the half of its idea that still holds: no component, hook or form handler branches on `error.status` inside a `catch`.
   - C. No Check line on any of the three.

## Disagreements in the inputs

- The issue says two NX rows cite the same lesson twice. Three do: NX-10 (Immutable Objects), NX-11 (The Law of Demeter) and NX-13 (Result Objects When Failure Isn't Exceptional). Each gets one Source line.
- The frontend intro and P11 call "The Service Pattern" and "The Strategy Pattern" unpublished. Both are live now (vault dates 2026-10-27 and 2026-10-28, and the site). Decision 11 drops the sentences; the Strategy lesson is an approved P11 source.
- NX-12's decided wording and the XState Store docs (question d). NX-13's check idea and the C8 split (question g). P12's missing keyword and the entry format (question b). The no-`##` decision and the issue's section (question a). NX-11's issue text and the sheet's proposed rule (question e).
- "Stop Chaining Through Objects" goes live on 2026-11-27 and "Why Your Laravel Codebase Is Unmaintainable" and "Your Laravel Code Needs More Objects" on 2026-11-30. Verification step 3 catches any that are live at build time.
