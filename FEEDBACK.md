# AgentKit Feedback — Maneki Agent Gateway

Feedback document for the ETHGlobal **AgentKit Continuity** track, from integrating
`@worldcoin/agentkit` 0.2.1 + `@x402/{core,evm,hono}` 2.25.0 into a production job
board's agent gateway ([maneki.work](https://maneki.work)). Everything below was hit
while building this repo; code references point at the workarounds we shipped.

| | |
|---|---|
| Integration | x402 resource server (Hono) + `agentkitResourceServerExtension`, free-trial mode keyed to the human id |
| Client side | `agentkit.fetch` via the demo client (`scripts/demo-client.ts`) |
| AgentBook | Agent registered on World Chain via `npx @worldcoin/agentkit-cli register` + World App |
| Environment | Production World ID (one real Orb-verified human on the team) |

---

## 1. Bug: client reads the 402 payload from the body, x402 ≥2.x puts it in a header

**The one thing we'd fix first.** The `@worldcoin/agentkit` 0.2.1 client parses the
x402 `payment-required` payload from the **response body**. But the `@x402/*` 2.25
resource server emits it as a **base64 `payment-required` response header** with an
empty JSON body. Result: a fully spec-compliant server and the official client can't
complete the 402 → verify/pay handshake out of the box — the client sees an empty
body and gives up.

Our workaround is a response middleware that mirrors the header payload back into the
body so both client generations work (`src/index.ts`, the `/api/agent/*` middleware):

```ts
// x402 >=2.x puts the payment-required payload in a response header with an
// empty JSON body, but @worldcoin/agentkit's client still parses the body.
// Mirror the header payload into the body so both client styles work.
if (c.res.status === 402) {
  const encoded = c.res.headers.get("payment-required");
  if (encoded) { /* decode base64 → set as JSON body */ }
}
```

Suggested fix: the client should prefer the `payment-required` header and fall back
to the body — or the docs should pin the x402 version range the client was tested
against. Nothing in the integration guide warns about this mismatch, and debugging it
means base64-decoding response headers by hand.

## 2. AgentKit docs & integration flow

The quickstart (install → register → `agentkit.fetch` → resource server → storage)
is genuinely good: we went from zero to a verified request in one sitting. Gaps we hit:

- **Version compatibility matrix missing.** See §1 — the guide doesn't say which
  x402 major/minor the client tracks. With x402 moving fast, this is the #1 docs gap.
- **Facilitator endpoint provenance.** The reference integration points at
  `https://x402-worldchain.vercel.app/facilitator`. Is this production infrastructure
  with an SLA, or a hackathon-grade deployment? The docs don't say, and there's no
  obvious first-party domain to trust. A `docs.world.org` page listing official
  facilitator URLs per chain would remove the guesswork. *Field data from our own
  production deploy: the first cold request hit `FacilitatorTimeoutError: supported
  request timed out after 30000ms` (→ 502 to the caller); the immediate retry
  succeeded. An SLA'd endpoint — or a documented client-side cache/warm-up story —
  would prevent this.*
- **Free-trial storage defaults.** `mode: { type: "free-trial" }` with the default
  in-memory storage silently resets everyone's quota on process restart. Fine for
  demos, surprising in production. A one-line warning in the guide (and a reference
  Redis/Postgres storage adapter) would save integrators from discovering this in prod.
- **What we loved:** quota keyed to the **anonymous human id** rather than the wallet
  is the killer primitive — new wallets don't reset the trial. This deserves more
  prominence in the docs; it's the whole reason we built on AgentKit instead of API keys.

## 3. Developer Portal

- **Two divergent paths to Sandbox access.** The hackathon prize description points
  at a Google Form; the docs (`world-id/sandbox/sandbox-access`) say access is granted
  from the Developer Portal (iOS tab → TestFlight enrollment / Android tab → Play
  testing track). We submitted the form with a team email and heard nothing; only by
  reading the docs later did we learn the portal wants the **store-account email**
  (Apple ID / Google account) — a detail the form never surfaced. One canonical path,
  stated in both places, would have saved days.
- Product discovery is otherwise fine: finding AgentKit, AgentBook and the sandbox
  section from the portal home was straightforward.

## 4. Sandbox App — states, proof flows, test users

- **Status at submission:** access form submitted (2026-09-07, team email), no
  response received; portal enrollment re-submitted with the store-account email once
  we found the docs page (2026-09-12). We escalated to `sandbox.access@toolsforhumanity.org`
  citing the hackathon deadline. If access lands before the deadline we'll update this
  section with concrete test notes.
- **Why we needed it and couldn't fake it:** our whole demo rests on Sybil-resistance —
  the free quota follows the human id across wallets. With **one** real Orb-verified
  human on the team, we can prove the happy path in production but cannot test the
  adversarial one (second distinct human, exhausted quota per-human, revoked
  registration) without sandbox test users. This is exactly the scenario the Sandbox
  App exists for, and exactly the one we couldn't exercise.
- **Docs gap:** the AgentKit integration guide never mentions the Sandbox App, and the
  Sandbox docs never mention AgentKit/AgentBook. It's currently impossible to learn
  from the docs whether agent registration and AgentBook resolution work against the
  sandbox environment at all, or only against production World Chain. A short
  "testing AgentKit with the Sandbox" page would close the loop.

## 5. Confusing / missing / broken / hard to test — summary

| # | Item | Severity |
|---|------|----------|
| 1 | Client parses 402 body, x402 2.25 server emits header (§1) | **Broken** — blocks the reference flow |
| 2 | No client↔x402 version compatibility matrix | Missing |
| 3 | Sandbox App absent from AgentKit docs (and vice versa) | Missing — blocks remote/adversarial testing |
| 4 | Sandbox access: form vs portal ambiguity, store-email requirement undocumented in the form | Confusing |
| 5 | Facilitator URL provenance/SLA unclear | Confusing |
| 6 | In-memory free-trial storage resets quotas on restart, no warning | Confusing |
| 7 | Multi-human (Sybil) scenarios untestable without sandbox test users | Hard to test |

---

*Maneki Agent Gateway — ETHGlobal, World AgentKit Continuity track.*
*Repo: https://github.com/Maneki-Work/maneki-agent-gateway · Product: https://maneki.work*
