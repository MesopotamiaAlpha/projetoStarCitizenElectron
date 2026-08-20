function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeInventoryStockName(value) {
  return normalizeText(value);
}

export function inventoryStockLocationKey(item) {
  return `${String(item?.system || 'Outro').trim()}::${String(item?.location_type || 'Outros').trim()}::${String(item?.location_name || 'Local não informado').trim()}`;
}

export function inventoryReservedQuantity(item) {
  const reservations = Array.isArray(item?.reservations) ? item.reservations : [];
  return reservations.reduce((total, reservation) => total + Math.max(0, Number(reservation?.quantity) || 0), 0);
}

export function inventoryAvailableQuantity(item) {
  return Math.max(0, (Number(item?.quantity) || 0) - inventoryReservedQuantity(item));
}

export function planInventoryStockConsumption(items = [], { name = '', locationKeys = [], quantity = 0 } = {}) {
  const requested = Math.max(0, Number(quantity) || 0);
  const targetName = normalizeInventoryStockName(name);
  const allowedLocations = new Set((Array.isArray(locationKeys) ? locationKeys : []).map(key => String(key || '').trim()).filter(Boolean));
  if (!targetName || requested <= 0) return { success: false, consumed: 0, remaining: requested, allocations: [], message: 'Item ou quantidade inválida.' };

  const candidates = (Array.isArray(items) ? items : [])
    .filter(item => normalizeInventoryStockName(item?.name) === targetName)
    .filter(item => !allowedLocations.size || allowedLocations.has(inventoryStockLocationKey(item)))
    .map((item, index) => ({ item, index, available: inventoryAvailableQuantity(item) }))
    .filter(candidate => candidate.available > 0);

  const totalAvailable = candidates.reduce((total, candidate) => total + candidate.available, 0);
  if (totalAvailable + 1e-9 < requested) {
    return {
      success: false,
      consumed: 0,
      remaining: requested,
      allocations: [],
      totalAvailable,
      message: `Estoque de itens insuficiente: disponível ${totalAvailable}, necessário ${requested}.`,
    };
  }

  let remaining = requested;
  const allocations = [];
  candidates.forEach(candidate => {
    if (remaining <= 0) return;
    const amount = Math.min(candidate.available, remaining);
    const nextQuantity = Math.max(0, (Number(candidate.item.quantity) || 0) - amount);
    allocations.push({
      inventoryId: candidate.item.id,
      amount,
      beforeQuantity: Number(candidate.item.quantity) || 0,
      afterQuantity: nextQuantity,
      locationKey: inventoryStockLocationKey(candidate.item),
    });
    remaining -= amount;
  });

  return { success: remaining <= 1e-9, consumed: requested - Math.max(0, remaining), remaining: Math.max(0, remaining), allocations, totalAvailable };
}

export function applyInventoryStockConsumption(items = [], plan) {
  if (!plan?.success) return Array.isArray(items) ? items : [];
  const byId = new Map((plan.allocations || []).map(allocation => [String(allocation.inventoryId), allocation]));
  return (Array.isArray(items) ? items : [])
    .map(item => {
      const allocation = byId.get(String(item.id));
      if (!allocation) return item;
      return { ...item, quantity: allocation.afterQuantity };
    });
}
