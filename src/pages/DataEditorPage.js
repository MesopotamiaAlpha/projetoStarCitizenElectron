import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, Plus, Trash2, Save, RotateCcw,
  AlertTriangle, Check, ChevronDown, ChevronRight
} from 'lucide-react';

// ── All data is inlined here to avoid circular import issues ─────────────────
// This page manages its own copy of each dataset in localStorage

const PREFIX = 'sc_data_v2_';

// ── TRADE HUB ─────────────────────────────────────────────────────────────────
const DEFAULT_TRADE_COMMODITIES = [
  { name:'Quantainium', buyLocation:'Yela Asteroid Belt (mined)', buyPrice:3750, sellLocation:'CRU-L1 Ambitious Dream', sellPrice:7950, legal:true },
  { name:'Diamond', buyLocation:'microTech / Calliope', buyPrice:4900, sellLocation:'CRU-L1', sellPrice:7200, legal:true },
  { name:'Bexalite', buyLocation:'HUR-L3', buyPrice:3400, sellLocation:'Port Olisar', sellPrice:4800, legal:true },
  { name:'Taranite', buyLocation:'MIC-L1', buyPrice:4100, sellLocation:'Lorville', sellPrice:5800, legal:true },
  { name:'Gold', buyLocation:'Hurston / Aberdeen', buyPrice:3700, sellLocation:'CRU-L1', sellPrice:5400, legal:true },
  { name:'Tungsten', buyLocation:'HUR-L3', buyPrice:3100, sellLocation:'Area18', sellPrice:4600, legal:true },
  { name:'Laranite', buyLocation:'HUR-L5', buyPrice:2900, sellLocation:'CRU-L1', sellPrice:4200, legal:true },
  { name:'Dolivine', buyLocation:'HUR-L2', buyPrice:2100, sellLocation:'Lorville', sellPrice:3450, legal:true },
  { name:'Copper', buyLocation:'Daymar', buyPrice:2850, sellLocation:'Area18 - Dumper Depot', sellPrice:5530, legal:true },
  { name:'Hephaestanite', buyLocation:'HUR-L5', buyPrice:1700, sellLocation:'New Babbage', sellPrice:2650, legal:true },
  { name:'Aluminum', buyLocation:'Delamar / Levski', buyPrice:1500, sellLocation:'Lorville', sellPrice:3850, legal:true },
  { name:'Titanium', buyLocation:'Delamar', buyPrice:800, sellLocation:'CRU-L1', sellPrice:1140, legal:true },
  { name:'Scrap', buyLocation:'Grim HEX', buyPrice:1120, sellLocation:'Lorville - Dumper Depot', sellPrice:2350, legal:true },
  { name:'Agricultural Supplies', buyLocation:'Area18', buyPrice:1010, sellLocation:'Delamar - Levski', sellPrice:1380, legal:true },
  { name:'Medical Supplies', buyLocation:'Port Olisar', buyPrice:1069, sellLocation:'Delamar', sellPrice:1492, legal:true },
  { name:'Processed Food', buyLocation:'Area18', buyPrice:1410, sellLocation:'Delamar', sellPrice:1760, legal:true },
  { name:'Neon', buyLocation:'Grim HEX', buyPrice:8090, sellLocation:'Area18', sellPrice:14430, legal:false },
  { name:'WiDoW', buyLocation:'Grim HEX', buyPrice:11140, sellLocation:'Levski', sellPrice:15560, legal:false },
  { name:'Stims', buyLocation:'Grim HEX', buyPrice:3760, sellLocation:'Area18', sellPrice:4680, legal:false },
  { name:'Distilled Spirits', buyLocation:'Area18', buyPrice:5610, sellLocation:'Grim HEX', sellPrice:6980, legal:true },
  { name:'Hydrogen Fuel', buyLocation:'Port Olisar', buyPrice:83, sellLocation:'Levski', sellPrice:100, legal:true },
  { name:'Compboard', buyLocation:'Area18', buyPrice:100, sellLocation:'Delamar', sellPrice:157, legal:true },
];

