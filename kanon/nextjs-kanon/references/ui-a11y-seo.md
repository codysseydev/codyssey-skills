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

- **UI-020. Use semantic elements.** Actions are `<button>`, navigation is `<a>` or `next/link`,
  never a `div` or `span` with `onClick`. A separator is `<hr>`, not an empty
  `<div className="border-b">` and not a divider built from two `div`s around text.
  **MUST.**
  - Why: native elements bring keyboard support, focus and the right role, and a clickable
    `div` has none of them.
  - Check: lint, Oxlint `jsx-a11y` rules (they do not check separators).
  - From: U6

- **UI-021. Every form control has a label, and the form works by keyboard alone.** In a
  combobox every action, including a trailing "Show more", is an option the arrow keys reach.
  **MUST.**
  - Why: a control without a label has no name for a screen reader, and an action the keyboard
    cannot reach is lost to keyboard users.
  - Check: lint `jsx-a11y/label-has-associated-control`.
  - From: U7

- **UI-022. Keep one keyboard focus style.** `app/globals.css` styles `:focus-visible` once. A
  component with a custom shape uses `FOCUS_RING_CLASSES` from
  `src/features/global-ui/Button/focusRing.ts`. An element with a bare `outline-none` or
  `outline-0` also has `focus:`, `focus-visible:`, `focus-within:` or a shared focus-ring class
  in the same `className` attribute. A heading that receives programmatic focus is allowed.
  **MUST.**
  - Why: one focus style lets keyboard users find focus the same way on every control, and an
    outline removed with nothing in its place hides it.
  - Check: guard-test row UI-022.
  - From: U8

- **UI-023. Heading levels do not skip, and a page has one `h1`.** A card grid directly under
  the page `h1` passes `headingLevel="h2"`. The HTML a Suspense fallback produces counts as the
  page: a route whose server HTML is only the fallback has an `h1` in it (an `sr-only` one is
  allowed). **SHOULD.**
  - Why: screen reader users move through a page by its headings, and a skipped level or a
    missing `h1` breaks that outline.
  - From: U9

- **UI-024. Every `next/image` has an `alt`.** **MUST.**
  - Why: without `alt`, a screen reader has nothing to say about the image or reads its file
    name.
  - Check: lint `jsx-a11y/alt-text`.
  - From: U10

- **UI-025. Respect reduced motion with one global rule.** `app/globals.css` holds one
  `@media (prefers-reduced-motion: reduce)` block on `*, ::before, ::after` that sets
  `animation-duration: 0.01ms !important`, `animation-iteration-count: 1 !important`,
  `transition-duration: 0.01ms !important` and `scroll-behavior: auto !important`. Motion
  driven from JavaScript (`scrollTo({ behavior: 'smooth' })`, timers) checks
  `usePrefersReducedMotion` from `src/lib/usePrefersReducedMotion.ts`. Do not add a
  per-component `motion-reduce:` variant to cover a CSS animation. **SHOULD.**
  - Why: one block covers every CSS animation, including ones added later, where
    per-component variants miss some.
  - From: U11

- **UI-026. Loading and error feedback is visible and worded for the reader.** A load failure
  uses the `ErrorState` primitive, which owns the default message; inside a card or tab it
  takes `variant="inline"`. `ErrorState` carries `role="alert"` on its root, so do not add
  another alert around it. State handling itself is DATA-049, DATA-050 and DATA-051.
  **SHOULD.**
  - Why: a reader who sees nothing while data loads, or a raw error, cannot tell whether to
    wait, retry or leave.
  - From: U12

- **UI-027. Lint and test accessibility.** The lint config enables Oxlint's `jsx-a11y` rules
  (the recommended set, with options for `alt-text` and `label-has-associated-control`), so
  label, alt, role and click-handler problems fail the lint; that lint enforces UI-020, UI-021
  and UI-024. `@storybook/addon-a11y` runs over the stories in the Storybook test project,
  advisory first (`parameters.a11y.test: 'todo'`). A story whose violations are fixed, such as
  a `Button` `Disabled` story, is set to `'error'`, and the rest stay `'todo'` until fixed. A
  logo link has an accessible name such as "<Site name> home". **MUST** for the lint,
  **SHOULD** for the Storybook addon.
  - Why: the lint reads markup only and jsdom cannot compute contrast, so the addon covers
    what the lint misses.
  - Check: lint, the Oxlint `jsx-a11y` recommended set.
  - From: U25

- **UI-028. A modal moves focus in, keeps it inside, and returns it.** On open, focus goes to
  the first control or the dialog; Tab and Shift+Tab stay inside; on close, focus returns to
  the control that opened it. The one dialog approach of UI-041 does this. Each modal has a
  test that focus stays inside the dialog and returns to the opener on close. **SHOULD.**
  - Why: focus left behind the modal lets a keyboard user tab into a page they cannot see, and
    focus lost on close drops them at the top of the page.
  - From: U53 (core part)

- **UI-029. A form reports a failed submit to the keyboard and the screen reader user.** Three
  parts. (1) After a failed validation the form library moves focus to the first invalid
  control; a server error shown in a form alert with `role="alert"` needs no move. (2) A field
  error `<p role="alert">` may mount together with its text, as `Input` and `Select` do once a
  field is touched and has an error; that is allowed for field errors. Every other live region
  (status lines, toasts) exists before its message does (UI-035). (3) The invalid control has
  `aria-invalid`, and the error paragraph is tied to it with `aria-describedby`. **SHOULD.**
  - Why: without a focus move or an announcement, a keyboard or screen reader user does not
    learn that the submit failed or which field to fix.
  - From: U54

