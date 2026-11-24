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
---

# Cloudflare Overlay: OpenNext on Workers

Rules that hold only when the app deploys to Cloudflare Workers through OpenNext. The
overlay loads when `@opennextjs/cloudflare` is a dependency or `wrangler.jsonc` exists.
Every source rule numbered I lives here, including the two that hold on any host. Each
entry carries a `Tags:` line, `OpenNext` or `Workers`, so another deploy overlay touches
only the tagged rules. The overlay adds to the core rules and never replaces them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.
