---
paths:
  - 'src/lib/**'
  - 'src/providers/**'
  - 'src/features/**/services/**'
  - 'app/layout.tsx'
  - 'app/**/route.ts'
  - 'next.config.*'
---

# Access, Security and Privacy

Redirects and URLs from the API, the auth session and route guards, gated content,
security headers, scripts and secrets in the page, and consent and privacy.

Severity: each entry ends with its keyword. **MUST** and **MUST NOT** are absolute.
**SHOULD** and **SHOULD NOT** hold unless there is a concrete reason not to, and the
reason is stated. **MAY** is optional. A `Check:` line names the guard-test row, the lint
rule, or the sheet's check idea for a rule, where one exists.

## Redirects and URLs

- **ACCESS-001. One helper decides every redirect target.** `toSameOriginPath` in `src/lib/navigation.ts` parses the value with `new URL(value, origin)`, requires the same origin, and rejects backslash and control characters. `safeRedirect` and every other redirect go through it: no second validator and no `startsWith('/')` check. A value that already went through `toSameOriginPath` is not parsed again with `split('?')[0].split('#')[0]`; `toSameOriginParts` returns `{ pathname, search, hash }` for a caller that needs the parts. **MUST.**
  - Why: browsers read `/\attacker.example` and `/<TAB>/attacker.example` as `https://attacker.example/`, so a prefix check lets an open redirect through.
  - From: A1
- **ACCESS-002. Build every `?redirect=` value with `encodeURIComponent`.** The route guard hook does it (ACCESS-007). A path segment that comes from user input, such as an invitation code, is encoded before it goes into the path. A value built from a constant path needs nothing more. **SHOULD.**
  - Why: an unencoded `&`, `?` or `#` in the value ends the parameter early, so the page after sign-in gets a different target than the one built.
  - From: A2
- **ACCESS-003. A URL from the API is scheme-checked before it goes into `href`, `window.open` or `location`.** `safeExternalUrl` in `src/lib/safeExternalUrl.ts` returns the URL or `null`, and allows `http` and `https`, plus `mailto` where a mail link is meant. `null` renders no link. **SHOULD.**
  - Why: escaping text does not check a URL's scheme, so a `javascript:` URL passes through it. React 19 blocks a `javascript:` URL in an `<a href>`, but not in an assignment to `window.location.href`.
  - Source: The Injection Bugs Your Blade Templates Are Hiding vault: Content/Insights/The Injection Bugs Your Blade Templates Are Hiding.md
  - From: A8 (core part)
- **ACCESS-004. Read a token from the URL once, then remove it from the address bar.** One shared hook, `useScrubbedSearchParams` in `src/lib/useScrubbedSearchParams.ts`, reads the query value, keeps it in memory, and removes it from the address bar with `history.replaceState`. **SHOULD.**
  - Why: a token left in the address bar ends up in the browser history and in any link the visitor copies, so the page removes it as soon as it has read it.
  - From: A9 (core part)

## Auth session and route guards

- **ACCESS-005. One module owns the browser auth flag.** `src/lib/authSession.ts` owns the `<app>_auth` key and reads and writes it through the helpers in `src/lib/browserStorage.ts`: a try/catch around storage, a key constant, and a parse to `unknown` with a type guard. The key is not versioned, because renaming it signs every member out; the other keys are short-lived hints. The flag is a hint for UI and cache keys, never proof of a session. **SHOULD.**
  - Why: the cookie session is the authority and the flag only a hint; storage calls throw when storage is blocked, and one module makes the key and its shape testable.
  - Source: Authentication Across the Boundary vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/40 - Authentication Across the Boundary.md
  - From: A3
- **ACCESS-006. No session token or credential in browser storage.** The app does not store a session token, bearer token or credential in `localStorage`, `sessionStorage` or any script-readable cookie. The session stays in an HttpOnly cookie, and storage holds at most a hint flag (ACCESS-005). **MUST NOT.**
  - Why: any script that runs on the page can read storage and script-readable cookies, so one injected script can carry a stored token off. An HttpOnly cookie is out of its reach.
  - Check: grep `setItem` call sites against an allowlist of keys (consent, hint flag, UTM); fail on a key or value named token, jwt, bearer, secret or password.
  - Source: Authentication Across the Boundary vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/40 - Authentication Across the Boundary.md
  - From: NX-02
- **ACCESS-007. Client route guards are UX only; the API enforces access.** A client guard runs after the HTML is served, so no member data may be in prerendered HTML. One guard hook, `src/providers/useRequireAuth.ts`, redirects a signed-out visitor to `/sign-in?redirect=<encoded>` (ACCESS-002), and every guarded component uses it. **SHOULD.**
  - Why: the visitor controls the browser and can skip any check that runs there, so only the API can refuse a request. Copies of the same redirect logic drift: a fix that lands in one copy misses the others.
  - Source: Command-Query Separation (CQS) https://codyssey.dev/courses/building-maintainable-php-applications-patterns-and-principles/command-query-separation
  - From: A4
- **ACCESS-008. Sign-out, sign-in and session expiry remove every `<app>_*` key except a short keep-list.** `removeMemberStorage()` in `src/lib/memberStorage.ts` walks `localStorage` and `sessionStorage`, removes each key that starts with `<app>_` and is not on the keep-list `BROWSER_OWNED_STORAGE_KEYS`, and leaves other keys alone. The keep-list holds the keys that belong to the browser, not the member, such as the visitor's consent choice. A new key that holds member data is covered without being listed; a new browser-owned key joins the keep-list with a written reason. Sign-out, sign-in and expiry do not call `localStorage.clear()` or `sessionStorage.clear()` outside tests, and they do not try to expire `HttpOnly` cookies from script. Anything written as part of sign-out, sign-in or expiry (a toast flash, a session-expired notice, the signed-in flag) is written after the removal. **SHOULD.**
  - Why: sign-out clears the member's stored data along with the flag. A blanket clear deletes keys other modules own, and a remove-list misses each new member key, such as a draft a new feature saves, so the list names what to keep and everything else goes.
  - Source: Authentication Across the Boundary vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/40 - Authentication Across the Boundary.md
  - From: A16
