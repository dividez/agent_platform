export const logLevels = ["debug", "info", "warn", "error", "silent"] as const;
export const logFormats = ["json", "pretty"] as const;
export const traceExporters = ["none", "console", "otlp"] as const;

export type LogLevel = (typeof logLevels)[number];
export type LogFormat = (typeof logFormats)[number];
export type TraceExporterName = (typeof traceExporters)[number];
export type LogFields = Record<string, unknown>;

export interface ObservabilityServiceConfig {
  readonly name: string;
  readonly version: string;
  readonly environment: string;
  readonly instanceId?: string;
}

export interface LoggingConfig {
  readonly enabled: boolean;
  readonly level: LogLevel;
  readonly format: LogFormat;
  readonly redactKeys: readonly string[];
  readonly includeTraceContext: boolean;
}

export interface MetricsConfig {
  readonly enabled: boolean;
  readonly endpoint: string;
  readonly prefix: string;
  readonly collectDefaultMetrics: boolean;
  readonly requestDurationBucketsMs: readonly number[];
}

export interface TracingConfig {
  readonly enabled: boolean;
  readonly sampleRate: number;
  readonly exporter: TraceExporterName;
  readonly otlpEndpoint?: string;
  readonly otlpHeaders: Record<string, string>;
  readonly propagateTraceContext: boolean;
  readonly logFinishedSpans: boolean;
}

export interface ObservabilityConfig {
  readonly service: ObservabilityServiceConfig;
  readonly logging: LoggingConfig;
  readonly metrics: MetricsConfig;
  readonly tracing: TracingConfig;
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly sampled: boolean;
  readonly traceparent: string;
}

export interface SpanOptions {
  readonly name: string;
  readonly kind?: "internal" | "server" | "client" | "producer" | "consumer";
  readonly parent?: string | TraceContext;
  readonly attributes?: LogFields;
}

export interface FinishedSpan {
  readonly name: string;
  readonly kind: NonNullable<SpanOptions["kind"]>;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly sampled: boolean;
  readonly status: "ok" | "error";
  readonly startTime: string;
  readonly endTime: string;
  readonly durationMs: number;
  readonly attributes: LogFields;
  readonly error?: {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  };
}

export interface Span {
  readonly context: TraceContext;
  readonly traceparent: string;
  setAttribute(key: string, value: unknown): void;
  recordException(error: unknown): void;
  end(status?: "ok" | "error", attributes?: LogFields): FinishedSpan;
}

export interface Tracer {
  startSpan(options: SpanOptions): Span;
}

export interface Observability {
  readonly config: ObservabilityConfig;
  readonly logger: Logger;
  readonly metrics: PrometheusRegistry;
  readonly tracer: Tracer;
}

const defaultRedactKeys = [
  "authorization",
  "cookie",
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "access_key",
  "secret_access_key",
  "private_key",
] as const;

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

