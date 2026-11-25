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

- **UI-040. Use the primitives in `src/features/global-ui/` before hand-building a control.**
  `Button`, `Input`, `Select`, `Spinner`, `Skeleton`, `Badge`, `EmptyState` and `ErrorState`,
  unless the control is a tab, toggle, accordion header or menu item, or no `Button` variant
  fits. A raw `<button>` sets `type` (UI-031), and a call site does not restyle a primitive
  (UI-007). **SHOULD.**
  - Why: a hand-built control misses the focus, size and state handling the primitive already
    has.
  - From: U38

- **UI-041. One dialog approach across the app.** Every modal uses the same dialog component,
  and a confirmation uses one shared confirm dialog built on it. A second dialog library or a
  hand-built overlay is not added. **SHOULD.**
  - Why: one approach gives every modal the same focus, Escape and scroll-lock behavior, and
    one place to fix it.
  - From: U39 (core part)

- **UI-042. A new component in `src/features/global-ui/` is added to the component catalog,
  `docs/reference/global-ui-components.md`.** **SHOULD.**
  - Why: the catalog is where a developer looks before building a control, so a component
    missing from it gets built twice.
  - From: U46

- **UI-043. Fonts load only with `next/font` in the root layout and are used through the CSS
  variables.** No font `<link>`, no `@font-face` in app code, and no font family name in
  `className` or an inline style. Add a face or weight by editing the `next/font` call in
  `app/layout.tsx`, then the copy in the Storybook stylesheet, since Storybook cannot use
  `next/font`. The `ch` unit ban of UI-018 also applies to font-dependent widths. **SHOULD.**
  - Why: `next/font` self-hosts the files and preloads the root layout font on every route, so
    a font loaded another way arrives later and shifts the text.
  - Source: Next.js, Font Module https://nextjs.org/docs/app/api-reference/components/font
  - From: U30

- **UI-044. Index keys only for static or skeleton lists.** A list built from data keys each
  item by a stable id. Oxlint's `react/jsx-key` is on; `react/no-array-index-key` is not
  enabled. **SHOULD.**
  - Why: an index key reattaches state and focus to the wrong item when a data list is
    reordered, filtered or grows at the front.
  - From: U48

- **UI-045. Scroll, touch and wheel listeners that never call `preventDefault` pass
  `{ passive: true }`.** **SHOULD.**
  - Why: a passive listener lets the browser scroll immediately.
  - Source: Vercel React best practices, client-passive-event-listeners https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/client-passive-event-listeners.md
  - From: U51

## Links and navigation

- **UI-046. A new tab is opened safely, through one helper.** `openExternal(url)` in
  `src/lib/openExternal.ts` calls `window.open(url, '_blank', 'noopener,noreferrer')`, and no
  other file calls `window.open`. An anchor with `target="_blank"` carries
  `rel="noopener noreferrer"`. No lint rule enforces this. **SHOULD.**
  - Why: without `noopener`, the opened page can reach `window.opener`.
  - From: U26

- **UI-047. Internal links use `next/link`; an external URL is a plain `<a>`.** A plain
  `<a href>` is for external URLs, hash anchors and `app/global-error.tsx`, which renders
  outside the root layout. An external URL that opens in a new tab is
  `<a href target="_blank" rel="noopener noreferrer">`, never a `next/link`. The
  `@next/next/no-html-link-for-pages` lint rule does not see a path served by a rewrite in
  `next.config`, so check such links by hand. **SHOULD.**
  - Why: `next/link` prefetches and navigates on the client inside the app, while for an
    external URL it adds nothing and hides the new-tab attributes UI-046 asks for.
  - Source: Next.js, Link Component https://nextjs.org/docs/app/api-reference/components/link
  - From: U27

- **UI-048. A navigation is a `Link`, not a `Button` that calls `router.push`.** Card and
  call-to-action navigations render `next/link` (with the hover-prefetch link of UI-049 inside
  a list), so a crawler gets an `<a href>`. A redirect after a submit or an action stays
  `router.push`. **SHOULD.**
  - Why: a crawler follows an `<a href>` and not a click handler, so a page reached only
    through `router.push` gets fewer internal links.
  - From: U36

- **UI-049. Every link inside a `.map` is a `HoverPrefetchLink`** from
  `src/features/global-ui/links/HoverPrefetchLink`, which prefetches on hover instead of on
  render. **SHOULD.**
  - Why: `next/link` prefetches on render, so a long list of links can flood the API with
    prefetch requests.
  - From: U37

## Forms

- **UI-050. A field that asks for a WCAG 1.3.5 input purpose sets `autoComplete`.** That covers
  email, new and current password, given and family name, telephone and address. A field for
  someone else's details, such as an invite form, sets `autoComplete="off"`. **SHOULD.**
  - Why: the token tells the browser what to fill, which saves typing and errors, most of all
    for readers with motor or memory impairments.
  - From: U50

