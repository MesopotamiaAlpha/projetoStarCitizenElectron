import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Edit3, Save, X, Shield, HardHat, Shirt, Dumbbell, Footprints, Backpack, ChevronDown, ChevronUp, AlertTriangle, Download, RefreshCw, CheckCircle2 } from 'lucide-react';
import { setProvenance, SOURCES } from '../data/provenance';
import { getMissingArmorGroups, getArmorSyncStats } from '../data/uexArmorImport';
import { getDuplicateArmorGroups, getArmorIdentity } from '../data/armorDedup';

const PIECE_TYPES = ['Helmet','Torso','Arms','Legs','Backpack'];
const PIECE_ICONS = { Helmet:HardHat, Torso:Shirt, Arms:Dumbbell, Legs:Footprints, Backpack:Backpack };
const PIECE_PT    = { Helmet:'Capacete', Torso:'Torso', Arms:'Braços', Legs:'Pernas', Backpack:'Mochila' };
const TYPES       = ['Light','Médio','Heavy','Special'];
const RARITIES    = ['Comum','Incomum','Raro','Legendary'];

const emptyPiece = (type='Helmet') => ({
  piece_type:type, piece_name:'',
  resistance_physical:0, resistance_energy:0, resistance_distortion:0,
  resistance_thermal:0, resistance_biochemical:0, resistance_stun:0,
  mobility_penalty:0, slots:0,
  is_lootable:false, is_purchasable:true,
  buy_location:'', how_to_get:'', price_auec:0, description:'',
});

const emptySet = () => ({
  base_name:'', variant_name:'Base', manufacturer:'', type:'Médio', category:'Combat',
  description:'', lore:'', tags:[], added_version:'4.0', rarity:'Comum',
});

function NumInput({ label, name, value, onChange }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:3 }}>
      <label style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em' }}>{label}</label>
      <input type="number" min="0" max="100" value={value}
        onChange={e=>onChange(name,Number(e.target.value))}
        style={{ width:'100%',padding:'6px 8px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-primary)',fontFamily:'Share Tech Mono,monospace',fontSize:13,outline:'none' }} />
    </div>
  );
}

