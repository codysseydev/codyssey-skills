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
  - Why: the seed's timestamp decides who refetches: a signed-in member gets one credentialed refetch on mount, and a signed-out visitor trusts the seed.
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

- **DATA-021. Pick state by what it is.** TanStack Query for server state and caching; a
  small external store with selector subscriptions (XState Store is the named
  implementation) for complex UI state, feature-level state and async flows shared across
  components, including an optimistic update (DATA-032); local React state (`useState`,
  `useRef`) for simple UI state. No store for simple toggles or one-off local state. Server
  data is never copied into a store or `useState` as state the UI reads, beyond the in-flight
  optimistic value of one store action; a list page's store holds only UI state such as
  `visibleCount`. **SHOULD.**
  - Why: a copy of server data in a store goes stale when the query refetches, so the page shows the previous data for a frame.
  - Source: XState Store and TanStack Query vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/39 - XState Store and TanStack Query.md
  - From: D19 (core part)

- **DATA-022. A feature exposes one combined hook** (`use<Feature>`) that joins query data,
  store state, store actions (including async ones) and handlers, so the entry component has
  one source. **SHOULD.**
  - Why: the query never knows about page state and the store never knows about retries, and the hook is the one place they meet.
  - Source: XState Store and TanStack Query vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/39 - XState Store and TanStack Query.md
  - From: D20

- **DATA-023. Define each query once with `queryOptions()`.** The key, `queryFn` and shared
  options live in one function in the feature's `hooks/` folder (`<thing>QueryOptions(slug)`),
  exported when a file besides the hook reads or writes the query (STRUCT-032). The hook,
  seeding, `invalidateQueries` and `setQueryData` all use it. No inline key arrays, no second
  definition of the same key. Every query hook file defines its query with `queryOptions()` or
  `infiniteQueryOptions()`. A server seed is a parameter of the factory, so the seed and the
  key are written once. Code that reads every query under a shared key prefix
  (`getQueriesData`) checks each entry's shape before using it, because different queries
  under one prefix can hold different shapes (a list and infinite pages). **SHOULD.**
  - Why: one options object passes to `useQuery` and to the imperative APIs, so the key and the fetcher cannot drift apart.
  - Source: XState Store and TanStack Query vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/39 - XState Store and TanStack Query.md
  - Source: Query Options https://tanstack.com/query/latest/docs/framework/react/guides/query-options
  - From: D21

- **DATA-024. A hook that wraps a query is named `use<Thing>Query`** (`useThingsQuery` for a
  list) and lives in `hooks/`. The combined hook (DATA-022) is `use<Thing>`. **SHOULD.**
  - Why: the name tells a reader whether a hook returns one query or the joined feature state.
  - From: D22

- **DATA-025. Render "no data yet" from `isPending`, failure from `isError`, and check
  `isError` first.** Use `isLoading` only when the code needs "pending and fetching" (a
  spinner for an enabled query). When an endpoint answers "none" with a 404 (an optional
  record the member has not created yet), the service turns it into `null`, so the query
  never errors for an expected state. A list endpoint that answers 200 with an empty array
  needs no `null`. **SHOULD.**
  - Why: an errored query with no data flips back to pending on the next fetch, so a UI that tests `isPending` first shows its loading state again after a failure and can refetch in a loop.
  - Source: Migrating to TanStack Query v5 https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5
  - From: D23

- **DATA-026. Retry is decided once.** `QueryProvider` sets the default through
  `shouldRetryQuery` (`src/lib/queryRetry.ts`): no retry on a 4xx response (a 429 included,
  DATA-071), up to three retries otherwise, with exponential backoff. It finds the status on
  the error or on its `cause`, so a service that wraps the HTTP failure needs no retry rule of
  its own. A hook sets `retry` only for a reason written in a comment, and never decides by
  string-matching `error.message` for a status. Recognise a not-found with
  `isNotFoundError`; add a typed error where a new case is needed; where the API sends a
  stable error `code`, check the code, never the sentence. Mutation hooks decide their own
  retry through `shouldRetryMutation` (DATA-027). **SHOULD.**
  - Why: a query is never retried after a 4xx, because the same request would get the same answer.
  - Source: XState Store and TanStack Query vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/39 - XState Store and TanStack Query.md
  - From: D24

