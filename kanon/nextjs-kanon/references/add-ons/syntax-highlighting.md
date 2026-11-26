---
paths:
  - 'src/**/*.tsx'
  - 'src/lib/**'
---

# Add-on: Syntax Highlighting

Rules for highlighting code blocks. They load when `react-syntax-highlighter` is in
`package.json`. These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Rules

- **SYNTAX-001. Highlight code only through `LazyCodeHighlighter`.** It loads `src/features/global-ui/CodeBlock/prismLight.ts`, which sets up `PrismLight` with explicit languages. Only that file imports `react-syntax-highlighter`; register a new language there. The lazy load is the case SYNTAX-002 names. **MUST.**
  - Why: `PrismLight` ships only the grammars the app registers, and one import site keeps the full build, with every language, out of the bundle, for example when a docs page needs only TypeScript and shell.
  - From: D17

## Clauses

- **SYNTAX-002. `LazyCodeHighlighter` is heavy code with a fallback that fills the same box, the second case DATA-019 allows behind a lazy boundary.** **MUST.**
  - From: D16 (syntax-highlighting clause)
