import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, RefreshCw, ArrowLeft, ExternalLink, AlertTriangle, Key } from 'lucide-react';
import {
  loadToken, loadUsername, fetchNegotiations, fetchNegotiationMessages,
} from '../data/uexNegotiations';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('pt-BR');
}

function NegotiationThread({ negotiation, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const myUsername = loadUsername().trim().toLowerCase();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await fetchNegotiationMessages(negotiation.hash);
      setMessages(data.filter(m => m.message));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [negotiation.hash]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
          {negotiation.listing_title}
        </div>
        <a href={`https://uexcorp.space/marketplace/${negotiation.listing_slug}`} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent-primary)' }}>
          Ver anúncio <ExternalLink size={11} />
        </a>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
        {negotiation.advertiser_username} (vendedor) ↔ {negotiation.client_username} (comprador) ·{' '}
        {negotiation.price} {negotiation.unit} · {negotiation.currency}
        {negotiation.date_closed ? <span style={{ color: 'var(--accent-red)' }}> · Encerrada em {fmtDate(negotiation.date_closed)}</span> : <span style={{ color: 'var(--accent-green)' }}> · Ativa</span>}
      </div>

      {error && (
        <div style={{ padding: 10, background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.25)', borderRadius: 6, color: 'var(--accent-red)', fontSize: 12, marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Carregando mensagens...</div>}
        {!loading && messages.length === 0 && !error && (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nenhuma mensagem nesta negociação ainda.</div>
        )}
        {messages.map(m => {
          const isMine = myUsername && (m.user_username || '').trim().toLowerCase() === myUsername;
          return (
            <div key={m.id} style={{
              alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '75%',
              background: isMine ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)',
              border: `1px solid ${isMine ? 'rgba(0,212,255,0.3)' : 'var(--border-subtle)'}`,
              borderRadius: 8, padding: '8px 12px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>
                {isMine ? 'Você' : m.user_username}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{m.message}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'Share Tech Mono,monospace' }}>
                {fmtDate(m.date_added)}{!m.date_read && !isMine ? ' · não lida' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function UexNegotiationsPage() {
  const [negotiations, setNegotiations] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [selected, setSelected]         = useState(null);
  const hasToken = !!loadToken();

  const load = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true); setError('');
    try {
      const data = await fetchNegotiations();
      data.sort((a, b) => (b.date_modified || 0) - (a.date_modified || 0));
      setNegotiations(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [hasToken]);

  useEffect(() => { load(); }, [load]);

  if (!hasToken) {
    return (
      <div className="page-body" style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 16, background: 'rgba(255,196,54,0.06)', border: '1px solid rgba(255,196,54,0.25)', borderRadius: 8 }}>
          <Key size={16} style={{ color: 'var(--accent-gold)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Configure seu token (e a secret key, se sua conta UEX exigir) na aba <strong>UEX API (Live)</strong> para ver suas negociações e mensagens do Marketplace.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={18} style={{ color: 'var(--accent-primary)' }} /> NEGOCIAÇÕES UEX
          </div>
          <div className="page-subtitle">{negotiations.length} negociação{negotiations.length !== 1 ? 'ões' : ''} encontrada{negotiations.length !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.35)', borderRadius: 7, color: 'var(--accent-primary)', fontFamily: 'Rajdhani,sans-serif', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Atualizar
        </button>
      </div>

      <div className="page-body" style={{ padding: 24, height: '100%' }}>
        {error && (
          <div style={{ display: 'flex', gap: 8, padding: 12, background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.25)', borderRadius: 6, color: 'var(--accent-red)', fontSize: 12, marginBottom: 14 }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {selected ? (
          <NegotiationThread negotiation={selected} onBack={() => setSelected(null)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading && negotiations.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Carregando...</div>}
            {!loading && negotiations.length === 0 && !error && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nenhuma negociação encontrada na sua conta UEX.</div>
            )}
            {negotiations.map(n => (
              <button key={n.id} onClick={() => setSelected(n)} style={{
                textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, cursor: 'pointer',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{n.listing_title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {n.advertiser_username} ↔ {n.client_username} · {n.price} {n.unit} {n.currency}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: n.date_closed ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {n.date_closed ? 'Encerrada' : 'Ativa'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'Share Tech Mono,monospace' }}>
                    {fmtDate(n.date_modified)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
