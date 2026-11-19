---
name: brief-to-backlog
description: Turn an approved product brief into a backlog of GitHub issues labeled `factory`, one per feature, in dependency order, each with checkable acceptance criteria and a machine-readable `Depends on:` line. Supports a dry run that writes drafts to a markdown file and touches nothing on GitHub. Use after the brief is approved, or when a phase is added to one. Not for writing the brief (use brief-writer) and not for implementing issues.
---

# Brief to backlog

Convert an approved brief into GitHub issues. A scheduler picks up open `factory` issues whose dependencies are merged, so every issue states its dependencies in a parseable line. An agent that cannot write an acceptance check from the issue text alone will stop and ask, so every issue carries checks it can run.

## Inputs

- Brief path.
- Target repos as `owner/name`. One product can have several (for example an API repo and a web repo).
- `--dry-run <file>`: write the drafts to that file, make no GitHub calls.

## Refuse an unapproved brief

The brief must have a line `Approved: YYYY-MM-DD`. If it does not, stop and tell the user to run brief-writer and approve it first.

A line ending in `(simulated)` counts only with `--dry-run`. In real mode, refuse it and say a human must approve the brief first.

## Read

- The brief: requirements `R`, features `F`, phases, non-goals, open questions `Q`.
- If present in the brief's folder or its brain vault: the glossary, domain design and ADRs. Use the domain's words in titles and bodies. Do not copy design into issues.

## Split

- One issue per feature per repository it touches.
- A feature that spans two repos becomes one issue per repo, linked in each body ("Pair: #N" or "Pair: D4"). "Pair:" is a link, not a dependency: each paired issue keeps its own dependency edge in the breakdown table.
- Dependencies follow what is needed to run the acceptance check. An issue depends on every issue whose output its checks need.
- Merge features that share one screen and one request pair in the same repo into one issue. Split only when a feature can ship and be checked alone.
- Each issue is a vertical slice: the outcome end to end, not one layer.
- If the target repo plans changes before code (a spec or proposal folder, an RFC folder, a design-doc step), default to one issue that produces both the spec and the code, run by the per-issue loop's own plan step, and say so in the issue body. Add a separate spec issue first only when the user asks for it.
- When a criterion reads or writes a "setting" or other state, decide which repo owns it from the brief and the repos' docs, and say so in the body. If that is unclear, it is an open question.
- Order issues by phase, then by dependency. Phase 1 first.

## Issue template

Title: `<Feature ID> <outcome in the domain's words>`, plus ` (<repo>)` with the bare repo name, not owner/name, when the feature has more than one issue.

```markdown
Brief feature: F1.2, phase 1
Requirements: R2, R5

## What to build
The outcome end to end, in words a user would use. No file paths, no tables, no classes.

## Acceptance criteria
- [ ] Observable check, including the main path.
- [ ] Observable check for a negative case (bad input, missing permission, replay, empty state).

## Out of scope
- Relevant non-goals from the brief, each with its reason.

Depends on: #12, #15

## Open questions
- Q3: question text. Decides: <who>. Decision: <filled in when the plan settles it>
  (or "none")
```

Rules for the body:

- Every criterion can be checked from outside the code: a request and its response, a screen, a file, a message. No criterion says "clean" or "well tested".
- At least one negative case per issue.
- The `Depends on:` line has exactly this form: `Depends on: #12, #15` or `Depends on: none`. In a dry run use draft IDs: `Depends on: D3, D5`. It sits on its own line.
- Each carried open question names who decides it. The issue gets a `Decision:` line, filled in when the plan settles the question, so the question closes on the issue.
- A question that blocks only an edge case: keep the main criteria and write the edge case as a criterion marked "pending Q<n>". Add `needs-decision` (as well as `factory`) only when the question blocks the main path, meaning no acceptance check can be written for it.
- Labels: `factory`, plus `needs-decision` when needed. Do not add others.

## Approve the breakdown first

Before any file or GitHub write, show a table and ask the user to approve it through AskUserQuestion (approve, change, cancel):

| Draft ID | Title | Repo | Depends on | Requirements |
|---|---|---|---|---|

Apply changes the user asks for and show it again.

## Checks

Run these on the approved breakdown and fix or report failures before writing:

1. Every requirement is covered by at least one issue.
2. Every issue traces to a brief feature, and every brief feature has an issue.
3. No dependency cycles.
4. Every issue has at least one acceptance check and one negative case.
5. Phase order holds: no issue depends on an issue from a later phase.
6. Every release-order or operator step (keys, config, feature cutoff, rollout order, secrets) has an owner: a `Depends on:` line, or a checklist item under a `## Release steps` section on one named issue.

## Dry run

Write the file given to `--dry-run`. The caller may have put its own header (title, tags) there already: keep it and write your content after it. For each draft: draft ID, repo, title, labels, then the body. End with the coverage table (requirement to issue IDs). Make no `gh` calls and do not edit the brief.

## Real mode

1. Check `gh auth status`. Stop if it fails.
2. For each repo, create the label if missing: `gh label create factory --repo <repo> --description "Picked up by the software factory" --color 0E8A16`. Create `needs-decision` the same way when any issue needs it.
3. Create issues in dependency order so `Depends on:` holds real numbers. For each: `gh issue create --repo <repo> --title ... --body-file <tmp> --label factory`. Replace draft IDs with the numbers `gh` returned before creating dependents. Paired issues in one feature get each other's number after both exist (`gh issue edit`).
4. Write the issue numbers back into the brief next to each feature ID: `F1.2 (api #14, web #15)`.
5. Report the table: draft ID, issue URL, repo, depends on.

If a `gh` call fails midway, stop, report which issues exist, and do not retry blindly: duplicates are worse than a gap.

## Return

The file or issue list, the coverage table, issues labeled `needs-decision` and why, and anything the checks flagged.
