---
paths:
  - 'wrangler.jsonc'
  - 'worker.js'
  - 'open-next.config.ts'
  - 'next.config.*'
  - 'public/_headers'
  - 'src/lib/cloudflare/**'
  - 'scripts/**'
  - '.github/**'
  - 'package.json'
  - 'app/**'
  - 'src/lib/env.ts'
  - 'src/types/**'
  - 'src/features/**/types/**'
  - '**/*.test.ts'
  - '**/*.test.tsx'
---

# Cloudflare Overlay: OpenNext on Workers

Rules for deploying to Cloudflare Workers through OpenNext, plus the two source rules
numbered I that hold on any host, kept here by owner decision. The overlay loads when
`@opennextjs/cloudflare` is a dependency or `wrangler.jsonc` exists. Each Cloudflare entry
carries a `Tags:` line, `OpenNext` or `Workers`, so another deploy overlay touches only the
tagged rules. The two host-neutral entries carry no `Tags:` line, and no other deploy
overlay replaces them. The overlay adds to the core rules and never replaces them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Rules

- **CF-001. `worker.js` exports no class, and `wrangler.jsonc` declares no Durable Object binding.** An exported class is how a Worker exposes a Durable Object. The Workers config also keeps no migration class that is never deleted. **MUST.**
  - Why: Cloudflare creates no version URLs for a Worker that implements a Durable Object, and skew protection, which keeps a request on the build that served its page, needs them.
  - Check: the overlay's Durable Object check (see "Checks the template may ship" in `index.md`).
  - From: I1
  - Tags: Workers
- **CF-002. Env blocks repeat their bindings, and shipped migrations are never edited.** An environment block in `wrangler.jsonc` does not inherit bindings from the top level, so each block lists every binding it needs. A migration that has shipped stays as it is, and a change is a new migration. **SHOULD.**
  - Why: a binding missing from one env block leaves that environment without it, for example a staging deploy with no cache bucket, and an edited migration no longer matches what Cloudflare already applied.
  - From: I3
  - Tags: Workers
- **CF-003. Each concern under `worker.js` lives in `src/lib/cloudflare/<name>.ts` with a test.** Code reaches the Cloudflare context through `getCloudflareContext()`. A read of a private symbol needs a comment naming why the public call cannot be used, and a test. **SHOULD.**
  - Why: a concern in its own typed module is tested without the Worker runtime, for example a response-header rewrite tested against a mocked context.
  - From: I4
  - Tags: OpenNext
- **CF-004. `compatibility_flags` includes `global_fetch_strictly_public`.** **SHOULD.**
  - Why: skew protection serves an older build's request with a `fetch()` to that version's preview URL, and Workers refuses a `fetch()` to a Worker on the same account unless this flag sends it over the public internet.
  - From: I5
  - Tags: Workers
- **CF-005. `WORKER_SELF_REFERENCE` has no `entrypoint` and carries a props value.** The service binding that points the Worker at itself names no entrypoint, and it carries a props value so revalidation requests sent through it get their own cache key. **SHOULD.**
  - Why: the OpenNext deploy starts a local runtime from `wrangler.jsonc` without the Worker's code, which fails on a named entrypoint and breaks the deploy and the skew mapping, and without its own cache key a revalidation request is answered from a visitor's cached copy of the page.
  - From: I6
  - Tags: OpenNext
- **CF-006. The ISR queue is never OpenNext's default `dummy` queue.** ISR is Next's background page regeneration, and `open-next.config.ts` sets a real queue for it. **SHOULD.**
  - Why: the dummy queue fails every regeneration without an error page, so a stale prerendered page, such as a product list, keeps what the build produced until the next deploy.
  - From: I7
  - Tags: OpenNext
- **CF-007. The `immutable` cache header on `/_next/static` is set only in production.** The header entry for `/_next/static` sits only in the production block of `next.config`. **SHOULD.**
  - Why: in development a chunk keeps its URL while its content changes, so an immutable header makes the browser serve a stale chunk after an edit.
  - From: I9
