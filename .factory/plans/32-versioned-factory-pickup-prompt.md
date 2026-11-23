# Plan for #32, version the factory-pickup prompt and fix the Scheduled pick-up docs

Issue codysseydev/codyssey-skills#32. Base origin/main ad19dcd. Branch `factory/32`.

Kind: feature (docs and install script, no bug label).

## Goal

The `factory-pickup` task prompt lives in this repo, and `install.mjs` writes it to `~/.claude/scheduled-tasks/factory-pickup/SKILL.md` under the rules it uses for every other file. The prompt runs the install before `claim`. `factory.md` points at the prompt instead of repeating its repo list, says how a run resumes after `needs-decision`, and its trusted-commands guard lists the prompt. README "For unattended runs" tells the truth.

## Problem

- The live prompt `~/.claude/scheduled-tasks/factory-pickup/SKILL.md` (3740 bytes, sha256 `6fd0c94d8a895d0ac55c0506d9f8e482b0a89c1020a78c1975f6fe14a185e1b0`, read for this plan) is in no repo. The implement run starts from this version. If the hash differs then, it reads the live file again and keeps the owner's edits. Its frontmatter is `name: factory-pickup` and a `description`. Its body has steps 1 to 6: claim across four repos, end on a non-zero exit, report each `stale` entry as `failed`, end on `not_armed` or `none`, run `pstack:poteto-mode` with a checkout map, always release. The checkout map uses absolute home paths (`/Users/<name>/Code/GitHub/Codyssey/<repo>`).
- The live prompt has no install step. `playbooks/factory.md:20` already says "When armed, it first runs the install (first bullet), then calls ... claim", and `:22` describes that install. PR #25 left the prompt edit to the owner (its Scope section). So the playbook describes a step the prompt does not run.
- `playbooks/factory.md:20` names one repo: `claim --repo codysseydev/codyssey --run-id <run id>`. The prompt claims across `codysseydev/codyssey`, `codyssey-frontend`, `codyssey-cli` and `codyssey-skills` (live prompt line 10).
- `README.md:142-143` says "Its prompt text lives in `playbooks/factory.md` under Scheduled pick-up". It does not.
- Resume after a question is not written down. `needs-decision` is in `SKIP_LABELS` (`playbooks/scripts/pick-up.mjs:29-35`, the label at `:33`), and `evaluateIssue` returns `has label needs-decision` for it (`:114-116`). Once the label is gone, an open issue gets `implement` with `plan-approved` and `plan` without it (`:138`). The dashboard's Answer action posts one comment and then removes the label (codyssey-factory-dashboard `src/inboxActions.ts:218-221` at origin/main c7706b3, test "Answer posts one comment, then removes needs-decision" at `app/tests/inboxActions.test.ts:586`). codyssey#915 shows the pattern: `needs-decision` added 2026-11-21T08:41:08Z, removed 11:59:02Z, next `factory-running` 2026-11-22T01:06:40Z (issue timeline).
- The guard at `playbooks/factory.md:87` (the issue says 83) lists `.factory/` files, tool configs and workflow files, not the prompt, although the prompt holds the claim and install commands.

What Desktop keeps where. From the docs page "Schedule recurring tasks in Claude Code Desktop" (code.claude.com/docs/en/desktop-scheduled-tasks): the SKILL.md "uses YAML frontmatter for `name` and `description`, with the prompt as the body. Changes take effect on the next run. Schedule, folder, and enabled state are not in this file." On Delete, "The folder holding the task's `SKILL.md` file stays on disk". `list_scheduled_tasks` for this plan:

```
taskId factory-pickup, title "Factory pick-up (hourly)", cronExpression "0 * * * *",
enabled true, jitterSeconds 355, path ~/.claude/scheduled-tasks/factory-pickup/SKILL.md
```

`~/.claude/scheduled-tasks/` holds two folders, `factory-pickup/` and `factory-pickup-dryrun/`, each with only a `SKILL.md`. The listing has only `factory-pickup`. The title and schedule are in no file under the folder. So a task is a Desktop registration plus a SKILL.md, and the file alone holds only name, description and body.

