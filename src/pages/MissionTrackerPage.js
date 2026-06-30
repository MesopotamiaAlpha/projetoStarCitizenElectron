import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, CheckCircle2, Clock, AlertTriangle,
  Search, MapPin, Users, Package, Crosshair, Edit3, X, Save,
  Play, Square, TrendingUp, TrendingDown, DollarSign,
  BarChart3, Calendar, Bug, ChevronDown, ChevronUp,
  Lightbulb, Minus, RefreshCw, Star, ArrowLeft, ArrowRight
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
const status      = ['Active','Completed','Falhou','Abandonada','Pendente','Bugada'];
const MONTHS_PT     = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const STATUS_COLORS = { Active:'var(--accent-primary)',Concluída:'var(--accent-green)',Failed:'var(--accent-red)',Abandoned:'var(--text-muted)',Pending:'var(--accent-gold)',Bugged:'#e17055' };
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
            {status.map(s=><option key={s} style={{color:'var(--text-primary)'}}>{s}</option>)}
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

// ── Mission Card ──────────────────────────────────────────────────────────────
function MissionCard({ mission, onEdit, onDelete, onStatusChange, onClockUpdate }) {
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
              {status.map(s=><option key={s}>{s}</option>)}
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
                <div key={i} style={{display:'flex',alignItems:'center',gap:5,marginBottom:3,fontSize:11,color:obj.done?'var(--text-muted)':'var(--text-secondary)',textDecoration:obj.done?'line-through':'none'}}>
                  {obj.done?<CheckCircle2 size={12} style={{color:'var(--accent-green)'}}/>:<div style={{width:12,height:12,borderRadius:'50%',border:'1px solid var(--text-muted)',flexShrink:0}}/>}
                  {obj.text}
                </div>
              ))}
            </div>
          )}
          {mission.reward>0&&mission.crew_needed>1&&(
            <div style={{marginBottom:8,padding:'7px 10px',background:'rgba(0,229,160,0.05)',border:'1px solid rgba(0,229,160,0.15)',borderRadius:6}}>
              <div style={{fontSize:10,fontWeight:700,color:'var(--accent-green)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5}}>💰 Divisão — {mission.crew_needed} pessoas</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {Array.from({length:mission.crew_needed},(_,i)=>(
                  <div key={i} style={{background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,padding:'4px 8px',textAlign:'center',minWidth:90}}>
                    <div style={{fontSize:9,color:'var(--text-muted)',marginBottom:1}}>Jogador {i+1}</div>
                    <div style={{fontFamily:'Share Tech Mono,monospace',fontSize:11,fontWeight:700,color:'var(--accent-gold)'}}>{ptMoney(Math.floor(mission.reward/mission.crew_needed))}</div>
                  </div>
                ))}
                {mission.reward%mission.crew_needed!==0&&<div style={{fontSize:10,color:'var(--text-muted)',alignSelf:'center'}}>*Sobra: {ptMoney(mission.reward%mission.crew_needed)} aUEC</div>}
              </div>
            </div>
          )}
          {mission.notes&&<div style={{fontSize:11,color:'var(--text-secondary)',lineHeight:1.5,marginBottom:5}}>{mission.notes}</div>}
          <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace',display:'flex',gap:12,flexWrap:'wrap'}}>
            <span>Criada: {fmtHora(mission.created_at)}</span>
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
          strokeLinecap="round" transform="rotate(-90 32 32)" style={{transition:'stroke-dashdefset 0.6s ease'}}/>
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

