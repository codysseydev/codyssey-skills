# Next.js Kanon: index

The rule files of `nextjs-kanon`, the id of every rule, and the format every rule entry follows.

## Source

The pack's rules are derived from the 278 rules of `codysseydev/codyssey-frontend` at commit `abdfd9f2` (seven files in `.ai/rules/`). Each pack rule has its own id and names the source rule it came from in a `From:` line. The source project keeps its own rules and ids.

## Layers

Every source rule was sorted into one layer:

- **core**: rules for every project on the pack's fixed stack. They live in the seven core files.
- **add-on**: rules that load only when one optional package or script is present. They live in `add-ons/`.
- **Cloudflare overlay**: rules that hold only when the app deploys to Cloudflare Workers through OpenNext. They live in `overlays/cloudflare.md`.
- **the source project's overlay**: rules about the source project's own product. They are not copied here.
- **split**: one source rule whose core part goes to a core file and whose other clauses go to an add-on or an overlay.
- **drop**: not carried over.

Every source rule numbered I lives in the overlay file, including the one core rule and the one core part among them.

## Files and id prefixes

Ids are `<PREFIX>-<NNN>`, numbered from 001 in prose order within each file. The prefixes are checked against the Kanon catalog prefix table once it exists, so the pack can join the catalog without renumbering.

| file | prefix |
|---|---|
| `structure.md` | `STRUCT` |
| `data-and-rendering.md` | `DATA` |
| `types-and-tests.md` | `TYPES` |
| `ui-a11y-seo.md` | `UI` |
| `design-principles.md` | `DESIGN` |
| `access-and-security.md` | `ACCESS` |
| `tooling.md` | `TOOLING` |
| `overlays/cloudflare.md` | `CF` |
| `add-ons/untrusted-content.md` | `UNTRUSTED` |
| `add-ons/syntax-highlighting.md` | `SYNTAX` |
| `add-ons/sentry.md` | `SENTRY` |
| `add-ons/turnstile.md` | `TURNSTILE` |
| `add-ons/radix.md` | `RADIX` |
| `add-ons/heroicons.md` | `HEROICONS` |
| `add-ons/plausible.md` | `PLAUSIBLE` |
| `add-ons/axios.md` | `AXIOS` |
| `add-ons/cmdk.md` | `CMDK` |
| `add-ons/mutation-testing.md` | `MUTATION` |

Order within a file:

- Core files follow the source file's prose order. A new rule (an `NX-` row) sits directly after the closest existing rule.
- Add-on files and the overlay list whole rules first, then clause entries. Each group follows the source files in this order: structure, data-and-rendering, types-and-tests, ui-a11y-seo, design-principles, access-and-security, tooling-and-deploy, then the rule's position in its file.

A rule cites another rule by its pack id, never by its source id.

## Entry format

```
- **DATA-012. <title>** <rule text> **MUST.**
  - Condition: <the stack setting the rule assumes> (only where the rule depends on one)
  - Why: <reason, with a neutral example>
  - Check: <the guard-test row or lint rule the pack ships, or the sheet's check idea> (only where one exists)
  - Source: <title> https://codyssey.dev/... | vault: Content/<path>.md
  - From: D12
```

- `From:` is `D12` for a whole rule, `D12 (core part)` for the core part of a split row, `D12 (Cloudflare clause)` or `D12 (Sentry clause)` for a clause, and `NX-04` for a new rule.
- `Condition:` names a setting of the fixed stack that the rule assumes, such as "Cache Components is off" or "the React Compiler is on". It covers the whole rule unless it names the part it covers.
- A clause is its own entry in its add-on or overlay file. It states what it adds to the core rule and cites that rule by its pack id. A clause that is only an example is a one-line entry.
- The one access core line written fresh from its layer decision carries `From: Layer calls tab (written fresh)` and no source id.
- Overlay entries add `- Tags: OpenNext` or `- Tags: Workers`, except I9 and the I10 core part (CF-007 and CF-008). Those two hold on any host and carry no `Tags:` line.
- A URL in prose that punctuation follows is written `<URL>` or as a Markdown link, so the punctuation stays out of the link. A `Source:` line ends with its bare URL.

## Notes policy

Strip and generalize:

- Drop every Observed, Not migrated, Audit and incident note.
- Keep each Why, with a neutral example.
- Keep a Source line only when it cites a public doc or a lesson, insight or quick tip URL on <https://codyssey.dev/>.
- Rename the source project's names to the generic names below.
- The design-principles lesson quotes stay as Source lines with their https://codyssey.dev/ URLs. Unpublished lessons and schedule dates are dropped.

## Source policy

A source that is live on https://codyssey.dev/ when the rule is written cites its URL. Check the vault file's frontmatter and the site. A draft or a scheduled item that is not live yet cites `vault: Content/<path>.md`.

## Names rules may cite

The template's file names. The template repository `codysseydev/nextjs-template` must use them:

| name | what it is |
|---|---|
| `src/features/<name>/` | a feature folder |
| `src/features/global-ui/` | shared UI |
| `src/lib/apiClient.ts` | the API client |
| `src/constants/apiRoutes.ts` | every API path |
| `src/constants/routes.ts` | the app's own page paths, as constants and small builders |
| `src/lib/env.ts` | the env module: the typed values `API_BASE_URL`, `SITE_URL` and `APP_ENVIRONMENT`, read from variables such as `NEXT_PUBLIC_API_BASE_URL` |
| `src/lib/authSession.ts` | the one module that reads and writes the browser auth flag, and its `broadcastAuth*` and `onAuth*` helpers for other tabs |
| `src/lib/metadata.ts` | the helpers that build page metadata: `generateContentMetadata`, `generateStaticPageMetadata`, `generateFallbackMetadata`, `CONTENT_TYPE_DESCRIPTIONS` and `CONTENT_TYPE_OG_IMAGES` |
| `src/lib/JsonLd.tsx` | the component that writes JSON-LD into the page |
| `src/lib/structuredData.ts` | the builders for structured data objects |
| `src/lib/sentry/` | the Sentry setup and helpers (Sentry add-on) |
| `src/lib/cloudflare/` | one module per Worker concern (Cloudflare overlay) |
| `.ai/rules/` | the rule folder |
| `src/lib/tests/architectureRules.test.ts` | the guard test |
| `docs/reference/global-ui-components.md` | the component catalog |
| `src/lib/` | cross-feature helpers and hooks |
| `src/constants/` | shared constants |
| `src/providers/` | React providers and their hooks |
| `src/types/` | types shared across features |
| `src/features/global-ui/icons/` | shared icon components |
| `src/features/<name>/<FeatureName>.tsx` | a feature's entry component |
| `src/features/<name>/components/`, `hooks/`, `services/`, `store/`, `types/`, `utils/`, `constants/`, `tests/`, `stories/` | the subfolders of a feature folder |
| `tests/utils/`, `tests/hooks/` | test folders that mirror `utils/` and `hooks/` |
| `types/*.types.ts` | a feature's API types |
| `types/*.enums.ts` | a feature's enums |
| `utils/<form>Schema.ts` | one form's schema |
| `app/cached/<name>/[page\|variant]` | the internal rewrite folder for prerendered page variants |
| `src/lib/serverFetch.ts` | `serverFetchJson`, the server fetch for one listing or document |
| `src/lib/content.server.ts` | `contentService`, the server fetch that `generateMetadata` and the render share |
| `src/lib/upstreamApiError.ts` | `UpstreamApiError`, the error the server fetches throw, and `isNotFoundError` |
| `src/lib/pageData.ts` | `loadOrNotFound` and `assertInRange`, the shared steps of a server page |
| `src/lib/publicPathname.ts` | `toPublicPathname`, the internal path to public path map |
| `src/lib/archiveSeed.ts` | `seedUpdatedAt`, `perViewerSeedUpdatedAt` and `seedablePage`, the helpers that seed client queries from prerendered data |
| `src/features/global-ui/FetchingIndicator/FetchingIndicator` | the one fetch-state indicator |
| `urlFor<State>` | naming pattern: the helper that builds the URL for a UI state (file not named) |
| `<thing>QueryOptions` | naming pattern: a query options factory |
| `QueryProvider` | the provider of the query client and its defaults (file not named) |
| `src/lib/queryRetry.ts` | `shouldRetryQuery` and `shouldRetryMutation`, the retry defaults |
| `src/constants/queryTimings.ts` | named stale and garbage-collection times, `STALE_*` and `GC_*` |
| `src/lib/optimisticUpdate.ts` | `runOptimisticUpdate`, the optimistic update sequence |
| `src/lib/useFeatureMutation.ts` | `useFeatureMutation`, the mutation wrapper that owns the toast and the error report |
| `src/lib/emailSchema.ts` | `emailField`, the shared email field schema |
| `src/lib/passwordValidationSchema.ts` | `passwordField` and `passwordValidationSchema` |
| `src/lib/serviceError.ts` | `toServiceError`, the service error mapping |
| `RATE_LIMIT_MESSAGE` | the wait message `toServiceError` returns for a 429 (file not named) |
| `parseApiFormError`, `toUserMessage` | the form-error and user-message helpers (file not named) |
| `showToast`, `showErrorToast` | the toast calls (file not named) |
| `createCooldown` | the shared cooldown for resend buttons (file not named) |
| `src/lib/withQuery.ts` | `withQuery`, the query-string builder |
| `src/lib/routeSlug.ts` | `notFoundOnImpossibleSlug`, the early 404 for a slug that cannot exist |
| `src/lib/browserStorage.ts` | the browser storage helpers: try/catch, key constants, a typed parse |
| `<app>_` | placeholder prefix of every storage key, as `<app>_<snake_case>` and `<app>_auth` |
| `AuthProvider` | the provider of the session state: `isSessionVerified`, `checkAuth`, `isAuthenticated` (file not named) |
| `useAuth`, `useMediaQuery` | shared hooks outside feature folders (files not named) |
| `src/lib/navigation.ts` | the navigation helpers: `beginHardNavigation`, `toSameOriginPath` and `toSameOriginParts` |
| `safeRedirect` | the redirect helper that goes through `toSameOriginPath` (file not named) |
| `src/lib/formatDate.ts` | the shared date formatter: `formatPublishDate`, `formatDate` and `formatDateTime` |
| `src/lib/formatPrice.ts` | `formatPrice` |
| `src/lib/formatCount.ts` | `formatCount` and `pluralize` |
| `src/lib/capitalizeSlug.ts` | `capitalizeSlug` |
| `src/lib/getCookie.ts` | `getCookie` |
| `src/lib/csrf.service.ts` | `csrfService.initializeCsrf`, the CSRF cookie request |
| `truncateText`, `newestFirst`, `wait`, `normalizeExternalUrl`, `capitalizeFirst` | pure helpers in `src/lib` (files not named) |
| `src/lib/exhaustiveFallback.ts` | the run-time fallback for a `never` value |
| `src/lib/testing/at.ts` | `at()`, the checked array index for tests |
| `src/lib/testing/createTestQueryClient.ts` | the query client for tests |
| `tsconfig.scripts.json` | the TypeScript config for `scripts/` |
| `scripts/` | the TypeScript build and deploy scripts |
| `.storybook/mocks` | Storybook's mocks of `next/*` |
| `--radius-*`, `--header-h` | role tokens in the `@theme` block of `app/globals.css` |
| `src/constants/zIndex.ts` | the named z-index layers |
| `src/constants/layout.ts` | `PAGE_CONTAINER`, the full-width block container |
| `src/features/global-ui/Button/focusRing.ts` | `FOCUS_RING_CLASSES`, `HIT_AREA_CLASSES` and `HIT_AREA_Y_CLASSES` |
| `src/lib/usePrefersReducedMotion.ts` | the reduced-motion hook |
| `Button`, `Input`, `Select`, `Spinner`, `Skeleton`, `Badge`, `EmptyState`, `ErrorState`, `Toast` | the shared UI primitives in `src/features/global-ui/` |
| `src/lib/openExternal.ts` | `openExternal(url)`, the one way to open a new tab |
| `src/features/global-ui/links/HoverPrefetchLink` | the link that prefetches on hover |
| `contentImageSizes` | the `sizes` helper for images in API content (file not named) |
| `public/assets/`, `public/images/`, `public/icons/` | the static file folders |
| `public/images/static-og-images/<name>-og-image.png` | a static page's Open Graph image |
| `scripts/og-static-pages.json`, `STATIC_OG_IMAGE_BASE` | the manifest of static Open Graph images and their base path |
| `InlineHeadScript` | the one component for an inline head script (file not named) |
| `src/lib/safeExternalUrl.ts` | `safeExternalUrl`, the scheme check for URLs from the API |
| `src/lib/useScrubbedSearchParams.ts` | the hook that reads a sensitive URL parameter once and removes it |
| `src/providers/useRequireAuth.ts` | the client route guard hook |
| `src/lib/routeAuth.ts` | `isAuthorizedPurge(request, secret)`, the caller check of a route handler that purges a cache or changes data |
| `docs/architecture/third-party-origins.md` | the record of external script origins |
| `skills-lock.json` | the pinned refs of the vendored skills |
| `src/features/global-ui/RichText/richTextSanitize.ts` | the sanitizer module: `loadRichTextSanitizer()`, `sanitizeRichTextHtml()` and `EMPTY_SANITIZED_HTML` (untrusted-content add-on) |
| `SanitizedHtmlString`, `RichTextHtml` | the branded sanitized-HTML type and the one component that renders it (untrusted-content add-on) |
| `markdownRehypePlugins`, `markdownSanitizeSchema` | the Markdown sanitize pipeline and its schema (untrusted-content add-on, file not named) |
| `src/lib/isExternalLink.ts` | the shared external-link predicate (untrusted-content add-on) |
| `src/constants/site.ts` | the site's own hosts (untrusted-content add-on) |
| `stripHtmlTags`, `decodeHtmlEntities` | the HTML text helpers in `src/lib` (untrusted-content add-on, file not named) |
| `LazyCodeHighlighter` | the lazy code highlighter (syntax-highlighting add-on) |
| `src/features/global-ui/CodeBlock/prismLight.ts` | the highlighter setup with explicit languages (syntax-highlighting add-on) |
| `src/lib/sentry/dataCollection.ts` | the Sentry data-collection settings (Sentry add-on) |
| `isExpectedRequestFailure` | the check for failures the mutation wrapper does not report (Sentry add-on) |
| `src/features/global-ui/Captcha/Captcha.tsx`, `turnstileLoader.ts` | the Turnstile component and its script loader (Turnstile add-on) |
| `src/lib/plausible.ts` | `trackEvent` and the event enum `AnalyticsEvent` (Plausible add-on) |
| `ConfirmDialog` | the confirmation dialog over Radix Dialog (Radix add-on) |
| `useReturnFocusOnClose()` | returns focus when a controlled dialog closes (Radix add-on) |
| `EDGE_CACHED_ROUTE` | the fetch option constant for edge-cached routes (Cloudflare overlay) |
| `scripts/size-budget.ts`, `scripts/size-budget.baseline.json` | the size budget check and its baseline (overlay entry that holds on any host) |
| `docs/guides/performance.md` | the record of per-route first-load sizes (overlay entry that holds on any host) |
| `scripts/lib/skewMapping.ts` | the skew mapping the deploy builds (Cloudflare overlay) |
| `scripts/deploy-cloudflare.ts` | the deploy script (Cloudflare overlay) |