- **UI-030. A view switch that does not go through the router announces itself.** When content
  swaps without a Next navigation (history `pushState`, a filter, a result list), focus moves
  to the new region's heading (`tabIndex={-1}`), or an `sr-only` `role="status"` line states
  the change and the count. See DATA-017. **SHOULD.**
  - Why: Next announces a route change, but content swapped in place is silent to a screen
    reader user.
  - From: U55

- **UI-031. A raw `<button>` sets `type`.** Every `<button>` written by hand has `type="button"`
  (or `type="submit"` in a form). The `Button` primitive already defaults it. **MUST.**
  - Why: a `<button>` without a `type` is a submit button, so inside a form it submits on
    click.
  - Check: lint `react/button-has-type`.
  - From: U57

- **UI-032. A message that disappears on a timer can be read at the reader's pace.** An error
  toast stays until dismissed. A success, info or warning toast stays 8000 ms. Every timed
  message pauses its timer while hovered or focused, has a visible Close button, wraps its text
  (at most three lines) and never truncates text that comes from the API. **MUST.**
  - Why: a reader who is slow, distracted or on a screen reader misses a message that leaves on
    its own, and a status toast is not a real-time event that has to expire.
  - Source: WCAG 2.2, Success Criterion 2.2.1 Timing Adjustable https://www.w3.org/TR/WCAG22/#timing-adjustable
  - From: U58 (core part)

- **UI-033. Text color pairs meet 4.5:1 (3:1 for large text and UI borders).** A test computes
  the ratio of each text token on the surface token in the same class string, from the
  `@theme` values; a text color with an opacity modifier and no surface in its string is
  checked against every page surface. No opacity modifier on a text color (`text-muted/50`);
  use a token. **MUST** for the 4.5:1 pairs, **SHOULD** for the opacity ban.
  - Why: low-contrast text is hard to read for many readers, and an opacity modifier makes the
    real color depend on whatever sits behind it.
  - From: U59

- **UI-034. A pointer target is at least 24 by 24 CSS pixels, and a control a finger meets
  reaches 40 by 40 with one shared class.** Controls a finger meets in running content (links,
  tooltip triggers, icon buttons) are 40 px. Dense table-row and inline controls may be 32 px
  (`Button size="sm"`) but never below 24 px (WCAG 2.5.8, level AA). A box smaller than 40 px
  grows its hit area with `HIT_AREA_CLASSES` (all sides) or `HIT_AREA_Y_CLASSES` (inline text
  links, up and down only) from `src/features/global-ui/Button/focusRing.ts`, not with a margin
  or pseudo-element trick written in each file. **SHOULD.**
  - Why: a small target is hard to hit with a finger or an unsteady hand, and one class keeps
    the hit area the same everywhere.
  - From: U61

- **UI-035. A live region exists before its message does.** The exception is a field error
  `<p role="alert">` in `Input` and `Select`, which mounts with its text (UI-029). A toast
  renders its `role="status"` or `role="alert"` container at all times and fills it; it does
  not mount the container together with the text. **SHOULD.**
  - Why: screen readers announce a change inside a live region that already exists, and often
    miss a region that mounts with its text already in it.
  - Source: WCAG 2.2, Success Criterion 4.1.3 Status Messages https://www.w3.org/TR/WCAG22/#status-messages
  - From: U62

- **UI-036. A button group that selects one option exposes the selection.** Buttons that pick
  one value or view carry `aria-pressed` (filters) or use `role="tablist"`, `tab` and
  `aria-selected` (tabs). Color alone is not state. A group that changes the route is links
  with `aria-current="page"` (UI-048). **SHOULD.**
  - Why: a selection shown only by color is invisible to a screen reader and to readers who
    cannot tell the colors apart.
  - From: U64

- **UI-037. A skeleton or spinner announces that content is loading.** A loading skeleton's
  root element carries `role="status"` and an `aria-label` naming what is loading ("Loading
  activity"); the `Skeleton` bone stays `aria-hidden`. Only the outermost skeleton announces: a
  card or breadcrumb skeleton rendered by a page or grid skeleton takes `announce={false}`,
  which drops its role and label and hides it, so one loading state is one status region. A
  spinner-only state follows the same rule, including the Suspense fallback of a route, and
  the shared `Spinner` primitive carries `role="status"` and a generic "Loading" label so call
  sites inherit it. **SHOULD.**
  - Why: without a status region a screen reader user hears nothing while content loads, and
    nested skeletons that each announce repeat the message.
  - From: U66

- **UI-038. A disabled control states why in text.** When a control is disabled for a reason
  the viewer must know (their own row, an option they already chose), the reason is visible
  text or is linked with `aria-describedby`. `title` alone is not enough. A control that
  cannot act may use `aria-disabled` and stay focusable. **SHOULD.**
  - Why: `title` does not show on touch or with the keyboard, so the reason stays hidden from
    those viewers.
  - From: U68

- **UI-039. A global overlay is rendered once, in the root layout.** The `Toast` component is
  mounted once in `app/layout.tsx`; a feature calls `showToast` and does not render
  `<Toast />`. The same holds for any component that reads a global store, such as an install
  prompt or a cookie banner. **SHOULD.**
  - Why: two mounted copies of an overlay that read one store show every message twice.
  - From: U69

## Components and primitives

## Links and navigation

## Forms

## Images and assets

## Page metadata

## Structured data

## What is NOT a violation
