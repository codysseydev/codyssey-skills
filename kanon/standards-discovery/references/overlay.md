# The project overlay

The overlay is `.ai/kanon.yml` plus prose rule files in `.ai/rules/project/`. No file, or a file with no `mode:` key, means canon-first. This skill writes only `mode: project-first`, and the checker refuses `canon-first`. The schema is `kanon-yml.schema.json` in this folder. `scripts/check-overlay.py` enforces it.

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
  - id: TEST-003
    effect: change
    rule: .ai/rules/project/testing.md
    evidence:
      - CLAUDE.md:7
```

## Naming a Kanon rule

One entry names one Kanon rule by its catalog ID, for example `ORCH-011` or `TEST-003`. The ID must exist in `kanon/catalog/<family>.json`. Two entries for the same ID fail.

A family without a catalog file has no IDs, so its rules cannot be named yet. The checker says which family it is.

## Effects

- `adopt`: the project already does what the rule says. No `rule`.
- `change`: the project does something else for the same concern. It needs `rule`, a path under `.ai/rules/project/` that exists in the work folder.
- `off`: the project does not follow the rule and has no replacement. No `rule`.

A convention the Kanon has no rule for is not an overlay entry. It gets a `project-only` row in the report. When the code shows it and nothing writes it down, put it in a prose rule file.

## Evidence

`evidence` lists one or more `path:line` or `path:line-line` items in the client repo. Each must point at a non-blank line at `Read at` and must also appear in the citations of the entry's row in the report. A path may hold spaces, so quote the YAML value then. A path holds no `:` and no backtick.

## Quoting

The file is read by a strict subset parser, and by other YAML readers in the client's tools. The subset gives every reader the same values.

- `mode:` and `overlay:` sit at column 0, `mode:` once. `overlay:` has at least one item: YAML readers take a bare `overlay:` as null, not as an empty list. Items are `  - key: value`, keys `    key: value`, list items `      - value`. Spaces only, no tabs. Full-line `#` comments are fine.
- A value is a plain word with no spaces, no `: ` and no ` #`, or a single-quoted string (`''` for a quote, backslashes literal), or a double-quoted string whose only escapes are `\"` and `\\`. Other escapes differ between YAML versions, so use a single-quoted string.
- Lines end with `\n` (or `\r\n`). U+0085, U+2028, U+2029 and a lone carriage return are refused anywhere, comments included: some YAML readers break lines on them and others do not.
- Quote `off`, `on`, `yes`, `no`, `true`, `false`, `y`, `n`, `null` and `~`. Some YAML readers turn a plain `off` into a boolean. The parser stops on the plain form and names the line.
- Quote anything with a space, a colon followed by a space, or a hash after a space.

## Prose rule files

`.ai/rules/project/<topic>.md`, with `paths:` frontmatter that lists at least one glob. Each `change` entry's `rule` is one of these files.

```markdown
---
paths:
  - "tests/**"
---

# Testing (project rules)

- Test method names **MUST** start with `test_` and use snake_case. Source: `CLAUDE.md:7`. Changes TEST-003, the Kanon's `it_` prefix rule.
```

State the rule, name the source line, and name the Kanon rule ID it changes when there is one.
