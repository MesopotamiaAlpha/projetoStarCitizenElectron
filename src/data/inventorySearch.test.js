import { filterInventoryItems } from './inventorySearch';

describe('filtro do Inventário de Itens', () => {
  test('retorna somente um registro quando a busca corresponde a um de dois itens', () => {
    const items = [
      { id: 1, name: 'Ace Interceptor Helmet', category: 'Armadura', quantity: 1, system: 'Stanton', location_name: 'New Babbage' },
      { id: 2, name: 'Gold', category: 'Minério', quantity: 20, system: 'Pyro', location_name: 'Ruin Station' },
    ];

    const result = filterInventoryItems(items, { search: 'Ace Interceptor Helmet' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  test('não filtra por um local especial usado para ver todos os itens do sistema', () => {
    const items = [
      { id: 1, name: 'Iron', system: 'Stanton', location_name: 'New Babbage' },
      { id: 2, name: 'Gold', system: 'Stanton', location_name: 'Port Tressler' },
    ];

    const result = filterInventoryItems(items, { system: 'Stanton', location: '__all_in_system' });

    expect(result.map(item => item.id)).toEqual([2, 1]);
  });
});
