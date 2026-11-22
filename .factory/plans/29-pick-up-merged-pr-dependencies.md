# Plan for #29, pick-up.mjs dependencies on merged PRs

Issue codysseydev/codyssey-skills#29. Base origin/main 0e53c6f. Branch `factory/29`.

## Goal

A `Depends on:` line that names a merged PR clears. An open PR blocks. A PR closed without merging blocks with its own reason (open decision 1).

## Problem

`pick-up.mjs` skips an issue until each ref on its `Depends on:` line is done. `parseDependsOn` (`playbooks/scripts/pick-up.mjs:58`) reads `#N` and `owner/repo#N`. A ref can name an issue or a PR, and the line does not say which.

- `makeGh().issueState` (`:157`) runs `gh issue view <n> --repo <repo> --json state`.
- `evaluateRows` (`:375-387`) calls it once per ref, caches it, and turns a thrown error into `undefined`.
- `evaluateIssue` (`:121-127`) blocks unless the value is `CLOSED`. Line 126: `if (String(s).toUpperCase() !== 'CLOSED') return { eligible: false, reason: \`open dependency ${name}\` };`.

What `gh issue view --json state` returns (gh 2.105.0, run for this plan):

| Ref | What it is | `state` |
|---|---|---|
| codyssey-frontend#1005 | merged PR | `MERGED` |
| codyssey-skills#22 | merged PR | `MERGED` |
| codyssey-skills#69 | open PR | `OPEN` |
| codyssey#886 | PR closed without merging | `CLOSED` |
| codyssey-skills#19 | issue closed as completed | `CLOSED` |
| codyssey#554 | issue closed as not planned | `CLOSED` |

So a merged PR blocks forever, and a PR closed without merging clears. `gh issue view` has no field that marks a PR (`--json isPullRequest` gives `Unknown JSON field`), so this command cannot tell #886 from #19.

`playbooks/factory.md:72` already says the dependencies must be "merged or closed".

## Data shape

`depState(ref)` returns one of:

```js
'OPEN'            // issue or PR, open
'CLOSED'          // issue, closed (completed or not planned)
'MERGED'          // PR, merged
'CLOSED_UNMERGED' // PR, closed without merging
undefined         // gh failed (404, network, auth), as today
```

The boundary decides issue vs PR. `issueState` switches to the REST endpoint `getIssue` already uses (`:153-156`), `gh api repos/<repo>/issues/<n>`. One call returns `state` (`open` or `closed`), a `pull_request` key on PRs only, and `pull_request.merged_at`. Recorded:

```
codyssey-frontend#1005  {"pull_request":{"merged_at":"2026-11-17T01:22:26Z"},"state":"closed","state_reason":null}
codyssey#886            {"pull_request":{"merged_at":null},"state":"closed","state_reason":null}
codyssey-skills#69      {"pull_request":{"merged_at":null},"state":"open","state_reason":null}
codyssey-skills#19      {"state":"closed","state_reason":"completed"}   (no pull_request key)
codyssey#554            {"state":"closed","state_reason":"not_planned"} (no pull_request key)
```

Mapping. `open` gives `OPEN`. `closed` with no `pull_request` gives `CLOSED`. `closed` with `merged_at` set gives `MERGED`. `closed` with `merged_at` null gives `CLOSED_UNMERGED`. Any other `state` throws, which `evaluateRows` already turns into `undefined`. A scratchpad probe of this mapping against the six refs above plus `codyssey-skills#999999` printed `OPEN`, `CLOSED`, `CLOSED`, `OPEN`, `MERGED`, `CLOSED_UNMERGED` and `throws (gh: Not Found (HTTP 404))`.

`evaluateIssue` stays pure and owns the policy:

| `depState` | Result | Reason |
|---|---|---|
| `CLOSED` | done | |
| `MERGED` | done | |
| `OPEN` | blocks | `open dependency <repo>#<n>` (unchanged text) |
| `CLOSED_UNMERGED` | blocks | `dependency <repo>#<n> is a PR closed without merging` |
| `undefined` or any other value | blocks | `dependency <repo>#<n> unreadable` |

The last row changes one thing. Today an unknown string reads as `open dependency`. After the change only the boundary produces values, so this row covers only fakes and future drift.

## Changes

### `playbooks/scripts/pick-up.mjs`

- `issueState(repo, n)` (`:157`). Read `gh api repos/<repo>/issues/<n>` and map it as above. Keep the name. Its one caller is `evaluateRows`, and REST calls PRs issues too.
- `evaluateIssue` (`:121-127`). Replace the `toUpperCase() !== 'CLOSED'` check with the table above. A `Set` of done states (`CLOSED`, `MERGED`) and two explicit block checks are enough.
- Comment at `:103`. `depState: (ref) => 'OPEN' | 'CLOSED' | 'MERGED' | 'CLOSED_UNMERGED' | undefined.`
- Unchanged. `parseDependsOn`, `evaluateRows`, `getIssue`, the claim and list commands.

### `playbooks/scripts/pick-up.test.mjs`

- The fake `issueState` (`:39`) returns the fake issue's `state`, and the override in the `EEXIST` test (`:182`) returns `'CLOSED'`. Both stay valid values, so neither changes. `ok` (`:85`) stays `() => 'CLOSED'`.

