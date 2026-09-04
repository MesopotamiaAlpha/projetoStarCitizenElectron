import React, { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import {
  Cpu, CheckCircle2, Star, Search, Plus, Trash2,
  Edit3, X, Save, FlaskConical, MapPin, Users,
  AlertTriangle, RefreshCw, Hammer, ShoppingCart,
  ChevronDown, ChevronUp, Package, Check, Upload
} from 'lucide-react';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { setProvenance, SOURCES } from '../data/provenance';
import {
  loadQueue, queueBlueprint, dequeueBlueprint,
  updateQueuedQty, syncQueuedBlueprint,
} from '../data/materialQueue';
import { CARGO_UNITS, isCargoUnit, normalizeCargoUnit, toCargoBase, fromCargoBase, formatCargoNumber } from '../data/cargoUnits';

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = ['FPS Weapon','Ship Weapon','FPS Armor','Ship Component','Ammo','Consumable','Flight Suit','Utilitário','Outro'];
const FACTIONS   = ['Starter','Foxwell Enforcement','Headhunters','Covalex','Ling Family','Shubin Interstellar','InterSec','Rayari','Mile Eckhart','Pyro Factions','Pyro Gangs','General Mission Drop','Outro'];
const UNITS      = ['un','kg', ...CARGO_UNITS];

// ── Importação SCMDB ───────────────────────────────────────────────────────────
// O backup SCMDB pode conter apenas o estado da blueprint. Quando a tag/nome
// corresponde ao catálogo padrão local, o processo Electron preenche os materiais;
// sem correspondência, a blueprint permanece destacada para cadastro manual.
function inferScmdbCategory(item) {
  const text = `${item?.tag || ''} ${item?.name || item?.productName || ''} ${item?.type || ''} ${item?.gear || ''}`.toLowerCase();
  if (/armor|helmet|core|arms|legs|backpack|medium_armor|heavy_armor|light_armor|flight suit|undersuit/.test(text)) return 'FPS Armor';
  if (/magazine|_mag\b|battery|ammo|munition|cartridge/.test(text)) return 'Ammo';
  if (/cooler|powerplant|power_plant|shield|thruster|quantum|radar|avionics|component/.test(text)) return 'Ship Component';
  if (/laser|ballistic|cannon|gatling|repeater|scattergun|massdriver|tachyon|weapon|rifle|pistol|smg|shotgun/.test(text)) return text.includes('armor') ? 'FPS Armor' : 'Ship Weapon';
  if (/consumable|medpen|food|drink/.test(text)) return 'Consumable';
  if (/flight|undersuit/.test(text)) return 'Flight Suit';
  return 'Outro';
}

function inferScmdbSize(item) {
  const text = `${item?.tag || ''} ${item?.name || item?.productName || ''}`;
  const match = text.match(/(?:^|[_\s])S([1-9])(?:$|[_\s])/i) || text.match(/size\s*([1-9])/i);
  return match ? match[1] : 'Personal';
}

export function normalizeScmdbBackup(parsed) {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.blueprints)) {
    throw new Error('Arquivo inválido: o backup precisa conter uma lista "blueprints" do SCMDB.');
  }
  const seen = new Set();
  const importedAt = new Date().toISOString();
  const list = parsed.blueprints.map((item, index) => {
    const tag = String(item?.tag || item?.scmdb_tag || item?.guid || '').trim();
    const name = String(item?.name || item?.productName || '').trim();
    if (!tag || !name) return null;
    const identity = tag.toLowerCase();
    if (seen.has(identity)) return null;
    seen.add(identity);
    const catalogMaterials = Array.isArray(item?.materials) ? item.materials.map(material => ({
      material_name: material.name,
      quantity: Number(material.quantityExact),
      unit: ['SCU', 'cSCU', 'mSCU', 'μSCU'].includes(material.quantityUnit) ? material.quantityUnit : 'un',
      notes: `SCMDB · ${material.inputType || 'material'} · slot: ${material.slot || '—'}`,
    })) : [];
    return {
      name,
      category: inferScmdbCategory(item),
      subcategory: item?.subtype || item?.type || 'SCMDB',
      manufacturer: String(item?.manufacturer || ''),
      item_size: inferScmdbSize(item),
      grade: '',
      item_class: String(item?.type || ''),
      description: `Blueprint importada do SCMDB. Tag: ${tag}`,
      how_to_get: item.url ? `Registro SCMDB: ${item.url}` : 'Importada do backup SCMDB',
      faction: '',
      mission_type: '',
      patch_added: item?.sourceVersion || 'SCMDB',
      notes: `SCMDB tag: ${tag}\\nImportada em: ${importedAt}`,
      ingredients: Array.isArray(item?.ingredients) && item.ingredients.length ? item.ingredients : catalogMaterials,
      scmdb_tag: tag,
      scmdb_url: String(item?.url || item?.scmdb_url || 'https://scmdb.net/?page=fab'),
      scmdb_completed: item?.completed === true,
      scmdb_index: index,
      userState: { owned: item?.completed === true ? 1 : 0, wishlist: item?.favorite === true ? 1 : 0 },
    };
  }).filter(Boolean);
  if (!list.length) throw new Error('O backup SCMDB não contém blueprints válidas para importar.');
  return list;
}

