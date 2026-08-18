'use strict';

const fs = require('fs');
const path = require('path');

const POLL_INTERVAL_MS = 250;
const MAX_READ_CHUNK = 32 * 1024 * 1024;
// O watcher.py funcional reprocessa o Game.log desde o início. Isso é
// necessário para recuperar uma missão aceita antes de o monitor ser ligado.
const INITIAL_REPLAY_BYTES = 0;
const BLUEPRINT_CORRELATION_WINDOW_MS = 5000;
const MAX_RECENT_EVENTS = 120;

const PATTERN_TIMESTAMP = /^<([0-9T:\-.Z]+)>/;
const PATTERN_MARKER = /CreateMarker.*?missionId\s*:?\s*\[([^\]]+)\].*?generator\s+name\s*:?\s*\[([^\]]+)\].*?contract\s*:?\s*\[([^\]]+)\]/i;
const PATTERN_MARKER_DEF_ID = /contractDefinitionId\s*:?\s*\[([^\]]+)\]/i;
const PATTERN_ACCEPTED_START = /(?:notification\s+")?(?:Contract\s+Accepted|CONTRATO\s+ACEITO|CONTRATO\s+ACCEPTED)\s*:/i;
const PATTERN_MISSION_ID = /(?:MissionId|missionId|mission_id)\s*(?::|\[|\s)?\s*\[?([0-9a-f]{8}-[0-9a-f-]{27,36})\]?/i;
const PATTERN_END_MISSION = /<EndMission>.*?MissionId\s*:?\s*\[([^\]]+)\].*?CompletionType\s*:?\s*\[(\w+)\].*?Reason\s*:?\s*\[([^\]]+)\]/i;
const PATTERN_COMPLETION_NOTIFICATION = /(?:CONTRATO\s+(?:CONCLU[IÍ]DO|COMPLETADO|FINALIZADO|FALHOU|ABANDONADO)|CONTRACT\s+(?:COMPLETED|COMPLETE|FAILED|ABANDONED)|MISSION\s+(?:COMPLETED|COMPLETE|FAILED|ABANDONED))/i;
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
  const match = /(?:Contract\s+Accepted|CONTRATO\s+ACEITO|CONTRATO\s+ACCEPTED)\s*:\s*([^"\r\n]*)/i.exec(firstLine);
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
    this.pendingCompletion = null;
    this.markers = new Map();
    this.active = new Map();
    this.recentLifecycle = [];
    this.recentEvents = [];
    this.startedAt = null;
    this.lastEventAt = null;
    this.lastError = '';
    this.debug = {
      pollCount: 0,
      readCount: 0,
      bytesRead: 0,
      linesRead: 0,
      linesProcessed: 0,
      eventsEmitted: 0,
      phase: 'idle',
      patternMatches: { accepted: 0, marker: 0, reward: 0, endMission: 0, blueprint: 0 },
      candidateMatches: 0,
      lastCandidate: null,
      candidateHistory: [],
      pendingAccepted: null,
      lastReadAt: null,
      lastLineAt: null,
      lastFileCheckAt: null,
      lastLinePreview: '',
      lastMatch: null,
      lastErrorCode: null,
      fileExists: false,
      fileReadable: false,
      fileSize: 0,
      position: 0,
      initialReplayBytes: INITIAL_REPLAY_BYTES,
      trace: [],
      lastTraceSignature: null,
    };
  }

  trace(step, details = {}, level = 'info') {
    const entry = { seq: (this.debug.trace?.length || 0) + 1, at: new Date().toISOString(), step, ...details };
    this.debug.trace = [...(this.debug.trace || []), entry].slice(-200);
    const prefix = `[MissionWatcher][${entry.seq}][${step}]`;
    try {
      if (level === 'error') console.error(prefix, details);
      else if (level === 'warn') console.warn(prefix, details);
      else console.info(prefix, details);
    } catch (_) {}
    return entry;
  }

  status() {
    return {
      watcherVersion: 'emoto-mission-watcher-2.0.0-active-replay',
      running: Boolean(this.timer),
      logPath: this.logPath || null,
      channel: this.channel,
      position: this.position,
      startedAt: this.startedAt,
      lastEventAt: this.lastEventAt,
      lastError: this.lastError || null,
      activeMissions: Array.from(this.active.values()).map(mission => ({ ...mission })),
      recentEvents: this.recentEvents.slice(),
      debug: {
        ...this.debug,
        position: this.position,
        fileSize: this.debug.fileSize,
        fileExists: this.debug.fileExists,
        activeCount: this.active.size,
      },
    };
  }

  emitStatus() {
    if (typeof this.onStatus === 'function') this.onStatus(this.status());
  }

  async start(logPath) {
    this.trace('start.received', { rawPath: logPath, rawType: typeof logPath });
    const normalized = path.resolve(String(logPath || '').trim());
    if (!normalized) {
      this.debug.phase = 'start_error';
      this.debug.lastErrorCode = 'EMPTY_PATH';
      throw new Error('Informe o caminho do Game.log do Star Citizen.');
    }
    if (this.timer) await this.stop();
    let stats;
    this.trace('start.normalized', { normalized, platform: process.platform });
    try {
      stats = fs.statSync(normalized);
      this.trace('file.stat.ok', { path: normalized, size: stats.size, isFile: stats.isFile(), mtimeMs: stats.mtimeMs });
    } catch (error) {
      this.debug.phase = 'file_not_found';
      this.debug.lastErrorCode = error.code || 'STAT_FAILED';
      this.debug.fileExists = false;
      this.debug.fileReadable = false;
      this.debug.lastFileCheckAt = new Date().toISOString();
      this.lastError = `Game.log não encontrado: ${error.message}`;
      this.emitStatus();
      throw new Error(this.lastError);
    }
    if (!stats.isFile()) {
      this.debug.phase = 'not_a_file';
      this.debug.lastErrorCode = 'NOT_A_FILE';
      this.lastError = 'O caminho escolhido não é um arquivo Game.log.';
      this.emitStatus();
      throw new Error(this.lastError);
    }

    this.logPath = normalized;
    this.channel = channelFromPath(normalized);
    this.position = INITIAL_REPLAY_BYTES === 0
      ? 0
      : Math.max(0, stats.size - INITIAL_REPLAY_BYTES);
    this.fileIdentity = `${stats.dev || ''}:${stats.ino || ''}`;
    this.partial = '';
    this.pendingAcceptedLine = '';
    this.pendingAcceptedTs = 0;
    this.pendingCompletion = null;
    this.markers.clear();
    this.active.clear();
    this.recentLifecycle = [];
    this.recentEvents = [];
    this.startedAt = Date.now();
    this.lastEventAt = null;
    this.lastError = '';
    this.debug = {
      ...this.debug,
      phase: 'starting',
      fileExists: true,
      fileReadable: true,
      fileSize: stats.size,
      lastFileCheckAt: new Date().toISOString(),
      lastErrorCode: null,
      position: this.position,
      lastReadAt: null,
      lastLineAt: null,
      lastLinePreview: '',
      lastMatch: null,
      trace: [],
      lastTraceSignature: null,
    };
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    // Primeira leitura síncrona do ciclo de monitoramento: o frontend recebe
    // imediatamente a confirmação de existência, tamanho e legibilidade do
    // Game.log, sem permanecer em `idle` até o próximo intervalo.
    this.poll();
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
    this.debug.pollCount += 1;
    let stats;
    try {
      stats = fs.statSync(this.logPath);
      this.debug.lastFileCheckAt = new Date().toISOString();
    } catch (error) {
      this.debug.phase = 'file_unavailable';
      this.debug.fileExists = false;
      this.debug.fileReadable = false;
      this.debug.lastErrorCode = error.code || 'STAT_FAILED';
      this.debug.lastMatch = 'file_stat_error';
      this.lastError = `Não foi possível ler o Game.log: ${error.message}`;
      this.emitStatus();
      return;
    }

    this.debug.phase = 'file_readable';
    this.debug.fileExists = true;
    this.debug.fileReadable = true;
    const previousFileSize = this.debug.fileSize;
    const identity = `${stats.dev || ''}:${stats.ino || ''}`;
    const sizeChanged = stats.size !== previousFileSize || stats.size > this.position;
    this.debug.fileSize = stats.size;
    if (sizeChanged) this.trace('poll.file', { size: stats.size, position: this.position, growth: stats.size - this.position, identity });
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
      this.debug.readCount += 1;
      this.debug.bytesRead += length;
      this.debug.phase = 'reading';
      this.debug.lastReadAt = new Date().toISOString();
      this.debug.fileSize = stats.size;
      this.fileIdentity = identity;
      this.partial += buffer.toString('utf8');
      const lines = this.partial.split(/\r?\n/);
      this.partial = lines.pop() || '';
      const completeLines = lines.filter(Boolean);
      this.debug.linesRead += completeLines.length;
      this.trace('read.chunk', { bytes: length, position: this.position, completeLines: completeLines.length, partialBytes: Buffer.byteLength(this.partial, 'utf8') });
      completeLines.forEach(line => this.processLine(line));
      this.lastError = '';
      this.emitStatus();
    } catch (error) {
      this.debug.phase = 'read_error';
      this.debug.lastErrorCode = error.code || 'READ_FAILED';
      this.debug.lastMatch = 'read_error';
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
    this.pendingCompletion = null;
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

  finishMission(guid, completion, line, ts, reason = '') {
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
      reason: cleanText(reason) || cleanText(line),
      startTs: active?.startTs || null,
      endTs: ts,
      durationSec: active ? Math.max(0, Math.round((ts - active.startTs) / 10) / 100) : null,
      channel: this.channel,
      ts,
    };
    this.active.delete(guid);
    if (completion === 'Complete') this.addLifecycle('complete', { guid, debugName, contractDefinitionId }, ts);
    this.emitEvent(event);
  }

  processLine(line) {
    this.debug.linesProcessed += 1;
    this.debug.lastLineAt = new Date().toISOString();
    this.debug.lastLinePreview = String(line || '').slice(0, 240);
    const candidate = /(?:Notification|UpdateNotificationItem|PlayerJoined|EndMission|ObjectiveUpserted|CreateMarker|mission_id|MissionId|missionId)/i.test(String(line || ''));
    if (candidate) {
      const preview = String(line || '').slice(0, 500);
      this.debug.candidateMatches += 1;
      this.debug.lastCandidate = preview;
      this.debug.candidateHistory = [preview, ...(this.debug.candidateHistory || [])].slice(0, 40);
      this.trace('line.candidate', { line: preview });
    }
    const ts = parseTimestamp(line);
    let match = PATTERN_MARKER.exec(line);
    if (match) {
      this.debug.patternMatches.marker += 1;
      this.debug.lastMatch = 'marker';
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
      this.trace('pattern.marker', { guid, debugName: marker.debugName, generator: marker.generator, contractDefinitionId: marker.contractDefinitionId });
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
      this.debug.patternMatches.accepted += 1;
      this.debug.lastMatch = 'accepted';
      if (parseMissionId(line)) acceptedPayload = line;
      else {
        this.pendingAcceptedLine = line;
        this.pendingAcceptedTs = ts;
        this.debug.pendingAccepted = {
          reason: 'waiting_mission_id',
          since: new Date(ts).toISOString(),
          preview: String(line).slice(0, 500),
        };
        this.trace('accepted.waiting_mission_id', { line: String(line).slice(0, 1000), timestamp: ts });
        return;
      }
    }
    if (acceptedPayload) {
      this.trace('pattern.accepted', { payload: String(acceptedPayload).slice(0, 1200), hadPendingLine: Boolean(this.pendingAcceptedLine) });
      this.pendingAcceptedLine = '';
      this.pendingAcceptedTs = 0;
      this.debug.pendingAccepted = null;
      const guid = parseMissionId(acceptedPayload);
      if (!guid) {
        this.trace('accepted.missing_mission_id', { payload: String(acceptedPayload).slice(0, 1200) }, 'warn');
        return;
      }
      const marker = this.markers.get(guid);
      if (this.active.has(guid)) {
        this.trace('mission.start.duplicate', { guid });
        return;
      }
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
      this.trace('mission.start.emit', { guid, debugName: mission.debugName, activeCount: this.active.size });
      this.emitEvent({ type: 'mission_start', ...mission, channel: this.channel, ts });
      return;
    }
    if (!pendingIsFresh) {
      if (this.pendingAcceptedLine) this.debug.pendingAccepted = { reason: 'mission_id_timeout', preview: String(this.pendingAcceptedLine).slice(0, 500) };
      this.pendingAcceptedLine = '';
      this.pendingAcceptedTs = 0;
    }

    const completionIsFresh = Boolean(this.pendingCompletion) && (ts - this.pendingCompletion.ts) <= 5000;
    if (completionIsFresh && parseMissionId(line)) {
      const pending = this.pendingCompletion;
      this.pendingCompletion = null;
      this.finishMission(parseMissionId(line), pending.completion, `${pending.line}\n${line}`, ts, pending.line);
      return;
    }
    if (PATTERN_COMPLETION_NOTIFICATION.test(line)) {
      this.debug.patternMatches.endMission += 1;
      this.debug.lastMatch = 'completion_notification';
      const completion = /(?:FALHOU|FAILED)/i.test(line) ? 'Fail' : /(?:ABANDONADO|ABANDONED)/i.test(line) ? 'Abandon' : 'Complete';
      const guid = parseMissionId(line);
      if (guid) {
        this.finishMission(guid, completion, line, ts, line);
        return;
      }
      this.pendingCompletion = { line, completion, ts };
      return;
    }
    if (!completionIsFresh) this.pendingCompletion = null;

    match = PATTERN_END_MISSION.exec(line);
    if (match) {
      this.debug.patternMatches.endMission += 1;
      this.debug.lastMatch = 'endMission';
      this.finishMission(match[1], match[2], line, ts, match[3]);
      return;
    }

    const reward = parseRewardFromText(line);
    if (reward !== null) {
      this.debug.patternMatches.reward += 1;
      this.debug.lastMatch = 'reward';
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
      this.debug.patternMatches.blueprint += 1;
      this.debug.lastMatch = 'blueprint';
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
    this.trace('event.emit', { type: event?.type || null, guid: event?.guid || event?.missionGuid || null, activeCount: this.active.size });
    const safeEvent = { ...event, eventId: `${event.type}:${event.guid || event.productName || 'event'}:${event.ts || Date.now()}` };
    this.lastEventAt = safeEvent.ts || Date.now();
    this.debug.eventsEmitted += 1;
    this.recentEvents = [safeEvent, ...this.recentEvents.filter(item => item.eventId !== safeEvent.eventId)].slice(0, MAX_RECENT_EVENTS);
    if (typeof this.onEvent === 'function') this.onEvent(safeEvent);
  }
}

module.exports = { MissionLogWatcher, channelFromPath };
