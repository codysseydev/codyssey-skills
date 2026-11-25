---
paths:
  - 'app/**'
  - 'src/lib/**'
  - 'src/providers/**'
  - 'src/constants/**'
  - 'src/types/**'
  - 'src/features/**/hooks/**'
  - 'src/features/**/services/**'
  - 'src/features/**/store/**'
  - 'src/features/**/utils/**'
  - 'src/features/**/types/**'
  - 'src/features/**/*.tsx'
  - 'next.config.*'
  - 'vite.config.ts'
  - '.env.example'
  - 'docs/reference/global-ui-components.md'
---

# Data and Rendering: Prerendering, Seeding, Lazy Loading, State, API Calls, Forms, Errors

How pages render and how data reaches them: prerendered public pages, seeding server data
into client queries, UI that depends on the query string, lazy loading, content images,
client state, forms, API calls and configuration, loading and error states, error
reporting, browser storage and navigation, hydration and caching, and React effects.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.

## Public pages are prerendered

- **DATA-001. A page with API content is prerendered.** It exports
  `dynamic = 'force-static'` and a `revalidate` value the project picks, and it fetches only
  through `serverFetchJson` or `contentService` (DATA-011). **MUST.**
  - Condition: Cache Components is off. Next.js 16 removes the `dynamic` and `revalidate` exports when it is on (https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config).
  - Why: a prerendered page is rendered once and served from the cache, while a page that renders per request pays a full render and an API call on every visit.
  - Source: Why Not Inertia or Livewire vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/37 - Why Not Inertia or Livewire.md
  - From: D1 (core part)

- **DATA-002. A 404 from the API calls `notFound()`; any other failure throws.** Never catch
  a fetch failure and fall back to fetching on the client. Pages fetch through
  `loadOrNotFound(fetcher)` and check an archive page's range with
  `assertInRange(page, items)`, both in `src/lib/pageData.ts` (see STRUCT-029). **MUST.**
  - Why: a degraded page would become the cached one, while a throw keeps the last good render.
  - Source: SEO in a Decoupled Architecture vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/41 - SEO in a Decoupled Architecture.md
  - From: D2

- **DATA-003. A public page that depends on a query string uses the rewrite mechanism.**
  `rewrites().beforeFiles` in `next.config` maps the public URL to
  `app/cached/<name>/[page|variant]`. The page never reads `searchParams`, and no layout,
  route handler or component under it reads `cookies(` or `headers(` either (DATA-064).
  **MUST.** On a rewritten route the server render's `usePathname()` returns the internal path
  (`/cached/...`) and the browser returns the public one, so markup derived from it goes
  through `toPublicPathname` (`src/lib/publicPathname.ts`) first (**SHOULD**).
  - Condition: Cache Components is off. The rewrite keeps the page on the `force-static` model of DATA-001, which Next.js 16 removes when Cache Components is on.
  - Why: reading `searchParams` makes a page render per request, while a rewrite to a path segment lets each variant be prerendered like any other page.
  - From: D3

- **DATA-004. An `app/cached/` route has a dynamic segment and no `generateStaticParams`**,
  so `next build` does not fetch at build time. **SHOULD.**
  - Why: the variants render on the first request and are cached from then on, so the build never depends on the API being reachable.
  - From: D4

- **DATA-005. A page with no API content is plain static.** No `dynamic` export, no fetch,
  no `searchParams`, `cookies()` or `headers()` (a layout or component under it does not read
  the last two either, DATA-064). **MUST.**
  - Condition: Cache Components is off. With it on, Next.js 16 removes the `dynamic` export and decides static rendering another way.
  - Why: a page with nothing to fetch needs no revalidation, and any of these reads would turn it into a per-request render.
  - From: D5

- **DATA-006. A per-request page is listed with a reason in the guard test's
  `DYNAMIC_PAGES` list**, and carries a comment in its file saying why. **MUST** for the
  list; the in-file comment is **SHOULD**.
  - Condition: Cache Components is off. The list holds the pages that export `dynamic = 'force-dynamic'`, an export Next.js 16 removes when Cache Components is on.
  - Why: a per-request page gives up the cache, so the reason has to be written where a reviewer sees it.
  - From: D6

