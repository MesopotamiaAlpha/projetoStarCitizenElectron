import React, { useState, useMemo, useEffect } from 'react';
import { Search, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import ArmorSetModal from '../components/ArmorSetModal';

const TYPE_LABELS = { Light:'Leve', Médio:'Médio', Heavy:'Pesado', Special:'Especial' };
const SORT_OPTIONS = [
  { value:'name',     label:'Nome (A-Z)' },
  { value:'progress', label:'Progresso (maior)' },
  { value:'rarity',   label:'Raridade' },
  { value:'type',     label:'Tipo' },
];
const RARITY_ORDER = { Comum:1, Incomum:2, Raro:3, Legendary:4 };
const PIECE_LABELS = { Helmet:'Capacete', Torso:'Torso', Arms:'Braços', Legs:'Pernas', Backpack:'Mochila' };

function ArmorBaseGroupCard({ group, onSelect, onTogglePiece, onUpdatePieceQuantity }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <section className="armor-base-group-card">
      <header className="armor-base-group-heading">
        <div>
          <strong>{group.baseName}</strong>
          <span>{group.manufacturer || 'Fabricante não informado'} · {group.typeLabel || group.type}</span>
        </div>
        <b>{group.variants.length} variante{group.variants.length === 1 ? '' : 's'}</b>
      </header>
      <div className="armor-base-variants">
        {group.variants.map(variant => {
          const pieces = variant.pieces || [];
          const owned = pieces.filter(piece => piece.owned).length;
          const isOpen = expanded === variant.id;
          return (
            <article className={`armor-base-variant ${owned === pieces.length && pieces.length ? 'is-complete' : ''}`} key={variant.id}>
              <button type="button" className="armor-base-variant-summary" onClick={() => setExpanded(isOpen ? null : variant.id)}>
                <span className="armor-base-variant-name"><strong>{variant.variant_name && variant.variant_name !== 'Base' ? variant.variant_name : 'Variante Base'}</strong><small>{variant.manufacturer || group.manufacturer || 'Fabricante não informado'} · {variant.rarity || 'Raridade não informada'}</small></span>
                <span className="armor-base-variant-progress">{owned}/{pieces.length} peças</span>
                {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              <div className="armor-base-variant-bar"><span style={{ width: `${pieces.length ? Math.round((owned / pieces.length) * 100) : 0}%` }} /></div>
              {isOpen && (
                <div className="armor-base-variant-pieces">
                  {pieces.map(piece => <div key={piece.id} className={`armor-base-piece-chip ${piece.owned ? 'is-owned' : ''}`} title={piece.piece_name || PIECE_LABELS[piece.piece_type] || piece.piece_type}><button type="button" className="armor-base-piece-toggle" onClick={() => onTogglePiece(piece.id)}><Shield size={11} /><span>{PIECE_LABELS[piece.piece_type] || piece.piece_type}<small>{piece.piece_name || (piece.owned ? 'Obtida' : 'Faltando')}</small></span></button>{piece.owned && <span className="armor-base-piece-quantity"><button type="button" onClick={() => onUpdatePieceQuantity(piece.id, Math.max(1, Number(piece.quantity || 1) - 1))} disabled={Number(piece.quantity || 1) <= 1}>−</button><b>{Math.max(1, Number(piece.quantity || 1))}</b><button type="button" onClick={() => onUpdatePieceQuantity(piece.id, Number(piece.quantity || 1) + 1)}>+</button></span>}</div>)}
                  <button type="button" className="armor-base-open-details" onClick={() => onSelect(variant)}>Abrir detalhes</button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function TodosArmorsPage({ sets, onTogglePiece, onTogglePieceWishlist, onUpdatePieceNotes, onUpdatePieceQuantity }) {
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTipoFilter]   = useState('all');
  const [rarityFilter, setRaridadeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy,       setOrdenarBy]       = useState('name');
  const [selectedSet,  setSelectedSet]  = useState(null);
  const [groupByBase,  setGroupByBase]  = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 48;

  useEffect(() => { setPage(1); }, [search, typeFilter, rarityFilter, statusFilter, sortBy, groupByBase]);

  const filtered = useMemo(() => {
    let result = [...sets];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.base_name?.toLowerCase().includes(q) ||
        s.variant_name?.toLowerCase().includes(q) ||
        s.manufacturer?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
      );
    }
    if (typeFilter   !== 'all') result = result.filter(s => s.type   === typeFilter);
    if (rarityFilter !== 'all') result = result.filter(s => s.rarity === rarityFilter);
    if (statusFilter === 'complete') result = result.filter(s => {
      const p=s.pieces||[]; return p.length>0 && p.every(x=>x.owned);
    });
    if (statusFilter === 'partial') result = result.filter(s => {
      const p=s.pieces||[]; const o=p.filter(x=>x.owned).length; return o>0 && o<p.length;
    });
    if (statusFilter === 'none')     result = result.filter(s => (s.pieces||[]).every(x=>!x.owned));
    if (statusFilter === 'wishlist') result = result.filter(s => (s.pieces||[]).some(x=>x.wishlist));

    result.sort((a,b) => {
      switch (sortBy) {
        case 'progress': {
          const pa=a.pieces||[], pb=b.pieces||[];
          const pA=pa.length>0?pa.filter(x=>x.owned).length/pa.length:0;
          const pB=pb.length>0?pb.filter(x=>x.owned).length/pb.length:0;
          return pB-pA;
        }
        case 'rarity': return (RARITY_ORDER[b.rarity]||0)-(RARITY_ORDER[a.rarity]||0);
        case 'type': { const o={Light:1,Médio:2,Heavy:3,Special:4}; return (o[a.type]||5)-(o[b.type]||5); }
        default: {
          const c=(a.base_name||'').localeCompare(b.base_name||'');
          return c!==0?c:(a.variant_name||'').localeCompare(b.variant_name||'');
        }
      }
    });
    return result;
  }, [sets, search, typeFilter, rarityFilter, statusFilter, sortBy, groupByBase]);

  // Hierarquia real: base -> variantes -> peças. Nunca mesclar peças de variantes diferentes.
  const displayItens = useMemo(() => {
    if (!groupByBase) return filtered.map(set => ({ key: String(set.id), baseName: set.base_name, variants: [set], grouped: false }));
    const map = new Map();
    for (const set of filtered) {
      const key = `${String(set.base_name || 'Sem base').trim()}||${String(set.type || 'Médio').trim()}||${String(set.manufacturer || '').trim()}`;
      const group = map.get(key) || { key, baseName: set.base_name || 'Sem base', manufacturer: set.manufacturer, type: set.type, typeLabel: TYPE_LABELS[set.type] || set.type, variants: [] };
      group.variants.push(set);
      map.set(key, group);
    }
    return [...map.values()].map(group => ({ ...group, variants: [...group.variants].sort((a, b) => String(a.variant_name || 'Base').localeCompare(String(b.variant_name || 'Base'))) }));
  }, [filtered, groupByBase]);

  const totalPieces = useMemo(() => sets.reduce((a,s)=>a+(s.pieces||[]).length, 0), [sets]);
  const ownedPieces = useMemo(() => sets.reduce((a,s)=>a+(s.pieces||[]).filter(p=>p.owned).length, 0), [sets]);
  const totalPages = Math.max(1, Math.ceil(displayItens.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleItems = useMemo(() => displayItens.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [displayItens, safePage]);

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">TODAS AS ARMADURAS</div>
          <div className="page-subtitle">
            {sets.length} sets · {totalPieces} peças · {ownedPieces} obtidas
          </div>
        </div>
        <button
          className={`filter-chip ${groupByBase?'active':''}`}
          onClick={() => setGroupByBase(g=>!g)}
          style={{ display:'flex',alignItems:'center',gap:6 }}
        >
              {groupByBase ? 'Ver variantes individuais' : 'Agrupar por base'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ padding:'12px 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',flexShrink:0 }}>
        <div className="filters-bar" style={{ marginBottom:10 }}>
          <div style={{ position:'relative',flex:1 }}>
            <Search size={14} style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }} />
            <input className="search-input" style={{ paddingLeft:36 }}
              placeholder="Buscar por nome, variante, fabricante..."
              value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <select className="filter-select" value={sortBy} onChange={e=>setOrdenarBy(e.target.value)}>
            {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="filter-select" value={rarityFilter} onChange={e=>setRaridadeFilter(e.target.value)}>
            <option value="all">Qualquer Raridade</option>
            <option value="Comum">Comum</option>
            <option value="Incomum">Incomum</option>
            <option value="Raro">Raro</option>
            <option value="Legendary">Lendário</option>
          </select>
        </div>
        <div style={{ display:'flex',gap:8,flexWrap:'wrap',alignItems:'center' }}>
          {['all','Light','Médio','Heavy','Special'].map(t=>(
            <button key={t}
              className={`filter-chip ${t!=='all'?`type-${t.toLowerCase()}`:''} ${typeFilter===t?'active':''}`}
              onClick={()=>setTipoFilter(t)}>
              {t==='all'?'Todos os Tipos':TYPE_LABELS[t]}
            </button>
          ))}
          <span style={{ width:1,height:20,background:'var(--border-subtle)',margin:'0 2px' }} />
          {[
            {val:'all',label:'Todos'},{val:'complete',label:'✓ Completo'},
            {val:'partial',label:'◑ Parcial'},{val:'none',label:'○ Sem peças'},
            {val:'wishlist',label:'★ Na Lista'},
          ].map(o=>(
            <button key={o.val}
              className={`filter-chip ${statusFilter===o.val?'active':''}`}
              onClick={()=>setStatusFilter(o.val)}>{o.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:'6px 32px',background:'var(--bg-base)',flexShrink:0 }}>
        <div className="results-info">
          Exibindo <span>{displayItens.length}</span> de {sets.length} sets
          {groupByBase && <span style={{ marginLeft:8,color:'var(--text-muted)' }}>({displayItens.length} grupos)</span>}
          {displayItens.length > PAGE_SIZE && <span style={{ marginLeft:8,color:'var(--text-muted)' }}>· página {safePage}/{totalPages}</span>}
        </div>
      </div>

      <div className="page-body">
        {displayItens.length === 0 ? (
          <div className="empty-state">
            <Shield size={64} className="empty-state-icon" />
            <div className="empty-state-title">NENHUMA ARMADURA ENCONTRADA</div>
            <div className="empty-state-text">Ajuste os filtros para encontrar o que procura.</div>
          </div>
        ) : (
            <div className="armor-base-group-grid">
            {visibleItems.map(item => (
              <ArmorBaseGroupCard
                key={item.key}
                group={item}
                onSelect={set => setSelectedSet(set)}
                onTogglePiece={onTogglePiece}
                onUpdatePieceQuantity={onUpdatePieceQuantity}
              />
            ))}
          </div>
        )}
        {displayItens.length > PAGE_SIZE && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'16px 0 4px' }}>
            <button className="filter-chip" disabled={safePage <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>‹ Anterior</button>
            <span style={{ color:'var(--text-muted)', fontSize:11, fontFamily:'Share Tech Mono,monospace' }}>{safePage} / {totalPages}</span>
            <button className="filter-chip" disabled={safePage >= totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>Próxima ›</button>
          </div>
        )}
      </div>

      {selectedSet && (
        <ArmorSetModal
          set={selectedSet}
          sets={sets}
          onClose={() => setSelectedSet(null)}
          onTogglePiece={onTogglePiece}
          onTogglePieceWishlist={onTogglePieceWishlist}
          onUpdatePieceNotes={onUpdatePieceNotes}
          onUpdatePieceQuantity={onUpdatePieceQuantity}
        />
      )}
    </div>
  );
}
