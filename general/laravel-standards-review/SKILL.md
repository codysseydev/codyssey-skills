---
name: laravel-standards-review
description: >-
  Review a Laravel branch, PR or diff for convention and maintainability adherence. It first
  discovers the project's own standards (CLAUDE.md or AGENTS.md, docs/, pint.json, PHPStan or
  Larastan config, and the patterns sibling files follow) and treats them as authoritative,
  falling back to general Laravel norms only where the project is silent. Use when the user
  asks "does this follow our conventions?", "review this PR against our standards", "is this
  idiomatic Laravel?", "is this maintainable?" or "check my branch before I open the PR".
  Not for bug hunting (use /code-review), security audits, performance profiling, writing
  tests, or formatting (Pint).
---

# Laravel Standards Review

Audit Laravel changes for **convention adherence and long-term maintainability**, in any
Laravel repository. The hard problem a general reviewer must solve is *not* knowing the
rules. It is not **inventing** them. A reviewer that imposes its own opinions ("you should
use FormRequests", "use Actions") on a team that deliberately does otherwise is noise. So
this skill discovers what THIS project actually does first, treats that as the law, and
only reaches for generic Laravel norms where the project is silent.

What makes it a *maintainability* review rather than a bug review: it targets the code that
**works, passes, and still rots the codebase**: a handler that grows logic the rest of the
app keeps in models, a second way to make an HTTP call, a migration that can't be reversed,
a name that breaks the suffix every sibling carries. The generic `/code-review` skill is
tuned for bugs and applies a confidence filter that drops subtle structural findings. This
skill does the opposite within its lane: it surfaces every genuine, *cited* structural
deviation, including low-severity ones, because those are exactly what a bug-focused pass
misses, and exactly what compounds into unmaintainable code.

## Three tiers of authority (every finding names one)

A finding is only as credible as the source it can cite. In strength order:

1. `[project-doc]`: a documented rule (CLAUDE.md, docs/, ADRs, tooling config). Breaking a
   written rule is the highest-severity class: the team decided, then diverged.
2. `[established-pattern: <file>]`: undocumented but consistent across sibling files. This
   is the **maintenance signal**: divergence here is a second way of doing one thing, which
   every future reader must learn. Must cite the sibling that proves the pattern.
3. `[laravel-baseline]`: a generic Laravel/PHP norm, used **only** where the project is
   silent *and* follows it elsewhere. Lowest strength; stay conservative so the review never
   becomes opinion-noise.

The no-confidence-filter mandate binds tiers 1 and 2: do not drop a real, cited deviation
just because it is low-severity or "only structural." It does **not** license tier-3
opinions: a baseline idiom with no doc and no sibling backing is not a finding.

## Why discover first

See `references/discovery.md`. Without it, the review degrades into generic nagging. With
it, every finding cites a tier and respects the house style.

## Why fan out

The concern set is too large for one pass to hold with equal attention. A single reviewer
skims and anchors on whatever it noticed first. Splitting into families and giving each its
own reviewer means every family gets full attention, and each reviewer is handed its
reference file *verbatim* so it checks the actual concern rather than a half-remembered
paraphrase. This is the structure that, in practice, catches the drift a generic review
filters out.

## Phase 0: Discover the project's conventions (always first)

Build the **conventions profile** per `references/discovery.md`: documented rules, tooling
config, and established patterns from 2 to 3 sibling files near the diff. Output a dozen
lines; hand the same profile to every auditor. When a version-specific convention is
unclear, use the Laravel Boost `search-docs` MCP tool (if installed) for the installed package versions
rather than guessing.

## Phase 1: Scope the diff

```bash
git merge-base HEAD origin/main   # find base; try origin/main, then main, then the PR base
git diff --name-only <base>...HEAD
```

If the user names a PR (`gh pr diff <n>`) or another base, use it. Limit to PHP source plus
config/migrations/tests. Empty or docs-only diff → say so and stop.

## Phase 2: Fan out auditors

Spawn parallel `general-purpose` subagents (single message, multiple Agent calls). Give
each: the **conventions profile**, the relevant changed files (route by the path heuristics
below; when unsure, hand it the whole list, since an auditor that reads an irrelevant file just
reports it clean), its **reference file read verbatim**, and the **auditor contract** below. If subagents are unavailable, run the six checks yourself, one reference file at a time.

| Auditor | Reference file | Mostly covers |
|---|---|---|
| Architecture & layering | `references/architecture-layering.md` | where logic lives, thin controllers, module/boundary coupling & decoupling remedy, capability placement, third-party isolation / anti-corruption, cohesion, pattern consistency, DI wiring |
| Controllers, validation & HTTP | `references/controllers-validation-http.md` | validation style, authorization (authorize from principal, IDOR, authn-vs-authz), response type/status/envelope, resources, controller shape, routing/middleware, inbound webhooks (signature/idempotency) |
| Eloquent & database | `references/eloquent-database.md` | N+1/eager loading, query-in-loop, raw `DB::`, mass-assignment consistency, casts, migration reversibility & safety, caching correctness (no per-user shared cache), schema naming, no-FQCN-in-DB |
| Naming, types & idiom | `references/naming-types-idiom.md` | suffixes, event tense, ubiquitous language, strict types, typed signatures, enums, `env()` outside config, helpers-vs-injection, DTOs-over-arrays, events-carry-ids-not-models, comments |
| Consistency & drift | `references/consistency-drift.md` | two-ways-to-do-one-thing, copy-paste divergence, duplication, single-source-of-truth (DRY of knowledge), dead/orphaned code, leftover scaffolding (`dd()`/TODO), half-applied refactors, config/constant drift, swallowed exceptions |
| Tests | `references/tests.md` | coverage of the change incl. failure/auth/edge paths, Pest-vs-PHPUnit consistency, behaviour-over-implementation assertions, faked side effects, factories, descriptive names, test maintainability/determinism |

## Auditor contract (give to every subagent verbatim)

```
You are reviewing Laravel changes against ONE concern, for long-term maintainability,
using the supplied conventions profile + your reference file (read it verbatim).

THE PROJECT'S OWN CONVENTIONS WIN. Cite a tier for every finding:
  [project-doc]            - a documented rule (CLAUDE.md/docs/tooling)
  [established-pattern: F] - undocumented but consistent in sibling file(s); cite F
  [laravel-baseline]       - a generic norm, ONLY where the project is silent AND
                             follows it elsewhere (confirm from a sibling first)

For each finding:
  `path:line` - [tier: source] - one sentence why it deviates - concrete fix -
  severity (high | med | low)

Rules of engagement:
- No tier, no finding. If you can't name a doc, a sibling, or a confirmed baseline
  norm AND the exact line, don't report it.
- Do NOT drop a real, cited deviation just because it is low-severity or "only
  structural" - that drift is the whole point of this review.
- But do NOT impose tier-3 opinions: a baseline idiom with no doc and no sibling
  backing is not a finding. Never flag a team for a deliberate, consistent choice.
- Skip anything Pint or PHPStan/larastan already catch (formatting, obvious type
  errors) - those run in CI; don't duplicate them.
- Stay in your lane: report convention/maintainability deviations, not correctness
  bugs, and not pre-existing drift on lines this diff didn't touch.
- Severity: high = breaks a documented isolation/security/data rule, or a near-
  universal safety norm (missing authz, destructive/irreversible migration, N+1 under
  preventLazyLoading); med = a clear deviation with limited blast radius; low = a real
  but minor structural deviation.
- A tier-1 violation outranks a tier-2 deviation, which outranks a tier-3 idiom.
- If your assigned files are clean, say so in one line.
Return a concise prioritized list, nothing else.
```

## Phase 3: Synthesize

Dedupe (the same line may surface in two families), order by severity, group by file. Keep
the tier label on every finding. It tells the reader which are "you broke your own rule"
(act on these), which are "this diverges from your codebase" (the maintenance debt), and
which are "an idiom worth considering" (optional). Do not add a confidence filter: if an
auditor cited a tier and a line, it stays. If you genuinely doubt one, keep it marked
"(verify)" with a one-line reason rather than silently dropping it.

End with a one-line verdict and the conventions profile you reviewed against, so the basis
is auditable.

### Report format

```
## Standards review - <base>...HEAD (<n> files)

_Profile: <one-line summary of documented rules, tooling and patterns the review was judged against>_

### High
- `path:line` - [tier: source] - <why>. Fix: <fix>.

### Medium
- `path:line` - [tier: source] - <why>. Fix: <fix>.

### Low
- `path:line` - [tier: source] - <why>. Fix: <fix>.

### Clean
<families/areas with no findings>

**Verdict:** <N findings (X high / Y med / Z low)> | <clean>
```

Read-only by default: report, don't edit, unless asked. To post on a PR, format the same
content and use `gh pr comment <n> --body-file <file>`.

## Notes

- Pairs with `/code-review`: run that for bugs, this for "does it follow our rules and stay
  maintainable".
- The references condense generic Laravel norms per family; the project's own docs and
  patterns always outrank them. If you learn a project-specific rule worth reusing, it
  belongs in that project's own reviewer skill, not here.
- If the repo has its OWN dedicated standards/review skill (e.g. a `*-reviewer` project
  skill that encodes that codebase's rules), prefer it, since it will be more precise than this
  general reviewer. This skill is the fallback for repos without one.
