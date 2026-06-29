import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Cpu, CheckCircle2, Star, Search, Plus, Trash2,
  Edit3, X, Save, FlaskConical, MapPin, Users,
  AlertTriangle, RefreshCw, Hammer, ShoppingCart,
  ChevronDown, ChevronUp, Package, Check
} from 'lucide-react';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { setProvenance, SOURCES } from '../data/provenance';
import {
  loadQueue, queueBlueprint, dequeueBlueprint,
  updateQueuedQty, isBlueprintQueued,
} from '../data/materialQueue';

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = ['FPS Weapon','Ship Weapon','FPS Armor','Ship Component','Ammo','Consumable','Flight Suit','Utilitário','Outro'];
const FACTIONS   = ['Starter','Foxwell Enforcement','Headhunters','Covalex','Ling Family','Shubin Interstellar','InterSec','Rayari','Mile Eckhart','Pyro Factions','Pyro Gangs','General Mission Drop','Outro'];
const UNITS      = ['un','kg','SCU'];

const CAT_COLORS = {
  'FPS Weapon':'#ff4466','Ship Weapon':'#ff7744','FPS Armor':'#00d4ff',
  'Ship Component':'#0077ff','Ammo':'#ffc436','Consumable':'#00e5a0',
  'Flight Suit':'#b44cff','Utilitário':'#7a90b0','Outro':'#3d5070',
};
const FACTION_COLORS = {
  'Starter':'#00e5a0','Foxwell Enforcement':'#ff8c00','Headhunters':'#ff4466',
  'Covalex':'#0077ff','Ling Family':'#b44cff','Shubin Interstellar':'#ffc436',
  'InterSec':'#00d4ff','Rayari':'#e91e63','Mile Eckhart':'#9b59b6',
  'Pyro Factions':'#e74c3c','Pyro Gangs':'#c0392b','General Mission Drop':'#7a90b0','Outro':'#3d5070',
};
const MATERIAL_COLORS = {
  'Titanium':'#74b9ff','Copper':'#fdcb6e','Orotite':'#a29bfe',
  'Caranite':'#fd79a8','Steel':'#b2bec3','Polymer':'#00cec9',
  'Industrial Polymer':'#55efc4','Medical Grade Polymer':'#00e5a0',
  'Inert Material':'#7a90b0','Reactive Material':'#ff4466','Tungsten':'#dfe6e9',
};

// ── Mock API ──────────────────────────────────────────────────────────────────
function buildMockBpAPI() {
  const KEY = 'sc_blueprints_v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY))||{state:{},custom:[],nextId:1}; } catch { return {state:{},custom:[],nextId:1}; } };
  const save = d => localStorage.setItem(KEY, JSON.stringify(d));
  return {
    getAll: async () => {
      const s = load();
      return s.custom.map(bp => ({
        ...bp,
        owned:         s.state[`b${bp.id}o`]||0,
        wishlist:      s.state[`b${bp.id}w`]||0,
        crafted_count: s.state[`b${bp.id}c`]||0,
        user_notes:    s.state[`b${bp.id}n`]||'',
        obtained_date: s.state[`b${bp.id}d`]||null,
      }));
    },
    toggleOwned: async (id) => {
      const s=load(); const n=(s.state[`b${id}o`]||0)?0:1;
      s.state[`b${id}o`]=n; s.state[`b${id}d`]=n?new Date().toISOString():null; save(s); return {owned:n};
    },
    toggleWishlist: async (id) => {
      const s=load(); s.state[`b${id}w`]=(s.state[`b${id}w`]||0)?0:1; save(s); return {wishlist:s.state[`b${id}w`]};
    },
    incrementCraftado: async (id) => {
      const s=load(); s.state[`b${id}c`]=(s.state[`b${id}c`]||0)+1; save(s); return {success:true};
    },
    updateNotas: async (id,notes) => { const s=load(); s.state[`b${id}n`]=notes; save(s); return {success:true}; },
    createCustom: async ({bp,ingredients}) => {
      const s=load(); const id=s.nextId++;
      s.custom.push({...bp,id,ingredients:(ingredients||[]),is_default:0,patch_added:bp.patch_added||'4.7'});
      save(s); return {success:true,bpId:id};
    },
    updateCustom: async ({bpId,bp,ingredients}) => {
      const s=load();
      s.custom=s.custom.map(b=>b.id===bpId?{...b,...bp,ingredients:(ingredients||b.ingredients),id:bpId}:b);
      save(s); return {success:true};
    },
    deleteCustom: async (id) => {
      const s=load(); s.custom=s.custom.filter(b=>b.id!==id); save(s); return {success:true};
    },
    getStats: async () => {
      const s=load(); const bps=s.custom;
      return { total:bps.length, owned:bps.filter(b=>s.state[`b${b.id}o`]).length,
        wishlist:bps.filter(b=>s.state[`b${b.id}w`]).length,
        totalCraftado:bps.reduce((a,b)=>a+(s.state[`b${b.id}c`]||0),0), byCat:[] };
    },
  };
}

