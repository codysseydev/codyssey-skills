---
name: brief-writer
description: Turn one sentence (a product idea, or a feature for an existing product) into a product brief through an interview, ending with a human approval. Use when someone says "write a brief", "scope this product", "brief this feature", or starts a software factory run. Not for writing code, specs, architecture or a domain model, and not for unattended runs, because the brief needs a human.
---

# Brief writer

Turn one sentence into an approved product brief. The brief says what the product is as an outsider sees it. It never says how it is built.

This is a human stop. If no human is present (a scheduled or unattended session), do not run. Say the brief needs a human and stop.

Exception: a caller that runs this as a test with a simulated user. Then write each interview round exactly as it would be asked, and record the simulated answer under `## Interview log` at the end of the brief. Each entry gives the question, the answer, and its basis: grounded (with a quoted source) or guess (with the reason). Mark the approval as simulated: `Approved: YYYY-MM-DD (simulated)`. Real factory runs still stop for a human.

## Inputs

- The sentence: a product idea, or a feature of an existing product.
- Output path (optional). Default: `Product/Brief.md` in the product's brain vault. If there is no brain vault, ask where to write it.
- Existing context files (optional): a prior brief, a README, brain notes.

## Pick the scope

- New product: nothing exists yet. Interview for every section.
- Feature of an existing product: read the product's existing brief, brain vault and README first. Ask only what is new. Write the feature as a new phase or a new section of the existing brief, and keep the existing feature IDs unchanged.
- Feature with no existing brief: write a brief for the feature alone, scoped as a feature, and say in the pitch which product it extends.

## Interview

Use the AskUserQuestion tool, never plain text questions. Each question has 2 to 4 concrete options and names the brief section it feeds.

- Single-choice question: put the recommended option first, marked "(Recommended)".
- A question that lists several entry points or channels: use multiSelect. Do not force one recommended option on a list where several can be true.

Batching: group the topics below into rounds of at most 4 questions per call, the most scope-changing first. Stop when every section is answered or parked as an Open question. There is no fixed round count.

Topics, in rough order:

1. Who has the pain (Persona).
2. What happens today and what it costs them (Business problem).
3. What done looks like from the outside (Requirements).
4. What exists on day one: what is already there when this ships, and whether it should trigger or be affected by the feature (back catalogue, existing users, existing data).
5. Which platforms, browsers or clients are in scope, and any platform limits the user already knows.
6. Scale numbers: users, volume, size, speed (Requirements).
7. Lifecycle, for any feature that keeps state per user or per device: what happens on sign-out, session expiry, account closure, and on a second device.
8. Defaults: when the brief names a list of kinds or types, ask per kind whether it is on or off by default.
9. How the owner will know it works: what they will measure. The answer becomes a requirement with a check.
10. What is out (Non-goals).
11. What ships first (Phases).

Rules:

- Never invent a number, rule, name, age or limit the user did not give. An unknown becomes an Open question.
- Do not ask about design: tables, events, classes, frameworks, patterns. That belongs to domain design and the per-issue plan. If the user volunteers design, record the need behind it and drop the design.
- Skip a topic the sentence or the existing context already answers.

## Brief sections

Exactly these, in this order.

1. **One-sentence pitch.** What it is and for whom.
2. **Persona.** A role with a specific pain and context, not a market segment and not an invented named person. Never invent a name, age or numbers.
3. **Business problem.** What happens today and what it costs (time, money, errors, lost customers). Use only numbers the user gave.
4. **Requirements.** Capabilities as `R1`, `R2`, ... Each has an acceptance check someone can run from outside the code: a request, a screen, a file, a message. Example: "R3. Sign every request so the receiver can verify it came from us and has not been replayed. Check: resend a captured request after the window closes and the receiver rejects it."
5. **Non-goals.** Each with its reason on the same line. Example: "No offline mode: the first users are always on a desk with a connection." A non-goal saves a weekend.
6. **Deliverables.** What exists when it is done: the running product, docs, a demo script, a data import. Outcomes, not repositories or modules.
7. **Phases.** Each phase produces something usable and says what it leaves for later. Phase 1 is the smallest thing someone can use. Do not push a small extension into a later phase only to shrink phase 1: ask whether the later phase changes what phase 1 does by default, and if it does, it belongs in phase 1. List features as `F<phase>.<n>` (`F1.1`, `F1.2`, `F2.1`), each with a one-line outcome a user can observe and the requirement IDs it covers: `F1.2 Reset a forgotten password by email (R2)`. Feature IDs are stable: never renumber after approval. The backlog skill consumes them.
8. **Open questions.** Numbered `Q1`, `Q2`, ... Each says what it blocks (a requirement, a feature, a check).

Style: short sentences, plain verbs, no design words, no marketing adjectives.

Design words test: a check names what a user or an outside system sees or receives. It never names how the product stores or computes it. Platform-provided UI, such as a browser's own permission prompt, counts as outside and is allowed.

## Check and approve

Before asking for approval, build a coverage table in the brief or in your reply:

| Requirement | Covered by features |
|---|---|
| R1 | F1.1 |
| R2 | F1.2, F2.1 |

A requirement may map to several features: list them all, so shared requirements show. Every requirement needs at least one feature. Every feature must trace to at least one requirement. Fix gaps by asking the user or by adding an Open question.

Then stop and ask the user to approve the brief through AskUserQuestion (options: approve, change something, not yet). Do not continue past this stop on your own.

On approval, add a line under the title: `Approved: YYYY-MM-DD` (today's date; add ` (simulated)` in a simulated run). The backlog skill refuses a brief without it. If the user changes a phase later, remove the line, edit, and ask again.

## Return

The brief path, the coverage table, the open questions that remain, and whether the brief is approved.
