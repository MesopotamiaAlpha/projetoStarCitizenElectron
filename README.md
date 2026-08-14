# Companheiro Emoto — Manual Técnico do Projeto

> **Objetivo deste documento:** permitir que outro programador consiga instalar, executar, entender, corrigir, estender e empacotar o Companheiro Emoto sem depender do histórico de desenvolvimento.

O **Companheiro Emoto** é um aplicativo desktop para Windows construído com Electron e React para acompanhar dados de Star Citizen. Ele reúne rastreamento de armaduras, coleção, inventário de itens, blueprints, materiais para crafting, baú de minério, mineração, missões, cofre de clã, Wikelo, marketplace UEX, notas, locais administráveis, calculadora e ferramentas de backup.

O projeto é um aplicativo Electron: o React representa a interface; o processo principal do Electron controla a janela, o banco SQLite em memória, o acesso ao sistema de arquivos, a proxy HTTPS da UEX, as traduções e os backups; o `preload.js` expõe uma API IPC limitada ao renderer. Essa separação usa `contextIsolation`, `contextBridge`, `nodeIntegration: false` e sandbox no renderer. O `contextBridge` é a forma recomendada pelo Electron para expor APIs específicas do preload sem entregar APIs poderosas diretamente à página carregada [1].

## 1. Tecnologias e responsabilidades

| Camada | Tecnologia | Responsabilidade principal |
|---|---|---|
| Interface | React 18 | Renderização das páginas, formulários, cards, modais, filtros e estado visual. |
| Shell da aplicação | `src/App.js` | Menu lateral, navegação por estado, carregamento inicial de armaduras, integração dos widgets globais e montagem das páginas. |
| Processo principal | Electron 29 / `electron/main.js` | Janela, ciclo de vida, SQLite, IPC, migração de dados, diretório central, proxy UEX, tradução e abertura de pastas. |
| Ponte segura | `electron/preload.js` | Contrato explícito entre React e Electron por `window.electronAPI`. Não deve conter regras de negócio. |
| Banco relacional | `sql.js` | SQLite compilado para JavaScript/WebAssembly, carregado em memória e exportado para um arquivo `.db` a cada persistência. A biblioteca permite importar um arquivo SQLite e exportar o banco como buffer [2]. |
| Persistência leve | `localStorage` | Missões, mineração, baú de minério, tracking, notas, UEX, Wikelo, locais e datasets editáveis. |
| Empacotamento | `electron-builder` | Geração de instalador NSIS e ZIP exclusivamente para Windows. |
| Ícones | `lucide-react` + `electron-icons/icon.ico` | Ícones da interface e ícone do aplicativo Windows. |
| Estilos | `src/App.css` | Tema escuro sci-fi, grids, responsividade, cards, sidebar, modais e componentes compartilhados. |

O `sql.js` não é um servidor SQLite separado. O objeto `db` vive no processo principal. O banco é carregado do arquivo, alterado em memória e salvo usando `db.export()`. Portanto, qualquer nova operação que altere tabelas deve chamar `saveDb()` depois da alteração.

## 2. Pré-requisitos e execução local

O desenvolvimento exige Node.js 18 ou superior, npm e Windows para a execução final do empacotamento. O código também pode ser analisado em outros ambientes, mas o fluxo oficial de distribuição é Windows-only.

```powershell
# Entrar na pasta do projeto
cd C:\caminho\projetoStarCitizenElectron

# Instalar as dependências
npm install

# Executar React + Electron em modo de desenvolvimento
npm run dev
```

O script `dev` inicia o servidor React em `http://localhost:3000` e, depois, abre o Electron apontando para esse endereço. O `NODE_ENV=development` é usado para que `electron/main.js` carregue a aplicação pelo `loadURL`.

Para compilar somente o renderer:

```powershell
npm run react-build
```

Para gerar os artefatos Windows:

```powershell
npm run build
# ou
npm run build:win
```

O script de build executa o build React e depois `electron-builder --win`. O `package.json` possui dois targets Windows: `nsis`, que gera o instalador, e `zip`, que gera uma distribuição compactada. O `electron-builder` lê as configurações do campo `build` no `package.json`; o target NSIS é o instalador Windows padrão documentado pela ferramenta [3] [4].

## 3. Estrutura do repositório

```text
projetoStarCitizenElectron/
├── electron/
│   ├── main.js                 Processo principal Electron, SQLite e IPC
│   └── preload.js              API segura exposta ao renderer
├── electron-icons/
│   ├── icon.ico                Ícone Windows usado pelo builder
│   ├── icon.png                Fonte visual do ícone
│   └── emoto-icon.svg          Ícone utilizado na interface
├── public/
│   └── ...                     Recursos estáticos do CRA
├── src/
│   ├── index.js                Ponto de entrada React
│   ├── App.js                  Shell, menu e roteamento por estado
│   ├── App.css                 Tema e responsividade global
│   ├── components/             Widgets e componentes reutilizáveis
│   ├── data/                   Regras de domínio e persistência local
│   └── pages/                  Telas funcionais do aplicativo
├── scripts/
│   └── generate_windows_icon.py  Gera icon.ico a partir do PNG
├── package.json                Scripts, dependências e electron-builder
├── package-lock.json           Versões resolvidas das dependências
├── CENTRALIZACAO_DADOS.md      Manual da pasta de dados centralizada
├── SEGURANCA_AVAST.md          Auditoria de segurança e distribuição
└── README.md                   Este manual técnico
```

### Arquivos presentes, mas fora do fluxo principal atual

`src/pages/DataEditorPage.js`, `src/pages/MarketFinderPage.js` e `src/pages/TradeHubPage.js` existem no repositório, mas atualmente não aparecem no `NAV_GROUPS` nem no switch de renderização de `src/App.js`. Antes de considerar uma dessas telas funcional no aplicativo, adicione o item de navegação e a condição correspondente no switch.

`src/pages/materialQueue.js` é um helper legado. O arquivo canônico usado por `BlueprintPage` e `MaterialTrackerPage` é `src/data/materialQueue.js`. Não duplique correções nos dois arquivos sem confirmar quais importações existem.

## 4. Arquitetura de execução

O fluxo normal de inicialização é:

