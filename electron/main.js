const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { MissionLogWatcher } = require('./missionWatcher');
const { applySchemaMigrations, CURRENT_SCHEMA_VERSION } = require('./dbMigrations');
const { createMobileServer, DEFAULT_PORT: MOBILE_DEFAULT_PORT } = require('./mobileServer');
const { fileSignature, saveDatabaseSnapshot } = require('./dbPersistence.cjs');
const fs   = require('fs');
const SCMDB_CATALOG = require('./scmdbBlueprintCatalog.json');
const isDev = process.env.NODE_ENV === 'development';

// O banco é mantido em memória pelo sql.js e exportado por inteiro a cada
// alteração. Duas instâncias simultâneas teriam snapshots diferentes e a
// última a fechar poderia sobrescrever os dados da primeira. A trava precisa
// ser adquirida antes de configurar diretórios, abrir o SQLite ou criar a UI.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

// Debug do Monitor Automático — descomente a próxima linha durante manutenção.
const ENABLE_MISSION_MONITOR_DEBUG = false;
// const ENABLE_MISSION_MONITOR_DEBUG = true; // ATIVAR: logs do processo Electron

const APP_DIR_NAME = 'CompanheiroEmoto';
const APP_ID = 'com.companheiroemoto.app';
const DATA_ENVIRONMENT = isDev ? 'development' : 'production';
// Desenvolvimento e produção nunca compartilham ponte de configuração, pasta,
// SQLite ou localStorage. Isso evita que o npm run dev contamine a instalação.
const DATA_FOLDER_NAME = isDev ? `${APP_DIR_NAME}-Dev` : APP_DIR_NAME;
const CONFIG_FOLDER_NAME = isDev ? `${APP_DIR_NAME}-Dev` : APP_DIR_NAME;
const DB_FILE_NAME = 'companheiro_emoto.db';
const DATA_CONFIG_FILE = 'config.json';
const DATA_MANIFEST_FILE = '.companheiro-emoto-data.json';
const TRANSIENT_DATA_NAMES = new Set([
  'Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'Crashpad',
  'logs', 'SingletonCookie', 'SingletonLock', 'SingletonSocket'
]);

let db, SQL, dbPath;
let dbLoadedSignature = null;
let databaseRestartRequired = false;
let dataRoot = null;
let dataConfigPath = null;
let legacyUserDataPath = null;
let dataMigration = { copied: [], skipped: [], warnings: [] };
let mainWindow;
let missionLogWatcher;
let mobileServer;
let mobileRendererState = {};
const pendingMobileRendererActions = new Map();

