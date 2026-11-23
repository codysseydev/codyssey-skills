# Codyssey skills

Reusable Claude Code skills for building applications that last. None of them
is tied to one project: copy a folder into your own project and use it. Most are for Laravel;
the `factory/` and `planning/` skills work with any stack.

Five folders, five different jobs:

| Folder | What it is | Use it on |
|---|---|---|
| `kanon/` | A fixed Laravel doctrine (`laravel-kanon`), the audit that checks code against it (`laravel-kanon-audit`), and a Symfony overlay of the Kanon (`symfony-kanon`) | Any Laravel or Symfony project of your own |
| `general/` | Procedures that work in any Laravel project: a standards review against the project's own conventions, manual API testing with curl, and a pre-release staging smoke test | Any Laravel project, including ones with established team standards |
| `factory/` | Stack-agnostic skills for the start of a software factory: a product brief from one sentence, a GitHub backlog from the approved brief, Event Model whiteboards from journey files, and repository bootstrap with a proven setup recipe | Any product, any stack |
| `planning/` | Checks for plans and proposals: verify a plan's claims against the repositories it names, and pick ideas to adopt from another repository | Any project, Laravel or not |
| `playbooks/` | The factory's per-issue playbook for PStack, plus a script that reports stages to the dashboard | Any GitHub issue labelled `factory` |

## kanon/

- `laravel-kanon`: the rulebook, loaded before writing code. Rules use MUST, SHOULD and
  MAY (RFC 2119), split into 13 reference files by what you are writing. It overrides the
  host project's conventions on purpose, so do not point it at a codebase with
  established team standards.
- `laravel-kanon-audit`: the audit, run after writing. It checks a branch or diff
  against the same reference files, one subagent per rule family, and takes each
  finding's severity from the rule's keyword.
- `symfony-kanon`: a minimal Symfony overlay of the Kanon with two rules (no
  `$container->get()`, writes go through a Messenger command to one handler). It reads
  `php-core.md` and `reliability.md` from `laravel-kanon`'s `references/` folder, so
  install it next to `laravel-kanon`. It has no audit yet.

Install `laravel-kanon` and `laravel-kanon-audit` together. The audit reads the
rulebook's `references/` folder, so the two folders must sit next to each other.

## general/

- `laravel-standards-review`: reviews a branch or diff against the project's own
  documented rules and the patterns its existing files follow, and only falls back to
  general Laravel norms where the project is silent. Use it on codebases you did not
  start, where the Kanon does not belong.
- `api-test`: calls a local Laravel API by hand with curl, in Sanctum SPA (session
  cookie) mode or bearer-token mode, with the fixes for the usual "CSRF token mismatch"
  and 401 errors.
- `smoke-test`: a phased Playwright walk of a staging environment before each release,
  ending with a comparison of the error tracker against a baseline taken at the start.
  Fill in `references/environment.md` with your URLs and test accounts before the first
  run. Credentials stay out of the files.

## factory/

- `brief-writer`: turns one sentence (a new product or a feature of an existing one) into
  a product brief through an interview. The brief covers pitch, persona, business problem,
  requirements with outside-observable checks, non-goals with reasons, deliverables and
  phases with stable feature IDs. It ends with a human approval, so it does not run
  unattended.
- `brief-to-backlog`: turns an approved brief into GitHub issues labeled `factory`, one
  per feature per repo, with acceptance criteria and a parseable `Depends on:` line. It
  has a dry run that writes the drafts to a file and makes no GitHub calls.
- `event-model`: draws a product's journeys as Event Model frames and Event Storming walls
  on claude.ai Whiteboard artifacts, generated from journey files kept in the product's
  brain vault. Per product it draws every journey; per feature it extends the journey file
  and syncs the feature's two boards before the plan stop. It ships Python scripts
  (`check`, `plan`, `commit`) and a sample product to copy.

- `bootstrap`: creates a product's brain vault and code repository from templates, sets up
  the event model journey folder in the brain, writes the repo's `.factory/playbook.md`
  through `factory-onboard`'s `write-playbook.py`, and proves the repo's recipe from a clean
  clone. Local only: it never creates GitHub repositories or pushes. Needs a
  brain template and a stack pack (Laravel today).
- `factory-onboard`: writes or updates a repository's `.factory/recipe.yml` (setup, checks,
  teardown) from its documented gates (workflow files, scripts, docs), proves it from a
  clean clone with `prove-recipe.py`, and opens a PR with the evidence. It also writes a
  starter `.factory/playbook.md` (the project file the factory playbook reads) with
  `write-playbook.py`, keeping an existing one and changing only drifted facts. Works on
  any repo.

Install `brief-writer` and `brief-to-backlog` together. The second reads what the first writes.
Install `bootstrap` with `factory-onboard` and `event-model`: the script calls both.

## planning/

