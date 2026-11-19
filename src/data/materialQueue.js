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
import { qualityMeetsRequirement, normalizeQualityOperator } from './oreVault';

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

export function getQualityOperator(value, qualityMin = 0) {
  const operator = normalizeQualityOperator(value);
  return normalizeQualityMin(qualityMin) > 0 ? operator : 'any';
}

export function qualityRequirementLabel(qualityMin = 0, qualityOperator = 'gte') {
  const value = normalizeQualityMin(qualityMin);
  const operator = getQualityOperator(qualityOperator, value);
  if (operator === 'any') return 'Qualidade livre';
  // O operador normalizado é '>=', '=' ou '<='; 'lte'/'eq' ficam por compatibilidade.
  // Antes só 'lte'/'eq' eram reconhecidos, então Q≤ e Q= apareciam como Q≥.
  const symbol = operator === '<=' || operator === 'lte' ? '≤' : operator === '=' || operator === 'eq' ? '=' : '≥';
  return `Q${symbol}${value}`;
}

// Uma chave diferente para Iron Q≥800, Iron Q≤800 e Iron sem exigência.
export function materialKey(materialName, qualityMin = 0, qualityOperator = 'gte') {
  const value = normalizeQualityMin(qualityMin);
  const operator = getQualityOperator(qualityOperator, value);
  return `${String(materialName || '').trim().toLowerCase()}::q${operator === 'any' ? '0' : `${operator}${value}`}`;
}

// Compatibilidade com blueprints antigas que podem ter usado qualityMin ou quality.
export function getIngredientQualityMin(ingredient = {}) {
  return normalizeQualityMin(ingredient.quality_min ?? ingredient.qualityMin ?? ingredient.quality ?? 0);
}

export function getIngredientQualityOperator(ingredient = {}) {
  return getQualityOperator(ingredient.quality_operator ?? ingredient.qualityOperator ?? ingredient.quality_op, getIngredientQualityMin(ingredient));
}

function legacyMaterialKey(materialName) {
  return String(materialName || '').trim().toLowerCase();
}

