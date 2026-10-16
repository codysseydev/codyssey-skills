---
name: laravel-kanon
description: >-
  The Kanon: a fixed, project-agnostic Laravel doctrine for building products that
  last. Load this BEFORE writing or editing PHP in a Laravel app when the user invokes
  /laravel-kanon, says "kanon", "the canon", "canon rules", "build it the long-term
  way", or starts a greenfield Laravel project of their own. It prescribes vertical
  slices, command/query handlers, the orchestrator pattern, module isolation,
  DI-over-facades, strict testing rules, and opinionated stack choices (PHPUnit over
  Pest, no route-model binding, unguarded models) as MUST/MUST NOT requirements that
  deliberately IGNORE the host project's own conventions. Do NOT auto-apply this in a
  codebase with established team standards (e.g. an employer's monorepo) unless the
  user explicitly asks for the canon there. This is the rulebook for WRITING code; to
  AUDIT existing changes against it, use laravel-kanon-audit instead.
---

# The Kanon

A fixed doctrine for building Laravel products for the long term. It is deliberately
project-agnostic: when invoked, it overrides the host project's conventions entirely.
Do not read the project's CLAUDE.md, style guides, or sibling files as a rule source;
the canon is the only authority. If following the canon would conflict with something
the project does, follow the canon and tell the user about the conflict.

## Normative language

Rules use RFC-2119 keywords, and they mean it:

- **MUST / MUST NOT**: absolute. Never violate one, never "adapt" it to the project.
  If a MUST cannot be satisfied (missing package, framework limitation), stop and tell
  the user instead of quietly deviating.
- **SHOULD / SHOULD NOT**: follow unless there is a concrete, stated reason not to.
  Every deviation gets one sentence of justification in your summary to the user.
- **MAY**: permitted, use judgment.

## The pillars

1. Every class is either an orchestrator (coordinates) or an executor (does the work).
   Application-layer classes MUST orchestrate only; business logic MUST live in domain
   model methods; infrastructure MUST live in dedicated service classes.
2. Features ship as vertical slices: one action folder holding the command/query,
   handler, controller, request, resource, route entry, and tests together.
3. Modules are bounded contexts. Nothing crosses a module boundary except contracts
   and domain events. No cross-module imports, relationships, or foreign keys.
4. Dependencies are injected as contracts. Facades and global helpers are banned in
   production classes.
5. Events are past-tense facts carrying ids and scalars, dispatched from the
   application layer, never from models.
6. Authorization comes from the authenticated principal via model lookup gates, never
   from request input.
7. Everything strict: `declare(strict_types=1)`, `final readonly`, explicit types,
   strict Eloquent mode.
8. Every behavioral change ships with tests covering the happy path, failure paths,
   and edge cases. PHPUnit, never Pest.

## How to apply while writing

1. Identify what you are about to create or edit, and read the matching files in
   this skill's `references/` folder (next to this SKILL.md) BEFORE writing. Read `architecture.md` for any new feature regardless.
2. Follow MUST/MUST NOT rules absolutely; note SHOULD deviations with justification.
3. When you finish, list any canon rules you could not satisfy and why.

| You are writing | Read |
|---|---|
| A new feature, module, or slice | `references/architecture.md` plus the rows below that apply |
| Controllers, handlers, jobs, listeners, console commands, services | `references/orchestration-di.md` |
| Models, enums, DTOs, events, exceptions, naming decisions | `references/models-domain.md` |
| Anything touching two modules or two application surfaces | `references/isolation.md` |
| Routes, middleware, form requests, API resources, webhooks | `references/http-api.md` |
| Auth checks, ownership, permissions, guards | `references/authorization.md` |
| Third-party API integrations, SDKs, outbound HTTP | `references/integrations.md` |
| Migrations, factories, config, service providers | `references/persistence.md` |
| Filament resources, pages, actions, widgets | `references/filament.md` |
| Tests | `references/testing.md` |

## Companions

- `laravel-kanon-audit` audits a branch, PR, or diff against these same references.
- The canon covers standards, not correctness: keep using normal judgment (and
  /code-review) for bugs, security, and performance.
