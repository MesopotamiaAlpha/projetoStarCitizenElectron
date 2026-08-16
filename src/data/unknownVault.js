// ── Baú Desconhecido ─────────────────────────────────────────────────────────
// Guarda recompensas de missão que ainda não foram direcionadas para um local
// real do Inventário de Itens. O módulo é deliberadamente independente do
// SQLite: a entrada só sai daqui depois que a tela de Inventário confirma a
// gravação no destino.

export const UNKNOWN_VAULT_KEY = 'sc_unknown_vault_v1';
export const UNKNOWN_VAULT_UPDATED_EVENT = 'sc_unknown_vault_updated';
export const UNKNOWN_VAULT_ITEM_NAMES = Object.freeze(['MG Scrip', 'Council Scrip']);
export const MISSION_SCRIP_FAILURE_STATUSES = Object.freeze(['Failed', 'Bugged', 'Abandoned']);

export function isMissionScripFailureStatus(status) {
  return MISSION_SCRIP_FAILURE_STATUSES.includes(String(status || ''));
}

export function getMissionScripStatus(mission) {
  const type = normalizeScripType(mission?.scrip_type);
  const quantity = normalizeQuantity(mission?.scrip_qty);
  if (!type || quantity <= 0) return null;
  if (mission?.scrip_dispatched === true) return 'credited';
  if (mission?.scrip_status === 'failed' || isMissionScripFailureStatus(mission?.status)) return 'failed';
  return 'pending';
}

export function missionScripStatusLabel(status) {
  return status === 'credited' ? 'CREDITADO' : status === 'failed' ? 'FALHA' : 'PENDENTE';
}

export function normalizeScripType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'mg_scrip' || normalized === 'mg scrip') return 'mg_scrip';
  if (normalized === 'council_scrip' || normalized === 'council scrip' || normalized === 'council script') return 'council_scrip';
  return null;
}

export function scripTypeToName(value) {
  const type = normalizeScripType(value);
  return type === 'mg_scrip' ? 'MG Scrip' : type === 'council_scrip' ? 'Council Scrip' : '';
}

function canUseStorage() {
  return typeof window !== 'undefined' && window.localStorage;
}

function emit(detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(UNKNOWN_VAULT_UPDATED_EVENT, { detail }));
}

