import React, { useState, useMemo } from 'react';
import { Package, Plus, Trash2, BarChart3, RefreshCw, TrendingUp } from 'lucide-react';
import { useDataset, DATASETS } from '../data/dataStore';

export const DEFAULT_CARGO_SHIPS = [
  { name:'Cutter', scu:0, notes:'Sem cargo' },
  { name:'Avenger Titan', scu:8 },
  { name:'Nomad', scu:16 },
  { name:'Cutlass Black', scu:46 },
  { name:'Freelancer', scu:66 },
  { name:'Freelancer MAX', scu:122 },
  { name:'Freelancer MIS', scu:28 },
  { name:'Constellation Andromeda', scu:96 },
  { name:'Constellation Taurus', scu:174 },
  { name:'Constellation Phoenix', scu:66 },
  { name:'Hull A', scu:64 },
  { name:'Hull B', scu:384 },
  { name:'Hull C', scu:4608 },
  { name:'Hull D', scu:20736 },
  { name:'Hull E', scu:98304 },
  { name:'Caterpillar', scu:576 },
  { name:'C2 Hercules', scu:696 },
  { name:'M2 Hercules', scu:522 },
  { name:'A2 Hercules', scu:444 },
  { name:'Ironclad', scu:1440 },
  { name:'Ironclad Assault', scu:192 },
  { name:'Merchantman', scu:3456 },
  { name:'Carrack', scu:72 },
  { name:'600i', scu:40 },
  { name:'Prospector', scu:32, notes:'Mineração' },
  { name:'MOLE', scu:96, notes:'Mineração' },
  { name:'Reclaimer', scu:120, notes:'Salvage' },
  { name:'Vulture', scu:12, notes:'Salvage' },
  { name:'Endeavor', scu:500, notes:'Science' },
  { name:'Galaxy', scu:1000 },
  { name:'MSR', scu:114 },
  { name:'Corsair', scu:72 },
];

export const DEFAULT_CARGO_GOODS = [
  { name:'Quantainium', value:7950, density:1.0, legal:true, category:'Minério' },
  { name:'Bexalite', value:4800, density:1.0, legal:true, category:'Minério' },
  { name:'Taranite', value:5800, density:1.0, legal:true, category:'Minério' },
  { name:'Laranite', value:4200, density:1.0, legal:true, category:'Minério' },
  { name:'Diamond', value:7200, density:1.0, legal:true, category:'Minério' },
  { name:'Gold', value:5400, density:1.0, legal:true, category:'Minério' },
  { name:'Titanium', value:1140, density:1.0, legal:true, category:'Minério' },
  { name:'Copper', value:5530, density:1.0, legal:true, category:'Minério' },
  { name:'Agricultural Supplies', value:1380, density:1.0, legal:true, category:'Commodity' },
  { name:'Medical Supplies', value:1492, density:1.0, legal:true, category:'Commodity' },
  { name:'Processed Food', value:1760, density:1.0, legal:true, category:'Commodity' },
  { name:'Hydrogen Fuel', value:100, density:1.0, legal:true, category:'Commodity' },
  { name:'Scrap', value:2350, density:1.0, legal:true, category:'Salvage' },
  { name:'Compboard', value:1570, density:0.5, legal:true, category:'Componente' },
  { name:'Neon', value:14380, density:0.3, legal:false, category:'Contrabando' },
  { name:'WiDoW', value:15560, density:0.3, legal:false, category:'Contrabando' },
  { name:'Stims', value:4680, density:0.5, legal:false, category:'Contrabando' },
  { name:'Distilled Spirits', value:6980, density:0.8, legal:true, category:'Commodity' },
];

export const DEFAULT_CARGO_PACKING = [
  { name:'Sem Empacotamento', multiplier:1.0, desc:'Cargo padrão em caixas SCU' },
  { name:'Empacotamento Eficiente', multiplier:1.15, desc:'+15% de capacidade útil organizando os containers' },
  { name:'Micro-containers', multiplier:1.25, desc:'+25% — use containers menores para gaps' },
  { name:'Max Packing (ilegal)', multiplier:1.4, desc:'+40% — contrabando usa técnicas especiais' },
];

