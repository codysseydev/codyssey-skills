---
paths:
  - 'src/**'
  - 'app/**'
  - 'docs/**'
  - 'CLAUDE.md'
  - '.ai/rules/**'
---

# Code Structure: Features, Imports, Server vs Client, Naming, Docs

Where code lives in the app: feature folders, exports, the direction of imports, server
and client components, file names, where types and enums live, shared code and pages,
what stays out of the tree, and docs and rule files.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.

## Features

- **STRUCT-001. Product code lives in a feature folder.** Code for one product area goes in `src/features/<kebab-name>/`, with the entry component `<FeatureName>.tsx` at the folder root, named after its folder, and subfolders `components/`, `hooks/`, `services/`, `store/`, `types/`, `utils/`, `constants/`, `tests/` and `stories/` created as needed. Flag product code added to `src/lib/` or to a type-named folder outside a feature. **SHOULD.**
  - Why: one folder per product area holds everything that area needs, so a change to `shipments` touches one folder instead of a file in each of five type-named folders.
  - Source: Feature Modules vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/38 - Feature Modules.md
  - Source: Why Your Laravel Codebase Is Unmaintainable vault: Content/Insights/Why Your Laravel Codebase Is Unmaintainable.md
  - From: S1
- **STRUCT-002. Pages are thin.** A file in `app/**/page.tsx` reads `params`, builds metadata, and renders one feature entry component. No data shaping, no business logic. **SHOULD.**
  - Why: a page's job is to turn a route into a feature render, so the logic stays in the feature, where a test reaches it without the router.
  - Source: Stop Putting Business Logic in Symfony Controllers vault: Content/Insights/Stop Putting Business Logic in Symfony Controllers.md
  - From: S2
- **STRUCT-003. Logic is separate from UI.** Parsing, formatting, filtering and decision logic live in `utils/`, `hooks/` or `services/`, so it can be tested without rendering. See DESIGN-002. **SHOULD.**
  - Why: logic with no rendering in it runs in a test without a DOM and serves a second caller, for example a stock-level filter that both the inventory list and its CSV export use.
  - Source: Never Inject a Controller Into Another Controller https://codyssey.dev/quick-tips/never-inject-a-controller-into-another-controller
  - From: S3
- **STRUCT-004. Shared code has a fixed home.** Cross-feature utilities go in `src/lib/`, constants in `src/constants/`, React providers in `src/providers/`, the API client in `src/lib/apiClient.ts`, global types in `src/types/`, page-route constants in `src/constants/routes.ts` (STRUCT-030), and shared icon components in `src/features/global-ui/icons/` (STRUCT-008). **SHOULD.**
  - Why: with one home for each kind of shared code, a reader knows where to look before writing a second copy of a helper.
  - From: S4
- **STRUCT-005. Each feature has one entry component** at the folder root, a named export like every other module (STRUCT-009). A component and its file carry the same name. A component named after a case it does not cover is renamed for what it renders (`ErrorPanel` to `StatusPanel`). A `global-ui` component that shares its name with a wrapper in `app/` takes a `Site` prefix (`Header` to `SiteHeader`, `Footer` to `SiteFooter`). **SHOULD.**
  - Why: one entry gives each page one import per feature, and a name that matches its file and what it renders lets a reader find a component from its tag.
  - From: S5
- **STRUCT-006. A nested module repeats the feature layout.** A sub-area of a feature (`inventory/stock-levels/`, `shipments/components/TrackingPanel/`) uses the same subfolder names as a feature, so a reader finds `hooks/` and `tests/` in the same places. `global-ui` is a flat catalog of components and is exempt. **SHOULD.**
  - Why: a reader who knows one feature's layout finds the hooks and tests of any sub-area without searching.
  - From: S6
- **STRUCT-007. `constants/` holds a feature's constants.** Do not create `config/`, `consts/` or `data/` for the same purpose. **SHOULD.**
  - Why: one folder name for one kind of file lets a reader, and a search for `constants/`, find every constant of a feature.
  - From: S7
- **STRUCT-008. Shared icon components live in `src/features/global-ui/icons/`**, with PascalCase file names. **SHOULD.**
  - Why: one folder of shared icons lets a feature reuse an icon instead of pasting its SVG, for example one `TruckIcon` that `shipments` and `inventory` both import.
  - From: S23 (core part)

