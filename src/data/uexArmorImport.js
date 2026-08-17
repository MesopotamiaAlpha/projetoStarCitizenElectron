// ── Cruzamento de armaduras: UEX API × sets já cadastrados ────────────────────
// A UEX não expõe "sets" prontos — só peças individuais (Helmet/Arms/Legs/Torso/
// Backpack) com categoria própria. Este módulo agrupa peças pelo nome em comum
// (removendo a palavra do tipo de peça no final) + fabricante, pra inferir sets.
// É uma heurística: pode juntar/errar em nomes atípicos, então o resultado deve
// ser conferido antes de importar.
import { loadUexItemsDB } from './uexItemsDB';
import { getArmorIdentity } from './armorDedup';

const PIECE_TYPE_BY_CATEGORY = {
  'helmets':   'Helmet',
  'arms':      'Arms',
  'legs':      'Legs',
  'torso':     'Torso',
  'backpacks': 'Backpack',
};

// Categoria "Full Set" da UEX é um kit já embalado (não decomponível em peças
// individuais pelos dados disponíveis) — não entra na importação automática.
const STRIP_WORDS = ['helmet','helmets','undersuit','undersuits','arms','arm','legs','leg','torso','armor','chest','vest','backpack','backpacks','bag'];

function stripPieceWord(name) {
  let n = (name || '').trim();
  for (const w of STRIP_WORDS) {
    const re = new RegExp(`\\s+${w}$`, 'i');
    if (re.test(n)) { n = n.replace(re, '').trim(); break; }
  }
  return n || (name || '').trim();
}

/** Peças de armadura sincronizadas da UEX, já classificadas por tipo de peça. */
export function getUexArmorPieces() {
  const db = loadUexItemsDB();
  const items = db.items || [];
  return items
    .filter(i => (i.section || '').toLowerCase() === 'armor' && (i.category || '').toLowerCase() !== 'full set')
    .map(i => ({ ...i, piece_type: PIECE_TYPE_BY_CATEGORY[(i.category || '').toLowerCase()] || null }))
    .filter(i => i.piece_type);
}

/** Agrupa as peças em possíveis "sets" por nome em comum + fabricante. */
export function buildUexArmorCatalog() {
  const pieces = getUexArmorPieces();
  const groups = {};
  pieces.forEach(p => {
    const base = stripPieceWord(p.name);
    const manufacturer = p.company_name || 'Desconhecido';
    const key = `${manufacturer.toLowerCase()}||${base.toLowerCase()}`;
    if (!groups[key]) groups[key] = { base_name: base, manufacturer, pieces: [] };
    groups[key].pieces.push(p);
  });
  return Object.values(groups).sort((a, b) => a.base_name.localeCompare(b.base_name));
}

/** Só os grupos cujo nome ainda não existe entre os sets já cadastrados no app. */
export function getMissingArmorGroups(existingSets) {
  const catalog = buildUexArmorCatalog();
  const existingNames = new Set((existingSets || []).map(s => getArmorIdentity(s)));
  return catalog.filter(g => !existingNames.has(getArmorIdentity({ base_name: g.base_name, variant_name: 'Base' })));
}

export function getArmorSyncStats() {
  const pieces = getUexArmorPieces();
  const db = loadUexItemsDB();
  return { updatedAt: db.updatedAt, pieceCount: pieces.length };
}
