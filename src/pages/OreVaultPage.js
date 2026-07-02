import React, { useState, useMemo, useCallback } from 'react';
import {
  Pickaxe, Plus, Trash2, Edit3, Save, X, Search,
  MapPin, Star, CheckCircle2, Package, FlaskConical,
  ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Archive
} from 'lucide-react';
import { loadVault, addOreEntry, removeOreEntry } from '../data/oreVault';

// ── Constantes ────────────────────────────────────────────────────────────────
const KNOWN_ORES = [
  'Titanium','Copper','Orotite','Caranite','Steel','Laranite','Taranite',
  'Bexalite','Quantainium','Hephaestanite','Dolivine','Corundum','Aluminum',
  'Iron','Borase','Agricium','Gold','Diamond','Tungsten','Inert Material',
  'Reactive Material','Polymer','Industrial Polymer','Medical Grade Polymer',
];

const LOCATIONS = [
  'Yela Asteroid Belt','Aaron Halo','Daymar','Cellin','Aberdeen','Arial',
  'Ita','Magda','Calliope','Clio','Euterpe','Hurston','microTech',
  'Port Tressler','ARC-L1','HUR-L3','HUR-L5','MIC-L1','Bunker Loot',
  'Desmontagem','Outro',
];

const QUALITY_PRESETS = ['Grade A','Grade B','Grade C','Pristine','High','Medium','Low','Raw','Refined'];

const ORE_COLORS = {
  'Titanium':'#74b9ff','Copper':'#fdcb6e','Orotite':'#a29bfe',
  'Caranite':'#fd79a8','Steel':'#b2bec3','Laranite':'#fd79a8',
  'Taranite':'#74b9ff','Bexalite':'#a29bfe','Quantainium':'#00e5a0',
  'Gold':'#ffc436','Diamond':'#dfe6e9','Tungsten':'#dfe6e9',
  'Aluminum':'#b2bec3','Iron':'#636e72','Inert Material':'#7a90b0',
};
function getOreColor(name) { return ORE_COLORS[name] || '#7a90b0'; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function ptMoney(v) { return Number(v).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:3}); }
function ptDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
}

