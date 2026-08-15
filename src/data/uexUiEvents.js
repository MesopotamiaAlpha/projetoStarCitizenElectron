export const UEX_ACTIVE_NEGOTIATION_EVENT = 'sc_uex_active_negotiation_changed_v1';
export const UEX_TEXTS_UPDATED_EVENT = 'sc_uex_texts_updated_v1';
const ACTIVE_NEGOTIATION_SESSION_KEY = 'sc_uex_active_negotiation_v1';

export function getActiveNegotiationHash() {
  try { return sessionStorage.getItem(ACTIVE_NEGOTIATION_SESSION_KEY) || ''; } catch { return ''; }
}

export function dispatchUexUiEvent(name, detail = {}) {
  if (typeof window === 'undefined') return;
  if (name === UEX_ACTIVE_NEGOTIATION_EVENT) {
    try {
      const hash = String(detail?.hash || '').trim();
      if (hash) sessionStorage.setItem(ACTIVE_NEGOTIATION_SESSION_KEY, hash);
      else sessionStorage.removeItem(ACTIVE_NEGOTIATION_SESSION_KEY);
    } catch { /* sessão indisponível em alguns ambientes de teste */ }
  }
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
