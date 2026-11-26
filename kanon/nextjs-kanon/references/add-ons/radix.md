---
paths:
  - 'src/features/global-ui/**'
  - 'src/**/*.tsx'
---

# Add-on: Radix

Rules for Radix UI primitives. They load when a `@radix-ui/*` package is in
`package.json`. These rules add to the core rules and never replace them.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Rules

- **RADIX-001. A menu is the one `global-ui` menu on Radix DropdownMenu.** It sets `aria-expanded` and `aria-controls` on its trigger, closes on Escape and on an outside click, and returns focus to the trigger. Do not hand-build an `absolute ... top-full` list. A popover that is not a menu uses Radix Popover (RADIX-004). **SHOULD.**
  - Why: Radix DropdownMenu ships the keyboard, focus and dismiss behaviour that a hand-built list misses, for example arrow-key movement through an account menu.
  - From: U70

## Clauses

- **RADIX-002. The chunk-failure dialog loads statically.** This adds to DATA-019: the dialog the app shows when a lazy chunk fails to load, and the Radix Dialog primitive it renders, are imported statically from `app/layout.tsx`, never through `next/dynamic` or `React.lazy`. **MUST.**
  - Why: that dialog is what a visitor sees when a lazy chunk fails, so it cannot depend on a lazy chunk itself, for example right after a deploy removed the old chunks.
  - From: D16 (Radix clause)
- **RADIX-003. Radix Dialog gives the focus handling UI-028 requires.** Radix Dialog moves focus in, keeps it inside and returns it to its trigger. A dialog whose parent controls `open` has no `Dialog.Trigger`, so it spreads `useReturnFocusOnClose()` on `Dialog.Content` to get focus back. **SHOULD.**
  - Why: Radix returns focus to the trigger it knows, so a dialog opened from code, such as a session-expired notice, has nowhere to send focus without the hook.
  - From: U53 (Radix clause)
- **RADIX-004. Radix Dialog is the one dialog approach UI-041 requires.** A confirmation uses `ConfirmDialog`, a wrapper on Radix Dialog, and every other modal uses Radix Dialog. A popover uses Radix Popover, and a menu follows RADIX-001. **SHOULD.**
  - Why: one primitive gives every dialog the same focus trap, Escape handling and scroll lock, for example a delete confirmation and an edit form.
  - From: U39 (Radix clause)
