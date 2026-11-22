// Trial merge mode: compute the factory's recorded verdict for one PR, "would merge" or
// "would hand over, because ...". The verdict is a record only. The run never merges on it
// (stage 7 of playbooks/factory.md: the run merges only on the owner's word).
//
// Usage:
//   node trial-decision.mjs <input.json>     read the input from a file
//   node trial-decision.mjs -                read the input from stdin
//
// Prints {"would_merge": bool, "why": "...", "reasons": [...]} on stdout and exits 0. Malformed or missing
// input fields: one message on stderr, exit 2, no verdict (fail closed).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const WHY_LIMIT = 2000;
export const MIN_SHA_LENGTH = 7;
const GATE_RESULTS = ['pass', 'fail', 'flaky', 'not_exercised'];
const CONFIDENCE = ['low', 'medium', 'high'];
const KINDS = ['bug_fix', 'feature'];
const MERGEABLE = ['mergeable', 'conflicting', 'unknown'];
const MAX_LISTED_PATHS = 10;

export class InputError extends Error {}

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function need(cond, message) {
  if (!cond) throw new InputError(message);
}

function count(v, name) {
  need(Number.isInteger(v) && v >= 0, `${name} must be an integer of 0 or more`);
  return v;
}

function sha(v, name) {
  need(typeof v === 'string' && /^[0-9a-f]{7,40}$/i.test(v), `${name} must be 7 to 40 hex characters`);
  return v.toLowerCase();
}

// Throws InputError on any missing or wrongly typed field.
export function validate(input) {
  need(isObject(input), 'input must be a JSON object');
  const head = sha(input.head_sha, 'head_sha');
  need(typeof input.clean_tree === 'boolean', 'clean_tree must be a boolean');
  need(isObject(input.evidence), 'evidence must be an object');
  const ev = input.evidence;
  const evSha = sha(ev.head_sha, 'evidence.head_sha');
  need(Array.isArray(ev.gates), 'evidence.gates must be an array');
  const gates = ev.gates.map((g, i) => {
    need(isObject(g), `evidence.gates[${i}] must be an object`);
    need(typeof g.gate === 'string' && g.gate !== '', `evidence.gates[${i}].gate must be a non-empty string`);
    need(GATE_RESULTS.includes(g.result), `evidence.gates[${i}].result must be one of ${GATE_RESULTS.join(', ')}`);
    need(Number.isInteger(g.exit_code), `evidence.gates[${i}].exit_code must be an integer`);
    need(g.result !== 'pass' || g.exit_code === 0, `evidence.gates[${i}] has result pass but exit_code ${g.exit_code}`);
    return { gate: g.gate, result: g.result };
  });
  need(isObject(ev.trusted_commands), 'evidence.trusted_commands must be an object');
  const flagged = ev.trusted_commands.flagged;
  need(Array.isArray(flagged) && flagged.every((p) => typeof p === 'string'), 'evidence.trusted_commands.flagged must be an array of strings');
  need(CONFIDENCE.includes(input.confidence), `confidence must be one of ${CONFIDENCE.join(', ')}`);
  need(typeof input.adr_open === 'boolean', 'adr_open must be a boolean');
  need(isObject(input.ui), 'ui must be an object ({"changed": false, "not_exercised": 0} when the UI did not change)');
  need(typeof input.ui.changed === 'boolean', 'ui.changed must be a boolean');
  const ui = { changed: input.ui.changed, not_exercised: count(input.ui.not_exercised, 'ui.not_exercised') };
  need(KINDS.includes(input.kind), `kind must be one of ${KINDS.join(', ')}`);
  need(typeof input.requires_kanon_audit === 'boolean', 'requires_kanon_audit must be a boolean');
  need(Array.isArray(input.reviews), 'reviews must be an array');
  const reviews = input.reviews.map((r, i) => {
    need(isObject(r), `reviews[${i}] must be an object`);
    need(typeof r.name === 'string' && r.name !== '', `reviews[${i}].name must be a non-empty string`);
    need(typeof r.fan_out_complete === 'boolean', `reviews[${i}].fan_out_complete must be a boolean`);
    return { name: r.name, fan_out_complete: r.fan_out_complete, open_findings: count(r.open_findings, `reviews[${i}].open_findings`) };
  });
  const mergeable = typeof input.mergeable === 'string' ? input.mergeable.toLowerCase() : input.mergeable;
  need(MERGEABLE.includes(mergeable), `mergeable must be one of ${MERGEABLE.join(', ')} (any case)`);
  return {
    head, evSha, clean_tree: input.clean_tree, gates, flagged, confidence: input.confidence,
    adr_open: input.adr_open, ui, reviews, mergeable, kind: input.kind,
    requires_kanon_audit: input.requires_kanon_audit,
  };
}

