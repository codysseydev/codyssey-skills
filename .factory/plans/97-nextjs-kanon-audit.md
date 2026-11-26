# Plan for #97, nextjs-kanon-audit: the canon-first audit of Next.js changes

Issue codysseydev/codyssey-skills#97. Base origin/main 99bd2e6. Branch `factory/97`. Kind: feature.

## Goal

Add `kanon/nextjs-kanon-audit/SKILL.md`. It audits a branch, PR or diff of a Next.js app against the rule files of `kanon/nextjs-kanon/references/`, one subagent per applicable rule file, with a pack rule id and a severity from the rule's keyword on every finding. It ignores the host project's conventions on purpose, judges only lines the diff adds or changes, and runs no command beyond the read-only `git` and `gh` calls that find the diff. The README lists it next to `nextjs-kanon`. No rule file changes.

## Inputs read

- Issue #97, with the owner decisions of 2026-11-23 (read only; diff scope for every rule; no "Not migrated" handling).
- `kanon/laravel-kanon-audit/SKILL.md`: framing, severity section, scope step, auditor contract, synthesis, report format, notes.
- `codysseydev/codyssey-frontend` at `abdfd9f2`, `.claude/skills/codyssey-frontend-reviewer/SKILL.md`, read with `git show`: scope commands with per-file hunks, routing by each rule file's `paths:` globs, the unreviewed-file line, the reviewer contract, the report format.
- `kanon/nextjs-kanon/SKILL.md`: the fixed stack (Cache Components off, React Compiler on, Vite+), the add-on and overlay detection table, the clash list, the Companions line.
- `kanon/nextjs-kanon/references/`: the `paths:` frontmatter of all 18 rule files, every "What is NOT a violation" section, design-principles' "Considered and not proposed" list, and `index.md` (entry format with `Condition:`, `Check:` and `Tags:` lines, the id map, the guard-test rows).
- `README.md` (`kanon/` section, Install section) and `playbooks/scripts/install.mjs` (`KANON_SKILLS = ['standards-discovery']`).
- Plans 88, 95 and 96 with their owner decisions. Plan 88 settled that `install.mjs` does not change for #88.
- Vault note `Ideas/Software Factory Pipeline.md`, section "React / Next.js pack", paragraph "Audit".

## Prototype results

Run on 2026-11-26 in scratch git repos outside every repo, with a routing script and an entry parser over the rule files at 99bd2e6. Nothing from them is committed. The PR lists the commands and outputs.

1. **Rule entries.** 324 entries in the 18 files; the id map has 325 rows because CF-020 stays reserved.
   - Bold closing keyword: 232 SHOULD, 76 MUST, 3 MAY, 1 MUST NOT.
   - 13 entries split their keyword:
     - "**MUST** for X; **SHOULD** for Y": SENTRY-008, DATA-006, DATA-009, DATA-049, DATA-059, DATA-065, UI-027, UI-033.
     - A keyword after one sentence and another after a later one: DATA-003, DATA-028, DATA-039.
     - ACCESS-011: "SHOULD; MUST NOT for `'unsafe-eval'` in the enforced policy; MUST for the other two guarded parts".
   - Keywords in plain prose: DATA-067 ("Code MUST be correct without the compiler too" inside a SHOULD rule), DESIGN-004 ("becomes MUST once a lint rule ... is turned on"), and MAY as a permission in ACCESS-011 and MUTATION-001.
   - 8 `Condition:` lines. DATA-001, DATA-003, DATA-005, DATA-006 and DATA-007 assume Cache Components is off for the whole rule. DATA-065 assumes it for the `Suspense` half only, STRUCT-029 for its `dynamic` and `revalidate` sentence only. DATA-067 assumes the React Compiler is on.
   - 59 `Check:` lines, 21 `Tags:` lines.
   - Carve-outs come in three forms: a "What is NOT a violation" section (six core files), the "**Considered and not proposed.**" list in `design-principles.md`, and inline "Not a violation:" sentences (the entry at `data-and-rendering.md:432`, TYPES-028). Add-ons and the overlay have none. No file has lane notes.
   - The clash list's keywords match the files: DATA-019 MUST, DATA-070 MUST, DATA-065 MUST and SHOULD, DATA-067 SHOULD, UI-053 SHOULD.
