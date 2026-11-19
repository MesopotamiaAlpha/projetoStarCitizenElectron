import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, MessageSquare, X, CheckCheck, AlertCircle, Volume2, VolumeX, ArrowRight, ExternalLink } from 'lucide-react';
import { loadToken, checkForUpdates, messageIdentity, notificationIdentity, isCrossFeedDuplicate } from '../data/uexNegotiations';
import { checkMarketAlerts, focusMarketAlert, loadMarketAlertSettings, MARKET_ALERT_SETTINGS_UPDATED_EVENT } from '../data/uexMarketAlerts';
import { UEX_ACTIVE_NEGOTIATION_EVENT, getActiveNegotiationHash } from '../data/uexUiEvents';
import { claimNotificationSound } from '../data/notificationSoundGate';
import { markHeard, wasMessageHeard, listHeardMessages } from '../data/uexHeardMessages';

const POLL_INTERVAL_MS = 90 * 1000; // 90s para negociações
const SOUND_MUTED_KEY = 'sc_uex_notif_sound_muted_v1';

function dedupeNotificationItems(list) {
  const messages = list.filter(item => item.kind === 'message');
  const seen = new Set();
  return list.filter(item => {
    if (item.kind === 'notif' && messages.some(message => isCrossFeedDuplicate(message, item))) return false;
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

// Item pertence à negociação que está aberta na tela?
function matchesNegotiation(item, hash) {
  const activeHash = String(hash || '').trim();
  if (!activeHash || !item) return false;
  if (item.kind === 'message') return String(item.negotiationHash || '').trim() === activeHash;
  const references = [item.negotiationHash, item.hash, item.redir, item.url, item.link].map(value => String(value || ''));
  return references.some(value => value.includes(activeHash));
}

// ---------------------------------------------------------------------------
// Som de notificação (Web Audio, sintetizado — não depende de arquivo externo)
// ---------------------------------------------------------------------------
// O Chromium só deixa o AudioContext "running" depois de uma interação do
// usuário. Por isso reutilizamos um único contexto e tentamos destravá-lo a
// CADA interação (não só na primeira) até ele estar rodando. Assim, se o
// contexto ficar suspenso por qualquer motivo, o próximo clique/tecla o recupera.
let notificationAudioContext = null;

function getNotificationAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!notificationAudioContext || notificationAudioContext.state === 'closed') {
    notificationAudioContext = new AudioContextClass();
  }
  return notificationAudioContext;
}

function unlockNotificationAudio() {
  try {
    const ctx = getNotificationAudioContext();
    if (!ctx) return false;
    if (ctx.state !== 'running') {
      const result = ctx.resume();
      if (result?.catch) result.catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

// Em contexto bloqueado o resume() pode ficar pendente para sempre; sem timeout
// a função travava aqui e o som nunca tocava, sem nenhum erro.
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise(resolve => setTimeout(resolve, ms))]);
}

async function getRunningAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  const shared = getNotificationAudioContext();
  if (shared && shared.state !== 'running') await withTimeout(shared.resume(), 500);
  if (shared && shared.state === 'running') return shared;
  try {
    const fresh = new AudioContextClass();
    if (fresh.state !== 'running') await withTimeout(fresh.resume(), 500);
    if (fresh.state === 'running') {
      const old = notificationAudioContext;
      notificationAudioContext = fresh;
      if (old && old !== fresh) Promise.resolve(old.close?.()).catch(() => {});
      return fresh;
    }
    Promise.resolve(fresh.close?.()).catch(() => {});
  } catch { /* sem suporte a áudio */ }
  return null;
}

async function playNotificationSound() {
  // Um som por vez no app todo (o chat de negociações pede a vez na mesma trava).
  if (!claimNotificationSound()) return;
  try {
    const ctx = await getRunningAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const tone = (freq, start, dur, peak = 0.16) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(peak, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch { /* já desconectado */ } };
      osc.start(now + start);
      osc.stop(now + start + dur + 0.03);
    };
    tone(880, 0, 0.12);
    tone(1318.5, 0.1, 0.2);
  } catch { /* ambiente sem suporte a Web Audio — ignora silenciosamente */ }
}

function rememberKeys(set, items) {
  items.forEach(item => set.add(item.key));
  if (set.size > 500) {
    const recent = Array.from(set).slice(-300);
    set.clear();
    recent.forEach(key => set.add(key));
  }
}

