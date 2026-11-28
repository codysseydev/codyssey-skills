# Plan for #141, factory.md names a model per routine step and the checks per change tier

Issue codysseydev/codyssey-skills#141. Base origin/main be3b506. Branch `factory/141`.

Kind: feature

## Goal

A factory run puts routine steps on a cheaper model and sizes its checks to what the diff touches. Gates always run. The independent review, the acceptance run and dry runs scale with the change's tier. Both rules live in `playbooks/factory.md`, so a run reads them from the playbook, not from a prompt.

## What exists today

Line numbers are origin/main be3b506.

| Check named in the issue | Where it comes from |
|---|---|
| Gates | `playbooks/factory.md:99` (stage 5): `.factory/recipe.yml`, the project file's `## Checks`, and the UI, test-first and failure-sim gates (:100, :101, :106). No path filter. |
| Independent diff review | `playbooks/factory.md:102` (stage 5 Reviews), each repo's `## Review`, and pstack poteto-mode's review gate ("A review gate stays closed when no independent reviewer can run", poteto-mode `SKILL.md`, Subagents). In this repo the project file says `## Review: None yet`, so the review is the poteto-mode one (PR #130: "the independent review (opus, diff only)"). |
| Acceptance run | Not a defined stage. It is practice found in PR bodies: the issue's acceptance commands recorded as gate rows (#122 "the issue's five acceptance commands", #132 "Acceptance demo, criteria 1 to 3", #125 "Acceptance 1"). |
| Two-run dry run for skill changes | No general definition in `playbooks/`, the factory skills, `~/.claude/CLAUDE.md` or the pstack playbooks. The one real instance is the bootstrap stack pair: plan 64 "Dry run for the PR" (`.factory/plans/64-bootstrap-stack-symfony.md:104-113`), PR #121, and the vault note `codyssey-docs/Ideas/Software Factory Pipeline.md:298`, which runs `--stack symfony` and `--stack laravel` "so the Laravel and Symfony runs can be compared". |

Models: every step runs on the session's model or on pstack's role defaults (poteto-mode `SKILL.md`, Models: feature `sonnet`, judgment `opus`; verification "always runs on the `swarm workers` model", default `opus`). No `pstack-models.md` override sheet exists on this machine. Only delegated steps can change model: the `Agent` tool takes `model` (`haiku`, `sonnet`, `opus`, `fable`). The session itself runs on whatever model its scheduled task or the owner started.

## Change

### `playbooks/factory.md`

1. After `#### Before the run` (ends line 39), add a new section:

   ```
   #### Models and check tiers

   Only delegated steps can run on a cheaper model. The session runs on the model its scheduled task or the owner started it with. Pass the model on each `Agent` call as the table says. The table overrides pstack poteto-mode's role defaults for these steps, including its rule that verification runs on the swarm-worker model: a gate run that only runs commands and reports their output is not that verification.

   | Step | Model |
   |---|---|
   | `git fetch`, the AI policy check command, `check-playbooks.mjs`, the owner-count read, read-only `gh` lookups, label swaps, the `send-stage.mjs` fallback, `pick-up.mjs release` | `haiku` |
   | Gate runs and the evidence table, `evidence.json`, the test-first, UI capture and failure-sim command runs, `post-merge.mjs facts` and the deploy-check poll, the plan archive PR, the build log row, cleanup at archive, the tier 1 review | `sonnet` |
   | Planning, diagrams, implementation, tier 2 and tier 3 reviews, the acceptance run, dry runs, the merge assessment, the trial input, every stop comment and question, the Sentry read, the revert decision | the default (omit `model`) |

   A cheaper subagent only runs and reports. The session reads its report and decides. When the report is incomplete or contradicts its own output, rerun that step on the default model and say so in the run's notes.

   Before stage 5, list the changed paths with `git -c core.quotepath=false diff --name-only origin/main...HEAD`. The change's tier is the highest tier any path reaches:

   - Tier 3, code: any path that is not Markdown (`.md`), and any trusted-commands path (stage 5) whatever its extension.
   - Tier 1, record: a path under `.factory/plans/`, `openspec/changes/archive/` or `docs/`.
   - Tier 2, prose: any other Markdown path.

   | Check | Tier 1 | Tier 2 | Tier 3 |
   |---|---|---|---|
   | Gates (stage 5, each as it applies) | yes | yes | yes |
   | Trusted-commands guard | yes | yes | yes |
   | Independent diff review | one reviewer on `sonnet` | one reviewer, default model | one reviewer, default model |
   | The repo's `## Review` reviewers and fan-out | no | only the rule files whose globs match a changed path | yes |
   | Kanon audit | no | no | when the repo has PHP |
   | Acceptance run (the issue's acceptance commands as gate rows) | no | yes | yes |
   | Dry run | no | no | for a change to `factory/bootstrap/` or a stack pack only: run the changed stack and one existing stack on the same sample, as plan 64 did |

   Each tier keeps one recorded review, because `trial-decision.mjs` hands over when no review is recorded. The tier's reviewer satisfies poteto-mode's review gate. A repo's own `## Review` rule that is stricter for its paths (for example codyssey-cli stops on a docs-only diff with nothing to audit) still applies. The first line of the PR's `## Merge assessment` is `Tier: <n>, set by <path>.`, and the `verify` event summary starts with the same line.
   ```

2. Line 102, stage 5 Reviews. Replace "Reviews: give the reviewers only the diff, not your conclusions." with "Reviews: run the reviews the change's tier names (Models and check tiers). Give the reviewers only the diff, not your conclusions."

3. Line 110, stage 6 trial input. Replace "`requires_kanon_audit` (true when the repo has PHP, for example a root `composer.json`;" with "`requires_kanon_audit` (true when the change is tier 3 and the repo has PHP, for example a root `composer.json`;".

No other file changes. No script change: tiers are a path rule a run applies to one `git diff --name-only` list, and every tier records a review, so `trial-decision.mjs` keeps its input shape. No ADR: the tiers and models are playbook rules the owner can change in one edit.

## Probes against the code

Worktree `~/.factory/worktrees/codyssey-skills-141`, base be3b506, Node 26.13.0.

- Baseline. All 12 recipe checks exit 0 from a clean tree: pick-up 108, post-merge 23, capture-ui 115, trial-decision 39, test-first 36, install 30 and catalog 43 tests pass; bootstrap 5, event-model 4, factory-onboard 29 and standards-discovery 273 OK; `catalog ok: 14 family file(s), 366 entries`. standards-discovery takes about 176 s of the total.
- Tier replay. The tier rule above, as a throwaway node script over the changed files of the last 40 merged PRs (#69 to #147): tier 1 = 3 (#81, #117, #134, each a plan archive), tier 2 = 13 (#76, #109, #111, #122 to #124, #126 to #128, #130, #133, #135, #136), tier 3 = 24 (catalog JSON 13; scripts, tests or schemas 8; trusted paths 3: #83, #84, #86).
- Markdown a gate reads as data. `kanon/scripts/catalog.mjs check` validates the Kanon family references against `kanon/catalog/*.json`. Those PRs are tier 2, and the catalog check still runs, because every tier runs every gate. The tier only sizes the review, the acceptance run and dry runs.
- `trial-decision.mjs:163` pushes "No review is recorded." when `reviews` is empty, and `:164` asks for a Kanon review when `requires_kanon_audit` is true. Change 3 and the one-review-per-tier rule keep both right for tier 1 and tier 2.

## Diagrams

No diagrams: no trigger fired. The change adds no actor, no status or transition, no flow across modules or repos, and no external system or journey. The tier is a label a run computes once per change, not a status with transitions.

## Tests, one per acceptance criterion

| # | Criterion | Check |
|---|---|---|
| 1 | The playbook names the model per routine step | `grep -nF "#### Models and check tiers"` and the three model rows in the edited `factory.md`, read each hit |
| 2 | The playbook names the checks per tier | `grep -nF` the tier table header and the three tier bullets; Change 2 and Change 3 strings present; the replaced strings absent |
| 3 | `check-playbooks.mjs` prints no problem | Copy the edited `factory.md` to a temp `$HOME/.agents/playbooks/` and run `HOME=$T node <pstack>/skills/poteto-mode/scripts/check-playbooks.mjs $T`: exit 0. No bundled-step anchor changes, so this is a regression check. The real `~/.agents/playbooks/` is not touched. |
| 4 | The tier rule classifies real changes as the plan says | Rerun the replay over the same 40 PRs from the rule as written in the edited file: 3, 13, 24 |
| 5 | Recipe gates pass | The 12 `.factory/recipe.yml` checks at the head commit, clean tree |
| 6 | One real run of each tier shows the lighter path | Met after merge and install, not in this PR: #141's own implement run reads the installed playbook from before the merge. Tier 1: #141's archive run (the plan archive PR) shows `Tier: 1` and a `sonnet` review. Tier 2 and tier 3: the next factory PR of each tier shows its `Tier:` line and the checks it ran. The implement PR opens a follow-up issue that lists these three runs as its checklist. |

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

Plus the `check-playbooks.mjs` run from criterion 3 and the replay from criterion 4.

## Implement

One delegate, one worktree (`factory/141`), one file, three edits, no fan-out. By its own rule this PR is tier 2 (`playbooks/factory.md` and this plan). Trusted-commands flag: none, since `playbooks/factory.md` is not on the guard's list.

## Out of scope

- The lane prompts (`scheduled-tasks/*/SKILL.md`). Their busy check, install, claim, stale reports and release run before the session reads `factory.md`, so the model table cannot reach them. The issue asks for the playbook, not a prompt (decision 1).
- Narrowing gates by path, for example running only the catalog checks for a catalog-JSON change. The issue says gates always run.
- A `pstack-models.md` override sheet. It would change pstack defaults for every session, not only factory runs.
- Event model. Skip, no journey for internal tooling. This repo has no brain vault of its own.

## Open decisions

1. Lane prompt steps. Chosen: leave the lane prompts as they are and name the gap here. Alternative: add `model: "haiku"` to the subagent calls in steps 0, 1, 2, 4 and 7 of the three prompts. That trips the trusted-commands guard and makes this PR tier 3.
2. Tier 1 review. Chosen: one `sonnet` reviewer, so the trial record stays valid with no script change. Alternative: no review for tier 1, plus a `tier` input to `trial-decision.mjs` (with tests) that accepts an empty `reviews` for tier 1. That makes this PR tier 3.
3. Where the tier rule lives. Chosen: prose in `factory.md`, applied to one `git diff --name-only` list. Alternative: a `playbooks/scripts/change-tier.mjs` that prints the tier and the setting path, with tests and a recipe check (trusted-commands flag on `.factory/recipe.yml`).
4. Dry run scope. Chosen: only `factory/bootstrap/` and stack pack changes, the one place a two-run dry run is on record. Alternative: every skill change runs the changed skill twice on a fixture and compares the runs.
5. `playbooks/factory.md` and skill `SKILL.md` files are tier 2, though agents read them as instructions. Chosen: tier 2, which still gets a default-model review and the acceptance run. Alternative: put `playbooks/**` and `**/SKILL.md` in tier 3.
6. The Done-when runs. Chosen: a follow-up issue tracks the tier 2 and tier 3 runs, and #141 closes on merge as usual. Alternative: keep #141 open until one run of each tier has its `Tier:` line.

## Changes after review

The independent review of ae33a6e found these gaps in the approved wording. The implement run fixed them in playbooks/factory.md:

1. Stage 5 still said "Run the Kanon audit too." unconditionally, against the tier table. It now says to run it when the tier table says so.
2. A non-Markdown file under a tier 1 folder (an OpenSpec archive's YAML, an image under `docs/`) made the change tier 3, so a plan archive could not be tier 1. Tier 1 paths are now tier 1 whatever their extension, unless they are trusted-commands paths.
3. "The default (omit `model`)" could read as poteto-mode's per-role default. It now says the session's model, and that it overrides poteto-mode's per-role models for those steps.
4. "Stricter" repo `## Review` rules had no tie-break. The repo's rule wins, as project rules do.
5. Stage 8 made the archive PR with no tier, so criterion 6's tier 1 run had no place to show. The archive PR now carries the `Tier:` line and runs the gates and its tier's review.
6. The tier was computed once before stage 5. It is now recomputed at every new head.
7. "The issue's acceptance commands" had no defined source. The acceptance run is now the acceptance checks written from the issue text.
8. A Markdown-only bootstrap change was tier 2 and skipped the dry run. The dry run now applies to any change under `factory/bootstrap/` in tier 2 or 3, and the file says what a dry run is.
9. A tier reviewer with no fan-out had no defined `fan_out_complete`. It is now `true`, with a note in the merge assessment.
10. The archive PR's `Tier:` line clashed with the `## Why` first heading, and its evidence would overwrite the implement run's. The line goes under `## Why`, and its evidence goes in `archive/evidence.json`.