2. **Glob semantics.** 57 path cases through four matchers: Node `path.matchesGlob`, picomatch 4.0.7 with and without `dot: true`, and git pathspecs `:(top,glob)<glob>`.
   - Git pathspecs equal picomatch with `dot: true` on every case. `git diff --name-only` and `git ls-files --others` take the same pathspecs.
   - Node and default picomatch agree with each other and differ only on dot folders: `**` does not enter `.storybook/`, `src/.hidden/` or `app/.well-known/`, so `.storybook/preview.tsx` loses ui-a11y-seo and `app/.well-known/x.ts` is unreviewed.
   - `**/*.tsx` matches the root file `page.tsx`, and `**/tests/**` matches root `tests/a.test.ts`, in all four.
   - `app/**` is anchored at the root. `src/app/page.tsx` reaches structure, types-and-tests, ui-a11y-seo and design-principles through `src/**` and `**/*.tsx`, and misses data-and-rendering and access-and-security.
   - `codyssey-frontend-reviewer` states no glob semantics; the model matches by reading. How Claude Code matches rule `paths:` was not checked.
   - Unreviewed with the core files only: `proxy.ts`, `middleware.ts`, `postcss.config.mjs`, `README.md`, and the add-on and overlay files (`instrumentation.ts`, `sentry.*.config.ts`, `stryker.config.*`, `open-next.config.ts`, `wrangler.jsonc`, `worker.js`). With the add-ons and overlay detected, only the first four stay unreviewed.
3. **Detection.**
   - `git show <head>:package.json` reads the dependencies at the audited head. `@stryker-mutator/core` is a dev dependency, so detection reads `dependencies`, `devDependencies` and `optionalDependencies`.
   - `@opennextjs/cloudflare` as a dev dependency alone turns the overlay on, and so does `wrangler.jsonc` alone (`git cat-file -e <head>:wrangler.jsonc`).
   - `git grep -lE 'plausible\.io/js' <head> -- src app` prints the match with exit 0, exits 1 on none, and accepts a missing `app/`. The grep that `SKILL.md` names, `grep -rlE ... src app`, prints the match but exits 2 when `app/` is missing, so its result has to be read from the output.
4. **Dry-run routing.** The plant below routes as planned in both runs: the add-on file applies in run A and not in run B, and `worker.js` reaches only the overlay.

## SKILL.md, section by section

The file follows `laravel-kanon-audit`'s order and voice. Headings as listed.

### 1. Frontmatter and framing

```yaml
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
```

`# Next.js Kanon audit`, then the framing paragraph from `laravel-kanon-audit` with the Next.js names:

- The rules are the `references/` folder of the `nextjs-kanon` skill next to this one (`.claude/skills/nextjs-kanon/references/` in a project install, `~/.claude/skills/nextjs-kanon/references/` in a global install).
- The host project's CLAUDE.md, AGENTS.md, `.ai/rules/`, docs and sibling files are not rule sources and not excuses; a conflict between them and the canon is a finding.
- The report header says so, so nobody mistakes the report for a house-style review.
- It is distinct from `/code-review` (bugs) and from a project's own standards reviewer, which defers to the project's rules.

### 2. Severity comes from the rule's keyword

The Laravel section, plus the split-keyword handling (see "Severity mapping" below).

### 3. Workflow, step 1: scope

```bash
git merge-base HEAD origin/main        # try origin/main, then main, then master
git diff --name-only --diff-filter=d <base>...HEAD
git status --porcelain
```

- A dirty tree is included: `git diff --name-only --diff-filter=d <base>` lists committed and working-tree changes together, and `git ls-files --others --exclude-standard` adds untracked files. Otherwise the header says they were left out.
- Hunks per file: `git diff <base>...HEAD -- <file>`, or `git diff <base> -- <file>` with the working tree. An untracked file is all added lines: `git diff --no-index /dev/null <file>` (exit 1 when it prints a diff).
- A named PR: `gh pr view <n> --json baseRefOid,headRefOid,body` and `gh pr diff <n>`. What happens when the PR is not checked out is Q3.
- A named base replaces `<base>`.
- Ignored: `node_modules/`, `.next/`, `.open-next/`, `.wrangler/`, `.claude/worktrees/`, and generated files (`next-env.d.ts`, `*.tsbuildinfo`, and any file whose first lines say it is generated).
- Deleted files have no added lines and are not routed; renamed files route by their new path.
- An empty diff, after the ignores, stops the audit with one line.

### 4. Step 2: which rule files apply

The seven core files always apply. The add-ons and overlay come from the detection table in `nextjs-kanon`'s `SKILL.md`, checked at the audited head:

| Rule file | Applies when |
|---|---|
| each package add-on | its package is in `dependencies`, `devDependencies` or `optionalDependencies` of `git show <head>:package.json` |
| `add-ons/turnstile.md` | `git grep -lE 'challenges\.cloudflare\.com/turnstile' <head> -- src app` prints a file (Q1) |
| `add-ons/plausible.md` | `git grep -lE 'plausible\.io/js' <head> -- src app` prints a file (Q1) |
| `overlays/cloudflare.md` | `@opennextjs/cloudflare` is a dependency, or `git cat-file -e <head>:wrangler.jsonc` succeeds |

`add-ons/untrusted-content.md`'s "another HTML sanitizer" is Q6. `<head>` is `HEAD` on a clean tree. With uncommitted changes included, package.json and `wrangler.jsonc` are read from the working tree, and `git grep` runs without `<head>` and with `--untracked`. The header names each add-on that applied and why the overlay applied.

The orchestrator also reads `next.config.*` once for the two stack facts the `Condition:` lines need: `cacheComponents` (off unless set to `true`) and `reactCompiler` (on only when set). It passes both to every auditor and prints them in the header.

### 5. Step 3: routing

- Each changed file goes to every applicable rule file whose `paths:` globs match it.
- The orchestrator matches with git pathspecs, one call per applicable rule file, the globs copied from its frontmatter:

  ```bash
  git diff --name-only --diff-filter=d <base>...HEAD -- ':(top,glob)src/**' ':(top,glob)app/**'
  git ls-files --others --exclude-standard -- ':(top,glob)src/**' ':(top,glob)app/**'
  ```

  With uncommitted changes in scope, the first call uses the two-dot form, `git diff --name-only --diff-filter=d <base> -- <pathspecs>`, so a tracked file with uncommitted edits is routed too. Every call also carries the step 1 ignores as `':(exclude)<path>'` pathspecs, for example `':(exclude).next/**'`.

  This is a read-only git call, it matches as the prototype measured (`*` stays in one folder, `**/` matches zero or more folders including dot folders, every glob starts at the repo root), and no glob is matched by eye.
- A changed file that no applicable rule file matches is listed under "Unreviewed" in the header.

### 6. Step 4: fan out

- One `general-purpose` subagent per applicable rule file with at least one routed file, all spawned in one message (up to 18). The model is Q4.
- Each prompt holds, in this order:
  1. the auditor contract, verbatim;
  2. the stack facts;
  3. the clash list table from `nextjs-kanon`'s `SKILL.md`, verbatim;
  4. the full text of its rule file, read by the orchestrator and inlined, frontmatter included;
  5. its routed files, each with its diff hunks.
- `pnpm-lock.yaml` is routed to the tooling auditor by name, with a one-line summary of the hunks instead of the hunks themselves, because a lockfile diff can run to thousands of lines.

### 7. Step 5: auditor contract (verbatim, fenced)

The draft is in "Auditor contract draft" below.

### 8. Read only

A short section: apart from the read-only `git` and `gh` calls that find the diff, route it and detect the add-ons, the audit and its auditors run no command (no tests, no lint, no guard test, no build) and edit no file. Owner decision 2026-11-23. Fixes are applied only when the user asks, following `nextjs-kanon`.

### 9. Step 6: synthesize and report

- Collect every finding. Deduplicate: when two auditors flag one line, keep the finding whose rule text names what the line does wrong; do not merge different ids into one finding.
- Drop any finding whose id is not in the rule files inlined for this run.
- No confidence filter. A doubtful finding stays, marked "(verify)" with one line on the doubt.
- Order by severity, group by file.
- Post to a PR only when the user asks: write the report to a file and run `gh pr comment <n> --body-file <file>`.

```
## Next.js Kanon audit - <base>...HEAD (<n> files)

Canon-only review: the project's own conventions and the vendored skills the clash list overrides were deliberately ignored.

- Rule files: 7 core; add-ons: <file (package or script found)> | none; overlay: Cloudflare (<what was found>) | none
- Scope: committed changes | committed, uncommitted and untracked changes
- Stack: Cache Components <off|on>, React Compiler <on|off>. Not applied because a condition does not hold: <ids> | none
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

### 10. Diff scope for every rule

A short section: the audit judges only lines the diff adds or changes, for every rule, and has no per-rule "Not migrated" handling; the pack's rules carry no such notes (owner decision 2026-11-23). The one exception is the contract's: a behaviour change with no test is the types-and-tests auditor's finding.

### Notes

- Pairs: `/code-review` for bugs, the project's own reviewer for house style, this skill for the canon.
- The rule files belong to `nextjs-kanon`. A rule the audit finds unclear is reported to the owner, never reworded in a finding.

## Auditor contract draft

```
You are auditing code changes against ONE rule file of the Next.js Kanon, a fixed
doctrine for the frontend of a product with its own API. The full text of your rule
file follows this brief; it is the ONLY rule source. The host project's conventions,
CLAUDE.md, AGENTS.md, .ai/rules/ and sibling files are irrelevant: a project convention
that contradicts a rule does not excuse a finding.

