// ── Locais administráveis do Companheiro Emoto ────────────────────────────────
// A lista abaixo é a base inicial fornecida pelo usuário. Depois da primeira
// inicialização, qualquer inclusão, edição, ativação ou remoção é persistida
// somente no localStorage deste computador.

export const LOCATIONS_KEY = 'sc_locations_admin_v1';
export const LOCATIONS_UPDATED_EVENT = 'sc-locations-updated';

export const LOCATION_TYPES = [
  'Sistema',
  'Planeta',
  'Lua',
  'Cidade',
  'Estação Espacial',
  'Estação L (Lagrange)',
  'Posto Avançado',
  'Instalação / Complexo',
  'Área de Mineração',
  'Centro de Distribuição',
  'Hangar',
  'Terminal',
  'Gateway / Jump Point',
  'Ponto de Comunicação',
  'Refinaria',
  'Scrapyard',
  'OLP',
  'Outros',
];

export const DEFAULT_SYSTEMS = ['Stanton', 'Pyro', 'Nyx', 'Terra', 'Odin', 'Outro'];

const SOURCE_LIST = `Aberdeen
Adir
ARC-L1 Wide Forest Station
ARC-L2 Lively Pathway Station
ARC-L3 Modern Express Station
ARC-L4 Faint Glen Station
ARC-L5 Yellow Core Station
ArcCorp (planet)
ArcCorp Mining Area 045
ArcCorp Mining Area 048
ArcCorp Mining Area 061
ArcCorp Mining Area 141
ArcCorp Mining Area 157
Area18
Arial
ASD Data Center
ASD Shuttle Station
Attritus OLP
Baijini Point
Benson Mining Outpost
Bloom
Bountiful Harvest Hydroponics
Calliope
Cellin
Checkmate
Checkmate Station
Clio
Comm Array ST1-02
Comm Array ST1-13
Comm Array ST1-48
Comm Array ST1-61
Comm Array ST1-92
Comm Array ST2-28
Comm Array ST2-47
Comm Array ST2-55
Comm Array ST2-76
Comm Array ST3-18
Comm Array ST3-35
Comm Array ST3-90
Comm Array ST4-22
Comm Array ST4-31
Comm Array ST4-59
Comm Array ST4-64
Covalex Hub Gundo
CRU-L1 Ambitious Dream Station
CRU-L4 Shallow Fields Station
CRU-L5 Beautiful Glen Station
Crusader
Dasi Station
Daymar
Deakins Research Outpost
Delamar
Dudley & Daughters
Endgame
Euterpe
Everus Harbor
Fairo
Fuego
Gallete Family Farms
Gaslight
Grim HEX
HDES-Calthrope
HDMO-Dobbs
HDMS-Anderson
HDMS-Bezdek
HDMS-Edmond
HDMS-Hadley
HDMS-Hahn
HDMS-Lathan
HDMS-Norgaard
HDMS-Oparei
HDMS-Perlman
HDMS-Pinewood
HDMS-Ryder
HDMS-Stanhope
HDMS-Thedus
Hickes Research Outpost
HUR-L1 Green Glade Station
HUR-L2 Faithful Dream Station
HUR-L3 Thundering Express Station
HUR-L4 Melodic Fields Station
HUR-L5 High Course Station
Hurston
ICC ScanHub Stanton
Ignis
INS Jericho
Instanced Hangars
Ita
Kinga Station
Kudre Ore
Lamina OLP
Lazarus Research Complex
Levski
Lorville
Loveridge Mineral Reserve
Lyria
Magda
Magnus Gateway
Megumi Refueling
MIC-L1 Shallow Frontier Station
MIC-L2 Long Forest Station
MIC-L3 Endless Odyssey Station
MIC-L4 Red Crossroads Station
MIC-L5 Modern Icarus Station
MicroTech (planet)
Monox
NT-999-XX
Nuen Waste Management
Nyx Gateway (Pyro)
Nyx Gateway (Stanton)
Nyx I
Nyx II
Nyx III
Nyx system
Onyx Facility (ASD)
Operations Depot Lyria
Orbituary
Orison
Patch City
People's Service Stations
Personal Hangar
Port Olisar
Port Tressler
Public Hangars
Pyro Gateway (Nyx)
Pyro Gateway (Stanton)
Pyro I
Pyro IV
Pyro V
Pyro system
QV Services Stations
Rat's Nest
Rod's Fuel 'N Supplies
Ruin Station
Ruptura OLP
Scarper's Turn
Security Post Kareah
Selo Station
Seraphim Station
Shubin Mining Facility SAL-2
Shubin Mining Facility SAL-5
Shubin Mining Facility SCD-1
Shubin Mining Facility SM0-10
Shubin Mining Facility SM0-13
Shubin Mining Facility SM0-18
Shubin Mining Facility SMCa-6
Shubin Processing Facility SPAL-12
Shubin Processing Facility SPAL-3
Shubin Processing Facility SPAL-7
Shubin Processing Facility SPAL-9
Shubin Processing Facility SPMC-14
Stanton Gateway (Nyx)
Stanton Gateway (Pyro)
Stanton system
Starlight Service Station
Teddy's Playhouse
Terra Gateway
Terminus
Test Facility Octagon
The Orphanage
Todos os Distribution Centers
Todos os Freight Outposts
Todos os Hangars das Lagrange Stations
Todos os Hangars de cidades
Todos os Hangars de estações
Todos os Outposts que possuem Cargo Deck
Todos os Scrapyards
Tram & Myers Mining
Vatra
Vivere OLP
Vuur
Wala
Wikelo Emporium - Dasi
Wikelo Emporium - Kinga
Wikelo Emporium - Selo
Yela`;

