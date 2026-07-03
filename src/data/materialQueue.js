// Material Queue — tracks which materials are needed for queued blueprints
// Stored in localStorage, shared between BlueprintPage and MaterialTrackerPage

const KEY = 'sc_material_queue_v1';

export function loadQueue() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { queuedBlueprints:[], collectedMaterials:{} }; }
  catch { return { queuedBlueprints:[], collectedMaterials:{} }; }
}
export function saveQueue(q) { localStorage.setItem(KEY, JSON.stringify(q)); }

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
      ingredients: (bp.ingredients || []).map(i => ({
        material_name: i.material_name,
        quantity:      i.quantity,
        quality_min:   i.quality_min || 0,
        unit:          i.unit || 'un',
      })),
    });
  }
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

// Normalizar quantidade para unidade base (sempre armazenamos em cSCU se SCU/cSCU)
// Isso garante que coletas em SCU e cSCU se somem corretamente
function toBase(amount, unit) {
  if (unit === 'SCU')  return amount * 100; // 1 SCU = 100 cSCU
  if (unit === 'cSCU') return amount;
  return amount; // 'un', 'kg', etc: usa direto
}
function fromBase(amount, unit) {
  if (unit === 'SCU')  return amount / 100;
  if (unit === 'cSCU') return amount;
  return amount;
}
function baseUnit(unit) {
  if (unit === 'SCU' || unit === 'cSCU') return 'cSCU';
  return unit;
}

// Mark N units of a material as collected (unit must match the ingredient unit)
export function collectMaterial(materialName, amountCollected, unit = 'un') {
  const q = loadQueue();
  const key = materialName.toLowerCase();
  // Normalizar para unidade base antes de somar
  const inBase = toBase(amountCollected, unit);
  q.collectedMaterials[key] = (q.collectedMaterials[key] || 0) + inBase;
  q.collectedUnits = q.collectedUnits || {};
  q.collectedUnits[key] = baseUnit(unit);
  saveQueue(q);
  return q;
}

// Subtrair quantidade coletada (correção de erro)
export function uncollectMaterial(materialName, amount, unit = 'un') {
  const q = loadQueue();
  const key = materialName.toLowerCase();
  const inBase = toBase(amount, unit);
  const current = q.collectedMaterials[key] || 0;
  q.collectedMaterials[key] = Math.max(0, current - inBase);
  saveQueue(q);
  return q;
}

// Adicionar material manual à lista extra (não vem de blueprint)
export function addManualMaterial(materialName, amount, unit = 'un', qualityMin = 0) {
  const q = loadQueue();
  if (!q.manualMaterials) q.manualMaterials = [];
  const existing = q.manualMaterials.findIndex(m => m.material_name.toLowerCase() === materialName.toLowerCase() && m.unit === unit);
  if (existing >= 0) {
    q.manualMaterials[existing].quantity += amount;
  } else {
    q.manualMaterials.push({ material_name: materialName, quantity: amount, unit, quality_min: qualityMin, addedAt: new Date().toISOString() });
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
export function resetMaterialCollected(materialName) {
  const q = loadQueue();
  const key = materialName.toLowerCase();
  delete q.collectedMaterials[key];
  saveQueue(q);
  return q;
}

// Calculate the consolidated shopping list from all queued blueprints
// Returns: [{ material_name, needed_total, quality_min, collected, remaining, locations }]
export function calcShoppingList(queue) {
  const map = {};
  for (const bp of queue.queuedBlueprints) {
    for (const ing of bp.ingredients || []) {
      const key = ing.material_name.toLowerCase();
      if (!map[key]) {
        map[key] = {
          material_name: ing.material_name,
          needed_total:  0,
          quality_min:   ing.quality_min || 0,
          unit:          ing.unit || 'un',
          usedBy: [],
        };
      }
      map[key].needed_total  += ing.quantity * (bp.quantity || 1);
      map[key].quality_min    = Math.max(map[key].quality_min, ing.quality_min || 0);
      // Manter a unidade mais "pesada" se houver conflito
      if (ing.unit === 'SCU' || ing.unit === 'cSCU' || ing.unit === 'kg') map[key].unit = ing.unit;
      map[key].usedBy.push({ bpName: bp.bpName, qty: ing.quantity * (bp.quantity||1) });
    }
  }

  // Incluir materiais manuais na lista
  for (const m of (queue.manualMaterials || [])) {
    const key = m.material_name.toLowerCase();
    if (!map[key]) {
      map[key] = {
        material_name: m.material_name,
        needed_total:  0,
        quality_min:   m.quality_min || 0,
        unit:          m.unit || 'un',
        usedBy:        [],
        is_manual:     true,
      };
    }
    map[key].needed_total += m.quantity;
    if (!map[key].unit && m.unit) map[key].unit = m.unit;
  }

  return Object.values(map).map(item => {
    const key = item.material_name.toLowerCase();
    // Collected é armazenado na unidade base (cSCU se SCU/cSCU)
    const collectedBase = queue.collectedMaterials[key] || 0;
    const neededBase    = toBase(item.needed_total, item.unit);
    // Converter collected de volta para a unidade do item para exibição
    const collected = fromBase(Math.min(collectedBase, neededBase), item.unit);
    const needed    = item.needed_total;
    const remaining = Math.max(0, needed - collected);
    return { ...item, collected: parseFloat(collected.toFixed(4)), remaining: parseFloat(remaining.toFixed(4)) };
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
  const done = list.filter(i => i.remaining === 0).map(i => i.material_name.toLowerCase());
  for (const k of done) delete q.collectedMaterials[k];
  saveQueue(q);
  return q;
}
