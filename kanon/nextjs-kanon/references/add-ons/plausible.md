---
paths:
  - 'app/layout.tsx'
  - 'src/**/*.tsx'
  - 'src/lib/**'
---

# Add-on: Plausible

Rules for Plausible analytics. Plausible loads from a script tag, not a package, so these
rules load when `grep -rlE 'plausible\.io/js' src app` finds a file.
These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.
