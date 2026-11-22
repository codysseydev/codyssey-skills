import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, InputError, parseRecipeChecks, NO_RECIPE_NOTE, WHY_LIMIT } from './trial-decision.mjs';

const SCRIPT = fileURLToPath(new URL('./trial-decision.mjs', import.meta.url));
const SHA = 'abc1234def5678abc1234def5678abc1234def56';

function input(over = {}) {
  return {
    head_sha: SHA,
    clean_tree: true,
    evidence: {
      head_sha: SHA,
      gates: [1, 2, 3, 4, 5, 6].map((n) => ({ gate: `g${n}`, command: `c${n}`, exit_code: 0, result: 'pass' })),
      trusted_commands: { flagged: [] },
    },
    confidence: 'high',
    adr_open: false,
    ui: { changed: false, not_exercised: 0 },
    kind: 'feature',
    requires_kanon_audit: false,
    reviews: [
      { name: 'codyssey-reviewer', fan_out_complete: true, open_findings: 0 },
      { name: 'kanon-audit', fan_out_complete: true, open_findings: 0 },
    ],
    mergeable: 'mergeable',
    ...over,
  };
}

function withEvidence(over) {
  const base = input();
  return input({ evidence: { ...base.evidence, ...over } });
}

function handsOver(i, fragment) {
  const r = decide(i);
  assert.equal(r.would_merge, false);
  assert.match(r.why, /^Would hand over, because:\n- /);
  assert.ok(r.why.includes(fragment), `${JSON.stringify(r.why)} should include ${fragment}`);
  return r;
}

test('would merge when every check holds', () => {
  const r = decide(input(), ['g1', 'g2']);
  assert.equal(r.would_merge, true);
  assert.equal(r.why, 'Every check holds at abc1234: 6 gates pass, no trusted files changed, confidence high, 2 reviews complete.');
});

test('without a recipe the why carries a note and the verdict is unchanged', () => {
  const r = decide(input());
  assert.equal(r.would_merge, true);
  assert.ok(r.why.endsWith(` ${NO_RECIPE_NOTE}`));
  assert.deepEqual(r.reasons, []);
  const h = decide(input({ adr_open: true }));
  assert.ok(h.why.endsWith(`\n${NO_RECIPE_NOTE}`));
  assert.equal(h.reasons.length, 1);
});

test('a recipe check missing from the evidence hands over and names the check', () => {
  const r = decide(input(), ['g1', 'trial-decision-tests', 'other']);
  assert.equal(r.would_merge, false);
  assert.deepEqual(r.reasons, ['Recipe check trial-decision-tests is missing from the evidence.', 'Recipe check other is missing from the evidence.']);
  assert.ok(!r.why.includes(NO_RECIPE_NOTE));
});

test('parseRecipeChecks reads only the checks list', () => {
  const text = [
    'version: 1', 'setup:', '  - name: install', '    run: npm ci', 'checks:', '  - name: unit',
    '    run: npm test', '  - name: "lint"', '    run: npm run lint', 'teardown:', '  - name: stop', '    run: x', '',
  ].join('\n');
  assert.deepEqual(parseRecipeChecks(text), ['unit', 'lint']);
  assert.deepEqual(parseRecipeChecks('version: 1\nsetup: []\nchecks: []\nteardown: []\n'), []);
});

test('parseRecipeChecks rejects a recipe with no checks list or a nameless check', () => {
  assert.throws(() => parseRecipeChecks('version: 1\nsetup: []\n'), InputError);
  assert.throws(() => parseRecipeChecks('checks:\n  - run: x\n'), InputError);
  assert.throws(() => parseRecipeChecks('checks:\n  - name:\n    run: x\n'), InputError);
});

test('ui changed with nothing unexercised still merges', () => {
  assert.equal(decide(input({ ui: { changed: true, not_exercised: 0 } })).would_merge, true);
});

test('ui not exercised is ignored when ui did not change', () => {
  assert.equal(decide(input({ ui: { changed: false, not_exercised: 3 } })).would_merge, true);
});

test('evidence sha mismatch hands over', () => {
  handsOver(withEvidence({ head_sha: '1111111' }), 'evidence was taken at 1111111');
});

test('short evidence sha that is a prefix counts, in any case', () => {
  assert.equal(decide(withEvidence({ head_sha: 'ABC1234' })).would_merge, true);
});

test('evidence sha shorter than 7 chars is malformed', () => {
  assert.throws(() => decide(withEvidence({ head_sha: 'abc123' })), InputError);
});

