# Testing

Applies to: all tests, and to any behavioral change (which is incomplete without
them).

## Framework and shape

- Tests **MUST** use PHPUnit with the `#[Test]` attribute, extending the project's
  `Tests\TestCase`. Pest **MUST NOT** be used; a Pest-style `it(...)`/`test(...)`
  closure is a violation, not a preference.
- Test method names **MUST** be descriptive with the `it_` prefix, stating the
  behavior (`it_signs_up_a_member_successfully`,
  `it_returns_404_when_course_not_found`), never generic (`test_course`).
- Tests touching the database **MUST** use `RefreshDatabase`.
- Test data **MUST** come from factories and factory states; manual
  `Model::create([...])` where a factory state exists is a violation.
- Tests **MAY** use facades and helpers freely. When invoking a job's `handle()`
  directly with injected dependencies, use `$this->app->call([$job, 'handle'])`.
- Filament/Livewire page-test rules (`Livewire::test`, `setCurrentPanel`,
  displayed-field assertions) are owned by `filament.md`.

## The ten rules

1. Every behavioral change **MUST** ship with tests covering the happy path, the
   failure paths, and the edge cases. An untested endpoint/handler/rule is
   incomplete work, not a follow-up.
2. Controller happy-path tests **MUST** assert the full response structure
   (`assertJsonStructure` matching every resource key), not a spot-check.
3. Every Form Request validation rule (`required`, `email`, `max`, `unique`, enum,
   `confirmed`, ...) **MUST** have a test that triggers it.
4. Any test that creates, updates, or deletes data **MUST** assert the resulting
   database state, not just the HTTP response, using strict comparison
   (`assertSame`, never `assertEquals`).
5. A handler that dispatches a domain event **MUST** be tested with `Event::fake()`
   plus `assertDispatched(...)` including assertions on the event's properties.
6. Side effects **MUST** be asserted: `Mail::assertQueued`, `Bus::assertDispatched`,
   `Notification::assertSentTo`.
7. Every business-rule exception **MUST** have a test triggering it and asserting
   the HTTP status and message.
8. Every authenticated endpoint **MUST** have a test asserting 401 when
   unauthenticated; every owned-resource endpoint **MUST** have a test asserting
   the failure when a non-owner tries it.
9. State transitions **MUST** be tested from every relevant source state, not just
   the happy one.
10. History/audit tests **MUST** assert the actual recorded content and metadata,
    not merely that a row exists.
