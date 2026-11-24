# Standards report: acme/shop

Read at: READ_AT
Framework: laravel
Policy warnings: `.aiignore` excludes `app/Legacy/` (1 file not read).

## Conventions

| Convention | Evidence | Source | Kanon rule | Effect |
|---|---|---|---|---|
| Every PHP file opens with `declare(strict_types=1);` | `.php-cs-fixer.dist.php:9` "'declare_strict_types' => true" | configured | ORCH-011 | adopt |
| Facades are used in application code | `CLAUDE.md:12` "Use Laravel facades"; `app/Orders/CreateOrderHandler.php:13` "DB::transaction" | written down | ORCH-008 | off |
| Test methods start with `test_` in snake_case | `CLAUDE.md:7` "Test methods use the"; `tests/Orders/CreateOrderHandlerTest.php:11` "public function test_it_creates_an_order" | written down | `kanon/laravel-kanon/references/testing.md` "Test method names **MUST** be descriptive with the `it_` prefix, stating the behavior (`it_signs_up_a_member_successfully`, `it_returns_404_when_course_not_found`), never generic (`test_course`)." | change |
| Feature tests extend `Tests\TestCase` | `tests/Orders/CreateOrderHandlerTest.php:9` "extends TestCase" | pattern in code | `kanon/laravel-kanon/references/testing.md` "Every test that boots the application **MUST** extend the project's `Tests\TestCase`." | adopt |
| Classes are `final` | `.php-cs-fixer.dist.php:11` "'final_class' => true"; `app/Orders/CreateOrderHandler.php:9` "final class" | configured | none | project-only |
| `composer lint` runs PHP CS Fixer as a dry run | `composer.json:7` "php-cs-fixer fix --dry-run --diff" | configured | none | project-only |
| Commit subjects follow Conventional Commits | `commit:COMMIT_2` "feat(orders)" | pattern in code | none | project-only |
| Branch names start with `feature/` and a ticket key | `branch:feature/ORD-12-cancel-refund` | pattern in code | none | project-only |

## Silent on

- http-api
- authorization
- models-domain
- performance
- integrations
- architecture
- filament
- isolation
- persistence
- php-core
- reliability
