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

Issue labels while a sweep finishes an issue, in write order: `factory-running`, then `factory-running` and `factory-failed`, then the comment, then `factory-failed` alone. `factory-running` goes last, so a kill or a `gh` error at any point leaves the label the next sweep reads. After the removal the sweep reads the issue again and throws when `factory-running` is still there, so a failed removal keeps the folder (open decision 10).

Entries from `expired/` keep today's stale entry shape. A readable claim gives `{ lock, repo, issue, run_id, claimed_at, dashboard }`. An unreadable one gives `{ lock, repo?, issue?, reason, changed_at }`. `changed_at` stays the original folder mtime, since every rename keeps it (probe 1).

## Probes

Probes ran in a scratchpad copy of `pick-up.mjs` and `pick-up.test.mjs`. Each variant swaps one line of the prototype and runs the test file as it stood at that probe (90 tests for probes 1 to 4, 94 for probe 5).

1. A rename keeps the folder mtime on APFS and moves ctime to the rename time. This holds both into `expired/` and within it. Script `p1.mjs`: `before mtime 2026-01-01T00:00:00.000Z`, `after mv mtime 2026-01-01T00:00:00.000Z, ctime 2026-11-22T12:09:39.552Z`, `rename in expired/ mtime 2026-01-01T00:00:00.000Z, ctime 2026-11-22T12:09:40.655Z`. A lock moves to `expired/` only once it is stale, so its mtime is already more than 4 hours old at the take. Under the issue's "folder mtime" rule, a second claim takes the folder from a live sweep. Variant `mtime` ages from mtime. It fails `a lock another claim just took from locks/ is not taken by a second claim` with `2 !== 1` comments, and fails 3 more tests, `a folder taken exactly 4 hours ago is left alone` among them.
2. A lock name can contain dots, since `REPO_RE` allows `.` (`o/my.repo` gives `o-my.repo-4`). The parse is `/^(.+?)(?:\.(\d+))?\.<uuid>$/`. The lazy group keeps the dots in the lock name and takes the stamp only as the last number before the uuid. Test `an unreadable folder of a repo with dots in its name keeps its full lock name` passes on the prototype. One case cannot be told apart. A #10 name whose lock itself ends in `.<digits>` reads as a stamp. `lockName` always ends in `-<issue>`, so only a hand-made folder in `locks/` can produce that.
3. Live lock guard. A check of `locks/<lock>` alone is not enough. When the re-claim already finished and released, there is no lock and no `factory-running`. Variant `lockonly` then gives that issue `factory-failed` and a "did not release" comment. It fails `has needs-plan-approval and no factory-running` and `has factory-failed and no factory-running`. Variant `labelonly` reads labels and skips the lock check. It finishes an issue a live claim holds and fails `a live claim holds again`. The prototype checks the lock, reads labels, then checks the lock again. A claim makes its lock before it adds `factory-running`, so a live claim seen in the label read has its lock by the second check. Release removes the label before the lock, so a release that finishes while the read is in flight held its lock at the first check. Test `a release that finishes during the issue read does not make the issue look stuck` fails with only the second check and passes with both.
4. Re-handling after a partial run. With today's write order (`factory-running` removed first), a re-take is a single attempt. Once `removeLabel` has run, a `gh` error or a kill leaves an issue without `factory-running`, and the next sweep drops the folder with no `factory-failed`. With a fake `gh` that keeps labels, the prototype in today's order fails `a gh error puts the folder back under its old name and the next tick retries` with `0 !== 1` stale entries. With `factory-running` removed last it passes. Then a kill after the comment and before `removeLabel` gives a second comment on retry. A kill after `removeLabel` leaves `factory-failed` alone, and the folder is dropped with no second comment. Variant `noguard` posts that second comment and fails 4 tests.
5. A failed `factory-running` removal. With `factory-running` removed last inside `ignoreFailure`, a real error there (network, rate limit, 5xx) is swallowed and the folder is deleted. The issue keeps both labels with no lock and no folder, so pick-up skips it forever once the owner removes `factory-failed`. At base later calls threw on the same outage. Test `a failed factory-running removal keeps <a stale lock | a folder in expired/> and the next tick finishes the issue` makes the fake `removeLabel` throw `HTTP 502` once. Both cases fail on the probe 4 prototype and pass with either fix in open decision 10. What `gh issue edit --remove-label` does with a label that is not on the issue, read from the gh v2.105.0 source (the installed version) and not run against any issue: `UpdateIssue` in `pkg/cmd/pr/shared/editable_http.go` maps names to ids with `LabelsToIDs`, which returns `'<name>' not found` only when the label is missing from the repo. It then sends the GraphQL `removeLabelsFromLabelable` mutation. The sweep runs `ensureLabels` before this call, so the repo case cannot arise. Whether the mutation errors for a label the issue does not have is not observed. I expect a no-op, but this is a guess.