function isScmdbBlueprint(bp) {
  return Boolean(bp?.scmdb_imported || bp?.source === 'SCMDB' || bp?.scmdb_tag);
}

export function hasBlueprintMaterials(bp) {
  let ingredients = bp?.ingredients;
  if (typeof ingredients === 'string') {
    try { ingredients = JSON.parse(ingredients); } catch { ingredients = []; }
  }
  if (!Array.isArray(ingredients)) return false;
  return ingredients.some(ingredient => {
    const materialName = String(ingredient?.material_name || ingredient?.material || ingredient?.name || '').trim();
    const quantity = Number(ingredient?.quantity ?? ingredient?.amount ?? 0);
    return Boolean(materialName) && quantity > 0;
  });
}

// ── Conversão SCU ─────────────────────────────────────────────────────────────
// 1 SCU = 100 cSCU. Exibe conversão quando unidade é SCU ou cSCU.
function fmtSCU(qty, unit) {
  const normalized = normalizeCargoUnit(unit || 'un');
  if (isCargoUnit(normalized)) {
    const base = toCargoBase(qty, normalized);
    const scu = fromCargoBase(base, 'SCU');
    const cscu = fromCargoBase(base, 'cSCU');
    return {
      primary: `${formatCargoNumber(qty, 9)} ${normalized}`,
      secondary: normalized === 'SCU'
        ? `= ${formatCargoNumber(cscu, 9)} cSCU`
        : `= ${formatCargoNumber(scu, 9)} SCU`,
    };
  }
  return { primary: `${qty} ${unit}`, secondary: null };
}

const CAT_COLORS = {
  'FPS Weapon':'#fb7185','Ship Weapon':'#ff7744','FPS Armor':'#38bdf8',
  'Ship Component':'#6366f1','Ammo':'#fbbf24','Consumable':'#34d399',
  'Flight Suit':'#a78bfa','Utilitário':'#7a90b0','Outro':'#3d5070',
};
const FACTION_COLORS = {
  'Starter':'#34d399','Foxwell Enforcement':'#fb923c','Headhunters':'#fb7185',
  'Covalex':'#6366f1','Ling Family':'#a78bfa','Shubin Interstellar':'#fbbf24',
  'InterSec':'#38bdf8','Rayari':'#e91e63','Mile Eckhart':'#9b59b6',
  'Pyro Factions':'#e74c3c','Pyro Gangs':'#c0392b','General Mission Drop':'#7a90b0','Outro':'#3d5070',
};
const MATERIAL_COLORS = {
  'Titanium':'#74b9ff','Copper':'#fdcb6e','Orotite':'#a29bfe',
  'Caranite':'#fd79a8','Steel':'#b2bec3','Polymer':'#00cec9',
  'Industrial Polymer':'#55efc4','Medical Grade Polymer':'#34d399',
  'Inert Material':'#7a90b0','Reactive Material':'#fb7185','Tungsten':'#dfe6e9',
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
    updateNotes: async (id,notes) => { const s=load(); s.state[`b${id}n`]=notes; save(s); return {success:true}; },
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
    importScmdb: async (list) => {
      const s = load();
      const existingNames = new Set(s.custom.map(bp => String(bp.name || '').toLowerCase()));
      const existingTags = new Set(s.custom.map(bp => String(bp.scmdb_tag || '').toLowerCase()).filter(Boolean));
      let imported = 0; let skipped = 0;
      (list || []).forEach(item => {
        const nameKey = String(item.name || '').toLowerCase();
        const tagKey = String(item.scmdb_tag || '').toLowerCase();
        if (!nameKey || existingNames.has(nameKey) || (tagKey && existingTags.has(tagKey))) { skipped++; return; }
        const id = s.nextId++;
        const owned = item.userState?.owned ? 1 : 0;
        const wishlist = item.userState?.wishlist ? 1 : 0;
        s.custom.push({ ...item, id, ingredients:[], is_default:0, scmdb_imported:1, scmdb_tag:item.scmdb_tag || '', patch_added:item.patch_added || 'SCMDB' });
        s.state[`b${id}o`] = owned;
        s.state[`b${id}w`] = wishlist;
        s.state[`b${id}c`] = 0;
        s.state[`b${id}d`] = owned ? new Date().toISOString() : null;
        existingNames.add(nameKey);
        if (tagKey) existingTags.add(tagKey);
        imported++;
      });
      save(s);
      return { success:true, imported, skipped };
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
      toggleOwned:      (id) => window.electronAPI.bpToggleOwned(id),
      toggleWishlist:   (id) => window.electronAPI.bpToggleWishlist(id),
      incrementCraftado: (id) => window.electronAPI.bpIncrementCrafted(id),
      updateNotes:      (id,n) => window.electronAPI.bpUpdateNotes(id,n),
      createCustom:     (d) => window.electronAPI.bpCreateCustom(d),
      updateCustom:     (d) => window.electronAPI.bpUpdateCustom(d),
      deleteCustom:     (id) => window.electronAPI.bpDeleteCustom(id),
      importScmdb:      (list) => window.electronAPI.bpImportScmdb(list),
      getStats:         () => window.electronAPI.bpGetStats(),
    };
  }
  return buildMockBpAPI();
}

