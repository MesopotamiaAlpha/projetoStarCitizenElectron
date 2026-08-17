import { buildScuSummary, calculateScuValue } from './scuCalculator';

describe('scuCalculator', () => {
  test('converte 0,31 SCU para 31 cSCU e Units', () => {
    const result = calculateScuValue(0.31, 'SCU', 'cSCU');
    expect(result.output).toBe(31);
    expect(result.outputUnit).toBe('cSCU');
    expect(result.summary.scu).toBe(0.31);
    expect(result.summary.cscu).toBe(31);
    expect(result.summary.units).toBe(31);
  });

  test('converte 500 Units para 5 SCU', () => {
    const result = calculateScuValue(500, 'Units', 'SCU');
    expect(result.output).toBe(5);
    expect(result.summary.cscu).toBe(500);
  });

  test('gera resumo completo para 1 SCU', () => {
    const summary = buildScuSummary(100);
    expect(summary.scu).toBe(1);
    expect(summary.cscu).toBe(100);
    expect(summary.mscu).toBe(1000);
    expect(summary.microScu).toBe(1000000);
    expect(summary.text).toContain('1 SCU = 100 cSCU');
  });
});

export {};