function normalizeName(name) {
  const value = String(name || '').trim().toLowerCase();
  if (value === 'mg scrip') return 'MG Scrip';
  if (value === 'council scrip' || value === 'council script') return 'Council Scrip';
  return String(name || '').trim();
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function normalizeItem(item, index = 0) {
  const quantity = normalizeQuantity(item?.quantity);
  return {
    id: String(item?.id || `unknown-${Date.now()}-${index}`),
    name: normalizeName(item?.name),
    quantity,
    source_mission_id: item?.source_mission_id ? String(item.source_mission_id) : '',
    source_mission_title: String(item?.source_mission_title || '').trim(),
    received_at: item?.received_at || new Date().toISOString(),
    dispatch_key: item?.dispatch_key ? String(item.dispatch_key) : '',
  };
}

function normalizeState(value) {
  const items = Array.isArray(value)
    ? value
    : value && Array.isArray(value.items)
      ? value.items
      : [];
  return { items: items.map(normalizeItem).filter(item => item.name && item.quantity > 0) };
}

export function loadUnknownVault() {
  if (!canUseStorage()) return { items: [] };
  try {
    return normalizeState(JSON.parse(window.localStorage.getItem(UNKNOWN_VAULT_KEY) || '{"items":[]}'));
  } catch {
    return { items: [] };
  }
}

export function saveUnknownVault(value) {
  const next = normalizeState(value);
  if (canUseStorage()) window.localStorage.setItem(UNKNOWN_VAULT_KEY, JSON.stringify(next));
  emit(next);
  return next;
}

function buildDispatchKey(input) {
  if (input?.dispatch_key) return String(input.dispatch_key);
  if (input?.source_mission_id) return `mission:${String(input.source_mission_id)}:${normalizeName(input.name).toLowerCase()}`;
  return '';
}

/**
 * Adiciona um item pendente ao Baú Desconhecido.
 *
 * Quando dispatch_key/source_mission_id já existe, a operação é idempotente:
 * o item existente é devolvido e nenhum novo registro é criado.
 */
export function addToUnknownVault(input = {}) {
  const name = normalizeName(input.name || input.scrip_type);
  const quantity = normalizeQuantity(input.quantity ?? input.scrip_qty);
  if (!name) throw new Error('O nome do item do Baú Desconhecido é obrigatório.');
  if (quantity <= 0) throw new Error('A quantidade do Baú Desconhecido deve ser maior que zero.');

  const dispatchKey = buildDispatchKey({ ...input, name });
  const current = loadUnknownVault();
  const duplicate = dispatchKey
    ? current.items.find(item => item.dispatch_key === dispatchKey)
    : null;
  if (duplicate) return { item: duplicate, state: current, duplicate: true };

  const item = normalizeItem({
    id: input.id,
    name,
    quantity,
    source_mission_id: input.source_mission_id,
    source_mission_title: input.source_mission_title,
    received_at: input.received_at,
    dispatch_key: dispatchKey,
  }, current.items.length);
  const state = saveUnknownVault({ items: [item, ...current.items] });
  return { item, state, duplicate: false };
}

/** Remove um item pendente pelo id. Retorna o item removido e o novo estado. */
export function removeFromUnknownVault(itemId) {
  const id = String(itemId || '');
  const current = loadUnknownVault();
  const removed = current.items.find(item => String(item.id) === id) || null;
  if (!removed) return { item: null, state: current, removed: false };
  const state = saveUnknownVault({ items: current.items.filter(item => String(item.id) !== id) });
  return { item: removed, state, removed: true };
}

/** Atualização controlada para telas de manutenção e testes. */
export function updateUnknownVaultItem(itemId, changes = {}) {
  const id = String(itemId || '');
  const current = loadUnknownVault();
  const index = current.items.findIndex(item => String(item.id) === id);
  if (index < 0) return { item: null, state: current, updated: false };
  const nextItem = normalizeItem({ ...current.items[index], ...changes, id: current.items[index].id });
  if (!nextItem.name || nextItem.quantity <= 0) return { item: null, state: current, updated: false };
  const items = current.items.slice();
  items[index] = nextItem;
  const state = saveUnknownVault({ items });
  return { item: nextItem, state, updated: true };
}

export function clearUnknownVault() {
  return saveUnknownVault({ items: [] });
}

/**
 * Envia o scrip configurado em uma missão para o Baú Desconhecido.
 * A função não falha a conclusão da missão: em caso de erro, devolve a missão
 * com scrip_dispatch_error para que a interface possa informar o problema e
 * permitir uma nova tentativa sem perder a recompensa.
 */
export function dispatchMissionScrip(mission) {
  const type = normalizeScripType(mission?.scrip_type);
  const quantity = normalizeQuantity(mission?.scrip_qty);
  if (!type || quantity <= 0 || mission?.scrip_dispatched === true) {
    return { mission, dispatched: false, skipped: true, item: null, error: null };
  }

  const name = scripTypeToName(type);
  const dispatchKey = `mission:${String(mission.id || mission.watcher_guid || mission.title || 'unknown')}:${type}`;
  try {
    const result = addToUnknownVault({
      name,
      quantity,
      source_mission_id: mission.id || mission.watcher_guid || '',
      source_mission_title: mission.title || '',
      dispatch_key: dispatchKey,
    });
    return {
      ...result,
      dispatched: true,
      skipped: false,
      error: null,
      mission: {
        ...mission,
        scrip_type: type,
        scrip_qty: quantity,
        scrip_dispatched: true,
        scrip_status: 'credited',
        scrip_dispatched_at: mission.scrip_dispatched_at || new Date().toISOString(),
        scrip_failed_at: null,
        scrip_failure_reason: '',
        scrip_dispatch_item_id: result.item?.id || mission.scrip_dispatch_item_id || null,
        scrip_dispatch_error: '',
      },
    };
  } catch (error) {
    return {
      item: null,
      state: loadUnknownVault(),
      dispatched: false,
      skipped: false,
      error,
      mission: { ...mission, scrip_dispatch_error: error.message || 'Não foi possível enviar o scrip ao Baú Desconhecido.' },
    };
  }
}

/**
 * Marca o scrip como falho quando a missão terminou sem sucesso.
 * Nenhuma entrada é criada no Baú Desconhecido. Se o scrip já foi creditado,
 * ele permanece creditado para evitar retirar uma recompensa legítima.
 */
export function markMissionScripFailed(mission, reason = '') {
  const type = normalizeScripType(mission?.scrip_type);
  const quantity = normalizeQuantity(mission?.scrip_qty);
  if (!type || quantity <= 0 || mission?.scrip_dispatched === true) {
    return { mission, failed: false, skipped: true };
  }
  return {
    mission: {
      ...mission,
      scrip_type: type,
      scrip_qty: quantity,
      scrip_dispatched: false,
      scrip_status: 'failed',
      scrip_failed_at: mission.scrip_failed_at || new Date().toISOString(),
      scrip_failure_reason: String(reason || mission.scrip_failure_reason || 'Missão não concluída.'),
      scrip_dispatch_error: '',
    },
    failed: true,
    skipped: false,
  };
}

export function getUnknownVaultQuantity(name, items = loadUnknownVault().items) {
  const normalized = normalizeName(name).toLowerCase();
  return (items || [])
    .filter(item => normalizeName(item?.name).toLowerCase() === normalized)
    .reduce((total, item) => total + normalizeQuantity(item?.quantity), 0);
}
