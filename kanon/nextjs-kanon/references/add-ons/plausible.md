---
paths:
  - 'app/layout.tsx'
  - 'next.config.*'
  - 'src/**/*.tsx'
  - 'src/lib/**'
---

# Add-on: Plausible

Rules for Plausible analytics. Plausible loads from a script tag, not a package, so these
rules load when `grep -rlE 'plausible\.io/js' src app` finds a file.
These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Rules

- **PLAUSIBLE-001. Analytics events go through one typed helper.** Send events only through `trackEvent` in `src/lib/plausible.ts`. Event names live in one enum, `AnalyticsEvent`, that keeps every existing string unchanged. Props are typed per event. A new name is `<Object> <Action>` in Title Case, such as `Button Click`, and a failure appends `Failed`, such as `Checkout Failed`. Props carry no free text of any kind: no search query, no error message, no URL query string, no email, name or token. A `url` prop that names an external link is content and is allowed. Errors go to error reporting, not to analytics, and the error page keeps the error's digest on screen (DATA-052). **SHOULD.**
  - Why: Plausible matches a goal to the exact event name, so renaming an event, such as `Button Click` to `Button Clicked`, starts a new goal and the old one stops counting.
  - Source: Put an Interface in Front of Every Third-Party API vault: Content/Quick Tips/55 - Put an Interface in Front of Every Third-Party API.md
  - From: D50

## Clauses

- **PLAUSIBLE-002. The route error boundary sends its Plausible event without the error message.** This adds to DATA-052: `app/error.tsx` keeps its analytics event, and the event carries no message, as PLAUSIBLE-001 requires. **SHOULD.**
  - Why: an error message is free text and can carry personal data, for example an email address echoed back by a failed request.
  - From: D41 (Plausible clause)
- **PLAUSIBLE-003. Plausible's origin is in the CSP.** This adds to ACCESS-011: the change that adds the Plausible script lists its script and connect origin in the CSP, one entry per directive. **SHOULD.**
  - Why: the script loads from Plausible and sends its events back there, so a policy without that origin blocks both and no event is counted.
  - From: A10 (Plausible clause)
