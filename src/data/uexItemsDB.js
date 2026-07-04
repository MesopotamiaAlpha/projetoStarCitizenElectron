// ── Banco local de itens da UEX ───────────────────────────────────────────────
// Atualizado apenas quando o usuário faz sync na tela UEX API (Live)
// Estrutura: { items: [...], updatedAt: ISO string, itemCount: int }

const KEY = 'sc_uex_items_db_v1';

export function loadUexItemsDB() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { items: [], updatedAt: null, itemCount: 0 };
  } catch { return { items: [], updatedAt: null, itemCount: 0 }; }
}

export function saveUexItemsDB(items) {
  const db = {
    items,
    updatedAt: new Date().toISOString(),
    itemCount: items.length,
  };
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

// Buscar sugestões de autocomplete por nome (case-insensitive, parcial)
export function searchUexItems(query, limit = 10) {
  if (!query || query.trim().length < 2) return [];
  const db = loadUexItemsDB();
  const q  = query.toLowerCase().trim();
  return db.items
    .filter(i => i.name && i.name.toLowerCase().includes(q))
    .slice(0, limit);
}

// Buscar item exato por nome (para importar campos)
export function getUexItemByName(name) {
  const db = loadUexItemsDB();
  return db.items.find(i => i.name?.toLowerCase() === name?.toLowerCase()) || null;
}

// IDs de categorias UEX relevantes para o inventário (itens = tudo exceto commodities)
// Baseado na documentação: https://api.uexcorp.uk/2.0/categories
// Vamos buscar todas as categorias e filtrar as de items
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
