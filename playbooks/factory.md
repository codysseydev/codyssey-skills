---
extends: feature, bug-fix, opening-a-pr, babysit
when: Taking one GitHub issue labelled `factory` from pick-up to merged code in a factory run.
---

This playbook applies only to an issue that carries the `factory` label. Ignore this file for any other task.

### Factory run

**You own one issue from pick-up to archive.** Report each stage to the dashboard, pause at the five stops, and keep a count of every time you needed the owner.

#### Mode

- Unattended (a scheduled run): between the stops, do not ask. Go ahead on reversible work and report it (never block on the human). At a stop, or when you cannot write an acceptance check from the issue text alone, post ONE comment on the issue with 2 or 3 concrete options, add `needs-decision` (or the stop's own label), report a `waiting` stage with the question, and stop.
- Interactive (hand-started): every decision goes through AskUserQuestion with the recommendation first, as the owner's global instructions say.
- Both modes count every ask (see Counting the owner).

#### Before the run

- Enter through PStack's poteto-mode.
- From the repo root run `node <pstack plugin>/skills/poteto-mode/scripts/check-playbooks.mjs`. If it prints any problem, do not start. Open a `factory` issue in `codysseydev/codyssey-skills` to fix the anchors.
- Backend setup, gates and scaffolding for the Codyssey backend are in `references/codyssey.md`.

#### The five stops

- **Brief.** Belongs to brief-writer. It does not apply to an existing issue.
- **Plan approval.** The owner swaps `needs-plan-approval` for `plan-approved` on the issue.
- **Rule conflicts.** Two rules disagree, for example a Kanon rule against a project rule. Waiting reason `rule_conflict`.
- **ADR.** A decision outlives the change. The owner reads and approves the ADR. Waiting reason `adr`.
- **Merge.** The owner reads the diff and merges.

#### Labels

- `factory`: picked up. `needs-plan-approval`, `plan-approved`, `needs-decision`.
- `factory-failed`: the run gave up, so it does not loop.
- Create a missing label at pick-up. It is reversible.
- At archive remove `plan-approved` and keep `factory`.

#### Stages

Run these in order. Each names what to do and the `report_stage` call. Each event carries a one-line summary.

1. Pick-up. The issue has `factory`, no `factory-failed`, and every issue on its `Depends on:` line is merged or closed. Read the product's brain vault before planning: brief, glossary, decisions, event model. If the issue has an earlier attempt (for example a parked draft PR), stay blind to its diff until your own gates pass, and compare only then. Report `triage`.
2. Plan. Explore the code and write the plan in the repo's own planning format (an OpenSpec change where the repo uses it). Extend the journey file and sync its boards with the `event-model` skill. Put every first answer against the code before asking for approval: run 1 had 4 first answers fail once the OpenSpec draft met the code, and 9 of its 18 plan-stage questions came from that. Push the branch. Post the plan as an issue comment with the branch link and the changed boards, and add `needs-plan-approval`. Report `plan`, then `waiting` with reason `plan_approval`, and stop. No PR before approval.
3. Scaffold. Use the repo's own scaffolding commands or skills, named in its CLAUDE.md. Never hand-roll a generator the repo forbids. Report under `implement`.
4. Implement. Resume when `plan-approved` is on the issue. Use ONE prepared worktree (own dependencies, env file, test database). File-writing delegates take turns in it, one at a time. Read-only delegates may run in parallel. Report `implement`.
5. Gates. Run the repo's `.factory/recipe.yml` checks when it has one, else the repo's preflight gates. Evidence is taken at the head commit from a clean tree: a table of gate, command, exit code and result, plus the head sha. A new push needs new evidence. When GitHub Actions cannot run (billing, no minutes), the local evidence stands in for CI and the PR says so.
   - Reviews: give the reviewers only the diff, not your conclusions. Confirm each reviewer ran its per-rule-family fan-out, and record which rule families it read and which it did not. Run 1's first codyssey-reviewer pass skipped its fan-out and six families and had to be repeated. Run the Kanon audit too.
   - A conflict between rules goes to the rule conflicts stop: report `waiting` with reason `rule_conflict`.
   - Trusted-commands guard: flag in the PR any edit to `.factory/recipe.yml`, phpstan, phparkitect, phpunit or rector configs, composer scripts, `.ai/rules/` or CI files.
   - Give up after three fix rounds: add `factory-failed` and report `failed` with the reason. A retry starts a new branch (`factory/<issue>-a2`) with `attempt: 2`, and its first message quotes the last failure and the owner's note.
   - Report `verify`.
6. ADR. When a decision outlives the change, draft the ADR, report `waiting` with reason `adr`, and wait for the owner's approval before it is accepted.
7. PR. Ready, never draft. Add `## Merge assessment` after `## Verification`: how you read the issue, assumptions, confidence and why, rules checked, what was not exercised. Run `/deslop` over the diff before the commit. Unrelated fixes go in their own commits, named under Scope. Out-of-scope findings become follow-up issues. Report `pr` with the merge assessment, then `waiting` with reason `pr_read`.
8. Merge. The run never merges on its own. It merges one PR only when the owner says so for that PR, in the thread or a comment, at its verified head, without bypassing branch protection. Merge has no dashboard event.
9. Archive. Archive the plan (OpenSpec archive) in its own PR, as run 1 did with #911, merged the same way. Record accepted ADRs and new rules, and clean up the labels. Clean up ONLY what the run started: before setup, record which containers or services were already running, and at archive stop only the others (run 1's `spin down` also stopped a MinIO that was up before the run). Drop the run's test databases and remove the worktree's dependencies and env file. Add a build log row in the brain with the final count. Report `archived`.

#### Dashboard events

| Moment | `stage` | `waiting_reason` |
|---|---|---|
| Pick-up | `triage` | none |
| Plan written | `plan`, then `waiting` | `plan_approval` |
| Scaffold, implement | `implement` | none |
| Gates | `verify` | none |
| PR opened | `pr`, then `waiting` | `pr_read` |
| Merge | no event | none |
| Archive | `archived` | none |
| A question to the owner | `waiting` | `question` |
| Rule conflict | `waiting` | `rule_conflict` |
| ADR | `waiting` | `adr` |
| Gave up | `failed` | none |

- Fields: `repo` (`owner/name`), `issue_number`, `attempt` (default 1), `stage`, `summary` (up to 2000 characters), and optional `waiting_reason`, `question`, `merge_assessment`, `session_id`, `model`, `cost_usd`.
- A `waiting` event needs `waiting_reason` and carries `question` as `{text, options}` with 2 or 3 options. No other stage carries a `waiting_reason`.
- The `pr` event carries `merge_assessment` as `{reading, assumptions[], confidence (low, medium or high), why, rules[]}`.
- Call the `report_stage` MCP tool when it is registered. When it is not, run `node scripts/send-stage.mjs '<json>'` from a subagent, with `FACTORY_DASHBOARD_URL` and `FACTORY_INGEST_TOKEN` set by the dashboard's wrapper and `FACTORY_DASHBOARD_REPO` pointing at the dashboard checkout. Name these variables, never write a token anywhere.

#### Counting the owner

Keep a running list in the run's notes of every time the run needed the owner, in four kinds:

- Manual steps, for example adding a label before the run.
- Answers given outside questions: label swaps, "merge it" instructions.
- Question rounds.
- Questions per round.

Put the running totals in every `waiting` event summary, in the final report and in the build log row. Run 1 for reference: 34 in all (1 manual step, 3 answers outside questions, 30 questions in 11 rounds), 4 of 5 stops reached.

#### Changes to the bundled steps

- **Before** "Trace the affected subsystem." run stages 1 and 2 above. The brief stop and the plan stop come before any code.
- **Replace** "Give every file-writing delegate its own worktree" with: use the one prepared worktree from stage 4, and file-writing delegates take turns in it one at a time. Drop the sentence's parenthetical about `isolation` and exclusive branches. Keep its rule not to write files or run a suite in the worktree while a delegate still holds it.
- **After** "Verify on the matching surface" run stage 5 (gates and reviews).
- **In** "Rebase into small, ordered commits." the branch is already pushed at the plan stage, so never rebase or force-push it. Commit in small, ordered commits as you go.
- **In** "Rebase into small, landable commits." the same applies: do not rebase a pushed branch.
- **In** "Run `/deslop` over the diff before commit." the pass is required for a factory PR. Record in the run's notes that it ran.
- **Replace** "under 40 lines" with: under 60 lines for a factory PR.
- **After** "`## Blast Radius`, `## Verification`" add `## Merge assessment` (stage 7), and put the trusted-commands flag under Blast Radius.
- **After** "Opening a PR does not start a babysit." report `pr`, then `waiting` with reason `pr_read` (stage 7).
- **Replace** "Report a conflict or a stale base with the branch that needs the rebase, and stop." with: on a merge conflict, merge the base branch into the PR branch, resolve it, and rerun every gate for new evidence. Never rebase or force-push a pushed branch.
- **In** "A conflict and the watcher's `behind-base` gate are the two blockers you report rather than resolve." a conflict follows the rule above. `behind-base` stays as the bundled step says: name the branch that needs its base brought in, and stop.
- **In** "Owner approval is a wait. Babysitting never authorizes merging." only the owner's word for that one PR authorizes a merge (stage 8).
