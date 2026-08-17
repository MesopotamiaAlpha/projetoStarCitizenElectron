import { saveInventoryDefaultDestination } from './inventoryPreferences';
import { dispatchMissionRewardsToDefaultInventory, SECURE_DRIVE_ITEM_NAME } from './missionRewardDispatch';

beforeEach(() => {
  window.localStorage.clear();
  window.electronAPI = {
    inventoryGetAll: jest.fn().mockResolvedValue([]),
    inventoryCreate: jest.fn().mockImplementation(async item => ({ id: 'created-1', ...item })),
    inventoryUpdate: jest.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => {
  delete window.electronAPI;
});

describe('despacho de recompensas no Inventário padrão', () => {
  test('cred ita scrip e Secure Drive no local padrão', async () => {
    saveInventoryDefaultDestination({ system: 'Stanton', location_type: 'Planeta', location_name: 'New Babbage' });
    const result = await dispatchMissionRewardsToDefaultInventory({
      id: 'mission-1',
      title: 'Desafio de combate',
      scrip_type: 'mg_scrip',
      scrip_qty: 12,
      secure_drive_enabled: true,
      secure_drive_qty: 2,
    });

    expect(result.errors).toEqual([]);
    expect(result.mission.scrip_dispatched).toBe(true);
    expect(result.mission.secure_drive_dispatched).toBe(true);
    expect(window.electronAPI.inventoryCreate).toHaveBeenCalledTimes(2);
    expect(window.electronAPI.inventoryCreate.mock.calls.map(call => call[0].name)).toEqual(expect.arrayContaining(['MG Scrip', SECURE_DRIVE_ITEM_NAME]));
    expect(window.electronAPI.inventoryCreate.mock.calls[0][0].location_name).toBe('New Babbage');
  });

  test('soma a recompensa ao registro existente no mesmo local', async () => {
    saveInventoryDefaultDestination({ system: 'Pyro', location_type: 'Estação', location_name: 'Checkmate' });
    window.electronAPI.inventoryGetAll.mockResolvedValue([{ id: 'mg-1', name: 'MG Scrip', system: 'Pyro', location_type: 'Estação', location_name: 'Checkmate', quantity: 5, unit: 'un' }]);
    const result = await dispatchMissionRewardsToDefaultInventory({ id: 'mission-2', scrip_type: 'mg_scrip', scrip_qty: 7 });

    expect(result.mission.scrip_dispatched).toBe(true);
    expect(window.electronAPI.inventoryUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'mg-1', quantity: 12 }));
    expect(window.electronAPI.inventoryCreate).not.toHaveBeenCalled();
  });

  test('não credita sem local padrão e informa o motivo', async () => {
    const result = await dispatchMissionRewardsToDefaultInventory({ id: 'mission-3', scrip_type: 'council_scrip', scrip_qty: 4 });

    expect(result.mission.scrip_dispatched).toBeUndefined();
    expect(result.mission.scrip_status).toBe('pending');
    expect(result.errors[0]).toMatch(/local padrão/i);
    expect(window.electronAPI.inventoryCreate).not.toHaveBeenCalled();
  });

  test('não repete recompensa já marcada como enviada', async () => {
    saveInventoryDefaultDestination({ system: 'Nyx', location_type: 'Estação', location_name: 'Port Tressler' });
    const result = await dispatchMissionRewardsToDefaultInventory({ id: 'mission-4', secure_drive_enabled: true, secure_drive_qty: 1, secure_drive_dispatched: true });

    expect(result.skipped).toBe(true);
    expect(window.electronAPI.inventoryCreate).not.toHaveBeenCalled();
  });
});

export {};
