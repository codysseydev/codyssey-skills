#!/usr/bin/env node
// Kanon catalog: validates kanon/catalog/<family>.json and writes each family's reference .md from it.
//
//   node kanon/scripts/catalog.mjs generate [--root <dir>]
//   node kanon/scripts/catalog.mjs check [--root <dir>] [--base <ref>]
//
// Plain node, no packages. `check` prints one line per problem and exits 1 if there is any.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CATALOG_DIR = 'kanon/catalog';
const NOT_FAMILY_FILES = new Set(['schema.json', 'families.json']);
const BOLD_KEYWORD = /\*\*(MUST NOT|MUST|SHOULD NOT|SHOULD|MAY)\*\*/;

// ---- schema validator: only the keywords schema.json uses --------------------------------

const SCHEMA_KEYWORDS = new Set([
  'type',
  'required',
  'properties',
  'additionalProperties',
  'enum',
  'pattern',
  'items',
  'minItems',
  'oneOf',
  '$ref',
  '$defs',
]);

// Walk the whole schema so a keyword the validator would skip is found even in a branch no data reaches.
// Keys under `properties` and `$defs` are names, not keywords.
function assertSupported(schema, where = '#') {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    throw new Error(`schema ${where}: expected an object`);
  }
  for (const key of Object.keys(schema)) {
    if (!SCHEMA_KEYWORDS.has(key)) {
      throw new Error(`schema ${where}: keyword "${key}" is not implemented by the validator`);
    }
  }
  for (const group of ['properties', '$defs']) {
    for (const [name, sub] of Object.entries(schema[group] ?? {})) {
      assertSupported(sub, `${where}/${group}/${name}`);
    }
  }
  if (schema.items !== undefined) assertSupported(schema.items, `${where}/items`);
  for (const [i, sub] of (schema.oneOf ?? []).entries()) assertSupported(sub, `${where}/oneOf/${i}`);
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') {
    throw new Error(`schema ${where}: additionalProperties must be a boolean`);
  }
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`schema: $ref "${ref}" must start with "#/"`);
  let node = root;
  for (const part of ref.slice(2).split('/')) {
    node = node?.[part.replaceAll('~1', '/').replaceAll('~0', '~')];
  }
  if (node === undefined) throw new Error(`schema: $ref "${ref}" does not resolve`);
  return node;
}

function walk(root, schema, value, at, errors) {
  if (schema.$ref !== undefined) walk(root, resolveRef(root, schema.$ref), value, at, errors);

  if (schema.type !== undefined) {
    const actual = typeOf(value);
    const ok = actual === schema.type || (schema.type === 'number' && actual === 'integer');
    if (!ok) {
      errors.push({ path: at, message: `expected ${schema.type}, got ${actual}` });
      return;
    }
  }
  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    const list = schema.enum.map((v) => JSON.stringify(v)).join(', ');
    errors.push({ path: at, message: `must be one of ${list} (got ${JSON.stringify(value)})` });
  }
  if (schema.pattern !== undefined && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
    errors.push({ path: at, message: `${JSON.stringify(value)} does not match pattern ${schema.pattern}` });
  }

  if (typeOf(value) === 'object') {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push({ path: at, message: `missing required property "${key}"` });
    }
    const known = schema.properties ?? {};
    for (const [key, sub] of Object.entries(known)) {
      if (Object.hasOwn(value, key)) walk(root, sub, value[key], [...at, key], errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(known, key)) errors.push({ path: at, message: `unknown property "${key}"` });
      }
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({ path: at, message: `must have at least ${schema.minItems} item(s)` });
    }
    if (schema.items !== undefined) {
      for (const [i, item] of value.entries()) walk(root, schema.items, item, [...at, i], errors);
    }
  }

  if (schema.oneOf !== undefined) {
    const branches = schema.oneOf.map((sub) => {
      const found = [];
      walk(root, sub, value, at, found);
      return found;
    });
    const matching = branches.filter((found) => found.length === 0).length;
    if (matching > 1) errors.push({ path: at, message: 'matches more than one oneOf alternative' });
    if (matching === 0) {
      // Report the alternative that fits best, so a missing property is named instead of "no match".
      const closest = branches.reduce((a, b) => (b.length < a.length ? b : a));
      errors.push(...closest);
    }
  }
}

