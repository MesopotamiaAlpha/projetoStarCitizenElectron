import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import EmotoIcon          from './components/EmotoIcon';
import TodosArmorsPage    from './pages/AllArmorsPage';
import MyCollectionPage from './pages/MyCollectionPage';
import DashboardPage    from './pages/DashboardPage';
import CustomArmorPage  from './pages/CustomArmorPage';
import InventoryPage    from './pages/InventoryPage';
import BlueprintPage       from './pages/BlueprintPage';
import MaterialTrackerPage from './pages/MaterialTrackerPage';
import MiningPage         from './pages/MiningPage';
import MiningGrupoPage    from './pages/MiningGroupPage';
import ClanVaultPage      from './pages/ClanVaultPage';
import MissionTrackerPage from './pages/MissionTrackerPage';
import OreVaultPage      from './pages/OreVaultPage';
import UexApiPage         from './pages/UexApiPage';
import UexInsightsPage    from './pages/UexInsightsPage';
import MarketAlertsPage   from './pages/MarketAlertsPage';
import BackupPage         from './pages/BackupPage';
import DataDirectoryPage  from './pages/DataDirectoryPage';
import NotesPage          from './pages/NotesPage';
import SystemAdminPage from './pages/SystemAdminPage';
import UsefulLinksPage from './pages/UsefulLinksPage';
import UexSalesPage       from './pages/UexSalesPage';
import UexNegotiationsPage from './pages/UexNegotiationsPage';
import WikeloTrackerPage  from './pages/WikeloTrackerPage';
import ShipHangarPage     from './pages/ShipHangarPage';
import UexNotificationBell from './components/UexNotificationBell';
import CalculatorWidget from './components/CalculatorWidget';
import ContextHelpOverlay from './components/ContextHelpOverlay';
import VisualEffectsLayer from './components/VisualEffectsLayer';
import AnimatedContent from './components/AnimatedContent';
import InteractionFX from './components/InteractionFX';
import VisualEffectsDiagnostics from './components/VisualEffectsDiagnostics';
import BorderGlowController from './components/BorderGlowController';
import CardNavEnhancer from './components/CardNavEnhancer';
import GlareProfileController from './components/GlareProfileController';
import ContextualSpotlightController from './components/ContextualSpotlightController';
import { Shield, Package, BarChart3, ChevronRight, ChevronDown, PlusCircle, Archive, Cpu, Pickaxe, ListChecks, Hammer, Globe, Users, ShoppingBag, Star, MessageSquare, Lock, Save, Edit3, Menu, PanelLeftClose, FolderCog, Rocket, TrendingUp, Bell, Link2 } from 'lucide-react';
import { setBatchProvenance, SOURCES } from './data/provenance';

import { appendMissionAutoMonitorEvent, setMissionAutoMonitorStatus, upsertAutomaticMissionRecord, updateStoredMissionRecord } from './data/missionAutoMonitor';
import { dispatchMissionRewardsToDefaultInventory } from './data/missionRewardDispatch';
import { getMissionAdminOptions, loadMissionAdmin } from './data/missionAdmin';
import { getArmorIdentity, getDuplicateArmorGroups } from './data/armorDedup';

// Diagnóstico FX desativado para usuários finais.
// Para ativar durante o desenvolvimento, descomente a próxima linha.
let ENABLE_FX_DIAGNOSTICS = false;
// ENABLE_FX_DIAGNOSTICS = true;

