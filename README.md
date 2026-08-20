# Companheiro Emoto — Manual Técnico do Projeto

> **Objetivo deste documento:** permitir que outro programador consiga instalar, executar, entender, corrigir, estender e empacotar o Companheiro Emoto sem depender do histórico de desenvolvimento.

O **Companheiro Emoto 2.0.0** é um aplicativo desktop para Windows construído com Electron e React para acompanhar dados de Star Citizen. A versão 2.0.0 adiciona uma camada visual opcional com PixiJS 8 para efeitos espaciais e HUD futurista, mantendo os componentes funcionais em React/HTML. Ele reúne rastreamento de armaduras, coleção, inventário de itens, blueprints, materiais para crafting, baú de minério, mineração, missões, cofre de clã, Wikelo, marketplace UEX, notas, locais administráveis, calculadora e ferramentas de backup.

O projeto é um aplicativo Electron: o React representa a interface; o processo principal do Electron controla a janela, o banco SQLite em memória, o acesso ao sistema de arquivos, a proxy HTTPS da UEX, as traduções e os backups; o `preload.js` expõe uma API IPC limitada ao renderer. Essa separação usa `contextIsolation`, `contextBridge`, `nodeIntegration: false` e sandbox no renderer. O `contextBridge` é a forma recomendada pelo Electron para expor APIs específicas do preload sem entregar APIs poderosas diretamente à página carregada [1].

## 1. Tecnologias e responsabilidades

| Camada | Tecnologia | Responsabilidade principal |
|---|---|---|
| Interface | React 18 | Renderização das páginas, formulários, cards, modais, filtros e estado visual. |
| Shell da aplicação | `src/App.js` | Menu lateral, navegação por estado, carregamento inicial de armaduras, integração dos widgets globais e montagem das páginas. |
| Processo principal | Electron 43.4.0 / `electron/main.js` | Janela, ciclo de vida, SQLite, IPC, migração de dados, diretório central, proxy UEX, tradução MyMemory, anexos e monitor do Game.log. |
| Ponte segura | `electron/preload.js` | Contrato explícito entre React e Electron por `window.electronAPI`. Não deve conter regras de negócio. |
| Banco relacional | `sql.js` | SQLite compilado para JavaScript/WebAssembly, carregado em memória e exportado para um arquivo `.db` a cada persistência. A biblioteca permite importar um arquivo SQLite e exportar o banco como buffer [2]. |
| Persistência leve | `localStorage` | Missões, mineração, baú de minério, tracking, notas, UEX, Wikelo, locais e datasets editáveis. |
| Empacotamento | `electron-builder` | Geração de instalador NSIS e ZIP exclusivamente para Windows. |
| Ícones | `lucide-react` + `electron-icons/icon.ico` | Ícones da interface e ícone do aplicativo Windows. |
| Estilos | `src/App.css` | Tema escuro sci-fi, grids, responsividade, cards, sidebar, modais e componentes compartilhados. |
| Efeitos visuais | `pixi.js` 8 | Canvas 2D acelerado para estrelas e ambientação espacial decorativa. A camada não recebe cliques nem armazena dados. O antigo Grid Scan foi removido. |
| Microanimações | `gsap` + componentes inspirados em React Bits | Entradas de páginas, faíscas de clique, foco futurista, feedback de ações e transições suaves. Os componentes são locais e modulares, conforme a filosofia do React Bits. |

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
│   ├── main.js                 Processo principal Electron, SQLite, IPC, anexos e diretório central
│   ├── preload.js              API segura exposta ao renderer
│   └── missionWatcher.js       Leitura controlada do Game.log e eventos de missões
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
│   ├── components/             Widgets globais, PixiVisualLayer, ErrorBoundary, ajuda contextual, anexos, calculadora e sininho
│   ├── data/                   Regras de domínio, persistência local e eventos entre telas
│   └── pages/                  Telas funcionais do aplicativo
├── scripts/
│   └── generate_windows_icon.py  Gera icon.ico a partir do PNG
├── package.json                Scripts, dependências e electron-builder
├── package-lock.json           Versões resolvidas das dependências
├── CENTRALIZACAO_DADOS.md      Manual da pasta de dados centralizada
├── SEGURANCA_AVAST.md          Auditoria de segurança e distribuição
├── DESENVOLVIMENTO.md          Guia complementar de arquitetura e manutenção
├── manual usuario.md           Manual de uso para usuário final
└── README.md                   Este manual técnico
```

### Arquivos presentes, mas fora do fluxo principal atual

`src/pages/DataEditorPage.js`, `src/pages/MarketFinderPage.js` e `src/pages/TradeHubPage.js` existem no repositório, mas atualmente não aparecem no `NAV_GROUPS` nem no switch de renderização de `src/App.js`. Antes de considerar uma dessas telas funcional no aplicativo, adicione o item de navegação e a condição correspondente no switch.

`src/pages/materialQueue.js` é um helper legado. O arquivo canônico usado por `BlueprintPage` e `MaterialTrackerPage` é `src/data/materialQueue.js`. Não duplique correções nos dois arquivos sem confirmar quais importações existem.

## 4. Camada visual PixiJS 8 da versão 2.0.0

`src/components/PixiVisualLayer.js` cria uma camada visual independente do conteúdo React. O ticker usa uma instância independente de `Ticker` para manter compatibilidade com ambientes em que `Application.ticker` não é exposto. Ela utiliza `Application.init()` de forma assíncrona, redimensiona o canvas ao espaço da janela e destrói o renderer ao desmontar ou trocar o modo visual. O canvas usa `pointer-events: none`, portanto não bloqueia a sidebar, os formulários, os cards nem os modais.

A interface possui três modos persistidos em `localStorage`:

| Modo | Uso | Custo esperado |
|---|---|---:|
| Desligado | Remove completamente os efeitos | Mínimo |
| Econômico | Campo reduzido de estrelas, HUD discreto e ticker limitado | Baixo |
| Imersivo | Mais partículas e HUD mais visível | Moderado |

O modo pode ser alternado pelo botão no rodapé da barra lateral. O PixiJS deve permanecer destinado a ambientação visual; textos, inputs, tabelas, filtros, acessibilidade e regras de negócio continuam no React. Não coloque milhares de registros do Inventário ou das Armaduras dentro do canvas.

Para futuras alterações, preserve estas regras: destrua a instância Pixi no cleanup do `useEffect`, limite o FPS para efeitos decorativos, não use filtros pesados globalmente, mantenha `pointer-events: none` no canvas e forneça sempre um fallback funcional com o modo desligado.

A integração inspirada no React Bits é modular e local: `AnimatedContent.js` usa GSAP e IntersectionObserver para entradas, `InteractionFX.js` cria faíscas curtas em cliques, `BorderGlowController.js` administra o brilho contextual de bordas, `GlareProfileController.js` administra tilt/glare em Inventário e Hangar, `ContextualSpotlightController.js` mostra um spotlight ciano suave atrás do elemento sob o cursor e `CalculatorWidget.js` concentra magnetismo, tilt e ripple da Calculadora. Não aplique mais de dois ou três efeitos fortes na mesma tela. Respeite `prefers-reduced-motion` e mantenha as microinterações fora das listas de milhares de registros.

## 5. Arquitetura de execução

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
| Itens & Crafting | `inventory` | `InventoryPage.js` | Inventário de itens, autocomplete UEX, preço médio, quantidade, locais, localização padrão para novos cadastros, busca global por sistema/local, scripts, PAF e transferência. |
| Itens & Crafting | `blueprints` | `BlueprintPage.js` | Blueprints, ingredientes, qualidade mínima, SCMDB, posse, wishlist e fila. |
| Itens & Crafting | `materials` | `MaterialTrackerPage.js` | Lista consolidada, prioridade por arrastar, estoque do baú, qualidade, consumo de blueprint, seletor de coleta cSCU/SCU com conversão automática e reset individual por minério. |
| Mineração | `mining` | `MiningPage.js` | Guia visual de builds de nave: seleção das peças equipadas e anotações, sem exibição de estatísticas numéricas de potência, alcance, extração ou capacidade. A antiga aba Naves & Módulos foi removida da página. |
| Mineração | `mininggroup` | `MiningGroupPage.js` | Sessões, grupo de mineração, refino, loot e armazenamento. |
| Mineração | `orevault` | `OreVaultPage.js` | Baú de minério, quantidade, unidade, qualidade, local, transferência e dedução. |
| Clã & Missões | `clanvault` | `ClanVaultPage.js` | Estoque compartilhado do clã, responsáveis, consumo e notas. |
| Clã & Missões | `missions` | `MissionTrackerPage.js` | Missões manuais e AUTO, monitor Game.log, recompensa pendente, MG/Council Scrip, ASD Secure Drive, despacho ao local padrão, reputação, tempo, perdas da carteira, loot com divisão igual/porcentagem/manual, botão de distribuição manual no card, modais de detalhes/edição, estatísticas, histórico, reset protegido e reaproveitamento por templates. |
| UEX | `uexsales` | `UexSalesPage.js` | Acompanhamento de vendas e anúncios UEX, estoque interno vinculado a múltiplos locais do Inventário/Baú de Minério, tendências, comparativos e botão individual para abrir cada anúncio. |
| UEX | `uexnegotiations` | `UexNegotiationsPage.js` | Negociações, chat, polling, tradução, notificações clicáveis, filtros de status, verificação de anúncio, gerenciador UEX, Spectrum, conclusão com quantidade/valor personalizados e registro de venda. |
| UEX | `wikelo` | `WikeloTrackerPage.js` | Missões Wikelo, scripts, favors, progresso proporcional, escaneamento, entrega transacional, remoção/reset por item e alocação compartilhada do estoque entre missões repetidas, com origem do local exibida. |
| UEX | `uexapi` | `UexApiPage.js` | Token, sincronização de itens, locais, mineração, médias UEX, veículos e catálogo local compartilhado com o Hangar. |
| UEX | `uexinsights` | `UexInsightsPage.js` | Inteligência de mercado, preços por qualidade, histórico, análise de lucro, ranking de oportunidades, frescor, busca/filtros de Refinarias por Commodity e terminal, frota e utilidades informativas. Os Alertas de Compra ficam em uma tela dedicada. |
| Sistema | `backup` | `BackupPage.js` | Backup seletivo e restauração de categorias do localStorage. |
| Sistema | `data-directory` | `DataDirectoryPage.js` | Pasta central, troca de diretório e backup completo. |
| Sistema | `notes` | `NotesPage.js` | Notas livres e textos UEX reutilizáveis. |
| UEX | `uexalerts` | `MarketAlertsPage.js` | Tela dedicada de Alertas de Compra, com filtros, análise automática, grupos de anúncios, deduplicação e links para ofertas. |
| Sistema | `system-admin` | `SystemAdminPage.js` | Tela consolidada com abas de Locais, Missões e Categorias; administra locais, facções, tipos, sistemas, categorias e subcategorias. `LocationsAdminPage.js`, `MissionAdminPage.js` e `InventoryTaxonomyAdminPage.js` funcionam embutidos nessa tela. |

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
| Tradução | `mymemoryTranslate(data)` | `mymemory-translate` | Tradução gratuita MyMemory, sem chave externa. |
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
| Notas | `notesSaveAttachment(payload)` | `notes-save-attachment` | Salva imagem/PDF em `notas-anexos` e retorna metadados. |
| Notas | `notesReadAttachment(name)` | `notes-read-attachment` | Lê anexo validado e retorna base64/data URL. |
| Notas | `notesDeleteAttachment(name)` | `notes-delete-attachment` | Remove o arquivo físico do anexo. |
| Notas | `notesOpenAttachment(name)` | `notes-open-attachment` | Abre o arquivo no programa padrão do Windows. |
| Notas | `notesDownloadAttachment(payload)` | `notes-download-attachment` | Copia o anexo para o caminho escolhido pelo usuário. |
| Monitor | `missionMonitorChooseLog()` | `mission-monitor-choose-log` | Abre seletor para o Game.log. |
| Monitor | `missionMonitorStart(path)` / `missionMonitorStop()` | `mission-monitor-start` / `mission-monitor-stop` | Liga ou desliga a leitura do log. |
| Monitor | `missionMonitorStatus()` | `mission-monitor-status` | Retorna estado, missão ativa, caminho e eventos recentes. |
| Monitor | `onMissionMonitorEvent(callback)` / `onMissionMonitorStatus(callback)` | eventos `mission-monitor-event` / `mission-monitor-status` | Assinaturas IPC com função de limpeza. |

## 7. Processo principal e diretório de dados

### 7.1 Arquivos persistentes

Na primeira execução, o aplicativo cria ou solicita uma pasta-pai e usa a pasta `CompanheiroEmoto` dentro dela. O padrão esperado no Windows é:

```text
C:\CompanheiroEmoto\
├── dados\
│   └── companheiro_emoto.db
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
7. Definir `dbPath` como `dataRoot\dados\companheiro_emoto.db`.

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

