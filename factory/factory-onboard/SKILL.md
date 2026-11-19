---
name: factory-onboard
description: Write or update a repository's `.factory/recipe.yml` (setup, checks, teardown), prove it from a clean clone, and open a PR with it. Use on a fresh bootstrap repo or on a client repo the factory will work in, and whenever CI or the toolchain changed. Not for writing application code or fixing failing tests.
---

# Factory onboard

Give a repository a recipe the factory can run: how to set it up, which checks gate a change, and how to tear it down. Then prove the recipe from a clean copy, so "it works on my machine" is not the evidence.

## Inputs

- The repository path.
- Mode: normal (open a PR) or dry run (commit the recipe on the current branch, open nothing).

## The recipe

`.factory/recipe.yml`, in exactly this shape:

```
version: 1
setup:
  - name: <id>
    run: <one-line shell command, run from the repo root>
checks:
  - name: <id>
    run: <command>
teardown:
  - name: <id>
    run: <command>
```

- Names match `[A-Za-z0-9][A-Za-z0-9_.-]*` and are unique within a section.
- Values are plain or quoted one-liners. No block scalars, no lists, no anchors, no extra keys.
- Put several commands on one line with `&&`, or move them into a script in the repo and call it.
- `setup` and `teardown` may be `[]`. `checks` needs at least one step.
- Setup steps run in order and the first failure stops the run. Checks run in order. Teardown always runs.

The Laravel pack writes this file for a fresh repo. For any other repo, write it from what the repo already says.

## Steps

1. Read the repo's CI config (`.github/workflows/`, `.gitlab-ci.yml`, or the equivalent), `README`, `composer.json` or `package.json` scripts, `Makefile`, and any `CONTRIBUTING` or `docs/` setup page.
2. If `.factory/recipe.yml` exists, keep every step that still matches CI. Change only what drifted.
3. Setup steps install dependencies and prepare the app the way a new developer would on a clean machine: copy the env file, install, generate keys, migrate, build assets.
4. Checks are the commands CI runs to decide a change is good: tests, static analysis, architecture rules, formatting. Copy them from CI, do not invent new ones. One check per command, so a failure names the check.
5. Teardown stops anything setup started (containers, servers). Leave it `[]` when setup starts nothing.
6. Commit the file. The proof clones `HEAD`, so an uncommitted recipe is refused.
7. Prove it: `python3 ~/.claude/skills/factory-onboard/scripts/prove-recipe.py <repo> --out recipe-evidence.json`. Fix the recipe, commit, and prove again until it passes. Add `--keep-going` to see every failing check in one run.
8. Open a PR with the recipe and the evidence summarized in the description: head sha, each step with its exit code and duration. In a dry run, stop after the commit and report the same summary.

If a check fails because the repo itself is broken (the tests fail on a clean clone), do not weaken the recipe. Report the failure with the output tail and stop.

## What the proof does

`scripts/prove-recipe.py` runs `git clone` of the local repo into a temp directory, so `vendor/`, `.env` and untracked files are gone. It runs the steps with `shell=True` from the clone's root, then prints JSON and writes it to `--out`: repo, head sha, `clean: true`, each step's phase, name, command, exit code, duration and output tail, and an overall `passed`. Exit code 0 only when everything passed, 1 when a step failed, 2 when the recipe is missing, uncommitted or malformed.

Options: `--keep-going`, `--timeout SECONDS` per step (default 1800), `--keep-copy` to leave the clean copy for debugging.

## Trusted commands

The gates depend on the recipe, so the recipe is trusted input. A PR that edits `.factory/recipe.yml`, the phpstan, phparkitect, phpunit or rector configs, composer scripts, `.ai/rules/` or CI files can switch off a gate, so a human reads it carefully before merge. Say so in the PR description when your change touches any of them.

## Return

The recipe path, the evidence file, pass or fail with the failing step, and the PR link (or the commit hash in a dry run).
