import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, Edit3, Save, X, Search, CheckCircle2,
  Star, Package, ChevronDown, ChevronUp, AlertTriangle,
  Minus, RefreshCw, Archive, Lightbulb, ScanLine, Truck
} from 'lucide-react';
import { searchUexItems } from '../data/uexItemsDB';
import { calcWikeloFavors } from '../data/wikelo';
import { INVENTORY_UPDATED_EVENT, publishInventoryUpdate } from '../data/inventoryEvents';
import {
  applyWikeloDeliveryPlan,
  buildWikeloDeliveryPlan,
  getInventoryItemQuantity,
  getWikeloMissionProgress,
  scanWikeloItem,
} from '../data/wikeloInventory';

// ── Storage ───────────────────────────────────────────────────────────────────
const MISSIONS_KEY = 'sc_wikelo_missions_v1';
const INV_KEY      = 'sc_inventory_v1';

function loadMissions() {
  try { return JSON.parse(localStorage.getItem(MISSIONS_KEY)) || []; } catch { return []; }
}
function saveMissions(d) { localStorage.setItem(MISSIONS_KEY, JSON.stringify(d)); }

function loadInventory() {
  try {
    const inv = JSON.parse(localStorage.getItem(INV_KEY) || '{"itens":[]}');
    return inv.itens || [];
  } catch { return []; }
}

async function fetchInventoryItems() {
  try {
    if (window.electronAPI?.inventoryGetAll) {
      const items = await window.electronAPI.inventoryGetAll();
      return items || [];
    }
  } catch { /* usa o fallback local abaixo */ }
  return loadInventory();
}

