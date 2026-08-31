import type { CommunityModel, HistoricalPackage, ModelPage, MonitorTarget, OtaPackage, OtaPublicConfig, OtaStatus, VersionProbe, VersionProbeResult } from './types';

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

const CREATE_CHECKS_TABLE = `CREATE TABLE IF NOT EXISTS ota_checks (
  id INTEGER PRIMARY KEY,
  model_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  current_version TEXT NOT NULL,
  latest_version TEXT,
  package_count INTEGER NOT NULL,
  error TEXT
)`;

const CREATE_PACKAGES_TABLE = `CREATE TABLE IF NOT EXISTS ota_packages (
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
)`;

const CREATE_MONITOR_CREDENTIALS_TABLE = `CREATE TABLE IF NOT EXISTS ota_monitor_credentials (
  model_id TEXT PRIMARY KEY NOT NULL,
  credential_iv TEXT NOT NULL,
  credential_ciphertext TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const CREATE_VERSION_PROBES_TABLE = `CREATE TABLE IF NOT EXISTS ota_version_probes (
  probe_key TEXT PRIMARY KEY NOT NULL,
  model_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  target_version TEXT NOT NULL,
  actual_target_version TEXT,
  checked_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  package_count INTEGER NOT NULL,
  error TEXT
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

async function ensureHistorySchema(db: D1Database) {
  await db.prepare(CREATE_CHECKS_TABLE).run();
  await db.prepare(CREATE_PACKAGES_TABLE).run();
  await db.prepare(CREATE_MONITOR_CREDENTIALS_TABLE).run();
  await db.prepare(CREATE_VERSION_PROBES_TABLE).run();
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

function packageKey(model: string, pkg: OtaPackage) {
  return [model, pkg.version ?? '', pkg.type ?? '', pkg.baseVersion ?? '', pkg.md5 ?? '', pkg.fileName ?? '']
    .join('::')
    .toLowerCase();
}

export async function archiveOtaObservation(db: D1Database, config: OtaPublicConfig, status: OtaStatus) {
  await ensureHistorySchema(db);
  const id = modelId(config);
  await db.prepare(
    `INSERT INTO ota_checks (model_id, checked_at, ok, current_version, latest_version, package_count, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, status.checkedAt, status.ok ? 1 : 0, status.currentVersion, status.latestVersion, status.packages.length, status.error).run();

  for (const pkg of status.packages) {
    await db.prepare(
      `INSERT INTO ota_packages (
         package_key, model_id, version, base_version, type, checksum, file_size, file_name, mirrors_json, first_seen_at, last_seen_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(package_key) DO UPDATE SET mirrors_json=excluded.mirrors_json, last_seen_at=excluded.last_seen_at`,
    ).bind(
      packageKey(id, pkg), id, pkg.version, pkg.baseVersion, pkg.type, pkg.md5, pkg.fileSize,
      pkg.fileName, JSON.stringify(pkg.mirrors), status.checkedAt, status.checkedAt,
    ).run();
  }
}

export async function listHistoricalPackages(db: D1Database, config: OtaPublicConfig): Promise<HistoricalPackage[]> {
  await ensureHistorySchema(db);
  const result = await db.prepare(
    `SELECT model_id, version, base_version, type, checksum, file_size, file_name, mirrors_json, first_seen_at, last_seen_at
     FROM ota_packages WHERE model_id = ? ORDER BY first_seen_at DESC`,
  ).bind(modelId(config)).all<Record<string, unknown>>();
  return (result.results ?? []).map((row) => ({
    modelId: String(row.model_id),
    version: optionalString(row.version),
    baseVersion: optionalString(row.base_version),
    type: optionalString(row.type),
    md5: optionalString(row.checksum),
    fileSize: row.file_size == null ? null : Number(row.file_size),
    fileName: optionalString(row.file_name),
    mirrors: JSON.parse(String(row.mirrors_json)),
    firstSeenAt: String(row.first_seen_at),
    lastSeenAt: String(row.last_seen_at),
  }));
}

export async function listHistoricalPackagesByModelId(db: D1Database, id: string): Promise<HistoricalPackage[]> {
  await ensureHistorySchema(db);
  const result = await db.prepare(
    `SELECT model_id, version, base_version, type, checksum, file_size, file_name, mirrors_json, first_seen_at, last_seen_at
     FROM ota_packages WHERE model_id = ? ORDER BY first_seen_at DESC`,
  ).bind(id).all<Record<string, unknown>>();
  return (result.results ?? []).map((row) => ({
    modelId: String(row.model_id),
    version: optionalString(row.version),
    baseVersion: optionalString(row.base_version),
    type: optionalString(row.type),
    md5: optionalString(row.checksum),
    fileSize: row.file_size == null ? null : Number(row.file_size),
    fileName: optionalString(row.file_name),
    mirrors: JSON.parse(String(row.mirrors_json)),
    firstSeenAt: String(row.first_seen_at),
    lastSeenAt: String(row.last_seen_at),
  }));
}

export async function getCommunityModel(db: D1Database, id: string): Promise<CommunityModel | null> {
  await ensureCommunitySchema(db);
  const row = await db.prepare(
    `SELECT id, display_name, product, device, module, lang, minimum_known_version,
            latest_version, packages_json, verified_at
     FROM ota_models WHERE id = ?`,
  ).bind(id).first<Record<string, unknown>>();
  if (!row) return null;
  return {
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
  };
}

export async function updateCommunityModelMetadata(
  db: D1Database,
  id: string,
  values: {
    displayName: string;
    currentVersion: string;
    latestVersion: string | null;
    lang: string;
  },
) {
  await ensureCommunitySchema(db);
  await db.prepare(
    `UPDATE ota_models
     SET display_name = ?, minimum_known_version = ?, latest_version = ?, lang = ?
     WHERE id = ?`,
  ).bind(values.displayName, values.currentVersion, values.latestVersion, values.lang, id).run();
}

export async function listCommunityModelsPage(
  db: D1Database,
  page: number,
  pageSize: number,
  query = '',
): Promise<ModelPage> {
  await ensureCommunitySchema(db);
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const normalized = query.trim().toLowerCase();
  const filter = normalized ? `%${normalized}%` : '%';
  const countRow = await db.prepare(
    `SELECT COUNT(*) AS total FROM ota_models
     WHERE lower(display_name) LIKE ? OR lower(product) LIKE ? OR lower(device) LIKE ?`,
  ).bind(filter, filter, filter).first<Record<string, unknown>>();
  const total = Number(countRow?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const actualPage = Math.min(safePage, totalPages);
  const offset = (actualPage - 1) * safePageSize;
  const result = await db.prepare(
    `SELECT id, display_name, product, device, module, lang, minimum_known_version,
            latest_version, packages_json, verified_at
     FROM ota_models
     WHERE lower(display_name) LIKE ? OR lower(product) LIKE ? OR lower(device) LIKE ?
     ORDER BY display_name COLLATE NOCASE ASC
     LIMIT ? OFFSET ?`,
  ).bind(filter, filter, filter, safePageSize, offset).all<Record<string, unknown>>();
  const items = (result.results ?? []).map((row) => ({
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
  return { items, total, page: actualPage, pageSize: safePageSize, totalPages };
}

function probeKey(model: string, sourceVersion: string, targetVersion: string) {
  return `${model}::${sourceVersion}::${targetVersion}`.toLowerCase();
}

function compareVersionStrings(left: string, right: string) {
  const a = left.match(/\d+/g)?.map(Number) ?? [];
  const b = right.match(/\d+/g)?.map(Number) ?? [];
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return left.localeCompare(right);
}

export async function listPendingVersionProbes(db: D1Database, model: OtaPublicConfig): Promise<VersionProbe[]> {
  await ensureHistorySchema(db);
  const id = modelId(model);
  const rows = await db.prepare(
    `SELECT DISTINCT version FROM ota_packages WHERE model_id = ? AND version IS NOT NULL AND version <> ''
     UNION SELECT DISTINCT base_version AS version FROM ota_packages WHERE model_id = ? AND base_version IS NOT NULL AND base_version <> ''
     UNION SELECT ? AS version`,
  ).bind(id, id, model.currentVersion).all<Record<string, unknown>>();
  const knownVersions = [...new Set((rows.results ?? []).map((row) => optionalString(row.version)).filter((value): value is string => !!value))];
  const target = model.currentVersion;
  const latest = await db.prepare('SELECT latest_version FROM ota_models WHERE id = ?').bind(id).first<Record<string, unknown>>();
  const high = optionalString(latest?.latest_version) ?? target;
  const probes: VersionProbe[] = [];
  for (const source of knownVersions) {
    if (compareVersionStrings(source, high) >= 0) continue;
    const exists = await db.prepare('SELECT 1 AS found FROM ota_version_probes WHERE probe_key = ?')
      .bind(probeKey(id, source, high)).first<Record<string, unknown>>();
    if (!exists) probes.push({ modelId: id, sourceVersion: source, targetVersion: high });
  }
  return probes;
}

export async function recordVersionProbe(
  db: D1Database,
  probe: VersionProbe,
  status: OtaStatus,
) {
  await ensureHistorySchema(db);
  await db.prepare(
    `INSERT OR REPLACE INTO ota_version_probes (
       probe_key, model_id, source_version, target_version, actual_target_version,
       checked_at, ok, package_count, error
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    probeKey(probe.modelId, probe.sourceVersion, probe.targetVersion),
    probe.modelId,
    probe.sourceVersion,
    probe.targetVersion,
    status.latestVersion,
    status.checkedAt,
    status.ok ? 1 : 0,
    status.packages.length,
    status.error,
  ).run();
}

export async function listVersionProbeResults(db: D1Database, id: string): Promise<VersionProbeResult[]> {
  await ensureHistorySchema(db);
  const result = await db.prepare(
    `SELECT model_id, source_version, target_version, actual_target_version, checked_at, ok, package_count, error
     FROM ota_version_probes WHERE model_id = ? ORDER BY checked_at DESC`,
  ).bind(id).all<Record<string, unknown>>();
  return (result.results ?? []).map((row) => ({
    modelId: String(row.model_id),
    sourceVersion: String(row.source_version),
    targetVersion: String(row.target_version),
    actualTargetVersion: optionalString(row.actual_target_version),
    checkedAt: String(row.checked_at),
    ok: Number(row.ok) === 1,
    packageCount: Number(row.package_count),
    error: optionalString(row.error),
  }));
}

export async function saveMonitorCredentials(
  db: D1Database,
  config: OtaPublicConfig,
  credentialIv: string,
  credentialCiphertext: string,
) {
  await ensureCommunitySchema(db);
  await ensureHistorySchema(db);
  await db.prepare(
    `INSERT INTO ota_monitor_credentials (model_id, credential_iv, credential_ciphertext, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(model_id) DO UPDATE SET
       credential_iv=excluded.credential_iv,
       credential_ciphertext=excluded.credential_ciphertext,
       updated_at=excluded.updated_at`,
  ).bind(modelId(config), credentialIv, credentialCiphertext, new Date().toISOString()).run();
}

export async function listMonitorTargets(db: D1Database): Promise<MonitorTarget[]> {
  await ensureCommunitySchema(db);
  await ensureHistorySchema(db);
  const result = await db.prepare(
    `SELECT m.id, m.display_name, m.product, m.device, m.module, m.lang,
            COALESCE(NULLIF(m.latest_version, ''), m.minimum_known_version) AS monitor_version,
            c.credential_iv, c.credential_ciphertext
     FROM ota_models m
     INNER JOIN ota_monitor_credentials c ON c.model_id = m.id
     ORDER BY m.verified_at ASC`,
  ).all<Record<string, unknown>>();
  return (result.results ?? []).map((row) => ({
    modelId: String(row.id),
    displayName: String(row.display_name),
    product: String(row.product),
    device: String(row.device),
    module: String(row.module),
    lang: String(row.lang),
    currentVersion: String(row.monitor_version),
    credentialIv: String(row.credential_iv),
    credentialCiphertext: String(row.credential_ciphertext),
  }));
}

export async function updateCommunityModelStatus(db: D1Database, config: OtaPublicConfig, status: OtaStatus) {
  await ensureCommunitySchema(db);
  await db.prepare(
    `UPDATE ota_models SET latest_version = ?, packages_json = ?, verified_at = ? WHERE id = ?`,
  ).bind(status.latestVersion, JSON.stringify(status.packages), status.checkedAt, modelId(config)).run();
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
