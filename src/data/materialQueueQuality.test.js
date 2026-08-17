import { calcShoppingList, loadQueue, saveQueue } from './materialQueue';
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
});

export {};
