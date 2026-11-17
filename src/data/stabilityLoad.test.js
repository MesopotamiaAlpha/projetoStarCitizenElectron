import { performance } from 'perf_hooks';
import { filterInventoryItems } from './inventorySearch';
import {
  cargoInputToStorage,
  cargoEquivalentTotal,
  cargoToScu,
  normalizeCargoQuantity,
  parseCargoInput,
} from './cargoUnits';

describe('stability load — 4.000 registros', () => {
  const items = Array.from({ length: 4000 }, (_, index) => ({
    id: index + 1,
    name: `${index % 5 === 0 ? 'Iron' : 'Inventory Item'} ${String(index).padStart(4, '0')}`,
    system: ['Stanton', 'Pyro', 'Nyx'][index % 3],
    location_name: ['New Babbage', 'Port Tressler', 'Area18'][index % 3],
    category: ['Armor', 'Ore', 'Component', 'Consumable'][index % 4],
    manufacturer: index % 2 ? 'RSI' : 'Drake',
    notes: index % 17 === 0 ? 'reserved mission stock' : '',
    quantity: (index % 37) + 1,
    value_auec: (index % 100) * 1250,
  }));

  test('filtra e ordena 4.000 itens sem mutar a coleção original', () => {
    const originalFirstId = items[0].id;
    const start = performance.now();
    let result = [];
    for (let iteration = 0; iteration < 50; iteration += 1) {
      result = filterInventoryItems(items, {
        system: iteration % 2 ? 'Pyro' : null,
        search: iteration % 3 ? 'iron' : '',
        category: iteration % 4 ? 'all' : 'Ore',
        sortBy: iteration % 2 ? 'value' : 'name',
      });
    }
    const elapsedMs = performance.now() - start;

    expect(items).toHaveLength(4000);
    expect(items[0].id).toBe(originalFirstId);
    expect(result.every(item => item.name.toLocaleLowerCase().includes('iron'))).toBe(true);
    expect(elapsedMs).toBeLessThan(1500);
  });

  test('agrega 4.000 itens sem produzir NaN, infinito ou resíduos binários', () => {
    const entries = items.slice(0, 4000).map((item, index) => ({
      quantity: item.quantity,
      unit: index % 2 ? 'cSCU' : 'SCU',
    }));
    const result = cargoEquivalentTotal(entries, 'cSCU');

    expect(result.unit).toBe('cSCU');
    expect(Number.isFinite(result.total)).toBe(true);
    expect(result.total).toBeGreaterThan(0);
    expect(String(result.total)).not.toMatch(/999999|NaN|Infinity/);
  });
});

describe('stability load — cálculos de carga', () => {
  test.each([
    ['0.5456', 'SCU', 54.56],
    ['3', 'SCU', 300],
    ['109', 'cSCU', 109],
    ['1.234', 'cSCU', 1234],
    ['1.234,5', 'cSCU', 1234.5],
    ['938', 'cSCU', 938],
  ])('normaliza %s %s para %s cSCU', (value, unit, expected) => {
    expect(cargoInputToStorage(value, unit).quantity).toBeCloseTo(expected, 8);
  });

  test('mantém conversão reversível entre SCU e cSCU', () => {
    const values = [0.0001, 0.5456, 3, 78.4, 109.891, 5412];
    values.forEach(value => {
      const cscu = normalizeCargoQuantity(value, 'SCU') * 100;
      expect(cargoToScu(cscu, 'cSCU')).toBeCloseTo(value, 8);
    });
  });

  test('preserva números internos e aceita separadores brasileiros sem lançar exceção', () => {
    expect(cargoInputToStorage(109.891, 'SCU').quantity).toBeCloseTo(10989.1, 8);
    expect(parseCargoInput(109.891, 'SCU')).toBe(109.891);
    expect(parseCargoInput('2.000.000', 'cSCU')).toBe(2000000);
    expect(parseCargoInput('2.000.000,50', 'cSCU')).toBe(2000000.5);
    expect(parseCargoInput('', 'cSCU')).toBe(0);
    expect(parseCargoInput('not-a-number', 'cSCU')).toBe(0);
  });
});
