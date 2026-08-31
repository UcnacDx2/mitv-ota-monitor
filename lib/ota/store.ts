import type { CommunityModel, OtaPublicConfig, OtaStatus } from './types';

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS ota_status (
  id TEXT PRIMARY KEY NOT NULL,
  checked_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  current_version TEXT NOT NULL,
  latest_version TEXT,
  packages_json TEXT NOT NULL,
  error TEXT
)`;

const CREATE_MODELS_TABLE = `CREATE TABLE IF NOT EXISTS ota_models (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  product TEXT NOT NULL,
  device TEXT NOT NULL,
  module TEXT NOT NULL,
  lang TEXT NOT NULL,
  minimum_known_version TEXT NOT NULL,
  latest_version TEXT,
  packages_json TEXT NOT NULL,
  verified_at TEXT NOT NULL
)`;

const CREATE_RATE_LIMIT_TABLE = `CREATE TABLE IF NOT EXISTS contribution_rate_limit (
  fingerprint TEXT PRIMARY KEY NOT NULL,
  last_submitted_at TEXT NOT NULL
)`;

async function ensureSchema(db: D1Database) {
  await db.prepare(CREATE_TABLE).run();
}

async function ensureCommunitySchema(db: D1Database) {
  await db.batch([
    db.prepare(CREATE_MODELS_TABLE),
    db.prepare(CREATE_RATE_LIMIT_TABLE),
  ]);
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value ? value : null;
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
    latestVersion: optionalString(row.latest_version),
    packages: JSON.parse(String(row.packages_json)),
    error: optionalString(row.error),
  };
}

function modelId(config: OtaPublicConfig) {
  return `${config.product}::${config.device}::${config.module}`.toLowerCase();
}

export async function upsertCommunityModel(
  db: D1Database,
  config: OtaPublicConfig,
  status: OtaStatus,
) {
  await ensureCommunitySchema(db);
  const id = modelId(config);
  await db
    .prepare(
      `INSERT INTO ota_models (
         id, display_name, product, device, module, lang, minimum_known_version,
         latest_version, packages_json, verified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         display_name=excluded.display_name,
         lang=excluded.lang,
         minimum_known_version=excluded.minimum_known_version,
         latest_version=excluded.latest_version,
         packages_json=excluded.packages_json,
         verified_at=excluded.verified_at`,
    )
    .bind(
      id,
      config.displayName,
      config.product,
      config.device,
      config.module,
      config.lang,
      config.currentVersion,
      status.latestVersion,
      JSON.stringify(status.packages),
      status.checkedAt,
    )
    .run();
}

export async function listCommunityModels(db: D1Database): Promise<CommunityModel[]> {
  await ensureCommunitySchema(db);
  const result = await db
    .prepare(
      `SELECT id, display_name, product, device, module, lang, minimum_known_version,
              latest_version, packages_json, verified_at
       FROM ota_models
       ORDER BY verified_at DESC`,
    )
    .all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    id: String(row.id),
    displayName: String(row.display_name),
    product: String(row.product),
    device: String(row.device),
    module: String(row.module),
    lang: String(row.lang),
    currentVersion: String(row.minimum_known_version),
    latestVersion: optionalString(row.latest_version),
    verifiedAt: String(row.verified_at),
    packages: JSON.parse(String(row.packages_json)),
  }));
}

export async function claimContributionWindow(
  db: D1Database,
  fingerprint: string,
  minimumIntervalMs = 60_000,
) {
  await ensureCommunitySchema(db);
  const row = await db
    .prepare('SELECT last_submitted_at FROM contribution_rate_limit WHERE fingerprint = ?')
    .bind(fingerprint)
    .first<Record<string, unknown>>();

  const now = new Date();
  if (row?.last_submitted_at) {
    const previousValue = optionalString(row.last_submitted_at);
    const previous = previousValue ? new Date(previousValue) : new Date(Number.NaN);
    if (Number.isFinite(previous.getTime()) && now.getTime() - previous.getTime() < minimumIntervalMs) {
      return false;
    }
  }

  await db
    .prepare(
      `INSERT INTO contribution_rate_limit (fingerprint, last_submitted_at)
       VALUES (?, ?)
       ON CONFLICT(fingerprint) DO UPDATE SET last_submitted_at=excluded.last_submitted_at`,
    )
    .bind(fingerprint, now.toISOString())
    .run();
  return true;
}
