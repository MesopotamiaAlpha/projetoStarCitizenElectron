// ── UEX Marketplace Negotiations / Notifications ────────────────────────────
// Consulta as negociações do Marketplace UEX e as mensagens de cada uma,
// mantendo localmente o controle do que já foi visto para gerar o badge
// "você tem uma nova mensagem".

const TOKEN_KEY     = 'sc_uex_token_v1';
const SECRET_KEY    = 'sc_uex_secretkey_v1';
const USERNAME_KEY  = 'sc_uex_username_v1';
const STATE_KEY      = 'sc_uex_notif_state_v1'; // { lastCheck, seenMessageIds:[], seenNotifIds:[] }

export function loadToken()      { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
export function loadSecretKey()  { try { return localStorage.getItem(SECRET_KEY) || ''; } catch { return ''; } }
export function saveSecretKey(v) { localStorage.setItem(SECRET_KEY, v); }
export function clearSecretKey() { localStorage.removeItem(SECRET_KEY); }
export function loadUsername()   { try { return localStorage.getItem(USERNAME_KEY) || ''; } catch { return ''; } }

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATE_KEY));
    return {
      lastCheck: raw?.lastCheck || 0,
      seenMessageIds: Array.isArray(raw?.seenMessageIds) ? raw.seenMessageIds : [],
      seenNotifIds: Array.isArray(raw?.seenNotifIds) ? raw.seenNotifIds : [],
    };
  } catch {
    return { lastCheck: 0, seenMessageIds: [], seenNotifIds: [] };
  }
}
function saveState(state) { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }

// ── Low-level fetch wrapper (Electron IPC obrigatório p/ estes endpoints) ───
async function uexAuthFetch(endpoint) {
  const token = loadToken();
  const secretKey = loadSecretKey();
  if (!token) throw new Error('Configure seu token UEX antes de checar mensagens.');
  if (!window.electronAPI?.uexFetch) {
    throw new Error('Notificações de negociação só funcionam no app Electron (não no navegador).');
  }
  const result = await window.electronAPI.uexFetch({ endpoint, token, secretKey });
  if (result.success) return result.data;
  throw new Error(result.message || 'Erro na API UEX');
}

/** Lista todas as negociações (deals) associadas ao usuário do token. */
export async function fetchNegotiations() {
  const data = await uexAuthFetch('marketplace_negotiations');
  return Array.isArray(data) ? data : [];
}

/** Mensagens de uma negociação específica (pelo hash). */
export async function fetchNegotiationMessages(hash) {
  const data = await uexAuthFetch(`marketplace_negotiations_messages?hash=${encodeURIComponent(hash)}`);
  return Array.isArray(data) ? data : [];
}

/** Notificações gerais da conta UEX (sino amplo). */
export async function fetchUserNotifications() {
  const data = await uexAuthFetch('user_notifications');
  return Array.isArray(data) ? data : [];
}

/**
 * Verifica se há mensagens novas em negociações ativas + notificações gerais
 * ainda não vistas. Retorna um resumo consolidado e marca como "conhecido"
 * (mas não como lido — isso só acontece quando o usuário abrir/dispensar).
 */
export async function checkForUpdates() {
  const state = loadState();
  const myUsername = loadUsername().trim().toLowerCase();
  const firstRun = state.lastCheck === 0;

  const [negotiations, notifications] = await Promise.all([
    fetchNegotiations().catch(() => []),
    fetchUserNotifications().catch(() => []),
  ]);

  // Só vasculha mensagens de negociações com atividade recente (evita 1 chamada por deal).
  const activeNegotiations = negotiations.filter(n => !n.date_closed);
  const recentlyActive = firstRun
    ? activeNegotiations
    : activeNegotiations.filter(n => (n.date_modified || 0) * 1000 >= state.lastCheck - 5 * 60 * 1000);

  const newMessages = [];
  for (const neg of recentlyActive) {
    let msgs = [];
    try { msgs = await fetchNegotiationMessages(neg.hash); } catch { continue; }
    for (const m of msgs) {
      if (!m.message) continue; // ignora eventos internos sem texto
      const isMine = myUsername && (m.user_username || '').trim().toLowerCase() === myUsername;
      const alreadySeen = state.seenMessageIds.includes(m.id);
      if (isMine || alreadySeen) continue;
      if (!firstRun) {
        newMessages.push({
          id: m.id,
          negotiationHash: neg.hash,
          listingTitle: m.listing_title,
          listingSlug: m.listing_slug,
          fromUser: m.user_username,
          message: m.message,
          dateAdded: (m.date_added || 0) * 1000,
        });
      }
      state.seenMessageIds.push(m.id);
    }
  }

  const newNotifications = [];
  for (const n of notifications) {
    const alreadySeen = state.seenNotifIds.includes(n.id);
    if (alreadySeen) continue;
    if (!firstRun && !n.date_read) {
      newNotifications.push({
        id: n.id,
        message: n.message,
        redir: n.redir,
        dateAdded: (n.date_added || 0) * 1000,
      });
    }
    state.seenNotifIds.push(n.id);
  }

  // Mantém as listas de "já visto" de um tamanho razoável.
  state.seenMessageIds = state.seenMessageIds.slice(-500);
  state.seenNotifIds = state.seenNotifIds.slice(-500);
  state.lastCheck = Date.now();
  saveState(state);

  newMessages.sort((a, b) => b.dateAdded - a.dateAdded);
  newNotifications.sort((a, b) => b.dateAdded - a.dateAdded);

  return {
    newMessages,
    newNotifications,
    totalUnread: newMessages.length + newNotifications.length,
    negotiations,
  };
}

/** Marca tudo como visto sem gerar itens novos (usado pelo botão "marcar tudo como lido"). */
export function dismissAll() {
  const state = loadState();
  state.lastCheck = Date.now();
  saveState(state);
}
