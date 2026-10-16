# Architecture & layering

What this auditor protects: that new code sits in the **same layer, with the same
responsibilities, as the code around it**. Maintenance rots when one handler quietly grows
business logic the rest of the codebase keeps in models, or when a controller reaches
across a boundary its siblings respect. None of this is a bug; all of it is the kind of
drift a bug-focused review passes over.

Authority order for every finding: `[project-doc]` (CLAUDE.md / docs / ADRs) >
`[established-pattern]` (what sibling files consistently do, with the file cited) >
`[laravel-baseline]` (generic norm, only where the project is silent). The project's
chosen layout always wins; you are checking *consistency with it*, not imposing one.

## Where business logic lives

The project has a home for domain logic (models, Actions, Services, command handlers,
whatever the profile says). Flag application-layer classes (controllers, jobs, listeners,
handlers) that **do work the project's home layer owns**:
- Multi-step domain work, eligibility/derivation decisions, or state mutation written
  inline in a controller/handler when siblings delegate it to a model/action/service.
- A controller fat with conditionals where peer controllers are thin pass-throughs.
- External I/O (HTTP, filesystem, PDF, mail) called directly from a controller/handler
  when the project funnels it through a dedicated client/service class.

Cite the sibling that establishes the home. **med** when it breaks a documented layering
rule; **low/med** when it only diverges from an established pattern. Not a violation:
guard clauses, parsing input into typed values, routing/dispatch. These are coordination, not logic.

## Boundary & coupling consistency

- **Module / bounded-context boundaries**: if the project is organised into modules,
  packages, or `src/` domains, flag a new cross-boundary import, relationship, or foreign
  key that the project's own boundaries forbid (check whether siblings cross or stay
  isolated). Cross-boundary coupling is the single most expensive thing to unwind later.
  **high** when a documented isolation rule exists; **med** otherwise.
- **Decouple across a boundary with a contract or an event, not a live reach**: when a new
  cross-boundary need appears, the project's established remedy is usually a
  consumer-defined interface (the module that *needs* the capability declares the contract,
  the other implements it) or an event + a locally-stored projection, rather than a direct call
  into the other context's classes/tables at request time. Flag a new live cross-context
  lookup where siblings decouple via a contract/event. Cite the sibling contract/listener.
  **med.**
- **Capability placement**: a slice/feature should live in the context that *owns* the
  capability, and a read-only or reporting layer should take no writes. Flag a write/mutation
  added to a context the project treats as read-only/reporting (the state change belongs in
  the owning context, with this layer reacting to its event). Only applies where the project
  has such layers; cite the doc/structure that marks them. **med/high.**
- **Layer-skipping**: a controller touching the database directly, or a view/resource
  pulling in a service, when the project routes through a defined layer. Cite the pattern.
- **God-class growth**: a class the diff pushes well past the size/responsibility of its
  peers (a service accreting unrelated methods, a model with a dozen new concerns). Flag as
  a cohesion drift with the concrete split suggestion. **low.**

## Third-party integration & anti-corruption

When the project integrates an external service (payment provider, mail/SMS, search,
storage, any vendor API), check that new code respects the boundary the project already
draws around it. These are dependency-inversion / anti-corruption-layer principles. Flag
them only when the project demonstrably isolates *some* vendor already and the diff breaks
that isolation. Cite the sibling client/gateway.

- **Isolate the client behind a domain-owned interface**: domain/application code reaches a
  vendor through a gateway/client class (ideally a project-defined interface), not by
  calling the HTTP client / SDK / facade inline. Flag a raw `Http::`/SDK call in a
  controller/handler/model where peers go through a gateway. **med.** A swappable vendor is
  the whole point: inline calls weld the vendor into the call site.
- **Don't let vendor vocabulary leak into the domain**: provider-specific field names,
  status strings, and identifiers stay inside the adapter; domain events, DTOs, and column
  names speak the project's own language. Flag a vendor's raw payload shape or status
  vocabulary crossing into a domain event/model/column. **med.**
- **Translate at the boundary**: the adapter maps the vendor response into a typed
  project DTO; callers receive the DTO, not raw vendor JSON/arrays. Flag a vendor response
  array handed across the integration boundary. **low/med.**
- **Build the outbound request in the adapter, not the caller**: request-body assembly
  lives in the client/request object, not scattered across call sites. **low.**

## Consistency of the chosen pattern

If the project uses a recognisable pattern (single-action controllers, Action classes,
command/query handlers, repositories), new code in that area should follow it. Flag a
resourceful controller dropped into an invokable-controller codebase, a handler with extra
public entry points where peers expose one, an inline write where siblings use a command.
Always cite the established sibling. This is pure maintainability: mixed patterns force
every future reader to learn two conventions instead of one.

## Dependency wiring

- Prefer the project's injection style (constructor injection, contracts over facades) **if
  that is what the surrounding code does**. Flag a new facade/`app()` call in a file or
  module whose siblings inject dependencies. `[established-pattern]`, **low/med**.
- Bindings/service-provider registration: a new bindable class (listener, command,
  subscriber) that siblings register but this diff leaves unwired. **med** (silent no-op
  later).