> **Atenção para manutenção:** o handler `update-piece-quantity` grava a quantidade em `user_pieces.quantity`, que é a tabela correta de estado do usuário. Não mova esse campo para `armor_pieces` sem uma decisão explícita de modelagem, pois o catálogo da peça deve permanecer separado da posse do jogador.

## 8. Persistência localStorage

A maior parte das telas usa chaves versionadas. Ao criar uma nova chave, inclua-a no `backupManager.js` se ela representar dados do usuário que precisam ser exportados.

| Chave | Módulo/tela | Conteúdo |
|---|---|---|
| `sc_ore_vault_v1` | `oreVault.js` / `OreVaultPage` | Entradas do baú de minério. |
| `sc_clan_vault_v1` | `clanVault.js` | Entradas do cofre do clã. |
| `sc_mining_group_v1` | `MiningGroupPage` | Sessões de mineração em grupo. |
| `sc_mining_builds_v1` | `MiningPage` | Builds de mineração. |
| `sc_missions_v2` | `MissionTrackerPage` | Missões manuais e AUTO, status, recompensa, reputação, tempo, loot e objetivos. |
| `sc_obj_library_v1` | `MissionTrackerPage` | Biblioteca de objetivos reutilizáveis. |
| `sc_daily_losses_v1` | `MissionTrackerPage` | Valores que saíram da carteira. |
| `sc_mission_admin_v1` | `missionAdmin.js` / `MissionAdminPage` | Facções, tipos de missão e sistemas administráveis. |
| `sc_mission_catalog_v1` | Compatibilidade legada do `missionAdmin.js` | Catálogo antigo migrado para `sc_mission_admin_v1`. |
| `sc_mission_auto_monitor_v1` | `missionAutoMonitor.js` / `MissionTrackerPage` | Estado do monitor, caminho do Game.log, missões ativas e até 300 eventos AUTO. |
| `sc_notes_v1` | `NotesPage` | Notas livres. |
| `sc_uex_texts_v1` | `NotesPage` | Textos UEX reutilizáveis. |
| `sc_wikelo_missions_v1` | `WikeloTrackerPage` | Missões e progresso Wikelo. |
| `sc_material_queue_v1` | `materialQueue.js` | Blueprints na fila e materiais coletados. |
| `sc_material_priority_order_v1` | `materialQueue.js` | Ordem manual do tracking. |
| `sc_locations_admin_v1` | `locations.js` | Locais administráveis. |
| `sc_uex_sales_v1` | `uexSales.js` | Vendas registradas. |
| `sc_uex_catalog_v1` | `uexSales.js` | Catálogo/sincronização de anúncios. |
| `sc_uex_market_alerts_v1` | `uexMarketAlerts.js` / `MarketAlertsPage` | Regras dos Alertas de Compra. |
| `sc_uex_market_alert_settings_v1` | `uexMarketAlerts.js` / `MarketAlertsPage` | Intervalo, limite, análise automática e preferências dos alertas. |
| `sc_uex_market_alert_events_v1` | `uexMarketAlerts.js` / `MarketAlertsPage` | Anúncios encontrados, agrupados e deduplicados. |
| `sc_uex_market_alert_dismissed_v1` | `uexMarketAlerts.js` | Grupos removidos da exibição. |
| `sc_uex_market_alert_focus_v1` | `uexMarketAlerts.js` / `MarketAlertsPage` | Grupo/oferta que deve receber foco ao abrir pela notificação. |
| `sc_uex_negotiation_reviews_v1` | `uexNegotiationReviews.js` | Avaliações de negociações. |
| `sc_uex_negotiation_closures_v1` | `uexSales.js` | Fechamentos de negociações. |
| `sc_uex_token_v1` | `uexNegotiations.js` / `UexApiPage` | Token UEX sensível. |
| `sc_uex_secretkey_v1` | `uexNegotiations.js` | Secret key UEX sensível. |
| `sc_uex_username_v1` | `uexNegotiations.js` | Usuário UEX. |
| `sc_uex_notif_state_v1` | `uexNegotiations.js` | IDs vistos, notificações deduplicadas e último polling. |
| `sc_uex_active_negotiation_v1` | `uexUiEvents.js` / `UexNotificationBell.js` | Identificador da conversa aberta durante a sessão; usado para não notificar mensagens já visíveis. Fica em `sessionStorage`. |
| `sc_uex_notif_sound_muted_v1` | `UexNotificationBell.js` | Preferência local para silenciar o som do sininho. |
| `sc_uex_items_db_v1` | `uexItemsDB.js` | Catálogo local de itens UEX. |
| `sc_uex_locations_db_v1` | `uexLocationsDB.js` | Locais sincronizados da UEX. |
| `sc_uex_mining_db_v1` | `uexMiningDB.js` | Minérios sincronizados da UEX. |
| `sc_uex_marketplace_averages_v1` | `uexMarketDB.js` / `uexInsights.js` | Médias de marketplace por item, qualidade, operação e moeda. |
| `sc_uex_marketplace_history_v1` | `uexInsights.js` | Histórico de snapshots de preço sob demanda. |
| `sc_uex_marketplace_trends_v1` | `uexInsights.js`, `UexInsightsPage.js` e `UexSalesPage.js` | Tendências, atividade, filtros, timestamp, ranking analítico e comparação de anúncios do catálogo. |
| `sc_uex_data_monitor_v1` | `uexInsights.js` | Frescor por terminal e tipo de dado. |
| `sc_uex_commodity_alerts_v1` / `sc_uex_commodity_averages_v1` / `sc_uex_commodity_status_v1` | `uexCommoditiesDB.js` | Alertas, médias e status de commodities. |
| `sc_uex_refineries_v1` / `sc_uex_refinery_jobs_v1` | `uexRefineriesDB.js` | Métodos, rendimentos, capacidades e jobs autenticados. |
| `sc_uex_fleet_v1` / `sc_uex_loaners_v1` | `uexInsights.js` / Hangar | Dados externos somente leitura de frota e loaners. |
| `sc_uex_item_attributes_v1` / `sc_uex_fuel_prices_v1` / `sc_uex_terminal_distances_v1` | `uexInsights.js` | Atributos técnicos, combustível e distâncias. |
| `sc_uex_vehicles_catalog_v1` | `uexVehicles.js` / `ShipHangarPage` | Catálogo local de naves e veículos sincronizado pela UEX API Live. |
| `sc_hangar_v1` | `uexVehicles.js` / `ShipHangarPage` | Naves compradas e naves adicionadas manualmente como Wikelo. |
| `sc_hangar_view_v1`, `sc_hangar_catalog_view_v1`, `sc_hangar_owned_view_v1` | `ShipHangarPage` | Preferências de visualização em cards/lista para o Hangar e catálogo. |
| `sc_inventory_v1` | fallback browser do inventário | Fallback quando não existe Electron. |
| `sc_provenance_v1` | `provenance.js` | Procedência de dados. |
| `sc_nav_collapsed_groups_v1` | `App.js` | Grupos recolhidos da sidebar. |
| `sc_sidebar_collapsed_v1` | `App.js` | Estado recolhido/expandido da sidebar. |
| `sc_data_override_*` | `dataStore.js` | Overrides consumidos pelos hooks de datasets. |
| `sc_data_v2_*` | `DataEditorPage.js` | Cópias editáveis mantidas pelo editor legado/independente; confira o prefixo antes de ajustar backup. |
| `sc_uex_texts_updated_v1` e `sc_uex_active_negotiation_changed_v1` | `uexUiEvents.js` | Eventos de sessão, não são registros de domínio. |

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
| `uexInsights.js` | Proxy GET compartilhada, snapshots, preços, histórico, monitor, commodities, refinarias, frota e utilidades. | Endpoint, credencial, formato de retorno ou frescor. |
| `uexMarketDB.js` | Compatibilidade para preço médio por item/qualidade usado pelo Inventário. | “Importar preço” e matching por `id_item`/nome. |
| `inventoryEvents.js` | Evento `sc_inventory_updated` para sincronização entre Inventário e Acompanhamento UEX. | Estoque interno não atualiza após editar inventário. |
| `uexUiEvents.js` | Eventos de negociação ativa e atualização dos Textos UEX. | Sininho continua notificando chat aberto ou atalhos não atualizam. |
| `uexCommoditiesDB.js` | Persistência de alertas, médias e status de commodities. | Cache e eventos de commodities. |
| `uexRefineriesDB.js` | Persistência de métodos, yields, capacidades e jobs. | Cache e eventos de refinarias. |
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

`uexNegotiations.js` consulta `marketplace_negotiations`, `marketplace_negotiations_messages` e `user_notifications`. A deduplicação possui três camadas: identidade por ID, fallback por data/usuário/texto e `isCrossFeedDuplicate()` para eliminar a mesma mensagem publicada no feed de negociação e no feed geral. O chat atualiza a thread a cada 5 segundos; o sininho global usa polling separado de 90 segundos. Quando uma thread está aberta, `UexNegotiationsPage.js` emite `UEX_ACTIVE_NEGOTIATION_EVENT`, e `UexNotificationBell.js` remove do contador, da lista e do som as mensagens daquela conversa.

O polling atual não é um WebSocket. Para alterar frequência, busca incremental ou notificações, procure `UexNegotiationsPage.js`, `UexNotificationBell.js` e `checkForUpdates()` em `uexNegotiations.js`. O chat também possui preview de mensagens novas, som local, tradução por mensagem, cópia do nick do comprador e caixa de resposta em português/inglês.

A tradução usa exclusivamente o MyMemory gratuito, sem chave externa. O handler `mymemory-translate` fica em `electron/main.js`, é exposto pelo preload e consumido por `uexNegotiations.js`; a composição bilíngue da tela fica em `UexNegotiationsPage.js`. A orientação para token UEX aponta para `https://uexcorp.space/account`.

### 10.8 UEX Insights e regras de integração

`UexInsightsPage.js` concentra as consultas adicionais documentadas da UEX. A tela foi separada da `UexApiPage.js` para não transformar a tela de sincronização básica em um painel excessivamente pesado. Ela fica no menu UEX com o identificador `uexinsights`. O conteúdo usa um container vertical próprio (`uex-insights-scroll`), mantendo cabeçalho e abas fixos enquanto tabelas, cards e gráficos descem com scrollbar.

A aba **Análise de lucro** consulta `marketplace_trends` por qualidade, moeda e nome, cruza preço médio de compra/venda, margem estimada, variação contra a média de 30 dias, anúncios ativos, negociações abertas/sucesso e os registros locais de `sc_uex_sales_v1`. Os registros locais são apenas referência de desempenho próprio e nunca são alterados pela consulta pública.

O ranking usa um score ajustado de 0 a 100, sem saturar todas as oportunidades em 100. O cálculo separa margem ajustada, liquidez, confiança da amostra, tendência, spread absoluto e penalidade de risco. Margens extremas, amostras pequenas, tendência negativa e baixo sucesso reportado recebem alertas. O usuário pode escolher as estratégias **Equilibrada**, **Maior margem**, **Mais liquidez**, **Menor risco** e **Maior valor por unidade**.

A tela permite filtrar por margem mínima/máxima, confiança, sucesso reportado, negociações, anúncios, risco, tendência, moeda, qualidade e existência de vendas locais. O modo **Agrupar qualidades** consolida o mesmo item e moeda quando a API devolve preços iguais em vários tiers, informa quantos tiers foram agrupados e mostra a consistência entre eles. Desativar o agrupamento permite auditar cada qualidade individualmente.

Os gráficos incluem ranking de oportunidades, dispersão margem × atividade e distribuição de risco. No gráfico de dispersão, o eixo horizontal representa atividade de negociações, o eixo vertical representa margem, o tamanho do ponto representa profundidade de anúncios e a cor representa risco. Esses dados são indicadores de mercado: `negotiations_count` não deve ser interpretado como vendas concluídas e `listings_count` não representa liquidez garantida.

A análise possui o filtro **Origem do preço**, com as opções **Somente mercado UEX**, **Somente referência in-game** e **Comparar in-game + UEX**. A referência in-game usa apenas `price_buy` e `price_sell` presentes no catálogo local sincronizado pelo endpoint de itens; não utiliza `price_avg`, `price_buy_avg` ou `price_sell_avg`, pois esses campos podem ser médias enriquecidas do marketplace. O mercado de jogadores usa `price_avg_buy`, `price_avg_sell` e os campos de tendência do `marketplace_trends`. Quando a fonte selecionada não possui valor para o item, a linha é omitida ou o campo permanece vazio, sem inventar preço.

