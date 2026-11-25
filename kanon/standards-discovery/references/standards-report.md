# The standards report

`standards-report.md` in the work folder lists each convention found, with evidence, and what the Kanon does about it. `scripts/check-overlay.py` checks it against the client repo and the overlay.

```markdown
# Standards report: acme/shop

Read at: 861a4986e158aa7491f1a75021c305d7bc872133
Framework: laravel
Policy warnings: `.aiignore` excludes `app/Legacy/` (1 file not read).

## Conventions

| Convention | Evidence | Source | Kanon rule | Effect |
|---|---|---|---|---|
| Every PHP file opens with `declare(strict_types=1);` | `.php-cs-fixer.dist.php:9` "'declare_strict_types' => true" | configured | ORCH-011 | adopt |
| `composer lint` runs PHP CS Fixer as a dry run | `composer.json:7` "php-cs-fixer fix --dry-run --diff" | configured | none | project-only |
| Commit subjects follow Conventional Commits | `commit:861a498` "feat(orders)" | pattern in code | none | project-only |

## Silent on

- architecture
- authorization
```

## Header

- `Read at`: the full commit sha from `inventory.json` (`read_at`). Every citation is checked at this commit, so a later edit to the working tree does not break the check.
- `Framework`: `laravel` or `symfony`.
- `Policy warnings`: the warnings from `policy.json`, in one line, or `none`.

## Rows

- The table starts with the header row and the `|---|---|---|---|---|` separator, in that order.
- Evidence items are `` `path:line` `` or `` `path:line-line` ``, each followed by a short quote in double quotes that appears on the cited lines (whitespace collapsed). A range spans at most 20 lines. Separate items with `; `.
- A quote has at least 3 characters that are not spaces, one of them a letter or a digit. It holds no `"`, no `|` and no backtick. On a line full of them, quote a fragment without them.
- Git history uses `` `commit:<sha>` "<text in the subject>" `` and `` `branch:<name>` ``. The commit must be `Read at` or reachable from it. The branch must be in `inventory.json`.
- Every row has at least one evidence item. A path in `ignored` is never cited. Every cited path, here and in the overlay's `evidence`, is a source or a sibling the inventory lists. The checker recomputes that list at `Read at`, so editing `inventory.json` does not widen it.
- Source is `written down` (a rule file, README or doc), `configured` (a linter, CI or script config) or `pattern in code`.
- Kanon rule is a catalog ID, the same one as the overlay entry, or `none`.
- Effect is `adopt`, `change`, `off` or `project-only`. `project-only` goes with `none`, and `none` goes with `project-only`.
- Every `adopt`, `change` and `off` row has an overlay entry with the same rule and effect, and every overlay entry has a row.

## Silent on

One bullet per Kanon family with no overlay entry, using the family names from `kanon/catalog/families.json`. For `Framework: laravel` the set is every family except `symfony`. For `Framework: symfony` it is `symfony`, `php-core` and `reliability`, the files `symfony-kanon` reads. Every overlay entry's family must be in the same set. A missing family, an extra family and a wrong family all fail.
