import {
  cargoEquivalentTotal,
  cargoInputToStorage,
  formatCargoBreakdown,
  analyzeCargoQuantityInput,
  cargoToCscu,
  cargoToScu,
  splitCargoBase,
  cargoComposition,
  fromCargoBase,
  parseCargoInput,
  normalizeCargoQuantity,
  toCargoBase,
} from './cargoUnits';

describe('cargoUnits', () => {
  test('mantém a conversão oficial entre SCU e cSCU', () => {
    expect(toCargoBase(1, 'SCU')).toBe(100);
    expect(fromCargoBase(100, 'SCU')).toBe(1);
    expect(cargoToCscu(12.911, 'SCU')).toBe(1291.1);
    expect(cargoToScu(12911, 'cSCU')).toBe(129.11);
  });

  test('aceita separador de milhar brasileiro em entradas de cSCU', () => {
    expect(parseCargoInput('12.911', 'cSCU')).toBe(12911);
    expect(parseCargoInput('12.911,5', 'cSCU')).toBe(12911.5);
    expect(parseCargoInput('129,11', 'SCU')).toBe(129.11);
  });

  test('soma entradas compatíveis em uma unidade escolhida', () => {
    const result = cargoEquivalentTotal([
      { quantity: 1, unit: 'SCU' },
      { quantity: 50, unit: 'cSCU' },
    ], 'SCU');
    expect(result.unit).toBe('SCU');
    expect(result.total).toBe(1.5);
  });

  test('alerta que uma fração digitada em SCU pode ser mais clara em cSCU', () => {
    const result = analyzeCargoQuantityInput('0.31', 'SCU');
    expect(result.severity).toBe('warning');
    expect(result.cscu).toBe(31);
    expect(result.suggestedUnit).toBe('cSCU');
    expect(result.suggestedValue).toBe('31');
    expect(result.formula).toContain('0,31 SCU = 31 cSCU');
  });

  test('mantém uma quantidade válida em cSCU sem sugerir troca de unidade', () => {
    const result = analyzeCargoQuantityInput('543', 'cSCU');
    expect(result.severity).toBe('info');
    expect(result.scu).toBe(5.43);
    expect(result.cscu).toBe(543);
    expect(result.suggestedUnit).toBe('');
  });

  test('soma 7 SCU com 543 cSCU sem remover quantidade', () => {
    const totalCscu = toCargoBase(7, 'SCU') + toCargoBase(543, 'cSCU');
    expect(totalCscu).toBe(1243);
    expect(fromCargoBase(totalCscu, 'SCU')).toBe(12.43);
    expect(splitCargoBase(totalCscu)).toMatchObject({ wholeScu: 12, remainderCscu: 43, scu: 12.43, base: 1243 });
    expect(cargoComposition(totalCscu, 'cSCU').text).toBe('12 SCU + 43 cSCU');
    expect(cargoComposition(totalCscu, 'cSCU').totalText).toBe('12,43 SCU total · 1.243 cSCU');
  });

  test('preserva 596 e 938 como cSCU ao normalizar o cadastro do Baú', () => {
    expect(normalizeCargoQuantity('596', 'cSCU')).toBe(596);
    expect(normalizeCargoQuantity('938', 'cSCU')).toBe(938);
    expect(fromCargoBase(normalizeCargoQuantity('596', 'cSCU'), 'SCU')).toBe(5.96);
    expect(fromCargoBase(normalizeCargoQuantity('938', 'cSCU'), 'SCU')).toBe(9.38);
  });

  test('converte diretamente o valor decimal exibido no jogo para o armazenamento em cSCU', () => {
    const stored = cargoInputToStorage('0.5456', 'SCU');
    expect(stored.unit).toBe('cSCU');
    expect(stored.quantity).toBe(54.56);
    expect(fromCargoBase(stored.quantity, 'SCU')).toBe(0.5456);
    expect(formatCargoBreakdown('0.5456', 'SCU')).toContain('0,5456 SCU');
  });

  test('aceita vírgula decimal no valor exibido pelo jogo', () => {
    expect(cargoInputToStorage('0,5456', 'SCU').quantity).toBe(54.56);
  });

  test('alerta quando uma fração muito pequena foi digitada em cSCU por engano', () => {
    const result = analyzeCargoQuantityInput('0,109', 'cSCU');
    expect(result.severity).toBe('warning');
    expect(result.suggestedUnit).toBe('SCU');
    expect(result.suggestedValue).toBe('0.109');
    expect(result.warning).toContain('10,9 cSCU');
  });
});
