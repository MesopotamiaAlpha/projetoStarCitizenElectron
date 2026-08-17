// ── Catálogo administrável de categorias do Inventário ─────────────────────────

export const INVENTORY_TAXONOMY_KEY = 'sc_inventory_taxonomy_v1';
export const INVENTORY_TAXONOMY_UPDATED_EVENT = 'sc_inventory_taxonomy_updated';

export const DEFAULT_INVENTORY_TAXONOMY = {
  'Arma Pessoal': ['Rifle de Assalto','Rifle de Sniper','Espingarda (Shotgun)','SMG','Pistola','Lança-granadas','Lança-foguetes','Arma Melee','Munição'],
  'Acessório de Arma': ['Mira/Scope','Supressor','Lanterna Tática','Carregador','Underbarrel','Empunhadura'],
  'Armadura FPS': ['Capacete','Torso','Braços','Pernas','Mochila','Set Completo','Undersuit'],
  'Roupa': ['Chapéu / Boné','Jaqueta','Camisa','Calça','Calçado','Luvas','Óculos','Macacão'],
  'Componente de Nave': ['Arma de Nave','Escudo','Propulsor Quântico','Planta de Energia','Cooler','Thruster','Radar/Avionics','Módulo de Mining','Módulo de Salvage','Módulo de Fabricação'],
  'Utilitário': ['Medpen','Stimpak','Multi-Tool','Extrator de Mining','Faca / Multifaca','Tractor Beam','Docking Collar','Scanner','Gadget'],
  'Recurso / Minério': ['Quantainium','Bexalite','Taranite','Borase','Laranite','Agricium','Titanium','Copper','Iron','Gold','Corundum','Hephaestanite','Dolivine'],
  'Commodity': ['Processed Food','Medical Supplies','Stims','Agricultural Supplies','Hydrogen Fuel','Quantum Fuel','Waste','Scrap','Altruciatoxin','Neon','Widow','WiDoW','GreenGro','SLAM'],
  'Blueprint': ['Blueprint de Arma','Blueprint de Armadura','Blueprint de Componente','Blueprint de Munição','Blueprint de Utilitário'],
  'Decoração / Flair': ['Trdeéu','Pintura de Nave','Decalque','Item de Hangar','Livro / Lore','Objeto Colecionável'],
  'Consumível': ['Bebida','Comida','Remédio','Explosivo','Sinalizador'],
  'Contrabando': ['Droga ilegal','Arma proibida','Item Contrabandoeado'],
  'Miscellaneous': ['Container','Item Desconhecido','Outro'],
};

const CATEGORY_COLORS = ['#fb7185','#ff7755','#38bdf8','#a78bfa','#6366f1','#34d399','#fbbf24','#f39c12','#9b59b6','#e91e63','#27ae60','#e74c3c','#7a90b0'];

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INVENTORY_TAXONOMY_KEY));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function emitUpdate(value) {
  window.dispatchEvent(new CustomEvent(INVENTORY_TAXONOMY_UPDATED_EVENT, { detail: value }));
}

function normalizeSubcategory(value, categoryId, index = 0, builtIn = false) {
  const name = String(value?.name || value?.label || value || '').trim();
  if (!name) return null;
  const now = new Date().toISOString();
  return {
    id: String(value?.id || `subcategory-${categoryId}-${slug(name) || index}`),
    name,
    active: value?.active !== false,
    builtIn: value?.builtIn === true || builtIn,
    notes: String(value?.notes || '').trim(),
    createdAt: value?.createdAt || now,
    updatedAt: value?.updatedAt || now,
  };
}