- `review-plan-against-repos`: checks every factual claim in a plan or proposal note
  against the repositories, docs and services it names, reports each finding with a quote
  and `file:line`, and asks which findings to fix before it edits the note.
- `adopt-ideas-from-repo`: reads a reference repository through `gh api` without cloning
  it, checks its license (no license means ideas only, never code), maps its mechanisms
  onto the decisions your plan already made, and asks which ideas to adopt.

## playbooks/

- `factory.md`: the per-issue playbook for a software factory run, taking one GitHub issue
  labelled `factory` from pick-up to merged code. It extends PStack 0.9.143's `feature`,
  `bug-fix`, `opening-a-pr` and `babysit` playbooks, so it only lists the changes to their
  steps plus its own: the five human stops, the labels, the stage reports, evidence at the
  head commit, and cleanup of only what the run started.
- Per-project specifics (gates, review, scaffolding, local setup, cleanup) do not live
  here. Each repo keeps them at `.factory/playbook.md`, and `factory.md` reads that file at
  pick-up.
- `scripts/pick-up.mjs`: `claim`, `release` and `list` for the Desktop scheduled task. A
  claim creates a lock dir in `~/.factory/locks/`, creates any missing factory labels in the
  repo, and labels the issue `factory-running`.
  `claim` does nothing unless the arm file `~/.factory/armed` exists.
- `scripts/capture-ui.mjs`: detect, capture, compose and markdown for UI evidence on factory
  plan comments and PRs. Reads a project's `.factory/ui-capture.json` and loads Playwright
  from the project worktree, so it needs no install of its own. Its test
  `scripts/capture-ui.test.mjs` runs in this repo's recipe.
- `scripts/send-stage.mjs`: the fallback for reporting a stage to the factory dashboard
  when the `report_stage` MCP tool is not registered. Set `FACTORY_DASHBOARD_REPO` to the
  dashboard checkout.

## scheduled-tasks/

The prompts of the three Claude Desktop scheduled tasks that run the factory pick-up, one per
repo group: `factory-pickup/SKILL.md` (backend), `factory-pickup-frontend/SKILL.md` (frontend)
and `factory-pickup-tools/SKILL.md` (the tool repos). Each prompt's `--repo` flags name the repos
its lane watches. The install script writes them into the Desktop task folders.

## Install

Copy a skill folder into `.claude/skills/` in your project, or into `~/.claude/skills/`
to use it in every project. Install `laravel-kanon` and `laravel-kanon-audit`
side by side. Install `symfony-kanon` next to `laravel-kanon` too, because it reads
files from `laravel-kanon`'s `references/` folder.

For the playbook, the factory skills (`bootstrap`, `brief-to-backlog`, `brief-writer`,
`event-model`, `factory-onboard`) and the scheduled task prompts, run the install script from a
checkout of this repo:

```
node playbooks/scripts/install.mjs --source .
```

The first install runs the script from the checkout. Later runs use the installed copy,
`node ~/.agents/playbooks/scripts/install.mjs --source <checkout>`. It fetches the checkout's
`origin` and installs `origin/main`, or installs `--ref <ref>` without fetching. It reads files
from the commit, not the working tree, so a dirty checkout does not matter. It copies
`playbooks/` into `~/.agents/playbooks/`, each factory skill into `~/.claude/skills/<name>/` and
each task prompt into `~/.claude/scheduled-tasks/<name>/SKILL.md`, writes the commit sha to `~/.agents/playbooks/.installed-sha`, rewrites only files that
changed, and never deletes a file. It writes a task prompt only when the task folder exists,
which Claude Desktop creates with the task, and lists a missing one under `skipped`. It refuses
with exit 3 while a claim lock in `~/.factory/locks/` is live. Set `FACTORY_AGENTS_DIR`,
`FACTORY_SKILLS_DIR`, `FACTORY_TASKS_DIR` or `FACTORY_HOME` to install somewhere else. For a single repository, copy `playbooks/` into its `.agents/playbooks/`
by hand instead.

After each PStack upgrade, run PStack's `check-playbooks.mjs` from the repository root. It
fails when an upgrade rewrote a step the playbook quotes.

For unattended runs:

- Register the report MCP server once:
  `claude mcp add --scope user report-stage -- sh <dashboard checkout>/mcp/report-stage/run.sh`.
- Create each lane task once in Claude Desktop: `factory-pickup`, `factory-pickup-frontend` and
  `factory-pickup-tools`, Hourly, Auto permission mode. The instructions text does not matter.
  Then run the install: it writes each prompt from `scheduled-tasks/` over the task's file, and
  each armed tick reinstalls it. Schedule, folder and permission mode stay in Desktop.
- `mkdir -p ~/.factory && touch ~/.factory/armed` arms it. `rm ~/.factory/armed` disarms it.

## License

MIT. See `LICENSE`.
