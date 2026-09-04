import { calcShoppingList, loadQueue, saveQueue, queueBlueprint, syncQueuedBlueprint } from './materialQueue';
import { loadVault, saveVault } from './oreVault';

beforeEach(() => {
  window.localStorage.clear();
});

describe('qualidade mínima dos materiais no Tracking', () => {
  test('considera somente qualidade igual ou superior à exigida', () => {
    saveQueue({
      queuedBlueprints: [{
        bpId: 'iron-quality-test',
        bpName: 'Blueprint Iron Q800',
        quantity: 1,
        ingredients: [{ material_name: 'Iron', quantity: 100, unit: 'cSCU', quality_min: 800 }],
      }],
      collectedMaterials: {},
    });
    saveVault({ entries: [
      { id: 'iron-q799', ore_name: 'Iron', quantity: 100, unit: 'cSCU', quality: '799' },
      { id: 'iron-q800', ore_name: 'Iron', quantity: 50, unit: 'cSCU', quality: '800' },
      { id: 'iron-q900', ore_name: 'Iron', quantity: 50, unit: 'cSCU', quality: '900' },
    ] });

    let item = calcShoppingList(loadQueue(), loadVault().entries).find(entry => entry.material_name === 'Iron');
    expect(item).toMatchObject({ quality_min: 800, collected: 100, remaining: 0 });

    saveVault({ entries: [
      { id: 'iron-q799', ore_name: 'Iron', quantity: 100, unit: 'cSCU', quality: '799' },
      { id: 'iron-q800', ore_name: 'Iron', quantity: 50, unit: 'cSCU', quality: '800' },
    ] });
    item = calcShoppingList(loadQueue(), loadVault().entries).find(entry => entry.material_name === 'Iron');
    expect(item).toMatchObject({ collected: 50, remaining: 50 });
  });

  test('aceita aliases legados qualityMin e quality no requisito', () => {
    saveQueue({
      queuedBlueprints: [{
        bpId: 'legacy-quality-test',
        bpName: 'Blueprint Legacy Quality',
        quantity: 1,
        ingredients: [{ material_name: 'Iron', quantity: 1, unit: 'un', qualityMin: 800 }],
      }],
      collectedMaterials: {},
    });
    saveVault({ entries: [{ id: 'iron-q850', ore_name: 'Iron', quantity: 1, unit: 'un', quality: '850' }] });
    const item = calcShoppingList(loadQueue(), loadVault().entries).find(entry => entry.material_name === 'Iron');
    expect(item).toMatchObject({ quality_min: 800, collected: 1, remaining: 0 });
  });

  test('separa o mesmo minério por qualidade e preserva a blueprint que exige cada faixa', () => {
    saveQueue({
      queuedBlueprints: [
        {
          bpId: 'fr-66',
          bpName: 'FR-66',
          quantity: 1,
          ingredients: [{ material_name: 'Stileron', quantity: 10, unit: 'un', quality_min: 700 }],
        },
        {
          bpId: 'js-400',
          bpName: 'JS-400',
          quantity: 1,
          ingredients: [{ material_name: 'Stileron', quantity: 20, unit: 'un', quality_min: 900 }],
        },
      ],
      collectedMaterials: {},
    });
    saveVault({ entries: [
      { id: 'stileron-q750', ore_name: 'Stileron', quantity: 10, unit: 'un', quality: '750' },
      { id: 'stileron-q900', ore_name: 'Stileron', quantity: 20, unit: 'un', quality: '900' },
    ] });

    const items = calcShoppingList(loadQueue(), loadVault().entries)
      .filter(entry => entry.material_name === 'Stileron')
      .sort((a, b) => a.quality_min - b.quality_min);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ quality_min: 700, collected: 10, remaining: 0 });
    expect(items[0].usedBy).toEqual([
      expect.objectContaining({ bpName: 'FR-66', quality_min: 700 }),
    ]);
    expect(items[1]).toMatchObject({ quality_min: 900, collected: 20, remaining: 0 });
    expect(items[1].usedBy).toEqual([
      expect.objectContaining({ bpName: 'JS-400', quality_min: 900 }),
    ]);
  });

  test('sincroniza a qualidade quando uma blueprint já enfileirada é editada', () => {
    queueBlueprint({
      id: 'queued-quality-test',
      name: 'Blueprint Editável',
      category: 'FPS Weapon',
      ingredients: [{ material_name: 'Iron', quantity: 1, unit: 'un', quality_min: 0 }],
    });

    syncQueuedBlueprint({
      id: 'queued-quality-test',
      name: 'Blueprint Editável',
      category: 'FPS Weapon',
      ingredients: [{ material_name: 'Iron', quantity: 1, unit: 'un', quality_min: 800 }],
    });
    saveVault({ entries: [
      { id: 'iron-q799', ore_name: 'Iron', quantity: 1, unit: 'un', quality: '799' },
      { id: 'iron-q800', ore_name: 'Iron', quantity: 1, unit: 'un', quality: '800' },
    ] });

    const item = calcShoppingList(loadQueue(), loadVault().entries).find(entry => entry.material_name === 'Iron');
    expect(loadQueue().queuedBlueprints[0].ingredients[0]).toMatchObject({ quality_min: 800 });
    expect(item).toMatchObject({ quality_min: 800, collected: 1, remaining: 0 });
  });
});

export {};
