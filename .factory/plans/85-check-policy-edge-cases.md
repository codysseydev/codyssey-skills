# Plan for #85, standards-discovery: edge cases in check-policy.py

Issue codysseydev/codyssey-skills#85. Base origin/main b87b826. Branch `factory/85`. Kind: bug fix (open decision a).

## Goal

Close the nine edge cases the #65 reviews left. Every case where the factory form of `check-policy.py` reads a client repo as not-client, or reads a stale or wrong source, becomes a stop or a correct read. The record and scan rules get the fixes the owner picks below. The playbook fetches origin/main so the ref cannot stay stale, and runs the policy check before it reads the project file.

## Problem

Each bullet of the issue, put against the code at b87b826 (prototype runs in Prototype below):

1. `_git` (`check-policy.py:171-175`) passes the caller's environment. With `GIT_DIR=<other>/.git` alone, `rev-parse --show-toplevel` still returns the `-C` folder, so the top-level check passes, and `ls-tree` reads the other repo. A project-first repo reads as not-client, exit 0. With `GIT_DIR` and `GIT_WORK_TREE` together the check already stops (`not the top level`), so the test must set `GIT_DIR` alone.
2. The mode read (`:234-238`) is a line regex. `{mode: project-first}`, a whole document indented by two spaces and `? mode\n: project-first` read as canon-first, while Ruby's YAML (Psych 3.1.0, on this Mac) reads root `mode` as `project-first` in each. `Mode:` and `MODE:` read as canon-first (Ruby agrees, they are other keys). `.AI/kanon.yml`, `.ai/Kanon.yml` and `.ai/kanon.yaml` on origin/main read as absent.
3. `kanon_yml_at` (`:196-213`) checks the path, not the entry type. With `.ai/kanon.yml/` a folder, `git show` prints a tree listing (`tree refs/remotes/origin/main:.ai/kanon.yml\n\nx\n`) and that text is parsed. A gitlink `.ai` (mode 160000) and a regular file `.ai` read as absent, so canon-first.
4. `read_registry` (`:265-278`): with `<tmp>/link -> <tmp>/nowhere`, `<tmp>/link/ai-policy.json` makes `os.lstat` raise `FileNotFoundError`, so it returns `{}` and the repo reads as not-client.
5. `playbooks/factory.md:60` "Fetch first" runs `git fetch -q origin main`. In a clone whose `remote.origin.fetch` does not cover main (a `--single-branch` clone of another branch, or an edited refspec), it exits 0 and leaves `refs/remotes/origin/main` stale or absent. `git fetch origin` (the lane prompts) does the same. `git fetch -q origin +refs/heads/main:refs/remotes/origin/main` moves it in every case tried. A failed fetch reuses the options of `:62`, which name `install.mjs`, not network or auth.
6. `scan` (`:325-344`) reads the policy files from the `--repo` working tree. A README changed in the owner's checkout but not on origin/main gives the checkout's text. On a branch without `.github/` and `docs/`, the scan misses origin/main's `CONTRIBUTING` files.
7. `playbooks/factory.md:43` reads the project file "at pick-up" with no order against the policy check (`:38`), and all three lane prompts (`scheduled-tasks/*/SKILL.md:28`) start with "First ... read the project file". In a client repo `.factory/playbook.md` is client content.
8. `client_record` (`:244-245`) compares names after `casefold()` only. ` acme/shop `, `acme/shop.git`, `acme/shop/`, `https://github.com/acme/shop(.git)` and `git@github.com:acme/shop.git` miss the key `acme/shop`, and keys in those forms miss the name `acme/shop`. A miss is not-client.
9. Record rules. `AI_CLAUSE` (`:283-286`) is case-insensitive: "Move the cursor", "Claude Monet", "generative grammar" and "example.ai" all match. `_model_matches` (`:112-113`) treats every entry as a prefix, so `claude-opus-5-5` also admits `claude-opus-5-5-20261101`. An empty `mode:` stops with `not an allowed value: ` and an empty value.

## Behaviour

