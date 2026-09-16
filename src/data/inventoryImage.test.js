import {
  getInventoryImageDownloadName,
  normalizeItemImage,
  serializeInventoryItem,
} from '../pages/InventoryPage';

describe('imagem original do inventário', () => {
  const originalImage = {
    name: 'screenshot-item.PNG',
    type: 'image/png',
    dataUrl: 'data:image/png;base64,UE5HIG9yaWdpbmFs',
    addedAt: '2026-09-09T12:00:00.000Z',
  };

  test('preserva o dataUrl original e os metadados ao salvar e recarregar', () => {
    const serialized = serializeInventoryItem({ id: 42, name: 'Item UEX', item_image: originalImage });
    expect(typeof serialized.item_image).toBe('string');

    const restored = normalizeItemImage(serialized.item_image);
    expect(restored).toEqual(originalImage);
  });

  test('mantém compatibilidade com registros antigos que guardam somente o dataUrl', () => {
    const restored = normalizeItemImage('data:image/jpeg;base64,SlBFRyBvcmlnaW5hbA==');
    expect(restored).toMatchObject({
      name: 'Imagem do item',
      type: 'image/jpeg',
      dataUrl: 'data:image/jpeg;base64,SlBFRyBvcmlnaW5hbA==',
    });
  });

  test('usa o nome original no download e gera fallback seguro quando necessário', () => {
    expect(getInventoryImageDownloadName(originalImage, 'Item')).toBe('screenshot-item.PNG');
    expect(getInventoryImageDownloadName({ type: 'image/webp' }, 'Helmet / Rare')).toBe('helmet-rare.webp');
  });
});
