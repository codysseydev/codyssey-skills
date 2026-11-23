# Plan for #33, Kanon catalog: schema, generator and check, proven on orchestration-di

Issue codysseydev/codyssey-skills#33. Base origin/main ad19dcd. Branch `factory/33`. Kind: feature.

## Goal

Every rule in `orchestration-di.md` becomes one JSON catalog entry with an ID, `ORCH-001` to `ORCH-037`. A node script writes the reference file from the catalog. A recipe gate fails when a catalog file breaks the schema, an ID repeats or disappears, or a generated reference was edited by hand. The shape also holds the other 13 reference files, so #34 to #42 each add a data file and change no shared code.

## What the files hold today

Measured on origin/main ad19dcd with a scratchpad parser (not committed).

- 14 reference files: 13 in `kanon/laravel-kanon/references/` and `kanon/symfony-kanon/references/symfony.md`. No IDs, tables, code fences or `###` headings.
- `orchestration-di.md`: a title, one `Applies to:` paragraph, 9 sections, 37 top-level bullets, 13 nested bullets and 70 code spans. The nested bullets are 4 under "An orchestrator **MUST NOT**:" and 9 in the facade-to-contract list. Every top-level bullet has a bold keyword. 10 bullets hold more than one keyword, for example "Queued jobs **MUST** be `final` but **MAY** drop `readonly`". First keyword per bullet: MUST 24, MUST NOT 8, SHOULD 3, MAY 2.
- Shapes the other files add:
  - A second intro paragraph ("Lane boundaries") in 6 files.
  - About 28 bullets with no keyword in 8 files. Some point at another family ("File-shape rules ... are owned by `orchestration-di.md`"), some are plain statements ("Reads return 200."), and 9 sit in the "What is NOT a violation" sections of authorization, filament and isolation.
  - A paragraph inside a section before its bullets, in filament and isolation.
  - A numbered list, "The ten rules", in `testing.md`.
- Round trip. Join each bullet's wrapped lines, then write one line per bullet with a leading ID. With whitespace collapsed and the IDs removed, the result equals the original. The 70 code spans come out in the same order.
- No skill parses the bullet format. `laravel-kanon-audit` inlines each reference file whole (`kanon/laravel-kanon-audit/SKILL.md:73-75`), and the skills find files by name in `laravel-kanon/references/`. A leading ID adds text and breaks nothing.
- `playbooks/scripts/install.mjs` installs only `playbooks/` and five `factory/` skills. Nothing under `kanon/` is installed or asserted on.
- The system `python3` has neither `yaml` nor `jsonschema`, and the repo has no `package.json`. Node 26.13 imports JSON with no package.

## Data shape

`kanon/catalog/families.json`, the prefix table, one row per reference file (14 rows, open decision 2). `family` is the file stem, so `<family>.json` and `<family>.md` share a name:

```json
[
  { "family": "orchestration-di", "prefix": "ORCH", "reference": "kanon/laravel-kanon/references/orchestration-di.md" },
  { "family": "symfony", "prefix": "SYM", "reference": "kanon/symfony-kanon/references/symfony.md" }
]
```

`kanon/catalog/<family>.json`, one per converted family:

```json
{
  "family": "orchestration-di",
  "title": "Orchestration & Dependency Injection",
  "intro": ["Applies to: controllers, command/query handlers, console commands, event listeners, jobs, application services, middleware."],
  "sections": [
    {
      "heading": "The orchestrator pattern",
      "intro": [],
      "list": "bullet",
      "entries": [
        {
          "id": "ORCH-002",
          "family": "orchestration-di",
          "scope": "laravel",
          "keyword": "MUST NOT",
          "rule": "An orchestrator **MUST NOT**:",
          "items": ["contain business logic (calculations, eligibility decisions, status derivation, interpreting vendor data vocabularies);", "..."],
          "status": "active"
        }
      ]
    }
  ]
}
```

A section's `entries` holds rule entries and notes. A note, `{ "note": "..." }`, is a list item that is not a rule: no ID, no keyword. Orchestration has none. Notes, section intros and `"list": "numbered"` exist so the parallel conversions need no schema change (open decision 6).

Rule entry, `$defs/entry` in `kanon/catalog/schema.json`:

- Required: `id`, `family`, `scope`, `keyword`, `rule`, `status`.
- Optional: `items`, `why`, `applies_to`, `allowed_in`, `detect` (`paths`, `signals`), `checks` (each `tool`, `coverage`, `status` draft or verified), `examples` (`bad`, `good`), `sources`, `lane_note`, `duplicate_of`.
- `keyword`: MUST, MUST NOT, SHOULD, SHOULD NOT, MAY. `scope`: language-agnostic, php-core, laravel, symfony, filament, nextjs. `status`: active, candidate, deprecated. `id` matches `^[A-Z]+-[0-9]{3}$`. `additionalProperties: false` on every object.

