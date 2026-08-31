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
