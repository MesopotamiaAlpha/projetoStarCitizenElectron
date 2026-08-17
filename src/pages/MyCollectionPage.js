import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { Package, Star, Search, Trophy, HardHat, Shirt, Dumbbell, Footprints, Backpack, Shield, Plus, Minus, LayoutGrid, List } from 'lucide-react';
import ArmorSetModal from '../components/ArmorSetModal';

const PIECE_ICONS   = { Helmet:HardHat, Torso:Shirt, Arms:Dumbbell, Legs:Footprints, Backpack:Backpack };
const PIECE_PT      = { Helmet:'Capacete', Torso:'Torso', Arms:'Braços', Legs:'Pernas', Backpack:'Mochila' };
const TYPE_COLORS   = { Light:'var(--type-light)', Médio:'var(--type-medium)', Heavy:'var(--type-heavy)', Special:'var(--type-special)' };
const TYPE_LABELS   = { Light:'Leve', Médio:'Médio', Heavy:'Pesado', Special:'Especial' };
const PIECE_ORDER   = ['Helmet','Torso','Arms','Legs','Backpack'];

// ── Controle de quantidade inline ─────────────────────────────────────────────
function QuantityControl({ pieceId, quantity, owned, onUpdate }) {
  const qty = Math.max(0, Number(quantity) || 0);

  if (!owned) return null; // só mostra se a peça está marcada como obtida

  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}
      onClick={e => e.stopPropagation()}>
      <button
        onClick={() => onUpdate(pieceId, Math.max(1, qty - 1))}
        disabled={qty <= 1}
        style={{
          width:20, height:20, borderRadius:4, border:'1px solid var(--border-normal)',
          background:'rgba(251,113,133,0.07)', color: qty <= 1 ? 'var(--text-muted)' : 'var(--accent-red)',
          cursor: qty <= 1 ? 'default' : 'pointer', display:'flex', alignItems:'center',
          justifyContent:'center', opacity: qty <= 1 ? 0.4 : 1,
        }}>
        <Minus size={9}/>
      </button>
      <div style={{
        minWidth:26, height:20, display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'Michroma,sans-serif', fontSize:12, fontWeight:800,
        color: qty > 1 ? 'var(--accent-gold)' : 'var(--text-secondary)',
        background: qty > 1 ? 'rgba(255,200,0,0.1)' : 'transparent',
        border: qty > 1 ? '1px solid rgba(255,200,0,0.3)' : '1px solid var(--border-subtle)',
        borderRadius:4, padding:'0 4px',
      }}>
        {qty}
      </div>
      <button
        onClick={() => onUpdate(pieceId, qty + 1)}
        style={{
          width:20, height:20, borderRadius:4, border:'1px solid var(--border-normal)',
          background:'rgba(52,211,153,0.07)', color:'var(--accent-green)',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        }}>
        <Plus size={9}/>
      </button>
      {qty > 1 && (
        <span style={{ fontSize:9, color:'var(--accent-gold)', fontWeight:700, whiteSpace:'nowrap' }}>
          ×{qty}
        </span>
      )}
    </div>
  );
}

