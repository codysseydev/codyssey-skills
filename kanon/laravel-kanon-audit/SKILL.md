---
name: laravel-kanon-audit
description: >-
  The Kanon audit: checks code against the Kanon, a fixed project-agnostic Laravel
  doctrine. Audits a branch, PR, or diff against the canon's MUST/MUST NOT/SHOULD
  rules (vertical slices, orchestrator pattern, module isolation, DI-over-facades,
  authorization gates, testing rules) while deliberately IGNORING the host project's
  own conventions. Use when the user invokes /laravel-kanon-audit or asks to review/audit
  Laravel changes "against the canon", "against kanon", "the kanon audit", or wants
  their long-term standards applied to any Laravel codebase regardless of that
  project's rules. Do NOT use for correctness/bug review, security audits, or
  performance hunts (/code-review), and do NOT use when the user wants the review
  grounded in the project's OWN conventions (that is laravel-standards-review). The
  rulebook for WRITING code by these rules is laravel-kanon.
---

# Kanon audit

Audit code changes against the Kanon, the fixed Laravel doctrine in the
`references/` folder of the `laravel-kanon` skill. That skill sits next to this one:
`.claude/skills/laravel-kanon/references/` in a project install,
`~/.claude/skills/laravel-kanon/references/` in a global install. The audit is project-agnostic on purpose:
the host project's CLAUDE.md, docs, and sibling-file conventions are NOT rule
sources and NOT excuses. If the project's convention conflicts with the canon, the
canon wins and the conflict is a finding. Say this plainly in the report header so
nobody mistakes it for a house-style review.

This is the opposite of `laravel-standards-review` (which defers to the project's
own rules; it lives in `general/` of the same repo, and this audit does not need it) and distinct from `/code-review` (bugs). It surfaces every genuine,
rule-cited canon violation, including low-severity structural ones, because those
are exactly what a bug-focused review filters out: the code works, the tests pass,
and only someone who has internalized the rule would flag it.

## Severity comes from the rule's keyword

- **MUST / MUST NOT** violated -> **high**. Non-negotiable; the PR is not
  canon-compliant until fixed.
- **SHOULD / SHOULD NOT** deviated without stated justification -> **med**. A
  deviation with a concrete written justification in code or PR description drops
  to low with the justification quoted.
- **MAY / "consider" guidance** -> **low**, advisory.

## Workflow

### 1. Determine the review scope

Default to the current branch versus its base:

```bash
git merge-base HEAD origin/main   # try origin/main, then main, then master
git diff --name-only <base>...HEAD
```

If the user names a PR (`gh pr diff <n> --name-only`) or another base, use that.
Check `git status --porcelain`: if the working tree is dirty, include uncommitted
changes in scope (`git diff --name-only <base>` lists committed and working-tree
changes together; add `git ls-files --others --exclude-standard` for new untracked
files, which it does not list) or state in the report header that they were excluded. Limit to PHP source plus what the
canon covers (`config/`, migrations, `bootstrap/`, route files, `composer.json`
for stack rules). Ignore vendor, node_modules, and generated files. If the diff is
empty or touches nothing the canon covers, say so and stop.

### 2. Fan out one auditor per rule family

Spawn every applicable auditor in parallel (single message, multiple Agent calls;
Filament only when the diff touches Filament code), each a
`general-purpose` subagent. Give each auditor:

- the changed-file list relevant to its family (route by the path/content
  heuristics below; when unsure, hand over the whole list, a clean file costs one
  read);
- the full verbatim text of its reference file from the `laravel-kanon` skill's
  `references/` folder (read it yourself and inline it in the prompt, so the
  auditor cites the actual rule, not a paraphrase);
- the auditor contract below.

