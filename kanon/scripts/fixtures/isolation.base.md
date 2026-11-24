# Module & Application Isolation

Applies to: anything touching two modules, cross-module data, or two application
surfaces (public app, admin panel, internal API). Isolation violations are the most
expensive mistakes to unwind later; every MUST here is critical.

## Module isolation

- A module **MUST NOT** import another module's classes: no models, enums, events,
  commands, handlers, services, or value objects across bounded contexts.
- Cross-module collaboration **MUST** go through an explicit contract (interface) or
  a domain event, never direct imports or new-ing up another module's classes.
- The consumer **MUST** define the contract; the provider implements it. An
  interface lives in the module that needs the capability, not the one that
  fulfills it.
- There is no shared kernel for domain concepts: a module **MUST** own its own copy
  of any value object it needs rather than importing another module's. Only a
  dedicated shared-infrastructure namespace (`Framework\`, `Shared\`) holding pure
  infrastructure **MAY** be used from anywhere.

## Cross-module data

- Cross-module references **MUST** be plain unsigned integer/ULID columns, never
  Eloquent relationships (`belongsTo` another module's model) and never database
  foreign keys across modules.
- Modules own their tables. A module **MUST NOT** add columns to another module's
  tables; it creates its own table keyed by the other module's id.
- Cross-module data access **MUST** be read-only, via an injected
  `ConnectionInterface` with id-based queries. A module **MUST NOT** insert, update,
  or delete rows in another module's tables.
- Data another module owns but this module needs at runtime **MUST** be
  materialized: stored on this module's own table and kept in sync by an event
  listener, not fetched cross-module per request.

## Application isolation

Separate application surfaces (the customer-facing app and an admin panel, for
example) are separate applications, even inside one repository.

- Application namespaces **MUST NOT** import from each other, in either direction:
  no shared models, enums, events, commands, handlers, or contracts.
- Each application **MUST** own its read models (read-only, pointing at the same
  tables), its write models (carrying finders, invariants, and state transitions for
  anything it mutates), and its enums.
- Cross-application event subscriptions **MUST NOT** exist: an application's
  provider never registers a listener on another application's event, by `::class`
  or by string FQCN. There is no listener exception.
- Every side effect of an application's action (history rows, audit rows, cache
  flushes, notification emails) **MUST** be handled by that application's own
  listeners. An application **MUST NOT** dispatch another application's domain
  events to reuse its cascades; it replicates the steps it actually needs with its
  own write models.
- A handler **MUST NOT** be a pass-through whose body only dispatches an event with
  no preceding mutation; it does real work against a write model or it does not
  exist.
- Each application **MUST** authenticate through its own guard; guards and role
  enums are never shared across applications.

## What is NOT a violation

- Classes inside the same module using each other freely; the boundary is the
  bounded context, not the namespace segment.
- Importing pure infrastructure from the shared `Framework\`/`Shared\` namespace.
- A reporting or read-only context adding a query slice, an event listener, or a
  scheduled projection; only write commands are out of place there.
