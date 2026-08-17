import { cargoInputToStorage } from './cargoUnits';
import { addOreEntry, deductOreEntries, loadVault, saveVault } from './oreVault';
import { calcShoppingList, dequeueBlueprint, loadQueue, saveQueue } from './materialQueue';

beforeEach(() => {
  window.localStorage.clear();
});

describe('fluxo completo da blueprint Coverall', () => {
  const coverallQueue = () => ({
    queuedBlueprints: [{
      bpId: 'coverall-test',
      bpName: 'Coverall',
      quantity: 1,
      ingredients: [
        { material_name: 'Lindinium', quantity: 110, unit: 'cSCU', quality_min: 0 },
        { material_name: 'Feynmaline', quantity: 58, unit: 'un', quality_min: 0 },
      ],
    }],
    collectedMaterials: {},
  });

  test('converte, acompanha, completa e consome o craft em etapas', () => {
    saveQueue(coverallQueue());

    // Primeira coleta: o jogo mostra 0,109 SCU.
    const firstLindinium = cargoInputToStorage('0,109', 'SCU');
    expect(firstLindinium.quantity).toBe(10.9);
    expect(firstLindinium.unit).toBe('cSCU');

    saveVault({ entries: [
      { id: 'lindinium-first', ore_name: 'Lindinium', quantity: firstLindinium.quantity, unit: firstLindinium.unit, quality: '900', location: 'New Babbage' },
      { id: 'feynmaline', ore_name: 'Feynmaline', quantity: 58, unit: 'un', quality: '', location: 'New Babbage' },
    ] });

    let list = calcShoppingList(loadQueue(), loadVault().entries);
    const lindiniumPartial = list.find(item => item.material_name === 'Lindinium');
    const feynmalineComplete = list.find(item => item.material_name === 'Feynmaline');
    expect(lindiniumPartial).toMatchObject({ collected: 10.9, remaining: 99.1 });
    expect(feynmalineComplete).toMatchObject({ collected: 58, remaining: 0 });

    // O uso parcial no painel não pode descontar o Baú.
    expect(loadVault().entries.find(entry => entry.id === 'lindinium-first').quantity).toBe(10.9);

    // Segunda coleta: completar os 99,1 cSCU restantes.
    addOreEntry({
      id: 'lindinium-second',
      ore_name: 'Lindinium',
      quantity: 99.1,
      unit: 'cSCU',
      quality: '900',
      location: 'New Babbage',
    });

    list = calcShoppingList(loadQueue(), loadVault().entries);
    expect(list.find(item => item.material_name === 'Lindinium')).toMatchObject({ collected: 110, remaining: 0 });
    expect(list.find(item => item.material_name === 'Feynmaline')).toMatchObject({ collected: 58, remaining: 0 });

    // Conclusão do craft: só agora o Baú é consumido de forma atômica.
    deductOreEntries([
      { id: 'lindinium-first', amount: 10.9 },
      { id: 'lindinium-second', amount: 99.1 },
      { id: 'feynmaline', amount: 58 },
    ]);
    expect(loadVault().entries).toHaveLength(0);

    // A blueprint concluída sai da fila; não deve voltar a aparecer como faltante.
    dequeueBlueprint('coverall-test');
    expect(loadQueue().queuedBlueprints).toHaveLength(0);
  });

  test('limita o uso ao 1 cSCU quando há 109 disponíveis e a Coverall precisa de 110', () => {
    saveQueue(coverallQueue());
    saveVault({ entries: [{ id: 'lindinium-109', ore_name: 'Lindinium', quantity: 109, unit: 'cSCU', quality: '900' }] });

    const item = calcShoppingList(loadQueue(), loadVault().entries).find(entry => entry.material_name === 'Lindinium');
    expect(item).toMatchObject({ needed_total: 110, collected: 109, remaining: 1 });

    // O painel pode selecionar no máximo o restante necessário: 1 cSCU.
    // Os 108 cSCU excedentes continuam preservados no Baú.
    expect(Math.min(109, item.remaining)).toBe(1);
    expect(loadVault().entries[0].quantity).toBe(109);
  });

  test('mantém o estoque quando só a primeira etapa está disponível', () => {
    saveQueue(coverallQueue());
    const firstLindinium = cargoInputToStorage('0,109', 'SCU');
    saveVault({ entries: [{ id: 'lindinium-first', ore_name: 'Lindinium', quantity: firstLindinium.quantity, unit: firstLindinium.unit, quality: '900' }] });

    const list = calcShoppingList(loadQueue(), loadVault().entries);
    expect(list.find(item => item.material_name === 'Lindinium')).toMatchObject({ collected: 10.9, remaining: 99.1 });
    expect(list.find(item => item.material_name === 'Feynmaline')).toMatchObject({ collected: 0, remaining: 58 });
    expect(loadVault().entries[0].quantity).toBe(10.9);
  });
});

export {};