Factory form (`--registry`) after the change, with the recommended options. "Stop" is exit 1.

| Input | Today | After | `blocking` |
|---|---|---|---|
| `GIT_DIR` of another repo in the environment | reads the other repo | reads `--repo` | as for `--repo` |
| `.ai/kanon.yml` in a form the strict reader does not accept (Data shape) | canon-first or a mis-read | stop | `mode`: unreadable, with the reason |
| `mode:` with no value, or `mode: ""` | stop, `not an allowed value: ` | stop | `mode`: empty |
| A root entry that casefolds to `.ai` but is not `.ai`, or a `.ai/` entry that casefolds to `kanon.yml` or `kanon.yaml` but is not `kanon.yml` | absent, canon-first | stop | `mode`: unreadable, case variant |
| `.ai` a gitlink or a file, `.ai/kanon.yml` a folder or a gitlink | canon-first, or a tree listing parsed | stop | `mode`: unreadable, not a folder or not a regular file |
| Registry under a dangling symlinked folder | `{}`, not-client | stop | `record`: unreadable registry |
| Registry under a folder that does not exist | `{}`, not-client | unchanged | none |
| `--repo-name` not `owner/name` | a silent miss | exit 2 | none |
| A registry key not `owner/name` | a silent miss | stop | `record`: registry key is not owner/name |
| `continue` | scan of the working tree | scan of origin/main through git | none |

Record form (`--record`): unchanged except the `models` rule and the clause regex. Its scan stays on the working tree, so `SKILL.md:36-39` stays true.

## Data shape

### The strict `.ai/kanon.yml` reader

After a byte order mark is removed, each line is one of:

- Blank, or a comment (first non-space character `#`).
- `---` before the first content line. A later `---` or `...` is unreadable ("more than one document"). A `%` directive is unreadable.
- A root key line: `key:` or `key: value` at column 0, the key plain `[A-Za-z0-9_-]+` or wrapped in `"` or `'`. The first content line must be one. `<<`, `?`, `{`, `[`, `*alias`, `&anchor` and escaped quoted keys do not match, so they are unreadable. A key that casefolds to `mode` but is not `mode` is unreadable.
- After a root key line, a line that starts with a space, or a `-` item at column 0: opaque, skipped. So `rules:\n  mode: x` stays nested and is not the mode, as today.
- A tab at the start of a line, or any other column-0 line: unreadable.

The `mode` value drops a trailing ` # comment` and its quotes. Empty is a stop on `mode: empty` (open decision c). Two `mode` lines stay "mode given twice". `policy-record.md` documents this grammar, and the #66 overlay writer must write `.ai/kanon.yml` inside it (note left in the shared notes folder).

### The kanon file lookup

`git ls-tree -z --full-tree origin/main` lists the root. `.ai` must be a tree (040000) when present. `git ls-tree -z --full-tree origin/main -- .ai/` lists its children. `kanon.yml` must be a blob with mode 100644 or 100755, read by object id with `git cat-file blob <oid>`. Absent stays canon-first. A symlink keeps the word `symlink` in its reason.

### `models` (open decision f, option A)

| Entry | Matches |
|---|---|
| `any` | every model |
| `claude-*`, `claude-opus-*` | an id that starts with `claude-`, `claude-opus-` |
| `claude-opus-5-5` | `claude-opus-5-5` only |
| `claude-o*`, `*`, `claude*` | not an allowed value |

A record written for #65 with the bare entry `claude` then stops on `models` for `claude-opus-5-5`. That fails closed and names the field.

### `--repo-name` and registry keys (open decision e, option A)

Both must fullmatch `[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+`, with neither segment `.` or `..`, and must not end in `.git`. `--repo-name` that fails is a usage error, exit 2. A key that fails stops every lookup on `record`, like the case-collision rule.

### `AI_CLAUSE` (open decision g, option A)

Product names match only in their own case: `ChatGPT`, `Copilot`, `Claude`, `Cursor`, `GPT-?\d*`. `AI`, `A.I.` and `LLMs?` match in any case, but not after a `.` (so `example.ai` does not match). `artificial intelligence`, `large language models?` and `generative AI` match in any case. `generative` alone no longer matches.