function requestMobileRendererAction(action, payload = {}) {
  return new Promise((resolve, reject) => {
    if (!mainWindow || mainWindow.isDestroyed()) { reject(new Error('A janela principal não está disponível.')); return; }
    const requestId = `mobile-action-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const timeout = setTimeout(() => { pendingMobileRendererActions.delete(requestId); reject(new Error('O renderer não respondeu a tempo.')); }, 8000);
    pendingMobileRendererActions.set(requestId, { resolve, reject, timeout });
    mainWindow.webContents.send('mobile-server-action-request', { requestId, action, payload });
  });
}


function assertTrustedRenderer(event) {
  const url = String(event?.senderFrame?.url || event?.sender?.getURL?.() || '');
  const allowed = isDev
    ? url.startsWith('http://localhost:3000')
    : url.startsWith('file://');
  if (!allowed) throw new Error('Origem IPC não autorizada.');
}

function normalizeMissionMonitorStatus(raw = {}) {
  const status = raw && typeof raw === 'object' ? raw : {};
  const activeMissions = Array.isArray(status.activeMissions)
    ? status.activeMissions
    : Array.isArray(status.active)
      ? status.active
      : [];
  const rawDebug = status.debug || status.diagnostics || {};
  const debug = {
    ...rawDebug,
    phase: rawDebug.phase || (status.running ? 'running_legacy_status' : 'idle'),
    fileExists: rawDebug.fileExists !== undefined ? rawDebug.fileExists : Boolean(status.logPath),
    fileReadable: rawDebug.fileReadable !== undefined ? rawDebug.fileReadable : Boolean(status.logPath),
    activeCount: rawDebug.activeCount !== undefined ? rawDebug.activeCount : activeMissions.length,
    statusShape: Object.keys(status),
    legacyStatusShape: !status.debug,
    watcherVersion: status.watcherVersion || 'unknown-legacy-watcher',
  };
  return { ...status, activeMissions, debug };
}

function getMissionLogWatcher() {
  if (missionLogWatcher) return missionLogWatcher;
  missionLogWatcher = new MissionLogWatcher(
    event => {
      if (ENABLE_MISSION_MONITOR_DEBUG) console.info('[MissionAutoMonitor][main][event->renderer]', { type: event?.type, guid: event?.guid || event?.missionGuid || null, activeCount: missionLogWatcher?.active?.size || 0 });
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mission-monitor-event', event);
      else console.warn('[MissionAutoMonitor][main] renderer indisponível para evento');
    },
    status => {
      const normalizedStatus = normalizeMissionMonitorStatus(status);
      if (ENABLE_MISSION_MONITOR_DEBUG) console.info('[MissionAutoMonitor][main][status->renderer]', { running: normalizedStatus.running, logPath: normalizedStatus.logPath, phase: normalizedStatus.debug.phase, fileExists: normalizedStatus.debug.fileExists, readCount: normalizedStatus.debug.readCount, activeCount: normalizedStatus.debug.activeCount, statusShape: normalizedStatus.debug.statusShape, legacyStatusShape: normalizedStatus.debug.legacyStatusShape, watcherVersion: normalizedStatus.debug.watcherVersion });
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mission-monitor-status', normalizedStatus);
      else console.warn('[MissionAutoMonitor][main] renderer indisponível para status');
    },
  );
  return missionLogWatcher;
}

function ensureDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function getDataConfigPath() {
  return path.join(app.getPath('appData'), CONFIG_FOLDER_NAME, DATA_CONFIG_FILE);
}

function getDefaultDataRoot() {
  return path.join(path.parse(app.getPath('home')).root, DATA_FOLDER_NAME);
}

function normalizeSelectedRoot(selectedPath) {
  const cleanPath = path.resolve(selectedPath);
  return path.basename(cleanPath).toLowerCase() === DATA_FOLDER_NAME.toLowerCase()
    ? cleanPath
    : path.join(cleanPath, DATA_FOLDER_NAME);
}

function isCurrentEnvironmentConfig(config) {
  return Boolean(
    config
      && config.app === APP_DIR_NAME
      && config.appId === APP_ID
      && config.environment === DATA_ENVIRONMENT
      && typeof config.dataRoot === 'string'
      && config.dataRoot.trim(),
  );
}

function getDataManifestPath(root) {
  return path.join(root, DATA_MANIFEST_FILE);
}

function isCurrentEnvironmentRoot(root) {
  const manifest = safeReadJson(getDataManifestPath(root));
  return Boolean(
    manifest
      && manifest.app === APP_DIR_NAME
      && manifest.appId === APP_ID
      && manifest.environment === DATA_ENVIRONMENT,
  );
}

function writeDataManifest(root) {
  fs.writeFileSync(getDataManifestPath(root), JSON.stringify({
    version: 1,
    app: APP_DIR_NAME,
    appId: APP_ID,
    environment: DATA_ENVIRONMENT,
    dataRoot: root,
    createdAt: new Date().toISOString(),
  }, null, 2), 'utf8');
}

function directoryHasPersistentData(root) {
  if (!root || !fs.existsSync(root)) return false;
  return [
    path.join(root, 'dados', DB_FILE_NAME),
    path.join(root, 'Local Storage'),
    path.join(root, 'IndexedDB'),
    path.join(root, 'Session Storage'),
  ].some(candidate => fs.existsSync(candidate));
}

function makeLegacyArchivePath(root) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let candidate = `${root}-legado-${stamp}`;
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = `${root}-legado-${stamp}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function writeDataConfig(root) {
  dataConfigPath = dataConfigPath || getDataConfigPath();
  ensureDirectory(path.dirname(dataConfigPath));
  fs.writeFileSync(dataConfigPath, JSON.stringify({
    version: 2,
    app: APP_DIR_NAME,
    appId: APP_ID,
    environment: DATA_ENVIRONMENT,
    dataRoot: root,
    updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8');
}

function copyFileIfMissing(source, target) {
  if (!fs.existsSync(source) || fs.existsSync(target)) return false;
  ensureDirectory(path.dirname(target));
  fs.copyFileSync(source, target);
  return true;
}

function findDatabaseFile(root) {
  const locations = [path.join(root, 'dados'), root];
  for (const directory of locations) {
    if (!fs.existsSync(directory)) continue;
    const candidate = fs.readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.db')
      .map(entry => path.join(directory, entry.name))
      .find(filePath => fs.existsSync(filePath));
    if (candidate) return candidate;
  }
  return null;
}

function copyDirectoryContents(sourceDir, targetDir, report, relative = '') {
  if (!fs.existsSync(sourceDir)) return;
  ensureDirectory(targetDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (TRANSIENT_DATA_NAMES.has(entry.name) || entry.name.startsWith('Singleton')) continue;
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    const relativeName = path.join(relative, entry.name);
    try {
      if (entry.isDirectory()) {
        copyDirectoryContents(source, target, report, relativeName);
      } else if (entry.isFile() && !fs.existsSync(target)) {
        ensureDirectory(path.dirname(target));
        fs.copyFileSync(source, target);
        report.copied.push(relativeName);
      } else {
        report.skipped.push(relativeName);
      }
    } catch (error) {
      report.warnings.push(`${relativeName}: ${error.message}`);
    }
  }
}

function migrateLegacyData(sourceRoot, targetRoot) {
  const report = { copied: [], skipped: [], warnings: [] };
  if (!sourceRoot || !targetRoot || path.resolve(sourceRoot) === path.resolve(targetRoot)) return report;

  ensureDirectory(targetRoot);
  const targetDataDir = ensureDirectory(path.join(targetRoot, 'dados'));
  const legacyDb = findDatabaseFile(sourceRoot);
  const targetDb = path.join(targetDataDir, DB_FILE_NAME);
  if (legacyDb && copyFileIfMissing(legacyDb, targetDb)) report.copied.push(path.join('dados', DB_FILE_NAME));

  // O Electron mantém localStorage, cookies, preferências e dados de sessão no
  // userData. Copiamos os arquivos persistentes para a pasta central, mas nunca
  // caches, locks ou sockets de uma instância em execução.
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    if (entry.name === 'dados' || TRANSIENT_DATA_NAMES.has(entry.name) || entry.name.startsWith('Singleton')) continue;
    const source = path.join(sourceRoot, entry.name);
    const target = path.join(targetRoot, entry.name);
    const relativeName = entry.name;
    try {
      if (entry.isDirectory()) {
        copyDirectoryContents(source, target, report, relativeName);
      } else if (entry.isFile() && !fs.existsSync(target)) {
        ensureDirectory(path.dirname(target));
        fs.copyFileSync(source, target);
        report.copied.push(relativeName);
      } else {
        report.skipped.push(relativeName);
      }
    } catch (error) {
      report.warnings.push(`${relativeName}: ${error.message}`);
    }
  }
  return report;
}

function migrateDatabaseInsideDataRoot(root) {
  const dataDir = ensureDirectory(path.join(root, 'dados'));
  const currentDb = path.join(dataDir, DB_FILE_NAME);
  if (fs.existsSync(currentDb)) return false;
  const legacyDb = findDatabaseFile(root);
  return Boolean(legacyDb && copyFileIfMissing(legacyDb, currentDb));
}

function saveDb() {
  const result = saveDatabaseSnapshot({
    database: db,
    databasePath: dbPath,
    loadedSignature: dbLoadedSignature,
    restartRequired: databaseRestartRequired,
  });
  if (!result.saved && result.reason === 'database-changed-externally') {
    console.error('[Database] Escrita abortada: o arquivo SQLite foi alterado por outro processo.', {
      dbPath,
      loadedSignature: result.loadedSignature,
      currentSignature: result.currentSignature,
    });
    return result;
  }
  if (result.fileSignature) dbLoadedSignature = result.fileSignature;
  return result;
}

async function configureDataDirectory() {
  // Captura apenas o caminho padrão para diagnóstico. Nenhum arquivo desse
  // diretório é copiado automaticamente para a instalação atual.
  legacyUserDataPath = app.getPath('userData');
  dataConfigPath = getDataConfigPath();
  const savedConfig = safeReadJson(dataConfigPath);
  const hasValidSavedConfig = isCurrentEnvironmentConfig(savedConfig);
  let selectedRoot = hasValidSavedConfig
    ? path.resolve(savedConfig.dataRoot)
    : null;
  const ignoredConfig = Boolean(savedConfig && !hasValidSavedConfig);
  const startupWarnings = [];
  let archivedLegacyRoot = null;

  if (!selectedRoot) {
    const defaultRoot = getDefaultDataRoot();
    const result = await dialog.showOpenDialog({
      title: `Escolha onde criar a pasta ${APP_DIR_NAME}`,
      message: `Selecione o diretório-pai. O aplicativo criará a pasta ${DATA_FOLDER_NAME} dentro dele.`,
      defaultPath: path.parse(defaultRoot).root,
      properties: ['openDirectory', 'createDirectory'],
    });
    selectedRoot = result.canceled || !result.filePaths[0]
      ? defaultRoot
      : normalizeSelectedRoot(result.filePaths[0]);
  }

  try {
    ensureDirectory(selectedRoot);
  } catch (error) {
    // Se o diretório escolhido estiver protegido, não interrompemos o app.
    selectedRoot = path.join(legacyUserDataPath, DATA_FOLDER_NAME);
    ensureDirectory(selectedRoot);
    startupWarnings.push(`Não foi possível usar o diretório escolhido: ${error.message}`);
  }

  // Se a pasta escolhida já contém dados, mas não possui assinatura deste
  // ambiente, não a abrimos silenciosamente. Por padrão preservamos a pasta
  // antiga renomeando-a e iniciamos uma pasta limpa; o usuário pode escolher
  // explicitamente a opção de reutilizar os dados existentes.
  if (!hasValidSavedConfig && !isCurrentEnvironmentRoot(selectedRoot) && directoryHasPersistentData(selectedRoot)) {
    const decision = await dialog.showMessageBox({
      type: 'warning',
      title: 'Dados antigos encontrados',
      message: 'A pasta escolhida já contém dados sem identificação deste ambiente.',
      detail: `Para evitar misturar dados de teste, o Companheiro Emoto pode preservar essa pasta e iniciar uma nova. Pasta encontrada: ${selectedRoot}`,
      buttons: ['Criar pasta limpa e preservar antigos', 'Usar dados existentes'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (decision.response === 0) {
      archivedLegacyRoot = makeLegacyArchivePath(selectedRoot);
      fs.renameSync(selectedRoot, archivedLegacyRoot);
      ensureDirectory(selectedRoot);
      startupWarnings.push(`A pasta antiga foi preservada em ${archivedLegacyRoot}.`);
    } else {
      startupWarnings.push('Dados existentes foram reutilizados somente por escolha explícita.');
    }
  }

  dataRoot = selectedRoot;
  // Não migramos mais o userData antigo automaticamente. Esse diretório pode
  // pertencer a uma execução de teste, a outro build ou a uma versão anterior.
  // A transferência de dados deve acontecer somente por backup completo ou pela
  // troca explícita de diretório dentro do aplicativo.
  dataMigration = {
    copied: [],
    skipped: [],
    warnings: startupWarnings,
    at: new Date().toISOString(),
    automatic: false,
    ignoredConfig: Boolean(ignoredConfig),
    archivedLegacyRoot,
    source: null,
  };
  if (ignoredConfig) {
    dataMigration.warnings.push('A configuração existente pertencia a outro ambiente ou versão e foi ignorada para evitar mistura de dados.');
  }
  // Migração de um banco legado dentro da pasta central só é permitida quando
  // a própria ponte confirma que essa pasta pertence a este ambiente. Em uma
  // instalação limpa, um .db encontrado por acaso não é tratado como usuário.
  if (hasValidSavedConfig && migrateDatabaseInsideDataRoot(dataRoot)) {
    dataMigration.copied.push(path.join('dados', DB_FILE_NAME));
  }
  ensureDirectory(path.join(dataRoot, 'dados'));
  ensureDirectory(path.join(dataRoot, 'backup'));
  ensureDirectory(path.join(dataRoot, 'exportados'));
  writeDataManifest(dataRoot);
  writeDataConfig(dataRoot);

  // A partir deste ponto, antes de criar BrowserWindow, localStorage, cookies e
  // demais dados persistentes do Electron passam a ficar na pasta escolhida.
  app.setPath('userData', dataRoot);
  dbPath = path.join(dataRoot, 'dados', DB_FILE_NAME);
  return { dataRoot, legacyUserDataPath, dataConfigPath, migration: dataMigration };
}

async function initDatabase() {
  const sqlJsPath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
  SQL = await require('sql.js')({ locateFile: f => path.join(sqlJsPath, f) });
  const databaseExists = fs.existsSync(dbPath);
  db = databaseExists
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();
  dbLoadedSignature = databaseExists ? fileSignature(dbPath) : null;

  db.run(`
    CREATE TABLE IF NOT EXISTS armor_sets (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      base_name     TEXT NOT NULL,
      variant_name  TEXT NOT NULL DEFAULT 'Base',
      manufacturer  TEXT NOT NULL,
      type          TEXT NOT NULL,
      category      TEXT NOT NULL,
      description   TEXT DEFAULT '',
      lore          TEXT DEFAULT '',
      tags          TEXT DEFAULT '[]',
      added_version TEXT DEFAULT '',
      rarity        TEXT DEFAULT 'Common',
      is_custom     INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS armor_pieces (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      set_id                 INTEGER NOT NULL,
      piece_type             TEXT NOT NULL,
      piece_name             TEXT NOT NULL,
      resistance_physical    REAL DEFAULT 0,
      resistance_energy      REAL DEFAULT 0,
      resistance_distortion  REAL DEFAULT 0,
      resistance_thermal     REAL DEFAULT 0,
      resistance_biochemical REAL DEFAULT 0,
      resistance_stun        REAL DEFAULT 0,
      mobility_penalty       REAL DEFAULT 0,
      slots                  INTEGER DEFAULT 0,
      is_lootable            INTEGER DEFAULT 0,
      is_purchasable         INTEGER DEFAULT 0,
      buy_location           TEXT DEFAULT '',
      how_to_get             TEXT DEFAULT '',
      price_auec             INTEGER DEFAULT 0,
      description            TEXT DEFAULT '',
      FOREIGN KEY (set_id) REFERENCES armor_sets(id)
    );
    CREATE TABLE IF NOT EXISTS user_pieces (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      piece_id      INTEGER NOT NULL UNIQUE,
      owned         INTEGER DEFAULT 0,
      wishlist      INTEGER DEFAULT 0,
      notes         TEXT DEFAULT '',
      obtained_date TEXT,
      quantity      INTEGER DEFAULT 0,
      FOREIGN KEY (piece_id) REFERENCES armor_pieces(id)
    );

CREATE TABLE IF NOT EXISTS inventory_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      category      TEXT NOT NULL DEFAULT 'Miscellaneous',
      subcategory   TEXT DEFAULT '',
      system        TEXT NOT NULL DEFAULT 'Stanton',
      location_type TEXT NOT NULL DEFAULT 'Station',
      location_name TEXT NOT NULL DEFAULT '',
      container     TEXT DEFAULT '',
      quantity      INTEGER DEFAULT 1,
      unit          TEXT DEFAULT 'un',
      size          TEXT DEFAULT '',
      grade         TEXT DEFAULT '',
      manufacturer  TEXT DEFAULT '',
      condition     TEXT DEFAULT 'Good',
      value_auec    INTEGER DEFAULT 0,
      is_contraband INTEGER DEFAULT 0,
      notes         TEXT DEFAULT '',
      is_crafted    INTEGER DEFAULT 0,
      craft_status  TEXT DEFAULT '[]',
      craft_materials TEXT DEFAULT '[]',
      craft_attachments TEXT DEFAULT '[]',
      item_image     TEXT DEFAULT '',
      reservations TEXT DEFAULT '[]',
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blueprints (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      category        TEXT NOT NULL DEFAULT 'Weapon',
      subcategory     TEXT DEFAULT '',
      manufacturer    TEXT DEFAULT '',
      item_size       TEXT DEFAULT '',
      grade           TEXT DEFAULT '',
      item_class      TEXT DEFAULT '',
      description     TEXT DEFAULT '',
      how_to_get      TEXT DEFAULT '',
      faction         TEXT DEFAULT '',
      mission_type    TEXT DEFAULT '',
      patch_added     TEXT DEFAULT '4.7',
      is_default      INTEGER DEFAULT 0,
      notes           TEXT DEFAULT '',
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blueprint_ingredients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      blueprint_id    INTEGER NOT NULL,
      material_name   TEXT NOT NULL,
      quantity        INTEGER DEFAULT 1,
      quality_min     INTEGER DEFAULT 0,
      unit            TEXT DEFAULT 'un',
      notes           TEXT DEFAULT '',
      FOREIGN KEY (blueprint_id) REFERENCES blueprints(id)
    );

    CREATE TABLE IF NOT EXISTS user_blueprints (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      blueprint_id    INTEGER NOT NULL UNIQUE,
      owned           INTEGER DEFAULT 0,
      crafted_count   INTEGER DEFAULT 0,
      wishlist        INTEGER DEFAULT 0,
      notes           TEXT DEFAULT '',
      obtained_date   TEXT,
      FOREIGN KEY (blueprint_id) REFERENCES blueprints(id)
    );
  `);

  // Migração: bancos já existentes não ganham colunas novas via CREATE TABLE IF NOT EXISTS,
  // então adicionamos manualmente se ainda não existirem (SQLite ignora erro se já existir).
  try { db.run(`ALTER TABLE inventory_items ADD COLUMN is_crafted INTEGER DEFAULT 0`); } catch(e) {}
  try { db.run(`ALTER TABLE inventory_items ADD COLUMN craft_status TEXT DEFAULT '[]'`); } catch(e) {}
  try { db.run(`ALTER TABLE inventory_items ADD COLUMN craft_materials TEXT DEFAULT '[]'`); } catch(e) {}
  try { db.run(`ALTER TABLE inventory_items ADD COLUMN craft_attachments TEXT DEFAULT '[]'`); } catch(e) {}
  try { db.run(`ALTER TABLE inventory_items ADD COLUMN item_image TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE inventory_items ADD COLUMN reservations TEXT DEFAULT '[]'`); } catch(e) {}
  // Migração idempotente: quantidade positiva representa cópias possuídas.
  try { db.run(`ALTER TABLE user_pieces ADD COLUMN quantity INTEGER DEFAULT 0`); } catch(e) {}
  db.run(`UPDATE user_pieces SET quantity=CASE WHEN owned=1 THEN CASE WHEN quantity>0 THEN quantity ELSE 1 END ELSE 0 END`);
  // Metadados de origem para distinguir blueprints importadas do SCMDB das manuais.
  try { db.run(`ALTER TABLE blueprints ADD COLUMN source TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE blueprints ADD COLUMN scmdb_tag TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE blueprints ADD COLUMN scmdb_url TEXT DEFAULT ''`); } catch(e) {}
  db.run(`CREATE TABLE IF NOT EXISTS scmdb_catalog_state (
    catalog_key TEXT PRIMARY KEY,
    catalog_version TEXT NOT NULL,
    installed_at TEXT DEFAULT (datetime('now'))
  )`);

  const schemaMigration = applySchemaMigrations(db);
  const changed = seedData();
  const bpChanged = seedBlueprints();
  const scmdbChanged = seedScmdbBlueprints();
  const scmdbUnitsChanged = migrateScmdbFractionalUnits();
  if (changed || bpChanged || scmdbChanged || scmdbUnitsChanged || schemaMigration.tableReady) saveDb();
}

function queryAll(sql, params = []) {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row => { const o={}; columns.forEach((c,i)=>{o[c]=row[i];}); return o; });
}
function queryOne(sql, params=[]) { return queryAll(sql,params)[0]||null; }
function normalizeArmorKey(value, variant='Base') {
  const text = String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\\s+/g,' ');
  const v = String(variant || 'Base').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\\s+/g,' ');
  return `${text}||${v}`;
}

function insertSet(arr) {
  db.run(`INSERT INTO armor_sets (base_name,variant_name,manufacturer,type,category,description,lore,tags,added_version,rarity) VALUES (?,?,?,?,?,?,?,?,?,?)`, arr);
  return queryOne('SELECT last_insert_rowid() as id').id;
}
function insertPiece(arr) {
  db.run(`INSERT INTO armor_pieces (set_id,piece_type,piece_name,resistance_physical,resistance_energy,resistance_distortion,resistance_thermal,resistance_biochemical,resistance_stun,mobility_penalty,slots,is_lootable,is_purchasable,buy_location,how_to_get,price_auec,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, arr);
  const pid = queryOne('SELECT last_insert_rowid() as id').id;
  db.run('INSERT INTO user_pieces (piece_id) VALUES (?)', [pid]);
}

function seedData() {
  const existing = new Set(
    queryAll('SELECT base_name||"||"||variant_name as k FROM armor_sets').map(r=>r.k.toLowerCase())
  );
  let inserted = 0;

  function addSet({ base_name, manufacturer, type, category, description='', lore='', tags='[]', version='3.x', rarity='Common', variants=['Base'], pieces=[] }) {
    for (const variant of variants) {
      const k = `${base_name}||${variant}`.toLowerCase();
      if (existing.has(k)) continue;
      const setId = insertSet([base_name, variant, manufacturer, type, category, description, lore, tags, version, rarity]);
      for (const p of pieces) {
        const pname = variant==='Base' ? `${base_name} ${p.type}` : `${base_name} ${p.type} (${variant})`;
        insertPiece([setId, p.type, pname,
          p.rp??0, p.re??0, p.rd??0, p.rt??0, p.rb??0, p.rs??0,
          p.mob??0, p.slots??0, p.loot?1:0, p.purch?1:0,
          p.loc??'', p.how??'', p.price??0, p.desc??'']);
      }
      existing.add(k); inserted++;
    }
  }

  // ── LIGHT ──────────────────────────────────────────────────────────────────

  addSet({ base_name:'Calico', manufacturer:'Kastak Arms', type:'Light', category:'Combat',
    description:'EVA-compliant light combat suit. Ideal para infiltração e sniping.',
    lore:'Desenvolvida para quem prefere elegância ao poder de fogo.',
    tags:'["Light","Combat","EVA"]', version:'3.0', rarity:'Common',
    variants:['Base','Desert','Tactical','Nine Tails'],
    pieces:[
      {type:'Helmet',rp:8,re:6,rd:4,rt:5,rb:3,rs:3,mob:2,slots:0,purch:true,loot:false,
       loc:'Area18 - Cubby Blast / Port Tressler',
       how:'Compre em Cubby Blast (Area18). Variante Nine Tails apenas por loot em strongholds da gang.',price:3200,
       desc:'Capacete leve PAB-3 com viseira tática.'},
      {type:'Torso',rp:10,re:8,rd:5,rt:6,rb:4,rs:4,mob:3,slots:2,purch:true,loot:false,
       loc:'Area18 - Cubby Blast / ARC-L1',
       how:'Cubby Blast e ARC-L1 Wide Forest Station. Variante Nine Tails por loot.',price:4100,
       desc:'Peitoral leve com placas PAB-3 modulares.'},
      {type:'Arms',rp:7,re:5,rd:3,rt:4,rb:2,rs:2,mob:1,slots:1,purch:true,loot:false,
       loc:'Area18 - Cubby Blast',how:'Cubby Blast, Area18.',price:2800,
       desc:'Braços leves PAB-3 com mobilidade máxima.'},
      {type:'Legs',rp:7,re:5,rd:3,rt:4,rb:2,rs:2,mob:1,slots:1,purch:true,loot:false,
       loc:'Area18 - Cubby Blast / Port Tressler',
       how:'Cubby Blast ou Port Tressler. Nine Tails por loot.',price:2800,
       desc:'Perneiras leves com articulação reforçada.'},
    ],
  });

  addSet({ base_name:'DustUp', manufacturer:'Lightspeed', type:'Light', category:'Combat',
    description:'Armadura leve robusta para ambientes empoeirados de fronteira.',
    lore:'Construída para as condições severas de Daymar.',
    tags:'["Light","Combat","Frontier"]', version:'3.7', rarity:'Common',
    variants:['Base','Desert','Tactical','Scorched'],
    pieces:[
      {type:'Helmet',rp:8,re:6,rd:4,rt:5,rb:3,rs:3,mob:2,slots:0,purch:true,loot:false,loc:'Area18 - Cubby Blast / Everus Harbor',how:'Cubby Blast ou Everus Harbor. Scorched também em Grim HEX.',price:3000,desc:'Capacete com vedação ambiental para alta poeira.'},
      {type:'Torso',rp:9,re:7,rd:4,rt:5,rb:3,rs:3,mob:2,slots:2,purch:true,loot:false,loc:'Area18 - Cubby Blast',how:'Exclusivo em Cubby Blast.',price:3800,desc:'Colete leve com filtros de poeira integrados.'},
      {type:'Arms',rp:6,re:5,rd:3,rt:4,rb:2,rs:2,mob:1,slots:1,purch:true,loot:false,loc:'Area18 - Cubby Blast / Grim HEX',how:'Cubby Blast principal. Scorched apenas Grim HEX.',price:2500,desc:'Braços com resistência a partículas abrasivas.'},
      {type:'Legs',rp:6,re:5,rd:3,rt:4,rb:2,rs:2,mob:1,slots:1,purch:true,loot:false,loc:'Area18 - Cubby Blast / Grim HEX',how:'Cubby Blast ou Grim HEX.',price:2500,desc:'Perneiras leves para terrenos empoeirados.'},
    ],
  });

  addSet({ base_name:'MacFlex', manufacturer:'Kastak Arms', type:'Light', category:'Utility',
    description:'Armadura leve com slots extras. Popular entre traders e exploradores.',
    lore:'Prioriza capacidade de carregamento sem comprometer demais a proteção.',
    tags:'["Light","Utility","Storage"]', version:'3.3', rarity:'Common',
    variants:['Base','Desert','Urban','Forest'],
    pieces:[
      {type:'Helmet',rp:7,re:6,rd:3,rt:4,rb:2,rs:2,mob:1,slots:0,purch:true,loot:false,loc:'Lorville - Tammany and Sons / New Babbage',how:'Tammany and Sons (Lorville) ou Garrity Defense (New Babbage).',price:2600,desc:'Capacete utilitário com HUD integrado.'},
      {type:'Torso',rp:9,re:7,rd:4,rt:5,rb:3,rs:2,mob:2,slots:3,purch:true,loot:false,loc:'Lorville - Tammany and Sons / Port Tressler',how:'Tammany and Sons é o principal.',price:4000,desc:'Torso utilitário com 3 slots de armazenamento.'},
      {type:'Arms',rp:6,re:5,rd:3,rt:3,rb:2,rs:2,mob:1,slots:2,purch:true,loot:false,loc:'Lorville - Tammany and Sons',how:'Tammany and Sons.',price:2300,desc:'Braços com múltiplos pontos de ancoragem.'},
      {type:'Legs',rp:6,re:5,rd:3,rt:3,rb:2,rs:2,mob:1,slots:2,purch:true,loot:false,loc:'Lorville - Tammany and Sons / New Babbage',how:'Tammany and Sons ou Garrity Defense.',price:2300,desc:'Perneiras com compartimentos ocultos.'},
    ],
  });

  addSet({ base_name:'Aves', manufacturer:'Lightspeed', type:'Light', category:'Recon',
    description:'Armadura ultra-leve para batedores e observadores avançados.',
    lore:'Inspirada na mobilidade aviária — troca proteção por liberdade de movimento.',
    tags:'["Light","Recon","Mobility","Stealth"]', version:'3.8', rarity:'Uncommon',
    variants:['Base','Black','White','Camo'],
    pieces:[
      {type:'Helmet',rp:7,re:5,rd:3,rt:4,rb:2,rs:2,mob:1,slots:0,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense (New Babbage, Commons).',price:3400,desc:'Capacete minimalista com sensores de baixo perfil.'},
      {type:'Torso',rp:8,re:6,rd:4,rt:5,rb:2,rs:2,mob:2,slots:2,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense (New Babbage).',price:3800,desc:'Torso ultra-leve, quase invisível em sensores de calor.'},
      {type:'Arms',rp:5,re:4,rd:2,rt:3,rb:2,rs:2,mob:1,slots:1,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:2200,desc:'Braços com revestimento anti-reflexo.'},
      {type:'Legs',rp:5,re:4,rd:2,rt:3,rb:2,rs:2,mob:1,slots:1,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:2200,desc:'Perneiras com amortecedores silenciosos.'},
    ],
  });

  addSet({ base_name:'Aril', manufacturer:'RRS', type:'Light', category:'Combat',
    description:'Armadura leve rara obtida apenas por loot.',
    lore:'Originalmente para operações especiais, caiu nas mãos de criminosos.',
    tags:'["Light","Loot","Rare"]', version:'3.15', rarity:'Rare',
    variants:['Base','Camo','Black Cherry','Harvester','Hazard','Quicksilver','Red Alert'],
    pieces:[
      {type:'Helmet',rp:8,re:7,rd:4,rt:5,rb:3,rs:3,mob:2,slots:0,loot:true,purch:false,loc:'Loot — Bunkers / Instalações Criminosas',how:'Caixas laranjas em bunkers criminosos e DCs.',price:0,desc:'Capacete tático RRS com viseira de polímero balístico.'},
      {type:'Torso',rp:10,re:8,rd:5,rt:6,rb:4,rs:4,mob:3,slots:2,loot:true,purch:false,loc:'Loot — DCs / PAF Sites',how:'Caixas azuis e laranjas em DCs controlados por gangues.',price:0,desc:'Torso leve RRS com proteção balística aumentada.'},
      {type:'Arms',rp:7,re:6,rd:3,rt:4,rb:2,rs:2,mob:1,slots:1,loot:true,purch:false,loc:'Loot — Bunkers / PAF Sites',how:'Bunkers nível médio-alto. Mais comum perto de Daymar.',price:0,desc:'Braços táticos com articulação reforçada.'},
      {type:'Legs',rp:7,re:6,rd:3,rt:4,rb:2,rs:2,mob:1,slots:1,loot:true,purch:false,loc:'Loot — Bunkers / DCs',how:'Bunkers médio-alto e DCs.',price:0,desc:'Perneiras táticas com proteção de joelho reforçada.'},
      {type:'Backpack',rp:0,re:0,rd:0,rt:0,rb:0,rs:0,mob:0,slots:4,loot:false,purch:true,loc:'Area18 - Cubby Blast / Lorville',how:'Ao contrário das peças, a mochila é comprável em lojas.',price:4800,desc:'Mochila tática RRS com 4 slots.'},
    ],
  });

  addSet({ base_name:'Geist', manufacturer:'Achilles Ballistics', type:'Light', category:'Stealth',
    description:'Armadura stealth com mínima seção radar. Extremamente difícil de detectar.',
    lore:'Projetada para operações encobertas onde não ser visto é o único objetivo.',
    tags:'["Light","Stealth","Rare"]', version:'3.10', rarity:'Rare',
    variants:['Base','Dark','Epoque Dark','Epoque Gold'],
    pieces:[
      {type:'Helmet',rp:7,re:6,rd:3,rt:4,rb:2,rs:2,mob:1,slots:0,loot:true,purch:false,loc:'Loot — ASD Facilities / Twitch Drop (Epoque)',how:'Base/Dark: loot em ASD Facilities. Epoque: Twitch Drop em campanhas específicas.',price:0,desc:'Capacete com revestimento anti-radar.'},
      {type:'Torso',rp:9,re:7,rd:4,rt:5,rb:3,rs:3,mob:2,slots:2,loot:true,purch:false,loc:'Loot — ASD Facilities / Prisões / Twitch Drop (Epoque)',how:'Prisões e ASD Facilities. Epoque: Twitch Drop.',price:0,desc:'Torso com material absorvente de sinal multicamadas.'},
      {type:'Arms',rp:6,re:5,rd:3,rt:3,rb:2,rs:2,mob:1,slots:1,loot:true,purch:false,loc:'Loot — Instalações Seguras',how:'Instalações de alto nível.',price:0,desc:'Braços com supressores de calor integrados.'},
      {type:'Legs',rp:6,re:5,rd:3,rt:3,rb:2,rs:2,mob:1,slots:1,loot:true,purch:false,loc:'Loot — ASD Facilities',how:'ASD Facilities em Hurston.',price:0,desc:'Perneiras com amortecedores de vibração.'},
    ],
  });

  addSet({ base_name:'GreenJacket', manufacturer:'Kastak Arms', type:'Light', category:'Combat',
    description:'Armadura leve popular entre operadores da lei e fora dela.',
    lore:'O apelido vem dos agentes de segurança privativos dos primeiros dias de Stanton.',
    tags:'["Light","Combat","Security"]', version:'3.8', rarity:'Common',
    variants:['Base','Nine Tails','Outlaw'],
    pieces:[
      {type:'Helmet',rp:9,re:7,rd:5,rt:6,rb:4,rs:4,mob:3,slots:0,purch:true,loot:true,loc:'Area18 - Cubby Blast / Loot (Nine Tails e Outlaw)',how:'Base em Cubby Blast. Variantes Nine Tails e Outlaw por loot exclusivamente.',price:3500,desc:'Capacete leve com design aberto.'},
      {type:'Torso',rp:12,re:9,rd:6,rt:8,rb:5,rs:5,mob:5,slots:2,purch:true,loot:true,loc:'Area18 - Cubby Blast / Loot',how:'Base em Cubby Blast. Gang variants por loot.',price:4800,desc:'Torso GreenJacket modular.'},
      {type:'Arms',rp:8,re:6,rd:4,rt:5,rb:3,rs:3,mob:3,slots:1,purch:true,loot:true,loc:'Area18 - Cubby Blast / Loot',how:'Base em Cubby Blast.',price:3200,desc:'Braços leves de baixo perfil.'},
      {type:'Legs',rp:8,re:6,rd:4,rt:5,rb:3,rs:3,mob:3,slots:1,purch:true,loot:true,loc:'Area18 - Cubby Blast / Loot',how:'Base em Cubby Blast.',price:3200,desc:'Perneiras para resposta rápida.'},
    ],
  });

  addSet({ base_name:'Badami', manufacturer:'Caldera', type:'Light', category:'Explorer',
    description:'Armadura leve de exploração com sensores ambientais integrados.',
    lore:'Irmã leve do Novikov — rápida e inteligente nos ambientes mais duros.',
    tags:'["Light","Exploration","Caldera"]', version:'3.14', rarity:'Common',
    variants:['Base','Graphite','Olivine'],
    pieces:[
      {type:'Helmet',rp:10,re:8,rd:5,rt:12,rb:5,rs:5,mob:4,slots:0,purch:true,loot:false,loc:'New Babbage - Garrity Defense / ARC-L4',how:'Garrity Defense (New Babbage) e ARC-L4.',price:4200,desc:'Capacete leve de exploração com sensores atmosféricos.'},
      {type:'Torso',rp:12,re:9,rd:6,rt:14,rb:6,rs:6,mob:5,slots:2,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense em New Babbage.',price:5500,desc:'Torso leve com sensores de pressão e temperatura.'},
      {type:'Arms',rp:9,re:7,rd:4,rt:10,rb:4,rs:4,mob:3,slots:1,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:3800,desc:'Braços com revestimento anti-abrasivo e sensores.'},
      {type:'Legs',rp:9,re:7,rd:4,rt:10,rb:4,rs:4,mob:3,slots:1,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:3800,desc:'Perneiras leves de exploração.'},
    ],
  });

  addSet({ base_name:'Covert', manufacturer:'Greycat Industrial', type:'Light', category:'Stealth',
    description:'Armadura leve stealth da Greycat — incomum para uma fabricante pesada, mas eficaz.',
    lore:'Quando a Greycat entrou no mercado stealth, ninguém levou a sério. O Covert calou os críticos.',
    tags:'["Light","Stealth","Greycat"]', version:'3.16', rarity:'Uncommon',
    variants:['Blackout','Industrial Dark','Ghost'],
    pieces:[
      {type:'Helmet',rp:9,re:8,rd:5,rt:7,rb:4,rs:4,mob:3,slots:0,purch:true,loot:false,loc:'New Babbage - Garrity Defense / Orison',how:'Garrity Defense e lojas industriais em Orison.',price:4800,desc:'Capacete Covert com revestimento anti-radar Greycat.'},
      {type:'Torso',rp:12,re:10,rd:7,rt:9,rb:5,rs:5,mob:5,slots:2,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:6200,desc:'Torso com absorção de sinal eletromagnético.'},
      {type:'Arms',rp:9,re:7,rd:5,rt:6,rb:3,rs:3,mob:3,slots:1,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:4200,desc:'Braços com revestimento anti-reflexo.'},
      {type:'Legs',rp:9,re:7,rd:5,rt:6,rb:3,rs:3,mob:3,slots:1,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:4200,desc:'Perneiras com solas silenciosas.'},
    ],
  });

  addSet({ base_name:'Talon', manufacturer:'Apocalypse Arms', type:'Light', category:'Combat',
    description:'Armadura leve de combate da Apocalypse Arms — irmã leve do Corbel.',
    lore:'Criada para quem quer o estilo Apocalypse em um pacote ágil.',
    tags:'["Light","Combat","Apocalypse Arms"]', version:'3.14', rarity:'Common',
    variants:['Base','Amber','Ashen','Ember'],
    pieces:[
      {type:'Helmet',rp:10,re:8,rd:5,rt:7,rb:4,rs:4,mob:4,slots:0,loot:true,purch:true,loc:'Levski (Nyx) / Loot — Bunkers',how:'Levski (Nyx) ou loot em bunkers médios. Ember em alto nível.',price:4500,desc:'Capacete Talon leve com design agressivo.'},
      {type:'Torso',rp:13,re:10,rd:7,rt:9,rb:5,rs:5,mob:6,slots:2,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski é o hub. Amber e Ashen em loot criminal.',price:6000,desc:'Torso leve com placas balísticas modulares.'},
      {type:'Arms',rp:9,re:7,rd:4,rt:6,rb:3,rs:3,mob:4,slots:1,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski e loot.',price:4000,desc:'Braços Talon com mobilidade irrestrita.'},
      {type:'Legs',rp:9,re:7,rd:4,rt:6,rb:3,rs:3,mob:4,slots:1,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski e loot.',price:4000,desc:'Perneiras Talon para combate rápido.'},
    ],
  });

  // ── MEDIUM ──────────────────────────────────────────────────────────────────

  addSet({ base_name:'Inquisitor', manufacturer:'Kastak Arms', type:'Medium', category:'Combat',
    description:'Armadura de combate mid-range da Kastak Arms. Mais de 15 variantes de cor.',
    lore:'A linha Inquisitor serve operadores em dezenas de sistemas contestados.',
    tags:'["Medium","Combat","Versatile"]', version:'3.5', rarity:'Common',
    variants:['Aqua','Black','Blue','Green','Grey','Orange','Purple','Red','White','Imperial','Raven','Rager','Seagreen','Sienna','Violet'],
    pieces:[
      {type:'Helmet',rp:14,re:11,rd:8,rt:10,rb:6,rs:6,mob:6,slots:0,purch:true,loot:false,loc:'Lorville - Tammany and Sons / Area18 - Cubby Blast',how:'Tammany and Sons e Cubby Blast. Rager/Nine Tails por loot.',price:6500,desc:'Capacete Morningstar com visor balístico sólido.'},
      {type:'Torso',rp:18,re:15,rd:11,rt:13,rb:8,rs:8,mob:10,slots:3,purch:true,loot:false,loc:'Lorville - Tammany and Sons / Area18 - Cubby Blast',how:'Tammany and Sons e Cubby Blast.',price:8200,desc:'Torso médio balanceado com proteção acima da média.'},
      {type:'Arms',rp:13,re:10,rd:7,rt:9,rb:5,rs:5,mob:8,slots:1,purch:true,loot:false,loc:'Lorville - Tammany and Sons / Everus Harbor',how:'Tammany and Sons e Everus Harbor. Rager por loot.',price:6000,desc:'Braços médios com revestimento anti-fragmentação.'},
      {type:'Legs',rp:13,re:10,rd:7,rt:9,rb:5,rs:5,mob:8,slots:1,purch:true,loot:false,loc:'Lorville - Tammany and Sons / Area18',how:'Tammany and Sons. Nine Tails e Rager por loot.',price:6000,desc:'Perneiras médias com joelheiras reforçadas.'},
    ],
  });

  addSet({ base_name:'Defiance', manufacturer:'Clark Defense Systems', type:'Medium', category:'Combat',
    description:'Armadura civil da Clark Defense para engajamentos prolongados.',
    lore:'Incorporando know-how dos Marines da UEE.',
    tags:'["Medium","Combat","Defense","Clark Defense"]', version:'3.9', rarity:'Common',
    variants:['Base','Dark Red','Earthwork','Icefall','Ignitor','Outcrop','Roughshod','Brimstone'],
    pieces:[
      {type:'Helmet',rp:18,re:14,rd:10,rt:13,rb:8,rs:8,mob:9,slots:0,purch:true,loot:false,loc:'Lorville - Tammany and Sons / HUR-L1',how:'Tammany and Sons (Lorville) e HUR-L1.',price:8500,desc:'Capacete Fortifier com isolamento térmico.'},
      {type:'Torso',rp:22,re:18,rd:13,rt:15,rb:10,rs:10,mob:12,slots:3,purch:true,loot:false,loc:'Lorville - Tammany and Sons',how:'Tammany and Sons (Lorville).',price:10500,desc:'Torso Clark Defense civil adaptado de designs militares.'},
      {type:'Arms',rp:16,re:13,rd:9,rt:11,rb:7,rs:7,mob:10,slots:1,purch:true,loot:false,loc:'Lorville - Tammany and Sons / Everus Harbor',how:'Tammany and Sons e Everus Harbor.',price:7500,desc:'Braços com blindagem articulada.'},
      {type:'Legs',rp:16,re:13,rd:9,rt:11,rb:7,rs:7,mob:10,slots:1,purch:true,loot:false,loc:'Lorville - Tammany and Sons / HUR-L2',how:'Tammany and Sons e HUR-L2.',price:7500,desc:'Perneiras com proteção de coxa e canela.'},
    ],
  });

  addSet({ base_name:'Lynx', manufacturer:'Kastak Arms', type:'Medium', category:'Recon',
    description:'Armadura média ágil para reconhecimento e operações avançadas.',
    lore:'Proteção média sem sacrificar a agilidade necessária para recon.',
    tags:'["Medium","Recon","Agile"]', version:'3.14', rarity:'Common',
    variants:['Base','Forest','Urban','Desert'],
    pieces:[
      {type:'Helmet',rp:14,re:11,rd:8,rt:10,rb:7,rs:6,mob:8,slots:0,purch:true,loot:false,loc:'Area18 - Cubby Blast / Lorville',how:'Cubby Blast e Tammany and Sons.',price:6500,desc:'Capacete Lynx com perfil reduzido.'},
      {type:'Torso',rp:18,re:14,rd:10,rt:12,rb:9,rs:8,mob:11,slots:3,purch:true,loot:false,loc:'Area18 - Cubby Blast / Lorville',how:'Cubby Blast e Tammany and Sons.',price:8500,desc:'Torso médio Lynx com mobilidade acima da classe.'},
      {type:'Arms',rp:13,re:10,rd:7,rt:9,rb:6,rs:5,mob:8,slots:1,purch:true,loot:false,loc:'Area18 - Cubby Blast',how:'Cubby Blast em Area18.',price:6000,desc:'Braços Lynx com articulação livre.'},
      {type:'Legs',rp:13,re:10,rd:7,rt:9,rb:6,rs:5,mob:8,slots:1,purch:true,loot:false,loc:'Area18 - Cubby Blast / Lorville',how:'Múltiplos pontos de venda.',price:6000,desc:'Perneiras Lynx ágeis.'},
    ],
  });

  addSet({ base_name:'Chiron', manufacturer:'RRS', type:'Medium', category:'Combat',
    description:'Armadura média de alta performance da RRS com proteção equilibrada.',
    lore:'Nomeada pelo sábio centauro — equilibra todos os atributos perfeitamente.',
    tags:'["Medium","Combat","Balanced","RRS"]', version:'3.11', rarity:'Uncommon',
    variants:['Base','Storm','Moss Camo'],
    pieces:[
      {type:'Helmet',rp:17,re:13,rd:10,rt:12,rb:7,rs:7,mob:9,slots:0,loot:true,purch:true,loc:'Levski (Nyx) / Loot — Bunkers',how:'Levski (Nyx) ou loot em bunkers médio-alto.',price:7800,desc:'Capacete RRS balanceado com viseira de alta clareza.'},
      {type:'Torso',rp:20,re:16,rd:12,rt:14,rb:9,rs:9,mob:12,slots:3,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski é o principal.',price:9500,desc:'Torso RRS com distribuição uniforme de proteção.'},
      {type:'Arms',rp:15,re:12,rd:9,rt:10,rb:6,rs:6,mob:9,slots:1,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski e loot.',price:7000,desc:'Braços com proteção em todos os vetores.'},
      {type:'Legs',rp:15,re:12,rd:9,rt:10,rb:6,rs:6,mob:9,slots:1,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski e loot.',price:7000,desc:'Perneiras com articulação livre.'},
    ],
  });

  addSet({ base_name:'Arden-SL', manufacturer:'Clark Defense Systems', type:'Medium', category:'Combat',
    description:'Armadura streamlined da Clark Defense. Equilíbrio perfeito entre proteção e mobilidade.',
    lore:'SL = Streamlined. Tudo desnecessário foi eliminado.',
    tags:'["Medium","Combat","Streamlined","Clark Defense"]', version:'3.12', rarity:'Uncommon',
    variants:['Base','Archangel','Balefire','Coramor Fate','Coramor Kismet','Red Alert','Rime','Crusader Edition'],
    pieces:[
      {type:'Helmet',rp:18,re:14,rd:10,rt:12,rb:8,rs:8,mob:10,slots:0,purch:true,loot:false,loc:'Lorville - Tammany and Sons / ARC-L1',how:'Tammany and Sons. Coramor exclusivos de evento sazonal.',price:9000,desc:'Capacete streamlined com perfil reduzido.'},
      {type:'Torso',rp:22,re:18,rd:13,rt:16,rb:10,rs:10,mob:13,slots:3,purch:true,loot:false,loc:'Lorville - Tammany and Sons',how:'Tammany and Sons.',price:11000,desc:'Torso com menor penalidade de mobilidade da classe.'},
      {type:'Arms',rp:16,re:13,rd:9,rt:11,rb:7,rs:7,mob:9,slots:1,purch:true,loot:false,loc:'Lorville / Everus Harbor',how:'Tammany and Sons e Everus Harbor.',price:8000,desc:'Braços leves para classe média.'},
      {type:'Legs',rp:16,re:13,rd:9,rt:11,rb:7,rs:7,mob:9,slots:1,purch:true,loot:false,loc:'Lorville',how:'Tammany and Sons.',price:8000,desc:'Perneiras com mobilidade de leve e proteção de médio.'},
      {type:'Backpack',rp:0,re:0,rd:0,rt:0,rb:0,rs:0,mob:0,slots:4,purch:true,loot:false,loc:'Lorville / Area18 / New Babbage',how:'Disponível em quase todas as lojas grandes.',price:5200,desc:'Mochila Arden-CL com 4 slots.'},
    ],
  });

  addSet({ base_name:'Strider', manufacturer:'Greycat Industrial', type:'Medium', category:'Utility',
    description:'Armadura média industrial da Greycat com durabilidade excepcional.',
    lore:'Originalmente para mineração, provou ser igualmente capaz em combate.',
    tags:'["Medium","Utility","Industrial","Greycat"]', version:'3.7', rarity:'Common',
    variants:['Industrial','Camo','Safety Orange'],
    pieces:[
      {type:'Helmet',rp:13,re:10,rd:7,rt:9,rb:5,rs:5,mob:8,slots:0,purch:true,loot:false,loc:'New Babbage - Garrity Defense / Orison',how:'Garrity Defense (NB) e lojas em Orison.',price:6000,desc:'Capacete industrial com proteção contra impactos.'},
      {type:'Torso',rp:16,re:12,rd:9,rt:11,rb:7,rs:7,mob:10,slots:4,purch:true,loot:false,loc:'New Babbage - Garrity Defense / Seraphim Station',how:'Garrity Defense e Seraphim Station.',price:8000,desc:'Torso utilitário pesado com 4 slots.'},
      {type:'Arms',rp:12,re:9,rd:6,rt:8,rb:5,rs:5,mob:7,slots:2,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:5500,desc:'Braços reforçados para ferramentas pesadas.'},
      {type:'Legs',rp:12,re:9,rd:6,rt:8,rb:5,rs:5,mob:7,slots:2,purch:true,loot:false,loc:'New Babbage / Orison',how:'Garrity Defense e lojas em Orison.',price:5500,desc:'Perneiras industriais com joelho reforçado.'},
    ],
  });

  addSet({ base_name:'Pembroke', manufacturer:'RSI', type:'Medium', category:'Explorer',
    description:'Armadura média de exploração da RSI com proteção ambiental avançada.',
    lore:'RSI projetou a Pembroke para explorar tanto em combate quanto em ambientes extremos.',
    tags:'["Medium","Explorer","RSI","Environmental"]', version:'3.14', rarity:'Uncommon',
    variants:['Base','RSI Graphite','RSI Ivory','RSI Sunburst','Starchaser Edition','Nine Tails Modified'],
    pieces:[
      {type:'Helmet',rp:17,re:14,rd:10,rt:13,rb:9,rs:8,mob:10,slots:0,purch:true,loot:false,loc:'New Babbage - Garrity Defense / RSI Pledge Store',how:'Base em Garrity Defense. Variantes especiais via RSI Pledge Store.',price:8500,desc:'Capacete de exploração RSI com análise ambiental.'},
      {type:'Torso',rp:20,re:17,rd:12,rt:15,rb:11,rs:10,mob:12,slots:3,purch:true,loot:false,loc:'New Babbage - Garrity Defense / RSI Pledge Store',how:'Garrity Defense e RSI Pledge Store.',price:10500,desc:'Torso RSI Pembroke com suporte de vida e 3 slots.'},
      {type:'Arms',rp:15,re:12,rd:9,rt:11,rb:8,rs:7,mob:9,slots:1,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:7500,desc:'Braços com sensores de temperatura e pressão.'},
      {type:'Legs',rp:15,re:12,rd:9,rt:11,rb:8,rs:7,mob:9,slots:1,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:7500,desc:'Perneiras RSI com proteção ambiental aprimorada.'},
      {type:'Backpack',rp:0,re:0,rd:0,rt:0,rb:0,rs:0,mob:0,slots:4,purch:true,loot:false,loc:'New Babbage / RSI Pledge Store',how:'Garrity Defense e RSI Pledge Store.',price:5500,desc:'Mochila Pembroke com 4 slots.'},
    ],
  });

  addSet({ base_name:'FBL-8a', manufacturer:'RSI', type:'Medium', category:'Military',
    description:'Armadura média grau militar da RSI com proteção balística avançada.',
    lore:'A série FBL equipa os Marines da UEE há décadas.',
    tags:'["Medium","Military","RSI","UEE"]', version:'3.9', rarity:'Uncommon',
    variants:['Military Green','Desert Digital','Imperial Red'],
    pieces:[
      {type:'Helmet',rp:19,re:15,rd:11,rt:13,rb:9,rs:9,mob:11,slots:0,purch:true,loot:false,loc:'Lorville - Hurston Security Depot / RSI Pledge Store',how:'Hurston Security Depot (CBD de Lorville).',price:9500,desc:'Capacete FBL-8a com visor balístico militar.'},
      {type:'Torso',rp:24,re:19,rd:14,rt:16,rb:11,rs:11,mob:14,slots:3,purch:true,loot:false,loc:'Lorville - Hurston Security Depot',how:'Hurston Security Depot.',price:12500,desc:'Torso FBL-8a com proteção militar de 3 camadas.'},
      {type:'Arms',rp:17,re:14,rd:10,rt:12,rb:8,rs:8,mob:11,slots:1,purch:true,loot:false,loc:'Lorville - Hurston Security Depot',how:'Hurston Security Depot e estações L de Hurston.',price:9000,desc:'Braços FBL-8a com proteção balística UEE.'},
      {type:'Legs',rp:17,re:14,rd:10,rt:12,rb:8,rs:8,mob:11,slots:1,purch:true,loot:false,loc:'Lorville - Hurston Security Depot',how:'Hurston Security Depot.',price:9000,desc:'Perneiras FBL-8a com ancoragem para terrenos variados.'},
    ],
  });

  addSet({ base_name:'Siebe', manufacturer:'RRS', type:'Medium', category:'Environmental',
    description:'Armadura média da RRS com design náutico e resistência bioquímica máxima.',
    lore:'Nomeada em homenagem a Augustus Siebe, inventor do traje de mergulho moderno.',
    tags:'["Medium","Environmental","RRS","Aquatic"]', version:'3.16', rarity:'Uncommon',
    variants:['Base','Beachhead','Thundercloud','Tidal Wave'],
    pieces:[
      {type:'Helmet',rp:16,re:13,rd:10,rt:11,rb:13,rs:9,mob:10,slots:0,purch:true,loot:false,loc:'New Babbage - Garrity Defense / Levski',how:'Garrity Defense (NB) com estoque regular.',price:7800,desc:'Capacete Siebe com vedação e resistência a corrosão.'},
      {type:'Torso',rp:20,re:16,rd:12,rt:14,rb:16,rs:11,mob:13,slots:3,purch:true,loot:false,loc:'New Babbage - Garrity Defense / Levski',how:'Garrity Defense é o ponto principal em Stanton.',price:10000,desc:'Torso RRS Siebe com resistência bioquímica elevada.'},
      {type:'Arms',rp:14,re:11,rd:8,rt:10,rb:11,rs:7,mob:9,slots:1,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:7200,desc:'Braços com vedação à prova d\'água.'},
      {type:'Legs',rp:14,re:11,rd:8,rt:10,rb:11,rs:7,mob:9,slots:1,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense. Bom para Orison.',price:7200,desc:'Perneiras Siebe com junta vedada náutica.'},
    ],
  });

  addSet({ base_name:'Stirling Exploration', manufacturer:'Behring', type:'Medium', category:'Explorer',
    description:'Traje de exploração da Behring. Variante ASD usada por segurança avançada.',
    lore:'Décadas de engenharia militar para um traje que vai de planetas hostis a zonas de combate.',
    tags:'["Medium","Explorer","Behring","Multi-environment"]', version:'3.17', rarity:'Uncommon',
    variants:['Base','ASD Edition','Alkaline','Chroma','Granite','Olympian','Sandstorm','Sediment','Transistor','Tungsten'],
    pieces:[
      {type:'Helmet',rp:17,re:14,rd:10,rt:13,rb:10,rs:9,mob:11,slots:0,purch:true,loot:false,loc:'Lorville / New Babbage / ASD Facilities (ASD Edition)',how:'Base em Lorville e New Babbage. ASD Edition em instalações ASD.',price:8500,desc:'Capacete Stirling com HUD de exploração.'},
      {type:'Torso',rp:21,re:17,rd:12,rt:15,rb:12,rs:11,mob:13,slots:3,purch:true,loot:false,loc:'Lorville / New Babbage / Múltiplas lojas',how:'Disponível em múltiplas lojas.',price:11000,desc:'Torso Stirling com suporte de vida.'},
      {type:'Arms',rp:15,re:12,rd:9,rt:11,rb:9,rs:8,mob:10,slots:1,purch:true,loot:false,loc:'Lorville / New Babbage',how:'Lorville e New Babbage.',price:7800,desc:'Braços com revestimento multiambiental.'},
      {type:'Legs',rp:15,re:12,rd:9,rt:11,rb:9,rs:8,mob:10,slots:1,purch:true,loot:false,loc:'Lorville / New Babbage',how:'Mesmo que os braços.',price:7800,desc:'Perneiras Stirling multiambiente.'},
    ],
  });

  addSet({ base_name:'Venture', manufacturer:'Greycat Industrial', type:'Medium', category:'Explorer',
    description:'Armadura média orientada para exploração com proteção ambiental aprimorada.',
    lore:'Projetada para o espírito de fronteira.',
    tags:'["Medium","Explorer","Environmental","Greycat"]', version:'3.8', rarity:'Common',
    variants:['Base','Arctic','Desert'],
    pieces:[
      {type:'Helmet',rp:14,re:12,rd:8,rt:11,rb:7,rs:6,mob:8,slots:0,purch:true,loot:false,loc:'New Babbage - MicroTech Store / Seraphim Station',how:'MicroTech Store (New Babbage) e Seraphim Station.',price:7000,desc:'Capacete de exploração Greycat.'},
      {type:'Torso',rp:17,re:14,rd:10,rt:13,rb:9,rs:8,mob:10,slots:4,purch:true,loot:false,loc:'New Babbage - MicroTech Store',how:'MicroTech Store.',price:9000,desc:'Torso explorador com 4 slots.'},
      {type:'Arms',rp:12,re:10,rd:7,rt:9,rb:6,rs:5,mob:7,slots:2,purch:true,loot:false,loc:'New Babbage - MicroTech Store',how:'MicroTech Store.',price:6200,desc:'Braços Venture com proteção básica.'},
      {type:'Legs',rp:12,re:10,rd:7,rt:9,rb:6,rs:5,mob:7,slots:2,purch:true,loot:false,loc:'New Babbage - MicroTech Store',how:'MicroTech Store.',price:6200,desc:'Perneiras Venture com isolamento ambiental.'},
    ],
  });

  // ── HEAVY ───────────────────────────────────────────────────────────────────

  addSet({ base_name:'Citadel', manufacturer:'Clark Defense Systems', type:'Heavy', category:'Combat',
    description:'Armadura pesada carro-chefe da Clark Defense. Proteção quase militar.',
    lore:'O que acontece quando engenheiros se recusam a comprometer.',
    tags:'["Heavy","Combat","Flagship","Clark Defense"]', version:'3.8', rarity:'Common',
    variants:['Base','Brimstone','Dark Red','Earthwork','Icefall','Ignitor','Outcrop','Roughshod','Maroon','Dark Green','White'],
    pieces:[
      {type:'Helmet',rp:24,re:20,rd:15,rt:18,rb:12,rs:12,mob:15,slots:0,purch:true,loot:false,loc:'Lorville - Tammany and Sons / HUR-L1 até HUR-L5',how:'Tammany and Sons e todos os postos L de Hurston.',price:45000,desc:'Capacete pesado Clark Defense com viseira blindada tripla.'},
      {type:'Torso',rp:28,re:24,rd:18,rt:22,rb:14,rs:14,mob:20,slots:4,purch:true,loot:false,loc:'Lorville - Tammany and Sons',how:'Tammany and Sons — estoque constante.',price:16000,desc:'Torso pesado Clark Defense com 4 slots.'},
      {type:'Arms',rp:22,re:18,rd:14,rt:16,rb:10,rs:10,mob:18,slots:1,purch:true,loot:false,loc:'Lorville - Tammany and Sons / Everus Harbor',how:'Tammany and Sons e Everus Harbor.',price:13500,desc:'Braços pesados com proteção de articulação titanium.'},
      {type:'Legs',rp:22,re:18,rd:14,rt:16,rb:10,rs:10,mob:18,slots:1,purch:true,loot:false,loc:'Lorville - Tammany and Sons / HUR-L2',how:'Tammany and Sons e HUR-L2.',price:13500,desc:'Perneiras pesadas com articulação motorizada.'},
    ],
  });

  addSet({ base_name:'Morozov-SH', manufacturer:'Clark Defense Systems', type:'Heavy', category:'Assault',
    description:'Armadura pesada da Clark Defense para assalto na linha de frente.',
    lore:'Testada em alguns dos engajamentos mais brutais de Stanton.',
    tags:'["Heavy","Assault","Front-line","Clark Defense"]', version:'3.11', rarity:'Uncommon',
    variants:['Base','Aftershock','Brushdrift','Gold Horizon','Lifeforce','Pyrotechnic','Redshift','Snowdrift','Terracotta','Thule','Gideon'],
    pieces:[
      {type:'Helmet',rp:25,re:21,rd:16,rt:19,rb:13,rs:13,mob:18,slots:0,purch:true,loot:false,loc:'Lorville - Tammany and Sons / HUR-L1 até HUR-L5',how:'Tammany and Sons e postos L de Hurston. Gideon em pacotes especiais.',price:13000,desc:'Capacete Sangar com proteção frontal reforçada.'},
      {type:'Torso',rp:27,re:23,rd:17,rt:21,rb:15,rs:15,mob:25,slots:4,purch:true,loot:false,loc:'Lorville - Tammany and Sons',how:'Tammany and Sons.',price:16500,desc:'Torso pesado de assalto com 4 slots.'},
      {type:'Arms',rp:21,re:17,rd:13,rt:15,rb:11,rs:11,mob:20,slots:1,purch:true,loot:false,loc:'Lorville - Tammany and Sons / Everus Harbor',how:'Tammany and Sons e Everus Harbor.',price:14000,desc:'Braços pesados com proteção de ombro aumentada.'},
      {type:'Legs',rp:21,re:17,rd:13,rt:15,rb:11,rs:11,mob:20,slots:1,purch:true,loot:false,loc:'Lorville - Tammany and Sons',how:'Tammany and Sons.',price:14000,desc:'Perneiras de assalto com estabilizadores.'},
      {type:'Backpack',rp:0,re:0,rd:0,rt:0,rb:0,rs:0,mob:0,slots:5,purch:true,loot:false,loc:'Lorville / Orison / New Babbage / Area18',how:'Uma das mochilas mais populares — disponível em quase todas as lojas.',price:6000,desc:'Mochila Morozov-CH com 5 slots.'},
    ],
  });

  addSet({ base_name:'Palatino', manufacturer:'Clark Defense Systems', type:'Heavy', category:'Tank',
    description:'A armadura mais protetora da Clark Defense. Uma fortaleza ambulante.',
    lore:'Quando você não pode se dar ao luxo de ser morto, você veste a Palatino.',
    tags:'["Heavy","Tank","Maximum Protection","Clark Defense"]', version:'3.12', rarity:'Uncommon',
    variants:['Base','Daystar','Deadlock','Mark I','Metropolis','Moonfall','Necropolis','Shadow Gild','Sunstone'],
    pieces:[
      {type:'Helmet',rp:26,re:22,rd:16,rt:20,rb:14,rs:14,mob:20,slots:0,purch:true,loot:false,loc:'Lorville - Tammany and Sons / Hurston Security Depot',how:'Tammany and Sons e Hurston Security Depot.',price:14000,desc:'Capacete tank com viseira anti-tudo.'},
      {type:'Torso',rp:30,re:26,rd:19,rt:24,rb:18,rs:18,mob:28,slots:4,purch:true,loot:false,loc:'Lorville - Hurston Security Depot',how:'Hurston Security Depot é o fornecedor primário.',price:18000,desc:'Torso mais protetor em loja — 5 camadas de blindagem.'},
      {type:'Arms',rp:24,re:20,rd:15,rt:18,rb:13,rs:13,mob:22,slots:1,purch:true,loot:false,loc:'Lorville - Tammany and Sons / Hurston Security Depot',how:'Lorville hub.',price:15000,desc:'Braços com articulação pneumática e blindagem máxima.'},
      {type:'Legs',rp:24,re:20,rd:15,rt:18,rb:13,rs:13,mob:22,slots:1,purch:true,loot:false,loc:'Lorville - Tammany and Sons / Hurston Security Depot',how:'Lorville hub.',price:15000,desc:'Perneiras tank com proteção total.'},
      {type:'Backpack',rp:0,re:0,rd:0,rt:0,rb:0,rs:0,mob:0,slots:5,purch:true,loot:false,loc:'Lorville / Area18 / ARC-L1',how:'Disponível em múltiplos locais.',price:5500,desc:'Mochila Palatino com 5 slots.'},
    ],
  });

  addSet({ base_name:'Corbel', manufacturer:'Apocalypse Arms', type:'Heavy', category:'Siege',
    description:'Armadura pesada de cerco da Apocalypse Arms.',
    lore:'Feita pelas pessoas que projetam as defesas — sabe como derrubá-las.',
    tags:'["Heavy","Siege","Apocalypse Arms"]', version:'3.13', rarity:'Uncommon',
    variants:['Base','Crush','Halcyon','Mire','Patina','Smolder'],
    pieces:[
      {type:'Helmet',rp:24,re:20,rd:15,rt:18,rb:12,rs:12,mob:18,slots:0,loot:true,purch:true,loc:'Levski (Nyx) / Loot — DCs Alto Nível',how:'Levski (Nyx) para compra. DCs de alto nível para loot.',price:13500,desc:'Capacete de cerco com blindagem facial total.'},
      {type:'Torso',rp:25,re:21,rd:16,rt:19,rb:13,rs:13,mob:23,slots:4,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski e loot. Vale a viagem a Nyx.',price:16000,desc:'Torso de cerco com proteção frontal reforçada.'},
      {type:'Arms',rp:19,re:16,rd:12,rt:14,rb:10,rs:10,mob:18,slots:1,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski ou loot de alto nível.',price:12000,desc:'Braços para operações de breach.'},
      {type:'Legs',rp:19,re:16,rd:12,rt:14,rb:10,rs:10,mob:18,slots:1,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski e loot.',price:12000,desc:'Perneiras com proteção a explosivos.'},
      {type:'Backpack',rp:0,re:0,rd:0,rt:0,rb:0,rs:0,mob:0,slots:5,purch:true,loot:false,loc:'Levski / Area18 / Lorville',how:'Disponível em Levski e lojas principais.',price:5800,desc:'Mochila Corbel com 5 slots.'},
    ],
  });

  addSet({ base_name:'Salvo', manufacturer:'Apocalypse Arms', type:'Heavy', category:'Assault',
    description:'Armadura pesada de assalto da Apocalypse Arms. Prima do Corbel.',
    lore:'Para quem não apenas entra pela porta — derruba a parede.',
    tags:'["Heavy","Assault","Apocalypse Arms"]', version:'3.15', rarity:'Uncommon',
    variants:['Base','Blackout','Firestorm','Gunmetal'],
    pieces:[
      {type:'Helmet',rp:25,re:21,rd:16,rt:19,rb:13,rs:13,mob:20,slots:0,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski (Nyx) para compra. Firestorm é a mais cobiçada.',price:13500,desc:'Capacete Salvo com viseira blindada de assalto.'},
      {type:'Torso',rp:28,re:23,rd:18,rt:22,rb:15,rs:15,mob:25,slots:4,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski é o hub. Loot em DCs de dificuldade máxima.',price:16500,desc:'Torso Salvo com 4 slots e blindagem frontal.'},
      {type:'Arms',rp:21,re:18,rd:14,rt:16,rb:11,rs:11,mob:19,slots:1,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski e loot.',price:13000,desc:'Braços para confronto frontal e suporte de armas pesadas.'},
      {type:'Legs',rp:21,re:18,rd:14,rt:16,rb:11,rs:11,mob:19,slots:1,loot:true,purch:true,loc:'Levski (Nyx) / Loot',how:'Levski e loot.',price:13000,desc:'Perneiras com estabilizadores de recoil.'},
      {type:'Backpack',rp:0,re:0,rd:0,rt:0,rb:0,rs:0,mob:0,slots:5,purch:true,loot:false,loc:'Levski / Area18 / Lorville',how:'Disponível em Levski e lojas principais.',price:5800,desc:'Mochila Salvo com 5 slots.'},
    ],
  });

  addSet({ base_name:'Strata', manufacturer:'Quirinus Tech', type:'Heavy', category:'Environmental',
    description:'Armadura pesada ambiental com variantes corporativas da Quirinus Tech.',
    lore:'A Strata adapta-se ao ambiente — tanto em proteção quanto em aparência.',
    tags:'["Heavy","Environmental","Quirinus Tech"]', version:'3.14', rarity:'Common',
    variants:['Sand','Jet','Storm','Moss Camo','Calico','Onyx','Shooting Star','ArcCorp','Crusader','Hurston','Greycat','Shubin','microTech'],
    pieces:[
      {type:'Helmet',rp:21,re:17,rd:13,rt:17,rb:15,rs:11,mob:17,slots:0,loot:true,purch:true,loc:'Area18 / Lorville / New Babbage / Orison / Loot',how:'Disponível em múltiplas lojas. Variantes corporativas em lojas das respectivas facções.',price:12000,desc:'Capacete ambiental Strata com filtragem integrada.'},
      {type:'Torso',rp:23,re:19,rd:14,rt:19,rb:18,rs:13,mob:21,slots:3,loot:true,purch:true,loc:'Múltiplas lojas / Loot',how:'Uma das peças pesadas mais acessíveis.',price:15000,desc:'Torso pesado ambiental com proteção química e térmica.'},
      {type:'Arms',rp:18,re:14,rd:10,rt:14,rb:13,rs:9,mob:16,slots:1,loot:true,purch:true,loc:'Múltiplas lojas / Loot',how:'Mesma distribuição ampla.',price:11000,desc:'Braços Strata com vedação ambiental.'},
      {type:'Legs',rp:18,re:14,rd:10,rt:14,rb:13,rs:9,mob:16,slots:1,loot:true,purch:true,loc:'Múltiplas lojas / Loot',how:'Mesma distribuição.',price:11000,desc:'Perneiras Strata com isolamento ambiental completo.'},
      {type:'Backpack',rp:0,re:0,rd:0,rt:0,rb:0,rs:0,mob:0,slots:4,purch:true,loot:false,loc:'Area18 / Lorville / New Babbage / Todas as estações',how:'Uma das mochilas mais vendidas do jogo.',price:4500,desc:'Mochila Strata com 4 slots.'},
    ],
  });

  addSet({ base_name:'Antium', manufacturer:'Quirinus Tech', type:'Heavy', category:'Environmental',
    description:'Armadura pesada totalmente fechada com sensores e proteção hazmat.',
    lore:'A Antium protege contra tudo que o verso pode lançar em você.',
    tags:'["Heavy","Environmental","Hazmat","Rare","Quirinus Tech"]', version:'3.15', rarity:'Rare',
    variants:['Base','Sand','Jet','Storm','Moss Camo','Onyx','Shooting Star'],
    pieces:[
      {type:'Helmet',rp:22,re:18,rd:13,rt:17,rb:16,rs:12,mob:16,slots:0,loot:true,purch:false,loc:'Loot — Hathor PAF Sites / OLP Stations',how:'Caixas laranjas em instalações PAF de Hathor e OLP.',price:0,desc:'Capacete com sensores 360° e visão em qualquer condição.'},
      {type:'Torso',rp:25,re:21,rd:16,rt:20,rb:19,rs:15,mob:22,slots:3,loot:true,purch:false,loc:'Loot — Hathor PAF Sites',how:'Caixas laranjas grandes nas salas de segurança PAF.',price:0,desc:'Torso totalmente vedado com processamento de ar.'},
      {type:'Arms',rp:20,re:16,rd:12,rt:16,rb:15,rs:10,mob:18,slots:1,loot:true,purch:false,loc:'Loot — Hathor PAF / OLP',how:'Mesmo sistema. Leve um grupo.',price:0,desc:'Braços com vedação hermética e resistência química.'},
      {type:'Legs',rp:20,re:16,rd:12,rt:16,rb:15,rs:10,mob:18,slots:1,loot:true,purch:false,loc:'Loot — Hathor PAF / OLP',how:'Hathor PAF Sites são a melhor aposta.',price:0,desc:'Perneiras com isolamento térmico e químico total.'},
    ],
  });

  addSet({ base_name:'Testudo', manufacturer:'RSI', type:'Heavy', category:'Defense',
    description:'Armadura pesada defensiva premium da RSI. Construída para resistir.',
    lore:'Inspirada na formação tática romana — proteger, segurar, avançar.',
    tags:'["Heavy","Defense","RSI","Premium"]', version:'3.9', rarity:'Uncommon',
    variants:['Military','Gold','Red','Clanguard','Combustion','Deathblow','Disrupt Camo','Earthshake','Nightveil','Purgatory Camo','Turfwar'],
    pieces:[
      {type:'Helmet',rp:26,re:22,rd:16,rt:20,rb:14,rs:14,mob:20,slots:0,purch:true,loot:false,loc:'RSI Pledge Store / Area18 - Cubby Blast / Lorville',how:'RSI Pledge Store para variantes especiais. In-game em Cubby Blast e Tammany and Sons.',price:14500,desc:'Capacete RSI Testudo com blindagem frontal máxima.'},
      {type:'Torso',rp:29,re:25,rd:18,rt:22,rb:16,rs:16,mob:26,slots:4,purch:true,loot:false,loc:'RSI Pledge Store / Lorville - Tammany and Sons',how:'Tammany and Sons in-game ou RSI Pledge Store.',price:18500,desc:'Torso RSI de máxima defesa com 4 slots.'},
      {type:'Arms',rp:23,re:19,rd:14,rt:17,rb:12,rs:12,mob:20,slots:1,purch:true,loot:false,loc:'RSI Pledge Store / Lorville',how:'Tammany and Sons base. RSI Pledge Store variantes.',price:15000,desc:'Braços RSI com proteção de ombro reforçada.'},
      {type:'Legs',rp:23,re:19,rd:14,rt:17,rb:12,rs:12,mob:20,slots:1,purch:true,loot:false,loc:'RSI Pledge Store / Lorville',how:'Mesmo que os braços.',price:15000,desc:'Perneiras RSI pesadas.'},
      {type:'Backpack',rp:0,re:0,rd:0,rt:0,rb:0,rs:0,mob:0,slots:5,purch:true,loot:false,loc:'Area18 / Lorville / New Babbage',how:'Amplamente disponível.',price:6200,desc:'Mochila RSI Testudo com 5 slots.'},
    ],
  });

  addSet({ base_name:'ORC-mkV', manufacturer:'Behring', type:'Heavy', category:'Military',
    description:'Armadura de combate mark V da Behring. Emissão padrão UEE.',
    lore:'Cinco gerações de refinamento — espinha dorsal das forças terrestres da UEE.',
    tags:'["Heavy","Military","UEE","Behring"]', version:'3.7', rarity:'Common',
    variants:['Military','Desert','Urban','Arctic'],
    pieces:[
      {type:'Helmet',rp:23,re:19,rd:14,rt:18,rb:12,rs:12,mob:18,slots:0,purch:true,loot:false,loc:'Everus Harbor / HUR-L1-L5',how:'Everus Harbor e postos L de Hurston.',price:11000,desc:'Capacete padrão UEE quinta geração.'},
      {type:'Torso',rp:26,re:22,rd:16,rt:20,rb:13,rs:13,mob:22,slots:4,purch:true,loot:false,loc:'Lorville - Hurston Security Depot / HUR-L1-L5',how:'Hurston Security Depot e pontos L.',price:15000,desc:'Torso padrão militar UEE.'},
      {type:'Arms',rp:20,re:16,rd:12,rt:15,rb:10,rs:10,mob:16,slots:1,purch:true,loot:false,loc:'Lorville / Everus Harbor / HUR-L points',how:'Mesmo locais do torso.',price:12000,desc:'Braços militares UEE padrão.'},
      {type:'Legs',rp:20,re:16,rd:12,rt:15,rb:10,rs:10,mob:16,slots:1,purch:true,loot:false,loc:'Lorville / Everus Harbor / HUR-L points',how:'Mesmo que os braços.',price:12000,desc:'Perneiras militares ORC.'},
    ],
  });

  addSet({ base_name:'Overlord', manufacturer:'Clark Defense Systems', type:'Heavy', category:'Assault',
    description:'Armadura pesada premium da Clark Defense. Domina o campo de batalha.',
    lore:'Comandantes que vestem a Overlord não apenas sobrevivem — definem as batalhas.',
    tags:'["Heavy","Assault","Premium","Clark Defense"]', version:'3.10', rarity:'Uncommon',
    variants:['Base','Military','Dark Red','Stinger','Hoplite'],
    pieces:[
      {type:'Helmet',rp:26,re:22,rd:16,rt:20,rb:14,rs:14,mob:20,slots:0,purch:true,loot:false,loc:'Lorville - Tammany and Sons / New Babbage MicroTech Luxury',how:'Tammany and Sons e MicroTech Luxury. Stinger exclusivo da loja premium.',price:14000,desc:'Capacete Overlord com HUD tático completo.'},
      {type:'Torso',rp:30,re:25,rd:19,rt:23,rb:17,rs:17,mob:26,slots:4,purch:true,loot:false,loc:'Lorville - Tammany and Sons / MicroTech Luxury',how:'Tammany and Sons e MicroTech Luxury.',price:18000,desc:'Torso pesado com 4 slots e blindagem generalíssimo.'},
      {type:'Arms',rp:24,re:20,rd:15,rt:18,rb:13,rs:13,mob:21,slots:1,purch:true,loot:false,loc:'Lorville - Tammany and Sons',how:'Tammany and Sons.',price:15000,desc:'Braços Overlord com proteção de ombro premium.'},
      {type:'Legs',rp:24,re:20,rd:15,rt:18,rb:13,rs:13,mob:21,slots:1,purch:true,loot:false,loc:'Lorville - Tammany and Sons',how:'Tammany and Sons.',price:15000,desc:'Perneiras Overlord premium.'},
    ],
  });

  addSet({ base_name:'Centurion', manufacturer:'Achilles Ballistics', type:'Heavy', category:'Defense',
    description:'Armadura pesada de defesa da Achilles Ballistics. Para defender posições.',
    lore:'Nomeada pela guarda de Roma. Como eles, o Centurion não recua.',
    tags:'["Heavy","Defense","Achilles Ballistics"]', version:'3.13', rarity:'Uncommon',
    variants:['Base','Legion','Tribune','Consul'],
    pieces:[
      {type:'Helmet',rp:27,re:23,rd:17,rt:21,rb:15,rs:15,mob:22,slots:0,purch:true,loot:false,loc:'Lorville - Hurston Security Depot / ARC-L2',how:'Hurston Security Depot e ARC-L2 McCaffrey Station.',price:14000,desc:'Capacete Centurion com viseira balística militar.'},
      {type:'Torso',rp:32,re:27,rd:21,rt:25,rb:18,rs:18,mob:28,slots:4,purch:true,loot:false,loc:'Lorville - Hurston Security Depot',how:'Maior proteção balística de torso disponível em loja.',price:19000,desc:'Torso Centurion — máxima proteção disponível em lojas.'},
      {type:'Arms',rp:25,re:21,rd:16,rt:19,rb:14,rs:14,mob:22,slots:1,purch:true,loot:false,loc:'Lorville - Hurston Security Depot',how:'Hurston Security Depot.',price:15500,desc:'Braços com placas de deflexão defensivas.'},
      {type:'Legs',rp:25,re:21,rd:16,rt:19,rb:14,rs:14,mob:22,slots:1,purch:true,loot:false,loc:'Lorville - Hurston Security Depot',how:'Hurston Security Depot.',price:15500,desc:'Perneiras Centurion com amortecimento máximo.'},
    ],
  });

  addSet({ base_name:'Novikov', manufacturer:'Caldera', type:'Heavy', category:'Environmental',
    description:'Traje pesado da Caldera para ambientes de até -225°C.',
    lore:'Sensores que ajustam inteligentemente para manter temperatura corporal estável.',
    tags:'["Heavy","Environmental","Cold","Caldera"]', version:'3.9', rarity:'Uncommon',
    variants:['Base','Ascension','Expo','Crush'],
    pieces:[
      {type:'Helmet',rp:20,re:15,rd:10,rt:30,rb:12,rs:10,mob:18,slots:0,purch:true,loot:false,loc:'New Babbage - Garrity Defense / ARC-L4',how:'Garrity Defense e ARC-L4. Ascension via RSI Pledge Store.',price:9500,desc:'Capacete com vedação criogênica e visor aquecido.'},
      {type:'Torso',rp:25,re:18,rd:12,rt:35,rb:15,rs:12,mob:22,slots:4,purch:true,loot:false,loc:'New Babbage - Garrity Defense / Orison',how:'Garrity Defense e Orison.',price:12000,desc:'Traje Novikov — proteção total contra frio extremo.'},
      {type:'Arms',rp:18,re:13,rd:9,rt:25,rb:11,rs:9,mob:18,slots:1,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:9000,desc:'Braços com aquecimento elétrico e luvas criogênicas.'},
      {type:'Legs',rp:18,re:13,rd:9,rt:25,rb:11,rs:9,mob:18,slots:1,purch:true,loot:false,loc:'New Babbage - Garrity Defense',how:'Garrity Defense.',price:9000,desc:'Perneiras com isolamento térmico e botas aquecidas.'},
      {type:'Backpack',rp:0,re:0,rd:0,rt:0,rb:0,rs:0,mob:0,slots:4,purch:true,loot:false,loc:'New Babbage / Orison / RSI Pledge Store',how:'Garrity Defense e lojas principais.',price:5000,desc:'Mochila Novikov com 4 slots e isolamento térmico.'},
    ],
  });

  // ── SPECIAL ─────────────────────────────────────────────────────────────────

  addSet({ base_name:'Stitcher', manufacturer:'Nine Tails', type:'Special', category:'Gang',
    description:'Armadura da gang Nine Tails. Obtida derrotando membros da gang.',
    lore:'Costurada de peças recuperadas — símbolo da engenhosidade Nine Tails.',
    tags:'["Special","Gang","Loot","Nine Tails"]', version:'3.13', rarity:'Rare',
    variants:['Nine Tails Red','Patchwork'],
    pieces:[
      {type:'Helmet',rp:14,re:12,rd:8,rt:10,rb:7,rs:7,mob:8,slots:0,loot:true,purch:false,loc:'Loot — Nine Tails Strongholds / DCs',how:'Loot de membros Nine Tails ou caixas em strongholds.',price:0,desc:'Capacete remendado — surpreendentemente eficaz.'},
      {type:'Torso',rp:16,re:14,rd:9,rt:12,rb:8,rs:8,mob:10,slots:3,loot:true,purch:false,loc:'Loot — Nine Tails Strongholds',how:'Strongholds de alta dificuldade. Derrote o líder local.',price:0,desc:'Torso patchwork Nine Tails.'},
      {type:'Arms',rp:12,re:10,rd:7,rt:9,rb:6,rs:6,mob:8,slots:1,loot:true,purch:false,loc:'Loot — Nine Tails Members / DCs',how:'Qualquer bunker com presença Nine Tails.',price:0,desc:'Braços improvisados patchwork.'},
      {type:'Legs',rp:12,re:10,rd:7,rt:9,rb:6,rs:6,mob:8,slots:1,loot:true,purch:false,loc:'Loot — Nine Tails Members',how:'Loot de membros Nine Tails.',price:0,desc:'Perneiras remendadas.'},
    ],
  });

  addSet({ base_name:'Artimex', manufacturer:'Quirinus Tech', type:'Special', category:'Collector',
    description:'Armadura de colecionador da Quirinus Tech. Status symbol do verso.',
    lore:'A Artimex é tanto arte quanto armadura.',
    tags:'["Special","Collector","Legendary"]', version:'3.18', rarity:'Legendary',
    variants:["Chairman's Club",'Elysium','Standard'],
    pieces:[
      {type:'Helmet',rp:14,re:11,rd:8,rt:10,rb:7,rs:7,mob:7,slots:0,loot:false,purch:true,loc:"RSI Pledge Store / Eventos Chairman's Club",how:"Via RSI Pledge Store em pacotes Chairman's Club.",price:0,desc:'Capacete com design de arte generativa único.'},
      {type:'Torso',rp:17,re:14,rd:10,rt:12,rb:9,rs:9,mob:9,slots:3,loot:false,purch:true,loc:'RSI Pledge Store / Eventos',how:'Exclusivo de pledges e eventos RSI.',price:0,desc:'Torso com gravuras artísticas únicas.'},
      {type:'Arms',rp:12,re:10,rd:7,rt:9,rb:6,rs:6,mob:6,slots:1,loot:false,purch:true,loc:'RSI Pledge Store / Eventos',how:'Exclusivo.',price:0,desc:'Braços com acabamento artesanal.'},
      {type:'Legs',rp:12,re:10,rd:7,rt:9,rb:6,rs:6,mob:6,slots:1,loot:false,purch:true,loc:'RSI Pledge Store / Eventos',how:'Exclusivo.',price:0,desc:'Perneiras Artimex de colecionador.'},
      {type:'Backpack',rp:0,re:0,rd:0,rt:0,rb:0,rs:0,mob:0,slots:4,loot:false,purch:true,loc:"RSI Pledge Store / Chairman's Club",how:'Com outros itens da linha.',price:0,desc:'Mochila Artimex com 4 slots.'},
    ],
  });

  addSet({ base_name:'Heartthrob', manufacturer:'RSI', type:'Special', category:'Event',
    description:'Armadura temática do evento Coramor — disponível apenas em fevereiro.',
    lore:'O amor é uma armadura.',
    tags:'["Special","Event","Coramor","Seasonal"]', version:'3.19', rarity:'Legendary',
    variants:['Red Heart','Rose Gold','Crimson'],
    pieces:[
      {type:'Helmet',rp:11,re:9,rd:6,rt:8,rb:5,rs:5,mob:5,slots:0,loot:false,purch:true,loc:'Loja de Evento Coramor — Fevereiro',how:'Exclusivo do evento Coramor anual em fevereiro.',price:0,desc:'Capacete temático Coramor.'},
      {type:'Torso',rp:14,re:11,rd:8,rt:10,rb:7,rs:7,mob:7,slots:3,loot:false,purch:true,loc:'Evento Coramor — Fevereiro',how:'Loja de evento durante fevereiro.',price:0,desc:'Torso Heartthrob com decorações Coramor.'},
      {type:'Arms',rp:9,re:8,rd:5,rt:6,rb:5,rs:5,mob:4,slots:1,loot:false,purch:true,loc:'Evento Coramor — Fevereiro',how:'Verifique o calendário de eventos RSI.',price:0,desc:'Braços com motivos Coramor.'},
      {type:'Legs',rp:9,re:8,rd:5,rt:6,rb:5,rs:5,mob:4,slots:1,loot:false,purch:true,loc:'Evento Coramor — Fevereiro',how:'Evento anual.',price:0,desc:'Perneiras Heartthrob.'},
    ],
  });

  addSet({ base_name:'AVS-E', manufacturer:'Clark Defense Systems', type:'Special', category:'EVA',
    description:'Traje de sobrevivência a vácuo blindado com capacidade de combate.',
    lore:'Nascido de pilotos que precisavam de proteção dentro e fora da cabine.',
    tags:'["Special","EVA","Space","Versatile"]', version:'3.9', rarity:'Common',
    variants:['Space White','Tactical Black','EVA Orange'],
    pieces:[
      {type:'Helmet',rp:10,re:8,rd:6,rt:7,rb:5,rs:4,mob:5,slots:0,purch:true,loot:false,loc:'ARC-L1 / Port Tressler / Baijini Point',how:'ARC-L1 Armor Store, Port Tressler e Baijini Point.',price:5500,desc:'Capacete EVA com vedação a vácuo.'},
      {type:'Torso',rp:12,re:10,rd:7,rt:9,rb:6,rs:5,mob:6,slots:3,purch:true,loot:false,loc:'Spaceports / Estações Orbitais',how:'Disponível em estações orbitais e spaceports.',price:7000,desc:'Torso com propulsores EVA e O2 de emergência.'},
      {type:'Arms',rp:8,re:6,rd:4,rt:5,rb:4,rs:3,mob:4,slots:1,purch:true,loot:false,loc:'Spaceports / Estações Orbitais',how:'Mesma distribuição.',price:4500,desc:'Braços com garras EVA retráteis.'},
      {type:'Legs',rp:8,re:6,rd:4,rt:5,rb:4,rs:3,mob:4,slots:1,purch:true,loot:false,loc:'Spaceports / Estações Orbitais',how:'Mesma distribuição.',price:4500,desc:'Perneiras EVA com magnetos de superfície.'},
    ],
  });

  return inserted > 0;
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('get-seed-names', () => {
  // Returns base names of all non-custom armor sets so renderer can record provenance
  const sets = queryAll('SELECT DISTINCT base_name FROM armor_sets WHERE is_custom=0');
  const bps  = queryAll('SELECT name FROM blueprints WHERE is_default=1');
  return {
    armorSets:  sets.map(s => s.base_name),
    blueprints: bps.map(b => b.name),
  };
});

ipcMain.handle('get-all-sets', () => {
  const sets = queryAll(`SELECT id,base_name,variant_name,manufacturer,type,category,description,lore,tags,added_version,rarity,is_custom FROM armor_sets ORDER BY is_custom,type,base_name,variant_name`);
  for (const s of sets) {
    s.pieces = queryAll(`SELECT ap.*,COALESCE(up.owned,0) AS owned,up.wishlist,up.notes,up.obtained_date,COALESCE(up.quantity,CASE WHEN up.owned=1 THEN 1 ELSE 0 END) AS quantity FROM armor_pieces ap LEFT JOIN user_pieces up ON ap.id=up.piece_id WHERE ap.set_id=? ORDER BY ap.piece_type`,[s.id]);
    s.set_name = s.variant_name==='Base' ? s.base_name : `${s.base_name} — ${s.variant_name}`;
  }
  return sets;
});

ipcMain.handle('toggle-piece', (event, pieceId) => {
  const cur = queryOne('SELECT owned FROM user_pieces WHERE piece_id=?',[pieceId]);
  const newOwned = (cur?.owned||0)?0:1;
  db.run('UPDATE user_pieces SET owned=?,quantity=?,obtained_date=? WHERE piece_id=?',[newOwned,newOwned?1:0,newOwned?new Date().toISOString():null,pieceId]);
  saveDb(); return {owned:newOwned};
});
ipcMain.handle('toggle-piece-wishlist', (event,pieceId) => {
  const cur = queryOne('SELECT wishlist FROM user_pieces WHERE piece_id=?',[pieceId]);
  const newW = (cur?.wishlist||0)?0:1;
  db.run('UPDATE user_pieces SET wishlist=? WHERE piece_id=?',[newW,pieceId]);
  saveDb(); return {wishlist:newW};
});
ipcMain.handle('update-piece-notes', (event,{pieceId,notes}) => {
  db.run('UPDATE user_pieces SET notes=? WHERE piece_id=?',[notes,pieceId]);
  saveDb(); return {success:true};
});
ipcMain.handle('update-piece-quantity', async (event, id, quantity) => {
  try {
    const pieceId = Number(id);
    const nextQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
    if (!Number.isInteger(pieceId) || pieceId <= 0) {
      return { success: false, message: 'Peça inválida.' };
    }
    const piece = queryOne('SELECT piece_id FROM user_pieces WHERE piece_id=?', [pieceId]);
    if (!piece) return { success: false, message: 'Peça não encontrada.' };
    db.run('UPDATE user_pieces SET quantity=?, owned=?, obtained_date=? WHERE piece_id=?', [nextQuantity, nextQuantity > 0 ? 1 : 0, nextQuantity > 0 ? new Date().toISOString() : null, pieceId]);
    saveDb();
    return { success: true, quantity: nextQuantity, owned: nextQuantity > 0 ? 1 : 0 };
  } catch(e) {
    return { success:false, message:e.message };
  }
});
ipcMain.handle('get-stats', () => {
  const totalSets   = queryOne('SELECT COUNT(*) as c FROM armor_sets').c;
  const totalPieces = queryOne('SELECT COUNT(*) as c FROM armor_pieces').c;
  const ownedPieces = queryOne('SELECT COUNT(*) as c FROM user_pieces WHERE owned=1').c;
  const wishlistPieces = queryOne('SELECT COUNT(*) as c FROM user_pieces WHERE wishlist=1').c;
  const byType = queryAll(`SELECT s.type,COUNT(DISTINCT s.id) as total_sets,COUNT(ap.id) as total_pieces,SUM(COALESCE(up.owned,0)) as owned_pieces FROM armor_sets s LEFT JOIN armor_pieces ap ON ap.set_id=s.id LEFT JOIN user_pieces up ON up.piece_id=ap.id GROUP BY s.type`);
  const completeSets = queryAll(`SELECT s.id FROM armor_sets s WHERE (SELECT COUNT(*) FROM armor_pieces WHERE set_id=s.id)>0 AND (SELECT COUNT(*) FROM armor_pieces ap JOIN user_pieces up ON up.piece_id=ap.id WHERE ap.set_id=s.id AND up.owned=1)=(SELECT COUNT(*) FROM armor_pieces WHERE set_id=s.id)`).length;
  return {totalSets,totalPieces,ownedPieces,wishlistPieces,byType,completeSets};
});
ipcMain.handle('create-custom-set', (event,{set,pieces}) => {
  const baseName = set.base_name || set.set_name;
  const variantName = set.variant_name || 'Base';
  const duplicate = queryOne('SELECT id FROM armor_sets WHERE lower(base_name)=lower(?) AND lower(variant_name)=lower(?) LIMIT 1',[baseName, variantName]);
  if (duplicate) return { success:false, duplicate:true, existingSetId:duplicate.id, error:'Esta armadura já está cadastrada.' };
  const setId = insertSet([baseName,variantName,set.manufacturer,set.type||'Medium',set.category||'Combat',set.description||'',set.lore||'',JSON.stringify(set.tags||[]),set.added_version||'4.0',set.rarity||'Common']);
  db.run('UPDATE armor_sets SET is_custom=1 WHERE id=?',[setId]);
  for(const p of (pieces||[])){insertPiece([setId,p.piece_type,p.piece_name||`${set.base_name} ${p.piece_type}`,+p.resistance_physical||0,+p.resistance_energy||0,+p.resistance_distortion||0,+p.resistance_thermal||0,+p.resistance_biochemical||0,+p.resistance_stun||0,+p.mobility_penalty||0,+p.slots||0,p.is_lootable?1:0,p.is_purchasable?1:0,p.buy_location||'',p.how_to_get||'',+p.price_auec||0,p.description||'']);}
  saveDb(); return {success:true,setId};
});
ipcMain.handle('update-custom-set', (event,{setId,set}) => {
  db.run(`UPDATE armor_sets SET base_name=?,variant_name=?,manufacturer=?,type=?,category=?,description=?,lore=?,tags=?,added_version=?,rarity=? WHERE id=?`,[set.base_name||set.set_name,set.variant_name||'Base',set.manufacturer,set.type,set.category,set.description||'',set.lore||'',JSON.stringify(set.tags||[]),set.added_version||'4.0',set.rarity||'Common',setId]);
  saveDb(); return {success:true};
});
ipcMain.handle('update-custom-piece', (event,{pieceId,piece}) => {
  db.run(`UPDATE armor_pieces SET piece_type=?,piece_name=?,resistance_physical=?,resistance_energy=?,resistance_distortion=?,resistance_thermal=?,resistance_biochemical=?,resistance_stun=?,mobility_penalty=?,slots=?,is_lootable=?,is_purchasable=?,buy_location=?,how_to_get=?,price_auec=?,description=? WHERE id=?`,[piece.piece_type,piece.piece_name,+piece.resistance_physical||0,+piece.resistance_energy||0,+piece.resistance_distortion||0,+piece.resistance_thermal||0,+piece.resistance_biochemical||0,+piece.resistance_stun||0,+piece.mobility_penalty||0,+piece.slots||0,piece.is_lootable?1:0,piece.is_purchasable?1:0,piece.buy_location||'',piece.how_to_get||'',+piece.price_auec||0,piece.description||'',pieceId]);
  saveDb(); return {success:true};
});
ipcMain.handle('add-piece-to-set', (event,{setId,piece}) => {
  insertPiece([setId,piece.piece_type,piece.piece_name||piece.piece_type,+piece.resistance_physical||0,+piece.resistance_energy||0,+piece.resistance_distortion||0,+piece.resistance_thermal||0,+piece.resistance_biochemical||0,+piece.resistance_stun||0,+piece.mobility_penalty||0,+piece.slots||0,piece.is_lootable?1:0,piece.is_purchasable?1:0,piece.buy_location||'',piece.how_to_get||'',+piece.price_auec||0,piece.description||'']);
  saveDb(); return {success:true};
});
ipcMain.handle('get-duplicate-custom-sets', () => {
  const rows = queryAll(`SELECT id,base_name,variant_name,manufacturer,type,category,is_custom FROM armor_sets WHERE is_custom=1 ORDER BY lower(base_name),lower(variant_name),id`);
  const groups = new Map();
  rows.forEach(row => { const key = normalizeArmorKey(row.base_name, row.variant_name); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); });
  return [...groups.entries()].filter(([, entries]) => entries.length > 1).map(([key, entries]) => ({ key, label:`${entries[0].base_name} · ${entries[0].variant_name || 'Base'}`, entries }));
});
ipcMain.handle('delete-custom-sets', (event, setIds) => {
  const ids = [...new Set((Array.isArray(setIds) ? setIds : []).map(Number).filter(Number.isInteger))];
  const deleted = [];
  ids.forEach(setId => {
    const s = queryOne('SELECT is_custom FROM armor_sets WHERE id=?',[setId]);
    if (!s?.is_custom) return;
    const pieces = queryAll('SELECT id FROM armor_pieces WHERE set_id=?',[setId]);
    pieces.forEach(p => db.run('DELETE FROM user_pieces WHERE piece_id=?',[p.id]));
    db.run('DELETE FROM armor_pieces WHERE set_id=?',[setId]);
    db.run('DELETE FROM armor_sets WHERE id=?',[setId]);
    deleted.push(setId);
  });
  saveDb(); return { success:true, deleted };
});
ipcMain.handle('delete-custom-set', (event,setId) => {
  const s = queryOne('SELECT is_custom FROM armor_sets WHERE id=?',[setId]);
  if(!s?.is_custom) return {success:false,error:'Cannot delete built-in set'};
  const pieces = queryAll('SELECT id FROM armor_pieces WHERE set_id=?',[setId]);
  for(const p of pieces) db.run('DELETE FROM user_pieces WHERE piece_id=?',[p.id]);
  db.run('DELETE FROM armor_pieces WHERE set_id=?',[setId]);
  db.run('DELETE FROM armor_sets WHERE id=?',[setId]);
  saveDb(); return {success:true};
});
ipcMain.handle('delete-custom-piece', (event,pieceId) => {
  db.run('DELETE FROM user_pieces WHERE piece_id=?',[pieceId]);
  db.run('DELETE FROM armor_pieces WHERE id=?',[pieceId]);
  saveDb(); return {success:true};
});

// ── Blueprint seed ───────────────────────────────────────────────────────────
function seedBlueprints() {
  const existingNames = new Set(
    queryAll('SELECT name FROM blueprints').map(r => r.name.toLowerCase())
  );
  let inserted = 0;

  function addBP(bp, ingredients) {
    if (existingNames.has(bp.name.toLowerCase())) return;
    db.run(`INSERT INTO blueprints (name,category,subcategory,manufacturer,item_size,grade,item_class,description,how_to_get,faction,mission_type,patch_added,is_default,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [bp.name, bp.category||'Weapon', bp.subcategory||'',
       bp.manufacturer||'', bp.item_size||'', bp.grade||'', bp.item_class||'',
       bp.desc||'', bp.how||'', bp.faction||'', bp.mission||'',
       bp.patch||'4.7', bp.is_default?1:0, bp.notes||'']);
    const bpId = queryOne('SELECT last_insert_rowid() as id').id;
    db.run('INSERT INTO user_blueprints (blueprint_id) VALUES (?)', [bpId]);
    for (const ing of (ingredients||[])) {
      db.run('INSERT INTO blueprint_ingredients (blueprint_id,material_name,quantity,quality_min,unit,notes) VALUES (?,?,?,?,?,?)',
        [bpId, ing.mat, ing.qty||1, ing.qmin||0, ing.unit||'un', ing.notes||'']);
    }
    existingNames.add(bp.name.toLowerCase());
    inserted++;
  }

  // ── FPS WEAPONS ────────────────────────────────────────────────────────────

  // Behring P4-AR (Assault Rifle)
  addBP({name:'P4-AR',category:'FPS Weapon',subcategory:'Assault Rifle',manufacturer:'Behring',
    item_size:'Personal',grade:'B',item_class:'Civilian',
    desc:'Assault rifle confiável da Behring. Blueprint padrão, disponível para todos os jogadores.',
    how:'Blueprint padrão — já disponível no Fabricador sem precisar farmar.',
    faction:'Starter',mission:'Default',patch:'4.7',is_default:1},
    [{mat:'Orotite',qty:15,qmin:100,unit:'un',notes:'Minério minado ou obtido por desmontagem'},
     {mat:'Titanium',qty:10,qmin:100,unit:'un',notes:'Minerado em luas rochosas'},
     {mat:'Polymer',qty:8,qmin:100,unit:'un',notes:'Obtido por desmontagem de itens plásticos'}]);

  // Behring P6LR (Sniper Rifle)
  addBP({name:'P6LR',category:'FPS Weapon',subcategory:'Rifle de Sniper',manufacturer:'Behring',
    item_size:'Personal',grade:'A',item_class:'Military',
    desc:'O sniper rifle mais cobiçado do jogo. Qualidade dos materiais impacta diretamente dano e alcance.',
    how:'Recompensa de missões FPS de alto nível. Foxwell Enforcement (contratos laranja/vermelho) e missões Bounty de elite. Taxa de drop baixa — requer persistência.',
    faction:'Foxwell / Bounty',mission:'FPS Combat / Bounty Hunt',patch:'4.7'},
    [{mat:'Titanium',qty:25,qmin:500,unit:'un',notes:'Alta qualidade aumenta dano. Minere em luas metálicas'},
     {mat:'Copper',qty:15,qmin:400,unit:'un',notes:'Componentes eletrônicos da mira'},
     {mat:'Orotite',qty:20,qmin:400,unit:'un',notes:'Estrutura do cano'},
     {mat:'Inert Material',qty:12,qmin:200,unit:'un',notes:'Enchimento e amortecimento'}]);

  // P8-AR (Moonfall Variant)
  addBP({name:'P8-AR (Moonfall)',category:'FPS Weapon',subcategory:'Assault Rifle',manufacturer:'Behring',
    item_size:'Personal',grade:'A',item_class:'Military',
    desc:'Variante militar do P8-AR com acabamento Moonfall. Melhor DPS que o P4-AR.',
    how:'Reputacao Rayari — missoes Jormundr Eye / Yor Mandi Eye. Requer reputacao Rayari de nivel intermediario. Missoes disponiveis em Pyro.',
    faction:'Rayari',mission:'Rayari Reputation Missions',patch:'4.7'},
    [{mat:'Orotite',qty:30,qmin:400,unit:'un',notes:'Material principal da estrutura'},
     {mat:'Titanium',qty:20,qmin:300,unit:'un',notes:'Componentes mecanicos'},
     {mat:'Caranite',qty:15,qmin:400,unit:'un',notes:'Revestimento especial Moonfall'},
     {mat:'Copper',qty:10,qmin:300,unit:'un',notes:'Fios e eletronicos'}]);

  // Klaus & Werner Demeco (SMG)
  addBP({name:'Demeco (SMG)',category:'FPS Weapon',subcategory:'SMG',manufacturer:'Klaus & Werner',
    item_size:'Personal',grade:'B',item_class:'Civilian',
    desc:'SMG compacta da Klaus & Werner. Excelente para combate em espacos fechados.',
    how:'Missoes de combate FPS — Foxwell Enforcement (contratos verdes/azuis). Uma das primeiras a ser farmada por novos jogadores.',
    faction:'Foxwell',mission:'FPS Combat',patch:'4.7'},
    [{mat:'Titanium',qty:12,qmin:200,unit:'un'},
     {mat:'Polymer',qty:10,qmin:200,unit:'un'},
     {mat:'Copper',qty:8,qmin:200,unit:'un'}]);

  // Kastak Arms S5 Combat SMG
  addBP({name:'S5 Combat SMG',category:'FPS Weapon',subcategory:'SMG',manufacturer:'Kastak Arms',
    item_size:'Personal',grade:'B',item_class:'Combat',
    desc:'SMG de combate da Kastak Arms. Fire rate elevado e boa precisao.',
    how:'Missoes Headhunters e contratos de combate em Stanton.',
    faction:'Headhunters',mission:'FPS Combat',patch:'4.7'},
    [{mat:'Titanium',qty:10,qmin:200,unit:'un'},
     {mat:'Orotite',qty:12,qmin:250,unit:'un'},
     {mat:'Polymer',qty:8,qmin:200,unit:'un'}]);

  // ADP Core (Pistol)
  addBP({name:'ADP Core Pistol',category:'FPS Weapon',subcategory:'Pistola',manufacturer:'Behring',
    item_size:'Personal',grade:'C',item_class:'Civilian',
    desc:'Pistola padrao Behring. Blueprint basico disponivel para todos.',
    how:'Blueprint padrao — disponivel sem farmar. Bom para iniciantes aprenderem o sistema.',
    faction:'Starter',mission:'Default',patch:'4.7',is_default:1},
    [{mat:'Orotite',qty:8,qmin:100,unit:'un'},
     {mat:'Polymer',qty:6,qmin:100,unit:'un'},
     {mat:'Copper',qty:4,qmin:100,unit:'un'}]);

  // Devastator 12 (Shotgun)
  addBP({name:'Devastator 12',category:'FPS Weapon',subcategory:'Shotgun',manufacturer:'Gemini',
    item_size:'Personal',grade:'A',item_class:'Military',
    desc:'Shotgun pesada da Gemini. Devastadora em combate proximo.',
    how:'Recompensa de missoes de alto nivel em Pyro — gangues criminosas e contratos de eliminacao.',
    faction:'Pyro Gangs',mission:'Elimination / Gang Contracts',patch:'4.7'},
    [{mat:'Steel',qty:20,qmin:400,unit:'un',notes:'Cano e estrutura'},
     {mat:'Titanium',qty:15,qmin:350,unit:'un'},
     {mat:'Polymer',qty:10,qmin:300,unit:'un'}]);

  // NN-15 Cannon (Ship weapon)
  addBP({name:'NN-15 Cannon',category:'Ship Weapon',subcategory:'Cannon',manufacturer:'Behring',
    item_size:'3',grade:'A',item_class:'Military',
    desc:'Cannon de nave tamanho 3. Excelente DPS para naves medias.',
    how:'Missoes Headhunters — reputacao intermediaria. Disponivel apos completar missoes suficientes para desbloquear contratos de elite.',
    faction:'Headhunters',mission:'Headhunters Reputation',patch:'4.8'},
    [{mat:'Titanium',qty:40,qmin:500,unit:'un',notes:'Estrutura do cano'},
     {mat:'Copper',qty:25,qmin:400,unit:'un',notes:'Bobinas eletromagneticas'},
     {mat:'Industrial Polymer',qty:20,qmin:300,unit:'un'},
     {mat:'Reactive Material',qty:15,qmin:400,unit:'un'}]);

  // Deadbolt Cannon
  addBP({name:'Deadbolt Cannon',category:'Ship Weapon',subcategory:'Cannon',manufacturer:'Behring',
    item_size:'3',grade:'A',item_class:'Military',
    desc:'Cannon militar tamanho 3 da Behring. Alta penetracao de escudos.',
    how:'InterSec Tactical Strike Groups — conteudo em grupo. Requer reputacao InterSec avancada.',
    faction:'InterSec',mission:'Tactical Strike Groups (Grupo)',patch:'4.8'},
    [{mat:'Titanium',qty:45,qmin:600,unit:'un'},
     {mat:'Tungsten',qty:30,qmin:500,unit:'un',notes:'Ponteiros de alta densidade'},
     {mat:'Copper',qty:20,qmin:400,unit:'un'},
     {mat:'Reactive Material',qty:18,qmin:500,unit:'un'}]);

  // ── AMMO ──────────────────────────────────────────────────────────────────

  addBP({name:'Munição .354 Rifle',category:'Ammo',subcategory:'Rifle Ammo',manufacturer:'Generic',
    item_size:'Personal',grade:'C',item_class:'Civilian',
    desc:'Municao padrao para rifles de assalto. Blueprint inicial disponivel para todos.',
    how:'Blueprint padrao — disponivel sem farmar.',
    faction:'Starter',mission:'Default',patch:'4.7',is_default:1},
    [{mat:'Inert Material',qty:20,qmin:100,unit:'un',notes:'Desmonte itens basicos de bunker'},
     {mat:'Copper',qty:5,qmin:100,unit:'un'}]);

  addBP({name:'Munição .200 SMG',category:'Ammo',subcategory:'SMG Ammo',manufacturer:'Generic',
    item_size:'Personal',grade:'C',item_class:'Civilian',
    desc:'Municao padrao para SMGs.',
    how:'Blueprint padrao — disponivel sem farmar.',
    faction:'Starter',mission:'Default',patch:'4.7',is_default:1},
    [{mat:'Inert Material',qty:15,qmin:100,unit:'un'},
     {mat:'Copper',qty:4,qmin:100,unit:'un'}]);

  addBP({name:'Munição .45 Pistol',category:'Ammo',subcategory:'Pistol Ammo',manufacturer:'Generic',
    item_size:'Personal',grade:'C',item_class:'Civilian',
    desc:'Municao padrao para pistolas.',
    how:'Blueprint padrao — disponivel sem farmar.',
    faction:'Starter',mission:'Default',patch:'4.7',is_default:1},
    [{mat:'Inert Material',qty:12,qmin:100,unit:'un'},
     {mat:'Copper',qty:3,qmin:100,unit:'un'}]);

  addBP({name:'Munição Shotgun 12ga',category:'Ammo',subcategory:'Shotgun Ammo',manufacturer:'Generic',
    item_size:'Personal',grade:'C',item_class:'Civilian',
    desc:'Municao padrao para shotguns.',
    how:'Blueprint padrao. Desmonte itens basicos para obter os materiais.',
    faction:'Starter',mission:'Default',patch:'4.7',is_default:1},
    [{mat:'Inert Material',qty:18,qmin:100,unit:'un'},
     {mat:'Polymer',qty:5,qmin:100,unit:'un'}]);

  addBP({name:'Sniper Ammo .600',category:'Ammo',subcategory:'Sniper Ammo',manufacturer:'Generic',
    item_size:'Personal',grade:'B',item_class:'Military',
    desc:'Municao de alta precisao para rifles de sniper.',
    how:'Missoes FPS de nivel medio. Requer algum progresso nas faccoes.',
    faction:'Foxwell',mission:'FPS Combat',patch:'4.7'},
    [{mat:'Orotite',qty:10,qmin:300,unit:'un',notes:'Projétil de alta densidade'},
     {mat:'Inert Material',qty:15,qmin:200,unit:'un'},
     {mat:'Copper',qty:6,qmin:200,unit:'un'}]);

  // ── CONSUMABLES ──────────────────────────────────────────────────────────

  addBP({name:'MedPen',category:'Consumable',subcategory:'Medical',manufacturer:'Reclamation & Salvage Inc.',
    item_size:'Personal',grade:'C',item_class:'Civilian',
    desc:'Caneta medica padrao. Essential para sobrevivencia em combate.',
    how:'Blueprint padrao — disponivel sem farmar. Use materiais de desmontagem de itens basicos.',
    faction:'Starter',mission:'Default',patch:'4.7',is_default:1},
    [{mat:'Inert Material',qty:10,qmin:100,unit:'un',notes:'Desmonte qualquer item basico de bunker'},
     {mat:'Medical Grade Polymer',qty:5,qmin:100,unit:'un'}]);

  addBP({name:'Oxypen',category:'Consumable',subcategory:'Medical',manufacturer:'Generic',
    item_size:'Personal',grade:'C',item_class:'Civilian',
    desc:'Caneta de oxigenio para emergencias em EVA ou ambientes sem ar.',
    how:'Blueprint padrao — disponivel sem farmar.',
    faction:'Starter',mission:'Default',patch:'4.7',is_default:1},
    [{mat:'Inert Material',qty:8,qmin:100,unit:'un'},
     {mat:'Medical Grade Polymer',qty:4,qmin:100,unit:'un'}]);

  addBP({name:'Stimpak',category:'Consumable',subcategory:'Medical',manufacturer:'Generic',
    item_size:'Personal',grade:'B',item_class:'Civilian',
    desc:'Estimulante de curta duracao. Aumenta velocidade de movimento e resistencia.',
    how:'Missoes de contrabando e operacoes em Pyro. Raridade moderada.',
    faction:'Pyro Factions',mission:'Smuggling / Delivery',patch:'4.7'},
    [{mat:'Medical Grade Polymer',qty:8,qmin:200,unit:'un'},
     {mat:'Inert Material',qty:6,qmin:200,unit:'un'},
     {mat:'Caranite',qty:3,qmin:300,unit:'un',notes:'Componente quimico ativo'}]);

  // ── FPS ARMOR ─────────────────────────────────────────────────────────────

  addBP({name:'ADP Core Helmet',category:'FPS Armor',subcategory:'Helmet',manufacturer:'Behring',
    item_size:'Personal',grade:'C',item_class:'Civilian',
    desc:'Capacete ADP basico da Behring. Blueprint inicial disponivel para todos.',
    how:'Blueprint padrao — disponivel sem farmar.',
    faction:'Starter',mission:'Default',patch:'4.7',is_default:1},
    [{mat:'Steel',qty:10,qmin:100,unit:'un'},
     {mat:'Polymer',qty:8,qmin:100,unit:'un'},
     {mat:'Industrial Polymer',qty:5,qmin:100,unit:'un'}]);

  addBP({name:'ADP Core Torso',category:'FPS Armor',subcategory:'Torso',manufacturer:'Behring',
    item_size:'Personal',grade:'C',item_class:'Civilian',
    desc:'Torso ADP basico da Behring. Blueprint inicial disponivel para todos.',
    how:'Blueprint padrao — disponivel sem farmar.',
    faction:'Starter',mission:'Default',patch:'4.7',is_default:1},
    [{mat:'Steel',qty:15,qmin:100,unit:'un'},
     {mat:'Polymer',qty:12,qmin:100,unit:'un'},
     {mat:'Industrial Polymer',qty:8,qmin:100,unit:'un'}]);

  addBP({name:'Moonfall Helmet',category:'FPS Armor',subcategory:'Helmet',manufacturer:'Behring',
    item_size:'Personal',grade:'A',item_class:'Military',
    desc:'Capacete variante Moonfall. Proteção superior e visual icônico.',
    how:'Reputacao Rayari — missoes Jormundr Eye e Yor Mandi Eye em Pyro. Uma das armaduras mais cobiçadas do jogo.',
    faction:'Rayari',mission:'Rayari Reputation',patch:'4.7'},
    [{mat:'Caranite',qty:25,qmin:500,unit:'un',notes:'Revestimento Moonfall especial'},
     {mat:'Orotite',qty:20,qmin:400,unit:'un'},
     {mat:'Steel',qty:15,qmin:300,unit:'un'},
     {mat:'Industrial Polymer',qty:12,qmin:300,unit:'un'}]);

  addBP({name:'Moonfall Torso',category:'FPS Armor',subcategory:'Torso',manufacturer:'Behring',
    item_size:'Personal',grade:'A',item_class:'Military',
    desc:'Torso variante Moonfall. Combina com o capacete para set completo.',
    how:'Reputacao Rayari — mesmo sistema do capacete. Farm as missoes em ordem.',
    faction:'Rayari',mission:'Rayari Reputation',patch:'4.7'},
    [{mat:'Caranite',qty:35,qmin:500,unit:'un'},
     {mat:'Orotite',qty:28,qmin:400,unit:'un'},
     {mat:'Steel',qty:20,qmin:300,unit:'un'},
     {mat:'Industrial Polymer',qty:18,qmin:300,unit:'un'}]);

  addBP({name:'Moonfall Arms',category:'FPS Armor',subcategory:'Arms',manufacturer:'Behring',
    item_size:'Personal',grade:'A',item_class:'Military',
    desc:'Bracos variante Moonfall.',
    how:'Reputacao Rayari.',
    faction:'Rayari',mission:'Rayari Reputation',patch:'4.7'},
    [{mat:'Caranite',qty:20,qmin:500,unit:'un'},
     {mat:'Orotite',qty:15,qmin:400,unit:'un'},
     {mat:'Steel',qty:12,qmin:300,unit:'un'},
     {mat:'Industrial Polymer',qty:10,qmin:300,unit:'un'}]);

  addBP({name:'Moonfall Legs',category:'FPS Armor',subcategory:'Legs',manufacturer:'Behring',
    item_size:'Personal',grade:'A',item_class:'Military',
    desc:'Pernas variante Moonfall.',
    how:'Reputacao Rayari.',
    faction:'Rayari',mission:'Rayari Reputation',patch:'4.7'},
    [{mat:'Caranite',qty:22,qmin:500,unit:'un'},
     {mat:'Orotite',qty:18,qmin:400,unit:'un'},
     {mat:'Steel',qty:14,qmin:300,unit:'un'},
     {mat:'Industrial Polymer',qty:12,qmin:300,unit:'un'}]);

  // ── SHIP COMPONENTS ───────────────────────────────────────────────────────

  addBP({name:'FR-66 Shield (Size 1)',category:'Ship Component',subcategory:'Shield Generator',manufacturer:'Behring',
    item_size:'1',grade:'A',item_class:'Military',
    desc:'Gerador de escudo militar tamanho 1 da Behring. Prioridade maxima para qualquer build.',
    how:'Foxwell Enforcement — contratos laranja (nivel intermediario). O blueprint mais acessivel e impactante do jogo.',
    faction:'Foxwell Enforcement',mission:'Foxwell Contracts (Orange tier)',patch:'4.8'},
    [{mat:'Titanium',qty:30,qmin:400,unit:'un',notes:'Componente principal'},
     {mat:'Copper',qty:20,qmin:300,unit:'un',notes:'Bobinas de campo'},
     {mat:'Industrial Polymer',qty:15,qmin:300,unit:'un'},
     {mat:'Reactive Material',qty:10,qmin:400,unit:'un'}]);

  addBP({name:'FR-76S Shield (Size 2)',category:'Ship Component',subcategory:'Shield Generator',manufacturer:'Behring',
    item_size:'2',grade:'A',item_class:'Military',
    desc:'Gerador de escudo militar tamanho 2. Para naves medias como Cutlass e Freelancer.',
    how:'Foxwell Enforcement — contratos de nivel avancado (vermelho). Requer reputacao Foxwell alta.',
    faction:'Foxwell Enforcement',mission:'Foxwell Contracts (Red tier)',patch:'4.8'},
    [{mat:'Titanium',qty:50,qmin:500,unit:'un'},
     {mat:'Copper',qty:35,qmin:400,unit:'un'},
     {mat:'Industrial Polymer',qty:25,qmin:350,unit:'un'},
     {mat:'Reactive Material',qty:18,qmin:450,unit:'un'}]);

  addBP({name:'QuadraCell Power Plant (Size 1)',category:'Ship Component',subcategory:'Power Plant',manufacturer:'Lightning Power Ltd.',
    item_size:'1',grade:'A',item_class:'Military',
    desc:'Planta de energia militar tamanho 1. Segunda prioridade apos o FR-66.',
    how:'Foxwell Enforcement — contratos laranja. Farm junto com o FR-66.',
    faction:'Foxwell Enforcement',mission:'Foxwell Contracts',patch:'4.8'},
    [{mat:'Caranite',qty:25,qmin:500,unit:'un',notes:'Celula de energia'},
     {mat:'Titanium',qty:20,qmin:400,unit:'un'},
     {mat:'Copper',qty:15,qmin:300,unit:'un'},
     {mat:'Industrial Polymer',qty:12,qmin:300,unit:'un'}]);

  addBP({name:'QuadraCell MT Power Plant (Size 2)',category:'Ship Component',subcategory:'Power Plant',manufacturer:'Lightning Power Ltd.',
    item_size:'2',grade:'A',item_class:'Military',
    desc:'Planta de energia militar tamanho 2. Essencial para naves medias.',
    how:'Foxwell Enforcement — contratos de nivel avancado. Farm apos desbloquear contratos laranja/vermelho.',
    faction:'Foxwell Enforcement',mission:'Foxwell Contracts (Advanced)',patch:'4.8'},
    [{mat:'Caranite',qty:40,qmin:500,unit:'un'},
     {mat:'Titanium',qty:32,qmin:450,unit:'un'},
     {mat:'Copper',qty:22,qmin:350,unit:'un'},
     {mat:'Industrial Polymer',qty:18,qmin:350,unit:'un'}]);

  addBP({name:'QuadraCell MX Power Plant (Size 3)',category:'Ship Component',subcategory:'Power Plant',manufacturer:'Lightning Power Ltd.',
    item_size:'3',grade:'A',item_class:'Military',
    desc:'Planta de energia militar tamanho 3. Para grandes naves. Conteudo em grupo.',
    how:'InterSec Tactical Strike Groups — requer grupo organizado. O blueprint mais dificil de obter desta categoria.',
    faction:'InterSec',mission:'Tactical Strike Groups (Grupo)',patch:'4.8'},
    [{mat:'Caranite',qty:70,qmin:600,unit:'un'},
     {mat:'Titanium',qty:55,qmin:550,unit:'un'},
     {mat:'Tungsten',qty:30,qmin:500,unit:'un',notes:'Material extra-denso para grande porte'},
     {mat:'Copper',qty:35,qmin:400,unit:'un'},
     {mat:'Industrial Polymer',qty:28,qmin:400,unit:'un'}]);

  addBP({name:'Avalanche Cooler (Size 1)',category:'Ship Component',subcategory:'Cooler',manufacturer:'Wen & Associates',
    item_size:'1',grade:'A',item_class:'Military',
    desc:'Cooler militar tamanho 1. Excelente para reduzir assinatura termica.',
    how:'Foxwell Enforcement — reputacao alta (contratos laranja avancados).',
    faction:'Foxwell Enforcement',mission:'Foxwell Contracts (High Rep)',patch:'4.8'},
    [{mat:'Titanium',qty:22,qmin:400,unit:'un'},
     {mat:'Caranite',qty:18,qmin:400,unit:'un',notes:'Material termoativo'},
     {mat:'Copper',qty:12,qmin:300,unit:'un'},
     {mat:'Industrial Polymer',qty:10,qmin:300,unit:'un'}]);

  addBP({name:'Blizzard Cooler (Size 2)',category:'Ship Component',subcategory:'Cooler',manufacturer:'Wen & Associates',
    item_size:'2',grade:'A',item_class:'Military',
    desc:'O melhor cooler tamanho 2 disponivel. Requer alta reputacao Foxwell.',
    how:'Foxwell Enforcement — contratos de nivel mais alto. Paciencia necessaria.',
    faction:'Foxwell Enforcement',mission:'Foxwell Contracts (Max Rep)',patch:'4.8'},
    [{mat:'Titanium',qty:38,qmin:500,unit:'un'},
     {mat:'Caranite',qty:30,qmin:500,unit:'un'},
     {mat:'Copper',qty:20,qmin:400,unit:'un'},
     {mat:'Industrial Polymer',qty:16,qmin:350,unit:'un'}]);

  addBP({name:'VaporBlock Cooler',category:'Ship Component',subcategory:'Cooler',manufacturer:'Wen & Associates',
    item_size:'1',grade:'B',item_class:'Military',
    desc:'Cooler alternativo. Mais facil de farmar que o Avalanche.',
    how:'Headhunters — missoes de reputacao intermediaria.',
    faction:'Headhunters',mission:'Headhunters Reputation',patch:'4.8'},
    [{mat:'Titanium',qty:18,qmin:300,unit:'un'},
     {mat:'Caranite',qty:12,qmin:300,unit:'un'},
     {mat:'Copper',qty:10,qmin:250,unit:'un'},
     {mat:'Industrial Polymer',qty:8,qmin:250,unit:'un'}]);

  addBP({name:'VK-00 Quantum Drive (Size 1)',category:'Ship Component',subcategory:'Quantum Drive',manufacturer:'Tao & Son',
    item_size:'1',grade:'A',item_class:'Military',
    desc:'Quantum Drive militar tamanho 1. Viagens mais rapidas — terceira prioridade.',
    how:'Covalex — missoes de reputacao. Muito util para reduzir tempo de grind.',
    faction:'Covalex',mission:'Covalex Reputation Missions',patch:'4.8'},
    [{mat:'Caranite',qty:20,qmin:400,unit:'un',notes:'Celula de quantum'},
     {mat:'Orotite',qty:15,qmin:350,unit:'un'},
     {mat:'Titanium',qty:18,qmin:350,unit:'un'},
     {mat:'Copper',qty:12,qmin:300,unit:'un'}]);

  addBP({name:'XL-1 Quantum Drive (Size 2)',category:'Ship Component',subcategory:'Quantum Drive',manufacturer:'Tao & Son',
    item_size:'2',grade:'A',item_class:'Military',
    desc:'Quantum Drive militar tamanho 2. Para naves medias — faz o patch parecer menos lento.',
    how:'Covalex — reputacao avancada. Farm junto com o VK-00.',
    faction:'Covalex',mission:'Covalex Reputation (Advanced)',patch:'4.8'},
    [{mat:'Caranite',qty:35,qmin:500,unit:'un'},
     {mat:'Orotite',qty:28,qmin:450,unit:'un'},
     {mat:'Titanium',qty:30,qmin:450,unit:'un'},
     {mat:'Copper',qty:20,qmin:350,unit:'un'}]);

  addBP({name:'TS-2 Quantum Drive (Size 2)',category:'Ship Component',subcategory:'Quantum Drive',manufacturer:'Tao & Son',
    item_size:'2',grade:'A',item_class:'Military',
    desc:'Quantum Drive militar alternativo tamanho 2. Excelente velocidade.',
    how:'Covalex — missoes de reputacao de nivel alto.',
    faction:'Covalex',mission:'Covalex Reputation (High)',patch:'4.8'},
    [{mat:'Caranite',qty:38,qmin:500,unit:'un'},
     {mat:'Orotite',qty:30,qmin:450,unit:'un'},
     {mat:'Titanium',qty:32,qmin:450,unit:'un'},
     {mat:'Copper',qty:22,qmin:350,unit:'un'}]);

  addBP({name:'Slipstream Power Plant',category:'Ship Component',subcategory:'Power Plant',manufacturer:'Wen & Associates',
    item_size:'1',grade:'A',item_class:'Military',
    desc:'Planta de energia alternativa. Opcao para quem nao consegue Foxwell.',
    how:'Mile Eckhart — missoes de reputacao em Stanton.',
    faction:'Mile Eckhart',mission:'Mile Eckhart Reputation',patch:'4.8'},
    [{mat:'Caranite',qty:22,qmin:400,unit:'un'},
     {mat:'Titanium',qty:18,qmin:400,unit:'un'},
     {mat:'Copper',qty:14,qmin:300,unit:'un'},
     {mat:'Industrial Polymer',qty:10,qmin:300,unit:'un'}]);

  addBP({name:'Eclipse Power Plant (Stealth)',category:'Ship Component',subcategory:'Power Plant',manufacturer:'Lightning Power Ltd.',
    item_size:'2',grade:'A',item_class:'Stealth',
    desc:'Planta de energia stealth tamanho 2. Para builds de furtividade e contrabando.',
    how:'Ling Family — missoes de reputacao. Excelente para contrabandistas e smugglers.',
    faction:'Ling Family',mission:'Ling Family Reputation',patch:'4.8'},
    [{mat:'Caranite',qty:35,qmin:500,unit:'un',notes:'Componente low-emission'},
     {mat:'Titanium',qty:25,qmin:400,unit:'un'},
     {mat:'Copper',qty:18,qmin:350,unit:'un'},
     {mat:'Industrial Polymer',qty:15,qmin:350,unit:'un'}]);

  addBP({name:'Spectral Quantum Drive (Stealth)',category:'Ship Component',subcategory:'Quantum Drive',manufacturer:'Tao & Son',
    item_size:'2',grade:'A',item_class:'Stealth',
    desc:'Quantum Drive stealth tamanho 2. Para naves de baixa assinatura.',
    how:'Ling Family — missoes de reputacao avancada.',
    faction:'Ling Family',mission:'Ling Family Reputation (Advanced)',patch:'4.8'},
    [{mat:'Caranite',qty:32,qmin:500,unit:'un'},
     {mat:'Orotite',qty:25,qmin:450,unit:'un'},
     {mat:'Titanium',qty:28,qmin:450,unit:'un'},
     {mat:'Copper',qty:18,qmin:350,unit:'un'}]);

  addBP({name:'Zephyr Cooler (Stealth)',category:'Ship Component',subcategory:'Cooler',manufacturer:'Wen & Associates',
    item_size:'1',grade:'A',item_class:'Stealth',
    desc:'Cooler stealth tamanho 1. Reduz assinatura termica ao minimo.',
    how:'Ling Family — missoes de reputacao.',
    faction:'Ling Family',mission:'Ling Family Reputation',patch:'4.8'},
    [{mat:'Caranite',qty:20,qmin:500,unit:'un'},
     {mat:'Titanium',qty:16,qmin:400,unit:'un'},
     {mat:'Copper',qty:10,qmin:350,unit:'un'},
     {mat:'Industrial Polymer',qty:8,qmin:300,unit:'un'}]);

  addBP({name:'V8-1-12 Radar',category:'Ship Component',subcategory:'Radar',manufacturer:'Compass',
    item_size:'1',grade:'A',item_class:'Military',
    desc:'Radar militar tamanho 1. Detecta alvos a distancias muito maiores.',
    how:'Headhunters — missoes de reputacao intermediaria.',
    faction:'Headhunters',mission:'Headhunters Reputation',patch:'4.8'},
    [{mat:'Copper',qty:25,qmin:400,unit:'un',notes:'Antenas e processadores'},
     {mat:'Titanium',qty:15,qmin:350,unit:'un'},
     {mat:'Caranite',qty:12,qmin:400,unit:'un'},
     {mat:'Industrial Polymer',qty:10,qmin:300,unit:'un'}]);

  addBP({name:'NDB-30 Radar',category:'Ship Component',subcategory:'Radar',manufacturer:'Compass',
    item_size:'2',grade:'A',item_class:'Military',
    desc:'Radar militar tamanho 2 para naves medias/grandes.',
    how:'Foxwell Enforcement — contratos avancados.',
    faction:'Foxwell Enforcement',mission:'Foxwell Contracts (Advanced)',patch:'4.8'},
    [{mat:'Copper',qty:40,qmin:400,unit:'un'},
     {mat:'Titanium',qty:25,qmin:350,unit:'un'},
     {mat:'Caranite',qty:20,qmin:400,unit:'un'},
     {mat:'Industrial Polymer',qty:16,qmin:300,unit:'un'}]);

  // ── MINING LASER ─────────────────────────────────────────────────────────

  addBP({name:'Helix Mining Laser',category:'Ship Component',subcategory:'Mining Laser',manufacturer:'Shubin Interstellar',
    item_size:'2',grade:'A',item_class:'Industrial',
    desc:'Laser de mineracao Helix. Essencial para mineradores serios. Requer reputacao Shubin.',
    how:'Shubin Interstellar — reputacao de nivel intermediario a alto. Se voce minera, esta e prioridade.',
    faction:'Shubin Interstellar',mission:'Shubin Reputation Missions',patch:'4.8'},
    [{mat:'Titanium',qty:45,qmin:500,unit:'un',notes:'Estrutura do laser'},
     {mat:'Caranite',qty:30,qmin:500,unit:'un',notes:'Cristais de foco'},
     {mat:'Copper',qty:25,qmin:400,unit:'un',notes:'Bobinas de potencia'},
     {mat:'Industrial Polymer',qty:20,qmin:400,unit:'un'}]);

  return inserted > 0;
}

// ── Catálogo padrão SCMDB ──────────────────────────────────────────────────────
function inferScmdbSeedCategory(entry) {
  const text = `${entry?.tag || ''} ${entry?.productName || ''} ${entry?.type || ''} ${entry?.gear || ''}`.toLowerCase();
  if (entry?.type === 'armour' || /armor|armour|helmet|backpack|undersuit|flight.?suit/.test(text)) return 'FPS Armor';
  if (entry?.type === 'ammo' || /magazine|battery|ammo|munition/.test(text)) return 'Ammo';
  if (entry?.gear === 'shipcomponents' || /cooler|powerplant|power_plant|shield|thruster|quantum|radar|avionics|component|mininglaser/.test(text)) return 'Ship Component';
  if (/laser|ballistic|cannon|gatling|repeater|scattergun|massdriver|tachyon|weapon|rifle|pistol|smg|shotgun/.test(text)) return 'FPS Weapon';
  if (/consumable|medpen|food|drink/.test(text)) return 'Consumable';
  return 'Outro';
}

function inferScmdbSeedSize(entry) {
  const text = `${entry?.tag || ''} ${entry?.productName || ''}`;
  const match = text.match(/(?:^|[_\\s])S([1-9])(?:$|[_\\s])/i) || text.match(/size\\s*([1-9])/i);
  return match ? match[1] : 'Personal';
}

function buildScmdbIngredients(entry) {
  return (entry?.materials || []).map(material => {
    const isResource = material.inputType === 'resource';
    const quantity = Number(material.quantityExact);
    if (!material.name || !Number.isFinite(quantity) || quantity <= 0) return null;
    return {
      material_name: material.name,
      quantity,
      quality_min: 0,
      unit: isResource ? String(material.quantityUnit || 'SCU') : 'un',
      notes: `SCMDB · ${isResource ? 'resource' : 'item'} · slot: ${material.slot || '—'}`,
    };
  }).filter(Boolean);
}

function findScmdbCatalogEntry({ tag = '', name = '' } = {}) {
  const tagKey = String(tag || '').trim().toLowerCase();
  const nameKey = String(name || '').trim().toLowerCase();
  return (SCMDB_CATALOG.blueprints || []).find(entry => {
    const entryTag = String(entry?.tag || '').trim().toLowerCase();
    const entryName = String(entry?.productName || '').trim().toLowerCase();
    return (tagKey && entryTag === tagKey) || (!tagKey && nameKey && entryName === nameKey);
  }) || null;
}

function normalizeBlueprintIngredients(ingredients) {
  return (Array.isArray(ingredients) ? ingredients : []).map(ingredient => {
    const materialName = String(ingredient?.material_name || ingredient?.material || ingredient?.name || '').trim();
    const quantity = Number(ingredient?.quantity ?? ingredient?.amount ?? 0);
    if (!materialName || !Number.isFinite(quantity) || quantity <= 0) return null;
    return {
      material_name: materialName,
      quantity,
      unit: String(ingredient?.unit || 'un'),
      notes: String(ingredient?.notes || ''),
    };
  }).filter(Boolean);
}

function replaceBlueprintIngredients(bpId, ingredients) {
  db.run('DELETE FROM blueprint_ingredients WHERE blueprint_id=?', [bpId]);
  for (const ingredient of ingredients) {
    db.run('INSERT INTO blueprint_ingredients (blueprint_id,material_name,quantity,quality_min,unit,notes) VALUES (?,?,?,?,?,?)',
      [bpId, ingredient.material_name, ingredient.quantity, 0, ingredient.unit, ingredient.notes || '']);
  }
}

function ensureBlueprintUserState(bpId) {
  db.run('INSERT OR IGNORE INTO user_blueprints (blueprint_id,owned,wishlist,crafted_count,notes,obtained_date) VALUES (?,0,0,0,?,NULL)', [bpId, '']);
}

function seedScmdbBlueprints() {
  const catalogVersion = String(SCMDB_CATALOG.sourceVersion || 'unknown');
  const catalogEntries = Array.isArray(SCMDB_CATALOG.blueprints) ? SCMDB_CATALOG.blueprints : [];
  if (!catalogEntries.length) return false;
  const deletedKeys = new Set(queryAll("SELECT catalog_key FROM scmdb_catalog_state WHERE catalog_key LIKE 'deleted:%'").map(row => String(row.catalog_key).slice(8).toLowerCase()));
  const seededMaterialKeys = new Set(queryAll("SELECT catalog_key FROM scmdb_catalog_state WHERE catalog_key LIKE 'materials:%'").map(row => String(row.catalog_key).slice(9).toLowerCase()));
  const existingRows = queryAll('SELECT * FROM blueprints ORDER BY is_default DESC, id ASC');
  const existingByName = new Map();
  const existingByTag = new Map();
  existingRows.forEach(row => {
    const nameKey = String(row.name || '').toLowerCase();
    const tagKey = String(row.scmdb_tag || '').toLowerCase();
    if (nameKey && !existingByName.has(nameKey)) existingByName.set(nameKey, row);
    if (tagKey && !existingByTag.has(tagKey)) existingByTag.set(tagKey, row);
  });
  let changed = false;

  for (const entry of catalogEntries) {
    const name = String(entry.productName || '').trim();
    const tag = String(entry.tag || '').trim();
    if (!name || !tag || deletedKeys.has(tag.toLowerCase())) continue;
    const nameKey = name.toLowerCase();
    const tagKey = tag.toLowerCase();
    const byTag = existingByTag.get(tagKey) || null;
    const byName = existingByName.get(nameKey) || null;
    const ingredients = buildScmdbIngredients(entry);
    const fields = [
      name, inferScmdbSeedCategory(entry), entry.subtype || entry.type || entry.gear || 'SCMDB',
      entry.manufacturer || '', inferScmdbSeedSize(entry), '', entry.type || '',
      `Blueprint padrão do catálogo SCMDB ${catalogVersion}.`,
      'Catálogo SCMDB — Fabricator', '', entry.subtype || '', catalogVersion,
      1, `SCMDB ${catalogVersion} · GUID: ${entry.guid || '—'}`, 'SCMDB', tag,
      'https://scmdb.net/?page=fab',
    ];

    if (byTag) {
      // Registros SCMDB existentes são preservados para respeitar edições do usuário.
      // Apenas versões antigas padrão sem ingredientes recebem o seed uma vez.
      const ingredientCount = queryOne('SELECT COUNT(*) as c FROM blueprint_ingredients WHERE blueprint_id=?', [byTag.id])?.c || 0;
      if (byTag.is_default === 1 && ingredientCount === 0 && !seededMaterialKeys.has(tagKey) && ingredients.length) {
        replaceBlueprintIngredients(byTag.id, ingredients);
        db.run('INSERT OR REPLACE INTO scmdb_catalog_state (catalog_key,catalog_version,installed_at) VALUES (?,?,?)', [`materials:${tagKey}`, catalogVersion, new Date().toISOString()]);
        seededMaterialKeys.add(tagKey);
        changed = true;
      }
      ensureBlueprintUserState(byTag.id);
      continue;
    }

    if (byName && byName.is_default === 1 && !byName.source && !byName.scmdb_tag) {
      // Converte um seed antigo homônimo para o registro oficial SCMDB, preservando a posse.
      db.run(`UPDATE blueprints SET name=?,category=?,subcategory=?,manufacturer=?,item_size=?,grade=?,item_class=?,description=?,how_to_get=?,faction=?,mission_type=?,patch_added=?,is_default=?,notes=?,source=?,scmdb_tag=?,scmdb_url=? WHERE id=?`, [...fields, byName.id]);
      replaceBlueprintIngredients(byName.id, ingredients);
      ensureBlueprintUserState(byName.id);
      const updatedRow = queryOne('SELECT * FROM blueprints WHERE id=?', [byName.id]);
      existingByName.set(nameKey, updatedRow);
      existingByTag.set(tagKey, updatedRow);
      db.run('INSERT OR REPLACE INTO scmdb_catalog_state (catalog_key,catalog_version,installed_at) VALUES (?,?,?)', [`materials:${tagKey}`, catalogVersion, new Date().toISOString()]);
      seededMaterialKeys.add(tagKey);
      changed = true;
      continue;
    }

    if (byName) {
      // Uma blueprint manual com o mesmo nome tem precedência e não é sobrescrita.
      continue;
    }

    db.run(`INSERT INTO blueprints (name,category,subcategory,manufacturer,item_size,grade,item_class,description,how_to_get,faction,mission_type,patch_added,is_default,notes,source,scmdb_tag,scmdb_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, fields);
    const bpId = queryOne('SELECT last_insert_rowid() as id').id;
    ensureBlueprintUserState(bpId);
    replaceBlueprintIngredients(bpId, ingredients);
    const insertedRow = queryOne('SELECT * FROM blueprints WHERE id=?', [bpId]);
    existingByName.set(nameKey, insertedRow);
    existingByTag.set(tagKey, insertedRow);
    db.run('INSERT OR REPLACE INTO scmdb_catalog_state (catalog_key,catalog_version,installed_at) VALUES (?,?,?)', [`materials:${tagKey}`, catalogVersion, new Date().toISOString()]);
    seededMaterialKeys.add(tagKey);
    changed = true;
  }

  const state = queryOne('SELECT catalog_version FROM scmdb_catalog_state WHERE catalog_key=?', ['catalog']);
  if (!state || state.catalog_version !== catalogVersion) {
    db.run('INSERT OR REPLACE INTO scmdb_catalog_state (catalog_key,catalog_version,installed_at) VALUES (?,?,?)', ['catalog', catalogVersion, new Date().toISOString()]);
    changed = true;
  }
  return changed;
}

function migrateScmdbFractionalUnits() {
  const migrationKey = 'units:fractional-cscu-v1';
  if (queryOne('SELECT catalog_key FROM scmdb_catalog_state WHERE catalog_key=?', [migrationKey])) return false;
  let changed = false;
  const rows = queryAll(`
    SELECT bi.id, bi.quantity, bi.unit
    FROM blueprint_ingredients bi
    JOIN blueprints b ON b.id = bi.blueprint_id
    WHERE (b.source='SCMDB' OR b.scmdb_tag IS NOT NULL AND b.scmdb_tag<>'') AND lower(bi.unit)='scu'
  `);
  for (const row of rows) {
    const quantity = Number(row.quantity);
    if (!Number.isFinite(quantity) || Number.isInteger(quantity)) continue;
    db.run('UPDATE blueprint_ingredients SET quantity=?,unit=? WHERE id=?', [quantity * 100, 'cSCU', row.id]);
    changed = true;
  }
  db.run('INSERT OR REPLACE INTO scmdb_catalog_state (catalog_key,catalog_version,installed_at) VALUES (?,?,?)', [migrationKey, String(SCMDB_CATALOG.sourceVersion || 'unknown'), new Date().toISOString()]);
  return changed || rows.length > 0;
}

// ── Blueprint IPC ─────────────────────────────────────────────────────────────
ipcMain.handle('bp-get-all', () => {
  const bps = queryAll(`
    SELECT b.*, ub.owned, ub.wishlist, ub.crafted_count, ub.notes as user_notes, ub.obtained_date
    FROM blueprints b LEFT JOIN user_blueprints ub ON b.id = ub.blueprint_id
    ORDER BY b.category, b.name
  `);
  for (const bp of bps) {
    bp.ingredients = queryAll('SELECT * FROM blueprint_ingredients WHERE blueprint_id=? ORDER BY id', [bp.id]);
  }
  return bps;
});

ipcMain.handle('bp-toggle-owned', (event, bpId) => {
  const cur = queryOne('SELECT owned FROM user_blueprints WHERE blueprint_id=?', [bpId]);
  const newOwned = (cur?.owned||0) ? 0 : 1;
  const date = newOwned ? new Date().toISOString() : null;
  db.run('UPDATE user_blueprints SET owned=?, obtained_date=? WHERE blueprint_id=?', [newOwned, date, bpId]);
  saveDb(); return { owned: newOwned };
});

ipcMain.handle('bp-toggle-wishlist', (event, bpId) => {
  const cur = queryOne('SELECT wishlist FROM user_blueprints WHERE blueprint_id=?', [bpId]);
  const newW = (cur?.wishlist||0) ? 0 : 1;
  db.run('UPDATE user_blueprints SET wishlist=? WHERE blueprint_id=?', [newW, bpId]);
  saveDb(); return { wishlist: newW };
});

ipcMain.handle('bp-increment-crafted', (event, bpId) => {
  db.run('UPDATE user_blueprints SET crafted_count=crafted_count+1 WHERE blueprint_id=?', [bpId]);
  saveDb(); return { success: true };
});

ipcMain.handle('bp-update-notes', (event, { bpId, notes }) => {
  db.run('UPDATE user_blueprints SET notes=? WHERE blueprint_id=?', [notes, bpId]);
  saveDb(); return { success: true };
});

ipcMain.handle('bp-create-custom', (event, { bp, ingredients }) => {
  db.run(`INSERT INTO blueprints (name,category,subcategory,manufacturer,item_size,grade,item_class,description,how_to_get,faction,mission_type,patch_added,is_default,notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?)`,
    [bp.name, bp.category||'Other', bp.subcategory||'', bp.manufacturer||'',
     bp.item_size||'', bp.grade||'', bp.item_class||'',
     bp.description||'', bp.how_to_get||'', bp.faction||'', bp.mission_type||'',
     bp.patch_added||'4.7', bp.notes||'']);
  const bpId = queryOne('SELECT last_insert_rowid() as id').id;
  db.run('INSERT INTO user_blueprints (blueprint_id) VALUES (?)', [bpId]);
  for (const ing of (ingredients||[])) {
    db.run('INSERT INTO blueprint_ingredients (blueprint_id,material_name,quantity,quality_min,unit,notes) VALUES (?,?,?,?,?,?)',
      [bpId, ing.material_name, ing.quantity||1, ing.quality_min||0, ing.unit||'un', ing.notes||'']);
  }
  saveDb(); return { success: true, bpId };
});

ipcMain.handle('bp-update-custom', (event, { bpId, bp, ingredients }) => {
  db.run(`UPDATE blueprints SET name=?,category=?,subcategory=?,manufacturer=?,
    item_size=?,grade=?,item_class=?,description=?,how_to_get=?,faction=?,mission_type=?,patch_added=?
    WHERE id=?`,
    [bp.name, bp.category||'Other', bp.subcategory||'', bp.manufacturer||'',
     bp.item_size||'', bp.grade||'', bp.item_class||'',
     bp.description||'', bp.how_to_get||'', bp.faction||'', bp.mission_type||'',
     bp.patch_added||'4.7', bpId]);
  // Remove old ingredients and re-insert
  db.run('DELETE FROM blueprint_ingredients WHERE blueprint_id=?', [bpId]);
  for (const ing of (ingredients||[])) {
    db.run('INSERT INTO blueprint_ingredients (blueprint_id,material_name,quantity,quality_min,unit,notes) VALUES (?,?,?,?,?,?)',
      [bpId, ing.material_name, ing.quantity||1, ing.quality_min||0, ing.unit||'un', ing.notes||'']);
  }
  saveDb();
  return { success: true };
});

ipcMain.handle('bp-delete-custom', (event, bpId) => {
  const bp = queryOne('SELECT id,is_default,source,scmdb_tag FROM blueprints WHERE id=?', [bpId]);
  const isScmdb = bp?.source === 'SCMDB' || Boolean(bp?.scmdb_tag);
  if (!bp || (bp.is_default && !isScmdb)) return { success: false, error: 'Cannot delete protected default blueprint' };
  db.run('DELETE FROM user_blueprints WHERE blueprint_id=?', [bpId]);
  db.run('DELETE FROM blueprint_ingredients WHERE blueprint_id=?', [bpId]);
  db.run('DELETE FROM blueprints WHERE id=?', [bpId]);
  if (isScmdb && bp.scmdb_tag) {
    db.run('INSERT OR REPLACE INTO scmdb_catalog_state (catalog_key,catalog_version,installed_at) VALUES (?,?,?)', [`deleted:${String(bp.scmdb_tag).toLowerCase()}`, String(SCMDB_CATALOG.sourceVersion || 'unknown'), new Date().toISOString()]);
  }
  saveDb(); return { success: true };
});

ipcMain.handle('bp-import-scmdb', (event, list) => {
  let imported = 0, updated = 0, enriched = 0, skipped = 0;
  for (const item of (list || [])) {
    const name = String(item?.name || '').trim();
    const tag = String(item?.scmdb_tag || '').trim();
    if (!name) { skipped++; continue; }
    const existingByTag = tag ? queryOne('SELECT * FROM blueprints WHERE lower(scmdb_tag)=? LIMIT 1', [tag.toLowerCase()]) : null;
    const existing = existingByTag || queryOne('SELECT * FROM blueprints WHERE lower(name)=? ORDER BY is_default DESC, id ASC LIMIT 1', [name.toLowerCase()]);
    const catalogEntry = findScmdbCatalogEntry({ tag, name });
    const catalogIngredients = catalogEntry ? buildScmdbIngredients(catalogEntry) : [];
    const currentIngredients = existing ? queryAll('SELECT material_name,quantity,unit,notes FROM blueprint_ingredients WHERE blueprint_id=? ORDER BY id', [existing.id]) : [];

    if (existing) {
      // O backup não deve apagar materiais já cadastrados pelo usuário.
      // Quando a blueprint existe no catálogo e está sem materiais, completamos automaticamente.
      if (catalogIngredients.length && currentIngredients.length === 0) {
        replaceBlueprintIngredients(existing.id, catalogIngredients);
        enriched++;
      } else {
        skipped++;
      }
      restoreBlueprintUserState(existing.id, item.userState || {});
      continue;
    }

    const ingredients = catalogIngredients.length ? catalogIngredients : normalizeBlueprintIngredients(item.ingredients);
    const isKnownCatalogBlueprint = Boolean(catalogEntry);
    db.run(`INSERT INTO blueprints (name,category,subcategory,manufacturer,item_size,grade,item_class,description,how_to_get,faction,mission_type,patch_added,is_default,notes,source,scmdb_tag,scmdb_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      name, item.category|| (catalogEntry ? inferScmdbSeedCategory(catalogEntry) : 'Outro'),
      item.subcategory|| (catalogEntry?.subtype || 'SCMDB'), item.manufacturer||catalogEntry?.manufacturer||'',
      item.item_size|| (catalogEntry ? inferScmdbSeedSize(catalogEntry) : 'Personal'), item.grade||'',
      item.item_class||catalogEntry?.type||'', item.description||'', item.how_to_get||'Importada do backup SCMDB',
      item.faction||'', item.mission_type||catalogEntry?.subtype||'', item.patch_added||SCMDB_CATALOG.sourceVersion||'SCMDB',
      isKnownCatalogBlueprint ? 1 : 0, item.notes||`SCMDB · ${SCMDB_CATALOG.sourceVersion || 'catálogo'}`, 'SCMDB', tag, item.scmdb_url||'https://scmdb.net/?page=fab',
    ]);
    const bpId = queryOne('SELECT last_insert_rowid() as id').id;
    replaceBlueprintIngredients(bpId, ingredients);
    restoreBlueprintUserState(bpId, item.userState || {});
    imported++;
  }
  saveDb();
  return { success: true, imported, updated, enriched, skipped };
});

ipcMain.handle('bp-get-stats', () => {
  const total = queryOne('SELECT COUNT(*) as c FROM blueprints').c;
  const owned = queryOne('SELECT COUNT(*) as c FROM user_blueprints WHERE owned=1').c;
  const wishlist = queryOne('SELECT COUNT(*) as c FROM user_blueprints WHERE wishlist=1').c;
  const totalCrafted = queryOne('SELECT SUM(crafted_count) as s FROM user_blueprints').s || 0;
  const byCat = queryAll(`
    SELECT b.category, COUNT(*) as total, SUM(COALESCE(ub.owned,0)) as owned
    FROM blueprints b LEFT JOIN user_blueprints ub ON b.id=ub.blueprint_id
    GROUP BY b.category ORDER BY total DESC`);
  return { total, owned, wishlist, totalCrafted, byCat };
});
// ── Backup / Restauração de Blueprints ─────────────────────────────────────────
// Exporta blueprints manuais e também o catálogo SCMDB para que materiais e
// estado do usuário possam ser restaurados em uma instalação limpa.
ipcMain.handle('bp-export-custom', () => {
  const bps = queryAll("SELECT * FROM blueprints WHERE is_default=0 OR source='SCMDB' ORDER BY name");
  return bps.map(bp => {
    const ingredients = queryAll('SELECT material_name,quantity,quality_min,unit,notes FROM blueprint_ingredients WHERE blueprint_id=? ORDER BY id', [bp.id]);
    const userState = queryOne('SELECT owned,wishlist,crafted_count,notes as user_notes,obtained_date FROM user_blueprints WHERE blueprint_id=?', [bp.id]);
    return {
      name: bp.name, category: bp.category, subcategory: bp.subcategory,
      manufacturer: bp.manufacturer, item_size: bp.item_size, grade: bp.grade,
      item_class: bp.item_class, description: bp.description, how_to_get: bp.how_to_get,
      faction: bp.faction, mission_type: bp.mission_type, patch_added: bp.patch_added,
      notes: bp.notes, source: bp.source || '', scmdb_tag: bp.scmdb_tag || '', scmdb_url: bp.scmdb_url || '',
      ingredients, userState: userState || {},
    };
  });
});

function restoreBlueprintUserState(bpId, userState = {}) {
  ensureBlueprintUserState(bpId);
  db.run(`UPDATE user_blueprints SET owned=?,wishlist=?,crafted_count=?,notes=?,obtained_date=? WHERE blueprint_id=?`, [
    userState.owned ? 1 : 0,
    userState.wishlist ? 1 : 0,
    Math.max(0, Number(userState.crafted_count) || 0),
    String(userState.user_notes || userState.notes || ''),
    userState.obtained_date || null,
    bpId,
  ]);
}

ipcMain.handle('bp-import-custom', (event, list) => {
  let imported = 0, updated = 0, skipped = 0;
  for (const item of (list || [])) {
    const name = String(item?.name || '').trim();
    const tag = String(item?.scmdb_tag || '').trim();
    if (!name) { skipped++; continue; }
    const existingByTag = tag ? queryOne('SELECT * FROM blueprints WHERE lower(scmdb_tag)=? LIMIT 1', [tag.toLowerCase()]) : null;
    const existing = existingByTag || queryOne('SELECT * FROM blueprints WHERE lower(name)=? ORDER BY is_default DESC, id ASC LIMIT 1', [name.toLowerCase()]);
    const ingredients = normalizeBlueprintIngredients(item.ingredients);

    if (existing) {
      replaceBlueprintIngredients(existing.id, ingredients);
      restoreBlueprintUserState(existing.id, item.userState || {});
      updated++;
      continue;
    }

    const isScmdb = item.source === 'SCMDB' || Boolean(tag);
    db.run(`INSERT INTO blueprints (name,category,subcategory,manufacturer,item_size,grade,item_class,description,how_to_get,faction,mission_type,patch_added,is_default,notes,source,scmdb_tag,scmdb_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      name, item.category||'Other', item.subcategory||'', item.manufacturer||'',
      item.item_size||'', item.grade||'', item.item_class||'', item.description||'',
      item.how_to_get||'', item.faction||'', item.mission_type||'', item.patch_added||'4.7',
      isScmdb ? 1 : 0, item.notes||'', isScmdb ? 'SCMDB' : '', tag, item.scmdb_url||'',
    ]);
    const bpId = queryOne('SELECT last_insert_rowid() as id').id;
    replaceBlueprintIngredients(bpId, ingredients);
    restoreBlueprintUserState(bpId, item.userState || {});
    imported++;
  }
  saveDb();
  return { success: true, imported, updated, skipped };
});

// ── UEX API Proxy (handles CORS via main process) ────────────────────────────
const https = require('https');

function myMemoryTranslateRequest({ text, source = 'pt', target = 'en', email = '' }) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams({ q: text, langpair: `${source}|${target}` });
    if (email) query.set('de', email);
    const url = `https://api.mymemory.translated.net/get?${query.toString()}`;
    const request = https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Companheiro-Emoto/1.0' },
    }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* resposta não JSON */ }
        const translatedText = json?.responseData?.translatedText;
        if (response.statusCode >= 200 && response.statusCode < 300 && translatedText) {
          resolve({ translation: translatedText, quotaFinished: json?.responseStatus === 206 });
          return;
        }
        reject(new Error(json?.responseDetails || `HTTP ${response.statusCode}`));
      });
    });
    request.on('error', reject);
    request.setTimeout(12000, () => {
      request.destroy();
      reject(new Error('Timeout ao consultar o MyMemory.'));
    });
  });
}

