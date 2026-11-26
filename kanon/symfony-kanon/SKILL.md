---
name: symfony-kanon
description: >-
  The Kanon's Symfony overlay. Load this BEFORE writing or editing PHP in a Symfony
  app when the user invokes /symfony-kanon, says "symfony kanon", or asks for the
  canon in a Symfony project of their own. It adds Symfony rules on top of the
  framework-agnostic `php-core.md` and `reliability.md` in the `laravel-kanon`
  skill, which must be installed next to it. Do NOT auto-apply this in a codebase
  with established team standards unless the user explicitly asks for the canon
  there. There is no Symfony audit yet: laravel-kanon-audit is Laravel-only.
---

# Symfony Kanon

The Kanon's Symfony overlay. It is deliberately project-agnostic: when invoked, it
overrides the host project's conventions entirely. Do not read the project's
CLAUDE.md, style guides, or sibling files as a rule source; the canon is the only
authority. If following the canon would conflict with something the project does,
follow the canon and tell the user about the conflict.

The overlay is minimal. It does not copy the framework-agnostic rules; it reads them
from the sibling `laravel-kanon` skill and adds the Symfony-specific ones.

## Normative language

Rules use RFC-2119 keywords, and they mean it:

- **MUST / MUST NOT**: absolute. Never violate one, never "adapt" it to the project.
  If a MUST cannot be satisfied (missing package, framework limitation), stop and tell
  the user instead of quietly deviating.
- **SHOULD / SHOULD NOT**: follow unless there is a concrete, stated reason not to.
  Every deviation gets one sentence of justification in your summary to the user.
- **MAY**: permitted, use judgment.

## How to apply while writing

1. Identify what you are about to create or edit, and read the matching files BEFORE
   writing. The `laravel-kanon` skill sits next to this one:
   `.claude/skills/laravel-kanon/references/` in a project install,
   `~/.claude/skills/laravel-kanon/references/` in a global install.
2. Follow MUST/MUST NOT rules absolutely; note SHOULD deviations with justification.
3. When you finish, list by ID (for example `SYM-001`) any canon rules you could not satisfy and why.

Each rule in the reference files starts with its ID, a stable code such as `SYM-001`.

| You are writing | Read |
|---|---|
| Any Symfony change | `php-core.md` (from the `laravel-kanon` skill's `references/`) |
| Batch imports, bulk jobs | `reliability.md` (from the `laravel-kanon` skill's `references/`) |
| Services and their wiring | this skill's `references/symfony.md`, section Dependency injection |
| Commands, queries, handlers, events | this skill's `references/symfony.md`, sections Writes and Messenger slices |
| Controllers | this skill's `references/symfony.md`, section Controllers |
| Request and response DTOs, API endpoints | this skill's `references/symfony.md`, section HTTP API |
| Voters and access checks | this skill's `references/symfony.md`, section Authorization |
| Entities, value objects, domain exceptions | this skill's `references/symfony.md`, section Domain model |
| Repositories, mappings, migrations | this skill's `references/symfony.md`, section Doctrine persistence |
| HTTP clients, mail, webhooks, outside services | this skill's `references/symfony.md`, section Integrations |
| Console commands, schedules, workers | this skill's `references/symfony.md`, section Console and scheduling |
| Large reads and batch queries | this skill's `references/symfony.md`, section Performance |
| Module boundaries | this skill's `references/symfony.md`, section Module isolation |
| Tests | this skill's `references/symfony.md`, section Testing |

The Laravel-specific reference files in `laravel-kanon` (Eloquent, Filament, Form
Requests, and so on) do not apply to a Symfony app.

## Status

- There is no Symfony audit yet; `laravel-kanon-audit` is Laravel-only.
- The canon covers standards, not correctness: keep using normal judgment (and
  /code-review) for bugs, security, and performance.
