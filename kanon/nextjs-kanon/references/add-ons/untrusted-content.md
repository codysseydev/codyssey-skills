---
paths:
  - 'src/**/*.tsx'
  - 'src/lib/**'
  - 'src/features/**/utils/**'
  - 'app/**/*.tsx'
---

# Add-on: Untrusted Content

Rules for rendering HTML or markdown that the app did not write, such as CMS content.
They load when `react-markdown`, `rehype-sanitize` or another HTML sanitizer is in
`package.json`. These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.
