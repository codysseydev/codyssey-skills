import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RefusalError, UsageError, cmdCapture, cmdCompose, cmdDetect, cmdMarkdown, deriveRoute, detect, evidenceDir, fileSlug, globToRegex,
  isLocalHost, main, parseArgs, parseConfig, parseEnvFile, readManifest, slugify, upsertEntries, withManifest,
} from './capture-ui.mjs';

const T0 = Date.parse('2026-01-01T12:00:00Z');
const SHA = 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0';

function fakePlaywright({
  consoleErrors = [], failed = [], pageErrors = [], gotoError, launchError, height = 500, cookieBanner = false, signInLandings = 0,
  signInPath = '/sign-in', redirectTo, fillError, contextError, screenshotError, reloadConsoleErrors, reloadFailed, driftAfterFill, proofMisses = 0, proofMissName = 'Manage account', menuStuck = false,
} = {}) {
  const log = { contexts: [], screenshots: [], gotos: [], fills: [], styles: [], clicks: [], waits: [], html: [], reloads: 0, evals: [], keys: [], submitClicks: 0, browserClosed: false };
  let landings = signInLandings;
  let misses = proofMisses;
  const makePage = () => {
    const handlers = {};
    let current = '';
    const emit = (consoleList, failedList) => {
      for (const m of consoleList) {
        const { text, url: location = '' } = typeof m === 'string' ? { text: m } : m;
        handlers.console?.({ type: () => 'error', text: () => text, location: () => ({ url: location }) });
      }
      for (const f of failedList) handlers.response?.({ url: () => f.url, status: () => f.status });
    };
    return {
      on: (evt, fn) => void (handlers[evt] = fn),
      url: () => current,
      goto: async (url) => {
        log.gotos.push(url);
        if (gotoError) throw new Error(gotoError);
        current = redirectTo ?? url;
        if (url.startsWith('file:')) log.html.push(readFileSync(fileURLToPath(url), 'utf8'));
        if (!url.includes(signInPath) && !url.startsWith('file:') && landings > 0) {
          landings -= 1;
          current = `http://localhost:3000${signInPath}`;
        }
        emit(consoleErrors, failed);
        for (const e of pageErrors) handlers.pageerror?.(new Error(e));
      },
      reload: async () => {
        log.reloads += 1;
        emit(reloadConsoleErrors ?? consoleErrors, reloadFailed ?? failed);
      },
      keyboard: { press: async (key) => void log.keys.push(key) },
      getByRole: (role, { name } = {}) => {
        const loc = {
          isVisible: async () => cookieBanner && name === 'Reject all',
          click: async () => void log.clicks.push(name),
          waitFor: async (opts) => {
            const onShot = !current.includes(signInPath);
            if (role === 'dialog') {
              log.waits.push(['dialog', opts.state]);
              if (menuStuck) throw new Error('menu still open');
              return;
            }
            if (onShot && name === proofMissName && misses > 0) {
              misses -= 1;
              throw new Error('proof not visible');
            }
            log.waits.push([name, opts.state, onShot ? 'shot' : 'sign-in']);
          },
          first: () => loc,
        };
        return loc;
      },
      addStyleTag: async ({ content }) => void log.styles.push(content),
      waitForFunction: async (fn, arg, opts) => void log.waits.push(arg === undefined ? ['images'] : ['enabled', arg, opts.timeout]),
      evaluate: async (fn) => {
        log.evals.push(String(fn));
        return height;
      },
      waitForLoadState: async () => {
        throw new Error('networkidle timeout');
      },
      locator: (s) => {
        const loc = { selector: s, waitFor: async (opts) => void log.waits.push([s, opts.state]), first: () => loc };
        return loc;
      },
      fill: async (sel, value) => {
        if (fillError) throw new Error(fillError(value));
        log.fills.push([sel, value]);
        if (driftAfterFill) current = driftAfterFill;
      },
      click: async () => void (log.submitClicks += 1),
      waitForURL: async () => {},
      screenshot: async (opts) => {
        if (screenshotError) throw new Error(screenshotError);
        log.screenshots.push(opts);
        writeFileSync(opts.path, 'png');
      },
      close: async () => {},
    };
  };
  const context = {
    newPage: async () => makePage(),
    storageState: async () => ({ cookies: [{ name: 's', value: 'secret-cookie' }] }),
    close: async () => {},
  };
  const browser = {
    newContext: async (opts) => {
      if (contextError) throw new Error(contextError);
      log.contexts.push(opts);
      return context;
    },
    newPage: async () => makePage(),
    close: async () => void (log.browserClosed = true),
  };
  return {
    log,
    chromium: {
      launch: async () => {
        if (launchError) throw new Error(launchError);
        return browser;
      },
    },
  };
}

const CONFIG = {
  base_url: 'http://localhost:3000',
  sign_in: {
    path: '/sign-in',
    email_selector: '#signin-email',
    password_selector: '#signin-password',
    submit_selector: 'button[type=submit]',
    signed_in: { role: 'button', name: 'Manage account' },
    env_email: 'FACTORY_TEST_EMAIL',
    env_password: 'FACTORY_TEST_PASSWORD',
  },
  consent_button: 'Reject all',
  hide_css: ['nextjs-portal{display:none!important}'],
  masks: ['#firstName', '#lastName', '#email'],
  ignore_requests: [],
};

function deps({ pw, env = {}, loadError, config = CONFIG, isPrivate = true, privateError } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'capture-ui-home-'));
  return {
    home,
    d: {
      readConfigText: () => (config === null ? undefined : JSON.stringify(config)),
      env: { FACTORY_HOME: home, ...env },
      now: () => T0,
      loadPlaywright: async () => {
        if (loadError) throw new Error(loadError);
        return pw;
      },
      gitInfo: () => ({ sha: SHA, branch: 'feat/x' }),
      readStdin: () => 'app/page.tsx\nREADME.md\n',
      repoIsPrivate: (repo) => {
        if (privateError) throw new Error(privateError);
        return isPrivate;
      },
    },
  };
}

const capArgs = (extra = []) => parseArgs([
  'capture', '--repo', 'o/r', '--issue', '7', '--phase', 'before', '--base-url', 'http://localhost:3000',
  '--route', '/', '--project', tmpdir(), ...extra,
]);

const entry = (over = {}) => ({
  phase: 'after', route: '/', url: 'http://localhost:3000/', viewport: { name: 'desktop', width: 1728, height: 997 },
  file: 'after/home-desktop.png', caption: 'Home', sha: SHA, branch: 'feat/x',
  console_errors: { count: 0, first: [] }, failed_requests: { count: 0, first: [] }, result: 'pass', captured_at: '', ...over,
});

function seed(home, entries) {
  const dir = evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(entries));
  for (const e of entries) {
    if (!e.file) continue;
    mkdirSync(join(dir, e.file, '..'), { recursive: true });
    writeFileSync(join(dir, e.file), 'png');
  }
  return dir;
}

test('globToRegex handles **, * and literal dots', () => {
  assert.ok(globToRegex('app/**/page.tsx').test('app/page.tsx'));
  assert.ok(globToRegex('app/**/page.tsx').test('app/a/b/page.tsx'));
  assert.ok(!globToRegex('app/**/page.tsx').test('app/a/pageXtsx'));
  assert.ok(globToRegex('src/**/*.css').test('src/x/y/z.css'));
  assert.ok(!globToRegex('*.css').test('a/b.css'));
  assert.ok(globToRegex('public/**').test('public/img/a.png'));
  assert.ok(!globToRegex('a.b').test('axb'));
});

test('detect matches defaults, applies excludes and derives routes', () => {
  const r = detect([
    'app/page.tsx', 'app/(marketing)/pricing/page.tsx', 'app/courses/[courseSlug]/page.tsx', 'app/layout.tsx',
    'app/page.test.tsx', 'src/features/x/Card.stories.tsx', 'src/features/x/Card.tsx', 'public/logo.svg', 'README.md', 'lib/db.ts', '',
  ]);
  assert.equal(r.ui, true);
  assert.deepEqual(r.routes, ['/', '/courses/[courseSlug]', '/pricing']);
  assert.ok(r.matched.includes('app/layout.tsx'));
  assert.ok(r.matched.includes('src/features/x/Card.tsx'));
  assert.ok(r.matched.includes('public/logo.svg'));
  assert.ok(!r.matched.includes('app/page.test.tsx'));
  assert.ok(!r.matched.includes('src/features/x/Card.stories.tsx'));
  assert.ok(!r.matched.includes('README.md'));
});