A tabela é deliberadamente larga e possui uma barra horizontal visível própria. O cabeçalho informa para arrastar a barra inferior e a largura mínima evita cortar colunas. Os cabeçalhos de Compra usada, Venda usada, Spread, Margem, 30 dias, Negociações, Anúncios e Score são clicáveis e alternam entre maior e menor valor. O seletor **Ordenar por** oferece as mesmas opções para janelas pequenas.

A aba **Mercado por qualidade** foi reformulada para compras: separa “Venda · quero comprar” de “Compra · quero vender”, exibe variação contra 7/30 dias, quantidade de anúncios, confiabilidade da amostra e uma leitura interpretativa. Linhas com 1 anúncio são classificadas como confiabilidade baixa; a média não é tratada como preço garantido. O usuário pode ordenar por menor preço, maior qualidade, quantidade de anúncios e distância da média de 30 dias.

O módulo `src/data/uexMarketAlerts.js` armazena alertas em `sc_uex_market_alerts_v1` e eventos em `sc_uex_market_alert_events_v1`. Cada alerta exige item selecionado pelo ID do catálogo UEX, permite origem (`looted`, `purchased_in_game`, `crafted`, `gifted`, `pledged` ou `pirated`), qualquer qualidade ou faixa numérica de Q0 a Q1000 e menor preço ou teto de preço. O endpoint usado é `marketplace_listings` com `id_item` e `operation=sell`, pois o alerta precisa examinar anúncios ativos individuais, não somente médias.

O sino global consulta os alertas a cada 15 minutos e deduplica cada anúncio por uma chave persistente de alerta/anúncio/preço. A consulta é somente leitura: não compra, reserva, edita nem exclui anúncios. O monitoramento funciona enquanto o Electron estiver aberto; quando o aplicativo é encerrado, o timer não executa consultas em segundo plano. Para monitoramento com o app fechado seria necessária uma execução externa persistente, que não foi adicionada automaticamente.

| Área | Endpoint(s) documentado(s) | Persistência | Regra de uso |
|---|---|---|---|
| Mercado por qualidade | `marketplace_prices_averages`, `marketplace_prices_history`, `marketplace_listings` | `sc_uex_marketplace_averages_v1`, `sc_uex_marketplace_history_v1`, `sc_uex_market_alerts_v1`, `sc_uex_market_alert_events_v1` | Médias para comparação; anúncios individuais para alertas de compra. Qualidade real de anúncios é normalizada para Q0–Q1000 a partir do campo documentado 0–100. |
| Análise de lucro | `marketplace_trends` + catálogo `items` local | `sc_uex_marketplace_trends_v1` + `sc_uex_items_db_v1` | Score ajustado, estratégias, risco, confiança, agrupamento de tiers, ranking, gráficos e filtro de origem in-game/UEX; somente leitura. |
| Monitor de frescor | `data_monitor` | `sc_uex_data_monitor_v1` | Requer Bearer Token e secret-key; a tela informa quando a credencial não está configurada. |
| Commodities | `commodities_alerts`, `commodities_averages`, `commodities_status` | `sc_uex_commodity_alerts_v1`, `sc_uex_commodity_averages_v1`, `sc_uex_commodity_status_v1` | Alertas/status podem ser públicos; médias autenticadas exigem credenciais. O score CAX é somente leitura. |
| Refinarias | `refineries_methods`, `refineries_yields`, `refineries_capacities`, `user_refineries_jobs` | `sc_uex_refineries_v1`, `sc_uex_refinery_jobs_v1` | Métodos, rendimentos e capacidades são catálogo público; jobs pertencem à conta e não são editados pelo app. |
| Frota e loaners | `fleet`, `vehicles_loaners` | `sc_uex_fleet_v1`, `sc_uex_loaners_v1` | Frota exige autenticação; loaners são consulta pública. Ambos são informativos e não alteram `sc_hangar_v1`. |
| Utilidades | `items_attributes`, `fuel_prices_all`, `terminals_distances` | `sc_uex_item_attributes_v1`, `sc_uex_fuel_prices_v1`, `sc_uex_terminal_distances_v1` | Consultas manuais e somente leitura; distância exige origem e destino. |

Os módulos usam `window.electronAPI.uexFetch({ endpoint, token, secretKey })`, reaproveitando o proxy HTTPS já existente em `electron/main.js` e `electron/preload.js`. Não crie um segundo cliente HTTP no renderer. No fallback de navegador, somente endpoints públicos devem ser considerados confiáveis, porque os headers secretos não são expostos ao React.

As funções autenticadas verificam a presença de `sc_uex_token_v1` e `sc_uex_secretkey_v1` antes da chamada. A ausência de credenciais produz uma mensagem orientativa, não uma tentativa silenciosa. Nenhuma função nova faz POST ou DELETE. Não foram usados os endpoints deprecated `marketplace_averages_all` ou `commodities_ranking`.

Os snapshots locais têm o formato `{ data, syncedAt, endpoint, ttl }`. Eles são caches de dados externos; não representam posse, saldo, trades ou compras. Em particular, a frota UEX é exibida separadamente do Meu Hangar e não é somada aos registros comprados locais. O Inventário usa `getItemMarketPrice()`/`getMarketPriceForName()` para preferir o preço local compatível com `quality_tier`; se não existir uma linha por qualidade, mantém o fallback da média do catálogo de itens.

Para acrescentar um endpoint futuro, implemente primeiro a função `fetch...` em `src/data/uexInsights.js`, defina uma chave versionada, use `saveUexInsight()` e inclua a chave em `BACKUP_CATEGORIES` antes de expor a ação na página. Se o endpoint for autenticado, chame a verificação de credenciais. Se o retorno puder ser objeto, normalize explicitamente para array antes de usar `.map()`.

### 10.9 Locais

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

### 10.10 Acompanhamento UEX, anúncios, tendências e estoque interno

`UexSalesPage.js` é a tela de vendas e anúncios locais. `uexSales.js` persiste `sc_uex_sales_v1`, `sc_uex_catalog_v1` e `sc_uex_negotiation_closures_v1` em localStorage. Uma negociação concluída pelo chat pode ser convertida em venda local por `registerNegotiationSale()`, preservando hash da negociação, id/slug do anúncio, preço, quantidade, comprador, qualidade, local, estoque e receita.

O bloco **Estoque Interno** pode ser vinculado ao Inventário de Itens. O anúncio guarda `inventory_binding.locationKeys`, usando a chave composta `system::location_type::location_name`. O usuário pode selecionar um ou mais locais administrados. `getInventoryStockSummary()` soma somente as quantidades do item nos locais selecionados, mostra o total encontrado, o saldo depois da venda e diferencia `Estoque desconhecido`, `Estoque não vinculado` e estoque vinculado. O evento `sc_inventory_updated`, definido em `src/data/inventoryEvents.js`, faz a tela recarregar o inventário após cadastro, edição, exclusão, quantidade ou transferência.

A aba **Tendências** consulta `marketplace_trends` para os itens do catálogo local e associa os resultados por `id_item`, `item_slug` ou nome completo normalizado. Nunca use apenas a primeira palavra do item, pois isso mistura nomes como Yormandi Tongue e Yormandi Eye. O card registra `trendDataFetchedAt`, informa a fonte, mostra o snapshot consultado e considera que a UEX pode manter cache por até uma hora.

As tendências podem ser filtradas por nome, média atual de venda, média de 30 dias, mínimo, máximo, anúncios ativos, negociações e variação percentual. A ordenação inclui alta contra 30 dias, média atual, anúncios, negociações e nome. O card possui link direto para o anúncio UEX e o botão **Comparar 3 anúncios**, que consulta `marketplace_listings?id_item=...&operation=sell` somente ao expandir, remove o próprio anúncio e anúncios esgotados, ordena por preço e mostra até três referências com vendedor, local, qualidade, durabilidade, estoque, origem, expiração e link individual.

Para qualquer nova métrica, confira primeiro a documentação oficial da UEX. `price_avg_sell` é média atual de venda, `price_avg_month_sell` é média de 30 dias, `price_min_sell`/`price_max_sell` são limites observados e `listings_count_sell`/`negotiations_count` são contagens de atividade. Métricas de mercado não representam garantia de venda.

### 10.11 Negociações UEX e atalhos de Textos UEX

`UexNegotiationsPage.js` abre uma negociação por hash, carrega mensagens, atualiza a cada 5 segundos, mostra participantes por cards coloridos e permite copiar o nick do comprador, abrir o Spectrum, enviar em português ou inglês e traduzir mensagens recebidas individualmente. O fluxo de fechamento é local: `closeNegotiation()` grava sucesso/falha; somente o status de sucesso alimenta `registerNegotiationSale()` e cria/atualiza o registro em Acompanhamento UEX. O app não finaliza a negociação nem envia avaliação para a UEX.

O cabeçalho da thread possui o botão **Textos UEX**. Ele lê `sc_uex_texts_v1`, ordena textos fixados e atualizados recentemente, mostra título e resumo e copia cada texto sem sair do chat. `NotesPage.js` emite `UEX_TEXTS_UPDATED_EVENT` ao criar, editar, salvar ou remover textos, e a thread atualiza o menu imediatamente.

### 10.12 Bloco de Notas com imagens e PDFs

`NotesPage.js` mantém notas e Textos UEX no localStorage, mas não coloca o conteúdo binário dos anexos nessa camada. O modelo da nota possui `attachments: []` com `{ id, filename, originalName, mimeType, size, addedAt }`. `NoteAttachments.js` oferece upload múltiplo, miniaturas, preview de imagem, identificação de PDF, abrir, baixar e excluir.

No Electron, `electron/main.js` salva os arquivos em `CompanheiroEmoto/notas-anexos/`. São permitidos JPG, JPEG, PNG, GIF, WEBP, BMP, SVG e PDF, com limite de 20 MB por arquivo. O nome físico usa `{noteId}_{attachmentId}.{ext}`. Os handlers validam extensão/MIME, tamanho, identificador e path traversal antes de ler ou gravar. A leitura retorna base64/data URL; a abertura usa `shell.openPath`; o download usa `dialog.showSaveDialog`. Ao excluir uma nota, `NotesPage.js` tenta remover também os arquivos físicos associados. Notas antigas sem `attachments` devem ser normalizadas para array vazio.

### 10.13 Monitor automático de missões

`electron/missionWatcher.js` lê apenas o arquivo local `Game.log` selecionado pelo usuário. Ele acompanha início, encerramento, conclusão, abandono, falha, recompensa, reputação e blueprints correlacionadas, sem alterar os arquivos do Star Citizen. O estado operacional (`running`, caminho, posição, missão ativa, último erro e eventos recentes) é comunicado por `mission-monitor-event` e `mission-monitor-status`; o histórico resumido e as missões AUTO são persistidos em `sc_mission_auto_monitor_v1` e `sc_missions_v2`.

O parser aceita formatos de recompensa e reputação do log, mas o valor aUEC pode ficar pendente quando o jogo não o grava. Nessa situação, a missão recebe `auto_reward_status: 'pending'` e deve ser preenchida manualmente. O limite do histórico automático é 300 eventos. Reiniciar o aplicativo encerra a sessão de leitura; o caminho selecionado pode ser restaurado pelo estado persistido, mas o processo de polling precisa ser ligado novamente.

### 10.14 Interface transversal e manutenção visual

`ErrorBoundary.js` envolve a aplicação para mostrar diagnóstico de erro sem deixar uma tela branca silenciosa. `ContextHelpOverlay.js` observa elementos interativos e exibe uma dica contextual após aproximadamente 10 segundos de foco/hover, respeitando `prefers-reduced-motion`. `App.css` concentra transições de páginas, cards, modais, botões, progresso, notificações, calculadora, sidebar recolhível e responsividade sci-fi. Ao adicionar uma função interativa, prefira `title`, aria-label ou os atributos usados pelo overlay e não bloqueie elementos atrás de widgets flutuantes.

A sidebar usa `sc_sidebar_collapsed_v1` e `sc_nav_collapsed_groups_v1` para lembrar o estado visual. O `CalculatorWidget` e `UexNotificationBell` são globais e devem ser montados fora do switch de páginas. O componente `DashboardPage` deve consumir os mesmos módulos de domínio, não duplicar regras de Wikelo, DCHS, PAF, inventário, naves ou missões.

### 10.15 Hangar de Naves

`ShipHangarPage.js` consome o catálogo local de veículos salvo em `sc_uex_vehicles_catalog_v1`, normalmente preenchido por UEX API (Live). A tela possui catálogo de compra e Meu Hangar, filtros, visualização em cards/lista para ambas as abas, contagem total de naves e contador de aUEC gasto.

