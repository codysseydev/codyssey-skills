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
  - Why: a fixture proves something only when it behaves like the response it stands in for, and ids reach the app as the backend sends them; a request body that lists its fields, like a controller that lists every column it writes, keeps fields the API should not get out of it.
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

## What a change ships with

## What is NOT a violation