| Auditor | Reference | Mostly covers |
|---|---|---|
| Architecture & slices | `architecture.md` | new feature folders, slice completeness/co-location, module layout, placement, naming |
| Orchestration & DI | `orchestration-di.md` | `*Controller`, `*Handler`, `*Job`, `*Listener`, console commands, services, middleware |
| Models & domain objects | `models-domain.md` | Eloquent models, enums, events, DTOs, exceptions, read models |
| Isolation | `isolation.md` | cross-module imports/FKs/writes, application-surface boundaries, guards |
| HTTP & serialization | `http-api.md` | route files, middleware, statuses, `*Resource`, webhooks |
| Authorization | `authorization.md` | ownership gates, principal-vs-input, abilities, Form Request `authorize()` |
| Integrations | `integrations.md` | gateways, connectors, vendor SDK usage, secrets |
| Persistence & providers | `persistence.md` | migrations, factories, `config/`, service providers |
| Filament | `filament.md` | Filament `*Resource`, pages, actions, widgets, panel policies/providers; spawn only when the diff touches Filament code |
| Testing | `testing.md` | `tests/`, plus flagging changed behavior that shipped with no test |

### 3. Auditor contract (give to every subagent verbatim)

```
You are auditing code changes against ONE family of a fixed Laravel doctrine (the
Kanon). The full text of your rule file follows this brief; it is the ONLY rule source. The
host project's own conventions, CLAUDE.md, and sibling files are irrelevant: a
project convention that contradicts a rule does not excuse a finding.

Report ONLY genuine, concrete violations of the included rules. For each:
  `path:line` - <rule, quoted with its MUST/SHOULD keyword> - one sentence on why
  it violates - concrete suggested fix - severity (high | med | low)

Severity: violated MUST/MUST NOT = high; SHOULD/SHOULD NOT deviation without
stated justification = med (with a quoted written justification = low); MAY-level
guidance = low.

Rules of engagement:
- Cite a specific rule for every finding. No rule, no finding.
- If you cannot point to the exact rule and the exact line, do not report it.
- Do NOT drop a real violation because it is low-severity or "only structural";
  those are the point of this review.
- Stay in your lane: doctrine violations only. Not correctness bugs, not style
  preferences no rule states, not pre-existing issues on lines this diff did not
  touch (except: a diff that changes behavior with no test IS in the testing
  auditor's lane even though the missing file is untouched).
- Consolidate repeated mechanical violations: when the same rule is broken the
  same way across many files or lines, report ONE finding citing the rule once
  and listing the affected files, not one finding per occurrence.
- Respect the reference file's own lane notes ("owned by X, do not re-audit"):
  a rule another family owns is not yours to flag.
- If your assigned files are clean, say so in one line.
Return a concise prioritized list, nothing else.
```

### 4. Synthesize

Collect all findings into one report. Deduplicate (one line may be flagged by two
families; keep the better-cited one), order by severity, group by file. No
confidence filter: if an auditor cited a real rule, the finding stays. If you
genuinely doubt one, keep it marked "(verify)" with one line on the doubt.

```
## Kanon audit - <base>...HEAD (<n> files)

Canon-only review: the project's own conventions were deliberately ignored.

### High (MUST violations)
- `path:line` - <rule> - <why>. Fix: <fix>.

### Med (SHOULD deviations)
- `path:line` - <rule> - <why>. Fix: <fix>.

### Low (advisory / justified deviations)
- `path:line` - <rule> - <note>.

### Clean
<families with no findings>

**Verdict:** canon-compliant | N findings (X high / Y med / Z low)
```

If asked to post it on a PR, write the report to a file and use
`gh pr comment <n> --body-file <file>` (requires the GitHub CLI, authenticated).

## Notes

- Read-only by default: report, do not edit. Apply fixes only on request; when
  fixing, follow `laravel-kanon` rules.
- Pairs: `/code-review` for bugs, `laravel-standards-review` for house-style,
  this skill for the canon.
- The rules live in the `laravel-kanon` skill's `references/` folder; edit them
  there and both skills stay in sync.
