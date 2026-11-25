---
name: standards-discovery
description: >-
  Reads a client's codebase and writes its conventions as a standards report and a project
  overlay (`.ai/kanon.yml` with `mode: project-first`, plus prose rules in `.ai/rules/project/`),
  for repos in project-first mode. It checks the client's AI policy record first, lists what may be
  read, checks every citation and Kanon rule name with scripts, and places the files on a branch
  or in the client's brain. Use it when the user invokes /standards-discovery, or asks to discover,
  document or extract the standards of a client's codebase, or to check a client's AI policy record
  before reading their code. Not for repos in canon-first mode (the default: no `.ai/kanon.yml`,
  or no `mode:` key in it), where the Kanon applies as written.
---

# Standards discovery

Project-first mode treats a client's own conventions as the standard. Before any client code is read, a policy record says whether AI may touch the repo. This skill runs that check first. A missing record, an incomplete record or a record that forbids the step stops the run, and the stop names the field that blocks. After the check it reads the repo, writes a standards report and a project overlay, proves them with scripts, and places them where the record allows.

## Inputs

- The policy record's path. It lives in the client's brain (the owner's notes for that client), not in the client's repo. `references/policy-record.md` has the template.
- The repo path.
- The model id of this session.
- A work folder in the client's brain, for example `<brain>/standards-discovery/<client>/`. Every file this skill writes goes there first.

The work folder ends up holding:

```
policy.json
inventory.json
standards-report.md
.ai/kanon.yml
.ai/rules/project/*.md
```

## Step 1: the policy check

Run this before reading anything in the repo:

```
python3 <skill dir>/scripts/check-policy.py --record <record> --repo <repo> --model <model id> > <work>/policy.json
```

The script prints one JSON object and exits 0, 1 or 2.

- Exit 1 (`stop`): report each entry of `blocking` with its field and reason. Read nothing else in the repo. Stop.
- Exit 0 (`continue`): keep `warnings` for the standards report. A `symlink` or `unreadable` warning names a policy file the check did not read. The ignore files themselves are applied by the inventory, from the commit it reads.
- Exit 2: the command was wrong. Fix the arguments.

On `continue` the script has opened only `.aiignore`, `.cursorignore`, the root `README`, and `CONTRIBUTING` at the root, in `.github/` and in `docs/`. A warning is not a stop. It is a line in the report for the owner to read.

## Step 2: the inventory

```
python3 <skill dir>/scripts/inventory.py --policy <work>/policy.json --repo <repo> > <work>/inventory.json
```

The script reads the tracked files through git and prints the paths that may be read, by kind, plus `ignored`, sibling files, the last commit subjects, the branch names and `read_at`, the commit all later checks use. It reads `.aiignore` and `.cursorignore` from `read_at`, matches each file's patterns with git's own matcher, and joins the results, so a `!` line in one file cannot bring back what the other hides. `--repo` is the top level of the checkout, not a folder inside it.

- `no-code`: the tracked tree has no source file and no rule source. Tell the owner the repo stays canon-first until the client has rules of their own. Write no overlay. Stop.
- Exit 1 (`stop`): an ignore file at `read_at` is a symlink, a folder or a gitlink, so its patterns are unknown; a working-tree `.aiignore` or `.cursorignore` differs from `read_at`; a listed file differs from `HEAD`; or `--repo` is not the top level. Report the reason. Ask the owner to fix the cause, then rerun.
- Exit 0 (`inventory`): go on.

## Step 3: read

Read every path in `sources` and `siblings`, and the commit and branch lists. Never read a path in `ignored`, and never a path outside the inventory. Note each convention with `file:line` and a short quote. `references/reading.md` says what to look for in each kind of source.

## Step 4: map to the Kanon

Read the Kanon from `<skill dir>/kanon/`: `catalog/families.json` lists the families and their reference files, and `catalog/` holds the rule IDs. Name each Kanon rule by its ID. For each convention pick one effect: `adopt`, `change`, `off`, or `project-only` when the Kanon has no rule for it. Write three outputs into the work folder:

- `standards-report.md`, following `references/standards-report.md`.
- `.ai/kanon.yml`, following `references/overlay.md`. Write `mode: project-first`. Quote `'off'`.
- `.ai/rules/project/<topic>.md` for each `change`, and for each `project-only` convention the code shows but nothing writes down.

## Step 5: check

```
python3 <skill dir>/scripts/check-overlay.py --work <work> --repo <repo>
```

It prints `ok` or every problem with where it is. Fix the drafts and rerun until it exits 0. It proves the overlay matches the schema, every entry names a real Kanon rule, every citation resolves in the repo at `read_at` and names a path the inventory lists there, and the report and the overlay agree. It recomputes that list from the repo and does not trust the lists in `inventory.json`. It cannot prove a convention is right, so review the rows you are least sure of.

## Step 6: place

Pass `--branch` and `--subject` in the client's own style, read from `commit_subjects` and `branches` in `inventory.json`.

```
python3 <skill dir>/scripts/place-overlay.py place --record <record> --model <model id> --work <work> --repo <repo> --branch <name> --subject <subject>
```

The script reruns the policy check and the overlay check, then reads `commit_ai_files` from the record.

- `yes`: it makes the branch in a temporary worktree, with one commit holding `.ai/kanon.yml`, `.ai/rules/project/` and `.ai/standards-report.md`. The owner's checkout keeps its branch, `HEAD` and uncommitted files. Ask the owner before the push and the PR, because both reach the client.
- `no`: it writes nothing under the repo. The files stay in the work folder. Tell the owner that `place-overlay.py load` with the same `--record`, `--model`, `--work` and `--repo` copies the overlay into the working tree and adds two lines to `.git/info/exclude`, so `git status` stays empty. `load` stops when a target path is tracked, already exists with other content, or sits behind a symlink or a file, and when the record says `yes`.
- Exit 1: the record, the overlay check or a branch of that name blocks. Report it.

When the overlay lands on origin/main, the repo is project-first, and factory runs on it stop on `record` until the owner's registry has an entry for the client. Tell the owner.
