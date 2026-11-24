# The project overlay

The overlay is `.ai/kanon.yml` plus prose rule files in `.ai/rules/project/`. No file, or a file with no `mode:` key, means canon-first. This skill writes only `mode: project-first`. The schema is `kanon-yml.schema.json` in this folder. `scripts/check-overlay.py` enforces it.

```yaml
# Written by standards-discovery. The standards report names the commit it read.
mode: project-first
overlay:
  - id: ORCH-011
    effect: adopt
    evidence:
      - .php-cs-fixer.dist.php:9
  - id: ORCH-008
    effect: 'off'
    evidence:
      - CLAUDE.md:12
  - file: kanon/laravel-kanon/references/testing.md
    sentence: 'Every test that boots the application **MUST** extend the project''s `Tests\TestCase`.'
    effect: change
    rule: .ai/rules/project/testing.md
    evidence:
      - CLAUDE.md:7
```

## Naming a Kanon rule

One entry names one Kanon rule. Two entries for the same rule fail.

- By ID, when the rule's family has a file in `kanon/catalog/`. Today that is `orchestration-di` (`ORCH-001` to `ORCH-037`). The ID must exist in the catalog.
- By `file` and `sentence`, when the family has no catalog file. `file` is a `reference` path listed in `kanon/catalog/families.json`. `sentence` is one whole rule sentence copied from that file.

A family that has a catalog file takes IDs only. A sentence entry for it fails, and the message names the ID to use. Family catalogs grow over time, so an overlay written today can need a one-line edit later.

Rules for `sentence`:

- Join the lines the reference file wraps. The checker collapses whitespace, so one space between words is enough.
- Keep the bold markers. The sentence holds a bold keyword (`**MUST**`, `**MUST NOT**`, `**SHOULD**`, `**SHOULD NOT**`, `**MAY**`).
- It ends with `.`, `:` or `;`.
- It starts at a sentence start: a list item, or after `. `, `; ` or `: `. A fragment from the middle of a sentence fails.
- It matches exactly once in the file.

## Effects

- `adopt`: the project already does what the rule says. No `rule`.
- `change`: the project does something else for the same concern. It needs `rule`, a path under `.ai/rules/project/` that exists in the work folder.
- `off`: the project does not follow the rule and has no replacement. No `rule`.

A convention the Kanon has no rule for is not an overlay entry. It gets a `project-only` row in the report. When the code shows it and nothing writes it down, put it in a prose rule file.

## Evidence

`evidence` lists one or more `path:line` or `path:line-line` items in the client repo. Each must point at a non-blank line at `Read at` and must also appear in the citations of the entry's row in the report. A path may hold spaces, so quote the YAML value then. A path holds no `:` and no backtick.

## Quoting

The file is read by a strict subset parser, and by other YAML readers in the client's tools. The subset gives every reader the same values.

- `mode:` and `overlay:` sit at column 0, `mode:` once. Items are `  - key: value`, keys `    key: value`, list items `      - value`. Spaces only, no tabs. Full-line `#` comments are fine.
- A value is a plain word with no spaces, no `: ` and no ` #`, or a single-quoted string (`''` for a quote, backslashes literal), or a JSON double-quoted string.
- Quote `off`, `on`, `yes`, `no`, `true`, `false`, `y`, `n`, `null` and `~`. Some YAML readers turn a plain `off` into a boolean. The parser stops on the plain form and names the line.
- Quote anything with a space, a colon followed by a space, or a hash after a space. Sentences are always quoted.

## Prose rule files

`.ai/rules/project/<topic>.md`, with `paths:` frontmatter that lists at least one glob. Each `change` entry's `rule` is one of these files.

```markdown
---
paths:
  - "tests/**"
---

# Testing (project rules)

- Test method names **MUST** start with `test_` and use snake_case. Source: `CLAUDE.md:7`. Changes the Kanon's `it_` prefix rule in `testing.md`.
```

State the rule, name the source line, and name the Kanon rule it changes when there is one.
