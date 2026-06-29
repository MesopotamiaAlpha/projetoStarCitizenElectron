import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus, Search, Package, Edit3, Trash2, X, Save,
  AlertTriangle, MapPin, Box, ChevronDown, ChevronUp,
  BarChart3, Filter, RefreshCw
} from 'lucide-react';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { setProvenance, SOURCES } from '../data/provenance';

// ─────────────────────────────────────────────────────────────────────────────
// Reference data
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEMS = ['Stanton','Pyro','Nyx','Terra','Odin'];

const LOCATIONS = {
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

const CATEGORIES = {
  'Arma Pessoal': ['Rifle de Assalto','Rifle de Sniper','Espingarda (Shotgun)','SMG','Pistola','Lança-granadas','Lança-foguetes','Arma Melee','Munição'],
  'Acessório de Arma': ['Mira/Scope','Supressor','Lanterna Tática','Carregador','Underbarrel','Empunhadura'],
  'Armadura FPS': ['Capacete','Torso','Braços','Pernas','Mochila','Set Completo','Undersuit'],
  'Roupa': ['Chapéu / Boné','Jaqueta','Camisa','Calça','Calçado','Luvas','Óculos','Macacão'],
  'Componente de Nave': ['Arma de Nave','Escudo','Propulsor Quântico','Planta de Energia','Cooler','Thruster','Radar/Avionics','Módulo de Mineiroação','Módulo de Salvage','Módulo de Fabricação'],
  'Utilitário': ['Medpen','Stimpak','Multi-Tool','Extrator de Mineiroação','Faca / Multifaca','Tractor Beam','Docking Collar','Scanner','Gadget'],
  'Recurso / Minério': ['Quantainium','Bexalite','Taranite','Borase','Laranite','Agricium','Titanium','Copper','Iron','Gold','Corundum','Hephaestanite','Dolivine'],
  'Commodity': ['Processed Food','Medical Supplies','Stims','Agricultural Supplies','Hydrogen Fuel','Quantum Fuel','Waste','Scrap','Altruciatoxin','Neon','Widow','WiDoW','GreenGro','SLAM'],
  'Blueprint': ['Blueprint de Arma','Blueprint de Armadura','Blueprint de Componente','Blueprint de Munição','Blueprint de Utilitário'],
  'Decoração / Flair': ['Trdeéu','Pintura de Nave','Decalque','Item de Hangar','Livro / Lore','Objeto Colecionável'],
  'Consumível': ['Bebida','Comida','Remédio','Explosivo','Sinalizador'],
  'Contrabando': ['Droga ilegal','Arma proibida','Item Contrabandoeado'],
  'Miscellaneous': ['Container','Item Desconhecido','Outro'],
};

const CONDITIONS  = ['Novo','Excelente','Bom','Usado','Danificado','Destruído'];
const UNITS       = ['un','SCU','cSCU','mSCU','kg','l','stack'];
const GRADES      = ['','S','A','B','C','D','Military','Industrial','Civ','Stealth','Racing'];
const SIZES       = ['','0','1','2','3','4','5','6','7','8','Handheld','Personal'];

const CATEGORY_COLORS = {
  'Arma Pessoal':      '#ff4466',
  'Acessório de Arma': '#ff7755',
  'Armadura FPS':      '#00d4ff',
  'Roupa':             '#b44cff',
  'Componente de Nave':'#0077ff',
  'Utilitário':        '#00e5a0',
  'Recurso / Minério': '#ffc436',
  'Commodity':         '#f39c12',
  'Blueprint':         '#9b59b6',
  'Decoração / Flair': '#e91e63',
  'Consumível':        '#27ae60',
  'Contrabando':        '#e74c3c',
  'Miscellaneous':     '#7a90b0',
};

const SYSTEM_COLORS = {
  Stanton:'#00d4ff', Pyro:'#ff8c00', Nyx:'#b44cff', Terra:'#00e5a0', Odin:'#ffc436',
};

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

// ─────────────────────────────────────────────────────────────────────────────
// ItemForm
// ─────────────────────────────────────────────────────────────────────────────
const emptyItem = () => ({
  name:'', category:'Arma Pessoal', subcategory:'',
  system:'Stanton', location_type:'Estação Orbital', location_name:'',
  container:'', quantity:1, unit:'un',
  size:'', grade:'', manufacturer:'', condition:'Bom',
  value_auec:0, is_contraband:false, notes:'',
});

function ItemForm({ initial, onSave, onCancelar }) {
  const [data, setDate] = useState(initial || emptyItem());
  const [error, setError] = useState('');

  const set = (k,v) => setDate(p=>({...p,[k]:v}));

  const locationTipos = data.system && LOCATIONS[data.system]
    ? Object.keys(LOCATIONS[data.system]) : [];
  const locationOptions = data.system && data.location_type && LOCATIONS[data.system]?.[data.location_type]
    ? LOCATIONS[data.system][data.location_type] : [];
  const subcatOptions = CATEGORIES[data.category] || [];

  function handleSistemaChange(sys) {
    const types = Object.keys(LOCATIONS[sys]||{});
    const lt = types[0]||'';
    const locs = (LOCATIONS[sys]||{})[lt]||[];
    set('system',sys); set('location_type',lt); set('location_name',locs[0]||'');
  }
  function handleTipoChange(lt) {
    const locs = (LOCATIONS[data.system]||{})[lt]||[];
    set('location_type',lt); set('location_name',locs[0]||'');
  }

  function handleSubmit() {
    if (!data.name.trim())          { setError('Nome do item é obrigatório.'); return; }
    if (!data.location_name.trim()) { setError('Localização é obrigatória.'); return; }
    setError('');
    onSave({ ...data, quantity:Number(data.quantity)||1, value_auec:Number(data.value_auec)||0, is_contraband:data.is_contraband?1:0 });
  }

  const IS = { width:'100%',padding:'8px 12px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:14,outline:'none' };
  const LS = { fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 };
  const SS = { ...IS, padding:'8px 28px 8px 12px', appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center' };

  return (
    <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:10,padding:'24px',marginBottom:24 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
        <h3 style={{ fontFamily:'Orbitron,monospace',fontSize:15,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.08em' }}>
          {initial?.id ? 'EDITAR ITEM' : 'REGISTRAR ITEM'}
        </h3>
        <button onClick={onCancelar} style={{ background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'5px 8px',display:'flex',alignItems:'center' }}>
          <X size={14}/>
        </button>
      </div>

      {/* Row 1: Nome + Categoria + Subcategoria */}
      <div style={{ display:'grid',gridTemplateColumns:'2fr 1.5fr 1.5fr',gap:12,marginBottom:12 }}>
        <div>
          <label style={LS}>Nome do Item *</label>
          <input style={IS} value={data.name} onChange={e=>set('name',e.target.value)} placeholder="ex: Klaus & Werner Demeco, Behring P8-SC..."/>
        </div>
        <div>
          <label style={LS}>Categoria</label>
          <select style={SS} value={data.category} onChange={e=>{set('category',e.target.value);set('subcategory','');}}>
            {Object.keys(CATEGORIES).map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={LS}>Subcategoria</label>
          <select style={SS} value={data.subcategory} onChange={e=>set('subcategory',e.target.value)}>
            <option value="">— selecione —</option>
            {subcatOptions.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Row 2: Sistema + Localização Tipo + Localização */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1.5fr 2fr',gap:12,marginBottom:12 }}>
        <div>
          <label style={LS}>Sistema</label>
          <select style={SS} value={data.system} onChange={e=>handleSistemaChange(e.target.value)}>
            {SYSTEMS.map(s=><option key={s} value={s}>{s}</option>)}
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
          {locationOptions.length > 0 ? (
            <select style={SS} value={data.location_name} onChange={e=>set('location_name',e.target.value)}>
              <option value="">— selecione —</option>
              {locationOptions.map(l=><option key={l} value={l}>{l}</option>)}
              <option value="__custom">Outro (digitar)</option>
            </select>
          ) : (
            <input style={IS} value={data.location_name} onChange={e=>set('location_name',e.target.value)} placeholder="Nome do local..."/>
          )}
          {data.location_name === '__custom' && (
            <input style={{ ...IS, marginTop:6 }} placeholder="Digite o local..." onChange={e=>set('location_name',e.target.value)}/>
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
        <div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.25)',borderRadius:6,marginBottom:12,color:'var(--accent-red)',fontSize:13 }}>
          <AlertTriangle size={14}/> {error}
        </div>
      )}

      <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
        <button onClick={onCancelar} style={{ padding:'10px 20px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.08em' }}>Cancelar</button>
        <button onClick={handleSubmit} style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 24px',background:'rgba(0,212,255,0.1)',border:'1px solid var(--border-normal)',borderRadius:6,color:'var(--accent-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',letterSpacing:'0.08em',textTransform:'uppercase' }}>
          <Save size={14}/>{initial?.id?'Salvar Alterações':'Registrar Item'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [itens,       setItens]       = useState([]);
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editItem,    setEditItem]    = useState(null);
  const [search,      setSearch]      = useState('');
  const [filterSys,   setFilterSys]   = useState('all');
  const [filterCat,   setFilterCat]   = useState('all');
  const [filterCon,   setFilterCon]   = useState('all');
  const [sortBy,      setOrdenarBy]      = useState('name');
  const [groupBy,     setGroupBy]     = useState('none');
  const [deleteConfirm,setDeleteConfirm] = useState(null);
  const [expandedRows, setExpandRows] = useState(new Set());

  // Use electronAPI if available, else mock
  const invAPI = useMemo(() => {
    if (window.electronAPI) {
      return {
        getAll:    () => window.electronAPI.inventoryGetAll(),
        create:    (i) => window.electronAPI.inventoryCreate(i),
        update:    (i) => window.electronAPI.inventoryUpdate(i),
        delete:    (id) => window.electronAPI.inventoryDelete(id),
        getStats:  () => window.electronAPI.inventoryGetStats(),
      };
    }
    return getMockInvAPI();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [all, st] = await Promise.all([invAPI.getAll(), invAPI.getStats()]);
      setItens(all);
      setStats(st);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [invAPI]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSave(data) {
    if (data.id) await invAPI.update(data);
    else {
      await invAPI.create(data);
      setProvenance('item', data.name, SOURCES.MANUAL);
    }
    setShowForm(false); setEditItem(null);
    await loadData();
  }

  async function handleDelete(id) {
    await invAPI.delete(id);
    setDeleteConfirm(null);
    await loadData();
  }

  // Filtered + sorted itens
  const filtered = useMemo(() => {
    let res = [...itens];
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.location_name?.toLowerCase().includes(q) ||
        i.notes?.toLowerCase().includes(q) ||
        i.manufacturer?.toLowerCase().includes(q)
      );
    }
    if (filterSys !== 'all') res = res.filter(i => i.system === filterSys);
    if (filterCat !== 'all') res = res.filter(i => i.category === filterCat);
    if (filterCon === 'contraband') res = res.filter(i => i.is_contraband);
    if (filterCon === 'legal')      res = res.filter(i => !i.is_contraband);

    res.sort((a,b) => {
      switch(sortBy) {
        case 'value':    return (b.value_auec*b.quantity)-(a.value_auec*a.quantity);
        case 'qty':      return b.quantity-a.quantity;
        case 'location': return (a.location_name||'').localeCompare(b.location_name||'');
        case 'category': return (a.category||'').localeCompare(b.category||'');
        case 'system':   return (a.system||'').localeCompare(b.system||'');
        default:         return (a.name||'').localeCompare(b.name||'');
      }
    });
    return res;
  }, [itens, search, filterSys, filterCat, filterCon, sortBy]);

  // Grupo itens
  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ label: null, itens: filtered }];
    const map = new Map();
    for (const item of filtered) {
      const key = groupBy === 'system'   ? item.system
                : groupBy === 'category' ? item.category
                : groupBy === 'location' ? `${item.system} — ${item.location_name}`
                : 'Todos';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return [...map.entries()].map(([label, itens]) => ({ label, itens }))
      .sort((a,b) => (a.label||'').localeCompare(b.label||''));
  }, [filtered, groupBy]);

  const totalValor = filtered.reduce((a,i) => a+(i.value_auec||0)*(i.quantity||1), 0);

  function toggleRow(id) {
    setExpandRows(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const catList = [...new Set(itens.map(i=>i.category))].sort();
  const sysList = SYSTEMS.filter(s => itens.some(i=>i.system===s));

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--text-muted)',fontSize:14 }}>
      <RefreshCw size={20} style={{ marginRight:8, animation:'spin 1s linear infinite' }} /> Carregando inventário...
    </div>
  );

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">INVENTÁRIO DE ITENS</div>
          <div className="page-subtitle">
            {itens.length} item{itens.length!==1?'s':''} registrado{itens.length!==1?'s':''} · Valor total: {totalValor.toLocaleString('pt-BR')} aUEC
          </div>
        </div>
        <div style={{ display:'flex',gap:10 }}>
          <button onClick={loadData} style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',cursor:'pointer',fontSize:12 }}>
            <RefreshCw size={13}/>
          </button>
          {!showForm && !editItem && (
            <button onClick={()=>setShowForm(true)} style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 20px',background:'rgba(0,212,255,0.1)',border:'1px solid var(--border-normal)',borderRadius:8,color:'var(--accent-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:14,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',cursor:'pointer' }}>
              <Plus size={16}/> Registrar Item
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      {stats && !showForm && !editItem && (
        <div style={{ padding:'12px 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',flexShrink:0 }}>
          <div style={{ display:'flex',gap:12,overflowX:'auto',paddingBottom:4 }}>
            {/* Total */}
            <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'10px 16px',minWidth:120,flexShrink:0 }}>
              <div style={{ fontFamily:'Orbitron,monospace',fontSize:20,fontWeight:800,color:'var(--accent-primary)' }}>{stats.total}</div>
              <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600 }}>Total Itens</div>
            </div>
            {/* By system */}
            {(stats.bySys||[]).map(({system,count})=>(
              <div key={system} style={{ background:'var(--bg-card)',border:`1px solid ${SYSTEM_COLORS[system]||'var(--border-subtle)'}33`,borderRadius:8,padding:'10px 16px',minWidth:110,flexShrink:0 }}>
                <div style={{ fontFamily:'Orbitron,monospace',fontSize:20,fontWeight:800,color:SYSTEM_COLORS[system]||'var(--text-primary)' }}>{count}</div>
                <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600 }}>{system}</div>
              </div>
            ))}
            {/* Contrabando */}
            {stats.contraband > 0 && (
              <div style={{ background:'rgba(231,76,60,0.06)',border:'1px solid rgba(231,76,60,0.3)',borderRadius:8,padding:'10px 16px',minWidth:110,flexShrink:0 }}>
                <div style={{ fontFamily:'Orbitron,monospace',fontSize:20,fontWeight:800,color:'#e74c3c' }}>{stats.contraband}</div>
                <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600 }}>⚠️ Contrabando</div>
              </div>
            )}
            {/* Valor */}
            <div style={{ background:'var(--bg-card)',border:'1px solid rgba(255,196,54,0.2)',borderRadius:8,padding:'10px 16px',minWidth:160,flexShrink:0,marginLeft:'auto' }}>
              <div style={{ fontFamily:'Orbitron,monospace',fontSize:16,fontWeight:800,color:'var(--accent-gold)' }}>{(stats.totalValor||0).toLocaleString('pt-BR')}</div>
              <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600 }}>Valor Total (aUEC)</div>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {(showForm || editItem) && (
        <div style={{ flexShrink:0,overflowY:'auto',maxHeight:'80vh',padding:'16px 32px' }}>
          <ItemForm
            initial={editItem}
            onSave={handleSave}
            onCancelar={()=>{ setShowForm(false); setEditItem(null); }}
          />
        </div>
      )}

      {/* Filters */}
      {!showForm && !editItem && (
        <div style={{ padding:'10px 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',flexShrink:0 }}>
          <div style={{ display:'flex',gap:10,flexWrap:'wrap',alignItems:'center' }}>
            {/* Search */}
            <div style={{ position:'relative',flex:'1 1 220px',minWidth:180 }}>
              <Search size={13} style={{ position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }}/>
              <input className="search-input" style={{ paddingLeft:32,width:'100%' }}
                placeholder="Buscar item, local, fabricante..."
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            {/* Sistema filter */}
            <select className="filter-select" value={filterSys} onChange={e=>setFilterSys(e.target.value)}>
              <option value="all">Todos os Sistemas</option>
              {SYSTEMS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            {/* Categoria filter */}
            <select className="filter-select" value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
              <option value="all">Todas Categorias</option>
              {catList.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            {/* Contrabando filter */}
            <select className="filter-select" value={filterCon} onChange={e=>setFilterCon(e.target.value)}>
              <option value="all">Legal + Contrabando</option>
              <option value="legal">Somente Legal</option>
              <option value="contraband">⚠️ Somente Contrabando</option>
            </select>
            {/* Ordenar */}
            <select className="filter-select" value={sortBy} onChange={e=>setOrdenarBy(e.target.value)}>
              <option value="name">Nome (A-Z)</option>
              <option value="value">Valor (maior)</option>
              <option value="qty">Quantidade (maior)</option>
              <option value="location">Localização</option>
              <option value="category">Categoria</option>
              <option value="system">Sistema</option>
            </select>
            {/* Grupo */}
            <select className="filter-select" value={groupBy} onChange={e=>setGroupBy(e.target.value)}>
              <option value="none">Sem Agrupamento</option>
              <option value="system">Agrupar por Sistema</option>
              <option value="category">Agrupar por Categoria</option>
              <option value="location">Agrupar por Local</option>
            </select>
          </div>
          <div className="results-info" style={{ marginTop:6 }}>
            Exibindo <span>{filtered.length}</span> de {itens.length} itens
            {totalValor>0 && <span style={{ marginLeft:12,color:'var(--accent-gold)' }}>≈ {totalValor.toLocaleString('pt-BR')} aUEC</span>}
          </div>
        </div>
      )}

      {/* Itens list */}
      {!showForm && !editItem && (
        <div className="page-body">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Package size={64} className="empty-state-icon"/>
              <div className="empty-state-title">INVENTÁRIO VAZIO</div>
              <div className="empty-state-text">
                {itens.length === 0
                  ? 'Clique em "Registrar Item" para começar a rastrear seus itens no verso.'
                  : 'Nenhum item encontrado com os filtros atuais.'}
              </div>
              {itens.length === 0 && (
                <button onClick={()=>setShowForm(true)} style={{ display:'flex',alignItems:'center',gap:8,padding:'12px 24px',background:'rgba(0,212,255,0.1)',border:'1px solid var(--border-normal)',borderRadius:8,color:'var(--accent-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:14,fontWeight:700,cursor:'pointer',letterSpacing:'0.08em',textTransform:'uppercase',marginTop:8 }}>
                  <Plus size={16}/> Registrar Primeiro Item
                </button>
              )}
            </div>
          ) : (
            <div>
              {grouped.map(({ label, itens: groupItens }) => (
                <div key={label||'all'}>
                  {label && (
                    <div className="section-divider" style={{ marginBottom:12 }}>
                      <span className="section-divider-label" style={{ color: SYSTEM_COLORS[label]||CATEGORY_COLORS[label]||'var(--text-secondary)', display:'flex',alignItems:'center',gap:8 }}>
                        {label}
                      </span>
                      <div className="section-divider-line"/>
                      <span className="section-divider-count">{groupItens.length} item{groupItens.length!==1?'s':''}</span>
                    </div>
                  )}

                  <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:label?20:0 }}>
                    {groupItens.map(item => {
                      const isExpandired = expandedRows.has(item.id);
                      const catColor = CATEGORY_COLORS[item.category]||'var(--text-muted)';
                      const sysColor = SYSTEM_COLORS[item.system]||'var(--accent-primary)';

                      return (
                        <div key={item.id} style={{
                          background:'var(--bg-card)',
                          border:`1px solid ${item.is_contraband?'rgba(231,76,60,0.25)':'var(--border-subtle)'}`,
                          borderRadius:8,overflow:'hidden',transition:'all 0.2s',
                        }}>
                          {/* Main row */}
                          <div style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 14px',cursor:'pointer' }}
                            onClick={()=>toggleRow(item.id)}
                            onMouseEnter={e=>e.currentTarget.parentElement.style.borderColor=item.is_contraband?'rgba(231,76,60,0.5)':'var(--border-normal)'}
                            onMouseLeave={e=>e.currentTarget.parentElement.style.borderColor=item.is_contraband?'rgba(231,76,60,0.25)':'var(--border-subtle)'}
                          >
                            {/* Categoria dot */}
                            <div style={{ width:10,height:10,borderRadius:'50%',background:catColor,flexShrink:0,boxShadow:`0 0 6px ${catColor}66` }}/>

                            {/* Nome + details */}
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
                                <span style={{ fontFamily:'Rajdhani,sans-serif',fontSize:14,fontWeight:700,color:'var(--text-primary)' }}>{item.name}</span>
                                {item.is_contraband ? <span style={{ fontSize:9,color:'#e74c3c',fontWeight:700,background:'rgba(231,76,60,0.1)',border:'1px solid rgba(231,76,60,0.3)',padding:'1px 5px',borderRadius:3,letterSpacing:'0.08em' }}>⚠️ CONTRABAND</span> : null}
                                {item.size && <span style={{ fontSize:10,color:'var(--text-muted)',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3 }}>S{item.size}</span>}
                                {item.grade && <span style={{ fontSize:10,color:'var(--text-muted)',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3 }}>Grade {item.grade}</span>}
                              </div>
                              <div style={{ display:'flex',gap:12,marginTop:3,flexWrap:'wrap',alignItems:'center' }}>
                                <span style={{ fontSize:11,color:catColor,fontWeight:600 }}>{item.category}{item.subcategory?` · ${item.subcategory}`:''}</span>
                                <span style={{ fontSize:11,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:3 }}>
                                  <MapPin size={10} style={{ color:sysColor }}/>
                                  <span style={{ color:sysColor,fontWeight:600 }}>{item.system}</span>
                                  {' — '}{item.location_name}
                                  {item.container && <span style={{ color:'var(--text-muted)' }}> [{item.container}]</span>}
                                </span>
                              </div>
                            </div>

                            {/* Qty + value */}
                            <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3,flexShrink:0 }}>
                              <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:14,color:item.quantity>1?'var(--accent-primary)':'var(--text-secondary)',fontWeight:600 }}>
                                {item.quantity} {item.unit}
                              </span>
                              {item.value_auec>0 && (
                                <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--accent-gold)' }}>
                                  {(item.value_auec*item.quantity).toLocaleString('pt-BR')} aUEC
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div style={{ display:'flex',gap:6,flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                              <button onClick={()=>setEditItem(item)} style={{ width:28,height:28,borderRadius:5,border:'1px solid var(--border-normal)',background:'rgba(0,212,255,0.08)',color:'var(--accent-primary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                                <Edit3 size={12}/>
                              </button>
                              {deleteConfirm===item.id ? (
                                <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                                  <button onClick={()=>handleDelete(item.id)} style={{ padding:'4px 8px',background:'rgba(255,68,102,0.15)',border:'1px solid rgba(255,68,102,0.4)',borderRadius:4,color:'var(--accent-red)',cursor:'pointer',fontSize:11,fontWeight:700 }}>Sim</button>
                                  <button onClick={()=>setDeleteConfirm(null)} style={{ padding:'4px 8px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-secondary)',cursor:'pointer',fontSize:11 }}>Não</button>
                                </div>
                              ) : (
                                <button onClick={()=>setDeleteConfirm(item.id)} style={{ width:28,height:28,borderRadius:5,border:'1px solid rgba(255,68,102,0.2)',background:'rgba(255,68,102,0.08)',color:'var(--accent-red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                                  <Trash2 size={12}/>
                                </button>
                              )}
                              {isExpandired ? <ChevronUp size={14} style={{ color:'var(--text-muted)',alignSelf:'center' }}/> : <ChevronDown size={14} style={{ color:'var(--text-muted)',alignSelf:'center' }}/>}
                            </div>
                          </div>

                          {/* Expandired details */}
                          {isExpandired && (
                            <div style={{ padding:'12px 36px 14px',borderTop:'1px solid var(--border-subtle)',background:'rgba(0,0,0,0.15)',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12 }}>
                              {[
                                ['Fabricante', item.manufacturer||'—'],
                                ['Condição',   item.condition||'—'],
                                ['Tamanho',    item.size||'—'],
                                ['Grade',      item.grade||'—'],
                                ['Unidade',    `${item.quantity} ${item.unit}`],
                                ['Valor unit.', item.value_auec>0 ? `${item.value_auec.toLocaleString('pt-BR')} aUEC` : '—'],
                              ].map(([k,v])=>(
                                <div key={k}>
                                  <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2 }}>{k}</div>
                                  <div style={{ fontSize:13,color:'var(--text-secondary)' }}>{v}</div>
                                </div>
                              ))}
                              {item.notes && (
                                <div style={{ gridColumn:'1/-1' }}>
                                  <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2 }}>Observações</div>
                                  <div style={{ fontSize:13,color:'var(--text-secondary)',lineHeight:1.6 }}>{item.notes}</div>
                                </div>
                              )}
                              <div style={{ gridColumn:'1/-1',fontSize:10,color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace' }}>
                                Registrado em: {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '—'}
                                {item.updated_at && item.updated_at!==item.created_at && ` · Atualizado: ${new Date(item.updated_at).toLocaleString('pt-BR')}`}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