test('dirty tree hands over', () => {
  handsOver(input({ clean_tree: false }), 'not taken from a clean tree');
});

test('empty gates hand over', () => {
  handsOver(withEvidence({ gates: [] }), 'lists no gates');
});

test('failed gate hands over and names the gate', () => {
  const gates = [{ gate: 'unit', command: 'x', exit_code: 1, result: 'fail' }];
  handsOver(withEvidence({ gates }), 'Gate unit failed.');
});

test('flaky gate hands over and names the gate', () => {
  const gates = [{ gate: 'ui-capture', command: 'x', exit_code: 0, result: 'flaky' }];
  handsOver(withEvidence({ gates }), 'Gate ui-capture was flaky.');
});

test('not exercised gate hands over and names the gate', () => {
  const gates = [{ gate: 'e2e', command: 'x', exit_code: 0, result: 'not_exercised' }];
  handsOver(withEvidence({ gates }), 'Gate e2e was not exercised.');
});

test('flagged trusted files hand over and list the paths', () => {
  handsOver(withEvidence({ trusted_commands: { flagged: ['.factory/recipe.yml', '.factory/playbook.md'] } }), 'Trusted-commands files changed: .factory/recipe.yml, .factory/playbook.md.');
});

test('open ADR hands over', () => {
  handsOver(input({ adr_open: true }), 'An ADR is open');
});

test('confidence below high hands over', () => {
  handsOver(input({ confidence: 'medium' }), 'Confidence is medium, not high.');
  handsOver(input({ confidence: 'low' }), 'Confidence is low, not high.');
});

test('UI change with unexercised captures hands over', () => {
  handsOver(input({ ui: { changed: true, not_exercised: 2 } }), '2 captures not exercised');
});

test('no reviews hand over', () => {
  handsOver(input({ reviews: [] }), 'No review is recorded.');
});

test('incomplete fan-out hands over and names the review', () => {
  handsOver(input({ reviews: [{ name: 'kanon-audit', fan_out_complete: false, open_findings: 0 }] }), 'Review kanon-audit did not complete its fan-out.');
});

test('open findings hand over and name the review', () => {
  handsOver(input({ reviews: [{ name: 'kanon-audit', fan_out_complete: true, open_findings: 1 }] }), 'Review kanon-audit has 1 open finding.');
});

test('mergeable is accepted in any case', () => {
  assert.equal(decide(input({ mergeable: 'MERGEABLE' })).would_merge, true);
  handsOver(input({ mergeable: 'CONFLICTING' }), 'The PR is conflicting, not mergeable.');
  handsOver(input({ mergeable: 'UNKNOWN' }), 'The PR is unknown, not mergeable.');
});

test('bug fix with no test-first gate row hands over', () => {
  handsOver(input({ kind: 'bug_fix' }), 'Bug fix with no test-first gate row.');
});

test('bug fix with a test-first gate row can merge', () => {
  const gates = [{ gate: 'test-first', command: 'x', exit_code: 0, result: 'pass' }, ...input().evidence.gates];
  assert.equal(decide(input({ kind: 'bug_fix', evidence: { ...input().evidence, gates } })).would_merge, true);
});

test('feature needs no test-first row', () => {
  assert.equal(decide(input({ kind: 'feature' })).would_merge, true);
});

test('required Kanon audit missing hands over', () => {
  const reviews = [{ name: 'codyssey-reviewer', fan_out_complete: true, open_findings: 0 }];
  handsOver(input({ requires_kanon_audit: true, reviews }), 'No Kanon audit recorded.');
});

test('required Kanon audit present in any case can merge', () => {
  const reviews = [{ name: 'Kanon-Audit', fan_out_complete: true, open_findings: 0 }];
  assert.equal(decide(input({ requires_kanon_audit: true, reviews })).would_merge, true);
});

test('output carries reasons, empty when it would merge', () => {
  assert.deepEqual(decide(input()).reasons, []);
  const r = decide(input({ adr_open: true, confidence: 'low' }));
  assert.deepEqual(r.reasons, ['An ADR is open and needs the owner.', 'Confidence is low, not high.']);
});

test('conflicting and unknown mergeability hand over', () => {
  handsOver(input({ mergeable: 'conflicting' }), 'The PR is conflicting, not mergeable.');
  handsOver(input({ mergeable: 'unknown' }), 'The PR is unknown, not mergeable.');
});

test('several misses give one line each', () => {
  const r = decide(input({ adr_open: true, confidence: 'low', mergeable: 'conflicting' }), []);
  assert.equal(r.why.split('\n').length, 4);
});

