# Shared plan for the Kanon catalog conversions, #34 to #42

Issues codysseydev/codyssey-skills#34 to #42. Base b87b826. Kind: feature (prep). Approved by the owner on 2026-11-24 as one plan stop for all nine.

## Measured on origin/main

- 13 reference files to convert: 172 rules and 23 notes.
- The merged schema and generator reproduce every edge shape exactly: a keyword split over a line break (architecture 20-21, integrations 50-51), a nested **MAY** (architecture 33), testing's numbered list with a continuation, filament 48, and models-domain 78 with no subject.
- A real second family leaves all catalog tests passing.

## Per conversion PR

- Adds only `kanon/catalog/<family>.json`, the regenerated reference, and `kanon/scripts/fixtures/<family>.base.md` (the prose file as it was before conversion).
- IDs are fresh per family, in prose order, with the prefix from `families.json`.
- One entry per top-level bullet, nested bullets in `items`. Bullets with no keyword become notes.

## Field decisions (owner, 2026-11-24)

- `why`: copied verbatim from the bullet's own reason clause.
- `applies_to` and `allowed_in`: only where the prose names targets or exemptions.
- `detect`: paths and signals from the bullet's code spans and the file's Applies-to line.
- `checks`: draft where plausible (PHPArkitect, PHPStan or Deptrac, never Pest).
- `examples`: none. The extraction passes and #47 bring them.
- `lane_note`: from the prose's "owned by" pointers.
- `duplicate_of`: none. #43 sets it in one pass and adds a check that the target ID exists.
- `sources`: none.

## Scope

- `laravel` by default. `php-core.md` and `reliability.md` entries take `php-core`. Filament takes `filament`, symfony takes `symfony`.

## Problems found while converting

- Wording or keyword problems go to the owner as an issue comment. They are never changed in the conversion.
- The php-core service-location entry links its Laravel overlay to ORCH-008 from the php-core entry, because #39 may not edit `orchestration-di.json`. ORCH-008's last item is the `app()`/`resolve()`/`collect()` line.

## Order

1. The prep PR that makes the base-fixture test generic.
2. #34 to #41 in parallel, one branch and one PR each.
3. #42 after #39.

## Follow-ups out of scope

- Resync the reference copies in laravel-template and symfony-template with their `scripts/sync-rules.py` after #43. Their drift tests trip on regenerated references.
- A new `families.json` row fails the `families.length === 14` test (Next.js pack, #62).
