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

// Mark N units of a material as collected
export function collectMaterial(materialName, amountCollected) {
  const q = loadQueue();
  const key = materialName.toLowerCase();
  q.collectedMaterials[key] = (q.collectedMaterials[key] || 0) + amountCollected;
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
          usedBy: [],
        };
      }
      map[key].needed_total  += ing.quantity * (bp.quantity || 1);
      map[key].quality_min    = Math.max(map[key].quality_min, ing.quality_min || 0);
      map[key].usedBy.push({ bpName: bp.bpName, qty: ing.quantity * (bp.quantity||1) });
    }
  }

  return Object.values(map).map(item => {
    const collected = queue.collectedMaterials[item.material_name.toLowerCase()] || 0;
    const remaining = Math.max(0, item.needed_total - collected);
    return { ...item, collected, remaining };
  }).sort((a,b) => b.remaining - a.remaining);
}

// Check if a blueprint is in the queue
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
