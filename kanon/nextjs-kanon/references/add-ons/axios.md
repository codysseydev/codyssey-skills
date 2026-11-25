---
paths:
  - 'src/lib/apiClient.ts'
  - 'src/lib/**'
  - 'src/features/**/services/**'
---

# Add-on: axios

Rules for an API client built on axios. They load when `axios` is in `package.json`.
These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.
