# Factory project file: codyssey-skills

Holds codyssey-skills' specifics for the factory playbook in codysseydev/codyssey-skills (playbooks/factory.md). `factory-onboard` wrote the first version from the repo. A PR that changes a check command or the local setup updates this file in the same change.

## Checks

The gates are the checks in `.factory/recipe.yml`: `pick-up-tests`, `capture-ui-tests`, `trial-decision-tests`, `test-first-tests`, `post-merge-tests`, `bootstrap-tests`, `event-model-tests`, `factory-onboard-tests` and `install-tests`. They are the test files the repo ships. The repo has no `.github/workflows/`, no `package.json` and no `pyproject.toml`, and configures no linter, so there are no workflow files to take commands from. These local runs are the gates. The factory does not use GitHub Actions. Gates the recipe lacks:

None yet.

## Review

None yet. The repo has no `.claude/skills` reviewer and no `.ai/rules/`.

## Scaffolding

None yet.

## Local setup

The recipe has no setup steps. The checks need `node` (for `node --test`) and `python3`, and no install, `.env` file or services.

## Cleanup

Setup starts no containers or servers. Nothing to remove.

## Notes

- `factory/event-model/scripts/lint.py` lints event models, not this repo's code, so it is not a gate.
- The factory runs the installed copies, not this repo: `~/.agents/playbooks/`, the five factory skills in `~/.claude/skills/` and the lane prompts in `~/.claude/scheduled-tasks/`. `node playbooks/scripts/install.mjs --source <checkout>` syncs them from `origin/main` (README "Install"), and the scheduled pick-up runs it before `claim` when the factory is armed. A merged change to `playbooks/`, `factory/` or `scheduled-tasks/` takes effect on the next install, not at merge. The install never deletes, so a file removed from the repo stays installed. A run on this repo edits its worktree, never the installed copies.

## Post-merge

The archive run checks main after the PR merges. This repo ships no deployed service, so there is nothing to watch.

- Deploy check: none
- Sentry: none
