// Cofre do Clã — minérios enviados para guarda compartilhada, aguardando entrega ao dono
// Cofre do Clã — persistência local compartilhada entre a tela e o Dashboard.
import { readJson, writeJson } from '../utils/storage';

const KEY = 'sc_clan_vault_v1';

export const VAULT_UNITS = ['SCU', 'uSCU', 'unidade'];

export function loadClanVault() {
  const value = readJson(KEY, []);
  return Array.isArray(value) ? value : [];
}
export function saveClanVault(list) {
  return writeJson(KEY, Array.isArray(list) ? list : []);
}

// Adiciona uma ou mais entradas novas (ex: vindas do fim de uma sessão de mineração)
export function addClanVaultEntries(entries) {
  const v = loadClanVault();
  const stamped = entries.map(e => ({
    id: e.id || (Date.now() + Math.random()),
    status: 'No Cofre',
    unit: 'SCU',
    quality: '',
    usage_history: [],
    date_added: new Date().toISOString(),
    ...e,
  }));
  const merged = [...stamped, ...v];
  saveClanVault(merged);
  return merged;
}

export function updateClanVaultEntry(id, patch) {
  const v = loadClanVault();
  const updated = v.map(e => e.id === id ? { ...e, ...patch, updated_at: new Date().toISOString() } : e);
  saveClanVault(updated);
  return updated;
}

export function removeClanVaultEntry(id) {
  const v = loadClanVault();
  const updated = v.filter(e => e.id !== id);
  saveClanVault(updated);
  return updated;
}

// Registra o uso de parte da quantidade guardada: reduz o saldo e grava no histórico quem usou.
export function useClanVaultQuantity(id, { amount, used_by, notes }) {
  const v = loadClanVault();
  const updated = v.map(e => {
    if (e.id !== id) return e;
    const amt = Math.min(Number(amount) || 0, Number(e.quantity) || 0);
    if (amt <= 0) return e;
    const logEntry = {
      id: Date.now() + Math.random(),
      amount: amt,
      used_by: (used_by || '').trim() || 'Não informado',
      notes: (notes || '').trim(),
      date: new Date().toISOString(),
    };
    return {
      ...e,
      quantity: +(Number(e.quantity) - amt).toFixed(3),
      usage_history: [logEntry, ...(e.usage_history || [])],
      updated_at: new Date().toISOString(),
    };
  });
  saveClanVault(updated);
  return updated;
}