```text
Electron app.whenReady()
        │
        ├── inicializa o diretório central CompanheiroEmoto
        │       ├── lê config.json do ponteiro
        │       ├── escolhe ou cria a pasta de dados
        │       ├── migra o userData legado
        │       └── app.setPath('userData', dataRoot)
        │
        ├── inicializa sql.js e abre/cria o SQLite
        │       ├── cria tabelas se necessário
        │       ├── executa migrações ALTER TABLE
        │       └── insere seeds estáticos quando necessário
        │
        ├── cria BrowserWindow
        │       ├── desenvolvimento: loadURL(localhost:3000)
        │       └── produção: loadFile(build/index.html)
        │
        └── renderer executa App.js
                ├── escolhe window.electronAPI ou buildMockAPI()
                ├── carrega armaduras e estatísticas
                ├── registra procedência dos dados
                └── exibe a página ativa
```

A navegação não usa React Router. `App.js` mantém `activePage` em estado React e renderiza condicionalmente a tela correspondente. Por isso, quando uma página não aparece, o primeiro arquivo a investigar é `src/App.js`, especialmente `NAV_GROUPS`, `PAGES` e o switch próximo ao final do arquivo.

## 5. Menu e páginas conectadas

A tabela abaixo mostra os identificadores usados em `activePage`, a página renderizada e o local principal para manutenção.

| Grupo | ID | Componente | Responsabilidade |
|---|---|---|---|
| Início | `dashboard` | `DashboardPage.js` | KPIs, PAF, Wikelo, DCHS, missões, mineração e resumo de armaduras. |
| Armaduras | `all` | `AllArmorsPage.js` | Lista de todas as armaduras, filtros, posse, wishlist e notas. |
| Armaduras | `collection` | `MyCollectionPage.js` | Coleção do usuário, peças possuídas, sets completos e quantidades. |
| Armaduras | `custom` | `CustomArmorPage.js` | Cadastro, edição e importação de conjuntos personalizados. |
| Itens & Crafting | `inventory` | `InventoryPage.js` | Inventário de itens, autocomplete UEX, preço médio, quantidade, locais, scripts, PAF e transferência. |
| Itens & Crafting | `blueprints` | `BlueprintPage.js` | Blueprints, ingredientes, qualidade mínima, SCMDB, posse, wishlist e fila. |
| Itens & Crafting | `materials` | `MaterialTrackerPage.js` | Lista consolidada, prioridade por arrastar, estoque do baú, qualidade e consumo. |
| Mineração | `mining` | `MiningPage.js` | Dados editáveis de minérios, lasers, naves, módulos e builds. |
| Mineração | `mininggroup` | `MiningGroupPage.js` | Sessões, grupo de mineração, refino, loot e armazenamento. |
| Mineração | `orevault` | `OreVaultPage.js` | Baú de minério, quantidade, unidade, qualidade, local, transferência e dedução. |
| Clã & Missões | `clanvault` | `ClanVaultPage.js` | Estoque compartilhado do clã, responsáveis, consumo e notas. |
| Clã & Missões | `missions` | `MissionTrackerPage.js` | Missões, status, valores, perdas da carteira, loot e histórico. |
| UEX | `uexsales` | `UexSalesPage.js` | Acompanhamento de vendas e anúncios UEX. |
| UEX | `uexnegotiations` | `UexNegotiationsPage.js` | Negociações, chat, polling, tradução, fechamento e registro de venda. |
| UEX | `wikelo` | `WikeloTrackerPage.js` | Missões Wikelo, scripts, favors e progresso. |
| UEX | `uexapi` | `UexApiPage.js` | Token, sincronização de itens, locais, mineração e médias UEX. |
| Sistema | `backup` | `BackupPage.js` | Backup seletivo e restauração de categorias do localStorage. |
| Sistema | `data-directory` | `DataDirectoryPage.js` | Pasta central, troca de diretório e backup completo. |
| Sistema | `notes` | `NotesPage.js` | Notas livres e textos UEX reutilizáveis. |
| Sistema | `locations` | `LocationsAdminPage.js` | Cadastro, edição, ativação e remoção de locais. |

Widgets montados globalmente em `App.js`: `UexNotificationBell` realiza o controle visual das notificações UEX e `CalculatorWidget` fornece a calculadora flutuante. Eles ficam fora do switch de páginas, portanto aparecem em qualquer tela.

## 6. Contrato IPC entre React e Electron

### 6.1 Regra de segurança

O renderer não deve usar `require`, `fs`, `path`, `https`, `http`, `sql.js` ou `ipcRenderer` diretamente. O único ponto permitido é `window.electronAPI`, exposto por `electron/preload.js`. O preload deve expor funções pequenas e específicas, não uma função genérica que aceite qualquer canal IPC.

Quando uma tela apresenta erro como `window.electronAPI.inventoryGetAll is not a function`, o diagnóstico deve seguir esta ordem:

1. Conferir o método usado pela página.
2. Conferir se o mesmo nome existe em `electron/preload.js`.
3. Conferir se o canal correspondente existe em `ipcMain.handle(...)` dentro de `electron/main.js`.
4. Conferir o formato dos argumentos nos três pontos.
5. Reiniciar o Electron após modificar o preload ou o processo principal.

### 6.2 API exposta pelo preload

