// Baú de Minério — armazena estoques de minério do jogador
const KEY = 'sc_ore_vault_v1';

export function loadVault() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { entries: [] }; }
  catch { return { entries: [] }; }
}
export function saveVault(v) { localStorage.setItem(KEY, JSON.stringify(v)); }

// Adicionar ou atualizar entrada
export function addOreEntry(entry) {
  const v = loadVault();
  const id = entry.id || Date.now();
  const idx = v.entries.findIndex(e => e.id === id);
  const data = { ...entry, id, updated_at: new Date().toISOString() };
  if (idx >= 0) v.entries[idx] = data;
  else { data.created_at = new Date().toISOString(); v.entries.unshift(data); }
  saveVault(v);
  return v;
}

// Remover entrada
export function removeOreEntry(id) {
  const v = loadVault();
  v.entries = v.entries.filter(e => e.id !== id);
  saveVault(v);
  return v;
}

// Deduzir quantidade de uma entrada (ao usar no craft)
export function deductOreEntry(id, amount) {
  const v = loadVault();
  v.entries = v.entries.map(e => {
    if (e.id !== id) return e;
    const remaining = Math.max(0, (e.quantity || 0) - amount);
    return { ...e, quantity: remaining, updated_at: new Date().toISOString() };
  }).filter(e => e.quantity > 0); // remove zerados
  saveVault(v);
  return v;
}

// Buscar entradas que batem com um nome de material (case-insensitive, parcial)
export function findVaultMatches(materialName) {
  const v = loadVault();
  const q = materialName.toLowerCase().trim();
  return v.entries.filter(e =>
    e.ore_name && e.ore_name.toLowerCase().includes(q) && (e.quantity || 0) > 0
  );
}

// Total disponível de um material no baú
export function vaultTotalFor(materialName) {
  return findVaultMatches(materialName).reduce((a, e) => a + (e.quantity || 0), 0);
}
