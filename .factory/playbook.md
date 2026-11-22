# Factory project file: codyssey-skills

Holds codyssey-skills' specifics for the factory playbook in codysseydev/codyssey-skills (playbooks/factory.md). `factory-onboard` wrote the first version from the repo. A PR that changes a check command or the local setup updates this file in the same change.

## Checks

The gates are the checks in `.factory/recipe.yml`: `pick-up-tests`, `capture-ui-tests`, `test-first-tests`, `bootstrap-tests`, `event-model-tests` and `factory-onboard-tests`. They are the test files the repo ships. The repo has no `.github/workflows/`, no `package.json` and no `pyproject.toml`, and configures no linter, so there is no CI to copy. GitHub Actions on the org is blocked by billing, so these local runs stand in for CI. Gates the recipe lacks:

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
- The factory runs the installed copies, not this repo. `~/.agents/playbooks/` and the skills in `~/.claude/skills/` are plain copies made by hand (README "Install"), and nothing syncs them. A merged change to `playbooks/` or `factory/` takes effect only after the owner copies it there from `main`. A run on this repo edits its worktree, never the installed copies.