| Domínio | Método do renderer | Canal IPC | Uso |
|---|---|---|---|
| Armaduras | `getAllSets()` | `get-all-sets` | Retorna sets e peças com posse, wishlist e notas. |
| Armaduras | `togglePiece(id)` | `toggle-piece` | Alterna posse da peça. |
| Armaduras | `togglePieceWishlist(id)` | `toggle-piece-wishlist` | Alterna wishlist. |
| Armaduras | `updatePieceNotes(id, notes)` | `update-piece-notes` | Salva notas da peça. |
| Armaduras | `getStats()` | `get-stats` | Estatísticas de sets e peças. |
| Armaduras | `createCustomSet(data)` | `create-custom-set` | Cria set e peças customizadas. |
| Armaduras | `updateCustomSet(id, set)` | `update-custom-set` | Atualiza metadados do set. |
| Armaduras | `updateCustomPiece(id, piece)` | `update-custom-piece` | Atualiza peça customizada. |
| Armaduras | `addPieceToSet(id, piece)` | `add-piece-to-set` | Adiciona peça a set customizado. |
| Armaduras | `deleteCustomSet(id)` | `delete-custom-set` | Remove set customizado. |
| Armaduras | `deleteCustomPiece(id)` | `delete-custom-piece` | Remove peça customizada. |
| Armaduras | `updatePieceQuantity(id, qty)` | `update-piece-quantity` | Handler legado de quantidade; conferir schema antes de alterar. |
| Armaduras | `getSeedNames()` | `get-seed-names` | Obtém nomes seeded para procedência. |
| Inventário | `inventoryGetAll()` | `inventory-get-all` | Lista itens SQLite. |
| Inventário | `inventoryCreate(item)` | `inventory-create` | Cria item. |
| Inventário | `inventoryUpdate(item)` | `inventory-update` | Atualiza item. |
| Inventário | `inventoryDelete(id)` | `inventory-delete` | Remove item. |
| Inventário | `inventoryGetStats()` | `inventory-get-stats` | Estatísticas do inventário. |
| UEX | `uexTestToken(token)` | `uex-test-token` | Testa conectividade e autenticação. |
| UEX | `uexFetch(data)` | `uex-fetch` | GET HTTPS para a API UEX. |
| UEX | `uexPost(data)` | `uex-post` | POST HTTPS para a API UEX. |
| Tradução | `mymemoryTranslate(data)` | `mymemory-translate` | Tradução gratuita MyMemory. |
| Tradução | `googleTranslate(data)` | `google-translate` | Fallback Google Cloud com chave configurada. |
| Blueprints | `bpGetAll()` | `bp-get-all` | Lista blueprints e ingredientes. |
| Blueprints | `bpToggleOwned(id)` | `bp-toggle-owned` | Alterna posse. |
| Blueprints | `bpToggleWishlist(id)` | `bp-toggle-wishlist` | Alterna wishlist. |
| Blueprints | `bpIncrementCrafted(id)` | `bp-increment-crafted` | Incrementa craftados. |
| Blueprints | `bpUpdateNotes(id, notes)` | `bp-update-notes` | Salva notas. |
| Blueprints | `bpCreateCustom(data)` | `bp-create-custom` | Cria blueprint e ingredientes. |
| Blueprints | `bpUpdateCustom(data)` | `bp-update-custom` | Atualiza blueprint customizada. |
| Blueprints | `bpDeleteCustom(id)` | `bp-delete-custom` | Remove blueprint customizada. |
| Blueprints | `bpImportScmdb(list)` | `bp-import-scmdb` | Importa backup SCMDB. |
| Blueprints | `bpExportCustom()` | `bp-export-custom` | Exporta blueprints customizadas. |
| Blueprints | `bpImportCustom(list)` | `bp-import-custom` | Importa blueprints customizadas. |
| Dados | `dataGetInfo()` | `data-get-info` | Retorna pasta ativa, banco e migração. |
| Dados | `dataChooseDirectory()` | `data-choose-directory` | Escolhe novo diretório-pai. |
| Dados | `dataOpenFolder()` | `data-open-folder` | Abre a pasta no Explorer. |
| Dados | `dataRestartApp()` | `data-restart-app` | Reinicia o Electron após troca/restauração. |
| Dados | `dataExportFull(data)` | `data-export-full` | Salva localStorage e copia o banco SQLite. |
| Dados | `dataImportFull()` | `data-import-full` | Importa JSON de backup completo e banco adjacente. |

## 7. Processo principal e diretório de dados

### 7.1 Arquivos persistentes

Na primeira execução, o aplicativo cria ou solicita uma pasta-pai e usa a pasta `CompanheiroEmoto` dentro dela. O padrão esperado no Windows é:

```text
C:\CompanheiroEmoto\
├── dados\
│   └── sc_armor_tracker_v3.db
├── backup\
├── exportados\
├── Local Storage\
├── IndexedDB\
├── Session Storage\
└── ... arquivos persistentes gerenciados pelo Electron
```

O ponteiro leve fica fora da pasta escolhida, em uma área de configuração do Electron, para que o programa consiga reencontrar a pasta após uma atualização. O arquivo aponta para o diretório ativo; não contém o banco nem o inventário.

O fluxo implementado em `initializeDataDirectory()` é:

1. Ler o ponteiro `config.json`.
2. Encontrar a pasta selecionada anteriormente.
3. Se não houver escolha, propor a raiz do disco e criar `CompanheiroEmoto`.
4. Copiar dados legados do `userData` antigo, ignorando caches e arquivos transitórios.
5. Criar `dados`, `backup` e `exportados`.
6. Executar `app.setPath('userData', dataRoot)` antes de criar a janela.
7. Definir `dbPath` como `dataRoot\dados\sc_armor_tracker_v3.db`.

Quando a pasta é trocada, os dados são copiados para o novo local e o app é reiniciado. Não remova manualmente o banco antigo antes de confirmar que a migração foi concluída.

### 7.2 SQLite e sql.js

O banco é aberto em `initDatabase()`. A configuração de `locateFile` aponta para:

```text
node_modules/sql.js/dist
```

O banco não usa `sqlite3` nativo. O código carrega o arquivo com `fs.readFileSync`, cria `new SQL.Database(buffer)`, executa SQL em memória e grava novamente com `Buffer.from(db.export())`.

Funções importantes do `main.js`:

| Função | Responsabilidade |
|---|---|
| `ensureDirectory(path)` | Cria diretórios necessários. |
| `initializeDataDirectory()` | Inicializa, migra e fixa o diretório central. |
| `initDatabase()` | Carrega sql.js, abre banco, cria schema e executa seeds. |
| `queryAll(sql, params)` | Executa consulta e retorna array de objetos. |
| `queryOne(sql, params)` | Retorna o primeiro registro ou `null`. |
| `saveDb()` | Exporta o banco em memória para o arquivo `.db`. |
| `seedData()` | Insere armaduras e dados iniciais quando ausentes. |
| `seedBlueprints()` | Insere blueprints padrão quando ausentes. |
| `migrateLegacyData()` | Copia dados do armazenamento legado. |

Ao adicionar uma tabela ou coluna, não confie somente em `CREATE TABLE IF NOT EXISTS`: ele não altera uma tabela existente. Adicione uma migração idempotente com `ALTER TABLE ... ADD COLUMN` dentro de `try/catch`, seguindo o padrão existente.