ipcMain.handle('mymemory-translate', async (event, payload = {}) => {
  const text = String(payload.text || '').trim();
  const source = String(payload.source || 'pt').trim().toLowerCase();
  const target = String(payload.target || 'en').trim().toLowerCase();
  const email = String(payload.email || '').trim();
  if (!text) return { success: false, message: 'Nenhum texto foi informado para tradução.' };
  if (Buffer.byteLength(text, 'utf8') > 500) return { success: false, message: 'O MyMemory aceita no máximo 500 bytes por consulta. Divida a mensagem em partes menores.' };
  try {
    const result = await myMemoryTranslateRequest({ text, source, target, email });
    return { success: true, translation: result.translation, quotaFinished: result.quotaFinished };
  } catch (error) {
    return { success: false, message: `MyMemory: ${error.message || 'não foi possível traduzir.'}` };
  }
});

const UEX_API_ORIGIN = 'https://api.uexcorp.uk';
const UEX_API_PREFIX = '/2.0/';
const MAX_UEX_ENDPOINT_LENGTH = 320;
const MAX_UEX_BODY_BYTES = 1024 * 1024;

function normalizeUexEndpoint(endpoint) {
  const value = String(endpoint || '').trim().replace(/^\/+/, '');
  if (!value) throw new Error('Endpoint UEX não informado.');
  if (value.length > MAX_UEX_ENDPOINT_LENGTH) throw new Error('Endpoint UEX excede o limite permitido.');
  if (/^https?:\/\//i.test(value) || value.includes('..') || !/^[A-Za-z0-9_./?=&%:+-]+$/.test(value)) {
    throw new Error('Endpoint UEX inválido ou não permitido.');
  }
  return value;
}

