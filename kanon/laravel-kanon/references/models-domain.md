# Models, Enums, DTOs, Events & Exceptions

Applies to: Eloquent models (with their observers, accessors and casts), enums,
domain events, value objects/DTOs, specifications, read models, exceptions.

Lane boundaries: exception types and the not-found carve-out are owned here;
`orchestration-di.md` owns the lookup-method rule (`findByXOrFail()` /
`findOrFail()`), so do not re-audit it here. Query-shape performance rules
(filtering in the database, `$with`, column selection, report queries) are owned by
`performance.md`, which builds on the eager-loading rule below.

## Eloquent models

- Casts **MUST** be declared via the `casts()` method, never the `$casts` property.
- Models **MUST NOT** declare `$fillable` or `$guarded`. `Model::unguard()` is called
  globally; input validation lives in Form Requests at the boundary.
- Strict mode **MUST** be enabled in the app service provider:
  `Model::shouldBeStrict()` (prevents lazy loading, silently discarded attributes,
  and missing-attribute access) plus `Model::unguard()`.
- Relationship methods **MUST** carry return types (`: HasMany`, `: BelongsTo`).
- A model using `HasFactory` **MUST** carry the `@use HasFactory<XFactory>` PHPDoc
  generic.
- Business logic **MUST** live in model methods (Tell, Don't Ask). A model holds
  simple domain methods, finders, invariants, and state transitions; logic spanning
  multiple aggregates **MUST** live in a handler instead.
- A transaction **SHOULD** save one aggregate; other aggregates **SHOULD** be
  updated by a listener reacting to a domain event. This holds alongside the rule
  above: the handler coordinates, and the second aggregate changes in a listener.
- Model observers and model events **MUST NOT** call `save()` on the row that
  triggered them; decide every column first and write once. "Model events" means
  Eloquent lifecycle events (`saving`, `updated`, ...), not domain events. Why: a
  nested `save()` re-fires the same events and can loop or write twice.
- Accessors and casts **MUST NOT** run queries; derived values **MUST** be computed
  from data already loaded. Why: strict mode does not catch it, and a list then
  runs one query per row.
- Queries **MUST** start from `Model::query()`, not `DB::` (production classes), and
  **MUST** eager-load what they iterate.
- A query rule used by more than one handler **SHOULD** live in one Specification
  (or named scope) object instead of being repeated.
- Custom traits **MUST NOT** be created; only framework/package traits are allowed
  (`HasFactory`, `SoftDeletes`, `RefreshDatabase`, ...). Shared behavior goes into a
  class, not a trait.
- Polymorphic models **MUST** have a morph-map entry; FQCNs **MUST NOT** be stored in
  database columns (see `persistence.md`).
- Publicly exposed identifiers **MUST NOT** be enumerable auto-increment integers.
  Expose a non-enumerable id (ULID, UUIDv7, or snowflake) in URLs and API payloads;
  the mechanism is the project's choice, the non-enumerability is not.

## Read models

- A read model **MUST** be strictly read-only: no mutating methods, no `create()`/
  `update()` calls through it. Mutations belong to the paired write model.
- A read model **SHOULD** use a private constructor plus a static factory method
  (`fromArray()`, `fromRow()`) when it combines data from multiple sources.

## Enums

- Enums **MUST** be backed, case names **MUST** be UPPER_CASE
  (`case ACTIVE = 'active'`), and the class name carries no suffix.
- A user-facing enum **MUST** provide a `label()` (or equivalent) helper.
- A stateful field that could grow past two states **MUST** be a status enum, not a
  boolean flag: `status` (`draft`/`active`/`archived`) with `isActive()`-style
  helpers per state on the model, never a new `is_active` column.
- Domain constants **MUST** be referenced through their enum, never string literals
  scattered through the code.

## Events

- Events **MUST** be past-tense facts (`MemberSignedUp`, `OrderRefunded`) with no
  `Event` suffix, and **MUST** be dispatched only after the state change succeeds.
- Events **MUST** carry ids and scalars (or value objects), never Eloquent models.
  The listener loads the entity by id.
- Events **MUST** be pure data: `final readonly`, constructor only, no query or
  business helper methods. Decisions about an event belong in its listener.

## DTOs and value objects

- **MUST** be `final readonly` with constructor property promotion and explicit
  types.
- Values with format rules (email, money, date ranges) **SHOULD** be value objects
  validated once in their constructor, not strings re-checked in each method.
- Invariants across related fields (check-in before check-out) **MUST** be enforced
  in a value object's constructor, not only in Form Request rules. Why: Form
  Requests never run for imports, jobs or console input. The field rule itself
  still stays in the Form Request (see `http-api.md`).
- Domain objects **SHOULD** be created through a named constructor that returns a
  valid object, not `new` plus setters. This extends the read-model static-factory
  rule to all domain objects.
- A result/value object **SHOULD** own interpretation of its own data
  (`wasRejected()`, `isHigherThan()`) rather than making consumers branch on raw
  fields. This carve-out is for result/value objects only; events stay method-free.

## Exceptions

- Each module **MUST** have a base exception with `render(): JsonResponse`; concrete
  domain exceptions extend it and override the status code. Exceptions render
  themselves; controllers never catch them.
- A custom not-found exception **MUST NOT** be invented for a plain id lookup; use
  `findOrFail()` and let `ModelNotFoundException` become the 404. Custom exceptions
  are reserved for genuine domain errors needing a specific status or message.
- An outcome the caller handles in the same flow (try the next coupon, show a
  price without discount) **SHOULD** be returned as a Result object: a `final
  readonly` result value object (see DTOs and value objects above). A broken rule
  that ends the use case **MUST** throw a domain exception, which still renders
  itself per the base-exception rule above.
- Handlers and models **MUST NOT** throw framework or generic exceptions
  (`NotFoundHttpException`, `RuntimeException`) for business rules; they **MUST**
  throw a named domain exception. Plain id lookups are the carve-out: `findOrFail()`
  and its `ModelNotFoundException` stay allowed (see the not-found rule above and
  the Tell, Don't Ask lookup rule in `orchestration-di.md`).

## Shape

- Complex array parameters/returns **MUST** carry array-shape PHPDoc
  (`@param list<string>`, `@return array<string, mixed>`).
- File-shape rules (`strict_types`, `final readonly`, promotion) are owned by
  `orchestration-di.md`; cross-reference it, do not re-audit them here.
