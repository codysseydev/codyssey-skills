# Query Performance

Applies to: Eloquent and query-builder queries, list and report endpoints, eager
loading, model `$with` declarations.

Lane boundaries: starting queries from `Model::query()` (not `DB::`) and eager-loading
what you iterate are owned by `models-domain.md`; this file adds query-shape rules on
top of them. Profiling and hunting slow paths that no written rule names stays with
`/code-review`.

## Filter in the database

- Queries **MUST NOT** load a whole table and filter it in PHP (`all()->filter()`,
  `get()->where()`); the condition **MUST** go into the query. The database filters
  with indexes and returns only the rows needed; PHP filtering loads every row first.
- Filtering on a relation **SHOULD** use `whereHas()`/`withCount()` so the database
  decides; eager-loading every related row to filter in PHP **SHOULD NOT** be used.
  This does not contradict "eager-load what you iterate" (`models-domain.md`): that
  rule is about rows you iterate, this one is about rows you only filter on.

## Eager loading

- Models **MUST NOT** declare a `$with` property; relations **MUST** be eager-loaded
  per query. A `$with` default loads relations on every query, including the ones
  that never read them.

## Column selection

- A trimmed `select()` **MUST** include the keys every eager-loaded relation needs
  (parent foreign key, related id in `relation:columns`). A missing key hides as a
  null relation, not as an error.
- List and report queries **SHOULD** select only the columns they use instead of
  `SELECT *`.

## Reports

- Aggregate reports **SHOULD** be one grouped query that starts from `Model::query()`
  and drops to the base builder with `toBase()`, never a PHP loop over models. This
  keeps the `models-domain.md` rule that queries start from `Model::query()`.
