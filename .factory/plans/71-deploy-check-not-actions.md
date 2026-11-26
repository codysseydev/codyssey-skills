# Plan for #71, never read a GitHub Actions run as the deploy check

Issue codysseydev/codyssey-skills#71. Base origin/main 99bd2e6. Branch `factory/71`.

Kind: feature

## Goal

The archive stage's deploy check is never a GitHub Actions check run. `post-merge.mjs facts` ignores check runs whose `app.slug` is `github-actions`, so a `## Post-merge` section that names an Actions job cannot make the run poll one. The docs say the same thing and say how the run reports the case.

## Data shape

`deployFromCheckRuns(runs, name)` keeps its `{ name, state, completed_at }` result. One new outcome carries a fourth key:

| Check runs on the commit | Result |
|---|---|
| No run has this name | `{ name, state: 'none', completed_at: null }` (unchanged, no `reason`) |
| Every run with this name has `app.slug` `github-actions` | `{ name, state: 'not_exercised', completed_at: null, reason: 'github-actions' }` |
| At least one run with this name is not an Actions run | the newest non-Actions run decides, as today, with no `reason` |

Only a positive `app.slug === 'github-actions'` excludes a run. A run with no `app` object, or an `app` without a `slug`, is kept.

## Change

### `playbooks/scripts/post-merge.mjs`

Replace `deployFromCheckRuns` (line 57) with:

```js
// A check run created by a GitHub Actions workflow. The factory never uses Actions, so such a run
// is never the deploy check. Only a positive slug excludes a run: no `app` object keeps it.
const isActionsRun = (r) => r.app?.slug === 'github-actions';

// Check runs on a commit -> {name, state, completed_at} for the run with this exact name.
// Runs from GitHub Actions are ignored. When the name matches only Actions runs, the result is
// {name, state: 'not_exercised', completed_at: null, reason: 'github-actions'}.
// With several runs of that name (a rerun), the newest non-Actions one counts.
export function deployFromCheckRuns(runs, name) {
  const named = (runs ?? []).filter((r) => r.name === name);
  if (!named.length) return { name, state: 'none', completed_at: null };
  const counted = named.filter((r) => !isActionsRun(r));
  if (!counted.length) return { name, state: 'not_exercised', completed_at: null, reason: 'github-actions' };
  const newest = counted.reduce(/* unchanged */);
  /* state and completed_at lines unchanged */
}
```

Update the header comment (lines 10 to 13): after "`deploy` is null without --deploy-check, else {name, state, completed_at}", add "plus `reason: 'github-actions'` when the name matches only GitHub Actions check runs, which facts ignores (the factory never uses GitHub Actions)".

No change to `cmdFacts`: it already calls `deployFromCheckRuns` on the merge commit's check runs, and `/commits/<sha>/check-runs` already returns `app.slug` on every run.

### `playbooks/factory.md`

1. `## Post-merge` bullet in "Project file" (line 51). Replace the final sentence "A repo without the section has both signals reported as not exercised." with:

```
The deploy check is never a GitHub Actions job, because the factory never uses GitHub Actions: `post-merge.mjs facts` ignores check runs from the `github-actions` app, and a name that only Actions runs carry is reported as not exercised. A repo without the section has both signals reported as not exercised.
```

2. Stage 8 step 1 (line 114), in the JSON field list: change "and `deploy` (`state` and `completed_at`)" to "and `deploy` (`state`, `completed_at`, and `reason` when `state` is `not_exercised` because only GitHub Actions runs carry the name)".

3. Stage 8 step 2 "Deploy check" (line 115). After the sentence ending "...and listed as not exercised." append:

```
 The deploy check is never a GitHub Actions job, because the factory never uses GitHub Actions. `facts` ignores check runs from the `github-actions` app, so a name that only Actions runs carry comes back `not_exercised` with `reason: "github-actions"`. Do not wait for it. The archived summary lists the deploy check as not exercised, names the check and gives the reason `github-actions`, and the run says the owner should name a non-Actions check in `## Post-merge` (or `none`). A name with no runs at all stays `none`.
