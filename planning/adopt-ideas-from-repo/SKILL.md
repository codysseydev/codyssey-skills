---
name: adopt-ideas-from-repo
description: >-
  Study a reference repository the user points to (often a similar tool or a competitor), map its
  mechanisms onto the decisions the user's own plan already made, and propose ideas to adopt,
  grouped so the user can pick. Use when the user shares a GitHub link and says "take some ideas
  from this repo", "what can we learn from X", "compare this with our plan" or "propose ideas
  from this". Not for installing or vendoring the repo, and not for a code review of it.
---

# Adopting ideas from a reference repository

## Step 1: read it without cloning

With `gh api`:

- Metadata: description, stars, last push, language, and the license
  (`repos/<owner>/<repo>` `.license.spdx_id`). No license means ideas only: never copy its code.
- The file tree (`git/trees/HEAD?recursive=1`) to see where the substance is.
- The README in full, then the files that carry the design: playbooks or agent instructions,
  operations or architecture docs, research notes. Save them to the scratchpad and read them;
  skim source files only to confirm a mechanism.

## Step 2: read the user's side

Read the plan the ideas are for and every decision already made in it (runtime, points where a
human must approve, labels, environments, what was ruled out). An idea that contradicts a decision
is either dropped or offered as a question, never slipped in.

## Step 3: map mechanisms to the plan

For each mechanism worth taking, write what it does there, the problem it solves, and how it
would work under the user's decisions (their runtime, their review stops, their tools). Prefer
mechanisms that solve a problem the plan will hit anyway, such as an agent weakening the checks it
is graded by. Leave out what only fits the reference's stack.

## Step 4: propose for a pick

Tell the user in a few lines what the repo is, its license, and how it differs. Then ask with
AskUserQuestion, multiSelect, grouped by theme (for example verification, run handling, later),
four options at most per question. Each option's description says how the idea works in the
user's setup, not in the reference's.

## Step 5: record what was chosen

Add a section to the plan naming the source with its link and license note, one bullet per
adopted idea in the user's terms, and fold each idea into the build list item it belongs to. Log
the step where the project logs decisions.