- **CF-008. The client bundle has a size budget, and a size claim carries numbers.** After the build, `scripts/size-budget.ts` compares the largest client chunk under `.next/static/chunks` with a committed baseline, `scripts/size-budget.baseline.json`. The check fails when the chunk grows more than 5% over the baseline, or when the baseline file is missing. An intended increase rewrites the baseline in the same pull request. The deploy script also runs this check (CF-024). The per-route first-load size is recorded in `docs/guides/performance.md` and measured again with each Next or large dependency upgrade. A pull request that adds a dependency to server code, or claims a client size saving, states the size before and after in its description. **MUST.**
  - Why: a bundle grows one dependency at a time and no single review notices, so a committed baseline makes each step visible and turns an increase into a decision.
  - Check: the size budget (see "Checks the template may ship" in `index.md`).
  - From: I10 (core part)
- **CF-009. A change to the Worker or its build is validated by an OpenNext build before merge.** A CI job runs when a pull request touches `worker.js`, `wrangler.jsonc`, `open-next.config.ts`, `next.config`, `src/lib/cloudflare/`, `scripts/` or a dependency file. It runs `opennextjs-cloudflare build` and `wrangler deploy --dry-run`. **SHOULD.**
  - Why: `next build` alone passes a config that fails the OpenNext build, so without this job the break shows only when the deploy after merge fails.
  - From: I11
  - Tags: OpenNext

## Clauses

- **CF-010. Modules loaded outside the Next bundler do not import `server-only`.** This adds to STRUCT-013: modules under `src/lib/cloudflare/`, and any module that `worker.js`, `open-next.config.ts` or `instrumentation.ts` imports, do not start with `import 'server-only'`. **SHOULD.**
  - Why: those files load the module outside the Next bundler, where the `server-only` import throws, for example the Worker entry importing a header helper.
  - From: S11 (Cloudflare clause)
  - Tags: OpenNext
- **CF-011. A page's API fetch skips the data cache behind the edge cache.** This adds to DATA-001: the server fetch helper fetches with `cache: 'no-store'`, through one constant, `EDGE_CACHED_ROUTE`, so the edge cache is the only cache, and `revalidate` defaults to `86400`, one day. **MUST.**
  - Why: two caches with their own lifetimes would rebuild a page from stale API data, for example a changed price that the edge picks up only after the data cache also expires.
  - From: D1 (Cloudflare clause)
  - Tags: OpenNext
- **CF-012. OpenNext computes the edge lifetime of a prerendered page.** This adds the OpenNext reason to DATA-008: OpenNext sets the edge `s-maxage` of a prerendered page from its `revalidate`. **MUST.**
  - Why: a hand-written `Cache-Control` header replaces the `s-maxage` OpenNext computes, so the edge stops following `revalidate`, for example a page set to refresh daily that the edge keeps for a week.
  - From: D8 (Cloudflare clause)
  - Tags: OpenNext
- **CF-013. A same-origin edge endpoint may use `fetch`.** This adds to DATA-039: an endpoint that the Worker serves itself, outside the Next app, may be called with `fetch` instead of `apiClient`. **SHOULD.**
  - Why: the endpoint is not the backend API, so the API client's base URL and credentials do not apply to it, for example a Worker route that reports the deployed version.
  - From: D27 (Cloudflare clause)
  - Tags: Workers
- **CF-014. A non-public environment variable is read inside the request handler.** This adds to DATA-042: OpenNext fills `process.env` per request, so a non-public variable is read inside the request handler, never at module scope. **MUST.**
  - Why: a module-scope read runs before OpenNext fills `process.env` and gets an empty value, for example a server secret read at import time.
  - From: D30 (Cloudflare clause)
  - Tags: OpenNext
- **CF-015. The edge cache is why server code never reads member cookies or headers.** This adds the edge-cache reason to DATA-064: the Workers edge cache is on in `wrangler.jsonc`, which is safe only because no route renders member-specific HTML. **MUST.**
  - Why: with the edge cache on, a page rendered from one member's cookies would be stored and served to every visitor, for example a header that greets the first member by name.
  - From: D57 (Cloudflare clause)
  - Tags: Workers
