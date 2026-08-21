import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronUp, HardHat, Shirt, Dumbbell, Footprints, Backpack,
  LayoutGrid, List, Package, Plus, Search, Shield, Star, Trophy, Minus, Trash2, AlertTriangle, CheckCircle2, Wrench, X,
} from 'lucide-react';
import ArmorSetModal from '../components/ArmorSetModal';
import { getDuplicateArmorGroups } from '../data/armorDedup';

const PIECE_ICONS = { Helmet: HardHat, Torso: Shirt, Arms: Dumbbell, Legs: Footprints, Backpack };
const PIECE_PT = { Helmet: 'Capacete', Torso: 'Torso', Arms: 'Braços', Legs: 'Pernas', Backpack: 'Mochila' };
const PIECE_ORDER = ['Helmet', 'Torso', 'Arms', 'Legs', 'Backpack'];
const TYPE_COLORS = { Light: 'var(--type-light)', Médio: 'var(--type-medium)', Heavy: 'var(--type-heavy)', Special: 'var(--type-special)' };
const TYPE_LABELS = { Light: 'Leve', Médio: 'Médio', Heavy: 'Pesado', Special: 'Especial' };
const PAGE_SIZE = 24;

function pieceQuantity(piece) {
  return piece?.owned ? Math.max(1, Number(piece.quantity) || 1) : 0;
}

function variantKey(set) {
  return `${set.base_name || 'Sem nome'}::${set.type || 'Médio'}::${set.manufacturer || 'Sem fabricante'}`;
}

function summarizeVariant(set) {
  const pieces = Array.isArray(set.pieces) ? set.pieces : [];
  const ownedTypes = pieces.filter(piece => piece.owned).length;
  const totalQuantity = pieces.reduce((sum, piece) => sum + pieceQuantity(piece), 0);
  const total = pieces.length;
  const lastObtainedAt = pieces.reduce((max, piece) => Math.max(max, Date.parse(piece.obtained_date || '') || 0), 0);
  return { set, pieces, ownedTypes, total, totalQuantity, lastObtainedAt, complete: total > 0 && ownedTypes === total };
}

const QuantityControl = memo(function QuantityControl({ piece, onUpdate }) {
  if (!piece?.owned) return null;
  const quantity = pieceQuantity(piece);
  return (
    <div className="armor-quantity-control" onClick={event => event.stopPropagation()}>
      <button type="button" aria-label={`Diminuir quantidade de ${piece.piece_name}`} disabled={quantity <= 1} onClick={() => onUpdate(piece.id, quantity - 1)}><Minus size={11} /></button>
      <strong>{quantity}</strong>
      <button type="button" aria-label={`Aumentar quantidade de ${piece.piece_name}`} onClick={() => onUpdate(piece.id, quantity + 1)}><Plus size={11} /></button>
    </div>
  );
});