## Images and assets

- **UI-051. Use `next/image`, never `<img>`.** Test files and story mocks are exempt. Preloading
  content images is DATA-020. **MUST.**
  - Why: `next/image` resizes, serves modern formats and reserves the image box, which a bare
    `<img>` does not.
  - Check: lint `@next/next/no-img-element`.
  - From: U13

- **UI-052. `<Image fill>` always sets `sizes`; content images use the shared
  `contentImageSizes` helper.** **SHOULD.**
  - Why: without `sizes`, a `fill` image downloads the largest width in its `srcset`, whatever
    size it renders at.
  - Source: Next.js, Image Component https://nextjs.org/docs/app/api-reference/components/image
  - From: U45

- **UI-053. An image that can be the largest element above the fold is not lazy.** Never pass
  `priority` to `next/image`. Give a known LCP image `preload`. Give any other image that may
  be above the fold `loading="eager"` with `fetchPriority="high"`. Never both on one image.
  Carousel cards and images below the fold stay lazy. Preloading content images is DATA-020.
  **SHOULD.**
  - Why: a lazy LCP image starts loading late and delays the largest paint, and `priority` is
    deprecated since Next.js 16.
  - Source: web.dev, Optimize Largest Contentful Paint https://web.dev/articles/optimize-lcp
  - Source: Next.js, Image Component https://nextjs.org/docs/app/api-reference/components/image
  - From: U63

- **UI-054. Remote image hosts are an exact allowlist.** `images.remotePatterns` in
  `next.config` names each host exactly, such as `assets.example.com`, with no wildcard. A host
  used only in development, such as a local API host, is added only when the build is not
  production. **SHOULD.**
  - Why: a wildcard lets images from any matching host through the image optimizer, so the
    app pays to resize them.
  - Source: Next.js, Image Component https://nextjs.org/docs/app/api-reference/components/image
  - From: U52

- **UI-055. Files in `public/assets/` are never replaced in place.** A changed file gets a new
  name. A file that has to change under the same name goes in another `public/` folder, such
  as `public/images/` or `public/icons/`. Before deleting a file from `public/`, search the
  code and the content for its path. **MUST.**
  - Why: the folder is served with a long immutable cache lifetime, so browsers and caches keep
    the old bytes of a file replaced under the same name.
  - From: U47 (core part)

## Page metadata

- **UI-056. Every page exports `metadata` or `generateMetadata`.** **SHOULD.**
  - Why: a page without its own metadata ships the layout's title and description, so search
    results show the same snippet for many pages.
  - From: U14

- **UI-057. Build metadata with the helpers in `src/lib/metadata.ts`.**
  `generateContentMetadata` builds a detail page whose content comes from the API,
  `generateStaticPageMetadata` a static page, and `generateFallbackMetadata` the `catch` of a
  detail page. A detail page whose content is not published yet follows UI-066. The helpers
  keep the `<title>` at or under 60 characters with the ` | <Site name>` suffix, and the
  description between 120 and 155 characters. **SHOULD.**
  - Why: Next runs `generateMetadata` on the server before the page renders, so the helpers put
    titles and descriptions of the right length into the first HTML a crawler reads.
  - Source: SEO in a Decoupled Architecture vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/41 - SEO in a Decoupled Architecture.md
  - From: U15

- **UI-058. A new page type adds a default description to `CONTENT_TYPE_DESCRIPTIONS`** beside
  the builders in `src/lib/metadata.ts`, long enough on its own to reach the 120-character
  minimum with any title. **MUST.**
  - Why: a page whose own description is missing or short falls back to this one, so it has to
    pass the minimum alone.
  - From: U16

- **UI-059. Private and per-visitor pages set `robots: { index: false }`** (sign-in, sign-up,
  dashboard, search, token links). An embargoed detail page is noindex through UI-066.
  **SHOULD.**
  - Why: these pages differ per visitor or carry a token, so an indexed copy is useless to
    searchers or leaks a link.
  - From: U17

- **UI-060. A build that is not the production site sets `robots` to noindex and `robots.txt`
  to `Disallow: /`, driven by one production flag, with a test for both branches.** The flag is
  read through the env module (DATA-042). Noindex on single pages is UI-059. **MUST.**
  - Why: a staging or preview build then never competes with the production site in search
    results.
  - Check: a test that `robots.txt` built with the flag off is `User-agent: *` and
    `Disallow: /`; a test that the layout metadata `robots.index` follows the flag; no second
    environment check outside the flag module.
  - Source: SEO in a Decoupled Architecture vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/41 - SEO in a Decoupled Architecture.md
  - From: NX-16

- **UI-061. A page that sets its own `openGraph` restates `images`.** The builders do this, and a
  hand-written `openGraph` must too. **MUST.**
  - Why: a page-level `openGraph` replaces the root layout's block, so without `images` the
    page ships no card.
  - From: U18

