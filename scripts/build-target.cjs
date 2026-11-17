#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const requestedTarget = String(process.argv[2] || '').trim().toLowerCase();
const aliases = {
  linux: 'linux',
  deb: 'linux',
  appimage: 'linux',
  win: 'win',
  windows: 'win',
  win32: 'win',
  zip: 'win-zip',
  winzip: 'win-zip',
  dir: 'dir',
  directory: 'dir',
};

function printUsage() {
  console.log(`Uso:
  npm run build                 Usa o alvo nativo do sistema atual
  npm run build -- linux        Empacota Linux: AppImage, .deb e .tar.gz
  npm run build -- win          Empacota Windows: instalador NSIS e .zip
  npm run build -- win-zip      Empacota somente ZIP Windows, sem NSIS/Wine
  npm run build:linux          Atalho para Linux
  npm run build:win            Atalho para Windows
  npm run build:dir            Gera apenas a aplicação descompactada

No Linux, o alvo Windows NSIS exige Wine instalado. O alvo ZIP não exige Wine.`);
}

function run(command, args) {
  console.log(`\\n> ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
}

function commandExists(command) {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  try {
    execFileSync(checker, [command], { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

const target = aliases[requestedTarget || (process.platform === 'win32' ? 'win' : 'linux')];
if (!target) {
  if (requestedTarget) console.error(`Alvo inválido: ${requestedTarget}`);
  printUsage();
  process.exit(requestedTarget ? 2 : 0);
}

if (target === 'win' && process.platform === 'linux' && !commandExists('wine')) {
  console.error('\nNão foi possível preparar o instalador Windows NSIS porque o Wine não está instalado.');
  console.error('Instale o Wine (por exemplo: sudo apt install wine) ou use `npm run build:linux`.');
  console.error('O alvo Windows ZIP pode ser gerado sem Wine alterando temporariamente o target win para zip.');
  process.exit(1);
}

const dist = path.join(ROOT, 'dist');
if (fs.existsSync(dist)) {
  fs.rmSync(dist, { recursive: true, force: true });
}

run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'react-build']);

if (target === 'dir') {
  run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron-builder', '--dir']);
} else if (target === 'win-zip') {
  run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron-builder', '--win', 'zip']);
} else {
  run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron-builder', `--${target}`]);
}

console.log(`\nEmpacotamento concluído para: ${target}`);
console.log(`Artefatos disponíveis em: ${dist}`);
