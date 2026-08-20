'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { applySchemaMigrations, CURRENT_SCHEMA_VERSION } = require('./dbMigrations');

function createFakeDb() {
  const tables = new Set();
  const migrations = new Map();
  return {
    exec(sql, params = []) {
      if (sql.includes("sqlite_master") && params[0] === 'schema_migrations') {
        return tables.has('schema_migrations') ? [{ columns: ['name'], values: [['schema_migrations']] }] : [];
      }
      if (sql.includes('FROM schema_migrations')) {
        return migrations.has(Number(params[0])) ? [{ columns: ['1'], values: [[1]] }] : [];
      }
      return [];
    },
    run(sql, params = []) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) tables.add('schema_migrations');
      if (sql.includes('INSERT INTO schema_migrations')) migrations.set(Number(params[0]), String(params[1]));
    },
    migrationCount() { return migrations.size; },
  };
}

test('registers the baseline schema exactly once', () => {
  const db = createFakeDb();
  const first = applySchemaMigrations(db);
  const second = applySchemaMigrations(db);

  assert.equal(CURRENT_SCHEMA_VERSION, 1);
  assert.deepEqual(first, { currentVersion: 1, tableReady: true });
  assert.deepEqual(second, { currentVersion: 1, tableReady: true });
  assert.equal(db.migrationCount(), 1);
});
