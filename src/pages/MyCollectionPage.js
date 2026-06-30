import React, { useState, useMemo } from 'react';
import { Package, Star, Search, Trophy, HardHat, Shirt, Dumbbell, Footprints, Backpack, Shield } from 'lucide-react';
import ArmorSetModal from '../components/ArmorSetModal';

const PIECE_ICONS   = { Helmet:HardHat, Torso:Shirt, Arms:Dumbbell, Legs:Footprints, Backpack:Backpack };
const PIECE_PT      = { Helmet:'Capacete', Torso:'Torso', Arms:'Braços', Legs:'Pernas', Backpack:'Mochila' };
const TYPE_COLORS   = { Light:'var(--type-light)', Médio:'var(--type-medium)', Heavy:'var(--type-heavy)', Special:'var(--type-special)' };
const TYPE_LABELS   = { Light:'Leve', Médio:'Médio', Heavy:'Pesado', Special:'Especial' };
const PIECE_ORDER   = ['Helmet','Torso','Arms','Legs','Backpack'];

function PieceRow({ piece, setNome, setTipo, variantNome, onToggle, onWishlist }) {
  const Icon = PIECE_ICONS[piece.piece_type]||Shield;
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
      background:piece.owned?'rgba(0,229,160,0.04)':'var(--bg-card)',
      border:`1px solid ${piece.owned?'rgba(0,229,160,0.2)':'var(--border-subtle)'}`,
      borderRadius:6,transition:'all 0.2s',
    }}>
      <div style={{ width:28,height:28,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',background:`${TYPE_COLORS[setTipo]}18`,color:TYPE_COLORS[setTipo],flexShrink:0 }}>
        <Icon size={14} />
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:12,fontWeight:700,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
          {setNome}{variantNome && variantNome!=='Base' ? <span style={{ color:'var(--text-muted)',fontWeight:400 }}> — {variantNome}</span> : ''} · {PIECE_PT[piece.piece_type]||piece.piece_type}
        </div>
        <div style={{ fontSize:10,color:'var(--text-muted)' }}>{piece.piece_name}</div>
      </div>
      {piece.is_lootable&&!piece.is_purchasable && (
        <span style={{ fontSize:9,color:'var(--accent-purple)',fontWeight:700,background:'rgba(180,76,255,0.1)',border:'1px solid rgba(180,76,255,0.2)',padding:'1px 5px',borderRadius:3,flexShrink:0 }}>LOOT</span>
      )}
      <div style={{ display:'flex',gap:5,flexShrink:0 }}>
        <button onClick={()=>onToggle(piece.id)} style={{ width:28,height:28,borderRadius:5,border:`1px solid ${piece.owned?'rgba(0,229,160,0.4)':'var(--border-subtle)'}`,background:piece.owned?'rgba(0,229,160,0.15)':'transparent',color:piece.owned?'var(--accent-green)':'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,transition:'all 0.2s' }}>✓</button>
        <button onClick={()=>onWishlist(piece.id)} style={{ width:28,height:28,borderRadius:5,border:`1px solid ${piece.wishlist?'rgba(255,196,54,0.4)':'var(--border-subtle)'}`,background:piece.wishlist?'rgba(255,196,54,0.12)':'transparent',color:piece.wishlist?'var(--accent-gold)':'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,transition:'all 0.2s' }}>★</button>
      </div>
    </div>
  );
}

export default function MyCollectionPage({ sets, stats, onTogglePiece, onTogglePieceWishlist, onupdatePieceNotes }) {
  const [activeTab,   setActiveTab]   = useState('sets');
  const [search,      setSearch]      = useState('');
  const [selectedSet, setSelectedSet] = useState(null);

  const setsWithPieces = useMemo(() =>
    sets.filter(s => (s.pieces||[]).some(p=>p.owned)),
  [sets]);

  const allObtidaPieces = useMemo(() => {
    const itens = [];
    sets.forEach(s=>(s.pieces||[]).forEach(p=>{ if(p.owned) itens.push({piece:p,set:s}); }));
    return itens.sort((a,b)=>new Date(b.piece.obtained_date||0)-new Date(a.piece.obtained_date||0));
  }, [sets]);

  const wishlistPieces = useMemo(() => {
    const itens = [];
    sets.forEach(s=>(s.pieces||[]).forEach(p=>{ if(p.wishlist&&!p.owned) itens.push({piece:p,set:s}); }));
    return itens;
  }, [sets]);

  const byTipo = useMemo(() =>
    ['Light','Médio','Heavy','Special'].map(type=>({
      type,
      total: sets.filter(s=>s.type===type).reduce((a,s)=>a+(s.pieces||[]).length,0),
      owned: sets.filter(s=>s.type===type).reduce((a,s)=>a+(s.pieces||[]).filter(p=>p.owned).length,0),
    })).filter(t=>t.total>0),
  [sets]);

  const q = search.toLowerCase();

  const filteredSetsWithPieces = useMemo(() =>
    setsWithPieces.filter(s=>
      !q || s.base_name?.toLowerCase().includes(q) ||
      s.variant_name?.toLowerCase().includes(q) ||
      s.manufacturer?.toLowerCase().includes(q)
    ),
  [setsWithPieces, q]);

  const filteredObtida = useMemo(() =>
    allObtidaPieces.filter(({piece,set})=>
      !q || set.base_name?.toLowerCase().includes(q) ||
      piece.piece_name?.toLowerCase().includes(q)
    ),
  [allObtidaPieces, q]);

  const filteredWishlist = useMemo(() =>
    wishlistPieces.filter(({piece,set})=>
      !q || set.base_name?.toLowerCase().includes(q) ||
      piece.piece_name?.toLowerCase().includes(q)
    ),
  [wishlistPieces, q]);

  const pct = stats&&stats.totalPieces>0 ? Math.round((stats.ownedPieces/stats.totalPieces)*100) : 0;

  const TABS = [
    { id:'sets',     label:'Sets com Peças', icon:Shield,  count:setsWithPieces.length },
    { id:'pieces',   label:'Todas as Peças', icon:Package, count:allObtidaPieces.length },
    { id:'wishlist', label:'wishlist',icon:Star,   count:wishlistPieces.length },
  ];

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">MINHA COLEÇÃO</div>
          <div className="page-subtitle">Acompanhe cada peça do seu arsenal</div>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:10,background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'10px 16px' }}>
          <Trophy size={18} style={{ color:'var(--accent-gold)' }} />
          <div>
            <div style={{ fontFamily:'Orbitron,monospace',fontSize:20,fontWeight:800,color:'var(--accent-gold)',lineHeight:1 }}>{pct}%</div>
            <div style={{ fontSize:10,color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em' }}>Peças</div>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
          {[
            {label:'Peças Obtidas',   value:stats?.ownedPieces||0,   color:'var(--accent-green)'},
            {label:'Sets Completos',  value:stats?.completeSets||0,   color:'var(--accent-gold)'},
            {label:'Sets Parciais',   value:setsWithPieces.filter(s=>{const p=s.pieces||[];return p.filter(x=>x.owned).length<p.length;}).length, color:'var(--accent-primary)'},
            {label:'wishlist',value:stats?.wishlistPieces||0, color:'var(--accent-gold)'},
          ].map(({label,value,color})=>(
            <div key={label} style={{ background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8,padding:'14px 16px',textAlign:'center' }}>
              <div style={{ fontFamily:'Orbitron,monospace',fontSize:24,fontWeight:800,color }}>{value}</div>
              <div style={{ fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginTop:2,fontWeight:600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Progresso by type */}
        <div style={{ marginBottom:20 }}>
          <div className="section-divider">
            <span className="section-divider-label" style={{ color:'var(--text-secondary)' }}>Peças por Tipo</span>
            <div className="section-divider-line" />
          </div>
          <div className="type-progress-grid">
            {byTipo.map(({type,total,owned})=>{
              const p=total>0?Math.round((owned/total)*100):0;
              return (
                <div key={type} className="type-progress-card">
                  <div className="type-progress-header">
                    <span className="type-progress-name" style={{ color:TYPE_COLORS[type] }}>{TYPE_LABELS[type]||type}</span>
                    <span className="type-progress-count">{owned}/{total} · {p}%</span>
                  </div>
                  <div className="type-progress-bar">
                    <div className={`type-progress-fill fill-${type.toLowerCase()}`} style={{ width:`${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex',gap:0,marginBottom:14,border:'1px solid var(--border-subtle)',borderRadius:8,overflow:'hidden',width:'fit-content' }}>
          {TABS.map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
              display:'flex',alignItems:'center',gap:7,padding:'9px 18px',
              background:activeTab===tab.id?'rgba(0,212,255,0.1)':'transparent',
              border:'none',borderRight:'1px solid var(--border-subtle)',
              color:activeTab===tab.id?'var(--accent-primary)':'var(--text-secondary)',
              fontFamily:'Rajdhani,sans-serif',fontSize:13,fontWeight:700,
              letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer',transition:'all 0.2s',
            }}>
              <tab.icon size={14} />
              {tab.label}
              <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,padding:'1px 6px',background:activeTab===tab.id?'rgba(0,212,255,0.15)':'rgba(255,255,255,0.05)',borderRadius:4 }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position:'relative',maxWidth:340,marginBottom:14 }}>
          <Search size={13} style={{ position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }} />
          <input className="search-input" style={{ paddingLeft:32,width:'100%' }} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>

        {/* Tab content */}
        {activeTab==='sets' && (
          filteredSetsWithPieces.length===0 ? (
            <div className="empty-state">
              <Shield size={56} className="empty-state-icon" />
              <div className="empty-state-title">NENHUM SET COM PEÇAS OBTIDAS</div>
              <div className="empty-state-text">Vá para "Todas as Armaduras" e marque as peças que você tem.</div>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {filteredSetsWithPieces.map(s=>{
                const pieces=s.pieces||[];
                const owned=pieces.filter(p=>p.owned).length;
                const total=pieces.length;
                const isComplete=owned===total;
                const sortedPieces=[...pieces].sort((a,b)=>{const ao=PIECE_ORDER.indexOf(a.piece_type),bo=PIECE_ORDER.indexOf(b.piece_type);return(ao===-1?99:ao)-(bo===-1?99:bo);});
                return (
                  <div key={s.id} style={{
                    background:'var(--bg-card)',
                    border:`1px solid ${isComplete?'rgba(0,229,160,0.25)':'var(--border-subtle)'}`,
                    borderRadius:8,padding:'12px 16px',cursor:'pointer',transition:'all 0.2s',
                  }}
                    onClick={()=>setSelectedSet(s)}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=isComplete?'rgba(0,229,160,0.4)':'var(--border-normal)'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=isComplete?'rgba(0,229,160,0.25)':'var(--border-subtle)'}
                  >
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
                        <span style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{s.base_name}</span>
                        {s.variant_name&&s.variant_name!=='Base' && (
                          <span style={{ fontSize:11,fontWeight:700,color:`var(--type-${s.type?.toLowerCase()})` }}>{s.variant_name}</span>
                        )}
                        <span style={{ fontSize:11,color:'var(--text-muted)' }}>{s.manufacturer}</span>
                        {isComplete && <span style={{ fontSize:9,fontWeight:700,color:'var(--accent-green)',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',borderRadius:3,padding:'1px 6px',letterSpacing:'0.1em' }}>COMPLETO</span>}
                      </div>
                      <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:12,color:isComplete?'var(--accent-green)':'var(--accent-primary)',flexShrink:0 }}>{owned}/{total} peças</span>
                    </div>
                    <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
                      {sortedPieces.map(p=>{
                        const Icon=PIECE_ICONS[p.piece_type]||Shield;
                        return (
                          <div key={p.id} style={{
                            display:'flex',alignItems:'center',gap:3,padding:'2px 7px',borderRadius:4,
                            background:p.owned?'rgba(0,229,160,0.1)':'rgba(255,255,255,0.03)',
                            border:`1px solid ${p.owned?'rgba(0,229,160,0.3)':'var(--border-subtle)'}`,
                            fontSize:10,fontWeight:700,
                            color:p.owned?'var(--accent-green)':'var(--text-muted)',
                          }}>
                            <Icon size={10}/>{PIECE_PT[p.piece_type]||p.piece_type}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeTab==='pieces' && (
          filteredObtida.length===0 ? (
            <div className="empty-state">
              <Package size={56} className="empty-state-icon" />
              <div className="empty-state-title">NENHUMA PEÇA OBTIDA</div>
              <div className="empty-state-text">Marque peças individuais nos sets para ver aqui.</div>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
              {filteredObtida.map(({piece,set})=>(
                <PieceRow key={piece.id} piece={piece} setNome={set.base_name} setTipo={set.type} variantNome={set.variant_name} onToggle={onTogglePiece} onWishlist={onTogglePieceWishlist} />
              ))}
            </div>
          )
        )}

        {activeTab==='wishlist' && (
          filteredWishlist.length===0 ? (
            <div className="empty-state">
              <Star size={56} className="empty-state-icon" />
              <div className="empty-state-title">LISTA DE DESEJOS VAZIA</div>
              <div className="empty-state-text">Adicione peças à lista de desejos nos detalhes do set.</div>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
              {filteredWishlist.map(({piece,set})=>(
                <PieceRow key={piece.id} piece={piece} setNome={set.base_name} setTipo={set.type} variantNome={set.variant_name} onToggle={onTogglePiece} onWishlist={onTogglePieceWishlist} />
              ))}
            </div>
          )
        )}
      </div>

      {selectedSet && (
        <ArmorSetModal
          set={selectedSet} sets={sets} onClose={()=>setSelectedSet(null)}
          onTogglePiece={onTogglePiece} onTogglePieceWishlist={onTogglePieceWishlist} onupdatePieceNotes={onupdatePieceNotes}
        />
      )}
    </div>
  );
}
