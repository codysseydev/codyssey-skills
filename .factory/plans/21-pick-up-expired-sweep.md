# Plan for #21, pick-up.mjs sweep of folders left in expired/

Issue codysseydev/codyssey-skills#21. Base origin/main 0b7c118. Branch `factory/21`.

## Goal

The stale sweep in `pick-up.mjs` also finishes folders that a killed sweep left in `$FACTORY_HOME/expired/` more than 4 hours ago. Two claims sweeping at once handle each folder once.

## Data shape

A taken folder is named `expired/<lock>.<takenAtMs>.<uuid>`. `takenAtMs` is `d.now()` at the rename. The #10 code writes `expired/<lock>.<uuid>`.

| State of a folder in `expired/` | Test | Outcome |
|---|---|---|
| young | `now - takenAtMs <= STALE_MS` | left alone |
| old, issue still stuck | issue has `factory-running` and `locks/<lock>` is absent | finished like a stale lock, listed under `stale` |
| old, issue moved on | issue lacks `factory-running`, or `locks/<lock>` exists | folder removed, no `gh` write, not listed |
| old, no repo | unreadable and its lock name matches no `--repo` | folder removed, listed by `lock` only, no `gh` call |
| #10 name | `<lock>.<uuid>`, no take time | counts as taken at 0, so old |
| other | a file, or a folder name that does not parse | left alone |

Entries from `expired/` keep today's stale entry shape. A readable claim gives `{ lock, repo, issue, run_id, claimed_at, dashboard }`. An unreadable one gives `{ lock, repo?, issue?, reason, changed_at }`. `changed_at` stays the original folder mtime, since every rename keeps it (probe 1).

## Probes

1. A rename keeps the folder mtime on APFS and moves ctime to the rename time. This holds both into `expired/` and within it. Script `p1.mjs`: `before mtime 2026-01-01T00:00:00.000Z`, `after mv mtime 2026-01-01T00:00:00.000Z, ctime 2026-11-22T12:09:39.552Z`, `rename in expired/ mtime 2026-01-01T00:00:00.000Z, ctime 2026-11-22T12:09:40.655Z`. A lock moves to `expired/` only once it is stale, so its mtime is already more than 4 hours old at the take. Under the issue's "folder mtime" rule, a second claim takes the folder from a live sweep. Variant `v-mtime` ages from mtime. It fails `a lock another claim just took from locks/ is not taken by a second claim` with `2 !== 1` comments, and it fails `a folder taken exactly 4 hours ago is left alone`.
2. A lock name can contain dots, since `REPO_RE` allows `.` (`o/my.repo` gives `o-my.repo-4`). The parse is `/^(.+?)(?:\.(\d+))?\.<uuid>$/`. The lazy group keeps the dots in the lock name and takes the stamp only as the last number before the uuid. Test `an unreadable folder of a repo with dots in its name keeps its full lock name` passes on the prototype. One case cannot be told apart. A #10 name whose lock itself ends in `.<digits>` reads as a stamp. `lockName` always ends in `-<issue>`, so only a hand-made folder in `locks/` can produce that.
3. Live lock guard. A check of `locks/<lock>` alone is not enough. When the re-claim already finished and released, there is no lock and no `factory-running`. Variant `v-lockonly` then gives that issue `factory-failed` and a "did not release" comment. It fails both `has needs-plan-approval and no factory-running` and `has factory-failed and no factory-running`. Variant `v-labelonly` reads labels and skips the lock check. It finishes an issue a live claim holds and fails `a live claim holds again`. The prototype reads labels first and then checks the lock. A claim makes its lock before it adds `factory-running`, so a live claim seen in the label read always has its lock. Release removes the label before the lock. A release that finishes both its comment and its lock removal while the label read is in flight still looks stuck. That gap is one `gh` read long.
4. A kill after the comment and before `rmSync` leaves the issue on `factory-failed` without `factory-running`. The label read from probe 3 removes that folder with no second comment. Variant `v-noguard` posts the second comment and fails three tests. See open decision 2.

## Changes

### `playbooks/scripts/pick-up.mjs`

