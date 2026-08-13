// Regras compartilhadas do sistema Wikelo.
// 50 unidades de cada tipo de script geram 1 Wikelo Favor.
// Um item já chamado Wikelo Favor é uma conversão pronta e vale 1 favor por unidade.
export const SCRIPT_ITEMS = Object.freeze(['Mg Scrip', 'Council Scrip']);
export const SCRIPT_RATIO = 50;

const WIKELO_FAVOR_ALIASES = Object.freeze(new Set([
  'wikelo favor',
  'wikelo favors',
  'wikelo\'s favor',
  'wikelo\'s favors',
  'wikelo favor(s)',
]));

// Mantém compatibilidade com registros antigos que foram salvos com grafia incorreta.
const SCRIPT_ALIASES = Object.freeze({
  'mg scrip': 'Mg Scrip',
  'council scrip': 'Council Scrip',
  'council script': 'Council Scrip',
  'concuil scrip': 'Council Scrip',
  'concuil script': 'Council Scrip',
});

export function normalizeScriptName(name) {
  const key = String(name || '').trim().toLowerCase();
  return SCRIPT_ALIASES[key] || null;
}

export function isScriptItem(name) {
  return normalizeScriptName(name) !== null;
}

export function isWikeloFavorItem(name) {
  return WIKELO_FAVOR_ALIASES.has(String(name || '').trim().toLowerCase());
}

export function getDirectWikeloFavors(items = []) {
  return items.reduce((total, item) => {
    if (!isWikeloFavorItem(item?.name)) return total;
    const quantity = Number(item?.quantity);
    return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
  }, 0);
}

// Consolida linhas duplicadas do mesmo script antes de converter para Favors.
// Isso evita perder, por exemplo, 25 + 25 unidades cadastradas em locais diferentes.
export function getScriptQuantities(items = []) {
  return items.reduce((totals, item) => {
    const scriptName = normalizeScriptName(item?.name);
    if (!scriptName) return totals;
    const quantity = Number(item?.quantity);
    totals[scriptName] = (totals[scriptName] || 0) + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
    return totals;
  }, {});
}

export function calcWikeloFavors(items = []) {
  const totals = getScriptQuantities(items);
  const convertedFromScripts = SCRIPT_ITEMS.reduce((favors, scriptName) => favors + Math.floor((totals[scriptName] || 0) / SCRIPT_RATIO), 0);
  return convertedFromScripts + getDirectWikeloFavors(items);
}

export function calcScriptFavors(items = [], scriptName) {
  const canonicalName = normalizeScriptName(scriptName);
  if (!canonicalName) return 0;
  const totals = getScriptQuantities(items);
  return Math.floor((totals[canonicalName] || 0) / SCRIPT_RATIO);
}
