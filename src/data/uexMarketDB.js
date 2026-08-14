import {
  UEX_INSIGHTS_KEYS,
  fetchMarketplaceAveragesAll,
  loadUexInsight,
  publishUexInsightUpdate,
  saveUexInsight,
  syncInsight,
} from './uexInsights';

export const MARKET_PRICES_KEY = UEX_INSIGHTS_KEYS.marketplaceAverages;
export const UEX_MARKET_PRICES_UPDATED_EVENT = 'sc_uex_market_prices_updated';

function rowsFromSnapshot(snapshot) {
  return Array.isArray(snapshot?.data) ? snapshot.data : (Array.isArray(snapshot) ? snapshot : []);
}

export function loadMarketPrices() {
  return rowsFromSnapshot(loadUexInsight(MARKET_PRICES_KEY, []));
}

export function saveMarketPrices(rows) {
  const snapshot = saveUexInsight(MARKET_PRICES_KEY, Array.isArray(rows) ? rows : [], { endpoint: 'marketplace_prices_averages_all', ttl: '1h' });
  publishUexInsightUpdate(MARKET_PRICES_KEY);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(UEX_MARKET_PRICES_UPDATED_EVENT));
  return snapshot.data;
}

export async function syncMarketPrices() {
  const snapshot = await syncInsight(MARKET_PRICES_KEY, 'marketplace_prices_averages_all', fetchMarketplaceAveragesAll, { ttl: '1h' });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(UEX_MARKET_PRICES_UPDATED_EVENT));
  return snapshot.data;
}

export function getItemMarketPrice(idItem, qualityTier = null, operation = null, currency = null) {
  const rows = loadMarketPrices();
  const sameItem = rows.filter(row => String(row.id_item ?? row.idItem) === String(idItem));
  const exact = sameItem.find(row =>
    (qualityTier === null || qualityTier === undefined || qualityTier === '' || String(row.quality_tier) === String(qualityTier)) &&
    (!operation || String(row.operation).toLowerCase() === String(operation).toLowerCase()) &&
    (!currency || String(row.currency).toLowerCase() === String(currency).toLowerCase())
  );
  return exact || sameItem.find(row => !operation || String(row.operation).toLowerCase() === String(operation).toLowerCase()) || null;
}

export function getMarketPriceForName(itemName, qualityTier = null, operation = null) {
  const rows = loadMarketPrices();
  const normalized = String(itemName || '').trim().toLowerCase();
  return rows.find(row => String(row.item_name || '').trim().toLowerCase() === normalized &&
    (qualityTier === null || qualityTier === '' || String(row.quality_tier) === String(qualityTier)) &&
    (!operation || String(row.operation).toLowerCase() === String(operation).toLowerCase())) || null;
}