function PieceForm({ piece, index, onChange, onRemove, canRemove }) {
  const [open, setAbrir] = useState(index === 0);
  const Icon = PIECE_ICONS[piece.piece_type]||Shield;
  const set = (k,v) => onChange({...piece,[k]:v});

  return (
    <div style={{ border:'1px solid var(--border-subtle)',borderRadius:8,overflow:'hidden',background:'var(--bg-panel)' }}>
      <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',background:'rgba(56,189,248,0.03)' }}
        onClick={()=>setAbrir(!open)}>
        <Icon size={16} style={{ color:'var(--accent-primary)',flexShrink:0 }} />
        <span style={{ fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:700,color:'var(--text-primary)',flex:1 }}>
          {PIECE_PT[piece.piece_type]||piece.piece_type}
          {piece.piece_name&&<span style={{ color:'var(--text-secondary)',fontWeight:400,marginLeft:8,fontFamily:'"Exo 2",sans-serif' }}>— {piece.piece_name}</span>}
        </span>
        {canRemove&&(
          <button onClick={e=>{e.stopPropagation();onRemove();}}
            style={{ background:'rgba(251,113,133,0.1)',border:'1px solid rgba(251,113,133,0.25)',borderRadius:4,color:'var(--accent-red)',cursor:'pointer',padding:'3px 6px',display:'flex',alignItems:'center' }}>
            <Trash2 size={12}/>
          </button>
        )}
        {open?<ChevronUp size={14} style={{ color:'var(--text-muted)' }}/>:<ChevronDown size={14} style={{ color:'var(--text-muted)' }}/>}
      </div>

      {open&&(
        <div className="custom-armor-form-content" style={{ padding:'14px',display:'flex',flexDirection:'column',gap:12 }}>
          <div className="custom-armor-identity-grid" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
            <div>
              <label style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 }}>Tipo de Peça</label>
              <select value={piece.piece_type} onChange={e=>set('piece_type',e.target.value)} className="filter-select" style={{ width:'100%' }}>
                {PIECE_TYPES.map(t=><option key={t} value={t}>{PIECE_PT[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 }}>Nome da Peça</label>
              <input className="search-input" value={piece.piece_name} onChange={e=>set('piece_name',e.target.value)} placeholder="ex: Citadel Helmet (Brimstone)" style={{ width:'100%' }}/>
            </div>
          </div>

          {piece.piece_type!=='Backpack'&&(
            <div>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8 }}>Resistências</div>
              <div className="custom-armor-resistance-grid" style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8 }}>
                <NumInput label="Física"       name="resistance_physical"    value={piece.resistance_physical}    onChange={set}/>
                <NumInput label="Energia"      name="resistance_energy"      value={piece.resistance_energy}      onChange={set}/>
                <NumInput label="Distorção"    name="resistance_distortion"  value={piece.resistance_distortion}  onChange={set}/>
                <NumInput label="Térmica"      name="resistance_thermal"     value={piece.resistance_thermal}     onChange={set}/>
                <NumInput label="Bioquímica"   name="resistance_biochemical" value={piece.resistance_biochemical} onChange={set}/>
                <NumInput label="Atordoamento" name="resistance_stun"        value={piece.resistance_stun}        onChange={set}/>
              </div>
            </div>
          )}

          <div className="custom-armor-attribute-grid" style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10 }}>
            {piece.piece_type!=='Backpack'&&<NumInput label="Penalidade Mob. %" name="mobility_penalty" value={piece.mobility_penalty} onChange={set}/>}
            <NumInput label="Slots"       name="slots"      value={piece.slots}      onChange={set}/>
            <NumInput label="Preço (aUEC)" name="price_auec" value={piece.price_auec} onChange={set}/>
          </div>

          <div style={{ display:'flex',gap:16 }}>
            {[{k:'is_purchasable',label:'Comprável',c:'var(--accent-green)'},{k:'is_lootable',label:'Lootável',c:'var(--accent-purple)'}].map(({k,label,c})=>(
              <label key={k} style={{ display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13,color:'var(--text-secondary)',fontWeight:600 }}>
                <input type="checkbox" checked={!!piece[k]} onChange={e=>set(k,e.target.checked)} style={{ accentColor:c }}/>
                {label}
              </label>
            ))}
          </div>

          <div>
            <label style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 }}>Localização</label>
            <input className="search-input" value={piece.buy_location} onChange={e=>set('buy_location',e.target.value)} placeholder="ex: Area18 - Cubby Blast / Loot em bunkers" style={{ width:'100%' }}/>
          </div>
          <div>
            <label style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 }}>Como Obter</label>
            <textarea className="notes-textarea" value={piece.how_to_get} onChange={e=>set('how_to_get',e.target.value)} placeholder="Descreva como encontrar esta peça..." style={{ minHeight:60,fontSize:13,marginTop:0 }}/>
          </div>
          <div>
            <label style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 }}>Descrição da Peça</label>
            <textarea className="notes-textarea" value={piece.description} onChange={e=>set('description',e.target.value)} placeholder="Aparência e função desta peça..." style={{ minHeight:50,fontSize:13,marginTop:0 }}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Painel de importação de armaduras da UEX ──────────────────────────────────
