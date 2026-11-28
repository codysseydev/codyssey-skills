# Plan for #140, a lean session profile for factory runs

Issue codysseydev/codyssey-skills#140. Base origin/main be3b506. Branch `factory/140`.

Kind: feature (playbook, install script, task prompts and a new profile folder; no bug label).

## Goal

Every factory session, and every subagent it starts, loads only what a factory run calls. The three lane tasks run in one installed folder, `~/.factory/session/`. Its `.claude/settings.json` turns off the plugins no run uses and allows only the MCP servers factory runs call. Steps that only run shell commands go to a `factory-shell` subagent that loads Bash and nothing else. One script measures the start-up load the same way before and after.

## What a run loads today

Every number in this section uses one method unless the row says otherwise. Start-up load is the first assistant message's `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`, read from the session transcript in `~/.claude/projects/` (main session) and from its `subagents/agent-*.jsonl` (subagents). Sessions with no usage line (ticks that hit the usage limit) are left out. This counts everything sent before the first reply, so it is larger than the issue's `/context` table (about 79k).

| Lane, account, dates | Lane folder | Main median (n) | Subagent median (n) |
|---|---|---|---|
| backend, first account, 2026-11-20 to 11-27 | codyssey-skills checkout | 102,031 (129) | 84,390 (1,354) |
| frontend, first account, 2026-11-23 to 11-27 | codyssey-frontend checkout | 118,490 (60) | 99,521 (582) |
| tools, first account, 2026-11-23 to 11-27 | codyssey-frontend checkout | 118,535 (58) | 98,704 (216) |
| tools, second account, 2026-11-28 | codyssey-docs checkout | 95,957 (2) | 76,361 (12) |
| frontend, second account, 2026-11-28 | codyssey-docs checkout | 99,058 (1) | 76,198 (3) |

The lane folder decides much of the load. A recent session lists 250 skills in the codyssey-skills checkout, 351 in codyssey-frontend (its `.claude/skills` holds 103) and 265 in codyssey-docs. It also lists 957 to 1,033 deferred tool names from 37 to 40 MCP servers.

Volume from 2026-11-19 to 11-28: 332 scheduled sessions (59 plan, 63 implement and 47 archive claims, 79 busy or none ticks, 86 ticks with no tool calls after the usage limit), and 2,704 subagents across factory runs. Subagents outnumber main sessions about 9 to 1, so the subagent load is the larger cost.

## What factory runs call

From the tool calls in those transcripts (main sessions and subagents), and from `playbooks/factory.md`, the lane prompts and each watched repo's `.factory/playbook.md`:

| Stage | MCP servers | Skills | Subagent types |
|---|---|---|---|
| Lane tick (lock check, install, claim, release) | report-stage (stale entries) | `pstack:poteto-mode` after a claim | one subagent per shell step |
| Plan | report-stage; cloudflare-api and cloudflare-docs (3 frontend plan runs) | `event-model`, `pstack:unslop`, `pstack:technical-writing` | `pstack:poteto-agent`, `general-purpose`, `Explore` |
| Implement and gates | report-stage; plausible (1 run); sentry (2 calls) | `pstack:deslop`, `laravel-kanon-audit`, `pstack:thermo-nuclear-review`, `pstack:no-comments`, the repo's reviewer skill | `pstack:poteto-agent`, `general-purpose`, `pstack:thermo-nuclear-review-subagent`, `pstack:comment-sicko` |
| Archive and post-merge | report-stage; sentry (`search_issues`, `find_releases`) | `pstack:deslop`, the vault's `factory-log` | `pstack:poteto-agent`, `general-purpose` |

The Desktop app's own tools (`ccd_*`, the built-in browser, `scheduled-tasks`) and the Artifact tools are not MCP registrations, and no setting below touches them. The Playwright MCP server was called in 3 runs, all from subagents. `capture-ui.mjs` loads the Playwright package, not the MCP server, and the Desktop browser covers page checks. The repo reviewer skills (`codyssey-reviewer`, `codyssey-frontend-reviewer`) live in each repo's `.claude/skills`. The backend lane already reads them by path, because it never ran in the codyssey checkout.

## Measured levers

