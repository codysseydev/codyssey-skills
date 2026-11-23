---
name: standards-discovery
description: >-
  Reads a client's codebase and writes its conventions as a project overlay, for repos in
  project-first mode. Today only the first step is built: the AI policy check, which decides
  whether the client's code may be read at all. Use it when the user invokes
  /standards-discovery, or asks to discover, document or extract the standards of a client's
  codebase, or to check a client's AI policy record before reading their code. Not for repos in
  canon-first mode (the default: no `.ai/kanon.yml`, or no `mode:` key in it), where the Kanon
  applies as written. Discovery, the standards report and the overlay writer come later.
---

# Standards discovery

Project-first mode treats a client's own conventions as the standard. Before any client code is read, a policy record says whether AI may touch the repo. This skill runs that check first. A missing record, an incomplete record or a record that forbids the step stops the run, and the stop names the field that blocks.

Only step 1 exists today.

## Inputs

- The policy record's path. It lives in the client's brain (the owner's notes for that client), not in the client's repo. `references/policy-record.md` has the template.
- The repo path.
- The model id of this session.

## Step 1: the policy check

Run this before reading anything in the repo:

```
python3 <skill dir>/scripts/check-policy.py --record <record> --repo <repo> --model <model id>
```

The script prints one JSON object and exits 0, 1 or 2.

- Exit 1 (`stop`): report each entry of `blocking` with its field and reason. Read nothing else in the repo. Stop.
- Exit 0 (`continue`): keep `warnings` for the standards report. Treat the patterns of each `ignore-file` warning as paths not to read in later steps. A `symlink` or `unreadable` warning names a policy file the check did not read.
- Exit 2: the command was wrong. Fix the arguments.

On `continue` the script has opened only `.aiignore`, `.cursorignore`, the root `README`, and `CONTRIBUTING` at the root, in `.github/` and in `docs/`. A warning is not a stop. It is a line in the report for the owner to read.

## Step 2 onward

Discovery, the standards report and the overlay writer come in a later change. Stop after step 1.
