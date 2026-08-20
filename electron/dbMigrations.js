'use strict';

const CURRENT_SCHEMA_VERSION = 1;

function tableExists(db, tableName) {
  const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName]);
  return Boolean(result[0]?.values?.length);
}

function ensureMigrationsTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function hasMigration(db, version) {
  const result = db.exec('SELECT 1 FROM schema_migrations WHERE version=? LIMIT 1', [version]);
  return Boolean(result[0]?.values?.length);
}

function applySchemaMigrations(db) {
  ensureMigrationsTable(db);

  // A versão 1 representa o schema legado já criado pelo initDatabase.
  // Ela é registrada sem alterar dados, permitindo que versões futuras usem
  // migrações incrementais em vez de repetir ALTER TABLE defensivos.
  if (!hasMigration(db, 1)) {
    db.run('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [
      1,
      'baseline-schema-with-legacy-migrations',
    ]);
  }

  return {
    currentVersion: CURRENT_SCHEMA_VERSION,
    tableReady: tableExists(db, 'schema_migrations'),
  };
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  applySchemaMigrations,
};
