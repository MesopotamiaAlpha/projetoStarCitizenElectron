import { getArmorSetOptions, normalizeArmorSetListingName } from './UexSalesPage';

describe('vínculo de sets de armadura com anúncios UEX', () => {
  const completeSet = {
    id: 42,
    base_name: 'Novikov "Ascension" Exploration',
    variant_name: 'Base',
    pieces: [
      { id: 1, piece_type: 'Helmet', owned: 1, quantity: 1 },
      { id: 2, piece_type: 'Torso', owned: 1, quantity: 1 },
      { id: 3, piece_type: 'Arms', owned: 1, quantity: 1 },
      { id: 4, piece_type: 'Legs', owned: 1, quantity: 1 },
    ],
  };

  test('remove o sufixo comercial Suit Set sem alterar o nome salvo', () => {
    expect(normalizeArmorSetListingName('Novikov "Ascension" Exploration Suit Set'))
      .toBe(normalizeArmorSetListingName('Novikov "Ascension" Exploration'));
  });

  test('encontra o set completo usando o título comercial da UEX', () => {
    const matches = getArmorSetOptions({ title: 'Novikov "Ascension" Exploration Suit Set' }, [completeSet]);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(42);
    expect(matches[0].completeQuantity).toBe(1);
  });

  test('retorna quantidade zero quando uma peça cadastrada não está obtida', () => {
    const incomplete = { ...completeSet, pieces: completeSet.pieces.map((piece, index) => index === 3 ? { ...piece, owned: 0, quantity: 0 } : piece) };
    expect(getArmorSetOptions({ title: 'Novikov "Ascension" Exploration Suit Set' }, [incomplete])).toHaveLength(1);
    expect(getArmorSetOptions({ title: 'Novikov "Ascension" Exploration Suit Set' }, [incomplete])[0].completeQuantity).toBe(0);
  });
});
