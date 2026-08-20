import { loadVault, saveVault } from './oreVault';
import { buildNegotiationSale, closeNegotiation, getNegotiationClosure, loadUexCatalog, loadUexSales, registerNegotiationSale, saveUexCatalog } from './uexSales';

beforeEach(() => {
  window.localStorage.clear();
});

describe('uexSales vault integration', () => {
  test('aplica quantidade e valor total informados ao concluir uma negociação', () => {
    const sale = buildNegotiationSale({
      hash: 'custom-sale-1',
      listing_title: 'Gold',
      price: 100000,
      client_username: 'Buyer',
      is_listing_advertiser: 1,
    }, { quantity: 4, totalRevenue: 900000 });

    expect(sale.qty).toBe(4);
    expect(sale.total_revenue).toBe(900000);
    expect(sale.price).toBe(225000);
  });

  test('calcula o total multiplicando quantidade pelo valor unitário', () => {
    const sale = buildNegotiationSale({
      hash: 'unit-price-sale-1',
      listing_title: 'Gold',
      price: 100000,
      is_listing_advertiser: 1,
    }, { quantity: 3, unitPrice: 200000, totalRevenue: 600000 });

    expect(sale.qty).toBe(3);
    expect(sale.price).toBe(200000);
    expect(sale.total_revenue).toBe(600000);
  });

  test('permite fechar compra com sucesso sem criar uma venda ou informar valor', () => {
    const closure = closeNegotiation('buyer-success-1', 'success', {
      role: 'buyer',
      purchaseCompleted: true,
      saleCreated: false,
    });

    expect(closure.status).toBe('success');
    expect(closure.role).toBe('buyer');
    expect(closure.purchaseCompleted).toBe(true);
    expect(getNegotiationClosure('buyer-success-1').saleCreated).toBe(false);
    expect(loadUexSales()).toHaveLength(0);
  });

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

  test('desconta uma caixa de minério ao registrar venda e não repete o desconto', async () => {
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
    const first = await registerNegotiationSale(negotiation);
    expect(first.vaultConsumption.status).toBe('consumed');
    expect(loadVault().entries[0].quantity).toBe(54);
    expect(loadUexCatalog()[0].in_stock).toBe(1);

    const second = await registerNegotiationSale(negotiation);
    expect(second.vaultConsumption.status).toBe('consumed');
    expect(loadVault().entries[0].quantity).toBe(54);
    expect(loadUexSales()).toHaveLength(1);
  });

  test('consome uma peça de armadura e o Inventário vinculado uma única vez', async () => {
    saveUexCatalog([{
      id: 'listing-armor',
      title: 'Novikov Ascension Helmet',
      in_stock: 2,
      location: 'New Babbage',
      inventory_binding: {
        armorPieceIds: ['armor-piece-1'],
        locationKeys: ['Stanton::Outpost::New Babbage'],
      },
    }]);
    const armorCalls = [];
    const inventoryCalls = [];
    const negotiation = { hash: 'neg-armor-1', listing_title: 'Novikov Ascension Helmet', deal_quantity: 1, price: 250000, location: 'New Babbage' };
    const consumers = {
      onConsumeArmorStock: async payload => { armorCalls.push(payload); return { success: true, consumed: true, status: 'consumed', message: 'armadura baixa' }; },
      onConsumeInventoryStock: async payload => { inventoryCalls.push(payload); return { success: true, consumed: true, status: 'consumed', message: 'item baixa' }; },
    };

    const first = await registerNegotiationSale(negotiation, {}, consumers);
    const second = await registerNegotiationSale(negotiation, {}, consumers);

    expect(first.armorConsumption.status).toBe('consumed');
    expect(first.inventoryConsumption.status).toBe('consumed');
    expect(armorCalls).toHaveLength(1);
    expect(inventoryCalls).toHaveLength(1);
    expect(second.armorConsumption.status).toBe('consumed');
    expect(second.inventoryConsumption.status).toBe('consumed');
    expect(loadUexSales()).toHaveLength(1);
  });
});

export {};
