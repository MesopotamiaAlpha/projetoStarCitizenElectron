// ── Banco local de itens da UEX ───────────────────────────────────────────────
// Atualizado apenas quando o usuário faz sync na tela UEX API (Live)
// Estrutura: { items: [...], updatedAt: ISO string, itemCount: int }

const KEY = 'sc_uex_items_db_v1';

// Alguns registros antigos/retornos da UEX podem chegar com um campo numérico
// separado anexado ao nome, por exemplo: "Ace Interceptor Helmet 0" ou
// "Ace Interceptor Helmet\\n0". Remove somente esse zero isolado no final;
// zeros dentro de nomes como "P-8", "S0" ou "F7C" são preservados.
export function normalizeUexItemName(value) {
  const text = String(value ?? '')
    .replace(/[\u0000\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || text === '0') return '';
  return text.replace(/\s+0$/, '').trim();
}

export function normalizeUexNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;

  let text = String(value).trim();
  if (!text) return 0;
  text = text.replace(/[^0-9,.-]/g, '');
  if (!text) return 0;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    text = lastComma > lastDot
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  } else if (lastComma >= 0) {
    text = text.replace(',', '.');
  } else if (lastDot >= 0) {
    const dotParts = text.split('.');
    const looksLikeThousands = dotParts.length > 1
      && dotParts.slice(1).every(part => /^\d{3}$/.test(part));
    if (looksLikeThousands) text = dotParts.join('');
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const parsed = normalizeUexNumber(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

// O banco pode conter o price_avg calculado pelo sync atual ou campos de
// versões anteriores. A ordem mantém compatibilidade e sempre ignora zeros,
// strings vazias, NaN e valores não numéricos.
export function getUexItemAveragePrice(item) {
  if (!item) return 0;
  return firstPositiveNumber(
    item.price_avg,
    item.price_sell_avg,
    item.price_buy_avg,
    item.price_sell_avg_week,
    item.price_buy_avg_week,
    item.price_sell,
    item.price_buy,
  );
}

export function loadUexItemsDB() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const items = Array.isArray(raw.items) ? raw.items.map(item => ({
      ...item,
      name: normalizeUexItemName(item?.name),
    })) : [];
    return {
      items,
      updatedAt: raw.updatedAt || null,
      itemCount: Number(raw.itemCount) || items.length,
    };
  } catch {
    return { items: [], updatedAt: null, itemCount: 0 };
  }
}

export function saveUexItemsDB(items) {
  const safeItems = (Array.isArray(items) ? items : []).map(item => ({
    ...item,
    name: normalizeUexItemName(item?.name),
  }));
  const db = {
    items: safeItems,
    updatedAt: new Date().toISOString(),
    itemCount: safeItems.length,
  };
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

function normalizeSearchText(value) {
  return normalizeUexItemName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Buscar sugestões de autocomplete por nome (case-insensitive, parcial)
export function searchUexItems(query, limit = 10) {
  const q = normalizeSearchText(query);
  if (q.length < 2) return [];
  const db = loadUexItemsDB();
  return db.items
    .filter(item => normalizeSearchText(item.name).includes(q))
    .slice(0, limit);
}

// Buscar item exato por nome, aceitando diferenças de maiúsculas e acentos.
export function getUexItemByName(name) {
  const normalized = normalizeSearchText(name);
  if (!normalized) return null;
  const db = loadUexItemsDB();
  return db.items.find(item => normalizeSearchText(item.name) === normalized) || null;
}

// IDs de categorias UEX relevantes para o inventário (itens = tudo exceto commodities)
// Baseado na documentação: https://api.uexcorp.uk/2.0/categories
export const UEX_ITEM_CATEGORY_IDS = [
  // Armaduras e roupas
  38, // Armor
  39, // Undersuit
  40, // Helmet
  41, // Arms (Armor)
  42, // Legs (Armor)
  43, // Core (Armor)
  44, // Backpack
  // Armas pessoais
  10, // Personal Weapons
  11, // Pistol
  12, // Shotgun
  13, // SMG
  14, // Assault Rifle
  15, // Sniper Rifle
  16, // LMG
  17, // Special
  // Acessórios de arma
  20, // Optics
  21, // Barrel Attachments
  22, // Underbarrel Attachments
  23, // Magazines
  24, // Ammunition
  // Componentes de nave
  50, // Shields
  51, // Power Plants
  52, // Coolers
  53, // Quantum Drives
  54, // Thrusters
  55, // Ship Weapons
  56, // Missiles
  57, // Mining Modules
  58, // Salvage Modules
  // Utilitários FPS
  70, // Medical
  71, // Multi-Tools
  72, // Gadgets
  73, // Flashlights
  74, // Consumer Electronics
  // Outros
  80, // Consumables
  81, // Food & Drink
  90, // Collectibles
  91, // Ship Decals
  92, // Flair
];