// ── MINÉRIOS ──────────────────────────────────────────────────────────────────
const DEFAULT_MINING_ORES = [
  { name:'Quantainium', value:7950, rarity:'Rare', hazardous:true, locations:'Yela Belt, Aaron Halo, Cellin, Daymar', notes:'Instável — risco de explosão. Use laser em baixa potência.' },
  { name:'Diamond', value:7200, rarity:'Rare', hazardous:false, locations:'microTech, Calliope, Clio', notes:'Luas geladas de microTech. Difícil mas valioso.' },
  { name:'Bexalite', value:4800, rarity:'Rare', hazardous:false, locations:'Aberdeen, Daymar, Yela', notes:'Alta pureza. Prioridade após Quantainium.' },
  { name:'Taranite', value:5800, rarity:'Uncommon', hazardous:false, locations:'microTech, Calliope, Clio, Euterpe', notes:'Alta concentração nas luas de microTech.' },
  { name:'Gold', value:5400, rarity:'Uncommon', hazardous:false, locations:'Hurston, Aberdeen, Ita', notes:'Veios maiores que a média.' },
  { name:'Tungsten', value:4600, rarity:'Uncommon', hazardous:false, locations:'Hurston, Arial, Magda, Ita', notes:'Pesado — planeje a carga.' },
  { name:'Copper', value:5530, rarity:'Common', hazardous:false, locations:'Yela, Daymar, Aberdeen, Cellin', notes:'Bom para crafting e venda.' },
  { name:'Laranite', value:4200, rarity:'Uncommon', hazardous:false, locations:'Hurston, Arial, Ita, Magda', notes:'Abundante em Hurston.' },
  { name:'Hephaestanite', value:2650, rarity:'Uncommon', hazardous:false, locations:'Cellin, Daymar, Aberdeen', notes:'Frequente em veios mistos.' },
  { name:'Dolivine', value:3450, rarity:'Uncommon', hazardous:false, locations:'Daymar, Yela, Cellin', notes:'Bom para mineração superficial.' },
  { name:'Aluminum', value:3850, rarity:'Common', hazardous:false, locations:'Cellin, Daymar, Yela', notes:'Mineração rápida em campos rasos.' },
  { name:'Titanium', value:1140, rarity:'Common', hazardous:false, locations:'Daymar, Aberdeen, Yela, Cellin', notes:'Essencial para crafting.' },
  { name:'Corundum', value:1450, rarity:'Common', hazardous:false, locations:'microTech, Calliope, Clio', notes:'Complemento quando buscando Taranite.' },
  { name:'Quartz', value:2960, rarity:'Common', hazardous:false, locations:'Daymar, Yela, Aberdeen', notes:'Encontrado em grandes veios cristalinos.' },
  { name:'Borase', value:3200, rarity:'Uncommon', hazardous:false, locations:'Arial, Ita, Aberdeen', notes:'Veios médios, boa pureza.' },
  { name:'Agricium', value:2800, rarity:'Uncommon', hazardous:false, locations:'Cellin, Daymar', notes:'Frequentemente junto com Dolivine.' },
  { name:'Iron', value:912, rarity:'Common', hazardous:false, locations:'Hurston, Aberdeen, Arial', notes:'Muito comum. Use como complemento.' },
  { name:'Inert Material', value:0, rarity:'Common', hazardous:false, locations:'Em toda parte', notes:'Necessário para crafting de munição.' },
];

