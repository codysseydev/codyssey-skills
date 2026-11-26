---
paths:
  - 'package.json'
  - 'pnpm-workspace.yaml'
  - 'pnpm-lock.yaml'
  - 'tsconfig*.json'
  - 'vite.config.ts'
  - 'knip.*'
  - '.nvmrc'
  - '.env.example'
  - '.vite-hooks/**'
  - '.github/**'
  - '.storybook/**'
  - 'scripts/**'
  - 'AGENTS.md'
---

# Tooling and CI

Dependencies, config and tooling: the package manager, TypeScript config, lint and
format, unused-code checks, CI, Storybook, scripts and Node version pins.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Dependencies, config and tooling

- **TOOLING-001. Dependencies are used, and in the right section.** A package in `package.json` is imported by source, scripts or config, or is a peer of one that is. Build tools sit in `devDependencies`. knip reports an unused package as a blocking CI step, with its entry points set once in `knip.json` (STRUCT-032). **SHOULD.**
  - Why: a package nothing imports still installs and still gets update pull requests, for example a date library left behind after its last import was removed.
  - From: C1
- **TOOLING-002. No dead scaffolding or unwired config.** A config file is referenced by a tool, and an installed lint plugin is loaded by the `lint` block of `vite.config.ts`, in `plugins` or `jsPlugins`. **SHOULD.**
  - Why: a config file no tool reads, or a lint plugin that is installed but never loaded, looks like a check that runs and is not one; for example a `.prettierrc` left in a repository that formats with Oxfmt.
  - From: C2 (core part)
- **TOOLING-003. CI reads its versions from one place and watches live branches only.** The setup step reads the Node version from `.nvmrc` (`node-version-file: .nvmrc`), and the `pull_request` trigger names only the live branches. TOOLING-009 pins the major. **SHOULD.**
  - Why: a Node version typed into the workflow drifts from the one developers run, and a trigger on a branch nobody merges to spends CI time on work nobody reads.
  - From: C3
- **TOOLING-004. A new package with an install script is added to `allowBuilds` in `pnpm-workspace.yaml`.** The git hooks live in `.vite-hooks/` and install through the `prepare` script, `vp config`, which pnpm runs on install. Each file extension matches one key of the `staged` block in `vite.config.ts`, so Oxfmt runs before Oxlint on a file. **SHOULD.**
  - Why: pnpm does not run the install script of a package that `allowBuilds` does not list, so a package that needs one, for example `esbuild`, is not set up until it is listed.
  - From: C4 (core part)
- **TOOLING-005. `@tanstack/eslint-plugin-query` guards query hooks.** Its recommended set is on in `vite.config.ts`, where the plugin loads as an Oxlint JS plugin. Six rules enforce: `exhaustive-deps` (a query key holds every variable its `queryFn` uses), `no-rest-destructuring`, `stable-query-client`, `no-unstable-deps`, `infinite-query-property-order` and `mutation-property-order`. A seventh, `no-void-query-fn`, stays off: Oxlint JS plugins get no type information and the rule needs the return type of `queryFn`, so review catches a `queryFn` that returns nothing. **SHOULD.**
  - Why: a cached query's key holds everything its answer depends on; a key of `['order']` for an order fetched by id serves the first order's cached answer on every order page.
  - Check: Oxlint, the six `@tanstack/query/*` rules above, loaded through the `@tanstack/eslint-plugin-query` JS plugin.
  - Source: The Query Bus https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/query-bus
  - From: C5
- **TOOLING-006. Packages that pin each other move together, with exact specifiers.** Storybook (`storybook` and every `@storybook/*` package at one version) and the Vite+ family (`vite-plus`, which bundles one Vitest version, plus `vitest` and any `@vitest/*` package that is added) are each bumped in one change. The Vite+ family has one exact version per package in the `catalog:` block of `pnpm-workspace.yaml`, and `package.json` refers to it with `catalog:`, so `vite-plus` and Vitest move together. Dependabot (`.github/dependabot.yml`) runs weekly with grouped updates: one group for Storybook, one for the Vite+ toolchain (`vite-plus`, `@voidzero-dev/*`, `vitest`, `@vitest/*`), one for everything else, and a weekly `github-actions` entry. **SHOULD.**
  - Why: a family whose packages peer-pin each other breaks when one member moves alone; a `@storybook/*` package left one version behind `storybook` no longer matches its peer range.
  - From: C6 (core part)