Claude Code CLI 2.1.332, `claude -p "Reply with the single word ok." --max-turns 1`, with the token sum above, two runs per folder. The two runs agree within 10 tokens, except the empty folder (57,735 and 58,601).

| Folder settings | Start-up | Against the row above |
|---|---|---|
| codyssey-docs checkout (the lane folder today) | 70,855 | |
| empty folder, no settings | 57,735 to 58,601 | -12,254 to -13,120 (vault CLAUDE.md, its auto memory, 2 project MCP servers, 10 project skills) |
| plus `enabledPlugins` false for every plugin but pstack | 56,566 | -1,169 to -2,035 (skills 244 to 161; the playwright, miro and stripe servers gone) |
| plus `allowedMcpServers` with 5 servers | 48,372 | -8,194 |
| plus `autoMemoryEnabled: false` | 47,615 | -757 |

Levers tried and not taken:

- `skillOverrides` set to `off` for 63 of the 72 user skills: -488. The list goes stale each time a user skill is added.
- `deniedMcpServers` with 11 servers in place of the allowlist: 51,195, which is 2,823 more than the allowlist. Three claude.ai connectors for the same products loaded once their local servers were denied. The deny list would also publish every server on the machine in this public repo.
- `disableClaudeAiConnectors`: -5,181 in the CLI. The MCP docs say this setting, `ENABLE_CLAUDEAI_MCP_SERVERS` and the `/mcp` toggle act only on connectors Claude Code fetches itself. Desktop sessions get connectors in-process.
- `CLAUDE_CODE_DISABLE_CLAUDE_MDS`: would also drop the owner's global CLAUDE.md, which holds the run's voice and orchestrator rules.
- `ENABLE_TOOL_SEARCH`: already the default. MCP tools load deferred, by name only.

Subagents, same CLI, in a folder with the profile settings:

| Subagent type | Start-up | Tool names at start | Skill list |
|---|---|---|---|
| `general-purpose` | 39,099 | 11 | 107 names |
| custom, `tools: Bash` | 7,362 | 2 | none |
| custom, `tools: Bash`, `omitClaudeMd: true` | 4,923 | 2 | none |

The CLI is not the Desktop app. Desktop adds its own tools and delivers claude.ai connectors in-process, and the MCP docs say no MCP setting reaches those. Desktop sessions do read a folder's `.claude/settings.json` and `.mcp.json`. Desktop sessions in codyssey worktrees list the slack plugin that only codyssey's `.claude/settings.json` enables, and the nightwatch and postmark servers from its `.mcp.json`. No session in another folder lists them. A project-scope `allowedMcpServers` and a project agent are not yet seen in a Desktop session. That is the first check in Verification.

Estimate, inferred and not measured in Desktop: a lane's main session drops by about the CLI's 23k, from about 96k to about 73k. A shell step's subagent drops from about 76k to 5k plus whatever Desktop adds to a Bash-only subagent (unknown).

## Behaviour

| Case | Today | After |
|---|---|---|
| Lane folder | the codyssey-docs checkout (tools and frontend lanes), set in the Desktop UI | `~/.factory/session/`, set once per task in the Desktop UI by the owner |
| Plugins in a lane session | every plugin the user settings enable | pstack and security-guidance, plus Claude Code's built-in `cc-plugin-*` ones |
| MCP servers Claude Code loads | every user, local and plugin server | report-stage, sentry, cloudflare-api, cloudflare-docs, plausible |
| claude.ai connectors in Desktop | every connector on the account | unchanged (open decision 2) |
| Vault CLAUDE.md and the vault's auto memory | loaded | not loaded. The global `~/.claude/CLAUDE.md` still loads |
| Auto memory | on | off in the profile folder |
| Shell-only steps | `general-purpose` or `pstack:poteto-agent` | `factory-shell`. When that type is missing, `general-purpose` |
| Install | playbooks, skills, task prompts | also `factory/session/` into `~/.factory/session/.claude/` |
| Measuring start-up load | ad hoc scripts | `playbooks/scripts/startup-load.mjs` |

## Data shape

`installMap` (`playbooks/scripts/install.mjs`) takes `stateDir` too, which `makeDeps` already returns, and gains one entry. It is not `existingOnly`: the install creates the folder, and the owner then points the tasks at it.

