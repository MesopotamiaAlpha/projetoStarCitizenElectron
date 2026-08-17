// ── UEX Marketplace Negotiations / Notifications ────────────────────────────
import { isNegotiationClosed } from './uexNegotiationStatus';

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

/**
 * Constrói a URL pública correta do anúncio UEX.
 * A API retorna o listing_slug, mas o site exige /marketplace/item/info/{slug}/.
 */
export function buildUexListingUrl(listingSlug) {
  const fallback = 'https://uexcorp.space/marketplace/';
  const raw = String(listingSlug || '').trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^\/+|\/+$/g, '');
  if (clean.startsWith('marketplace/item/info/')) return `https://uexcorp.space/${clean}/`;
  if (clean.startsWith('item/info/')) return `https://uexcorp.space/marketplace/${clean}/`;
  return `https://uexcorp.space/marketplace/item/info/${clean}/`;
}

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

function normalizedText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeUexUsername(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '')
    .toLocaleLowerCase();
}

export function getNegotiationMessageSender(message) {
  return String(
    message?.user_username
      || message?.username
      || message?.from_username
      || message?.fromUser
      || message?.user_name
      || message?.user?.username
      || message?.user?.name
      || '',
  ).trim();
}

export function isOwnNegotiationMessage(message, currentUsername = '', negotiation = null) {
  const sender = normalizeUexUsername(getNegotiationMessageSender(message));
  if (!sender) return false;

  const configured = normalizeUexUsername(currentUsername);
  if (configured && sender === configured) return true;

  // Fallback para quando o username local não foi configurado ou está antigo:
  // a API informa se a conta autenticada é o anunciante (vendedor) ou o cliente
  // (comprador), permitindo comparar com o participante correto da negociação.
  const currentParticipant = Number(negotiation?.is_listing_advertiser) === 1 || negotiation?.is_listing_advertiser === true
    ? negotiation?.advertiser_username
    : negotiation?.client_username;
  return Boolean(currentParticipant) && sender === normalizeUexUsername(currentParticipant);
}

function notificationMessageText(value) {
  const normalized = normalizedText(value);
  // Algumas notificações vêm com "usuario: mensagem", enquanto a mensagem
  // da negociação contém somente o texto depois dos dois-pontos.
  const separator = normalized.indexOf(':');
  return separator >= 0 ? normalized.slice(separator + 1).trim() : normalized;
}

export function isCrossFeedDuplicate(message, notification) {
  const messageText = normalizedText(message?.message);
  const notificationText = notificationMessageText(notification?.message);
  if (!messageText || !notificationText || messageText !== notificationText) return false;

  const messageUser = normalizedText(message?.fromUser || message?.user_username);
  const notificationUser = notificationMessageText(notification?.fromUser || notification?.user_username);
  if (notificationUser && messageUser && notificationUser !== messageUser && !notificationMessageText(notification?.message).startsWith(`${messageUser}:`)) return false;

  const messageTime = Number(message?.dateAdded || message?.date_added || 0);
  const notificationTime = Number(notification?.dateAdded || notification?.date_added || 0);
  return !messageTime || !notificationTime || Math.abs(messageTime - notificationTime) <= 5 * 60 * 1000;
}

function stableId(value) {
  return value === null || value === undefined || value === '' ? '' : String(value).trim();
}

export function messageIdentity(message, negotiationHash = '') {
  const hash = stableId(negotiationHash || message?.negotiationHash) || 'unknown';
  const id = stableId(message?.id);
  if (id) return `message:${hash}:${id}`;
  return `message:${hash}:${stableId(message?.date_added || message?.dateAdded)}:${normalizedText(message?.user_username || message?.fromUser)}:${normalizedText(message?.message)}`;
}

export function notificationIdentity(notification) {
  const id = stableId(notification?.id);
  if (id) return `notification:${id}`;
  return `notification:${stableId(notification?.date_added || notification?.dateAdded)}:${normalizedText(notification?.redir)}:${normalizedText(notification?.message)}`;
}

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

/** Envia uma resposta para o comprador/vendedor dentro de uma negociação. */
export async function sendNegotiationMessage(hash, message) {
  const token = loadToken();
  const secretKey = loadSecretKey();
  if (!token) throw new Error('Configure seu token UEX antes de responder.');
  if (!message || !message.trim()) throw new Error('Escreva uma mensagem antes de enviar.');
  if (!window.electronAPI?.uexPost) {
    throw new Error('Responder mensagens só funciona no app Electron (não no navegador).');
  }
  const result = await window.electronAPI.uexPost({
    endpoint: 'marketplace_negotiations_messages',
    token, secretKey,
    body: { hash, message: message.trim(), is_production: 1 },
  });
  if (result.success) return result.data;
  throw new Error(result.message || 'Erro ao enviar mensagem para a UEX');
}