export function createObservabilityConfig(
  env: Record<string, string | undefined>,
  defaults: Partial<ObservabilityServiceConfig> = {},
): ObservabilityConfig {
  const globalEnabled = env.OBSERVABILITY_ENABLED !== "false";
  const serviceName =
    env.OTEL_SERVICE_NAME ??
    env.SERVICE_NAME ??
    defaults.name ??
    "agent-platform";

  return {
    service: {
      name: serviceName,
      version:
        env.SERVICE_VERSION ??
        env.npm_package_version ??
        defaults.version ??
        "0.1.0",
      environment:
        env.DEPLOYMENT_ENVIRONMENT ??
        env.NODE_ENV ??
        defaults.environment ??
        "development",
      instanceId: env.SERVICE_INSTANCE_ID ?? defaults.instanceId,
    },
    logging: {
      enabled: globalEnabled && env.LOGGING_ENABLED !== "false",
      level: parseLogLevel(env.LOG_LEVEL ?? env.OBSERVABILITY_LOG_LEVEL),
      format: parseLogFormat(env.LOG_FORMAT ?? env.OBSERVABILITY_LOG_FORMAT),
      redactKeys: parseList(env.LOG_REDACT_KEYS, defaultRedactKeys),
      includeTraceContext:
        env.LOG_INCLUDE_TRACE_CONTEXT !== "false" &&
        env.OBSERVABILITY_LOG_INCLUDE_TRACE_CONTEXT !== "false",
    },
    metrics: {
      enabled: globalEnabled && env.METRICS_ENABLED !== "false",
      endpoint: normalizeEndpoint(
        env.METRICS_ENDPOINT ?? env.OBSERVABILITY_METRICS_ENDPOINT ?? "/metrics",
      ),
      prefix: normalizeMetricPrefix(
        env.METRICS_PREFIX ?? env.OBSERVABILITY_METRICS_PREFIX ?? "agent_platform",
      ),
      collectDefaultMetrics:
        env.METRICS_COLLECT_DEFAULTS !== "false" &&
        env.OBSERVABILITY_METRICS_COLLECT_DEFAULTS !== "false",
      requestDurationBucketsMs: parseNumberList(
        env.METRICS_HTTP_DURATION_BUCKETS_MS,
        [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      ),
    },
    tracing: {
      enabled: globalEnabled && env.TRACING_ENABLED !== "false",
      sampleRate: clampNumber(
        parseNumber(
          env.TRACING_SAMPLE_RATE ??
            env.OBSERVABILITY_TRACE_SAMPLE_RATE ??
            env.OTEL_TRACES_SAMPLER_ARG,
          1,
        ),
        0,
        1,
      ),
      exporter: parseTraceExporter(
        env.TRACING_EXPORTER ??
          env.OBSERVABILITY_TRACE_EXPORTER ??
          env.OTEL_TRACES_EXPORTER,
      ),
      otlpEndpoint:
        env.TRACING_OTLP_ENDPOINT ??
        env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
        env.OTEL_EXPORTER_OTLP_ENDPOINT,
      otlpHeaders: parseKeyValueList(
        env.TRACING_OTLP_HEADERS ?? env.OTEL_EXPORTER_OTLP_HEADERS,
      ),
      propagateTraceContext:
        env.TRACING_PROPAGATE_CONTEXT !== "false" &&
        env.OBSERVABILITY_TRACE_PROPAGATE_CONTEXT !== "false",
      logFinishedSpans:
        env.TRACING_LOG_SPANS === "true" ||
        env.OBSERVABILITY_TRACE_LOG_SPANS === "true",
    },
  };
}

export function createObservability(
  env: Record<string, string | undefined>,
  defaults: Partial<ObservabilityServiceConfig> = {},
): Observability {
  const config = createObservabilityConfig(env, defaults);
  const logger = createLogger(config);
  const metrics = new PrometheusRegistry(config.metrics, config.service);
  const tracer = createTracer(config, logger);

  if (config.metrics.collectDefaultMetrics) {
    metrics.setGauge("process_start_time_seconds", {}, Date.now() / 1000);
    metrics.setGauge("service_info", {
      service_name: config.service.name,
      service_version: config.service.version,
      environment: config.service.environment,
    });
  }

  return { config, logger, metrics, tracer };
}

export function createLogger(
  config: Pick<ObservabilityConfig, "service" | "logging">,
  context: LogFields = {},
): Logger {
  const log = (
    level: Exclude<LogLevel, "silent">,
    message: string,
    fields: LogFields = {},
  ) => {
    if (
      !config.logging.enabled ||
      levelPriority[level] < levelPriority[config.logging.level]
    ) {
      return;
    }

    const entry = redactValue(
      {
        timestamp: new Date().toISOString(),
        level,
        service: config.service.name,
        version: config.service.version,
        environment: config.service.environment,
        instanceId: config.service.instanceId,
        message,
        ...context,
        ...serializeLogFields(fields),
      },
      config.logging.redactKeys,
    ) as LogFields;

    if (config.logging.format === "pretty") {
      console.log(formatPrettyLog(entry));
      return;
    }

    console.log(JSON.stringify(entry));
  };

  return {
    debug: (message, fields) => log("debug", message, fields),
    info: (message, fields) => log("info", message, fields),
    warn: (message, fields) => log("warn", message, fields),
    error: (message, fields) => log("error", message, fields),
    child: (fields) => createLogger(config, { ...context, ...fields }),
  };
}

export class PrometheusRegistry {
  private readonly counters = new Map<string, MetricSample>();
  private readonly gauges = new Map<string, MetricSample>();
  private readonly histograms = new Map<string, HistogramSample>();
  private readonly config: MetricsConfig;
  private readonly service: ObservabilityServiceConfig;

  constructor(config: MetricsConfig, service: ObservabilityServiceConfig) {
    this.config = config;
    this.service = service;
  }

  incrementCounter(
    name: string,
    labels: Record<string, string | number | boolean> = {},
    value = 1,
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const key = createMetricKey(name, labels);
    const current = this.counters.get(key);

    this.counters.set(key, {
      name: this.metricName(name),
      labels: normalizeLabels(labels),
      value: (current?.value ?? 0) + value,
    });
  }

  setGauge(
    name: string,
    labels: Record<string, string | number | boolean> = {},
    value = 1,
  ): void {
    if (!this.config.enabled) {
      return;
    }

    this.gauges.set(createMetricKey(name, labels), {
      name: this.metricName(name),
      labels: normalizeLabels(labels),
      value,
    });
  }

  observeHistogram(
    name: string,
    value: number,
    labels: Record<string, string | number | boolean> = {},
    buckets: readonly number[] = this.config.requestDurationBucketsMs,
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const normalizedBuckets = [...buckets].sort((a, b) => a - b);
    const key = createMetricKey(name, {
      ...labels,
      __buckets: normalizedBuckets.join(","),
    });
    const current =
      this.histograms.get(key) ??
      createHistogramSample(this.metricName(name), labels, normalizedBuckets);

    current.count += 1;
    current.sum += value;

    for (const bucket of normalizedBuckets) {
      if (value <= bucket) {
        current.buckets.set(bucket, (current.buckets.get(bucket) ?? 0) + 1);
      }
    }

    this.histograms.set(key, current);
  }

  format(): string {
    if (!this.config.enabled) {
      return "";
    }

    const buildInfoName = this.metricName("build_info");
    const lines: string[] = [
      `# HELP ${buildInfoName} Static service metadata.`,
      `# TYPE ${buildInfoName} gauge`,
      `${buildInfoName}${formatLabels({
        service_name: this.service.name,
        service_version: this.service.version,
        environment: this.service.environment,
      })} 1`,
    ];

    for (const sample of this.counters.values()) {
      lines.push(`# TYPE ${sample.name} counter`);
      lines.push(`${sample.name}${formatLabels(sample.labels)} ${sample.value}`);
    }

    for (const sample of this.gauges.values()) {
      lines.push(`# TYPE ${sample.name} gauge`);
      lines.push(`${sample.name}${formatLabels(sample.labels)} ${sample.value}`);
    }

    for (const sample of this.histograms.values()) {
      lines.push(`# TYPE ${sample.name} histogram`);

      for (const [bucket, count] of sample.buckets) {
        lines.push(
          `${sample.name}_bucket${formatLabels({
            ...sample.labels,
            le: String(bucket),
          })} ${count}`,
        );
      }

      lines.push(
        `${sample.name}_bucket${formatLabels({
          ...sample.labels,
          le: "+Inf",
        })} ${sample.count}`,
      );
      lines.push(`${sample.name}_sum${formatLabels(sample.labels)} ${sample.sum}`);
      lines.push(
        `${sample.name}_count${formatLabels(sample.labels)} ${sample.count}`,
      );
    }

    return `${lines.join("\n")}\n`;
  }

  private metricName(name: string): string {
    const normalized = name.replace(/[^a-zA-Z0-9_:]/g, "_");

    if (!this.config.prefix) {
      return normalized;
    }

    return `${this.config.prefix}_${normalized}`;
  }
}

export function createTracer(
  config: Pick<ObservabilityConfig, "service" | "tracing">,
  logger?: Logger,
): Tracer {
  return {
    startSpan(options) {
      const parent = parseParentContext(options.parent);
      const sampled =
        config.tracing.enabled &&
        (parent?.sampled ?? Math.random() <= config.tracing.sampleRate);
      const traceId = parent?.traceId ?? randomHex(16);
      const spanId = randomHex(8);
      const startedAt = Date.now();
      const attributes: LogFields = {
        "service.name": config.service.name,
        "service.version": config.service.version,
        "deployment.environment": config.service.environment,
        ...options.attributes,
      };
      let error: FinishedSpan["error"];
      let ended = false;
      const context = createTraceContext(traceId, spanId, parent?.spanId, sampled);

      return {
        context,
        traceparent: context.traceparent,
        setAttribute(key, value) {
          attributes[key] = value;
        },
        recordException(value) {
          error = serializeError(value);
        },
        end(status = error ? "error" : "ok", endAttributes = {}) {
          if (ended) {
            return createFinishedSpan(
              options,
              context,
              startedAt,
              Date.now(),
              status,
              { ...attributes, ...endAttributes },
              error,
            );
          }

          ended = true;
          const finished = createFinishedSpan(
            options,
            context,
            startedAt,
            Date.now(),
            status,
            { ...attributes, ...endAttributes },
            error,
          );

          if (
            config.tracing.enabled &&
            sampled &&
            (config.tracing.exporter === "console" ||
              config.tracing.logFinishedSpans)
          ) {
            logger?.debug("span finished", { span: finished });
          }

          return finished;
        },
      };
    },
  };
}

export function parseTraceparent(
  value: string | undefined,
): TraceContext | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(
    /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i,
  );

  if (!match || match[1] === "0".repeat(32) || match[2] === "0".repeat(16)) {
    return undefined;
  }

  return createTraceContext(
    match[1].toLowerCase(),
    match[2].toLowerCase(),
    undefined,
    (Number.parseInt(match[3], 16) & 1) === 1,
  );
}

