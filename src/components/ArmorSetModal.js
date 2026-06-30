import React, { useState } from 'react';
import {
  X, Shield, CheckCircle2, Star, MapPin, HardHat,
  Shirt, Dumbbell, Footprints, Backpack, Tag,
  Zap, Thermometer, FlaskConical, Eye, Activity
} from 'lucide-react';
import { ProvenanceBadge } from './ProvenanceBadge';

const PIECE_ICONS = { Helmet:HardHat, Torso:Shirt, Arms:Dumbbell, Legs:Footprints, Backpack:Backpack };
const PIECE_ORDER = ['Helmet','Torso','Arms','Legs','Backpack'];
const PIECE_PT    = { Helmet:'Capacete', Torso:'Torso', Arms:'Braços', Legs:'Pernas', Backpack:'Mochila' };
const TYPE_LABELS = { Light:'LEVE', Médio:'MÉDIO', Heavy:'PESADO', Special:'ESPECIAL' };

function ResBar({ label, value, color, Icon }) {
  const pct = Math.min(((value||0)/50)*100, 100);
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:3,alignItems:'center' }}>
        <span style={{ display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.06em' }}>
          {Icon && <Icon size={11} />}{label}
        </span>
        <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:12,color:'var(--text-primary)' }}>{value||0}</span>
      </div>
      <div style={{ height:4,background:'var(--border-subtle)',borderRadius:2,overflow:'hidden' }}>
        <div style={{ height:'100%',width:`${pct}%`,background:color,borderRadius:2,transition:'width 0.5s' }} />
      </div>
    </div>
  );
}