function normalizeCategory(value, index = 0, builtIn = false) {
  const name = String(value?.name || value?.label || '').trim();
  if (!name) return null;
  const id = String(value?.id || `category-${slug(name) || index}`);
  const sourceSubcategories = Array.isArray(value?.subcategories) ? value.subcategories : [];
  const seen = new Set();
  const subcategories = sourceSubcategories
    .map((item, subIndex) => normalizeSubcategory(item, id, subIndex, builtIn))
    .filter(item => {
      if (!item) return false;
      const identity = item.name.toLocaleLowerCase();
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  const now = new Date().toISOString();
  return {
    id,
    name,
    color: String(value?.color || CATEGORY_COLORS[index % CATEGORY_COLORS.length]),
    active: value?.active !== false,
    builtIn: value?.builtIn === true || builtIn,
    notes: String(value?.notes || '').trim(),
    subcategories,
    createdAt: value?.createdAt || now,
    updatedAt: value?.updatedAt || now,
  };
}

function buildSeed() {
  return Object.entries(DEFAULT_INVENTORY_TAXONOMY)
    .map(([name, subcategories], index) => normalizeCategory({
      name,
      subcategories: subcategories.map(subcategory => ({ name: subcategory, builtIn: true })),
      builtIn: true,
    }, index, true))
    .filter(Boolean);
}

function normalizeTaxonomy(value) {
  const source = Array.isArray(value) ? value : [];
  const seed = buildSeed();
  const rows = source.length ? source : seed;
  const result = [];
  const seen = new Set();
  rows.forEach((item, index) => {
    const category = normalizeCategory(item, index, !source.length);
    if (!category) return;
    const identity = category.name.toLocaleLowerCase();
    if (seen.has(identity)) return;
    seen.add(identity);
    result.push(category);
  });
  return result.length ? result : seed;
}

export function loadInventoryTaxonomy() {
  const current = parseStored();
  if (current) {
    const normalized = normalizeTaxonomy(current.categories || current);
    return normalized;
  }
  const seed = buildSeed();
  localStorage.setItem(INVENTORY_TAXONOMY_KEY, JSON.stringify(seed));
  return seed;
}

export function saveInventoryTaxonomy(categories) {
  const normalized = normalizeTaxonomy(categories);
  localStorage.setItem(INVENTORY_TAXONOMY_KEY, JSON.stringify(normalized));
  emitUpdate(normalized);
  return normalized;
}

export function getInventoryCategoryOptions(currentValue = '', categories = loadInventoryTaxonomy()) {
  const rows = Array.isArray(categories) ? categories : [];
  const options = rows.filter(item => item.active !== false || item.name === currentValue);
  if (options.length || !currentValue) return options;
  return [{ id: `legacy-category-${slug(currentValue)}`, name: currentValue, active: false, builtIn: false, subcategories: [] }];
}

export function getInventorySubcategoryOptions(categoryName, currentValue = '', categories = loadInventoryTaxonomy()) {
  const category = (categories || []).find(item => item.name === categoryName);
  const rows = Array.isArray(category?.subcategories) ? category.subcategories : [];
  const options = rows.filter(item => item.active !== false || item.name === currentValue);
  if (options.length || !currentValue) return options;
  return [{ id: `legacy-subcategory-${slug(categoryName)}-${slug(currentValue)}`, name: currentValue, active: false, builtIn: false }];
}

export function upsertInventoryCategory(category) {
  const current = loadInventoryTaxonomy();
  const normalized = normalizeCategory(category, current.length);
  if (!normalized) throw new Error('O nome da categoria é obrigatório.');
  const duplicate = current.find(item => item.name.toLocaleLowerCase() === normalized.name.toLocaleLowerCase() && item.id !== normalized.id);
  if (duplicate) throw new Error('Já existe uma categoria com este nome.');
  const existing = current.find(item => item.id === normalized.id);
  const next = [...current.filter(item => item.id !== normalized.id), { ...normalized, createdAt: existing?.createdAt || normalized.createdAt }];
  return saveInventoryTaxonomy(next);
}

export function toggleInventoryCategory(id) {
  const current = loadInventoryTaxonomy();
  return saveInventoryTaxonomy(current.map(item => item.id === id ? { ...item, active: item.active === false, updatedAt: new Date().toISOString() } : item));
}

export function removeInventoryCategory(id) {
  const current = loadInventoryTaxonomy();
  return saveInventoryTaxonomy(current.filter(item => item.id !== id));
}

export function upsertInventorySubcategory(categoryId, subcategory) {
  const current = loadInventoryTaxonomy();
  const category = current.find(item => item.id === categoryId);
  if (!category) throw new Error('Categoria não encontrada.');
  const normalized = normalizeSubcategory(subcategory, categoryId, category.subcategories.length);
  if (!normalized) throw new Error('O nome da subcategoria é obrigatório.');
  const duplicate = category.subcategories.find(item => item.name.toLocaleLowerCase() === normalized.name.toLocaleLowerCase() && item.id !== normalized.id);
  if (duplicate) throw new Error('Já existe uma subcategoria com este nome nesta categoria.');
  const existing = category.subcategories.find(item => item.id === normalized.id);
  const updatedCategory = {
    ...category,
    updatedAt: new Date().toISOString(),
    subcategories: [...category.subcategories.filter(item => item.id !== normalized.id), { ...normalized, createdAt: existing?.createdAt || normalized.createdAt }],
  };
  return saveInventoryTaxonomy(current.map(item => item.id === categoryId ? updatedCategory : item));
}

export function toggleInventorySubcategory(categoryId, subcategoryId) {
  const current = loadInventoryTaxonomy();
  return saveInventoryTaxonomy(current.map(category => category.id !== categoryId ? category : {
    ...category,
    updatedAt: new Date().toISOString(),
    subcategories: category.subcategories.map(item => item.id === subcategoryId ? { ...item, active: item.active === false, updatedAt: new Date().toISOString() } : item),
  }));
}

export function removeInventorySubcategory(categoryId, subcategoryId) {
  const current = loadInventoryTaxonomy();
  return saveInventoryTaxonomy(current.map(category => category.id !== categoryId ? category : {
    ...category,
    updatedAt: new Date().toISOString(),
    subcategories: category.subcategories.filter(item => item.id !== subcategoryId),
  }));
}

export function getInventoryTaxonomyStats(categories = loadInventoryTaxonomy()) {
  const rows = Array.isArray(categories) ? categories : [];
  return {
    categories: rows.length,
    activeCategories: rows.filter(item => item.active !== false).length,
    subcategories: rows.reduce((total, item) => total + item.subcategories.length, 0),
    activeSubcategories: rows.reduce((total, item) => total + item.subcategories.filter(subcategory => subcategory.active !== false).length, 0),
  };
}

export default loadInventoryTaxonomy;
