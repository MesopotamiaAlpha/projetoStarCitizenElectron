// ── Backup & Restauração ──────────────────────────────────────────────────────
// Cobre todos os dados guardados em localStorage pelo app. Itens que vivem no
// banco do Electron (Armaduras, Inventário de Itens, Blueprints) usam um
// armazenamento separado (SQLite via processo principal) e ainda não entram
// neste backup — ver aviso na tela de Backup.

const DATA_OVERRIDE_PREFIX = 'sc_data_override_';

export const BACKUP_CATEGORIES = [
  { id:'orevault',    label:'Baú de Minério',                 keys:['sc_ore_vault_v1'] },
  { id:'clanvault',   label:'Cofre do Clã',                    keys:['sc_clan_vault_v1'] },
  { id:'mininggroup', label:'Mineração em Grupo',              keys:['sc_mining_group_v1','sc_mining_builds_v1'] },
  { id:'missions',    label:'Rastreador de Missões',           keys:['sc_missions_v2','sc_obj_library_v1','sc_daily_losses_v1'] },
  { id:'wikelo',      label:'Acompanhamento Wikelo',           keys:['sc_wikelo_missions_v1'] },
  { id:'materials',   label:'Fila de Materiais',               keys:['sc_material_queue_v1'] },
  { id:'uexsales',    label:'Vendas UEX (Marketplace)',        keys:['sc_uex_sales_v1','sc_uex_catalog_v1'] },
  { id:'uexconfig',   label:'Configuração e Sincronização UEX', keys:['sc_uex_token_v1','sc_uex_secretkey_v1','sc_uex_username_v1','sc_uex_notif_state_v1','sc_uex_items_db_v1','sc_uex_locations_db_v1','sc_uex_mining_db_v1'], sensitive:true },
  { id:'dataoverride',label:'Personalizações de Dados (Mineração/Trade/DPS/Cargo/Market)', keys:[], dynamicPrefix: DATA_OVERRIDE_PREFIX },
  { id:'provenance',  label:'Procedência dos Dados',           keys:['sc_provenance_v1'] },
];

// Categorias que ainda NÃO são cobertas (dados vivem no SQLite do Electron, não no localStorage)
export const UNSUPPORTED_CATEGORIES = [
  'Armaduras (Todas as Armaduras / Meus Sets)',
  'Inventário de Itens',
  'Blueprints',
];

function keysForCategory(cat) {
  if (cat.dynamicPrefix) {
    return Object.keys(localStorage).filter(k => k.startsWith(cat.dynamicPrefix));
  }
  return cat.keys;
}

function countFromRaw(raw) {
  try {
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && Array.isArray(parsed.entries)) return parsed.entries.length;
    if (parsed && Array.isArray(parsed.itens)) return parsed.itens.length;
    return 1;
  } catch { return 0; }
}

/** Quantos itens/registros uma categoria tem guardado agora (pra mostrar antes de exportar). */
export function countCategoryItems(cat) {
  return keysForCategory(cat).reduce((total, k) => total + countFromRaw(localStorage.getItem(k)), 0);
}

/** Mesma contagem, mas lendo de um backup já carregado (pra tela de restauração). */
export function countCategoryItemsFromBackup(cat, backup) {
  const keys = cat.dynamicPrefix
    ? Object.keys(backup.data).filter(k => k.startsWith(cat.dynamicPrefix))
    : cat.keys;
  return keys.reduce((total, k) => total + countFromRaw(backup.data[k]), 0);
}

/** Monta o objeto de backup para as categorias selecionadas. */
export function buildBackup(selectedIds) {
  const categories = BACKUP_CATEGORIES.filter(c => selectedIds.includes(c.id));
  const data = {};
  categories.forEach(cat => {
    keysForCategory(cat).forEach(k => {
      const raw = localStorage.getItem(k);
      if (raw !== null) data[k] = raw; // guarda a string crua, sem re-parsear
    });
  });
  return {
    app: 'SC Toolbox',
    version: 1,
    exported_at: new Date().toISOString(),
    categories: categories.map(c => c.id),
    data,
  };
}

/** Dispara o download do backup como arquivo .json. */
export function downloadBackup(selectedIds) {
  const backup = buildBackup(selectedIds);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0,10);
  const scope = selectedIds.length === BACKUP_CATEGORIES.length ? 'completo' : selectedIds.join('-');
  a.download = `sc-toolbox-backup-${scope}-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return backup;
}

/** Lê e valida um arquivo de backup selecionado pelo usuário. Retorna o objeto parseado. */
export async function readBackupFile(file) {
  const text = await file.text();
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new Error('Arquivo inválido — não é um JSON válido.'); }
  if (!parsed || parsed.app !== 'SC Toolbox' || !parsed.data) {
    throw new Error('Este arquivo não parece ser um backup do SC Toolbox.');
  }
  return parsed;
}

/** Quais categorias conhecidas este backup realmente contém dados. */
export function categoriesInBackup(backup) {
  return BACKUP_CATEGORIES.filter(cat => {
    if (cat.dynamicPrefix) {
      return Object.keys(backup.data).some(k => k.startsWith(cat.dynamicPrefix));
    }
    return cat.keys.some(k => backup.data[k] !== undefined);
  });
}

/** Restaura as categorias selecionadas de um backup já validado. Sobrescreve os dados atuais. */
export function restoreBackup(backup, selectedIds) {
  let restoredKeys = 0;
  const categories = BACKUP_CATEGORIES.filter(c => selectedIds.includes(c.id));
  categories.forEach(cat => {
    const keysToRestore = cat.dynamicPrefix
      ? Object.keys(backup.data).filter(k => k.startsWith(cat.dynamicPrefix))
      : cat.keys;
    keysToRestore.forEach(k => {
      if (backup.data[k] !== undefined) {
        localStorage.setItem(k, backup.data[k]);
        restoredKeys++;
      }
    });
  });
  return { restoredKeys, categories: categories.map(c => c.label) };
}
