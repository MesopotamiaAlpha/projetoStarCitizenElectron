const UEX_BASE = 'https://api.uexcorp.uk/2.0';
const TOKEN_KEY = 'sc_uex_token_v1';
const SECRET_KEY = 'sc_uex_secretkey_v1';

export const UEX_INSIGHTS_KEYS = Object.freeze({
  marketplaceAverages: 'sc_uex_marketplace_averages_v1',
  marketplaceHistory: 'sc_uex_marketplace_history_v1',
  marketplaceTrends: 'sc_uex_marketplace_trends_v1',
  dataMonitor: 'sc_uex_data_monitor_v1',
  commodityAlerts: 'sc_uex_commodity_alerts_v1',
  commodityAverages: 'sc_uex_commodity_averages_v1',
  commodityStatus: 'sc_uex_commodity_status_v1',
  refineries: 'sc_uex_refineries_v1',
  refineryJobs: 'sc_uex_refinery_jobs_v1',
  fleet: 'sc_uex_fleet_v1',
  loaners: 'sc_uex_loaners_v1',
  itemAttributes: 'sc_uex_item_attributes_v1',
  fuelPrices: 'sc_uex_fuel_prices_v1',
  terminalDistances: 'sc_uex_terminal_distances_v1',
});

export const QUALITY_TIERS = Object.freeze([
  { value: '', label: 'Todas as qualidades' },
  { value: '0', label: 'Q0' },
  { value: '1', label: 'Q1–499' },
  { value: '2', label: 'Q500–599' },
  { value: '3', label: 'Q600–699' },
  { value: '4', label: 'Q700–799' },
  { value: '5', label: 'Q800–899' },
  { value: '6', label: 'Q900–949' },
  { value: '7', label: 'Q950–1000' },
]);

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readText(key) {
  try {
    return storage()?.getItem(key) || '';
  } catch {
    return '';
  }
}

function readJson(key, fallback = null) {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    storage()?.setItem(key, JSON.stringify(value));
    return value;
  } catch {
    return value;
  }
}

export function loadUexToken() {
  return readText(TOKEN_KEY);
}

export function loadUexSecretKey() {
  return readText(SECRET_KEY);
}

function requireUexCredentials() {
  if (!loadUexToken()) throw new Error('Configure o Bearer Token da UEX antes de consultar dados autenticados.');
  if (!loadUexSecretKey()) throw new Error('Configure a secret-key da UEX antes de consultar dados autenticados.');
}

