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

## What is NOT a violation
