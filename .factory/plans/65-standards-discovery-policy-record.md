# Plan for #65, standards-discovery: AI policy record and its stop

Issue codysseydev/codyssey-skills#65. Base origin/main ad19dcd. Branch `factory/65`. Kind: feature.

## Goal

Before any client code is read, a policy record decides whether the read may happen. A missing record stops. An incomplete record stops. A record that forbids the step stops. Each stop names the field that blocks. A record that allows the step lets it continue, with warnings from a scan of the repo's policy files. The new skill `kanon/standards-discovery` runs this as its first step, and `playbooks/factory.md` runs the same check in client repos.

## Problem

Nothing in the repo knows about AI policy or project-first mode today.

- `kanon/` holds `laravel-kanon`, `laravel-kanon-audit` and `symfony-kanon`, no `standards-discovery` (`find kanon -name SKILL.md`).
- `grep -rn "project-first\|kanon.yml\|policy" playbooks/factory.md` finds nothing. The factory reads `.factory/playbook.md` and `.factory/recipe.yml` from origin/main (`playbooks/factory.md:40`) and never asks whether AI may touch the repo.
- The owner's decisions. "Before any client code is read, there is a policy record" with six questions, and "`standards-discovery` and factory runs stop when the record is missing or forbids the step" (vault `Ideas/Software Factory Pipeline.md:315`, decisions table `:585`). The record "lives in the client's brain" (`:315`). The mode is `mode:` in `.ai/kanon.yml`, and "No file or no key means canon-first" (`:326`, issue #44 comment).
- The strictest clients keep the overlay out of git. "Otherwise the report and the overlay live in the client's brain ... kept out of git through `.git/info/exclude`" (`:324`). For those repos `origin/main:.ai/kanon.yml` is absent, so reading the mode alone would call them canon-first and skip the check. The data shape below closes that hole with a registry.
- The issue names the six fields and the stop. It does not define the allowed values, which fields block which step, where a factory run finds the record, or the exact scan list. Each of those is an open decision below, with the recommended option built into this plan.

## Behaviour

`check-policy.py` results. "Stop" means exit 1 and nothing more is read.

| Input | Result | `blocking` |
|---|---|---|
| `--record` path does not exist | stop | `record`: missing |
| Record without frontmatter, or a malformed line | stop | `record`: unreadable, with the line |
| Record with a field absent or empty | stop | that field: missing |
| Record with a value outside the field's allowed set | stop | that field: not an allowed value |
| `ai_allowed: no` | stop | `ai_allowed`: forbids read-code |
| `tools` does not list the run's tool | stop | `tools`: forbids read-code |
| `models` matches no prefix of the run's model | stop | `models`: forbids read-code |
| `code_leaves_machine: no` | stop | `code_leaves_machine`: forbids read-code |
| `commit_ai_files: no`, step `factory-run` | stop | `commit_ai_files`: forbids factory-run |
| Every field valid, nothing forbids the step | continue, scan runs | none |
| Factory: no `.ai/kanon.yml` or no `mode:` key, repo not in the registry | not-client, no check | none |
| Factory: repo in the registry, any mode | check the registry's record | as above |
| Factory: `mode: project-first`, repo not in the registry | stop | `record`: missing, no registry entry |
| Factory: `mode:` with a value other than the two modes | stop | `mode`: not an allowed value |

Every blocking field is listed, in the field table's order, so one stop shows every gap. On a stop the scan does not run and `warnings` is `[]` (open decision h).

## Data shape

### The policy record

A Markdown file in the client's brain with YAML-style frontmatter, one key per field, then free prose (open decision b). The prose holds where the answers came from, for example quotes from the client's policy. The check reads only the frontmatter.

```markdown
---
ai_allowed: yes
tools: [claude-code]
models:
  - claude
code_leaves_machine: model-provider
cloud_sessions: no
commit_ai_files: no
retention: 30d
---

Source: client security policy v3, section 4. Confirmed by email 2026-11-20.
```

The rules live in one table in the script, `FIELDS`, keyed by field. Each row has a parser and a forbid rule per step. A new step adds a column, never a new `if` elsewhere.

