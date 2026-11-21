# Plan for #16, local gate evidence is the standing rule

Issue codysseydev/codyssey-skills#16. Base origin/main 8c85764. Branch `factory/16`.

## Goal

Every file in this repo says the factory's gate evidence comes from local runs at the head commit, always. No instruction tells a run to wait for, poll or trigger GitHub Actions, or to propose adding it. Workflow files stay in use only as a list of gate commands.

## Data shape

Prose only, no code. Each change replaces one sentence or phrase, named by its exact text at 8c85764. Line numbers are those of 8c85764 and match the issue.

## Changes

### `playbooks/factory.md`

1. Line 75, stage 5 Gates. Replace `When GitHub Actions cannot run (billing, no minutes), the local evidence stands in for CI and the PR says so.` with `This local evidence is the CI. The factory does not use GitHub Actions (standing rule, owner, 2026-11-20): a run never waits for, polls or triggers a workflow run, never treats an Actions check on the PR as a gate, and never proposes adding a workflow. The PR carries the evidence table and the head sha.`
2. Line 78, trusted-commands guard. Replace `` `.ai/rules/` or CI files.`` with `` `.ai/rules/` or workflow files (`.github/workflows/`, `.gitlab-ci.yml`), which list gate commands.``
3. "Changes to the bundled steps", new item after the `**In** "A conflict and the watcher's ...` item: `- **In** "Order: conflicts, threads, CI." the CI part is the local gate evidence at the head commit (stage 5). An Actions check on the PR, whether queued, failing or missing, is not a blocker. Do not wait for it, rerun it or fix it.` The factory playbook extends babysit, and babysit orders "conflicts, threads, CI". `codysseydev/laravel-template` keeps its five workflow files (owner, 2026-11-20), so every product repo's PRs show Actions checks that cannot run reliably. Without this line the inherited babysit step sends a run to work through them.

### `.factory/playbook.md`

4. Line 7. Replace `so there is no CI to copy. GitHub Actions on the org is blocked by billing, so these local runs stand in for CI.` with `so there are no workflow files to take commands from. These local runs are the gates. The factory does not use GitHub Actions.`

### `factory/factory-onboard/SKILL.md`

5. Line 3, description. `whenever CI or the toolchain changed` becomes `whenever the gate commands or the toolchain changed`.
6. Line 53. `from the README, `docs/`, `CLAUDE.md` and CI.` becomes `from the README, `docs/`, `CLAUDE.md` and any workflow files.`
7. Line 55. `when the repo, the README, `docs/` or CI shows it drifted` becomes `when the repo, the README, `docs/` or a workflow file shows it drifted`. The issue does not list this line. It carries the same framing, so it changes with the rest.
8. Line 59, step 1. `Read the repo's CI config (`.github/workflows/`, `.gitlab-ci.yml`, or the equivalent), ` becomes `Read the repo's workflow files (`.github/workflows/`, `.gitlab-ci.yml`, or the equivalent) as a list of gate commands, `. Append to the step: `Workflow files are a source of commands only. Never run, trigger or wait for GitHub Actions, and never add a workflow to a repo that has none. The proof in step 8 is the evidence.`
9. Line 60, step 2. `keep every step that still matches CI` becomes `keep every step that still matches the documented gates (workflow files, scripts, docs)`.
10. Line 62, step 4. `Checks are the commands CI runs to decide a change is good` becomes `Checks are the commands the repo uses to decide a change is good`, and `Copy them from CI, do not invent new ones.` becomes `Copy them from the workflow files, scripts and docs, do not invent new ones.`
11. Line 64, step 6. `Refine its sections from the README, `docs/`, `CLAUDE.md` and CI.` becomes `Refine its sections from the README, `docs/`, `CLAUDE.md` and any workflow files.`
12. Line 79, Trusted commands. `or CI files can switch off a gate` becomes `or workflow files can switch off a gate`.

### `README.md`

13. Line 70. `teardown) from its CI config and docs, proves it` becomes `teardown) from its documented gates (workflow files, scripts, docs), proves it`, rewrapped to the file's width.

No ADR. The rule is the owner's decision, already recorded in the brain (`Ideas/Software Factory Pipeline.md`, "Evidence at the head commit", and "Not GitHub Actions"). This repo has no ADR folder.

## Tests, one per acceptance criterion

| # | Criterion | Check |
|---|---|---|
| 1 | `playbooks/factory.md:75` and `:78` reworded | `! git grep -q -i -e "stands in for CI" -e "cannot run (billing" -- playbooks/factory.md`, plus a diff read |
| 2 | `.factory/playbook.md:7` reworded | `! git grep -q -i -e billing -e "stand in for CI" -- .factory/playbook.md` |
| 3 | `factory-onboard/SKILL.md` lines 3, 53, 59, 60, 62, 64, 79 reworded, parity kept, never runs or waits for Actions | `git grep -n -w CI -- factory/factory-onboard/SKILL.md` finds nothing, and `git grep -q "never add a workflow" -- factory/factory-onboard/SKILL.md` exits 0 |
| 4 | `README.md:70` reworded | `! git grep -q "CI config" -- README.md` |
| 5 | No instruction to wait for, poll, trigger or propose Actions | `git grep -n -i -e "github actions" -e "workflow" -e "billing"` and a hit-by-hit read. See the note below |
| 6 | Tests pass per `.factory/recipe.yml` | The four recipe checks at the head commit, clean tree |

