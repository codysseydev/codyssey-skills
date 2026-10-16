# Third-Party Integrations

Applies to: payment providers, outbound HTTP, vendor SDKs, external APIs of any
kind.

## Anti-corruption layer

- Every external system **MUST** sit behind a dedicated gateway class owned by the
  integrating module: one class per vendor, exposing domain-language methods and
  returning typed DTOs. Handlers and jobs **MUST NOT** call a vendor SDK, HTTP
  client, or connector inline.
- Vendor vocabulary **MUST NOT** leak past the gateway. The gateway interprets the
  vendor's statuses, codes, and payload shapes into the module's own value objects
  and enums at the boundary; domain code never branches on raw vendor strings.
- The gateway **SHOULD** be fronted by an interface when more than one module
  consumes it or when tests need a fake; the consumer defines that interface (see
  `isolation.md`).

## Connectors

- HTTP integrations **MUST** use one connector class per vendor (Saloon or an
  equivalent single-responsibility client), bound as a singleton in the module's
  service provider, reading its base URL and secrets from config.
- Requests and responses **MUST** be typed: request classes/DTOs in, `final
  readonly` response DTOs out. No associative arrays crossing the gateway boundary.
- Timeouts and retry behavior **MUST** be explicit on the connector, never left to
  client defaults.
- Gateway implementations **MUST** be `final readonly`, depending on the connector
  and contracts.
- A focused capability **SHOULD** get its own narrow contract rather than bloating
  one fat gateway interface that forces implementers and test doubles to stub
  methods they never use.
- Saloon specifics: a Saloon `Request` **MUST NOT** promote a constructor property
  named `$body` (it collides with the `HasJsonBody` trait's own `$body` and
  fatals); the `Request` **MUST** build its own body in `defaultBody()` from
  domain-named properties, never accept a pre-baked `array $payload` and return it.
  Tests fake at the connector with `MockClient` + `MockResponse` via
  `$connector->withMockClient()`.

## Secrets and config

- Credentials **MUST** be read from config (which reads `env()`); `env()` **MUST
  NOT** be called outside config files.
- A config default **SHOULD** point at the real production host, not a stale or
  placeholder URL.

## Runtime behavior

- Calls to external systems **MUST** run in queued jobs, never synchronously inside
  a request-cycle handler (see `orchestration-di.md`).
- Outbound effects triggered by domain changes **MUST** hang off domain events via
  listeners, so the integration can be replayed, retried, or removed without
  touching domain code.
- Inbound traffic from the vendor (webhooks) follows the webhook rules in
  `http-api.md`: signature verification, idempotency with tracking, explicit
  retries.
