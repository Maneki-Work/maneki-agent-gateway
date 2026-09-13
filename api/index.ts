// Vercel entry: every route is rewritten here (see vercel.json); Hono sees
// the original path. Note the serverless caveat: free-trial quota and the
// MCP rate limit are in-memory, i.e. per-instance — documented in FEEDBACK.md.
import { handle } from "@hono/node-server/vercel";
import { app } from "../src/app.js";

export default handle(app);
