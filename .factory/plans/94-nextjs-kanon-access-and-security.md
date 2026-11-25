# Plan for #94, nextjs-kanon: the access-and-security rules

Issue codysseydev/codyssey-skills#94. Base origin/main 339f740. Branch `factory/94`. Kind: feature.

## Goal

Fill `kanon/nextjs-kanon/references/access-and-security.md` with its 15 entries, in the entry format of `references/index.md`, under the pack ids the id map gives. The file is public, so every entry is written from the public safety pass's fix for its rule, never from the source rule text alone. No other file changes.

## Entries

Order is the id map's order, which is the source file's prose order with the two new rules at their anchors (NX-02 after A3, NX-01 after A16). Sections are the stub's headings.

Fix types are the safety pass's: generalize, drop the flagged sentence or note, move a clause out (to the source project's overlay, so it is left out here), drop a clause, placeholder. "Notes policy" means the row has no flag and gets only the policy: drop Observed, Not migrated, Audit and incident notes, keep the Why with a neutral example, rename the source project's names.

| pack id | From | keyword in source | keyword planned (decision) | fix type | sources planned | Check line planned | cross-references |
|---|---|---|---|---|---|---|---|
| ACCESS-001 | A1 | MUST | MUST (unchanged) | drop flagged sentence | none | none | none |
| ACCESS-002 | A2 | SHOULD | SHOULD (unchanged) | notes policy | none | none | ACCESS-007 |
| ACCESS-003 | A8 (core part) | SHOULD | SHOULD (unchanged) | move clause out, generalize the rest | insight "The Injection Bugs Your Blade Templates Are Hiding", draft, `vault: Content/Insights/` path | none | none |
| ACCESS-004 | A9 (core part) | SHOULD | SHOULD (unchanged) | drop flagged note | none | none | none |
| ACCESS-005 | A3 | SHOULD | SHOULD (unchanged) | placeholder | lesson "Authentication Across the Boundary", draft, cited by vault path | none | none |
| ACCESS-006 | NX-02 | none (new) | MUST, written as MUST NOT, the sheet text's own form (sheet: MUST as written) | none (new rule) | same draft lesson, vault path | the sheet's check idea | ACCESS-005 |
| ACCESS-007 | A4 | SHOULD | SHOULD (unchanged) | drop flagged sentence; Why kept with a neutral example (policy) | lesson "Command-Query Separation (CQS)", live, https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/command-query-separation | none | ACCESS-002 |
| ACCESS-008 | A16 | SHOULD | SHOULD (unchanged) | drop clause, placeholder; Why kept with a neutral example (policy) | same draft lesson, vault path | none | none |
| ACCESS-009 | NX-01 | none (new) | MUST (sheet Decision note: generic core rule, the Laravel Sanctum names in an example line) | none (new rule) | same draft lesson, vault path | the sheet's check idea, see open question 5 | ACCESS-006 |
| ACCESS-010 | Layer calls tab (written fresh) | none | open question 4 | none: the access Layer-calls row, written fresh from its Decision note | none | none | none |
| ACCESS-011 | A10 (core part) | SHOULD, MUST for the guarded parts | SHOULD; MUST NOT for `'unsafe-eval'` in the enforced policy, MUST for the other two guarded parts (decision 7 and review answer 1) | move clauses out, generalize the rest | none | `next.config` headers guard, ACCESS-011 row, portable assertions only | DATA-049 |
| ACCESS-012 | A11 (core part) | SHOULD | SHOULD (unchanged) | generalize; see open question 2 | none | none | none |
| ACCESS-013 | A12 | SHOULD | SHOULD (unchanged) | drop clause | none | none | none |
| ACCESS-014 | A13 (core part) | SHOULD | SHOULD (unchanged) | move clause out, generalize the rest | OWASP ASVS 5.0 requirement 3.6.1, pinned v5.0.0 URL on github.com, no quote | `next.config` headers guard, ACCESS-014 row, see open question 3 | ACCESS-011 |
| ACCESS-015 | A14 (core part) | MUST | MUST (unchanged; decision 8 sets the content) | generalize | none | none | ACCESS-011, DATA-061 |

Counts: 6 whole source rules, 6 core parts, 1 written-fresh line, 2 new rules, 15 entries. This equals the 15 ACCESS rows of the id map and the `access-and-security.md` row of "Counts per file" (6, 7, 2, 15). The 11 safety-pass rows of the issue (A1, A3, A4, A8, A9, A10, A11, A12, A13, A14, A16) each have a fix type above.

### Readings the inputs settle

These are not open questions. The PR lists them.

