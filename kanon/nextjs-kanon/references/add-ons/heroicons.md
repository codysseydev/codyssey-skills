---
paths:
  - 'src/**/*.tsx'
---

# Add-on: Heroicons

Rules for Heroicons. They load when `@heroicons/react` is in `package.json`. These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Rules

- **HEROICONS-001. Icons come from `@heroicons/react/24/outline`, with `24/solid` for a filled icon.** A custom icon exists only where HEROICONS-002 allows it. **SHOULD.**
  - Why: one icon set keeps stroke width and size consistent across the app, for example a search icon and a close icon in the same header.
  - From: U44

## Clauses

- **HEROICONS-002. A custom icon exists only where Heroicons has none.** This adds to STRUCT-008: a custom icon in `src/features/global-ui/icons/` exists only where `@heroicons/react` has no equivalent. **SHOULD.**
  - Why: a hand-drawn copy of an icon Heroicons already has drifts from the set, for example a trash icon with a thicker stroke.
  - From: S23 (Heroicons clause)