## Changes

### `kanon/standards-discovery/scripts/check-policy.py`

- `_git`: run git with the environment minus every variable whose name starts with `GIT_`.
- `kanon_yml_at`: the lookup above. `client_record`: the strict reader above, as its own function `mode_of(text)` returning `(mode, blocking)`.
- `read_registry`: on `FileNotFoundError`, walk up to the nearest ancestor `os.lstat` finds. A symlink there that does not resolve raises. Otherwise `{}`.
- `client_record`: validate each registry key. `main`: validate `--repo-name` with `parser.error`.
- `_model_matches` and `parse_list` for `models`: the table above.
- `AI_CLAUSE`: the rules above.
- The scan gets two sources behind one warning builder: the working tree (`--record`, unchanged) and origin/main through git (`--registry`). The git source lists the root, `.github` and `docs` with `ls-tree -z`, classifies by mode (120000 symlink, 100644 or 100755 file, anything else unreadable for a policy name) and reads blobs with `cat-file`. It opens no file under `--repo` (open decision d).
- Prototype size: 404 to 575 lines.

### `kanon/standards-discovery/tests/test_check_policy.py` and fixtures

- `models` fixtures: `allowing.md`, `forbidding.md`, `incomplete.md` change `claude` to `claude-*`. `test_each_fields_forbid_rule` and `test_model_prefix_match` follow.
- New tests in Tests below. One helper builds an origin/main tree by hand with `git update-index --cacheinfo`, because macOS cannot hold `.ai` and `.AI` side by side and gitlinks need no submodule.

### `kanon/standards-discovery/references/policy-record.md`

- `:29` `models`: the new table. Line about the strict `.ai/kanon.yml` grammar, the case variants and entry types next to `:67`. `:65-66` registry rules: keys must be `owner/name`, and a registry under a dangling symlinked folder stops. The scan reads origin/main in a factory run.

### `playbooks/factory.md`

- `:60` Fetch first: `git -C <checkout> fetch -q origin +refs/heads/main:refs/remotes/origin/main`, with one sentence on why (a refspec that does not cover main leaves the ref stale while fetch exits 0). A failed fetch gets its own bullet and options (open decision b).
- `:43` Project file: the same fetch command, and "Read it only after the AI policy check returns `not-client` or `continue` (Before the run)".
- `:62` keeps its install options for exit 2 and missing scripts only.
- No list item starts with a bold `After`, `Before`, `Replace` or `In`.

### `scheduled-tasks/factory-pickup*/SKILL.md` (all three)

- `:28` kickoff: "First, through a subagent, run the AI policy check as `AI policy in client repos` in the playbook says, which fetches origin main first. Only when it returns `not-client` or `continue`, read the project file with `git -C <checkout> show origin/main:.factory/playbook.md` ...". The rest of the sentence stays.

### `playbooks/scripts/install.test.mjs` (open decision h)

- A test next to "each repo prompt runs the install before it claims" (`:466-474`): in each prompt `check-policy.py` comes before `show origin/main:.factory/playbook.md`. This file is outside the brief's list, so it needs the owner's yes.

### `.factory/playbook.md`

No change. No check command or setup step changes.

## Tests

All in `test_check_policy.py` unless named. "At base" is against b87b826, from the prototype.

