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
