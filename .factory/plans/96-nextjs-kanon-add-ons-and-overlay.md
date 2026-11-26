# Plan for #96, nextjs-kanon: add-on rules and the Cloudflare overlay

Issue codysseydev/codyssey-skills#96. Base origin/main 339f740. Branch `factory/96`. Kind: feature.

## Goal

Fill the ten add-on files under `kanon/nextjs-kanon/references/add-ons/` (40 entries) and the Cloudflare overlay `kanon/nextjs-kanon/references/overlays/cloudflare.md` (24 entries, or 23 if the A11 clause slot stays unused). Each entry takes the pack id from the id map in `references/index.md`, follows its entry format, carries the safety-pass fix of its source row, and keeps the notes and source policies. No file outside those two folders changes.

## How an entry is written

- Entry format of `index.md`: bold id and title, rule text, keyword, then `Why:`, `Check:`, `Source:`, `From:` and, in the overlay, `Tags:`.
- A clause entry states what it adds to the core rule and cites that rule by pack id. Its `From:` is the exact id-map value, for example `D27 (axios clause)` or `S28 (untrusted-content clause)`.
- An example-only clause is one line: the bold id, title and rule line, then `From:` (and `Tags:` in the overlay). No `Why:`, `Check:` or `Source:`.
- Keyword: the source keyword carries over. A clause keeps the keyword of the source sentence it came from, or the parent rule's keyword when that sentence has none.
- Notes policy: drop every Observed, Not migrated, Audit, Migrated and incident note, every commit hash and every PR number. Keep each Why with a neutral example. A source that is a code comment in the source project is not a public doc, so its reason becomes the `Why:` line and no `Source:` line is written (D35, D36, D37, D39, D40, I1, I5, I6, I7).
- Names: only names from the "Names rules may cite" table of `index.md`, tool conventions (`next.config`, `wrangler.jsonc`, `open-next.config.ts`, `public/_headers`) and package names. Everything else is described by its role (Q6).
- Public text: no hostnames, header values, URL parameter names or env variable names of the source project.

## Tag test

The issue gives the test. `OpenNext` marks what an overlay for another adapter on Workers (vinext) would replace. `Workers` marks what such an overlay would keep. CF-007 (I9) and CF-008 (I10 core part) carry no `Tags:` line (owner decision 2026-11-24, recorded in `index.md`). The test settles 16 of the 22 tagged entries. Q2, Q3 and Q4 ask about five of the others, and Q1 decides whether CF-020 is written at all.

## Add-on entries (40)

Columns: source keyword (src), planned keyword and what sets it (plan), safety-pass fix type, sources, `Check:` line, and the rule the entry cites. "none" in the fix column means the source row has no safety-pass flag; the notes policy still applies.

### `add-ons/untrusted-content.md` (10)

| pack id | From | src | plan | safety fix | sources | Check | cites |
|---|---|---|---|---|---|---|---|
| UNTRUSTED-001 | D34 | MUST | MUST, source | generalize | approved D34 row (draft insight, vault path) | | UNTRUSTED-005; `src/lib/JsonLd.tsx` as an allowed literal site |
| UNTRUSTED-002 | D35 | MUST | MUST, source | none | | | |
| UNTRUSTED-003 | D36 | MUST | MUST, source | none | | | |
| UNTRUSTED-004 | D37 | MUST | MUST, source | none | | untrusted-content sanitizer tests | |
| UNTRUSTED-005 | D75 | MUST | MUST, source | none | OWASP ASVS 5.0 requirement 3.2.3 (public, checked) | untrusted-content sanitizer tests | |
| UNTRUSTED-006 | U56 | SHOULD | SHOULD, source | generalize: the site's own hosts come from one constant, no host named | | | ACCESS-003, UI-046 |
| UNTRUSTED-007 | S28 (untrusted-content clause) | SHOULD | SHOULD, source | move to the source project's overlay (clause j), drop notes | | | STRUCT-028 (content: Q7) |
| UNTRUSTED-008 | D18 (untrusted-content clause) | MUST | MUST, source | none | | | DATA-020 |
| UNTRUSTED-009 | T35 (untrusted-content clause) | SHOULD | SHOULD, source | generalize: neutral example; the brand clause comes here | | | TYPES-010 |
| UNTRUSTED-010 | A8 (untrusted-content clause) | SHOULD | SHOULD, source | move to the source project's overlay; the sanitizer clause becomes "the sanitizer uses the same scheme list" | | | ACCESS-003 |