// A UEX não classifica raridade nem tipo Light/Médio/Heavy/Special — esses campos
// vêm com um valor padrão e devem ser conferidos/ajustados depois de importar.
function UexImportPanel({ sets, onAtualizar, onClose }) {
  const [imported, setImported] = useState([]); // base_names já importados nesta sessão
  const [importing, setImporting] = useState(null);
  const [error, setError] = useState('');
  const api = window.electronAPI;

  const stats  = useMemo(() => getArmorSyncStats(), []);
  const groups = useMemo(
    () => getMissingArmorGroups(sets).filter(g => !imported.includes(g.base_name)),
    [sets, imported]
  );

  function buildImportedPayload(group) {
    const setData = {
      base_name: group.base_name,
      variant_name: 'Base',
      manufacturer: group.manufacturer,
      type: 'Médio',
      category: 'Combat',
      description: 'Importado automaticamente da UEX API. Confira tipo, raridade e resistências.',
      lore: '',
      tags: ['uex-import'],
      added_version: '',
      rarity: 'Comum',
    };
    const pieces = group.pieces.map(p => ({
      piece_type: p.piece_type,
      piece_name: p.name,
      resistance_physical:0, resistance_energy:0, resistance_distortion:0,
      resistance_thermal:0, resistance_biochemical:0, resistance_stun:0,
      mobility_penalty:0, slots:0,
      is_lootable:false, is_purchasable:true,
      buy_location:'', how_to_get:'',
      price_auec: p.price_avg || p.price_buy || p.price_sell || 0,
      description:'',
    }));
    return { setData, pieces };
  }

  async function importGroup(group) {
    const { setData, pieces } = buildImportedPayload(group);
    const result = await api.createCustomSet({ set:setData, pieces });
    if (!result?.success) throw new Error(result?.error || 'Esta armadura já está cadastrada.');
    setProvenance('armor', setData.base_name, SOURCES.UEX_API);
    return group.base_name;
  }

  async function handleImport(group) {
    if (!api) { setError('Importar só funciona no app Electron.'); return; }
    setImporting(group.base_name); setError('');
    try {
      await importGroup(group);
      setImported(prev => [...prev, group.base_name]);
      await onAtualizar();
    } catch(e) { setError('Erro ao importar: '+e.message); }
    finally { setImporting(null); }
  }

  async function handleImportAll() {
    if (!api) { setError('Importar só funciona no app Electron.'); return; }
    if (!groups.length) return;
    setImporting('all'); setError('');
    const pending = [...groups];
    const importedNames = [];
    const failed = [];
    try {
      for (const group of pending) {
        try {
          const name = await importGroup(group);
          importedNames.push(name);
          setImported(previous => [...previous, name]);
        } catch (error) {
          failed.push(`${group.base_name}: ${error.message}`);
        }
      }
      await onAtualizar();
      if (failed.length) setError(`${importedNames.length} importada(s), ${failed.length} com erro: ${failed.join(' · ')}`);
    } finally {
      setImporting(null);
    }
  }

  return (
    <div style={{ background:'var(--bg-card)',border:'1px solid rgba(56,189,248,0.35)',borderRadius:10,padding:'20px',marginBottom:24 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
        <h3 style={{ fontFamily:'Michroma,sans-serif',fontSize:15,fontWeight:700,color:'var(--accent-primary)',letterSpacing:'0.08em',display:'flex',alignItems:'center',gap:8 }}>
          <Download size={16}/> IMPORTAR ARMADURAS DA UEX
        </h3>
        <button onClick={onClose} style={{ background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'5px 8px' }}><X size={14}/></button>
      </div>

      <div style={{ fontSize:11,color:'var(--text-muted)',lineHeight:1.6,marginBottom:14 }}>
        {stats.updatedAt
          ? `${stats.pieceCount} peças de armadura sincronizadas da UEX (última sincronização em UEX API (Live) → Itens).`
          : 'Nenhum dado sincronizado ainda — vá em UEX API (Live) → Itens e sincronize o banco primeiro.'}
        {' '}A UEX não informa tipo (Light/Médio/Heavy/Special) nem raridade — esses campos entram com um valor padrão que você pode editar depois de importar.
      </div>

      {error && (
        <div style={{ display:'flex',alignItems:'center',gap:7,padding:'8px 12px',background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.25)',borderRadius:6,fontSize:12,color:'var(--accent-red)',marginBottom:12 }}>
          <AlertTriangle size={13}/>{error}
        </div>
      )}

      {groups.length > 0 && (
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',padding:'11px 13px',marginBottom:12,background:'rgba(52,211,153,0.07)',border:'1px solid rgba(52,211,153,0.25)',borderRadius:8 }}>
          <div>
            <div style={{ color:'var(--accent-green)',fontSize:12,fontWeight:800 }}>IMPORTAÇÃO EM LOTE</div>
            <div style={{ color:'var(--text-muted)',fontSize:11,marginTop:3 }}>{groups.length} armadura{groups.length === 1 ? '' : 's'} ainda não cadastrada{groups.length === 1 ? '' : 's'}.</div>
          </div>
          <button onClick={handleImportAll} disabled={!!importing} style={{ display:'inline-flex',alignItems:'center',gap:7,padding:'8px 13px',background:'rgba(52,211,153,0.14)',border:'1px solid rgba(52,211,153,0.4)',borderRadius:6,color:'var(--accent-green)',cursor:importing?'wait':'pointer',fontFamily:'"Exo 2",sans-serif',fontSize:11,fontWeight:800,textTransform:'uppercase',opacity:importing && importing !== 'all' ? 0.55 : 1 }}>
            {importing === 'all' ? <><RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }}/> Importando todas...</> : <><Download size={13}/> Importar todas ({groups.length})</>}
          </button>
        </div>
      )}

      {groups.length===0 ? (
        <div style={{ textAlign:'center',padding:'24px',color:'var(--text-muted)',fontSize:12 }}>
          <CheckCircle2 size={28} style={{ display:'block',margin:'0 auto 8px',opacity:0.4 }}/>
          Nenhuma armadura nova encontrada — tudo que a UEX conhece já está cadastrado, ou o banco ainda não foi sincronizado.
        </div>
      ) : (
        <div style={{ display:'flex',flexDirection:'column',gap:7,maxHeight:420,overflowY:'auto' }}>
          {groups.map(g => (
            <div key={g.base_name} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'var(--bg-panel)',border:'1px solid var(--border-subtle)',borderRadius:8 }}>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{g.base_name}</div>
                <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>
                  {g.manufacturer} · {g.pieces.map(p=>p.piece_type).join(', ')}
                </div>
              </div>
              <button onClick={()=>handleImport(g)} disabled={importing===g.base_name} style={{
                display:'flex',alignItems:'center',gap:6,padding:'7px 14px',flexShrink:0,
                background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.35)',borderRadius:6,
                color:'var(--accent-green)',cursor:importing?'not-allowed':'pointer',fontFamily:'"Exo 2",sans-serif',
                fontSize:12,fontWeight:700,textTransform:'uppercase',opacity:importing&&importing!==g.base_name?0.5:1,
              }}>
                {importing===g.base_name ? <><RefreshCw size={12} style={{ animation:'spin 1s linear infinite' }}/> Importando...</> : <><Plus size={12}/> Importar</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CustomArmorPage({ sets, onAtualizar }) {
  const [showForm,     setShowForm]     = useState(false);
  const [showImport,   setShowImport]   = useState(false);
  const [editingId,    setEditingId]    = useState(null);
  const [setData,      setsetData]      = useState(emptySet());
  const [pieces,       setPieces]       = useState([emptyPiece('Helmet'),emptyPiece('Torso'),emptyPiece('Arms'),emptyPiece('Legs')]);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
    const [deleteConfirm,setDeleteConfirm]= useState(null);
  const [duplicateSelection, setDuplicateSelection] = useState([]);
  const [duplicateBusy, setDuplicateBusy] = useState(false);
  const [duplicateNotice, setDuplicateNotice] = useState('');
  const customSets = sets.filter(s=>s.is_custom);
  const duplicateGroups = useMemo(() => getDuplicateArmorGroups(customSets), [customSets]);
  const duplicateCount = duplicateGroups.reduce((total, group) => total + group.entries.length, 0);
  useEffect(() => {
    const removeByDefault = duplicateGroups.flatMap(group => group.entries.slice(1).map(entry => entry.id));
    setDuplicateSelection(previous => previous.length ? previous.filter(id => removeByDefault.includes(id)) : removeByDefault);
  }, [duplicateGroups]);
  const api = window.electronAPI;

  function startNew() {
    setEditingId(null); setsetData(emptySet());
    setPieces([emptyPiece('Helmet'),emptyPiece('Torso'),emptyPiece('Arms'),emptyPiece('Legs')]);
    setError(''); setShowForm(true);
  }

  function startEdit(set) {
    setEditingId(set.id);
    setsetData({
      base_name: set.base_name, variant_name: set.variant_name||'Base',
      manufacturer:set.manufacturer, type:set.type, category:set.category,
      description:set.description||'', lore:set.lore||'',
      tags:(() => { try { return JSON.parse(set.tags||'[]'); } catch { return []; } })(),
      added_version:set.added_version||'4.0', rarity:set.rarity||'Comum',
    });
    setPieces((set.pieces||[]).map(p=>({
      id:p.id, piece_type:p.piece_type, piece_name:p.piece_name,
      resistance_physical:p.resistance_physical||0, resistance_energy:p.resistance_energy||0,
      resistance_distortion:p.resistance_distortion||0, resistance_thermal:p.resistance_thermal||0,
      resistance_biochemical:p.resistance_biochemical||0, resistance_stun:p.resistance_stun||0,
      mobility_penalty:p.mobility_penalty||0, slots:p.slots||0,
      is_lootable:!!p.is_lootable, is_purchasable:!!p.is_purchasable,
      buy_location:p.buy_location||'', how_to_get:p.how_to_get||'',
      price_auec:p.price_auec||0, description:p.description||'',
    })));
    setError(''); setShowForm(true);
  }

  async function handleSave() {
    if (!setData.base_name.trim()) { setError('Nome do set é obrigatório.'); return; }
    if (!setData.manufacturer.trim()) { setError('Fabricante é obrigatório.'); return; }
    if (pieces.length===0) { setError('Adicione ao menos uma peça.'); return; }
    setSaving(true); setError('');
    try {
      if (editingId) {
        await api.updateCustomSet(editingId, setData);
        setProvenance('armor', setData.base_name, SOURCES.CUSTOM);
        for (const p of pieces) {
          if (p.id) await api.updateCustomPiece(p.id, p);
          else      await api.addPieceToSet(editingId, p);
        }
      } else {
        await api.createCustomSet({ set:setData, pieces });
        setProvenance('armor', setData.base_name, SOURCES.CUSTOM);
      }
      await onAtualizar();
      setShowForm(false);
    } catch(e) { setError('Erro ao salvar: '+e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!api) return;
    const r = await api.deleteCustomSet(id);
    if (r.success) { setDeleteConfirm(null); await onAtualizar(); }
    else alert(r.error||'Erro ao deletar.');
  }

  function toggleDuplicate(id) {
    setDuplicateSelection(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
  }

  function selectAllDuplicateExtras() {
    setDuplicateSelection(duplicateGroups.flatMap(group => group.entries.slice(1).map(entry => entry.id)));
  }

  async function handleDeleteDuplicates() {
    if (!api || !duplicateSelection.length) return;
    const selected = duplicateSelection.map(id => customSets.find(set => set.id === id)).filter(Boolean);
    const confirmed = window.confirm(`Excluir ${selected.length} armadura(s) duplicada(s)? O primeiro registro de cada grupo será preservado automaticamente.`);
    if (!confirmed) return;
    setDuplicateBusy(true); setDuplicateNotice('');
    try {
      const result = await api.deleteCustomSets(duplicateSelection);
      if (!result?.success) throw new Error(result?.error || 'Não foi possível apagar as duplicatas.');
      setDuplicateSelection([]);
      setDuplicateNotice(`${result.deleted?.length || selected.length} duplicata(s) removida(s).`);
      await onAtualizar();
    } catch (e) {
      setDuplicateNotice(`Erro ao apagar duplicatas: ${e.message}`);
    } finally {
      setDuplicateBusy(false);
    }
  }

  const addPiece = () => {
    const existing = pieces.map(p=>p.piece_type);
    const next = PIECE_TYPES.find(t=>!existing.includes(t))||'Torso';
    setPieces([...pieces, emptyPiece(next)]);
  };

  const sf = (k,v) => setsetData(p=>({...p,[k]:v}));
  const IS = { width:'100%',padding:'8px 12px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:14,outline:'none' };
  const LS = { fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 };

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">ARMADURAS PERSONALIZADAS</div>
          <div className="page-subtitle">Cadastre armaduras que não estão no banco de dados</div>
        </div>
        {!showForm&&(
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={()=>setShowImport(v=>!v)} style={{
              display:'flex',alignItems:'center',gap:8,padding:'10px 20px',
              background: showImport?'rgba(56,189,248,0.15)':'rgba(56,189,248,0.08)',border:'1px solid rgba(56,189,248,0.35)',
              borderRadius:8,color:'var(--accent-primary)',fontFamily:'"Exo 2",sans-serif',
              fontSize:14,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',cursor:'pointer',
            }}>
              <Download size={16}/> Importar da UEX
            </button>
            <button onClick={startNew} style={{
              display:'flex',alignItems:'center',gap:8,padding:'10px 20px',
              background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.35)',
              borderRadius:8,color:'var(--accent-green)',fontFamily:'"Exo 2",sans-serif',
              fontSize:14,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',cursor:'pointer',
            }}>
              <Plus size={16}/> Nova Armadura
            </button>
          </div>
        )}
      </div>

      <div className="page-body">
        {showImport&&!showForm&&(
          <UexImportPanel sets={sets} onAtualizar={onAtualizar} onClose={()=>setShowImport(false)}/>
        )}
        {showForm&&(
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:10,padding:'24px',marginBottom:24 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
              <h3 style={{ fontFamily:'Michroma,sans-serif',fontSize:15,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.08em' }}>
                {editingId?'EDITAR ARMADURA':'NOVA ARMADURA'}
              </h3>
              <button onClick={()=>setShowForm(false)} style={{ background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'5px 8px',display:'flex',alignItems:'center' }}>
                <X size={14}/>
              </button>
            </div>

            {/* Set fields */}
            <div style={{ marginBottom:20 }}>
              <div className="modal-section-title">Informações do Set</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12 }}>
                <div><label style={LS}>Nome Base *</label><input style={IS} value={setData.base_name} onChange={e=>sf('base_name',e.target.value)} placeholder="ex: Citadel"/></div>
                <div><label style={LS}>Variante</label><input style={IS} value={setData.variant_name} onChange={e=>sf('variant_name',e.target.value)} placeholder="ex: Base, Brimstone, Desert..."/></div>
                <div><label style={LS}>Fabricante *</label><input style={IS} value={setData.manufacturer} onChange={e=>sf('manufacturer',e.target.value)} placeholder="ex: Clark Defense Systems"/></div>
                <div><label style={LS}>Categoria</label><input style={IS} value={setData.category} onChange={e=>sf('category',e.target.value)} placeholder="ex: Combat, Recon, Environmental..."/></div>
                <div>
                  <label style={LS}>Tipo</label>
                  <select className="filter-select" style={{ width:'100%' }} value={setData.type} onChange={e=>sf('type',e.target.value)}>
                    {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LS}>Raridade</label>
                  <select className="filter-select" style={{ width:'100%' }} value={setData.rarity} onChange={e=>sf('rarity',e.target.value)}>
                    {RARITIES.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div><label style={LS}>Versão do Jogo</label><input style={IS} value={setData.added_version} onChange={e=>sf('added_version',e.target.value)} placeholder="ex: 4.0"/></div>
                <div><label style={LS}>Tags (vírgula)</label><input style={IS} value={setData.tags.join(', ')} onChange={e=>sf('tags',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} placeholder="ex: Heavy, Loot, EVA"/></div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={LS}>Descrição</label>
                <textarea className="notes-textarea" value={setData.description} onChange={e=>sf('description',e.target.value)} placeholder="Descrição do set..." style={{ marginTop:0,minHeight:70,fontSize:13 }}/>
              </div>
            </div>

            {/* Pieces */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
                <div className="modal-section-title" style={{ marginBottom:0 }}>Peças ({pieces.length})</div>
                <button onClick={addPiece} style={{
                  display:'flex',alignItems:'center',gap:6,padding:'6px 12px',
                  background:'rgba(56,189,248,0.08)',border:'1px solid var(--border-normal)',
                  borderRadius:5,color:'var(--accent-primary)',fontFamily:'"Exo 2",sans-serif',
                  fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.06em',
                }}>
                  <Plus size={13}/> Adicionar Peça
                </button>
              </div>
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {pieces.map((p,i)=>(
                  <PieceForm key={i} piece={p} index={i}
                    onChange={updated=>{const a=[...pieces];a[i]=updated;setPieces(a);}}
                    onRemove={()=>setPieces(pieces.filter((_,j)=>j!==i))}
                    canRemove={pieces.length>1}/>
                ))}
              </div>
            </div>

            {error&&(
              <div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.25)',borderRadius:6,marginBottom:12,color:'var(--accent-red)',fontSize:13 }}>
                <AlertTriangle size={14}/> {error}
              </div>
            )}

            <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
              <button onClick={()=>setShowForm(false)} style={{ padding:'10px 20px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.08em' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{
                display:'flex',alignItems:'center',gap:8,padding:'10px 24px',
                background:'rgba(52,211,153,0.12)',border:'1px solid rgba(52,211,153,0.4)',
                borderRadius:6,color:'var(--accent-green)',fontFamily:'"Exo 2",sans-serif',
                fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                letterSpacing:'0.08em',textTransform:'uppercase',opacity:saving?0.6:1,
              }}>
                <Save size={14}/>{saving?'Salvando...':editingId?'Atualizar':'Cadastrar'}
              </button>
            </div>
          </div>
        )}

        {!showForm&&(
          <>
            {duplicateGroups.length > 0 && (
              <div style={{ marginBottom:18, padding:'14px 16px', background:'rgba(251,113,133,0.06)', border:'1px solid rgba(251,113,133,0.28)', borderRadius:9 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:8 }}>
                  <div>
                    <div style={{ color:'var(--accent-red)', fontSize:11, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase' }}>Duplicatas detectadas</div>
                    <div style={{ color:'var(--text-muted)', fontSize:11, marginTop:3 }}>{duplicateGroups.length} grupo{duplicateGroups.length === 1 ? '' : 's'} repetido{duplicateGroups.length === 1 ? '' : 's'} · {duplicateCount} registros. O primeiro registro de cada grupo fica preservado.</div>
                  </div>
                  <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                    <button onClick={selectAllDuplicateExtras} disabled={duplicateBusy} style={{ padding:'6px 9px', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.28)', borderRadius:5, color:'var(--accent-gold)', cursor:'pointer', fontSize:10, fontWeight:700 }}>Selecionar excedentes</button>
                    <button onClick={handleDeleteDuplicates} disabled={duplicateBusy || !duplicateSelection.length} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 9px', background:'rgba(251,113,133,0.13)', border:'1px solid rgba(251,113,133,0.38)', borderRadius:5, color:'var(--accent-red)', cursor:duplicateBusy || !duplicateSelection.length ? 'not-allowed' : 'pointer', opacity:duplicateBusy || !duplicateSelection.length ? 0.5 : 1, fontSize:10, fontWeight:800 }}><Trash2 size={11}/> {duplicateBusy ? 'Apagando...' : `Apagar selecionadas (${duplicateSelection.length})`}</button>
                  </div>
                </div>
                {duplicateNotice && <div style={{ marginBottom:8, color:duplicateNotice.startsWith('Erro') ? 'var(--accent-red)' : 'var(--accent-green)', fontSize:11 }}>{duplicateNotice}</div>}
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {duplicateGroups.map(group => (
                    <div key={group.key} style={{ padding:'8px 10px', background:'rgba(0,0,0,0.12)', border:'1px solid rgba(251,113,133,0.16)', borderRadius:6 }}>
                      <div style={{ color:'var(--text-secondary)', fontSize:11, fontWeight:800, marginBottom:5 }}>{group.label} · {group.entries.length} registros</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {group.entries.map((entry, index) => (
                          <label key={entry.id} style={{ display:'flex', alignItems:'center', gap:7, color:'var(--text-muted)', fontSize:10, cursor:index === 0 ? 'not-allowed' : 'pointer', opacity:index === 0 ? 0.6 : 1 }}>
                            <input type="checkbox" checked={index === 0 ? false : duplicateSelection.includes(entry.id)} disabled={index === 0 || duplicateBusy} onChange={() => toggleDuplicate(entry.id)} />
                            <span style={{ flex:1 }}>{index === 0 ? 'Preservar' : 'Duplicata'} · ID {entry.id} · {entry.manufacturer || 'Fabricante não informado'}</span>
                            {index === 0 && <strong style={{ color:'var(--accent-green)', fontSize:9 }}>MANTER</strong>}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {customSets.length===0 ? (
            <div className="empty-state">
              <Shield size={64} className="empty-state-icon"/>
              <div className="empty-state-title">NENHUMA ARMADURA PERSONALIZADA</div>
              <div className="empty-state-text">Clique em "Nova Armadura" para cadastrar uma armadura que não está no banco de dados.</div>
              <button onClick={startNew} style={{ display:'flex',alignItems:'center',gap:8,padding:'12px 24px',background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.35)',borderRadius:8,color:'var(--accent-green)',fontFamily:'"Exo 2",sans-serif',fontSize:14,fontWeight:700,cursor:'pointer',letterSpacing:'0.08em',textTransform:'uppercase',marginTop:8 }}>
                <Plus size={16}/> Nova Armadura
              </button>
            </div>
          ) : (
            <div>
              <div className="section-divider">
                <span className="section-divider-label" style={{ color:'var(--text-secondary)' }}>
                  {customSets.length} armadura{customSets.length!==1?'s':''} personalizada{customSets.length!==1?'s':''}
                </span>
                <div className="section-divider-line"/>
              </div>
              <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                {customSets.map(set=>{
                  const pieces=set.pieces||[];
                  const owned=pieces.filter(p=>p.owned).length;
                  const typeClass=`type-${set.type?.toLowerCase()}`;
                  const isVariante=set.variant_name&&set.variant_name!=='Base';
                  return (
                    <div key={set.id} style={{
                      background:'var(--bg-card)',border:'1px solid var(--border-subtle)',
                      borderRadius:10,padding:'16px 20px',display:'flex',alignItems:'center',gap:16,
                    }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border-normal)'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border-subtle)'}
                    >
                      <div className={`armor-icon-placeholder ${typeClass}`} style={{ width:44,height:44,flexShrink:0 }}>
                        <div className="armor-icon-ring"/>
                        <div className="armor-icon-inner" style={{ width:30,height:30 }}><Shield size={16}/></div>
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap' }}>
                          <span style={{ fontFamily:'Michroma,sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{set.base_name}</span>
                          {isVariante&&<span style={{ fontSize:11,fontWeight:700,color:`var(--type-${set.type?.toLowerCase()})` }}>{set.variant_name}</span>}
                          <span className={`armor-type-badge badge-${set.type?.toLowerCase()}`}>{set.type}</span>
                          <span className={`rarity-badge rarity-${set.rarity}`}>{set.rarity}</span>
                          <span style={{ fontSize:10,background:'rgba(56,189,248,0.08)',border:'1px solid var(--border-subtle)',borderRadius:3,padding:'1px 6px',color:'var(--accent-primary)',fontWeight:700,letterSpacing:'0.08em' }}>CUSTOM</span>
                        </div>
                        <div style={{ fontSize:12,color:'var(--text-muted)' }}>
                          {set.manufacturer} · {set.category} · {pieces.length} peça{pieces.length!==1?'s':''}
                          <span style={{ marginLeft:12,color:owned>0?'var(--accent-green)':'var(--text-muted)',fontFamily:'Share Tech Mono,monospace' }}>{owned}/{pieces.length} obtidas</span>
                        </div>
                        {set.description&&<div style={{ fontSize:12,color:'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:500,marginTop:2 }}>{set.description}</div>}
                      </div>
                      <div style={{ display:'flex',gap:8,flexShrink:0 }}>
                        <button onClick={()=>startEdit(set)} style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 12px',background:'rgba(56,189,248,0.08)',border:'1px solid var(--border-normal)',borderRadius:6,color:'var(--accent-primary)',cursor:'pointer',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase' }}>
                          <Edit3 size={12}/> Editar
                        </button>
                        {deleteConfirm===set.id?(
                          <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                            <span style={{ fontSize:11,color:'var(--accent-red)' }}>Confirmar?</span>
                            <button onClick={()=>handleDelete(set.id)} style={{ padding:'6px 10px',background:'rgba(251,113,133,0.15)',border:'1px solid rgba(251,113,133,0.4)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer',fontSize:12,fontWeight:700 }}>Sim</button>
                            <button onClick={()=>setDeleteConfirm(null)} style={{ padding:'6px 10px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',fontSize:12 }}>Não</button>
                          </div>
                        ):(
                          <button onClick={()=>setDeleteConfirm(set.id)} style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 10px',background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.2)',borderRadius:6,color:'var(--accent-red)',cursor:'pointer' }}>
                            <Trash2 size={13}/>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
