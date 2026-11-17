# Companheiro Emoto 2.0.0 — Guia de instalação dos arquivos finais

Este documento acompanha o pacote final de manutenção. A regra principal é **substituir arquivos pelo mesmo caminho relativo**, mantendo os diretórios `src`, `electron`, `public`, `scripts` e `docs` dentro da raiz do projeto.

## Arquivos que devem ser mantidos

| Caminho relativo | Função |
|---|---|
| `src/pages/DashboardPage.js` | Integra o Centro Operacional no Dashboard. |
| `src/components/OperationalStatusBar.js` | Indicadores acionáveis de missões, materiais, alertas e receita; inclui rótulos acessíveis. |
| `src/pages/InventoryPage.js` | Busca otimizada e filtros do Inventário. |
| `src/data/inventorySearch.js` | Contrato centralizado de filtragem e agrupamento do Inventário. |
| `src/data/inventoryEvents.js` | Evento de atualização compartilhado pelo Inventário. |
| `src/App.css` | Estilos globais, efeitos visuais e bloco responsivo do Centro Operacional. |
| `src/App.js` | Integração das páginas, ponte Electron, efeitos e flags de diagnóstico. |
| `src/config/debugFlags.js` | Ativação centralizada dos diagnósticos por comentário de uma linha. |
| `electron/main.js` | Processo principal, SQLite, IPC e proxy seguro UEX. |
| `electron/preload.js` | API segura exposta ao renderer. |
| `electron/missionWatcher.js` | Monitor automático de missões. |
| `electron/dbMigrations.js` | Migrações versionadas do schema SQLite. |
| `electron/dbMigrations.test.cjs` | Teste de baseline e idempotência das migrações. |
| `package.json` | Scripts, dependências e `npm run verify`. |
| `package-lock.json` | Resolução exata das dependências instaladas. |

O pacote também contém os demais arquivos do projeto porque a aplicação é integrada; portanto, **não copie somente um arquivo isolado para um projeto de versão diferente sem executar a validação**.

## Instalação em uma cópia existente

Faça backup da pasta de dados do aplicativo antes de substituir arquivos. Depois, extraia o pacote na raiz do projeto, mantendo a estrutura de diretórios. No Windows, a raiz deve ser a pasta que contém `package.json`, por exemplo `C:\Users\jose\Desktop\sc-armor-tracker`.

Em seguida, execute:

```powershell
npm install
npm run verify
npm run dev
```

Se a instalação for empacotada, gere o instalador somente depois do `verify`:

```powershell
npm run build:win
```

## Arquivos gerados e opcionais para limpeza

| Caminho | Pode remover? | Observação |
|---|---:|---|
| `node_modules/` | Sim | Recriado por `npm install`; não deve ser enviado no pacote-fonte. |
| `build/` | Sim | Saída do React; recriada por `npm run react-build`. |
| `dist/` | Sim, se não precisar do instalador atual | Saída do Electron Builder; contém instaladores e artefatos gerados. |
| `coverage/` | Sim | Saída eventual de cobertura de testes. |
| `.cache/`, `*.log` de desenvolvimento | Sim, após conferir que não são dados do usuário | São temporários. |

## Arquivos que não devem ser removidos

Não remova `electron/scmdbBlueprintCatalog.json`, `public/`, `electron-icons/`, `src/data/`, `src/pages/`, `electron/`, `package.json` ou `package-lock.json`. Também não remova a pasta de dados persistentes do usuário sem backup; ela pode conter SQLite, preferências e inventário real.

## Diagnósticos

Os diagnósticos de efeitos visuais e logs detalhados ficam desligados por padrão. Para ativá-los temporariamente, altere a flag indicada em `src/config/debugFlags.js`, faça o teste e depois reverta a alteração antes de distribuir o aplicativo.

## Verificação final

A entrega foi validada com 33 suítes React e 132 testes React, além do teste Node/Electron das migrações. O comando oficial de conferência é:

```bash
npm run verify
```
