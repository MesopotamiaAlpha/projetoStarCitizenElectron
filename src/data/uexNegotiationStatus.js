// ── Status de fechamento das negociações UEX ───────────────────────────────────
// A API 2.0 retorna dois campos de encerramento: date_closed e
// date_closed_client. O segundo é especialmente importante quando a conta é o
// comprador, pois representa o fechamento registrado pelo lado do cliente.

const CLOSURE_FIELDS = Object.freeze([
  'date_closed',
  'date_closed_client',
  'dateClosed',
  'dateClosedClient',
  'closed_at',
  'closedAt',
]);

function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(String(value).trim())) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    // A API UEX usa Unix timestamp em segundos, mas alguns backups locais podem
    // conter milissegundos. O retorno deste módulo é sempre em segundos.
    return numeric > 100000000000 ? numeric / 1000 : numeric;
  }

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed / 1000 : null;
}

/**
 * Retorna o timestamp de fechamento mais recente conhecido, em segundos.
 * Qualquer um dos campos de fechamento é suficiente para considerar a
 * negociação encerrada; quando os dois existem, o mais recente é preservado.
 */
export function getNegotiationClosedAt(negotiation) {
  const timestamps = CLOSURE_FIELDS
    .map(field => normalizeTimestamp(negotiation?.[field]))
    .filter(value => value !== null);
  return timestamps.length ? Math.max(...timestamps) : null;
}

export function isNegotiationClosed(negotiation) {
  return getNegotiationClosedAt(negotiation) !== null;
}

export function getNegotiationClosureField(negotiation) {
  const candidates = CLOSURE_FIELDS.filter(field => normalizeTimestamp(negotiation?.[field]) !== null);
  return candidates[0] || null;
}

export default isNegotiationClosed;