Repo visibility: `gh repo view codysseydev/codyssey-skills --json visibility` gives `{"visibility":"PUBLIC"}`. `git grep -n '/Users/' origin/main` prints nothing.

## Behaviour

| Case | Today | After |
|---|---|---|
| Prompt source | only `~/.claude/scheduled-tasks/factory-pickup/SKILL.md`, no history | `scheduled-tasks/factory-pickup/SKILL.md` in this repo |
| Install, task folder exists | prompt untouched | prompt written when its bytes differ, listed in `changed` |
| Install, task folder missing | n/a | prompt not written, folder listed in `skipped` (open decision 1, option A) |
| Install, rerun with nothing new | n/a | prompt bytes and mtime unchanged |
| Install, live claim lock | exit 3, nothing written | same, prompt included |
| Armed tick | claim only | install, then claim. Install exit 3 or any failure: go on to claim, say so in the final message |
| Checkout paths in the prompt | `/Users/<name>/Code/GitHub/Codyssey/<repo>` | `~/Code/GitHub/Codyssey/<repo>` |
| factory.md Scheduled pick-up | claim command with one `--repo` | pointer to the versioned prompt |
| Resume after `needs-decision` | not documented | one bullet |
| Guard, factory.md:87 | no prompt path | lists `scheduled-tasks/` |
| README For unattended runs | says the prompt is in factory.md | create the task once, the install writes its prompt |

## Data shape

`installMap` (`playbooks/scripts/install.mjs:34-39`) keeps `{ prefix, dir }` and gains one optional field, `existingOnly: true`, for targets the install updates but never creates. `makeDeps` gains `tasksDir`.

```js
export const FACTORY_TASKS = ['factory-pickup'];

export function installMap({ agentsDir, skillsDir, tasksDir }) {
  return [
    { prefix: 'playbooks/', dir: join(agentsDir, 'playbooks') },
    ...FACTORY_SKILLS.map((name) => ({ prefix: `factory/${name}/`, dir: join(skillsDir, name) })),
    ...FACTORY_TASKS.map((name) => ({ prefix: `scheduled-tasks/${name}/`, dir: join(tasksDir, name), existingOnly: true })),
  ];
}
```

`install()` result: `{ status: 'installed', sha, changed: [dest], skipped: [dir] }`. `skipped` is always present and lists each `existingOnly` dir that does not exist. The refusal shape `{ status: 'refused', locks }` is unchanged.

Under option B (open decision 1) the field and `skipped` go away and the entry is a plain `{ prefix, dir }`.

## Changes

### `scheduled-tasks/factory-pickup/SKILL.md` (new)

The live prompt, with two changes.

1. Each `/Users/<name>/Code/GitHub/Codyssey/<repo>` in step 5 becomes `~/Code/GitHub/Codyssey/<repo>`. The prompt already uses `~` for `~/.claude/CLAUDE.md`, `~/.agents/playbooks/...` and `~/.factory/armed`, and its shell lines run in subagents, where `~` expands.
2. A new step 0 before step 1, so step 6's "when step 5 ran" still holds. The wording follows PR #25's Scope and `factory.md:22`:

   ```
   0. Install. Through ONE subagent, run this and return its JSON output, its stderr and its exit code:
      if [ -e ~/.factory/armed ]; then node ~/.agents/playbooks/scripts/install.mjs --source ~/Code/GitHub/Codyssey/codyssey-skills; else echo not_armed; fi
      Never end the run on this step. Exit 0: go on. Exit 3: another run holds a live claim lock and the install wrote nothing; go on with the installed copy. Any other exit: go on with the installed copy, which may be partly updated. In both non-zero cases put the exit code and the first stderr line in the final message.
   ```

   Every final message carries the install note, not only the step 5 and 6 one. Step 2's "pick-up error" message and step 4's one-line status message each gain "and the install result when step 0 ran (`changed` count, refused or failed)", and so does the closing "Final message" line. Without this, a refused or failed install on a `none` tick goes unreported, and `factory.md:22` says the run says so. Frontmatter `name` and `description` stay as they are. The install rewrites this file during the tick that reads it. Desktop applies a prompt change on the next run (docs, above), so the tick in progress is not affected.

