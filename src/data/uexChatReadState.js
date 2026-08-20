const CHAT_READ_STATE_KEY = 'sc_uex_chat_read_state_v1';
export const UEX_CHAT_READ_STATE_UPDATED_EVENT = 'sc_uex_chat_read_state_updated';

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function loadUexChatReadState() {
  try {
    return safeObject(JSON.parse(localStorage.getItem(CHAT_READ_STATE_KEY) || '{}'));
  } catch {
    return {};
  }
}

export function negotiationActivityStamp(negotiation) {
  const values = [negotiation?.date_modified, negotiation?.updated_at, negotiation?.date_added]
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value > 0);
  return values.length ? Math.max(...values) : 0;
}

export function isUexChatUnread(negotiation, state = loadUexChatReadState()) {
  const hash = String(negotiation?.hash || negotiation?.id || '').trim();
  if (!hash) return false;
  const activity = negotiationActivityStamp(negotiation);
  const readAt = Number(state?.[hash]?.readAt || 0);
  return activity > 0 && (!readAt || activity > readAt);
}

export function markUexChatRead(negotiation) {
  const hash = String(negotiation?.hash || negotiation?.id || '').trim();
  if (!hash) return loadUexChatReadState();
  const next = { ...loadUexChatReadState(), [hash]: { readAt: negotiationActivityStamp(negotiation) || Date.now() / 1000 } };
  try {
    localStorage.setItem(CHAT_READ_STATE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(UEX_CHAT_READ_STATE_UPDATED_EVENT, { detail: { hash } }));
  } catch { /* armazenamento local indisponível */ }
  return next;
}

export function clearUexChatReadState() {
  try { localStorage.removeItem(CHAT_READ_STATE_KEY); } catch { /* noop */ }
}
