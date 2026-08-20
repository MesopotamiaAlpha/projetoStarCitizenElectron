const { performance } = require('node:perf_hooks');

const PIECES = ['Helmet', 'Torso', 'Arms', 'Legs', 'Backpack'];
const TYPES = ['Light', 'Médio', 'Heavy', 'Special'];

function fixture(setCount = 800) {
  return Array.from({ length: setCount }, (_, index) => ({
    id: `bench-set-${index}`,
    base_name: `Armor Base ${String(index % 320).padStart(4, '0')}`,
    variant_name: index % 2 ? `Variante ${index % 8}` : 'Base',
    manufacturer: index % 2 ? 'Drake' : 'RSI',
    type: TYPES[index % TYPES.length],
    pieces: PIECES.map((piece_type, pieceIndex) => ({
      id: `bench-piece-${index}-${pieceIndex}`,
      piece_type,
      piece_name: `${piece_type} ${index}`,
      owned: (index + pieceIndex) % 3 === 0,
      quantity: (index % 4) + 1,
    })),
  }));
}

function summarize(set) {
  const pieces = set.pieces || [];
  const ownedTypes = pieces.filter(piece => piece.owned).length;
  return {
    set,
    pieces,
    ownedTypes,
    total: pieces.length,
    totalQuantity: pieces.reduce((sum, piece) => sum + (piece.owned ? Math.max(1, Number(piece.quantity) || 1) : 0), 0),
  };
}

function groupAndPage(sets, query = '', page = 1, pageSize = 24) {
  const q = query.toLocaleLowerCase('pt-BR');
  const map = new Map();
  for (const set of sets) {
    const key = `${set.base_name}::${set.type}::${set.manufacturer}`;
    const list = map.get(key) || [];
    list.push(summarize(set));
    map.set(key, list);
  }
  const groups = [...map.values()].map(variants => {
    const first = variants[0].set;
    return { baseName: first.base_name, variants, searchable: [first.base_name, first.manufacturer, first.type, ...variants.map(item => item.set.variant_name)].join(' ').toLocaleLowerCase('pt-BR') };
  }).filter(group => !q || group.searchable.includes(q));
  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  return { total: groups.length, page: Math.min(page, totalPages), items: groups.slice((page - 1) * pageSize, page * pageSize) };
}

const sets = fixture();
const pieceCount = sets.reduce((sum, set) => sum + set.pieces.length, 0);
const start = performance.now();
let result;
for (let i = 0; i < 100; i += 1) result = groupAndPage(sets, i % 2 ? 'Armor Base 01' : '', 1, 24);
const elapsed = performance.now() - start;
const memory = process.memoryUsage();
console.log(JSON.stringify({
  sets: sets.length,
  pieces: pieceCount,
  groups: groupAndPage(sets).total,
  visibleItems: result.items.length,
  iterations: 100,
  elapsedMs: Number(elapsed.toFixed(2)),
  averageMs: Number((elapsed / 100).toFixed(3)),
  heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
  pass: elapsed < 1000 && result.items.length <= 24,
}, null, 2));
if (pieceCount !== 4000 || elapsed >= 1000 || result.items.length > 24) process.exitCode = 1;
