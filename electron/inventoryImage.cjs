'use strict';

// Imagens do inventário ficam no banco como data URL (base64). O Chromium não
// consegue baixar/abrir <a href="data:..."> acima de ~2 MB, e window.open()
// com data: é barrado pelo setWindowOpenHandler. Por isso o processo principal
// decodifica a imagem e grava o arquivo (ou abre no visualizador do sistema).

const path = require('path');

const MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const KNOWN_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_STEM_LENGTH = 100;

// SVG fica de fora de propósito: aberto fora do programa poderia executar script.
function parseInventoryImageDataUrl(dataUrl) {
  const match = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || '').trim());
  if (!match) throw new Error('Formato de imagem não suportado (use PNG, JPG, WEBP ou GIF).');
  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!buffer.length) throw new Error('A imagem está vazia.');
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('A imagem excede o tamanho máximo permitido.');
  return { mime, extension: MIME_EXTENSIONS[mime], buffer };
}

function safeInventoryImageName(name, extension) {
  const cleaned = path.basename(String(name || '').replace(/\\/g, '/'))
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim();
  const currentExtension = path.extname(cleaned).slice(1).toLowerCase();
  const hasKnownExtension = KNOWN_EXTENSIONS.has(currentExtension);
  const stem = (hasKnownExtension ? cleaned.slice(0, -(currentExtension.length + 1)) : cleaned)
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_STEM_LENGTH) || 'imagem-item';
  return `${stem}.${hasKnownExtension ? currentExtension : extension}`;
}

module.exports = { parseInventoryImageDataUrl, safeInventoryImageName, MAX_IMAGE_BYTES };
