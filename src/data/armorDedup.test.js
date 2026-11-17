import { getArmorIdentity, getDuplicateArmorGroups } from './armorDedup';

describe('identidade e duplicidades de armaduras', () => {
  test('canonicaliza variante embutida no nome da base', () => {
    expect(getArmorIdentity({ base_name: 'Novikov "Ascension"', variant_name: 'Base' }))
      .toBe(getArmorIdentity({ base_name: 'Novikov', variant_name: 'Ascension' }));
  });

  test('detecta duplicidade entre a variante embutida e a variante separada', () => {
    const groups = getDuplicateArmorGroups([
      { id: 1, is_custom: 1, base_name: 'Novikov "Ascension"', variant_name: 'Base' },
      { id: 2, is_custom: 1, base_name: 'Novikov', variant_name: 'Ascension' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].entries.map(entry => entry.id)).toEqual([1, 2]);
  });

  test('não mistura variantes diferentes', () => {
    const groups = getDuplicateArmorGroups([
      { id: 1, base_name: 'Novikov', variant_name: 'Ascension' },
      { id: 2, base_name: 'Novikov', variant_name: 'Crush' },
    ]);
    expect(groups).toHaveLength(0);
  });
});
