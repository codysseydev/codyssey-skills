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
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.
