# What to read, and what to note

Read only the paths in `inventory.json`: the `sources` lists, the `siblings` lists, `commit_subjects` and `branches`. Never read a path in `ignored`, and never a path the inventory does not list. For each convention, note `file:line` and a short quote while you read, so the report needs no second pass.

## Instructions

`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/**`, `.cursorrules`, `.github/copilot-instructions.md`. These are rules the team wrote for tools. Each rule sentence is a convention with source `written down`. Note rules that contradict the Kanon first, since those are `change` or `off`.

## Docs

README, CONTRIBUTING, `docs/` and ADRs. Look for naming, layering, testing, review and release rules. An accepted ADR is a decision. A superseded one is not.

## Linters and analysers

PHP CS Fixer, Pint, PHP_CodeSniffer, PHPStan, Deptrac, PHPArkitect, Rector, ESLint. Note the rule set or preset, strictness settings (`declare_strict_types`, `final_class`, the PHPStan level), architecture rules and the paths they cover. Source `configured`.

## CI and scripts

GitHub Actions, GitLab CI, Bitbucket Pipelines, Jenkins, `composer.json` and `package.json` scripts. Note which checks gate a merge, in what order, and the exact commands. Source `configured`.

## PR templates

Note required sections and checklists.

## Git history

`commit_subjects` shows the commit style (Conventional Commits, ticket keys, tense). `branches` shows the branch naming. Cite as `commit:<sha>` and `branch:<name>`. Source `pattern in code`.

## Sibling files

`siblings` groups PHP classes by kind (`Controller`, `Handler`, `Test`, and so on), up to three per kind. Read them for the pattern, and note a convention only when the siblings agree. Questions to ask of each kind:

- Controllers: invokable or resourceful, thin or fat.
- Validation: form requests or inline rules.
- Models: `$fillable`, `$guarded` or `unguard()`, `casts()` or `$casts`, return types on relations, where logic lives.
- Layout: default `app/Http` and `app/Models`, or modules, `src/`, actions, services. Where business logic lives and whether modules import each other.
- Dependency injection: constructor injection and contracts, or facades and helpers.
- Enums: backed or not, case naming.
- Types: `declare(strict_types=1)`, typed signatures, `final readonly`.
- Naming: suffixes for jobs, events, listeners and DTOs.
- Tests: framework, base class, database reset strategy, factories, what they assert.

## When sources disagree

A written rule that the code does not follow is a finding. Report the written rule as the convention, cite the code that departs from it, and say so in the Convention column.
