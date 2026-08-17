import { buildArmorPerformanceFixture, filterSortAndPaginateArmorSets, sumOwnedArmorQuantity } from './armorPerformance';

describe('armor performance scenarios', () => {
  test('processa 2.000 sets sem renderizar todos de uma vez', () => {
    const fixture = buildArmorPerformanceFixture(2000);
    const result = filterSortAndPaginateArmorSets(fixture, { page: 1, pageSize: 48 });

    expect(fixture).toHaveLength(2000);
    expect(result.total).toBe(2000);
    expect(result.totalPages).toBe(42);
    expect(result.items).toHaveLength(48);
    expect(result.page).toBe(1);
  });

  test('filtra qualidade de status e mantém paginação limitada', () => {
    const fixture = buildArmorPerformanceFixture(2000);
    const result = filterSortAndPaginateArmorSets(fixture, { query: 'performance armor 19', type: 'Heavy', status: 'partial', page: 2, pageSize: 24 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThanOrEqual(24);
    expect(result.page).toBeLessThanOrEqual(result.totalPages);
    expect(result.items.every(item => item.type === 'Heavy')).toBe(true);
  });

  test('soma quantidades sem confundir peças não possuídas', () => {
    const fixture = buildArmorPerformanceFixture(2000);
    const total = sumOwnedArmorQuantity(fixture);

    expect(total).toBeGreaterThan(0);
    expect(Number.isFinite(total)).toBe(true);
  });
});

export {};