const LEGACY_PROJECT_NAMES = `ArcCorp (Area18)
ArcCorp — Wala
ArcCorp — Lyria
Hurston (Lorville)
Hurston — Aberdeen
Hurston — Magda
Hurston — Ita
Hurston — Arial
microTech (New Babbage)
microTech — Calliope
microTech — Clio
microTech — Euterpe
Crusader (Orison)
Crusader — Daymar
Crusader — Cellin
Crusader — Yela
ARC-L3 Overwatch Station
ARC-L5 Recent Storm Station
HUR-L5 Alto Course Station
CRU-L2 Ambitious Dream Station
CRU-L3 Stash House
MIC-L5 Modern Icebox Station
Port Olisar (legado)
Everus Harbor (Hurston)
Port Tressler (microTech)
Baijini Point (ArcCorp)
Seraphim Station (Crusader)
Grim HEX (Yela)
Levski (Nyx)
CRU-L5 — Stash House
Drug Lab (Yela Belt)
Nine Tails Stronghold
Bunker Genérico
Distribution Center
Hangar Pessoal
Nave Principal
Nave Secundária
Porta-Naves
Pyro II (Monox)
Pyro III
Pyro VI (Terminus)
Checkmate (Nyx Gateway)
Stanton Gateway
Nyx Jump Point
Rafe Place
Pirate Base
Syndicate Outpost
Scrapyard
Pyro Jump Point
Prime
Ellis
Tohil
Terra Gateway
Ayr-en
Laine
Odin Gateway
Yela Asteroid Belt
Aaron Halo
Pyro II
Pyro III
Pyro VI
CRU-L1 Stash House
Area18 - Warehouse
Lorville - Warehouse
New Babbage - Warehouse
Bunker Loot
Desmontagem`.split('\n').map(name => name.trim()).filter(Boolean);

export const LOCATION_SOURCE_NAMES = [...new Set([...SOURCE_LIST.split('\n'), ...LEGACY_PROJECT_NAMES])]
  .map(name => name.trim()).filter(Boolean);

const PLANETS = new Set([
  'ArcCorp (planet)', 'Crusader', 'Hurston', 'MicroTech (planet)',
  'Pyro I', 'Pyro IV', 'Pyro V', 'Nyx I', 'Nyx II', 'Nyx III',
  'Delamar', 'Monox', 'Terminus', 'Bloom', 'Adir', 'Fairo', 'Ignis',
  'Vatra', 'Lyria', 'Magda', 'Wala', 'Yela', 'Calliope', 'Cellin',
  'Clio', 'Daymar', 'Euterpe', 'Aberdeen', 'Arial', 'Ita',
]);