export function redactValue(
  value: unknown,
  redactKeys: readonly string[],
): unknown {
  return redactRecursive(value, createRedactKeySet(redactKeys), new WeakSet());
}

export function redactObservabilityConfig(
  config: ObservabilityConfig,
): ObservabilityConfig {
  return {
    ...config,
    tracing: {
      ...config.tracing,
      otlpEndpoint: config.tracing.otlpEndpoint
        ? redactUrlPassword(config.tracing.otlpEndpoint)
        : undefined,
      otlpHeaders: Object.fromEntries(
        Object.keys(config.tracing.otlpHeaders).map((key) => [key, "***"]),
      ),
    },
  };
}

interface MetricSample {
  readonly name: string;
  readonly labels: Record<string, string>;
  readonly value: number;
}

interface HistogramSample {
  readonly name: string;
  readonly labels: Record<string, string>;
  readonly buckets: Map<number, number>;
  count: number;
  sum: number;
}

function parseLogLevel(value: string | undefined): LogLevel {
  return logLevels.includes(value as LogLevel) ? (value as LogLevel) : "info";
}

function parseLogFormat(value: string | undefined): LogFormat {
  return logFormats.includes(value as LogFormat) ? (value as LogFormat) : "json";
}

function parseTraceExporter(value: string | undefined): TraceExporterName {
  if (value === "otlp" || value === "console" || value === "none") {
    return value;
  }

  if (value === "otlp,http/protobuf" || value === "otlp/protobuf") {
    return "otlp";
  }

  return "none";
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseNumberList(
  value: string | undefined,
  fallback: readonly number[],
): readonly number[] {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
    .sort((a, b) => a - b);

  return parsed.length > 0 ? parsed : fallback;
}

function parseList(
  value: string | undefined,
  fallback: readonly string[],
): readonly string[] {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

function parseKeyValueList(value: string | undefined): Record<string, string> {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [key, ...parts] = item.split("=");
        return [key.trim(), parts.join("=").trim()] as const;
      })
      .filter(([key]) => Boolean(key)),
  );
}

