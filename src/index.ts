import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 4021);
serve({ fetch: app.fetch, port });
console.log(`maneki-agent-gateway listening on http://localhost:${port}`);
