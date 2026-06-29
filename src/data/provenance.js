// ── Provenance System ─────────────────────────────────────────────────────────
// Tracks the origin (source) and import timestamp of any data in the app.
// Sources: 'manual' | 'uex_api' | 'seed' | 'custom'
//
// Usage:
//   import { setProvenance, getProvenance, SOURCES } from '../data/provenance';
//   setProvenance('commodity', 'Quantainium', SOURCES.UEX_API);
//   const p = getProvenance('commodity', 'Quantainium');
//   // { source: 'uex_api', label: 'UEX Corp API', color: '#ffc436', importedAt: '2026-06-14T...', version: '4.8.1' }

const KEY = 'sc_provenance_v1';

export const SOURCES = {
  UEX_API:  'uex_api',
  SEED:     'seed',
  MANUAL:   'manual',
  CUSTOM:   'custom',
};

export const SOURCE_META = {
  uex_api: {
    label:     'UEX Corp API',
    shortLabel:'UEX',
    color:     '#ffc436',
    bgColor:   'rgba(255,196,54,0.12)',
    border:    'rgba(255,196,54,0.35)',
    icon:      'globe',
    url:       'https://uexcorp.space',
    desc:      'Dados importados da UEX Corp API 2.0 — comunidade Star Citizen',
  },
  seed: {
    label:     'Banco de Dados Local',
    shortLabel:'DB',
    color:     '#00d4ff',
    bgColor:   'rgba(0,212,255,0.10)',
    border:    'rgba(0,212,255,0.30)',
    icon:      'database',
    url:       null,
    desc:      'Dados do banco de dados local do SC Armor Tracker',
  },
  manual: {
    label:     'Inserido Manualmente',
    shortLabel:'Manual',
    color:     '#00e5a0',
    bgColor:   'rgba(0,229,160,0.10)',
    border:    'rgba(0,229,160,0.30)',
    icon:      'edit',
    url:       null,
    desc:      'Dado inserido manualmente pelo usuário',
  },
  custom: {
    label:     'Personalizado pelo Usuário',
    shortLabel:'Custom',
    color:     '#b44cff',
    bgColor:   'rgba(180,76,255,0.10)',
    border:    'rgba(180,76,255,0.30)',
    icon:      'star',
    url:       null,
    desc:      'Dado personalizado ou sobrescrito pelo usuário',
  },
};

function loadStore() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function saveStore(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

// Set provenance for a single item
// category: 'armor' | 'commodity' | 'item' | 'mining' | 'vehicle' | 'terminal' | etc.
// name: unique identifier for the item within the category
// source: SOURCES.* constant
// extra: optional extra metadata (e.g. { gameVersion: '4.8.1', endpoint: 'commodities' })
export function setProvenance(category, name, source, extra = {}) {
  const store = loadStore();
  if (!store[category]) store[category] = {};
  store[category][String(name).toLowerCase()] = {
    source,
    importedAt: new Date().toISOString(),
    ...extra,
  };
  saveStore(store);
}

// Set provenance for multiple items at once (batch)
export function setBatchProvenance(category, names, source, extra = {}) {
  const store = loadStore();
  if (!store[category]) store[category] = {};
  const now = new Date().toISOString();
  for (const name of names) {
    store[category][String(name).toLowerCase()] = {
      source,
      importedAt: now,
      ...extra,
    };
  }
  saveStore(store);
}

// Get provenance for an item
// Returns { source, label, color, bgColor, border, icon, importedAt, ... } or null
export function getProvenance(category, name) {
  const store = loadStore();
  const entry = store[category]?.[String(name).toLowerCase()];
  if (!entry) return null;
  const meta = SOURCE_META[entry.source] || SOURCE_META.manual;
  return { ...meta, ...entry };
}

// Get all provenance for a category
export function getCategoryProvenance(category) {
  const store = loadStore();
  return store[category] || {};
}

// Clear all provenance data
export function clearAllProvenance() {
  localStorage.removeItem(KEY);
}

// Format importedAt as human-readable
export function formatImportedAt(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return isoString; }
}

// Get summary stats
export function getProvenanceSummary() {
  const store = loadStore();
  const counts = { uex_api: 0, seed: 0, manual: 0, custom: 0 };
  const dates  = { uex_api: null };
  for (const cat of Object.values(store)) {
    for (const entry of Object.values(cat)) {
      if (counts[entry.source] !== undefined) counts[entry.source]++;
      if (entry.source === 'uex_api' && entry.importedAt) {
        if (!dates.uex_api || entry.importedAt > dates.uex_api) {
          dates.uex_api = entry.importedAt;
        }
      }
    }
  }
  return { counts, lastUexImport: dates.uex_api };
}