- **TOOLING-007. Scripts are TypeScript.** Files under `scripts/` are `.ts`, so the Oxlint and `tsc` setup covers them. They run with Node's built-in type stripping (`node scripts/x.ts`), with no `tsx` dependency, so they use no enums and no namespaces. `tsconfig.json` covers `scripts/**/*.ts`, so type-aware lint reads them, and so does `tsconfig.scripts.json`, which the typecheck script runs with `erasableSyntaxOnly` and `verbatimModuleSyntax`: a script that needs more than type erasure fails the type check. `verbatimModuleSyntax` is on for `scripts/` only, and `tsconfig.json` keeps it off (TYPES-016). Relative imports carry the `.ts` extension. **SHOULD.**
  - Why: Node's type stripping only erases types, so an enum in a script passes in the editor and fails when Node runs it; `erasableSyntaxOnly` makes that a type error first.
  - Check: the scripts-are-TypeScript guard (see "Checks the template may ship" in `index.md`): every file under `scripts/` is a `.ts` file.
  - From: C7 (core part)
- **TOOLING-008. A workflow declares least privilege, stops superseded runs and installs once per concern.** Each workflow sets `permissions: contents: read` at the top, a `concurrency` group keyed on the ref with `cancel-in-progress: true`, and `paths-ignore` for `docs/`, `/*.md`, `.agents/` and `.claude/` on the pull request trigger. Typecheck and lint share one job: one install, two steps. **SHOULD.**
  - Why: a workflow token with write access lets one compromised action push to the repository, and a run on a superseded commit keeps a runner busy for a result nobody reads.
  - From: C8
- **TOOLING-009. `engines.node` names the major the suite passes on.** `package.json` sets `engines.node` and a `devEngines.runtime` block to one major, `<major>.x`, so a shell on another major fails with `EBADDEVENGINES` instead of running a suite it was not checked on. `.nvmrc` and the CI Node version (TOOLING-003) name the same major. **SHOULD.**
  - Why: a developer on another Node major sees failures CI never sees, or passes CI never checked; the pin turns that into one clear install error.
  - From: C9
- **TOOLING-010. A symbol that is only a type is imported with `import type`.** `typescript/consistent-type-imports` enforces it, so `import { Metadata } from 'next'` becomes `import type { Metadata } from 'next'`. **MUST.**
  - Why: an `import type` is erased at build time, so a type-only import never pulls a module into the bundle or adds an import cycle at run time.
  - Check: Oxlint `typescript/consistent-type-imports`, a rule Oxlint 1.94 lists under that name.
  - From: C10
- **TOOLING-011. Optional chaining on a value the type says is present fails lint.** `typescript/no-unnecessary-condition` (type-aware) makes `a?.b` on a non-nullable `a` an error, and it also shows types that call a field required when the API can omit it. The rule runs on every ts and tsx file under `app/`, `src/` (stories included) and `scripts/`, through one `overrides` entry in `vite.config.ts`. New code follows it without a folder to add. Lint reads the same `tsconfig.json` as the typecheck script, including `noUncheckedIndexedAccess` (TYPES-016), so a guard on `array[i]` is not reported and needs no disable. **MUST.**
  - Why: a `?.` on a value that cannot be missing hides which values can; when the API can omit a field, the report points at the type that says it cannot.
  - Check: Oxlint `typescript/no-unnecessary-condition`, type-aware, a rule Oxlint 1.94 lists under that name.
  - From: C11
- **TOOLING-012. The Storybook bundle inlines `NEXT_PUBLIC_*` keys only.** The Storybook config in `.storybook/main.ts` passes the bundler a `define` that holds the `NEXT_PUBLIC_*` keys of `process.env`, never all of `process.env`. Review checks it by reading that `define`. **MUST.**
  - Why: a Storybook build is static files that anyone with the URL can read, so a server-side secret in the build shell that reaches `define` is published; a search of the built output for the secret's value confirms it is absent.
  - From: C12

## What is NOT a violation

- A package used only by a config file, or only as a peer dependency, for example `babel-plugin-react-compiler`.
- A `^` range for a package that is not in a peer-pinned family (TOOLING-006).
- A docs-only change that skips CI through `paths-ignore` (TOOLING-008).
