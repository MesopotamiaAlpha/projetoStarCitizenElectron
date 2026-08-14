import { unwrapRows, uexInsightFetch } from './uexInsights';

export const MARKET_ALERTS_KEY = 'sc_uex_market_alerts_v1';
export const MARKET_ALERT_EVENTS_KEY = 'sc_uex_market_alert_events_v1';
export const MARKET_ALERTS_UPDATED_EVENT = 'sc_uex_market_alerts_updated';
export const MARKET_ALERTS_CHECKED_EVENT = 'sc_uex_market_alerts_checked';
export const MARKET_ALERT_FOCUS_KEY = 'sc_uex_market_alert_focus_v1';
export const MARKET_ALERT_SETTINGS_KEY = 'sc_uex_market_alert_settings_v1';
export const MARKET_ALERT_DISMISSED_KEY = 'sc_uex_market_alert_dismissed_v1';
export const MARKET_ALERT_SETTINGS_UPDATED_EVENT = 'sc_uex_market_alert_settings_updated';
export const DEFAULT_MARKET_ALERT_INTERVAL_MINUTES = 15;
export const MIN_MARKET_ALERT_INTERVAL_MINUTES = 1;
export const MAX_MARKET_ALERT_INTERVAL_MINUTES = 1440;
export const MARKET_ALERT_MAX_EVENTS = 500;
export const MARKET_ALERT_SEEN_KEYS_LIMIT = 500;
export const DEFAULT_MARKET_ALERT_MAX_RESULTS = 5;
export const MIN_MARKET_ALERT_MAX_RESULTS = 1;
export const MAX_MARKET_ALERT_MAX_RESULTS = 50;

export const MARKET_ALERT_MANUAL_MATCH_MODES = Object.freeze([
  { value: 'title', label: 'Específica — nome e título', description: 'Procura o termo somente no nome, título ou slug do anúncio.' },
  { value: 'broad', label: 'Ampla — nome, título e descrição', description: 'Também procura o termo dentro da descrição, podendo encontrar itens que usam esse material.' },
]);

export const MARKET_ALERT_SOURCES = Object.freeze([
  { value: '', label: 'Qualquer origem' },
  { value: 'looted', label: 'Lootado' },
  { value: 'purchased_in_game', label: 'Comprado in-game' },
  { value: 'crafted', label: 'Craftado' },
  { value: 'gifted', label: 'Presente' },
  { value: 'pledged', label: 'Pledge' },
  { value: 'pirated', label: 'Piratado' },
]);

function getStorage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

