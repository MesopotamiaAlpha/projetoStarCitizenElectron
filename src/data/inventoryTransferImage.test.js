import { buildTransferredTarget, serializeInventoryItem } from '../pages/InventoryPage';

describe('imagem do inventário durante transferência', () => {
  const sourceImage = {
    name: 'ace-helmet.png',
    type: 'image/png',
    dataUrl: 'data:image/png;base64,abc',
    addedAt: '2026-08-20T00:00:00.000Z',
  };

  test('preserva a imagem da origem quando o destino não possui thumbnail', () => {
    const target = buildTransferredTarget(
      { id: 2, name: 'Ace Helmet', quantity: 1, item_image: null },
      { id: 1, name: 'Ace Helmet', quantity: 4, item_image: sourceImage },
      2,
    );

    expect(target.quantity).toBe(3);
    expect(target.item_image).toEqual(sourceImage);
  });

  test('mantém a imagem já existente no destino quando ambas possuem thumbnail', () => {
    const targetImage = { ...sourceImage, name: 'destino.png' };
    const target = buildTransferredTarget(
      { id: 2, quantity: 1, item_image: targetImage },
      { id: 1, quantity: 4, item_image: sourceImage },
      1,
    );

    expect(target.item_image).toEqual(targetImage);
  });

  test('serializa a imagem como JSON persistível, nunca como [object Object]', () => {
    const serialized = serializeInventoryItem({ id: 1, item_image: sourceImage });
    expect(typeof serialized.item_image).toBe('string');
    expect(serialized.item_image).not.toContain('[object Object]');
    expect(JSON.parse(serialized.item_image)).toMatchObject(sourceImage);
  });
});