- The A8 sanitizer clause goes to the untrusted-content add-on (id map row UNTRUSTED-010, written by #96), so it is left out of ACCESS-003. The safety pass fix proposed folding a generalized form into core; the id map and the issue win.
- Test file names the source rules cite are dropped, as issue step 6 says, and listed in the PR by role: the redirect helper test, the URL helper test, the route guard hook test, the keep-list test and the consent tests. The safety pass proposed a renamed path for the A1 test; the issue's later step wins.
- How-to links to the source project's guides are dropped. They are not public.
- ACCESS-011 keeps only the portable guard assertions. The deploy-host header assertion goes to the Cloudflare overlay, and the vendor and API-host assertions go to their add-ons or the source project's overlay.
- ACCESS-014 keeps its OWASP ASVS Source line, since the notes policy keeps a public doc. It cites the pinned requirement page with no quote, because the source rule's quoted words are not the ASVS wording.
- Storage keys use an `<app>_` placeholder, in the style of `<name>` in `index.md`.
- The ACCESS-001 Why uses a reserved documentation domain (RFC 2606) for the attacker host, so no real host appears.
- "What is NOT a violation" keeps the three generic bullets (a constant redirect path, a client guard plus the API's 401, tests that clear storage), each pointing at a pack id. The other three source bullets name a product page, the deploy host or an add-on, and are dropped.
- Three source rules of this file are not copied. The reasons are in the vault note.

## Verification

From the worktree root at the head commit, clean tree.

The issue's acceptance commands, with their output in the PR:

```
grep -cE '^- \*\*ACCESS-[0-9]{3}\.' kanon/nextjs-kanon/references/access-and-security.md
grep -niE 'codyssey' kanon/nextjs-kanon/references/access-and-security.md | grep -vE 'https://codyssey\.dev/|vault: Content/'
grep -niE 'sentry|turnstile|plausible|cloudflare|opennext|strict-transport' kanon/nextjs-kanon/references/access-and-security.md
grep -nE 'Not migrated|Migrated:|Observed:|Audit(ed)?:|PR #[0-9]+|#[0-9]{3,4}\b|\b[0-9a-f]{8,40}\b' kanon/nextjs-kanon/references/access-and-security.md
grep -nE '^\s*- Source:' kanon/nextjs-kanon/references/access-and-security.md | grep -vE 'https://|vault: Content/'
```

The first prints 15, the others print nothing. A hostname scan lists every host in the file; only the reserved documentation domain, the public lesson host and the OWASP repository host may appear. The `paths:` frontmatter stays as the stub has it: no feature folder and no Cloudflare file.

The From script, run outside the repo, compares the file with the id map in order and fails on an entry with zero or two `From:` lines:

```python
import re, sys
index, rules, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
expected = [(m.group(1), m.group(2).strip())
            for m in re.finditer(r'^\| (%s-\d{3}) \| [^|]+\| [^|]+\| ([^|]+)\|' % prefix, open(index).read(), re.M)]
entries = re.split(r'^(?=- \*\*%s-\d{3}\.)' % prefix, open(rules).read(), flags=re.M)[1:]
actual, errors = [], []
for e in entries:
    e = e.split('\n## ')[0]
    pid = re.match(r'- \*\*(%s-\d{3})\.' % prefix, e).group(1)
    froms = re.findall(r'^\s+- From: (.+)$', e, re.M)
    if len(froms) != 1:
        errors.append('%s has %d From: lines' % (pid, len(froms)))
    actual.append((pid, froms[0].strip() if froms else None))
if actual != expected:
    errors.append('mismatch:\n expected %s\n actual   %s' % (expected, actual))
print('%d entries, %d id map rows' % (len(actual), len(expected)))
print('\n'.join(errors) or 'OK: every entry has one From: line and the pairs equal the id map in order')
sys.exit(1 if errors else 0)
```

Run as `python3 -I check_from.py kanon/nextjs-kanon/references/index.md kanon/nextjs-kanon/references/access-and-security.md ACCESS`. On the prototype drafts it prints 15 entries, 15 rows, OK. With one `From:` line doubled and one label changed it reports both.

Every check in `.factory/recipe.yml`. At base 339f740 all 12 pass.

## Prototype

All 15 entries and the "What is NOT a violation" bullets are drafted outside the repo, each with the recommended option of the open questions below. The five acceptance greps print 15 and then nothing, the From script passes, and the hostname scan finds only the three allowed hosts.

## Out of scope

- Every other rule file, the add-on and overlay files (#89 to #93, #95, #96), `index.md` and `SKILL.md`, and the audit (#97).
- The add-on and Cloudflare clauses of A8, A9, A10, A11 and A14 (#96). NX-03 (#90).
- The template repository, its guard test and `bootstrap --frontend nextjs` (stages 2 and 3).
- Any change to `codysseydev/codyssey-frontend`.

## Open questions

Each draft entry uses the recommended option.

1. Helper and file names outside the names table (the redirect helper, the URL helper, the URL-token hook, the storage helpers, the guard hook, the route-handler check): describe each by its role and list candidate names in the PR for stage 2 (recommended), add them to `index.md` in this PR, or cite the source names.
2. ACCESS-012: the source states the handler's check mechanism only in the note the policy drops, while the fix keeps everything but the route path and the count. Keep the mechanism with neutral wording (recommended), or write the bare rule.
3. ACCESS-014 Check line: the guard's portable assertions are the ones ACCESS-011 names. Name the guard row with those shared assertions and say so in the PR (recommended), or drop the line and report the mismatch.
4. ACCESS-010 keyword: no input gives one. SHOULD, the source row's keyword, with no Why line (recommended), MUST with no Why line, or SHOULD with a short neutral Why.
5. ACCESS-009: the sheet's check idea names an option of the axios client, and axios is an add-on. Generic wording in the rule and the check, with the `fetch` and axios options and the Sanctum names in one example inside the Why (recommended), or the check idea verbatim.
6. ACCESS-015: decision 8 gives the principle; the recount's core reading also names what happens on withdrawal and on a new category. The principle as decided (recommended), or the principle plus stopping on withdrawal.
7. ACCESS-011: the template's guard test asserts on the enforced policy. The script-eval clause is MUST, with that assertion (recommended).

## Decisions (owner, 2026-11-25)

The owner approved this plan in an interactive session on 2026-11-25 and answered every open question. The answers:

1. Names: entries cite concrete generic file and helper names, even when the `index.md` names table lacks them. `index.md` is not edited. The PR lists every name introduced, under "Names for the index.md follow-up". This replaces the recommended "describe by role".
2. ACCESS-012: keep the constant-time secret compare and the 404 when the secret is unset, in neutral wording.
3. ACCESS-014: the Check line names the `next.config` headers guard row, with the portable assertions of ACCESS-011.
4. ACCESS-010: SHOULD, with no Why line, written only from its Decision note.
5. ACCESS-009: generic wording in the rule and the check; the `fetch` and axios options and the Sanctum names go in one example inside the Why.
6. ACCESS-015: the principle as decision 8 gives it.
7. ACCESS-011: MUST for the script-eval clause, with a guard assertion on the enforced policy. Review answer 1 below makes it a strict MUST NOT.

Rules for every rule issue, set the same day:

- Every entry gets a neutral one-line Why, except ACCESS-010. The PR lists every Why written fresh.
- A Source line is `- Source: <title> <URL>` or `- Source: <title> vault: Content/<path>.md`, with no quote. A lesson's point goes into the Why.
- A source is live only if its codyssey.dev page title is not "Coming <date>". A source that is not live cites its vault path, checked at write time.
- The issue's acceptance greps decide what counts as a Codyssey name. `vault: Content/` paths may carry the course name.
- Other rules are cited by pack id from the id map only.
- ACCESS-006 ends with **MUST NOT.** The storage-key placeholder is `<app>_`, shared with #90. The readings above on A8, A1, A13's source and HSTS stand.

## Review answers (owner, 2026-11-25 and 2026-11-26)

The owner answered the rule-wording findings of the independent review on 2026-11-25 and 2026-11-26:

1. ACCESS-011: no `'unsafe-eval'` in the enforced policy is a strict MUST NOT. The guard assertion stays.
2. ACCESS-007: the Why states its point in plain terms, so it does not repeat the sentence of the CQS lesson nearly word for word.
3. ACCESS-007: "a client guard runs after the HTML is served" stays as written.
4. The intro sentence about Check lines matches the entry format of `index.md`: a `Check:` line names the guard-test row, the lint rule, or the sheet's check idea for a rule, where one exists. This issue changes it in `access-and-security.md` only; each other rule file is its own issue.

Owner answers of 2026-11-26 on the rule wording:

5. ACCESS-011: no `'unsafe-eval'` in the enforced policy is a strict MUST NOT, stated as a plain rule.
6. ACCESS-011: a Report-Only policy only reports and never allows a script, so a vendor script that needs `eval` stays blocked by the enforced policy. A Report-Only policy may be used only to trial dropping a script's need for `eval` and to collect the reports.
7. ACCESS-011 Check line: the guard asserts that the enforced policy's `script-src` and `default-src` have no `'unsafe-eval'`, that `img-src` includes `https:` and has no `http:`, and that `upgrade-insecure-requests` is set.
8. ACCESS-010: content access is decided by the API response; the client never infers it from an HTTP status or from client state.