function uexRequest(endpoint, token, secretKey, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    let safeEndpoint;
    try { safeEndpoint = normalizeUexEndpoint(endpoint); } catch (error) { reject(error); return; }
    const url = `${UEX_API_ORIGIN}${UEX_API_PREFIX}${safeEndpoint}`;
    const bodyStr = body == null ? null : JSON.stringify(body);
    if (bodyStr && Buffer.byteLength(bodyStr, 'utf8') > MAX_UEX_BODY_BYTES) {
      reject(new Error('Corpo da requisição UEX excede o limite permitido.'));
      return;
    }
    const requestMethod = String(method || 'GET').toUpperCase();
    if (!['GET', 'POST'].includes(requestMethod)) {
      reject(new Error('Método de requisição UEX não permitido.'));
      return;
    }
    const options = {
      method: requestMethod,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Companheiro-Emoto/1.0',
      }
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    if (token && token.trim()) {
      options.headers['Authorization'] = `Bearer ${token.trim()}`;
    }
    if (secretKey && secretKey.trim()) {
      // A documentação usa nomes diferentes (secret_key / secret-key) dependendo do endpoint —
      // mandamos os dois para garantir compatibilidade.
      options.headers['secret_key'] = secretKey.trim();
      options.headers['secret-key'] = secretKey.trim();
    }
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch(e) { json = null; }
        resolve({ status: res.statusCode, body: json, raw: data.slice(0, 300) });
      });
    });
    req.on('error', (e) => reject(e));
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout — verifique sua conexão')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