```js
export function installMap({ agentsDir, skillsDir, tasksDir, stateDir }) {
  return [
    // ... the existing entries, unchanged
    { prefix: 'factory/session/', dir: join(stateDir, 'session', '.claude') },
  ];
}
```

`factory/session/settings.json`:

```json
{
  "enabledPlugins": {
    "playwright@claude-plugins-official": false,
    "claude-md-management@claude-plugins-official": false,
    "skill-creator@claude-plugins-official": false,
    "mcp-server-dev@claude-plugins-official": false,
    "stripe@claude-plugins-official": false,
    "mattpocock-skills@claude-plugins-official": false,
    "miro@claude-plugins-official": false,
    "figma@claude-plugins-official": false,
    "asb-skills@asb-skills": false,
    "cc-plugin-you-should-know@builtin": false,
    "warp@claude-code-warp": false
  },
  "allowedMcpServers": [
    { "serverName": "report-stage" },
    { "serverName": "sentry" },
    { "serverName": "cloudflare-api" },
    { "serverName": "cloudflare-docs" },
    { "serverName": "plausible" }
  ],
  "autoMemoryEnabled": false
}
```

pstack and security-guidance stay as the user settings enable them. The profile sets no hooks, permissions or env. The owner's hooks in `~/.claude/settings.json`, the orchestrator guard among them, keep applying, because hooks merge across scopes. A plugin the owner enables later loads in factory sessions until it is added here as `false`. The `factory/session/` README note says so.

`factory/session/agents/factory-shell.md`:

```markdown
---
name: factory-shell
description: Runs the shell commands it is given and returns stdout, stderr and exit codes verbatim. For factory steps that only need a shell.
tools: Bash
omitClaudeMd: true
---

Run each command you are given with Bash, exactly as written. Leave `~` unquoted so it expands. Never print a token, key or password. Return stdout, stderr and the exit code of each command verbatim. Make no decisions and run nothing you were not given.
```

`startup-load.mjs` prints one JSON object:

```json
{
  "cwd": "~/.factory/session",
  "since": "2026-11-29T00:00:00Z",
  "until": null,
  "task": "factory-pickup-tools",
  "main": { "n": 0, "median": null, "min": null, "max": null },
  "subagents": { "n": 0, "median": null, "min": null, "max": null },
  "skipped_no_usage": 0
}
```

