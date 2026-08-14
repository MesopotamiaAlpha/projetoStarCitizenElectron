import React, { useState, useEffect, useMemo, useCallback } from 'react';

// ── Leitura do inventário ──────────────────────────────────────────────────
// IMPORTANTE: no app Electron (uso real), o inventário é salvo via IPC
// (window.electronAPI.inventoryGetAll), NÃO no localStorage — o localStorage só é
// usado como fallback quando rodando no navegador sem Electron. Ler direto do
// localStorage aqui fazia este widget nunca enxergar os itens reais cadastrados.
async function fetchInventoryItems() {
  try {
    if (window.electronAPI?.inventoryGetAll) {
      const items = await window.electronAPI.inventoryGetAll();
      return items || [];
    }
  } catch { /* cai no fallback abaixo */ }
  try {
    const inv = JSON.parse(localStorage.getItem('sc_inventory_v1') || '{"itens":[]}');
    return inv.itens || [];
  } catch { return []; }
}

const PAF_WIKELO_COLOR = '#a29bfe';
const PAF_COLOR = '#38bdf8';

function isScriptItemDash(name) {
  return isScriptItem(name);
}
const PAF_ITEM_NAMES_DASH = [
  'Alignment Blade',
  'GP-XP Industrial Battery',
  'Laser Activation Keycard',
  // Compatibilidade com registros antigos do Inventário.
  'Cartão de Ativação do Lazer',
];

function normalizeInventoryName(name) {
  return String(name || '').trim().toLowerCase();
}

function isPafItemDash(name) {
  return PAF_ITEM_NAMES_DASH.some(p => normalizeInventoryName(name) === normalizeInventoryName(p));
}

function calcPafLocal(items) {
  const get = (...names) => {
    const accepted = new Set(names.map(normalizeInventoryName));
    return (items || [])
      .filter(item => accepted.has(normalizeInventoryName(item.name)))
      .reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  };
  const alinhamento = get('Alignment Blade');
  const bateria     = get('GP-XP Industrial Battery');
  const lazer       = get('Laser Activation Keycard', 'Cartão de Ativação do Lazer');
  const satsAlign   = Math.floor(alinhamento / 3);
  const satsEnergy  = Math.floor(bateria     / 3);
  const lazersReady = lazer;
  const pafCompletos = Math.min(satsAlign, satsEnergy, lazersReady);
  return { alinhamento, bateria, lazer, satsAlign, satsEnergy, lazersReady, pafCompletos, restoAlign: alinhamento%3, restoBateria: bateria%3 };
}

function calcWikeloLocal(items) {
  return calcWikeloFavors(items);
}

// ── Leitura das demais seções do app (todas em localStorage puro, sem IPC) ────
function readMiningGroupSessions() {
  try { return JSON.parse(localStorage.getItem('sc_mining_group_v1')) || []; } catch { return []; }
}
function readClanVault() {
  try { return JSON.parse(localStorage.getItem('sc_clan_vault_v1')) || []; } catch { return []; }
}
function readOreVault() {
  try { return (JSON.parse(localStorage.getItem('sc_ore_vault_v1')) || { entries: [] }).entries || []; } catch { return []; }
}
function readMissions() {
  try { return JSON.parse(localStorage.getItem('sc_missions_v2')) || []; } catch { return []; }
}