// ── DPS SHIPS ─────────────────────────────────────────────────────────────────
const DEFAULT_DPS_SHIPS = [
  { name:'Arrow', hull:1820, shields:900, cargo:0, crew:1, s1:2, s2:2, s3:0, s4:0 },
  { name:'Avenger Titan', hull:2600, shields:1200, cargo:8, crew:1, s1:2, s2:1, s3:0, s4:0 },
  { name:'Buccaneer', hull:2200, shields:1100, cargo:0, crew:1, s1:2, s2:2, s3:1, s4:0 },
  { name:'Cutlass Black', hull:3600, shields:2100, cargo:46, crew:1, s1:0, s2:4, s3:0, s4:0 },
  { name:'Eclipse', hull:2200, shields:1400, cargo:0, crew:1, s1:0, s2:0, s3:3, s4:0 },
  { name:'F7C Hornet', hull:2200, shields:1300, cargo:4, crew:1, s1:2, s2:2, s3:1, s4:0 },
  { name:'F7C-M Super Hornet', hull:2600, shields:1600, cargo:2, crew:2, s1:2, s2:2, s3:2, s4:0 },
  { name:'Freelancer', hull:4200, shields:2400, cargo:66, crew:2, s1:2, s2:0, s3:2, s4:0 },
  { name:'Gladius', hull:1600, shields:900, cargo:0, crew:1, s1:4, s2:0, s3:0, s4:0 },
  { name:'Hammerhead', hull:28000, shields:14000, cargo:0, crew:9, s1:0, s2:0, s3:0, s4:6 },
  { name:'Hurricane', hull:1900, shields:1100, cargo:0, crew:2, s1:0, s2:4, s3:2, s4:0 },
  { name:'Redeemer', hull:8500, shields:5200, cargo:6, crew:5, s1:0, s2:2, s3:2, s4:2 },
  { name:'Sabre', hull:1900, shields:1200, cargo:0, crew:1, s1:0, s2:4, s3:0, s4:0 },
  { name:'Scorpius', hull:4200, shields:2600, cargo:0, crew:2, s1:0, s2:4, s3:2, s4:0 },
  { name:'Constellation Andromeda', hull:8400, shields:4600, cargo:96, crew:4, s1:2, s2:4, s3:2, s4:0 },
  { name:'Vanguard Warden', hull:7200, shields:4100, cargo:6, crew:2, s1:2, s2:0, s3:2, s4:0 },
  { name:'C2 Hercules', hull:26000, shields:0, cargo:696, crew:2, s1:0, s2:2, s3:2, s4:0 },
  { name:'MSR', hull:5000, shields:3200, cargo:114, crew:3, s1:2, s2:2, s3:2, s4:0 },
  { name:'Corsair', hull:5500, shields:3000, cargo:72, crew:4, s1:2, s2:4, s3:0, s4:0 },
];

// ── DPS WEAPONS ───────────────────────────────────────────────────────────────
const DEFAULT_DPS_WEAPONS = [
  { name:'CF-117 Badger (S1)', size:1, type:'Laser Repeater', dps:40.8, alpha:5.1, rof:8, range:1200, powerDraw:2.1 },
  { name:'M3A Laser Cannon (S1)', size:1, type:'Laser Cannon', dps:65.0, alpha:13.0, rof:5, range:1500, powerDraw:2.8 },
  { name:'Lightstrike V (S1)', size:1, type:'Laser Repeater', dps:44.0, alpha:5.5, rof:8, range:1100, powerDraw:2.0 },
  { name:'Attrition-3 (S1)', size:1, type:'Distortion Repeater', dps:38.0, alpha:4.8, rof:8, range:900, powerDraw:1.8 },
  { name:'CF-227 Badger (S2)', size:2, type:'Laser Repeater', dps:65.0, alpha:8.1, rof:8, range:1400, powerDraw:3.8 },
  { name:'M4A Laser Cannon (S2)', size:2, type:'Laser Cannon', dps:98.0, alpha:19.6, rof:5, range:1700, powerDraw:4.5 },
  { name:'Scorpion GT-215 (S2)', size:2, type:'Laser Cannon', dps:88.0, alpha:17.6, rof:5, range:1500, powerDraw:4.2 },
  { name:'Deadbolt III (S2)', size:2, type:'Laser Cannon', dps:102.0, alpha:20.4, rof:5, range:1600, powerDraw:4.8 },
  { name:'Attrition-5 (S2)', size:2, type:'Distortion Repeater', dps:60.0, alpha:7.5, rof:8, range:1000, powerDraw:3.2 },
  { name:'CF-337 Panther (S3)', size:3, type:'Laser Repeater', dps:102.0, alpha:12.8, rof:8, range:1600, powerDraw:6.5 },
  { name:'M5A Laser Cannon (S3)', size:3, type:'Laser Cannon', dps:148.0, alpha:29.6, rof:5, range:1900, powerDraw:7.2 },
  { name:'NN-15 Cannon (S3)', size:3, type:'Laser Cannon', dps:156.0, alpha:31.2, rof:5, range:2000, powerDraw:7.8 },
  { name:'Deadbolt V (S3)', size:3, type:'Laser Cannon', dps:160.0, alpha:32.0, rof:5, range:1900, powerDraw:8.0 },
  { name:'CF-447 Rhino (S4)', size:4, type:'Laser Repeater', dps:160.0, alpha:20.0, rof:8, range:1800, powerDraw:10.5 },
  { name:'M6A Laser Cannon (S4)', size:4, type:'Laser Cannon', dps:228.0, alpha:45.6, rof:5, range:2200, powerDraw:12.0 },
  { name:'Deadbolt VII (S4)', size:4, type:'Laser Cannon', dps:240.0, alpha:48.0, rof:5, range:2200, powerDraw:12.5 },
];

