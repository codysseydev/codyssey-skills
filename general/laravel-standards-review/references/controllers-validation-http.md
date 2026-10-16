# Controllers, validation & HTTP

What this auditor protects: that requests are validated, authorized, and answered the
**same way across the codebase**. Inconsistent validation and response shapes are a slow
tax: every endpoint that drifts is one more shape a client, a test, and the next
developer have to special-case.

Authority order: `[project-doc]` > `[established-pattern]` (cite the sibling controller /
request) > `[laravel-baseline]`. Match the project's style; do not import your own.

## Validation

- **Where**: if controllers in this area validate via FormRequest classes, flag a new
  controller doing inline `$request->validate([...])` (and vice-versa; match what's
  there). `[established-pattern]`, **med**.
- **Rule style**: array rules (`['required', 'string']`) vs string-pipe
  (`'required|string'`); flag the one that disagrees with the prevailing sibling style.
  **low.**
- **Completeness**: a FormRequest missing `authorize()` (silently defaulting to allow-all)
  or `rules()` where peers define both. **med:** a missing `authorize()` is a latent
  authorization hole, not just a style miss.
- **No business logic in requests**: a FormRequest doing domain work beyond
  validation/authorization when siblings keep it thin. **low.**

## Authorization

- A state-changing or data-exposing action with **no** authorization check (policy, gate,
  `can` middleware, or an explicit ownership lookup) where sibling actions guard themselves.
  **high:** missing authz is the most expensive omission to discover in production. Cite
  the sibling that establishes the guard pattern.
- **Authorize from the authenticated principal, never from request input**: flag an action
  that decides access by trusting a `user_id`/`role`/`team_id` taken from the request body
  or query instead of the authenticated user. This is near-universal, so flag it even when
  undocumented; it is the classic privilege-escalation hole. **high.**
- **Scope owned-resource lookups to the actor (prevent IDOR)**: a handler that loads a
  resource by id and acts on it *without* confirming the authenticated user owns/may access
  it, where siblings scope the query to the actor or assert ownership on lookup. Returning
  another user's record by guessable id is an access-control break, not a bug. **high.**
- **Authentication vs authorization are distinct**: authentication is enforced by route
  middleware (`auth:sanctum`/`auth`), authorization by a policy/gate/ownership check. A
  FormRequest `authorize()` returning `true` is **fine** when route middleware authenticates
  and a policy authorizes. Do not flag it on that basis alone; flag the *absence* of any
  authorization layer, not the thin `authorize()`.
- Authorization done a different way than peers (inline `if (auth()->user()->id !== …)`
  scattered where the project has policies) is drift: flag it, **low/med**.

## Responses

- **Type consistency**: API actions return the project's response type (an API Resource,
  a `JsonResponse`, a DTO), not a bare array/model when siblings wrap them. Flag the
  outlier. `[established-pattern]`, **med**.
- **Status codes**: explicit, correct codes where the project sets them (201 on create,
  204 on delete-with-no-body, 200 otherwise). Flag a create returning 200 where peers
  return 201, or a bare `return $resource;` that loses an intended status. **low/med.**
- **Envelope / casing**: response key casing (snake_case vs camelCase), envelope wrapping,
  and date format (ISO-8601 vs other) should match siblings. A new endpoint that breaks the
  established serialization shape is a client-facing maintenance break. **med.**
- **Resources over manual mapping**: if the project transforms via API Resources, flag a
  controller hand-rolling `['id' => $m->id, …]` arrays, and flag a nested collection mapped
  inline (`->map(fn …)`) where a dedicated `Resource::collection(...)` is the pattern.
  `[established-pattern]`, **low/med**.

## Controller shape

- **Single-action vs resourceful**: match the project. Flag a multi-action controller in an
  invokable-controller codebase (or the reverse). **med.**
- **No try/catch for domain errors** *if* the project renders exceptions centrally (custom
  exceptions with `render()`, a handler mapping). Flag controller try/catch that duplicates
  centralized rendering. `[established-pattern]`, **low**.
- **No fat constructors / empty constructors**: match the prevailing constructor style;
  flag an empty `__construct()` body. **low.**

## Routing & middleware

- Route definitions live where the project keeps them (a route file, not inline); route
  names follow the established hierarchy/prefix; new protected routes sit behind the same
  auth/throttle/verified middleware groups as their peers. Flag a public route added to an
  authenticated group's neighbourhood without the guard, or a name that breaks the prefix
  convention. **med** for a missing guard, **low** for a naming break.
- Middleware registered where the project registers it (e.g. `bootstrap/app.php` on
  Laravel 11+), not re-introduced in a kernel/route file against the convention. **low.**

## Inbound webhooks

If the diff adds or changes a webhook receiver, check the handling norms any webhook
endpoint needs. These are near-universal for inbound webhooks; flag against the project's
existing webhook handler when one exists, else as baseline.

- **Signature verification**: the route runs a signature/verification middleware, not the
  session/`auth:sanctum` guard (the sender has no session). Flag a webhook route placed
  behind the normal auth guard or with no signature check where a sibling webhook verifies.
  **high:** an unverified webhook is a forgeable write into your system.
- **CSRF exemption**: webhook POST routes are excluded from CSRF, the way the project
  excepts them. Flag a webhook route left under CSRF (it will reject every real delivery).
  **med.**
- **Idempotent processing**: the handler no-ops on a repeated delivery (dedupe on the
  provider's event id / idempotency key) before mutating state. Flag a handler that mutates
  domain state with no replay guard where peers dedupe. **high:** providers retry, and
  double-processing a payment/state event is a data-integrity break.
- **Explicit retry/backoff** on the processing job where the project sets them, rather than
  relying on an implicit default for an endpoint that must not silently drop events. **low.**
