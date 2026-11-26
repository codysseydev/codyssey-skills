<!-- Generated from kanon/catalog/symfony.json in codysseydev/codyssey-skills by "node kanon/scripts/catalog.mjs generate". Do not edit by hand. -->

# Symfony

Applies to: Symfony controllers, services, Messenger message handlers, console commands.

## Dependency injection

- `SYM-001` Services **MUST NOT** be fetched with `$container->get()`; they **MUST** be autowired through the constructor. This is the Symfony form of the no-service-location rule in `php-core.md` (`laravel-kanon` skill).
- `SYM-003` Product modules **MUST NOT** depend on a `ContainerInterface` (a closed locator under SYM-005 excepted), and production classes **MUST** inject contracts (`LoggerInterface`, `ClockInterface`, `Security` in controllers only) instead of globals; `Framework\` is exempt.
- `SYM-004` Credentials and config values **MUST** come from `%env(...)%` parameters or the secrets vault, and production classes **MUST NOT** call `getenv()` or read `$_ENV` or `$_SERVER` outside `Framework\`.
- `SYM-005` A service locator with a closed, declared service list (`#[AutowireLocator]`, `getSubscribedServices()`) **MAY** be used for runtime selection such as a keyed strategy map.
- `SYM-006` CI **SHOULD** run `bin/console lint:container` so an unautowirable service fails at compile time, not on first request.
- `SYM-007` A query handler **MUST** stay pure (no cache reads or writes); caching **MUST** live in a middleware on `query.bus`, and logging around the handler **SHOULD** live there too.
- `SYM-008` Cache keys, tags and TTLs **MUST** come from centralized enum or key classes, never raw strings or hardcoded integers.

## Writes

- `SYM-002` Writes **MUST** go through a Symfony Messenger command dispatched to one handler, so every write shares one transaction and validation path. This is the Symfony counterpart of the Laravel command/handler slice (`architecture.md` in the `laravel-kanon` skill).

## Messenger slices

- `SYM-009` A read-only context (reporting projection, query layer) **MUST NOT** contain a message dispatched on `command.bus`, its handler, or a domain event it emits; it reacts to events with listeners and answers queries.
- `SYM-010` Every capability **MUST** ship as a vertical slice (message, handler, `*Controller`, `*Request`, `*Resource` in one folder), and a module **SHOULD NOT** group slices under domain folders (`Lifecycle/`, `Queries/`) before about ten slices; names carry the suffix `{Action}Command`, `{Action}Query`, `{Action}CommandHandler`, `{Action}QueryHandler`, `{Action}Controller`, `{Action}Request`, `{Action}Resource` or `{Action}ConsoleCommand`, with no `*Job`.
- `SYM-011` Slice pieces **MUST** be co-located in that slice's folder, and code **MUST NOT** be scattered across type-named folders (`Controller/`, `Request/`, `Resource/`, `Enum/`, `Event/`, `Entity/`, `Repository/`, `Message/`, `Dto/`) inside a module.
- `SYM-012` Every command and query **MUST** have exactly one handler, bound to its bus explicitly with `#[AsMessageHandler(bus: 'command.bus')]` or `#[AsMessageHandler(bus: 'query.bus')]`; Messenger has no option enforcing one handler, so a check fails a message handled twice.
- `SYM-013` A message handler **MUST NOT** be a pass-through whose body only dispatches an event with no preceding mutation.
- `SYM-014` Application-layer classes (handlers, listeners, console commands) **MUST** be orchestrators that resolve dependencies, delegate to an entity or domain-service method, and dispatch; they **MUST NOT** hold business logic, mutate entity state directly, create related rows inline, or call an external system directly; guard clauses and payload parsing **MAY** stay.
- `SYM-015` Controllers, handlers, listeners, messages (`*Command`, `*Query`), events, `*Request` and `*Resource` DTOs **MUST** be `final readonly class`; entities and console commands extending a non-readonly base **MAY** drop `readonly`.
- `SYM-016` A message handler **MUST** be named `{Action}CommandHandler` or `{Action}QueryHandler` and expose exactly one public method, `__invoke(Message)`.
- `SYM-017` A query handler **MUST** return a typed `*Result` DTO, never an array, and a command handler **MUST** return nothing (`void`), so the caller creates the id and puts it in the command.
- `SYM-018` Domain events **MUST** be dispatched from the application layer on `event.bus`, and an entity **MUST NOT** dispatch events or receive an `EventDispatcherInterface` or a message bus.
- `SYM-019` Audit and history records **MUST NOT** be written inline in handlers or entity methods; a state change **MUST** dispatch a domain event and a dedicated `final readonly` listener on `event.bus` **MUST** record it.
- `SYM-020` Mail **MUST** be sent from a listener through `MailerInterface`, with `SendEmailMessage` routed to the async transport, never inline from a handler.
- `SYM-021` Messages and events **MUST NOT** hold Doctrine entities; they **MUST** carry ids, scalars, value objects or a small DTO.
- `SYM-022` Events **MUST** be past-tense facts dispatched on `event.bus` with `DispatchAfterCurrentBusStamp`, so listeners run after the command's transaction commits and never run if the handler throws.
- `SYM-023` Events **MUST** be `final readonly`, constructor only, with no query or business helper methods.
- `SYM-024` Commands, queries and events **MUST** use separate Messenger buses (`command.bus`, `query.bus`, `event.bus`), each with its own middleware.
- `SYM-025` The event bus **MUST** set `allow_no_handlers: true` and register one `#[AsMessageHandler(bus: 'event.bus')]` handler per listener.
- `SYM-026` The command bus **SHOULD** include the `validation` middleware, with `Assert` constraints on command classes that no `*Request` validates (console, scheduler, consumers), so a constraint is declared once and invalid input never reaches a handler.
- `SYM-027` Every write **MUST** run in one transaction opened by the `doctrine_transaction` middleware on `command.bus`; handlers, controllers, aggregates and domain services **MUST NOT** open, commit or flush a transaction themselves.
- `SYM-028` A `catch (DomainException)` around `dispatch()` **MUST NOT** be used, because Messenger wraps handler exceptions in `HandlerFailedException`; code dispatching on a synchronous bus **MUST** unwrap it so the domain exception reaches the exception listener.
- `SYM-029` A handler **MUST NOT** populate an entity from a command or request DTO wholesale (serializer `OBJECT_TO_POPULATE`, ObjectMapper, array hydration); it **MUST** list the fields it writes.

