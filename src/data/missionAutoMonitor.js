import { markMissionScripFailed, isMissionScripFailureStatus } from './unknownVault';

const STORAGE_KEY = 'sc_mission_auto_monitor_v1';
export const MISSION_AUTO_MONITOR_UPDATED_EVENT = 'sc_mission_auto_monitor_updated';
export const MISSION_AUTO_MONITOR_MAX_EVENTS = 300;

function nowIso() {
  return new Date().toISOString();
}

function traceFrontend(step, details = {}, level = 'info') {
  const payload = { at: nowIso(), step, ...details };
  try {
    const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
    console[method]('[MissionAutoMonitor][frontend]', payload);
    if (typeof window !== 'undefined') window.__missionAutoMonitorLastTrace = payload;
  } catch (_) {}
  return payload;
}

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeEvent(event) {
  return {
    ...event,
    eventId: String(event?.eventId || `${event?.type || 'event'}:${event?.guid || event?.productName || 'event'}:${event?.ts || Date.now()}`),
    type: String(event?.type || 'unknown'),
    ts: Number(event?.ts) || Date.now(),
    channel: String(event?.channel || 'UNKNOWN'),
    auto: true,
    source: 'game_log',
    receivedAt: event?.receivedAt || nowIso(),
  };
}

function defaultState() {
  return {
    enabled: false,
    logPath: '',
    channel: 'UNKNOWN',
    running: false,
    activeMissions: [],
    events: [],
    lastError: '',
    debug: {},
    updatedAt: nowIso(),
  };
}

export function loadMissionAutoMonitor() {
  const stored = readState();
  if (!stored) return defaultState();
  return {
    ...defaultState(),
    ...stored,
    enabled: stored.enabled === true,
    running: stored.running === true,
    logPath: String(stored.logPath || ''),
    channel: String(stored.channel || 'UNKNOWN'),
    activeMissions: Array.isArray(stored.activeMissions) ? stored.activeMissions : [],
    events: Array.isArray(stored.events) ? stored.events.map(normalizeEvent).slice(0, MISSION_AUTO_MONITOR_MAX_EVENTS) : [],
    lastError: String(stored.lastError || ''),
    debug: stored.debug && typeof stored.debug === 'object' ? stored.debug : {},
  };
}

function emit(detail) {
  window.dispatchEvent(new CustomEvent(MISSION_AUTO_MONITOR_UPDATED_EVENT, { detail }));
}

