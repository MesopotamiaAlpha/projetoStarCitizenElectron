import React, { useState, useMemo } from 'react';
import { Search, MapPin, TrendingUp, Package, Star } from 'lucide-react';
import { useDataset, DATASETS } from '../data/dataStore';

export const DEFAULT_MARKET_LOCATIONS = [
  {
    name: 'Area18', system: 'Stanton', planet: 'ArcCorp', type: 'City',
    shops: [
      { name: 'Cubby Blast', type: 'Weapons & Armor', sells: ['FPS Weapons', 'FPS Armor', 'Ammo', 'Undersuit'] },
      { name: 'Trade & Development Division', type: 'Commodities', sells: ['Agricultural Supplies', 'Medical Supplies', 'Processed Food', 'Hydrogen Fuel'] },
      { name: 'Dumper\'s Depot', type: 'Mining & Industry', sells: ['Mining Supplies', 'Industrial Parts', 'Scrap'] },
      { name: 'Vantage Rentals', type: 'Ship Rentals', sells: ['Ship Rentals'] },
      { name: 'Platinum Bay', type: 'Ship Components', sells: ['Ship Components', 'Weapons S1-S4'] },
      { name: 'Cousin Crows', type: 'Clothing', sells: ['Clothing', 'Accessories'] },
      { name: 'CenterMass', type: 'FPS Weapons', sells: ['FPS Weapons', 'Attachments'] },
    ],
    refinery: false, medical: true, quantum: true, bar: true
  },
  {
    name: 'Lorville', system: 'Stanton', planet: 'Hurston', type: 'City',
    shops: [
      { name: 'Tammany and Sons', type: 'Weapons & Armor', sells: ['FPS Weapons', 'FPS Armor', 'Ammo'] },
      { name: 'Hurston Security Depot', type: 'Security', sells: ['FPS Armor', 'Heavy Weapons', 'Military Gear'] },
      { name: 'Teasa Spaceport Trade', type: 'Commodities', sells: ['Agricultural Supplies', 'Medical Supplies'] },
      { name: 'Stor-All', type: 'Storage', sells: ['Ship Storage', 'Personal Storage'] },
      { name: 'Traveler\'s Rest', type: 'Food & Drink', sells: ['Food', 'Drinks', 'Stims'] },
      { name: 'Kastak Arms Dealer', type: 'FPS Weapons', sells: ['FPS Weapons', 'Attachments', 'Ammo'] },
    ],
    refinery: false, medical: true, quantum: true, bar: true
  },
  {
    name: 'New Babbage', system: 'Stanton', planet: 'microTech', type: 'City',
    shops: [
      { name: 'Garrity Defense', type: 'Weapons & Armor', sells: ['FPS Weapons', 'FPS Armor', 'Exploration Gear'] },
      { name: 'Stellar Cartography', type: 'Maps & Data', sells: ['Star Maps', 'Data Pads'] },
      { name: 'microTech Luxury', type: 'Premium Items', sells: ['Premium Armor', 'Exclusive Clothing'] },
      { name: 'Readers Corner', type: 'Books', sells: ['Books', 'Lore Items'] },
    ],
    refinery: false, medical: true, quantum: true, bar: true
  },
  {
    name: 'Orison', system: 'Stanton', planet: 'Crusader', type: 'City',
    shops: [
      { name: 'Voyager Direct', type: 'General', sells: ['General Goods', 'Food', 'Basic Armor'] },
      { name: 'Cousin Crows', type: 'Clothing', sells: ['Clothing', 'Accessories'] },
    ],
    refinery: false, medical: true, quantum: true, bar: true
  },
  {
    name: 'Levski', system: 'Nyx', planet: 'Delamar', type: 'Outlaw Station',
    shops: [
      { name: 'Live Fire Weapons', type: 'Weapons', sells: ['FPS Weapons', 'Ammo', 'Outlaw Gear'] },
      { name: 'Conscientious Objects', type: 'Clothing', sells: ['Outlaw Clothing', 'Accessories'] },
      { name: 'Apocalypse Arms', type: 'Weapons', sells: ['FPS Weapons', 'Ship Weapons', 'Heavy Gear'] },
      { name: 'Trade Hub', type: 'Commodities', sells: ['Contraband', 'Black Market Goods'] },
    ],
    refinery: false, medical: true, quantum: true, bar: true
  },
  {
    name: 'Grim HEX', system: 'Stanton', planet: 'Yela (Orbit)', type: 'Outlaw Station',
    shops: [
      { name: 'Skutters', type: 'Black Market', sells: ['Contraband', 'WiDoW', 'Neon', 'Stims'] },
      { name: 'Reclamation & Salvage', type: 'Salvage', sells: ['Salvage Parts', 'Scrap', 'Medical'] },
      { name: 'CCRoC Shipping', type: 'Shipping', sells: ['Cargo Services'] },
    ],
    refinery: false, medical: true, quantum: false, bar: true
  },
  {
    name: 'ARC-L1 Wide Forest Station', system: 'Stanton', planet: 'ArcCorp L1', type: 'Station',
    shops: [
      { name: 'Armor Store', type: 'Armor', sells: ['FPS Armor', 'Undersuit', 'EVA Gear'] },
      { name: 'Commodity Store', type: 'Commodities', sells: ['Hydrogen Fuel', 'Basic Supplies'] },
    ],
    refinery: false, medical: true, quantum: true, bar: false
  },
  {
    name: 'HUR-L1 Green Glade Station', system: 'Stanton', planet: 'Hurston L1', type: 'Station',
    shops: [
      { name: 'Armor Store', type: 'Armor', sells: ['FPS Armor', 'Military Gear'] },
      { name: 'Ship Components', type: 'Ship Parts', sells: ['Ship Components', 'Fuel'] },
    ],
    refinery: false, medical: true, quantum: true, bar: false
  },
  {
    name: 'Port Tressler', system: 'Stanton', planet: 'microTech Orbit', type: 'Station',
    shops: [
      { name: 'Cargo Deck Store', type: 'General', sells: ['FPS Armor', 'General Goods', 'Food'] },
      { name: 'Ship Components', type: 'Ship Parts', sells: ['Ship Components', 'QD Fuel'] },
    ],
    refinery: false, medical: true, quantum: true, bar: false
  },
  {
    name: 'Everus Harbor', system: 'Stanton', planet: 'Hurston Orbit', type: 'Station',
    shops: [
      { name: 'Cargo Deck Store', type: 'General', sells: ['FPS Armor', 'General Goods'] },
      { name: 'Platinum Bay', type: 'Ship Components', sells: ['Ship Components', 'Weapons'] },
    ],
    refinery: false, medical: true, quantum: true, bar: false
  },
  {
    name: 'Baijini Point', system: 'Stanton', planet: 'ArcCorp Orbit', type: 'Station',
    shops: [
      { name: 'Cargo Deck Store', type: 'General', sells: ['General Goods', 'FPS Gear'] },
      { name: 'Ship Components', type: 'Ship Parts', sells: ['Ship Components', 'Fuel'] },
    ],
    refinery: false, medical: true, quantum: true, bar: false
  },
  {
    name: 'CRU-L5 Stash House', system: 'Stanton', planet: 'Crusader L5', type: 'Outlaw Station',
    shops: [
      { name: 'Black Market', type: 'Black Market', sells: ['Contraband', 'Stolen Goods', 'Black Market Items'] },
    ],
    refinery: false, medical: false, quantum: true, bar: false
  },
  {
    name: 'Ruin Station', system: 'Pyro', planet: 'Pyro IV', type: 'Outlaw Station',
    shops: [
      { name: 'Pyro Market', type: 'Black Market', sells: ['Contraband', 'Pyro Goods', 'Weapons'] },
      { name: 'Trade Hub', type: 'Commodities', sells: ['Pyro Resources', 'Fuel'] },
    ],
    refinery: false, medical: true, quantum: true, bar: true
  },
  {
    name: 'Checkmate', system: 'Pyro', planet: 'Nyx Gateway', type: 'Station',
    shops: [
      { name: 'Trade Hub', type: 'Commodities', sells: ['General Goods', 'Pyro Supplies'] },
    ],
    refinery: false, medical: true, quantum: true, bar: false
  },
];