### `add-ons/syntax-highlighting.md` (2)

| pack id | From | src | plan | safety fix | sources | Check | cites |
|---|---|---|---|---|---|---|---|
| SYNTAX-001 | D17 | MUST | MUST, source (decision 6) | none | | | SYNTAX-002 |
| SYNTAX-002 | D16 (syntax-highlighting clause) | MUST | MUST, source; example-only (Q9) | generalize: the layout-shift reason without the production figure | | | DATA-019 |

### `add-ons/sentry.md` (10)

| pack id | From | src | plan | safety fix | sources | Check | cites |
|---|---|---|---|---|---|---|---|
| SENTRY-001 | D39 | SHOULD | SHOULD, source | generalize: drop the Observed paragraph; the code-comment quote becomes the Why | | | SENTRY-004, DATA-032 |
| SENTRY-002 | D40 | SHOULD | SHOULD, source | none | three approved D40 rows: two live lesson URLs, one scheduled quick tip (vault path); the rejected row is skipped | | SENTRY-001 |
| SENTRY-003 | D19 (Sentry clause) | SHOULD | SHOULD, source; example-only (Q9) | none | | | DATA-021 |
| SENTRY-004 | D69 (Sentry clause) | SHOULD | SHOULD, source | generalize: drop the Source and Audit notes | | | DATA-032 |
| SENTRY-005 | D30 (Sentry clause) | MUST | MUST, source | none | | | DATA-042 |
| SENTRY-006 | D41 (Sentry clause) | SHOULD | SHOULD, source | none | Sentry Next.js manual setup guide (public URL; quote to recheck) | | DATA-052 |
| SENTRY-007 | A9 (Sentry clause) | SHOULD | SHOULD, source | drop; parameters named by role only | | | ACCESS-004 |
| SENTRY-008 | A10 (Sentry clause) | MUST (sub-bullet) | MUST, source sub-bullet | move to the source project's overlay; one entry per vendor | | | ACCESS-011 |
| SENTRY-009 | A14 (Sentry clause) | MUST | MUST, source (decision 8) | generalize: no sampling rate | | Sentry consent guard | ACCESS-015 |
| SENTRY-010 | C6 (Sentry clause) | SHOULD | SHOULD, source (decision 22 places it) | none | | | TOOLING-006 |

### `add-ons/turnstile.md` (5)

| pack id | From | src | plan | safety fix | sources | Check | cites |
|---|---|---|---|---|---|---|---|
| TURNSTILE-001 | D47 | SHOULD | SHOULD, source | generalize: the token field named by role; the component and its loader named by file (owner decision 1 of 2026-11-25) | | | TURNSTILE-004 |
| TURNSTILE-002 | D48 | SHOULD; MUST on a condition | Q8 | generalize: the named forms become every form that renders the widget; `Captcha` named per owner decision 1 | Cloudflare Turnstile server-side validation doc (public URL; no quote) | | TURNSTILE-001 |
| TURNSTILE-003 | D16 (Turnstile clause) | MUST | MUST, source; example-only (recount) | generalize, as D16 | | | DATA-019 |
| TURNSTILE-004 | D30 (Turnstile clause) | MUST | MUST, source; example-only (Q9) | none | | | DATA-042 |
| TURNSTILE-005 | A10 (Turnstile clause) | none in its sentence | SHOULD, parent A10 | move to the source project's overlay: no origin named | | | ACCESS-011 |

