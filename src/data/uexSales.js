// ── Persistência compartilhada do Acompanhamento UEX ─────────────────────────
// O módulo é usado pela tela de Vendas e pelo chat de Negociações para que uma
// negociação concluída possa criar/atualizar o mesmo catálogo local sem duplicar.

const SALES_KEY = 'sc_uex_sales_v1';
const CATALOG_KEY = 'sc_uex_catalog_v1';

function loadArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveArray(key, value) {
  localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
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

export function buildNegotiationSale(negotiation) {
  const title = textValue(
    negotiation?.listing_title,
    negotiation?.item_name,
    negotiation?.item?.name,
    negotiation?.title,
    negotiation?.name,
  );
  const quantity = Math.max(1, Math.round(numericValue(
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
  const price = listedPrice || (dealValue ? dealValue / quantity : 0);
  const totalRevenue = dealValue || price * quantity;
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
    date_closed: negotiation?.date_closed || null,
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

export function registerNegotiationSale(negotiation) {
  const sale = buildNegotiationSale(negotiation);
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
  const catalogEntry = buildCatalogEntry(existingCatalog, sale);
  const catalogIndex = existingCatalog ? catalog.indexOf(existingCatalog) : -1;
  if (catalogIndex >= 0) catalog[catalogIndex] = catalogEntry;
  else catalog.unshift(catalogEntry);
  saveUexCatalog(catalog);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sc_uex_sales_updated', { detail: { hash: sale.source_negotiation_hash } }));
  }

  return {
    sale: savedSale,
    catalogEntry,
    saleCreated: !previousSale,
    catalogCreated: !existingCatalog,
  };
}


const NEGOTIATION_CLOSURES_KEY = 'sc_uex_negotiation_closures_v1';

export function loadNegotiationClosures() {
  try {
    const parsed = JSON.parse(localStorage.getItem(NEGOTIATION_CLOSURES_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
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
  localStorage.setItem(NEGOTIATION_CLOSURES_KEY, JSON.stringify(closures));
  return entry;
}
