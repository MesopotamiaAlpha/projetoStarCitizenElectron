import React, { useState, useMemo } from 'react';
import { Users, Plus, Trash2, Shield, Star, Copy, Check } from 'lucide-react';

const ROLES = ['Pilot','Gunner','Marine','Medic','Engineer','Scout','Miner','Salvager','Trader','Support'];
const ROLE_COLORS = { Pilot:'#00d4ff',Gunner:'#ff4466',Marine:'#ff8c00',Medic:'#00e5a0',Engineer:'#ffc436',Scout:'#b44cff',Miner:'#fdcb6e',Salvager:'#a29bfe',Trader:'#55efc4',Support:'#74b9ff' };
const STATUS_OPTS = ['Online','Offline','AFK','In Mission','PVP'];
const STATUS_COLORS = { Online:'var(--accent-green)',Offline:'var(--text-muted)',AFK:'var(--accent-gold)',InMission:'var(--accent-primary)',PVP:'var(--accent-red)' };
const TIMEZONES = ['UTC-8 (PST)','UTC-5 (EST)','UTC+0 (GMT/UTC)','UTC+1 (CET)','UTC+2 (EET)','UTC+3 (MSK)','UTC+5:30 (IST)','UTC+8 (CST)','UTC+9 (JST)','UTC-3 (BRT)'];
const STORAGE_KEY = 'sc_buddies_v1';

function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]; } catch { return []; } }
function save(d) { localStorage.setItem(STORAGE_KEY,JSON.stringify(d)); }

const emptyBuddy = () => ({ id:Date.now(), name:'', rsiHandle:'', roles:[], status:'Offline', timezone:'UTC-3 (BRT)', ships:[], notes:'', crew_rating:3, pvp:false, pve:true, mic:true, discord:'', since: new Date().toISOString() });

function StarRating({ value, onChange }) {
  return (
    <div style={{ display:'flex',gap:3 }}>
      {[1,2,3,4,5].map(i=>(
        <button key={i} onClick={()=>onChange&&onChange(i)} style={{ background:'none',border:'none',cursor:onChange?'pointer':'default',padding:0,fontSize:16,color:i<=value?'var(--accent-gold)':'var(--border-subtle)' }}>★</button>
      ))}
    </div>
  );
}

