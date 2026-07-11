-- Ingest plane schema (idempotent; applied on every deploy).
CREATE TABLE IF NOT EXISTS submissions (
  run_id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  submitter TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  gate_warnings TEXT NOT NULL DEFAULT '[]',
  report_json TEXT NOT NULL,
  model_count INTEGER NOT NULL DEFAULT 0,
  result_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_hash ON submissions(content_hash);

-- Field-telemetry samples (Phase 3): anonymous, content-free by
-- construction (strict allowlist at the endpoint). install_id is a random
-- per-install capability: knowing it is ownership (rotation/deletion).
CREATE TABLE IF NOT EXISTS telemetry_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  install_id TEXT NOT NULL,
  skulk_version TEXT,
  kind TEXT NOT NULL, -- generation | node-death | runner-restart
  at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  model_id TEXT,
  engine TEXT,
  quantization TEXT,
  hardware TEXT, -- JSON array of canonical hardware classes
  node_count INTEGER,
  ttft_s REAL,
  decode_tps REAL,
  prompt_tokens INTEGER,
  output_tokens INTEGER,
  mtp_accept_ratio REAL,
  error_class TEXT
);
CREATE INDEX IF NOT EXISTS idx_tel_install ON telemetry_samples(install_id, received_at);
CREATE INDEX IF NOT EXISTS idx_tel_model ON telemetry_samples(model_id, kind, at);
