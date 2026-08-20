import {
  applyWikeloDeliveryPlan,
  buildWikeloDeliveryPlan,
  getInventoryItemQuantity,
  getWikeloMissionProgress,
  getWikeloMissionShortages,
  scanWikeloItem,
  scanWikeloMissions,
} from './wikeloInventory';

describe('escaneamento e entrega de itens do Wikelo', () => {
  const inventory = [
    { id: 1, name: 'Iron', quantity: 10, location_name: 'New Babbage' },
    { id: 2, name: 'iron', quantity: 5, location_name: 'Levski' },
    { id: 3, name: 'Gold', quantity: 2, location_name: 'Area18' },
  ];

  test('soma itens iguais no escaneamento sem alterar o Inventário', () => {
    const original = JSON.stringify(inventory);
    const item = scanWikeloItem({ id: 'iron-1', name: 'Iron', needed: 12, collected: 0 }, inventory);

    expect(getInventoryItemQuantity('IRON', inventory)).toBe(15);
    expect(item.collected).toBe(12);
    expect(item.from_inventory).toBe(12);
    expect(JSON.stringify(inventory)).toBe(original);
  });

  test('preserva coleta manual e usa apenas o que falta do Inventário', () => {
    const item = scanWikeloItem({ id: 'gold-1', name: 'Gold', needed: 5, collected: 3, from_inventory: 0 }, inventory);

    expect(item.collected).toBe(5);
    expect(item.from_inventory).toBe(2);
    expect(item.inventory_available).toBe(2);
  });

  test('distribui o mesmo estoque entre várias missões sem reutilizar a mesma unidade', () => {
    const missions = [
      { id: 'm1', items: [{ id: 'medal-1', name: 'Medal', needed: 1, collected: 0 }] },
      { id: 'm2', items: [{ id: 'medal-2', name: 'Medal', needed: 1, collected: 0 }] },
      { id: 'm3', items: [{ id: 'medal-3', name: 'Medal', needed: 1, collected: 0 }] },
    ];
    const scanned = scanWikeloMissions(missions, [{ id: 10, name: 'Medal', quantity: 1, location_name: 'New Babbage', system: 'Stanton', location_type: 'Cidade' }], 'Medal');

    expect(scanned.map(mission => mission.items[0].from_inventory)).toEqual([1, 0, 0]);
    expect(scanned.map(mission => mission.items[0].collected)).toEqual([1, 0, 0]);
    expect(scanned[0].items[0].inventory_source_location).toContain('New Babbage');
    expect(scanned[1].items[0].inventory_reserved_for_wikelo).toBe(1);
  });

  test('calcula progresso e libera completude somente quando todos os itens estão completos', () => {
    const pending = { items: [{ needed: 2, collected: 2 }, { needed: 5, collected: 4 }] };
    const complete = { items: [{ needed: 2, collected: 2 }, { needed: 5, collected: 5 }] };

    expect(getWikeloMissionProgress(pending)).toEqual({ total: 2, completed: 1, totalNeeded: 7, totalCollected: 6, percent: 86, complete: false });
    expect(getWikeloMissionProgress(complete)).toEqual({ total: 2, completed: 2, totalNeeded: 7, totalCollected: 7, percent: 100, complete: true });
  });

  test('gera pendências por missão para o Dashboard e ignora itens completos ou entregues', () => {
    const shortages = getWikeloMissionShortages([
      { id: 'asgard', title: 'Asgard', items: [
        { id: 'favor', name: 'Wikelo Favor', needed: 25, collected: 5, unit: 'un' },
        { id: 'medal', name: 'Medal', needed: 2, collected: 2, unit: 'un' },
      ] },
      { id: 'done', title: 'Entregue', wikelo_delivery_status: 'delivered', items: [
        { id: 'iron', name: 'Iron', needed: 10, collected: 0, unit: 'un' },
      ] },
    ]);

    expect(shortages).toEqual([expect.objectContaining({
      missionId: 'asgard', missionTitle: 'Asgard', name: 'Wikelo Favor', remaining: 20, unit: 'un',
    })]);
  });

  test('monta plano distribuído entre locais e aplica consumo somente ao confirmar', () => {
    const mission = { id: 'm1', items: [{ id: 'i1', name: 'Iron', needed: 12, collected: 12 }] };
    const plan = buildWikeloDeliveryPlan(mission, inventory);
    expect(plan.ok).toBe(true);
    expect(plan.allocations.map(row => row.amount)).toEqual([10, 2]);

    const next = applyWikeloDeliveryPlan(inventory, plan);
    expect(next.find(row => row.id === 1)).toBeUndefined();
    expect(next.find(row => row.id === 2).quantity).toBe(3);
    expect(inventory.find(row => row.id === 1).quantity).toBe(10);
  });

  test('recusa entrega quando falta estoque e bloqueia missão já entregue', () => {
    const missing = buildWikeloDeliveryPlan({ items: [{ name: 'Iron', needed: 20, collected: 20 }] }, inventory);
    expect(missing.ok).toBe(false);
    expect(missing.missing[0].name).toBe('Iron');

    const delivered = buildWikeloDeliveryPlan({ wikelo_delivery_status: 'delivered', items: [{ name: 'Iron', needed: 1, collected: 1 }] }, inventory);
    expect(delivered.alreadyDelivered).toBe(true);
    expect(delivered.allocations).toEqual([]);
  });
});

export {};
