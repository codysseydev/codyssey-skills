---
paths:
  - 'next.config.*'
  - 'instrumentation.ts'
  - 'instrumentation-client.ts'
  - 'sentry.*.config.ts'
  - 'src/lib/sentry/**'
  - 'src/providers/**'
  - 'app/global-error.tsx'
  - 'app/**/error.tsx'
---

# Add-on: Sentry

Rules for error reporting with Sentry. They load when `@sentry/nextjs` is in
`package.json`. These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.
