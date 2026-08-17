import { loadInventoryPreferences } from './inventoryPreferences';

export const SECURE_DRIVE_ITEM_NAME = 'ASD Secure Drive';
export const MISSION_REWARD_ITEM_NAMES = Object.freeze(['MG Scrip', 'Council Scrip', SECURE_DRIVE_ITEM_NAME]);

function quantity(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function sameText(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function inventoryApi() {
  if (typeof window !== 'undefined' && window.electronAPI?.inventoryGetAll && window.electronAPI?.inventoryCreate && window.electronAPI?.inventoryUpdate) {
    return {
      getAll: () => window.electronAPI.inventoryGetAll(),
      create: item => window.electronAPI.inventoryCreate(item),
      update: item => window.electronAPI.inventoryUpdate(item),
    };
  }
  return null;
}

function defaultItemPayload(name, amount, destination, mission) {
  return {
    name,
    category: 'Miscellaneous',
    subcategory: 'Outro',
    system: destination.system,
    location_type: destination.location_type,
    location_name: destination.location_name,
    container: '',
    quantity: amount,
    unit: 'un',
    size: '',
    grade: '',
    manufacturer: '',
    condition: 'Novo',
    value_auec: 0,
    is_contraband: 0,
    notes: `Recompensa da missão ${mission?.title || mission?.id || ''} recebida automaticamente no local padrão do Inventário.`.trim(),
    is_crafted: 0,
    craft_status: [],
  };
}

async function addToDefaultInventory(name, amount, destination, mission) {
  const api = inventoryApi();
  if (!api) throw new Error('A API local do Inventário não está disponível.');
  const all = await api.getAll();
  const rows = Array.isArray(all) ? all : [];
  const target = rows.find(item => sameText(item?.name, name)
    && sameText(item?.system, destination.system)
    && sameText(item?.location_type, destination.location_type)
    && sameText(item?.location_name, destination.location_name));
  if (target) {
    const updated = { ...target, quantity: quantity(target.quantity) + amount };
    await api.update(updated);
    return { item: updated, created: false };
  }
  const created = await api.create(defaultItemPayload(name, amount, destination, mission));
  return { item: created || defaultItemPayload(name, amount, destination, mission), created: true };
}

function rewardDefinitions(mission) {
  return [
    {
      key: 'scrip',
      name: mission?.scrip_type === 'mg_scrip' ? 'MG Scrip' : mission?.scrip_type === 'council_scrip' ? 'Council Scrip' : '',
      amount: quantity(mission?.scrip_qty),
      dispatched: mission?.scrip_dispatched === true,
      fields: { dispatched: 'scrip_dispatched', status: 'scrip_status', at: 'scrip_dispatched_at', error: 'scrip_dispatch_error' },
    },
    {
      key: 'secure_drive',
      name: SECURE_DRIVE_ITEM_NAME,
      amount: mission?.secure_drive_enabled === true ? quantity(mission?.secure_drive_qty) : 0,
      dispatched: mission?.secure_drive_dispatched === true,
      fields: { dispatched: 'secure_drive_dispatched', status: 'secure_drive_status', at: 'secure_drive_dispatched_at', error: 'secure_drive_dispatch_error' },
    },
  ].filter(reward => reward.name && reward.amount > 0);
}

/**
 * Entrega as recompensas configuradas de uma missão no destino padrão do Inventário.
 * A operação é idempotente por campo de despacho: uma missão não credita duas vezes.
 */
export async function dispatchMissionRewardsToDefaultInventory(mission) {
  const rewards = rewardDefinitions(mission);
  if (!rewards.length) return { mission, dispatched: false, skipped: true, errors: [] };
  const pendingRewards = rewards.filter(reward => !reward.dispatched);
  if (!pendingRewards.length) return { mission, dispatched: false, skipped: true, errors: [] };
  const destination = loadInventoryPreferences().defaultDestination;
  if (!destination) {
    const next = rewards.reduce((result, reward) => ({
      ...result,
      [reward.fields.error]: 'Defina um local padrão em Inventário de Itens antes de concluir a missão.',
      [reward.fields.status]: 'pending',
    }), { ...mission });
    return { mission: next, dispatched: false, skipped: false, errors: ['Local padrão do Inventário não definido.'] };
  }

  let next = { ...mission };
  const errors = [];
  const dispatchedItems = [];
  for (const reward of pendingRewards) {
    if (reward.dispatched) continue;
    try {
      const result = await addToDefaultInventory(reward.name, reward.amount, destination, mission);
      next = {
        ...next,
        [reward.fields.dispatched]: true,
        [reward.fields.status]: 'credited',
        [reward.fields.at]: next[reward.fields.at] || new Date().toISOString(),
        [reward.fields.error]: '',
        [`${reward.key}_dispatch_system`]: destination.system,
        [`${reward.key}_dispatch_location_type`]: destination.location_type,
        [`${reward.key}_dispatch_location_name`]: destination.location_name,
      };
      dispatchedItems.push({ ...result, name: reward.name, quantity: reward.amount, destination });
    } catch (error) {
      const message = error?.message || `Não foi possível creditar ${reward.name}.`;
      errors.push(message);
      next = { ...next, [reward.fields.status]: 'pending', [reward.fields.error]: message };
    }
  }
  return { mission: next, dispatched: dispatchedItems.length > 0, skipped: false, errors, items: dispatchedItems, destination };
}

export function getMissionRewardStatus(mission, key) {
  if (key === 'secure_drive') {
    if (!mission?.secure_drive_enabled || quantity(mission.secure_drive_qty) <= 0) return null;
    if (mission.secure_drive_dispatched === true) return 'credited';
    if (mission.secure_drive_status === 'failed') return 'failed';
    return 'pending';
  }
  return null;
}

export default dispatchMissionRewardsToDefaultInventory;