Before your rule file you get the stack facts (Cache Components on or off, React
Compiler on or off) and the clash list. After it you get your routed files with their
diff hunks.

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
  condition names, and list its id under "Not applied (condition)".
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

The `Condition:` bullet follows the recommended answer to Q2 and changes with it.

## `Condition:` lines and stack facts

- The orchestrator reads `next.config.*` at the audited head once. No rule id covers the stack settings themselves, so a repo with `cacheComponents: true` gets no finding for that line ("no rule, no finding"). It gets a header line instead. Plan 95 found that `create-next-app` 16.4 writes `cacheComponents: true`, so this case is real.
- Each auditor gets the two facts and applies the `Condition:` bullet of the contract. Partial conditions follow their own wording: DATA-065's condition covers its `Suspense` half, so a `loading.tsx` file is still a MUST finding; STRUCT-029's covers its `dynamic` and `revalidate` sentence only.
- Q2 asks how a condition that does not hold is treated.

## The clash list

- Every auditor gets the clash list table verbatim. All five rows are DATA or UI rules, but clause entries in the add-ons build on them (RADIX-002 on DATA-019), and the table is short.
- The pack rule wins. A vendored rule the table overrides is not a defence (a comment citing it does not lower a SHOULD to low, which matters for DATA-067) and not a finding (code that skips `bundle-dynamic-imports` is clean).
- The table's "How the pack reads it" column restates the keyword in the rule file. The rule file's bold keyword sets severity; the prototype found no row where they differ.

## Severity mapping

| Keyword in the entry | Severity |
|---|---|
| **MUST**, **MUST NOT** | high |
| **SHOULD**, **SHOULD NOT**, no written justification | med |
| **SHOULD**, **SHOULD NOT**, justification quoted from a code comment at the line or the PR description | low |
| **MAY** | low |
| "**MUST** for X; **SHOULD** for Y" (8 entries) | high for a line that breaks X, med or low for Y |
| "... **MUST.** ... (**SHOULD**)" (DATA-003, DATA-028, DATA-039) | each bold keyword covers the sentences before it, back to the previous keyword or the title |
| ACCESS-011 | high for `'unsafe-eval'` in the enforced policy, for `img-src` and for `upgrade-insecure-requests`; med or low for the rest |
| Keyword in plain prose (DATA-067's "MUST be correct without the compiler", DESIGN-004's "becomes MUST once") | none; the bold keyword stands |
| Part unclear | the lower of the two, marked "(verify)" |

On a branch with no PR, only code comments count as a written justification. In PR mode the orchestrator passes the PR body (`gh pr view <n> --json body`) to every auditor.

## Dry run

A scratch Next.js repo outside every repo; nothing is committed anywhere. `next.config.ts` sets `cacheComponents: false` and `reactCompiler: true`. `wrangler.jsonc` and `worker.js` exist, and `@opennextjs/cloudflare` is not a dependency, so the overlay is detected through `wrangler.jsonc` alone. `kanon/nextjs-kanon` and `kanon/nextjs-kanon-audit` are copied into the scratch repo's `.claude/skills/` and listed in `.git/info/exclude`, so they stay out of the diff.

Each planted rule has no `Condition:` line, no split keyword and no carve-out that covers it.

| Plant | File | Pack id | Keyword | Expected |
|---|---|---|---|---|
| A `'use server'` module | `app/orders/actions.ts` | DATA-070 (core) | MUST | high |
| `export const runtime = 'edge'` | `app/orders/page.tsx` | STRUCT-019 (core) | SHOULD | med |
| `import { XMarkIcon } from '@heroicons/react/20/solid'` | `src/features/orders/components/OrderClose.tsx` | HEROICONS-001 (add-on, whole rule) | SHOULD | med |
| `export class Counter {}` | `worker.js` | CF-001 (overlay) | MUST | high |