### `add-ons/plausible.md` (3)

| pack id | From | src | plan | safety fix | sources | Check | cites |
|---|---|---|---|---|---|---|---|
| PLAUSIBLE-001 | D50 | SHOULD | SHOULD, source | generalize: neutral event names such as `Button Click`; drop the Observed note | approved D50 row (scheduled quick tip, vault path) | | DATA-052 |
| PLAUSIBLE-002 | D41 (Plausible clause) | SHOULD | SHOULD, source | none | | | DATA-052, PLAUSIBLE-001 |
| PLAUSIBLE-003 | A10 (Plausible clause) | none in its sentence | SHOULD, parent A10 | move to the source project's overlay: no origin named | | | ACCESS-011 |

### `add-ons/radix.md` (4)

| pack id | From | src | plan | safety fix | sources | Check | cites |
|---|---|---|---|---|---|---|---|
| RADIX-001 | U70 | SHOULD | SHOULD, source | none | | | RADIX-004 |
| RADIX-002 | D16 (Radix clause) | MUST | MUST, source | generalize, as D16; the chunk-failure dialog named by role | | | DATA-019 |
| RADIX-003 | U53 (Radix clause) | SHOULD | SHOULD, source | none; the return-focus hook named by role | | | UI-028 |
| RADIX-004 | U39 (Radix clause) | SHOULD | SHOULD, source (Layer calls U39) | generalize: drop the commit and the chunk-failure clause | | | UI-041 |

### `add-ons/heroicons.md` (2)

| pack id | From | src | plan | safety fix | sources | Check | cites |
|---|---|---|---|---|---|---|---|
| HEROICONS-001 | U44 | SHOULD | SHOULD, source | none; drop the Not migrated note | | | HEROICONS-002 |
| HEROICONS-002 | S23 (Heroicons clause) | SHOULD | SHOULD, source | none | | | STRUCT-008 |

U44 repeats the S23 clause (a custom icon only where Heroicons has none). HEROICONS-002 holds that sentence and HEROICONS-001 cites it, so the pack says it once.

### `add-ons/axios.md` (2)

| pack id | From | src | plan | safety fix | sources | Check | cites |
|---|---|---|---|---|---|---|---|
| AXIOS-001 | D27 (axios clause) | SHOULD | SHOULD, source | generalize: drop the migration paragraph | | | DATA-039 |
| AXIOS-002 | D71 (axios clause) | SHOULD | SHOULD, source | generalize: drop the Not migrated list | | | DATA-047 |

### `add-ons/cmdk.md` (1)

| pack id | From | src | plan | safety fix | sources | Check | cites |
|---|---|---|---|---|---|---|---|
| CMDK-001 | U39 (cmdk clause) | SHOULD | SHOULD, source (decision 6) | generalize, as U39 | | | UI-041, and RADIX-004 when the Radix add-on loads |

### `add-ons/mutation-testing.md` (1)

| pack id | From | src | plan | safety fix | sources | Check | cites |
|---|---|---|---|---|---|---|---|
| MUTATION-001 | NX-15 | new | MAY (Candidates tab NX-15) | n/a | the Mutation Testing lesson and the 7 PHP tools insight (live URLs); the draft insight on green tests (vault path) | Q11 | TYPES-035 (a test with new logic) |

## Overlay entries (24)

