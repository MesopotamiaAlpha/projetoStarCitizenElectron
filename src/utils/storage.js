// Adaptador central para o localStorage.
//
// O aplicativo precisa continuar funcionando quando o armazenamento estiver
// indisponível, corrompido ou bloqueado pelo ambiente. Os módulos de domínio
// devem usar estas funções em vez de repetir try/catch em cada tela.

export function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStorage(key, fallback = null) {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw === null ? fallback : raw;
  } catch {
    return fallback;
  }
}

export function readJson(key, fallback) {
  const raw = readStorage(key, null);
  if (raw === null || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function writeJson(key, value) {
  try {
    return writeStorage(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function removeStorage(key) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function hasStorageKey(key) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    return storage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function dispatchStorageEvent(name, detail) {
  try {
    if (typeof window === 'undefined') return false;
    window.dispatchEvent(new CustomEvent(name, { detail }));
    return true;
  } catch {
    return false;
  }
}
