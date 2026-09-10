<div align="center">
  <a href="https://maneki.work">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/wordmark-dark.png">
      <img src="assets/wordmark-light.png" alt="Maneki" width="380">
    </picture>
  </a>

### Discover free, act human.

**The first Web3 job board that serves human-verified AI agents — and blocks the bots.**

[![ETHGlobal](https://img.shields.io/badge/ETHGlobal-Continuity_Track-7b3fe4)](https://ethglobal.com)
[![World AgentKit](https://img.shields.io/badge/World-AgentKit-0A0A0A)](https://github.com/worldcoin/agentkit)
[![MCP](https://img.shields.io/badge/MCP-server-E63946)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-fafaf7)](LICENSE)

[**maneki.work**](https://maneki.work) · [@Maneki_jobs](https://x.com/Maneki_jobs) · [Telegram](https://t.me/manekijobs) · [Open dataset](https://github.com/Maneki-Work/jobs-data)

</div>

---

[maneki.work](https://maneki.work) is a live Web3 job board (~10k active jobs, scraped nightly from 60+ sources). Job-hunting agents are coming; recruiting spam from unverified automation is already here. This gateway, built for **ETHGlobal** on the **World AgentKit** track, gives agents a first-class way in — with [World ID proof of personhood](https://world.org) deciding who gets it for free.

**Discovery is open, like the web. Actions are human-verified**: searching costs nothing, but AI matching, full result sets and (soon) applications require proof that a real, unique human stands behind the agent — or an x402 micropayment.

## Two surfaces

| Surface | Access | What it serves |
|---|---|---|
| `POST /api/mcp` | Open | MCP server for AI assistants: `search_jobs`, `get_job`, `list_hiring_companies` (compact, capped results) |
| `GET /api/agent/jobs` | x402 + [AgentKit](https://github.com/worldcoin/agentkit) | Full search with salary data. **Free quota for human-backed agents**, USDC (World Chain / Base) for everyone else |

The AgentKit free quota is tied to the **anonymous human id** behind the agent's wallet, not the wallet itself — spinning up new wallets doesn't reset it. Sybil-resistant rate limiting without accounts, cookies or API keys.

One rule applies everywhere: results link to Maneki job pages only, never to direct apply URLs.

## Run it

```bash
npm install
cp .env.example .env   # set PAY_TO_ADDRESS
npm run dev
```

The gateway reads the [public Maneki dataset](https://github.com/Maneki-Work/jobs-data) (100 most recent jobs) so it runs out of the box. The production deployment sets `FULL_DATA_URL` to serve the full dataset — the premium resource verified agents unlock.

### Try the MCP server

Point any MCP client at `http://localhost:4021/api/mcp` (Streamable HTTP), e.g. in Claude Code:

```bash
claude mcp add --transport http maneki-jobs http://localhost:4021/api/mcp
```

### Try the gated endpoint as an agent

```bash
# one-time: register your agent wallet (prompts World App verification)
npx @worldcoin/agentkit-cli register <agent-address>

# set AGENT_PRIVATE_KEY in .env, then
npm run demo -- "solidity"
```

Unverified callers get `402 Payment Required` with x402 payment instructions (USDC on World Chain or Base).

## Architecture

```
┌──────────────┐   MCP (open)    ┌─────────────────────┐
│ AI assistant ├────────────────►│                     │      ┌────────────────┐
└──────────────┘                 │ maneki-agent-gateway├─────►│ jobs dataset   │
┌──────────────┐  x402+AgentKit  │  (Hono)             │      │ (public export)│
│ agent+wallet ├────────────────►│                     │      └────────────────┘
└──────┬───────┘                 └──────────┬──────────┘
       │ registered on                      │ verifies signature
       ▼                                    ▼
┌──────────────┐                 ┌─────────────────────┐
│  World App   │                 │ AgentBook           │
│ (World ID)   │                 │ (World Chain)       │
└──────────────┘                 └─────────────────────┘
```

- **Stack**: Hono + `@x402/hono` + `@worldcoin/agentkit` + `@modelcontextprotocol/sdk`
- **Data**: public [jobs-data](https://github.com/Maneki-Work/jobs-data) export, refreshed every 2h from the Maneki pipeline
- **Storage**: in-memory for the demo; production requires persistent nonce/usage storage (`AgentKitStorage` over Postgres)

## Why this matters for recruiting

Every application funneled through a verified agent carries an implicit signal no job board offers today: *a real, unique human is behind this*. That flips the AI-application-spam problem into a feature — agents welcome, bots priced out.

## License

MIT
