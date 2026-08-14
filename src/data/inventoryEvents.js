import { dispatchStorageEvent } from '../utils/storage';

export const INVENTORY_UPDATED_EVENT = 'sc_inventory_updated';

export function publishInventoryUpdate(items = null) {
  dispatchStorageEvent(INVENTORY_UPDATED_EVENT, {
    items: Array.isArray(items) ? items : null,
    updatedAt: new Date().toISOString(),
  });
}

export default INVENTORY_UPDATED_EVENT;

// Fim de inventoryEvents.js
