---
paths:
  - 'src/**'
  - 'app/**'
  - 'docs/**'
  - 'CLAUDE.md'
  - '.ai/rules/**'
---

# Code Structure: Features, Imports, Server vs Client, Naming, Docs

Where code lives in the app: feature folders, exports, the direction of imports, server
and client components, file names, where types and enums live, shared code and pages,
what stays out of the tree, and docs and rule files.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.

## Features

- **STRUCT-001. Product code lives in a feature folder.** Code for one product area goes in `src/features/<kebab-name>/`, with the entry component `<FeatureName>.tsx` at the folder root, named after its folder, and subfolders `components/`, `hooks/`, `services/`, `store/`, `types/`, `utils/`, `constants/`, `tests/` and `stories/` created as needed. Flag product code added to `src/lib/` or to a type-named folder outside a feature. **SHOULD.**
  - Why: one folder per product area holds everything that area needs, so a change to `shipments` touches one folder instead of a file in each of five type-named folders.
  - Source: Feature Modules vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/38 - Feature Modules.md
  - Source: Why Your Laravel Codebase Is Unmaintainable vault: Content/Insights/Why Your Laravel Codebase Is Unmaintainable.md
  - From: S1
- **STRUCT-002. Pages are thin.** A file in `app/**/page.tsx` reads `params`, builds metadata, and renders one feature entry component. No data shaping, no business logic. **SHOULD.**
  - Why: a page's job is to turn a route into a feature render, so the logic stays in the feature, where a test reaches it without the router.
  - Source: Stop Putting Business Logic in Symfony Controllers vault: Content/Insights/Stop Putting Business Logic in Symfony Controllers.md
  - From: S2
- **STRUCT-003. Logic is separate from UI.** Parsing, formatting, filtering and decision logic live in `utils/`, `hooks/` or `services/`, so it can be tested without rendering. See DESIGN-002. **SHOULD.**
  - Why: logic with no rendering in it runs in a test without a DOM and serves a second caller, for example a stock-level filter that both the inventory list and its CSV export use.
  - Source: Never Inject a Controller Into Another Controller https://codyssey.dev/quick-tips/never-inject-a-controller-into-another-controller
  - From: S3
- **STRUCT-004. Shared code has a fixed home.** Cross-feature utilities go in `src/lib/`, constants in `src/constants/`, React providers in `src/providers/`, the API client in `src/lib/apiClient.ts`, global types in `src/types/`, page-route constants in `src/constants/routes.ts` (STRUCT-030), and shared icon components in `src/features/global-ui/icons/` (STRUCT-008). **SHOULD.**
  - Why: with one home for each kind of shared code, a reader knows where to look before writing a second copy of a helper.
  - From: S4
- **STRUCT-005. Each feature has one entry component** at the folder root, a named export like every other module (STRUCT-009). A component and its file carry the same name. A component named after a case it does not cover is renamed for what it renders (`ErrorPanel` to `StatusPanel`). A `global-ui` component that shares its name with a wrapper in `app/` takes a `Site` prefix (`Header` to `SiteHeader`, `Footer` to `SiteFooter`). **SHOULD.**
  - Why: one entry gives each page one import per feature, and a name that matches its file and what it renders lets a reader find a component from its tag.
  - From: S5
- **STRUCT-006. A nested module repeats the feature layout.** A sub-area of a feature (`inventory/stock-levels/`, `shipments/components/TrackingPanel/`) uses the same subfolder names as a feature, so a reader finds `hooks/` and `tests/` in the same places. `global-ui` is a flat catalog of components and is exempt. **SHOULD.**
  - Why: a reader who knows one feature's layout finds the hooks and tests of any sub-area without searching.
  - From: S6
- **STRUCT-007. `constants/` holds a feature's constants.** Do not create `config/`, `consts/` or `data/` for the same purpose. **SHOULD.**
  - Why: one folder name for one kind of file lets a reader, and a search for `constants/`, find every constant of a feature.
  - From: S7
- **STRUCT-008. Shared icon components live in `src/features/global-ui/icons/`**, with PascalCase file names. **SHOULD.**
  - Why: one folder of shared icons lets a feature reuse an icon instead of pasting its SVG, for example one `TruckIcon` that `shipments` and `inventory` both import.
  - From: S23 (core part)

## Exports

## Imports and dependency direction

## Server and client components

## File naming

## Where types and enums live

## Shared code and pages

## What stays out of the tree

## Docs and rule files

## What is NOT a violation