### `playbooks/scripts/install.mjs`

- `FACTORY_TASKS` and `installMap` as in Data shape.
- `makeDeps` (`:49-57`): `tasksDir: env.FACTORY_TASKS_DIR || join(homedir(), '.claude', 'scheduled-tasks')`.
- `planInstall` (`:92-123`): drop entries whose target is `existingOnly` and whose `dir` does not exist (`lstatSync(dir, { throwIfNoEntry: false })`), and return those dirs as `skipped`. The symlink checks at `:94-96` and `:113-118` apply to the new target unchanged.
- Error text at `:121`, "has no playbooks/ or factory skill files to install", becomes "has no files to install".
- Header comment (`:1-18`): name the prompt target and `FACTORY_TASKS_DIR`.

### `playbooks/scripts/install.test.mjs`

Shared setup, so no test touches the real home:

- `fixture()` (`:53-83`): `tasksDir = join(root, 'tasks')`, created with its `factory-pickup/` folder, and `FACTORY_TASKS_DIR: tasksDir` in the `runScript` env (`:71`).
- `baseFiles` (`:40-49`): add `scheduled-tasks/factory-pickup/SKILL.md` (`prompt ${v}\n`) and `scheduled-tasks/not-listed/SKILL.md`.
- `nothingWritten` (`:110-113`): also asserts `tasksDir` holds only the empty `factory-pickup/` folder.
- `depsWith` (`:318-327`): add `tasksDir`.
- Count assert at `:130` and the file list at `:174-177` include `tasksDir`. The test at `:272-278` also asserts `readdirSync(f.tasksDir)` is `['factory-pickup']`.

New tests:

| Test | Checks | Helpers | At base |
|---|---|---|---|
| `installs the factory-pickup prompt byte for byte into its existing task folder` | Commits the real `scheduled-tasks/factory-pickup/SKILL.md` bytes (read relative to `SCRIPT`) into the fixture, installs, asserts `readFileSync(installed).equals(repoBytes)` and that `changed` lists it | `fixture`, `commit`, `f.run` | fails |
| `a rerun leaves the installed prompt and its mtime alone` | Second run: `changed` is `[]`, prompt mtime unchanged | `fixture`, `f.run` | fails |
| `a live lock refuses and leaves the installed prompt as it was` | Install v1, push a v2 prompt, `writeLock` a live lock, run without `--ref`: exit 3, prompt still v1 | `fixture`, `commit`, `writeLock`, `read` | fails |
| `without a factory-pickup task folder the prompt is not written and is listed under skipped` | `rmSync` the folder, install: exit 0, no prompt file, `skipped` is `[join(tasksDir, 'factory-pickup')]` | `fixture`, `listFiles` | fails |
| `the repo prompt has the frontmatter Desktop reads and no home path` | The real file starts with `---`, has `name: factory-pickup` and a non-empty `description`, and contains no `/Users/` | `read` | fails (no file) |

`install-tests` goes from 22 to 27 passing.

### `playbooks/factory.md`

