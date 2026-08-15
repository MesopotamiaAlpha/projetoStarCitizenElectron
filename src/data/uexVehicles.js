// Catálogo de veículos UEX e Meu Hangar local.
// A API UEX é consultada somente por HTTPS via window.electronAPI no Electron.
import { readJson, readStorage, writeJson } from '../utils/storage';

const UEX_BASE = 'https://api.uexcorp.uk/2.0';
const VEHICLE_CATALOG_KEY = 'sc_uex_vehicles_catalog_v1';
const LEGACY_VEHICLE_CATALOG_KEYS = Object.freeze([
  'sc_uex_vehicles_v1',
  'sc_uex_vehicle_catalog_v1',
  'sc_uex_live_vehicles_v1',
]);
const HANGAR_KEY = 'sc_hangar_v1';
let vehicleSyncPromise = null;

export const VEHICLE_CATALOG_VERSION = 1;
export const UEX_VEHICLES_UPDATED_EVENT = 'sc-uex-vehicles-updated';
export const MY_HANGAR_UPDATED_EVENT = 'sc-my-hangar-updated';

export const VEHICLE_ROLE_LABELS = Object.freeze({
  is_spaceship: 'Nave',
  is_ground_vehicle: 'Veículo terrestre',
  is_cargo: 'Carga',
  is_mining: 'Mineração',
  is_salvage: 'Salvamento',
  is_refinery: 'Refinaria',
  is_medical: 'Médica',
  is_exploration: 'Exploração',
  is_military: 'Militar',
  is_passenger: 'Passageiros',
  is_racing: 'Corrida',
  is_repair: 'Reparo',
  is_refuel: 'Reabastecimento',
  is_refinery: 'Refinaria',
  is_carrier: 'Porta-naves',
  is_datarunner: 'Data runner',
  is_science: 'Ciência',
  is_stealth: 'Stealth',
  is_construction: 'Construção',
  is_medical: 'Médica',
});

function storageGet(key, fallback) {
  return readJson(key, fallback);
}

