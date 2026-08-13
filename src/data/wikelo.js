// Regras compartilhadas do sistema Wikelo.
// 50 unidades de cada tipo de script geram 1 Wikelo Favor.
export const SCRIPT_ITEMS = Object.freeze(['Mg Scrip', 'Council Scrip']);
export const SCRIPT_RATIO = 50;

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
  return SCRIPT_ITEMS.reduce((favors, scriptName) => favors + Math.floor((totals[scriptName] || 0) / SCRIPT_RATIO), 0);
}

export function calcScriptFavors(items = [], scriptName) {
  const canonicalName = normalizeScriptName(scriptName);
  if (!canonicalName) return 0;
  const totals = getScriptQuantities(items);
  return Math.floor((totals[canonicalName] || 0) / SCRIPT_RATIO);
}