## Exports

- **STRUCT-009. Named exports, except where a framework loads the default.** Every module uses named exports, components included. A default export stays for `app/` special files (`page.tsx`, `layout.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`) and metadata files (`manifest.ts`, `sitemap.ts`), because Next.js requires it, for the `meta` default export of `*.stories.tsx` files, for Storybook mock aliases that Storybook loads by default, and for root tool config files. A lazy target is imported as `dynamic(() => import('@/features/x/Name').then((m) => m.Name))`, and `React.lazy` takes the named export through `.then((m) => ({ default: m.Name }))`. **SHOULD.**
  - Why: a named export keeps one name from the definition to every import, so search and rename find every use, which a default export renamed at each import breaks.
  - From: S21

## Imports and dependency direction

- **STRUCT-010. Use the `@/` alias for imports that leave the current feature folder.** A relative import (`./`) is for a file in the same folder, `src/lib` and `src/providers` included (`@/lib/...` for a sibling inside `src/lib` is a finding). A feature never reaches another feature or `src/lib` with `../`, and never writes `@/features/<own>` to reach its own folder. **SHOULD.**
  - Why: a file that moves keeps its cross-feature imports valid, and a feature stays relocatable.
  - From: S8
- **STRUCT-011. Only `global-ui` is shared across features.** Any feature may import `global-ui`. Any other feature-to-feature import needs a reason in the PR and must not create a cycle. `global-ui` imports no domain feature. Pure types, enums and leaf constants that several features need from one feature live outside it: types and enums in `src/types`, constants in `src/constants`, functions and classes in `src/lib`, and components in `global-ui`. A `global-ui` component that needs a feature's control takes it as a slot, and the layout in `app/` that renders the component passes the real control in. Story helpers under `src/features/global-ui/*/stories/` may import a feature to fill the slots, because STRUCT-014 does not scan `stories/`. **SHOULD.**
  - Why: an import of another feature's internals breaks when that feature changes, and a cycle means neither feature can move alone, for example a `shipments` component that imports a hook from `inventory/hooks/`.
  - From: S9 (core part)
- **STRUCT-012. Dependencies point one way:** `app/` to `src/features/` to `src/lib`, `src/providers`, `src/constants` and `src/types`. Nothing in `src/lib`, `src/providers`, `src/constants` or `src/types` imports `src/features/**`, and nothing in `src/` imports `app/`. A type that `src/lib` needs moves to `src/types/` or into `src/lib`. **SHOULD.**
  - Why: shared code that imports a feature drags that feature into every caller, for example a date helper in `src/lib` that imports a type from `inventory` makes every feature depend on `inventory`.
  - From: S10
- **STRUCT-013. Server-only modules import `server-only`.** Every `*.server.ts` module, and any other module that must never reach the browser, starts with `import 'server-only'`. **SHOULD.**
  - Why: the import makes the build fail when a client component imports the module, so server code and the secrets it reads never ship to the browser.
  - Check: guard-test row STRUCT-013 (every module on the server-only list starts with `import 'server-only'`).
  - Source: Server and Client Components, "Preventing environment poisoning" https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning
  - From: S11 (core part)
- **STRUCT-014. Import boundaries are tested.** The guard test fails on a break of STRUCT-011 or STRUCT-012: an import of `src/features/**` from `src/lib`, `src/providers`, `src/constants` or `src/types`, and a feature-to-feature import outside the allowed-pairs list in the test. The list starts empty. Each pair added to it carries a reason, and a pair that no import uses is an error. Test files, stories and `tests/` folders are not scanned. **SHOULD.**
  - Why: review alone does not hold an import boundary, because reviewers tire, and a test fails on the first import that crosses it, for example a `shipments` hook that starts importing from `inventory/services/`.
  - Check: guard-test row STRUCT-014 (import boundaries).
  - Source: 7 PHP Code Quality Tools That Pay Off Years Later https://codyssey.dev/insights/7-php-tools-that-pay-off-three-years-from-now
  - Source: Feature Modules vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/38 - Feature Modules.md
  - From: S12

## Server and client components

