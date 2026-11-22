# Plan for #31, pick-up.mjs attempt number for a retried issue

Issue codysseydev/codyssey-skills#31. Base origin/main ad19dcd. Branch `factory/31`.

## Goal

`claim` works out the attempt number from the issue timeline and hands it on. It writes it to `claim.json`, returns it in the claim output and sends it in the `claimed` run event. The session uses it for the branch, the evidence dir and every `report_stage` event.

## Problem

`playbooks/factory.md` assumes an attempt number that nothing computes. The issue's line numbers are out of date. At ad19dcd:

- `:88` "A retry starts a new branch (`factory/<issue>-a2`) with `attempt: 2`".
- `:81` and `:102` name the evidence dir `~/.factory/evidence/<owner>-<repo>-<issue>-a<attempt>/`.
- `:122` every `report_stage` event carries `attempt` (default 1).
- `:30` ends "The next tick then starts attempt 2 as stage 5 describes".
- `:94` the archive run takes the attempt from the merged PR's head branch.

`pick-up.mjs` has no attempt anywhere:

- `cmdClaim` writes `claim.json` with `repo, issue, action, run_id, claimed_at` (`playbooks/scripts/pick-up.mjs:538-541`).
- It returns `status, repo, issue, title, action, run_id, dry_run, dashboard, stale` (`:558-568`).
- It sends `run_id, repo, issue_number, event, action, occurred_at` (`:555-557`, shape comment `:231`).
- The installed task prompt (`~/.claude/scheduled-tasks/factory-pickup/SKILL.md` step 5, read 2026-11-23) passes repo, issue and action to the session. No attempt.

The issue says no retry has happened yet. One has. #26 got `factory-failed` at 2026-11-22T19:51:23Z, lost it at 20:26:40Z, and `factory/26-a2` is on origin. That session worked out the number by itself.

## Behaviour