| Key | Issue's question | Allowed values | `read-code` blocks when | `factory-run` blocks when |
|---|---|---|---|---|
| `ai_allowed` | AI allowed at all | `yes`, `no` | `no` | `no` |
| `tools` | which tools | list of tool names, or `any` | `--tool` not listed | same |
| `models` | which models | list of model ids or prefixes, or `any` | `--model` matches no entry | same |
| `code_leaves_machine` | may code leave the machine | `no`, `model-provider`, `yes` | `no` | same |
| `cloud_sessions` | cloud sessions allowed | `yes`, `no` | never | never |
| `commit_ai_files` | may `.ai/`, `.factory/`, `CLAUDE.md` be committed | `yes`, `no` | never | `no` |
| `retention` | how long anything is kept | `none`, `<N>d`, `end-of-engagement` | never | never |

Parsing details, each confirmed in the prototype below:

- Booleans accept `yes`, `no`, `true`, `false`, any case. Obsidian checkbox properties are `true` and `false`.
- Lists accept the flow style `[a, b]` and the block style (`- a` lines under the key). A bare scalar is a one-item list.
- A model entry matches when it equals the model id or is a prefix ending at a hyphen. `claude` and `claude-opus` match `claude-opus-5-5`. `claude-o` does not.
- A duplicate key or a line that is not `key: value` or a list item makes the record unreadable.
- Unknown keys are ignored. A misspelt key leaves the real field missing, which stops.

Why `code_leaves_machine: no` blocks reading code: the skill and the factory run inside Claude Code with a hosted model. Every file the model reads goes to the model provider's API. `model-provider` allows exactly that and no other destination. Why `commit_ai_files: no` blocks a factory run: the factory needs `.factory/playbook.md` on origin/main to run at all (`playbooks/factory.md:40`, `:50`). Both rules are this plan's reading, not the issue's text (open decision c).

### Steps

```python
STEPS = {"read-code": ["read-code"], "factory-run": ["read-code", "factory-run"]}
```

`read-code` is the skill's first step: reading client code on this machine. `factory-run` is a factory run in a client repo: `read-code` plus the factory's own needs. #66 adds the overlay writer's step.

### The check's result

One JSON object on stdout. Exit 0 for `continue` and `not-client`, 1 for `stop`, 2 for bad usage.

```json
{
  "result": "continue | stop | not-client",
  "step": "read-code",
  "record": "/path/to/record.md",
  "mode": "project-first",
  "blocking": [{"field": "ai_allowed", "reason": "forbids read-code: no"}],
  "warnings": [
    {"file": ".aiignore", "signal": "ignore-file", "patterns": ["secrets/", "*.env"]},
    {"file": "CONTRIBUTING.md", "line": 12, "signal": "ai-clause", "text": "Do not paste code into ChatGPT or other AI tools."}
  ]
}
```

`mode` is present only in the factory form.

### The registry (factory only)

`~/.factory/ai-policy.json`, owner-written, on this machine only, never committed:

```json
{"acme/shop": "/Users/.../acme-brain/ai-policy.md"}
```

A repo listed here is a client repo whatever `.ai/kanon.yml` says. That covers the overlay kept in `.git/info/exclude` (open decision d).

### The CLI

```
check-policy.py --record <file> --repo <dir> --model <id> [--tool claude-code] [--step read-code]
check-policy.py --registry <file> --repo-name <owner/name> --repo <dir> --model <id> --step factory-run [--tool claude-code]
```

Exactly one of `--record` and `--registry`, else exit 2. The second form reads the mode from `<repo>/.ai/kanon.yml` (top-level `mode:` line only) and looks the record up in the registry. `--repo` is a checkout at origin/main. In a factory run it is the run's worktree, so its `.ai/kanon.yml` is origin/main's.

### The scan

Runs only after a `continue`. It never lists a folder except the three below, and opens only these files (open decision e):

- `.aiignore` and `.cursorignore` at the root. Warning `ignore-file` with the patterns (lines that are not blank or `#` comments).
- `README` at the root, and `CONTRIBUTING` at the root, in `.github/` and in `docs/` (the places GitHub reads it from). Names match case-insensitively with no extension or `.md`, `.markdown`, `.rst`, `.txt`. Warning `ai-clause` for each line that matches `\b(AI|A\.I\.|artificial intelligence|LLMs?|large language models?|ChatGPT|Copilot|Claude|Cursor|generative|GPT-?\d*)\b`, case-insensitive, with `file:line` and the line cut to 200 characters.
- A policy file that is a symlink is not opened. It gets a warning `symlink` with its name, since it may point into application code.

