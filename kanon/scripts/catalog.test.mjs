import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const script = path.join(here, 'catalog.mjs');
const fixtures = path.join(here, 'fixtures');
const ORCH_REF = 'kanon/laravel-kanon/references/orchestration-di.md';
const ORCH_JSON = 'kanon/catalog/orchestration-di.json';

const read = (root, rel) => readFileSync(path.join(root, rel), 'utf8');
const readJson = (root, rel) => JSON.parse(read(root, rel));
const writeJson = (root, rel, data) =>
  writeFileSync(path.join(root, rel), JSON.stringify(data, null, 2) + '\n');
const collapse = (text) => text.replace(/\s+/g, ' ').trim();
const stripIds = (text) => text.replace(/`[A-Z]+-\d{3}` /g, '');

// A copy of the repo's catalog and the reference of every family that has a catalog file, in a temp root.
// `check` compares each family's reference, so a root that lacks one fails with a problem the test did not cause.
function makeRoot(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'kanon-catalog-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(path.join(repoRoot, 'kanon', 'catalog'), path.join(root, 'kanon', 'catalog'), {
    recursive: true,
  });
  const rows = JSON.parse(readFileSync(path.join(repoRoot, 'kanon', 'catalog', 'families.json'), 'utf8'));
  for (const row of rows) {
    if (!existsSync(path.join(repoRoot, 'kanon', 'catalog', `${row.family}.json`))) continue;
    mkdirSync(path.join(root, path.dirname(row.reference)), { recursive: true });
    cpSync(path.join(repoRoot, row.reference), path.join(root, row.reference));
  }
  return root;
}

function run(root, ...args) {
  const r = spawnSync(process.execPath, [script, ...args, '--root', root], { encoding: 'utf8' });
  const out = r.stdout + r.stderr;
  return { status: r.status, out, lines: out.split('\n').filter(Boolean) };
}

// Where an entry sits in a catalog object: sections[s].entries[e].
function find(cat, id) {
  for (const [s, sec] of cat.sections.entries()) {
    for (const [e, entry] of sec.entries.entries()) {
      if (entry.id === id) return { s, e, entry, sec };
    }
  }
  throw new Error(`no entry ${id}`);
}

function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
  });
}

// A temp git repo whose local config does not depend on the machine's global config.
function makeRepo(t) {
  const dir = makeRoot(t);
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.name', 'Catalog Test');
  git(dir, 'config', 'user.email', 'catalog-test@example.invalid');
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'config', 'core.hooksPath', '/dev/null');
  return dir;
}

function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', message);
  return git(dir, 'rev-parse', 'HEAD').trim();
}

// A one-entry catalog for a second family; `id` lets a test reuse another family's ID.
const httpApiCatalog = (id = 'HTTP-001') => ({
  family: 'http-api',
  title: 'HTTP',
  intro: [],
  sections: [
    {
      heading: 'Routes',
      intro: [],
      list: 'bullet',
      entries: [
        {
          id,
          family: 'http-api',
          scope: 'laravel',
          keyword: 'MUST',
          rule: 'Routes **MUST** be named.',
          status: 'active',
        },
      ],
    },
  ],
});

test('repo catalog passes check', () => {
  const r = run(repoRoot, 'check');
  assert.equal(r.status, 0, r.out);
});

test('repo catalog passes check --base origin/main', (t) => {
  try {
    execFileSync('git', ['-C', repoRoot, 'rev-parse', '--verify', '--quiet', 'origin/main^{commit}'], {
      stdio: 'ignore',
    });
  } catch {
    t.skip('origin/main is not in this clone; the recipe gate still needs it');
    return;
  }
  const r = run(repoRoot, 'check', '--base', 'origin/main');
  assert.equal(r.status, 0, r.out);
});

test('entry with no keyword fails and names the file, the entry and its ID', (t) => {
  const root = makeRoot(t);
  const cat = readJson(root, ORCH_JSON);
  const { s, e, entry } = find(cat, 'ORCH-005');
  delete entry.keyword;
  writeJson(root, ORCH_JSON, cat);
  const r = run(root, 'check');
  assert.equal(r.status, 1);
  assert.equal(r.lines.length, 1, r.out);
  assert.ok(r.lines[0].includes(ORCH_JSON), r.out);
  assert.ok(r.lines[0].includes(`sections[${s}].entries[${e}]`), r.out);
  assert.ok(r.lines[0].includes('(ORCH-005)'), r.out);
  assert.ok(r.lines[0].includes('"keyword"'), r.out);
});