A rule that needs another generic name adds it to this table.

## Guard-test rows

The template's guard test ships these portable checks. Each row is a pattern, an allowlist, a rule id and a fix over one shared helper. Allowlists start empty. A rule that a row checks keeps a `Check:` line naming the row by the rule's pack id.

| row | source id | what the row checks |
|---|---|---|
| DATA-016 | D15 | No source file calls `useSearchParams()` unless it is on the allowlist. |
| DATA-019 | D16 | `next/dynamic` and `React.lazy` appear only in allowlisted files. |
| DATA-020 | D18 | No source file preloads an original image with `new Image()`. |
| DATA-039 | D27 | `apiClient` is imported only from `*.service.ts` and `*.service.tsx` files. |
| DATA-044 | D49 | No `/api/` string literal outside `src/constants/apiRoutes.ts`. Tests, stories, docs and comments are exempt. |
| DATA-064 | D57 | Only allowlisted files import `next/headers`. |
| DATA-065 | D58 | No `loading.tsx` file exists under `app/`. |
| DATA-059 | D61 | Every `toLocaleDateString`, `toLocaleTimeString` or `toLocaleString` call outside the shared date formatter sets `timeZone`. |
| STRUCT-013 | S11 | Every module on the server-only list starts with `import 'server-only'`. |
| STRUCT-027 | S31 | `*.enums.ts` files export only enums, and `*.types.ts` files export only types. |
| TYPES-029 | T25 | Test files pass no `timeout` option to `waitFor`, `waitForElementToBeRemoved`, `findBy*`, `findAllBy*` or `expect.poll`. |
| TYPES-015 | T26 | A `switch` over a union or enum ends in a `never` exhaustiveness check. |
| UI-022 | U8 | A bare `outline-none` or `outline-0` comes with a `focus:`, `focus-visible:`, `focus-within:` or shared focus-ring class in the same `className`. |
| UI-005 | U31 | Every color, text or border utility class in source is one Tailwind generates from the project's `@theme`. |
| UI-015 | U32 | Exactly one `<main>` exists, in `app/layout.tsx`. |
| UI-014 | U71 | Full-screen page shells use `min-h-dvh`, not `min-h-screen`. |

The smaller portable guards come too:

