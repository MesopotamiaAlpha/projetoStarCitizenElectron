import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Package, Edit3, Trash2, X, Save,
  AlertTriangle, MapPin, Box, ChevronDown, ChevronUp,
  BarChart3, Filter, RefreshCw, Coins, Minus, Star, Check
} from 'lucide-react';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import TransferModal from '../components/TransferModal';
import { searchUexItems, loadUexItemsDB, getUexItemAveragePrice, normalizeUexNumber, normalizeUexItemName } from '../data/uexItemsDB';
import { getItemMarketPrice, getMarketPriceForName } from '../data/uexMarketDB';
import { buildManagedLocationTree, buildManagedLocationOptions, LOCATIONS_UPDATED_EVENT } from '../data/locations';
import { setProvenance, SOURCES } from '../data/provenance';
import { SCRIPT_RATIO, isScriptItem, normalizeScriptName, calcWikeloFavors } from '../data/wikelo';
import { loadUnknownVault, removeFromUnknownVault, UNKNOWN_VAULT_UPDATED_EVENT } from '../data/unknownVault';
import { publishInventoryUpdate } from '../data/inventoryEvents';
import {
  DEFAULT_INVENTORY_TAXONOMY,
  INVENTORY_TAXONOMY_UPDATED_EVENT,
  getInventoryCategoryOptions,
  getInventorySubcategoryOptions,
  loadInventoryTaxonomy,
} from '../data/inventoryTaxonomy';

// ─────────────────────────────────────────────────────────────────────────────
// Script Items — conversão especial
// ─────────────────────────────────────────────────────────────────────────────
const WIKELO_COLOR = '#a29bfe';
const UNKNOWN_VAULT_SYSTEM = 'Baú Desconhecido';
const UNKNOWN_VAULT_LOCATION_TYPE = 'Baú Desconhecido';
const UNKNOWN_VAULT_LOCATION_NAME = 'Sem localização definida';

function isUnknownVaultItem(item) {
  return Boolean(item?.is_unknown_vault)
    || String(item?.system || '') === UNKNOWN_VAULT_SYSTEM
    || String(item?.location_type || '') === UNKNOWN_VAULT_LOCATION_TYPE
    || String(item?.location_name || '') === UNKNOWN_VAULT_LOCATION_NAME;
}

function qualityTierFromUexItem(item) {
  if (item?.quality_tier !== undefined && item?.quality_tier !== null && item?.quality_tier !== '') return item.quality_tier;
  const quality = Number(item?.quality);
  if (!Number.isFinite(quality)) return null;
  if (quality <= 0) return 0;
  if (quality < 500) return 1;
  if (quality < 600) return 2;
  if (quality < 700) return 3;
  if (quality < 800) return 4;
  if (quality < 900) return 5;
  if (quality < 950) return 6;
  return 7;
}

function getUexItemAveragePriceByQuality(item) {
  if (!item) return 0;
  const qualityTier = qualityTierFromUexItem(item);
  const fromMarketById = item.id !== undefined && item.id !== null
    ? (getItemMarketPrice(item.id, qualityTier, 'sell') || getItemMarketPrice(item.id, qualityTier, 'buy'))
    : null;
  const fromMarketByName = !fromMarketById && item.name
    ? getMarketPriceForName(item.name, qualityTier, 'sell') || getMarketPriceForName(item.name, qualityTier, 'buy')
    : null;
  return getUexItemAveragePrice(fromMarketById || fromMarketByName || item);
}

