import { loadManagedLocations, LOCATION_SOURCE_NAMES } from './locations';

// ── Banco local de localizações da UEX ────────────────────────────────────────
// Sincronizado manualmente na tela "UEX API (Live)" → aba Localizações.
// Usado para enriquecer os seletores de local/tipo-de-local em todo o app
// (Inventário, Baú de Minério, Mineração em Grupo) com sistemas, planetas,
// luas, cidades, postos avançados, estações e terminais reais do jogo.

const KEY = 'sc_uex_locations_db_v1';

function emptyDB() {
  return {
    systems: [], planets: [], moons: [], stations: [],
    cities: [], outposts: [], terminals: [],
    updatedAt: null,
  };
}

export function loadUexLocationsDB() {
  try { return { ...emptyDB(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return emptyDB(); }
}

export function saveUexLocationsDB(data) {
  const db = { ...emptyDB(), ...data, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

export function getUexLocationsStats() {
  const db = loadUexLocationsDB();
  return {
    updatedAt: db.updatedAt,
    counts: {
      systems:   db.systems?.length   || 0,
      planets:   db.planets?.length   || 0,
      moons:     db.moons?.length     || 0,
      stations:  db.stations?.length  || 0,
      cities:    db.cities?.length    || 0,
      outposts:  db.outposts?.length  || 0,
      terminals: db.terminals?.length || 0,
    },
  };
}

// Estações Lagrange têm "-L" no nome (ex: CRU-L1, ARC-L4); as demais são orbitais/estações padrão.
function classifyStation(name = '') {
  return /-L\d\b/i.test(name) ? 'Estação L (Lagrange)' : 'Estação Orbital';
}

/**
 * Constrói a árvore hierárquica { sistema: { tipoDeLocal: [nomes] } } a partir do banco
 * sincronizado da UEX, mesclada sobre uma base estática (fallback caso ainda não tenha sido
 * sincronizado, ou para preencher sistemas/tipos que a API não cobre).
 */
export function buildLocationTree(staticBase = {}) {
  const db = loadUexLocationsDB();
  const managed = loadManagedLocations();
  const managedNames = new Set(managed.map(location => String(location.name || '').trim().toLowerCase()));
  const hiddenKeys = new Set(managed.filter(location => location.active === false).map(location => `${String(location.system || '').trim().toLowerCase()}::${String(location.name || '').trim().toLowerCase()}`));
  // Se um local da lista inicial foi excluído definitivamente, ele também deve
  // deixar de aparecer nas listas estáticas antigas do projeto.
  const removedSeedNames = new Set(LOCATION_SOURCE_NAMES.filter(name => !managedNames.has(String(name).trim().toLowerCase())).map(name => String(name).trim().toLowerCase()));
  const shouldHide = (system, name) => hiddenKeys.has(`${String(system || '').trim().toLowerCase()}::${String(name || '').trim().toLowerCase()}`) || removedSeedNames.has(String(name || '').trim().toLowerCase());
  const tree = {};
  // Clona a base estática, respeitando exclusões e desativações administradas.
  Object.entries(staticBase).forEach(([sys, types]) => {
    tree[sys] = {};
    Object.entries(types).forEach(([type, names]) => {
      tree[sys][type] = names.filter(name => !shouldHide(sys, name));
    });
  });

  function addTo(system, type, name) {
    if (shouldHide(system, name)) return;
    if (!system || !name) return;
    if (!tree[system]) tree[system] = {};
    if (!tree[system][type]) tree[system][type] = [];
    if (!tree[system][type].includes(name)) tree[system][type].push(name);
  }

  (db.planets   || []).forEach(p => addTo(p.star_system_name, 'Planeta / Lua', p.name));
  (db.moons     || []).forEach(m => addTo(m.star_system_name, 'Planeta / Lua', m.name));
  (db.cities    || []).forEach(c => addTo(c.star_system_name, 'Cidade', c.name));
  (db.outposts  || []).forEach(o => addTo(o.star_system_name, 'Posto Avançado / Base', o.name));
  (db.stations  || []).forEach(s => addTo(s.star_system_name, classifyStation(s.name), s.name));
  (db.terminals || []).forEach(t => addTo(t.star_system_name, 'Terminal', t.name));

  // A lista administrada pelo usuário é mesclada sem remover os dados antigos.
  // Assim, registros já salvos e backups continuam válidos.
  managed.filter(location => location.active !== false).forEach(location => {
    addTo(location.system, location.type, location.name);
  });

  Object.values(tree).forEach(types => Object.keys(types).forEach(t => types[t].sort((a,b)=>a.localeCompare(b))));
  return tree;
}

/** Lista simples (achatada e sem duplicatas) combinando uma base estática com os dados sincronizados. */
export function buildLocationFlatList(staticBase = []) {
  const tree = buildLocationTree({});
  const fromApi = [];
  Object.values(tree).forEach(types => Object.values(types).forEach(arr => arr.forEach(n => fromApi.push(n))));
  const merged = [...new Set([...staticBase.filter(s=>s!=='Outro'), ...fromApi])].sort((a,b)=>a.localeCompare(b));
  merged.push('Outro');
  return merged;
}