function readJson(key, fallback) {
  try {
    const raw = getStorage()?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function writeJson(key, value) {
  try { getStorage()?.setItem(key, JSON.stringify(value)); } catch { /* armazenamento local indisponível */ }
  return value;
}

function emit(name, detail = {}) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch { /* ambiente sem eventos */ }
}

function createId() {
  try { return crypto.randomUUID(); } catch { return `market-alert-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

function numberValue(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (value === null || value === undefined || value === '') return fallback;
  const text = String(value).trim().replace(/[^0-9,.-]/g, '');
  if (!text) return fallback;
  const normalized = text.includes(',') && text.includes('.')
    ? (text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, ''))
    : text.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSource(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeItemSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeManualMatchMode(value) {
  return value === 'broad' ? 'broad' : 'title';
}

export function manualMatchModeLabel(value) {
  return MARKET_ALERT_MANUAL_MATCH_MODES.find(mode => mode.value === normalizeManualMatchMode(value))?.label || MARKET_ALERT_MANUAL_MATCH_MODES[0].label;
}

function containsNormalizedPhrase(text, phrase) {
  const haystack = normalizeItemSearch(text);
  const needle = normalizeItemSearch(phrase);
  if (!haystack || !needle) return false;
  const haystackWords = haystack.split(' ');
  const needleWords = needle.split(' ');
  return haystackWords.some((_, index) => needleWords.every((word, offset) => haystackWords[index + offset] === word));
}

function manualMatchFields(listing = {}) {
  return {
    title: [
      listingItemName(listing),
      listing.title,
      listing.slug,
      listing.listing_slug,
      listing.item?.name,
    ].filter(Boolean).join(' '),
    description: [listing.description, listing.item?.description].filter(Boolean).join(' '),
  };
}

export function listingManualMatchReason(alert, listing) {
  const fields = manualMatchFields(listing);
  if (containsNormalizedPhrase(fields.title, alert?.itemName)) return 'Nome/título do anúncio';
  if (normalizeManualMatchMode(alert?.manualMatchMode) === 'broad' && containsNormalizedPhrase(fields.description, alert?.itemName)) return 'Descrição do anúncio';
  return null;
}

export function listingItemName(row = {}) {
  return String(row.item_name || row.itemName || row.item?.name || row.name || row.title || '').trim();
}

function listingMatchesManualItem(alert, listing) {
  return Boolean(listingManualMatchReason(alert, listing));
}

function titleQuality1000(row) {
  const text = String(row?.title || row?.description || '');
  const match = text.match(/(?:q|qualidade\s*[:#-]?)\s*(\d{1,4})\b/i);
  return match ? Math.min(1000, Math.max(0, Number(match[1]))) : null;
}

export function listingQuality1000(row) {
  const direct = numberValue(row?.quality, NaN);
  if (Number.isFinite(direct)) return direct <= 100 ? Math.round(direct * 10) : Math.min(1000, Math.max(0, direct));
  const tier = numberValue(row?.quality_tier, NaN);
  if (Number.isFinite(tier)) {
    const bounds = [[0, 0], [1, 499], [500, 599], [600, 699], [700, 799], [800, 899], [900, 949], [950, 1000]][Math.max(0, Math.min(7, tier))];
    return Math.round((bounds[0] + bounds[1]) / 2);
  }
  return titleQuality1000(row);
}

export function listingPrice(row) {
  return numberValue(row?.price, numberValue(row?.price_auec, 0));
}

export function listingDateAddedMs(row) {
  const raw = row?.date_added || row?.dateAdded || row?.created_at;
  if (!raw) return null;
  const numeric = numberValue(raw, NaN);
  if (Number.isFinite(numeric)) return numeric < 100000000000 ? numeric * 1000 : numeric;
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : null;
}

export function listingAgeDays(row, now = Date.now()) {
  const addedAt = listingDateAddedMs(row);
  if (!addedAt) return null;
  return Math.max(0, (now - addedAt) / 86400000);
}

export function listingKey(row) {
  const explicit = row?.id || row?.id_listing || row?.listing_id || row?.id_marketplace_listing;
  if (explicit !== null && explicit !== undefined && String(explicit).trim()) return `id:${String(explicit).trim()}`;
  const stable = [
    row?.slug || row?.listing_slug || '',
    row?.id_item || row?.item_id || row?.item_uuid || '',
    row?.user_username || row?.user_name || row?.username || '',
    row?.date_added || row?.dateAdded || row?.created_at || '',
  ].map(value => String(value || '').trim()).join('|');
  return `fallback:${stable || JSON.stringify(row || {})}`;
}

export function marketAlertGroupKey(value = {}) {
  if (value.groupKey) return String(value.groupKey);
  const itemId = value.itemId || value.alertItemId || value.listing?.id_item || value.listing?.item_id;
  if (itemId !== null && itemId !== undefined && String(itemId).trim()) return `item:${String(itemId).trim()}`;
  return `name:${normalizeItemSearch(value.groupName || value.alertName || value.itemName || listingItemName(value.listing || {}) || 'Item UEX')}`;
}

export function marketAlertGroupName(value = {}) {
  return String(value.groupName || value.alertName || value.itemName || listingItemName(value.listing || {}) || 'Item UEX').trim();
}

export function buildMarketListingUrl(listing = {}) {
  const direct = listing.url || listing.link || listing.listing_url || listing.url_listing;
  if (direct && /^https?:\/\//i.test(String(direct))) return String(direct);
  const raw = String(listing.slug || listing.listing_slug || '').trim();
  if (!raw) return 'https://uexcorp.space/marketplace/';
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^\/+|\/+$/g, '');
  if (clean.startsWith('marketplace/item/info/')) return `https://uexcorp.space/${clean}/`;
  if (clean.startsWith('item/info/')) return `https://uexcorp.space/marketplace/${clean}/`;
  return `https://uexcorp.space/marketplace/item/info/${clean}/`;
}

function clampIntervalMinutes(value) {
  const parsed = numberValue(value, DEFAULT_MARKET_ALERT_INTERVAL_MINUTES);
  return Math.max(MIN_MARKET_ALERT_INTERVAL_MINUTES, Math.min(MAX_MARKET_ALERT_INTERVAL_MINUTES, Math.round(parsed)));
}

function clampMaxResults(value) {
  const parsed = numberValue(value, DEFAULT_MARKET_ALERT_MAX_RESULTS);
  return Math.max(MIN_MARKET_ALERT_MAX_RESULTS, Math.min(MAX_MARKET_ALERT_MAX_RESULTS, Math.round(parsed)));
}

export function loadMarketAlertSettings() {
  const stored = readJson(MARKET_ALERT_SETTINGS_KEY, {});
  const intervalMinutes = clampIntervalMinutes(stored?.intervalMinutes);
  const automaticEnabled = stored?.automaticEnabled !== false;
  const nextCheckAt = automaticEnabled && Number(stored?.nextCheckAt) > 0 ? Number(stored.nextCheckAt) : null;
  const lastCheckAt = Number(stored?.lastCheckAt) > 0 ? Number(stored.lastCheckAt) : null;
  return { intervalMinutes, automaticEnabled, nextCheckAt, lastCheckAt };
}

export function saveMarketAlertSettings(settings = {}) {
  const current = loadMarketAlertSettings();
  const intervalMinutes = clampIntervalMinutes(settings.intervalMinutes ?? current.intervalMinutes);
  const automaticEnabled = settings.automaticEnabled ?? current.automaticEnabled;
  const nextCheckAt = automaticEnabled && Number(settings.nextCheckAt) > 0 ? Number(settings.nextCheckAt) : null;
  const lastCheckAt = Number(settings.lastCheckAt) > 0 ? Number(settings.lastCheckAt) : current.lastCheckAt;
  const safe = { intervalMinutes, automaticEnabled, nextCheckAt, lastCheckAt };
  writeJson(MARKET_ALERT_SETTINGS_KEY, safe);
  emit(MARKET_ALERT_SETTINGS_UPDATED_EVENT, safe);
  return safe;
}

export function loadDismissedMarketAlertKeys() {
  const stored = readJson(MARKET_ALERT_DISMISSED_KEY, []);
  return new Set(Array.isArray(stored) ? stored.map(String).slice(-200) : []);
}

export function dismissMarketAlertEvent(eventKey) {
  const keys = loadDismissedMarketAlertKeys();
  keys.add(String(eventKey || ''));
  writeJson(MARKET_ALERT_DISMISSED_KEY, Array.from(keys).filter(Boolean).slice(-200));
  emit(MARKET_ALERTS_UPDATED_EVENT, { dismissedEventKey: String(eventKey || '') });
}

export function marketAlertDefaults(overrides = {}) {
  return {
    id: createId(),
    enabled: true,
    itemId: overrides.itemId ? String(overrides.itemId) : '',
    itemName: String(overrides.itemName || '').trim(),
    itemMode: overrides.itemMode === 'manual' ? 'manual' : 'catalog',
    manualMatchMode: normalizeManualMatchMode(overrides.manualMatchMode),
    currency: 'UEC',
    source: String(overrides.source || '').trim(),
    qualityAny: overrides.qualityAny !== false,
    qualityMin: Math.max(0, Math.min(1000, numberValue(overrides.qualityMin, 0))),
    qualityMax: Math.max(0, Math.min(1000, numberValue(overrides.qualityMax, 1000))),
    priceMode: overrides.priceMode === 'lowest' ? 'lowest' : overrides.priceMode === 'range' ? 'range' : 'limit',
    minPrice: Math.max(0, numberValue(overrides.minPrice, 0)),
    maxPrice: Math.max(0, numberValue(overrides.maxPrice, 0)),
    maxListingAgeDays: Math.max(0, Math.min(3650, numberValue(overrides.maxListingAgeDays, 0))),
    maxResults: clampMaxResults(overrides.maxResults),
    lastCheckedAt: null,
    lastMatchAt: null,
    lastMatchCount: 0,
    seenKeys: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function loadMarketAlerts() {
  const rows = readJson(MARKET_ALERTS_KEY, []);
  return Array.isArray(rows) ? rows.map(row => ({ ...marketAlertDefaults(row), ...row, seenKeys: Array.isArray(row.seenKeys) ? row.seenKeys.slice(-MARKET_ALERT_SEEN_KEYS_LIMIT) : [] })) : [];
}

export function saveMarketAlerts(alerts) {
  const safe = (Array.isArray(alerts) ? alerts : []).map(row => ({
    ...marketAlertDefaults(row),
    ...row,
    itemName: String(row.itemName || '').trim(),
    seenKeys: Array.isArray(row.seenKeys) ? row.seenKeys.slice(-MARKET_ALERT_SEEN_KEYS_LIMIT) : [],
    updatedAt: new Date().toISOString(),
  }));
  writeJson(MARKET_ALERTS_KEY, safe);
  emit(MARKET_ALERTS_UPDATED_EVENT, { alerts: safe });
  return safe;
}

export function upsertMarketAlert(alert) {
  const current = loadMarketAlerts();
  const normalized = { ...marketAlertDefaults(alert), ...alert, updatedAt: new Date().toISOString() };
  const index = current.findIndex(row => row.id === normalized.id);
  if (index >= 0) current[index] = normalized;
  else current.unshift(normalized);
  return saveMarketAlerts(current);
}

export function removeMarketAlert(id) {
  return saveMarketAlerts(loadMarketAlerts().filter(row => row.id !== id));
}

export function removeMarketAlertEventsByGroup(groupKey) {
  const target = String(groupKey || '');
  if (!target) return loadMarketAlertEvents();
  const current = readJson(MARKET_ALERT_EVENTS_KEY, []);
  const removedKeys = loadMarketAlertEvents().filter(event => event.groupKey === target).flatMap(event => [event.key, event.originalKey]).filter(Boolean);
  const dismissed = loadDismissedMarketAlertKeys();
  removedKeys.forEach(key => dismissed.add(String(key)));
  writeJson(MARKET_ALERT_DISMISSED_KEY, Array.from(dismissed).filter(Boolean).slice(-200));
  const safe = Array.isArray(current) ? current.filter(event => !removedKeys.includes(String(event.key || ''))) : [];
  writeJson(MARKET_ALERT_EVENTS_KEY, safe);
  emit(MARKET_ALERTS_UPDATED_EVENT, { dismissedGroupKey: target, dismissedEventKeys: removedKeys });
  return loadMarketAlertEvents();
}

export function loadMarketAlertEvents() {
  const rows = readJson(MARKET_ALERT_EVENTS_KEY, []);
  const dismissed = loadDismissedMarketAlertKeys();
  if (!Array.isArray(rows)) return [];
  const unique = new Set();
  return rows.map(row => {
    const migratedKey = row?.listing ? listingKey(row.listing) : String(row?.key || '');
    return {
      ...row,
      originalKey: String(row?.key || ''),
      key: migratedKey || String(row?.key || ''),
      itemId: row.itemId || row.listing?.id_item || row.listing?.item_id || null,
      groupKey: marketAlertGroupKey(row),
      groupName: marketAlertGroupName(row),
    };
  }).filter(row => {
    if (dismissed.has(String(row.key || '')) || dismissed.has(String(row.originalKey || ''))) return false;
    if (!row.key || unique.has(row.key)) return false;
    unique.add(row.key);
    return true;
  }).slice(0, MARKET_ALERT_MAX_EVENTS);
}

export function focusMarketAlert(eventKey) {
  const focus = { eventKey: String(eventKey || ''), focusedAt: Date.now() };
  writeJson(MARKET_ALERT_FOCUS_KEY, focus);
  emit(MARKET_ALERTS_UPDATED_EVENT, { focus });
  return focus;
}

export function loadMarketAlertFocus() {
  return readJson(MARKET_ALERT_FOCUS_KEY, null);
}

function saveMarketAlertEvents(events) {
  const safe = (Array.isArray(events) ? events : []).slice(0, MARKET_ALERT_MAX_EVENTS);
  writeJson(MARKET_ALERT_EVENTS_KEY, safe);
  return safe;
}

function sourceMatches(alert, listing) {
  return !alert.source || normalizeSource(listing?.source) === normalizeSource(alert.source);
}

function qualityMatches(alert, listing) {
  if (alert.qualityAny) return true;
  const quality = listingQuality1000(listing);
  if (quality === null) return false;
  return quality >= numberValue(alert.qualityMin, 0) && quality <= numberValue(alert.qualityMax, 1000);
}

export function listingMatchesAlert(alert, listing) {
  if (!listing || Number(listing.is_sold_out) === 1) return false;
  if (listing.operation && String(listing.operation).toLowerCase() !== 'sell') return false;
  if (listing.currency && String(listing.currency).toUpperCase() !== 'UEC') return false;
  if (!sourceMatches(alert, listing) || !qualityMatches(alert, listing)) return false;
  const maxListingAgeDays = numberValue(alert.maxListingAgeDays, 0);
  if (maxListingAgeDays > 0) {
    const ageDays = listingAgeDays(listing);
    if (ageDays === null || ageDays > maxListingAgeDays) return false;
  }
  const price = listingPrice(listing);
  if (price <= 0) return false;
  if (alert.priceMode === 'limit' && numberValue(alert.maxPrice, 0) > 0 && price > numberValue(alert.maxPrice, 0)) return false;
  if (alert.priceMode === 'range') {
    const minPrice = numberValue(alert.minPrice, 0);
    const maxPrice = numberValue(alert.maxPrice, 0);
    if (minPrice > 0 && price < minPrice) return false;
    if (maxPrice > 0 && price > maxPrice) return false;
  }
  return true;
}

function eventFromListing(alert, listing) {
  const quality = listingQuality1000(listing);
  const price = listingPrice(listing);
  const matchReason = alert.itemMode === 'manual'
    ? listingManualMatchReason(alert, listing)
    : 'Catálogo UEX por ID do item';
  return {
    id: createId(),
    key: listingKey(listing),
    kind: 'market-alert',
    alertId: alert.id,
    alertName: alert.itemName || listing.title || 'Alerta de mercado',
    itemId: alert.itemId || listing.id_item || listing.item_id || null,
    maxResults: clampMaxResults(alert.maxResults),
    groupKey: marketAlertGroupKey(alert.itemId ? { itemId: alert.itemId, itemName: alert.itemName } : { groupName: alert.itemName }),
    groupName: marketAlertGroupName({ itemName: alert.itemName, listing }),
    listingId: listing.id || listing.id_listing || null,
    listingSlug: listing.slug || listing.listing_slug || '',
    listingUrl: buildMarketListingUrl(listing),
    itemName: listingItemName(listing) || alert.itemName || 'Item UEX',
    price,
    currency: 'UEC',
    quality,
    listingAgeDays: listingAgeDays(listing),
    source: listing.source || '',
    matchMode: alert.itemMode === 'manual' ? normalizeManualMatchMode(alert.manualMatchMode) : 'catalog',
    matchReason: matchReason || 'Correspondência do anúncio',
    location: listing.location || listing.terminal_name || '',
    seller: listing.user_username || listing.user_name || '',
    listing,
    dateAdded: Date.now(),
  };
}

export async function fetchMarketListingsForAlert(alert) {
  const itemId = String(alert?.itemId || '').trim();
  const itemName = String(alert?.itemName || '').trim();
  if (!itemId && !itemName) throw new Error('Selecione um item do catálogo ou informe o nome manualmente.');
  const params = { operation: 'sell' };
  if (itemId) params.id_item = itemId;
  const data = await uexInsightFetch('marketplace_listings', params);
  const rows = unwrapRows(data);
  return itemId ? rows : rows.filter(listing => listingMatchesManualItem(alert, listing));
}

export async function checkMarketAlerts({ silent = true, automatic = false } = {}) {
  const checkTimestamp = Date.now();
  const alerts = loadMarketAlerts().filter(row => row.enabled && (row.itemId || String(row.itemName || '').trim()));
  const settings = loadMarketAlertSettings();
  if (automatic && !settings.automaticEnabled) {
    return { newEvents: [], checkedAt: new Date(checkTimestamp).toISOString(), checkedAlerts: 0, skipped: true, reason: 'A análise automática está desligada.' };
  }
  const nextCheckAt = settings.automaticEnabled ? checkTimestamp + settings.intervalMinutes * 60 * 1000 : null;
  if (!alerts.length) {
    saveMarketAlertSettings({ lastCheckAt: checkTimestamp, nextCheckAt });
    return { newEvents: [], checkedAt: new Date(checkTimestamp).toISOString(), checkedAlerts: 0 };
  }
  const previousEvents = loadMarketAlertEvents();
  const previousKeys = new Set(previousEvents.map(row => row.key));
  const knownListingIds = new Set(previousEvents.map(row => row.listingId).filter(value => value !== null && value !== undefined).map(String));
  const dismissedKeys = loadDismissedMarketAlertKeys();
  const seenKeysThisCheck = new Set(previousKeys);
  const newEvents = [];
  const checkedAt = new Date(checkTimestamp).toISOString();
  const nextAlerts = loadMarketAlerts().map(row => ({ ...row }));

  for (const alert of alerts) {
    try {
      const listings = await fetchMarketListingsForAlert(alert);
      const matches = listings
        .filter(listing => listingMatchesAlert(alert, listing))
        .sort((a, b) => listingPrice(a) - listingPrice(b));
      const bestMatches = matches.slice(0, clampMaxResults(alert.maxResults));
      const target = nextAlerts.find(row => row.id === alert.id);
      if (target) {
        target.lastCheckedAt = checkedAt;
        target.lastMatchCount = bestMatches.length;
        if (bestMatches.length) target.lastMatchAt = checkedAt;
        target.seenKeys = Array.isArray(target.seenKeys) ? target.seenKeys : [];
      }
      bestMatches.forEach(listing => {
        const event = eventFromListing(alert, listing);
        if (target && target.seenKeys.includes(event.key)) return;
        if (dismissedKeys.has(event.key)) return;
        if (seenKeysThisCheck.has(event.key)) return;
        if (event.listingId !== null && event.listingId !== undefined && knownListingIds.has(String(event.listingId))) return;
        newEvents.push(event);
        seenKeysThisCheck.add(event.key);
        if (target) target.seenKeys = [...target.seenKeys, event.key].slice(-MARKET_ALERT_SEEN_KEYS_LIMIT);
      });
    } catch (error) {
      const target = nextAlerts.find(row => row.id === alert.id);
      if (target) {
        target.lastCheckedAt = checkedAt;
        target.lastError = error.message || 'Falha ao consultar anúncios.';
      }
      if (!silent) throw error;
    }
  }

  saveMarketAlerts(nextAlerts);
  const groupLimits = new Map();
  alerts.forEach(alert => {
    const key = marketAlertGroupKey(alert.itemId ? { itemId: alert.itemId, itemName: alert.itemName } : { groupName: alert.itemName });
    groupLimits.set(key, Math.max(groupLimits.get(key) || 0, clampMaxResults(alert.maxResults)));
  });
  const eventsByGroup = new Map();
  [...newEvents, ...previousEvents].forEach(event => {
    const key = event.groupKey || marketAlertGroupKey(event);
    const rows = eventsByGroup.get(key) || [];
    rows.push(event);
    if (!groupLimits.has(key)) groupLimits.set(key, clampMaxResults(event.maxResults));
    eventsByGroup.set(key, rows);
  });
  const limitedEvents = Array.from(eventsByGroup.entries()).flatMap(([key, rows]) => rows
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0) || Number(b.dateAdded || 0) - Number(a.dateAdded || 0))
    .slice(0, groupLimits.get(key) || DEFAULT_MARKET_ALERT_MAX_RESULTS));
  saveMarketAlertEvents(limitedEvents);
  saveMarketAlertSettings({ lastCheckAt: checkTimestamp, nextCheckAt });
  emit(MARKET_ALERTS_CHECKED_EVENT, { newEvents, checkedAt, nextCheckAt });
  return { newEvents, checkedAt, checkedAlerts: alerts.length };
}