One repo state cannot hold the same add-on rule with its package both installed and removed, so the dry run is two runs on otherwise identical repos:

- **Run A:** `@heroicons/react` is in `dependencies` on the base and the branch. The report must cite DATA-070 high, STRUCT-019 med, HEROICONS-001 med and CF-001 high.
- **Run B:** the same plant on a base without `@heroicons/react`, so `package.json` is not in the diff. `add-ons/heroicons.md` does not apply, and the report must not cite HEROICONS-001. The other three findings still appear.

Other findings may appear (for example a types-and-tests finding for a behaviour change with no test). The criterion is that the four planted ids appear in run A with these severities and HEROICONS-001 does not appear in run B. Both reports go into the PR. Heroicons is a package add-on, so the run tests package detection; the grep-detected add-ons are covered by the detection step's prototype only.

## README and other doc changes

- `README.md`, the folder table row: "the skeleton of a Next.js Kanon (`nextjs-kanon`)" becomes "a Next.js Kanon (`nextjs-kanon`) and its audit (`nextjs-kanon-audit`)".
- `README.md`, the `nextjs-kanon` bullet: drop "The rule files are stubs for now: #89 to #96 fill them, and the audit, `nextjs-kanon-audit`, comes in #97."
- `README.md`, a new bullet after it: `nextjs-kanon-audit` checks a branch or diff against the same rule files, routes each changed file by the files' `paths:` globs, runs one subagent per rule file, takes each finding's severity from the rule's keyword, and cites the rule's id on every finding. It is read-only.
- `README.md`, next to "Install `laravel-kanon` and `laravel-kanon-audit` together": "Install `nextjs-kanon` and `nextjs-kanon-audit` together; the audit reads the rulebook's `references/` folder." The Install section adds the same pair.
- `kanon/nextjs-kanon/SKILL.md`, Companions: drop "It is not built yet; #97 builds it." This file is not a rule file. Q7 asks whether these three stale lines are fixed here.
- `install.mjs`: no change unless Q5 says otherwise.

## Readings

These follow from the issue and the inputs. The PR lists them so the owner can change any of them.

1. **Routing by git pathspec.** The issue does not say how globs are matched. Git pathspecs are read-only, exact, and match dot folders; the model reading globs by eye is neither. The SKILL.md states the semantics in words as well.
2. **Detection at the audited head.** A PR may remove a package, and the acceptance run B depends on reading the head, not the base.
3. **Dependencies.** `dependencies`, `devDependencies` and `optionalDependencies` count; `peerDependencies` alone does not.
4. **Ignored and generated files.** The list in step 1 of the SKILL.md. `pnpm-lock.yaml` stays routed (the tooling file names it) with its hunks summarized.
5. **Clash list to every auditor**, not only the DATA and UI auditors.
6. **Justification sources.** Code comments at the line, and the PR body in PR mode. Commit messages do not count, as in `laravel-kanon-audit`.
7. **Severity of keywords in plain prose.** The bold keyword stands (DATA-067, DESIGN-004).
8. **`Check:` lines** do not change severity. Step 6 of the issue takes severity from the keyword alone.
9. **Lane notes.** The issue's contract mentions them; no pack file has one, so the contract names the three carve-out forms instead.

## Verification

From the worktree root at the head commit, on a clean tree:

1. Every section of steps 1 to 9 is in `kanon/nextjs-kanon-audit/SKILL.md`, and the contract is one fenced block: `grep -nE '^#{2,3} ' kanon/nextjs-kanon-audit/SKILL.md` and a count of the fences around the contract.
2. The dry run above, both runs, with both reports pasted into the PR.
3. Every id in both reports exists in the id map:

   ```bash
   grep -ohE '\b[A-Z]+-[0-9]{3}\b' report-a.md report-b.md | sort -u | while read id; do
     grep -qE "^\| $id \|" kanon/nextjs-kanon/references/index.md || echo "missing $id"
   done
   ```

   prints nothing.
4. `grep -rniE 'codyssey' kanon/nextjs-kanon-audit | grep -vE 'https://codyssey\.dev/|codysseydev/|codyssey-frontend-reviewer'` prints nothing.
5. `codyssey-frontend` is unchanged: its `HEAD` and its `git status --porcelain` output are the same before and after the build.
6. No em dash (U+2014) in the new or changed files: `grep -n "$(printf '\342\200\224')" kanon/nextjs-kanon-audit/SKILL.md README.md kanon/nextjs-kanon/SKILL.md` prints nothing.
7. The 12 checks in `.factory/recipe.yml`. None reads the new file; `install-tests` covers Q5 (b) if chosen.