/* ── Mock API (browser fallback) ─────────────────────────────────────────── */
function buildMockAPI() {
  const KEY = 'companheiro_emoto_mock_v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY))||{}; } catch { return {}; } };
  const save = d => localStorage.setItem(KEY, JSON.stringify(d));

  const MOCK = [
    { id:1, base_name:'Calico', variant_name:'Base', manufacturer:'Kastak Arms', type:'Light',
      category:'Combat', rarity:'Comum', description:'EVA-compliant light combat suit.',
      lore:'', tags:'["Light","Combat"]', added_version:'3.0', is_custom:0, set_name:'Calico',
      pieces:[
        {id:1001,set_id:1,piece_type:'Helmet',piece_name:'Calico Helmet',resistance_physical:8,resistance_energy:6,resistance_distortion:4,resistance_thermal:5,resistance_biochemical:3,resistance_stun:3,mobility_penalty:2,slots:0,is_lootable:0,is_purchasable:1,buy_location:'Area18 - Cubby Blast',how_to_get:'Compre em Cubby Blast, Area18.',price_auec:3200,description:'Capacete leve PAB-3.',owned:0,wishlist:0,notes:'',obtained_date:null},
        {id:1002,set_id:1,piece_type:'Torso',piece_name:'Calico Core',resistance_physical:10,resistance_energy:8,resistance_distortion:5,resistance_thermal:6,resistance_biochemical:4,resistance_stun:4,mobility_penalty:3,slots:2,is_lootable:0,is_purchasable:1,buy_location:'Area18 - Cubby Blast',how_to_get:'Cubby Blast ou ARC-L1.',price_auec:4100,description:'Peitoral leve modular.',owned:0,wishlist:0,notes:'',obtained_date:null},
        {id:1003,set_id:1,piece_type:'Arms',piece_name:'Calico Arms',resistance_physical:7,resistance_energy:5,resistance_distortion:3,resistance_thermal:4,resistance_biochemical:2,resistance_stun:2,mobility_penalty:1,slots:1,is_lootable:0,is_purchasable:1,buy_location:'Area18 - Cubby Blast',how_to_get:'Cubby Blast.',price_auec:2800,description:'Braços leves.',owned:0,wishlist:0,notes:'',obtained_date:null},
        {id:1004,set_id:1,piece_type:'Legs',piece_name:'Calico Legs',resistance_physical:7,resistance_energy:5,resistance_distortion:3,resistance_thermal:4,resistance_biochemical:2,resistance_stun:2,mobility_penalty:1,slots:1,is_lootable:0,is_purchasable:1,buy_location:'Area18 - Cubby Blast',how_to_get:'Cubby Blast ou Port Tressler.',price_auec:2800,description:'Perneiras leves.',owned:0,wishlist:0,notes:'',obtained_date:null},
      ],
    },
  ];

  function hydrate(sets, state) {
    return sets.map(s=>({
      ...s,
      pieces:(s.pieces||[]).map(p=>({
        ...p,
        owned:state[`p${p.id}o`]||0,
        quantity: state[`p${p.id}q`] !== undefined ? Math.max(0, Number(state[`p${p.id}q`]) || 0) : (state[`p${p.id}o`] ? 1 : 0),
        wishlist:state[`p${p.id}w`]||0,
        notes:state[`p${p.id}n`]||'',
        obtained_date:state[`p${p.id}d`]||null,
      })),
    }));
  }

  return {
    getAllSets: async () => {
      const state=load();
      return hydrate([...MOCK,...(state._custom||[])], state);
    },
    togglePiece: async (id) => {
      const state=load();
      const n=(state[`p${id}o`]||0)?0:1;
      state[`p${id}o`]=n; state[`p${id}q`]=n ? Math.max(1, Number(state[`p${id}q`]) || 1) : 0; state[`p${id}d`]=n?new Date().toISOString():null;
      save(state); return {owned:n, quantity:state[`p${id}q`]};
    },
    togglePieceWishlist: async (id) => {
      const state=load();
      state[`p${id}w`]=(state[`p${id}w`]||0)?0:1;
      save(state); return {wishlist:state[`p${id}w`]};
    },
    updatePieceNotes: async (id,notes) => {
      const state=load(); state[`p${id}n`]=notes; save(state); return {success:true};
    },
    updatePieceQuantity: async (id, quantity) => {
      const state=load();
      const nextQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
      state[`p${id}q`] = nextQuantity;
      state[`p${id}o`] = nextQuantity > 0 ? 1 : 0;
      state[`p${id}d`] = nextQuantity > 0 ? (state[`p${id}d`] || new Date().toISOString()) : null;
      save(state); return {success:true, quantity:nextQuantity, owned:state[`p${id}o`]};
    },
    getStats: async () => {
      const state=load();
      const all=[...MOCK,...(state._custom||[])];
      const totalSets=all.length;
      const totalPieces=all.reduce((a,s)=>a+(s.pieces||[]).length,0);
      const ownedPieces=all.reduce((a,s)=>a+(s.pieces||[]).filter(p=>state[`p${p.id}o`]).length,0);
      const wishlistPieces=all.reduce((a,s)=>a+(s.pieces||[]).filter(p=>state[`p${p.id}w`]).length,0);
      const completeSets=all.filter(s=>(s.pieces||[]).length>0&&(s.pieces||[]).every(p=>state[`p${p.id}o`])).length;
      const byTipo=['Light','Médio','Heavy','Special'].map(type=>({
        type,
        total_sets:all.filter(s=>s.type===type).length,
        total_pieces:all.filter(s=>s.type===type).reduce((a,s)=>a+(s.pieces||[]).length,0),
        owned_pieces:all.filter(s=>s.type===type).reduce((a,s)=>a+(s.pieces||[]).filter(p=>state[`p${p.id}o`]).length,0),
      }));
      return {totalSets,totalPieces,ownedPieces,wishlistPieces,byTipo,completeSets};
    },
    createCustomSet: async ({set,pieces}) => {
      const state=load();
      const all=[...MOCK,...(state._custom||[])];
      if (all.some(existing => getArmorIdentity(existing) === getArmorIdentity(set))) return {success:false,duplicate:true,error:'Esta armadura já está cadastrada.'};
      const id=Date.now();
      const newPieces=(pieces||[]).map((p,i)=>({...p,id:id*100+i+1,set_id:id,is_lootable:p.is_lootable?1:0,is_purchasable:p.is_purchasable?1:0,owned:0,wishlist:0,notes:'',obtained_date:null}));
      const ns={...set,id,is_custom:1,set_name:set.variant_name&&set.variant_name!=='Base'?`${set.base_name||set.set_name} — ${set.variant_name}`:set.base_name||set.set_name,pieces:newPieces};
      state._custom=[...(state._custom||[]),ns]; save(state); return {success:true,setId:id};
    },
    updateCustomSet: async (setId,set) => {
      const state=load();
      state._custom=(state._custom||[]).map(s=>s.id===setId?{...s,...set}:s);
      save(state); return {success:true};
    },
    updateCustomPiece: async (pieceId,piece) => {
      const state=load();
      state._custom=(state._custom||[]).map(s=>({...s,pieces:(s.pieces||[]).map(p=>p.id===pieceId?{...p,...piece,is_lootable:piece.is_lootable?1:0,is_purchasable:piece.is_purchasable?1:0}:p)}));
      save(state); return {success:true};
    },
    addPieceToSet: async (setId,piece) => {
      const state=load();
      const newId=Date.now()+Math.floor(Math.random()*999);
      state._custom=(state._custom||[]).map(s=>s.id===setId?{...s,pieces:[...(s.pieces||[]),{...piece,id:newId,set_id:setId,is_lootable:piece.is_lootable?1:0,is_purchasable:piece.is_purchasable?1:0,owned:0,wishlist:0,notes:'',obtained_date:null}]}:s);
      save(state); return {success:true};
    },
    deleteCustomSet: async (setId) => {
      const state=load(); state._custom=(state._custom||[]).filter(s=>s.id!==setId); save(state); return {success:true};
    },
    getDuplicateCustomSets: async () => {
      const state=load();
      return getDuplicateArmorGroups(state._custom||[]);
    },
    deleteCustomSets: async (ids) => {
      const state=load();
      const selected=new Set((Array.isArray(ids)?ids:[]).map(Number));
      state._custom=(state._custom||[]).filter(set => !selected.has(Number(set.id)));
      save(state); return {success:true,deleted:[...selected]};
    },
    deleteCustomPiece: async (pieceId) => {
      const state=load();
      state._custom=(state._custom||[]).map(s=>({...s,pieces:(s.pieces||[]).filter(p=>p.id!==pieceId)}));
      save(state); return {success:true};
    },
  };
}

