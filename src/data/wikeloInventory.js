function normalizedName(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

export function getInventoryItemQuantity(name, inventoryItems = []) {
  const target = normalizedName(name);
  if (!target) return 0;
  return inventoryItems.reduce((total, item) => {
    if (normalizedName(item?.name) !== target) return total;
    const quantity = Number(item?.quantity);
    return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
  }, 0);
}

export function scanWikeloItem(item, inventoryItems = []) {
  const needed = Math.max(0, Number(item?.needed) || 0);
  const available = getInventoryItemQuantity(item?.name, inventoryItems);
  const previousCollected = Math.max(0, Number(item?.collected) || 0);
  const previousInventoryContribution = Math.max(0, Number(item?.from_inventory) || 0);
  const manualCollected = Math.max(0, previousCollected - previousInventoryContribution);
  const inventoryContribution = Math.min(available, Math.max(0, needed - manualCollected));
  const collected = Math.min(needed, manualCollected + inventoryContribution);

  return {
    ...item,
    collected,
    from_inventory: inventoryContribution,
    inventory_available: available,
    inventory_scanned_at: new Date().toISOString(),
  };
}

export function scanWikeloMission(mission, inventoryItems = []) {
  const items = (mission?.items || []).map(item => scanWikeloItem(item, inventoryItems));
  const complete = items.length > 0 && items.every(item => (Number(item.collected) || 0) >= (Number(item.needed) || 1));
  return { ...mission, items, inventory_scanned_at: new Date().toISOString(), inventory_scan_complete: complete };
}

export function buildWikeloDeliveryPlan(mission, inventoryItems = []) {
  if (mission?.wikelo_delivered_at || mission?.wikelo_delivery_status === 'delivered') {
    return { ok: false, alreadyDelivered: true, allocations: [], missing: [] };
  }

  const allocations = [];
  const missing = [];
  const reserved = new Map();

  (mission?.items || []).forEach(item => {
    const needed = Math.max(0, Number(item?.needed) || 0);
    const availableInMission = Math.max(0, Number(item?.collected) || 0);
    if (!item?.name || availableInMission < needed) {
      missing.push({ name: item?.name || 'Item sem nome', needed, collected: availableInMission, reason: 'A missão ainda não está completa.' });
      return;
    }

    const targetName = normalizedName(item.name);
    const candidates = inventoryItems.filter(row => normalizedName(row?.name) === targetName);
    let remaining = needed;
    candidates.forEach(row => {
      if (remaining <= 0) return;
      const currentQuantity = Math.max(0, Number(row?.quantity) || 0);
      const alreadyReserved = reserved.get(row.id) || 0;
      const available = Math.max(0, currentQuantity - alreadyReserved);
      const amount = Math.min(remaining, available);
      if (amount <= 0) return;
      reserved.set(row.id, alreadyReserved + amount);
      allocations.push({
        inventoryId: row.id,
        name: row.name,
        amount,
        beforeQuantity: currentQuantity,
        afterQuantity: currentQuantity - amount,
      });
      remaining -= amount;
    });

    if (remaining > 0) missing.push({ name: item.name, needed, collected: availableInMission, reason: `Faltam ${remaining} unidade(s) no Inventário para entregar.` });
  });

  return { ok: missing.length === 0 && allocations.length > 0, alreadyDelivered: false, allocations, missing };
}

export function applyWikeloDeliveryPlan(inventoryItems = [], plan) {
  if (!plan?.ok) return inventoryItems;
  const byId = new Map(plan.allocations.map(allocation => [String(allocation.inventoryId), allocation]));
  return inventoryItems
    .map(item => {
      const allocation = byId.get(String(item.id));
      if (!allocation) return item;
      return { ...item, quantity: allocation.afterQuantity };
    })
    .filter(item => Number(item.quantity) > 0);
}

export function getWikeloMissionProgress(mission) {
  const items = mission?.items || [];
  const total = items.length;
  const completed = items.filter(item => (Number(item.collected) || 0) >= (Number(item.needed) || 1)).length;
  return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0, complete: total > 0 && completed === total };
}

export { normalizedName };