| pack id | From | src | plan | safety fix | Tag and reason | sources | Check | cites |
|---|---|---|---|---|---|---|---|---|
| CF-001 | I1 | MUST | MUST, source | generalize: drop the migration history; the code comment becomes the Why | Workers: no version URLs for a Worker with a Durable Object is a platform fact | | Durable Object check | |
| CF-002 | I3 | SHOULD | SHOULD, source | none | Workers: `wrangler.jsonc` env blocks and migrations | | | |
| CF-003 | I4 | SHOULD | SHOULD, source | generalize: drop the Observed note and the test file name | Q2 | | | |
| CF-004 | I5 | SHOULD | SHOULD, source | generalize: drop the PR source; the reason comes from the source config comment (skew protection fetches an older version on the same account) | Workers: a Workers compatibility flag | | | |
| CF-005 | I6 | SHOULD | SHOULD, source (decision 4) | generalize: a named entrypoint on the binding breaks the deploy and the skew mapping; no route named | Q2; props wording Q5 | | | |
| CF-006 | I7 | SHOULD | SHOULD, source | generalize: drop the commit; the config comment's reason becomes the Why (a stale prerendered page never regenerates) | OpenNext: OpenNext's queue override | | | |
| CF-007 | I9 | SHOULD | SHOULD, source | generalize: drop the PR; keep "immutable headers in dev served stale chunks" as the Why | none (owner decision) | | | |
| CF-008 | I10 (core part) | MUST | MUST, source | generalize: drop the baseline figures; the emergency skip sentence per Q10 | none (owner decision) | | size budget | |
| CF-009 | I11 | SHOULD | SHOULD, source | generalize: drop the Not migrated note; "a CI job" | OpenNext: an OpenNext build before merge | | | |
| CF-010 | S11 (Cloudflare clause) | SHOULD | SHOULD, source | none | OpenNext: the Worker entry and `open-next.config.ts` load modules outside the Next bundler | | | STRUCT-013 |
| CF-011 | D1 (Cloudflare clause) | MUST | MUST, source (Layer calls D1) | none | Q3 | | | DATA-001 |
| CF-012 | D8 (Cloudflare clause) | MUST | MUST, source (decision 1) | none | OpenNext: the `s-maxage` OpenNext computes | | | DATA-008 |
| CF-013 | D27 (Cloudflare clause) | SHOULD | SHOULD, source | generalize: "a same-origin edge endpoint" | Workers: an endpoint the Worker serves itself | | | DATA-039 |
| CF-014 | D30 (Cloudflare clause) | MUST | MUST, source | none | OpenNext: OpenNext fills `process.env` per request | | | DATA-042 |
| CF-015 | D57 (Cloudflare clause) | MUST | MUST, source (decision 2) | generalize: drop the Observed note | Workers: the edge cache is on in the Workers config | | | DATA-064 |
| CF-016 | T34 (Cloudflare clause) | SHOULD | SHOULD, source | generalize: drop the Observed note and the source example | Q3 | | | TYPES-009 |
| CF-017 | T31 (Cloudflare clause) | MUST | MUST, source | move to the source project's overlay (the shared-vectors clause); the skew-mapping clause comes here | OpenNext: skew protection in the OpenNext config | | skew-mapping sync check | TYPES-032 |
| CF-018 | U47 (Cloudflare clause) | MUST | MUST, source (decision 3) | none | Workers: `public/_headers` is a Workers static assets file | | | UI-055 |
| CF-019 | A10 (Cloudflare clause) | MUST (sub-bullet) | MUST, source sub-bullet | move to the source project's overlay | Workers: an edge setting another adapter on Workers keeps | | | ACCESS-011 |
| CF-020 | A11 (Cloudflare clause) | SHOULD | Q1 | generalize | Q1 | | | ACCESS-012 |
| CF-021 | C4 (Cloudflare clause) | SHOULD | SHOULD, source | possible miss: "skip hook install in the deploy build", no variable named | Workers: Workers Builds settings | | | TOOLING-004 |
| CF-022 | C7 (Cloudflare clause) | SHOULD | SHOULD, source | none | Q4 | | | TOOLING-007, CF-003 |
| CF-023 | I2 (Cloudflare clause) | SHOULD | SHOULD, source (Layer calls I2) | move to the source project's overlay; the deploy-script rule stays | OpenNext: the skew mapping of OpenNext skew protection | approved I2 row (draft lesson, vault path) | skew-mapping sync check | CF-017 |
| CF-024 | I10 (Cloudflare clause) | MUST | MUST, source | generalize: drop the baseline figures | Workers: the Workers script size limit | | size budget | CF-008 |

