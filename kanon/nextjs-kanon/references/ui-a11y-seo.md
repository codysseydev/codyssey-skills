---
paths:
  - '**/*.tsx'
  - 'app/**'
  - 'src/constants/**'
  - 'public/**'
  - 'src/features/**/store/**'
  - 'src/features/**/hooks/**'
  - 'src/features/**/utils/**'
  - 'src/features/global-ui/**'
  - 'src/lib/metadata.ts'
  - 'src/lib/JsonLd.tsx'
  - 'src/lib/structuredData.ts'
  - 'vite.config.ts'
  - 'docs/reference/global-ui-components.md'
---

# UI, Accessibility and SEO

Tailwind and design tokens, responsive design, accessibility, components and primitives,
links and navigation, forms, images and assets, page metadata, and structured data.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row or lint
rule that enforces a rule, where one exists.

## Tailwind and design tokens

- **UI-001. Style with Tailwind 4 utilities and the tokens in the `@theme` block of
  `app/globals.css`.** Colors come from tokens (`bg-surface`, `text-body`, `border-subtle`), not
  arbitrary hex values or default Tailwind palette colors (`gray-500`, `red-600`). There is no
  `tailwind.config`. Email templates are exempt from the corner radius roles of UI-002 only,
  not from the color tokens. **SHOULD.**
  - Why: one token per color keeps the palette in one place, so a color change is one edit.
  - From: U1

- **UI-002. Corner radius follows a small set of named roles.** Each role (for example pill,
  control and surface) is one `--radius-*` token in the `@theme` block of `app/globals.css`, and
  a component takes the radius of its role. A new radius is a new role, added once as a token,
  not a one-off class at a call site. **SHOULD.**
  - Why: one radius per role keeps matching shapes across components, so a card with its own
    radius does not stand out as a mistake.
  - From: U2 (core part)

- **UI-003. Container padding follows a small set of named roles.** For example, one role for
  cards and one for page-level panels and modal bodies, each defined once and reused. Small
  chips and list rows keep their own padding. **SHOULD.**
  - Why: shared padding roles keep the spacing of similar surfaces the same on every page.
  - From: U3 (core part)

- **UI-004. Text color follows three roles.** One token for short text that has to stand out
  (headings, bold text, links, buttons, labels, navigation, badges), one for text people read
  (paragraphs, list items, table cells, descriptions), and one for secondary text (notes,
  metadata, form labels). Body and secondary text are never `font-light`. Reading text is at
  least `text-base` (16px). Body text on a dark page is not pure white. **SHOULD.**
  - Why: thin or small body text is harder to read, and pure white body text glares on a dark
    background, where a slightly dimmer token reads better.
  - From: U72 (core part)

- **UI-005. Every utility class in source exists in the Tailwind output, and a color utility
  names a token defined in `@theme`.** A class Tailwind does not generate is a finding, the
  same as an unknown color. For example, `text-md` is not a Tailwind 4 utility (there is no
  `--text-md` in `app/globals.css`), so it sets no font size and the element inherits its
  parent's: delete it where the inherited size is intended, or write `text-base` where 16px is
  meant. Classes written as plain CSS in `app/globals.css` are listed in the lint rule's
  `ignore` option. **MUST.**
  - Why: a class Tailwind does not generate does nothing, so the element falls back to an
    inherited or default style without any error.
  - Check: guard-test row UI-005; lint `better-tailwindcss/no-unknown-classes` for every other
    utility class.
  - From: U31

- **UI-006. A component that accepts `className` merges it with `twMerge`.** **SHOULD.**
  - Why: an overlapping utility loses to stylesheet order, whatever its position in the
    `class` attribute.
  - Source: Tailwind CSS, Styling with utility classes https://tailwindcss.com/docs/styling-with-utility-classes
  - From: U40

- **UI-007. A call site does not restyle a primitive.** It does not prefix a utility with `!`
  (`!bg-surface`, `!my-0`) and does not pass a width, radius or padding class
  (`className="rounded-full px-8"`) to `Button`, `Input`, `Select` or another primitive in
  `src/features/global-ui/`. A wanted look becomes a variant or prop on the primitive; a
  state-dependent look uses a state variant such as `enabled:` or `disabled:`. **SHOULD.**
  - Why: a look set at one call site drifts from every other use of the primitive, and a later
    change to the primitive no longer reaches it.
  - From: U67

