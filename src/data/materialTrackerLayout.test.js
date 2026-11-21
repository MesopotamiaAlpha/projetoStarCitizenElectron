import { computeTileLayout, tileDensity, TILE_MIN_SIZE, TILE_MAX_SIZE } from './materialTrackerLayout';

function occupied({ columns, rows, size }, gap = 10) {
  return { w: columns * size + (columns - 1) * gap, h: rows * size + (rows - 1) * gap };
}

describe('layout dos cards quadrados do Tracking', () => {
  test('todos os cards cabem na área quando há espaço suficiente', () => {
    for (const count of [1, 2, 5, 9, 14, 20]) {
      const area = { width: 900, height: 520 };
      const layout = computeTileLayout({ ...area, count });
      const used = occupied(layout);
      expect(layout.fits).toBe(true);
      expect(layout.columns * layout.rows).toBeGreaterThanOrEqual(count);
      expect(used.w).toBeLessThanOrEqual(area.width);
      expect(used.h).toBeLessThanOrEqual(area.height);
      expect(layout.size).toBeGreaterThanOrEqual(TILE_MIN_SIZE);
      expect(layout.size).toBeLessThanOrEqual(TILE_MAX_SIZE);
    }
  });

  test('30 cards de no mínimo 104px não cabem em 900×520: o layout avisa em vez de espremer', () => {
    const layout = computeTileLayout({ width: 900, height: 520, count: 30 });
    expect(layout.fits).toBe(false);
    expect(layout.size).toBe(TILE_MIN_SIZE);
  });

  test('poucos cards não ficam gigantes; muitos cards encolhem', () => {
    const few = computeTileLayout({ width: 1200, height: 700, count: 2 });
    const many = computeTileLayout({ width: 1200, height: 700, count: 24 });
    expect(few.size).toBe(TILE_MAX_SIZE);
    expect(many.size).toBeLessThan(few.size);
    expect(many.fits).toBe(true);
  });

  test('quando não cabe nem no tamanho mínimo, usa o mínimo e libera a rolagem', () => {
    const layout = computeTileLayout({ width: 500, height: 300, count: 60 });
    expect(layout.fits).toBe(false);
    expect(layout.size).toBe(TILE_MIN_SIZE);
    expect(layout.columns).toBeGreaterThanOrEqual(1);
    expect(layout.columns * TILE_MIN_SIZE + (layout.columns - 1) * 10).toBeLessThanOrEqual(500);
  });

  test('entradas vazias ou inválidas não quebram', () => {
    expect(computeTileLayout({ width: 0, height: 0, count: 5 }).columns).toBe(1);
    expect(computeTileLayout({ width: 800, height: 600, count: 0 }).fits).toBe(true);
    expect(computeTileLayout({ width: 800, height: 600, count: NaN }).columns).toBe(1);
  });

  test('densidade do conteúdo acompanha o tamanho', () => {
    expect(tileDensity(104)).toBe('compact');
    expect(tileDensity(150)).toBe('regular');
    expect(tileDensity(200)).toBe('roomy');
  });
});