ipcMain.handle('uex-test-token', async (event, token) => {
  const t = (token || '').trim();
  if (!t) return { success: false, message: 'Nenhum token fornecido.' };

  // Step 1: test public endpoint first (verify connectivity)
  let connectivity = false;
  try {
    const pub = await uexRequest('game_versions', '');
    if (pub.body && pub.body.status === 'ok') connectivity = true;
    else if (pub.status === 200) connectivity = true; // got response even if format differs
  } catch(e) {
    return { success: false, message: `Sem conexão com a API UEX: ${e.message}` };
  }

  if (!connectivity) {
    return { success: false, message: 'Não foi possível conectar à API UEX Corp. Verifique sua internet.' };
  }

  // Step 2: test token with authenticated endpoints
  // Try several endpoints that may require auth
  const authEndpoints = ['user_profile', 'users/profile', 'profile', 'account'];
  for (const ep of authEndpoints) {
    try {
      const r = await uexRequest(ep, t);
      if (r.body && r.body.status === 'ok') {
        const data = r.body.data || {};
        const handle = data.username || data.handle || data.name || data.email || data.display_name || '';
        return { success: true, message: `Token válido e autenticado!${handle ? ' — Conta: ' + handle : ''}`, authenticated: true };
      }
      if (r.status === 401) {
        return { success: false, message: 'Token inválido ou expirado (HTTP 401). Gere um novo token em uexcorp.space.', authenticated: false };
      }
      if (r.status === 403) {
        return { success: false, message: 'Token sem permissão para este endpoint (HTTP 403). Verifique as permissões em uexcorp.space.', authenticated: false };
      }
      // 404 = endpoint doesn't exist, try next
    } catch(e) { /* try next */ }
  }

  // Step 3: if all auth endpoints failed/404, try commodities with token (semi-auth)
  try {
    const r = await uexRequest('commodities', t);
    if (r.body && r.body.status === 'ok') {
      return { success: true, message: 'API acessível com token. Dados de commodities carregados com sucesso!', authenticated: true };
    }
  } catch(e) { /* ignore */ }

  // If we got here, connectivity works but couldn't verify token specifically
  return {
    success: true,
    message: 'API UEX acessível. Token salvo — será enviado nas requisições. (Endpoint de perfil não disponível para verificação direta.)',
    authenticated: false
  };
});

