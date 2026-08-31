import type { OtaStatus } from './types';

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS ota_status (
  id TEXT PRIMARY KEY NOT NULL,
  checked_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  current_version TEXT NOT NULL,
  latest_version TEXT,
  packages_json TEXT NOT NULL,
  error TEXT
)`;

async function ensureSchema(db: D1Database) {
  await db.prepare(CREATE_TABLE).run();
}

export async function writeStatus(db: D1Database, status: OtaStatus) {
  await ensureSchema(db);
  await db
    .prepare(
      `INSERT INTO ota_status (id, checked_at, ok, current_version, latest_version, packages_json, error)
       VALUES ('current', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         checked_at=excluded.checked_at,
         ok=excluded.ok,
         current_version=excluded.current_version,
         latest_version=excluded.latest_version,
         packages_json=excluded.packages_json,
         error=excluded.error`,
    )
    .bind(
      status.checkedAt,
      status.ok ? 1 : 0,
      status.currentVersion,
      status.latestVersion,
      JSON.stringify(status.packages),
      status.error,
    )
    .run();
}

export async function readStatus(db: D1Database): Promise<OtaStatus | null> {
  await ensureSchema(db);
  const row = await db
    .prepare(
      'SELECT checked_at, ok, current_version, latest_version, packages_json, error FROM ota_status WHERE id = ?',
    )
    .bind('current')
    .first<Record<string, unknown>>();
  if (!row) return null;
  return {
    checkedAt: String(row.checked_at),
    ok: Number(row.ok) === 1,
    currentVersion: String(row.current_version),
    latestVersion: row.latest_version ? String(row.latest_version) : null,
    packages: JSON.parse(String(row.packages_json)),
    error: row.error ? String(row.error) : null,
  };
}