```

The exact current wording of the sentence to anchor on is read from line 115 when the edit is made.

### `factory/factory-onboard/SKILL.md`

Step 7 (line 50). Replace the tail "The starter writes a one-sentence explanation and `- Deploy check: none` and `- Sentry: none`." with:

```
The deploy check is never a GitHub Actions job, because the factory never uses GitHub Actions: the archive run ignores check runs from the `github-actions` app and reports a name that only Actions runs carry as not exercised, naming the check and the reason `github-actions` in the archived summary. If the repo's only deploy signal is an Actions workflow, write `none`. The starter writes an explanation and `- Deploy check: none` and `- Sentry: none`.
```

### `factory/factory-onboard/scripts/write-playbook.py`

Open decision 3. Recommended: yes, extend the first paragraph of `POST_MERGE_BODY` (line 26) with one sentence before the `- Deploy check: none` line:

```python
    "After the PR merges, the archive run reads the deploy check on the merge commit and looks for new Sentry issues. "
    "Name the check run and the Sentry project here, or leave `none`. "
    "The deploy check is never a GitHub Actions job, so a check run from GitHub Actions counts as not exercised.\n"
```

The lines `- Deploy check: none` and `- Sentry: none` stay the last two lines, so the assertions at `test_write_playbook.py` lines 87, 222 and 230 hold. The `test_with_recipe` assertion at line 86 (`assertIn("archive run", post.splitlines()[0])`) also holds. If the owner picks yes, add to `test_with_recipe` (line 53): `self.assertIn("never a GitHub Actions job", post)` after line 86. That test passes only with the new text, so the build writes it first and sees it fail.

## Tests, one per acceptance criterion

All five new tests go in `playbooks/scripts/post-merge.test.mjs`, after the `deployFromCheckRuns matches the exact name...` test (line 104) and in the `facts: deploy check states...` area (line 242). Each uses `Workers Builds: codyssey-frontend` as the name, the real check run read from codysseydev/codyssey-frontend main on 2026-11-26: completed, success, `app.slug` `cloudflare-workers-and-pages`.

| # | Criterion | Test (name) | Today |
|---|---|---|---|
| 1 | A run from a non-Actions app still matches | `deployFromCheckRuns keeps a Workers Builds run from cloudflare-workers-and-pages`: one completed success run, slug `cloudflare-workers-and-pages`, gives `{ name, state: 'success', completed_at }` | passes (guards the filter against over-matching) |
| 2 | A same-named `github-actions` run is dropped | `deployFromCheckRuns ignores a same-named github-actions run`: one completed success run, slug `github-actions`, gives `{ name, state: 'not_exercised', completed_at: null, reason: 'github-actions' }` | fails: returns `state: 'success'` |
| 3 | Mixed case: only the non-Actions run counts | `deployFromCheckRuns counts only the non-Actions run when both share the name`: an Actions run that failed and is newer, plus a Cloudflare run that succeeded and is older, gives `state: 'success'` with the Cloudflare run's `completed_at` and no `reason`; the swapped case (Actions success newer, Cloudflare failure older) gives `state: 'failure'` | fails: the newer Actions run wins |
| 4 | A run with no `app` object is kept | `deployFromCheckRuns keeps a run that has no app object`: a run with no `app` key, and a run with `app: null`, each give their real state with no `reason` | passes (pins the open decision) |
| 5 | End to end through `facts` | `facts: a github-actions check run is not the deploy check`: the existing `world()`, `prBranch` and `squash` helpers and `fakeGh({ mergeSha, head, runs })` with one Actions run, and `deploy` is `{ name, state: 'not_exercised', completed_at: null, reason: 'github-actions' }`; the same name carried by the Cloudflare run gives `state: 'success'` | fails: returns the Actions run's state |
| 6 | No regression | the existing `deployFromCheckRuns matches the exact name and takes the newest rerun` and `facts: deploy check states success, failure, not_exercised, pending and none` tests pass unchanged, so a name with no runs stays `state: 'none'` with no `reason` | passes |
| 7 | The docs carry the rule | `rg -n "never a GitHub Actions job" playbooks/factory.md factory/factory-onboard/SKILL.md` finds two hits in `playbooks/factory.md` (the Project file bullet and stage 8 step 2) and one in `SKILL.md`; and `rg -c "github-actions" playbooks/factory.md` is at least 2 | not present |
| 8 | Recipe stays green | the twelve checks in `.factory/recipe.yml` at the head commit, clean tree | |

The build writes tests 2, 3 and 5 first, commits them failing, then writes the code. Tests 1 and 4 pass before the change on purpose: they pin that only a positive slug excludes a run.

Run the new tests with one command:

```sh
node --test --test-name-pattern 'Workers Builds run|github-actions|non-Actions|no app object' playbooks/scripts/post-merge.test.mjs
```

## Probes against the code

Base 99bd2e6, worktree `.claude/worktrees/agent-afc57b9cfd2b77eda`.

- Baseline. All twelve `.factory/recipe.yml` checks pass: pick-up 108, post-merge 23, capture-ui 115, trial-decision 39, test-first 36, install 30 and kanon-catalog-tests 43 node tests pass; bootstrap 5, event-model 4 and factory-onboard 29 python tests OK; kanon-catalog-check prints `catalog ok: 14 family file(s), 326 entries`; standards-discovery-tests 273 OK (about 7 minutes on a loaded machine).
- P1, today's behavior. A throwaway call, not committed: `deployFromCheckRuns([{ id: 1, name: 'Workers Builds: codyssey-frontend', app: { slug: 'github-actions' }, status: 'completed', conclusion: 'success', started_at: '2026-01-01T10:00:00Z', completed_at: '2026-01-01T10:03:00Z' }], 'Workers Builds: codyssey-frontend')` returns `{"name":"Workers Builds: codyssey-frontend","state":"success","completed_at":"2026-01-01T10:03:00Z"}`. An Actions run is read as the deploy check, which is the bug in #71.
- P2. `/commits/<sha>/check-runs` returns `app.slug` on each run. The real run read on 2026-11-26 from codysseydev/codyssey-frontend main has slug `cloudflare-workers-and-pages`, so the filter does not drop the one configured deploy check.
- Not exercised: a live `github-actions` run in a product repo (none is a configured deploy check today). The fixture stands in for it.

## Diagrams

No diagrams: no trigger fired. One actor (the archive run), no new status (`not_exercised` already exists; `reason` is a key on it), one module, no new external system.

## Gates

From the worktree root, at the head commit, clean tree.

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

Plus, because the plan changes `playbooks/factory.md`, the `check-playbooks.mjs` run from pstack (0.9.143 is the newest in the plugin cache, `skills/poteto-mode/scripts/check-playbooks.mjs`) against a temp HOME copy: copy `playbooks/factory.md` to `$T/.agents/playbooks/`, run `HOME=$T node <pstack>/skills/poteto-mode/scripts/check-playbooks.mjs $T`, expect exit 0. The real `~/.agents`, `~/.claude/skills`, `~/.claude/scheduled-tasks` and `~/.factory` are not touched. This edit adds no new `**In**` override anchor, so it should pass as on origin/main.

## Implement

One delegate, one worktree (`factory/71`), no fan-out. Order: commit the failing tests (2, 3, 5), then the `post-merge.mjs` change, then `factory.md` and `SKILL.md`, then `write-playbook.py` and its test if the owner picks yes. Trusted-commands flag: none, since none of these files is on the guard's list.

## Out of scope

- Branch protection or any rule about which checks gate merges.
- Reading Actions runs for any other purpose. The filter applies to the deploy check only: `facts` reads no other check run.
- A `--allow-actions` escape hatch. The owner's rule is that the factory never uses GitHub Actions.
- Installed copies lag origin/main. The change reaches runs after `node playbooks/scripts/install.mjs --source <checkout>`.
- Event model. Skip, no journey for internal tooling.

## Decided by the owner (2026-11-26)

- Filter on `app.slug` `github-actions` in `deployFromCheckRuns`, with the result shape in Data shape (`reason` key only on the Actions case, `none` for a name with no runs), plus the stage 8, `## Post-merge` and factory-onboard text above. The factory never uses GitHub Actions (standing owner rule, 2026-11-20).

## Open decisions

1. Kind. Chosen (recommended): `feature`, because nothing is broken today (the only configured deploy check is a Cloudflare Workers Builds run) and the change adds a guard. Alternative: `bug fix`, which makes the test-first gate apply. The build writes the failing tests first either way.
2. A check run with no `app` object. Chosen (recommended): keep it, since only a positive `app.slug` of `github-actions` is excluded, and dropping a run on a missing field could hide a real deploy result. Alternative: drop it, which fails closed but can turn a real deploy check into `none`.
3. The starter text in `write-playbook.py`. Chosen (recommended): yes, add the sentence "The deploy check is never a GitHub Actions job, so a check run from GitHub Actions counts as not exercised." to `POST_MERGE_BODY`, so a new repo's playbook says it where its owner writes the deploy check. Test that changes: `test_with_recipe` in `factory/factory-onboard/tests/test_write_playbook.py` (line 53), which gains one `assertIn`. The assertions at lines 87, 222 and 230 stay as they are because the two `none` lines remain last. Alternative: leave the starter as it is and rely on `factory.md` and `SKILL.md`, with no test change.
