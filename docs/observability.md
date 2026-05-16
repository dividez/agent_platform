# Observability

Agent Platform exposes configurable logging, metrics, and trace context from the API service without binding the runtime to one vendor.

## Logging

The API writes structured logs to stdout by default, which is the recommended container pattern.

Key variables:

- `LOGGING_ENABLED`: enable or disable application logs.
- `LOG_LEVEL`: `debug`, `info`, `warn`, `error`, or `silent`.
- `LOG_FORMAT`: `json` for production collectors, `pretty` for local debugging.
- `LOG_REDACT_KEYS`: comma-separated key fragments that should be redacted from log fields.
- `LOG_INCLUDE_TRACE_CONTEXT`: keep request trace identifiers in request logs.

Every HTTP request log includes `requestId`, `traceId`, `spanId`, method, normalized route, status, and duration. Sensitive fields such as tokens, cookies, passwords, and API keys are redacted before output.

## Metrics

Prometheus-format metrics are exposed from the API service at `METRICS_ENDPOINT`, defaulting to `/metrics`.

Key variables:

- `METRICS_ENABLED`: enable or disable metric collection and exposure.
- `METRICS_ENDPOINT`: scrape endpoint path.
- `METRICS_PREFIX`: metric name prefix, default `agent_platform`.
- `METRICS_COLLECT_DEFAULTS`: expose static service metadata and uptime gauges.
- `METRICS_HTTP_DURATION_BUCKETS_MS`: comma-separated histogram buckets for request latency.

Core metrics:

- `agent_platform_http_requests_total`
- `agent_platform_http_request_duration_ms`
- `agent_platform_runtime_runs_started_total`
- `agent_platform_runtime_hitl_decisions_total`
- `agent_platform_api_uptime_seconds`
- `agent_platform_build_info`

Route labels are normalized, so identifiers such as `runId` and `requestId` do not create high-cardinality metrics.

## Tracing

The API accepts and returns W3C `traceparent` headers. A lightweight internal tracer creates request spans and can log finished spans for local diagnostics. Deployment adapters can use the same config surface to wire OpenTelemetry SDK exporters later.

Key variables:

- `TRACING_ENABLED`: enable or disable span creation and propagation.
- `TRACING_SAMPLE_RATE`: sampling ratio from `0` to `1`.
- `TRACING_PROPAGATE_CONTEXT`: return `traceparent` response headers.
- `TRACING_EXPORTER`: `none`, `console`, or `otlp`.
- `TRACING_LOG_SPANS`: write finished spans into structured logs.
- `TRACING_OTLP_ENDPOINT`: OTLP endpoint for deployment adapters.
- `TRACING_OTLP_HEADERS`: comma-separated OTLP headers, such as `api-key=value`.

OpenTelemetry-compatible aliases are also recognized:

- `OTEL_SERVICE_NAME`
- `OTEL_TRACES_EXPORTER`
- `OTEL_TRACES_SAMPLER_ARG`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
- `OTEL_EXPORTER_OTLP_HEADERS`

## Runtime Inspection

The active redacted observability config is available at:

```text
GET /infra/observability
```

The regular health endpoint includes service uptime:

```text
GET /health
```