test('detect reports ui false when nothing matches and --glob replaces the defaults', () => {
  assert.deepEqual(detect(['README.md', 'lib/db.ts']), { ui: false, matched: [], routes: [] });
  assert.deepEqual(detect(['app/page.tsx', 'docs/a.md'], ['docs/**']).matched, ['docs/a.md']);
});

test('deriveRoute drops route groups and keeps dynamic segments', () => {
  assert.equal(deriveRoute('app/page.tsx'), '/');
  assert.equal(deriveRoute('app/(auth)/sign-in/page.tsx'), '/sign-in');
  assert.equal(deriveRoute('app/courses/[courseSlug]/page.tsx'), '/courses/[courseSlug]');
  assert.equal(deriveRoute('app/layout.tsx'), undefined);
});

test('cmdDetect reads stdin for --files -', () => {
  const { d } = deps();
  assert.deepEqual(cmdDetect(d, { files: '-', globs: [] }), { ui: true, matched: ['app/page.tsx'], routes: ['/'] });
});

test('host guard', () => {
  for (const u of ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://codyssey.test', 'http://sub.codyssey.test/x']) {
    assert.equal(isLocalHost(u), true, u);
  }
  for (const u of ['https://example.com', 'http://localhost.evil.com', 'http://10.0.0.1', 'nonsense']) {
    assert.equal(isLocalHost(u), false, u);
  }
});

test('slugify', () => {
  assert.equal(slugify('/'), 'home');
  assert.equal(slugify('/courses/[courseSlug]'), 'courses-courseslug');
  assert.equal(slugify('/Sign In/'), 'sign-in');
});

test('evidenceDir honours FACTORY_HOME', () => {
  const home = mkdtempSync(join(tmpdir(), 'capture-ui-home-'));
  assert.equal(evidenceDir({ FACTORY_HOME: home }, 'Codyssey/app', 12, 2), join(home, 'evidence', 'Codyssey-app-12-a2'));
});

test('upsertEntries replaces the same phase, route and viewport and keeps the rest', () => {
  const a = entry({ result: 'fail' });
  const b = entry({ viewport: { name: 'phone', width: 393, height: 852 } });
  const out = upsertEntries([a, b], [entry({ result: 'pass', caption: 'new' })]);
  assert.equal(out.length, 2);
  assert.equal(out[0].caption, 'new');
  assert.equal(out[1], b);
});

test('parseEnvFile reads KEY=VALUE lines', () => {
  assert.deepEqual(parseEnvFile('# c\nA=1\nexport B="two"\nC=\'3\'\n'), { A: '1', B: 'two', C: '3' });
});

test('capture records not-exercised when Playwright cannot load and does not throw', async () => {
  const { d, home } = deps({ loadError: "Cannot find module 'playwright'" });
  const o = capArgs(['--route', '/pricing', '--phone']);
  const r = await cmdCapture(d, o);
  assert.equal(r.shots.length, 4);
  assert.ok(r.shots.every((s) => s.result === 'not-exercised' && s.reason.startsWith('playwright unavailable')));
  const manifest = readManifest(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1));
  assert.equal(manifest.length, 4);
  assert.equal(manifest[0].sha, SHA);
});

test('capture refuses a non-local base url without loading Playwright', async () => {
  const { d } = deps({ loadError: 'must not be called' });
  const o = parseArgs(['capture', '--repo', 'o/r', '--issue', '7', '--phase', 'after', '--base-url', 'https://example.com', '--route', '/', '--project', tmpdir()]);
  const r = await cmdCapture(d, o);
  assert.deepEqual(r.shots.map((s) => [s.result, s.reason]), [['not-exercised', 'host not local']]);
});

test('capture records pass and fail from console errors and failed requests', async () => {
  const pass = deps({ pw: fakePlaywright() });
  const r1 = await cmdCapture(pass.d, capArgs(['--caption', 'Home page', '--mask', '.secret']));
  assert.equal(r1.shots[0].result, 'pass');
  const dir = evidenceDir({ FACTORY_HOME: pass.home }, 'o/r', 7, 1);
  const [e1] = readManifest(dir);
  assert.equal(e1.file, `before/${fileSlug('/')}-desktop.png`);
  assert.equal(e1.caption, 'Home page');
  assert.equal(e1.viewport.width, 1728);
  assert.ok(existsSync(join(dir, e1.file)));

  const bad = deps({
    pw: fakePlaywright({ consoleErrors: ['a', 'b', 'c', 'd'], failed: [{ url: 'http://localhost:3000/api/x', status: 500 }] }),
  });
  const r2 = await cmdCapture(bad.d, capArgs());
  assert.equal(r2.shots[0].result, 'fail');
  const [e2] = readManifest(evidenceDir({ FACTORY_HOME: bad.home }, 'o/r', 7, 1));
  assert.deepEqual(e2.console_errors, { count: 4, first: ['a', 'b', 'c'] });
  assert.equal(e2.result, 'fail');
  assert.deepEqual(e2.failed_requests, { count: 1, first: [{ url: 'http://localhost:3000/api/x', status: 500 }] });
});

test('capture passes screenshot options, masks and context options', async () => {
  const pw = fakePlaywright();
  const { d } = deps({ pw });
  await cmdCapture(d, capArgs(['--phone', '--mask', '.secret']));
  assert.equal(pw.log.contexts.length, 2);
  assert.equal(pw.log.contexts[0].reducedMotion, 'reduce');
  assert.deepEqual(pw.log.contexts[1].viewport, { width: 393, height: 852 });
  const shot = pw.log.screenshots[0];
  assert.equal(shot.fullPage, true);
  assert.equal(shot.animations, 'disabled');
  assert.equal(shot.scale, 'css');
  assert.equal(shot.mask.length, 4);
  assert.ok(shot.mask.some((m) => m.selector === '.secret'));
});

test('capture records a thrown navigation error as not-exercised', async () => {
  const { d } = deps({ pw: fakePlaywright({ gotoError: 'net::ERR_CONNECTION_REFUSED' }) });
  const r = await cmdCapture(d, capArgs());
  assert.equal(r.shots[0].result, 'not-exercised');
  assert.match(r.shots[0].reason, /ERR_CONNECTION_REFUSED/);
});

test('capture records a browser launch failure as not-exercised', async () => {
  const { d } = deps({ pw: fakePlaywright({ launchError: 'executable missing' }) });
  const r = await cmdCapture(d, capArgs());
  assert.match(r.shots[0].reason, /browser launch failed: executable missing/);
});

test('capture re-run replaces the entry for the same phase, route and viewport', async () => {
  const { d, home } = deps({ pw: fakePlaywright() });
  await cmdCapture(d, capArgs());
  await cmdCapture(d, capArgs(['--caption', 'Second']));
  const manifest = readManifest(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1));
  assert.equal(manifest.length, 1);
  assert.equal(manifest[0].caption, 'Second');
});

test('mockup phase defaults the caption', async () => {
  const { d, home } = deps({ pw: fakePlaywright() });
  const o = parseArgs(['capture', '--repo', 'o/r', '--issue', '7', '--phase', 'mockup', '--base-url', 'http://localhost:3000', '--route', '/', '--project', tmpdir()]);
  await cmdCapture(d, o);
  assert.equal(readManifest(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1))[0].caption, 'Mockup, not implemented');
});

test('sign-in reads credentials from .env, stores state with mode 0600 and reuses it', async () => {
  const project = mkdtempSync(join(tmpdir(), 'capture-ui-proj-'));
  writeFileSync(join(project, '.env'), 'FACTORY_TEST_EMAIL=me@example.com\nFACTORY_TEST_PASSWORD=hunter2\n');
  const pw = fakePlaywright();
  const { d, home } = deps({ pw });
  const o = { ...capArgs(['--sign-in']), project };
  const r = await cmdCapture(d, o);
  assert.equal(r.shots[0].result, 'pass');
  assert.ok(pw.log.fills.some(([, v]) => v === 'hunter2'));
  assert.ok(pw.log.waits.some(([k, , t]) => k === 'enabled' && t === 15000));
  assert.ok(pw.log.waits.some(([k, st]) => k === 'Manage account' && st === 'visible'));
  assert.deepEqual(pw.log.fills.slice(0, 2), [['#signin-email', 'me@example.com'], ['#signin-password', 'hunter2']]);
  const state = join(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1), 'auth', 'state.json');
  assert.equal(statSync(state).mode & 0o777, 0o600);
  const ctxCount = pw.log.contexts.length;
  await cmdCapture(d, o);
  assert.equal(pw.log.fills.length, 2);
  assert.equal(pw.log.contexts[ctxCount].storageState, state);
  const manifestText = readFileSync(join(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1), 'manifest.json'), 'utf8');
  assert.ok(!manifestText.includes('hunter2'));
});