// ── Ingredient pill ───────────────────────────────────────────────────────────
function IngPill({ ing }) {
  const color = MATERIAL_COLORS[ing.material_name] || '#7a90b0';
  const fmt   = fmtSCU(ing.quantity, ing.unit || 'un');
  const isSCU = isCargoUnit(ing.unit);
  return (
    <div style={{ display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,
      background:`${color}18`,border:`1px solid ${color}44`,fontSize:12,fontWeight:600,
      color:'var(--text-primary)',flexShrink:0,flexDirection:isSCU?'column':'row',alignItems:isSCU?'flex-start':'center' }}>
      <div style={{ display:'flex',alignItems:'center',gap:5 }}>
        <div style={{ width:8,height:8,borderRadius:'50%',background:color,flexShrink:0 }}/>
        <span style={{ color }}>{ing.material_name}</span>
        <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-secondary)' }}>{fmt.primary}</span>
        {ing.quality_min>0 && <span style={{ fontSize:10,color:'var(--text-muted)',borderLeft:'1px solid var(--border-subtle)',paddingLeft:5 }}>Q≥{ing.quality_min}</span>}
      </div>
      {fmt.secondary && (
        <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:10,color:'var(--text-muted)',paddingLeft:13 }}>{fmt.secondary}</span>
      )}
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

  const IS = { width:'100%',padding:'7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:13,outline:'none' };
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
        <h3 style={{ fontFamily:'Michroma,sans-serif',fontSize:14,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.06em' }}>
          {initial ? 'EDITAR BLUEPRINT' : 'NOVO BLUEPRINT'}
        </h3>
        <button onClick={onCancelar} style={{ background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'4px 8px',display:'flex',alignItems:'center' }}><X size={13}/></button>
      </div>

      <div className="blueprint-form-primary-grid" style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,marginBottom:10 }}>
        <div><label style={LS}>Nome *</label><input style={IS} value={bp.name} onChange={e=>setF('name',e.target.value)} placeholder="ex: P6LR, FR-66 Shield..."/></div>
        <div><label style={LS}>Categoria</label>
          <select style={SS} value={bp.category} onChange={e=>setF('category',e.target.value)}>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label style={LS}>Subcategoria</label><input style={IS} value={bp.subcategory} onChange={e=>setF('subcategory',e.target.value)} placeholder="ex: Assault Rifle..."/></div>
      </div>

      <div className="blueprint-form-meta-grid" style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:10,marginBottom:10 }}>
        <div><label style={LS}>Fabricante</label><input style={IS} value={bp.manufacturer} onChange={e=>setF('manufacturer',e.target.value)} placeholder="Behring..."/></div>
        <div><label style={LS}>Tamanho</label><input style={IS} value={bp.item_size} onChange={e=>setF('item_size',e.target.value)} placeholder="Personal / 1 / 2..."/></div>
        <div><label style={LS}>Grade</label><input style={IS} value={bp.grade} onChange={e=>setF('grade',e.target.value)} placeholder="A / B / C..."/></div>
        <div><label style={LS}>Classe</label><input style={IS} value={bp.item_class} onChange={e=>setF('item_class',e.target.value)} placeholder="Military / Civilian..."/></div>
        <div><label style={LS}>Patch</label><input style={IS} value={bp.patch_added} onChange={e=>setF('patch_added',e.target.value)} placeholder="4.7"/></div>
      </div>

      <div className="blueprint-form-source-grid" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10 }}>
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
          <button onClick={addIng} style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 10px',background:'rgba(56,189,248,0.08)',border:'1px solid var(--border-normal)',borderRadius:5,color:'var(--accent-primary)',cursor:'pointer',fontSize:12,fontWeight:700 }}>
            <Plus size={12}/> Material
          </button>
        </div>
        {ings.map((ing,i)=>(
          <div key={i} className="blueprint-material-row" style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:8,alignItems:'end',marginBottom:6 }}>
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
            <button onClick={()=>removeIng(i)} disabled={ings.length===1} style={{ width:30,height:30,borderRadius:5,border:'1px solid rgba(251,113,133,0.2)',background:'rgba(251,113,133,0.08)',color:ings.length>1?'var(--accent-red)':'var(--text-muted)',cursor:ings.length>1?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',marginTop:i===0?16:0 }}>
              <Trash2 size={12}/>
            </button>
          </div>
        ))}
      </div>

      {error&&<div style={{ color:'var(--accent-red)',fontSize:12,marginBottom:10,display:'flex',alignItems:'center',gap:6 }}><AlertTriangle size={13}/>{error}</div>}

      <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
        <button onClick={onCancelar} style={{ padding:'9px 18px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.06em' }}>Cancelar</button>
        <button onClick={handleSave} style={{ display:'flex',alignItems:'center',gap:7,padding:'9px 22px',background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.35)',borderRadius:6,color:'var(--accent-green)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.06em' }}>
          <Save size={13}/>{initial?'Salvar Alterações':'Adicionar Blueprint'}
        </button>
      </div>
    </div>
  );
}

