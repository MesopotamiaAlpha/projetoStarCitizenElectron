import React, { useState, useMemo, useCallback } from 'react';
import {
  Pickaxe, Plus, Trash2, Edit3, Save, X, Search,
  MapPin, Star, CheckCircle2, Package, FlaskConical,
  ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Archive,
  Gem, Layers, Minus, ArrowLeft, Camera, Download, Copy
} from 'lucide-react';
import { loadVault, saveVault, addOreEntry, removeOreEntry, deductOreEntry } from '../data/oreVault';
import { buildLocationFlatList } from '../data/uexLocationsDB';

// ── Lista completa de minérios do Star Citizen (atualizada SCMDB/SCMINER 2026) ──
const ORE_DATABASE = {
  // SHIP MINING (Prospector / MOLE / Orion)
  'Minério de Nave': {
    color: '#38bdf8',
    icon: '🚀',
    ores: [
      { name:'Agricium',     rarity:'uncommon',  notes:'Bom valor, luas de Crusader' },
      { name:'Aluminium',    rarity:'common',    notes:'Muito comum, baixo valor' },
      { name:'Aslarite',     rarity:'uncommon',  notes:'Pyro e Nyx' },
      { name:'Beryl',        rarity:'rare',      notes:'Alto valor, luas externas' },
      { name:'Bexalite',     rarity:'rare',      notes:'Alto valor, asteroid belts' },
      { name:'Borase',       rarity:'rare',      notes:'Luas de Hurston' },
      { name:'Copper',       rarity:'common',    notes:'Comum, Yela Belt' },
      { name:'Corundum',     rarity:'common',    notes:'Luas de microTech' },
      { name:'Gold',         rarity:'rare',      notes:'Hurston e luas' },
      { name:'Hephaestanite',rarity:'common',    notes:'Luas de Crusader' },
      { name:'Ice',          rarity:'common',    notes:'Luas geladas' },
      { name:'Iron',         rarity:'common',    notes:'Muito comum, baixo valor' },
      { name:'Laranite',     rarity:'uncommon',  notes:'Hurston, bom valor' },
      { name:'Lindinium',    rarity:'epic',      notes:'Raro, alto valor' },
      { name:'Ouratite',     rarity:'epic',      notes:'Muito raro' },
      { name:'Quantainium',  rarity:'legendary', notes:'⚠ INSTÁVEL! Mais valioso do jogo' },
      { name:'Quartz',       rarity:'common',    notes:'Comum, baixo valor' },
      { name:'Riccite',      rarity:'epic',      notes:'Raro, Pyro' },
      { name:'Savrilium',    rarity:'legendary', notes:'Extremamente raro' },
      { name:'Silicon',      rarity:'common',    notes:'Comum, subproduto' },
      { name:'Stileron',     rarity:'legendary', notes:'Extremamente raro' },
      { name:'Taranite',     rarity:'rare',      notes:'microTech, bom valor' },
      { name:'Tin',          rarity:'common',    notes:'Comum, baixo valor' },
      { name:'Titanium',     rarity:'uncommon',  notes:'Bom valor, luas rochosas' },
      { name:'Torite',       rarity:'uncommon',  notes:'Pyro' },
      { name:'Tungsten',     rarity:'uncommon',  notes:'Hurston, médio valor' },
    ],
  },
  // VEHICLE MINING (ROC)
  'Vehicle Mining': {
    color: '#fbbf24',
    icon: '🚗',
    ores: [
      { name:'Beradom',      rarity:'uncommon', notes:'ROC mining' },
      { name:'Carinite',     rarity:'common',   notes:'ROC mining, comum' },
      { name:'Feynmaline',   rarity:'rare',     notes:'ROC mining, raro' },
      { name:'Glacosite',    rarity:'uncommon', notes:'ROC mining, luas geladas' },
    ],
  },
  // FPS MINING (hand mining)
  'FPS Mining': {
    color: '#34d399',
    icon: '⛏️',
    ores: [
      { name:'Aphorite',     rarity:'rare',     notes:'Gema, alto valor, sem refino' },
      { name:'Carinite',     rarity:'common',   notes:'FPS mining, comum' },
      { name:'Carinite Pure',rarity:'rare',     notes:'Versão pura do Carinite' },
      { name:'Dolivine',     rarity:'rare',     notes:'Gema, sem refino necessário' },
      { name:'Hadanite',     rarity:'epic',     notes:'Gema mais valiosa do FPS mining' },
      { name:'Jaclium',      rarity:'uncommon', notes:'FPS mining' },
      { name:'Janalite',     rarity:'uncommon', notes:'FPS mining' },
      { name:'Sadaryx',      rarity:'rare',     notes:'FPS mining, raro' },
      { name:'Saldynium',    rarity:'rare',     notes:'FPS mining, raro' },
    ],
  },
  // PLANTAS / FLORES
  'Plants': {
    color: '#55efc4',
    icon: '🌿',
    ores: [
      { name:'Amiant',         rarity:'uncommon', notes:'Planta colhível' },
      { name:'Decari',         rarity:'uncommon', notes:'Planta colhível' },
      { name:'Degnous',        rarity:'uncommon', notes:'Planta colhível' },
      { name:'Flareweed',      rarity:'uncommon', notes:'Planta colhível' },
      { name:'Fotia',          rarity:'rare',     notes:'Planta colhível, rara' },
      { name:'Golden Medmon',  rarity:'rare',     notes:'Planta colhível preciosa' },
      { name:'Heart of the Woods',rarity:'epic',  notes:'Planta muito rara' },
      { name:'Pingala',        rarity:'uncommon', notes:'Planta colhível' },
      { name:'Pitambu',        rarity:'uncommon', notes:'Planta colhível' },
      { name:'Prota',          rarity:'uncommon', notes:'Planta colhível' },
      { name:'Revenant',       rarity:'rare',     notes:'Planta colhível rara' },
      { name:'Sunset Berry',   rarity:'uncommon', notes:'Planta colhível' },
      { name:'Wuotan',         rarity:'rare',     notes:'Planta colhível rara' },
    ],
  },
};

// Todas as categorias
const CATEGORIES = Object.keys(ORE_DATABASE);

// Todos os nomes de minérios (deduplicated)
const ALL_ORE_NAMES = [...new Set(
  Object.values(ORE_DATABASE).flatMap(cat => cat.ores.map(o => o.name))
)].sort();

