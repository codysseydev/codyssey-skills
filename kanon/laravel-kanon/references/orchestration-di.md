# Orchestration & Dependency Injection

Applies to: controllers, command/query handlers, console commands, event listeners,
jobs, application services, middleware.

## The orchestrator pattern

- Application-layer classes **MUST** be orchestrators, not executors: resolve
  dependencies, delegate to a domain method, dispatch events/commands. Nothing else.
- An orchestrator **MUST NOT**:
  - contain business logic (calculations, eligibility decisions, status derivation,
    interpreting vendor data vocabularies);
  - mutate model state directly (`$model->forceFill(...)->save()`, attribute
    assignment) instead of calling a domain method that owns the change;
  - create related records inline (looping over children calling `create()`) instead
    of one aggregate method;
  - call an external system (HTTP, filesystem, PDF, mail transport) directly instead
    of a dedicated infrastructure class.
- Business logic **MUST** live in domain model methods (`Team::createPersonal()`,
  `$subscription->recordRenewal()`); infrastructure **MUST** live in dedicated
  service classes.
- Guard clauses on coordination data (null payload, empty list), parsing inbound
  payloads into typed values, and routing an external event to the right domain
  method **MAY** stay in the orchestrator; that is coordination, not business logic.

## Tell, Don't Ask

- Condition-plus-action **MUST** live on the model: `$sub->recoverIfPastDue()`, never
  `if ($sub->isPastDue()) { $sub->activate(); }` in a handler.
- Lookups **MUST** use `findByXOrFail()` model methods, not `find()` plus a null
  check in the caller. A plain "find by id or 404" **MUST** use Eloquent's
  `findOrFail()`; a bespoke not-found exception **MUST NOT** be invented for a
  missing row. Custom exceptions are for genuine domain errors.
- Comparisons **SHOULD** hide behind intention-revealing methods on the owning
  object (`$achievement->isEarnedAtLevel($level)`, `$a->isHigherThan($b)`), not raw
  attribute comparisons in an orchestrator. A primitive validity guard on a single
  scalar **MAY** stay inline.

## Dependency injection: no facades, no helpers

- Production classes **MUST NOT** use facades or global helpers. Inject contracts:
  - `config()` -> `Illuminate\Contracts\Config\Repository`
  - `event()` -> `Illuminate\Contracts\Events\Dispatcher`
  - `now()` -> `CarbonImmutable::now()` (explicit import)
  - `Log::` -> `Psr\Log\LoggerInterface`
  - `DB::` -> `Illuminate\Database\ConnectionInterface`
  - `Auth::` -> `Illuminate\Contracts\Auth\Factory`
  - `Cache::` -> `Illuminate\Contracts\Cache\Repository` (decorators only, see below)
  - `response()->json()` -> `new JsonResponse(...)`
  - `app()`, `collect()` **SHOULD NOT** appear where avoidable.
- Regular classes **MUST** use constructor injection; queued jobs **MUST** use method
  injection on `handle()`.
- Facades and helpers **MAY** be used in: blade views, route files, migrations,
  service providers, factories, and tests.

## Class shape

- `declare(strict_types=1);` **MUST** open every PHP file. This family owns the
  file-shape rules for the whole codebase (models, migrations, factories, config,
  tests included).
- Controllers, handlers, listeners, events, DTOs **MUST** be `final readonly class`.
  Queued jobs **MUST** be `final` but **MAY** drop `readonly` (queue interaction
  mutates state). The same applies to queued listeners that use
  `InteractsWithQueue`, whose untyped `$job` property a readonly class cannot hold.
- Controllers **MUST NOT** extend the framework base `Controller` class; a
  single-action controller needs nothing from it, and PHP forbids a `readonly`
  class extending a non-readonly parent, so the extend itself blocks the shape
  rule. Import any needed concern explicitly instead.
- Constructor property promotion and explicit parameter/return types **MUST** be
  used. An empty constructor body **MUST NOT** exist; remove it.
- Control structures **MUST** use curly braces, even single-line bodies.
- Truthy/falsy checks (`if (! $x)`) **SHOULD** be preferred over explicit
  `=== null` comparisons, except where a falsy non-null value is legitimately
  distinct from null.
- Comments **MUST NOT** narrate what the next line does and **MUST NOT** form
  step-by-step blocks. A brief why-comment (workaround, ordering constraint) or a
  short class-level PHPDoc **MAY** exist.

## Controllers and handlers

- Controllers **MUST** be single-action (`__invoke()` only), never multi-action
  resource controllers.
- A handler **MUST** expose exactly one public `handle(Command|Query): ReturnType`.
- Handlers **MUST** return typed Result DTOs, never associative arrays.
- Controllers **MUST** return an API Resource or `JsonResponse` with an explicit
  status, never a bare array.
- Controllers **MUST NOT** try/catch domain exceptions; domain exceptions render
  themselves (see `models-domain.md`).
- Validation **MUST** live in Form Request classes with array-syntax rules
  (`['required', 'string']`), never inline `$request->validate([...])` and never
  string-pipe rules. Every Form Request **MUST** define both `authorize()` and
  `rules()`.

## Events, side effects, and audit

- Domain events **MUST** be dispatched from the application layer. A model **MUST
  NOT** dispatch events and **MUST NOT** receive a `Dispatcher`; the model returns a
  value/decision, the orchestrator dispatches. Repeated decide-then-dispatch logic
  **SHOULD** be extracted into one small application-layer service.
- Audit/history records **MUST NOT** be written inline in handlers, jobs, or model
  methods. Pattern: state change -> domain event -> a dedicated `final readonly`
  listener records it.
- Mailables **MUST** implement `ShouldQueue` and **MUST** be sent from a listener via
  an injected `Mailer`, never the `Mail` facade and never inline from a command
  handler. Email is a side effect of a domain event.

## Queues and slow work

- Time-consuming or external work (HTTP calls, emails, heavy processing) **MUST**
  run in a `ShouldQueue` job, never synchronously in a handler or controller.
- Every queued job/mailable **MUST** set its queue explicitly in the constructor via
  a backed `QueueName`-style enum (`$this->queue = QueueName::NOTIFICATIONS->value;`),
  never a raw string and never the implicit default.
- Jobs that talk to external systems **MUST** declare explicit `$tries` and
  `$backoff`.

## Caching

- Query handlers **MUST** stay pure: no cache reads/writes inside a handler. Caching
  lives in a `Cached{Handler}` decorator wired in the service provider.
- Cache keys, tags, and TTLs **MUST** come from centralized enum/key classes, never
  raw strings or hardcoded integers.
- Cached payloads **MUST** stay user-agnostic: per-user data (access verdicts,
  ownership flags, personalization) resolves after the cache, in the controller,
  never baked into a shared cached entry.

## Middleware

- Middleware aliases, groups and global middleware **MUST** be registered in
  `bootstrap/app.php` (`->withMiddleware(...)`), not in route files or an HTTP
  kernel. Route files only apply middleware by name (`->middleware('auth:sanctum')`).