function storageSet(key, value) {
  return writeJson(key, value);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function boolFlag(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function unwrapRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function loadToken() {
  return String(readStorage('sc_uex_token_v1', '') || '');
}

function loadSecretKey() {
  return String(readStorage('sc_uex_secretkey_v1', '') || '');
}

async function requestUex(endpoint) {
  const token = loadToken();
  const secretKey = loadSecretKey();

  if (window.electronAPI?.uexFetch) {
    const result = await window.electronAPI.uexFetch({ endpoint, token, secretKey });
    if (!result?.success) throw new Error(result?.message || `Falha ao consultar UEX: ${endpoint}`);
    return result.data;
  }

  const response = await fetch(`${UEX_BASE}/${endpoint}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`UEX HTTP ${response.status}`);
  const json = await response.json();
  if (json?.status && json.status !== 'ok') throw new Error(json.message || json.status);
  return json.data ?? json;
}

function normalizeVehicle(vehicle) {
  const result = { ...vehicle };
  for (const key of Object.keys(VEHICLE_ROLE_LABELS)) result[key] = boolFlag(vehicle?.[key]);
  for (const key of ['id', 'id_company', 'id_parent', 'scu', 'mass', 'width', 'height', 'length', 'fuel_quantum', 'fuel_hydrogen', 'date_added', 'date_modified']) {
    if (Object.prototype.hasOwnProperty.call(result, key)) result[key] = numberOrNull(result[key]);
  }
  result.name = String(vehicle?.name || vehicle?.name_full || 'Veículo sem nome').trim();
  result.name_full = String(vehicle?.name_full || result.name).trim();
  result.company_name = vehicle?.company_name || null;
  result.slug = vehicle?.slug || null;
  result.uuid = vehicle?.uuid || null;
  result.container_sizes = vehicle?.container_sizes || null;
  result.crew = vehicle?.crew || null;
  result.pad_type = vehicle?.pad_type || null;
  return result;
}

function normalizePurchaseRow(row) {
  return {
    ...row,
    id: numberOrNull(row?.id),
    id_vehicle: numberOrNull(row?.id_vehicle),
    id_terminal: numberOrNull(row?.id_terminal),
    price_buy: numberOrNull(row?.price_buy),
    price_buy_min: numberOrNull(row?.price_buy_min),
    price_buy_min_week: numberOrNull(row?.price_buy_min_week),
    price_buy_min_month: numberOrNull(row?.price_buy_min_month),
    price_buy_max: numberOrNull(row?.price_buy_max),
    price_buy_max_week: numberOrNull(row?.price_buy_max_week),
    price_buy_max_month: numberOrNull(row?.price_buy_max_month),
    price_buy_avg: numberOrNull(row?.price_buy_avg),
    price_buy_avg_week: numberOrNull(row?.price_buy_avg_week),
    price_buy_avg_month: numberOrNull(row?.price_buy_avg_month),
    vehicle_name: row?.vehicle_name || null,
    terminal_name: row?.terminal_name || null,
  };
}

function normalizeRentalRow(row) {
  return {
    ...row,
    id: numberOrNull(row?.id),
    id_vehicle: numberOrNull(row?.id_vehicle),
    id_terminal: numberOrNull(row?.id_terminal),
    price_rent: numberOrNull(row?.price_rent),
    price_rent_min: numberOrNull(row?.price_rent_min),
    price_rent_min_week: numberOrNull(row?.price_rent_min_week),
    price_rent_min_month: numberOrNull(row?.price_rent_min_month),
    price_rent_max: numberOrNull(row?.price_rent_max),
    price_rent_max_week: numberOrNull(row?.price_rent_max_week),
    price_rent_max_month: numberOrNull(row?.price_rent_max_month),
    price_rent_avg: numberOrNull(row?.price_rent_avg),
    price_rent_avg_week: numberOrNull(row?.price_rent_avg_week),
    price_rent_avg_month: numberOrNull(row?.price_rent_avg_month),
    vehicle_name: row?.vehicle_name || null,
    terminal_name: row?.terminal_name || null,
  };
}

export function loadVehicleCatalog() {
  const candidates = [
    storageGet(VEHICLE_CATALOG_KEY, null),
    ...LEGACY_VEHICLE_CATALOG_KEYS.map(key => storageGet(key, null)),
  ].filter(Boolean);
  const value = candidates.find(candidate => (
    Array.isArray(candidate) ||
    Array.isArray(candidate.vehicles) ||
    Array.isArray(candidate.data)
  ));
  if (!value) return null;
  const vehicles = Array.isArray(value) ? value : (value.vehicles || value.data || []);
  return {
    version: value.version || VEHICLE_CATALOG_VERSION,
    syncedAt: value.syncedAt || null,
    vehicles: Array.isArray(vehicles) ? vehicles : [],
    purchasePrices: Array.isArray(value.purchasePrices) ? value.purchasePrices : [],
    rentalPrices: Array.isArray(value.rentalPrices) ? value.rentalPrices : [],
  };
}

export function saveVehicleCatalog(catalog) {
  const normalized = {
    version: VEHICLE_CATALOG_VERSION,
    syncedAt: catalog?.syncedAt || new Date().toISOString(),
    vehicles: (catalog?.vehicles || []).map(normalizeVehicle),
    purchasePrices: (catalog?.purchasePrices || []).map(normalizePurchaseRow),
    rentalPrices: (catalog?.rentalPrices || []).map(normalizeRentalRow),
  };
  storageSet(VEHICLE_CATALOG_KEY, normalized);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UEX_VEHICLES_UPDATED_EVENT, { detail: normalized }));
  }
  return normalized;
}

/** Sincroniza somente endpoints documentados de veículos da UEX. */
export function syncUexVehicles() {
  // UEX Live e Hangar podem pedir a primeira sincronização ao mesmo tempo.
  // Compartilhar a Promise evita duas consultas simultâneas e duas gravações.
  if (vehicleSyncPromise) return vehicleSyncPromise;

  const promise = (async () => {
    const results = await Promise.allSettled([
      requestUex('vehicles'),
      requestUex('vehicles_purchases_prices_all'),
      requestUex('vehicles_rentals_prices_all'),
    ]);

    const previous = loadVehicleCatalog() || {};
    const failures = [];
    const [vehiclesResult, purchasesResult, rentalsResult] = results;
    for (const result of results) {
      if (result.status === 'rejected') failures.push(result.reason?.message || 'Falha desconhecida');
    }

    const catalog = saveVehicleCatalog({
      syncedAt: new Date().toISOString(),
      vehicles: vehiclesResult.status === 'fulfilled' ? unwrapRows(vehiclesResult.value) : previous.vehicles || [],
      purchasePrices: purchasesResult.status === 'fulfilled' ? unwrapRows(purchasesResult.value) : previous.purchasePrices || [],
      rentalPrices: rentalsResult.status === 'fulfilled' ? unwrapRows(rentalsResult.value) : previous.rentalPrices || [],
    });

    if (!catalog.vehicles.length && failures.length) throw new Error(failures.join(' · '));
    return { ...catalog, failures };
  })();

  vehicleSyncPromise = promise;
  return promise.finally(() => {
    if (vehicleSyncPromise === promise) vehicleSyncPromise = null;
  });
}

/**
 * Carrega o catálogo local e só consulta a UEX quando ele ainda não existe.
 * `force: true` é usado pelo botão explícito Atualizar da aba Veículos.
 */
export async function ensureVehicleCatalog({ force = false } = {}) {
  const localCatalog = loadVehicleCatalog();
  if (!force && localCatalog?.vehicles?.length) {
    return { ...localCatalog, failures: [], synced: false };
  }
  const syncedCatalog = await syncUexVehicles();
  return { ...syncedCatalog, synced: true };
}

/** Consulta preços detalhados de um veículo expandido na tela. */
export async function fetchVehicleLoaners(vehicleId) {
  const id = Number(vehicleId);
  if (!Number.isFinite(id)) throw new Error('ID de veículo inválido para consultar loaners.');
  return unwrapRows(await requestUex(`vehicles_loaners?id_vehicle=${encodeURIComponent(id)}`));
}

export async function fetchUserFleet() {
  if (!loadToken()) throw new Error('Configure o Bearer Token da UEX antes de consultar sua frota.');
  if (!loadSecretKey()) throw new Error('Configure a secret-key da UEX antes de consultar sua frota.');
  return unwrapRows(await requestUex('fleet'));
}

export async function fetchVehicleMarketDetails(vehicleId) {
  const id = Number(vehicleId);
  if (!Number.isFinite(id)) throw new Error('ID de veículo inválido.');
  const [purchaseResult, rentalResult] = await Promise.allSettled([
    requestUex(`vehicles_purchases_prices?id_vehicle=${encodeURIComponent(id)}`),
    requestUex(`vehicles_rentals_prices?id_vehicle=${encodeURIComponent(id)}`),
  ]);
  const purchases = purchaseResult.status === 'fulfilled' ? unwrapRows(purchaseResult.value).map(normalizePurchaseRow) : [];
  const rentals = rentalResult.status === 'fulfilled' ? unwrapRows(rentalResult.value).map(normalizeRentalRow) : [];
  const errors = [purchaseResult, rentalResult]
    .filter(result => result.status === 'rejected')
    .map(result => result.reason?.message || 'Falha de mercado');
  return { purchases, rentals, errors };
}

export function loadMyHangar() {
  const value = storageGet(HANGAR_KEY, []);
  return Array.isArray(value) ? value : [];
}

export function saveMyHangar(entries) {
  const normalized = (Array.isArray(entries) ? entries : []).map(entry => {
    const source = entry.source === 'wikelo' ? 'wikelo' : 'compra';
    const quantity = Math.max(1, Number(entry.quantity) || 1);
    const legacyUnitPrice = numberOrNull(entry.unitPriceAuec ?? entry.purchasePriceAuec ?? entry.priceAuec ?? entry.price_auec);
    const storedTotal = numberOrNull(entry.totalCostAuec ?? entry.total_cost_auec);
    const legacyTotal = (legacyUnitPrice ?? 0) * quantity;
    // Registros antigos podem ter totalCostAuec=0 mesmo contendo o preço unitário.
    const preferredTotal = storedTotal !== null && storedTotal > 0 ? storedTotal : legacyTotal;
    const totalCostAuec = source === 'compra' ? Math.max(0, preferredTotal) : 0;
    const unitPriceAuec = source === 'compra' && totalCostAuec > 0
      ? totalCostAuec / quantity
      : (source === 'compra' ? legacyUnitPrice : null);
    return {
      id: entry.id || `${entry.vehicleId || 'manual'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      vehicleId: numberOrNull(entry.vehicleId),
      vehicleName: String(entry.vehicleName || 'Nave sem nome').trim(),
      manufacturer: entry.manufacturer || null,
      source,
      edition: source === 'wikelo' ? 'wikelo' : 'purchase',
      editionLabel: source === 'wikelo' ? 'Edição Wikelo' : 'Comprada',
      quantity,
      unitPriceAuec,
      totalCostAuec,
      acquiredAt: entry.acquiredAt || new Date().toISOString(),
      notes: entry.notes || '',
      image: entry.image || null,
      scu: numberOrNull(entry.scu),
      crew: entry.crew || null,
      slug: entry.slug || null,
    };
  });
  
  storageSet(HANGAR_KEY, normalized);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MY_HANGAR_UPDATED_EVENT, { detail: normalized }));
  }
  return normalized;
}

