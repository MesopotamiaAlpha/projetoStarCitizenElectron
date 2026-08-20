const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Marcador usado pelo renderer para diferenciar a ponte real do Electron do
  // fallback de pré-visualização no navegador.
  isCompanheiroEmotoElectron: true,
  // Armor sets
  getAllSets:          ()           => ipcRenderer.invoke('get-all-sets'),
  togglePiece:        (id)         => ipcRenderer.invoke('toggle-piece', id),
  togglePieceWishlist:(id)         => ipcRenderer.invoke('toggle-piece-wishlist', id),
  updatePieceNotes:   (id, notes)  => ipcRenderer.invoke('update-piece-notes', { pieceId:id, notes }),
  getStats:           ()           => ipcRenderer.invoke('get-stats'),
  createCustomSet:    (data)       => ipcRenderer.invoke('create-custom-set', data),
  updateCustomSet:    (id, set)    => ipcRenderer.invoke('update-custom-set', { setId:id, set }),
  updateCustomPiece:  (id, piece)  => ipcRenderer.invoke('update-custom-piece', { pieceId:id, piece }),
  addPieceToSet:      (id, piece)  => ipcRenderer.invoke('add-piece-to-set', { setId:id, piece }),
  deleteCustomSet:    (id)         => ipcRenderer.invoke('delete-custom-set', id),
  getDuplicateCustomSets: ()        => ipcRenderer.invoke('get-duplicate-custom-sets'),
  deleteCustomSets:   (ids)        => ipcRenderer.invoke('delete-custom-sets', ids),
  deleteCustomPiece:  (id)         => ipcRenderer.invoke('delete-custom-piece', id),
  // Inventory
  inventoryGetAll:    ()           => ipcRenderer.invoke('inventory-get-all'),
  inventoryCreate:    (item)       => ipcRenderer.invoke('inventory-create', item),
  inventoryUpdate:    (item)       => ipcRenderer.invoke('inventory-update', item),
  inventoryDelete:    (id)         => ipcRenderer.invoke('inventory-delete', id),
  inventoryGetStats:  ()           => ipcRenderer.invoke('inventory-get-stats'),
  uexTestToken:       (token)      => ipcRenderer.invoke('uex-test-token', token),
  uexFetch:           (data)       => ipcRenderer.invoke('uex-fetch', data),
  uexImage:           (url)        => ipcRenderer.invoke('uex-image', url),
  uexPost: (data) => ipcRenderer.invoke('uex-post', data),
  mymemoryTranslate: (data) => ipcRenderer.invoke('mymemory-translate', data),
  getSeedNames:        ()           => ipcRenderer.invoke('get-seed-names'),
  // Blueprints
  bpGetAll:           ()           => ipcRenderer.invoke('bp-get-all'),
  bpToggleOwned:      (id)         => ipcRenderer.invoke('bp-toggle-owned', id),
  bpToggleWishlist:   (id)         => ipcRenderer.invoke('bp-toggle-wishlist', id),
  bpIncrementCrafted: (id)         => ipcRenderer.invoke('bp-increment-crafted', id),
  bpUpdateNotes:      (id, notes)  => ipcRenderer.invoke('bp-update-notes', { bpId:id, notes }),
  bpCreateCustom:     (data)       => ipcRenderer.invoke('bp-create-custom', data),
  bpUpdateCustom:     (data)       => ipcRenderer.invoke('bp-update-custom', data),
  bpDeleteCustom:     (id)         => ipcRenderer.invoke('bp-delete-custom', id),
  bpGetStats:         ()           => ipcRenderer.invoke('bp-get-stats'),
  bpExportCustom:     ()           => ipcRenderer.invoke('bp-export-custom'),
  bpImportCustom:     (list)       => ipcRenderer.invoke('bp-import-custom', list),
  bpImportScmdb:      (list)       => ipcRenderer.invoke('bp-import-scmdb', list),
  updatePieceQuantity: (id, qty) => ipcRenderer.invoke('update-piece-quantity', id, qty),
  // Diretório central de dados e backup completo
  dataGetInfo:          ()       => ipcRenderer.invoke('data-get-info'),
  dataSelectiveCounts:  ()       => ipcRenderer.invoke('data-selective-counts'),
  dataSelectiveClear:   (category) => ipcRenderer.invoke('data-selective-clear', category),
  dataChooseDirectory:  ()       => ipcRenderer.invoke('data-choose-directory'),
  dataOpenFolder:       ()       => ipcRenderer.invoke('data-open-folder'),
  dataRestartApp:       ()       => ipcRenderer.invoke('data-restart-app'),
  dataExportFull:       (data)   => ipcRenderer.invoke('data-export-full', data),
  dataImportFull:       ()       => ipcRenderer.invoke('data-import-full'),
  // Anexos do Bloco de Notas — imagens e PDFs salvos na pasta central
  notesSaveAttachment:   (payload) => ipcRenderer.invoke('notes-save-attachment', payload),
  notesReadAttachment:   (storedName) => ipcRenderer.invoke('notes-read-attachment', storedName),
  notesDeleteAttachment: (storedName) => ipcRenderer.invoke('notes-delete-attachment', storedName),
  notesOpenAttachment:   (storedName) => ipcRenderer.invoke('notes-open-attachment', storedName),
  notesDownloadAttachment: (payload) => ipcRenderer.invoke('notes-download-attachment', payload),
  // Monitor automático independente do Game.log
  missionMonitorChooseLog: () => ipcRenderer.invoke('mission-monitor-choose-log'),
  missionMonitorStart:     (logPath) => ipcRenderer.invoke('mission-monitor-start', logPath),
  missionMonitorStop:      () => ipcRenderer.invoke('mission-monitor-stop'),
  missionMonitorStatus:    () => ipcRenderer.invoke('mission-monitor-status'),
  onMissionMonitorEvent:   (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('mission-monitor-event', listener);
    return () => ipcRenderer.removeListener('mission-monitor-event', listener);
  },
  onMissionMonitorStatus:  (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('mission-monitor-status', listener);
    return () => ipcRenderer.removeListener('mission-monitor-status', listener);
  },
});
