---
name: nextjs-kanon
description: >-
  The Kanon for Next.js: a fixed, project-agnostic doctrine for the frontend of a
  product with its own API. Load this BEFORE writing or editing code in a Next.js App
  Router app of your own when the user invokes /nextjs-kanon, says "kanon" or "the
  canon" in a Next.js repo, or starts a greenfield Next.js frontend. It fixes the
  stack (App Router, React Compiler, Tailwind 4, TanStack Query, React Hook Form,
  Vitest) and prescribes static-first pages, one API client, no Server Actions, typed
  boundaries and strict tests as MUST/MUST NOT requirements that deliberately IGNORE
  the host project's own conventions. Do NOT auto-apply this in a codebase with
  established team standards (e.g. an employer's monorepo) unless the user explicitly
  asks for the canon there. This is the rulebook for WRITING code; to AUDIT existing
  changes against it, use nextjs-kanon-audit instead.
---

# Next.js Kanon

A fixed doctrine for building the frontend of a product for the long term. It is
deliberately project-agnostic: when invoked, it overrides the host project's conventions
entirely. Do not read the project's CLAUDE.md, style guides, or sibling files as a rule
source; the canon is the only authority. If following the canon would conflict with
something the project does, follow the canon and tell the user about the conflict.

The rules are derived from `codysseydev/codyssey-frontend` at commit `abdfd9f2`. Each rule
names the source rule it came from. `references/index.md` holds the id of every rule.

## Normative language

Rules use RFC-2119 keywords, and they mean it:

- **MUST / MUST NOT**: absolute. Never violate one, never "adapt" it to the project.
  If a MUST cannot be satisfied (missing package, framework limitation), stop and tell
  the user instead of quietly deviating.
- **SHOULD / SHOULD NOT**: follow unless there is a concrete, stated reason not to.
  Every deviation gets one sentence of justification in your summary to the user.
- **MAY**: permitted, use judgment.

## App premise

- The app is the frontend of a separate API with its own cookie auth.
- No Server Actions.
- Public pages are static first.
- Every API path lives in one file, `src/constants/apiRoutes.ts`.
- Rendering CMS HTML or markdown is an add-on, not core.

## Fixed core stack

The core rules assume this stack, as the Laravel Kanon assumes PHPUnit:

- Next.js App Router.
- React with the React Compiler on.
- Tailwind 4 with tailwind-merge.
- TanStack Query for server data.
- Client-only UI state in a small external store with selector subscriptions. XState
  Store is the named implementation. Zustand maps one to one: a Zustand store read
  through selectors takes the place of an XState Store.
- React Hook Form with a Standard Schema validator. Zod is the named implementation.
- Vitest with Testing Library.
- Oxlint.
- Oxfmt, with a documented swap to Prettier.
- Storybook.
- knip.
- pnpm.
- GitHub Actions CI with Dependabot.
- Node version pins.

## How to apply while writing

1. Identify what you are about to create or edit, and read the matching files in this
   skill's `references/` folder (next to this SKILL.md) BEFORE writing. Read
   `design-principles.md` for every production file regardless, and `structure.md` for
   any new file.
2. Check the add-on and overlay table below. Read each file whose package or script the
   project has.
3. Follow MUST/MUST NOT rules absolutely; note SHOULD deviations with justification.
4. When you finish, list any canon rules you could not satisfy and why.

| You are writing | Read |
|---|---|
| A new file or feature folder, exports, imports between features, server and client components, file names, type and enum files, docs and rule files | `references/structure.md` |
| Any production TypeScript (applies to every change) | `references/design-principles.md` |
| Pages, layouts, route handlers, data fetching, query seeding, search params, lazy loading, client stores, forms, API calls, environment config, loading and error states, error reporting, browser storage, effects | `references/data-and-rendering.md` |
| Types, tests, stories, and what a change ships with | `references/types-and-tests.md` |
| Components, Tailwind classes, design tokens, responsive layout, accessibility, links, images, page metadata, structured data | `references/ui-a11y-seo.md` |
| Redirects, URLs from the API, the auth session, route guards, gated content, security headers, scripts, secrets, consent | `references/access-and-security.md` |
| `package.json`, the lockfile, TypeScript config, lint and format config, CI workflows, Storybook config, scripts | `references/tooling.md` |
| Code that uses an add-on, or the Cloudflare deploy | the file the table below names |

## Add-ons and the overlay

An add-on file loads only when the project uses its package or script. Package add-ons
load when the package is in `package.json`. Turnstile and Plausible load from a script
tag, not a package, so they are detected by the script origin in the code.

| File | Loads when |
|---|---|
| `references/add-ons/untrusted-content.md` | `react-markdown`, `rehype-sanitize` or another HTML sanitizer is in `package.json` |
| `references/add-ons/syntax-highlighting.md` | `react-syntax-highlighter` is in `package.json` |
| `references/add-ons/sentry.md` | `@sentry/nextjs` is in `package.json` |
| `references/add-ons/turnstile.md` | `grep -rlE 'challenges\.cloudflare\.com/turnstile' src app` finds a file |
| `references/add-ons/radix.md` | a `@radix-ui/*` package is in `package.json` |
| `references/add-ons/heroicons.md` | `@heroicons/react` is in `package.json` |
| `references/add-ons/plausible.md` | `grep -rlE 'plausible\.io/js' src app` finds a file |
| `references/add-ons/axios.md` | `axios` is in `package.json` |
| `references/add-ons/cmdk.md` | `cmdk` is in `package.json` |
| `references/add-ons/mutation-testing.md` | `@stryker-mutator/core` is in `package.json` |
| `references/overlays/cloudflare.md` | `@opennextjs/cloudflare` is a dependency, or `wrangler.jsonc` exists |

The Cloudflare overlay holds the rules for deploying to Cloudflare Workers through
OpenNext. Its entries are tagged `OpenNext` or `Workers`, so another deploy overlay
touches only the tagged rules.

## Vendored skills

A project installs these upstream skills from their own repositories. Nothing is copied
into this repo. The template's `skills-lock.json` pins a ref for each entry.

- Next.js's bundled docs and its managed `AGENTS.md` block.
- Skills from `vercel/next.js`. The template repository decides which ones.
- From `vercel-labs/agent-skills`: `vercel-react-best-practices`,
  `vercel-composition-patterns` and `web-design-guidelines`. Their MIT license rests on
  the repository README only. The repository has no LICENSE file.
- `tdd` from `mattpocock/skills`.
- `systematic-debugging` and `verification-before-completion` from `obra/superpowers`.

Pack rules win over every vendored skill. The clash list names each known clash.

## Clash list

| Pack id | Source id | Rule | Overrides | How the pack reads it |
|---|---|---|---|---|
| DATA-019 | D16 | Lazy loading in two cases only | Vercel [`bundle-dynamic-imports`](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/bundle-dynamic-imports.md) (CRITICAL) | MUST, citing the Next.js [lazy loading guide](https://nextjs.org/docs/app/guides/lazy-loading) |
| DATA-070 | D65 | No Server Actions | Vercel [`server-auth-actions`](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/server-auth-actions.md) (CRITICAL), marked not applicable | MUST, citing the Next.js [data security guide](https://nextjs.org/docs/app/guides/data-security). The source rule says SHOULD. |
| DATA-065 | D58 | No `loading.tsx` | The [`loading.js`](https://nextjs.org/docs/app/api-reference/file-conventions/loading) file convention in the bundled docs (no Vercel rule) | MUST for the file, SHOULD for the Suspense half, with a condition line on the Suspense direction of the newer docs |
| DATA-067 | D62 | No hand memoization | Vercel [`rerender-memo`](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/rerender-memo.md) | SHOULD, with a condition line: the [React Compiler](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler) is on, which the fixed stack does |
| UI-053 | U63 | Above-the-fold images | The [`next/image` docs](https://nextjs.org/docs/app/api-reference/components/image) (no Vercel rule) | Narrowed: never `priority`, `preload` only for a known LCP image, otherwise `loading="eager"` with `fetchPriority="high"` |

## Companions

- `nextjs-kanon-audit` audits a branch, PR, or diff against these same references.
- The canon covers standards, not correctness: keep using normal judgment (and
  /code-review) for bugs and security.