### 7.3 Schema atual

#### `armor_sets`

Armazena sets de armadura, variantes, fabricante, tipo, categoria, descrição, lore, tags, versão, raridade e `is_custom`.

#### `armor_pieces`

Armazena as peças vinculadas ao set por `set_id`. Campos principais: `piece_type`, `piece_name`, resistências, penalidade de mobilidade, slots, comprável, saqueável, local, método, preço e descrição.

#### `user_pieces`

É a tabela de estado do usuário para as peças. Guarda `owned`, `wishlist`, `notes` e `obtained_date`. A posse não deve ser gravada diretamente em `armor_pieces`.

#### `inventory_items`

Armazena `name`, categoria, subcategoria, sistema, tipo de local, nome do local, container, `quantity`, `unit`, size, grade, fabricante, condição, valor AUEC, contrabando, notas, `is_crafted` e `craft_status`.

#### `blueprints`

Armazena nome, categoria, subcategoria, fabricante, tamanho, grade, classe, descrição, como obter, facção, tipo de missão, patch, `is_default`, notas e metadados de origem SCMDB.

#### `blueprint_ingredients`

Vincula material a blueprint com `quantity`, `quality_min`, `unit` e `notes`. A chave de negócio do tracking é material + qualidade mínima; materiais da mesma categoria com qualidades incompatíveis não devem ser misturados.

#### `user_blueprints`

Guarda posse, quantidade craftada, wishlist, notas e data de obtenção por blueprint.

Migrações atuais adicionam `inventory_items.is_crafted`, `inventory_items.craft_status`, `blueprints.source`, `blueprints.scmdb_tag` e `blueprints.scmdb_url` quando ainda não existem.

> **Atenção para manutenção:** o handler `update-piece-quantity` ainda executa `UPDATE armor_pieces SET quantity = ...`, mas o schema atual não possui a coluna `quantity` em `armor_pieces`. Ao corrigir esse fluxo, decida se a quantidade deve viver em `user_pieces` ou se uma migração de schema é realmente necessária. Não apenas remova o erro silenciosamente.

## 8. Persistência localStorage

A maior parte das telas usa chaves versionadas. Ao criar uma nova chave, inclua-a no `backupManager.js` se ela representar dados do usuário que precisam ser exportados.

| Chave | Módulo/tela | Conteúdo |
|---|---|---|
| `sc_ore_vault_v1` | `oreVault.js` / `OreVaultPage` | Entradas do baú de minério. |
| `sc_clan_vault_v1` | `clanVault.js` | Entradas do cofre do clã. |
| `sc_mining_group_v1` | `MiningGroupPage` | Sessões de mineração em grupo. |
| `sc_mining_builds_v1` | `MiningPage` | Builds de mineração. |
| `sc_missions_v2` | `MissionTrackerPage` | Missões. |
| `sc_obj_library_v1` | `MissionTrackerPage` | Biblioteca de objetivos. |
| `sc_daily_losses_v1` | `MissionTrackerPage` | Valores que saíram da carteira. |
| `sc_notes_v1` | `NotesPage` | Notas livres. |
| `sc_uex_texts_v1` | `NotesPage` | Textos UEX reutilizáveis. |
| `sc_wikelo_missions_v1` | `WikeloTrackerPage` | Missões e progresso Wikelo. |
| `sc_material_queue_v1` | `materialQueue.js` | Blueprints na fila e materiais coletados. |
| `sc_material_priority_order_v1` | `materialQueue.js` | Ordem manual do tracking. |
| `sc_locations_admin_v1` | `locations.js` | Locais administráveis. |
| `sc_uex_sales_v1` | `uexSales.js` | Vendas registradas. |
| `sc_uex_catalog_v1` | `uexSales.js` | Catálogo/sincronização de anúncios. |
| `sc_uex_negotiation_reviews_v1` | `uexNegotiationReviews.js` | Avaliações de negociações. |
| `sc_uex_negotiation_closures_v1` | `uexSales.js` | Fechamentos de negociações. |
| `sc_uex_token_v1` | `uexNegotiations.js` / `UexApiPage` | Token UEX sensível. |
| `sc_uex_secretkey_v1` | `uexNegotiations.js` | Secret key UEX sensível. |
| `sc_uex_username_v1` | `uexNegotiations.js` | Usuário UEX. |
| `sc_uex_notif_state_v1` | `uexNegotiations.js` | IDs vistos e último polling. |
| `sc_google_translate_api_key_v1` | `uexNegotiations.js` | Chave opcional do Google Translate. |
| `sc_uex_items_db_v1` | `uexItemsDB.js` | Catálogo local de itens UEX. |
| `sc_uex_locations_db_v1` | `uexLocationsDB.js` | Locais sincronizados da UEX. |
| `sc_uex_mining_db_v1` | `uexMiningDB.js` | Minérios sincronizados da UEX. |
| `sc_inventory_v1` | fallback browser do inventário | Fallback quando não existe Electron. |
| `sc_provenance_v1` | `provenance.js` | Procedência de dados. |
| `sc_nav_collapsed_groups_v1` | `App.js` | Grupos recolhidos da sidebar. |
| `sc_sidebar_collapsed_v1` | `App.js` | Estado recolhido/expandido da sidebar. |
| `sc_data_override_*` | `dataStore.js` / `DataEditorPage` | Datasets editados pelo usuário. |

A chave `sc_inventory_v1` é o fallback do navegador. No Electron, `InventoryPage` usa os métodos `inventoryGetAll`, `inventoryCreate`, `inventoryUpdate`, `inventoryDelete` e `inventoryGetStats`, que persistem no SQLite.

## 9. Módulos de domínio em `src/data`

