'use strict';

const fs = require('fs');
const path = require('path');

const POLL_INTERVAL_MS = 250;
const MAX_READ_CHUNK = 1024 * 1024;
const INITIAL_REPLAY_BYTES = 8 * 1024 * 1024;
const BLUEPRINT_CORRELATION_WINDOW_MS = 5000;
const MAX_RECENT_EVENTS = 120;

const PATTERN_TIMESTAMP = /^<([0-9T:\-.Z]+)>/;
const PATTERN_MARKER = /CreateMarker.*?missionId\s*:?\s*\[([^\]]+)\].*?generator\s+name\s*:?\s*\[([^\]]+)\].*?contract\s*:?\s*\[([^\]]+)\]/i;
const PATTERN_MARKER_DEF_ID = /contractDefinitionId\s*:?\s*\[([^\]]+)\]/i;
const PATTERN_ACCEPTED_START = /Added\s+notification\s+"Contract\s+Accepted\s*:/i;
const PATTERN_MISSION_ID = /(?:MissionId|missionId)\s*:?\s*\[([^\]]+)\]/i;
const PATTERN_END_MISSION = /<EndMission>.*?MissionId\s*:?\s*\[([^\]]+)\].*?CompletionType\s*:?\s*\[(\w+)\].*?Reason\s*:?\s*\[([^\]]+)\]/i;
const PATTERN_BLUEPRINT = /Received\s+Blueprint\s*:\s*([^:]+):/i;
const PATTERN_REWARD = /(?:reward(?:amount)?|missionreward|payout(?:amount)?|auec|uec|amount|money)\s*[:=]?\s*\[?\s*([0-9][0-9.,]*)/i;
const PATTERN_CURRENCY_VALUE = /([0-9][0-9.,]*)\s*(?:auec|uec)\b/i;
const PATTERN_REWARD_CONTEXT = /(?:mission|contract|reward|payout|payment|auec|uec|wallet|credit)/i;
const PATTERN_REPUTATION = /\[\s*([0-9][0-9.,]*)\s*(?:[–-]\s*([0-9][0-9.,]*))?\s*Rep(?:[^\]]*)\]/i;

const COMPLETION_LABELS = {
  Complete: 'Missão concluída',
  Abandon: 'Missão abandonada',
  Fail: 'Missão falhou',
  Disconnect: 'Missão desconectada',
  Deactivate: 'Missão desativada',
};