test('sign-in without credentials records sign-in failed', async () => {
  const { d } = deps({ pw: fakePlaywright() });
  const r = await cmdCapture(d, capArgs(['--sign-in']));
  assert.equal(r.shots[0].result, 'not-exercised');
  assert.equal(r.shots[0].reason, 'sign-in failed');
});

test('compose builds a compare entry for exercised before/after pairs only', async () => {
  const pw = fakePlaywright();
  const { d, home } = deps({ pw });
  const dir = seed(home, [
    entry({ phase: 'before', file: 'before/home-desktop.png', sha: 'b'.repeat(40), branch: 'main' }),
    entry(),
    entry({ phase: 'before', route: '/x', file: null, result: 'not-exercised', reason: 'down' }),
    entry({ route: '/x', file: 'after/x-desktop.png' }),
  ]);
  const r = await cmdCompose(d, { repo: 'o/r', issue: 7, attempt: 1, project: tmpdir() });
  assert.deepEqual(r.composed, [{ route: '/', viewport: 'desktop', result: 'pass' }]);
  const compare = readManifest(dir).find((e) => e.phase === 'compare');
  assert.equal(compare.file, `compare/${fileSlug('/')}-desktop.png`);
  assert.ok(existsSync(join(dir, compare.file)));
});

test('compose records not-exercised when Playwright cannot load', async () => {
  const { d, home } = deps({ loadError: 'no playwright' });
  const dir = seed(home, [entry({ phase: 'before', file: 'before/home-desktop.png' }), entry()]);
  const r = await cmdCompose(d, { repo: 'o/r', issue: 7, attempt: 1, project: tmpdir() });
  assert.equal(r.composed[0].result, 'not-exercised');
  assert.equal(readManifest(dir).find((e) => e.phase === 'compare').reason, 'playwright unavailable: no playwright');
});

test('markdown plan: current state, mockup label, relative paths, not-exercised bullets', () => {
  const { d, home } = deps();
  const dir = seed(home, [
    entry({ phase: 'before', file: 'before/home-desktop.png', caption: 'Home today', sha: 'c'.repeat(40), branch: 'main' }),
    entry({ phase: 'before', route: '/p', file: null, result: 'not-exercised', reason: 'sign-in failed' }),
    entry({ phase: 'mockup', file: 'mockup/home-desktop.png', caption: 'Mockup, not implemented' }),
  ]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'plan' });
  const md = readFileSync(join(dir, 'images-plan.md'), 'utf8');
  assert.equal(r.fragment_file, join(dir, 'images-plan.md'));
  assert.match(md, /### Current state \(main ccccccc\)/);
  assert.match(md, /!\[Home today\]\(\.\/before\/home-desktop\.png\)/);
  assert.match(md, /### Mockup\n\n_Mockup, not implemented_/);
  assert.match(md, /!\[Mockup, not implemented\]\(\.\/mockup\/home-desktop\.png\)/);
  assert.match(md, /- `\/p` \(desktop\): not exercised, sign-in failed/);
  assert.ok(!md.includes('<img'));
  assert.deepEqual(r.attach, ['./before/home-desktop.png', './mockup/home-desktop.png']);
  assert.match(r.stdout, new RegExp(`cd ${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} && gh issue comment 7 --repo o/r --body-file <body\\.md> --attach \\./before/home-desktop\\.png --attach \\./mockup/home-desktop\\.png`));
});

test('markdown pr: compare image, verification table, traces line, bullets', () => {
  const { d, home } = deps();
  const dir = seed(home, [
    entry({ phase: 'before', file: 'before/home-desktop.png' }),
    entry({ console_errors: { count: 3, first: ['a', 'b', 'c'] }, new_errors: { console_errors: 2, failed_requests: 0 }, pre_existing: 1, result: 'fail' }),
    entry({ phase: 'compare', file: 'compare/home-desktop.png', caption: 'Home, before and after' }),
    entry({ route: '/p', file: null, result: 'not-exercised', reason: 'timeout' }),
  ]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'pr' });
  const md = readFileSync(join(dir, 'images-pr.md'), 'utf8');
  assert.match(md, /### Before and after\n\n`\/` \(desktop\)\n\n!\[Home, before and after\]\(\.\/compare\/home-desktop\.png\)/);
  assert.match(md, /### UI verification/);
  assert.match(md, /\| Page \| Viewport \| New console errors \| New failed requests \| Pre-existing \| Flaky \| Result \| Head SHA \|/);
  assert.match(md, /\| `\/` \| desktop \| 2 \| 0 \| 1 \| 0 \| fail \| a1b2c3d \|/);
  assert.match(md, /Playwright traces: none recorded\./);
  assert.match(md, /- `\/p` \(desktop\): not exercised, timeout/);
  assert.deepEqual(r.attach, ['./compare/home-desktop.png']);
  assert.match(r.stdout, /# The run merges images-pr\.md into its own body file/);
  assert.match(r.stdout, /gh pr create --repo o\/r --title <title> --base main --head <branch> --body-file <body\.md> --attach \.\/compare\/home-desktop\.png/);
  assert.match(r.stdout, /^images: .*images-pr\.md$/m);
  assert.ok(!md.includes('The run merges'));
});

test('markdown pr falls back to separate before and after images without compose', () => {
  const { d, home } = deps();
  seed(home, [entry({ phase: 'before', file: 'before/home-desktop.png', caption: 'B' }), entry({ caption: 'A' })]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'pr' });
  assert.deepEqual(r.attach, ['./before/home-desktop.png', './after/home-desktop.png']);
});

test('markdown refuses entries from a non-local host', () => {
  const { d, home } = deps();
  seed(home, [entry({ phase: 'before', url: 'https://example.com/', file: 'before/home-desktop.png' })]);
  assert.throws(() => cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'plan' }), RefusalError);
});

test('main prints JSON for detect and the usage text for --help', async () => {
  const { d } = deps();
  assert.deepEqual(JSON.parse(await main(['detect', '--files', '-'], d)), { ui: true, matched: ['app/page.tsx'], routes: ['/'] });
  assert.match(await main(['--help'], d), /^usage:/);
});

test('argument errors are UsageError', () => {
  const bad = [
    [],
    ['nope'],
    ['detect'],
    ['detect', '--files'],
    ['detect', '--files', 'x', '--repo', 'o/r'],
    ['capture', '--repo', 'o/r', '--issue', '1'],
    ['capture', '--repo', 'bad', '--issue', '1'],
    ['capture', '--repo', 'o/r', '--issue', 'x', '--phase', 'before', '--base-url', 'http://localhost', '--route', '/', '--project', '.'],
    ['capture', '--repo', 'o/r', '--issue', '1', '--phase', 'during', '--base-url', 'http://localhost', '--route', '/', '--project', '.'],
    ['capture', '--repo', 'o/r', '--issue', '1', '--phase', 'before', '--base-url', 'not a url', '--route', '/', '--project', '.'],
    ['capture', '--repo', 'o/r', '--issue', '1', '--phase', 'before', '--base-url', 'http://localhost', '--route', 'nope', '--project', '.'],
    ['capture', '--repo', 'o/r', '--issue', '1', '--phase', 'before', '--base-url', 'http://localhost', '--project', '.'],
    ['capture', '--repo', 'o/r', '--issue', '1', '--phase', 'before', '--base-url', 'http://localhost', '--route', '/', '--project', '.', '--caption', 'a', '--caption', 'b'],
    ['compose', '--repo', 'o/r', '--issue', '1'],
    ['markdown', '--repo', 'o/r', '--issue', '1'],
    ['markdown', '--repo', 'o/r', '--issue', '1', '--for', 'email'],
    ['markdown', '--repo', 'o/r', '--issue', '1', '--for', 'pr', '--attempt', '0'],
  ];
  for (const argv of bad) assert.throws(() => parseArgs(argv), UsageError, JSON.stringify(argv));
});

const manifestOf = (home) => readManifest(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1));