test('two entries sharing an ID in one file fail and name both entries', (t) => {
  const root = makeRoot(t);
  const cat = readJson(root, ORCH_JSON);
  const first = find(cat, 'ORCH-009');
  const second = find(cat, 'ORCH-010');
  second.entry.id = 'ORCH-009';
  writeJson(root, ORCH_JSON, cat);
  const r = run(root, 'check');
  assert.equal(r.status, 1);
  const line = r.lines.find((l) => l.includes('duplicate ID'));
  assert.ok(line, r.out);
  assert.ok(line.includes('(ORCH-009)'), line);
  assert.ok(line.includes(`sections[${second.s}].entries[${second.e}]`), line);
  assert.ok(line.includes(`sections[${first.s}].entries[${first.e}]`), line);
});

test('two entries sharing an ID across two files fail and name both entries', (t) => {
  const root = makeRoot(t);
  const orch = find(readJson(root, ORCH_JSON), 'ORCH-001');
  writeJson(root, 'kanon/catalog/http-api.json', httpApiCatalog('ORCH-001'));
  const r = run(root, 'check');
  assert.equal(r.status, 1);
  const line = r.lines.find((l) => l.includes('duplicate ID'));
  assert.ok(line, r.out);
  assert.ok(line.includes('kanon/catalog/http-api.json'), line);
  assert.ok(line.includes(ORCH_JSON), line);
  assert.ok(line.includes(`sections[${orch.s}].entries[${orch.e}]`), line);
  assert.ok(line.includes('sections[0].entries[0]'), line);
});

test('reference edited by hand fails and names the reference, the line and its ID', (t) => {
  const root = makeRoot(t);
  const lines = read(root, ORCH_REF).split('\n');
  const at = lines.findIndex((l) => l.startsWith('- `ORCH-005`'));
  assert.ok(at > 0);
  lines[at] = lines[at].replace('**MUST**', '**SHOULD**');
  writeFileSync(path.join(root, ORCH_REF), lines.join('\n'));
  const r = run(root, 'check');
  assert.equal(r.status, 1);
  assert.equal(r.lines.length, 1, r.out);
  assert.ok(r.lines[0].includes(ORCH_REF), r.out);
  assert.ok(r.lines[0].includes(`line ${at + 1}`), r.out);
  assert.ok(r.lines[0].includes('(ORCH-005)'), r.out);
});

test('an edited nested line names the ID of the entry it belongs to', (t) => {
  const root = makeRoot(t);
  const lines = read(root, ORCH_REF).split('\n');
  const at = lines.findIndex((l) => l.startsWith('  - `config()`'));
  assert.ok(at > 0);
  lines[at] += ' edited';
  writeFileSync(path.join(root, ORCH_REF), lines.join('\n'));
  const r = run(root, 'check');
  assert.equal(r.status, 1);
  assert.ok(r.lines[0].includes(`line ${at + 1}`), r.out);
  assert.ok(r.lines[0].includes('(ORCH-008)'), r.out);
});

test('a missing reference fails and names it', (t) => {
  const root = makeRoot(t);
  rmSync(path.join(root, ORCH_REF));
  const r = run(root, 'check');
  assert.equal(r.status, 1);
  assert.ok(r.lines[0].includes(ORCH_REF), r.out);
});

// A second family with its generated reference must not change what a single-problem test reports.
test('a second family that is in order adds no problem to a one-problem result', (t) => {
  const root = makeRoot(t);
  writeJson(root, 'kanon/catalog/http-api.json', httpApiCatalog());
  const gen = run(root, 'generate');
  assert.equal(gen.status, 0, gen.out);
  assert.equal(run(root, 'check').status, 0);

  const cat = readJson(root, ORCH_JSON);
  const { s, e, entry } = find(cat, 'ORCH-005');
  delete entry.keyword;
  writeJson(root, ORCH_JSON, cat);
  const r = run(root, 'check');
  assert.equal(r.status, 1);
  assert.equal(r.lines.length, 1, r.out);
  assert.ok(r.lines[0].includes(`sections[${s}].entries[${e}] (ORCH-005)`), r.out);
});