function BuddyForm({ initial, onSave, onCancel }) {
  const [d,setD] = useState(initial||emptyBuddy());
  const [shipInput,setShipInput] = useState('');
  const set = (k,v) => setD(p=>({...p,[k]:v}));

  function toggleRole(r) { set('roles', d.roles.includes(r)?d.roles.filter(x=>x!==r):[...d.roles,r]); }
  function addShip() { if(!shipInput.trim())return; set('ships',[...(d.ships||[]),shipInput.trim()]); setShipInput(''); }
  function removeShip(i) { set('ships',d.ships.filter((_,j)=>j!==i)); }

  const IS = { width:'100%',padding:'7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none' };
  const SS = { ...IS,padding:'7px 26px 7px 10px',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 7px center' };
  const LS = { fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 };

  return (
    <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:10,padding:'18px',marginBottom:16 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
        <div style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.08em' }}>{d.id&&initial?'EDITAR WINGMAN':'NOVO WINGMAN'}</div>
        <button onClick={onCancel} style={{ background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'4px 7px',fontSize:12 }}>✕</button>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10 }}>
        <div><label style={LS}>Nome / Apelido *</label><input style={IS} value={d.name} onChange={e=>set('name',e.target.value)} placeholder="Apelido no grupo..."/></div>
        <div><label style={LS}>RSI Handle</label><input style={IS} value={d.rsiHandle} onChange={e=>set('rsiHandle',e.target.value)} placeholder="Handle no RSI Community..."/></div>
        <div><label style={LS}>Discord</label><input style={IS} value={d.discord||''} onChange={e=>set('discord',e.target.value)} placeholder="usuário#0000 ou usuario"/></div>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10 }}>
        <div>
          <label style={LS}>Status</label>
          <select style={{ ...SS,width:'100%' }} value={d.status} onChange={e=>set('status',e.target.value)}>
            {STATUS_OPTS.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={LS}>Fuso Horário</label>
          <select style={{ ...SS,width:'100%' }} value={d.timezone} onChange={e=>set('timezone',e.target.value)}>
            {TIMEZONES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom:10 }}>
        <label style={LS}>Roles</label>
        <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
          {ROLES.map(r=>(
            <button key={r} onClick={()=>toggleRole(r)} style={{
              padding:'4px 10px',borderRadius:5,cursor:'pointer',fontSize:11,fontWeight:700,letterSpacing:'0.06em',
              background:d.roles.includes(r)?`${ROLE_COLORS[r]}22`:'rgba(255,255,255,0.04)',
              border:`1px solid ${d.roles.includes(r)?ROLE_COLORS[r]+'55':'var(--border-subtle)'}`,
              color:d.roles.includes(r)?ROLE_COLORS[r]:'var(--text-muted)',
            }}>{r}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:10 }}>
        <label style={LS}>Naves</label>
        <div style={{ display:'flex',gap:8,marginBottom:6 }}>
          <input style={{ ...IS,flex:1 }} value={shipInput} onChange={e=>setShipInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addShip()} placeholder="Nome da nave... (Enter)"/>
          <button onClick={addShip} style={{ padding:'7px 12px',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-normal)',borderRadius:5,color:'var(--accent-primary)',cursor:'pointer',fontSize:12,fontWeight:700 }}><Plus size={13}/></button>
        </div>
        <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
          {(d.ships||[]).map((s,i)=>(
            <span key={i} style={{ display:'flex',alignItems:'center',gap:4,padding:'3px 9px',background:'rgba(0,119,255,0.08)',border:'1px solid rgba(0,119,255,0.2)',borderRadius:10,fontSize:11,color:'var(--accent-secondary)' }}>
              {s}
              <button onClick={()=>removeShip(i)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:0,lineHeight:1 }}>✕</button>
            </span>
          ))}
        </div>
      </div>

      <div style={{ display:'flex',gap:16,alignItems:'center',marginBottom:10 }}>
        <div>
          <label style={LS}>Avaliação</label>
          <StarRating value={d.crew_rating} onChange={v=>set('crew_rating',v)}/>
        </div>
        {[{k:'pvp',l:'PVP'},{k:'pve',l:'PVE'},{k:'mic',l:'Mic'}].map(({k,l})=>(
          <label key={k} style={{ display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13,color:'var(--text-secondary)',fontWeight:600 }}>
            <input type="checkbox" checked={!!d[k]} onChange={e=>set(k,e.target.checked)} style={{ accentColor:'var(--accent-primary)',width:14,height:14 }}/>{l}
          </label>
        ))}
      </div>

      <div style={{ marginBottom:12 }}>
        <label style={LS}>Notas</label>
        <textarea className="notes-textarea" value={d.notes} onChange={e=>set('notes',e.target.value)} placeholder="Disponibilidade, especialidades, equipamento, etc..." style={{ minHeight:50,fontSize:12,marginTop:0 }}/>
      </div>

      <div style={{ display:'flex',justifyContent:'flex-end',gap:8 }}>
        <button onClick={onCancel} style={{ padding:'8px 14px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,textTransform:'uppercase' }}>Cancelar</button>
        <button onClick={()=>{if(!d.name.trim())return;onSave({...d,id:d.id||Date.now()});}} style={{ padding:'8px 18px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',borderRadius:5,color:'var(--accent-green)',cursor:'pointer',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,textTransform:'uppercase' }}>
          Salvar
        </button>
      </div>
    </div>
  );
}

export default function BattleBuddyPage() {
  const [buddies,setBuddies] = useState(load);
  const [showForm,setShowForm] = useState(false);
  const [editBuddy,setEditBuddy] = useState(null);
  const [search,setSearch] = useState('');
  const [filterRole,setFilterRole] = useState('all');
  const [filterStatus,setFilterStatus] = useState('all');
  const [deleteConfirm,setDeleteConfirm] = useState(null);
  const [copied,setCopied] = useState(null);

  function handleSave(b) {
    const upd = editBuddy ? buddies.map(x=>x.id===b.id?b:x) : [b,...buddies];
    setBuddies(upd); save(upd); setShowForm(false); setEditBuddy(null);
  }
  function handleDelete(id) { const upd=buddies.filter(b=>b.id!==id); setBuddies(upd); save(upd); setDeleteConfirm(null); }
  function copyHandle(handle) { navigator.clipboard?.writeText(handle); setCopied(handle); setTimeout(()=>setCopied(null),2000); }

  const filtered = useMemo(()=>buddies.filter(b=>{
    if(search&&!b.name.toLowerCase().includes(search.toLowerCase())&&!b.rsiHandle?.toLowerCase().includes(search.toLowerCase())) return false;
    if(filterRole!=='all'&&!b.roles.includes(filterRole)) return false;
    if(filterStatus!=='all'&&b.status!==filterStatus) return false;
    return true;
  }), [buddies,search,filterRole,filterStatus]);

  const SS = { padding:'7px 26px 7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 7px center' };

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">BATTLE BUDDY</div>
          <div className="page-subtitle">Gerencie sua lista de wingmen e crew — {buddies.length} cadastrado{buddies.length!==1?'s':''}</div>
        </div>
        {!showForm&&!editBuddy&&(
          <button onClick={()=>setShowForm(true)} style={{ display:'flex',alignItems:'center',gap:7,padding:'10px 18px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.35)',borderRadius:8,color:'var(--accent-green)',fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',cursor:'pointer' }}>
            <Plus size={15}/> Novo Wingman
          </button>
        )}
      </div>

      {/* Stats strip */}
      {!showForm&&!editBuddy&&buddies.length>0&&(
        <div style={{ padding:'8px 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',flexShrink:0,display:'flex',gap:10,overflowX:'auto' }}>
          {[{l:'Total',v:buddies.length,c:'var(--accent-primary)'},{l:'Online',v:buddies.filter(b=>b.status==='Online').length,c:'var(--accent-green)'},{l:'Com Mic',v:buddies.filter(b=>b.mic).length,c:'var(--accent-gold)'},{l:'PVP',v:buddies.filter(b=>b.pvp).length,c:'var(--accent-red)'},{l:'PVE',v:buddies.filter(b=>b.pve).length,c:'var(--accent-primary)'}].map(({l,v,c})=>(
            <div key={l} style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:7,padding:'6px 12px',minWidth:80,flexShrink:0,textAlign:'center' }}>
              <div style={{ fontFamily:'Orbitron,monospace',fontSize:15,fontWeight:800,color:c }}>{v}</div>
              <div style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600 }}>{l}</div>
            </div>
          ))}
          {/* Role breakdown */}
          {ROLES.filter(r=>buddies.some(b=>b.roles.includes(r))).map(r=>(
            <div key={r} style={{ background:'var(--bg-card)',border:`1px solid ${ROLE_COLORS[r]}33`,borderRadius:7,padding:'6px 12px',minWidth:80,flexShrink:0,textAlign:'center' }}>
              <div style={{ fontFamily:'Orbitron,monospace',fontSize:15,fontWeight:800,color:ROLE_COLORS[r] }}>{buddies.filter(b=>b.roles.includes(r)).length}</div>
              <div style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600 }}>{r}</div>
            </div>
          ))}
        </div>
      )}

      {(showForm||editBuddy)&&(
        <div style={{ flexShrink:0,overflowY:'auto',maxHeight:'80vh',padding:'14px 32px' }}>
          <BuddyForm initial={editBuddy} onSave={handleSave} onCancel={()=>{setShowForm(false);setEditBuddy(null);}}/>
        </div>
      )}

      {!showForm&&!editBuddy&&(
        <div style={{ padding:'8px 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',flexShrink:0,display:'flex',gap:8,flexWrap:'wrap' }}>
          <input className="search-input" style={{ flex:'1 1 160px',minWidth:140 }} placeholder="Buscar wingman..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <select style={SS} value={filterRole} onChange={e=>setFilterRole(e.target.value)}>
            <option value="all">Todos os Roles</option>
            {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
          <select style={SS} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="all">Todos os Status</option>
            {STATUS_OPTS.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {!showForm&&!editBuddy&&(
        <div className="page-body">
          {filtered.length===0 ? (
            <div className="empty-state">
              <Users size={56} className="empty-state-icon"/>
              <div className="empty-state-title">{buddies.length===0?'NENHUM WINGMAN CADASTRADO':'NENHUM RESULTADO'}</div>
              <div className="empty-state-text">{buddies.length===0?'Adicione seus wingmen, crew e amigos do Star Citizen.':''}</div>
              {buddies.length===0&&<button onClick={()=>setShowForm(true)} style={{ display:'flex',alignItems:'center',gap:7,padding:'10px 20px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.35)',borderRadius:8,color:'var(--accent-green)',fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',textTransform:'uppercase',marginTop:8 }}><Plus size={14}/>Novo Wingman</button>}
            </div>
          ) : (
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12 }}>
              {filtered.map(b=>{
                const statusColor = STATUS_COLORS[b.status]||'var(--text-muted)';
                return (
                  <div key={b.id} style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:10,padding:'14px',transition:'all 0.2s' }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border-normal)'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border-subtle)'}>
                    {/* Header */}
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10 }}>
                      <div>
                        <div style={{ fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:700,color:'var(--text-primary)' }}>{b.name}</div>
                        {b.rsiHandle&&(
                          <div style={{ display:'flex',alignItems:'center',gap:4,marginTop:2 }}>
                            <span style={{ fontSize:11,color:'var(--text-muted)' }}>@{b.rsiHandle}</span>
                            <button onClick={()=>copyHandle(b.rsiHandle)} style={{ background:'none',border:'none',cursor:'pointer',color:copied===b.rsiHandle?'var(--accent-green)':'var(--text-muted)',padding:0 }}>
                              {copied===b.rsiHandle?<Check size={11}/>:<Copy size={11}/>}
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                        <div style={{ width:8,height:8,borderRadius:'50%',background:statusColor,boxShadow:`0 0 6px ${statusColor}` }}/>
                        <span style={{ fontSize:11,color:statusColor,fontWeight:600 }}>{b.status}</span>
                      </div>
                    </div>

                    {/* Roles */}
                    {b.roles?.length>0&&(
                      <div style={{ display:'flex',gap:4,flexWrap:'wrap',marginBottom:8 }}>
                        {b.roles.map(r=>(
                          <span key={r} style={{ fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:`${ROLE_COLORS[r]}18`,border:`1px solid ${ROLE_COLORS[r]}44`,color:ROLE_COLORS[r] }}>{r}</span>
                        ))}
                      </div>
                    )}

                    {/* Ships */}
                    {b.ships?.length>0&&(
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:10,color:'var(--text-muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700 }}>Naves</div>
                        <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
                          {b.ships.map((s,i)=>(
                            <span key={i} style={{ fontSize:10,padding:'2px 7px',borderRadius:8,background:'rgba(0,119,255,0.08)',border:'1px solid rgba(0,119,255,0.2)',color:'var(--accent-secondary)',fontWeight:600 }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Badges & rating */}
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                      <div style={{ display:'flex',gap:6 }}>
                        {b.pvp&&<span style={{ fontSize:10,background:'rgba(255,68,102,0.1)',border:'1px solid rgba(255,68,102,0.25)',borderRadius:3,padding:'1px 6px',color:'var(--accent-red)',fontWeight:700 }}>PVP</span>}
                        {b.pve&&<span style={{ fontSize:10,background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:3,padding:'1px 6px',color:'var(--accent-green)',fontWeight:700 }}>PVE</span>}
                        {b.mic&&<span style={{ fontSize:10,background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-subtle)',borderRadius:3,padding:'1px 6px',color:'var(--accent-primary)',fontWeight:700 }}>🎙️ Mic</span>}
                      </div>
                      <StarRating value={b.crew_rating}/>
                    </div>

                    {b.timezone&&<div style={{ fontSize:10,color:'var(--text-muted)',marginBottom:6 }}>🌍 {b.timezone}</div>}
                    {b.discord&&<div style={{ fontSize:10,color:'var(--text-muted)',marginBottom:6 }}>💬 {b.discord}</div>}
                    {b.notes&&<div style={{ fontSize:11,color:'var(--text-secondary)',borderTop:'1px solid var(--border-subtle)',paddingTop:8,marginTop:4,fontStyle:'italic',lineHeight:1.5 }}>{b.notes}</div>}

                    {/* Actions */}
                    <div style={{ display:'flex',gap:6,marginTop:10,paddingTop:8,borderTop:'1px solid var(--border-subtle)' }}>
                      <button onClick={()=>setEditBuddy(b)} style={{ flex:1,padding:'6px',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-normal)',borderRadius:5,color:'var(--accent-primary)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase' }}>Editar</button>
                      {deleteConfirm===b.id?(
                        <div style={{ display:'flex',gap:4 }}>
                          <button onClick={()=>handleDelete(b.id)} style={{ padding:'6px 10px',background:'rgba(255,68,102,0.15)',border:'1px solid rgba(255,68,102,0.4)',borderRadius:4,color:'var(--accent-red)',cursor:'pointer',fontSize:11,fontWeight:700 }}>Sim</button>
                          <button onClick={()=>setDeleteConfirm(null)} style={{ padding:'6px 10px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-secondary)',cursor:'pointer',fontSize:11 }}>Não</button>
                        </div>
                      ):(
                        <button onClick={()=>setDeleteConfirm(b.id)} style={{ width:30,height:30,background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><Trash2 size={12}/></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
