---
paths:
  - 'src/**'
  - 'app/**'
---

# Design Principles and Patterns

Design principles every production file follows, each stated for TypeScript in a Next.js
app: separation of concerns, pure functions that hold the rules, typed boundaries, honest
dependencies, guard clauses, named errors, composition, lookup tables, and dependencies
that point one way.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.

The terms come from the course "Building Maintainable PHP Applications: Patterns and Principles" https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles.
The course is PHP, so each rule says what its term means in TypeScript.

- **DESIGN-001. Tools, not rules** Use a pattern when a specific pain shows up, not because it exists. A chain of types that carry the same fields (`RequestDto -> ServiceDto -> CommandDto`) is the over-engineering trap; one typed shape per boundary is enough. A reviewer does not ask for a new layer, class or abstraction without a named pain. **SHOULD.**
  - Why: a pattern pays for itself only when it removes a problem someone can name. Added before that, each layer is one more place every later change has to pass through, as when a builder wraps a constructor that takes three required values.
  - Source: Introduction - Tools, Not Rules https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/introduction-tools-not-rules
  - Source: Data Transfer Objects https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/data-transfer-objects
  - Source: CQRS: Separate Models for Reads and Writes https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/cqrs-separate-models-for-reads-and-writes
  - Source: Refactoring Legacy Code: The Course Capstone https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/refactoring-legacy-code
  - Source: SOLID Principles Explained With Real Code https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/solid
  - Source: The Builder Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-builder-pattern
  - Source: The Factory Design Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-factory-pattern
  - Source: The Repository Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-repository-pattern
  - Source: When Event Sourcing Is Worth It, and When It Isn't vault: Content/Insights/When Event Sourcing Is Worth It, and When It Isn't.md
  - From: P1

- **DESIGN-002. Separation of concerns by layer** Each layer does one job, and a file stays in its layer. A function that performs an effect (writes `window.location`, reads or writes storage, calls a third-party script) lives in a hook or in `src/lib/`; a pure rule stays in `utils/`, so `utils/` can be tested in the Node test environment (TYPES-019). **SHOULD.**

  | Layer | Folder | Does | Does not |
  | --- | --- | --- | --- |
  | Entry component, components | `*.tsx`, `components/` | render, wire handlers | fetch, parse, decide rules |
  | Combined hook, query hooks | `hooks/` | join query data, store state, handlers, effects (browser APIs, storage, navigation) | render, call `fetch` directly |
  | Service | `services/` | call `apiClient`, return typed data | hold UI state |
  | Store | `store/` | hold client-only UI state and async flows, including optimistic updates, in a small external store with selector subscriptions (XState Store is the named implementation) | hold server data |
  | Utils | `utils/` | pure logic | import React, read browser globals, perform effects |

  - A store keeps client-only UI state in a small external store with selector subscriptions; XState Store is the named implementation. A store may own an async flow, including an optimistic update: apply the change, call the service, undo it and show a toast on failure. The model is one store action, such as `toggleCompletion` in `src/features/<name>/store/<name>.store.ts`. A store still holds no server data: the only server-derived value it keeps is the in-flight optimistic one. The owner of an optimistic update is one store action or one mutation hook, never a component (DATA-032).
  - Why: a rule mixed into a component or a fetch can only be tested by rendering it or mocking the network, and a change to one job reaches code that does another. With one job per layer, the rules in `utils/` run in a plain Node test and a change to the API call stays in the service.
  - Source: Anemic Domain Model vs Rich Domain Model https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/anemic-models-vs-rich-models
  - Source: CQRS: Separate Models for Reads and Writes https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/cqrs-separate-models-for-reads-and-writes
  - Source: Why Your Laravel Codebase Is Unmaintainable vault: Content/Insights/Why Your Laravel Codebase Is Unmaintainable.md
  - From: P2

