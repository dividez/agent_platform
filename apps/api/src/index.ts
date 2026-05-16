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
import {
  createObservability,
  redactObservabilityConfig,
} from "@agent-platform/observability";
import {
  isHitlDecision,
  type HitlDecision,
} from "@agent-platform/hitl-runtime";
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

function createRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}

function getStatusGroup(status: number): string {
  if (status >= 500) {
    return "5xx";
  }

  if (status >= 400) {
    return "4xx";
  }

  if (status >= 300) {
    return "3xx";
  }

  if (status >= 200) {
    return "2xx";
  }

  return "1xx";
}

function routeTemplate(path: string, basePath: string): string {
  const apiPath =
    basePath && path.startsWith(basePath)
      ? path.slice(basePath.length) || "/"
      : path;

  return apiPath
    .replace(
      /\/runtime\/runs\/[^/]+\/hitl\/[^/]+\/respond$/,
      "/runtime/runs/:runId/hitl/:requestId/respond",
    )
    .replace(
      /\/runtime\/runs\/[^/]+\/events\/stream$/,
      "/runtime/runs/:runId/events/stream",
    )
    .replace(/\/runtime\/runs\/[^/]+\/events$/, "/runtime/runs/:runId/events")
    .replace(
      /\/runtime\/runs\/[^/]+\/artifacts$/,
      "/runtime/runs/:runId/artifacts",
    )
    .replace(/\/runtime\/runs\/[^/]+\/hitl$/, "/runtime/runs/:runId/hitl")
    .replace(/\/runtime\/runs\/[^/]+$/, "/runtime/runs/:runId");
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

function parseHitlDecisionBody(value: unknown): HitlDecision {
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
const observability = createObservability(process.env, {
  name: "agent-platform-api",
});
const { logger, metrics, tracer } = observability;
const api = new Hono();
const basePath = normalizeBasePath(
  process.env.API_BASE_PATH ?? process.env.PUBLIC_BASE_PATH,
);
const serviceStartedAt = Date.now();

metrics.setGauge("api_uptime_seconds", {}, 0);

api.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  const method = c.req.method;
  const requestId = c.req.header("x-request-id") ?? createRequestId();
  const route = routeTemplate(url.pathname, basePath);
  const span = tracer.startSpan({
    name: `${method} ${route}`,
    kind: "server",
    parent: c.req.header("traceparent"),
    attributes: {
      "http.request.method": method,
      "url.path": url.pathname,
      "url.route": route,
      "client.address": c.req.header("x-forwarded-for") ?? undefined,
      "user_agent.original": c.req.header("user-agent") ?? undefined,
      "request.id": requestId,
    },
  });
  const startedAt = Date.now();

  c.header("x-request-id", requestId);

  if (
    observability.config.tracing.enabled &&
    observability.config.tracing.propagateTraceContext
  ) {
    c.header("traceparent", span.traceparent);
  }

  try {
    await next();
  } catch (error) {
    span.recordException(error);
    logger.error("http request failed", {
      requestId,
      traceId: span.context.traceId,
      spanId: span.context.spanId,
      method,
      route,
      error,
    });
    throw error;
  } finally {
    const durationMs = Date.now() - startedAt;
    const status = c.res.status || 500;
    const statusGroup = getStatusGroup(status);

    span.end(status >= 500 ? "error" : "ok", {
      "http.response.status_code": status,
      "duration.ms": durationMs,
    });

    if (route !== observability.config.metrics.endpoint) {
      metrics.incrementCounter("http_requests_total", {
        method,
        route,
        status,
        status_group: statusGroup,
      });
      metrics.observeHistogram("http_request_duration_ms", durationMs, {
        method,
        route,
        status_group: statusGroup,
      });

      logger.info("http request completed", {
        requestId,
        traceId: span.context.traceId,
        spanId: span.context.spanId,
        method,
        route,
        status,
        durationMs,
      });
    }
  }
});

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
    uptimeSeconds: Math.floor((Date.now() - serviceStartedAt) / 1000),
  }),
);

api.get(observability.config.metrics.endpoint, (c) => {
  metrics.setGauge(
    "api_uptime_seconds",
    {},
    Math.floor((Date.now() - serviceStartedAt) / 1000),
  );

  if (!observability.config.metrics.enabled) {
    return c.text("metrics disabled\n", 404);
  }

  return c.text(metrics.format(), 200, {
    "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
  });
});

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
    metrics.incrementCounter("runtime_runs_started_total", {
      agent_code: input.agentCode,
    });

    return c.json({ runId: result.runId, run }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid run request.";
    logger.warn("runtime run start rejected", { error });
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
    const decision = parseHitlDecisionBody(await c.req.json());
    const result = await runtime.respondToHitl({
      runId: c.req.param("runId"),
      requestId: c.req.param("requestId"),
      decision,
    });
    const run = await store.getRun(result.runId);
    metrics.incrementCounter("runtime_hitl_decisions_total", {
      approved: String(decision.approved),
    });

    return c.json({ runId: result.runId, run });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid HITL response.";
    logger.warn("hitl response rejected", { error });
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

api.get("/infra/observability", (c) =>
  c.json({
    active: redactObservabilityConfig(observability.config),
  }),
);

const app = new Hono();

if (basePath) {
  app.route(basePath, api);
}

app.route("/", api);

const port = Number(process.env.API_PORT ?? 8787);

serve({
  fetch: app.fetch,
  port,
});

logger.info("api server started", {
  url: `http://localhost:${port}${basePath || "/"}`,
  metricsEndpoint: `${basePath}${observability.config.metrics.endpoint}`,
});
