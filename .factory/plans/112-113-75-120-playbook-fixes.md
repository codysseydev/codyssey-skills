# Plan for #112, #113, #75 and #120, factory playbook fixes

Issues codysseydev/codyssey-skills#112, #113, #75 and #120. Base origin/main 99bd2e6. Branch `factory/113`. One plan, one PR.

Kind (proposed, the owner confirms):

- #112: feature (changes a counting rule, no fault in a rule that was meant to hold)
- #113: bug fix (the playbook reads a good read as failed)
- #75: bug fix (merge-ready is reported while review or merge state blocks)
- #120: feature

## Goal

- #112. A run no longer counts the `plan-approved` label swap or a "merge it" instruction as an answer outside questions, because the dashboard already counts those stops as approvals.
- #113. A run tells "the issue has no events" (failed read) from "the issue has events, none with `owner_count`" (good read, start from zero).
- #75. The factory babysit holds merge-ready on `CHANGES_REQUESTED`, `BLOCKED` and `UNKNOWN`, and says what to do with a `merged` or `closed` watcher row, without stopping stage 8's plan-archive flow.
- #120. `pint.json` is on both trusted-commands lists.

## Data shape

Prose only. Three edits in `playbooks/factory.md` (stage 5 guard line 105, "Counting the owner" lines 157 to 169, the babysit item line 189) and one in `factory/factory-onboard/SKILL.md` (line 80). The one code-like change is the owner-count pipeline's printed shape, `{"events": <n>, "owner_count": <value or null>}`.

## Decisions already made

- #112: option 1, "Stop counting in playbook" (owner, 2026-11-26). The dashboard metric (`src/lib/metrics.ts` in the dashboard repo) stays as it is. This plan does not touch the dashboard.

## Change

### `playbooks/factory.md`, "Counting the owner" (#112 and #113 together)