test('why is capped at 2000 characters, even with many long flagged paths', () => {
  const flagged = Array.from({ length: 500 }, (_, i) => `${'d/'.repeat(90)}file${i}.yml`);
  const reviews = Array.from({ length: 200 }, (_, i) => ({ name: `reviewer-${'x'.repeat(40)}-${i}`, fan_out_complete: false, open_findings: 9 }));
  const r = decide(input({ evidence: { ...input().evidence, trusted_commands: { flagged } }, reviews }));
  assert.equal(r.would_merge, false);
  assert.equal(r.why.length, WHY_LIMIT);
});

test('malformed input throws InputError', () => {
  const bad = [
    null, [], {},
    input({ head_sha: 'zz' }),
    input({ clean_tree: 'true' }),
    input({ evidence: undefined }),
    withEvidence({ gates: [{ gate: 'a', command: 'c', exit_code: 0, result: 'ok' }] }),
    withEvidence({ trusted_commands: undefined }),
    input({ confidence: 'certain' }),
    input({ adr_open: undefined }),
    input({ ui: undefined }),
    input({ ui: { changed: true } }),
    input({ kind: 'chore' }),
    input({ kind: undefined }),
    input({ requires_kanon_audit: undefined }),
    withEvidence({ gates: [{ gate: 'a', command: 'c', result: 'pass' }] }),
    withEvidence({ gates: [{ gate: 'a', command: 'c', exit_code: '0', result: 'pass' }] }),
    withEvidence({ gates: [{ gate: 'a', command: 'c', exit_code: 1, result: 'pass' }] }),
    input({ reviews: [{ name: 'r', fan_out_complete: true }] }),
    input({ mergeable: 'yes' }),
  ];
  for (const b of bad) assert.throws(() => decide(b), InputError, JSON.stringify(b)?.slice(0, 80));
});

test('CLI: valid file prints the verdict and exits 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trial-'));
  const file = join(dir, 'in.json');
  writeFileSync(file, JSON.stringify(input()));
  const out = JSON.parse(execFileSync('node', [SCRIPT, file], { encoding: 'utf8' }));
  assert.equal(out.would_merge, true);
});

test('CLI: stdin with - works', () => {
  const r = spawnSync('node', [SCRIPT, '-'], { input: JSON.stringify(input({ adr_open: true })), encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).would_merge, false);
});

test('CLI: malformed input exits 2 with a message and no verdict', () => {
  const r = spawnSync('node', [SCRIPT, '-'], { input: '{"head_sha": 1}', encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /^trial-decision: /);
  const bad = spawnSync('node', [SCRIPT, '-'], { input: 'not json', encoding: 'utf8' });
  assert.equal(bad.status, 2);
  const missing = spawnSync('node', [SCRIPT, '/nonexistent/in.json'], { encoding: 'utf8' });
  assert.equal(missing.status, 2);
  assert.equal(missing.stdout, '');
});

test('CLI: --recipe hands over for a missing check', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trial-'));
  const recipe = join(dir, 'recipe.yml');
  writeFileSync(recipe, 'version: 1\nsetup: []\nchecks:\n  - name: g1\n    run: x\n  - name: absent\n    run: y\nteardown: []\n');
  const r = spawnSync('node', [SCRIPT, '--recipe', recipe, '-'], { input: JSON.stringify(input()), encoding: 'utf8' });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.would_merge, false);
  assert.deepEqual(out.reasons, ['Recipe check absent is missing from the evidence.']);
});

test('CLI: --recipe with every check present can merge', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trial-'));
  const recipe = join(dir, 'recipe.yml');
  writeFileSync(recipe, 'version: 1\nsetup: []\nchecks:\n  - name: g1\n    run: x\nteardown: []\n');
  const r = spawnSync('node', [SCRIPT, '--recipe', recipe, '-'], { input: JSON.stringify(input()), encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).would_merge, true);
});

test('CLI: an unreadable or malformed recipe exits 2 with no verdict', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trial-'));
  const bad = join(dir, 'bad.yml');
  writeFileSync(bad, 'version: 1\n');
  for (const path of [bad, join(dir, 'missing.yml')]) {
    const r = spawnSync('node', [SCRIPT, '--recipe', path, '-'], { input: JSON.stringify(input()), encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /^trial-decision: /);
  }
  const noValue = spawnSync('node', [SCRIPT, '-', '--recipe'], { input: '{}', encoding: 'utf8' });
  assert.equal(noValue.status, 2);
});