// ── Formulário de entrada ─────────────────────────────────────────────────────
function OreForm({ initial, onSave, onCancel }) {
  const empty = {
    id: null, ore_name: '', quantity: '', unit: 'un',
    quality: '', location: '', refined: false, notes: '',
  };
  const [d, setD] = useState(() => initial ? { ...initial, quantity: String(initial.quantity||'') } : empty);
  const [showQualityPresets, setShowQP] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setD(p => ({ ...p, [k]: v }));

  const IS = { width:'100%', padding:'8px 10px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'Rajdhani,sans-serif', fontSize:13, outline:'none' };
  const SS = { ...IS, appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 7px center', paddingRight:26 };
  const LS = { fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:4 };

  function handleSave() {
    if (!d.ore_name.trim()) { setError('Nome do minério obrigatório.'); return; }
    const qty = parseFloat(String(d.quantity).replace(',','.'));
    if (!qty || qty <= 0) { setError('Quantidade deve ser maior que zero.'); return; }
    onSave({ ...d, ore_name: d.ore_name.trim(), quantity: qty });
  }

  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-normal)', borderRadius:10, padding:18, marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontFamily:'Orbitron,monospace', fontSize:13, fontWeight:700, color:'var(--text-primary)', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:7 }}>
          <Pickaxe size={15} style={{ color:'var(--accent-primary)' }}/> {initial?.id ? 'EDITAR ENTRADA' : 'NOVO MINÉRIO NO BAÚ'}
        </div>
        <button onClick={onCancel} style={{ background:'none', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-secondary)', cursor:'pointer', padding:'4px 8px' }}><X size={13}/></button>
      </div>

      {/* Linha 1: nome + quantidade + unidade */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 140px 100px', gap:9, marginBottom:9 }}>
        <div>
          <label style={LS}>Minério *</label>
          <div style={{ position:'relative' }}>
            <input style={IS} list="ore-list" value={d.ore_name}
              onChange={e => set('ore_name', e.target.value)}
              placeholder="ex: Caranite, Quantainium..."/>
            <datalist id="ore-list">
              {KNOWN_ORES.map(o => <option key={o} value={o}/>)}
            </datalist>
          </div>
        </div>
        <div>
          <label style={LS}>Quantidade *</label>
          <input style={IS} type="number" min="0.001" step="0.001" value={d.quantity}
            onChange={e => set('quantity', e.target.value)} placeholder="ex: 16"/>
        </div>
        <div>
          <label style={LS}>Unidade</label>
          <select style={SS} value={d.unit} onChange={e => set('unit', e.target.value)}>
            <option value="un">un</option>
            <option value="SCU">SCU</option>
            <option value="cSCU">cSCU</option>
            <option value="kg">kg</option>
          </select>
        </div>
      </div>

      {/* Linha 2: qualidade + localização + refinado */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:9, marginBottom:9, alignItems:'end' }}>
        <div>
          <label style={LS}>Qualidade</label>
          <div style={{ position:'relative' }}>
            <input style={IS} value={d.quality}
              onChange={e => set('quality', e.target.value)}
              onFocus={() => setShowQP(true)}
              onBlur={() => setTimeout(() => setShowQP(false), 150)}
              placeholder="ex: Grade A, 94%, Pristine..."/>
            {showQualityPresets && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg-card)', border:'1px solid var(--border-normal)', borderRadius:6, zIndex:50, overflow:'hidden', boxShadow:'0 8px 20px rgba(0,0,0,0.4)' }}>
                {QUALITY_PRESETS.map(q => (
                  <button key={q} onMouseDown={() => set('quality', q)}
                    style={{ display:'block', width:'100%', textAlign:'left', padding:'6px 12px', background:'none', border:'none', borderBottom:'1px solid var(--border-subtle)', color:'var(--text-secondary)', cursor:'pointer', fontSize:12, fontFamily:'Rajdhani,sans-serif' }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label style={LS}>Local onde guardou</label>
          <select style={SS} value={d.location} onChange={e => set('location', e.target.value)}>
            <option value="">— Selecionar —</option>
            {LOCATIONS.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div style={{ paddingBottom:2 }}>
          <button onClick={() => set('refined', !d.refined)} style={{
            display:'flex', alignItems:'center', gap:7, padding:'8px 12px',
            background: d.refined ? 'rgba(0,229,160,0.1)' : 'transparent',
            border: `1px solid ${d.refined ? 'rgba(0,229,160,0.4)' : 'var(--border-subtle)'}`,
            borderRadius:5, color: d.refined ? 'var(--accent-green)' : 'var(--text-muted)',
            cursor:'pointer', fontFamily:'Rajdhani,sans-serif', fontSize:12, fontWeight:700, textTransform:'uppercase', whiteSpace:'nowrap',
          }}>
            <FlaskConical size={13}/>
            {d.refined ? 'Refinado ✓' : 'Refinado?'}
          </button>
        </div>
      </div>

      {/* Notas */}
      <div style={{ marginBottom:12 }}>
        <label style={LS}>Notas</label>
        <textarea value={d.notes || ''} onChange={e => set('notes', e.target.value)}
          placeholder="Observações opcionais..."
          style={{ width:'100%', minHeight:40, padding:'7px 10px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'Rajdhani,sans-serif', fontSize:12, outline:'none', resize:'vertical', boxSizing:'border-box' }}/>
      </div>

      {error && <div style={{ color:'var(--accent-red)', fontSize:12, marginBottom:9, display:'flex', alignItems:'center', gap:6 }}><AlertTriangle size={13}/>{error}</div>}

      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={{ padding:'8px 16px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:6, color:'var(--text-secondary)', fontFamily:'Rajdhani,sans-serif', fontSize:12, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>Cancelar</button>
        <button onClick={handleSave} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', background:'rgba(0,229,160,0.1)', border:'1px solid rgba(0,229,160,0.3)', borderRadius:6, color:'var(--accent-green)', fontFamily:'Rajdhani,sans-serif', fontSize:12, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>
          <Save size={13}/> {initial?.id ? 'Salvar' : 'Adicionar ao Baú'}
        </button>
      </div>
    </div>
  );
}

// ── Card de entrada do baú ────────────────────────────────────────────────────
function OreCard({ entry, onEdit, onDelete }) {
  const [delConf, setDelConf] = useState(false);
  const color = getOreColor(entry.ore_name);

  return (
    <div style={{
      background:'var(--bg-card)',
      border:`1px solid ${color}33`,
      borderLeft:`3px solid ${color}`,
      borderRadius:8, padding:'12px 14px',
      display:'flex', alignItems:'center', gap:12,
    }}>
      {/* Ícone / cor */}
      <div style={{ width:36, height:36, borderRadius:'50%', background:`${color}22`, border:`1px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Pickaxe size={16} style={{ color }}/>
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
          <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:14, fontWeight:700, color }}>{entry.ore_name}</span>
          {entry.refined && (
            <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(0,229,160,0.1)', color:'var(--accent-green)', border:'1px solid rgba(0,229,160,0.25)', fontWeight:700 }}>
              <FlaskConical size={8} style={{ display:'inline', marginRight:3 }}/>REFINADO
            </span>
          )}
          {entry.quality && (
            <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(255,200,0,0.1)', color:'var(--accent-gold)', border:'1px solid rgba(255,200,0,0.3)', fontWeight:700 }}>
              ★ {entry.quality}
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text-muted)', flexWrap:'wrap' }}>
          {entry.location && (
            <span style={{ display:'flex', alignItems:'center', gap:3 }}>
              <MapPin size={9}/>{entry.location}
            </span>
          )}
          <span style={{ color:'var(--text-secondary)', fontFamily:'Share Tech Mono,monospace' }}>
            Adicionado: {ptDate(entry.created_at)}
          </span>
          {entry.notes && <span style={{ fontStyle:'italic' }}>{entry.notes}</span>}
        </div>
      </div>

      {/* Quantidade */}
      <div style={{ textAlign:'right', flexShrink:0, marginRight:8 }}>
        <div style={{ fontFamily:'Orbitron,monospace', fontSize:18, fontWeight:800, color }}>{ptMoney(entry.quantity)}</div>
        <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{entry.unit}</div>
      </div>

      {/* Ações */}
      <div style={{ display:'flex', gap:5, flexShrink:0 }}>
        <button onClick={() => onEdit(entry)} style={{ width:28, height:28, borderRadius:5, border:'1px solid var(--border-normal)', background:'rgba(0,212,255,0.08)', color:'var(--accent-primary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Edit3 size={11}/>
        </button>
        {delConf ? (
          <div style={{ display:'flex', gap:4 }}>
            <button onClick={() => onDelete(entry.id)} style={{ padding:'3px 7px', background:'rgba(255,68,102,0.15)', border:'1px solid rgba(255,68,102,0.4)', borderRadius:3, color:'var(--accent-red)', cursor:'pointer', fontSize:10, fontWeight:700 }}>Sim</button>
            <button onClick={() => setDelConf(false)} style={{ padding:'3px 7px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:3, color:'var(--text-secondary)', cursor:'pointer', fontSize:10 }}>Não</button>
          </div>
        ) : (
          <button onClick={() => setDelConf(true)} style={{ width:28, height:28, borderRadius:5, border:'1px solid rgba(255,68,102,0.2)', background:'rgba(255,68,102,0.08)', color:'var(--accent-red)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Trash2 size={11}/>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function OreVaultPage() {
  const [vault, setVault]     = useState(() => loadVault());
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [search, setSearch]   = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterRefined, setFilterRefined] = useState('all');
  const [sortBy, setSortBy]   = useState('date');

  function refresh() { setVault(loadVault()); }

  function handleSave(entry) {
    addOreEntry(entry);
    refresh();
    setShowForm(false);
    setEditEntry(null);
  }
  function handleDelete(id) {
    removeOreEntry(id);
    refresh();
  }

  const entries = useMemo(() => {
    let list = vault.entries || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.ore_name.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q) || e.quality?.toLowerCase().includes(q));
    }
    if (filterUnit !== 'all') list = list.filter(e => e.unit === filterUnit);
    if (filterRefined === 'yes') list = list.filter(e => e.refined);
    if (filterRefined === 'no')  list = list.filter(e => !e.refined);
    if (sortBy === 'name')     list = [...list].sort((a,b) => a.ore_name.localeCompare(b.ore_name));
    if (sortBy === 'qty')      list = [...list].sort((a,b) => b.quantity - a.quantity);
    if (sortBy === 'date')     list = [...list].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
    return list;
  }, [vault, search, filterUnit, filterRefined, sortBy]);

  // Resumo por minério
  const summary = useMemo(() => {
    const map = {};
    (vault.entries||[]).forEach(e => {
      if (!map[e.ore_name]) map[e.ore_name] = { name:e.ore_name, total:0, unit:e.unit, entries:0, refined:0 };
      map[e.ore_name].total   += e.quantity || 0;
      map[e.ore_name].entries += 1;
      if (e.refined) map[e.ore_name].refined += 1;
    });
    return Object.values(map).sort((a,b) => b.total - a.total);
  }, [vault]);

  const totalEntries = (vault.entries||[]).length;
  const totalTypes   = summary.length;

  const SS = { padding:'6px 22px 6px 9px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'Rajdhani,sans-serif', fontSize:12, outline:'none', appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 5px center' };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Archive size={20} style={{ color:'var(--accent-gold)' }}/> BAÚ DE MINÉRIO
          </div>
          <div className="page-subtitle">
            {totalEntries} entrada{totalEntries!==1?'s':''} · {totalTypes} tipo{totalTypes!==1?'s':''} de minério armazenado{totalTypes!==1?'s':''}
          </div>
        </div>
        <button onClick={() => { setShowForm(true); setEditEntry(null); }} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', background:'rgba(255,200,0,0.1)', border:'1px solid rgba(255,200,0,0.35)', borderRadius:7, color:'var(--accent-gold)', fontFamily:'Rajdhani,sans-serif', fontSize:12, fontWeight:700, textTransform:'uppercase', cursor:'pointer' }}>
          <Plus size={14}/> Adicionar Minério
        </button>
      </div>

      <div style={{ flex:1, display:'grid', gridTemplateColumns:'260px 1fr', overflow:'hidden' }}>

        {/* ── PAINEL ESQUERDO: Resumo por tipo ── */}
        <div style={{ borderRight:'1px solid var(--border-subtle)', overflowY:'auto', padding:14 }}>
          <div style={{ fontFamily:'Orbitron,monospace', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
            <Package size={11}/> Resumo do Estoque
          </div>

          {summary.length === 0 ? (
            <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:'20px 0', lineHeight:1.6 }}>
              Nenhum minério no baú.<br/>Adicione sua primeira entrada!
            </div>
          ) : (
            summary.map(s => {
              const color = getOreColor(s.name);
              return (
                <div key={s.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', marginBottom:5, background:'var(--bg-card)', border:`1px solid ${color}22`, borderLeft:`3px solid ${color}`, borderRadius:7 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color, marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)' }}>
                      {s.entries} entrada{s.entries!==1?'s':''}
                      {s.refined > 0 && <span style={{ color:'var(--accent-green)', marginLeft:5 }}>· {s.refined} refinado{s.refined!==1?'s':''}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontFamily:'Orbitron,monospace', fontSize:13, fontWeight:800, color }}>{ptMoney(s.total)}</div>
                    <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase' }}>{s.unit}</div>
                  </div>
                </div>
              );
            })
          )}

          {/* Dica de conexão com Material Tracker */}
          {totalEntries > 0 && (
            <div style={{ marginTop:14, padding:'10px 12px', background:'rgba(0,119,255,0.05)', border:'1px solid rgba(0,119,255,0.15)', borderRadius:7 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--accent-primary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5, display:'flex', alignItems:'center', gap:5 }}>
                <FlaskConical size={10}/> Integração Automática
              </div>
              <div style={{ fontSize:11, color:'var(--text-secondary)', lineHeight:1.6 }}>
                O <strong>Tracking de Materiais</strong> verifica automaticamente se os materiais da sua fila de craft estão aqui no baú, e te pergunta se quer usá-los.
              </div>
            </div>
          )}
        </div>

        {/* ── PAINEL DIREITO: Lista de entradas ── */}
        <div style={{ overflowY:'auto', padding:'14px 18px' }}>

          {/* Formulário */}
          {(showForm || editEntry) && (
            <OreForm
              initial={editEntry}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditEntry(null); }}
            />
          )}

          {/* Controles */}
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ position:'relative', flex:1, minWidth:180 }}>
              <Search size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
              <input
                style={{ width:'100%', padding:'7px 10px 7px 28px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'Rajdhani,sans-serif', fontSize:12, outline:'none', boxSizing:'border-box' }}
                placeholder="Buscar minério, local, qualidade..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select style={SS} value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
              <option value="all">Todas as unidades</option>
              <option value="un">Unidades (un)</option>
              <option value="SCU">SCU</option>
              <option value="cSCU">cSCU</option>
              <option value="kg">kg</option>
            </select>
            <select style={SS} value={filterRefined} onChange={e => setFilterRefined(e.target.value)}>
              <option value="all">Refinado ou não</option>
              <option value="yes">Refinados</option>
              <option value="no">Brutos</option>
            </select>
            <select style={SS} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="date">Mais recente</option>
              <option value="name">Nome A-Z</option>
              <option value="qty">Maior quantidade</option>
            </select>
            <span style={{ marginLeft:'auto', fontFamily:'Share Tech Mono,monospace', fontSize:11, color:'var(--text-muted)' }}>{entries.length} entrada{entries.length!==1?'s':''}</span>
          </div>

          {/* Lista */}
          {entries.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)' }}>
              <Archive size={48} style={{ display:'block', margin:'0 auto 14px', opacity:0.15 }}/>
              <div style={{ fontFamily:'Orbitron,monospace', fontSize:13, fontWeight:700, letterSpacing:'0.06em', marginBottom:8 }}>
                {totalEntries === 0 ? 'BAÚ VAZIO' : 'NENHUM RESULTADO'}
              </div>
              <div style={{ fontSize:12, lineHeight:1.6 }}>
                {totalEntries === 0
                  ? 'Clique em "Adicionar Minério" para registrar seu estoque.'
                  : 'Tente ajustar os filtros de busca.'}
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {entries.map(e => (
                <OreCard
                  key={e.id}
                  entry={e}
                  onEdit={entry => { setEditEntry(entry); setShowForm(false); }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