test('keyword that differs from the first bold keyword in rule fails', (t) => {
  const root = makeRoot(t);
  const cat = readJson(root, ORCH_JSON);
  const { s, e, entry } = find(cat, 'ORCH-005');
  assert.equal(entry.keyword, 'MUST');
  entry.keyword = 'SHOULD';
  writeJson(root, ORCH_JSON, cat);
  const r = run(root, 'check');
  assert.equal(r.status, 1);
  assert.equal(r.lines.length, 1, r.out);
  assert.ok(r.lines[0].includes(`sections[${s}].entries[${e}] (ORCH-005)`), r.out);
  assert.ok(r.lines[0].includes('keyword'), r.out);
});

test('ID with another family prefix fails', (t) => {
  const root = makeRoot(t);
  const cat = readJson(root, ORCH_JSON);
  find(cat, 'ORCH-005').entry.id = 'HTTP-005';
  writeJson(root, ORCH_JSON, cat);
  writeFileSync(
    path.join(root, ORCH_REF),
    read(root, ORCH_REF).replace('`ORCH-005`', '`HTTP-005`')
  );
  const r = run(root, 'check');
  assert.equal(r.status, 1);
  assert.equal(r.lines.length, 1, r.out);
  assert.ok(r.lines[0].includes('(HTTP-005)'), r.out);
  assert.ok(r.lines[0].includes('ORCH'), r.out);
});

test('a deprecated entry is left out, and a new entry with its ID fails check', (t) => {
  const root = makeRoot(t);
  const cat = readJson(root, ORCH_JSON);
  const { sec, entry } = find(cat, 'ORCH-005');
  entry.status = 'deprecated';
  writeJson(root, ORCH_JSON, cat);

  const gen = run(root, 'generate');
  assert.equal(gen.status, 0, gen.out);
  const text = read(root, ORCH_REF);
  assert.ok(!text.includes('ORCH-005'));
  assert.ok(!text.includes('recoverIfPastDue'));
  assert.ok(text.includes('`ORCH-004`') && text.includes('`ORCH-006`'));
  assert.equal(run(root, 'check').status, 0);

  sec.entries.push({ ...entry, status: 'active' });
  writeJson(root, ORCH_JSON, cat);
  const r = run(root, 'check');
  assert.equal(r.status, 1);
  assert.ok(r.lines.some((l) => l.includes('duplicate ID') && l.includes('(ORCH-005)')), r.out);
});

test('an ID removed since the base ref fails check --base', (t) => {
  const dir = makeRepo(t);
  const base = commit(dir, 'base');
  assert.equal(run(dir, 'check', '--base', base).status, 0);

  const cat = readJson(dir, ORCH_JSON);
  const { sec, e } = find(cat, 'ORCH-005');
  sec.entries.splice(e, 1);
  writeJson(dir, ORCH_JSON, cat);
  assert.equal(run(dir, 'generate').status, 0);
  assert.equal(run(dir, 'check').status, 0, 'without --base the removal is not a problem');

  const r = run(dir, 'check', '--base', base);
  assert.equal(r.status, 1);
  assert.equal(r.lines.length, 1, r.out);
  assert.ok(r.lines[0].includes('ORCH-005'), r.out);
  assert.ok(r.lines[0].includes(ORCH_JSON), r.out);
  assert.ok(r.lines[0].includes(base), r.out);
});

test('check --base passes when the base ref has no catalog', (t) => {
  const dir = makeRepo(t);
  const empty = mkdtempSync(path.join(tmpdir(), 'kanon-empty-'));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  // Base commit: a repo with no kanon/catalog directory at all.
  git(empty, 'init', '-q');
  git(empty, 'config', 'user.name', 'Catalog Test');
  git(empty, 'config', 'user.email', 'catalog-test@example.invalid');
  git(empty, 'config', 'commit.gpgsign', 'false');
  git(empty, 'config', 'core.hooksPath', '/dev/null');
  writeFileSync(path.join(empty, 'README.md'), 'no catalog yet\n');
  const noCatalog = commit(empty, 'no catalog');
  // Fetch that commit into the repo that has the catalog on disk.
  git(dir, 'fetch', '-q', empty, noCatalog);
  const r = run(dir, 'check', '--base', noCatalog);
  assert.equal(r.status, 0, r.out);
});