/** Traduz texto usando somente o serviço gratuito MyMemory. */
export async function translateText(text, source = 'pt', target = 'en') {
  const sourceText = String(text || '').trim();
  if (!sourceText) throw new Error('Escreva um texto antes de traduzir.');
  if (!window.electronAPI?.mymemoryTranslate) throw new Error('A tradução só funciona no app Electron.');

  const result = await window.electronAPI.mymemoryTranslate({ text: sourceText, source, target });
  if (result?.success && result.translation) return result.translation;
  throw new Error(result?.message || 'O limite gratuito do MyMemory foi atingido ou o serviço não respondeu.');
}

export function translatePortugueseToEnglish(text) {
  return translateText(text, 'pt', 'en');
}

export function translateEnglishToPortuguese(text) {
  return translateText(text, 'en', 'pt');
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
  const activeNegotiations = negotiations.filter(n => !isNegotiationClosed(n));
  const recentlyActive = firstRun
    ? activeNegotiations
    : activeNegotiations.filter(n => (n.date_modified || 0) * 1000 >= state.lastCheck - 5 * 60 * 1000);

  const seenMessageIds = new Set((state.seenMessageIds || []).filter(id => id !== null && id !== undefined && id !== '').map(String));
  const seenNotifIds = new Set((state.seenNotifIds || []).filter(id => id !== null && id !== undefined && id !== '').map(String));
  const newMessages = [];
  const emittedMessageIds = new Set();
  for (const neg of recentlyActive) {
    let msgs = [];
    try { msgs = await fetchNegotiationMessages(neg.hash); } catch { continue; }
    for (const m of msgs) {
      if (!m.message) continue; // ignora eventos internos sem texto
      const isMine = isOwnNegotiationMessage(m, myUsername, neg);
      const identity = messageIdentity(m, neg.hash);
      const contentIdentity = messageIdentity({ ...m, id: '' }, neg.hash);
      const legacyId = stableId(m.id);
      const alreadySeen = seenMessageIds.has(identity) || seenMessageIds.has(contentIdentity) || (legacyId && seenMessageIds.has(legacyId));
      if (isMine || alreadySeen) continue;
      seenMessageIds.add(identity);
      seenMessageIds.add(contentIdentity);
      if (!firstRun && !emittedMessageIds.has(contentIdentity)) {
        emittedMessageIds.add(contentIdentity);
        newMessages.push({
          key: identity,
          id: m.id,
          negotiationHash: neg.hash,
          listingTitle: m.listing_title || neg.listing_title || neg.title || 'Negociação UEX',
          listingSlug: m.listing_slug || neg.listing_slug || neg.slug || '',
          fromUser: getNegotiationMessageSender(m),
          message: m.message,
          dateAdded: (m.date_added || 0) * 1000,
        });
      }
    }
  }

  const newNotifications = [];
  const emittedNotificationIds = new Set();
  for (const n of notifications) {
    const identity = notificationIdentity(n);
    const contentIdentity = notificationIdentity({ ...n, id: '' });
    const legacyId = stableId(n.id);
    const alreadySeen = seenNotifIds.has(identity) || seenNotifIds.has(contentIdentity) || (legacyId && seenNotifIds.has(legacyId));
    if (alreadySeen) continue;
    seenNotifIds.add(identity);
    seenNotifIds.add(contentIdentity);
    if (!firstRun && !n.date_read && !emittedNotificationIds.has(contentIdentity)) {
      emittedNotificationIds.add(contentIdentity);
      newNotifications.push({
        key: identity,
        id: n.id,
        message: n.message,
        redir: n.redir,
        dateAdded: (n.date_added || 0) * 1000,
      });
    }
  }

  // Mantém as listas de "já visto" de um tamanho razoável.
  state.seenMessageIds = Array.from(seenMessageIds).slice(-500);
  state.seenNotifIds = Array.from(seenNotifIds).slice(-500);
  state.lastCheck = Date.now();
  saveState(state);

  newMessages.sort((a, b) => b.dateAdded - a.dateAdded);
  newNotifications.sort((a, b) => b.dateAdded - a.dateAdded);

  // A UEX pode publicar a mesma mensagem em dois feeds: mensagens da
  // negociação e notificações gerais. O sino deve exibir somente a versão
  // contextualizada da negociação, que contém remetente e anúncio.
  const filteredNotifications = newNotifications.filter(notification =>
    !newMessages.some(message => isCrossFeedDuplicate(message, notification))
  );

  return {
    newMessages,
    newNotifications: filteredNotifications,
    totalUnread: newMessages.length + filteredNotifications.length,
    negotiations,
  };
}

/** Marca tudo como visto sem gerar itens novos (usado pelo botão "marcar tudo como lido"). */
export function dismissAll() {
  const state = loadState();
  state.lastCheck = Date.now();
  saveState(state);
}