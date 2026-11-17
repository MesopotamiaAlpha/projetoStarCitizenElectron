'use strict';

const fs = require('fs');
const path = require('path');

function fileSignature(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  // mtimeNs evita falsos negativos quando duas gravações acontecem no mesmo
  // milissegundo. O fallback mantém compatibilidade com versões antigas do Node.
  return stat.mtimeNs !== undefined
    ? `ns:${stat.mtimeNs.toString()}`
    : `ms:${stat.mtimeMs}:${stat.size}`;
}

function saveDatabaseSnapshot({ database, databasePath, loadedSignature = null, restartRequired = false }) {
  if (!database || !databasePath) return { saved: false, reason: 'database-not-ready' };
  if (restartRequired) return { saved: false, reason: 'database-restart-required' };

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const currentSignature = fileSignature(databasePath);
  if (currentSignature !== loadedSignature) {
    return {
      saved: false,
      reason: 'database-changed-externally',
      loadedSignature,
      currentSignature,
    };
  }

  const temporaryPath = `${databasePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, Buffer.from(database.export()), { flag: 'wx' });
    fs.renameSync(temporaryPath, databasePath);
    return { saved: true, fileSignature: fileSignature(databasePath) };
  } catch (error) {
    try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch (_) {}
    throw error;
  }
}

module.exports = {
  fileSignature,
  saveDatabaseSnapshot,
};

// Não usar escrita direta no arquivo definitivo: o rename atômico impede que
// uma interrupção deixe um banco parcialmente gravado.
