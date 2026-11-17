import { addOreEntry, consumeVaultEntries, deductOreEntries, loadVault, loadVaultHistory, saveVault } from './oreVault';

beforeEach(() => {
  window.localStorage.clear();
});

describe('oreVault consumption', () => {
  test('consome uma caixa de 54 cSCU da qualidade e entrada selecionadas', () => {
    saveVault({ entries: [
      { id: 'iron-q800', ore_name: 'Iron', quantity: 108, unit: 'cSCU', quality: '800', location: 'New Babbage' },
      { id: 'iron-q700', ore_name: 'Iron', quantity: 54, unit: 'cSCU', quality: '700', location: 'Levski' },
    ] });

    const result = consumeVaultEntries(['iron-q800'], 54, 'cSCU');
    expect(result.success).toBe(true);
    expect(loadVault().entries.find(entry => entry.id === 'iron-q800').quantity).toBe(54);
    expect(loadVault().entries.find(entry => entry.id === 'iron-q700').quantity).toBe(54);
  });

  test('consome uma unidade de Sadaryx sem aplicar conversão de carga', () => {
    saveVault({ entries: [{ id: 'sadaryx', ore_name: 'Sadaryx', quantity: 3, unit: 'un', quality: '', location: 'Area18' }] });
    const result = consumeVaultEntries(['sadaryx'], 1, 'un');
    expect(result.success).toBe(true);
    expect(loadVault().entries[0].quantity).toBe(2);
  });

  test('não altera o Baú quando não há estoque suficiente para a caixa', () => {
    saveVault({ entries: [{ id: 'iron', ore_name: 'Iron', quantity: 53, unit: 'cSCU', quality: '800', location: 'New Babbage' }] });
    const result = consumeVaultEntries(['iron'], 54, 'cSCU');
    expect(result.success).toBe(false);
    expect(loadVault().entries[0].quantity).toBe(53);
  });

  test('arredonda o saldo após consumo parcial de carga', () => {
    saveVault({ entries: [{ id: 'lindinium', ore_name: 'Lindinium', quantity: 78.4, unit: 'cSCU', quality: '900', location: 'New Babbage' }] });
    deductOreEntries([{ id: 'lindinium', amount: 31.6 }]);
    expect(loadVault().entries[0].quantity).toBe(46.8);
  });

  test('registra entrada e consumo com saldo anterior e posterior', () => {
    addOreEntry({ id: 'history-iron', ore_name: 'Iron', quantity: 108, unit: 'cSCU', quality: '800', location: 'Levski' });
    consumeVaultEntries(['history-iron'], 54, 'cSCU');
    const history = loadVaultHistory();
    expect(history.map(record => record.action)).toEqual(['consume', 'entry']);
    expect(history[0].changes[0]).toMatchObject({ quantity_before: 108, quantity_after: 54, unit_after: 'cSCU' });
  });

  test('registra consumo realizado pelo Tracking', () => {
    saveVault({ entries: [{ id: 'tracking-iron', ore_name: 'Iron', quantity: 100, unit: 'cSCU', quality: '900' }] });
    deductOreEntries([{ id: 'tracking-iron', amount: 31.6 }]);
    const record = loadVaultHistory()[0];
    expect(record.action).toBe('deduct');
    expect(record.source).toBe('material-tracker');
    expect(record.changes[0].quantity_after).toBe(68.4);
  });
});

export {};
