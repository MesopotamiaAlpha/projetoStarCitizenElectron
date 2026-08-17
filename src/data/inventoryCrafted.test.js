import { normalizeCraftStatus, normalizeCraftMaterials, normalizeCraftAttachments } from '../pages/InventoryPage';

describe('dados de itens craftados do inventário', () => {
  test('normaliza vários materiais com qualidade, quantidade e unidade', () => {
    const materials = normalizeCraftMaterials(JSON.stringify([
      { name: 'Lindinium', quality_min: 800, quantity: 0.109, unit: 'SCU' },
      { material_name: 'Feynmaline', quality: '', amount: 58, unit: 'un' },
    ]));

    expect(materials).toHaveLength(2);
    expect(materials[0]).toMatchObject({ material: 'Lindinium', quality: '800', quantity: '0.109', unit: 'SCU' });
    expect(materials[1]).toMatchObject({ material: 'Feynmaline', quantity: '58', unit: 'un' });
  });

  test('mantém status antigos e permite valor percentual ou unitário', () => {
    const statuses = normalizeCraftStatus([
      { status: 'Potência', bonus: '+15%' },
      { status: 'Slots', value: 2, value_unit: 'un' },
    ]);

    expect(statuses[0]).toMatchObject({ status: 'Potência', value: '15', value_unit: '%' });
    expect(statuses[1]).toMatchObject({ status: 'Slots', value: '2', value_unit: 'un' });
  });

  test('normaliza imagens, ignora registros sem conteúdo e preserva metadados', () => {
    const attachments = normalizeCraftAttachments([
      { id: 'img-1', name: 'print.png', type: 'image/png', dataUrl: 'data:image/png;base64,abc' },
      { id: 'empty', name: 'sem conteúdo', dataUrl: '' },
    ]);

    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({ id: 'img-1', name: 'print.png', type: 'image/png', dataUrl: 'data:image/png;base64,abc' });
  });
});