| Case | Today | After |
|---|---|---|
| first claim, no `factory-failed` ever added | no attempt anywhere | `attempt: 1` |
| `factory-failed` added once, then removed by the owner (#26) | no attempt, session guesses | `attempt: 2` |
| added twice | no attempt | `attempt: 3` |
| timeline unreadable | not read | open decision 1 |
| `claim --dry-run` | no attempt in output | `attempt` in output |

Only additions count. `unlabeled` events are ignored, as the issue says.

## Data shape

Timeline, `gh api --paginate --slurp repos/<repo>/issues/<n>/timeline?per_page=100`, then `.flat()`. This is the `list` call at `:156`, already tested at `pick-up.test.mjs:450`. Probes (gh 2.105.0, run for this plan):

- A `labeled` event has keys `actor, commit_id, commit_url, created_at, event, id, intent, label, node_id, performed_via_github_app, url`. `label.name` holds the name. A `commented` event has no `label`, so read `e.label?.name`.
- #31 gives `labeled factory`, `labeled factory-running`, `commented`. Attempt 1.
- #26 at `per_page=5` gives 7 pages (5,5,5,5,5,5,1). After `--slurp` and `.flat()`, one `factory-failed` addition. Attempt 2, which matches `factory/26-a2`.
- Without `--slurp`, gh 2.105.0 merged the pages into one array of 31. With `--jq`, jq runs once per page and printed seven counts (`0 0 0 1 0 0 0`). So keep `--slurp` and count in JS.

```js
// claim.json
{ "repo": "o/r", "issue": 26, "action": "implement", "attempt": 2, "run_id": "…", "claimed_at": "…" }
// claim output
{ "status": "claimed", "repo": "o/r", "issue": 26, "title": "…", "action": "implement", "attempt": 2,
  "run_id": "…", "dry_run": false, "dashboard": "sent", "stale": [] }
// claimed run event
{ "run_id": "…", "repo": "o/r", "issue_number": 26, "event": "claimed", "action": "implement", "attempt": 2, "occurred_at": "…" }
```

Branch for the session: `factory/<issue>` for attempt 1, `factory/<issue>-a<n>` from attempt 2.

Dashboard (no request sent). `codyssey-factory-dashboard` origin/main c7706b3, read with `git show`; the local main is 44 behind. `POST /api/runs` returns 400 only when `parseRunEvent` fails (`app/api/runs/route.ts:28-29`). The yup schema (`src/run-event.ts:31-64`) sets no `noUnknown`. `parseRunEvent` (`:72-86`) returns only the named fields. `migrations/0003_runs.sql` has no `attempt` column. A scratchpad probe ran that schema with the installed yup 1.7.1 and `{ strict: true, abortEarly: false }`: `attempt: 2` passes. So the dashboard accepts `attempt` and drops it. It goes in the event, per the issue. That the deployed Worker matches origin/main is inferred, not checked.

## Changes

### `playbooks/scripts/pick-up.mjs`

- `makeGh` gets `timeline(repo, n)`. It runs the call above and returns the flat event array. It throws when gh throws, when the output does not parse, or when the result is not an array. It does not copy the `|| '[]'` fallback from `:156`, because empty output would read as attempt 1.
- New export `attemptFromTimeline(events)`: `1 +` the count of events with `event === 'labeled'` and `label?.name === FAILED`. Pure, next to `evaluateIssue`.
- `cmdClaim` (`:527-569`). Read the timeline for the issue it is about to claim, then add `attempt` to `claim.json` (`:540`), to the `claimed` event (`:556`) and to the output (`:558-568`). Where the read sits and what a failure does is open decision 1.
- Usage header (`:6`, `:10`) and the event shape comment (`:231`) name `attempt`.
- Unchanged. The claim comment text (`:547`), `release`, the stale sweep and its `expired` event.

### `playbooks/scripts/pick-up.test.mjs`

- `fake()` (`:25`) takes `timelines = {}` and its gh gets `timeline: rec('timeline', (repo, n) => timelines[`${repo}#${n}`] ?? [])`. The default of zero additions keeps every existing claim test valid.
- `claim posts claimed …` (`:620`) asserts the event with `deepEqual`, so it gains `attempt: 1`.

### `playbooks/factory.md`

- "Scheduled pick-up", after the "Claim is the atomic lock dir" bullet (`:25`). New bullet: claim sets `attempt` to 1 plus the number of `factory-failed` additions in the issue timeline, removals not counted. It writes it to `claim.json`, returns it and sends it in the `claimed` event. The task prompt passes it to the session. The unreadable case per decision 1.
- `:30`, last sentence. "The next claim then counts it as attempt 2 (see the attempt bullet above)."
- Stage 5, `:88`. "A retry is the next attempt, numbered by `claim` (Scheduled pick-up). Attempt n from 2 works on a new branch `factory/<issue>-a<n>` and reports `attempt: n`. Its first message quotes the last failure and the owner's note."
- Stage 8, `:94`, per decision 2.

### Task prompt (owner follow-up in the PR body)

#32 ("Version the factory-pickup task prompt in this repo") is open, and origin/main has no versioned prompt (`git ls-tree` finds none; `README.md:142` points at factory.md). So the change goes in the PR body for the owner to make in `~/.claude/scheduled-tasks/factory-pickup/SKILL.md`, linking #32:

- Step 4. "Your final message is one line naming the status, the `reason` when the JSON has one, and the number of stale entries reported."
- Step 5. "The JSON names repo, issue, action and attempt." The poteto-mode task gains: "Attempt <attempt>. Use it in every `report_stage` event and in the evidence dir. The branch is `factory/<issue>` for attempt 1 and `factory/<issue>-a<attempt>` from attempt 2."

## Tests, one per acceptance criterion

All in `playbooks/scripts/pick-up.test.mjs`. Each fails at base, where neither export nor field exists.

| Criterion | Test | Checks |
|---|---|---|
| 0, 1, 2 earlier additions | `attemptFromTimeline counts factory-failed additions only` | 0, 1, 2 `labeled factory-failed` give 1, 2, 3. An `unlabeled factory-failed`, a `labeled factory` and a `commented` event with no `label` change nothing |
| same, through claim | `claim returns attempt 1, 2 and 3 from the timeline` | `cmdClaim` with fake timelines of 0, 1, 2 additions. `out.attempt` is 1, 2, 3 |
| unreadable timeline | `claim with an unreadable timeline …` | fake `timeline` throws. Asserts the behaviour decision 1 picks: lock, labels, comment, output, `stale` kept |
| `--dry-run` shows attempt | `dry-run claim returns attempt` | `dryRun: true`, timeline with one addition, `out.attempt === 2`, `out.dry_run === true` |
| `claim.json` and output | `claim writes attempt to claim.json, the output and the claimed event` | one addition. `claim.json.attempt`, `out.attempt` and `events[0].attempt` are all 2 |
| boundary | `makeGh timeline flattens pages and rejects bad output` | fake `run` in the style of `:450`. Args are `['api', '--paginate', '--slurp', 'repos/o/r/issues/2/timeline?per_page=100']`. Two pages flatten. Empty output, non-JSON and a non-array throw |

factory.md and the task prompt follow-up are checked by reading the diff and the PR body.

## Gates

From the worktree root, at the head commit, clean tree. The nine checks in `.factory/recipe.yml`. Baseline at ad19dcd, all exit 0:

| Check | Command | Base |
|---|---|---|
| pick-up-tests | `node --test playbooks/scripts/pick-up.test.mjs` | 99 pass |
| post-merge-tests | `node --test playbooks/scripts/post-merge.test.mjs` | 23 pass |
| capture-ui-tests | `node --test playbooks/scripts/capture-ui.test.mjs` | 115 pass |
| trial-decision-tests | `node --test playbooks/scripts/trial-decision.test.mjs` | 39 pass |
| test-first-tests | `node --test playbooks/scripts/test-first.test.mjs` | 36 pass |
| bootstrap-tests | `python3 -m unittest discover -s factory/bootstrap/tests` | 3 OK |
| event-model-tests | `python3 -m unittest discover -s factory/event-model/tests` | 4 OK |
| factory-onboard-tests | `python3 -m unittest discover -s factory/factory-onboard/tests` | 28 OK |
| install-tests | `node --test playbooks/scripts/install.test.mjs` | 22 pass |

Live probe, read-only: `makeGh().timeline` plus `attemptFromTimeline` on codyssey-skills #26 gives 2 and #31 gives 1. A live `claim --dry-run` is not run, because it adds `factory-running` for real (`pick-up.test.mjs:531`).

## Out of scope

- The give-up rule and dashboard changes, per the issue. Storing `attempt` needs a dashboard column; a follow-up issue there if the owner wants it on `/runs`.
- `attempt` in `claimed` comments, `released` and `expired` events. Not asked.
- How attempt n carries an approved plan from `factory/<issue>` to its new branch. `factory/26-a2` re-committed the plan (55c785c).
- Event model and UI evidence. This repo has no journey file, and origin/main has no `.factory/ui-capture.json`.

## Risks

- A re-added label. When an `expired/` folder is retaken while the issue still has `factory-failed` (test `:1002`), the sweep calls `addLabel` for it again (`:484`). Whether GitHub records a second `labeled` event was not checked, since that writes to GitHub. If it does, that attempt counts one too many. Counting absent-to-present transitions instead would close it.
- The timeline call runs once per claim, 1 or 2 pages at `per_page=100`.

## Open decisions

1. The timeline cannot be read.
   - **A. Skip the issue and report a reason (Recommended).** The read runs before `mkdirSync` (`:530`), so a failure leaves no lock, no label and no comment. Claim stops there and returns `{ status: 'none', reason: 'attempt unknown for <repo>#<n>: <short error>', stale }`, the shape `--only` already uses (`:524`). It does not try the next issue, since a timeline failure is most likely gh-wide. The issue stays eligible for the next tick. The stale entries still reach the session. Cost: today step 4 of the task prompt prints only the status, so the reason shows once the step 4 follow-up lands. Reason: a wrong number is worse than a lost hour.
   - **B. Claim with attempt 1 and say so.** Lock, label and comment as today, plus `attempt: 1` and `attempt_error: '<short error>'` in `claim.json` and the output. Cost: on a real retry the session reuses `factory/<issue>`, which exists on origin (for #26, `factory/26`), and the attempt 1 evidence dir. That breaks stage 1's "stay blind to its diff" (`factory.md:74`) and overwrites the first `evidence.json`.
   - **C. Throw, as a label failure does.** The read runs inside the `try` (`:537-552`). The catch removes the lock (`:549-551`), no label is added, exit 1. Task step 2 ends the run with "pick-up error" and quotes it, so the owner sees it. Cost: step 2 reports nothing, so this tick's `stale` entries, already marked `factory-failed` at `:484`, get no `failed` event. Today's label failure has the same cost (test `:555`).
2. The attempt for an `archive` claim. A crashed archive run gets `factory-failed` from the sweep. After the owner removes it, claim counts 2, but the merged PR came from `factory/<issue>` (attempt 1). `factory.md:94` reads the attempt from the merged PR's head branch.
   - **A. The branch wins for archive (Recommended).** Claim returns the count for every action. Stage 8 adds one sentence: for `archive`, use the attempt from the merged PR's head branch in every `report_stage` event and for the evidence dir, not the claim's number. No code branch on action. Reason: the evidence dir to remove belongs to the attempt that merged.
   - **B. No attempt for archive.** Claim omits `attempt` when the action is `archive`. The output shape then depends on the action, and the `claimed` event for archive has none.
   - **C. Claim reads the branch for archive.** Claim calls `closedByPullRequestsReferences` and parses the head branch. One more gh call and parser for a case `:94` already covers.
