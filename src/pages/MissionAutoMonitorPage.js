import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock3, FileSearch, FolderOpen,
  History, ListChecks, Pause, Play, Radio, RefreshCw, RotateCcw, ScanLine,
  Square, Tag, Trophy, XCircle, Zap,
} from 'lucide-react';
import {
  appendMissionAutoMonitorEvent,
  clearMissionAutoMonitorEvents,
  getMissionAutoMonitorStats,
  loadMissionAutoMonitor,
  MISSION_AUTO_MONITOR_UPDATED_EVENT,
  saveMissionAutoMonitor,
  setMissionAutoMonitorEnabled,
  setMissionAutoMonitorStatus,
} from '../data/missionAutoMonitor';

const STATUS_LABELS = {
  mission_start: 'Missão iniciada',
  mission_complete: 'Missão concluída',
  mission_ended: 'Missão encerrada',
  blueprint_received: 'Blueprint recebido',
  session_reset: 'Nova sessão do jogo',
};

const STATUS_COLORS = {
  mission_start: '#38bdf8',
  mission_complete: '#34d399',
  mission_ended: '#fb7185',
  blueprint_received: '#fbbf24',
  session_reset: '#a78bfa',
};

function getElectronAPI() {
  return typeof window !== 'undefined' && window.electronAPI ? window.electronAPI : null;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
  } catch {
    return '—';
  }
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}min`;
  return `${minutes}min ${String(secs).padStart(2, '0')}s`;
}

function eventTitle(event) {
  if (event.type === 'blueprint_received') return event.productName || 'Blueprint sem nome';
  return event.debugName || 'Missão sem nome';
}

function eventDescription(event) {
  if (event.type === 'mission_start') return `${event.generator || 'Gerador não informado'} · em andamento`;
  if (event.type === 'mission_complete') return `${event.completionLabel || 'Concluída'} · duração ${formatDuration(event.durationSec)}`;
  if (event.type === 'mission_ended') return `${event.completionLabel || 'Encerrada'} · ${event.reason || 'motivo não informado'}`;
  if (event.type === 'blueprint_received') return event.missionDebugName ? `Relacionado a ${event.missionDebugName}` : 'Sem missão relacionada no log';
  return 'Estado do monitor atualizado';
}

function InfoCard({ icon: Icon, label, value, color }) {
  return <div className="mission-auto-stat-card" style={{ '--mission-auto-color': color }}><span className="mission-auto-stat-icon"><Icon size={17} /></span><div><strong>{value}</strong><small>{label}</small></div></div>;
}

function EmptyState({ text }) {
  return <div className="mission-auto-empty"><ScanLine size={22} /><span>{text}</span></div>;
}

export default function MissionAutoMonitorPage() {
  const [state, setState] = useState(() => loadMissionAutoMonitor());
  const [status, setStatus] = useState(() => loadMissionAutoMonitor());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');

  const refreshLocal = useCallback(() => {
    const next = loadMissionAutoMonitor();
    setState(next);
    setStatus(current => ({ ...current, ...next }));
  }, []);

  const refreshStatus = useCallback(async () => {
    const api = getElectronAPI();
    if (!api?.missionMonitorStatus) return;
    try {
      const next = await api.missionMonitorStatus();
      setStatus(next);
      setMissionAutoMonitorStatus(next);
    } catch (err) {
      setError(err.message || 'Não foi possível consultar o monitor automático.');
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const api = getElectronAPI();
    const cleanEvent = api?.onMissionMonitorEvent ? api.onMissionMonitorEvent(event => {
      const next = appendMissionAutoMonitorEvent(event);
      setState(next);
      setStatus(current => ({ ...current, ...next }));
      setMessage(`${STATUS_LABELS[event.type] || 'Novo evento'} registrado com a etiqueta AUTO.`);
      window.setTimeout(() => setMessage(''), 3600);
    }) : null;
    const cleanStatus = api?.onMissionMonitorStatus ? api.onMissionMonitorStatus(next => {
      const persisted = setMissionAutoMonitorStatus(next);
      setState(persisted);
      setStatus(next);
    }) : null;
    const onLocalUpdate = () => refreshLocal();
    window.addEventListener(MISSION_AUTO_MONITOR_UPDATED_EVENT, onLocalUpdate);
    return () => {
      if (typeof cleanEvent === 'function') cleanEvent();
      if (typeof cleanStatus === 'function') cleanStatus();
      window.removeEventListener(MISSION_AUTO_MONITOR_UPDATED_EVENT, onLocalUpdate);
    };
  }, [refreshLocal, refreshStatus]);

  const mergedState = { ...state, ...status, events: state.events || [], activeMissions: status.activeMissions || state.activeMissions || [] };
  const stats = useMemo(() => getMissionAutoMonitorStats(mergedState), [mergedState.events, mergedState.activeMissions]);
  const filteredEvents = useMemo(() => {
    if (historyFilter === 'all') return mergedState.events;
    return mergedState.events.filter(event => event.type === historyFilter);
  }, [mergedState.events, historyFilter]);
  const running = Boolean(status.running || state.running);
  const selectedPath = status.logPath || state.logPath || '';

  async function chooseLog() {
    const api = getElectronAPI();
    setError('');
    if (!api?.missionMonitorChooseLog) {
      setError('A seleção de arquivos está disponível somente na versão Electron do aplicativo.');
      return;
    }
    try {
      const selected = await api.missionMonitorChooseLog();
      if (selected) {
        const next = saveMissionAutoMonitor({ logPath: selected, lastError: '' });
        setState(next);
        setStatus(current => ({ ...current, ...next }));
        setMessage('Game.log selecionado. O monitor está pronto para ser ligado.');
      }
    } catch (err) {
      setError(err.message || 'Não foi possível selecionar o Game.log.');
    }
  }

  async function toggleMonitor() {
    const api = getElectronAPI();
    setError('');
    setMessage('');
    if (!api?.missionMonitorStart || !api?.missionMonitorStop) {
      setError('O monitor automático precisa ser executado na versão Electron do aplicativo.');
      return;
    }
    setBusy(true);
    try {
      if (running) {
        const nextStatus = await api.missionMonitorStop();
        const next = saveMissionAutoMonitor({ ...nextStatus, enabled: false });
        setState(next);
        setStatus(nextStatus);
        setMessage('Monitor automático desligado. O Rastreador manual não foi alterado.');
      } else {
        let pathToStart = selectedPath;
        if (!pathToStart) {
          pathToStart = await api.missionMonitorChooseLog();
          if (pathToStart) {
            const selected = saveMissionAutoMonitor({ logPath: pathToStart });
            setState(selected);
          }
        }
        if (!pathToStart) throw new Error('Escolha o arquivo Game.log antes de ligar o monitor.');
        const nextStatus = await api.missionMonitorStart(pathToStart);
        const next = saveMissionAutoMonitor({ ...nextStatus, enabled: true, logPath: pathToStart });
        setState(next);
        setStatus(nextStatus);
        setMessage('Monitor automático ligado. Os registros serão salvos somente nesta ferramenta.');
      }
    } catch (err) {
      const next = saveMissionAutoMonitor({ lastError: err.message || 'Não foi possível alterar o monitor.' });
      setState(next);
      setError(err.message || 'Não foi possível alterar o monitor.');
    } finally {
      setBusy(false);
    }
  }

  function clearHistory() {
    if (!window.confirm('Deseja apagar o histórico automático desta ferramenta? O Rastreador manual não será alterado.')) return;
    const next = clearMissionAutoMonitorEvents();
    setState(next);
    setStatus(current => ({ ...current, ...next }));
    setMessage('Histórico automático apagado.');
  }

  return <div className="page-container mission-auto-page">
    <div className="page-header mission-auto-header"><div><div className="eyebrow"><Radio size={14} /> FERRAMENTA INDEPENDENTE</div><h1>Monitor Automático de Missões</h1><p>Leia eventos do Game.log do Star Citizen e mantenha um histórico automático separado do Rastreador de Missões manual.</p></div><button type="button" className={`mission-auto-power ${running ? 'on' : 'off'}`} onClick={toggleMonitor} disabled={busy}><span className="mission-auto-power-dot" />{busy ? 'Alterando...' : running ? 'Monitor ligado' : 'Monitor desligado'}</button></div>

    <div className="mission-auto-boundary"><AlertTriangle size={16} /><span>Esta é uma ferramenta independente. Registros marcados como <strong>AUTO</strong> ficam somente neste histórico e não são inseridos nem alterados no Rastreador de Missões.</span></div>

    <section className="mission-auto-control-card"><div className="mission-auto-control-title"><div><strong>Fonte de dados</strong><small>Selecione o arquivo que será acompanhado enquanto o jogo estiver aberto.</small></div><span className={`mission-auto-connection ${running ? 'connected' : 'disconnected'}`}><span />{running ? `Conectado · ${status.channel || 'UNKNOWN'}` : 'Desligado'}</span></div><div className="mission-auto-path-row"><div className="mission-auto-path"><FileSearch size={16} /><span title={selectedPath}>{selectedPath || 'Nenhum Game.log selecionado'}</span></div><button type="button" className="mission-auto-secondary-button" onClick={chooseLog} disabled={running}><FolderOpen size={14} /> Escolher Game.log</button><button type="button" className="mission-auto-primary-button" onClick={toggleMonitor} disabled={busy}>{running ? <><Square size={14} /> Desligar</> : <><Play size={14} /> Ligar monitor</>}</button></div>{state.lastError && <div className="mission-auto-error"><XCircle size={14} />{state.lastError}</div>}<div className="mission-auto-help"><Zap size={14} /> O arquivo é lido localmente; o monitor não acessa a memória do jogo e não altera seus arquivos.</div></section>

    {error && <div className="mission-auto-error mission-auto-error-prominent"><AlertTriangle size={14} />{error}</div>}
    {message && <div className="mission-auto-success"><CheckCircle2 size={14} />{message}</div>}

    <div className="mission-auto-stats"><InfoCard icon={Activity} label="Missões em andamento" value={stats.active} color="#38bdf8" /><InfoCard icon={Trophy} label="Missões concluídas" value={stats.completed} color="#34d399" /><InfoCard icon={XCircle} label="Missões encerradas" value={stats.ended} color="#fb7185" /><InfoCard icon={ListChecks} label="Blueprints recebidos" value={stats.blueprints} color="#fbbf24" /><InfoCard icon={History} label="Eventos registrados" value={stats.totalEvents} color="#a78bfa" /></div>

    <div className="mission-auto-columns"><section className="mission-auto-panel"><div className="mission-auto-panel-heading"><div><strong>Missões em andamento</strong><small>Capturadas automaticamente pelo Game.log</small></div><RefreshCw size={15} className={running ? 'mission-auto-spin' : ''} /></div>{mergedState.activeMissions.length === 0 ? <EmptyState text={running ? 'Nenhuma missão ativa identificada ainda.' : 'Ligue o monitor para acompanhar missões ativas.'} /> : <div className="mission-auto-active-list">{mergedState.activeMissions.map(mission => <article className="mission-auto-active-card" key={mission.guid}><span className="mission-auto-badge"><Tag size={10} /> AUTO</span><div><strong>{mission.debugName || 'Missão sem nome'}</strong><small>{mission.generator || 'Gerador não informado'} · iniciada em {formatDate(mission.startTs)}</small></div><Clock3 size={15} /></article>)}</div>}</section>

    <section className="mission-auto-panel mission-auto-history-panel"><div className="mission-auto-panel-heading"><div><strong>Histórico automático</strong><small>Eventos registrados sem alterar missões manuais</small></div><button type="button" className="mission-auto-clear-button" onClick={clearHistory} disabled={!mergedState.events.length}><RotateCcw size={13} /> Limpar</button></div><div className="mission-auto-filter-row"><button type="button" className={historyFilter === 'all' ? 'active' : ''} onClick={() => setHistoryFilter('all')}>Todos</button><button type="button" className={historyFilter === 'mission_start' ? 'active' : ''} onClick={() => setHistoryFilter('mission_start')}>Inícios</button><button type="button" className={historyFilter === 'mission_complete' ? 'active' : ''} onClick={() => setHistoryFilter('mission_complete')}>Concluídas</button><button type="button" className={historyFilter === 'mission_ended' ? 'active' : ''} onClick={() => setHistoryFilter('mission_ended')}>Encerradas</button><button type="button" className={historyFilter === 'blueprint_received' ? 'active' : ''} onClick={() => setHistoryFilter('blueprint_received')}>Blueprints</button></div>{filteredEvents.length === 0 ? <EmptyState text="Nenhum evento automático registrado." /> : <div className="mission-auto-event-list">{filteredEvents.map(event => <article className="mission-auto-event-card" key={event.eventId}><span className="mission-auto-event-icon" style={{ color: STATUS_COLORS[event.type] || '#94a3b8' }}>{event.type === 'blueprint_received' ? <ListChecks size={15} /> : event.type === 'mission_complete' ? <CheckCircle2 size={15} /> : event.type === 'mission_ended' ? <XCircle size={15} /> : <Activity size={15} />}</span><div className="mission-auto-event-copy"><div><strong>{eventTitle(event)}</strong><span className="mission-auto-badge"><Tag size={10} /> AUTO</span></div><small>{STATUS_LABELS[event.type] || event.type} · {eventDescription(event)}</small><small className="mission-auto-event-meta">{formatDate(event.ts)} · {event.channel || 'UNKNOWN'}{event.guid ? ` · ID ${event.guid}` : ''}</small></div></article>)}</div>}</section></div>

    <div className="mission-auto-footer-note"><Pause size={13} /> Desligar esta ferramenta interrompe apenas o monitoramento automático. O histórico já salvo permanece disponível até você escolher <strong>Limpar</strong>.</div>
  </div>;
}
