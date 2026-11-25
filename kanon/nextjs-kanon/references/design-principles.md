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