- **UI-062. `og:image` order for detail pages:** the API's `og_image` field when it is not
  blank, then the item's image from the API, then the content type's archive card from
  `CONTENT_TYPE_OG_IMAGES`. A detail page passes `ogImage: entry.og_image`. **SHOULD.**
  - Why: an image picked for sharing beats a content image, and the archive card means a page
    never ships without one.
  - From: U19

- **UI-063. Declare `1200x630` only on cards known to be that size:** the generated card, the
  static fallback card, the teaser card and the static page cards. Do not declare it on an
  image from the API. **SHOULD.**
  - Why: a wrong declared size makes a link preview crop or stretch the image.
  - From: U20

- **UI-064. Every static page card is wired and present.** Each static page has a 1200x630
  card at `public/images/static-og-images/<name>-og-image.png` and an entry in the card
  manifest `scripts/og-static-pages.json`. Its metadata uses `STATIC_OG_IMAGE_BASE`, and
  `og:image` and `twitter:image` point at its own card with `summary_large_image`. **MUST.**
  - Why: a page without its own card shares the fallback image, and a card missing from
    `public/` breaks the preview.
  - From: U21

- **UI-065. A static card carries the page's own `h1` word for word** (the page title for pages
  without a server-rendered `h1`). Change the `h1` and regenerate the card in the same commit.
  Never edit a card image by hand. **SHOULD.**
  - Why: a card that says something other than the page reads as a different page when shared.
  - From: U22

- **UI-066. An embargoed detail page builds its metadata with the one teaser builder in
  `src/lib/metadata.ts`, never with the published-page builder and never by hand.** An
  embargoed page is one the API returns before its content is published. The teaser states
  the page itself: `og:title` and `twitter:title` equal the page `<title>`; `og:url` and the
  canonical URL are the page's own URL; `og:image` and `twitter:image` are the item's own card,
  or the content type's archive card when it has none; one description fills the meta
  description, `og:description` and `twitter:description`; `og:type` is `website`; `robots` is
  `index: false, follow: false`. A new content type that can be embargoed branches the same
  way. **MUST.**
  - Why: Next replaces the layout's whole `openGraph` and `twitter` objects when a page sets
    them, so a field the teaser does not state is lost.
  - From: U28 (core part)

- **UI-067. Embargoed items stay out of listings.** The sitemap, the feed, `llms.txt` and every
  listing page skip an embargoed item and every child page of one, such as the chapters of an
  embargoed guide. **MUST.**
  - Why: a listing sends readers and crawlers to a noindex teaser, and a sitemap that lists a
    URL the page itself marks noindex gives crawlers two answers.
  - From: U29 (core part)

- **UI-068. An aggregate file fetches its lists with `Promise.allSettled`.** A sitemap, feed or
  `llms.txt` that combines several API lists keeps the lists that succeeded and reports each
  list that failed through the reporting path of DATA-053; it never drops a failed list
  silently. Pages do not do this: a page keeps DATA-002 (a failure that is not a 404 throws)
  and DATA-071 (a failed fetch is not rendered as empty). **SHOULD.**
  - Why: with `Promise.all`, one failed content type empties the whole file.
  - Check: a test of the sitemap with one list mocked to reject, whose output still holds the
    other lists and the static URLs; no `Promise.all` over content fetches in the sitemap, the
    feed or `llms.txt`.
  - Source: SEO in a Decoupled Architecture vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/41 - SEO in a Decoupled Architecture.md
  - From: NX-17

## Structured data

- **UI-069. Emit JSON-LD through `JsonLd` from `src/lib/JsonLd.tsx`,** never a hand-written
  `<script type="application/ld+json">`. `JsonLd` replaces `<` with its unicode escape so text
  from the API cannot close the script; that is enough, because `<` is the character that can
  close the element (the helper in the Next.js guide also escapes `>`, `&`, U+2028 and
  U+2029). Any other inline `<script>` goes through `InlineHeadScript` with a module-level
  constant string; request or API data is never put into script code. **SHOULD.**
  - Why: the HTML parser ends a script at the first `</script>` before any JavaScript escaping
    applies, so API text that holds it would break out of the script.
  - Source: Next.js, JSON-LD guide https://nextjs.org/docs/app/guides/json-ld
  - Source: SEO in a Decoupled Architecture vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/41 - SEO in a Decoupled Architecture.md
  - Source: The Injection Bugs Your Blade Templates Are Hiding vault: Content/Insights/The Injection Bugs Your Blade Templates Are Hiding.md
  - From: U23

- **UI-070. A detail page whose content comes from the API renders `JsonLd`** next to its
  metadata, with the object built in `src/lib/structuredData.ts` and written through UI-069.
  **SHOULD.**
  - Why: structured data lets search engines show the page as a rich result, which metadata
    alone cannot.
  - From: U24

## What is NOT a violation
