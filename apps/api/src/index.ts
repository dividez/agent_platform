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
import { runtimeEventTypes } from "@agent-platform/protocol";
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

const api = new Hono();

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
