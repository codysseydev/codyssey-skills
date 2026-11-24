# The policy record

One file per client, in the client's brain, never in the client's repo. Markdown with frontmatter, one key per field, then free prose. The check reads only the frontmatter. The prose says where the answers came from, for example quotes from the client's policy and the date a person confirmed them.

## Template

```markdown
---
ai_allowed:
tools:
models:
code_leaves_machine:
cloud_sessions:
commit_ai_files:
retention:
---

Source:
```

The empty template fails the check with every field missing. That list is what to fill in.

## Fields

| Key | Question | Allowed values | What it allows |
|---|---|---|---|
| `ai_allowed` | Is AI allowed on this codebase at all? | `yes`, `no` | `no` stops every step. |
| `tools` | Which AI tools may touch it? | A list of tool names (`claude-code`), or `any` | A run whose tool is not listed stops. |
| `models` | Which models may read it? | A list of model ids, `claude-*` style prefixes, or `any` | A run whose model matches no entry stops. See the table below. |
| `code_leaves_machine` | May code leave the machine? | `no`, `model-provider`, `yes` | `no` stops every step, because a hosted model receives each file it reads. `model-provider` allows that and no other destination. |
| `cloud_sessions` | May sessions run on a provider's machine? | `yes`, `no` | Blocks no step yet. |
| `commit_ai_files` | May `.ai/`, `.factory/` and `CLAUDE.md` be committed to the repo? | `yes`, `no` | `no` stops a factory run, because the factory needs `.factory/playbook.md` on origin/main. |
| `retention` | How long may anything be kept? | `none`, `<N>d` (for example `30d`), `end-of-engagement` | Blocks no step yet. |

What a `models` entry matches:

| Entry | Matches |
|---|---|
| `any` | Every model. |
| `claude-*`, `claude-opus-*` | An id that starts with `claude-` or `claude-opus-`. The `*` goes last and follows a hyphen. |
| `claude-opus-5-5` | `claude-opus-5-5` only, not `claude-opus-5-5-20261101`. |
| `claude-o*`, `*`, `claude*` | Not an allowed value, so the check stops on `models`. |

Any other entry is an exact id. A record that lists the bare entry `claude` matches no real model id, so it stops on `models`. Write `claude-*` instead.

A cloud session is a session whose checkout runs on a provider's machine, for example Claude Code on the web.

Rules for the values:

- Booleans take `yes`, `no`, `true` or `false`, in any case.
- A list is `[a, b]` or one `- item` line per entry under the key. A single bare value counts as a one-item list.
- A comment after a value (`ai_allowed: yes # ok`) is not allowed: the text after the colon is the whole value, so the check stops on it as not an allowed value. A comment on a line of its own is fine.
- A key that is absent or has no value is missing. A value outside the allowed set stops the check. A duplicate key or a line that is not `key: value` makes the record unreadable.
- Keys the check does not know are ignored. A misspelt key leaves the real field missing, so the check stops.

## Steps and fields

| Step | What it is | Blocked by |
|---|---|---|
| `read-code` | Reading client code on this machine. The default. | `ai_allowed`, `tools`, `models`, `code_leaves_machine` |
| `factory-run` | A factory run in a client repo. | Everything `read-code` checks, and `commit_ai_files` |

## Factory runs

A factory run finds the record through `~/.factory/ai-policy.json`, written by the owner and kept on that machine only:

```json
{"acme/shop": "/Users/me/brains/acme/ai-policy.md"}
```

A repo listed there is a client repo whatever its `.ai/kanon.yml` says. This covers a client whose overlay is kept out of git.

Rules for the registry:

- Keys are `owner/name`, matched without regard to case. Each part holds letters, digits, `.`, `_` and `-`, is not `.` or `..`, and the key does not end in `.git`. A key in any other form (a URL, `git@...`, a trailing slash, spaces) stops the check on `record`. Two keys that differ only in case stop it too. `--repo-name` follows the same rule, and a bad one is a usage error, exit 2.
- A record path is absolute, and `~` at its start expands to the home folder. A relative path stops the check on `record`.
- A registry path with no file at it counts as empty, and so does one under a folder that does not exist. A registry file that is there but cannot be read stops the check on `record`: bad JSON, an exact duplicate key, a dangling symlink at the file's own path or at a folder on its path, a folder in its place, or a folder on the path that cannot be entered.
- The mode is read from `.ai/kanon.yml` on origin/main, with the git environment variables (`GIT_DIR` and the rest) removed and `git replace` refs ignored. These stop the check on `mode`:
  - a `--repo` that is not the top level of its git repo;
  - two `mode:` lines, or an empty one (`mode:`, `mode: ""`);
  - a root entry that is `.ai` in another case, or an entry of `.ai/` that is `kanon.yml` or `kanon.yaml` in another case (`.AI`, `Kanon.yml`, `kanon.yaml`);
  - `.ai` that is not a folder (a symlink, a file, a gitlink), or `.ai/kanon.yml` that is not a regular file (a symlink, a folder, a gitlink);
  - a file the reader below does not accept.
- A missing `.ai/` or `.ai/kanon.yml` means canon-first. A mode of `100755` is a regular file.
- The scan of the repo's policy files in a factory run reads origin/main through git as well. It opens no file under `--repo`. It matches `.aiignore`, `.cursorignore`, `.github`, `docs`, README and CONTRIBUTING without regard to case and reports each entry under the name it has in the tree. A checkout whose README differs from origin/main does not change the warnings. The `--record` form scans the working tree.

The reader for `.ai/kanon.yml` is not a YAML parser. It accepts only this, after a byte order mark is removed. Each line is one of:

- Blank, or a comment (first non-space character `#`).
- `---` before the first content line. A later `---` or `...` is a second document and stops the check. So does a `%` directive.
- A root key line, `key:` or `key: value` at column 0. The key is `[A-Za-z0-9_-]+`, plain or in single or double quotes. The first content line must be one. A key that is `mode` in another case (`Mode`, `MODE`) stops the check.
- After a root key line, a line that starts with a space, or a `- ` item at column 0. These are skipped, so `rules:\n  mode: x` does not set the mode.
- Anything else stops the check: a tab at the start of a line, a flow mapping (`{mode: project-first}`), `? key`, `<<`, `*alias`, `&anchor`, an escaped quoted key, or any other column-0 line.

The `mode` value drops a trailing ` # comment` and its quotes. A value that is not `canon-first` or `project-first` stops the check. The overlay writer must emit `.ai/kanon.yml` inside this grammar.