## Changes

### `kanon/standards-discovery/SKILL.md` (new)

- Frontmatter `name: standards-discovery` and a description in the style of `kanon/laravel-kanon-audit/SKILL.md:1-16`: reads a client's codebase and writes its conventions as a project overlay, project-first mode; today only its first step (the policy check) is built; not for canon-first repos.
- Inputs. The policy record's path (the client's brain), the repo path, the model id of the session.
- Step 1, the policy check. Run `python3 <skill dir>/scripts/check-policy.py --record <record> --repo <repo> --model <model id>` before reading anything in the repo. Exit 1: report each `blocking` field and reason, read nothing else in the repo, stop. Exit 0: keep `warnings` for the standards report, and treat the `ignore-file` patterns as paths not to read in later steps.
- Step 2 onward. One line: discovery, the standards report and the overlay writer come in #66.
- Points to `references/policy-record.md` for the template.

### `kanon/standards-discovery/references/policy-record.md` (new)

- The template: the frontmatter with all seven keys and empty values, then a `Source:` prose line. The empty template fails the check with every field missing, which shows the owner what to fill.
- The field table from Data shape: key, question, allowed values, what each value allows. It defines a cloud session (a session whose checkout runs on a provider's machine, for example Claude Code on the web) and says `cloud_sessions` and `retention` block no step yet.
- Where it lives: the client's brain, not the client's repo.

### `kanon/standards-discovery/scripts/check-policy.py` (new)

- Stdlib only (`argparse`, `json`, `os`, `re`, `sys`). The repo has no PyYAML (`grep -rn "import yaml" .` finds nothing, and `python3 -c "import yaml"` fails here). `factory/factory-onboard/scripts/prove-recipe.py:46` parses `recipe.yml` by hand the same way.
- Pieces: `parse_frontmatter(text)`, `FIELDS`, `STEPS`, `check(raw, step, ctx) -> blocking`, `client_record(registry, repo_name, kanon_yml_text) -> (record path | not-client | blocking)`, `policy_files(repo)`, `scan(repo)`, `main(argv)`.
- The boundary is `main`: it reads files and prints. `check` and the field rules take parsed values, so tests call them without a filesystem.

### `kanon/standards-discovery/tests/test_check_policy.py` and `tests/fixtures/records/` (new)

- Loads the script by path with `importlib`, as `factory/factory-onboard/tests/test_prove_recipe.py:5-7` does.
- Fixture records: `allowing.md`, `forbidding.md`, `incomplete.md`. The missing case is a path that does not exist.
- Rows in Tests below.

### `.factory/recipe.yml`

- After `factory-onboard-tests` (`:18-19`):

```yaml
  - name: standards-discovery-tests
    run: python3 -m unittest discover -s kanon/standards-discovery/tests
```

### `.factory/playbook.md`

- `:7`: add `standards-discovery-tests` to the list of recipe checks. The file says a change to a check command updates it in the same change (`:3`).
- `:30`: "the five factory skills in `~/.claude/skills/`" becomes "the five factory skills and `standards-discovery` in `~/.claude/skills/`", and "A merged change to `playbooks/` or `factory/`" adds `kanon/standards-discovery/` (open decision f).

### `playbooks/scripts/install.mjs` (open decision f)

- `:29`: add `export const KANON_SKILLS = ['standards-discovery'];` next to `FACTORY_SKILLS`.
- `installMap` (`:34-38`): add `...KANON_SKILLS.map((name) => ({ prefix: \`kanon/${name}/\`, dir: join(skillsDir, name) }))`. The map is "the only place the install list lives" (`:33`), so nothing else changes in the script.
- `~/.claude/skills/standards-discovery` does not exist on this machine (`ls ~/.claude/skills`), so the first install creates it and overwrites nothing.

### `playbooks/scripts/install.test.mjs`

- `baseFiles` (`:40-48`): add `kanon/standards-discovery/SKILL.md` and `kanon/laravel-kanon/SKILL.md` (a kanon folder not in the list).
- The install test (`:123`): assert `standards-discovery/SKILL.md` is installed.
- `a folder under factory/ that is not in the list is not installed` (`:272-278`): `laravel-kanon` is not installed, and the folder list equals `FACTORY_SKILLS` plus `KANON_SKILLS`.

### `playbooks/factory.md`

- A new subsection `#### AI policy in client repos` between `#### Project file` (ends `:50`) and `#### The five stops` (`:52`):
  - A repo is a client repo when `.ai/kanon.yml` on origin/main says `mode: project-first`, or when `~/.factory/ai-policy.json` lists it. Read `.ai/kanon.yml` from origin/main like the project file. No file or no `mode:` key means canon-first.
  - The check: `python3 ~/.claude/skills/standards-discovery/scripts/check-policy.py --registry ~/.factory/ai-policy.json --repo-name <owner/name> --repo <worktree> --step factory-run --model <model id>`, with `<worktree>` the run's worktree at origin/main. Making the worktree writes files to disk. The model reads none of them before the check.
  - Exit 1 is a stop (open decision g). Unattended: post one comment naming each blocking field and its reason, add `needs-decision`, report `waiting` with reason `question` and 2 options (the owner fixes the record or the registry; the owner closes the issue), and stop. Interactive: ask with the same options.
  - Exit 0 with `not-client` changes nothing. Exit 0 with `continue` puts the warnings in the plan comment.
- `#### Before the run` (`:33-36`): a new bullet. At every claim, whatever the action (`plan`, `implement` or `archive`, `:27`), run the AI policy check before reading any code in the repo. A resumed run is a new session, so a check only at stage 1 would be skipped.
- `:22`: "the five factory skills" becomes "the five factory skills and `standards-discovery`" (open decision f).
- No list item starts with a bold `After`, `Before`, `Replace` or `In`. `check-playbooks.mjs` checks every such line in the file (`CHANGE_VERB`, script line 10), not only the "Changes to the bundled steps" section. The anchors in `:144-160` are untouched.
- A merged change to `playbooks/` takes effect on the next `install.mjs` run, not at merge (`.factory/playbook.md:30`).

### `README.md`

- `:11`: the `kanon/` row adds "and `standards-discovery`, the AI policy check that comes before reading a client's code".
- `kanon/` section (`:17-32`): a bullet for `standards-discovery`. What it does today (the policy record, the stop, the scan), the record template path, and that discovery follows in #66.
- Install (`:117-118`): the install script also installs `standards-discovery`.

## Tests

All in `kanon/standards-discovery/tests/test_check_policy.py` unless named. At base every row fails, because neither the skill folder nor the `KANON_SKILLS` export exists.

| Test | Checks | At base |
|---|---|---|
| `missing record stops on record` | A path that does not exist gives `[{"field": "record", "reason": "missing"}]` | fails |
| `forbidding record stops and names the field` | `forbidding.md` (`ai_allowed: no`, `code_leaves_machine: no`) blocks on both, in table order | fails |
| `allowing record continues` | `allowing.md` gives `[]` | fails |
| `incomplete record names each gap` | `incomplete.md` names each absent field as missing and `code_leaves_machine: maybe` as not an allowed value | fails |
| `each field's forbid rule` | Table-driven over `FIELDS`. Start from the allowing values, set one field to its forbidding value per step. Exactly that field blocks, and `cloud_sessions` and `retention` never block | fails |
| `frontmatter forms` | Flow and block lists, `true`/`false`, quoted values, a duplicate key (unreadable), no frontmatter (unreadable) | fails |
| `model prefix match` | `claude` and `claude-opus` match `claude-opus-5-5`, `claude-o` does not, `any` matches all | fails |
| `factory-run blocks on commit_ai_files no` | `allowing.md` passes `read-code` and stops `factory-run` on `commit_ai_files` | fails |
| `client detection` | The seven cases from the prototype below: not-client, registry wins over a missing file, project-first without an entry stops on `record`, a bad `mode:` stops on `mode`, no `mode:` key is canon-first | fails |
| `scan opens only the policy files` | A repo with `README.md`, `.aiignore`, `docs/CONTRIBUTING.md`, `docs/README.md`, `app/Secret.php`, `composer.json`, every file holding "AI". A `sys.addaudithook` hook records each `open` event during `scan()`. The opened set is exactly `.aiignore`, `README.md`, `docs/CONTRIBUTING.md` | fails |
| `scan warnings` | `ignore-file` carries the patterns without comments. `ai-clause` carries `file`, `line`, `text`. A symlinked README is not opened and gives a `symlink` warning | fails |
| `no scan on a stop` | With `forbidding.md`, `main` opens no file under the repo and prints `warnings: []` | fails |
| `cli exit codes` | Subprocess runs: exit 0 and `continue` for `allowing.md`, exit 1 and `stop` for `forbidding.md`, exit 0 and `not-client` for a canon-first repo, exit 2 with both or neither of `--record` and `--registry` | fails |
| `install: kanon/standards-discovery installs, other kanon folders do not` (`install.test.mjs`) | The install writes `standards-discovery/SKILL.md`. `laravel-kanon` is not installed. The skills folder equals `FACTORY_SKILLS` plus `KANON_SKILLS` | fails |

## Gates

From the worktree root, at the head commit, clean tree. The checks in `.factory/recipe.yml`, plus the new `standards-discovery-tests`:

```sh
node --test playbooks/scripts/pick-up.test.mjs
node --test playbooks/scripts/post-merge.test.mjs
node --test playbooks/scripts/capture-ui.test.mjs
node --test playbooks/scripts/trial-decision.test.mjs
node --test playbooks/scripts/test-first.test.mjs
python3 -m unittest discover -s factory/bootstrap/tests
python3 -m unittest discover -s factory/event-model/tests
python3 -m unittest discover -s factory/factory-onboard/tests
python3 -m unittest discover -s kanon/standards-discovery/tests
node --test playbooks/scripts/install.test.mjs
```

Plus `node <pstack>/skills/poteto-mode/scripts/check-playbooks.mjs <root>` with the edited `playbooks/factory.md` copied to `<root>/.agents/playbooks/factory.md`, because the script reads only `.agents/playbooks/` and the home copy.

Baseline at ad19dcd, node v26.13.0, Python 3.15.2, clean tree:

| Gate | Command | Exit | Result |
|---|---|---|---|
| pick-up-tests | `node --test playbooks/scripts/pick-up.test.mjs` | 0 | 99 pass |
| post-merge-tests | `node --test playbooks/scripts/post-merge.test.mjs` | 0 | 23 pass |
| capture-ui-tests | `node --test playbooks/scripts/capture-ui.test.mjs` | 0 | 115 pass |
| trial-decision-tests | `node --test playbooks/scripts/trial-decision.test.mjs` | 0 | 39 pass |
| test-first-tests | `node --test playbooks/scripts/test-first.test.mjs` | 0 | 36 pass |
| bootstrap-tests | `python3 -m unittest discover -s factory/bootstrap/tests` | 0 | 3 OK |
| event-model-tests | `python3 -m unittest discover -s factory/event-model/tests` | 0 | 4 OK |
| factory-onboard-tests | `python3 -m unittest discover -s factory/factory-onboard/tests` | 0 | 28 OK |
| install-tests | `node --test playbooks/scripts/install.test.mjs` | 0 | 22 pass |
| check-playbooks | `check-playbooks.mjs` on a copy of `playbooks/factory.md` | 0 | "Every project playbook matches this pstack's playbooks." |

The implementation PR edits `.factory/recipe.yml` and `.factory/playbook.md`, so the trusted-commands guard flags it (`playbooks/factory.md:87`).

## Prototype

Run in a scratchpad, not committed.

- A stdlib `check-policy.py` with the `FIELDS` table, the frontmatter parser and the scan, against three fixture records and a missing path, model `claude-opus-5-5`. `allowing.md`: `continue`, exit 0, 5 warnings. `forbidding.md`: `stop`, exit 1, `ai_allowed` and `code_leaves_machine`. `incomplete.md` (with `ai_allowed: true` and a block list for `models`): `stop` on `code_leaves_machine` (`'maybe'`), `commit_ai_files` and `retention`. Missing path: `stop` on `record`. `allowing.md` with `--step factory-run`: `stop` on `commit_ai_files`. With `--model gpt-5`: `stop` on `models`.
- The scan on a repo with root `README.md`, `CONTRIBUTING.md`, `.aiignore`, `.github/CONTRIBUTING.md`, `docs/README.md` and `app/Secret.php`. Warnings came from `.aiignore`, `CONTRIBUTING.md`, `README.md` and `.github/CONTRIBUTING.md`. `docs/README.md` and `app/Secret.php` gave none. One false positive: the README line "No AI clause here." matched.
- The audit-hook test, run with `python3 -m unittest discover -s standards-discovery/tests` from a folder with a hyphen in its name: 4 tests OK. Discovery finds `test_*.py` in a hyphenated folder. `os.listdir` raises no `open` audit event, so the hook sees only real file opens. A mutation that made `policy_files` also return `app/Secret.php` failed the test with `['.aiignore', 'README.md', 'app/Secret.php', 'docs/CONTRIBUTING.md'] != [...]`.
- Client detection over seven cases (no file, registered or not; project-first, registered or not; a bad mode; no `mode:` key; no registry file). The results match the Behaviour table.
- `check-playbooks.mjs` on a copy of `playbooks/factory.md` with the new subsection and a stage-1 sentence: exit 0. A negative control that appended `- **Before** "Run the AI policy check" ...`: exit 1, "is not in any playbook it extends".
- `install.mjs:29` installs only `FACTORY_SKILLS` (`bootstrap`, `brief-to-backlog`, `brief-writer`, `event-model`, `factory-onboard`), and `installMap` (`:34-38`) maps only `playbooks/` and `factory/<name>/`. No kanon skill installs today.

## Event model

Skip. No journey board for internal tooling, as plan 29 did. In `codyssey-docs`, `grep -rlni -e standards-discovery -e "policy record" -e project-first --exclude-dir=.git --exclude-dir=.claude .` finds only `Ideas/` notes (Software Factory Pipeline, Kanon Rule Catalog, Ideas Inbox, Software Factory Build Log, Codebase Care Service). The `policy` hits under `Architecture/` (`Event Model Board.md`, `event-model-generator/es.py`, `hotspots.py`) are Event Storming policy cards, not this feature.

## Out of scope

- Discovery, the standards report and the overlay writer, including writing `.ai/kanon.yml` (#66). The test runs on the Codyssey backend and `symfony/demo` (#67).
- Enforcing `cloud_sessions` and `retention`. No step built here starts a cloud session or keeps client data. The fields are required so the record is whole, and #66 or later steps add forbid rules for them.
- Local models. A run on a model that never leaves the machine would make `code_leaves_machine: no` pass. The check has no flag for it.
- Proving the record belongs to the repo. The registry maps a repo to a path. The record does not name its client.
- Tracker adapters (Jira, Linear, GitLab).
- Unattended factory runs in a repo whose record says `commit_ai_files: no`. Such a repo cannot hold `.factory/` on origin/main, so pick-up never watches it (`playbooks/factory.md:23`). Client work there runs by hand.

## Owner follow-ups

- For each client, fill a record from `references/policy-record.md` in the client's brain and add the repo to `~/.factory/ai-policy.json`.
- The factory runs the installed copies. The playbook change and the new skill reach runs on the next `install.mjs` run after merge (`.factory/playbook.md:30`).

## Risks

- Clause matches are noisy. The prototype flagged "No AI clause here." Warnings never stop a run, so noise costs a line in the report.
- The registry is local to this Mac. Another machine has no registry, so a project-first repo there stops on `record`. That fails closed.
- A record goes stale when the client changes their policy. The record has no review date. Its `Source:` prose line is the only trace.
- The audit hook sees Python `open` calls. A subprocess or a C extension that reads a file would not show. The script uses neither.
- The factory check runs in a worktree that already holds the client's files. The model reads none of them before the check, and the script reads only `.ai/kanon.yml` and the policy files. If the owner reads "before any client code is read" as "before any checkout", the check would need `git show origin/main:<path>` reads instead (open decision d, option C).

## Open decisions

a. How the stop is enforced.
   - **A. A Python script with tests (recommended).** The acceptance criteria name fixtures and "reads only the listed policy files". A script makes both testable, and the audit-hook test proves the second. The factory and the skill call the same script.
   - B. Prose in `SKILL.md` and `factory.md`, the model applies the field table. No code. The scan claim cannot be tested, and two copies of the rules can drift.
   - C. Script for the record, prose for the scan. Half the code, and the scan claim is still untested.

b. Record format.
   - **A. Markdown with YAML-style frontmatter, the allowed values above (recommended).** The record lives in a brain vault, where frontmatter shows as properties and the prose below holds the source. Booleans take `true`/`false` too, lists take both styles.
   - B. A plain YAML file. Same parser, but no place for the client's policy quotes next to the answers.
   - C. A Markdown table in the body. Readable, but table parsing breaks on a stray pipe and gives poor errors.

c. Which fields block which step. The issue and the vault say only that a record that "forbids the step" stops.
   - **A. As the field table (recommended).** `read-code` blocks on `ai_allowed: no`, an unlisted tool or model, and `code_leaves_machine: no`, because a hosted model receives what it reads. `factory-run` also blocks on `commit_ai_files: no`, because the factory needs `.factory/` on origin/main. `cloud_sessions` and `retention` block nothing yet.
   - B. Only `ai_allowed` blocks. The other fields are recorded and enforced by later steps. Fewer stops, but a client that forbids code leaving the machine gets its code sent to a model provider.
   - C. Any field with its most restrictive value blocks every step. Simple and strict, but `retention: none` or `cloud_sessions: no` would stop local work they do not restrict.

d. Where a factory run finds the record path. Nothing defines it today.
   - **A. An owner-written registry `~/.factory/ai-policy.json` mapping `owner/repo` to the record path (recommended).** Works when AI files may not be committed. Keeps the client's brain path out of the client's repo. A listed repo is a client repo whatever `.ai/kanon.yml` says, which covers an overlay kept in `.git/info/exclude` (vault `:324`).
   - B. A `policy_record:` key in `.ai/kanon.yml` next to `mode:`. One file to read, but it needs AI files committed (the thing the record may forbid), it puts a local path in the client's repo, and a local-only overlay is invisible on origin/main.
   - C. A plus reads through `git show origin/main:<path>` instead of a worktree, so the check runs before any client file is on disk. Stricter, at the cost of a `--ref` mode in the script and the scan.

e. Which files the scan opens.
   - **A. The issue's list: `.aiignore`, `.cursorignore`, root `README`, `CONTRIBUTING` at root, `.github/` and `docs/` (recommended).** `CLAUDE.md`, `AGENTS.md`, `.cursor/rules` and `.github/copilot-instructions.md` are discovery inputs in the vault (`:317`), so they wait for #66.
   - B. A plus other AI ignore files (`.aiexclude`, `.codeiumignore`). More signals, beyond the issue's list.
   - C. A plus a presence check, without opening, of `CLAUDE.md`, `AGENTS.md`, `.cursor/rules` and `.github/copilot-instructions.md`, warning that the team already uses AI tools. No extra reads, but presence says nothing about restrictions.

f. Whether `install.mjs` installs the skill.
   - **A. Yes, through a `KANON_SKILLS` entry in `installMap` (recommended).** The factory calls `check-policy.py` from `~/.claude/skills/`, and the factory runs installed copies only. Ripple: `install.mjs:29,34-38`, `install.test.mjs:40-48,123,272-278`, `README.md:117-118`, `factory.md:22`, `.factory/playbook.md:30`.
   - B. No. `factory.md` tells the run to copy the folder by hand, as `README.md:112-115` says for kanon skills. A machine that missed the copy fails the check with a missing script, not with a policy answer.
   - C. No, and `factory.md` calls the script from the codyssey-skills checkout. Every client run then reads a file from the owner's working copy, which `factory.md:40` avoids for project files.

g. How a factory run reports a policy stop.
   - **A. One comment naming the blocking fields, `needs-decision`, `waiting` with reason `question` (recommended).** No change to the dashboard contract (`factory.md:122-125`) or to the five stops.
   - B. A new waiting reason `ai_policy`. Clearer in the inbox, but it needs a dashboard PR first.
   - C. `factory-failed` and `failed`. No owner prompt, and a later retry needs the label removed by hand.

h. Whether the scan runs when the record stops.
   - **A. No (recommended).** The scan prints lines from the client's README into the model's context. A record that forbids AI forbids that too.
   - B. Yes, so the stop report also shows the repo's own signals. It reads client files the record may forbid.