function getCollectedAmount(queue, materialName, qualityMin = 0, qualityOperator = 'gte') {
  const key = materialKey(materialName, qualityMin, qualityOperator);
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
    quality_operator: getIngredientQualityOperator(i),
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
export function collectMaterial(materialName, amountCollected, unit = 'un', qualityMin = 0, qualityOperator = 'gte') {
  const q = loadQueue();
  const key = materialKey(materialName, qualityMin, qualityOperator);
  // Normalizar para unidade base antes de somar
  const inBase = toBase(Number(amountCollected) || 0, unit);
  const current = getCollectedAmount(q, materialName, qualityMin, qualityOperator);
  q.collectedMaterials[key] = current + inBase;
  q.collectedMaterials[key] = Math.max(0, q.collectedMaterials[key]);
  q.collectedUnits = q.collectedUnits || {};
  q.collectedUnits[key] = baseUnit(unit);
  if (normalizeQualityMin(qualityMin) === 0) delete q.collectedMaterials[legacyMaterialKey(materialName)];
  saveQueue(q);
  return q;
}

// Subtrair quantidade coletada (correção de erro)
export function uncollectMaterial(materialName, amount, unit = 'un', qualityMin = 0, qualityOperator = 'gte') {
  const q = loadQueue();
  const key = materialKey(materialName, qualityMin, qualityOperator);
  const inBase = toBase(Number(amount) || 0, unit);
  const current = getCollectedAmount(q, materialName, qualityMin, qualityOperator);
  q.collectedMaterials[key] = Math.max(0, current - inBase);
  if (normalizeQualityMin(qualityMin) === 0) delete q.collectedMaterials[legacyMaterialKey(materialName)];
  saveQueue(q);
  return q;
}

// Adicionar material manual à lista extra (não vem de blueprint).
// É uma NECESSIDADE a coletar: o que já existe no Baú continua sendo contado
// automaticamente como "Já tenho". Entradas iguais (mesmo material, mesma
// exigência de qualidade e mesma unidade) são somadas.
export function addManualMaterial(materialName, amount, unit = 'un', qualityMin = 0, qualityOperator = 'gte') {
  const name = String(materialName || '').trim().replace(/\s+/g, ' ');
  const quantity = Number(amount);
  const q = loadQueue();
  if (!name || !Number.isFinite(quantity) || quantity <= 0) return q;

  const normalizedUnit = normalizeCargoUnit(unit || 'un') || 'un';
  const minimum = normalizeQualityMin(qualityMin);
  const operator = getQualityOperator(qualityOperator, minimum);
  const key = materialKey(name, minimum, operator);
  const list = Array.isArray(q.manualMaterials) ? q.manualMaterials : [];
  const existing = list.findIndex(m =>
    materialKey(m.material_name, m.quality_min, m.quality_operator) === key
    && normalizeCargoUnit(m.unit || 'un') === normalizedUnit
  );

  if (existing >= 0) {
    const sum = (Number(list[existing].quantity) || 0) + quantity;
    list[existing] = { ...list[existing], quantity: isCargoUnit(normalizedUnit) ? roundCargo(sum) : sum, unit: normalizedUnit };
  } else {
    list.push({
      material_name: name,
      quantity: isCargoUnit(normalizedUnit) ? roundCargo(quantity) : quantity,
      unit: normalizedUnit,
      quality_min: minimum,
      quality_operator: operator,
      addedAt: new Date().toISOString(),
    });
  }
  q.manualMaterials = list;
  saveQueue(q);
  return q;
}

// Remover material manual.
// - Só com o nome (uso antigo): remove todas as entradas com esse nome.
// - Com qualidade: remove apenas a entrada daquela exigência (Iron Q≥800 não
//   leva junto o Iron sem exigência). `unit` restringe a uma unidade específica.
export function removeManualMaterial(materialName, qualityMin, qualityOperator = 'gte', unit) {
  const q = loadQueue();
  const target = String(materialName || '').trim().toLowerCase();
  const byQuality = qualityMin !== undefined && qualityMin !== null;
  const minimum = normalizeQualityMin(qualityMin);
  const key = byQuality ? materialKey(materialName, minimum, getQualityOperator(qualityOperator, minimum)) : '';
  const wantedUnit = unit ? normalizeCargoUnit(unit) : '';

  q.manualMaterials = (q.manualMaterials || []).filter(m => {
    if (!byQuality) return String(m.material_name || '').trim().toLowerCase() !== target;
    if (materialKey(m.material_name, m.quality_min, m.quality_operator) !== key) return true;
    if (wantedUnit && normalizeCargoUnit(m.unit || 'un') !== wantedUnit) return true;
    return false;
  });
  saveQueue(q);
  return q;
}

// Reset collected amount for a material
export function resetMaterialCollected(materialName, qualityMin = 0, qualityOperator = 'gte') {
  const q = loadQueue();
  delete q.collectedMaterials[materialKey(materialName, qualityMin, qualityOperator)];
  if (normalizeQualityMin(qualityMin) === 0) delete q.collectedMaterials[legacyMaterialKey(materialName)];
  saveQueue(q);
  return q;
}

function normalizeStockName(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getVaultCollectedBase(stockEntries, materialName, qualityMin, requiredUnit = 'un', qualityOperator = 'gte') {
  const target = normalizeStockName(materialName);
  const targetUnit = normalizeCargoUnit(requiredUnit || 'un');
  return (Array.isArray(stockEntries) ? stockEntries : []).reduce((total, entry) => {
    if (normalizeStockName(entry?.ore_name) !== target) return total;
    if (!qualityMeetsRequirement(entry?.quality, qualityMin, qualityOperator)) return total;
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
  const EPS = 1e-9;
  const newItem = (key, name, qualityMin, qualityOperator, unit, isManual) => ({
    key,
    material_name: name,
    needed_base:   0,
    applied_base:  0, // já consumido do Baú em crafts parciais (não conta mais como necessidade)
    manual_base:   0,
    manual_entries: [],
    has_manual:    false,
    quality_min:   qualityMin,
    quality_operator: qualityOperator,
    unit:          normalizeCargoUnit(unit || 'un'),
    usedBy: [],
    is_manual:     isManual,
  });

  for (const bp of queue.queuedBlueprints) {
    // Quantidade já aplicada (consumida do Baú) a este item, por material, em unidade-base.
    const appliedLeft = bp.applied && typeof bp.applied === 'object' ? { ...bp.applied } : {};
    for (const ing of bp.ingredients || []) {
      const qualityMin = getIngredientQualityMin(ing);
      const qualityOperator = getIngredientQualityOperator(ing);
      const key = materialKey(ing.material_name, qualityMin, qualityOperator);
      if (!map[key]) map[key] = newItem(key, ing.material_name, qualityMin, qualityOperator, ing.unit, false);
      const ingredientQuantity = (Number(ing.quantity) || 0) * (Number(bp.quantity) || 1);
      let lineBase = toBase(ingredientQuantity, ing.unit || 'un');
      const takeApplied = Math.min(Math.max(0, Number(appliedLeft[key]) || 0), lineBase);
      if (takeApplied > 0) {
        appliedLeft[key] -= takeApplied;
        lineBase -= takeApplied;
        map[key].applied_base += takeApplied;
      }
      map[key].needed_base += lineBase;
      // Para unidades de carga, a soma ocorre em cSCU mesmo quando as blueprints
      // misturam SCU, cSCU, mSCU ou μSCU.
      if (!isCargoUnit(map[key].unit) && isCargoUnit(ing.unit)) map[key].unit = normalizeCargoUnit(ing.unit);
      map[key].usedBy.push({ bpName: bp.bpName, qty: Number(ing.quantity) * (Number(bp.quantity)||1), quality_min: qualityMin, quality_operator: qualityOperator });
    }
  }

  // Incluir materiais manuais na lista, também separados por qualidade mínima.
  for (const m of (queue.manualMaterials || [])) {
    const qualityMin = normalizeQualityMin(m.quality_min);
    const qualityOperator = getQualityOperator(m.quality_operator, qualityMin);
    const key = materialKey(m.material_name, qualityMin, qualityOperator);
    if (!map[key]) map[key] = newItem(key, m.material_name, qualityMin, qualityOperator, m.unit, true);
    const manualBase = toBase(Number(m.quantity) || 0, m.unit || 'un');
    map[key].needed_base += manualBase;
    map[key].manual_base += manualBase;
    map[key].has_manual = true;
    map[key].manual_entries.push({ unit: normalizeCargoUnit(m.unit || 'un'), quantity: Number(m.quantity) || 0 });
    if (!isCargoUnit(map[key].unit) && isCargoUnit(m.unit)) map[key].unit = normalizeCargoUnit(m.unit);
  }

  return Object.values(map)
    // Material 100% aplicado em crafts parciais não tem mais o que coletar: sai da lista.
    .filter(item => !(item.applied_base > EPS && item.needed_base <= EPS))
    .map(item => {
      const collectedBase = Array.isArray(stockEntries)
        ? getVaultCollectedBase(stockEntries, item.material_name, item.quality_min, item.unit, item.quality_operator)
        : getCollectedAmount(queue, item.material_name, item.quality_min, item.quality_operator);
      const neededBase    = roundCargo(item.needed_base);
      const needed        = fromBase(neededBase, item.unit);
      const collected    = fromBase(Math.min(collectedBase, neededBase), item.unit);
      const remaining    = Math.max(0, needed - collected);
      return {
        ...item,
        needed_total: parseFloat(Number(needed).toFixed(9)),
        collected: parseFloat(Number(collected).toFixed(9)),
        remaining: parseFloat(Number(remaining).toFixed(9)),
        applied_total: parseFloat(Number(fromBase(roundCargo(item.applied_base), item.unit)).toFixed(9)),
        manual_total: parseFloat(Number(fromBase(roundCargo(item.manual_base), item.unit)).toFixed(9)),
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
