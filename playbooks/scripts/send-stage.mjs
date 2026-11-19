// Report one factory stage over stdio until the `report_stage` MCP tool is registered.
//
// Usage: FACTORY_DASHBOARD_REPO=<path to the codyssey-factory-dashboard checkout> \
//          node send-stage.mjs '<json args>' | <path-to-json-file>
//
// The args are the `report_stage` input (repo, issue_number, stage, summary, ...).
// It spawns `mcp/report-stage/run.sh` in the dashboard checkout, which supplies the
// dashboard URL and token. Prints the tool result. Exit 0 on success, 1 on error,
// 2 on a usage problem.
import { readFileSync, existsSync } from 'node:fs';

const DASH = process.env.FACTORY_DASHBOARD_REPO;
const arg = process.argv[2];
if (!DASH || !arg) {
  console.error(
    'usage: FACTORY_DASHBOARD_REPO=<dashboard checkout> node send-stage.mjs <json|file>\n' +
      '  FACTORY_DASHBOARD_REPO is the path to the codyssey-factory-dashboard checkout.'
  );
  process.exit(2);
}

const sdk = `${DASH}/node_modules/@modelcontextprotocol/sdk/dist/esm/client`;
const { Client } = await import(`${sdk}/index.js`);
const { StdioClientTransport } = await import(`${sdk}/stdio.js`);

const args = JSON.parse(existsSync(arg) ? readFileSync(arg, 'utf8') : arg);

const transport = new StdioClientTransport({
  command: 'sh',
  args: [`${DASH}/mcp/report-stage/run.sh`],
  stderr: 'inherit',
});
const client = new Client({ name: 'send-stage', version: '0.0.0' });
try {
  await client.connect(transport);
  const res = await client.callTool({ name: 'report_stage', arguments: args }, undefined, { timeout: 30000 });
  console.log(JSON.stringify(res, null, 2));
  process.exitCode = res.isError ? 1 : 0;
} catch (e) {
  console.error('FAILED:', e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
