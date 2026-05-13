CREATE TABLE IF NOT EXISTS agent_platform_migrations (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runtime_runs (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_code TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runtime_events (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runtime_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS runtime_events_run_id_created_at_idx
  ON runtime_events (run_id, created_at);
