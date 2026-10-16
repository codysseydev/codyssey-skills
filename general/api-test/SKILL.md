---
name: api-test
description: >-
  Manually call a local Laravel API over curl: sign up or sign in a test user,
  hit an authenticated endpoint, or debug a "CSRF token mismatch" or an
  unexpected 401 against a Sanctum SPA (cookie) or token-authenticated API.
  Use when the user asks to poke, curl, or manually test an endpoint. Not for
  writing PHPUnit or Pest tests, and not for staging or production APIs.
---

# Manual API testing with curl

You are calling a Laravel API by hand against the local environment. First find out
how the API authenticates, then follow the matching section.

## Step 0: Learn the app

Read these before the first request:

- `config/sanctum.php` and `.env` for `SANCTUM_STATEFUL_DOMAINS`. A frontend host listed
  there means the API uses **Sanctum SPA mode**: a session cookie plus a CSRF token.
- `bootstrap/app.php` for `$middleware->statefulApi()`, which SPA mode needs on the
  `api` route group.
- `routes/api.php` (or `php artisan route:list --path=api`) for the sign-up, sign-in,
  sign-out and target routes, and the middleware on each one (`auth:sanctum`,
  `auth:api`, `verified`).
- `APP_URL` in `.env` for the API host.

Set these once per shell. Replace the values with what you found:

```bash
API_URL="http://localhost:8000"        # the app's APP_URL
FRONTEND_URL="http://localhost:3000"   # a host listed in SANCTUM_STATEFUL_DOMAINS
COOKIE_JAR="$(mktemp)"
```

If the app runs behind a reverse proxy that routes by hostname (Traefik, Valet, Herd),
`localhost` returns 404. Use the hostname the proxy expects.

If the project runs PHP in Docker, run the `php artisan` commands below through its
wrapper, for example `./vendor/bin/sail artisan ...` or
`docker compose exec app php artisan ...`.

## Use curl, not HTTPie

The SPA flow needs the raw `XSRF-TOKEN` cookie value, URL-decoded, sent back as a
header. HTTPie's session handling makes that awkward and its errors look like CSRF
bugs in the app. Use curl with a cookie jar.

## Sanctum SPA mode (session cookie)

Two checks decide whether a request is treated as a logged-in browser session:

- **Stateful detection.** Sanctum's `EnsureFrontendRequestsAreStateful::fromFrontend()`
  reads the `Referer` header (or `Origin` when `Referer` is missing) and matches it
  against `sanctum.stateful`. Without a matching `Referer`, the request gets no
  session, and an authenticated route returns 401 even right after a successful
  sign-in.
- **CSRF.** Laravel 13's `PreventRequestForgery` middleware skips GET, HEAD and
  OPTIONS. For POST, PUT, PATCH and DELETE it compares the session token with the
  `X-XSRF-TOKEN` header, which it decrypts. The cookie jar stores the cookie value
  URL-encoded (`%3D` for `=`), so it has to be decoded before it goes in the header.

### 1. Start with a clean jar and get the CSRF cookie

```bash
rm -f "$COOKIE_JAR"

curl --silent --cookie-jar "$COOKIE_JAR" --cookie "$COOKIE_JAR" \
  --header "Accept: application/json" \
  --header "Referer: $FRONTEND_URL" \
  --write-out "HTTP %{http_code}\n" \
  "$API_URL/sanctum/csrf-cookie"
```

Expect `HTTP 204`.

### 2. Read the token before every write request

The token can rotate on any response, so read it again before each POST, PUT, PATCH
or DELETE:

```bash
XSRF_TOKEN=$(grep XSRF-TOKEN "$COOKIE_JAR" | awk '{print $NF}' \
  | python3 -c "import sys, urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))")
[ -n "$XSRF_TOKEN" ] || echo "No XSRF-TOKEN cookie: check the Referer, SANCTUM_STATEFUL_DOMAINS, and origin-only CSRF"
```

### 3. Sign up or sign in

Use the routes and field names from `routes/api.php` and the form request. A typical
sign-in:

```bash
curl --silent --cookie-jar "$COOKIE_JAR" --cookie "$COOKIE_JAR" \
  --request POST "$API_URL/login" \
  --header "Accept: application/json" \
  --header "Content-Type: application/json" \
  --header "Referer: $FRONTEND_URL" \
  --header "X-XSRF-TOKEN: $XSRF_TOKEN" \
  --data '{"email":"tester@example.com","password":"<test-password>"}'
```

Sign-in regenerates the session and its CSRF token, so run step 2 again before the next
write request.

### 4. Call authenticated endpoints

Every request carries the jar, `Accept: application/json` and the `Referer`. Write
requests also carry the token:

```bash
curl --silent --cookie-jar "$COOKIE_JAR" --cookie "$COOKIE_JAR" \
  --request PUT "$API_URL/api/profile" \
  --header "Accept: application/json" \
  --header "Content-Type: application/json" \
  --header "Referer: $FRONTEND_URL" \
  --header "X-XSRF-TOKEN: $XSRF_TOKEN" \
  --data '{"name":"Ada Lovelace"}'
```

Without `Accept: application/json`, a validation or auth failure returns a redirect
instead of a JSON error.

### If the app uses origin-only CSRF

An app configured with `$middleware->preventRequestForgery(originOnly: true)` in
`bootstrap/app.php` (or `PreventRequestForgery::useOriginOnly()`) ignores the token. It
rejects any write request whose `Sec-Fetch-Site` header is not `same-origin` (or
`same-site`, when `allowSameSite` is on) with "Origin mismatch". Browsers set that
header and curl does not. The rejection is HTTP 403, and in this mode the app stops
setting the `XSRF-TOKEN` cookie, so the token steps above do not apply. For local
testing, add `--header "Sec-Fetch-Site: same-origin"` to write requests. Check
`bootstrap/app.php` before debugging a token that looks correct.

## Token mode (`Authorization: Bearer`)

APIs that use Sanctum personal access tokens or Passport need no cookies, no CSRF and
no `Referer`. Get a token from the app's token endpoint, or mint one for a local test
user:

```bash
php artisan tinker --execute='echo App\Models\User::where("email", "tester@example.com")->firstOrFail()->createToken("api-test")->plainTextToken;'
```

Then send it on every request:

```bash
API_TOKEN="<token from the command above>"

curl --silent "$API_URL/api/profile" \
  --header "Accept: application/json" \
  --header "Authorization: Bearer $API_TOKEN"
```

Adjust the `User` model's namespace to the project's. The user must exist and the
model needs the `Laravel\Sanctum\HasApiTokens` trait. Send the whole output,
including the `1|` prefix.

## Verified-email routes

Routes behind the `verified` middleware return 403 for a new, unverified user. Mark a
local test user as verified (the model must implement `MustVerifyEmail`):

```bash
php artisan tinker --execute='App\Models\User::where("email", "tester@example.com")->firstOrFail()->markEmailAsVerified();'
```

## Reading responses

Pipe a response through `python3 -m json.tool` (or `jq .`) to pretty-print it. Add
`--write-out "HTTP %{http_code}\n"` when the status code matters, and
`--include` to see response headers such as `Set-Cookie`.

## When it fails

| Symptom | Likely cause |
|---|---|
| 419 "CSRF token mismatch" | Token not URL-decoded, read before sign-in instead of after, or missing on a write request |
| 403 "Origin mismatch" on a write request | The app uses origin-only CSRF (see above) |
| 401 right after a 200 sign-in | `Referer` missing or not in `SANCTUM_STATEFUL_DOMAINS`, or `statefulApi()` missing in `bootstrap/app.php`, so the request got no session |
| 404 on every route | Wrong host; a hostname-routing proxy is in front of the app |
| 302 instead of a JSON error | `Accept: application/json` missing |
| 403 on a route that should work | `verified` middleware and an unverified user, or a policy denying the action |

## Rules

1. Use curl with `--cookie-jar` and `--cookie` on every SPA-mode call.
2. Send `Referer: $FRONTEND_URL` on every SPA-mode request.
3. Read and URL-decode `XSRF-TOKEN` before every write request.
4. Send `Accept: application/json` on every request.
5. Use test users and local data only. Never point this at staging or production.