// ── CARGO SHIPS ───────────────────────────────────────────────────────────────
const DEFAULT_CARGO_SHIPS = [
  { name:'Avenger Titan', scu:8 }, { name:'Nomad', scu:16 }, { name:'Cutlass Black', scu:46 },
  { name:'Freelancer', scu:66 }, { name:'Freelancer MAX', scu:122 }, { name:'Constellation Andromeda', scu:96 },
  { name:'Constellation Taurus', scu:174 }, { name:'Hull A', scu:64 }, { name:'Hull B', scu:384 },
  { name:'Hull C', scu:4608 }, { name:'Caterpillar', scu:576 }, { name:'C2 Hercules', scu:696 },
  { name:'Ironclad', scu:1440 }, { name:'Merchantman', scu:3456 }, { name:'MSR', scu:114 },
  { name:'Corsair', scu:72 }, { name:'Galaxy', scu:1000 }, { name:'Prospector', scu:32 },
  { name:'MOLE', scu:96 }, { name:'Reclaimer', scu:120 },
];

// ── MINING LASERS ─────────────────────────────────────────────────────────────
const DEFAULT_MINING_LASERS = [
  { name:'Helix I', tier:'Entry', power:1500, range:25, extraction:1.0, instability:0.3, notes:'Básico. Bom para Quantainium.' },
  { name:'Lancet', tier:'Mid', power:2800, range:32, extraction:1.5, instability:0.2, notes:'Excelente para minérios médios.' },
  { name:'Impact I', tier:'Mid', power:3200, range:30, extraction:1.6, instability:0.3, notes:'Alta extração. Cuidado com Quantainium.' },
  { name:'Arbor MH1', tier:'Mid', power:2600, range:35, extraction:1.4, instability:0.15, notes:'Excelente estabilidade.' },
  { name:'Abrade', tier:'Advanced', power:4000, range:28, extraction:1.8, instability:0.4, notes:'Alta potência. Evite em Quantainium.' },
  { name:'Torrent III', tier:'Advanced', power:3800, range:30, extraction:2.0, instability:0.35, notes:'Máxima extração.' },
  { name:'Crush S3', tier:'Advanced', power:5000, range:25, extraction:2.2, instability:0.45, notes:'Para naves grandes.' },
];

