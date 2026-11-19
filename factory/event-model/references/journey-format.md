# Journey format

One journey is one Python dict in the product folder. `product.py` lists them in `FRAMES`, in the order they appear on board 00. Run `wb.py check` after every edit: it validates the dicts and builds every board.

## Journey

| Key | Meaning |
|---|---|
| `key` | Short id, such as `01` or `03b`. Becomes the board keys `em-<key>` and `es-<key>`. Unique. |
| `title` | `"<key> · <label>"`. The label names the board. |
| `story` | One paragraph in plain words: who does what, and what the system does in response. Shown under the title. |
| `lanes` | Event lanes, one per bounded context that owns events in this journey. |
| `slices` | The slices, left to right. |
| `hotspots` | Optional list of `(slice name, target text or None, text)`. A hot spot is a gap or open question. The target is a substring of an event, command or policy text in that slice; the red arrow points at that card. `None` means no arrow. |

## Slice

`name`, `type`, `cols`, `spec`.

- `type` is one of the four patterns: `State Change`, `State View`, `Automation`, `Translation`. It colours the slice title. The shapes on the board come from the columns, not from this label.
- `spec` is a list of lines for the Given / When / Then card under the slice. An empty string makes a blank line. Put the names of the classes, routes and exceptions on the last line, so every box can be found in the code.

## Column

A column is one step in time. All keys are optional; the set you give decides what is drawn.

| Key | Meaning |
|---|---|
| `trg` | The trigger. For a screen: the page or form. For a timed automation: when it runs, such as `Every night`. |
| `cmd` | A command in the user's words. Draws a command box. |
| `proc` | A processor: a listener or job that acts when nobody clicks. Draws a gear and a "To do" read model that feeds it. With an `ev` it records an event; without one the gear calls the outside system itself and the caption says "No event recorded". |
| `rm` | A read model the column builds or shows. |
| `rml` | `{lane: text}`: a read model drawn inside a context lane, for a read model another context reads at command time. |
| `ev` | `{lane: text}`: the events the column records, one per lane. A tuple `(text, '~')` is a hollow event (state changed, no event dispatched). A tuple `(text, '!')` is a rejected command. |
| `ext` | An external system box, such as `Payment provider: charge the card`. |
| `extIn` | `True` when the outside system sends the fact in (a translation). Without it the arrow runs from your side to the outside system. |
| `actor` | The actor on the Event Storming wall. Defaults to the product's `default_actor`; timed automations use `scheduler_actor`. |
| `from` | List of refs to earlier cards that feed this column. Arrows are derived from these. |
| `rmlfrom` | List of event refs that feed this column's `rml` boxes. |
| `to` | List of `(kind, ref)` pairs: an arrow from this column's read model (`kind` is `'rm'` or `'rml_<lane index>'`) to the card the ref names. |

## References

A ref is `<column>.<card>`.

- `-1` is the previous column, `-2` two back, `1` the next. `c3` is column 3 counted from 0 across the whole journey.
- `<card>` is a lane name (the event in that lane), or one of `cmd`, `rm`, `proc`, `ext`, `trg`, or `rml.<lane>`.

Examples: `'-1.Booking'` is the previous column's event in the Booking lane. `'c3.rm'` is column 3's read model.

## What the engine derives

| Column holds | Pattern drawn |
|---|---|
| `cmd` | State Change: screen, command, events |
| `proc` with `extIn` | Translation |
| `proc` with `from`, no `trg`, or a `trg` starting with a prefix in `automation_prefixes` | Automation |
| `proc` with a person's `trg` | State Change where the processor is the command |
| `rm` or `rml` | State View |
| only `trg` | A screen |
| only `ev` | An event on its own |

## Notation

| Element | Fill | Border |
|---|---|---|
| event | `#ff9e2c` | `#e0821a` |
| command | `#6db6f5` | `#4d97d9` |
| read model, to-do list | `#b5e48c` | `#7fb35a` |
| external system | `#ff9cc8` | `#e070a8` |
| policy | `#c39be0` | `#9a6fc0` |
| actor | `#f2c94c` | `#c9a227` |
| hot spot | `#f87171` | `#dc2626` |
| screen | white wireframe | `#57546c` |

Event Model rows, top to bottom: external systems; screens, or a processor gear; commands; one event lane per context; read models; the slice's Given / When / Then card. Time runs left to right, cut into numbered slices.

Event Storming rows, top to bottom: actor or incoming system; command, policy or read model; one lane per context; outside systems; hot spots. A policy reads "When <event>: <reaction>". A rejected command is a light red sticky, not a hot spot.

Board 00 holds the Event Model legend, the Event Storming legend and a modules wall: every event, deduplicated, grouped by lane.

## Product config

`PRODUCT` in `product.py` overrides the defaults in `scripts/model.py` (`DEFAULTS`). The keys:

| Key | Use |
|---|---|
| `name` | Legend titles: "<name> Event Model". |
| `default_actor`, `scheduler_actor` | Actor stickies when a column names none. |
| `automation_prefixes` | Tuple of `trg` prefixes that mark a timed automation. |
| `out_dir` | Working folder for plans and board reads, relative to the product folder. Default `.wb`. |
| `page_url` | URL of a read-only page, if the product has one. Empty means board notes carry no link. |
| `board_note`, `board_note_no_page` | The note at the top of each board. `{page_url}` is filled in. |
| `modules_intro`, `legend_em_intro`, `legend_es_intro` | Intro paragraphs on the modules wall and the two legends. |
| `translation_text`, `em_cmd_desc`, `em_hollow_desc`, `em_todo_desc`, `em_ext_desc`, `gaps_heading` | Legend wording on the Event Model legend. |
| `es_cmd_desc`, `es_actor_desc`, `es_ext_desc`, `es_hot_desc` | Legend wording on the Event Storming legend. |