test('hygiene: rejects the cookie banner, injects CSS and ignores matching requests and console errors', async () => {
  const pw = fakePlaywright({
    cookieBanner: true,
    consoleErrors: ['geo failed', { text: 'boom', url: 'http://localhost:3000/_edge/geo' }, 'real'],
    failed: [{ url: 'http://localhost:3000/_edge/geo', status: 500 }, { url: 'http://localhost:3000/api/y', status: 404 }],
  });
  const { d, home } = deps({ pw });
  await cmdCapture(d, capArgs(['--ignore-request', '/_edge/geo', '--ignore-request', 'geo failed']));
  assert.deepEqual(pw.log.clicks, ['Reject all', 'Reject all']);
  assert.ok(pw.log.styles[0].includes('nextjs-portal{display:none!important}'));
  assert.ok(pw.log.styles[0].includes('transition:none!important'));
  const [e] = manifestOf(home);
  assert.equal(e.console_errors.count, 1);
  assert.deepEqual(e.console_errors.first, ['real']);
  assert.equal(e.failed_requests.count, 1);
  assert.equal(e.ignored.console_errors.count, 2);
  assert.equal(e.ignored.failed_requests.count, 1);
  assert.equal(e.result, 'fail');
});

test('hygiene: no banner click when none is visible, and no ignore flag means nothing is ignored', async () => {
  const pw = fakePlaywright({ failed: [{ url: 'http://localhost:3000/_edge/geo', status: 500 }] });
  const { d, home } = deps({ pw });
  await cmdCapture(d, capArgs());
  assert.deepEqual(pw.log.clicks, []);
  assert.equal(manifestOf(home)[0].failed_requests.count, 1);
});

test('pageerror events count as console errors', async () => {
  const { d, home } = deps({ pw: fakePlaywright({ pageErrors: ['Uncaught TypeError: x'] }) });
  await cmdCapture(d, capArgs());
  const [e] = manifestOf(home);
  assert.deepEqual(e.console_errors, { count: 1, first: ['Uncaught TypeError: x'] });
  assert.equal(e.result, 'fail');
});

test('tall pages are clipped to 3 viewport heights and recorded as truncated', async () => {
  const pw = fakePlaywright({ height: 5000 });
  const { d, home } = deps({ pw });
  await cmdCapture(d, capArgs(['--phone']));
  const [desktop, phone] = pw.log.screenshots;
  assert.deepEqual(desktop.clip, { x: 0, y: 0, width: 1728, height: 2991 });
  assert.deepEqual(phone.clip, { x: 0, y: 0, width: 393, height: 2556 });
  assert.ok(manifestOf(home).every((e) => e.truncated === true));

  const short = fakePlaywright({ height: 900 });
  const s2 = deps({ pw: short });
  await cmdCapture(s2.d, capArgs());
  assert.equal(short.log.screenshots[0].clip, undefined);
  assert.equal(manifestOf(s2.home)[0].truncated, false);
});

test('markdown appends (first 3 screens) to the caption of truncated shots', () => {
  const { d, home } = deps();
  seed(home, [entry({ phase: 'before', file: 'before/home-desktop.png', caption: 'Home', truncated: true })]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'plan' });
  assert.match(readFileSync(r.fragment_file, 'utf8'), /!\[Home \(first 3 screens\)\]\(\.\/before\/home-desktop\.png\)/);
});

test('a route with an unfilled segment is not exercised, other routes still run', async () => {
  const pw = fakePlaywright();
  const { d, home } = deps({ pw });
  const r = await cmdCapture(d, capArgs(['--route', '/courses/[courseSlug]']));
  const bySlug = Object.fromEntries(r.shots.map((s) => [s.route, s]));
  assert.equal(bySlug['/courses/[courseSlug]'].result, 'not-exercised');
  assert.equal(bySlug['/courses/[courseSlug]'].reason, 'route has unfilled segment');
  assert.equal(bySlug['/'].result, 'pass');
  assert.equal(pw.log.gotos.some((u) => u.includes('[')), false);
  assert.equal(manifestOf(home).length, 2);
});

test('stale auth: a signed-in shot on /sign-in deletes the state, signs in again and retries once', async () => {
  const project = mkdtempSync(join(tmpdir(), 'capture-ui-proj-'));
  writeFileSync(join(project, '.env'), 'FACTORY_TEST_EMAIL=me@example.com\nFACTORY_TEST_PASSWORD=hunter2\n');
  const pw = fakePlaywright({ signInLandings: 1 });
  const { d, home } = deps({ pw });
  const state = join(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1), 'auth', 'state.json');
  mkdirSync(join(state, '..'), { recursive: true });
  writeFileSync(state, '{"stale":true}');
  const r = await cmdCapture(d, { ...capArgs(['--sign-in']), project });
  assert.equal(r.shots[0].result, 'pass');
  assert.equal(pw.log.fills.length, 2);
  assert.notEqual(readFileSync(state, 'utf8'), '{"stale":true}');
});

test('stale auth: still on /sign-in after the retry records sign-in failed', async () => {
  const project = mkdtempSync(join(tmpdir(), 'capture-ui-proj-'));
  writeFileSync(join(project, '.env'), 'FACTORY_TEST_EMAIL=me@example.com\nFACTORY_TEST_PASSWORD=hunter2\n');
  const { d } = deps({ pw: fakePlaywright({ signInLandings: 2 }) });
  const r = await cmdCapture(d, { ...capArgs(['--sign-in']), project });
  assert.deepEqual([r.shots[0].result, r.shots[0].reason], ['not-exercised', 'sign-in failed']);
});

test('after gate: only errors the before entry lacked are new', async () => {
  const before = deps({ pw: fakePlaywright({ consoleErrors: ['old', 'shared'], failed: [{ url: 'http://localhost:3000/api/a?x=1', status: 404 }] }) });
  await cmdCapture(before.d, capArgs());
  const pw = fakePlaywright({
    consoleErrors: ['shared', 'fresh'],
    failed: [{ url: 'http://localhost:3000/api/a?x=2', status: 404 }, { url: 'http://localhost:3000/api/b', status: 500 }],
  });
  const d = { ...before.d, loadPlaywright: async () => pw };
  const after = parseArgs(['capture', '--repo', 'o/r', '--issue', '7', '--phase', 'after', '--base-url', 'http://localhost:3000', '--route', '/', '--project', tmpdir()]);
  await cmdCapture(d, after);
  const e = manifestOf(before.home).find((x) => x.phase === 'after');
  assert.deepEqual(e.new_errors, { console_errors: 1, failed_requests: 1 });
  assert.equal(e.pre_existing, 2);
  assert.equal(e.result, 'fail');
});

test('after gate: pre-existing errors alone pass, and no before entry makes every error new', async () => {
  const errs = { consoleErrors: ['old'] };
  const a = deps({ pw: fakePlaywright(errs) });
  await cmdCapture(a.d, capArgs());
  const after = parseArgs(['capture', '--repo', 'o/r', '--issue', '7', '--phase', 'after', '--base-url', 'http://localhost:3000', '--route', '/', '--project', tmpdir()]);
  await cmdCapture(a.d, after);
  const e = manifestOf(a.home).find((x) => x.phase === 'after');
  assert.equal(e.result, 'pass');
  assert.deepEqual(e.new_errors, { console_errors: 0, failed_requests: 0 });
  assert.equal(e.pre_existing, 1);

  const b = deps({ pw: fakePlaywright(errs) });
  await cmdCapture(b.d, after);
  const f = manifestOf(b.home)[0];
  assert.deepEqual(f.new_errors, { console_errors: 1, failed_requests: 0 });
  assert.equal(f.pre_existing, 0);
  assert.equal(f.result, 'fail');
});

test('before entries keep plain pass and fail and record base_sha', async () => {
  const { d, home } = deps({ pw: fakePlaywright({ consoleErrors: ['x'] }) });
  d.gitInfo = () => ({ sha: SHA, branch: 'feat/x', base_sha: 'd'.repeat(40) });
  await cmdCapture(d, capArgs());
  const [e] = manifestOf(home);
  assert.equal(e.result, 'fail');
  assert.equal(e.base_sha, 'd'.repeat(40));
  assert.equal(e.new_errors, undefined);
});

test('plan heading uses base_sha', () => {
  const { d, home } = deps();
  seed(home, [entry({ phase: 'before', file: 'before/home-desktop.png', sha: SHA, base_sha: 'e'.repeat(40) })]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'plan' });
  assert.match(readFileSync(r.fragment_file, 'utf8'), /### Current state \(main eeeeeee\)/);
});

test('markdown refuses only for images from a non-local host, not for not-exercised bullets', () => {
  const { d, home } = deps();
  seed(home, [
    entry({ phase: 'before', file: 'before/home-desktop.png' }),
    entry({ phase: 'before', route: '/x', url: 'https://example.com/x', file: null, result: 'not-exercised', reason: 'host not local' }),
  ]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'plan' });
  assert.match(readFileSync(r.fragment_file, 'utf8'), /- `\/x` \(desktop\): not exercised, host not local/);
});

