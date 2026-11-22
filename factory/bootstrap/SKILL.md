---
name: bootstrap
description: Create a factory product's brain vault (`<slug>-docs`), its event model journey setup and its code repository (`<slug>`) from templates, then write the repo's factory project file and prove its recipe from a clean clone. Use after domain design, before the backlog. Not for adding a feature to an existing product and not for creating GitHub repositories.
---

# Bootstrap

Turn a designed product into two local repositories that the factory can work in. The brain vault holds the brief, design and decisions. The code repo holds the application and its recipe.

Order in the factory: brief (`brief-writer`), domain design (bounded contexts, event model), bootstrap, then the backlog (`brief-to-backlog`).

## Inputs

- Name, slug (lowercase kebab-case), one-line pitch. Take them from the approved brief.
- Modules: the bounded contexts, as StudlyCase names. They come from `Architecture/Bounded Contexts.md` in the brain after domain design. Without a brain yet, ask the user for the list and record it there afterwards.
- Stack: `laravel`.
- Root folder that will hold `<slug>-docs` and `<slug>`.

## Run it

```
python3 ~/.claude/skills/bootstrap/scripts/bootstrap.py \
  --name "Sample Product" --slug sample-product --pitch "One line." \
  --modules Billing,Catalog --stack laravel --root ~/Code \
  [--brain-template PATH_OR_URL] [--pack PATH_OR_URL] [--date YYYY-MM-DD] [--dry-run]
```

Templates default to the `FACTORY_BRAIN_TEMPLATE` and `FACTORY_LARAVEL_PACK` environment variables, then to the template repositories on GitHub (both private, so cloning needs your `gh` login). A GitHub URL is cloned to a temp dir. A local path is used as is.

The script refuses if `<root>/<slug>-docs` or `<root>/<slug>` exists and is not empty. It prints a JSON report and exits 0 only when every step passed.

## What it does

1. Brain: runs the brain template's `scripts/new-brain.py` into `<root>/<slug>-docs`. The brain has its own `CLAUDE.md`, structure checker and skills.
2. Event model setup: copies `product.py` and `wb_state.json` from the `event-model` skill's `examples/sample-product/` into `Architecture/event-model-generator/` in the brain and sets the product name. It writes an empty `j01.py` named after the product (`lanes=[]`, `slices=[]`, no hot spots). It adds `.wb/` to the brain's `.gitignore`, runs `wb.py --product <dir> check` and `plan` (both must pass; `plan` skips boards that have no URL yet), reruns the brain's own checker, and commits in the brain.
3. Code repo: runs the pack's `scripts/new-repo.py --name --slug --pitch --target [--modules] [--date]` into `<root>/<slug>`. Packs are pluggable: a Symfony pack is planned with the same `new-repo.py` contract.
4. Playbook: runs `factory-onboard`'s `write-playbook.py` on the new repo, then again with `--check`, which fails unless `.factory/playbook.md` has all seven sections. It commits the file as "Add the factory project file". The sections the repo gives nothing for read `None yet.`, and `## Post-merge` reads `none` for the deploy check and for Sentry.
5. Recipe: runs `factory-onboard`'s `prove-recipe.py` on the new repo, from a clean clone. The Laravel pack writes `.factory/recipe.yml`, and this step proves it.

The report lists these as `steps` and carries the playbook script's JSON under `playbook`. The playbook is a starter. Refine it with `factory-onboard`.

The journey is empty on purpose. Domain design adds the product's lanes, slices and further journeys, and the first feature fills `j01.py` at its plan stage. Its boards are placeholders until then.

## Dry run

`--dry-run` is local git only. Without it the report also tells the session to run `factory-onboard` on the repo, which opens a PR for the recipe and the playbook. In a dry run both stay committed locally and no PR is opened. The script never creates a GitHub repository and never pushes, with or without the flag.

## After the script

- Creating `<slug>-docs` and `<slug>` on GitHub (private) is a separate step. The session does it with `gh`, and only after the user says yes. Push both after that.
- The Laravel pack's `.ai/rules/` come from the Kanon references for now. Catalog-generated rules come later.
- Boards are not created here. Create them later, per the `event-model` skill, once the journeys exist.
- Write the next steps into the brain's `Ideas/Build Log.md` and commit.

## If it fails

The script leaves what it created, so read the report's `error`, fix the cause, delete the two folders yourself, and run again. A failed recipe proof means the pack's repo does not pass its own checks on a clean clone: report the failing step and its output tail, and do not edit the recipe to hide it.