## Controllers

- `SYM-030` Controllers **MUST NOT** extend `AbstractController`; a `readonly` class cannot extend the non-readonly `AbstractController`, so a controller injects any service it needs explicitly.
- `SYM-031` Controllers **MUST** be single-action (`__invoke()` only) with `#[Route]` on the class, never multi-action controllers.
- `SYM-032` A controller **MUST NOT** call or inject another controller, including through `forward()`; shared work moves into a handler that both controllers call through a bus.
- `SYM-033` Each user intent **MUST** have its own route, and an endpoint **MUST NOT** pick its action from the request body.
- `SYM-034` Every route **MUST** be named `{module}.{resource}.{action}` through `#[Route(name:)]`; thin public one-off routes **MAY** use a single-segment name.
- `SYM-035` Route parameters **MUST** be plain ids resolved inside the handler, and `#[MapEntity]` or an entity-typed controller argument **MUST NOT** be used.
- `SYM-036` Controllers **MUST NOT** call `persist()` or `flush()` and **SHOULD NOT** hold business rules; they turn the request into a command, dispatch it, and build the response.

## HTTP API

- `SYM-037` Each module **MUST** own its route file (`<module>-routes.php`), imported from `modules.php` with its `/api` prefix declared there.
- `SYM-038` Abuse-prone endpoints (login, signup, email resend, password reset) **MUST** be rate limited: `login_throttling` on the login firewall, `#[RateLimit]` on the others.
- `SYM-039` HTTP input **MUST** be a `*Request` DTO bound with `#[MapRequestPayload]` or `#[MapQueryString]` and validated with `#[Assert\...]` constraints, never an inline `$validator->validate()` call; `#[MapQueryString]` **MUST** set `validationFailedStatusCode: 422` because it defaults to 404, and authorization **MUST NOT** live in the DTO.
- `SYM-040` Each write action **MUST** have its own `*Request` DTO, and a `*Request` **MUST NOT** serve several actions.
- `SYM-041` Every field the handler reads **MUST** be a required constructor parameter of the `*Request`, or optional with a default written in the constructor signature; a handler-read field **MUST NOT** be optional by accident (an uninitialized property).
- `SYM-042` Fields an endpoint ignores **SHOULD** be rejected with `AbstractNormalizer::ALLOW_EXTRA_ATTRIBUTES => false` in the payload `serializationContext`, so clients get a 422 instead of a silent success.
- `SYM-043` Date inputs **MUST** use an explicit format, `#[Assert\Date]` on a `Y-m-d` string or `DateTimeNormalizer::FORMAT_KEY` in the payload `serializationContext`, never the loose default parser.
- `SYM-044` Client-chosen sort and filter fields **MUST** arrive as backed-enum `*Request` properties mapped to columns you chose to expose; raw input **MUST NOT** reach `orderBy()`, `addOrderBy()` or `where()` as a field name.
- `SYM-045` A `#[Assert\...]` constraint **MUST** stay on the `*Request` property even when a value object also enforces it, so form users get a field-level 422 instead of a 500.
- `SYM-046` Create **MUST** return 201 (`Response::HTTP_CREATED`); a create that returns 200 is a violation.
- `SYM-047` State changes and deletes **MUST** return 204 with no body; reads return 200.
- `SYM-048` Controllers **MUST** return a `*Resource` in a `JsonResponse` or `Response` with an explicit status, and **MUST NOT** hand-assemble arrays; dedicated `*Resource` classes build the body.
- `SYM-049` A `*Resource` **MUST NOT** map a nested collection inline; nested relations **MUST** get their own `*Resource` class.
- `SYM-050` A `*Resource` **MUST** be built from the typed Result DTO the handler returns through `QueryBus::ask()`, never from array keys.
- `SYM-051` Response keys **MUST** be snake_case, a single object **MUST** be wrapped in `data`, collections **MUST** add `meta` and `links`, and errors **MUST** use the RFC 7807 problem details shape Symfony emits (`type`, `title`, `status`, `detail`).
- `SYM-052` Dates **MUST** serialize as ISO 8601 with `format(\DATE_ATOM)` or the default `DateTimeNormalizer`.
- `SYM-053` Every API controller **MUST** carry attribute-driven OpenAPI documentation (`#[OA\Response]` and the like), with a matching `#[OA\Parameter]` for every route parameter.
- `SYM-054` The documented response example **MUST** match the `*Resource` output shape, with realistic data.
- `SYM-055` Webhook routes **MUST** live in their own route file (or be mounted by the Webhook component), behind signature verification, on an entry open to the provider (`PUBLIC_ACCESS`), and **MUST NOT** sit behind user authentication.
- `SYM-056` Webhook processing **MUST** be dispatched to an async transport and **MUST** be idempotent: check an idempotency key against a tracking record first, no-op on repeats, and record the outcome so the tracking record always settles.
- `SYM-057` Controllers **MUST NOT** try/catch domain exceptions; each module **MUST** have a base `*Exception`, and its concrete domain exceptions extend it and carry `#[WithHttpStatus]` so they render themselves.

