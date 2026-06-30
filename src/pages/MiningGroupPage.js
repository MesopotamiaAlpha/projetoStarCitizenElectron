import React, { useState, useMemo, useCallback } from 'react';
import {
  Pickaxe, Users, Plus, Trash2, Edit3, X, Save,
  ChevronDown, ChevronUp, MapPin, Package, DollarSign,
  Scale, AlertTriangle, CheckCircle2, RefreshCw,
  TrendingUp, Gem, Archive, Clock, Star, BarChart3, Search
} from 'lucide-react';

// ── Estoque ───────────────────────────────────────────────────────────────────
const KEY = 'sc_mining_group_v1';
function loadSessãos() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function saveSessãos(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

// ── Constants ─────────────────────────────────────────────────────────────────
const MINING_SHIPS   = ['Prospector','MOLE','Expanse','Cutlass Blue','Vulture','Outro'];
const LOCATIONS_LIST = ['Yela Asteroid Belt','Aaron Halo','Daymar','Cellin','Aberdeen','Calliope','Clio','Euterpe','Arial','Ita','Magda','Hurston','microTech','Pyro I','Pyro II','Pyro III','Outro'];
const REFINE_METHODS = ['CAMS Refinaria','CRU-L1 Refinaria','HUR-L1 Refinaria','ARC-L1 Refinaria','MIC-L1 Refinaria','Pyro Refinaria','Outro'];
const ORE_LIST       = ['Quantainium','Bexalite','Taranite','Laranite','Gold','Diamond','Tungsten','Copper','Titanium','Hephaestanite','Dolivine','Aluminum','Corundum','Borase','Agricium','Inert Material','Outro'];
const STORAGE_LOCS   = ['CRU-L1 Stash House','Port Tressler','Everus Harbor','Baijini Point','Area18 - Warehouse','Lorville - Warehouse','New Babbage - Warehouse','Ruin Station','Levski','Grim HEX','Outro'];
const SESSION_STATUS = ['Planejando','Em andamento','Refinando','Concluída','Cancelarada'];

const STATUS_COLORS = {
  'Planejando':'var(--accent-gold)','Em andamento':'var(--accent-primary)',
  'Refinando':'#a29bfe','Concluída':'var(--accent-green)','Cancelarada':'var(--text-muted)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function ptMoney(v) { return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:2}); }
function ptSCU(v)   { return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:3}); }
function fmtData(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'; }
function newId()    { return Date.now() + Math.random(); }

// ── Styles shared ─────────────────────────────────────────────────────────────
const IS = { width:'100%',padding:'7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none' };
const SS_STYLE = { ...IS,padding:'7px 26px 7px 10px',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 6px center' };
const LS = { fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 };

// ── Empty session factory ─────────────────────────────────────────────────────
function newSessão() {
  return {
    id: newId(),
    name: '',
    date: new Date().toISOString().slice(0,16),
    status: 'Planejando',
    location: 'Yela Asteroid Belt',
    ship: 'MOLE',
    refinery: '',
    refinery_duration_h: 0,
    notes: '',
    // Tripulação
    members: [],
    // Ores collected
    ores: [],
    // Costs
    costs: [],
    // Revenue (from selling)
    revenue: 0,
    revenue_notes: '',
    // Estoque entries
    storage: [],
    created_at: new Date().toISOString(),
  };
}

function newMember(name='') {
  return { id:newId(), name, role:'Mineiro', ship_contribution:'', scu_share_pct:0, scu_manual:0, division_mode:'equal', investment:0, prdeit_share_pct:0, paid:false, notes:'' };
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon:Icon, title, color='var(--accent-primary)' }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:10,paddingBottom:6,borderBottom:'1px solid var(--border-subtle)' }}>
      <Icon size={14} style={{ color,flexShrink:0 }}/>
      <span style={{ fontFamily:'Orbitron,monospace',fontSize:11,fontWeight:700,color,letterSpacing:'0.08em',textTransform:'uppercase' }}>{title}</span>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPI({ label, value, color='var(--text-primary)', unit='' }) {
  return (
    <div style={{ background:'var(--bg-panel)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'10px 14px',textAlign:'center' }}>
      <div style={{ fontFamily:'Orbitron,monospace',fontSize:16,fontWeight:800,color }}>{value}</div>
      <div style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,marginTop:2 }}>{label}</div>
      {unit && <div style={{ fontSize:9,color:'var(--text-muted)',marginTop:1 }}>{unit}</div>}
    </div>
  );
}