- **DATA-027. A mutation is retried at most once, and only after a network error or a 5xx.**
  The default lives in the QueryClient provider, next to the query retry default of
  DATA-026. A write that is not idempotent and carries no idempotency key is not retried (see
  DATA-032). **SHOULD.**
  - Why: a write that reached the server before the network failed runs twice when it is retried, so only a write that is safe to repeat gets the one retry.
  - Check: a unit test of `shouldRetryMutation`: a 4xx gives no retry, the first 5xx retries, the second 5xx does not, and a request with no response retries once; a grep finds no `retry:` above 1 in a `useMutation`.
  - Source: XState Store and TanStack Query vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/39 - XState Store and TanStack Query.md
  - Source: The Decorator Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-decorator-pattern
  - From: NX-06

- **DATA-028. Every store exports a typed actions object**, with event names from an enum in
  `types/*.enums.ts`. Components, hooks and services call the actions; only the store file
  sends events to the store (`store.send(...)` in XState Store). An event that sets one field
  takes the field name and a value of that field's type, never
  `field: keyof State; value: string`. Event names follow DATA-029. **MUST.**
  - Why: the actions object is the store's whole public surface, and a string-typed field and value let any field take any value past the type checker.
  - Source: XState Store and TanStack Query vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/39 - XState Store and TanStack Query.md
  - From: D25

- **DATA-029. A store event and its action are named in the past tense for what happened**
  (`lessonCompletionToggled`, `cancelRequested`), not for the field they write (`SetStatus`,
  `UpdateFlag`). **SHOULD.**
  - Why: a name that says what happened keeps the decision inside the store, while a setter name hands the caller the store's internals.
  - Check: a guard test fails when a member of an event enum in `types/*.enums.ts` that feeds a store `on:` block matches `^(Set|Update)[A-Z]`; in review, an action that takes `(field, value)` is a setter.
  - Source: Tell, Don't Ask https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/tell-dont-ask
  - Source: Name Your Events in the Past Tense vault: Content/Quick Tips/20 - Name Your Events in the Past Tense.md
  - From: NX-09

- **DATA-030. A store resets its state on unmount when the state is feature-scoped.**
  **SHOULD.**
  - Why: a store created at module scope outlives the page, so without a reset the next visit starts from the last visit's state.
  - From: D26

- **DATA-031. A store is seeded from server data or props once, in an effect behind an
  `is<Thing>Initialized` flag.** Never re-sync it in the render body. **SHOULD.**
  - Why: a re-sync in the render body writes the server copy over what the user is typing on every render.
  - From: D55

- **DATA-032. One owner per optimistic update: a store action or a mutation hook, never a
  component.** An optimistic update cancels in-flight queries for the key and snapshots the
  old value, restores the snapshot on error, and invalidates the key when settled. The
  sequence lives in `runOptimisticUpdate` (`src/lib/optimisticUpdate.ts`), which both owners
  call. Either a store action or a `useMutation` hook may own a server-state change; on the
  `useMutation` path a `useFeatureMutation` wrapper (`src/lib/useFeatureMutation.ts`) owns
  the toast. A call that cannot be repeated (a single-use verification link, an order, a sent
  message) is not started from an effect keyed on state alone: start it from a click, or
  guard it so a remount or a Strict Mode re-run cannot send it twice (a ref set before the
  call, or a mutation key). **SHOULD.**
  - Why: one owner runs the whole cancel, snapshot, restore and invalidate sequence, so a failed save always rolls back.
  - Source: XState Store and TanStack Query vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/39 - XState Store and TanStack Query.md
  - From: D69 (core part)

- **DATA-033. Query timings are named, and defaults are not repeated.** A query hook sets
  `staleTime` and `gcTime` from named constants in `src/constants/queryTimings.ts`
  (`STALE_SHORT`, `STALE_MEMBER`, `STALE_MEDIUM`, `STALE_HOURLY`, `STALE_STATIC`, `GC_SHORT`,
  `GC_MEDIUM`, `GC_DAY`, `GC_STATIC`), and only when the value differs from the
  `QueryProvider` default (60 s stale, 5 min gc). It does not repeat `retryDelay`,
  `refetchOnMount: true`, `refetchOnReconnect: true` or `refetchOnWindowFocus: true` (the
  defaults), and it sets no option that cannot take effect (for example
  `placeholderData: (previousData) => previousData` on a query whose key never changes).
  `staleTime: 0` stays a literal where a poll or `fetchQuery` must skip the cache.
  **SHOULD.**
  - Why: a named timing says what kind of data it is for, and a repeated default hides which hooks really differ from it.
  - Source: XState Store and TanStack Query vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/39 - XState Store and TanStack Query.md
  - From: D74

