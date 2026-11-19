// Layout da visualização em cards quadrados do Tracking de Materiais.
// Escolhe número de colunas e lado do quadrado para que TODOS os cards caibam na
// área visível. Quando nem no tamanho mínimo cabem, `fits` é false e a tela rola.

export const TILE_MIN_SIZE = 104;
export const TILE_MAX_SIZE = 220;
export const TILE_GAP = 10;

export function computeTileLayout({
  width,
  height,
  count,
  gap = TILE_GAP,
  minSize = TILE_MIN_SIZE,
  maxSize = TILE_MAX_SIZE,
}) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  if (!total || !(width > 0) || !(height > 0)) {
    return { columns: 1, rows: total || 1, size: minSize, fits: true };
  }

  let best = null;
  for (let columns = 1; columns <= total; columns += 1) {
    const rows = Math.ceil(total / columns);
    const byWidth = (width - gap * (columns - 1)) / columns;
    const byHeight = (height - gap * (rows - 1)) / rows;
    const size = Math.floor(Math.min(byWidth, byHeight, maxSize));
    if (size <= 0) continue;
    // Em empate de tamanho, prefere mais colunas (aproveita melhor a largura).
    if (!best || size > best.size || (size === best.size && columns > best.columns)) {
      best = { columns, rows, size };
    }
  }

  if (best && best.size >= minSize) return { ...best, fits: true };

  // Não cabe: tamanho mínimo, o máximo de colunas que a largura permite, e rolagem.
  const columns = Math.max(1, Math.min(total, Math.floor((width + gap) / (minSize + gap))));
  return { columns, rows: Math.ceil(total / columns), size: minSize, fits: false };
}

// Quantidade de informação que cabe no card conforme o tamanho.
export function tileDensity(size) {
  if (size < 132) return 'compact';
  if (size < 170) return 'regular';
  return 'roomy';
}
