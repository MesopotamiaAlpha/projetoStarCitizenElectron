// Material Queue — tracks which materials are needed for queued blueprints
// Stored in localStorage, shared between BlueprintPage and MaterialTrackerPage
import {
  normalizeCargoUnit,
  isCargoUnit,
  areCargoUnitsCompatible,
  toCargoBase,
  fromCargoBase,
  roundCargo,
} from './cargoUnits';
import { readJson, writeJson } from '../utils/storage';
import { qualityMeetsMinimum } from './oreVault';

const KEY = 'sc_material_queue_v1';
const MATERIAL_ORDER_KEY = 'sc_material_priority_order_v1';

const EMPTY_QUEUE = { queuedBlueprints: [], collectedMaterials: {} };

export function loadQueue() {
  const value = readJson(KEY, EMPTY_QUEUE);
  if (!value || typeof value !== 'object') return { ...EMPTY_QUEUE };
  return {
    ...EMPTY_QUEUE,
    ...value,
    queuedBlueprints: Array.isArray(value.queuedBlueprints) ? value.queuedBlueprints : [],
    collectedMaterials: value.collectedMaterials && typeof value.collectedMaterials === 'object' ? value.collectedMaterials : {},
  };
}
export function saveQueue(q) { return writeJson(KEY, q); }

// Ordem manual dos materiais no Tracking. Mantida separada da fila para não alterar dados antigos.
export function loadMaterialOrder() {
  const parsed = readJson(MATERIAL_ORDER_KEY, []);
  return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
}

export function saveMaterialOrder(order) {
  const normalized = Array.isArray(order) ? order.filter(Boolean).map(String) : [];
  writeJson(MATERIAL_ORDER_KEY, [...new Set(normalized)]);
  return normalized;
}