const MOONS = new Set(['Aberdeen', 'Arial', 'Ita', 'Magda', 'Calliope', 'Cellin', 'Clio', 'Daymar', 'Euterpe', 'Lyria', 'Wala', 'Yela']);

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `local-${Date.now()}`;
}

function locationKey(location) {
  return `${String(location.system || '').trim().toLowerCase()}::${String(location.name || '').trim().toLowerCase()}`;
}

function inferSystem(name) {
  const n = String(name || '').trim();
  if (/^nyx\s+system$/i.test(n) || /^nyx\s+(gateway|i|ii|iii)/i.test(n) || /\(nyx\)/i.test(n) || /^(Delamar|Levski)$/i.test(n)) return 'Nyx';
  if (/^pyro\s+system$/i.test(n) || /^pyro\s+(gateway|i|iv|v)/i.test(n) || /\(pyro\)/i.test(n) || /^(Adir|Bloom|Fairo|Fuego|Ignis|Monox|Ruin Station|Terminus|The Orphanage|Vatra)$/i.test(n)) return 'Pyro';
  if (/terra/i.test(n)) return 'Terra';
  if (/^odin\b/i.test(n)) return 'Odin';
  return 'Stanton';
}

function inferType(name) {
  const n = String(name || '').trim();
  if (/\bsystem$/i.test(n)) return 'Sistema';
  if (/^ArcCorp \(planet\)$|^MicroTech \(planet\)$|^Crusader$|^Hurston$|^Pyro (I|IV|V)$|^Nyx (I|II|III)$|^Delamar$|^Monox$|^Terminus$|^Bloom$|^Adir$|^Fairo$|^Ignis$|^Vatra$|^Lyria$|^Magda$|^Wala$|^Yela$/i.test(n)) return 'Planeta';
  if (MOONS.has(n)) return 'Lua';
  if (/gateway/i.test(n)) return 'Gateway / Jump Point';
  if (/comm array|scanHub/i.test(n)) return 'Ponto de Comunicação';
  if (/hangar/i.test(n)) return 'Hangar';
  if (/mining area|mining facility|processing facility|tramp? & myers mining|kudre ore|ore$/i.test(n)) return 'Área de Mineração';
  if (/distribution|freight outpost|service station|refueling|fuel|services/i.test(n)) return 'Posto Avançado';
  if (/outpost|hydroponics|farms|research outpost|research complex|facility|data center|waste management|operations depot/i.test(n)) return 'Instalação / Complexo';
  if (/olp$/i.test(n)) return 'OLP';
  if (/scrapyard/i.test(n)) return 'Scrapyard';
  if (/wikelo emporium/i.test(n)) return 'Cidade';
  if (/city|area18|lorville|orison|people's service|patch city|gaslight|teddy's playhouse|dudley|rat's nest|scarper's turn/i.test(n)) return 'Cidade';
  if (/terminal|station|point|harbor|hex|olísar|olisar|jericho|kareah|lazarus|orbituary|seraphim|checkmate|kinga|selo|dasi|magnus|starlight|covalex|benson|hickes|lám?ina|lamina|ruin/i.test(n)) return /-L\d\b/i.test(n) ? 'Estação L (Lagrange)' : 'Estação Espacial';
  if (/shubin|hdms|hdes|hdmo/i.test(n)) return 'Posto Avançado';
  if (/people|all |todos os/i.test(n)) return 'Outros';
  return 'Outros';
}

function makeDefaultLocation(name, index) {
  const system = inferSystem(name);
  const type = inferType(name);
  return {
    id: `seed-${slugify(name)}-${index + 1}`,
    name,
    system,
    type,
    notes: '',
    active: true,
    source: 'seed',
    createdAt: null,
    updatedAt: null,
  };
}

export const DEFAULT_LOCATIONS = LOCATION_SOURCE_NAMES.map(makeDefaultLocation);

export function normalizeLocation(value, index = 0) {
  const name = String(value?.name || '').trim();
  if (!name) return null;
  const system = String(value?.system || '').trim() || inferSystem(name);
  const type = LOCATION_TYPES.includes(value?.type) ? value.type : (String(value?.type || '').trim() || inferType(name));
  return {
    id: String(value?.id || `local-${slugify(system)}-${slugify(name)}-${index + 1}`),
    name,
    system,
    type,
    notes: String(value?.notes || ''),
    active: value?.active !== false,
    source: value?.source || 'manual',
    createdAt: value?.createdAt || null,
    updatedAt: value?.updatedAt || null,
  };
}

