---
name: event-model
description: Draw a product's journeys as Event Model frames and Event Storming walls on claude.ai Whiteboard artifacts, from journey files kept in the product's brain vault. Use per product in domain design (draw every journey), and per feature at the plan stage (extend the journey file, then sync its two boards before the plan stop). Not for a one-off diagram, and not for code.
---

# Event model

Turn journey files into whiteboards. Each journey becomes two boards: an Event Model frame (screens, commands, events, read models, Given / When / Then per slice) and an Event Storming wall (actors, commands, events, policies, hot spots). Board 00 holds both legends and a modules wall.

The journey files are the source. The boards are generated. People move, add and comment on elements on a board, so a sync only writes what changed in the journey files and never rebuilds a board.

Notation and the journey dict are in `references/journey-format.md`. Read it before writing a journey.

## Where things live

- Journey files: in the product's brain vault, for example `<brain>/Architecture/event-model/`. That folder is the product folder: `product.py`, one file per journey, `wb_state.json`.
- Add `.wb/` to the brain's `.gitignore`. It holds plans, element docs and board reads.
- `wb_state.json` is committed. It records each board's URL and what was last published to it.
- The engine is in this skill: `~/.claude/skills/event-model/scripts/`. Run everything as:

```
python3 ~/.claude/skills/event-model/scripts/wb.py --product <dir> <command>
```

`--product` can be left out when `EVENT_MODEL_PRODUCT` is set or the current folder is the product folder.

## Set up a new product

1. Copy `examples/sample-product/` into the brain as the product folder.
2. Edit `product.py`: set `name`, `default_actor` and the legend wording. List your journeys in `FRAMES`, in the order they should appear on board 00.
3. Write one journey file per journey, following `j01.py` and the format reference. Take the wording from the product's domain language, and put class, route and exception names on the last line of each rule card.
4. Run `check` until it passes. It builds every board and writes nothing. It fails on an unknown slice type or column key, a `from` ref that does not resolve, a hot spot that names no slice or card, a board over 780 elements, or an arrow through a card.

## Create the boards

Not yet exercised end to end. The first real run may need adjustments.

Boards link to each other, so create all of them and record all URLs before the first `plan`.

1. List the board keys and titles: `wb.py titles --missing`.
2. Find the Whiteboard artifact type with the Artifact tool: `action: list`, `scope: types`.
3. For each missing board, publish with the Whiteboard type's `type_url` and the title from step 1.
4. Record the URL: `wb.py set-url <key> <url>`. An unknown key is refused.
5. Run `titles --missing` again. It must print nothing.

## Sync the boards

Needs the Artifact and ArtifactData tools. A session without them runs `check` and `plan`, says "whiteboard sync pending" in its report, and stops there.

1. `wb.py plan [key ...]`. With no keys it plans every board. It writes `.wb/<key>/plan.json`: batches of at most 50 ArtifactData writes, each pointing at a file under `.wb/<key>/docs/`. A board with no URL is skipped and named.
2. For each board, send its batches in order with ArtifactData `action: batch` to the board's URL. Each batch commits all or nothing. Updates and deletes carry `if_version`.
3. After every batch of a board committed, run `wb.py commit <key>`. It records the new elements and versions in `wb_state.json`.

If a batch is refused, someone edited that element since the last sync. Do not commit that board. Read it into `.wb/<key>/live/`: ArtifactData `list` of collection `elements` with `query.limit` 1000, and `get` of `board/meta`, both with `out_dir` `.wb/<key>/live`. Then run `plan` again and resend. With a fresh read, an element a person deleted stays deleted, and elements people added (ids not starting with `g`) are never touched. `commit` removes the read, because it goes stale once the board changes.

Never rebuild a board from scratch and never delete one without asking its owner. Comments and elements people added live on it.

## At the plan stage of a feature

1. Extend the journey file: add or change slices for the feature. Keep the existing slices as they are, so existing board elements keep their ids.
2. `check`.
3. Sync the feature's two boards (`plan em-<key> es-<key>`, send the batches, `commit`). Board 00 changes too when you add a journey or a hot spot, so plan it as well.
4. Link both boards in the plan before the plan stop.

## Rules

- Hot spots are for real gaps found while drawing, not for decoration. Each one names the slice and the card it is about.
- Use the product's own words for events and commands. Past tense for events.
- Do not edit `wb_state.json` by hand. `set-url` and `commit` write it.
- A board holds at most 800 elements and 2 MB; `check` caps at 780 to leave room for people. Split a journey that gets close.