export function addToMyHangar(vehicle, options = {}) {
  const current = loadMyHangar();
  const source = options.source === 'wikelo' ? 'wikelo' : 'compra';
  const vehicleId = numberOrNull(vehicle?.id ?? options.vehicleId);
  const key = `${source}:${vehicleId ?? String(vehicle?.name || options.vehicleName || '').trim().toLowerCase()}`;
  const existingIndex = current.findIndex(entry => `${entry.source}:${entry.vehicleId ?? entry.vehicleName.toLowerCase()}` === key);
  const quantity = Math.max(1, Number(options.quantity) || 1);
  const unitPriceAuec = source === 'compra' ? numberOrNull(options.unitPriceAuec ?? options.purchasePriceAuec) : null;
  const addedCostAuec = source === 'compra' && unitPriceAuec !== null ? Math.max(0, unitPriceAuec) * quantity : 0;
  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    const previousQuantity = Math.max(1, Number(existing.quantity) || 1);
    const previousTotal = source === 'compra'
      ? Math.max(0, Number(existing.totalCostAuec) || ((Number(existing.unitPriceAuec) || 0) * previousQuantity))
      : 0;
    const nextQuantity = previousQuantity + quantity;
    const nextTotal = previousTotal + addedCostAuec;
    current[existingIndex] = {
      ...existing,
      quantity: nextQuantity,
      unitPriceAuec: source === 'compra' && nextTotal > 0 ? nextTotal / nextQuantity : existing.unitPriceAuec || null,
      totalCostAuec: source === 'compra' ? nextTotal : 0,
      notes: options.notes || existing.notes,
    };
  } else {
    current.push({
      id: `${vehicleId ?? 'manual'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      vehicleId,
      vehicleName: options.vehicleName || vehicle?.name_full || vehicle?.name || 'Nave sem nome',
      manufacturer: options.manufacturer || vehicle?.company_name || null,
      source,
      edition: source === 'wikelo' ? 'wikelo' : 'purchase',
      editionLabel: source === 'wikelo' ? 'Edição Wikelo' : 'Comprada',
      quantity,
      unitPriceAuec: source === 'compra' ? unitPriceAuec : null,
      totalCostAuec: source === 'compra' ? addedCostAuec : 0,
      acquiredAt: options.acquiredAt || new Date().toISOString(),
      notes: options.notes || '',
      image: options.image || vehicle?.url_photo || null,
      scu: numberOrNull(options.scu ?? vehicle?.scu),
      crew: options.crew || vehicle?.crew || null,
      slug: options.slug || vehicle?.slug || null,
    });
  }
  return saveMyHangar(current);
}

export function updateMyHangarEntry(id, changes) {
  const current = loadMyHangar();
  return saveMyHangar(current.map(entry => entry.id === id ? { ...entry, ...changes } : entry));
}

export function removeFromMyHangar(id) {
  return saveMyHangar(loadMyHangar().filter(entry => entry.id !== id));
}

export function getVehicleRoles(vehicle) {
  return Object.entries(VEHICLE_ROLE_LABELS)
    .filter(([key]) => boolFlag(vehicle?.[key]))
    .map(([, label]) => label);
}

export function getPurchaseRows(catalog, vehicleId) {
  return (catalog?.purchasePrices || []).filter(row => Number(row.id_vehicle) === Number(vehicleId));
}

/** Retorna a média do preço de compra disponível no catálogo UEX local. */
export function getVehiclePurchaseAverage(catalog, vehicleId) {
  const values = getPurchaseRows(catalog, vehicleId)
    .map(row => row.price_buy_avg ?? row.price_buy)
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0);
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function getRentalRows(catalog, vehicleId) {
  return (catalog?.rentalPrices || []).filter(row => Number(row.id_vehicle) === Number(vehicleId));
}

export function getPurchasedAuecTotal(entries = loadMyHangar(), catalog = null) {
  return (Array.isArray(entries) ? entries : [])
    .filter(entry => entry?.source !== 'wikelo')
    .reduce((total, entry) => {
      const quantity = Math.max(0, Number(entry?.quantity) || 0);
      const storedTotal = Number(entry?.totalCostAuec);
      const legacyUnitPrice = Number(entry?.unitPriceAuec ?? entry?.purchasePriceAuec ?? entry?.priceAuec ?? entry?.price_auec);
      const legacyTotal = Number.isFinite(legacyUnitPrice) ? legacyUnitPrice * quantity : 0;
      const catalogAverage = catalog ? getVehiclePurchaseAverage(catalog, entry?.vehicleId) : null;
      const catalogTotal = Number.isFinite(catalogAverage) ? catalogAverage * quantity : 0;
      const usableTotal = Number.isFinite(storedTotal) && storedTotal > 0 ? storedTotal : (legacyTotal > 0 ? legacyTotal : catalogTotal);
      return total + (Number.isFinite(usableTotal) ? Math.max(0, usableTotal) : 0);
    }, 0);
}

export function getCatalogStats(catalog) {
  const vehicles = catalog?.vehicles || [];
  const owned = loadMyHangar();
  return {
    vehicles: vehicles.length,
    spaceships: vehicles.filter(vehicle => vehicle.is_spaceship).length,
    groundVehicles: vehicles.filter(vehicle => vehicle.is_ground_vehicle).length,
    purchaseOffers: (catalog?.purchasePrices || []).length,
    rentalOffers: (catalog?.rentalPrices || []).length,
    ownedTypes: owned.length,
    ownedUnits: owned.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0),
    purchasedAuecTotal: getPurchasedAuecTotal(owned, catalog),
  };
}

export { VEHICLE_CATALOG_KEY, HANGAR_KEY };