- **DATA-007. `dynamic = 'force-dynamic'` only on the allowlist:** the dynamic pages of
  DATA-006 and any route handler that must run per request. **MUST.**
  - Condition: Cache Components is off. Next.js 16 removes the `dynamic` export when Cache Components is on.
  - Why: every `force-dynamic` route renders on every request, so each one is a decision and not a default.
  - Source: SEO in a Decoupled Architecture vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/41 - SEO in a Decoupled Architecture.md
  - From: D7

- **DATA-008. No `Cache-Control` entry for a prerendered page in `headers()` of
  `next.config`.** The table is for route handlers (a sitemap, a feed) only. **MUST.**
  - Why: Next computes the cache lifetime from `revalidate`, so a hand-written header overrides it.
  - From: D8 (core part)

- **DATA-009. Internal `/cached/` routes stay internal.** Their canonical points at the
  public URL; `robots.txt` disallows `/cached/`; they are not in the sitemap or `llms.txt`.
  **MUST**; the canonical tag is **SHOULD**.
  - Why: the internal path serves the same content as the public URL, so a crawler that finds it indexes a duplicate page.
  - From: D9

- **DATA-010. A page does not call `fetch` directly.** It goes through `serverFetchJson` or
  `contentService`. Do not add a third server fetch path. The rule covers pages only: a
  sitemap or feed helper that does not fetch page data may call `fetch`. **MUST.**
  - Why: the two helpers carry the timeout, the retry policy and the typed error of DATA-011, and a direct `fetch` skips all three.
  - From: D10

- **DATA-011. Pick the server fetch helper by who reads the data.** Use `contentService`
  (`src/lib/content.server.ts`, wrapped in React `cache()`; one retry, only on a network
  failure or a 5xx, never after a timeout, a 4xx or an unreadable body; all attempts share one
  10 s deadline) for content needed by both `generateMetadata` and the render. Use
  `serverFetchJson` (`src/lib/serverFetch.ts`, no retry, 10 s) for a single listing or
  document only the render reads. Both throw `UpstreamApiError`
  (`src/lib/upstreamApiError.ts`); read `error.status` or call `isNotFoundError`, never
  `error.message`. A 4xx is never retried. **SHOULD.**
  - Why: React `cache()` lets `generateMetadata` and the page render share one request to the API.
  - Source: SEO in a Decoupled Architecture vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/41 - SEO in a Decoupled Architecture.md
  - From: D11

## Seeding server data into client queries

- **DATA-012. Seed client queries only with the helpers in `src/lib/archiveSeed.ts`:**
  `seedUpdatedAt('fresh')` (same for every visitor), `perViewerSeedUpdatedAt()` (signed-out
  answer, member fields differ), `seedablePage(page, 'fresh')` (archive page). A gate waiting
  on `isFetchedAfterMount` also opens for a signed-out visitor, for whom no fetch runs.
  **MUST.**
  - Why: the seed's timestamp decides whether the client refetches, so one module sets it the same way for every query.
  - Source: XState Store and TanStack Query vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/39 - XState Store and TanStack Query.md
  - From: D12

- **DATA-013. Draw fetch-state UI only through `FetchingIndicator`** from
  `@/features/global-ui/FetchingIndicator/FetchingIndicator`, never from
  `{isFetching && ...}` or `isRefetching`. Any other use of `isFetching` in markup carries the
  same risk (see DATA-062). **MUST.**
  - Why: a signed-in hydrating client reports `isFetching` where the server rendered idle, which fails hydration.
  - From: D13

- **DATA-014. Do not refetch on mount to refresh a seed, and do not fetch on the client what
  the server already rendered.** **SHOULD.**
  - Why: the server already made that request, so a second one costs an API call and can replace seeded markup right after hydration.
  - From: D14

