# Plan for #10, pick-up.mjs stale lock handling

Issue codysseydev/codyssey-skills#10. Base origin/main 8c85764. Branch `factory/10`.

## Goal

The stale sweep in `pick-up.mjs` expires unreadable locks and handles each stale lock once, and `factory.md` says runs on different issues may run at the same time.

## Data shape

Lock states. A lock is a folder in `$FACTORY_HOME/locks/` named `lockName(repo, n)`.

| State | Test | Stale when |
|---|---|---|
| readable | `claim.json` parses and `Date.parse(claimed_at)` is a number | `isStale(claimed_at, now)`, as today |
| unreadable | `claim.json` is missing, does not parse, or `claimed_at` is not a date | `now - folder mtime > STALE_MS` |
| gone | the folder vanished after `readdirSync` | never, skipped |
| taken | one claim renamed it to `$FACTORY_HOME/expired/<lock>.<uuid>` | removed by that claim after its `gh` calls |

Stale entry in the claim result.

```js
// readable (one new field, `lock`)
{ lock: 'o-r-4', repo: 'o/r', issue: 4, run_id: 'old', claimed_at: '2026-01-01T12:00:00.000Z', dashboard: 'sent' }
// unreadable, folder name matches exactly one --repo
{ lock: 'o-r-4', repo: 'o/r', issue: 4, reason: 'no claim.json', changed_at: '2026-01-01T07:00:00.000Z' }
// unreadable, no match or more than one match
{ lock: 'other-repo-7', reason: 'no claim.json', changed_at: '2026-01-01T07:00:00.000Z' }
```

- `reason` is one of `no claim.json`, `claim.json does not parse`, `claimed_at is not a date`.
- `changed_at` is the folder mtime as ISO. It stands in for `claimed_at`, since creating `claim.json` sets the folder mtime (probe 3c).
- Unreadable entries have no `run_id`, `claimed_at` or `dashboard` key. No `expired` event is posted for them.

## Changes

### `playbooks/scripts/pick-up.mjs`

- Imports. Add `renameSync`, `statSync` from `node:fs` and `randomUUID` from `node:crypto`.
- Delete `readClaims`. `handleStale` is its only caller.
- Add `inspectLock(d, name)`. It returns `{ kind: 'gone' }` when `statSync` throws `ENOENT`, `{ kind: 'unreadable', reason, mtimeMs }`, or `{ kind: 'readable', claim }`. The folder mtime comes from `statSync(dir).mtimeMs`.
- Add exported `matchLockName(name, repos)`. For each repo it checks `name.startsWith(repo.replace('/', '-') + '-')` and that the rest is all digits. It returns `{ repo, issue }` on exactly one hit, else `undefined`.
- Add `takeLock(d, name)`. It creates `$FACTORY_HOME/expired/` and renames `locks/<name>` to `expired/<name>.<randomUUID()>`. It returns the new path, or `undefined` on `ENOENT` (another claim took it first). Other errors throw.
- Rewrite `handleStale(d, repos, dryRun)` as one loop over `readdirSync(locks)`. Per folder, in this order with no `gh` call or `await` between steps 1 and 3.
  1. `inspectLock`. Skip `gone`.
  2. Skip when not stale. Build the entry. Unreadable entries take `repo` and `issue` from `matchLockName`.
  3. Under `--dry-run`, list it and go on. Else `takeLock`, and skip it when that returns `undefined`.
  4. List it. When the entry has `repo`, remove `factory-running`, add `factory-failed` and comment. A readable lock keeps today's comment. An unreadable one gets `A factory run left an unreadable lock on this issue (<reason>), last changed at <changed_at>, more than 4 hours ago. Marked factory-failed. Remove the label to retry.`
  5. When a `gh` call throws, rename the folder back to `locks/<name>` and rethrow. The next tick retries, as today.
  6. Remove the taken folder. Post `expired` only when `run_id` is set, as today.