The section is edited once, with both changes. Other places in the file that name label swaps or "merge it" as owner answers: none. A search for `label swap`, `merge it`, `outside questions` and `answers_outside` finds only line 157 (the list), line 161 (the summary format), line 142 (the field name) and line 169 (Run 1's reference total). The field name stays. Run 1's total (3 answers outside questions) was counted under the old rule, so it stays as a historical figure.

1. Line 157, old:

```
- Answers given outside questions: label swaps, "merge it" instructions.
```

new:

```
- Answers given outside questions, for example the owner's PR comments when removing `needs-pr-read`. The `plan-approved` label swap and a "merge it" instruction are not counted: the dashboard already counts those two stops as approvals.
```

2. Line 161, the paragraph's tail. Old, from "Zero when the issue has none." to the colon:

```
Zero when the issue has none. A `null` is a failed read when the action is `implement` or `archive`, or the attempt is above 1, because an earlier run already sent events with `owner_count`. It reads them through a subagent that runs this with `set -o pipefail`. The URL and token default as shown, the same defaults `pick-up.mjs` uses, and the token is never printed or logged. The pipeline prints the last `owner_count` as JSON, or `null` when the issue has none, and exits non-zero on a failed request or a response without an `events` array:
```

new:

```
Zero when the issue has none. It reads the totals through a subagent that runs this with `set -o pipefail`. The URL and token default as shown, the same defaults `pick-up.mjs` uses, and the token is never printed or logged. The pipeline prints `{"events": <n>, "owner_count": <value or null>}`. `events` is how many stage events the issue has. `owner_count` is the last one any event carries, or `null` when none does. It exits non-zero on a failed request or a response without an `events` array. On `implement`, `archive` or an attempt above 1, an earlier run already sent events, so `events: 0` is a failed read, as is a non-zero exit. Events present with no `owner_count` (they predate it) are a good read: start from zero.
```

3. Lines 163 to 167, the pipeline. Only the `console.log` argument changes. Old: `console.log(JSON.stringify(c?c.owner_count:null))`. New: `console.log(JSON.stringify({events:e.length,owner_count:c?c.owner_count:null}))`.

4. Line 169, old, the first sentence:

```
When the read fails (a non-zero exit), the run sends no `owner_count` until a read succeeds, keeps its own entries, and says so in the summary.
```

new:

```
When the read fails (a non-zero exit, or `events: 0` where line 161 makes that a failure), the run sends no `owner_count` until a read succeeds, keeps its own entries, and says so in the summary. A run whose reads all fail writes the summary line as `Owner count (not in the dashboard total): <m> manual steps, <a> answers outside questions, <r> question rounds, <q> questions.`
```

The rest of line 169 stays.

### `playbooks/factory.md`, babysit item (#75), line 189

The anchor `**In** "On GitHub, status comes from the watcher at"` stays word for word. The sentence about the three gates and the last sentence change. The middle (flags, exit 7 fallback) stays, except the fallback's `gh pr view` fields.

Facts the text rests on (pstack 0.9.143, `skills/poteto-mode/scripts/watch-pr/`, newest in the cache and identical in the marketplace copy):

- The watcher prints JSON by default, `--pretty` for text. A STATUS verdict holds `rows`, each a snapshot with a `kind` of `open`, `merged` or `closed` (`types.ts:185-190`).
- `policy.ts:176-179` (`readSnapshot`): returns `{ kind: "merged", context, facts }` when `facts.state` is `MERGED` or `mergedAt` is set, and `{ kind: "closed", context, facts }` when `state` is `CLOSED`, before it reads threads or checks. Those two rows have no `threads` and no `ci`.
- `render.ts:40-41` (`mergeCell`, `--pretty` only): `✅ merged` and `❌ closed`; `ciCell` and `reviewCell` print a dash for them (`render.ts:5`, `render.ts:27`).
- `policy.ts:291-300` (`gateReason`): `merged` has no reason, `closed` is `closed-without-merge`, `CHANGES_REQUESTED` is `changes-requested`, `REVIEW_REQUIRED` is `review-required`. `render.ts:51-53` prints `mergeStateStatus` UNKNOWN as "mergeability unknown" and BLOCKED as "blocked".

Old, from "From each row read only three gates" to the end of the item:

```
From each row read only three gates, a conflict (`facts.mergeable` is `CONFLICTING` or `facts.mergeStateStatus` is `DIRTY`), open `threads`, and behind-base (`facts.mergeStateStatus` is `BEHIND`). Ignore the row's `ci` field. When the watcher exits non-zero, for example 7 with a `checks-unavailable` failure, the status read failed, not the PR. Read `mergeable`, `mergeStateStatus` and `headRefOid` with `gh pr view <pr> --json mergeable,mergeStateStatus,headRefOid`, read the unresolved review threads (`isResolved` false) with `gh api graphql`, and apply the same gates. In `drive` mode, merge-ready means none of the three gates is open, `mergeable` is `MERGEABLE` so a still-computing `UNKNOWN` is not ready, and the stage 5 evidence was taken at the PR's current head commit.
```

New:

```
Read each row's `kind` first. A `merged` row means the PR is done and there is nothing to babysit: the row has no `threads` or `ci`, so drop that PR and go on with the run's next step. For the stage 8 plan-archive PR that step is sending `archived` once nothing else is pending for the owner. A `closed` row means the PR was closed without merging, and it also has no `threads` or `ci`: stop babysitting that PR and report it in the run's final message. A closed plan-archive PR leaves the plan unarchived, so stage 8 does not send `archived` while it is closed. For an `open` row read three gates, a conflict (`facts.mergeable` is `CONFLICTING` or `facts.mergeStateStatus` is `DIRTY`), open `threads`, and behind-base (`facts.mergeStateStatus` is `BEHIND`). Ignore the row's `ci` field. When the watcher exits non-zero, for example 7 with a `checks-unavailable` failure, the status read failed, not the PR. Read `state`, `mergeable`, `mergeStateStatus`, `reviewDecision` and `headRefOid` with `gh pr view <pr> --json state,mergeable,mergeStateStatus,reviewDecision,headRefOid`, read the unresolved review threads (`isResolved` false) with `gh api graphql`, and apply the same rules (`state` `MERGED` or `CLOSED` is the `merged` or `closed` row). In `drive` mode, merge-ready means none of the three gates is open, `facts.mergeable` is `MERGEABLE`, `facts.mergeStateStatus` is neither `UNKNOWN` (still computing, read again) nor `BLOCKED`, `facts.reviewDecision` is not `CHANGES_REQUESTED`, and the stage 5 evidence was taken at the PR's current head commit. A `BLOCKED` or `CHANGES_REQUESTED` PR waits on the owner or the reviewer: the run reports which one holds merge-ready and does not act on it.
```

### `playbooks/factory.md` line 105 and `factory/factory-onboard/SKILL.md` line 80 (#120)

`playbooks/factory.md:105`, old: `phpstan, phparkitect, phpunit, rector or PHP CS Fixer (`.php-cs-fixer.dist.php`) configs`. New: `phpstan, phparkitect, phpunit, rector, PHP CS Fixer (`.php-cs-fixer.dist.php`) or Pint (`pint.json`) configs`.

`factory/factory-onboard/SKILL.md:80`, old: `the phpstan, phparkitect, phpunit, rector or PHP CS Fixer (`.php-cs-fixer.dist.php`) configs`. New: `the phpstan, phparkitect, phpunit, rector, PHP CS Fixer (`.php-cs-fixer.dist.php`) or Pint (`pint.json`) configs`.

No other file lists these configs. `kanon/standards-discovery/scripts/inventory.py:48` already matches `pint.json` as a linter file, and is a different list.

## Tests, one per acceptance criterion

No test reads `factory.md` prose or runs the owner-count snippet. The bug-fix issues get `test-first` rows with `--none`, plus recorded probes.

| # | Issue | Criterion | Check |
|---|---|---|---|
| 1 | #112 | "Counting the owner" no longer counts the `plan-approved` swap or "merge it" | Read the new line 157. `git grep -n 'label swaps'` in `playbooks/factory.md` returns nothing. Dashboard unchanged: the diff touches no file outside this repo. |
| 2 | #113 | `events: 0` is the only failed read; events without `owner_count` start from zero | Probe P3: new pipeline on codysseydev/codyssey-skills issues 9 and 17 prints `{"events":8,"owner_count":null}` and `{"events":1,"owner_count":null}`, exit 0. Run the snippet text from the edited file, not a copy. Gate row: `test-first --none "no test reads factory.md prose or runs the owner-count snippet"`. |
| 3 | #113 | Minor items: "reads the totals", the all-reads-failed summary line | Read the new lines 161 and 169. |
| 4 | #75 | The babysit holds merge-ready on `CHANGES_REQUESTED`, `BLOCKED`, `UNKNOWN`; says what a `merged` or `closed` row means; stage 8 still sends `archived` after a merged archive PR | Read the new item against the facts above. `check-playbooks.mjs` exits 0 with it and 1 when the anchor is altered (P1). Gate row: `test-first --none "prose rule in a playbook, no test reads it"`. |
| 5 | #120 | Both lists name `pint.json` | `git grep -n 'pint.json' -- playbooks/factory.md factory/factory-onboard/SKILL.md` prints both lines. |
| 6 | all | Tests pass per `.factory/recipe.yml` | The 12 recipe checks at the head commit, clean tree. |

## Probes against the code

Base 99bd2e6, worktree `factory/113`.

- Baseline. All 12 recipe checks pass at origin/main 99bd2e6: pick-up 108, post-merge 23, capture-ui 115, trial-decision 39, test-first 36, install 30 and kanon-catalog-tests 43 tests pass; kanon-catalog-check prints "catalog ok: 14 family file(s), 326 entries"; bootstrap 5, event-model 4, factory-onboard 29 and standards-discovery 273 tests OK (standards-discovery took 442 s on a loaded machine).
- P1. `check-playbooks.mjs` from pstack 0.9.143, with the unchanged `playbooks/factory.md` copied to a temp `$HOME/.agents/playbooks/`: prints "Every project playbook matches this pstack's playbooks." and exits 0. The implement run repeats it with the edited file (expect 0), then with "watcher at" changed to "watcher from" in the copy (expect 1). The real `~/.agents/playbooks/` is not touched.
- P2. pstack 0.9.143 is the only version in `~/.claude/plugins/cache/pstack-claude/pstack/`. The marketplace copy reports the same version.
- P3. Dashboard read, today's pipeline against the new one, `set -o pipefail`, token from the default (never printed):

| Issue | Today's pipeline | New pipeline | Exit |
|---|---|---|---|
| #9 | `null` | `{"events":8,"owner_count":null}` | 0 |
| #17 | `null` | `{"events":1,"owner_count":null}` | 0 |

  Today's pipeline cannot tell these two issues (events, no `owner_count`) from an issue with no events. By line 161, an `archive` run on #9 treats `null` as a failed read, which is the bug. The new output shows `events` above 0, so the run starts from zero. The `events: 0` branch was not exercised: no known issue has no events, and a made-up issue number would test the API, not the rule.
- P4. `reviewDecision` and BLOCKED. `policy.ts:300` treats `REVIEW_REQUIRED` as its own gate (`review-required`) and `render.ts:35` prints it in the Review column. The plan does not verify against GitHub's documentation that a required review always shows `mergeStateStatus` BLOCKED. I do not know that. See open decision 3.

## Gates

From the worktree root, at the head commit, clean tree. These are the 12 checks in `.factory/recipe.yml`:

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

Plus the `check-playbooks.mjs` run from P1, and two `test-first --none` rows (one reason per bug-fix issue, #113 and #75).

## Diagrams

No diagrams: no trigger fired. The change is prose and one printed shape, with no new data model, no flow across more than two components, no state machine and no UI.

## Implement

One delegate, one worktree, two files (`playbooks/factory.md` and `factory/factory-onboard/SKILL.md`). The factory.md edits are in one file and touch neighbouring sections, so they go in one commit per issue, in this order: #120, #75, #113 and #112 together (the same section). Bug-fix issues normally commit a failing test first; with `--none` there is no test commit, so the `test-first` rows are `not_exercised` and the reasons go under `## Merge assessment`.

Trusted-commands flag in the PR: `factory/factory-onboard/SKILL.md` and `playbooks/factory.md` are not on the guard's list, so nothing is flagged. The change does edit the guard's own list text, which the owner should read.

## Out of scope

- The dashboard, including `src/lib/metrics.ts`. #112 is decided as "stop counting in the playbook".
- pstack's watcher. A rule about `merged` and `closed` rows belongs in this playbook, not in pstack.
- Branch protection on factory repos. None has it on main (plan 16), so `BLOCKED` is rare there.
- `REVIEW_REQUIRED` as its own hold (see open decision 3).

## Open decisions

1. #75, closed-unmerged PR row. Chosen (recommended): stop babysitting that PR and report it in the run's final message; in stage 8 do not send `archived` while a closed plan-archive PR leaves the plan unarchived. Alternative: report `waiting` with reason `question`, asking the owner what to do with the closed PR. Exact chosen text is in the babysit item above.
2. #75, merged row. Chosen (recommended): nothing to babysit; the run goes on with its next step (for the stage 8 plan-archive PR, sending `archived` when nothing else is pending). No alternative needed.
3. #75, `reviewDecision` `REVIEW_REQUIRED`. Chosen (recommended): no separate hold. In a factory repo the owner's merge is the review, and a required review through branch protection normally shows as `BLOCKED`, which already holds merge-ready (not verified against GitHub documentation). Alternative: add `facts.reviewDecision` `REVIEW_REQUIRED` to the hold list, matching `policy.ts:300`.
4. Tests. Chosen (recommended): `test-first` rows with `--none "<reason>"` for #113 and #75, plus the check-playbooks probe and the #113 dashboard probe as recorded evidence. Alternative: a new node test that extracts the `node -e` program from `factory.md` and runs it on three fixtures (no events, events without `owner_count`, events with). That adds a check to `.factory/recipe.yml`, which the trusted-commands guard flags.
5. Kinds. Chosen: #112 feature, #113 bug fix, #75 bug fix, #120 feature. The owner confirms them; the Kind of a bug fix decides whether `test-first` runs.
6. #112, which owner actions still count. Chosen (recommended): keep counting the owner's PR comments when removing `needs-pr-read`, because the dashboard counts only plan and merge approvals. Alternative: stop counting every label swap, so only manual steps and questions remain.
7. #75, `BLOCKED` in a repo that requires Actions checks. Chosen: `BLOCKED` holds merge-ready even though the babysit ignores `ci`, because GitHub itself will not merge a blocked PR. The standing rule (no Actions gate) still holds for every repo without such protection. Alternative: none that keeps merge-ready true.
