# Testing

Applies to: all tests, and to any behavioral change (which is incomplete without them).

## Framework and shape

- `TEST-001` Tests **MUST** use PHPUnit with the `#[Test]` attribute. Every test that boots the application **MUST** extend the project's `Tests\TestCase`. Pest **MUST NOT** be used; a Pest-style `it(...)`/`test(...)` closure is a violation, not a preference.
- `TEST-002` Tests of pure domain code (value objects, model methods with no query, rules on plain values) **SHOULD** live in a Unit suite and extend `PHPUnit\Framework\TestCase`, so they run without booting the framework or the database.
- `TEST-003` Test method names **MUST** be descriptive with the `it_` prefix, stating the behavior (`it_signs_up_a_member_successfully`, `it_returns_404_when_course_not_found`), never generic (`test_course`).
- `TEST-004` Tests touching the database **MUST** use `RefreshDatabase`.
- `TEST-005` Test data **MUST** come from factories and factory states; manual `Model::create([...])` where a factory state exists is a violation.
- `TEST-006` Tests **MAY** use facades and helpers freely. When invoking a job's `handle()` directly with injected dependencies, use `$this->app->call([$job, 'handle'])`.
- Filament/Livewire page-test rules (`Livewire::test`, `setCurrentPanel`, displayed-field assertions) are owned by `filament.md`.

## The ten rules

1. `TEST-007` Every behavioral change **MUST** ship with tests covering the happy path, the failure paths, and the edge cases. An untested endpoint/handler/rule is incomplete work, not a follow-up.
2. `TEST-008` Controller happy-path tests **MUST** assert the full response structure (`assertJsonStructure` matching every resource key), not a spot-check.
3. `TEST-009` Every Form Request validation rule (`required`, `email`, `max`, `unique`, enum, `confirmed`, ...) **MUST** have a test that triggers it.
4. `TEST-010` Any test that creates, updates, or deletes data **MUST** assert the resulting database state, not just the HTTP response, using strict comparison (`assertSame`, never `assertEquals`).
5. `TEST-011` A handler that dispatches a domain event **MUST** be tested with `Event::fake()` plus `assertDispatched(...)` including assertions on the event's properties.
6. `TEST-012` Side effects **MUST** be asserted: `Mail::assertQueued`, `Bus::assertDispatched`, `Notification::assertSentTo`.
7. `TEST-013` Every business-rule exception **MUST** have a test triggering it and asserting the HTTP status and message.
8. `TEST-014` Every authenticated endpoint **MUST** have a test asserting 401 when unauthenticated; every owned-resource endpoint **MUST** have a test asserting the failure when a non-owner tries it.
9. `TEST-015` State transitions **MUST** be tested from every relevant source state, not just the happy one.
10. `TEST-016` History/audit tests **MUST** assert the actual recorded content and metadata, not merely that a row exists.
