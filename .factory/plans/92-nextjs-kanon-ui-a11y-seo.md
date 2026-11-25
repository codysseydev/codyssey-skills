# Plan for #92, nextjs-kanon: UI, accessibility and SEO rules

Issue codysseydev/codyssey-skills#92. Base origin/main 339f740. Branch `factory/92`. Kind: feature.

## Goal

Fill `kanon/nextjs-kanon/references/ui-a11y-seo.md` with 70 entries in the entry format of `references/index.md`. That is 58 whole core rules, the core parts of 10 split rows, and the new rules NX-16 and NX-17. Each entry takes the pack id the id map gives it, sits in the source file's prose order, and carries one `From:` line. No other file changes.

## Inputs

- Source rule text: `codysseydev/codyssey-frontend` at `abdfd9f2`, `.ai/rules/ui-a11y-seo.md` (72 rules, 592 lines).
- `kanon/nextjs-kanon/references/index.md`: the id map (UI-001 to UI-070), the entry format, the notes and source policies, the names table, the guard-test rows and the checks the template may ship. `kanon/nextjs-kanon/SKILL.md`: the clash list row UI-053.
- `.factory/plans/88-nextjs-kanon-skeleton.md`: owner decision 2 puts NX-17 directly after U29.
- The vault notes the issue names: Rule Recount, Public Safety Pass, Content Extraction, and the prerequisites note with decisions 1 to 23.
- The review sheet at revision 26, read from a snapshot export: the Layer calls rows for U2, U3, U28, U29, U33, U39, U46, U65 and U72, the Candidates rows NX-16 and NX-17, and the three approved Sources rows on U15 and U23. No Clauses or Conflicts row targets this file.

## Changes

### `kanon/nextjs-kanon/references/ui-a11y-seo.md`

- The frontmatter, title, scope paragraph, severity paragraph and section headings stay as #88 wrote them.
- 70 entries go under the nine section headings, in the order of the table below. The section of each entry is the section its source rule sits in. NX-16 follows U17 and NX-17 follows U29, as the id map orders them.
- The closing `What is NOT a violation` section gets the source file's own list, generalized, plus the per-rule items that question 3 moves there.

Every entry follows these rules:

- **Format.** Title and rule text in one bullet, ending with the keyword. Then `Why`, `Check` (only where the table plans one), `Source` (one line per source) and `From`, in that order.
- **Notes policy.** Drop every Observed, Migrated, Partly migrated, Not migrated and Audit note, every count, every commit hash and every PR number. Keep each Why, with a neutral example.
- **Renames.** Product names, brand fonts, palette token names, product component names and product folder names become generic names or neutral examples. The site name in the title suffix becomes a `<Site name>` placeholder.
- **API text.** Where a rule says "CMS" about text, images or pages that come from the backend (U19, U23, U24, U33), the entry says "the API", as the U33 layer call words it. Rendering CMS HTML stays in the untrusted-content add-on.
- **Guide links.** The source rules link to the source project's own guides (`docs/guides/...`). The template has no such guides, so the links are dropped.
- **Cross-references.** Every reference to another rule uses its pack id from the id map. A core entry does not cite an add-on or overlay entry, because the clause cites the core rule (index.md entry format). This also keeps the add-on grep clean, since it matches `RADIX-` and `CMDK-` ids.
- **Literals.** No colour literal such as `#000` and no eight-character hex word, which the dropped-notes grep would flag.
- **Keywords.** Each entry keeps the source keyword unless a decision sets another. No decision changes the keyword of a source rule, so the PR's keyword table holds only NX-16 (MUST) and NX-17 (SHOULD). U25 and U59 keep their two keywords, worded the way the clash list words DATA-065 ("MUST for ..., SHOULD for ...").

### Clauses left out of the core entries