// ---------- review fixes ----------

test('host guard rejects userinfo, lookalike and IPv6 hosts', () => {
  for (const u of ['http://localhost@evil.com', 'http://127.0.0.1.nip.io', 'http://[::1]:3000', 'ftp://localhost', 'file:///tmp/x']) {
    assert.equal(isLocalHost(u), false, u);
  }
});

test('routes that resolve off-host or hold control characters are usage errors', () => {
  const route = (r) => () => capArgsWith(r);
  const capArgsWith = (r) => parseArgs(['capture', '--repo', 'o/r', '--issue', '7', '--phase', 'before', '--base-url', 'http://localhost:3000', '--route', r, '--project', tmpdir()]);
  for (const r of ['//', '//evil.com', '//evil.com/x', '/\\evil.com', '/a\nb', '/a\u0000b', 'evil.com']) {
    assert.throws(route(r), UsageError, JSON.stringify(r));
  }
  assert.doesNotThrow(route('/a?next=//evil.com'));
});

test('base url must be http or https', () => {
  assert.throws(() => parseArgs(['capture', '--repo', 'o/r', '--issue', '7', '--phase', 'before', '--base-url', 'ftp://localhost', '--route', '/', '--project', '.']), UsageError);
});

test('a redirect off-host is not exercised and saves no PNG', async () => {
  const pw = fakePlaywright({ redirectTo: 'https://evil.example.com/' });
  const { d, home } = deps({ pw });
  const r = await cmdCapture(d, capArgs());
  assert.deepEqual([r.shots[0].result, r.shots[0].reason], ['not-exercised', 'redirected off-host']);
  assert.equal(pw.log.screenshots.length, 0);
  assert.equal(existsSync(join(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1), 'before')), false);
});