// ── MARKET LOCATIONS ──────────────────────────────────────────────────────────
const DEFAULT_MARKET_LOCATIONS = [
  { name:'Area18', system:'Stanton', planet:'ArcCorp', type:'City', shops:'Cubby Blast, Trade & Development Division, Dumper Depot, Platinum Bay, CenterMass, Cousin Crows', medical:true, quantum:true, bar:true },
  { name:'Lorville', system:'Stanton', planet:'Hurston', type:'City', shops:'Tammany and Sons, Hurston Security Depot, Kastak Arms, Stor-All', medical:true, quantum:true, bar:true },
  { name:'New Babbage', system:'Stanton', planet:'microTech', type:'City', shops:'Garrity Defense, microTech Luxury, Stellar Cartography', medical:true, quantum:true, bar:true },
  { name:'Orison', system:'Stanton', planet:'Crusader', type:'City', shops:'Voyager Direct, Cousin Crows', medical:true, quantum:true, bar:true },
  { name:'Levski', system:'Nyx', planet:'Delamar', type:'Outlaw Station', shops:'Live Fire Weapons, Conscientious Objects, Apocalypse Arms, Trade Hub', medical:true, quantum:true, bar:true },
  { name:'Grim HEX', system:'Stanton', planet:'Yela (Orbit)', type:'Outlaw Station', shops:'Skutters, Reclamation & Salvage, CCRoC Shipping', medical:true, quantum:false, bar:true },
  { name:'ARC-L1 Wide Forest Station', system:'Stanton', planet:'ArcCorp L1', type:'Station', shops:'Armor Store, Commodity Store', medical:true, quantum:true, bar:false },
  { name:'HUR-L1 Green Glade Station', system:'Stanton', planet:'Hurston L1', type:'Station', shops:'Armor Store, Ship Components', medical:true, quantum:true, bar:false },
  { name:'Port Tressler', system:'Stanton', planet:'microTech Orbit', type:'Station', shops:'Cargo Deck Store, Ship Components', medical:true, quantum:true, bar:false },
  { name:'Everus Harbor', system:'Stanton', planet:'Hurston Orbit', type:'Station', shops:'Cargo Deck Store, Platinum Bay', medical:true, quantum:true, bar:false },
  { name:'Baijini Point', system:'Stanton', planet:'ArcCorp Orbit', type:'Station', shops:'Cargo Deck Store, Ship Components', medical:true, quantum:true, bar:false },
  { name:'Ruin Station', system:'Pyro', planet:'Pyro IV', type:'Outlaw Station', shops:'Pyro Market, Trade Hub', medical:true, quantum:true, bar:true },
  { name:'Checkmate', system:'Pyro', planet:'Nyx Gateway', type:'Station', shops:'Trade Hub', medical:true, quantum:true, bar:false },
  { name:'CRU-L5 Stash House', system:'Stanton', planet:'Crusader L5', type:'Outlaw Station', shops:'Black Market', medical:false, quantum:true, bar:false },
];

// ── Dataset registry ──────────────────────────────────────────────────────────
const ALL_DATASETS = [
  { key:'trade_commodities', label:'Commodities', group:'Trade Hub', defaults:DEFAULT_TRADE_COMMODITIES,
    fields:[{k:'name',t:'text'},{k:'buyLocation',t:'text'},{k:'buyPrice',t:'number'},{k:'sellLocation',t:'text'},{k:'sellPrice',t:'number'},{k:'legal',t:'boolean'}] },
  { key:'mining_ores', label:'Minérios', group:'Mineração', defaults:DEFAULT_MINING_ORES,
    fields:[{k:'name',t:'text'},{k:'value',t:'number'},{k:'rarity',t:'text'},{k:'hazardous',t:'boolean'},{k:'locations',t:'text'},{k:'notes',t:'text'}] },
  { key:'mining_lasers', label:'Lasers de Mineração', group:'Mineração', defaults:DEFAULT_MINING_LASERS,
    fields:[{k:'name',t:'text'},{k:'tier',t:'text'},{k:'power',t:'number'},{k:'range',t:'number'},{k:'extraction',t:'number'},{k:'instability',t:'number'},{k:'notes',t:'text'}] },
  { key:'dps_ships', label:'Naves', group:'Calculadora DPS', defaults:DEFAULT_DPS_SHIPS,
    fields:[{k:'name',t:'text'},{k:'hull',t:'number'},{k:'shields',t:'number'},{k:'cargo',t:'number'},{k:'crew',t:'number'},{k:'s1',t:'number'},{k:'s2',t:'number'},{k:'s3',t:'number'},{k:'s4',t:'number'}] },
  { key:'dps_weapons', label:'Armas', group:'Calculadora DPS', defaults:DEFAULT_DPS_WEAPONS,
    fields:[{k:'name',t:'text'},{k:'size',t:'number'},{k:'type',t:'text'},{k:'dps',t:'number'},{k:'alpha',t:'number'},{k:'rof',t:'number'},{k:'range',t:'number'},{k:'powerDraw',t:'number'}] },
  { key:'cargo_ships', label:'Naves & Capacidade', group:'Cargo Loader', defaults:DEFAULT_CARGO_SHIPS,
    fields:[{k:'name',t:'text'},{k:'scu',t:'number'}] },
  { key:'market_locations', label:'Locais & Lojas', group:'Market Finder', defaults:DEFAULT_MARKET_LOCATIONS,
    fields:[{k:'name',t:'text'},{k:'system',t:'text'},{k:'planet',t:'text'},{k:'type',t:'text'},{k:'shops',t:'text'},{k:'medical',t:'boolean'},{k:'quantum',t:'boolean'},{k:'bar',t:'boolean'}] },
];