- `cmdClaim` passes `repos` to `handleStale`.
- Header comment. Name the `expired/` folder next to `locks/`.
- Unchanged. `isStale`, `evaluateRows` (a young unreadable lock stays `locked` through `existsSync`), `cmdList`, `cmdRelease`.

### `playbooks/scripts/pick-up.test.mjs`

- Add helper `rawLock(stateDir, name, content, mtime)`. It writes the folder and an optional raw `claim.json`, then sets the folder mtime with `utimesSync` after the write.
- Change the `deepEqual` in `stale: claim marks factory-failed, comments, deletes lock and lists it` to expect `lock: 'o-r-4'`.
- Replace `claim: lock created between listing and mkdir is skipped via EEXIST` with the test for criterion 8.
- Stale tests pass `issues: { [R]: [] }`. With issue 4 listed, the fake `gh` keeps no labels and the same claim takes issue 4 again (seen in the prototype run).

### `playbooks/factory.md`, "Scheduled pick-up"

- Replace the "One run at a time" line with this text. Runs on different issues may run at the same time. The per-issue lock in `~/.factory/locks/` is the only guard. It is enough because the lock stops two runs from taking the same issue, and each run works in its own worktree and branch. Desktop skipping its own next tick while a scheduled run is going is scheduling, not a guard. A hand-started run (`claim --only`) can run next to a scheduled one.
- Extend the stale lock line. A lock whose `claim.json` is missing, does not parse or has no valid `claimed_at` is stale when its folder is more than 4 hours old. The session reports `failed` for each `stale` entry that names `repo` and `issue`. An entry with only `lock` goes in the final message.

## Tests, one per acceptance criterion

| # | Criterion | Test |
|---|---|---|
| 1 | `factory.md` states concurrent runs, the lock as the only guard, the reason. "One run at a time" is gone | No code test. Gate `! grep -q "One run at a time" playbooks/factory.md` exits 0, plus a diff read of the new line |
| 2 | Old folder with no `claim.json` is removed and listed with its folder name | `stale: an old lock folder with no claim.json is removed and listed` |
| 3 | Same for `claim.json` that does not parse, and `claimed_at` not a date | `stale: an old lock with unparseable claim.json is removed and listed`, `stale: an old lock whose claimed_at is not a date is removed and listed` |
| 4 | Young folder with no `claim.json` stays, issue stays `locked` | `stale: a young lock folder with no claim.json is kept and its issue stays locked` (checks `cmdList` reason `locked`) |
| 5 | Match gives `factory-failed`, a comment, `repo` and `issue`. No match gives the folder only and no `gh` call | `stale: an unreadable lock matching a --repo marks the issue factory-failed`, `stale: an unreadable lock matching no --repo is listed by folder only with no gh call`, `stale: a folder name matching two --repo values is treated as no match` |
| 6 | `--dry-run` lists and changes nothing | `dry-run lists a stale unreadable lock and changes nothing` |
| 7 | Two claims on one stale lock give one comment, one label, one `expired` | `stale: two claims sweeping one lock comment, label and post once`. Claim B starts inside claim A's first `d.now()` call, after A read the lock and before A takes it |
| 8 | A test reaches the `EEXIST` catch and the claim moves on | `claim: lock created after evaluation is skipped via EEXIST`. Issue 1 has `Depends on: #99`. The fake `issueState` writes issue 1's lock, which runs after `hasLock` was read for issue 1 |
| 9 | `node --test playbooks/scripts/pick-up.test.mjs` passes | Gate run at the head commit |

One extra test guards step 5. `stale: a gh error after the take puts the lock back and throws`.

Each of tests 2 to 8 was run as a scratchpad probe against origin/main and against a scratchpad prototype of this design. Tests 2, 3, 5, 6 and 7 fail at origin/main and pass on the prototype. Tests 4 and 8 pass at both. Test 4 pins behavior that is already right, and the gap for 8 is in the test file only. It hit the `EEXIST` catch once, against zero for the current test (instrumented copy).

