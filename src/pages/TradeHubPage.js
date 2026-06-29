import React, { useState, useMemo } from 'react';
import { TrendingUp, MapPin, Package, RefreshCw, ArrowRight, Star } from 'lucide-react';
import { useDataset, DATASETS } from '../data/dataStore';
import { ProvenanceBadge } from '../components/ProvenanceBadge';

export const DEFAULT_COMMODITIES = [
  { name:'Agricultural Supplies', buyLocations:[{loc:'Area18 - Trade & Development Division',price:1.01},{loc:'Lorville - Teasa Spaceport',price:1.02},{loc:'CRU-L1',price:1.03}], sellLocations:[{loc:'Delamar - Levski',price:1.38},{loc:'Grim HEX',price:1.35},{loc:'CRU-L5 Stash House',price:1.40}] },
  { name:'Aluminum', buyLocations:[{loc:'Delamar - Levski',price:1.50},{loc:'Grim HEX',price:1.52}], sellLocations:[{loc:'Lorville - Teasa Spaceport',price:3.85},{loc:'Area18 - Dumper Depot',price:3.90}] },
  { name:'Astatine', buyLocations:[{loc:'MIC-L1',price:3.76},{loc:'MIC-L5',price:3.78}], sellLocations:[{loc:'CRU-L1',price:8.52},{loc:'Area18',price:8.48}] },
  { name:'Bexalite', buyLocations:[{loc:'HUR-L3',price:3400},{loc:'HUR-L5',price:3420}], sellLocations:[{loc:'Port Olisar',price:4800},{loc:'CRU-L1',price:4780}] },
  { name:'Compboard', buyLocations:[{loc:'Area18 - Trade & Development Division',price:100},{loc:'ARC-L1',price:102}], sellLocations:[{loc:'Delamar',price:157},{loc:'CRU-L5',price:155}] },
  { name:'Copper', buyLocations:[{loc:'Delamar - Levski',price:2.85},{loc:'HUR-L1',price:2.87}], sellLocations:[{loc:'Area18 - Dumper Depot',price:5.53},{loc:'ARC-L1',price:5.51}] },
  { name:'Diamond', buyLocations:[{loc:'Delamar',price:4900},{loc:'HUR-L5',price:4920}], sellLocations:[{loc:'CRU-L1',price:7200},{loc:'ARC-L1',price:7150}] },
  { name:'Distilled Spirits', buyLocations:[{loc:'Area18',price:5.61},{loc:'Lorville',price:5.58}], sellLocations:[{loc:'Grim HEX',price:6.98},{loc:'Delamar',price:7.05}] },
  { name:'Dolivine', buyLocations:[{loc:'HUR-L2',price:2100},{loc:'CRU-L1',price:2110}], sellLocations:[{loc:'Lorville',price:3450},{loc:'Area18',price:3420}] },
  { name:'E-tam', buyLocations:[{loc:'Stanton system',price:3.08},{loc:'MIC-L1',price:3.10}], sellLocations:[{loc:'Lorville',price:5.68},{loc:'Area18',price:5.65}] },
  { name:'Gold', buyLocations:[{loc:'Delamar',price:3700},{loc:'HUR-L1',price:3710}], sellLocations:[{loc:'CRU-L1',price:5400},{loc:'ARC-L1',price:5380}] },
  { name:'Hephaestanite', buyLocations:[{loc:'HUR-L5',price:1700},{loc:'HUR-L3',price:1710}], sellLocations:[{loc:'New Babbage',price:2650},{loc:'ARC-L1',price:2640}] },
  { name:'Hydrogen', buyLocations:[{loc:'Port Olisar',price:0.83},{loc:'ARC-L1',price:0.82}], sellLocations:[{loc:'Levski',price:1.0},{loc:'Grim HEX',price:1.02}] },
  { name:'iMMC', buyLocations:[{loc:'Area18',price:100},{loc:'ARC-L1',price:102}], sellLocations:[{loc:'Lorville',price:155},{loc:'Delamar',price:158}] },
  { name:'Laranite', buyLocations:[{loc:'HUR-L5',price:2900},{loc:'HUR-L2',price:2910}], sellLocations:[{loc:'CRU-L1',price:4200},{loc:'Area18',price:4180}] },
  { name:'Medical Supplies', buyLocations:[{loc:'Port Olisar',price:10.69},{loc:'CRU-L1',price:10.75}], sellLocations:[{loc:'Delamar',price:14.92},{loc:'Grim HEX',price:15.10}] },
  { name:'Neon', buyLocations:[{loc:'Grim HEX',price:8.09},{loc:'Delamar',price:8.12}], sellLocations:[{loc:'Area18',price:14.43},{loc:'Lorville',price:14.38}] },
  { name:'Processed Food', buyLocations:[{loc:'Area18',price:1.41},{loc:'Lorville',price:1.42}], sellLocations:[{loc:'Delamar',price:1.76},{loc:'Grim HEX',price:1.78}] },
  { name:'Quantainium', buyLocations:[{loc:'Yela Asteroid Belt (mined)',price:3750},{loc:'Aaron Halo (mined)',price:3720}], sellLocations:[{loc:'CRU-L1 Ambitious Dream',price:7950},{loc:'Port Tressler',price:7900}] },
  { name:'Quartz', buyLocations:[{loc:'Delamar',price:1.08},{loc:'HUR-L1',price:1.09}], sellLocations:[{loc:'Area18',price:2.96},{loc:'ARC-L1',price:2.94}] },
  { name:'Recycled Material Composite', buyLocations:[{loc:'Lorville',price:1.0},{loc:'Area18',price:1.01}], sellLocations:[{loc:'Levski',price:1.53},{loc:'CRU-L5',price:1.55}] },
  { name:'Scrap', buyLocations:[{loc:'Grim HEX',price:1.12},{loc:'Delamar',price:1.13}], sellLocations:[{loc:'Lorville - Dumper Depot',price:2.35},{loc:'Area18 - Dumper Depot',price:2.33}] },
  { name:'Stims', buyLocations:[{loc:'Grim HEX',price:3.76},{loc:'Delamar',price:3.78}], sellLocations:[{loc:'Area18',price:4.68},{loc:'Lorville',price:4.65}] },
  { name:'Taranite', buyLocations:[{loc:'MIC-L1',price:4100},{loc:'MIC-L5',price:4090}], sellLocations:[{loc:'Lorville',price:5800},{loc:'Area18',price:5780}] },
  { name:'Titanium', buyLocations:[{loc:'Delamar',price:800},{loc:'HUR-L1',price:805}], sellLocations:[{loc:'CRU-L1',price:1140},{loc:'ARC-L1',price:1135}] },
  { name:'Tungsten', buyLocations:[{loc:'HUR-L3',price:3100},{loc:'HUR-L5',price:3110}], sellLocations:[{loc:'Area18',price:4600},{loc:'ARC-L1',price:4580}] },
  { name:'WiDoW', buyLocations:[{loc:'Grim HEX',price:11.14},{loc:'Delamar',price:11.20}], sellLocations:[{loc:'Levski',price:15.56},{loc:'CRU-L5',price:15.70}] },
];