## Example-only clauses

One-line entries: TURNSTILE-003 (the recount marks it "illustration only"). Proposed in Q9: SYNTAX-002, TURNSTILE-004 and SENTRY-003. The PR lists the final set.

## Safety-pass fix table for the PR

Every safety-pass row of an in-scope id, mapped to its entries. Ids with no flag are not listed.

| source id | fix type | entries |
|---|---|---|
| D34 | generalize | UNTRUSTED-001 |
| U56 | generalize | UNTRUSTED-006 |
| S28 | move to the source project's overlay | UNTRUSTED-007 |
| T35 | generalize | UNTRUSTED-009 |
| A8 | move to the source project's overlay | UNTRUSTED-010 |
| D16 | generalize | SYNTAX-002, TURNSTILE-003, RADIX-002 |
| D39 | generalize | SENTRY-001 |
| D69 | generalize | SENTRY-004 |
| A9 | drop | SENTRY-007 |
| A10 | move to the source project's overlay | SENTRY-008, TURNSTILE-005, PLAUSIBLE-003, CF-019 |
| A14 | generalize | SENTRY-009 |
| D47 | generalize | TURNSTILE-001 |
| D48 | generalize | TURNSTILE-002 |
| D50 | generalize | PLAUSIBLE-001 |
| U39 | generalize | RADIX-004, CMDK-001 |
| D27 | generalize | AXIOS-001, CF-013 |
| D71 | generalize | AXIOS-002 |
| I1, I4, I5, I6, I7, I9, I11 | generalize | CF-001, CF-003, CF-004, CF-005, CF-006, CF-007, CF-009 |
| I10 | generalize | CF-008, CF-024 |
| D57 | generalize | CF-015 |
| T34 | generalize | CF-016 |
| T31 | move to the source project's overlay | CF-017 |
| A11 | generalize | CF-020, or the reserved slot (Q1) |
| C4 | possible miss | CF-021 |
| I2 | move to the source project's overlay | CF-023 |

## The A11 clause (CF-020)

A11's Cloudflare clause names an example route. Once that example moves out, nothing host-specific remains: what is left is a case of ACCESS-012, not a rule of its own. See Q1.

## Prototype

Drafts of ten entries in the entry format, kept outside the repo: I9, the I10 core part, the A11 clause, TURNSTILE-003, NX-15, the A14 Sentry clause, I5, I6, D34 and the A9 Sentry clause. They test the one-line format, the untagged overlay entries, the A11 finding, and how far a clause can generalize before it stops saying anything.

## Verification

From the worktree root at the head commit, clean tree:

- The issue's acceptance commands, with their output: the per-file `grep -cE '^- \*\*[A-Z]+-[0-9]{3}\.'` counts (40 in `add-ons/`, 24 or 23 in the overlay), the brand-name grep, the dropped-notes grep, the Source-line grep, and `git diff --name-only origin/main...HEAD` showing only files under `references/add-ons/` and `references/overlays/`, plus this plan.
- The tags check exempts both CF-007 and CF-008, as `index.md` records, not only I9 as the acceptance line says.
- A From script, run outside the repo, with its source and output in the PR body. It checks that the id map's base ids per file equal the issue's scope tables, that each file's entries equal the id map in order, that each entry has exactly one `From:` line equal to its map row (exact labels, including lowercase `(axios clause)` and `(untrusted-content clause)`), that every overlay entry but CF-007 and CF-008 has exactly one `Tags:` line of `OpenNext` or `Workers`, and that add-on entries have none. A flag expects CF-020 absent if Q1 leaves the slot unused. On the stubs it reports 0 entries per file; on a generated fixture of all 64 rows it prints OK.
- A scan of the written files for hostnames, em dashes and the banned words of the voice rules.
- Every check in `.factory/recipe.yml`.

## Out of scope

