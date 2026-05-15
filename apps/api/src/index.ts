import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  createDatabaseRuntimeConfig,
  databaseProviders,
} from "@agent-platform/db";
import {
  createVectorStoreConfig,
  vectorStoreProviders,
} from "@agent-platform/memory";
import { isHitlDecision } from "@agent-platform/hitl-runtime";
import { runtimeEventTypes } from "@agent-platform/protocol";
import { createRuntimeServices } from "@agent-platform/runtime";
import {
  createObjectStorageConfig,
  objectStorageProviders,
} from "@agent-platform/storage";

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === "/") {
    return "";
  }

  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

function redactUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (url.password) {
      url.password = "***";
    }

    return url.toString();
  } catch {
    return value;
  }
}

function parseStartRunBody(value: unknown): {
  agentCode: string;
  prompt: string;
} {
  if (!value || typeof value !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const body = value as Record<string, unknown>;
  const agentCode =
    typeof body.agentCode === "string" ? body.agentCode : "mock-agent";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    throw new Error("prompt is required.");
  }

  return { agentCode, prompt };
}

function parseHitlDecisionBody(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const body = value as Record<string, unknown>;
  const decision = body.decision ?? body;

  if (!isHitlDecision(decision)) {
    throw new Error("approved boolean is required.");
  }

  return decision;
}

const { store, eventBus, runtime } = createRuntimeServices();
const api = new Hono();

api.use("*", async (c, next) => {
  await next();
  c.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  c.header("Access-Control-Allow-Headers", "Content-Type");
  c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
});

api.options("*", (c) => c.body(null, 204));

api.get("/health", (c) =>
  c.json({
    ok: true,
    service: "agent-platform-api",
  }),
);

api.get("/runtime/events", (c) =>
  c.json({
    eventTypes: runtimeEventTypes,
  }),
);

api.get("/runtime/runs", async (c) =>
  c.json({
    runs: await store.listRuns(),
  }),
);

api.post("/runtime/runs", async (c) => {
  try {
    const input = parseStartRunBody(await c.req.json());
    const result = await runtime.startRun(input);
    const run = await store.getRun(result.runId);

    return c.json({ runId: result.runId, run }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid run request.";
    return c.json({ error: message }, 400);
  }
});

api.get("/runtime/runs/:runId", async (c) => {
  const run = await store.getRun(c.req.param("runId"));

  if (!run) {
    return c.json({ error: "Run not found." }, 404);
  }

  return c.json({ run });
});

api.get("/runtime/runs/:runId/events", async (c) => {
  const runId = c.req.param("runId");
  const run = await store.getRun(runId);

  if (!run) {
    return c.json({ error: "Run not found." }, 404);
  }

  return c.json({ events: await store.listEvents(runId) });
});

api.get("/runtime/runs/:runId/artifacts", async (c) => {
  const runId = c.req.param("runId");
  const run = await store.getRun(runId);

  if (!run) {
    return c.json({ error: "Run not found." }, 404);
  }

  return c.json({ artifacts: await store.listArtifacts(runId) });
});

api.get("/runtime/runs/:runId/hitl", async (c) => {
  const runId = c.req.param("runId");
  const run = await store.getRun(runId);

  if (!run) {
    return c.json({ error: "Run not found." }, 404);
  }

  return c.json({ requests: await store.listHitlRequests(runId) });
});

api.post("/runtime/runs/:runId/hitl/:requestId/respond", async (c) => {
  try {
    const result = await runtime.respondToHitl({
      runId: c.req.param("runId"),
      requestId: c.req.param("requestId"),
      decision: parseHitlDecisionBody(await c.req.json()),
    });
    const run = await store.getRun(result.runId);

    return c.json({ runId: result.runId, run });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid HITL response.";
    return c.json({ error: message }, 400);
  }
});

api.get("/runtime/runs/:runId/events/stream", async (c) => {
  const runId = c.req.param("runId");
  const run = await store.getRun(runId);

  if (!run) {
    return c.json({ error: "Run not found." }, 404);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const existingEvents = await store.listEvents(runId);

      for (const event of existingEvents) {
        controller.enqueue(
          encoder.encode(
            `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          ),
        );
      }

      if (
        existingEvents.some(
          (event) =>
            event.type === "run_finished" || event.type === "run_failed",
        )
      ) {
        controller.close();
        return;
      }

      const subscription = eventBus.subscribe(runId);

      try {
        for await (const event of subscription) {
          controller.enqueue(
            encoder.encode(
              `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
            ),
          );

          if (event.type === "run_finished" || event.type === "run_failed") {
            break;
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});

api.get("/infra/providers", (c) => {
  const database = createDatabaseRuntimeConfig(process.env);
  const vectorStore = createVectorStoreConfig(process.env);
  const objectStorage = createObjectStorageConfig(process.env);

  return c.json({
    database: {
      supported: databaseProviders,
      active: {
        ...database,
        connection: {
          ...database.connection,
          url: redactUrl(database.connection.url),
        },
      },
    },
    vectorStore: {
      supported: vectorStoreProviders,
      active: {
        ...vectorStore,
        apiKey: vectorStore.apiKey ? "***" : undefined,
        databaseUrl: redactUrl(vectorStore.databaseUrl),
      },
    },
    objectStorage: {
      supported: objectStorageProviders,
      active: {
        ...objectStorage,
        accessKeyId: objectStorage.accessKeyId ? "***" : undefined,
        secretAccessKey: objectStorage.secretAccessKey ? "***" : undefined,
      },
    },
  });
});

const app = new Hono();
const basePath = normalizeBasePath(
  process.env.API_BASE_PATH ?? process.env.PUBLIC_BASE_PATH,
);

if (basePath) {
  app.route(basePath, api);
}

app.route("/", api);

const port = Number(process.env.API_PORT ?? 8787);

serve({
  fetch: app.fetch,
  port,
});

console.log(
  `Agent Platform API listening on http://localhost:${port}${basePath || "/"}`,
);