## Authorization

- `SYM-058` A message handler **MUST** receive the acting user as a field of its command and **MUST NOT** read `Security` or `TokenStorageInterface`; the controller takes the actor from the authenticated principal, never from the request body.
- `SYM-059` Every endpoint touching owned data **MUST** authorize the actor against the loaded entity with a Voter, checked in the handler through `AuthorizationCheckerInterface` on a synchronous bus, and a handler **MUST NOT** use `find()` plus a hand-written ownership check.
- `SYM-060` The authorization gate **MUST** throw a product `*Exception` carrying `#[WithHttpStatus(403)]` (or a Voter denial raising `AccessDeniedException`), and controllers **MUST NOT** build 403 responses inline.
- `SYM-061` Capability-gated endpoints **MUST** use `#[IsGranted]` with a class constant or a backed-enum `->value`, never a string literal.
- `SYM-062` State-changing and owned-data routes **MUST** require authentication through `access_control` or `#[IsGranted('IS_AUTHENTICATED_FULLY')]`; only genuinely public reads **MAY** use `PUBLIC_ACCESS`.
- `SYM-063` Once a product has a second application, each application surface **MUST** authenticate through its own firewall and user provider, and firewalls and role enums are never shared.

## Domain model

- `SYM-064` Business logic **MUST** live in entity methods (invariants and state transitions), finders **MUST NOT** live on the entity, entities **SHOULD NOT** expose public setters that skip the rules, and logic spanning several aggregates **MUST** live in a handler.
- `SYM-065` A command handler **SHOULD** save one aggregate; other aggregates **SHOULD** be updated by a listener on `event.bus` that reacts to a domain event dispatched with `DispatchAfterCurrentBusStamp`.
- `SYM-066` Collection associations **MUST** be typed `Collection` with generics (`Collection<int, OrderLine>`).
- `SYM-067` Entities and custom Doctrine types **MUST NOT** run queries or depend on `EntityManagerInterface` or a repository; derived values **MUST** be computed from data already loaded.
- `SYM-068` A read model **MUST** be strictly read-only: a `final readonly` DTO built by a query handler, or an `#[ORM\Entity(readOnly: true)]` over a table the module does not write; mutations belong to the write entity.
- `SYM-069` Handlers and entities **MUST NOT** throw `\RuntimeException` or Symfony HTTP exceptions for business rules; they **MUST** throw a named product exception.
- `SYM-070` Domain and application classes **MUST NOT** import `HttpFoundation`, `HttpKernel` or `Doctrine\` types, except ORM mapping attributes and `Collection` on entities and `#[WithHttpStatus]` on product exceptions; each vendor SDK or HTTP client **MUST** sit behind an interface with an adapter (the Doctrine repository is that adapter), while Symfony attributes, `Assert` constraints, Messenger, Uid and PSR contracts **MAY** be imported.

