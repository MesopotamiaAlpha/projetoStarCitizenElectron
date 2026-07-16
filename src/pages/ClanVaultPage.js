import React, { useState, useMemo } from 'react';
import {
  Lock, Plus, Trash2, Search, Package, Users, Gem,
  CheckCircle2, RotateCcw, AlertTriangle, MapPin, Star,
  Minus, History, ChevronDown, ChevronUp
} from 'lucide-react';
import { loadClanVault, addClanVaultEntries, updateClanVaultEntry, removeClanVaultEntry, useClanVaultQuantity, VAULT_UNITS } from '../data/clanVault';

const ORE_LIST = ['Quantainium','Bexalite','Taranite','Laranite','Gold','Diamond','Tungsten','Copper','Titanium','Hephaestanite','Dolivine','Aluminum','Corundum','Borase','Agricium','Inert Material','Outro'];

function ptSCU(v) { return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:3}); }
function fmtData(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'; }

const IS = { width:'100%',padding:'7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:13,outline:'none' };
const SS = { ...IS,padding:'7px 26px 7px 10px',appearance:'none',WebkitAppearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 6px center' };
const LS = { fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 };

// ── Formulário de adição manual ────────────────────────────────────────────────
function AddVaultForm({ knownOwners, onSave, onCancel }) {
  const [owner, setOwner]     = useState('');
  const [ore, setOre]         = useState(ORE_LIST[0]);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit]       = useState('SCU');
  const [quality, setQuality] = useState('');
  const [notes, setNotes]     = useState('');
  const [error, setError]     = useState('');

  function handleSave() {
    if (!owner.trim()) { setError('Informe o dono do minério.'); return; }
    const qty = parseFloat(String(quantity).replace(',','.'));
    if (!qty || qty<=0) { setError('Quantidade deve ser maior que zero.'); return; }
    onSave({ owner:owner.trim(), ore_name:ore, quantity:qty, unit, quality: quality!==''?Number(quality):'', notes:notes.trim() });
  }

  return (
    <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:10,padding:16,marginBottom:14 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
        <span style={{ fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:700,color:'var(--accent-gold)',letterSpacing:'0.06em' }}>ADICIONAR AO COFRE DO CLÃ</span>
        <button onClick={onCancel} style={{ background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'4px 8px' }}>✕</button>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'1.3fr 1fr 0.8fr 0.7fr 0.7fr',gap:10,marginBottom:10 }}>
        <div><label style={LS}>Dono</label>
          <input style={IS} list="vault-owners" value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Nome do jogador"/>
          <datalist id="vault-owners">{knownOwners.map(o=><option key={o} value={o}/>)}</datalist>
        </div>
        <div><label style={LS}>Minério</label>
          <select style={SS} value={ore} onChange={e=>setOre(e.target.value)}>
            {ORE_LIST.map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
        <div><label style={LS}>Quantidade</label>
          <input style={IS} type="number" min="0" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="0"/>
        </div>
        <div><label style={LS}>Unidade</label>
          <select style={SS} value={unit} onChange={e=>setUnit(e.target.value)}>
            {VAULT_UNITS.map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
        <div><label style={LS}>Qualidade</label>
          <input style={IS} type="number" step="0.01" value={quality} onChange={e=>setQuality(e.target.value)} placeholder="ex: 92"/>
        </div>
      </div>
      <input style={{ ...IS,marginBottom:10 }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observações (opcional)..."/>
      {error&&(
        <div style={{ display:'flex',alignItems:'center',gap:7,padding:'8px 12px',background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.25)',borderRadius:6,fontSize:12,color:'var(--accent-red)',marginBottom:10 }}>
          <AlertTriangle size={13}/>{error}
        </div>
      )}
      <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={{ padding:'8px 16px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase' }}>Cancelar</button>
        <button onClick={handleSave} style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 18px',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.35)',borderRadius:6,color:'var(--accent-gold)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase' }}>
          <Plus size={13}/> Adicionar
        </button>
      </div>
    </div>
  );
}

// ── Card de entrada ─────────────────────────────────────────────────────────────
function VaultEntryCard({ entry, onToggleStatus, onDelete, onUseQuantity }) {
  const [delConf, setDelConf]     = useState(false);
  const [showUse, setShowUse]     = useState(false);
  const [showHist, setShowHist]   = useState(false);
  const [useAmount, setUseAmount] = useState('');
  const [usedBy, setUsedBy]       = useState('');
  const [useNotes, setUseNotes]   = useState('');
  const [useError, setUseError]   = useState('');
  const delivered = entry.status === 'Entregue';
  const history = entry.usage_history || [];
  const unit = entry.unit || 'SCU';

  function handleConfirmUse() {
    const amt = parseFloat(String(useAmount).replace(',','.'));
    if (!amt || amt<=0) { setUseError('Informe uma quantidade válida.'); return; }
    if (amt > Number(entry.quantity)) { setUseError(`Só há ${ptSCU(entry.quantity)} ${unit} disponível.`); return; }
    onUseQuantity(entry, { amount:amt, used_by:usedBy, notes:useNotes });
    setUseAmount(''); setUsedBy(''); setUseNotes(''); setUseError(''); setShowUse(false);
  }

  return (
    <div style={{ background:'var(--bg-card)',border:`1px solid ${delivered?'rgba(52,211,153,0.25)':'rgba(251,191,36,0.25)'}`,borderLeft:`3px solid ${delivered?'var(--accent-green)':'var(--accent-gold)'}`,borderRadius:8,padding:'11px 14px',marginBottom:7 }}>
      <div style={{ display:'flex',alignItems:'center',gap:12 }}>
        <div style={{ width:34,height:34,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:delivered?'rgba(52,211,153,0.1)':'rgba(251,191,36,0.1)',border:`1px solid ${delivered?'rgba(52,211,153,0.3)':'rgba(251,191,36,0.3)'}` }}>
          <Gem size={15} style={{ color:delivered?'var(--accent-green)':'var(--accent-gold)' }}/>
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:2 }}>
            <span style={{ fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{entry.owner}</span>
            <span style={{ fontSize:11,color:'var(--text-muted)' }}>·</span>
            <span style={{ fontSize:13,fontWeight:700,color:'var(--accent-gold)' }}>{entry.ore_name}</span>
            {entry.quality!==''&&entry.quality!=null&&<span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:'rgba(255,200,0,0.1)',color:'var(--accent-gold)',border:'1px solid rgba(255,200,0,0.25)',fontWeight:700 }}>★ {entry.quality}</span>}
            <span style={{ fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:3,background:delivered?'rgba(52,211,153,0.12)':'rgba(251,191,36,0.12)',color:delivered?'var(--accent-green)':'var(--accent-gold)',border:`1px solid ${delivered?'rgba(52,211,153,0.3)':'rgba(251,191,36,0.3)'}` }}>{entry.status}</span>
          </div>
          <div style={{ display:'flex',gap:10,fontSize:10,color:'var(--text-muted)',flexWrap:'wrap' }}>
            {entry.session_name&&<span>📋 {entry.session_name}</span>}
            <span style={{ fontFamily:'Share Tech Mono,monospace' }}>{fmtData(entry.date_added)}</span>
            {entry.notes&&<span style={{ fontStyle:'italic' }}>{entry.notes}</span>}
          </div>
        </div>
        <div style={{ textAlign:'right',flexShrink:0 }}>
          <div style={{ fontFamily:'Michroma,sans-serif',fontSize:16,fontWeight:800,color:delivered?'var(--accent-green)':'var(--accent-gold)' }}>{ptSCU(entry.quantity)}</div>
          <div style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase' }}>{unit}</div>
        </div>
        <div style={{ display:'flex',gap:5,flexShrink:0 }}>
          <button onClick={()=>{ setShowUse(v=>!v); setShowHist(false); }} title="Registrar uso (reduzir quantidade)"
            style={{ display:'flex',alignItems:'center',gap:5,padding:'6px 10px',background:showUse?'rgba(56,189,248,0.15)':'rgba(56,189,248,0.08)',border:'1px solid rgba(56,189,248,0.3)',borderRadius:5,color:'var(--accent-primary)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'"Exo 2",sans-serif',textTransform:'uppercase',whiteSpace:'nowrap' }}>
            <Minus size={12}/> Usar
          </button>
          {history.length>0&&(
            <button onClick={()=>{ setShowHist(v=>!v); setShowUse(false); }} title="Ver histórico de uso"
              style={{ display:'flex',alignItems:'center',gap:5,padding:'6px 8px',background:showHist?'rgba(162,155,254,0.15)':'transparent',border:'1px solid rgba(162,155,254,0.3)',borderRadius:5,color:'#a29bfe',cursor:'pointer',fontSize:11,fontWeight:700 }}>
              <History size={12}/> {history.length}{showHist?<ChevronUp size={11}/>:<ChevronDown size={11}/>}
            </button>
          )}
          <button onClick={()=>onToggleStatus(entry)} title={delivered?'Marcar como ainda no cofre':'Marcar como entregue'}
            style={{ display:'flex',alignItems:'center',gap:5,padding:'6px 10px',background:delivered?'rgba(251,191,36,0.08)':'rgba(52,211,153,0.1)',border:`1px solid ${delivered?'rgba(251,191,36,0.3)':'rgba(52,211,153,0.3)'}`,borderRadius:5,color:delivered?'var(--accent-gold)':'var(--accent-green)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'"Exo 2",sans-serif',textTransform:'uppercase',whiteSpace:'nowrap' }}>
            {delivered?<><RotateCcw size={12}/> Reverter</>:<><CheckCircle2 size={12}/> Entregar</>}
          </button>
          {delConf?(
            <div style={{ display:'flex',gap:4,alignItems:'center' }}>
              <button onClick={()=>onDelete(entry.id)} style={{ padding:'3px 7px',background:'rgba(251,113,133,0.15)',border:'1px solid rgba(251,113,133,0.4)',borderRadius:4,color:'var(--accent-red)',cursor:'pointer',fontSize:11,fontWeight:700 }}>Sim</button>
              <button onClick={()=>setDelConf(false)} style={{ padding:'3px 7px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-secondary)',cursor:'pointer',fontSize:11 }}>Não</button>
            </div>
          ):(
            <button onClick={()=>setDelConf(true)} style={{ width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.2)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer' }}><Trash2 size={12}/></button>
          )}
        </div>
      </div>

      {/* Formulário de uso / redução */}
      {showUse&&(
        <div style={{ marginTop:10,paddingTop:10,borderTop:'1px solid var(--border-subtle)',display:'grid',gridTemplateColumns:'1fr 1.3fr 1.3fr auto',gap:8,alignItems:'end' }}>
          <div><label style={LS}>Quantidade Usada ({unit})</label>
            <input style={IS} type="number" min="0" max={entry.quantity} step="0.001" value={useAmount} onChange={e=>setUseAmount(e.target.value)} placeholder="0"/>
          </div>
          <div><label style={LS}>Quem Usou</label>
            <input style={IS} value={usedBy} onChange={e=>setUsedBy(e.target.value)} placeholder="Nome do jogador"/>
          </div>
          <div><label style={LS}>Observação</label>
            <input style={IS} value={useNotes} onChange={e=>setUseNotes(e.target.value)} placeholder="Opcional..."/>
          </div>
          <button onClick={handleConfirmUse} style={{ padding:'7px 14px',background:'rgba(56,189,248,0.12)',border:'1px solid rgba(56,189,248,0.4)',borderRadius:6,color:'var(--accent-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:11,fontWeight:700,cursor:'pointer',textTransform:'uppercase',whiteSpace:'nowrap' }}>Confirmar</button>
          {useError&&(
            <div style={{ gridColumn:'1 / -1',display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--accent-red)' }}>
              <AlertTriangle size={12}/>{useError}
            </div>
          )}
        </div>
      )}

      {/* Histórico de uso */}
      {showHist&&history.length>0&&(
        <div style={{ marginTop:10,paddingTop:10,borderTop:'1px solid var(--border-subtle)' }}>
          <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Histórico de Uso</div>
          {history.map(h=>(
            <div key={h.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11,padding:'5px 0',borderBottom:'1px solid var(--border-subtle)' }}>
              <span style={{ color:'var(--text-secondary)' }}>
                <strong style={{ color:'var(--accent-primary)' }}>{h.used_by}</strong> usou {ptSCU(h.amount)} {unit}{h.notes?` — ${h.notes}`:''}
              </span>
              <span style={{ fontFamily:'Share Tech Mono,monospace',color:'var(--text-muted)',flexShrink:0 }}>{fmtData(h.date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ClanVaultPage() {
  const [entries, setEntries]   = useState(loadClanVault);
  const [showAdd, setShowAdd]   = useState(false);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter]   = useState('all');

  function refresh() { setEntries(loadClanVault()); }

  function handleAdd(data) {
    addClanVaultEntries([data]);
    refresh();
    setShowAdd(false);
  }
  function handleToggleStatus(entry) {
    updateClanVaultEntry(entry.id, { status: entry.status==='Entregue' ? 'No Cofre' : 'Entregue', delivered_at: entry.status==='Entregue' ? null : new Date().toISOString() });
    refresh();
  }
  function handleDelete(id) { removeClanVaultEntry(id); refresh(); }
  function handleUseQuantity(entry, data) { useClanVaultQuantity(entry.id, data); refresh(); }

  const owners = useMemo(() => [...new Set(entries.map(e=>e.owner).filter(Boolean))].sort(), [entries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (statusFilter!=='all') list = list.filter(e=>e.status===statusFilter);
    if (ownerFilter!=='all')  list = list.filter(e=>e.owner===ownerFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.owner?.toLowerCase().includes(q) || e.ore_name?.toLowerCase().includes(q) || e.session_name?.toLowerCase().includes(q));
    }
    return [...list].sort((a,b)=>new Date(b.date_added||0)-new Date(a.date_added||0));
  }, [entries, search, statusFilter, ownerFilter]);

  // Resumo por dono (apenas o que ainda está no cofre) — agrupado por minério + unidade
  const summary = useMemo(() => {
    const map = {};
    entries.filter(e=>e.status==='No Cofre').forEach(e => {
      if (!map[e.owner]) map[e.owner] = { owner:e.owner, count:0, items:{} };
      map[e.owner].count += 1;
      const key = `${e.ore_name} (${e.unit||'SCU'})`;
      map[e.owner].items[key] = (map[e.owner].items[key]||0) + (Number(e.quantity)||0);
    });
    return Object.values(map).sort((a,b)=>b.count-a.count);
  }, [entries]);

  const totalNoCofre = entries.filter(e=>e.status==='No Cofre').length;
  const totalEntregue = entries.filter(e=>e.status==='Entregue').length;

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display:'flex',alignItems:'center',gap:10 }}>
            <Lock size={20} style={{ color:'var(--accent-gold)' }}/> COFRE DO CLÃ
          </div>
          <div className="page-subtitle">{totalNoCofre} guardado{totalNoCofre!==1?'s':''} · {totalEntregue} entregue{totalEntregue!==1?'s':''} · {owners.length} participante{owners.length!==1?'s':''}</div>
        </div>
        {!showAdd&&(
          <button onClick={()=>setShowAdd(true)} style={{ display:'flex',alignItems:'center',gap:7,padding:'9px 16px',background:'rgba(255,200,0,0.1)',border:'1px solid rgba(255,200,0,0.35)',borderRadius:7,color:'var(--accent-gold)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,textTransform:'uppercase',cursor:'pointer' }}>
            <Plus size={14}/> Adicionar ao Cofre
          </button>
        )}
      </div>

      <div style={{ flex:1,display:'grid',gridTemplateColumns:'230px 1fr',overflow:'hidden' }}>
        {/* Painel esquerdo: resumo por participante */}
        <div style={{ borderRight:'1px solid var(--border-subtle)',overflowY:'auto',padding:12 }}>
          <div style={{ fontFamily:'Michroma,sans-serif',fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>
            <Users size={11}/> No Cofre por Jogador
          </div>
          {summary.length===0?(
            <div style={{ fontSize:11,color:'var(--text-muted)',textAlign:'center',padding:'20px 0' }}>Nada guardado no momento</div>
          ):(
            summary.map(s=>(
              <button key={s.owner} onClick={()=>setOwnerFilter(s.owner)} style={{ width:'100%',textAlign:'left',display:'block',padding:'8px 10px',marginBottom:5,background:ownerFilter===s.owner?'rgba(251,191,36,0.12)':'var(--bg-card)',border:`1px solid ${ownerFilter===s.owner?'rgba(251,191,36,0.35)':'var(--border-subtle)'}`,borderRadius:7,cursor:'pointer' }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3 }}>
                  <span style={{ fontSize:12,fontWeight:700,color:'var(--accent-gold)' }}>{s.owner}</span>
                  <span style={{ fontSize:10,color:'var(--text-muted)' }}>{s.count} item{s.count!==1?'s':''}</span>
                </div>
                {Object.entries(s.items).map(([ore,qty])=>(
                  <div key={ore} style={{ fontSize:10,color:'var(--text-secondary)',display:'flex',justifyContent:'space-between' }}>
                    <span>{ore}</span><span style={{ fontFamily:'Share Tech Mono,monospace' }}>{ptSCU(qty)}</span>
                  </div>
                ))}
              </button>
            ))
          )}
          {ownerFilter!=='all'&&(
            <button onClick={()=>setOwnerFilter('all')} style={{ width:'100%',marginTop:6,padding:'6px 0',background:'transparent',border:'1px dashed var(--border-normal)',borderRadius:6,color:'var(--text-muted)',fontSize:11,cursor:'pointer' }}>Limpar filtro</button>
          )}
        </div>

        {/* Painel direito: lista de entradas */}
        <div style={{ overflowY:'auto',padding:'12px 16px' }}>
          {showAdd&&<AddVaultForm knownOwners={owners} onSave={handleAdd} onCancel={()=>setShowAdd(false)}/>}

          <div style={{ display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center' }}>
            <div style={{ position:'relative',flex:'1 1 180px' }}>
              <Search size={12} style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }}/>
              <input style={{ ...IS,paddingLeft:28 }} placeholder="Buscar dono, minério, sessão..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select style={SS} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="all">Todos Status</option>
              <option value="No Cofre">No Cofre</option>
              <option value="Entregue">Entregue</option>
            </select>
            {owners.length>0&&(
              <select style={SS} value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)}>
                <option value="all">Todos Participantes</option>
                {owners.map(o=><option key={o}>{o}</option>)}
              </select>
            )}
            <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-muted)' }}>{filtered.length} entrada{filtered.length!==1?'s':''}</span>
          </div>

          {filtered.length===0?(
            <div style={{ textAlign:'center',padding:'50px 0',color:'var(--text-muted)' }}>
              <Lock size={44} style={{ display:'block',margin:'0 auto 12px',opacity:0.15 }}/>
              <div style={{ fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:700,marginBottom:6 }}>COFRE VAZIO</div>
              <div style={{ fontSize:11 }}>
                {entries.length===0
                  ? 'Marque "Enviar ao Cofre do Clã" ao finalizar uma sessão de mineração, ou adicione manualmente.'
                  : 'Nenhum resultado para os filtros atuais.'}
              </div>
            </div>
          ):(
            filtered.map(e=><VaultEntryCard key={e.id} entry={e} onToggleStatus={handleToggleStatus} onDelete={handleDelete} onUseQuantity={handleUseQuantity}/>)
          )}
        </div>
      </div>
    </div>
  );
}