Ao clicar em **Comprei**, o modal usa `price_buy_avg`/média de compra disponível no catálogo local como preenchimento inicial. O usuário pode editar o preço realmente pago. O registro guarda quantidade, preço unitário, total e marcação de edição Wikelo. O total financeiro soma somente aquisições com gasto; naves Wikelo não entram no gasto em aUEC. A reconstrução de registros antigos sem total usa o preço unitário salvo ou a média local disponível.

O catálogo UEX e o Meu Hangar são dados locais do usuário; frota e loaners da UEX são somente informativos e não devem ser somados automaticamente ao hangar comprado. Para corrigir quantidade, custo, edição Wikelo, visão ou filtro, procure `src/data/uexVehicles.js` e `ShipHangarPage.js`. As preferências visuais ficam separadas dos dados em `sc_hangar_view_v1`, `sc_hangar_catalog_view_v1` e `sc_hangar_owned_view_v1`.

## 11. Backup e restauração

Existem dois fluxos distintos.

### Backup seletivo — `BackupPage` e `backupManager.js`

O backup seletivo exporta categorias escolhidas do localStorage e blueprints customizadas por IPC. As categorias estão em `BACKUP_CATEGORIES`. Ele cobre missões, notas e anexos somente pelos metadados, mineração, tracking, baú, cofre, locais, Wikelo, UEX e overrides de datasets. Os arquivos físicos de `notas-anexos` não são embutidos no JSON seletivo; use o backup completo ou copie essa pasta separadamente.

Armaduras e Inventário de Itens não fazem parte do backup seletivo porque vivem no SQLite. Para adicionar uma categoria localStorage, inclua a chave em `BACKUP_CATEGORIES`, teste `countCategoryItems()` e confirme a restauração em `restoreBackup()`.

Backups legados continuam sendo aceitos pela validação de `readBackupFile()`, mas os novos nomes usam a identidade Companheiro Emoto.

### Backup completo — `DataDirectoryPage` e `main.js`

O backup completo exporta todas as chaves presentes no localStorage, copia o arquivo SQLite e registra metadados do diretório. A restauração pode exigir reinício porque o processo principal precisa fechar o banco em memória e reabri-lo.

A importação valida `app`, `format` e a estrutura localStorage. O nome do `.db` é reduzido ao basename e precisa estar junto do JSON para impedir que um arquivo de backup aponte para um caminho arbitrário do computador.

Para transportar o projeto para outro computador, copie o JSON e o `.db` juntos e, se houver notas com anexos, copie também a pasta `notas-anexos`. Não compartilhe backups que contenham token UEX, secret key ou dados pessoais de negociação.

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
| Preço UEX não importa | `uexItemsDB.js` | `uexMarketDB.js` e `UexApiPage.js` | Nome/ID normalizado, snapshot sem `quality_tier` ou média com formato numérico inesperado. |
| UEX Insights mostra dados antigos | `UexInsightsPage.js` | `uexInsights.js` e credenciais | Snapshot fora do TTL ou token/secret-key ausentes em endpoint autenticado. |
| Inteligência UEX não desce a tela | `UexInsightsPage.js` | `App.css` (`uex-insights-scroll`) | A página perdeu `min-height: 0`, `overflow-y: auto` ou a estrutura flex do container rolável. |
| Ranking de lucro parece vazio | `UexInsightsPage.js` | `sc_uex_marketplace_trends_v1` | É necessário clicar em Atualizar tendências; com “somente com compra e venda”, linhas sem os dois preços são descartadas. |
| Frota não aparece no Hangar | `ShipHangarPage.js` | `uexVehicles.js` e token/secret-key | A frota é opcional, somente leitura e depende da autenticação; o Meu Hangar local não deve ser substituído. |
| Unidade SCU errada | `cargoUnits.js` | `OreVaultPage`, `MaterialTrackerPage`, `TransferModal` | Conversão duplicada ou unidade não normalizada. |
| Tracking mistura qualidades | `materialQueue.js` | `oreVault.js` | Material foi agrupado sem `qualityMin`. |
| “Concluir do baú” deduz errado | `MaterialTrackerPage.js` | `deductOreEntries()` | Lista de usos ou unidades incompatíveis. |
| Local aparece em uma tela e não em outra | `locations.js` | `buildManagedLocationOptions()` | Tela criou lista estática paralela. |
| Mensagem UEX duplicada | `uexNegotiations.js` | `UexNotificationBell.js` | Identidade ou deduplicação cruzada incompleta. |
| Chat não atualiza | `UexNotificationBell.js` | `checkForUpdates()` | Polling, token, timestamp ou endpoint. |
| Tradução falha | `uexNegotiations.js` | `electron/main.js` | Limite, indisponibilidade ou resposta inválida do MyMemory. |
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

O token UEX e a secret key são armazenados no localStorage do usuário e entram no backup completo e na categoria sensível do backup seletivo. Um backup deve ser tratado como arquivo privado.

O app usa requisições externas para UEX e MyMemory. Erros de rede devem retornar mensagens tratáveis, sem travar o renderer. A documentação de segurança e falso positivo fica em `SEGURANCA_AVAST.md`.

Para reduzir alertas de reputação no Windows, distribua builds assinadas com certificado real de código. A assinatura é diferente do nome visual do produto e não deve ser substituída por configuração textual. Mantenha o `appId` `com.companheiroemoto.app` estável se já houver usuários instalados, pois alterar o identificador pode quebrar reconhecimento de atualização e desinstalação.

## 17. Empacotamento Windows

O bloco `build` do `package.json` possui as decisões atuais:

```json
{
  "main": "electron/main.js",
  "build": {
    "appId": "com.companheiroemoto.app",
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
      "requestedExecutionLevel": "asInvoker"
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

A aba **Naves UEX** lê o catálogo salvo localmente pela tela **UEX API (Live) → Veículos**. Quando o usuário clica em **Atualizar** na UEX API Live, o aplicativo consulta pela proxy HTTPS os endpoints documentados `vehicles`, `vehicles_purchases_prices_all` e `vehicles_rentals_prices_all` e grava o resultado compartilhado em `sc_uex_vehicles_catalog_v1`. O catálogo exibe nome, nome completo, fabricante, tipo de veículo, funções, carga em SCU, tripulação, dimensões, pad, combustível, links externos e os locais/preços de compra e aluguel disponíveis.

O Hangar não repete essa sincronização. Ao ser aberto, ele carrega o catálogo local com `loadVehicleCatalog()`. O botão **Recarregar dados locais** apenas relê o localStorage e não faz nova chamada externa. Quando a UEX API Live salva um catálogo enquanto o Hangar está aberto, `saveVehicleCatalog()` dispara `UEX_VEHICLES_UPDATED_EVENT` e a tela atualiza os cards automaticamente. Se não existir catálogo local, o Hangar orienta o usuário a abrir a tela UEX API Live e sincronizar a aba Veículos. A consulta detalhada de compra/aluguel por nave continua sob demanda quando o card é expandido e somente para completar informações específicas ausentes no catálogo geral.

Os filtros ficam em `ShipHangarPage.js`, no `useMemo` que monta `vehicles`. A busca procura por nome, nome completo, fabricante e slug. O filtro de tipo separa naves e veículos terrestres; o filtro de função usa as flags `is_cargo`, `is_mining`, `is_salvage`, `is_medical`, `is_exploration`, `is_military`, `is_passenger` e `is_ground_vehicle`. A ordenação pode ser alternada entre nome, carga e tripulação.

O catálogo possui duas visualizações. **Cards** é a visualização padrão e apresenta imagem, funções, especificações, compra, aluguel e ações. **Lista** apresenta as mesmas naves em linhas compactas, com miniatura, fabricante, carga, tripulação, quantidade de ofertas, primeiro terminal conhecido e ações. A preferência é salva em `sc_hangar_view_v1`, permitindo que o usuário continue na última visualização utilizada. O componente `VehicleListRow` e as classes `hangar-vehicle-list-row` em `src/App.css` controlam a versão responsiva para janelas menores.

As duas visualizações utilizam `getPurchasedQuantity(hangar, vehicle)`. Quando a nave está registrada como `source: 'compra'`, o contador soma a quantidade de todos os registros correspondentes por `vehicleId`, usando o nome como fallback para registros antigos. O card ou linha recebe um contorno verde-água e mostra o contador compacto. Registros `source: 'wikelo'` continuam visíveis no Meu Hangar, mas não são misturados no contador de naves compradas.

A busca detalhada de uma nave usa `vehicles_purchases_prices?id_vehicle=...` e `vehicles_rentals_prices?id_vehicle=...` somente quando o card é expandido. Essa decisão evita uma chamada individual para cada veículo durante a sincronização geral. O módulo normaliza números ausentes para `null`, e a interface apresenta `—` quando a UEX não fornece determinada informação.

### Imagens da UEX

O campo `url_photo` recebido pela UEX é renderizado pelo componente `UexVehicleImage`. No Electron, a imagem passa por `window.electronAPI.uexImage()`, exposta em `electron/preload.js` e tratada pelo handler `uex-image` em `electron/main.js`. O handler permite somente HTTPS, o host oficial `assets.uexcorp.space` e caminhos `/img/`, evitando uma proxy aberta. Ele envia os headers necessários, transforma a resposta em `data URL` e aplica limite de 10 MB. Quando a imagem não pode ser carregada, o card mostra o ícone de nave como fallback.

### Meu Hangar

A aba **Meu Hangar** é um registro local; ela não realiza transações na UEX. O total de unidades de todas as origens é calculado com base em `quantity` e aparece também na Dashboard no indicador **Naves no Hangar**, acompanhado da quantidade de tipos registrados. A Dashboard lê `loadMyHangar()` e reage aos eventos `UEX_VEHICLES_UPDATED_EVENT` e `MY_HANGAR_UPDATED_EVENT`, portanto o indicador é atualizado quando o catálogo, a compra, a quantidade ou a remoção de uma nave muda dentro do aplicativo. O botão **Comprei** abre um modal que solicita somente a quantidade da nave e observações opcionais. A aplicação não pergunta mais em qual local ou hangar a nave está. Ao confirmar, `addToMyHangar()` salva a aquisição em `sc_hangar_v1`, agrupando registros pela origem e pelo veículo e somando a quantidade quando a mesma nave é registrada novamente.

Cada registro do Meu Hangar contém, quando disponível, `vehicleId`, `vehicleName`, `manufacturer`, `source`, `quantity`, `acquiredAt`, `notes`, `image`, `scu`, `crew` e `slug`. A aba permite aumentar ou reduzir a quantidade, editar observações e remover o registro. O componente `HangarEntry` exibe a origem `COMPRADA` ou `WIKELO`, sem exibir campo de local/hangar.

### Naves recebidas pelo Wikelo

O botão **Nave do Wikelo** abre um formulário manual para nome, fabricante, quantidade, carga em SCU e observações. O registro é salvo com `source: 'wikelo'` e aparece separado visualmente das naves compradas. Essa entrada manual é necessária porque o acompanhamento Wikelo existente registra missões e recompensas, mas não possui um catálogo estruturado de naves recebidas para importação automática.

### Escopo removido e persistência

A Pledge Store não faz parte do Hangar. O módulo não consulta mais `vehicles_prices`, não mantém `pledgePrices`, não importa `getPledgeRows()` e não exibe preços, Warbond, pacotes ou status de oferta. A sincronização se limita ao catálogo, à compra in-game e ao aluguel in-game.

O catálogo sincronizado fica em `sc_uex_vehicles_catalog_v1` e o Meu Hangar fica em `sc_hangar_v1`. As duas chaves estão incluídas na categoria `Hangar de Naves / Meu Hangar` do backup seletivo. O backup completo já inclui automaticamente essas chaves por exportar todas as entradas do localStorage. Os endpoints, campos e regras de compatibilidade estão registrados em `UEX_VEHICLES_API_NOTES.md`.

A API UEX é mantida pela comunidade e pode não representar exatamente o estado atual dos servidores. Por isso, o código preserva a data da última sincronização, trata campos ausentes como `null`/`—` e não inventa preço, local, carga ou característica que não esteja na resposta da API.


## 23. Atualizações funcionais recentes e manutenção por domínio

Esta seção registra as alterações mais recentes que devem ser consideradas por qualquer programador que continue o desenvolvimento do projeto. Ela complementa as regras de domínio anteriores e descreve os fluxos que foram implementados depois da documentação inicial.

### 23.1 Tracking de Materiais: coleta em cSCU e SCU

O arquivo `src/pages/MaterialTrackerPage.js` possui o componente `CollectInput`. Quando o material usa uma unidade de carga reconhecida por `src/data/cargoUnits.js`, o componente mostra o seletor **Unidade da coleta** com as opções `cSCU` e `SCU`. Para materiais não relacionados a carga, como `un`, o seletor não aparece e o campo continua usando a unidade do requisito.

O valor digitado não deve ser convertido diretamente na página. O componente envia a quantidade e a unidade selecionada para `handleCollect()` ou `handleUncollect()`, que chama `collectMaterial()` ou `uncollectMaterial()` em `src/data/materialQueue.js`. Essas funções convertem a entrada para a unidade-base cSCU usando `toCargoBase()` antes de somar ou subtrair. A lista calculada depois converte o valor-base novamente para a unidade do requisito com `fromBase()`.

> **Regra invariável:** `100 cSCU` e `1 SCU` precisam gerar o mesmo valor persistido. Não implemente uma segunda fórmula dentro de `MaterialTrackerPage.js`, `OreVaultPage.js` ou `TransferModal.js`.

A prévia apresentada ao usuário usa `fmtSCU()` e mostra a equivalência da entrada, por exemplo `100 cSCU = 1 SCU`. O campo aceita números decimais e o parser `parseCargoInput()` trata a convenção numérica pt-BR.

Cada `MaterialRow` também possui `material-reset-collected-button`. O botão aparece no final do card e fica desabilitado quando `item.collected` é zero. Quando acionado, `handleReset()` localiza o item pela chave composta material + qualidade mínima, pede confirmação com `window.confirm()`, chama `resetMaterialCollected()` e preserva o requisito na fila. O reset remove somente a coleta salva; não remove a blueprint, a exigência, o material manual ou a ordem de prioridade. Ao concluir, `actionMessage` informa o resultado ao usuário.

| Arquivo | Ponto de manutenção | Responsabilidade |
|---|---|---|
| `src/pages/MaterialTrackerPage.js` | `CollectInput`, `MaterialRow`, `handleCollect`, `handleUncollect`, `handleReset` | Interface, unidade escolhida, confirmação e atualização visual. |
| `src/data/materialQueue.js` | `collectMaterial`, `uncollectMaterial`, `resetMaterialCollected`, `calcShoppingList` | Persistência, conversão para cSCU, cálculo de necessário/coletado/faltante e chave por qualidade. |
| `src/data/cargoUnits.js` | `normalizeCargoUnit`, `toCargoBase`, `fromCargoBase`, `parseCargoInput` | Regra única de conversão e interpretação numérica. |
| `src/App.css` | `.material-unit-selector`, `.material-reset-collected-button` | Layout responsivo do seletor e do botão de reset. |

### 23.2 Rastreador de Missões: modais, estatísticas e templates

`src/pages/MissionTrackerPage.js` mantém as chaves `sc_missions_v2`, `sc_obj_library_v1` e `sc_daily_losses_v1`. A tela possui as abas **Hoje**, **Histórico** e **Estatísticas**. O estado financeiro considera `Completed` como receita e `Saiu da carteira` como saída negativa, usando `wallet_out_at` para posicionar a perda na data correta.

Os detalhes agora são apresentados por `MissionDetailsModal`. O cabeçalho do card abre uma janela flutuante com status, dificuldade, facção, sistema, localização, recompensa, reputação, tripulação, duração, objetivos, notas, loot e metadados AUTO. O botão de editar dentro do modal abre o formulário existente em uma janela flutuante separada, sem duplicar a lógica de `MissionForm`.

A função **Reaproveitar Missão** é implementada por `ReuseModal`. Ela agrupa registros pela combinação de título, tipo e facção, mas mantém variantes de recompensa, local, sistema e dificuldade. O programador deve preservar essa separação: o template serve para iniciar uma nova missão, enquanto as variantes ajudam o usuário a escolher o registro mais próximo. O modal possui busca textual, filtro por tipo, expansão de variantes e ordenação por mais usadas, maior recompensa e título A-Z. O botão `Usar` cria uma nova missão ativa no formulário, sem alterar o registro original.

A aba Estatísticas usa `StatsTab`. Ela mostra KPIs, período analisado, distribuição por status, receita, perdas e indicadores de desempenho. O botão **Resetar estatísticas e histórico** chama `handleResetStatisticsAndHistory()`, pede confirmação e apaga as listas de `sc_missions_v2` e `sc_daily_losses_v1`. O catálogo de objetivos, o Gerenciador de Missões, o Monitor Automático e suas configurações são preservados. Depois do reset, a página emite o evento `sc_missions_reset` com a quantidade removida e a quantidade de missões ativas que existia antes da operação.

| Componente/função | Onde procurar | Cuidados |
|---|---|---|
| Detalhes | `MissionDetailsModal` | Não remover o suporte a missões AUTO e recompensa pendente. |
| Edição | `MissionForm`, estado `editM` | Reutilizar as opções vindas de `missionAdmin.js`. |
| Reaproveitamento | `ReuseModal` | Agrupar por título + tipo + facção e preservar variantes. |
| Estatísticas | `StatsTab` | Respeitar período, status financeiro e perdas da carteira. |
| Reset | `handleResetStatisticsAndHistory` | Nunca apagar `sc_mission_auto_monitor_v1` nem `sc_mission_admin_v1`. |
| Loot | `LootDistributionModal`, `calculateLootDistribution` | Manter os modos `equal`, `percentage` e `manual`; porcentagens válidas devem totalizar 100%. |

O loot usa `distribution_version: 2`, `divisionMode`, `distribution_mode`, `members`, `items`, `percentages` e `assignments`. O modo igual distribui com ajuste de arredondamento no último membro; o modo percentual valida a soma; o modo manual valida que as quantidades atribuídas não ultrapassem o total do item.

### 23.3 Gerenciador de Missões

`src/pages/MissionAdminPage.js` e `src/data/missionAdmin.js` administram três catálogos: `factions`, `types` e `systems`. Cada opção possui `id`, `category`, `name`, `active`, `notes`, `builtIn`, `createdAt` e `updatedAt`. A função `getMissionAdminOptions()` retorna somente opções ativas, mas preserva uma opção legada inativa quando uma missão antiga ainda usa aquele valor.

A chave canônica é `sc_mission_admin_v1`. A chave `sc_mission_catalog_v1` é mantida somente para migração de versões antigas. Depois de salvar uma opção, `missionAdmin.js` emite `MISSION_ADMIN_UPDATED_EVENT`; o Rastreador escuta o evento e recarrega os selects de facção, tipo e sistema sem exigir que o usuário reinicie a tela.

Não substitua os valores cadastrados diretamente em `MissionTrackerPage.js`. Para adicionar uma nova facção, tipo ou sistema, use o Gerenciador ou altere os seeds de `DEFAULTS` em `missionAdmin.js`.

### 23.4 Monitor Automático de Missões e Game.log

O Monitor Automático é implementado em três camadas:

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Parser e watcher | `electron/missionWatcher.js` | Lê o Game.log, acompanha alterações, faz replay inicial e emite eventos. |
| IPC | `electron/main.js` e `electron/preload.js` | Escolhe o arquivo, inicia, pausa, consulta status e encaminha eventos ao renderer. |
| Estado e integração | `src/data/missionAutoMonitor.js`, `App.js`, `MissionTrackerPage.js` | Persiste eventos, atualiza missões AUTO e mostra o painel integrado. |

A ponte expõe os canais `mission-monitor-choose-log`, `mission-monitor-start`, `mission-monitor-stop`, `mission-monitor-status`, `mission-monitor-event` e `mission-monitor-status-update` por métodos nomeados do `window.electronAPI`. O renderer não deve acessar `fs` nem observar o Game.log diretamente.

O watcher faz replay dos últimos 8 MB do arquivo quando é ligado, para recuperar eventos recentes. O parser trata notificações de aceitação que chegam em duas linhas, mantém um buffer para a linha pendente, prioriza o nome legível da missão sobre o identificador técnico e separa recompensa aUEC de reputação.

Os eventos normalizados usam `auto: true` e `source: 'game_log'`. Os tipos principais são `mission_start`, `mission_complete`, `mission_ended`, `blueprint_received` e `session_reset`. O estado persistido em `sc_mission_auto_monitor_v1` mantém no máximo 300 eventos e a lista de missões ativas detectadas.

Quando uma missão é criada ou atualizada, `upsertAutomaticMissionRecord()` grava no mesmo `sc_missions_v2` usado pelas missões manuais. Uma missão AUTO sem valor monetário recebe `reward: 0` e `auto_reward_status: 'pending'`. Quando o usuário preenche a recompensa pelo formulário completo ou pelo botão rápido do card, o status passa para `filled`. `hasPendingAutoReward()` é a regra única usada pelo badge e pelo filtro **AUTO sem recompensa**.

Os campos importantes de uma missão AUTO são `watcher_guid`, `auto_started_at`, `auto_ended_at`, `duration_sec`, `reputation_min`, `reputation_max`, `reputation_label`, `auto_blueprints`, `contract_definition_id`, `external_generator` e `auto_last_reason`. Se uma missão não for detectada, investigue primeiro o formato real do Game.log, os padrões de `missionWatcher.js`, o caminho escolhido e o estado de replay; não altere somente a interface.

### 23.5 Guia de Mineração e builds de nave

`src/pages/MiningPage.js` agora é uma ferramenta de anotação de builds. A página mantém somente a seção de builds de nave e permite escolher nave, cabeça de mineração, módulos/peças equipadas, status ativo e anotações pessoais. A antiga aba **Naves & Módulos** foi removida.

A interface não deve exibir potência, alcance, multiplicador de extração, instabilidade, capacidade, tripulação, preço, quantidade de lasers ou outros valores de desempenho. Os dados antigos podem continuar presentes em catálogos internos para compatibilidade, mas não devem ser renderizados pela Guia de Mineração. A chave de builds é `sc_mining_builds_v1`.

A fonte de dados de naves detalhada é o Hangar de Naves, em `ShipHangarPage.js` e `uexVehicles.js`. Não reintroduza a antiga mistura entre catálogo técnico da UEX e a página de builds pessoais.

### 23.6 Alertas de Compra em tela dedicada

`src/pages/MarketAlertsPage.js` é a tela dedicada dos Alertas de Compra. `UexInsightsPage.js` não deve renderizar novamente o painel, pois a separação evita estados duplicados e torna a navegação mais clara. O menu usa o identificador `uexalerts`; o Dashboard, o sino de notificações e os atalhos de ofertas devem navegar para esse identificador.

O domínio de persistência está em `src/data/uexMarketAlerts.js`. Um alerta pode usar item do catálogo UEX ou item digitado manualmente, origem do anúncio, qualidade looteada ou faixa Q0–Q1000, preço máximo ou menor preço, critério de atividade do vendedor, intervalo configurável e limite de anúncios. O campo moeda não é configurável: os alertas trabalham com UEC/UEC conforme o contrato da UEX usado pelo projeto.

A análise automática é controlada pelo usuário. O timer só consulta enquanto o Electron está aberto. Cada execução consulta anúncios ativos, aplica os critérios, agrupa por item e deduplica por identidade persistente do anúncio. O evento preserva o link para abrir a oferta, o link copiável, o vendedor, item, qualidade, preço, atividade e horário encontrado. Remover um grupo altera somente a exibição local; não exclui nem altera o anúncio na UEX.

O sino global consulta o estado dos alertas, emite som quando existe nova correspondência — desde que o som não esteja silenciado — e direciona o usuário à página `uexalerts`. Quando a notificação contém um grupo ou anúncio específico, `sc_uex_market_alert_focus_v1` preserva o foco para a tela dedicada abrir o detalhe correspondente.

### 23.7 Refinarias na Inteligência UEX

A aba Refinarias permanece em `UexInsightsPage.js`, mas agora possui uma área própria para busca e filtros. O campo de texto aceita o nome manual da Commodity e filtra rendimentos, capacidades e jobs sem ocultar o catálogo geral de métodos. Isso permite pesquisar itens não selecionados previamente no catálogo.

Os filtros principais são Commodity, terminal, método, ordenação por rendimento atual/7 dias/30 dias/Commodity, somente rendimento positivo, estado dos jobs e melhor resultado. A lista de terminais é construída a partir dos dados sincronizados, evitando uma lista fixa. A página apresenta resumo dinâmico, destaque da melhor combinação, tabela de rendimentos, tabela de capacidades e tabela de jobs com rolagem própria.

`src/data/uexRefineriesDB.js` é responsável pelo cache local. Não confundir catálogo público de métodos, rendimentos e capacidades com jobs da conta. Jobs autenticados exigem as credenciais UEX e não devem ser fabricados no fallback do navegador. Quando os dados não estiverem sincronizados, a tela deve informar o estado vazio, não exibir números inventados.

### 23.8 Layout, responsividade e sidebar

`src/App.css` contém a camada global de responsividade do projeto. O layout usa `min-width: 0`, `min-height: 0`, grids adaptáveis, áreas de rolagem próprias, breakpoints para telas estreitas e tabelas com rolagem horizontal confinada. Páginas densas como Blueprints, Backup, Cofre do Clã, Armadura Personalizada, Inventário, Tracking, Missões, UEX e Hangar receberam classes responsivas específicas.

A barra lateral é controlada por `sidebarCollapsed` em `App.js` e pelas chaves `sc_sidebar_collapsed_v1` e `sc_nav_collapsed_groups_v1`. Em janelas de até 560 px ela começa compacta quando não existe preferência salva, mas o usuário pode expandi-la. No estado compacto, os textos são ocultados, porém `.nav-group-icon`, `.nav-item-icon` e os SVGs precisam continuar com `display` visível, opacidade 1, dimensões fixas e centralização.

Se os botões da sidebar aparecerem apenas como contornos vazios, não altere os imports de ícones primeiro. Verifique as regras finais de `.sidebar-collapsed .nav-group-header`, `.nav-group-icon`, `.nav-item-icon` e seus elementos `svg`. A correção deve preservar tooltips, item ativo, grupos recolhidos e o menu expandido.

### 23.9 Alertas de manutenção rápida

| Sintoma recente | Arquivos para investigar | Verificação |
|---|---|---|
| Unidade cSCU/SCU soma errado | `cargoUnits.js`, `materialQueue.js`, `MaterialTrackerPage.js` | Confirmar que a entrada passa uma unidade válida a `collectMaterial()` e que a base é cSCU. |
| Reset zera o requisito inteiro | `MaterialTrackerPage.js`, `materialQueue.js` | O reset deve apagar somente `collectedMaterials[key]`, nunca `queuedBlueprints`. |
| Recompensa AUTO continua pendente | `MissionTrackerPage.js`, `missionAutoMonitor.js` | Verificar `reward > 0`, `auto_reward_status` e `hasPendingAutoReward()`. |
| Missão do Game.log não aparece | `missionWatcher.js`, `main.js`, `preload.js`, `App.js` | Conferir caminho, replay, padrões de duas linhas, eventos IPC e `watcher_guid`. |
| Reaproveitamento mistura missões | `ReuseModal` em `MissionTrackerPage.js` | Confirmar chave título + tipo + facção e variantes separadas. |
| Reset de estatísticas apaga configuração | `handleResetStatisticsAndHistory()` | Preservar `sc_mission_admin_v1`, `sc_mission_auto_monitor_v1` e `sc_obj_library_v1`. |
| Alertas não aparecem na tela antiga | `MarketAlertsPage.js`, `App.js`, `UexNotificationBell.js` | A rota correta é `uexalerts`; não reintroduzir o painel em `UexInsightsPage.js`. |
| Busca de Refinarias não filtra capacidade | `UexInsightsPage.js`, `uexRefineriesDB.js` | Aplicar a Commodity normalizada às listas de yields, capacities e jobs. |
| Sidebar compacta vazia | `App.css`, `App.js` | Conferir visibilidade e dimensões dos SVGs no estado `sidebar-collapsed`. |

## 24. Procedimento recomendado para documentar uma nova alteração

Sempre que uma nova função for adicionada, atualize o componente responsável, o módulo de domínio, a tabela de persistência, a tabela de navegação e a seção de troubleshooting correspondente. Se a função usar localStorage, documente a chave e inclua-a no backup seletivo quando for dado de usuário. Se usar SQLite, documente a tabela, o handler IPC, o método do preload e a migração.

Ao corrigir um bug, registre no README o sintoma, a causa, os arquivos alterados, a regra que não pode ser quebrada e o comando usado para validar. Isso é especialmente importante para conversões de carga, qualidade mínima, IPC, integração UEX e migração do diretório central.

Para qualquer mudança visual, prefira classes em `src/App.css` quando o comportamento for compartilhado. Use estilos inline apenas para valores derivados do estado, como cor de um minério, largura de uma barra de progresso ou destaque de um status. Toda tela com lista potencialmente grande precisa definir explicitamente qual container rola e preservar `min-height: 0` quando estiver dentro de um layout flex/grid. Hover não deve alterar a geometria do layout: prefira borda, sombra e brilho a `translateY` ou `scale` em cards que contêm números e textos.

## 25. Checklist atualizado de entrega

| Verificação | Comando ou ação |
|---|---|
| Sintaxe do processo principal | `node --check electron/main.js` |
| Sintaxe do preload | `node --check electron/preload.js` |
| Sintaxe do watcher | `node --check electron/missionWatcher.js` |
| Build React | `npm run react-build` |
| Fluxo de conversão | Testar 100 cSCU e 1 SCU no mesmo requisito e confirmar equivalência. |
| Reset individual | Confirmar que `Já tenho` volta a zero e o requisito continua na fila. |
| Reset de missões | Confirmar que somente missões/perdas são removidas. |
| Monitor Game.log | Escolher um Game.log, iniciar, verificar status, evento AUTO e parar. |
| Alertas UEX | Testar tela dedicada, link, grupo, deduplicação, limite e desligamento automático. |
| Refinarias | Pesquisar Commodity, escolher terminal, ordenar e testar estado vazio. |
| Sidebar | Recolher/expandir em janela larga e estreita; conferir SVGs. |
| Backup | Exportar/restaurar as novas chaves e não incluir segredos em artefatos compartilhados. |
| Instalador | `npm run build:win` em Windows, com instalação limpa e atualização sobre dados existentes. |

A documentação deve ser atualizada junto com o código. O README é a referência técnica para o próximo programador: o histórico de conversas não deve ser necessário para descobrir onde uma função está implementada, quais dados ela altera ou qual regra precisa ser preservada.


## 26. Atualização técnica — funcionalidades recentes

Esta seção registra as alterações mais recentes para que a manutenção futura não dependa do histórico de conversas. As regras descritas aqui devem ser preservadas ao refatorar os componentes.

### 26.1 Inventário global e localização padrão

`src/pages/InventoryPage.js` mantém dois níveis de busca. Quando nenhum sistema está selecionado, a tela inicial exibe o campo **Pesquisa global do Inventário**, junto de **Selecione um Sistema Espacial**. A busca consulta `regularItems`, soma `quantity` e agrupa os resultados por `system` e `location_name`. Registros antigos sem destino definido continuam ocultos por compatibilidade e não entram no resumo global.

A preferência de destino para novos cadastros está em `src/data/inventoryPreferences.js` e usa a chave `sc_inventory_preferences_v1`. Ela armazena `defaultDestination`, com sistema, tipo de local e localização. A preferência deve ser aplicada somente quando um novo item é criado; ao editar um item existente, o sistema não pode sobrescrever o local escolhido pelo usuário.

Os locais devem continuar sendo obtidos da base administrável de `src/data/locations.js`. Não crie uma segunda lista estática dentro do Inventário. Alterações na tela Sistema precisam refletir nos seletores do Inventário, Baú de Minério, transferências, estoque interno UEX e despacho de recompensas.

### 26.2 Sistema consolidado

A entrada atual do menu é `system-admin`, renderizada por `src/pages/SystemAdminPage.js`. Essa tela possui as abas **Locais**, **Missões** e **Categorias**. Os componentes `LocationsAdminPage.js`, `MissionAdminPage.js` e `InventoryTaxonomyAdminPage.js` recebem o modo embutido e reutilizam seus formulários.

Ao corrigir um problema de cadastro de local, verifique tanto o componente embutido quanto o componente original. O botão **Adicionar local** precisa permanecer visível no modo embutido. As categorias e subcategorias são persistidas por `src/data/inventoryTaxonomy.js`, usando `sc_inventory_taxonomy_v1` e eventos `inventory-taxonomy-updated`.

### 26.3 Missões automáticas e recompensas

O Rastreador de Missões está em `src/pages/MissionTrackerPage.js`. O monitor do Game.log fica em `electron/missionWatcher.js`, com integração de eventos em `electron/main.js`, `electron/preload.js`, `src/data/missionAutoMonitor.js` e `src/App.js`.

Os campos de recompensa de missão são normalizados para manter compatibilidade com registros antigos:

| Campo | Valores ou finalidade |
|---|---|
| `scrip_type` | `mg_scrip`, `council_scrip` ou vazio. |
| `scrip_qty` | Quantidade de scrip da missão. |
| `scrip_dispatched` | Proteção contra crédito duplicado. |
| `scrip_status` | `pending`, `credited` ou `failed`. |
| `secure_drive_enabled` | Indica entrega de ASD Secure Drive. |
| `secure_drive_qty` | Quantidade de ASD Secure Drive. |
| `secure_drive_dispatched` | Proteção contra despacho duplicado. |
| `secure_drive_status` | `pending`, `credited` ou `failed`. |

O despacho novo fica em `src/data/missionRewardDispatch.js`. Quando a missão é concluída com sucesso, MG Scrip, Council Scrip e ASD Secure Drive são enviados ao destino salvo em `sc_inventory_preferences_v1`. O módulo deve localizar um registro existente pelo item e pelo destino completo — sistema, tipo de local e localização — e somar a quantidade; caso não exista, deve criar um novo registro.

Missões falhadas, abandonadas ou encerradas sem sucesso não podem creditar recompensas. Se não houver local padrão, a recompensa não deve ser descartada: o despacho deve retornar estado pendente ou falha com motivo legível para o usuário. A operação precisa ser idempotente, pois a conclusão pode chegar por mais de um caminho: monitor automático, alteração manual de status ou reprocessamento do evento.

O Baú Desconhecido foi removido da interface, da Dashboard, das categorias de backup e dos fluxos ativos. `src/data/unknownVault.js` e a chave `sc_unknown_vault_v1` permanecem somente como camada de compatibilidade para testes, migrações e dados antigos; nenhum fluxo novo deve gravar nessa chave. As recompensas de missão usam exclusivamente `missionRewardDispatch.js` e o local padrão do Inventário.

### 26.4 Distribuição de loot

A distribuição é implementada dentro de `src/pages/MissionTrackerPage.js`. Cada card de missão nas abas **Hoje** e **Histórico** possui o botão **Distribuição de Loot**. O botão abre o mesmo modal usado no fechamento manual e deve carregar `mission.loot` quando já existir.

Os três modos suportados são divisão igual, divisão por porcentagem e divisão manual. Ao salvar, somente o campo `loot` da missão correspondente deve ser atualizado. Não confundir essa distribuição com o despacho automático de scrip, que é tratado por `missionRewardDispatch.js`.

### 26.5 Acompanhamento Wikelo

`src/pages/WikeloTrackerPage.js` fornece a interface e `src/data/wikeloInventory.js` concentra as regras de estoque. O percentual geral deve ser calculado proporcionalmente às quantidades coletadas, não apenas pela quantidade de tipos de item concluídos.

O escaneamento deve considerar todas as missões Wikelo que pedem o mesmo item. O estoque disponível deve ser reservado de forma determinística entre as missões, para que uma única unidade não seja exibida como disponível simultaneamente em cinco missões. O resultado precisa preservar a origem do estoque e mostrar o sistema, tipo e local analisados.

Os controles `-` e **Resetar** podem ser usados mesmo quando um item está completo. O reset deve zerar somente a coleta e a contribuição do inventário para aquele item, sem apagar a exigência da missão. A entrega ao Wikelo continua sendo a única operação que consome itens do Inventário, deve exigir confirmação e possuir rollback em caso de erro.

### 26.6 Negociações e notificações UEX

A tela `src/pages/UexNegotiationsPage.js` usa `src/data/uexNegotiations.js` e `src/data/uexNegotiationStatus.js`. O classificador de fechamento deve considerar o fechamento do vendedor e do comprador, inclusive `date_closed` e `date_closed_client`, além dos indicadores alternativos documentados pela API. Não classifique chats antigos como ativos apenas porque uma das datas não veio na resposta.

A lista inicia no filtro **Ativas**, mas mantém filtros para encerradas pela UEX, finalizadas com sucesso, sem acordo e todas. O botão **Verificar anúncio na UEX** conserva a função de abrir o anúncio; **Ir para gerenciador UEX** deve apontar para `https://uexcorp.space/marketplace/manage`; e **Abrir Spectrum** deve apontar para `https://robertsspaceindustries.com/spectrum/community/SC`.