| row | source id | what the row checks |
|---|---|---|
| STRUCT-014 | S12 | Import boundaries: a feature imports another feature only through an allowed pair. The allowed-pairs list starts empty. |
| DATA-042 | D30 | The env module: environment variables are read only through `src/lib/env.ts`. |
| ACCESS-011 | A10 | The `next.config` headers: string assertions on the header policy. |
| ACCESS-014 | A13 | The `next.config` headers: string assertions on the header policy. |

## Checks the template may ship (stage 2 decides)

A rule that one of these checks covers keeps a `Check:` line naming it, and stage 2 decides whether the check ships.

| pack id | source id | what the check does |
|---|---|---|
| CF-001 | I1 | The overlay's Durable Object check: the Worker entry exports no class, and the Workers config declares no Durable Object binding and no migration class that is never deleted. |
| CF-017, CF-023 | T31 (Cloudflare clause), I2 (Cloudflare clause) | The skew-mapping sync check: the limits in the skew mapping the deploy builds match the skew protection settings in the OpenNext config. |
| CF-008, CF-024 | I10 (core part), I10 (Cloudflare clause) | The size budget: after the build, the client chunk and Worker sizes are compared with a committed baseline, and the deploy fails when one grows past its budget or the baseline is missing. |
| UNTRUSTED-004, UNTRUSTED-005 | D37, D75 | The untrusted-content sanitizer tests: Markdown renders with the sanitize step after raw HTML parsing, and sanitized HTML has its authored `id` and `name` removed or prefixed. |
| SENTRY-009 | A14 (Sentry clause) | The Sentry consent guard: session replay is wired in one module, `Sentry.init` passes no replay integration, and replay starts only after the visitor grants consent. |
| TOOLING-007 | C7 (core part) | The scripts-are-TypeScript guard: every file under `scripts/` is a `.ts` file. |

## Counts per file

The rule issues match these numbers. A mismatch is reported in the pull request, not fixed by moving a rule.

| file | frontend core | split core parts | new NX rules | clause entries | total entries |
|---|---|---|---|---|---|
| `structure.md` | 29 | 4 | 0 | 0 | 33 |
| `data-and-rendering.md` | 55 | 11 | 5 | 0 | 71 |
| `types-and-tests.md` | 33 | 6 | 1 | 0 | 40 |
| `ui-a11y-seo.md` | 58 | 10 | 2 | 0 | 70 |
| `design-principles.md` | 15 | 1 | 4 | 0 | 20 |
| `access-and-security.md` | 6 | 7 | 2 | 0 | 15 |
| `tooling.md` | 8 | 4 | 0 | 0 | 12 |
| add-on files (10) | 14 whole rules | | 1 (NX-15) | 25 | 40 |
| `overlays/cloudflare.md` | 7 Cloudflare rules plus I9 (a core rule) | 1 (I10) | 0 | 14 | 23 |

The core files hold 204 core rules and 43 core parts. The 45 split rows give 44 core parts, because I2 has no core part. The core rule I9 and the core part of I10 are overlay entries.

The overlay holds 23 entries and 14 clause entries, because CF-020, the slot for the A11 Cloudflare clause, stays reserved and unused.

## Frontend accounting

- Core 205 + split 45 + add-on 14 + Cloudflare overlay 7 = 271 source rules with a pack target.
- 270 of them appear by id in `From:` lines. The remaining one, a split row of the access file, is in the pack only as a core line written fresh, with no source id.
- The other 7 source rules are not copied: 6 rules of the source project's overlay (2 of them marked never-copy by the public safety pass) and 1 dropped rule.
- 271 + 7 = 278.

## Id map

One row per pack id: 325 rows. The map covers every source rule with a target in the pack and every approved new rule from the review sheet, except NX-03, which edits an existing rule. NX-08 was rejected.

