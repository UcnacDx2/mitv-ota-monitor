import { runAllChecks, type MonitorRunResult } from './monitor';
import type { RuntimeEnv } from './types';

const JOB_ID = 'daily-monitor';
const DEFAULT_MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;

const CREATE_JOB_STATE_TABLE = `CREATE TABLE IF NOT EXISTS ota_job_state (
  id TEXT PRIMARY KEY NOT NULL,
  last_started_at TEXT NOT NULL,
  last_finished_at TEXT,
  last_ok INTEGER,
  last_error TEXT
)`;

export type ScheduledCheckState = {
  lastStartedAt: string;
  lastFinishedAt: string | null;
  ok: boolean | null;
  error: string | null;
};

export type ScheduledCheckRun = {
  ran: boolean;
  state: ScheduledCheckState;
  result: MonitorRunResult | null;
};

async function ensureJobStateSchema(db: D1Database) {
  await db.prepare(CREATE_JOB_STATE_TABLE).run();
}

function nullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function parseState(row: Record<string, unknown>): ScheduledCheckState {
  if (typeof row.last_started_at !== 'string') {
    throw new Error('Invalid scheduled check state');
  }

  return {
    lastStartedAt: row.last_started_at,
    lastFinishedAt: nullableString(row.last_finished_at),
    ok: row.last_ok == null ? null : Number(row.last_ok) === 1,
    error: nullableString(row.last_error),
  };
}

export async function readScheduledCheckState(
  db: D1Database,
): Promise<ScheduledCheckState | null> {
  await ensureJobStateSchema(db);
  const row = await db
    .prepare(
      'SELECT last_started_at, last_finished_at, last_ok, last_error FROM ota_job_state WHERE id = ?',
    )
    .bind(JOB_ID)
    .first<Record<string, unknown>>();
  return row ? parseState(row) : null;
}

async function claimScheduledCheck(db: D1Database, minIntervalMs: number) {
  await ensureJobStateSchema(db);
  const startedAt = new Date().toISOString();
  const cutoff = new Date(Date.now() - minIntervalMs).toISOString();
  const result = await db
    .prepare(
      `INSERT INTO ota_job_state (id, last_started_at, last_finished_at, last_ok, last_error)
       VALUES (?, ?, NULL, NULL, NULL)
       ON CONFLICT(id) DO UPDATE SET
         last_started_at = excluded.last_started_at,
         last_finished_at = NULL,
         last_ok = NULL,
         last_error = NULL
       WHERE ota_job_state.last_started_at <= ?`,
    )
    .bind(JOB_ID, startedAt, cutoff)
    .run();

  return {
    claimed: Number(result.meta.changes ?? 0) > 0,
    startedAt,
  };
}

async function finishScheduledCheck(
  db: D1Database,
  startedAt: string,
  ok: boolean,
  error: string | null,
) {
  const finishedAt = new Date().toISOString();
  await db
    .prepare(
      `UPDATE ota_job_state
       SET last_finished_at = ?, last_ok = ?, last_error = ?
       WHERE id = ? AND last_started_at = ?`,
    )
    .bind(finishedAt, ok ? 1 : 0, error, JOB_ID, startedAt)
    .run();

  return finishedAt;
}

export async function runScheduledChecks(
  env: RuntimeEnv,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
): Promise<ScheduledCheckRun> {
  const claim = await claimScheduledCheck(env.DB, minIntervalMs);
  if (!claim.claimed) {
    const state = await readScheduledCheckState(env.DB);
    if (!state) throw new Error('Scheduled check state disappeared after claim');
    return { ran: false, state, result: null };
  }

  try {
    const result = await runAllChecks(env);
    const error = result.failed
      ? [result.failed, '/', result.checked, ' OTA checks failed'].join('')
      : null;
    const finishedAt = await finishScheduledCheck(
      env.DB,
      claim.startedAt,
      error == null,
      error,
    );
    return {
      ran: true,
      result,
      state: {
        lastStartedAt: claim.startedAt,
        lastFinishedAt: finishedAt,
        ok: error == null,
        error,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'scheduled check failed';
    const finishedAt = await finishScheduledCheck(env.DB, claim.startedAt, false, message);
    return {
      ran: true,
      result: null,
      state: {
        lastStartedAt: claim.startedAt,
        lastFinishedAt: finishedAt,
        ok: false,
        error: message,
      },
    };
  }
}