| Arquivo | Funções e regras principais | Onde procurar para corrigir |
|---|---|---|
| `backupManager.js` | Backup seletivo, categorias, validação e restauração. | Nova chave não aparece no backup: atualizar `BACKUP_CATEGORIES`. |
| `cargoUnits.js` | Conversão de SCU, cSCU, mSCU e μSCU; parser pt-BR; formatação. | Erro de soma ou unidade: corrigir aqui, não em cada tela. |
| `clanVault.js` | CRUD do cofre do clã e consumo de quantidade. | Quantidade ou status do cofre compartilhado. |
| `dataStore.js` | Fallback genérico para datasets por `sc_data_override_`. | Dataset editável não salva ou não reseta. |
| `dchsCards.js` | Catálogo dos sete cartões DCHS e cálculo de hangares. | Regra de conjunto/hangar executivo. |
| `locations.js` | Seed de locais, tipos, sistemas, CRUD e opções compartilhadas. | Seletores de local, sistema ou tipo. |
| `materialQueue.js` | Fila de blueprints, coleta, prioridade, qualidade e lista de compras. | Tracking não calcula falta ou mistura qualidade. |
| `oreColors.js` | Cor estável por minério e variações de fundo/borda. | Cores do baú e tracking. |
| `oreVault.js` | CRUD, transferência, qualidade mínima, matching e dedução. | Baú não encontra ou não deduz minério. |
| `provenance.js` | Marca a origem: seed, custom, UEX, SCMDB etc. | Badge ou procedência incorreta. |
| `uexArmorImport.js` | Normaliza catálogo de armaduras da UEX. | Importação de armaduras UEX. |
| `uexItemsDB.js` | Catálogo UEX, normalização de nomes/números e média de preço. | Autocomplete ou “Importar preço”. |
| `uexLocationsDB.js` | Catálogo de locais UEX e árvores de localização. | Dados sincronizados da UEX. |
| `uexMiningDB.js` | Catálogo de minérios UEX. | Sincronização de mineração. |
| `uexNegotiationReviews.js` | Avaliações locais e mensagem de fechamento. | Review ou registro de negociação concluída. |
| `uexNegotiations.js` | Token, endpoints, polling, IDs vistos, deduplicação e tradução. | Sino, chat e tradução. |
| `uexSales.js` | Vendas, catálogo, fechamento e conversão negociação→venda. | Acompanhamento UEX. |
| `wikelo.js` | Normalização de scripts, proporção e favors. | Cálculo Wikelo/Council/Mg Scrip. |

## 10. Regras de negócio importantes

### 10.1 Conversão de carga

A unidade interna de `cargoUnits.js` é cSCU, para manter compatibilidade com o tracking antigo.

```text
1 SCU   = 100 cSCU
1 SCU   = 1.000 mSCU
1 SCU   = 1.000.000 μSCU
1 cSCU  = 0,01 SCU
```

Os fatores para a base cSCU são:

| Unidade de entrada | Multiplicador para cSCU |
|---|---:|
| SCU | 100 |
| cSCU | 1 |
| mSCU | 0,1 |
| μSCU | 0,0001 |

`parseCargoInput()` aceita ponto ou vírgula. Quando recebe `12.911` com uma unidade de carga, interpreta o ponto como separador de milhares e converte para 12.911 cSCU, não para 12,911 cSCU. Para corrigir conversões, altere `normalizeCargoUnit`, `toCargoBase`, `fromCargoBase`, `parseCargoInput` e `cargoEquivalentTotal`.

`cargoInputStep()` define o incremento mínimo dos campos. Não implemente conversões paralelas em `OreVaultPage`, `MaterialTrackerPage` ou `TransferModal`.

### 10.2 Baú de minério e tracking

`oreVault.js` persiste entradas com material, quantidade, unidade, qualidade, sistema, tipo de local, local e notas. `findVaultMatches(materialName, qualityMin)` considera somente material compatível e qualidade suficiente. A qualidade abaixo do mínimo de uma blueprint não pode satisfazer a exigência.

`materialQueue.js` usa uma chave composta por material e qualidade mínima. Isso mantém, por exemplo, Iron sem requisito separado de Iron com qualidade mínima 800. `MaterialTrackerPage` mostra necessário, já possuído e faltante; a ordem manual é gravada em `sc_material_priority_order_v1`.

Ao concluir o consumo de uma blueprint, `MaterialTrackerPage` monta uma lista de usos e chama `deductOreEntries()` em `oreVault.js`. Se a operação for alterada, preserve a atomicidade lógica: calcule os matches, confirme que a quantidade total existe e só então deduza as entradas.

### 10.3 Inventário

`InventoryPage.js` possui autocomplete de itens UEX, controles compactos de `+` e `−`, modal de edição, transferência por sistema/tipo/local e normalização de `craft_status`. A função `normalizeCraftStatus()` deve sempre transformar dados antigos em array antes de chamar `.map()`.

A função “Importar preço” procura o item no catálogo local criado por `UexApiPage`. `uexItemsDB.js` normaliza caracteres, nomes e números antes de buscar `average_buy`/média equivalente. Quando esse cálculo falhar, investigue primeiro `normalizeUexItemName`, `normalizeUexNumber`, `searchUexItems` e `getUexItemAveragePrice`.

PAF usa `Laser Activation Keycard` como um PAF completo. Wikelo considera Favors diretos e scripts, com `SCRIPT_RATIO = 50`. DCHS usa o menor estoque entre os sete cartões requeridos; cada conjunto de um cartão de cada tipo representa um hangar executivo. Essas regras ficam, respectivamente, em `InventoryPage.js`/`DashboardPage.js`, `src/data/wikelo.js` e `src/data/dchsCards.js`.

### 10.4 Blueprints e SCMDB

`BlueprintPage.js` normaliza o JSON do SCMDB em `normalizeScmdbBackup()`, marca a origem e diferencia blueprint importada que ainda não possui ingredientes preenchidos. O filtro “com materiais” usa `hasBlueprintMaterials()`.

A fila de crafting é compartilhada entre `BlueprintPage`, `MaterialTrackerPage` e `src/data/materialQueue.js`. Uma alteração em nomes de campos da blueprint deve ser refletida nos três pontos.

### 10.5 Missões e loot

`MissionTrackerPage.js` mantém três chaves: missões, biblioteca de objetivos e perdas diárias. O status `Saiu da carteira` representa valor negativo e não deve ser somado como recompensa. O modal de loot implementa os modos divisão igual, porcentagem manual e divisão manual. Para alterar a matemática, procure `LootDistributionModal`, `LootPanel` e as funções de resumo diário.

### 10.6 Wikelo

`src/data/wikelo.js` normaliza aliases de `Mg Scrip`, `Council Scrip` e `Wikelo Favor`. O cálculo deve considerar:

```text
Favors totais = favors diretos no inventário
              + floor(Mg Scrip / 50)
              + floor(Council Scrip / 50)
```

