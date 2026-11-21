// Inventário de Itens como fonte de material para o Tracking de Materiais.
//
// O Baú de Minério guarda minério a granel (SCU, com qualidade). Já gemas e partes de
// criaturas que os blueprints pedem como "item" (Yormandi Eye, Hadanite, Dolivine…) ficam
// no Inventário de Itens. Este módulo lê esse inventário e responde, para um material da
// fila, quanto há disponível — respeitando reservas e unidade — e prepara a baixa.
//
// Regras:
//  • nome: igualdade sem acento, caixa ou pontuação ("Saldynium (Ore)" = "saldynium ore");
//  • unidade: unidades de carga são intercambiáveis entre si; as demais precisam coincidir
//    ("un", "item", "pcs"… contam como a mesma unidade); contagem nunca vira SCU;
//  • disponível = quantidade − reservas (itens reservados para negociação não contam);
//  • o inventário NÃO registra qualidade numérica, então ele só atende materiais SEM
//    exigência de qualidade (Q livre). Não dá para provar que um item cumpre "Q≥800".
import { normalizeCargoUnit, isCargoUnit, toCargoBase, fromCargoBase, roundCargo } from './cargoUnits';

const COUNT_UNIT_ALIASES = new Set(['', 'un', 'und', 'unit', 'units', 'unidade', 'unidades', 'item', 'items', 'itens', 'x', 'pc', 'pcs', 'peca', 'pecas']);
const JSON_FIELDS = ['craft_status', 'craft_materials', 'craft_attachments', 'reservations'];