## Doctrine persistence

- `SYM-072` A lookup by id **MUST** go through a repository method that throws a product exception when the row is missing, mapped to 404 with `#[WithHttpStatus(404)]`; callers **MUST NOT** `find()` and null-check the result.
- `SYM-073` A module **MUST NOT** add columns to another module's tables; it **MUST** create its own table keyed by the other module's id.
- `SYM-074` Cross-module data access that is not materialized under SYM-104 **MUST** be read-only, through an injected `Doctrine\DBAL\Connection` inside a repository or read-model query with id-based queries; a module **MUST NOT** insert, update or delete rows in another module's tables.
- `SYM-075` Once a second application exists, each application **MUST** own its read models (entities mapped `#[ORM\Entity(readOnly: true)]`), its write models and its enums.
- `SYM-076` Queries **MUST** go through a repository and fetch-join what they iterate; production classes outside repositories and read-model queries **MUST NOT** depend on DBAL `Connection`.
- `SYM-077` A query rule used by more than one handler **SHOULD** live in one Specification or one named repository method instead of being repeated.
- `SYM-078` A Doctrine lifecycle callback or entity listener **MUST NOT** call `flush()` or `persist()` for the entity that triggered it; decide every field first and write once.
- `SYM-079` Publicly exposed identifiers **MUST NOT** be enumerable auto-increment integers; ids **MUST** be ULIDs or UUIDv7 created by the caller.
- `SYM-080` A Doctrine migration **MUST** implement a `down()` that reverses it, or call `throwIrreversibleMigrationException()` with a note.
- `SYM-081` PHP FQCNs **MUST NOT** be stored in database columns (defaults, seeds, discriminator values); use plain string identifiers.
- `SYM-082` Lifecycle state **MUST** be a string column mapped to a backed enum with an index, never a boolean flag.
- `SYM-083` Doctrine-backed repositories **SHOULD** implement a domain interface by wrapping `EntityManagerInterface`, not extend `ServiceEntityRepository`, so `find*` is not public; `add()` **SHOULD** only `persist()`, because the `doctrine_transaction` middleware on `command.bus` flushes.

## Integrations

- `SYM-085` Every external system **MUST** sit behind a dedicated gateway class owned by the integrating module, one per vendor, with domain-language methods and typed DTOs; handlers, listeners and controllers **MUST NOT** call a vendor SDK or `HttpClientInterface` directly.
- `SYM-086` A decoded external payload **MUST** become a typed DTO once, at the edge, before any other code reads it.
- `SYM-087` HTTP integrations **MUST** use one scoped `HttpClient` per vendor, with base URL, timeouts and retry set in config and injected with `#[Target]`.
- `SYM-088` A parameter default for a vendor host **SHOULD** point at the real production host, not a placeholder.
- `SYM-089` A class that needs config values **SHOULD** receive them as typed constructor parameters with `#[Autowire(param: ...)]`, not through `ParameterBagInterface`.
- `SYM-090` Outbound effects triggered by domain changes **MUST** hang off domain events handled by listeners on `event.bus`, so the integration can be replayed, retried or removed without touching domain code.

## Console and scheduling

- `SYM-091` Time-consuming or external work (HTTP calls, mail, heavy processing) **MUST** run in an asynchronous Messenger handler on a routed transport, never synchronously in a handler or controller.
- `SYM-092` Every asynchronous message **MUST** be routed to a named transport explicitly (`#[AsMessage('async')]` or `framework.messenger.routing`), never left to a default or a fallback.
- `SYM-093` A transport carrying messages that call external systems (webhooks included) **MUST** declare an explicit `retry_strategy` and a `failure_transport`.
- `SYM-094` Handlers **SHOULD** throw `UnrecoverableMessageHandlingException` for failures a retry cannot fix and `RecoverableMessageHandlingException` to force a retry.
- `SYM-095` Handlers in a long-running Messenger worker **SHOULD** load their entities by id on every call and keep none in properties, because the worker clears the entity manager after each message (`DoctrineClearEntityManagerWorkerSubscriber` from the Doctrine bridge).

## Performance