ipcMain.handle('uex-fetch', async (event, payload = {}) => {
  assertTrustedRenderer(event);
  const { endpoint, token, secretKey } = payload || {};
  try {
    const result = await uexRequest(endpoint, token, secretKey);
    if (result.body && result.body.status === 'ok') {
      return { success: true, data: result.body.data };
    }
    // Return raw for debugging if JSON is valid but status != ok
    const msg = result.body ? (result.body.message || result.body.status || `HTTP ${result.status}`) : `HTTP ${result.status} — resposta não-JSON`;
    return { success: false, message: msg, raw: result.raw };
  } catch(e) {
    return { success: false, message: e.message };
  }
});

// Proxy restrita para imagens oficiais da UEX.
// O renderer não acessa diretamente assets.uexcorp.space porque o servidor pode
// rejeitar imagens embutidas em <img> com HTTP 403. O host e o caminho são
// validados antes do download para impedir que este handler vire uma proxy aberta.
const UEX_IMAGE_HOSTS = new Set(['assets.uexcorp.space']);
const MAX_UEX_IMAGE_BYTES = 10 * 1024 * 1024;

function inferImageMime(url, contentType = '') {
  const normalized = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (normalized.startsWith('image/')) return normalized;
  const pathname = String(url.pathname || '').toLowerCase();
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

function fetchUexImage(rawUrl) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(String(rawUrl || '')); } catch { reject(new Error('URL de imagem inválida.')); return; }
    if (parsed.protocol !== 'https:' || !UEX_IMAGE_HOSTS.has(parsed.hostname) || parsed.username || parsed.password) {
      reject(new Error('Host de imagem não permitido.'));
      return;
    }
    if (!parsed.pathname.startsWith('/img/')) {
      reject(new Error('Caminho de imagem não permitido.'));
      return;
    }

    const request = https.get(parsed, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        Referer: 'https://uexcorp.space/',
        'User-Agent': 'Companheiro-Emoto/1.0',
      },
    }, response => {
      const status = Number(response.statusCode) || 0;
      const contentLength = Number(response.headers['content-length'] || 0);
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Imagem UEX HTTP ${status}`));
        return;
      }
      if (contentLength > MAX_UEX_IMAGE_BYTES) {
        response.resume();
        reject(new Error('Imagem UEX excede o limite permitido.'));
        return;
      }
      const chunks = [];
      let total = 0;
      response.on('data', chunk => {
        total += chunk.length;
        if (total > MAX_UEX_IMAGE_BYTES) {
          request.destroy(new Error('Imagem UEX excede o limite permitido.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const mime = inferImageMime(parsed, response.headers['content-type']);
        resolve(`data:${mime};base64,${buffer.toString('base64')}`);
      });
      response.on('error', reject);
    });
    request.on('error', reject);
    request.setTimeout(15000, () => request.destroy(new Error('Timeout ao carregar imagem UEX.')));
  });
}

ipcMain.handle('uex-image', async (event, rawUrl) => {
  try {
    assertTrustedRenderer(event);
    const dataUrl = await fetchUexImage(rawUrl);
    return { success: true, dataUrl };
  } catch (error) {
    return { success: false, message: error.message || 'Não foi possível carregar a imagem UEX.' };
  }
});

// POST genérico para a UEX (usado hoje para responder mensagens de negociação do Marketplace)
ipcMain.handle('uex-post', async (event, payload = {}) => {
  assertTrustedRenderer(event);
  const { endpoint, token, secretKey, body } = payload || {};
  try {
    const result = await uexRequest(endpoint, token, secretKey, 'POST', body);
    if (result.body && result.body.status === 'ok') {
      return { success: true, data: result.body.data };
    }
    const msg = result.body ? (result.body.message || result.body.status || `HTTP ${result.status}`) : `HTTP ${result.status} — resposta não-JSON`;
    return { success: false, message: msg, raw: result.raw };
  } catch(e) {
    return { success: false, message: e.message };
  }
});

// ── Inventory IPC ────────────────────────────────────────────────────────────
ipcMain.handle('inventory-get-all', () => {
  return queryAll('SELECT * FROM inventory_items ORDER BY system, location_name, category, name');
});

ipcMain.handle('inventory-create', (event, item) => {
  db.run(`INSERT INTO inventory_items
    (name,category,subcategory,system,location_type,location_name,container,
     quantity,unit,size,grade,manufacturer,condition,value_auec,is_contraband,notes,
           is_crafted,craft_status,craft_materials,craft_attachments,item_image,reservations)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [item.name, item.category||'Miscellaneous', item.subcategory||'',
     item.system||'Stanton', item.location_type||'Station',
     item.location_name||'', item.container||'',
     (Number(item.quantity) >= 0 ? Number(item.quantity) : 0), item.unit||'un',
     item.size||'', item.grade||'', item.manufacturer||'',
     item.condition||'Good', Number(item.value_auec)||0,
     item.is_contraband?1:0, item.notes||'',
      item.is_crafted?1:0, JSON.stringify(item.craft_status||[]), JSON.stringify(item.craft_materials||[]), String(item.item_image||''), JSON.stringify(item.reservations||[])]);
  const id = queryOne('SELECT last_insert_rowid() as id').id;
  saveDb();
  return { success: true, id };
});

