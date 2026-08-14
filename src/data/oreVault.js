// Baú de Minério — armazena estoques de minério do jogador
import {
  normalizeCargoUnit,
  isCargoUnit,
  areCargoUnitsCompatible,
  toCargoBase,
  fromCargoBase,
  roundCargo,
  cargoEquivalentTotal,
} from './cargoUnits';

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
  const unit = normalizeCargoUnit(entry.unit || 'un');
  const data = {
    ...entry,
    id,
    unit,
    quantity: isCargoUnit(unit) ? roundCargo(entry.quantity) : Number(entry.quantity) || 0,
    updated_at: new Date().toISOString(),
  };
  if (idx >= 0) v.entries[idx] = data;
  else { data.created_at = new Date().toISOString(); v.entries.unshift(data); }
  saveVault(v);
  return v;
}

// Transferir parte ou toda uma entrada para outro local, mesclando estoque equivalente.
export function transferOreEntry(id, destination, amount) {
  const v = loadVault();
  const source = v.entries.find(e => Number(e.id) === Number(id));
  const qty = Number(amount);
  const location = String(destination || '').trim();
  if (!source) return { success:false, message:'Entrada do Baú não encontrada.' };
  if (!location) return { success:false, message:'Destino obrigatório.' };
  if (!Number.isFinite(qty) || qty <= 0 || qty > (Number(source.quantity) || 0)) {
    return { success:false, message:'Quantidade inválida para transferência.' };
  }

  const sourceUnit = normalizeCargoUnit(source.unit || 'un');
  const sourceRemaining = (Number(source.quantity) || 0) - qty;
  const isEquivalent = entry =>
    Number(entry.id) !== Number(source.id) &&
    String(entry.ore_name || '').trim().toLowerCase() === String(source.ore_name || '').trim().toLowerCase() &&
    String(entry.quality || '').trim().toLowerCase() === String(source.quality || '').trim().toLowerCase() &&
    (areCargoUnitsCompatible(entry.unit, sourceUnit)
      ? true
      : normalizeCargoUnit(entry.unit || 'un') === sourceUnit) &&
    Boolean(entry.refined) === Boolean(source.refined) &&
    String(entry.location || '').trim().toLowerCase() === location.toLowerCase();
  const target = v.entries.find(isEquivalent);
  const now = new Date().toISOString();

  if (target) {
    if (areCargoUnitsCompatible(target.unit, sourceUnit)) {
      const targetUnit = normalizeCargoUnit(target.unit || sourceUnit);
      const totalBase = toCargoBase(target.quantity, targetUnit) + toCargoBase(qty, sourceUnit);
      target.quantity = fromCargoBase(totalBase, targetUnit);
      target.unit = targetUnit;
    } else {
      target.quantity = (Number(target.quantity) || 0) + qty;
      target.unit = sourceUnit;
    }
    target.updated_at = now;
    if (sourceRemaining <= 0) v.entries = v.entries.filter(e => Number(e.id) !== Number(source.id));
    else { source.quantity = sourceRemaining; source.unit = sourceUnit; }
  } else if (sourceRemaining <= 0) {
    source.location = location;
    source.unit = sourceUnit;
    source.updated_at = now;
  } else {
    source.quantity = sourceRemaining;
    source.unit = sourceUnit;
    v.entries.unshift({ ...source, id:Date.now()+Math.floor(Math.random()*1000), quantity:qty, unit:sourceUnit, location, created_at:now, updated_at:now });
  }

  saveVault(v);
  return { success:true, vault:v };
}

// Remover entrada
export function removeOreEntry(id) {
  const v = loadVault();
  v.entries = v.entries.filter(e => e.id !== id);
  saveVault(v);
  return v;
}

// Converte a qualidade cadastrada no baú para um valor comparável.
// Qualidades textuais como "Grade A" não são consideradas suficientes para uma
// exigência numérica, pois não há como provar que atingem Q≥800.
export function numericQuality(quality) {
  if (typeof quality === 'number' && Number.isFinite(quality)) return quality;
  const match = String(quality || '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function qualityMeetsMinimum(quality, qualityMin = 0) {
  const minimum = Number(qualityMin) || 0;
  if (minimum <= 0) return true;
  const value = numericQuality(quality);
  return value !== null && value >= minimum;
}

// Deduzir quantidade de uma entrada (ao usar no craft)
export function deductOreEntry(id, amount) {
  return deductOreEntries([{ id, amount }]);
}

// Deduz várias entradas em uma única leitura/escrita do baú.
export function deductOreEntries(usages = []) {
  const deductions = new Map();
  for (const usage of usages) {
    const id = Number(usage.id);
    const amount = Number(usage.amount);
    if (Number.isFinite(id) && Number.isFinite(amount) && amount > 0) {
      deductions.set(id, (deductions.get(id) || 0) + amount);
    }
  }
  const v = loadVault();
  v.entries = v.entries.map(e => {
    const amount = deductions.get(Number(e.id)) || 0;
    if (!amount) return e;
    const remaining = Math.max(0, (Number(e.quantity) || 0) - amount);
    return { ...e, quantity: remaining, updated_at: new Date().toISOString() };
  }).filter(e => (Number(e.quantity) || 0) > 0); // remove zerados
  saveVault(v);
  return v;
}

// Buscar entradas que batem com nome e qualidade mínima (case-insensitive, parcial)
export function findVaultMatches(materialName, qualityMin = 0) {
  const v = loadVault();
  const q = String(materialName || '').toLowerCase().trim();
  return v.entries.filter(e =>
    e.ore_name && e.ore_name.toLowerCase().includes(q) &&
    (Number(e.quantity) || 0) > 0 && qualityMeetsMinimum(e.quality, qualityMin)
  );
}

// Total disponível de um material no baú para uma qualidade mínima
export function vaultTotalFor(materialName, qualityMin = 0, preferredUnit = '') {
  const entries = findVaultMatches(materialName, qualityMin);
  return cargoEquivalentTotal(entries, preferredUnit).total;
}
