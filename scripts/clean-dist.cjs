#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const dist = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  fs.rmSync(dist, { recursive: true, force: true });
  console.log(`Diretório removido: ${dist}`);
} else {
  console.log(`Nada para limpar: ${dist}`);
}
