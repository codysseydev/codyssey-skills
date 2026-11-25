---
paths:
  - 'src/**/*.ts'
  - 'src/**/*.tsx'
  - 'app/**/*.ts'
  - 'app/**/*.tsx'
  - '**/tests/**'
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/*.stories.tsx'
  - 'vite.config.ts'
  - 'vitest.setup.ts'
  - 'tsconfig*.json'
  - 'package.json'
---

# Types and Tests

Typing, where tests live and what shape they take, and what a change ships with.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.

## Typing

- **TYPES-001. TypeScript strict mode stays on.** `tsconfig.json` sets `"strict": true`; do not loosen it. The typecheck script runs in CI and also checks stories, which `tsconfig.json` includes. **MUST.**
  - Why: strict mode turns on the null checks and implicit-`any` errors the other typing rules rely on, and loosening it hides those errors in every file at once.
  - From: T1
- **TYPES-002. No `any`, no implicit `any`.** Use `unknown` and narrow, or a real type. **MUST.**
  - Why: `any` switches off checking for every value it touches, so one untyped response spreads unchecked fields into each component that reads it.
  - Check: Oxlint `typescript/no-explicit-any`.
  - From: T2
- **TYPES-003. Type every service response.** Pass the response type to the call, `apiClient.get<OrderResponse>(...)`, and give the service function an explicit return type. Whenever the code reads the body, the call has a type argument. A call that ignores the body is exempt. **SHOULD.**
  - Why: an untyped `response.data` is `any`, which TYPES-002 bans, and every field read from it escapes the type checker.
  - From: T3
- **TYPES-004. Type API boundaries once.** Response and request shapes are declared in the feature's `types/*.types.ts` and imported; do not re-declare the shape inline in a component or hook. **SHOULD.**
  - Why: the frontend already restates each backend response in TypeScript and nothing checks that the two agree; a second inline copy can drift from both.
  - Source: The Honest Cost of Two Repos vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/42 - The Honest Cost of Two Repos.md
  - From: T4
- **TYPES-005. Use `type` for object shapes, including component props.** Extend with an intersection (`type A = B & { ... }`); there is no exception for `interface ... extends`. Augmenting a global (`Window`, `Navigator`) inside `declare global` stays `interface`, with `// oxlint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging only`. **MUST.**
  - Why: one form for every object shape ends the choice in review, and two `interface` declarations with one name merge silently where two `type` declarations fail to compile.
  - Check: Oxlint `typescript/consistent-type-definitions` set to `'type'`.
  - From: T5
- **TYPES-006. Use an enum when the value set is meaningful and reused** (event names, states, categories the code switches on). Enums live in `types/*.enums.ts` (STRUCT-020). A string union is fine for a short local set. A set is declared once: not as a union in `*.types.ts` and an enum in `*.enums.ts`. **SHOULD.**
  - Why: a set declared twice drifts when one copy gains a member, and the code that switches on the other copy never sees it.
  - From: T6 (core part)
- **TYPES-007. Co-locate types with the feature** in its `types/` folder (STRUCT-024, STRUCT-025). **SHOULD.**
  - Why: a type that sits in the feature that owns it moves and is deleted with that feature.
  - From: T7
- **TYPES-008. An API type lists only the fields its backend resource returns; fixtures mirror it; entity ids are `string`.** Cite the backend resource class in a comment on the type. A fixture is a recorded response or is built from the exported type. A field the resource can send as null is `| null`, and the fixtures include a null case. A mapper does not coerce null to `''`: a sentinel hides the difference. A nested object counts too: when the record has no customer profile, `Order['customer']` has null fields, and the type says so. Entity ids are typed `string` where the backend casts them; check each against its resource class first. A resource that sends a number is typed `number` or mapped in the service (DESIGN-009). The API client does not rewrite ids: a response is plain JSON, so an id typed `string` is a string the resource sends. A service sends only the query params the backend request accepts, and a comment names the controller or request class; a param the endpoint ignores is removed. A service lists the body fields it sends, the same way it lists query params; it does not spread form values or a whole object into the request body, so a UI-only field (`confirmPassword`, a captcha flag) or a stale field cannot reach the API. **SHOULD.**
  - A block or union the backend sends wider than the type is widened in the type, with a guard for the narrow case, never widened locally at one read. A test builds the wide block without `as unknown as`: type the array as the exported type and hold an extra-field block in a variable.
  - A payload the backend sends as `null` is typed `| null` on the envelope, and every reader is fixed, not one read widened.
  - Why: a fixture proves something only when it matches the response it stands in for, ids reach the app as the backend sends them, and a request body that lists its fields cannot carry a field the API should not get.
  - Source: Test Doubles - Mocks, Stubs, Fakes and Spies https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/test-doubles-mocks-stubs-fakes-and-spies
  - Source: The Honest Cost of Two Repos vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/42 - The Honest Cost of Two Repos.md
  - Source: Don't Spread validated() Into create() https://codyssey.dev/quick-tips/dont-spread-validated-into-create
  - From: T24
- **TYPES-009. A new API field is optional until the caches have turned over.** A field the backend has just added is typed `?:` (and `| null` when the column is nullable) in the response type until every cached response that predates it is gone. The type carries a one-line comment naming the backend change. Code reads it defensively and the page renders without it. Remove the `?` in a later change, once the CDN or cache window has passed. Temporary compat code follows the same rule: a fallback that stands in for something the backend has not shipped yet names its removal condition in a comment and is deleted then (STRUCT-032 covers the dead code after that). For example, a branch that reads an old status field "until the backend ships `fulfillment_state`" goes once that field ships. **SHOULD.**
  - Why: a response cached before the deploy lacks the new field, so code typed as if the field were always there reads `undefined` until the cache turns over.
  - From: T34 (core part)
- **TYPES-010. Type assertions are for `as const`, brands and test fixtures.** In production code `as X` is allowed for `as const`, for a branded type, for DOM lookups, and inside the body of a type-guard function (a guard that checks `includes` on a readonly tuple needs `value as Status`). Everything else narrows with a type guard, a generic parameter, `satisfies` or a discriminated union. A non-null assertion `!` follows the same rule: do not use it where an earlier guard already narrows. `as unknown as` is for tests only. Exception, a correlated-union Record lookup: a table typed `{ [K in U['type']]: (s: Extract<U, { type: K }>) => R }` is dispatched with one cast at the lookup, `(table[u.type] as (s: U) => R)(u)`, because TypeScript cannot correlate `table[u.type]` with `u`. Keep it to that one site, guard unknown kinds with `Object.hasOwn` first, and comment the cast with `TYPES-010`. Example: a `renderBlock` table that maps each block type of a page to its renderer. **SHOULD.**
  - Why: an assertion tells the compiler to stop checking, and `typescript/no-explicit-any` (TYPES-002) does not see `as`.
  - From: T35 (core part)
- **TYPES-011. A field that many resources share is declared once.** A field carried by several API resources (for example `slug`, or `created_at` and `updated_at`) is a small shared type in the owning feature or `src/types/`, and is intersected into each resource type. A new such field is added in one place. This extends TYPES-004, which forbids re-declaring a response shape inline but not a field shared across shapes. **SHOULD.**
  - Why: a field declared by hand in many types changes in one of them and not the others, so its type drifts from resource to resource.
  - From: T36
- **TYPES-012. A mapper does not invent data.** A function that maps an API response to a UI shape leaves an absent field absent (`undefined` or `null`). It does not fill in a placeholder duration, difficulty, description or flag. A util does not compare against a backend placeholder either: the mapper turns the sentinel into an absent value and the util tests for absence. **SHOULD.**
  - Why: an invented placeholder looks like real data, so the UI shows a value the backend never sent and no later code can tell the two apart.
  - From: T37 (core part)
- **TYPES-013. An API response type is named for its resource.** `OrdersResponse`, `InvoiceResponse`, never `ApiResponse`, and it is not renamed with `as` on import to avoid a clash. **SHOULD.**
  - Why: a generic name clashes across features, and the `as` rename that works around the clash gives one type two names.
  - From: T38
- **TYPES-014. A list of enum values used with `.includes` is typed with the enum.** `OrderStatus[]` or `ReadonlySet<OrderStatus>`, not `string[]`. A `Record<string, X>` that maps each value to itself is a membership check too: test membership against the enum values and keep the enum type. **SHOULD.**
  - Why: a `string[]` widens the argument of `.includes`, so any string passes the check and a misspelled status compiles.
  - From: T39
- **TYPES-015. A `switch` that remains over a union or enum ends in a `never` check.** A kind that maps to a static value or a handler uses a `Record<Kind, handler>` typed by the union instead of a `switch` (DESIGN-015), so a new kind fails to compile. The helper `src/lib/exhaustiveFallback.ts` takes the `never` value and returns a fallback at run time instead of throwing. **MUST.**
  - Why: a `switch` with no exhaustive end still compiles when the union gains a member, so the new kind falls through unnoticed; the `never` check turns that into a compile error.
  - Check: guard-test row TYPES-015.
  - Source: The State Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-state-pattern
  - From: T26
- **TYPES-016. Extra `tsconfig` flags are on.** `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUncheckedSideEffectImports`, `noUnusedParameters` and `noUncheckedIndexedAccess` are set. Prefix a parameter you must accept but do not read with `_`. `tsconfig.json` holds the flags and serves `next build` and type-aware lint. The typecheck script runs it, and stories and `.storybook` are inside it, so they get the same flags. `tsconfig.scripts.json` covers `scripts/` (TOOLING-007). A guard that `noUncheckedIndexedAccess` needs never trips `no-unnecessary-condition`. Tests index arrays through the `at()` helper in `src/lib/testing/at.ts`. Unused locals are left to the `no-unused-vars` lint rule. `verbatimModuleSyntax` and `exactOptionalPropertyTypes` stay off: they are not worth their cost. **MUST.**
  - Why: each flag turns a class of run-time bug into a compile error; for example, `noUncheckedIndexedAccess` types `items[0]` as possibly `undefined`.
  - From: T28

## Test placement and shape

- **TYPES-017. Outside `src/lib/` and `app/`, tests live in a `tests/` folder next to the code they cover**, named after the unit (`Name.test.tsx`, `name.test.ts`); stories live in `stories/`. A nested `tests/` under a sub-folder (`tests/hooks/`, `tests/utils/`) is fine. **SHOULD.**
  - Why: one fixed place per folder lets a reader find a unit's test without a search, and keeps test files out of the source listing.
  - From: T8
- **TYPES-018. In `src/lib/` and `app/`, a test may sit beside its file or in `tests/`.** Both are accepted. Do not move an existing test just to change its place. **MAY.**
  - Why: both layouts read well in folders of small single-file modules, and a move only adds churn to the diff.
  - From: T9
- **TYPES-019. A pure-logic test starts with `// @vitest-environment node` on line 1.** Pure logic means services, stores, utils and schemas that never render and never touch `window`, `document` or `localStorage`. If the test fails under `node` with a missing global, it has a hidden DOM dependency: remove the pragma. **SHOULD.**
  - Why: logic that takes plain values needs no DOM, so running its test under `node` proves it has no hidden browser dependency.
  - Source: Test Business Rules Without Booting Laravel vault: Content/Quick Tips/57 - Test Business Rules Without Booting Laravel.md
  - From: T10
- **TYPES-020. Component and hook tests use Testing Library and exercise user behaviour**, not implementation details. Query by role or visible text first (`getByRole`, `getByText`) and use `data-testid` only when no accessible handle exists. Do not assert Tailwind class names or use CSS-selector queries (`container.querySelector`, `.firstChild`, `.children`) when an accessible handle exists. Create a `userEvent.setup()` instance for interactions and use `waitFor` for async assertions; do not use `fireEvent`. **SHOULD.**
  - Why: a test tied to markup, class names or internal calls breaks on a refactor that reaches the same behaviour another way.
  - Source: Test Doubles - Mocks, Stubs, Fakes and Spies https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/test-doubles-mocks-stubs-fakes-and-spies
  - From: T11
- **TYPES-021. A test of a calculation or a decision asserts the exact expected value.** It asserts the exact value, the boundary case included. A type-only or presence-only assertion (`toBeDefined`, `toBeTruthy`, `typeof x` equals `'number'`) is never the only assertion of such a test. **SHOULD.**
  - Why: an assertion that the result is a number passes whatever the math returns; a discount function whose only assertion is `typeof total === 'number'` stays green when the discount is applied twice.
  - Check: the sheet's idea, unconfirmed until the template's Oxlint rules are checked: `vitest/expect-expect`, plus `vitest/no-restricted-matchers` for `toBeDefined`, `toBeTruthy` and `toBeFalsy`.
  - Source: Your Tests Are Green and the Bug Shipped Anyway vault: Content/Insights/Your Tests Are Green and the Bug Shipped Anyway.md
  - From: NX-14
- **TYPES-023. Wrap components that use TanStack Query in a `QueryClientProvider` through the shared test helper** (TYPES-034), which returns a client with `retry: false`. **SHOULD.**
  - Why: TanStack Query retries a failed query by default, so an error-state test without `retry: false` waits through the retries before it sees the error.
  - From: T13
- **TYPES-024. Use data factories for mock data.** Name a mock type after the data it stands in for. **SHOULD.**
  - Why: an object with many fields built by hand in each test repeats the same literal, and every copy breaks when the type gains a field; a factory builds it in one place.
  - Source: Test Doubles - Mocks, Stubs, Fakes and Spies https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/test-doubles-mocks-stubs-fakes-and-spies
  - From: T14
- **TYPES-025. Test loading, error and success states** of an async component or hook. **SHOULD.**
  - Why: the loading and error branches run on every slow or failed request, and a test of the success state alone leaves them unchecked.
  - From: T15
- **TYPES-026. Business logic is testable without UI**: put logic in functions a test can import without rendering. Same intent as STRUCT-003. **SHOULD.**
  - Why: logic in a plain function is tested by calling it with values, with nothing to render or stub, so the test breaks only when the rule changes.
  - Source: Anemic Domain Model vs Rich Domain Model https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/anemic-models-vs-rich-models
  - Source: Test Business Rules Without Booting Laravel vault: Content/Quick Tips/57 - Test Business Rules Without Booting Laravel.md
  - From: T16
- **TYPES-027. Guard tests change by allowlist entry with a reason.** To permit a new exception to a row of the guard test `src/lib/tests/architectureRules.test.ts`, add an allowlist entry with its reason beside the row, and update the matching rule in the rule folder `.ai/rules/`. Delete entries that stop matching. Never loosen a regex to make a file pass. An allowlist entry is a deliberate exception and needs a reason; a lint or guard baseline is adoption debt and only shrinks, never grows to make a failure pass. **MUST.**
  - Why: a loosened regex or a grown baseline switches a check off for every later file in a diff that looks like a one-line test change; the fix for a failure belongs in the code.
  - Check: `src/lib/tests/architectureRules.test.ts` fails on an allowlist entry that no longer matches a file.
  - Source: Claude Code Found 14 Rule Breaks in Merged Laravel Code https://codyssey.dev/insights/claude-code-found-14-rule-breaks-in-merged-laravel-code
  - From: T17
- **TYPES-028. Stories.** A story file is `stories/<Component>.stories.tsx` in the feature that owns the component. `title` is `Features/<Feature>/<Component>` or `Global UI/<Component>`; the default export is `meta`; story names are PascalCase. A story file declares `const meta = { ... } satisfies Meta<typeof X>` and `type Story = StoryObj<typeof meta>`, and does not repeat an inline `fontFamily`: `.storybook/preview.tsx` imports `app/globals.css`. Stories stay optional (TYPES-040). Not a violation: a feature without stories, `.mdx` pages without `.stories.tsx`, stories that mock `next/*` through `.storybook/mocks`. **SHOULD.**
  - Why: `satisfies Meta` checks the meta object and keeps its literal type, so `StoryObj<typeof meta>` knows which args the meta already sets.
  - Source: Component Story Format (CSF) https://storybook.js.org/docs/api/csf
  - From: T23
- **TYPES-029. No per-assertion `timeout` on `waitFor`, `waitForElementToBeRemoved`, `findBy*`, `findAllBy*` or `expect.poll`.** Each assertion inherits the one deadline the test setup configures. A test that waits on a real debounce timer uses fake timers instead. **MUST.**
  - Why: a tight per-assertion cap can beat the Vitest deadline on a slow run and make the suite flake.
  - Check: guard-test row TYPES-029.
  - From: T25
- **TYPES-030. Tests reset the global state they change.** The Vitest config resets mocks, stubbed globals and stubbed env (`clearMocks`, `unstubGlobals`, `unstubEnvs`) before each test, so test files do not have to; a test that sets `process.env.TZ`, fake timers or global stubs restores them. Do not set `isolate: false`: the config runs test files in threads with isolation on, which keeps files from leaking into each other. **SHOULD.**
  - Why: a test that switches a global on leaves it on for every test that runs after it, so results depend on run order.
  - Source: Avoid the Singleton vault: Content/Quick Tips/11 - Avoid the Singleton.md
  - Source: The Singleton Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-singleton-pattern
  - Source: clearMocks (Vitest config) https://vitest.dev/config/clearmocks
  - From: T29
- **TYPES-031. Test names are present-tense behaviour statements without "should".** `renders the title`, not `should render the title`. **SHOULD.**
  - Why: a test named after the behaviour it checks reads as a line of the spec, and "should" adds a word to every name without adding meaning.
  - Source: Behavior-Driven Development https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/behavior-driven-development
  - From: T30
- **TYPES-032. A value copied from another file has a sync test.** A constant that mirrors another file reads that file in a test and compares. For example, the theme colors copied into `src/lib/brandTokens.ts` are compared with the `@theme` block in `app/globals.css`. **MUST.**
  - Why: nothing ties a copy to its original, so the two drift on the next edit of either and no check fails.
  - From: T31 (core part)
- **TYPES-033. Every test a rule cites exists.** A `Check:` line that cites a test names it by the guard test file name or by a guard-test row's pack id. A check in the guard test `src/lib/tests/architectureRules.test.ts` reads `.ai/rules/*.md`, extracts those citations, and fails when a cited file or row does not exist. It also fails on a duplicate rule id, on a rule file whose entry count differs from the count table in the index, and on an id the index names that no rule file defines. Write a new rule heading as `- **<PREFIX>-<NNN>. <title>**` so the check counts it. **MUST.**
  - Why: a renamed or deleted test leaves a rule that claims a check nobody runs.
  - Check: `src/lib/tests/architectureRules.test.ts`, the rule-reference check.
  - From: T32
- **TYPES-034. One shared `QueryClient` helper for tests.** `src/lib/testing/createTestQueryClient.ts` returns a client with `retry: false` and the other defaults tests need; component and hook tests import it. **SHOULD.**
  - Why: each hand-built `new QueryClient()` in a test picks its own defaults, so one file retries or caches where another does not.
  - From: T33

## What a change ships with

- **TYPES-035. New or changed logic ships with a test in the same change**: services, stores, hooks, utils, schemas and metadata builders. **SHOULD.**
  - Why: a test written with the change pins its behaviour, so a later refactor that breaks it fails at once; when the tests do not exist, they come first.
  - Source: Refactoring Is Not Rewriting vault: Content/Insights/Refactoring Is Not Rewriting.md
  - Source: Refactoring as a Discipline https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/refactoring-as-a-discipline
  - From: T18
- **TYPES-037. Do not commit `.env` files.** Add new variables to `.env.example`. **MUST.**
  - Why: a committed `.env` keeps its secrets in the history for good, and `.env.example` tells the next developer which variables to set.
  - From: T20
- **TYPES-038. A new page or route updates the rows it touches in the guard test `src/lib/tests/architectureRules.test.ts`.** **MUST.**
  - Why: a route the guard test does not know about is a route its checks skip.
  - Check: `src/lib/tests/architectureRules.test.ts`.
  - From: T21 (core part)
- **TYPES-039. Lint output stays clean, and every lint disable names one rule and a reason after `--`.** Oxlint runs with `--max-warnings 0` and reports an unused disable directive as an error. A directive is written `// oxlint-disable-next-line <rule> -- <reason>` (Oxlint also honours `eslint-disable`). A disable of a React Compiler rule (`react-hooks/refs`, `set-state-in-effect`, `purity`, `immutability`) is not allowed: the compiler then skips that component silently. A disable of `react-hooks/exhaustive-deps` is not allowed either: rewrite the code instead. **MUST.**
  - Why: the React Compiler is on by default in the fixed stack, so a disabled compiler rule turns optimization off for that component with no warning. A stated reason tells review why the rule does not apply; no plugin checks the reason text, so review does.
  - Check: Oxlint with `--max-warnings 0`, and unused disable directives reported as errors.
  - Source: Claude Code Found 14 Rule Breaks in Merged Laravel Code https://codyssey.dev/insights/claude-code-found-14-rule-breaks-in-merged-laravel-code
  - From: T27
- **TYPES-040. Stories are optional.** A shared component in `src/features/global-ui/` with visual variants may ship a story in `stories/`. **MAY.**
  - Why: a story pays off where a component has variants to compare side by side; elsewhere it is upkeep nobody reads.
  - From: T22

## What is NOT a violation

- A `.test.ts` without the node pragma that renders or reads browser globals.
- `as` inside a type-guard body, `as const`, a branded type, and `as unknown as` in a test.
- A `declare global` augmentation of a built-in, for example `Window`, with a `-- declaration merging only` disable.