## Changes

### `playbooks/scripts/pick-up.mjs`

- Add `expiredDir(d)` next to `locksDir(d)`.
- Add `parseTaken(name)`. It returns `{ lock, takenAtMs }` for `<lock>.<ms>.<uuid>`, `{ lock, takenAtMs: 0 }` for `<lock>.<uuid>`, and `null` for any other name.
- `inspectLock(dir)` takes the folder path, so one function inspects both `locks/` and `expired/`.
- `takeLock(d, from, lock)` renames `from` to `expired/<lock>.<d.now()>.<uuid>`. Both the first take and a re-take use it. `ENOENT` still means another claim took it first.
- Add `stillStuck(d, { repo, issue })`. It returns false when `locks/<lockName>` exists. Else it calls `d.gh.getIssue` and returns true when the issue has `factory-running` and `locks/<lockName>` is still absent. A null result (a PR) counts as not stuck.
- `handleStale` lists `locks/` and the parsed names in `expired/` up front. A missing `locks/` no longer returns early. Per folder, in this order:
  1. `inspectLock`. Skip `gone`.
  2. Age check. A folder from `expired/` ages by `takenAtMs`. A lock ages by `claimed_at` or folder mtime, as today. Build the entry as today.
  3. Unless `--dry-run`, `takeLock`, and skip on `undefined`. Steps 1 to 3 keep no `gh` call or `await` between them.
  4. For a folder from `expired/` with `repo`, when `stillStuck` is false, remove the taken folder and go on. `--dry-run` runs this read too, so its list matches a real run. Under `--dry-run` nothing was taken, so a folder whose issue moved on is neither removed nor listed. Test `dry-run neither lists nor removes a folder whose issue moved on` covers it.
  5. List the entry. Stop here under `--dry-run`. Else ensure labels, add `factory-failed`, comment, and remove `factory-running` last, still inside `ignoreFailure`. Then read the issue with `getIssue` and throw when it still has `factory-running`. This order applies to locks from `locks/` too.
  6. On a throw in step 4 or 5, rename the taken folder back to the path it came from and rethrow. For a lock that is `locks/<lock>`, as today. For a re-take it is the old `expired/` name with its old stamp, so the next tick retries. Skip the rename when nothing was taken (`--dry-run`).
  7. Remove the taken folder. Post `expired` only for entries with `run_id`, as today.
- Header comment. Name the folder format `expired/<lock>.<takenAtMs>.<uuid>` and say that the sweep finishes folders left there.
- Unchanged. `isStale`, `matchLockName`, `cmdList`, `cmdRelease`, the comment bodies, the entry shape.

The prototype diff is 62 lines added and 27 removed in this file.

### `playbooks/scripts/pick-up.test.mjs`

- Import `randomUUID` from `node:crypto`. Import nothing new from `pick-up.mjs`, so the file still loads against origin/main.
- The fake `addLabel` and `removeLabel` change the fixture issue's labels, as GitHub does. The 74 tests at base still pass with it.
- `stale: an unreadable lock matching a --repo marks the issue factory-failed` expects the new write order: `addLabel`, `comment`, `removeLabel`.
- Add helper `expiredLock(stateDir, lock, takenAtMs, content)`. It makes `expired/<lock>.<takenAtMs>.<uuid>`, or `<lock>.<uuid>` when `takenAtMs` is undefined, with an optional raw `claim.json` and folder mtime `T0`. Fixture issues come from a function, since the fake now changes them.
- Add the 20 tests below. Every one drives `cmdClaim`.