function PieceRow({ piece, setNome, setTipo, variantNome, onToggle, onWishlist, onUpdateQuantity }) {
  const Icon = PIECE_ICONS[piece.piece_type] || Shield;
  const qty  = Math.max(1, Number(piece.quantity) || 1);
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
      background: piece.owned ? 'rgba(52,211,153,0.04)' : 'var(--bg-card)',
      border:`1px solid ${piece.owned ? 'rgba(52,211,153,0.2)' : 'var(--border-subtle)'}`,
      borderRadius:6, transition:'all 0.2s',
    }}>
      <div style={{ width:28, height:28, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', background:`${TYPE_COLORS[setTipo]}18`, color:TYPE_COLORS[setTipo], flexShrink:0 }}>
        <Icon size={14}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {setNome}{variantNome && variantNome !== 'Base' ? <span style={{ color:'var(--text-muted)', fontWeight:400 }}> — {variantNome}</span> : ''} · {PIECE_PT[piece.piece_type] || piece.piece_type}
        </div>
        <div style={{ fontSize:10, color:'var(--text-muted)' }}>{piece.piece_name}</div>
      </div>
      {piece.is_lootable && !piece.is_purchasable && (
        <span style={{ fontSize:9, color:'var(--accent-purple)', fontWeight:700, background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.2)', padding:'1px 5px', borderRadius:3, flexShrink:0 }}>LOOT</span>
      )}
      {/* Controle de quantidade */}
      <QuantityControl
        pieceId={piece.id} quantity={qty} owned={piece.owned}
        onUpdate={onUpdateQuantity}/>
      <div style={{ display:'flex', gap:5, flexShrink:0 }}>
        <button onClick={() => onToggle(piece.id)} style={{ width:28, height:28, borderRadius:5, border:`1px solid ${piece.owned ? 'rgba(52,211,153,0.4)' : 'var(--border-subtle)'}`, background: piece.owned ? 'rgba(52,211,153,0.15)' : 'transparent', color: piece.owned ? 'var(--accent-green)' : 'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, transition:'all 0.2s' }}>✓</button>
        <button onClick={() => onWishlist(piece.id)} style={{ width:28, height:28, borderRadius:5, border:`1px solid ${piece.wishlist ? 'rgba(251,191,36,0.4)' : 'var(--border-subtle)'}`, background: piece.wishlist ? 'rgba(251,191,36,0.12)' : 'transparent', color: piece.wishlist ? 'var(--accent-gold)' : 'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, transition:'all 0.2s' }}>★</button>
      </div>
    </div>
  );
}

export default function MyCollectionPage({ sets, stats, onTogglePiece, onTogglePieceWishlist, onupdatePieceNotes, onUpdatePieceQuantity }) {
  const [activeTab,   setActiveTab]   = useState('sets');
  const [search,      setSearch]      = useState('');
  const [selectedSet, setSelectedSet] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('list');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 48;
  useEffect(() => { setPage(1); }, [activeTab, search, typeFilter, statusFilter, sortBy, viewMode]);

  const setsWithPieces = useMemo(() =>
    sets.filter(s => (s.pieces||[]).some(p => p.owned)),
  [sets]);

  const allObtidaPieces = useMemo(() => {
    const itens = [];
    sets.forEach(s => (s.pieces||[]).forEach(p => { if (p.owned) itens.push({ piece:p, set:s }); }));
    return itens.sort((a,b) => new Date(b.piece.obtained_date||0) - new Date(a.piece.obtained_date||0));
  }, [sets]);

  const wishlistPieces = useMemo(() => {
    const itens = [];
    sets.forEach(s => (s.pieces||[]).forEach(p => { if (p.wishlist && !p.owned) itens.push({ piece:p, set:s }); }));
    return itens;
  }, [sets]);

  const byTipo = useMemo(() =>
    ['Light','Médio','Heavy','Special'].map(type => ({
      type,
      total: sets.filter(s => s.type===type).reduce((a,s) => a+(s.pieces||[]).length, 0),
      owned: sets.filter(s => s.type===type).reduce((a,s) => a+(s.pieces||[]).filter(p => p.owned).length, 0),
    })).filter(t => t.total > 0),
  [sets]);

  // Total de peças considerando quantidade (ex: 2 braços = 2)
  const totalPiecesWithQty = useMemo(() => {
    let total = 0;
    sets.forEach(s => (s.pieces||[]).forEach(p => {
      if (p.owned) total += Math.max(1, Number(p.quantity)||1);
    }));
    return total;
  }, [sets]);

  const deferredSearch = useDeferredValue(search);
  const q = deferredSearch.trim().toLowerCase();

  const filteredSetsWithPieces = useMemo(() => {
    const result = setsWithPieces.filter(s => {
      const matchesSearch = !q || s.base_name?.toLowerCase().includes(q) || s.variant_name?.toLowerCase().includes(q) || s.manufacturer?.toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || s.type === typeFilter;
      const pieces = s.pieces || [];
      const owned = pieces.filter(piece => piece.owned).length;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'complete' && owned === pieces.length) || (statusFilter === 'partial' && owned > 0 && owned < pieces.length);
      return matchesSearch && matchesType && matchesStatus;
    });
    return result.map(set => ({
      set,
      lastObtainedAt: Math.max(0, ...(set.pieces || []).map(piece => new Date(piece.obtained_date || 0).getTime() || 0)),
      quantityTotal: (set.pieces || []).reduce((sum, piece) => sum + (piece.owned ? Math.max(1, Number(piece.quantity) || 1) : 0), 0),
    })).sort((a, b) => {
      if (sortBy === 'name') return `${a.set.base_name} ${a.set.variant_name || ''}`.localeCompare(`${b.set.base_name} ${b.set.variant_name || ''}`);
      if (sortBy === 'quantity') return b.quantityTotal - a.quantityTotal;
      return b.lastObtainedAt - a.lastObtainedAt;
    }).map(item => item.set);
  }, [setsWithPieces, q, typeFilter, statusFilter, sortBy]);

  const filteredObtida = useMemo(() => allObtidaPieces.filter(({ piece, set }) =>
    (typeFilter === 'all' || set.type === typeFilter) && (!q || set.base_name?.toLowerCase().includes(q) || piece.piece_name?.toLowerCase().includes(q))
  ).sort((a, b) => sortBy === 'name' ? a.piece.piece_name.localeCompare(b.piece.piece_name) : new Date(b.piece.obtained_date || 0) - new Date(a.piece.obtained_date || 0)), [allObtidaPieces, q, typeFilter, sortBy]);

  const filteredWishlist = useMemo(() => wishlistPieces.filter(({ piece, set }) =>
    (typeFilter === 'all' || set.type === typeFilter) && (!q || set.base_name?.toLowerCase().includes(q) || piece.piece_name?.toLowerCase().includes(q))
  ).sort((a, b) => a.piece.piece_name.localeCompare(b.piece.piece_name)), [wishlistPieces, q, typeFilter]);

  const pct = stats && stats.totalPieces > 0
    ? Math.round((stats.ownedPieces / stats.totalPieces) * 100) : 0;

  const activeItemsCount = activeTab === 'sets' ? filteredSetsWithPieces.length : activeTab === 'pieces' ? filteredObtida.length : filteredWishlist.length;
  const totalPages = Math.max(1, Math.ceil(activeItemsCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleSets = useMemo(() => filteredSetsWithPieces.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filteredSetsWithPieces, safePage]);
  const visibleObtida = useMemo(() => filteredObtida.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filteredObtida, safePage]);
  const visibleWishlist = useMemo(() => filteredWishlist.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filteredWishlist, safePage]);

  const TABS = [
    { id:'sets',     label:'Sets com Peças', icon:Shield,  count:setsWithPieces.length },
    { id:'pieces',   label:'Todas as Peças', icon:Package, count:allObtidaPieces.length },
    { id:'wishlist', label:'Wishlist',       icon:Star,    count:wishlistPieces.length },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">MINHA COLEÇÃO</div>
          <div className="page-subtitle">
            {stats?.ownedPieces||0} tipos de peças · {totalPiecesWithQty} peças no total (com duplicatas)
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:8, padding:'10px 16px' }}>
          <Trophy size={18} style={{ color:'var(--accent-gold)' }}/>
          <div>
            <div style={{ fontFamily:'Michroma,sans-serif', fontSize:20, fontWeight:800, color:'var(--accent-gold)', lineHeight:1 }}>{pct}%</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Peças</div>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'Tipos de Peças',   value:stats?.ownedPieces||0,   color:'var(--accent-green)' },
            { label:'Sets Completos',   value:stats?.completeSets||0,   color:'var(--accent-gold)' },
            { label:'Total c/ Dupl.',   value:totalPiecesWithQty,       color:'var(--accent-primary)' },
            { label:'Wishlist',         value:stats?.wishlistPieces||0, color:'var(--accent-gold)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:8, padding:'14px 16px', textAlign:'center' }}>
              <div style={{ fontFamily:'Michroma,sans-serif', fontSize:24, fontWeight:800, color }}>{value}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:2, fontWeight:600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Progresso by type */}
        <div style={{ marginBottom:20 }}>
          <div className="section-divider">
            <span className="section-divider-label" style={{ color:'var(--text-secondary)' }}>Peças por Tipo</span>
            <div className="section-divider-line"/>
          </div>
          <div className="type-progress-grid">
            {byTipo.map(({ type, total, owned }) => {
              const p = total > 0 ? Math.round((owned/total)*100) : 0;
              return (
                <div key={type} className="type-progress-card">
                  <div className="type-progress-header">
                    <span className="type-progress-name" style={{ color:TYPE_COLORS[type] }}>{TYPE_LABELS[type]||type}</span>
                    <span className="type-progress-count">{owned}/{total} · {p}%</span>
                  </div>
                  <div className="type-progress-bar">
                    <div className={`type-progress-fill fill-${type.toLowerCase()}`} style={{ width:`${p}%` }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:0, marginBottom:14, border:'1px solid var(--border-subtle)', borderRadius:8, overflow:'hidden', width:'fit-content' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              display:'flex', alignItems:'center', gap:7, padding:'9px 18px',
              background: activeTab===tab.id ? 'rgba(56,189,248,0.1)' : 'transparent',
              border:'none', borderRight:'1px solid var(--border-subtle)',
              color: activeTab===tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontFamily:'"Exo 2",sans-serif', fontSize:13, fontWeight:700,
              letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer', transition:'all 0.2s',
            }}>
              <tab.icon size={14}/>
              {tab.label}
              <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:11, padding:'1px 6px', background:activeTab===tab.id?'rgba(56,189,248,0.15)':'rgba(255,255,255,0.05)', borderRadius:4 }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search and collection controls */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:14 }}>
          <div style={{ position:'relative', flex:'1 1 260px', maxWidth:390 }}>
            <Search size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
            <input className="search-input" style={{ paddingLeft:32, width:'100%' }} placeholder="Buscar nome, fabricante ou peça..." value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">Todos os tipos</option><option value="Light">Leve</option><option value="Médio">Médio</option><option value="Heavy">Pesado</option><option value="Special">Especial</option>
          </select>
          {activeTab === 'sets' && <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Todos os status</option><option value="complete">Completos</option><option value="partial">Parciais</option></select>}
          <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="recent">Mais recentes</option><option value="name">Nome A-Z</option><option value="quantity">Maior quantidade</option></select>
          <div style={{ display:'flex', border:'1px solid var(--border-subtle)', borderRadius:6, overflow:'hidden' }}>
            <button title="Visualização em lista" onClick={() => setViewMode('list')} style={{ display:'flex', padding:'7px 9px', background:viewMode==='list'?'rgba(56,189,248,0.14)':'transparent', border:0, color:viewMode==='list'?'var(--accent-primary)':'var(--text-muted)', cursor:'pointer' }}><List size={14}/></button>
            <button title="Visualização em grade" onClick={() => setViewMode('grid')} style={{ display:'flex', padding:'7px 9px', background:viewMode==='grid'?'rgba(56,189,248,0.14)':'transparent', border:0, color:viewMode==='grid'?'var(--accent-primary)':'var(--text-muted)', cursor:'pointer' }}><LayoutGrid size={14}/></button>
          </div>
        </div>
        <div style={{ marginBottom:10, color:'var(--text-muted)', fontSize:11 }}>Mostrando {activeItemsCount} resultado{activeItemsCount === 1 ? '' : 's'}{activeItemsCount > PAGE_SIZE ? ` · página ${safePage}/${totalPages}` : ''}</div>

        {/* ── ABA SETS ── */}
        {activeTab==='sets' && (
          filteredSetsWithPieces.length===0 ? (
            <div className="empty-state">
              <Shield size={56} className="empty-state-icon"/>
              <div className="empty-state-title">NENHUM SET COM PEÇAS OBTIDAS</div>
              <div className="empty-state-text">Vá para "Todas as Armaduras" e marque as peças que você tem.</div>
            </div>
          ) : (
            <div style={{ display:viewMode === 'grid' ? 'grid' : 'flex', gridTemplateColumns:viewMode === 'grid' ? 'repeat(auto-fill,minmax(300px,1fr))' : undefined, flexDirection:viewMode === 'grid' ? undefined : 'column', gap:8 }}>
              {visibleSets.map(s => {
                const pieces    = s.pieces || [];
                const owned     = pieces.filter(p => p.owned).length;
                const total     = pieces.length;
                const isComplete = owned === total;
                // Total de peças contando duplicatas
                const totalQty  = pieces.filter(p => p.owned).reduce((a,p) => a + Math.max(1, Number(p.quantity)||1), 0);
                const hasDupl   = totalQty > owned;
                const sortedPieces = [...pieces].sort((a,b) => {
                  const ao = PIECE_ORDER.indexOf(a.piece_type);
                  const bo = PIECE_ORDER.indexOf(b.piece_type);
                  return (ao===-1?99:ao) - (bo===-1?99:bo);
                });
                return (
                  <div key={s.id} style={{
                    background:'var(--bg-card)',
                    border:`1px solid ${isComplete ? 'rgba(52,211,153,0.25)' : 'var(--border-subtle)'}`,
                    borderRadius:8, padding:'12px 16px', cursor:'pointer', transition:'all 0.2s',
                  }}
                  onClick={() => setSelectedSet(s)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = isComplete ? 'rgba(52,211,153,0.4)' : 'var(--border-normal)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = isComplete ? 'rgba(52,211,153,0.25)' : 'var(--border-subtle)'}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontFamily:'Michroma,sans-serif', fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{s.base_name}</span>
                        {s.variant_name && s.variant_name !== 'Base' && (
                          <span style={{ fontSize:11, fontWeight:700, color:`var(--type-${s.type?.toLowerCase()})` }}>{s.variant_name}</span>
                        )}
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>{s.manufacturer}</span>
                        {isComplete && <span style={{ fontSize:9, fontWeight:700, color:'var(--accent-green)', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:3, padding:'1px 6px', letterSpacing:'0.1em' }}>COMPLETO</span>}
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontFamily:'Share Tech Mono,monospace', fontSize:12, color:isComplete?'var(--accent-green)':'var(--accent-primary)' }}>{owned}/{total} peças</div>
                        {hasDupl && <div style={{ fontFamily:'Share Tech Mono,monospace', fontSize:10, color:'var(--accent-gold)' }}>{totalQty} total c/ dupl.</div>}
                      </div>
                    </div>
                    {/* Chips das peças com quantidade */}
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }} onClick={e => e.stopPropagation()}>
                      {sortedPieces.map(p => {
                        const Icon = PIECE_ICONS[p.piece_type] || Shield;
                        const qty  = Math.max(1, Number(p.quantity)||1);
                        const hasExtra = qty > 1;
                        return (
                          <div key={p.id} style={{
                            display:'flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:4,
                            background: p.owned ? (hasExtra?'rgba(255,200,0,0.1)':'rgba(52,211,153,0.1)') : 'rgba(255,255,255,0.03)',
                            border:`1px solid ${p.owned ? (hasExtra?'rgba(255,200,0,0.4)':'rgba(52,211,153,0.3)') : 'var(--border-subtle)'}`,
                            fontSize:10, fontWeight:700,
                            color: p.owned ? (hasExtra?'var(--accent-gold)':'var(--accent-green)') : 'var(--text-muted)',
                          }}>
                            <Icon size={10}/>
                            {PIECE_PT[p.piece_type]||p.piece_type}
                            {/* Botões +/- no chip */}
                            {p.owned && (
                              <>
                                {hasExtra && <span style={{ fontFamily:'Michroma,sans-serif', fontSize:10, fontWeight:800 }}>×{qty}</span>}
                                <button onClick={e=>{e.stopPropagation();onUpdatePieceQuantity&&onUpdatePieceQuantity(p.id, Math.max(1,qty-1));}}
                                  disabled={qty<=1}
                                  style={{ width:14,height:14,borderRadius:2,border:'none',background:'rgba(251,113,133,0.2)',color:qty<=1?'transparent':'var(--accent-red)',cursor:qty<=1?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,padding:0 }}>
                                  −
                                </button>
                                <button onClick={e=>{e.stopPropagation();onUpdatePieceQuantity&&onUpdatePieceQuantity(p.id, qty+1);}}
                                  style={{ width:14,height:14,borderRadius:2,border:'none',background:'rgba(52,211,153,0.2)',color:'var(--accent-green)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,padding:0 }}>
                                  +
                                </button>
                              </>
                            )}
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

        {/* ── ABA PEÇAS ── */}
        {activeTab==='pieces' && (
          filteredObtida.length===0 ? (
            <div className="empty-state">
              <Package size={56} className="empty-state-icon"/>
              <div className="empty-state-title">NENHUMA PEÇA OBTIDA</div>
              <div className="empty-state-text">Marque peças individuais nos sets para ver aqui.</div>
            </div>
          ) : (
            <div style={{ display:viewMode === 'grid' ? 'grid' : 'flex', gridTemplateColumns:viewMode === 'grid' ? 'repeat(auto-fill,minmax(300px,1fr))' : undefined, flexDirection:viewMode === 'grid' ? undefined : 'column', gap:6 }}>
              {visibleObtida.map(({ piece, set }) => (
                <PieceRow
                  key={piece.id} piece={piece}
                  setNome={set.base_name} setTipo={set.type} variantNome={set.variant_name}
                  onToggle={onTogglePiece} onWishlist={onTogglePieceWishlist}
                  onUpdateQuantity={onUpdatePieceQuantity}
                />
              ))}
            </div>
          )
        )}

        {/* ── ABA WISHLIST ── */}
        {activeTab==='wishlist' && (
          filteredWishlist.length===0 ? (
            <div className="empty-state">
              <Star size={56} className="empty-state-icon"/>
              <div className="empty-state-title">LISTA DE DESEJOS VAZIA</div>
              <div className="empty-state-text">Adicione peças à lista de desejos nos detalhes do set.</div>
            </div>
          ) : (
            <div style={{ display:viewMode === 'grid' ? 'grid' : 'flex', gridTemplateColumns:viewMode === 'grid' ? 'repeat(auto-fill,minmax(300px,1fr))' : undefined, flexDirection:viewMode === 'grid' ? undefined : 'column', gap:6 }}>
              {visibleWishlist.map(({ piece, set }) => (
                <PieceRow
                  key={piece.id} piece={piece}
                  setNome={set.base_name} setTipo={set.type} variantNome={set.variant_name}
                  onToggle={onTogglePiece} onWishlist={onTogglePieceWishlist}
                  onUpdateQuantity={onUpdatePieceQuantity}
                />
              ))}
            </div>
          )
        )}
        {activeItemsCount > PAGE_SIZE && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'16px 0 4px' }}>
            <button className="filter-chip" disabled={safePage <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>‹ Anterior</button>
            <span style={{ color:'var(--text-muted)', fontSize:11, fontFamily:'Share Tech Mono,monospace' }}>{safePage} / {totalPages}</span>
            <button className="filter-chip" disabled={safePage >= totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>Próxima ›</button>
          </div>
        )}
      </div>

      {selectedSet && (
        <ArmorSetModal
          set={selectedSet} sets={sets} onClose={() => setSelectedSet(null)}
          onTogglePiece={onTogglePiece} onTogglePieceWishlist={onTogglePieceWishlist} onUpdatePieceNotes={onupdatePieceNotes}
        />
      )}
    </div>
  );
}