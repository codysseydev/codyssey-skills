# Factory project file: codyssey-skills

Holds codyssey-skills' specifics for the factory playbook in codysseydev/codyssey-skills (playbooks/factory.md). `factory-onboard` wrote the first version from the repo. A PR that changes a check command or the local setup updates this file in the same change.

## Checks

The gates are the checks in `.factory/recipe.yml`: `pick-up-tests`, `capture-ui-tests`, `trial-decision-tests`, `test-first-tests`, `post-merge-tests`, `bootstrap-tests`, `event-model-tests`, `factory-onboard-tests`, `install-tests`, `kanon-catalog-check` and `kanon-catalog-tests`. All but `kanon-catalog-check` are the test files the repo ships; `kanon-catalog-check` is a data check that runs `kanon/scripts/catalog.mjs check` on the Kanon catalog. The repo has no `.github/workflows/`, no `package.json` and no `pyproject.toml`, and configures no linter, so there are no workflow files to take commands from. These local runs are the gates. The factory does not use GitHub Actions. Gates the recipe lacks:

None yet.

## Review

None yet. The repo has no `.claude/skills` reviewer and no `.ai/rules/`.

## Scaffolding

None yet.

## Local setup

The recipe has no setup steps. The checks need `node` 22.18 or newer, or 24.2 or newer (for `node --test`; `kanon-catalog-check` fails on an older Node), and `python3`, and no install, `.env` file or services. `kanon-catalog-check` also needs `git` and an `origin/main` ref in the checkout, because it reads the base IDs at the merge-base with `origin/main`. The check compares against the `origin` remote's main, so a clone of a fork compares against the fork's main. The checkout must be a full clone: in a shallow clone that lacks the common ancestor, the check falls back to the `origin/main` tip, which can fail a branch that is behind main.

## Cleanup

Setup starts no containers or servers. Nothing to remove.

## Notes

- `factory/event-model/scripts/lint.py` lints event models, not this repo's code, so it is not a gate.
- The factory runs the installed copies, not this repo: `~/.agents/playbooks/` and the five factory skills in `~/.claude/skills/`. `node playbooks/scripts/install.mjs --source <checkout>` syncs them from `origin/main` (README "Install"), and the scheduled pick-up runs it before `claim` when the factory is armed. A merged change to `playbooks/` or `factory/` takes effect on the next install, not at merge. The install never deletes, so a file removed from the repo stays installed. A run on this repo edits its worktree, never the installed copies.

## Post-merge

The archive run checks main after the PR merges. This repo ships no deployed service, so there is nothing to watch.

- Deploy check: none
- Sentry: none