export default function UexNotificationBell({ onNavigate }) {
  const [open, setOpen]       = useState(false);
  const [items, setItems]     = useState([]); // { kind:'message'|'notif'|'market-alert', ... }
  const [checking, setChecking] = useState(false);
  const [error, setError]     = useState('');
  const [lastCheck, setLastCheck] = useState(null);
  const [hasToken, setHasToken] = useState(!!loadToken());
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem(SOUND_MUTED_KEY) === '1'; } catch { return false; } });
  const wrapRef = useRef(null);
  const checkingRef = useRef(false);
  const marketCheckingRef = useRef(false);
  const initialMarketSettings = loadMarketAlertSettings();
  const marketNextCheckRef = useRef(initialMarketSettings.nextCheckAt);

  // Refs espelham valores que o polling precisa ler SEM recriar o runCheck.
  // Antes, mudar "muted" ou a negociação ativa recriava o runCheck, o que
  // reiniciava o intervalo e disparava uma checagem extra imediata.
  const itemsRef = useRef([]);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const activeHashRef = useRef(String(getActiveNegotiationHash() || '').trim());
  const notifiedKeysRef = useRef(new Set());

  // Única porta de escrita da lista: atualiza ref + state de forma síncrona e
  // pura, para o som poder ser decidido FORA do updater do setState.
  const commitItems = useCallback(updater => {
    const next = typeof updater === 'function' ? updater(itemsRef.current) : updater;
    itemsRef.current = next;
    setItems(next);
  }, []);

  useEffect(() => {
    const handleActiveNegotiation = event => {
      const activeHash = String(event?.detail?.hash || '').trim();
      activeHashRef.current = activeHash;
      if (activeHash) commitItems(previous => previous.filter(item => !matchesNegotiation(item, activeHash)));
    };
    window.addEventListener(UEX_ACTIVE_NEGOTIATION_EVENT, handleActiveNegotiation);
    return () => window.removeEventListener(UEX_ACTIVE_NEGOTIATION_EVENT, handleActiveNegotiation);
  }, [commitItems]);

  function toggleMuted() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    try { localStorage.setItem(SOUND_MUTED_KEY, next ? '1' : '0'); } catch {}
    // O clique é um gesto do usuário: destrava o áudio e, ao reativar, toca
    // um "ding" de teste.
    if (!next) { unlockNotificationAudio(); playNotificationSound(); }
  }

  const runCheck = useCallback(async (silent = true) => {
    if (checkingRef.current) return;
    if (!loadToken()) { setHasToken(false); return; }
    checkingRef.current = true;
    setHasToken(true);
    setChecking(true);
    try {
      const { newMessages = [], newNotifications = [], diagnostics = null } = await checkForUpdates();
      setLastCheck({ at: Date.now(), ...(diagnostics || {}) });
      setError(diagnostics?.error || '');
      // "...m" vem primeiro para que kind/key/dateAdded calculados aqui sempre
      // prevaleçam (antes, um campo "key"/"kind" vindo do objeto sobrescrevia).
      const incoming = [
        ...newMessages.map(m => ({ ...m, kind: 'message', key: m.key || messageIdentity(m, m.negotiationHash), dateAdded: m.dateAdded || Date.now() })),
        ...newNotifications.map(n => ({ ...n, kind: 'notif', key: n.key || notificationIdentity(n), dateAdded: n.dateAdded || Date.now() })),
      ];

      const knownKeys = new Set(itemsRef.current.map(i => i.key));
      const fresh = incoming.filter(i => !knownKeys.has(i.key) && !notifiedKeysRef.current.has(i.key));
      rememberKeys(notifiedKeysRef.current, fresh);

      // Mensagens que o chat já exibiu (ou que o próprio sino já avisou) não geram novo aviso.
      // Uma notificação geral que repete uma mensagem já conhecida também é descartada, mesmo
      // que o item dela já tenha saído da lista do sino (o usuário já ficou sabendo).
      const knownMessages = [...fresh, ...itemsRef.current, ...listHeardMessages()].filter(i => i.kind === 'message');
      const novel = fresh.filter(i => (i.kind === 'message'
        ? !wasMessageHeard(i.key)
        : !knownMessages.some(message => isCrossFeedDuplicate(message, i))));

      // Mensagem da negociação aberta é avisada pelo próprio chat (som + prévia): o sino
      // fica em silêncio para ela, senão o mesmo aviso tocava duas vezes.
      const activeHash = activeHashRef.current;
      const visibleFresh = novel.filter(i => !matchesNegotiation(i, activeHash));
      markHeard(visibleFresh.filter(i => i.kind === 'message'));
      const shouldPlay = visibleFresh.length > 0;

      commitItems(prev => {
        const visiblePrevious = prev.filter(i => !matchesNegotiation(i, activeHash));
        return dedupeNotificationItems([...visibleFresh, ...visiblePrevious])
          .sort((a, b) => b.dateAdded - a.dateAdded)
          .slice(0, 50);
      });

      if (shouldPlay && !mutedRef.current) playNotificationSound();
    } catch (e) {
      setError(e?.message || 'Não foi possível verificar as negociações.');
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, [commitItems]);

  const runMarketCheck = useCallback(async (silent = true) => {
    if (marketCheckingRef.current) return;
    marketCheckingRef.current = true;
    try {
      const result = await checkMarketAlerts({ silent, automatic: true });
      const mapped = (result?.newEvents || []).map(event => ({
        ...event,
        kind: 'market-alert',
        key: event.key,
        dateAdded: event.dateAdded || Date.now(),
      }));
      if (mapped.length) {
        const knownKeys = new Set(itemsRef.current.map(item => item.key));
        const fresh = mapped.filter(item => !knownKeys.has(item.key));
        if (fresh.length) {
          commitItems(prev => dedupeNotificationItems([...fresh, ...prev]).sort((a, b) => b.dateAdded - a.dateAdded).slice(0, 80));
          if (!mutedRef.current) playNotificationSound();
        }
      }
    } catch (e) {
      if (!silent) setError(e.message || 'Não foi possível verificar os alertas de compra.');
    } finally {
      marketCheckingRef.current = false;
      marketNextCheckRef.current = loadMarketAlertSettings().nextCheckAt;
    }
  }, [commitItems]);

  useEffect(() => {
    // Destrava o áudio a cada interação enquanto o contexto não estiver
    // rodando (políticas de autoplay do Chromium/Electron no Linux). É barato:
    // se já está "running", não faz nada.
    const unlock = () => unlockNotificationAudio();
    unlock(); // funciona de cara se o usuário já interagiu com a página antes
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    runCheck(true);
    const id = setInterval(() => runCheck(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [runCheck]);

  useEffect(() => {
    const initial = loadMarketAlertSettings();
    marketNextCheckRef.current = initial.nextCheckAt;
    if (initial.automaticEnabled && (!initial.nextCheckAt || Date.now() >= initial.nextCheckAt)) runMarketCheck(true);
    const syncSettings = () => {
      const next = loadMarketAlertSettings();
      marketNextCheckRef.current = next.nextCheckAt;
    };
    const timer = setInterval(() => {
      const current = loadMarketAlertSettings();
      marketNextCheckRef.current = current.nextCheckAt;
      if (!current.automaticEnabled) return;
      if (current.nextCheckAt && Date.now() >= current.nextCheckAt && !marketCheckingRef.current) runMarketCheck(true);
    }, 1000);
    window.addEventListener(MARKET_ALERT_SETTINGS_UPDATED_EVENT, syncSettings);
    return () => {
      clearInterval(timer);
      window.removeEventListener(MARKET_ALERT_SETTINGS_UPDATED_EVENT, syncSettings);
    };
  }, [runMarketCheck]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const count = items.length;

  function handleDismissOne(key) {
    commitItems(prev => prev.filter(i => i.key !== key));
  }

  function handleDismissAll() {
    commitItems([]);
  }

  function handleOpenNegotiation(item) {
    const hash = String(item?.negotiationHash || '').trim();
    if (!hash) {
      onNavigate && onNavigate('uexnegotiations');
      setOpen(false);
      return;
    }
    commitItems(previous => previous.filter(current => current.key !== item.key));
    setOpen(false);
    onNavigate && onNavigate('uexnegotiations', { negotiationHash: hash });
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH}h atrás`;
    return `${Math.round(diffH / 24)}d atrás`;
  }

  return (
    <div ref={wrapRef} className="uex-notification-widget" style={{ position: 'fixed', top: 12, right: 12, zIndex: 999, pointerEvents: 'none' }}>
        <button
        className="uex-notification-trigger"
        onClick={() => {
          if (!hasToken && !items.some(item => item.kind === 'market-alert')) { onNavigate && onNavigate('uexapi'); return; }
          setOpen(o => !o);
        }}
        title={hasToken ? 'Notificações UEX' : 'Configure seu token UEX para ativar notificações'}
        style={{
          position: 'relative', width: 40, height: 40, borderRadius: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border-normal)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: 'var(--shadow-card)', pointerEvents: 'auto',
        }}
      >
        <Bell size={18} style={{ color: hasToken ? 'var(--text-primary)' : 'var(--text-muted)' }} />
        {checking && (
          <span style={{ position: 'absolute', bottom: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', opacity: 0.7 }} />
        )}
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px',
            borderRadius: 9, background: 'var(--accent-red)', color: '#fff',
            fontFamily: 'Share Tech Mono,monospace', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 8px rgba(251,113,133,0.6)',
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="uex-notification-panel" style={{
          position: 'absolute', top: 48, right: 0, width: 360, maxHeight: 460,
          background: 'var(--bg-panel)', border: '1px solid var(--border-normal)',
          borderRadius: 10, boxShadow: 'var(--shadow-card)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', pointerEvents: 'auto',
        }}>
          <div className="uex-notification-header" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontFamily: '"Exo 2",sans-serif', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
              Mensagens e alertas da UEX
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={toggleMuted} title={muted ? 'Ativar som de notificação' : 'Silenciar som de notificação'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted ? 'var(--text-muted)' : 'var(--accent-primary)', display: 'flex' }}>
                {muted ? <VolumeX size={14}/> : <Volume2 size={14}/>}
              </button>
              {count > 0 && (
                <button onClick={handleDismissAll} style={{
                  display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
                  color: 'var(--accent-primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>
                  <CheckCheck size={12} /> Marcar tudo como lido
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {error && (
              <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--accent-red)', fontSize: 12 }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            {!error && count === 0 && (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Nenhuma mensagem nova. Você está em dia com as negociações UEX.
              </div>
            )}

            {items.map(item => (
              <div key={item.key} className={`uex-notification-item ${item.kind === 'market-alert' ? 'is-market-alert' : ''}`} style={{
                padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <MessageSquare size={14} style={{ color: item.kind === 'market-alert' ? '#fbbf24' : 'var(--accent-primary)', marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {item.kind === 'market-alert' ? (
                    <button type="button" onClick={() => { focusMarketAlert(item.key); setOpen(false); onNavigate && onNavigate('uexalerts'); }} style={{ display: 'block', width: '100%', padding: 0, color: 'inherit', background: 'none', border: 0, textAlign: 'left', cursor: 'pointer' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>Alerta de compra · {item.itemName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>{Number(item.price || 0).toLocaleString('pt-BR')} {item.currency || 'UEC'}{item.quality !== null && item.quality !== undefined ? ` · qualidade ${item.quality}/1000` : ''}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{item.location || 'Local não informado'}{item.seller ? ` · ${item.seller}` : ''}{item.source ? ` · ${item.source}` : ''}</div>
                    </button>
                  ) : item.kind === 'message' ? (
                    <button
                      type="button"
                      onClick={() => handleOpenNegotiation(item)}
                      className="uex-notification-message-link"
                      style={{ display: 'block', width: '100%', padding: 0, color: 'inherit', background: 'none', border: 0, textAlign: 'left', cursor: 'pointer' }}
                      title="Abrir esta negociação UEX"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.fromUser || 'Comprador/Vendedor'}
                        </span>
                        <ArrowRight size={12} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.listingTitle || 'Negociação UEX'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                        {item.message}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, color: 'var(--accent-primary)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Abrir conversa <ExternalLink size={11} />
                      </div>
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{item.message}</div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'Share Tech Mono,monospace' }}>
                    {timeAgo(item.dateAdded)}
                  </div>
                </div>
                <button className="uex-notification-dismiss" onClick={() => handleDismissOne(item.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-subtle)' }}>
            {lastCheck && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textAlign: 'center', fontFamily: 'Share Tech Mono,monospace' }}>
                Última verificação {new Date(lastCheck.at).toLocaleTimeString('pt-BR')}
                {typeof lastCheck.total === 'number' ? ` · ${lastCheck.active}/${lastCheck.total} negociações ativas` : ''}
              </div>
            )}
            <button
              className="uex-notification-refresh"
              onClick={() => Promise.all([runCheck(false), runMarketCheck(false)])}
              disabled={checking}
              style={{
                width: '100%', padding: '6px 0', background: 'rgba(56,189,248,0.08)',
                border: '1px solid var(--border-normal)', borderRadius: 6,
                color: 'var(--accent-primary)', fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', cursor: checking ? 'not-allowed' : 'pointer',
                opacity: checking ? 0.6 : 1,
              }}
            >
              {checking ? 'Verificando negociações...' : 'Verificar negociações e alertas'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}