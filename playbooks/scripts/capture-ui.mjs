// UI evidence for the factory: detect UI changes, capture screenshots, compose before/after
// images and write the markdown fragment the run merges into the issue comment or the PR body.
//
// Usage:
//   node capture-ui.mjs detect   --files <path|-> [--glob <pattern> ...] [--project <dir>] [--config <path>]
//   node capture-ui.mjs capture  --repo <owner/name> --issue <n> [--attempt <n>] --phase before|after|mockup
//                                --route <path> [--route ...] --project <dir> [--base-url <url>]
//                                [--phone] [--sign-in] [--mask <css> ...] [--ignore-request <substring> ...]
//                                [--caption <text> ...] [--config <path>]
//   node capture-ui.mjs compose  --repo <owner/name> --issue <n> [--attempt <n>] --project <dir>
//   node capture-ui.mjs markdown --repo <owner/name> --issue <n> [--attempt <n>] --for plan|pr
//
// Project specifics (base URL, sign-in form, consent button, masks, globs) live in the optional
// `.factory/ui-capture.json`, read with `git -C <project> show origin/main:.factory/ui-capture.json`;
// `--config <path>` reads a file instead. See CONFIG_KEYS below. Without the file there is no
// sign-in, no masks, no consent click, and detect uses the Next.js default globs.
//
// Evidence lives in $FACTORY_HOME/evidence/<owner>-<name>-<issue>-a<attempt>/ (FACTORY_HOME defaults
// to ~/.factory): before/, after/, mockup/, compare/, auth/state.json and manifest.json.
// Playwright is loaded from the project's own node_modules, never from this script's folder.
// detect, capture and compose print one JSON object, markdown prints text. Capture and compose
// record every failure as `not-exercised` and still exit 0. Exit 1 when markdown refuses or on an
// unexpected error (for example a corrupt manifest), 2 on bad usage.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync, closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_UI_GLOBS = [
  'app/**/page.tsx',
  'app/**/layout.tsx',
  'app/**/*.css',
  'src/features/**/*.tsx',
  'src/**/*.css',
  'public/**',
];
export const UI_EXCLUDES = ['**/*.test.*', '**/*.stories.*'];

export const ANIMATION_CSS = '*,*::before,*::after{animation:none!important;transition:none!important}';
export const MAX_SCREENS = 3;
export const TRUNCATED_CAPTION_SUFFIX = ' (first 3 screens)';
export const DESKTOP = { name: 'desktop', width: 1728, height: 997 };
export const PHONE = { name: 'phone', width: 393, height: 852 };
export const MOCKUP_CAPTION = 'Mockup, not implemented';
export const FILE_RE = /^(before|after|mockup|compare)\/[a-z0-9-]+\.png$/;
const NAV_TIMEOUT_MS = 180_000;
const IDLE_TIMEOUT_MS = 3_000;
const SUBMIT_ENABLED_TIMEOUT_MS = 15_000;
const IMAGES_TIMEOUT_MS = 30_000;
const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_MS = 10_000;

export const USAGE = `usage:
  capture-ui.mjs detect   --files <path|-> [--glob <pattern> ...] [--project <dir>] [--config <path>]
  capture-ui.mjs capture  --repo <owner/name> --issue <n> [--attempt <n>] --phase before|after|mockup --route <path> [--route ...] --project <dir> [--base-url <url>] [--phone] [--sign-in] [--mask <css> ...] [--ignore-request <substring> ...] [--caption <text> ...] [--config <path>]
  capture-ui.mjs compose  --repo <owner/name> --issue <n> [--attempt <n>] --project <dir>
  capture-ui.mjs markdown --repo <owner/name> --issue <n> [--attempt <n>] --for plan|pr
detect: build the file list with: git -c core.quotepath=false diff --name-only <base>...HEAD
config: .factory/ui-capture.json (read from origin/main) or --config <path>; keys: base_url, sign_in, consent_button, hide_css, masks, globs, ignore_requests, phone
example base url: http://codyssey.test:3000`;

export class UsageError extends Error {}
export class RefusalError extends Error {}

// ---------- config ----------

const SIGN_IN_KEYS = ['path', 'email_selector', 'password_selector', 'submit_selector', 'signed_in', 'env_email', 'env_password'];
const SIGN_IN_OPTIONAL_KEYS = ['signed_in_phone', 'open'];
export const CONFIG_KEYS = ['base_url', 'sign_in', 'consent_button', 'hide_css', 'masks', 'globs', 'ignore_requests', 'phone'];

