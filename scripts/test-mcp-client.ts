/**
 * Honest MCP test: the official SDK client (same protocol Claude and other
 * assistants speak) against our /api/mcp endpoint — initialize, list tools,
 * call all three.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const gateway = process.env.GATEWAY_URL ?? "http://localhost:4021";
const transport = new StreamableHTTPClientTransport(new URL(`${gateway}/api/mcp`));
const client = new Client({ name: "test-client", version: "0.0.1" });

await client.connect(transport);
console.log("connected, server:", client.getServerVersion());

const tools = await client.listTools();
console.log("tools:", tools.tools.map((t) => t.name).join(", "));

const search = await client.callTool({
  name: "search_jobs",
  arguments: { q: "engineer", work_mode: "remote" },
});
const jobs = JSON.parse((search.content as { text: string }[])[0].text);
console.log(`search_jobs(engineer, remote): ${jobs.length} results`);
console.log(`  first: ${jobs[0].title} @ ${jobs[0].company} → ${jobs[0].maneki_url}`);

const detail = await client.callTool({ name: "get_job", arguments: { id: jobs[0].id } });
const job = JSON.parse((detail.content as { text: string }[])[0].text);
console.log(`get_job(${jobs[0].id}): ok, salary_min=${job.salary_min}`);

const companies = await client.callTool({ name: "list_hiring_companies", arguments: {} });
const list = JSON.parse((companies.content as { text: string }[])[0].text);
console.log(`list_hiring_companies: ${list.length} companies, top: ${list[0].company} (${list[0].open_positions} jobs)`);

await client.close();
console.log("ALL MCP TESTS PASSED");
