# Plan for #88, nextjs-kanon: skeleton, id map and stub files

Issue codysseydev/codyssey-skills#88. Base origin/main b87b826. Branch `factory/88`. Kind: feature.

## Goal

Build the skeleton of `kanon/nextjs-kanon` that the rule issues #89 to #96 fill in parallel and the audit issue #97 reads. It holds `SKILL.md`, `references/index.md` with the full id map, and 18 stub files with `paths:` frontmatter and no rules. No rule bodies are written here.

## Changes

### `kanon/nextjs-kanon/SKILL.md` (new)

- Frontmatter in the style of `kanon/laravel-kanon/SKILL.md`: when to load it, that it overrides the host project's conventions, that it is not auto-applied in a codebase with team standards, and that `nextjs-kanon-audit` audits against it.
- Normative language copied from `laravel-kanon`.
- App premise and fixed core stack as the issue lists them. Vite+ is not in the stack line; #95 adds it.
- "How to apply while writing": a table from what you are writing to the reference file.
- Add-on and overlay detection table. Package add-ons load from `package.json`. Turnstile and Plausible load from the script-origin greps the issue gives. The overlay loads on `@opennextjs/cloudflare` or `wrangler.jsonc`.
- Vendored skills as the issue lists them, with the README-only license note for `vercel-labs/agent-skills`.
- Clash list, five rows, each with the pack id from the id map, the frontend id, the overridden upstream rule or doc, and the keyword reading the issue gives.
- Companions: `nextjs-kanon-audit` (#97) and `/code-review`.

### `kanon/nextjs-kanon/references/index.md` (new)

- Layers, id scheme and prefixes, entry format, notes policy, source policy, names rules may cite, guard-test rows, and the checks the template may ship (stage 2 decides).
- Counts per file, copied from the issue.
- The frontend accounting line, as numbers only.
- The id map: 325 rows, one per pack id, with file, layer, `From:` and a note column. The note column is used on three rows: the A11 Cloudflare clause row, and the I9 and I10 core part rows, which carry no `Tags:` line.

The map comes from a script that parses the Scope tables of #89 to #96, cross-checks them against the rule recount and the review sheet, and reads prose order from `codysseydev/codyssey-frontend` at `abdfd9f2`. A second script counts the committed `index.md` table on its own. Both run outside the repo. Their source and output go in the PR body.

### Stub files (new, 18)

- Core: `references/structure.md`, `data-and-rendering.md`, `types-and-tests.md`, `ui-a11y-seo.md`, `design-principles.md`, `access-and-security.md`, `tooling.md`.
- Add-ons: `references/add-ons/untrusted-content.md`, `syntax-highlighting.md`, `sentry.md`, `turnstile.md`, `radix.md`, `heroicons.md`, `plausible.md`, `axios.md`, `cmdk.md`, `mutation-testing.md`.
- Overlay: `references/overlays/cloudflare.md`.

Each has `paths:` frontmatter, a title, a one-paragraph scope, a severity paragraph and the section headings. None holds a rule entry. Stubs carry no dates, commit hashes or issue numbers, so the rule issues' "no dropped notes" greps stay clean.

### `README.md`

- The `kanon/` table row and the `kanon/` section name `nextjs-kanon`. The rule files are filled by #89 to #96, and the audit comes in #97.

## Owner decisions (2026-11-24, interactive session)

1. Add-on and overlay files order whole rules first, then clauses, each in frontend source order (structure, data-and-rendering, types-and-tests, ui-a11y-seo, design-principles, access-and-security, tooling-and-deploy, then rule position). The overlay starts with I1, I3, I4, I5, I6, I7, I9, the I10 core part and I11, then its 15 clauses.
2. NX anchors use the prototype defaults, with two overrides: NX-01 directly after A16 in `access-and-security.md`, NX-17 directly after U29 in `ui-a11y-seo.md`. NX-10 then NX-12 follow P3. NX-15 is the only entry of `mutation-testing.md`. NX-03 and NX-08 get no id.
3. The access stub's section is named `Gated content`.
4. Branch `factory/88`. No factory labels and no dashboard events.
5. Settled defaults:
   - The A11 Cloudflare clause keeps its id (CF-020). If #96 leaves it unused, it stays reserved and is never reused. `index.md` says so on that row.
   - I9 and the I10 core part have layer `core` and file `overlays/cloudflare.md`.
   - Clause labels in `From:` follow the issue prose, for example `D8 (Cloudflare clause)` and `S23 (Heroicons clause)`.
   - `install.mjs` does not change.
   - The count script is not committed.
   - `data-and-rendering.md` has no "Rendering HTML safely" section, since all its rules are add-on rules. `tooling.md` has no I-family section, and its first section drops the "(C family)" tag. `design-principles.md` has no "Considered and not proposed" section; #93 writes it.
   - `paths:` globs name no product feature folder. The source project's edge route folder becomes `app/**/route.ts`. `next.config.*` is in `data-and-rendering.md`, `access-and-security.md` and the overlay, not `tooling.md`. The Sentry, Turnstile and Plausible add-ons also carry it (owner decision 2026-11-24, see below). `wrangler.jsonc`, `worker.js` and `open-next.config.ts` are only in the overlay.

## Owner decisions (2026-11-24, after the independent review)

1. Wider `paths:` globs. `overlays/cloudflare.md` adds `app/**`, `src/lib/env.ts`, `src/types/**`, `src/features/**/types/**`, `**/*.test.ts` and `**/*.test.tsx`. `add-ons/sentry.md` adds `.github/**`, `package.json` and `src/lib/env.ts`. `add-ons/turnstile.md` adds `app/**`. `wrangler.jsonc`, `worker.js` and `open-next.config.ts` stay only in the overlay's globs.
2. `references/index.md`:
   - The "Names rules may cite" table adds `src/constants/routes.ts`, `src/lib/authSession.ts`, `src/lib/metadata.ts`, `src/lib/JsonLd.tsx`, `src/lib/structuredData.ts`, `src/lib/sentry/` and `src/lib/cloudflare/`.
   - A new table after the guard-test tables, "Checks the template may ship (stage 2 decides)", lists the overlay's Durable Object check (I1), the skew-mapping sync check (T31 Cloudflare clause, I2), the size budget (I10 core part and Cloudflare clause), the untrusted-content sanitizer tests (D37, D75), the Sentry consent guard (A14 Sentry clause) and the scripts-are-TypeScript guard (C7 core part). A rule keeps a `Check:` line naming such a check, and stage 2 decides whether it ships.
3. Tags. I9 and the I10 core part hold on any host and carry no `Tags:` line. Every other overlay entry is tagged `OpenNext` or `Workers`. Every source rule numbered I stays in the overlay by owner decision of 2026-11-23, and no other deploy overlay replaces the two untagged entries. The overlay intro, `SKILL.md`, the entry format in `index.md` and the id map notes on CF-007 and CF-008 say so. This settles the open question in #96 on the I9 tag. The shipped files say "by owner decision" without the date, since stubs carry no dates.
4. Wording:
   - This plan names the source project's edge route folder only in those words.
   - The `SKILL.md` description says "as MUST and SHOULD requirements".
   - The `data-and-rendering.md` heading "Hydration, layout and the edge cache" becomes "Hydration, layout and caching".

## Readings of the issue

These follow from the issue text. The PR lists them so the owner can change any of them. Items marked as owner decisions were asked after the first build and answered on 2026-11-24.

- `design-principles.md` has no `##` sections. The source file uses one heading per rule, and #93 says the pack uses the entry format instead. Owner decision 2026-11-24: confirmed.
- Add-on and overlay stubs have no `##` sections. They have no source file whose sections they could follow. Owner decision 2026-11-24: confirmed.
- Core sections keep the source headings, minus the sections named above, with one change. Owner decision 2026-11-24: the "Rule N:" and "Rules N and M:" prefixes are dropped. The `data-and-rendering.md` headings are `Public pages are prerendered`, `Seeding server data into client queries`, `Query-string-dependent UI`, `Lazy loading` and `Content images`. The old "Rules 5 and 6: code highlighting and content images" becomes `Content images`, since code highlighting is an add-on topic. No other core stub has such a prefix.
- Core `paths:` globs start from the source file's globs, with decision 5 applied and paths that only the source project has removed: its reviewer skill folder, CMS fetcher, static OG pipeline, project guides and service worker. Sentry's init files move to the Sentry add-on. Two template names join: `src/features/global-ui/**` and the component catalog. Owner decision 2026-11-24: the extra source globs (`vite.config.ts`, `.vite-hooks/**`, the `src/lib` metadata helpers, `src/lib/sentry/**`, `src/lib/cloudflare/**`) are confirmed as written.
- Add-on globs, which have no source, name the files each add-on touches. Owner decision 2026-11-24: `next.config.*` is added to the globs of `sentry.md`, `turnstile.md` and `plausible.md`, since each add-on wires its script origin or build plugin there. The other add-ons leave it out.
- `AGENTS.md` is in the `tooling.md` globs only. `.vite-hooks/**` stays in `tooling.md` from the source; a glob for a missing folder matches nothing.
- Owner decision 2026-11-24: the Zustand line in `SKILL.md`, the stub severity paragraph and the how-to step about `design-principles.md` and `structure.md` are confirmed as written.

## Verification

From the worktree root at the head commit, clean tree:

- Every acceptance-criteria command in #88, with its output.
- The count script against the committed `index.md`: the per-file counts, 325 rows, 270 distinct frontend ids, and 270 + 1 written fresh + 7 not copied = 278.
- Every check in `.factory/recipe.yml`. At base b87b826 all 12 pass.

## Out of scope

- Rule bodies (#89 to #96) and the audit skill (#97).
- The template repository `codysseydev/nextjs-template`, its guard test, and `bootstrap --frontend nextjs`.
- Any change to `codysseydev/codyssey-frontend`.
- The Kanon catalog conversion (#33 to #43) and `install.mjs`.
