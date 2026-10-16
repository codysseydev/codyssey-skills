# Naming, types & idiom

What this auditor protects: that a name tells the next reader what a thing is and where it
lives, the same way every sibling name does. Naming drift is cheap to introduce and
expensive forever: every inconsistent suffix or mis-cased enum is a lookup the reader
can't shortcut. Skip anything **Pint** or **PHPStan/larastan** already enforce in this
repo; those run in CI and don't belong in this report.

Authority order: `[project-doc]` > `[established-pattern]` (cite the sibling) >
`[laravel-baseline]`.

## Naming & suffixes

- **Class-role suffixes** follow the project: `*Controller`, `*Request`, `*Resource`,
  `*Job`, `*Listener`, `*Command`/`*Handler`, `*Exception`, or whatever the codebase uses.
  Flag a new class missing the suffix its peers carry, or carrying one its peers omit
  (many projects leave models/events/enums un-suffixed by design). Cite a sibling. **low/med.**
- **Events**: past-tense (`OrderShipped`) *if that's the convention*. Flag an imperative
  event name in a past-tense codebase. **low.**
- **Domain/ubiquitous language**: if the project documents domain terms (a glossary, a
  DOMAIN.md, consistent vocabulary), flag technical/CRUD/ETL jargon (`Manager`, `Helper`,
  `Util`, `Processor`, `Ingest`, `Upsert`, `data`, `info`) where a domain term exists and
  peers use it. A name that drifts from the ubiquitous language is the seed of a divergent
  mental model. **low/med.**
- **Intention-revealing method names**: a method named for its mechanics
  (`checkAndUpdate`, `process`) where peers name for the domain action; flag as a
  readability drift only when the project clearly favours intent-revealing names. **low.**
- **Boolean/state naming**: `is*()`/`has*()` for booleans, a `status` enum over a pile of
  `is_*` flags, *if that's the established pattern*. **low.**

## Types & signatures

- `declare(strict_types=1)` at file top **if existing files in this area have it**. Flag a
  new file that omits it in a strict-types codebase. Don't impose it where the project
  doesn't use it. `[established-pattern]`, **low**.
- Typed parameters and return types on new methods, matching how dense the surrounding
  types are. Flag an untyped public signature in a fully-typed module. **low.**
- **Enums over magic strings/ints**: a bare string/int constant set where peers use a
  backed enum. **low/med.**
- **Enum case casing** matches the project (UPPER_CASE vs PascalCase; check existing
  enums; this varies per project and the project's choice wins). Flag the outlier. **low.**
- `final` / `readonly` on classes that the project marks so (DTOs, value objects,
  handlers). Flag a mutable new class where its whole sibling family is `final readonly`.
  `[established-pattern]`, **low**.

## Idiom & framework norms

- **No `env()` outside `config/`**: near-universal; config is cached in production and
  `env()` returns null there. Flag `env()` in app code regardless of documentation. **med.**
- **No global helpers where the project injects**: `now()`, `config()`, `event()`,
  `Log::`, `response()` etc. used in a file/module whose siblings inject the contract.
  `[established-pattern]`, **low/med**. Don't flag helpers in a codebase that uses them
  freely.
- **DTOs / typed returns over arrays**: a method returning an associative array
  (`['key' => …]`) as a transport type where peers return a typed DTO/object. Array-as-shape
  is the classic thing that's "fine" until the fourth caller mis-keys it. `[established-pattern]`,
  **low/med**.
- **Events carry ids/scalars, not Eloquent models**: a domain event (or job) with a
  `public Order $order` property where it should carry `public int $orderId` and let the
  listener re-fetch. Framework-level guidance regardless of architecture: a queued listener
  deserializes the event later, so a serialized model goes stale or fails to rehydrate, and
  the listener should load fresh state by id. Flag an event/job promoting a full model where
  an id would do. `[laravel-baseline]` (or `[established-pattern]` if peers do this), **med**.
- **Comments**: flag comment blocks that narrate *what* the next line does, or step-by-step
  multi-line narration, *if* the project keeps code comment-light. A class-level "why" doc
  or a non-obvious-`why` note is fine. **low.**