// ── TAB 1: Today's missions ───────────────────────────────────────────────────
function TodayTab({ missions, losses, onSave, onDelete, onStatusChange, onClockUpdate, onAddLoss, onRemoveLoss, objLibrary }) {
  const [showForm,setShowForm]=useState(false);
  const [editM,setEditM]=useState(null);
  const [filterStatus,setFilterStatus]=useState('all');
  const today=todayStr();
  const todayMissions=missions.filter(m=>m.created_at?.slice(0,10)===today);
  const filtered=filterStatus==='all'?todayMissions:todayMissions.filter(m=>m.status===filterStatus);

  function handleSave(m) {
    onSave(m); setShowForm(false); setEditM(null);
  }

  const SS={padding:'6px 22px 6px 9px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:12,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 5px center'};

  return (
    <div>
      {/* Form */}
      {(showForm||editM)&&(
        <MissionForm initial={editM} onSave={handleSave} onCancelar={()=>{setShowForm(false);setEditM(null);}} objLibrary={objLibrary}/>
      )}

      {/* Day summary */}
      {todayMissions.length>0&&(
        <DaySummary date={today} missions={todayMissions} losses={losses}/>
      )}

      {/* Daily loss panel */}
      <DailyLossPanel losses={losses} onAdd={onAddLoss} onRemove={onRemoveLoss} targetDate={today}/>

      {/* Filter + add */}
      <div style={{display:'flex',gap:7,marginBottom:10,alignItems:'center',flexWrap:'wrap'}}>
        {!showForm&&!editM&&(
          <button onClick={()=>setShowForm(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.35)',borderRadius:7,color:'var(--accent-green)',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer'}}>
            <Plus size={14}/> Nova Missão
          </button>
        )}
        <select style={SS} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">Todos os Status</option>
          {status.map(s=><option key={s}>{s}</option>)}
        </select>
        <span style={{marginLeft:'auto',fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-muted)'}}>{filtered.length} missão(ões)</span>
      </div>

      {/* Today's missions */}
      {filtered.length===0?(
        <div className="empty-state" style={{paddingTop:30}}>
          <Crosshair size={44} className="empty-state-icon"/>
          <div className="empty-state-title">{todayMissions.length===0?'NENHUMA MISSÃO HOJE':'NENHUM RESULTADO'}</div>
          <div className="empty-state-text">Clique em "Nova Missão" para registrar.</div>
        </div>
      ):(
        filtered.map(m=>(
          <MissionCard key={m.id} mission={m}
            onEdit={m=>{setEditM(m);setShowForm(false);}}
            onDelete={onDelete} onStatusChange={onStatusChange} onClockUpdate={onClockUpdate}/>
        ))
      )}
    </div>
  );
}

