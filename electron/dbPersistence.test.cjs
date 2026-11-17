'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { fileSignature, saveDatabaseSnapshot } = require('./dbPersistence.cjs');

function makeDatabase(content) {
  return { export: () => Buffer.from(content, 'utf8') };
}

function makeTempDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'companheiro-db-'));
  const databasePath = path.join(directory, 'dados', 'companheiro_emoto.db');
  return { directory, databasePath };
}

test('escrita atômica cria o banco e não deixa arquivo temporário', () => {
  const { directory, databasePath } = makeTempDatabase();
  try {
    const result = saveDatabaseSnapshot({ database: makeDatabase('dados-iniciais'), databasePath });
    assert.equal(result.saved, true);
    assert.equal(fs.readFileSync(databasePath, 'utf8'), 'dados-iniciais');
    assert.equal(fs.readdirSync(path.dirname(databasePath)).filter(name => name.endsWith('.tmp')).length, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('não permite que snapshot antigo sobrescreva banco alterado por outro processo', () => {
  const { directory, databasePath } = makeTempDatabase();
  try {
    saveDatabaseSnapshot({ database: makeDatabase('versao-a'), databasePath });
    const snapshotA = fileSignature(databasePath);

    const processB = saveDatabaseSnapshot({
      database: makeDatabase('versao-b'),
      databasePath,
      loadedSignature: snapshotA,
    });
    assert.equal(processB.saved, true);
    assert.equal(fs.readFileSync(databasePath, 'utf8'), 'versao-b');

    const staleProcessA = saveDatabaseSnapshot({
      database: makeDatabase('versao-a-antiga'),
      databasePath,
      loadedSignature: snapshotA,
    });
    assert.equal(staleProcessA.saved, false);
    assert.equal(staleProcessA.reason, 'database-changed-externally');
    assert.equal(fs.readFileSync(databasePath, 'utf8'), 'versao-b');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('bloqueia a gravação quando o banco carregado foi removido externamente', () => {
  const { directory, databasePath } = makeTempDatabase();
  try {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    fs.writeFileSync(databasePath, 'banco-original');
    const loadedSignature = fileSignature(databasePath);
    fs.unlinkSync(databasePath);

    const result = saveDatabaseSnapshot({
      database: makeDatabase('snapshot-antigo'),
      databasePath,
      loadedSignature,
    });
    assert.equal(result.saved, false);
    assert.equal(result.reason, 'database-changed-externally');
    assert.equal(fs.existsSync(databasePath), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('não grava o snapshot antigo enquanto o reinício após restauração estiver pendente', () => {
  const { directory, databasePath } = makeTempDatabase();
  try {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    fs.writeFileSync(databasePath, 'banco-restaurado');
    const result = saveDatabaseSnapshot({
      database: makeDatabase('banco-antigo-em-memoria'),
      databasePath,
      loadedSignature: fileSignature(databasePath),
      restartRequired: true,
    });
    assert.equal(result.saved, false);
    assert.equal(result.reason, 'database-restart-required');
    assert.equal(fs.readFileSync(databasePath, 'utf8'), 'banco-restaurado');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
