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
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.

## Dependencies, config and tooling

## What is NOT a violation