## Forms

Every form uses React Hook Form with a Standard Schema validator. Zod is the named
implementation.

- **DATA-034. Every form uses React Hook Form with a Zod schema passed through its
  resolver** (`zodResolver` from `@hookform/resolvers`). A single-field control (a search
  box, a newsletter box) uses it too, so one pattern covers all forms. **SHOULD.**
  - Why: one pattern for every form means one way to read a form's values, errors and submit state.
  - From: D43

- **DATA-035. Form schemas.** A form's schema lives in `utils/<form>Schema.ts` and exports
  `<form>Schema`, a `z.object`. A field shared by forms is defined once in `src/lib` and
  composed, never retyped: `emailField` (`src/lib/emailSchema.ts`) and `passwordField`
  (`src/lib/passwordValidationSchema.ts`, which holds the only minimum-length rule).
  `passwordValidationSchema` is the base object schema; a form that also needs an email
  extends it with `passwordValidationSchema.extend({ email: emailField })`. Import as
  `import * as z from 'zod'`. Messages are full phrases ("<Field> is required", "Please enter
  a valid email address", "<Field> must be at least N characters", "Passwords must match").
  A create form and an edit form do not share one schema that branches on a mode flag (a
  `.refine` that reads the mode); each has its own `z.object`, composed from the shared
  fields. A field the submit handler reads unconditionally is required in the schema (no
  `.optional()`); `.optional()` is only for a field the service treats as optional, with a
  default chosen on purpose. The `z.infer` type of the schema matches the service parameter
  without a cast. A heavy schema used only on submit is imported inside the handler.
  **SHOULD.**
  - Why: a field retyped in two schemas drifts until one has a regex nobody remembers writing, and a schema per form never branches on which form it serves.
  - Source: Input Validation vs Domain Validation: Where Each Belongs https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/input-validation-vs-domain-validation
  - Source: Put the Date Rule in a DateRange vault: Content/Quick Tips/51 - Put the Date Rule in a DateRange.md
  - Source: One Form Request per Write Action vault: Content/Quick Tips/06 - One Form Request per Write Action.md
  - Source: Require Every Field the Controller Reads vault: Content/Quick Tips/48 - Require Every Field the Controller Reads.md
  - From: D44

- **DATA-036. A form schema checks shape and format only.** It checks presence, type, format
  and length. Uniqueness, availability, entitlement and pricing stay with the API, and the
  form shows the API's 409 or 422 field errors (DATA-037). A limit copied from the backend
  carries a comment that names the backend request class. **SHOULD.**
  - Why: "email is already taken" cannot live in a schema, because it needs a lookup only the API can make.
  - Check: a grep of `utils/*Schema.ts` fails a `.refine(` or `.superRefine(` whose callback imports a service or `apiClient`, and any async refine; it flags a literal limit (`.min(`, `.max(`, `.regex(`) with no comment naming its backend source.
  - Source: Input Validation vs Domain Validation: Where Each Belongs https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/input-validation-vs-domain-validation
  - Source: Value Objects https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/value-objects
  - Source: Keep the Form Request Rule When the Value Object Checks It Too vault: Content/Quick Tips/52 - Keep the Form Request Rule When the Value Object Checks It Too.md
  - From: NX-05

- **DATA-037. Submit flow.** `onSubmit` calls a function from the feature's `services/`,
  never `apiClient` directly. On failure it maps the error with `parseApiFormError`, shows it
  with `showToast(..., 'error')` and puts the message and the field errors into the form
  library's status and error state; success shows a toast and resets or navigates. A request
  that two forms send (a sign-up box in the header and one in the footer) is one service
  function both forms call. Service location follows DATA-039. **SHOULD.**
  - Why: the service owns the request and the form owns what the user sees, so one failure reads the same way on every form.
  - From: D45

- **DATA-038. The form library owns field values, errors and submitting state.** A store
  holds only UI that outlives the form (a show-password toggle, for example), never a copy of
  the values. **SHOULD.**
  - Why: two copies of a field value drift apart, and the form library already tracks values, errors and submit state.
  - From: D46

## API calls and configuration

- **DATA-039. Browser API calls use the configured `apiClient` from `src/lib/apiClient.ts`**,
  never a raw HTTP client instance or `fetch`. Calls live in `services/`; hooks call services;
  components never import `apiClient`. **SHOULD.** A service is an exported object of
  functions (`export const thingService = { fetchThing }`), not a class and not a
  `new XService()` singleton. **SHOULD.**
  - Why: the configured client carries the base URL, the credentials and the error handling, and the service layer is the one place a test stubs the API.
  - Check: guard-test row DATA-039: `apiClient` is imported only from `*.service.ts` and `*.service.tsx` files.
  - From: D27 (core part)

- **DATA-040. Handle API errors in the service or hook layer** and show a user-friendly
  message, through the one mapper of DATA-047. **SHOULD.**
  - Why: a failure is translated into a user-friendly message once, in the layer that knows the API, and the UI shows that message.
  - Source: Exception Handling as Design https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/exception-handling-as-design
  - From: D28

- **DATA-041. Response types come from the service call** (`apiClient.get<T>`); see
  TYPES-003. Where the UI needs a different shape, map it once at the boundary (DESIGN-006).
  **SHOULD.**
  - Why: the type is declared where the response arrives, so every caller reads the same shape and no component reshapes it again.
  - From: D29

- **DATA-042. Environment variables are read in one module.** `src/lib/env.ts` exports
  typed, named values (`API_BASE_URL`, `SITE_URL`) and fails fast when a required one is
  missing. No `process.env.*` elsewhere in `src/` or `app/`, except `NODE_ENV` and the
  variables Next.js reads itself. Read each `NEXT_PUBLIC_*` variable with its literal name
  (`process.env.NEXT_PUBLIC_API_BASE_URL`); Next inlines only literal reads, so no dynamic
  lookup. `NEXT_PUBLIC_*` and `NODE_ENV` are inlined at build time. `APP_ENVIRONMENT` lives in
  the module. `next.config` reads the variables the build needs before the app runs and stays
  outside the module. **MUST.**
  - Why: a missing variable fails at startup with its name, instead of later as an undefined URL deep in a request.
  - Check: guard-test row DATA-042: environment variables are read only through `src/lib/env.ts`.
  - From: D30 (core part)

- **DATA-043. A `NEXT_PUBLIC_` variable holds only a value meant to be public, and every
  variable the code reads is in `.env.example`.** Never a secret, token or private key. One
  name per value: the API address is `NEXT_PUBLIC_API_BASE_URL` everywhere. **SHOULD.**
  - Why: Next inlines every `NEXT_PUBLIC_` variable into the browser bundle, so anyone who loads the page can read it.
  - From: D38

- **DATA-044. Every API path is a constant in `src/constants/apiRoutes.ts`.** A service, hook
  or component writes no `/api/` literal; a path with a value is a function there that
  encodes the value (DATA-048). A plain `fetch` on a server (`content.server.ts`, a sitemap or
  a feed) builds its query with `withQuery` (`src/lib/withQuery.ts`). Not a violation:
  `/api/` strings in tests, stories, docs and comments. **SHOULD.**
  - Why: if the backend renames a route, one constant changes.
  - Check: guard-test row DATA-044: no `/api/` string literal outside `src/constants/apiRoutes.ts`; tests, stories, docs and comments are exempt.
  - Source: Feature Modules vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/38 - Feature Modules.md
  - From: D49

- **DATA-045. A service takes its inputs as arguments.** A function in `services/` receives
  what it sends as parameters. It does not read a store snapshot and does not write to a
  store; the hook or form handler passes the values in. **SHOULD.**
  - Why: a service that reads a store needs a store set up in every test, so a value that lives in a store (a selected filter, say) is read by the caller and passed in.
  - Source: Don't Read Auth::user() Inside a Use Case https://codyssey.dev/quick-tips/dont-read-auth-user-inside-a-use-case
  - Source: The Command Pattern: Commands and Command Handlers https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/command-pattern-commands-and-command-handlers
  - Source: Why Your Laravel Codebase Is Unmaintainable vault: Content/Insights/Why Your Laravel Codebase Is Unmaintainable.md
  - From: D70

- **DATA-046. A query function only reads.** A `queryFn`, a `select` option, a selector, and
  the `fetch*` or `get*` service function behind them do not call a mutating HTTP verb
  (`post`, `put`, `patch`, `delete`), write browser storage, send a store event, navigate or
  fire analytics. A read-only endpoint that takes a POST (a search with a request body, for
  example) is on an allowlist with its reason (the allowlist style of TYPES-027). **SHOULD.**
  - Why: a query can run twice, through a retry, a refetch or a remount, so a read that writes repeats the write.
  - Check: a test scans `*.service.ts` functions named `fetch*` or `get*` for `apiClient.post`, `put`, `patch` or `delete`, and `queryFn` and `select` bodies for `.send(`, a storage write, an analytics call and `router.`, and fails unless the function is on the allowlist with a reason.
  - Source: Command-Query Separation (CQS) https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/command-query-separation
  - Source: Queries and Query Handlers https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/queries-and-query-handlers
  - Source: Command Query Separation: Commands Change State, Queries Return It https://codyssey.dev/quick-tips/commands-change-state-queries-return-it
  - From: NX-04

- **DATA-047. One mapper turns a transport failure into a message.** A service turns a
  transport failure into a user-facing `Error` with one helper in `src/lib` (a sibling of
  `parseApiFormError`), keeps `{ cause }`, and does not repeat the network-error and status
  ladder. No code reads the `message` of an error response body by hand to build a message.
  UI does not show a raw `error.message`. The helper is `toServiceError` in
  `src/lib/serviceError.ts`; a toast outside a service uses `showErrorToast` (which calls
  `toUserMessage`). **SHOULD.**
  - Why: the message for a failure is chosen once, at the edge of the app, so every screen says the same thing about the same failure.
  - Source: Domain Exceptions vs Framework Exceptions https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/domain-exceptions-vs-framework-exceptions
  - Source: Throw a Domain Exception, Not a Framework One https://codyssey.dev/quick-tips/throw-a-domain-exception-not-a-framework-one
  - From: D71 (core part)

- **DATA-048. A value interpolated into an API path is encoded; a query string is passed as
  `params`.** The value goes through `encodeURIComponent`; a query string with values is
  passed as the API client's `params` option (or built with `URLSearchParams`), never written
  into the path string. The `apiRoutes.ts` builders encode, `serverFetchJson` takes `params`,
  and a plain `fetch` uses `withQuery`. A detail page calls `notFoundOnImpossibleSlug`
  (`src/lib/routeSlug.ts`) right after reading `params`, in the page and in
  `generateMetadata`, before the first fetch. **SHOULD.**
  - Why: Next hands a page the raw segment for `%2F`, so an encoded traversal slug can reach the backend and surface as a 500.
  - From: D77

## Loading, success and error

- **DATA-049. Every async flow handles loading, success and error, and shows each.** No
  silent failures: no empty `catch`, no swallowed rejection. A `catch` that holds only a
  comment is allowed when the comment says why the failure is safe to ignore. A mutation
  failure is surfaced somewhere (`onError`, a `catch` around `mutateAsync`, or an `isError`
  render). Decide the error before the skeleton. **MUST** for an empty `catch`; **SHOULD** for
  rendering each state.
  - Why: an empty `catch` hides the failure from everyone, and a failed fetch with no data shows the skeleton forever when the error is not decided first.
  - Source: Guard Clauses and Defensive Programming https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/guard-clauses-and-defensive-programming
  - From: D31

- **DATA-050. Use error boundaries for render failures, at route level only.**
  `app/error.tsx` and `app/global-error.tsx` are the boundaries. There is no component-level
  boundary: a render failure replaces the page content with `app/error.tsx`. The
  `react-error-boundary` package is not used. **SHOULD.**
  - Why: one boundary per route gives every render failure the same screen, while a component boundary hides a broken section inside a page that looks fine.
  - From: D32

- **DATA-051. Loading feedback is visible** (a skeleton or a `Loading...` label), never a
  blank box. **SHOULD.**
  - Why: a blank box reads as missing content, while a skeleton says the content is on its way.
  - From: D33

## Reporting errors

- **DATA-052. Route error boundaries keep the digest on screen.** `app/error.tsx` and
  `app/global-error.tsx` show the error's `digest`. **SHOULD.**
  - Why: in production Next replaces a server error's message with a digest, so the digest is what a user can quote and the server logs can be searched for.
  - From: D41 (core part)

- **DATA-053. `console` is not a reporting channel.** The `no-console` lint rule runs with
  `allow: ['warn', 'error']`; `console.log`, `console.info` and `console.debug` are not left
  in shipped source; a service does not log and rethrow (the caller decides); where the UI
  absorbs an error, report it through the project's error reporter. **MUST.**
  - Why: stripping console calls from the production build hides them and does not stop them being written.
  - From: D42

## Browser storage, session and navigation

- **DATA-054. Browser storage goes through one helper module** with guarded `get`, `set` and
  `remove` (each in `try/catch`, so blocked storage never throws), in
  `src/lib/browserStorage.ts`. Keys are exported constants named `<app>_<snake_case>`, not
  versioned; a literal key string is never repeated outside its module; a stored JSON value is
  parsed to `unknown` and narrowed by a type guard, not cast. A storage write after a
  successful API call never turns that success into an error. The auth-flag half is
  ACCESS-005. A comment-only `catch` that returns a safe default for a storage failure is not a
  violation, and neither is an inline `<head>` script that runs before any bundle loads: it
  cannot import the helper and keeps its storage calls inside a `try/catch`. **SHOULD.**
  - Why: `getItem()` and `setItem()` throw in private browsing and when storage is blocked, so an unguarded call breaks the page for those visitors.
  - Source: client-localstorage-schema https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/client-localstorage-schema.md
  - From: D51

- **DATA-055. A query that needs a signed-in member waits for the session check to settle.**
  `AuthProvider` exposes one signal (`isSessionVerified`), false until `checkAuth` settles,
  and the query adds it to its own preconditions (a verified email, a role).
  `isAuthenticated` stays for header rendering and hydration. Only a 401 or 403 from the
  session check ends the client session; a 5xx or a network failure keeps the member signed
  in and retries. **SHOULD.**
  - Why: the stored auth flag is only a hint and the session check is the authority, and a 5xx or a network failure says nothing about the session.
  - Source: Authentication Across the Boundary vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/40 - Authentication Across the Boundary.md
  - From: D52

- **DATA-056. Gated UI waits for every query it reads.** A pending query is not a denial: a
  gate that reads a role and a membership waits for both queries before it hides content or
  redirects. **SHOULD.**
  - Why: a gate that decides while a query is pending shows locked content to, or sends away, someone who has access.
  - From: D53

- **DATA-057. `fetchQuery` used for polling or reconciliation sets `staleTime: 0`.**
  **SHOULD.**
  - Why: `invalidateQueries` marks the key fresh, so a later `fetchQuery` resolves from the cache unless it sets `staleTime: 0`.
  - From: D54

- **DATA-058. A hard navigation after an auth state change goes through
  `beginHardNavigation`** (`src/lib/navigation.ts`). A fixed delay before
  `window.location.href` (`await new Promise(r => setTimeout(r, 100))`) is not a way to wait
  for state; the helper orders the navigation. A navigation to another internal page that is
  not an auth change uses `Link` or the router. **SHOULD.**
  - Why: an auth change can start two navigations that race each other, and the helper runs them in order.
  - From: D60

- **DATA-059. Dates and prices go through the shared formatters.** A `toLocaleDateString`,
  `toLocaleTimeString` or `toLocaleString` call outside `src/lib/formatDate.ts` sets
  `timeZone`. A date in server-rendered markup uses the UTC-pinned `formatPublishDate`
  (`src/lib/formatDate.ts`, with the format variant (`'long'`, `'short'`, `'day-month'`) as a
  parameter); `formatDate` and `formatDateTime` (unpinned) only in client-only views; prices
  use `src/lib/formatPrice.ts`; amounts are minor units and `formatPrice` reads the digit count
  from `Intl`. A date sent to the API or read from the URL uses one fixed format
  (`YYYY-MM-DD` or ISO 8601) through one helper; `new Date(string)` is not called on a
  user-typed or ambiguous string such as `10/01/2026`, because a non-ISO format is
  implementation-defined. **MUST** for the `timeZone` clause; **SHOULD** for the rest.
  - Why: a date formatted without a fixed time zone can render one day on a UTC server and another in the reader's browser, which React reports as a hydration mismatch.
  - Check: guard-test row DATA-059: every `toLocaleDateString`, `toLocaleTimeString` or `toLocaleString` call outside the shared date formatter sets `timeZone`.
  - Source: Queries and Query Handlers https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/queries-and-query-handlers
  - Source: The date Rule Accepts Dates Your Query Doesn't https://codyssey.dev/quick-tips/the-date-rule-accepts-dates-your-query-doesnt
  - Source: Date.parse() https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
  - From: D61

- **DATA-060. Window event names are named constants.** A `CustomEvent` or `Event` name used
  on `window` is a named constant in the module that owns it, dispatched and listened to
  through that module's helpers. The same name is not dispatched as `Event` in one file and
  `CustomEvent` in another. The model is the auth events in `src/lib/authSession.ts`:
  module-private names behind `broadcastAuth*` and `onAuth*` helpers. **SHOULD.**
  - Why: a name typed in two files drifts without an error, and one module's helpers keep the name and the event type together.
  - From: D78

- **DATA-061. Third-party scripts load once, from one place, and only where needed.** A
  site-wide script is a `next/script` in `app/layout.tsx` with `afterInteractive` and its site
  id in one constant. A script only some flows need loads on demand from a loader module: a
  promise cached once, a timeout, a fallback path, and a retry on the next click. Nothing else
  injects a `<script>`. A script loaded for an optional purpose runs only after consent,
  through the one consent module of ACCESS-015, and names its consent category in the
  loader's comment; a script needed to deliver the page or to protect a form (a bot check on a
  sign-up form, for example) says so. Each new origin also follows ACCESS-011 (the header
  policy) in the same change. **SHOULD.**
  - Why: every script is a request, a dependency and an origin to allow, so one place keeps each of them visible and loaded once.
  - From: D68

