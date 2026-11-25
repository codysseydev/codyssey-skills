---
paths:
  - 'stryker.config.*'
  - '**/tests/**'
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - 'package.json'
  - '.github/**'
---

# Add-on: Mutation Testing

Rules for mutation testing with Stryker. They load when `@stryker-mutator/core` is in
`package.json`. These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Rules

- **MUTATION-001. Pure rule modules may run under mutation testing.** Pure rule modules where a silent wrong answer costs money or access (prices, totals, access helpers, status tables, date functions) MAY run under mutation testing (Stryker with the Vitest runner) on a schedule or on changed lines, with a gate just below the current score. A surviving mutant is fixed by adding an assertion. This is not a core gate; TYPES-035 still asks for a test with new logic. **MAY.**
  - Why: coverage shows which lines a test ran, and a mutation run shows which lines a test checked, for example a flipped comparison in a price function that no assertion notices.
  - Source: Mutation Testing https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/mutation-testing
  - Source: Your Tests Are Green and the Bug Shipped Anyway vault: Content/Insights/Your Tests Are Green and the Bug Shipped Anyway.md
  - Source: 7 PHP Code Quality Tools That Pay Off Years Later https://codyssey.dev/insights/7-php-tools-that-pay-off-three-years-from-now
  - From: NX-15
