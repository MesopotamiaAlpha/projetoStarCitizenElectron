import fs from 'fs';
import os from 'os';
import path from 'path';
import { MissionLogWatcher } from '../../electron/missionWatcher';
import { upsertAutomaticMissionRecord, appendMissionAutoMonitorEvent, loadMissionAutoMonitor } from './missionAutoMonitor';

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