- `SYM-096` A query **MUST NOT** load a whole table and filter it in PHP (`findAll()` then `array_filter()`); the condition **MUST** go into the DQL or `QueryBuilder`.
- `SYM-097` Filtering on an association **SHOULD** use a DQL join, an `EXISTS` subquery or `COUNT` so the database decides; fetching every association row to filter in PHP **SHOULD NOT** be used.
- `SYM-098` A mapping **MUST NOT** declare `fetch: 'EAGER'` on an association; associations **MUST** be loaded per query with a fetch join (`SELECT o, l FROM Billing\Order\Order o JOIN o.lines l`).
- `SYM-099` List and report queries **SHOULD** select only the columns they use (`SELECT NEW ResultClass(...)` or a scalar select), and an aggregate report **SHOULD** be one `GROUP BY` query, never a PHP loop over entities.

## Module isolation

- `SYM-100` Product code **MUST** be organised into modules listed in `modules.php`, one root namespace per business capability (`Billing\`, `Orders\`), not into framework-type namespaces (`Service\`, `Repository\`, `Action\`) at the product root.
- `SYM-101` A module **MUST NOT** import another module's classes (entities, enums, messages, handlers, services or value objects), except a published domain event and an interface the consuming module owns that the providing module implements (SYM-102); `Framework\` is allowed from every module.
- `SYM-102` Cross-module collaboration **MUST** go through a contract (interface) defined by the consuming module and implemented by the providing module, or through a published domain event, never through any other import; a module **MUST** own its copy of any value object it needs, and a slice **MUST** live in the module that owns the capability.
- `SYM-103` Cross-module references **MUST** be plain columns holding the other module's id, never a Doctrine association (`ManyToOne`, `OneToMany`, `OneToOne`, `ManyToMany`) to another module's entity and never a database foreign key across modules.
- `SYM-104` Data another module owns but this module needs at runtime **MUST** be materialized on this module's own table and kept in sync by an event listener, not fetched across modules per request.
- `SYM-105` Once a second application exists, application namespaces **MUST NOT** import from each other, in either direction.
- `SYM-106` Once a second application exists, an application **MUST NOT** register a listener on another application's event (by attribute, tag or string FQCN).
- `SYM-107` Once a second application exists, every side effect of an application's action **MUST** be handled by that application's own listeners, and an application **MUST NOT** dispatch another application's domain events to reuse its cascades.

## Testing

- `SYM-108` Tests **MUST** use PHPUnit with the `#[Test]` attribute; a test that boots the kernel **MUST** extend `KernelTestCase` or `WebTestCase`; Pest **MUST NOT** be used.
- `SYM-109` Pure domain tests **SHOULD** extend `PHPUnit\Framework\TestCase`, so they run without booting the kernel or the database.
- `SYM-110` Tests that touch the database **MUST** isolate state with Foundry's `#[ResetDatabase]` attribute on the test class and the `FoundryExtension` PHPUnit extension registered; the `ResetDatabase` and `Factories` traits are deprecated since Foundry 2.9.
- `SYM-111` Test data **MUST** come from factories and their named states; a hand-built `new Entity(...)` followed by `persist()` where a state exists is a violation.
- `SYM-112` Every entity **MUST** ship a test factory: a `final` class extending `PersistentObjectFactory`, with named state methods for each lifecycle position.
- `SYM-113` Tests **MAY** fetch services from the test container (`static::getContainer()->get(...)`); production code still never fetches services from the container.
- `SYM-114` Controller happy-path tests **MUST** assert the full response structure (every key of the `*Resource`), not a spot-check.
- `SYM-115` Every `#[Assert\...]` constraint on a `*Request` **MUST** have a `WebTestCase` test that triggers it and asserts the 422.
- `SYM-116` Any test that creates, updates or deletes data **MUST** assert the resulting database state with `assertSame`, re-reading through an `EntityManager` that was cleared first.
- `SYM-117` A handler that dispatches a domain event **MUST** be tested by asserting the event class and its properties on `event.bus` (`InteractsWithMessenger` from zenstruck/messenger-test, or `InMemoryTransport::getSent()` for an event routed to a transport).
- `SYM-118` Side effects **MUST** be asserted (`assertEmailCount()`, `assertQueuedEmailCount()`, the notifier assertions, `InMemoryTransport::getSent()`).
- `SYM-119` Every product `*Exception` **MUST** have a test that triggers it and asserts the HTTP status and message.
- `SYM-120` Every authenticated endpoint **MUST** have a test asserting the unauthenticated response, and every owned-resource endpoint a test asserting failure for a non-owner.
- `SYM-121` Controller tests **SHOULD** assert the dispatched command against an in-memory bus instead of running the handler.
