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
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Clauses

- **AXIOS-001. Only the configured axios instance makes requests.** This adds to DATA-039: `apiClient` in `src/lib/apiClient.ts` is the configured axios instance, and no other code creates a raw `axios` instance or calls `axios` directly. Importing `AxiosError` or `isAxiosError` from `axios` for an error check is fine. **SHOULD.**
  - Why: a raw axios call skips the base URL, credentials and interceptors of the configured instance, for example the CSRF header a write needs.
  - From: D27 (axios clause)
- **AXIOS-002. Only the transport-failure mapper reads the axios error body.** This adds to DATA-047: no code reads `error.response.data.message` by hand to build a message, because `instanceof AxiosError` narrows to `AxiosError<any>` and the read is untyped. **SHOULD.**
  - Why: an untyped read compiles whatever shape the backend sends, so a renamed field shows `undefined` to the user instead of failing a type check.
  - From: D71 (axios clause)