Se o comportamento desejado for calcular os tipos de script separadamente, use `calcScriptFavors(items, scriptName)` em vez de duplicar a fórmula na Dashboard.

### 10.7 UEX

A base documentada usada pela proxy é `https://api.uexcorp.uk/2.0`. A função `uexRequest()` monta a URL, adiciona Bearer token, secret key e faz requisições HTTPS. Não altere endpoints sem conferir a documentação UEX e sem testar o retorno real.

`uexNegotiations.js` consulta `marketplace_negotiations`, `marketplace_negotiations_messages` e `user_notifications`. A deduplicação possui três camadas: identidade por ID, fallback por data/usuário/texto e `isCrossFeedDuplicate()` para eliminar a mesma mensagem publicada no feed de negociação e no feed geral.

O polling atual não é um WebSocket. Para alterar frequência, busca incremental ou notificações, procure `UexNotificationBell.js` e `checkForUpdates()` em `uexNegotiations.js`.

A tradução usa MyMemory gratuitamente primeiro. Google Cloud Translation é somente fallback e exige chave salva em `sc_google_translate_api_key_v1`. O endpoint de tradução fica em `electron/main.js`; a composição bilíngue da tela fica em `UexNegotiationsPage.js`.

### 10.8 Locais

`locations.js` é a única fonte compartilhada para locais administráveis. `buildManagedLocationOptions()` retorna:

```js
{
  key,
  label,
  system,
  location_type,
  location_name
}
```

Inventário, transferência de itens e baú devem usar essa função ou os helpers derivados dela. Não crie uma lista estática paralela dentro de uma tela. A administração fica em `LocationsAdminPage.js`; a persistência é `sc_locations_admin_v1`.

## 11. Backup e restauração

Existem dois fluxos distintos.

### Backup seletivo — `BackupPage` e `backupManager.js`

O backup seletivo exporta categorias escolhidas do localStorage e blueprints customizadas por IPC. As categorias estão em `BACKUP_CATEGORIES`. Ele cobre missões, notas, mineração, tracking, baú, cofre, locais, Wikelo, UEX e overrides de datasets.

Armaduras e Inventário de Itens não fazem parte do backup seletivo porque vivem no SQLite. Para adicionar uma categoria localStorage, inclua a chave em `BACKUP_CATEGORIES`, teste `countCategoryItems()` e confirme a restauração em `restoreBackup()`.

Backups legados continuam sendo aceitos pela validação de `readBackupFile()`, mas os novos nomes usam a identidade Companheiro Emoto.

### Backup completo — `DataDirectoryPage` e `main.js`

O backup completo exporta todas as chaves presentes no localStorage, copia o arquivo SQLite e registra metadados do diretório. A restauração pode exigir reinício porque o processo principal precisa fechar o banco em memória e reabri-lo.

A importação valida `app`, `format` e a estrutura localStorage. O nome do `.db` é reduzido ao basename e precisa estar junto do JSON para impedir que um arquivo de backup aponte para um caminho arbitrário do computador.

Para transportar o projeto para outro computador, copie o JSON e o `.db` juntos. Não compartilhe backups que contenham token UEX, secret key ou chave Google.

## 12. Datasets editáveis

`DataEditorPage.js` mantém cópias editáveis em chaves com prefixo `sc_data_v2_`. Os datasets registrados são:

| Chave | Grupo | Uso |
|---|---|---|
| `trade_commodities` | Trade Hub | Commodities, compra, venda e legalidade. |
| `mining_ores` | Mineração | Minérios, valor, raridade, risco e notas. |
| `mining_lasers` | Mineração | Lasers, potência, alcance e instabilidade. |
| `dps_ships` | Calculadora DPS | Hull, shields, cargo, crew e hardpoints. |
| `dps_weapons` | Calculadora DPS | Dano, alpha, cadência, alcance e consumo. |
| `cargo_ships` | Cargo Loader | Capacidade SCU das naves. |
| `market_locations` | Market Finder | Lojas, serviços e localização. |

O reset remove o override e faz o dataset voltar ao fallback embutido. Ao adicionar um dataset, atualize `ALL_DATASETS`, `GROUPS_ORDER`, os campos aceitos e a tela consumidora.

## 13. Guia de manutenção por problema

| Sintoma | Primeiro arquivo | Segundo ponto | Causa provável |
|---|---|---|---|
| Tela não aparece no menu | `src/App.js` | `NAV_GROUPS` e switch final | Página existe, mas não foi roteada por `activePage`. |
| Erro `X is not defined` | Página que aparece no stack trace | Imports de `lucide-react` | Ícone usado sem importação. |
| Erro `.map is not a function` | Normalizador da tela | Dados antigos do localStorage/SQLite | Campo persistido com objeto/string em vez de array. |
| Erro de IPC inexistente | Página | `preload.js` e `main.js` | Nome, canal ou payload divergente. |
| Armadura não salva posse | `main.js` handlers `toggle-piece` | Schema `user_pieces` | Posse fica em `user_pieces`, não em `armor_pieces`. |
| Quantidade de armadura falha | `update-piece-quantity` | Schema SQLite | Handler referencia coluna que não existe. |
| Inventário perde dados | `InventoryPage.js` | `inventory-*` em `main.js` | Confusão entre fallback localStorage e SQLite. |
| Preço UEX não importa | `uexItemsDB.js` | `UexApiPage.js` | Nome normalizado ou média com formato numérico inesperado. |
| Unidade SCU errada | `cargoUnits.js` | `OreVaultPage`, `MaterialTrackerPage`, `TransferModal` | Conversão duplicada ou unidade não normalizada. |
| Tracking mistura qualidades | `materialQueue.js` | `oreVault.js` | Material foi agrupado sem `qualityMin`. |
| “Concluir do baú” deduz errado | `MaterialTrackerPage.js` | `deductOreEntries()` | Lista de usos ou unidades incompatíveis. |
| Local aparece em uma tela e não em outra | `locations.js` | `buildManagedLocationOptions()` | Tela criou lista estática paralela. |
| Mensagem UEX duplicada | `uexNegotiations.js` | `UexNotificationBell.js` | Identidade ou deduplicação cruzada incompleta. |
| Chat não atualiza | `UexNotificationBell.js` | `checkForUpdates()` | Polling, token, timestamp ou endpoint. |
| Tradução falha | `uexNegotiations.js` | `electron/main.js` | Limite MyMemory ou chave Google ausente. |
| Backup não inclui novo dado | `backupManager.js` | `DataDirectoryPage.js` | Chave não está em `BACKUP_CATEGORIES` ou só existe no SQLite. |
| Banco não abre | `electron/main.js` | `dbPath`, `sql.js`, `saveDb()` | Caminho, arquivo corrompido ou WASM não localizado. |
| Instalador Windows falha | `package.json` | ambiente Windows, certificado e electron-builder | Dependências, Wine ausente no cross-build ou assinatura. |

