---
paths:
  - 'src/features/global-ui/**'
  - 'src/features/**/*.tsx'
---

# Add-on: cmdk

Rules for a command palette built on cmdk. They load when `cmdk` is in `package.json`.
These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Clauses

- **CMDK-001. A command palette uses cmdk inside the app's one dialog.** This adds to UI-041: a command palette or search combobox is built with `cmdk`, rendered inside the one dialog approach UI-041 requires, which is Radix Dialog when the Radix add-on loads (RADIX-004). **SHOULD.**
  - Why: cmdk handles the combobox roles, filtering and arrow-key selection, and the shared dialog handles focus and dismissal, so a search palette does not rebuild either.
  - From: U39 (cmdk clause)