const ITEM_TYPES = [
  'FPS Weapons', 'FPS Armor', 'Ship Components', 'Ship Weapons', 'Ammo',
  'Medical Supplies', 'Agricultural Supplies', 'Clothing', 'Contraband',
  'Mining Supplies', 'Salvage Parts', 'Food', 'Hydrogen Fuel', 'Exploration Gear',
];

const LOC_TYPE_COLORS = { City:'var(--accent-primary)', Station:'var(--accent-secondary)', 'Outlaw Station':'var(--accent-red)' };
const SYSTEM_COLORS = { Stanton:'var(--accent-primary)', Pyro:'#ff8c00', Nyx:'var(--accent-purple)' };

export default function MarketFinderPage() {
  const { data: LOCATIONS_DATA } = useDataset(DATASETS.MARKET_LOCATIONS.key, DEFAULT_MARKET_LOCATIONS);
  const [searchItem, setSearchItem] = useState('');
  const [filterSystem, setFilterSystem] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterServices, setFilterServices] = useState([]);
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [viewMode, setViewMode] = useState('search'); // 'search' | 'browse'

  function toggleService(s) {
    setFilterServices(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev,s]);
  }

  const results = useMemo(() => {
    return LOCATIONS_DATA.filter(loc => {
      if (filterSystem !== 'all' && loc.system !== filterSystem) return false;
      if (filterType !== 'all' && loc.type !== filterType) return false;
      if (filterServices.includes('refinery') && !loc.refinery) return false;
      if (filterServices.includes('medical') && !loc.medical) return false;
      if (filterServices.includes('quantum') && !loc.quantum) return false;
      if (filterServices.includes('bar') && !loc.bar) return false;
      if (searchItem) {
        const q = searchItem.toLowerCase();
        const hasItem = loc.shops.some(shop =>
          shop.name.toLowerCase().includes(q) ||
          shop.type.toLowerCase().includes(q) ||
          shop.sells.some(s => s.toLowerCase().includes(q))
        );
        if (!hasItem) return false;
      }
      return true;
    });
  }, [searchItem, filterSystem, filterType, filterServices]);

  const matchingShops = useMemo(() => {
    if (!searchItem || !selectedLoc) return [];
    const q = searchItem.toLowerCase();
    const loc = LOCATIONS_DATA.find(l=>l.name===selectedLoc);
    if (!loc) return [];
    return loc.shops.filter(shop =>
      shop.name.toLowerCase().includes(q) ||
      shop.type.toLowerCase().includes(q) ||
      shop.sells.some(s=>s.toLowerCase().includes(q))
    );
  }, [searchItem, selectedLoc]);

  const SS = { padding:'7px 26px 7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 7px center' };

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">MARKET FINDER</div>
          <div className="page-subtitle">Encontre onde comprar qualquer item no Universo — {LOCATIONS_DATA.length} locais catalogados</div>
        </div>
        <div style={{ display:'flex',gap:6 }}>
          {['search','browse'].map(m=>(
            <button key={m} onClick={()=>setViewMode(m)} className={`filter-chip ${viewMode===m?'active':''}`}>
              {m==='search'?'Buscar por Item':'Ver por Local'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding:'10px 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',flexShrink:0 }}>
        <div style={{ display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:8 }}>
          <div style={{ position:'relative',flex:'1 1 200px' }}>
            <Search size={13} style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }}/>
            <input className="search-input" style={{ paddingLeft:30,width:'100%' }}
              placeholder="O que você quer comprar? ex: FPS Armor, Stims, Compboard..."
              value={searchItem} onChange={e=>setSearchItem(e.target.value)}/>
          </div>
          <select style={SS} value={filterSystem} onChange={e=>setFilterSystem(e.target.value)}>
            <option value="all">Todos os Sistemas</option>
            <option value="Stanton">Stanton</option>
            <option value="Pyro">Pyro</option>
            <option value="Nyx">Nyx</option>
          </select>
          <select style={SS} value={filterType} onChange={e=>setFilterType(e.target.value)}>
            <option value="all">Todos os Tipos</option>
            <option value="City">Cidade</option>
            <option value="Station">Estação</option>
            <option value="Outlaw Station">Estação Outlaw</option>
          </select>
        </div>
        <div style={{ display:'flex',gap:6,flexWrap:'wrap',alignItems:'center' }}>
          <span style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em' }}>Serviços:</span>
          {[
            {id:'medical',label:'🏥 Medical'},
            {id:'quantum',label:'⚡ Quantum Fuel'},
            {id:'bar',label:'🍺 Bar/Food'},
            {id:'refinery',label:'⚙️ Refinery'},
          ].map(({id,label})=>(
            <button key={id}
              className={`filter-chip ${filterServices.includes(id)?'active':''}`}
              onClick={()=>toggleService(id)}>{label}</button>
          ))}
          <span style={{ marginLeft:'auto',fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-muted)' }}>{results.length} locais</span>
        </div>
      </div>

      <div className="page-body">
        {viewMode==='search' && (
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
            {/* Location list */}
            <div>
              <div className="modal-section-title">Locais com {searchItem||'todos os itens'}</div>
              {results.length===0 ? (
                <div style={{ color:'var(--text-muted)',fontSize:13,textAlign:'center',padding:30 }}>Nenhum local encontrado</div>
              ) : results.map(loc=>{
                const relevantShops = searchItem
                  ? loc.shops.filter(s=>s.name.toLowerCase().includes(searchItem.toLowerCase())||s.type.toLowerCase().includes(searchItem.toLowerCase())||s.sells.some(x=>x.toLowerCase().includes(searchItem.toLowerCase())))
                  : loc.shops;
                return (
                  <div key={loc.name} style={{
                    background:selectedLoc===loc.name?'rgba(0,212,255,0.06)':'var(--bg-card)',
                    border:`1px solid ${selectedLoc===loc.name?'var(--border-bright)':'var(--border-subtle)'}`,
                    borderRadius:8,padding:'12px 14px',marginBottom:8,cursor:'pointer',transition:'all 0.2s',
                  }} onClick={()=>setSelectedLoc(selectedLoc===loc.name?null:loc.name)}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6 }}>
                      <div>
                        <div style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{loc.name}</div>
                        <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>{loc.planet} · {loc.system}</div>
                      </div>
                      <div style={{ display:'flex',gap:5,alignItems:'center' }}>
                        <span style={{ fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:3,background:`${LOC_TYPE_COLORS[loc.type]||'var(--text-muted)'}18`,color:LOC_TYPE_COLORS[loc.type]||'var(--text-muted)',border:`1px solid ${LOC_TYPE_COLORS[loc.type]||'var(--text-muted)'}33` }}>{loc.type}</span>
                        <span style={{ fontSize:11,color:SYSTEM_COLORS[loc.system]||'var(--text-muted)',fontWeight:700 }}>{loc.system}</span>
                      </div>
                    </div>
                    {/* Matching shops preview */}
                    <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
                      {relevantShops.slice(0,4).map(shop=>(
                        <span key={shop.name} style={{ fontSize:10,padding:'2px 7px',borderRadius:5,background:'rgba(0,119,255,0.08)',border:'1px solid rgba(0,119,255,0.2)',color:'var(--accent-secondary)' }}>{shop.name}</span>
                      ))}
                      {relevantShops.length>4&&<span style={{ fontSize:10,color:'var(--text-muted)' }}>+{relevantShops.length-4} mais</span>}
                    </div>
                    {/* Services */}
                    <div style={{ display:'flex',gap:6,marginTop:8 }}>
                      {loc.medical&&<span style={{ fontSize:10,color:'var(--accent-green)' }}>🏥</span>}
                      {loc.quantum&&<span style={{ fontSize:10,color:'var(--accent-primary)' }}>⚡</span>}
                      {loc.bar&&<span style={{ fontSize:10,color:'var(--accent-gold)' }}>🍺</span>}
                      {loc.refinery&&<span style={{ fontSize:10,color:'#e17055' }}>⚙️</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail panel */}
            <div>
              {selectedLoc ? (() => {
                const loc = LOCATIONS_DATA.find(l=>l.name===selectedLoc);
                if (!loc) return null;
                return (
                  <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:8,padding:'16px',position:'sticky',top:0 }}>
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontFamily:'Orbitron,monospace',fontSize:15,fontWeight:700,color:'var(--text-primary)',marginBottom:4 }}>{loc.name}</div>
                      <div style={{ fontSize:12,color:'var(--text-muted)' }}>{loc.planet} · {loc.system} · {loc.type}</div>
                    </div>
                    <div className="modal-section-title">Lojas ({loc.shops.length})</div>
                    {loc.shops.map(shop=>{
                      const matches = searchItem && shop.sells.some(s=>s.toLowerCase().includes(searchItem.toLowerCase()));
                      return (
                        <div key={shop.name} style={{ background:matches?'rgba(0,229,160,0.04)':'var(--bg-panel)',border:`1px solid ${matches?'rgba(0,229,160,0.2)':'var(--border-subtle)'}`,borderRadius:6,padding:'10px 12px',marginBottom:8 }}>
                          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6 }}>
                            <span style={{ fontSize:13,fontWeight:700,color:matches?'var(--accent-green)':'var(--text-primary)' }}>{shop.name}</span>
                            <span style={{ fontSize:10,color:'var(--text-muted)',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3 }}>{shop.type}</span>
                          </div>
                          <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
                            {shop.sells.map(item=>(
                              <span key={item} style={{ fontSize:10,padding:'2px 6px',borderRadius:4,background:searchItem&&item.toLowerCase().includes(searchItem.toLowerCase())?'rgba(0,229,160,0.12)':'rgba(255,255,255,0.04)',border:`1px solid ${searchItem&&item.toLowerCase().includes(searchItem.toLowerCase())?'rgba(0,229,160,0.3)':'var(--border-subtle)'}`,color:searchItem&&item.toLowerCase().includes(searchItem.toLowerCase())?'var(--accent-green)':'var(--text-muted)' }}>
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ marginTop:10,padding:'8px 12px',background:'var(--bg-panel)',borderRadius:6 }}>
                      <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Serviços</div>
                      <div style={{ display:'flex',gap:10,fontSize:12 }}>
                        <span style={{ color:loc.medical?'var(--accent-green)':'var(--text-muted)' }}>{loc.medical?'✓':'✗'} Medical</span>
                        <span style={{ color:loc.quantum?'var(--accent-primary)':'var(--text-muted)' }}>{loc.quantum?'✓':'✗'} Quantum Fuel</span>
                        <span style={{ color:loc.bar?'var(--accent-gold)':'var(--text-muted)' }}>{loc.bar?'✓':'✗'} Bar/Food</span>
                        <span style={{ color:loc.refinery?'#e17055':'var(--text-muted)' }}>{loc.refinery?'✓':'✗'} Refinery</span>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'40px 20px',textAlign:'center' }}>
                  <MapPin size={40} style={{ color:'var(--text-muted)',margin:'0 auto 12px',display:'block',opacity:0.3 }}/>
                  <div style={{ color:'var(--text-muted)',fontSize:13 }}>Selecione um local para ver todas as lojas</div>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode==='browse' && (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12 }}>
            {results.map(loc=>(
              <div key={loc.name} style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'14px',transition:'all 0.2s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border-normal)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border-subtle)'}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10 }}>
                  <div>
                    <div style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{loc.name}</div>
                    <div style={{ fontSize:10,color:'var(--text-muted)',marginTop:2 }}>{loc.planet} · <span style={{ color:SYSTEM_COLORS[loc.system] }}>{loc.system}</span></div>
                  </div>
                  <span style={{ fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:3,background:`${LOC_TYPE_COLORS[loc.type]}18`,color:LOC_TYPE_COLORS[loc.type],border:`1px solid ${LOC_TYPE_COLORS[loc.type]}33` }}>{loc.type}</span>
                </div>
                <div style={{ marginBottom:10 }}>
                  {loc.shops.slice(0,3).map(shop=>(
                    <div key={shop.name} style={{ fontSize:11,color:'var(--text-secondary)',padding:'3px 0',borderBottom:'1px solid var(--border-subtle)',display:'flex',justifyContent:'space-between' }}>
                      <span>{shop.name}</span>
                      <span style={{ color:'var(--text-muted)',fontSize:10 }}>{shop.type}</span>
                    </div>
                  ))}
                  {loc.shops.length>3&&<div style={{ fontSize:10,color:'var(--text-muted)',marginTop:4 }}>+{loc.shops.length-3} mais lojas</div>}
                </div>
                <div style={{ display:'flex',gap:8,fontSize:12 }}>
                  {loc.medical&&<span title="Medical Bay" style={{ color:'var(--accent-green)' }}>🏥</span>}
                  {loc.quantum&&<span title="Quantum Fuel" style={{ color:'var(--accent-primary)' }}>⚡</span>}
                  {loc.bar&&<span title="Bar / Food" style={{ color:'var(--accent-gold)' }}>🍺</span>}
                  {loc.refinery&&<span title="Refinery" style={{ color:'#e17055' }}>⚙️</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
