---
paths:
  - 'src/**/*.tsx'
  - 'src/lib/**'
  - 'src/features/**/utils/**'
  - 'app/**/*.tsx'
---

# Add-on: Untrusted Content

Rules for rendering HTML or markdown that the app did not write, such as CMS content.
They load when `react-markdown`, `rehype-sanitize` or another HTML sanitizer is in
`package.json`. These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Rules

- **UNTRUSTED-001. HTML from the API or a CMS reaches the page only as `SanitizedHtmlString`.** One rich-text component, `RichTextHtml`, takes that branded type and is the only place that writes API HTML with `dangerouslySetInnerHTML`. Only the sanitizer module, `src/features/global-ui/RichText/richTextSanitize.ts`, and its empty value `EMPTY_SANITIZED_HTML` cast a string to the brand. Any other `dangerouslySetInnerHTML` writes only a literal or a module constant, such as a `<style>` block, an inline head script or `src/lib/JsonLd.tsx`. The sanitizer schema also stops authored `id` and `name` from clobbering the DOM (UNTRUSTED-005). `tsc` enforces the first half of this rule. **MUST.**
  - Why: the sanitizer is the first barrier for CMS HTML, and with the brand a string that skipped it is a type error, for example a product description passed straight from the API response to the page.
  - Source: The Injection Bugs Your Blade Templates Are Hiding vault: Content/Insights/The Injection Bugs Your Blade Templates Are Hiding.md
  - From: D34
- **UNTRUSTED-002. Sanitize where the API response becomes page data, through `loadRichTextSanitizer()`.** The server page awaits it before it seeds the query cache, and a query function awaits it before the data reaches a component. A component never imports `richTextSanitize`. **MUST.**
  - Why: the sanitizer is a large module, and loading it at the data boundary keeps it out of the client bundle of every page that renders rich text, such as a product page with a formatted description.
  - From: D35
- **UNTRUSTED-003. Nothing edits the string after `sanitizeRichTextHtml()`.** Rewrite the HTML before it is sanitized, or add a plugin to the pipeline in `richTextSanitize.ts`. Enhancing the DOM after mount is allowed. **MUST.**
  - Why: the sanitizer is the last step and the type says so, so an edit after it, such as a `replace` that adds a link, can bring back markup the sanitizer removed.
  - From: D36
- **UNTRUSTED-004. A Markdown body from the API or a CMS renders with `markdownRehypePlugins`.** The plugins run `rehype-raw`, then `rehype-sanitize` with `markdownSanitizeSchema`, then the fragment-link step, in that order. Never use `rehype-raw` without a sanitize step after it, and never set `allowDangerousHtml`. **MUST.**
  - Why: the sanitize step must see the parsed HTML, so raw HTML inside Markdown, such as an `<iframe>` in a product note, is parsed first and then removed.
  - Check: the untrusted-content sanitizer tests (see "Checks the template may ship" in `index.md`).
  - From: D37
- **UNTRUSTED-005. HTML that reaches the page cannot clobber the DOM.** A sanitizer schema for HTML written with `dangerouslySetInnerHTML` either removes authored `id` and `name` attributes or prefixes them with `user-content-`, and a test asserts the behaviour for both renderers. **MUST.**
  - Why: an authored `id` or `name`, such as `id="config"`, creates a global that shadows a value the page's script reads.
  - Check: the untrusted-content sanitizer tests (see "Checks the template may ship" in `index.md`).
  - Source: OWASP ASVS 5.0, requirement 3.2.3 https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x12-V3-Web-Frontend-Security.md
  - From: D75
- **UNTRUSTED-006. Links inside CMS content follow one policy in both renderers.** An external `http(s)` link, or a protocol-relative `//host` link, opens in a new tab with `rel="noopener noreferrer"`. A relative link, a link to one of the site's own hosts and a `mailto:` link stay in the tab. The site's own hosts come from one constant in `src/constants/site.ts`. The Markdown `a` component, a rehype step in the rich-text sanitizer pipeline and any plain related-links list share one predicate, `src/lib/isExternalLink.ts`, which wraps the scheme check of ACCESS-003. See also UI-046. **SHOULD.**
  - Why: one predicate gives Markdown and rich text the same answer, so a link to the site's own help page does not open a new tab in one renderer and stay in the tab in the other.
  - From: U56

## Clauses

- **UNTRUSTED-007. The HTML text helpers and the CMS document page have one definition each.** This adds two cases to STRUCT-028. Stripping tags (`stripHtmlTags`) and decoding entities (`decodeHtmlEntities`, which decodes in one pass) are helpers in `src/lib`; a chained `replace(/&amp;/g, '&').replace(/&lt;/g, '<')` decodes `&amp;lt;` to `<`, so it is a second definition, not a variant. Pages whose body is a CMS document, such as the privacy and terms pages, are one page feature that takes the slug, not one copy per page. **SHOULD.**
  - Why: a second copy of an HTML helper drifts, for example a local decoder that turns escaped text back into markup, and a second copy of a document page drifts from the first.
  - From: S28 (untrusted-content clause)
- **UNTRUSTED-008. An `<img>` inside CMS HTML or Markdown is not rendered.** This adds to DATA-020: the sanitizer drops an `<img>` element until a renderer that uses `next/image` exists. **MUST.**
  - Why: a raw `<img>` from the CMS skips `next/image`, so it loads the original file at full size, for example a 4 MB photo in a short article.
  - From: D18 (untrusted-content clause)
- **UNTRUSTED-009. The `SanitizedHtmlString` cast is an allowed type assertion.** TYPES-010 allows the cast to the brand, and only the sanitizer makes it (UNTRUSTED-001). **SHOULD.**
  - Why: the brand works only if one place creates it, so a cast to it anywhere else, for example in a test helper outside the sanitizer, defeats the type check.
  - From: T35 (untrusted-content clause)
- **UNTRUSTED-010. The sanitizer limits `href` to the same schemes as the URL helper.** The Markdown and rich-text sanitizer allows `href` values with `http`, `https` and `mailto` only, the scheme list of the ACCESS-003 helper. **SHOULD.**
  - Why: an API URL and a CMS link then pass the same limit, so a `javascript:` link is blocked whichever path it takes into the page.
  - From: A8 (untrusted-content clause)
