import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeCwd, summarize } from './startup-load.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'startup-load.mjs');
const CWD = '/work/.factory/session';

const usage = (a, b, c) => ({ input_tokens: a, cache_creation_input_tokens: b, cache_read_input_tokens: c, output_tokens: 9 });
const userRec = (ts, text) => ({ type: 'user', timestamp: ts, message: { role: 'user', content: text } });
const asstRec = (ts, u) => ({ type: 'assistant', timestamp: ts, message: { role: 'assistant', content: [], ...(u ? { usage: u } : {}) } });
const jsonl = (recs) => `${recs.map((r) => JSON.stringify(r)).join('\n')}\n`;
const tick = (name) => `<scheduled-task name="${name}" file="x">\nrun\n</scheduled-task>`;

function fixture() {
  const projects = mkdtempSync(join(tmpdir(), 'startup-load-'));
  const dir = join(projects, encodeCwd(CWD));
  mkdirSync(dir, { recursive: true });
  const session = (id, ts, task, u, subs = []) => {
    writeFileSync(join(dir, `${id}.jsonl`), jsonl([
      { type: 'queue-operation', timestamp: ts },
      userRec(ts, tick(task)),
      asstRec(ts, u),
    ]));
    if (subs.length) mkdirSync(join(dir, id, 'subagents'), { recursive: true });
    subs.forEach((u2, i) => writeFileSync(join(dir, id, 'subagents', `agent-a${i}.jsonl`), jsonl([
      { ...userRec(ts, 'do it'), isSidechain: true },
      asstRec(ts, u2),
    ])));
  };
  session('inWindowA', '2026-11-29T01:00:00Z', 'factory-pickup-tools', usage(2, 10000, 20000), [usage(1, 3000, 2000), usage(1, 5000, 1000)]);
  session('inWindowB', '2026-11-29T03:00:00Z', 'factory-pickup-tools', usage(2, 20000, 30000), [usage(1, 100, 100)]);
  session('noUsage', '2026-11-29T02:00:00Z', 'factory-pickup-tools', undefined, [undefined]);
  session('otherTask', '2026-11-29T02:00:00Z', 'factory-pickup', usage(2, 99000, 1000), [usage(1, 99000, 1000)]);
  session('beforeWindow', '2026-11-28T10:00:00Z', 'factory-pickup-tools', usage(2, 70000, 30000), [usage(1, 70000, 30000)]);
  return projects;
}

const run = (projects, ...args) => {
  const r = spawnSync('node', [SCRIPT, '--cwd', CWD, '--projects-dir', projects, ...args], { encoding: 'utf8' });
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    out = undefined;
  }
  return { code: r.status, out, stderr: r.stderr };
};

test('encodeCwd names the folder the way Claude Code does', () => {
  assert.equal(encodeCwd('/Users/a/.factory/session'), '-Users-a--factory-session');
});

test('summarize gives n, median, min and max, with a rounded mean of the middle two for an even count', () => {
  assert.deepEqual(summarize([]), { n: 0, median: null, min: null, max: null });
  assert.deepEqual(summarize([5, 1, 3]), { n: 3, median: 3, min: 1, max: 5 });
  assert.deepEqual(summarize([4, 1, 2, 10]), { n: 4, median: 3, min: 1, max: 10 });
});

test('main sessions and subagents are summed from the first assistant message', () => {
  const { code, out } = run(fixture(), '--since', '2026-11-29T00:00:00Z', '--task', 'factory-pickup-tools');
  assert.equal(code, 0);
  assert.deepEqual(out.main, { n: 2, median: 40002, min: 30002, max: 50002 });
  assert.deepEqual(out.subagents, { n: 3, median: 5001, min: 201, max: 6001 });
  assert.equal(out.skipped_no_usage, 2);
  assert.equal(out.cwd, CWD);
  assert.equal(out.since, '2026-11-29T00:00:00Z');
  assert.equal(out.until, null);
  assert.equal(out.task, 'factory-pickup-tools');
});

test('a session with no usage counts in skipped_no_usage and not in the medians', () => {
  const { out } = run(fixture(), '--since', '2026-11-29T00:00:00Z', '--task', 'factory-pickup-tools');
  assert.equal(out.main.n, 2);
  assert.equal(out.skipped_no_usage, 2, 'the session and its subagent');
});

test('--task leaves out a session for another task and its subagents', () => {
  const { out } = run(fixture(), '--since', '2026-11-29T00:00:00Z', '--task', 'factory-pickup');
  assert.equal(out.main.n, 1);
  assert.equal(out.main.median, 100002);
  assert.equal(out.subagents.n, 1);
});

test('--since leaves out a session before it, and --until leaves out a session at or after it', () => {
  const all = run(fixture(), '--task', 'factory-pickup-tools').out;
  assert.equal(all.main.n, 3);
  const early = run(fixture(), '--task', 'factory-pickup-tools', '--until', '2026-11-29T03:00:00Z').out;
  assert.deepEqual(early.main, { n: 2, median: 65002, min: 30002, max: 100002 }, 'inWindowA and beforeWindow stay, inWindowB is excluded by until');
  assert.equal(run(fixture(), '--since', '2026-11-30T00:00:00Z').out.main.n, 0);
});

test('a cwd with no sessions gives zero counts and exit 0', () => {
  const r = spawnSync('node', [SCRIPT, '--cwd', '/nowhere/else', '--projects-dir', fixture()], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out.main, { n: 0, median: null, min: null, max: null });
  assert.equal(out.skipped_no_usage, 0);
});

test('usage errors exit 2', () => {
  const projects = fixture();
  for (const args of [[], ['--since', 'x'], ['--cwd'], ['--cwd', CWD, '--nope'], ['--cwd', CWD, '--until', 'soon']]) {
    const r = spawnSync('node', [SCRIPT, '--projects-dir', projects, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /usage error/);
  }
});