Ao concluir uma venda com sucesso, o modal deve pedir quantidade realmente vendida e valor total recebido. O preço pode ser diferente do anúncio. `src/data/uexSales.js` salva a quantidade, preço unitário e receita total, com proteção contra duplicidade. A validação específica fica em `src/data/uexSales.test.js`.

`src/components/UexNotificationBell.js` consolida alertas de mensagens UEX e alertas de compra. Uma mensagem nova deve carregar o identificador da negociação, ser clicável e abrir diretamente o chat correto via `App.js`. O alerta não deve reaparecer enquanto o usuário estiver no chat correspondente e não deve duplicar uma mensagem recebida por mais de uma fonte.

### 26.7 Meus Itens e anúncios UEX

`src/pages/UexSalesPage.js` renderiza os cards de **Meus Itens**. O helper `getCatalogListingTarget()` prioriza URL direta, slug da listagem e, para registros antigos sem identificador, uma busca pelo título na UEX. Não construa uma URL específica usando apenas o título, pois isso pode abrir um anúncio inexistente ou de outro item.

O estoque interno pode ser vinculado a múltiplos locais do Inventário e, para cargas, ao Baú de Minério. Ao alterar quantidade no Inventário ou no Baú, o card deve refletir a quantidade disponível e o excedente após as unidades anunciadas. A vinculação não deve misturar itens com nomes semelhantes, como Yormandi Tongue e Yormandi Eye.

