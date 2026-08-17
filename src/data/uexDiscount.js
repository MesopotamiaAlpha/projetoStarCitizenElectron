export function numericPrice(value) {
  const parsed = Number(String(value ?? '').replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function recommendDiscount({ currentPrice, competitorPrices = [], undercutPercent = 1, maxDiscountPercent = 10 } = {}) {
  const previousPrice = Math.round(numericPrice(currentPrice));
  const prices = competitorPrices.map(numericPrice).filter(price => price > 0).sort((a, b) => a - b);
  if (!previousPrice || prices.length === 0) {
    return { status: 'insufficient_data', previousPrice, competitorCount: prices.length, competitorLowest: null, suggestedPrice: null, discountValue: 0, discountPercent: 0 };
  }

  const competitorLowest = Math.round(prices[0]);
  if (previousPrice <= competitorLowest) {
    return { status: 'already_competitive', previousPrice, competitorCount: prices.length, competitorLowest, suggestedPrice: previousPrice, discountValue: 0, discountPercent: 0 };
  }

  const desiredPrice = Math.max(1, Math.floor(competitorLowest * (1 - Math.max(0, undercutPercent) / 100)));
  const maximumDiscount = Math.floor(previousPrice * Math.max(0, maxDiscountPercent) / 100);
  const discountValue = Math.min(Math.max(0, previousPrice - desiredPrice), maximumDiscount || previousPrice - 1);
  const suggestedPrice = Math.max(1, previousPrice - discountValue);
  const discountPercent = previousPrice > 0 ? (discountValue / previousPrice) * 100 : 0;

  return { status: 'discount_recommended', previousPrice, competitorCount: prices.length, competitorLowest, suggestedPrice, discountValue, discountPercent };
}

export function extractActiveCompetitorPrices(response, { itemId, ownListingId, ownSourceListingId } = {}) {
  const rows = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
  return rows
    .filter(row => String(row?.operation || 'sell').toLowerCase() === 'sell')
    .filter(row => Number(row?.is_sold_out) !== 1 && String(row?.status || '').toLowerCase() !== 'closed')
    .filter(row => itemId == null || String(row?.id_item ?? row?.uex_item_id ?? '') === String(itemId))
    .filter(row => !ownListingId || String(row?.id ?? '') !== String(ownListingId))
    .filter(row => !ownSourceListingId || String(row?.id ?? '') !== String(ownSourceListingId))
    .map(row => numericPrice(row?.price))
    .filter(price => price > 0);
}