test('markdown injection: a hostile route stays in a code span and never reaches the attach list', () => {
  const { d, home } = deps();
  const evil = '/a?x=![z](./../../.ssh/id_rsa)`[b]';
  seed(home, [
    entry({ phase: 'before', route: evil, file: 'before/a-123456-desktop.png', caption: 'x](./../../.ssh/id_rsa) ![y' }),
    entry({ phase: 'before', route: '/z', file: null, result: 'not-exercised', reason: 'boom ![q](./../../etc/passwd)\nnext' }),
  ]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'plan' });
  assert.deepEqual(r.attach, ['./before/a-123456-desktop.png']);
  const md = readFileSync(r.fragment_file, 'utf8');
  assert.ok(md.includes('`/a?x=![z](./../../.ssh/id_rsa)[b]`'));
  assert.equal((md.replace(/`[^`\n]*`/g, '').match(/!\[/g) ?? []).length, 1);
  assert.ok(!r.stdout.includes('.ssh'));
  assert.ok(!r.stdout.includes('etc/passwd'));
  assert.ok(!md.includes('\nnext'));
});

test('markdown refuses an attach path outside the evidence layout', () => {
  const { d, home } = deps();
  seed(home, [entry({ phase: 'before', file: 'before/../../x.png' })]);
  assert.throws(() => cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'plan' }), RefusalError);
});

test('attach list equals the image refs in the body', () => {
  const { d, home } = deps();
  seed(home, [
    entry({ phase: 'before', file: 'before/home-aaaaaa-desktop.png' }),
    entry({ file: 'after/home-aaaaaa-desktop.png' }),
    entry({ phase: 'compare', file: 'compare/home-aaaaaa-desktop.png' }),
  ]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'pr' });
  const refs = [...readFileSync(r.fragment_file, 'utf8').matchAll(/!\[[^\]]*\]\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(refs)], r.attach);
  assert.deepEqual(r.attach, ['./compare/home-aaaaaa-desktop.png']);
});

test('a password in a thrown sign-in error never reaches stdout or the manifest', async () => {
  const project = mkdtempSync(join(tmpdir(), 'capture-ui-proj-'));
  writeFileSync(join(project, '.env'), 'FACTORY_TEST_EMAIL=me@example.com\nFACTORY_TEST_PASSWORD=s3cret-pw\n');
  const pw = fakePlaywright({ fillError: (value) => `cannot fill ${value}` });
  const { d, home } = deps({ pw });
  const out = await main(['capture', '--repo', 'o/r', '--issue', '7', '--phase', 'before', '--base-url', 'http://localhost:3000', '--route', '/', '--project', project, '--sign-in'], d);
  assert.ok(!out.includes('s3cret-pw'));
  assert.ok(!readFileSync(join(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1), 'manifest.json'), 'utf8').includes('s3cret-pw'));
  assert.equal(JSON.parse(out).shots[0].reason, 'sign-in failed');
});

test('newContext throwing inside sign-in or capture is recorded, not thrown', async () => {
  const project = mkdtempSync(join(tmpdir(), 'capture-ui-proj-'));
  writeFileSync(join(project, '.env'), 'FACTORY_TEST_EMAIL=a@b.c\nFACTORY_TEST_PASSWORD=pw\n');
  const a = deps({ pw: fakePlaywright({ contextError: 'ctx boom' }) });
  const r1 = await cmdCapture(a.d, { ...capArgs(['--sign-in']), project });
  assert.equal(r1.shots[0].reason, 'sign-in failed');
  const b = deps({ pw: fakePlaywright({ contextError: 'ctx boom' }) });
  const r2 = await cmdCapture(b.d, capArgs());
  assert.match(r2.shots[0].reason, /ctx boom/);
});

test('an unexpected error mid-capture marks the remaining shots and still closes the browser', async () => {
  const pw = fakePlaywright({ screenshotError: 'disk full' });
  const { d } = deps({ pw });
  const r = await cmdCapture(d, capArgs(['--route', '/b']));
  assert.ok(r.shots.every((s) => s.result === 'not-exercised' && /disk full/.test(s.reason)));
  assert.equal(pw.log.browserClosed, true);
});

test('a sign-in failure is cached: later shots are not-exercised without retrying', async () => {
  const project = mkdtempSync(join(tmpdir(), 'capture-ui-proj-'));
  writeFileSync(join(project, '.env'), 'FACTORY_TEST_EMAIL=a@b.c\nFACTORY_TEST_PASSWORD=pw\n');
  const pw = fakePlaywright({ signInLandings: 99 });
  const { d } = deps({ pw });
  const state = join(evidenceDir({ FACTORY_HOME: d.env.FACTORY_HOME }, 'o/r', 7, 1), 'auth', 'state.json');
  mkdirSync(join(state, '..'), { recursive: true });
  writeFileSync(state, '{}');
  await cmdCapture(d, { ...capArgs(['--sign-in', '--route', '/b', '--route', '/c']), project });
  const signIns = pw.log.gotos.filter((u) => u.endsWith('/sign-in')).length;
  assert.equal(signIns, 1);
});

test('compose drops compare entries and PNGs that no longer have a current pair', async () => {
  const pw = fakePlaywright();
  const { d, home } = deps({ pw });
  const dir = seed(home, [
    entry({ phase: 'before', file: 'before/home-aaaaaa-desktop.png' }),
    entry({ file: 'after/home-aaaaaa-desktop.png' }),
    entry({ phase: 'compare', route: '/old', file: 'compare/old-bbbbbb-desktop.png' }),
  ]);
  await cmdCompose(d, { repo: 'o/r', issue: 7, attempt: 1, project: tmpdir() });
  assert.equal(existsSync(join(dir, 'compare/old-bbbbbb-desktop.png')), false);
  assert.deepEqual(readManifest(dir).filter((e) => e.phase === 'compare').map((e) => e.route), ['/']);
});

test('compose skips pairs whose PNG is missing and waits for the images to load', async () => {
  const pw = fakePlaywright();
  const { d, home } = deps({ pw });
  const dir = seed(home, [entry({ phase: 'before', file: 'before/home-aaaaaa-desktop.png' }), entry({ file: 'after/home-aaaaaa-desktop.png' })]);
  rmSync(join(dir, 'after/home-aaaaaa-desktop.png'));
  assert.deepEqual((await cmdCompose(d, { repo: 'o/r', issue: 7, attempt: 1, project: tmpdir() })).composed, []);
  writeFileSync(join(dir, 'after/home-aaaaaa-desktop.png'), 'png');
  await cmdCompose(d, { repo: 'o/r', issue: 7, attempt: 1, project: tmpdir() });
  assert.ok(pw.log.waits.some(([k]) => k === 'images'));
});

test('compose never throws when the browser closes badly or mkdtemp-time work fails', async () => {
  const pw = fakePlaywright({ screenshotError: 'boom' });
  const { d, home } = deps({ pw });
  const dir = seed(home, [entry({ phase: 'before', file: 'before/home-aaaaaa-desktop.png' }), entry({ file: 'after/home-aaaaaa-desktop.png' })]);
  const r = await cmdCompose(d, { repo: 'o/r', issue: 7, attempt: 1, project: tmpdir() });
  assert.equal(r.composed[0].result, 'not-exercised');
  assert.equal(readManifest(dir).find((e) => e.phase === 'compare').reason, 'boom');
});

test('markdown pr ignores a compare image whose sha differs from the after entry', () => {
  const { d, home } = deps();
  seed(home, [
    entry({ phase: 'before', file: 'before/home-aaaaaa-desktop.png' }),
    entry({ file: 'after/home-aaaaaa-desktop.png', sha: 'f'.repeat(40) }),
    entry({ phase: 'compare', file: 'compare/home-aaaaaa-desktop.png' }),
  ]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'pr' });
  assert.deepEqual(r.attach, ['./before/home-aaaaaa-desktop.png', './after/home-aaaaaa-desktop.png']);
});

test('manifest: a corrupt file is an error, writes are atomic and locked', () => {
  const dir = mkdtempSync(join(tmpdir(), 'capture-ui-m-'));
  writeFileSync(join(dir, 'manifest.json'), '{nope');
  assert.throws(() => readManifest(dir), /corrupt/);
  assert.throws(() => withManifest(dir, (m) => m), /corrupt/);
  assert.equal(existsSync(join(dir, 'manifest.lock')), false);

  const ok = mkdtempSync(join(tmpdir(), 'capture-ui-m-'));
  withManifest(ok, () => [entry()]);
  assert.equal(readManifest(ok).length, 1);
  assert.deepEqual(readdirSync(ok).sort(), ['manifest.json']);
});

test('manifest lock: a fresh lock blocks, a stale lock is taken over', () => {
  const dir = mkdtempSync(join(tmpdir(), 'capture-ui-m-'));
  const lock = join(dir, 'manifest.lock');
  writeFileSync(lock, '');
  assert.throws(() => withManifest(dir, (m) => m, { waitMs: 60, staleMs: 60_000 }), /locked/);
  const old = new Date(Date.now() - 120_000);
  utimesSync(lock, old, old);
  withManifest(dir, () => [entry()], { waitMs: 60, staleMs: 60_000 });
  assert.equal(readManifest(dir).length, 1);
  assert.equal(existsSync(lock), false);
});

test('file names carry a hash so routes that slugify alike do not collide', () => {
  assert.equal(slugify('/a-b'), slugify('/a/b'));
  assert.notEqual(fileSlug('/a-b'), fileSlug('/a/b'));
  assert.match(fileSlug('/a/b'), /^a-b-[0-9a-f]{6}$/);
});

test('compare label uses base_sha', async () => {
  const pw = fakePlaywright();
  const { d, home } = deps({ pw });
  seed(home, [entry({ phase: 'before', file: 'before/home-aaaaaa-desktop.png', sha: SHA, base_sha: '9'.repeat(40) }), entry({ file: 'after/home-aaaaaa-desktop.png' })]);
  await cmdCompose(d, { repo: 'o/r', issue: 7, attempt: 1, project: tmpdir() });
  assert.match(pw.log.html.join('\n'), /Before: main 9999999/);
});

test('config: valid file is parsed, unknown keys and wrong types are usage errors', () => {
  assert.deepEqual(parseConfig('{"masks":["#a"],"phone":true}'), { masks: ['#a'], phone: true });
  assert.equal(parseConfig(JSON.stringify(CONFIG)).sign_in.path, '/sign-in');
  const bad = [
    '{', '[]', '{"nope":1}', '{"masks":"x"}', '{"masks":[1]}', '{"phone":"yes"}', '{"base_url":"ftp://x"}', '{"base_url":5}',
    '{"consent_button":""}', '{"sign_in":{"path":"/s"}}',
    JSON.stringify({ sign_in: { ...CONFIG.sign_in, extra: 1 } }),
    JSON.stringify({ sign_in: { ...CONFIG.sign_in, signed_in: { role: 'button' } } }),
    JSON.stringify({ sign_in: { ...CONFIG.sign_in, path: 'sign-in' } }),
  ];
  for (const text of bad) assert.throws(() => parseConfig(text), UsageError, text);
  assert.doesNotThrow(() => parseConfig(JSON.stringify({ sign_in: { ...CONFIG.sign_in, signed_in: '#me' } })));
});

test('config: masks, ignore_requests, hide_css and base_url come from the file, flags add to them', async () => {
  const pw = fakePlaywright({ failed: [{ url: 'http://localhost:3000/_edge/geo', status: 404 }] });
  const { d, home } = deps({ pw, config: { ...CONFIG, ignore_requests: ['/_edge/geo'], masks: ['#cfg'], hide_css: ['.hide{display:none}'] } });
  const o = parseArgs(['capture', '--repo', 'o/r', '--issue', '7', '--phase', 'before', '--route', '/', '--project', tmpdir(), '--mask', '.flag']);
  await cmdCapture(d, o);
  assert.deepEqual(pw.log.screenshots[0].mask.map((m) => m.selector), ['#cfg', '.flag']);
  assert.ok(pw.log.styles[0].includes('.hide{display:none}'));
  assert.equal(readManifest(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1))[0].failed_requests.count, 0);
});

test('config: phone default from the file adds the phone viewport', async () => {
  const pw = fakePlaywright();
  const { d } = deps({ pw, config: { ...CONFIG, phone: true } });
  const r = await cmdCapture(d, capArgs());
  assert.equal(r.shots.length, 2);
});

test('no config: no masks, no consent click, --sign-in is not exercised, a missing base url is a usage error', async () => {
  const pw = fakePlaywright({ cookieBanner: true });
  const { d } = deps({ pw, config: null });
  await cmdCapture(d, capArgs());
  assert.deepEqual(pw.log.clicks, []);
  assert.deepEqual(pw.log.screenshots[0].mask, []);
  const r = await cmdCapture(d, capArgs(['--sign-in']));
  assert.equal(r.shots[0].reason, 'no sign-in config');
  const o = parseArgs(['capture', '--repo', 'o/r', '--issue', '7', '--phase', 'before', '--route', '/', '--project', tmpdir()]);
  await assert.rejects(() => cmdCapture(d, o), UsageError);
});

test('stale-auth detection uses the configured sign-in path', async () => {
  const project = mkdtempSync(join(tmpdir(), 'capture-ui-proj-'));
  writeFileSync(join(project, '.env'), 'FACTORY_TEST_EMAIL=a@b.c\nFACTORY_TEST_PASSWORD=pw\n');
  const pw = fakePlaywright({ signInLandings: 1, signInPath: '/login' });
  const cfg = { ...CONFIG, sign_in: { ...CONFIG.sign_in, path: '/login' } };
  const { d } = deps({ pw, config: cfg });
  const r = await cmdCapture(d, { ...capArgs(['--sign-in']), project });
  assert.equal(r.shots[0].result, 'pass');
  assert.equal(pw.log.fills.length, 4);
});

test('detect reads globs from the config and notes a ui change without routes', () => {
  const { d } = deps({ config: { globs: ['web/**/*.vue'] } });
  const o = parseArgs(['detect', '--files', '-', '--project', tmpdir()]);
  d.readStdin = () => 'web/a/B.vue\napp/page.tsx\n';
  const out = cmdDetect(d, o);
  assert.deepEqual(out.matched, ['web/a/B.vue']);
  assert.equal(out.note, 'no page routes matched; choose routes from the plan');
  assert.equal(detect(['app/page.tsx']).note, undefined);
});

test('usage mentions the git command for the file list', async () => {
  const { d } = deps();
  assert.match(await main(['--help'], d), /git -c core\.quotepath=false diff --name-only/);
});

const afterArgs = () => parseArgs(['capture', '--repo', 'o/r', '--issue', '7', '--phase', 'after', '--base-url', 'http://localhost:3000', '--route', '/', '--project', tmpdir()]);

test('flaky gate: a new error in the first load only passes and is recorded as flaky', async () => {
  const pw = fakePlaywright({ consoleErrors: ['blip'], failed: [{ url: 'http://localhost:3000/api/x', status: 500 }], reloadConsoleErrors: [], reloadFailed: [] });
  const { d, home } = deps({ pw });
  await cmdCapture(d, afterArgs());
  const [e] = manifestOf(home);
  assert.equal(pw.log.reloads, 1);
  assert.equal(e.result, 'pass');
  assert.deepEqual(e.new_errors, { console_errors: 0, failed_requests: 0 });
  assert.equal(e.flaky.count, 2);
  assert.equal(e.flaky.first.length, 2);
});

test('flaky gate: a new error in both loads fails', async () => {
  const pw = fakePlaywright({ consoleErrors: ['real', 'blip'], reloadConsoleErrors: ['real'] });
  const { d, home } = deps({ pw });
  await cmdCapture(d, afterArgs());
  const [e] = manifestOf(home);
  assert.equal(e.result, 'fail');
  assert.deepEqual(e.new_errors, { console_errors: 1, failed_requests: 0 });
  assert.deepEqual(e.flaky, { count: 1, first: ['blip'] });
});

test('flaky gate: no reload when the first load has no new errors, and before shots never reload', async () => {
  const clean = fakePlaywright();
  const a = deps({ pw: clean });
  await cmdCapture(a.d, afterArgs());
  assert.equal(clean.log.reloads, 0);
  assert.deepEqual(manifestOf(a.home)[0].flaky, { count: 0, first: [] });
  const noisy = fakePlaywright({ consoleErrors: ['x'] });
  const b = deps({ pw: noisy });
  await cmdCapture(b.d, capArgs());
  assert.equal(noisy.log.reloads, 1);
});

test('flaky gate: errors already present before are pre-existing, not flaky', async () => {
  const a = deps({ pw: fakePlaywright({ consoleErrors: ['old'] }) });
  await cmdCapture(a.d, capArgs());
  const pw = fakePlaywright({ consoleErrors: ['old'] });
  await cmdCapture({ ...a.d, loadPlaywright: async () => pw }, afterArgs());
  const e = manifestOf(a.home).find((x) => x.phase === 'after');
  assert.equal(pw.log.reloads, 0);
  assert.equal(e.pre_existing, 1);
  assert.equal(e.result, 'pass');
});

test('markdown pr table shows the Flaky count', () => {
  const { d, home } = deps();
  seed(home, [
    entry({ phase: 'before', file: 'before/home-aaaaaa-desktop.png' }),
    entry({ file: 'after/home-aaaaaa-desktop.png', new_errors: { console_errors: 0, failed_requests: 0 }, pre_existing: 2, flaky: { count: 3, first: [] } }),
  ]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'pr' });
  assert.match(readFileSync(r.fragment_file, 'utf8'), /\| `\/` \| desktop \| 0 \| 0 \| 2 \| 3 \| pass \| a1b2c3d \|/);
});

const signInProject = () => {
  const project = mkdtempSync(join(tmpdir(), 'capture-ui-proj-'));
  writeFileSync(join(project, '.env'), 'FACTORY_TEST_EMAIL=me@example.com\nFACTORY_TEST_PASSWORD=hunter2\nSECRET_TOKEN=abc\n');
  return project;
};

test('sign-in: a page that reports an off-host URL after goto never receives fill calls', async () => {
  const pw = fakePlaywright({ redirectTo: 'https://evil.example.com/sign-in' });
  const { d } = deps({ pw });
  const r = await cmdCapture(d, { ...capArgs(['--sign-in']), project: signInProject() });
  assert.equal(pw.log.fills.length, 0);
  assert.equal(pw.log.submitClicks, 0);
  assert.deepEqual([r.shots[0].result, r.shots[0].reason], ['not-exercised', 'sign-in failed']);
});

test('sign-in: an origin change before submit stops the click', async () => {
  const pw = fakePlaywright({ driftAfterFill: 'https://evil.example.com/' });
  const { d } = deps({ pw });
  const r = await cmdCapture(d, { ...capArgs(['--sign-in']), project: signInProject() });
  assert.equal(pw.log.submitClicks, 0);
  assert.equal(r.shots[0].reason, 'sign-in failed');
});

test('sign-in: a same-host, other-port page is not the base origin', async () => {
  const pw = fakePlaywright({ redirectTo: 'http://localhost:4000/sign-in' });
  const { d } = deps({ pw });
  await cmdCapture(d, { ...capArgs(['--sign-in']), project: signInProject() });
  assert.equal(pw.log.fills.length, 0);
});

test('config: sign_in.path must be a single-slash path without control characters', async () => {
  for (const path of ['//evil.com', '/\\evil.com', '/a\nb', 'sign-in']) {
    assert.throws(() => parseConfig(JSON.stringify({ sign_in: { ...CONFIG.sign_in, path } })), UsageError, path);
  }
  const { d } = deps({ pw: fakePlaywright(), config: { ...CONFIG, sign_in: { ...CONFIG.sign_in, path: '//evil.com' } } });
  await assert.rejects(() => cmdCapture(d, { ...capArgs(['--sign-in']), project: signInProject() }), UsageError);
});

test('config: env names must match FACTORY_TEST_[A-Z0-9_]+ so a config cannot name other secrets', () => {
  for (const name of ['HOME', 'SECRET_TOKEN', 'FACTORY_TEST_', 'factory_test_email', 'FACTORY_TEST_a', 'AWS_SECRET_ACCESS_KEY']) {
    assert.throws(() => parseConfig(JSON.stringify({ sign_in: { ...CONFIG.sign_in, env_email: name } })), UsageError, name);
    assert.throws(() => parseConfig(JSON.stringify({ sign_in: { ...CONFIG.sign_in, env_password: name } })), UsageError, name);
  }
  assert.doesNotThrow(() => parseConfig(JSON.stringify({ sign_in: { ...CONFIG.sign_in, env_email: 'FACTORY_TEST_EMAIL_2', env_password: 'FACTORY_TEST_PW' } })));
});

test('before: each page loads twice, one screenshot, baseline is the union of both loads', async () => {
  const pw = fakePlaywright({ consoleErrors: ['a', 'shared'], reloadConsoleErrors: ['shared', 'b'], failed: [{ url: 'http://localhost:3000/api/p', status: 404 }], reloadFailed: [{ url: 'http://localhost:3000/api/q', status: 500 }] });
  const { d, home } = deps({ pw });
  await cmdCapture(d, capArgs());
  const [e] = manifestOf(home);
  assert.equal(pw.log.reloads, 1);
  assert.equal(pw.log.screenshots.length, 1);
  assert.deepEqual(e.raw.console, ['a', 'shared', 'b']);
  assert.deepEqual(e.raw.failed, ['/api/p|404', '/api/q|500']);
  assert.equal(e.console_errors.count, 3);
  assert.equal(e.failed_requests.count, 2);
  assert.equal(e.result, 'fail');
});

test('before baseline from both loads keeps a flaky request out of the after gate', async () => {
  const b = deps({ pw: fakePlaywright({ consoleErrors: [], reloadConsoleErrors: ['sometimes'] }) });
  await cmdCapture(b.d, capArgs());
  const pw = fakePlaywright({ consoleErrors: ['sometimes'] });
  await cmdCapture({ ...b.d, loadPlaywright: async () => pw }, afterArgs());
  const e = manifestOf(b.home).find((x) => x.phase === 'after');
  assert.equal(e.result, 'pass');
  assert.equal(e.pre_existing, 1);
});

test('signed-in proof: shown before every signed-in screenshot, not checked without --sign-in', async () => {
  const project = signInProject();
  const pw = fakePlaywright();
  const { d } = deps({ pw });
  await cmdCapture(d, { ...capArgs(['--sign-in']), project });
  assert.ok(pw.log.waits.some(([n, st, where]) => n === 'Manage account' && st === 'visible' && where === 'shot'));
  const plain = fakePlaywright();
  await cmdCapture(deps({ pw: plain }).d, capArgs());
  assert.ok(!plain.log.waits.some(([, , where]) => where === 'shot'));
});

test('signed-in proof missing once: stale auth, sign in again, retry passes', async () => {
  const project = signInProject();
  const pw = fakePlaywright({ proofMisses: 1 });
  const { d, home } = deps({ pw });
  const state = join(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1), 'auth', 'state.json');
  mkdirSync(join(state, '..'), { recursive: true });
  writeFileSync(state, '{"stale":true}');
  const r = await cmdCapture(d, { ...capArgs(['--sign-in']), project });
  assert.equal(r.shots[0].result, 'pass');
  assert.equal(pw.log.fills.length, 2);
  assert.notEqual(readFileSync(state, 'utf8'), '{"stale":true}');
});

test('signed-in proof still missing after the retry: not exercised, no PNG, later shots skipped', async () => {
  const project = signInProject();
  const pw = fakePlaywright({ proofMisses: 99 });
  const { d, home } = deps({ pw });
  const r = await cmdCapture(d, { ...capArgs(['--sign-in', '--route', '/b']), project });
  assert.deepEqual(r.shots.map((s) => [s.result, s.reason]), [['not-exercised', 'signed-in state not confirmed'], ['not-exercised', 'signed-in state not confirmed']]);
  assert.equal(pw.log.screenshots.length, 0);
  assert.equal(existsSync(join(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1), 'before')), false);
});

test('markdown pr lists an identical not-exercised bullet once', () => {
  const { d, home } = deps();
  const skip = { route: '/p', file: null, result: 'not-exercised', reason: 'signed-in state not confirmed', viewport: { name: 'phone', width: 393, height: 852 } };
  seed(home, [entry({ phase: 'before', ...skip }), entry({ ...skip })]);
  const md = readFileSync(cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'pr' }).fragment_file, 'utf8');
  assert.equal(md.split('not exercised, signed-in state not confirmed').length - 1, 1);
});

const PHONE_CONFIG = { ...CONFIG, sign_in: { ...CONFIG.sign_in, signed_in_phone: { role: 'button', name: 'Sign out' }, open: 'Open main menu' } };
const phoneArgs = (phase = 'mockup') => parseArgs(['capture', '--repo', 'o/r', '--issue', '7', '--phase', phase, '--base-url', 'http://localhost:3000', '--route', '/', '--project', tmpdir(), '--phone', '--sign-in']);

test('phone shots use signed_in_phone, desktop keeps signed_in', async () => {
  const pw = fakePlaywright();
  const { d } = deps({ pw, config: PHONE_CONFIG });
  const r = await cmdCapture(d, { ...phoneArgs(), project: signInProject() });
  assert.deepEqual(r.shots.map((s) => s.result), ['pass', 'pass']);
  const proofs = pw.log.waits.filter(([, , where]) => where === 'shot').map(([n]) => n);
  assert.deepEqual(proofs, ['Manage account', 'Sign out']);
});

test('phone without signed_in_phone falls back to signed_in and clicks no menu', async () => {
  const pw = fakePlaywright();
  const { d } = deps({ pw });
  await cmdCapture(d, { ...phoneArgs(), project: signInProject() });
  const proofs = pw.log.waits.filter(([, , where]) => where === 'shot').map(([n]) => n);
  assert.deepEqual(proofs, ['Manage account', 'Manage account']);
  assert.ok(!pw.log.clicks.includes('Open main menu'));
});

test('open: the menu button is clicked before the proof and closed with Escape before the screenshot', async () => {
  const pw = fakePlaywright();
  const { d } = deps({ pw, config: PHONE_CONFIG });
  await cmdCapture(d, { ...phoneArgs(), project: signInProject() });
  assert.deepEqual(pw.log.clicks, ['Open main menu']);
  assert.deepEqual(pw.log.keys, ['Escape']);
  assert.equal(pw.log.evals.filter((f) => f.includes('blur')).length, 1);
  assert.ok(pw.log.waits.some(([n, st]) => n === 'dialog' && st === 'hidden'));
  assert.equal(pw.log.reloads, 0);
  assert.equal(pw.log.screenshots.length, 2);
});

test('open: a menu that stays open triggers a reload with hygiene re-run before the screenshot', async () => {
  const pw = fakePlaywright({ menuStuck: true });
  const { d } = deps({ pw, config: PHONE_CONFIG });
  await cmdCapture(d, { ...phoneArgs(), project: signInProject() });
  assert.equal(pw.log.reloads, 1);
  assert.equal(pw.log.styles.length, 3);
});

test('missing phone proof follows the stale-auth path, then records signed-in state not confirmed', async () => {
  const project = signInProject();
  const pw = fakePlaywright({ proofMisses: 99, proofMissName: 'Sign out' });
  const { d, home } = deps({ pw, config: PHONE_CONFIG });
  const state = join(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1), 'auth', 'state.json');
  mkdirSync(join(state, '..'), { recursive: true });
  writeFileSync(state, '{"stale":true}');
  const r = await cmdCapture(d, { ...phoneArgs(), project });
  assert.deepEqual(r.shots.map((s) => [s.viewport, s.result, s.reason ?? '']), [['desktop', 'pass', ''], ['phone', 'not-exercised', 'signed-in state not confirmed']]);
  assert.equal(pw.log.fills.length, 2);
  assert.equal(pw.log.screenshots.length, 1);
});

test('missing phone proof once recovers after a fresh sign-in', async () => {
  const project = signInProject();
  const pw = fakePlaywright({ proofMisses: 1, proofMissName: 'Sign out' });
  const { d, home } = deps({ pw, config: PHONE_CONFIG });
  const state = join(evidenceDir({ FACTORY_HOME: home }, 'o/r', 7, 1), 'auth', 'state.json');
  mkdirSync(join(state, '..'), { recursive: true });
  writeFileSync(state, '{"stale":true}');
  const r = await cmdCapture(d, { ...phoneArgs(), project });
  assert.deepEqual(r.shots.map((s) => s.result), ['pass', 'pass']);
  assert.equal(pw.log.fills.length, 2);
});

test('config: signed_in_phone and open are validated strictly', () => {
  assert.doesNotThrow(() => parseConfig(JSON.stringify(PHONE_CONFIG)));
  assert.doesNotThrow(() => parseConfig(JSON.stringify({ sign_in: { ...CONFIG.sign_in, signed_in_phone: '#menu-user' } })));
  for (const extra of [
    { signed_in_phone: {} }, { signed_in_phone: { role: 'button' } }, { signed_in_phone: { role: 'button', name: 'x', extra: 1 } }, { signed_in_phone: 5 }, { signed_in_phone: '' },
    { open: '' }, { open: 5 }, { open: { role: 'button' } },
  ]) {
    assert.throws(() => parseConfig(JSON.stringify({ sign_in: { ...CONFIG.sign_in, ...extra } })), UsageError, JSON.stringify(extra));
  }
});

test('markdown plan in a public repo lists every shot as not exercised and prints no attach', () => {
  const { d, home } = deps({ isPrivate: false });
  const dir = seed(home, [
    entry({ phase: 'before', file: 'before/home-desktop.png' }),
    entry({ phase: 'mockup', file: 'mockup/home-desktop.png', caption: 'Mockup, not implemented' }),
    entry({ phase: 'before', route: '/p', file: null, result: 'not-exercised', reason: 'sign-in failed' }),
  ]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'plan' });
  const md = readFileSync(join(dir, 'images-plan.md'), 'utf8');
  assert.ok(!md.includes('!['));
  assert.match(md, /- `\/` \(desktop\): not exercised, repository is public, images not attached/);
  assert.match(md, /- `\/p` \(desktop\): not exercised, sign-in failed/);
  assert.deepEqual(r.attach, []);
  assert.ok(!r.stdout.includes('attach:'));
  assert.ok(!r.stdout.includes('--attach'));
  assert.match(r.stdout, /gh issue comment 7 --repo o\/r --body-file <body\.md>$/);
});

test('markdown pr in a public repo keeps the table, drops images and prints no attach', () => {
  const { d, home } = deps({ isPrivate: false });
  const dir = seed(home, [
    entry({ phase: 'before', file: 'before/home-desktop.png' }),
    entry(),
    entry({ phase: 'compare', file: 'compare/home-desktop.png', caption: 'Home, before and after' }),
  ]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'pr' });
  const md = readFileSync(join(dir, 'images-pr.md'), 'utf8');
  assert.ok(!md.includes('!['));
  assert.match(md, /\| `\/` \| desktop \| 0 \| 0 \| 0 \| 0 \| pass \| a1b2c3d \|/);
  assert.match(md, /- `\/` \(desktop\): not exercised, repository is public, images not attached/);
  assert.deepEqual(r.attach, []);
  assert.ok(!r.stdout.includes('--attach'));
});

test('markdown treats a failed visibility check as not private', () => {
  const { d, home } = deps({ privateError: 'gh: not logged in' });
  const dir = seed(home, [entry({ phase: 'before', file: 'before/home-desktop.png' })]);
  const r = cmdMarkdown(d, { repo: 'o/r', issue: 7, attempt: 1, for: 'plan' });
  const md = readFileSync(join(dir, 'images-plan.md'), 'utf8');
  assert.match(md, /not exercised, repository visibility unknown, images not attached/);
  assert.deepEqual(r.attach, []);
  assert.ok(!r.stdout.includes('--attach'));
});
