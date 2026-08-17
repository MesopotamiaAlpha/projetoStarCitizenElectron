import {
  UNKNOWN_VAULT_KEY,
  addToUnknownVault,
  clearUnknownVault,
  getUnknownVaultQuantity,
  loadUnknownVault,
  removeFromUnknownVault,
  dispatchMissionScrip,
  markMissionScripFailed,
  getMissionScripStatus,
} from './unknownVault';

beforeEach(() => {
  window.localStorage.clear();
});

describe('Baú Desconhecido', () => {
  test('adiciona e normaliza uma recompensa de scrip', () => {
    const result = addToUnknownVault({
      name: 'mg scrip',
      quantity: '12',
      source_mission_id: 'mission-1',
      source_mission_title: 'Desafio de Combate - Cenário 5',
    });

    expect(result.duplicate).toBe(false);
    expect(result.item.name).toBe('MG Scrip');
    expect(result.item.quantity).toBe(12);
    expect(loadUnknownVault().items).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(UNKNOWN_VAULT_KEY)).items).toHaveLength(1);
  });

  test('não duplica a mesma recompensa quando o evento é processado novamente', () => {
    const first = addToUnknownVault({
      name: 'Council Scrip',
      quantity: 7,
      source_mission_id: 'mission-duplicate',
      source_mission_title: 'Operação Council',
    });
    const second = addToUnknownVault({
      name: 'Council Scrip',
      quantity: 7,
      source_mission_id: 'mission-duplicate',
      source_mission_title: 'Operação Council',
    });

    expect(second.duplicate).toBe(true);
    expect(second.item.id).toBe(first.item.id);
    expect(loadUnknownVault().items).toHaveLength(1);
    expect(getUnknownVaultQuantity('Council Scrip')).toBe(7);
  });

  test('aceita MG Scrip e Council Scrip da mesma missão como recompensas distintas', () => {
    addToUnknownVault({ name: 'MG Scrip', quantity: 12, source_mission_id: 'mission-two-scripts' });
    addToUnknownVault({ name: 'Council Scrip', quantity: 4, source_mission_id: 'mission-two-scripts' });

    expect(loadUnknownVault().items).toHaveLength(2);
    expect(getUnknownVaultQuantity('MG Scrip')).toBe(12);
    expect(getUnknownVaultQuantity('Council Scrip')).toBe(4);
  });

  test('remove um item pendente e mantém os demais', () => {
    const first = addToUnknownVault({ name: 'MG Scrip', quantity: 12, source_mission_id: 'mission-a' });
    addToUnknownVault({ name: 'Council Scrip', quantity: 8, source_mission_id: 'mission-b' });

    const result = removeFromUnknownVault(first.item.id);

    expect(result.removed).toBe(true);
    expect(result.item.name).toBe('MG Scrip');
    expect(loadUnknownVault().items).toHaveLength(1);
    expect(getUnknownVaultQuantity('MG Scrip')).toBe(0);
    expect(getUnknownVaultQuantity('Council Scrip')).toBe(8);
  });

  test('limpa o baú e rejeita quantidade inválida', () => {
    addToUnknownVault({ name: 'MG Scrip', quantity: 3, source_mission_id: 'mission-clear' });
    expect(() => addToUnknownVault({ name: 'MG Scrip', quantity: 0 })).toThrow();

    clearUnknownVault();

    expect(loadUnknownVault()).toEqual({ items: [] });
  });

  test('marca scrip como falha sem creditar no Baú', () => {
    const mission = { id: 'failed-mission', title: 'Missão falha', status: 'Failed', scrip_type: 'mg_scrip', scrip_qty: 12, scrip_dispatched: false };
    const failed = markMissionScripFailed(mission, 'Objetivo não concluído.');

    expect(failed.failed).toBe(true);
    expect(failed.mission.scrip_status).toBe('failed');
    expect(failed.mission.scrip_dispatched).toBe(false);
    expect(getMissionScripStatus(failed.mission)).toBe('failed');
    expect(loadUnknownVault().items).toHaveLength(0);
  });

  test('credita scrip somente quando a missão é concluída com sucesso', () => {
    const mission = { id: 'completed-mission', title: 'Missão concluída', status: 'Completed', scrip_type: 'council_scrip', scrip_qty: 5, scrip_dispatched: false };
    const credited = dispatchMissionScrip(mission);

    expect(credited.dispatched).toBe(true);
    expect(credited.mission.scrip_status).toBe('credited');
    expect(getMissionScripStatus(credited.mission)).toBe('credited');
    expect(loadUnknownVault().items[0].name).toBe('Council Scrip');
    expect(loadUnknownVault().items[0].quantity).toBe(5);
  });
});

export {};
