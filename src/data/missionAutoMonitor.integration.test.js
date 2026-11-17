import fs from 'fs';
import os from 'os';
import path from 'path';
import { MissionLogWatcher } from '../../electron/missionWatcher';
import { upsertAutomaticMissionRecord, appendMissionAutoMonitorEvent, loadMissionAutoMonitor, rememberDeletedAutomaticMission, isIgnoredAutomaticMission } from './missionAutoMonitor';

const GUID = '11111111-2222-3333-4444-555555555555';

describe('integração monitor automático → frontend', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('detecta missão ativa, emite mission_start e cria registro Active', async () => {
    const file = path.join(os.tmpdir(), `emoto-active-${Date.now()}.log`);
    const content = [
      `<2026-08-18T10:00:00.000Z> [Notice] <UpdateNotificationItem> Notification "CONTRATO ACEITO: Transporte de carga teste: " [96], Action: StartFade`,
      `<2026-08-18T10:00:01.000Z> [Notice] <PlayerJoined> Received PlayerJoined push message for: mission_id ${GUID} - player_id 123`,
    ].join('\n') + '\n';
    fs.writeFileSync(file, content);
    const events = [];
    const watcher = new MissionLogWatcher(event => events.push(event));

    const initialStatus = await watcher.start(file);
    expect(['file_readable', 'reading']).toContain(initialStatus.debug.phase);
    expect(initialStatus.debug.fileExists).toBe(true);
    expect(initialStatus.debug.fileReadable).toBe(true);
    expect(initialStatus.debug.fileSize).toBeGreaterThan(0);
    await new Promise(resolve => setTimeout(resolve, 400));
    await watcher.stop();
    fs.rmSync(file, { force: true });

    const start = events.find(event => event.type === 'mission_start');
    expect(start).toBeTruthy();
    expect(start.guid).toBe(GUID);

    const mission = upsertAutomaticMissionRecord(start, ['Outro']);
    appendMissionAutoMonitorEvent(start);
    const state = loadMissionAutoMonitor();

    expect(mission.status).toBe('Active');
    expect(state.activeMissions).toHaveLength(1);
    expect(state.activeMissions[0].guid).toBe(GUID);
  });

  test('não recria missão automática excluída ao processar novamente o Game.log', () => {
    const start = {
      type: 'mission_start',
      guid: GUID,
      debugName: 'Entrega que o jogador excluiu',
      generator: 'Delivery_Test',
      contractDefinitionId: 'definition-delete-test',
      ts: Date.now(),
    };
    const mission = upsertAutomaticMissionRecord(start, ['Outro']);
    appendMissionAutoMonitorEvent(start);
    expect(mission).toBeTruthy();
    expect(loadMissionAutoMonitor().activeMissions).toHaveLength(1);

    rememberDeletedAutomaticMission(mission);
    localStorage.setItem('sc_missions_v2', '[]');
    expect(isIgnoredAutomaticMission(start)).toBe(true);

    expect(upsertAutomaticMissionRecord(start, ['Outro'])).toBeNull();
    appendMissionAutoMonitorEvent(start);
    expect(loadMissionAutoMonitor().activeMissions).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('sc_missions_v2') || '[]')).toHaveLength(0);
  });

  test('preserva o nome canônico quando o Game.log muda para nome técnico', () => {
    const start = {
      type: 'mission_start',
      guid: GUID,
      debugName: 'Contrato Oficial de Transporte',
      generator: 'Delivery_Test',
      contractDefinitionId: 'definition-name-test',
      ts: Date.now(),
    };
    const created = upsertAutomaticMissionRecord(start, ['Outro']);
    const technicalUpdate = {
      ...start,
      type: 'mission_complete',
      debugName: 'internal_contract_generator_42',
      endTs: Date.now() + 1000,
    };
    const updated = upsertAutomaticMissionRecord(technicalUpdate, ['Outro']);
    expect(created.title).toBe('Contrato Oficial de Transporte');
    expect(updated.title).toBe('Contrato Oficial de Transporte');
    expect(updated.canonical_title).toBe('Contrato Oficial de Transporte');
  });

  test('prioriza o nome oficial da notificação sobre o contrato técnico do marcador', async () => {
    const file = path.join(os.tmpdir(), `emoto-official-name-${Date.now()}.log`);
    const content = [
      `<2026-08-18T18:55:52.493Z> [Notice] <CLocalMissionPhaseMarker::CreateMarker> Creating objective marker: missionId [${GUID}], generator name [HockrowAgency_FacilityDelve], contract [Hockrow_FacilityDelve_P3MM_Repeat_2], contractDefinitionId[24926b28-d2a0-4b18-b4fc-f34c0e872079]`,
      `<2026-08-18T18:56:38.072Z> [Notice] <SHUDEvent_OnNotification> Added notification "Contract Accepted:  DOSSIÊ JORRIT: PROJETO HYPERION <EM4>[BP?]</EM4>: " [119] to queue. New queue size: 3, MissionId: [${GUID}], ObjectiveId: []`,
    ].join('\n') + '\n';
    fs.writeFileSync(file, content);
    const events = [];
    const watcher = new MissionLogWatcher(event => events.push(event));
    await watcher.start(file);
    await watcher.stop();
    fs.rmSync(file, { force: true });

    const start = events.find(event => event.type === 'mission_start');
    expect(start).toBeTruthy();
    expect(start.debugName).toBe('DOSSIÊ JORRIT: PROJETO HYPERION');
    expect(start.generator).toBe('HockrowAgency_FacilityDelve');

    const mission = upsertAutomaticMissionRecord(start, ['Outro']);
    const technicalUpdate = upsertAutomaticMissionRecord({
      ...start,
      type: 'mission_update',
      debugName: 'Hockrow_FacilityDelve_P3MM_Repeat_2',
      displayName: null,
      ts: Date.now() + 1000,
    }, ['Outro']);
    expect(mission.title).toBe('DOSSIÊ JORRIT: PROJETO HYPERION');
    expect(technicalUpdate.title).toBe('DOSSIÊ JORRIT: PROJETO HYPERION');
  });

  test('reproduz o formato watcher.py com Contract Accepted e MissionId na mesma linha', async () => {
    const file = path.join(os.tmpdir(), `emoto-python-format-${Date.now()}.log`);
    const content = [
      `<2026-08-18T11:00:00.000Z> [Notice] <CLocalMissionPhaseMarker::CreateMarker> Creating objective marker: missionId [${GUID}], generator name [Delivery_Test], contract [Entrega de teste], contractDefinitionId[aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee]`,
      `<2026-08-18T11:00:01.000Z> [Notice] <SHUDEvent_OnNotification> Added notification "Contract Accepted: Entrega de teste", MissionId: [${GUID}]`,
    ].join('\n') + '\n';
    fs.writeFileSync(file, content);
    const events = [];
    const watcher = new MissionLogWatcher(event => events.push(event));
    const status = await watcher.start(file);
    await watcher.stop();
    fs.rmSync(file, { force: true });

    expect(status.debug.fileReadable).toBe(true);
    expect(events.filter(event => event.type === 'mission_start')).toHaveLength(1);
    expect(events[0].guid).toBe(GUID);
  });
});