// Qual categoria pertence um minério
function getOreCategory(name) {
  for (const [cat, data] of Object.entries(ORE_DATABASE)) {
    if (data.ores.some(o => o.name === name)) return cat;
  }
  return null;
}

// Info de um minério específico
function getOreInfo(name) {
  for (const data of Object.values(ORE_DATABASE)) {
    const ore = data.ores.find(o => o.name === name);
    if (ore) return ore;
  }
  return null;
}

const RARITY_COLORS = {
  common:'#7a90b0', uncommon:'#38bdf8', rare:'#fbbf24', epic:'#a29bfe', legendary:'#fb7185'
};

const ORE_COLORS = {
  'Titanium':'#74b9ff','Copper':'#fdcb6e','Orotite':'#a29bfe','Caranite':'#fd79a8',
  'Steel':'#b2bec3','Laranite':'#fd79a8','Taranite':'#74b9ff','Bexalite':'#a29bfe',
  'Quantainium':'#34d399','Gold':'#fbbf24','Diamond':'#dfe6e9','Tungsten':'#dfe6e9',
  'Aluminium':'#b2bec3','Iron':'#636e72','Inert Material':'#7a90b0','Aphorite':'#fdcb6e',
  'Dolivine':'#55efc4','Hadanite':'#ff7675','Agricium':'#00cec9','Borase':'#fd79a8',
  'Hephaestanite':'#e17055','Corundum':'#81ecec','Titanium':'#74b9ff','Lindinium':'#a29bfe',
  'Ouratite':'#ffeaa7','Riccite':'#ff7675','Savrilium':'#fb7185','Stileron':'#e84393',
  'Beryl':'#34d399','Silicon':'#b2bec3','Quartz':'#dfe6e9','Ice':'#81ecec',
  'Aslarite':'#74b9ff','Torite':'#fb923c','Tin':'#b2bec3','Mg Script':'#a29bfe',
  'Concuil Script':'#a29bfe',
};
function getOreColor(name) { return ORE_COLORS[name] || '#7a90b0'; }

const LOCATIONS_STATIC = [
  'Yela Asteroid Belt','Aaron Halo','Daymar','Cellin','Aberdeen','Arial',
  'Ita','Magda','Calliope','Clio','Euterpe','Hurston','microTech',
  'Port Tressler','ARC-L1','HUR-L3','HUR-L5','MIC-L1',
  'Pyro I','Pyro II','Pyro III','Pyro IV','Pyro V','Pyro VI',
  'Ruin Station','Levski (Nyx)','Delamar',
  'Hangar Pessoal','Nave Principal','Bunker Loot','Desmontagem','Outro',
];

const QUALITY_PRESETS = ['Grade A','Grade B','Grade C','Pristine','High','Medium','Low','Raw'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function ptNum(v) { return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:3}); }
function ptDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
}

