const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

try {
  fs.rmSync(distDir, { recursive: true, force: true });
  console.log(`[build] Artefatos antigos removidos: ${distDir}`);
} catch (error) {
  console.error(`[build] Não foi possível limpar ${distDir}: ${error.message}`);
  process.exitCode = 1;
}

process.exit(process.exitCode || 0);

// Este script só remove artefatos de distribuição. Ele nunca toca em:
// - build/ (React é recompilado pelo comando anterior);
// - node_modules/;
// - C:\CompanheiroEmoto ou qualquer diretório de dados do usuário;
// - arquivos de backup e bancos fora do diretório do projeto.
