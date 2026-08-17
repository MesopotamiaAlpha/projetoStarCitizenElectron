function normalizedName(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function availableQuantity(item) {
  const total = Math.max(0, Number(item?.quantity) || 0);
  let reservations = item?.reservations;
  if (typeof reservations === 'string') {
    try { reservations = JSON.parse(reservations); } catch { reservations = []; }
  }
  if (!Array.isArray(reservations)) reservations = [];
  const reserved = reservations.reduce((sum, row) => sum + Math.max(0, Number(row?.quantity ?? row?.amount) || 0), 0);
  return Math.max(0, total - Math.min(total, reserved));
}

export function getInventoryItemQuantity(name, inventoryItems = []) {
  const target = normalizedName(name);
  if (!target) return 0;
  return inventoryItems.reduce((total, item) => {
    if (normalizedName(item?.name) !== target) return total;
    return total + availableQuantity(item);
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

function inventoryLocationLabel(item) {
  const location = String(item?.location_name || item?.location || '').trim();
  const system = String(item?.system || '').trim();
  const type = String(item?.location_type || item?.type || '').trim();
  const place = location || 'Local não informado';
  return [place, system, type].filter(Boolean).join(' · ');
}

function getInventorySources(name, inventoryItems = []) {
  const target = normalizedName(name);
  const sources = inventoryItems
    .filter(item => normalizedName(item?.name) === target && availableQuantity(item) > 0)
    .map(item => ({
      id: item.id,
      label: inventoryLocationLabel(item),
      quantity: availableQuantity(item),
    }));
  const labels = [...new Set(sources.map(source => source.label))];
  return { sources, labels };
}

export function scanWikeloMission(mission, inventoryItems = []) {
  const items = (mission?.items || []).map(item => scanWikeloItem(item, inventoryItems));
  const complete = items.length > 0 && items.every(item => (Number(item.collected) || 0) >= (Number(item.needed) || 1));
  return { ...mission, items, inventory_scanned_at: new Date().toISOString(), inventory_scan_complete: complete };
}

// Escaneia um item em todas as missões e reserva o estoque compartilhado em ordem
// determinística. Assim, uma única unidade não aparece como disponível para várias
// missões simultaneamente: cada missão recebe somente o saldo ainda não reservado.
export function scanWikeloMissions(missions = [], inventoryItems = [], targetName = '') {
  const target = normalizedName(targetName);
  const reservations = new Map();
  const scannedAt = new Date().toISOString();
  const sourceInfo = getInventorySources(targetName, inventoryItems);

  return (Array.isArray(missions) ? missions : []).map(mission => {
    let changed = false;
    const items = (mission?.items || []).map(item => {
      if (!target || normalizedName(item?.name) !== target) return item;
      changed = true;
      const needed = Math.max(0, Number(item?.needed) || 0);
      const previousCollected = Math.max(0, Number(item?.collected) || 0);
      const previousInventoryContribution = Math.max(0, Number(item?.from_inventory) || 0);
      const manualCollected = Math.max(0, previousCollected - previousInventoryContribution);
      const alreadyReserved = reservations.get(target) || 0;
      const availableForThisMission = Math.max(0, sourceInfo.sources.reduce((sum, source) => sum + source.quantity, 0) - alreadyReserved);
      const inventoryContribution = Math.min(availableForThisMission, Math.max(0, needed - manualCollected));
      reservations.set(target, alreadyReserved + inventoryContribution);
      const collected = Math.min(needed, manualCollected + inventoryContribution);
      return {
        ...item,
        collected,
        from_inventory: inventoryContribution,
        inventory_available: sourceInfo.sources.reduce((sum, source) => sum + source.quantity, 0),
        inventory_reserved_for_wikelo: alreadyReserved + inventoryContribution,
        inventory_source_locations: sourceInfo.labels,
        inventory_source_location: sourceInfo.labels.join(' | '),
        inventory_scanned_at: scannedAt,
      };
    });
    if (!changed) return mission;
    const complete = items.length > 0 && items.every(item => (Number(item.collected) || 0) >= (Number(item.needed) || 1));
    return { ...mission, items, inventory_scanned_at: scannedAt, inventory_scan_complete: complete };
  });
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
      const totalQuantity = Math.max(0, Number(row?.quantity) || 0);
      const currentQuantity = availableQuantity(row);
      const alreadyReserved = reserved.get(row.id) || 0;
      const available = Math.max(0, currentQuantity - alreadyReserved);
      const amount = Math.min(remaining, available);
      if (amount <= 0) return;
      reserved.set(row.id, alreadyReserved + amount);
      allocations.push({
        inventoryId: row.id,
        name: row.name,
        amount,
        beforeQuantity: totalQuantity,
        afterQuantity: totalQuantity - amount,
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
  const totalNeeded = items.reduce((sum, item) => sum + Math.max(0, Number(item?.needed) || 0), 0);
  const totalCollected = items.reduce((sum, item) => {
    const needed = Math.max(0, Number(item?.needed) || 0);
    const collected = Math.max(0, Number(item?.collected) || 0);
    return sum + Math.min(collected, needed);
  }, 0);
  const percent = totalNeeded > 0 ? Math.min(100, Math.round((totalCollected / totalNeeded) * 100)) : 0;
  return { total, completed, totalNeeded, totalCollected, percent, complete: total > 0 && completed === total };
}

export { normalizedName };
