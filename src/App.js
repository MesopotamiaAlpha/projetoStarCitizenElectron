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
import BackupPage         from './pages/BackupPage';
import DataDirectoryPage  from './pages/DataDirectoryPage';
import NotesPage          from './pages/NotesPage';
import LocationsAdminPage from './pages/LocationsAdminPage';
import UexSalesPage       from './pages/UexSalesPage';
import UexNegotiationsPage from './pages/UexNegotiationsPage';
import WikeloTrackerPage  from './pages/WikeloTrackerPage';
import UexNotificationBell from './components/UexNotificationBell';
import CalculatorWidget from './components/CalculatorWidget';
import { Shield, Package, BarChart3, ChevronRight, ChevronDown, PlusCircle, Archive, Cpu, Pickaxe, ListChecks, Hammer, Globe, Users, ShoppingBag, Star, MessageSquare, Lock, Save, Edit3, Menu, PanelLeftClose, FolderCog } from 'lucide-react';
import { setBatchProvenance, SOURCES } from './data/provenance';

/* ── Mock API (browser fallback) ─────────────────────────────────────────── */
function buildMockAPI() {
  const KEY = 'sc_armor_v3';
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
      state[`p${id}o`]=n; state[`p${id}d`]=n?new Date().toISOString():null;
      save(state); return {owned:n};
    },
    togglePieceWishlist: async (id) => {
      const state=load();
      state[`p${id}w`]=(state[`p${id}w`]||0)?0:1;
      save(state); return {wishlist:state[`p${id}w`]};
    },
    updatePieceNotes: async (id,notes) => {
      const state=load(); state[`p${id}n`]=notes; save(state); return {success:true};
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
    deleteCustomPiece: async (pieceId) => {
      const state=load();
      state._custom=(state._custom||[]).map(s=>({...s,pieces:(s.pieces||[]).filter(p=>p.id!==pieceId)}));
      save(state); return {success:true};
    },
  };
}

export const api = window.electronAPI || buildMockAPI();

const NAV_GROUPS = [
  { id:'inicio', label:'Início', pages:[
    { id:'dashboard',  label:'Dashboard',          icon:BarChart3  },
  ]},
  { id:'armaduras', label:'Armaduras', pages:[
    { id:'all',        label:'Todas as Armaduras',  icon:Shield     },
    { id:'collection', label:'Minha Coleção',       icon:Package    },
    { id:'custom',     label:'Cadastrar Armadura',  icon:PlusCircle },
  ]},
  { id:'itens', label:'Itens & Crafting', pages:[
    { id:'inventory',  label:'Inventário de Itens', icon:Archive    },
    { id:'blueprints', label:'Blueprints',          icon:Cpu        },
    { id:'materials',  label:'Tracking Materiais',  icon:Hammer     },
  ]},
  { id:'mineracao', label:'Mineração', pages:[
    { id:'mining',       label:'Guia de Mineração',  icon:Pickaxe },
    { id:'mininggroup',  label:'Mineração em Grupo', icon:Users   },
    { id:'orevault',     label:'Baú de Minério',     icon:Archive },
  ]},
  { id:'cla', label:'Clã & Missões', pages:[
    { id:'clanvault',  label:'Cofre do Clã', icon:Lock       },
    { id:'missions',   label:'Missões',      icon:ListChecks },
  ]},
  { id:'uex', label:'UEX', pages:[
    { id:'uexsales',        label:'Acompanhamento UEX',   icon:ShoppingBag   },
    { id:'uexnegotiations', label:'Negociações UEX',      icon:MessageSquare },
    { id:'wikelo',          label:'Acompanhamento Wikelo',icon:Star          },
    { id:'uexapi',          label:'UEX API (Live)',       icon:Globe         },
  ]},
  { id:'sistema', label:'Sistema', pages:[
    { id:'backup', label:'Backup & Restauração', icon:Save },
    { id:'data-directory', label:'Diretório de Dados', icon:FolderCog },
    { id:'notes',  label:'Bloco de Notas',          icon:Edit3 },
    { id:'locations', label:'Adicionar Local',       icon:Globe  },
  ]},
];
const PAGES = NAV_GROUPS.flatMap(g => g.pages);
const NAV_COLLAPSE_KEY = 'sc_nav_collapsed_groups_v1';
const SIDEBAR_COLLAPSED_KEY = 'sc_sidebar_collapsed_v1';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [sets,       setSets]       = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NAV_COLLAPSE_KEY)) || []; } catch { return []; }
  });

  function toggleSidebar() {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0'); } catch {}
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

  function goToPage(pageId) {
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
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
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
            return (
              <div key={group.id} className="nav-group">
                <button className="nav-group-header" onClick={()=>toggleGroup(group.id)}>
                  <span>{group.label}</span>
                  <ChevronDown size={12} className={`nav-group-chevron ${isCollapsed?'collapsed':''}`}/>
                </button>
                {!isCollapsed && group.pages.map(({id,label,icon:Icon})=>(
                  <button key={id} className={`nav-item ${activePage===id?'active':''}`} onClick={()=>goToPage(id)} title={sidebarCollapsed ? label : undefined}>
                    <Icon size={16} />
                    <span>{label}</span>
                    {id==='custom'&&customCount>0 ? (
                      <span style={{ marginLeft:'auto',fontFamily:'Share Tech Mono,monospace',fontSize:10,background:'rgba(56,189,248,0.15)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'1px 6px',color:'var(--accent-primary)' }}>{customCount}</span>
                    ) : activePage===id ? (
                      <ChevronRight size={13} className="nav-arrow" />
                    ) : null}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span className="version-badge">v1.0</span>
        </div>
      </aside>

      <main className="main-content">
        {activePage==='dashboard'  && <DashboardPage    sets={sets} stats={stats} onNavigate={goToPage} />}
        {activePage==='all'        && <TodosArmorsPage    sets={sets} onTogglePiece={handleTogglePiece} onTogglePieceWishlist={handleTogglePieceWishlist} onupdatePieceNotes={handleupdatePieceNotes} />}
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
        {activePage==='uexsales'   && <UexSalesPage />}
        {activePage==='uexnegotiations' && <UexNegotiationsPage />}
        {activePage==='wikelo'     && <WikeloTrackerPage />}
        {activePage==='uexapi'     && <UexApiPage />}
        {activePage==='backup'     && <BackupPage />}
        {activePage==='data-directory' && <DataDirectoryPage />}
        {activePage==='notes'      && <NotesPage />}
        {activePage==='locations'   && <LocationsAdminPage />}
      </main>

      <UexNotificationBell onNavigate={goToPage} />
      <CalculatorWidget />
    </div>
  );
}