## Out of scope

- Any rule file, the id map, and the clash list's content.
- `kanon-pr-audit` and the other catalog skills (#44 onward), the catalog conversion (#33 to #43), and the `.ai/kanon.yml` mode switch that `kanon-pr-audit` reads.
- The template repository, its guard test (stage 2), `bootstrap --frontend nextjs` (stage 3), and a `/preflight` that runs this audit.
- Any change to `codysseydev/codyssey-frontend`, `codyssey-frontend-reviewer` included.

## Open questions

- **Q1. How does the audit run the Turnstile and Plausible detection?**
  - Context: step 3 says "the grep `SKILL.md` names", step 7 allows no command beyond read-only `git` and `gh`.
  - (a) **Recommended.** `git grep -lE '<pattern>' <head> -- src app`: read-only git, same answer on tracked files, and it accepts a missing `app/`.
  - (b) The agent's own search tool on the working tree.
  - (c) The `grep -rlE` as named, as the one exception to step 7.
- **Q2. What does the audit do with a rule whose `Condition:` does not hold in the audited repo?**
  - (a) **Recommended.** It reports nothing under the rule or the conditioned part, and the header lists the ids as not applied, with the setting found.
  - (b) It applies the rule at its stated severity.
  - (c) It applies the rule and marks each finding "(verify)".
- **Q3. What does the audit do when the named PR is not the checked-out commit?**
  - (a) **Recommended.** It stops and asks the user to run `gh pr checkout <n>`, since detection and auditors read files at the head.
  - (b) It audits from `gh pr diff` hunks and reads whole files at the PR head through `gh api`.
- **Q4. Which model runs the auditors?**
  - (a) **Recommended.** The session's model (no `model` on the Agent call), as `laravel-kanon-audit` does.
  - (b) `sonnet` for every auditor.
  - (c) `opus` for every auditor.
- **Q5. How is the audit installed?**
  - (a) **Recommended.** By hand, next to `nextjs-kanon`, as the Laravel pair is. `install.mjs` does not change.
  - (b) `install.mjs` adds both `nextjs-kanon` and `nextjs-kanon-audit` to `KANON_SKILLS`, with install tests. Adding the audit alone would install it without the `references/` folder it reads.
- **Q6. Which packages count as "another HTML sanitizer" for `add-ons/untrusted-content.md`?**
  - (a) **Recommended.** A closed list in the audit: `react-markdown`, `rehype-sanitize`, `dompurify`, `isomorphic-dompurify`, `sanitize-html`; the header names the package found.
  - (b) Only the two packages `nextjs-kanon`'s table names.
  - (c) Any dependency the orchestrator judges to be an HTML sanitizer, named in the header.
- **Q7. Does the build PR also fix the stale lines about #97?**
  - Context: README's "skeleton" row and "stubs for now ... comes in #97" sentence, and the Companions line in `nextjs-kanon/SKILL.md`.
  - (a) **Recommended.** Yes, all three.
  - (b) The README lines only.
  - (c) None; a follow-up fixes them.

## Inputs that disagree

None changes a rule. The PR lists them for the owner.

- The dry-run criterion says "a branch" and "the report". One repo state cannot hold an add-on package both installed and removed, so the plan meets it with two runs and two reports (see "Dry run").

- The vault "Audit" paragraph names "the 'Not migrated' handling"; the owner decision of 2026-11-23 in the issue drops it. The issue wins.
- Step 3 names a `grep` for Turnstile and Plausible; step 7 allows only read-only `git` and `gh` (Q1).
- `create-next-app` 16.4 writes `cacheComponents: true`; the fixed stack has it off, and no rule id covers the setting, so the audit can only note it in the header (Q2).
- The issue's contract says "its lane notes"; no pack file has lane notes.
- `proxy.ts`, `middleware.ts` and `postcss.config.mjs` match no rule file's globs, so the audit lists them as unreviewed. `src/app/` misses the `app/**` globs of data-and-rendering and access-and-security. Changing the globs is a rule-file change and out of scope here.
- DATA-067 holds a plain-prose "MUST" inside a SHOULD rule, and DESIGN-004 keeps a "becomes MUST once" clause that plan 95 dropped from C6 (TOOLING-006). The audit uses the bold keyword for both.
- The `grep -rlE ... src app` that `nextjs-kanon`'s table names exits 2 when `app/` is missing even when it prints a match.