function normalizeEndpoint(value: string): string {
  const path = value.trim() || "/metrics";
  return path.startsWith("/") ? path : `/${path}`;
}

function normalizeMetricPrefix(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");
}

function parseParentContext(parent: string | TraceContext | undefined) {
  if (!parent) {
    return undefined;
  }

  return typeof parent === "string" ? parseTraceparent(parent) : parent;
}

function createTraceContext(
  traceId: string,
  spanId: string,
  parentSpanId: string | undefined,
  sampled: boolean,
): TraceContext {
  return {
    traceId,
    spanId,
    parentSpanId,
    sampled,
    traceparent: `00-${traceId}-${spanId}-${sampled ? "01" : "00"}`,
  };
}

function createFinishedSpan(
  options: SpanOptions,
  context: TraceContext,
  startedAt: number,
  endedAt: number,
  status: "ok" | "error",
  attributes: LogFields,
  error: FinishedSpan["error"],
): FinishedSpan {
  return {
    name: options.name,
    kind: options.kind ?? "internal",
    traceId: context.traceId,
    spanId: context.spanId,
    parentSpanId: context.parentSpanId,
    sampled: context.sampled,
    status,
    startTime: new Date(startedAt).toISOString(),
    endTime: new Date(endedAt).toISOString(),
    durationMs: endedAt - startedAt,
    attributes,
    error,
  };
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function serializeLogFields(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value instanceof Error ? serializeError(value) : value,
    ]),
  );
}

