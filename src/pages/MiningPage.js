import React, { useState, useMemo } from 'react';
import { Pickaxe, Gem, MapPin, Star, BarChart3, RefreshCw } from 'lucide-react';
import { useDataset, DATASETS } from '../data/dataStore';
import { ProvenanceBadge } from '../components/ProvenanceBadge';

export const DEFAULT_MINEABLE_ORES = [
  { name:'Quantainium', value:7950, rarity:'Raro', locations:['Yela Asteroid Belt','Aaron Halo','Cellin','Daymar'], color:'#00e5a0', hazardous:true, notes:'Instável — pode explodir. Use laser em baixa potência. Vale a pena pelo alto valor.' },
  { name:'Bexalite', value:4800, rarity:'Raro', locations:['Aberdeen','Daymar','Yela','Aaron Halo'], color:'#a29bfe', hazardous:false, notes:'Alta pureza. Excelente valor por SCU. Prioridade após Quantainium.' },
  { name:'Taranite', value:5800, rarity:'Incomum', locations:['microTech','Calliope','Clio','Euterpe'], color:'#74b9ff', hazardous:false, notes:'Encontrado em alta concentração nas luas de microTech.' },
  { name:'Laranite', value:4200, rarity:'Incomum', locations:['Hurston','Arial','Ita','Magda'], color:'#fd79a8', hazardous:false, notes:'Abundante em Hurston e suas luas. Boa relação risco/recompensa.' },
  { name:'Hephaestanite', value:2650, rarity:'Incomum', locations:['Cellin','Daymar','Aberdeen'], color:'#e17055', hazardous:false, notes:'Luas de Crusader. Frequentemente em veios mistos com outros minérios.' },
  { name:'Dolivine', value:3450, rarity:'Incomum', locations:['Daymar','Yela','Cellin'], color:'#55efc4', hazardous:false, notes:'Crusader e suas luas. Boa opção para mineração superficial.' },
  { name:'Gold', value:5400, rarity:'Incomum', locations:['Hurston','Aberdeen','Ita'], color:'#ffc436', hazardous:false, notes:'Planeta Hurston e luas. Veios maiores do que a média.' },
  { name:'Diamond', value:7200, rarity:'Raro', locations:['microTech','Calliope','Clio'], color:'#dfe6e9', hazardous:false, notes:'Luas geladas de microTech. Difícil de encontrar mas extremamente valioso.' },
  { name:'Titanium', value:1140, rarity:'Comum', locations:['Daymar','Aberdeen','Yela','Cellin','Arial'], color:'#b2bec3', hazardous:false, notes:'Abundante em quase todas as luas rochosas. Essencial para crafting.' },
  { name:'Tungsten', value:4600, rarity:'Incomum', locations:['Hurston','Arial','Magda','Ita'], color:'#636e72', hazardous:false, notes:'Luas de Hurston. Pesado — planeje a carga com cuidado.' },
  { name:'Copper', value:5530, rarity:'Comum', locations:['Yela','Daymar','Aberdeen','Cellin'], color:'#fdcb6e', hazardous:false, notes:'Amplamente encontrado. Ótimo para crafting e venda.' },
  { name:'Iron', value:912, rarity:'Comum', locations:['Hurston','Aberdeen','Arial','Ita','Magda'], color:'#b2bec3', hazardous:false, notes:'Muito comum. Use apenas como complemento de carga.' },
  { name:'Aluminum', value:3850, rarity:'Comum', locations:['Cellin','Daymar','Yela'], color:'#a29bfe', hazardous:false, notes:'Luas de Crusader. Mining rápida em campos rasos.' },
  { name:'Corundum', value:1450, rarity:'Comum', locations:['microTech','Calliope','Clio','Euterpe'], color:'#fd79a8', hazardous:false, notes:'Luas de microTech. Bom complemento quando buscando Taranite.' },
  { name:'Quartz', value:2960, rarity:'Comum', locations:['Daymar','Yela','Aberdeen'], color:'#dfe6e9', hazardous:false, notes:'Crusader luas. Encontrado em grandes veios cristalinos.' },
  { name:'Borase', value:3200, rarity:'Incomum', locations:['Arial','Ita','Aberdeen'], color:'#00cec9', hazardous:false, notes:'Luas de Hurston. Veios médios, boa pureza.' },
  { name:'Agricium', value:2800, rarity:'Incomum', locations:['Cellin','Daymar'], color:'#00b894', hazardous:false, notes:'Crusader luas. Frequentemente junto com Dolivine.' },
  { name:'Inert Material', value:0, rarity:'Comum', locations:['Em toda parte'], color:'#636e72', hazardous:false, notes:'Sem valor de venda. Necessário para crafting de munição e consumíveis.' },
];

