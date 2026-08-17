import {
  getInventoryCategoryOptions,
  getInventorySubcategoryOptions,
  getInventoryTaxonomyStats,
  loadInventoryTaxonomy,
  removeInventoryCategory,
  removeInventorySubcategory,
  toggleInventoryCategory,
  toggleInventorySubcategory,
  upsertInventoryCategory,
  upsertInventorySubcategory,
} from './inventoryTaxonomy';

beforeEach(() => {
  window.localStorage.clear();
});

describe('catálogo administrável do Inventário', () => {
  test('cria o seed atual com categorias e subcategorias', () => {
    const categories = loadInventoryTaxonomy();
    const weapons = categories.find(category => category.name === 'Arma Pessoal');

    expect(categories.length).toBeGreaterThan(5);
    expect(weapons.subcategories.some(item => item.name === 'Pistola')).toBe(true);
    expect(getInventoryTaxonomyStats(categories).subcategories).toBeGreaterThan(30);
  });

  test('adiciona categoria e subcategoria e disponibiliza nos seletores', () => {
    const categoryCatalog = upsertInventoryCategory({ name: 'Equipamento Médico', color: '#22d3ee', notes: 'Itens médicos personalizados' });
    const category = categoryCatalog.find(item => item.name === 'Equipamento Médico');
    const next = upsertInventorySubcategory(category.id, { name: 'Kit de Emergência' });

    expect(getInventoryCategoryOptions('', next).some(item => item.name === 'Equipamento Médico')).toBe(true);
    expect(getInventorySubcategoryOptions('Equipamento Médico', '', next).some(item => item.name === 'Kit de Emergência')).toBe(true);
  });

  test('desativa sem apagar a opção e preserva o valor legado selecionado', () => {
    const category = loadInventoryTaxonomy().find(item => item.name === 'Arma Pessoal');
    const inactiveCategories = toggleInventoryCategory(category.id);
    expect(getInventoryCategoryOptions('', inactiveCategories).some(item => item.name === 'Arma Pessoal')).toBe(false);
    expect(getInventoryCategoryOptions('Arma Pessoal', inactiveCategories).some(item => item.name === 'Arma Pessoal')).toBe(true);

    const activeSubcategory = inactiveCategories.find(item => item.id === category.id).subcategories.find(item => item.name === 'Pistola');
    const withInactiveSubcategory = toggleInventorySubcategory(category.id, activeSubcategory.id);
    expect(getInventorySubcategoryOptions('Arma Pessoal', '', withInactiveSubcategory).some(item => item.name === 'Pistola')).toBe(false);
    expect(getInventorySubcategoryOptions('Arma Pessoal', 'Pistola', withInactiveSubcategory).some(item => item.name === 'Pistola')).toBe(true);
  });

  test('remove subcategoria e categoria', () => {
    const category = loadInventoryTaxonomy().find(item => item.name === 'Miscellaneous');
    const subcategory = category.subcategories.find(item => item.name === 'Outro');
    const withoutSubcategory = removeInventorySubcategory(category.id, subcategory.id);
    expect(withoutSubcategory.find(item => item.id === category.id).subcategories.some(item => item.id === subcategory.id)).toBe(false);

    const withoutCategory = removeInventoryCategory(category.id);
    expect(withoutCategory.some(item => item.id === category.id)).toBe(false);
  });
});

export {};