- **UI-008. Z-index goes through `src/constants/zIndex.ts`.** The file names each layer and
  says why it exists. **SHOULD.**
  - Why: one list of layers shows which overlay sits above which, so two components do not
    race each other with ever larger numbers.
  - From: U41

- **UI-009. Full-width blocks use `PAGE_CONTAINER` from `src/constants/layout.ts`,** which fixes
  the page width and gutter. Nothing outside that file writes the page max-width class, and a
  page has one element that owns the container, with no `px-*` above it. **SHOULD.**
  - Why: one constant keeps every page the same width and gutter, so a change to either is one
    edit.
  - From: U42

- **UI-010. Headings take their size from the base h1 to h6 scale in `app/globals.css`.** There
  is no per-page override: a literal heading tag does not add a `text-*` size class.
  **SHOULD.**
  - Why: one heading scale keeps each level the same size on every page.
  - From: U43

- **UI-011. Name the properties in `transition-*`; no `transition-all`.** **SHOULD.**
  - Why: `transition-all` animates every property, including ones that cause layout work.
  - Source: Web Interface Guidelines https://github.com/vercel-labs/web-interface-guidelines
  - From: U49

- **UI-012. The sticky header offset is one CSS variable.** The header height is one variable
  in the `@theme` block of `app/globals.css`, such as `--header-h`, with one utility for it.
  Sticky and scroll-margin offsets use them. No literal header height in an arbitrary value
  and no pixel amounts added by hand: a sub-bar's own height is its own variable. **SHOULD.**
  - Why: when the header height changes, every offset that reads the variable follows.
  - From: U65 (core part)

## Responsive design

- **UI-013. Build mobile-first.** Base classes style the phone; `sm:`, `md:` and `lg:` add to
  them. Do not write `max-*:` breakpoints. **SHOULD.**
  - Why: with breakpoints in one direction, a larger-screen class only adds to the smaller
    one, so the cascade reads one way.
  - From: U4

- **UI-014. A page shell that fills the screen uses `min-h-dvh`, not `min-h-screen`.** An inner
  block that must not follow the toolbar may keep `min-h-screen`. **SHOULD.**
  - Why: `min-h-screen` is `100vh`, which on iOS Safari is taller than the visible area while
    the toolbar shows, so the page scrolls past the fold.
  - Check: guard-test row UI-014.
  - From: U71

- **UI-015. A page has exactly one `<main>`, and the root layout `app/layout.tsx` owns it.** A
  page or nested layout never adds its own. The heading outline inside it is UI-023.
  **MUST.**
  - Why: a second `<main>` gives screen reader users two main landmarks and no way to tell
    which one holds the page.
  - Check: guard-test row UI-015.
  - From: U32

- **UI-016. Text that comes from the API wraps long unbroken words.** A flex child holding such
  text also needs `min-w-0`. Cards that render titles from the API wrap with `break-words` or
  `wrap-break-word`. **SHOULD.**
  - Why: one long word or URL from the API can widen a card past the screen and add
    horizontal scroll.
  - From: U33

- **UI-017. A responsive variant is one tree.** Showing and hiding two copies with `hidden` or
  `sm:hidden` (`display: none`) is fine: the hidden node already leaves the accessibility tree
  and the focus order. `inert` or `aria-hidden` is needed only when the second copy stays
  rendered (opacity, an off-screen transform). **SHOULD.**
  - Why: a second copy that stays rendered doubles every focusable element and every
    announcement.
  - From: U34

- **UI-018. A skeleton occupies the final box, and column widths do not use `ch` units.** A
  skeleton imports the layout class constants of the component it mirrors instead of copying
  the class string. Client-only UI that appears after a library starts, such as carousel
  arrows, reserves its slot. A text column takes its width from a token, not a `ch` value.
  **SHOULD.**
  - Why: a `ch` width changes when a web font swaps in, and a skeleton that differs from the
    final box shifts the layout when the content arrives.
  - From: U35

- **UI-019. Fixed and sticky chrome does not hide a focused control.** `html` sets
  `scroll-padding-top` to the fixed header height plus the tallest sticky bar of the page. A
  fixed bottom surface, such as a cookie banner, leaves the page enough bottom padding or
  `scroll-padding-bottom`. **SHOULD.**
  - Why: a keyboard user who tabs to a control under the header cannot see where focus went.
  - Source: WCAG 2.2, Success Criterion 2.4.11 Focus Not Obscured (Minimum) https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum
  - From: U60

## Accessibility

## Components and primitives

## Links and navigation

## Forms

## Images and assets

## Page metadata

## Structured data

## What is NOT a violation
