/**
 * Demo agent: calls the gated endpoint as a human-backed agent.
 *
 * Prerequisites:
 *   1. Register the agent wallet (prompts World App verification):
 *        npx @worldcoin/agentkit-cli register <agent-address>
 *   2. Set AGENT_PRIVATE_KEY in .env to that wallet's private key.
 *   3. Run the gateway (npm run dev), then: npm run demo
 */

import "../src/env.js";
import { createAgentkitClient } from "@worldcoin/agentkit";
import { privateKeyToAccount } from "viem/accounts";

const pk = process.env.AGENT_PRIVATE_KEY;
if (!pk) throw new Error("Set AGENT_PRIVATE_KEY to the registered agent wallet's private key");

const account = privateKeyToAccount(pk as `0x${string}`);
const gateway = process.env.GATEWAY_URL ?? "http://localhost:4021";

const agentkit = createAgentkitClient({
  signer: {
    address: account.address,
    chainId: "eip155:8453",
    type: "eip191",
    signMessage: (message) => account.signMessage({ message }),
  },
  onEvent: (event) => console.log(`[agentkit] ${JSON.stringify(event)}`),
});

// `npm run demo -- match [cv-file]` runs AI matching (.pdf or plain text);
// anything else searches.
if (process.argv[2] === "match") {
  const { readFileSync } = await import("node:fs");
  const cvPath = process.argv[3] ?? "scripts/demo-cv.txt";
  let cvText: string;
  if (cvPath.toLowerCase().endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parsed = await new PDFParse({ data: readFileSync(cvPath) }).getText();
    cvText = parsed.text ?? "";
    console.log(`parsed PDF: ${cvText.length} chars of text`);
  } else {
    cvText = readFileSync(cvPath, "utf8");
  }
  const url = `${gateway}/api/agent/match`;
  console.log(`agent ${account.address} → POST ${url} (cv: ${cvText.length} chars)`);
  const response = await agentkit.fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cvText }),
  });
  console.log(`status: ${response.status}`);
  const data = await response.json();
  if (Array.isArray(data.results)) {
    console.log(`matches: ${data.results.length} (judged ${data.stats?.judged} of ${data.stats?.candidates} candidates)`);
    for (const r of data.results.slice(0, 5)) {
      console.log(`  [${r.score}] ${r.title} @ ${r.company} → ${r.maneki_url}`);
    }
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
} else {
  const url = `${gateway}/api/agent/jobs?q=${encodeURIComponent(process.argv[2] ?? "solidity")}`;
  console.log(`agent ${account.address} → GET ${url}`);
  const response = await agentkit.fetch(url);
  console.log(`status: ${response.status}`);
  const body = await response.json();
  console.log(JSON.stringify(body, null, 2));
}
