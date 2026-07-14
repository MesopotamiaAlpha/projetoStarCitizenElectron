// ── Banco local de minérios/commodities da UEX ────────────────────────────────
// Sincronizado manualmente na tela "UEX API (Live)" → aba Mineração.
// Usado para enriquecer/atualizar os preços e a lista de minérios exibidos
// na "Guia de Mineração".

const KEY = 'sc_uex_mining_db_v1';

export function loadUexMiningDB() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { minerals: [], updatedAt: null }; }
  catch { return { minerals: [], updatedAt: null }; }
}

export function saveUexMiningDB(minerals) {
  const db = { minerals, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

export function getUexMiningStats() {
  const db = loadUexMiningDB();
  return { updatedAt: db.updatedAt, count: db.minerals?.length || 0 };
}
