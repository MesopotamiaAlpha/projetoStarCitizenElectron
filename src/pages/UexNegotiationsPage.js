import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BellRing, ClipboardCheck, Copy, MessageSquare, RefreshCw, ArrowLeft, ExternalLink, AlertTriangle, Key, Send, CheckCircle2, XCircle, Languages, BookOpen, Coins, Filter } from 'lucide-react';
import {
  loadToken, loadUsername, fetchNegotiations, fetchNegotiationMessages, sendNegotiationMessage,
  getNegotiationMessageSender, isOwnNegotiationMessage,
  translatePortugueseToEnglish, translateEnglishToPortuguese,
} from '../data/uexNegotiations';
import {
  getNegotiationClosure, closeNegotiation, registerNegotiationSale,
} from '../data/uexSales';
import { buildUexListingUrl } from '../data/uexNegotiations';
import { UEX_ACTIVE_NEGOTIATION_EVENT, UEX_TEXTS_UPDATED_EVENT, dispatchUexUiEvent } from '../data/uexUiEvents';
import { getNegotiationClosedAt, isNegotiationClosed } from '../data/uexNegotiationStatus';
import { formatRelativeMessageTime } from '../data/uexMessageTime';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('pt-BR');
}

async function copyTextToClipboard(text) {
  if (!text) throw new Error('Não há texto para copiar.');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

const CHAT_POLL_INTERVAL_MS = 5000;
const UEX_TEXTS_KEY = 'sc_uex_texts_v1';

function loadQuickUexTexts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(UEX_TEXTS_KEY) || '[]');
    return (Array.isArray(parsed) ? parsed : [])
      .filter(item => String(item?.title || '').trim() && String(item?.content || '').trim())
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  } catch {
    return [];
  }
}

function playChatNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.setValueAtTime(1174.66, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.32);
    window.setTimeout(() => ctx.close(), 550);
  } catch { /* Alguns ambientes Electron bloqueiam áudio sem interação prévia. */ }
}

function messageKey(message) {
  return String(message.id ?? `${message.date_added || 0}:${message.user_username || ''}:${message.message || ''}`);
}

