import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { runtimeEventTypes } from "@agent-platform/protocol";

const app = new Hono();

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "agent-platform-api"
  })
);

app.get("/runtime/events", (c) =>
  c.json({
    eventTypes: runtimeEventTypes
  })
);

const port = Number(process.env.API_PORT ?? 8787);

serve({
  fetch: app.fetch,
  port
});

console.log(`Agent Platform API listening on http://localhost:${port}`);