const SCU_SIZES = [1,2,4,8,16,24,32,64,96,192,576,840];

export default function TradeHubPage() {
  const { data: COMMODITIES } = useDataset(DATASETS.TRADE_COMMODITIES.key, DEFAULT_COMMODITIES);
  const [scu, setScu] = useState(64);
  const [budget, setBudget] = useState(500000);
  const [system, setSystem] = useState('all');
  const [sortBy, setSortBy] = useState('profit');
  const [pinnedRoutes, setPinnedRoutes] = useState([]);
  const [search, setSearch] = useState('');

  const routes = useMemo(() => {
    return COMMODITIES
      .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
      .map(c => {
        const bestBuy  = c.buyLocations.reduce((a,b)=>a.price<b.price?a:b);
        const bestSell = c.sellLocations.reduce((a,b)=>a.price>b.price?a:b);
        const margin   = bestSell.price - bestBuy.price;
        const maxUnits = bestBuy.price > 0 ? Math.min(Math.floor(budget / bestBuy.price), scu) : scu;
        const profit   = margin * maxUnits;
        const roi      = bestBuy.price > 0 ? ((margin / bestBuy.price) * 100) : 0;
        return { ...c, bestBuy, bestSell, margin, maxUnits, profit, roi };
      })
      .filter(r => r.margin > 0)
      .sort((a,b) => {
        if (sortBy==='roi')    return b.roi-a.roi;
        if (sortBy==='margin') return b.margin-a.margin;
        return b.profit-a.profit;
      });
  }, [scu, budget, search, sortBy]);

  function togglePin(name) {
    setPinnedRoutes(prev => prev.includes(name) ? prev.filter(n=>n!==name) : [...prev,name]);
  }

  const pinned = routes.filter(r=>pinnedRoutes.includes(r.name));
  const unpinned = routes.filter(r=>!pinnedRoutes.includes(r.name));
  const display = [...pinned, ...unpinned];

  const SS = { padding:'7px 28px 7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 8px center' };

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">TRADE HUB</div>
          <div className="page-subtitle">Calculadora de rotas de comércio · {display.length} rotas lucrativas</div>
        </div>
      </div>

      {/* Config bar */}
      <div style={{ padding:'12px 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',flexShrink:0 }}>
        <div style={{ display:'flex',gap:10,flexWrap:'wrap',alignItems:'center' }}>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <span style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em' }}>Cargo</span>
            <select style={SS} value={scu} onChange={e=>setScu(Number(e.target.value))}>
              {SCU_SIZES.map(s=><option key={s} value={s}>{s} SCU</option>)}
            </select>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <span style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em' }}>Budget</span>
            <input style={{ padding:'7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Share Tech Mono,monospace',fontSize:13,outline:'none',width:130 }}
              type="number" value={budget} onChange={e=>setBudget(Number(e.target.value))} step={100000}/>
            <span style={{ fontSize:11,color:'var(--text-muted)' }}>aUEC</span>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <span style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em' }}>Ordenar por</span>
            <select style={SS} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
              <option value="profit">Lucro Total</option>
              <option value="roi">ROI %</option>
              <option value="margin">Margem/un</option>
            </select>
          </div>
          <input className="search-input" style={{ flex:1,minWidth:160 }} placeholder="Buscar commodity..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {pinned.length>0 && (
          <div style={{ marginTop:8,fontSize:11,color:'var(--accent-gold)' }}>
            ★ {pinned.length} rota{pinned.length>1?'s':''} fixada{pinned.length>1?'s':''}
          </div>
        )}
      </div>

      <div className="page-body">
        {display.length === 0 ? (
          <div className="empty-state">
            <TrendingUp size={56} className="empty-state-icon"/>
            <div className="empty-state-title">NENHUMA ROTA ENCONTRADA</div>
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
            {display.map(r => (
              <div key={r.name} style={{
                background:'var(--bg-card)',
                border:`1px solid ${pinnedRoutes.includes(r.name)?'rgba(255,196,54,0.3)':'var(--border-subtle)'}`,
                borderRadius:8,padding:'12px 16px',
                transition:'all 0.2s',
              }}>
                <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                  <button onClick={()=>togglePin(r.name)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:16,color:pinnedRoutes.includes(r.name)?'var(--accent-gold)':'var(--text-muted)',flexShrink:0,padding:0 }}>
                    {pinnedRoutes.includes(r.name)?'★':'☆'}
                  </button>

                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4 }}>
                    <span style={{ fontFamily:'Rajdhani,sans-serif',fontSize:14,fontWeight:700,color:'var(--text-primary)' }}>{r.name}</span>
                    <ProvenanceBadge category="commodity" name={r.name}/>
                  </div>
                    <div style={{ display:'flex',alignItems:'center',gap:8,fontSize:11,color:'var(--text-muted)',flexWrap:'wrap' }}>
                      <span style={{ display:'flex',alignItems:'center',gap:3 }}><MapPin size={9}/>{r.bestBuy.loc}</span>
                      <ArrowRight size={10}/>
                      <span style={{ display:'flex',alignItems:'center',gap:3 }}><MapPin size={9}/>{r.bestSell.loc}</span>
                    </div>
                  </div>

                  <div style={{ display:'grid',gridTemplateColumns:'repeat(4,80px)',gap:8,flexShrink:0 }}>
                    {[
                      ['Compra',`${r.bestBuy.price.toLocaleString('pt-BR',{maximumFractionDigits:2})} aUEC`,'var(--text-secondary)'],
                      ['Venda',`${r.bestSell.price.toLocaleString('pt-BR',{maximumFractionDigits:2})} aUEC`,'var(--text-secondary)'],
                      ['ROI',`${r.roi.toFixed(0)}%`,r.roi>50?'var(--accent-green)':r.roi>25?'var(--accent-gold)':'var(--text-secondary)'],
                      ['Lucro',`${r.profit.toLocaleString('pt-BR',{maximumFractionDigits:0})} aUEC`,'var(--accent-green)'],
                    ].map(([l,v,c])=>(
                      <div key={l} style={{ textAlign:'center',background:'var(--bg-panel)',borderRadius:5,padding:'5px' }}>
                        <div style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2 }}>{l}</div>
                        <div style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:c,fontWeight:700 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
