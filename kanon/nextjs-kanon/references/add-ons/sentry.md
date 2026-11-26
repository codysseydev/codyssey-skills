---
paths:
  - 'next.config.*'
  - 'instrumentation.ts'
  - 'instrumentation-client.ts'
  - 'sentry.*.config.ts'
  - 'src/lib/sentry/**'
  - 'src/providers/**'
  - 'app/global-error.tsx'
  - 'app/**/error.tsx'
  - '.github/**'
  - 'package.json'
  - 'src/lib/env.ts'
---

# Add-on: Sentry

Rules for error reporting with Sentry. They load when `@sentry/nextjs` is in
`package.json`. These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Rules

- **SENTRY-001. Report an error the UI absorbs.** When a `catch` replaces a failure with a toast, a fallback value or a retry, call `Sentry.captureException(error, { tags: { area, operation } })`. `area` is the feature in kebab-case, and `operation` is a kebab-case phrase for the step. Ids go in `extra`. No email, name or token goes in tags or `extra`, and data collection stays restricted in `src/lib/sentry/dataCollection.ts`. Do not report an error that is rethrown, because it already reaches Sentry, or an expected outcome such as a 404, a validation error or an abort. On the `useMutation` path the wrapper of SENTRY-004 owns this report: it skips a 4xx or a cancelled request and still reports a 5xx and a network error. See also DATA-032. **SHOULD.**
  - Why: without a report, a page that falls back to its server copy keeps showing it and nothing says why, for example an order page whose rich-text notes failed to load.
  - From: D39
- **SENTRY-002. Wrap the failing step, not the request, and rethrow when the caller's behaviour should not change.** Use a helper such as `reportRichTextFailure(operation, transform)`: it reports with the tags of SENTRY-001 and rethrows. **SHOULD.**
  - Why: a wrapper around the whole request reports an API error a second time, while a wrapper around one step reports only that step, for example the transform that parses a response.
  - Source: Exception Handling as Design https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/exception-handling-as-design
  - Source: Guard Clauses and Defensive Programming https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/guard-clauses-and-defensive-programming
  - Source: Skip Bad Rows, Don't Fail the Import vault: Content/Quick Tips/58 - Skip Bad Rows, Don't Fail the Import.md
  - From: D40

## Clauses

- **SENTRY-003. The failure path of an optimistic update in DATA-021 reports to Sentry, as SENTRY-001 requires.** **SHOULD.**
  - From: D19 (Sentry clause)
- **SENTRY-004. A mutation wrapper owns the toast and the Sentry report.** This adds to DATA-032: on the `useMutation` path, `useFeatureMutation` in `src/lib/useFeatureMutation.ts` owns the toast and the SENTRY-001 report, and `isExpectedRequestFailure` decides which failures it skips. **SHOULD.**
  - Why: one wrapper gives every mutation the same report and toast, so a new hook, such as one that cancels an order, cannot forget either.
  - From: D69 (Sentry clause)
- **SENTRY-005. The Sentry root files stay outside the env module.** This adds to DATA-042: `instrumentation*.ts` and `sentry.*.config.ts` read the variables Sentry needs before the app runs, so they read `process.env` themselves. **MUST.**
  - Why: these files run before the app's modules load, so the env module is not there yet, for example when the server starts and Sentry needs its DSN first.
  - From: D30 (Sentry clause)
- **SENTRY-006. Route error boundaries report to Sentry.** This adds to DATA-052: `app/error.tsx` and `app/global-error.tsx` call `Sentry.captureException(error)` in their `useEffect`. **SHOULD.**
  - Why: in a production build Next's `onCaughtError` for an explicit boundary only calls `console.error`, so these calls are the only way a render crash reaches Sentry.
  - Source: Sentry for Next.js, Manual Setup https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
  - From: D41 (Sentry clause)
- **SENTRY-007. Sentry scrubs the URL parameters that ACCESS-004 strips.** Events, transactions, breadcrumbs and session replay pass every URL through one scrub helper in `src/lib/sentry/`. It replaces the value of each parameter that carries a credential or personal data with a filter marker. The list is the one ACCESS-004 reads once and strips. **SHOULD.**
  - Why: an error raised before the page strips a parameter, or the breadcrumb of the first navigation, still holds the full URL, for example a newsletter link that carries the reader's email address.
  - From: A9 (Sentry clause)
- **SENTRY-008. Sentry has one `connect-src` entry and receives the CSP reports.** This adds to ACCESS-011: the CSP lists Sentry's ingest origin as one wildcard entry that covers every regional ingest host, in the change that adds Sentry. The policy's violation reports go to Sentry's endpoint. **MUST** for the `connect-src` entry; **SHOULD** for the report destination.
  - Why: one entry per vendor keeps the policy short, a wildcard on the ingest domain still matches when the project moves to another data region, and a violation report in Sentry shows a blocked request next to the errors it caused.
  - From: A10 (Sentry clause)
- **SENTRY-009. Session replay is an optional consent category.** Sentry's replay integration is referenced in one module under `src/lib/sentry/`, and `Sentry.init` passes no replay integration. Replay is attached only from the consent module ACCESS-015 requires, after the visitor grants its category, and it stops when consent is withdrawn. **MUST.**
  - Why: a session replay records what a visitor does, so it is optional tracking under ACCESS-015, and wiring it in one module lets a test prove it never starts before consent.
  - Check: the Sentry consent guard (see "Checks the template may ship" in `index.md`).
  - From: A14 (Sentry clause)
- **SENTRY-010. Sentry packages update as one Dependabot group.** This adds to TOOLING-006: the weekly Dependabot configuration has one group for the Sentry packages, so they move together. **SHOULD.**
  - Why: the Sentry packages depend on each other at exact versions, so updating one alone installs a second copy of the shared packages, for example two versions of `@sentry/core`.
  - From: C6 (Sentry clause)