## Hydration, layout and caching

- **DATA-062. The first client render matches the server.** No `window`, `document`,
  `localStorage` or `matchMedia` read in a `useState` or `useMemo` initializer or in the
  render body; use `useSyncExternalStore` with a server snapshot, or an effect. DATA-013 is
  one case of this rule, and STRUCT-016 covers server entries. **SHOULD.**
  - Why: the server cannot read these values, so a first client render that reads them differs from the server HTML and fails hydration.
  - From: D56

- **DATA-063. Content that depends on member data does not push the page.** A notice, banner
  or strip that renders after the auth state or a member query resolves is an overlay, sits in
  a slot sized in advance, or is already in the server HTML. The same holds for client-only UI
  that appears after a library initialises: carousel arrows that appear after the carousel
  starts render a same-size slot until then. **SHOULD.**
  - Why: content inserted after load moves everything below it, a layout shift that a signed-out test run never sees.
  - From: D76

- **DATA-064. Server code never reads member cookies or headers.** Only an allowlist imports
  `next/headers`; nothing under `app/` or `src/features/` builds a server API client from
  request data. DATA-003 and DATA-005 apply the same ban to pages. **MUST.**
  - Why: `cookies()` and `headers()` make a route dynamic, which breaks static-first rendering on any host.
  - Check: guard-test row DATA-064: only allowlisted files import `next/headers`.
  - From: D57 (core part)

