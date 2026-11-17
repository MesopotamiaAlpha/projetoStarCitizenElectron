// ── Persistência compartilhada do Acompanhamento UEX ─────────────────────────
// O módulo é usado pela tela de Vendas e pelo chat de Negociações para que uma
// negociação concluída possa criar/atualizar o mesmo catálogo local sem duplicar.
import { readJson, writeJson, dispatchStorageEvent } from '../utils/storage';
import { consumeVaultEntries } from './oreVault';
import { getNegotiationClosedAt } from './uexNegotiationStatus';

const SALES_KEY = 'sc_uex_sales_v1';
const CATALOG_KEY = 'sc_uex_catalog_v1';

function loadArray(key) {
  const parsed = readJson(key, []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveArray(key, value) {
  return writeJson(key, Array.isArray(value) ? value : []);
}

export function loadUexSales() { return loadArray(SALES_KEY); }
export function saveUexSales(value) { saveArray(SALES_KEY, value); }
export function loadUexCatalog() { return loadArray(CATALOG_KEY); }
export function saveUexCatalog(value) { saveArray(CATALOG_KEY, value); }

export function numericValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(String(value).replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function textValue(...values) {
  return values.map(value => String(value || '').trim()).find(Boolean) || '';
}

function normalizeIdentity(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractQualityFromTitle(title) {
  const match = String(title || '').match(/(\d+)\s*Q\b/i);
  return match ? match[1] : '';
}

function isListingAdvertiser(negotiation) {
  return Number(negotiation?.is_listing_advertiser) === 1 || negotiation?.is_listing_advertiser === true;
}

function negotiationListingId(negotiation) {
  return textValue(
    negotiation?.listing_id,
    negotiation?.id_listing,
    negotiation?.listing?.id,
    negotiation?.listing?.listing_id,
  );
}

function negotiationHash(negotiation) {
  return textValue(negotiation?.hash, negotiation?.negotiation_hash, negotiation?.id);
}

export function buildNegotiationSale(negotiation, overrides = {}) {
  const title = textValue(
    negotiation?.listing_title,
    negotiation?.item_name,
    negotiation?.item?.name,
    negotiation?.title,
    negotiation?.name,
  );
  const quantity = Math.max(1, Math.round(numericValue(
    overrides?.quantity,
    overrides?.qty,
    negotiation?.deal_quantity,
    negotiation?.quantity,
    negotiation?.qty,
    negotiation?.amount_quantity,
    1,
  )));
  const listedPrice = numericValue(
    negotiation?.price,
    negotiation?.listing_price,
    negotiation?.unit_price,
    negotiation?.item_price,
  );
  const dealValue = numericValue(negotiation?.deal_value, negotiation?.agreed_price, negotiation?.total_price);
  const overrideTotal = numericValue(overrides?.totalRevenue, overrides?.total_price, overrides?.value);
  const overrideUnitPrice = numericValue(overrides?.unitPrice, overrides?.price);
  const price = overrideUnitPrice || (overrideTotal ? overrideTotal / quantity : listedPrice || (dealValue ? dealValue / quantity : 0));
  const totalRevenue = overrideTotal || dealValue || price * quantity;
  const seller = isListingAdvertiser(negotiation);
  const buyer = seller
    ? textValue(negotiation?.client_username, negotiation?.buyer_username, negotiation?.buyer)
    : textValue(negotiation?.buyer_username, negotiation?.buyer, negotiation?.client_username, negotiation?.advertiser_username);
  const titleQuality = extractQualityFromTitle(title);
  const quality = textValue(
    negotiation?.quality,
    negotiation?.quality_level,
    negotiation?.item_quality,
    negotiation?.item?.quality,
    titleQuality,
  );
  const location = textValue(
    negotiation?.location,
    negotiation?.location_name,
    negotiation?.terminal_name,
    negotiation?.planet_name,
    negotiation?.moon_name,
    negotiation?.item_location,
  );
  const hash = negotiationHash(negotiation);
  const listingId = negotiationListingId(negotiation);
  const sourceSlug = textValue(negotiation?.listing_slug, negotiation?.slug, negotiation?.listing?.slug);
  const listedStock = numericValue(negotiation?.in_stock, negotiation?.listed_stock, negotiation?.stock);

  return {
    id: `negotiation-sale-${hash || Date.now()}`,
    title,
    price: Math.round(price),
    qty: quantity,
    total_revenue: Math.round(totalRevenue),
    quality,
    buyer,
    type: 'sold',
    date: Date.now() / 1000,
    date_closed: getNegotiationClosedAt(negotiation),
    location,
    currency: textValue(negotiation?.currency, negotiation?.deal_value_currency) || 'aUEC',
    notes: `Venda concluída pelo chat de Negociações UEX${hash ? ` · negociação ${hash}` : ''}.`,
    is_manual: false,
    source: 'uex_negotiation',
    negotiation_role: seller ? 'seller' : 'buyer',
    source_negotiation_hash: hash,
    source_listing_id: listingId,
    source_listing_slug: sourceSlug,
    listing_title: title,
    listed_stock: listedStock,
    created_at: new Date().toISOString(),
  };
}

function findCatalogEntry(catalog, sale) {
  return catalog.find(item => (
    sale.source_negotiation_hash && item.source_negotiation_hash === sale.source_negotiation_hash
  ) || (
    sale.source_listing_id && item.source_listing_id && String(item.source_listing_id) === String(sale.source_listing_id)
  ) || (
    normalizeIdentity(item.title) === normalizeIdentity(sale.title)
      && normalizeIdentity(item.location) === normalizeIdentity(sale.location)
  )) || null;
}

function buildCatalogEntry(existing, sale) {
  const currentStock = existing
    ? numericValue(existing.in_stock)
    : sale.listed_stock;
  const remainingStock = Math.max(0, currentStock > 0 ? currentStock - sale.qty : 0);
  return {
    ...(existing || {}),
    id: existing?.id ?? `negotiation-item-${sale.source_negotiation_hash || Date.now()}`,
    title: sale.title,
    price: sale.price,
    quality: sale.quality || existing?.quality || '',
    location: sale.location || existing?.location || '',
    availability: existing?.availability || 'immediate',
    source: existing?.source || 'looted',
    in_stock: remainingStock,
    is_sold_out: remainingStock <= 0 ? 1 : 0,
    internal_stock: existing?.internal_stock || 0,
    notes: existing?.notes || sale.notes,
    date_added: existing?.date_added || Math.floor(Date.now() / 1000),
    date_expiration: existing?.date_expiration || null,
    source_negotiation_hash: sale.source_negotiation_hash,
    source_listing_id: sale.source_listing_id,
    source_listing_slug: sale.source_listing_slug,
    last_sale_at: new Date().toISOString(),
    imported_at: existing?.imported_at || new Date().toISOString(),
  };
}

export async function registerNegotiationSale(negotiation, overrides = {}, consumers = {}) {
  const sale = buildNegotiationSale(negotiation, overrides);
  if (!sale.source_negotiation_hash) throw new Error('A negociação não possui hash identificador.');
  if (!sale.title) throw new Error('A negociação não informa o nome do item.');
  if (sale.total_revenue <= 0 || sale.price <= 0) throw new Error('A negociação não informa um preço válido para registrar a venda.');

  const sales = loadUexSales();
  const existingSaleIndex = sales.findIndex(item => item.source_negotiation_hash === sale.source_negotiation_hash);
  const previousSale = existingSaleIndex >= 0 ? sales[existingSaleIndex] : null;
  const savedSale = { ...sale, id: previousSale?.id || sale.id, created_at: previousSale?.created_at || sale.created_at };
  if (existingSaleIndex >= 0) sales[existingSaleIndex] = savedSale;
  else sales.unshift(savedSale);
  saveUexSales(sales);

  const catalog = loadUexCatalog();
  const existingCatalog = findCatalogEntry(catalog, sale);
  let vaultConsumption = previousSale?.vault_consumption_status === 'consumed'
    ? { success:true, status:'consumed', message:'A caixa desta negociação já foi descontada do Baú.', boxes:previousSale.vault_boxes || sale.qty, boxQuantity:previousSale.vault_box_quantity || 0, boxUnit:previousSale.vault_box_unit || 'un', quality:previousSale.vault_quality || '' }
    : { success:false, status:'not_linked', message:'Nenhum vínculo com o Baú foi configurado para este anúncio.' };
  if (existingCatalog?.vault_binding?.entryIds?.length && previousSale?.vault_consumption_status !== 'consumed') {
    const binding = existingCatalog.vault_binding;
    const boxQuantity = numericValue(binding.boxQuantity);
    const boxUnit = textValue(binding.boxUnit) || 'un';
    const totalToConsume = boxQuantity * sale.qty;
    vaultConsumption = consumeVaultEntries(binding.entryIds, totalToConsume, boxUnit);
    vaultConsumption = {
      ...vaultConsumption,
      status: vaultConsumption.success ? 'consumed' : 'failed',
      boxes: sale.qty,
      boxQuantity,
      boxUnit,
      quality: binding.quality || '',
      vault_boxes: sale.qty,
      vault_box_quantity: boxQuantity,
      vault_box_unit: boxUnit,
      vault_quality: binding.quality || '',
    };
  }
  savedSale.vault_consumption_status = vaultConsumption.status;
  savedSale.vault_consumed_at = vaultConsumption.success ? (previousSale?.vault_consumed_at || new Date().toISOString()) : (previousSale?.vault_consumed_at || null);
  savedSale.vault_boxes = vaultConsumption.boxes || previousSale?.vault_boxes || null;
  savedSale.vault_box_quantity = vaultConsumption.boxQuantity || previousSale?.vault_box_quantity || null;
  savedSale.vault_box_unit = vaultConsumption.boxUnit || previousSale?.vault_box_unit || null;
  savedSale.vault_quality = vaultConsumption.quality || previousSale?.vault_quality || '';

  let armorConsumption = previousSale?.armor_consumption_status === 'consumed'
    ? { success: true, status: 'consumed', consumed: true, message: 'A coleção de armaduras desta negociação já foi descontada.' }
    : { success: true, status: 'not_linked', consumed: false, message: 'Nenhum vínculo com a coleção de armaduras foi configurado.' };
  const inventoryBinding = existingCatalog?.inventory_binding || {};
  const armorPieceIds = Array.isArray(inventoryBinding.armorPieceIds) ? inventoryBinding.armorPieceIds : (Array.isArray(inventoryBinding.armor_piece_ids) ? inventoryBinding.armor_piece_ids : []);
  const armorSetIds = Array.isArray(inventoryBinding.armorSetIds) ? inventoryBinding.armorSetIds : (Array.isArray(inventoryBinding.armor_set_ids) ? inventoryBinding.armor_set_ids : []);
  if (!previousSale && (armorPieceIds.length || armorSetIds.length) && typeof consumers.onConsumeArmorStock === 'function') {
    armorConsumption = await consumers.onConsumeArmorStock({ pieceIds: armorPieceIds, setIds: armorSetIds, quantity: sale.qty });
    armorConsumption = {
      ...armorConsumption,
      status: armorConsumption?.success ? (armorConsumption?.consumed ? 'consumed' : 'not_linked') : 'failed',
      message: armorConsumption?.message || '',
    };
  }

  let inventoryConsumption = previousSale?.inventory_consumption_status === 'consumed'
    ? { success: true, status: 'consumed', consumed: true, message: 'O Inventário de Itens desta negociação já foi descontado.' }
    : { success: true, status: 'not_linked', consumed: false, message: 'Nenhum local do Inventário de Itens foi vinculado.' };
  const locationKeys = Array.isArray(inventoryBinding.locationKeys)
    ? inventoryBinding.locationKeys
    : (Array.isArray(inventoryBinding.location_keys) ? inventoryBinding.location_keys : (inventoryBinding.locationKey ? [inventoryBinding.locationKey] : []));
  if (!previousSale && locationKeys.length && typeof consumers.onConsumeInventoryStock === 'function') {
    inventoryConsumption = await consumers.onConsumeInventoryStock({ name: sale.title, locationKeys, quantity: sale.qty, listing: existingCatalog || sale });
    inventoryConsumption = {
      ...inventoryConsumption,
      status: inventoryConsumption?.success ? (inventoryConsumption?.consumed ? 'consumed' : 'not_linked') : 'failed',
      message: inventoryConsumption?.message || '',
    };
  }
  savedSale.armor_consumption_status = armorConsumption.status;
  savedSale.armor_consumed_at = armorConsumption.success && armorConsumption.consumed ? (previousSale?.armor_consumed_at || new Date().toISOString()) : (previousSale?.armor_consumed_at || null);
  savedSale.armor_consumption_message = armorConsumption.message || previousSale?.armor_consumption_message || '';
  savedSale.inventory_consumption_status = inventoryConsumption.status;
  savedSale.inventory_consumed_at = inventoryConsumption.success && inventoryConsumption.consumed ? (previousSale?.inventory_consumed_at || new Date().toISOString()) : (previousSale?.inventory_consumed_at || null);
  savedSale.inventory_consumption_message = inventoryConsumption.message || previousSale?.inventory_consumption_message || '';
  const savedSaleIndex = sales.findIndex(item => item.id === savedSale.id);
  if (savedSaleIndex >= 0) sales[savedSaleIndex] = savedSale;
  else sales.unshift(savedSale);
  saveUexSales(sales);

  const catalogEntry = previousSale
    ? { ...existingCatalog, price:sale.price, quality:sale.quality || existingCatalog?.quality || '', last_sale_at:new Date().toISOString() }
    : buildCatalogEntry(existingCatalog, sale);
  const catalogIndex = existingCatalog ? catalog.indexOf(existingCatalog) : -1;
  if (catalogIndex >= 0) catalog[catalogIndex] = catalogEntry;
  else catalog.unshift(catalogEntry);
  saveUexCatalog(catalog);
  dispatchStorageEvent('sc_uex_sales_updated', { hash: sale.source_negotiation_hash });

  return {
    sale: savedSale,
    catalogEntry,
    saleCreated: !previousSale,
    catalogCreated: !existingCatalog,
    vaultConsumption,
    armorConsumption,
    inventoryConsumption,
  };
}


const NEGOTIATION_CLOSURES_KEY = 'sc_uex_negotiation_closures_v1';

export function loadNegotiationClosures() {
  const parsed = readJson(NEGOTIATION_CLOSURES_KEY, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

export function getNegotiationClosure(hash) {
  const key = String(hash || '').trim();
  return key ? loadNegotiationClosures()[key] || null : null;
}

export function closeNegotiation(hash, status, details = {}) {
  const key = String(hash || '').trim();
  if (!key) throw new Error('Hash da negociação não informado.');
  if (!['success', 'failed'].includes(status)) throw new Error('Status de encerramento inválido.');
  const closures = loadNegotiationClosures();
  const entry = {
    hash: key,
    status,
    closedAt: new Date().toISOString(),
    ...details,
  };
  closures[key] = entry;
  writeJson(NEGOTIATION_CLOSURES_KEY, closures);
  dispatchStorageEvent('sc_uex_sales_updated', { hash: key, closure: entry });
  return entry;
}
