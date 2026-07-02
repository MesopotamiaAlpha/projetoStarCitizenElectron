import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, CheckCircle2, Clock, AlertTriangle,
  Search, MapPin, Users, Package, Crosshair, Edit3, X, Save,
  Play, Square, TrendingUp, TrendingDown, DollarSign,
  BarChart3, Calendar, Bug, ChevronDown, ChevronUp,
  Lightbulb, Minus, RefreshCw, Star, ArrowLeft, ArrowRight,
  Gift, Divide
} from 'lucide-react';

// ── Estoque ───────────────────────────────────────────────────────────────────
const MISSIONS_KEY   = 'sc_missions_v2';
const OBJECTIVES_KEY = 'sc_obj_library_v1';
const LOSSES_KEY     = 'sc_daily_losses_v1';

function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } }
function save(key, v)   { localStorage.setItem(key, JSON.stringify(v)); }

// ── Constants ─────────────────────────────────────────────────────────────────
const MISSION_TYPES = ['Bounty Hunt','Delivery','Carga Run','Mining','Salvage','FPS Combat','Escort','Investigation','PVP','Base Assault','Drug Run','Mercenary','Blockade Run','Outro'];
const FACTIONS      = ['Foxwell Enforcement','Headhunters','Covalex','Shubin Interstellar','Ling Family','InterSec','Rayari','Mile Eckhart','Nine Tails','UEE Navy','Advocacy','CDF','Hurston Security','Levski Security','Free','Outro'];
const SYSTEMS       = ['Stanton','Pyro','Nyx','Terra'];
const DIFFICULTIES  = ['Easy','Médio','Hard','Very Hard','Elite'];
const STATUSES      = ['Active','Completed','Failed','Abandoned','Pending','Bugged'];
const MONTHS_PT     = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const STATUS_COLORS = { Active:'var(--accent-primary)',Completed:'var(--accent-green)',Failed:'var(--accent-red)',Abandoned:'var(--text-muted)',Pending:'var(--accent-gold)',Bugged:'#e17055' };
const DIFF_COLORS   = { Easy:'var(--accent-green)',Médio:'var(--accent-primary)',Hard:'var(--accent-gold)','Very Hard':'#ff8c00',Elite:'var(--accent-red)' };
const TYPE_ICONS    = { 'Bounty Hunt':Crosshair,'FPS Combat':Crosshair,'Delivery':Package,'Carga Run':Package,'Mining':Star,'Salvage':Star,'Escort':Users,'Investigation':Search,'PVP':Crosshair,'Base Assault':AlertTriangle,'Drug Run':Package,'Mercenary':Users,'Blockade Run':Crosshair };

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr()   { return new Date().toISOString().slice(0,10); }
function ptData(iso)  {
  const [y,m,d] = iso.split('-');
  const wday = new Date(iso+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long'});
  return `${wday.charAt(0).toUpperCase()+wday.slice(1)}, ${d}/${m}/${y}`;
}
function ptShortData(iso) { const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
function ptMonthYear(iso) { const [y,m]=iso.split('-'); return `${MONTHS_PT[Number(m)-1]} ${y}`; }
function fmtHora(iso) { return iso ? new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '—'; }
function fmtDuration(ms) {
  if (!ms||ms<=0) return '—';
  const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);
  return h>0?`${h}h ${m%60}m`:m>0?`${m}m ${s%60}s`:`${s}s`;
}
function ptMoney(v) {
  if (!v && v!==0) return '0';
  return Number(v).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:3});
}
function parseMoney(str) {
  if (!str) return 0;
  const raw = String(str).replace(/\./g,'').replace(',','.');
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : n;
}

// ── Objective Library ─────────────────────────────────────────────────────────
function useObjLibrary() {
  const [lib, setLib] = useState(()=>load(OBJECTIVES_KEY,[]));
  const addToLib = useCallback((texts)=>{
    setLib(prev=>{
      const set=new Set(prev.map(o=>o.text.toLowerCase()));
      const newItens=texts.map(t=>t.trim()).filter(t=>t&&!set.has(t.toLowerCase()))
        .map(t=>({text:t,usedCount:1,lastUsed:new Date().toISOString()}));
      const updated=[...prev,...newItens]
        .map(o=>texts.map(t=>t.toLowerCase()).includes(o.text.toLowerCase())?{...o,usedCount:(o.usedCount||0)+1,lastUsed:new Date().toISOString()}:o)
        .sort((a,b)=>(b.usedCount||0)-(a.usedCount||0));
      save(OBJECTIVES_KEY,updated);
      return updated;
    });
  },[]);
  return {lib,addToLib};
}