| pack id | file | layer | From | note |
|---|---|---|---|---|
| STRUCT-001 | `structure.md` | core | S1 |  |
| STRUCT-002 | `structure.md` | core | S2 |  |
| STRUCT-003 | `structure.md` | core | S3 |  |
| STRUCT-004 | `structure.md` | core | S4 |  |
| STRUCT-005 | `structure.md` | core | S5 |  |
| STRUCT-006 | `structure.md` | core | S6 |  |
| STRUCT-007 | `structure.md` | core | S7 |  |
| STRUCT-008 | `structure.md` | core | S23 (core part) |  |
| STRUCT-009 | `structure.md` | core | S21 |  |
| STRUCT-010 | `structure.md` | core | S8 |  |
| STRUCT-011 | `structure.md` | core | S9 (core part) |  |
| STRUCT-012 | `structure.md` | core | S10 |  |
| STRUCT-013 | `structure.md` | core | S11 (core part) |  |
| STRUCT-014 | `structure.md` | core | S12 |  |
| STRUCT-015 | `structure.md` | core | S13 |  |
| STRUCT-016 | `structure.md` | core | S14 |  |
| STRUCT-017 | `structure.md` | core | S15 |  |
| STRUCT-018 | `structure.md` | core | S16 |  |
| STRUCT-019 | `structure.md` | core | S22 |  |
| STRUCT-020 | `structure.md` | core | S17 |  |
| STRUCT-021 | `structure.md` | core | S24 |  |
| STRUCT-022 | `structure.md` | core | S29 |  |
| STRUCT-023 | `structure.md` | core | S32 |  |
| STRUCT-024 | `structure.md` | core | S18 |  |
| STRUCT-025 | `structure.md` | core | S19 |  |
| STRUCT-026 | `structure.md` | core | S20 |  |
| STRUCT-027 | `structure.md` | core | S31 |  |
| STRUCT-028 | `structure.md` | core | S28 (core part) |  |
| STRUCT-029 | `structure.md` | core | S30 |  |
| STRUCT-030 | `structure.md` | core | S33 |  |
| STRUCT-031 | `structure.md` | core | S34 |  |
| STRUCT-032 | `structure.md` | core | S27 |  |
| STRUCT-033 | `structure.md` | core | S25 |  |
| DATA-001 | `data-and-rendering.md` | core | D1 (core part) |  |
| DATA-002 | `data-and-rendering.md` | core | D2 |  |
| DATA-003 | `data-and-rendering.md` | core | D3 |  |
| DATA-004 | `data-and-rendering.md` | core | D4 |  |
| DATA-005 | `data-and-rendering.md` | core | D5 |  |
| DATA-006 | `data-and-rendering.md` | core | D6 |  |
| DATA-007 | `data-and-rendering.md` | core | D7 |  |
| DATA-008 | `data-and-rendering.md` | core | D8 (core part) |  |
| DATA-009 | `data-and-rendering.md` | core | D9 |  |
| DATA-010 | `data-and-rendering.md` | core | D10 |  |
| DATA-011 | `data-and-rendering.md` | core | D11 |  |
| DATA-012 | `data-and-rendering.md` | core | D12 |  |
| DATA-013 | `data-and-rendering.md` | core | D13 |  |
| DATA-014 | `data-and-rendering.md` | core | D14 |  |
| DATA-015 | `data-and-rendering.md` | core | D72 |  |
| DATA-016 | `data-and-rendering.md` | core | D15 |  |
| DATA-017 | `data-and-rendering.md` | core | D73 |  |
| DATA-018 | `data-and-rendering.md` | core | NX-07 |  |
| DATA-019 | `data-and-rendering.md` | core | D16 (core part) |  |
| DATA-020 | `data-and-rendering.md` | core | D18 (core part) |  |
| DATA-021 | `data-and-rendering.md` | core | D19 (core part) |  |
| DATA-022 | `data-and-rendering.md` | core | D20 |  |
| DATA-023 | `data-and-rendering.md` | core | D21 |  |
| DATA-024 | `data-and-rendering.md` | core | D22 |  |
| DATA-025 | `data-and-rendering.md` | core | D23 |  |
| DATA-026 | `data-and-rendering.md` | core | D24 |  |
| DATA-027 | `data-and-rendering.md` | core | NX-06 |  |
| DATA-028 | `data-and-rendering.md` | core | D25 |  |
| DATA-029 | `data-and-rendering.md` | core | NX-09 |  |
| DATA-030 | `data-and-rendering.md` | core | D26 |  |
| DATA-031 | `data-and-rendering.md` | core | D55 |  |
| DATA-032 | `data-and-rendering.md` | core | D69 (core part) |  |
| DATA-033 | `data-and-rendering.md` | core | D74 |  |
| DATA-034 | `data-and-rendering.md` | core | D43 |  |
| DATA-035 | `data-and-rendering.md` | core | D44 |  |
| DATA-036 | `data-and-rendering.md` | core | NX-05 |  |
| DATA-037 | `data-and-rendering.md` | core | D45 |  |
| DATA-038 | `data-and-rendering.md` | core | D46 |  |
| DATA-039 | `data-and-rendering.md` | core | D27 (core part) |  |
| DATA-040 | `data-and-rendering.md` | core | D28 |  |
| DATA-041 | `data-and-rendering.md` | core | D29 |  |
| DATA-042 | `data-and-rendering.md` | core | D30 (core part) |  |
| DATA-043 | `data-and-rendering.md` | core | D38 |  |
| DATA-044 | `data-and-rendering.md` | core | D49 |  |
| DATA-045 | `data-and-rendering.md` | core | D70 |  |
| DATA-046 | `data-and-rendering.md` | core | NX-04 |  |
| DATA-047 | `data-and-rendering.md` | core | D71 (core part) |  |
| DATA-048 | `data-and-rendering.md` | core | D77 |  |
| DATA-049 | `data-and-rendering.md` | core | D31 |  |
| DATA-050 | `data-and-rendering.md` | core | D32 |  |
| DATA-051 | `data-and-rendering.md` | core | D33 |  |
| DATA-052 | `data-and-rendering.md` | core | D41 (core part) |  |
| DATA-053 | `data-and-rendering.md` | core | D42 |  |
| DATA-054 | `data-and-rendering.md` | core | D51 |  |
| DATA-055 | `data-and-rendering.md` | core | D52 |  |
| DATA-056 | `data-and-rendering.md` | core | D53 |  |
| DATA-057 | `data-and-rendering.md` | core | D54 |  |
| DATA-058 | `data-and-rendering.md` | core | D60 |  |
| DATA-059 | `data-and-rendering.md` | core | D61 |  |
| DATA-060 | `data-and-rendering.md` | core | D78 |  |
| DATA-061 | `data-and-rendering.md` | core | D68 |  |
| DATA-062 | `data-and-rendering.md` | core | D56 |  |
| DATA-063 | `data-and-rendering.md` | core | D76 |  |
| DATA-064 | `data-and-rendering.md` | core | D57 (core part) |  |
| DATA-065 | `data-and-rendering.md` | core | D58 |  |
| DATA-066 | `data-and-rendering.md` | core | D66 |  |
| DATA-067 | `data-and-rendering.md` | core | D62 |  |
| DATA-068 | `data-and-rendering.md` | core | D63 |  |
| DATA-069 | `data-and-rendering.md` | core | D64 |  |
| DATA-070 | `data-and-rendering.md` | core | D65 |  |
| DATA-071 | `data-and-rendering.md` | core | D67 |  |
| TYPES-001 | `types-and-tests.md` | core | T1 |  |
| TYPES-002 | `types-and-tests.md` | core | T2 |  |
| TYPES-003 | `types-and-tests.md` | core | T3 |  |
| TYPES-004 | `types-and-tests.md` | core | T4 |  |
| TYPES-005 | `types-and-tests.md` | core | T5 |  |
| TYPES-006 | `types-and-tests.md` | core | T6 (core part) |  |
| TYPES-007 | `types-and-tests.md` | core | T7 |  |
| TYPES-008 | `types-and-tests.md` | core | T24 |  |
| TYPES-009 | `types-and-tests.md` | core | T34 (core part) |  |
| TYPES-010 | `types-and-tests.md` | core | T35 (core part) |  |
| TYPES-011 | `types-and-tests.md` | core | T36 |  |
| TYPES-012 | `types-and-tests.md` | core | T37 (core part) |  |
| TYPES-013 | `types-and-tests.md` | core | T38 |  |
| TYPES-014 | `types-and-tests.md` | core | T39 |  |
| TYPES-015 | `types-and-tests.md` | core | T26 |  |
| TYPES-016 | `types-and-tests.md` | core | T28 |  |
| TYPES-017 | `types-and-tests.md` | core | T8 |  |
| TYPES-018 | `types-and-tests.md` | core | T9 |  |
| TYPES-019 | `types-and-tests.md` | core | T10 |  |
| TYPES-020 | `types-and-tests.md` | core | T11 |  |
| TYPES-021 | `types-and-tests.md` | core | NX-14 |  |
| TYPES-022 | `types-and-tests.md` | core | T12 |  |
| TYPES-023 | `types-and-tests.md` | core | T13 |  |
| TYPES-024 | `types-and-tests.md` | core | T14 |  |
| TYPES-025 | `types-and-tests.md` | core | T15 |  |
| TYPES-026 | `types-and-tests.md` | core | T16 |  |
| TYPES-027 | `types-and-tests.md` | core | T17 |  |
| TYPES-028 | `types-and-tests.md` | core | T23 |  |
| TYPES-029 | `types-and-tests.md` | core | T25 |  |
| TYPES-030 | `types-and-tests.md` | core | T29 |  |
| TYPES-031 | `types-and-tests.md` | core | T30 |  |
| TYPES-032 | `types-and-tests.md` | core | T31 (core part) |  |
| TYPES-033 | `types-and-tests.md` | core | T32 |  |
| TYPES-034 | `types-and-tests.md` | core | T33 |  |
| TYPES-035 | `types-and-tests.md` | core | T18 |  |
| TYPES-036 | `types-and-tests.md` | core | T19 |  |
| TYPES-037 | `types-and-tests.md` | core | T20 |  |
| TYPES-038 | `types-and-tests.md` | core | T21 (core part) |  |
| TYPES-039 | `types-and-tests.md` | core | T27 |  |
| TYPES-040 | `types-and-tests.md` | core | T22 |  |
| UI-001 | `ui-a11y-seo.md` | core | U1 |  |
| UI-002 | `ui-a11y-seo.md` | core | U2 (core part) |  |
| UI-003 | `ui-a11y-seo.md` | core | U3 (core part) |  |
| UI-004 | `ui-a11y-seo.md` | core | U72 (core part) |  |
| UI-005 | `ui-a11y-seo.md` | core | U31 |  |
| UI-006 | `ui-a11y-seo.md` | core | U40 |  |
| UI-007 | `ui-a11y-seo.md` | core | U67 |  |
| UI-008 | `ui-a11y-seo.md` | core | U41 |  |
| UI-009 | `ui-a11y-seo.md` | core | U42 |  |
| UI-010 | `ui-a11y-seo.md` | core | U43 |  |
| UI-011 | `ui-a11y-seo.md` | core | U49 |  |
| UI-012 | `ui-a11y-seo.md` | core | U65 (core part) |  |
| UI-013 | `ui-a11y-seo.md` | core | U4 |  |
| UI-014 | `ui-a11y-seo.md` | core | U71 |  |
| UI-015 | `ui-a11y-seo.md` | core | U32 |  |
| UI-016 | `ui-a11y-seo.md` | core | U33 |  |
| UI-017 | `ui-a11y-seo.md` | core | U34 |  |
| UI-018 | `ui-a11y-seo.md` | core | U35 |  |
| UI-019 | `ui-a11y-seo.md` | core | U60 |  |
| UI-020 | `ui-a11y-seo.md` | core | U6 |  |
| UI-021 | `ui-a11y-seo.md` | core | U7 |  |
| UI-022 | `ui-a11y-seo.md` | core | U8 |  |
| UI-023 | `ui-a11y-seo.md` | core | U9 |  |
| UI-024 | `ui-a11y-seo.md` | core | U10 |  |
| UI-025 | `ui-a11y-seo.md` | core | U11 |  |
| UI-026 | `ui-a11y-seo.md` | core | U12 |  |
| UI-027 | `ui-a11y-seo.md` | core | U25 |  |
| UI-028 | `ui-a11y-seo.md` | core | U53 (core part) |  |
| UI-029 | `ui-a11y-seo.md` | core | U54 |  |
| UI-030 | `ui-a11y-seo.md` | core | U55 |  |
| UI-031 | `ui-a11y-seo.md` | core | U57 |  |
| UI-032 | `ui-a11y-seo.md` | core | U58 (core part) |  |
| UI-033 | `ui-a11y-seo.md` | core | U59 |  |
| UI-034 | `ui-a11y-seo.md` | core | U61 |  |
| UI-035 | `ui-a11y-seo.md` | core | U62 |  |
| UI-036 | `ui-a11y-seo.md` | core | U64 |  |
| UI-037 | `ui-a11y-seo.md` | core | U66 |  |
| UI-038 | `ui-a11y-seo.md` | core | U68 |  |
| UI-039 | `ui-a11y-seo.md` | core | U69 |  |
| UI-040 | `ui-a11y-seo.md` | core | U38 |  |
| UI-041 | `ui-a11y-seo.md` | core | U39 (core part) |  |
| UI-042 | `ui-a11y-seo.md` | core | U46 |  |
| UI-043 | `ui-a11y-seo.md` | core | U30 |  |
| UI-044 | `ui-a11y-seo.md` | core | U48 |  |
| UI-045 | `ui-a11y-seo.md` | core | U51 |  |
| UI-046 | `ui-a11y-seo.md` | core | U26 |  |
| UI-047 | `ui-a11y-seo.md` | core | U27 |  |
| UI-048 | `ui-a11y-seo.md` | core | U36 |  |
| UI-049 | `ui-a11y-seo.md` | core | U37 |  |
| UI-050 | `ui-a11y-seo.md` | core | U50 |  |
| UI-051 | `ui-a11y-seo.md` | core | U13 |  |
| UI-052 | `ui-a11y-seo.md` | core | U45 |  |
| UI-053 | `ui-a11y-seo.md` | core | U63 |  |
| UI-054 | `ui-a11y-seo.md` | core | U52 |  |
| UI-055 | `ui-a11y-seo.md` | core | U47 (core part) |  |
| UI-056 | `ui-a11y-seo.md` | core | U14 |  |
| UI-057 | `ui-a11y-seo.md` | core | U15 |  |
| UI-058 | `ui-a11y-seo.md` | core | U16 |  |
| UI-059 | `ui-a11y-seo.md` | core | U17 |  |
| UI-060 | `ui-a11y-seo.md` | core | NX-16 |  |
| UI-061 | `ui-a11y-seo.md` | core | U18 |  |
| UI-062 | `ui-a11y-seo.md` | core | U19 |  |
| UI-063 | `ui-a11y-seo.md` | core | U20 |  |
| UI-064 | `ui-a11y-seo.md` | core | U21 |  |
| UI-065 | `ui-a11y-seo.md` | core | U22 |  |
| UI-066 | `ui-a11y-seo.md` | core | U28 (core part) |  |
| UI-067 | `ui-a11y-seo.md` | core | U29 (core part) |  |
| UI-068 | `ui-a11y-seo.md` | core | NX-17 |  |
| UI-069 | `ui-a11y-seo.md` | core | U23 |  |
| UI-070 | `ui-a11y-seo.md` | core | U24 |  |
| DESIGN-001 | `design-principles.md` | core | P1 |  |
| DESIGN-002 | `design-principles.md` | core | P2 |  |
| DESIGN-003 | `design-principles.md` | core | P3 (core part) |  |
| DESIGN-004 | `design-principles.md` | core | NX-10 |  |
| DESIGN-005 | `design-principles.md` | core | NX-12 |  |
| DESIGN-006 | `design-principles.md` | core | P4 |  |
| DESIGN-007 | `design-principles.md` | core | NX-11 |  |
| DESIGN-008 | `design-principles.md` | core | P5 |  |
| DESIGN-009 | `design-principles.md` | core | P6 |  |
| DESIGN-010 | `design-principles.md` | core | P7 |  |
| DESIGN-011 | `design-principles.md` | core | P8 |  |
| DESIGN-012 | `design-principles.md` | core | P9 |  |
| DESIGN-013 | `design-principles.md` | core | NX-13 |  |
| DESIGN-014 | `design-principles.md` | core | P10 |  |
| DESIGN-015 | `design-principles.md` | core | P11 |  |
| DESIGN-016 | `design-principles.md` | core | P12 |  |
| DESIGN-017 | `design-principles.md` | core | P13 |  |
| DESIGN-018 | `design-principles.md` | core | P14 |  |
| DESIGN-019 | `design-principles.md` | core | P15 |  |
| DESIGN-020 | `design-principles.md` | core | P16 |  |
| ACCESS-001 | `access-and-security.md` | core | A1 |  |
| ACCESS-002 | `access-and-security.md` | core | A2 |  |
| ACCESS-003 | `access-and-security.md` | core | A8 (core part) |  |
| ACCESS-004 | `access-and-security.md` | core | A9 (core part) |  |
| ACCESS-005 | `access-and-security.md` | core | A3 |  |
| ACCESS-006 | `access-and-security.md` | core | NX-02 |  |
| ACCESS-007 | `access-and-security.md` | core | A4 |  |
| ACCESS-008 | `access-and-security.md` | core | A16 |  |
| ACCESS-009 | `access-and-security.md` | core | NX-01 |  |
| ACCESS-010 | `access-and-security.md` | core | Layer calls tab (written fresh) |  |
| ACCESS-011 | `access-and-security.md` | core | A10 (core part) |  |
| ACCESS-012 | `access-and-security.md` | core | A11 (core part) |  |
| ACCESS-013 | `access-and-security.md` | core | A12 |  |
| ACCESS-014 | `access-and-security.md` | core | A13 (core part) |  |
| ACCESS-015 | `access-and-security.md` | core | A14 (core part) |  |
| TOOLING-001 | `tooling.md` | core | C1 |  |
| TOOLING-002 | `tooling.md` | core | C2 (core part) |  |
| TOOLING-003 | `tooling.md` | core | C3 |  |
| TOOLING-004 | `tooling.md` | core | C4 (core part) |  |
| TOOLING-005 | `tooling.md` | core | C5 |  |
| TOOLING-006 | `tooling.md` | core | C6 (core part) |  |
| TOOLING-007 | `tooling.md` | core | C7 (core part) |  |
| TOOLING-008 | `tooling.md` | core | C8 |  |
| TOOLING-009 | `tooling.md` | core | C9 |  |
| TOOLING-010 | `tooling.md` | core | C10 |  |
| TOOLING-011 | `tooling.md` | core | C11 |  |
| TOOLING-012 | `tooling.md` | core | C12 |  |
| UNTRUSTED-001 | `add-ons/untrusted-content.md` | add-on:untrusted-content | D34 |  |
| UNTRUSTED-002 | `add-ons/untrusted-content.md` | add-on:untrusted-content | D35 |  |
| UNTRUSTED-003 | `add-ons/untrusted-content.md` | add-on:untrusted-content | D36 |  |
| UNTRUSTED-004 | `add-ons/untrusted-content.md` | add-on:untrusted-content | D37 |  |
| UNTRUSTED-005 | `add-ons/untrusted-content.md` | add-on:untrusted-content | D75 |  |
| UNTRUSTED-006 | `add-ons/untrusted-content.md` | add-on:untrusted-content | U56 |  |
| UNTRUSTED-007 | `add-ons/untrusted-content.md` | add-on:untrusted-content | S28 (untrusted-content clause) |  |
| UNTRUSTED-008 | `add-ons/untrusted-content.md` | add-on:untrusted-content | D18 (untrusted-content clause) |  |
| UNTRUSTED-009 | `add-ons/untrusted-content.md` | add-on:untrusted-content | T35 (untrusted-content clause) |  |
| UNTRUSTED-010 | `add-ons/untrusted-content.md` | add-on:untrusted-content | A8 (untrusted-content clause) |  |
| SYNTAX-001 | `add-ons/syntax-highlighting.md` | add-on:syntax-highlighting | D17 |  |
| SYNTAX-002 | `add-ons/syntax-highlighting.md` | add-on:syntax-highlighting | D16 (syntax-highlighting clause) |  |
| SENTRY-001 | `add-ons/sentry.md` | add-on:sentry | D39 |  |
| SENTRY-002 | `add-ons/sentry.md` | add-on:sentry | D40 |  |
| SENTRY-003 | `add-ons/sentry.md` | add-on:sentry | D19 (Sentry clause) |  |
| SENTRY-004 | `add-ons/sentry.md` | add-on:sentry | D69 (Sentry clause) |  |
| SENTRY-005 | `add-ons/sentry.md` | add-on:sentry | D30 (Sentry clause) |  |
| SENTRY-006 | `add-ons/sentry.md` | add-on:sentry | D41 (Sentry clause) |  |
| SENTRY-007 | `add-ons/sentry.md` | add-on:sentry | A9 (Sentry clause) |  |
| SENTRY-008 | `add-ons/sentry.md` | add-on:sentry | A10 (Sentry clause) |  |
| SENTRY-009 | `add-ons/sentry.md` | add-on:sentry | A14 (Sentry clause) |  |
| SENTRY-010 | `add-ons/sentry.md` | add-on:sentry | C6 (Sentry clause) |  |
| TURNSTILE-001 | `add-ons/turnstile.md` | add-on:turnstile | D47 |  |
| TURNSTILE-002 | `add-ons/turnstile.md` | add-on:turnstile | D48 |  |
| TURNSTILE-003 | `add-ons/turnstile.md` | add-on:turnstile | D16 (Turnstile clause) |  |
| TURNSTILE-004 | `add-ons/turnstile.md` | add-on:turnstile | D30 (Turnstile clause) |  |
| TURNSTILE-005 | `add-ons/turnstile.md` | add-on:turnstile | A10 (Turnstile clause) |  |
| RADIX-001 | `add-ons/radix.md` | add-on:radix | U70 |  |
| RADIX-002 | `add-ons/radix.md` | add-on:radix | D16 (Radix clause) |  |
| RADIX-003 | `add-ons/radix.md` | add-on:radix | U53 (Radix clause) |  |
| RADIX-004 | `add-ons/radix.md` | add-on:radix | U39 (Radix clause) |  |
| HEROICONS-001 | `add-ons/heroicons.md` | add-on:heroicons | U44 |  |
| HEROICONS-002 | `add-ons/heroicons.md` | add-on:heroicons | S23 (Heroicons clause) |  |
| PLAUSIBLE-001 | `add-ons/plausible.md` | add-on:plausible | D50 |  |
| PLAUSIBLE-002 | `add-ons/plausible.md` | add-on:plausible | D41 (Plausible clause) |  |
| PLAUSIBLE-003 | `add-ons/plausible.md` | add-on:plausible | A10 (Plausible clause) |  |
| AXIOS-001 | `add-ons/axios.md` | add-on:axios | D27 (axios clause) |  |
| AXIOS-002 | `add-ons/axios.md` | add-on:axios | D71 (axios clause) |  |
| CMDK-001 | `add-ons/cmdk.md` | add-on:cmdk | U39 (cmdk clause) |  |
| MUTATION-001 | `add-ons/mutation-testing.md` | add-on:mutation-testing | NX-15 |  |
| CF-001 | `overlays/cloudflare.md` | cloudflare | I1 |  |
| CF-002 | `overlays/cloudflare.md` | cloudflare | I3 |  |
| CF-003 | `overlays/cloudflare.md` | cloudflare | I4 |  |
| CF-004 | `overlays/cloudflare.md` | cloudflare | I5 |  |
| CF-005 | `overlays/cloudflare.md` | cloudflare | I6 |  |
| CF-006 | `overlays/cloudflare.md` | cloudflare | I7 |  |
| CF-007 | `overlays/cloudflare.md` | core | I9 | Holds on any host. No `Tags:` line. |
| CF-008 | `overlays/cloudflare.md` | core | I10 (core part) | Holds on any host. No `Tags:` line. |
| CF-009 | `overlays/cloudflare.md` | cloudflare | I11 |  |
| CF-010 | `overlays/cloudflare.md` | cloudflare | S11 (Cloudflare clause) |  |
| CF-011 | `overlays/cloudflare.md` | cloudflare | D1 (Cloudflare clause) |  |
| CF-012 | `overlays/cloudflare.md` | cloudflare | D8 (Cloudflare clause) |  |
| CF-013 | `overlays/cloudflare.md` | cloudflare | D27 (Cloudflare clause) |  |
| CF-014 | `overlays/cloudflare.md` | cloudflare | D30 (Cloudflare clause) |  |
| CF-015 | `overlays/cloudflare.md` | cloudflare | D57 (Cloudflare clause) |  |
| CF-016 | `overlays/cloudflare.md` | cloudflare | T34 (Cloudflare clause) |  |
| CF-017 | `overlays/cloudflare.md` | cloudflare | T31 (Cloudflare clause) |  |
| CF-018 | `overlays/cloudflare.md` | cloudflare | U47 (Cloudflare clause) |  |
| CF-019 | `overlays/cloudflare.md` | cloudflare | A10 (Cloudflare clause) |  |
| CF-020 | `overlays/cloudflare.md` | cloudflare | A11 (Cloudflare clause) | Kept for the A11 Cloudflare clause. If the overlay leaves the slot unused, the id stays reserved and is never reused. |
| CF-021 | `overlays/cloudflare.md` | cloudflare | C4 (Cloudflare clause) |  |
| CF-022 | `overlays/cloudflare.md` | cloudflare | C7 (Cloudflare clause) |  |
| CF-023 | `overlays/cloudflare.md` | cloudflare | I2 (Cloudflare clause) |  |
| CF-024 | `overlays/cloudflare.md` | cloudflare | I10 (Cloudflare clause) |  |