function stripAccents(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// "Carinite(Pure)", "carinite  (pure)" e "Carinite (Pure) 0" (resíduo de importação) viram a mesma chave.
export function normalizeMaterialMatchName(value) {
  return stripAccents(value)
    .replace(/[\u0000\r\n]+/g, ' ')
    .replace(/\s+0$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function canonicalInventoryUnit(unit) {
  const normalized = normalizeCargoUnit(unit);
  if (isCargoUnit(normalized)) return normalized;
  const text = stripAccents(unit).trim().toLowerCase();
  return COUNT_UNIT_ALIASES.has(text) ? 'un' : text;
}

export function inventoryUnitsCompatible(itemUnit, requiredUnit) {
  const a = canonicalInventoryUnit(itemUnit);
  const b = canonicalInventoryUnit(requiredUnit);
  return isCargoUnit(a) && isCargoUnit(b) ? true : a === b;
}

function toBaseQuantity(quantity, unit) {
  const canonical = canonicalInventoryUnit(unit);
  return isCargoUnit(canonical) ? toCargoBase(quantity, canonical) : Number(quantity) || 0;
}

function fromBaseQuantity(base, unit) {
  const canonical = canonicalInventoryUnit(unit);
  return isCargoUnit(canonical) ? fromCargoBase(base, canonical) : Number(base) || 0;
}

// O banco guarda esses campos como TEXTO JSON. Aceita lista, texto e até texto codificado duas vezes.
export function parseInventoryJsonList(value) {
  let parsed = value;
  for (let depth = 0; depth < 3 && typeof parsed === 'string'; depth += 1) {
    const raw = parsed.trim();
    if (!raw) return [];
    try { parsed = JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(parsed)) return parsed.filter(Boolean);
  return parsed && typeof parsed === 'object' ? [parsed] : [];
}

export function inventoryReservedQuantity(item) {
  return parseInventoryJsonList(item?.reservations)
    .reduce((total, reservation) => total + Math.max(0, Number(reservation?.quantity ?? reservation?.amount) || 0), 0);
}

/**
 * Converte as linhas do inventário (cruas do banco ou já tratadas) para um formato
 * estável. Mantém a linha original em `raw` para a gravação.
 */
export function normalizeInventoryStockItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter(item => item && item.id !== undefined && item.id !== null)
    .map(item => {
      if (item.stock === true) return item; // já normalizado (preserva as reservas já calculadas)
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const reserved = inventoryReservedQuantity(item);
      return {
        stock: true,
        id: item.id,
        name: String(item.name || '').replace(/[\u0000\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(),
        category: String(item.category || ''),
        quantity,
        unit: canonicalInventoryUnit(item.unit),
        reserved,
        available: Math.max(0, quantity - reserved),
        system: String(item.system || ''),
        location_type: String(item.location_type || ''),
        location_name: String(item.location_name || ''),
        container: String(item.container || ''),
        raw: item,
      };
    });
}

export function inventoryLocationLabel(item) {
  return [item?.location_name, item?.container].map(part => String(part || '').trim()).filter(Boolean).join(' · ')
    || String(item?.system || '').trim();
}

/**
 * O item do inventário atende a este material? `requirement` = { material_name, unit, quality_min }.
 */
export function inventoryMatchesRequirement(item, requirement) {
  if (!item || !requirement) return false;
  if ((Number(requirement.quality_min) || 0) > 0) return false; // inventário não tem qualidade registrada
  if (!normalizeMaterialMatchName(requirement.material_name)) return false;
  if (normalizeMaterialMatchName(item.name) !== normalizeMaterialMatchName(requirement.material_name)) return false;
  return inventoryUnitsCompatible(item.unit, requirement.unit);
}

/** Itens do inventário que atendem ao material, com a quantidade disponível. */
export function inventoryStockEntries(items, requirement) {
  const normalized = normalizeInventoryStockItems(items);
  return normalized
    .filter(item => item.available > 0 && inventoryMatchesRequirement(item, requirement))
    .map(item => ({
      ...item,
      availableBase: roundCargo(toBaseQuantity(item.available, item.unit)),
      availableInRequirementUnit: fromBaseQuantity(toBaseQuantity(item.available, item.unit), requirement.unit),
    }));
}

/**
 * Há itens deste nome no inventário que NÃO foram contados apenas por causa da exigência de
 * qualidade? Serve para a tela explicar por que, por exemplo, o Titanium do inventário não vale para Q≥800.
 */
export function inventoryBlockedByQuality(items, requirement) {
  if ((Number(requirement?.quality_min) || 0) <= 0) return false;
  return normalizeInventoryStockItems(items)
    .some(item => item.available > 0 && inventoryMatchesRequirement(item, { ...requirement, quality_min: 0 }));
}

/** Total disponível (em unidade-base) para o material. */
export function inventoryAvailableBase(items, requirement) {
  return roundCargo(inventoryStockEntries(items, requirement).reduce((total, entry) => total + entry.availableBase, 0));
}

/**
 * Payload seguro para `inventoryUpdate`.
 * O handler do Electron faz JSON.stringify em craft_status/craft_materials/craft_attachments/
 * reservations; reenviar a linha crua (onde já são TEXTO JSON) gravaria esses campos
 * codificados duas vezes, e a tela do Inventário passaria a lê-los como vazios.
 */
export function buildInventoryUpdatePayload(row, quantity) {
  const payload = { ...row, quantity: Math.max(0, Number(quantity) || 0) };
  JSON_FIELDS.forEach(field => { payload[field] = parseInventoryJsonList(row?.[field]); });
  return payload;
}

function readBrowserInventory() {
  try {
    const stored = JSON.parse(localStorage.getItem('sc_inventory_v1') || '{"itens":[]}');
    return Array.isArray(stored?.itens) ? stored.itens : [];
  } catch {
    return [];
  }
}

export function getInventoryApi() {
  return typeof window !== 'undefined' ? window.electronAPI || null : null;
}

/**
 * Lê o inventário (Electron via IPC; navegador via localStorage).
 * Nunca lança: sem inventário disponível devolve listas vazias.
 */
export async function loadInventoryStock({ api = getInventoryApi() } = {}) {
  try {
    const rows = api?.inventoryGetAll ? await api.inventoryGetAll() : readBrowserInventory();
    const safeRows = Array.isArray(rows) ? rows : [];
    return { rows: safeRows, items: normalizeInventoryStockItems(safeRows), available: Boolean(api?.inventoryGetAll) };
  } catch {
    return { rows: [], items: [], available: false };
  }
}
