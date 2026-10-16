---
name: smoke-test
description: >-
  Run a pre-release smoke test of a staging environment: a phased Playwright walk
  of the app's user-facing and admin surfaces that exercises sign-up and sign-in, every
  revenue path on the payment provider's test mode, access rules, email, and admin
  actions, then compares the error tracker against a baseline taken at the start.
  Use when the user asks to smoke test staging, run the pre-release test, verify
  staging before a production release, or re-verify after a staging deploy. Not for
  local development testing or running the automated test suite.
---

# Pre-release staging smoke test

A full walk of the staging environment with the Playwright MCP browser tools, run
before each production release. The automated test suite proves each unit works; this
proves the deployed pieces work together: the frontend, the API, queues, the payment
provider's webhooks, and email delivery.

It needs the Playwright MCP server (`browser_navigate`, `browser_snapshot`,
`browser_click`, `browser_evaluate`). If it is not connected, tell the user and stop.

## Before you start

This skill is a procedure. Everything specific to the project lives in two files next
to it:

- `references/environment.md`: URLs, test accounts, how to read email, the payment
  sandbox, the error tracker, and the project's own automation gotchas.
- `references/known-findings.md`: what earlier runs found and how each finding ended.

If `references/environment.md` still contains `<fill in>` placeholders, stop and ask
the user to fill it in. Do not guess URLs or accounts. A section marked `n/a` means the
app does not have that feature: skip the phases that need it.

**Credentials never go in these files.** Read passwords and API tokens from the
environment variables `environment.md` names, or ask the user at the start of the run.
Do not write a credential into a file, a finding, or the report. Redact session
cookies, magic-link and password-reset URLs, and API tokens from findings too. When
you record a new test account, write its email and state only.

**Staging only.** Before the first purchase, refund or deletion, confirm the URL is the
staging environment from `environment.md` and the payment provider is in test mode.
Never run this skill against production.

**Read `references/known-findings.md` before reporting anything.** A finding that was
fixed, closed as intended behaviour, or parked must not be reported again as new.
Re-reporting it costs a fix cycle that nobody needs.

## Phases

Work through the phases in order. Skip a phase only when the application has no such
feature, and say so in the report. Each phase lists what to exercise and what passing
means.

1. **Environment readiness.** Ask the user which deploys (commits, PRs or versions;
   backend and frontend separately if they ship separately) this run verifies, and
   confirm those are the ones live. Confirm
   queue workers are processing. Record the error tracker's open issues as the
   baseline for phase 12. If a data or content migration shipped, confirm its
   post-deploy steps ran.
2. **Anonymous browsing.** Every public page type, the pricing page, and the legal
   pages. Paid or members-only content shows whatever the product promises
   anonymous visitors (a preview, a sign-up prompt), never an error page.
3. **Auth lifecycle.** Sign up (and where the user lands afterwards), email
   verification and its return path, password reset, sign out, and sign in with a
   wrong password (the error must render, not fail silently).
4. **Subscription revenue path.** On the payment provider's test mode: checkout,
   webhook received, access unlocked, plan or interval change (check proration),
   cancel (access kept until the period ends, if that is the policy), resume, and
   any pause flow. Check the account and billing pages after each step.
5. **One-time purchases.** Buy one item end to end. Access unlocks and billing
   history records it.
6. **Teams and seats.** Create a team and its subscription, then invite, accept,
   decline, resend and cancel invitations, change roles, change seat counts (check
   proration), and remove a member (their access goes immediately).
7. **Access matrix.** For each content or feature type, check what each kind of user
   sees: anonymous, free, individual subscriber, team member, admin. Every cell
   matches the product's rules.
8. **Billing documents.** Billing history, invoice and receipt downloads, and refund
   requests if members can start them.
9. **Product features.** The features that make the product what it is (for example
   uploads, search, notifications, progress tracking). `environment.md` lists them.
10. **Email sweep.** Every transactional email the earlier phases triggered arrives,
    with the right copy, working links, and no unrendered template syntax.
11. **Admin actions.** As an admin, do what support does day to day (verify a user,
    grant and revoke access, issue a refund) and check that the member's state and
    history reflect each action.
12. **Health sweep and error diff.** Request every page listed under "Pages to sweep"
    in `environment.md` in one scripted pass (`browser_evaluate` with `fetch()` over
    the list, after signing in) and report every non-200. If the app has search, check
    that it returns only published content. Compare the error tracker with the phase 1
    baseline. Zero new issues is the pass bar.

## Automation gotchas that apply to most apps

- **Bot protection** (Turnstile, reCAPTCHA, hCaptcha) blocks the automated browser,
  often silently. Flag the affected form for a manual check. It is not a bug.
- **Close modals** before the next click. A modal left open blocks later pointer
  events, and the failure looks like a broken button.
- **Deploy skew.** Right after a frontend deploy, cached HTML can reference JavaScript
  bundles that no longer exist and return 404. Reload once. Report it only if it
  persists.
- **Pin the build before measuring a fix.** Caches can serve different routes from
  different builds right after a deploy. Find a string that exists only in the newest
  commit and reload with a fresh query string (`?v=2`) until you see it.
- **Asynchronous results** (anything a queue job produces) need the full wait the UI
  uses before you call them broken. Install a `MutationObserver` before the click when
  the result is a toast that dismisses itself.
- **Use fresh data for once-only actions.** Repeating an action that only counts once
  (a first purchase, a first-time completion, a one-time reward) produces no result and
  looks like a failure.

## Test accounts

Use the accounts `environment.md` lists and check each one's state on arrival, because
earlier runs change it. Create new accounts with the naming pattern it gives, and add
each new account and its final state to `environment.md` at the end of the run.

## Reporting

- Number findings F1, F2, and so on. Give each a severity (P0 blocks the release, P1
  should be fixed before release, P2 can wait), the steps to reproduce, and the
  account used.
- Keep product questions (behaviour that works as built but may be wrong) in a
  separate list numbered Q1, Q2, and so on.
- Check every candidate finding against `references/known-findings.md` first.
- End with what passed, the findings, and a short list of what must be fixed before
  the release.
- After the run, add each new finding to `references/known-findings.md`.
