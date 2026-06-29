import React, { useState, useMemo } from 'react';
import { Zap, Shield, Thermometer, Activity, RefreshCw, Save, Trash2, Plus } from 'lucide-react';
import { useDataset, DATASETS } from '../data/dataStore';
import { ProvenanceBadge } from '../components/ProvenanceBadge';

// ── Ship data ─────────────────────────────────────────────────────────────────
export const DEFAULT_DPS_SHIPS = [
  { name:'Arrow', hull:1820, shields:900, cargo:0, crew:1, hardpoints:{ s1:2, s2:2, s3:0, s4:0, s5:0 }, powerPlantSlots:1, coolerSlots:1, qdSlots:1 },
  { name:'Avenger Titan', hull:2600, shields:1200, cargo:8, crew:1, hardpoints:{ s1:2, s2:1, s3:0, s4:0, s5:0 }, powerPlantSlots:1, coolerSlots:1, qdSlots:1 },
  { name:'Buccaneer', hull:2200, shields:1100, cargo:0, crew:1, hardpoints:{ s1:2, s2:2, s3:1, s4:0, s5:0 }, powerPlantSlots:1, coolerSlots:1, qdSlots:1 },
  { name:'Cutlass Black', hull:3600, shields:2100, cargo:46, crew:1, hardpoints:{ s1:0, s2:4, s3:0, s4:0, s5:0 }, powerPlantSlots:2, coolerSlots:2, qdSlots:1 },
  { name:'Cutlass Red', hull:3200, shields:1800, cargo:10, crew:1, hardpoints:{ s1:0, s2:2, s3:0, s4:0, s5:0 }, powerPlantSlots:2, coolerSlots:2, qdSlots:1 },
  { name:'Eclipse', hull:2200, shields:1400, cargo:0, crew:1, hardpoints:{ s1:0, s2:0, s3:3, s4:0, s5:0 }, powerPlantSlots:1, coolerSlots:2, qdSlots:1 },
  { name:'F7C Hornet', hull:2200, shields:1300, cargo:4, crew:1, hardpoints:{ s1:2, s2:2, s3:1, s4:0, s5:0 }, powerPlantSlots:1, coolerSlots:2, qdSlots:1 },
  { name:'F7C-M Super Hornet', hull:2600, shields:1600, cargo:2, crew:2, hardpoints:{ s1:2, s2:2, s3:2, s4:0, s5:0 }, powerPlantSlots:1, coolerSlots:2, qdSlots:1 },
  { name:'Freelancer', hull:4200, shields:2400, cargo:66, crew:2, hardpoints:{ s1:2, s2:0, s3:2, s4:0, s5:0 }, powerPlantSlots:2, coolerSlots:2, qdSlots:1 },
  { name:'Gladius', hull:1600, shields:900, cargo:0, crew:1, hardpoints:{ s1:4, s2:0, s3:0, s4:0, s5:0 }, powerPlantSlots:1, coolerSlots:1, qdSlots:1 },
  { name:'Hammerhead', hull:28000, shields:14000, cargo:0, crew:9, hardpoints:{ s1:0, s2:0, s3:0, s4:6, s5:0 }, powerPlantSlots:4, coolerSlots:4, qdSlots:2 },
  { name:'Hurricane', hull:1900, shields:1100, cargo:0, crew:2, hardpoints:{ s1:0, s2:4, s3:2, s4:0, s5:0 }, powerPlantSlots:1, coolerSlots:2, qdSlots:1 },
  { name:'Inferno', hull:2500, shields:1400, cargo:0, crew:1, hardpoints:{ s1:0, s2:0, s3:0, s4:1, s5:0 }, powerPlantSlots:2, coolerSlots:2, qdSlots:1 },
  { name:'Mantis', hull:2200, shields:1200, cargo:0, crew:1, hardpoints:{ s1:2, s2:2, s3:0, s4:0, s5:0 }, powerPlantSlots:1, coolerSlots:1, qdSlots:1 },
  { name:'Redeemer', hull:8500, shields:5200, cargo:6, crew:5, hardpoints:{ s1:0, s2:2, s3:2, s4:2, s5:0 }, powerPlantSlots:2, coolerSlots:2, qdSlots:1 },
  { name:'Sabre', hull:1900, shields:1200, cargo:0, crew:1, hardpoints:{ s1:0, s2:4, s3:0, s4:0, s5:0 }, powerPlantSlots:1, coolerSlots:2, qdSlots:1 },
  { name:'Sentinel', hull:2000, shields:1200, cargo:0, crew:2, hardpoints:{ s1:0, s2:4, s3:1, s4:0, s5:0 }, powerPlantSlots:1, coolerSlots:2, qdSlots:1 },
  { name:'Vanguard Warden', hull:7200, shields:4100, cargo:6, crew:2, hardpoints:{ s1:2, s2:0, s3:2, s4:0, s5:1 }, powerPlantSlots:2, coolerSlots:2, qdSlots:1 },
  { name:'Scorpius', hull:4200, shields:2600, cargo:0, crew:2, hardpoints:{ s1:0, s2:4, s3:2, s4:0, s5:0 }, powerPlantSlots:2, coolerSlots:2, qdSlots:1 },
  { name:'C2 Hercules', hull:26000, shields:0, cargo:696, crew:2, hardpoints:{ s1:0, s2:2, s3:2, s4:0, s5:0 }, powerPlantSlots:3, coolerSlots:3, qdSlots:2 },
  { name:'Constellation Andromeda', hull:8400, shields:4600, cargo:96, crew:4, hardpoints:{ s1:2, s2:4, s3:2, s4:0, s5:0 }, powerPlantSlots:2, coolerSlots:2, qdSlots:1 },
];

