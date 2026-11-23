# Plan for #26, factory babysit reads only the conflict, thread and behind-base gates

Issue codysseydev/codyssey-skills#26. Base origin/main ad19dcd. Branch `factory/26-a2`.

Kind: feature

## Goal

A factory run that babysits a PR never waits on, or stops for, a GitHub Actions check. It runs pstack's PR watcher with `--status-only` and reads only the conflict, review-thread and `behind-base` gates.

## Data shape

Prose only, no code. One new list item in `playbooks/factory.md`, "Changes to the bundled steps". Its anchor is babysit's watcher step in pstack 0.9.143 (`skills/poteto-mode/playbooks/babysit.md:6`).

## Change

### `playbooks/factory.md`

1. After the `**In** "Order: conflicts, threads, CI."` item (line 159), add:

```
- **In** "On GitHub, status comes from the watcher at" a factory babysit runs the watcher with `--status-only --max-query-errors 1` in every mode and polls by running it again. Never run it without both flags, because without `--status-only` the loop waits on pending Actions checks and stops on failing ones, and without `--max-query-errors 1` it retries a check read that is not ready for about 12 minutes. From each row read only three gates, a conflict (`facts.mergeable` is `CONFLICTING` or `facts.mergeStateStatus` is `DIRTY`), open `threads`, and behind-base (`facts.mergeStateStatus` is `BEHIND`). Ignore the row's `ci` field. When the watcher exits non-zero, for example 7 with a `checks-unavailable` failure, the status read failed, not the PR. Read `mergeable`, `mergeStateStatus` and `headRefOid` with `gh pr view <pr> --json mergeable,mergeStateStatus,headRefOid`, read the unresolved review threads (`isResolved` false) with `gh api graphql`, and apply the same gates. In `drive` mode, merge-ready means none of the three gates is open, `mergeable` is `MERGEABLE` so a still-computing `UNKNOWN` is not ready, and the stage 5 evidence was taken at the PR's current head commit.
```

The watcher step is where every babysit mode gets its status, so one item there covers `drive`, `threads-only` and `check`, and it redefines merge-ready for `drive` in the same place. The line-159 item from #16 says an Actions check is not a blocker, but it does not stop the watcher's own loop from waiting or exiting on checks.

No other file changes. No ADR: the rule is #16's standing rule, and this item closes a gap in how a run applies it.

## Why the watcher blocks, read against the code

`watch-pr/policy.ts` in pstack 0.9.143: `waitReason` returns `pending-checks` for `ci-pending` (line 308), `ciBlocker` returns the `failing-checks` blocker for `ci-failing` (lines 281-285), and `readyContribution` counts a PR ready only for `ci-clean` or `ci-none` (line 344). With `--status-only`, `runSimple` returns the STATUS rows before it classifies anything (line 607), so checks neither wait nor block.

## Tests, one per acceptance criterion

| # | Criterion | Check |
|---|---|---|
| 1 | The override is in `playbooks/factory.md`; `check-playbooks.mjs` exits 0 with it installed and 1 when its anchor is altered | Copy `playbooks/factory.md` to a temp `$HOME/.agents/playbooks/` and run `HOME=$T node <pstack>/skills/poteto-mode/scripts/check-playbooks.mjs $T`: exit 0. Change "watcher at" to "watcher from" in the copy: exit 1. The real `~/.agents/playbooks/` is not touched. |
| 2 | No inherited step waits on a pending or failing Actions check | Grep the four playbooks `factory.md` extends (feature, bug-fix, opening-a-pr, babysit) for `ci`, `check`, `watch`, `poll` and `wait`, and read each hit. Only babysit polls CI: line 6 (this change) and line 8 (the #16 item). |
| 3 | Tests pass per `.factory/recipe.yml` | The nine recipe checks at the head commit, clean tree |

## Probes against the code

Base ad19dcd, worktree `~/.factory/worktrees/codyssey-skills-26-a2`.

- Baseline. All nine recipe checks pass: pick-up 96, post-merge 23, capture-ui 115, trial-decision 39, test-first 36 and install 22 tests pass; bootstrap 3, event-model 4 and factory-onboard 28 OK.
- P1. With the new item inserted in a temp HOME, `check-playbooks.mjs` prints "Every project playbook matches this pstack's playbooks." and exits 0. With the anchor changed to "watcher from", it prints `"On GitHub, status comes from the watcher from" is not in any playbook it extends` and exits 1. The anchor text appears once in `babysit.md`. The unchanged origin/main `factory.md` also passes.
- P2. codysseydev/codyssey#950 is open with five Actions checks, all FAILURE. `watch-pr --status-only` exits 0 with one STATUS row: `mergeable` MERGEABLE, `mergeStateStatus` UNSTABLE, 0 threads, `ci.kind` ci-failing. The drive loop (`--timeout 90 --interval 30`) exits 4 at once with the `failing-checks` blocker. That is the bug. The status-only row carries the three gates the override reads, and UNSTABLE (failing checks, no conflict) is none of them.
- Not exercised: a pending check (no open PR in codyssey, codyssey-frontend or codyssey-cli has one) and the exit 7 `checks-unavailable` path.

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
node --test playbooks/scripts/install.test.mjs
```

Plus the `check-playbooks.mjs` run from criterion 1.

## Implement

One delegate, one worktree (`factory/26-a2`), one file, no fan-out. Trusted-commands flag: none, since `playbooks/factory.md` is not on the guard's list.

## Out of scope

- pstack's watcher. A flag that ignores checks would belong in pstack, not in this repo.
- Branch protection that requires Actions checks. None of the four factory repos has branch protection on main (plan 16).
- Installed copies lag origin/main. `~/.agents/playbooks/factory.md` lacks the #27 changes, including the line-159 babysit item. `playbooks/factory.md` says the scheduled pick-up runs `install.mjs` before `claim` when armed, but the `factory-pickup` scheduled task prompt that started this run has no install step. The #16 item and this one reach runs only after an install.
- Event model. Skip, no journey for internal tooling. This repo has no brain vault of its own.

## Owner follow-ups

- Add the install step to the `factory-pickup` scheduled task prompt, or run `node playbooks/scripts/install.mjs --source <checkout>` from the checkout after merge (README "Install").

## Open decisions

1. Anchor. Chosen: babysit's watcher step (line 6), which covers every mode. Alternative: the `drive` step (line 5), which covers only `drive`.
2. The exit 7 fallback. Chosen: keep it, so a failed check read does not hold the run. Alternative: drop it, since the path was not exercised. A run would then retry the read with backoff for about 12 minutes and stop with exit 7.
3. Regression test. Chosen: no recipe test. `check-playbooks.mjs` lives in the owner's pstack plugin cache, so a recipe check would fail on a machine without pstack 0.9.143. It stays an extra gate, as in #16. Alternative: a node test that skips when pstack is missing.
