import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Save, X, Shield, HardHat, Shirt, Dumbbell, Footprints, Backpack, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { setProvenance, SOURCES } from '../data/provenance';

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
      <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',background:'rgba(0,212,255,0.03)' }}
        onClick={()=>setAbrir(!open)}>
        <Icon size={16} style={{ color:'var(--accent-primary)',flexShrink:0 }} />
        <span style={{ fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,color:'var(--text-primary)',flex:1 }}>
          {PIECE_PT[piece.piece_type]||piece.piece_type}
          {piece.piece_name&&<span style={{ color:'var(--text-secondary)',fontWeight:400,marginLeft:8,fontFamily:'Rajdhani,sans-serif' }}>— {piece.piece_name}</span>}
        </span>
        {canRemove&&(
          <button onClick={e=>{e.stopPropagation();onRemove();}}
            style={{ background:'rgba(255,68,102,0.1)',border:'1px solid rgba(255,68,102,0.25)',borderRadius:4,color:'var(--accent-red)',cursor:'pointer',padding:'3px 6px',display:'flex',alignItems:'center' }}>
            <Trash2 size={12}/>
          </button>
        )}
        {open?<ChevronUp size={14} style={{ color:'var(--text-muted)' }}/>:<ChevronDown size={14} style={{ color:'var(--text-muted)' }}/>}
      </div>

      {open&&(
        <div style={{ padding:'14px',display:'flex',flexDirection:'column',gap:12 }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
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
              <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8 }}>
                <NumInput label="Física"       name="resistance_physical"    value={piece.resistance_physical}    onChange={set}/>
                <NumInput label="Energia"      name="resistance_energy"      value={piece.resistance_energy}      onChange={set}/>
                <NumInput label="Distorção"    name="resistance_distortion"  value={piece.resistance_distortion}  onChange={set}/>
                <NumInput label="Térmica"      name="resistance_thermal"     value={piece.resistance_thermal}     onChange={set}/>
                <NumInput label="Bioquímica"   name="resistance_biochemical" value={piece.resistance_biochemical} onChange={set}/>
                <NumInput label="Atordoamento" name="resistance_stun"        value={piece.resistance_stun}        onChange={set}/>
              </div>
            </div>
          )}

          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10 }}>
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

