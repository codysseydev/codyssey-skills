# Models, Enums, DTOs, Events & Exceptions

Applies to: Eloquent models, enums, domain events, value objects/DTOs, read models,
exceptions.

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
- Queries **MUST** start from `Model::query()`, not `DB::` (production classes), and
  **MUST** eager-load what they iterate.
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

## Shape

- Complex array parameters/returns **MUST** carry array-shape PHPDoc
  (`@param list<string>`, `@return array<string, mixed>`).
- File-shape rules (`strict_types`, `final readonly`, promotion) are owned by
  `orchestration-di.md`; cross-reference it, do not re-audit them here.