| Pack id | From | Left out | Where it goes |
|---|---|---|---|
| UI-002, UI-003 | U2, U3 | the class names, values and component lists | the source project's overlay (not copied) |
| UI-004 | U72 | palette tokens, brand font, named sections, the shared body-text scale names | the source project's overlay |
| UI-012 | U65 | the banner and breadcrumb variables and the literal header height | the source project's overlay |
| UI-028 | U53 | the dialog library clause and its return-focus hook | RADIX-003 (#96) |
| UI-032 | U58 | a product-specific timing clause | the source project's overlay |
| UI-041 | U39 | the dialog library, popover and palette clauses, the menu reference, the lazy-chunk clause | RADIX-004 and CMDK-001 (#96); the lazy-chunk clause is a safety-pass generalize |
| UI-055 | U47 | the one-year cache lifetime and the file that sets it | CF-018 (#96) |
| UI-057, UI-062, UI-065 | U15, U19, U22 | the teaser-builder clauses and the card-template clause | dropped, as the issue says; UI-057 and UI-059 point at UI-066 instead |
| UI-066, UI-067 | U28, U29 | the source project's status values, route names and the PR reference | the source project's overlay |

U44, U56, U70 and the Turnstile paragraph of the accessibility section belong to #96. U5 is the source project's overlay rule and is not copied.

## Entries

One row per entry, in file order. "Set by" names the input that fixes the keyword and, for the decided rows, the wording. "Safety-pass fix" names the fix type only. `(Qn)` marks a cell that depends on an open question below; the cell shows the recommended answer.

#### Tailwind and design tokens

| Pack id | From | Keyword in the frontend | Keyword planned (set by) | Safety-pass fix | Sources planned | Check line planned | Cross-references |
|---|---|---|---|---|---|---|---|
| UI-001 | U1 | SHOULD | SHOULD (frontend) | - | - | - | UI-002 |
| UI-002 | U2 (core part) | SHOULD | SHOULD (frontend; wording: Layer calls U2) | - | - | - | - |
| UI-003 | U3 (core part) | SHOULD | SHOULD (frontend; wording: Layer calls U3) | - | - | - | - |
| UI-004 | U72 (core part) | SHOULD | SHOULD (frontend; wording: Layer calls U72) | generalize | - | - | - |
| UI-005 | U31 | MUST | MUST (frontend) | drop flagged Source or note | - | guard-test row UI-005; lint `better-tailwindcss/no-unknown-classes` | - |
| UI-006 | U40 | SHOULD | SHOULD (frontend) | - | Tailwind CSS, styling with utility classes, https://tailwindcss.com/docs/styling-with-utility-classes | - | - |
| UI-007 | U67 | SHOULD | SHOULD (frontend) | drop flagged Source or note | - | - | - |
| UI-008 | U41 | SHOULD | SHOULD (frontend) | - | - | - | - |
| UI-009 | U42 | SHOULD | SHOULD (frontend) | - | - | - | - |
| UI-010 | U43 | SHOULD | SHOULD (frontend) | - | - | - | - |
| UI-011 | U49 | SHOULD | SHOULD (frontend) | - | Web Interface Guidelines, https://github.com/vercel-labs/web-interface-guidelines | - | - |
| UI-012 | U65 (core part) | SHOULD | SHOULD (frontend; wording: Layer calls U65) | - | - | - | - |

#### Responsive design

| Pack id | From | Keyword in the frontend | Keyword planned (set by) | Safety-pass fix | Sources planned | Check line planned | Cross-references |
|---|---|---|---|---|---|---|---|
| UI-013 | U4 | SHOULD | SHOULD (frontend) | - | - | - | - |
| UI-014 | U71 | SHOULD | SHOULD (frontend) | - | - | guard-test row UI-014 | - |
| UI-015 | U32 | MUST | MUST (frontend) | drop flagged Source or note | - | guard-test row UI-015 | UI-023 |
| UI-016 | U33 | SHOULD | SHOULD (frontend; wording: Layer calls U33) | generalize | - | - | - |
| UI-017 | U34 | SHOULD | SHOULD (frontend) | drop flagged Source or note | - | - | - |
| UI-018 | U35 | SHOULD | SHOULD (frontend) | drop flagged Source or note | - | - | - |
| UI-019 | U60 | SHOULD | SHOULD (frontend) | - | WCAG 2.2 SC 2.4.11, https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum | - | - |

#### Accessibility

| Pack id | From | Keyword in the frontend | Keyword planned (set by) | Safety-pass fix | Sources planned | Check line planned | Cross-references |
|---|---|---|---|---|---|---|---|
| UI-020 | U6 | MUST | MUST (frontend) | generalize | - | lint: Oxlint `jsx-a11y` | - |
| UI-021 | U7 | MUST | MUST (frontend) | - | - | lint `jsx-a11y/label-has-associated-control` | - |
| UI-022 | U8 | MUST | MUST (frontend) | - | - | guard-test row UI-022 | - |
| UI-023 | U9 | SHOULD | SHOULD (frontend) | - | - | - | - |
| UI-024 | U10 | MUST | MUST (frontend) | - | - | lint `jsx-a11y/alt-text` | - |
| UI-025 | U11 | SHOULD | SHOULD (frontend) | - | - | - | - |
| UI-026 | U12 | SHOULD | SHOULD (frontend) | - | - | - | DATA-049, DATA-050, DATA-051 |
| UI-027 | U25 | MUST/SHOULD | MUST/SHOULD (frontend) | possible miss: neutral story names, site-name placeholder | - | lint: Oxlint `jsx-a11y` recommended set | UI-020, UI-021, UI-024 |
| UI-028 | U53 (core part) | SHOULD | SHOULD (frontend) | - | - | - | UI-041 |
| UI-029 | U54 | SHOULD | SHOULD (frontend) | - | - | - | UI-035 |
| UI-030 | U55 | SHOULD | SHOULD (frontend) | - | - | - | DATA-017 |
| UI-031 | U57 | MUST | MUST (frontend) | - | - | lint `react/button-has-type` | - |
| UI-032 | U58 (core part) | MUST | MUST (frontend) | - | WCAG 2.2 SC 2.2.1, https://www.w3.org/TR/WCAG22/#timing-adjustable | - | - |
| UI-033 | U59 | MUST/SHOULD | MUST/SHOULD (frontend) | - | - | - | - |
| UI-034 | U61 | SHOULD | SHOULD (frontend) | drop flagged Source or note | - | - | - |
| UI-035 | U62 | SHOULD | SHOULD (frontend) | - | WCAG 2.2 SC 4.1.3, https://www.w3.org/TR/WCAG22/#status-messages | - | UI-029 |
| UI-036 | U64 | SHOULD | SHOULD (frontend) | - | - | - | UI-048 |
| UI-037 | U66 | SHOULD | SHOULD (frontend) | generalize | - | - | - |
| UI-038 | U68 | SHOULD | SHOULD (frontend) | generalize | - | - | - |
| UI-039 | U69 | SHOULD | SHOULD (frontend) | - | - | - | - |

#### Components and primitives

| Pack id | From | Keyword in the frontend | Keyword planned (set by) | Safety-pass fix | Sources planned | Check line planned | Cross-references |
|---|---|---|---|---|---|---|---|
| UI-040 | U38 | SHOULD | SHOULD (frontend) | generalize | - | - | UI-031, UI-007 |
| UI-041 | U39 (core part) | SHOULD | SHOULD (frontend; wording: Layer calls U39) | generalize | - | - | none (the menu and Radix cross-references are dropped) |
| UI-042 | U46 | SHOULD | SHOULD (frontend; wording: Layer calls U46) | - | - | - | - |
| UI-043 | U30 | SHOULD | SHOULD (frontend) | generalize | Next.js `next/font` API, https://nextjs.org/docs/app/api-reference/components/font | - | UI-018 |
| UI-044 | U48 | SHOULD | SHOULD (frontend) | generalize | - | - | - |
| UI-045 | U51 | SHOULD | SHOULD (frontend) | - | Vercel `client-passive-event-listeners`, https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/client-passive-event-listeners.md | - | - |

#### Links and navigation

| Pack id | From | Keyword in the frontend | Keyword planned (set by) | Safety-pass fix | Sources planned | Check line planned | Cross-references |
|---|---|---|---|---|---|---|---|
| UI-046 | U26 | SHOULD | SHOULD (frontend) | generalize | - | - | - |
| UI-047 | U27 | SHOULD | SHOULD (frontend) | generalize | Next.js `Link`, https://nextjs.org/docs/app/api-reference/components/link (Q2) | - | - |
| UI-048 | U36 | SHOULD | SHOULD (frontend) | generalize | - | - | UI-049 |
| UI-049 | U37 | SHOULD | SHOULD (frontend) | generalize | - | - | - |

#### Forms

| Pack id | From | Keyword in the frontend | Keyword planned (set by) | Safety-pass fix | Sources planned | Check line planned | Cross-references |
|---|---|---|---|---|---|---|---|
| UI-050 | U50 | SHOULD | SHOULD (frontend) | - | - | - | - |

#### Images and assets

| Pack id | From | Keyword in the frontend | Keyword planned (set by) | Safety-pass fix | Sources planned | Check line planned | Cross-references |
|---|---|---|---|---|---|---|---|
| UI-051 | U13 | MUST | MUST (frontend) | - | - | lint `@next/next/no-img-element` | DATA-020 |
| UI-052 | U45 | SHOULD | SHOULD (frontend) | - | Next.js `Image`, https://nextjs.org/docs/app/api-reference/components/image (Q2) | - | - |
| UI-053 | U63 | SHOULD | SHOULD (frontend; wording from the clash list) | - | web.dev, optimize LCP, https://web.dev/articles/optimize-lcp; Next.js `Image`, https://nextjs.org/docs/app/api-reference/components/image | - | DATA-020 |
| UI-054 | U52 | SHOULD | SHOULD (frontend) | generalize | Next.js `Image`, https://nextjs.org/docs/app/api-reference/components/image (Q2) | - | - |
| UI-055 | U47 (core part) | MUST | MUST (frontend; wording: decision 3) | - | - | - | - |

#### Page metadata

| Pack id | From | Keyword in the frontend | Keyword planned (set by) | Safety-pass fix | Sources planned | Check line planned | Cross-references |
|---|---|---|---|---|---|---|---|
| UI-056 | U14 | SHOULD | SHOULD (frontend) | - | - | - | - |
| UI-057 | U15 | SHOULD | SHOULD (frontend) | possible miss: site-name placeholder | lesson "SEO in a Decoupled Architecture" (vault, draft) | - | UI-066 |
| UI-058 | U16 | MUST | MUST (frontend) | - | - | - | - |
| UI-059 | U17 | SHOULD | SHOULD (frontend) | - | - | - | UI-066 |
| UI-060 | NX-16 | new rule | MUST (Candidates NX-16) | - | lesson "SEO in a Decoupled Architecture" (vault, draft) | sheet check idea | UI-059, DATA-042 |
| UI-061 | U18 | MUST | MUST (frontend) | - | - | - | - |
| UI-062 | U19 | SHOULD | SHOULD (frontend) | - | - | - | - |
| UI-063 | U20 | SHOULD | SHOULD (frontend) | generalize | - | - | - |
| UI-064 | U21 | MUST | MUST (frontend) | - | - | - | - |
| UI-065 | U22 | SHOULD | SHOULD (frontend) | - | - | - | - |
| UI-066 | U28 (core part) | MUST | MUST (frontend; wording: Layer calls U28) | - | - | - | - |
| UI-067 | U29 (core part) | MUST | MUST (frontend; wording: Layer calls U29) | - | - | - | - |
| UI-068 | NX-17 | new rule | SHOULD (Candidates NX-17) | - | lesson "SEO in a Decoupled Architecture" (vault, draft) | sheet check idea | DATA-002, DATA-071, DATA-053 (Q4) |

#### Structured data

| Pack id | From | Keyword in the frontend | Keyword planned (set by) | Safety-pass fix | Sources planned | Check line planned | Cross-references |
|---|---|---|---|---|---|---|---|
| UI-069 | U23 | SHOULD | SHOULD (frontend) | - | Next.js JSON-LD guide, https://nextjs.org/docs/app/guides/json-ld; lesson "SEO in a Decoupled Architecture" (vault, draft); insight "The Injection Bugs Your Blade Templates Are Hiding" (vault, draft) | - | - |
| UI-070 | U24 | SHOULD | SHOULD (frontend) | - | - | - | UI-069 |

Counts: 70 rows (58 whole rules, 10 core parts, 2 new rules), matching the id map and the issue's scope table. 23 rows carry a safety-pass fix: 15 generalize, 6 drop flagged Source or note, 2 possible misses. 4 rows carry a guard-test row. 18 Source lines are planned: 3 from the Sources tab (U15, and U23 twice), 2 for the new rules (both vault drafts), and 13 public docs on 12 rules that the source rules already cite, each given its URL.

### Test files dropped from the entries (listed in the PR for stage 2)

- `importantUtility.test.ts` (U67), `headerOffset.test.ts` (U65), `globalsReducedMotion.test.ts` (U11).
- `Toast.test.tsx` (U58), `textContrast.test.ts` (U59), the password-reset form's autofill test (U50).
- `contentImageSizes.test.ts` (U45), `nextConfigHeaders.test.ts` (U52).
- `pageMetadataLengths.test.ts` (U16), `staticPageOgImages.test.ts` (U21).
- The guard-test check on the teaser builder and the teaser builder's unit test (U28).
- `sitemap.test.ts`, `llmsTxt.test.ts`, `feed.test.ts` (U29).
- `JsonLd.test.tsx` (U23).

### Names the entries use that the names table does not list (question 1)

`app/globals.css` and its `@theme` block, `src/constants/zIndex.ts`, `src/constants/layout.ts` with its page container constant, the `--header-h` variable, the focus-ring and hit-area class constants beside the `Button` primitive, `src/lib/usePrefersReducedMotion.ts`, the `ErrorState`, `Toast`, `Spinner`, `Skeleton`, `Badge` and `EmptyState` primitives, `src/lib/openExternal.ts`, the hover-prefetch link component in `src/features/global-ui/`, the content image `sizes` helper, `public/assets/`, `public/images/` and `public/icons/`, the builder names in `src/lib/metadata.ts`, the content-type description and card tables, the static card folder and its manifest, and the inline head script component.

## Readings of the issue

These follow from the issue and the inputs. The PR lists them so the owner can change any of them.

- **Check lines.** The stub #88 merged says "A `Check:` line names the guard-test row or lint rule that enforces a rule, where one exists", and the entry format in `index.md` allows "the sheet's check idea". So besides the four guard-test rows (UI-005, UI-014, UI-015, UI-022), an entry gets a `Check:` line for a lint rule its source rule names (jsx-a11y on UI-020, UI-021, UI-024 and UI-027, `better-tailwindcss/no-unknown-classes` on UI-005, `react/button-has-type` on UI-031, `@next/next/no-img-element` on UI-051), named by rule and not by config file, since #95 has not settled the config file. NX-16 and NX-17 get the sheet's check idea.
- **Sections.** Each entry sits under the section of its source rule. The id map's numbering already follows that order.
- **Public doc sources.** The notes policy keeps a Source line that cites a public doc. Twelve source rules cite one without a URL: U23, U30, U40, U49, U51, U58, U60, U62 and U63, plus U27, U45 and U52 (question 2). Each Source line gets the doc's URL, and each quote was checked word for word on the live page on 2026-11-25. U49's quote becomes the page's own wording ("Never `transition: all`."). U30 keeps only its Next.js font quote. The safety pass drops the rest of that Source line.
- **Draft sources.** The lesson "SEO in a Decoupled Architecture" and the insight "The Injection Bugs Your Blade Templates Are Hiding" are drafts: the frontmatter of each vault file says draft, and the insight's own slug on https://codyssey.dev/insights/ answers 404. U15, U23, NX-16 and NX-17 cite them as `vault: Content/<path>.md`.
- **U17.** Its sentence on teasers points at UI-066 instead of the source helper name. The C5 lesson contradiction (a robots `Disallow` over pages that also carry noindex) stays a source-project fix, per decisions 17 and 21. UI-059 and UI-060 do not change because of it.
- **NX-16.** The text is the sheet row as written, with the keyword moved to the end of the entry. The one production flag is read through the env module, so the entry cites DATA-042.
- **U63.** The text follows the clash list row. The keyword stays SHOULD, since the clash list sets the wording only.
- **U47.** The core Why is host-neutral: the folder may be served with a long immutable cache lifetime. The lifetime itself is CF-018.
- **U72.** The "dark page" condition stays, because the decision words it that way ("no pure white on a dark page").
- **Rule Recount and the id map.** The recount marks U15, U19 and U22 as split rows. The id map and the issue make them whole core rules with their clauses for the source project's overlay dropped, so their `From:` is the bare id.

## Prototype

Run in a scratch folder outside the repo, not committed.

- Eight draft entries in the entry format: UI-002, UI-004, UI-047, UI-053, UI-055, UI-066, UI-067 and UI-068. Each uses the recommended answer to the open questions and the readings above. The issue's five greps print nothing on them. A negative control, an entry that cites `RADIX-001` and writes `#000`, was flagged by the add-on grep and the dropped-notes grep.
- The `From:` checker (below) against the committed stub: exit 1, "entry ids or order differ from the id map", because there are 0 entries. Against a 70-entry file generated from the id map: exit 0. With one `From:` changed and one entry given a second `From:` line: exit 1, naming both.
- The id map's 70 UI rows equal the issue's scope table (58 core ids, 10 core parts, NX-16, NX-17). No count disagrees.
- The quotes for U27, U30, U40, U45, U49, U51, U52, U58, U60, U62, U63 and U23 were found on the live pages. `next/image` says `priority` is deprecated "Starting with Next.js 16" and to "Use preload for a known Largest Contentful Paint (LCP) image", which supports the clash list wording of UI-053.

## Verification

From the worktree root at the head commit, clean tree:

1. The issue's acceptance commands, with their output:
   ```sh
   grep -cE '^- \*\*UI-[0-9]{3}\.' kanon/nextjs-kanon/references/ui-a11y-seo.md
   grep -niE 'codyssey' kanon/nextjs-kanon/references/ui-a11y-seo.md | grep -vE 'https://codyssey\.dev/|vault: Content/'
   grep -niE 'radix|cmdk|heroicons|_headers|opennext|sanitiz' kanon/nextjs-kanon/references/ui-a11y-seo.md
   grep -nE 'Not migrated|Migrated:|Observed:|Audit(ed)?:|PR #[0-9]+|#[0-9]{3,4}\b|\b[0-9a-f]{8,40}\b' kanon/nextjs-kanon/references/ui-a11y-seo.md
   grep -nE '^\s*- Source:' kanon/nextjs-kanon/references/ui-a11y-seo.md | grep -vE 'https://|vault: Content/'
   ```
   The first prints 70, the others print nothing.
2. The `From:` checker, a stdlib Python script run outside the repo, as plan 88 ran its count script. It reads the UI rows of the id map, the scope table of the issue body and the rule file. It fails when an entry has other than one `From:` line, when the entry ids or their order differ from the id map, when a `From:` value differs from its id map row, or when the id map and the issue's scope table disagree. Its source and output go in the PR body.
3. The U63 check: UI-053's text contains `priority`, `preload` and `fetchPriority="high"` in the clash list's reading.
4. The Check-line check: `grep -nE '^\s*- Check:.*UI-0(05|14|15|22)'` finds the four guard-test rows on UI-005, UI-014, UI-015 and UI-022.
5. A rescan by the safety pass's pattern families: billing and plan words, hostnames, hashes, PR and issue references, product names, incident words, ISO dates, environment assignments, error-tracker ids, money, and brand font and palette names. Every hit is read by hand. File names and public doc hosts are expected. The PR lists the hits and why each stays.
6. The PR's fix table holds the 23 safety-pass ids: U6, U20, U26, U27, U30, U33, U36, U37, U38, U39, U48, U52, U66, U68, U72 (generalize), U31, U32, U34, U35, U61, U67 (drop flagged Source or note), U15, U25 (possible misses).
7. Every check in `.factory/recipe.yml`. `kanon/scripts/catalog.mjs` reads only `kanon/catalog/`, so the rule file does not reach it. Baseline at 339f740, node v26.13.0, Python 3.15.2, all exit 0:

| Gate | Result at base |
|---|---|
| pick-up-tests | 108 pass |
| post-merge-tests | 23 pass |
| capture-ui-tests | 115 pass |
| trial-decision-tests | 39 pass |
| test-first-tests | 36 pass |
| bootstrap-tests | 3 OK |
| event-model-tests | 4 OK |
| factory-onboard-tests | 28 OK |
| standards-discovery-tests | 54 OK |
| install-tests | 29 pass |
| kanon-catalog-check | "catalog ok: 6 family file(s), 135 entries" |
| kanon-catalog-tests | 36 pass |

## Out of scope

- Every other rule file, `index.md`, `SKILL.md`, the add-on files and the overlay (#89, #90, #91, #93, #94, #95, #96), and the audit (#97).
- The add-on rules U44, U56 and U70, the add-on clauses of U39 and U53, and the Cloudflare clause of U47 (#96). The source project's overlay rule U5.
- The template repository, its guard test and its lint config (stage 2), and `bootstrap --frontend nextjs` (stage 3).
- Any change to `codysseydev/codyssey-frontend`, including the C5 lesson fix.

## Decisions

The owner approved this plan in an interactive session on 2026-11-25 and accepted the recommended answer to each question below (option A each time):

1. Names: the entries write concrete file and helper names, and the PR lists them under "Names for the index.md follow-up". `index.md` is not edited.
2. U27, U45 and U52 cite the Next.js docs pages (`Link`, `Image`) instead of the retired skill.
3. The "not a violation" notes of U27, U28, U30, U31 and U58 move, generalized, into the closing `What is NOT a violation` section, each with its pack id.
4. UI-068 (NX-17) cites DATA-053 for reporting.

Owner decisions for every rule issue (2026-11-25):

- Rules cite concrete generic file and helper names even when the names table lacks them. The PR lists every name introduced.
- Every entry gets a neutral one-line `Why:`. The PR lists every Why written fresh (no reason in the source rule or the sheet).
- A Source line is `- Source: <title> <URL>` or `- Source: <title> vault: Content/<path>.md`, with no quote. A lesson's point goes into the Why. A source that cites the retired `next-best-practices` skill is replaced by the matching nextjs.org docs page.
- A source is live only if its codyssey.dev page title is not "Coming <date>". Not live means the vault path, checked at write time.
- S28 cases a and h belong to the untrusted-content add-on (#96).
- The issue's acceptance greps decide what counts as a Codyssey name; `vault: Content/` paths may carry the course name.
- Other rules are cited by pack id from the id map only.
- NX-16 is MUST and NX-17 is SHOULD. UI-053 (U63) is narrowed as the SKILL.md clash list says.

The questions as asked, with the recommended option first:

1. Entries need template file and symbol names that the names table in `index.md` does not list, while the issue says #92 touches no other file. Which way?
   - **A. Write the names in the entries, list them in the PR, and add them to the names table in one follow-up after #89 to #96 merge (recommended).** The entries stay concrete, the way the Laravel Kanon names its files, and the parallel issues do not edit `index.md` at the same time.
   - B. Add the rows to the names table in this PR. This goes against the one-file scope and races the other rule issues on `index.md`.
   - C. Describe each by its role ("one helper in `src/lib/`") and name only files the table lists and the Next.js and Tailwind conventions. The template keeps its freedom, and the entries lose their precision.
2. U27, U45 and U52 quote `next-best-practices`, a retired skill with no license (Vendored Skill Licenses note, decision 13). What do their Source lines cite?
   - **A. The Next.js docs page that says the same thing, with its own quote: the `Link` component for U27, and the `Image` component for U45 (`sizes` with `fill`) and U52 (`remotePatterns`) (recommended).** The pack already cites these pages for UI-053.
   - B. Drop the three Source lines. The rules stand on their Why.
   - C. Cite the retired skill at its last commit. The URL holds a commit hash, which the dropped-notes grep flags, so the PR would have to explain it.
3. Five source rules carry their own "not a violation" notes (U27, U28, U30, U31, U58), and the entry format has no line for them. Where do they go?
   - **A. Into the file's closing `What is NOT a violation` section, generalized, each naming its pack id. Notes that only name source-project files are dropped (recommended).** The stub already has the section, and the Laravel Kanon files use it the same way.
   - B. Keep them as a sub-bullet under their entry, outside the entry format.
   - C. Drop them, and fill the closing section with the source file's own list only.
4. NX-17's decision says each failed list "is reported". The core rule on reporting, D42 (DATA-053), sends an error the UI absorbs to D39, which is the Sentry add-on (SENTRY-001). What does UI-068 name as the reporting path?
   - **A. Cite DATA-053, so the entry follows whatever DATA-053 settles for apps without the Sentry add-on (recommended).**
   - B. Cite DATA-053, and SENTRY-001 for apps with the Sentry add-on.
   - C. Keep the decision's words and name no rule.