// ── Loot Distribution Modal ───────────────────────────────────────────────────
function LootDistributionModal({ mission, initialLoot, onSave, onSkip }) {
  // Tripulantes nomeados
  const [members, setMembers] = useState(() =>
    initialLoot?.members ? initialLoot.members.map(m=>({...m})) : []
  );
  const [memberInput, setMemberInput] = useState('');

  // Itens de loot
  const [items, setItems] = useState(() =>
    initialLoot?.items ? initialLoot.items.map(i=>({...i, id:i.id||Date.now()+Math.random()})) :
    [{ id: Date.now(), name: '', type: 'auec', qty: 0, qtyDisplay: '', assignMode: 'split', assignments: {}, hasQuality: false, quality: '' }]
  );

  const IS = {width:'100%',padding:'8px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none'};
  const BTN = {display:'flex',alignItems:'center',justifyContent:'center',gap:4,padding:'5px 10px',borderRadius:5,cursor:'pointer',fontFamily:'Rajdhani,sans-serif',fontSize:11,fontWeight:700,textTransform:'uppercase'};

  // ── Tripulantes ──
  function addMember() {
    const name = memberInput.trim();
    if (!name || members.find(m=>m.name.toLowerCase()===name.toLowerCase())) return;
    setMembers(prev => [...prev, { id: Date.now(), name, delivered: false }]);
    setMemberInput('');
  }
  function removeMember(id) {
    setMembers(prev => prev.filter(m => m.id !== id));
    // Remover assignments deste membro dos itens
    setItems(prev => prev.map(it => {
      const a = {...(it.assignments||{})};
      delete a[id];
      return {...it, assignments: a};
    }));
  }

  // ── Itens ──
  function addItem() {
    setItems(prev => [...prev, { id: Date.now(), name: '', type: 'auec', qty: 0, qtyDisplay: '', assignMode: 'split', assignments: {}, hasQuality: false, quality: '' }]);
  }
  function removeItem(id) { setItems(prev => prev.filter(i => i.id !== id)); }
  function updateItem(id, field, val) {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      if (field === 'qty') {
        const parsed = i.type === 'auec' ? parseMoney(val) : (parseInt(val,10)||0);
        return {...i, qty: parsed, qtyDisplay: val};
      }
      if (field === 'type') return {...i, type: val, qty: 0, qtyDisplay: '', assignments: {}};
      if (field === 'hasQuality') return {...i, hasQuality: val, quality: val ? i.quality : ''};
      return {...i, [field]: val};
    }));
  }
  function blurQty(id) {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const disp = i.qty > 0 ? (i.type==='auec' ? ptMoney(i.qty) : String(i.qty)) : '';
      return {...i, qtyDisplay: disp};
    }));
  }
  function setAssignMode(id, mode) {
    setItems(prev => prev.map(i => i.id !== id ? i : {...i, assignMode: mode, assignments: {}}));
  }
  function setAssignment(itemId, memberId, val) {
    setItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const parsed = i.type === 'auec' ? parseMoney(val) : (parseInt(val,10)||0);
      return {...i, assignments: {...(i.assignments||{}), [memberId]: parsed}};
    }));
  }

  // ── Cálculos ──
  function splitPerPerson(item) {
    if (!members.length) return 0;
    if (item.type === 'auec') return Math.floor((item.qty||0) / members.length);
    return Math.floor((item.qty||0) / members.length);
  }

  const totalAuec = items.filter(i=>i.type==='auec').reduce((a,i)=>a+(i.qty||0),0);
  const perPersonAuec = members.length > 0 ? Math.floor(totalAuec / members.length) : 0;

  function handleSave() {
    const loot = {
      members: members.map(m => ({...m})),
      items: items.filter(i => i.name.trim() || i.qty > 0).map(i => ({
        id: i.id, name: i.name.trim()||'(sem nome)', type: i.type,
        qty: i.qty, assignMode: i.assignMode, assignments: i.assignments||{},
        hasQuality: i.hasQuality||false, quality: i.quality||'',
      })),
      totalAuec,
      perPersonAuec,
      registered_at: initialLoot?.registered_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onSave(loot);
  }

  const hasContent = members.length > 0 || items.some(i => i.name.trim() || i.qty > 0);

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div style={{background:'var(--bg-card)',border:'1px solid rgba(0,229,160,0.3)',borderRadius:12,padding:22,width:'100%',maxWidth:620,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.7)'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Gift size={17} style={{color:'var(--accent-green)'}}/>
            <span style={{fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--accent-green)',letterSpacing:'0.06em'}}>
              {initialLoot ? 'EDITAR DISTRIBUIÇÃO' : 'DISTRIBUIÇÃO DE LOOT'}
            </span>
          </div>
          {onSkip && <button onClick={onSkip} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}><X size={15}/></button>}
        </div>
        <div style={{fontSize:11,color:'var(--text-secondary)',marginBottom:18,paddingLeft:27}}>
          <span style={{fontWeight:700,color:'var(--text-primary)'}}>{mission.title}</span>
          {!initialLoot && <span style={{color:'var(--text-muted)'}}> — Registre quem participou e o que foi obtido</span>}
        </div>

        {/* ── SEÇÃO 1: Tripulantes ── */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8,display:'flex',alignItems:'center',gap:5}}>
            <Users size={10}/> Tripulantes ({members.length})
          </div>
          <div style={{display:'flex',gap:7,marginBottom:8}}>
            <input style={{...IS,flex:1}} placeholder="Nome do tripulante..." value={memberInput}
              onChange={e=>setMemberInput(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addMember();}}}/>
            <button onClick={addMember} style={{...BTN,background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-normal)',color:'var(--accent-primary)',padding:'8px 14px'}}>
              <Plus size={12}/> Adicionar
            </button>
          </div>
          {members.length === 0 && (
            <div style={{fontSize:11,color:'var(--text-muted)',padding:'6px 10px',background:'rgba(255,255,255,0.02)',borderRadius:6,border:'1px dashed var(--border-subtle)'}}>
              Adicione os nomes de quem participou da missão
            </div>
          )}
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {members.map(m => (
              <div key={m.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',background:'rgba(0,212,255,0.08)',border:'1px solid rgba(0,212,255,0.2)',borderRadius:20}}>
                <span style={{fontSize:12,fontWeight:700,color:'var(--accent-primary)'}}>{m.name}</span>
                <button onClick={()=>removeMember(m.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:0,display:'flex',alignItems:'center'}}>
                  <X size={10}/>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── SEÇÃO 2: Itens ── */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8,display:'flex',alignItems:'center',gap:5}}>
            <Package size={10}/> Itens / Loot ({items.length})
          </div>

          {items.map((item, idx) => (
            <div key={item.id} style={{background:'rgba(255,255,255,0.03)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'12px',marginBottom:8}}>
              {/* Linha 1: nome, tipo, quantidade, remover */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 110px 130px 28px',gap:6,marginBottom: members.length > 0 ? 10 : 0}}>
                <input style={IS} placeholder={`Item ${idx+1} (ex: Caranite, Titan Armor...)`}
                  value={item.name} onChange={e=>updateItem(item.id,'name',e.target.value)}/>
                <select style={{...IS,appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 7px center',paddingRight:26}}
                  value={item.type} onChange={e=>updateItem(item.id,'type',e.target.value)}>
                  <option value="auec">aUEC</option>
                  <option value="unit">Unidades</option>
                </select>
                <input style={{...IS,fontFamily:'Share Tech Mono,monospace'}}
                  placeholder={item.type==='auec'?'ex: 500.000':'ex: 16'}
                  value={item.qtyDisplay}
                  onChange={e=>updateItem(item.id,'qty',e.target.value)}
                  onBlur={()=>blurQty(item.id)}/>
                <button onClick={()=>removeItem(item.id)} style={{width:28,height:36,borderRadius:5,border:'1px solid rgba(255,68,102,0.2)',background:'rgba(255,68,102,0.08)',color:'var(--accent-red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <X size={11}/>
                </button>
              </div>

              {/* Qualidade do item (checkbox opcional) */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom: members.length > 0 && item.qty > 0 ? 8 : 0, marginTop: members.length > 0 && item.qty > 0 ? 0 : 6}}>
                <button
                  onClick={()=>updateItem(item.id,'hasQuality',!item.hasQuality)}
                  style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',padding:0,color:item.hasQuality?'var(--accent-gold)':'var(--text-muted)'}}>
                  <div style={{
                    width:14,height:14,borderRadius:3,flexShrink:0,
                    border:`2px solid ${item.hasQuality?'var(--accent-gold)':'var(--border-normal)'}`,
                    background:item.hasQuality?'rgba(255,200,0,0.15)':'transparent',
                    display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s',
                  }}>
                    {item.hasQuality&&<div style={{width:6,height:6,borderRadius:1,background:'var(--accent-gold)'}}/>}
                  </div>
                  <span style={{fontFamily:'Rajdhani,sans-serif',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>Qualidade</span>
                </button>
                {item.hasQuality && (
                  <input
                    style={{flex:1,padding:'5px 9px',background:'rgba(255,200,0,0.06)',border:'1px solid rgba(255,200,0,0.3)',borderRadius:5,color:'var(--accent-gold)',fontFamily:'Rajdhani,sans-serif',fontSize:12,outline:'none',fontWeight:600}}
                    placeholder="ex: Grade A, Pristine, High, 94%..."
                    value={item.quality||''}
                    onChange={e=>updateItem(item.id,'quality',e.target.value)}
                  />
                )}
              </div>

              {/* Modo de distribuição (só aparece se há tripulantes e quantidade) */}
              {members.length > 0 && item.qty > 0 && (
                <div>
                  <div style={{display:'flex',gap:6,marginBottom:8}}>
                    <button onClick={()=>setAssignMode(item.id,'split')}
                      style={{...BTN, background:item.assignMode==='split'?'rgba(0,229,160,0.12)':'transparent', border:`1px solid ${item.assignMode==='split'?'rgba(0,229,160,0.4)':'var(--border-subtle)'}`, color:item.assignMode==='split'?'var(--accent-green)':'var(--text-muted)'}}>
                      <Divide size={10}/> Divisão Automática
                    </button>
                    <button onClick={()=>setAssignMode(item.id,'manual')}
                      style={{...BTN, background:item.assignMode==='manual'?'rgba(0,212,255,0.12)':'transparent', border:`1px solid ${item.assignMode==='manual'?'rgba(0,212,255,0.4)':'var(--border-subtle)'}`, color:item.assignMode==='manual'?'var(--accent-primary)':'var(--text-muted)'}}>
                      <Edit3 size={10}/> Manual por Pessoa
                    </button>
                  </div>

                  {item.assignMode === 'split' ? (
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {members.map(m => (
                        <div key={m.id} style={{padding:'4px 10px',background:'rgba(0,229,160,0.06)',border:'1px solid rgba(0,229,160,0.15)',borderRadius:6,fontSize:11}}>
                          <span style={{color:'var(--text-secondary)'}}>{m.name}: </span>
                          <span style={{fontFamily:'Share Tech Mono,monospace',color:'var(--accent-green)',fontWeight:700}}>
                            {item.type==='auec' ? `${ptMoney(splitPerPerson(item))} aUEC` : `${splitPerPerson(item)} un.`}
                          </span>
                        </div>
                      ))}
                      {item.qty % members.length !== 0 && (
                        <div style={{fontSize:10,color:'var(--accent-gold)',padding:'4px 8px',alignSelf:'center'}}>
                          ⚠ Resto: {item.type==='auec'?`${ptMoney(item.qty % members.length)} aUEC`:`${item.qty % members.length} un.`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:6}}>
                        Total: {item.type==='auec'?`${ptMoney(item.qty)} aUEC`:`${item.qty} un.`} —
                        Atribuído: {item.type==='auec'
                          ? `${ptMoney(Object.values(item.assignments||{}).reduce((a,v)=>a+v,0))} aUEC`
                          : `${Object.values(item.assignments||{}).reduce((a,v)=>a+v,0)} un.`}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:6}}>
                        {members.map(m => (
                          <div key={m.id} style={{display:'flex',alignItems:'center',gap:6}}>
                            <span style={{fontSize:11,color:'var(--text-secondary)',minWidth:60,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</span>
                            <input style={{...IS,flex:1,fontSize:11,fontFamily:'Share Tech Mono,monospace',padding:'4px 7px'}}
                              placeholder={item.type==='auec'?'aUEC':'un.'}
                              value={item.assignments?.[m.id] > 0 ? (item.type==='auec'?ptMoney(item.assignments[m.id]):item.assignments[m.id]) : ''}
                              onChange={e=>setAssignment(item.id, m.id, e.target.value)}/>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <button onClick={addItem} style={{...BTN,background:'rgba(0,212,255,0.06)',border:'1px solid var(--border-subtle)',color:'var(--accent-primary)',padding:'7px 14px',marginTop:2}}>
            <Plus size={11}/> Adicionar Item
          </button>
        </div>

        {/* ── RESUMO ── */}
        {members.length > 0 && totalAuec > 0 && (
          <div style={{background:'rgba(0,229,160,0.05)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:8,padding:'10px 14px',marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--accent-green)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8,display:'flex',alignItems:'center',gap:5}}>
              <Divide size={10}/> Resumo aUEC
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,textAlign:'center'}}>
              <div>
                <div style={{fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:800,color:'var(--accent-gold)'}}>{ptMoney(totalAuec)}</div>
                <div style={{fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',marginTop:2}}>Total aUEC</div>
              </div>
              <div style={{borderLeft:'1px solid var(--border-subtle)',borderRight:'1px solid var(--border-subtle)'}}>
                <div style={{fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:800,color:'var(--text-primary)'}}>{members.length}</div>
                <div style={{fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',marginTop:2}}>Tripulantes</div>
              </div>
              <div>
                <div style={{fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:800,color:'var(--accent-green)'}}>{ptMoney(perPersonAuec)}</div>
                <div style={{fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',marginTop:2}}>Por Pessoa</div>
              </div>
            </div>
          </div>
        )}

        {/* Botões */}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          {onSkip && (
            <button onClick={onSkip} style={{...BTN,padding:'8px 16px',background:'transparent',border:'1px solid var(--border-subtle)',color:'var(--text-secondary)'}}>
              Sem Loot
            </button>
          )}
          <button onClick={handleSave} disabled={!hasContent} style={{...BTN,padding:'8px 18px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',color:'var(--accent-green)',opacity:hasContent?1:0.5}}>
            <Save size={13}/> Salvar Distribuição
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mission Form ──────────────────────────────────────────────────────────────
function MissionForm({ initial, onSave, onCancelar, objLibrary }) {
  const [data,setData]=useState(()=>initial?{...initial,objectives:initial.objectives?.map(o=>({...o}))||[]}:{
    id:null,title:'',type:'Bounty Hunt',faction:'Foxwell Enforcement',
    system:'Stanton',location:'',difficulty:'Médio',status:'Active',
    reward:0,reputation_gain:0,crew_needed:1,notes:'',bug_description:'',
    created_at:new Date().toISOString(),completed_at:null,
    objectives:[],timer_elapsed:0,
  });
  const [objInput,setObjInput]=useState('');
  const [showSug,setShowSug]=useState(false);
  const [error,setError]=useState('');
  const [rewardDisplay,setRewardDisplay]=useState(initial?.reward>0?ptMoney(initial.reward):'');
  const set=(k,v)=>setData(p=>({...p,[k]:v}));

  const suggestions=useMemo(()=>{
    if(!objInput.trim()||objInput.length<2) return [];
    const q=objInput.toLowerCase();
    return objLibrary.filter(o=>o.text.toLowerCase().includes(q)).slice(0,6);
  },[objInput,objLibrary]);

  function addObj(text) {
    const t=(text||objInput).trim();
    if(!t||data.objectives.some(o=>o.text.toLowerCase()===t.toLowerCase())) return;
    set('objectives',[...data.objectives,{text:t,done:false}]);
    setObjInput(''); setShowSug(false);
  }
  function toggleObj(i) { const o=[...data.objectives];o[i]={...o[i],done:!o[i].done};set('objectives',o); }
  function removeObj(i) { set('objectives',data.objectives.filter((_,j)=>j!==i)); }

  function handleSave() {
    if(!data.title.trim()){setError('Título obrigatório.');return;}
    const saved={...data,id:data.id||Date.now(),
      completed_at:data.status==='Completed'&&!data.completed_at?new Date().toISOString():data.completed_at};
    onSave(saved);
  }

  const IS={width:'100%',padding:'8px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none'};
  const SS={...IS,padding:'8px 26px 8px 10px',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 7px center'};
  const LS={fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4};

  return (
    <div style={{background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:10,padding:'18px',marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.06em'}}>{initial?.id?'EDITAR MISSÃO':'NOVA MISSÃO'}</div>
        <button onClick={onCancelar} style={{background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'4px 8px'}}><X size={13}/></button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:9,marginBottom:9}}>
        <div><label style={LS}>Título *</label><input style={IS} value={data.title} onChange={e=>set('title',e.target.value)} placeholder="Nome da missão..."/></div>
        <div><label style={LS}>Tipo</label><select style={SS} value={data.type} onChange={e=>set('type',e.target.value)}>{MISSION_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        <div><label style={LS}>Status</label>
          <select style={{...SS,color:STATUS_COLORS[data.status]||'var(--text-primary)'}} value={data.status} onChange={e=>set('status',e.target.value)}>
            {STATUSES.map(s=><option key={s} style={{color:'var(--text-primary)'}}>{s}</option>)}
          </select>
        </div>
      </div>

      {data.status==='Bugged'&&(
        <div style={{marginBottom:9,padding:'8px 12px',background:'rgba(225,112,85,0.08)',border:'1px solid rgba(225,112,85,0.25)',borderRadius:6}}>
          <label style={{...LS,color:'#e17055'}}>🐛 Descrição do Bug</label>
          <textarea style={{...IS,minHeight:50,resize:'vertical'}} value={data.bug_description||''} onChange={e=>set('bug_description',e.target.value)} placeholder="O que aconteceu para a missão bugar?"/>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:9,marginBottom:9}}>
        <div><label style={LS}>Facção</label><select style={SS} value={data.faction} onChange={e=>set('faction',e.target.value)}>{FACTIONS.map(f=><option key={f}>{f}</option>)}</select></div>
        <div><label style={LS}>Sistema</label><select style={SS} value={data.system} onChange={e=>set('system',e.target.value)}>{SYSTEMS.map(s=><option key={s}>{s}</option>)}</select></div>
        <div><label style={LS}>Dificuldade</label><select style={SS} value={data.difficulty} onChange={e=>set('difficulty',e.target.value)}>{DIFFICULTIES.map(d=><option key={d}>{d}</option>)}</select></div>
        <div><label style={LS}>Tripulação</label>
          <input style={IS} type="number" min="1" max="30" value={data.crew_needed}
            onChange={e=>set('crew_needed',Math.max(1,Number(e.target.value)||1))}/>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:9,marginBottom:9}}>
        <div><label style={LS}>Localização</label><input style={IS} value={data.location||''} onChange={e=>set('location',e.target.value)} placeholder="Ex: Yela Belt, Lorville bunker..."/></div>
        <div>
          <label style={LS}>Recompensa (aUEC)</label>
          <input style={IS} type="text" inputMode="numeric" value={rewardDisplay}
            onChange={e=>{setRewardDisplay(e.target.value);set('reward',parseMoney(e.target.value));}}
            onBlur={()=>setRewardDisplay(data.reward>0?ptMoney(data.reward):'')}
            placeholder="ex: 1.500.000"
          />
          {data.reward>0&&data.crew_needed>1&&(
            <div style={{marginTop:3,fontSize:11,color:'var(--accent-green)',fontFamily:'Share Tech Mono,monospace'}}>
              ÷{data.crew_needed} = {ptMoney(Math.floor(data.reward/data.crew_needed))}/pessoa
            </div>
          )}
        </div>
        <div><label style={LS}>Reputação</label><input style={IS} type="number" min="0" value={data.reputation_gain||0} onChange={e=>set('reputation_gain',Number(e.target.value))}/></div>
      </div>

      {/* Objectives */}
      <div style={{marginBottom:9}}>
        <label style={LS}>Objetivos</label>
        <div style={{position:'relative'}}>
          <div style={{display:'flex',gap:7,marginBottom:5}}>
            <input style={{...IS,flex:1}} value={objInput}
              onChange={e=>{setObjInput(e.target.value);setShowSug(true);}}
              onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addObj();}if(e.key==='Escape')setShowSug(false);}}
              onFocus={()=>setShowSug(true)}
              placeholder="Adicionar objetivo... (Enter para confirmar)"
            />
            <button onClick={()=>addObj()} style={{padding:'7px 12px',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-normal)',borderRadius:5,color:'var(--accent-primary)',cursor:'pointer',fontWeight:700}}><Plus size={13}/></button>
          </div>
          {showSug&&suggestions.length>0&&(
            <div style={{position:'absolute',top:'100%',left:0,right:40,background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:6,boxShadow:'0 8px 20px rgba(0,0,0,0.4)',zIndex:100,overflow:'hidden'}}>
              <div style={{padding:'4px 10px',fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',background:'var(--bg-panel)',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',gap:5}}>
                <Lightbulb size={10}/> Sugestões anteriores
              </div>
              {suggestions.map((s,i)=>(
                <button key={i} onClick={()=>addObj(s.text)}
                  style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',padding:'7px 12px',background:'none',border:'none',borderBottom:'1px solid var(--border-subtle)',color:'var(--text-secondary)',cursor:'pointer',fontSize:12,textAlign:'left'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(0,212,255,0.06)'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}>
                  <span>{s.text}</span>
                  <span style={{fontSize:10,color:'var(--text-muted)'}}>×{s.usedCount||1}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {data.objectives.map((obj,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 9px',marginBottom:3,background:obj.done?'rgba(0,229,160,0.05)':'rgba(255,255,255,0.03)',borderRadius:5,border:`1px solid ${obj.done?'rgba(0,229,160,0.2)':'var(--border-subtle)'}`}}>
            <button onClick={()=>toggleObj(i)} style={{background:'none',border:'none',cursor:'pointer',color:obj.done?'var(--accent-green)':'var(--text-muted)',padding:0,flexShrink:0}}>
              {obj.done?<CheckCircle2 size={14}/>:<div style={{width:14,height:14,borderRadius:'50%',border:'1px solid var(--text-muted)'}}/>}
            </button>
            <span style={{flex:1,fontSize:12,color:obj.done?'var(--text-muted)':'var(--text-secondary)',textDecoration:obj.done?'line-through':'none'}}>{obj.text}</span>
            <button onClick={()=>removeObj(i)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:0}}><X size={11}/></button>
          </div>
        ))}
      </div>

      <div style={{marginBottom:12}}>
        <label style={LS}>Notas</label>
        <textarea className="notes-textarea" value={data.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Estratégia, dicas, equipamento..." style={{minHeight:46,fontSize:12,marginTop:0}}/>
      </div>

      {error&&<div style={{color:'var(--accent-red)',fontSize:12,marginBottom:9,display:'flex',alignItems:'center',gap:6}}><AlertTriangle size={13}/>{error}</div>}

      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button onClick={onCancelar} style={{padding:'8px 16px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>Cancelar</button>
        <button onClick={handleSave} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 18px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',borderRadius:6,color:'var(--accent-green)',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>
          <Save size={13}/>{initial?.id?'Salvar':'Registrar'}
        </button>
      </div>
    </div>
  );
}

// ── Loot Panel (exibição no card expandido) ───────────────────────────────────
function LootPanel({ loot, mission, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [delivered, setDelivered] = useState(() => {
    const d = {};
    (loot.members||[]).forEach(m => { d[m.id] = m.delivered || false; });
    return d;
  });

  function toggleDelivered(memberId) {
    const updated = { ...delivered, [memberId]: !delivered[memberId] };
    setDelivered(updated);
    const updatedLoot = {
      ...loot,
      members: (loot.members||[]).map(m => m.id === memberId ? {...m, delivered: updated[memberId]} : m),
    };
    onUpdate(updatedLoot);
  }

  function handleEditSave(newLoot) {
    onUpdate(newLoot);
    setEditing(false);
  }

  if (editing) return (
    <LootDistributionModal mission={mission} initialLoot={loot} onSave={handleEditSave} onSkip={()=>setEditing(false)}/>
  );

  const memberCount    = loot.members?.length || 0;
  const deliveredCount = (loot.members||[]).filter(m => delivered[m.id]).length;
  const pendingCount   = memberCount - deliveredCount;

  // ── Calcular status de atribuição de cada item ──
  function itemAssignmentStatus(item) {
    if (!memberCount) return 'no-members'; // sem tripulantes cadastrados
    if (item.assignMode === 'split') return 'assigned'; // divisão automática = sempre atribuído
    // manual: verificar se alguém tem valor > 0
    const totalAssigned = Object.values(item.assignments||{}).reduce((a,v)=>a+(v||0),0);
    if (totalAssigned === 0) return 'unassigned';
    if (totalAssigned < item.qty) return 'partial';
    return 'assigned';
  }

  const unassignedItems = (loot.items||[]).filter(i => itemAssignmentStatus(i) === 'unassigned');
  const partialItems    = (loot.items||[]).filter(i => itemAssignmentStatus(i) === 'partial');
  const hasWarnings     = unassignedItems.length > 0 || partialItems.length > 0;

  return (
    <div style={{marginBottom:8,background:'rgba(0,229,160,0.04)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:8,overflow:'hidden'}}>

      {/* ── Header ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderBottom:'1px solid rgba(0,229,160,0.1)'}}>
        <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
          <Gift size={11} style={{color:'var(--accent-green)'}}/>
          <span style={{fontSize:10,fontWeight:700,color:'var(--accent-green)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Distribuição de Loot</span>
          {memberCount > 0 && deliveredCount === memberCount && (
            <span style={{fontSize:10,padding:'1px 6px',borderRadius:8,background:'rgba(0,229,160,0.15)',color:'var(--accent-green)',border:'1px solid rgba(0,229,160,0.3)',fontWeight:700}}>✓ Tudo entregue</span>
          )}
          {pendingCount > 0 && (
            <span style={{fontSize:10,padding:'1px 6px',borderRadius:8,background:'rgba(255,140,0,0.15)',color:'var(--accent-gold)',border:'1px solid rgba(255,140,0,0.35)',fontWeight:700}}>
              ⏳ {pendingCount} pendente{pendingCount!==1?'s':''}
            </span>
          )}
          {hasWarnings && (
            <span style={{fontSize:10,padding:'1px 6px',borderRadius:8,background:'rgba(255,68,102,0.12)',color:'var(--accent-red)',border:'1px solid rgba(255,68,102,0.3)',fontWeight:700}}>
              ⚠ {unassignedItems.length + partialItems.length} item{(unassignedItems.length+partialItems.length)!==1?'s':''} sem atribuição
            </span>
          )}
        </div>
        <button onClick={()=>setEditing(true)} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--accent-primary)',cursor:'pointer',fontSize:10,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase',flexShrink:0}}>
          <Edit3 size={9}/> Editar
        </button>
      </div>

      <div style={{padding:'10px 12px'}}>

        {/* ── Resumo aUEC ── */}
        {loot.totalAuec > 0 && (
          <div style={{display:'flex',gap:14,marginBottom:10,flexWrap:'wrap'}}>
            <span style={{fontSize:11,color:'var(--text-secondary)'}}>
              <span style={{color:'var(--text-muted)'}}>Total: </span>
              <span style={{fontFamily:'Share Tech Mono,monospace',color:'var(--accent-gold)',fontWeight:700}}>{ptMoney(loot.totalAuec)} aUEC</span>
            </span>
            <span style={{fontSize:11,color:'var(--text-secondary)'}}>
              <span style={{color:'var(--text-muted)'}}>Por pessoa: </span>
              <span style={{fontFamily:'Share Tech Mono,monospace',color:'var(--accent-green)',fontWeight:700}}>{ptMoney(loot.perPersonAuec)} aUEC</span>
            </span>
          </div>
        )}

        {/* ── Itens com destaque visual de status ── */}
        {loot.items?.length > 0 && (
          <div style={{marginBottom:memberCount>0?10:0}}>
            <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Itens</div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {loot.items.map((item, i) => {
                const status = itemAssignmentStatus(item);
                const isUnassigned = status === 'unassigned';
                const isPartial    = status === 'partial';
                const hasIssue     = isUnassigned || isPartial;

                // Cor e estilo baseado no status de atribuição
                const borderColor  = isUnassigned ? 'rgba(255,68,102,0.5)'
                                   : isPartial    ? 'rgba(255,140,0,0.5)'
                                   : 'var(--border-subtle)';
                const bgColor      = isUnassigned ? 'rgba(255,68,102,0.06)'
                                   : isPartial    ? 'rgba(255,140,0,0.06)'
                                   : 'rgba(255,255,255,0.02)';
                const badgeColor   = isUnassigned ? {bg:'rgba(255,68,102,0.12)',text:'var(--accent-red)',  border:'rgba(255,68,102,0.35)', label:'Não atribuído'}
                                   : isPartial    ? {bg:'rgba(255,140,0,0.12)', text:'var(--accent-gold)', border:'rgba(255,140,0,0.35)',  label:'Parcial'}
                                   : null;

                // Calcular atribuição manual total para mostrar resto
                const totalAssigned = status==='manual' ? 0 : Object.values(item.assignments||{}).reduce((a,v)=>a+(v||0),0);
                const resto = item.qty - totalAssigned;

                return (
                  <div key={i} style={{
                    padding:'7px 10px',borderRadius:6,
                    background: bgColor,
                    border: `1px solid ${borderColor}`,
                    display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,
                    transition:'border-color 0.2s',
                  }}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                        {hasIssue && <AlertTriangle size={11} style={{color: isUnassigned?'var(--accent-red)':'var(--accent-gold)',flexShrink:0}}/>}
                        <span style={{fontSize:12,fontWeight:700,color: hasIssue ? (isUnassigned?'var(--accent-red)':'var(--accent-gold)') : 'var(--text-primary)'}}>
                          {item.name}
                        </span>
                        {item.quality && (
                          <span style={{fontSize:10,padding:'1px 7px',borderRadius:4,background:'rgba(255,200,0,0.1)',color:'var(--accent-gold)',border:'1px solid rgba(255,200,0,0.3)',fontWeight:700}}>
                            ★ {item.quality}
                          </span>
                        )}
                        {badgeColor && (
                          <span style={{fontSize:9,padding:'1px 6px',borderRadius:4,background:badgeColor.bg,color:badgeColor.text,border:`1px solid ${badgeColor.border}`,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                            {badgeColor.label}
                          </span>
                        )}
                      </div>
                      {/* Detalhe de atribuição por pessoa (modo manual) */}
                      {item.assignMode==='manual' && memberCount > 0 && (
                        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
                          {(loot.members||[]).map(m => {
                            const val = (item.assignments||{})[m.id] || 0;
                            return val > 0 ? (
                              <span key={m.id} style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:'rgba(0,212,255,0.08)',border:'1px solid rgba(0,212,255,0.15)',color:'var(--text-secondary)'}}>
                                {m.name}: <span style={{fontFamily:'Share Tech Mono,monospace',color:'var(--accent-primary)'}}>{item.type==='auec'?`${ptMoney(val)} aUEC`:`${val} un.`}</span>
                              </span>
                            ) : null;
                          })}
                          {isPartial && resto > 0 && (
                            <span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:'rgba(255,140,0,0.08)',border:'1px solid rgba(255,140,0,0.2)',color:'var(--accent-gold)'}}>
                              sem dono: {item.type==='auec'?`${ptMoney(resto)} aUEC`:`${resto} un.`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <span style={{fontFamily:'Share Tech Mono,monospace',fontSize:12,color: hasIssue ? (isUnassigned?'var(--accent-red)':'var(--accent-gold)') : 'var(--accent-gold)',fontWeight:700}}>
                        {item.type==='auec' ? `${ptMoney(item.qty)} aUEC` : `${item.qty} un.`}
                      </span>
                      {item.assignMode==='split' && memberCount > 0 && (
                        <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>
                          ÷{memberCount} = {item.type==='auec'
                            ? `${ptMoney(Math.floor(item.qty/memberCount))} aUEC`
                            : `${Math.floor(item.qty/memberCount)} un.`} /pessoa
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tripulantes com destaque de não entregue ── */}
        {memberCount > 0 && (
          <div>
            <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>
              Tripulantes · {deliveredCount}/{memberCount} entregues
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {loot.members.map(m => {
                const isDelivered = delivered[m.id] || false;

                // O que esta pessoa recebe
                const recebeItems = (loot.items||[]).map(item => {
                  if (item.assignMode==='split') {
                    const v = Math.floor((item.qty||0)/(memberCount||1));
                    return v > 0 ? (item.type==='auec' ? `${ptMoney(v)} aUEC` : `${v}× ${item.name}`) : null;
                  } else {
                    const v = (item.assignments||{})[m.id] || 0;
                    return v > 0 ? (item.type==='auec' ? `${ptMoney(v)} aUEC` : `${v}× ${item.name}`) : null;
                  }
                }).filter(Boolean);

                const nothingToDeliver = recebeItems.length === 0;

                return (
                  <div key={m.id} style={{
                    display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,
                    padding:'7px 10px',borderRadius:6,
                    background: isDelivered
                      ? 'rgba(0,229,160,0.05)'
                      : nothingToDeliver
                      ? 'rgba(255,255,255,0.02)'
                      : 'rgba(255,140,0,0.05)',
                    border: `1px solid ${
                      isDelivered       ? 'rgba(0,229,160,0.25)'
                      : nothingToDeliver? 'var(--border-subtle)'
                      : 'rgba(255,140,0,0.4)'}`,
                    transition:'all 0.2s',
                  }}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        {isDelivered
                          ? <CheckCircle2 size={13} style={{color:'var(--accent-green)',flexShrink:0}}/>
                          : nothingToDeliver
                          ? <div style={{width:13,height:13,borderRadius:'50%',border:'1px solid var(--border-normal)',flexShrink:0}}/>
                          : <div style={{width:13,height:13,borderRadius:'50%',border:'2px solid var(--accent-gold)',flexShrink:0,animation:'pulse 1.5s infinite'}}/>
                        }
                        <span style={{
                          fontSize:12,fontWeight:700,
                          color: isDelivered ? 'var(--text-muted)'
                               : nothingToDeliver ? 'var(--text-secondary)'
                               : 'var(--text-primary)',
                          textDecoration: isDelivered ? 'line-through' : 'none',
                        }}>
                          {m.name}
                        </span>
                        {!isDelivered && !nothingToDeliver && (
                          <span style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:'rgba(255,140,0,0.12)',color:'var(--accent-gold)',border:'1px solid rgba(255,140,0,0.3)',fontWeight:700}}>PENDENTE</span>
                        )}
                      </div>
                      {recebeItems.length > 0 && (
                        <div style={{fontSize:10,marginTop:3,marginLeft:19,display:'flex',flexWrap:'wrap',gap:4}}>
                          {recebeItems.map((r,ri) => (
                            <span key={ri} style={{
                              padding:'1px 6px',borderRadius:4,
                              background: isDelivered ? 'rgba(0,229,160,0.06)' : 'rgba(255,255,255,0.05)',
                              border: `1px solid ${isDelivered?'rgba(0,229,160,0.15)':'var(--border-subtle)'}`,
                              color: isDelivered ? 'var(--text-muted)' : 'var(--text-secondary)',
                              fontFamily:'Share Tech Mono,monospace',
                              textDecoration: isDelivered ? 'line-through' : 'none',
                            }}>{r}</span>
                          ))}
                        </div>
                      )}
                      {nothingToDeliver && !isDelivered && (
                        <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2,marginLeft:19}}>nenhum item atribuído</div>
                      )}
                    </div>

                    {!nothingToDeliver && (
                      <button onClick={()=>toggleDelivered(m.id)} style={{
                        display:'flex',alignItems:'center',gap:4,
                        padding:'5px 10px',borderRadius:5,cursor:'pointer',
                        fontFamily:'Rajdhani,sans-serif',fontSize:10,fontWeight:700,textTransform:'uppercase',
                        background: isDelivered ? 'rgba(0,229,160,0.1)' : 'rgba(255,140,0,0.1)',
                        border: `1px solid ${isDelivered ? 'rgba(0,229,160,0.3)' : 'rgba(255,140,0,0.4)'}`,
                        color: isDelivered ? 'var(--accent-green)' : 'var(--accent-gold)',
                        flexShrink:0,
                      }}>
                        {isDelivered
                          ? <><CheckCircle2 size={9}/> Entregue</>
                          : <>⏳ Marcar Entregue</>
                        }
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {deliveredCount === memberCount && memberCount > 0 && (
              <div style={{marginTop:8,fontSize:11,color:'var(--accent-green)',textAlign:'center',padding:'5px',background:'rgba(0,229,160,0.06)',borderRadius:5,border:'1px solid rgba(0,229,160,0.15)',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                <CheckCircle2 size={12}/> Tudo entregue para todos os tripulantes
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mission Card ──────────────────────────────────────────────────────────────
function MissionCard({ mission, onEdit, onDelete, onStatusChange, onClockUpdate, onLootUpdate }) {
  const [expanded,setExpandired]=useState(false);
  const [delConf,setDelConf]=useState(false);
  const [localElapsed,setLocalElapsed]=useState(mission.timer_elapsed||0);
  const [running,setRunning]=useState(false);
  const startRef=useRef(null);
  const tickRef=useRef(null);
  const TipoIcon=TYPE_ICONS[mission.type]||Crosshair;

  function startClock() { startRef.current=Date.now()-localElapsed; setRunning(true); tickRef.current=setInterval(()=>setLocalElapsed(Date.now()-startRef.current),1000); }
  function stopClock()  { clearInterval(tickRef.current); setRunning(false); onClockUpdate(mission.id,localElapsed); }
  useEffect(()=>()=>clearInterval(tickRef.current),[]);

  const objsDone=(mission.objectives||[]).filter(o=>o.done).length;
  const objsTotal=(mission.objectives||[]).length;

  return (
    <div style={{
      background:mission.status==='Completed'?'rgba(0,229,160,0.04)':mission.status==='Failed'?'rgba(255,68,102,0.03)':mission.status==='Bugged'?'rgba(225,112,85,0.04)':'var(--bg-card)',
      border:`1px solid ${mission.status==='Completed'?'rgba(0,229,160,0.2)':mission.status==='Bugged'?'rgba(225,112,85,0.25)':'var(--border-subtle)'}`,
      borderRadius:8,overflow:'hidden',marginBottom:6,
    }}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',cursor:'pointer'}} onClick={()=>setExpandired(!expanded)}>
        <TipoIcon size={15} style={{color:DIFF_COLORS[mission.difficulty]||'var(--text-muted)',flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:2}}>
            <span style={{fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>{mission.title}</span>
            <span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:3,background:`${STATUS_COLORS[mission.status]||'var(--text-muted)'}18`,color:STATUS_COLORS[mission.status]||'var(--text-muted)',border:`1px solid ${STATUS_COLORS[mission.status]||'var(--text-muted)'}33`}}>
              {mission.status==='Bugged'?'🐛 BUGGED':mission.status}
            </span>
            <span style={{fontSize:10,color:DIFF_COLORS[mission.difficulty],fontWeight:600}}>{mission.difficulty}</span>
            {mission.loot&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:'rgba(0,229,160,0.1)',color:'var(--accent-green)',border:'1px solid rgba(0,229,160,0.25)'}}>🎁 Loot</span>}
          </div>
          <div style={{display:'flex',gap:10,fontSize:10,color:'var(--text-muted)',flexWrap:'wrap'}}>
            <span>{mission.type}</span>
            {mission.faction&&<span style={{display:'flex',alignItems:'center',gap:2}}><Users size={9}/>{mission.faction}</span>}
            {mission.location&&<span style={{display:'flex',alignItems:'center',gap:2}}><MapPin size={9}/>{mission.location}</span>}
            {objsTotal>0&&<span style={{color:objsDone===objsTotal?'var(--accent-green)':'var(--accent-primary)'}}>{objsDone}/{objsTotal} obj.</span>}
            {localElapsed>0&&<span style={{display:'flex',alignItems:'center',gap:2,color:'var(--accent-gold)'}}><Clock size={9}/>{fmtDuration(localElapsed)}</span>}
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3,flexShrink:0}}>
          {mission.reward>0&&(
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:'Share Tech Mono,monospace',fontSize:12,color:'var(--accent-gold)'}}>{ptMoney(mission.reward)} aUEC</div>
              {mission.crew_needed>1&&<div style={{fontFamily:'Share Tech Mono,monospace',fontSize:10,color:'var(--text-muted)'}}>÷{mission.crew_needed} = {ptMoney(Math.floor(mission.reward/mission.crew_needed))}/p</div>}
            </div>
          )}
          <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
            {mission.status==='Active'&&(
              <button onClick={running?stopClock:startClock} style={{display:'flex',alignItems:'center',gap:3,padding:'3px 7px',borderRadius:4,border:`1px solid ${running?'rgba(255,68,102,0.4)':'rgba(0,229,160,0.3)'}`,background:running?'rgba(255,68,102,0.08)':'rgba(0,229,160,0.08)',color:running?'var(--accent-red)':'var(--accent-green)',cursor:'pointer',fontSize:10,fontWeight:700}}>
                {running?<><Square size={9}/>STOP</>:<><Play size={9}/>START</>}
              </button>
            )}
            <select style={{padding:'2px 18px 2px 5px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:4,color:STATUS_COLORS[mission.status]||'var(--text-muted)',fontFamily:'Rajdhani,sans-serif',fontSize:10,outline:'none',cursor:'pointer',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 3px center'}}
              value={mission.status} onChange={e=>{e.stopPropagation();onStatusChange(mission.id,e.target.value);}}>
              {STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
            <button onClick={e=>{e.stopPropagation();onEdit(mission);}} style={{width:24,height:24,borderRadius:4,border:'1px solid var(--border-normal)',background:'rgba(0,212,255,0.08)',color:'var(--accent-primary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Edit3 size={10}/></button>
            {delConf?(
              <div style={{display:'flex',gap:3,alignItems:'center'}} onClick={e=>e.stopPropagation()}>
                <button onClick={()=>onDelete(mission.id)} style={{padding:'2px 6px',background:'rgba(255,68,102,0.15)',border:'1px solid rgba(255,68,102,0.4)',borderRadius:3,color:'var(--accent-red)',cursor:'pointer',fontSize:10,fontWeight:700}}>Sim</button>
                <button onClick={()=>setDelConf(false)} style={{padding:'2px 6px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:3,color:'var(--text-secondary)',cursor:'pointer',fontSize:10}}>Não</button>
              </div>
            ):(
              <button onClick={e=>{e.stopPropagation();setDelConf(true);}} style={{width:24,height:24,borderRadius:4,border:'1px solid rgba(255,68,102,0.2)',background:'rgba(255,68,102,0.08)',color:'var(--accent-red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Trash2 size={10}/></button>
            )}
            {expanded?<ChevronUp size={13} style={{color:'var(--text-muted)'}}/>:<ChevronDown size={13} style={{color:'var(--text-muted)'}}/>}
          </div>
        </div>
      </div>
      {expanded&&(
        <div style={{padding:'8px 38px 12px',borderTop:'1px solid var(--border-subtle)',background:'rgba(0,0,0,0.1)'}}>
          {mission.bug_description&&<div style={{marginBottom:8,padding:'6px 10px',background:'rgba(225,112,85,0.08)',border:'1px solid rgba(225,112,85,0.2)',borderRadius:5,fontSize:11,color:'#e17055'}}>🐛 {mission.bug_description}</div>}
          {mission.objectives?.length>0&&(
            <div style={{marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:5}}>Objetivos</div>
              {mission.objectives.map((obj,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 0',fontSize:12}}>
                  {obj.done?<CheckCircle2 size={12} style={{color:'var(--accent-green)',flexShrink:0}}/>:<div style={{width:12,height:12,borderRadius:'50%',border:'1px solid var(--text-muted)',flexShrink:0}}/>}
                  <span style={{color:obj.done?'var(--text-muted)':'var(--text-secondary)',textDecoration:obj.done?'line-through':'none'}}>{obj.text}</span>
                </div>
              ))}
            </div>
          )}
          {/* Loot Distribution Display */}
          {mission.loot&&(
            <LootPanel loot={mission.loot} missionId={mission.id} mission={mission} onUpdate={onLootUpdate}/>
          )}
          {mission.notes&&<div style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.5,marginBottom:6,padding:'6px 8px',background:'rgba(255,255,255,0.03)',borderRadius:5,border:'1px solid var(--border-subtle)'}}>{mission.notes}</div>}
          <div style={{display:'flex',gap:12,fontSize:10,color:'var(--text-muted)',flexWrap:'wrap',marginTop:4}}>
            {mission.completed_at&&<span>Concluída: {fmtHora(mission.completed_at)}</span>}
            {localElapsed>0&&<span>Tempo: {fmtDuration(localElapsed)}</span>}
            {mission.reputation_gain>0&&<span>+{mission.reputation_gain} rep.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Day Summary Card ──────────────────────────────────────────────────────────
function DaySummary({ date, missions, losses, compact=false }) {
  const earned  = missions.filter(m=>m.status==='Completed').reduce((a,m)=>a+(m.reward||0),0);
  const failed  = missions.filter(m=>m.status==='Failed').reduce((a,m)=>a+(m.reward||0),0);
  const bugged  = missions.filter(m=>m.status==='Bugged').reduce((a,m)=>a+(m.reward||0),0);
  const lost    = losses.filter(l=>l.date===date).reduce((a,l)=>a+(l.amount||0),0);
  const net     = earned - lost;
  const total   = missions.length;
  const done    = missions.filter(m=>m.status==='Completed').length;
  const active  = missions.filter(m=>m.status==='Active').length;
  const isGood  = net >= 0;

  if (compact) return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--bg-panel)',borderRadius:7,border:'1px solid var(--border-subtle)',marginBottom:10}}>
      <div style={{flex:1}}>
        <div style={{fontFamily:'Orbitron,monospace',fontSize:11,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.04em'}}>{ptData(date)}</div>
        <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>{total} missões · {done} concluídas{active>0?` · ${active} ativas`:''}</div>
      </div>
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
        {earned>0&&<span style={{fontSize:11,color:'var(--accent-green)',fontFamily:'Share Tech Mono,monospace'}}>+{ptMoney(earned)}</span>}
        {failed>0&&<span style={{fontSize:11,color:'var(--accent-red)',fontFamily:'Share Tech Mono,monospace'}}>❌ {ptMoney(failed)}</span>}
        {bugged>0&&<span style={{fontSize:11,color:'#e17055',fontFamily:'Share Tech Mono,monospace'}}>🐛 {ptMoney(bugged)}</span>}
        {lost>0&&<span style={{fontSize:11,color:'var(--accent-red)',fontFamily:'Share Tech Mono,monospace'}}>💸 -{ptMoney(lost)}</span>}
        <span style={{fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:800,color:isGood?'var(--accent-green)':'var(--accent-red)'}}>
          NET {isGood?'+':''}{ptMoney(net)}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{background:'var(--bg-panel)',borderRadius:8,border:'1px solid var(--border-subtle)',padding:'12px 14px',marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Calendar size={13} style={{color:'var(--accent-primary)'}}/>
          <span style={{fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.04em'}}>{ptData(date)}</span>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:11,color:'var(--text-muted)'}}>{total} missão(ões)</span>
          {earned>0&&<span style={{fontSize:11,color:'var(--accent-green)',fontFamily:'Share Tech Mono,monospace',fontWeight:700}}>+{ptMoney(earned)} aUEC</span>}
          {failed>0&&<span style={{fontSize:11,color:'var(--accent-red)',fontFamily:'Share Tech Mono,monospace'}}>❌ -{ptMoney(failed)}</span>}
          {bugged>0&&<span style={{fontSize:11,color:'#e17055',fontFamily:'Share Tech Mono,monospace'}}>🐛 -{ptMoney(bugged)}</span>}
          {lost>0&&<span style={{fontSize:11,color:'var(--accent-red)',fontFamily:'Share Tech Mono,monospace'}}>💸 -{ptMoney(lost)}</span>}
          <span style={{fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:800,color:isGood?'var(--accent-green)':'var(--accent-red)',marginLeft:4}}>
            NET: {isGood?'+':''}{ptMoney(net)} aUEC
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function BarChart({ data, valueKey, labelKey, color='var(--accent-primary)', height=100, prefix='', suffix='', noDataMsg='Sem dados' }) {
  if (!data||data.length===0) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',fontSize:12}}>{noDataMsg}</div>;
  const maxVal=Math.max(...data.map(d=>Math.abs(d[valueKey]||0)),1);
  return (
    <div style={{height,display:'flex',alignItems:'flex-end',gap:3,padding:'0 4px'}}>
      {data.map((d,i)=>{
        const v=d[valueKey]||0;
        const pct=Math.abs(v)/maxVal;
        const barH=Math.max(pct*(height-24),2);
        const isNeg=v<0;
        return (
          <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
            <div title={`${prefix}${ptMoney(Math.abs(v))}${suffix}`} style={{width:'100%',height:barH,borderRadius:'3px 3px 0 0',background:isNeg?'var(--accent-red)':color,transition:'height 0.3s',minHeight:2,boxShadow:isNeg?'0 0 5px rgba(255,68,102,0.3)':`0 0 5px ${color}44`}}/>
            <div style={{fontSize:8,color:'var(--text-muted)',textAlign:'center',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'100%'}}>{String(d[labelKey]||'').slice(0,8)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Donut stat ────────────────────────────────────────────────────────────────
function DonutStat({ value, total, label, color }) {
  const pct=total>0?(value/total)*100:0;
  const r=26,circ=2*Math.PI*r,defset=circ*(1-pct/100);
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <svg width={64} height={64} viewBox="0 0 64 64">
        <circle cx={32} cy={32} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={6}/>
        <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={defset}
          strokeLinecap="round" transform="rotate(-90 32 32)" style={{transition:'stroke-dashoffset 0.6s ease'}}/>
        <text x={32} y={36} textAnchor="middle" fill="var(--text-primary)" fontSize={13} fontWeight={700} fontFamily="Orbitron,monospace">{value}</text>
      </svg>
      <div style={{fontSize:10,color:'var(--text-muted)',textAlign:'center',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>{label}</div>
    </div>
  );
}

// ── Daily Loss Panel ──────────────────────────────────────────────────────────
function DailyLossPanel({ losses, onAdd, onRemove, targetDate }) {
  const [amount,setQuantidade]=useState('');
  const [amtDisplay,setAmtDisplay]=useState('');
  const [note,setNote]=useState('');
  const [open,setAbrir]=useState(false);
  const [delConf,setDelConf]=useState(null);
  const dayLosses=losses.filter(l=>l.date===targetDate);
  const IS={padding:'7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none'};
  return (
    <div style={{background:'var(--bg-card)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:8,marginBottom:12}}>
      <button onClick={()=>setAbrir(!open)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'none',border:'none',cursor:'pointer',color:'var(--text-primary)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <TrendingDown size={14} style={{color:'var(--accent-red)'}}/>
          <span style={{fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>💸 Perdas do Dia</span>
          {dayLosses.length>0&&<span style={{fontSize:10,background:'rgba(255,68,102,0.1)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:10,padding:'1px 7px',color:'var(--accent-red)',fontWeight:700}}>{dayLosses.length} · -{ptMoney(dayLosses.reduce((a,l)=>a+l.amount,0))} aUEC</span>}
        </div>
        {open?<ChevronUp size={13} style={{color:'var(--text-muted)'}}/>:<ChevronDown size={13} style={{color:'var(--text-muted)'}}/>}
      </button>
      {open&&(
        <div style={{padding:'0 14px 12px'}}>
          <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8,lineHeight:1.5}}>Perdas <strong style={{color:'var(--accent-red)'}}>não relacionadas a missões</strong> — compras, mortes, investimentos perdidos.</div>
          <div style={{display:'flex',gap:7,marginBottom:10,flexWrap:'wrap'}}>
            <input style={{...IS,width:130}} type="text" inputMode="numeric" value={amtDisplay}
              onChange={e=>{setAmtDisplay(e.target.value);setQuantidade(parseMoney(e.target.value));}}
              onBlur={()=>setAmtDisplay(amount>0?ptMoney(amount):'')}
              placeholder="ex: 500.000"/>
            <input style={{...IS,flex:1,minWidth:120}} value={note} onChange={e=>setNote(e.target.value)} placeholder="O que perdeu? Ex: Perdi cargo, compra..."/>
            <button onClick={()=>{if(amount>0){onAdd(amount,note,targetDate);setQuantidade(0);setAmtDisplay('');setNote('');}}} style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',background:'rgba(255,68,102,0.1)',border:'1px solid rgba(255,68,102,0.3)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase'}}>
              <Plus size={12}/> Registrar
            </button>
          </div>
          {dayLosses.map(l=>(
            <div key={l.id} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 8px',background:'rgba(255,68,102,0.04)',border:'1px solid rgba(255,68,102,0.1)',borderRadius:5,marginBottom:3}}>
              <span style={{fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--accent-red)',fontWeight:700,flexShrink:0}}>{ptMoney(l.amount)} aUEC</span>
              <span style={{flex:1,fontSize:11,color:'var(--text-secondary)'}}>{l.note||'—'}</span>
              {delConf===l.id?(
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>{onRemove(l.id);setDelConf(null);}} style={{padding:'2px 6px',background:'rgba(255,68,102,0.15)',border:'1px solid rgba(255,68,102,0.4)',borderRadius:3,color:'var(--accent-red)',cursor:'pointer',fontSize:10,fontWeight:700}}>Sim</button>
                  <button onClick={()=>setDelConf(null)} style={{padding:'2px 6px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:3,color:'var(--text-secondary)',cursor:'pointer',fontSize:10}}>Não</button>
                </div>
              ):(
                <button onClick={()=>setDelConf(l.id)} style={{width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:3,color:'var(--accent-red)',cursor:'pointer'}}><Trash2 size={10}/></button>
              )}
            </div>
          ))}
          {dayLosses.length===0&&<div style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',padding:'6px 0'}}>Nenhuma perda registrada para hoje</div>}
        </div>
      )}
    </div>
  );
}

// ── Painel de Seleção Múltipla ────────────────────────────────────────────────
function SelectionSummaryPanel({ selected, missions, onClear }) {
  const sel = missions.filter(m => selected.has(m.id));
  if (sel.length === 0) return null;

  const totalReward    = sel.reduce((a,m) => a+(m.reward||0), 0);
  const totalTime      = sel.reduce((a,m) => a+(m.timer_elapsed||0), 0);
  const completedN     = sel.filter(m=>m.status==='Completed').length;
  const failedN        = sel.filter(m=>m.status==='Failed').length;
  const buggedN        = sel.filter(m=>m.status==='Bugged').length;
  const activeN        = sel.filter(m=>m.status==='Active').length;

  // Contagem por tipo
  const byType = sel.reduce((acc,m) => { acc[m.type]=(acc[m.type]||0)+1; return acc; }, {});
  const topTypes = Object.entries(byType).sort((a,b)=>b[1]-a[1]);

  // Recompensa apenas de concluídas
  const earnedCompleted = sel.filter(m=>m.status==='Completed').reduce((a,m)=>a+(m.reward||0),0);

  return (
    <div style={{
      background:'var(--bg-card)',
      border:'1px solid rgba(0,212,255,0.35)',
      borderRadius:10,
      padding:'14px 16px',
      marginBottom:12,
      boxShadow:'0 0 20px rgba(0,212,255,0.08)',
    }}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:'var(--accent-primary)',boxShadow:'0 0 6px var(--accent-primary)'}}/>
          <span style={{fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,color:'var(--accent-primary)',letterSpacing:'0.06em'}}>
            {sel.length} MISSÃO{sel.length!==1?'S':''} SELECIONADA{sel.length!==1?'S':''}
          </span>
        </div>
        <button onClick={onClear} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 9px',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-muted)',cursor:'pointer',fontSize:10,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase'}}>
          <X size={10}/> Limpar
        </button>
      </div>

      {/* Métricas principais */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
        {[
          { label:'Recompensa Total', value:`${ptMoney(totalReward)} aUEC`, color:'var(--accent-gold)', sub: completedN > 0 ? `${ptMoney(earnedCompleted)} concluídas` : null },
          { label:'Tempo Total',      value: totalTime > 0 ? fmtDuration(totalTime) : '—',        color:'var(--accent-primary)', sub: totalTime>0&&sel.length>1 ? `~${fmtDuration(Math.round(totalTime/sel.length))}/missão` : null },
          { label:'Concluídas',       value: completedN,  color:'var(--accent-green)',  sub: sel.length > 0 ? `${Math.round(completedN/sel.length*100)}% taxa` : null },
          { label:'Falhas + Bugs',    value: failedN + buggedN, color: failedN+buggedN>0?'var(--accent-red)':'var(--text-muted)', sub: activeN > 0 ? `${activeN} ativa${activeN!==1?'s':''}` : null },
        ].map(({label,value,color,sub}) => (
          <div key={label} style={{background:'rgba(255,255,255,0.03)',border:'1px solid var(--border-subtle)',borderRadius:7,padding:'9px 11px',textAlign:'center'}}>
            <div style={{fontFamily:'Orbitron,monospace',fontSize:15,fontWeight:800,color,marginBottom:2}}>{value}</div>
            <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{label}</div>
            {sub && <div style={{fontSize:9,color:'var(--text-muted)',marginTop:2,fontStyle:'italic'}}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Distribuição por tipo */}
      {topTypes.length > 0 && (
        <div>
          <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Por Tipo de Missão</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
            {topTypes.map(([type, count]) => {
              const Icon = TYPE_ICONS[type] || Crosshair;
              const typeReward = sel.filter(m=>m.type===type&&m.status==='Completed').reduce((a,m)=>a+(m.reward||0),0);
              return (
                <div key={type} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',background:'rgba(0,212,255,0.06)',border:'1px solid rgba(0,212,255,0.15)',borderRadius:20,fontSize:11}}>
                  <Icon size={10} style={{color:'var(--accent-primary)'}}/>
                  <span style={{fontWeight:700,color:'var(--text-primary)'}}>{type}</span>
                  <span style={{color:'var(--text-muted)'}}>×{count}</span>
                  {typeReward > 0 && <span style={{fontFamily:'Share Tech Mono,monospace',color:'var(--accent-gold)',fontSize:10}}>· {ptMoney(typeReward)} aUEC</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal de reaproveitar missão ──────────────────────────────────────────────
function ReuseModal({ missions, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const filtered = useMemo(() => {
    return missions
      .filter(m => {
        const matchSearch = !search.trim() || m.title.toLowerCase().includes(search.toLowerCase()) || m.faction?.toLowerCase().includes(search.toLowerCase()) || m.type?.toLowerCase().includes(search.toLowerCase());
        const matchType   = filterType==='all' || m.type===filterType;
        return matchSearch && matchType;
      })
      .slice(0, 30);
  }, [missions, search, filterType]);

  const IS = {width:'100%',padding:'8px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none'};
  const SS = {...IS,appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 7px center',paddingRight:26};

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
      <div style={{background:'var(--bg-card)',border:'1px solid rgba(0,212,255,0.3)',borderRadius:12,padding:20,width:'100%',maxWidth:560,maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.7)'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <RefreshCw size={15} style={{color:'var(--accent-primary)'}}/>
            <span style={{fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--accent-primary)',letterSpacing:'0.06em'}}>REAPROVEITAR MISSÃO</span>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}><X size={15}/></button>
        </div>
        <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:14}}>
          Selecione uma missão anterior para usar como base. Você poderá editar tudo antes de salvar.
        </div>

        {/* Filtros */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 160px',gap:8,marginBottom:12}}>
          <div style={{position:'relative'}}>
            <Search size={12} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}}/>
            <input style={{...IS,paddingLeft:28}} placeholder="Buscar por título, facção, tipo..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select style={SS} value={filterType} onChange={e=>setFilterType(e.target.value)}>
            <option value="all">Todos os tipos</option>
            {MISSION_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Lista */}
        <div style={{overflowY:'auto',flex:1}}>
          {filtered.length === 0 ? (
            <div style={{textAlign:'center',padding:'30px 0',color:'var(--text-muted)',fontSize:12}}>Nenhuma missão encontrada</div>
          ) : (
            filtered.map(m => {
              const Icon = TYPE_ICONS[m.type] || Crosshair;
              return (
                <button key={m.id} onClick={()=>onSelect(m)} style={{
                  width:'100%',textAlign:'left',padding:'10px 12px',marginBottom:5,
                  background:'var(--bg-panel)',border:'1px solid var(--border-subtle)',borderRadius:8,
                  cursor:'pointer',transition:'all 0.15s',display:'block',
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,212,255,0.4)';e.currentTarget.style.background='rgba(0,212,255,0.06)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.background='var(--bg-panel)';}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <Icon size={13} style={{color:DIFF_COLORS[m.difficulty]||'var(--text-muted)',flexShrink:0}}/>
                    <span style={{fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.title}</span>
                    {m.reward>0&&<span style={{fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--accent-gold)',flexShrink:0}}>{ptMoney(m.reward)} aUEC</span>}
                  </div>
                  <div style={{display:'flex',gap:8,fontSize:10,color:'var(--text-muted)',paddingLeft:21,flexWrap:'wrap'}}>
                    <span>{m.type}</span>
                    {m.faction&&<span>· {m.faction}</span>}
                    {m.system&&<span>· {m.system}</span>}
                    {m.location&&<span>· {m.location}</span>}
                    <span style={{color:DIFF_COLORS[m.difficulty]||'var(--text-muted)'}}>· {m.difficulty}</span>
                    <span style={{color:'var(--text-muted)',marginLeft:'auto'}}>{ptShortData(m.created_at?.slice(0,10)||'')}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── TAB 1: Today's missions ───────────────────────────────────────────────────
function TodayTab({ missions, losses, onSave, onDelete, onStatusChange, onClockUpdate, onAddLoss, onRemoveLoss, objLibrary, onLootSave, onLootUpdate }) {
  const [showForm,setShowForm]     = useState(false);
  const [editM,setEditM]           = useState(null);
  const [filterStatus,setFilter]   = useState('all');
  const [selected,setSelected]     = useState(new Set());
  const [showReuse,setShowReuse]   = useState(false);
  const today = todayStr();
  const todayMissions = missions.filter(m=>m.created_at?.slice(0,10)===today);
  const filtered = filterStatus==='all' ? todayMissions : todayMissions.filter(m=>m.status===filterStatus);

  function handleSave(m) { onSave(m); setShowForm(false); setEditM(null); }

  function handleStatusChange(id, status) { onStatusChange(id, status); }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(m=>m.id)));
    }
  }

  // Reaproveitar missão: preenche o form com dados da missão anterior, limpa campos únicos
  function handleReuse(m) {
    setEditM({
      id: null, // nova missão
      title: m.title,
      type: m.type,
      faction: m.faction,
      system: m.system,
      location: m.location,
      difficulty: m.difficulty,
      status: 'Active',
      reward: m.reward,
      reputation_gain: m.reputation_gain,
      crew_needed: m.crew_needed,
      notes: m.notes,
      bug_description: '',
      created_at: new Date().toISOString(),
      completed_at: null,
      objectives: (m.objectives||[]).map(o=>({text:o.text, done:false})),
      timer_elapsed: 0,
    });
    setShowForm(false);
    setShowReuse(false);
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0;

  const SS={padding:'6px 22px 6px 9px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:12,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 5px center'};

  return (
    <div>
      {showReuse && (
        <ReuseModal missions={missions} onSelect={handleReuse} onClose={()=>setShowReuse(false)}/>
      )}
      {(showForm||editM)&&(
        <MissionForm initial={editM} onSave={handleSave} onCancelar={()=>{setShowForm(false);setEditM(null);}} objLibrary={objLibrary}/>
      )}
      {todayMissions.length>0&&(
        <DaySummary date={today} missions={todayMissions} losses={losses}/>
      )}
      <DailyLossPanel losses={losses} onAdd={onAddLoss} onRemove={onRemoveLoss} targetDate={today}/>

      {/* Painel de seleção múltipla */}
      {someSelected && (
        <SelectionSummaryPanel selected={selected} missions={missions} onClear={()=>setSelected(new Set())}/>
      )}

      {/* Barra de controles */}
      <div style={{display:'flex',gap:7,marginBottom:10,alignItems:'center',flexWrap:'wrap'}}>
        {!showForm&&!editM&&(
          <>
            <button onClick={()=>{setShowForm(true);setEditM(null);}} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.35)',borderRadius:7,color:'var(--accent-green)',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer'}}>
              <Plus size={14}/> Nova Missão
            </button>
            {missions.length > 0 && (
              <button onClick={()=>setShowReuse(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',background:'rgba(0,212,255,0.06)',border:'1px solid rgba(0,212,255,0.25)',borderRadius:7,color:'var(--accent-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer'}}>
                <RefreshCw size={13}/> Reaproveitar
              </button>
            )}
          </>
        )}
        <select style={SS} value={filterStatus} onChange={e=>setFilter(e.target.value)}>
          <option value="all">Todos os Status</option>
          {STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
        {/* Checkbox selecionar tudo */}
        {filtered.length > 0 && (
          <button onClick={toggleSelectAll} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',background:someSelected?'rgba(0,212,255,0.08)':'transparent',border:`1px solid ${someSelected?'rgba(0,212,255,0.3)':'var(--border-subtle)'}`,borderRadius:5,color:someSelected?'var(--accent-primary)':'var(--text-muted)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase'}}>
            <div style={{width:13,height:13,borderRadius:3,border:`2px solid ${allSelected?'var(--accent-primary)':'var(--text-muted)'}`,background:allSelected?'var(--accent-primary)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {allSelected && <div style={{width:6,height:6,background:'var(--bg-base)',borderRadius:1}}/>}
            </div>
            {allSelected ? 'Desmarcar' : someSelected ? `${selected.size} sel.` : 'Selecionar'}
          </button>
        )}
        <span style={{marginLeft:'auto',fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-muted)'}}>{filtered.length} missão(ões)</span>
      </div>

      {filtered.length===0?(
        <div className="empty-state" style={{paddingTop:30}}>
          <Crosshair size={44} className="empty-state-icon"/>
          <div className="empty-state-title">{todayMissions.length===0?'NENHUMA MISSÃO HOJE':'NENHUM RESULTADO'}</div>
          <div className="empty-state-text">Clique em "Nova Missão" para registrar.</div>
        </div>
      ):(
        filtered.map(m=>(
          <div key={m.id} style={{display:'flex',alignItems:'flex-start',gap:8}}>
            {/* Checkbox */}
            <button
              onClick={()=>toggleSelect(m.id)}
              style={{
                marginTop:12,flexShrink:0,width:18,height:18,borderRadius:4,
                border:`2px solid ${selected.has(m.id)?'var(--accent-primary)':'var(--border-normal)'}`,
                background:selected.has(m.id)?'var(--accent-primary)':'transparent',
                cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                transition:'all 0.15s',
              }}>
              {selected.has(m.id)&&<div style={{width:8,height:8,background:'var(--bg-base)',borderRadius:1}}/>}
            </button>
            <div style={{flex:1}}>
              <MissionCard mission={m}
                onEdit={m=>{setEditM(m);setShowForm(false);}}
                onDelete={onDelete} onStatusChange={handleStatusChange} onClockUpdate={onClockUpdate}
                onLootUpdate={(loot)=>onLootUpdate(m.id, loot)}/>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── TAB 2: History ────────────────────────────────────────────────────────────
function HistoryTab({ missions, losses }) {
  const dates=useMemo(()=>[...new Set(missions.map(m=>m.created_at?.slice(0,10)).filter(Boolean))].sort((a,b)=>b.localeCompare(a)),[missions]);
  const years=useMemo(()=>[...new Set(dates.map(d=>Number(d.slice(0,4))))].sort((a,b)=>b-a),[dates]);
  const [selYear,setSelYear]=useState(()=>years[0]||new Date().getFullYear());
  const [selMonth,setSelMonth]=useState(()=>new Date().getMonth());
  const [selDay,setSelDay]=useState(null);

  const monthsWithData=useMemo(()=>[...new Set(dates.filter(d=>Number(d.slice(0,4))===selYear).map(d=>Number(d.slice(5,7))-1))],[dates,selYear]);
  const monthDatas=useMemo(()=>dates.filter(d=>Number(d.slice(0,4))===selYear&&Number(d.slice(5,7))-1===selMonth),[dates,selYear,selMonth]);
  const selectedDayMissions=useMemo(()=>selDay?missions.filter(m=>m.created_at?.slice(0,10)===selDay):[],[selDay,missions]);
  const selectedDayLosses=useMemo(()=>selDay?losses.filter(l=>l.date===selDay):[],[selDay,losses]);

  const SS={padding:'6px 22px 6px 9px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:12,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 5px center'};

  return (
    <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:16,height:'100%'}}>
      <div style={{borderRight:'1px solid var(--border-subtle)',overflowY:'auto',paddingRight:12}}>
        <div style={{display:'flex',gap:7,marginBottom:12}}>
          <select style={{...SS,flex:1}} value={selYear} onChange={e=>{setSelYear(Number(e.target.value));setSelDay(null);}}>
            {(years.length>0?years:[new Date().getFullYear()]).map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <select style={{...SS,flex:1}} value={selMonth} onChange={e=>{setSelMonth(Number(e.target.value));setSelDay(null);}}>
            {MONTHS_PT.map((m,i)=>(
              <option key={i} value={i} disabled={!monthsWithData.includes(i)} style={{color:monthsWithData.includes(i)?'var(--text-primary)':'var(--text-muted)'}}>{m}</option>
            ))}
          </select>
        </div>
        {monthDatas.length===0?(
          <div style={{fontSize:12,color:'var(--text-muted)',textAlign:'center',padding:'20px 0'}}>{MONTHS_PT[selMonth]} {selYear} não tem missões.</div>
        ):(
          <div>
            <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>{monthDatas.length} dia{monthDatas.length!==1?'s':''} com missões</div>
            {monthDatas.map(date=>{
              const dayM=missions.filter(m=>m.created_at?.slice(0,10)===date);
              const earned=dayM.filter(m=>m.status==='Completed').reduce((a,m)=>a+(m.reward||0),0);
              const lost=losses.filter(l=>l.date===date).reduce((a,l)=>a+(l.amount||0),0);
              const net=earned-lost;
              const isSelected=selDay===date;
              return (
                <button key={date} onClick={()=>setSelDay(isSelected?null:date)} style={{
                  width:'100%',textAlign:'left',padding:'9px 11px',marginBottom:5,
                  background:isSelected?'rgba(0,212,255,0.1)':'var(--bg-card)',
                  border:`1px solid ${isSelected?'var(--border-bright)':'var(--border-subtle)'}`,
                  borderRadius:7,cursor:'pointer',transition:'all 0.15s',
                }}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                    <span style={{fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,color:isSelected?'var(--accent-primary)':'var(--text-primary)'}}>{ptShortData(date)}</span>
                    <span style={{fontFamily:'Orbitron,monospace',fontSize:11,fontWeight:800,color:net>=0?'var(--accent-green)':'var(--accent-red)'}}>
                      {net>=0?'+':''}{ptMoney(net)}
                    </span>
                  </div>
                  <div style={{display:'flex',gap:8,fontSize:10,color:'var(--text-muted)'}}>
                    <span>{dayM.length} missão(ões)</span>
                    {earned>0&&<span style={{color:'var(--accent-green)'}}>+{ptMoney(earned)}</span>}
                    {lost>0&&<span style={{color:'var(--accent-red)'}}>-{ptMoney(lost)}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div style={{overflowY:'auto'}}>
        {!selDay?(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--text-muted)'}}>
            <Calendar size={40} style={{opacity:0.2,marginBottom:10}}/>
            <div style={{fontSize:13,fontWeight:600}}>Selecione um dia para ver os detalhes</div>
          </div>
        ):(
          <div>
            <DaySummary date={selDay} missions={selectedDayMissions} losses={selectedDayLosses}/>
            {selectedDayLosses.length>0&&(
              <div style={{marginBottom:12,padding:'10px 14px',background:'rgba(255,68,102,0.04)',border:'1px solid rgba(255,68,102,0.15)',borderRadius:8}}>
                <div style={{fontSize:10,fontWeight:700,color:'var(--accent-red)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:7}}>💸 Perdas Manuais do Dia</div>
                {selectedDayLosses.map(l=>(
                  <div key={l.id} style={{display:'flex',gap:8,padding:'3px 0',borderBottom:'1px solid var(--border-subtle)',fontSize:11}}>
                    <span style={{fontFamily:'Share Tech Mono,monospace',color:'var(--accent-red)',fontWeight:700}}>{ptMoney(l.amount)} aUEC</span>
                    <span style={{color:'var(--text-secondary)'}}>{l.note||'—'}</span>
                  </div>
                ))}
              </div>
            )}
            {(selectedDayMissions.some(m=>m.status==='Failed')||selectedDayMissions.some(m=>m.status==='Bugged'))&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                {selectedDayMissions.filter(m=>m.status==='Failed').length>0&&(
                  <div style={{padding:'10px',background:'rgba(255,68,102,0.06)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:7}}>
                    <div style={{fontSize:10,fontWeight:700,color:'var(--accent-red)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>❌ Falhas (sua responsabilidade)</div>
                    <div style={{fontFamily:'Orbitron,monospace',fontSize:16,fontWeight:800,color:'var(--accent-red)'}}>{ptMoney(selectedDayMissions.filter(m=>m.status==='Failed').reduce((a,m)=>a+(m.reward||0),0))} aUEC</div>
                    <div style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>{selectedDayMissions.filter(m=>m.status==='Failed').length} missão(ões) falhada(s)</div>
                  </div>
                )}
                {selectedDayMissions.filter(m=>m.status==='Bugged').length>0&&(
                  <div style={{padding:'10px',background:'rgba(225,112,85,0.06)',border:'1px solid rgba(225,112,85,0.2)',borderRadius:7}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#e17055',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>🐛 Bugadas (bug do jogo)</div>
                    <div style={{fontFamily:'Orbitron,monospace',fontSize:16,fontWeight:800,color:'#e17055'}}>{ptMoney(selectedDayMissions.filter(m=>m.status==='Bugged').reduce((a,m)=>a+(m.reward||0),0))} aUEC</div>
                    <div style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>{selectedDayMissions.filter(m=>m.status==='Bugged').length} missão(ões) bugada(s)</div>
                  </div>
                )}
              </div>
            )}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>{selectedDayMissions.length} Missão(ões)</div>
              {selectedDayMissions.length===0?(
                <div style={{fontSize:12,color:'var(--text-muted)',textAlign:'center',padding:20}}>Nenhuma missão neste dia.</div>
              ):(
                selectedDayMissions.map(m=>{
                  const TipoIcon=TYPE_ICONS[m.type]||Crosshair;
                  return (
                    <div key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--bg-card)',border:`1px solid ${STATUS_COLORS[m.status]||'var(--border-subtle)'}22`,borderRadius:7,marginBottom:5}}>
                      <TipoIcon size={14} style={{color:DIFF_COLORS[m.difficulty]||'var(--text-muted)',flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.title}</div>
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>{m.type} · {m.faction} · {fmtHora(m.created_at)}{m.timer_elapsed>0?` · ⏱️ ${fmtDuration(m.timer_elapsed)}`:''}{m.loot?` · 🎁 ${ptMoney(m.loot.perPerson)}/pessoa`:''}</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <span style={{fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:3,background:`${STATUS_COLORS[m.status]}18`,color:STATUS_COLORS[m.status],border:`1px solid ${STATUS_COLORS[m.status]}33`}}>
                          {m.status==='Bugged'?'🐛':''}{m.status}
                        </span>
                        {m.reward>0&&<div style={{fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--accent-gold)',marginTop:2}}>{ptMoney(m.reward)} aUEC</div>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TAB 3: Global Estatísticas ──────────────────────────────────────────────────
function StatsTab({ missions, losses }) {
  const [period,setPeriod]=useState(30);
  const cutdef=useMemo(()=>{const d=new Date();d.setDate(d.getDate()-period);return d.toISOString().slice(0,10);},[period]);
  const inAlcance=useMemo(()=>missions.filter(m=>m.created_at?.slice(0,10)>=cutdef),[missions,cutdef]);

  const dailyData=useMemo(()=>{
    const days=[];
    for(let i=period-1;i>=0;i--){
      const d=new Date();d.setDate(d.getDate()-i);
      const ds=d.toISOString().slice(0,10);
      const dm=missions.filter(m=>m.created_at?.slice(0,10)===ds);
      const earned=dm.filter(m=>m.status==='Completed').reduce((a,m)=>a+(m.reward||0),0);
      const failed=dm.filter(m=>m.status==='Failed').reduce((a,m)=>a+(m.reward||0),0);
      const bugged=dm.filter(m=>m.status==='Bugged').reduce((a,m)=>a+(m.reward||0),0);
      const lost=losses.filter(l=>l.date===ds).reduce((a,l)=>a+(l.amount||0),0);
      days.push({date:ds,label:`${d.getDate()}/${d.getMonth()+1}`,earned,failed,bugged,lost,net:earned-lost,count:dm.length,completed:dm.filter(m=>m.status==='Completed').length});
    }
    return days;
  },[missions,losses,period]);

  const totalEarned =inAlcance.filter(m=>m.status==='Completed').reduce((a,m)=>a+(m.reward||0),0);
  const totalFailed =inAlcance.filter(m=>m.status==='Failed').reduce((a,m)=>a+(m.reward||0),0);
  const totalBugged =inAlcance.filter(m=>m.status==='Bugged').reduce((a,m)=>a+(m.reward||0),0);
  const totalLost   =losses.filter(l=>l.date>=cutdef).reduce((a,l)=>a+(l.amount||0),0);
  const netTotal    =totalEarned-totalLost;
  const completedN  =inAlcance.filter(m=>m.status==='Completed').length;
  const successRate =inAlcance.length>0?Math.round(completedN/inAlcance.length*100):0;
  const avgReward   =completedN>0?Math.round(totalEarned/completedN):0;
  const timedM      =missions.filter(m=>(m.timer_elapsed||0)>0);
  const avgMin      =timedM.length>0?Math.round(timedM.reduce((a,m)=>a+(m.timer_elapsed||0),0)/timedM.length/60000):0;

  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Período:</span>
        {[{v:7,l:'7 dias'},{v:14,l:'14 dias'},{v:30,l:'30 dias'},{v:90,l:'3 meses'},{v:365,l:'12 meses'}].map(o=>(
          <button key={o.v} className={`filter-chip ${period===o.v?'active':''}`} onClick={()=>setPeriod(o.v)}>{o.l}</button>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:18}}>
        {[
          {l:'Ganho Total',       v:`${ptMoney(totalEarned)} aUEC`, c:'var(--accent-green)',   s:'missões concluídas'},
          {l:'Perdas Manuais',    v:`${ptMoney(totalLost)} aUEC`,   c:'var(--accent-red)',     s:'fora de missões'},
          {l:'Falhas (não ganho)',v:`${ptMoney(totalFailed)} aUEC`, c:'#ff8c00',               s:'sua responsabilidade'},
          {l:'Bugadas (perdido)', v:`${ptMoney(totalBugged)} aUEC`, c:'#e17055',               s:'bug do jogo'},
          {l:'Net Total',         v:`${netTotal>=0?'+':''}${ptMoney(netTotal)} aUEC`, c:netTotal>=0?'var(--accent-green)':'var(--accent-red)', s:'ganhos - perdas'},
          {l:'Taxa de Sucesso',   v:`${successRate}%`,              c:'var(--accent-primary)', s:`${completedN} de ${inAlcance.length}`},
          {l:'Média por Missão',  v:`${ptMoney(avgReward)} aUEC`,   c:'var(--accent-gold)',    s:'missões concluídas'},
          {l:'Tempo Médio',       v:avgMin>0?`${avgMin} min`:'—',   c:'var(--accent-primary)', s:'por missão cronometrada'},
        ].map(({l,v,c,s})=>(
          <div key={l} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'11px 13px'}}>
            <div style={{fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:800,color:c,marginBottom:2}}>{v}</div>
            <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{l}</div>
            <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2,fontStyle:'italic'}}>{s}</div>
          </div>
        ))}
      </div>
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'14px',marginBottom:14}}>
        <div className="modal-section-title">Distribuição de Status — {inAlcance.length} missões</div>
        <div style={{display:'flex',gap:20,justifyContent:'center',flexWrap:'wrap'}}>
          <DonutStat value={inAlcance.filter(m=>m.status==='Completed').length}  total={inAlcance.length} label="Concluídas"  color="var(--accent-green)"/>
          <DonutStat value={inAlcance.filter(m=>m.status==='Active').length}     total={inAlcance.length} label="Ativas"      color="var(--accent-primary)"/>
          <DonutStat value={inAlcance.filter(m=>m.status==='Failed').length}     total={inAlcance.length} label="Falhas"      color="var(--accent-red)"/>
          <DonutStat value={inAlcance.filter(m=>m.status==='Bugged').length}     total={inAlcance.length} label="Bugadas"     color="#e17055"/>
          <DonutStat value={inAlcance.filter(m=>m.status==='Abandoned').length}  total={inAlcance.length} label="Abandonadas" color="var(--text-muted)"/>
          <DonutStat value={inAlcance.filter(m=>m.status==='Pending').length}    total={inAlcance.length} label="Pendentes"   color="var(--accent-gold)"/>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'13px'}}>
          <div className="modal-section-title"><TrendingUp size={11}/> Lucro por Dia (aUEC)</div>
          <BarChart data={dailyData} valueKey="earned" labelKey="label" color="var(--accent-green)" height={100}/>
          <div style={{display:'flex',gap:10,marginTop:5,fontSize:10,color:'var(--text-muted)'}}>
            <span>Total: <span style={{color:'var(--accent-green)'}}>{ptMoney(totalEarned)}</span></span>
            <span>Pico: <span style={{color:'var(--accent-primary)'}}>{ptMoney(Math.max(...dailyData.map(d=>d.earned)))}</span></span>
          </div>
        </div>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'13px'}}>
          <div className="modal-section-title"><DollarSign size={11}/> Resultado Líquido (NET)</div>
          <BarChart data={dailyData} valueKey="net" labelKey="label" color="var(--accent-primary)" height={100}/>
          <div style={{display:'flex',gap:10,marginTop:5,fontSize:10,color:'var(--text-muted)'}}>
            <span>+{ptMoney(totalEarned)}</span><span style={{color:'var(--accent-red)'}}>-{ptMoney(totalLost)}</span>
            <span style={{color:netTotal>=0?'var(--accent-green)':'var(--accent-red)',fontWeight:700}}>NET: {ptMoney(netTotal)}</span>
          </div>
        </div>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'13px'}}>
          <div className="modal-section-title"><BarChart3 size={11}/> Missões por Dia</div>
          <BarChart data={dailyData} valueKey="count" labelKey="label" color="var(--accent-primary)" height={100}/>
          <div style={{display:'flex',gap:10,marginTop:5,fontSize:10,color:'var(--text-muted)'}}>
            <span>Total: {inAlcance.length}</span><span>Média: {inAlcance.length>0?(inAlcance.length/period).toFixed(1):0}/dia</span>
          </div>
        </div>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'13px'}}>
          <div className="modal-section-title"><Clock size={11}/> Tempo por Missão (min)</div>
          <BarChart data={timedM.slice(-20).map(m=>({label:m.title.slice(0,10),duration:Math.round((m.timer_elapsed||0)/60000)}))} valueKey="duration" labelKey="label" color="var(--accent-gold)" height={100} suffix=" min" noDataMsg="Nenhuma missão cronometrada"/>
          <div style={{fontSize:10,color:'var(--text-muted)',marginTop:5}}>Média: {avgMin} min · {timedM.length} cronometradas</div>
        </div>
      </div>
      {(totalFailed>0||totalBugged>0)&&(
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'14px'}}>
          <div className="modal-section-title">⚠️ Recompensas Perdidas — Falha vs Bug</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{padding:'11px',background:'rgba(255,68,102,0.06)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:7}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--accent-red)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>❌ Falhadas (sua responsabilidade)</div>
              <div style={{fontFamily:'Orbitron,monospace',fontSize:18,fontWeight:800,color:'var(--accent-red)'}}>{ptMoney(totalFailed)} aUEC</div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>{inAlcance.filter(m=>m.status==='Failed').length} missão(ões) · recompensas não ganhas</div>
            </div>
            <div style={{padding:'11px',background:'rgba(225,112,85,0.06)',border:'1px solid rgba(225,112,85,0.2)',borderRadius:7}}>
              <div style={{fontSize:10,fontWeight:700,color:'#e17055',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>🐛 Bugadas (bug do jogo)</div>
              <div style={{fontFamily:'Orbitron,monospace',fontSize:18,fontWeight:800,color:'#e17055'}}>{ptMoney(totalBugged)} aUEC</div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>{inAlcance.filter(m=>m.status==='Bugged').length} missão(ões) · perdas por bug técnico</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MissionTrackerPage() {
  const [missions,setMissions]=useState(()=>load(MISSIONS_KEY,[]));
  const [losses,setLosses]    =useState(()=>load(LOSSES_KEY,[]));
  const [activeTab,setActiveTab]=useState('today');
  const [lootMission,setLootMission]=useState(null); // missão aguardando modal de loot
  const {lib:objLibrary,addToLib}=useObjLibrary();

  function persistMissions(updated){setMissions(updated);save(MISSIONS_KEY,updated);}
  function persistLosses(updated) {setLosses(updated);save(LOSSES_KEY,updated);}

  function handleSave(m) {
    if(m.objectives?.length>0) addToLib(m.objectives.map(o=>o.text));
    const updated=missions.some(x=>x.id===m.id)?missions.map(x=>x.id===m.id?m:x):[m,...missions];
    persistMissions(updated);
  }
  function handleDelete(id)           { persistMissions(missions.filter(m=>m.id!==id)); }

  function handleStatusChange(id, status) {
    const mission = missions.find(m => m.id === id);
    const updated = missions.map(m => m.id === id ? {
      ...m, status,
      completed_at: status === 'Completed' ? new Date().toISOString() : m.completed_at,
      objectives: status === 'Completed' ? (m.objectives||[]).map(o=>({...o,done:true})) : m.objectives,
    } : m);
    persistMissions(updated);
    // Ao completar, abrir modal de loot
    if (status === 'Completed' && mission) {
      setLootMission({ ...mission, status: 'Completed' });
    }
  }

  function handleClockUpdate(id,elapsed){ persistMissions(missions.map(m=>m.id===id?{...m,timer_elapsed:elapsed}:m)); }

  function handleAddLoss(amount,note,date) {
    const entry={id:Date.now(),amount:Number(amount)||0,note:note||'',date:date||todayStr(),created_at:new Date().toISOString()};
    persistLosses([entry,...losses]);
  }
  function handleRemoveLoss(id){ persistLosses(losses.filter(l=>l.id!==id)); }

  function handleLootSave(loot) {
    if (lootMission) {
      persistMissions(missions.map(m => m.id === lootMission.id ? { ...m, loot } : m));
    }
    setLootMission(null);
  }
  function handleLootSkip() {
    setLootMission(null);
  }
  function handleLootUpdate(missionId, loot) {
    persistMissions(missions.map(m => m.id === missionId ? { ...m, loot } : m));
  }

  const today=todayStr();
  const todayM=missions.filter(m=>m.created_at?.slice(0,10)===today);
  const totalRewards=missions.filter(m=>m.status==='Completed').reduce((a,m)=>a+(m.reward||0),0);
  const activeCount=missions.filter(m=>m.status==='Active').length;
  const buggedCount=missions.filter(m=>m.status==='Bugged').length;

  const TABS=[
    {id:'today',   label:'Hoje',          icon:Calendar,  badge:todayM.length>0?String(todayM.length):null},
    {id:'history', label:'Histórico',      icon:Clock,     badge:null},
    {id:'stats',   label:'Estatísticas',   icon:BarChart3,  badge:null},
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Modal de loot — aparece sobre tudo */}
      {lootMission&&(
        <LootDistributionModal
          mission={lootMission}
          onSave={handleLootSave}
          onSkip={handleLootSkip}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">RASTREADOR DE MISSÕES</div>
          <div className="page-subtitle">
            {missions.length} missões · {activeCount} ativas
            {buggedCount>0&&<span style={{marginLeft:8,color:'#e17055'}}>· 🐛 {buggedCount} bugadas</span>}
            {totalRewards>0&&<span style={{marginLeft:8,color:'var(--accent-gold)'}}>· {ptMoney(totalRewards)} aUEC ganhos</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{padding:'0 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',display:'flex',flexShrink:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            display:'flex',alignItems:'center',gap:7,padding:'11px 18px',
            background:'transparent',border:'none',
            borderBottom:`2px solid ${activeTab===t.id?'var(--accent-primary)':'transparent'}`,
            color:activeTab===t.id?'var(--accent-primary)':'var(--text-secondary)',
            fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,
            letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer',transition:'all 0.2s',
          }}>
            <t.icon size={13}/>
            {t.label}
            {t.badge&&<span style={{fontFamily:'Share Tech Mono,monospace',fontSize:10,padding:'1px 6px',background:activeTab===t.id?'rgba(0,212,255,0.15)':'rgba(255,255,255,0.05)',borderRadius:8}}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="page-body">
        {activeTab==='today'&&(
          <TodayTab missions={missions} losses={losses}
            onSave={handleSave} onDelete={handleDelete}
            onStatusChange={handleStatusChange} onClockUpdate={handleClockUpdate}
            onAddLoss={handleAddLoss} onRemoveLoss={handleRemoveLoss}
            objLibrary={objLibrary} onLootSave={handleLootSave} onLootUpdate={handleLootUpdate}/>
        )}
        {activeTab==='history'&&<HistoryTab missions={missions} losses={losses}/>}
        {activeTab==='stats'&&<StatsTab missions={missions} losses={losses}/>}
      </div>
    </div>
  );
}