- `:20`. "When armed, it first runs the install (first bullet), then calls `node ~/.agents/playbooks/scripts/pick-up.mjs claim --repo codysseydev/codyssey --run-id <run id>`." becomes "Its prompt is `scheduled-tasks/factory-pickup/SKILL.md` in codysseydev/codyssey-skills, installed by `install.mjs`. When armed, it first runs the install (first bullet), then `pick-up.mjs claim` for the repos the prompt lists." The run id sentence stays.
- `:22`. "It copies `playbooks/` and the five factory skills" gains "and the task prompt into `~/.claude/scheduled-tasks/factory-pickup/SKILL.md` (only when that folder exists, which Desktop creates with the task)". Add: "A prompt change reaches the tick after the install."
- `:23`. "the `--repo` flags in the task prompt" becomes "the `--repo` flags in `scheduled-tasks/factory-pickup/SKILL.md`".
- New bullet after `:27`: "Resume after a question. `needs-decision` is a skip label (`pick-up.mjs` `SKIP_LABELS`), so pick-up skips the issue while it is on. An owner reply alone does not resume the run. The dashboard inbox's Answer button posts the answer as a comment and removes the label. The next claim then returns `plan`, or `implement` when `plan-approved` is on, and that run reads the owner's answer from the comments after its question. Only comments from an owner, member or collaborator count."
- `:87`. The guard list gains `scheduled-tasks/factory-pickup/SKILL.md` and any other file under `scheduled-tasks/` (the task prompts, which hold the install and claim commands).

### `README.md`

- New `## scheduled-tasks/` section before `## Install`: one line naming `factory-pickup/SKILL.md` as the prompt of the Desktop task.
- Install, `:127-132`: the install also writes `scheduled-tasks/factory-pickup/SKILL.md` to `~/.claude/scheduled-tasks/factory-pickup/` when that folder exists, and `FACTORY_TASKS_DIR` joins the env list.
- For unattended runs, `:142-143` becomes: "Create the Claude Desktop scheduled task `factory-pickup` once (Hourly, Auto permission mode). The instructions text does not matter. Then run the install: it writes `scheduled-tasks/factory-pickup/SKILL.md` over the task's file, and each armed tick reinstalls it. Schedule, folder and permission mode stay in Desktop."

### `.factory/playbook.md`

- Notes, "The factory runs the installed copies" line: add the task prompt to the installed copies. This file is under the trusted-commands guard, so the PR flags it.

## Gates

From the worktree root, at the head commit, clean tree. The nine checks in `.factory/recipe.yml`:

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

Baseline at ad19dcd (node v26.13.0), all exit 0. pick-up 99 pass, post-merge 23, capture-ui 115, trial-decision 39, test-first 36, bootstrap 3 OK, event-model 4 OK, factory-onboard 28 OK, install 22.

## Skips

- Event model and journey boards. This repo has no brain vault and no journey file. `git ls-tree -r --name-only origin/main` matches only `factory/event-model/references/journey-format.md`, a format reference. In `codyssey-docs`, `grep -rlni -e pick-up.mjs -e factory-pickup -e needs-decision Architecture` finds nothing. The factory notes live under `Ideas/` and `Technical/`.
- UI evidence. `git cat-file -e origin/main:.factory/ui-capture.json` gives "does not exist in 'origin/main'".

## Out of scope

- The schedule and the permission mode (issue).
- Watching more repos. The four `--repo` flags stay as they are.
- `factory-pickup-dryrun`. Its folder is still on disk though Desktop no longer lists it. Not touched.

## Owner follow-ups

- Nothing in this change takes effect until the owner runs `node playbooks/scripts/install.mjs --source .` once by hand from an up-to-date checkout after merge. The installed copy predates #25: `~/.agents/playbooks/scripts/` holds `capture-ui.mjs`, `pick-up.mjs`, `send-stage.mjs` and their tests, with no `install.mjs`, `post-merge.mjs`, `trial-decision.mjs`, `test-first.mjs` or `.installed-sha`. The new prompt reaches Desktop only through an install, and that same install puts `install.mjs` in place, so step 0 never meets a missing script.
- Later `installMap` changes need two installs: the first runs the old installer, which does not know the new target. Running the install from the checkout, as above, avoids this.
- Under option A, the task must exist in Desktop before the install writes its prompt. It does today.

## Risks

- A hand edit of the installed prompt, or a description change in Desktop's Edit form, is overwritten by the next armed tick. Prompt changes now go through a PR. The install's `changed` output names the file.
- `scheduled-tasks/` in a public repo exposes the prompt text. It holds no secrets: commands, repo names and `~` paths.