// A base ref that no commit of HEAD descends from (unrelated histories) has no merge-base; the ref tip is read.
test('check --base reads the IDs at the merge-base, not at the tip of the ref', (t) => {
  const dir = makeRepo(t);
  commit(dir, 'base');
  git(dir, 'branch', '-M', 'main');
  git(dir, 'checkout', '-q', '-b', 'feature');
  git(dir, 'checkout', '-q', 'main');
  writeJson(dir, 'kanon/catalog/http-api.json', httpApiCatalog());
  assert.equal(run(dir, 'generate').status, 0);
  commit(dir, 'main gains a family');
  git(dir, 'checkout', '-q', 'feature');

  const behind = run(dir, 'check', '--base', 'main');
  assert.equal(behind.status, 0, 'a branch behind main must not be asked to keep IDs it never had');

  const cat = readJson(dir, ORCH_JSON);
  const { sec, e } = find(cat, 'ORCH-005');
  sec.entries.splice(e, 1);
  writeJson(dir, ORCH_JSON, cat);
  assert.equal(run(dir, 'generate').status, 0);
  const r = run(dir, 'check', '--base', 'main');
  assert.equal(r.status, 1, 'an ID present at the merge-base is still protected');
  assert.equal(r.lines.length, 1, r.out);
  assert.ok(r.lines[0].includes('ORCH-005'), r.out);
  assert.ok(!r.out.includes('HTTP-001'), r.out);
});

test('check --base fails when the ref does not exist', (t) => {
  const dir = makeRepo(t);
  commit(dir, 'base');
  const r = run(dir, 'check', '--base', 'origin/nope');
  assert.equal(r.status, 1);
  assert.ok(r.out.includes('origin/nope'), r.out);
  assert.ok(r.out.includes('does not exist'), r.out);
});

test('the validator throws on a schema keyword it does not implement', async () => {
  const { validate } = await import('./catalog.mjs');
  assert.throws(() => validate({ type: 'string', minLength: 1 }, 'x'), /minLength/);
  assert.throws(
    () => validate({ $defs: { a: { type: 'string', format: 'email' } }, type: 'string' }, 'x'),
    /format/
  );
  // A bad keyword in a oneOf branch is found even when an earlier branch matches.
  assert.throws(
    () => validate({ oneOf: [{ type: 'string' }, { type: 'number', multipleOf: 2 }] }, 'x'),
    /multipleOf/
  );
  // A property that happens to be named like a keyword is a name, not a keyword.
  assert.deepEqual(
    validate({ type: 'object', properties: { items: { type: 'string' } } }, { items: 'x' }),
    []
  );
});

test('check fails when schema.json uses a keyword the validator lacks', (t) => {
  const root = makeRoot(t);
  const schema = readJson(root, 'kanon/catalog/schema.json');
  schema.$defs.entry.properties.rule.minLength = 3;
  writeJson(root, 'kanon/catalog/schema.json', schema);
  const r = run(root, 'check');
  assert.equal(r.status, 1);
  assert.ok(r.out.includes('minLength'), r.out);
});

test('the validator enforces type, required, enum, pattern, items, minItems and additionalProperties', async () => {
  const { validate } = await import('./catalog.mjs');
  const schema = {
    type: 'object',
    required: ['id', 'kind'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', pattern: '^[A-Z]+-[0-9]{3}$' },
      kind: { enum: ['a', 'b'] },
      list: { type: 'array', minItems: 1, items: { type: 'string' } },
    },
  };
  const messages = (data) => validate(schema, data).map((e) => e.message);
  assert.deepEqual(messages({ id: 'ORCH-001', kind: 'a', list: ['x'] }), []);
  assert.match(messages({ kind: 'a' }).join('\n'), /missing required property "id"/);
  assert.match(messages({ id: 'orch-1', kind: 'a' }).join('\n'), /pattern/);
  assert.match(messages({ id: 'ORCH-001', kind: 'c' }).join('\n'), /one of/);
  assert.match(messages({ id: 'ORCH-001', kind: 'a', extra: 1 }).join('\n'), /unknown property "extra"/);
  assert.match(messages({ id: 'ORCH-001', kind: 'a', list: [] }).join('\n'), /at least 1/);
  assert.match(messages({ id: 'ORCH-001', kind: 'a', list: [1] }).join('\n'), /expected string/);
  assert.match(messages(['x']).join('\n'), /expected object/);
});

