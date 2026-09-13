/**
 * Per-IP sliding-window rate limit for the open MCP surface.
 *
 * In-memory, same trade-off as the free-trial storage: resets on restart,
 * per-instance on serverless. Good enough to keep the open endpoint from
 * being scraped in bulk — the gated surfaces have their own quota keyed to
 * the human id.
 */
import type { MiddlewareHandler } from "hono";

const SWEEP_EVERY = 5 * 60 * 1000;

export function ipRateLimit(maxRequests: number, windowMs: number): MiddlewareHandler {
  const hits = new Map<string, number[]>();
  let lastSweep = Date.now();

  return async (c, next) => {
    const now = Date.now();
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "local";

    if (now - lastSweep > SWEEP_EVERY) {
      lastSweep = now;
      for (const [key, stamps] of hits) {
        if (stamps[stamps.length - 1]! < now - windowMs) hits.delete(key);
      }
    }

    const recent = (hits.get(ip) ?? []).filter((t) => t > now - windowMs);
    if (recent.length >= maxRequests) {
      const retryAfter = Math.ceil((recent[0]! + windowMs - now) / 1000);
      c.header("retry-after", String(Math.max(retryAfter, 1)));
      return c.json({ error: "rate limit exceeded, slow down" }, 429);
    }
    recent.push(now);
    hits.set(ip, recent);
    await next();
  };
}