`rule` is the bullet's text verbatim: wrapped lines joined with one space, bold keywords and code spans kept. `keyword` is the first bold keyword in `rule`, and the check enforces that. No bullet is split or merged, so no rule's wording changes.

## Changes

### `kanon/catalog/` (new)

- `schema.json`, `families.json` and `orchestration-di.json`.
- Orchestration has 37 entries, `ORCH-001` to `ORCH-037` in prose order. Every entry is `scope: laravel` and `status: active`.
- `why` is set only where the bullet states a reason, copied verbatim from it, for example "PHP forbids a `readonly` class extending a non-readonly parent", "Queued jobs and console commands have no logged-in user" and "a serialized model goes stale and drags its loaded state into the queue payload". Implement confirms each one against the substring test below.
- `sources`, `detect`, `checks`, `examples`, `applies_to`, `allowed_in`, `lane_note` and `duplicate_of` are left out. The prose gives no links, and this issue invents no checks or examples. Cross-references such as "see `models-domain.md`" stay in the `rule` text. Orchestration names no http-api rule, so #34 has no `HTTP-xxx` placeholder to replace here.

### `kanon/scripts/catalog.mjs` (new, plain node, no packages)

- `generate [--root <dir>]`. For each `kanon/catalog/<family>.json` it writes the family's `reference` path: `# title`, intro paragraphs, then per section `## heading`, its intro paragraphs, and its entries. A rule entry is ``- `ID` rule`` (``1. `ID` rule`` in a numbered list), each of its `items` is `  - item`, and a note is `- note`. Only `active` entries are written. One line per bullet, no hard wrap, blank lines where the file has them today.
- `check [--root <dir>] [--base <ref>]`. Exits 1 and prints one line per problem, each naming the file and the entry (index and ID):
  - every catalog file validates against `schema.json`;
  - its `family` is a row in `families.json` and matches its file name, and every ID starts with that row's prefix;
  - IDs are unique across all catalog files and all statuses, so a deprecated entry keeps its ID taken;
  - `keyword` equals the first bold keyword in `rule`;
  - for each family with a catalog file, the reference on disk equals what `generate` writes, else the line names the reference, the first differing line number and the ID on that line;
  - with `--base <ref>`, every ID in that ref's catalog files is still present (open decision 5).
- The validator implements the keywords `schema.json` uses (`type`, `required`, `properties`, `additionalProperties`, `enum`, `pattern`, `items`, `minItems`, `oneOf`, `$ref`, `$defs`) and throws on any other keyword, so the schema cannot ask for a rule the validator skips.
- References with no catalog file, 13 of 14 after this issue, are neither written nor checked.

### `kanon/laravel-kanon/references/orchestration-di.md` (regenerated)

- Same path and name. The old text with an ID before each top-level bullet and one line per bullet.

### `kanon/scripts/fixtures/orchestration-di.base.md` (new)

- A copy of the reference at ad19dcd. The word test compares against it, not against the generator's own output.

### `.factory/recipe.yml` and `.factory/playbook.md`

- Two checks: `kanon-catalog-check` runs `node kanon/scripts/catalog.mjs check --base origin/main`, and `kanon-catalog-tests` runs `node --test kanon/scripts/catalog.test.mjs`. `## Checks` in the project file lists both. These are trusted-commands edits, and the PR flags them under Blast Radius.