function getNegotiationListingUrl(negotiation) {
  const directUrl = [
    negotiation?.listing_url,
    negotiation?.listingUrl,
    negotiation?.source_listing_url,
    negotiation?.url,
    negotiation?.link,
  ].map(value => String(value || '').trim()).find(value => /^https?:\/\//i.test(value));
  if (directUrl) return directUrl;

  const slug = negotiation?.listing_slug
    || negotiation?.source_listing_slug
    || negotiation?.listing?.slug
    || negotiation?.listing?.listing_slug;
  return slug ? buildUexListingUrl(slug) : '';
}

const NEGOTIATION_COLORS = [
  { accent:'#38bdf8', soft:'rgba(56,189,248,0.08)' },
  { accent:'#a78bfa', soft:'rgba(167,139,250,0.08)' },
  { accent:'#34d399', soft:'rgba(52,211,153,0.08)' },
  { accent:'#fb923c', soft:'rgba(251,146,60,0.08)' },
  { accent:'#f472b6', soft:'rgba(244,114,182,0.08)' },
  { accent:'#facc15', soft:'rgba(250,204,21,0.08)' },
];

function negotiationColor(negotiation) {
  const key = String(negotiation.hash || negotiation.id || negotiation.listing_slug || 'uex');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return NEGOTIATION_COLORS[hash % NEGOTIATION_COLORS.length];
}

function negotiationCounterparty(negotiation) {
  const isMyListing = Number(negotiation.is_listing_advertiser) === 1 || negotiation.is_listing_advertiser === true;
  return {
    name: (isMyListing ? negotiation.client_username : negotiation.advertiser_username) || 'Usuário UEX',
    role: isMyListing ? 'Comprador' : 'Vendedor',
  };
}

function negotiationAmount(negotiation) {
  const amount = negotiation.deal_value ?? negotiation.price;
  return amount === null || amount === undefined || amount === '' ? '—' : `${amount} ${negotiation.unit || ''} ${negotiation.deal_value_currency || negotiation.currency || ''}`.trim();
}

function numericInputValue(value) {
  let text = String(value ?? '').trim().replace(/[^0-9,.-]/g, '');
  if (!text) return 0;
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    text = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (comma >= 0) {
    text = text.replace(',', '.');
  } else if ((text.match(/\./g) || []).length > 1) {
    text = text.replace(/\./g, '');
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function SaleCompletionModal({ negotiation, onCancel, onConfirm, saving }) {
  const initialQuantity = Math.max(1, Math.round(numericInputValue(negotiation?.deal_quantity || negotiation?.quantity || 1)));
  const initialTotal = numericInputValue(negotiation?.deal_value || negotiation?.total_price || (numericInputValue(negotiation?.price) * initialQuantity));
  const initialUnitPrice = numericInputValue(negotiation?.unit_price || negotiation?.unitPrice || negotiation?.price) || (initialTotal > 0 ? initialTotal / initialQuantity : 0);
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [unitPriceInput, setUnitPriceInput] = useState(initialUnitPrice > 0 ? String(initialUnitPrice) : '');
  const [error, setError] = useState('');
  const qty = numericInputValue(quantity);
  const unitPrice = numericInputValue(unitPriceInput);
  const total = qty > 0 && unitPrice > 0 ? qty * unitPrice : 0;

  function submit(event) {
    event.preventDefault();
    if (!Number.isFinite(qty) || qty <= 0) { setError('Informe uma quantidade maior que zero.'); return; }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) { setError('Informe um valor unitário maior que zero.'); return; }
    onConfirm({ quantity: Math.round(qty), unitPrice, totalRevenue: total });
  }

  const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'Share Tech Mono,monospace', fontSize: 14, outline: 'none' };
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, background: 'rgba(0,0,0,0.76)' }} onMouseDown={event => { if (event.target === event.currentTarget && !saving) onCancel(); }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 470, background: 'var(--bg-card)', border: '1px solid rgba(52,211,153,0.38)', borderRadius: 12, padding: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.62)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontFamily: 'Michroma,sans-serif', fontSize: 13, fontWeight: 800 }}><Coins size={16} /> CONCLUIR VENDA</div>
            <div style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.5 }}>Informe o que foi realmente vendido. A quantidade pode ser maior que a quantidade do anúncio.</div>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 5, color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '9px 11px', marginBottom: 14, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 7 }}>
          <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 800 }}>{negotiation?.listing_title || 'Item da negociação'}</div>
          <div style={{ marginTop: 3, color: 'var(--text-muted)', fontSize: 10 }}>Comprador: @{negotiation?.client_username || 'não informado'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Quantidade vendida<input autoFocus type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} style={{ ...fieldStyle, marginTop: 5 }} /></label>
          <label style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Valor unitário<input type="number" min="0.01" step="0.01" value={unitPriceInput} onChange={event => setUnitPriceInput(event.target.value)} placeholder="Ex.: 400000" style={{ ...fieldStyle, marginTop: 5 }} /></label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12, padding: '9px 11px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.18)', borderRadius: 7, color: 'var(--text-secondary)', fontSize: 11 }}><div style={{ display:'flex', justifyContent:'space-between', gap:10 }}><span>Valor unitário</span><strong style={{ color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono,monospace' }}>{unitPrice > 0 ? `${unitPrice.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} aUEC` : '—'}</strong></div><div style={{ display:'flex', justifyContent:'space-between', gap:10 }}><span>Total calculado ({qty > 0 ? qty : 0} × unitário)</span><strong style={{ color: 'var(--accent-green)', fontFamily: 'Share Tech Mono,monospace' }}>{total > 0 ? `${total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} aUEC` : '—'}</strong></div></div>
        {error && <div style={{ marginTop: 10, color: 'var(--accent-red)', fontSize: 11 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onCancel} disabled={saving} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', background: 'rgba(52,211,153,0.13)', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 6, color: 'var(--accent-green)', cursor: saving ? 'wait' : 'pointer', fontSize: 11, fontWeight: 800 }}>{saving ? 'Registrando...' : 'Confirmar e registrar venda'}</button>
        </div>
      </form>
    </div>
  );
}

function NegotiationThread({ negotiation, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [replyPt, setReplyPt] = useState('');
  const [replyEn, setReplyEn] = useState('');
  const [sendingLanguage, setSendingLanguage] = useState('');
  const [sendError, setSendError] = useState('');
  const [translationStatus, setTranslationStatus] = useState('idle');
  const [translationError, setTranslationError] = useState('');
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [messageTranslations, setMessageTranslations] = useState({});
  const [translatingMessageId, setTranslatingMessageId] = useState('');
  const [translationMessageError, setTranslationMessageError] = useState('');
  const [incomingPreview, setIncomingPreview] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [relativeNow, setRelativeNow] = useState(() => Date.now());
  const [polling, setPolling] = useState(false);
  const [buyerCopied, setBuyerCopied] = useState(false);
  const [buyerCopyError, setBuyerCopyError] = useState('');
  const [quickTexts, setQuickTexts] = useState(() => loadQuickUexTexts());
  const [quickTextsOpen, setQuickTextsOpen] = useState(false);
  const [quickTextCopiedId, setQuickTextCopiedId] = useState('');
  const [closure, setClosure] = useState(() => getNegotiationClosure(negotiation.hash));
  const [closing, setClosing] = useState(false);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [closeError, setCloseError] = useState('');
  const myUsername = loadUsername();
  const apiClosedAt = getNegotiationClosedAt(negotiation);
  const isClosed = isNegotiationClosed(negotiation) || !!closure;
  const isMyListing = Number(negotiation.is_listing_advertiser) === 1 || negotiation.is_listing_advertiser === true;
  const isBuyer = !isMyListing;
  const messagesEndRef = React.useRef(null);
  const knownMessageIdsRef = React.useRef(new Set());
  const firstLoadRef = React.useRef(true);
  const pollingRef = React.useRef(false);
  const requestRef = React.useRef(false);
  const translationRequestRef = React.useRef(0);
  const englishManualEditRef = React.useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setRelativeNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    dispatchUexUiEvent(UEX_ACTIVE_NEGOTIATION_EVENT, {
      hash: String(negotiation.hash || ''),
      listingTitle: negotiation.listing_title || '',
    });
    const refreshQuickTexts = event => {
      const incoming = event?.detail?.texts;
      setQuickTexts(Array.isArray(incoming) ? incoming.filter(item => String(item?.title || '').trim() && String(item?.content || '').trim()) : loadQuickUexTexts());
    };
    const refreshFromStorage = event => {
      if (!event || event.key === UEX_TEXTS_KEY) setQuickTexts(loadQuickUexTexts());
    };
    window.addEventListener(UEX_TEXTS_UPDATED_EVENT, refreshQuickTexts);
    window.addEventListener('storage', refreshFromStorage);
    return () => {
      window.removeEventListener(UEX_TEXTS_UPDATED_EVENT, refreshQuickTexts);
      window.removeEventListener('storage', refreshFromStorage);
      dispatchUexUiEvent(UEX_ACTIVE_NEGOTIATION_EVENT, { hash: '' });
    };
  }, [negotiation.hash, negotiation.listing_title]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (requestRef.current) return;
    requestRef.current = true;
    if (silent) { pollingRef.current = true; setPolling(true); } else { setLoading(true); setError(''); }
    try {
      const data = await fetchNegotiationMessages(negotiation.hash);
      const sorted = (Array.isArray(data) ? data : []).filter(m => m.message).sort((a, b) => (a.date_added || 0) - (b.date_added || 0));
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
      } else {
        const incoming = sorted.filter(m => !knownMessageIdsRef.current.has(messageKey(m)) && !isOwnNegotiationMessage(m, myUsername, negotiation));
        if (incoming.length) {
          const newestIncoming = incoming[incoming.length - 1];
          setNewMessagesCount(count => count + incoming.length);
          setIncomingPreview(newestIncoming);
          playChatNotificationSound();
          if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
          window.setTimeout(() => setIncomingPreview(current => current?.id === newestIncoming.id ? null : current), 6500);
        }
      }
      knownMessageIdsRef.current = new Set(sorted.map(messageKey));
      setMessages(sorted);
      setLastUpdatedAt(Date.now());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      requestRef.current = false;
      if (silent) { pollingRef.current = false; setPolling(false); } else setLoading(false);
    }
  }, [negotiation.hash, myUsername]);

  useEffect(() => {
    firstLoadRef.current = true;
    knownMessageIdsRef.current = new Set();
    setNewMessagesCount(0);
    setIncomingPreview(null);
    setMessageTranslations({});
    setTranslationMessageError('');
    setLastUpdatedAt(null);
    setError('');
    load();
    const timer = window.setInterval(() => load({ silent: true }), CHAT_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Traduz automaticamente após uma pausa curta, evitando uma chamada por tecla.
  useEffect(() => {
    const sourceText = replyPt.trim();
    translationRequestRef.current += 1;
    const requestId = translationRequestRef.current;
    englishManualEditRef.current = false;
    if (!sourceText) {
      setReplyEn('');
      setTranslationStatus('idle');
      setTranslationError('');
      return undefined;
    }

    setTranslationStatus('waiting');
    setTranslationError('');
    const timer = window.setTimeout(async () => {
      setTranslationStatus('translating');
      try {
        const translated = await translatePortugueseToEnglish(sourceText);
        if (translationRequestRef.current !== requestId) return;
        if (!englishManualEditRef.current) setReplyEn(translated);
        setTranslationStatus('ready');
      } catch (e) {
        if (translationRequestRef.current !== requestId) return;
        setTranslationStatus('error');
        setTranslationError(e.message || 'Não foi possível traduzir automaticamente.');
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [replyPt]);

  // Rola pra última mensagem sempre que a conversa carrega ou recebe algo novo
  useEffect(() => {
    if (!loading) messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading]);

  async function handleSendMessage(message, language) {
    const text = String(message || '').trim();
    if (!text || sendingLanguage) return;
    setSendingLanguage(language);
    setSendError('');
    try {
      await sendNegotiationMessage(negotiation.hash, text);
      setReplyPt('');
      setReplyEn('');
      englishManualEditRef.current = false;
      setTranslationStatus('idle');
      await load(); // recarrega a conversa pra mostrar a mensagem enviada
    } catch (e) { setSendError(e.message); }
    finally { setSendingLanguage(''); }
  }

  function handleSendPortuguese() {
    handleSendMessage(replyPt, 'pt');
  }

  function handleSendEnglish() {
    handleSendMessage(replyEn, 'en');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendPortuguese(); }
  }

  async function handleTranslateMessage(message) {
    const messageId = messageKey(message);
    if (translatingMessageId === messageId) return;
    if (messageTranslations[messageId]) {
      setMessageTranslations(current => {
        const next = { ...current };
        delete next[messageId];
        return next;
      });
      setTranslationMessageError('');
      return;
    }
    setTranslatingMessageId(messageId);
    setTranslationMessageError('');
    try {
      const translated = await translateEnglishToPortuguese(message.message);
      setMessageTranslations(current => ({ ...current, [messageId]: translated }));
    } catch (e) {
      setTranslationMessageError(e.message || 'Não foi possível traduzir esta mensagem.');
    } finally {
      setTranslatingMessageId('');
    }
  }

  function revealNewMessages() {
    setNewMessagesCount(0);
    setIncomingPreview(null);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

    async function handleCopyBuyerNick() {
    const buyerNick = String(negotiation.client_username || '').trim();
    if (!buyerNick) { setBuyerCopyError('Esta negociação não informa o nick do comprador.'); return; }
    try { await copyTextToClipboard(buyerNick);
      setBuyerCopied(true);
      setBuyerCopyError('');
      window.setTimeout(() => setBuyerCopied(false), 1800);
    } catch (e) { setBuyerCopyError(e.message); }
  }

  async function handleCopyQuickText(text) {
    try {
      await copyTextToClipboard(text?.content || '');
      setQuickTextCopiedId(text.id);
      window.setTimeout(() => setQuickTextCopiedId(current => current === text.id ? '' : current), 1800);
    } catch (e) {
      setSendError(e.message || 'Não foi possível copiar o texto UEX.');
    }
  }

  function handleCloseNegotiation(status, saleOverrides = {}) {
    if (closing || closure) return;
    setClosing(true);
    setCloseError('');
    try {
      let result = null;
      if (status === 'success') result = registerNegotiationSale(negotiation, saleOverrides);
      const savedClosure = closeNegotiation(negotiation.hash, status, {
        role: 'seller',
        saleId: result?.sale?.id || null,
        saleCreated: result?.saleCreated || false,
        catalogCreated: result?.catalogCreated || false,
        vaultConsumption: result?.vaultConsumption || null,
      });
      setClosure({ ...savedClosure, sale: result?.sale || null });
      setSaleModalOpen(false);
    } catch (e) {
      setCloseError(e.message || 'Não foi possível registrar o encerramento local.');
    } finally {
      setClosing(false);
    }
  }

  function handleBuyerSuccess() {
    if (closing || closure) return;
    setClosing(true);
    setCloseError('');
    try {
      const savedClosure = closeNegotiation(negotiation.hash, 'success', {
        role: 'buyer',
        saleId: null,
        saleCreated: false,
        catalogCreated: false,
        purchaseCompleted: true,
      });
      setClosure(savedClosure);
    } catch (e) {
      setCloseError(e.message || 'Não foi possível finalizar a compra local.');
    } finally {
      setClosing(false);
    }
  }

  const lastUpdatedLabel = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString('pt-BR') : '—';
  const negotiationListingUrl = getNegotiationListingUrl(negotiation);

  return (
    <div className="uex-thread-shell" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {saleModalOpen && <SaleCompletionModal negotiation={negotiation} saving={closing} onCancel={() => setSaleModalOpen(false)} onConfirm={values => handleCloseNegotiation('success', values)} />}
      <div className="uex-thread-header" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <div style={{ fontFamily: '"Exo 2",sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
          {negotiation.listing_title}
        </div>
        <div style={{ marginLeft: 'auto', position:'relative', display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', justifyContent:'flex-end' }}>
          {negotiationListingUrl && (
            <a href={negotiationListingUrl} target="_blank" rel="noreferrer" data-help="Abra o anúncio correspondente na UEX para revisar ou finalizar a venda diretamente no site." style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 9px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.32)', borderRadius:6, color:'var(--accent-green)', fontSize:10, fontWeight:800, textDecoration:'none', textTransform:'uppercase', whiteSpace:'nowrap' }}>
              Verificar anúncio na UEX <ExternalLink size={11} />
            </a>
          )}
          <a href="https://uexcorp.space/marketplace/manage" target="_blank" rel="noreferrer" data-help="Abra o gerenciador de anúncios da UEX para administrar seus anúncios." style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 9px', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.32)', borderRadius:6, color:'var(--accent-gold)', fontSize:10, fontWeight:800, textDecoration:'none', textTransform:'uppercase', whiteSpace:'nowrap' }}>
            Ir para gerenciador UEX <ExternalLink size={11} />
          </a>
          <a href="https://robertsspaceindustries.com/spectrum/community/SC" target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 9px', background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.32)', borderRadius:6, color:'var(--accent-primary)', fontSize:10, fontWeight:800, textDecoration:'none', textTransform:'uppercase', whiteSpace:'nowrap' }}>
            Abrir Spectrum <ExternalLink size={11} />
          </a>
          <button type="button" onClick={() => setQuickTextsOpen(opened => !opened)} data-help="Abra seus textos UEX salvos para copiar uma resposta sem sair desta negociação." style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 9px', background:quickTextsOpen?'rgba(167,139,250,0.16)':'rgba(167,139,250,0.09)', border:`1px solid ${quickTextsOpen?'rgba(167,139,250,0.5)':'rgba(167,139,250,0.32)'}`, borderRadius:6, color:'var(--accent-purple)', cursor:'pointer', fontSize:10, fontWeight:800, textTransform:'uppercase' }}>
            <BookOpen size={12}/> Textos UEX {quickTexts.length ? `(${quickTexts.length})` : ''}
          </button>
          {quickTextsOpen && (
            <div className="uex-quick-texts-popover">
              <div className="uex-quick-texts-popover-header"><span><BookOpen size={13}/> TEXTOS UEX</span><small>{quickTexts.length ? 'Clique em copiar para reutilizar' : 'Nenhum texto salvo'}</small></div>
              {quickTexts.length > 0 ? quickTexts.map(text => (
                <div className="uex-quick-text-item" key={text.id}>
                  <div className="uex-quick-text-copy">
                    <strong title={text.title}>{text.title}</strong>
                    <span>{String(text.content).replace(/\s+/g, ' ').trim().slice(0, 105)}{String(text.content).trim().length > 105 ? '…' : ''}</span>
                  </div>
                  <button type="button" onClick={() => handleCopyQuickText(text)} className={`uex-quick-text-copy-button${quickTextCopiedId === text.id ? ' copied' : ''}`} title="Copiar texto para a área de transferência">
                    {quickTextCopiedId === text.id ? <ClipboardCheck size={13}/> : <Copy size={13}/>}
                    <span>{quickTextCopiedId === text.id ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              )) : (
                <div className="uex-quick-texts-empty">Cadastre respostas na seção <strong>Bloco de Notas &gt; Textos UEX</strong> para acessá-las aqui.</div>
              )}
            </div>
          )}
          <button type="button" onClick={handleCopyBuyerNick} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 9px', background:buyerCopied?'rgba(52,211,153,0.12)':'rgba(56,189,248,0.1)', border:`1px solid ${buyerCopied?'rgba(52,211,153,0.35)':'rgba(56,189,248,0.35)'}`, borderRadius:6, color:buyerCopied?'var(--accent-green)':'var(--accent-primary)', cursor:'pointer', fontSize:10, fontWeight:800, textTransform:'uppercase' }}>
            {buyerCopied ? <ClipboardCheck size={12}/> : <Copy size={12}/>} {buyerCopied ? 'Nick copiado' : 'Copiar o nick do comprador'}
          </button>
        </div>
      </div>
      {buyerCopyError && <div style={{ marginBottom:8, color:'var(--accent-red)', fontSize:11 }}>{buyerCopyError}</div>}

      {closure ? (
        <div style={{ marginBottom:10, padding:'9px 11px', background:closure.status==='success'?'rgba(52,211,153,0.09)':'rgba(251,113,133,0.09)', border:`1px solid ${closure.status==='success'?'rgba(52,211,153,0.32)':'rgba(251,113,133,0.32)'}`, borderRadius:7, color:closure.status==='success'?'var(--accent-green)':'var(--accent-red)', fontSize:11, lineHeight:1.5, display:'flex', alignItems:'flex-start', gap:8 }}>
          {closure.status==='success' ? <CheckCircle2 size={14} style={{ flexShrink:0, marginTop:1 }}/> : <XCircle size={14} style={{ flexShrink:0, marginTop:1 }}/>}
          <span><strong>{closure.status==='success' ? (closure.role === 'buyer' ? 'COMPRA CONCLUÍDA COM SUCESSO' : 'NEGOCIAÇÃO CONCLUÍDA COM SUCESSO') : 'NEGOCIAÇÃO ENCERRADA SEM SUCESSO'}</strong><br/>{closure.status==='success' ? (closure.role === 'buyer' ? 'Compra finalizada localmente. Nenhum valor foi solicitado ou registrado.' : (closure.saleCreated === false ? 'A venda já existia e foi atualizada no Acompanhamento UEX > Vendas.' : 'Venda registrada automaticamente em Acompanhamento UEX > Vendas.')) : 'Nenhuma venda foi criada para esta negociação.'}
            {closure.status === 'success' && closure.vaultConsumption?.status === 'consumed' && <><br/><span style={{ color:'var(--accent-green)' }}>Baú atualizado: {closure.vaultConsumption.boxes} caixa{closure.vaultConsumption.boxes === 1 ? '' : 's'} de {closure.vaultConsumption.boxQuantity} {closure.vaultConsumption.boxUnit} descontada{closure.vaultConsumption.boxes === 1 ? '' : 's'}{closure.vaultConsumption.quality ? ` · qualidade ${closure.vaultConsumption.quality}` : ''}.</span></>}
            {closure.status === 'success' && closure.vaultConsumption?.status === 'failed' && <><br/><span style={{ color:'var(--accent-gold)' }}>Venda registrada, mas o Baú não foi descontado: {closure.vaultConsumption.message}</span></>}
            {closure.status === 'success' && closure.vaultConsumption?.status === 'not_linked' && <><br/><span style={{ color:'var(--text-muted)' }}>O anúncio não possui vínculo com o Baú; nenhuma quantidade foi descontada.</span></>}
          </span>
        </div>
      ) : (
        <div style={{ marginBottom:10, padding:'9px 11px', background:'rgba(255,255,255,0.025)', border:'1px solid var(--border-subtle)', borderRadius:7 }}>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:8 }}>Registrar resultado local da negociação. Isso não envia nenhuma ação para a UEX.</div>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
            {isBuyer ? (
              <button type="button" onClick={handleBuyerSuccess} disabled={closing} data-help="Marca esta negociação como compra concluída. Não solicita nem registra valor de compra." style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 10px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.32)', borderRadius:6, color:'var(--accent-green)', cursor:closing?'wait':'pointer', fontSize:10, fontWeight:800, textTransform:'uppercase', opacity:closing?0.6:1 }}><CheckCircle2 size={12}/> Finalizar compra com sucesso</button>
            ) : (
              <button type="button" onClick={()=>setSaleModalOpen(true)} disabled={closing} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 10px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.32)', borderRadius:6, color:'var(--accent-green)', cursor:closing?'wait':'pointer', fontSize:10, fontWeight:800, textTransform:'uppercase', opacity:closing?0.6:1 }}><CheckCircle2 size={12}/> Concluir com sucesso e registrar venda</button>
            )}
            <button type="button" onClick={()=>handleCloseNegotiation('failed')} disabled={closing} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 10px', background:'rgba(251,113,133,0.08)', border:'1px solid rgba(251,113,133,0.28)', borderRadius:6, color:'var(--accent-red)', cursor:closing?'wait':'pointer', fontSize:10, fontWeight:800, textTransform:'uppercase', opacity:closing?0.6:1 }}><XCircle size={12}/> Encerrar sem sucesso</button>
          </div>
          {closeError && <div style={{ marginTop:8, color:'var(--accent-red)', fontSize:10, lineHeight:1.4 }}>{closeError}</div>}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>
        {negotiation.advertiser_username} (vendedor) ↔ {negotiation.client_username} (comprador) ·{' '}
        {negotiation.price} {negotiation.unit} · {negotiation.currency}
        {apiClosedAt ? <span style={{ color: 'var(--accent-red)' }}> · Encerrada em {fmtDate(apiClosedAt)}</span> : <span style={{ color: 'var(--accent-green)' }}> · Ativa</span>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:10, color:'var(--text-muted)', fontSize:10 }}>
        <BellRing size={11} style={{ color:'var(--accent-primary)' }}/>
        Atualização automática a cada 5s · última consulta {lastUpdatedLabel}{polling ? ' · consultando agora...' : ''}
      </div>

      {incomingPreview&&<button type="button" onClick={revealNewMessages} style={{ display:'flex',alignItems:'flex-start',gap:8,width:'100%',boxSizing:'border-box',padding:'9px 11px',marginBottom:9,background:'rgba(52,211,153,0.12)',border:'1px solid rgba(52,211,153,0.42)',borderRadius:7,color:'var(--accent-green)',cursor:'pointer',textAlign:'left' }}>
        <BellRing size={14} style={{ flexShrink:0,marginTop:1 }}/>
        <span style={{ fontSize:11,lineHeight:1.45 }}><strong>Nova mensagem recebida de {incomingPreview.user_username || 'comprador/vendedor'}</strong><br/>{String(incomingPreview.message || '').slice(0,160)}{String(incomingPreview.message || '').length > 160 ? '…' : ''}</span>
      </button>}

      {error && (
        <div style={{ padding: 10, background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.25)', borderRadius: 6, color: 'var(--accent-red)', fontSize: 12, marginBottom: 10 }}>
          {error}
        </div>
      )}
      {translationMessageError && (
        <div style={{ padding: '7px 10px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 6, color: 'var(--accent-gold)', fontSize: 11, marginBottom: 10 }}>
          {translationMessageError}
        </div>
      )}

      <div className="uex-thread-messages" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {newMessagesCount > 0 && <button type="button" onClick={revealNewMessages} style={{ position:'sticky', top:0, zIndex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'8px 10px', background:'rgba(56,189,248,0.14)', border:'1px solid rgba(56,189,248,0.4)', borderRadius:7, color:'var(--accent-primary)', cursor:'pointer', fontSize:11, fontWeight:800 }}><BellRing size={13}/> {newMessagesCount} nova{newMessagesCount !== 1 ? 's' : ''} mensagem{newMessagesCount !== 1 ? 'ns' : ''} recebida{newMessagesCount !== 1 ? 's' : ''} — ver agora</button>}
        {loading && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Carregando mensagens...</div>}
        {!loading && messages.length === 0 && !error && (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nenhuma mensagem nesta negociação ainda.</div>
        )}
        {messages.map(m => {
          const isMine = isOwnNegotiationMessage(m, myUsername, negotiation);
          const translationId = messageKey(m);
          const translatedMessage = messageTranslations[translationId];
          const isTranslating = translatingMessageId === translationId;
          return (
            <div key={m.id} className="uex-message-card" style={{
              alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '75%',
              background: isMine ? 'rgba(56,189,248,0.1)' : 'var(--bg-card)',
              border: `1px solid ${isMine ? 'rgba(56,189,248,0.3)' : 'var(--border-subtle)'}`,
              borderRadius: 8, padding: '8px 12px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>
                {isMine ? 'Você' : (getNegotiationMessageSender(m) || 'Usuário UEX')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{m.message}</div>
              {!isMine && (
                <>
                  <button type="button" onClick={() => handleTranslateMessage(m)} disabled={isTranslating} className="uex-message-translate-button">
                    {isTranslating ? <RefreshCw size={11} className="uex-spin"/> : <Languages size={11}/>} {isTranslating ? 'Traduzindo...' : translatedMessage ? 'Ocultar tradução' : 'Traduzir'}
                  </button>
                  {translatedMessage && (
                    <div className="uex-message-translation">
                      <span className="uex-message-translation-label">Tradução em português</span>
                      <div>{translatedMessage}</div>
                    </div>
                  )}
                </>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'Share Tech Mono,monospace' }}>
                {formatRelativeMessageTime(m.date_added, relativeNow)}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef}/>
      </div>

      {/* Caixa de resposta */}
      {isClosed ? (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(122,144,176,0.06)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Esta negociação está encerrada — não é possível enviar novas mensagens.
        </div>
      ) : (
        <div className="uex-thread-composer" style={{ marginTop: 12, flexShrink: 0, minHeight: 0 }}>
          {sendError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.25)', borderRadius: 6, color: 'var(--accent-red)', fontSize: 11, marginBottom: 8 }}>
              <AlertTriangle size={12} />{sendError}
            </div>
          )}
          {translationError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 6, color: 'var(--accent-gold)', fontSize: 11, marginBottom: 8 }}>
              <AlertTriangle size={12} />{translationError}
            </div>
          )}
          <div className="uex-bilingual-composer">
            <div className="uex-composer-pane uex-composer-pane-pt">
              <div className="uex-composer-heading">
                <span><strong>Português (Brasil)</strong><small>Mensagem original</small></span>
                <span className="uex-language-badge">PT-BR</span>
              </div>
              <textarea
                value={replyPt}
                onChange={e => setReplyPt(String(e.target.value))}
                onKeyDown={handleKeyDown}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Escreva em português... (aceita letras, números e valores como 2.000.000)"
                rows={4}
                className="uex-composer-textarea"
              />
              <button type="button" onClick={handleSendPortuguese} disabled={!replyPt.trim() || !!sendingLanguage} className="uex-send-button uex-send-button-pt">
                {sendingLanguage === 'pt' ? <RefreshCw size={13} className="uex-spin"/> : <Send size={13}/>} {sendingLanguage === 'pt' ? 'Enviando...' : 'Enviar em português'}
              </button>
            </div>

            <div className="uex-composer-translation-arrow" aria-hidden="true">→</div>

            <div className="uex-composer-pane uex-composer-pane-en">
              <div className="uex-composer-heading">
                <span><strong>English</strong><small>{translationStatus === 'translating' ? 'Traduzindo...' : translationStatus === 'ready' ? 'Tradução pronta para revisão' : 'Tradução automática'}</small></span>
                <span className="uex-language-badge uex-language-badge-en">EN</span>
              </div>
              <textarea
                value={replyEn}
                onChange={e => { englishManualEditRef.current = true; setReplyEn(String(e.target.value)); }}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="A tradução aparecerá aqui; você pode editar letras, números e valores"
                rows={4}
                className="uex-composer-textarea"
              />
              <button type="button" onClick={handleSendEnglish} disabled={!replyEn.trim() || !!sendingLanguage} className="uex-send-button uex-send-button-en">
                {sendingLanguage === 'en' ? <RefreshCw size={13} className="uex-spin"/> : <Send size={13}/>} {sendingLanguage === 'en' ? 'Enviando...' : 'Enviar em inglês'}
              </button>
            </div>
          </div>
          <div className="uex-composer-hint">
            A tradução é automática após uma breve pausa. Revise o inglês antes de enviar; você também pode editar qualquer uma das duas caixas.
          </div>
        </div>
      )}
    </div>
  );
}

export default function UexNegotiationsPage({ targetNegotiationHash = '', onTargetNegotiationConsumed }) {
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

  const [statusFilter, setStatusFilter] = useState('active');

  const getNegotiationListStatus = useCallback((negotiation) => {
    const closure = getNegotiationClosure(negotiation.hash);
    if (closure?.status === 'success') return 'success';
    if (closure?.status === 'failed') return 'failed';
    if (isNegotiationClosed(negotiation)) return 'closed';
    return 'active';
  }, []);

  const filteredNegotiations = useMemo(() => {
    if (statusFilter === 'all') return negotiations;
    return negotiations.filter(negotiation => getNegotiationListStatus(negotiation) === statusFilter);
  }, [negotiations, statusFilter, getNegotiationListStatus]);

  const statusCounts = useMemo(() => negotiations.reduce((counts, negotiation) => {
    const status = getNegotiationListStatus(negotiation);
    counts[status] = (counts[status] || 0) + 1;
    counts.all += 1;
    return counts;
  }, { all: 0, active: 0, closed: 0, success: 0, failed: 0 }), [negotiations, getNegotiationListStatus]);

  useEffect(() => {
    const target = String(targetNegotiationHash || '').trim();
    if (!target || !negotiations.length) return;
    const match = negotiations.find(negotiation => String(negotiation.hash || negotiation.id || '').trim() === target);
    if (match) {
      setSelected(match);
      onTargetNegotiationConsumed?.();
    }
  }, [targetNegotiationHash, negotiations, onTargetNegotiationConsumed]);

  if (!hasToken) {
    return (
      <div className="page-body" style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 16, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8 }}>
          <Key size={16} style={{ color: 'var(--accent-gold)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Configure seu token (e a secret key, se sua conta UEX exigir) na aba <strong>UEX API (Live)</strong> para ver suas negociações e mensagens do Marketplace.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="uex-negotiations-page">
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={18} style={{ color: 'var(--accent-primary)' }} /> NEGOCIAÇÕES UEX
          </div>
          <div className="page-subtitle">{filteredNegotiations.length} de {negotiations.length} negociação{negotiations.length !== 1 ? 'ões' : ''} exibida{filteredNegotiations.length !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.35)', borderRadius: 7, color: 'var(--accent-primary)', fontFamily: '"Exo 2",sans-serif', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Atualizar
        </button>
      </div>

      <div className={`page-body uex-negotiations-body${selected ? ' has-selected-thread' : ''}`} style={{ padding: 24, height: '100%', minHeight: 0, boxSizing: 'border-box' }}>
        {!selected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 14, padding: '10px 12px', background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}><Filter size={13} /> Mostrar</div>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} style={{ padding: '7px 28px 7px 9px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: '"Exo 2",sans-serif', fontSize: 11, fontWeight: 700, outline: 'none' }}>
              <option value="active">Ativas ({statusCounts.active || 0})</option>
              <option value="closed">Encerradas pela UEX ({statusCounts.closed || 0})</option>
              <option value="success">Finalizadas com sucesso ({statusCounts.success || 0})</option>
              <option value="failed">Sem acordo / sem sucesso ({statusCounts.failed || 0})</option>
              <option value="all">Todas ({statusCounts.all || 0})</option>
            </select>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Negociações antigas ficam ocultas por padrão.</span>
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', gap: 8, padding: 12, background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.25)', borderRadius: 6, color: 'var(--accent-red)', fontSize: 12, marginBottom: 14 }}>
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
            {!loading && negotiations.length > 0 && filteredNegotiations.length === 0 && (
              <div style={{ padding: '28px 14px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', background: 'var(--bg-panel)', border: '1px dashed var(--border-subtle)', borderRadius: 8 }}>Nenhuma negociação corresponde ao filtro selecionado.</div>
            )}
            {filteredNegotiations.map(n => {
              const palette = negotiationColor(n);
              const counterparty = negotiationCounterparty(n);
              const localClosure = getNegotiationClosure(n.hash);
              const apiClosedAt = getNegotiationClosedAt(n);
              const isLocallyClosed = Boolean(apiClosedAt || localClosure);
              const initial = counterparty.name.replace(/^@/, '').charAt(0).toUpperCase() || '?';
              return (
                <button key={n.id || n.hash} type="button" onClick={() => setSelected(n)} style={{
                  position:'relative', overflow:'hidden', width:'100%', textAlign:'left', display:'flex', gap:13, alignItems:'center',
                  padding:'13px 15px 13px 17px', background:`linear-gradient(105deg, ${palette.soft}, var(--bg-card) 42%)`,
                  border:'1px solid var(--border-subtle)', borderLeft:`4px solid ${palette.accent}`,
                  borderRadius:9, cursor:'pointer', transition:'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
                }}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateX(2px)';e.currentTarget.style.borderColor=palette.accent;e.currentTarget.style.boxShadow=`0 5px 18px ${palette.soft}`;}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateX(0)';e.currentTarget.style.borderColor='var(--border-subtle)';e.currentTarget.style.boxShadow='none';}}
                >
                  <div style={{ width:38, height:38, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', background:palette.soft, border:`1px solid ${palette.accent}66`, color:palette.accent, fontFamily:'Michroma,sans-serif', fontSize:15, fontWeight:800 }}>
                    {initial}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, minWidth:0 }}>
                      <div style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:13, fontWeight:800, color:'var(--text-primary)' }}>{n.listing_title || 'Item sem título'}</div>
                      <span style={{ flexShrink:0, padding:'2px 7px', borderRadius:10, background:isLocallyClosed?(localClosure?.status==='success'?'rgba(52,211,153,0.12)':'rgba(251,113,133,0.1)'):'rgba(52,211,153,0.1)', border:`1px solid ${isLocallyClosed?(localClosure?.status==='success'?'rgba(52,211,153,0.3)':'rgba(251,113,133,0.25)'):'rgba(52,211,153,0.25)'}`, color:isLocallyClosed?(localClosure?.status==='success'?'var(--accent-green)':'var(--accent-red)'):'var(--accent-green)', fontSize:9, fontWeight:800, textTransform:'uppercase' }}>
                        {localClosure?.status==='success' ? 'Concluída' : localClosure?.status==='failed' ? 'Sem sucesso' : apiClosedAt ? 'Encerrada' : 'Ativa'}
                      </span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', fontSize:10, color:'var(--text-secondary)' }}>
                      <span style={{ color:palette.accent, fontWeight:800 }}>{counterparty.role}: @{counterparty.name.replace(/^@/, '')}</span>
                      <span style={{ color:'var(--text-muted)' }}>·</span>
                      <span>{negotiationAmount(n)}</span>
                      {n.deal_value !== null && n.deal_value !== undefined && <span style={{ color:'var(--accent-green)', fontWeight:700 }}>· valor acordado</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6, fontSize:9, color:'var(--text-muted)' }}>
                      <span>#{String(n.hash || n.id || '').slice(-8)}</span>
                      <span>·</span>
                      <span>{fmtDate(n.date_modified)}</span>
                    </div>
                  </div>
                  <div style={{ alignSelf:'stretch', display:'flex', alignItems:'center', color:palette.accent, fontSize:18, opacity:0.75 }}>›</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}