// ── Blueprint Card ────────────────────────────────────────────────────────────
function BpCard({ bp, onToggleOwned, onToggleWishlist, onSelect, isSelected, onEdit, onDelete, onQueue, isQueued }) {
  const catColor = CAT_COLORS[bp.category]||'#7a90b0';
  const facColor = FACTION_COLORS[bp.faction]||'#7a90b0';
  const isScmdb = isScmdbBlueprint(bp);
  const missingMaterials = isScmdb && !hasBlueprintMaterials(bp);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [noteEdit, setNoteEdit] = useState(false);
  const [noteText, setNoteText] = useState(bp.user_notes||'');
  const [noteGuardado, setNoteGuardado] = useState(false);

  return (
    <div style={{
      background: missingMaterials ? 'rgba(251,191,36,0.07)' : bp.owned?'rgba(52,211,153,0.04)':'var(--bg-card)',
      border:`1px solid ${missingMaterials?'rgba(251,191,36,0.5)':bp.owned?'rgba(52,211,153,0.3)':isSelected?'var(--border-bright)':'var(--border-subtle)'}`,
      borderRadius:8,overflow:'hidden',transition:'all 0.2s',
    }}>
      {/* Main row */}
      <div style={{ display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer' }} onClick={onSelect}
        onMouseEnter={e=>e.currentTarget.parentElement.style.borderColor=missingMaterials?'rgba(251,191,36,0.75)':bp.owned?'rgba(52,211,153,0.5)':'var(--border-normal)'}
        onMouseLeave={e=>e.currentTarget.parentElement.style.borderColor=missingMaterials?'rgba(251,191,36,0.5)':bp.owned?'rgba(52,211,153,0.3)':isSelected?'var(--border-bright)':'var(--border-subtle)'}>
        {/* Status icon */}
        <div style={{ width:34,height:34,borderRadius:7,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:missingMaterials?'rgba(251,191,36,0.16)':bp.owned?'rgba(52,211,153,0.12)':`${catColor}18`,border:`1px solid ${missingMaterials?'rgba(251,191,36,0.55)':bp.owned?'rgba(52,211,153,0.4)':`${catColor}44`}`,color:missingMaterials?'var(--accent-gold)':bp.owned?'var(--accent-green)':catColor }}>
          {missingMaterials?<AlertTriangle size={17}/>:bp.owned?<CheckCircle2 size={17}/>:<Cpu size={17}/>}
        </div>
        {/* Info */}
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:3 }}>
            <span style={{ fontFamily:'"Exo 2",sans-serif',fontSize:14,fontWeight:700,color:'var(--text-primary)' }}>{bp.name}</span>
            <ProvenanceBadge category="blueprint" name={bp.name}/>
            {bp.is_default?<span style={{ fontSize:9,color:'var(--accent-green)',fontWeight:700,background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.25)',padding:'1px 6px',borderRadius:3 }}>PADRÃO</span>:null}
            {isScmdb&&<span style={{ fontSize:9,color:'var(--accent-primary)',fontWeight:700,background:'rgba(56,189,248,0.1)',border:'1px solid rgba(56,189,248,0.28)',padding:'1px 6px',borderRadius:3 }}>SCMDB</span>}
            {missingMaterials&&<span style={{ fontSize:9,color:'var(--accent-gold)',fontWeight:700,background:'rgba(251,191,36,0.14)',border:'1px solid rgba(251,191,36,0.42)',padding:'1px 6px',borderRadius:3 }}>CADASTRAR MATERIAIS</span>}
            {bp.grade&&<span style={{ fontSize:10,color:'var(--text-muted)',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3 }}>Grade {bp.grade}</span>}
            {bp.item_size&&bp.item_size!=='Personal'&&<span style={{ fontSize:10,color:'var(--text-muted)',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3 }}>S{bp.item_size}</span>}
            {isQueued&&<span style={{ fontSize:9,color:'var(--accent-gold)',fontWeight:700,background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.3)',padding:'1px 6px',borderRadius:3 }}>🛒 NA FILA</span>}
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
          {bp.crafted_count>0&&<span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--accent-primary)',background:'rgba(56,189,248,0.08)',border:'1px solid var(--border-subtle)',padding:'1px 7px',borderRadius:10 }}>🔨×{bp.crafted_count}</span>}
          <div style={{ display:'flex',gap:4 }} onClick={e=>e.stopPropagation()}>
            {/* Queue btn */}
            <button onClick={()=>onQueue(bp)} title={isQueued?'Remover da fila de craft':'Adicionar à fila de craft'} style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:5,border:`1px solid ${isQueued?'rgba(251,191,36,0.4)':'rgba(251,191,36,0.2)'}`,background:isQueued?'rgba(251,191,36,0.15)':'rgba(251,191,36,0.06)',color:'var(--accent-gold)',cursor:'pointer',fontSize:11,fontWeight:700 }}>
              <ShoppingCart size={11}/>{isQueued?'Na Fila':'Quero Craftar'}
            </button>
            <button onClick={()=>onToggleOwned(bp.id)} title={bp.owned?'Remover da coleção':'Marcar como obtida'} style={{ width:28,height:28,borderRadius:5,border:`1px solid ${bp.owned?'rgba(52,211,153,0.4)':'var(--border-subtle)'}`,background:bp.owned?'rgba(52,211,153,0.15)':'transparent',color:bp.owned?'var(--accent-green)':'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13 }}>✓</button>
            <button onClick={()=>onToggleWishlist(bp.id)} title="wishlist" style={{ width:28,height:28,borderRadius:5,border:`1px solid ${bp.wishlist?'rgba(251,191,36,0.4)':'var(--border-subtle)'}`,background:bp.wishlist?'rgba(251,191,36,0.12)':'transparent',color:bp.wishlist?'var(--accent-gold)':'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13 }}>★</button>
            <button onClick={()=>onEdit(bp)} style={{ width:28,height:28,borderRadius:5,border:'1px solid var(--border-normal)',background:'rgba(56,189,248,0.06)',color:'var(--accent-primary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><Edit3 size={12}/></button>
            {(!bp.is_default || isScmdbBlueprint(bp))&&(deleteConfirm?(
              <div style={{ display:'flex',gap:4,alignItems:'center' }}>
                <button onClick={()=>onDelete(bp.id)} style={{ padding:'4px 8px',background:'rgba(251,113,133,0.15)',border:'1px solid rgba(251,113,133,0.4)',borderRadius:4,color:'var(--accent-red)',cursor:'pointer',fontSize:11,fontWeight:700 }}>Sim</button>
                <button onClick={()=>setDeleteConfirm(false)} style={{ padding:'4px 8px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-secondary)',cursor:'pointer',fontSize:11 }}>Não</button>
              </div>
            ):(
              <button onClick={()=>setDeleteConfirm(true)} style={{ width:28,height:28,borderRadius:5,border:'1px solid rgba(251,113,133,0.2)',background:'rgba(251,113,133,0.08)',color:'var(--accent-red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><Trash2 size={12}/></button>
            ))}
          </div>
        </div>
      </div>

      {/* Expandired */}
      {isSelected&&(
        <div style={{ padding:'12px 14px 14px',borderTop:'1px solid var(--border-subtle)',background:'rgba(0,0,0,0.12)' }}>
          {bp.description&&<p style={{ fontSize:12,color:'var(--text-secondary)',lineHeight:1.6,marginBottom:10 }}>{bp.description}</p>}
          {missingMaterials&&<div style={{ display:'flex',alignItems:'flex-start',gap:8,padding:'9px 11px',marginBottom:10,background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.35)',borderRadius:6,color:'var(--accent-gold)',fontSize:11,lineHeight:1.5 }}><AlertTriangle size={14} style={{ flexShrink:0,marginTop:1 }}/><span>Esta blueprint foi importada do SCMDB e está marcada como <strong>obtida</strong>, mas o backup não informa os minérios necessários. Edite a blueprint e adicione os materiais para liberar o tracking de craft.</span></div>}
          {bp.how_to_get&&(
            <div style={{ background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.15)',borderRadius:6,padding:'10px 12px',marginBottom:10 }}>
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
              <button onClick={async()=>{ await getBpAPI().updateNotes(bp.id,noteText); setNoteGuardado(true); setTimeout(()=>{setNoteGuardado(false);setNoteEdit(false);},1500); }} className="save-btn" style={{ fontSize:11,padding:'5px 10px' }}>{noteGuardado?'✓ Salvo!':'Salvar'}</button>
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
  const [filterMaterial, setFilterMaterial] = useState('all');
  const [filterClass, setFilterClass] = useState('all');
  const [filterComponentType, setFilterComponentType] = useState('all');
  const [filterSubtype, setFilterSubtype] = useState('all');
  const [filterObtida, setFilterObtida] = useState('all');
  const [sortBy,      setOrdenarBy]      = useState('name');
  const [selectedBp,  setSelectedBp]  = useState(null);
  const [visibleCount, setVisibleCount] = useState(100);
  const [queue,       setQueue]       = useState(loadQueue());
  const [scmdbImporting, setScmdbImporting] = useState(false);
  const [scmdbMessage, setScmdbMessage] = useState(null);
  const [trackingToast, setTrackingToast] = useState(false);
  const trackingToastTimerRef = useRef(null);
  const scmdbInputRef = useRef(null);

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

  useEffect(() => () => {
    if (trackingToastTimerRef.current) clearTimeout(trackingToastTimerRef.current);
  }, []);

  const refreshQueue = () => setQueue(loadQueue());

  async function handleScmdbFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setScmdbImporting(true);
    setScmdbMessage({ type:'info', text:`Lendo ${file.name}...` });
    try {
      const parsed = JSON.parse(await file.text());
      const normalized = normalizeScmdbBackup(parsed);
      if (typeof api.importScmdb !== 'function') throw new Error('A ponte Electron não possui o importador SCMDB. Substitua também main.js e preload.js pelos arquivos atualizados.');
      const result = await api.importScmdb(normalized);
      normalized.forEach(bp => setProvenance('blueprint', bp.name, SOURCES.MANUAL));
      await loadData();
      const details = [
        `${result.imported || 0} nova(s)`,
        `${result.enriched || 0} enriquecida(s) com materiais`,
        `${result.skipped || 0} sem alteração`,
      ];
      setScmdbMessage({ type:'ok', text:`SCMDB reconciliado: ${details.join(' · ')}. Blueprints sem correspondência no catálogo continuam com “CADASTRAR MATERIAIS”.` });
    } catch (error) {
      setScmdbMessage({ type:'error', text:error.message || 'Não foi possível restaurar o backup SCMDB.' });
    } finally {
      setScmdbImporting(false);
    }
  }

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
    if (editingBp.is_default && !isScmdbBlueprint(editingBp)) {
      // Seeds internos antigos continuam protegidos: a edição cria uma cópia custom.
      await api.createCustom({ ...data, patch_added: editingBp.patch_added || '4.7' });
    } else {
      // Blueprints SCMDB padrão são registros editáveis pelo usuário.
      await api.updateCustom({ bpId: editingBp.id, ...data });
    }
    // A fila mantém um snapshot dos ingredientes. Atualize-o após editar
    // a blueprint para refletir imediatamente cada quality_min no Tracking.
    syncQueuedBlueprint({
      id: editingBp.id,
      ...data.bp,
      ingredients: data.ingredients,
    });
    refreshQueue();
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
    if (queuedIds.has(String(bp.id))) {
      dequeueBlueprint(bp.id);
      refreshQueue();
      return;
    }

    queueBlueprint(bp, 1);
    refreshQueue();
    setTrackingToast(true);
    if (trackingToastTimerRef.current) clearTimeout(trackingToastTimerRef.current);
    trackingToastTimerRef.current = setTimeout(() => setTrackingToast(false), 3000);
  }

  const deferredSearch = useDeferredValue(search);
  const queuedIds = useMemo(() => new Set((queue.queuedBlueprints || []).map(item => String(item.bpId))), [queue]);

  const filtered = useMemo(()=>{
    let res=[...bps];
    if(deferredSearch){const q=deferredSearch.toLowerCase();res=res.filter(b=>b.name?.toLowerCase().includes(q)||b.category?.toLowerCase().includes(q)||b.manufacturer?.toLowerCase().includes(q)||b.faction?.toLowerCase().includes(q)||b.ingredients?.some(i=>i.material_name?.toLowerCase().includes(q)));}
    if(filterCat!=='all') res=res.filter(b=>b.category===filterCat);
    if(filterFac!=='all') res=res.filter(b=>b.faction===filterFac);
    if(filterClass!=='all') res=res.filter(b=>String(b.item_class || b.class || '').trim()===filterClass);
    if(filterComponentType!=='all') res=res.filter(b=>String(b.component_type || b.componentType || b.type || '').trim()===filterComponentType);
    if(filterSubtype!=='all') res=res.filter(b=>String(b.subcategory || b.subtype || '').trim()===filterSubtype);
    if(filterMaterial!=='all') res=res.filter(b=>{
      let ingredients=b.ingredients;
      if(typeof ingredients==='string'){try{ingredients=JSON.parse(ingredients);}catch{ingredients=[];}}
      return Array.isArray(ingredients) && ingredients.some(i=>String(i?.material_name || i?.material || i?.name || '').trim()===filterMaterial);
    });
    if(filterObtida==='owned')    res=res.filter(b=>b.owned);
    if(filterObtida==='missing')  res=res.filter(b=>!b.owned);
    if(filterObtida==='wishlist') res=res.filter(b=>b.wishlist&&!b.owned);
    if(filterObtida==='queued')   res=res.filter(b=>queuedIds.has(String(b.id)));
    if(filterObtida==='materials') res=res.filter(b=>hasBlueprintMaterials(b));
    res.sort((a,b)=>sortBy==='faction'?(a.faction||'').localeCompare(b.faction||''):sortBy==='cat'?(a.category||'').localeCompare(b.category||''):sortBy==='crafted'?(b.crafted_count||0)-(a.crafted_count||0):(a.name||'').localeCompare(b.name||''));
    return res;
  },[bps,deferredSearch,filterCat,filterFac,filterMaterial,filterClass,filterComponentType,filterSubtype,filterObtida,sortBy,queuedIds]);

  useEffect(() => {
    setVisibleCount(100);
  }, [deferredSearch, filterCat, filterFac, filterMaterial, filterClass, filterComponentType, filterSubtype, filterObtida, sortBy, queue]);

  const visibleBlueprints = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const catList = useMemo(()=>[...new Set(bps.map(b=>b.category).filter(Boolean))].sort(),[bps]);
  const facList = useMemo(()=>[...new Set(bps.map(b=>b.faction).filter(Boolean))].sort(),[bps]);
  const classList = useMemo(()=>[...new Set(bps.map(b=>String(b.item_class || b.class || '').trim()).filter(Boolean))].sort(),[bps]);
  const componentTypeList = useMemo(()=>[...new Set(bps.map(b=>String(b.component_type || b.componentType || b.type || '').trim()).filter(Boolean))].sort(),[bps]);
  const subtypeList = useMemo(()=>[...new Set(bps.map(b=>String(b.subcategory || b.subtype || '').trim()).filter(Boolean))].sort(),[bps]);
  const materialList = useMemo(()=>{
    const values = new Set();
    bps.forEach(bp=>{ let ingredients=bp.ingredients; if(typeof ingredients==='string'){try{ingredients=JSON.parse(ingredients);}catch{ingredients=[];}} (Array.isArray(ingredients)?ingredients:[]).forEach(i=>{const name=String(i?.material_name || i?.material || i?.name || '').trim(); if(name) values.add(name);}); });
    return [...values].sort((a,b)=>a.localeCompare(b));
  },[bps]);
  const queuedCount = queue.queuedBlueprints.length;
  const ownedCount  = bps.filter(b=>b.owned).length;
    const pct = bps.length>0?Math.round((ownedCount/bps.length)*100):0;
  const materialsCount = bps.filter(hasBlueprintMaterials).length;

  const SS =
 { padding:'7px 24px 7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:13,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 6px center' };

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">BLUEPRINTS DE CRAFTING</div>
          <div className="page-subtitle">{ownedCount}/{bps.length} blueprints · {bps.reduce((a,b)=>a+(b.crafted_count||0),0)} itens craftados · {pct}% completo</div>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end' }}>
          <input ref={scmdbInputRef} type="file" accept=".json,application/json" onChange={handleScmdbFile} style={{ display:'none' }}/>
          <button onClick={()=>scmdbInputRef.current?.click()} disabled={scmdbImporting} title="Importar backup JSON do SCMDB" style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 11px',background:'rgba(167,139,250,0.1)',border:'1px solid rgba(167,139,250,0.35)',borderRadius:6,color:'var(--accent-purple)',cursor:scmdbImporting?'wait':'pointer',fontFamily:'"Exo 2",sans-serif',fontSize:11,fontWeight:700,textTransform:'uppercase',opacity:scmdbImporting?0.65:1 }}><Upload size={12}/>{scmdbImporting?'Restaurando...':'Restaurar backup SCMDB'}</button>
          <button onClick={loadData} style={{ padding:'8px 12px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:12 }}><RefreshCw size={12}/></button>
          {!showForm&&!editingBp&&(
            <button onClick={()=>setShowForm(true)} style={{ display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'rgba(56,189,248,0.1)',border:'1px solid var(--border-normal)',borderRadius:8,color:'var(--accent-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer' }}>
              <Plus size={14}/> Novo Blueprint
            </button>
          )}
        </div>
      </div>

      {trackingToast&&<div role="status" aria-live="polite" style={{ position:'fixed',top:20,left:'50%',transform:'translateX(-50%)',zIndex:2500,display:'flex',alignItems:'center',gap:9,padding:'11px 18px',borderRadius:9,border:'1px solid rgba(52,211,153,0.42)',background:'linear-gradient(135deg,rgba(16,49,45,0.97),rgba(18,37,48,0.97))',boxShadow:'0 12px 34px rgba(0,0,0,0.32),0 0 24px rgba(52,211,153,0.16)',color:'var(--accent-green)',fontSize:12,fontWeight:700,letterSpacing:'0.02em',animation:'blueprintQueueToastIn 180ms ease-out'}}><CheckCircle2 size={16}/><span>bp enviada para a fila de tracking de material</span></div>}
      {scmdbMessage&&<div style={{ margin:'0 32px 10px',padding:'9px 12px',borderRadius:6,border:`1px solid ${scmdbMessage.type==='error'?'rgba(251,113,133,0.35)':scmdbMessage.type==='ok'?'rgba(52,211,153,0.3)':'rgba(167,139,250,0.3)'}`,background:scmdbMessage.type==='error'?'rgba(251,113,133,0.08)':scmdbMessage.type==='ok'?'rgba(52,211,153,0.08)':'rgba(167,139,250,0.08)',color:scmdbMessage.type==='error'?'var(--accent-red)':scmdbMessage.type==='ok'?'var(--accent-green)':'var(--accent-purple)',fontSize:11,lineHeight:1.5,display:'flex',alignItems:'center',gap:7}}>{scmdbMessage.type==='error'?<AlertTriangle size={13}/>:scmdbMessage.type==='ok'?<CheckCircle2 size={13}/>:<RefreshCw size={13}/>}<span>{scmdbMessage.text}</span></div>}

      {/* Stats bar */}
      {!showForm&&!editingBp&&(
        <div style={{ padding:'10px 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',flexShrink:0 }}>
          <div style={{ display:'flex',gap:10,overflowX:'auto',paddingBottom:2,marginBottom:8 }}>
            {[
              {l:'Obtidos',v:ownedCount,c:'var(--accent-primary)'},
              {l:'Faltando',v:bps.length-ownedCount,c:'var(--text-secondary)'},
              {l:'Desejos',v:bps.filter(b=>b.wishlist&&!b.owned).length,c:'var(--accent-gold)'},
              {l:'Com minérios',v:materialsCount,c:materialsCount>0?'var(--accent-green)':'var(--text-muted)'},
              {l:'🛒 Na Fila',v:queuedCount,c:queuedCount>0?'var(--accent-gold)':'var(--text-muted)'},
            ].map(({l,v,c})=>(
              <div key={l} style={{ background:'var(--bg-card)',border:`1px solid ${l.includes('Fila')&&v>0?'rgba(251,191,36,0.25)':'var(--border-subtle)'}`,borderRadius:8,padding:'8px 14px',minWidth:100,flexShrink:0,textAlign:'center' }}>
                <div style={{ fontFamily:'Michroma,sans-serif',fontSize:16,fontWeight:800,color:c }}>{v}</div>
                <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginTop:2 }}>{l}</div>
              </div>
            ))}
            {(stats?.byCat||[]).slice(0,4).map(({category,total,owned:o})=>(
              <div key={category} style={{ background:'var(--bg-card)',border:`1px solid ${CAT_COLORS[category]||'var(--border-subtle)'}33`,borderRadius:8,padding:'8px 14px',minWidth:120,flexShrink:0 }}>
                <div style={{ fontFamily:'Michroma,sans-serif',fontSize:16,fontWeight:800,color:CAT_COLORS[category]||'var(--text-primary)' }}>{o||0}/{total}</div>
                <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:2 }}>{category}</div>
              </div>
            ))}
          </div>
          <div style={{ height:4,background:'var(--border-subtle)',borderRadius:2,overflow:'hidden' }}>
            <div style={{ height:'100%',width:`${pct}%`,background:'linear-gradient(to right,var(--accent-secondary),var(--accent-primary))',borderRadius:2,transition:'width 0.8s',boxShadow:'0 0 8px rgba(56,189,248,0.3)' }}/>
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
            <select style={SS} value={filterMaterial} onChange={e=>setFilterMaterial(e.target.value)}>
              <option value="all">Qualquer Minério</option>
              {materialList.map(material=><option key={material}>{material}</option>)}
            </select>
            <select style={SS} value={filterClass} onChange={e=>setFilterClass(e.target.value)}>
              <option value="all">Qualquer Classe</option>
              {classList.map(value=><option key={value}>{value}</option>)}
            </select>
            <select style={SS} value={filterComponentType} onChange={e=>setFilterComponentType(e.target.value)}>
              <option value="all">Tipo de Componente</option>
              {componentTypeList.map(value=><option key={value}>{value}</option>)}
            </select>
            <select style={SS} value={filterSubtype} onChange={e=>setFilterSubtype(e.target.value)}>
              <option value="all">Qualquer Subtipo</option>
              {subtypeList.map(value=><option key={value}>{value}</option>)}
            </select>
            <select style={SS} value={sortBy} onChange={e=>setOrdenarBy(e.target.value)}>
              <option value="name">Nome (A-Z)</option>
              <option value="faction">Facção</option>
              <option value="cat">Categoria</option>

            </select>
          </div>
          <div style={{ display:'flex',gap:6,flexWrap:'wrap',alignItems:'center' }}>
            {[{val:'all',label:'Todos'},{val:'owned',label:'✓ Tenho'},{val:'missing',label:'○ Faltando'},{val:'wishlist',label:'★ Desejos'},{val:'materials',label:'⛏ Com minérios'},{val:'queued',label:'🛒 Na Fila'}].map(o=>(
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
              {visibleBlueprints.map(bp=>(
                <BpCard key={bp.id} bp={bp}
                  onToggleOwned={handleToggleOwned}
                  onToggleWishlist={handleToggleWishlist}
                  onIncrementCrafted={handleIncrementCraftado}
                  onSelect={()=>setSelectedBp(selectedBp===bp.id?null:bp.id)}
                  isSelected={selectedBp===bp.id}
                  onEdit={b=>{setEditingBp(b);setShowForm(false);}}
                  onDelete={handleDelete}
                  onQueue={handleQueue}
                  isQueued={queuedIds.has(String(bp.id))}
                />
              ))}
              {visibleBlueprints.length < filtered.length && <div style={{display:'flex',justifyContent:'center',padding:'14px 0 4px'}}><button type="button" onClick={() => setVisibleCount(count => Math.min(count + 100, filtered.length))} style={{padding:'8px 16px',borderRadius:7,border:'1px solid rgba(56,189,248,0.3)',background:'rgba(56,189,248,0.08)',color:'var(--accent-primary)',fontWeight:700,cursor:'pointer'}}>Carregar mais ({Math.min(100, filtered.length - visibleBlueprints.length)})</button></div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}