### 26.8 Backup, migração e novas chaves

Ao adicionar uma nova chave de `localStorage`, inclua-a no fluxo de backup seletivo de `src/data/backupManager.js` quando ela representar dados do usuário. As chaves mais relevantes atualmente são:

| Chave | Módulo ou dado |
|---|---|
| `sc_unknown_vault_v1` | Chave legada mantida somente para compatibilidade; não é exportada por novas categorias nem exibida na interface. |
| `sc_missions_v2` | Missões, status, tempo e recompensas. |
| `sc_inventory_preferences_v1` | Destino padrão de novos itens e recompensas. |
| `sc_inventory_taxonomy_v1` | Categorias e subcategorias administráveis. |
| `sc_wikelo_missions_v1` | Missões, progresso e entrega Wikelo. |
| `sc_uex_market_alerts_v1` | Alertas, grupos, limite, intervalo e automação individual. |
| `sc_uex_notif_state_v1` | Estado de mensagens já processadas pelo sininho. |
| `sc_uex_token_v1` | Token UEX local; nunca incluir em backup compartilhável. |
| `sc_uex_secretkey_v1` | Secret key UEX local; nunca incluir em backup compartilhável. |

Segredos UEX não devem ser gravados em README, testes, logs, backups exportados ou commits. Ao criar ou atualizar um backup, confirme que tokens e secret keys permanecem somente no computador do usuário.

## 27. Fluxo recomendado para manutenção

Antes de alterar uma função, identifique se ela pertence à interface, ao módulo de domínio, ao processo principal ou à ponte IPC. Para uma alteração de UI, comece em `src/pages` ou `src/components` e procure os eventos de armazenamento e os callbacks de `App.js`. Para uma alteração de dados, concentre a regra em `src/data` e escreva testes unitários antes de alterar múltiplas páginas.

Quando a função envolve dados externos, não faça chamadas diretamente em vários componentes. Centralize a normalização e o tratamento de erros no módulo de dados correspondente. Quando a função envolve consumo de estoque, use uma operação idempotente, peça confirmação explícita e implemente rollback. Quando a função envolve uma lista grande, preserve `useMemo`, `useDeferredValue`, paginação ou carregamento progressivo e não remova informações para obter desempenho.

Para erros de compilação como `X is not defined`, `MapPin is not defined`, `Check is not defined` ou `Pickaxe is not defined`, confira primeiro os imports de `lucide-react` no arquivo apontado. Para erros como `Objects are not valid as a React child`, verifique se o JSX está exibindo um objeto inteiro em vez de `.name`, `.label` ou outro campo textual.

Para erros de dados, valide sempre a normalização antes da renderização. Quantidades de carga devem passar por `src/data/cargoUnits.js`; o banco de minério usa a regra de conversão cSCU/SCU documentada em `src/data/scuCalculator.js`, `src/data/oreVault.js` e `src/data/materialQueue.js`. Não faça conversões manuais espalhadas em componentes.

## 28. Validação obrigatória antes de entregar alterações

O comando oficial é:

```powershell
npm run verify
```

Ele executa os testes, o build do React e a checagem sintática dos arquivos Electron. A entrega só deve ser considerada pronta quando os três passos passarem. Para depurar separadamente, use:

```powershell
npm run test
npm run react-build
npm run check:electron
```

Depois de alterar `electron/main.js`, `electron/preload.js` ou `electron/missionWatcher.js`, reinicie o Electron; o hot reload do React não recarrega automaticamente o processo principal. Depois de alterar o diretório de dados, teste uma instalação limpa e uma instalação sobre uma pasta existente. Depois de alterar localStorage ou migrações SQLite, teste tanto banco vazio quanto banco com dados antigos.

A última validação registrada durante esta documentação foi de **15 suítes aprovadas, 72 testes aprovados, build React compilado e checagem Electron aprovada**. Esse número deve ser atualizado sempre que novos testes forem adicionados.

## 29. Referências técnicas

[1]: https://www.electronjs.org/docs/latest/api/context-bridge "Electron — contextBridge"
[2]: https://sql.js.org/ "sql.js — SQLite compiled to WebAssembly"
[3]: https://www.electron.build/ "electron-builder — documentação oficial"
[4]: https://www.electron.build/configuration/nsis "electron-builder — configuração NSIS"

O README deve permanecer sincronizado com o código. Quando uma função mudar de caminho, quando uma chave de armazenamento for criada ou quando uma nova rota for adicionada, atualize este documento na mesma alteração para que o próximo programador consiga manter o projeto sem depender do histórico da equipe.



## 30. Interface visual 2.0.0 e responsividade

Esta seção registra as alterações visuais recentes e deve ser consultada antes de modificar `src/App.css`, `src/components/CalculatorWidget.js` ou os controladores de efeitos.

### 30.1 Componentes visuais

| Componente | Responsabilidade | Regra de manutenção |
|---|---|---|
| `VisualEffectsLayer.js` | Estrelas e ambientação espacial decorativa. | Deve permanecer sem interação e com `pointer-events: none`. O antigo Grid Scan foi removido. |
| `AnimatedContent.js` | Entrada de páginas com GSAP e IntersectionObserver. | Usar para conteúdo de tela; não animar milhares de registros individualmente. |
| `InteractionFX.js` | Faíscas curtas em cliques. | Não duplicar em controles que já tenham ripple próprio. |
| `BorderGlowController.js` | Brilho contextual de bordas em cards e painéis. | O brilho não deve alterar a geometria do layout. |
| `GlareProfileController.js` | Tilt e glare 3D no Inventário e Hangar. | Preservar cleanup, limites de rotação e desempenho em listas grandes. |
| `ContextualSpotlightController.js` | Spotlight ciano suave atrás do elemento sob o cursor. | Deve usar `pointer-events: none`, ficar atrás do conteúdo e não bloquear cliques. |
| `VisualEffectsDiagnostics.js` | Diagnóstico técnico local dos efeitos. | Não incluir inventário, tokens ou dados pessoais no log. |
| `CalculatorWidget.js` | Calculadora flutuante com Magic Bento. | Preservar a lógica SCU/cSCU e o estado `window.__EMOTO_CALCULATOR_DEBUG__`. |

### 30.2 Diagnóstico FX e Calculadora

Ao investigar a Calculadora, abra o widget, abra **Diagnóstico FX** e clique em **Atualizar**. O JSON deve registrar a existência do painel, a quantidade de teclas e os estados de spotlight, magnetismo, tilt e click effect:

```json
{
  "calculator": {
    "panelVisible": true,
    "buttonCount": 19,
    "spotlightBehindKeypad": true,
    "magnetism": true,
    "tilt": true,
    "clickEffect": true
  },
  "contextualSpotlight": {
    "enabled": true,
    "activeTargets": 1
  }
}
```

O estado `window.__EMOTO_CALCULATOR_DEBUG__` existe enquanto a calculadora está aberta e registra `keypadButtons`, `spotlightVariables`, `magnetism`, `tilt`, `clickEffect`, `visualMode` e `reducedMotion`. O log exportado contém apenas informações técnicas locais.

O spotlight da Calculadora é controlado por `--key-spotlight-x` e `--key-spotlight-y` em `.calculator-bento-keypad`. Use apenas ciano translúcido e mantenha a camada atrás dos botões, textos e ícones. Não introduza gradientes amarelos fortes ou `z-index` acima do conteúdo.

### 30.3 Responsividade e estabilidade no hover

O patch final de `src/App.css` aplica `box-sizing: border-box`, `min-width: 0`, `max-width: 100%`, `overflow-wrap: anywhere` e `word-break: break-word` nos principais cards e conteúdos. Ele também remove deslocamentos físicos de cards e botões no hover. O feedback visual deve usar borda, sombra, cor e spotlight, sem alterar a geometria do fluxo.

Antes de adicionar uma regra de hover, confirme que ela não usa `translateY`, `scale`, mudança de `padding`, `font-size` ou altura em cards que exibem números. Para listas grandes, mantenha `min-height: 0` nos containers flex/grid e defina claramente qual elemento possui rolagem.

Os grids principais usam breakpoints para telas médias e estreitas. Em janelas pequenas, Inventário, Hangar, Dashboard, Armaduras, Notas e demais grids densos devem poder usar `minmax(0, 1fr)` e uma coluna. Botões e textos devem respeitar `max-width: 100%` e permitir quebra quando necessário.

### 30.4 Transições de tela e carregamento

A troca de página é montada em `App.js` com `AnimatedContent key={activePage}`. A nova tela entra com elevação vertical curta, brilho holográfico ciano e uma varredura suave. Os primeiros registros de grids principais entram em cascata controlada; itens depois do limite aparecem imediatamente para evitar centenas de animações simultâneas em listas com mais de 2.000 registros.

A camada visual respeita o modo **Desligado**, **Econômico** e **Imersivo**. O fallback sem efeitos deve continuar funcional. O comportamento de `prefers-reduced-motion` não pode ser removido sem uma justificativa de acessibilidade.

### 30.5 Diagnóstico rápido de problemas de layout

| Sintoma | Verificação | Correção |
|---|---|---|
| Número pula no hover | Procure `transform` em `:hover` e no controlador 3D. | Remova o deslocamento; mantenha sombra/brilho. |
| Texto sai da caixa | Verifique `min-width: 0`, `max-width` e quebra de palavras. | Corrija o container, não aumente a largura fixa. |
| Botão ultrapassa o card | Verifique padding, `white-space` e largura mínima. | Use `max-width: 100%`, `line-height` e `overflow-wrap`. |
| Spotlight cobre texto | Verifique `z-index`, `isolation` e filhos posicionados. | Spotlight inferior, conteúdo acima e `pointer-events: none`. |
| Tooltip é cortado | Verifique `overflow: hidden` e `contain: paint`. | Use `overflow: visible` ou portal para o tooltip. |
| Janela estreita cria rolagem horizontal | Verifique larguras fixas e grids. | Use `minmax(0, 1fr)`, `min-width: 0` e rolagem localizada. |

### 30.6 Validação obrigatória

Antes de entregar qualquer alteração:

```powershell
npm run test
npm run react-build
npm run check:electron
npm run verify
```

O comando `npm run verify` é o mínimo obrigatório. Na validação mais recente foram aprovadas **29 suítes e 121 testes**, o build React foi compilado e `electron/main.js` passou na checagem sintática. Sempre repita os comandos após modificar o processo principal, pois o build React não valida automaticamente os handlers IPC.

### 30.7 Regras de documentação futura

Ao criar uma nova função, atualize o componente, o módulo de domínio, a persistência, a tabela de navegação e o troubleshooting. Ao criar uma chave de `localStorage`, inclua-a no backup seletivo quando representar dados do usuário. Segredos UEX nunca devem entrar em README, logs, testes, backups compartilhados ou commits.

Para mudanças visuais compartilhadas, prefira classes em `src/App.css`. Para valores derivados do estado, como cor de minério ou largura de progresso, estilos inline continuam aceitáveis. Sempre registre no README o sintoma, a causa, os arquivos modificados e o comando usado para validar.

### 30.8 Referências adicionais

[5]: https://pixijs.com/8.x/guides/getting-started/intro "PixiJS 8 — Getting Started"
[6]: https://reactbits.dev/get-started/index "React Bits — Getting Started"
[7]: https://gsap.com/docs/v3/ "GSAP — Documentation"


## 31. Estado funcional atual — revisão de manutenção

Esta seção complementa o manual técnico com as funções implementadas na revisão atual. Ela deve ser consultada antes de alterar os módulos de Armaduras, Inventário, Missões ou UEX.

### 31.1 Inventário de Itens

O `src/pages/InventoryPage.js` é responsável pelo cadastro, edição, filtragem, transferência, reservas, scripts, PAF, itens craftados e visualização detalhada dos itens. A busca global na tela inicial pesquisa todos os sistemas e locais, consolida a quantidade por sistema e local e exibe os registros correspondentes sem duplicá-los. A busca contextual aparece apenas depois que um sistema ou local foi selecionado.