const VariantCard = memo(function VariantCard({ item, expanded, onExpand, onSelect, onTogglePiece, onUpdateQuantity }) {
  const { set, pieces, ownedTypes, total, totalQuantity, complete } = item;
  const sortedPieces = useMemo(() => [...pieces].sort((a, b) => PIECE_ORDER.indexOf(a.piece_type) - PIECE_ORDER.indexOf(b.piece_type)), [pieces]);
  const color = TYPE_COLORS[set.type] || 'var(--accent-primary)';

  return (
    <article className={`armor-variant-card ${complete ? 'is-complete' : ''} ${expanded ? 'is-expanded' : ''}`}>
      <button type="button" className="armor-variant-summary" onClick={onExpand}>
        <span className="armor-variant-icon" style={{ color, borderColor: `${color}66` }}><Shield size={18} /></span>
        <span className="armor-variant-heading">
          <strong>{set.variant_name && set.variant_name !== 'Base' ? set.variant_name : 'Variante Base'}</strong>
          <small>{set.manufacturer || 'Fabricante não informado'} · {TYPE_LABELS[set.type] || set.type || 'Tipo não informado'}</small>
        </span>
        <span className="armor-variant-progress">
          <b>{ownedTypes}/{total}</b><small>peças</small>
          {totalQuantity > ownedTypes && <em>{totalQuantity} total</em>}
        </span>
        <span className="armor-variant-chevron">{expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</span>
      </button>
      <div className="armor-variant-bar"><span style={{ width: `${total ? Math.round((ownedTypes / total) * 100) : 0}%`, background: complete ? 'var(--accent-green)' : color }} /></div>
      {expanded && (
        <div className="armor-variant-details">
          <div className="armor-variant-actions">
            <span className="armor-variant-status">{complete ? 'SET COMPLETO' : `${total - ownedTypes} peça(s) faltando`}</span>
            <button type="button" className="armor-open-details" onClick={() => onSelect(set)}>Abrir detalhes</button>
          </div>
          <div className="armor-piece-compact-grid">
            {sortedPieces.map(piece => {
              const Icon = PIECE_ICONS[piece.piece_type] || Shield;
              return (
                <div className={`armor-piece-compact ${piece.owned ? 'is-owned' : ''}`} key={piece.id}>
                  <button type="button" className="armor-piece-toggle" onClick={() => onTogglePiece(piece.id)} title={piece.owned ? 'Remover da coleção' : 'Marcar como obtida'}>
                    <Icon size={14} />
                    <span><b>{PIECE_PT[piece.piece_type] || piece.piece_type}</b><small>{piece.piece_name || 'Peça sem nome'}</small></span>
                    <i>{piece.owned ? 'OK' : '—'}</i>
                  </button>
                  <QuantityControl piece={piece} onUpdate={onUpdateQuantity} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
});

function PieceRow({ piece, set, onTogglePiece, onTogglePieceWishlist, onUpdateQuantity }) {
  const Icon = PIECE_ICONS[piece.piece_type] || Shield;
  return (
    <div className="armor-piece-row">
      <span className="armor-piece-row-icon"><Icon size={14} /></span>
      <span className="armor-piece-row-name"><b>{set.base_name} {set.variant_name && set.variant_name !== 'Base' ? `— ${set.variant_name}` : ''}</b><small>{piece.piece_name || PIECE_PT[piece.piece_type] || piece.piece_type}</small></span>
      <span className="armor-piece-row-badges">{piece.is_lootable && <em>LOOT</em>}</span>
      <QuantityControl piece={piece} onUpdate={onUpdateQuantity} />
      <button type="button" className={`armor-mini-action ${piece.owned ? 'active' : ''}`} onClick={() => onTogglePiece(piece.id)}>✓</button>
      <button type="button" className={`armor-mini-action wishlist ${piece.wishlist ? 'active' : ''}`} onClick={() => onTogglePieceWishlist(piece.id)}>★</button>
    </div>
  );
}

export default function MyCollectionPage({ sets, stats, onTogglePiece, onTogglePieceWishlist, onupdatePieceNotes, onUpdatePieceQuantity, onDeleteArmorSet }) {
  const [activeTab, setActiveTab] = useState('variants');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('list');
  const [expanded, setExpanded] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [showDuplicateManager, setShowDuplicateManager] = useState(false);
  const [duplicateBusy, setDuplicateBusy] = useState(null);
  const [duplicateNotice, setDuplicateNotice] = useState('');
  const [page, setPage] = useState(1);
  const searchInputRef = useRef(null);

  const focusSearchSoon = useCallback(() => {
    window.requestAnimationFrame(() => {
      const input = searchInputRef.current;
      if (!input || input.disabled || input.readOnly) return;
      input.focus({ preventScroll: true });
    });
  }, []);
  const deferredSearch = useDeferredValue(search);
  const query = deferredSearch.trim().toLocaleLowerCase('pt-BR');

  useEffect(() => setPage(1), [activeTab, query, typeFilter, statusFilter, sortBy, viewMode]);

  const allOwnedPieces = useMemo(() => sets.flatMap(set => (set.pieces || []).filter(piece => piece.owned).map(piece => ({ piece, set }))), [sets]);
  const wishlistPieces = useMemo(() => sets.flatMap(set => (set.pieces || []).filter(piece => piece.wishlist && !piece.owned).map(piece => ({ piece, set }))), [sets]);
  const totalQuantity = useMemo(() => allOwnedPieces.reduce((sum, item) => sum + pieceQuantity(item.piece), 0), [allOwnedPieces]);
  const duplicateGroups = useMemo(() => getDuplicateArmorGroups(sets).map(group => {
    const nativeEntry = group.entries.find(entry => !entry.is_custom);
    const preserved = nativeEntry || group.entries[0];
    return { ...group, preservedId: preserved?.id, removable: group.entries.filter(entry => entry.is_custom && String(entry.id) !== String(preserved?.id)) };
  }).filter(group => group.removable.length > 0), [sets]);

  async function deleteDuplicate(entry, group) {
    if (!onDeleteArmorSet || !entry?.is_custom || String(entry.id) === String(group.preservedId)) return;
    const confirmed = window.confirm(`Excluir a duplicata "${group.label}"? O registro preservado não será alterado.`);
    if (!confirmed) return;
    setDuplicateBusy(String(entry.id));
    setDuplicateNotice('');
    try {
      const result = await onDeleteArmorSet(entry.id);
      if (!result?.success) throw new Error(result?.error || 'Não foi possível excluir a duplicata.');
      setDuplicateNotice(`Registro duplicado removido: ${group.label}.`);
    } catch (error) {
      setDuplicateNotice(`Erro ao remover duplicata: ${error.message}`);
    } finally {
      setDuplicateBusy(null);
      // A confirmação nativa e a atualização do banco devolvem o foco ao
      // botão de duplicidade em alguns builds do Electron. Reancora a busca
      // sem rolar a página nem alterar o texto digitado.
      focusSearchSoon();
    }
  }

  const groups = useMemo(() => {
    const map = new Map();
    sets.forEach(set => {
      const variants = map.get(variantKey(set)) || [];
      variants.push(summarizeVariant(set));
      map.set(variantKey(set), variants);
    });
    return [...map.values()].map(variants => {
      const representative = variants[0].set;
      const ownedTypes = variants.reduce((sum, item) => sum + item.ownedTypes, 0);
      const total = variants.reduce((sum, item) => sum + item.total, 0);
      const totalQuantityGroup = variants.reduce((sum, item) => sum + item.totalQuantity, 0);
      const matches = !query || [representative.base_name, representative.manufacturer, representative.type, ...variants.map(item => item.set.variant_name), ...variants.flatMap(item => item.pieces.map(piece => piece.piece_name))].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(query));
      const typeMatches = typeFilter === 'all' || representative.type === typeFilter;
      const statusMatches = statusFilter === 'all' || (statusFilter === 'complete' && variants.every(item => item.complete)) || (statusFilter === 'partial' && ownedTypes > 0 && ownedTypes < total) || (statusFilter === 'none' && ownedTypes === 0);
      return { key: variantKey(representative), baseName: representative.base_name, manufacturer: representative.manufacturer, type: representative.type, variants, ownedTypes, total, totalQuantity: totalQuantityGroup, lastObtainedAt: Math.max(...variants.map(item => item.lastObtainedAt), 0), matches, typeMatches, statusMatches };
    }).filter(group => group.matches && group.typeMatches && group.statusMatches).sort((a, b) => {
      if (sortBy === 'quantity') return b.totalQuantity - a.totalQuantity;
      if (sortBy === 'name') return `${a.baseName} ${a.manufacturer}`.localeCompare(`${b.baseName} ${b.manufacturer}`);
      return b.lastObtainedAt - a.lastObtainedAt;
    });
  }, [sets, query, typeFilter, statusFilter, sortBy]);

  const filteredPieces = useMemo(() => {
    const source = activeTab === 'wishlist' ? wishlistPieces : allOwnedPieces;
    return source.filter(({ piece, set }) => (typeFilter === 'all' || set.type === typeFilter) && (!query || `${set.base_name} ${set.variant_name} ${piece.piece_name}`.toLocaleLowerCase('pt-BR').includes(query))).sort((a, b) => sortBy === 'name' ? String(a.piece.piece_name || '').localeCompare(String(b.piece.piece_name || '')) : (Date.parse(b.piece.obtained_date || '') || 0) - (Date.parse(a.piece.obtained_date || '') || 0));
  }, [activeTab, allOwnedPieces, wishlistPieces, query, typeFilter, sortBy]);

  const activeItems = activeTab === 'variants' ? groups : filteredPieces;
  const totalPages = Math.max(1, Math.ceil(activeItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleItems = activeItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const percentage = stats?.totalPieces ? Math.round((stats.ownedPieces / stats.totalPieces) * 100) : 0;

  const tabs = [
    { id: 'variants', label: 'Variantes', icon: Shield, count: groups.length },
    { id: 'pieces', label: 'Peças obtidas', icon: Package, count: allOwnedPieces.length },
    { id: 'wishlist', label: 'Wishlist', icon: Star, count: wishlistPieces.length },
  ];

  return (
    <div className="armor-collection-page">
      <div className="page-header">
        <div><div className="page-title">MINHA COLEÇÃO</div><div className="page-subtitle">{groups.length} grupos · {allOwnedPieces.length} tipos obtidos · {totalQuantity} peças físicas</div></div>
        <div className="armor-collection-score"><Trophy size={17} /><strong>{percentage}%</strong><span>COLEÇÃO</span></div>
      </div>
      <div className="page-body armor-collection-body">
        <div className="armor-collection-stats">
          <div><strong>{groups.length}</strong><span>Variantes com posse</span></div>
          <div><strong>{totalQuantity}</strong><span>Peças físicas</span></div>
          <div><strong>{stats?.completeSets || 0}</strong><span>Sets completos</span></div>
          <div><strong>{wishlistPieces.length}</strong><span>Wishlist</span></div>
        </div>
        {(duplicateGroups.length > 0 || showDuplicateManager) && <section className={`armor-duplicate-manager ${showDuplicateManager ? 'is-open' : ''}`}>
          <div className="armor-duplicate-manager-heading">
            <div><strong><Wrench size={14}/> HIGIENIZAÇÃO DA COLEÇÃO</strong><small>{duplicateGroups.length ? `${duplicateGroups.length} grupo(s) com registros duplicados detectado(s).` : 'Nenhuma duplicidade pendente.'}</small></div>
            <button type="button" onClick={() => { setShowDuplicateManager(value => !value); focusSearchSoon(); }}>{showDuplicateManager ? 'Ocultar' : 'Revisar duplicidades'}{showDuplicateManager ? <X size={13}/> : <AlertTriangle size={13}/>}</button>
          </div>
          {showDuplicateManager && <>
            {duplicateNotice && <div className={`armor-duplicate-notice ${duplicateNotice.startsWith('Erro') ? 'error' : 'success'}`}>{duplicateNotice}</div>}
            {duplicateGroups.length === 0 ? <div className="armor-duplicate-empty"><CheckCircle2 size={16}/> Nenhuma duplicidade restante na coleção.</div> : <div className="armor-duplicate-list">
              {duplicateGroups.map(group => <article className="armor-duplicate-group" key={group.key}>
                <div className="armor-duplicate-group-title"><strong>{group.label}</strong><span>{group.entries.length} registros com a mesma identidade</span></div>
                <div className="armor-duplicate-entries">{group.entries.map((entry, index) => {
                  const preserved = String(entry.id) === String(group.preservedId);
                  const owned = (entry.pieces || []).filter(piece => piece.owned).length;
                  return <div className={`armor-duplicate-entry ${preserved ? 'preserved' : 'removable'}`} key={entry.id}>
                    <div><strong>{entry.variant_name && entry.variant_name !== 'Base' ? entry.variant_name : 'Variante Base'}</strong><small>ID {entry.id} · {entry.manufacturer || 'Fabricante não informado'} · {owned}/{(entry.pieces || []).length} peças obtidas</small></div>
                    {preserved ? <span className="armor-duplicate-preserved"><CheckCircle2 size={12}/> PRESERVAR</span> : <button type="button" disabled={duplicateBusy === String(entry.id)} onClick={() => deleteDuplicate(entry, group)}><Trash2 size={12}/>{duplicateBusy === String(entry.id) ? 'Removendo...' : 'Excluir duplicata'}</button>}
                  </div>;
                })}</div>
              </article>)}
            </div>}
          </>}
        </section>}
        <div className="armor-collection-toolbar">
          <div className="armor-search-wrap"><Search size={14} /><input ref={searchInputRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar base, variante, fabricante ou peça..." /></div>
          <select className="filter-select" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">Todos os tipos</option><option value="Light">Leve</option><option value="Médio">Médio</option><option value="Heavy">Pesado</option><option value="Special">Especial</option></select>
          {activeTab === 'variants' && <select className="filter-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Todos os status</option><option value="complete">Completos</option><option value="partial">Parciais</option><option value="none">Sem peças</option></select>}
          <select className="filter-select" value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="recent">Mais recentes</option><option value="name">Nome A-Z</option><option value="quantity">Maior quantidade</option></select>
          <div className="armor-view-toggle"><button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}><List size={14} /></button><button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}><LayoutGrid size={14} /></button></div>
        </div>
        <div className="armor-collection-tabs">{tabs.map(tab => { const Icon = tab.icon; return <button type="button" key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}><Icon size={14} />{tab.label}<b>{tab.count}</b></button>; })}</div>
        <div className="armor-results-caption">{activeItems.length} resultado(s) · página {safePage}/{totalPages}</div>

        {activeItems.length === 0 ? <div className="empty-state"><Shield size={56} className="empty-state-icon" /><div className="empty-state-title">NENHUM REGISTRO ENCONTRADO</div><div className="empty-state-text">Ajuste a busca ou marque peças como obtidas.</div></div> : activeTab === 'variants' ? (
          <div className={`armor-variant-list ${viewMode === 'grid' ? 'is-grid' : ''}`}>
            {visibleItems.map(group => (
              <div className="armor-variant-group" key={group.key}>
                <div className="armor-variant-group-heading"><div><strong>{group.baseName}</strong><span>{group.manufacturer || 'Fabricante não informado'} · {TYPE_LABELS[group.type] || group.type}</span></div><b>{group.variants.length} variante{group.variants.length === 1 ? '' : 's'}</b></div>
                {group.variants.map(item => <VariantCard key={item.set.id} item={item} expanded={expanded === item.set.id} onExpand={() => setExpanded(expanded === item.set.id ? null : item.set.id)} onSelect={setSelectedSet} onTogglePiece={onTogglePiece} onUpdateQuantity={onUpdatePieceQuantity} />)}
              </div>
            ))}
          </div>
        ) : (
          <div className="armor-piece-row-list">{visibleItems.map(({ piece, set }) => <PieceRow key={piece.id} piece={piece} set={set} onTogglePiece={onTogglePiece} onTogglePieceWishlist={onTogglePieceWishlist} onUpdateQuantity={onUpdatePieceQuantity} />)}</div>
        )}
        {activeItems.length > PAGE_SIZE && <div className="armor-pagination"><button type="button" disabled={safePage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>‹ Anterior</button><span>{safePage} / {totalPages}</span><button type="button" disabled={safePage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Próxima ›</button></div>}
      </div>
      {selectedSet && <ArmorSetModal set={selectedSet} sets={sets} onClose={() => setSelectedSet(null)} onTogglePiece={onTogglePiece} onTogglePieceWishlist={onTogglePieceWishlist} onUpdatePieceNotes={onupdatePieceNotes} />}
    </div>
  );
}
