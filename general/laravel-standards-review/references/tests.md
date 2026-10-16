# Tests

What this auditor protects: that the change ships with tests written the way the project
writes tests, asserting behaviour rather than implementation. Tests are the part of the
codebase that's read most during maintenance and trusted most during refactors; a brittle
or framework-inconsistent test is a maintenance liability disguised as safety.

Authority order: `[project-doc]` > `[established-pattern]` (cite a sibling test) >
`[laravel-baseline]`.

## Coverage of the change

- **Behavioural change without a test**: a new endpoint, command, handler, job, rule, or
  branch with no accompanying test, in a project that tests this kind of code. Flag the
  untested surface specifically (which path/branch). **med/high** by how central the code is.
- **New branch, old test**: a conditional/edge case added to existing logic whose test file
  wasn't touched, so the new branch is unexercised. **med.**
- **Failure and auth paths, not just the happy path**: a change tested only for success
  while the failure paths go unexercised. Check each validation rule that can reject input, each
  domain exception that can be thrown (assert its status/message), the unauthenticated
  response (e.g. 401) on a protected endpoint, and the meaningful edge/transition states.
  Happy-path-only coverage is the most common maintainability blind spot: it passes today
  and hides the regression tomorrow. Flag the specific untested path. **med.**
- Don't demand tests for code the project itself doesn't test (e.g. thin resources, config);
  match the established coverage bar.

## Right framework, right shape

- **Framework consistency**: Pest vs PHPUnit per the profile. Flag a PHPUnit test dropped
  into a Pest suite (or vice-versa); mixed frameworks double the cognitive load of the
  suite. **med.**
- **Structure**: match the project: base `TestCase`, the DB-refresh strategy
  (`RefreshDatabase`/transactions/`DatabaseMigrations`), feature-vs-unit placement,
  attribute style (`#[Test]` vs `test_` naming). Flag the outlier. **low.**
- **Factories**: use the project's model factories (and states) for setup where peers do,
  rather than hand-building models / raw inserts. `[established-pattern]`, **low**.

## Assertions that survive refactors

- **Behaviour over implementation**: a test asserting *only* a status code where peers also
  assert response body / DB state, or a test asserting internal calls/private state instead
  of observable outcome. Implementation-coupled tests break on every refactor and erode
  trust. **low/med.**
- **DB state asserted** where the change persists data and the project checks it
  (`assertDatabaseHas`/model reloads). **low.**
- **Side effects faked and asserted**: mail, notifications, queued jobs, events, and HTTP
  calls are faked (`Mail::fake`, `Bus::fake`/`Queue::fake`, `Event::fake`, `Http::fake`) and
  then asserted, not left to hit real services or pass silently. Flag a test that triggers a
  side effect without faking + asserting it. **med:** un-faked side effects are flaky and
  slow, the two things that get a suite ignored.
- **No assertion-free tests**: a test that exercises code but asserts nothing meaningful
  (or only `assertTrue(true)`). **low.**

## Test maintainability

- **Descriptive names that state the behaviour**: a test named for the method under test
  (`test_create`, `test_handler`) rather than the behaviour it asserts
  (`it_rejects_signup_when_email_is_taken`), where peers name for behaviour. A test name is
  the first thing read when a suite goes red. Match the project's convention (`it_*`,
  `test_*`, `#[Test]` + descriptive method). **low.**
- **No logic in tests**: conditionals/loops that compute the expected value the same way
  the code does (a test that can't fail), or sprawling shared mutable setup. Flag the
  specific anti-pattern. **low.**
- **Determinism**: a test depending on real time, real randomness, or ordering, where the
  project freezes time / seeds / sorts. Flag with the deterministic fix. **low/med.**
- **Isolation**: a test that leaks state to others (real cache/files/env not reset) against
  the project's isolation convention. **low.**