- **ACCESS-009. One API client sends credentials and the CSRF header, and replays once after a CSRF failure.** `src/lib/apiClient.ts` sends the browser's cookies with every request and copies the API's CSRF cookie into the API's CSRF header on every request. After a CSRF failure it fetches a fresh CSRF cookie once and replays the request. A per-request flag guards the replay, so a second failure rejects. **MUST.**
  - Why: the API's cookie session needs the cookie and the CSRF header on every call, and the CSRF cookie can expire while the session lives. One replay recovers; the flag stops a loop. The CSRF token is not a session credential: script reads it on purpose, and on its own it signs no one in (ACCESS-006 keeps the session cookie out of script's reach). Example, Laravel Sanctum: the client copies the `XSRF-TOKEN` cookie into the `X-XSRF-TOKEN` header, and a CSRF failure answers 419. With `fetch` the client passes `credentials: 'include'`; with axios it sets `withCredentials: true`.
  - Check: a unit test of the client: a request carries the CSRF header when the cookie exists; a mocked CSRF failure triggers exactly one CSRF-cookie request and one replay; a second failure rejects. A grep finds the credentials option in the one client file.
  - Source: Authentication Across the Boundary vault: Content/Courses/Building Codyssey/08 - The Decoupled Frontend/40 - Authentication Across the Boundary.md
  - From: NX-01

## Gated content

- **ACCESS-010. The client never turns an HTTP error status into an access decision; the API's response flags decide.** **SHOULD.**
  - From: Layer calls tab (written fresh)

## Headers, scripts and secrets

- **ACCESS-011. A new third-party script, frame or connect origin goes into the CSP in `next.config.*` in the same change.** The policy keeps one `connect-src` entry per vendor. Three parts are absolute, and the guard checks them: the enforced policy never contains `'unsafe-eval'`, `img-src` allows `https:` and not `http:`, and `upgrade-insecure-requests` is set. `'unsafe-eval'` has no exception: a vendor that needs it goes in the Report-Only policy, not the enforced one. Do not add an empty `catch` to the `headers()` code of `next.config.*`: the scan of DATA-049 covers only `src/` and `app/`. **SHOULD; MUST NOT for `'unsafe-eval'` in the enforced policy; MUST for the other two guarded parts.**
  - Why: a nonce-based CSP needs a header per request, and a static page is built when no request exists, so the policy lists origins instead.
  - Check: the `next.config` headers guard, ACCESS-011 row: string assertions that the enforced `script-src` has no `'unsafe-eval'`, `img-src` has no `http:`, and `upgrade-insecure-requests` is set.
  - From: A10 (core part)
- **ACCESS-012. A route handler that purges a cache or changes data checks its caller first.** Such a handler under `app/**/route.ts` calls the shared check `isAuthorizedPurge(request, secret)` in `src/lib/routeAuth.ts` before it acts. The check compares a shared secret from the request with a constant-time compare, and the handler answers 404 when the secret is not configured. Every such handler uses the one check. **SHOULD.**
  - Why: a route handler is a public URL that anyone can call; a constant-time compare gives nothing away through response timing, and a 404 keeps a handler with no secret shut without confirming that it exists.
  - From: A11 (core part)
- **ACCESS-013. A password is never copied outside the form.** A password or its confirmation is held only in React Hook Form's state or a local variable. It does not go into a store, a query cache, the URL or a log, and the code does not mirror it on every keystroke. A store that must hold one clears it on success, failure and unmount. **SHOULD.**
  - Why: every copy of a password is one more place it can leak from: a store or a cache outlives the form, and a URL or a log line is kept and shared.
  - From: A12
- **ACCESS-014. Every third-party script has a recorded integrity decision.** One record, `docs/architecture/third-party-origins.md`, lists each external script origin, says why it carries no `integrity` attribute (for example, the vendor changes the file in place), and names who owns its CSP entry. A new script origin joins the record in the same change as the CSP (ACCESS-011). **SHOULD.**
  - Why: a script served from another origin can change without notice, so each origin is a reviewed decision with a named owner.
  - Check: the `next.config` headers guard, ACCESS-014 row: the same portable string assertions as ACCESS-011.
  - Source: OWASP ASVS 5.0, requirement 3.6.1 https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x12-V3-Web-Frontend-Security.md
  - From: A13 (core part)

## Consent and privacy

- **ACCESS-015. Optional tracking and storage run only after consent, through one module.** Anything that records a visitor beyond what sign-in, security and payment need (a session replay, a campaign or attribution value, an analytics script that sets storage or cookies, a heatmap, any optional browser storage key) starts only from one consent module, after the visitor grants it. A third-party origin also follows ACCESS-011 and DATA-061. **MUST.**
  - Why: optional tracking needs the visitor's consent first, and with one module as the only place that starts it, a new tracker cannot skip the check.
  - From: A14 (core part)

## What is NOT a violation

- A constant literal path in a `?redirect=` value, such as `/dashboard`: ACCESS-002 covers values built from user or token input.
- A client guard that checks the auth state and also relies on the API answering 401: the guard is UX (ACCESS-007).
- Tests that call `localStorage.clear()` or `sessionStorage.clear()` (ACCESS-008).
