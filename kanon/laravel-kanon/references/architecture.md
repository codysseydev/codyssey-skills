# Architecture: Modules & Vertical Slices

Applies to: overall code organization, new features, module layout, slice shape,
folder structure, placement of capabilities.

Lane boundaries: this family audits the slice as a unit (completeness,
co-location, placement, naming). Route naming/middleware/status rules are owned by
`http-api.md`; class-shape and single-action rules by `orchestration-di.md`;
isolation import/FK rules by `isolation.md`. Note a missing piece once here; do
not re-derive those families' per-line findings.

## Modules are bounded contexts

- Domain code **MUST** be organized into modules, one namespace per business
  capability (`App\Subscriptions`, `App\Orders`, `App\Billing`), not into
  framework-type folders (`app/Services`, `app/Repositories`, `app/Actions` as a
  global dumping ground).
- A module **MUST** be named after the business capability in the domain's own
  language, not after a technical role.
- Read-only contexts (reporting projections, CMS query layers, analytics) **MUST
  NOT** contain write commands or emit domain events. State changes belong to the
  owning context; a reporting context reacts to its events and answers queries.
- A project **SHOULD** keep a domain glossary (ubiquitous language table) in its
  docs; a slice that introduces a new context **SHOULD** add its key terms there.

## Vertical slices

- Every capability **MUST** ship as a vertical slice: one action folder holding all
  of its pieces.
  - Write slice: `{Action}Command`, `{Action}CommandHandler`, `{Action}Controller`,
    `{Action}Request`, `{Action}Resource` (when a body is returned), a named route,
    tests, and a past-tense domain event when state changes.
  - Read slice: `{Action}Query` (when parameterized), `{Action}QueryHandler`,
    `{Action}Controller`, `{Action}Resource`, a named route, tests. A fixed-criteria
    listing **MAY** omit the query object.
- Slice pieces **MUST** be co-located in that one folder. Code **MUST NOT** be
  scattered across type-named folders (`Controllers/`, `Requests/`, `Resources/`,
  `Enums/`, `Events/`, `Listeners/` inside a module).
- Entity concept folders: a model **MUST** live in a folder with its factory, its
  enums, and its exceptions (`Subscription/` holds `Subscription.php`,
  `SubscriptionFactory.php`, `SubscriptionStatus.php`,
  `SubscriptionAlreadyCancelledException.php`).
- The namespace **MUST** mirror the directory path exactly.
- Every command/query **MUST** be wired to its handler explicitly (`Bus::map([...])`
  in the module's service provider), never by convention-based discovery.
- A module **SHOULD NOT** introduce domain-concern grouping (`Lifecycle/`,
  `Queries/`) until it exceeds roughly ten action folders; premature grouping is a
  deviation. A grouped action folder **MUST** still contain its full slice.

## Placement

- A slice **MUST** live in the context that owns the capability. If a slice needs to
  import or instantiate another module's classes to do its job, it is in the wrong
  place or the collaboration **MUST** become a contract or event (see
  `isolation.md`).
- A write command **MUST NOT** be added to a read-only or reporting context.

## Naming

- Classes, methods, commands, events, routes, and abilities **MUST** be named after
  the business language of their context.
- Technical/ETL/CRUD jargon **MUST NOT** be used where a domain term exists:
  `Manager`, `Processor`, `Helper`, `Util`, `Registry`, `Resolver`, `Transformer`,
  `Ingest`, `Upsert`, `Outcome`, generic `Service`.
- Suffixes are added only where the role would otherwise be ambiguous. With suffix:
  `{Action}Command`, `{Action}CommandHandler`, `{Action}Query`,
  `{Action}QueryHandler`, `{Action}Controller`, `{Action}Request`,
  `{Action}Resource`, `*Exception`, `*Listener`, `*Job`, `*Mail`. Without suffix:
  events (past-tense facts), models (nouns), enums (descriptive).
- Methods and parameters **MUST** be named after the value actually passed, not
  aspirational domain language the value is not (`forUser(int $userId)`, not
  `forMember(int $userId)` when the argument is a plain user id).
