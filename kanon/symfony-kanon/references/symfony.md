<!-- Generated from kanon/catalog/symfony.json in codysseydev/codyssey-skills by "node kanon/scripts/catalog.mjs generate". Do not edit by hand. -->

# Symfony

Applies to: Symfony controllers, services, Messenger message handlers, console commands.

## Dependency injection

- `SYM-001` Services **MUST NOT** be fetched with `$container->get()`; they **MUST** be autowired through the constructor. This is the Symfony form of the no-service-location rule in `php-core.md` (`laravel-kanon` skill).

## Writes

- `SYM-002` Writes **MUST** go through a Symfony Messenger command dispatched to one handler, so every write shares one transaction and validation path. This is the Symfony counterpart of the Laravel command/handler slice (`architecture.md` in the `laravel-kanon` skill).

## Messenger slices

## Controllers

## HTTP API

## Authorization

## Domain model

## Doctrine persistence

## Integrations

## Console and scheduling

## Performance

## Module isolation

## Testing
