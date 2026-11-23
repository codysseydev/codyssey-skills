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
| `models` | Which models may read it? | A list of model ids or prefixes, or `any` | A run whose model matches no entry stops. An entry matches the model id itself or a prefix that ends at a hyphen: `claude` and `claude-opus` match `claude-opus-5-5`, `claude-o` does not. |
| `code_leaves_machine` | May code leave the machine? | `no`, `model-provider`, `yes` | `no` stops every step, because a hosted model receives each file it reads. `model-provider` allows that and no other destination. |
| `cloud_sessions` | May sessions run on a provider's machine? | `yes`, `no` | Blocks no step yet. |
| `commit_ai_files` | May `.ai/`, `.factory/` and `CLAUDE.md` be committed to the repo? | `yes`, `no` | `no` stops a factory run, because the factory needs `.factory/playbook.md` on origin/main. |
| `retention` | How long may anything be kept? | `none`, `<N>d` (for example `30d`), `end-of-engagement` | Blocks no step yet. |

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
