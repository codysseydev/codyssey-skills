# Authorization & Resource Ownership

Applies to: owned-resource handlers, capability-gated routes, guards, Form Request
`authorize()`. Authorization failures are critical; every MUST here is a security
rule.

## Authorization comes from the principal

- Authorization **MUST** derive from the authenticated principal, never from request
  input. A handler that trusts a `user_id`, `team_id`, or `role` from the request
  body is broken.
- Every endpoint touching owned data **MUST** scope its lookup by the actor (IDOR
  protection: stopping one user from reading another's record by changing an id). "Fetch by id, then check" is not scoping; the gate lives in the
  lookup itself.

## Ownership gates live in model lookups

- An owned-resource handler **MUST** resolve actor plus resource through a model
  method that asserts membership/ownership and throws:
  `Team::findByIdForMemberOrFail($teamId, $userId)` for reads,
  `findByIdForAdminOrFail(...)` or an `*AsAdmin(...)` write method for privileged
  writes. Never `find()` plus a manual check in the handler.
- The gate **MUST** throw a domain exception that renders itself as 403. Controllers
  **MUST NOT** build 403 responses inline.

## Authentication vs authorization split

- Authentication is route middleware (`auth:sanctum`, `verified`). Authorization is
  the domain gate above. A Form Request `authorize()` returning `true` is correct
  under this split; **do not** move ownership checks into Form Requests.
- Every Form Request still **MUST** define `authorize()` explicitly (even when it
  returns `true`) alongside `rules()`.

## Capabilities and guards

- Capability-gated endpoints **MUST** use ability middleware with a typed constant
  (`'abilities:'.PublishingAbility::NAME`), never a string literal.
- Separate application surfaces **MUST** use separate guards; an admin panel
  authenticates through its own guard plus an access check
  (`canAccessPanel()`-style), never the customer app's guard or role enums (see
  `isolation.md`).

## What is NOT a violation

- `authorize(): true` on a Form Request (the split above).
- A query handler for genuinely public, ownerless data.
