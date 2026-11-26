# Plan for #119 and #82, install the Kanon skills and document the install lag

Issues codysseydev/codyssey-skills#119 and codysseydev/codyssey-skills#82. Base origin/main 99bd2e6. Branch `factory/119`. One PR closes both.

Kind (#119): bug fix
Kind (#82): feature

## Goal

#119: `install.mjs` installs `laravel-kanon`, `laravel-kanon-audit`, `symfony-kanon` and `nextjs-kanon` into `~/.claude/skills/<name>/`, so those installed copies stop lagging `kanon/` on main, and the `standards-discovery` snapshot of the Laravel and Symfony references keeps syncing.

#82: the docs say an install can be refused for as long as any lane holds a claim lock, and that the lane's final message reports `refused`. No code change for #82.

## Decisions already made (owner, 2026-11-26)

1. `KANON_SKILLS` gains `laravel-kanon`, `laravel-kanon-audit`, `symfony-kanon` and `nextjs-kanon`.
2. #82: keep the refusal rule and document the lag.

## Data shape

`installMap` returns an ordered list of `{ prefix, dir, existingOnly? }`. A repo path can match more than one entry. It does today for no path, and it will for `kanon/laravel-kanon/references/*` and `kanon/symfony-kanon/references/*` once those two skills are listed: the skill entry (`kanon/<name>/` -> `~/.claude/skills/<name>/`) and the snapshot entry (`kanon/<name>/references/` -> `~/.claude/skills/standards-discovery/kanon/<name>/references/`). `planInstall` returns one entry per (file, matching target), so those files appear twice with different `dest`.

## The trap, and the fix

`planInstall` picks the target with `map.find(...)`, so the first matching prefix wins. `KANON_SKILLS` entries come before `KANON_SNAPSHOT` in `installMap`. Adding the names alone makes `kanon/laravel-kanon/references/*` match the skill entry first, and those files stop syncing into `~/.claude/skills/standards-discovery/kanon/laravel-kanon/references/`. `standards-discovery` reads them through `families.json` paths, so the loss is silent.

Fix: `planInstall` collects every matching target (`map.filter`) and emits an entry for each. The skipped-target, symlink and outside-the-root checks run per target, as they do now.

## Change

### `playbooks/scripts/install.mjs`

1. Line 36:

```js
export const KANON_SKILLS = ['laravel-kanon', 'laravel-kanon-audit', 'nextjs-kanon', 'standards-discovery', 'symfony-kanon'];
```

2. In `planInstall`, replace the `find` and the single push. Shape:

```js
const targets = map.filter((t) => src.startsWith(t.prefix) && !skipped.includes(t.dir));
if (!targets.length) continue;
if (type !== 'blob' || (mode !== '100644' && mode !== '100755')) {
  throw new Error(`${src} is a ${type} with mode ${mode}; only regular files install`);
}
for (const target of targets) {
  const dest = join(target.dir, src.slice(target.prefix.length));
  // existing destDir symlink check, unchanged, keyed on destDir
  entries.push({ src, dest, mode, blob });
}
```

The type check stays before the push loop and runs only for files with at least one live target, as now. Everything else in the function is unchanged. `install()` already reads each blob once per entry; a doubled file is read twice, which is 14 extra `git cat-file` calls and is not worth caching.

3. Update the header comment (lines 1-3): the list of what is installed names the Kanon skills, and a comment above `KANON_SKILLS` or `installMap` says one repo file can install to several places, so every matching target gets it.

### `playbooks/scripts/install.test.mjs`

Fixture and existing tests (they would otherwise break once the list grows):

- `baseFiles`: delete `['kanon/laravel-kanon/SKILL.md', 'not listed\n']`. That line overwrites the `laravel-kanon` SKILL.md that the `KANON_SKILLS` map writes, and `laravel-kanon` is now listed.
- `baseFiles`: add explicit fixture files that do not depend on `KANON_SKILLS`: `kanon/laravel-kanon/SKILL.md`, `kanon/laravel-kanon-audit/SKILL.md`, `kanon/symfony-kanon/SKILL.md`, `kanon/nextjs-kanon/SKILL.md` (content `<name> v1`), `kanon/nextjs-kanon/references/nextjs.md`, and `kanon/not-listed/SKILL.md` (content `not listed`).
- `a folder under factory/, kanon/ or scheduled-tasks/ that is not in the list is not installed`: drop `assert.ok(!existsSync(join(f.skillsDir, 'laravel-kanon')))`, assert `!existsSync(join(f.skillsDir, 'not-listed'))` as now (it now covers `kanon/not-listed/`).
- `installs playbooks, the five factory skills and standards-discovery ...` (line 132): rename to "installs playbooks, the factory skills, the Kanon skills and standards-discovery ...". Its `out.changed.length` assertion equals the file count on disk, so it still holds with doubled destinations (each dest is distinct).

New test, the failing one:

```js
test('a Kanon skill reference file installs to its skill folder and to the standards-discovery snapshot', () => {
  // asserts the four names are in KANON_SKILLS
  // runs the install, reads these paths and compares to ['php-core v1\n', 'php-core v1\n']:
  //   skills/laravel-kanon/references/php-core.md
  //   skills/standards-discovery/kanon/laravel-kanon/references/php-core.md
  // same for symfony-kanon/references/symfony.md
  // asserts laravel-kanon-audit/SKILL.md and nextjs-kanon/SKILL.md are installed
});
```

Read each path with `existsSync(p) ? read(p) : null`, not a bare `read`, so a missing file on main is a failed `deepEqual` and not an ENOENT. Use literal skill names in the test, not `KANON_SKILLS`, except for the one membership assertion (`assert.deepEqual([...KANON_SKILLS].sort(), [...])`). The test imports nothing new.

The first build commit is this test and its fixture lines alone, with the subject `test: failing test for #119`. On main it fails on the membership `deepEqual` and on the two-destination `deepEqual` (`[null, null]` against the expected content, since neither skill folder exists on main). The fixture edits pass on main: `laravel-kanon` is not listed there, so its fixture file is simply not installed.

### `playbooks/factory.md`

Line 22, first bullet ("Install first"). Replace the list of what it copies and the refusal sentence.

Old: "It copies `playbooks/`, the five factory skills, `standards-discovery` and the lane prompts from `origin/main` into `~/.agents/playbooks/`, `~/.claude/skills/` and `~/.claude/scheduled-tasks/<task>/SKILL.md`, so a merged change reaches the next run."

New: "It copies `playbooks/`, the five factory skills, `standards-discovery`, the four Kanon skills (`laravel-kanon`, `laravel-kanon-audit`, `symfony-kanon` and `nextjs-kanon`) and the lane prompts from `origin/main` into `~/.agents/playbooks/`, `~/.claude/skills/` and `~/.claude/scheduled-tasks/<task>/SKILL.md`, so a merged change reaches the next run."

Old: "It refuses with exit 3 while a claim lock of any lane is live, because a hand copy in the middle of a run mixes versions."

New: "It refuses with exit 3 while a claim lock of any lane is live, because a hand copy in the middle of a run mixes versions. The refusal is deliberate (#82). An install can therefore be refused for as long as any lane holds a claim lock, which is hours when a lane runs an implement or a post-merge wait, and many ticks in a row with three lanes. The run goes on with the old copy and its final message reports `refused`, so a merged change reaches the installed copies late, not never."

Old: "When the install refuses or fails, the run goes on with the old or partly updated copy and says so in its final message."

Keep, but the new sentences above already say it for refusal. Change it to "When the install fails, the run goes on with the partly updated copy and says so in its final message." to avoid saying the same thing twice.

The build runs `check-playbooks.mjs` (see Tests, row 3), as plan 26 did.

### `README.md`

"Install" section (lines 158-203).

1. The paragraph that starts "For the playbook, the factory skills": add the Kanon skills to the list: "...`standards-discovery` (with a snapshot of the Kanon catalog and reference files), the Kanon skills (`laravel-kanon`, `laravel-kanon-audit`, `symfony-kanon`, `nextjs-kanon`) and the scheduled task prompts, run the install script from a checkout of this repo:"
2. The paragraph after the command: "each of those skills into `~/.claude/skills/<name>/`" stays. After "and never deletes a file." add: "A file that a skill later drops or renames stays installed, so remove it by hand."
3. Replace "It refuses with exit 3 while a claim lock in `~/.factory/locks/` is live." with: "It refuses with exit 3 while a claim lock in `~/.factory/locks/` is live. Any lane's lock counts, so an install can be refused for as long as any lane holds one, and a merged change can lag several ticks. The lane's final message reports `refused`, and the next armed tick with no live lock installs it."
4. The first paragraph ("Install `laravel-kanon` and `laravel-kanon-audit` side by side...") is about hand copying and stays.

### `.factory/playbook.md`

`## Notes`, the bullet on installed copies (line 30). Replace "the five factory skills and `standards-discovery` in `~/.claude/skills/`" with "the five factory skills, `standards-discovery` and the four Kanon skills (`laravel-kanon`, `laravel-kanon-audit`, `symfony-kanon`, `nextjs-kanon`) in `~/.claude/skills/`". Add `kanon/<those four skills>` to the list of paths whose merged change waits for the next install. After "The install never deletes, so a file removed from the repo stays installed." add "An install can be refused for as long as any lane holds a claim lock (#82), so a change can lag several ticks."

This file is on the trusted-commands guard list. The PR flags it.

No other file changes. `kanon/`, `scheduled-tasks/`, `kanon/standards-discovery/` and the catalog are not touched.

## Tests, one per acceptance criterion

| # | Criterion | Check |
|---|---|---|
| 1 | #119: `laravel-kanon`, `laravel-kanon-audit`, `symfony-kanon` and `nextjs-kanon` install into `~/.claude/skills/<name>/` | New test above, the `laravel-kanon-audit/SKILL.md` and `nextjs-kanon/SKILL.md` assertions and the membership assertion. Command: `node --test --test-name-pattern 'a Kanon skill reference file installs' playbooks/scripts/install.test.mjs` |
| 2 | #119: a reference file of `laravel-kanon` or `symfony-kanon` installs to both its skill folder and the `standards-discovery` snapshot | Same test, the two `deepEqual` reads for `php-core.md` and `symfony.md`. Fails on main, passes after the fix. |
| 3 | #119: the other install behaviours are unchanged (no delete, mtimes, locks, symlink refusals, task prompts) | The full `install-tests` recipe check. |
| 4 | #82: `playbooks/factory.md`, README "Install" and `.factory/playbook.md` say an install can be refused for as long as any lane holds a claim lock, and that the lane's final message reports `refused` | Read the three files after the change. `check-playbooks.mjs` exits 0 with the new `factory.md` installed in a temp HOME, 1 when a quoted anchor changes (see below). |
| 5 | Tests pass per `.factory/recipe.yml` | The 12 recipe checks at the head commit, clean tree. |

Row 4 and the `check-playbooks.mjs` run: copy `playbooks/factory.md` to `$T/.agents/playbooks/` under a temp dir `$T` and run `HOME=$T node ~/.claude/plugins/cache/pstack-claude/pstack/<newest version>/skills/poteto-mode/scripts/check-playbooks.mjs $T` (newest at planning time: 0.9.143). Expect exit 0. The edit touches only line 22, which holds no pstack anchor, so no altered-anchor run is needed beyond confirming exit 0. The real `~/.agents`, `~/.claude/skills`, `~/.claude/scheduled-tasks` and `~/.factory` are not touched.

Test-first rows: #119 is a `test-first` gate with `--command 'node --test --test-name-pattern "a Kanon skill reference file installs" playbooks/scripts/install.test.mjs'`. #82 is docs only: a `test-first` row with `--none "docs only, no behaviour to test"`, result `not_exercised`, reason under `## Merge assessment`. Since one PR closes both and the PR is a bug fix for #119, the gate runs with the command, and the #82 docs-only reason goes in the merge assessment.

## Probes against the code

Base 99bd2e6, worktree `.claude/worktrees/agent-a73b5ed0819abb560`.

- Baseline, all 12 recipe checks pass: pick-up 108, post-merge 23, capture-ui 115, trial-decision 39, test-first 36 tests pass; bootstrap 5, event-model 4, factory-onboard 29 OK; install 30 and kanon-catalog-tests 43 pass; kanon-catalog-check prints `catalog ok: 14 family file(s), 326 entries`; standards-discovery-tests did not finish within 3 minutes at planning time (the suite is slow when other runs share the machine), so its pass count is not recorded here. The build records it at the head commit.
- The trap, proven with a throwaway script (not committed) that calls `planInstall` on `origin/main` through the real git boundary, before and after pushing the four names onto `KANON_SKILLS`:

```
before {"snapshot_laravel_refs":13,"snapshot_symfony_refs":1,"skill_laravel_refs":0,"skill_symfony_refs":0,"skill_laravel_audit":0,"skill_nextjs":0,"total":95}
after  {"snapshot_laravel_refs":0,"snapshot_symfony_refs":0,"skill_laravel_refs":13,"skill_symfony_refs":1,"skill_laravel_audit":1,"skill_nextjs":20,"total":118}
```

Adding the names alone moves all 13 Laravel and 1 Symfony reference files from the snapshot to the skill folder, so `standards-discovery/kanon/*/references/` receives nothing. With the fix the expected total is 118 plus 14 doubled entries.
- `check-playbooks.mjs` at origin/main `factory.md` in a temp HOME: "Every project playbook matches this pstack's playbooks.", exit 0.
- Not exercised: a real install into `~/.claude/skills/` (never touched by a run).

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

Plus the `check-playbooks.mjs` run from row 4, and the `test-first` gate for #119 (and its `--none` row for #82).

## Implement

One delegate, one worktree (`factory/119`), no fan-out, in this order:

1. Commit 1: the fixture lines and the new test only. Run the plan's command, see it fail on an assertion. Subject `test: failing test for #119`.
2. Commit 2: the `install.mjs` change. The new test and `install-tests` pass.
3. Commit 3: the three docs (`playbooks/factory.md`, README, `.factory/playbook.md`) for #82 and the Kanon list.

Trusted-commands flag: `.factory/playbook.md` is on the guard list, so the PR flags it (`trusted_commands.flagged: [".factory/playbook.md"]`). `playbooks/factory.md` and `install.mjs` are not on the list. No edit to `.factory/recipe.yml` or `scheduled-tasks/`.

## Diagrams

No diagrams: no trigger fired.

## Out of scope

- #82 code: a per-file atomic swap or a versioned install folder with a symlink flip. The owner chose to keep the rule and document the lag.
- Files other sessions own: #44 (`kanon-pr-audit`), #97 (`nextjs-kanon-audit`) and #67 (`standards-discovery`). This plan changes only `install.mjs`, its test, `playbooks/factory.md`, README and `.factory/playbook.md`.
- The `KANON_SNAPSHOT` list. It has `laravel-kanon/references` and `symfony-kanon/references` and no `nextjs-kanon/references`, since `standards-discovery` reads no Next.js files today. #67 owns that.
- Pruning installed Kanon files that a commit no longer has (Open decision 1).
- The stale installed copies on the owner's machine. One install after merge brings them up to date.
- Event model. Skip, no journey for internal tooling.

### Overlap with #44

#44 is planned in another session. It splits `kanon-pr-audit` out of `laravel-kanon-audit`, and the owner decides there whether `laravel-kanon-audit` becomes a thin pointer or is removed, so #44 may change the install list. The order of #119 and #44 is the owner's pick.

- If #44 lands first, #119 installs whatever skill names main has then, so the build checks `kanon/` on main and lists what is there.
- If #119 lands first, #44 adds `kanon-pr-audit` to `KANON_SKILLS`. If #44 removes `laravel-kanon-audit`, then under never-delete the installed `~/.claude/skills/laravel-kanon-audit/` stays as a stale copy until the owner deletes it.

## Open decisions

1. Never-delete for the Kanon skills. Chosen (recommended): keep never-delete. A later removal or rename in a Kanon skill, or #44 replacing `laravel-kanon-audit` with `kanon-pr-audit`, leaves a stale installed copy until the owner removes it by hand. The README and `.factory/playbook.md` say so. Alternative: prune files under each installed Kanon skill folder that the commit no longer has. That adds a delete path to a script whose header says "Nothing is ever deleted", a new test group, and a risk of deleting a file the owner put in a skill folder.
2. Order of `KANON_SKILLS`. Chosen (recommended): alphabetical, as in Change step 1, since `map.find` order no longer matters after the fix. Alternative: keep `standards-discovery` first and append the four, which makes a smaller diff.
3. The doubled `git cat-file` read for the 14 files that install twice. Chosen (recommended): read twice, no cache. Alternative: read once per blob in `install()` and reuse it. It saves 14 git calls per install and adds a map to `install()`.
