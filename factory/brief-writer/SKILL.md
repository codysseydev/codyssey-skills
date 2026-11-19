---
name: brief-writer
description: Turn one sentence (a product idea, or a feature for an existing product) into a product brief through an interview, ending with a human approval. Use when someone says "write a brief", "scope this product", "brief this feature", or starts a software factory run. Not for writing code, specs, architecture or a domain model, and not for unattended runs, because the brief needs a human.
---

# Brief writer

Turn one sentence into an approved product brief. The brief says what the product is as an outsider sees it. It never says how it is built.

This is a human stop. If no human is present (a scheduled or unattended session), do not run. Say the brief needs a human and stop.

## Inputs

- The sentence: a product idea, or a feature of an existing product.
- Output path (optional). Default: `Product/Brief.md` in the product's brain vault. If there is no brain vault, ask where to write it.
- Existing context files (optional): a prior brief, a README, brain notes.

## Pick the scope

- New product: nothing exists yet. Interview for every section.
- Feature of an existing product: read the product's existing brief, brain vault and README first. Ask only what is new. Write the feature as a new phase or a new section of the existing brief, and keep the existing feature IDs unchanged.

## Interview

Use the AskUserQuestion tool, never plain text questions. Per call: at most 4 questions, each with 2 to 4 concrete options, the recommended option first and marked "(Recommended)". Name the brief section each question feeds.

Order the rounds by what the sentence leaves open that changes scope the most:

1. Who has the pain (Persona).
2. What happens today and what it costs them (Business problem).
3. What done looks like from the outside (Requirements).
4. Scale numbers: users, volume, size, speed (Requirements).
5. What is out (Non-goals).
6. What ships first (Phases).

Rules:

- Never invent a number, rule, name or limit the user did not give. An unknown becomes an Open question.
- Do not ask about design: tables, events, classes, frameworks, patterns. That belongs to domain design and the per-issue plan. If the user volunteers design, record the need behind it and drop the design.
- Stop when every section has an answer or an explicit Open question.

## Brief sections

Exactly these, in this order.

1. **One-sentence pitch.** What it is and for whom.
2. **Persona.** One person with a specific pain, not a market segment.
3. **Business problem.** What happens today and what it costs (time, money, errors, lost customers). Use only numbers the user gave.
4. **Requirements.** Capabilities as `R1`, `R2`, ... Each has an acceptance check someone can run from outside the code: a request, a screen, a file, a message. Example: "R3. Sign every request so the receiver can verify it came from us and has not been replayed. Check: resend a captured request after the window closes and the receiver rejects it."
5. **Non-goals.** Each with its reason on the same line. Example: "No offline mode: the first users are always on a desk with a connection." A non-goal saves a weekend.
6. **Deliverables.** What exists when it is done: the running product, docs, a demo script, a data import. Outcomes, not repositories or modules.
7. **Phases.** Each phase produces something usable and says what it leaves for later. Phase 1 is the smallest thing someone can use. List features as `F<phase>.<n>` (`F1.1`, `F1.2`, `F2.1`), each with a one-line outcome a user can observe and the requirement IDs it covers: `F1.2 Reset a forgotten password by email (R2)`. Feature IDs are stable: never renumber after approval. The backlog skill consumes them.
8. **Open questions.** Numbered `Q1`, `Q2`, ... Each says what it blocks (a requirement, a feature, a check).

Style: short sentences, plain verbs, no design words, no marketing adjectives.

## Check and approve

Before asking for approval, build a coverage table in the brief or in your reply:

| Requirement | Covered by features |
|---|---|

Every requirement needs at least one feature. Every feature must trace to at least one requirement. Fix gaps by asking the user or by adding an Open question.

Then stop and ask the user to approve the brief through AskUserQuestion (options: approve, change something, not yet). Do not continue past this stop on your own.

On approval, add a line under the title: `Approved: YYYY-MM-DD` (today's date). The backlog skill refuses a brief without it. If the user changes a phase later, remove the line, edit, and ask again.

## Return

The brief path, the coverage table, the open questions that remain, and whether the brief is approved.
