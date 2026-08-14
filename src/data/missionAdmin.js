const KEY = 'sc_mission_admin_v1';
const LEGACY_KEY = 'sc_mission_catalog_v1';
export const MISSION_ADMIN_UPDATED_EVENT = 'sc_mission_admin_updated';

export const MISSION_ADMIN_LABELS = {
  factions: 'Facções',
  types: 'Tipos de missão',
  systems: 'Sistemas',
};

const DEFAULTS = {
  factions: [
    'Foxwell Enforcement', 'Headhunters', 'Covalex', 'Shubin Interstellar', 'Ling Family',
    'InterSec', 'Rayari', 'Mile Eckhart', 'Nine Tails', 'UEE Navy', 'Advocacy', 'CDF',
    'Hurston Security', 'Levski Security', 'Free', 'Outro',
  ],
  types: [
    'Bounty Hunt', 'Delivery', 'Carga Run', 'Mining', 'Salvage', 'FPS Combat', 'Escort',
    'Investigation', 'PVP', 'Base Assault', 'Drug Run', 'Mercenary', 'Blockade Run', 'Outro',
  ],
  systems: ['Stanton', 'Pyro', 'Nyx', 'Terra'],
};

function parseStored(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function readStored() {
  return parseStored(KEY) || parseStored(LEGACY_KEY);
}

function emitUpdate(value) {
  window.dispatchEvent(new CustomEvent(MISSION_ADMIN_UPDATED_EVENT, { detail: value }));
}

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function categoryKey(category) {
  if (category === 'faction' || category === 'factions') return 'factions';
  if (category === 'type' || category === 'types') return 'types';
  if (category === 'system' || category === 'systems') return 'systems';
  return null;
}

function optionCategory(kind) {
  return kind === 'factions' ? 'faction' : kind === 'types' ? 'type' : 'system';
}

function normalizeOption(option, kind, index = 0) {
  const name = String(option?.name || option?.label || option || '').trim();
  if (!name) return null;
  const category = optionCategory(kind);
  const now = new Date().toISOString();
  return {
    id: String(option?.id || `${category}-${slug(name) || index}`),
    category,
    name,
    active: option?.active !== false,
    notes: String(option?.notes || option?.description || '').trim(),
    builtIn: option?.builtIn === true,
    createdAt: option?.createdAt || now,
    updatedAt: option?.updatedAt || now,
  };
}

function normalizeList(kind, value, fallback) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  const result = [];
  const seen = new Set();
  source.forEach((item, index) => {
    const option = normalizeOption(item, kind, index);
    if (!option) return;
    const identity = option.name.toLocaleLowerCase();
    if (seen.has(identity)) return;
    seen.add(identity);
    result.push(option);
  });
  return result;
}

function buildSeed() {
  return {
    factions: normalizeList('factions', DEFAULTS.factions.map(name => ({ name, builtIn: true })), []),
    types: normalizeList('types', DEFAULTS.types.map(name => ({ name, builtIn: true })), []),
    systems: normalizeList('systems', DEFAULTS.systems.map(name => ({ name, builtIn: true })), []),
  };
}

function normalizeAdmin(value) {
  const source = value || {};
  const seed = buildSeed();
  return {
    factions: normalizeList('factions', source.factions, seed.factions),
    types: normalizeList('types', source.types, seed.types),
    systems: normalizeList('systems', source.systems, seed.systems),
  };
}

/** Carrega o catálogo. O seed só é gravado se a chave ainda não existir. */
export function loadMissionAdmin() {
  const current = parseStored(KEY);
  if (current) return normalizeAdmin(current);

  const legacy = parseStored(LEGACY_KEY);
  if (legacy) {
    const migrated = normalizeAdmin(legacy);
    localStorage.setItem(KEY, JSON.stringify(migrated));
    return migrated;
  }

  const seed = buildSeed();
  localStorage.setItem(KEY, JSON.stringify(seed));
  return seed;
}

export function saveMissionAdmin(admin) {
  const current = loadMissionAdmin();
  const normalized = normalizeAdmin({
    factions: admin?.factions || current.factions,
    types: admin?.types || current.types,
    systems: admin?.systems || current.systems,
  });
  localStorage.setItem(KEY, JSON.stringify(normalized));
  emitUpdate(normalized);
  return normalized;
}

/** Retorna as opções ativas e, quando informado, preserva o valor legado atual. */
export function getMissionAdminOptions(category, currentValue = '', admin = loadMissionAdmin()) {
  const key = categoryKey(category);
  if (!key) return [];
  const rows = Array.isArray(admin?.[key]) ? admin[key] : [];
  const options = rows.filter(option => option.active !== false || option.name === currentValue);
  if (options.length || !currentValue) return options;
  return [{
    id: `legacy-${slug(currentValue)}`,
    category: optionCategory(key),
    name: currentValue,
    active: false,
    notes: 'Valor legado de uma missão existente.',
    createdAt: null,
    updatedAt: null,
  }];
}

export function upsertMissionAdminOption(category, option) {
  const key = categoryKey(category);
  if (!key) throw new Error('Categoria de missão inválida.');
  const normalized = normalizeOption(option, key);
  if (!normalized) throw new Error('O nome da opção é obrigatório.');
  const current = loadMissionAdmin();
  const duplicate = current[key].find(row => row.name.toLocaleLowerCase() === normalized.name.toLocaleLowerCase() && row.id !== normalized.id);
  if (duplicate) throw new Error('Já existe uma opção com este nome nesta categoria.');
  normalized.updatedAt = new Date().toISOString();
  const cleaned = Object.fromEntries(Object.keys(MISSION_ADMIN_LABELS).map(listKey => [listKey, current[listKey].filter(row => row.id !== normalized.id)]));
  const existing = current[key].find(row => row.id === normalized.id);
  const rows = [...cleaned[key], { ...normalized, createdAt: existing?.createdAt || normalized.createdAt }];
  return saveMissionAdmin({ ...current, ...cleaned, [key]: rows });
}

export function toggleMissionAdminOption(category, id) {
  const key = categoryKey(category);
  if (!key) return loadMissionAdmin();
  const current = loadMissionAdmin();
  const rows = current[key].map(row => row.id === id ? { ...row, active: row.active === false, updatedAt: new Date().toISOString() } : row);
  return saveMissionAdmin({ ...current, [key]: rows });
}

export function removeMissionAdminOption(category, id) {
  const key = categoryKey(category);
  if (!key) return loadMissionAdmin();
  const current = loadMissionAdmin();
  return saveMissionAdmin({ ...current, [key]: current[key].filter(row => row.id !== id) });
}

export function getMissionAdminStats(admin = loadMissionAdmin()) {
  return Object.fromEntries(Object.keys(MISSION_ADMIN_LABELS).map(key => [key, {
    total: (admin[key] || []).length,
    active: (admin[key] || []).filter(option => option.active !== false).length,
    inactive: (admin[key] || []).filter(option => option.active === false).length,
  }]));
}

export { KEY as MISSION_ADMIN_KEY };