// Returns [{ path: [...], message }]. Throws when the schema uses a keyword this validator lacks.
export function validate(schema, value) {
  assertSupported(schema);
  const errors = [];
  walk(schema, schema, value, [], errors);
  return errors;
}

// ---- generator ---------------------------------------------------------------------------

const isRule = (e) => typeof e === 'object' && e !== null && 'id' in e;

// Returns { text, ids } where ids[i] is the entry that line i belongs to (null before the first entry).
export function render(catalog) {
  const blocks = [[{ line: `# ${catalog.title}`, id: null }]];
  const paragraph = (text) => blocks.push([{ line: text, id: null }]);
  catalog.intro.forEach(paragraph);
  for (const section of catalog.sections) {
    blocks.push([{ line: `## ${section.heading}`, id: null }]);
    section.intro.forEach(paragraph);
    const list = [];
    let n = 0;
    for (const entry of section.entries) {
      if (isRule(entry) && entry.status !== 'active') continue;
      n += 1;
      const marker = section.list === 'numbered' ? `${n}.` : '-';
      const id = isRule(entry) ? entry.id : null;
      list.push({ line: `${marker} ${isRule(entry) ? `\`${entry.id}\` ${entry.rule}` : entry.note}`, id });
      for (const item of isRule(entry) ? (entry.items ?? []) : []) {
        list.push({ line: `${' '.repeat(marker.length === 1 ? 2 : marker.length + 1)}- ${item}`, id });
      }
    }
    if (list.length > 0) blocks.push(list);
  }
  const lines = [];
  let last = null;
  for (const [i, block] of blocks.entries()) {
    if (i > 0) lines.push({ line: '', id: last });
    for (const entry of block) {
      lines.push(entry);
      if (entry.id !== null) last = entry.id;
    }
  }
  return { text: lines.map((l) => l.line).join('\n') + '\n', ids: lines.map((l) => l.id) };
}

// ---- check -------------------------------------------------------------------------------

function* eachRule(catalog) {
  if (!Array.isArray(catalog?.sections)) return;
  for (const [s, section] of catalog.sections.entries()) {
    if (!Array.isArray(section?.entries)) continue;
    for (const [e, entry] of section.entries.entries()) {
      if (isRule(entry) && typeof entry.id === 'string') {
        yield { where: `sections[${s}].entries[${e}]`, entry };
      }
    }
  }
}

const pathText = (p) => p.map((k) => (typeof k === 'number' ? `[${k}]` : `.${k}`)).join('').replace(/^\./, '');

// Names an error's place: the entry it is in (index and ID) when it is in one, else the JSON path.
function locate(catalog, errorPath) {
  const [a, s, b, e, ...rest] = errorPath;
  if (a === 'sections' && b === 'entries' && typeof e === 'number') {
    const entry = catalog.sections?.[s]?.entries?.[e];
    const id = isRule(entry) && typeof entry.id === 'string' ? ` (${entry.id})` : '';
    return { where: `sections[${s}].entries[${e}]${id}`, rest };
  }
  return { where: pathText(errorPath), rest: [] };
}

function readJson(file, problems, label) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    problems.push(`${label}: cannot read as JSON: ${error.message}`);
    return undefined;
  }
}

function loadFamilies(root, problems) {
  const label = `${CATALOG_DIR}/families.json`;
  const rows = readJson(path.join(root, label), problems, label);
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) {
    problems.push(`${label}: expected an array of rows`);
    return [];
  }
  const good = [];
  const seen = { family: new Map(), prefix: new Map(), reference: new Map() };
  for (const [i, row] of rows.entries()) {
    const at = `${label}: row ${i}`;
    const shape = ['family', 'prefix', 'reference'];
    const bad =
      typeof row !== 'object' ||
      row === null ||
      Object.keys(row).sort().join() !== shape.join() ||
      shape.some((k) => typeof row[k] !== 'string') ||
      !/^[A-Z]+$/.test(row.prefix);
    if (bad) {
      problems.push(`${at}: expected { family, prefix (A-Z), reference } and nothing else`);
      continue;
    }
    let unique = true;
    for (const key of shape) {
      if (seen[key].has(row[key])) {
        problems.push(`${at}: duplicate ${key} "${row[key]}" (first in row ${seen[key].get(row[key])})`);
        unique = false;
      } else seen[key].set(row[key], i);
    }
    if (unique) good.push(row);
  }
  return good;
}

function gitOut(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// IDs in the catalog files of a git ref as of `git merge-base <ref> HEAD`, so IDs main gained since do not
// count against a branch that is behind. With no merge-base (unrelated histories) the ref tip is read.
// Returns { ids: Map(id -> "file entry-path"), label } where label names the commit the IDs came from,
// e.g. "base origin/main (merge-base 6485e3a)"; problems go to `problems`.
function baseIds(root, ref, problems) {
  try {
    if (ref.startsWith('-')) throw new Error('ref starts with "-"');
    gitOut(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  } catch {
    problems.push(`base ref "${ref}" does not exist (or ${root} is not a git repository)`);
    return undefined;
  }
  let at;
  let source = 'merge-base';
  try {
    at = gitOut(root, ['merge-base', ref, 'HEAD']).trim();
  } catch {
    // no common ancestor: keep the ref tip
    at = gitOut(root, ['rev-parse', `${ref}^{commit}`]).trim();
    source = 'tip';
  }
  const label = `base ${ref} (${source} ${at.slice(0, 7)})`;
  const ids = new Map();
  const listing = gitOut(root, ['ls-tree', '-r', '--name-only', at, '--', CATALOG_DIR]);
  const files = listing
    .split('\n')
    .filter((f) => new RegExp(`^${CATALOG_DIR}/[^/]+\\.json$`).test(f))
    .filter((f) => !NOT_FAMILY_FILES.has(path.basename(f)));
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(gitOut(root, ['show', `${at}:${file}`]));
    } catch (error) {
      problems.push(`${label}: ${file}: cannot read as JSON: ${error.message}`);
      continue;
    }
    for (const { where, entry } of eachRule(data)) ids.set(entry.id, `${file} ${where}`);
  }
  return { ids, label };
}

function firstDifference(actual, expected) {
  const a = actual.split('\n');
  const b = expected.text.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) return { line: i + 1, id: expected.ids[Math.min(i, expected.ids.length - 1)] };
  }
  return undefined;
}

// Everything `check` looks at. With `skipReferences` it leaves out the reference comparison (used by generate).
export function collectProblems(root, { base, skipReferences = false } = {}) {
  const problems = [];
  const schemaLabel = `${CATALOG_DIR}/schema.json`;
  const schema = readJson(path.join(root, schemaLabel), problems, schemaLabel);
  let usable = false;
  if (schema !== undefined) {
    try {
      assertSupported(schema);
      usable = true;
    } catch (error) {
      problems.push(`${schemaLabel}: ${error.message}`);
    }
  }
  const families = loadFamilies(root, problems);
  const byFamily = new Map(families.map((row) => [row.family, row]));

  const dir = path.join(root, CATALOG_DIR);
  const names = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.json') && !NOT_FAMILY_FILES.has(f)).sort()
    : [];
  const seenIds = new Map();
  const catalogs = [];

  for (const name of names) {
    const file = `${CATALOG_DIR}/${name}`;
    const catalog = readJson(path.join(root, file), problems, file);
    if (catalog === undefined) continue;

    const schemaErrors = usable ? validate(schema, catalog) : [];
    for (const error of schemaErrors) {
      const { where, rest } = locate(catalog, error.path);
      const prop = rest.length > 0 ? `${pathText(rest)}: ` : '';
      problems.push(`${file}: ${where}: ${prop}${error.message}`);
    }

    for (const { where, entry } of eachRule(catalog)) {
      const first = seenIds.get(entry.id);
      if (first) {
        problems.push(`${file}: ${where} (${entry.id}): duplicate ID, already used by ${first}`);
      } else seenIds.set(entry.id, `${file} ${where}`);
    }

    const stem = name.slice(0, -'.json'.length);
    const row = byFamily.get(stem);
    if (!row) problems.push(`${file}: family "${stem}" is not a row in ${CATALOG_DIR}/families.json`);
    if (catalog.family !== stem) {
      problems.push(`${file}: family is ${JSON.stringify(catalog.family)}, expected "${stem}" to match the file name`);
    }
    if (!usable || schemaErrors.length > 0) continue;

    for (const { where, entry } of eachRule(catalog)) {
      const label = `${file}: ${where} (${entry.id})`;
      if (row && !entry.id.startsWith(`${row.prefix}-`)) {
        problems.push(`${label}: ID must start with "${row.prefix}-" for family ${row.family}`);
      }
      if (entry.family !== stem) problems.push(`${label}: family is "${entry.family}", expected "${stem}"`);
      const found = BOLD_KEYWORD.exec(entry.rule)?.[1];
      if (found !== entry.keyword) {
        const first = found ? `first bold keyword in rule is "${found}"` : 'rule has no bold keyword';
        problems.push(`${label}: keyword is "${entry.keyword}" but the ${first}`);
      }
    }
    catalogs.push({ file, catalog, row });
  }

  if (!skipReferences) {
    for (const { catalog, row } of catalogs) {
      if (!row) continue;
      const expected = render(catalog);
      const refPath = path.join(root, row.reference);
      if (!existsSync(refPath)) {
        problems.push(`${row.reference}: missing; run "node kanon/scripts/catalog.mjs generate"`);
        continue;
      }
      const diff = firstDifference(readFileSync(refPath, 'utf8'), expected);
      if (diff) {
        const near = diff.id ? ` (${diff.id})` : '';
        problems.push(
          `${row.reference}: line ${diff.line}${near} differs from ${CATALOG_DIR}/${row.family}.json; the file is generated, edit the catalog and run "node kanon/scripts/catalog.mjs generate"`
        );
      }
    }
  }

  if (base !== undefined) {
    const before = baseIds(root, base, problems);
    for (const [id, where] of before?.ids ?? []) {
      if (!seenIds.has(id)) {
        problems.push(
          `${before.label}: ${id} (${where}) is missing from the catalog; retire a rule with status "deprecated", do not delete it`
        );
      }
    }
  }
  return { problems, catalogs, ruleCount: seenIds.size };
}

// ---- commands ----------------------------------------------------------------------------

function generate(root) {
  const { problems, catalogs } = collectProblems(root, { skipReferences: true });
  if (problems.length > 0) return { problems, written: [] };
  const written = [];
  for (const { catalog, row } of catalogs) {
    if (!row) continue;
    mkdirSync(path.dirname(path.join(root, row.reference)), { recursive: true });
    writeFileSync(path.join(root, row.reference), render(catalog).text);
    written.push(row.reference);
  }
  return { problems: [], written };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..') };
  const allowed = command === 'check' ? ['--root', '--base'] : ['--root'];
  for (let i = 0; i < rest.length; i += 2) {
    if (!allowed.includes(rest[i]) || rest[i + 1] === undefined) return { command: undefined };
    options[rest[i].slice(2)] = rest[i + 1];
  }
  options.root = path.resolve(options.root);
  return { command, options };
}

function main(argv) {
  const { command, options } = parseArgs(argv);
  if (command !== 'generate' && command !== 'check') {
    console.error('usage: catalog.mjs generate [--root <dir>] | check [--root <dir>] [--base <ref>]');
    return 2;
  }
  try {
    if (command === 'generate') {
      const { problems, written } = generate(options.root);
      for (const line of problems) console.log(line);
      for (const file of written) console.log(`wrote ${file}`);
      return problems.length > 0 ? 1 : 0;
    }
    const { problems, catalogs, ruleCount } = collectProblems(options.root, { base: options.base });
    for (const line of problems) console.log(line);
    if (problems.length === 0) console.log(`catalog ok: ${catalogs.length} family file(s), ${ruleCount} entries`);
    return problems.length > 0 ? 1 : 0;
  } catch (error) {
    console.log(error.message);
    return 1;
  }
}

// Without import.meta.main (Node before 22.18 and 24.2) the check would exit 0 having checked nothing.
if (import.meta.main === undefined) {
  console.error('catalog.mjs needs a Node where import.meta.main exists (Node >= 22.18 or >= 24.2).');
  process.exitCode = 2;
} else if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