- **STRUCT-015. `'use client'` only when required.** The directive is for event handlers, state or effect hooks, and browser APIs. Files under `app/**/page.tsx` never carry it. A small component that only passes fixed titles and labels to a shared component is allowed, because it holds the page's copy, and it carries no `'use client'` unless it needs one. **SHOULD.**
  - Why: a `'use client'` file and everything it imports ship to the browser as JavaScript, so a needless directive grows the bundle, for example on a loading skeleton with no state or handlers.
  - From: S13
- **STRUCT-016. Server entries never touch browser APIs.** A page, layout or route handler, and the server-only modules it imports, must not use `window`, `document`, `localStorage` or `navigator`, nor `useState` or `useEffect`. Hooks and utils that only client files import are out of scope. **SHOULD.**
  - Why: a server entry runs where `window`, `localStorage` and React state hooks do not exist, so using one throws at render or build time.
  - From: S14
- **STRUCT-017. `params` and `searchParams` are Promises in Next.js 16.** Type them as `Promise<...>` and `await` them. **MUST.**
  - Why: Next.js 16 passes both as Promises, so code that reads a property without `await` gets `undefined` instead of the route value.
  - From: S15
- **STRUCT-018. Prefer server rendering.** Keep data fetching and static markup in server components and pass plain props to client components. A client component is never `async`, and props crossing the server to client boundary are serializable (no functions, `Date`, `Map`, `Set` or class instances). **SHOULD.**
  - Why: server components keep their code out of the browser bundle, and every prop that crosses to a client component is serialized, so a function or a class instance cannot cross.
  - Source: Server and Client Components https://nextjs.org/docs/app/getting-started/server-and-client-components
  - From: S16
- **STRUCT-019. No `export const runtime` in `app/`.** Routes and pages use the default Node.js runtime. **SHOULD.**
  - Why: Next.js renders on the Node.js runtime by default and marks the edge runtime deprecated, so a `runtime` export only adds a choice that can break a route that imports a package needing a Node.js API.
  - Source: Route Segment Config, runtime https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime
  - From: S22

## File naming

- **STRUCT-020. File names follow the suffix table.** **SHOULD.**

  | Kind           | Name                              | Lives in                            |
  | -------------- | --------------------------------- | ----------------------------------- |
  | Component      | `PascalCase.tsx`                  | `components/` or feature root       |
  | Hook           | `useCamelCase.ts`                 | `hooks/`                            |
  | Store          | `camelCase.store.ts`              | `store/`                            |
  | Types          | `camelCase.types.ts`              | `types/`                            |
  | Enums          | `camelCase.enums.ts`              | `types/`                            |
  | Service        | `camelCase.service.ts`            | `services/`, `src/lib/`             |
  | Server fetcher | `camelCase.server.ts`             | `services/`, `src/lib/`             |
  | Constants      | `camelCase.ts`, no suffix         | `constants/`, `src/constants/`      |
  | Utils          | `camelCase.ts`, no suffix         | `utils/`                            |
  | Test           | `Name.test.ts` or `Name.test.tsx` | `tests/` (see TYPES-017, TYPES-018) |
  | Story          | `Name.stories.tsx`                | `stories/`                          |

  - A server-only fetcher is named `<subject>.server.ts` (`shipments.server.ts` next to the client `shipments.service.ts`) and starts with `import 'server-only'` (STRUCT-013).
  - The folder is `services/`, never `service/`.
  - A shared type file in `src/types/` is named after the subject it types (`shipmentTracking.types.ts`, `inventoryFilters.enums.ts`).
  - A module of render functions that is not one component is camelCase in `components/` (`shipments/components/shipmentSections.tsx` exports `renderShipmentSections`).
  - Why: a reader finds a file by what it is, and a guard or lint rule can select files by suffix, as STRUCT-027 does for `*.enums.ts` and `*.types.ts`.
  - From: S17
- **STRUCT-021. Files in `constants/` and `utils/` have plain camelCase names**, with no `.constants.ts` or `.utils.ts` suffix (the two rows of the STRUCT-020 table). Examples: `constants/shipmentCarriers.ts`, `utils/styles.ts`. A file is never called `constants.ts`. **SHOULD.**
  - Why: the folder already says what the file holds, so a suffix repeats it, and a file named `constants.ts` says nothing about its subject.
  - From: S24