ipcMain.handle('inventory-update', (event, item) => {
  db.run(`UPDATE inventory_items SET
    name=?,category=?,subcategory=?,system=?,location_type=?,location_name=?,
    container=?,quantity=?,unit=?,size=?,grade=?,manufacturer=?,condition=?,
         value_auec=?,is_contraband=?,notes=?,is_crafted=?,craft_status=?,craft_materials=?,craft_attachments=?,item_image=?,reservations=?,updated_at=datetime('now')
     WHERE id=?`,
    [item.name, item.category, item.subcategory||'',
     item.system, item.location_type, item.location_name,
     item.container||'', (Number(item.quantity) >= 0 ? Number(item.quantity) : 0), item.unit||'un',
     item.size||'', item.grade||'', item.manufacturer||'',
     item.condition||'Good', Number(item.value_auec)||0,
      item.is_contraband?1:0, item.notes||'',
      item.is_crafted?1:0, JSON.stringify(item.craft_status||[]), JSON.stringify(item.craft_materials||[]), JSON.stringify(item.craft_attachments||[]), String(item.item_image||''), JSON.stringify(item.reservations||[]), item.id]);
  saveDb();
  return { success: true };
});

ipcMain.handle('inventory-delete', (event, id) => {
  db.run('DELETE FROM inventory_items WHERE id=?', [id]);
  saveDb();
  return { success: true };
});