function readRaw() {
  try {
    const raw = localStorage.getItem(LOCATIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed?.locations;
  } catch {
    return null;
  }
}

export function loadManagedLocations() {
  const raw = readRaw();
  if (!raw) {
    const seed = DEFAULT_LOCATIONS.map(normalizeLocation).filter(Boolean);
    try {
      localStorage.setItem(LOCATIONS_KEY, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), locations: seed }));
    } catch {}
    return seed;
  }
  return raw.map(normalizeLocation).filter(Boolean);
}

export function saveManagedLocations(locations) {
  const normalized = (Array.isArray(locations) ? locations : [])
    .map(normalizeLocation).filter(Boolean);
  const payload = { version: 1, updatedAt: new Date().toISOString(), locations: normalized };
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(payload));
  try { window.dispatchEvent(new CustomEvent(LOCATIONS_UPDATED_EVENT, { detail: normalized })); } catch {}
  return normalized;
}

export function createManagedLocation(input) {
  const now = new Date().toISOString();
  const name = String(input?.name || '').trim();
  const system = String(input?.system || '').trim() || inferSystem(name);
  const item = normalizeLocation({
    ...input,
    id: input?.id || `manual-${slugify(system)}-${slugify(name)}-${Date.now()}`,
    name,
    system,
    type: input?.type || inferType(name),
    createdAt: input?.createdAt || now,
    updatedAt: now,
    source: input?.source || 'manual',
  });
  return item;
}

export function upsertManagedLocation(location) {
  const item = createManagedLocation(location);
  if (!item?.name) throw new Error('Nome do local é obrigatório.');
  const current = loadManagedLocations();
  const duplicate = current.find(existing => existing.id !== item.id && locationKey(existing) === locationKey(item));
  if (duplicate) throw new Error(`Já existe um local chamado "${duplicate.name}" no sistema ${duplicate.system}.`);
  const index = current.findIndex(existing => existing.id === item.id);
  const next = index >= 0 ? current.map((existing, i) => i === index ? item : existing) : [...current, item];
  saveManagedLocations(next);
  return item;
}

export function removeManagedLocation(id) {
  const current = loadManagedLocations();
  const next = current.filter(location => location.id !== id);
  saveManagedLocations(next);
  return next;
}

export function toggleManagedLocation(id, active) {
  const current = loadManagedLocations();
  const next = current.map(location => location.id === id ? { ...location, active: active !== false, updatedAt: new Date().toISOString() } : location);
  saveManagedLocations(next);
  return next;
}

export function getManagedLocationStats(locations = loadManagedLocations()) {
  const active = locations.filter(location => location.active !== false);
  return {
    total: locations.length,
    active: active.length,
    inactive: locations.length - active.length,
    systems: new Set(active.map(location => location.system)).size,
    types: new Set(active.map(location => location.type)).size,
  };
}

// Compatibilidade com leitores antigos: fornece uma árvore no mesmo formato
// usado pelos seletores atuais do Inventário.
export function buildManagedLocationTree(locations = loadManagedLocations()) {
  const tree = {};
  locations.filter(location => location.active !== false).forEach(location => {
    if (!tree[location.system]) tree[location.system] = {};
    if (!tree[location.system][location.type]) tree[location.system][location.type] = [];
    if (!tree[location.system][location.type].includes(location.name)) tree[location.system][location.type].push(location.name);
  });
  Object.values(tree).forEach(types => Object.values(types).forEach(names => names.sort((a, b) => a.localeCompare(b))));
  return tree;
}

export function managedLocationKey(location) {
  return locationKey(location);
}


export function buildManagedLocationOptions(locations = loadManagedLocations()) {
  const tree = buildManagedLocationTree(locations);
  return Object.entries(tree).flatMap(([system, types]) =>
    Object.entries(types).flatMap(([location_type, names]) =>
      names.map(location_name => ({
        key: `${system}::${location_type}::${location_name}`,
        label: `${location_name} · ${system} · ${location_type}`,
        system,
        location_type,
        location_name,
      }))
    )
  );
}