function parseTimestamp(line) {
  const match = PATTERN_TIMESTAMP.exec(line);
  if (!match) return Date.now();
  const raw = match[1].replace('Z', '+00:00');
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function channelFromPath(logPath) {
  const parent = path.basename(path.dirname(logPath || ''));
  return parent ? parent.toUpperCase() : 'UNKNOWN';
}

function cleanText(value) {
  return String(value || '').trim();
}

function parseMissionId(line) {
  const match = PATTERN_MISSION_ID.exec(line);
  return match ? cleanText(match[1]) : null;
}

function parseMoneyValue(raw) {
  if (raw === null || raw === undefined) return null;
  const compact = String(raw).replace(/\s/g, '');
  if (!compact) return null;
  let normalized = compact;
  if (compact.includes(',') && compact.includes('.')) normalized = compact.replace(/,/g, '');
  else if (compact.includes(',')) normalized = compact.replace(/,/g, '');
  else if (compact.includes('.')) {
    const parts = compact.split('.');
    normalized = parts[parts.length - 1].length === 3 ? compact.replace(/\./g, '') : compact;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseRewardFromText(line) {
  if (!PATTERN_REWARD_CONTEXT.test(String(line || ''))) return null;
  const keywordMatch = PATTERN_REWARD.exec(line);
  if (keywordMatch) return parseMoneyValue(keywordMatch[1]);
  const currencyMatch = PATTERN_CURRENCY_VALUE.exec(line);
  return currencyMatch ? parseMoneyValue(currencyMatch[1]) : null;
}

function parseReputationFromText(line) {
  const match = PATTERN_REPUTATION.exec(line);
  if (!match) return null;
  const min = parseMoneyValue(match[1]);
  const max = match[2] ? parseMoneyValue(match[2]) : min;
  return { min, max, label: min === max ? `+${min} Rep` : `+${min}–${max} Rep` };
}

function parseAcceptedMissionName(line) {
  const firstLine = String(line || '').split(/\r?\n/)[0];
  const match = /Contract\s+Accepted\s*:\s*([^"\r\n]*)/i.exec(firstLine);
  if (!match) return null;
  return cleanText(match[1]).replace(/<[^>]+>/g, '').replace(/\[[^\]]*Rep[^\]]*\]/gi, '').replace(/(?:Reward|Payout|aUEC|UEC)\s*[:=]?\s*.*$/i, '').replace(/[|;,\-:]+\s*$/, '').trim() || null;
}

class MissionLogWatcher {
  constructor(onEvent, onStatus) {
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.timer = null;
    this.fileHandle = null;
    this.logPath = '';
    this.channel = 'UNKNOWN';
    this.position = 0;
    this.fileIdentity = '';
    this.partial = '';
    this.pendingAcceptedLine = '';
    this.pendingAcceptedTs = 0;
    this.markers = new Map();
    this.active = new Map();
    this.recentLifecycle = [];
    this.recentEvents = [];
    this.startedAt = null;
    this.lastEventAt = null;
    this.lastError = '';
  }

  status() {
    return {
      running: Boolean(this.timer),
      logPath: this.logPath || null,
      channel: this.channel,
      position: this.position,
      startedAt: this.startedAt,
      lastEventAt: this.lastEventAt,
      lastError: this.lastError || null,
      activeMissions: Array.from(this.active.values()).map(mission => ({ ...mission })),
      recentEvents: this.recentEvents.slice(),
    };
  }

  emitStatus() {
    if (typeof this.onStatus === 'function') this.onStatus(this.status());
  }

  async start(logPath) {
    const normalized = path.resolve(String(logPath || '').trim());
    if (!normalized) throw new Error('Informe o caminho do Game.log do Star Citizen.');
    if (this.timer) await this.stop();
    let stats;
    try {
      stats = fs.statSync(normalized);
    } catch (error) {
      throw new Error(`Game.log não encontrado: ${error.message}`);
    }
    if (!stats.isFile()) throw new Error('O caminho escolhido não é um arquivo Game.log.');

    this.logPath = normalized;
    this.channel = channelFromPath(normalized);
    this.position = Math.max(0, stats.size - INITIAL_REPLAY_BYTES);
    this.fileIdentity = `${stats.dev || ''}:${stats.ino || ''}`;
    this.partial = '';
    this.pendingAcceptedLine = '';
    this.pendingAcceptedTs = 0;
    this.markers.clear();
    this.active.clear();
    this.recentLifecycle = [];
    this.recentEvents = [];
    this.startedAt = Date.now();
    this.lastEventAt = null;
    this.lastError = '';
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.emitStatus();
    return this.status();
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.fileHandle) {
      try { this.fileHandle.close(); } catch (_) {}
      this.fileHandle = null;
    }
    this.emitStatus();
    return this.status();
  }

  poll() {
    if (!this.timer || !this.logPath) return;
    let stats;
    try {
      stats = fs.statSync(this.logPath);
    } catch (error) {
      this.lastError = `Não foi possível ler o Game.log: ${error.message}`;
      this.emitStatus();
      return;
    }

    const identity = `${stats.dev || ''}:${stats.ino || ''}`;
    if (identity !== this.fileIdentity || stats.size < this.position) {
      this.resetSession(stats);
    }
    if (stats.size <= this.position) return;

    try {
      const length = Math.min(stats.size - this.position, MAX_READ_CHUNK);
      const buffer = Buffer.alloc(length);
      const handle = fs.openSync(this.logPath, 'r');
      fs.readSync(handle, buffer, 0, length, this.position);
      fs.closeSync(handle);
      this.position += length;
      this.fileIdentity = identity;
      this.partial += buffer.toString('utf8');
      const lines = this.partial.split(/\r?\n/);
      this.partial = lines.pop() || '';
      lines.filter(Boolean).forEach(line => this.processLine(line));
      this.lastError = '';
      this.emitStatus();
    } catch (error) {
      this.lastError = `Falha ao acompanhar o Game.log: ${error.message}`;
      this.emitStatus();
    }
  }

  resetSession(stats) {
    this.position = stats.size;
    this.fileIdentity = `${stats.dev || ''}:${stats.ino || ''}`;
    this.partial = '';
    this.pendingAcceptedLine = '';
    this.pendingAcceptedTs = 0;
    this.markers.clear();
    this.active.clear();
    this.recentLifecycle = [];
    this.emitEvent({ type: 'session_reset', channel: this.channel, ts: Date.now() });
  }

  addLifecycle(trigger, mission, ts) {
    this.recentLifecycle.push({ trigger, guid: mission.guid, debugName: mission.debugName, ts, contractDefinitionId: mission.contractDefinitionId || null });
    this.recentLifecycle = this.recentLifecycle.slice(-32);
  }

  findBlueprintCorrelation(ts) {
    let best = null;
    let bestDelta = BLUEPRINT_CORRELATION_WINDOW_MS + 1;
    for (const lifecycle of this.recentLifecycle) {
      const delta = ts - lifecycle.ts;
      if (delta >= 0 && delta <= BLUEPRINT_CORRELATION_WINDOW_MS && delta < bestDelta) {
        best = lifecycle;
        bestDelta = delta;
      }
    }
    return best;
  }

  processLine(line) {
    const ts = parseTimestamp(line);
    let match = PATTERN_MARKER.exec(line);
    if (match) {
      const defMatch = PATTERN_MARKER_DEF_ID.exec(line);
      const guid = match[1];
      const reward = parseRewardFromText(line);
      const previousMarker = this.markers.get(guid);
      const marker = {
        guid,
        generator: cleanText(match[2]),
        debugName: cleanText(match[3]),
        contractDefinitionId: defMatch ? cleanText(defMatch[1]) : null,
        reward: reward ?? previousMarker?.reward ?? null,
      };
      this.markers.set(guid, marker);
      const active = this.active.get(guid);
      if (active) {
        const changed = active.debugName !== marker.debugName || active.generator !== marker.generator || active.reward !== marker.reward;
        Object.assign(active, marker);
        if (changed) this.emitEvent({ type: 'mission_update', ...active, channel: this.channel, ts });
      }
      return;
    }

    const pendingIsFresh = Boolean(this.pendingAcceptedLine) && (ts - this.pendingAcceptedTs) <= 5000;
    let acceptedPayload = pendingIsFresh && parseMissionId(line) ? `${this.pendingAcceptedLine}\n${line}` : '';
    if (PATTERN_ACCEPTED_START.test(line)) {
      if (parseMissionId(line)) acceptedPayload = line;
      else {
        this.pendingAcceptedLine = line;
        this.pendingAcceptedTs = ts;
        return;
      }
    }
    if (acceptedPayload) {
      this.pendingAcceptedLine = '';
      this.pendingAcceptedTs = 0;
      const guid = parseMissionId(acceptedPayload);
      if (!guid) return;
      const marker = this.markers.get(guid);
      const mission = {
        guid,
        debugName: parseAcceptedMissionName(acceptedPayload) || marker?.debugName || 'Missão detectada no Game.log',
        generator: marker?.generator || '',
        contractDefinitionId: marker?.contractDefinitionId || null,
        reward: parseRewardFromText(acceptedPayload) ?? marker?.reward ?? null,
        ...(() => { const reputation = parseReputationFromText(acceptedPayload); return reputation ? { reputationMin: reputation.min, reputationMax: reputation.max, reputationLabel: reputation.label } : {}; })(),
        startTs: ts,
      };
      this.active.set(guid, mission);
      this.addLifecycle('accept', mission, ts);
      this.emitEvent({ type: 'mission_start', ...mission, channel: this.channel, ts });
      return;
    }
    if (!pendingIsFresh) {
      this.pendingAcceptedLine = '';
      this.pendingAcceptedTs = 0;
    }

    match = PATTERN_END_MISSION.exec(line);
    if (match) {
      const guid = match[1];
      const completion = match[2];
      const reason = cleanText(match[3]);
      const active = this.active.get(guid);
      const marker = this.markers.get(guid);
      const reward = parseRewardFromText(line) ?? active?.reward ?? marker?.reward ?? null;
      const reputation = parseReputationFromText(line);
      const debugName = active?.debugName || marker?.debugName || null;
      const generator = active?.generator || marker?.generator || null;
      const contractDefinitionId = active?.contractDefinitionId || marker?.contractDefinitionId || null;
      const event = {
        type: completion === 'Complete' ? 'mission_complete' : 'mission_ended',
        guid,
        debugName,
        generator,
        contractDefinitionId,
        reward,
        ...(reputation ? { reputationMin: reputation.min, reputationMax: reputation.max, reputationLabel: reputation.label } : {}),
        completion,
        completionLabel: COMPLETION_LABELS[completion] || `Missão encerrada (${completion})`,
        reason,
        startTs: active?.startTs || null,
        endTs: ts,
        durationSec: active ? Math.max(0, Math.round((ts - active.startTs) / 10) / 100) : null,
        channel: this.channel,
        ts,
      };
      this.active.delete(guid);
      if (completion === 'Complete') this.addLifecycle('complete', { guid, debugName, contractDefinitionId }, ts);
      this.emitEvent(event);
      return;
    }

    const reward = parseRewardFromText(line);
    if (reward !== null) {
      const guid = parseMissionId(line);
      const active = guid ? this.active.get(guid) : this.active.size === 1 ? Array.from(this.active.values())[0] : null;
      if (active) {
        active.reward = reward;
        const reputation = parseReputationFromText(line);
        if (reputation) Object.assign(active, { reputationMin: reputation.min, reputationMax: reputation.max, reputationLabel: reputation.label });
        this.emitEvent({ type: 'mission_update', ...active, reward, channel: this.channel, ts });
        return;
      }
    }

    match = PATTERN_BLUEPRINT.exec(line);
    if (match) {
      const productName = cleanText(match[1]);
      const correlation = this.findBlueprintCorrelation(ts);
      this.emitEvent({
        type: 'blueprint_received',
        productName,
        missionGuid: correlation?.guid || null,
        missionDebugName: correlation?.debugName || null,
        missionContractDefinitionId: correlation?.contractDefinitionId || null,
        missionTrigger: correlation?.trigger || null,
        channel: this.channel,
        ts,
      });
    }
  }

  emitEvent(event) {
    const safeEvent = { ...event, eventId: `${event.type}:${event.guid || event.productName || 'event'}:${event.ts || Date.now()}` };
    this.lastEventAt = safeEvent.ts || Date.now();
    this.recentEvents = [safeEvent, ...this.recentEvents.filter(item => item.eventId !== safeEvent.eventId)].slice(0, MAX_RECENT_EVENTS);
    if (typeof this.onEvent === 'function') this.onEvent(safeEvent);
  }
}

module.exports = { MissionLogWatcher, channelFromPath };
