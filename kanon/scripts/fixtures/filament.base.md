# Filament Admin Panels

Applies to: Filament `Resource` classes, pages, actions, widgets, panel policies,
panel service providers, and their tests. Only relevant when the codebase uses
Filament; skip this family entirely otherwise.

Lane boundaries: the admin panel as a separate application surface (own read/write
models, own enums, own guard, no cross-surface imports or event subscriptions) is
owned by `isolation.md`; class shape and DI by `orchestration-di.md`; gateway rules
by `integrations.md`. Cross-reference them, do not re-audit here.

## Resource wiring

- Every resource **MUST** ship a `{Resource}ResourceServiceProvider` whose `boot()`
  binds the policy to the resource's read model:
  `Gate::policy(OrderReadModel::class, OrderPolicy::class)`. A resource with no
  provider, or a provider that registers the resource but never binds its policy,
  is incomplete.
- The resource's command/handler pairs **MUST** be wired via `Bus::map([...])` in
  that same provider.
- Exception: a resource managing a third-party package's model (e.g. Spatie's
  `Role`) **MAY** gate the vendor model directly, since no read model of its own
  exists.

## Write actions

- A resource's write capability **MUST** live in a nested action folder holding a
  `{Action}Command`, `{Action}CommandHandler`, and a past-tense fact event named
  `*ByAdmin` (use `*ByPlatformAdmin` where "admin" already means something else in
  that context, e.g. team admins).
- The handler **MUST** mutate through the panel's write model, never a `*ReadModel`,
  and **MUST** dispatch the fact event only after the write succeeds. An event named
  as intent (`*RequestedByAdmin`) or dispatched before the mutation is a violation.
- Pages and actions **MUST** dispatch the command (from `->using()` closures or page
  hooks), never mutate state inline in the page/action class.
- Provider-touching flows (payments, external systems) **MUST** go through the
  panel's own gateway, never a raw connector inline (see `integrations.md`).

## Table, form, and infolist helpers

- A resource's `table()`, `form()`, and `infolist()` **MUST** delegate to static
  sibling helper classes (`OrdersTable::configure($table)`,
  `UserForm::configure($schema)`, `OrderInfolist::configure($schema)`), never carry
  the full component tree inline in the resource class.

## Read-only vs CUD page sets

- A read-only resource exposes **List + View only** (`ListRecords` + `ViewRecord`,
  an `infolist()`, no `form()`). A CUD resource exposes **List/Create/Edit** with a
  `form()`, its pages dispatching commands. A half-pattern **MUST NOT** exist: no
  `form()` growing on a read-only resource, no CUD resource missing its form or
  create/edit pages.

## Policies

- Every policy method **MUST** type its first argument against the panel's own
  principal model (`Admin $admin`), never the customer app's `User` and never
  `mixed`.
- A read-only resource's policy defines `viewAny` + `view` only; a CUD resource
  adds `create`/`update`/`delete`, with a self-guard where it matters
  (`delete()` returns `$admin->id !== $user->id`).

## Widgets

- A stats widget **MUST** dispatch a `*StatsQuery` and build its stats from the
  typed result inside `getStats()`, never query the database or models directly.
- Widgets **MUST** disable polling (`$pollingInterval = null`) unless live data is
  explicitly required and justified.

## Version-sensitive imports (Filament v4+)

Easy to get wrong against older docs; flag when violated:

- Actions (`EditAction`, `DeleteAction`, `CreateAction`, `DeleteBulkAction`,
  `BulkActionGroup`, `ViewAction`) import from `Filament\Actions`, **not**
  `Filament\Tables\Actions`. Columns/filters still come from
  `Filament\Tables\Columns` / `Filament\Tables\Filters`.
- `Resource::infolist()` takes `Filament\Schemas\Schema`; `Section` comes from
  `Filament\Schemas\Components\Section`; `TextEntry`/`RepeatableEntry` stay in
  `Filament\Infolists\Components`.
- Panel enums **MUST** implement `Filament\Support\Contracts\HasLabel` and
  `HasColor`.
- A `TextInput` holding a snowflake or other large integer id **MUST NOT** use
  `->numeric()` (float precision silently corrupts the value); use
  `->rules(['integer', 'min:1'])`.

## Tests

- Filament tests drive pages with `Livewire::test(...)`, call
  `Filament::setCurrentPanel(...)` in `setUp()`, and view-page tests **MUST**
  assert the displayed fields, not just that the page renders. General test rules
  are owned by `testing.md`.

## What is NOT a violation

- A read-only resource with no `form()`; that is the correct read-only shape.
- Gating a third-party model directly where no read model exists (the provider
  exception above).
- Pages/widgets resolving the `Dispatcher` via `App::make(Dispatcher::class)`
  instead of constructor injection; Filament instantiates these classes itself, so
  this is the sanctioned exception to the DI rules.
- Read-model factories being non-`final` (they rely on late static binding).