function shaMatches(a, b) {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= MIN_SHA_LENGTH && long.startsWith(short);
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function truncate(s) {
  return s.length > WHY_LIMIT ? `${s.slice(0, WHY_LIMIT - 3)}...` : s;
}

// Pure. Returns {would_merge, why, reasons} (reasons is empty when it would merge). Throws InputError on malformed input.
export function decide(input) {
  const v = validate(input);
  const short = v.head.slice(0, 7);
  const reasons = [];

  if (!shaMatches(v.evSha, v.head)) {
    reasons.push(`The evidence was taken at ${v.evSha.slice(0, 7)}, not at the PR head ${short}.`);
  }
  if (!v.clean_tree) reasons.push('The evidence was not taken from a clean tree.');

  if (v.gates.length === 0) reasons.push('The evidence lists no gates.');
  for (const g of v.gates) {
    if (g.result === 'fail') reasons.push(`Gate ${g.gate} failed.`);
    else if (g.result === 'flaky') reasons.push(`Gate ${g.gate} was flaky.`);
    else if (g.result === 'not_exercised') reasons.push(`Gate ${g.gate} was not exercised.`);
  }

  if (v.flagged.length > 0) {
    const listed = v.flagged.slice(0, MAX_LISTED_PATHS).map((p) => (p.length > 200 ? `${p.slice(0, 197)}...` : p));
    const more = v.flagged.length - listed.length;
    reasons.push(`Trusted-commands files changed: ${listed.join(', ')}${more > 0 ? ` and ${more} more` : ''}.`);
  }
  if (v.adr_open) reasons.push('An ADR is open and needs the owner.');
  if (v.confidence !== 'high') reasons.push(`Confidence is ${v.confidence}, not high.`);
  if (v.ui.changed && v.ui.not_exercised !== 0) {
    reasons.push(`The UI changed and ${plural(v.ui.not_exercised, 'capture')} not exercised.`);
  }

  if (v.kind === 'bug_fix' && !v.gates.some((g) => g.gate === 'test-first')) {
    reasons.push('Bug fix with no test-first gate row.');
  }
  if (v.reviews.length === 0) reasons.push('No review is recorded.');
  if (v.requires_kanon_audit && !v.reviews.some((r) => r.name.toLowerCase().includes('kanon'))) {
    reasons.push('No Kanon audit recorded.');
  }
  for (const r of v.reviews) {
    if (!r.fan_out_complete) reasons.push(`Review ${r.name} did not complete its fan-out.`);
    if (r.open_findings !== 0) reasons.push(`Review ${r.name} has ${plural(r.open_findings, 'open finding')}.`);
  }
  if (v.mergeable !== 'mergeable') reasons.push(`The PR is ${v.mergeable}, not mergeable.`);

  if (reasons.length === 0) {
    const why = `Every check holds at ${short}: ${plural(v.gates.length, 'gate')} pass, no trusted files changed, confidence high, ${plural(v.reviews.length, 'review')} complete.`;
    return { would_merge: true, why: truncate(why), reasons: [] };
  }
  return { would_merge: false, why: truncate(`Would hand over, because:\n${reasons.map((r) => `- ${r}`).join('\n')}`), reasons };
}

export function main(argv, readStdin = () => readFileSync(0, 'utf8')) {
  if (argv.length !== 1) throw new InputError('usage: node trial-decision.mjs <input.json | ->');
  let text;
  try {
    text = argv[0] === '-' ? readStdin() : readFileSync(argv[0], 'utf8');
  } catch (e) {
    throw new InputError(`cannot read input: ${e.message}`);
  }
  let input;
  try {
    input = JSON.parse(text);
  } catch (e) {
    throw new InputError(`input is not valid JSON: ${e.message}`);
  }
  return decide(input);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(JSON.stringify(main(process.argv.slice(2))));
  } catch (e) {
    if (e instanceof InputError) {
      console.error(`trial-decision: ${e.message}`);
      process.exit(2);
    }
    throw e;
  }
}