export function normalizeQualityMin(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// Uma chave diferente para Iron Q≥800 e Iron sem exigência de qualidade.
export function materialKey(materialName, qualityMin = 0) {
  return `${String(materialName || '').trim().toLowerCase()}::q${normalizeQualityMin(qualityMin)}`;
}

// Compatibilidade com blueprints antigas que podem ter usado qualityMin ou quality.
export function getIngredientQualityMin(ingredient = {}) {
  return normalizeQualityMin(ingredient.quality_min ?? ingredient.qualityMin ?? ingredient.quality ?? 0);
}

function legacyMaterialKey(materialName) {
  return String(materialName || '').trim().toLowerCase();
}

function getCollectedAmount(queue, materialName, qualityMin = 0) {
  const key = materialKey(materialName, qualityMin);
  if (queue.collectedMaterials?.[key] !== undefined) return Number(queue.collectedMaterials[key]) || 0;
  // Compatibilidade: somente materiais sem exigência podem herdar coletas antigas.
  if (normalizeQualityMin(qualityMin) === 0) return Number(queue.collectedMaterials?.[legacyMaterialKey(materialName)]) || 0;
  return 0;
}

function snapshotBlueprintIngredients(ingredients) {
  return (Array.isArray(ingredients) ? ingredients : []).map(i => ({
    material_name: i.material_name,
    quantity:      i.quantity,
    quality_min:   getIngredientQualityMin(i),
    unit:          i.unit || 'un',
  }));
}

// Add a blueprint to the crafting queue
export function queueBlueprint(bp, quantity = 1) {
  const q = loadQueue();
  const existing = q.queuedBlueprints.findIndex(b => b.bpId === bp.id);
  if (existing >= 0) {
    q.queuedBlueprints[existing].quantity += quantity;
  } else {
    q.queuedBlueprints.push({
      bpId:        bp.id,
      bpName:      bp.name,
      category:    bp.category,
      faction:     bp.faction,
      quantity,
      addedAt:     new Date().toISOString(),
      ingredients: snapshotBlueprintIngredients(bp.ingredients),
    });
  }
  saveQueue(q);
  return q;
}

// Atualiza o snapshot de uma blueprint que já está na fila. Sem esta
// sincronização, uma qualidade mínima alterada na página Blueprints só seria
// aplicada depois de remover e adicionar a blueprint novamente.
export function syncQueuedBlueprint(bp) {
  const q = loadQueue();
  const index = q.queuedBlueprints.findIndex(item => String(item.bpId) === String(bp?.id));
  if (index < 0) return q;

  const current = q.queuedBlueprints[index];
  q.queuedBlueprints[index] = {
    ...current,
    bpName: bp.name,
    category: bp.category,
    faction: bp.faction,
    ingredients: snapshotBlueprintIngredients(bp.ingredients),
  };
  saveQueue(q);
  return q;
}

// Remove a blueprint from the queue
export function dequeueBlueprint(bpId) {
  const q = loadQueue();
  q.queuedBlueprints = q.queuedBlueprints.filter(b => b.bpId !== bpId);
  saveQueue(q);
  return q;
}

// Update quantity of a queued blueprint
export function updateQueuedQty(bpId, quantity) {
  const q = loadQueue();
  q.queuedBlueprints = q.queuedBlueprints.map(b =>
    b.bpId === bpId ? { ...b, quantity: Math.max(1, quantity) } : b
  );
  saveQueue(q);
  return q;
}

// Normaliza quantidades de carga na unidade-base cSCU.
// Mantemos os nomes toBase/fromBase para compatibilidade com o Tracking atual.
function toBase(amount, unit) {
  const normalized = normalizeCargoUnit(unit);
  return isCargoUnit(normalized) ? toCargoBase(amount, normalized) : Number(amount) || 0;
}
function fromBase(amount, unit) {
  const normalized = normalizeCargoUnit(unit);
  return isCargoUnit(normalized) ? fromCargoBase(amount, normalized) : Number(amount) || 0;
}
function baseUnit(unit) {
  const normalized = normalizeCargoUnit(unit);
  return isCargoUnit(normalized) ? 'cSCU' : normalized;
}

// Mark N units of a material as collected (unit must match the ingredient unit)
export function collectMaterial(materialName, amountCollected, unit = 'un', qualityMin = 0) {
  const q = loadQueue();
  const key = materialKey(materialName, qualityMin);
  // Normalizar para unidade base antes de somar
  const inBase = toBase(Number(amountCollected) || 0, unit);
  const current = getCollectedAmount(q, materialName, qualityMin);
  q.collectedMaterials[key] = current + inBase;
  q.collectedMaterials[key] = Math.max(0, q.collectedMaterials[key]);
  q.collectedUnits = q.collectedUnits || {};
  q.collectedUnits[key] = baseUnit(unit);
  if (normalizeQualityMin(qualityMin) === 0) delete q.collectedMaterials[legacyMaterialKey(materialName)];
  saveQueue(q);
  return q;
}

// Subtrair quantidade coletada (correção de erro)
export function uncollectMaterial(materialName, amount, unit = 'un', qualityMin = 0) {
  const q = loadQueue();
  const key = materialKey(materialName, qualityMin);
  const inBase = toBase(Number(amount) || 0, unit);
  const current = getCollectedAmount(q, materialName, qualityMin);
  q.collectedMaterials[key] = Math.max(0, current - inBase);
  if (normalizeQualityMin(qualityMin) === 0) delete q.collectedMaterials[legacyMaterialKey(materialName)];
  saveQueue(q);
  return q;
}

// Adicionar material manual à lista extra (não vem de blueprint)
export function addManualMaterial(materialName, amount, unit = 'un', qualityMin = 0) {
  const q = loadQueue();
  if (!q.manualMaterials) q.manualMaterials = [];
    const existing = q.manualMaterials.findIndex(m => materialKey(m.material_name, m.quality_min) === materialKey(materialName, qualityMin) && m.unit === unit);
  if (existing >= 0) {
    q.manualMaterials[existing].quantity += Number(amount) || 0;
  } else {
    q.manualMaterials.push({ material_name: materialName, quantity: Number(amount) || 0, unit, quality_min: normalizeQualityMin(qualityMin), addedAt: new Date().toISOString() });
  }
  saveQueue(q);
  return q;
}

// Remover material manual
export function removeManualMaterial(materialName) {
  const q = loadQueue();
  q.manualMaterials = (q.manualMaterials || []).filter(m => m.material_name.toLowerCase() !== materialName.toLowerCase());
  saveQueue(q);
  return q;
}

// Reset collected amount for a material
export function resetMaterialCollected(materialName, qualityMin = 0) {
  const q = loadQueue();
  delete q.collectedMaterials[materialKey(materialName, qualityMin)];
  if (normalizeQualityMin(qualityMin) === 0) delete q.collectedMaterials[legacyMaterialKey(materialName)];
  saveQueue(q);
  return q;
}

function normalizeStockName(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getVaultCollectedBase(stockEntries, materialName, qualityMin, requiredUnit = 'un') {
  const target = normalizeStockName(materialName);
  const targetUnit = normalizeCargoUnit(requiredUnit || 'un');
  return (Array.isArray(stockEntries) ? stockEntries : []).reduce((total, entry) => {
    if (normalizeStockName(entry?.ore_name) !== target) return total;
    if (!qualityMeetsMinimum(entry?.quality, qualityMin)) return total;
    const entryUnit = normalizeCargoUnit(entry?.unit || 'un');
    const compatible = isCargoUnit(targetUnit) && isCargoUnit(entryUnit)
      ? areCargoUnitsCompatible(targetUnit, entryUnit)
      : entryUnit === targetUnit;
    if (!compatible) return total;
    return total + toBase(Number(entry.quantity) || 0, entryUnit);
  }, 0);
}

// Calculate the consolidated shopping list from all queued blueprints.
// When stockEntries is provided, the Ore Vault is the single source of truth.
// The old collectedMaterials map remains only as a compatibility fallback for
// callers that do not yet provide the vault entries.
// Returns: [{ material_name, needed_total, quality_min, collected, remaining, locations }]
export function calcShoppingList(queue, stockEntries) {
  const map = {};
  for (const bp of queue.queuedBlueprints) {
    for (const ing of bp.ingredients || []) {
      const qualityMin = getIngredientQualityMin(ing);
      const key = materialKey(ing.material_name, qualityMin);
      if (!map[key]) {
                map[key] = {
          key,
          material_name: ing.material_name,
          needed_base:   0,
          quality_min:   qualityMin,
          unit:          normalizeCargoUnit(ing.unit || 'un'),
          usedBy: [],
          is_manual:     false,
        };
      }
      const ingredientQuantity = (Number(ing.quantity) || 0) * (Number(bp.quantity) || 1);
      map[key].needed_base += toBase(ingredientQuantity, ing.unit || 'un');
      // Para unidades de carga, a soma ocorre em cSCU mesmo quando as blueprints
      // misturam SCU, cSCU, mSCU ou μSCU.
      if (!isCargoUnit(map[key].unit) && isCargoUnit(ing.unit)) map[key].unit = normalizeCargoUnit(ing.unit);
      map[key].usedBy.push({ bpName: bp.bpName, qty: Number(ing.quantity) * (Number(bp.quantity)||1), quality_min: qualityMin });
    }
  }

  // Incluir materiais manuais na lista, também separados por qualidade mínima.
  for (const m of (queue.manualMaterials || [])) {
    const qualityMin = normalizeQualityMin(m.quality_min);
    const key = materialKey(m.material_name, qualityMin);
    if (!map[key]) {
        map[key] = {
          key,
          material_name: m.material_name,
          needed_base:   0,
          quality_min:   qualityMin,
          unit:          normalizeCargoUnit(m.unit || 'un'),
          usedBy:        [],
          is_manual:     true,
        };
    }
    map[key].needed_base += toBase(Number(m.quantity) || 0, m.unit || 'un');
    map[key].is_manual = map[key].is_manual && true;
    if (!isCargoUnit(map[key].unit) && isCargoUnit(m.unit)) map[key].unit = normalizeCargoUnit(m.unit);
  }

  return Object.values(map).map(item => {
    const collectedBase = Array.isArray(stockEntries)
      ? getVaultCollectedBase(stockEntries, item.material_name, item.quality_min, item.unit)
      : getCollectedAmount(queue, item.material_name, item.quality_min);
    const neededBase    = roundCargo(item.needed_base);
    const needed        = fromBase(neededBase, item.unit);
    const collected    = fromBase(Math.min(collectedBase, neededBase), item.unit);
    const remaining    = Math.max(0, needed - collected);
    return {
      ...item,
      needed_total: parseFloat(Number(needed).toFixed(9)),
      collected: parseFloat(Number(collected).toFixed(9)),
      remaining: parseFloat(Number(remaining).toFixed(9)),
    };
  }).sort((a,b) => b.remaining - a.remaining);
}

// Check if a blueprint is in the queue
export { toBase, fromBase, baseUnit };
export function isBlueprintQueued(bpId) {
  return loadQueue().queuedBlueprints.some(b => b.bpId === bpId);
}

// Clear completed (0 remaining) from collected — cleanup
export function clearCompleted() {
  const q = loadQueue();
  const list = calcShoppingList(q);
  const done = list.filter(i => i.remaining === 0);
  for (const item of done) {
    delete q.collectedMaterials[item.key];
    if (normalizeQualityMin(item.quality_min) === 0) delete q.collectedMaterials[legacyMaterialKey(item.material_name)];
  }
  saveQueue(q);
  return q;
}
