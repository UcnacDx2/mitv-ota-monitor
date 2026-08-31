import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const otaStatus = sqliteTable('ota_status', {
  id: text('id').primaryKey(),
  checkedAt: text('checked_at').notNull(),
  ok: integer('ok').notNull(),
  currentVersion: text('current_version').notNull(),
  latestVersion: text('latest_version'),
  packagesJson: text('packages_json').notNull(),
  error: text('error'),
});

export const otaModels = sqliteTable('ota_models', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  product: text('product').notNull(),
  device: text('device').notNull(),
  module: text('module').notNull(),
  lang: text('lang').notNull(),
  minimumKnownVersion: text('minimum_known_version').notNull(),
  latestVersion: text('latest_version'),
  packagesJson: text('packages_json').notNull(),
  verifiedAt: text('verified_at').notNull(),
});

export const contributionRateLimit = sqliteTable('contribution_rate_limit', {
  fingerprint: text('fingerprint').primaryKey(),
  lastSubmittedAt: text('last_submitted_at').notNull(),
});
