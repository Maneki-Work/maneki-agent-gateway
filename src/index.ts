import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { StreamableHTTPTransport } from "@hono/mcp";
import { createMcpServer } from "./mcp.js";
import { createAgentPaymentMiddleware } from "./agent.js";
import { searchJobs, toJobWithSalary } from "./jobs.js";

const app = new Hono();

app.get("/", (c) =>
  c.json({
    name: "maneki-agent-gateway",
    product: "https://maneki.work",
    surfaces: {
      "/api/mcp": "Open MCP server (search_jobs, get_job, list_hiring_companies)",
      "/api/agent/jobs":
        "x402 + World AgentKit gated search — free for human-backed agents, USDC otherwise",
    },
  }),
);

// Open MCP surface — stateless: fresh server + transport per request.
app.all("/api/mcp", async (c) => {
  const transport = new StreamableHTTPTransport();
  await createMcpServer().connect(transport);
  return transport.handleRequest(c);
});

// AgentKit-gated surface.
app.use("/api/agent/*", async (c, next) => {
  const headerNames = Object.keys(c.req.header());
  console.log(`[agent] ${c.req.method} ${c.req.path} headers: ${headerNames.join(", ")}`);
  await next();
  console.log(`[agent] → ${c.res.status}`);
  // x402 >=2.x puts the payment-required payload in a response header with an
  // empty JSON body, but @worldcoin/agentkit's client still parses the body.
  // Mirror the header payload into the body so both client styles work.
  if (c.res.status === 402) {
    const encoded = c.res.headers.get("payment-required");
    if (encoded) {
      const headers = new Headers(c.res.headers);
      headers.delete("content-length");
      headers.set("content-type", "application/json");
      c.res = new Response(Buffer.from(encoded, "base64").toString("utf8"), {
        status: 402,
        headers,
      });
    }
  }
});
app.use(createAgentPaymentMiddleware());

// AI matching: forwards the CV to the Maneki matching pipeline. The AgentKit
// middleware has already proven a unique human backs this agent — that proof
// replaces the email-confirm gate of the web funnel.
app.post("/api/agent/match", async (c) => {
  const matchUrl = process.env.MANEKI_MATCH_URL;
  const gatewayKey = process.env.AGENT_GATEWAY_KEY;
  if (!matchUrl || !gatewayKey) {
    return c.json({ error: "matching not configured on this gateway" }, 503);
  }
  const body = await c.req.json().catch(() => null);
  const cvText = typeof body?.cvText === "string" ? body.cvText : null;
  if (!cvText) return c.json({ error: "cvText required" }, 400);

  // The verified agent's wallet address keys the upstream rate limit.
  let agentAddress = "unknown";
  const agentkitHeader = c.req.header("agentkit");
  if (agentkitHeader) {
    try {
      agentAddress = JSON.parse(Buffer.from(agentkitHeader, "base64").toString("utf8")).address;
    } catch {}
  }

  const upstream = await fetch(matchUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-agent-gateway-key": gatewayKey },
    body: JSON.stringify({ cvText, humanId: agentAddress }),
  });
  return c.json(await upstream.json(), upstream.status as 200);
});

app.get("/api/agent/jobs", async (c) => {
  const { q, seniority, work_mode, company, limit } = c.req.query();
  const jobs = await searchJobs({
    q,
    seniority,
    work_mode,
    company,
    limit: limit ? Math.min(Number(limit), 100) : 100,
  });
  return c.json({ count: jobs.length, jobs: jobs.map(toJobWithSalary) });
});

const port = Number(process.env.PORT ?? 4021);
serve({ fetch: app.fetch, port });
console.log(`maneki-agent-gateway listening on http://localhost:${port}`);