- Add `expiredDir(d)` next to `locksDir(d)`.
- Add `parseTaken(name)`. It returns `{ lock, takenAtMs }` for `<lock>.<ms>.<uuid>`, `{ lock, takenAtMs: 0 }` for `<lock>.<uuid>`, and `null` for any other name.
- `inspectLock(dir)` takes the folder path, so one function inspects both `locks/` and `expired/`.
- `takeLock(d, from, lock)` renames `from` to `expired/<lock>.<d.now()>.<uuid>`. Both the first take and a re-take use it. `ENOENT` still means another claim took it first.
- Add `stillStuck(d, { repo, issue })`. It calls `d.gh.getIssue` and returns true when the issue has `factory-running`, and only then checks that `locks/<lockName>` is absent. A null result (a PR) counts as not stuck.
- `handleStale` lists `locks/` and the parsed names in `expired/` up front. A missing `locks/` no longer returns early. Per folder, in this order:
  1. `inspectLock`. Skip `gone`.
  2. Age check. A folder from `expired/` ages by `takenAtMs`. A lock ages by `claimed_at` or folder mtime, as today. Build the entry as today.
  3. Unless `--dry-run`, `takeLock`, and skip on `undefined`. Steps 1 to 3 keep no `gh` call or `await` between them.
  4. For a folder from `expired/` with `repo`, when `stillStuck` is false, remove the taken folder and go on. `--dry-run` runs this read too, so its list matches a real run.
  5. List the entry. Stop here under `--dry-run`. Else remove `factory-running`, ensure labels, add `factory-failed` and comment, as today.
  6. On a throw in step 4 or 5, rename the taken folder back to the path it came from and rethrow. For a lock that is `locks/<lock>`, as today. For a re-take it is the old `expired/` name with its old stamp, so the next tick retries. Guard the rename with `if (taken)` for `--dry-run`.
  7. Remove the taken folder. Post `expired` only for entries with `run_id`, as today.
- Header comment. Name the folder format `expired/<lock>.<takenAtMs>.<uuid>` and say that the sweep finishes folders left there.
- Unchanged. `isStale`, `matchLockName`, `cmdList`, `cmdRelease`, the comment bodies, the entry shape.

The prototype diff is 58 lines added and 30 removed in this file.

### `playbooks/scripts/pick-up.test.mjs`

- Import `randomUUID` from `node:crypto`. Import nothing new from `pick-up.mjs`, so the file still loads against origin/main.
- Add helper `expiredLock(stateDir, lock, takenAtMs, content)`. It makes `expired/<lock>.<takenAtMs>.<uuid>`, or `<lock>.<uuid>` when `takenAtMs` is undefined, with an optional raw `claim.json` and folder mtime `T0`.
- Add the 14 tests below. Every one drives `cmdClaim`.

### `playbooks/factory.md`, "Scheduled pick-up"

Extend the stale lock line with this text. A sweep moves a stale lock to `~/.factory/expired/` before it changes labels. A sweep killed there leaves the folder behind. A later tick finishes such a folder 4 hours after the move when its issue still has `factory-running` and no lock, and lists it under `stale`. Otherwise it removes the folder and changes no label.

## Tests, one per acceptance criterion

| # | Criterion | Test |
|---|---|---|
| 1 | Old folder matching a `--repo` gets `factory-failed`, loses `factory-running`, gets one comment, is removed and listed | `expired: a folder taken more than 4 hours ago is finished like a stale lock` (exact `gh` writes, empty `expired/`, one `expired` event) |
| 2 | Young folder is left alone | `expired: a folder taken exactly 4 hours ago is left alone` |
| 3 | Two claims handle one folder once | `expired: two claims sweeping one folder handle it once`. Claim B starts inside claim A's first clock read, after A listed the folder and before A takes it |
| 4 | `--dry-run` lists it and changes nothing | `expired: dry-run lists an old folder and changes nothing` |
| 5 | `node --test playbooks/scripts/pick-up.test.mjs` passes | Gate at the head commit |

Extra tests.

- Probe 1. `expired: a lock another claim just took from locks/ is not taken by a second claim while the first one handles it`, and the same for `a folder another claim just took again`. Claim B starts inside claim A's first `gh` write.
- Probes 3 and 4. `expired: a folder whose issue a live claim holds again is removed with no gh write`. `expired: a folder whose issue has needs-plan-approval and no factory-running is removed with no gh write`, and the same for `factory-failed`.
- Step 6. `expired: a gh error puts the folder back under its old name and the next tick retries`.
- Probe 2 and names. `a folder from a #10 sweep, with no take time in its name, is finished at once`, `an unreadable folder of a repo with dots in its name keeps its full lock name`, `an unreadable folder matching no --repo is removed and listed by folder only`, `a plain file and a folder without a taken name are left alone`.