test('words and code spans match the original reference (criterion 2)', (t) => {
  const root = makeRoot(t);
  rmSync(path.join(root, ORCH_REF));
  const gen = run(root, 'generate');
  assert.equal(gen.status, 0, gen.out);
  const generated = stripIds(read(root, ORCH_REF));
  const base = readFileSync(path.join(fixtures, 'orchestration-di.base.md'), 'utf8');
  assert.equal(collapse(generated), collapse(base));
  const spans = (text) => text.match(/`[^`]+`/g) ?? [];
  assert.equal(spans(base).length, 70);
  assert.deepEqual(spans(generated), spans(base));
  assert.equal(read(root, ORCH_REF), readFileSync(path.join(repoRoot, ORCH_REF), 'utf8'));
});

test('why is a substring of rule and no entry has sources (criterion 3)', () => {
  const cat = readJson(repoRoot, ORCH_JSON);
  const entries = cat.sections.flatMap((s) => s.entries);
  assert.equal(entries.length, 37);
  assert.deepEqual(
    entries.map((e) => e.id),
    Array.from({ length: 37 }, (_, i) => `ORCH-${String(i + 1).padStart(3, '0')}`)
  );
  for (const e of entries) {
    if ('why' in e) assert.ok(e.rule.includes(e.why), `${e.id}: why is not a substring of rule`);
    assert.ok(!('sources' in e), `${e.id} has sources`);
  }
  assert.ok(entries.some((e) => 'why' in e));
});

test('paths: referenced files exist and orchestration keeps its path (criterion 4)', () => {
  const families = readJson(repoRoot, 'kanon/catalog/families.json');
  assert.equal(families.length, 14);
  const orch = families.find((f) => f.family === 'orchestration-di');
  assert.equal(orch.reference, ORCH_REF);
  assert.equal(orch.prefix, 'ORCH');

  const dirs = ['kanon/laravel-kanon/references', 'kanon/symfony-kanon/references'];
  const named = new Set();
  for (const skill of ['laravel-kanon', 'laravel-kanon-audit', 'symfony-kanon']) {
    const text = read(repoRoot, `kanon/${skill}/SKILL.md`);
    for (const m of text.matchAll(/`(?:references\/)?([a-z][a-z-]*)\.md`/g)) named.add(m[1]);
  }
  assert.ok(named.size >= 14, `skills name ${named.size} reference files`);
  for (const name of named) {
    assert.ok(
      dirs.some((d) => existsSync(path.join(repoRoot, d, `${name}.md`))),
      `${name}.md is named by a Kanon SKILL.md but missing`
    );
  }
  for (const f of families) {
    assert.ok(named.has(f.family), `${f.family} is not named by a Kanon SKILL.md`);
    assert.ok(existsSync(path.join(repoRoot, f.reference)), `${f.reference} is missing`);
  }
});

test('notes, section intros and numbered lists render as expected (other shapes)', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'kanon-shapes-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'kanon', 'catalog'), { recursive: true });
  cpSync(
    path.join(repoRoot, 'kanon', 'catalog', 'schema.json'),
    path.join(root, 'kanon', 'catalog', 'schema.json')
  );
  writeJson(root, 'kanon/catalog/families.json', [
    { family: 'shapes', prefix: 'SHP', reference: 'kanon/shapes/references/shapes.md' },
  ]);
  cpSync(path.join(fixtures, 'shapes.json'), path.join(root, 'kanon', 'catalog', 'shapes.json'));
  const gen = run(root, 'generate');
  assert.equal(gen.status, 0, gen.out);
  assert.equal(
    read(root, 'kanon/shapes/references/shapes.md'),
    readFileSync(path.join(fixtures, 'shapes.expected.md'), 'utf8')
  );
  assert.equal(run(root, 'check').status, 0);
});
