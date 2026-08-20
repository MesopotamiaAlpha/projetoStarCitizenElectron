// Baú de Minério — armazena estoques de minério do jogador
import {
  normalizeCargoUnit,
  isCargoUnit,
  areCargoUnitsCompatible,
  toCargoBase,
  fromCargoBase,
  roundCargo,
  normalizeCargoQuantity,
  cargoEquivalentTotal,
} from './cargoUnits';
import { readJson, writeJson, dispatchStorageEvent } from '../utils/storage';

const KEY = 'sc_ore_vault_v1';
const PREFERENCES_KEY = 'sc_ore_vault_preferences_v1';
export const ORE_VAULT_PREFERENCES_UPDATED_EVENT = 'sc_ore_vault_preferences_updated';

const EMPTY_VAULT = { entries: [] };

// Preferência exclusiva do Baú de Minério. Não reutiliza a configuração do Inventário.
export function loadOreVaultPreferences() {
  const value = readJson(PREFERENCES_KEY, { defaultDestination: null });
  return value && typeof value === 'object'
    ? { defaultDestination: value.defaultDestination || null }
    : { defaultDestination: null };
}

export function saveOreVaultDefaultDestination(destination) {
  const next = { defaultDestination: destination || null };
  const saved = writeJson(PREFERENCES_KEY, next);
  if (saved) dispatchStorageEvent(ORE_VAULT_PREFERENCES_UPDATED_EVENT, next);
  return saved;
}

export function clearOreVaultDefaultDestination() {
  return saveOreVaultDefaultDestination(null);
}

export function loadVault() {
  const value = readJson(KEY, EMPTY_VAULT);
  if (!value || typeof value !== 'object') return { ...EMPTY_VAULT };
  return { ...value, entries: Array.isArray(value.entries) ? value.entries : [] };
}
export function saveVault(v) {
  const saved = writeJson(KEY, v);
  if (saved) dispatchStorageEvent('sc_ore_vault_updated', { vault: v });
  return saved;
}

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
    quantity: normalizeCargoQuantity(entry.quantity, unit),
    updated_at: new Date().toISOString(),
  };
  if (idx >= 0) v.entries[idx] = data;
  else { data.created_at = new Date().toISOString(); v.entries.unshift(data); }
  saveVault(v);
  return v;
}

// Consome uma quantidade de carga ou unidades de entradas selecionadas.
// A operação é transacional: se o total selecionado não for suficiente, nenhuma
// entrada é alterada.
export function consumeVaultEntries(entryIds = [], quantity, unit = 'un') {
  const ids = new Set((Array.isArray(entryIds) ? entryIds : [entryIds]).map(id => String(id)));
  const requested = normalizeCargoQuantity(quantity, unit);
  const normalizedUnit = normalizeCargoUnit(unit || 'un');
  if (!ids.size || !Number.isFinite(requested) || requested <= 0) {
    return { success:false, message:'Quantidade ou entradas do Baú inválidas.' };
  }
  const current = loadVault();
  const selected = current.entries.filter(entry => ids.has(String(entry.id)) && Number(entry.quantity) > 0);
  if (!selected.length) return { success:false, message:'As entradas vinculadas não existem mais no Baú.' };
  const cargoMode = isCargoUnit(normalizedUnit);
  const selectedCompatible = selected.every(entry => cargoMode
    ? areCargoUnitsCompatible(entry.unit, normalizedUnit)
    : normalizeCargoUnit(entry.unit || 'un') === normalizedUnit);
  if (!selectedCompatible) return { success:false, message:'As unidades do vínculo não são compatíveis com a caixa anunciada.' };
  const requestedBase = cargoMode ? toCargoBase(requested, normalizedUnit) : requested;
  const availableBase = selected.reduce((total, entry) => total + (cargoMode ? toCargoBase(entry.quantity, entry.unit) : Number(entry.quantity) || 0), 0);
  if (availableBase + 1e-9 < requestedBase) {
    return { success:false, message:`Estoque insuficiente no Baú. Disponível: ${cargoMode ? fromCargoBase(availableBase, normalizedUnit) : availableBase} ${normalizedUnit}; necessário: ${requested} ${normalizedUnit}.` };
  }
  let remainingBase = requestedBase;
  const nextEntries = current.entries.map(entry => {
    if (!ids.has(String(entry.id)) || remainingBase <= 0) return entry;
    const available = cargoMode ? toCargoBase(entry.quantity, entry.unit) : Number(entry.quantity) || 0;
    const used = Math.min(available, remainingBase);
    remainingBase -= used;
    const nextBase = Math.max(0, available - used);
    const nextQuantity = cargoMode ? fromCargoBase(nextBase, entry.unit) : nextBase;
    return { ...entry, quantity: roundCargo(nextQuantity), updated_at: new Date().toISOString() };
  }).filter(entry => (Number(entry.quantity) || 0) > 0);
  const vault = { ...current, entries: nextEntries };
  saveVault(vault);
  return { success:true, vault, consumed: requested, unit: normalizedUnit, entryIds:[...ids] };
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

// Limpar todo o Baú de Minério após confirmação explícita na interface.
// A operação é intencionalmente centralizada para evitar que uma tela remova
// somente parte do estado ou deixe a persistência divergente.
export function wipeVault() {
  const current = loadVault();
  const removed = Array.isArray(current.entries) ? current.entries.length : 0;
  const next = { ...EMPTY_VAULT, entries: [] };
  saveVault(next);
  return { success: true, removed, vault: next };
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
    const id = String(usage.id ?? '').trim();
    const amount = Number(usage.amount);
    if (id && Number.isFinite(amount) && amount > 0) {
      deductions.set(id, (deductions.get(id) || 0) + amount);
    }
  }
  const v = loadVault();
  v.entries = v.entries.map(e => {
    const amount = deductions.get(String(e.id ?? '').trim()) || 0;
    if (!amount) return e;
    const remaining = Math.max(0, (Number(e.quantity) || 0) - amount);
    const normalizedUnit = normalizeCargoUnit(e.unit || 'un');
    return { ...e, quantity: isCargoUnit(normalizedUnit) ? roundCargo(remaining) : remaining, updated_at: new Date().toISOString() };
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

// Busca exata para consumidores que não podem aceitar nomes parecidos,
// como Iron e um item que apenas contém Iron no nome.
export function findExactVaultMatches(materialName, qualityMin = 0) {
  const normalize = value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const target = normalize(materialName);
  const v = loadVault();
  return v.entries.filter(entry =>
    normalize(entry.ore_name) === target
    && (Number(entry.quantity) || 0) > 0
    && qualityMeetsMinimum(entry.quality, qualityMin)
  );
}

// Total disponível de um material no baú para uma qualidade mínima
export function vaultTotalFor(materialName, qualityMin = 0, preferredUnit = '') {
  const entries = findVaultMatches(materialName, qualityMin);
  return cargoEquivalentTotal(entries, preferredUnit).total;
}