export function unwrapRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function buildQuery(params = {}) {
  return Object.entries(params)
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/**
 * GET compartilhado para endpoints documentados da UEX.
 * O Electron usa a proxy IPC existente; o navegador fica limitado ao fallback
 * público sem headers de autenticação, como nas integrações antigas.
 */
export async function uexInsightFetch(endpoint, params = {}, options = {}) {
  const query = buildQuery(params);
  const resource = `${endpoint}${query ? `?${query}` : ''}`;
  const token = options.token ?? loadUexToken();
  const secretKey = options.secretKey ?? loadUexSecretKey();

  if (typeof window !== 'undefined' && window.electronAPI?.uexFetch) {
    const result = await window.electronAPI.uexFetch({ endpoint: resource, token, secretKey });
    if (result?.success) return result.data;
    throw new Error(result?.message || `Falha ao consultar ${endpoint}`);
  }

  const response = await fetch(`${UEX_BASE}/${resource}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (json.status && json.status !== 'ok') throw new Error(json.message || json.status);
  return json.data ?? json;
}

export function loadUexInsight(key, fallback = null) {
  return readJson(key, fallback);
}

export function saveUexInsight(key, data, meta = {}) {
  return writeJson(key, {
    data,
    syncedAt: meta.syncedAt || new Date().toISOString(),
    endpoint: meta.endpoint || null,
    gameVersion: meta.gameVersion || null,
    ttl: meta.ttl || null,
  });
}

export function clearUexInsight(key) {
  try { storage()?.removeItem(key); } catch { /* armazenamento local indisponível */ }
}

export async function fetchMarketplaceAverages(filters = {}) {
  const params = {
    id_item: filters.idItem,
    id_category: filters.idCategory,
    item_uuid: filters.itemUuid,
    item_name: filters.itemName,
    operation: filters.operation,
    quality_tier: filters.qualityTier,
    currency: filters.currency,
    game_version: filters.gameVersion,
  };
  const hasTarget = [params.id_item, params.id_category, params.item_uuid, params.item_name]
    .some(value => value !== '' && value !== null && value !== undefined);
  if (!hasTarget) {
    throw new Error('Informe um item, categoria ou nome para consultar médias por qualidade.');
  }
  const data = unwrapRows(await uexInsightFetch('marketplace_prices_averages', params));
  return data;
}

export async function fetchMarketplaceAveragesAll() {
  return unwrapRows(await uexInsightFetch('marketplace_prices_averages_all'));
}

export async function fetchMarketplaceTrends(filters = {}) {
  return unwrapRows(await uexInsightFetch('marketplace_trends', {
    id_item: filters.idItem,
    item_name: filters.itemName,
    id_category: filters.idCategory,
    currency: filters.currency,
    quality_tier: filters.qualityTier,
  }));
}

export async function fetchMarketplaceHistory(filters = {}) {
  const params = {
    id_item: filters.idItem,
    id_listing: filters.idListing,
    id_terminal: filters.idTerminal,
    id_star_system: filters.idStarSystem,
    id_category: filters.idCategory,
    item_uuid: filters.itemUuid,
    item_name: filters.itemName,
    operation: filters.operation,
    quality_tier: filters.qualityTier,
    currency: filters.currency,
    game_version: filters.gameVersion,
    date_start: filters.dateStart,
    date_end: filters.dateEnd,
  };
  const hasTarget = [params.id_item, params.id_listing, params.id_terminal, params.id_star_system, params.id_category, params.item_uuid, params.item_name]
    .some(value => value !== '' && value !== null && value !== undefined);
  if (!hasTarget) {
    throw new Error('Informe um item, anúncio ou terminal para consultar o histórico.');
  }
  return unwrapRows(await uexInsightFetch('marketplace_prices_history', params));
}

export async function fetchDataMonitor(type = '') {
  requireUexCredentials();
  return unwrapRows(await uexInsightFetch('data_monitor', { type }));
}

export async function fetchCommodityAlerts(idCommodity = '') {
  return unwrapRows(await uexInsightFetch('commodities_alerts', { id_commodity: idCommodity }));
}

export async function fetchCommodityAverages(idCommodity) {
  requireUexCredentials();
  if (!idCommodity) throw new Error('Selecione uma commodity para consultar as médias.');
  return unwrapRows(await uexInsightFetch('commodities_averages', { id_commodity: idCommodity }));
}

export async function fetchCommodityStatus() {
  return unwrapRows(await uexInsightFetch('commodities_status'));
}

export async function fetchRefineryMethods() {
  return unwrapRows(await uexInsightFetch('refineries_methods'));
}

export async function fetchRefineryYields() {
  return unwrapRows(await uexInsightFetch('refineries_yields'));
}

export async function fetchRefineryCapacities() {
  return unwrapRows(await uexInsightFetch('refineries_capacities'));
}

export async function fetchUserRefineryJobs() {
  requireUexCredentials();
  return unwrapRows(await uexInsightFetch('user_refineries_jobs'));
}

export async function fetchVehicleLoaners(vehicleIdOrName) {
  const isId = Number.isFinite(Number(vehicleIdOrName)) && String(vehicleIdOrName).trim() !== '';
  return unwrapRows(await uexInsightFetch('vehicles_loaners', isId
    ? { id_vehicle: vehicleIdOrName }
    : { name: vehicleIdOrName }));
}

export async function fetchUserFleet() {
  requireUexCredentials();
  return unwrapRows(await uexInsightFetch('fleet'));
}

export async function fetchItemAttributes(filters = {}) {
  const params = {
    id_item: filters.idItem,
    id_category: filters.idCategory,
    uuid: filters.itemUuid,
  };
  if (!Object.values(params).some(value => value !== '' && value !== null && value !== undefined)) {
    throw new Error('Informe o ID ou nome do item para consultar atributos.');
  }
  return unwrapRows(await uexInsightFetch('items_attributes', params));
}

export async function fetchFuelPricesAll() {
  return unwrapRows(await uexInsightFetch('fuel_prices_all'));
}

export async function fetchTerminalDistance(origin, destination) {
  if (!origin || !destination) throw new Error('Informe os dois IDs de terminal para calcular a distância.');
  return unwrapRows(await uexInsightFetch('terminals_distances', {
    id_terminal_origin: origin,
    id_terminal_destination: destination,
  }));
}

export function qualityTierLabel(value) {
  return QUALITY_TIERS.find(tier => String(tier.value) === String(value))?.label || `Q${value}`;
}

export function formatUexDate(value) {
  if (!value) return '—';
  const date = new Date(Number(value) > 1e12 ? Number(value) : Number(value) * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

export function formatUec(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} aUEC`;
}

export function snapshotFreshness(snapshot, ttlHours = 24) {
  const time = Date.parse(snapshot?.syncedAt || '');
  if (!Number.isFinite(time)) return { label: 'Nunca sincronizado', tone: 'muted', stale: true, ageDays: null, ageLabel: 'sem data de atualização' };
  const ageHours = Math.max(0, (Date.now() - time) / 36e5);
  const ageDays = Math.floor(ageHours / 24);
  const ageLabel = ageDays === 0 ? 'atualizado hoje' : ageDays === 1 ? 'há 1 dia' : `há ${ageDays} dias`;
  if (ageHours > ttlHours) return { label: 'Dados antigos', tone: 'danger', stale: true, ageDays, ageLabel };
  if (ageHours > ttlHours * 0.75) return { label: 'Atualização recomendada', tone: 'warning', stale: false, ageDays, ageLabel };
  return { label: 'Dados recentes', tone: 'success', stale: false, ageDays, ageLabel };
}

export const UEX_INSIGHTS_EVENT = 'sc_uex_insights_updated';

export function publishUexInsightUpdate(key) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(UEX_INSIGHTS_EVENT, { detail: { key } }));
}

export async function syncInsight(key, endpoint, fetcher, meta = {}) {
  const data = await fetcher();
  const snapshot = saveUexInsight(key, data, { endpoint, ...meta });
  publishUexInsightUpdate(key);
  return snapshot;
}