- **STRUCT-022. A service object is named `<thing>Service`.** The exported object of a `*.service.ts` file is `shipmentService`, not `shipmentApi` or `shipmentAuth`. `*Auth` is for sign-in, sign-up, password and logout flows only. A file exports one object, not a class plus an object wrapper. A generic constant, type, service or store name takes the feature's subject (`shipmentStatusLabels`, not `statusLabels`). **SHOULD.**
  - Why: one suffix makes every API object of the app findable by one pattern, and `*Auth` marks the few objects that change the session. This differs from the PHP lesson [The Service Pattern](https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-service-pattern), which drops `Service` as a default class suffix: the pack is TypeScript, and this rule names the exported object of a `*.service.ts` file, not a class.
  - From: S29
- **STRUCT-023. A props type is named `<Component>Props`**, not `Props`. **SHOULD.**
  - Why: a named props type can be imported and searched for, and in a type error `ShipmentCardProps` says which component it belongs to, where `Props` does not.
  - From: S32

## Where types and enums live

- **STRUCT-024. Types live in the feature's `types/` folder** in `*.types.ts` files, next to the feature that owns them. A component's own props type may stay in the component file. `src/types/` holds only types and enums shared by several features, such as form enums and ambient `.d.ts` files. **SHOULD.**
  - Why: types next to their feature move and get deleted with it, and `src/types/` stays a short list of what several features share.
  - From: S18
- **STRUCT-025. Enums live in `types/*.enums.ts`**, never inside components, hooks or services. **SHOULD.**
  - Why: with one home for enums, a reader and a guard find every enum in the same place, and a component file does not grow a second copy of one.
  - From: S19
- **STRUCT-026. Stores live in `store/*.store.ts`.** State-choice and store-shape rules are in `data-and-rendering.md`. **SHOULD.**
  - Why: a store holds state that several components share, and a fixed folder and suffix make every store findable by one pattern.
  - From: S20
- **STRUCT-027. `*.enums.ts` and `*.types.ts` hold no runtime values.** `types/*.enums.ts` contains enums only, and `types/*.types.ts` contains types only, with no class, function or constant. A constant goes in `constants/` (STRUCT-007), and an error class or predicate in `utils/` or `src/lib`. A value several features must agree on, such as the page size, is defined once in `src/constants/`. **MUST.**
  - Why: a type file that holds runtime code runs it on every import, and a value defined twice drifts, for example two page sizes that disagree on where page two starts.
  - Check: guard-test row STRUCT-027 (`*.enums.ts` files export only enums, and `*.types.ts` files export only types).
  - From: S31

## Shared code and pages

- **STRUCT-028. One definition per helper, service method, component, page scaffold, constant and mutation hook.** Before writing one, search `src/lib` and the feature's `utils/`. A second definition of the same job is a finding, and a local copy with a different regex counts as a second definition, not a variant. Something two features need goes to `src/lib`, or to `global-ui` for a component. **SHOULD.** The cases that recur:
  - a. Pure helpers: title-case a slug (`capitalizeSlug`), truncate (`truncateText`), sort newest first (`newestFirst`), wait (`wait`), and format a date, a price or a count. All live in `src/lib`, with one definition each, such as `formatPublishDate` in `src/lib/formatDate.ts`, `normalizeExternalUrl` and `capitalizeFirst`. Dates and prices: DATA-059. URLs: ACCESS-003.
  - b. A count followed by a noun goes through `formatCount(count, 'pallet')` in `src/lib/formatCount.ts`, with an irregular plural passed as the third argument. A new inline `count === 1 ? 'x' : 'xs'` is a finding. The noun alone, with no count, goes through `pluralize(count, singular, plural)` in the same file.
  - c. Service methods: cookies are read with `getCookie` in `src/lib/getCookie.ts`, and the CSRF cookie request is `csrfService.initializeCsrf` in `src/lib/csrf.service.ts`. Sign-out and sign-in do not expire cookies from script (ACCESS-008).
  - d. Components: a feature component that does the job of a `global-ui` component wraps it, as its sibling components do, instead of copying its markup.
  - e. Constants: slug-to-title is `capitalizeSlug` in `src/lib/capitalizeSlug.ts`.
  - f. A piece rebuilt "to match" another and announced by a comment (`Mirrors DEFAULT_VARIANT`, `Same markup as renderRow`) is a second definition. Import the original instead.
  - g. A class string of six or more utilities written in three or more files becomes one shared constant.
  - h. Page scaffolds: pages of one kind share one layout component, such as `StaticPageLayout` (breadcrumb, spacer, text column) for static text pages, not a copy of its grid.
  - i. Mutation hooks: the same `useMutation`, error report and toast skeleton repeated across hooks is one `useFeatureMutation` wrapper (see DATA-032 for what it owns).
  - Why: two copies of one job drift, and a fix lands in one while the other keeps the bug, for example two date formatters that disagree on the time zone.
  - From: S28 (core part)