- **DATA-065. No `loading.tsx` under `app/`, and no `Suspense` above the fetch of a page that
  can call `notFound()`.** This rule wins over the
  [`loading.js`](https://nextjs.org/docs/app/api-reference/file-conventions/loading) file
  convention in the bundled Next.js docs. **MUST** for the file; **SHOULD** for the `Suspense`
  half.
  - Condition: the `Suspense` half assumes Cache Components is off. With Cache Components on, the newer docs direct runtime data into `<Suspense>`, and a request-time `notFound()` in the page runs after the shell is sent, so that check answers 200.
  - Why: a streamed response starts with status 200, and a `loading.tsx` or `Suspense` fallback starts the stream, so a later `notFound()` can no longer send a 404 and the route answers a soft 404.
  - Check: guard-test row DATA-065: no `loading.tsx` file exists under `app/`.
  - Source: loading.js https://nextjs.org/docs/app/api-reference/file-conventions/loading
  - From: D58

- **DATA-066. Server module scope holds no request or user data.** **SHOULD.**
  - Why: one server instance serves many requests, so module state set during one request is read by the next.
  - Source: The Singleton Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-singleton-pattern
  - Source: server-no-shared-module-state https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/server-no-shared-module-state.md
  - From: D66

## React and effects

- **DATA-067. No hand memoization for render speed in new code.** New code skips `useMemo`,
  `useCallback` and `memo` unless a dependency array or an effect needs a stable identity.
  Code MUST be correct without the compiler too: where dev or tests run uncompiled, a value
  that loses its hook is a new identity on every render and must not feed an effect
  dependency array. This rule wins over Vercel
  [`rerender-memo`](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/rerender-memo.md).
  **SHOULD.**
  - Condition: the React Compiler is on (https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler), which the fixed stack does.
  - Why: the compiler memoizes for render speed, so hand-written memoization in new code adds code without adding speed.
  - Source: React Compiler https://react.dev/learn/react-compiler
  - Source: reactCompiler https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler
  - From: D62

- **DATA-068. No effect that copies props or derived values into state.** Derive during
  render, or reset with a `key`. An effect that reads browser storage after mount is not a
  copy; its lint-disable carries the reason TYPES-039 asks for. **SHOULD.**
  - Why: an effect that adjusts state on a prop change renders once with the stale value and again with the new one.
  - Source: You Might Not Need an Effect https://react.dev/learn/you-might-not-need-an-effect
  - From: D63

- **DATA-069. An effect that adds a listener or timer returns its cleanup.** Nothing polls
  for state an event already delivers. A poll loop or delayed chain started from a handler
  stops on unmount and on sign-out (an `AbortSignal` or a mounted check). A poll that must
  outlive the page, because it updates a global store or the query cache, reads the stored
  auth flag (`src/lib/authSession.ts`) after each wait and stops on sign-out. **SHOULD.**
  - Why: a listener or timer left behind keeps running after its component is gone, and a poll that runs past sign-out sends requests for a member who left.
  - From: D64

- **DATA-070. Mutations call the backend through `apiClient`, not Server Actions.** The
  separate API has its own cookie auth, so `'use server'` has no place in the app. Vercel
  [`server-auth-actions`](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/server-auth-actions.md)
  does not apply: the app has no Server Actions to authenticate. **MUST.**
  - Why: the API holds the session and owns every write, so a Server Action would add a second write path outside the client that carries the member's cookies.
  - Source: Data Security https://nextjs.org/docs/app/guides/data-security
  - From: D65

- **DATA-071. A 429 shows a wait message and is never retried; resend buttons have a
  cooldown; polls and client fetch loops have a cap; a failed fetch is not rendered as
  empty.** A client loop that fetches until done has a page cap and stops on error.
  `shouldRetryQuery` (DATA-026) already stops on any 4xx, so the wait message is the half
  each screen adds. `toServiceError` maps a 429 to `RATE_LIMIT_MESSAGE`, and error toasts
  built with `showErrorToast` show the title "Too many requests" on a 429; any other failure
  keeps the toast's own text. Resend buttons share one `createCooldown`. **SHOULD.**
  - Why: the API rate-limits per client, so a retry or an unbounded loop after a 429 extends the wait, and an empty render hides a failure the user should see.
  - Source: Guard Clauses and Defensive Programming https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/guard-clauses-and-defensive-programming
  - From: D67

## What is NOT a violation

- The `fetch` calls in `src/lib/serverFetch.ts` and `src/lib/content.server.ts`: they are the
  two sanctioned paths. A sitemap or feed helper that does not fetch page data is accepted
  too.
- `useSearchParams` in the allowlisted files of DATA-016; each has its reason in the guard
  test.
- A public page whose data is per-viewer but whose server render is not: seed with
  `perViewerSeedUpdatedAt()` and keep the page prerendered.
- `src/lib/JsonLd.tsx` escaping only `<`: that is the character that can close the element.
