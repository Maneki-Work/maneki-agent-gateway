/**
 * AgentKit/x402 protection for the agent-facing REST endpoint.
 *
 * Policy: agents registered on AgentBook (World ID verified human behind
 * the wallet) get a free-trial quota tied to the anonymous human id —
 * Sybil-proof, since new wallets don't reset it. Everyone else gets a 402
 * and can pay per request in USDC on World Chain or Base.
 *
 * Wiring follows the reference integration at
 * https://docs.world.org/agents/agent-kit/integrate
 */

import { HTTPFacilitatorClient } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  paymentMiddlewareFromHTTPServer,
  x402HTTPResourceServer,
  x402ResourceServer,
} from "@x402/hono";
import {
  agentkitResourceServerExtension,
  createAgentBookVerifier,
  createAgentkitHooks,
  declareAgentkitExtension,
  InMemoryAgentKitStorage,
} from "@worldcoin/agentkit";

const WORLD_CHAIN = "eip155:480" as const;
const BASE = "eip155:8453" as const;
const WORLD_USDC = "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1";

const FREE_TRIAL_USES = 10;
const PRICE_PER_REQUEST = "$0.01";

export function createAgentPaymentMiddleware() {
  let payTo = process.env.PAY_TO_ADDRESS;
  if (!payTo) {
    payTo = "0x0000000000000000000000000000000000000000";
    console.warn(
      "[agent] PAY_TO_ADDRESS not set — demo mode: verification works, but x402 payments would go to the zero address. Set it in .env to receive payments.",
    );
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: "https://x402-worldchain.vercel.app/facilitator",
  });

  const evmScheme = new ExactEvmScheme().registerMoneyParser(
    async (amount, network) => {
      if (network !== WORLD_CHAIN) return null;
      return {
        amount: String(Math.round(Number(amount) * 1e6)),
        asset: WORLD_USDC,
        extra: { name: "USD Coin", version: "2" },
      };
    },
  );

  const agentBook = createAgentBookVerifier();
  // In-memory storage is fine for the hackathon demo; a production deploy
  // must persist usage counters and nonces (AgentKitStorage over Postgres).
  const storage = new InMemoryAgentKitStorage();

  const hooks = createAgentkitHooks({
    agentBook,
    storage,
    mode: { type: "free-trial", uses: FREE_TRIAL_USES },
  });

  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(WORLD_CHAIN, evmScheme)
    .register(BASE, new ExactEvmScheme())
    .registerExtension(agentkitResourceServerExtension);

  const routes = {
    "GET /api/agent/jobs": {
      accepts: [
        { scheme: "exact" as const, price: PRICE_PER_REQUEST, network: WORLD_CHAIN, payTo },
        { scheme: "exact" as const, price: PRICE_PER_REQUEST, network: BASE, payTo },
      ],
      extensions: declareAgentkitExtension({
        statement: "Verify your agent is backed by a real human to search Maneki jobs",
        mode: { type: "free-trial", uses: FREE_TRIAL_USES },
      }),
    },
    // AI matching costs an LLM run per request: lower free quota, higher price.
    "POST /api/agent/match": {
      accepts: [
        { scheme: "exact" as const, price: "$0.10", network: WORLD_CHAIN, payTo },
        { scheme: "exact" as const, price: "$0.10", network: BASE, payTo },
      ],
      extensions: declareAgentkitExtension({
        statement: "Verify your agent is backed by a real human to run Maneki AI matching",
        mode: { type: "free-trial", uses: 3 },
      }),
    },
  };

  const httpServer = new x402HTTPResourceServer(resourceServer, routes).onProtectedRequest(
    hooks.requestHook,
  );

  return paymentMiddlewareFromHTTPServer(httpServer);
}