- **STRUCT-029. Page protocol steps are shared, not pasted.** The fetch-or-404 step of a server page (`try { fetch } catch { isNotFoundError -> notFound(); throw }`) is one helper `loadOrNotFound(fetcher)`, and the out-of-range check of an archive page is one helper `assertInRange(page, items)`, both in `src/lib/pageData.ts`. The build step follows the fetch: the page data (the JSON-LD and the record the page shows) is built in a function that returns one object, not in several `let` variables assigned inside one `try`. `export const dynamic` and `revalidate` stay literal in each page, because Next.js reads them statically. A page whose only error handling goes through `loadOrNotFound` is correct, and the helper rethrows every error that is not a not-found. **SHOULD.**
  - Why: a pasted `try` and `catch` drifts from page to page, and one page that swallows an error shows a 404 for an outage.
  - From: S30
- **STRUCT-030. Internal page routes come from `src/constants/routes.ts`.** A path to one of the app's own pages (`/sign-in`, `/inventory?tab=archived`, `shipmentRoute(id)`) is an exported constant or a small builder, so a rename touches one file. A `?redirect=` value is built from it with `encodeURIComponent` (ACCESS-002). Literal paths stay in `app/` folder names, the `next.config` file, sitemap data and tests. The rule mirrors DATA-044 for API paths. **SHOULD.**
  - Why: a page rename touches one file instead of every link to the page, for example moving `/inventory` to `/stock`.
  - From: S33
- **STRUCT-031. A function that calls no hook is not named `use<Thing>`.** React and the rules-of-hooks lint rule treat every `use*` name as a hook, so a caller may not call it in a condition or outside a component. A function that calls no `useState`, `useMemo` or other hook is named with a verb and lives outside `hooks/`: `useShipmentTransform` in `shipments/hooks/` becomes `fromApiShipments` in `shipments/utils/`. **SHOULD.**
  - Why: a `use*` name puts the rules of hooks on a plain function, so callers cannot call it in a condition or a loop even though nothing requires it.
  - From: S34

## What stays out of the tree

- **STRUCT-032. No dead code.** A change deletes what it makes unused. The tree keeps no module without an importer (outside its own tests and stories), no file that is only commented-out code, no block of commented-out code, and no state nobody reads: a store field, hook return value or component prop with no reader is removed. `knip` (`pnpm knip`, a blocking CI step, with entry points set once in `knip.json`) checks the first half and reports unused packages. The second half is review. **SHOULD.**
  - Why: dead code still costs reading time, search hits and upgrade work, and a reader cannot tell it is dead, for example an unused export that every refactor keeps updating.
  - From: S27

## Docs and rule files

- **STRUCT-033. A doc names major versions only.** Version numbers live in `package.json`. A doc that must name a tool writes "Next.js 16", not "16.1.1". An MDX page or doc does not restate a value the code defines (sizes, class strings, prop tables). It links to the file. **SHOULD.**
  - Why: a patch number in a doc goes stale with the next upgrade, and a restated value drifts from the code it copies.
  - From: S25

## What is NOT a violation

- Relative imports within one feature folder.
- Hooks and components outside feature folders in `src/lib/` and `src/providers/` (`useAuth`, `useMediaQuery`): shared by design.
- Tests beside their file in `src/lib/` and `app/`: see TYPES-018.