function getBpAPI() {
  if (window.electronAPI) {
    return {
      getAll:           () => window.electronAPI.bpGetAll(),
      toggleOwned:      (id) => window.electronAPI.bpToggleObtida(id),
      toggleWishlist:   (id) => window.electronAPI.bpToggleWishlist(id),
      incrementCraftado: (id) => window.electronAPI.bpIncrementCraftado(id),
      updateNotas:      (id,n) => window.electronAPI.bpUpdateNotas(id,n),
      createCustom:     (d) => window.electronAPI.bpCreateCustom(d),
      updateCustom:     (d) => window.electronAPI.bpUpdateCustom(d),
      deleteCustom:     (id) => window.electronAPI.bpDeleteCustom(id),
      getStats:         () => window.electronAPI.bpGetStats(),
    };
  }
  return buildMockBpAPI();
}

// ── Ingredient pill ───────────────────────────────────────────────────────────
function IngPill({ ing }) {
  const color = MATERIAL_COLORS[ing.material_name] || '#7a90b0';
  return (
    <div style={{ display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,
      background:`${color}18`,border:`1px solid ${color}44`,fontSize:12,fontWeight:600,
      color:'var(--text-primary)',flexShrink:0 }}>
      <div style={{ width:8,height:8,borderRadius:'50%',background:color,flexShrink:0 }}/>
      <span style={{ color }}>{ing.material_name}</span>
      <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-secondary)' }}>×{ing.quantity}</span>
      {ing.quality_min>0 && <span style={{ fontSize:10,color:'var(--text-muted)',borderLeft:'1px solid var(--border-subtle)',paddingLeft:5 }}>Q≥{ing.quality_min}</span>}
    </div>
  );
}

// ── Blueprint Form (create + edit) ────────────────────────────────────────────
const emptyBp = () => ({ name:'',category:'FPS Weapon',subcategory:'',manufacturer:'',item_size:'Personal',grade:'',item_class:'',description:'',how_to_get:'',faction:'',mission_type:'',patch_added:'4.7' });
const emptyIng = () => ({ material_name:'',quantity:1,quality_min:0,unit:'un',notes:'' });