// O Electron/SQLite pode devolver craft_status como texto JSON, enquanto o
// fallback local já pode devolvê-lo como array. Todas as camadas passam por
// esta função antes de acessar o valor com .map().
export function normalizeCraftStatus(value) {
  let parsed = value;
  if (typeof parsed === 'string') {
    const raw = parsed.trim();
    if (!raw) return [];
    try { parsed = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(parsed)) {
    if (parsed && typeof parsed === 'object' && ('status' in parsed || 'bonus' in parsed)) parsed = [parsed];
    else return [];
  }
  return parsed.filter(Boolean).map((row, index) => {
    if (typeof row === 'string') return { id: `craft-${index}-${row}`, status: row, bonus: '' };
    return {
      id: row.id ?? `craft-${index}`,
      status: String(row.status ?? ''),
      bonus: String(row.bonus ?? ''),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAF Items — missão de satélites
// ─────────────────────────────────────────────────────────────────────────────
const PAF_COLOR = '#38bdf8';
const PAF_ITEMS = {
  'Alignment Blade':  { ratio:3,  unit:'cartões', yields:'satélite (alinhamento)',  icon:'📡', description:'3 conjuntos = 1 satélite alinhado' },
  'GP-XP Industrial Battery': { ratio:3, unit:'conjuntos', yields:'satélite (energia)', icon:'🔋', description:'3 conjuntos = 1 satélite ligado' },
  'Laser Activation Keycard': { ratio:1, unit:'keycards', yields:'PAF completo', icon:'🔫', description:'1 Laser Activation Keycard = 1 PAF completo' },
  // Mantido para reconhecer itens antigos cadastrados com o nome traduzido.
  'Cartão de Ativação do Lazer': { ratio:1, unit:'keycards', yields:'PAF completo', icon:'🔫', description:'1 cartão = 1 PAF completo' },
};
const PAF_ITEM_NAMES = Object.keys(PAF_ITEMS);

function isPafItem(name) {
  if (!name) return false;
  return PAF_ITEM_NAMES.some(p => name.trim().toLowerCase() === p.toLowerCase());
}

// Calcular resumo PAF a partir de lista de itens do inventário
export function calcPafSummary(inventoryItems) {
  const itens = inventoryItems || [];
  const get = (...names) => {
    const accepted = new Set(names.map(name => String(name).trim().toLowerCase()));
    return itens
      .filter(item => accepted.has(String(item.name || '').trim().toLowerCase()))
      .reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  };
  const alinhamento = get('Alignment Blade');
  const bateria     = get('GP-XP Industrial Battery');
  const lazer       = get('Laser Activation Keycard', 'Cartão de Ativação do Lazer');
  const satsAlign   = Math.floor(alinhamento / 3);
  const satsEnergy  = Math.floor(bateria     / 3);
  const lazersReady = lazer;
  // PAF completo = mínimo dos 3 recursos
  const pafCompletos = Math.min(satsAlign, satsEnergy, lazersReady);
  return {
    alinhamento, bateria, lazer,
    satsAlign, satsEnergy, lazersReady,
    pafCompletos,
    restoAlign:  alinhamento % 3,
    restoBateria:bateria     % 3,
  };
}

// Calcular Wikelo Favors totais de todos os scripts no inventário
export function calcWikeloTotal(inventoryItems) {
  return calcWikeloFavors(inventoryItems || []);
}

// Painel de ajuste de quantidade para Script Items
function ScriptPanel({ item, onUpdate }) {
  const [adding, setAdding]     = useState('');
  const [removing, setRemoving] = useState('');

  const qty     = Math.max(0, Number(item.quantity) || 0);
  const favors  = Math.floor(qty / SCRIPT_RATIO);
  const resto   = qty % SCRIPT_RATIO;
  const faltam  = resto > 0 ? SCRIPT_RATIO - resto : 0;

  function handleAdd() {
    const n = parseInt(adding, 10);
    if (!n || n <= 0) return;
    onUpdate(item.id, qty + n);
    setAdding('');
  }
  function handleRemove() {
    const n = parseInt(removing, 10);
    if (!n || n <= 0) return;
    const next = Math.max(0, qty - n);
    onUpdate(item.id, next);
    setRemoving('');
  }

  const IS = { width:70, padding:'5px 8px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:12, outline:'none', textAlign:'center' };

  return (
    <div style={{ gridColumn:'1/-1', marginTop:4, padding:'12px 14px', background:`rgba(162,155,254,0.06)`, border:`1px solid rgba(162,155,254,0.25)`, borderRadius:8 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
        <Star size={13} style={{ color:WIKELO_COLOR }}/>
        <span style={{ fontFamily:'Michroma,sans-serif', fontSize:11, fontWeight:700, color:WIKELO_COLOR, letterSpacing:'0.06em', textTransform:'uppercase' }}>
          Conversor Wikelo Favor
        </span>
        <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:4 }}>· {SCRIPT_RATIO} {item.name} = 1 Wikelo Favor</span>
      </div>

      {/* Contadores */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12 }}>
        <div style={{ textAlign:'center', padding:'8px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-subtle)', borderRadius:7 }}>
          <div style={{ fontFamily:'Michroma,sans-serif', fontSize:22, fontWeight:800, color:'var(--text-primary)', lineHeight:1 }}>{qty}</div>
          <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:4 }}>Scripts totais</div>
        </div>
        <div style={{ textAlign:'center', padding:'8px', background:`rgba(162,155,254,0.08)`, border:`1px solid rgba(162,155,254,0.3)`, borderRadius:7 }}>
          <div style={{ fontFamily:'Michroma,sans-serif', fontSize:22, fontWeight:800, color:WIKELO_COLOR, lineHeight:1 }}>{favors}</div>
          <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:4 }}>Wikelo Favors</div>
        </div>
        <div style={{ textAlign:'center', padding:'8px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-subtle)', borderRadius:7 }}>
          <div style={{ fontFamily:'Michroma,sans-serif', fontSize:22, fontWeight:800, color: resto > 0 ? 'var(--accent-gold)' : 'var(--accent-green)', lineHeight:1 }}>{resto}</div>
          <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:4 }}>Resto (sobra)</div>
        </div>
      </div>

      {/* Barra de progresso para o próximo favor */}
      {resto > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginBottom:4 }}>
            <span>Progresso para o próximo Wikelo Favor</span>
            <span style={{ color:'var(--accent-gold)', fontFamily:'Share Tech Mono,monospace' }}>{resto}/{SCRIPT_RATIO} · faltam {faltam}</span>
          </div>
          <div style={{ height:6, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${(resto/SCRIPT_RATIO)*100}%`, background:WIKELO_COLOR, borderRadius:3, transition:'width 0.4s ease', boxShadow:`0 0 8px ${WIKELO_COLOR}88` }}/>
          </div>
        </div>
      )}
      {resto === 0 && qty > 0 && (
        <div style={{ marginBottom:12, padding:'5px 10px', background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:5, fontSize:11, color:'var(--accent-green)', textAlign:'center' }}>
          ✓ Quantidade exata — sem scripts sobrando!
        </div>
      )}

      {/* Controles de soma/subtração */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {/* Adicionar */}
        <div style={{ padding:'10px', background:'rgba(52,211,153,0.04)', border:'1px solid rgba(52,211,153,0.15)', borderRadius:7 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--accent-green)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7 }}>+ Adicionar Scripts</div>
          <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
            <input style={IS} type="number" min="1" placeholder="Qtd" value={adding} onChange={e=>setAdding(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()}/>
            <button onClick={handleAdd} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'5px 10px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:5, color:'var(--accent-green)', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'"Exo 2",sans-serif', textTransform:'uppercase' }}>
              <Plus size={11}/> Somar
            </button>
          </div>
          {/* Atalhos rápidos */}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {[10, 25, 50, 100].map(n => (
              <button key={n} onClick={()=>onUpdate(item.id, qty+n)} style={{ padding:'2px 7px', background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.15)', borderRadius:4, color:'var(--accent-green)', cursor:'pointer', fontSize:10, fontFamily:'Share Tech Mono,monospace' }}>+{n}</button>
            ))}
          </div>
        </div>
        {/* Remover */}
        <div style={{ padding:'10px', background:'rgba(251,113,133,0.04)', border:'1px solid rgba(251,113,133,0.15)', borderRadius:7 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--accent-red)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7 }}>− Remover Scripts</div>
          <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
            <input style={IS} type="number" min="1" placeholder="Qtd" value={removing} onChange={e=>setRemoving(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleRemove()}/>
            <button onClick={handleRemove} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'5px 10px', background:'rgba(251,113,133,0.1)', border:'1px solid rgba(251,113,133,0.3)', borderRadius:5, color:'var(--accent-red)', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'"Exo 2",sans-serif', textTransform:'uppercase' }}>
              <Minus size={11}/> Subtrair
            </button>
          </div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {[10, 25, 50, 100].map(n => (
              <button key={n} onClick={()=>onUpdate(item.id, Math.max(0,qty-n))} disabled={qty<n} style={{ padding:'2px 7px', background:'rgba(251,113,133,0.06)', border:'1px solid rgba(251,113,133,0.15)', borderRadius:4, color:'var(--accent-red)', cursor:'pointer', fontSize:10, fontFamily:'Share Tech Mono,monospace', opacity:qty<n?0.4:1 }}>-{n}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Ajustador genérico de quantidade — usado por todos os itens, não apenas scripts.
// O callback é o mesmo fluxo persistente usado pelo painel de Wikelo Scrip.
function QuantityAdjuster({ item, onUpdate, compact = false }) {
  const [adding, setAdding] = useState('');
  const [removing, setRemoving] = useState('');
  const qty = Math.max(0, Number(item.quantity) || 0);

  function updateBy(delta) {
    onUpdate(item.id, Math.max(0, qty + delta));
  }

  function addCustom() {
    const amount = Math.max(0, parseInt(adding, 10) || 0);
    if (!amount) return;
    updateBy(amount);
    setAdding('');
  }

  function removeCustom() {
    const amount = Math.max(0, parseInt(removing, 10) || 0);
    if (!amount) return;
    updateBy(-amount);
    setRemoving('');
  }

  if (compact) {
    const compactButton = {
      width:24,
      height:24,
      padding:0,
      display:'inline-flex',
      alignItems:'center',
      justifyContent:'center',
      borderRadius:4,
      cursor:'pointer',
      fontWeight:800,
      lineHeight:1,
    };
    return (
      <div
        className="inventory-quantity-adjuster inventory-quantity-adjuster-compact"
        onClick={e=>e.stopPropagation()}
        style={{display:'inline-flex',alignItems:'center',gap:4,flexShrink:0}}
        aria-label={`Ajustar quantidade de ${item.name || 'item'}`}
      >
        <button
          type="button"
          title="Remover 1"
          aria-label="Remover 1"
          onClick={()=>updateBy(-1)}
          disabled={qty <= 0}
          style={{...compactButton,background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.28)',color:'var(--accent-red)',opacity:qty<=0?0.4:1}}
        >
          <Minus size={12}/>
        </button>
        <button
          type="button"
          title="Adicionar 1"
          aria-label="Adicionar 1"
          onClick={()=>updateBy(1)}
          style={{...compactButton,background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.28)',color:'var(--accent-green)'}}
        >
          <Plus size={12}/>
        </button>
      </div>
    );
  }

  const inputStyle = {
    width:76,
    padding:'6px 8px',
    background:'var(--bg-base)',
    border:'1px solid var(--border-subtle)',
    borderRadius:5,
    color:'var(--text-primary)',
    fontFamily:'Share Tech Mono,monospace',
    fontSize:12,
    outline:'none',
    textAlign:'center',
  };
  const actionButton = {
    display:'inline-flex',
    alignItems:'center',
    justifyContent:'center',
    gap:5,
    padding:'6px 10px',
    borderRadius:5,
    cursor:'pointer',
    fontSize:11,
    fontWeight:700,
    fontFamily:'"Exo 2",sans-serif',
    textTransform:'uppercase',
  };

  return (
    <div className="inventory-quantity-adjuster" style={{marginBottom:14,padding:'11px 12px',background:'rgba(56,189,248,0.04)',border:'1px solid rgba(56,189,248,0.2)',borderRadius:7}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:8,flexWrap:'wrap'}}>
        <span style={{fontSize:10,fontWeight:700,color:'var(--accent-primary)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Ajustar quantidade</span>
        <span style={{fontFamily:'Share Tech Mono,monospace',fontSize:12,color:'var(--text-secondary)'}}>{qty} {item.unit || 'un'}</span>
      </div>
      <div className="inventory-quantity-actions" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
          <input type="number" min="1" placeholder="Qtd" value={adding} onChange={e=>setAdding(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustom()} style={inputStyle}/>
          <button type="button" onClick={addCustom} style={{...actionButton,flex:1,background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.3)',color:'var(--accent-green)'}}><Plus size={12}/> Somar</button>
        </div>
        <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
          <input type="number" min="1" placeholder="Qtd" value={removing} onChange={e=>setRemoving(e.target.value)} onKeyDown={e=>e.key==='Enter'&&removeCustom() } style={inputStyle}/>
          <button type="button" onClick={removeCustom} disabled={qty<=0} style={{...actionButton,flex:1,background:'rgba(251,113,133,0.1)',border:'1px solid rgba(251,113,133,0.3)',color:'var(--accent-red)',opacity:qty<=0?0.5:1}}><Minus size={12}/> Subtrair</button>
        </div>
      </div>
      <div className="inventory-quantity-shortcuts" style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}}>
        {[1,10,25,50,100].map(amount=>(
          <React.Fragment key={amount}>
            <button type="button" onClick={()=>updateBy(amount)} style={{...actionButton,padding:'3px 8px',fontSize:10,background:'rgba(52,211,153,0.06)',border:'1px solid rgba(52,211,153,0.18)',color:'var(--accent-green)'}}>+{amount}</button>
            <button type="button" onClick={()=>updateBy(-amount)} disabled={qty<amount} style={{...actionButton,padding:'3px 8px',fontSize:10,background:'rgba(251,113,133,0.06)',border:'1px solid rgba(251,113,133,0.18)',color:'var(--accent-red)',opacity:qty<amount?0.4:1}}>-{amount}</button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference data
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEMS = ['Stanton','Pyro','Nyx'];

const LOCATIONS_STATIC = {
  Stanton: {
    'Planeta / Lua': [
      'ArcCorp (Area18)','ArcCorp — Wala','ArcCorp — Lyria',
      'Hurston (Lorville)','Hurston — Aberdeen','Hurston — Magda','Hurston — Ita','Hurston — Arial',
      'microTech (New Babbage)','microTech — Calliope','microTech — Clio','microTech — Euterpe',
      'Crusader (Orison)','Crusader — Daymar','Crusader — Cellin','Crusader — Yela',
    ],
    'Estação L (Lagrange)': [
      'ARC-L1 Wide Forest Station','ARC-L2 Lively Pathway Station','ARC-L3 Overwatch Station',
      'ARC-L4 Faint Glen Station','ARC-L5 Recent Storm Station',
      'HUR-L1 Green Glade Station','HUR-L2 Faithful Dream Station','HUR-L3 Thundering Express Station',
      'HUR-L4 Melodic Fields Station','HUR-L5 Alto Course Station',
      'CRU-L1 Ambitious Dream Station','CRU-L2 Ambitious Dream Station','CRU-L3 Stash House','CRU-L4 Shallow Fields Station','CRU-L5 Beautiful Glen Station',
      'MIC-L1 Shallow Frontier Station','MIC-L2 Long Forest Station','MIC-L3 Endless Odyssey Station',
      'MIC-L4 Red Crossroads Station','MIC-L5 Modern Icebox Station',
    ],
    'Estação Orbital': [
      'Port Olisar (legado)','Everus Harbor (Hurston)','Port Tressler (microTech)',
      'Baijini Point (ArcCorp)','Seraphim Station (Crusader)',
    ],
    'Posto Avançado / Base': [
      'Grim HEX (Yela)','Levski (Nyx)','HDMS-Anderson','HDMS-Bezdek','HDMS-Edmond',
      'HDMS-Hadley','HDMS-Hahn','HDMS-Perlman','HDMS-Ryder','HDMS-Stanhope','HDMS-Thedus',
    ],
    'Instalação Espacial': [
      'CRU-L5 — Stash House','Drug Lab (Yela Belt)',
      'Nine Tails Stronghold','Bunker Genérico','Distribution Center',
    ],
    'Hangar / Nave': ['Hangar Pessoal','Nave Principal','Nave Secundária','Porta-Naves'],
  },
  Pyro: {
    'Planeta / Lua': [
      'Pyro I','Pyro II (Monox)','Pyro III','Pyro IV (Bloom)','Pyro V','Pyro VI (Terminus)',
      'Adir','Fairo','Ignis','Vatra',
    ],
    'Estação': [
      'Checkmate (Nyx Gateway)','Ruin Station','Orbituary','The Orphanage',
      'Patch City','Stanton Gateway','Nyx Jump Point',
    ],
    'Instalação': ['Rafe Place','Pirate Base','Syndicate Outpost','Scrapyard'],
    'Hangar / Nave': ['Hangar Pessoal','Nave Principal','Nave Secundária'],
  },
  Nyx: {
    'Planeta / Lua': ['Delamar','Levski'],
    'Estação': ['Stanton Gateway','Pyro Jump Point'],
    'Hangar / Nave': ['Hangar Pessoal','Nave Principal'],
  },
  Terra: {
    'Planeta': ['Prime','Ellis','Tohil'],
    'Estação': ['Terra Gateway'],
    'Hangar / Nave': ['Hangar Pessoal','Nave Principal'],
  },
  Odin: {
    'Planeta': ['Ayr-en','Laine'],
    'Estação': ['Odin Gateway'],
    'Hangar / Nave': ['Hangar Pessoal','Nave Principal'],
  },
};

// Mapa padrão usado somente para regras de auto-classificação da UEX.
// Os seletores do Inventário usam taxonomy, que é administrável na tela Sistema.
const CATEGORIES = DEFAULT_INVENTORY_TAXONOMY;

const CONDITIONS  = ['Novo','Excelente','Bom','Usado','Danificado','Destruído'];
const UNITS       = ['un','SCU','cSCU','mSCU','kg','l','stack'];
const GRADES      = ['','S','A','B','C','D','Military','Industrial','Civ','Stealth','Racing'];
const SIZES       = ['','0','1','2','3','4','5','6','7','8','Handheld','Personal'];

const CATEGORY_COLORS = {
  'Arma Pessoal':      '#fb7185',
  'Acessório de Arma': '#ff7755',
  'Armadura FPS':      '#38bdf8',
  'Roupa':             '#a78bfa',
  'Componente de Nave':'#6366f1',
  'Utilitário':        '#34d399',
  'Recurso / Minério': '#fbbf24',
  'Commodity':         '#f39c12',
  'Blueprint':         '#9b59b6',
  'Decoração / Flair': '#e91e63',
  'Consumível':        '#27ae60',
  'Contrabando':        '#e74c3c',
  'Miscellaneous':     '#7a90b0',
};

const SYSTEM_COLORS = {
  Stanton:'#38bdf8', Pyro:'#fb923c', Nyx:'#a78bfa', Terra:'#34d399', Odin:'#fbbf24',
};

// ─────────────────────────────────────────────────────────────────────────────
// Fuso horário Brasil (America/Sao_Paulo)
function nowBrasil() {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit',
  });
}
function ptDateTimeBrasil(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock API helpers (browser fallback)
// ─────────────────────────────────────────────────────────────────────────────
function getMockInvAPI() {
  const KEY = 'sc_inventory_v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY))||{itens:[],nextId:1}; } catch { return {itens:[],nextId:1}; } };
  const save = d => localStorage.setItem(KEY, JSON.stringify(d));
  return {
    getAll: async () => load().itens,
    create: async (item) => {
      const s = load();
      const newItem = { ...item, id: s.nextId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      s.itens.push(newItem); s.nextId++;
      save(s); return { success:true, id: newItem.id };
    },
    update: async (item) => {
      const s = load();
      const idx = s.itens.findIndex(i => i.id === item.id);
      if (idx !== -1) { s.itens[idx] = { ...item, updated_at: new Date().toISOString() }; save(s); }
      return { success:true };
    },
    delete: async (id) => {
      const s = load();
      s.itens = s.itens.filter(i => i.id !== id);
      save(s); return { success:true };
    },
    getStats: async () => {
      const itens = load().itens;
      const total = itens.length;
      const totalValor = itens.reduce((a,i) => a + (i.value_auec||0)*(i.quantity||1), 0);
      const bySys = Object.entries(itens.reduce((a,i) => { a[i.system]=(a[i.system]||0)+1; return a; },{}))
        .map(([system,count]) => ({system,count}));
      const byCat = Object.entries(itens.reduce((a,i) => { a[i.category]=(a[i.category]||0)+1; return a; },{}))
        .map(([category,count]) => ({category,count})).sort((a,b)=>b.count-a.count).slice(0,8);
      const contraband = itens.filter(i=>i.is_contraband).length;
      return { total, totalValor, bySys, byCat, contraband };
    },
  };
}

function inventoryStackKey(item) {
  return [
    String(item.name || '').trim().toLowerCase(), item.category || '', item.subcategory || '',
    item.unit || 'un', item.size || '', item.grade || '', item.manufacturer || '',
    item.condition || '', Number(item.value_auec) || 0, item.is_contraband ? 1 : 0,
    item.is_crafted ? 1 : 0, JSON.stringify(item.craft_status || []), item.notes || '',
    item.container || '',
  ].join('::');
}

// ─────────────────────────────────────────────────────────────────────────────
// ItemForm
// ─────────────────────────────────────────────────────────────────────────────
const emptyItem = () => ({
  name:'', category:'Arma Pessoal', subcategory:'',
  system:'Stanton', location_type:'Estação Orbital', location_name:'',
  container:'', quantity:0, unit:'un',
  size:'', grade:'', manufacturer:'', condition:'Bom',
  value_auec:0, is_contraband:false, notes:'',
  is_crafted:false, craft_status:[],
});

function newCraftStatusRow() { return { id: Date.now()+Math.random(), status:'', bonus:'' }; }

function ItemForm({ initial, onSave, onCancelar, taxonomy = [] }) {
  const [data, setData] = useState(() => {
    const base = initial ? { is_crafted:false, craft_status:[], ...initial } : emptyItem();
    return { ...base, craft_status: normalizeCraftStatus(base.craft_status) };
  });
  const [error, setError]     = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg]       = useState(false);
  const [importModal, setImportModal] = useState(null); // item UEX para importar
  const uexDbInfo = useMemo(() => {
    const db = loadUexItemsDB();
    return db.itemCount > 0 ? `${db.itemCount.toLocaleString('pt-BR')} itens UEX disponíveis` : null;
  }, []);

  const set = (k,v) => setData(p=>({...p,[k]:v}));

  // Autocomplete: buscar sugestões ao digitar o nome
  function handleNameChange(val) {
    set('name', val);
    if (val.trim().length >= 2) {
      const suggs = searchUexItems(val, 8);
      setSuggestions(suggs);
      setShowSugg(suggs.length > 0);
    } else {
      setSuggestions([]);
      setShowSugg(false);
    }
  }

  // Ao escolher uma sugestão — abre modal de importação
  function handleSelectSuggestion(uexItem) {
    const averagePrice = getUexItemAveragePriceByQuality(uexItem);
    setData(prev => ({
      ...prev,
      name: uexItem.name,
      value_auec: averagePrice > 0 ? averagePrice : prev.value_auec,
    }));
    setShowSugg(false);
    setSuggestions([]);
    setImportModal(uexItem);
  }

  // Mapear categoria/seção da UEX para categoria + subcategoria locais
  function mapUexToLocal(uexItem) {
    const hay = `${uexItem.section||''} ${uexItem.category||''}`.toLowerCase();
    const rules = [
      [['helmet'],'Armadura FPS','Capacete'], [['torso'],'Armadura FPS','Torso'],
      [['arm'],'Armadura FPS','Braços'], [['leg'],'Armadura FPS','Pernas'],
      [['backpack'],'Armadura FPS','Mochila'], [['undersuit'],'Armadura FPS','Undersuit'],
      [['full set'],'Armadura FPS','Set Completo'],
      [['assault rifle'],'Arma Pessoal','Rifle de Assalto'], [['sniper'],'Arma Pessoal','Rifle de Sniper'],
      [['shotgun'],'Arma Pessoal','Espingarda (Shotgun)'], [['smg'],'Arma Pessoal','SMG'],
      [['pistol'],'Arma Pessoal','Pistola'], [['grenade launcher'],'Arma Pessoal','Lança-granadas'],
      [['rocket launcher','missile launcher'],'Arma Pessoal','Lança-foguetes'],
      [['melee','knife'],'Arma Pessoal','Arma Melee'], [['ammo','ammunition'],'Arma Pessoal','Munição'],
      [['scope','sight','optic'],'Acessório de Arma','Mira/Scope'],
      [['suppressor','silencer'],'Acessório de Arma','Supressor'],
      [['flashlight','tactical light'],'Acessório de Arma','Lanterna Tática'],
      [['magazine'],'Acessório de Arma','Carregador'], [['underbarrel'],'Acessório de Arma','Underbarrel'],
      [['grip'],'Acessório de Arma','Empunhadura'],
      [['shield generator','shield'],'Componente de Nave','Escudo'],
      [['power plant'],'Componente de Nave','Planta de Energia'], [['cooler'],'Componente de Nave','Cooler'],
      [['quantum drive'],'Componente de Nave','Propulsor Quântico'], [['thruster'],'Componente de Nave','Thruster'],
      [['radar','avionics'],'Componente de Nave','Radar/Avionics'],
      [['mining laser','mining module','mining head'],'Componente de Nave','Módulo de Mining'],
      [['salvage'],'Componente de Nave','Módulo de Salvage'],
      [['weapon','cannon','laser repeater','ballistic gun','energy gun'],'Componente de Nave','Arma de Nave'],
      [['medpen','medical'],'Utilitário','Medpen'], [['multi-tool','multitool'],'Utilitário','Multi-Tool'],
      [['tractor beam'],'Utilitário','Tractor Beam'], [['scanner'],'Utilitário','Scanner'],
      [['jacket'],'Roupa','Jaqueta'], [['shirt'],'Roupa','Camisa'], [['pants','trouser'],'Roupa','Calça'],
      [['shoe','boot'],'Roupa','Calçado'], [['glove'],'Roupa','Luvas'], [['hat','cap'],'Roupa','Chapéu / Boné'],
      [['blueprint'],'Blueprint',''],
      [['flair','decal','trophy'],'Decoração / Flair',''],
      [['food'],'Consumível','Comida'], [['drink'],'Consumível','Bebida'],
    ];
    for (const [keywords, category, subcategory] of rules) {
      if (keywords.some(k => hay.includes(k))) return { category, subcategory };
    }
    return { category: null, subcategory: '' };
  }

  // Aplicar dados UEX ao form (incluindo preço)
  function applyUexData(uexItem, fields) {
    const updates = {};
    if (fields.includes('category') && uexItem.category) {
      const { category, subcategory } = mapUexToLocal(uexItem);
      if (category) {
        updates.category = category;
        // Só sobrescreve subcategoria se o mapeamento encontrou uma correspondente na lista local
        if (subcategory && getInventorySubcategoryOptions(category, '', taxonomy).some(option => option.name === subcategory)) updates.subcategory = subcategory;
      }
    }
    if (fields.includes('size')         && uexItem.size)         updates.size = uexItem.size;
    if (fields.includes('manufacturer') && uexItem.company_name) updates.manufacturer = uexItem.company_name;
    if (fields.includes('grade')        && uexItem.color)        updates.grade = uexItem.color;
    // Preço: usar a média salva no sync e os campos documentados como fallback.
    if (fields.includes('price')) {
      const price = getUexItemAveragePriceByQuality(uexItem);
      if (price > 0) updates.value_auec = price;
    }
    setData(p => ({ ...p, ...updates }));
    setImportModal(null);
  }

  const importPrice = importModal ? getUexItemAveragePriceByQuality(importModal) : 0;
  const [locationsVersion, setLocationsVersion] = useState(0);
  useEffect(() => {
    const refreshLocations = () => setLocationsVersion(version => version + 1);
    window.addEventListener(LOCATIONS_UPDATED_EVENT, refreshLocations);
    return () => window.removeEventListener(LOCATIONS_UPDATED_EVENT, refreshLocations);
  }, []);
  const LOCATIONS = useMemo(() => buildManagedLocationTree(), [locationsVersion]);

  const locationTiposFromBase = data.system && LOCATIONS[data.system]
    ? Object.keys(LOCATIONS[data.system]) : [];
  const locationTipos = data.location_type && !locationTiposFromBase.includes(data.location_type)
    ? [data.location_type, ...locationTiposFromBase]
    : locationTiposFromBase;
  const locationOptions = data.system && data.location_type && LOCATIONS[data.system]?.[data.location_type]
    ? LOCATIONS[data.system][data.location_type] : [];
  const categoryOptions = getInventoryCategoryOptions(data.category, taxonomy);
  const subcatOptions = getInventorySubcategoryOptions(data.category, data.subcategory || '', taxonomy);

  // Modo de digitação manual do local — estado próprio, independente de data.location_name,
  // pra não conflitar com o valor do <select> conforme o usuário digita.
  const [manualLocation, setManualLocation] = useState(() =>
    !!data.location_name && locationOptions.length > 0 && !locationOptions.includes(data.location_name)
  );

  function handleSistemaChange(sys) {
    const types = Object.keys(LOCATIONS[sys]||{});
    const lt = types[0]||'';
    const locs = (LOCATIONS[sys]||{})[lt]||[];
    setManualLocation(false);
    set('system',sys); set('location_type',lt); set('location_name',locs[0]||'');
  }
  function handleTipoChange(lt) {
    const locs = (LOCATIONS[data.system]||{})[lt]||[];
    setManualLocation(false);
    set('location_type',lt); set('location_name',locs[0]||'');
  }
  function handleLocationSelectChange(v) {
    if (v === '__custom') { setManualLocation(true); set('location_name',''); }
    else { setManualLocation(false); set('location_name', v); }
  }

  function handleSubmit() {
    if (!data.name.trim())          { setError('Nome do item é obrigatório.'); return; }
    if (!data.location_name.trim()) { setError('Localização é obrigatória.'); return; }
    setError('');
    onSave({ ...data, quantity:Number(data.quantity) >= 0 ? Number(data.quantity) : 1, value_auec:Number(data.value_auec)||0, is_contraband:data.is_contraband?1:0 });
  }

  const IS = { width:'100%',padding:'8px 12px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:14,outline:'none' };
  const LS = { fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 };
  const SS = { ...IS, padding:'8px 28px 8px 12px', appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center' };

  return (
    <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:10,padding:'24px',marginBottom:24 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
        <h3 style={{ fontFamily:'Michroma,sans-serif',fontSize:15,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.08em' }}>
          {initial?.id ? 'EDITAR ITEM' : 'REGISTRAR ITEM'}
        </h3>
        <button onClick={onCancelar} style={{ background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'5px 8px',display:'flex',alignItems:'center' }}>
          <X size={14}/>
        </button>
      </div>

      {/* Modal de importação UEX */}
      {importModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:16}} onClick={()=>setImportModal(null)}>
          <div style={{background:'var(--bg-card)',border:'1px solid rgba(56,189,248,0.4)',borderRadius:10,padding:20,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(0,0,0,0.7)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <span style={{fontSize:16}}>💡</span>
              <span style={{fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:700,color:'var(--accent-primary)',letterSpacing:'0.06em'}}>DADOS DA UEX ENCONTRADOS</span>
            </div>
            <div style={{fontSize:11,color:'var(--text-secondary)',marginBottom:14,lineHeight:1.6}}>
              <strong style={{color:'var(--text-primary)'}}>{importModal.name}</strong> foi encontrado no banco da UEX.<br/>
              Deseja importar as informações disponíveis?
            </div>

            {/* Preço em destaque */}
            {importPrice > 0 && (
              <div style={{marginBottom:12,padding:'10px 14px',background:'rgba(255,200,0,0.08)',border:'1px solid rgba(255,200,0,0.3)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:'var(--accent-gold)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3}}>💰 Preço Médio UEX</div>
                  <div style={{fontFamily:'Michroma,sans-serif',fontSize:20,fontWeight:800,color:'var(--accent-gold)'}}>
                    {importPrice.toLocaleString('pt-BR')} aUEC
                  </div>
                </div>
                {normalizeUexNumber(importModal.price_max) > 0 && (
                  <div style={{textAlign:'right',fontSize:10,color:'var(--text-muted)'}}>
                    <div>Máx: <span style={{color:'var(--accent-green)'}}>{normalizeUexNumber(importModal.price_max).toLocaleString('pt-BR')}</span></div>
                    <div>Mín: <span style={{color:'var(--accent-red)'}}>{normalizeUexNumber(importModal.price_min).toLocaleString('pt-BR')}</span></div>
                  </div>
                )}
              </div>
            )}
            {importPrice <= 0 && (
              <div style={{marginBottom:12,padding:'8px 10px',background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:6,fontSize:10,color:'var(--accent-gold)',lineHeight:1.5}}>
                Este item foi encontrado, mas ainda não possui preço médio no banco local. Execute novamente <strong>UEX API Live → Sync Banco de Itens</strong> para atualizar os preços.
              </div>
            )}

            {/* Campos disponíveis */}
            <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:14}}>
              {[
                ['Categoria',  importModal.category],
                ['Fabricante', importModal.company_name],
                ['Tamanho',    importModal.size ? `S${importModal.size}` : null],
                ['Cor/Grade',  importModal.color],
              ].filter(([,v]) => v).map(([label, val]) => (
                <div key={label} style={{display:'flex',justifyContent:'space-between',padding:'5px 10px',background:'rgba(56,189,248,0.05)',border:'1px solid rgba(56,189,248,0.15)',borderRadius:5,fontSize:11}}>
                  <span style={{color:'var(--text-muted)'}}>{label}</span>
                  <strong style={{color:'var(--text-primary)'}}>{val}</strong>
                </div>
              ))}
            </div>

            {importModal.wiki && (
              <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:12}}>
                📖 <a href={importModal.wiki} target="_blank" rel="noreferrer" style={{color:'var(--accent-primary)'}}>{importModal.wiki}</a>
              </div>
            )}

            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setImportModal(null)} style={{padding:'7px 14px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',fontFamily:'"Exo 2",sans-serif',fontSize:11,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>
                Só o Nome
              </button>
              <button onClick={()=>applyUexData(importModal,['category','size','manufacturer','grade'])} style={{padding:'7px 14px',background:'rgba(56,189,248,0.1)',border:'1px solid rgba(56,189,248,0.3)',borderRadius:5,color:'var(--accent-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:11,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>
                Sem Preço
              </button>
              <button onClick={()=>applyUexData(importModal,['category','size','manufacturer','grade','price'])} style={{display:'flex',alignItems:'center',gap:5,padding:'7px 14px',background:'rgba(255,200,0,0.1)',border:'1px solid rgba(255,200,0,0.35)',borderRadius:5,color:'var(--accent-gold)',fontFamily:'"Exo 2",sans-serif',fontSize:11,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>
                <Save size={11}/> Importar com Preço
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Nome + Categoria + Subcategoria */}
      <div style={{ display:'grid',gridTemplateColumns:'2fr 1.5fr 1.5fr',gap:12,marginBottom:12 }}>
        <div style={{position:'relative'}}>
          <label style={LS}>
            Nome do Item *
            {uexDbInfo && <span style={{marginLeft:8,fontSize:9,color:'var(--accent-green)',fontWeight:400}}>· {uexDbInfo}</span>}
          </label>
          <input
            style={IS}
            value={data.name}
            onChange={e=>handleNameChange(e.target.value)}
            onFocus={()=>{ if(data.name.trim().length>=2&&suggestions.length>0) setShowSugg(true); }}
            onBlur={()=>setTimeout(()=>setShowSugg(false),180)}
            placeholder="ex: Klaus & Werner Demeco, Behring P8-SC..."
          />
          {/* Dropdown de sugestões */}
          {showSugg && suggestions.length > 0 && (
            <div style={{
              position:'absolute',top:'100%',left:0,right:0,
              background:'var(--bg-card)',border:'1px solid var(--accent-primary)',
              borderTop:'none',borderRadius:'0 0 7px 7px',
              zIndex:500,maxHeight:240,overflowY:'auto',
              boxShadow:'0 8px 24px rgba(0,0,0,0.5)',
            }}>
              <div style={{padding:'4px 10px',fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',background:'var(--bg-panel)',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',gap:4}}>
                💡 Sugestões da UEX — clique para preencher
              </div>
              {suggestions.map(s => {
                const price = getUexItemAveragePriceByQuality(s);
                return (
                  <button key={s.id} onMouseDown={()=>handleSelectSuggestion(s)} style={{
                    display:'flex',alignItems:'center',justifyContent:'space-between',
                    width:'100%',padding:'8px 12px',background:'none',border:'none',
                    borderBottom:'1px solid var(--border-subtle)',
                    cursor:'pointer',fontSize:12,textAlign:'left',gap:10,
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(56,189,248,0.07)'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</div>
                      <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1,display:'flex',gap:6}}>
                        {s.category&&<span>{s.category}</span>}
                        {s.company_name&&<span>· {s.company_name}</span>}
                        {s.size&&<span>· S{s.size}</span>}
                      </div>
                    </div>
                    {price > 0 && (
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--accent-gold)',fontWeight:700}}>
                          {price.toLocaleString('pt-BR')} aUEC
                        </div>
                        <div style={{fontSize:9,color:'var(--text-muted)'}}>preço médio</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <label style={LS}>Categoria</label>
          <select style={SS} value={data.category} onChange={e=>{set('category',e.target.value);set('subcategory','');}}>
            {categoryOptions.map(category=><option key={category.id} value={category.name}>{category.name}</option>)}
          </select>
        </div>
        <div>
          <label style={LS}>Subcategoria</label>
          <select style={SS} value={data.subcategory} onChange={e=>set('subcategory',e.target.value)}>
            <option value="">— selecione —</option>
            {subcatOptions.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Row 2: Sistema + Localização Tipo + Localização */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1.5fr 2fr',gap:12,marginBottom:12 }}>
        <div>
          <label style={LS}>Sistema</label>
          <select style={SS} value={data.system} onChange={e=>handleSistemaChange(e.target.value)}>
            {Object.keys(LOCATIONS).map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={LS}>Tipo de Local</label>
          <select style={SS} value={data.location_type} onChange={e=>handleTipoChange(e.target.value)}>
            {locationTipos.map(lt=><option key={lt} value={lt}>{lt}</option>)}
          </select>
        </div>
        <div>
          <label style={LS}>Localização *</label>
          {locationOptions.length > 0 && !manualLocation ? (
            <select style={SS} value={data.location_name} onChange={e=>handleLocationSelectChange(e.target.value)}>
              <option value="">— selecione —</option>
              {locationOptions.map(l=><option key={l} value={l}>{l}</option>)}
              <option value="__custom">Outro (digitar)</option>
            </select>
          ) : (
            <div style={{ display:'flex', gap:6 }}>
              <input style={IS} value={data.location_name} onChange={e=>set('location_name',e.target.value)} placeholder="Digite o local..." autoFocus={manualLocation}/>
              {locationOptions.length > 0 && (
                <button type="button" onClick={()=>{ setManualLocation(false); set('location_name', locationOptions[0]||''); }}
                  style={{ padding:'0 10px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:6, color:'var(--text-secondary)', fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}>
                  Voltar à lista
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Container + Qty + Unidade + Valor */}
      <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1.5fr',gap:12,marginBottom:12 }}>
        <div>
          <label style={LS}>Container / Compartimento</label>
          <input style={IS} value={data.container} onChange={e=>set('container',e.target.value)} placeholder="ex: Armor Locker, Carga Grid, Inventário Pessoal..."/>
        </div>
        <div>
          <label style={LS}>Quantidade</label>
          <input style={IS} type="number" min="0" value={data.quantity} onChange={e=>set('quantity',e.target.value)}/>
        </div>
        <div>
          <label style={LS}>Unidade</label>
          <select style={SS} value={data.unit} onChange={e=>set('unit',e.target.value)}>
            {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label style={LS}>Valor (aUEC)</label>
          <input style={IS} type="number" min="0" value={data.value_auec} onChange={e=>set('value_auec',e.target.value)} placeholder="0"/>
        </div>
      </div>

      {/* Row 4: Fabricante + Tamanho + Grade + Condição */}
      <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1.5fr',gap:12,marginBottom:12 }}>
        <div>
          <label style={LS}>Fabricante</label>
          <input style={IS} value={data.manufacturer} onChange={e=>set('manufacturer',e.target.value)} placeholder="ex: Behring, Klaus & Werner, RSI..."/>
        </div>
        <div>
          <label style={LS}>Tamanho</label>
          <select style={SS} value={data.size} onChange={e=>set('size',e.target.value)}>
            {SIZES.map(s=><option key={s} value={s}>{s||'—'}</option>)}
          </select>
        </div>
        <div>
          <label style={LS}>Grade</label>
          <select style={SS} value={data.grade} onChange={e=>set('grade',e.target.value)}>
            {GRADES.map(g=><option key={g} value={g}>{g||'—'}</option>)}
          </select>
        </div>
        <div>
          <label style={LS}>Condição</label>
          <select style={SS} value={data.condition} onChange={e=>set('condition',e.target.value)}>
            {CONDITIONS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Craftado? */}
      <div style={{ marginBottom:12 }}>
        <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'10px 14px',background:data.is_crafted?'rgba(251,191,36,0.08)':'rgba(255,255,255,0.03)',border:`1px solid ${data.is_crafted?'rgba(251,191,36,0.35)':'var(--border-subtle)'}`,borderRadius:6,transition:'all 0.2s',marginBottom:data.is_crafted?10:0 }}>
          <input type="checkbox" checked={!!data.is_crafted} onChange={e=>set('is_crafted',e.target.checked)} style={{ accentColor:'var(--accent-gold)',width:16,height:16 }}/>
          <div>
            <div style={{ fontSize:12,fontWeight:700,color:data.is_crafted?'var(--accent-gold)':'var(--text-secondary)',letterSpacing:'0.06em' }}>⚒️ ITEM CRAFTADO</div>
            <div style={{ fontSize:10,color:'var(--text-muted)' }}>Registre os status que mudaram ao craftar este item</div>
          </div>
        </label>

        {data.is_crafted && (
          <div style={{ padding:'12px 14px', background:'rgba(251,191,36,0.04)', border:'1px solid rgba(251,191,36,0.15)', borderRadius:6 }}>
            <div style={{ fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8 }}>Status do Craft</div>
            {data.craft_status.map((row,i) => (
              <div key={row.id} style={{ display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,marginBottom:6 }}>
                <input style={IS} value={row.status} onChange={e=>{
                  const rows = data.craft_status.map((r,j)=> j===i ? {...r,status:e.target.value} : r);
                  set('craft_status', rows);
                }} placeholder="Status (ex: Potência do laser)"/>
                <input style={IS} value={row.bonus} onChange={e=>{
                  const rows = data.craft_status.map((r,j)=> j===i ? {...r,bonus:e.target.value} : r);
                  set('craft_status', rows);
                }} placeholder="Bônus (ex: +15%)"/>
                <button onClick={()=>set('craft_status', data.craft_status.filter((_,j)=>j!==i))}
                  style={{ width:32,height:32,borderRadius:5,border:'1px solid rgba(251,113,133,0.25)',background:'rgba(251,113,133,0.06)',color:'var(--accent-red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <X size={13}/>
                </button>
              </div>
            ))}
            <button onClick={()=>set('craft_status', [...data.craft_status, newCraftStatusRow()])}
              style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:5,color:'var(--accent-gold)',fontFamily:'"Exo 2",sans-serif',fontSize:11,fontWeight:700,cursor:'pointer',textTransform:'uppercase',marginTop:data.craft_status.length?4:0 }}>
              <Plus size={12}/> + Status
            </button>
          </div>
        )}
      </div>

      {/* Notas + Contrabando */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr auto',gap:12,alignItems:'start',marginBottom:12 }}>
        <div>
          <label style={LS}>Observações</label>
          <textarea className="notes-textarea" value={data.notes} onChange={e=>set('notes',e.target.value)}
            placeholder="Missão de origem, dicas de uso, estado atual, quem carrega..." style={{ minHeight:60,fontSize:13,marginTop:0 }}/>
        </div>
        <div style={{ paddingTop:20 }}>
          <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'10px 14px',background:data.is_contraband?'rgba(231,76,60,0.1)':'rgba(255,255,255,0.03)',border:`1px solid ${data.is_contraband?'rgba(231,76,60,0.35)':'var(--border-subtle)'}`,borderRadius:6,transition:'all 0.2s' }}>
            <input type="checkbox" checked={!!data.is_contraband} onChange={e=>set('is_contraband',e.target.checked)} style={{ accentColor:'#e74c3c',width:16,height:16 }}/>
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:data.is_contraband?'#e74c3c':'var(--text-secondary)',letterSpacing:'0.06em' }}>⚠️ CONTRABAND</div>
              <div style={{ fontSize:10,color:'var(--text-muted)' }}>Item ilegal</div>
            </div>
          </label>
        </div>
      </div>

      {error && (
        <div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.25)',borderRadius:6,marginBottom:12,color:'var(--accent-red)',fontSize:13 }}>
          <AlertTriangle size={14}/> {error}
        </div>
      )}

      <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
        <button onClick={onCancelar} style={{ padding:'10px 20px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.08em' }}>Cancelar</button>
        <button onClick={handleSubmit} style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 24px',background:'rgba(56,189,248,0.1)',border:'1px solid var(--border-normal)',borderRadius:6,color:'var(--accent-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',letterSpacing:'0.08em',textTransform:'uppercase' }}>
          <Save size={14}/>{initial?.id?'Salvar Alterações':'Registrar Item'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PafPanel — exibido no modal do item PAF
// ─────────────────────────────────────────────────────────────────────────────
function PafPanel({ item, allItems }) {
  const pafInfo = PAF_ITEMS[item.name];
  if (!pafInfo) return null;
  const qty     = Math.max(0, Number(item.quantity) || 0);
  const yields  = Math.floor(qty / pafInfo.ratio);
  const resto   = qty % pafInfo.ratio;
  const faltam  = resto > 0 ? pafInfo.ratio - resto : 0;
  const pct     = pafInfo.ratio > 1 ? (resto / pafInfo.ratio) * 100 : 100;
  const summary = calcPafSummary(allItems);

  return (
    <div style={{ gridColumn:'1/-1', marginTop:4, padding:'13px 14px', background:'rgba(56,189,248,0.05)', border:'1px solid rgba(56,189,248,0.25)', borderRadius:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
        <span style={{ fontSize:16 }}>{pafInfo.icon}</span>
        <span style={{ fontFamily:'Michroma,sans-serif', fontSize:11, fontWeight:700, color:PAF_COLOR, letterSpacing:'0.06em', textTransform:'uppercase' }}>
          Missão PAF — {item.name}
        </span>
        <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:4 }}>· {pafInfo.description}</span>
      </div>

      {/* Contadores deste item */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12 }}>
        <div style={{ textAlign:'center', padding:'8px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-subtle)', borderRadius:7 }}>
          <div style={{ fontFamily:'Michroma,sans-serif', fontSize:22, fontWeight:800, color:'var(--text-primary)', lineHeight:1 }}>{qty}</div>
          <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:4 }}>{pafInfo.unit}</div>
        </div>
        <div style={{ textAlign:'center', padding:'8px', background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:7 }}>
          <div style={{ fontFamily:'Michroma,sans-serif', fontSize:22, fontWeight:800, color:PAF_COLOR, lineHeight:1 }}>{yields}</div>
          <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:4 }}>{pafInfo.yields}</div>
        </div>
        <div style={{ textAlign:'center', padding:'8px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-subtle)', borderRadius:7 }}>
          <div style={{ fontFamily:'Michroma,sans-serif', fontSize:22, fontWeight:800, color:resto>0?'var(--accent-gold)':'var(--accent-green)', lineHeight:1 }}>{resto}</div>
          <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:4 }}>Sobra</div>
        </div>
      </div>

      {/* Progress bar para o próximo */}
      {pafInfo.ratio > 1 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginBottom:4 }}>
            <span>Progresso para próximo {pafInfo.yields}</span>
            {resto > 0
              ? <span style={{ color:'var(--accent-gold)', fontFamily:'Share Tech Mono,monospace' }}>{resto}/{pafInfo.ratio} · faltam {faltam}</span>
              : <span style={{ color:'var(--accent-green)' }}>✓ Quantidade exata!</span>
            }
          </div>
          <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${resto>0?pct:100}%`, background:PAF_COLOR, borderRadius:3, transition:'width 0.4s', boxShadow:`0 0 8px ${PAF_COLOR}88` }}/>
          </div>
        </div>
      )}

      {/* Resumo geral PAF com todos os itens */}
      <div style={{ padding:'10px 12px', background:'rgba(56,189,248,0.04)', border:'1px solid rgba(56,189,248,0.15)', borderRadius:7 }}>
        <div style={{ fontSize:10, fontWeight:700, color:PAF_COLOR, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>📡 Capacidade Total de Missão PAF</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {[
            { label:'Alinhamento', value:summary.satsAlign,   icon:'📡', color:'var(--accent-primary)', sub:`${summary.alinhamento} cartões` },
            { label:'Energia',     value:summary.satsEnergy,  icon:'🔋', color:'var(--accent-gold)',    sub:`${summary.bateria} baterias` },
            { label:'Lazers',      value:summary.lazersReady, icon:'🔫', color:'var(--accent-red)',     sub:`${summary.lazer} keycard${summary.lazer!==1?'s':''}` },
            { label:'PAF Completo',value:summary.pafCompletos,icon:'🛰',  color:'var(--accent-green)',  sub:'mínimo dos 3' },
          ].map(({label,value,icon,color,sub})=>(
            <div key={label} style={{ textAlign:'center', padding:'8px 4px', background:'rgba(255,255,255,0.03)', border:`1px solid ${color}22`, borderRadius:6 }}>
              <div style={{ fontSize:16, marginBottom:3 }}>{icon}</div>
              <div style={{ fontFamily:'Michroma,sans-serif', fontSize:17, fontWeight:800, color, lineHeight:1, marginBottom:2 }}>{value}</div>
              <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
              <div style={{ fontSize:9, color:'var(--text-muted)', fontStyle:'italic', marginTop:2 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ItemCard — card visual com modal de detalhes
// ─────────────────────────────────────────────────────────────────────────────
const ItemCard = React.memo(function ItemCard({ item, onEdit, onDelete, onScriptUpdate, allItems, transferDestinations, onTransfer }) {
  const [showDetail, setShowDetail] = useState(false);
  const displayName = normalizeUexItemName(item.name) || String(item.name || '').trim();
  const craftStatus = normalizeCraftStatus(item.craft_status);
  const [showTransfer, setShowTransfer] = useState(false);
  const [delConf,    setDelConf]    = useState(false);
  const catColor = CATEGORY_COLORS[item.category] || 'var(--text-muted)';
  const sysColor = SYSTEM_COLORS[item.system]     || 'var(--accent-primary)';
  const isScript = isScriptItem(displayName);
  const isPaf    = isPafItem(displayName);
  const favors   = isScript ? Math.floor((item.quantity||0) / SCRIPT_RATIO) : 0;
  const resto    = isScript ? (item.quantity||0) % SCRIPT_RATIO : 0;
  const totalVal = (item.value_auec||0) * (item.quantity||1);

  return (
    <>
      {/* Card */}
      <div className="inventory-item-card" onClick={()=>setShowDetail(true)} style={{
        background: item.quantity === 0 ? 'rgba(255,255,255,0.01)' : 'var(--bg-card)',
        border:`1px solid ${item.quantity===0?'rgba(255,255,255,0.06)':item.is_contraband?'rgba(231,76,60,0.35)':isScript?'rgba(162,155,254,0.3)':'var(--border-subtle)'}`,
        borderTop:`3px solid ${item.quantity===0?'rgba(255,255,255,0.1)':item.is_contraband?'#e74c3c':isScript?WIKELO_COLOR:catColor}`,
        borderRadius:8, padding:'12px 13px', cursor:'pointer',
        transition:'all 0.18s', display:'flex', flexDirection:'column', gap:8,
        minHeight:110, opacity: item.quantity === 0 ? 0.45 : 1,
      }}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 6px 20px rgba(0,0,0,0.3), 0 0 0 1px ${isScript?WIKELO_COLOR:catColor}44`;}}
      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>

        {/* Linha 1: nome + badges */}
        <div className="inventory-item-card-header" style={{display:'flex',alignItems:'flex-start',gap:6,flexWrap:'wrap'}}>
          <span className="inventory-item-card-title" style={{fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)',flex:1,lineHeight:1.3}}>{displayName}</span>
          {item.quantity === 0 && <span style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:'rgba(255,255,255,0.06)',color:'var(--text-muted)',border:'1px solid rgba(255,255,255,0.1)',fontWeight:700,flexShrink:0}}>SEM ESTOQUE</span>}
          {item.is_contraband ? <span style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:'rgba(231,76,60,0.15)',color:'#e74c3c',border:'1px solid rgba(231,76,60,0.3)',fontWeight:700,flexShrink:0}}>⚠ CONTRA</span> : null}
          {item.is_crafted ? <span style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:'rgba(251,191,36,0.15)',color:'var(--accent-gold)',border:'1px solid rgba(251,191,36,0.3)',fontWeight:700,flexShrink:0}}>⚒ CRAFT</span> : null}
          {isScript && <span style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:'rgba(162,155,254,0.15)',color:WIKELO_COLOR,border:`1px solid rgba(162,155,254,0.3)`,fontWeight:700,flexShrink:0}}>★ WIKELO</span>}
          {isPaf && <span style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:'rgba(56,189,248,0.15)',color:PAF_COLOR,border:'1px solid rgba(56,189,248,0.3)',fontWeight:700,flexShrink:0}}>📡 PAF</span>}
        </div>

        {/* Linha 2: categoria + sistema */}
        <div className="inventory-item-card-category-row" style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          <div className="inventory-item-card-category-dot" style={{width:7,height:7,borderRadius:'50%',background:catColor,flexShrink:0}}/>
          <span className="inventory-item-card-category" style={{fontSize:10,color:catColor,fontWeight:600}}>{item.category || 'Sem categoria'}</span>
          {item.subcategory && <span className="inventory-item-card-subcategory" style={{fontSize:10,color:'var(--text-muted)'}}>· {item.subcategory}</span>}
        </div>

        {/* Linha 3: localização */}
        <div style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'var(--text-muted)'}}>
          <MapPin size={9} style={{color:sysColor,flexShrink:0}}/>
          <span className="inventory-item-card-location-name" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.location_name || 'Local não informado'}</span>
          {item.container && <span className="inventory-item-card-container" style={{color:'var(--text-muted)',flexShrink:0}}>[{item.container}]</span>}
        </div>

        {/* Linha 4: qty + valor */}
        <div className="inventory-item-card-footer" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'auto'}}>
          <button onClick={e=>{e.stopPropagation();setShowTransfer(true);}} disabled={Number(item.quantity)<=0} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 7px',background:'rgba(56,189,248,0.07)',border:'1px solid rgba(56,189,248,0.2)',borderRadius:4,color:'var(--accent-primary)',cursor:Number(item.quantity)>0?'pointer':'not-allowed',fontSize:9,fontWeight:700,fontFamily:'"Exo 2",sans-serif',textTransform:'uppercase',opacity:Number(item.quantity)>0?1:0.5}}>
            <MapPin size={10}/> Transferir
          </button>
          <div className="inventory-item-card-quantity" style={{display:'flex',alignItems:'center',gap:7,marginLeft:'auto'}}>
            <QuantityAdjuster item={item} onUpdate={onScriptUpdate} compact/>
            <div>
              {isScript ? (
                <div>
                  <span style={{fontFamily:'Share Tech Mono,monospace',fontSize:13,color:WIKELO_COLOR,fontWeight:700}}>{item.quantity} un</span>
                  <div style={{fontSize:10,color:WIKELO_COLOR,opacity:0.8}}>{favors} favor{favors!==1?'s':''}{resto>0?` +${resto}`:''}</div>
                </div>
              ) : (
                <span style={{fontFamily:'Share Tech Mono,monospace',fontSize:13,color:item.quantity>1?'var(--accent-primary)':'var(--text-secondary)',fontWeight:600}}>{item.quantity} {item.unit}</span>
              )}
            </div>
          </div>
          {totalVal > 0 && <span className="inventory-item-card-value" style={{fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--accent-gold)'}}>{totalVal.toLocaleString('pt-BR')} aUEC</span>}
        </div>
      </div>

      {showTransfer && (
        <TransferModal
          itemName={displayName}
          quantity={item.quantity}
          unit={item.unit}
          destinations={transferDestinations}
          currentKey={`${item.system}::${item.location_type}::${item.location_name}`}
          onCancel={()=>setShowTransfer(false)}
          onConfirm={payload=>{onTransfer(item, payload);setShowTransfer(false);setShowDetail(false);}}
        />
      )}

      {/* Modal de detalhes */}
      {showDetail && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}} onClick={()=>setShowDetail(false)}>
          <div style={{background:'var(--bg-card)',border:`1px solid ${isScript?'rgba(162,155,254,0.4)':catColor+'44'}`,borderRadius:12,padding:22,width:'100%',maxWidth:580,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.7)'}} onClick={e=>e.stopPropagation()}>

            {/* Header modal */}
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                  <span style={{fontFamily:'"Exo 2",sans-serif',fontSize:17,fontWeight:700,color:'var(--text-primary)'}}>{displayName}</span>
                  {item.is_contraband && <span style={{fontSize:9,padding:'1px 6px',borderRadius:3,background:'rgba(231,76,60,0.15)',color:'#e74c3c',border:'1px solid rgba(231,76,60,0.3)',fontWeight:700}}>⚠ CONTRABAND</span>}
                  {isScript && <span style={{fontSize:9,padding:'1px 6px',borderRadius:3,background:'rgba(162,155,254,0.15)',color:WIKELO_COLOR,border:`1px solid rgba(162,155,254,0.3)`,fontWeight:700}}>★ WIKELO FAVOR</span>}
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:catColor}}/>
                  <span style={{fontSize:11,color:catColor,fontWeight:600}}>{item.category}{item.subcategory?` · ${item.subcategory}`:''}</span>
                  <span style={{fontSize:11,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:3}}>
                    <MapPin size={10} style={{color:sysColor}}/><span style={{color:sysColor,fontWeight:600}}>{item.system}</span> — {item.location_name}
                    {item.container && <span style={{color:'var(--text-muted)'}}> [{item.container}]</span>}
                  </span>
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button onClick={()=>{onEdit(item);setShowDetail(false);}} style={{width:30,height:30,borderRadius:5,border:'1px solid var(--border-normal)',background:'rgba(56,189,248,0.08)',color:'var(--accent-primary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Edit3 size={13}/></button>
                <button onClick={()=>setShowDetail(false)} style={{width:30,height:30,borderRadius:5,border:'1px solid var(--border-subtle)',background:'transparent',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={13}/></button>
              </div>
            </div>

            <QuantityAdjuster item={item} onUpdate={onScriptUpdate}/>

            {/* Grid de atributos */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
              {[
                ['Quantidade', `${item.quantity} ${item.unit}`],
                ['Valor Unit.', item.value_auec>0?`${item.value_auec.toLocaleString('pt-BR')} aUEC`:'—'],
                ['Valor Total', totalVal>0?`${totalVal.toLocaleString('pt-BR')} aUEC`:'—'],
                ['Fabricante', item.manufacturer||'—'],
                ['Condição', item.condition||'—'],
                ['Tamanho', item.size||'—'],
                ['Grade', item.grade||'—'],
                ['Sistema', item.system],
                ['Registrado', item.created_at?new Date(item.created_at).toLocaleDateString('pt-BR'):'—'],
              ].map(([k,v])=>(
                <div key={k} style={{padding:'8px 10px',background:'rgba(255,255,255,0.03)',border:'1px solid var(--border-subtle)',borderRadius:6}}>
                  <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3}}>{k}</div>
                  <div style={{fontSize:12,color:'var(--text-secondary)',fontFamily:k==='Quantidade'||k.includes('Valor')||k==='Registrado'?'Share Tech Mono,monospace':'inherit'}}>{v}</div>
                </div>
              ))}
            </div>

            {item.is_crafted && craftStatus.length > 0 && (
              <div style={{marginBottom:14,padding:'10px 12px',background:'rgba(251,191,36,0.05)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:6}}>
                <div style={{fontSize:9,fontWeight:700,color:'var(--accent-gold)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>⚒️ Item Craftado</div>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {craftStatus.map(row => (
                    <div key={row.id} style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                      <span style={{color:'var(--text-secondary)'}}>{row.status}</span>
                      <span style={{color:'var(--accent-gold)',fontWeight:700,fontFamily:'Share Tech Mono,monospace'}}>{row.bonus}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {item.notes && (
              <div style={{marginBottom:14,padding:'8px 12px',background:'rgba(255,255,255,0.03)',border:'1px solid var(--border-subtle)',borderRadius:6}}>
                <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>Observações</div>
                <div style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.6}}>{item.notes}</div>
              </div>
            )}

            {/* ScriptPanel dentro do modal */}
            {isScript && (
              <div style={{marginBottom:14}}>
                <ScriptPanel item={item} onUpdate={(id,qty)=>{onScriptUpdate(id,qty);}}/>
              </div>
            )}
            {/* PafPanel dentro do modal */}
            {isPafItem(item.name) && (
              <div style={{marginBottom:14}}>
                <PafPanel item={item} allItems={allItems||[]}/>
              </div>
            )}

            {/* Deletar */}
                <div style={{display:'flex',justifyContent:'flex-end',gap:8,paddingTop:8,borderTop:'1px solid var(--border-subtle)'}}>
                  <button onClick={()=>{setShowTransfer(true);setShowDetail(false);}} disabled={Number(item.quantity)<=0} style={{display:'flex',alignItems:'center',gap:5,padding:'6px 12px',background:'rgba(56,189,248,0.08)',border:'1px solid rgba(56,189,248,0.25)',borderRadius:5,color:'var(--accent-primary)',cursor:Number(item.quantity)>0?'pointer':'not-allowed',fontSize:11,fontWeight:700,fontFamily:'"Exo 2",sans-serif',textTransform:'uppercase',opacity:Number(item.quantity)>0?1:0.5}}><MapPin size={11}/> Transferir para...</button>
              {delConf ? (
                <>
                  <span style={{fontSize:12,color:'var(--accent-red)',alignSelf:'center'}}>Confirmar exclusão?</span>
                  <button onClick={()=>{onDelete(item.id);setShowDetail(false);}} style={{padding:'6px 14px',background:'rgba(251,113,133,0.15)',border:'1px solid rgba(251,113,133,0.4)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'"Exo 2",sans-serif'}}>Sim, Apagar</button>
                  <button onClick={()=>setDelConf(false)} style={{padding:'6px 12px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',fontSize:11}}>Cancelar</button>
                </>
              ) : (
                <button onClick={()=>setDelConf(true)} style={{display:'flex',alignItems:'center',gap:5,padding:'6px 14px',background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.2)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'"Exo 2",sans-serif',textTransform:'uppercase'}}>
                  <Trash2 size={11}/> Apagar Item
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

// ── Baú Desconhecido ───────────────────────────────────────────────────────────
function UnknownVaultPanel({ items, locationOptions, onDirect }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [destination, setDestination] = useState({ system:'', location_type:'', location_name:'' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const systems = useMemo(() => [...new Set((locationOptions || []).map(option => option.system).filter(Boolean))].sort(), [locationOptions]);
  const types = useMemo(() => [...new Set((locationOptions || []).filter(option => option.system === destination.system).map(option => option.location_type).filter(Boolean))].sort(), [locationOptions, destination.system]);
  const names = useMemo(() => [...new Set((locationOptions || []).filter(option => option.system === destination.system && option.location_type === destination.location_type).map(option => option.location_name).filter(Boolean))].sort(), [locationOptions, destination.system, destination.location_type]);

  function openDirection(item) {
    const first = locationOptions?.[0] || {};
    setSelectedItem(item);
    setError('');
    setDestination({ system:first.system || systems[0] || '', location_type:first.location_type || '', location_name:first.location_name || '' });
  }
  function changeSystem(system) {
    const availableTypes = [...new Set((locationOptions || []).filter(option => option.system === system).map(option => option.location_type).filter(Boolean))].sort();
    const nextType = availableTypes[0] || '';
    const nextName = locationOptions.find(option => option.system === system && option.location_type === nextType)?.location_name || '';
    setDestination({ system, location_type:nextType, location_name:nextName });
  }
  function changeType(location_type) {
    const nextName = locationOptions.find(option => option.system === destination.system && option.location_type === location_type)?.location_name || '';
    setDestination(prev => ({ ...prev, location_type, location_name:nextName }));
  }
  async function confirmDirection() {
    if (!selectedItem || !destination.system || !destination.location_type || !destination.location_name) {
      setError('Selecione sistema, tipo de local e localização.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ok = await onDirect(selectedItem, destination);
      if (ok) setSelectedItem(null);
      else setError('Não foi possível gravar o scrip no local escolhido.');
    } catch (err) {
      setError(err.message || 'Não foi possível direcionar o item.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{marginBottom:20,padding:'14px 16px',background:'linear-gradient(135deg,rgba(162,155,254,0.10),rgba(56,189,248,0.04))',border:'1px solid rgba(162,155,254,0.32)',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.12)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:30,height:30,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(162,155,254,0.16)',color:'#a29bfe'}}><Package size={16}/></div>
          <div><div style={{fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:800,color:'#c4b5fd',letterSpacing:'0.08em'}}>BAÚ DESCONHECIDO</div><div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>Scrip recebido em missão aguardando um local definitivo</div></div>
        </div>
        <span style={{fontFamily:'Share Tech Mono,monospace',fontSize:12,fontWeight:800,color:items.length?'#c4b5fd':'var(--text-muted)'}}>{items.length} pendente{items.length === 1 ? '' : 's'}</span>
      </div>
      {items.length === 0 ? <div style={{padding:'10px 12px',border:'1px dashed rgba(162,155,254,0.22)',borderRadius:7,fontSize:11,color:'var(--text-muted)'}}>Nenhum MG Scrip ou Council Scrip aguardando direcionamento.</div> : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:8}}>{items.map(item => <div key={item.id} style={{padding:'10px 11px',background:'rgba(7,12,24,0.28)',border:'1px solid rgba(162,155,254,0.18)',borderRadius:7}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><strong style={{fontSize:12,color:'var(--text-primary)'}}>{item.name}</strong><span style={{fontFamily:'Share Tech Mono,monospace',fontSize:15,fontWeight:800,color:'#c4b5fd'}}>{item.quantity}</span></div><div style={{fontSize:10,color:'var(--text-muted)',marginTop:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.source_mission_title || 'Origem não informada'}</div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:8}}><span style={{fontSize:9,color:'var(--text-muted)'}}>{item.received_at ? new Date(item.received_at).toLocaleDateString('pt-BR') : '—'}</span><button type="button" onClick={()=>openDirection(item)} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 8px',borderRadius:5,border:'1px solid rgba(162,155,254,0.35)',background:'rgba(162,155,254,0.10)',color:'#c4b5fd',cursor:'pointer',fontSize:10,fontWeight:700}}><MapPin size={11}/> Direcionar</button></div></div>)}</div>}
      {selectedItem && <div style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(0,0,0,0.72)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onMouseDown={()=>!busy&&setSelectedItem(null)}><div style={{width:'100%',maxWidth:520,padding:18,background:'var(--bg-card)',border:'1px solid rgba(162,155,254,0.38)',borderRadius:10,boxShadow:'0 20px 60px rgba(0,0,0,0.55)'}} onMouseDown={event=>event.stopPropagation()}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:4}}><div style={{fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:800,color:'#c4b5fd'}}>DIRECIONAR PARA O INVENTÁRIO</div><button type="button" onClick={()=>setSelectedItem(null)} disabled={busy} style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer'}}><X size={15}/></button></div><div style={{fontSize:11,color:'var(--text-secondary)',marginBottom:14}}><strong style={{color:'var(--text-primary)'}}>{selectedItem.name} ×{selectedItem.quantity}</strong> será somado ao item existente no destino, se houver.</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><label style={{fontSize:10,color:'var(--text-muted)',fontWeight:700,textTransform:'uppercase'}}>Sistema<select value={destination.system} onChange={event=>changeSystem(event.target.value)} style={{display:'block',width:'100%',marginTop:4,padding:'8px 9px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)'}}>{systems.map(system=><option key={system} value={system}>{system}</option>)}</select></label><label style={{fontSize:10,color:'var(--text-muted)',fontWeight:700,textTransform:'uppercase'}}>Tipo de local<select value={destination.location_type} onChange={event=>changeType(event.target.value)} style={{display:'block',width:'100%',marginTop:4,padding:'8px 9px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)'}}>{types.map(type=><option key={type} value={type}>{type}</option>)}</select></label></div><label style={{display:'block',marginTop:9,fontSize:10,color:'var(--text-muted)',fontWeight:700,textTransform:'uppercase'}}>Localização<select value={destination.location_name} onChange={event=>setDestination(prev=>({...prev,location_name:event.target.value}))} style={{display:'block',width:'100%',marginTop:4,padding:'8px 9px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)'}}>{names.map(name=><option key={name} value={name}>{name}</option>)}</select></label>{error&&<div style={{marginTop:9,padding:'7px 9px',background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.25)',borderRadius:5,color:'var(--accent-red)',fontSize:11}}>{error}</div>}<div style={{display:'flex',justifyContent:'flex-end',gap:7,marginTop:16}}><button type="button" onClick={()=>setSelectedItem(null)} disabled={busy} style={{padding:'7px 12px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer'}}>Cancelar</button><button type="button" onClick={confirmDirection} disabled={busy} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'7px 13px',background:'rgba(162,155,254,0.14)',border:'1px solid rgba(162,155,254,0.4)',borderRadius:5,color:'#c4b5fd',cursor:'pointer',fontWeight:700}}>{busy?<RefreshCw size={12} className="spin"/>:<Check size={12}/>} {busy?'Salvando...':'Confirmar destino'}</button></div></div></div>}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
// Navegação: Sistema → Local → Cards
export default function InventoryPage() {
  const [itens,        setItens]        = useState([]);
  const itensRef = useRef([]);
  const [unknownVaultItems, setUnknownVaultItems] = useState(() => loadUnknownVault().items);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [editItem,     setEditItem]     = useState(null);
  const [search,       setSearch]       = useState('');
  // Navegação hierárquica
  const [selSystem,    setSelSystem]    = useState(null); // null = tela de sistemas
  const [selLocation,  setSelLocation]  = useState(null); // null = tela de locais do sistema
  const [filterCat,    setFilterCat]    = useState('all');
  const [sortBy,       setSortBy]       = useState('name');
  const [viewMode,     setViewMode]     = useState('grid'); // grid | list

  const [taxonomy, setTaxonomy] = useState(() => loadInventoryTaxonomy());
  useEffect(() => {
    const refreshTaxonomy = event => setTaxonomy(Array.isArray(event?.detail) ? event.detail : loadInventoryTaxonomy());
    window.addEventListener(INVENTORY_TAXONOMY_UPDATED_EVENT, refreshTaxonomy);
    window.addEventListener('storage', refreshTaxonomy);
    return () => {
      window.removeEventListener(INVENTORY_TAXONOMY_UPDATED_EVENT, refreshTaxonomy);
      window.removeEventListener('storage', refreshTaxonomy);
    };
  }, []);

  const [locationsVersion, setLocationsVersion] = useState(0);
  useEffect(() => {
    const refreshLocations = () => setLocationsVersion(version => version + 1);
    window.addEventListener(LOCATIONS_UPDATED_EVENT, refreshLocations);
    return () => window.removeEventListener(LOCATIONS_UPDATED_EVENT, refreshLocations);
  }, []);

  const transferDestinations = useMemo(
    () => buildManagedLocationOptions(),
    [locationsVersion]
  );

  const invAPI = useMemo(() => {
    if (window.electronAPI) {
      return {
        getAll:  () => window.electronAPI.inventoryGetAll(),
        create:  (i) => window.electronAPI.inventoryCreate(i),
        update:  (i) => window.electronAPI.inventoryUpdate(i),
        delete:  (id) => window.electronAPI.inventoryDelete(id),
        getStats:() => window.electronAPI.inventoryGetStats(),
      };
    }
    return getMockInvAPI();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const all = await invAPI.getAll();
      const normalized = (Array.isArray(all) ? all : []).map(item => ({
        ...item,
        name: normalizeUexItemName(item.name),
        craft_status: normalizeCraftStatus(item.craft_status),
      }));
      itensRef.current = normalized;
      setItens(normalized);
      return normalized;
    } catch(e) { console.error(e); return []; }
    finally { setLoading(false); }
  }, [invAPI]);

  useEffect(() => { loadData(); }, [loadData]);

  const refreshUnknownVault = useCallback(() => {
    setUnknownVaultItems(loadUnknownVault().items);
  }, []);

  useEffect(() => {
    refreshUnknownVault();
    window.addEventListener(UNKNOWN_VAULT_UPDATED_EVENT, refreshUnknownVault);
    return () => window.removeEventListener(UNKNOWN_VAULT_UPDATED_EVENT, refreshUnknownVault);
  }, [refreshUnknownVault]);

  const handleEditItem = useCallback((item) => {
    setEditItem(item);
    setShowForm(false);
  }, []);

  const handleSave = useCallback(async (data) => {
    const normalizedData = {
    ...data,
    name: normalizeUexItemName(data.name),
    craft_status: normalizeCraftStatus(data.craft_status),
  };
    if (normalizedData.id) await invAPI.update(normalizedData);
    else { await invAPI.create(normalizedData); setProvenance('item', normalizedData.name, SOURCES.MANUAL); }
    setShowForm(false); setEditItem(null);
    const refreshed = await loadData();
    publishInventoryUpdate(refreshed);
  }, [invAPI, loadData]);
  const handleDelete = useCallback(async (id) => {
    await invAPI.delete(id);
    const refreshed = await loadData();
    publishInventoryUpdate(refreshed);
  }, [invAPI, loadData]);

  const handleTransfer = useCallback(async (item, { destination, quantity }) => {
    const sourceQuantity = Math.max(0, Number(item.quantity) || 0);
    const amount = Math.max(0, Number(quantity) || 0);
    if (!destination || amount <= 0 || amount > sourceQuantity) return;

    const sourceRemaining = sourceQuantity - amount;
    const destinationFields = {
      system: destination.system,
      location_type: destination.location_type,
      location_name: destination.location_name,
    };
    const currentItems = itensRef.current;
    const target = currentItems.find(other =>
      other.id !== item.id &&
      other.system === destination.system &&
      other.location_type === destination.location_type &&
      other.location_name === destination.location_name &&
      inventoryStackKey(other) === inventoryStackKey(item)
    );

    const original = { ...item };
    try {
      if (sourceRemaining === 0 && !target) {
        // Movimento integral sem duplicata: preserva o id e todos os metadados.
        await invAPI.update({ ...item, ...destinationFields });
      } else if (target) {
        // Primeiro atualiza o destino; se a origem falhar, tenta desfazer o incremento.
        const updatedTarget = { ...target, quantity:(Number(target.quantity)||0) + amount };
        await invAPI.update(updatedTarget);
        try {
          if (sourceRemaining === 0) await invAPI.delete(item.id);
          else await invAPI.update({ ...item, quantity:sourceRemaining });
        } catch (sourceError) {
          await invAPI.update(target);
          throw sourceError;
        }
      } else {
        // Movimento parcial: reduz a origem e cria uma entrada equivalente no destino.
        await invAPI.update({ ...item, quantity:sourceRemaining });
        try {
          const transferred = { ...item, ...destinationFields, quantity:amount };
          delete transferred.id;
          delete transferred.created_at;
          delete transferred.updated_at;
          await invAPI.create(transferred);
        } catch (destinationError) {
          await invAPI.update(original);
          throw destinationError;
        }
      }
      const refreshed = await loadData();
      publishInventoryUpdate(refreshed);
    } catch (e) {
      console.error('Erro ao transferir item:', e);
      const refreshed = await loadData();
      publishInventoryUpdate(refreshed);
    }
  }, [invAPI, loadData]);

  const handleDirectUnknownItem = useCallback(async (unknownItem, destination) => {
    const canonicalName = normalizeScriptName(unknownItem.name) || unknownItem.name;
    const amount = Math.max(0, Number(unknownItem.quantity) || 0);
    if (!canonicalName || amount <= 0) return false;

    const target = itensRef.current.find(item => {
      const itemName = normalizeScriptName(item.name) || item.name;
      return !isUnknownVaultItem(item)
        && String(itemName || '').trim().toLowerCase() === String(canonicalName || '').trim().toLowerCase()
        && item.system === destination.system
        && item.location_type === destination.location_type
        && item.location_name === destination.location_name;
    });

    try {
      if (target) {
        await invAPI.update({ ...target, name: canonicalName, quantity: Math.max(0, Number(target.quantity) || 0) + amount, unit: target.unit || 'un' });
      } else {
        await invAPI.create({
          name: canonicalName,
          category: 'Miscellaneous',
          subcategory: 'Outro',
          system: destination.system,
          location_type: destination.location_type,
          location_name: destination.location_name,
          container: '',
          quantity: amount,
          unit: 'un',
          size: '',
          grade: '',
          manufacturer: '',
          condition: 'Novo',
          value_auec: 0,
          is_contraband: 0,
          notes: 'Recebido de missão e direcionado pelo Baú Desconhecido.',
          is_crafted: 0,
          craft_status: [],
        });
      }
      removeFromUnknownVault(unknownItem.id);
      const refreshed = await loadData();
      publishInventoryUpdate(refreshed);
      refreshUnknownVault();
      return true;
    } catch (error) {
      console.error('Erro ao direcionar scrip do Baú Desconhecido:', error);
      return false;
    }
  }, [invAPI, loadData, refreshUnknownVault]);

  const handleScriptUpdate = useCallback(async (id, newQty) => {
    const current = itensRef.current.find(i => i.id === id);
    if (!current) return;

    // Normaliza para número e atualiza a referência imediatamente para que cliques rápidos
    // não calculem sobre um snapshot antigo do estado React.
    const quantity = Math.max(0, Number(newQty) || 0);
    const updatedItem = { ...current, quantity };
    const nextItems = itensRef.current.map(i => i.id === id ? updatedItem : i);
    itensRef.current = nextItems;
    setItens(nextItems);

    try {
      await invAPI.update(updatedItem);
      publishInventoryUpdate(itensRef.current);
    } catch (e) {
      const refreshed = await loadData();
      publishInventoryUpdate(refreshed);
      console.error('Erro ao atualizar quantidade de script:', e);
    }
  }, [invAPI, loadData]);

  // ── Derivados para navegação ──
  const regularItems = useMemo(() => itens.filter(item => !isUnknownVaultItem(item)), [itens]);
  // Sistemas que têm itens
  const systemsWithItems = useMemo(() => {
    const counts = {};
    regularItems.forEach(i => { counts[i.system] = (counts[i.system]||0)+1; });
    const allSystems = [...new Set([...SYSTEMS, ...Object.keys(counts)])];
    return allSystems.map(s => ({ name:s, count:counts[s]||0 }));
  }, [regularItems]);

  // Locais dentro do sistema selecionado que têm itens
  const locationsInSystem = useMemo(() => {
    if (!selSystem) return [];
    const inSys = regularItems.filter(i => i.system === selSystem);
    const map = {};
    inSys.forEach(i => {
      const loc = i.location_name || 'Desconhecido';
      if (!map[loc]) map[loc] = { name:loc, count:0, categories:new Set(), totalValue:0 };
      map[loc].count++;
      map[loc].categories.add(i.category);
      map[loc].totalValue += (i.value_auec||0)*(i.quantity||1);
    });
    return Object.values(map).sort((a,b) => b.count - a.count);
  }, [regularItems, selSystem]);

  // Itens filtrados para exibição
  const displayItems = useMemo(() => {
    let res = [...regularItems];
    if (selSystem)   res = res.filter(i => i.system === selSystem);
    if (selLocation) res = res.filter(i => i.location_name === selLocation);
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.location_name?.toLowerCase().includes(q) ||
        i.manufacturer?.toLowerCase().includes(q) ||
        i.notes?.toLowerCase().includes(q)
      );
    }
    if (filterCat !== 'all') res = res.filter(i => i.category === filterCat);
    res.sort((a,b) => {
      switch(sortBy) {
        case 'value':    return (b.value_auec*b.quantity)-(a.value_auec*a.quantity);
        case 'qty':      return b.quantity - a.quantity;
        case 'category': return (a.category||'').localeCompare(b.category||'');
        default:         return (a.name||'').localeCompare(b.name||'');
      }
    });
    return res;
  }, [regularItems, selSystem, selLocation, search, filterCat, sortBy]);

  const totalValor     = itens.reduce((a,i)=>a+(i.value_auec||0)*(i.quantity||1),0);
  const displayValor   = displayItems.reduce((a,i)=>a+(i.value_auec||0)*(i.quantity||1),0);
  const catList        = [...new Set(displayItems.map(i=>i.category))].sort();

  const SS = { padding:'5px 22px 5px 8px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none', appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 5px center' };

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--text-muted)',fontSize:14}}>
      <RefreshCw size={20} style={{marginRight:8,animation:'spin 1s linear infinite'}}/> Carregando inventário...
    </div>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">INVENTÁRIO DE ITENS</div>
          <div className="page-subtitle">
            {itens.length} item{itens.length!==1?'s':''} · {totalValor.toLocaleString('pt-BR')} aUEC total
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>{setShowForm(true);setEditItem(null);}} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'rgba(56,189,248,0.1)',border:'1px solid rgba(56,189,248,0.35)',borderRadius:7,color:'var(--accent-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,textTransform:'uppercase',cursor:'pointer',letterSpacing:'0.06em'}}>
            <Plus size={14}/> Novo Item
          </button>
        </div>
      </div>

      {/* Formulário */}
      {(showForm||editItem) && (
        <div style={{padding:'0 24px',overflow:'auto',maxHeight:'60vh',flexShrink:0}}>
          <ItemForm initial={editItem||undefined} taxonomy={taxonomy} onSave={handleSave} onCancelar={()=>{setShowForm(false);setEditItem(null);}}/>
        </div>
      )}

      <div style={{padding:'0 24px',flexShrink:0}}><UnknownVaultPanel items={unknownVaultItems} locationOptions={transferDestinations} onDirect={handleDirectUnknownItem}/></div>

      {/* ── Breadcrumb de navegação ── */}
      <div style={{padding:'8px 24px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',display:'flex',alignItems:'center',gap:6,flexShrink:0,flexWrap:'wrap'}}>
        <button onClick={()=>{setSelSystem(null);setSelLocation(null);setSearch('');}} style={{background:'none',border:'none',cursor:selSystem?'pointer':'default',color:selSystem?'var(--accent-primary)':'var(--text-primary)',fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:700,padding:0}}>
          🌌 Todos os Sistemas
        </button>
        {selSystem && (
          <>
            <span style={{color:'var(--text-muted)'}}>›</span>
            <button onClick={()=>{setSelLocation(null);setSearch('');}} style={{background:'none',border:'none',cursor:selLocation?'pointer':'default',color:selLocation?'var(--accent-primary)':'var(--text-primary)',fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:700,padding:0,display:'flex',alignItems:'center',gap:4}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:SYSTEM_COLORS[selSystem],display:'inline-block'}}/>
              {selSystem}
            </button>
          </>
        )}
        {selLocation && (
          <>
            <span style={{color:'var(--text-muted)'}}>›</span>
            <span style={{fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,color:'var(--text-primary)',display:'flex',alignItems:'center',gap:4}}>
              <MapPin size={10} style={{color:SYSTEM_COLORS[selSystem]}}/>{selLocation}
            </span>
          </>
        )}
        <span style={{marginLeft:'auto',fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-muted)'}}>
          {displayItems.length} item{displayItems.length!==1?'s':''}
          {displayValor>0&&<span style={{color:'var(--accent-gold)',marginLeft:8}}>{displayValor.toLocaleString('pt-BR')} aUEC</span>}
        </span>
      </div>

      {/* ── Conteúdo principal ── */}
      <div className="page-body">

        {/* NÍVEL 1 — Seleção de sistema */}
        {!selSystem && !search.trim() && (
          <div>
            <div style={{fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14}}>
              Selecione um Sistema Espacial
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12,marginBottom:24}}>
              {systemsWithItems.map(({name,count}) => {
                const color = SYSTEM_COLORS[name] || 'var(--accent-primary)';
                const inSys = itens.filter(i=>i.system===name);
                const val   = inSys.reduce((a,i)=>a+(i.value_auec||0)*(i.quantity||1),0);
                const locs  = [...new Set(inSys.map(i=>i.location_name))].length;
                return (
                  <button key={name} onClick={()=>count>0&&setSelSystem(name)} disabled={count===0} style={{
                    textAlign:'left',padding:'18px 16px',
                    background: count>0?`linear-gradient(135deg, ${color}12, ${color}06)`:'rgba(255,255,255,0.02)',
                    border:`1px solid ${count>0?color+'44':'var(--border-subtle)'}`,
                    borderRadius:10,cursor:count>0?'pointer':'not-allowed',
                    opacity:count===0?0.35:1,transition:'all 0.2s',
                  }}
                  onMouseEnter={e=>{if(count>0){e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow=`0 8px 25px ${color}22, 0 0 0 1px ${color}66`;}}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                    <div style={{width:12,height:12,borderRadius:'50%',background:color,boxShadow:`0 0 10px ${color}88`,marginBottom:10}}/>
                    <div style={{fontFamily:'Michroma,sans-serif',fontSize:14,fontWeight:800,color,marginBottom:6,letterSpacing:'0.04em'}}>{name}</div>
                    <div style={{fontFamily:'Share Tech Mono,monospace',fontSize:18,fontWeight:800,color:'var(--text-primary)',marginBottom:3}}>{count}</div>
                    <div style={{fontSize:10,color:'var(--text-muted)'}}>item{count!==1?'s':''} em {locs} local{locs!==1?'is':''}</div>
                    {val>0&&<div style={{fontSize:10,color:'var(--accent-gold)',marginTop:4,fontFamily:'Share Tech Mono,monospace'}}>{val.toLocaleString('pt-BR')} aUEC</div>}
                  </button>
                );
              })}
              {/* Botão "Ver Tudo" */}
              <button onClick={()=>{setSelSystem('__all');}} style={{
                textAlign:'left',padding:'18px 16px',
                background:'rgba(255,255,255,0.03)',
                border:'1px dashed var(--border-normal)',
                borderRadius:10,cursor:'pointer',transition:'all 0.2s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-primary)';e.currentTarget.style.background='rgba(56,189,248,0.05)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-normal)';e.currentTarget.style.background='rgba(255,255,255,0.03)';}}>
                <BarChart3 size={16} style={{color:'var(--text-muted)',marginBottom:10}}/>
                <div style={{fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:700,color:'var(--text-muted)',marginBottom:6}}>VER TUDO</div>
                <div style={{fontFamily:'Share Tech Mono,monospace',fontSize:18,fontWeight:800,color:'var(--text-primary)',marginBottom:3}}>{itens.length}</div>
                <div style={{fontSize:10,color:'var(--text-muted)'}}>todos os sistemas</div>
              </button>
            </div>
          </div>
        )}

        {/* NÍVEL 2 — Locais dentro do sistema */}
        {selSystem && selSystem!=='__all' && !selLocation && !search.trim() && (
          <div>
            <div style={{fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:SYSTEM_COLORS[selSystem]}}/>
              Locais em {selSystem}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10,marginBottom:20}}>
              {locationsInSystem.map(({name,count,categories,totalValue}) => {
                const sysColor = SYSTEM_COLORS[selSystem];
                const cats = [...categories].slice(0,3);
                return (
                  <button key={name} onClick={()=>setSelLocation(name)} style={{
                    textAlign:'left',padding:'14px 14px',
                    background:'var(--bg-card)',border:`1px solid var(--border-subtle)`,borderLeft:`3px solid ${sysColor}`,
                    borderRadius:8,cursor:'pointer',transition:'all 0.15s',
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=sysColor;e.currentTarget.style.background=`rgba(${sysColor==='#38bdf8'?'56,189,248':sysColor==='#fb923c'?'251,146,60':sysColor==='#a78bfa'?'167,139,250':sysColor==='#34d399'?'52,211,153':'251,191,36'},0.05)`;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.background='var(--bg-card)';}}>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5}}>
                      <MapPin size={10} style={{color:sysColor,flexShrink:0}}/>
                      <span style={{fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
                    </div>
                    <div style={{fontFamily:'Share Tech Mono,monospace',fontSize:16,fontWeight:800,color:sysColor,marginBottom:3}}>{count} <span style={{fontSize:11,color:'var(--text-muted)',fontFamily:'"Exo 2",sans-serif'}}>item{count!==1?'s':''}</span></div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:4}}>
                      {cats.map(c=>(
                        <span key={c} style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:`${CATEGORY_COLORS[c]||'#7a90b0'}18`,color:CATEGORY_COLORS[c]||'#7a90b0',border:`1px solid ${CATEGORY_COLORS[c]||'#7a90b0'}33`}}>{c}</span>
                      ))}
                      {categories.size>3&&<span style={{fontSize:8,color:'var(--text-muted)'}}>+{categories.size-3}</span>}
                    </div>
                    {totalValue>0&&<div style={{fontSize:10,color:'var(--accent-gold)',fontFamily:'Share Tech Mono,monospace'}}>{totalValue.toLocaleString('pt-BR')} aUEC</div>}
                  </button>
                );
              })}
              {/* Ver todos os itens do sistema */}
              <button onClick={()=>setSelLocation('__all_in_system')} style={{
                textAlign:'left',padding:'14px 14px',background:'rgba(255,255,255,0.02)',
                border:'1px dashed var(--border-normal)',borderRadius:8,cursor:'pointer',
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=SYSTEM_COLORS[selSystem];e.currentTarget.style.background='rgba(255,255,255,0.04)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-normal)';e.currentTarget.style.background='rgba(255,255,255,0.02)';}}>
                <Package size={14} style={{color:'var(--text-muted)',marginBottom:8}}/>
                <div style={{fontSize:12,fontWeight:700,color:'var(--text-muted)',fontFamily:'Michroma,sans-serif',marginBottom:4}}>TODOS</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>Ver todos os {itens.filter(i=>i.system===selSystem).length} itens de {selSystem}</div>
              </button>
            </div>
          </div>
        )}

        {/* NÍVEL 3 — Cards de itens */}
        {(selLocation || selSystem==='__all' || search.trim()) && (
          <div>
            {/* Controles */}
            <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
              <div style={{position:'relative',flex:1,minWidth:160}}>
                <Search size={11} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}}/>
                <input style={{width:'100%',padding:'6px 10px 6px 26px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,outline:'none',boxSizing:'border-box'}}
                  placeholder="Buscar item..." value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              <select style={SS} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
                <option value="all">Todas as categorias</option>
                {catList.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <select style={SS} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                <option value="name">Nome A-Z</option>
                <option value="category">Categoria</option>
                <option value="value">Maior valor</option>
                <option value="qty">Maior quantidade</option>
              </select>
              {/* Toggle grid/lista */}
              <div style={{display:'flex',gap:3}}>
                <button onClick={()=>setViewMode('grid')} style={{width:28,height:28,borderRadius:4,border:`1px solid ${viewMode==='grid'?'var(--accent-primary)':'var(--border-subtle)'}`,background:viewMode==='grid'?'rgba(56,189,248,0.1)':'transparent',color:viewMode==='grid'?'var(--accent-primary)':'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Box size={12}/>
                </button>
                <button onClick={()=>setViewMode('list')} style={{width:28,height:28,borderRadius:4,border:`1px solid ${viewMode==='list'?'var(--accent-primary)':'var(--border-subtle)'}`,background:viewMode==='list'?'rgba(56,189,248,0.1)':'transparent',color:viewMode==='list'?'var(--accent-primary)':'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Filter size={12}/>
                </button>
              </div>
            </div>

            {displayItems.length === 0 ? (
              <div style={{textAlign:'center',padding:'50px 0',color:'var(--text-muted)'}}>
                <Package size={44} style={{display:'block',margin:'0 auto 12px',opacity:0.15}}/>
                <div style={{fontFamily:'Michroma,sans-serif',fontSize:13,fontWeight:700,marginBottom:8}}>NENHUM ITEM</div>
                <div style={{fontSize:12}}>{search.trim()?'Nenhum item encontrado para a busca.':'Nenhum item registrado aqui ainda.'}</div>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="inventory-items-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
                {displayItems.map(item=>(
                  <ItemCard key={item.id} item={item}
                    onEdit={handleEditItem}
                    onDelete={handleDelete}
                    onScriptUpdate={handleScriptUpdate}
                    allItems={itens}
                    transferDestinations={transferDestinations}
                    onTransfer={handleTransfer}/>
                ))}
              </div>
            ) : (
              /* Vista lista compacta */
              <div className="inventory-items-list" style={{display:'flex',flexDirection:'column',gap:4}}>
                {displayItems.map(item=>{
                  const catColor = CATEGORY_COLORS[item.category]||'var(--text-muted)';
                  const isScript = isScriptItem(item.name);
                  return (
                    <ItemCard key={item.id} item={item}
                      onEdit={i=>{setEditItem(i);setShowForm(false);}}
                      onDelete={handleDelete}
                      onScriptUpdate={handleScriptUpdate}
                      allItems={itens}
                      transferDestinations={transferDestinations}
                      onTransfer={handleTransfer}/>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Busca global — mesmo sem sistema selecionado */}
        {!selSystem && search.trim() && (
          <div>
            <div style={{fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14}}>
              Resultados para "{search}"
            </div>
            <div className="inventory-items-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
              {displayItems.map(item=>(
                <ItemCard key={item.id} item={item}
                  onEdit={i=>{setEditItem(i);setShowForm(false);}}
                  onDelete={handleDelete}
                  onScriptUpdate={handleScriptUpdate}
                  allItems={itens}
                  transferDestinations={transferDestinations}
                  onTransfer={handleTransfer}/>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}