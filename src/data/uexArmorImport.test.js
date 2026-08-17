import { getMissingArmorGroups } from './uexArmorImport';
import { saveUexItemsDB } from './uexItemsDB';

describe('importação de armaduras UEX', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('retorna somente grupos ausentes e ignora o set já cadastrado', () => {
    saveUexItemsDB([
      { name: 'Aegis Helmet', section: 'Armor', category: 'Helmets', company_name: 'Aegis' },
      { name: 'Aegis Torso', section: 'Armor', category: 'Torso', company_name: 'Aegis' },
      { name: 'Drake Helmet', section: 'Armor', category: 'Helmets', company_name: 'Drake' },
    ]);

    const missing = getMissingArmorGroups([{ base_name: 'Aegis', is_custom: 1 }]);

    expect(missing).toHaveLength(1);
    expect(missing[0].base_name).toBe('Drake');
    expect(missing[0].pieces).toHaveLength(1);
  });
});
