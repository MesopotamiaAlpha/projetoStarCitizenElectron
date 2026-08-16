import {
  cargoEquivalentTotal,
  analyzeCargoQuantityInput,
  cargoToCscu,
  cargoToScu,
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

  test('alerta quando uma quantidade grande em cSCU parece ter sido pensada em SCU', () => {
    const result = analyzeCargoQuantityInput('311', 'cSCU');
    expect(result.severity).toBe('warning');
    expect(result.scu).toBe(3.11);
    expect(result.suggestedUnit).toBe('SCU');
    expect(result.suggestedValue).toBe('3.11');
  });

  test('preserva 596 e 938 como cSCU ao normalizar o cadastro do Baú', () => {
    expect(normalizeCargoQuantity('596', 'cSCU')).toBe(596);
    expect(normalizeCargoQuantity('938', 'cSCU')).toBe(938);
    expect(fromCargoBase(normalizeCargoQuantity('596', 'cSCU'), 'SCU')).toBe(5.96);
    expect(fromCargoBase(normalizeCargoQuantity('938', 'cSCU'), 'SCU')).toBe(9.38);
  });
});
