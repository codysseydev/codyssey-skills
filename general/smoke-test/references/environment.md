# Staging environment

Fill in every `<fill in>` before the first run. Write `n/a` for anything the app does
not have (no CMS, no payments, no teams); the skill skips the phases that need it. Keep
credentials out of this file: name the environment variable that holds each one
instead.

## Surfaces

| Surface | URL | Notes |
|---|---|---|
| Frontend | `<fill in>` | |
| API | `<fill in>` | Base path, for example `/api` or `/api/v1` |
| Admin panel | `<fill in>` | |
| CMS, if any | `<fill in>` | |

Admin credentials: `<fill in: the env var names, or "ask the user">`.

## Payment provider

- Provider and test mode: `<fill in>`
- Test card or payment method: `<fill in>`
- Where webhook deliveries can be inspected: `<fill in>`

## Reading email

How to read the emails a test account receives: `<fill in: a mail-catcher URL, the
provider's message API and the env var holding its token, or a plus-addressed inbox>`.

## Error tracker

- Tool and project: `<fill in>`
- How to list open issues for the baseline in phase 1: `<fill in>`

## Pages to sweep (phase 12)

Admin and CMS paths to request in one pass, one per line: `<fill in>`

## Product features for phase 9

- `<fill in>`

## Test accounts

Passwords come from `<fill in: env var name>`, never from this file. New accounts
follow the pattern `<fill in, for example qa+staging-tN@example.com>`.

| Account | What it is for | State after the last run |
|---|---|---|
| t1 | `<fill in>` | `<fill in>` |

## Project-specific gotchas

- `<fill in: wrong routes the agent will guess, known flaky requests, historical data
  to ignore>`