Extra gate for change 3. `playbooks/factory.md` copied to a temp `$HOME/.agents/playbooks/`, then `check-playbooks.mjs` run there, so the new babysit anchor is checked against pstack 0.9.143.

Note on criterion 5. The issue says the grep should show only the "Actions is not used" sentences "plus the unrelated hits listed under Why". The hits listed under Why are `CI` lines in `general/laravel-standards-review`, which this grep does not match. The grep's real unrelated hits are domain words: `Billing,Catalog` module names in `factory/bootstrap` (SKILL.md:24, scripts/bootstrap.py:5, tests/test_bootstrap.py:53, 61, 94), billing pages in `general/smoke-test/SKILL.md` (71, 72, 80), the `## Workflow` heading in `kanon/laravel-kanon-audit/SKILL.md:44`, and `App\Billing` in `kanon/laravel-kanon/references/architecture.md:15`. This plan reads the criterion as "every other hit is a domain word, not about CI".

## Probes against the code

Baseline at 8c85764. Pick-up 47 pass, bootstrap 3 OK, event-model 4 OK, factory-onboard 25 OK.

The 13 changes were applied to a scratch copy and each old text was found exactly once on origin/main. P2: the same four gates pass after the edits (47, 3, 4, 25, all exit 0). P3: the grep shows only the reworded Actions and workflow-file sentences plus the expected domain-word hits above, with no other hit. P5: `check-playbooks.mjs` prints "Every project playbook matches this pstack's playbooks." for the edited `factory.md` (exit 0), and fails with exit 1 when the new anchor is altered, so the new babysit anchor is checked.

## Gates

From the worktree root, at the head commit, clean tree.

```sh
node --test playbooks/scripts/pick-up.test.mjs
python3 -m unittest discover -s factory/bootstrap/tests
python3 -m unittest discover -s factory/event-model/tests
python3 -m unittest discover -s factory/factory-onboard/tests
! git grep -q -i -e "stands in for CI" -e "cannot run (billing" -- playbooks/factory.md
! git grep -q -i -e billing -e "stand in for CI" -- .factory/playbook.md
! git grep -q -w CI -- factory/factory-onboard/SKILL.md
git grep -q "never add a workflow" -- factory/factory-onboard/SKILL.md
! git grep -q "CI config" -- README.md
```

Plus the `check-playbooks.mjs` run above.

## Implement

One delegate, one worktree (`factory/16`), four files, no fan-out. The edits are prose in disjoint files, but a single owner keeps the wording consistent across them. Trusted-commands flag: the PR edits `.factory/playbook.md`, so the PR description says a human reads it.

## Out of scope

- Template workflow files. The owner decided on 2026-11-20 that `codysseydev/laravel-template` keeps `template/.github/workflows/`.
- `general/laravel-standards-review`. Its `CI` lines describe the reviewed project's own tooling (issue, "Not affected").
- The brain note `Ideas/Software Factory Pipeline.md` line 136 still lists "CI files" in the trusted-commands guard. The brain is not in this repo, and line 135 already states the rule.
- Other repos. `codyssey-frontend` and `codyssey-cli` have no Actions, billing or "in for CI" wording in `.factory`. `codyssey` `.factory/playbook.md:18` still says Actions failed on a billing error and local evidence "stood in for CI", so it needs the same rewording in its own issue. None of codyssey, codyssey-frontend, codyssey-cli or codyssey-skills has branch protection on main (the API returns 404), so no required status check depends on Actions.
- Event model. Skip, no journey for internal tooling. This repo has no brain vault of its own.

## Owner follow-ups

- After merge, copy `playbooks/factory.md` to `~/.agents/playbooks/factory.md` and `factory/factory-onboard/SKILL.md` to `~/.claude/skills/factory-onboard/SKILL.md`. The copies are made by hand and nothing syncs them.

## Open decisions

1. The babysit override (change 3). Chosen, add it. The issue's list does not name it, but without it the inherited babysit step tells a run to work through Actions checks on every product repo, which criterion 5 forbids. Alternative, keep to the issue's list and leave babysit as inherited.
2. Line 55 of the factory-onboard skill (change 7). Chosen, reword it with the rest. Alternative, leave it, since criterion 3 does not list it.
3. Wording at line 75. Chosen, `This local evidence is the CI.`, the same words as the brain's rule. Alternative, avoid the word CI: `These local runs are the gates.`
4. Criterion 5's unrelated hits, read as above. Alternative, ask the owner to restate the criterion.
