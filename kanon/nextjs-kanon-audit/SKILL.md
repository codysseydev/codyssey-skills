---
name: nextjs-kanon-audit
description: >-
  The Next.js Kanon audit: checks a branch, PR or diff of a Next.js App Router app
  against the nextjs-kanon rule files, one auditor per rule file, every finding citing a
  pack rule id with its severity taken from the rule's MUST, SHOULD or MAY. It
  deliberately IGNORES the host project's own conventions and the advice of vendored
  skills the clash list overrides. Use when the user invokes /nextjs-kanon-audit or asks
  to audit Next.js changes "against the canon", "against kanon" or "the kanon audit".
  Do NOT use for correctness bugs or security review (/code-review), and do NOT use when
  the user wants a review grounded in the project's own rules (that is the project's own
  reviewer). It is read-only. The rulebook for WRITING code by these rules is
  nextjs-kanon.
---

# Next.js Kanon audit

Audit code changes against the Next.js Kanon, the fixed frontend doctrine in the
`references/` folder of the `nextjs-kanon` skill. That skill sits next to this one:
`.claude/skills/nextjs-kanon/references/` in a project install,
`~/.claude/skills/nextjs-kanon/references/` in a global install. The audit is
project-agnostic on purpose: the host project's CLAUDE.md, AGENTS.md, `.ai/rules/`, docs
and sibling-file conventions are NOT rule sources and NOT excuses. If the project's
convention conflicts with the canon, the canon wins and the conflict is a finding. Say
this plainly in the report header so nobody mistakes it for a house-style review.

This is distinct from `/code-review` (bugs) and from a project's own standards reviewer,
which defers to the project's rules. It surfaces every genuine, rule-cited canon
violation, including SHOULD-level structural ones, because those are exactly what a
bug-focused review filters out: the code works, the tests pass, and only someone who has
internalized the rule would flag it.

## Severity comes from the rule's keyword

- **MUST / MUST NOT** broken -> **high**. The change is not canon-compliant until fixed.
- **SHOULD / SHOULD NOT** deviated without a written justification -> **med**. A
  deviation with a concrete written justification drops to **low**, with the
  justification quoted. A justification counts only in a code comment at the line or,
  when a PR is audited, in the PR description. Commit messages do not count.
- **MAY** -> **low**, advisory.

Most entries close with one bold keyword that covers the whole entry. Some give parts
their own keywords:

| How the entry is written | Severity of a finding |
|---|---|
| "**MUST** for X; **SHOULD** for Y" (for example DATA-065) | the keyword of the part the line breaks: high for X, med or low for Y |
| A bold keyword after one sentence and another after a later one (for example DATA-003) | each bold keyword covers the sentences before it, back to the previous keyword or the title |
| One keyword per named part (ACCESS-011) | the keyword of the part the line breaks |
| The auditor cannot tell which part the line breaks | the lower of the two, marked "(verify)" |