export const DEFAULT_DPS_WEAPONS = [
  // size: 1
  { name:'CF-117 Badger (S1)', size:1, type:'Laser Repeater', dps:40.8, alpha:5.1, rof:8, range:1200, ammo:null, powerDraw:2.1, heatGen:1.8 },
  { name:'M3A Laser Cannon (S1)', size:1, type:'Laser Cannon', dps:65.0, alpha:13.0, rof:5, range:1500, ammo:null, powerDraw:2.8, heatGen:2.2 },
  { name:'Lightstrike V (S1)', size:1, type:'Laser Repeater', dps:44.0, alpha:5.5, rof:8, range:1100, ammo:null, powerDraw:2.0, heatGen:1.9 },
  { name:'Attrition-3 (S1)', size:1, type:'Distortion Repeater', dps:38.0, alpha:4.8, rof:8, range:900, ammo:null, powerDraw:1.8, heatGen:1.5 },
  { name:'CF-007 Bulldog (S1)', size:1, type:'Neutron Repeater', dps:42.0, alpha:7.0, rof:6, range:1300, ammo:null, powerDraw:2.3, heatGen:2.0 },
  // size: 2
  { name:'CF-227 Badger (S2)', size:2, type:'Laser Repeater', dps:65.0, alpha:8.1, rof:8, range:1400, ammo:null, powerDraw:3.8, heatGen:3.2 },
  { name:'M4A Laser Cannon (S2)', size:2, type:'Laser Cannon', dps:98.0, alpha:19.6, rof:5, range:1700, ammo:null, powerDraw:4.5, heatGen:3.8 },
  { name:'Scorpion GT-215 (S2)', size:2, type:'Laser Cannon', dps:88.0, alpha:17.6, rof:5, range:1500, ammo:null, powerDraw:4.2, heatGen:3.5 },
  { name:'Deadbolt III (S2)', size:2, type:'Laser Cannon', dps:102.0, alpha:20.4, rof:5, range:1600, ammo:null, powerDraw:4.8, heatGen:4.0 },
  { name:'Attrition-5 (S2)', size:2, type:'Distortion Repeater', dps:60.0, alpha:7.5, rof:8, range:1000, ammo:null, powerDraw:3.2, heatGen:2.8 },
  // size: 3
  { name:'CF-337 Panther (S3)', size:3, type:'Laser Repeater', dps:102.0, alpha:12.8, rof:8, range:1600, ammo:null, powerDraw:6.5, heatGen:5.5 },
  { name:'M5A Laser Cannon (S3)', size:3, type:'Laser Cannon', dps:148.0, alpha:29.6, rof:5, range:1900, ammo:null, powerDraw:7.2, heatGen:6.2 },
  { name:'NN-15 Cannon (S3)', size:3, type:'Laser Cannon', dps:156.0, alpha:31.2, rof:5, range:2000, ammo:null, powerDraw:7.8, heatGen:6.8 },
  { name:'Deadbolt V (S3)', size:3, type:'Laser Cannon', dps:160.0, alpha:32.0, rof:5, range:1900, ammo:null, powerDraw:8.0, heatGen:7.0 },
  // size: 4
  { name:'CF-447 Rhino (S4)', size:4, type:'Laser Repeater', dps:160.0, alpha:20.0, rof:8, range:1800, ammo:null, powerDraw:10.5, heatGen:9.0 },
  { name:'M6A Laser Cannon (S4)', size:4, type:'Laser Cannon', dps:228.0, alpha:45.6, rof:5, range:2200, ammo:null, powerDraw:12.0, heatGen:10.5 },
  { name:'Deadbolt VII (S4)', size:4, type:'Laser Cannon', dps:240.0, alpha:48.0, rof:5, range:2200, ammo:null, powerDraw:12.5, heatGen:11.0 },
];

