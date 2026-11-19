# Routes, HTTP & API Serialization

Applies to: route files, middleware wiring, Form Request field rules, HTTP
statuses, API resources, response shape, inbound webhooks.

Lane boundaries: Form Request shape (array-syntax rules, `authorize()` plus
`rules()`, no inline `$request->validate()`) is owned by `orchestration-di.md`.
This file owns what the rules accept and how input reaches the handler.

## Routes

- Each module **MUST** own its route file (`{module}-routes.php`), loaded by the
  module's service provider under the `api` prefix. A module route file loaded with
  `loadRoutesFrom()` **MUST** declare its `api` prefix and `api` middleware
  explicitly, because `loadRoutesFrom()` adds neither
  (`Route::prefix('api')->middleware('api')->group(...)`).
- Each user intent **MUST** have its own route; one endpoint **MUST NOT** pick its
  action from the request body. One endpoint serving several intents forces a
  single authorization rule to cover all of them.
- Every route **MUST** be named, following `{module}.{resource}.{action}`
  (`commerce.orders.create`). Thin public one-off routes **MAY** use a simple
  single-segment name.
- Route parameters **MUST** be plain ids resolved inside the query/command handler.
  Route-model binding **MUST NOT** be used; implicit binding hides the lookup, skips
  the ownership gate, and couples routes to Eloquent.
- Middleware aliases and groups **MUST** be registered in `bootstrap/app.php`;
  route files only apply them by name, they do not define them.

## Public vs authenticated

- State-changing routes and owned-data routes **MUST** sit inside an auth middleware
  group (`auth:sanctum`, plus `verified` for sensitive operations). Only genuinely
  public reads **MAY** live outside it.
- Abuse-prone endpoints (login, signup, email resend, password reset) **MUST**
  carry a `throttle:` limiter.
- Privileged writes **MUST** carry capability middleware (`abilities:` / `can:`)
  referencing a typed constant, never a magic string (see `authorization.md`).

## Form Request input

- Each write action **MUST** have its own Form Request; a request **MUST NOT**
  branch on `isMethod()` to serve several actions.
- Every field the handler reads **MUST** be `required`, or `required` plus
  `nullable`, or given an explicit default in the Form Request; `sometimes`
  **MUST NOT** be used for a field the handler reads.
- Fields an endpoint ignores **SHOULD** be marked `prohibited` so clients get a 422
  instead of a silent 204.
- Date inputs **MUST** be validated with `date_format:Y-m-d` (or an explicit
  format) and read with `$request->date()`, never the loose `date` rule.
- Client-chosen sort and filter columns **MUST** be validated with `Rule::enum()`
  and mapped to columns you chose to expose; raw input never reaches `orderBy()` or
  `where()` as a column name.
- A field rule **MUST** stay in the Form Request even when a value object also
  enforces it, so form users get a field-level 422 instead of a 500 (the value
  object's invariants are in `models-domain.md`).
- `validated()` **MUST NOT** be spread into `create()`/`update()`; the handler
  **MUST** list the columns it writes. Models are unguarded (see
  `models-domain.md`), so every validated key would become a column write.

## HTTP status discipline

- Create **MUST** return 201 (via the resource's `withResponse()` or
  `->response()->setStatusCode(201)`).
- State changes and deletes **MUST** return 204 with no body.
- Reads return 200.
- A create returning 200, or a delete returning a body, is a violation.

## Response shape

- Responses **MUST** be built by dedicated `JsonResource` classes; controllers never
  hand-assemble arrays.
- A resource **MUST NOT** manually map a collection (`$this->items->map(...)`);
  nested relations get their own resource class and `::collection()`.
- A resource **MUST** read typed DTO/model properties, never associative-array keys;
  the feeding handler returns a Result DTO.
- Keys **MUST** be snake_case; a single object is wrapped in `data`; collections add
  `meta` and `links`; errors are a bare `message` (plus `errors` for validation)
  with no `data` wrapper.
- Dates **MUST** serialize via `->toIso8601String()`.
- Optional/relation fields **MUST** be conditional (`when(...)`, `whenLoaded(...)`).

## API documentation

- Every API controller **MUST** carry attribute-driven documentation (Scribe's
  `#[Endpoint]`, `#[Group]`, `#[Response]`, plus `#[Authenticated]` and
  `#[UrlParam]` where relevant, from the `knuckleswtf/scribe` package, or an
  equivalent generator's attributes). An
  undocumented endpoint is incomplete work.
- The `#[Response]` example **MUST** match the resource's actual output shape,
  with realistic example data; a documented shape that lies is worse than none.
- Every route parameter **MUST** have a matching `#[UrlParam]`.

## Inbound webhooks

- Webhook routes **MUST** live in their own route file loaded via
  `loadRoutesFrom()`, behind a signature-verification middleware, CSRF-excepted in
  `bootstrap/app.php`, and **MUST NOT** sit behind user auth middleware.
- Webhook processing **MUST** be queued and **MUST** be idempotent with tracking:
  check an idempotency key against a tracking record and no-op on repeats BEFORE any
  domain work; then record the outcome (`markProcessed()` / `markFailed($error)`),
  with the domain work wrapped so the tracking record always settles.
- Webhook jobs **MUST** declare explicit `$tries` and `$backoff`.
