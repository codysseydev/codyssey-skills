---
paths:
  - 'next.config.*'
  - 'src/**/*.tsx'
  - 'src/features/**/components/**'
  - 'app/**'
---

# Add-on: Turnstile

Rules for Cloudflare Turnstile bot checks. Turnstile loads from a script tag, not a
package, so these rules load when
`grep -rlE 'challenges\.cloudflare\.com/turnstile' src app` finds a file.
These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Rules

- **TURNSTILE-001. Turnstile is rendered through one `Captcha` component.** Forms use `src/features/global-ui/Captcha/Captcha.tsx`. Never load Turnstile's `api.js` outside the component's loader, `turnstileLoader.ts`. Every form sends the token under the one field name the backend reads, shows the widget on first interaction, and reads the site key through the env module (TURNSTILE-004). **SHOULD.**
  - Why: one component and one loader keep the script origin, the load timing and the token field in one place, so a new form, such as a contact form, cannot drift from what the backend checks.
  - From: D47
- **TURNSTILE-002. A Turnstile token is single-use, so the widget resets after every submit attempt that reached the server.** This holds on every form that renders the widget, after a failed submit as well as a successful one. `Captcha` takes a `ref` or a `key` for the reset. **MUST.**
  - Why: Turnstile validates a token once and rejects a replay, so a second submit with the old token fails, for example after a contact form fails server-side validation.
  - Source: Cloudflare Turnstile, Validate the token https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
  - From: D48

## Clauses

- **TURNSTILE-003. The Turnstile widget is client-only UI, the first case DATA-019 allows behind a lazy boundary.** **MUST.**
  - From: D16 (Turnstile clause)
- **TURNSTILE-004. The Turnstile site key is one of the typed values the env module of DATA-042 exports.** **MUST.**
  - From: D30 (Turnstile clause)
- **TURNSTILE-005. Turnstile's origin is in the CSP.** This adds to ACCESS-011: the change that adds the widget lists Turnstile's script and frame origin in the CSP, one entry per directive. **SHOULD.**
  - Why: the widget loads a script and renders an iframe, so a policy without its origin blocks the check and the form cannot submit.
  - From: A10 (Turnstile clause)