Unchanged: the three Kanon `SKILL.md` files, `README.md` (#43 documents the workflow) and the other 13 references.

## Tests

`kanon/scripts/catalog.test.mjs`, `node:test`. Each failure test builds a temp root.

| Test | Checks | At base |
|---|---|---|
| repo catalog passes | `check --base origin/main` exits 0 on the branch | fails, no script |
| entry with no `keyword` | exit 1, the line names `orchestration-di.json` and the entry | fails |
| two entries share an ID, in one file and across two files | exit 1, names both entries | fails |
| reference edited by hand | exit 1, names the reference, the line and its ID | fails |
| `keyword` differs from the first bold keyword in `rule` | exit 1 | fails |
| ID with another family's prefix | exit 1 | fails |
| deprecated entry | `generate` leaves it out, and a new entry with its ID fails `check` | fails |
| ID removed since base | exit 1 with `--base` against a temp git repo | fails |
| unknown schema keyword | the validator throws and names it | fails |
| words and code spans (criterion 2) | the generated file with IDs removed and whitespace collapsed equals the fixture collapsed, and the 70 code spans match in order | fails |
| `why` and `sources` (criterion 3) | every `why` is a substring of its entry's `rule`, and no entry has `sources` | fails |
| paths (criterion 4) | each `references/<file>.md` named in the three Kanon `SKILL.md` files exists, and orchestration's `reference` is `kanon/laravel-kanon/references/orchestration-di.md` | fails, no catalog |
| other shapes | a fixture family with a note, a section intro and a numbered list renders as expected | fails |

During implement, a throwaway round trip of all 14 files through the shape (not committed) confirms the schema holds them before #34 to #42 start.

## Gates

The 9 recipe checks plus the 2 new ones, from the worktree root at the head commit, clean tree. Baseline at ad19dcd, all 9 exit 0: pick-up 99 pass, post-merge 23, capture-ui 115, trial-decision 39, test-first 36, bootstrap 3 OK, event-model 4 OK, factory-onboard 28 OK, install 22. No Kanon audit: the repo has no PHP.

## Out of scope

- Other families (#34 to #42), skill changes and a "generated" header line (#43), `kanon-compile` (#47), quick tip sources (#49).
- Moving a rule to the `language-agnostic` or `php-core` layer. Every orchestration entry stays `laravel`, the layer of the skill it lives in.
- Event model and brain vault. Skip, no journey for internal tooling. No boards change.

## Risks

- One line per bullet gives long lines in the raw file. Rendered markdown is the same.
- Line-number citations of `orchestration-di.md`, such as "L42", "L47" and "L50" in the vault note `Ideas/Kanon Rule Catalog.md`, point at other lines after regeneration. They record history, and IDs replace them.
- `--base origin/main` needs that ref. On a clone without it, the check fails and says so instead of skipping.

## Open decisions

The plan implements option A of each.

1. Entry granularity. It fixes the numbering for good.
   - **A. One entry per top-level bullet, nested lines in `items` (recommended).** 37 IDs. Nothing is split or merged, so no wording changes. Cost: 10 entries hold more than one keyword, `keyword` holds the first, and a finding cites the entry, not the clause.
   - **B. Nested lines get their own IDs.** 50 IDs. The four orchestrator MUST NOT items and the nine facade mappings become citable one by one. Only one nested line has a keyword of its own, so the other 12 inherit the parent's, and the schema has to model that.
   - **C. One entry per keyword.** Splits the 10 mixed bullets. That changes how rules read, which is the owner's call, so the run does not pick it.
2. Prefix table. From the vault note and the issues: ORCH, HTTP (http-api), AUTH (authorization), MD (models-domain), TEST (testing), PERF (performance), SYM (symfony), INT (integrations). New: ARCH (architecture), FIL (filament), ISO (isolation), PERS (persistence), PHP (php-core), REL (reliability). Three digits, `ORCH-001`.
3. Catalog format and parser.
   - **A. JSON read by plain node, with an in-repo validator for the schema keywords used (recommended).** No install, and the recipe `setup` stays `[]`. Cost: multi-line code in `examples` is an escaped string, harder to edit by hand than YAML.
   - **B. YAML with a vendored single-file parser (for example js-yaml, MIT) and the same validator.** Easier to edit by hand. Adds about 100 KB of third-party code to the repo.
   - **C. `package.json` with `yaml` and `ajv`, and `npm ci` in the recipe `setup`.** Full JSON Schema. The repo's first install step, and every gate run needs the network.
4. ID placement and wrapping.
   - **A. Leading backticked ID, one line per bullet (recommended):** ``- `ORCH-005` Condition-plus-action **MUST** live on the model: ...``. Easy to scan, and the audit quotes the ID with the rule.
   - **B. Trailing ID:** `... in a handler. (ORCH-005)`.
   - **C. A with a hard wrap at 80 columns, as today.** Smaller diffs on later edits. The generator must never break inside a code span.
5. Detecting a deleted entry.
   - **A. `check --base origin/main` fails when an ID on the base is gone (recommended).** "Never reused" becomes mechanical: retiring a rule means `status: deprecated`, not deletion. Cost: the gate reads git.
   - **B. Uniqueness across all statuses only.** A deleted entry frees its ID, and only review catches it.
6. Shape scope.
   - **A. Build notes, section intros and numbered lists now (recommended).** #34 to #42 run in parallel and each adds one data file, with no edits to the shared schema or generator.
   - **B. Only what orchestration needs.** A smaller diff. The first conversion that needs a note or a numbered list changes the schema and the generator, and the parallel conversions conflict on them.
