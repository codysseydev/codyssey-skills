# Eloquent & database

What this auditor protects: query patterns that stay cheap as data grows, and a schema
that can still be migrated and reasoned about as the team and the schema change. Database drift is the most
expensive maintenance class there is: a non-reversible migration or an FQCN baked into a
column outlives every developer who understood it.

Authority order: `[project-doc]` > `[established-pattern]` (cite the sibling model /
migration) > `[laravel-baseline]`. Eager loading and migration reversibility are
near-universal enough to flag even when undocumented, but verify the actual code first.

## Queries

- **N+1 / lazy loading in a loop**: a relation accessed inside a loop (or a collection
  `map`/`each`) without `with()` eager loading. High-value and near-universal, so flag even
  when the project hasn't documented it, *after confirming it's a real loop over a real
  relation*. **med/high** by blast radius. If the project runs `preventLazyLoading()`, an
  un-eager-loaded access is a guaranteed runtime break, not a perf nit. **high.**
- **Query in a loop**: issuing a query per iteration where a single `whereIn` /
  eager-load / aggregate would do. **med.**
- **`DB::` raw vs builder/Eloquent**: raw SQL where an Eloquent relationship or query
  builder is idiomatic *and the project prefers Eloquent*. Flag with the builder rewrite.
  Complex reporting/aggregation queries are a legitimate exception; don't flag those. **low/med.**
- **Missing pagination**: an unbounded `->get()` / `->all()` on a growing table in a
  listing path where siblings paginate. A table that's fine today and fatal at scale is
  exactly the maintenance trap to catch. **med.**

## Models

- **Mass-assignment consistency**: the project is either guarded (`$fillable`/`$guarded`)
  or deliberately unguarded project-wide. Flag the *inconsistency*: a `$fillable` added in
  an `unguard()` codebase, or an unguarded model where peers guard. Not the choice itself.
  `[established-pattern]`, **low/med**.
- **Casts**: enum/date/bool/json columns are actually cast, via the project's mechanism
  (`casts()` method vs `$casts` property; match siblings). Flag an enum column read as a
  raw string, or a cast declared the non-prevailing way. **low/med.**
- **Relationship methods typed**: relationship methods carry return types (`: HasMany`)
  *if the project type-hints them*. **low.**
- **Business logic on the model**: only relevant if the project keeps logic on models.
  In that case a model that's a pure data bag while siblings carry behaviour is a (mild) drift. **low.**

## Migrations

- **Reversibility**: a `down()` that doesn't actually reverse `up()`, or a missing `down()`
  where the project writes reversible migrations. **med.**
- **Destructive changes**: a column/table drop, a type narrowing, or a not-null added to a
  populated table without a backfill/default. That is a data-loss risk that's invisible until
  deploy. Flag with the safe-migration note (add nullable + backfill + enforce). **high.**
- **Never edit an already-run migration**: a change to a migration that has shipped, rather
  than a new migration. Environments that already ran the old version will diverge silently.
  **high.**
- **Index & FK hygiene**: a new foreign key / frequently-queried column without an index,
  *if* siblings index theirs. **low.**
- **No PHP FQCNs / class names stored in columns** as identifiers (morph types aside, which
  are mapped): store stable string identifiers, not `App\…\Foo` strings that break on every
  rename/move. **med/high:** this is a classic refactor-blocker.

## Caching correctness

Only relevant when the diff touches caching; these are correctness/maintainability norms,
not a perf audit.

- **Never bake per-user or per-request state into a shared cache entry**: a cached payload
  keyed without the user/tenant must not embed user-specific data (an access verdict, a
  personalised flag, "my" records). One user's cached response then leaks to another. If a
  value depends on the caller, key it per-caller or resolve that part *after* the shared
  cache read. Flag a shared cache entry carrying caller-specific data. **high:** this is a
  data-leak, not a slowness.
- **Cache keys/TTLs from a central source, not magic strings**: a raw inline string cache
  key or hardcoded TTL where the project centralises them (a key class/enum, config). Flag
  the inline literal. `[established-pattern]`, **low/med**.
- **Keep the cached read pure / invalidate on write**: cache a read where the project does,
  and ensure the corresponding write path invalidates it. Flag a new write to data that a
  sibling caches but the diff never busts. **med.**

## Schema naming & types

- Table/column naming follows the project (snake_case, plural tables, `*_id` FKs,
  `*_at` timestamps). Flag the outlier. **low.**
- Column types match the data and the project's choices (snowflake/bigint id strategy,
  monetary stored as integer cents if that's the pattern, enum-backed string columns). Flag
  a `float` for money or an id type that disagrees with sibling tables. **low/med.**