Flags: `--cwd <folder>` (required, the folder the sessions ran in, encoded the way `~/.claude/projects/` names its folders), `--since` and `--until` (ISO times, compared with each session's first timestamp), `--task <name>` (only sessions whose first user message carries `scheduled-task name="<name>"`), `--projects-dir` (default `~/.claude/projects`). Exit 0 on success, 2 on bad usage, 1 on an unexpected error.

## Changes

### `factory/session/settings.json` and `factory/session/agents/factory-shell.md` (new)

As in Data shape.

### `playbooks/scripts/install.mjs`

- `installMap` as in Data shape. Its callers pass `stateDir` from `makeDeps`.
- The header comment names the profile target and says it is created, unlike the task folders.

### `playbooks/scripts/install.test.mjs`

- The fixture commits `factory/session/settings.json` and `factory/session/agents/factory-shell.md`, and the counts and file lists that name every target include `FACTORY_HOME/session/.claude`.
- New tests:
  - `installs the session profile into FACTORY_HOME/session/.claude, creating the folder`
  - `a rerun leaves the installed profile and its mtime alone`
  - `the repo profile keeps pstack, allows report-stage and sentry, and sets no hooks, permissions, env or disableAllHooks` (reads the real `factory/session/settings.json`)
  - `the repo factory-shell agent loads only Bash and omits CLAUDE.md` (reads the real agent file)

### `playbooks/scripts/startup-load.mjs` and `startup-load.test.mjs` (new)

As in Data shape. The tests build transcript fixtures in a temp folder: a main session with usage, one without (counted in `skipped_no_usage`), a subagent, a session for another task (filtered out by `--task`), and a session before `--since`.

### `.factory/recipe.yml`

Add `startup-load-tests: node --test playbooks/scripts/startup-load.test.mjs`. The trusted-commands guard flags this file.

### `scheduled-tasks/factory-pickup*/SKILL.md` (three files)

Each "Through ONE subagent" step (lock check, install, claim, release) becomes "Through ONE `factory-shell` subagent (use `general-purpose` when that type is not available)". The fallback matters: the prompts install one tick after merge, before the owner moves the tasks to the profile folder, and a session outside that folder has no `factory-shell`. The guard flags these files.

### `playbooks/factory.md`

- Scheduled pick-up (line 18): a new bullet, "Session profile". It says the three tasks run in `~/.factory/session/`, which `install.mjs` writes from `factory/session/`. It lists what the profile turns off and allows, and says the owner sets each task's folder once in the Desktop UI (the scheduled-tasks tool cannot set it). A stage that needs another MCP server adds it to `allowedMcpServers` in a PR. Measure with `startup-load.mjs`.
- The install bullet (line 22): the install also writes `factory/session/` into `~/.factory/session/.claude/`.
- AI policy (line 60) and Counting the owner (line 163): the fetch, the check command and the totals read run in a `factory-shell` subagent.
- Stage 8 (line 121): "Add a build log row in the brain" names the vault skill to follow, `~/Code/GitHub/Codyssey/codyssey-docs/.claude/skills/factory-log/SKILL.md`, read by path, because the profile folder does not list the vault's project skills.
- Trusted-commands guard (line 105): add `factory/session/` (a settings file can carry hooks and permissions).

### `README.md`

Install: the install also writes `factory/session/` to `~/.factory/session/.claude/`. For unattended runs: set each lane task's folder to `~/.factory/session` in the Desktop UI after the first install.

### `.factory/playbook.md`

Notes: the installed copies include `~/.factory/session/`. The guard flags this file.

## Verification

1. Gates: the 12 checks in `.factory/recipe.yml` plus `startup-load-tests`, from a clean tree at the head commit.
2. Desktop check, on the real surface. The install refuses while the run's own claim lock is live, so copy `factory/session/settings.json` and the agent file into a scratch folder's `.claude/`. Start one Desktop session there (`ccd_session` `start_session`) with a prompt that starts one `factory-shell` subagent running `echo ok`. Read its transcript: the MCP servers in `mcp_instructions_delta` (only the 5 allowed ones plus the app's own), the `skill_listing` count, and the subagent's tool names and start-up sum. If no session can be started, this check is not exercised and moves to the archive run.
3. The PR carries before and after. Before: `startup-load.mjs` over the second-account lane sessions in the codyssey-docs checkout. After: the Desktop check, with the CLI numbers above next to it.
4. Archive (stage 8): after the merge, the install writes `~/.factory/session/` and the owner points the three tasks at it (one manual step). The archive run reads real ticks with `startup-load.mjs --cwd ~/.factory/session`, confirms each lane's sessions ran there, and checks those ticks for a tool-not-found error. Done when a factory run starts with the profile, the load is measured before and after, and no stage lost a tool it called.

## Open decisions

Approving the plan accepts the defaults (option A).

1. Profile folder. A: `~/.factory/session/`, installed by `install.mjs`, outside every repo. B: a folder inside the codyssey-skills checkout, so the profile is read straight from the repo with no install step. B would load from the working tree, which the factory never reads.
2. claude.ai connectors on the factory account. No folder setting reaches the connectors Desktop delivers. A: leave them as they are; this change does not touch them. B: the owner disconnects the connectors no factory run calls at claude.ai/customize/connectors on the factory account. That changes the whole account, not only factory sessions.

## Diagrams

No diagrams: no trigger fired. The change adds no actor, no status, no runtime flow across modules or repos, and no external system. It changes which settings file a session loads.

## Event model

No journey file applies. This is factory tooling, not a product journey, so no boards changed.

## UI evidence

Skipped: the repo has no `.factory/ui-capture.json`.

## Scope

Not in this change: model tiers and checks sized to the change (#141), fewer session layers (#142), cost in stage events (#143), the Desktop app's own tools, and removing duplicate MCP registrations. That last one is the owner's. The report is in the run's local evidence folder, not in this public repo.
