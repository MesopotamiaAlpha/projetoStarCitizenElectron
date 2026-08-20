import {
  SELECTIVE_CLEANUP_CATEGORIES,
  clearCategoryLocalStorage,
  getCategoryLocalStorageSnapshot,
} from './selectiveCleanup';

describe('limpeza seletiva', () => {
  function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
    };
  }

  test('mantém credenciais UEX fora das categorias apagáveis', () => {
    const allKeys = SELECTIVE_CLEANUP_CATEGORIES.flatMap(category => category.localStorageKeys);
    expect(allKeys).not.toContain('sc_uex_token_v1');
    expect(allKeys).not.toContain('sc_uex_secretkey_v1');
    expect(allKeys).not.toContain('sc_uex_username_v1');
  });

  test('limpa somente as chaves da categoria selecionada', () => {
    const storage = createStorage({
      'sc_uex_sales_v1': '[1]',
      'sc_uex_catalog_v1': '[2]',
      'sc_ore_vault_v1': '{"entries":[1]}',
      'sc_uex_token_v1': 'secret',
    });
    const snapshot = getCategoryLocalStorageSnapshot('uex_tracking', storage);
    expect(Object.keys(snapshot)).toEqual(['sc_uex_sales_v1', 'sc_uex_catalog_v1']);
    expect(clearCategoryLocalStorage('uex_tracking', storage)).toBe(2);
    expect(storage.getItem('sc_uex_sales_v1')).toBeNull();
    expect(storage.getItem('sc_ore_vault_v1')).not.toBeNull();
    expect(storage.getItem('sc_uex_token_v1')).toBe('secret');
  });
});
