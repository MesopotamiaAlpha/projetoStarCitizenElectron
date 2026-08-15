import {
  hasStorageKey,
  readJson,
  removeStorage,
  writeJson,
} from './storage';

beforeEach(() => {
  window.localStorage.clear();
});

describe('storage adapter', () => {
  test('salva e recupera JSON preservando tipos', () => {
    const value = { name: 'Iron', quantity: 12.911, tags: ['ore'] };
    expect(writeJson('test-key', value)).toBe(true);
    expect(hasStorageKey('test-key')).toBe(true);
    expect(readJson('test-key', null)).toEqual(value);
  });

  test('retorna fallback quando JSON está inválido ou ausente', () => {
    window.localStorage.setItem('broken', '{invalid');
    expect(readJson('broken', { safe: true })).toEqual({ safe: true });
    expect(readJson('missing', [])).toEqual([]);
  });

  test('remove uma chave sem lançar exceção', () => {
    writeJson('remove-me', { ok: true });
    expect(removeStorage('remove-me')).toBe(true);
    expect(hasStorageKey('remove-me')).toBe(false);
  });
});