// ── Sessão Form ──────────────────────────────────────────────────────────────
function SessãoForm({ initial, onSave, onCancelar }) {
  const [s, setS] = useState(() => initial ? JSON.parse(JSON.stringify(initial)) : newSessão());
  const [tab, setTab] = useState('info'); // info | crew | ores | costs | storage | division
  const set = (k,v) => setS(p=>({...p,[k]:v}));

  // ── CREW helpers ──
  function addMember()      { setS(p=>({...p,members:[...p.members,newMember()]})); }
  function updateMember(i,k,v) { setS(p=>({...p,members:p.members.map((m,j)=>j===i?{...m,[k]:v}:m)})); }
  function removeMember(i)  { setS(p=>({...p,members:p.members.filter((_,j)=>j!==i)})); }

  // Auto-redistribute equal SCU % when members change
  function redistributeEqual() {
    if (s.members.length===0) return;
    const pct = +(100/s.members.length).toFixed(2);
    setS(p=>({...p,members:p.members.map((m,i)=>({...m,scu_share_pct:i<p.members.length-1?pct:+(100-(pct*(p.members.length-1))).toFixed(2)}))}));
  }

  // ── ORE helpers ──
  function addOre()        { setS(p=>({...p,ores:[...p.ores,{id:newId(),name:'Quantainium',raw_scu:0,refined_scu:0,yield_pct:80,price_per_scu:0}]})); }
  function updateOre(i,k,v){ setS(p=>({...p,ores:p.ores.map((o,j)=>j===i?{...o,[k]:v}:o)})); }
  function removeOre(i)    { setS(p=>({...p,ores:p.ores.filter((_,j)=>j!==i)})); }

  // ── COST helpers ──
  function addCost()       { setS(p=>({...p,costs:[...p.costs,{id:newId(),desc:'',amount:0,paid_by:''}]})); }
  function updateCost(i,k,v){ setS(p=>({...p,costs:p.costs.map((c,j)=>j===i?{...c,[k]:v}:c)})); }
  function removeCost(i)   { setS(p=>({...p,costs:p.costs.filter((_,j)=>j!==i)})); }

  // ── STORAGE helpers ──
  function addEstoque()      { setS(p=>({...p,storage:[...p.storage,{id:newId(),location:'CRU-L1 Stash House',owner:'',ore:'',scu:0,status:'Guardado',notes:''}]})); }
  function updateEstoque(i,k,v){ setS(p=>({...p,storage:p.storage.map((st,j)=>j===i?{...st,[k]:v}:st)})); }
  function removeEstoque(i)  { setS(p=>({...p,storage:p.storage.filter((_,j)=>j!==i)})); }

  // ── Computed totals ──
  const totalRawSCU      = s.ores.reduce((a,o)=>a+(Number(o.raw_scu)||0),0);
  const totalRefinedSCU  = s.ores.reduce((a,o)=>a+(Number(o.refined_scu)||0),0);
  const totalCosts       = s.costs.reduce((a,c)=>a+(Number(c.amount)||0),0);
  const netRevenue       = (Number(s.revenue)||0) - totalCosts;
  const memberNomes      = s.members.map(m=>m.name).filter(Boolean);

  const FORM_TABS = [
    {id:'info',     label:'Sessão',      icon:Pickaxe},
    {id:'crew',     label:`Tripulação (${s.members.length})`, icon:Users},
    {id:'ores',     label:`Minérios (${s.ores.length})`, icon:Gem},
    {id:'costs',    label:`Custos (${s.costs.length})`,  icon:DollarSign},
    {id:'storage',  label:`Estoque (${s.storage.length})`,icon:Archive},
    {id:'division', label:'Divisão',     icon:Scale},
  ];

  return (
    <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:10,padding:'18px',marginBottom:16 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
        <span style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.06em' }}>
          {initial?'EDITAR SESSÃO':'NOVA SESSÃO DE MINERAÇÃO'}
        </span>
        <button onClick={onCancelar} style={{ background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'4px 8px' }}><X size={13}/></button>
      </div>

      {/* Sub-tabs */}
      <div style={{ display:'flex',gap:0,marginBottom:16,border:'1px solid var(--border-subtle)',borderRadius:7,overflow:'hidden' }}>
        {FORM_TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'8px 6px',background:tab===t.id?'rgba(0,212,255,0.1)':'transparent',border:'none',borderRight:'1px solid var(--border-subtle)',color:tab===t.id?'var(--accent-primary)':'var(--text-secondary)',fontFamily:'Rajdhani,sans-serif',fontSize:11,fontWeight:700,cursor:'pointer',letterSpacing:'0.04em',textTransform:'uppercase' }}>
            <t.icon size={11}/><span style={{ display:'none' }}>{t.label}</span>
            <span style={{ fontSize:10 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── INFO TAB ── */}
      {tab==='info'&&(
        <div>
          <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,marginBottom:10 }}>
            <div><label style={LS}>Nome da Sessão</label><input style={IS} value={s.name} onChange={e=>set('name',e.target.value)} placeholder="ex: MOLE Run Yela — Quant Farm..."/></div>
            <div><label style={LS}>Data e Hora</label><input style={IS} type="datetime-local" value={s.date} onChange={e=>set('date',e.target.value)}/></div>
            <div><label style={LS}>Status</label>
              <select style={SS_STYLE} value={s.status} onChange={e=>set('status',e.target.value)}>
                {SESSION_STATUS.map(st=><option key={st}>{st}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10 }}>
            <div><label style={LS}>Local de Mining</label>
              <select style={SS_STYLE} value={s.location} onChange={e=>set('location',e.target.value)}>
                {LOCATIONS_LIST.map(l=><option key={l}>{l}</option>)}
              </select>
            </div>
            <div><label style={LS}>Nave Principal</label>
              <select style={SS_STYLE} value={s.ship} onChange={e=>set('ship',e.target.value)}>
                {MINING_SHIPS.map(sh=><option key={sh}>{sh}</option>)}
              </select>
            </div>
            <div><label style={LS}>Refinaria</label>
              <select style={SS_STYLE} value={s.refinery} onChange={e=>set('refinery',e.target.value)}>
                <option value="">— Selecionar —</option>
                {REFINE_METHODS.map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 3fr',gap:10,marginBottom:10 }}>
            <div><label style={LS}>Tempo de Refino (horas)</label><input style={IS} type="number" min="0" step="0.5" value={s.refinery_duration_h||''} onChange={e=>set('refinery_duration_h',Number(e.target.value))} placeholder="ex: 4.5"/></div>
            <div><label style={LS}>Notas gerais</label><input style={IS} value={s.notes} onChange={e=>set('notes',e.target.value)} placeholder="Estratégia, observações..."/></div>
          </div>

          {/* Quick summary */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:12 }}>
            <KPI label="Tripulação" value={s.members.length} color="var(--accent-primary)"/>
            <KPI label="SCU Bruto" value={ptSCU(totalRawSCU)} color="var(--accent-gold)" unit="SCU"/>
            <KPI label="SCU Refinado" value={ptSCU(totalRefinedSCU)} color="var(--accent-green)" unit="SCU"/>
            <KPI label="Receita - Custos" value={`${ptMoney(netRevenue)} aUEC`} color={netRevenue>=0?'var(--accent-green)':'var(--accent-red)'}/>
          </div>
        </div>
      )}

      {/* ── CREW TAB ── */}
      {tab==='crew'&&(
        <div>
          <div style={{ display:'flex',gap:8,marginBottom:12,alignItems:'center' }}>
            <button onClick={addMember} style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',borderRadius:6,color:'var(--accent-green)',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase' }}>
              <Plus size={13}/> Adicionar Membro
            </button>
            {s.members.length>1&&(
              <button onClick={redistributeEqual} style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 12px',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-normal)',borderRadius:6,color:'var(--accent-primary)',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase' }}>
                <Scale size={13}/> Dividir Igual (SCU %)
              </button>
            )}
          </div>
          {s.members.length===0&&(
            <div style={{ textAlign:'center',padding:'30px 20px',color:'var(--text-muted)',fontSize:13 }}>
              <Users size={36} style={{ display:'block',margin:'0 auto 10px',opacity:0.2 }}/>
              Nenhum membro adicionado ainda.
            </div>
          )}
          {s.members.map((m,i)=>(
            <div key={m.id} style={{ background:'var(--bg-panel)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'12px',marginBottom:8 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <div style={{ width:28,height:28,borderRadius:'50%',background:'rgba(0,212,255,0.1)',border:'1px solid rgba(0,212,255,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Orbitron,monospace',fontSize:11,color:'var(--accent-primary)',fontWeight:700 }}>{i+1}</div>
                  <input style={{ ...IS,width:160,fontWeight:700 }} value={m.name} onChange={e=>updateMember(i,'name',e.target.value)} placeholder="Nome do jogador"/>
                </div>
                <button onClick={()=>removeMember(i)} style={{ width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:4,color:'var(--accent-red)',cursor:'pointer' }}><Trash2 size={11}/></button>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:8 }}>
                <div><label style={LS}>Função</label>
                  <select style={SS_STYLE} value={m.role} onChange={e=>updateMember(i,'role',e.target.value)}>
                    {['Mineiro','Pilotoo','Artilheiro','Explorador','Refinador','Investidor','Outro'].map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div><label style={LS}>Nave Própria</label><input style={IS} value={m.ship_contribution||''} onChange={e=>updateMember(i,'ship_contribution',e.target.value)} placeholder="Prospector, MOLE..."/></div>
                <div><label style={LS}>% SCU (parte)</label>
                  <input style={IS} type="number" min="0" max="100" step="0.01" value={m.scu_share_pct||''} onChange={e=>updateMember(i,'scu_share_pct',Number(e.target.value))} placeholder="ex: 33.33"/>
                </div>
                <div><label style={LS}>Investimento (aUEC)</label>
                  <input style={IS} type="text" inputMode="numeric" value={m.investment?ptMoney(m.investment):''} onChange={e=>updateMember(i,'investment',Number(String(e.target.value).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,''))||0)} placeholder="0"/>
                </div>
                <div><label style={LS}>% Lucro</label>
                  <input style={IS} type="number" min="0" max="100" step="0.01" value={m.prdeit_share_pct||''} onChange={e=>updateMember(i,'prdeit_share_pct',Number(e.target.value))} placeholder="ex: 25"/>
                </div>
              </div>
              <div style={{ marginTop:6 }}>
                <input style={{ ...IS,fontSize:11 }} value={m.notes||''} onChange={e=>updateMember(i,'notes',e.target.value)} placeholder="Observações sobre este membro..."/>
              </div>
            </div>
          ))}
          {/* Validation: total % */}
          {s.members.length>0&&(()=>{
            const totalPct=s.members.reduce((a,m)=>a+(Number(m.scu_share_pct)||0),0);
            const diff=Math.abs(totalPct-100);
            return diff>0.1?(
              <div style={{ display:'flex',alignItems:'center',gap:7,padding:'8px 12px',background:'rgba(255,196,54,0.08)',border:'1px solid rgba(255,196,54,0.25)',borderRadius:6,fontSize:12,color:'var(--accent-gold)',marginTop:4 }}>
                <AlertTriangle size={13}/>Total de % SCU: {totalPct.toFixed(2)}% (deve ser 100%)
              </div>
            ):null;
          })()}
        </div>
      )}

      {/* ── ORES TAB ── */}
      {tab==='ores'&&(
        <div>
          <button onClick={addOre} style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:'rgba(255,196,54,0.1)',border:'1px solid rgba(255,196,54,0.3)',borderRadius:6,color:'var(--accent-gold)',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase',marginBottom:12 }}>
            <Plus size={13}/> Adicionar Minério
          </button>
          {s.ores.length===0&&<div style={{ textAlign:'center',padding:'30px',color:'var(--text-muted)',fontSize:13 }}>Nenhum minério registrado.</div>}
          {s.ores.map((o,i)=>(
            <div key={o.id} style={{ background:'var(--bg-panel)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'12px',marginBottom:8 }}>
              <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr auto',gap:8,alignItems:'end' }}>
                <div><label style={LS}>Minério</label>
                  <select style={SS_STYLE} value={o.name} onChange={e=>updateOre(i,'name',e.target.value)}>
                    {ORE_LIST.map(ore=><option key={ore}>{ore}</option>)}
                  </select>
                </div>
                <div><label style={LS}>SCU Bruto</label><input style={IS} type="number" min="0" step="0.001" value={o.raw_scu||''} onChange={e=>updateOre(i,'raw_scu',Number(e.target.value))} placeholder="0"/></div>
                <div><label style={LS}>SCU Refinado</label><input style={IS} type="number" min="0" step="0.001" value={o.refined_scu||''} onChange={e=>updateOre(i,'refined_scu',Number(e.target.value))} placeholder="0"/></div>
                <div><label style={LS}>Rendimento %</label><input style={IS} type="number" min="0" max="100" value={o.yield_pct||''} onChange={e=>updateOre(i,'yield_pct',Number(e.target.value))} placeholder="80"/></div>
                <div><label style={LS}>Preço/SCU (aUEC)</label><input style={IS} type="number" min="0" value={o.price_per_scu||''} onChange={e=>updateOre(i,'price_per_scu',Number(e.target.value))} placeholder="0"/></div>
                <button onClick={()=>removeOre(i)} style={{ width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer',marginBottom:0,marginTop:16 }}><Trash2 size={12}/></button>
              </div>
              {o.refined_scu>0&&o.price_per_scu>0&&(
                <div style={{ marginTop:6,fontSize:11,color:'var(--accent-green)',fontFamily:'Share Tech Mono,monospace' }}>
                  → Valor estimado: {ptMoney(o.refined_scu*o.price_per_scu)} aUEC ({ptSCU(o.refined_scu)} SCU × {ptMoney(o.price_per_scu)} aUEC/SCU)
                </div>
              )}
            </div>
          ))}
          {s.ores.length>0&&(
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:10 }}>
              <KPI label="Total SCU Bruto"    value={ptSCU(totalRawSCU)}     color="var(--accent-gold)"   unit="SCU"/>
              <KPI label="Total SCU Refinado" value={ptSCU(totalRefinedSCU)} color="var(--accent-green)"  unit="SCU"/>
              <KPI label="Valor Estimado"     value={`${ptMoney(s.ores.reduce((a,o)=>a+(o.refined_scu||0)*(o.price_per_scu||0),0))} aUEC`} color="var(--accent-green)"/>
            </div>
          )}
        </div>
      )}

      {/* ── COSTS TAB ── */}
      {tab==='costs'&&(
        <div>
          <div style={{ display:'flex',gap:8,marginBottom:12 }}>
            <button onClick={addCost} style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:'rgba(255,68,102,0.1)',border:'1px solid rgba(255,68,102,0.3)',borderRadius:6,color:'var(--accent-red)',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase' }}>
              <Plus size={13}/> Adicionar Custo
            </button>
          </div>

          {/* Revenue */}
          <div style={{ background:'rgba(0,229,160,0.05)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:8,padding:'12px',marginBottom:12 }}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 2fr',gap:10 }}>
              <div><label style={{ ...LS,color:'var(--accent-green)' }}>Receita Total (aUEC)</label>
                <input style={IS} type="text" inputMode="numeric"
                  value={s.revenue?ptMoney(s.revenue):''}
                  onChange={e=>set('revenue',Number(String(e.target.value).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,''))||0)}
                  placeholder="ex: 1.500.000"/>
              </div>
              <div><label style={{ ...LS,color:'var(--accent-green)' }}>Notas da Receita</label>
                <input style={IS} value={s.revenue_notes||''} onChange={e=>set('revenue_notes',e.target.value)} placeholder="ex: Vendido em CRU-L1, preço médio..."/>
              </div>
            </div>
          </div>

          {s.costs.length===0&&<div style={{ textAlign:'center',padding:'20px',color:'var(--text-muted)',fontSize:13 }}>Nenhum custo registrado.</div>}
          {s.costs.map((c,i)=>(
            <div key={c.id} style={{ display:'grid',gridTemplateColumns:'3fr 1fr 1fr auto',gap:8,alignItems:'end',marginBottom:7 }}>
              <div><label style={LS}>Descrição do Custo</label><input style={IS} value={c.desc} onChange={e=>updateCost(i,'desc',e.target.value)} placeholder="ex: Refino em CRU-L1, Taxa de mineração..."/></div>
              <div><label style={LS}>Valor (aUEC)</label>
                <input style={IS} type="text" inputMode="numeric"
                  value={c.amount?ptMoney(c.amount):''}
                  onChange={e=>updateCost(i,'amount',Number(String(e.target.value).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,''))||0)}
                  placeholder="0"/>
              </div>
              <div><label style={LS}>Pago por</label>
                <select style={SS_STYLE} value={c.paid_by} onChange={e=>updateCost(i,'paid_by',e.target.value)}>
                  <option value="">— Quem pagou —</option>
                  {memberNomes.map(n=><option key={n}>{n}</option>)}
                  <option value="Grupo">Grupo (rateado)</option>
                </select>
              </div>
              <button onClick={()=>removeCost(i)} style={{ width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer',marginTop:16 }}><Trash2 size={12}/></button>
            </div>
          ))}

          {(totalCosts>0||s.revenue>0)&&(
            <div style={{ marginTop:12,padding:'10px 14px',background:'var(--bg-panel)',border:'1px solid var(--border-subtle)',borderRadius:7 }}>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8 }}>
                <KPI label="Receita"  value={`${ptMoney(s.revenue)} aUEC`}   color="var(--accent-green)"/>
                <KPI label="Custos"   value={`-${ptMoney(totalCosts)} aUEC`}  color="var(--accent-red)"/>
                <KPI label="NET"      value={`${ptMoney(netRevenue)} aUEC`}   color={netRevenue>=0?'var(--accent-green)':'var(--accent-red)'}/>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STORAGE TAB ── */}
      {tab==='storage'&&(
        <div>
          <button onClick={addEstoque} style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:'rgba(0,119,255,0.1)',border:'1px solid rgba(0,119,255,0.3)',borderRadius:6,color:'var(--accent-secondary)',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase',marginBottom:12 }}>
            <Plus size={13}/> Adicionar Local de Estoque
          </button>
          {s.storage.length===0&&<div style={{ textAlign:'center',padding:'30px',color:'var(--text-muted)',fontSize:13 }}>Nenhum estoque registrado.</div>}
          {s.storage.map((st,i)=>(
            <div key={st.id} style={{ background:'var(--bg-panel)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'11px',marginBottom:7 }}>
              <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr auto',gap:8,alignItems:'end' }}>
                <div><label style={LS}>Local de Armazenamento</label>
                  <select style={SS_STYLE} value={st.location} onChange={e=>updateEstoque(i,'location',e.target.value)}>
                    {STORAGE_LOCS.map(l=><option key={l}>{l}</option>)}
                  </select>
                </div>
                <div><label style={LS}>Dono</label>
                  <select style={SS_STYLE} value={st.owner} onChange={e=>updateEstoque(i,'owner',e.target.value)}>
                    <option value="">— Selecionar —</option>
                    {memberNomes.map(n=><option key={n}>{n}</option>)}
                    <option value="Grupo">Grupo</option>
                  </select>
                </div>
                <div><label style={LS}>Minério</label>
                  <select style={SS_STYLE} value={st.ore} onChange={e=>updateEstoque(i,'ore',e.target.value)}>
                    <option value="">— Tipo —</option>
                    {s.ores.map(o=><option key={o.id}>{o.name}</option>)}
                    {ORE_LIST.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div><label style={LS}>Quantidade (SCU)</label><input style={IS} type="number" min="0" step="0.001" value={st.scu||''} onChange={e=>updateEstoque(i,'scu',Number(e.target.value))} placeholder="0"/></div>
                <div><label style={LS}>Status</label>
                  <select style={SS_STYLE} value={st.status||'Guardado'} onChange={e=>updateEstoque(i,'status',e.target.value)}>
                    {['Guardado','Aguardando Refino','Refinando','Pronto para Venda','Vendido'].map(st=><option key={st}>{st}</option>)}
                  </select>
                </div>
                <button onClick={()=>removeEstoque(i)} style={{ width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer',marginTop:16 }}><Trash2 size={12}/></button>
              </div>
              <div style={{ marginTop:6 }}>
                <input style={{ ...IS,fontSize:11 }} value={st.notes||''} onChange={e=>updateEstoque(i,'notes',e.target.value)} placeholder="Observações..."/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── DIVISION TAB ── */}
      {tab==='division'&&(
        <DivisãoTab session={s} totalRefinedSCU={totalRefinedSCU} totalCosts={totalCosts} netRevenue={netRevenue}/>
      )}

      {/* Save/Cancelar */}
      <div style={{ display:'flex',gap:8,justifyContent:'flex-end',marginTop:16,paddingTop:12,borderTop:'1px solid var(--border-subtle)' }}>
        <button onClick={onCancelar} style={{ padding:'9px 18px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase' }}>Cancelar</button>
        <button onClick={()=>{ if(!s.name.trim()){alert('Nome da sessão obrigatório.');return;} onSave(s); }} style={{ display:'flex',alignItems:'center',gap:7,padding:'9px 22px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.35)',borderRadius:6,color:'var(--accent-green)',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase' }}>
          <Save size={13}/>{initial?'Salvar Alterações':'Criar Sessão'}
        </button>
      </div>
    </div>
  );
}

// ── Divisão Calculator ───────────────────────────────────────────────────────
function DivisãoTab({ session:s, totalRefinedSCU, totalCosts, netRevenue }) {
  const members = s.members;
  if (members.length===0) return (
    <div style={{ textAlign:'center',padding:'40px 20px',color:'var(--text-muted)',fontSize:13 }}>
      <Users size={36} style={{ display:'block',margin:'0 auto 10px',opacity:0.2 }}/>
      Adicione membros na aba "Tripulação" para ver a divisão.
    </div>
  );

  const totalInvestimento = members.reduce((a,m)=>a+(Number(m.investment)||0),0);

  // Per-member calculations
  const memberCalcs = members.map(m=>{
    const scuPct        = Number(m.scu_share_pct)||0;
    const scuQuantidade     = totalRefinedSCU * (scuPct/100);
    const prdeitPct     = Number(m.prdeit_share_pct)||0;
    const prdeitQuantidade  = Math.max(0,netRevenue) * (prdeitPct/100);
    const investment    = Number(m.investment)||0;
    const costShare     = totalCosts > 0 && members.length > 0 ? totalCosts/members.length : 0;
    // Reembolso: if they paid more than their share
    const paidForGrupo  = s.costs.filter(c=>c.paid_by===m.name).reduce((a,c)=>a+(Number(c.amount)||0),0);
    const reimbursement = paidForGrupo - costShare;

    // Find their storage
    const myEstoque = s.storage.filter(st=>st.owner===m.name);

    return { ...m, scuPct, scuQuantidade, prdeitPct, prdeitQuantidade, investment, costShare, paidForGrupo, reimbursement, myEstoque };
  });

  // Validation
  const totalScuPct    = members.reduce((a,m)=>a+(Number(m.scu_share_pct)||0),0);
  const totalPrdeitPct = members.reduce((a,m)=>a+(Number(m.prdeit_share_pct)||0),0);

  return (
    <div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14 }}>
        <KPI label="SCU Total Refinado" value={`${ptSCU(totalRefinedSCU)} SCU`}   color="var(--accent-gold)"/>
        <KPI label="Receita Bruta"      value={`${ptMoney(s.revenue||0)} aUEC`}  color="var(--accent-green)"/>
        <KPI label="Total de Custos"    value={`-${ptMoney(totalCosts)} aUEC`}   color="var(--accent-red)"/>
        <KPI label="NET (dist.)"        value={`${ptMoney(netRevenue)} aUEC`}    color={netRevenue>=0?'var(--accent-green)':'var(--accent-red)'}/>
      </div>

      {/* Validation warnings */}
      {Math.abs(totalScuPct-100)>0.1&&members.some(m=>m.scu_share_pct>0)&&(
        <div style={{ display:'flex',alignItems:'center',gap:7,padding:'8px 12px',background:'rgba(255,196,54,0.08)',border:'1px solid rgba(255,196,54,0.25)',borderRadius:6,fontSize:12,color:'var(--accent-gold)',marginBottom:10 }}>
          <AlertTriangle size={13}/>% SCU soma {totalScuPct.toFixed(2)}% — deveria ser 100%
        </div>
      )}
      {Math.abs(totalPrdeitPct-100)>0.1&&members.some(m=>m.prdeit_share_pct>0)&&(
        <div style={{ display:'flex',alignItems:'center',gap:7,padding:'8px 12px',background:'rgba(255,196,54,0.08)',border:'1px solid rgba(255,196,54,0.25)',borderRadius:6,fontSize:12,color:'var(--accent-gold)',marginBottom:10 }}>
          <AlertTriangle size={13}/>% Lucro soma {totalPrdeitPct.toFixed(2)}% — deveria ser 100%
        </div>
      )}

      {/* Per-member cards */}
      <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
        {memberCalcs.map((m,i)=>(
          <div key={m.id} style={{ background:'var(--bg-panel)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'12px' }}>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
              <div style={{ width:32,height:32,borderRadius:'50%',background:'rgba(0,212,255,0.1)',border:'1px solid rgba(0,212,255,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Orbitron,monospace',fontSize:12,color:'var(--accent-primary)',fontWeight:800,flexShrink:0 }}>{i+1}</div>
              <div>
                <div style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{m.name||`Jogador ${i+1}`}</div>
                <div style={{ fontSize:10,color:'var(--text-muted)' }}>{m.role}{m.ship_contribution?` · ${m.ship_contribution}`:''}</div>
              </div>
            </div>

            <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8 }}>
              {/* SCU share */}
              <div style={{ background:'rgba(255,196,54,0.08)',border:'1px solid rgba(255,196,54,0.2)',borderRadius:6,padding:'9px',textAlign:'center' }}>
                <div style={{ fontSize:9,color:'var(--accent-gold)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4 }}>SCU Refinado</div>
                <div style={{ fontFamily:'Orbitron,monospace',fontSize:16,fontWeight:800,color:'var(--accent-gold)' }}>{ptSCU(m.scuQuantidade)}</div>
                <div style={{ fontSize:10,color:'var(--text-muted)',marginTop:2 }}>{m.scuPct}% do total</div>
              </div>
              {/* Prdeit share */}
              <div style={{ background:'rgba(0,229,160,0.06)',border:'1px solid rgba(0,229,160,0.18)',borderRadius:6,padding:'9px',textAlign:'center' }}>
                <div style={{ fontSize:9,color:'var(--accent-green)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4 }}>Parte do Lucro</div>
                <div style={{ fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:800,color:'var(--accent-green)' }}>{ptMoney(m.prdeitQuantidade)}</div>
                <div style={{ fontSize:10,color:'var(--text-muted)',marginTop:2 }}>{m.prdeitPct}% · aUEC</div>
              </div>
              {/* Cost share */}
              <div style={{ background:'rgba(255,68,102,0.05)',border:'1px solid rgba(255,68,102,0.15)',borderRadius:6,padding:'9px',textAlign:'center' }}>
                <div style={{ fontSize:9,color:'var(--accent-red)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4 }}>Parte dos Custos</div>
                <div style={{ fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:800,color:'var(--accent-red)' }}>{ptMoney(m.costShare)}</div>
                <div style={{ fontSize:10,color:'var(--text-muted)',marginTop:2 }}>aUEC</div>
              </div>
              {/* Reembolso */}
              <div style={{ background:m.reimbursement>0?'rgba(0,212,255,0.06)':'rgba(255,255,255,0.03)',border:`1px solid ${m.reimbursement>0?'rgba(0,212,255,0.2)':'var(--border-subtle)'}`,borderRadius:6,padding:'9px',textAlign:'center' }}>
                <div style={{ fontSize:9,color:m.reimbursement>0?'var(--accent-primary)':'var(--text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4 }}>Reembolso</div>
                <div style={{ fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:800,color:m.reimbursement>0?'var(--accent-primary)':m.reimbursement<0?'var(--accent-red)':'var(--text-muted)' }}>
                  {m.reimbursement>0?'+':''}{ptMoney(m.reimbursement)}
                </div>
                <div style={{ fontSize:10,color:'var(--text-muted)',marginTop:2 }}>{m.paidForGrupo>0?`Pagou ${ptMoney(m.paidForGrupo)}`:'Não pagou custos'}</div>
              </div>
            </div>

            {/* Estoque */}
            {m.myEstoque.length>0&&(
              <div style={{ marginTop:8,padding:'7px 10px',background:'rgba(0,119,255,0.06)',border:'1px solid rgba(0,119,255,0.15)',borderRadius:5 }}>
                <div style={{ fontSize:10,fontWeight:700,color:'var(--accent-secondary)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5,display:'flex',alignItems:'center',gap:5 }}>
                  <Archive size={10}/> Estoque
                </div>
                <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                  {m.myEstoque.map((st,si)=>(
                    <span key={si} style={{ fontSize:11,padding:'3px 8px',background:'rgba(0,119,255,0.08)',border:'1px solid rgba(0,119,255,0.2)',borderRadius:5,color:'var(--accent-secondary)' }}>
                      <MapPin size={9} style={{ marginRight:3 }}/>{st.location}: {st.ore} — {ptSCU(st.scu)} SCU <span style={{ color:'var(--text-muted)' }}>({st.status})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notas */}
            {m.notes&&<div style={{ marginTop:6,fontSize:11,color:'var(--text-muted)',fontStyle:'italic' }}>📝 {m.notes}</div>}
          </div>
        ))}
      </div>

      {/* Total investment */}
      {totalInvestimento>0&&(
        <div style={{ marginTop:12,padding:'10px 14px',background:'var(--bg-panel)',border:'1px solid var(--border-subtle)',borderRadius:7 }}>
          <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Investimentos Realizados</div>
          <div style={{ display:'flex',gap:10,flexWrap:'wrap' }}>
            {members.filter(m=>m.investment>0).map(m=>(
              <span key={m.id} style={{ fontSize:12,color:'var(--text-secondary)' }}>
                {m.name||'?'}: <span style={{ color:'var(--accent-gold)',fontFamily:'Share Tech Mono,monospace',fontWeight:700 }}>{ptMoney(m.investment)} aUEC</span>
              </span>
            ))}
            <span style={{ marginLeft:'auto',fontSize:12,fontWeight:700,color:'var(--accent-primary)' }}>Total: {ptMoney(totalInvestimento)} aUEC</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sessão Card (list view) ──────────────────────────────────────────────────
function SessãoCard({ session:s, onEdit, onDelete }) {
  const [expanded,setExpandired]=useState(false);
  const [delConf,setDelConf]=useState(false);
  const totalRefinedSCU = s.ores.reduce((a,o)=>a+(Number(o.refined_scu)||0),0);
  const totalCosts      = s.costs.reduce((a,c)=>a+(Number(c.amount)||0),0);
  const netRevenue      = (Number(s.revenue)||0)-totalCosts;
  const statusColor     = STATUS_COLORS[s.status]||'var(--text-muted)';

  return (
    <div style={{ background:'var(--bg-card)',border:`1px solid ${s.status==='Concluída'?'rgba(0,229,160,0.2)':'var(--border-subtle)'}`,borderRadius:9,overflow:'hidden',marginBottom:10,transition:'all 0.2s' }}>
      <div style={{ display:'flex',alignItems:'center',gap:12,padding:'13px 16px',cursor:'pointer' }} onClick={()=>setExpandired(!expanded)}>
        <div style={{ width:38,height:38,borderRadius:8,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:`${statusColor}18`,border:`1px solid ${statusColor}33` }}>
          <Pickaxe size={18} style={{ color:statusColor }}/>
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap' }}>
            <span style={{ fontFamily:'Rajdhani,sans-serif',fontSize:14,fontWeight:700,color:'var(--text-primary)' }}>{s.name||'Sessão sem nome'}</span>
            <span style={{ fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:3,background:`${statusColor}18`,color:statusColor,border:`1px solid ${statusColor}33` }}>{s.status}</span>
            {s.members.length>0&&<span style={{ fontSize:11,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:3 }}><Users size={10}/>{s.members.length} crew</span>}
          </div>
          <div style={{ display:'flex',gap:12,fontSize:11,color:'var(--text-muted)',flexWrap:'wrap' }}>
            <span style={{ display:'flex',alignItems:'center',gap:3 }}><MapPin size={9}/>{s.location}</span>
            <span>{s.ship}</span>
            {s.ores.length>0&&<span style={{ color:'var(--accent-gold)' }}>{ptSCU(totalRefinedSCU)} SCU refinado</span>}
            <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:10 }}>{fmtData(s.date)}</span>
          </div>
        </div>
        <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5,flexShrink:0 }}>
          {(s.revenue>0||totalCosts>0)&&(
            <div style={{ textAlign:'right' }}>
              {s.revenue>0&&<div style={{ fontSize:12,color:'var(--accent-green)',fontFamily:'Share Tech Mono,monospace',fontWeight:700 }}>+{ptMoney(s.revenue)} aUEC</div>}
              {totalCosts>0&&<div style={{ fontSize:11,color:'var(--accent-red)',fontFamily:'Share Tech Mono,monospace' }}>-{ptMoney(totalCosts)} aUEC</div>}
              <div style={{ fontFamily:'Orbitron,monospace',fontSize:11,fontWeight:800,color:netRevenue>=0?'var(--accent-green)':'var(--accent-red)' }}>NET {ptMoney(netRevenue)}</div>
            </div>
          )}
          <div style={{ display:'flex',gap:5 }} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>onEdit(s)} style={{ width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-normal)',borderRadius:5,color:'var(--accent-primary)',cursor:'pointer' }}><Edit3 size={12}/></button>
            {delConf?(
              <div style={{ display:'flex',gap:4,alignItems:'center' }}>
                <button onClick={()=>onDelete(s.id)} style={{ padding:'3px 7px',background:'rgba(255,68,102,0.15)',border:'1px solid rgba(255,68,102,0.4)',borderRadius:4,color:'var(--accent-red)',cursor:'pointer',fontSize:11,fontWeight:700 }}>Sim</button>
                <button onClick={()=>setDelConf(false)} style={{ padding:'3px 7px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-secondary)',cursor:'pointer',fontSize:11 }}>Não</button>
              </div>
            ):(
              <button onClick={()=>setDelConf(true)} style={{ width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer' }}><Trash2 size={12}/></button>
            )}
            {expanded?<ChevronUp size={13} style={{ color:'var(--text-muted)'}}/>:<ChevronDown size={13} style={{ color:'var(--text-muted)'}}/>}
          </div>
        </div>
      </div>

      {expanded&&(
        <div style={{ padding:'12px 16px',borderTop:'1px solid var(--border-subtle)',background:'rgba(0,0,0,0.1)' }}>
          {/* Ores */}
          {s.ores.length>0&&(
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--accent-gold)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:7,display:'flex',alignItems:'center',gap:5 }}><Gem size={11}/>Minérios</div>
              <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                {s.ores.map((o,i)=>(
                  <div key={i} style={{ padding:'5px 10px',background:'rgba(255,196,54,0.08)',border:'1px solid rgba(255,196,54,0.2)',borderRadius:6,fontSize:11 }}>
                    <span style={{ color:'var(--accent-gold)',fontWeight:700 }}>{o.name}</span>
                    <span style={{ color:'var(--text-muted)',marginLeft:6 }}>{ptSCU(o.refined_scu)} SCU refinado</span>
                    {o.price_per_scu>0&&<span style={{ color:'var(--accent-green)',marginLeft:6 }}>≈{ptMoney(o.refined_scu*o.price_per_scu)} aUEC</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Estoque */}
          {s.storage.length>0&&(
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--accent-secondary)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:7,display:'flex',alignItems:'center',gap:5 }}><Archive size={11}/>Estoque</div>
              <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                {s.storage.map((st,i)=>(
                  <div key={i} style={{ padding:'5px 10px',background:'rgba(0,119,255,0.07)',border:'1px solid rgba(0,119,255,0.2)',borderRadius:6,fontSize:11 }}>
                    <MapPin size={9} style={{ color:'var(--accent-secondary)',marginRight:4 }}/>
                    <span style={{ color:'var(--text-secondary)' }}>{st.owner?`${st.owner} — `:'Grupo — '}</span>
                    <span style={{ color:'var(--accent-secondary)',fontWeight:700 }}>{st.ore||'Minério'}</span>
                    <span style={{ color:'var(--text-muted)',marginLeft:4 }}>{ptSCU(st.scu)} SCU em {st.location}</span>
                    <span style={{ marginLeft:4,fontSize:10,color:'var(--text-muted)' }}>({st.status})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Members quick */}
          {s.members.length>0&&(
            <div>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--accent-primary)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:7,display:'flex',alignItems:'center',gap:5 }}><Users size={11}/>Tripulação</div>
              <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                {s.members.map((m,i)=>{
                  const scuShare = totalRefinedSCU*(Number(m.scu_share_pct)||0)/100;
                  return (
                    <div key={i} style={{ padding:'5px 10px',background:'rgba(0,212,255,0.06)',border:'1px solid rgba(0,212,255,0.15)',borderRadius:6,fontSize:11 }}>
                      <span style={{ color:'var(--accent-primary)',fontWeight:700 }}>{m.name||`Jogador ${i+1}`}</span>
                      <span style={{ color:'var(--text-muted)',marginLeft:6 }}>{m.role}</span>
                      {scuShare>0&&<span style={{ color:'var(--accent-gold)',marginLeft:6 }}>{ptSCU(scuShare)} SCU</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {s.notes&&<div style={{ marginTop:8,fontSize:11,color:'var(--text-muted)',fontStyle:'italic' }}>📝 {s.notes}</div>}
          {s.refinery&&<div style={{ marginTop:5,fontSize:11,color:'var(--text-muted)' }}>⚗️ Refinaria: {s.refinery}{s.refinery_duration_h>0?` · ${s.refinery_duration_h}h de refino`:''}</div>}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MiningGrupoPage() {
  const [section,    setSesscao]    = useState(loadSessãos);
  const [showForm,    setShowForm]    = useState(false);
  const [editSessão, setEditSessão] = useState(null);
  const [search,      setSearch]      = useState('');
  const [filterStatus,setFilterStatus]= useState('all');
  const [activeTab,   setActiveTab]   = useState('section'); // section | stats

  function persist(updated) { setSesscao(updated); saveSessãos(updated); }
  function handleSave(s)    { persist(section.some(x=>x.id===s.id)?section.map(x=>x.id===s.id?s:x):[s,...section]); setShowForm(false); setEditSessão(null); }
  function handleDelete(id) { persist(section.filter(s=>s.id!==id)); }

  const filtered = useMemo(()=>section.filter(s=>{
    if(search&&!s.name.toLowerCase().includes(search.toLowerCase())&&!s.location?.toLowerCase().includes(search.toLowerCase())) return false;
    if(filterStatus!=='all'&&s.status!==filterStatus) return false;
    return true;
  }),[section,search,filterStatus]);

  // Global stats
  const allCompleted  = section.filter(s=>s.status==='Concluída');
  const totalScuTodos   = allCompleted.reduce((a,s)=>a+s.ores.reduce((b,o)=>b+(Number(o.refined_scu)||0),0),0);
  const totalRevTodos   = allCompleted.reduce((a,s)=>a+(Number(s.revenue)||0),0);
  const totalCostTodos  = allCompleted.reduce((a,s)=>a+s.costs.reduce((b,c)=>b+(Number(c.amount)||0),0),0);
  const totalNetTodos   = totalRevTodos - totalCostTodos;
  const avgScuSessão = allCompleted.length>0?totalScuTodos/allCompleted.length:0;

  const SS={padding:'7px 24px 7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 6px center'};

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">MINERAÇÃO EM GRUPO</div>
          <div className="page-subtitle">{section.length} section · {allCompleted.length} concluídas · {ptSCU(totalScuTodos)} SCU refinado total</div>
        </div>
        {!showForm&&!editSessão&&activeTab==='section'&&(
          <button onClick={()=>setShowForm(true)} style={{ display:'flex',alignItems:'center',gap:7,padding:'10px 18px',background:'rgba(255,196,54,0.1)',border:'1px solid rgba(255,196,54,0.35)',borderRadius:8,color:'var(--accent-gold)',fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer' }}>
            <Plus size={15}/> Nova Sessão
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ padding:'0 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',display:'flex',flexShrink:0 }}>
        {[{id:'section',label:'Sessões',icon:Pickaxe},{id:'stats',label:'Estatísticas',icon:BarChart3||TrendingUp}].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ display:'flex',alignItems:'center',gap:7,padding:'11px 18px',background:'transparent',border:'none',borderBottom:`2px solid ${activeTab===t.id?'var(--accent-gold)':'transparent'}`,color:activeTab===t.id?'var(--accent-gold)':'var(--text-secondary)',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer',transition:'all 0.2s' }}>
            <t.icon size={13}/>{t.label}
          </button>
        ))}
      </div>

      <div className="page-body">
        {/* SESSIONS TAB */}
        {activeTab==='section'&&(
          <div>
            {(showForm||editSessão)&&(
              <SessãoForm initial={editSessão} onSave={handleSave} onCancelar={()=>{setShowForm(false);setEditSessão(null);}}/>
            )}
            {!showForm&&!editSessão&&(
              <>
                <div style={{ display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center' }}>
                  <div style={{ position:'relative',flex:'1 1 180px' }}>
                    <Search size={12} style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }}/>
                    <input className="search-input" style={{ paddingLeft:28,width:'100%' }} placeholder="Buscar sessão, local..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  </div>
                  <select style={SS} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                    <option value="all">Todos Status</option>
                    {SESSION_STATUS.map(s=><option key={s}>{s}</option>)}
                  </select>
                  <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-muted)' }}>{filtered.length} section</span>
                </div>
                {filtered.length===0?(
                  <div className="empty-state">
                    <Pickaxe size={56} className="empty-state-icon"/>
                    <div className="empty-state-title">{section.length===0?'NENHUMA SESSÃO REGISTRADA':'NENHUM RESULTADO'}</div>
                    <div className="empty-state-text">{section.length===0?'Clique em "Nova Sessão" para registrar sua primeira sessão de mineração em grupo.':''}</div>
                    {section.length===0&&<button onClick={()=>setShowForm(true)} style={{ display:'flex',alignItems:'center',gap:7,padding:'10px 20px',background:'rgba(255,196,54,0.1)',border:'1px solid rgba(255,196,54,0.35)',borderRadius:8,color:'var(--accent-gold)',fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',textTransform:'uppercase',marginTop:8 }}><Plus size={14}/>Nova Sessão</button>}
                  </div>
                ):(
                  filtered.map(s=><SessãoCard key={s.id} session={s} onEdit={s=>{setEditSessão(s);setShowForm(false);}} onDelete={handleDelete}/>)
                )}
              </>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {activeTab==='stats'&&(
          <div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:18 }}>
              <KPI label="Sessões Totais"    value={section.length}                          color="var(--accent-primary)"/>
              <KPI label="SCU Total Refinado" value={`${ptSCU(totalScuTodos)} SCU`}            color="var(--accent-gold)"/>
              <KPI label="Receita Total"      value={`${ptMoney(totalRevTodos)} aUEC`}          color="var(--accent-green)"/>
              <KPI label="Custos Totais"      value={`-${ptMoney(totalCostTodos)} aUEC`}        color="var(--accent-red)"/>
              <KPI label="NET Total"          value={`${ptMoney(totalNetTodos)} aUEC`}          color={totalNetTodos>=0?'var(--accent-green)':'var(--accent-red)'}/>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:18 }}>
              <KPI label="Sessões Concluídas" value={allCompleted.length}                     color="var(--accent-green)"/>
              <KPI label="Média SCU/Sessão"   value={`${ptSCU(avgScuSessão)} SCU`}          color="var(--accent-gold)"/>
              <KPI label="Média Net/Sessão"   value={`${ptMoney(allCompleted.length>0?totalNetTodos/allCompleted.length:0)} aUEC`} color="var(--accent-primary)"/>
            </div>

            {/* Per-ore totals */}
            {section.length>0&&(()=>{
              const oreMap={};
              for(const s of allCompleted) for(const o of s.ores) {
                if(!oreMap[o.name]) oreMap[o.name]={name:o.name,raw:0,refined:0,revenue:0};
                oreMap[o.name].raw     +=(Number(o.raw_scu)||0);
                oreMap[o.name].refined +=(Number(o.refined_scu)||0);
                oreMap[o.name].revenue +=(Number(o.refined_scu)||0)*(Number(o.price_per_scu)||0);
              }
              const ores=Object.values(oreMap).sort((a,b)=>b.refined-a.refined);
              if(ores.length===0) return null;
              return (
                <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'14px',marginBottom:14 }}>
                  <SectionHeader icon={Gem} title="Minérios Coletados (Sessões Concluídas)" color="var(--accent-gold)"/>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                      <thead>
                        <tr style={{ background:'var(--bg-panel)' }}>
                          {['Minério','SCU Bruto','SCU Refinado','Receita Estimada'].map(h=>(
                            <th key={h} style={{ padding:'8px 10px',textAlign:'left',borderBottom:'1px solid var(--border-subtle)',color:'var(--accent-primary)',fontWeight:700,fontFamily:'Rajdhani,sans-serif',fontSize:11,textTransform:'uppercase',letterSpacing:'0.06em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ores.map((o,i)=>(
                          <tr key={i} style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                            <td style={{ padding:'7px 10px',fontWeight:700,color:'var(--accent-gold)' }}>{o.name}</td>
                            <td style={{ padding:'7px 10px',fontFamily:'Share Tech Mono,monospace',color:'var(--text-secondary)' }}>{ptSCU(o.raw)} SCU</td>
                            <td style={{ padding:'7px 10px',fontFamily:'Share Tech Mono,monospace',color:'var(--accent-gold)',fontWeight:700 }}>{ptSCU(o.refined)} SCU</td>
                            <td style={{ padding:'7px 10px',fontFamily:'Share Tech Mono,monospace',color:'var(--accent-green)',fontWeight:700 }}>{o.revenue>0?ptMoney(o.revenue)+' aUEC':'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {section.length===0&&<div className="empty-state"><Pickaxe size={48} className="empty-state-icon"/><div className="empty-state-title">SEM DADOS AINDA</div></div>}
          </div>
        )}
      </div>
    </div>
  );
}
