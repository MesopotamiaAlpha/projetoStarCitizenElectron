const STORAGE_KEY = 'sc_mission_auto_monitor_v1';
export const MISSION_AUTO_MONITOR_UPDATED_EVENT = 'sc_mission_auto_monitor_updated';
export const MISSION_AUTO_MONITOR_MAX_EVENTS = 300;

function nowIso() {
  return new Date().toISOString();
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
  emit(next);
  return next;
}

export function setMissionAutoMonitorEnabled(enabled) {
  return saveMissionAutoMonitor({ enabled: Boolean(enabled) });
}

export function setMissionAutoMonitorStatus(status = {}) {
  return saveMissionAutoMonitor({
    running: status.running === true,
    logPath: status.logPath || '',
    channel: status.channel || 'UNKNOWN',
    activeMissions: Array.isArray(status.activeMissions) ? status.activeMissions : [],
    lastError: status.lastError || '',
  });
}

export function appendMissionAutoMonitorEvent(event) {
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
  return saveMissionAutoMonitor({ events, activeMissions, channel: normalized.channel || current.channel, lastError: '' });
}

export function upsertAutomaticMissionRecord(event, typeNames = []) {
  if (!event || event.type === 'session_reset') return null;
  let missions;
  try { missions = JSON.parse(localStorage.getItem('sc_missions_v2')) || []; } catch { missions = []; }
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
  const text = `${event.debugName || ''} ${event.generator || ''}`.toLowerCase();
  const aliases = [['bounty','Bounty Hunt'],['delivery','Delivery'],['cargo','Carga Run'],['mining','Mining'],['salvage','Salvage'],['escort','Escort'],['investigation','Investigation'],['pvp','PVP'],['assault','Base Assault'],['drug','Drug Run'],['mercenary','Mercenary'],['blockade','Blockade Run']];
  const alias = aliases.find(([needle]) => text.includes(needle));
  const fallbackType = typeNames.find(name => String(name).toLowerCase() === 'outro') || typeNames[0] || 'Outro';
  const type = alias && typeNames.includes(alias[1]) ? alias[1] : fallbackType;
  const status = event.type === 'mission_complete' ? 'Completed' : event.type === 'mission_ended' ? (event.completion === 'Abandon' ? 'Abandoned' : 'Failed') : 'Active';
  const base = index >= 0 ? missions[index] : {
    id: `auto-${guid || event.eventId || Date.now()}`,
    title: String(event.debugName || event.missionDebugName || 'Missão detectada no Game.log').trim(),
    type,
    faction: '', system: '', location: '', difficulty: 'Médio', status: 'Active',
    reward: Number.isFinite(Number(event.reward)) ? Number(event.reward) : 0, auto_reward_status: Number(event.reward) > 0 ? 'filled' : 'pending', reputation_gain: Number(event.reputationMax || event.reputationMin) || 0, reputation_min: Number(event.reputationMin) || 0, reputation_max: Number(event.reputationMax) || 0, reputation_label: event.reputationLabel || '', crew_needed: 1,
    notes: 'Registrada automaticamente a partir do Game.log do Star Citizen.',
    bug_description: '', created_at: iso, completed_at: null, wallet_out_at: null,
    objectives: [], timer_elapsed: 0, auto: true, source: 'game_log', watcher_guid: guid || null,
    contract_definition_id: event.contractDefinitionId || null, external_generator: event.generator || null,
    auto_started_at: iso, auto_ended_at: null, duration_sec: 0, auto_blueprints: [], auto_last_reason: '',
  };
  const next = { ...base, auto: true, source: 'game_log', watcher_guid: guid || base.watcher_guid };
  if (event.debugName) next.title = event.debugName;
  if (event.generator) next.external_generator = event.generator;
  if (event.contractDefinitionId) next.contract_definition_id = event.contractDefinitionId;
  if (event.reward !== null && event.reward !== undefined && Number.isFinite(Number(event.reward))) { next.reward = Number(event.reward); next.auto_reward_status = Number(event.reward) > 0 ? 'filled' : 'pending'; }
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
    next.duration_sec = Number(event.durationSec) || Number(next.duration_sec) || 0;
    next.timer_elapsed = next.duration_sec * 1000;
    next.auto_last_reason = event.reason || event.completionLabel || '';
  }
  if (index >= 0) missions[index] = next; else missions.unshift(next);
  localStorage.setItem('sc_missions_v2', JSON.stringify(missions));
  return next;
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