export const DEFAULT_SHIP_LASERS = [
  { name:'Helix I', tier:'Iniciante', power:1500, range:25, extraction:1.0, instability:0.3, notes:'Básico. Bom para Quantainium (baixa potência = menos explosões).' },
  { name:'Helix II (Craft)', tier:'Craftado', power:2200, range:28, extraction:1.3, instability:0.25, notes:'Versão craftada melhorada do Helix. Requer Blueprint de mineração.' },
  { name:'Hdestede S1', tier:'Iniciante', power:1800, range:22, extraction:0.9, instability:0.35, notes:'Alternativa ao Helix. Mais instável mas bom range.' },
  { name:'Lancet', tier:'Intermediário', power:2800, range:32, extraction:1.5, instability:0.2, notes:'Excelente para minérios médios. Boa estabilidade.' },
  { name:'Impact I', tier:'Intermediário', power:3200, range:30, extraction:1.6, instability:0.3, notes:'Alta extração. Cuidado com Quantainium.' },
  { name:'Arbor MH1', tier:'Intermediário', power:2600, range:35, extraction:1.4, instability:0.15, notes:'Excelente estabilidade. Ideal para iniciantes com navezinhas.' },
  { name:'Salvage Beam', tier:'Utilitário', power:2000, range:40, extraction:1.2, instability:0.1, notes:'Usado em naves de salvage como a Vulture.' },
  { name:'Abrade', tier:'Avançado', power:4000, range:28, extraction:1.8, instability:0.4, notes:'Alta potência para rochas grandes. Evite em Quantainium.' },
  { name:'Torrent III', tier:'Avançado', power:3800, range:30, extraction:2.0, instability:0.35, notes:'Máxima extração. Use com módulos de estabilidade.' },
  { name:'Crush S3', tier:'Avançado', power:5000, range:25, extraction:2.2, instability:0.45, notes:'Para naves grandes como Prospector/Mole. Alta produção por hora.' },
];

export const DEFAULT_MINING_SHIPS = [
  { name:'Prospector', cargo:32, lasers:1, crew:1, notes:'A mineradora solo ideal. Manobra bem em asteroides.' },
  { name:'MOLE', cargo:96, lasers:3, crew:4, notes:'Mineiroadora de grupo. 3 lasers simultâneos = enorme produção.' },
  { name:'Vulture', cargo:12, lasers:1, crew:1, notes:'Mining de salvage. Ideal para coleta de componentes e scrap.' },
  { name:'Cutlass Blue', cargo:28, lasers:1, crew:1, notes:'Alternativa acessível ao Prospector. Carga menor mas mais barata.' },
  { name:'Expanse', cargo:20, lasers:1, crew:1, notes:'Mineiroadora média. Boa para iniciantes em mineração.' },
];

export const DEFAULT_MINING_MODULES = [
  { name:'Surge', type:'Potência', effect:'+20% potência máxima do laser', best_for:'Rochas grandes e duras' },
  { name:'Focus I/II/III', type:'Potência', effect:'Reduz zona de extração — mais controle', best_for:'Quantainium e minérios instáveis' },
  { name:'Rieger C3', type:'Potência', effect:'Aumenta extração mas aumenta calor', best_for:'Minérios de valor médio' },
  { name:'Optimum', type:'Potência', effect:'+15% zona de extração', best_for:'Rochas fáceis com alta pureza' },
  { name:'Fltrn-Grdn', type:'Filtragem', effect:'Filtra Inert Material — pureza maior', best_for:'Todas as minerações' },
  { name:'Lifeline', type:'Segurança', effect:'Reduz instabilidade em 30%', best_for:'Quantainium obrigatório' },
  { name:'Brandt', type:'Fragmentação', effect:'Reduz resistência da rocha', best_for:'Rochas com alta resistência' },
  { name:'FLTR-L', type:'Filtragem', effect:'Filtragem avançada — +10% pureza', best_for:'Maximizar valor por SCU' },
];

