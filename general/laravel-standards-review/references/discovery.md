# Discovering a project's conventions

The point of this phase is to learn how THIS team writes Laravel before you judge their
diff. Spend a few minutes here; it is what separates a useful maintainability review from
generic nagging. Produce a short **conventions profile** (a dozen lines is plenty) and hand
it to every auditor.

This review is tuned for **long-term maintainability**, so discovery has a specific goal:
establish the **three tiers of authority** the auditors cite, in order of strength:
documented rules (tier 1, `[project-doc]`, which includes tooling config), established
patterns (tier 2), and the Laravel baseline (tier 3). A finding is only as credible as
the tier it can name.

## Documented rules (authoritative; cite as `[project-doc]`)

- `CLAUDE.md` at the repo root and in any directory the diff touches (nested CLAUDE.md
  files scope rules to their subtree).
- `AGENTS.md`, `.cursor/rules/*`, `.cursorrules`, `.github/copilot-instructions.md`.
- `README.md` / `CONTRIBUTING.md`: a "conventions", "code style", or "architecture" section.
- Anything under `docs/` (`CODING_STANDARDS.md`, `ARCHITECTURE.md`, `DOMAIN.md`, ADRs in
  `docs/adr/` or `docs/decisions/`).

These override everything below. A documented rule the diff breaks is the highest-severity
class of finding: the team wrote it down and then diverged.

## Tooling config (machine-enforced; skip what it already catches)

- `pint.json`: the code-style preset (`laravel`, `psr12`, …) and overrides. Pint runs in
  CI, so do NOT report formatting/style nits it already enforces.
- `phpstan.neon`/`.dist`, larastan extension, the `level:`: the static-analysis bar. Don't
  report type issues PHPStan would catch.
- `.editorconfig`: indentation, line endings.
- `composer.json`, the `laravel/framework` constraint (idiom shifts across v10 to v13) and
  notable packages: `sanctum`, `passport`, `horizon`, `telescope`, `filament`, `livewire`,
  `inertiajs`, `scout`, `pennant`, `pulse`, `saloon`. Version-specific conventions matter:
  when unsure, use the Laravel Boost `search-docs` MCP tool (if installed) for the installed versions.
- `phpunit.xml(.dist)` vs a `Pest.php`/`tests/Pest.php`: which test framework is in use.

## Established patterns (the maintenance signal; cite as `[established-pattern: <file>]`)

This section is what makes the review about maintainability rather than rule-lawyering. Most
of how a team writes code is **never documented**. It lives in the consistency of the
files themselves. A new file that diverges from the consistent practice of its neighbours
is maintenance debt even when no doc forbids it, because it forces every future reader to
learn a second way of doing one thing.

Read **2 to 3 sibling files near each changed area** and record the prevailing practice. The
divergence finding must cite the sibling(s) that establish the pattern. That citation is
what keeps the finding auditable and non-opinionated.

- **Controllers**: invokable single-action vs resourceful? thin (delegate) vs fat?
- **Validation**: FormRequest vs inline `$request->validate()`? array vs string-pipe rules?
- **Models**: `$fillable`/`$guarded` vs global `unguard()`? `casts()` method vs `$casts`?
  relationship return types? logic on the model or elsewhere?
- **Transformation**: API Resources vs returning models/arrays directly?
- **Layout**: default `app/Http`,`app/Models` vs a DDD/modules/`src/` structure vs
  Actions/Services. Where does business logic live? Are there module boundaries that
  siblings respect (no cross-imports/FKs)?
- **DI**: constructor injection + contracts, or facades/helpers used freely?
- **Enums**: backed? case naming (UPPER_CASE vs PascalCase)?
- **Types**: `declare(strict_types=1)` present? signatures typed? `final readonly`?
- **Naming**: how are jobs/events/listeners/DTOs named and suffixed? a domain glossary?
- **Tests**: framework, base class, DB-refresh strategy, factory use, what they assert.

## Write the profile

A compact summary every auditor can apply, e.g.:

```
Laravel 13, PHPUnit, Pint(laravel preset), PHPStan L6 + larastan.
Documented rules: CLAUDE.md requires single-action controllers, FormRequest validation,
  no env() outside config. docs/ARCHITECTURE.md describes module isolation.
Established patterns: models use unguard() (no $fillable); casts() method; API
  Resources for responses; Action classes for writes; backed enums UPPER_CASE;
  strict_types everywhere; PHPUnit + RefreshDatabase + factories.
Silent on: <X>, <Y> - use the Laravel baseline, conservatively.
```

Each auditor checks the diff against documented rules first, skips what tooling already
enforces, checks established patterns next, and uses the generic baseline last and only
where the project is silent.