export function saveMissionAutoMonitor(nextState) {
  const current = loadMissionAutoMonitor();
  const next = {
    ...current,
    ...nextState,
    updatedAt: nowIso(),
    events: Array.isArray(nextState?.events) ? nextState.events.map(normalizeEvent).slice(0, MISSION_AUTO_MONITOR_MAX_EVENTS) : current.events,
    activeMissions: Array.isArray(nextState?.activeMissions) ? nextState.activeMissions : current.activeMissions,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  traceFrontend('storage.saved', { running: next.running, enabled: next.enabled, logPath: next.logPath, activeCount: next.activeMissions.length, eventCount: next.events.length, phase: next.debug?.phase || 'unknown' });
  emit(next);
  return next;
}

export function setMissionAutoMonitorEnabled(enabled) {
  return saveMissionAutoMonitor({ enabled: Boolean(enabled) });
}

export function setMissionAutoMonitorStatus(status = {}) {
  traceFrontend('ipc.status.received', { running: status.running, logPath: status.logPath, channel: status.channel, debug: status.debug || null });
  const current = loadMissionAutoMonitor();
  // Ao reabrir o aplicativo, o watcher ainda não está criado e o IPC retorna
  // logPath=null. Preserve o caminho escolhido anteriormente nesse caso.
  const reportedLogPath = status.logPath === null || status.logPath === undefined
    ? current.logPath
    : String(status.logPath || '').trim();
  return saveMissionAutoMonitor({
    running: status.running === true,
    logPath: reportedLogPath,
    channel: status.channel || current.channel || 'UNKNOWN',
    activeMissions: Array.isArray(status.activeMissions) ? status.activeMissions : current.activeMissions,
    lastError: status.lastError || '',
    debug: status.debug && typeof status.debug === 'object' ? status.debug : current.debug,
  });
}

export function appendMissionAutoMonitorEvent(event) {
  traceFrontend('ipc.event.received', { type: event?.type, guid: event?.guid || event?.missionGuid || null, debugName: event?.debugName || null, raw: event });
  const normalized = normalizeEvent(event);
  const current = loadMissionAutoMonitor();
  const events = [normalized, ...current.events.filter(item => item.eventId !== normalized.eventId)].slice(0, MISSION_AUTO_MONITOR_MAX_EVENTS);
  let activeMissions = current.activeMissions.slice();
  if (normalized.type === 'mission_start' && normalized.guid) {
    activeMissions = [normalized, ...activeMissions.filter(item => String(item.guid) !== String(normalized.guid))];
  } else if (['mission_complete', 'mission_ended'].includes(normalized.type) && normalized.guid) {
    activeMissions = activeMissions.filter(item => String(item.guid) !== String(normalized.guid));
  } else if (normalized.type === 'session_reset') {
    activeMissions = [];
  }
  traceFrontend('event.state.transition', { type: normalized.type, guid: normalized.guid || null, activeBefore: current.activeMissions.length, activeAfter: activeMissions.length });
  return saveMissionAutoMonitor({ events, activeMissions, channel: normalized.channel || current.channel, lastError: '' });
}

function normalizeMissionName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function knownReward(value) {
  const reward = Number(value);
  // Zero significa que o Game.log não informou valor. Valores positivos são
  // ganhos e valores negativos são custos de acesso à missão; ambos devem ser
  // preservados e podem ser reaproveitados pelo histórico.
  return Number.isFinite(reward) && reward !== 0 ? reward : null;
}

function missionKnownAt(mission) {
  const candidates = [mission?.completed_at, mission?.auto_ended_at, mission?.updated_at, mission?.created_at, mission?.auto_started_at];
  for (const value of candidates) {
    const timestamp = Date.parse(value || '');
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

function timestampMs(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function durationBetweenSeconds(startValue, endValue) {
  const start = timestampMs(startValue);
  const end = timestampMs(endValue);
  if (!start || !end || end < start) return 0;
  return Math.max(0, Math.round((end - start) / 10) / 100);
}

function findLatestKnownMissionReward(missionTitle, missions, excludeId = '') {
  const normalizedTitle = normalizeMissionName(missionTitle);
  if (!normalizedTitle) return null;
  return missions
    .filter(mission => {
      if (!mission || String(mission.id || '') === String(excludeId || '')) return false;
      return normalizeMissionName(mission.title || mission.name) === normalizedTitle && knownReward(mission.reward) !== null;
    })
    .sort((a, b) => missionKnownAt(b) - missionKnownAt(a))[0] || null;
}

export function upsertAutomaticMissionRecord(event, typeNames = []) {
  if (!event || event.type === 'session_reset') return null;
  let missions;
  try { missions = JSON.parse(localStorage.getItem('sc_missions_v2')) || []; } catch { missions = []; }
  if (!Array.isArray(missions)) missions = [];
  const guid = event.guid || event.missionGuid;
  const index = guid ? missions.findIndex(mission => mission?.auto === true && String(mission.watcher_guid || '') === String(guid)) : -1;
  if (event.type === 'blueprint_received') {
    if (index < 0) return null;
    const current = missions[index];
    const eventId = String(event.eventId || `${event.productName || 'blueprint'}:${event.ts || Date.now()}`);
    const blueprints = Array.isArray(current.auto_blueprints) ? current.auto_blueprints : [];
    if (blueprints.some(item => String(item.eventId || '') === eventId)) return current;
    const next = { ...current, auto_blueprints: [...blueprints, { ...event, auto: true, eventId }] };
    missions[index] = next;
    localStorage.setItem('sc_missions_v2', JSON.stringify(missions));
    return next;
  }
  const timestamp = Number(event.startTs || event.ts || Date.now());
  const iso = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
  const eventEnd = Number(event.endTs || event.ts || Date.now());
  const endIso = Number.isFinite(eventEnd) ? new Date(eventEnd).toISOString() : new Date().toISOString();
  const missionTitle = String(event.debugName || event.missionDebugName || 'Missão detectada no Game.log').trim();
  const current = index >= 0 ? missions[index] : null;
  const computedDurationSec = Number(event.durationSec) > 0
    ? Number(event.durationSec)
    : durationBetweenSeconds(current?.auto_started_at || current?.created_at || event.startTs, event.endTs || event.ts);
  const currentReward = knownReward(current?.reward);
  const eventReward = knownReward(event.reward);
  const historicalRewardMission = currentReward === null && eventReward === null
    ? findLatestKnownMissionReward(missionTitle, missions, current?.id)
    : null;
  const historicalReward = knownReward(historicalRewardMission?.reward);
  const resolvedReward = currentReward ?? eventReward ?? historicalReward ?? 0;
  const resolvedRewardSource = currentReward !== null
    ? (current?.auto_reward_source || (current?.auto_reward_status === 'manual' ? 'manual' : 'known'))
    : eventReward !== null ? 'game_log' : historicalReward !== null ? 'historical' : 'pending';
  const text = `${event.debugName || ''} ${event.generator || ''}`.toLowerCase();
  const aliases = [['bounty','Bounty Hunt'],['delivery','Delivery'],['cargo','Carga Run'],['mining','Mining'],['salvage','Salvage'],['escort','Escort'],['investigation','Investigation'],['pvp','PVP'],['assault','Base Assault'],['drug','Drug Run'],['mercenary','Mercenary'],['blockade','Blockade Run']];
  const alias = aliases.find(([needle]) => text.includes(needle));
  const fallbackType = typeNames.find(name => String(name).toLowerCase() === 'outro') || typeNames[0] || 'Outro';
  const type = alias && typeNames.includes(alias[1]) ? alias[1] : fallbackType;
  const status = event.type === 'mission_complete' ? 'Completed' : event.type === 'mission_ended' ? (event.completion === 'Abandon' ? 'Abandoned' : 'Failed') : 'Active';
  const base = current || {
    id: `auto-${guid || event.eventId || Date.now()}`,
    title: missionTitle,
    type,
    faction: '', system: '', location: '', difficulty: 'Médio', status: 'Active',
    reward: resolvedReward, auto_reward_status: resolvedReward !== 0 ? 'filled' : 'pending',
    auto_reward_source: resolvedRewardSource,
    auto_reward_source_mission_id: historicalRewardMission?.id || null,
    auto_reward_filled_at: resolvedReward !== 0 ? new Date().toISOString() : null,
    reputation_gain: Number(event.reputationMax || event.reputationMin) || 0, reputation_min: Number(event.reputationMin) || 0, reputation_max: Number(event.reputationMax) || 0, reputation_label: event.reputationLabel || '', crew_needed: 1,
    notes: 'Registrada automaticamente a partir do Game.log do Star Citizen.',
    bug_description: '', created_at: iso, completed_at: null, wallet_out_at: null,
    objectives: [], auto: true, source: 'game_log', watcher_guid: guid || null,
    scrip_type: null, scrip_qty: 0, scrip_dispatched: false, scrip_dispatch_error: '',
    secure_drive_enabled: false, secure_drive_qty: 0, secure_drive_dispatched: false, secure_drive_status: null, secure_drive_dispatch_error: '',
    contract_definition_id: event.contractDefinitionId || null, external_generator: event.generator || null,
    auto_started_at: iso, auto_ended_at: null, duration_sec: computedDurationSec, timer_elapsed: computedDurationSec * 1000, auto_blueprints: [], auto_last_reason: '',
  };
  let next = {
    ...base,
    auto: true,
    source: 'game_log',
    watcher_guid: guid || base.watcher_guid,
    reward: resolvedReward,
    auto_reward_status: resolvedReward !== 0 ? (resolvedRewardSource === 'manual' ? 'manual' : 'filled') : 'pending',
    auto_reward_source: resolvedRewardSource,
    auto_reward_source_mission_id: historicalRewardMission?.id || base.auto_reward_source_mission_id || null,
    auto_reward_filled_at: resolvedReward !== 0 ? (base.auto_reward_filled_at || new Date().toISOString()) : null,
  };
  if (event.debugName) next.title = event.debugName;
  if (event.generator) next.external_generator = event.generator;
  if (event.contractDefinitionId) next.contract_definition_id = event.contractDefinitionId;
  if (event.reputationMin !== null && event.reputationMin !== undefined) next.reputation_min = Number(event.reputationMin) || 0;
  if (event.reputationMax !== null && event.reputationMax !== undefined) { next.reputation_max = Number(event.reputationMax) || 0; next.reputation_gain = Number(event.reputationMax) || 0; }
  if (event.reputationLabel) next.reputation_label = event.reputationLabel;
  if (!next.type || next.type === 'Outro') next.type = type;
  if (event.startTs) { next.auto_started_at = iso; if (!next.created_at) next.created_at = iso; }
  if (event.type === 'mission_start') {
    if (!['Completed','Failed','Abandoned'].includes(next.status)) next.status = 'Active';
  }
  if (event.type === 'mission_complete' || event.type === 'mission_ended') {
    next.status = status;
    next.completed_at = endIso;
    next.auto_ended_at = endIso;
    next.duration_sec = computedDurationSec || Number(next.duration_sec) || 0;
    next.timer_elapsed = next.duration_sec * 1000;
    next.auto_last_reason = event.reason || event.completionLabel || '';

    // As recompensas de scrip e Secure Drive são creditadas pelo App no
    // Inventário padrão, pois a API local do SQLite é assíncrona. Em falha,
    // mantemos o estado da recompensa para uma nova tentativa.
    if (event.type === 'mission_ended' && isMissionScripFailureStatus(next.status)) {
      const failed = markMissionScripFailed(next, event.reason || event.completionLabel || 'Missão não concluída.');
      next = failed.mission || next;
    }
  }
  if (index >= 0) missions[index] = next; else missions.unshift(next);
  localStorage.setItem('sc_missions_v2', JSON.stringify(missions));
  return next;
}

export function updateStoredMissionRecord(mission) {
  if (!mission?.id) return mission;
  let missions = [];
  try { missions = JSON.parse(localStorage.getItem('sc_missions_v2') || '[]'); } catch { missions = []; }
  const next = (Array.isArray(missions) ? missions : []).map(item => String(item.id) === String(mission.id) ? mission : item);
  localStorage.setItem('sc_missions_v2', JSON.stringify(next));
  return mission;
}

export function clearMissionAutoMonitorEvents() {
  return saveMissionAutoMonitor({ events: [], activeMissions: [] });
}

export function getMissionAutoMonitorStats(state = loadMissionAutoMonitor()) {
  const events = state.events || [];
  return {
    totalEvents: events.length,
    missionStarts: events.filter(event => event.type === 'mission_start').length,
    completed: events.filter(event => event.type === 'mission_complete').length,
    ended: events.filter(event => event.type === 'mission_ended').length,
    blueprints: events.filter(event => event.type === 'blueprint_received').length,
    active: (state.activeMissions || []).length,
  };
}
