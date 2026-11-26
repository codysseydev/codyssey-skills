---
paths:
  - "tests/**"
---

# Testing (project rules)

- Test method names **MUST** start with `test_` and use snake_case, stating the behaviour (`test_it_creates_an_order`). Source: `CLAUDE.md:7`. Changes TEST-003, the Kanon's `it_` prefix rule.
- Tests **MUST** use PHPUnit and extend `Tests\TestCase`. PHPUnit finds test methods by their `test_` prefix, so tests carry no `#[Test]` attribute. Source: `tests/Orders/CreateOrderHandlerTest.php:9-11`. Changes TEST-001, which asks for the `#[Test]` attribute.