## Choices made

The owner can redirect any of these at plan approval.

1. Path `scheduled-tasks/factory-pickup/SKILL.md` at the top level, not under `playbooks/`. `planInstall` picks the first matching prefix (`map.find`, `install.mjs:106`), so a file under `playbooks/` goes to one target only, chosen by entry order: with `playbooks/` first it lands in `~/.agents/playbooks/scheduled-tasks/` and never reaches Desktop. A top-level folder needs no order rule, mirrors Desktop's `scheduled-tasks/<name>/SKILL.md` layout, and keeps a non-playbook file out of `~/.agents/playbooks/`.
2. Env var `FACTORY_TASKS_DIR`, default `~/.claude/scheduled-tasks`. It does not read `CLAUDE_CONFIG_DIR`, which Desktop honours for this folder, because `FACTORY_SKILLS_DIR` does not either.
3. `FACTORY_TASKS = ['factory-pickup']`, an explicit list like `FACTORY_SKILLS`, so a new folder under `scheduled-tasks/` never writes over an unrelated task.
4. `~` paths in the prompt. The repo is public and today has no home path in it. Install-time substitution would break the byte-identical criterion.
5. Install exit handling follows `factory.md:22`: no exit ends the run. Exit 3 is expected when a hand-started run (`claim --only`) or a young crashed lock holds a claim. Exits 1 and 2 are handled the same way.
6. Install as step 0 in its own subagent, before the claim subagent, so the claim reads the scripts the install just wrote.
7. A frontmatter-and-no-home-path test on the real prompt, so the public-repo rule is a check, not a note.

## Open decisions

1. Should `install.mjs` also create the Desktop task when it does not exist, or only update the file of an existing task? The code and tests above assume A.
   - **A. Update only (Recommended).** Write the prompt only when `~/.claude/scheduled-tasks/factory-pickup/` exists, else list it under `skipped`. The owner creates the task once in Desktop, and every later install keeps its prompt current. Evidence: the docs say schedule, folder and enabled state "are not in this file", so a file cannot carry what makes a task run. The `create_scheduled_task` MCP tool's description says a taskId "already in use on the user's computer" is refused and, "when another task's folder has it", the tool offers a free ID such as `check-inbox-2`. So a folder the install made first would push a later `create_scheduled_task` for `factory-pickup` onto another name. `factory-pickup-dryrun/` has a SKILL.md and Desktop does not list it (inferred: a folder with a SKILL.md is not a registered task. The listing may also hide completed one-time tasks, so this is not proof). Cost: one `existingOnly` field, the `skipped` result field and one more test. A deleted task's leftover folder still gets the prompt, which does nothing.
   - **B. Always write, creating the folder.** Delta: no `existingOnly`, no `skipped`, the missing-folder test asserts the file is written. Same rules as every other target and the smallest diff. Risk: on a machine where the task does not exist yet, the install makes the folder first. Through the MCP tool, creating `factory-pickup` is then refused (tool description, above). I don't know what Desktop's New task form does in the same case (reuse the file, overwrite it, or refuse the name, since names "must be unique across your tasks"). What would settle the form's behaviour: in Desktop, make a folder `~/.claude/scheduled-tasks/factory-probe/` with a SKILL.md, create a task named `factory-probe`, read the file, then delete the task and the folder. This plan wrote nothing under `~/.claude`, so it was not tried.
   - **C. Register the task too.** `install.mjs` cannot do this: registration lives in Desktop and is made through its UI or the `create_scheduled_task` MCP tool, which only a Claude session can call. C means a setup step where a session calls `create_scheduled_task` with `taskId: factory-pickup`, `cronExpression: "0 * * * *"`, a `description` and the repo prompt, on top of A for updates. The tool takes no permission-mode field. Its description says the task "may be saved" in Auto mode only when the calling session runs in Auto or Bypass mode, so the owner may still set Auto in Desktop by hand. It touches onboarding outside this issue, so it fits better as its own issue.
