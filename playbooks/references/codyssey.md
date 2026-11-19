# Codyssey backend

Specifics for running the factory playbook (`../factory.md`) in `codysseydev/codyssey`. This is not a playbook, so PStack's checker does not read it. It comes from run 1 (issue #462, PR #910).

## Gates

The backend has no `.factory/recipe.yml` yet, so these are the gates until it does. Run them from a clean tree at the head commit and record each exit code.

| Gate | Command |
|---|---|
| Pint | `vendor/bin/pint --test` |
| PHPArkitect | `vendor/bin/phparkitect check` |
| PHPStan | `vendor/bin/phpstan analyse --memory-limit=2G` |
| PHPUnit | `php artisan test --parallel --recreate-databases` |
| API versions | `php tools/api-versions/check.php origin/main` |

- The full suite was 8622 tests and took about 3m40s at run 1's head.
- Then run the `codyssey-reviewer` skill and check that its per-family fan-out ran. Run 1's passes never read `authorization.md` or `statamic.md`.
- Then run the Kanon audit (`laravel-kanon-audit`).

## Scaffolding and delegates

- Scaffold with `/new-slice`, `/new-module` and `/admin`. Never `php artisan make:*` (ADR-021).
- Implementer subagent: `.claude/agents/codyssey-implementer.md`.

## Local setup for a fresh worktree

Run 1 did this with no human step.

1. Record what is already running: `docker ps`.
2. From the main checkout, bring the stack up: `spin up -d --skip-pull` (16 s; it recreated mailpit).
3. In the worktree, run `composer install --no-interaction --no-scripts` on the host (10 s). It gives a real `vendor/`, not a symlink.
4. Copy `.env` from the main checkout. Set `DB_HOST`, `REDIS_HOST`, `TYPESENSE_HOST` and `MAIL_HOST` to `127.0.0.1`, and `AWS_ENDPOINT` to `http://127.0.0.1:9000`.
5. Run `composer dump-autoload` (its post-autoload-dump hook publishes the Filament assets), then `php artisan package:discover`.
6. Create a private test database `codyssey_testing_<tag>` in the `codyssey-mysql-1` container. Use the database credentials from the main checkout's `.env`. Do not write a username or password into any file.
7. Run tests as `DB_DATABASE=codyssey_testing_<tag> php artisan test --compact --parallel [--recreate-databases] <path>`. `artisan test` takes ONE path per run.

PHP 8.5 on the host boots the app.

## Cleanup at archive

- Drop the `codyssey_testing_<tag>` databases. Paratest adds worker suffixes, so drop those too.
- Remove the worktree's `vendor/` and `.env`.
- Stop only the containers the run started (step 1 of the setup lists what was already up).

## GitHub Actions

On run 1 no job started: "recent account payments have failed or your spending limit needs to be increased". Local evidence at the head commit stood in for CI, and the PR said so.

## Dashboard

The dashboard is at `https://factory.codyssey.dev`. `report_stage` lives in the private `codyssey-factory-dashboard` repo under `mcp/report-stage/`, with a wrapper script that fetches the token. Never write the token, or the name of where it is stored, into a file or a PR.

## This Mac

The orchestrator hook reads `|` in a grep pattern as a shell pipe. Send searches with alternation to subagents, or use `grep -e A -e B`.
