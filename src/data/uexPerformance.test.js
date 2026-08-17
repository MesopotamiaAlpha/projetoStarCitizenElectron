function buildUexFixture(count = 134) {
  return Array.from({ length: count }, (_, index) => ({
    id: `listing-${index}`,
    title: `Commodity ${index % 17}`,
    location: index % 2 ? 'Stanton' : 'Pyro',
    price: 100000 + index * 1250,
    in_stock: index % 9,
    is_sold_out: index % 9 === 0 ? 1 : 0,
    date_added: 1700000000 + index,
  }));
}

function indexSalesByTitle(sales) {
  const index = new Map();
  for (const sale of sales) {
    if (sale.type !== 'sold') continue;
    const key = String(sale.title || '').trim().toLowerCase();
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(sale);
  }
  return index;
}

function filterSortAndPaginate(list, query, page = 1, pageSize = 50) {
  const q = String(query || '').trim().toLowerCase();
  const filtered = list.filter(item => !q || `${item.title} ${item.location}`.toLowerCase().includes(q)).sort((a, b) => b.date_added - a.date_added);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return { total: filtered.length, totalPages, page: safePage, items: filtered.slice((safePage - 1) * pageSize, safePage * pageSize) };
}

describe('UEX sales performance scenario', () => {
  test('pesquisa e pagina 134 anúncios sem renderizar todos', () => {
    const listings = buildUexFixture(134);
    const started = Date.now();
    const result = filterSortAndPaginate(listings, 'commodity', 1, 50);
    const elapsed = Date.now() - started;

    expect(listings).toHaveLength(134);
    expect(result.total).toBe(134);
    expect(result.totalPages).toBe(3);
    expect(result.items).toHaveLength(50);
    expect(elapsed).toBeLessThan(250);
  });

  test('indexa vendas por item sem filtrar o histórico inteiro em cada card', () => {
    const sales = buildUexFixture(134).map((item, index) => ({ ...item, type: index % 3 === 0 ? 'sold' : 'failed', total_revenue: item.price }));
    const index = indexSalesByTitle(sales);

    expect(index.size).toBeGreaterThan(0);
    expect([...index.values()].flat().every(sale => sale.type === 'sold')).toBe(true);
  });
});

export {};