// ── TAB 2: History by day ─────────────────────────────────────────────────────
function HistoryTab({ missions, losses }) {
  const today=todayStr();
  const [selYear,setSelYear]=useState(()=>new Date().getFullYear());
  const [selMonth,setSelMonth]=useState(()=>new Date().getMonth()); // 0-indexed
  const [selDay,setSelDay]=useState(null);

  // Get all dates that have missions (excluding today)
  const allDatas=useMemo(()=>{
    const set=new Set(missions.filter(m=>m.created_at?.slice(0,10)!==today).map(m=>m.created_at?.slice(0,10)).filter(Boolean));
    return [...set].sort((a,b)=>b.localeCompare(a));
  },[missions,today]);

  // Datas in selected month
  const monthDatas=useMemo(()=>{
    const prefix=`${selYear}-${String(selMonth+1).padStart(2,'0')}`;
    return allDatas.filter(d=>d.startsWith(prefix));
  },[allDatas,selYear,selMonth]);

  // Years with data
  const years=useMemo(()=>[...new Set(allDatas.map(d=>Number(d.slice(0,4))))].sort((a,b)=>b-a),[allDatas]);
  // Months with data in selected year
  const monthsWithData=useMemo(()=>[...new Set(allDatas.filter(d=>d.startsWith(String(selYear))).map(d=>Number(d.slice(5,7))-1))]
    ,[allDatas,selYear]);

  const selectedDayMissions=selDay?missions.filter(m=>m.created_at?.slice(0,10)===selDay):[];
  const selectedDayLosses=selDay?losses.filter(l=>l.date===selDay):[];

  const SS={padding:'6px 22px 6px 9px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:12,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 5px center'};

  return (
    <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:16,height:'100%'}}>
      {/* Left: Calendar nav */}
      <div style={{borderRight:'1px solid var(--border-subtle)',overflowY:'auto',paddingRight:12}}>
        {/* Year + Month selectors */}
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

        {/* Days in selected month */}
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

      {/* Right: Selected day detail */}
      <div style={{overflowY:'auto'}}>
        {!selDay?(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--text-muted)'}}>
            <Calendar size={40} style={{opacity:0.2,marginBottom:10}}/>
            <div style={{fontSize:13,fontWeight:600}}>Selecione um dia para ver os detalhes</div>
          </div>
        ):(
          <div>
            <DaySummary date={selDay} missions={selectedDayMissions} losses={selectedDayLosses}/>

            {/* Losses de the day */}
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

            {/* Failed/Bugged */}
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

            {/* Mission list */}
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
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>{m.type} · {m.faction} · {fmtHora(m.created_at)}{m.timer_elapsed>0?` · ⏱️ ${fmtDuration(m.timer_elapsed)}`:''}</div>
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
  const cutdef=useMemo(()=>{const d=new Date();d.setData(d.getDate()-period);return d.toISOString().slice(0,10);},[period]);
  const inAlcance=useMemo(()=>missions.filter(m=>m.created_at?.slice(0,10)>=cutdef),[missions,cutdef]);

  const dailyData=useMemo(()=>{
    const days=[];
    for(let i=period-1;i>=0;i--){
      const d=new Date();d.setData(d.getDate()-i);
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

      {/* KPIs grid */}
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

      {/* Donuts */}
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

      {/* 4 charts */}
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
          <div style={{fontSize:10,color:'var(--text-muted)',marginTop:5}}>Total: {inAlcance.length} · Concluídas: {completedN}</div>
        </div>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'13px'}}>
          <div className="modal-section-title"><Clock size={11}/> Tempo por Missão (min)</div>
          <BarChart data={timedM.slice(-20).map(m=>({label:m.title.slice(0,10),duration:Math.round((m.timer_elapsed||0)/60000)}))} valueKey="duration" labelKey="label" color="var(--accent-gold)" height={100} suffix=" min" noDataMsg="Nenhuma missão cronometrada"/>
          <div style={{fontSize:10,color:'var(--text-muted)',marginTop:5}}>Média: {avgMin} min · {timedM.length} cronometradas</div>
        </div>
      </div>

      {/* Failed vs Bugged comparison */}
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
  const {lib:objLibrary,addToLib}=useObjLibrary();

  function persistMissions(updated){setMissions(updated);save(MISSIONS_KEY,updated);}
  function persistLosses(updated) {setLosses(updated);save(LOSSES_KEY,updated);}

  function handleSave(m) {
    if(m.objectives?.length>0) addToLib(m.objectives.map(o=>o.text));
    const updated=missions.some(x=>x.id===m.id)?missions.map(x=>x.id===m.id?m:x):[m,...missions];
    persistMissions(updated);
  }
  function handleDelete(id)           { persistMissions(missions.filter(m=>m.id!==id)); }
  function handleStatusChange(id,status) {
    persistMissions(missions.map(m=>m.id===id?{...m,status,
      completed_at:status==='Completed'?new Date().toISOString():m.completed_at,
      objectives:status==='Completed'?(m.objectives||[]).map(o=>({...o,done:true})):m.objectives,
    }:m));
  }
  function handleClockUpdate(id,elapsed){ persistMissions(missions.map(m=>m.id===id?{...m,timer_elapsed:elapsed}:m)); }
  function handleAddLoss(amount,note,date) {
    const entry={id:Date.now(),amount:Number(amount)||0,note:note||'',date:date||todayStr(),created_at:new Date().toISOString()};
    persistLosses([entry,...losses]);
  }
  function handleRemoveLoss(id){ persistLosses(losses.filter(l=>l.id!==id)); }

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
            objLibrary={objLibrary}/>
        )}
        {activeTab==='history'&&<HistoryTab missions={missions} losses={losses}/>}
        {activeTab==='stats'&&<StatsTab missions={missions} losses={losses}/>}
      </div>
    </div>
  );
}