### `playbooks/factory.md:72`

- "every issue on its `Depends on:` line is merged or closed" becomes "every issue on its `Depends on:` line is closed and every PR on it is merged. A PR closed without merging blocks until the line is edited."

## Tests

All in `playbooks/scripts/pick-up.test.mjs`.

| Test | Checks | At base |
|---|---|---|
| `evaluateIssue: each dependency state` | `OPEN` blocks with `open dependency o/r#2`. `CLOSED` and `MERGED` give action `plan`. `CLOSED_UNMERGED` blocks with `dependency o/r#2 is a PR closed without merging`. `undefined` blocks with `dependency o/r#2 unreadable` | fails on `MERGED` and `CLOSED_UNMERGED` |
| `makeGh issueState maps the REST issue to a dependency state` | Fake `run` in the style of the `makeGh` tests at `:402-530`, fed the recorded payloads. Asserts the args are `['api', 'repos/o/r/issues/2']`, the six mappings, and a throw on `state: 'unknown'` | fails (base calls `gh issue view`) |
| `list: a merged PR dependency clears, a PR closed without merging blocks` | `cmdList` with issue 1 `Depends on: #2`, issue 3 `Depends on: #4`, fake entries 2 `MERGED` and 4 `CLOSED_UNMERGED`. Issue 1 is a candidate, issue 3 is skipped with the new reason | fails |

The existing `evaluateIssue: lock, open dependency, ...` test (`:118`) keeps its `OPEN` and `CLOSED` asserts.

## Gates

From the worktree root, at the head commit, clean tree. The checks in `.factory/recipe.yml`:

```sh
node --test playbooks/scripts/pick-up.test.mjs
node --test playbooks/scripts/capture-ui.test.mjs
python3 -m unittest discover -s factory/bootstrap/tests
python3 -m unittest discover -s factory/event-model/tests
python3 -m unittest discover -s factory/factory-onboard/tests
node --test playbooks/scripts/install.test.mjs
```

Baseline at 0e53c6f, all exit 0. Pick-up 74 pass, capture-ui 115 pass, bootstrap 3 OK, event-model 4 OK, factory-onboard 27 OK, install 22 pass.

## Out of scope

- Issues closed as not planned. They return `CLOSED` and clear today and after this change. That is the issue-side match of option B below. Changing it needs `state_reason` and its own issue.
- Surfacing skip reasons in a scheduled claim. `cmdClaim` returns `{ status: 'none', stale }` with no reasons (`:517`). See open decision 1.
- The workaround issues codysseydev/codyssey#926, #947, #948 and codysseydev/codyssey-skills#26. They can name PRs again once this ships. Not edited here.
- `brief-to-backlog`. It writes `Depends on:` lines with issue numbers only, so it is unaffected.
- Event model and brain vault. Skip, no journey for internal tooling. In `codyssey-docs`, `grep -rln -e pick-up.mjs -e "Depends on:" Architecture` finds nothing. The hits are under `Ideas/` and `Technical/Research Notes/`, and none describes the dependency check's states.

## Owner follow-ups

- The factory runs the installed copy in `~/.agents/playbooks/`. The fix takes effect on the next `install.mjs` run after merge, not at merge (`.factory/playbook.md`, Notes).

## Risks

- Transferred issues. A `Depends on:` ref to an issue moved to another repo gets an HTTP 301 from REST. Whether `gh api` follows it was not checked. If it does not, the ref reads as `unreadable`, which blocks with a clear reason.
- The REST call returns the full issue body, larger than `--json state`. It runs once per distinct ref per tick, cached, so the cost is small.

## Open decisions

1. A PR closed without merging. The code above implements A.
   - **A. Block with `dependency X is a PR closed without merging` (recommended).** The dependent was written on the premise that the PR's code lands, and a PR closed without merging did not land it. A run that starts anyway builds on missing code and fails later, at a cost of a full run. A also matches the workaround the owner uses now. Those issues name the issue a PR closes, and when such a PR closes without merging that issue stays open, so the dependent blocks. Cost: in a scheduled claim the block is silent, since `cmdClaim` returns `none` with no reasons (`:517`). This is the same silence this issue reports, bounded by a reason that names the fix. The owner sees it in `node playbooks/scripts/pick-up.mjs list --repo <repo>` under `skipped`, or in `claim --only`. To unblock, edit the `Depends on:` line to name the replacement PR or the issue.
   - **B. Clear, as today.** Delta: no boundary change. `issueState` keeps `gh issue view`, which already returns `MERGED`, and line 126 accepts `CLOSED` or `MERGED`. `factory.md:72` already says "merged or closed". Tests cover `OPEN`, `MERGED` and `CLOSED` only. Smallest diff, and consistent with not planned issues clearing. Cost: the factory can start work whose premise never landed.
   - **C. Block and surface it.** Delta: A, plus `cmdClaim` returns the blocked dependents (for example a `blocked: [{ repo, issue, reason }]` field), and the scheduled task's prompt reports them. Fixes the silence for every block reason, not only this one. Wider scope. It touches the claim result shape and the scheduled task outside this repo, so it fits better as its own issue.
2. Keep the name `issueState` (chosen) or rename it to `depState` at the boundary. A rename touches the fake at test `:39` and the override at `:182` for no behavior change.
