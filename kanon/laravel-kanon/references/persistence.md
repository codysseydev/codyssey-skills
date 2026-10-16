# Migrations, Factories, Config & Providers

Applies to: migrations, model factories, config files, service providers, scheduled
tasks.

## Migrations

- A migration **MUST** have a `down()` that actually reverses it, or a clearly
  intentional irreversible note.
- PHP FQCNs **MUST NOT** be stored in database columns (defaults, seeds, morph
  types); use plain string identifiers and a morph map.
- Lifecycle state **MUST** be a `status` string column cast to a backed enum, with
  an index, never a `boolean('is_active')`-style flag (see `models-domain.md`).
- Cross-module references **MUST** be plain id columns with no `->foreign()`; a
  same-module foreign key **MAY** exist. A migration **MUST NOT** touch a table
  owned by another module (see `isolation.md`).
- New domain tables **MUST** use primary keys consistent with the project's
  non-enumerable public-id strategy (ULID/UUIDv7/snowflake).
- Facades, helpers, and `Schema`/`DB` are fine inside migrations.

## Factories

- Every model **MUST** ship a factory: `final class`, typed `definition(): array`,
  named states via `->state(...)` for every meaningful lifecycle position.
  Exception: read-model factories may be non-`final` (see `filament.md`).
- Factories use only framework/package traits, like all other classes.

## Config

- `env()` **MUST** appear only in config files; nowhere else in the codebase.
- Descriptive header comment blocks in config files **MAY** exist (they are not
  what-narration).

## Providers

- The module service provider owns all wiring: `Bus::map([...])` for command/query
  handlers, explicit `Event::listen($event, $listener)` per listener, singleton
  bindings for connectors/gateways, `Schedule::job(...)`/`Schedule::command(...)`
  for scheduled tasks.
- Event auto-discovery and `$listen` arrays **MUST NOT** be used; every listener
  registration is explicit and greppable.
- Facades and helpers **MAY** be used in providers.
- The app service provider **MUST** enable strict Eloquent mode and unguard models
  (`Model::shouldBeStrict()`, `Model::unguard()`), and register the morph map.

## Shape

- File-shape rules (`strict_types`, `final readonly`, promotion) are owned by
  `orchestration-di.md` and apply to migrations, factories, and config too;
  cross-reference it, do not re-audit them here.