## 14. Como adicionar uma nova função

### Função somente de interface

Crie ou edite a página em `src/pages`, importe o componente no `App.js`, adicione um item em `NAV_GROUPS` e inclua a condição no switch de renderização. Estilos específicos devem ficar em `App.css`, evitando estilos inline repetidos quando o layout for compartilhado.

### Função que salva localStorage

Defina uma chave versionada, crie funções `load`, `save`, `normalize` e `reset` em `src/data`. Use `try/catch` no carregamento para tolerar dados antigos. Inclua a chave no `backupManager.js`. Atualize a documentação da tabela de chaves neste README.

### Função que salva SQLite

Adicione a tabela ou coluna em `initDatabase()`, crie migração compatível com bancos existentes, crie handlers IPC em `main.js`, exponha métodos nomeados em `preload.js` e consuma `window.electronAPI` na página. Depois de cada mutação, chame `saveDb()`.

### Novo endpoint UEX

Não faça a chamada HTTP diretamente na página. Adicione uma função específica em `main.js`, valide o payload, use HTTPS e o User-Agent do aplicativo, exponha um método específico no preload e crie uma função de domínio em `uexNegotiations.js` ou módulo UEX correspondente. Preserve a base `https://api.uexcorp.uk/2.0` e não altere endpoints não documentados sem validação.

### Novo tipo de local

Adicione o valor a `LOCATION_TYPES` em `locations.js`, ajuste a inferência somente se necessário e teste `LocationsAdminPage`, Inventário, transferência e Baú. Não altere o formato de retorno de `buildManagedLocationOptions()` sem revisar todos os consumidores.

## 15. Procedência dos dados

`provenance.js` guarda a origem dos registros em `sc_provenance_v1`. As fontes devem ser usadas para diferenciar seed inicial, cadastro manual, UEX, SCMDB, importação e atualização do usuário.

`App.js` registra sets seeded e customizados após `getAllSets()`. Para novos catálogos importados, use `setProvenance()` ou `setBatchProvenance()` no ponto em que os dados entram, não apenas no componente visual.

## 16. Segurança e limites

O renderer não possui acesso direto ao sistema. O preload expõe somente operações conhecidas. Não use `contextBridge.exposeInMainWorld` para expor `ipcRenderer.send` genericamente, não aceite caminhos arbitrários sem validação e não coloque tokens no código-fonte.

Os tokens UEX e a chave Google são armazenados no localStorage do usuário e entram no backup completo e na categoria sensível do backup seletivo. Um backup deve ser tratado como arquivo privado.

O app usa requisições externas para UEX, MyMemory e opcionalmente Google Translation. Erros de rede devem retornar mensagens tratáveis, sem travar o renderer. A documentação de segurança e falso positivo fica em `SEGURANCA_AVAST.md`.

Para reduzir alertas de reputação no Windows, distribua builds assinadas com certificado real de código. O `publisherName` apenas identifica o editor; ele não substitui a assinatura. Mantenha o `appId` `com.sctracker.armor` estável se já houver usuários instalados, pois alterar o identificador pode quebrar reconhecimento de atualização e desinstalação.

## 17. Empacotamento Windows

O bloco `build` do `package.json` possui as decisões atuais:

```json
{
  "main": "electron/main.js",
  "build": {
    "appId": "com.sctracker.armor",
    "productName": "Companheiro Emoto",
    "artifactName": "Companheiro-Emoto-${version}.${ext}",
    "asar": true,
    "files": [
      "build/**/*",
      "electron/**/*",
      "!**/CompanheiroEmoto{,/**/*}",
      "!**/backup{,/**/*}",
      "!**/*.map"
    ],
    "win": {
      "target": ["nsis", "zip"],
      "icon": "electron-icons/icon.ico",
      "requestedExecutionLevel": "asInvoker",
      "publisherName": "Companheiro Emoto"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

Os dados do usuário não entram no ASAR nem no instalador. O `files` inclui o build React e o processo Electron, enquanto a pasta `CompanheiroEmoto` é criada em runtime.

No pipeline de release, mantenha separados:

| Item | Deve ser versionado? | Motivo |
|---|---|---|
| `src`, `electron`, `public` | Sim | Código-fonte. |
| `package.json`, `package-lock.json` | Sim | Build reproduzível. |
| `electron-icons/icon.ico` | Sim | Recurso do executável. |
| `node_modules` | Não | Reinstalado pelo npm. |
| `build` | Normalmente não | Gerado pelo React. |
| `dist` | Não | Gerado pelo electron-builder. |
| `CompanheiroEmoto` | Nunca | Dados privados do usuário. |
| `.env`, `.pfx`, `.p12`, `.key` | Nunca | Segredos e certificados. |

## 18. Validação antes de entregar uma correção

Execute a sequência abaixo no Windows:

```powershell
# Validar sintaxe dos dois processos Electron
node --check electron/main.js
node --check electron/preload.js

# Validar dependências de produção
npm audit --omit=dev --audit-level=high

# Compilar renderer
npm run react-build