Scratchpad run of the 88-test file (74 today plus 14). Against origin/main 77 pass and 11 fail. Against the prototype 88 pass. Three new tests pass at both, and each pins behavior that is already right: the young folder, the lock taken from `locks/`, and the stray entries. The variant runs in the probes show that the concurrency and guard tests fail when their mechanism is removed.

## Gates

From the worktree root, at the head commit, clean tree.

```sh
node --test playbooks/scripts/pick-up.test.mjs
node --test playbooks/scripts/capture-ui.test.mjs
python3 -m unittest discover -s factory/bootstrap/tests
python3 -m unittest discover -s factory/event-model/tests
python3 -m unittest discover -s factory/factory-onboard/tests
grep -q "~/.factory/expired/" playbooks/factory.md
```

Baseline at 0b7c118. Pick-up 74 pass, capture-ui 115 pass, bootstrap 3 OK, event-model 4 OK, factory-onboard 27 OK. Pick-up is expected at 88 pass.

## Out of scope

- A claim that starts while the sweep's `gh` calls run can still race the label changes on an issue with no labels. The lock sweep has the same window at base.
- Reporting the crash for an issue killed after `factory-running` was removed and before `factory-failed` was added. The next tick re-claims that issue as at base. By the 4 hour mark the folder cannot tell a crashed issue from one a later run finished, so it is removed (open decision 2).
- `cmdRelease`, `lockName` collisions, and `claim.json` content rules. They are unchanged from #10.
- Event model. Skip, no journey for internal tooling. The repo has no brain vault. In `codyssey-docs` at 45f0becf, `grep -rln -e pick-up.mjs -e factory-running` finds three files under `Ideas/` and one under `Technical/Research Notes/`, none under `Architecture/`.

## Owner follow-ups

- Copy `playbooks/scripts/pick-up.mjs` and `playbooks/factory.md` to `~/.agents/playbooks/` after merge. The copies are made by hand and nothing syncs them.
- Before that copy, `ls ~/.factory/expired/` shows the #10 folders the first tick will finish (open decision 5). This run did not read `~/.factory`.
- `~/.claude/scheduled-tasks/factory-pickup/SKILL.md` step 3 needs no change for #21. Entries from `expired/` keep today's shape, and folders whose issue moved on are not listed. The #10 follow-up is still open. Step 3 still reads "Factory run <entry run_id> held the claim since <entry claimed_at>" for every entry, including unreadable ones (read 2026-11-22).

## Open decisions

1. How a folder in `expired/` is aged. Chosen, the take time in the name, `<lock>.<takenAtMs>.<uuid>`. A re-take renames to a fresh name, so a kill during the second handling is retried 4 hours later. No window remains while a sweep runs under 4 hours. Alternative, folder mtime as the issue says. A rename keeps it, so a second claim double-handles every take (probe 1). Alternative, `utimesSync` right after the rename. Another process that lists `expired/` between the two calls sees the old mtime and takes the folder. Alternative, ctime. The rename sets it, so it leaves no window. Tests cannot set ctime, and it mixes the file system clock with `d.now()`.
2. Which old folders are finished. Chosen, read the issue first. Finish only while it has `factory-running` and no lock. Else remove the folder with no `gh` write. This costs one `getIssue` per old folder and never posts a second comment. Alternative, a lock check only with no `gh` read. It marks an issue `factory-failed` after a later run planned and released it, and posts a second comment after a kill between the comment and `rmSync` (probes 3 and 4). Alternative, no check, as the issue text reads, with the same two faults plus breaking a live run.
3. Folders whose issue moved on. Chosen, not listed under `stale`, because step 3 reports `failed` for every entry. Alternative, list them with a `skipped` field, which needs a step 3 change.
4. A `gh` error on a re-taken folder. Chosen, rename it back to its old `expired/` name, so the next tick retries. Alternative, leave it under the fresh name, so it is retried 4 hours later.
5. #10 names without a take time. Chosen, they count as taken at 0 and are finished on the first sweep, with the open decision 2 check. Alternative, rename them to a fresh name and finish them 4 hours later. That spares an old-version sweep that is still running during the copy. Alternative, ignore them.
6. Extra field on entries from `expired/`. Chosen, none. Step 3 reads only `repo`, `issue`, `run_id` and `claimed_at`. Alternative, `taken_at` with the time of the first take.
7. Other entries in `expired/`. Chosen, a file or a folder whose name does not parse is left alone with no output. Alternative, remove it.
8. `--dry-run` and the label read. Chosen, dry-run makes the same `getIssue` read, so its list matches a real run. Alternative, list every old folder with no `gh` call.