### `playbooks/factory.md`, "Scheduled pick-up"

Extend the stale lock line with this text. A sweep moves a stale lock to `~/.factory/expired/` before it changes labels, and removes `factory-running` last. A sweep killed there leaves the folder behind. A later tick finishes such a folder 4 hours after the move when its issue still has `factory-running` and no lock, and lists it under `stale`. Otherwise it removes the folder and changes no label.

## Tests, one per acceptance criterion

| # | Criterion | Test |
|---|---|---|
| 1 | Old folder matching a `--repo` gets `factory-failed`, loses `factory-running`, gets one comment, is removed and listed | `expired: a folder taken more than 4 hours ago is finished like a stale lock` (exact `gh` writes, empty `expired/`, one `expired` event). Narrower than the issue text: only while the issue still has `factory-running` and no lock (open decision 2) |
| 2 | Young folder is left alone | `expired: a folder taken exactly 4 hours ago is left alone` |
| 3 | Two claims handle one folder once | `expired: two claims sweeping one folder handle it once`. Claim B starts inside claim A's first clock read, after A listed the folder and before A takes it |
| 4 | `--dry-run` lists it and changes nothing | `expired: dry-run lists an old folder and changes nothing` |
| 5 | `node --test playbooks/scripts/pick-up.test.mjs` passes | Gate at the head commit |

Extra tests.

- Probe 1. `expired: a lock another claim just took from locks/ is not taken by a second claim while the first one handles it`, and the same for `a folder another claim just took again`. Claim B starts inside claim A's first `gh` write.
- Probe 3. `expired: a folder whose issue a live claim holds again is removed with no gh write`. `expired: a folder whose issue has needs-plan-approval and no factory-running is removed with no gh write`, and the same for `factory-failed`. `expired: a release that finishes during the issue read does not make the issue look stuck`. `expired: dry-run neither lists nor removes a folder whose issue moved on`.
- Probe 5. `expired: a failed factory-running removal keeps a stale lock and the next tick finishes the issue`, and the same for `a folder in expired/`.
- Probe 4. `expired: a gh error puts the folder back under its old name and the next tick retries`. `expired: a folder whose issue has factory-running and factory-failed is finished`. `expired: a failed issue read puts the folder back under its old name`, with and without `--dry-run`.
- Probe 2 and names. `a folder from a #10 sweep, with no take time in its name, is finished at once`, `an unreadable folder of a repo with dots in its name keeps its full lock name`, `an unreadable folder matching no --repo is removed and listed by folder only`, `a plain file and a folder without a taken name are left alone`.

Scratchpad run of the 94-test file (74 today plus 20) in a copy of the repo layout. Against origin/main 77 pass and 17 fail: 16 new tests and the reordered `stale:` test. Against the prototype 94 pass. Four new tests pass at both, and each pins behavior that is already right: the young folder, the lock taken from `locks/`, the stray entries, and the dry-run folder whose issue moved on. The variant runs in the probes show that the concurrency and guard tests fail when their mechanism is removed.

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

Baseline at 0b7c118. Pick-up 74 pass, capture-ui 115 pass, bootstrap 3 OK, event-model 4 OK, factory-onboard 27 OK. Pick-up is expected at 94 pass.

## Out of scope

- A claim that starts while the sweep's `gh` calls run can still race the label changes on an issue with no labels. The lock sweep has the same window at base.
- #10 folders whose sweep died after it removed `factory-running`. The issue has neither label, the next tick re-claims it as at base, and the folder is dropped with no comment. New sweeps cannot reach that state, since `factory-running` goes last.
- `cmdRelease`, `lockName` collisions, and `claim.json` content rules. They are unchanged from #10.
- Event model. Skip, no journey for internal tooling. The repo has no brain vault. In `codyssey-docs` at 45f0becf, `grep -rln -e pick-up.mjs -e factory-running` finds three files under `Ideas/` and one under `Technical/Research Notes/`, none under `Architecture/`.

## Owner follow-ups

