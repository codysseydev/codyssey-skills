# Plan for #79, factory.md sends gate evidence, owner counts and PR numbers to the dashboard

Issue codysseydev/codyssey-skills#79. Base origin/main 6485e3a, merged with b4123a7 during implement. Branch `factory/79`.

Kind: feature

## Goal

Every factory stage event carries the fields the dashboard reads: `evidence` on the first `verify` event, `owner_count` on every event a run sends for its own issue, and `pr_number` on the `pr` event. The change is prose in `playbooks/factory.md` only.

## What origin/main already says

Most of the issue is already in `playbooks/factory.md`. Line numbers are origin/main 6485e3a. At the branch head the edits sit in stage 5, stage 6, Dashboard events and Counting the owner.

| Issue item | State on origin/main |
|---|---|
| 1. `evidence` on `verify` | Partly. Line 84 defines the shape and `evidence.json`. Line 92 says only "Report `verify`." Line 94 sends `evidence` on `pr`, and on `verify` only after a new push. |
| 2. `owner_count` on `waiting`, `failed`, `archived` | Partly. Line 143 covers `pr` and every `waiting` event. `failed` and `archived` are not covered, and a run that starts at implement or archive is not told where the totals so far come from. |
| 3. `pr_number` on `pr` | Missing. Line 93 sets `pr_number` on the `waiting` event only. |
| 4. Fields line lists the three fields with shapes | Done. Lines 125 and 126. |
| 5. `trial_decision` on `pr` | Done. Trial merge mode exists (line 94), so this is no longer "no change now". |
| 6. `cost_usd` | Open question, answered below. |

## Probes against the live dashboard

`GET https://factory.codyssey.dev/api/stage-events?repo=<repo>` with the ingest token, 2026-11-23 about 19:00 UTC, repos codyssey, codyssey-frontend and codyssey-skills (273 events, all time).

- This run's `triage` event for #79 was sent with `owner_count` all zeros. It came back stored as an object, so dashboard PR #13 (merged 2026-11-23T11:00Z) is deployed.
- `verify`: 40 events, 12 with `evidence`, from 12 issues. Some runs already send it, but the count includes runs from before the field existed, so it does not measure the gap. The gap is the text: line 92 does not ask for `evidence` on the first `verify`, and the dashboard shows `evidence` from any event that carries it, normally `verify` (dashboard `src/lib/evidenceLinks.ts`).
- `pr`: 32 events, 30 with `pr_number`, 10 with `evidence`, `owner_count` and `trial_decision`.
- `failed`: 1 event, 0 with `owner_count`. `archived`: 5 events, 1 with `owner_count`. The dashboard counts owner asks from the latest event of an issue that has an `owner_count`.
- `cost_usd`: the desktop app's `get_usage` tool, called in this session, returns plan-limit percentages (Team plan) and context-window tokens. It returns no dollar figure. A session cannot read its own spend today.

## Change

### `playbooks/factory.md`

1. Line 92, stage 5. Replace the bullet `- Report `verify`.` with the bullet below, at the same three-space indent:

   ```
   - Report `verify` with `evidence` (the `evidence.json` content) and `owner_count`. The dashboard shows `evidence` from any event that carries it, normally `verify` (dashboard `src/lib/evidenceLinks.ts`).
   ```

2. Line 93, stage 6. Replace "Report `pr` with the merge assessment, `evidence`, `owner_count` and `trial_decision` (see the trial bullet below)" with "Report `pr` with the merge assessment, `pr_number` set to the PR's number, `evidence`, `owner_count` and `trial_decision` (see the trial bullet below)".

3. Line 127, Dashboard events. The fallback "Until dashboard PR #13 (codysseydev/codyssey-factory-dashboard) is deployed and the `report_stage` tool accepts these three fields, a call that rejects them is sent again without them, with the trial line in the `summary`." is stale: the tool and the deployed dashboard accept the fields (probe above). Replace it with:

   ```
   - The dashboard validates `evidence`, `owner_count` and `trial_decision` strictly. When a `report_stage` call fails on one of them, fix the field and send the call again. If it still fails, send it without that field and say so in the `summary`.
   ```

4. After the shapes bullet (line 126), add:

   ```
   - `cost_usd` is not sent. A session cannot read its own spend: the desktop app's `get_usage` tool reports plan-limit percentages and context tokens, not dollars.
   ```

