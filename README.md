# Codyssey skills

Reusable Claude Code skills for building Laravel applications that last. None of them
is tied to one project: copy a folder into your own Laravel app and use it.

Two folders, two different jobs:

| Folder | What it is | Use it on |
|---|---|---|
| `kanon/` | A fixed Laravel doctrine (`laravel-kanon`) and the audit that checks code against it (`laravel-kanon-audit`) | Any Laravel project of your own |
| `general/` | Procedures that work in any Laravel project: a standards review against the project's own conventions, manual API testing with curl, and a pre-release staging smoke test | Any Laravel project, including ones with established team standards |

## kanon/

- `laravel-kanon`: the rulebook, loaded before writing code. Rules use MUST, SHOULD and
  MAY (RFC 2119), split into 10 reference files by what you are writing. It overrides the
  host project's conventions on purpose, so do not point it at a codebase with
  established team standards.
- `laravel-kanon-audit`: the audit, run after writing. It checks a branch or diff
  against the same reference files, one subagent per rule family, and takes each
  finding's severity from the rule's keyword.

Install both together. The audit reads the rulebook's `references/` folder, so the two
folders must sit next to each other.

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

## Install

Copy a skill folder into `.claude/skills/` in your project, or into `~/.claude/skills/`
to use it in every project. Install `laravel-kanon` and `laravel-kanon-audit`
side by side.

## License

MIT. See `LICENSE`.