# Gerar instalador e ZIP Windows
npm run build:win
```

Depois, teste manualmente uma instalação limpa e uma atualização sobre uma instalação com dados. Confirme que o diretório `CompanheiroEmoto` não foi apagado, que o SQLite continua legível, que o localStorage reaparece e que a tela **Sistema → Diretório de Dados** mostra o caminho esperado.

Ao alterar IPC, reinicie o Electron completamente. Hot reload do React não reinicializa necessariamente o preload nem o processo principal.

## 19. Checklist de revisão de pull request

| Área | Pergunta de revisão |
|---|---|
| Roteamento | A nova página foi adicionada a `NAV_GROUPS` e ao switch de `App.js`? |
| Persistência | A chave ou coluna foi documentada e possui migração/normalização? |
| Backup | O novo dado está coberto pelo backup correto? |
| IPC | O nome e o payload são iguais em página, preload e main? |
| Unidades | A mudança usa `cargoUnits.js` em vez de uma fórmula local? |
| Locais | O código usa `locations.js` em vez de lista estática? |
| UEX | O endpoint é documentado, HTTPS e tratado com erro? |
| Segurança | Nenhum segredo foi incluído no repositório ou no build? |
| Compatibilidade | Dados antigos continuam carregando sem `.map`/`JSON.parse` quebrar? |
| Build | `npm run react-build` e `npm run build:win` foram executados? |
| Dados | A atualização não modifica nem remove `CompanheiroEmoto`? |

## 20. Referências oficiais

[1]: https://www.electronjs.org/docs/latest/tutorial/context-isolation "Electron — Context Isolation"
[2]: https://sql.js.org/ "SQL.js — SQLite compiled to JavaScript"
[3]: https://www.electron.build/docs/configuration "electron-builder — Configuration"
[4]: https://www.electron.build/docs/nsis "electron-builder — NSIS"

## 21. Histórico técnico resumido

O projeto passou por correções de normalização de nomes UEX, controles de quantidade do inventário, responsividade dos cards, identidade visual das notas, cores de minérios, cálculo PAF, tradução bilíngue no chat UEX, deduplicação de notificações, tracking por qualidade, ordenação manual, transferência entre locais, conversões de carga, centralização de dados e empacotamento Windows-only.

Ao fazer manutenção futura, preserve as regras centrais: **uma única fonte para conversões de carga, uma única fonte para locais, qualidade mínima separada no tracking, IPC explícito, backup compatível e banco SQLite migrado sem perda de dados**.


## 22. Hangar de Naves

A seção **Hangar de Naves** está em `src/pages/ShipHangarPage.js` e usa `src/data/uexVehicles.js`. Ela aparece no grupo **UEX** do `src/App.js` com o identificador `shiphangar`.

### Catálogo Naves UEX

A aba **Naves UEX** consulta pela proxy HTTPS os endpoints documentados `vehicles`, `vehicles_purchases_prices_all` e `vehicles_rentals_prices_all`. O catálogo exibe nome, nome completo, fabricante, tipo de veículo, funções, carga em SCU, tripulação, dimensões, pad, combustível, links externos e os locais/preços de compra e aluguel disponíveis.

Os filtros ficam em `ShipHangarPage.js`, no `useMemo` que monta `vehicles`. A busca procura por nome, nome completo, fabricante e slug. O filtro de tipo separa naves e veículos terrestres; o filtro de função usa as flags `is_cargo`, `is_mining`, `is_salvage`, `is_medical`, `is_exploration`, `is_military`, `is_passenger` e `is_ground_vehicle`. A ordenação pode ser alternada entre nome, carga e tripulação.

A busca detalhada de uma nave usa `vehicles_purchases_prices?id_vehicle=...` e `vehicles_rentals_prices?id_vehicle=...` somente quando o card é expandido. Essa decisão evita uma chamada individual para cada veículo durante a sincronização geral. O módulo normaliza números ausentes para `null`, e a interface apresenta `—` quando a UEX não fornece determinada informação.

### Imagens da UEX

O campo `url_photo` recebido pela UEX é renderizado pelo componente `UexVehicleImage`. No Electron, a imagem passa por `window.electronAPI.uexImage()`, exposta em `electron/preload.js` e tratada pelo handler `uex-image` em `electron/main.js`. O handler permite somente HTTPS, o host oficial `assets.uexcorp.space` e caminhos `/img/`, evitando uma proxy aberta. Ele envia os headers necessários, transforma a resposta em `data URL` e aplica limite de 10 MB. Quando a imagem não pode ser carregada, o card mostra o ícone de nave como fallback.

### Meu Hangar

A aba **Meu Hangar** é um registro local; ela não realiza transações na UEX. O botão **Comprei** abre um modal que solicita somente a quantidade da nave e observações opcionais. A aplicação não pergunta mais em qual local ou hangar a nave está. Ao confirmar, `addToMyHangar()` salva a aquisição em `sc_hangar_v1`, agrupando registros pela origem e pelo veículo e somando a quantidade quando a mesma nave é registrada novamente.

Cada registro do Meu Hangar contém, quando disponível, `vehicleId`, `vehicleName`, `manufacturer`, `source`, `quantity`, `acquiredAt`, `notes`, `image`, `scu`, `crew` e `slug`. A aba permite aumentar ou reduzir a quantidade, editar observações e remover o registro. O componente `HangarEntry` exibe a origem `COMPRADA` ou `WIKELO`, sem exibir campo de local/hangar.

### Naves recebidas pelo Wikelo

O botão **Nave do Wikelo** abre um formulário manual para nome, fabricante, quantidade, carga em SCU e observações. O registro é salvo com `source: 'wikelo'` e aparece separado visualmente das naves compradas. Essa entrada manual é necessária porque o acompanhamento Wikelo existente registra missões e recompensas, mas não possui um catálogo estruturado de naves recebidas para importação automática.

### Escopo removido e persistência

A Pledge Store não faz parte do Hangar. O módulo não consulta mais `vehicles_prices`, não mantém `pledgePrices`, não importa `getPledgeRows()` e não exibe preços, Warbond, pacotes ou status de oferta. A sincronização se limita ao catálogo, à compra in-game e ao aluguel in-game.

O catálogo sincronizado fica em `sc_uex_vehicles_catalog_v1` e o Meu Hangar fica em `sc_hangar_v1`. As duas chaves estão incluídas na categoria `Hangar de Naves / Meu Hangar` do backup seletivo. O backup completo já inclui automaticamente essas chaves por exportar todas as entradas do localStorage. Os endpoints, campos e regras de compatibilidade estão registrados em `UEX_VEHICLES_API_NOTES.md`.

A API UEX é mantida pela comunidade e pode não representar exatamente o estado atual dos servidores. Por isso, o código preserva a data da última sincronização, trata campos ausentes como `null`/`—` e não inventa preço, local, carga ou característica que não esteja na resposta da API.