export const DEFAULT_MINING_LOCATIONS = {
  'Yela Asteroid Belt': { system:'Stanton',type:'Asteroid Belt', best:['Quantainium','Copper','Titanium'], danger:'Médio', notes:'Melhor local para Quantainium. Densa concentração de asteroides.' },
  'Aaron Halo': { system:'Stanton',type:'Asteroid Belt', best:['Quantainium','Bexalite','Gold'], danger:'Alto', notes:'Maior asteroid belt de Stanton. Alto risco de PVP.' },
  'Daymar': { system:'Stanton',type:'Moon', best:['Titanium','Copper','Quartz','Dolivine'], danger:'Baixo', notes:'Lua de Crusader. Superfície acessível, boa para iniciantes.' },
  'Cellin': { system:'Stanton',type:'Moon', best:['Titanium','Hephaestanite','Aluminum','Agricium'], danger:'Baixo', notes:'Lua de Crusader. Terreno variado com bons depósitos.' },
  'Aberdeen': { system:'Stanton',type:'Moon', best:['Bexalite','Copper','Iron'], danger:'Médio', notes:'Lua de Hurston. Bom para Bexalite.' },
  'Calliope': { system:'Stanton',type:'Moon', best:['Taranite','Diamond','Corundum'], danger:'Baixo', notes:'Lua gelada de microTech. Excelente para minérios premium.' },
  'Clio': { system:'Stanton',type:'Moon', best:['Taranite','Diamond','Corundum'], danger:'Baixo', notes:'Lua gelada de microTech. Similar a Calliope.' },
  'Euterpe': { system:'Stanton',type:'Moon', best:['Taranite','Corundum'], danger:'Baixo', notes:'Menor lua de microTech. Menos concorrência.' },
  'Arial': { system:'Stanton',type:'Moon', best:['Laranite','Borase','Tungsten'], danger:'Baixo', notes:'Lua de Hurston com concentração de Laranite.' },
  'Ita': { system:'Stanton',type:'Moon', best:['Laranite','Gold','Iron'], danger:'Baixo', notes:'Lua de Hurston. Menor atmosfera — mais fácil de voar.' },
};