| Test | Checks | At base |
|---|---|---|
| `git environment variables do not redirect the lookup` | `GIT_DIR` alone of a canon-first repo, `--repo` a project-first repo: stop on `record` | fails |
| `case variants and odd entries around the kanon file stop on mode` | `.AI/`, `.ai/Kanon.yml`, `.ai/kanon.yaml`, `.ai` and `.AI` both, gitlink `.ai`, file `.ai`, folder `.ai/kanon.yml`, gitlink `.ai/kanon.yml` | fails (9 of 9) |
| `an executable kanon file and unrelated entries are fine` | mode 100755, other files in `.ai/` | passes (guard) |
| `a kanon file the reader does not understand stops on mode` | flow mapping, indented document, `? mode`, `Mode:`, `<<: *b`, escaped key, second document, `%YAML`, leading tab, `- mode:` | fails (14 of 14) |
| `an empty mode stops on mode` | `mode:`, `mode: ""`, `mode: # x` give `empty` | fails |
| `kanon files the reader accepts` | quoted keys, `---` first, a comment after the value, nested `mode`, a realistic overlay with nested lists | passes (guard) |
| `a registry under a dangling symlinked folder stops on record` | as named | fails |
| `a registry under a missing folder is still an empty one` | not-client | passes (guard) |
| `a repo name that is not owner/name exits 2` | whitespace, `.git`, URLs, `git@`, trailing slash, `..` | fails |
| `a registry key that is not owner/name stops on record` | the same forms as keys | fails |
| `model prefix match` (rewritten) | the `models` table | fails |
| `ai clause matches the names and not the common words` | the lines in Prototype | fails |
| `the git scan reads origin/main and opens nothing in the worktree` | audit hook sees no open under `--repo` | fails |
| `the registry form scans origin/main, not the worktree` | CLI, a checkout README that differs from origin/main | fails |
| `each repo prompt runs the policy check before it reads the project file` (`install.test.mjs`) | prompt text order | fails |

Failing-test command (Kind: bug fix): `python3 -m unittest discover -s kanon/standards-discovery/tests`. The first commit after approval holds the new and changed tests and fixtures alone, subject `test: failing test for #85`. It fails on assertions about the bugs, not on imports: the git-scan tests call `cp.scan_git`, so the test commit guards them with `getattr` and fails them with an assertion.

## Gates

From the worktree root at the head commit, clean tree: the twelve checks of `.factory/recipe.yml`, `test-first.mjs` with the command above, and `check-playbooks.mjs` on a copy of the edited `playbooks/factory.md` under `<root>/.agents/playbooks/factory.md`.

Baseline at b87b826, node v26.13.0, Python 3.15.2, clean tree:

| Gate | Command | Exit | Result |
|---|---|---|---|
| pick-up-tests | `node --test playbooks/scripts/pick-up.test.mjs` | 0 | 108 pass |
| post-merge-tests | `node --test playbooks/scripts/post-merge.test.mjs` | 0 | 23 pass |
| capture-ui-tests | `node --test playbooks/scripts/capture-ui.test.mjs` | 0 | 115 pass |
| trial-decision-tests | `node --test playbooks/scripts/trial-decision.test.mjs` | 0 | 39 pass |
| test-first-tests | `node --test playbooks/scripts/test-first.test.mjs` | 0 | 36 pass |
| bootstrap-tests | `python3 -m unittest discover -s factory/bootstrap/tests` | 0 | 3 OK |
| event-model-tests | `python3 -m unittest discover -s factory/event-model/tests` | 0 | 4 OK |
| factory-onboard-tests | `python3 -m unittest discover -s factory/factory-onboard/tests` | 0 | 28 OK |
| standards-discovery-tests | `python3 -m unittest discover -s kanon/standards-discovery/tests` | 0 | 54 OK |
| install-tests | `node --test playbooks/scripts/install.test.mjs` | 0 | 29 pass |
| kanon-catalog-check | `node kanon/scripts/catalog.mjs check --base origin/main` | 0 | 1 family file, 37 entries |
| kanon-catalog-tests | `node --test kanon/scripts/catalog.test.mjs` | 0 | 33 pass |

The PR edits `scheduled-tasks/`, which hold the lane prompts, not gate commands, so the trusted-commands guard flags nothing.

## Prototype

Run in the scratchpad on a copy of `kanon/standards-discovery/`, not committed.