export default function CargoLoaderPage() {
  const { data: SHIP_CARGO } = useDataset(DATASETS.CARGO_SHIPS.key, DEFAULT_CARGO_SHIPS);
  const { data: COMMON_GOODS } = useDataset(DATASETS.CARGO_GOODS.key, DEFAULT_CARGO_GOODS);
  const { data: PACKING_METHODS } = useDataset(DATASETS.CARGO_PACKING.key, DEFAULT_CARGO_PACKING);
  const [selectedShip, setSelectedShip] = useState(SHIP_CARGO[3]);
  const [items, setItems] = useState([]);
  const [customName, setCustomName] = useState('');
  const [customSCU, setCustomSCU] = useState(1);
  const [customValue, setCustomValue] = useState(0);
  const [packing, setPacking] = useState(PACKING_METHODS[0]);
  const [addFromList, setAddFromList] = useState('');
  const [addQty, setAddQty] = useState(1);

  const usedSCU = useMemo(() => items.reduce((a,i)=>a+i.scu*i.qty,0), [items]);
  const effectiveCapacity = Math.floor(selectedShip.scu * packing.multiplier);
  const remaining = effectiveCapacity - usedSCU;
  const totalValue = useMemo(() => items.reduce((a,i)=>a+i.value*i.qty,0), [items]);
  const fillPct = effectiveCapacity > 0 ? Math.min((usedSCU/effectiveCapacity)*100,100) : 0;

  function addFromPreset() {
    const good = COMMON_GOODS.find(g=>g.name===addFromList);
    if (!good) return;
    const existing = items.findIndex(i=>i.name===good.name);
    if (existing>=0) {
      const upd=[...items]; upd[existing]={...upd[existing],qty:upd[existing].qty+addQty};
      setItems(upd);
    } else {
      setItems([...items,{name:good.name,scu:addQty,qty:1,value:good.value*addQty,category:good.category,legal:good.legal}]);
    }
  }

  function addCustom() {
    if (!customName.trim()||customSCU<=0) return;
    setItems([...items,{name:customName,scu:Number(customSCU),qty:1,value:Number(customValue),category:'Custom',legal:true}]);
    setCustomName(''); setCustomSCU(1); setCustomValue(0);
  }

  function removeItem(i) { setItems(items.filter((_,j)=>j!==i)); }
  function updateQty(i,qty) {
    if (qty<=0) { removeItem(i); return; }
    const upd=[...items]; upd[i]={...upd[i],qty}; setItems(upd);
  }

  function clearAll() { setItems([]); }

  const SS = { padding:'7px 28px 7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 8px center' };
  const IS = { padding:'7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none' };

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">CARGO LOADER</div>
          <div className="page-subtitle">Planejador de carga — maximize o valor da sua nave</div>
        </div>
        {items.length>0&&<button onClick={clearAll} style={{ padding:'8px 14px',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:6,color:'var(--accent-red)',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase',display:'flex',alignItems:'center',gap:6 }}><Trash2 size={13}/>Limpar</button>}
      </div>

      <div className="page-body" style={{ display:'grid',gridTemplateColumns:'1fr 320px',gap:20 }}>
        {/* LEFT */}
        <div>
          {/* Ship + packing */}
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'14px',marginBottom:14 }}>
            <div className="modal-section-title">Configuração da Nave</div>
            <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr',gap:10 }}>
              <div>
                <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4 }}>Nave</div>
                <select style={{ ...SS,width:'100%' }} value={selectedShip.name} onChange={e=>setSelectedShip(SHIP_CARGO.find(s=>s.name===e.target.value))}>
                  {SHIP_CARGO.map(s=><option key={s.name} value={s.name}>{s.name} — {s.scu} SCU</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4 }}>Método de Empacotamento</div>
                <select style={{ ...SS,width:'100%' }} value={packing.name} onChange={e=>setPacking(PACKING_METHODS.find(p=>p.name===e.target.value))}>
                  {PACKING_METHODS.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Add from preset */}
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'14px',marginBottom:14 }}>
            <div className="modal-section-title">Adicionar Carga Predefinida</div>
            <div style={{ display:'flex',gap:8,alignItems:'center' }}>
              <select style={{ ...SS,flex:2 }} value={addFromList} onChange={e=>setAddFromList(e.target.value)}>
                <option value="">— selecione commodity —</option>
                {COMMON_GOODS.map(g=><option key={g.name} value={g.name}>{g.name} ({g.category}) — {g.value.toLocaleString()} aUEC/SCU</option>)}
              </select>
              <input style={{ ...IS,width:80 }} type="number" min="1" value={addQty} onChange={e=>setAddQty(Number(e.target.value))} placeholder="SCU"/>
              <span style={{ fontSize:11,color:'var(--text-muted)' }}>SCU</span>
              <button onClick={addFromPreset} disabled={!addFromList} style={{ padding:'8px 14px',background:'rgba(0,212,255,0.1)',border:'1px solid var(--border-normal)',borderRadius:5,color:'var(--accent-primary)',cursor:addFromList?'pointer':'not-allowed',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,opacity:addFromList?1:0.5 }}>
                <Plus size={13}/>
              </button>
            </div>
          </div>

          {/* Add custom */}
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'14px',marginBottom:14 }}>
            <div className="modal-section-title">Adicionar Carga Personalizada</div>
            <div style={{ display:'flex',gap:8,alignItems:'center',flexWrap:'wrap' }}>
              <input style={{ ...IS,flex:2,minWidth:120 }} value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="Nome do item..."/>
              <input style={{ ...IS,width:80 }} type="number" min="1" value={customSCU} onChange={e=>setCustomSCU(e.target.value)} placeholder="SCU"/>
              <input style={{ ...IS,width:120 }} type="number" min="0" value={customValue} onChange={e=>setCustomValue(e.target.value)} placeholder="Valor (aUEC)"/>
              <button onClick={addCustom} style={{ padding:'8px 14px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',borderRadius:5,color:'var(--accent-green)',cursor:'pointer',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700 }}>
                <Plus size={13}/>
              </button>
            </div>
          </div>

          {/* Cargo list */}
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'14px' }}>
            <div className="modal-section-title">Manifesto de Carga ({items.length} itens)</div>
            {items.length===0 ? (
              <div style={{ color:'var(--text-muted)',fontSize:13,textAlign:'center',padding:'20px 0' }}>Nenhum item carregado</div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
                {items.map((item,i)=>(
                  <div key={i} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'var(--bg-panel)',borderRadius:5,border:'1px solid var(--border-subtle)' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{item.name}</div>
                      <div style={{ fontSize:10,color:'var(--text-muted)' }}>{item.category}{!item.legal&&' · ⚠️ Contrabando'}</div>
                    </div>
                    <div style={{ display:'flex',alignItems:'center',gap:6,flexShrink:0 }}>
                      <button onClick={()=>updateQty(i,item.qty-1)} style={{ width:22,height:22,borderRadius:4,border:'1px solid var(--border-subtle)',background:'transparent',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>−</button>
                      <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:13,color:'var(--accent-primary)',width:30,textAlign:'center' }}>{item.qty}</span>
                      <button onClick={()=>updateQty(i,item.qty+1)} style={{ width:22,height:22,borderRadius:4,border:'1px solid var(--border-subtle)',background:'transparent',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>+</button>
                      <span style={{ fontSize:12,color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace',width:60,textAlign:'right' }}>{item.scu*item.qty} SCU</span>
                      <span style={{ fontSize:12,color:'var(--accent-gold)',fontFamily:'Share Tech Mono,monospace',width:90,textAlign:'right' }}>{(item.value*item.qty).toLocaleString()}</span>
                      <button onClick={()=>removeItem(i)} style={{ width:24,height:24,borderRadius:4,border:'1px solid rgba(255,68,102,0.2)',background:'rgba(255,68,102,0.08)',color:'var(--accent-red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><Trash2 size={11}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Summary */}
        <div>
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:8,padding:'16px',position:'sticky',top:0 }}>
            <div className="modal-section-title"><BarChart3 size={11}/> Resumo da Carga</div>

            {/* Fill bar */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                <span style={{ fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700 }}>Preenchimento</span>
                <span style={{ fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:800,color:fillPct>95?'var(--accent-red)':fillPct>75?'var(--accent-gold)':'var(--accent-green)' }}>{fillPct.toFixed(0)}%</span>
              </div>
              <div style={{ height:10,background:'var(--border-subtle)',borderRadius:5,overflow:'hidden' }}>
                <div style={{ height:'100%',width:`${fillPct}%`,background:fillPct>95?'var(--accent-red)':fillPct>75?'linear-gradient(to right,var(--accent-gold),var(--accent-orange))':'linear-gradient(to right,var(--accent-secondary),var(--accent-green))',borderRadius:5,transition:'width 0.5s' }}/>
              </div>
              <div style={{ display:'flex',justifyContent:'space-between',marginTop:4,fontSize:10,color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace' }}>
                <span>{usedSCU} SCU usados</span>
                <span>{remaining} SCU livres</span>
              </div>
            </div>

            {[
              ['Nave', selectedShip.name,'var(--text-secondary)'],
              ['Cap. Base',`${selectedShip.scu} SCU`,'var(--text-secondary)'],
              ['Cap. Efetiva',`${effectiveCapacity} SCU`,'var(--accent-primary)'],
              ['Método',packing.name,'var(--text-muted)'],
              ['Itens Diferentes',items.length,'var(--text-secondary)'],
              ['Total em SCU',`${usedSCU} SCU`,usedSCU>effectiveCapacity?'var(--accent-red)':'var(--accent-primary)'],
              ['Valor Total',`${totalValue.toLocaleString()} aUEC`,'var(--accent-gold)'],
              ['Valor/SCU', usedSCU>0?`${Math.round(totalValue/usedSCU).toLocaleString()} aUEC`:'—','var(--accent-green)'],
            ].map(([l,v,c])=>(
              <div key={l} style={{ display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--border-subtle)',fontSize:12 }}>
                <span style={{ color:'var(--text-muted)' }}>{l}</span>
                <span style={{ color:c,fontFamily:'Share Tech Mono,monospace',fontWeight:600 }}>{v}</span>
              </div>
            ))}

            {usedSCU > effectiveCapacity && (
              <div style={{ marginTop:12,padding:'8px 12px',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.25)',borderRadius:6,fontSize:12,color:'var(--accent-red)',display:'flex',alignItems:'center',gap:6 }}>
                ⚠️ Carga excede capacidade em {usedSCU-effectiveCapacity} SCU
              </div>
            )}

            {packing.name!=='Sem Empacotamento'&&(
              <div style={{ marginTop:10,padding:'8px 12px',background:'rgba(0,212,255,0.05)',border:'1px solid var(--border-subtle)',borderRadius:6,fontSize:11,color:'var(--text-secondary)',lineHeight:1.5 }}>
                ℹ️ {packing.desc}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
