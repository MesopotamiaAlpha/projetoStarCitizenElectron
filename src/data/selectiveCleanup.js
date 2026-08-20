export const SELECTIVE_CLEANUP_CATEGORIES = [
  {
    id: 'uex_tracking',
    label: 'Acompanhamento UEX',
    description: 'Remove anúncios sincronizados, vendas registradas e histórico local de negociações. Token, chave secreta e nick permanecem salvos.',
    tone: 'gold',
    localStorageKeys: ['sc_uex_sales_v1', 'sc_uex_catalog_v1', 'sc_uex_negotiation_closures_v1', 'sc_uex_chat_read_state_v1', 'sc_uex_negotiation_status_v1'],
  },
  {
    id: 'armor_collection',
    label: 'Coleção de Armaduras',
    description: 'Zera posse, quantidade, wishlist, notas e data de obtenção das peças. O catálogo de armaduras permanece intacto.',
    tone: 'purple',
    databaseScope: 'user_pieces',
    localStorageKeys: [],
  },
  {
    id: 'inventory_items',
    label: 'Inventário de Itens',
    description: 'Remove todos os registros cadastrados no Inventário de Itens, incluindo quantidades, imagens, reservas e localizações.',
    tone: 'green',
    databaseScope: 'inventory_items',
    localStorageKeys: ['sc_inventory_v1'],
  },
  {
    id: 'ore_vault',
    label: 'Baú de Minério',
    description: 'Remove todas as entradas de minério. A preferência de local padrão permanece intacta para evitar reconfiguração acidental.',
    tone: 'gold',
    localStorageKeys: ['sc_ore_vault_v1'],
  },
  {
    id: 'missions',
    label: 'Rastreador de Missões',
    description: 'Remove missões registradas, histórico e eventos locais do rastreador. O catálogo administrativo de missões permanece intacto.',
    tone: 'green',
    localStorageKeys: ['sc_missions_v1', 'sc_mission_history_v1', 'sc_mission_auto_monitor_v1', 'sc_mission_auto_events_v1', 'sc_mission_reward_pending_v1'],
  },
  {
    id: 'wikelo',
    label: 'Acompanhamento Wikelo',
    description: 'Remove missões e progresso cadastrados no acompanhamento Wikelo. Os itens do Inventário não são alterados.',
    tone: 'purple',
    localStorageKeys: ['sc_wikelo_missions_v1'],
  },
  {
    id: 'blueprints_progress',
    label: 'Progresso de Blueprints',
    description: 'Zera posse, wishlist, quantidade craftada, notas e data das blueprints. O catálogo de blueprints permanece intacto.',
    tone: 'gold',
    databaseScope: 'user_blueprints',
    localStorageKeys: [],
  },
  {
    id: 'useful_links',
    label: 'Links Úteis',
    description: 'Remove os links úteis cadastrados manualmente.',
    tone: 'blue',
    localStorageKeys: ['companheiro_emoto_useful_links_v1'],
  },
];

export function getSelectiveCleanupCategory(categoryId) {
  return SELECTIVE_CLEANUP_CATEGORIES.find(category => category.id === categoryId) || null;
}

export function getCategoryLocalStorageSnapshot(categoryId, storage = typeof window !== 'undefined' ? window.localStorage : null) {
  const category = getSelectiveCleanupCategory(categoryId);
  if (!category || !storage) return {};
  return category.localStorageKeys.reduce((snapshot, key) => {
    const value = storage.getItem(key);
    if (value !== null) snapshot[key] = value;
    return snapshot;
  }, {});
}

export function clearCategoryLocalStorage(categoryId, storage = typeof window !== 'undefined' ? window.localStorage : null) {
  const category = getSelectiveCleanupCategory(categoryId);
  if (!category || !storage) return 0;
  let removed = 0;
  category.localStorageKeys.forEach(key => {
    if (storage.getItem(key) !== null) {
      storage.removeItem(key);
      removed += 1;
    }
  });
  return removed;
}