function readDashboardOverview(inventoryItems = []) {
  const inventoryQuantity = inventoryItems.reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
  const inventoryValue = inventoryItems.reduce((total, item) => {
    const unitValue = Number(item.value_auec ?? item.value ?? item.price_auec ?? item.price ?? 0) || 0;
    return total + Math.max(0, Number(item.quantity) || 0) * Math.max(0, unitValue);
  }, 0);
  const inventoryLocations = new Set(inventoryItems.map(item => String(item.location_name || item.location || '').trim()).filter(Boolean)).size;

  const queue = loadQueue();
  const shopping = calcShoppingList(queue);
  const pendingMaterials = shopping.filter(item => Number(item.remaining) > 0);
  const completeMaterials = shopping.filter(item => Number(item.remaining) <= 0);
  const craftProgress = shopping.length
    ? Math.round((completeMaterials.length / shopping.length) * 100)
    : 0;
  const bottleneck = pendingMaterials.slice().sort((a, b) => Number(b.remaining || 0) - Number(a.remaining || 0))[0] || null;

  const oreEntries = loadVault().entries || [];
  const activeOre = oreEntries.filter(entry => Number(entry.quantity) > 0);
  const cargoTotal = cargoEquivalentTotal(activeOre, 'SCU');
  const qualityOre = activeOre.filter(entry => numericQuality(entry.quality) !== null && numericQuality(entry.quality) > 0).length;

  const sales = loadUexSales();
  const saleRevenue = sales.reduce((total, sale) => total + Math.max(0, Number(sale.total_revenue) || (Number(sale.price) || 0) * (Number(sale.qty) || 1)), 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayRevenue = sales.reduce((total, sale) => {
    const timestamp = Number(sale.date) > 0 ? Number(sale.date) * 1000 : Date.parse(sale.created_at || '');
    return timestamp >= todayStart.getTime() ? total + Math.max(0, Number(sale.total_revenue) || (Number(sale.price) || 0) * (Number(sale.qty) || 1)) : total;
  }, 0);
  const salesByItem = Object.values(sales.reduce((map, sale) => {
    const name = String(sale.title || sale.listing_title || 'Item sem nome');
    const value = Math.max(0, Number(sale.total_revenue) || (Number(sale.price) || 0) * (Number(sale.qty) || 1));
    map[name] = map[name] || { name, revenue: 0, quantity: 0 };
    map[name].revenue += value;
    map[name].quantity += Math.max(0, Number(sale.qty) || 0);
    return map;
  }, {})).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const latestSale = sales.slice().sort((a, b) => (Number(b.date) || 0) - (Number(a.date) || 0))[0] || null;

  const marketAlerts = loadMarketAlerts().filter(alert => alert.enabled);
  const marketEvents = loadMarketAlertEvents();
  const alertSettings = loadMarketAlertSettings();
  const activeAlertMatches = marketEvents.length;

  return {
    inventoryQuantity,
    inventoryValue,
    inventoryLocations,
    queueBlueprints: (queue.queuedBlueprints || []).length,
    manualMaterials: (queue.manualMaterials || []).length,
    pendingMaterials: pendingMaterials.length,
    completeMaterials: completeMaterials.length,
    craftProgress,
    bottleneck,
    oreTypes: activeOre.length,
    oreScu: cargoTotal.total,
    oreUnit: cargoTotal.unit,
    qualityOre,
    saleCount: sales.length,
    saleRevenue,
    todayRevenue,
    salesByItem,
    latestSale,
    marketAlerts: marketAlerts.length,
    activeAlertMatches,
    alertSettings,
  };
}

function DashboardMiniMetric({ icon: Icon, label, value, sub, color = 'var(--accent-primary)', onClick }) {
  const content = <><div className="dashboard-mini-icon" style={{ color }}><Icon size={16} /></div><div className="dashboard-mini-copy"><strong>{value}</strong><span>{label}</span>{sub && <small>{sub}</small>}</div></>;
  return onClick ? <button type="button" className="dashboard-mini-metric" onClick={onClick}>{content}</button> : <div className="dashboard-mini-metric">{content}</div>;
}

function DashboardProgressRow({ label, value, color, detail }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="dashboard-progress-row"><div><span>{label}</span><strong>{safe}%</strong></div><div className="dashboard-progress-track"><div style={{ width: `${safe}%`, background: color }} /></div>{detail && <small>{detail}</small>}</div>;
}

function dashboardCountdown(nextCheckAt) {
  if (!nextCheckAt) return 'sem horário definido';
  const seconds = Math.max(0, Math.ceil((Number(nextCheckAt) - Date.now()) / 1000));
  if (seconds <= 0) return 'verificando agora';
  const minutes = Math.floor(seconds / 60);
  return minutes > 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}min` : `${minutes}min`;
}
import { Shield, Package, Star, Trophy, ChevronRight, HardHat, Shirt, Dumbbell, Footprints, Backpack, AlertTriangle, Zap, Satellite, Battery, Crosshair, Radio, Pickaxe, Lock, ListChecks, Users, Building2, Rocket, BarChart3, Bell, Boxes, CircleDollarSign, Clock3, Database, Gauge, TrendingUp, CheckCircle2 } from 'lucide-react';
import { isScriptItem, isWikeloFavorItem, calcWikeloFavors } from '../data/wikelo';
import { calcDchsExecutiveHangars } from '../data/dchsCards';
import { loadMyHangar, MY_HANGAR_UPDATED_EVENT, UEX_VEHICLES_UPDATED_EVENT } from '../data/uexVehicles';
import { loadQueue, calcShoppingList } from '../data/materialQueue';
import { loadVault, numericQuality } from '../data/oreVault';
import { cargoEquivalentTotal } from '../data/cargoUnits';
import { loadUexSales } from '../data/uexSales';
import { MARKET_ALERTS_CHECKED_EVENT, MARKET_ALERTS_UPDATED_EVENT, MARKET_ALERT_SETTINGS_UPDATED_EVENT, loadMarketAlerts, loadMarketAlertEvents, loadMarketAlertSettings } from '../data/uexMarketAlerts';

const PIECE_ICONS  = { Helmet:HardHat, Torso:Shirt, Arms:Dumbbell, Legs:Footprints, Backpack:Backpack };
const PIECE_PT_PLU = { Helmet:'Capacetes', Torso:'Torsos', Arms:'Braços', Legs:'Pernas', Backpack:'Mochilas' };
const TYPE_COLORS  = { Light:'var(--type-light)', Médio:'var(--type-medium)', Heavy:'var(--type-heavy)', Special:'var(--type-special)' };
const TYPE_LABELS  = { Light:'Leve', Médio:'Médio', Heavy:'Pesado', Special:'Especial' };

export default function DashboardPage({ sets, stats, onNavigate }) {
  const pct = stats&&stats.totalPieces>0 ? Math.round((stats.ownedPieces/stats.totalPieces)*100) : 0;

  const byPieceTipo = useMemo(()=>
    ['Helmet','Torso','Arms','Legs','Backpack'].map(pt=>({
      type:pt,
      total: sets.flatMap(s=>(s.pieces||[]).filter(p=>p.piece_type===pt)).length,
      owned: sets.flatMap(s=>(s.pieces||[]).filter(p=>p.piece_type===pt&&p.owned)).length,
    })).filter(x=>x.total>0),
  [sets]);

  const wishlistItens = useMemo(()=>{
    const itens=[];
    sets.forEach(s=>(s.pieces||[]).forEach(p=>{ if(p.wishlist&&!p.owned) itens.push({piece:p,set:s}); }));
    return itens.slice(0,5);
  },[sets]);

  const rarePiecesFaltando = useMemo(()=>{
    const itens=[];
    sets.forEach(s=>(s.pieces||[]).forEach(p=>{
      if(!p.owned&&(s.rarity==='Raro'||s.rarity==='Legendary')) itens.push({piece:p,set:s});
    }));
    return itens.slice(0,5);
  },[sets]);

  const recentlyObtained = useMemo(()=>{
    const itens=[];
    sets.forEach(s=>(s.pieces||[]).forEach(p=>{ if(p.owned&&p.obtained_date) itens.push({piece:p,set:s}); }));
    return itens.sort((a,b)=>new Date(b.piece.obtained_date)-new Date(a.piece.obtained_date)).slice(0,4);
  },[sets]);

  // ── Resumo das demais seções do app (mineração em grupo, cofre, baú, missões) ──
  const groupActivity = useMemo(() => {
    const sessions = readMiningGroupSessions();
    const activeSession = sessions.find(s => s.status === 'Em andamento' || s.status === 'Refinando');

    const vault = readClanVault();
    const pendingVault = vault.filter(v => v.status === 'No Cofre').length;

    const ore = readOreVault();
    const oreTypes = ore.filter(e => (e.quantity||0) > 0).length;

    const missions = readMissions();
    const activeMissions = missions.filter(m => m.status === 'Active' || m.status === 'Pending');
    const activeReward = activeMissions.reduce((a,m) => a + (Number(m.reward)||0), 0);

    return { activeSession, pendingVault, oreTypes, activeMissionsCount: activeMissions.length, activeReward };
  }, []);

  // Busca o inventário real e mantém os novos indicadores sincronizados com os dados locais.
  const [inventoryItems, setInventoryItems] = useState([]);
  const [overview, setOverview] = useState(() => readDashboardOverview([]));
  const refreshOverview = useCallback(async () => {
    const items = await fetchInventoryItems();
    setInventoryItems(items);
    setOverview(readDashboardOverview(items));
  }, []);
  useEffect(() => {
    refreshOverview();
    const eventNames = [
      'sc_inventory_updated',
      'sc_ore_vault_updated',
      'sc_material_queue_updated',
      'sc_missions_updated',
      'sc_uex_sales_updated',
      MARKET_ALERTS_CHECKED_EVENT,
      MARKET_ALERTS_UPDATED_EVENT,
      MARKET_ALERT_SETTINGS_UPDATED_EVENT,
      MY_HANGAR_UPDATED_EVENT,
      UEX_VEHICLES_UPDATED_EVENT,
    ];
    eventNames.forEach(name => window.addEventListener(name, refreshOverview));
    const timer = window.setInterval(refreshOverview, 15000);
    return () => {
      eventNames.forEach(name => window.removeEventListener(name, refreshOverview));
      window.clearInterval(timer);
    };
  }, [refreshOverview]);
  const pafSummary     = useMemo(() => calcPafLocal(inventoryItems),  [inventoryItems]);
  const wfTotal        = useMemo(() => calcWikeloLocal(inventoryItems), [inventoryItems]);
  const dchsSummary    = useMemo(() => calcDchsExecutiveHangars(inventoryItems), [inventoryItems]);
  // Mostrar widgets mesmo com valores zero — se o item existe, mostra
  const hasPafItems    = inventoryItems.some(i => isPafItemDash(i.name));
    const hasScriptItems = inventoryItems.some(i => isScriptItemDash(i.name));
  const hasDirectFavors = inventoryItems.some(i => isWikeloFavorItem(i.name));
  const hasPafData      = hasPafItems;
  const hasWfData       = hasScriptItems || hasDirectFavors;
  const hasDchsData     = dchsSummary.hasAnyCard;

  const [hangarEntries, setHangarEntries] = useState(() => loadMyHangar());
  useEffect(() => {
    const refreshHangar = () => setHangarEntries(loadMyHangar());
    refreshHangar();
    window.addEventListener(UEX_VEHICLES_UPDATED_EVENT, refreshHangar);
    window.addEventListener(MY_HANGAR_UPDATED_EVENT, refreshHangar);
    return () => {
      window.removeEventListener(UEX_VEHICLES_UPDATED_EVENT, refreshHangar);
      window.removeEventListener(MY_HANGAR_UPDATED_EVENT, refreshHangar);
    };
  }, []);
  const hangarSummary = useMemo(() => ({
    totalUnits: hangarEntries.reduce((total, entry) => total + Math.max(0, Number(entry?.quantity) || 0), 0),
    types: hangarEntries.length,
  }), [hangarEntries]);


  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">DASHBOARD</div>
          <div className="page-subtitle">
            {stats?.totalSets||0} sets · {stats?.totalPieces||0} peças catalogadas
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Main stats */}
        <div className="dashboard-grid" style={{ marginBottom:20 }}>
          {[
            {value:stats?.totalPieces||0, label:'Total de Peças',   sub:`Em ${stats?.totalSets||0} sets`,  color:'var(--accent-secondary)', Icon:Shield,  cls:'blue'},
            {value:stats?.ownedPieces||0, label:'Peças Obtidas',    sub:`${pct}% do total`,                 color:'var(--accent-primary)',   Icon:Package, cls:'cyan'},
            {value:stats?.completeSets||0,label:'Sets Completos',   sub:`De ${stats?.totalSets||0} sets`,   color:'var(--accent-green)',     Icon:Trophy,  cls:'green'},
            {value:stats?.wishlistPieces||0,label:'wishlist',sub:'Peças para obter',                color:'var(--accent-gold)',      Icon:Star,    cls:'gold'},
            {value:hangarSummary.totalUnits,label:'Naves no Hangar',sub:`${hangarSummary.types} tipo${hangarSummary.types!==1?'s':''} · compras e Wikelo`, color:'var(--accent-primary)', Icon:Rocket, cls:'cyan'},
          ].map(({value,label,sub,color,Icon,cls})=>(
            <div key={label} className={`stat-card ${cls}`}>
              <div className="stat-card-icon" style={{color}}><Icon size={40}/></div>
              <div className="stat-card-value">{value}</div>
              <div className="stat-card-label">{label}</div>
              <div className="stat-card-sub">{sub}</div>
            </div>
          ))}
        </div>

        {/* Global progress */}
        <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'18px 22px',marginBottom:20 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <Trophy size={16} style={{ color:'var(--accent-gold)' }} />
              <span style={{ fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'0.1em',color:'var(--text-primary)' }}>
                PROGRESSO GERAL
              </span>
            </div>
            <span style={{ fontFamily:'Michroma,sans-serif',fontSize:20,fontWeight:800,color:pct>=75?'var(--accent-gold)':pct>=50?'var(--accent-green)':'var(--accent-primary)' }}>
              {pct}%
            </span>
          </div>
          <div style={{ height:8,background:'var(--border-subtle)',borderRadius:4,overflow:'hidden' }}>
            <div style={{ height:'100%',width:`${pct}%`,background:'linear-gradient(to right,var(--accent-secondary),var(--accent-primary))',borderRadius:4,boxShadow:'0 0 10px rgba(56,189,248,0.35)',transition:'width 1s ease' }} />
          </div>
          <div style={{ display:'flex',justifyContent:'space-between',marginTop:6,fontSize:11,color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace' }}>
            <span>0</span>
            <span>{stats?.ownedPieces||0} / {stats?.totalPieces||0} peças</span>
            <span>{stats?.totalPieces||0}</span>
          </div>
        </div>

        {/* Visão operacional consolidada */}
        <section className="dashboard-overview-block">
          <div className="dashboard-section-heading"><div><BarChart3 size={16} /><span>VISÃO GERAL OPERACIONAL</span></div><small>Indicadores cruzados das funções do projeto</small></div>
          <div className="dashboard-mini-grid">
            <DashboardMiniMetric icon={Boxes} label="Itens no inventário" value={overview.inventoryQuantity.toLocaleString('pt-BR')} sub={`${inventoryItems.length} registros · ${overview.inventoryLocations} locais`} color="var(--accent-primary)" onClick={() => onNavigate('inventory')} />
            <DashboardMiniMetric icon={CircleDollarSign} label="Valor estimado" value={`${Math.round(overview.inventoryValue).toLocaleString('pt-BR')} aUEC`} sub="quantidade × valor aUEC" color="var(--accent-green)" onClick={() => onNavigate('inventory')} />
            <DashboardMiniMetric icon={Pickaxe} label="Baú de minério" value={`${Number(overview.oreScu || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} SCU`} sub={`${overview.oreTypes} entradas · ${overview.qualityOre} com qualidade`} color="var(--accent-gold)" onClick={() => onNavigate('orevault')} />
            <DashboardMiniMetric icon={Database} label="Fila de craft" value={overview.queueBlueprints} sub={`${overview.pendingMaterials} materiais pendentes`} color="#a29bfe" onClick={() => onNavigate('materials')} />
            <DashboardMiniMetric icon={TrendingUp} label="Receita UEX" value={`${Math.round(overview.saleRevenue).toLocaleString('pt-BR')} aUEC`} sub={`${Math.round(overview.todayRevenue).toLocaleString('pt-BR')} hoje · ${overview.saleCount} venda${overview.saleCount !== 1 ? 's' : ''}`} color="var(--accent-green)" onClick={() => onNavigate('uexsales')} />
            <DashboardMiniMetric icon={Bell} label="Alertas de compra" value={overview.marketAlerts} sub={!overview.alertSettings.automaticEnabled ? 'análise automática desligada' : overview.activeAlertMatches ? `${overview.activeAlertMatches} oferta${overview.activeAlertMatches !== 1 ? 's' : ''} encontrada${overview.activeAlertMatches !== 1 ? 's' : ''}` : `próxima em ${dashboardCountdown(overview.alertSettings.nextCheckAt)}`} color="var(--accent-gold)" onClick={() => onNavigate('uexalerts')} />
          </div>
          <div className="dashboard-overview-columns">
            <div className="dashboard-overview-card">
              <div className="dashboard-overview-card-title"><Gauge size={14} /> PROGRESSO E PENDÊNCIAS</div>
              <DashboardProgressRow label="Coleção de armaduras" value={pct} color="var(--accent-primary)" detail={`${stats?.ownedPieces || 0} de ${stats?.totalPieces || 0} peças obtidas`} />
              <DashboardProgressRow label="Materiais para craft" value={overview.craftProgress} color="#a29bfe" detail={`${overview.completeMaterials} completos de ${overview.completeMaterials + overview.pendingMaterials} materiais`} />
              <div className={`dashboard-attention-callout ${overview.bottleneck ? 'warning' : 'success'}`}>
                {overview.bottleneck ? <><AlertTriangle size={14} /><span><strong>Próximo gargalo:</strong> {overview.bottleneck.material_name} {overview.bottleneck.quality_min > 0 ? `Q≥${overview.bottleneck.quality_min}` : ''} · faltam {Number(overview.bottleneck.remaining).toLocaleString('pt-BR')} {overview.bottleneck.unit || 'un'}.</span></> : <><CheckCircle2 size={14} /><span>Nenhum material pendente na fila de craft.</span></>}
              </div>
            </div>
            <div className="dashboard-overview-card">
              <div className="dashboard-overview-card-title"><TrendingUp size={14} /> RECEITA POR ITEM</div>
              {overview.salesByItem.length === 0 ? <div className="dashboard-empty-note">Nenhuma venda UEX registrada ainda.</div> : <div className="dashboard-revenue-list">{overview.salesByItem.map((sale, index) => { const max = Math.max(1, overview.salesByItem[0]?.revenue || 1); const width = Math.max(4, Math.round((sale.revenue / max) * 100)); return <div className="dashboard-revenue-row" key={sale.name}><div><span className="dashboard-rank">{index + 1}</span><strong title={sale.name}>{sale.name}</strong><small>{sale.quantity} unidade{sale.quantity !== 1 ? 's' : ''}</small></div><div className="dashboard-revenue-track"><div style={{ width: `${width}%` }} /></div><b>{Math.round(sale.revenue).toLocaleString('pt-BR')}</b></div>; })}</div>}
              {overview.latestSale && <div className="dashboard-latest-sale"><Clock3 size={12} /> Última venda: <strong>{overview.latestSale.title || 'Item UEX'}</strong> · {Math.round(Number(overview.latestSale.total_revenue || overview.latestSale.price || 0)).toLocaleString('pt-BR')} aUEC</div>}
            </div>
          </div>
        </section>

        {/* Atividade do grupo — mineração, cofre, baú, missões */}
        <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'18px 22px',marginBottom:20 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:14 }}>
            <Users size={16} style={{ color:'var(--accent-primary)' }} />
            <span style={{ fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'0.1em',color:'var(--text-primary)' }}>
              ATIVIDADE DO GRUPO
            </span>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12 }}>
            {/* Sessão de mineração ativa */}
            <button onClick={()=>onNavigate('mininggroup')} style={{ textAlign:'left',cursor:'pointer',padding:'12px 14px',background:groupActivity.activeSession?'rgba(251,191,36,0.06)':'rgba(255,255,255,0.02)',border:`1px solid ${groupActivity.activeSession?'rgba(251,191,36,0.25)':'var(--border-subtle)'}`,borderRadius:8 }}>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:6 }}>
                <Pickaxe size={13} style={{ color: groupActivity.activeSession?'var(--accent-gold)':'var(--text-muted)' }}/>
                <span style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em' }}>Mineração</span>
              </div>
              {groupActivity.activeSession ? (
                <>
                  <div style={{ fontSize:12,fontWeight:700,color:'var(--accent-gold)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{groupActivity.activeSession.name||'Sessão sem nome'}</div>
                  <div style={{ fontSize:10,color:'var(--text-muted)',marginTop:2 }}>{groupActivity.activeSession.status}</div>
                </>
              ) : (
                <div style={{ fontSize:11,color:'var(--text-muted)' }}>Nenhuma sessão ativa</div>
              )}
            </button>

            {/* Cofre do clã */}
            <button onClick={()=>onNavigate('clanvault')} style={{ textAlign:'left',cursor:'pointer',padding:'12px 14px',background:groupActivity.pendingVault>0?'rgba(52,211,153,0.06)':'rgba(255,255,255,0.02)',border:`1px solid ${groupActivity.pendingVault>0?'rgba(52,211,153,0.25)':'var(--border-subtle)'}`,borderRadius:8 }}>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:6 }}>
                <Lock size={13} style={{ color: groupActivity.pendingVault>0?'var(--accent-green)':'var(--text-muted)' }}/>
                <span style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em' }}>Cofre do Clã</span>
              </div>
              <div style={{ fontFamily:'Michroma,sans-serif',fontSize:18,fontWeight:800,color:groupActivity.pendingVault>0?'var(--accent-green)':'var(--text-secondary)' }}>{groupActivity.pendingVault}</div>
              <div style={{ fontSize:10,color:'var(--text-muted)' }}>aguardando entrega</div>
            </button>

            {/* Baú de minério */}
            <button onClick={()=>onNavigate('orevault')} style={{ textAlign:'left',cursor:'pointer',padding:'12px 14px',background:'rgba(255,255,255,0.02)',border:'1px solid var(--border-subtle)',borderRadius:8 }}>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:6 }}>
                <Package size={13} style={{ color:'var(--accent-primary)' }}/>
                <span style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em' }}>Baú de Minério</span>
              </div>
              <div style={{ fontFamily:'Michroma,sans-serif',fontSize:18,fontWeight:800,color:'var(--accent-primary)' }}>{groupActivity.oreTypes}</div>
              <div style={{ fontSize:10,color:'var(--text-muted)' }}>tipo{groupActivity.oreTypes!==1?'s':''} guardado{groupActivity.oreTypes!==1?'s':''}</div>
            </button>

            {/* Missões ativas */}
            <button onClick={()=>onNavigate('missions')} style={{ textAlign:'left',cursor:'pointer',padding:'12px 14px',background:groupActivity.activeMissionsCount>0?'rgba(56,189,248,0.06)':'rgba(255,255,255,0.02)',border:`1px solid ${groupActivity.activeMissionsCount>0?'rgba(56,189,248,0.25)':'var(--border-subtle)'}`,borderRadius:8 }}>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:6 }}>
                <ListChecks size={13} style={{ color: groupActivity.activeMissionsCount>0?'var(--accent-primary)':'var(--text-muted)' }}/>
                <span style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em' }}>Missões Ativas</span>
              </div>
              <div style={{ fontFamily:'Michroma,sans-serif',fontSize:18,fontWeight:800,color:groupActivity.activeMissionsCount>0?'var(--accent-primary)':'var(--text-secondary)' }}>{groupActivity.activeMissionsCount}</div>
              <div style={{ fontSize:10,color:'var(--text-muted)' }}>{groupActivity.activeReward>0?`${groupActivity.activeReward.toLocaleString('pt-BR')} aUEC em jogo`:'nenhuma recompensa pendente'}</div>
            </button>
          </div>
        </div>

        {/* By type + by piece type */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20 }}>
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'18px' }}>
            <div className="modal-section-title">Por Tipo de Armadura</div>
            {(stats?.byTipo||[]).filter(t=>t.total_pieces>0).map(({type,total_pieces,owned_pieces})=>{
              const p=total_pieces>0?Math.round((owned_pieces/total_pieces)*100):0;
              return (
                <div key={type} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                    <span style={{ fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:700,color:TYPE_COLORS[type],letterSpacing:'0.08em' }}>{TYPE_LABELS[type]||type}</span>
                    <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-secondary)' }}>{owned_pieces}/{total_pieces} · {p}%</span>
                  </div>
                  <div style={{ height:5,background:'var(--border-subtle)',borderRadius:3,overflow:'hidden' }}>
                    <div className={`type-progress-fill fill-${type.toLowerCase()}`} style={{ width:`${p}%`,height:'100%',borderRadius:3 }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'18px' }}>
            <div className="modal-section-title">Por Tipo de Peça</div>
            {byPieceTipo.map(({type,total,owned})=>{
              const p=total>0?Math.round((owned/total)*100):0;
              const Icon=PIECE_ICONS[type]||Shield;
              return (
                <div key={type} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5,alignItems:'center' }}>
                    <span style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.08em' }}>
                      <Icon size={12} style={{ color:'var(--accent-primary)' }} />{PIECE_PT_PLU[type]||type}
                    </span>
                    <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-secondary)' }}>{owned}/{total} · {p}%</span>
                  </div>
                  <div style={{ height:5,background:'var(--border-subtle)',borderRadius:3,overflow:'hidden' }}>
                    <div style={{ height:'100%',width:`${p}%`,background:'linear-gradient(to right,var(--accent-secondary),var(--accent-primary))',borderRadius:3,transition:'width 0.8s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom 3-col */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:20 }}>
          {/* Recent */}
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'16px' }}>
            <div className="modal-section-title">Obtidas Recentemente</div>
            {recentlyObtained.length===0 ? (
              <div style={{ color:'var(--text-muted)',fontSize:12,textAlign:'center',padding:'16px 0' }}>Nenhuma peça obtida ainda</div>
            ) : recentlyObtained.map(({piece,set})=>{
              const Icon=PIECE_ICONS[piece.piece_type]||Shield;
              return (
                <div key={piece.id} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'6px 8px',background:'rgba(52,211,153,0.04)',border:'1px solid rgba(52,211,153,0.12)',borderRadius:5 }}>
                  <Icon size={13} style={{ color:'var(--accent-green)',flexShrink:0 }} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:11,fontWeight:700,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                      {set.base_name}{set.variant_name&&set.variant_name!=='Base'?` — ${set.variant_name}`:''}
                    </div>
                    <div style={{ fontSize:10,color:'var(--text-muted)' }}>{piece.piece_type} · {piece.obtained_date?new Date(piece.obtained_date).toLocaleDateString('pt-BR'):''}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Wishlist */}
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'16px' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
              <div className="modal-section-title" style={{ marginBottom:0 }}><Star size={11}/> Desejos</div>
              <button onClick={()=>onNavigate('collection')} style={{ background:'none',border:'none',color:'var(--accent-primary)',cursor:'pointer',display:'flex',alignItems:'center',gap:3,fontSize:11,fontWeight:600 }}>
                Ver <ChevronRight size={12}/>
              </button>
            </div>
            {wishlistItens.length===0 ? (
              <div style={{ color:'var(--text-muted)',fontSize:12,textAlign:'center',padding:'16px 0' }}>Lista vazia</div>
            ) : wishlistItens.map(({piece,set})=>{
              const Icon=PIECE_ICONS[piece.piece_type]||Shield;
              return (
                <div key={piece.id} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:7,padding:'5px 7px',background:'rgba(251,191,36,0.04)',border:'1px solid rgba(251,191,36,0.12)',borderRadius:5 }}>
                  <Icon size={12} style={{ color:'var(--accent-gold)',flexShrink:0 }} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:11,fontWeight:700,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{set.base_name}</div>
                    <div style={{ fontSize:10,color:'var(--text-muted)' }}>{piece.piece_type}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Raro missing */}
          <div style={{ background:'var(--bg-card)',border:'1px solid rgba(251,191,36,0.15)',borderRadius:10,padding:'16px' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
              <div className="modal-section-title" style={{ marginBottom:0 }}><AlertTriangle size={11} style={{ color:'var(--accent-gold)' }}/> Raras Faltando</div>
              <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:10,color:'var(--accent-gold)' }}>{rarePiecesFaltando.length}</span>
            </div>
            {rarePiecesFaltando.length===0 ? (
              <div style={{ textAlign:'center',padding:'12px 0' }}>
                <Trophy size={28} style={{ color:'var(--accent-gold)',margin:'0 auto 6px',display:'block',opacity:0.7 }} />
                <div style={{ color:'var(--accent-gold)',fontSize:12,fontWeight:700 }}>Raras Completas!</div>
              </div>
            ) : rarePiecesFaltando.map(({piece,set})=>(
              <div key={piece.id} style={{ display:'flex',alignItems:'center',gap:7,marginBottom:7,padding:'5px 7px',background:'rgba(251,191,36,0.04)',border:'1px solid rgba(251,191,36,0.1)',borderRadius:5 }}>
                <Zap size={11} style={{ color:'var(--accent-gold)',flexShrink:0 }} />
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:11,fontWeight:700,color:'var(--accent-gold)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                    {set.base_name}{set.variant_name&&set.variant_name!=='Base'?` (${set.variant_name})`:''}
                  </div>
                  <div style={{ fontSize:10,color:'var(--text-muted)' }}>{piece.piece_type} · {piece.is_lootable&&!piece.is_purchasable?'LOOT':'Comprável'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Widgets PAF e Wikelo ── */}
        {(hasPafData || hasWfData) && (
          <div style={{ display:'grid', gridTemplateColumns: hasPafData&&hasWfData?'2fr 1fr':'1fr', gap:16, marginBottom:20 }}>

            {/* Widget PAF */}
            {hasPafData && (
              <div style={{ background:'var(--bg-card)', border:'1px solid rgba(56,189,248,0.2)', borderRadius:10, padding:'16px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <Radio size={16} style={{ color:'var(--accent-primary)' }}/>
                  <span style={{ fontFamily:'Michroma,sans-serif', fontSize:12, fontWeight:700, color:'var(--accent-primary)', letterSpacing:'0.08em' }}>MISSÃO PAF — SATÉLITES</span>
                </div>

                {/* Cards dos 3 recursos + total */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:12 }}>
                  {[
                    { label:'Alinhamento',   value:pafSummary.satsAlign,   icon:'📡', color:'var(--accent-primary)', sub:`${pafSummary.alinhamento} cartões`, resto:pafSummary.restoAlign,  ratio:3 },
                    { label:'Energia',        value:pafSummary.satsEnergy,  icon:'🔋', color:'var(--accent-gold)',    sub:`${pafSummary.bateria} baterias`,    resto:pafSummary.restoBateria,ratio:3 },
                    { label:'Lazers',         value:pafSummary.lazersReady, icon:'🔫', color:'var(--accent-red)',     sub:`${pafSummary.lazer} keycard${pafSummary.lazer!==1?'s':''}`, resto:0,                      ratio:1 },
                    { label:'PAF Completo',   value:pafSummary.pafCompletos,icon:'🛰', color:'var(--accent-green)',  sub:'mín. dos 3',                          resto:0,                      ratio:0 },
                  ].map(({label,value,icon,color,sub,resto,ratio})=>(
                    <div key={label} style={{ textAlign:'center', padding:'10px 6px', background:`${color}08`, border:`1px solid ${color}25`, borderRadius:8 }}>
                      <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
                      <div style={{ fontFamily:'Michroma,sans-serif', fontSize:20, fontWeight:800, color, lineHeight:1, marginBottom:2 }}>{value}</div>
                      <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{label}</div>
                      <div style={{ fontSize:9, color:'var(--text-muted)', fontStyle:'italic' }}>{sub}</div>
                      {ratio > 1 && resto > 0 && (
                        <div style={{ marginTop:5 }}>
                          <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${(resto/ratio)*100}%`, background:color, borderRadius:2 }}/>
                          </div>
                          <div style={{ fontSize:8, color:'var(--accent-gold)', marginTop:2 }}>+{resto}/{ratio}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Status do PAF */}
                {pafSummary.pafCompletos === 0 ? (
                  <div style={{ padding:'7px 12px', background:'rgba(251,113,133,0.06)', border:'1px solid rgba(251,113,133,0.2)', borderRadius:6, fontSize:11, color:'var(--accent-red)', display:'flex', alignItems:'center', gap:6 }}>
                    <AlertTriangle size={12}/>
                    {pafSummary.satsAlign === 0 && pafSummary.satsEnergy === 0 && pafSummary.lazersReady === 0
                      ? 'Nenhum recurso PAF suficiente ainda.'
                      : `Faltam recursos: ${pafSummary.satsAlign===0?'mais cartões de alinhamento ':''} ${pafSummary.satsEnergy===0?'mais baterias ':''} ${pafSummary.lazersReady===0?'mais Laser Activation Keycard':''}`
                    }
                  </div>
                ) : (
                  <div style={{ padding:'7px 12px', background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:6, fontSize:11, color:'var(--accent-green)', display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:14 }}>🛰</span>
                    <strong>{pafSummary.pafCompletos} satélite{pafSummary.pafCompletos!==1?'s':''} PAF</strong> pronto{pafSummary.pafCompletos!==1?'s':''} para missão!
                  </div>
                )}
              </div>
            )}

            {/* Widget Wikelo Favors */}
            {hasWfData && (
              <div style={{ background:'var(--bg-card)', border:'1px solid rgba(162,155,254,0.25)', borderRadius:10, padding:'16px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <Star size={16} style={{ color:'#a29bfe' }}/>
                  <span style={{ fontFamily:'Michroma,sans-serif', fontSize:12, fontWeight:700, color:'#a29bfe', letterSpacing:'0.08em' }}>WIKELO FAVORS</span>
                </div>
                <div style={{ textAlign:'center', padding:'16px', background:'rgba(162,155,254,0.08)', border:'1px solid rgba(162,155,254,0.2)', borderRadius:8, marginBottom:10 }}>
                  <div style={{ fontFamily:'Michroma,sans-serif', fontSize:36, fontWeight:800, color:'#a29bfe', lineHeight:1, marginBottom:4 }}>{wfTotal}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Wikelo Favor{wfTotal!==1?'s':''} totais</div>
                </div>
                <div style={{ fontSize:10, color:'var(--text-muted)', textAlign:'center', lineHeight:1.5 }}>
                  Scrip convertível + Favors já prontos<br/>50 Scrip = 1 favor; cada Wikelo Favor = 1
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Contador de Cartões DCHS / Hangares Executivos ── */}
        {hasDchsData && (
          <div style={{background:'var(--bg-card)',border:'1px solid rgba(251,191,36,0.28)',borderRadius:10,padding:'16px 18px',marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <Building2 size={16} style={{color:'var(--accent-gold)'}}/>
              <span style={{fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:700,color:'var(--accent-gold)',letterSpacing:'0.08em'}}>DCHS — HANGARES EXECUTIVOS</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'minmax(180px,0.9fr) 3fr',gap:14,alignItems:'stretch'}}>
              <div style={{display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',textAlign:'center',padding:'14px',background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:8}}>
                <div style={{fontFamily:'Michroma,sans-serif',fontSize:36,fontWeight:800,color:'var(--accent-gold)',lineHeight:1}}>{dchsSummary.executiveHangars}</div>
                <div style={{fontSize:11,color:'var(--text-primary)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:6}}>Hangar{dchsSummary.executiveHangars!==1?'es':''} Executivo{dchsSummary.executiveHangars!==1?'s':''}</div>
                <div style={{fontSize:10,color:'var(--text-muted)',marginTop:5}}>1 conjunto completo = 1 hangar</div>
              </div>
              <div>
                <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:7}}>Quantidade de cada cartão no Inventário</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:7}}>
                  {dchsSummary.cards.map(card => {
                    const enoughForCurrent = card.quantity >= dchsSummary.completeSets;
                    const readyForNext = card.quantity >= dchsSummary.completeSets + 1;
                    const color = readyForNext ? 'var(--accent-green)' : enoughForCurrent ? 'var(--accent-gold)' : 'var(--accent-red)';
                    return (
                      <div key={card.code} style={{padding:'8px 9px',background:`${color}08`,border:`1px solid ${color}35`,borderRadius:6}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:5}}>
                          <span style={{fontFamily:'Share Tech Mono,monospace',fontSize:11,fontWeight:800,color}}>{card.code}</span>
                          <span style={{fontFamily:'Michroma,sans-serif',fontSize:16,fontWeight:800,color}}>{card.quantity}</span>
                        </div>
                        <div style={{fontSize:9,color:'var(--text-secondary)',lineHeight:1.25,marginTop:3,minHeight:23}}>{card.shortName}</div>
                        <div style={{fontSize:9,color:'var(--text-muted)',marginTop:3}}>{card.quantity===1?'1 cartão':`${card.quantity} cartões`}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop:9,padding:'7px 10px',background:dchsSummary.completeSets>0?'rgba(52,211,153,0.06)':'rgba(251,113,133,0.06)',border:`1px solid ${dchsSummary.completeSets>0?'rgba(52,211,153,0.2)':'rgba(251,113,133,0.2)'}`,borderRadius:6,fontSize:11,color:dchsSummary.completeSets>0?'var(--accent-green)':'var(--accent-red)'}}>
                  {dchsSummary.completeSets>0 ? `Você possui ${dchsSummary.completeSets} conjunto${dchsSummary.completeSets!==1?'s':''} completo${dchsSummary.completeSets!==1?'s':''} e pode fazer ${dchsSummary.executiveHangars} hangar${dchsSummary.executiveHangars!==1?'es':''} executivo${dchsSummary.executiveHangars!==1?'s':''}.` : 'Ainda não há um conjunto completo dos sete cartões DCHS.'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick nav */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12 }}>
          {[
            {label:'Todas as Armaduras',icon:Shield,page:'all',color:'var(--accent-primary)',border:'var(--border-normal)',bg:'rgba(56,189,248,0.06)',hbg:'rgba(56,189,248,0.12)'},
            {label:'Gerenciar Coleção',icon:Package,page:'collection',color:'var(--accent-green)',border:'rgba(52,211,153,0.25)',bg:'rgba(52,211,153,0.06)',hbg:'rgba(52,211,153,0.12)'},
            {label:'Mineração em Grupo',icon:Pickaxe,page:'mininggroup',color:'var(--accent-gold)',border:'rgba(251,191,36,0.25)',bg:'rgba(251,191,36,0.06)',hbg:'rgba(251,191,36,0.12)'},
            {label:'Cofre do Clã',icon:Lock,page:'clanvault',color:'#a29bfe',border:'rgba(162,155,254,0.25)',bg:'rgba(162,155,254,0.06)',hbg:'rgba(162,155,254,0.12)'},
          ].map(({label,icon:Icon,page,color,border,bg,hbg})=>(
            <button key={page} onClick={()=>onNavigate(page)} style={{
              padding:'14px',background:bg,border:`1px solid ${border}`,borderRadius:8,
              color,fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,letterSpacing:'0.06em',
              textTransform:'uppercase',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'all 0.2s',
            }}
              onMouseEnter={e=>e.currentTarget.style.background=hbg}
              onMouseLeave={e=>e.currentTarget.style.background=bg}
            >
              <Icon size={15}/>{label}<ChevronRight size={13}/>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}