# SC Armor Tracker v4.3.0
**Star Citizen Toolbox — Armor, Blueprints, Missions, Mining & More**

## Instalação

### Pré-requisitos
- **Node.js** 18+ (https://nodejs.org)
- **npm** (incluído com Node.js)

### Passos

```bash
# 1. Entre na pasta do projeto
cd sc-armor-tracker

# 2. Instale as dependências (apenas na primeira vez)
npm install

# 3. Rode em modo desenvolvimento
npm run dev
```

O app abre automaticamente em uma janela Electron.

---

## Funcionalidades

| Aba | Descrição |
|-----|-----------|
| 🏠 Dashboard | Visão geral e estatísticas |
| 🛡️ Todas as Armaduras | Browse e tracking de todas as armaduras por variante |
| 📦 Minha Coleção | Peças obtidas, wishlist e progresso |
| 🗄️ Inventário | Rastreador de itens, locais, containers |
| 🔧 Blueprints | Blueprints de crafting com fila de materiais |
| ⚒️ Tracking Materiais | Lista consolidada de materiais para craftar |
| 📋 Missões | Rastreador com timer, gráficos, divisão por crew |
| ⚡ Calculadora DPS | Loadout de armas por nave |
| 📈 Trade Hub | Rotas de comércio e lucro |
| ⛏️ Mineração | Guia completo de minérios, lasers e locais |
| 📦 Cargo Loader | Planejador de carga |
| 👥 Battle Buddy | Roster de crew e wingmen |
| 🗺️ Market Finder | Onde encontrar cada item |
| 🌐 UEX API | Dados em tempo real da API UEX Corp |
| ✏️ Editor de Dados | Edite qualquer dado estático das ferramentas |
| ➕ Cadastrar Armadura | Adicione armaduras personalizadas |

---

## Estrutura do Projeto

```
sc-armor-tracker/
├── electron/
│   ├── main.js       ← Backend Electron + SQLite
│   └── preload.js    ← Bridge Electron ↔ React
├── src/
│   ├── App.js        ← Roteamento principal
│   ├── App.css       ← Tema sci-fi dark
│   ├── components/
│   │   ├── ArmorSetCard.js
│   │   ├── ArmorSetModal.js
│   │   └── ProvenanceBadge.js   ← Badge de origem dos dados
│   ├── data/
│   │   ├── provenance.js        ← Sistema de rastreamento de fonte
│   │   └── materialQueue.js     ← Fila de crafting de materiais
│   └── pages/                   ← Todas as telas
└── public/
```

---

## Banco de Dados

O banco SQLite fica em:
- **Windows:** `%APPDATA%\sc-armor-tracker\sc_armor_tracker_v3.db`
- **macOS:** `~/Library/Application Support/sc-armor-tracker/`
- **Linux:** `~/.config/sc-armor-tracker/`

---

## Versão do Jogo
Compatível com **Star Citizen 4.8**