const isStringArray = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x);
const ENV_NAME_RE = /^FACTORY_TEST_[A-Z0-9_]+$/;
export const isSafePath = (v) => typeof v === 'string' && v.startsWith('/') && !/^\/[\\/]/.test(v) && !/[\u0000-\u001f\u007f]/.test(v);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function parseBaseUrl(value, what = '--base-url') {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new UsageError(`bad ${what}: ${value}`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new UsageError(`${what} must be http or https: ${value}`);
  return value;
}

export function parseConfig(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new UsageError(`ui-capture.json is not valid JSON: ${errorText(e)}`);
  }
  if (!isObject(raw)) throw new UsageError('ui-capture.json must be a JSON object');
  const bad = (msg) => {
    throw new UsageError(`ui-capture.json: ${msg}`);
  };
  for (const k of Object.keys(raw)) if (!CONFIG_KEYS.includes(k)) bad(`unknown key ${k}`);
  const cfg = {};
  if (raw.base_url !== undefined) {
    if (typeof raw.base_url !== 'string') bad('base_url must be a string');
    cfg.base_url = parseBaseUrl(raw.base_url, 'base_url');
  }
  if (raw.consent_button !== undefined) {
    if (typeof raw.consent_button !== 'string' || !raw.consent_button) bad('consent_button must be a non-empty string');
    cfg.consent_button = raw.consent_button;
  }
  if (raw.phone !== undefined) {
    if (typeof raw.phone !== 'boolean') bad('phone must be a boolean');
    cfg.phone = raw.phone;
  }
  for (const k of ['hide_css', 'masks', 'globs', 'ignore_requests']) {
    if (raw[k] === undefined) continue;
    if (!isStringArray(raw[k])) bad(`${k} must be an array of non-empty strings`);
    cfg[k] = raw[k];
  }
  if (raw.sign_in !== undefined) {
    const s = raw.sign_in;
    if (!isObject(s)) bad('sign_in must be an object');
    for (const k of Object.keys(s)) if (!SIGN_IN_KEYS.includes(k) && !SIGN_IN_OPTIONAL_KEYS.includes(k)) bad(`unknown key sign_in.${k}`);
    for (const k of SIGN_IN_KEYS) {
      if (s[k] === undefined) bad(`sign_in.${k} is required`);
      if (k === 'signed_in') continue;
      if (typeof s[k] !== 'string' || !s[k]) bad(`sign_in.${k} must be a non-empty string`);
    }
    if (!isSafePath(s.path)) bad('sign_in.path must start with a single / and hold no control characters');
    for (const k of ['env_email', 'env_password']) {
      if (!ENV_NAME_RE.test(s[k])) bad(`sign_in.${k} must match ${ENV_NAME_RE}`);
    }
    const validProof = (si) => (typeof si === 'string' && si.length > 0)
      || (isObject(si) && Object.keys(si).sort().join() === 'name,role' && typeof si.role === 'string' && typeof si.name === 'string' && si.role && si.name);
    if (!validProof(s.signed_in)) bad('sign_in.signed_in must be a selector string or {role, name}');
    if (s.signed_in_phone !== undefined && !validProof(s.signed_in_phone)) bad('sign_in.signed_in_phone must be a selector string or {role, name}');
    if (s.open !== undefined && (typeof s.open !== 'string' || !s.open)) bad('sign_in.open must be a non-empty button name');
    cfg.sign_in = s;
  }
  return cfg;
}

export function loadConfig(d, { project, config }) {
  if (!project && !config) return {};
  const text = d.readConfigText(project, config);
  return text === undefined ? {} : parseConfig(text);
}

// ---------- pure logic ----------

export function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export const matchesAny = (path, globs) => globs.some((g) => globToRegex(g).test(path));

export function deriveRoute(file) {
  const m = /^app\/(?:(.*)\/)?page\.tsx$/.exec(file);
  if (!m) return undefined;
  const segments = (m[1] ?? '').split('/').filter((s) => s && !/^\(.*\)$/.test(s));
  return `/${segments.join('/')}`;
}