5. Line 143, Counting the owner. Replace "They also go in `owner_count` on the `pr` event and on every `waiting` event." with "They also go in `owner_count` on every event a run sends for the issue it claimed, from `triage` to `archived`, because the dashboard counts the latest event that has one. A run that starts at implement or archive is a new session: it starts from the totals on the issue's latest stage event that has an `owner_count` (`GET /api/stage-events?repo=<repo>&issue_number=<n>`), else the owner-count line of the issue's latest factory comment, and adds its own, so a later event never lowers the count. The `failed` event a tick sends for another run's stale lock carries none."

No other file changes. `send-stage.mjs` passes its arguments through, so it needs no change. No ADR: the fields and shapes are the dashboard's contract (dashboard PR #13), and this change only makes the playbook send them.

## Diagrams

No diagrams: no trigger fired. The change adds fields to an existing `report_stage` call. It adds no actor, no status or transition, no new flow across modules or repos, and no new external system or journey.

## Tests, one per acceptance criterion

| # | Criterion | Check |
|---|---|---|
| 1 | Stage 5, stage 6 and Dashboard events name the fields and shapes | `grep -nF` the edited `factory.md` for each new string in Change 1 to 5, and read each hit. `grep -cF "Until dashboard PR #13"` prints 0. |
| 2 | `check-playbooks.mjs` prints no problem | Copy the edited `factory.md` to a temp `$HOME/.agents/playbooks/` and run `HOME=$T node <pstack>/skills/poteto-mode/scripts/check-playbooks.mjs $T`: "Every project playbook matches this pstack's playbooks.", exit 0. No "Changes to the bundled steps" anchor changes, so this is a regression check. The real `~/.agents/playbooks/` is not touched. |
| 3 | The dashboard shows `evidence` on a `verify` event and `owner_count` on `waiting` events | The #79 implement run sends its own `verify` (with `evidence` and `owner_count`) and `waiting` events by the new text, then reads `GET /api/stage-events?repo=codysseydev/codyssey-skills&issue_number=79` and quotes the stored fields under `## Verification`. Runs on other issues pick the text up only after merge and install. |
| 4 | Recipe gates pass | The 12 `.factory/recipe.yml` checks at the head commit, clean tree. |

## Gates

Baseline at 6485e3a, worktree `~/.factory/worktrees/codyssey-skills-79`, clean tree: all nine recipe checks then in `.factory/recipe.yml` exit 0 (pick-up 108, post-merge 23, capture-ui 115, trial-decision 39, test-first 36, install 22 tests pass; bootstrap 3, event-model 4, factory-onboard 28 OK). `check-playbooks.mjs` with the unchanged file: exit 0. After merging origin/main the recipe lists 12 checks: the nine plus standards-discovery-tests, kanon-catalog-check and kanon-catalog-tests.

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
node kanon/scripts/catalog.mjs check --base origin/main
node --test kanon/scripts/catalog.test.mjs
```

Plus the `check-playbooks.mjs` run from criterion 2.

## Implement

One delegate, one worktree (`factory/79`), one file, five edits, no fan-out. Trusted-commands flag: none, since `playbooks/factory.md` is not on the guard's list.

## Out of scope

- Dashboard changes. The contract already accepts every field.
- A `cost_usd` estimate (decision 3).
- The installed `~/.agents/playbooks/factory.md` lags origin/main by the #31 attempt-number change. The tools-lane prompt installs at step 1, so this change reaches runs on the first armed tick after merge.
- Event model. Skip, no journey for internal tooling. This repo has no brain vault of its own.

## Open decisions

1. Where `owner_count` goes. Chosen: every event a run sends for its claimed issue, starting from the totals already on the issue. One rule, and the dashboard's "latest event that has one" reading stays right on any stage. Alternative: only `waiting`, `failed` and `archived`, as the issue lists.
2. The stale fallback at line 127. Chosen: replace it with a rule for a field that fails validation. Alternative: delete it with no replacement.
3. `cost_usd`. Chosen: say in the playbook that it is not sent, and why. Alternative: a follow-up issue for a script that estimates cost from the session transcript's token usage and model prices. On a Team plan that is an estimate, not the spend.

## Review round 1

- Resumed plan runs: every run, whatever action it starts at, reads the totals on the issue before its first event.
- `evidence` is not verify-only: the dashboard shows it from any event that carries it, normally `verify`.
- How to read the totals: a subagent runs the `curl` against the stage-events endpoint with the pick-up URL and token.
- Comment fallback: stop comments end with an `Owner count:` line, so the fallback has something to read.
- The owner action that resumed the run counts as the new run's first entry.
- Dashboard events gets an every-event `owner_count` bullet, with the `failed` stale-lock exception.
- `cost_usd` wording: no tool a run can call returns dollars.
- Validation limits are named, and dropped field content goes in the `summary`.
- The re-sent `verify` carries `pr_number`.