// ── Modal de confirmação de duplicata ─────────────────────────────────────────
function DuplicateModal({ existing, newEntry, onMerge, onNew, onCancel }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div style={{background:'var(--bg-card)',border:'1px solid rgba(255,200,0,0.4)',borderRadius:12,padding:22,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(0,0,0,0.7)'}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:6}}>
          <AlertTriangle size={16} style={{color:'var(--accent-gold)'}}/>
          <span style={{fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:700,color:'var(--accent-gold)',letterSpacing:'0.06em'}}>MINÉRIO DUPLICADO DETECTADO</span>
        </div>
        <div style={{fontSize:11,color:'var(--text-secondary)',marginBottom:16,lineHeight:1.6}}>
          Você já tem <strong style={{color:'var(--text-primary)'}}>{existing.ore_name}</strong>
          {existing.quality ? <span> com qualidade <strong style={{color:'var(--accent-gold)'}}>{existing.quality}</strong></span> : ''} registrado
          ({ptNum(existing.quantity)} {existing.unit} em {existing.location||'—'}).
          <br/>O que deseja fazer?
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <div style={{padding:'10px',background:'rgba(52,211,153,0.06)',border:'1px solid rgba(52,211,153,0.2)',borderRadius:7}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--accent-green)',textTransform:'uppercase',marginBottom:5}}>Somar ao existente</div>
            <div style={{fontSize:12,color:'var(--text-secondary)'}}>
              {ptNum(existing.quantity)} + {ptNum(newEntry.quantity)} = <strong style={{color:'var(--accent-green)'}}>{ptNum(existing.quantity + newEntry.quantity)} {existing.unit}</strong>
            </div>
          </div>
          <div style={{padding:'10px',background:'rgba(56,189,248,0.06)',border:'1px solid rgba(56,189,248,0.2)',borderRadius:7}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--accent-primary)',textTransform:'uppercase',marginBottom:5}}>Novo registro separado</div>
            <div style={{fontSize:12,color:'var(--text-secondary)'}}>
              Cria entrada independente com {ptNum(newEntry.quantity)} {newEntry.unit}
            </div>
          </div>
        </div>

        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={onCancel} style={{padding:'7px 14px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',fontFamily:'"Exo 2",sans-serif',fontSize:11,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>Cancelar</button>
          <button onClick={onNew} style={{padding:'7px 14px',background:'rgba(56,189,248,0.1)',border:'1px solid rgba(56,189,248,0.3)',borderRadius:6,color:'var(--accent-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:11,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>Novo Separado</button>
          <button onClick={onMerge} style={{display:'flex',alignItems:'center',gap:5,padding:'7px 14px',background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:6,color:'var(--accent-green)',fontFamily:'"Exo 2",sans-serif',fontSize:11,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>
            <Plus size={11}/> Somar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── OreForm ───────────────────────────────────────────────────────────────────
function OreForm({ initial, onSave, onCancel, preselectedOre }) {
  const empty = { id:null, ore_name:preselectedOre||'', quantity:'', unit:'un', quality:'', location:'', refined:false, notes:'' };
  const [d, setD] = useState(() => initial ? {...initial, quantity:String(initial.quantity||'')} : empty);
  const [showQP, setShowQP] = useState(false);
  const [error, setError]   = useState('');
  const set = (k,v) => setD(p=>({...p,[k]:v}));

  const oreInfo = getOreInfo(d.ore_name);
  const oreCat  = getOreCategory(d.ore_name);
  const LOCATIONS = useMemo(() => buildLocationFlatList(LOCATIONS_STATIC), []);

  const IS = {width:'100%',padding:'8px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:13,outline:'none'};
  const SS = {...IS,appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 7px center',paddingRight:26};
  const LS = {fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4};

  function handleSave() {
    if (!d.ore_name.trim()) { setError('Nome do minério obrigatório.'); return; }
    const qty = parseFloat(String(d.quantity).replace(',','.'));
    if (!qty || qty <= 0) { setError('Quantidade deve ser maior que zero.'); return; }
    onSave({...d, ore_name:d.ore_name.trim(), quantity:qty});
  }

  return (
    <div style={{background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:10,padding:18,marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontFamily:'Michroma,sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.06em',display:'flex',alignItems:'center',gap:7}}>
          <Pickaxe size={15} style={{color:'var(--accent-primary)'}}/> {initial?.id?'EDITAR ENTRADA':'NOVO MINÉRIO NO BAÚ'}
        </div>
        <button onClick={onCancel} style={{background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'4px 8px'}}><X size={13}/></button>
      </div>

      {/* Info do minério selecionado */}
      {oreInfo && (
        <div style={{marginBottom:12,padding:'7px 12px',background:oreCat?`${ORE_DATABASE[oreCat].color}11`:'rgba(255,255,255,0.03)',border:`1px solid ${oreCat?ORE_DATABASE[oreCat].color+'33':'var(--border-subtle)'}`,borderRadius:6,fontSize:11,display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:14}}>{oreCat?ORE_DATABASE[oreCat].icon:''}</span>
          <div>
            <span style={{fontWeight:700,color:'var(--text-primary)'}}>{d.ore_name}</span>
            {oreInfo.rarity && <span style={{marginLeft:8,fontSize:9,padding:'1px 5px',borderRadius:3,background:`${RARITY_COLORS[oreInfo.rarity]}22`,color:RARITY_COLORS[oreInfo.rarity],fontWeight:700}}>{oreInfo.rarity.toUpperCase()}</span>}
            {oreInfo.notes && <div style={{color:'var(--text-muted)',marginTop:2}}>{oreInfo.notes}</div>}
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'2fr 120px 100px',gap:9,marginBottom:9}}>
        <div>
          <label style={LS}>Minério *</label>
          <input style={IS} list="ore-list-form" value={d.ore_name} onChange={e=>set('ore_name',e.target.value)} placeholder="ex: Caranite, Quantainium..."/>
          <datalist id="ore-list-form">{ALL_ORE_NAMES.map(o=><option key={o} value={o}/>)}</datalist>
        </div>
        <div>
          <label style={LS}>Quantidade *</label>
          <input style={IS} type="number" min="0.001" step="0.001" value={d.quantity} onChange={e=>set('quantity',e.target.value)} placeholder="ex: 16"/>
        </div>
        <div>
          <label style={LS}>Unidade</label>
          <select style={SS} value={d.unit} onChange={e=>set('unit',e.target.value)}>
            <option value="un">un</option>
            <option value="SCU">SCU</option>
            <option value="cSCU">cSCU</option>
            <option value="kg">kg</option>
          </select>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:9,marginBottom:9,alignItems:'end'}}>
        <div>
          <label style={LS}>Qualidade</label>
          <div style={{position:'relative'}}>
            <input style={IS} value={d.quality} onChange={e=>set('quality',e.target.value)}
              onFocus={()=>setShowQP(true)} onBlur={()=>setTimeout(()=>setShowQP(false),150)}
              placeholder="ex: Grade A, 94%, Pristine..."/>
            {showQP && (
              <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:6,zIndex:50,overflow:'hidden',boxShadow:'0 8px 20px rgba(0,0,0,0.4)'}}>
                {QUALITY_PRESETS.map(q=>(
                  <button key={q} onMouseDown={()=>set('quality',q)} style={{display:'block',width:'100%',textAlign:'left',padding:'6px 12px',background:'none',border:'none',borderBottom:'1px solid var(--border-subtle)',color:'var(--text-secondary)',cursor:'pointer',fontSize:12,fontFamily:'"Exo 2",sans-serif'}}>{q}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label style={LS}>Local onde guardou</label>
          <select style={SS} value={d.location} onChange={e=>set('location',e.target.value)}>
            <option value="">— Selecionar —</option>
            {LOCATIONS.map(l=><option key={l}>{l}</option>)}
          </select>
        </div>
        <button onClick={()=>set('refined',!d.refined)} style={{display:'flex',alignItems:'center',gap:7,padding:'8px 12px',background:d.refined?'rgba(52,211,153,0.1)':'transparent',border:`1px solid ${d.refined?'rgba(52,211,153,0.4)':'var(--border-subtle)'}`,borderRadius:5,color:d.refined?'var(--accent-green)':'var(--text-muted)',cursor:'pointer',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,textTransform:'uppercase',whiteSpace:'nowrap',marginBottom:2}}>
          <FlaskConical size={13}/>{d.refined?'Refinado ✓':'Refinado?'}
        </button>
      </div>

      <div style={{marginBottom:12}}>
        <label style={LS}>Notas</label>
        <textarea value={d.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Observações..."
          style={{width:'100%',minHeight:40,padding:'7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,outline:'none',resize:'vertical',boxSizing:'border-box'}}/>
      </div>

      {error && <div style={{color:'var(--accent-red)',fontSize:12,marginBottom:9,display:'flex',alignItems:'center',gap:6}}><AlertTriangle size={13}/>{error}</div>}

      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button onClick={onCancel} style={{padding:'8px 16px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>Cancelar</button>
        <button onClick={handleSave} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 18px',background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:6,color:'var(--accent-green)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>
          <Save size={13}/> {initial?.id?'Salvar':'Adicionar ao Baú'}
        </button>
      </div>
    </div>
  );
}

// ── OreCard com +/- inline ────────────────────────────────────────────────────
function OreCard({ entry, onEdit, onDelete, onAdjustQty }) {
  const [delConf,  setDelConf]  = useState(false);
  const [adjMode,  setAdjMode]  = useState(false);
  const [adjVal,   setAdjVal]   = useState('');
  const [adjType,  setAdjType]  = useState('add'); // add | sub
  const color   = getOreColor(entry.ore_name);
  const oreInfo = getOreInfo(entry.ore_name);
  const oreCat  = getOreCategory(entry.ore_name);

  function applyAdj() {
    const n = parseFloat(adjVal);
    if (!n || n <= 0) return;
    const newQty = adjType==='add' ? entry.quantity+n : Math.max(0, entry.quantity-n);
    onAdjustQty(entry.id, newQty);
    setAdjMode(false); setAdjVal('');
  }

  return (
    <div style={{background:'var(--bg-card)',border:`1px solid ${color}33`,borderLeft:`3px solid ${color}`,borderRadius:8,padding:'11px 13px',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        {/* Dot de cor */}
        <div style={{width:32,height:32,borderRadius:'50%',background:`${color}22`,border:`1px solid ${color}44`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14}}>
          {oreCat ? ORE_DATABASE[oreCat]?.icon : '⛏'}
        </div>
        {/* Info */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:2}}>
            <span style={{fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,color}}>{entry.ore_name}</span>
            {entry.refined && <span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:'rgba(52,211,153,0.1)',color:'var(--accent-green)',border:'1px solid rgba(52,211,153,0.25)',fontWeight:700}}>REFINADO</span>}
            {entry.quality && <span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:'rgba(255,200,0,0.1)',color:'var(--accent-gold)',border:'1px solid rgba(255,200,0,0.25)',fontWeight:700}}>★ {entry.quality}</span>}
            {oreInfo?.rarity && <span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:`${RARITY_COLORS[oreInfo.rarity]}18`,color:RARITY_COLORS[oreInfo.rarity],fontWeight:700}}>{oreInfo.rarity}</span>}
          </div>
          <div style={{display:'flex',gap:10,fontSize:10,color:'var(--text-muted)',flexWrap:'wrap'}}>
            {entry.location && <span style={{display:'flex',alignItems:'center',gap:3}}><MapPin size={9}/>{entry.location}</span>}
            <span style={{color:'var(--text-secondary)',fontFamily:'Share Tech Mono,monospace'}}>{ptDate(entry.created_at)}</span>
            {entry.notes && <span style={{fontStyle:'italic'}}>{entry.notes}</span>}
          </div>
        </div>
        {/* Quantidade */}
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{fontFamily:'Michroma,sans-serif',fontSize:18,fontWeight:800,color,lineHeight:1}}>{ptNum(entry.quantity)}</div>
          <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{entry.unit}</div>
        </div>
        {/* Ações */}
        <div style={{display:'flex',gap:4,flexShrink:0}}>
          {/* +/- toggle */}
          <button onClick={()=>{setAdjMode(!adjMode);setAdjVal('');}} title="Ajustar quantidade"
            style={{width:26,height:26,borderRadius:4,border:`1px solid ${adjMode?'rgba(56,189,248,0.4)':'var(--border-normal)'}`,background:adjMode?'rgba(56,189,248,0.1)':'rgba(255,255,255,0.03)',color:adjMode?'var(--accent-primary)':'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700}}>
            ±
          </button>
          <button onClick={()=>onEdit(entry)} style={{width:26,height:26,borderRadius:4,border:'1px solid var(--border-normal)',background:'rgba(56,189,248,0.06)',color:'var(--accent-primary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Edit3 size={11}/>
          </button>
          {delConf ? (
            <div style={{display:'flex',gap:3,alignItems:'center'}}>
              <button onClick={()=>onDelete(entry.id)} style={{padding:'2px 6px',background:'rgba(251,113,133,0.15)',border:'1px solid rgba(251,113,133,0.4)',borderRadius:3,color:'var(--accent-red)',cursor:'pointer',fontSize:10,fontWeight:700}}>Sim</button>
              <button onClick={()=>setDelConf(false)} style={{padding:'2px 6px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:3,color:'var(--text-secondary)',cursor:'pointer',fontSize:10}}>Não</button>
            </div>
          ) : (
            <button onClick={()=>setDelConf(true)} style={{width:26,height:26,borderRadius:4,border:'1px solid rgba(251,113,133,0.2)',background:'rgba(251,113,133,0.06)',color:'var(--accent-red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Trash2 size={11}/>
            </button>
          )}
        </div>
      </div>

      {/* Painel de ajuste inline */}
      {adjMode && (
        <div style={{marginTop:8,padding:'8px 10px',background:'rgba(56,189,248,0.05)',border:'1px solid rgba(56,189,248,0.2)',borderRadius:6,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          {/* Toggle add/sub */}
          <div style={{display:'flex',borderRadius:5,overflow:'hidden',border:'1px solid var(--border-subtle)'}}>
            <button onClick={()=>setAdjType('add')} style={{padding:'4px 10px',background:adjType==='add'?'rgba(52,211,153,0.15)':'transparent',border:'none',borderRight:'1px solid var(--border-subtle)',color:adjType==='add'?'var(--accent-green)':'var(--text-muted)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'"Exo 2",sans-serif',textTransform:'uppercase'}}>
              + Adicionar
            </button>
            <button onClick={()=>setAdjType('sub')} style={{padding:'4px 10px',background:adjType==='sub'?'rgba(251,113,133,0.12)':'transparent',border:'none',color:adjType==='sub'?'var(--accent-red)':'var(--text-muted)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'"Exo 2",sans-serif',textTransform:'uppercase'}}>
              − Remover
            </button>
          </div>
          {/* Atalhos rápidos */}
          {[1,5,10,25,50].map(n=>(
            <button key={n} onClick={()=>onAdjustQty(entry.id, adjType==='add'?entry.quantity+n:Math.max(0,entry.quantity-n))}
              style={{padding:'3px 8px',background:adjType==='add'?'rgba(52,211,153,0.08)':'rgba(251,113,133,0.08)',border:`1px solid ${adjType==='add'?'rgba(52,211,153,0.2)':'rgba(251,113,133,0.2)'}`,borderRadius:4,color:adjType==='add'?'var(--accent-green)':'var(--accent-red)',cursor:'pointer',fontSize:11,fontFamily:'Share Tech Mono,monospace'}}>
              {adjType==='add'?'+':'-'}{n}
            </button>
          ))}
          {/* Input manual */}
          <input type="number" min="0.001" step="0.001" value={adjVal} onChange={e=>setAdjVal(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&applyAdj()}
            placeholder="Outro..."
            style={{width:80,padding:'4px 7px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-primary)',fontFamily:'Share Tech Mono,monospace',fontSize:12,outline:'none',textAlign:'center'}}/>
          <button onClick={applyAdj} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',background:adjType==='add'?'rgba(52,211,153,0.1)':'rgba(251,113,133,0.1)',border:`1px solid ${adjType==='add'?'rgba(52,211,153,0.3)':'rgba(251,113,133,0.3)'}`,borderRadius:4,color:adjType==='add'?'var(--accent-green)':'var(--accent-red)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'"Exo 2",sans-serif',textTransform:'uppercase'}}>
            <CheckCircle2 size={10}/> OK
          </button>
          <button onClick={()=>{setAdjMode(false);setAdjVal('');}} style={{width:24,height:24,background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <X size={10}/>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Geração de imagem do Baú (tabela em PNG para compartilhar) ───────────────
async function generateVaultImage(summary) {
  try { await document.fonts.ready; } catch { /* segue mesmo assim */ }

  // Agrupar por categoria de minério (mesma organização do baú)
  const grouped = CATEGORIES.map(cat => ({
    cat,
    color: ORE_DATABASE[cat].color,
    icon: ORE_DATABASE[cat].icon,
    items: summary.filter(s => getOreCategory(s.name) === cat).sort((a,b)=>b.total-a.total),
  })).filter(g => g.items.length > 0);

  const uncategorized = summary.filter(s => !getOreCategory(s.name));
  if (uncategorized.length) grouped.push({ cat:'Outros', color:'#7a90b0', icon:'📦', items:uncategorized });

  const WIDTH = 760;
  const PAD = 28;
  const ROW_H = 36;
  const SECTION_H = 32;
  const HEADER_H = 78;
  const FOOTER_H = 50;

  const totalRows = grouped.reduce((a,g)=>a+g.items.length,0);
  const height = HEADER_H + grouped.length*SECTION_H + totalRows*ROW_H + FOOTER_H + PAD;

  const canvas = document.createElement('canvas');
  const scale = 2; // retina, texto nítido
  canvas.width = WIDTH*scale;
  canvas.height = height*scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'top';

  // Fundo
  const bg = ctx.createLinearGradient(0,0,0,height);
  bg.addColorStop(0,'#0d1220'); bg.addColorStop(1,'#080b12');
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,WIDTH,height);
  ctx.strokeStyle = 'rgba(56,189,248,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5,0.5,WIDTH-1,height-1);

  let y = PAD;
  const totalTypes = summary.length;
  const totalEntradas = summary.reduce((a,s)=>a+s.entries,0);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '800 20px Michroma, sans-serif';
  ctx.fillText('⛏ BAÚ DE MINÉRIO', PAD, y);
  y += 27;
  ctx.fillStyle = '#7a90b0';
  ctx.font = '600 12px Exo 2, sans-serif';
  ctx.fillText(`${totalTypes} tipo${totalTypes!==1?'s':''} · ${totalEntradas} entrada${totalEntradas!==1?'s':''} · gerado em ${new Date().toLocaleString('pt-BR')}`, PAD, y);
  y += 22;
  ctx.strokeStyle = 'rgba(56,189,248,0.15)';
  ctx.beginPath(); ctx.moveTo(PAD,y); ctx.lineTo(WIDTH-PAD,y); ctx.stroke();
  y += 12;

  grouped.forEach(g => {
    ctx.fillStyle = `${g.color}18`;
    ctx.fillRect(PAD-10, y, WIDTH-2*(PAD-10), SECTION_H-6);
    ctx.fillStyle = g.color;
    ctx.font = '700 13px Michroma, sans-serif';
    ctx.fillText(`${g.icon}  ${g.cat.toUpperCase()}`, PAD, y+7);
    y += SECTION_H;

    g.items.forEach((it,i) => {
      if (i%2===1) {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(PAD-10, y, WIDTH-2*(PAD-10), ROW_H);
      }
      ctx.fillStyle = g.color;
      ctx.beginPath(); ctx.arc(PAD+2, y+ROW_H/2, 4, 0, Math.PI*2); ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#e8f0ff';
      ctx.font = '600 14px Exo 2, sans-serif';
      ctx.fillText(it.name, PAD+16, y+7);
      ctx.fillStyle = '#3d5070';
      ctx.font = '400 10px Exo 2, sans-serif';
      let sub = `${it.entries} entrada${it.entries!==1?'s':''}`;
      if (it.refined>0) sub += ` · ${it.refined} refinada${it.refined!==1?'s':''}`;
      ctx.fillText(sub, PAD+16, y+23);

      ctx.textAlign = 'right';
      ctx.fillStyle = g.color;
      ctx.font = '800 16px "Share Tech Mono", monospace';
      ctx.fillText(ptNum(it.total), WIDTH-PAD, y+6);
      ctx.fillStyle = '#7a90b0';
      ctx.font = '600 9px Exo 2, sans-serif';
      ctx.fillText((it.unit||'un').toUpperCase(), WIDTH-PAD, y+24);
      ctx.textAlign = 'left';

      y += ROW_H;
    });
  });

  y += 10;
  ctx.strokeStyle = 'rgba(56,189,248,0.15)';
  ctx.beginPath(); ctx.moveTo(PAD,y); ctx.lineTo(WIDTH-PAD,y); ctx.stroke();
  y += 14;
  ctx.fillStyle = '#3d5070';
  ctx.font = '600 10px Exo 2, sans-serif';
  ctx.fillText('Gerado por SC Toolbox — Star Citizen Companion App', PAD, y);

  return canvas.toDataURL('image/png');
}

// ── Modal de exportação de imagem ─────────────────────────────────────────────
function ImageExportModal({ dataUrl, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  async function handleCopy() {
    setCopyError('');
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]);
      setCopied(true);
      setTimeout(()=>setCopied(false), 2500);
    } catch (e) {
      setCopyError('Não foi possível copiar. Use "Baixar PNG" e envie o arquivo.');
    }
  }

  function handleDownload() {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `bau-minerio-${new Date().toISOString().slice(0,10)}.png`;
    a.click();
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:12,padding:20,maxWidth:540,width:'100%',maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.7)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div style={{fontFamily:'Michroma,sans-serif',fontSize:13,fontWeight:700,color:'var(--accent-gold)',display:'flex',alignItems:'center',gap:7}}>
            <Camera size={15}/> IMAGEM GERADA
          </div>
          <button onClick={onClose} style={{background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'4px 8px'}}><X size={13}/></button>
        </div>
        <div style={{overflowY:'auto',marginBottom:14,border:'1px solid var(--border-subtle)',borderRadius:8,background:'var(--bg-base)'}}>
          <img src={dataUrl} alt="Baú de Minério" style={{width:'100%',display:'block'}}/>
        </div>
        {copyError && <div style={{fontSize:11,color:'var(--accent-red)',marginBottom:8}}>{copyError}</div>}
        <div style={{display:'flex',gap:8}}>
          <button onClick={handleDownload} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'10px',background:'rgba(255,200,0,0.1)',border:'1px solid rgba(255,200,0,0.35)',borderRadius:7,color:'var(--accent-gold)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,textTransform:'uppercase',cursor:'pointer'}}>
            <Download size={13}/> Baixar PNG
          </button>
          <button onClick={handleCopy} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'10px',background:copied?'rgba(52,211,153,0.15)':'rgba(56,189,248,0.1)',border:`1px solid ${copied?'rgba(52,211,153,0.4)':'rgba(56,189,248,0.35)'}`,borderRadius:7,color:copied?'var(--accent-green)':'var(--accent-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,textTransform:'uppercase',cursor:'pointer'}}>
            {copied?<><CheckCircle2 size={13}/> Copiado!</>:<><Copy size={13}/> Copiar Imagem</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function OreVaultPage() {
  const [vault,       setVault]       = useState(() => loadVault());
  const [showForm,    setShowForm]    = useState(false);
  const [editEntry,   setEditEntry]   = useState(null);
  const [preOre,      setPreOre]      = useState(null); // pré-selecionar minério no form
  const [search,      setSearch]      = useState('');
  const [sortBy,      setSortBy]      = useState('date');
  // Navegação hierárquica
  const [selCategory, setSelCategory] = useState(null); // null = tela de categorias
  const [selOre,      setSelOre]      = useState(null); // null = tela de nomes de ore
  // Modal de duplicata
  const [dupData,     setDupData]     = useState(null); // { existing, newEntry }
  // Exportar imagem
  const [exportDataUrl, setExportDataUrl] = useState(null);
  const [generatingImg, setGeneratingImg] = useState(false);

  function refresh() { setVault(loadVault()); }

  // ── Ajuste de quantidade inline (sem reabrir form) ──
  function handleAdjustQty(id, newQty) {
    const v = loadVault();
    v.entries = v.entries.map(e => e.id===id ? {...e, quantity:newQty, updated_at:new Date().toISOString()} : e)
                         .filter(e => e.quantity > 0);
    saveVault(v);
    refresh();
  }

  // ── Salvar com verificação de duplicata ──
  function handleSave(entry) {
    if (!entry.id) {
      // Verificar duplicata: mesmo nome E mesma qualidade
      const v = loadVault();
      const dup = v.entries.find(e =>
        e.ore_name.toLowerCase() === entry.ore_name.toLowerCase() &&
        (e.quality||'').toLowerCase() === (entry.quality||'').toLowerCase() &&
        e.unit === entry.unit
      );
      if (dup) {
        setDupData({ existing: dup, newEntry: entry });
        return; // aguardar decisão no modal
      }
    }
    commitSave(entry);
  }

  function commitSave(entry) {
    addOreEntry(entry);
    refresh();
    setShowForm(false); setEditEntry(null); setPreOre(null);
  }

  function handleMerge() {
    if (!dupData) return;
    const merged = { ...dupData.existing, quantity: dupData.existing.quantity + dupData.newEntry.quantity, updated_at: new Date().toISOString() };
    addOreEntry(merged);
    refresh();
    setDupData(null); setShowForm(false); setEditEntry(null); setPreOre(null);
  }
  function handleNewSeparate() {
    commitSave(dupData.newEntry);
    setDupData(null);
  }

  function handleDelete(id) { removeOreEntry(id); refresh(); }

  async function handleGenerateImage() {
    setGeneratingImg(true);
    try {
      const dataUrl = await generateVaultImage(summary);
      setExportDataUrl(dataUrl);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar imagem: ' + e.message);
    } finally {
      setGeneratingImg(false);
    }
  }

  // ── Dados derivados ──
  const entries = useMemo(() => {
    let list = vault.entries || [];
    if (selCategory) {
      const oreNames = (ORE_DATABASE[selCategory]?.ores||[]).map(o=>o.name.toLowerCase());
      list = list.filter(e => oreNames.includes(e.ore_name.toLowerCase()));
    }
    if (selOre) {
      list = list.filter(e => e.ore_name.toLowerCase() === selOre.toLowerCase());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.ore_name.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q) || e.quality?.toLowerCase().includes(q));
    }
    if (sortBy==='name') list = [...list].sort((a,b)=>a.ore_name.localeCompare(b.ore_name));
    if (sortBy==='qty')  list = [...list].sort((a,b)=>b.quantity-a.quantity);
    if (sortBy==='date') list = [...list].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    return list;
  }, [vault, selCategory, selOre, search, sortBy]);

  // Resumo geral por nome (para painel esquerdo)
  const summary = useMemo(() => {
    const map = {};
    (vault.entries||[]).forEach(e => {
      if (!map[e.ore_name]) map[e.ore_name] = {name:e.ore_name, total:0, unit:e.unit, entries:0, refined:0};
      map[e.ore_name].total   += e.quantity||0;
      map[e.ore_name].entries += 1;
      if (e.refined) map[e.ore_name].refined++;
    });
    return Object.values(map).sort((a,b)=>b.total-a.total);
  }, [vault]);

  // Quantos itens por categoria
  const catCounts = useMemo(() => {
    const map = {};
    (vault.entries||[]).forEach(e => {
      const cat = getOreCategory(e.ore_name);
      if (cat) map[cat] = (map[cat]||0)+1;
    });
    return map;
  }, [vault]);

  // Nomes de ores dentro da categoria selecionada que têm entradas
  const oresInCategory = useMemo(() => {
    if (!selCategory) return [];
    const catOres = (ORE_DATABASE[selCategory]?.ores||[]).map(o=>o.name);
    const inVault = new Set((vault.entries||[]).map(e=>e.ore_name));
    // Mostrar todos da categoria, mas destacar os que têm entradas
    return catOres.map(name => ({
      name,
      hasEntries: inVault.has(name),
      count: (vault.entries||[]).filter(e=>e.ore_name===name).length,
      total: (vault.entries||[]).filter(e=>e.ore_name===name).reduce((a,e)=>a+(e.quantity||0),0),
      unit:  (vault.entries||[]).find(e=>e.ore_name===name)?.unit||'un',
      info:  getOreInfo(name),
    }));
  }, [selCategory, vault]);

  const totalEntries = (vault.entries||[]).length;
  const totalTypes   = summary.length;

  const SS = {padding:'5px 22px 5px 8px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 5px center'};

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>

      {/* Modal duplicata */}
      {dupData && <DuplicateModal existing={dupData.existing} newEntry={dupData.newEntry} onMerge={handleMerge} onNew={handleNewSeparate} onCancel={()=>setDupData(null)}/>}

      {/* Modal de imagem exportada */}
      {exportDataUrl && <ImageExportModal dataUrl={exportDataUrl} onClose={()=>setExportDataUrl(null)}/>}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{display:'flex',alignItems:'center',gap:10}}>
            <Archive size={20} style={{color:'var(--accent-gold)'}}/> BAÚ DE MINÉRIO
          </div>
          <div className="page-subtitle">
            {totalEntries} entrada{totalEntries!==1?'s':''} · {totalTypes} tipo{totalTypes!==1?'s':''} de minério armazenado{totalTypes!==1?'s':''}
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={handleGenerateImage} disabled={totalEntries===0||generatingImg} style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'rgba(56,189,248,0.08)',border:'1px solid rgba(56,189,248,0.3)',borderRadius:7,color:'var(--accent-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,textTransform:'uppercase',cursor:totalEntries===0?'not-allowed':'pointer',opacity:totalEntries===0?0.5:1}}>
            {generatingImg ? <><RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/> Gerando...</> : <><Camera size={14}/> Gerar Imagem</>}
          </button>
          <button onClick={()=>{setShowForm(true);setEditEntry(null);setPreOre(selOre||null);}} style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'rgba(255,200,0,0.1)',border:'1px solid rgba(255,200,0,0.35)',borderRadius:7,color:'var(--accent-gold)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,textTransform:'uppercase',cursor:'pointer'}}>
            <Plus size={14}/> Adicionar Minério
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'grid',gridTemplateColumns:'240px 1fr',overflow:'hidden'}}>

        {/* ── PAINEL ESQUERDO: Resumo total ── */}
        <div style={{borderRight:'1px solid var(--border-subtle)',overflowY:'auto',padding:12}}>
          <div style={{fontFamily:'Michroma,sans-serif',fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
            <Package size={11}/> Estoque Geral
          </div>
          {summary.length===0 ? (
            <div style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',padding:'20px 0'}}>Baú vazio</div>
          ) : (
            summary.map(s=>{
              const color = getOreColor(s.name);
              const isActive = selOre===s.name;
              return (
                <button key={s.name} onClick={()=>{
                  const cat = getOreCategory(s.name);
                  setSelCategory(cat);
                  setSelOre(s.name);
                  setSearch('');
                }} style={{width:'100%',textAlign:'left',display:'flex',alignItems:'center',gap:8,padding:'7px 9px',marginBottom:4,background:isActive?`${color}18`:'var(--bg-card)',border:`1px solid ${isActive?color+'55':''+color+'22'}`,borderLeft:`3px solid ${color}`,borderRadius:7,cursor:'pointer',transition:'all 0.15s'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:700,color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</div>
                    <div style={{fontSize:9,color:'var(--text-muted)'}}>{s.entries} entrada{s.entries!==1?'s':''}{s.refined>0?` · ${s.refined} ref.`:''}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:800,color}}>{ptNum(s.total)}</div>
                    <div style={{fontSize:9,color:'var(--text-muted)',textTransform:'uppercase'}}>{s.unit}</div>
                  </div>
                </button>
              );
            })
          )}
          {totalEntries>0 && (
            <div style={{marginTop:12,padding:'9px 11px',background:'rgba(99,102,241,0.05)',border:'1px solid rgba(99,102,241,0.12)',borderRadius:7}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--accent-primary)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4,display:'flex',alignItems:'center',gap:4}}>
                <FlaskConical size={10}/> Integração
              </div>
              <div style={{fontSize:10,color:'var(--text-secondary)',lineHeight:1.5}}>Material Tracker detecta automaticamente o que está no baú.</div>
            </div>
          )}
        </div>

        {/* ── PAINEL DIREITO: Navegação hierárquica ── */}
        <div style={{overflowY:'auto',padding:'12px 16px'}}>

          {/* Formulário */}
          {(showForm||editEntry) && (
            <OreForm initial={editEntry} preselectedOre={preOre} onSave={handleSave} onCancel={()=>{setShowForm(false);setEditEntry(null);setPreOre(null);}}/>
          )}

          {/* Breadcrumb */}
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:14,flexWrap:'wrap'}}>
            <button onClick={()=>{setSelCategory(null);setSelOre(null);setSearch('');}} style={{background:'none',border:'none',cursor:'pointer',color:selCategory?'var(--accent-primary)':'var(--text-primary)',fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:700,padding:0}}>
              🗃 Todos os Grupos
            </button>
            {selCategory && (
              <>
                <span style={{color:'var(--text-muted)'}}>›</span>
                <button onClick={()=>{setSelOre(null);setSearch('');}} style={{background:'none',border:'none',cursor:selOre?'pointer':'default',color:selOre?'var(--accent-primary)':'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,padding:0,display:'flex',alignItems:'center',gap:4}}>
                  <span>{ORE_DATABASE[selCategory].icon}</span>{selCategory}
                </button>
              </>
            )}
            {selOre && (
              <>
                <span style={{color:'var(--text-muted)'}}>›</span>
                <span style={{fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,color:getOreColor(selOre)}}>{selOre}</span>
              </>
            )}
            <span style={{marginLeft:'auto',fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-muted)'}}>{entries.length} entrada{entries.length!==1?'s':''}</span>
          </div>

          {/* NÍVEL 1 — Categorias */}
          {!selCategory && !search.trim() && (
            <div>
              <div style={{fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>
                Selecione um Grupo de Minério
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10,marginBottom:20}}>
                {CATEGORIES.map(cat=>{
                  const data = ORE_DATABASE[cat];
                  const count = catCounts[cat]||0;
                  const totalOres = data.ores.length;
                  return (
                    <button key={cat} onClick={()=>setSelCategory(cat)} style={{
                      textAlign:'left',padding:'16px 14px',
                      background:`linear-gradient(135deg, ${data.color}14, ${data.color}06)`,
                      border:`1px solid ${data.color}44`,borderRadius:10,cursor:'pointer',transition:'all 0.2s',
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 6px 20px ${data.color}22`;}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                      <div style={{fontSize:24,marginBottom:8}}>{data.icon}</div>
                      <div style={{fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:800,color:data.color,marginBottom:4,letterSpacing:'0.04em'}}>{cat}</div>
                      <div style={{fontFamily:'Share Tech Mono,monospace',fontSize:18,fontWeight:800,color:'var(--text-primary)',marginBottom:2}}>{count}</div>
                      <div style={{fontSize:10,color:'var(--text-muted)'}}>entrada{count!==1?'s':''} de {totalOres} tipos</div>
                    </button>
                  );
                })}
                {/* Ver tudo */}
                <button onClick={()=>setSelCategory('__all')} style={{
                  textAlign:'left',padding:'16px 14px',background:'rgba(255,255,255,0.02)',
                  border:'1px dashed var(--border-normal)',borderRadius:10,cursor:'pointer',transition:'all 0.2s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-primary)';e.currentTarget.style.background='rgba(56,189,248,0.04)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-normal)';e.currentTarget.style.background='rgba(255,255,255,0.02)';}}>
                  <Archive size={22} style={{color:'var(--text-muted)',marginBottom:8}}/>
                  <div style={{fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:700,color:'var(--text-muted)',marginBottom:4}}>VER TUDO</div>
                  <div style={{fontFamily:'Share Tech Mono,monospace',fontSize:18,fontWeight:800,color:'var(--text-primary)',marginBottom:2}}>{totalEntries}</div>
                  <div style={{fontSize:10,color:'var(--text-muted)'}}>todas as entradas</div>
                </button>
              </div>
            </div>
          )}

          {/* NÍVEL 2 — Nomes de ore dentro da categoria */}
          {selCategory && selCategory!=='__all' && !selOre && !search.trim() && (
            <div>
              <div style={{fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:700,color:ORE_DATABASE[selCategory]?.color,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>
                {ORE_DATABASE[selCategory].icon} Minérios em {selCategory}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:8,marginBottom:16}}>
                {oresInCategory.map(({name,hasEntries,count,total,unit,info})=>{
                  const color = getOreColor(name);
                  return (
                    <button key={name} onClick={()=>setSelOre(name)} style={{
                      textAlign:'left',padding:'12px 12px',
                      background:hasEntries?`${color}10`:'rgba(255,255,255,0.02)',
                      border:`1px solid ${hasEntries?color+'44':'var(--border-subtle)'}`,
                      borderLeft:`3px solid ${hasEntries?color:'var(--border-subtle)'}`,
                      borderRadius:8,cursor:'pointer',transition:'all 0.15s',
                      opacity:hasEntries?1:0.45,
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.opacity='1';e.currentTarget.style.borderColor=color+'88';}}
                    onMouseLeave={e=>{e.currentTarget.style.opacity=hasEntries?'1':'0.45';e.currentTarget.style.borderColor=hasEntries?color+'44':'var(--border-subtle)';}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                        <span style={{fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,color:hasEntries?color:'var(--text-muted)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
                        {info?.rarity && <span style={{fontSize:8,padding:'1px 4px',borderRadius:3,background:`${RARITY_COLORS[info.rarity]}18`,color:RARITY_COLORS[info.rarity],fontWeight:700,flexShrink:0}}>{info.rarity}</span>}
                      </div>
                      {hasEntries ? (
                        <div>
                          <div style={{fontFamily:'Michroma,sans-serif',fontSize:14,fontWeight:800,color,lineHeight:1}}>{ptNum(total)}</div>
                          <div style={{fontSize:9,color:'var(--text-muted)',textTransform:'uppercase'}}>{unit} · {count} entrada{count!==1?'s':''}</div>
                        </div>
                      ) : (
                        <div style={{fontSize:10,color:'var(--text-muted)',fontStyle:'italic'}}>sem estoque</div>
                      )}
                      {info?.notes && <div style={{fontSize:9,color:'var(--text-muted)',marginTop:4,lineHeight:1.3}}>{info.notes}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* NÍVEL 3 — Entradas do minério selecionado (ou ver tudo) */}
          {(selOre || selCategory==='__all' || search.trim()) && (
            <div>
              {/* Controles */}
              <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
                <div style={{position:'relative',flex:1,minWidth:160}}>
                  <Search size={11} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}}/>
                  <input style={{width:'100%',padding:'6px 10px 6px 26px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,outline:'none',boxSizing:'border-box'}}
                    placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
                </div>
                <select style={SS} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                  <option value="date">Mais recente</option>
                  <option value="name">Nome A-Z</option>
                  <option value="qty">Maior quantidade</option>
                </select>
              </div>

              {entries.length===0 ? (
                <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-muted)'}}>
                  <Archive size={40} style={{display:'block',margin:'0 auto 12px',opacity:0.15}}/>
                  <div style={{fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:700,marginBottom:6}}>SEM ENTRADAS</div>
                  <div style={{fontSize:11}}>Nenhum {selOre||'minério'} registrado. Clique em "Adicionar Minério".</div>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {entries.map(e=>(
                    <OreCard key={e.id} entry={e}
                      onEdit={entry=>{setEditEntry(entry);setShowForm(false);}}
                      onDelete={handleDelete}
                      onAdjustQty={handleAdjustQty}/>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Busca global — sem categoria selecionada */}
          {!selCategory && search.trim() && (
            <div>
              <div style={{fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>
                Resultados para "{search}"
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {entries.map(e=>(
                  <OreCard key={e.id} entry={e}
                    onEdit={entry=>{setEditEntry(entry);setShowForm(false);}}
                    onDelete={handleDelete}
                    onAdjustQty={handleAdjustQty}/>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}