- **CF-016. The cache window covers the OpenNext incremental cache and the edge cache.** This adds to TYPES-009: on this stack a new API field stays optional until both the OpenNext incremental cache in R2 and the edge cache have turned over. **SHOULD.**
  - Why: a page cached before the backend added the field is served from either cache without it, for example an order page cached the day before a `trackingUrl` field shipped.
  - From: T34 (Cloudflare clause)
  - Tags: OpenNext
- **CF-017. The skew mapping has a sync test.** This adds to TYPES-032: the limits in the skew mapping the deploy builds, `scripts/lib/skewMapping.ts`, are compared in a test with the skew protection settings in `open-next.config.ts`. **MUST.**
  - Why: the two files must agree on how many old versions stay reachable, and a change to one alone breaks skew protection for older pages without an error.
  - Check: the skew-mapping sync check (see "Checks the template may ship" in `index.md`).
  - From: T31 (Cloudflare clause)
  - Tags: OpenNext
- **CF-018. `public/_headers` gives `public/assets/` a one-year immutable lifetime.** This adds to UI-055: the project ships `public/_headers` with a one-year immutable cache lifetime for the files under `public/assets/`, and the file states that a file there is renamed, never replaced. **MUST.**
  - Why: browsers and the edge keep such a file for a year without asking again, so a replaced file with the old name, such as `logo.svg`, keeps serving the old copy.
  - From: U47 (Cloudflare clause)
  - Tags: Workers
- **CF-019. HSTS is set at the edge only.** This adds to ACCESS-011: HSTS is set in the Cloudflare zone settings, and `next.config` sets no `Strict-Transport-Security` header. **MUST.**
  - Why: the edge adds the header to every response, cached ones included, so a second copy from the app could only disagree with it.
  - From: A10 (Cloudflare clause)
  - Tags: Workers
- **CF-021. The deploy build skips git hook install.** This adds to TOOLING-004: the Workers Builds environment in Cloudflare, not the repository, sets the switch that skips hook install in the deploy build. **SHOULD.**
  - Why: the deploy build never commits, so installing git hooks there is wasted work.
  - From: C4 (Cloudflare clause)
  - Tags: Workers
- **CF-022. `worker.js` stays thin JavaScript, and Workers Builds names the deploy script.** This adds to TOOLING-007: `worker.js` stays JavaScript because the Workers runtime loads it as written, and holds glue only, with logic in typed modules under `src/lib/cloudflare/` (CF-003). The Workers Builds commands in the Cloudflare dashboard name the deploy script of CF-023. **SHOULD.**
  - Why: logic in a typed module is linted, type-checked and tested, and the glue file stays small enough to read in one pass.
  - From: C7 (Cloudflare clause)
  - Tags: Workers
- **CF-023. Deploy only through the deploy script, and the deploy fails when the skew mapping cannot be built.** Every deploy runs `scripts/deploy-cloudflare.ts`, and the script stops before it uploads anything when it cannot build the skew mapping (CF-017). **SHOULD.**
  - Why: a deploy without the mapping leaves pages from the previous build unable to reach their own version, so their next request fails.
  - Check: the skew-mapping sync check (see "Checks the template may ship" in `index.md`).
  - Source: The Honest Cost of Two Repos vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/42 - The Honest Cost of Two Repos.md
  - From: I2 (Cloudflare clause)
  - Tags: OpenNext
- **CF-024. The Worker script has a size budget below the Workers limit.** The Worker script stays under a stated gzip budget of 8 MiB, below the 10 MiB limit of the Workers Paid plan. The deploy script runs the size budget of CF-008 after the build and also fails the deploy when the Worker gzip size grows more than 5% over the baseline or passes 8 MiB. **MUST.**
  - Why: a Worker over the platform limit cannot deploy at all, so a budget below the limit gives warning while there is still room to cut.
  - Check: the size budget (see "Checks the template may ship" in `index.md`).
  - From: I10 (Cloudflare clause)
  - Tags: Workers