const GROUPS_ORDER = ['Trade Hub','Mineração','Calculadora DPS','Cargo Loader','Market Finder'];

// ── Storage helpers ────────────────────────────────────────────────────────────
function storageLoad(key, fallback) {
  try { const r=localStorage.getItem(PREFIX+key); return r ? JSON.parse(r) : null; } catch { return null; }
}
function storageSave(key, data) { localStorage.setItem(PREFIX+key, JSON.stringify(data)); }
function storageReset(key) { localStorage.removeItem(PREFIX+key); }

// ── Cell editor ───────────────────────────────────────────────────────────────
function Cell({ value, type, onChange }) {
  const base = { background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:3,color:'var(--text-primary)',outline:'none',padding:'4px 6px',width:'100%',fontFamily:'Rajdhani,sans-serif',fontSize:12 };
  if (type==='boolean') {
    return <input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)} style={{ width:16,height:16,accentColor:'var(--accent-green)',cursor:'pointer' }}/>;
  }
  if (type==='number') {
    return <input type="number" style={{ ...base,fontFamily:'Share Tech Mono,monospace' }} value={value??0} onChange={e=>onChange(Number(e.target.value)||0)}/>;
  }
  return <input type="text" style={{ ...base,minWidth:80 }} value={value??''} onChange={e=>onChange(e.target.value)}/>;
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DataEditorPage() {
  const [activeKey, setActiveKey]   = useState(ALL_DATASETS[0].key);
  const [tableData, setTableData]   = useState(null); // null = not loaded yet
  const [savedKeys, setSavedKeys]   = useState(() => {
    return new Set(ALL_DATASETS.filter(d=>storageLoad(d.key,null)!==null).map(d=>d.key));
  });
  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saved' | 'reset'
  const [expandGroups, setExpandGroups] = useState(() => {
    const s={};GROUPS_ORDER.forEach(g=>s[g]=true);return s;
  });

  const dataset = ALL_DATASETS.find(d=>d.key===activeKey) || ALL_DATASETS[0];

  // Load data when active key changes
  useEffect(() => {
    const stored = storageLoad(activeKey, null);
    setTableData(stored || dataset.defaults.map(r=>({...r})));
    setSaveStatus('');
  }, [activeKey]);

  function handleCellChange(rowIdx, field, value) {
    setTableData(prev => prev.map((row,i) => i===rowIdx ? {...row,[field]:value} : row));
    setSaveStatus('');
  }

  function handleAddRow() {
    const blank = {};
    dataset.fields.forEach(f => {
      blank[f.k] = f.t==='number' ? 0 : f.t==='boolean' ? false : '';
    });
    setTableData(prev => [...prev, blank]);
    setSaveStatus('');
  }

  function handleDeleteRow(idx) {
    setTableData(prev => prev.filter((_,i)=>i!==idx));
    setSaveStatus('');
  }

  function handleSave() {
    storageSave(activeKey, tableData);
    setSavedKeys(prev => new Set(prev).add(activeKey));
    setSaveStatus('saved');
    // Dispatch custom event so other pages can pick up changes
    window.dispatchEvent(new CustomEvent('sc_data_updated', { detail:{ key:activeKey } }));
    setTimeout(()=>setSaveStatus(''), 2000);
  }

  function handleReset() {
    storageReset(activeKey);
    setSavedKeys(prev => { const n=new Set(prev); n.delete(activeKey); return n; });
    setTableData(dataset.defaults.map(r=>({...r})));
    setSaveStatus('reset');
    window.dispatchEvent(new CustomEvent('sc_data_updated', { detail:{ key:activeKey } }));
    setTimeout(()=>setSaveStatus(''), 2000);
  }

  function handleMoveRow(idx, dir) {
    const newIdx = idx+dir;
    if (newIdx<0 || newIdx>=tableData.length) return;
    const arr=[...tableData];
    [arr[idx],arr[newIdx]]=[arr[newIdx],arr[idx]];
    setTableData(arr);
  }

  const groupedDatasets = GROUPS_ORDER.map(g => ({
    group:g,
    items:ALL_DATASETS.filter(d=>d.group===g),
  }));

  const isModified = savedKeys.has(activeKey);

  return (
    <div style={{ display:'flex',height:'100%',overflow:'hidden',flexDirection:'column' }}>
      {/* Header */}
      <div className="page-header" style={{ flexShrink:0 }}>
        <div>
          <div className="page-title">EDITOR DE DADOS</div>
          <div className="page-subtitle">Edite qualquer Info usada pelas ferramentas — preços, locais, armas, naves e mais</div>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          {isModified && (
            <button onClick={handleReset} style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:saveStatus==='reset'?'var(--accent-green)':'var(--text-secondary)',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase',transition:'all 0.2s' }}>
              <RotateCcw size={13}/>
              {saveStatus==='reset'?'Restaurado!':'Restaurar Padrão'}
            </button>
          )}
          <button onClick={handleSave} disabled={!tableData} style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 18px',background:'rgba(0,229,160,0.12)',border:'1px solid rgba(0,229,160,0.35)',borderRadius:6,color:saveStatus==='saved'?'var(--accent-green)':'var(--accent-green)',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase',opacity:tableData?1:0.5,transition:'all 0.2s' }}>
            {saveStatus==='saved'?<Check size={13}/>:<Save size={13}/>}
            {saveStatus==='saved'?'Salvo!':'Salvar Alterações'}
          </button>
        </div>
      </div>

      <div style={{ display:'flex',flex:1,overflow:'hidden' }}>
        {/* ── Sidebar ── */}
        <div style={{ width:220,borderRight:'1px solid var(--border-subtle)',overflowY:'auto',padding:'12px 8px',flexShrink:0,background:'var(--bg-panel)' }}>
          <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',padding:'0 6px',marginBottom:10 }}>Selecione o dataset</div>
          {groupedDatasets.map(({group,items})=>(
            <div key={group} style={{ marginBottom:8 }}>
              <button onClick={()=>setExpandGroups(p=>({...p,[group]:!p[group]}))} style={{ display:'flex',alignItems:'center',gap:6,width:'100%',background:'none',border:'none',cursor:'pointer',padding:'6px 6px',color:'var(--text-muted)',fontFamily:'Rajdhani,sans-serif',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em' }}>
                {expandGroups[group]?<ChevronDown size={11}/>:<ChevronRight size={11}/>}
                {group}
              </button>
              {expandGroups[group] && items.map(d=>(
                <button key={d.key} onClick={()=>setActiveKey(d.key)} style={{
                  display:'flex',alignItems:'center',justifyContent:'space-between',
                  width:'100%',textAlign:'left',padding:'7px 10px 7px 22px',marginBottom:2,
                  borderRadius:6,cursor:'pointer',background:activeKey===d.key?'rgba(0,212,255,0.1)':'transparent',
                  border:`1px solid ${activeKey===d.key?'var(--border-normal)':'transparent'}`,
                  color:activeKey===d.key?'var(--accent-primary)':'var(--text-secondary)',
                  fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:activeKey===d.key?700:400,
                  transition:'all 0.15s',
                }}>
                  <span>{d.label}</span>
                  <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                    {savedKeys.has(d.key) && <span title="Personalizado" style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent-gold)',display:'inline-block' }}/>}
                    <span style={{ fontSize:10,color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace' }}>{(storageLoad(d.key,null)||d.defaults).length}</span>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* ── Table editor ── */}
        <div style={{ flex:1,overflowY:'auto',padding:'16px 20px' }}>
          {/* Dataset info bar */}
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
            <div>
              <span style={{ fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.05em' }}>{dataset.label}</span>
              <span style={{ marginLeft:10,fontSize:11,color:'var(--text-muted)' }}>{dataset.group}</span>
              {isModified && <span style={{ marginLeft:10,fontSize:10,color:'var(--accent-gold)',background:'rgba(255,196,54,0.1)',border:'1px solid rgba(255,196,54,0.25)',borderRadius:3,padding:'1px 7px',fontWeight:700 }}>● PERSONALIZADO</span>}
            </div>
            {tableData && (
              <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-muted)' }}>{tableData.length} linhas · {dataset.fields.length} colunas</span>
            )}
          </div>

          <div style={{ fontSize:12,color:'var(--text-muted)',background:'rgba(0,119,255,0.05)',border:'1px solid rgba(0,119,255,0.12)',borderRadius:6,padding:'8px 12px',marginBottom:14,display:'flex',alignItems:'center',gap:8 }}>
            <AlertTriangle size={13} style={{ color:'var(--accent-primary)',flexShrink:0 }}/>
            Edite qualquer célula, adicione ou remova linhas e clique em <strong style={{ color:'var(--accent-green)' }}>Salvar Alterações</strong>. As mudanças serão aplicadas imediatamente na ferramenta correspondente. <strong style={{ color:'var(--accent-gold)' }}>Restaurar Padrão</strong> volta aos valores originais do jogo.
          </div>

          {!tableData ? (
            <div style={{ textAlign:'center',padding:60,color:'var(--text-muted)' }}>Carregando...</div>
          ) : (
            <>
              {/* Table */}
              <div style={{ overflowX:'auto',border:'1px solid var(--border-subtle)',borderRadius:8,marginBottom:10 }}>
                <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'var(--bg-panel)',position:'sticky',top:0,zIndex:1 }}>
                      <th style={{ padding:'8px 6px',borderBottom:'1px solid var(--border-subtle)',width:60,fontSize:10,color:'var(--text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em' }}>AÇÕES</th>
                      {dataset.fields.map(f=>(
                        <th key={f.k} style={{ padding:'8px 10px',textAlign:'left',borderBottom:'1px solid var(--border-subtle)',color:'var(--accent-primary)',fontWeight:700,whiteSpace:'nowrap',fontFamily:'Rajdhani,sans-serif',fontSize:11,textTransform:'uppercase',letterSpacing:'0.06em',borderLeft:'1px solid var(--border-subtle)' }}>
                          {f.k}
                          <span style={{ marginLeft:4,fontSize:9,color:'var(--text-muted)',fontWeight:400,textTransform:'none',letterSpacing:0 }}>({f.t})</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row,rowIdx)=>(
                      <tr key={rowIdx} style={{ borderBottom:'1px solid var(--border-subtle)',background:rowIdx%2===0?'transparent':'rgba(255,255,255,0.015)' }}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(0,212,255,0.04)'}
                        onMouseLeave={e=>e.currentTarget.style.background=rowIdx%2===0?'transparent':'rgba(255,255,255,0.015)'}
                      >
                        <td style={{ padding:'4px 6px',textAlign:'center',verticalAlign:'middle' }}>
                          <div style={{ display:'flex',gap:3,justifyContent:'center' }}>
                            <button onClick={()=>handleMoveRow(rowIdx,-1)} disabled={rowIdx===0} title="Mover para cima" style={{ width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',borderRadius:3,color:'var(--text-muted)',cursor:rowIdx===0?'default':'pointer',opacity:rowIdx===0?0.3:1,fontSize:11 }}>↑</button>
                            <button onClick={()=>handleMoveRow(rowIdx,1)} disabled={rowIdx===tableData.length-1} title="Mover para baixo" style={{ width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',borderRadius:3,color:'var(--text-muted)',cursor:rowIdx===tableData.length-1?'default':'pointer',opacity:rowIdx===tableData.length-1?0.3:1,fontSize:11 }}>↓</button>
                            <button onClick={()=>handleDeleteRow(rowIdx)} title="Remover linha" style={{ width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:3,color:'var(--accent-red)',cursor:'pointer' }}>
                              <Trash2 size={10}/>
                            </button>
                          </div>
                        </td>
                        {dataset.fields.map(f=>(
                          <td key={f.k} style={{ padding:'4px 8px',verticalAlign:'middle',borderLeft:'1px solid var(--border-subtle)' }}>
                            <Cell value={row[f.k]} type={f.t} onChange={v=>handleCellChange(rowIdx,f.k,v)}/>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add row button */}
              <button onClick={handleAddRow} style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 18px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.25)',borderRadius:6,color:'var(--accent-green)',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase',letterSpacing:'0.08em' }}>
                <Plus size={14}/> Adicionar Nova Linha
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
