import { extractActiveCompetitorPrices, recommendDiscount } from './uexDiscount';

describe('Análise de desconto UEX', () => {
  test('recomenda desconto abaixo do menor concorrente e calcula valor anterior', () => {
    const result = recommendDiscount({ currentPrice: 1000000, competitorPrices: [950000, 980000, 1200000] });
    expect(result.status).toBe('discount_recommended');
    expect(result.previousPrice).toBe(1000000);
    expect(result.competitorLowest).toBe(950000);
    expect(result.suggestedPrice).toBe(940500);
    expect(result.discountValue).toBe(59500);
    expect(result.discountPercent).toBeCloseTo(5.95, 5);
  });

  test('não sugere desconto quando o anúncio já é o mais barato', () => {
    const result = recommendDiscount({ currentPrice: 900000, competitorPrices: [950000, 1000000] });
    expect(result.status).toBe('already_competitive');
    expect(result.suggestedPrice).toBe(900000);
    expect(result.discountValue).toBe(0);
  });

  test('retorna falta de dados quando não há concorrentes ativos', () => {
    const result = recommendDiscount({ currentPrice: 500000, competitorPrices: [] });
    expect(result.status).toBe('insufficient_data');
    expect(result.suggestedPrice).toBeNull();
  });

  test('filtra item correto, anúncios encerrados e o próprio anúncio', () => {
    const prices = extractActiveCompetitorPrices([
      { id: 10, id_item: 7, operation: 'sell', is_sold_out: 0, price: 100 },
      { id: 11, id_item: 7, operation: 'sell', is_sold_out: 1, price: 90 },
      { id: 12, id_item: 8, operation: 'sell', is_sold_out: 0, price: 80 },
      { id: 13, id_item: 7, operation: 'buy', is_sold_out: 0, price: 70 },
      { id: 14, id_item: 7, operation: 'sell', status: 'closed', price: 60 },
    ], { itemId: 7, ownListingId: 10 });
    expect(prices).toEqual([]);
  });
});
