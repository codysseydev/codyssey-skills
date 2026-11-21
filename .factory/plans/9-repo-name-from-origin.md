# Plan: #9 write-playbook.py names the project from `origin`

## Goal

The starter `.factory/playbook.md` names the repo, not the folder it was written from. Run in a git worktree such as `<repo>/.claude/worktrees/factory-onboard`, the title and intro should say `<repo>`.

## Root cause

`starter()` in `factory/factory-onboard/scripts/write-playbook.py:171` sets `name = os.path.basename(os.path.abspath(repo))`. Lines 172 and 173 use `name` for the title and the intro. A worktree folder has its own name, so the basename is the folder name. Checked: `git -C <worktree> remote get-url origin` prints the main repo's `origin` URL, for a worktree inside the repo and outside it.

## Change

1. Add a module constant and a helper next to `git_ok` (line 206). `git_ok` returns only a bool, so the helper runs git itself:
   - `REMOTE_RE = re.compile(r"^(?:(?:https?|ssh|git)://[^/]+/|[\w.-]+@[\w.-]+:)(?:[^/]+/)+([^/]+?)/?$")`
   - `repo_name(repo)` runs `git remote get-url origin` with `cwd=repo`, matches the stripped stdout against `REMOTE_RE`, drops a trailing `.git` from the match, and returns it.
2. It returns `os.path.basename(os.path.abspath(repo))`, as today, when any of these holds: git is missing (`OSError`), the command exits nonzero (no repo, no `origin`), the URL does not match, or the name is empty after dropping `.git`.
3. `starter()` line 171 becomes `name = repo_name(repo)`. Title and intro keep sharing `name`.

What the rule yields (prototyped):

| `origin` | name |
|---|---|
| `https://github.com/owner/repo.git`, `https://github.com/owner/repo`, trailing `/` | `repo` |
| `git@github.com:owner/repo.git`, `ssh://git@github.com/owner/repo.git`, `ssh://git@host:22/owner/repo.git` | `repo` |
| `https://gitlab.com/group/sub/repo.git` | `repo` |
| local path `/tmp/foo/bar.git`, `file:///tmp/foo/bar.git` | folder name |
| empty, `https://github.com`, `git@github.com:repo.git`, `https://github.com/owner/.git` | folder name |

Local paths fall back on purpose. A clone of a worktree folder gets that folder's path as `origin`, so parsing paths would bring the bug back.

Docs: `factory/factory-onboard/SKILL.md:42`, after "a `# Factory project file: <repo>` title", add: "`<repo>` is the repo name from the `origin` URL, or the folder name when `origin` is missing or is not an `owner/repo` URL."

## Tests

In `factory/factory-onboard/tests/test_write_playbook.py`, give `make_repo` an optional `folder` argument that creates the repo at `<mkdtemp>/<folder>`. Add to `FreshTest`:

- `test_title_uses_origin_repo_name`: folder `worktree-name`, `git remote add origin https://github.com/acme/real-repo.git`. Assert the title is `# Factory project file: real-repo` and the intro has `Holds real-repo's specifics`. Then `git remote set-url origin git@github.com:acme/real-repo.git`, delete the playbook, rerun, same asserts.
- `test_title_falls_back_to_folder_name`: folder `worktree-name`, no remote: title is `worktree-name`. Then `git remote add origin /tmp/x/other.git`, delete the playbook, rerun: still `worktree-name`.

Unchanged and still passing: `FreshTest.test_with_recipe` (line 66 asserts the basename; its repo has no remote) and `BootstrapTest.test_creates_both_and_proves` (the fake pack and the real Laravel pack's `new-repo.py` add no remote, and the test does not assert the title).

## Gates

The four recipe checks, all exit 0 at `origin/main` 8c85764: `pick-up-tests`, `bootstrap-tests`, `event-model-tests`, `factory-onboard-tests`.

## Out of scope

- The fixed `codysseydev/codyssey-skills` in the intro (line 173). It names where the factory playbook lives, and the issue does not ask about it.
- Existing playbooks. The script never rewrites their text, so a title written from a worktree stays until a person edits it.
- `bootstrap.py`. It writes the playbook before any remote exists, so it keeps the slug.

## Risks

- `git -C` walks up to an enclosing repo. A folder that is not a repo root but sits inside one takes the enclosing repo's name. Callers pass a repo root, so this is not handled.
- A repo renamed on GitHub with a stale `origin` URL gets the old name.
