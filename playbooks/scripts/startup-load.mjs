// Start-up load of Claude Code sessions: how many input tokens a session sends before its first
// reply. The same method before and after a change to a session profile.
//
// Usage:
//   node startup-load.mjs --cwd <folder> [--since <iso>] [--until <iso>] [--task <name>] [--projects-dir <dir>]
//
// Start-up load is the first assistant message's input_tokens + cache_creation_input_tokens +
// cache_read_input_tokens, read from the session transcript (<projects-dir>/<encoded cwd>/*.jsonl)
// for main sessions and from <session>/subagents/agent-*.jsonl for subagents. A transcript with no
// usage on its first assistant message (a tick that hit the usage limit) is counted in
// `skipped_no_usage` and left out of the medians.
//
// --cwd is the folder the sessions ran in. Claude Code names its project folders by replacing every
// character other than a letter or digit with `-`, and the script does the same. A leading `~` is
// expanded. --since is inclusive and --until exclusive, both compared with the first timestamp of
// the main session. --task keeps only sessions whose first user message carries
// `scheduled-task name="<name>"`. A subagent follows its main session's filters.
//
// One JSON object on stdout, errors on stderr. Exit 0 success, 1 unexpected error, 2 bad usage.
import { closeSync, existsSync, openSync, readSync, readdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';

export class UsageError extends Error {}

export const encodeCwd = (cwd) => cwd.replace(/[^a-zA-Z0-9]/g, '-');

const expandHome = (p) => (p === '~' || p.startsWith('~/') ? join(homedir(), p.slice(1)) : p);

const parseLine = (line) => {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
};

function* readJsonlRecords(file) {
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(1 << 16);
    const decoder = new StringDecoder('utf8');
    let rest = '';
    for (;;) {
      const n = readSync(fd, buf, 0, buf.length, null);
      if (n === 0) break;
      rest += decoder.write(buf.subarray(0, n));
      const lines = rest.split('\n');
      rest = lines.pop();
      for (const line of lines) {
        const rec = line.trim() ? parseLine(line) : undefined;
        if (rec !== undefined) yield rec;
      }
    }
    rest += decoder.end();
    const rec = rest.trim() ? parseLine(rest) : undefined;
    if (rec !== undefined) yield rec;
  } finally {
    closeSync(fd);
  }
}

const textOf = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c === 'string' ? c : c?.text ?? '')).join('\n');
  return '';
};

const sumUsage = (u) => {
  if (!u || typeof u !== 'object') return 0;
  return ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']
    .reduce((t, k) => t + (Number.isFinite(u[k]) ? u[k] : 0), 0);
};

export function readTranscript(file) {
  const out = { firstTimestamp: null, firstUser: '', load: null };
  let sawUser = false;
  for (const rec of readJsonlRecords(file)) {
    if (out.firstTimestamp === null && typeof rec.timestamp === 'string') out.firstTimestamp = rec.timestamp;
    if (!sawUser && rec.type === 'user' && !rec.isMeta) {
      sawUser = true;
      out.firstUser = textOf(rec.message?.content);
    }
    if (rec.type === 'assistant') {
      const load = sumUsage(rec.message?.usage);
      out.load = load > 0 ? load : null;
      break;
    }
  }
  return out;
}

export function summarize(values) {
  if (!values.length) return { n: 0, median: null, min: null, max: null };
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  const median = s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  return { n: s.length, median, min: s[0], max: s[s.length - 1] };
}

export function measure({ cwd, since, until, task, projectsDir }) {
  const dir = join(projectsDir, encodeCwd(cwd));
  const main = [];
  const subagents = [];
  let skipped = 0;
  const tag = task === undefined ? undefined : `scheduled-task name="${task}"`;
  const sessions = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort() : [];
  for (const name of sessions) {
    const t = readTranscript(join(dir, name));
    const at = t.firstTimestamp === null ? NaN : Date.parse(t.firstTimestamp);
    if (since !== undefined && !(at >= since)) continue;
    if (until !== undefined && !(at < until)) continue;
    if (tag !== undefined && !t.firstUser.includes(tag)) continue;
    if (t.load !== null) main.push(t.load);
    else skipped++;
    const subDir = join(dir, name.slice(0, -'.jsonl'.length), 'subagents');
    if (!existsSync(subDir)) continue;
    for (const sub of readdirSync(subDir).filter((n) => /^agent-.*\.jsonl$/.test(n)).sort()) {
      const load = readTranscript(join(subDir, sub)).load;
      if (load !== null) subagents.push(load);
      else skipped++;
    }
  }
  return { main: summarize(main), subagents: summarize(subagents), skipped_no_usage: skipped };
}

// ---------- CLI ----------

const parseTime = (flag, v) => {
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) throw new UsageError(`${flag} needs an ISO time, got: ${v}`);
  return ms;
};

export function parseArgs(argv, env = process.env) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new UsageError(`${f} needs a value`);
      return argv[++i];
    };
    if (f === '--cwd') o.cwdRaw = val();
    else if (f === '--since') {
      o.sinceRaw = val();
      o.since = parseTime(f, o.sinceRaw);
    } else if (f === '--until') {
      o.untilRaw = val();
      o.until = parseTime(f, o.untilRaw);
    } else if (f === '--task') o.task = val();
    else if (f === '--projects-dir') o.projectsDir = resolve(expandHome(val()));
    else throw new UsageError(`unknown flag: ${f}`);
  }
  if (o.cwdRaw === undefined || o.cwdRaw === '') throw new UsageError('--cwd is required');
  o.cwd = resolve(expandHome(o.cwdRaw));
  o.projectsDir ??= join(env.HOME || homedir(), '.claude', 'projects');
  return o;
}

export function main(argv, env = process.env) {
  const o = parseArgs(argv, env);
  const result = measure(o);
  return {
    cwd: o.cwdRaw,
    since: o.sinceRaw ?? null,
    until: o.untilRaw ?? null,
    task: o.task ?? null,
    ...result,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  try {
    console.log(JSON.stringify(main(process.argv.slice(2))));
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`usage error: ${e.message}`);
      process.exit(2);
    }
    console.error(`startup-load failed: ${e?.message || e}`);
    process.exit(1);
  }
}