function BpForm({ initial, onSave, onCancelar }) {
  const [bp,   setBp]   = useState(() => initial ? {
    name: initial.name, category: initial.category||'FPS Weapon',
    subcategory: initial.subcategory||'', manufacturer: initial.manufacturer||'',
    item_size: initial.item_size||'Personal', grade: initial.grade||'',
    item_class: initial.item_class||'', description: initial.description||'',
    how_to_get: initial.how_to_get||'', faction: initial.faction||'',
    mission_type: initial.mission_type||'', patch_added: initial.patch_added||'4.7',
  } : emptyBp());
  const [ings, setIngs] = useState(() => initial?.ingredients?.length
    ? initial.ingredients.map(i=>({...i})) : [emptyIng()]);
  const [error,setError]= useState('');
  const setF = (k,v) => setBp(p=>({...p,[k]:v}));

  const IS = { width:'100%',padding:'7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none' };
  const SS = { ...IS,padding:'7px 24px 7px 10px',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 6px center' };
  const LS = { fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 };

  function updateIng(i,k,v) { const a=[...ings]; a[i]={...a[i],[k]:v}; setIngs(a); }
  function removeIng(i) { setIngs(ings.filter((_,j)=>j!==i)); }
  function addIng()     { setIngs([...ings,emptyIng()]); }

  function handleSave() {
    if (!bp.name.trim()) { setError('Nome do blueprint é obrigatório.'); return; }
    const validIngs = ings.filter(i=>i.material_name.trim());
    onSave({ bp, ingredients: validIngs });
  }

  return (
    <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:10,padding:'20px',marginBottom:20 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
        <h3 style={{ fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.06em' }}>
          {initial ? 'EDITAR BLUEPRINT' : 'NOVO BLUEPRINT'}
        </h3>
        <button onClick={onCancelar} style={{ background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'4px 8px',display:'flex',alignItems:'center' }}><X size={13}/></button>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,marginBottom:10 }}>
        <div><label style={LS}>Nome *</label><input style={IS} value={bp.name} onChange={e=>setF('name',e.target.value)} placeholder="ex: P6LR, FR-66 Shield..."/></div>
        <div><label style={LS}>Categoria</label>
          <select style={SS} value={bp.category} onChange={e=>setF('category',e.target.value)}>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label style={LS}>Subcategoria</label><input style={IS} value={bp.subcategory} onChange={e=>setF('subcategory',e.target.value)} placeholder="ex: Assault Rifle..."/></div>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:10,marginBottom:10 }}>
        <div><label style={LS}>Fabricante</label><input style={IS} value={bp.manufacturer} onChange={e=>setF('manufacturer',e.target.value)} placeholder="Behring..."/></div>
        <div><label style={LS}>Tamanho</label><input style={IS} value={bp.item_size} onChange={e=>setF('item_size',e.target.value)} placeholder="Personal / 1 / 2..."/></div>
        <div><label style={LS}>Grade</label><input style={IS} value={bp.grade} onChange={e=>setF('grade',e.target.value)} placeholder="A / B / C..."/></div>
        <div><label style={LS}>Classe</label><input style={IS} value={bp.item_class} onChange={e=>setF('item_class',e.target.value)} placeholder="Military / Civilian..."/></div>
        <div><label style={LS}>Patch</label><input style={IS} value={bp.patch_added} onChange={e=>setF('patch_added',e.target.value)} placeholder="4.7"/></div>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10 }}>
        <div><label style={LS}>Facção / Fonte</label>
          <select style={SS} value={bp.faction} onChange={e=>setF('faction',e.target.value)}>
            {FACTIONS.map(f=><option key={f}>{f}</option>)}
          </select>
        </div>
        <div><label style={LS}>Tipo de Missão</label><input style={IS} value={bp.mission_type} onChange={e=>setF('mission_type',e.target.value)} placeholder="ex: Foxwell Contracts..."/></div>
      </div>

      <div style={{ marginBottom:10 }}><label style={LS}>Como obter</label>
        <textarea className="notes-textarea" value={bp.how_to_get} onChange={e=>setF('how_to_get',e.target.value)} placeholder="Onde e como farmar..." style={{ minHeight:50,fontSize:12,marginTop:0 }}/>
      </div>
      <div style={{ marginBottom:16 }}><label style={LS}>Descrição</label>
        <textarea className="notes-textarea" value={bp.description} onChange={e=>setF('description',e.target.value)} placeholder="Descrição do item..." style={{ minHeight:40,fontSize:12,marginTop:0 }}/>
      </div>

      {/* Materiais */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
          <div className="modal-section-title" style={{ marginBottom:0 }}><FlaskConical size={11}/> Materiais ({ings.length})</div>
          <button onClick={addIng} style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 10px',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-normal)',borderRadius:5,color:'var(--accent-primary)',cursor:'pointer',fontSize:12,fontWeight:700 }}>
            <Plus size={12}/> Material
          </button>
        </div>
        {ings.map((ing,i)=>(
          <div key={i} style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:8,alignItems:'end',marginBottom:6 }}>
            <div>
              {i===0&&<label style={LS}>Material</label>}
              <input style={IS} value={ing.material_name} onChange={e=>updateIng(i,'material_name',e.target.value)} placeholder="ex: Titanium, Orotite..."/>
            </div>
            <div>
              {i===0&&<label style={LS}>Quantidade</label>}
              <input style={IS} type="number" min="1" value={ing.quantity} onChange={e=>updateIng(i,'quantity',Number(e.target.value))}/>
            </div>
            <div>
              {i===0&&<label style={LS}>Qualidade Min.</label>}
              <input style={IS} type="number" min="0" max="1000" value={ing.quality_min} onChange={e=>updateIng(i,'quality_min',Number(e.target.value))} placeholder="0=qualquer"/>
            </div>
            <div>
              {i===0&&<label style={LS}>Unidade</label>}
              <select style={SS} value={ing.unit} onChange={e=>updateIng(i,'unit',e.target.value)}>
                {UNITS.map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <button onClick={()=>removeIng(i)} disabled={ings.length===1} style={{ width:30,height:30,borderRadius:5,border:'1px solid rgba(255,68,102,0.2)',background:'rgba(255,68,102,0.08)',color:ings.length>1?'var(--accent-red)':'var(--text-muted)',cursor:ings.length>1?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',marginTop:i===0?16:0 }}>
              <Trash2 size={12}/>
            </button>
          </div>
        ))}
      </div>

      {error&&<div style={{ color:'var(--accent-red)',fontSize:12,marginBottom:10,display:'flex',alignItems:'center',gap:6 }}><AlertTriangle size={13}/>{error}</div>}

      <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
        <button onClick={onCancelar} style={{ padding:'9px 18px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.06em' }}>Cancelar</button>
        <button onClick={handleSave} style={{ display:'flex',alignItems:'center',gap:7,padding:'9px 22px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.35)',borderRadius:6,color:'var(--accent-green)',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.06em' }}>
          <Save size={13}/>{initial?'Salvar Alterações':'Adicionar Blueprint'}
        </button>
      </div>
    </div>
  );
}

// ── Blueprint Card ────────────────────────────────────────────────────────────
function BpCard({ bp, onToggleOwned, onToggleWishlist, onIncrementCrafted, onSelect, isSelected, onEdit, onDelete, onQueue, isQueued }) {
  const catColor = CAT_COLORS[bp.category]||'#7a90b0';
  const facColor = FACTION_COLORS[bp.faction]||'#7a90b0';
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [noteEdit, setNoteEdit] = useState(false);
  const [noteText, setNoteText] = useState(bp.user_notes||'');
  const [noteGuardado, setNoteGuardado] = useState(false);

  return (
    <div style={{
      background: bp.owned?'rgba(0,229,160,0.04)':'var(--bg-card)',
      border:`1px solid ${bp.owned?'rgba(0,229,160,0.3)':isSelected?'var(--border-bright)':'var(--border-subtle)'}`,
      borderRadius:8,overflow:'hidden',transition:'all 0.2s',
    }}>
      {/* Main row */}
      <div style={{ display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer' }} onClick={onSelect}
        onMouseEnter={e=>e.currentTarget.parentElement.style.borderColor=bp.owned?'rgba(0,229,160,0.5)':'var(--border-normal)'}
        onMouseLeave={e=>e.currentTarget.parentElement.style.borderColor=bp.owned?'rgba(0,229,160,0.3)':isSelected?'var(--border-bright)':'var(--border-subtle)'}>
        {/* Status icon */}
        <div style={{ width:34,height:34,borderRadius:7,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:bp.owned?'rgba(0,229,160,0.12)':`${catColor}18`,border:`1px solid ${bp.owned?'rgba(0,229,160,0.4)':`${catColor}44`}`,color:bp.owned?'var(--accent-green)':catColor }}>
          {bp.owned?<CheckCircle2 size={17}/>:<Cpu size={17}/>}
        </div>
        {/* Info */}
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:3 }}>
            <span style={{ fontFamily:'Rajdhani,sans-serif',fontSize:14,fontWeight:700,color:'var(--text-primary)' }}>{bp.name}</span>
            <ProvenanceBadge category="blueprint" name={bp.name}/>
            {bp.is_default?<span style={{ fontSize:9,color:'var(--accent-green)',fontWeight:700,background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.25)',padding:'1px 6px',borderRadius:3 }}>PADRÃO</span>:null}
            {bp.grade&&<span style={{ fontSize:10,color:'var(--text-muted)',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3 }}>Grade {bp.grade}</span>}
            {bp.item_size&&bp.item_size!=='Personal'&&<span style={{ fontSize:10,color:'var(--text-muted)',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3 }}>S{bp.item_size}</span>}
            {isQueued&&<span style={{ fontSize:9,color:'var(--accent-gold)',fontWeight:700,background:'rgba(255,196,54,0.1)',border:'1px solid rgba(255,196,54,0.3)',padding:'1px 6px',borderRadius:3 }}>🛒 NA FILA</span>}
          </div>
          <div style={{ display:'flex',gap:10,alignItems:'center',flexWrap:'wrap' }}>
            <span style={{ fontSize:11,color:catColor,fontWeight:600 }}>{bp.category}</span>
            {bp.manufacturer&&<span style={{ fontSize:11,color:'var(--text-muted)' }}>{bp.manufacturer}</span>}
            {bp.faction&&<span style={{ display:'flex',alignItems:'center',gap:3,fontSize:11,color:facColor }}><Users size={10}/>{bp.faction}</span>}
            {bp.patch_added&&<span style={{ fontSize:10,color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace' }}>{bp.patch_added}</span>}
          </div>
        </div>
        {/* Actions */}
        <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5,flexShrink:0 }}>
          {bp.crafted_count>0&&<span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--accent-primary)',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-subtle)',padding:'1px 7px',borderRadius:10 }}>🔨×{bp.crafted_count}</span>}
          <div style={{ display:'flex',gap:4 }} onClick={e=>e.stopPropagation()}>
            {/* Queue btn */}
            <button onClick={()=>onQueue(bp)} title={isQueued?'Remover da fila de craft':'Adicionar à fila de craft'} style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:5,border:`1px solid ${isQueued?'rgba(255,196,54,0.4)':'rgba(255,196,54,0.2)'}`,background:isQueued?'rgba(255,196,54,0.15)':'rgba(255,196,54,0.06)',color:'var(--accent-gold)',cursor:'pointer',fontSize:11,fontWeight:700 }}>
              <ShoppingCart size={11}/>{isQueued?'Na Fila':'Quero Craftar'}
            </button>
            <button onClick={()=>onToggleOwned(bp.id)} title={bp.owned?'Remover da coleção':'Marcar como obtida'} style={{ width:28,height:28,borderRadius:5,border:`1px solid ${bp.owned?'rgba(0,229,160,0.4)':'var(--border-subtle)'}`,background:bp.owned?'rgba(0,229,160,0.15)':'transparent',color:bp.owned?'var(--accent-green)':'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13 }}>✓</button>
            <button onClick={()=>onToggleWishlist(bp.id)} title="wishlist" style={{ width:28,height:28,borderRadius:5,border:`1px solid ${bp.wishlist?'rgba(255,196,54,0.4)':'var(--border-subtle)'}`,background:bp.wishlist?'rgba(255,196,54,0.12)':'transparent',color:bp.wishlist?'var(--accent-gold)':'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13 }}>★</button>
            {bp.owned&&<button onClick={()=>onIncrementCrafted(bp.id)} title="Registrar craft" style={{ width:28,height:28,borderRadius:5,border:'1px solid rgba(0,212,255,0.25)',background:'rgba(0,212,255,0.08)',color:'var(--accent-primary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><Hammer size={12}/></button>}
            {!bp.is_default&&<button onClick={()=>onEdit(bp)} style={{ width:28,height:28,borderRadius:5,border:'1px solid var(--border-normal)',background:'rgba(0,212,255,0.06)',color:'var(--accent-primary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><Edit3 size={12}/></button>}
            {!bp.is_default&&(deleteConfirm?(
              <div style={{ display:'flex',gap:4,alignItems:'center' }}>
                <button onClick={()=>onDelete(bp.id)} style={{ padding:'4px 8px',background:'rgba(255,68,102,0.15)',border:'1px solid rgba(255,68,102,0.4)',borderRadius:4,color:'var(--accent-red)',cursor:'pointer',fontSize:11,fontWeight:700 }}>Sim</button>
                <button onClick={()=>setDeleteConfirm(false)} style={{ padding:'4px 8px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-secondary)',cursor:'pointer',fontSize:11 }}>Não</button>
              </div>
            ):(
              <button onClick={()=>setDeleteConfirm(true)} style={{ width:28,height:28,borderRadius:5,border:'1px solid rgba(255,68,102,0.2)',background:'rgba(255,68,102,0.08)',color:'var(--accent-red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><Trash2 size={12}/></button>
            ))}
          </div>
        </div>
      </div>

      {/* Expandired */}
      {isSelected&&(
        <div style={{ padding:'12px 14px 14px',borderTop:'1px solid var(--border-subtle)',background:'rgba(0,0,0,0.12)' }}>
          {bp.description&&<p style={{ fontSize:12,color:'var(--text-secondary)',lineHeight:1.6,marginBottom:10 }}>{bp.description}</p>}
          {bp.how_to_get&&(
            <div style={{ background:'rgba(0,119,255,0.06)',border:'1px solid rgba(0,119,255,0.15)',borderRadius:6,padding:'10px 12px',marginBottom:10 }}>
              <div style={{ display:'flex',alignItems:'center',gap:5,marginBottom:5 }}>
                <MapPin size={11} style={{ color:'var(--accent-primary)' }}/>
                <span style={{ fontSize:10,fontWeight:700,color:'var(--accent-primary)',textTransform:'uppercase',letterSpacing:'0.1em' }}>Como obter</span>
              </div>
              <p style={{ fontSize:12,color:'var(--text-secondary)',lineHeight:1.6,margin:0 }}>{bp.how_to_get}</p>
              {bp.mission_type&&<div style={{ marginTop:5,fontSize:11,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:4 }}><Users size={10}/>{bp.mission_type}</div>}
            </div>
          )}
          {bp.ingredients?.length>0&&(
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:7,display:'flex',alignItems:'center',gap:5 }}>
                <FlaskConical size={11}/> Materiais necessários
              </div>
              <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                {bp.ingredients.map((ing,i)=><IngPill key={i} ing={ing}/>)}
              </div>
              <div style={{ marginTop:6,fontSize:11,color:'var(--text-muted)' }}>* Qualidade mínima (Q≥) impacta os stats finais.</div>
            </div>
          )}
          {/* Note */}
          {noteEdit?(
            <div style={{ display:'flex',gap:7,marginTop:8 }}>
              <input className="search-input" style={{ flex:1 }} value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Notas sobre este blueprint..."/>
              <button onClick={async()=>{ await getBpAPI().updateNotas(bp.id,noteText); setNoteGuardado(true); setTimeout(()=>{setNoteGuardado(false);setNoteEdit(false);},1500); }} className="save-btn" style={{ fontSize:11,padding:'5px 10px' }}>{noteGuardado?'✓ Salvo!':'Salvar'}</button>
            </div>
          ):(
            <button onClick={()=>setNoteEdit(true)} style={{ marginTop:8,background:'rgba(255,255,255,0.03)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'5px 10px',fontSize:11 }}>
              📝 {bp.user_notes?`"${bp.user_notes.slice(0,40)}..."` : 'Adicionar nota'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BlueprintPage() {
  const [bps,         setBps]         = useState([]);
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editingBp,   setEditingBp]   = useState(null);
  const [search,      setSearch]      = useState('');
  const [filterCat,   setFilterCat]   = useState('all');
  const [filterFac,   setFilterFac]   = useState('all');
  const [filterObtida, setFilterObtida] = useState('all');
  const [sortBy,      setOrdenarBy]      = useState('name');
  const [selectedBp,  setSelectedBp]  = useState(null);
  const [queue,       setQueue]       = useState(loadQueue());

  const api = useMemo(()=>getBpAPI(),[]);

  const loadData = useCallback(async()=>{
    setLoading(true);
    try {
      const [all,st]=await Promise.all([api.getAll(),api.getStats()]);
      setBps(all); setStats(st);
    } catch(e){console.error(e);}
    finally { setLoading(false); }
  },[api]);

  useEffect(()=>{ loadData(); },[loadData]);

  const refreshQueue = () => setQueue(loadQueue());

  async function handleToggleOwned(id)      { await api.toggleOwned(id);     await loadData(); }
  async function handleToggleWishlist(id)   { await api.toggleWishlist(id);   await loadData(); }
  async function handleIncrementCraftado(id) { await api.incrementCraftado(id); await loadData(); }

  async function handleCreate(data) {
    await api.createCustom(data);
    setProvenance('blueprint', data.bp.name, SOURCES.MANUAL);
    setShowForm(false);
    await loadData();
  }

  async function handleEdit(data) {
    await api.updateCustom({ bpId: editingBp.id, ...data });
    setProvenance('blueprint', data.bp.name, SOURCES.MANUAL);
    setEditingBp(null);
    await loadData();
  }

  async function handleDelete(id) {
    await api.deleteCustom(id);
    dequeueBlueprint(id); refreshQueue();
    await loadData();
  }

  function handleQueue(bp) {
    if (isBlueprintQueued(bp.id)) {
      dequeueBlueprint(bp.id);
    } else {
      queueBlueprint(bp, 1);
    }
    refreshQueue();
  }

  const filtered = useMemo(()=>{
    let res=[...bps];
    if(search){const q=search.toLowerCase();res=res.filter(b=>b.name?.toLowerCase().includes(q)||b.category?.toLowerCase().includes(q)||b.manufacturer?.toLowerCase().includes(q)||b.faction?.toLowerCase().includes(q)||b.ingredients?.some(i=>i.material_name?.toLowerCase().includes(q)));}
    if(filterCat!=='all') res=res.filter(b=>b.category===filterCat);
    if(filterFac!=='all') res=res.filter(b=>b.faction===filterFac);
    if(filterObtida==='owned')    res=res.filter(b=>b.owned);
    if(filterObtida==='missing')  res=res.filter(b=>!b.owned);
    if(filterObtida==='wishlist') res=res.filter(b=>b.wishlist&&!b.owned);
    if(filterObtida==='queued')   res=res.filter(b=>isBlueprintQueued(b.id));
    if(filterObtida==='default')  res=res.filter(b=>b.is_default);
    res.sort((a,b)=>sortBy==='faction'?(a.faction||'').localeCompare(b.faction||''):sortBy==='cat'?(a.category||'').localeCompare(b.category||''):sortBy==='crafted'?(b.crafted_count||0)-(a.crafted_count||0):(a.name||'').localeCompare(b.name||''));
    return res;
  },[bps,search,filterCat,filterFac,filterObtida,sortBy,queue]);

  const catList = useMemo(()=>[...new Set(bps.map(b=>b.category))].sort(),[bps]);
  const facList = useMemo(()=>[...new Set(bps.map(b=>b.faction).filter(Boolean))].sort(),[bps]);
  const queuedCount = queue.queuedBlueprints.length;
  const ownedCount  = bps.filter(b=>b.owned).length;
  const pct = bps.length>0?Math.round((ownedCount/bps.length)*100):0;

  const SS = { padding:'7px 24px 7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 6px center' };

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">BLUEPRINTS DE CRAFTING</div>
          <div className="page-subtitle">{ownedCount}/{bps.length} blueprints · {bps.reduce((a,b)=>a+(b.crafted_count||0),0)} itens craftados · {pct}% completo</div>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button onClick={loadData} style={{ padding:'8px 12px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:12 }}><RefreshCw size={12}/></button>
          {!showForm&&!editingBp&&(
            <button onClick={()=>setShowForm(true)} style={{ display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'rgba(0,212,255,0.1)',border:'1px solid var(--border-normal)',borderRadius:8,color:'var(--accent-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer' }}>
              <Plus size={14}/> Novo Blueprint
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {!showForm&&!editingBp&&(
        <div style={{ padding:'10px 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',flexShrink:0 }}>
          <div style={{ display:'flex',gap:10,overflowX:'auto',paddingBottom:2,marginBottom:8 }}>
            {[
              {l:'Obtidos',v:ownedCount,c:'var(--accent-primary)'},
              {l:'Faltando',v:bps.length-ownedCount,c:'var(--text-secondary)'},
              {l:'Desejos',v:bps.filter(b=>b.wishlist&&!b.owned).length,c:'var(--accent-gold)'},
              {l:'Total Craftado',v:bps.reduce((a,b)=>a+(b.crafted_count||0),0),c:'var(--accent-green)'},
              {l:'🛒 Na Fila',v:queuedCount,c:queuedCount>0?'var(--accent-gold)':'var(--text-muted)'},
            ].map(({l,v,c})=>(
              <div key={l} style={{ background:'var(--bg-card)',border:`1px solid ${l.includes('Fila')&&v>0?'rgba(255,196,54,0.25)':'var(--border-subtle)'}`,borderRadius:8,padding:'8px 14px',minWidth:100,flexShrink:0,textAlign:'center' }}>
                <div style={{ fontFamily:'Orbitron,monospace',fontSize:16,fontWeight:800,color:c }}>{v}</div>
                <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginTop:2 }}>{l}</div>
              </div>
            ))}
            {(stats?.byCat||[]).slice(0,4).map(({category,total,owned:o})=>(
              <div key={category} style={{ background:'var(--bg-card)',border:`1px solid ${CAT_COLORS[category]||'var(--border-subtle)'}33`,borderRadius:8,padding:'8px 14px',minWidth:120,flexShrink:0 }}>
                <div style={{ fontFamily:'Orbitron,monospace',fontSize:16,fontWeight:800,color:CAT_COLORS[category]||'var(--text-primary)' }}>{o||0}/{total}</div>
                <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:2 }}>{category}</div>
              </div>
            ))}
          </div>
          <div style={{ height:4,background:'var(--border-subtle)',borderRadius:2,overflow:'hidden' }}>
            <div style={{ height:'100%',width:`${pct}%`,background:'linear-gradient(to right,var(--accent-secondary),var(--accent-primary))',borderRadius:2,transition:'width 0.8s',boxShadow:'0 0 8px rgba(0,212,255,0.3)' }}/>
          </div>
        </div>
      )}

      {/* Form */}
      {(showForm||editingBp)&&(
        <div style={{ flexShrink:0,overflowY:'auto',maxHeight:'82vh',padding:'14px 32px' }}>
          <BpForm
            initial={editingBp||null}
            onSave={editingBp?handleEdit:handleCreate}
            onCancelar={()=>{ setShowForm(false); setEditingBp(null); }}
          />
        </div>
      )}

      {/* Filters */}
      {!showForm&&!editingBp&&(
        <div style={{ padding:'10px 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',flexShrink:0 }}>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:8 }}>
            <div style={{ position:'relative',flex:'1 1 180px',minWidth:150 }}>
              <Search size={12} style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }}/>
              <input className="search-input" style={{ paddingLeft:28,width:'100%' }} placeholder="Buscar blueprint, material, facção..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select style={SS} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
              <option value="all">Todas Categorias</option>
              {catList.map(c=><option key={c}>{c}</option>)}
            </select>
            <select style={SS} value={filterFac} onChange={e=>setFilterFac(e.target.value)}>
              <option value="all">Todas as Facções</option>
              {facList.map(f=><option key={f}>{f}</option>)}
            </select>
            <select style={SS} value={sortBy} onChange={e=>setOrdenarBy(e.target.value)}>
              <option value="name">Nome (A-Z)</option>
              <option value="faction">Facção</option>
              <option value="cat">Categoria</option>
              <option value="crafted">Mais Craftado</option>
            </select>
          </div>
          <div style={{ display:'flex',gap:6,flexWrap:'wrap',alignItems:'center' }}>
            {[{val:'all',label:'Todos'},{val:'owned',label:'✓ Tenho'},{val:'missing',label:'○ Faltando'},{val:'wishlist',label:'★ Desejos'},{val:'queued',label:'🛒 Na Fila'},{val:'default',label:'📦 Padrão'}].map(o=>(
              <button key={o.val} className={`filter-chip ${filterObtida===o.val?'active':''}`} onClick={()=>setFilterObtida(o.val)}>{o.label}</button>
            ))}
            <span style={{ marginLeft:'auto',fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-muted)' }}>{filtered.length}/{bps.length}</span>
          </div>
        </div>
      )}

      {/* List */}
      {!showForm&&!editingBp&&(
        <div className="page-body">
          {filtered.length===0?(
            <div className="empty-state">
              <Cpu size={56} className="empty-state-icon"/>
              <div className="empty-state-title">NENHUM BLUEPRINT ENCONTRADO</div>
              <div className="empty-state-text">{bps.length===0?'Nenhum blueprint no banco.':'Tente ajustar os filtros.'}</div>
            </div>
          ):(
            <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
              {filtered.map(bp=>(
                <BpCard key={bp.id} bp={bp}
                  onToggleOwned={handleToggleOwned}
                  onToggleWishlist={handleToggleWishlist}
                  onIncrementCrafted={handleIncrementCraftado}
                  onSelect={()=>setSelectedBp(selectedBp===bp.id?null:bp.id)}
                  isSelected={selectedBp===bp.id}
                  onEdit={b=>{setEditingBp(b);setShowForm(false);}}
                  onDelete={handleDelete}
                  onQueue={handleQueue}
                  isQueued={isBlueprintQueued(bp.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
