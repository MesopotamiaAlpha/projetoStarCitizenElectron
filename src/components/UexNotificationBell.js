import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, MessageSquare, X, CheckCheck, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import { loadToken, checkForUpdates } from '../data/uexNegotiations';

const POLL_INTERVAL_MS = 90 * 1000; // 90s
const SOUND_MUTED_KEY = 'sc_uex_notif_sound_muted_v1';

// Toca um "ding" de duas notas sintetizado — não depende de nenhum arquivo de áudio.
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
      osc.start(now + start);
      osc.stop(now + start + dur + 0.03);
    };
    tone(880, 0, 0.12);
    tone(1318.5, 0.1, 0.2);
    setTimeout(() => ctx.close(), 600);
  } catch { /* ambiente sem suporte a Web Audio — ignora silenciosamente */ }
}

export default function UexNotificationBell({ onNavigate }) {
  const [open, setOpen]       = useState(false);
  const [items, setItems]     = useState([]); // { kind:'message'|'notif', ... }
  const [checking, setChecking] = useState(false);
  const [error, setError]     = useState('');
  const [hasToken, setHasToken] = useState(!!loadToken());
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem(SOUND_MUTED_KEY) === '1'; } catch { return false; } });
  const wrapRef = useRef(null);

  function toggleMuted() {
    setMuted(prev => {
      const next = !prev;
      try { localStorage.setItem(SOUND_MUTED_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  }

  const runCheck = useCallback(async (silent = true) => {
    if (!loadToken()) { setHasToken(false); return; }
    setHasToken(true);
    setChecking(true);
    if (!silent) setError('');
    try {
      const { newMessages, newNotifications } = await checkForUpdates();
      const mapped = [
        ...newMessages.map(m => ({ kind: 'message', key: `m${m.id}`, ...m })),
        ...newNotifications.map(n => ({ kind: 'notif', key: `n${n.id}`, ...n })),
      ];
      if (mapped.length) {
        setItems(prev => {
          const existingKeys = new Set(prev.map(i => i.key));
          const freshOnes = mapped.filter(i => !existingKeys.has(i.key));
          if (freshOnes.length && !muted) playNotificationSound();
          const merged = [...freshOnes, ...prev];
          return merged.sort((a, b) => b.dateAdded - a.dateAdded).slice(0, 50);
        });
      }
    } catch (e) {
      if (!silent) setError(e.message);
    } finally {
      setChecking(false);
    }
  }, [muted]);

  useEffect(() => {
    runCheck(true);
    const id = setInterval(() => runCheck(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [runCheck]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const count = items.length;

  function handleDismissOne(key) {
    setItems(prev => prev.filter(i => i.key !== key));
  }

  function handleDismissAll() {
    setItems([]);
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
    <div ref={wrapRef} style={{ position: 'fixed', top: 16, right: 20, zIndex: 999 }}>
      <button
        onClick={() => {
          if (!hasToken) { onNavigate && onNavigate('uexapi'); return; }
          setOpen(o => !o);
        }}
        title={hasToken ? 'Notificações UEX' : 'Configure seu token UEX para ativar notificações'}
        style={{
          position: 'relative', width: 40, height: 40, borderRadius: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border-normal)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: 'var(--shadow-card)',
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
        <div style={{
          position: 'absolute', top: 48, right: 0, width: 360, maxHeight: 460,
          background: 'var(--bg-panel)', border: '1px solid var(--border-normal)',
          borderRadius: 10, boxShadow: 'var(--shadow-card)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontFamily: '"Exo 2",sans-serif', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
              Mensagens da UEX
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
              <div key={item.key} style={{
                padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <MessageSquare size={14} style={{ color: 'var(--accent-primary)', marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {item.kind === 'message' ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.fromUser || 'Comprador/Vendedor'} · {item.listingTitle}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, wordBreak: 'break-word' }}>
                        {item.message}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{item.message}</div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'Share Tech Mono,monospace' }}>
                    {timeAgo(item.dateAdded)}
                  </div>
                </div>
                <button onClick={() => handleDismissOne(item.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => runCheck(false)}
              disabled={checking}
              style={{
                width: '100%', padding: '6px 0', background: 'rgba(56,189,248,0.08)',
                border: '1px solid var(--border-normal)', borderRadius: 6,
                color: 'var(--accent-primary)', fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', cursor: checking ? 'not-allowed' : 'pointer',
                opacity: checking ? 0.6 : 1,
              }}
            >
              {checking ? 'Verificando...' : 'Verificar agora'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}