- The core rule files (#89 to #95) and the audit (#97).
- `references/index.md` and `SKILL.md`, including the names table (Q6).
- A second deploy overlay, the template repository, its guard test and `wrangler.jsonc`, and `bootstrap --frontend nextjs`.
- Any change to `codysseydev/codyssey-frontend`.

## Inputs that disagree

- `index.md` says a rule that needs a new name adds it to the names table. The issue's acceptance says no file outside `add-ons/` and `overlays/` changes. See Q6.
- The rewording table proposes `Workers` for I4 and I6. I4's rule names OpenNext's context API, and the recount calls I6's binding OpenNext's. See Q2.
- The acceptance line on tags exempts only I9. The owner decision of 2026-11-24 in `index.md` exempts I9 and the I10 core part. This plan follows `index.md`.
- The chunk-failure dialog clause appears twice in the source. The recount sends the D16 copy to the Radix add-on and the U39 copy to the source project's overlay, and the safety pass drops the U39 copy. This plan writes it once, in RADIX-002.
- The safety-pass fixes for D39 ("keep the Source quote") and I7 ("keep the config comment as the source") keep sources that the policy column drops, because they are code comments. This plan keeps their content as the `Why:` line and writes no `Source:` line.
- The safety pass says the owner must supply I5's reason. The source config comment gives it, so this plan writes that reason.
- The vault frontmatter marks the D40 and D50 quick tips as published, but their pages on https://codyssey.dev/ show a coming-soon teaser. Under the source policy they are not live, so they cite vault paths.
- The public-doc quotes on D41 (Sentry guide) and D48 (Turnstile doc) were not found word for word by a text search of the pages, which load and cover the topic. The writer rechecks each quote and cites the URL without a quote if it is gone.

## Open questions

Each needs the owner's answer before the entries it names are written. The first option is the recommendation.

- **Q1. A11 clause (CF-020).** After the route path moves out, nothing host-specific remains. Options: (a) leave the slot unused and reserved, so the overlay has 23 entries; (b) write a one-line example entry, tagged `OpenNext`, naming an edge route handler as a case ACCESS-012 covers.
- **Q2. Tags of I4 (CF-003) and I6 (CF-005).** Both rules name an OpenNext API or binding that another adapter would replace. Options: (a) `OpenNext` for both; (b) `Workers` for both, as the rewording table proposes; (c) `Workers` for I4, whose module-per-concern half holds on any Worker, and `OpenNext` for I6.
- **Q3. Tags of the D1 clause (CF-011) and the T34 clause (CF-016).** Each names both the OpenNext cache and the Workers edge cache. Options: (a) `OpenNext`, since another adapter must restate which caches apply; (b) `Workers`.
- **Q4. Tag of the C7 clause (CF-022).** It says the Worker entry stays thin JavaScript and that the Workers Builds commands name the deploy script. Options: (a) `Workers`; (b) `OpenNext`, since the entry wraps OpenNext's worker.
- **Q5. The props half of I6 (CF-005).** The source config gives the binding a props value so that revalidation requests get their own Workers Cache key, and OpenNext does not read it. Options: (a) generalize to "carries a props value so revalidation requests get their own cache key", with no key or value named; (b) keep the source's key name, without the value; (c) drop the half and keep only "no named entrypoint".
- **Q6. File names outside the names table** (the analytics module, the sanitizer and its lazy loader, the link predicate, the site hosts constant, the deploy script, the Turnstile loader component). Options: (a) describe each by its role and add no name; (b) add the names to the `index.md` table in this PR, an exception to the "no other file" criterion; (c) write the paths in the rules without a table row.
- **Q7. Content of the S28 untrusted-content clause (UNTRUSTED-007).** The recount sends clause h (pages whose body is CMS HTML share one page feature keyed by slug) here, and says clause a (one tag-strip and one entity-decode helper) fits if the pack keeps it. Options: (a) clause h only, leaving clause a to the core part; (b) clauses a and h; (c) clause a only.
- **Q8. Keyword of D48 (TURNSTILE-002).** Options: (a) MUST; (b) SHOULD.
- **Q9. Example-only clauses beyond TURNSTILE-003.** SYNTAX-002 restates SYNTAX-001's lazy loading, TURNSTILE-004 restates TURNSTILE-001's env read, and SENTRY-003 names the report SENTRY-001 already requires. Options: (a) write all three as one-line entries; (b) write them as full clause entries.
- **Q10. The emergency skip of the size budget (CF-008).** The safety fix drops it only if the template does not ship a skip, and stage 2 decides the template. Options: (a) drop it now, and stage 2 adds a sentence if it ships a skip; (b) keep a neutral sentence that any skip switch is for emergencies only.
- **Q11. A `Check:` line on NX-15 (MUTATION-001).** The entry format allows the sheet's check idea, while the issue keeps `Check:` lines only for checks `index.md` lists, and NX-15 has none there. Options: (a) no `Check:` line, since the rule is MAY and no check ships; (b) a `Check:` line with the sheet's check idea (a Stryker config, a scheduled or diff-scoped CI job, and a break threshold just below the current score).

## Decisions (owner, 2026-11-25)

The owner approved this plan in an interactive session on 2026-11-25 and accepted every recommended answer.

- Q1 (a): CF-020 stays reserved and unused. The overlay holds 23 entries. `index.md` is not edited.
- Q2 (a): CF-003 and CF-005 are tagged `OpenNext`.
- Q3 (a): CF-011 and CF-016 are tagged `OpenNext`.
- Q4 (a): CF-022 is tagged `Workers`.
- Q5 (a): CF-005 says the binding carries a props value so revalidation requests get their own cache key, with no key name.
- Q6: replaced by owner decision 1 below.
- Q7 (b): UNTRUSTED-007 takes S28 clauses a and h.
- Q8 (a): TURNSTILE-002 is MUST.
- Q9 (a): SYNTAX-002, TURNSTILE-004 and SENTRY-003 are one-line entries.
- Q10 (a): CF-008 drops the emergency-skip sentence.
- Q11 (a): MUTATION-001 has no `Check:` line.
- I9: CF-007 and CF-008 carry no `Tags:` line (owner decision 2026-11-24).

Owner decisions for every rule issue (2026-11-25):

1. Rules cite concrete generic file and helper names even when the `index.md` names table lacks them. `index.md` is not edited. The PR lists every new name under "Names for the index.md follow-up".
2. Every entry gets a neutral one-line `Why:`, except one-line example-only entries. The PR lists every `Why:` written fresh.
3. Source lines are `- Source: <title> <URL>` or `- Source: <title> vault: Content/<path>.md`, with no quote. A lesson's point goes into the `Why:`. A source that cites the retired `next-best-practices` skill is replaced by the matching nextjs.org page.
4. A codyssey.dev source is live only when its page title is not "Coming <date>". Otherwise it cites the vault path. Checked at write time.
5. The issue's acceptance greps decide what counts as a Codyssey name. `vault: Content/` paths may carry the course name.
6. Rules cite other rules by pack id from the id map only.

`Check:` lines point at the "Checks the template may ship (stage 2 decides)" table of `index.md`. The D39 and I7 code-comment sources become `Why:` lines. The Sentry and Turnstile doc pages were rechecked and are cited without quotes.

## Decisions (owner, 2026-11-26)

Rule wording answers from the owner's review of the written entries.

1. SENTRY-008 also states that the policy's violation reports go to Sentry's endpoint.
2. CF-008 says the deploy script runs the size check (CF-024).
3. UNTRUSTED-001's `Why:` calls the sanitizer the first barrier for CMS HTML.
4. CF-018 says the project ships `public/_headers`.
5. PLAUSIBLE-001 cites only DATA-052 for the digest, and its failure example is `Checkout Failed`.
6. Every add-on and overlay file says a `Check:` line names the guard-test row, the lint rule, or the sheet's check idea for a rule, where one exists, as the `index.md` entry format does.