function buildUnavailableAPI() {
  const message = 'A ponte Electron não foi carregada. Feche e reinstale o Companheiro Emoto; dados de demonstração não serão usados no aplicativo instalado.';
  return new Proxy({}, {
    get: () => async () => { throw new Error(message); },
  });
}

const hasElectronBridge = Boolean(window.electronAPI?.isCompanheiroEmotoElectron);
const isPackagedElectron = typeof window !== 'undefined' && window.location?.protocol === 'file:';
if (isPackagedElectron && !hasElectronBridge) {
  // Diagnóstico deliberado: uma instalação empacotada nunca deve cair no mock.
  // No navegador de desenvolvimento/prévia o mock continua permitido.
  console.error('Companheiro Emoto: preload.js não carregado; API mock bloqueada no aplicativo empacotado.');
}

export const api = hasElectronBridge
  ? window.electronAPI
  : (isPackagedElectron ? buildUnavailableAPI() : buildMockAPI());

const NAV_GROUPS = [
  { id:'inicio', label:'Início', hint:'Visão geral', accent:'#38bdf8', groupIcon:BarChart3, pages:[
    { id:'dashboard',  label:'Dashboard',          icon:BarChart3  },
  ]},
  { id:'armaduras', label:'Armaduras', hint:'Coleção e proteção', accent:'#a78bfa', groupIcon:Shield, pages:[
    { id:'all',        label:'Todas as Armaduras',  icon:Shield     },
    { id:'collection', label:'Minha Coleção',       icon:Package    },
    { id:'custom',     label:'Cadastrar Armadura',  icon:PlusCircle },
  ]},
  { id:'itens', label:'Itens & Crafting', hint:'Inventário e projetos', accent:'#22d3ee', groupIcon:Package, pages:[
    { id:'inventory',  label:'Inventário de Itens', icon:Archive    },
    { id:'blueprints', label:'Blueprints',          icon:Cpu        },
    { id:'materials',  label:'Tracking Materiais',  icon:Hammer     },
  ]},
  { id:'mineracao', label:'Mineração', hint:'Extração e armazenamento', accent:'#34d399', groupIcon:Pickaxe, pages:[
    { id:'mining',       label:'Guia de Mineração',  icon:Pickaxe },
    { id:'mininggroup', label:'Mineração em Grupo', icon:Users   },
    { id:'orevault',     label:'Baú de Minério',     icon:Archive },
  ]},
  { id:'cla', label:'Clã & Missões', hint:'Operações compartilhadas', accent:'#fb923c', groupIcon:Users, pages:[
    { id:'clanvault',  label:'Cofre do Clã', icon:Lock       },
    { id:'missions',   label:'Missões',      icon:ListChecks },
  ]},
  { id:'uex', label:'UEX', hint:'Mercado e negociações', accent:'#fbbf24', groupIcon:TrendingUp, pages:[
    { id:'uexsales',        label:'Acompanhamento UEX',   icon:ShoppingBag   },
    { id:'uexnegotiations', label:'Negociações UEX',      icon:MessageSquare },
    { id:'wikelo',          label:'Acompanhamento Wikelo',icon:Star          },
    { id:'uexapi',          label:'UEX API (Live)',       icon:Globe         },
    { id:'uexinsights',     label:'Inteligência UEX',     icon:TrendingUp    },
    { id:'uexalerts',       label:'Alertas de Compra',     icon:Bell           },
    { id:'shiphangar',      label:'Hangar de Naves',      icon:Rocket         },
  ]},
  { id:'sistema', label:'Sistema', hint:'Dados e configurações', accent:'#94a3b8', groupIcon:FolderCog, pages:[
    { id:'backup', label:'Backup & Restauração', icon:Save },
    { id:'data-directory', label:'Diretório de Dados', icon:FolderCog },
    { id:'notes',  label:'Bloco de Notas',          icon:Edit3 },
    { id:'system-admin', label:'Administradores do Sistema', icon:FolderCog },
    { id:'useful-links', label:'Links Úteis', icon:Link2 },
  ]},
];

