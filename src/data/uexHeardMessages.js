// Registro (em memória) das mensagens de negociação que o usuário JÁ ficou sabendo.
//
// O chat aberto e o sino consultam a API de forma independente (a cada 5s e a cada
// 90s). Sem este registro, uma mensagem que o chat já mostrou e tocou era avisada
// de novo pelo sino quando ele consultava depois. Agora:
//   • o chat registra tudo o que exibe;
//   • o sino registra tudo o que avisa e ignora o que já está registrado;
//   • uma notificação geral que repete uma mensagem registrada também é ignorada
//     (antes só era detectada enquanto a mensagem ainda estava na lista do sino).
import { messageIdentity } from './uexNegotiations';

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 1500;

const heard = new Map(); // key -> { item, at }

function prune(now) {
  for (const [key, entry] of heard) {
    if (now - entry.at > TTL_MS) heard.delete(key);
  }
  if (heard.size > MAX_ENTRIES) {
    const overflow = heard.size - MAX_ENTRIES;
    let removed = 0;
    for (const key of heard.keys()) {
      heard.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

// Registra itens já no formato do sino: { kind:'message', key, negotiationHash, fromUser, message, dateAdded(ms) }.
export function markHeard(items, now = Date.now()) {
  for (const item of Array.isArray(items) ? items : [items]) {
    if (!item || !item.key) continue;
    heard.delete(item.key); // reinserir mantém a ordem por "mais recente"
    heard.set(item.key, { item: { ...item, kind: 'message' }, at: now });
  }
  prune(now);
}

// Registra mensagens cruas da API (como o chat as recebe), convertendo para o formato do sino.
export function markMessagesHeard(messages, negotiationHash, now = Date.now()) {
  const hash = String(negotiationHash || '').trim();
  if (!hash || !Array.isArray(messages)) return;
  markHeard(messages.filter(message => message && message.message).map(message => ({
    kind: 'message',
    key: messageIdentity(message, hash),
    negotiationHash: hash,
    fromUser: message.user_username || message.fromUser || '',
    message: message.message,
    dateAdded: message.dateAdded || (Number(message.date_added) || 0) * 1000,
  })), now);
}

export function wasMessageHeard(key, now = Date.now()) {
  const entry = heard.get(key);
  if (!entry) return false;
  if (now - entry.at > TTL_MS) { heard.delete(key); return false; }
  return true;
}

export function listHeardMessages(now = Date.now()) {
  prune(now);
  return Array.from(heard.values(), entry => entry.item);
}

// Só para testes.
export function clearHeardMessages() {
  heard.clear();
}
