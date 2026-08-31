CREATE TABLE IF NOT EXISTS ota_checks (
  id INTEGER PRIMARY KEY,
  model_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  current_version TEXT NOT NULL,
  latest_version TEXT,
  package_count INTEGER NOT NULL,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_ota_checks_model_checked
ON ota_checks(model_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS ota_packages (
  package_key TEXT PRIMARY KEY NOT NULL,
  model_id TEXT NOT NULL,
  version TEXT,
  base_version TEXT,
  type TEXT,
  checksum TEXT,
  file_size INTEGER,
  file_name TEXT,
  mirrors_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ota_packages_model_seen
ON ota_packages(model_id, first_seen_at DESC);

CREATE TABLE IF NOT EXISTS ota_monitor_credentials (
  model_id TEXT PRIMARY KEY NOT NULL,
  credential_iv TEXT NOT NULL,
  credential_ciphertext TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
