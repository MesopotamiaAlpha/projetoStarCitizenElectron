// ── Status de fechamento das negociações UEX ───────────────────────────────────
// A API 2.0 retorna dois campos de encerramento: date_closed e
// date_closed_client. O segundo é especialmente importante quando a conta é o
// comprador, pois representa o fechamento registrado pelo lado do cliente.

const CLOSURE_FIELDS = Object.freeze([
  'date_closed',
  'date_closed_client',
  'date_closed_buyer',
  'date_closed_seller',
  'dateClosed',
  'dateClosedClient',
  'dateClosedBuyer',
  'dateClosedSeller',
  'closed_at',
  'closedAt',
  'closed_date',
  'closedDate',
]);

const CLOSURE_FLAG_FIELDS = Object.freeze([
  'closed',
  'is_closed',
  'isClosed',
  'completed',
  'is_completed',
  'isCompleted',
]);

const STATUS_FIELDS = Object.freeze(['status', 'deal_status', 'negotiation_status', 'state']);
const CLOSED_STATUS_VALUES = new Set(['closed', 'completed', 'complete', 'success', 'successful', 'failed', 'cancelled', 'canceled', 'ended', 'expired', 'rejected', 'declined']);

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

function isTruthyClosureFlag(value) {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'closed', 'completed', 'complete'].includes(normalized);
}

function hasClosedStatus(negotiation) {
  return STATUS_FIELDS.some(field => CLOSED_STATUS_VALUES.has(String(negotiation?.[field] ?? '').trim().toLowerCase()));
}

function hasFinalDealValue(negotiation) {
  // A `deal_value` não é o preço inicial: a documentação da UEX informa que
  // este campo é preenchido pelo lado pagador no fechamento bem-sucedido.
  return negotiation?.deal_value !== null
    && negotiation?.deal_value !== undefined
    && String(negotiation.deal_value).trim() !== '';
}

export function isNegotiationClosed(negotiation) {
  if (getNegotiationClosedAt(negotiation) !== null) return true;
  if (CLOSURE_FLAG_FIELDS.some(field => isTruthyClosureFlag(negotiation?.[field]))) return true;
  if (hasClosedStatus(negotiation)) return true;
  return hasFinalDealValue(negotiation);
}

export function getNegotiationClosureField(negotiation) {
  const dateField = CLOSURE_FIELDS.find(field => normalizeTimestamp(negotiation?.[field]) !== null);
  if (dateField) return dateField;
  const flagField = CLOSURE_FLAG_FIELDS.find(field => isTruthyClosureFlag(negotiation?.[field]));
  if (flagField) return flagField;
  const statusField = STATUS_FIELDS.find(field => CLOSED_STATUS_VALUES.has(String(negotiation?.[field] ?? '').trim().toLowerCase()));
  if (statusField) return statusField;
  return hasFinalDealValue(negotiation) ? 'deal_value' : null;
}

export default isNegotiationClosed;