ipcMain.handle('inventory-get-stats', () => {
  const total      = queryOne('SELECT COUNT(*) as c FROM inventory_items').c;
  const totalValue = queryOne('SELECT SUM(value_auec*quantity) as v FROM inventory_items').v || 0;
  const bySys      = queryAll('SELECT system, COUNT(*) as count FROM inventory_items GROUP BY system');
  const byCat      = queryAll('SELECT category, COUNT(*) as count FROM inventory_items GROUP BY category ORDER BY count DESC LIMIT 8');
  const contraband = queryOne('SELECT COUNT(*) as c FROM inventory_items WHERE is_contraband=1').c;
  return { total, totalValue, bySys, byCat, contraband };
});

// ── Diretório central de dados ────────────────────────────────────────────────
function makeBackupStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, 'Z');
}

function safeBackupName(name, fallback = 'companheiro-emoto-backup.json') {
  const base = String(name || fallback).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
}

function dataInfo() {
  return {
    success: true,
    app: APP_DIR_NAME,
    appId: APP_ID,
    environment: DATA_ENVIRONMENT,
    dataRoot,
    databasePath: dbPath,
    databaseExists: Boolean(dbPath && fs.existsSync(dbPath)),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    backupPath: path.join(dataRoot, 'backup'),
    exportPath: path.join(dataRoot, 'exportados'),
    pointerConfigPath: dataConfigPath,
    manifestPath: getDataManifestPath(dataRoot),
    legacyUserDataPath,
    migration: dataMigration,
  };
}

const NOTES_ATTACHMENTS_DIR = 'notas-anexos';
const NOTE_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
const NOTE_ATTACHMENT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,180}$/;
const NOTE_ATTACHMENT_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.pdf']);
const NOTE_ATTACHMENT_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml', 'application/pdf']);

function getNotesAttachmentsRoot() {
  if (!dataRoot) throw new Error('O diretório de dados ainda não foi inicializado.');
  return ensureDirectory(path.join(dataRoot, NOTES_ATTACHMENTS_DIR));
}

function getSafeNotesAttachmentPath(storedName) {
  const safeName = path.basename(String(storedName || ''));
  if (!safeName || safeName !== String(storedName || '') || safeName.includes('..')) {
    throw new Error('Anexo inválido.');
  }
  const root = path.resolve(getNotesAttachmentsRoot());
  const target = path.resolve(root, safeName);
  if (path.dirname(target) !== root) throw new Error('Caminho de anexo inválido.');
  return target;
}

function isAllowedNoteAttachment(mimeType, fileName) {
  const mime = String(mimeType || '').toLowerCase();
  const extension = path.extname(String(fileName || '')).toLowerCase();
  return NOTE_ATTACHMENT_EXTENSIONS.has(extension) && (NOTE_ATTACHMENT_MIMES.has(mime) || extension === '.pdf');
}

function safeAttachmentExtension(fileName, mimeType) {
  const extension = path.extname(String(fileName || '')).toLowerCase();
  if (NOTE_ATTACHMENT_EXTENSIONS.has(extension)) return extension === '.jpeg' ? '.jpg' : extension;
  const mime = String(mimeType || '').toLowerCase();
  if (mime === 'application/pdf') return '.pdf';
  const mimeExtensions = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',
  };
  return mimeExtensions[mime] || '.bin';
}

function getAttachmentMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeByExtension = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
  };
  return mimeByExtension[extension] || 'application/octet-stream';
}

function getAttachmentFilename(value) {
  return typeof value === 'object' && value !== null
    ? String(value.filename || value.storedName || '')
    : String(value || '');
}

ipcMain.handle('notes-save-attachment', (event, payload = {}) => {
  try {
    const attachmentId = String(payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    const noteId = String(payload.noteId || 'nota');
    const originalName = path.basename(String(payload.originalName || payload.name || 'arquivo'));
    let mimeType = String(payload.mimeType || '').toLowerCase();
    let data;
    if (typeof payload.dataUrl === 'string' && payload.dataUrl.includes(',')) {
      const header = payload.dataUrl.slice(0, payload.dataUrl.indexOf(','));
      const headerMime = header.match(/^data:([^;]+);base64$/i)?.[1];
      mimeType = mimeType || String(headerMime || '').toLowerCase();
      data = Buffer.from(payload.dataUrl.slice(payload.dataUrl.indexOf(',') + 1), 'base64');
    } else {
      data = payload.data instanceof Uint8Array ? Buffer.from(payload.data) : Buffer.from(payload.data || []);
    }
    if (!NOTE_ATTACHMENT_ID_PATTERN.test(attachmentId) || !NOTE_ATTACHMENT_ID_PATTERN.test(noteId)) return { success: false, error: 'Identificador de anexo inválido.' };
    if (!isAllowedNoteAttachment(mimeType, originalName)) return { success: false, error: 'Somente JPG, PNG, GIF, WEBP, BMP, SVG e PDF são permitidos.' };
    if (!data.length || data.length > NOTE_ATTACHMENT_MAX_BYTES) return { success: false, error: 'O anexo deve ter entre 1 byte e 20 MB.' };

    const storedName = `${noteId}_${attachmentId}${safeAttachmentExtension(originalName, mimeType)}`;
    const target = getSafeNotesAttachmentPath(storedName);
    fs.writeFileSync(target, data);
    const addedAt = new Date().toISOString();
    const attachment = { id: attachmentId, filename: storedName, originalName, mimeType, size: data.length, addedAt };
    return { success: true, attachment, storedName, size: data.length, mimeType, name: originalName };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notes-read-attachment', (event, storedName) => {
  try {
    const filename = getAttachmentFilename(storedName);
    const filePath = getSafeNotesAttachmentPath(filename);
    if (!fs.existsSync(filePath)) return { success: false, error: 'Anexo não encontrado.' };
    const data = fs.readFileSync(filePath);
    if (data.length > NOTE_ATTACHMENT_MAX_BYTES) return { success: false, error: 'Anexo excede o limite permitido.' };
    const mimeType = getAttachmentMimeType(filePath);
    const base64 = data.toString('base64');
    return { success: true, base64, dataUrl: `data:${mimeType};base64,${base64}`, size: data.length, mimeType };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notes-delete-attachment', (event, storedName) => {
  try {
    const filename = getAttachmentFilename(storedName);
    const filePath = getSafeNotesAttachmentPath(filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notes-open-attachment', async (event, storedName) => {
  try {
    const filename = getAttachmentFilename(storedName);
    const filePath = getSafeNotesAttachmentPath(filename);
    if (!fs.existsSync(filePath)) return { success: false, error: 'Anexo não encontrado.' };
    const error = await shell.openPath(filePath);
    return error ? { success: false, error } : { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notes-download-attachment', async (event, payload = {}) => {
  try {
    const filePath = getSafeNotesAttachmentPath(getAttachmentFilename(payload));
    if (!fs.existsSync(filePath)) return { success: false, error: 'Anexo não encontrado.' };
    const defaultName = path.basename(String(payload.originalName || payload.name || path.basename(filePath))).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const result = await dialog.showSaveDialog({
      title: 'Salvar anexo da nota',
      defaultPath: defaultName || path.basename(filePath),
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    fs.copyFileSync(filePath, result.filePath);
    return { success: true, path: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

const SELECTIVE_CLEANUP_SCOPES = {
  armor_collection: {
    countSql: 'SELECT COUNT(*) AS count FROM user_pieces WHERE owned=1 OR wishlist=1 OR quantity>0 OR COALESCE(notes, \'\')<>\'\' OR obtained_date IS NOT NULL',
    clearSql: "UPDATE user_pieces SET owned=0, wishlist=0, notes='', obtained_date=NULL, quantity=0",
  },
  inventory_items: {
    countSql: 'SELECT COUNT(*) AS count FROM inventory_items',
    clearSql: 'DELETE FROM inventory_items',
  },
  blueprints_progress: {
    countSql: 'SELECT COUNT(*) AS count FROM user_blueprints WHERE owned=1 OR wishlist=1 OR crafted_count>0 OR COALESCE(notes, \'\')<>\'\' OR obtained_date IS NOT NULL',
    clearSql: "UPDATE user_blueprints SET owned=0, wishlist=0, crafted_count=0, notes='', obtained_date=NULL",
  },
};

function selectiveCleanupCounts() {
  const counts = {};
  Object.entries(SELECTIVE_CLEANUP_SCOPES).forEach(([id, scope]) => {
    counts[id] = Number(queryOne(scope.countSql)?.count || 0);
  });
  return counts;
}

function createSelectiveCleanupSnapshot(categoryId) {
  if (!dataRoot || !dbPath || !fs.existsSync(dbPath)) return null;
  const backupDir = ensureDirectory(path.join(dataRoot, 'backup', 'limpeza-seletiva'));
  const stamp = makeBackupStamp();
  const filename = `antes-da-limpeza-${categoryId}-${stamp}.db`;
  const destination = path.join(backupDir, filename);
  saveDb();
  fs.copyFileSync(dbPath, destination);
  return destination;
}

ipcMain.handle('data-selective-counts', () => {
  try {
    return { success: true, counts: selectiveCleanupCounts() };
  } catch (error) {
    return { success: false, error: error.message || 'Não foi possível contar os dados.' };
  }
});

ipcMain.handle('data-selective-clear', (event, categoryId) => {
  const id = String(categoryId || '').trim();
  const scope = SELECTIVE_CLEANUP_SCOPES[id];
  if (!scope) return { success: false, error: 'Categoria de limpeza inválida.' };
  try {
    const before = Number(queryOne(scope.countSql)?.count || 0);
    const snapshotPath = createSelectiveCleanupSnapshot(id);
    db.run('BEGIN');
    db.run(scope.clearSql);
    db.run('COMMIT');
    saveDb();
    return { success: true, categoryId: id, before, after: Number(queryOne(scope.countSql)?.count || 0), snapshotPath };
  } catch (error) {
    try { db.run('ROLLBACK'); } catch { /* rollback best effort */ }
    return { success: false, error: error.message || 'Não foi possível limpar os dados selecionados.' };
  }
});

ipcMain.handle('data-get-info', () => dataInfo());

ipcMain.handle('data-open-folder', async () => {
  if (!dataRoot) return { success: false, error: 'O diretório de dados ainda não foi inicializado.' };
  ensureDirectory(dataRoot);
  const error = await shell.openPath(dataRoot);
  return error ? { success: false, error } : { success: true, path: dataRoot };
});

ipcMain.handle('data-choose-directory', async () => {
  const result = await dialog.showOpenDialog({
    title: `Escolha o novo diretório-pai de ${APP_DIR_NAME}`,
    message: `A pasta ${DATA_FOLDER_NAME} será criada dentro do diretório escolhido. O app será reiniciado depois da troca.`,
    defaultPath: dataRoot || getDefaultDataRoot(),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true };

  const nextRoot = normalizeSelectedRoot(result.filePaths[0]);
  try {
    ensureDirectory(nextRoot);
    const migration = migrateLegacyData(dataRoot, nextRoot);
    writeDataConfig(nextRoot);
    return { success: true, dataRoot: nextRoot, pendingRestart: true, migration };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('data-restart-app', () => {
  app.relaunch();
  app.exit(0);
  return { success: true };
});

ipcMain.handle('data-export-full', (event, payload = {}) => {
  if (!dataRoot) return { success: false, error: 'O diretório de dados ainda não foi inicializado.' };
  try {
    saveDb();
    const backupDir = ensureDirectory(path.join(dataRoot, 'backup'));
    const stamp = makeBackupStamp();
    const filename = safeBackupName(payload.filename || `companheiro-emoto-backup-${stamp}.json`);
    const filePath = path.join(backupDir, filename);
    const sqliteName = `companheiro-emoto-database-${stamp}.db`;
    const sqlitePath = path.join(backupDir, sqliteName);
    if (dbPath && fs.existsSync(dbPath)) fs.copyFileSync(dbPath, sqlitePath);
    const backup = {
      app: APP_DIR_NAME,
      format: 'full-data-export',
      version: 1,
      exported_at: new Date().toISOString(),
      dataRoot,
      sqlite_file: sqliteName,
      localStorage: payload.localStorage && typeof payload.localStorage === 'object' ? payload.localStorage : {},
    };
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf8');
    return { success: true, filePath, sqlitePath, exportedKeys: Object.keys(backup.localStorage).length };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('data-import-full', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Importar backup completo do Companheiro Emoto',
    filters: [{ name: 'Backup JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true };
  const filePath = result.filePaths[0];
  const parsed = safeReadJson(filePath);
  if (!parsed || parsed.app !== APP_DIR_NAME || parsed.format !== 'full-data-export' || !parsed.localStorage) {
    return { success: false, error: 'O arquivo selecionado não é um backup completo válido do Companheiro Emoto.' };
  }

  let databaseRestored = false;
  if (parsed.sqlite_file && dataRoot) {
    const declaredDatabaseName = String(parsed.sqlite_file);
    const databaseName = path.basename(declaredDatabaseName);
    const sourceDatabase = path.join(path.dirname(filePath), databaseName);
    const targetDatabase = path.join(dataRoot, 'dados', DB_FILE_NAME);
    const isSafeDatabaseName = databaseName === declaredDatabaseName
      && databaseName.toLowerCase().endsWith('.db');
    if (isSafeDatabaseName && fs.existsSync(sourceDatabase)) {
      ensureDirectory(path.dirname(targetDatabase));
      fs.copyFileSync(sourceDatabase, targetDatabase);
      databaseRestored = true;
      // O objeto `db` atual ainda contém o snapshot anterior. Até o reinício,
      // nenhuma rotina pode exportá-lo novamente sobre o banco restaurado.
      databaseRestartRequired = true;
    }
  }
  return { success: true, filePath, backup: parsed, databaseRestored, pendingRestart: databaseRestored };
});

// ── Mission monitor ───────────────────────────────────────────────────────────
ipcMain.handle('mission-monitor-choose-log', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Escolha o Game.log do Star Citizen',
    defaultPath: path.join(app.getPath('home'), 'Documents'),
    properties: ['openFile'],
    filters: [{ name: 'Game.log', extensions: ['log'] }, { name: 'Todos os arquivos', extensions: ['*'] }],
  });
  return result.canceled ? null : (result.filePaths[0] || null);
});

ipcMain.handle('mission-monitor-start', async (_event, logPath) => {
  if (ENABLE_MISSION_MONITOR_DEBUG) console.info('[MissionAutoMonitor][main][ipc.start.received]', { logPath, type: typeof logPath });
  const status = normalizeMissionMonitorStatus(await getMissionLogWatcher().start(logPath));
  if (ENABLE_MISSION_MONITOR_DEBUG) console.info('[MissionAutoMonitor][main][ipc.start.return]', { logPath: status.logPath, running: status.running, phase: status.debug.phase, fileExists: status.debug.fileExists, readCount: status.debug.readCount, activeCount: status.debug.activeCount, statusShape: status.debug.statusShape, legacyStatusShape: status.debug.legacyStatusShape, watcherVersion: status.debug.watcherVersion });
  return status;
});

ipcMain.handle('mission-monitor-stop', async () => {
  if (!missionLogWatcher) return { running: false, logPath: null, activeMissions: [], recentEvents: [] };
  return missionLogWatcher.stop();
});

ipcMain.handle('mission-monitor-status', () => {
  const status = normalizeMissionMonitorStatus(missionLogWatcher ? missionLogWatcher.status() : { running: false, logPath: null, channel: 'UNKNOWN', activeMissions: [] });
  if (ENABLE_MISSION_MONITOR_DEBUG) console.info('[MissionAutoMonitor][main][ipc.status.return]', { running: status.running, logPath: status.logPath, phase: status.debug.phase, fileExists: status.debug.fileExists, readCount: status.debug.readCount, activeCount: status.debug.activeCount, statusShape: status.debug.statusShape, legacyStatusShape: status.debug.legacyStatusShape, watcherVersion: status.debug.watcherVersion });
  return status;
});

// ── Servidor Mobile local ───────────────────────────────────────────────────────
ipcMain.on('mobile-server-action-response', (event, message = {}) => {
  try { assertTrustedRenderer(event); } catch { return; }
  const pending = pendingMobileRendererActions.get(message.requestId);
  if (!pending) return;
  clearTimeout(pending.timeout);
  pendingMobileRendererActions.delete(message.requestId);
  pending.resolve(message.result || { success: false, error: 'Resposta mobile inválida.' });
});

ipcMain.handle('mobile-server-sync-state', (event, payload = {}) => {
  assertTrustedRenderer(event);
  const source = payload && typeof payload === 'object' ? payload : {};
  mobileRendererState = {
    wikeloMissions: Array.isArray(source.wikeloMissions) ? source.wikeloMissions.slice(0, 500) : [],
    missions: Array.isArray(source.missions) ? source.missions.slice(0, 500) : [],
    uexItems: Array.isArray(source.uexItems) ? source.uexItems.slice(0, 500) : [],
    alerts: Array.isArray(source.alerts) ? source.alerts.slice(0, 500) : [],
    blueprints: Array.isArray(source.blueprints) ? source.blueprints.slice(0, 500) : [],
    materials: Array.isArray(source.materials) ? source.materials.slice(0, 500) : [],
    mining: Array.isArray(source.mining) ? source.mining.slice(0, 500) : [],
    miningGroup: Array.isArray(source.miningGroup) ? source.miningGroup.slice(0, 500) : [],
    oreVault: Array.isArray(source.oreVault) ? source.oreVault.slice(0, 500) : [],
    hangar: Array.isArray(source.hangar) ? source.hangar.slice(0, 500) : [],
    clanVault: Array.isArray(source.clanVault) ? source.clanVault.slice(0, 500) : [],
    notes: Array.isArray(source.notes) ? source.notes.slice(0, 500) : [],
    syncedAt: new Date().toISOString(),
  };
  mobileServer?.setRendererState?.(mobileRendererState);
  return { success: true, syncedAt: mobileRendererState.syncedAt };
});

ipcMain.handle('mobile-server-start', async (event, requestedPort) => {
  assertTrustedRenderer(event);
  if (!mobileServer) return { success: false, error: 'Servidor mobile ainda não foi inicializado.' };
  try { return { success: true, ...await mobileServer.start(requestedPort || MOBILE_DEFAULT_PORT) }; }
  catch (error) { return { success: false, error: error.code === 'EADDRINUSE' ? `A porta ${requestedPort || MOBILE_DEFAULT_PORT} já está em uso.` : (error.message || 'Não foi possível iniciar o servidor mobile.') }; }
});
ipcMain.handle('mobile-server-stop', (event) => {
  assertTrustedRenderer(event);
  return { success: true, ...mobileServer?.stop?.() };
});
ipcMain.handle('mobile-server-status', (event) => {
  assertTrustedRenderer(event);
  return { success: true, ...(mobileServer?.status?.() || { running: false, port: null, urls: [] }) };
});
ipcMain.handle('mobile-server-rotate-token', (event) => {
  assertTrustedRenderer(event);
  return { success: true, ...(mobileServer?.rotateToken?.() || { running: false, port: null, urls: [] }) };
});

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:1440,height:900,minWidth:1100,minHeight:700,
    webPreferences:{
      nodeIntegration:false,
      contextIsolation:true,
      sandbox:true,
      devTools:isDev,
      preload:path.join(__dirname,'preload.js')
    },
    backgroundColor:'#05070c',show:false,
    // icon: resolveAppIcon(),   ← comentada temporariamente
  });

  const isInternalNavigation = (url) => {
    if (isDev) return String(url || '').startsWith('http://localhost:3000');
    return String(url || '').startsWith('file://');
  };
  const openExternalUrl = (rawUrl) => {
    try {
      const parsed = new URL(String(rawUrl || ''));
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
      shell.openExternal(parsed.toString()).catch(() => {});
    } catch (_) {}
  };

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInternalNavigation(url)) openExternalUrl(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isInternalNavigation(url)) return;
    event.preventDefault();
    openExternalUrl(url);
  });

  mainWindow.once('ready-to-show',()=>mainWindow.show());
  isDev ? mainWindow.loadURL('http://localhost:3000') : mainWindow.loadFile(path.join(__dirname,'../build/index.html'));
}
app.whenReady().then(async()=>{
  await configureDataDirectory();
  await initDatabase();
  mobileServer = createMobileServer({
    queryAll,
    queryOne,
    getDataRoot: () => dataRoot,
    getRendererState: () => mobileRendererState,
    requestRendererAction: requestMobileRendererAction,
    updateInventoryQuantity: async (id, payload = {}) => {
      const current = queryOne('SELECT quantity FROM inventory_items WHERE id=?', [id]);
      if (!current) return { success: false, error: 'Item de inventário não encontrado.' };
      const requested = payload.quantity !== undefined ? Number(payload.quantity) : Number(current.quantity) + Number(payload.delta || 0);
      const next = Math.max(0, Number.isFinite(requested) ? requested : Number(current.quantity) || 0);
      db.run('UPDATE inventory_items SET quantity=?, updated_at=datetime(\'now\') WHERE id=?', [next, id]);
      saveDb();
      return { success: true, id, quantity: next };
    },
    updateArmorQuantity: async (id, payload = {}) => {
      const current = queryOne('SELECT quantity FROM user_pieces WHERE piece_id=?', [id]);
      if (!current) return { success: false, error: 'Peça de armadura não encontrada.' };
      const requested = payload.quantity !== undefined ? Number(payload.quantity) : Number(current.quantity) + Number(payload.delta || 0);
      const next = Math.max(0, Number.isFinite(requested) ? Math.floor(requested) : Number(current.quantity) || 0);
      db.run('UPDATE user_pieces SET quantity=?, owned=?, obtained_date=? WHERE piece_id=?', [next, next > 0 ? 1 : 0, next > 0 ? new Date().toISOString() : null, id]);
      saveDb();
      return { success: true, pieceId: id, quantity: next, owned: next > 0 ? 1 : 0 };
    },
    getVersion: () => app.getVersion(),
  });
  createWindow();
  app.on('activate',()=>{ if(!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('before-quit',()=>{ try { saveDb(); } catch (_) {} try { if (missionLogWatcher) missionLogWatcher.stop(); } catch (_) {} try { if (mobileServer) mobileServer.stop(); } catch (_) {} });
app.on('window-all-closed',()=>{ app.quit(); });