// ── helpers ───────────────────────────────────────────────────────────────────
function getWeaponsForSize(weapons, size) {
  return weapons.filter(w => w.size === size);
}

const EMPTY_SLOT = { name:'(vazio)', size:0, type:'', dps:0, alpha:0, rof:0, range:0, ammo:null, powerDraw:0, heatGen:0 };

export default function DpsCalculatorPage() {
  const { data: SHIPS } = useDataset(DATASETS.DPS_SHIPS.key, DEFAULT_DPS_SHIPS);
  const { data: WEAPONS } = useDataset(DATASETS.DPS_WEAPONS.key, DEFAULT_DPS_WEAPONS);
  const [selectedShip, setSelectedShip] = useState(SHIPS[3]); // Cutlass Black
  const [slots, setSlots] = useState({});
  const [savedLoadouts, setSavedLoadouts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sc_dps_loadouts')||'[]'); } catch { return []; }
  });
  const [loadoutName, setLoadoutName] = useState('');

  // Build slot list from ship
  const slotList = useMemo(() => {
    if (!selectedShip) return [];
    const list = [];
    for (const [key, count] of Object.entries(selectedShip.hardpoints)) {
      const size = parseInt(key.replace('s',''));
      for (let i=0; i<count; i++) {
        list.push({ id:`${key}_${i}`, size, label:`S${size} Hardpoint ${i+1}` });
      }
    }
    return list;
  }, [selectedShip]);

  function setSlot(id, weaponName) {
    const w = WEAPONS.find(w=>w.name===weaponName) || null;
    setSlots(prev => ({ ...prev, [id]: w }));
  }

  const stats = useMemo(() => {
    let totalDps=0, totalAlpha=0, totalPower=0, totalHeat=0;
    const weaponSummary = {};
    for (const slot of slotList) {
      const w = slots[slot.id];
      if (w) {
        totalDps    += w.dps;
        totalAlpha  += w.alpha;
        totalPower  += w.powerDraw;
        totalHeat   += w.heatGen;
        weaponSummary[w.name] = (weaponSummary[w.name]||0) + 1;
      }
    }
    const ttk_1k = totalDps > 0 ? (1000/totalDps).toFixed(1) : '∞'; // time to kill 1000 HP target
    return { totalDps, totalAlpha, totalPower, totalHeat, ttk_1k, weaponSummary };
  }, [slots, slotList]);

  function handleShipChange(name) {
    const ship = SHIPS.find(s=>s.name===name);
    setSelectedShip(ship);
    setSlots({});
  }

  function saveLoadout() {
    if (!loadoutName.trim()) return;
    const l = { name:loadoutName, ship:selectedShip.name, slots, date:new Date().toISOString() };
    const updated = [...savedLoadouts, l];
    setSavedLoadouts(updated);
    localStorage.setItem('sc_dps_loadouts', JSON.stringify(updated));
    setLoadoutName('');
  }

  function loadLoadout(l) {
    const ship = SHIPS.find(s=>s.name===l.ship);
    if (ship) { setSelectedShip(ship); setSlots(l.slots||{}); }
  }

  function deleteLoadout(i) {
    const updated = savedLoadouts.filter((_,j)=>j!==i);
    setSavedLoadouts(updated);
    localStorage.setItem('sc_dps_loadouts', JSON.stringify(updated));
  }

  const SS = { width:'100%',padding:'7px 28px 7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 8px center' };

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">CALCULADORA DE DPS</div>
          <div className="page-subtitle">Configure o loadout da sua nave e calcule o DPS total</div>
        </div>
      </div>

      <div className="page-body" style={{ display:'grid',gridTemplateColumns:'1fr 340px',gap:20 }}>
        {/* Left: Ship + Weapon slots */}
        <div>
          {/* Ship select */}
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'16px',marginBottom:16 }}>
            <div className="modal-section-title">Nave</div>
            <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:12,alignItems:'center' }}>
              <select style={SS} value={selectedShip?.name||''} onChange={e=>handleShipChange(e.target.value)}>
                {SHIPS.map(s=><option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              {[['Hull',selectedShip?.hull,'var(--text-secondary)'],['Shields',selectedShip?.shields,'#0077ff'],['Cargo',`${selectedShip?.cargo} SCU`,'var(--accent-gold)']].map(([l,v,c])=>(
                <div key={l} style={{ background:'var(--bg-panel)',border:'1px solid var(--border-subtle)',borderRadius:6,padding:'8px 12px',textAlign:'center' }}>
                  <div style={{ fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:700,color:c }}>{v?.toLocaleString()}</div>
                  <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Weapon slots */}
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'16px',marginBottom:16 }}>
            <div className="modal-section-title">Armamento ({slotList.length} slots)</div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {slotList.length === 0 ? (
                <div style={{ color:'var(--text-muted)',fontSize:13,textAlign:'center',padding:20 }}>Selecione uma nave</div>
              ) : slotList.map(slot => {
                const equipped = slots[slot.id];
                const options = getWeaponsForSize(WEAPONS, slot.size);
                return (
                  <div key={slot.id} style={{ display:'grid',gridTemplateColumns:'140px 1fr auto',gap:10,alignItems:'center' }}>
                    <div style={{ fontSize:12,color:'var(--text-muted)',fontWeight:600 }}>
                      <span style={{ display:'inline-block',width:24,height:24,borderRadius:5,background:`rgba(0,212,255,0.1)`,border:'1px solid var(--border-subtle)',textAlign:'center',lineHeight:'24px',fontSize:10,fontWeight:700,color:'var(--accent-primary)',marginRight:6 }}>S{slot.size}</span>
                      {slot.label}
                    </div>
                    <select style={SS} value={equipped?.name||''} onChange={e=>setSlot(slot.id, e.target.value)}>
                      <option value="">(vazio)</option>
                      {options.map(w=><option key={w.name} value={w.name}>{w.name}</option>)}
                    </select>
                    {equipped ? (
                      <div style={{ fontSize:11,color:'var(--accent-red)',fontFamily:'Share Tech Mono,monospace',whiteSpace:'nowrap' }}>
                        {equipped.dps.toFixed(0)} DPS
                      </div>
                    ) : <div style={{ width:60 }}/>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save loadout */}
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'16px' }}>
            <div className="modal-section-title"><Save size={11}/> Loadouts Salvos</div>
            <div style={{ display:'flex',gap:8,marginBottom:10 }}>
              <input className="search-input" style={{ flex:1 }} value={loadoutName} onChange={e=>setLoadoutName(e.target.value)} placeholder="Nome do loadout..."/>
              <button onClick={saveLoadout} style={{ padding:'8px 14px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',borderRadius:6,color:'var(--accent-green)',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase' }}>
                <Save size={13}/>
              </button>
            </div>
            {savedLoadouts.length === 0 ? (
              <div style={{ fontSize:12,color:'var(--text-muted)',textAlign:'center',padding:'8px 0' }}>Nenhum loadout salvo</div>
            ) : savedLoadouts.map((l,i) => (
              <div key={i} style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'var(--bg-panel)',borderRadius:5,marginBottom:5 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:'var(--text-primary)' }}>{l.name}</div>
                  <div style={{ fontSize:10,color:'var(--text-muted)' }}>{l.ship}</div>
                </div>
                <button onClick={()=>loadLoadout(l)} style={{ padding:'4px 8px',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-normal)',borderRadius:4,color:'var(--accent-primary)',cursor:'pointer',fontSize:11,fontWeight:700 }}>Carregar</button>
                <button onClick={()=>deleteLoadout(i)} style={{ width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:4,color:'var(--accent-red)',cursor:'pointer' }}><Trash2 size={11}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Stats panel */}
        <div>
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:8,padding:'16px',marginBottom:16,position:'sticky',top:0 }}>
            <div className="modal-section-title"><Zap size={11}/> Resultado do Loadout</div>

            {[
              { label:'DPS Total', value:stats.totalDps.toFixed(1), unit:'dps', color:'var(--accent-red)', Icon:Zap },
              { label:'Alpha Damage', value:stats.totalAlpha.toFixed(1), unit:'dmg', color:'#ff8c00', Icon:Activity },
              { label:'Power Draw', value:stats.totalPower.toFixed(1), unit:'PWR', color:'var(--accent-gold)', Icon:null },
              { label:'Heat Gen', value:stats.totalHeat.toFixed(1), unit:'HEAT', color:'#e67e22', Icon:Thermometer },
              { label:'TTK (1000 HP)', value:stats.ttk_1k, unit:'seg', color:'var(--accent-primary)', Icon:null },
            ].map(({ label, value, unit, color }) => (
              <div key={label} style={{ marginBottom:14 }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                  <span style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em' }}>{label}</span>
                  <span style={{ fontFamily:'Orbitron,monospace',fontSize:16,fontWeight:800,color }}>{value} <span style={{ fontSize:10,color:'var(--text-muted)' }}>{unit}</span></span>
                </div>
                {typeof value === 'string' && !isNaN(parseFloat(value)) && (
                  <div style={{ height:3,background:'var(--border-subtle)',borderRadius:2,overflow:'hidden' }}>
                    <div style={{ height:'100%',width:`${Math.min((parseFloat(value)/500)*100,100)}%`,background:color,borderRadius:2,transition:'width 0.5s' }}/>
                  </div>
                )}
              </div>
            ))}

            {/* Weapon breakdown */}
            {Object.keys(stats.weaponSummary).length > 0 && (
              <div style={{ marginTop:16,paddingTop:12,borderTop:'1px solid var(--border-subtle)' }}>
                <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8 }}>Armas Equipadas</div>
                {Object.entries(stats.weaponSummary).map(([name,count]) => {
                  const w = WEAPONS.find(x=>x.name===name);
                  return (
                    <div key={name} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--border-subtle)',fontSize:12 }}>
                      <span style={{ color:'var(--text-secondary)' }}>{count}× {name}</span>
                      <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--accent-red)' }}>{w?(w.dps*count).toFixed(0):0} dps</span>
                    </div>
                  );
                })}
              </div>
            )}

            {stats.totalDps === 0 && (
              <div style={{ textAlign:'center',color:'var(--text-muted)',fontSize:13,padding:'20px 0' }}>
                Adicione armas aos slots para ver os stats
              </div>
            )}
          </div>

          {/* Ship quick reference */}
          {selectedShip && (
            <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'14px' }}>
              <div className="modal-section-title" style={{ display:'flex',alignItems:'center',gap:6 }}>
              Referência: {selectedShip.name}
              <ProvenanceBadge category="vehicle" name={selectedShip.name}/>
            </div>
              {[
                ['Hull Points', selectedShip.hull.toLocaleString()],
                ['Shield HP', selectedShip.shields.toLocaleString()],
                ['Cargo', `${selectedShip.cargo} SCU`],
                ['Tripulação', selectedShip.crew],
                ['Slots Power Plant', selectedShip.powerPlantSlots],
                ['Slots Cooler', selectedShip.coolerSlots],
              ].map(([k,v])=>(
                <div key={k} style={{ display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:12 }}>
                  <span style={{ color:'var(--text-muted)' }}>{k}</span>
                  <span style={{ color:'var(--text-secondary)',fontFamily:'Share Tech Mono,monospace' }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