function PieceCard({ piece, onToggleOwned, onToggleWishlist, onUpdateNotes, isExpanded, onToggleExpand }) {
  const [editNotas, setEditNotas] = useState(false);
  const [notes,     setNotas]     = useState(piece.notes||'');
  const [saved,     setSaved]     = useState(false);
  const Icon = PIECE_ICONS[piece.piece_type]||Shield;

  const handleSave = async () => {
    await onUpdateNotes(piece.id, notes);
    setSaved(true);
    setTimeout(()=>{ setSaved(false); setEditNotas(false); }, 1500);
  };

  return (
    <div style={{
      border:`1px solid ${piece.owned?'rgba(0,229,160,0.35)':isExpanded?'var(--border-bright)':'var(--border-subtle)'}`,
      borderRadius:8, overflow:'hidden',
      background:piece.owned?'rgba(0,229,160,0.04)':'var(--bg-panel)',
      transition:'all 0.2s',
    }}>
      {/* Row header */}
      <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer' }}
        onClick={onToggleExpand}>
        <div style={{
          width:34,height:34,borderRadius:7,flexShrink:0,
          display:'flex',alignItems:'center',justifyContent:'center',
          background:piece.owned?'rgba(0,229,160,0.12)':'rgba(255,255,255,0.04)',
          border:`1px solid ${piece.owned?'rgba(0,229,160,0.3)':'var(--border-subtle)'}`,
          color:piece.owned?'var(--accent-green)':'var(--text-secondary)',
        }}>
          {piece.owned ? <CheckCircle2 size={17} /> : <Icon size={17} />}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.05em' }}>
            {PIECE_PT[piece.piece_type]||piece.piece_type}
          </div>
          <div style={{ fontSize:10,color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
            {piece.piece_name}
          </div>
        </div>
        <div style={{ display:'flex',gap:6,alignItems:'center',flexShrink:0 }}>
          {piece.price_auec>0 && (
            <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:10,color:'var(--accent-gold)' }}>
              {piece.price_auec.toLocaleString()} aUEC
            </span>
          )}
          {piece.is_lootable && !piece.is_purchasable && (
            <span style={{ fontSize:9,color:'var(--accent-purple)',fontWeight:700,background:'rgba(180,76,255,0.1)',border:'1px solid rgba(180,76,255,0.25)',padding:'1px 5px',borderRadius:3 }}>LOOT</span>
          )}
          <div style={{ width:6,height:6,borderRadius:'50%',background:piece.owned?'var(--accent-green)':piece.wishlist?'var(--accent-gold)':'var(--text-muted)' }} />
        </div>
      </div>

      {/* Expandired */}
      {isExpanded && (
        <div style={{ padding:'14px',borderTop:'1px solid var(--border-subtle)' }}>
          <p style={{ fontSize:12,color:'var(--text-secondary)',lineHeight:1.6,marginBottom:12 }}>{piece.description}</p>

          {piece.piece_type !== 'Backpack' && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:8 }}>Resistências</div>
              <ResBar label="Física"       value={piece.resistance_physical}    color="linear-gradient(to right,#ff6b6b,#ff4466)" Icon={Shield} />
              <ResBar label="Energia"      value={piece.resistance_energy}      color="linear-gradient(to right,#4ecdc4,#00d4ff)" Icon={Zap} />
              <ResBar label="Térmica"      value={piece.resistance_thermal}     color="linear-gradient(to right,#f7dc6f,#ffc436)" Icon={Thermometer} />
              <ResBar label="Distorção"    value={piece.resistance_distortion}  color="linear-gradient(to right,#a29bfe,#b44cff)" Icon={Activity} />
              <ResBar label="Bioquímica"   value={piece.resistance_biochemical} color="linear-gradient(to right,#55efc4,#00e5a0)" Icon={FlaskConical} />
              <ResBar label="Atordoamento" value={piece.resistance_stun}        color="linear-gradient(to right,#74b9ff,#0077ff)" Icon={Eye} />
              <div style={{ marginTop:6,fontSize:11,color:'var(--text-muted)' }}>
                Penalidade Mobilidade: <span style={{ color:piece.mobility_penalty>20?'var(--accent-red)':'var(--text-secondary)' }}>-{piece.mobility_penalty||0}%</span>
                {piece.slots>0 && <span style={{ marginLeft:12 }}>Slots: {piece.slots}</span>}
              </div>
            </div>
          )}
          {piece.piece_type === 'Backpack' && piece.slots>0 && (
            <div style={{ marginBottom:14,fontSize:12,color:'var(--text-secondary)' }}>
              <strong>Slots de armazenamento:</strong> {piece.slots}
            </div>
          )}

          {/* How to get */}
          <div style={{ background:'rgba(0,119,255,0.06)',border:'1px solid rgba(0,119,255,0.15)',borderRadius:6,padding:'10px 12px',marginBottom:12 }}>
            <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:6 }}>
              <MapPin size={12} style={{ color:'var(--accent-primary)',flexShrink:0 }} />
              <span style={{ fontSize:10,fontWeight:700,color:'var(--accent-primary)',textTransform:'uppercase',letterSpacing:'0.1em' }}>Como obter</span>
            </div>
            <p style={{ fontSize:12,color:'var(--text-secondary)',lineHeight:1.6,margin:0 }}>{piece.how_to_get||'informação não disponível.'}</p>
            {piece.buy_location && (
              <div style={{ marginTop:6,fontSize:10,color:'var(--text-muted)',display:'flex',gap:4 }}>
                <MapPin size={9} style={{ marginTop:1,flexShrink:0 }} />{piece.buy_location}
              </div>
            )}
          </div>

          {/* Notas */}
          {editNotas ? (
            <div>
              <textarea className="notes-textarea" value={notes} onChange={e=>setNotas(e.target.value)}
                placeholder="Anotações sobre esta peça..." style={{ fontSize:12,minHeight:60 }} />
              <button className="save-btn" onClick={handleSave} style={{ fontSize:12,padding:'6px 12px' }}>
                {saved?'✓ Salvo!':'Salvar'}
              </button>
            </div>
          ) : piece.notes ? (
            <div style={{ fontSize:12,color:'var(--text-muted)',fontStyle:'italic',marginBottom:8 }}>
              📝 {piece.notes}
              <button onClick={()=>setEditNotas(true)} style={{ marginLeft:8,background:'none',border:'none',color:'var(--accent-primary)',cursor:'pointer',fontSize:11 }}>editar</button>
            </div>
          ) : null}

          {/* Actions */}
          <div style={{ display:'flex',gap:8,marginTop:8 }}>
            <button className={`action-btn action-btn-owned ${piece.owned?'active':''}`}
              style={{ flex:1,padding:'8px' }} onClick={()=>onToggleOwned(piece.id)}>
              <CheckCircle2 size={13} />{piece.owned?'Tenho':'Marcar'}
            </button>
            <button className={`action-btn action-btn-wishlist ${piece.wishlist?'active':''}`}
              style={{ flex:1,padding:'8px' }} onClick={()=>onToggleWishlist(piece.id)}>
              <Star size={13} />{piece.wishlist?'Na Lista':'Desejos'}
            </button>
            {!editNotas && (
              <button className="action-btn" onClick={()=>setEditNotas(true)}
                style={{ padding:'8px 10px',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',color:'var(--text-secondary)' }}>
                📝
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArmorSetModal({ set, sets, onClose, onTogglePiece, onTogglePieceWishlist, onUpdatePieceNotas }) {
  const [openPiece, setAbrirPiece] = useState(null);

  const liveSet = sets.find(s=>s.id===set.id)||set;
  const pieces  = liveSet.pieces||[];
  const sorted  = [...pieces].sort((a,b)=>{
    const ao=PIECE_ORDER.indexOf(a.piece_type), bo=PIECE_ORDER.indexOf(b.piece_type);
    return (ao===-1?99:ao)-(bo===-1?99:bo);
  });

  const owned      = pieces.filter(p=>p.owned).length;
  const total      = pieces.length;
  const isComplete = owned===total && total>0;
  const pct        = total>0?Math.round((owned/total)*100):0;
  const typeClass  = `type-${liveSet.type?.toLowerCase()}`;
  const badgeClass = `badge-${liveSet.type?.toLowerCase()}`;
  const isVariante  = liveSet.variant_name && liveSet.variant_name!=='Base';

  const tags = (() => { try { return JSON.parse(liveSet.tags||'[]'); } catch { return []; } })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth:860 }} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header" style={{ background:'var(--bg-panel)' }}>
          <div style={{ display:'flex',alignItems:'center',gap:16 }}>
            <div className={`armor-icon-placeholder ${typeClass}`} style={{ width:52,height:52,flexShrink:0 }}>
              <div className="armor-icon-ring" />
              <div className="armor-icon-inner" style={{ width:36,height:36 }}>
                {isComplete?<CheckCircle2 size={20}/>:<Shield size={20}/>}
              </div>
            </div>
            <div>
              <div style={{ display:'flex',alignItems:'center',gap:10,flexWrap:'wrap' }}>
                <h2 className="modal-title">{liveSet.base_name}</h2>
                {isVariante && (
                  <span style={{
                    fontFamily:'Rajdhani,sans-serif',fontSize:14,fontWeight:700,
                    color:`var(--type-${liveSet.type?.toLowerCase()})`,
                    background:`rgba(var(--type-${liveSet.type?.toLowerCase()}),0.08)`,
                    border:`1px solid rgba(var(--type-${liveSet.type?.toLowerCase()}),0.25)`,
                    padding:'2px 10px',borderRadius:4,
                  }}>{liveSet.variant_name}</span>
                )}
                <span className={`armor-type-badge ${badgeClass}`}>{TYPE_LABELS[liveSet.type]||liveSet.type}</span>
                <span className={`rarity-badge rarity-${liveSet.rarity}`}>{liveSet.rarity}</span>
                {isComplete && (
                  <span style={{ background:'rgba(0,229,160,0.15)',border:'1px solid rgba(0,229,160,0.4)',borderRadius:4,padding:'2px 8px',fontSize:10,fontWeight:700,color:'var(--accent-green)',letterSpacing:'0.12em' }}>
                    ✓ COMPLETO
                  </span>
                )}
              </div>
              <div className="modal-manufacturer">{liveSet.manufacturer} · {liveSet.category}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16}/></button>
        </div>

        <div style={{ padding:'20px 28px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:24 }}>
          {/* Left: set info */}
          <div>
            <div className="modal-section-title">Sobre este Set</div>
            <p style={{ fontSize:13,color:'var(--text-secondary)',lineHeight:1.6,marginBottom:12 }}>{liveSet.description}</p>
            {liveSet.lore && (
              <p style={{ fontSize:12,color:'var(--text-muted)',fontStyle:'italic',borderLeft:'2px solid var(--border-normal)',paddingLeft:10,lineHeight:1.6,marginBottom:12 }}>
                "{liveSet.lore}"
              </p>
            )}

            {/* Progresso */}
            <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'14px',marginBottom:14 }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                <span style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em' }}>Progressoo</span>
                <span style={{ fontFamily:'Orbitron,monospace',fontSize:16,fontWeight:800,color:isComplete?'var(--accent-green)':'var(--accent-primary)' }}>
                  {owned}/{total}
                </span>
              </div>
              <div style={{ height:6,background:'var(--border-subtle)',borderRadius:3,overflow:'hidden' }}>
                <div style={{
                  height:'100%',width:`${pct}%`,
                  background:isComplete?'linear-gradient(to right,#00b37d,var(--accent-green))':'linear-gradient(to right,var(--accent-secondary),var(--accent-primary))',
                  borderRadius:3,transition:'width 0.6s ease',
                  boxShadow:isComplete?'0 0 10px rgba(0,229,160,0.4)':'none',
                }} />
              </div>
            </div>

            {tags.length>0 && (
              <div style={{ marginBottom:12 }}>
                <div className="modal-section-title"><Tag size={11}/> Tags</div>
                <div className="modal-tags">{tags.map(t=><span key={t} className="tag">{t}</span>)}</div>
              </div>
            )}

            {/* Quick mark all */}
            <button
              className={`action-btn action-btn-owned ${isComplete?'active':''}`}
              style={{ width:'100%',padding:'10px',marginTop:4 }}
              onClick={() => {
                const missing = pieces.filter(p=>!p.owned);
                (missing.length>0 ? missing : pieces).forEach(p=>onTogglePiece(p.id));
              }}
            >
              <CheckCircle2 size={14} />
              {isComplete?'Desmarcar Todas as Peças':'Marcar Todas as Peças'}
            </button>
          </div>

          {/* Right: pieces */}
          <div>
            <div className="modal-section-title">
              Peças ({owned}/{total} obtidas)
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {sorted.map(p => (
                <PieceCard
                  key={p.id}
                  piece={pieces.find(lp=>lp.id===p.id)||p}
                  onToggleOwned={onTogglePiece}
                  onToggleWishlist={onTogglePieceWishlist}
                  onUpdateNotes={onUpdatePieceNotas}
                  isExpanded={openPiece===p.id}
                  onToggleExpand={()=>setAbrirPiece(openPiece===p.id?null:p.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