- **DATA-015. Seeded data holds only what the UI reads.** Anything passed to `initialData`, a
  server seed or a client-component prop is serialized into the HTML. It carries the fields
  the UI reads, never the raw API response, and no "fallback" copy of the response.
  **SHOULD.**
  - Why: a raw response would ship every field in the page HTML, including HTML that skipped the page's own transform.
  - From: D72

## Query-string-dependent UI

- **DATA-016. Never call `useSearchParams()` at section or page level.** Read
  `window.location.search` where the value is used (an event handler or effect), or isolate
  the one piece that renders from it in its own `<Suspense fallback={null}>`. **MUST.**
  - Why: on a prerendered route `useSearchParams()` renders everything up to the nearest `Suspense` boundary on the client, so at page level it drops the prerendered content.
  - Check: guard-test row DATA-016: no source file calls `useSearchParams()` unless it is on the allowlist.
  - From: D15

- **DATA-017. UI state kept in the URL is written with the history API.** A filter, tab or
  toggle that belongs in the URL is read in an effect (DATA-016) and written with
  `history.pushState` or `replaceState`, one hook per piece of state, with a `popstate`
  listener. The hook says why `router.push` is not used. Reading and writing go through one
  `urlFor<State>` helper that keeps other params and the hash. The hook that reads a URL value
  (`sort`, `tab`, `filter`) parses it against the allowed list and returns a default for an
  absent or unknown value, with no `as` cast. **SHOULD.**
  - Why: `router.push` fetches a new RSC payload on every click, and the history API changes the URL without a request.
  - Source: Allowlist Sort Columns With an Enum https://codyssey.dev/quick-tips/allowlist-sort-columns-with-an-enum
  - From: D73

- **DATA-018. A URL or form value that reaches API params is narrowed first.** A value read
  from the URL or a form that becomes an API field or size parameter (`sort`, `direction`, a
  filter key, `limit`, `page_size`) is narrowed to a typed allowlist (a union or an enum) with
  a default, in one parse function, before it is passed as `params` (DATA-048). **SHOULD.**
  - Why: the client then picks a name the app published, and the API never receives a field or size it did not offer.
  - Check: a grep finds `searchParams`, `URLSearchParams` and `window.location.search` reads whose value reaches `apiClient` or `serverFetchJson` `params` without a `parse*` or `is*` function; a unit test checks that the parse function returns the default for an unknown value.
  - Source: Stop Writing Laravel APIs Like This vault: Content/Insights/Stop Writing Laravel APIs Like This.md
  - Source: Allowlist Sort Columns With an Enum https://codyssey.dev/quick-tips/allowlist-sort-columns-with-an-enum
  - From: NX-07

## Lazy loading

- **DATA-019. `next/dynamic` and `React.lazy` are for two things only:** client-only UI that
  renders nothing on the server (a closed dialog, a command palette), and heavy code with a
  fallback that fills the same box. Never wrap server-rendered content in a lazy boundary. A
  heavy library used only in an event handler is imported inside that handler. The dialog the
  user sees when a lazy chunk fails to load is imported statically from `app/layout.tsx`,
  never through `next/dynamic` or `React.lazy`. This rule wins over Vercel
  [`bundle-dynamic-imports`](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/bundle-dynamic-imports.md).
  **MUST.**
  - Why: a lazy boundary around server HTML renders after hydration and shifts the layout.
  - Check: guard-test row DATA-019: `next/dynamic` and `React.lazy` appear only in allowlisted files.
  - Source: Lazy Loading https://nextjs.org/docs/app/guides/lazy-loading
  - From: D16 (core part)

## Content images

- **DATA-020. Content images go through `next/image`; never preload originals with
  `new Image()`.** **MUST.**
  - Why: `next/image` serves a resized copy when it is needed, and a `new Image()` preload downloads the full original outside it.
  - Check: guard-test row DATA-020: no source file preloads an original image with `new Image()`.
  - From: D18 (core part)

## State management

## Forms

## API calls and configuration

## Loading, success and error

## Reporting errors

## Browser storage, session and navigation

## Hydration, layout and caching

## React and effects

## What is NOT a violation
