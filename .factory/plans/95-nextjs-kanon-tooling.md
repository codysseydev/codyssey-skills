# Plan for #95, nextjs-kanon: the tooling rules and the one-off tool checks

Issue codysseydev/codyssey-skills#95. Base origin/main d7d936e. Branch `factory/95`. Kind: feature.

## Goal

Fill `kanon/nextjs-kanon/references/tooling.md` with 12 entries (8 core rules and 4 core parts of split rules), and add T12 and T19 to `types-and-tests.md` as TYPES-022 and TYPES-036, so that file holds 40 entries. The words of T12, C4, C6 and T19 come from five one-off tool checks, which this plan already ran. Check 1 passed, so Vite+ joins the stack line of `SKILL.md`.

## Inputs read

- Frontend rule text: `codysseydev/codyssey-frontend` at `abdfd9f2`, `.ai/rules/tooling-and-deploy.md` (C1 to C12) and `types-and-tests.md` (T12, T19, T29). Also the pre-commit hook and the `staged` block of the frontend at that commit, to see what T19 describes.
- `references/index.md`: id map rows TOOLING-001 to 012, TYPES-022, TYPES-036, the entry format, notes and source policies, the names table, the guard-test rows and the "Checks the template may ship" table (TOOLING-007's scripts-are-TypeScript guard).
- The merged rule files, for overlaps and for the clauses that build on these entries: TYPES-016 and TYPES-030 (`types-and-tests.md`), STRUCT-032 (`structure.md`), SENTRY-010, CF-021 and CF-022.
- Plans 88 to 93 and 96 with their owner decisions, and the lint-rule lists in the PR comments of #90 (PR 127), #91 (PR 122) and #92 (PR 126).
- Vault notes: `Software Factory Pipeline.md` (React / Next.js pack, the one-off checks under "Still open for the pack"), `Rule Recount.md` (C1 to C12, T12, T19, the split table, the guard notes), `Public Safety Pass.md` (fix type per rule), `React and Next.js Pack Prerequisites.md` (decisions 5, 9, 22 and 23, the rewording table).
- Review sheet, revision 26, from its export: Sources rows on C5 and T19. No other tab has a row on C1 to C12, T12 or T19.

## Check results

Run on 2026-11-26 in a scratch Next.js App Router app outside every repo: `create-next-app` 16.4.6 with pnpm 11.24.0, TypeScript and Tailwind, Node 26.13.0, then the fixed stack (TanStack Query 5.108.4, XState Store 4.3.0, React Hook Form 7.92.0 with Zod 4.6.7, Testing Library, Storybook 10.6.9, knip 6.48.0). Vite+ 1.8.0 bundles Vite 8.3.8, Vitest 5.1.1, Oxlint 1.94.0 and Oxfmt 0.79.0. Commands, outputs and versions go in the PR's check report. Nothing from the scratch app is committed.

1. **Vite+ in a Next.js repo: pass.**
   - `vp migrate` added `prepare: vp config`, a `.vite-hooks/pre-commit` that runs `vp staged`, a `staged` block and a pnpm `catalog:` entry for `vite-plus`.
   - `vp check` runs Oxfmt, then Oxlint with type checks. It exits 0 on the stack sample: 37 files formatted, 29 linted and type-checked.
   - A fresh install runs `prepare` and installs the hook dispatcher (`core.hooksPath: .vite-hooks/_`).
   - A clean commit passes the hook. A commit with a TanStack Query key that misses a variable fails it, and only the staged file is checked.
   - Caveats for the owner:
     - Five files that `create-next-app` generates needed one `vp check --fix` before the first `vp check` passed.
     - Storybook 10.6.9 declares a `vite-plus` peer range of `^0.1.15 || ^0.2.0`, and 1.8.0 is outside it. `storybook build`, `vp test` and `next build` still passed.
     - `vp staged` needs Node 22.22.1 or later in 22.x, or 24.11.0 or later.
2. **Oxlint rules: partial.**
   - Oxlint 1.94.0 and 1.95.0 do not list `no-restricted-syntax` or `import/no-restricted-paths`.
   - `no-restricted-imports` with a per-file `overrides` entry works. It allows `src/lib/apiClient.ts` in `*.service.ts` files and reports it elsewhere, by alias and by relative path.
   - The rules that NX-10 (DESIGN-004) waits on are listed: `no-param-reassign`, `unicorn/no-array-sort` and `unicorn/no-array-reverse`. The two unicorn rules report a bare `items.sort();` statement only with `allowExpressionStatement: false`. The fourth rule exists as `react/immutability`. The config accepts the `react-hooks/immutability` name too. It reported a prop mutation, not a push into a state array. NX-10 is not changed here.
   - Every lint rule that a merged rule file names, or deferred to #95, is listed or loads as a JS plugin. The one exception is DATA-058's Next.js rule on relative `location` assignment, which Oxlint does not have; DATA-058 already dropped its name.
   - `better-tailwindcss/no-unknown-classes` works as an Oxlint JS plugin.
   - `@tanstack/query/no-void-query-fn` loads but reports nothing, because JS plugins get no type information. This matches C5.
3. **dependency-cruiser stale baseline: warn.**
   - dependency-cruiser 18.9.0 with `--ignore-known` prints `1 stale known violations in the baseline` and exits 0.
   - It does not prune the entry and does not fail.
   - `--baseline --baseline-mode shrink-only` removes stale entries and never adds new ones.
4. **`vp test related`: static imports and string-literal dynamic imports.**
   - A staged file reached only through `next/dynamic`, `React.lazy` or `await import(...)` ran its test, even when the test never runs that import.
   - The gap is a module that a test replaces with `vi.mock(path, factory)`. Neither that module nor its own imports lead back to the test.
   - This differs from the frontend's T19 note (Q1).
5. **TypeScript 7: pass.**
   - `next typegen`, then `tsc -p tsconfig.json --noEmit` with typescript 7.0.2, exits 0 on the whole sample. The sample has TYPES-016's flags on, and `.storybook/` and `scripts/` are included.
   - `tsc -p tsconfig.scripts.json` with `erasableSyntaxOnly` and `verbatimModuleSyntax` passes.
   - `next build` passes with TypeScript 7.
   - Lint plugins pull in `@typescript-eslint/*` 8.74.0, whose typescript peer range stops below 6.1. That is a peer warning only.

## Entries

Column key:
- **Kw**: the keyword in the frontend rule.
- **Planned**: the keyword this plan writes, and the decision that sets it.
- **Safety fix**: the fix type from `Public Safety Pass.md`.
- **Sources**: live means the page on https://codyssey.dev/ answered on 2026-11-26 with its own title, not "Coming <date>".
- **Check**: the planned `Check:` line.
- **Cites**: other rules this entry cites, by pack id.

| pack id | From | Kw | Planned | Safety fix | Sources | Check | Cites |
|---|---|---|---|---|---|---|---|
| TOOLING-001 | C1 | SHOULD | SHOULD | generalize | none | none (knip is STRUCT-032's) | STRUCT-032 |
| TOOLING-002 | C2 (core part) | SHOULD | SHOULD | move to the source project's overlay (left out) | none | none | none |
| TOOLING-003 | C3 | SHOULD | SHOULD | generalize | none | none | TOOLING-009 |
| TOOLING-004 | C4 (core part) | SHOULD | SHOULD; issue step 3: the hook tool the template ships, from check 1 | possible miss: the hook-install skip goes to the overlay | none | none | none |
| TOOLING-005 | C5 | SHOULD | SHOULD | none | The Query Bus (live) | lint, the six `@tanstack/query/*` rules | none |
| TOOLING-006 | C6 (core part) | SHOULD; MUST once a lockfile check exists | SHOULD (reading 5) | none | none | none | none |
| TOOLING-007 | C7 (core part) | SHOULD | SHOULD | none | none | the scripts-are-TypeScript guard (`index.md` checks table) | TYPES-016, TOOLING-009 |
| TOOLING-008 | C8 | SHOULD | SHOULD | generalize | none | none | none |
| TOOLING-009 | C9 | SHOULD | SHOULD | none | none | none | TOOLING-003 |
| TOOLING-010 | C10 | MUST | MUST | none | none | lint `typescript/consistent-type-imports` | none |
| TOOLING-011 | C11 | MUST | MUST | none | none | lint `typescript/no-unnecessary-condition` (type-aware) | TYPES-016 |
| TOOLING-012 | C12 | MUST | MUST | none | none | none | none |
| TYPES-022 | T12 | SHOULD | SHOULD | none | none | lint `typescript/unbound-method`; lint `vite-plus/prefer-vite-plus-imports` (loads through `jsPlugins: ['vite-plus/oxlint-plugin']`) | TYPES-030 |
| TYPES-036 | T19 | MUST | MUST | none | Claude Code Found 14 Rule Breaks in Merged Laravel Code (live, the edited row) | none | TYPES-022, TYPES-039 |

Counts:
- `tooling.md`: 12 entries. Core: 8. Core parts: 4.
- `types-and-tests.md`: 38 plus 2, so 40.
- Safety fixes: 5, the issue's list.
  - generalize: C1, C3, C8
  - move to the source project's overlay: C2
  - possible miss: C4
- Sheet source rows written: the approved C5 row and the edited T19 row. There are no other rows on these 14 rules.

### Per-rule notes

- **C1.** Keep: a package is imported by source, scripts or config, or is a peer of one that is; build tools sit in `devDependencies`. STRUCT-032 already says knip is a blocking CI step with its entry points set once in `knip.json`, and that a change deletes a module nothing imports. So TOOLING-001 cites STRUCT-032 for those, and does not say them again. Dropped: the guide pointer and the Not migrated note.
- **C2.** Keep one sentence, as the safety pass words it: a config file is referenced by a tool, and an installed lint plugin is loaded by the `lint` block of `vite.config.ts` (`plugins` or `jsPlugins`). The skills clause and its note are left out.
- **C3.** CI reads the Node version from `.nvmrc` (`node-version-file: .nvmrc`), and the `pull_request` trigger names only the live branches. That is the safety pass rewrite. The history sentence goes.
- **C4.** Core part:
  - A new package with an install script is added to `allowBuilds` in `pnpm-workspace.yaml`.
  - The git hooks install through the `prepare` script, `vp config`, which pnpm runs on install.
  - Each file extension matches one key of the `staged` block in `vite.config.ts`, and Oxfmt runs before Oxlint on a file.

  The Husky name goes, by issue step 3. The skip switch for the deploy build stays with CF-021. The frontend says pnpm "skips" an unlisted script. pnpm 11.24.0 printed `ERR_PNPM_IGNORED_BUILDS` and wrote a placeholder key into `allowBuilds`. The Why says the script does not run until the package is listed.
- **C5.** The recommended set of `@tanstack/eslint-plugin-query` runs as an Oxlint JS plugin from `vite.config.ts`, with the six rules named. `no-void-query-fn` stays off with its reason, which check 2 confirmed. The Why takes the point of The Query Bus row: a cached query's key holds everything its answer depends on.
- **C6.** Core part:
  - The Storybook family and the Vite+ family move together, with exact specifiers. Storybook is `storybook` and every `@storybook/*` package at one version. Vite+ is `vite-plus`, which bundles one Vitest, plus `vitest` and `@vitest/*` packages if added.
  - The Vite+ family has one exact version per package in the `catalog:` block of `pnpm-workspace.yaml`, and `package.json` refers to it with `catalog:`. `vp migrate` writes that block.
  - Dependabot runs weekly with grouped updates: one group for Storybook, one for the Vite+ toolchain (`vite-plus`, `@voidzero-dev/*`, `vitest`, `@vitest/*`), one for everything else, and a weekly `github-actions` entry. SENTRY-010 adds the Sentry group by citing TOOLING-006. TOOLING-006 names no Sentry entry, so the issue's Sentry grep stays empty.
- **C7.** Core part:
  - Files under `scripts/` are `.ts` and run with Node's type stripping (`node scripts/x.ts`), with no `tsx` dependency, so they use no enums and no namespaces.
  - `tsconfig.json` and `tsconfig.scripts.json` cover `scripts/**/*.ts`. The typecheck script runs the second one with `erasableSyntaxOnly` and `verbatimModuleSyntax`.
  - Relative imports carry the `.ts` extension.

  Left out: `worker.js` and the Workers Builds sentence (CF-022), `public/sw.js` (the source project's overlay, decision 4) and the I4 citation. The test file name becomes the `Check:` line for the guard in `index.md`. Q4 covers the `next.config.mjs` half. TYPES-016 says `verbatimModuleSyntax` stays off. That is about `tsconfig.json`, so TOOLING-007 says the scripts config turns it on for `scripts/` only.
- **C8.**
  - Each workflow sets `permissions: contents: read` at the top.
  - A `concurrency` group is keyed on the ref, with `cancel-in-progress: true`.
  - The pull request trigger has `paths-ignore` (Q6).
  - Typecheck and lint share one job.

  The Not migrated note goes.
- **C9.** `engines.node` and `devEngines.runtime` name the major the suite passes on, so a shell on another major fails with `EBADDEVENGINES`. `.nvmrc` and the CI Node version name the same major. Q5 covers the number and Volta.
- **C10.** As the source words it, with its example. The guide pointer goes.
- **C11.** As the source words it: one `overrides` entry for `app/`, `src/` (stories included) and `scripts/`, and lint reads the same `tsconfig.json` as the typecheck script. TYPES-016 is cited for `noUncheckedIndexedAccess`. The parenthetical "the root config files are outside the TypeScript project" goes. It describes the source project's tsconfig, and `create-next-app`'s `include` covers the root config files. Oxlint files the rule under "nursery". The PR notes that, and the rule text does not.
- **C12.** The Storybook config passes the bundler only the `NEXT_PUBLIC_*` keys of `process.env`, never all of it. The source names the `define` block in `.storybook/main.ts`. With `@storybook/nextjs-vite` that block sits in `viteFinal`, so the rule names the `define` the Storybook config passes. The build-and-search recipe stays as the Why's example: a server-side secret in the build shell does not reach the static output. The guide pointer goes.
- **T12 (TYPES-022).**
  - Mock external modules with `vi.mock()` at the top of the file. A mocked method is its own `vi.fn()` constant from `vi.hoisted`, not `vi.mocked(obj.method)`, which `typescript/unbound-method` reports.
  - Test files import from `vite-plus/test`, not `vitest`. Vite+'s test guide says the Vitest APIs come from that path.
  - Overlap with TYPES-030: TYPES-030 already names `clearMocks`, `unstubGlobals` and `unstubEnvs`. TYPES-022 keeps only the one instruction TYPES-030 lacks: a test file does not call `vi.clearAllMocks()` itself, because the shared config resets mocks (TYPES-030). The three key names appear once, in TYPES-030. TYPES-030 is not edited.
  - The guide pointer goes.
- **T19 (TYPES-036).**
  - A change passes every gate CI runs (Q2 for how the gates are named).
  - The pre-commit hook runs `vp staged`, which is `vp check --fix` on the staged files only (CI runs the full check). It then runs `vp test related` for the staged files.
  - The note follows Q1.
  - Source: the edited T19 row, title and URL with no quote. Its point goes into the Why: the gates run in a fixed order and a change that fails one does not merge.
  - It cites TYPES-039 for the clean-lint gate.

### `tooling.md` other text

- The intro sentence about `Check:` lines changes to the owner's wording: "A `Check:` line names the guard-test row, the lint rule, or the sheet's check idea for a rule, where one exists."
- The `paths:` frontmatter stays as the stub has it. It already lists `vite.config.ts` and `.vite-hooks/**`, and no Cloudflare file.
- "What is NOT a violation" keeps three bullets:
  - A package used only by a config file, or only as a peer dependency, for example `babel-plugin-react-compiler`. The source's `xstate` example goes, because XState Store 4 does not need it.
  - A `^` range for a package that is not in a peer-pinned family (TOOLING-006).
  - A docs-only change that skips CI through `paths-ignore` (TOOLING-008).

  The `worker.js` bullet and the local `next build` bullet go. They belong to the overlay, and the acceptance grep forbids `worker.js`.

### `types-and-tests.md`

- TYPES-022 goes between TYPES-021 and TYPES-023, in `Test placement and shape`.
- TYPES-036 goes between TYPES-035 and TYPES-037, in `What a change ships with`.
- No other entry changes.

### `SKILL.md`

Check 1 passed, so the fixed core stack gains one bullet after "Oxfmt, with a documented swap to Prettier.":

- Vite+: `vp check` runs Oxfmt and then Oxlint with type checks, `vp staged` runs them on staged files from the git hook that `vp config` installs, and `vp test` runs Vitest.

The bullet adds a line only. "Cache Components off" waits for the single follow-up PR after #89 to #96, as the owner decided.

## Readings

These follow from the issue, `index.md` and the earlier owner decisions. The PR lists them so the owner can change any of them.

1. **Notes policy.** Observed, Not migrated and incident notes go, with dated counts and guide pointers (`docs/guides/...`).
2. **Why lines.** Every entry gets a neutral one-line `Why:`. The PR lists every Why written fresh.
3. **Names.** The entries cite concrete generic names: `knip.json`, `pnpm-workspace.yaml`, `vite.config.ts`, `.vite-hooks/pre-commit`, `.nvmrc`, `.github/dependabot.yml`, `tsconfig.scripts.json`, `scripts/`, `.storybook/main.ts`. The PR lists them under "Names for the index.md follow-up".
4. **Test file names dropped.** The PR lists them for stage 2: `scripts/tests/scriptsAreTypeScript.test.ts` (C7, named by its `index.md` checks-table row instead).
5. **C6's "MUST once a lockfile check exists".** This follows plan 90's reading of DATA-062: `index.md` lists no lockfile check, so the clause goes and SHOULD stays. The PR's keyword table lists the cell change.
6. **Lint rules other files deferred.** The PR reports check 2's result for each deferred rule: TYPES-002, TYPES-005, TYPES-021, TYPES-039, UI-005, UI-020, UI-021, UI-024, UI-027, UI-031, UI-051, DATA-053, DATA-058, and NX-10 as DESIGN-004. This PR does not edit those entries (Q3).

## Verification

From the worktree root, at the head commit, on a clean tree:

1. Every acceptance command of #95, with its output:
   - `grep -cE '^- \*\*TOOLING-[0-9]{3}\.' kanon/nextjs-kanon/references/tooling.md` prints 12.
   - The same count with `TYPES` on `types-and-tests.md` prints 40.
   - The Codyssey-name grep, the Cloudflare and Sentry grep, the dropped-notes grep and the Source-line grep each print nothing.
2. A From script, run outside the repo, with its source and output in the PR body. It:
   - reads the id map rows for `tooling.md`, and for `types-and-tests.md` with no slot reserved
   - checks the issue's scope table against those rows
   - fails unless each entry has exactly one `From:` line and the ordered (pack id, From) pairs equal the map
3. A cross-reference grep on both files. Every source-style id left in the text sits on a `From:` line, and every pack id cited exists in the id map:

   ```
   grep -nE '\b[SDTUPAIC][0-9]{1,2}\b' kanon/nextjs-kanon/references/tooling.md | grep -v 'From:'
   ```
4. The clauses that build on these entries still read true against them:
   - SENTRY-010 against TOOLING-006 (the weekly Dependabot groups)
   - CF-021 against TOOLING-004 (hook install through `prepare`)
   - CF-022 against TOOLING-007 (`worker.js` left to the overlay)
5. The PR body tables:
   - the check report
   - the 5 safety fixes
   - the keyword table (C6, reading 5)
   - the source rows written
   - the dropped test file names
   - the names for the follow-up
   - the deferred lint-rule results
6. The 12 checks in `.factory/recipe.yml`. `kanon-catalog-check` reads `kanon/catalog/*.json` only.

## Out of scope

- The Cloudflare overlay, the add-ons and the Cloudflare and Sentry clauses of C4, C6 and C7 (#96, merged).
- Other entries of the merged rule files, including the unconfirmed `Check:` lines on TYPES-002, TYPES-005, TYPES-021 and TYPES-039, and DESIGN-004's keyword (Q3).
- Moving guard-test rows to Oxlint or dependency-cruiser: stage 1 keeps every row in the guard test. The checks only report.
- `index.md`, the template repository and its guard test (stage 2), `bootstrap --frontend nextjs` (stage 3), the audit (#97), and any change to `codysseydev/codyssey-frontend`.

## Open questions

- **Q1. Which commit-time note does TYPES-036 carry for `vp test related`?**
  - Context: the source says it follows static imports only. Check 4 found that it also follows string-literal dynamic imports, but not a module a test replaces with `vi.mock` and a factory, the style TYPES-022 asks for.
  - (a) **Recommended.** The gap seen: a staged module that a test replaces with `vi.mock` does not bring that test into the commit-time run, so CI is the backstop (cites TYPES-022).
  - (b) No note; "CI runs the full suite" only.
  - (c) The source wording.
- **Q2. How does TYPES-036 name the CI gates?**
  - Context: #91's Q4 answer named what each tool does and left T12 and T19 to #95.
  - (a) **Recommended.** The typecheck script, `vp check` (Oxfmt, then Oxlint), the test script (`vp test`) and `next build`, plus the hook commands `vp staged` and `vp test related`.
  - (b) The source's script names: `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build`.
- **Q3. Which change updates the unconfirmed `Check:` lines on TYPES-002, TYPES-005, TYPES-021 and TYPES-039, and DESIGN-004 (NX-10)?**
  - Context: check 2 found each rule. For NX-10, no rule catches `push`, `splice` or a `Date` setter on data the code does not own.
  - (a) **Recommended.** The single follow-up PR after #89 to #96, with this PR's check report as its input.
  - (b) This PR, on top of TYPES-022 and TYPES-036.
  - (c) None until stage 2 confirms the template's own lint config.
- **Q4. What does TOOLING-007 say about a config file that stays JavaScript?**
  - Context: the source keeps `next.config.mjs` as JavaScript, `create-next-app` 16.4.6 writes `next.config.ts`, and CF-022 holds `worker.js`.
  - (a) **Recommended.** Nothing: the clause goes, since no core file stays JavaScript.
  - (b) A generic clause: a config file that its runtime loads as written stays JavaScript and holds glue only, with logic in typed modules under `src/lib/`.
  - (c) `next.config.mjs`, as the source has it.
- **Q5. Which Node major and which version files does TOOLING-009 name?**
  - Context: the source pins `26.x` and lists `volta.node`; Volta is not in the fixed stack, and `vp staged` needs Node 22.22.1+ or 24.11.0+.
  - (a) **Recommended.** No number: one major, `<major>.x`, in `engines.node` and `devEngines.runtime`, with `.nvmrc` and CI naming the same major. No Volta.
  - (b) `26.x`, the major the checks ran on, without Volta.
  - (c) `26.x` with Volta, as the source has it.
- **Q6. Which `paths-ignore` folders does TOOLING-008 name?**
  - Context: the safety pass says C8 stands once its note goes; the recount calls `.agents/` and `.claude/` source-specific.
  - (a) **Recommended.** `docs/`, `/*.md`, `.agents/` and `.claude/`, since the last two hold the vendored skills and agent settings, not source-project names.
  - (b) `docs/` and `/*.md` only.
  - (c) `docs/`, `/*.md` and "the folders that hold agent skills and settings", with no folder names.

## Inputs that disagree

The PR lists these for the owner. None changes a decided rule.

- `create-next-app` 16.4.6 writes `cacheComponents: true` into `next.config.ts`. The owner decided Cache Components stays off. The template has to turn it off, and the follow-up PR adds it to the stack line.
- Storybook 10.6.9's `vite-plus` peer range (`^0.1.15 || ^0.2.0`) does not include Vite+ 1.x. It warns only.
- T19's note against check 4 (Q1).
- C7's `next.config.mjs` against `create-next-app`'s `next.config.ts` (Q4).
- C4's "pnpm skips its script" against pnpm 11's `ERR_PNPM_IGNORED_BUILDS` and placeholder key.
- C8's folders, the recount against the safety pass (Q6).
- XState Store 4 moves its React hooks to `@xstate/store-react`. No merged rule names the old `@xstate/store/react` path.
