import { loadVault, saveVault } from './oreVault';
import { buildNegotiationSale, loadUexCatalog, loadUexSales, registerNegotiationSale, saveUexCatalog } from './uexSales';

beforeEach(() => {
  window.localStorage.clear();
});

describe('uexSales vault integration', () => {
  test('salva o fechamento date_closed_client quando a conta é compradora', () => {
    const sale = buildNegotiationSale({
      hash: 'buyer-closed-1',
      listing_title: 'Ace Interceptor Helmet',
      price: 150000,
      quantity: 1,
      is_listing_advertiser: 0,
      advertiser_username: 'Seller',
      client_username: 'Me',
      date_closed_client: 1720000456,
    });

    expect(sale.negotiation_role).toBe('buyer');
    expect(sale.date_closed).toBe(1720000456);
  });

  test('desconta uma caixa de minério ao registrar venda e não repete o desconto', () => {
    saveVault({ entries: [{ id: 'iron-q800', ore_name: 'Iron', quantity: 108, unit: 'cSCU', quality: '800', location: 'New Babbage' }] });
    saveUexCatalog([{
      id: 'listing-iron',
      title: 'Iron',
      price: 100000,
      in_stock: 2,
      location: 'New Babbage',
      vault_binding: { entryIds: ['iron-q800'], boxQuantity: 54, boxUnit: 'cSCU', quality: '800' },
    }]);

    const negotiation = { hash:'neg-iron-1', listing_title:'Iron', deal_quantity:1, price:100000, in_stock:2, location:'New Babbage', buyer_username:'Buyer' };
    const first = registerNegotiationSale(negotiation);
    expect(first.vaultConsumption.status).toBe('consumed');
    expect(loadVault().entries[0].quantity).toBe(54);
    expect(loadUexCatalog()[0].in_stock).toBe(1);

    const second = registerNegotiationSale(negotiation);
    expect(second.vaultConsumption.status).toBe('consumed');
    expect(loadVault().entries[0].quantity).toBe(54);
    expect(loadUexSales()).toHaveLength(1);
  });
});

export {};
