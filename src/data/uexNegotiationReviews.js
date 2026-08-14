const REVIEWS_KEY = 'sc_uex_negotiation_reviews_v1';

function loadAll() {
  try {
    const value = JSON.parse(localStorage.getItem(REVIEWS_KEY));
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function saveAll(value) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(value));
}

export function loadNegotiationReview(hash) {
  if (!hash) return null;
  return loadAll()[hash] || null;
}

export function saveNegotiationReview(hash, review) {
  if (!hash) throw new Error('Negociação sem identificador.');
  const all = loadAll();
  const normalized = {
    negotiation_hash: hash,
    rating: Math.max(1, Math.min(5, Number(review.rating) || 0)),
    comment: String(review.comment || '').trim(),
    status: 'saved_locally_pending_uex',
    saved_at: new Date().toISOString(),
  };
  all[hash] = normalized;
  saveAll(all);
  return normalized;
}

export function buildCompletionMessage(negotiation, review) {
  const counterpart = negotiation?.is_listing_advertiser
    ? negotiation?.client_username
    : negotiation?.advertiser_username;
  const greeting = counterpart ? `Olá, @${counterpart}!` : 'Olá!';
  const rating = Number(review?.rating) || 0;
  const comment = String(review?.comment || '').trim();
  return `${greeting}\n\nNegociação concluída. Obrigado pela negociação!\n\nAvaliação: ${'★'.repeat(rating)}${'☆'.repeat(Math.max(0, 5 - rating))}${comment ? `\nComentário: ${comment}` : ''}`;
}

export { REVIEWS_KEY };
