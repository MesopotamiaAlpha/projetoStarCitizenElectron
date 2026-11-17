export const ARMOR_PERFORMANCE_PAGE_SIZE = 48;

export function buildArmorPerformanceFixture(count = 2000) {
  return Array.from({ length: count }, (_, index) => ({
    id: `perf-set-${index}`,
    base_name: `Performance Armor ${String(index).padStart(4, '0')}`,
    variant_name: index % 3 === 0 ? 'Base' : `Variant ${index % 5}`,
    manufacturer: index % 2 === 0 ? 'RSI' : 'Drake',
    type: ['Light', 'Médio', 'Heavy', 'Special'][index % 4],
    rarity: ['Comum', 'Incomum', 'Raro', 'Legendary'][index % 4],
    pieces: ['Helmet', 'Torso', 'Arms', 'Legs', 'Backpack'].map((pieceType, pieceIndex) => ({
      id: `perf-piece-${index}-${pieceIndex}`,
      piece_type: pieceType,
      piece_name: `Performance ${pieceType} ${index}`,
      owned: (index + pieceIndex) % 3 === 0,
      wishlist: (index + pieceIndex) % 11 === 0,
      quantity: (index % 4) + 1,
      obtained_date: new Date(2025, 0, 1 + (index % 365)).toISOString(),
    })),
  }));
}

export function filterSortAndPaginateArmorSets(sets, { query = '', type = 'all', status = 'all', page = 1, pageSize = ARMOR_PERFORMANCE_PAGE_SIZE } = {}) {
  const normalizedQuery = String(query).trim().toLowerCase();
  const filtered = sets.filter(set => {
    const pieces = set.pieces || [];
    const owned = pieces.filter(piece => piece.owned).length;
    const searchable = [set.base_name, set.variant_name, set.manufacturer, set.type, set.rarity].join(' ').toLowerCase();
    const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
    const matchesType = type === 'all' || set.type === type;
    const matchesStatus = status === 'all'
      || (status === 'complete' && pieces.length > 0 && owned === pieces.length)
      || (status === 'partial' && owned > 0 && owned < pieces.length)
      || (status === 'none' && owned === 0);
    return matchesQuery && matchesType && matchesStatus;
  }).sort((a, b) => String(a.base_name).localeCompare(String(b.base_name)));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    total: filtered.length,
    totalPages,
    page: safePage,
    items: filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
  };
}

export function sumOwnedArmorQuantity(sets) {
  return sets.reduce((total, set) => total + (set.pieces || []).reduce((sum, piece) => sum + (piece.owned ? Math.max(1, Number(piece.quantity) || 1) : 0), 0), 0);
}

/**
 * Atualiza somente o registro que contém a peça solicitada.
 * Sets e arrays não relacionados preservam a mesma referência, evitando que
 * uma alteração de quantidade invalide todos os cards memorizados da coleção.
 */
export function updateArmorPieceQuantityInSets(sets, pieceId, quantity) {
  const nextQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  let changed = false;
  const nextSets = (Array.isArray(sets) ? sets : []).map(set => {
    const pieces = Array.isArray(set?.pieces) ? set.pieces : [];
    const pieceIndex = pieces.findIndex(piece => String(piece?.id) === String(pieceId));
    if (pieceIndex < 0) return set;
    const currentPiece = pieces[pieceIndex];
    if (Number(currentPiece.quantity) === nextQuantity && currentPiece.owned) return set;
    const nextPieces = pieces.slice();
    nextPieces[pieceIndex] = { ...currentPiece, quantity: nextQuantity, owned: true };
    changed = true;
    return { ...set, pieces: nextPieces };
  });
  return changed ? nextSets : sets;
}
