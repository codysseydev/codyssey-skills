---
name: review-plan-against-repos
description: >-
  Review an idea, plan or proposal note by checking every factual claim against the repositories,
  docs and services it names, then report findings with quotes and file:line references and ask
  which to fix. Use when the user says "review the X idea", "sanity-check this plan", "is this
  plan still true" or "check this note against the code", for notes in an Obsidian vault, a docs
  repo or a claude.ai doc. Not for code review of a diff (use /code-review).
---

# Reviewing a plan against its sources

A plan written in one sitting carries confident claims that went stale or were never true. The
review finds them before anything gets built on them.

## Step 1: find the note and its neighbours

- Locate the note, its git history (`git log --format='%h %ad %s' --date=short -- <path>`), and
  every note that links to it or that it links to. Read the neighbours that the plan depends on.
- If the note names a source doc (a claude.ai link), read it with the docs tools to see whether
  the note dropped or changed anything.

## Step 2: list the claims

Write down every claim the plan rests on, each with its line number: tools or skills that
"exist today", files, ADRs, numbers ("every brief", "19 fix commits"), environments, decisions
"already chosen", dependencies on other plans, and anything about cost or availability.

## Step 3: check each claim at its source

- Code and config: read the file, quote the line (`composer.json:6`).
- Counts: count them yourself and give the denominator ("18 of 42", not "most").
- Other repositories the user has: search them, including automation or agent repos, for a
  second plan covering the same ground.
- External services: open the official docs page and quote it; a search snippet is not a source.
- Environments: check memory and docs for ones that were removed or renamed.
- Things you cannot find: mark them "unverified" and ask, never guess (for example a repository
  that is not on disk).

## Step 4: check that it can run

Beyond the facts, ask whether each step can run where the plan puts it: does the runtime have the
language version, database, Docker and tools the step needs, and are the points where a human
must approve reachable from an unattended run?

## Step 5: report

In chat, findings first, most serious first. Each finding: a bold one-line title, the quote from
the note with `file:line`, the evidence with its source, and why it matters. Then a short "what
holds up" list. Explain terms for a reader new to the topic. No em dashes.

## Step 6: let the user decide

Do not edit the note yet. Ask with AskUserQuestion how to apply the findings (fix facts in place
and add open questions, append a review section, or leave it), and any decision a finding raises.
Then apply exactly what was chosen, and record decisions with their date in the note.