// Buscar quantidade de item no inventário pelo nome exato
function getInventoryQty(name, items = []) {
  return getInventoryItemQuantity(name, items);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ptDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function localISOString() {
  const d = new Date();
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ── Modal de confirmação de inventário ────────────────────────────────────────
function InventoryModal({ itemName, invQty, neededQty, onUseInventory, onSkip }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <div style={{ background:'var(--bg-card)', border:'1px solid rgba(255,200,0,0.4)', borderRadius:12, padding:22, width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <Archive size={16} style={{ color:'var(--accent-gold)' }}/>
          <span style={{ fontFamily:'Michroma,sans-serif', fontSize:12, fontWeight:700, color:'var(--accent-gold)', letterSpacing:'0.06em' }}>ITEM ENCONTRADO NO INVENTÁRIO</span>
        </div>
        <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:16, lineHeight:1.7 }}>
          Você tem <strong style={{ color:'var(--text-primary)' }}>{invQty}</strong> unidade{invQty!==1?'s':''} de <strong style={{ color:'var(--accent-gold)' }}>{itemName}</strong> no seu inventário.<br/>
          Deseja considerar este estoque no acompanhamento desta missão?
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          <div style={{ padding:'10px', background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:7, textAlign:'center' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--accent-green)', textTransform:'uppercase', marginBottom:4 }}>Usar do Inventário</div>
            <div style={{ fontFamily:'Share Tech Mono,monospace', fontSize:13, color:'var(--text-primary)' }}>
              {invQty} disponível → considera como coletado
            </div>
          </div>
          <div style={{ padding:'10px', background:'rgba(56,189,248,0.06)', border:'1px solid rgba(56,189,248,0.2)', borderRadius:7, textAlign:'center' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--accent-primary)', textTransform:'uppercase', marginBottom:4 }}>Não Considerar</div>
            <div style={{ fontFamily:'Share Tech Mono,monospace', fontSize:13, color:'var(--text-primary)' }}>
              Começa do zero (0/{neededQty})
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onSkip} style={{ padding:'7px 16px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:6, color:'var(--text-secondary)', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>
            Não Considerar
          </button>
          <button onClick={onUseInventory} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 16px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:6, color:'var(--accent-green)', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>
            <CheckCircle2 size={11}/> Usar do Inventário
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Formulário de item da missão ──────────────────────────────────────────────
function ItemForm({ initial, onSave, onCancel, onInventoryCheck, inventoryItems = [] }) {
  const [name,     setName]     = useState(initial?.name || '');
  const [needed,   setNeeded]   = useState(String(initial?.needed || 1));
  const [unit,     setUnit]     = useState(initial?.unit || 'un');
  const [notes,    setNotes]    = useState(initial?.notes || '');
  const [suggs,    setSuggs]    = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [error,    setError]    = useState('');

  const IS = { width:'100%', padding:'7px 10px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none' };
  const SS = { ...IS, appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 7px center', paddingRight:26 };
  const LS = { fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:3 };

  function handleNameChange(val) {
    setName(val);
    if (val.trim().length >= 2) {
      const s = searchUexItems(val, 7);
      setSuggs(s);
      setShowSugg(s.length > 0);
    } else {
      setSuggs([]); setShowSugg(false);
    }
  }

  function handleSelectSugg(item) {
    setName(item.name);
    setSuggs([]); setShowSugg(false);
    // Verificar inventário
    const invQty = getInventoryQty(item.name, inventoryItems);
    if (invQty > 0) {
      onInventoryCheck(item.name, invQty, parseInt(needed)||1, (useInv) => {
        onSave({ name:item.name, needed:parseInt(needed)||1, collected:useInv?Math.min(invQty,parseInt(needed)||1):0, unit, notes, from_inventory:useInv?Math.min(invQty,parseInt(needed)||1):0 });
      });
    }
  }

  function handleSave() {
    if (!name.trim()) { setError('Nome obrigatório.'); return; }
    const n = parseInt(needed)||1;
    if (n <= 0) { setError('Quantidade deve ser ≥ 1.'); return; }
    onSave({ ...initial, name:name.trim(), needed:n, collected:initial?.collected||0, unit, notes, from_inventory:initial?.from_inventory||0 });
  }

  return (
    <div style={{ padding:'10px 12px', background:'rgba(56,189,248,0.04)', border:'1px solid rgba(56,189,248,0.2)', borderRadius:8, marginBottom:8 }}>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 80px 70px 1fr', gap:7, marginBottom:7, alignItems:'end' }}>
        {/* Nome com autocomplete */}
        <div style={{ position:'relative' }}>
          <label style={LS}>Item *</label>
          <input style={IS} value={name} onChange={e=>handleNameChange(e.target.value)}
            onBlur={()=>setTimeout(()=>setShowSugg(false),180)}
            onFocus={()=>name.trim().length>=2&&suggs.length>0&&setShowSugg(true)}
            placeholder="Nome do item..."/>
          {showSugg && suggs.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg-card)', border:'1px solid var(--accent-primary)', borderTop:'none', borderRadius:'0 0 6px 6px', zIndex:100, maxHeight:180, overflowY:'auto', boxShadow:'0 8px 20px rgba(0,0,0,0.5)' }}>
              <div style={{ padding:'3px 9px', fontSize:8, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', background:'var(--bg-panel)', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:4 }}>
                <Lightbulb size={9}/> Sugestões UEX
              </div>
              {suggs.map(s => (
                <button key={s.id} onMouseDown={()=>handleSelectSugg(s)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'6px 10px', background:'none', border:'none', borderBottom:'1px solid var(--border-subtle)', color:'var(--text-secondary)', cursor:'pointer', fontSize:11, textAlign:'left' }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(56,189,248,0.07)'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}>
                  <span style={{ fontWeight:700, color:'var(--text-primary)' }}>{s.name}</span>
                  <span style={{ fontSize:10, color:'var(--text-muted)' }}>{s.category||''} {s.size?`S${s.size}`:''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label style={LS}>Necessário</label>
          <input style={IS} type="number" min="1" value={needed} onChange={e=>setNeeded(e.target.value)}/>
        </div>
        <div>
          <label style={LS}>Unidade</label>
          <select style={SS} value={unit} onChange={e=>setUnit(e.target.value)}>
            {['un','SCU','cSCU','kg'].map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label style={LS}>Observações</label>
          <input style={IS} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Onde dropar, dica..."/>
        </div>
      </div>
      {error && <div style={{ fontSize:10, color:'var(--accent-red)', marginBottom:6 }}>{error}</div>}
      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={{ padding:'5px 12px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-secondary)', fontFamily:'"Exo 2",sans-serif', fontSize:10, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>Cancelar</button>
        <button onClick={handleSave} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 12px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:5, color:'var(--accent-green)', fontFamily:'"Exo 2",sans-serif', fontSize:10, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>
          <Save size={10}/> {initial ? 'Salvar' : 'Adicionar'}
        </button>
      </div>
    </div>
  );
}

// ── Card de item dentro da missão ─────────────────────────────────────────────
function MissionItemRow({ item, missionId, onUpdate, onDelete, onScan, inventoryItems }) {
  const [editMode, setEditMode] = useState(false);
  const [delConf,  setDelConf]  = useState(false);
  const [adjVal,   setAdjVal]   = useState('');
  const [adjMode,  setAdjMode]  = useState('add');

  const qty      = item.collected || 0;
  const needed   = item.needed || 1;
  const isDone   = qty >= needed;
  const pct      = Math.min(100, Math.round((qty / needed) * 100));
  const fromInv  = item.from_inventory || 0;
  const scannedAvailable = Math.max(0, Number(item.inventory_available) || 0);

  function applyAdj() {
    const n = parseFloat(adjVal) || 0;
    if (n <= 0) return;
    const newQty = adjMode === 'add'
      ? Math.min(needed, qty + n)
      : Math.max(0, qty - n);
    onUpdate(missionId, { ...item, collected: newQty });
    setAdjVal('');
  }

  if (editMode) return (
    <ItemForm
      initial={item}
      inventoryItems={inventoryItems}
      onInventoryCheck={(name, invQty, neededQty, cb) => cb(false)}
      onSave={updated => { onUpdate(missionId, updated); setEditMode(false); }}
      onCancel={() => setEditMode(false)}
    />
  );

  return (
    <div style={{
      padding:'8px 12px', borderRadius:7,
      background: isDone ? 'rgba(52,211,153,0.05)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${isDone ? 'rgba(52,211,153,0.25)' : 'var(--border-subtle)'}`,
      marginBottom:5,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: isDone ? 0 : 5 }}>
        {/* Status icon */}
        {isDone
          ? <CheckCircle2 size={14} style={{ color:'var(--accent-green)', flexShrink:0 }}/>
          : <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid var(--border-normal)', flexShrink:0 }}/>
        }
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:700, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
              {item.name}
            </span>
            {fromInv > 0 && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(52,211,153,0.1)', color:'var(--accent-green)', border:'1px solid rgba(52,211,153,0.2)', fontWeight:700 }}>📦 {fromInv} do inv.</span>}
            {item.notes && <span style={{ fontSize:10, color:'var(--text-muted)', fontStyle:'italic' }}>{item.notes}</span>}
          </div>
          {!isDone && (
            <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:4 }}>
              <div style={{ flex:1, height:4, background:'rgba(255,255,255,0.07)', borderRadius:2, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:'var(--accent-primary)', borderRadius:2, transition:'width 0.3s' }}/>
              </div>
              <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:10, color:'var(--text-muted)', flexShrink:0 }}>{qty}/{needed} {item.unit}</span>
            </div>
          )}
        </div>
        {/* Quantidade */}
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <span style={{ fontFamily:'Michroma,sans-serif', fontSize:14, fontWeight:800, color: isDone ? 'var(--accent-green)' : 'var(--accent-primary)' }}>{qty}</span>
          <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:10, color:'var(--text-muted)' }}>/{needed} {item.unit}</span>
        </div>
        {/* Ações */}
                <div style={{ display:'flex', gap:4, flexShrink:0 }}>
          <button onClick={()=>onScan?.(missionId, item)} title="Consultar este item no Inventário sem remover quantidade" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:4, minHeight:26, padding:'0 7px', borderRadius:4, border:'1px solid rgba(251,191,36,0.28)', background:'rgba(251,191,36,0.07)', color:'var(--accent-gold)', cursor:'pointer', fontSize:9, fontWeight:800, textTransform:'uppercase', whiteSpace:'nowrap' }}>
            <ScanLine size={11}/> Escanear seus itens
          </button>
          <button onClick={()=>setEditMode(true)}
 style={{ width:24, height:24, borderRadius:4, border:'1px solid var(--border-normal)', background:'rgba(56,189,248,0.06)', color:'var(--accent-primary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Edit3 size={10}/>
          </button>
          {delConf ? (
            <>
              <button onClick={()=>{onDelete(missionId, item.id);setDelConf(false);}} style={{ padding:'2px 6px', background:'rgba(251,113,133,0.15)', border:'1px solid rgba(251,113,133,0.4)', borderRadius:3, color:'var(--accent-red)', cursor:'pointer', fontSize:10, fontWeight:700 }}>Sim</button>
              <button onClick={()=>setDelConf(false)} style={{ padding:'2px 6px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:3, color:'var(--text-secondary)', cursor:'pointer', fontSize:10 }}>Não</button>
            </>
          ) : (
            <button onClick={()=>setDelConf(true)} style={{ width:24, height:24, borderRadius:4, border:'1px solid rgba(251,113,133,0.2)', background:'rgba(251,113,133,0.06)', color:'var(--accent-red)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Trash2 size={10}/>
            </button>
          )}
        </div>
      </div>

      {/* Controles de +/- coleta */}
      {!isDone && (
        <div style={{ display:'flex', alignItems:'center', gap:7, paddingLeft:24 }}>
          <div style={{ display:'flex', borderRadius:4, overflow:'hidden', border:'1px solid var(--border-subtle)' }}>
            <button onClick={()=>setAdjMode('add')} style={{ padding:'3px 8px', background:adjMode==='add'?'rgba(52,211,153,0.15)':'transparent', border:'none', borderRight:'1px solid var(--border-subtle)', color:adjMode==='add'?'var(--accent-green)':'var(--text-muted)', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'"Exo 2",sans-serif' }}>+ Coletei</button>
            <button onClick={()=>setAdjMode('sub')} style={{ padding:'3px 8px', background:adjMode==='sub'?'rgba(251,113,133,0.12)':'transparent', border:'none', color:adjMode==='sub'?'var(--accent-red)':'var(--text-muted)', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'"Exo 2",sans-serif' }}>− Remover</button>
          </div>
          {[1,5,10].map(n=>(
            <button key={n} onClick={()=>{
              const newQty = adjMode==='add' ? Math.min(needed,qty+n) : Math.max(0,qty-n);
              onUpdate(missionId, {...item, collected:newQty});
            }} style={{ padding:'3px 8px', background:adjMode==='add'?'rgba(52,211,153,0.07)':'rgba(251,113,133,0.07)', border:`1px solid ${adjMode==='add'?'rgba(52,211,153,0.2)':'rgba(251,113,133,0.2)'}`, borderRadius:4, color:adjMode==='add'?'var(--accent-green)':'var(--accent-red)', cursor:'pointer', fontSize:10, fontFamily:'Share Tech Mono,monospace' }}>
              {adjMode==='add'?'+':'-'}{n}
            </button>
          ))}
          <input type="number" min="1" value={adjVal} onChange={e=>setAdjVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&applyAdj()}
            placeholder="outro" style={{ width:60, padding:'3px 7px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:4, color:'var(--text-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:10, outline:'none', textAlign:'center' }}/>
          <button onClick={applyAdj} style={{ padding:'3px 8px', background:adjMode==='add'?'rgba(52,211,153,0.1)':'rgba(251,113,133,0.1)', border:`1px solid ${adjMode==='add'?'rgba(52,211,153,0.3)':'rgba(251,113,133,0.3)'}`, borderRadius:4, color:adjMode==='add'?'var(--accent-green)':'var(--accent-red)', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'"Exo 2",sans-serif', textTransform:'uppercase' }}>OK</button>
        </div>
      )}
      {isDone && <div style={{ paddingLeft:24, fontSize:10, color:'var(--accent-green)', fontWeight:700 }}>✓ Item completo!</div>}
      {item.inventory_scanned_at && <div style={{ paddingLeft:24, marginTop:3, fontSize:9, color: scannedAvailable >= needed ? 'var(--accent-green)' : 'var(--text-muted)' }}>Escaneado: {scannedAvailable} disponível no Inventário · {new Date(item.inventory_scanned_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}</div>}
    </div>
  );
}

// ── Card de missão ────────────────────────────────────────────────────────────
function MissionCard({ mission, onUpdateItem, onDeleteItem, onAddItem, onDelete, onEditTitle, onScanItem, onDeliverMission, inventoryItems }) {
  const [expanded,   setExpanded]   = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [editTitle,  setEditTitle]  = useState(false);
  const [titleVal,   setTitleVal]   = useState(mission.title);
  const [delConf,    setDelConf]    = useState(false);
  const [invModal,   setInvModal]   = useState(null);

  const items      = mission.items || [];
  const progress   = getWikeloMissionProgress(mission);
  const doneItems  = progress.completed;
  const total      = progress.total;
  const isComplete = progress.complete;
  const pct        = progress.percent;
  const delivered  = mission.wikelo_delivery_status === 'delivered' || Boolean(mission.wikelo_delivered_at);

  function handleInventoryCheck(name, invQty, neededQty, cb) {
    setInvModal({ name, invQty, neededQty, cb });
  }

  function handleAddItem(newItem) {
    onAddItem(mission.id, { ...newItem, id: Date.now() });
    setShowForm(false);
  }

  return (
    <div style={{
      background: isComplete ? 'rgba(52,211,153,0.05)' : 'var(--bg-card)',
      border: `1px solid ${isComplete ? 'rgba(52,211,153,0.35)' : 'var(--border-subtle)'}`,
      borderRadius:10, overflow:'hidden', marginBottom:10, transition:'all 0.2s',
    }}>
      {invModal && (
        <InventoryModal
          itemName={invModal.name} invQty={invModal.invQty} neededQty={invModal.neededQty}
          onUseInventory={()=>{ invModal.cb(true); setInvModal(null); }}
          onSkip={()=>{ invModal.cb(false); setInvModal(null); }}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', cursor:'pointer' }} onClick={()=>setExpanded(!expanded)}>
        {isComplete
          ? <CheckCircle2 size={18} style={{ color:'var(--accent-green)', flexShrink:0 }}/>
          : <Star size={16} style={{ color:'var(--accent-gold)', flexShrink:0 }}/>
        }
        <div style={{ flex:1, minWidth:0 }}>
          {editTitle ? (
            <div style={{ display:'flex', gap:6 }} onClick={e=>e.stopPropagation()}>
              <input style={{ flex:1, padding:'4px 8px', background:'var(--bg-base)', border:'1px solid var(--accent-primary)', borderRadius:4, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:13, outline:'none' }}
                value={titleVal} onChange={e=>setTitleVal(e.target.value)} autoFocus
                onKeyDown={e=>{ if(e.key==='Enter'){ onEditTitle(mission.id,titleVal); setEditTitle(false); } }}/>
              <button onClick={()=>{ onEditTitle(mission.id,titleVal); setEditTitle(false); }} style={{ padding:'3px 8px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:4, color:'var(--accent-green)', cursor:'pointer', fontSize:10, fontWeight:700 }}>✓</button>
              <button onClick={()=>setEditTitle(false)} style={{ padding:'3px 8px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:4, color:'var(--text-muted)', cursor:'pointer', fontSize:10 }}><X size={10}/></button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontFamily:'"Exo 2",sans-serif', fontSize:14, fontWeight:700, color: isComplete ? 'var(--accent-green)' : 'var(--text-primary)' }}>{mission.title}</span>
              {isComplete && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:3, background:'rgba(52,211,153,0.15)', color:'var(--accent-green)', border:'1px solid rgba(52,211,153,0.35)', fontWeight:700 }}>✓ COMPLETA</span>}
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:3 }}>
            <div style={{ flex:1, maxWidth:200, height:4, background:'rgba(255,255,255,0.07)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, background: isComplete ? 'var(--accent-green)' : 'var(--accent-primary)', borderRadius:2, transition:'width 0.4s' }}/>
            </div>
            <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'Share Tech Mono,monospace' }}>{doneItems}/{total} itens · {pct}%</span>
            <span style={{ fontSize:10, color:'var(--text-muted)' }}>{ptDateTime(mission.created_at)}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:5, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setEditTitle(true)} style={{ width:26, height:26, borderRadius:4, border:'1px solid var(--border-normal)', background:'rgba(56,189,248,0.06)', color:'var(--accent-primary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Edit3 size={10}/>
          </button>
          {delConf ? (
            <>
              <button onClick={()=>onDelete(mission.id)} style={{ padding:'3px 7px', background:'rgba(251,113,133,0.15)', border:'1px solid rgba(251,113,133,0.4)', borderRadius:3, color:'var(--accent-red)', cursor:'pointer', fontSize:10, fontWeight:700 }}>Sim</button>
              <button onClick={()=>setDelConf(false)} style={{ padding:'3px 7px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:3, color:'var(--text-secondary)', cursor:'pointer', fontSize:10 }}>Não</button>
            </>
          ) : (
            <button onClick={()=>setDelConf(true)} style={{ width:26, height:26, borderRadius:4, border:'1px solid rgba(251,113,133,0.2)', background:'rgba(251,113,133,0.06)', color:'var(--accent-red)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Trash2 size={11}/>
            </button>
          )}
          {expanded ? <ChevronUp size={14} style={{ color:'var(--text-muted)' }}/> : <ChevronDown size={14} style={{ color:'var(--text-muted)' }}/>}
        </div>
      </div>

      {mission.wikelo_delivery_error && <div style={{ margin:'0 16px 10px', padding:'7px 9px', display:'flex', alignItems:'flex-start', gap:6, color:'var(--accent-red)', background:'rgba(251,113,133,0.07)', border:'1px solid rgba(251,113,133,0.24)', borderRadius:5, fontSize:10, lineHeight:1.4 }}><AlertTriangle size={12}/> Entrega não realizada: {mission.wikelo_delivery_error}</div>}

      {/* Lista de itens */}
      {expanded && (
        <div style={{ padding:'0 16px 14px' }}>
          {items.length === 0 && !showForm && (
            <div style={{ fontSize:11, color:'var(--text-muted)', padding:'8px 0', fontStyle:'italic' }}>Nenhum item cadastrado nesta missão.</div>
          )}
          {items.map(item => (
            <MissionItemRow
              key={item.id} item={item} missionId={mission.id}
              onUpdate={onUpdateItem}
              onDelete={onDeleteItem}
              onScan={onScanItem}
              inventoryItems={inventoryItems}
            />
          ))}
          {showForm && (
            <ItemForm
              inventoryItems={inventoryItems}
              onInventoryCheck={handleInventoryCheck}
              onSave={handleAddItem}
              onCancel={()=>setShowForm(false)}
            />
          )}
          {isComplete && !delivered && <button onClick={() => onDeliverMission?.(mission)} style={{ display:'flex', alignItems:'center', gap:6, width:'100%', justifyContent:'center', padding:'8px 12px', marginTop:8, background:'rgba(255,200,0,0.12)', border:'1px solid rgba(255,200,0,0.42)', borderRadius:6, color:'var(--accent-gold)', cursor:'pointer', fontSize:11, fontWeight:800, fontFamily:'"Exo 2",sans-serif', textTransform:'uppercase' }}><Truck size={13}/> Entregar para o Wikelo</button>}
          {delivered && <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 12px', marginTop:8, color:'var(--accent-green)', background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.24)', borderRadius:6, fontSize:10, fontWeight:800, textTransform:'uppercase' }}><CheckCircle2 size={12}/> Itens entregues ao Wikelo{mission.wikelo_delivered_at ? ` · ${ptDateTime(mission.wikelo_delivered_at)}` : ''}</div>}
          {!showForm && !delivered && (
            <button onClick={()=>setShowForm(true)} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:'rgba(56,189,248,0.06)', border:'1px dashed rgba(56,189,248,0.25)', borderRadius:6, color:'var(--accent-primary)', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'"Exo 2",sans-serif', textTransform:'uppercase', marginTop:6 }}>
              <Plus size={11}/> Adicionar Item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function WikeloTrackerPage() {
  const [missions,    setMissions]    = useState(() => loadMissions());
  const [inventoryItems, setInventoryItems] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle,    setNewTitle]    = useState('');
  const [search,      setSearch]      = useState('');
  const [filterDone,  setFilterDone]  = useState('all');

  const reloadInventory = useCallback(async () => {
    const items = await fetchInventoryItems();
    setInventoryItems(Array.isArray(items) ? items : []);
    return Array.isArray(items) ? items : [];
  }, []);

  useEffect(() => {
    let active = true;
    fetchInventoryItems().then(items => {
      if (active) setInventoryItems(Array.isArray(items) ? items : []);
    });
    const handleInventoryUpdate = event => {
      if (Array.isArray(event?.detail?.items)) setInventoryItems(event.detail.items);
      else reloadInventory();
    };
    window.addEventListener(INVENTORY_UPDATED_EVENT, handleInventoryUpdate);
    return () => {
      active = false;
      window.removeEventListener(INVENTORY_UPDATED_EVENT, handleInventoryUpdate);
    };
  }, [reloadInventory]);

  const wfTotal = useMemo(() => calcWikeloFavors(inventoryItems), [inventoryItems]);

  function persist(updated) { setMissions(updated); saveMissions(updated); }

  function handleCreateMission() {
    if (!newTitle.trim()) return;
    const mission = {
      id: Date.now(),
      title: newTitle.trim(),
      items: [],
      created_at: localISOString(),
    };
    persist([mission, ...missions]);
    setNewTitle(''); setShowNewForm(false);
  }

  function handleDeleteMission(mId) {
    persist(missions.filter(m => m.id !== mId));
  }

  function handleEditTitle(mId, title) {
    persist(missions.map(m => m.id===mId ? {...m, title} : m));
  }

  function handleAddItem(mId, item) {
    persist(missions.map(m => m.id===mId ? {...m, items:[...(m.items||[]), item]} : m));
  }

  function handleUpdateItem(mId, updatedItem) {
    persist(missions.map(m => m.id!==mId ? m : {
      ...m,
      wikelo_delivery_error: null,
      items: (m.items||[]).map(i => i.id===updatedItem.id ? updatedItem : i),
    }));
  }

  function handleScanItem(mId, item) {
    const updatedItem = scanWikeloItem(item, inventoryItems);
    handleUpdateItem(mId, updatedItem);
  }

  async function updateInventoryRow(item) {
    if (window.electronAPI?.inventoryUpdate) return window.electronAPI.inventoryUpdate(item);
    const current = loadInventory();
    const next = current.map(row => String(row.id) === String(item.id) ? item : row);
    localStorage.setItem(INV_KEY, JSON.stringify({ itens: next }));
    return { success: true };
  }

  async function deleteInventoryRow(item) {
    if (window.electronAPI?.inventoryDelete) return window.electronAPI.inventoryDelete(item.id);
    const current = loadInventory();
    localStorage.setItem(INV_KEY, JSON.stringify({ itens: current.filter(row => String(row.id) !== String(item.id)) }));
    return { success: true };
  }

  async function handleDeliverMission(mission) {
    const currentMission = missions.find(row => row.id === mission.id) || mission;
    if (currentMission.wikelo_delivery_status === 'delivered' || currentMission.wikelo_delivered_at) return;
    if (!window.confirm(`Entregar os itens da missão "${mission.title}" ao Wikelo? O estoque será descontado do Inventário.`)) return;

    const plan = buildWikeloDeliveryPlan(currentMission, inventoryItems);
    if (!plan.ok) {
      const reason = plan.alreadyDelivered ? 'Esta missão já foi entregue.' : plan.missing.map(row => `${row.name}: ${row.reason}`).join(' ');
      persist(missions.map(row => row.id === mission.id ? { ...row, wikelo_delivery_status: 'error', wikelo_delivery_error: reason } : row));
      return;
    }

    const snapshots = plan.allocations.map(allocation => inventoryItems.find(item => String(item.id) === String(allocation.inventoryId))).filter(Boolean);
    try {
      for (const allocation of plan.allocations) {
        const row = snapshots.find(item => String(item.id) === String(allocation.inventoryId));
        if (!row) throw new Error(`Item ${allocation.name} não foi encontrado no Inventário.`);
        if (allocation.afterQuantity > 0) await updateInventoryRow({ ...row, quantity: allocation.afterQuantity });
        else await deleteInventoryRow(row);
      }
      const nextInventory = applyWikeloDeliveryPlan(inventoryItems, plan);
      setInventoryItems(nextInventory);
      publishInventoryUpdate(nextInventory);
      persist(missions.map(row => row.id === mission.id ? {
        ...row,
        wikelo_delivery_status: 'delivered',
        wikelo_delivered_at: new Date().toISOString(),
        wikelo_delivery_error: null,
        wikelo_delivery_plan: plan.allocations,
      } : row));
    } catch (error) {
      // Os snapshots permitem restaurar as linhas já alteradas se alguma operação IPC falhar.
      for (const snapshot of snapshots) {
        try { await updateInventoryRow(snapshot); } catch { /* melhor esforço de rollback */ }
      }
      const message = error?.message || 'Não foi possível entregar os itens ao Wikelo.';
      persist(missions.map(row => row.id === mission.id ? { ...row, wikelo_delivery_status: 'error', wikelo_delivery_error: message } : row));
      await reloadInventory();
    }
  }

  function handleDeleteItem(mId, itemId) {
    persist(missions.map(m => m.id!==mId ? m : {
      ...m,
      items: (m.items||[]).filter(i => i.id !== itemId),
    }));
  }

  const filtered = useMemo(() => {
    let list = missions;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m => m.title?.toLowerCase().includes(q) || (m.items||[]).some(i=>i.name?.toLowerCase().includes(q)));
    }
    if (filterDone === 'done')    list = list.filter(m => (m.items||[]).length > 0 && (m.items||[]).every(i=>(i.collected||0)>=(i.needed||1)));
    if (filterDone === 'pending') list = list.filter(m => !(m.items||[]).every(i=>(i.collected||0)>=(i.needed||1)));
    return list;
  }, [missions, search, filterDone]);

  const totalMissions  = missions.length;
  const doneMissions   = missions.filter(m => (m.items||[]).length>0 && (m.items||[]).every(i=>(i.collected||0)>=(i.needed||1))).length;
  const totalItems     = missions.reduce((a,m)=>a+(m.items||[]).length,0);
  const doneItems      = missions.reduce((a,m)=>a+(m.items||[]).filter(i=>(i.collected||0)>=(i.needed||1)).length,0);

  const SS = { padding:'5px 22px 5px 8px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none', appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 5px center' };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Star size={20} style={{ color:'var(--accent-gold)' }}/> ACOMPANHAMENTO WIKELO
          </div>
          <div className="page-subtitle">
            {totalMissions} missão{totalMissions!==1?'s':''} · {doneMissions} completa{doneMissions!==1?'s':''} · {doneItems}/{totalItems} itens coletados
            {wfTotal > 0 && <span style={{ marginLeft:10, color:'#a29bfe', fontWeight:700 }}>★ {wfTotal} Wikelo Favor{wfTotal!==1?'s':''} disponíveis</span>}
          </div>
        </div>
        <button onClick={()=>setShowNewForm(true)} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', background:'rgba(255,200,0,0.1)', border:'1px solid rgba(255,200,0,0.35)', borderRadius:7, color:'var(--accent-gold)', fontFamily:'"Exo 2",sans-serif', fontSize:12, fontWeight:700, textTransform:'uppercase', cursor:'pointer' }}>
          <Plus size={14}/> Nova Missão
        </button>
      </div>

      <div className="page-body">
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
          {[
            { label:'Missões',         value:totalMissions,   color:'var(--accent-primary)' },
            { label:'Completas',       value:doneMissions,    color:'var(--accent-green)' },
            { label:'Itens Coletados', value:`${doneItems}/${totalItems}`, color:'var(--accent-gold)' },
            { label:'Wikelo Favors',   value:wfTotal,         color:'#a29bfe' },
          ].map(({label,value,color}) => (
            <div key={label} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:8, padding:'10px 13px' }}>
              <div style={{ fontFamily:'Michroma,sans-serif', fontSize:18, fontWeight:800, color }}>{value}</div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Formulário nova missão */}
        {showNewForm && (
          <div style={{ padding:'12px 14px', background:'rgba(255,200,0,0.05)', border:'1px solid rgba(255,200,0,0.25)', borderRadius:8, marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--accent-gold)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Nova Missão Wikelo</div>
            <div style={{ display:'flex', gap:8 }}>
              <input
                style={{ flex:1, padding:'8px 12px', background:'var(--bg-base)', border:'1px solid rgba(255,200,0,0.3)', borderRadius:6, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:13, outline:'none' }}
                placeholder="Nome da missão (ex: Align and Mine, New to System...)"
                value={newTitle} onChange={e=>setNewTitle(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&handleCreateMission()} autoFocus/>
              <button onClick={handleCreateMission} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 16px', background:'rgba(255,200,0,0.1)', border:'1px solid rgba(255,200,0,0.3)', borderRadius:6, color:'var(--accent-gold)', fontFamily:'"Exo 2",sans-serif', fontSize:12, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>
                <Save size={12}/> Criar
              </button>
              <button onClick={()=>{setShowNewForm(false);setNewTitle('');}} style={{ width:34, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:6, color:'var(--text-muted)', cursor:'pointer' }}>
                <X size={13}/>
              </button>
            </div>
          </div>
        )}

        {/* Controles */}
        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:1, minWidth:180 }}>
            <Search size={11} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
            <input style={{ width:'100%', padding:'6px 10px 6px 26px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none', boxSizing:'border-box' }}
              placeholder="Buscar missão ou item..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select style={SS} value={filterDone} onChange={e=>setFilterDone(e.target.value)}>
            <option value="all">Todas as missões</option>
            <option value="pending">Pendentes</option>
            <option value="done">Completas</option>
          </select>
          <span style={{ marginLeft:'auto', fontFamily:'Share Tech Mono,monospace', fontSize:11, color:'var(--text-muted)' }}>{filtered.length} missão{filtered.length!==1?'s':''}</span>
        </div>

        {/* Lista de missões */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)' }}>
            <Star size={48} style={{ display:'block', margin:'0 auto 14px', opacity:0.15 }}/>
            <div style={{ fontFamily:'Michroma,sans-serif', fontSize:13, fontWeight:700, marginBottom:8 }}>
              {missions.length === 0 ? 'NENHUMA MISSÃO CADASTRADA' : 'NENHUM RESULTADO'}
            </div>
            <div style={{ fontSize:12, lineHeight:1.6 }}>
              {missions.length === 0
                ? 'Clique em "Nova Missão" para começar a acompanhar suas missões Wikelo.'
                : 'Tente ajustar os filtros.'}
            </div>
          </div>
        ) : (
          filtered.map(m => (
            <MissionCard
              key={m.id} mission={m}
              inventoryItems={inventoryItems}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onAddItem={handleAddItem}
              onDelete={handleDeleteMission}
              onEditTitle={handleEditTitle}
              onScanItem={handleScanItem}
              onDeliverMission={handleDeliverMission}
            />
          ))
        )}
      </div>
    </div>
  );
}