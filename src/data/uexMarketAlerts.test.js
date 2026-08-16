import {
  listingMatchesAlert,
  marketAlertDefaults,
  sortMarketAlertListings,
  filterMarketAlertsForAutomaticCheck,
  shouldCheckMarketAlertAutomatically,
} from './uexMarketAlerts';

describe('UEX market alerts', () => {
  const baseAlert = marketAlertDefaults({
    itemName: 'Gold',
    itemId: 'gold-id',
    qualityAny: false,
    qualityMin: 800,
    qualityMax: 1000,
    priceMode: 'lowest',
    minPrice: 100000,
    maxResults: 5,
  });

  test('mantém todos os anúncios elegíveis acima do preço mínimo', () => {
    expect(listingMatchesAlert(baseAlert, { id: 1, id_item: 'gold-id', operation: 'sell', currency: 'UEC', price: 100000, quality: 864, in_stock: 1 })).toBe(true);
    expect(listingMatchesAlert(baseAlert, { id: 2, id_item: 'gold-id', operation: 'sell', currency: 'UEC', price: 120000, quality: 900, in_stock: 1 })).toBe(true);
    expect(listingMatchesAlert(baseAlert, { id: 3, id_item: 'gold-id', operation: 'sell', currency: 'UEC', price: 99999, quality: 950, in_stock: 1 })).toBe(false);
    expect(listingMatchesAlert(baseAlert, { id: 4, id_item: 'gold-id', operation: 'sell', currency: 'UEC', price: 110000, quality: 799, in_stock: 1 })).toBe(false);
  });

  test('ordena os próximos anúncios pelo menor preço, não apenas pelo primeiro resultado', () => {
    const rows = sortMarketAlertListings(baseAlert, [
      { id: 3, price: 180000, quality: 850 },
      { id: 1, price: 100000, quality: 864 },
      { id: 2, price: 120000, quality: 900 },
    ]);
    expect(rows.map(row => row.id)).toEqual([1, 2, 3]);
  });

  test('filtra qualidade desconhecida quando solicitado', () => {
    const alert = marketAlertDefaults({ itemName: 'Gold', qualityAny: true, qualityKnownOnly: true });
    expect(listingMatchesAlert(alert, { price: 100000, quality: 864, in_stock: 1 })).toBe(true);
    expect(listingMatchesAlert(alert, { price: 100000, title: 'Gold sem qualidade', in_stock: 1 })).toBe(false);
  });

  test('filtra atividade do vendedor, disponibilidade e estoque', () => {
    const alert = marketAlertDefaults({ itemName: 'Gold', maxSellerActivityDays: 7, availability: 'immediate', minListingStock: 2, maxListingStock: 5 });
    const recent = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(listingMatchesAlert(alert, { price: 100000, last_activity: recent, availability: 'immediate', in_stock: 3 })).toBe(true);
    expect(listingMatchesAlert(alert, { price: 100000, last_activity: new Date(Date.now() - 9 * 86400000).toISOString(), availability: 'immediate', in_stock: 3 })).toBe(false);
    expect(listingMatchesAlert(alert, { price: 100000, last_activity: recent, availability: 'negotiable', in_stock: 3 })).toBe(false);
    expect(listingMatchesAlert(alert, { price: 100000, last_activity: recent, availability: 'immediate', in_stock: 1 })).toBe(false);
  });

  test('permite desligar a automação de um alerta sem apagar seus critérios', () => {
    const gold = marketAlertDefaults({ itemName: 'Gold', itemId: 'gold-id', qualityMin: 800, maxPrice: 150000 });
    const sadaryx = marketAlertDefaults({ itemName: 'Sadaryx', itemMode: 'manual', automaticEnabled: false, qualityMin: 700, maxPrice: 200000 });
    const selected = filterMarketAlertsForAutomaticCheck([gold, sadaryx]);

    expect(shouldCheckMarketAlertAutomatically(gold)).toBe(true);
    expect(shouldCheckMarketAlertAutomatically(sadaryx)).toBe(false);
    expect(selected.map(alert => alert.itemName)).toEqual(['Gold']);
    expect(sadaryx.qualityMin).toBe(700);
    expect(sadaryx.maxPrice).toBe(200000);
  });

  test('alertas sem o campo novo permanecem automatizados por compatibilidade', () => {
    expect(shouldCheckMarketAlertAutomatically({ itemName: 'Iron' })).toBe(true);
    expect(shouldCheckMarketAlertAutomatically({ itemName: 'Gold', automaticEnabled: false })).toBe(false);
  });
});

export {};