- Copy `playbooks/scripts/pick-up.mjs` and `playbooks/factory.md` to `~/.agents/playbooks/` after merge. The copies are made by hand and nothing syncs them.
- Before that copy, `ls ~/.factory/expired/` shows the #10 folders the first tick will finish (open decision 6). A read-only listing by this factory run on 2026-11-22 showed `~/.factory/` holds `armed`, `evidence`, `locks` and `skills`, and `~/.factory/expired/` does not exist. Decision 6 has no folders to act on on this Mac today.
- `~/.claude/scheduled-tasks/factory-pickup/SKILL.md` step 3 needs no change for #21. Entries from `expired/` keep today's shape, and folders whose issue moved on are not listed. The #10 follow-up is still open. Step 3 still reads "Factory run <entry run_id> held the claim since <entry claimed_at>" for every entry, including unreadable ones (read 2026-11-22).

## Open decisions

1. How a folder in `expired/` is aged. Chosen, the take time in the name, `<lock>.<takenAtMs>.<uuid>`. A re-take renames to a fresh name, so a kill during the second handling is retried 4 hours later. No window remains while a sweep runs under 4 hours. Alternative, folder mtime as the issue says. A rename keeps it, so a second claim double-handles every take (probe 1). Alternative, `utimesSync` right after the rename. Another process that lists `expired/` between the two calls sees the old mtime and takes the folder. Alternative, ctime. The rename sets it, so it leaves no window. Tests cannot set ctime, and it mixes the file system clock with `d.now()`.
2. Which old folders are finished. Chosen, read the issue first. Finish only while it has `factory-running` and no lock. Else remove the folder with no `gh` write. This costs one `getIssue` per old folder. Alternative, a lock check only with no `gh` read. It marks an issue `factory-failed` after a later run planned and released it (probe 3). Alternative, no check, as the issue text reads, with that fault plus breaking a live run.
3. Write order. Chosen, add `factory-failed` and comment before removing `factory-running`, for locks and folders alike. Every partial run then leaves `factory-running`, so the decision 2 check retries it, and a kill can no longer leave an issue with neither label. The cost is a second comment after a kill between the comment and `removeLabel`, and both labels on the issue for a few `gh` calls. Alternative, keep today's order and state the limit: once `removeLabel` has run, a re-take is a single attempt, and the issue is re-claimed as at base (probe 4).
4. Folders whose issue moved on. Chosen, not listed under `stale`, because step 3 reports `failed` for every entry. Alternative, list them with a `skipped` field, which needs a step 3 change.
5. A `gh` error on a re-taken folder. Chosen, rename it back to its old `expired/` name, so the next tick retries. Alternative, leave it under the fresh name, so it is retried 4 hours later.
6. #10 names without a take time. Chosen, they count as taken at 0 and are finished on the first sweep, with the decision 2 check. Alternative, rename them to a fresh name and finish them 4 hours later. That spares an old-version sweep that is still running during the copy. Alternative, ignore them.
7. Extra field on entries from `expired/`. Chosen, none. Step 3 reads only `repo`, `issue`, `run_id` and `claimed_at`. Alternative, `taken_at` with the time of the first take.
8. Other entries in `expired/`. Chosen, a file or a folder whose name does not parse is left alone with no output. Alternative, remove it.
9. `--dry-run` and the label read. Chosen, dry-run makes the same `getIssue` read, so its list matches a real run. Alternative, list every old folder with no `gh` call.
10. A failed `factory-running` removal (probe 5). Chosen, keep `ignoreFailure` on the removal, then read the issue again and throw when `factory-running` is still there. The throw renames the folder back, and the next tick finishes the issue. The cost is one more `getIssue` per handled entry, and at most one duplicate comment on retry. It holds whatever GitHub does with a label the issue lacks. Alternative, drop `ignoreFailure` so any throw renames the folder back. It is one line smaller and passes the same tests. It relies on `removeLabelsFromLabelable` being a no-op for a label the issue lacks, which this run did not observe. If that call errors, a stale lock whose issue never got `factory-running` makes every claim exit 1. Switch to it if the owner confirms the no-op.