const PAGES = NAV_GROUPS.flatMap(g => g.pages);
const NAV_COLLAPSE_KEY = 'sc_nav_collapsed_groups_v1';
const SIDEBAR_COLLAPSED_KEY = 'sc_sidebar_collapsed_v1';
const PAGE_HEADER_COLLAPSED_KEY = 'sc_page_header_collapsed_v1';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [pendingNegotiationHash, setPendingNegotiationHash] = useState('');
  const [sets,       setSets]       = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved !== null) return saved === '1';
    } catch {}
    return typeof window !== 'undefined' && window.innerWidth <= 560;
  });
  const [pageHeaderCollapsed, setPageHeaderCollapsed] = useState(() => {
    try { return localStorage.getItem(PAGE_HEADER_COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NAV_COLLAPSE_KEY)) || []; } catch { return []; }
  });
  const [visualMode, setVisualMode] = useState(() => {
    try {
      const saved = localStorage.getItem('companheiro_emoto_visual_mode_v2');
      if (saved === 'off' || saved === 'economic' || saved === 'immersive') return saved;
    } catch {}
    return 'economic';
  });

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onMissionMonitorEvent || !api?.onMissionMonitorStatus) return undefined;
    const cleanEvent = api.onMissionMonitorEvent(async event => {
      const catalog = loadMissionAdmin();
      const typeNames = getMissionAdminOptions('types', '', catalog).map(option => option.name);
      const mission = upsertAutomaticMissionRecord(event, typeNames);
      if (event?.type === 'mission_complete' && mission) {
        const rewardResult = await dispatchMissionRewardsToDefaultInventory(mission);
        updateStoredMissionRecord(rewardResult.mission || mission);
      }
      appendMissionAutoMonitorEvent(event);
    });
    const cleanStatus = api.onMissionMonitorStatus(status => setMissionAutoMonitorStatus(status));
    return () => {
      if (typeof cleanEvent === 'function') cleanEvent();
      if (typeof cleanStatus === 'function') cleanStatus();
    };
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }

  function togglePageHeader() {
    setPageHeaderCollapsed(previous => {
      const next = !previous;
      try { localStorage.setItem(PAGE_HEADER_COLLAPSED_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }

  function cycleVisualMode() {
    setVisualMode(previous => {
      const next = previous === 'off' ? 'economic' : previous === 'economic' ? 'immersive' : 'off';
      try { localStorage.setItem('companheiro_emoto_visual_mode_v2', next); } catch {}
      return next;
    });
  }

  function toggleGroup(groupId) {
    setCollapsedGroups(prev => {
      const next = prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId];
      localStorage.setItem(NAV_COLLAPSE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function goToPage(pageId, options = {}) {
    if (pageId === 'uexnegotiations') {
      setPendingNegotiationHash(String(options?.negotiationHash || '').trim());
    } else {
      setPendingNegotiationHash('');
    }
    setActivePage(pageId);
    // Garante que a seção da página escolhida esteja aberta
    const group = NAV_GROUPS.find(g => g.pages.some(p => p.id === pageId));
    if (group && collapsedGroups.includes(group.id)) {
      setCollapsedGroups(prev => {
        const next = prev.filter(g => g !== group.id);
        localStorage.setItem(NAV_COLLAPSE_KEY, JSON.stringify(next));
        return next;
      });
    }
  }

  const loadData = useCallback(async () => {
    try {
      const [allSets, statsData] = await Promise.all([api.getAllSets(), api.getStats()]);
      setSets(allSets);
      setStats(statsData);
      // Record provenance for seeded armors (local DB)
      const seedSets  = allSets.filter(s => !s.is_custom);
      const customSets= allSets.filter(s =>  s.is_custom);
      if (seedSets.length > 0) {
        setBatchProvenance('armor', [...new Set(seedSets.map(s => s.base_name))], SOURCES.SEED);
      }
      if (customSets.length > 0) {
        setBatchProvenance('armor', [...new Set(customSets.map(s => s.base_name))], SOURCES.CUSTOM);
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTogglePiece         = async id     => { await api.togglePiece(id);         await loadData(); };
  const handleTogglePieceWishlist = async id     => { await api.togglePieceWishlist(id);  await loadData(); };
  const handleupdatePieceNotes    = async (id,n) => { await api.updatePieceNotes(id,n);   await loadData(); };
  const handleUpdatePieceQuantity = async (id,qty) => { await api.updatePieceQuantity(id,qty); await loadData(); };

  if (loading) return (
    <div className="app-loading">
      <div className="loading-inner">
        <EmotoIcon size={48} className="loading-icon" />
        <div className="loading-text">INICIALIZANDO COMPANHEIRO EMOTO</div>
        <div className="loading-bar"><div className="loading-bar-fill" /></div>
      </div>
    </div>
  );

  const customCount = sets.filter(s=>s.is_custom).length;

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${pageHeaderCollapsed ? 'page-header-collapsed' : ''} visual-mode-${visualMode}`}>
      <VisualEffectsLayer mode={visualMode} activePage={activePage} />
      <BorderGlowController mode={visualMode} />
      <CardNavEnhancer mode={visualMode} />
      <GlareProfileController mode={visualMode} />
      <ContextualSpotlightController mode={visualMode} />
      <aside className="sidebar">
        <div className="sidebar-logo">
          <EmotoIcon size={30} className="logo-icon" />
          <div className="logo-text">
            <span className="logo-main">EMOTO</span>
            <span className="logo-sub">COMPANHEIRO</span>
          </div>
          <button className="sidebar-toggle" onClick={toggleSidebar} title={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'} aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}>
            {sidebarCollapsed ? <Menu size={18}/> : <PanelLeftClose size={17}/>}
          </button>
        </div>
        <nav className="sidebar-nav">
          {NAV_GROUPS.map(group => {
            const isCollapsed = collapsedGroups.includes(group.id);
            const hasActivePage = group.pages.some(page => page.id === activePage);
            const GroupIcon = group.groupIcon || FolderCog;
            return (
              <div key={group.id} className={`nav-group ${hasActivePage ? 'has-active' : ''}`} style={{ '--group-accent': group.accent }}>
                <button className="nav-group-header" onClick={()=>toggleGroup(group.id)} aria-expanded={!isCollapsed} aria-controls={`nav-group-${group.id}`}>
                  <span className="nav-group-heading"><span className="nav-group-icon"><GroupIcon size={13} /></span><span className="nav-group-copy"><strong>{group.label}</strong><small>{group.hint}</small></span></span>
                  <span className="nav-group-meta"><span className="nav-group-count">{group.pages.length}</span><ChevronDown size={13} className={`nav-group-chevron ${isCollapsed?'collapsed':''}`}/></span>
                </button>
                {!isCollapsed && <div id={`nav-group-${group.id}`} className="nav-group-items">{group.pages.map(({id,label,icon:Icon})=>(
                  <button key={id} data-page-id={id} className={`nav-item ${activePage===id?'active':''}`} onClick={()=>goToPage(id)} title={sidebarCollapsed ? label : undefined} style={{ '--item-accent': group.accent }}>
                    <span className="nav-item-icon"><Icon size={16} /></span>
                    <span className="nav-item-label">{label}</span>
                    {id==='custom'&&customCount>0 ? (
                      <span className="nav-item-badge">{customCount}</span>
                    ) : activePage===id ? (
                      <ChevronRight size={13} className="nav-arrow" />
                    ) : null}
                  </button>
                ))}</div>}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button className="visual-mode-toggle" type="button" onClick={cycleVisualMode} title="Alternar efeitos visuais da versão 2.0.0" aria-label={`Efeitos visuais: ${visualMode}`}>
            <span className="visual-mode-dot" />
            <span>{visualMode === 'off' ? 'Efeitos desligados' : visualMode === 'economic' ? 'Efeitos econômicos' : 'Efeitos imersivos'}</span>
          </button>
          {ENABLE_FX_DIAGNOSTICS && <VisualEffectsDiagnostics mode={visualMode} activePage={activePage} />}
          <span className="version-badge">v2.0.0</span>
        </div>
      </aside>

      <main className="main-content">
        <button
          type="button"
          className="page-header-toggle"
          onClick={togglePageHeader}
          aria-pressed={pageHeaderCollapsed}
          title={pageHeaderCollapsed ? 'Expandir informações da tela' : 'Recolher informações da tela'}
        >
          {pageHeaderCollapsed ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span>{pageHeaderCollapsed ? 'Expandir detalhes' : 'Recolher detalhes'}</span>
        </button>
        <AnimatedContent key={activePage} className="page-transition-shell" direction="vertical" distance={18} duration={0.45} allowMotion={visualMode !== 'off'}>
          <div data-active-page={activePage}>
          {activePage==='dashboard'  && <DashboardPage    sets={sets} stats={stats} onNavigate={goToPage} />}
          {activePage==='all'        && <TodosArmorsPage    sets={sets} onTogglePiece={handleTogglePiece} onTogglePieceWishlist={handleTogglePieceWishlist} onupdatePieceNotes={handleupdatePieceNotes} onUpdatePieceQuantity={handleUpdatePieceQuantity} />}
          {activePage==='collection' && <MyCollectionPage sets={sets} stats={stats} onTogglePiece={handleTogglePiece} onTogglePieceWishlist={handleTogglePieceWishlist} onupdatePieceNotes={handleupdatePieceNotes} onUpdatePieceQuantity={handleUpdatePieceQuantity} />}
          {activePage==='inventory'  && <InventoryPage />}
          {activePage==='blueprints' && <BlueprintPage />}
          {activePage==='materials'  && <MaterialTrackerPage />}
          {activePage==='custom'     && <CustomArmorPage  sets={sets} onAtualizar={loadData} />}
          {activePage==='mining'     && <MiningPage />}
          {activePage==='mininggroup' && <MiningGrupoPage />}
          {activePage==='clanvault' && <ClanVaultPage />}
          {activePage==='missions'   && <MissionTrackerPage />}
          {activePage==='orevault'   && <OreVaultPage />}
          {activePage==='uexsales'   && <UexSalesPage armorSets={sets} />}
          {activePage==='uexnegotiations' && (
            <UexNegotiationsPage
              targetNegotiationHash={pendingNegotiationHash}
              onTargetNegotiationConsumed={() => setPendingNegotiationHash('')}
            />
          )}
          {activePage==='wikelo'     && <WikeloTrackerPage />}
          {activePage==='uexapi'     && <UexApiPage />}
          {activePage==='uexinsights' && <UexInsightsPage onNavigate={goToPage} />}
          {activePage==='uexalerts' && <MarketAlertsPage onNavigate={goToPage} />}
          {activePage==='shiphangar' && <ShipHangarPage onNavigate={goToPage} />}
          {activePage==='backup'     && <BackupPage />}
          {activePage==='data-directory' && <DataDirectoryPage />}
          {activePage==='notes'      && <NotesPage />}
          {activePage==='system-admin' && <SystemAdminPage />}
          {activePage==='useful-links' && <UsefulLinksPage />}
          </div>
        </AnimatedContent>
      </main>

      <InteractionFX allowMotion={visualMode !== 'off'} />
      <UexNotificationBell onNavigate={goToPage} />
      <CalculatorWidget />
      <ContextHelpOverlay />
    </div>
  );
}