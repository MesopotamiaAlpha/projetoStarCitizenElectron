import { upsertAutomaticMissionRecord, rememberMissionRewardPreferences, findMissionRewardPreferences } from './missionAutoMonitor';
import { loadUnknownVault } from './unknownVault';

beforeEach(() => {
  window.localStorage.clear();
});

describe('recompensa histórica do Monitor Automático', () => {
  test('memoriza Scrip e Secure Drive e reaplica na próxima ocorrência automática', () => {
    rememberMissionRewardPreferences({
      auto: true,
      title: 'Desafio de Combate - Cenário 5',
      canonical_title: 'Desafio de Combate - Cenário 5',
      scrip_type: 'mg_scrip',
      scrip_qty: 12,
      secure_drive_enabled: true,
      secure_drive_qty: 2,
    });

    expect(findMissionRewardPreferences({ debugName: 'Desafio de Combate - Cenário 5' })).toMatchObject({
      scrip_type: 'mg_scrip',
      scrip_qty: 12,
      secure_drive_enabled: true,
      secure_drive_qty: 2,
    });

    const nextMission = upsertAutomaticMissionRecord({
      type: 'mission_start',
      guid: 'reward-preference-new-guid',
      debugName: 'Desafio de Combate - Cenário 5',
      reward: 0,
      startTs: Date.parse('2026-08-16T10:00:00.000Z'),
    }, ['Outro']);

    expect(nextMission.scrip_type).toBe('mg_scrip');
    expect(nextMission.scrip_qty).toBe(12);
    expect(nextMission.secure_drive_enabled).toBe(true);
    expect(nextMission.secure_drive_qty).toBe(2);
  });

  test('preenche o último aUEC conhecido para o mesmo nome de missão', () => {
    window.localStorage.setItem('sc_missions_v2', JSON.stringify([
      {
        id: 'old-1',
        title: 'Nave em perigo',
        reward: 58000,
        status: 'Completed',
        completed_at: '2026-08-14T10:00:00.000Z',
      },
      {
        id: 'old-2',
        title: 'Nave em perigo',
        reward: 42000,
        status: 'Completed',
        completed_at: '2026-08-13T10:00:00.000Z',
      },
    ]));

    const mission = upsertAutomaticMissionRecord({
      type: 'mission_start',
      guid: 'new-guid',
      debugName: 'Nave em perigo',
      reward: 0,
      startTs: Date.parse('2026-08-15T10:00:00.000Z'),
    }, ['Outro']);

    expect(mission.reward).toBe(58000);
    expect(mission.auto_reward_status).toBe('filled');
    expect(mission.auto_reward_source).toBe('historical');
    expect(mission.auto_reward_source_mission_id).toBe('old-1');
  });

  test('reaproveita os dados editados quando a mesma missão retorna com novo GUID', () => {
    window.localStorage.setItem('sc_missions_v2', JSON.stringify([
      {
        id: 'historical-mission-1',
        title: 'Transporte de Carga Especial',
        canonical_title: 'Transporte de Carga Especial',
        type: 'Delivery',
        faction: 'Covalex',
        system: 'Stanton',
        location: 'Lorville',
        difficulty: 'Elite',
        reward: 150000,
        reputation_gain: 42,
        crew_needed: 3,
        notes: 'Usar rota segura pelo cinturão.',
        objectives: [{ text: 'Entregar a carga', done: true }],
        status: 'Completed',
        auto: true,
        watcher_guid: 'old-guid',
        contract_definition_id: 'same-contract-definition',
        external_generator: 'Delivery_Special',
        completed_at: '2026-08-14T10:00:00.000Z',
      },
    ]));

    const mission = upsertAutomaticMissionRecord({
      type: 'mission_start',
      guid: 'new-guid',
      debugName: 'internal_delivery_special',
      displayName: 'Transporte de Carga Especial',
      generator: 'Delivery_Special',
      contractDefinitionId: 'same-contract-definition',
      reward: 0,
      startTs: Date.parse('2026-08-15T10:00:00.000Z'),
    }, ['Outro', 'Delivery']);

    expect(mission).toMatchObject({
      auto: true,
      watcher_guid: 'new-guid',
      title: 'Transporte de Carga Especial',
      faction: 'Covalex',
      type: 'Delivery',
      system: 'Stanton',
      location: 'Lorville',
      difficulty: 'Elite',
      reward: 150000,
      reputation_gain: 42,
      crew_needed: 3,
      notes: 'Usar rota segura pelo cinturão.',
      status: 'Active',
    });
    expect(mission.objectives).toEqual([{ text: 'Entregar a carga', done: false }]);
    expect(mission.id).not.toBe('historical-mission-1');
  });

  test('não mistura nomes parecidos quando não há correspondência exata', () => {
    window.localStorage.setItem('sc_missions_v2', JSON.stringify([
      {
        id: 'old-1',
        title: 'Nave em perigo',
        reward: 58000,
        status: 'Completed',
        completed_at: '2026-08-14T10:00:00.000Z',
      },
    ]));

    const mission = upsertAutomaticMissionRecord({
      type: 'mission_start',
      guid: 'new-guid',
      debugName: 'Nave em perigo — variante',
      reward: 0,
      startTs: Date.parse('2026-08-15T10:00:00.000Z'),
    }, ['Outro']);

    expect(mission.reward).toBe(0);
    expect(mission.auto_reward_status).toBe('pending');
    expect(mission.auto_reward_source).toBe('pending');
  });

  test('preserva custo negativo e registra a duração entre início e fim', () => {
    const started = upsertAutomaticMissionRecord({
      type: 'mission_start',
      guid: 'paid-mission',
      debugName: 'Acesso à operação',
      reward: -2500,
      startTs: Date.parse('2026-08-15T10:00:00.000Z'),
    }, ['Outro']);

    expect(started.reward).toBe(-2500);
    expect(started.auto_reward_status).toBe('filled');
    expect(started.auto_reward_source).toBe('game_log');

    const ended = upsertAutomaticMissionRecord({
      type: 'mission_complete',
      guid: 'paid-mission',
      debugName: 'Acesso à operação',
      reward: -2500,
      endTs: Date.parse('2026-08-15T10:07:30.000Z'),
      completion: 'Complete',
    }, ['Outro']);

    expect(ended.reward).toBe(-2500);
    expect(ended.status).toBe('Completed');
    expect(ended.duration_sec).toBe(450);
    expect(ended.timer_elapsed).toBe(450000);
  });

  test('mantém a recompensa para despacho no Inventário padrão ao concluir automaticamente', () => {
    upsertAutomaticMissionRecord({
      type: 'mission_start',
      guid: 'scrip-guid',
      debugName: 'Desafio de Combate - Cenário 5',
      reward: 0,
      startTs: Date.parse('2026-08-15T10:00:00.000Z'),
    }, ['Outro']);

    window.localStorage.setItem('sc_missions_v2', JSON.stringify([
      {
        ...JSON.parse(window.localStorage.getItem('sc_missions_v2'))[0],
        scrip_type: 'mg_scrip',
        scrip_qty: 12,
        scrip_dispatched: false,
      },
    ]));

    const completed = upsertAutomaticMissionRecord({
      type: 'mission_complete',
      guid: 'scrip-guid',
      debugName: 'Desafio de Combate - Cenário 5',
      endTs: Date.parse('2026-08-15T10:12:00.000Z'),
    }, ['Outro']);

    expect(completed.scrip_dispatched).toBe(false);
    expect(completed.scrip_status).toBeUndefined();
    expect(loadUnknownVault().items).toHaveLength(0);

    const repeated = upsertAutomaticMissionRecord({
      type: 'mission_complete',
      guid: 'scrip-guid',
      debugName: 'Desafio de Combate - Cenário 5',
      endTs: Date.parse('2026-08-15T10:12:00.000Z'),
    }, ['Outro']);
    expect(repeated.scrip_dispatched).toBe(false);
    expect(loadUnknownVault().items).toHaveLength(0);
  });

  test('marca como falha o scrip de uma missão encerrada sem sucesso', () => {
    const started = upsertAutomaticMissionRecord({
      type: 'mission_start',
      guid: 'failed-scrip-guid',
      debugName: 'Desafio de Combate - Cenário 5',
      startTs: Date.parse('2026-08-15T11:00:00.000Z'),
    }, ['Outro']);

    window.localStorage.setItem('sc_missions_v2', JSON.stringify([{
      ...started,
      scrip_type: 'mg_scrip',
      scrip_qty: 12,
      scrip_dispatched: false,
    }]));

    const failed = upsertAutomaticMissionRecord({
      type: 'mission_ended',
      guid: 'failed-scrip-guid',
      debugName: 'Desafio de Combate - Cenário 5',
      completion: 'Fail',
      completionLabel: 'Missão falhou',
      endTs: Date.parse('2026-08-15T11:08:00.000Z'),
    }, ['Outro']);

    expect(failed.status).toBe('Failed');
    expect(failed.scrip_status).toBe('failed');
    expect(failed.scrip_dispatched).toBe(false);
    expect(loadUnknownVault().items).toHaveLength(0);
  });

  test('também reaproveita um custo negativo conhecido no histórico', () => {
    window.localStorage.setItem('sc_missions_v2', JSON.stringify([
      {
        id: 'old-paid',
        title: 'Acesso à operação',
        reward: -1250,
        status: 'Completed',
        completed_at: '2026-08-14T10:00:00.000Z',
      },
    ]));

    const mission = upsertAutomaticMissionRecord({
      type: 'mission_start',
      guid: 'new-paid',
      debugName: 'Acesso à operação',
      reward: 0,
      startTs: Date.parse('2026-08-15T10:00:00.000Z'),
    }, ['Outro']);

    expect(mission.reward).toBe(-1250);
    expect(mission.auto_reward_status).toBe('filled');
    expect(mission.auto_reward_source).toBe('historical');
  });
});

export {};