export default function CustomArmorPage({ sets, onAtualizar }) {
  const [showForm,     setShowForm]     = useState(false);
  const [editingId,    setEditingId]    = useState(null);
  const [setDate,      setsetDate]      = useState(emptySet());
  const [pieces,       setPieces]       = useState([emptyPiece('Helmet'),emptyPiece('Torso'),emptyPiece('Arms'),emptyPiece('Legs')]);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [deleteConfirm,setDeleteConfirm]= useState(null);

  const customSets = sets.filter(s=>s.is_custom);
  const api = window.electronAPI;

  function startNew() {
    setEditingId(null); setsetDate(emptySet());
    setPieces([emptyPiece('Helmet'),emptyPiece('Torso'),emptyPiece('Arms'),emptyPiece('Legs')]);
    setError(''); setShowForm(true);
  }

  function startEdit(set) {
    setEditingId(set.id);
    setsetDate({
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
    if (!setDate.base_name.trim()) { setError('Nome do set é obrigatório.'); return; }
    if (!setDate.manufacturer.trim()) { setError('Fabricante é obrigatório.'); return; }
    if (pieces.length===0) { setError('Adicione ao menos uma peça.'); return; }
    setSaving(true); setError('');
    try {
      if (editingId) {
        await api.updateCustomSet(editingId, setDate);
        setProvenance('armor', setDate.base_name, SOURCES.CUSTOM);
        for (const p of pieces) {
          if (p.id) await api.updateCustomPiece(p.id, p);
          else      await api.addPieceToSet(editingId, p);
        }
      } else {
        await api.createCustomSet({ set:setDate, pieces });
        setProvenance('armor', setDate.base_name, SOURCES.CUSTOM);
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

  const addPiece = () => {
    const existing = pieces.map(p=>p.piece_type);
    const next = PIECE_TYPES.find(t=>!existing.includes(t))||'Torso';
    setPieces([...pieces, emptyPiece(next)]);
  };

  const sf = (k,v) => setsetDate(p=>({...p,[k]:v}));
  const IS = { width:'100%',padding:'8px 12px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:14,outline:'none' };
  const LS = { fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:4 };

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">ARMADURAS PERSONALIZADAS</div>
          <div className="page-subtitle">Cadastre armaduras que não estão no banco de dados</div>
        </div>
        {!showForm&&(
          <button onClick={startNew} style={{
            display:'flex',alignItems:'center',gap:8,padding:'10px 20px',
            background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.35)',
            borderRadius:8,color:'var(--accent-green)',fontFamily:'Rajdhani,sans-serif',
            fontSize:14,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',cursor:'pointer',
          }}>
            <Plus size={16}/> Nova Armadura
          </button>
        )}
      </div>

      <div className="page-body">
        {showForm&&(
          <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:10,padding:'24px',marginBottom:24 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
              <h3 style={{ fontFamily:'Orbitron,monospace',fontSize:15,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.08em' }}>
                {editingId?'EDITAR ARMADURA':'NOVA ARMADURA'}
              </h3>
              <button onClick={()=>setShowForm(false)} style={{ background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'5px 8px',display:'flex',alignItems:'center' }}>
                <X size={14}/>
              </button>
            </div>

            {/* Set fields */}
            <div style={{ marginBottom:20 }}>
              <div className="modal-section-title">Info rmações do Set</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12 }}>
                <div><label style={LS}>Nome Base *</label><input style={IS} value={setDate.base_name} onChange={e=>sf('base_name',e.target.value)} placeholder="ex: Citadel"/></div>
                <div><label style={LS}>Variantee</label><input style={IS} value={setDate.variant_name} onChange={e=>sf('variant_name',e.target.value)} placeholder="ex: Base, Brimstone, Desert..."/></div>
                <div><label style={LS}>Fabricante *</label><input style={IS} value={setDate.manufacturer} onChange={e=>sf('manufacturer',e.target.value)} placeholder="ex: Clark Defense Sistemas"/></div>
                <div><label style={LS}>Categoria</label><input style={IS} value={setDate.category} onChange={e=>sf('category',e.target.value)} placeholder="ex: Combat, Recon, Environmental..."/></div>
                <div>
                  <label style={LS}>Tipo</label>
                  <select className="filter-select" style={{ width:'100%' }} value={setDate.type} onChange={e=>sf('type',e.target.value)}>
                    {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LS}>Raridade</label>
                  <select className="filter-select" style={{ width:'100%' }} value={setDate.rarity} onChange={e=>sf('rarity',e.target.value)}>
                    {RARITIES.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div><label style={LS}>Versão do Jogo</label><input style={IS} value={setDate.added_version} onChange={e=>sf('added_version',e.target.value)} placeholder="ex: 4.0"/></div>
                <div><label style={LS}>Tags (vírgula)</label><input style={IS} value={setDate.tags.join(', ')} onChange={e=>sf('tags',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} placeholder="ex: Heavy, Loot, EVA"/></div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={LS}>Descrição</label>
                <textarea className="notes-textarea" value={setDate.description} onChange={e=>sf('description',e.target.value)} placeholder="Descrição do set..." style={{ marginTop:0,minHeight:70,fontSize:13 }}/>
              </div>
            </div>

            {/* Pieces */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
                <div className="modal-section-title" style={{ marginBottom:0 }}>Peças ({pieces.length})</div>
                <button onClick={addPiece} style={{
                  display:'flex',alignItems:'center',gap:6,padding:'6px 12px',
                  background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-normal)',
                  borderRadius:5,color:'var(--accent-primary)',fontFamily:'Rajdhani,sans-serif',
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
              <div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.25)',borderRadius:6,marginBottom:12,color:'var(--accent-red)',fontSize:13 }}>
                <AlertTriangle size={14}/> {error}
              </div>
            )}

            <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
              <button onClick={()=>setShowForm(false)} style={{ padding:'10px 20px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.08em' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{
                display:'flex',alignItems:'center',gap:8,padding:'10px 24px',
                background:'rgba(0,229,160,0.12)',border:'1px solid rgba(0,229,160,0.4)',
                borderRadius:6,color:'var(--accent-green)',fontFamily:'Rajdhani,sans-serif',
                fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                letterSpacing:'0.08em',textTransform:'uppercase',opacity:saving?0.6:1,
              }}>
                <Save size={14}/>{saving?'Salvando...':editingId?'Atualizar':'Cadastrar'}
              </button>
            </div>
          </div>
        )}

        {!showForm&&(
          customSets.length===0 ? (
            <div className="empty-state">
              <Shield size={64} className="empty-state-icon"/>
              <div className="empty-state-title">NENHUMA ARMADURA PERSONALIZADA</div>
              <div className="empty-state-text">Clique em "Nova Armadura" para cadastrar uma armadura que não está no banco de dados.</div>
              <button onClick={startNew} style={{ display:'flex',alignItems:'center',gap:8,padding:'12px 24px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.35)',borderRadius:8,color:'var(--accent-green)',fontFamily:'Rajdhani,sans-serif',fontSize:14,fontWeight:700,cursor:'pointer',letterSpacing:'0.08em',textTransform:'uppercase',marginTop:8 }}>
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
                          <span style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{set.base_name}</span>
                          {isVariante&&<span style={{ fontSize:11,fontWeight:700,color:`var(--type-${set.type?.toLowerCase()})` }}>{set.variant_name}</span>}
                          <span className={`armor-type-badge badge-${set.type?.toLowerCase()}`}>{set.type}</span>
                          <span className={`rarity-badge rarity-${set.rarity}`}>{set.rarity}</span>
                          <span style={{ fontSize:10,background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-subtle)',borderRadius:3,padding:'1px 6px',color:'var(--accent-primary)',fontWeight:700,letterSpacing:'0.08em' }}>CUSTOM</span>
                        </div>
                        <div style={{ fontSize:12,color:'var(--text-muted)' }}>
                          {set.manufacturer} · {set.category} · {pieces.length} peça{pieces.length!==1?'s':''}
                          <span style={{ marginLeft:12,color:owned>0?'var(--accent-green)':'var(--text-muted)',fontFamily:'Share Tech Mono,monospace' }}>{owned}/{pieces.length} obtidas</span>
                        </div>
                        {set.description&&<div style={{ fontSize:12,color:'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:500,marginTop:2 }}>{set.description}</div>}
                      </div>
                      <div style={{ display:'flex',gap:8,flexShrink:0 }}>
                        <button onClick={()=>startEdit(set)} style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 12px',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-normal)',borderRadius:6,color:'var(--accent-primary)',cursor:'pointer',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase' }}>
                          <Edit3 size={12}/> Editar
                        </button>
                        {deleteConfirm===set.id?(
                          <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                            <span style={{ fontSize:11,color:'var(--accent-red)' }}>Confirmar?</span>
                            <button onClick={()=>handleDelete(set.id)} style={{ padding:'6px 10px',background:'rgba(255,68,102,0.15)',border:'1px solid rgba(255,68,102,0.4)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer',fontSize:12,fontWeight:700 }}>Sim</button>
                            <button onClick={()=>setDeleteConfirm(null)} style={{ padding:'6px 10px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',fontSize:12 }}>Não</button>
                          </div>
                        ):(
                          <button onClick={()=>setDeleteConfirm(set.id)} style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 10px',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:6,color:'var(--accent-red)',cursor:'pointer' }}>
                            <Trash2 size={13}/>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