export function detect(files, globs = DEFAULT_UI_GLOBS) {
  const matched = files
    .map((f) => f.trim().replace(/^\.\//, ''))
    .filter(Boolean)
    .filter((f) => matchesAny(f, globs) && !matchesAny(f, UI_EXCLUDES));
  const routes = [...new Set(matched.map(deriveRoute).filter(Boolean))].sort();
  const out = { ui: matched.length > 0, matched, routes };
  if (out.ui && !routes.length) out.note = 'no page routes matched; choose routes from the plan';
  return out;
}

export function isLocalHost(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.test');
}

export function slugify(route) {
  if (route === '/') return 'home';
  return route.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'home';
}

export const fileSlug = (route) => `${slugify(route)}-${createHash('sha1').update(route).digest('hex').slice(0, 6)}`;

export function evidenceDir(env, repo, issue, attempt) {
  const home = env.FACTORY_HOME || join(homedir(), '.factory');
  return join(home, 'evidence', `${repo.replace('/', '-')}-${issue}-a${attempt}`);
}

const entryKey = (e) => `${e.phase}|${e.route}|${e.viewport.name}`;
const pairKey = (e) => `${e.route}|${e.viewport.name}`;

export function upsertEntries(entries, fresh) {
  const out = [...entries];
  for (const e of fresh) {
    const at = out.findIndex((x) => entryKey(x) === entryKey(e));
    if (at >= 0) out[at] = e;
    else out.push(e);
  }
  return out;
}

export function parseEnvFile(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(raw);
    if (!m || raw.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  return out;
}

export function readCredentials(env, project, names) {
  let file = {};
  try {
    file = parseEnvFile(readFileSync(join(project, '.env'), 'utf8'));
  } catch {
    /* no .env */
  }
  const email = env[names.email] || file[names.email];
  const password = env[names.password] || file[names.password];
  return email && password ? { email, password } : undefined;
}

function errorText(e) {
  return String(e?.message ?? e).split('\n')[0].slice(0, 200);
}
const sha7 = (sha) => (sha ? String(sha).slice(0, 7) : 'unknown');

// ---------- boundary (git, Playwright, stdin, clock) ----------

export function makeDeps(env = process.env) {
  const git = (project, ...args) => execFileSync('git', ['-C', project, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  return {
    env,
    now: () => Date.now(),
    loadPlaywright: async (project) => createRequire(join(project, 'package.json'))('playwright'),
    gitInfo(project) {
      try {
        const sha = git(project, 'rev-parse', 'HEAD');
        const branch = git(project, 'rev-parse', '--abbrev-ref', 'HEAD');
        let ref = 'HEAD';
        let baseSha = sha;
        const candidates = [];
        try {
          candidates.push(git(project, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'));
        } catch {
          /* origin/HEAD not set */
        }
        candidates.push('origin/main');
        for (const c of candidates) {
          try {
            baseSha = git(project, 'merge-base', 'HEAD', c);
            ref = c;
            break;
          } catch {
            /* try the next ref */
          }
        }
        return { sha, branch, base_sha: baseSha, base_ref: ref };
      } catch {
        return { sha: null, branch: null, base_sha: null, base_ref: null };
      }
    },
    readStdin: () => readFileSync(0, 'utf8'),
    // True only when GitHub says the repo is private. Throws when the check fails.
    repoIsPrivate(repo) {
      const out = execFileSync('gh', ['repo', 'view', repo, '--json', 'isPrivate'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 });
      return JSON.parse(out).isPrivate === true;
    },
    readConfigText(project, configPath) {
      if (configPath) {
        try {
          return readFileSync(configPath, 'utf8');
        } catch (e) {
          throw new UsageError(`cannot read --config ${configPath}: ${e.code ?? errorText(e)}`);
        }
      }
      try {
        return git(project, 'show', 'origin/main:.factory/ui-capture.json');
      } catch {
        return undefined;
      }
    },
  };
}

// ---------- manifest ----------

const manifestPath = (dir) => join(dir, 'manifest.json');
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function readManifest(dir) {
  let text;
  try {
    text = readFileSync(manifestPath(dir), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    value = undefined;
  }
  if (!Array.isArray(value)) throw new Error(`manifest is corrupt: ${manifestPath(dir)}`);
  return value;
}

// Read-modify-write under an O_EXCL lockfile; the new manifest lands through a tmp file and a rename.
export function withManifest(dir, fn, { staleMs = LOCK_STALE_MS, waitMs = LOCK_WAIT_MS } = {}) {
  mkdirSync(dir, { recursive: true });
  const lock = join(dir, 'manifest.lock');
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      closeSync(openSync(lock, 'wx'));
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        if (Date.now() - statSync(lock).mtimeMs > staleMs) {
          rmSync(lock, { force: true });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) throw new Error(`manifest is locked: ${lock}`);
      sleepSync(25);
    }
  }
  try {
    const next = fn(readManifest(dir));
    const tmp = `${manifestPath(dir)}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
    renameSync(tmp, manifestPath(dir));
    return next;
  } finally {
    rmSync(lock, { force: true });
  }
}

export const saveEntries = (dir, fresh, opts) => withManifest(dir, (m) => upsertEntries(m, fresh), opts);

function entryUrl(route, baseUrl) {
  try {
    return new URL(route, baseUrl).href;
  } catch {
    return route;
  }
}

function makeEntry(d, o, git, shot, extra = {}) {
  return {
    phase: o.phase,
    route: shot.route,
    url: entryUrl(shot.route, o.baseUrl),
    viewport: { ...shot.viewport },
    file: null,
    caption: shot.caption,
    sha: git.sha,
    branch: git.branch,
    console_errors: { count: 0, first: [] },
    failed_requests: { count: 0, first: [] },
    ignored: { console_errors: { count: 0, first: [] }, failed_requests: { count: 0, first: [] } },
    truncated: false,
    result: 'not-exercised',
    captured_at: new Date(d.now()).toISOString(),
    ...(o.phase === 'before' ? { base_sha: git.base_sha ?? git.sha, base_ref: git.base_ref ?? null } : {}),
    ...extra,
  };
}

// ---------- detect ----------

export function cmdDetect(d, o) {
  const text = o.files === '-' ? d.readStdin() : readFileSync(o.files, 'utf8');
  const cfg = loadConfig(d, o);
  return detect(text.split(/\r?\n/), o.globs.length ? o.globs : cfg.globs ?? DEFAULT_UI_GLOBS);
}

// ---------- capture ----------

class StaleAuthError extends Error {}
class ProofMissingError extends StaleAuthError {}
const PROOF_TIMEOUT_MS = 10_000;

const unfilled = (route) => /\[[^\]]+\]/.test(route.split('?')[0]);
const requestKey = (url, status) => {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    /* keep the raw string */
  }
  return `${path}|${status}`;
};

// An error is new when the matching before entry did not have it: console errors compare by text,
// failed requests by URL path plus status. Without a usable before entry every error is new.
export function newErrors(raw, before) {
  const known = before && before.result !== 'not-exercised' && before.raw ? before.raw : { console: [], failed: [] };
  const consoleNew = raw.console.filter((t) => !known.console.includes(t));
  const failedNew = raw.failed.filter((k) => !known.failed.includes(k));
  return {
    new_errors: { console_errors: consoleNew.length, failed_requests: failedNew.length },
    pre_existing: raw.console.length + raw.failed.length - consoleNew.length - failedNew.length,
  };
}

// Never logs or returns the password: every failure collapses to undefined.
async function ensureAuth(ctx, browser) {
  const { d, o, cfg, dir } = ctx;
  const file = join(dir, 'auth', 'state.json');
  if (existsSync(file)) return file;
  const s = cfg.sign_in;
  const creds = readCredentials(d.env, o.project, { email: s.env_email, password: s.env_password });
  if (!creds) return undefined;
  let context;
  try {
    context = await browser.newContext({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });
    const page = await context.newPage();
    const base = new URL(o.baseUrl);
    const signInUrl = new URL(s.path, base);
    if (signInUrl.origin !== base.origin) return undefined;
    const onBase = () => isLocalHost(page.url()) && new URL(page.url()).origin === base.origin;
    await page.goto(signInUrl.href, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    if (!onBase()) return undefined;
    await page.fill(s.email_selector, creds.email);
    await page.fill(s.password_selector, creds.password);
    await page.waitForFunction(
      (sel) => {
        const b = document.querySelector(sel);
        return Boolean(b) && !b.disabled;
      },
      s.submit_selector,
      { timeout: SUBMIT_ENABLED_TIMEOUT_MS }
    );
    if (!onBase()) return undefined;
    await page.click(s.submit_selector);
    await page.waitForURL((u) => !onSignIn(cfg, String(u)), { timeout: NAV_TIMEOUT_MS });
    const proof = typeof s.signed_in === 'string' ? page.locator(s.signed_in) : page.getByRole(s.signed_in.role, { name: s.signed_in.name });
    await proof.waitFor({ state: 'visible', timeout: NAV_TIMEOUT_MS });
    const state = await context.storageState();
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(file, JSON.stringify(state), { mode: 0o600 });
    chmodSync(file, 0o600);
    return file;
  } catch {
    return undefined;
  } finally {
    await context?.close().catch(() => {});
  }
}

function onSignIn(cfg, url) {
  if (!cfg.sign_in) return false;
  try {
    return new URL(url).pathname.startsWith(cfg.sign_in.path);
  } catch {
    return false;
  }
}

async function dismissConsent(cfg, page) {
  if (!cfg.consent_button) return;
  try {
    const button = page.getByRole('button', { name: cfg.consent_button });
    if (await button.isVisible()) await button.click();
  } catch {
    /* no banner */
  }
}

async function shootOne(ctx, context, shot, before) {
  const { d, o, cfg, git, dir } = ctx;
  const page = await context.newPage();
  const collect = () => ({ consoleErrors: [], failed: [], ignoredConsole: [], ignoredFailed: [] });
  let cur = collect();
  const ignore = (...parts) => ctx.ignoreRequests.some((s) => parts.some((p) => String(p ?? '').includes(s)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    (ignore(text, m.location?.()?.url) ? cur.ignoredConsole : cur.consoleErrors).push(text);
  });
  page.on('pageerror', (err) => {
    const text = errorText(err);
    (ignore(text) ? cur.ignoredConsole : cur.consoleErrors).push(text);
  });
  const noteFailure = (url, status) => (ignore(url) ? cur.ignoredFailed : cur.failed).push({ url, status });
  page.on('response', (r) => {
    if (r.status() >= 400) noteFailure(r.url(), r.status());
  });
  page.on('requestfailed', (r) => noteFailure(r.url(), 0));
  try {
    const target = new URL(shot.route, o.baseUrl);
    if (target.origin !== new URL(o.baseUrl).origin) throw new Error('route resolves off-host');
    await page.goto(target.href, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    if (!isLocalHost(page.url())) throw new Error('redirected off-host');
    if (o.signIn && !onSignIn(cfg, target.href) && onSignIn(cfg, page.url())) throw new StaleAuthError();
    await page.evaluate(() => document.fonts.ready);
    const settle = async () => {
      await page.waitForLoadState('networkidle', { timeout: IDLE_TIMEOUT_MS }).catch(() => {});
      await dismissConsent(cfg, page);
      await page.addStyleTag({ content: ctx.css });
    };
    await settle();
    if (o.signIn && cfg.sign_in && !onSignIn(cfg, target.href)) {
      const phone = shot.viewport.name === PHONE.name;
      const si = (phone && cfg.sign_in.signed_in_phone) || cfg.sign_in.signed_in;
      const proof = typeof si === 'string' ? page.locator(si) : page.getByRole(si.role, { name: si.name });
      const opener = phone && cfg.sign_in.open;
      try {
        if (opener) await page.getByRole('button', { name: opener }).click({ timeout: PROOF_TIMEOUT_MS });
        await proof.first().waitFor({ state: 'visible', timeout: PROOF_TIMEOUT_MS });
      } catch {
        throw new ProofMissingError('signed-in state not confirmed');
      }
      if (opener) {
        await page.keyboard.press('Escape');
        await page.evaluate(() => document.activeElement?.blur?.());
        const closed = await page.getByRole('dialog').first().waitFor({ state: 'hidden', timeout: 3_000 }).then(() => true, () => false);
        if (!closed) {
          await page.reload({ waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
          await settle();
        }
      }
    }
    const height = Number(await page.evaluate(() => document.documentElement.scrollHeight));
    const cap = shot.viewport.height * MAX_SCREENS;
    const truncated = height > cap;
    const file = `${o.phase}/${fileSlug(shot.route)}-${shot.viewport.name}.png`;
    mkdirSync(join(dir, o.phase), { recursive: true });
    await page.screenshot({
      path: join(dir, file),
      fullPage: true,
      ...(truncated ? { clip: { x: 0, y: 0, width: shot.viewport.width, height: cap } } : {}),
      animations: 'disabled',
      scale: 'css',
      mask: ctx.masks.map((s) => page.locator(s)),
    });
    if (o.phase === 'before') {
      // The baseline is the union of both loads, so a request that fires only sometimes is in it.
      const first = cur;
      cur = collect();
      await page.reload({ waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
      await settle();
      const union = (a, b, key) => [...a, ...b.filter((x) => !a.some((y) => key(y) === key(x)))];
      const second = cur;
      cur = {
        consoleErrors: union(first.consoleErrors, second.consoleErrors, (t) => t),
        failed: union(first.failed, second.failed, (f) => requestKey(f.url, f.status)),
        ignoredConsole: union(first.ignoredConsole, second.ignoredConsole, (t) => t),
        ignoredFailed: union(first.ignoredFailed, second.ignoredFailed, (f) => `${f.url}|${f.status}`),
      };
    }
    const { consoleErrors, failed, ignoredConsole, ignoredFailed } = cur;
    const toRaw = (c) => ({ console: c.consoleErrors, failed: c.failed.map((f) => requestKey(f.url, f.status)) });
    const raw = toRaw(cur);
    let gate = o.phase === 'after' ? newErrors(raw, before) : undefined;
    let flaky;
    if (gate && gate.new_errors.console_errors + gate.new_errors.failed_requests > 0) {
      // An error is new only when both loads show it; one-load errors are flaky, not a failure.
      const known = before && before.result !== 'not-exercised' && before.raw ? before.raw : { console: [], failed: [] };
      const fresh = (r) => ({ console: r.console.filter((t) => !known.console.includes(t)), failed: r.failed.filter((k) => !known.failed.includes(k)) });
      const first = fresh(raw);
      cur = collect();
      await page.reload({ waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
      await settle();
      const second = fresh(toRaw(cur));
      const both = (a, b) => a.filter((x) => b.includes(x));
      const only = (a, b) => [...a.filter((x) => !b.includes(x)), ...b.filter((x) => !a.includes(x))];
      const newConsole = both(first.console, second.console);
      const newFailed = both(first.failed, second.failed);
      const flakyList = [...only(first.console, second.console), ...only(first.failed, second.failed)];
      gate = {
        new_errors: { console_errors: newConsole.length, failed_requests: newFailed.length },
        pre_existing: gate.pre_existing,
      };
      flaky = { count: flakyList.length, first: flakyList.slice(0, 3) };
    }
    const bad = gate ? gate.new_errors.console_errors + gate.new_errors.failed_requests : consoleErrors.length + failed.length;
    return makeEntry(d, o, git, shot, {
      file,
      truncated,
      console_errors: { count: consoleErrors.length, first: consoleErrors.slice(0, 3) },
      failed_requests: { count: failed.length, first: failed.slice(0, 3) },
      ignored: {
        console_errors: { count: ignoredConsole.length, first: ignoredConsole.slice(0, 3) },
        failed_requests: { count: ignoredFailed.length, first: ignoredFailed.slice(0, 3) },
      },
      raw,
      ...gate,
      ...(gate ? { flaky: flaky ?? { count: 0, first: [] } } : {}),
      result: bad ? 'fail' : 'pass',
    });
  } finally {
    await page.close().catch(() => {});
  }
}

export async function cmdCapture(d, o0) {
  const cfg = loadConfig(d, o0);
  const baseUrl = o0.baseUrl ?? cfg.base_url;
  if (!baseUrl) throw new UsageError('--base-url is required when ui-capture.json has no base_url');
  const o = { ...o0, baseUrl, phone: o0.phone || cfg.phone === true };
  const dir = evidenceDir(d.env, o.repo, o.issue, o.attempt);
  const git = d.gitInfo(o.project);
  const viewports = o.phone ? [DESKTOP, PHONE] : [DESKTOP];
  const allShots = [];
  o.routes.forEach((route, i) => {
    for (const viewport of viewports) {
      allShots.push({
        route,
        viewport,
        caption: o.captions[i] ?? (o.phase === 'mockup' ? MOCKUP_CAPTION : `${route} (${viewport.name})`),
      });
    }
  });
  const shots = allShots.filter((s) => !unfilled(s.route));
  const entries = allShots
    .filter((s) => unfilled(s.route))
    .map((s) => makeEntry(d, o, git, s, { reason: 'route has unfilled segment' }));
  const fillRest = (reason) => {
    for (const s of shots) {
      if (!entries.some((e) => e.route === s.route && e.viewport.name === s.viewport.name)) entries.push(makeEntry(d, o, git, s, { reason }));
    }
  };
  const ctx = {
    d, o, cfg, git, dir,
    masks: [...(cfg.masks ?? []), ...o.masks],
    ignoreRequests: [...(cfg.ignore_requests ?? []), ...o.ignoreRequests],
    css: [ANIMATION_CSS, ...(cfg.hide_css ?? [])].join('\n'),
  };
  const prior = readManifest(dir);
  const beforeFor = (shot) => prior.find((e) => e.phase === 'before' && e.route === shot.route && e.viewport.name === shot.viewport.name);
  const authFile = join(dir, 'auth', 'state.json');
  let browser;

  const runShots = async () => {
    if (!shots.length) return;
    if (!isLocalHost(o.baseUrl)) return fillRest('host not local');
    if (o.signIn && !cfg.sign_in) return fillRest('no sign-in config');
    let pw;
    try {
      pw = await d.loadPlaywright(o.project);
    } catch (e) {
      return fillRest(`playwright unavailable: ${errorText(e)}`);
    }
    try {
      browser = await pw.chromium.launch();
    } catch (e) {
      return fillRest(`browser launch failed: ${errorText(e)}`);
    }
    let storageState;
    let authFailed = '';
    if (o.signIn) {
      storageState = await ensureAuth(ctx, browser);
      if (!storageState) return fillRest('sign-in failed');
    }
    const openContext = (viewport) => browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
      ...(storageState ? { storageState } : {}),
    });
    for (const viewport of viewports) {
      const viewportShots = shots.filter((s) => s.viewport === viewport);
      let context;
      try {
        context = await openContext(viewport);
      } catch (e) {
        for (const s of viewportShots) entries.push(makeEntry(d, o, git, s, { reason: errorText(e) }));
        continue;
      }
      for (const shot of viewportShots) {
        if (authFailed) {
          entries.push(makeEntry(d, o, git, shot, { reason: authFailed }));
          continue;
        }
        const shoot = () => shootOne(ctx, context, shot, beforeFor(shot));
        try {
          entries.push(await shoot());
        } catch (e) {
          if (!(e instanceof StaleAuthError)) {
            entries.push(makeEntry(d, o, git, shot, { reason: errorText(e) }));
            continue;
          }
          rmSync(authFile, { force: true });
          storageState = await ensureAuth(ctx, browser);
          if (!storageState) {
            authFailed = 'sign-in failed';
            entries.push(makeEntry(d, o, git, shot, { reason: 'sign-in failed' }));
            continue;
          }
          await context.close().catch(() => {});
          try {
            context = await openContext(viewport);
            entries.push(await shoot());
          } catch (e2) {
            const reason = e2 instanceof ProofMissingError ? 'signed-in state not confirmed' : e2 instanceof StaleAuthError ? 'sign-in failed' : errorText(e2);
            if (e2 instanceof StaleAuthError) authFailed = reason;
            entries.push(makeEntry(d, o, git, shot, { reason }));
          }
        }
      }
      await context.close().catch(() => {});
    }
  };

  try {
    await runShots();
  } catch (e) {
    fillRest(errorText(e));
  } finally {
    await browser?.close().catch(() => {});
  }
  saveEntries(dir, entries);
  return {
    evidence_dir: dir,
    shots: entries.map((e) => ({ phase: e.phase, route: e.route, viewport: e.viewport.name, result: e.result, ...(e.reason ? { reason: e.reason } : {}) })),
  };
}

// ---------- compose ----------

const exercised = (e) => Boolean(e && e.result !== 'not-exercised' && e.file);

export function composePairs(entries, dir) {
  const pairs = [];
  const present = (e) => exercised(e) && (!dir || existsSync(join(dir, e.file)));
  for (const after of entries.filter((e) => e.phase === 'after')) {
    const before = entries.find((e) => e.phase === 'before' && pairKey(e) === pairKey(after));
    if (present(before) && present(after)) pairs.push({ before, after });
  }
  return pairs;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function compareHtml({ before, after }, dir) {
  const cell = (label, e) => `<div class="c"><div class="l">${esc(label)}</div><img src="${esc(pathToFileURL(join(dir, e.file)).href)}"></div>`;
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;display:flex;font:600 20px system-ui,sans-serif}
.c{width:50%}.l{padding:12px 16px;background:#f3f3f3;border-bottom:1px solid #ccc}
img{display:block;width:100%}
</style>${cell(`Before: main ${sha7(before.base_sha ?? before.sha)}`, before)}${cell(`After: ${after.branch ?? 'unknown'} ${sha7(after.sha)}`, after)}`;
}

export async function cmdCompose(d, o) {
  const dir = evidenceDir(d.env, o.repo, o.issue, o.attempt);
  const git = d.gitInfo(o.project);
  const kept = withManifest(dir, (m) => {
    const live = new Set(composePairs(m, dir).map((p) => pairKey(p.after)));
    return m.filter((e) => {
      if (e.phase !== 'compare' || live.has(pairKey(e))) return true;
      if (e.file && FILE_RE.test(e.file)) rmSync(join(dir, e.file), { force: true });
      return false;
    });
  });
  const pairs = composePairs(kept, dir);
  if (!pairs.length) return { evidence_dir: dir, composed: [] };
  const mk = (pair, extra) => ({
    phase: 'compare',
    route: pair.after.route,
    url: pair.after.url,
    viewport: pair.after.viewport,
    file: null,
    truncated: Boolean(pair.before.truncated || pair.after.truncated),
    caption: `${pair.after.route} (${pair.after.viewport.name}), before and after`,
    sha: pair.after.sha ?? git.sha,
    branch: pair.after.branch ?? git.branch,
    console_errors: { count: 0, first: [] },
    failed_requests: { count: 0, first: [] },
    result: 'not-exercised',
    captured_at: new Date(d.now()).toISOString(),
    ...extra,
  });
  const entries = [];
  const fillRest = (reason) => {
    for (const p of pairs) if (!entries.some((e) => pairKey(e) === pairKey(p.after))) entries.push(mk(p, { reason }));
  };
  let browser;
  let tmp;
  const runPairs = async () => {
    let pw;
    try {
      pw = await d.loadPlaywright(o.project);
    } catch (e) {
      return fillRest(`playwright unavailable: ${errorText(e)}`);
    }
    try {
      browser = await pw.chromium.launch();
    } catch (e) {
      return fillRest(`browser launch failed: ${errorText(e)}`);
    }
    tmp = mkdtempSync(join(tmpdir(), 'capture-ui-'));
    for (const pair of pairs) {
      try {
        const htmlPath = join(tmp, 'compare.html');
        writeFileSync(htmlPath, compareHtml(pair, dir));
        const file = `compare/${fileSlug(pair.after.route)}-${pair.after.viewport.name}.png`;
        mkdirSync(join(dir, 'compare'), { recursive: true });
        const page = await browser.newPage({ viewport: { width: pair.after.viewport.width, height: pair.after.viewport.height } });
        try {
          await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
          await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), undefined, { timeout: IMAGES_TIMEOUT_MS });
          await page.screenshot({ path: join(dir, file), fullPage: true });
        } finally {
          await page.close().catch(() => {});
        }
        entries.push(mk(pair, { file, result: 'pass' }));
      } catch (e) {
        entries.push(mk(pair, { reason: errorText(e) }));
      }
    }
  };
  try {
    await runPairs();
  } catch (e) {
    fillRest(errorText(e));
  } finally {
    await browser?.close().catch(() => {});
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
  saveEntries(dir, entries);
  return {
    evidence_dir: dir,
    composed: entries.map((e) => ({ route: e.route, viewport: e.viewport.name, result: e.result, ...(e.reason ? { reason: e.reason } : {}) })),
  };
}

// ---------- markdown ----------

const plain = (s) => String(s ?? '').replace(/[\s\u0000-\u001f\u007f]+/g, ' ').replace(/[[\]\\`<>]/g, '').trim();
const codeSpan = (s) => `\`${String(s ?? '').replace(/`/g, '').replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim()}\``;
const rel = (e) => `./${e.file}`;
const shotLabel = (e) => `${codeSpan(e.route)} (${plain(e.viewport.name)})`;
const image = (e) => `![${plain(e.caption)}${e.truncated ? TRUNCATED_CAPTION_SUFFIX : ''}](${rel(e)})`;
const notExercisedBullet = (e) => `- ${shotLabel(e)}: not exercised, ${plain(e.reason) || 'no reason recorded'}`;

const PUBLIC_REASON = 'repository is public, images not attached';
const UNKNOWN_REASON = 'repository visibility unknown, images not attached';

// Returns null when images may be attached (private repo), else the reason they may not.
function imageBlockReason(d, repo) {
  try {
    return d.repoIsPrivate(repo) === true ? null : PUBLIC_REASON;
  } catch {
    return UNKNOWN_REASON;
  }
}

function planBody(entries, noImages) {
  const before = entries.filter((e) => e.phase === 'before');
  const mockup = entries.filter((e) => e.phase === 'mockup');
  const out = [];
  const section = (title, list, intro) => {
    if (!list.length) return;
    out.push(`### ${title}`, '');
    if (intro) out.push(intro, '');
    for (const e of list) {
      if (exercised(e) && !noImages) out.push(shotLabel(e), '', image(e), '');
      else out.push(notExercisedBullet(exercised(e) ? { ...e, reason: noImages } : e));
    }
    out.push('');
  };
  section(`Current state (main ${sha7(before.map((e) => e.base_sha ?? e.sha).find(Boolean))})`, before);
  section('Mockup', mockup, `_${MOCKUP_CAPTION}_`);
  return out;
}

function prBody(entries, noImages) {
  const before = entries.filter((e) => e.phase === 'before');
  const after = entries.filter((e) => e.phase === 'after');
  const afterFor = (e) => after.find((a) => pairKey(a) === pairKey(e));
  const compare = entries.filter((e) => {
    const a = afterFor(e);
    return e.phase === 'compare' && exercised(e) && exercised(a) && a.sha === e.sha;
  });
  const out = ['### Before and after', ''];
  const composed = new Set(compare.map(pairKey));
  const withheld = [];
  for (const e of compare) {
    if (noImages) withheld.push({ ...e, reason: noImages });
    else out.push(shotLabel(e), '', image(e), '');
  }
  for (const e of after.filter((a) => exercised(a) && !composed.has(pairKey(a)))) {
    if (noImages) {
      withheld.push({ ...e, reason: noImages });
      continue;
    }
    const b = before.find((x) => pairKey(x) === pairKey(e) && exercised(x));
    out.push(shotLabel(e), '');
    if (b) out.push(`Before: ${image(b)}`, '');
    out.push(`After: ${image(e)}`, '');
  }
  out.push('### UI verification', '');
  const rows = after.filter(exercised);
  if (rows.length) {
    out.push('| Page | Viewport | New console errors | New failed requests | Pre-existing | Flaky | Result | Head SHA |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const e of rows) {
      const n = e.new_errors ?? { console_errors: e.console_errors.count, failed_requests: e.failed_requests.count };
      out.push(`| ${codeSpan(e.route).replace(/\|/g, '\\|')} | ${plain(e.viewport.name)} | ${n.console_errors} | ${n.failed_requests} | ${e.pre_existing ?? 0} | ${e.flaky?.count ?? 0} | ${plain(e.result)} | ${sha7(e.sha)} |`);
    }
    out.push('');
  }
  out.push('Playwright traces: none recorded.', '');
  const skipped = entries.filter((e) => ['before', 'after', 'compare'].includes(e.phase) && !exercised(e));
  for (const line of new Set([...withheld, ...skipped].map(notExercisedBullet))) out.push(line);
  return out;
}

const shq = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

export function imageRefs(text) {
  return [...text.replace(/`[^`\n]*`/g, '').matchAll(/!\[[^\]]*\]\(([^)]*)\)/g)].map((m) => m[1]);
}

export function cmdMarkdown(d, o) {
  const dir = evidenceDir(d.env, o.repo, o.issue, o.attempt);
  const phases = o.for === 'plan' ? ['before', 'mockup'] : ['before', 'after', 'compare'];
  const entries = readManifest(dir).filter((e) => phases.includes(e.phase));
  const remote = entries.find((e) => exercised(e) && !isLocalHost(e.url));
  if (remote) throw new RefusalError(`refusing to write markdown: image for ${remote.phase} ${plain(remote.route)} was captured from non-local host ${plain(remote.url)}`);

  const noImages = imageBlockReason(d, o.repo);
  const lines = o.for === 'plan' ? planBody(entries, noImages) : prBody(entries, noImages);
  const text = `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;

  const files = [...new Set(entries.filter(exercised).map((e) => e.file))];
  const badFile = files.find((f) => !FILE_RE.test(f));
  if (badFile) throw new RefusalError(`refusing to attach unexpected path: ${plain(badFile)}`);
  const allowed = new Set(files.map((f) => `./${f}`));
  const attach = noImages ? [] : [...new Set(imageRefs(text))];
  if (noImages && imageRefs(text).length) throw new RefusalError('refusing to write markdown: images present for a repository that is not private');
  if (attach.some((r) => !allowed.has(r))) {
    throw new RefusalError('refusing to write markdown: an image reference in the body is not a captured file');
  }

  mkdirSync(dir, { recursive: true });
  const fragmentFile = join(dir, `images-${o.for}.md`);
  writeFileSync(fragmentFile, text);
  const attachArgs = attach.map((a) => `--attach ${shq(a)}`).join(' ');
  const gh = o.for === 'plan'
    ? `gh issue comment ${o.issue} --repo ${o.repo} --body-file <body.md>`
    : `gh pr create --repo ${o.repo} --title <title> --base main --head <branch> --body-file <body.md>`;
  const stdout = [
    `images: ${fragmentFile}`,
    ...attach.map((a) => `attach: ${a}`),
    `# The run merges images-${o.for}.md into its own body file and passes that file as <body.md> (a path relative to the evidence dir).`,
    `cd ${shq(dir)} && ${gh}${attachArgs ? ` ${attachArgs}` : ''}`,
  ].join('\n');
  return { fragment_file: fragmentFile, attach, stdout };
}

// ---------- CLI ----------

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const FLAGS = {
  detect: ['--files', '--glob', '--project', '--config'],
  capture: ['--repo', '--issue', '--attempt', '--phase', '--base-url', '--route', '--phone', '--sign-in', '--mask', '--ignore-request', '--project', '--caption', '--config'],
  compose: ['--repo', '--issue', '--attempt', '--project'],
  markdown: ['--repo', '--issue', '--attempt', '--for'],
};
const BOOLEAN_FLAGS = ['--phone', '--sign-in'];

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!FLAGS[cmd]) throw new UsageError('command must be detect, capture, compose or markdown');
  const o = { cmd, globs: [], routes: [], masks: [], ignoreRequests: [], captions: [], attempt: 1, phone: false, signIn: false };
  const positive = (f, v) => {
    if (!/^[1-9]\d*$/.test(v)) throw new UsageError(`bad ${f} value: ${v}`);
    return Number(v);
  };
  for (let i = 0; i < rest.length; i++) {
    const f = rest[i];
    if (!FLAGS[cmd].includes(f)) throw new UsageError(`unknown flag: ${f}`);
    if (BOOLEAN_FLAGS.includes(f)) {
      if (f === '--phone') o.phone = true;
      else o.signIn = true;
      continue;
    }
    if (i + 1 >= rest.length) throw new UsageError(`${f} needs a value`);
    const v = rest[++i];
    if (f === '--files') o.files = v;
    else if (f === '--glob') o.globs.push(v);
    else if (f === '--repo') {
      if (!REPO_RE.test(v)) throw new UsageError(`bad repo: ${v}`);
      o.repo = v;
    } else if (f === '--issue') o.issue = positive(f, v);
    else if (f === '--attempt') o.attempt = positive(f, v);
    else if (f === '--phase') {
      if (!['before', 'after', 'mockup'].includes(v)) throw new UsageError('--phase must be before, after or mockup');
      o.phase = v;
    } else if (f === '--base-url') o.baseUrl = parseBaseUrl(v);
    else if (f === '--route') {
      if (!isSafePath(v)) throw new UsageError(`bad --route: ${JSON.stringify(v)}`);
      o.routes.push(v);
    } else if (f === '--mask') o.masks.push(v);
    else if (f === '--ignore-request') o.ignoreRequests.push(v);
    else if (f === '--caption') o.captions.push(v);
    else if (f === '--project') o.project = v;
    else if (f === '--config') o.config = v;
    else if (f === '--for') {
      if (!['plan', 'pr'].includes(v)) throw new UsageError('--for must be plan or pr');
      o.for = v;
    }
  }
  if (cmd === 'detect' && !o.files) throw new UsageError('--files is required');
  if (cmd !== 'detect') {
    if (!o.repo) throw new UsageError('--repo is required');
    if (o.issue === undefined) throw new UsageError('--issue is required');
  }
  if (cmd === 'capture') {
    for (const [flag, key] of [['--phase', 'phase'], ['--project', 'project']]) {
      if (!o[key]) throw new UsageError(`${flag} is required`);
    }
    if (!o.routes.length) throw new UsageError('at least one --route is required');
    if (o.captions.length > o.routes.length) throw new UsageError('more --caption flags than --route flags');
  }
  if (cmd === 'compose' && !o.project) throw new UsageError('--project is required');
  if (cmd === 'markdown' && !o.for) throw new UsageError('--for is required');
  return o;
}

// Resolves to the text the CLI prints on stdout.
export async function main(argv, d = makeDeps()) {
  if (argv[0] === '--help' || argv[0] === '-h') return USAGE;
  const o = parseArgs(argv);
  if (o.cmd === 'detect') return JSON.stringify(cmdDetect(d, o));
  if (o.cmd === 'capture') return JSON.stringify(await cmdCapture(d, o));
  if (o.cmd === 'compose') return JSON.stringify(await cmdCompose(d, o));
  return cmdMarkdown(d, o).stdout;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(await main(process.argv.slice(2)));
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`usage error: ${e.message}\n${USAGE}`);
      process.exit(2);
    }
    if (e instanceof RefusalError) {
      console.error(`capture-ui: ${e.message}`);
      process.exit(1);
    }
    console.error(`capture-ui failed: ${e?.message || e}`);
    process.exit(1);
  }
}
