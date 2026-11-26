<!-- Generated from kanon/catalog/php-core.json in codysseydev/codyssey-skills by "node kanon/scripts/catalog.mjs generate". Do not edit by hand. -->

# PHP Core

Applies to: every PHP class, production code and tests, whatever the framework. These rules hold in Laravel and Symfony alike; framework overlays name the framework-specific calls (`orchestration-di.md` for Laravel, the `symfony-kanon` skill's `references/symfony.md` for Symfony).

Lane boundaries: this family owns the plain-PHP file shape (`strict_types`, `final readonly`, constructor promotion) for every framework, in its File shape section; `orchestration-di.md` owns the Laravel calls (`app()`, `resolve()`, facades, helpers) and the Laravel-only file kinds (migrations, factories, config).

## Dependencies

- `PHP-001` Production classes **MUST NOT** locate services at runtime; dependencies come through the constructor. A located dependency is hidden from the constructor signature, so readers and tests cannot see what the class needs. Overlays: Laravel `app()` / `resolve()` (`orchestration-di.md`), Symfony `$container->get()` (`symfony-kanon`).
- `PHP-002` Classes **MUST NOT** implement static `getInstance()` singletons; shared instances **MUST** be registered in the container. A container singleton binding (`$this->app->singleton(...)` in a service provider, as `integrations.md` does for connectors) is the sanctioned form, not the banned pattern.
- `PHP-003` A class **SHOULD NOT** extend another class only to reuse one of its methods; inject the collaborator instead.
- `PHP-004` An optional collaborator **MAY** be replaced with a Null Object implementing the same interface instead of null checks in every method.

## Control flow

- `PHP-005` Preconditions **SHOULD** be handled with early-return guard clauses instead of nested ifs.
- `PHP-006` Code **SHOULD NOT** chain through several objects to reach a value (`a->b()->c()->d()`); ask the nearest object for what you need.

## Immutability

- `PHP-007` A readonly class **SHOULD** hold immutable collections or copies, not mutable objects that callers can change. `readonly` only freezes the property, not the object behind it.

## Commands and queries

- `PHP-008` A method **SHOULD NOT** both change state and return data for display. A command **MAY** return the id it created or the outcome or decision of the change (see the handler Result DTO rule in `orchestration-di.md` and the command/query slices in `architecture.md`).

## Naming

## File shape

## Domain model

## Boundaries and integrations

## Input and authorization

## Time and caching

## Events

## Testing