export default function MiningPage() {
  const { data: MINEABLE_ORES } = useDataset(DATASETS.MINING_ORES.key, DEFAULT_MINEABLE_ORES);
  const { data: SHIP_LASERS } = useDataset(DATASETS.MINING_LASERS.key, DEFAULT_SHIP_LASERS);
  const { data: MINING_SHIPS } = useDataset(DATASETS.MINING_SHIPS.key, DEFAULT_MINING_SHIPS);
  const { data: MODULES } = useDataset(DATASETS.MINING_MODULES.key, DEFAULT_MINING_MODULES);
  const { data: LOCATIONS } = useDataset(DATASETS.MINING_LOCATIONS.key, DEFAULT_MINING_LOCATIONS);
  const [activeTab, setActiveTab] = useState('locations');
  const [selectedLaser, setSelectedLaser] = useState(null);
  const [selectedShip, setSelectedShip] = useState(null);
  const [filterRaridade, setFilterRaridade] = useState('all');
  const [sortOre, setOrdenarOre] = useState('value');
  const [selectedLocalização, setSelectedLocalização] = useState(null);

  const sortedOres = useMemo(() => {
    let ores = [...MINEABLE_ORES].filter(o => filterRaridade==='all' || o.rarity===filterRaridade);
    ores.sort((a,b) => sortOre==='name' ? a.name.localeCompare(b.name) : b.value-a.value);
    return ores;
  }, [filterRaridade, sortOre]);

  const SS = { padding:'7px 28px 7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 8px center' };

  const TABS = [
    { id:'locations', label:'Locais de Mining' },
    { id:'ores', label:'Minérios & Valores' },
    { id:'lasers', label:'Lasers de Mining' },
    { id:'ships', label:'Naves & Módulos' },
  ];

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">GUIA DE MINERAÇÃO</div>
          <div className="page-subtitle">Locais, minérios, lasers, naves e módulos para maximizar seu lucro</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding:'0 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',display:'flex',gap:0,flexShrink:0 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            padding:'12px 18px',background:activeTab===t.id?'rgba(0,212,255,0.1)':'transparent',
            border:'none',borderBottom:`2px solid ${activeTab===t.id?'var(--accent-primary)':'transparent'}`,
            color:activeTab===t.id?'var(--accent-primary)':'var(--text-secondary)',
            fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,letterSpacing:'0.06em',
            textTransform:'uppercase',cursor:'pointer',transition:'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>

      <div className="page-body">

        {/* LOCATIONS TAB */}
        {activeTab==='locations' && (
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
            {Object.entries(LOCATIONS).map(([loc,data])=>(
              <div key={loc} style={{
                background:'var(--bg-card)',border:`1px solid ${selectedLocalização===loc?'var(--border-bright)':'var(--border-subtle)'}`,
                borderRadius:8,padding:'14px',cursor:'pointer',transition:'all 0.2s',
              }} onClick={()=>setSelectedLocalização(selectedLocalização===loc?null:loc)}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
                  <div>
                    <div style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{loc}</div>
                    <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>{data.system} · {data.type}</div>
                  </div>
                  <span style={{
                    fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:4,letterSpacing:'0.08em',
                    background:data.danger==='Alto'?'rgba(255,68,102,0.12)':data.danger==='Médio'?'rgba(255,196,54,0.1)':'rgba(0,229,160,0.1)',
                    color:data.danger==='Alto'?'var(--accent-red)':data.danger==='Médio'?'var(--accent-gold)':'var(--accent-green)',
                    border:`1px solid ${data.danger==='Alto'?'rgba(255,68,102,0.3)':data.danger==='Médio'?'rgba(255,196,54,0.25)':'rgba(0,229,160,0.25)'}`,
                  }}>⚠ {data.danger}</span>
                </div>
                <div style={{ display:'flex',gap:5,flexWrap:'wrap',marginBottom:8 }}>
                  {data.best.map(ore=>{
                    const oreData=MINEABLE_ORES.find(o=>o.name===ore);
                    return (
                      <span key={ore} style={{ fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:3,background:`${oreData?.color||'#7a90b0'}18`,border:`1px solid ${oreData?.color||'#7a90b0'}44`,color:oreData?.color||'#7a90b0' }}>
                        {ore}
                      </span>
                    );
                  })}
                </div>
                {selectedLocalização===loc && (
                  <div style={{ fontSize:12,color:'var(--text-secondary)',lineHeight:1.6,borderTop:'1px solid var(--border-subtle)',paddingTop:8,marginTop:4 }}>
                    {data.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ORES TAB */}
        {activeTab==='ores' && (
          <div>
            <div style={{ display:'flex',gap:10,marginBottom:16 }}>
              <select style={SS} value={filterRaridade} onChange={e=>setFilterRaridade(e.target.value)}>
                <option value="all">Todas Raridades</option>
                <option value="Comum">Comum</option>
                <option value="Incomum">Incomum</option>
                <option value="Raro">Raro</option>
              </select>
              <select style={SS} value={sortOre} onChange={e=>setOrdenarOre(e.target.value)}>
                <option value="value">Valor (maior)</option>
                <option value="name">Nome (A-Z)</option>
              </select>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12 }}>
              {sortedOres.map(ore=>(
                <div key={ore.name} style={{ background:'var(--bg-card)',border:`1px solid ${ore.color}33`,borderRadius:8,padding:'14px',borderLeft:`3px solid ${ore.color}` }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
                    <div>
                      <div style={{ fontFamily:'Rajdhani,sans-serif',fontSize:14,fontWeight:700,color:ore.color }}>{ore.name}</div>
                      <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:2 }}>{ore.rarity}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:800,color:'var(--accent-gold)' }}>
                        {ore.value.toLocaleString()}
                      </div>
                      <div style={{ fontSize:9,color:'var(--text-muted)' }}>aUEC/unidade</div>
                    </div>
                  </div>
                  {ore.hazardous && (
                    <div style={{ fontSize:10,color:'var(--accent-red)',fontWeight:700,background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:4,padding:'3px 8px',marginBottom:8 }}>
                      ⚠️ INSTÁVEL — Risco de explosão
                    </div>
                  )}
                  <div style={{ fontSize:11,color:'var(--text-secondary)',lineHeight:1.5,marginBottom:6 }}>{ore.notes}</div>
                  <div style={{ fontSize:10,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:4 }}>
                    <MapPin size={10}/> {ore.locations.join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LASERS TAB */}
        {activeTab==='lasers' && (
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {SHIP_LASERS.map(laser=>(
              <div key={laser.name} style={{
                background:'var(--bg-card)',border:`1px solid ${selectedLaser===laser.name?'var(--border-bright)':'var(--border-subtle)'}`,
                borderRadius:8,padding:'14px',cursor:'pointer',transition:'all 0.2s',
              }} onClick={()=>setSelectedLaser(selectedLaser===laser.name?null:laser.name)}>
                <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                  <Pickaxe size={20} style={{ color:'var(--accent-gold)',flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4 }}>
                      <span style={{ fontFamily:'Rajdhani,sans-serif',fontSize:14,fontWeight:700,color:'var(--text-primary)' }}>{laser.name}</span>
                      <span style={{ fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:3,background:laser.tier==='Avançado'?'rgba(255,68,102,0.1)':laser.tier==='Intermediário'?'rgba(0,212,255,0.1)':laser.tier==='Craftado'?'rgba(0,229,160,0.1)':'rgba(255,255,255,0.05)',color:laser.tier==='Avançado'?'var(--accent-red)':laser.tier==='Intermediário'?'var(--accent-primary)':laser.tier==='Craftado'?'var(--accent-green)':'var(--text-muted)',border:'1px solid var(--border-subtle)' }}>{laser.tier}</span>
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8 }}>
                      {[['Potência',`${laser.power.toLocaleString()} MW`,'var(--accent-red)'],['Alcance',`${laser.range}m`,'var(--accent-primary)'],['Extração',`${laser.extraction}x`,'var(--accent-green)'],['Instab.',`${(laser.instability*100).toFixed(0)}%`,laser.instability>0.3?'var(--accent-red)':'var(--accent-green)']].map(([l,v,c])=>(
                        <div key={l} style={{ background:'var(--bg-panel)',borderRadius:5,padding:'5px 8px' }}>
                          <div style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em' }}>{l}</div>
                          <div style={{ fontSize:12,color:c,fontFamily:'Share Tech Mono,monospace',fontWeight:700 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {selectedLaser===laser.name && (
                  <div style={{ marginTop:10,paddingTop:10,borderTop:'1px solid var(--border-subtle)',fontSize:12,color:'var(--text-secondary)',lineHeight:1.6 }}>
                    {laser.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SHIPS & MODULES TAB */}
        {activeTab==='ships' && (
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
            <div>
              <div className="modal-section-title">Naves de Mining</div>
              {MINING_SHIPS.map(ship=>(
                <div key={ship.name} style={{ background:'var(--bg-card)',border:`1px solid ${selectedShip===ship.name?'var(--border-bright)':'var(--border-subtle)'}`,borderRadius:8,padding:'14px',marginBottom:10,cursor:'pointer',transition:'all 0.2s' }}
                  onClick={()=>setSelectedShip(selectedShip===ship.name?null:ship.name)}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:selectedShip===ship.name?8:0 }}>
                    <span style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{ship.name}</span>
                    <div style={{ display:'flex',gap:8 }}>
                      <span style={{ fontSize:11,color:'var(--accent-gold)',fontFamily:'Share Tech Mono,monospace' }}>{ship.cargo} SCU</span>
                      <span style={{ fontSize:11,color:'var(--accent-primary)',fontFamily:'Share Tech Mono,monospace' }}>{ship.lasers} laser{ship.lasers>1?'s':''}</span>
                      <span style={{ fontSize:11,color:'var(--text-muted)' }}>{ship.crew} crew</span>
                    </div>
                  </div>
                  {selectedShip===ship.name && (
                    <div style={{ fontSize:12,color:'var(--text-secondary)',lineHeight:1.6,borderTop:'1px solid var(--border-subtle)',paddingTop:8 }}>{ship.notes}</div>
                  )}
                </div>
              ))}
            </div>
            <div>
              <div className="modal-section-title">Módulos de Mining</div>
              {MODULES.map(mod=>(
                <div key={mod.name} style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'12px',marginBottom:8 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
                    <span style={{ fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{mod.name}</span>
                    <span style={{ fontSize:10,color:'var(--accent-primary)',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3,fontWeight:700 }}>{mod.type}</span>
                  </div>
                  <div style={{ fontSize:12,color:'var(--accent-green)',marginBottom:4 }}>{mod.effect}</div>
                  <div style={{ fontSize:11,color:'var(--text-muted)' }}>Ideal para: {mod.best_for}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