- Bugs at base: `GIT_DIR` alone gave `not-client` exit 0 for a project-first repo. The nine kanon-file entry cases read as canon-first, and the folder case parsed `git show`'s tree listing. A registry under `link -> nowhere` gave `{}`. The seven name forms missed in both directions. All 14 clause lines matched, including "Move the cursor to the end." and "Claude Monet painting".
- Fetch: in a `--single-branch --branch other` clone, `git fetch -q origin main` exited 0 and created no `origin/main`. With the refspec edited to cover only `other`, both `git fetch -q origin main` and `git fetch origin` exited 0 and left `origin/main` at the old commit. `git fetch -q origin +refs/heads/main:refs/remotes/origin/main` moved it.
- The fixes A to H on the copy: 69 tests OK. Every new bug test failed against the untouched script and passed after. The only existing tests that broke were the nine that used the bare `models` entry `claude`.
- The strict reader against Ruby's YAML over 34 texts: no row where Ruby reads root `mode` as `project-first` and the reader reads canon-first. Rows where the reader stops and Ruby reads a mode (`{mode: ...}`, anchors, tags, `%YAML`, a trailing `...`) fail closed.
- The clause variant of open decision g (product names case-sensitive, `AI`, `A.I.` and `LLMs?` in any case but not after a `.`, `generative AI` as a phrase) ran in the implementation. All 14 clause lines from the plan, plus "ai tools are banned", "See example.ai", "generative grammar" and "llms are banned", give the expected result. "Claude Monet painting" still warns, as accepted.

## Event model

Skip. Internal tooling, no journey, as plan 65.

## Diagrams

No diagrams: no trigger fired.

## Out of scope

- A general YAML parser. #66 may add its own strict `.ai/kanon.yml` parser. This plan's reader is the floor it must stay inside.
- `SKILL.md` and `README.md` (#66 owns them). No line there becomes false: the record form's scan is unchanged.
- Normalising repo names from URLs.
- A freshness check inside the script. The playbook's fetch owns freshness.

## Risks

- The strict reader stops on YAML a person may write by hand (flow mappings, anchors). That is the intent. The stop names the reason.
- Changing `models` to explicit `-*` prefixes stops any record already filled with a bare `claude`. The stop names `models`.
- The scan's `.github`/`docs` reads through git cost two `ls-tree` calls and one `cat-file` per policy file. The prototype took about 15 ms each.

## Open decisions

The owner chose A on every decision (2026-11-24).

a. Kind.
   - **A. Bug fix (recommended).** Most bullets make the check fail open. One failing-test commit holds every new test.
   - B. Feature. No test-first commit.

b. A failed fetch in "Fetch first".
   - **A. Retry once, then its own stop (recommended).** Options: the owner fixes git access for the checkout and removes `needs-decision`; the owner closes the issue.
   - B. Like Docker down: release the claim, no labels, retry next tick. A lasting auth failure then loops hourly with no inbox entry.
   - C. Its own stop at once, no retry.

c. An empty `mode:`.
   - **A. Stop on `mode` with reason `empty` (recommended).** Fails closed, clearer reason.
   - B. Canon-first, as YAML reads null.

d. Where the scan reads.
   - **A. The registry form reads origin/main through git, the record form stays on the working tree (recommended).** Matches the mode read in factory runs. `SKILL.md:36-39` stays true.
   - B. Both forms through git. One source, but the skill then needs `origin/main` and `SKILL.md:39` changes.
   - C. Both on the working tree, documented.

e. `--repo-name` and registry key forms.
   - **A. Strict: both must be `owner/name`, else exit 2 or a stop (recommended).**
   - B. Normalise both (trim, drop `.git` and a trailing slash, parse GitHub URLs).

f. Pinning one model.
   - **A. `-*` marks a prefix, anything else is exact (recommended).** Breaks bare `claude` entries, which then stop.
   - B. Keep bare entries as prefixes, add `=id` for exact. Back-compatible, odd syntax.
   - C. No change.

g. Clause false positives.
   - **A. Product names case-sensitive, `AI`/`LLM` any case but not after a `.`, `generative AI` as a phrase (recommended).**
   - B. Drop `Cursor` and `Claude` from the list.
   - C. No change. Warnings never stop.

h. Prompt order test in `install.test.mjs`, outside the brief's file list.
   - **A. Add it (recommended).**
   - B. Skip it.