- **DESIGN-003. Pure functions hold the rules, and callers ask the function (Tell, Don't Ask)** A rule about a piece of data ("is this card scheduled", "which cover image wins", "is this date range valid") lives in one pure function next to the type it is about. Callers call it with the inputs it needs and do not re-derive the condition from raw fields. **SHOULD.**
  - In TypeScript the object of the lesson is a module of functions beside the type. Services and pure functions are not banned.
  - Pure means no `Date.now()`, no `window` and no module state: everything arrives as an argument (DESIGN-010). A pure function is tested without rendering, with `// @vitest-environment node` (TYPES-019).
  - Example: `isOverdue(invoice, now)` in `src/features/<name>/utils/invoiceStatus.ts`, used by the invoice row component and covered by `src/features/<name>/tests/utils/invoiceStatus.test.ts`.
  - A condition with a negation inside a negation (`!isArchived && !(isDraft && !isOwner)`) becomes a named pure function or named constants, so a reader sees what it means without solving the logic.
  - Why: when every caller reads a field and branches on it, each place has its own copy of the rule, and the copies drift after enough unrelated changes. One function next to the data keeps one version, and a test covers it without a component.
  - Source: Tell, Don't Ask https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/tell-dont-ask
  - Source: Tell, Don't Ask https://codyssey.dev/quick-tips/tell-dont-ask
  - Source: Anemic Domain Model vs Rich Domain Model https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/anemic-models-vs-rich-models
  - Source: The Specification Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-specification-pattern
  - Source: A Rich Model Beats an Anemic One vault: Content/Quick Tips/23 - A Rich Model Beats an Anemic One.md
  - Source: The Specification Pattern for Reusable Query Rules vault: Content/Quick Tips/15 - The Specification Pattern for Reusable Query Rules.md
  - Source: Your Service Classes Are Where Logic Goes to Die vault: Content/Insights/Your Service Classes Are Where Logic Goes to Die.md
  - From: P3 (core part)

- **DESIGN-004. Return a new value; do not mutate inputs** A function in `utils/` or `src/lib/`, and any code that holds data from a query, a store or props, returns a new value instead of mutating that data. It types array and object parameters `readonly T[]` or `Readonly<T>`, copies before it calls `sort`, `reverse`, `splice`, `push` or a `Date` setter (`toSorted()`, a spread, `new Date(date.getTime())`), and copies nested objects too, because `readonly` is shallow. This rule becomes MUST once a lint rule that catches in-place mutation is confirmed to exist and is turned on. **SHOULD.**
  - Why: a `sort` inside a helper reorders the array that the query cache and every other reader share, so a change made for one screen shows up on another. A `Date` setter changes the instance it is called on in the same way. `readonly` only blocks reassignment; it says nothing about the object a property points to.
  - Check: `readonly` parameter types make `.sort()` and `.push()` on them a `tsc` error. A `Date` is not covered by `readonly`, so the type check is not complete. Candidate checks, none confirmed: a guard-test regex over `**/utils/*.ts` for in-place array methods on a parameter and for `.setDate(`, `.setHours(`, `.setMonth(`, `.setFullYear(` and `.setTime(`; Oxlint rules for in-place array methods, or the React Compiler `immutability` rule, if Oxlint ships them.
  - Source: Immutable Objects https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/immutable-objects
  - Source: readonly Is Not Immutability https://codyssey.dev/quick-tips/readonly-is-not-immutability
  - From: NX-10

- **DESIGN-005. One transition table for a status that gates UI actions** When two or more UI actions are gated by the same status field, the allowed moves live in one `Record<Status, readonly Status[]>` typed by the status union, next to the status type, and components and hooks ask `canTransition(from, to)` instead of comparing `status` literals. A flow with effects (an optimistic update, a call that can fail) keeps its moves in one action of the client store (DATA-021). The table is a hint for the UI: the API enforces the real transition, as it enforces access (ACCESS-007). **SHOULD.**
  - Why: when each button checks `status === 'draft' || status === 'scheduled'` on its own, the rule about which move is legal is owned by nothing and is copied across components. One table reads top to bottom, and a new status fails to compile until its row exists.
  - Check: not shipped. An idea for review: a status type compared with `===` or `!==` in two or more components or hooks outside its own module, with no transition table for it, is a finding.
  - Source: The State Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-state-pattern
  - Source: Your Service Classes Are Where Logic Goes to Die vault: Content/Insights/Your Service Classes Are Where Logic Goes to Die.md
  - From: NX-12

- **DESIGN-006. Convert untyped API data to typed data once, at the boundary** The service layer is the boundary. Data leaves it typed, in the shape the UI wants, and nothing inside re-checks it. **SHOULD.**
  - The service call is typed (TYPES-003) and unwraps the API envelope there: callers receive the item or page, not `response.data.data`.
  - When the UI needs a different shape than the API returns, one mapper function does the conversion, in `utils/`, named for its source (DESIGN-009), and the service or the query's `select` calls it. Components receive the mapped shape.
  - Components and hooks do not use `?.` chains to cope with an uncertain shape, and do not `typeof`-check data a service already typed.
  - A client-side input limit matches what the API accepts, so the service sends no request the API rejects, for example a minimum length for a search query.
  - Why: once the data is typed at the edge, the rest of the code trusts its types and stops dealing with raw JSON. A check repeated in every component hides which shape is the real one, and an API rename touches one mapper instead of every reader.
  - Source: Data Transfer Objects https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/data-transfer-objects
  - Source: Guard Clauses and Defensive Programming https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/guard-clauses-and-defensive-programming
  - Source: Input Validation vs Domain Validation: Where Each Belongs https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/input-validation-vs-domain-validation
  - Source: The Repository Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-repository-pattern
  - Source: Don't Return the Eloquent Model From a Handler vault: Content/Quick Tips/50 - Don't Return the Eloquent Model From a Handler.md
  - Source: Turn Decoded JSON Into a DTO at the Edge vault: Content/Quick Tips/49 - Turn Decoded JSON Into a DTO at the Edge.md
  - Source: Your Laravel Code Needs More Objects vault: Content/Insights/Your Laravel Code Needs More Objects.md
  - Source: Feature Modules vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/38 - Feature Modules.md
  - From: P4

- **DESIGN-007. Read at most two property levels into an API object** A component, hook or util reads at most two property levels into an object that came from the API: `order.customer.name` is fine, `order.customer.address.country.code` is not. A deeper value comes from a named field that a mapper or a query `select` produces (DESIGN-006), or from a selector function beside the type (`shippingCountryCode(order)`). Fluent builders, array method chains and config objects are exempt. **SHOULD.**
  - Why: each hop couples the caller to the shape of one more object on the path, so a change deep in the response breaks code that only wanted one value. Three hops or more is the smell the Law of Demeter names.
  - Check: review only. The review asks what sentence the chain is asking. A lint check comes only after its noise is measured on a real codebase.
  - Source: The Law of Demeter https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-law-of-demeter
  - Source: Stop Chaining Through Objects vault: Content/Quick Tips/18 - Stop Chaining Through Objects.md
  - From: NX-11

- **DESIGN-008. API types are data only (DTO)** A type in `types/*.types.ts` that describes an API response is a plain `type`: named, typed fields, no methods, no validation. A rule about it is a function (DESIGN-003), not a method. **SHOULD.**
  - A value object (a type that refuses invalid values and has no identity) is worth adding only where a concept has real rules: a format, a constraint, a calculation or a comparison rule. Branded id types are not proposed (see the list at the end of this file).
  - Why: a plain type survives the trip through JSON, the query cache and the server-to-client boundary as it is, while a class instance loses its methods on the way. The rules about the data stay in functions a test can call directly.
  - Source: Data Transfer Objects https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/data-transfer-objects
  - Source: Value Objects https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/value-objects
  - From: P5

- **DESIGN-009. Name a constructor for its source** A function that builds one shape from another says what it builds from: `fromApiLink`, `fromApiOrder`. Not `create`, `build`, `get`. One mapper per source, named `from<Source>`. A shared mapper that serves several API sources may be named for its target instead, such as `toAuthorSummary` shared by the post and the comment mappers. **SHOULD.**
  - Why: a generic name like `create` or `transform` says nothing about the input, so two mappers for two sources look alike and get swapped. `fromApiOrder` tells the reader which shape goes in.
  - Source: Named Constructors https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/named-constructors
  - Source: Named Constructors Over new Plus Setters https://codyssey.dev/quick-tips/named-constructors-over-new-plus-setters
  - From: P6

- **DESIGN-010. Honest dependencies: pass in time, config and storage** Logic receives what it depends on as arguments. Only hooks, providers and one module per global touch the browser or the environment. **SHOULD.**
  - Time: a function that needs "now" takes `now` as an argument (a number or a `Date`; a default of `Date.now()` is fine). No bare `Date.now()` or `new Date()` inside `utils/` or `src/lib/` logic.
  - Randomness: `Math.random()` and `crypto.randomUUID()` inside `utils/` logic are hidden dependencies, like the clock and environment reads. The function takes the random value, or a function that makes one, as an argument.
  - Environment: `process.env` is read in one module, `src/lib/env.ts` (DATA-042).
  - Storage and location: `localStorage`, `sessionStorage` and `window.location` are read inside a small wrapper module, such as `src/lib/authSession.ts`, or inside a hook, never in a rule function.
  - Why: the same code runs on the server and in the browser, whose time zones differ, so a function that reads the clock or the environment itself gives different answers in each and cannot be tested without faking globals. An argument makes the input visible and keeps the test plain.
  - Source: Dependency Injection vs the Service Locator Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/dependency-injection-vs-service-location
  - Source: A Facade Is Service Location Too https://codyssey.dev/quick-tips/a-facade-is-service-location-too
  - Source: Service Location Is a Hidden Dependency https://codyssey.dev/quick-tips/service-location-is-a-hidden-dependency
  - Source: The Singleton Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-singleton-pattern
  - Source: Why Your Laravel Codebase Is Unmaintainable vault: Content/Insights/Why Your Laravel Codebase Is Unmaintainable.md
  - From: P7

- **DESIGN-011. Guard clauses: return early, keep the happy path flat** Check the bad case first and return or throw; do not nest the work inside `if` / `else`. **SHOULD.**
  - A condition with a negation inside a negation is named, as in DESIGN-003: a pure function or named constants, not a nested `!`.
  - Why: with the failure cases on the outside, every precondition has passed by the last line, so the happy path sits at the top indentation level and reads straight down.
  - Source: Guard Clauses and Defensive Programming https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/guard-clauses-and-defensive-programming
  - Source: Guard Clauses Beat Nested Ifs https://codyssey.dev/quick-tips/guard-clauses-beat-nested-ifs
  - From: P8

- **DESIGN-012. Fail loudly, with a named error** An expected failure is signalled with a named error class and recognised with `instanceof` or a helper such as `isNotFoundError`; it is not a string compared with `error.message`. Nothing is swallowed. **SHOULD.**
  - An outcome the user's input causes is the exception: DESIGN-013 returns it as a discriminated union from a pure function, never from a `queryFn` or `mutationFn`.
  - Why: a named error can be caught on its own and keeps its meaning when the message wording changes, and a swallowed error hides a fault. For example, a service throws `NotFoundError` from `src/lib/apiErrors.ts` for a 404, and the page calls `notFound()` for that case and rethrows every other error.
  - Source: Guard Clauses and Defensive Programming https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/guard-clauses-and-defensive-programming
  - Source: Exception Handling as Design https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/exception-handling-as-design
  - Source: Throw a Domain Exception, Not a Framework One https://codyssey.dev/quick-tips/throw-a-domain-exception-not-a-framework-one
  - Source: Skip Bad Rows, Don't Fail the Import vault: Content/Quick Tips/58 - Skip Bad Rows, Don't Fail the Import.md
  - From: P9

- **DESIGN-013. A discriminated union for outcomes the user's input causes** DESIGN-012 keeps named errors for faults and not-found. An outcome the user's input causes, which the caller handles case by case (an invalid or expired coupon code), is returned as a discriminated union (`{ ok: true; value: T } | { ok: false; reason: 'invalid' | 'expired' }`) by a pure function, and the caller handles it with an exhaustive `switch` (TYPES-015). A `queryFn` or `mutationFn` never returns such a union: it throws, so the query's error state sees the failure (DATA-025). **SHOULD.**
  - Why: throwing for routine validation turns it into control flow and forces every caller into `try`/`catch`, while a union shows each case in the type. A union returned from a `queryFn` or `mutationFn` never reaches `isError`, so the error-state and retry rules (DATA-025, DATA-026) would not see it.
  - Source: The Result Pattern: An Alternative to Throwing Exceptions https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/result-pattern
  - Source: Result Objects When Failure Isn't Exceptional vault: Content/Quick Tips/10 - Result Objects When Failure Isn't Exceptional.md
  - From: NX-13

- **DESIGN-014. Compose, do not configure** A component varies by what it is given to render (children, slots, a smaller component), not by a growing list of boolean flags. More than three boolean props on one component is a sign to split it or pass children. **SHOULD.**
  - Passing one object through three components to reach one pair of buttons is the same smell: pass the buttons as `children` or a slot.
  - Why: each boolean flag doubles the states a component can be in, and most combinations are never rendered or tested. Parts passed in keep each variant in the caller that needs it.
  - Source: Composition vs Inheritance https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/composition-vs-inheritance
  - Source: Composition Over Inheritance https://codyssey.dev/quick-tips/composition-over-inheritance
  - From: P10

- **DESIGN-015. A lookup table beats a branching chain** When the code picks behavior by a kind (a category, a status, a section type), use a typed lookup (`Record<Kind, handler>`, typed by the union or enum) instead of an `if`/`else if` or `switch` chain, so a new kind fails to compile until it is handled. This holds for a discriminated union as well: the handler for each kind takes that kind's narrowed payload. This is the Strategy idea in its smallest form. **SHOULD.**
  - A `switch` that remains ends in a `never` exhaustiveness check (TYPES-015).
  - Why: the choice of behavior lives in one place, and the `Record` type makes a new kind a compile error until its handler exists, where an `if` chain falls through to its last branch with no error.
  - Check: the TYPES-015 guard-test row: a `switch` over a union or enum ends in a `never` exhaustiveness check.
  - Source: The Factory Design Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-factory-pattern
  - Source: The State Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-state-pattern
  - Source: The Strategy Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-strategy-pattern
  - From: P11

- **DESIGN-016. Dependencies point one way** STRUCT-011 and STRUCT-012 state the direction: only `src/features/global-ui/` is shared across features, imports run from `app/` to `src/features/` to the shared folders such as `src/lib/`, and nothing shared imports a feature. The course calls the same idea honest dependencies: a module lists what it needs at its edge, in its imports, and nothing hides behind a global. **SHOULD.**
  - Why: a shared layer that imports a feature can no longer be reused or tested alone, and a cycle between features means neither can be removed.
  - Source: Dependency Injection vs the Service Locator Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/dependency-injection-vs-service-location
  - From: P12

- **DESIGN-017. Components take `ref` as a prop and read context with `use()`** In React 19, `ref` is a regular prop, so a component does not wrap itself in `forwardRef`, and `use(Context)` replaces `useContext(Context)`. **SHOULD.**
  - Why: React 19 no longer needs the `forwardRef` wrapper and plans to deprecate it, so the wrapper only adds a layer around a component that can stay a plain function.
  - Source: Vercel composition rule `react19-no-forwardref` https://github.com/vercel-labs/agent-skills/blob/main/skills/composition-patterns/rules/react19-no-forwardref.md
  - From: P13

- **DESIGN-018. A display array is output; code does not read it back** `metadata: string[]` and similar arrays are what a card prints. No code reads one by index or by value, and a pre-joined string is never an item. A caller that needs the date, the status or the topic gets it as its own field, and a mapper builds the array last, from typed fields. **SHOULD.**
  - Why: a display array has a slot order only its builder knows, so code that reads `metadata[2]` breaks without an error when a slot moves, and a second screen that wants the raw value has to parse the display text back.
  - Source: Queries and Query Handlers https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/queries-and-query-handlers
  - From: P14

- **DESIGN-019. A function takes an options object when it has a boolean parameter, two or more positional parameters of the same primitive type, or more than three positional parameters** `formatPrice(amount, showSymbol, showCents = false)` becomes `formatPrice(amount, { showSymbol, showCents })`; `assignReviewer(postId, reviewerId)`, with two string ids, becomes `assignReviewer({ postId, reviewerId })`; a factory that gains a fifth positional parameter takes an object. DESIGN-014 says the same for component props. **SHOULD.**
  - A `queryOptions` factory (`xQueryOptions(enabled = true)`) may take `enabled` as a positional boolean. It mirrors the signature of the hook that calls it (`useQuery(xQueryOptions(enabled))`), and `enabled` is the only boolean it takes. A factory that needs a second boolean takes an object.
  - Why: at the call site `formatPrice(price, true, false)` says nothing about what each value means, and two arguments of the same primitive type can be swapped without a type error. Named options say what each value is at the call site, and their order does not matter.
  - Source: Primitive Obsession https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/primitive-obsession
  - Source: The Builder Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-builder-pattern
  - From: P15

- **DESIGN-020. A function declared inside a component that returns JSX becomes a component, or its branches move to the `return`** `renderBody()` and `renderContent()` with several return shapes inside the component body are the pattern. A small named component in the same file, or the branches written in the `return`, replaces them. **SHOULD.**
  - Why: a render helper reads whatever the component body has in scope, so its inputs are hidden and its branches sit away from the markup they produce. A named component takes its inputs as props, and branches in the `return` read top to bottom.
  - From: P16

**Considered and not proposed.**

- Branded id types (DESIGN-008): the ids are opaque strings used for URLs and display, so the payoff is low.
- A repository or adapter layer over `apiClient`: the services are already that boundary, and adding one would be the "chain of the same fields" trap of DESIGN-001 (The Repository Pattern https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/the-repository-pattern).
- Runtime schema validation of API responses, for example with Zod: the API is first-party and typed. Revisit if the API stops being first-party.
- Factory classes: a frontend object rarely needs services plus a runtime choice to construct.
- Server Actions for mutations, which the Next.js docs offer (https://nextjs.org/docs/app/getting-started/mutating-data): the app calls a separate API through `apiClient`, and DATA-070 rules them out.
- Turning on `cacheComponents` (https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents): caching is decided by the prerendering and revalidate rules, DATA-001 to DATA-008.
- Suspense around async content and wider `next/dynamic` use, which the vendored React skills suggest: they conflict with DATA-001 and DATA-019.
- `<ViewTransition>`: it needs an experimental flag, and `router.back()` does not animate.