function serializeError(error: unknown): FinishedSpan["error"] {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "Error",
    message: String(error),
  };
}

function createRedactKeySet(redactKeys: readonly string[]): Set<string> {
  return new Set(redactKeys.map((key) => key.toLowerCase()));
}

function redactRecursive(
  value: unknown,
  redactKeys: Set<string>,
  seen: WeakSet<object>,
  key = "",
): unknown {
  if (shouldRedactKey(key, redactKeys)) {
    return "***";
  }

  if (typeof value === "string") {
    return redactUrlPassword(value);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactRecursive(item, redactKeys, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(
      ([entryKey, entryValue]) => [
        entryKey,
        redactRecursive(entryValue, redactKeys, seen, entryKey),
      ],
    ),
  );
}

function shouldRedactKey(key: string, redactKeys: Set<string>): boolean {
  const normalized = key.toLowerCase();
  return [...redactKeys].some((redactKey) => normalized.includes(redactKey));
}

function redactUrlPassword(value: string): string {
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

function formatPrettyLog(entry: LogFields): string {
  const { timestamp, level, message, ...rest } = entry;
  const suffix = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
  return `${timestamp} ${String(level).toUpperCase()} ${String(message)}${suffix}`;
}

function normalizeLabels(
  labels: Record<string, string | number | boolean>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(labels)
      .filter(([key]) => !key.startsWith("__"))
      .map(([key, value]) => [
        key.replace(/[^a-zA-Z0-9_]/g, "_"),
        String(value),
      ]),
  );
}

function formatLabels(labels: Record<string, string | number | boolean>): string {
  const entries = Object.entries(labels);

  if (entries.length === 0) {
    return "";
  }

  return `{${entries
    .map(
      ([key, value]) =>
        `${key}="${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    )
    .join(",")}}`;
}

function createMetricKey(
  name: string,
  labels: Record<string, string | number | boolean>,
): string {
  return `${name}:${Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(",")}`;
}

function createHistogramSample(
  name: string,
  labels: Record<string, string | number | boolean>,
  buckets: readonly number[],
): HistogramSample {
  return {
    name,
    labels: normalizeLabels(labels),
    buckets: new Map(buckets.map((bucket) => [bucket, 0])),
    count: 0,
    sum: 0,
  };
}
