import {
  applyInventoryStockConsumption,
  inventoryAvailableQuantity,
  inventoryStockLocationKey,
  planInventoryStockConsumption,
} from './inventoryStockConsumption';

describe('consumo de estoque do Inventário por venda UEX', () => {
  const items = [
    { id: 'iron-a', name: 'Ace Interceptor Helmet', quantity: 3, reservations: [], system: 'Stanton', location_type: 'Outpost', location_name: 'New Babbage' },
    { id: 'iron-b', name: 'Ace Interceptor Helmet', quantity: 5, reservations: [{ id: 'reserved', quantity: 2 }], system: 'Stanton', location_type: 'Outpost', location_name: 'New Babbage' },
    { id: 'iron-c', name: 'Ace Interceptor Helmet', quantity: 10, reservations: [], system: 'Pyro', location_type: 'Station', location_name: 'Ruined Station' },
  ];

  test('calcula disponibilidade sem consumir unidades reservadas', () => {
    expect(inventoryAvailableQuantity(items[1])).toBe(3);
    expect(inventoryStockLocationKey(items[0])).toBe('Stanton::Outpost::New Babbage');
  });

  test('consome somente nos locais vinculados e distribui a baixa entre registros', () => {
    const plan = planInventoryStockConsumption(items, {
      name: 'ace interceptor helmet',
      locationKeys: ['Stanton::Outpost::New Babbage'],
      quantity: 5,
    });
    expect(plan.success).toBe(true);
    expect(plan.consumed).toBe(5);
    expect(plan.allocations).toHaveLength(2);
    expect(plan.allocations.map(row => row.amount)).toEqual([3, 2]);
    const next = applyInventoryStockConsumption(items, plan);
    expect(next.find(row => row.id === 'iron-a').quantity).toBe(0);
    expect(next.find(row => row.id === 'iron-b').quantity).toBe(3);
    expect(next.find(row => row.id === 'iron-c').quantity).toBe(10);
  });

  test('não cria plano parcial quando o saldo vinculado é insuficiente', () => {
    const plan = planInventoryStockConsumption(items, {
      name: 'Ace Interceptor Helmet',
      locationKeys: ['Stanton::Outpost::New Babbage'],
      quantity: 7,
    });
    expect(plan.success).toBe(false);
    expect(plan.allocations).toHaveLength(0);
    expect(plan.totalAvailable).toBe(6);
  });
});