## Gates

From the worktree root, at the head commit, clean tree.

```sh
node --test playbooks/scripts/pick-up.test.mjs
python3 -m unittest discover -s factory/bootstrap/tests
python3 -m unittest discover -s factory/event-model/tests
python3 -m unittest discover -s factory/factory-onboard/tests
! grep -q "One run at a time" playbooks/factory.md
```

Baseline at 8c85764. Pick-up 47 pass, bootstrap 3 OK, event-model 4 OK, factory-onboard 25 OK.

## Out of scope

- `cmdRelease`. It still returns `not_owner` for an empty or unparseable lock. The run that made such a lock was killed, so the sweep is the path that frees it.
- `lockName` collisions. Repos `a/b-c` and `a-b/c` share one lock name today. This plan only refuses to guess on such a folder.
- A `claim.json` with a valid `claimed_at` but no `repo` or `issue`. It stays on the readable path.
- Event model. Skip, no journey for internal tooling. The repo has no brain vault, and `codyssey-docs` names `pick-up.mjs` only in idea notes, not in a journey file.

## Owner follow-ups

- Copy `playbooks/scripts/pick-up.mjs` and `playbooks/factory.md` to `~/.agents/playbooks/` after merge. The copies are made by hand and nothing syncs them.
- Edit step 3 of `~/.claude/scheduled-tasks/factory-pickup/SKILL.md`. `report_stage` requires `repo` and `issue_number`, so an entry with only `lock` cannot be reported, and today's step would call it with neither. A matched unreadable entry has no `run_id` or `claimed_at`, so today's summary would read "Factory run undefined held the claim since undefined". Proposed step 3. Report `failed` only for entries with `repo` and `issue`. Use the current summary when the entry has `run_id`. Otherwise use "An unreadable factory lock (<reason>) last changed at <changed_at> was older than 4 hours. Marked factory-failed; remove the label to retry." List entries with only `lock` in the final message.

## Open decisions

1. Where the taken lock goes. Chosen `$FACTORY_HOME/expired/<lock>.<uuid>`. It is a sibling of `locks/`, so the rename stays on one filesystem, and the sweep's `readdirSync(locks)` never lists it. The uuid keeps names unique, since a rename onto an existing empty folder succeeds (probe 3a). Alternative `os.tmpdir()`, which can be another volume and fail with `EXDEV`.
2. Recovery after the take. Chosen, a `gh` error renames the folder back to `locks/` and rethrows, which keeps today's retry. A kill between the take and the removal leaves the folder in `expired/` and can leave the issue on `factory-running` with no lock. Alternative, the sweep also finishes folders in `expired/` older than 4 hours.
3. Rechecking after the take. Chosen, no recheck. Inspect and take run back to back, so a rival would have to take the lock and a third claim recreate it within that gap. Alternative, inspect the taken copy again and rename it back when it is no longer stale.
4. Ambiguous folder name. Chosen, more than one `--repo` match counts as no match. The folder is removed and no `gh` call is made. Alternative, label and comment on every matching issue.
5. Source of `repo` and `issue` for a parsed `claim.json` with a bad `claimed_at`. Chosen, the folder name, as the issue says, so all unreadable locks take one path. Alternative, trust the file's `repo`, `issue` and `run_id`, which would also allow an `expired` event.
6. `lock` on readable entries. Chosen, every entry carries `lock`, so one existing `deepEqual` changes. Alternative, only unreadable entries carry it.
7. Unmatched folder removal. Chosen per the issue, it is removed without any label change. A hand run with fewer `--repo` values can therefore free another repo's issue while `factory-running` stays on it. Alternative, keep unmatched folders and list them only.
8. The stderr line `ignoring unreadable lock`. Chosen, dropped. A young unreadable lock is left alone without output. Alternative, keep it for young ones.