Only bold keywords set severity. A keyword in plain prose ("Code MUST be correct without
the compiler too" inside DATA-067, "becomes MUST once" in DESIGN-004) does not change it.
A `Check:` line does not change severity either; it names what to look for, and the
audit does not run it. The clash list's "How the pack reads it" column restates the rule
file's keyword; the bold keyword in the rule file decides.

## Workflow

### 1. Determine the review scope

Default to the current branch against its base:

```bash
git merge-base HEAD origin/main        # try origin/main, then main, then master
git diff --name-only --diff-filter=d <base>...HEAD -- <ignores>
git status --porcelain
```

- **A named base** replaces `<base>`.
- **A named PR.** Run `gh pr view <n> --json headRefOid,baseRefName,body`. If
  `git rev-parse HEAD` is not `headRefOid`, stop and tell the user: "PR #<n> is not
  checked out. Run `gh pr checkout <n>` first." Add-on detection and every auditor read
  files at the audited head, so the audit never runs against another checkout. The base
  is `git merge-base HEAD origin/<baseRefName>`; if that ref is missing, stop and tell the
  user to run `git fetch origin <baseRefName>`. Keep the PR body: every auditor gets it
  as a source of written justifications.
- **A dirty tree.** Include uncommitted and untracked changes by default:
  `git diff --name-only --diff-filter=d <base> -- <ignores>` (two dots) lists committed
  and working-tree changes together, and
  `git ls-files --others --exclude-standard -- <ignores>` adds untracked files, which it
  does not list. Leave them out only when a PR is named (they are not part of the PR) or
  the user asks, and say so in the header.
- **Ignored paths.** `<ignores>` stands for these exclude pathspecs, passed to every
  `git diff` and `git ls-files` call of this audit:

  ```
  ':(exclude,top,glob)node_modules/**' ':(exclude,top,glob).next/**'
  ':(exclude,top,glob).open-next/**' ':(exclude,top,glob).wrangler/**'
  ':(exclude,top,glob).claude/worktrees/**' ':(exclude,top,glob)next-env.d.ts'
  ':(exclude,top,glob)**/*.tsbuildinfo'
  ```

  Drop as well any file whose first lines say it is generated.
- **Deleted and renamed files.** A deleted file has no added lines and is not routed
  (`--diff-filter=d`). A renamed file routes by its new path.
- **Hunks per file.** `git diff <base>...HEAD -- <file>`, or `git diff <base> -- <file>`
  with uncommitted changes in scope. An untracked file is all added lines:
  `git diff --no-index /dev/null <file>`, which exits 1 when it prints a diff.
- **An empty diff**, after the ignores, stops the audit with one line: "Nothing to
  audit: <base>...HEAD changes no file outside the ignored paths."

### 2. Pick the rule files that apply

The seven core files always apply: `structure.md`, `data-and-rendering.md`,
`types-and-tests.md`, `ui-a11y-seo.md`, `design-principles.md`, `access-and-security.md`,
`tooling.md`. An add-on file or the overlay applies only when its detection matches the
repo at the audited head. These are the detections of `nextjs-kanon`'s `SKILL.md`, run as
read-only git calls:

| Rule file | Applies when |
|---|---|
| `add-ons/untrusted-content.md` | one of `react-markdown`, `rehype-sanitize`, `dompurify`, `isomorphic-dompurify`, `sanitize-html` is a dependency. This closed list is what "another HTML sanitizer" means. |
| `add-ons/syntax-highlighting.md` | `react-syntax-highlighter` is a dependency |
| `add-ons/sentry.md` | `@sentry/nextjs` is a dependency |
| `add-ons/turnstile.md` | `git grep -lE 'challenges\.cloudflare\.com/turnstile' <head> -- src app` prints a file |
| `add-ons/radix.md` | a `@radix-ui/*` package is a dependency |
| `add-ons/heroicons.md` | `@heroicons/react` is a dependency |
| `add-ons/plausible.md` | `git grep -lE 'plausible\.io/js' <head> -- src app` prints a file |
| `add-ons/axios.md` | `axios` is a dependency |
| `add-ons/cmdk.md` | `cmdk` is a dependency |
| `add-ons/mutation-testing.md` | `@stryker-mutator/core` is a dependency |
| `overlays/cloudflare.md` | `@opennextjs/cloudflare` is a dependency, or `git cat-file -e <head>:wrangler.jsonc` succeeds |

- **A dependency** is a key of `dependencies`, `devDependencies` or
  `optionalDependencies` in `git show <head>:package.json`. `peerDependencies` alone
  does not count.
- **`<head>`** is `HEAD`. With uncommitted changes in scope, read `package.json` and
  `next.config.*` from the working tree, test `wrangler.jsonc` with
  `git ls-files --cached --others --exclude-standard -- wrangler.jsonc` (it prints the
  path when the file exists), and run `git grep` with `--untracked` and without `<head>`.
- **`git grep` prints a file** on a match and exits 0; it exits 1 on none, and a missing
  `app/` folder is not an error.

Read the two stack facts the `- Condition:` lines need from `next.config.*` at the
audited head (`git ls-files -- 'next.config.*'` finds it, `git show <head>:<file>` reads
it, or the working-tree file when uncommitted changes are in scope):

- **Cache Components** is on only when `cacheComponents` is set to `true`; otherwise off.
- **React Compiler** is on only when `reactCompiler` is set (to `true` or an options
  object); otherwise off.

No rule id covers these settings themselves, so a repo with `cacheComponents: true` gets
no finding for that line, only the header line. Pass both facts to every auditor.

### 3. Route each changed file

Each changed file goes to every applicable rule file whose `paths:` globs match it. Match
with git pathspecs, one call per applicable rule file, the globs copied from its
frontmatter. For `design-principles.md`:

```bash
git diff --name-only --diff-filter=d <base>...HEAD -- ':(top,glob)src/**' ':(top,glob)app/**' <ignores>
git ls-files --others --exclude-standard -- ':(top,glob)src/**' ':(top,glob)app/**' <ignores>
```

With uncommitted changes in scope, the first call uses the two-dot form
(`git diff --name-only --diff-filter=d <base> -- <pathspecs>`), so a tracked file with
uncommitted edits is routed too; the second call runs only when untracked files are in
scope.

The pathspecs match the way the globs are meant: every glob starts at the repo root, `*`
stays inside one folder, and `**/` matches zero or more folders, dot folders included
(`**/*.tsx` matches the root file `page.tsx` and `.storybook/preview.tsx`; `app/**` does
not match `src/app/page.tsx`). No glob is matched by eye.

A changed file that no applicable rule file matches is listed under "Unreviewed" in the
header.

### 4. Fan out one auditor per rule file

Spawn one `general-purpose` subagent per applicable rule file with at least one routed
file, all in one message (up to 18 Agent calls). Set no `model` on the Agent call: the
auditors run on the session's model. Each prompt holds, in this order:

1. the auditor contract below, verbatim;
2. the stack facts (Cache Components on or off, React Compiler on or off);
3. the "Clash list" table from `nextjs-kanon`'s `SKILL.md`, verbatim;
4. the full text of its rule file from `nextjs-kanon/references/`, frontmatter included
   (read it yourself and inline it, so the auditor cites the actual rule, not a
   paraphrase);
5. when a PR is audited, the PR body;
6. its routed files, each with its diff hunks.

`pnpm-lock.yaml` goes to the `tooling.md` auditor by name, with a one-line summary of
its hunks (which packages were added, removed or moved to another version) instead of
the hunks themselves, because a lockfile diff can run to thousands of lines.

### 5. Auditor contract (give to every subagent verbatim)

```
You are auditing code changes against ONE rule file of the Next.js Kanon, a fixed
doctrine for the frontend of a product with its own API. The full text of your rule
file follows this brief; it is the ONLY rule source. The host project's conventions,
CLAUDE.md, AGENTS.md, .ai/rules/ and sibling files are irrelevant: a project convention
that contradicts a rule does not excuse a finding.

Before your rule file you get the stack facts (Cache Components on or off, React
Compiler on or off) and the clash list. After it you get, when a PR is audited, the PR
description, and then your routed files with their diff hunks.

Report ONLY genuine, concrete violations of the rules in your file. For each:
  `path:line` - <ID> <title> - the part of the rule broken, quoted with its keyword -
  one sentence on why the line breaks it - concrete suggested fix - severity (high | med | low)

Severity comes from the bold keyword of the part the line breaks:
- MUST or MUST NOT = high.
- SHOULD or SHOULD NOT = med. With a written justification in a code comment at the
  line or in the PR description = low, and quote the justification.
- MAY = low.
- One keyword at the end of an entry covers the whole entry. An entry that gives parts
  their own keywords ("**MUST** for the file; **SHOULD** for the `Suspense` half", or a
  bold keyword after one sentence and another after a later one) takes the keyword of
  the part the line breaks; quote that part. If you cannot tell which part, take the
  lower severity and mark the finding "(verify)".
- Only bold keywords set severity. A keyword in plain prose ("becomes MUST once ...")
  does not change it.
- A `Check:` line does not change severity. It tells you what to look for; you do not
  run it.

Rules of engagement:
- Cite a rule id on every finding: the id at the start of the entry, for example
  `DATA-012`. A sub-bullet of an entry cites the entry's id. No id, no finding.
- Report only lines the diff adds or changes, for every rule. Code the diff does not
  touch is out of scope, even in a touched file. Moving or reformatting a line without
  changing what it does is not changing it. One exception: a behaviour change that ships
  with no test is a finding for the types-and-tests auditor, though the missing test
  file is untouched.
- Follow every carve-out in your file: its "What is NOT a violation" section, any
  "Not a violation:" sentence inside an entry, and in design-principles.md the
  "Considered and not proposed" list. That list holds no rules: never cite it.
- An entry with a `- Condition:` line assumes a stack setting. If the stack facts show
  the condition does not hold, report nothing under that entry, or under the part the
  condition names, and list its id under "Not applied (condition)" with the setting
  found.
- The clash list: a pack rule wins over every vendored skill. A comment or PR text that
  cites a vendored rule the clash list overrides (for example Vercel `rerender-memo`
  against DATA-067) is not a justification and does not lower severity. Code that skips
  a vendored skill's advice is not a finding.
- If you cannot point to the exact rule and the exact line, do not report it. Do NOT
  drop a real violation because it is SHOULD-level or "only structural"; those are the
  point of this audit.
- Stay in your lane: violations of your rule file only. Not correctness bugs, not
  security holes no rule states, not formatting (Oxfmt owns it), not style no rule
  states.
- Consolidate: one rule broken the same way across many lines or files is ONE finding
  that cites the rule once and lists every place.
- You run no command and edit no file. You may read another file of the repo to
  understand a changed line.
- If your files are clean, say so in one line.
Return a concise list ordered high, med, low, then "Not applied (condition)", nothing
else.
```

### 6. Synthesize and report

- Collect every finding into one report. Deduplicate: when two auditors flag one line,
  keep the finding whose rule text names what the line does wrong. Do not merge
  different ids into one finding.
- Drop any finding whose id is not in the rule files inlined for this run.
- No confidence filter: if an auditor cited a real rule, the finding stays. A doubtful
  finding stays, marked "(verify)" with one line on the doubt.
- Order by severity, group by file.
- Collect every auditor's "Not applied (condition)" ids into the header, each with the
  setting found, for example "DATA-001 (cacheComponents: true)".

```
## Next.js Kanon audit - <base>...HEAD (<n> files)

Canon-only review: the project's own conventions and the vendored skills the clash list overrides were deliberately ignored.

- Rule files: 7 core; add-ons: <file (package or script found)> | none; overlay: Cloudflare (<what was found>) | none
- Scope: committed changes | committed, uncommitted and untracked changes
- Stack: Cache Components <off|on>, React Compiler <on|off>. Not applied because a condition does not hold: <id (setting found)> | none
- Unreviewed (no applicable rule file matches): <files> | none

### High (MUST violations)
- `path:line` - <ID> <title> - <part broken, quoted> - <why>. Fix: <fix>.

### Med (SHOULD deviations)
- `path:line` - <ID> <title> - <part broken, quoted> - <why>. Fix: <fix>.

### Low (advisory / justified deviations)
- `path:line` - <ID> <title> - <note>.

### Clean
<rule files with no findings>

**Verdict:** canon-compliant | N findings (X high / Y med / Z low)
```

Post the report to a PR only when the user asks: write it to a file and run
`gh pr comment <n> --body-file <file>` (requires the GitHub CLI, authenticated).

## Read only

Apart from the read-only `git` and `gh` calls that find the diff, route it and detect the
add-ons, the audit and its auditors run no command (no tests, no lint, no guard test, no
build) and edit no file. Posting the report with `gh pr comment` happens only when the
user asks. Fixes are applied only when the user asks, following `nextjs-kanon`.

## Diff scope for every rule

The audit judges only lines the diff adds or changes, for every rule. It has no per-rule
"Not migrated" handling; the pack's rules carry no such notes. The one exception is the
contract's: a behaviour change with no test is the types-and-tests auditor's finding.

## Notes

- Pairs: `/code-review` for bugs, the project's own reviewer for house style, this skill
  for the canon.
- The rule files belong to `nextjs-kanon`. A rule the audit finds unclear is reported to
  the owner, never reworded in a finding.