A filtragem foi centralizada em `src/data/inventorySearch.js`. O utilitário `filterInventoryItems()` deve ser usado como fonte única para filtrar e ordenar os registros. Não crie um segundo `map()` de `displayItems` para a mesma pesquisa: esse foi o motivo de uma correção anterior que duplicava cards e barras de busca.

A opção de visualizar todos os itens de um sistema usa o marcador interno `__all_in_system`. Esse valor representa uma seleção virtual e nunca deve ser tratado como `location_name` real.

Cada item pode ter uma imagem principal vinculada no campo `item_image`. O formulário apresenta os botões **Vincular imagem**, **Cadastrar imagem** ou **Substituir imagem**, conforme o estado do registro. A imagem é pré-visualizada no formulário, aparece no card e no modal de detalhes, pode ser removida antes do salvamento e é limitada a 4 MB nos formatos PNG, JPEG, WEBP e GIF.

O campo `item_image` é persistido como texto JSON no SQLite. A normalização ocorre em `normalizeItemImage()` e aceita tanto o formato JSON atual quanto um data URL legado. Ao alterar o modelo, mantenha sincronizados os quatro pontos abaixo:

| Camada | Local | Responsabilidade |
|---|---|---|
| Modelo React | `emptyItem()` | Define o valor inicial `item_image: null`. |
| Normalização | `normalizeItemImage()` | Converte texto, objeto e data URL em um formato seguro para a interface. |
| Processo Electron | `electron/main.js` | Cria/migra a coluna `item_image` e grava o valor nos handlers `inventory-create` e `inventory-update`. |
| Testes | `src/data/inventoryItemImage.test.js` | Verifica JSON, data URL legado e valores vazios. |

A migração existente deve permanecer idempotente:

```js
try { db.run(`ALTER TABLE inventory_items ADD COLUMN item_image TEXT DEFAULT ''`); } catch (e) {}
```

Nunca remova a coluna em uma atualização normal. Bancos de usuários podem ter sido criados antes da versão atual.

### 31.2 Cadastro e coleção de armaduras

A seção de armaduras utiliza uma hierarquia lógica de **Base → Variante → Peças**. `AllArmorsPage.js` apresenta o catálogo; `CustomArmorPage.js` administra armaduras personalizadas; `MyCollectionPage.js` controla posse, wishlist, quantidade física, peças obtidas e sets completos.

O cadastro personalizado possui tipos de peça configuráveis. Helmet, Torso, Arms, Legs e Backpack continuam compatíveis com registros antigos, enquanto tipos como **Undersuit** e **Camiseta** podem ser cadastrados pelo gerenciador da tela. Ao remover um tipo, o sistema deve bloquear a operação se ele estiver sendo usado por alguma peça.

A coleção calcula sets completos com base nas peças realmente cadastradas na variante. A quantidade de sets completos é a menor quantidade disponível entre todas as peças necessárias. Não use uma lista fixa de quatro peças: tipos personalizados podem fazer parte de uma variante e devem ser considerados pela estrutura salva.

A limpeza de duplicidades utiliza `src/data/armorDedup.js`. A identidade canônica normaliza acentos, pontuação, base e variante. Formatos como `Novikov "Ascension"` com variante `Base` e `Novikov` com variante `Ascension` devem ser reconhecidos como a mesma identidade. A tela deve preservar um registro de referência e permitir remover somente a duplicata escolhida, com confirmação.

### 31.3 Estoque Interno UEX e armaduras

`src/pages/UexSalesPage.js` permite vincular anúncios a múltiplos locais do Inventário, ao Baú de Minério, a peças individuais da coleção e a sets completos de armaduras. O vínculo de uma peça reduz somente a quantidade daquela peça. O vínculo de um set reduz uma unidade de cada peça necessária.

A baixa é validada antes da persistência. Se qualquer peça estiver em quantidade insuficiente, nenhuma redução parcial deve ser gravada. O registro da venda deve informar quando o consumo de armadura não foi possível.

Os anúncios da UEX podem acrescentar descritores comerciais, por exemplo `Novikov "Ascension" Exploration Suit Set`. A normalização em `UexSalesPage.js` deve ignorar apenas sufixos descritivos como `Suit Set`, `Armor Set`, `Complete Set` e equivalentes, sem alterar o nome real salvo na coleção. A regra de correspondência é testada em `src/pages/UexSalesArmorMatching.test.js`.

### 31.4 Monitor Automático de Missões

O leitor do Game.log está dividido entre `electron/missionWatcher.js`, responsável pela leitura e emissão dos eventos, e `src/data/missionAutoMonitor.js`, responsável pela persistência e reconciliação com `sc_missions_v2`.

Missões automáticas devem conservar o nome humano/canônico mesmo quando o Game.log apresentar um identificador técnico. A identidade da ocorrência usa GUID quando disponível; o nome canônico é utilizado para reaproveitar informações históricas entre ocorrências diferentes.

Preferências de recompensas são persistidas na chave `sc_mission_reward_preferences_v1`. Quando uma missão automática é editada e recebe MG Scrip, Council Scrip ou ASD Secure Drive, `rememberMissionRewardPreferences()` salva a configuração por nome canônico. Uma nova ocorrência da mesma missão recebe automaticamente o tipo e a quantidade configurados. O evento posterior da ocorrência atual não deve sobrescrever uma edição manual já salva.

Os campos principais são:

| Campo | Função |
|---|---|
| `scrip_type` | `mg_scrip`, `council_scrip` ou `null`. |
| `scrip_qty` | Quantidade inteira do Scrip. |
| `secure_drive_enabled` | Indica se a missão entrega ASD Secure Drive. |
| `secure_drive_qty` | Quantidade inteira de Secure Drive. |
| `scrip_dispatched` | Indica se o despacho para o Inventário padrão já foi realizado. |
| `secure_drive_dispatched` | Indica se o despacho do Secure Drive já foi realizado. |

Os testes principais ficam em `src/data/missionAutoMonitor.test.js` e `src/data/missionAutoMonitor.integration.test.js`. Toda alteração no parser deve ser validada com missão ativa, concluída, abandonada, falha, nome técnico e reprocessamento do Game.log.

### 31.5 Alertas de Compra UEX

`src/data/uexMarketAlerts.js` contém o modelo, a filtragem, o ranking, a persistência e a verificação automática dos alertas. `src/pages/MarketAlertsPage.js` é a tela dedicada aos Alertas de Compra.

Quando o alerta possui limite de cinco anúncios, o sistema deve buscar os anúncios elegíveis, remover os ignorados pelo usuário, combinar os resultados atuais com os novos, ordenar pelo critério configurado e manter somente os cinco melhores. Um novo anúncio melhor substitui automaticamente o anúncio na pior posição. A posição `resultRank` deve ser recalculada após a substituição.

A remoção manual de um resultado não significa que ele pode voltar imediatamente na consulta seguinte. O anúncio removido deve permanecer ignorado pelo identificador correspondente. Anúncios diferentes, que posteriormente atendam aos critérios, podem ocupar a vaga liberada.

Os critérios suportados incluem preço, qualidade, oportunidade, recência, estoque, disponibilidade, atividade do vendedor e quantidade máxima de resultados. Ao modificar a ordenação, atualize o comparador, a seleção dos candidatos, a persistência do evento e os testes em `src/data/uexMarketAlerts.test.js`.

### 31.6 Persistência e diretório de dados

O processo principal usa `sql.js`: o banco SQLite é carregado em memória, alterado e exportado para o arquivo de dados após cada operação. O código de negócio não deve acessar diretamente o arquivo `.db` a partir do renderer.

As operações novas devem seguir este fluxo:

```text
React → window.electronAPI → preload.js → ipcMain.handle() → sql.js → saveDb()
```

Para qualquer nova coluna SQL, atualize simultaneamente o `CREATE TABLE`, a migração `ALTER TABLE`, o `INSERT`, o `UPDATE` e os testes. Para dados do `localStorage`, verifique se a chave deve participar do backup seletivo e documente a chave no README.

O diretório central é configurado pelo processo principal. Não use caminhos absolutos de desenvolvimento, não grave dados dentro de `build/`, `dist/` ou do diretório do código e não inclua bancos de usuário no artefato do instalador.

### 31.7 Convenções de desenvolvimento

A interface continua baseada em React sem React Router. A navegação usa `activePage` em `src/App.js`. Ao criar uma tela, atualize o grupo de navegação, o switch de renderização, a tabela de páginas do README e, se necessário, o backup seletivo.

Regras de manutenção importantes:

| Regra | Motivo |
|---|---|
| Use `useMemo` para filtros e agrupamentos derivados. | Evita recalcular milhares de registros a cada renderização. |
| Use `React.memo` em cards pesados. | Reduz renders ao alterar busca ou estado local. |
| Não anime cada item de listas grandes. | Preserva desempenho acima de 2.000 registros. |
| Não use `transform` que altere a geometria no hover de cards numéricos. | Evita textos e números pulando de linha. |
| Preserve `min-width: 0` e `box-sizing: border-box`. | Evita overflow e quebra de layout. |
| Não coloque tokens UEX em logs, testes, README ou backups compartilhados. | Protege credenciais do usuário. |
| Mantenha `pointer-events: none` nas camadas visuais. | Garante que efeitos não bloqueiem cliques. |

### 31.8 Testes e validação antes de entregar

Use os comandos abaixo na raiz do projeto:

```powershell
npm install
npm run test
npm run react-build
npm run check:electron
npm run verify
```

Para validar uma função específica:

```powershell
npm test -- --watchAll=false --runInBand src/data/inventoryItemImage.test.js
npm test -- --watchAll=false --runInBand src/data/missionAutoMonitor.test.js
npm test -- --watchAll=false --runInBand src/data/uexMarketAlerts.test.js
```

Para validar a imagem de um item, crie um item sem imagem, salve, edite e use **Vincular imagem**. Depois substitua a imagem, remova-a, salve novamente e reabra o item. Também valide um banco existente anterior à coluna `item_image` para confirmar que a migração não impede a inicialização.

Para validar filtros, cadastre dois itens diferentes, pesquise por apenas um e confirme que existe uma única barra de busca e um único card. Para validar o UEX, configure cinco resultados, remova o pior, injete ou aguarde uma oferta melhor e confirme que o limite é preenchido sem trazer de volta anúncios ignorados.

Para validar o monitor, edite uma ocorrência automática com Scrip e Secure Drive, salve, inicie uma nova ocorrência com o mesmo nome canônico e confirme que os campos são preenchidos sem edição manual.

### 31.9 Checklist para novas funcionalidades

Antes de abrir uma entrega, confirme que o comportamento está implementado no renderer, no processo Electron quando houver persistência, no mock de desenvolvimento quando aplicável, nos testes e no README. Verifique também migração de dados, compatibilidade retroativa, estados vazios, exclusão, carregamento, erro, responsividade, desempenho com volume alto e preferência de movimento reduzido.

A documentação deve registrar o motivo da alteração, a causa de bugs corrigidos, os arquivos envolvidos, as chaves persistidas, os comandos usados na validação e qualquer limitação específica do ambiente de build.


## Flags de debug controladas pelo código

As ferramentas de diagnóstico ficam centralizadas em `src/config/debugFlags.js`. Todas as flags são `false` por padrão, portanto a aplicação instalada não exibe o Diagnóstico FX nem grava telemetria técnica global desnecessária.

Para ativar uma ferramenta durante a manutenção, abra esse arquivo e descomente somente a linha marcada com `ATIVAR`. Depois reinicie o servidor de desenvolvimento ou gere uma nova build. Para desligar novamente, comente a linha e recompile.

| Flag | Ferramenta controlada |
|---|---|
| `ENABLE_FX_DIAGNOSTICS` | Botão e painel **Diagnóstico FX** no rodapé do menu lateral. |
| `ENABLE_MISSION_MONITOR_DEBUG` | Logs detalhados do Monitor Automático de Missões no console. |
| `ENABLE_CALCULATOR_DEBUG` | Estado técnico global da calculadora Magic Bento. |
| `ENABLE_PROFILE_DEBUG` | Telemetria dos cards 3D/profile do Inventário e Hangar. |
| `ENABLE_LAYOUT_DEBUG` | Reservada para diagnósticos técnicos de estabilidade de layout. |
| `ENABLE_DEBUG_CONSOLE` | Reservada para logs técnicos auxiliares gerais. |

Exemplo de ativação temporária:

```js
export const ENABLE_FX_DIAGNOSTICS = false;
export const ENABLE_FX_DIAGNOSTICS = true; // ATIVAR: Diagnóstico FX visual
```

Não transforme essas flags em uma preferência de `localStorage`: elas existem para uso do programador e devem permanecer sob controle do código-fonte. Antes de publicar uma build, confirme que todas as linhas `ATIVAR` estão comentadas.
