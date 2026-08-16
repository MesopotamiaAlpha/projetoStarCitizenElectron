const catalog = require('../../electron/scmdbBlueprintCatalog.json');

describe('catálogo padrão de blueprints SCMDB', () => {
  test('contém as 1597 blueprints da versão coletada', () => {
    expect(catalog.sourceVersion).toBe('4.9.0-live.12344265');
    expect(catalog.blueprints).toHaveLength(1597);
    expect(catalog.blueprints.every(bp => Array.isArray(bp.materials) && bp.materials.length > 0)).toBe(true);
  });

  test('mantém os materiais exatos de Aves Shrike Arms', () => {
    const blueprint = catalog.blueprints.find(bp => bp.productName === 'Aves Shrike Arms');
    expect(blueprint).toBeTruthy();
    expect(blueprint.materials.map(material => [material.name, material.quantityExact, material.quantityUnit, material.quantitySCU])).toEqual([
      ['Ouratite', '4', 'cSCU', '0.04'],
      ['Aslarite', '2', 'cSCU', '0.02'],
      ['Lindinium', '4', 'cSCU', '0.04'],
    ]);
  });

  test('converte quantidade fracionária para cSCU sem alterar a equivalência em SCU', () => {
    const candidate = catalog.blueprints
      .flatMap(bp => bp.materials.map(material => ({ blueprint: bp.productName, ...material })))
      .find(material => material.quantitySCU === '0.31');
    expect(candidate).toBeTruthy();
    expect(candidate.quantityExact).toBe('31');
    expect(candidate.quantityUnit).toBe('cSCU');
    expect(candidate.quantityCSCU).toBe('31');
  });

  test('inclui Feynmaline como material do tipo item quando publicado assim pelo SCMDB', () => {
    const feynmaline = catalog.blueprints
      .flatMap(bp => bp.materials.map(material => ({ blueprint: bp.productName, ...material })))
      .filter(material => material.name === 'Feynmaline');
    expect(feynmaline.length).toBe(9);
    expect(feynmaline.every(material => material.inputType === 'item' && material.quantityUnit === 'item')).toBe(true);
  });
});

export {};
