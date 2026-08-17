import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, ChevronDown, Clock3, Copy, Database,
  DollarSign, Filter, Gauge, History, Loader2, Pickaxe, RefreshCw, Search,
  ShieldCheck, SlidersHorizontal, Table2, TrendingUp, Trophy, Wrench, X, XCircle, ExternalLink, Power,
} from 'lucide-react';
import {
  QUALITY_TIERS,
  UEX_INSIGHTS_EVENT,
  UEX_INSIGHTS_KEYS,
  fetchMarketplaceAverages,
  fetchMarketplaceHistory,
  fetchMarketplaceTrends,
  fetchRefineryCapacities,
  fetchRefineryMethods,
  fetchRefineryYields,
  fetchUserRefineryJobs,
  formatUec,
  formatUexDate,
  loadUexInsight,
  qualityTierLabel,
  saveUexInsight,
  snapshotFreshness,
} from '../data/uexInsights';
import { loadUexItemsDB } from '../data/uexItemsDB';
import { loadUexSales } from '../data/uexSales';
import { DEFAULT_MARKET_ALERT_INTERVAL_MINUTES, DEFAULT_MARKET_ALERT_MAX_RESULTS, MAX_MARKET_ALERT_MAX_RESULTS, MIN_MARKET_ALERT_MAX_RESULTS, MARKET_ALERT_MANUAL_MATCH_MODES, MARKET_ALERT_SOURCES, MARKET_ALERT_SETTINGS_UPDATED_EVENT, MARKET_ALERTS_UPDATED_EVENT, loadMarketAlertSettings, loadMarketAlerts, loadMarketAlertEvents, loadMarketAlertFocus, manualMatchModeLabel, marketAlertDefaults, removeMarketAlert, removeMarketAlertEventsByGroup, upsertMarketAlert, checkMarketAlerts, saveMarketAlertSettings, dismissMarketAlertEvent, MARKET_ALERT_AVAILABILITIES, shouldCheckMarketAlertAutomatically } from '../data/uexMarketAlerts';

const TABS = [
  { id: 'market', label: 'Mercado por qualidade', icon: TrendingUp, color: '#fbbf24' },
  { id: 'analysis', label: 'Análise de lucro', icon: BarChart3, color: '#34d399' },
  { id: 'refineries', label: 'Refinarias', icon: Pickaxe, color: '#34d399' },
];

const panelStyle = {
  background: 'linear-gradient(145deg, rgba(17,25,39,0.95), rgba(8,14,25,0.96))',
  border: '1px solid rgba(148,163,184,0.18)',
  borderRadius: 14,
  padding: 16,
  boxShadow: '0 12px 30px rgba(0,0,0,0.16)',
};

const inputStyle = {
  width: '100%',
  minHeight: 38,
  padding: '8px 10px',
  background: 'rgba(2,6,23,0.62)',
  border: '1px solid rgba(148,163,184,0.22)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  outline: 'none',
};

const buttonStyle = (tone = 'blue', disabled = false) => {
  const colors = {
    blue: ['#38bdf8', 'rgba(56,189,248,0.12)'],
    green: ['#34d399', 'rgba(52,211,153,0.12)'],
    gold: ['#fbbf24', 'rgba(251,191,36,0.12)'],
    purple: ['#a78bfa', 'rgba(167,139,250,0.12)'],
    muted: ['#94a3b8', 'rgba(148,163,184,0.10)'],
  };
  const [color, background] = colors[tone] || colors.blue;
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight: 36, padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${color}55`, color, background,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
    fontWeight: 700, fontSize: 11, letterSpacing: '0.03em',
  };
};

function readSnapshot(key, fallback) {
  return loadUexInsight(key, fallback) || { data: fallback, syncedAt: null };
}

function Freshness({ snapshot, ttl = 24 }) {
  const state = snapshotFreshness(snapshot, ttl);
  const tones = {
    success: ['#34d399', 'rgba(52,211,153,0.1)', CheckCircle2],
    warning: ['#fbbf24', 'rgba(251,191,36,0.1)', Clock3],
    danger: ['#fb7185', 'rgba(251,113,133,0.1)', XCircle],
    muted: ['#94a3b8', 'rgba(148,163,184,0.1)', Database],
  };
  const [color, background, Icon] = tones[state.tone] || tones.muted;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color, background, border: `1px solid ${color}44`, borderRadius: 999, padding: '4px 8px', fontSize: 10, fontWeight: 700 }}>
      <Icon size={12} /> {state.label}
      <span style={{ opacity: 0.82 }}>· {state.ageLabel}</span>
      {snapshot?.syncedAt && <span style={{ opacity: 0.65 }}>· {formatUexDate(snapshot.syncedAt)}</span>}
    </span>
  );
}

function SectionHeader({ icon: Icon, color, title, description, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', color, background: `${color}18`, border: `1px solid ${color}33`, flexShrink: 0 }}><Icon size={17} /></div>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 16 }}>{title}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, maxWidth: 700 }}>{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '22px 8px', textAlign: 'center' }}>{text}</div>;
}

function ErrorBox({ error }) {
  if (!error) return null;
  return <div style={{ margin: '10px 0', padding: '10px 12px', color: '#fda4af', background: 'rgba(127,29,29,0.22)', border: '1px solid rgba(251,113,133,0.32)', borderRadius: 8, fontSize: 11 }}>{error}</div>;
}

function LoadingButton({ children, loading, onClick, tone = 'blue' }) {
  return <button type="button" onClick={onClick} disabled={loading} style={buttonStyle(tone, loading)}>{loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}{children}</button>;
}

function qualityRange(value) {
  const tier = Number(value);
  const ranges = [[0, 0], [1, 499], [500, 599], [600, 699], [700, 799], [800, 899], [900, 949], [950, 1000]];
  return ranges[Number.isFinite(tier) && ranges[tier] ? tier : 0];
}

function percentChange(current, reference) {
  const now = Number(current);
  const base = Number(reference);
  return Number.isFinite(now) && Number.isFinite(base) && base > 0 ? ((now - base) / base) * 100 : null;
}

function marketReliability(listings) {
  const count = Number(listings) || 0;
  if (count >= 10) return { label: 'Boa', color: '#34d399' };
  if (count >= 3) return { label: 'Moderada', color: '#fbbf24' };
  return { label: 'Baixa', color: '#fb7185' };
}

function marketReading(row, operation) {
  const change30 = percentChange(row.price_avg, row.price_avg_month);
  if (operation === 'sell') {
    if (change30 !== null && change30 <= -10) return { label: 'Abaixo da média 30d', color: '#34d399' };
    if (change30 !== null && change30 >= 10) return { label: 'Acima da média 30d', color: '#fb7185' };
  }
  if (change30 !== null && Math.abs(change30) < 10) return { label: 'Estável', color: '#fbbf24' };
  return { label: 'Poucos dados', color: '#94a3b8' };
}

function marketCountdownLabel(nextCheckAt, now = Date.now()) {
  if (!nextCheckAt) return 'aguardando configuração';
  const remaining = Math.max(0, Math.ceil((Number(nextCheckAt) - now) / 1000));
  if (remaining <= 0) return 'verificando agora';
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}min`;
  return `${minutes}min ${String(seconds).padStart(2, '0')}s`;
}

function MarketTab() {
  const [itemName, setItemName] = useState('');
  const [operation, setOperation] = useState('sell');
  const [qualityTier, setQualityTier] = useState('');
  const [marketSort, setMarketSort] = useState('priceLow');
  const [minListings, setMinListings] = useState('0');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [rows, setRows] = useState(() => readSnapshot(UEX_INSIGHTS_KEYS.marketplaceAverages, []).data || []);
  const [history, setHistory] = useState(() => readSnapshot(UEX_INSIGHTS_KEYS.marketplaceHistory, []).data || []);
  const [snapshot, setSnapshot] = useState(() => readSnapshot(UEX_INSIGHTS_KEYS.marketplaceAverages, []));
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');

  async function searchAverages() {
    setLoading(true); setError('');
    try {
      const data = await fetchMarketplaceAverages({ itemName, operation, qualityTier });
      const next = saveUexInsight(UEX_INSIGHTS_KEYS.marketplaceAverages, data, { endpoint: 'marketplace_prices_averages', ttl: '1h' });
      setRows(data); setSnapshot(next);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function searchHistory() {
    setHistoryLoading(true); setError('');
    try {
      const data = await fetchMarketplaceHistory({ itemName, operation, qualityTier, dateStart, dateEnd });
      saveUexInsight(UEX_INSIGHTS_KEYS.marketplaceHistory, data, { endpoint: 'marketplace_prices_history', ttl: '1h' });
      setHistory(data);
    } catch (err) { setError(err.message); }
    setHistoryLoading(false);
  }

  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach(row => {
      const key = `${row.item_name || row.itemName || 'Item'}-${row.quality_tier}-${row.operation}-${row.currency}`;
      if (!map.has(key)) map.set(key, row);
    });
    const rowsWithInsight = Array.from(map.values()).map(row => {
      const reliability = marketReliability(row.listings_count);
      const reading = marketReading(row, operation);
      const [qualityMin, qualityMax] = qualityRange(row.quality_tier);
      return {
        ...row,
        qualityMin,
        qualityMax,
        change7: percentChange(row.price_avg, row.price_avg_week),
        change30: percentChange(row.price_avg, row.price_avg_month),
        reliability,
        reading,
      };
    }).filter(row => Number(row.listings_count || 0) >= Number(minListings || 0));
    const order = {
      priceLow: (a, b) => Number(a.price_avg || Infinity) - Number(b.price_avg || Infinity),
      priceHigh: (a, b) => Number(b.price_avg || 0) - Number(a.price_avg || 0),
      qualityHigh: (a, b) => b.qualityMax - a.qualityMax,
      qualityLow: (a, b) => a.qualityMin - b.qualityMin,
      listings: (a, b) => Number(b.listings_count || 0) - Number(a.listings_count || 0),
      changeLow: (a, b) => (a.change30 ?? Infinity) - (b.change30 ?? Infinity),
      changeHigh: (a, b) => (b.change30 ?? -Infinity) - (a.change30 ?? -Infinity),
    };
    return rowsWithInsight.sort(order[marketSort] || order.priceLow);
  }, [marketSort, minListings, operation, rows]);

  return (
    <div style={panelStyle}>
      <SectionHeader icon={TrendingUp} color="#fbbf24" title="Mercado por qualidade" description="Compare faixas de qualidade, preço atual, histórico e confiabilidade da amostra para escolher a melhor relação entre qualidade e custo. Use Venda para encontrar anúncios de jogadores quando você quer comprar." action={<Freshness snapshot={snapshot} ttl={1} />} />
      <div className="uex-insights-filter-grid uex-market-quality-filters">
        <label>Item ou nome UEX<input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Ex.: Tailwind Flight Helmet" style={inputStyle} /></label>
        <label>Operação<select value={operation} onChange={e => setOperation(e.target.value)} style={inputStyle}><option value="sell">Venda · quero comprar</option><option value="buy">Compra · quero vender</option></select></label>
        <label>Qualidade<select value={qualityTier} onChange={e => setQualityTier(e.target.value)} style={inputStyle}>{QUALITY_TIERS.map(tier => <option key={tier.value} value={tier.value}>{tier.label}</option>)}</select></label>
        <label>Anúncios mínimos<input type="number" min="0" step="1" value={minListings} onChange={e => setMinListings(e.target.value)} style={inputStyle} placeholder="Ex.: 3" /></label>
        <label>Ordenar por<select value={marketSort} onChange={e => setMarketSort(e.target.value)} style={inputStyle}><option value="priceLow">Menor preço atual</option><option value="priceHigh">Maior preço atual</option><option value="qualityHigh">Maior qualidade</option><option value="qualityLow">Menor qualidade</option><option value="listings">Mais anúncios</option><option value="changeLow">Mais abaixo da média 30d</option><option value="changeHigh">Mais acima da média 30d</option></select></label>
        <div style={{ display: 'flex', alignItems: 'end' }}><LoadingButton loading={loading} onClick={searchAverages} tone="gold">Consultar médias</LoadingButton></div>
      </div>
      <div className="uex-market-quality-explanation"><strong>Como interpretar:</strong> preço atual é o valor médio dos anúncios ativos. “Confiabilidade” depende da quantidade de anúncios; uma linha com 1 anúncio não deve ser tratada como preço consolidado. A leitura abaixo da média de 30 dias é um sinal para investigar, não uma garantia de oportunidade.</div>
      <ErrorBox error={error} />
      {grouped.length > 0 ? (
        <div className="uex-insights-table-wrap"><table className="uex-insights-table uex-market-quality-table"><thead><tr><th>Item</th><th>Faixa de qualidade</th><th>Operação</th><th>Preço atual</th><th>Média 7d</th><th>Média 30d</th><th>Variação 30d</th><th>Anúncios</th><th>Confiabilidade</th><th>Leitura</th></tr></thead><tbody>{grouped.slice(0, 120).map((row, index) => <tr key={`${row.id || row.item_uuid || index}`}><td><strong>{row.item_name || '—'}</strong><small>{row.currency || 'UEC'} · unidade {row.unit || 'un'}</small></td><td><strong style={{ color: '#fbbf24' }}>{qualityTierLabel(row.quality_tier)}</strong><small>aprox. Q{row.qualityMin}–{row.qualityMax}</small></td><td>{row.operation === 'sell' ? 'Venda · compra' : 'Compra · venda'}</td><td><strong>{formatUec(row.price_avg)}</strong></td><td>{formatUec(row.price_avg_week)}<small>{row.change7 === null ? '—' : `${row.change7 > 0 ? '+' : ''}${row.change7.toFixed(1)}% vs atual`}</small></td><td>{formatUec(row.price_avg_month)}</td><td style={{ color: row.change30 !== null && row.change30 <= -10 ? '#34d399' : row.change30 !== null && row.change30 >= 10 ? '#fb7185' : 'var(--text-secondary)' }}>{row.change30 === null ? '—' : `${row.change30 > 0 ? '+' : ''}${row.change30.toFixed(1)}%`}</td><td>{row.listings_count ?? '—'}</td><td><strong style={{ color: row.reliability.color }}>{row.reliability.label}</strong></td><td><strong style={{ color: row.reading.color }}>{row.reading.label}</strong></td></tr>)}</tbody></table></div>
      ) : <EmptyState text="Informe um item ou nome e consulte as médias por qualidade." />}
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(148,163,184,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}><strong style={{ fontSize: 13, color: 'var(--text-primary)' }}><History size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Histórico de preço</strong><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Até 1.000 snapshots; use o nome do item para manter a consulta leve.</span></div>
        <div className="uex-insights-filter-grid history-grid">
          <label>Data inicial<input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} style={inputStyle} /></label>
          <label>Data final<input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} style={inputStyle} /></label>
          <div style={{ display: 'flex', alignItems: 'end' }}><LoadingButton loading={historyLoading} onClick={searchHistory} tone="blue">Consultar histórico</LoadingButton></div>
        </div>
        {history.length > 0 ? <div className="uex-insights-table-wrap"><table className="uex-insights-table"><thead><tr><th>Data</th><th>Item</th><th>Qualidade</th><th>Preço</th><th>Terminal</th><th>Estado</th></tr></thead><tbody>{history.slice(0, 100).map((row, index) => <tr key={`${row.id || row.id_listing || index}`}><td>{formatUexDate(row.date_added)}</td><td>{row.item_name || '—'}</td><td>{row.quality ?? qualityTierLabel(row.quality_tier)}</td><td>{formatUec(row.price)}</td><td>{row.terminal_name || '—'}</td><td>{row.date_removed ? 'Encerrado' : 'Ativo'}</td></tr>)}</tbody></table></div> : <EmptyState text="O histórico aparecerá depois de uma consulta filtrada por item." />}
      </div>
    </div>
  );
}

function normalizeMarketAlertGroupName(value) {
  return String(value || 'Item UEX').trim() || 'Item UEX';
}

function marketAlertGroupId(event = {}) {
  return String(event.groupKey || `name:${normalizeMarketAlertGroupName(event.groupName || event.alertName || event.itemName).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
}

function formatMarketAlertAge(event) {
  const raw = event?.listing?.date_added || event?.listing?.dateAdded || event?.dateAdded;
  if (!raw) return 'Data não informada';
  const numeric = Number(raw);
  const date = Number.isFinite(numeric) && numeric > 0
    ? new Date(numeric < 100000000000 ? numeric * 1000 : numeric)
    : new Date(String(raw));
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleString('pt-BR');
}

function marketAlertListingDetails(event) {
  const listing = event?.listing || {};
  return [
    ['Anúncio', event.listingId || listing.id || listing.id_listing || 'ID não informado'],
    ['Vendedor', event.seller || listing.user_username || listing.user_name || 'Não informado'],
    ['Local', event.location || listing.location || listing.terminal_name || listing.station_name || 'Não informado'],
    ['Origem', event.source || listing.source || 'Não informada'],
    ['Qualidade', event.quality !== null && event.quality !== undefined ? `Q${event.quality}` : 'Não informada'],
    ['Preço', `${Number(event.price || 0).toLocaleString('pt-BR')} ${event.currency || 'UEC'}`],
    ['Estoque', event.stock !== null && event.stock !== undefined ? `${event.stock} unidade(s)` : 'Não informado'],
    ['Atividade do vendedor', event.sellerActivityDays !== null && event.sellerActivityDays !== undefined ? `${Number(event.sellerActivityDays).toFixed(1)} dia(s)` : 'Não informada'],
    ['Oportunidade', event.opportunityScore !== null && event.opportunityScore !== undefined ? `${Number(event.opportunityScore).toFixed(1)}% abaixo da referência` : 'Sem referência'],
    ['Publicado', formatMarketAlertAge(event)],
    ['Correspondência', event.matchReason || (event.matchMode === 'broad' ? 'Busca ampla' : event.matchMode === 'title' ? 'Nome/título do anúncio' : 'Catálogo UEX por ID')],
  ];
}

function MarketAlertDetailsModal({ group, onClose, onDismiss }) {
  const [copiedKey, setCopiedKey] = useState('');
  if (!group) return null;

  async function copyLink(event) {
    const link = event.listingUrl || 'https://uexcorp.space/marketplace/';
    try {
      await navigator.clipboard.writeText(link);
      setCopiedKey(event.key);
      window.setTimeout(() => setCopiedKey(current => current === event.key ? '' : current), 1800);
    } catch {
      setCopiedKey('error');
    }
  }

  return <div className="uex-market-alert-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Anúncios encontrados de ${group.name}`} onMouseDown={onClose}>
    <div className="uex-market-alert-modal" onMouseDown={event => event.stopPropagation()}>
      <div className="uex-market-alert-modal-header">
        <div><span className="uex-market-alert-modal-kicker">GRUPO DE ANÚNCIOS</span><h3>{group.name}</h3><p>{group.events.length} anúncio{group.events.length === 1 ? '' : 's'} encontrado{group.events.length === 1 ? '' : 's'} · sem repetição do mesmo anúncio</p></div>
        <button type="button" className="uex-market-alert-modal-close" onClick={onClose} title="Fechar detalhes"><X size={17} /></button>
      </div>
      <div className="uex-market-alert-modal-list">
        {group.events.map((event, index) => <article className="uex-market-alert-detail-card" key={event.key}>
          <div className="uex-market-alert-detail-top"><div><span className="uex-market-alert-detail-index">#{index + 1}</span><strong>{event.itemName || group.name}</strong><small>{event.seller || 'Vendedor não informado'} · {event.location || 'Local não informado'} · {event.matchReason || (event.matchMode === 'broad' ? 'Descrição do anúncio' : event.matchMode === 'title' ? 'Nome/título do anúncio' : 'Catálogo UEX')} · #{event.resultRank || '—'}</small></div><b>{Number(event.price || 0).toLocaleString('pt-BR')} {event.currency || 'UEC'}</b></div>
          <div className="uex-market-alert-detail-grid">{marketAlertListingDetails(event).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
          <div className="uex-market-alert-detail-actions"><a href={event.listingUrl || 'https://uexcorp.space/marketplace/'} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Abrir anúncio na UEX</a><button type="button" onClick={() => copyLink(event)}><Copy size={13} /> {copiedKey === event.key ? 'Link copiado' : copiedKey === 'error' ? 'Não foi possível copiar' : 'Copiar link'}</button><button type="button" className="danger" onClick={() => onDismiss(event.key)}><X size={13} /> Remover anúncio</button></div>
          <details className="uex-market-alert-raw"><summary><ChevronDown size={13} /> Ver todos os dados recebidos</summary><pre>{JSON.stringify(event.listing || event, null, 2)}</pre></details>
        </article>)}
      </div>
    </div>
  </div>;
}

export function MarketAlertPanel() {
  const [alerts, setAlerts] = useState(() => loadMarketAlerts());
  const [events, setEvents] = useState(() => loadMarketAlertEvents());
  const [focusedEventKey, setFocusedEventKey] = useState(() => loadMarketAlertFocus()?.eventKey || '');
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
  const [settings, setSettings] = useState(() => loadMarketAlertSettings());
  const [intervalInput, setIntervalInput] = useState(() => String(loadMarketAlertSettings().intervalMinutes));
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [catalog] = useState(() => loadUexItemsDB().items || []);
  const [itemQuery, setItemQuery] = useState('');
  const [entryMode, setEntryMode] = useState('catalog');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState('');
  const [form, setForm] = useState(() => marketAlertDefaults({ currency: 'UEC', qualityAny: true, priceMode: 'lowest', manualMatchMode: 'title' }));
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const refresh = () => { setAlerts(loadMarketAlerts()); setEvents(loadMarketAlertEvents()); setFocusedEventKey(loadMarketAlertFocus()?.eventKey || ''); };
    const refreshSettings = () => { const next = loadMarketAlertSettings(); setSettings(next); setIntervalInput(String(next.intervalMinutes)); };
    window.addEventListener(MARKET_ALERTS_UPDATED_EVENT, refresh);
    window.addEventListener('sc_uex_market_alerts_checked', refresh);
    window.addEventListener(MARKET_ALERT_SETTINGS_UPDATED_EVENT, refreshSettings);
    return () => {
      window.removeEventListener(MARKET_ALERTS_UPDATED_EVENT, refresh);
      window.removeEventListener('sc_uex_market_alerts_checked', refresh);
      window.removeEventListener(MARKET_ALERT_SETTINGS_UPDATED_EVENT, refreshSettings);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!focusedEventKey) return;
    const focused = events.find(event => event.key === focusedEventKey);
    if (focused) setSelectedGroupKey(marketAlertGroupId(focused));
  }, [events, focusedEventKey]);

  const eventGroups = useMemo(() => {
    const groups = new Map();
    events.forEach(event => {
      const key = marketAlertGroupId(event);
      const current = groups.get(key) || { key, name: normalizeMarketAlertGroupName(event.groupName || event.alertName || event.itemName), events: [] };
      current.events.push(event);
      groups.set(key, current);
    });
    return Array.from(groups.values());
  }, [events]);

  const selectedGroup = eventGroups.find(group => group.key === selectedGroupKey) || null;

  const suggestions = useMemo(() => {
    const text = String(itemQuery || '').toLowerCase().trim();
    if (text.length < 2) return [];
    return catalog.filter(item => String(item.name || '').toLowerCase().includes(text)).slice(0, 8);
  }, [catalog, itemQuery]);

  function chooseItem(item) {
    setEntryMode('catalog');
    setItemQuery(item.name || '');
    setSuggestionsOpen(false);
    setForm(previous => ({ ...previous, itemMode: 'catalog', itemId: String(item.id || item.id_item || ''), itemName: item.name || '' }));
  }

  function changeEntryMode(mode) {
    setEntryMode(mode);
    setItemQuery('');
    setSuggestionsOpen(false);
    setForm(previous => ({ ...previous, itemMode: mode, itemId: '', itemName: '' }));
  }

  function beginEditAlert(alert) {
    const safe = { ...marketAlertDefaults(alert), ...alert, manualMatchMode: alert.manualMatchMode || 'title' };
    setEditingAlertId(String(alert.id || ''));
    setEntryMode(safe.itemMode === 'manual' ? 'manual' : 'catalog');
    setItemQuery(safe.itemName || '');
    setForm(safe);
    setSuggestionsOpen(false);
    setError('');
    window.setTimeout(() => document.querySelector('.uex-market-alert-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  }

  function cancelEditAlert() {
    setEditingAlertId('');
    setEntryMode('catalog');
    setItemQuery('');
    setSuggestionsOpen(false);
    setForm(marketAlertDefaults({ currency: 'UEC', itemMode: 'catalog', qualityAny: true, priceMode: 'lowest', manualMatchMode: 'title' }));
    setError('');
  }

  function updateForm(name, value) {
    setForm(previous => ({ ...previous, [name]: value }));
  }

  function saveInterval() {
    const safeMinutes = Math.max(1, Math.min(1440, Math.round(Number(intervalInput) || DEFAULT_MARKET_ALERT_INTERVAL_MINUTES)));
    const next = saveMarketAlertSettings({ intervalMinutes: safeMinutes, automaticEnabled: settings.automaticEnabled, lastCheckAt: settings.lastCheckAt, nextCheckAt: settings.automaticEnabled ? Date.now() + safeMinutes * 60 * 1000 : null });
    setSettings(next);
    setIntervalInput(String(next.intervalMinutes));
  }

  function toggleAutomatic() {
    const enabled = !settings.automaticEnabled;
    const next = saveMarketAlertSettings({ automaticEnabled: enabled, intervalMinutes: settings.intervalMinutes, lastCheckAt: settings.lastCheckAt, nextCheckAt: enabled ? Date.now() + settings.intervalMinutes * 60 * 1000 : null });
    setSettings(next);
  }

  function addAlert(event) {
    event.preventDefault();
    setError('');
    if (entryMode === 'catalog' && !form.itemId) { setError('Selecione um item do catálogo UEX ou altere o modo para Item manual.'); return; }
    if (entryMode === 'manual' && itemQuery.trim().length < 2) { setError('Informe pelo menos 2 caracteres para o item manual.'); return; }
    if (!form.qualityAny && Number(form.qualityMin) > Number(form.qualityMax)) { setError('A qualidade mínima não pode ser maior que a máxima.'); return; }
    if (form.priceMode === 'limit' && Number(form.maxPrice) <= 0) { setError('Informe um preço máximo maior que zero ou escolha Menor preço disponível.'); return; }
    if (form.priceMode === 'range' && (Number(form.minPrice) <= 0 || Number(form.maxPrice) <= 0 || Number(form.minPrice) > Number(form.maxPrice))) { setError('Na faixa de preço, informe valores maiores que zero e o mínimo não pode superar o máximo.'); return; }
    if (Number(form.minListingStock || 0) > 0 && Number(form.maxListingStock || 0) > 0 && Number(form.minListingStock) > Number(form.maxListingStock)) { setError('O estoque mínimo não pode superar o estoque máximo.'); return; }
    if (form.resultSort === 'value' && Number(form.referencePrice || 0) <= 0) { setError('Informe um preço de referência para ordenar por oportunidade.'); return; }
    const maxResults = Math.max(MIN_MARKET_ALERT_MAX_RESULTS, Math.min(MAX_MARKET_ALERT_MAX_RESULTS, Math.round(Number(form.maxResults) || DEFAULT_MARKET_ALERT_MAX_RESULTS)));
    const next = upsertMarketAlert({ ...form, id: editingAlertId || form.id, itemMode: entryMode, manualMatchMode: entryMode === 'manual' ? (form.manualMatchMode || 'title') : 'title', itemName: itemQuery.trim(), enabled: true, qualityMin: Number(form.qualityMin), qualityMax: Number(form.qualityMax), minPrice: Number(form.minPrice), maxPrice: Number(form.maxPrice), maxListingAgeDays: Number(form.maxListingAgeDays), maxResults });
    setAlerts(next);
    setEditingAlertId('');
    setEntryMode('catalog');
    setForm(marketAlertDefaults({ currency: 'UEC', itemMode: 'catalog', qualityAny: true, priceMode: 'lowest', manualMatchMode: 'title' }));
    setItemQuery('');
    setSuggestionsOpen(false);
  }

  function dismissEvent(eventKey) {
    dismissMarketAlertEvent(eventKey);
    setEvents(loadMarketAlertEvents());
  }

  function dismissGroup(groupKey) {
    const next = removeMarketAlertEventsByGroup(groupKey);
    setEvents(next);
    setSelectedGroupKey('');
    setFocusedEventKey('');
  }

  async function checkNow() {
    setChecking(true); setError('');
    try {
      await checkMarketAlerts({ silent: false });
      setAlerts(loadMarketAlerts());
      setEvents(loadMarketAlertEvents());
      setSettings(loadMarketAlertSettings());
    } catch (err) { setError(err.message || 'Não foi possível verificar os alertas.'); }
    setChecking(false);
  }

  function toggleAlertAutomatic(alert) {
    const next = upsertMarketAlert({ ...alert, automaticEnabled: !shouldCheckMarketAlertAutomatically(alert) });
    setAlerts(next);
  }

  const activeAutomaticAlerts = alerts.filter(alert => alert.enabled && shouldCheckMarketAlertAutomatically(alert)).length;
  const activeManualOnlyAlerts = alerts.filter(alert => alert.enabled && !shouldCheckMarketAlertAutomatically(alert)).length;

  return <div className="uex-market-alert-panel">
    <div className="uex-market-alert-header"><div><strong>Alertas de compra</strong><span>Monitora anúncios ativos de venda em UEC e avisa quando um item corresponde à qualidade e ao preço desejados.</span></div><button type="button" onClick={checkNow} disabled={checking} style={buttonStyle('gold', checking)}><RefreshCw size={14} className={checking ? 'spin' : ''} />{checking ? 'Verificando...' : 'Verificar agora'}</button></div>
    <div className="uex-market-alert-schedule"><label>Intervalo da análise (minutos)<input type="number" min="1" max="1440" step="1" value={intervalInput} onChange={event => setIntervalInput(event.target.value)} /></label><button type="button" onClick={saveInterval}>Salvar intervalo</button><button type="button" className={`uex-market-alert-auto-toggle ${settings.automaticEnabled ? 'enabled' : 'disabled'}`} onClick={toggleAutomatic}><span className="uex-market-alert-auto-dot" />{settings.automaticEnabled ? 'Análise automática ligada' : 'Análise automática desligada'}</button><div className="uex-market-alert-countdown"><Clock3 size={14} /><span>{settings.automaticEnabled ? `Próxima análise automática · ${activeAutomaticAlerts} alerta${activeAutomaticAlerts === 1 ? '' : 's'}` : 'Análise automática pausada'}</span><strong>{settings.automaticEnabled ? marketCountdownLabel(settings.nextCheckAt, countdownNow) : 'desligada'}</strong></div></div>
    <div className="uex-market-alert-automation-summary"><Power size={13} /> <span><strong>{activeAutomaticAlerts}</strong> alerta{activeAutomaticAlerts === 1 ? '' : 's'} incluído{activeAutomaticAlerts === 1 ? '' : 's'} na pesquisa automática</span>{activeManualOnlyAlerts > 0 && <span className="manual-only"><strong>{activeManualOnlyAlerts}</strong> mantido{activeManualOnlyAlerts === 1 ? '' : 's'} fora da automação</span>}</div>
    <div className="uex-market-alert-note"><AlertTriangle size={14} /> A moeda é fixa em <strong>UEC</strong>. O botão geral controla o monitor; em cada card você pode deixar um alerta fora da pesquisa periódica. Alertas fora da automação permanecem salvos e continuam disponíveis no botão <strong>Verificar agora</strong>.</div>
    <form onSubmit={addAlert} className="uex-market-alert-form">
      <div className="uex-market-alert-mode"><span>Modo de seleção do item</span><label><input type="radio" name="market-alert-item-mode" checked={entryMode === 'catalog'} onChange={() => changeEntryMode('catalog')} /> Catálogo UEX</label><label><input type="radio" name="market-alert-item-mode" checked={entryMode === 'manual'} onChange={() => changeEntryMode('manual')} /> Item manual</label></div>
      <label className="uex-market-alert-item-field">{entryMode === 'catalog' ? 'Item para comprar' : 'Nome manual do item'}<input value={itemQuery} onFocus={() => { if (entryMode === 'catalog' && !form.itemId && itemQuery.trim().length >= 2) setSuggestionsOpen(true); }} onChange={event => { setItemQuery(event.target.value); setSuggestionsOpen(entryMode === 'catalog'); setForm(previous => ({ ...previous, itemMode: entryMode, itemId: '', itemName: event.target.value })); }} placeholder={entryMode === 'catalog' ? 'Pesquise e selecione um item do catálogo' : 'Ex.: Iron ou Sadaryx'} style={inputStyle} autoComplete="off" />{entryMode === 'catalog' && suggestionsOpen && suggestions.length > 0 && <div className="uex-market-alert-suggestions">{suggestions.map(item => <button type="button" key={item.id || item.name} onClick={() => chooseItem(item)}><strong>{item.name}</strong><small>ID {item.id || item.id_item}</small></button>)}</div>}{entryMode === 'catalog' && form.itemId && <small className="uex-market-alert-selected">Selecionado: {form.itemName} · ID {form.itemId}</small>}{entryMode === 'manual' && itemQuery.trim().length >= 2 && <small className="uex-market-alert-selected">Busca manual ativa: {itemQuery.trim()}</small>}</label>
      {entryMode === 'manual' && <label>Precisão da busca<select value={form.manualMatchMode || 'title'} onChange={event => updateForm('manualMatchMode', event.target.value)} style={inputStyle}>{MARKET_ALERT_MANUAL_MATCH_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select><small className="uex-market-alert-field-help">{MARKET_ALERT_MANUAL_MATCH_MODES.find(mode => mode.value === (form.manualMatchMode || 'title'))?.description}</small></label>}
      <label>Origem<select value={form.source} onChange={event => updateForm('source', event.target.value)} style={inputStyle}>{MARKET_ALERT_SOURCES.map(source => <option key={source.value} value={source.value}>{source.label}</option>)}</select></label>
      <label>Disponibilidade<select value={form.availability || ''} onChange={event => updateForm('availability', event.target.value)} style={inputStyle}>{MARKET_ALERT_AVAILABILITIES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>Idade máxima do anúncio (dias)<input type="number" min="0" max="3650" step="1" value={form.maxListingAgeDays} onChange={event => updateForm('maxListingAgeDays', event.target.value)} placeholder="0 = qualquer idade" style={inputStyle} /><small className="uex-market-alert-field-help">Filtra há quanto tempo o anúncio foi criado.</small></label>
      <label>Última atividade do vendedor (dias)<input type="number" min="0" max="3650" step="1" value={form.maxSellerActivityDays || 0} onChange={event => updateForm('maxSellerActivityDays', event.target.value)} placeholder="0 = qualquer atividade" style={inputStyle} /><small className="uex-market-alert-field-help">0 = qualquer vendedor; exige data de atividade quando preenchido.</small></label>
      <label>Estoque mínimo<input type="number" min="0" step="1" value={form.minListingStock || 0} onChange={event => updateForm('minListingStock', event.target.value)} placeholder="0 = qualquer estoque" style={inputStyle} /></label>
      <label>Estoque máximo<input type="number" min="0" step="1" value={form.maxListingStock || 0} onChange={event => updateForm('maxListingStock', event.target.value)} placeholder="0 = sem máximo" style={inputStyle} /></label>
      <label>Limite de anúncios<input type="number" min={MIN_MARKET_ALERT_MAX_RESULTS} max={MAX_MARKET_ALERT_MAX_RESULTS} step="1" value={form.maxResults ?? DEFAULT_MARKET_ALERT_MAX_RESULTS} onChange={event => updateForm('maxResults', event.target.value)} placeholder={`1–${MAX_MARKET_ALERT_MAX_RESULTS}`} style={inputStyle} /><small className="uex-market-alert-field-help">Traz os N melhores anúncios elegíveis, em vez de parar no primeiro preço.</small></label>
      <label className="uex-market-alert-quality-toggle"><span>Qualidade</span><span><input type="checkbox" checked={form.qualityAny} onChange={event => updateForm('qualityAny', event.target.checked)} /> qualquer</span></label>
      <label className="uex-market-alert-quality-toggle"><span>Qualidade identificada</span><span><input type="checkbox" checked={form.qualityKnownOnly || false} onChange={event => updateForm('qualityKnownOnly', event.target.checked)} /> exigir qualidade conhecida</span></label>
      {!form.qualityAny && <><label>Qualidade mínima<input type="number" min="0" max="1000" step="1" value={form.qualityMin} onChange={event => updateForm('qualityMin', event.target.value)} style={inputStyle} /></label><label>Qualidade máxima<input type="number" min="0" max="1000" step="1" value={form.qualityMax} onChange={event => updateForm('qualityMax', event.target.value)} style={inputStyle} /></label></>}
      <label>Critério de preço<select value={form.priceMode} onChange={event => updateForm('priceMode', event.target.value)} style={inputStyle}><option value="lowest">Menor preço disponível</option><option value="limit">Até um preço máximo</option><option value="range">Faixa de preço</option></select></label>
      <label>Ordenar resultados<select value={form.resultSort || 'price'} onChange={event => updateForm('resultSort', event.target.value)} style={inputStyle}><option value="price">Menor preço primeiro</option><option value="quality">Maior qualidade primeiro</option><option value="value">Maior oportunidade vs referência</option><option value="newest">Anúncio mais recente</option></select></label>
      {form.resultSort === 'value' && <label>Preço de referência<input type="number" min="1" step="1" value={form.referencePrice || ''} onChange={event => updateForm('referencePrice', event.target.value)} placeholder="Ex.: média UEX ou seu limite" style={inputStyle} /><small className="uex-market-alert-field-help">O ranking calcula quanto cada anúncio está abaixo desta referência.</small></label>}
      {form.priceMode === 'limit' && <label>Preço máximo<input type="number" min="1" step="1" value={form.maxPrice} onChange={event => updateForm('maxPrice', event.target.value)} placeholder="Ex.: 150000" style={inputStyle} /></label>}
      {form.priceMode === 'range' && <><label>Preço mínimo<input type="number" min="1" step="1" value={form.minPrice} onChange={event => updateForm('minPrice', event.target.value)} placeholder="Ex.: 50000" style={inputStyle} /></label><label>Preço máximo<input type="number" min="1" step="1" value={form.maxPrice} onChange={event => updateForm('maxPrice', event.target.value)} placeholder="Ex.: 150000" style={inputStyle} /></label></>}
      <div className="uex-market-alert-form-action"><button type="submit" style={buttonStyle('green')}>{editingAlertId ? 'Salvar alterações' : 'Adicionar alerta'}</button>{editingAlertId && <button type="button" style={buttonStyle('muted')} onClick={cancelEditAlert}>Cancelar edição</button>}</div>
    </form>
    {error && <ErrorBox error={error} />}
    <div className="uex-market-alert-list">{alerts.length === 0 ? <EmptyState text="Nenhum alerta configurado. Selecione um item acima para começar." /> : alerts.map(alert => <div className={`uex-market-alert-card ${alert.enabled ? '' : 'disabled'}`} key={alert.id}><div><strong>{alert.itemName || 'Item UEX'}</strong><small>{alert.itemMode === 'manual' ? 'item manual' : 'catálogo UEX'}{alert.itemMode === 'manual' ? ` · ${manualMatchModeLabel(alert.manualMatchMode)}` : ''} · {alert.source ? MARKET_ALERT_SOURCES.find(source => source.value === alert.source)?.label : 'Qualquer origem'} · {alert.qualityAny ? 'qualquer qualidade' : `Q${alert.qualityMin}–Q${alert.qualityMax}`} · {Number(alert.maxListingAgeDays || 0) > 0 ? `anúncio até ${alert.maxListingAgeDays}d` : 'qualquer idade'} · {Number(alert.maxSellerActivityDays || 0) > 0 ? `vendedor ativo até ${alert.maxSellerActivityDays}d` : 'qualquer atividade'} · {alert.availability ? (MARKET_ALERT_AVAILABILITIES.find(option => option.value === alert.availability)?.label || alert.availability) : 'qualquer disponibilidade'} · {Number(alert.minListingStock || 0) > 0 ? `estoque ≥ ${alert.minListingStock}` : ''}{Number(alert.maxListingStock || 0) > 0 ? ` estoque ≤ ${alert.maxListingStock}` : ''} · {alert.qualityKnownOnly ? 'qualidade identificada' : 'qualidade não obrigatória'} · {alert.priceMode === 'lowest' ? 'menor preço' : alert.priceMode === 'range' ? `faixa ${Number(alert.minPrice || 0).toLocaleString('pt-BR')}–${Number(alert.maxPrice || 0).toLocaleString('pt-BR')} UEC` : `até ${Number(alert.maxPrice || 0).toLocaleString('pt-BR')} UEC`} · ordem: {alert.resultSort === 'quality' ? 'qualidade' : alert.resultSort === 'value' ? 'oportunidade' : alert.resultSort === 'newest' ? 'mais recente' : 'preço'}
</small><small>{alert.lastCheckedAt ? `Última verificação: ${formatUexDate(alert.lastCheckedAt)}` : 'Ainda não verificado'}{alert.lastMatchCount ? ` · ${alert.lastMatchCount} correspondência(s)` : ''} · limite: {alert.maxResults || DEFAULT_MARKET_ALERT_MAX_RESULTS} · automação: {shouldCheckMarketAlertAutomatically(alert) ? 'incluída' : 'fora'}{alert.lastError ? ` · erro: ${alert.lastError}` : ''}</small></div><div className="uex-market-alert-card-actions">
<button type="button" title="Editar alerta" onClick={() => beginEditAlert(alert)}>Editar</button><button type="button" title={alert.enabled ? 'Pausar alerta' : 'Ativar alerta'} onClick={() => { const next = upsertMarketAlert({ ...alert, enabled: !alert.enabled }); setAlerts(next); }}>{alert.enabled ? 'Ativo' : 'Pausado'}</button><button type="button" title={shouldCheckMarketAlertAutomatically(alert) ? 'Deixar este alerta fora da pesquisa automática' : 'Incluir este alerta na pesquisa automática'} onClick={() => toggleAlertAutomatic(alert)} style={{display:'inline-flex',alignItems:'center',gap:4,color:shouldCheckMarketAlertAutomatically(alert) ? '#34d399' : '#94a3b8'}}><Power size={13} />{shouldCheckMarketAlertAutomatically(alert) ? 'Auto ligada' : 'Auto desligada'}</button><button type="button" title="Excluir alerta" onClick={() => { if (String(editingAlertId) === String(alert.id)) cancelEditAlert(); setAlerts(removeMarketAlert(alert.id)); }}><XCircle size={14} /></button>
</div></div>)}</div>
    {eventGroups.length > 0 && <div className="uex-market-alert-events"><div className="uex-market-alert-events-heading"><div><strong>Últimos anúncios encontrados</strong><span>{events.length} anúncio{events.length === 1 ? '' : 's'} novos organizados em {eventGroups.length} grupo{eventGroups.length === 1 ? '' : 's'}</span></div><small>O mesmo anúncio aparece uma única vez</small></div><div className="uex-market-alert-groups">{eventGroups.map(group => { const cheapest = group.events.reduce((lowest, event) => !lowest || Number(event.price || 0) < Number(lowest.price || 0) ? event : lowest, null); const focused = group.events.some(event => event.key === focusedEventKey); return <div className="uex-market-alert-group-shell" key={group.key}><button type="button" className={`uex-market-alert-group ${focused ? 'focused' : ''}`} onClick={() => setSelectedGroupKey(group.key)}><span className="uex-market-alert-group-icon"><TrendingUp size={15} /></span><span className="uex-market-alert-group-copy"><strong>{group.name}</strong><small>{group.events.length} anúncio{group.events.length === 1 ? '' : 's'} · último encontrado {formatMarketAlertAge(group.events[0])}</small></span><span className="uex-market-alert-group-price"><b>{Number(cheapest?.price || 0).toLocaleString('pt-BR')} UEC</b><small>menor preço · ver detalhes <ChevronDown size={12} /></small></span></button><button type="button" className="uex-market-alert-group-remove" title={`Remover grupo ${group.name}`} onClick={event => { event.stopPropagation(); dismissGroup(group.key); }}><X size={13} /></button></div>; })}</div></div>}
    {selectedGroup && <MarketAlertDetailsModal group={selectedGroup} onClose={() => setSelectedGroupKey('')} onDismiss={dismissEvent} />}
  </div>;
}

function normalizeAnalyticsName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function analyticsNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(String(value).replace(',', '.'));
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function priceOriginLabel(value) {
  return value === 'in_game' ? 'In-game' : value === 'uex' ? 'Mercado UEX' : value === 'mixed' ? 'Comparado' : 'Sem referência';
}

function derivePriceMetrics(row, buy, sell, sourceUsed) {
  const safeBuy = analyticsNumber(buy);
  const safeSell = analyticsNumber(sell);
  const spread = safeBuy > 0 && safeSell > 0 ? safeSell - safeBuy : 0;
  const margin = safeBuy > 0 && safeSell > 0 ? (spread / safeBuy) * 100 : null;
  const marginSignal = margin === null ? 0 : clamp((1 - Math.exp(-Math.max(margin, 0) / 80)) * 100);
  const profitSignal = spread > 0 ? clamp((Math.log1p(spread) / Math.log1p(10000000)) * 100) : 0;
  const riskReasons = [];
  if (margin > 1000 || (margin > 500 && row.negotiations < 50)) riskReasons.push('margem fora da curva');
  if (row.negotiations < 20 || row.listings < 10) riskReasons.push('amostra pequena');
  if (row.trend30 !== null && row.trend30 < -15) riskReasons.push('tendência negativa');
  if (row.successRate !== null && row.successRate < 20) riskReasons.push('baixo sucesso reportado');
  if (margin !== null && margin <= 0) riskReasons.push('spread não positivo');
  const riskScore = clamp(riskReasons.reduce((sum, reason) => sum + (reason === 'margem fora da curva' ? 32 : reason === 'amostra pequena' ? 28 : reason === 'tendência negativa' ? 20 : reason === 'baixo sucesso reportado' ? 18 : 24), 0));
  return { ...row, buy: safeBuy, sell: safeSell, spread, margin, marginSignal, profitSignal, riskReasons, riskScore, risk: riskLabel(riskScore), sourceUsed };
}

function applyPriceSource(row, source) {
  const hasMarket = row.marketBuy > 0 || row.marketSell > 0;
  const hasGame = row.inGameBuy > 0 || row.inGameSell > 0;
  let buy = row.marketBuy;
  let sell = row.marketSell;
  let sourceUsed = hasMarket ? 'uex' : hasGame ? 'in_game' : 'none';
  if (source === 'in_game') { buy = row.inGameBuy; sell = row.inGameSell; sourceUsed = hasGame ? 'in_game' : 'none'; }
  if (source === 'uex') { buy = row.marketBuy; sell = row.marketSell; sourceUsed = hasMarket ? 'uex' : 'none'; }
  if (source === 'compare') { buy = row.marketBuy > 0 ? row.marketBuy : row.inGameBuy; sell = row.marketSell > 0 ? row.marketSell : row.inGameSell; sourceUsed = hasMarket && hasGame ? 'mixed' : hasMarket ? 'uex' : hasGame ? 'in_game' : 'none'; }
  const derived = derivePriceMetrics(row, buy, sell, sourceUsed);
  return sourceUsed === 'in_game' ? { ...derived, trend30: null, trendSignal: 50 } : derived;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
}

const STRATEGY_LABELS = Object.freeze({
  balanced: 'Equilibrada',
  margin: 'Maior margem',
  liquidity: 'Mais liquidez',
  safe: 'Menor risco',
  value: 'Maior valor por unidade',
});

function scoreForStrategy(row, strategy) {
  const allWeights = {
    balanced: { margin: 0.31, liquidity: 0.25, confidence: 0.2, trend: 0.14, profit: 0.1, riskPenalty: 0.16 },
    margin: { margin: 0.52, liquidity: 0.15, confidence: 0.14, trend: 0.1, profit: 0.09, riskPenalty: 0.2 },
    liquidity: { margin: 0.18, liquidity: 0.5, confidence: 0.17, trend: 0.1, profit: 0.05, riskPenalty: 0.12 },
    safe: { margin: 0.2, liquidity: 0.23, confidence: 0.4, trend: 0.17, profit: 0, riskPenalty: 0.3 },
    value: { margin: 0.19, liquidity: 0.18, confidence: 0.16, trend: 0.1, profit: 0.37, riskPenalty: 0.14 },
  };
  const weights = allWeights[strategy] || allWeights.balanced;
  const raw = row.marginSignal * weights.margin
    + row.liquiditySignal * weights.liquidity
    + row.confidence * weights.confidence
    + row.trendSignal * weights.trend
    + row.profitSignal * weights.profit
    - row.riskScore * weights.riskPenalty;
  return Math.round(clamp(raw));
}

function riskLabel(score) {
  if (score >= 55) return 'alto';
  if (score >= 30) return 'médio';
  return 'baixo';
}

function buildAnalyticsRows(sourceRows, localSales, gameItems = []) {
  const gamePricesByName = new Map((gameItems || []).map(item => [normalizeAnalyticsName(item.name), {
    buy: analyticsNumber(item.price_buy),
    sell: analyticsNumber(item.price_sell),
  }]));
  const salesByItem = new Map();
  (localSales || []).forEach(sale => {
    const key = normalizeAnalyticsName(sale.title || sale.item_name || sale.name);
    if (!key) return;
    const previous = salesByItem.get(key) || { count: 0, qty: 0, revenue: 0 };
    previous.count += 1;
    previous.qty += analyticsNumber(sale.qty, sale.quantity, 1);
    previous.revenue += analyticsNumber(sale.total_revenue, sale.totalRevenue, sale.price);
    salesByItem.set(key, previous);
  });

  return (sourceRows || []).map(row => {
    const marketBuy = analyticsNumber(row.price_avg_buy);
    const marketSell = analyticsNumber(row.price_avg_sell);
    const marketMonthSell = analyticsNumber(row.price_avg_month_sell);
    const marketMonthBuy = analyticsNumber(row.price_avg_month_buy);
    const marketMinSell = analyticsNumber(row.price_min_sell);
    const marketMaxSell = analyticsNumber(row.price_max_sell);
    const marketMinBuy = analyticsNumber(row.price_min_buy);
    const marketMaxBuy = analyticsNumber(row.price_max_buy);
    const gamePrice = gamePricesByName.get(normalizeAnalyticsName(row.item_name)) || { buy: 0, sell: 0 };
    const listingsSell = analyticsNumber(row.listings_count_sell);
    const listingsBuy = analyticsNumber(row.listings_count_buy);
    const listings = analyticsNumber(row.total_listings_count, listingsSell + listingsBuy);
    const negotiations = analyticsNumber(row.negotiations_count);
    const successfulNegotiations = analyticsNumber(row.negotiations_success);
    const openNegotiations = analyticsNumber(row.negotiations_open);
    const activityPerListing = listings > 0 ? (negotiations / listings) * 100 : 0;
    const successRate = negotiations > 0 ? (successfulNegotiations / negotiations) * 100 : null;
    const negotiationSignal = clamp((Math.log1p(negotiations) / Math.log1p(500)) * 100);
    const depthSignal = clamp((Math.log1p(listings) / Math.log1p(150)) * 100);
    const successSignal = successRate === null ? 50 : clamp(successRate * 1.6);
    const liquiditySignal = clamp(negotiationSignal * 0.5 + successSignal * 0.3 + depthSignal * 0.2);
    const confidence = Math.round(clamp(negotiationSignal * 0.65 + depthSignal * 0.35));
    const trend30 = marketMonthSell > 0 && marketSell > 0 ? ((marketSell - marketMonthSell) / marketMonthSell) * 100 : null;
    const trendSignal = trend30 === null ? 50 : clamp(50 + trend30 * 1.2);
    const base = {
      ...row,
      marketBuy,
      marketSell,
      marketMonthSell,
      marketMonthBuy,
      marketMinSell,
      marketMaxSell,
      marketMinBuy,
      marketMaxBuy,
      inGameBuy: gamePrice.buy,
      inGameSell: gamePrice.sell,
      listingsSell,
      listingsBuy,
      listings,
      negotiations,
      successfulNegotiations,
      openNegotiations,
      activityPerListing,
      successRate,
      liquiditySignal,
      confidence,
      trend30,
      trendSignal,
    };
    const marketVersion = applyPriceSource(base, 'uex');
    const key = normalizeAnalyticsName(row.item_name);
    const own = salesByItem.get(key) || { count: 0, qty: 0, revenue: 0 };
    return {
      ...marketVersion,
      monthSell: marketMonthSell,
      monthBuy: marketMonthBuy,
      ownSalesCount: own.count,
      ownSalesQty: own.qty,
      ownRevenue: own.revenue,
      ownAveragePrice: own.qty > 0 ? own.revenue / own.qty : 0,
    };
  });
}

function aggregateQualityRows(rows) {
  const groups = new Map();
  rows.forEach(row => {
    const key = `${normalizeAnalyticsName(row.item_name)}|${row.currency || ''}`;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  });
  return Array.from(groups.values()).map(group => {
    const representative = [...group].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
    const qualityPrices = new Set(group.map(row => `${row.buy}|${row.sell}`));
    const margins = group.map(row => row.margin).filter(value => value !== null);
    const averageMargin = margins.length ? margins.reduce((sum, value) => sum + value, 0) / margins.length : null;
    return {
      ...representative,
      qualityCount: group.length,
      qualityTiers: group.map(row => qualityTierLabel(row.quality_tier)).filter(Boolean),
      qualityValues: group.map(row => String(row.quality_tier)),
      qualityConsistency: Math.round((qualityPrices.size === 1 ? 1 : 1 / qualityPrices.size) * 100),
      marginMin: margins.length ? Math.min(...margins) : null,
      marginMax: margins.length ? Math.max(...margins) : null,
      averageMargin,
    };
  });
}

function percentLabel(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function OpportunityBars({ rows }) {
  if (!rows.length) return <EmptyState text="Nenhuma oportunidade corresponde aos filtros atuais." />;
  const maxScore = Math.max(...rows.map(row => row.strategyScore ?? row.score ?? 0), 1);
  return <div className="uex-opportunity-bars">{rows.slice(0, 8).map((row, index) => {
    const currentScore = row.strategyScore ?? row.score ?? 0;
    const width = Math.max(5, (currentScore / maxScore) * 100);
    const color = riskColor(row.risk);
    return <div className="uex-opportunity-bar" key={`${row.id_item || row.item_name || index}-${row.currency || ''}`}><div className="uex-opportunity-label"><span title={row.item_name}>{index + 1}. {row.item_name || 'Item sem nome'}{row.qualityCount > 1 ? ` · ${row.qualityCount} qualidades` : ''}</span><strong style={{ color }}>{currentScore}/100</strong></div><div className="uex-opportunity-track"><div className="uex-opportunity-fill" style={{ width: `${width}%`, background: color }} /></div><div className="uex-opportunity-meta"><span>{row.margin === null ? 'Sem preço de compra' : `Margem ${percentLabel(row.margin)}`} · risco {row.risk}</span><span>{row.negotiations} negociações · {row.listings} anúncios</span></div></div>;
  })}</div>;
}

function riskColor(risk) {
  return risk === 'alto' ? '#fb7185' : risk === 'médio' ? '#fbbf24' : '#34d399';
}

function RiskBadge({ risk, reasons = [] }) {
  const color = riskColor(risk);
  return <span className="uex-risk-badge" style={{ '--risk-color': color }} title={reasons.length ? reasons.join(' · ') : 'Sem alertas de risco relevantes'}>{risk || '—'}</span>;
}

function OpportunityScatter({ rows }) {
  const points = rows.filter(row => row.margin !== null && row.negotiations > 0).slice(0, 80);
  if (!points.length) return <EmptyState text="Não há dados suficientes para montar o gráfico margem × atividade." />;
  const maxMargin = Math.max(...points.map(row => Math.max(row.margin || 0, 0)), 1);
  const maxActivity = Math.max(...points.map(row => row.negotiations), 1);
  return <div className="uex-scatter-wrap"><div className="uex-scatter-axis-y"><span>margem alta</span><span>margem baixa</span></div><div className="uex-scatter-plot"><div className="uex-scatter-gridline horizontal one" /><div className="uex-scatter-gridline horizontal two" /><div className="uex-scatter-gridline vertical one" /><div className="uex-scatter-gridline vertical two" />{points.map((row, index) => { const left = clamp((Math.log1p(row.negotiations) / Math.log1p(maxActivity)) * 94 + 3, 3, 97); const top = clamp(97 - (Math.log1p(Math.max(row.margin, 0)) / Math.log1p(maxMargin)) * 90, 3, 97); const size = clamp(5 + Math.log1p(row.listings) * 1.8, 6, 20); const color = riskColor(row.risk); return <span key={`${row.item_name}-${row.quality_tier}-${row.currency}-${index}`} className="uex-scatter-point" style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, background: color, '--point-color': color }} title={`${row.item_name} · margem ${percentLabel(row.margin)} · ${row.negotiations} negociações · risco ${row.risk}`} />; })}<div className="uex-scatter-label low">menos atividade</div><div className="uex-scatter-label high">mais atividade</div></div><div className="uex-scatter-axis-x"><span>menor atividade</span><span>maior atividade</span></div></div>;
}

function RiskDistribution({ rows }) {
  const counts = rows.reduce((result, row) => { result[row.risk] = (result[row.risk] || 0) + 1; return result; }, { baixo: 0, médio: 0, alto: 0 });
  const total = Math.max(rows.length, 1);
  return <div className="uex-risk-distribution"><div className="uex-risk-stack"><span className="low" style={{ width: `${(counts.baixo / total) * 100}%` }} /><span className="medium" style={{ width: `${(counts.médio / total) * 100}%` }} /><span className="high" style={{ width: `${(counts.alto / total) * 100}%` }} /></div><div className="uex-risk-legend"><span><i className="uex-dot green" /> baixo: {counts.baixo}</span><span><i className="uex-dot gold" /> médio: {counts.médio}</span><span><i className="uex-dot red" /> alto: {counts.alto}</span></div></div>;
}

function SortableHeader({ label, sortKey, sort, setSort, highKey, lowKey }) {
  const active = sort === highKey || sort === lowKey;
  const next = sort === highKey ? lowKey : highKey;
  return <th><button type="button" className="uex-sort-button" onClick={() => setSort(next)} title={`Ordenar: ${label}`}>{label}<span className={active ? 'active' : ''}>{active ? (sort === highKey ? '↓' : '↑') : '↕'}</span></button></th>;
}

function StickyHorizontalTable({ children, sourceLabel = '', minWidth = 1800, className = '' }) {
  const viewportRef = useRef(null);
  const stickyRef = useRef(null);
  const [contentWidth, setContentWidth] = useState(minWidth);

  useEffect(() => {
    const viewport = viewportRef.current;
    const sticky = stickyRef.current;
    if (!viewport || !sticky) return undefined;
    const updateWidth = () => setContentWidth(Math.max(minWidth, viewport.scrollWidth || minWidth));
    const syncStickyFromViewport = () => {
      if (Math.abs(sticky.scrollLeft - viewport.scrollLeft) > 1) sticky.scrollLeft = viewport.scrollLeft;
    };
    const syncViewportFromSticky = () => {
      if (Math.abs(viewport.scrollLeft - sticky.scrollLeft) > 1) viewport.scrollLeft = sticky.scrollLeft;
    };
    viewport.addEventListener('scroll', syncStickyFromViewport, { passive: true });
    sticky.addEventListener('scroll', syncViewportFromSticky, { passive: true });
    updateWidth();
    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateWidth);
      observer.observe(viewport);
      if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    }
    return () => {
      viewport.removeEventListener('scroll', syncStickyFromViewport);
      sticky.removeEventListener('scroll', syncViewportFromSticky);
      observer?.disconnect();
    };
  }, [minWidth, children]);

  return <div className={`uex-table-scroll-shell ${className}`}>
    <div className="uex-table-sticky-zone">
      <div className="uex-table-scroll-hint"><ArrowDownRight size={13} /><span>Barra horizontal fixa: arraste para ver as colunas à direita</span>{sourceLabel && <span className="uex-table-scroll-source">Fonte usada: {sourceLabel}</span>}</div>
      <div ref={stickyRef} className="uex-table-sticky-scroll" aria-label="Rolagem horizontal persistente da tabela" tabIndex="0"><div style={{ width: `${contentWidth}px`, height: 1 }} /></div>
    </div>
    <div ref={viewportRef} className="uex-insights-table-wrap">{children}</div>
  </div>;
}

function ProfitAnalysisTab() {
  const initialSnapshot = readSnapshot(UEX_INSIGHTS_KEYS.marketplaceTrends, []);
  const [query, setQuery] = useState('');
  const [currency, setCurrency] = useState('');
  const [qualityTier, setQualityTier] = useState('');
  const [minMargin, setMinMargin] = useState('0');
  const [maxMargin, setMaxMargin] = useState('');
  const [minNegotiations, setMinNegotiations] = useState('0');
  const [minListings, setMinListings] = useState('0');
  const [minSuccess, setMinSuccess] = useState('0');
  const [minConfidence, setMinConfidence] = useState('0');
  const [riskFilter, setRiskFilter] = useState('all');
  const [trendFilter, setTrendFilter] = useState('all');
  const [strategy, setStrategy] = useState('balanced');
  const [onlySpread, setOnlySpread] = useState(true);
  const [onlyPositive, setOnlyPositive] = useState(true);
  const [onlyLocalSales, setOnlyLocalSales] = useState(false);
  const [groupQualities, setGroupQualities] = useState(true);
  const [sort, setSort] = useState('score');
  const [rows, setRows] = useState(initialSnapshot.data || []);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [salesVersion, setSalesVersion] = useState(0);

  useEffect(() => {
    const refreshSales = () => setSalesVersion(value => value + 1);
    window.addEventListener('sc_uex_sales_updated', refreshSales);
    return () => window.removeEventListener('sc_uex_sales_updated', refreshSales);
  }, []);

  const localSales = useMemo(() => loadUexSales(), [salesVersion]);
  const gameItems = useMemo(() => loadUexItemsDB().items || [], []);
  const [priceSource, setPriceSource] = useState('uex');
  const analyzedRows = useMemo(() => buildAnalyticsRows(rows, localSales, gameItems), [gameItems, localSales, rows]);
  const sourceRows = useMemo(() => analyzedRows.map(row => applyPriceSource(row, priceSource)), [analyzedRows, priceSource]);
  const baseRows = useMemo(() => groupQualities ? aggregateQualityRows(sourceRows) : sourceRows, [groupQualities, sourceRows]);
  const strategyRows = useMemo(() => baseRows.map(row => ({ ...row, strategyScore: scoreForStrategy(row, strategy) })), [baseRows, strategy]);
  const currencies = useMemo(() => Array.from(new Set(strategyRows.map(row => String(row.currency || '').trim()).filter(Boolean))).sort(), [strategyRows]);
  const filteredRows = useMemo(() => {
    const text = normalizeAnalyticsName(query);
    const marginFloor = analyticsNumber(minMargin);
    const marginCeiling = analyticsNumber(maxMargin);
    const negotiationsFloor = analyticsNumber(minNegotiations);
    const listingsFloor = analyticsNumber(minListings);
    const successFloor = analyticsNumber(minSuccess);
    const confidenceFloor = analyticsNumber(minConfidence);
    const next = strategyRows.filter(row => {
      const itemName = normalizeAnalyticsName(row.item_name);
      if (text && !itemName.includes(text)) return false;
      if (currency && String(row.currency || '') !== currency) return false;
      if (priceSource === 'in_game' && row.sourceUsed !== 'in_game') return false;
      if (priceSource === 'uex' && row.sourceUsed !== 'uex') return false;
      if (priceSource === 'compare' && row.sourceUsed === 'none') return false;
      if (qualityTier !== '' && groupQualities && !(row.qualityValues || [String(row.quality_tier)]).includes(String(qualityTier))) return false;
      if (qualityTier !== '' && !groupQualities && String(row.quality_tier) !== qualityTier) return false;
      if (onlySpread && !(row.buy > 0 && row.sell > 0)) return false;
      if (onlyPositive && !(row.margin !== null && row.margin > 0)) return false;
      if (onlyLocalSales && row.ownSalesCount <= 0) return false;
      if (row.margin !== null && row.margin < marginFloor) return false;
      if (row.margin !== null && marginCeiling > 0 && row.margin > marginCeiling) return false;
      if (row.margin === null && (marginFloor > 0 || marginCeiling > 0)) return false;
      if (row.negotiations < negotiationsFloor || row.listings < listingsFloor) return false;
      if (row.successRate !== null && row.successRate < successFloor) return false;
      if (row.successRate === null && successFloor > 0) return false;
      if (row.confidence < confidenceFloor) return false;
      if (riskFilter === 'baixo' && row.risk !== 'baixo') return false;
      if (riskFilter === 'médio' && !['baixo', 'médio'].includes(row.risk)) return false;
      if (riskFilter === 'alto' && row.risk !== 'alto') return false;
      if (trendFilter === 'up' && !(row.trend30 !== null && row.trend30 >= 5)) return false;
      if (trendFilter === 'down' && !(row.trend30 !== null && row.trend30 <= -5)) return false;
      if (trendFilter === 'stable' && !(row.trend30 === null || (row.trend30 > -5 && row.trend30 < 5))) return false;
      return true;
    });
    const order = {
      score: (a, b) => b.strategyScore - a.strategyScore,
      margin: (a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity),
      marginLow: (a, b) => (a.margin ?? Infinity) - (b.margin ?? Infinity),
      activity: (a, b) => b.negotiations - a.negotiations,
      activityLow: (a, b) => a.negotiations - b.negotiations,
      listings: (a, b) => b.listings - a.listings,
      listingsLow: (a, b) => a.listings - b.listings,
      trend: (a, b) => (b.trend30 ?? -Infinity) - (a.trend30 ?? -Infinity),
      trendLow: (a, b) => (a.trend30 ?? Infinity) - (b.trend30 ?? Infinity),
      confidence: (a, b) => b.confidence - a.confidence,
      confidenceLow: (a, b) => a.confidence - b.confidence,
      currencyHigh: (a, b) => String(b.currency || '').localeCompare(String(a.currency || ''), 'pt-BR'),
      currencyLow: (a, b) => String(a.currency || '').localeCompare(String(b.currency || ''), 'pt-BR'),
      qualitiesHigh: (a, b) => (b.qualityCount ?? Number(b.quality_tier) ?? 0) - (a.qualityCount ?? Number(a.quality_tier) ?? 0),
      qualitiesLow: (a, b) => (a.qualityCount ?? Number(a.quality_tier) ?? 0) - (b.qualityCount ?? Number(b.quality_tier) ?? 0),
      inGameBuyHigh: (a, b) => b.inGameBuy - a.inGameBuy,
      inGameBuyLow: (a, b) => a.inGameBuy - b.inGameBuy,
      inGameSellHigh: (a, b) => b.inGameSell - a.inGameSell,
      inGameSellLow: (a, b) => a.inGameSell - b.inGameSell,
      marketBuyHigh: (a, b) => b.marketBuy - a.marketBuy,
      marketBuyLow: (a, b) => a.marketBuy - b.marketBuy,
      marketSellHigh: (a, b) => b.marketSell - a.marketSell,
      marketSellLow: (a, b) => a.marketSell - b.marketSell,
      successHigh: (a, b) => (b.successRate ?? -Infinity) - (a.successRate ?? -Infinity),
      successLow: (a, b) => (a.successRate ?? Infinity) - (b.successRate ?? Infinity),
      ownHigh: (a, b) => b.ownRevenue - a.ownRevenue,
      ownLow: (a, b) => a.ownRevenue - b.ownRevenue,
      own: (a, b) => b.ownRevenue - a.ownRevenue,
      value: (a, b) => b.spread - a.spread,
      buyHigh: (a, b) => b.buy - a.buy,
      buyLow: (a, b) => a.buy - b.buy,
      sellHigh: (a, b) => b.sell - a.sell,
      sellLow: (a, b) => a.sell - b.sell,
      spreadHigh: (a, b) => b.spread - a.spread,
      spreadLow: (a, b) => a.spread - b.spread,
      scoreLow: (a, b) => a.strategyScore - b.strategyScore,
    };
    return next.sort(order[sort] || order.score);
  }, [currency, groupQualities, maxMargin, minConfidence, minListings, minMargin, minNegotiations, minSuccess, onlyLocalSales, onlyPositive, onlySpread, priceSource, qualityTier, query, riskFilter, sort, strategyRows, trendFilter]);

  const kpis = useMemo(() => {
    const withSpread = strategyRows.filter(row => row.margin !== null);
    const positive = withSpread.filter(row => row.margin > 0);
    const lowRisk = strategyRows.filter(row => row.risk === 'baixo');
    const gameCount = strategyRows.filter(row => row.inGameBuy > 0 || row.inGameSell > 0).length;
    const marketCount = strategyRows.filter(row => row.marketBuy > 0 || row.marketSell > 0).length;
    const ownRevenue = strategyRows.reduce((sum, row) => sum + row.ownRevenue, 0);
    const best = [...filteredRows].sort((a, b) => b.strategyScore - a.strategyScore)[0] || null;
    return { total: strategyRows.length, withSpread: withSpread.length, positive: positive.length, lowRisk: lowRisk.length, gameCount, marketCount, ownRevenue, best, averageMargin: withSpread.length ? withSpread.reduce((sum, row) => sum + row.margin, 0) / withSpread.length : null };
  }, [filteredRows, strategyRows]);

  async function sync() {
    setLoading(true); setError('');
    try {
      const requestedTiers = qualityTier === '' ? QUALITY_TIERS.filter(tier => tier.value !== '').map(tier => tier.value) : [qualityTier];
      const responses = await Promise.all(requestedTiers.map(tier => fetchMarketplaceTrends({ itemName: query.trim(), currency, qualityTier: tier })));
      const seen = new Set();
      const data = responses.flatMap((response, tierIndex) => response.map(row => ({ ...row, quality_tier: row.quality_tier ?? requestedTiers[tierIndex] }))).filter(row => {
        const key = `${row.id_item || row.item_name || ''}|${row.quality_tier || 0}|${row.currency || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const next = saveUexInsight(UEX_INSIGHTS_KEYS.marketplaceTrends, data, { endpoint: 'marketplace_trends', ttl: '1h' });
      setRows(data); setSnapshot(next);
    } catch (err) { setError(err.message || 'Não foi possível consultar as tendências do marketplace.'); }
    setLoading(false);
  }

  return <div style={panelStyle}>
    <SectionHeader icon={BarChart3} color="#34d399" title="Análise de lucro e oportunidades" description="Identifica oportunidades com margem ajustada por liquidez, confiança da amostra, tendência e risco. As vendas locais aparecem apenas como referência de desempenho próprio." action={<Freshness snapshot={snapshot} ttl={1} />} />
    <div className="uex-insights-analysis-note"><Gauge size={14} /><span><strong>Por que o ranking mudou:</strong> margens extremas e amostras pequenas agora recebem penalidade. Itens repetidos em várias qualidades podem ser agrupados. Negociações, anúncios e sucesso reportado são sinais de mercado, não vendas garantidas nem lucro líquido.</span></div>
    <div className="uex-insights-filter-grid uex-analysis-filter-grid uex-analysis-filter-grid-advanced">
      <label>Item ou nome<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex.: helmet, weapon, component" style={inputStyle} /></label>
      <label>Estratégia<select value={strategy} onChange={event => setStrategy(event.target.value)} style={inputStyle}>{Object.entries(STRATEGY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Origem do preço<select value={priceSource} onChange={event => setPriceSource(event.target.value)} style={inputStyle}><option value="uex">Somente mercado UEX</option><option value="in_game">Somente referência in-game</option><option value="compare">Comparar in-game + UEX</option></select></label>
      <label>Moeda<select value={currency} onChange={event => setCurrency(event.target.value)} style={inputStyle}><option value="">Todas</option>{currencies.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Qualidade<select value={qualityTier} onChange={event => setQualityTier(event.target.value)} style={inputStyle}>{QUALITY_TIERS.map(tier => <option key={tier.value} value={tier.value}>{tier.label}</option>)}</select></label>
      <label>Risco máximo<select value={riskFilter} onChange={event => setRiskFilter(event.target.value)} style={inputStyle}><option value="all">Todos os riscos</option><option value="baixo">Somente baixo</option><option value="médio">Baixo e médio</option><option value="alto">Somente alto</option></select></label>
      <label>Tendência<select value={trendFilter} onChange={event => setTrendFilter(event.target.value)} style={inputStyle}><option value="all">Todas</option><option value="up">Alta ≥ 5%</option><option value="stable">Estável</option><option value="down">Queda ≤ -5%</option></select></label>
      <label>Margem mínima (%)<input type="number" min="0" step="1" value={minMargin} onChange={event => setMinMargin(event.target.value)} style={inputStyle} /></label>
      <label>Margem máxima (%)<input type="number" min="0" step="10" value={maxMargin} onChange={event => setMaxMargin(event.target.value)} placeholder="Ex.: 500" style={inputStyle} /></label>
      <label>Confiança mínima (%)<input type="number" min="0" max="100" step="5" value={minConfidence} onChange={event => setMinConfidence(event.target.value)} style={inputStyle} /></label>
      <label>Sucesso mínimo (%)<input type="number" min="0" max="100" step="5" value={minSuccess} onChange={event => setMinSuccess(event.target.value)} style={inputStyle} /></label>
      <label>Negociações mínimas<input type="number" min="0" step="1" value={minNegotiations} onChange={event => setMinNegotiations(event.target.value)} style={inputStyle} /></label>
      <label>Anúncios mínimos<input type="number" min="0" step="1" value={minListings} onChange={event => setMinListings(event.target.value)} style={inputStyle} /></label>
      <label>Ordenar por<select value={sort} onChange={event => setSort(event.target.value)} style={inputStyle}><option value="score">Score ajustado</option><option value="buyHigh">Maior compra média</option><option value="buyLow">Menor compra média</option><option value="sellHigh">Maior venda média</option><option value="sellLow">Menor venda média</option><option value="spreadHigh">Maior spread</option><option value="spreadLow">Menor spread</option><option value="margin">Maior margem</option><option value="activity">Mais negociações</option><option value="listings">Mais anúncios</option><option value="trend">Melhor tendência</option><option value="confidence">Maior confiança</option><option value="confidenceLow">Menor confiança</option><option value="qualitiesHigh">Mais qualidades</option><option value="qualitiesLow">Menos qualidades</option><option value="currencyHigh">Moeda Z-A</option><option value="currencyLow">Moeda A-Z</option><option value="inGameBuyHigh">Maior compra in-game</option><option value="inGameBuyLow">Menor compra in-game</option><option value="inGameSellHigh">Maior venda in-game</option><option value="inGameSellLow">Menor venda in-game</option><option value="marketBuyHigh">Maior compra UEX</option><option value="marketBuyLow">Menor compra UEX</option><option value="marketSellHigh">Maior venda UEX</option><option value="marketSellLow">Menor venda UEX</option><option value="successHigh">Maior sucesso</option><option value="successLow">Menor sucesso</option><option value="ownHigh">Maior receita local</option><option value="ownLow">Menor receita local</option><option value="own">Minha receita local</option></select></label>
      <div className="uex-analysis-filter-actions"><label className="uex-analysis-check"><input type="checkbox" checked={onlySpread} onChange={event => setOnlySpread(event.target.checked)} /> com compra e venda</label><label className="uex-analysis-check"><input type="checkbox" checked={onlyPositive} onChange={event => setOnlyPositive(event.target.checked)} /> spread positivo</label><label className="uex-analysis-check"><input type="checkbox" checked={groupQualities} onChange={event => setGroupQualities(event.target.checked)} /> agrupar qualidades</label><label className="uex-analysis-check"><input type="checkbox" checked={onlyLocalSales} onChange={event => setOnlyLocalSales(event.target.checked)} /> somente minhas vendas</label><LoadingButton loading={loading} onClick={sync} tone="green">Atualizar tendências</LoadingButton></div>
    </div>
    <ErrorBox error={error} />
    <div className="uex-insights-mini-grid uex-analysis-kpis"><div className="uex-insights-stat"><span>Itens após agrupamento</span><strong>{kpis.total.toLocaleString('pt-BR')}</strong></div><div className="uex-insights-stat"><span>Com spread calculável</span><strong>{kpis.withSpread.toLocaleString('pt-BR')}</strong></div><div className="uex-insights-stat"><span>Spread positivo</span><strong style={{ color: '#34d399' }}>{kpis.positive.toLocaleString('pt-BR')}</strong></div><div className="uex-insights-stat"><span>Baixo risco</span><strong style={{ color: '#34d399' }}>{kpis.lowRisk.toLocaleString('pt-BR')}</strong></div><div className="uex-insights-stat"><span>Referência in-game</span><strong>{kpis.gameCount.toLocaleString('pt-BR')}</strong></div><div className="uex-insights-stat"><span>Mercado UEX</span><strong>{kpis.marketCount.toLocaleString('pt-BR')}</strong></div><div className="uex-insights-stat"><span>Margem média</span><strong>{percentLabel(kpis.averageMargin)}</strong></div><div className="uex-insights-stat"><span>Melhor oportunidade</span><strong title={kpis.best?.item_name}>{kpis.best?.item_name || '—'}</strong></div></div>
    <div className="uex-analysis-dashboard-grid uex-analysis-dashboard-grid-wide"><div className="uex-analysis-chart-panel"><div className="uex-analysis-panel-title"><Trophy size={14} /> Ranking ajustado · {STRATEGY_LABELS[strategy]}</div><OpportunityBars rows={filteredRows} /></div><div className="uex-analysis-chart-panel"><div className="uex-analysis-panel-title"><BarChart3 size={14} /> Margem × atividade</div><OpportunityScatter rows={filteredRows} /></div><div className="uex-analysis-chart-panel"><div className="uex-analysis-panel-title"><ShieldCheck size={14} /> Distribuição de risco</div><RiskDistribution rows={strategyRows} /><div className="uex-signal-list"><div><span>Itens com negociações</span><strong>{strategyRows.filter(row => row.negotiations > 0).length}</strong></div><div><span>Alta contra 30 dias</span><strong>{strategyRows.filter(row => row.trend30 > 0).length}</strong></div><div><span>Sucesso reportado</span><strong>{strategyRows.filter(row => row.successfulNegotiations > 0).length}</strong></div><div><span>Maior atividade</span><strong>{filteredRows[0]?.negotiations ?? 0} negociações</strong></div></div></div></div>
    {filteredRows.length > 0 ? <StickyHorizontalTable sourceLabel={priceOriginLabel(priceSource)} className="uex-analysis-table-wrap"><table className="uex-insights-table uex-analysis-table"><thead><tr><th>Item</th><SortableHeader label="Qualidades" sortKey="qualities" sort={sort} setSort={setSort} highKey="qualitiesHigh" lowKey="qualitiesLow" /><th>Fonte usada</th><th>Risco</th><SortableHeader label="Confiança" sortKey="confidence" sort={sort} setSort={setSort} highKey="confidence" lowKey="confidenceLow" /><SortableHeader label="Moeda" sortKey="currency" sort={sort} setSort={setSort} highKey="currencyHigh" lowKey="currencyLow" /><SortableHeader label="Compra in-game" sortKey="inGameBuy" sort={sort} setSort={setSort} highKey="inGameBuyHigh" lowKey="inGameBuyLow" /><SortableHeader label="Venda in-game" sortKey="inGameSell" sort={sort} setSort={setSort} highKey="inGameSellHigh" lowKey="inGameSellLow" /><SortableHeader label="Compra UEX" sortKey="marketBuy" sort={sort} setSort={setSort} highKey="marketBuyHigh" lowKey="marketBuyLow" /><SortableHeader label="Venda UEX" sortKey="marketSell" sort={sort} setSort={setSort} highKey="marketSellHigh" lowKey="marketSellLow" /><SortableHeader label="Compra usada" sortKey="buy" sort={sort} setSort={setSort} highKey="buyHigh" lowKey="buyLow" /><SortableHeader label="Venda usada" sortKey="sell" sort={sort} setSort={setSort} highKey="sellHigh" lowKey="sellLow" /><SortableHeader label="Spread" sortKey="spread" sort={sort} setSort={setSort} highKey="spreadHigh" lowKey="spreadLow" /><SortableHeader label="Margem" sortKey="margin" sort={sort} setSort={setSort} highKey="margin" lowKey="marginLow" /><SortableHeader label="30 dias" sortKey="trend" sort={sort} setSort={setSort} highKey="trend" lowKey="trendLow" /><SortableHeader label="Negociações" sortKey="activity" sort={sort} setSort={setSort} highKey="activity" lowKey="activityLow" /><SortableHeader label="Anúncios" sortKey="listings" sort={sort} setSort={setSort} highKey="listings" lowKey="listingsLow" /><SortableHeader label="Sucesso" sortKey="success" sort={sort} setSort={setSort} highKey="successHigh" lowKey="successLow" /><SortableHeader label="Minha receita" sortKey="own" sort={sort} setSort={setSort} highKey="ownHigh" lowKey="ownLow" /><SortableHeader label="Score" sortKey="score" sort={sort} setSort={setSort} highKey="score" lowKey="scoreLow" /></tr></thead><tbody>{filteredRows.slice(0, 250).map((row, index) => { const positive = row.margin !== null && row.margin > 0; const scoreColor = row.strategyScore >= 70 ? '#34d399' : row.strategyScore >= 40 ? '#fbbf24' : '#94a3b8'; return <tr key={`${row.id_item || row.item_name || index}-${row.currency || ''}`}><td><strong>{row.item_name || '—'}</strong><small>{row.ownSalesCount ? `${row.ownSalesCount} venda(s) local(is) · ${row.ownSalesQty} unidade(s)` : 'Sem venda local registrada'}{row.riskReasons?.length ? ` · ${row.riskReasons.join(' · ')}` : ''}</small></td><td><strong>{row.qualityCount > 1 ? `${row.qualityCount} tiers` : qualityTierLabel(row.quality_tier)}</strong><small>{row.qualityTiers?.slice(0, 4).join(' · ') || '—'}{row.qualityCount > 1 ? ` · consistência ${row.qualityConsistency}%` : ''}</small></td><td><span className={`uex-source-badge ${row.sourceUsed}`}>{priceOriginLabel(row.sourceUsed)}</span></td><td><RiskBadge risk={row.risk} reasons={row.riskReasons} /></td><td>{row.confidence}%</td><td>{row.currency || '—'}</td><td>{formatUec(row.inGameBuy)}</td><td>{formatUec(row.inGameSell)}</td><td>{formatUec(row.marketBuy)}</td><td>{formatUec(row.marketSell)}</td><td>{formatUec(row.buy)}</td><td>{formatUec(row.sell)}</td><td style={{ color: positive ? '#34d399' : 'var(--text-muted)' }}>{row.margin === null ? '—' : formatUec(row.spread)}</td><td style={{ color: positive ? '#34d399' : 'var(--text-muted)', fontWeight: 700 }}>{percentLabel(row.margin)}</td><td style={{ color: row.trend30 > 0 ? '#34d399' : row.trend30 < 0 ? '#fb7185' : 'var(--text-muted)' }}>{row.trend30 === null ? '—' : `${row.trend30 > 0 ? '+' : ''}${percentLabel(row.trend30)}`}</td><td>{row.negotiations}{row.openNegotiations > 0 ? <small>{row.openNegotiations} abertas</small> : null}</td><td>{row.listings}</td><td>{row.successRate === null ? '—' : `${percentLabel(row.successRate)} (${row.successfulNegotiations})`}</td><td>{row.ownRevenue > 0 ? formatUec(row.ownRevenue) : '—'}</td><td><span className="uex-score-pill" style={{ '--score-color': scoreColor }}>{row.strategyScore}</span></td></tr>; })}</tbody></table></StickyHorizontalTable> : <EmptyState text="Nenhum dado de tendência carregado. Clique em Atualizar tendências ou ajuste os filtros." />}
    <div className="uex-analysis-footer"><Filter size={13} /> Exibindo {filteredRows.length.toLocaleString('pt-BR')} oportunidade(s) com estratégia <strong>{STRATEGY_LABELS[strategy]}</strong> e origem <strong>{priceOriginLabel(priceSource)}</strong>. Valores in-game vêm do catálogo local sincronizado em `UEX API (Live)`; valores UEX vêm de anúncios de jogadores. Quando uma fonte não existe, o campo permanece vazio.</div>
  </div>;
}

function RefineriesTab() {
  const refinerySnapshot = readSnapshot(UEX_INSIGHTS_KEYS.refineries, {});
  const jobsSnapshot = readSnapshot(UEX_INSIGHTS_KEYS.refineryJobs, []);
  const [methods, setMethods] = useState(() => refinerySnapshot.data?.methods || []);
  const [yields, setYields] = useState(() => refinerySnapshot.data?.yields || []);
  const [capacities, setCapacities] = useState(() => refinerySnapshot.data?.capacities || []);
  const [jobs, setJobs] = useState(() => jobsSnapshot.data || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState(refinerySnapshot);
  const [commodityQuery, setCommodityQuery] = useState('');
  const [terminalFilter, setTerminalFilter] = useState('all');
  const [yieldSort, setYieldSort] = useState('value');
  const [positiveOnly, setPositiveOnly] = useState(false);
  const [jobFilter, setJobFilter] = useState('all');

  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const commodityName = row => row?.commodity_name || row?.commodity || row?.item_name || row?.name_commodity || '—';
  const terminalName = row => row?.terminal_name || row?.terminal || row?.refinery_name || row?.location || '—';
  const methodName = row => row?.name || row?.method_name || row?.code || row?.id_refinery_method || 'Método';
  const currentYield = row => Number(row?.value ?? row?.yield ?? row?.value_current ?? 0) || 0;
  const weekYield = row => Number(row?.value_week ?? row?.yield_week ?? 0) || 0;
  const monthYield = row => Number(row?.value_month ?? row?.yield_month ?? 0) || 0;
  const rawCapacity = row => row?.capacity ?? row?.capacity_scu ?? row?.max_capacity ?? row?.capacity_units ?? row?.quantity;
  const rowMatches = row => {
    const query = normalize(commodityQuery);
    if (!query) return true;
    const haystack = normalize([commodityName(row), terminalName(row), methodName(row), row?.code, row?.name].join(' '));
    return haystack.includes(query);
  };

  const terminalOptions = useMemo(() => Array.from(new Set([
    ...yields.map(terminalName), ...capacities.map(terminalName), ...jobs.map(terminalName),
  ].filter(value => value && value !== '—'))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [capacities, jobs, yields]);

  const filteredMethods = useMemo(() => methods.slice(0, 30), [methods]);

  const filteredYields = useMemo(() => [...yields]
    .filter(row => rowMatches(row) && (terminalFilter === 'all' || terminalName(row) === terminalFilter) && (!positiveOnly || currentYield(row) > 0))
    .sort((a, b) => {
      if (yieldSort === 'week') return weekYield(b) - weekYield(a) || currentYield(b) - currentYield(a);
      if (yieldSort === 'month') return monthYield(b) - monthYield(a) || currentYield(b) - currentYield(a);
      if (yieldSort === 'commodity') return commodityName(a).localeCompare(commodityName(b), 'pt-BR') || currentYield(b) - currentYield(a);
      return currentYield(b) - currentYield(a) || weekYield(b) - weekYield(a);
    }), [yields, commodityQuery, terminalFilter, positiveOnly, yieldSort]);

  const filteredCapacities = useMemo(() => capacities.filter(row => rowMatches(row) && (terminalFilter === 'all' || terminalName(row) === terminalFilter)), [capacities, commodityQuery, terminalFilter]);
  const filteredJobs = useMemo(() => jobs.filter(row => {
    if (!rowMatches(row) || (terminalFilter !== 'all' && terminalName(row) !== terminalFilter)) return false;
    if (jobFilter === 'all') return true;
    const expiration = row?.date_expiration ? new Date(row.date_expiration).getTime() : 0;
    const expired = expiration > 0 && expiration < Date.now();
    return jobFilter === 'expired' ? expired : !expired;
  }), [jobs, commodityQuery, terminalFilter, jobFilter]);

  const uniqueCommodities = new Set(filteredYields.map(commodityName).filter(value => value !== '—')).size;
  const uniqueTerminals = new Set(filteredYields.map(terminalName).filter(value => value !== '—')).size;
  const bestYield = filteredYields[0];

  async function sync() {
    setLoading(true); setError('');
    const [methodsResult, yieldsResult, capacitiesResult, jobsResult] = await Promise.allSettled([fetchRefineryMethods(), fetchRefineryYields(), fetchRefineryCapacities(), fetchUserRefineryJobs()]);
    const nextMethods = methodsResult.status === 'fulfilled' ? methodsResult.value : methods;
    const nextYields = yieldsResult.status === 'fulfilled' ? yieldsResult.value : yields;
    const nextCapacities = capacitiesResult.status === 'fulfilled' ? capacitiesResult.value : capacities;
    const nextJobs = jobsResult.status === 'fulfilled' ? jobsResult.value : jobs;
    if (jobsResult.status === 'rejected' && !nextMethods.length && !nextYields.length) setError(jobsResult.reason?.message || 'Não foi possível consultar as refinarias.');
    const next = saveUexInsight(UEX_INSIGHTS_KEYS.refineries, { methods: nextMethods, yields: nextYields, capacities: nextCapacities }, { endpoint: 'refineries_methods/refineries_yields/refineries_capacities', ttl: '1d' });
    if (jobsResult.status === 'fulfilled') saveUexInsight(UEX_INSIGHTS_KEYS.refineryJobs, nextJobs, { endpoint: 'user_refineries_jobs', ttl: 'realtime' });
    setMethods(nextMethods); setYields(nextYields); setCapacities(nextCapacities); setJobs(nextJobs); setSnapshot(next); setLoading(false);
  }

  function clearFilters() {
    setCommodityQuery(''); setTerminalFilter('all'); setYieldSort('value'); setPositiveOnly(false); setJobFilter('all');
  }

  return <div style={panelStyle}>
    <SectionHeader icon={Pickaxe} color="#34d399" title="Acompanhamento de refinarias" description="Compare métodos, rendimento, capacidade estimada e jobs autenticados. Pesquise uma Commodity pelo nome e refine os resultados por terminal, período e situação do job." action={<Freshness snapshot={snapshot} ttl={24} />} />
    <div className="refinery-toolbar">
      <label className="refinery-search-field"><Search size={14}/><span className="sr-only">Pesquisar Commodity</span><input type="search" value={commodityQuery} onChange={event => setCommodityQuery(event.target.value)} placeholder="Pesquisar Commodity, terminal ou método..." /></label>
      <label><span>Terminal</span><select value={terminalFilter} onChange={event => setTerminalFilter(event.target.value)}><option value="all">Todos os terminais</option>{terminalOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
      <label><span>Ordenar rendimentos</span><select value={yieldSort} onChange={event => setYieldSort(event.target.value)}><option value="value">Maior rendimento atual</option><option value="week">Melhor em 7 dias</option><option value="month">Melhor em 30 dias</option><option value="commodity">Commodity A-Z</option></select></label>
      <label className="refinery-check"><input type="checkbox" checked={positiveOnly} onChange={event => setPositiveOnly(event.target.checked)} /> Somente rendimento positivo</label>
      <button type="button" className="refinery-clear-button" onClick={clearFilters} disabled={!commodityQuery && terminalFilter === 'all' && yieldSort === 'value' && !positiveOnly && jobFilter === 'all'}><X size={13}/> Limpar filtros</button>
    </div>
    <div className="refinery-job-filter-row"><span>Jobs da conta</span><button type="button" className={jobFilter === 'all' ? 'active' : ''} onClick={() => setJobFilter('all')}>Todos</button><button type="button" className={jobFilter === 'active' ? 'active' : ''} onClick={() => setJobFilter('active')}>Ativos</button><button type="button" className={jobFilter === 'expired' ? 'active' : ''} onClick={() => setJobFilter('expired')}>Expirados</button><LoadingButton loading={loading} onClick={sync} tone="green">Sincronizar refinarias</LoadingButton></div>
    <ErrorBox error={error} />
    <div className="uex-insights-mini-grid refinery-summary-grid" style={{ marginTop: 14 }}><div className="uex-insights-stat"><span>Métodos</span><strong>{methods.length}</strong><small>{filteredMethods.length} visíveis</small></div><div className="uex-insights-stat"><span>Rendimentos</span><strong>{filteredYields.length}</strong><small>{uniqueCommodities} Commodities · {uniqueTerminals} terminais</small></div><div className="uex-insights-stat"><span>Capacidades</span><strong>{filteredCapacities.length}</strong><small>registros filtrados</small></div><div className="uex-insights-stat"><span>Jobs</span><strong>{filteredJobs.length}</strong><small>{jobFilter === 'all' ? 'todos os estados' : jobFilter === 'active' ? 'ativos' : 'expirados'}</small></div></div>
    {bestYield && <div className="refinery-highlight"><Trophy size={16}/><div><span>Melhor combinação encontrada para o filtro atual</span><strong>{commodityName(bestYield)} · {terminalName(bestYield)}</strong></div><b>+{currentYield(bestYield)}%</b></div>}
    {methods.length > 0 && <div className="refinery-section"><div className="refinery-section-heading"><div><strong>Métodos disponíveis</strong><span>{filteredMethods.length} exibidos · ratings de rendimento, custo e velocidade</span></div></div><div className="uex-insights-card-grid refinery-method-grid">{filteredMethods.map((row, index) => <div className="uex-insights-card refinery-method-card" key={row.id || index}><strong>{methodName(row)}</strong><div><span>Rendimento <b>{row.rating_yield ?? '—'}</b></span><span>Custo <b>{row.rating_cost ?? '—'}</b></span><span>Velocidade <b>{row.rating_speed ?? '—'}</b></span></div></div>)}</div>{filteredMethods.length === 0 && <EmptyState text="Nenhum método corresponde à busca atual." />}</div>}
    <div className="refinery-section"><div className="refinery-section-heading"><div><strong>Melhores rendimentos por terminal</strong><span>Filtre por Commodity e escolha o melhor período para ordenar.</span></div><b>{filteredYields.length} resultados</b></div>{filteredYields.length > 0 ? <div className="uex-insights-table-wrap refinery-table-wrap"><table className="uex-insights-table refinery-table"><thead><tr><th>Commodity</th><th>Terminal</th><th>Atual</th><th>7 dias</th><th>30 dias</th></tr></thead><tbody>{filteredYields.slice(0, 100).map((row, index) => <tr key={row.id || `${commodityName(row)}-${terminalName(row)}-${index}`}><td><strong>{commodityName(row)}</strong></td><td>{terminalName(row)}</td><td><strong className="refinery-current-yield">+{currentYield(row)}%</strong></td><td>+{weekYield(row)}%</td><td>+{monthYield(row)}%</td></tr>)}</tbody></table></div> : <EmptyState text={commodityQuery ? `Nenhum rendimento encontrado para “${commodityQuery}”.` : 'Sincronize as refinarias para carregar os rendimentos.'} />}</div>
    {capacities.length > 0 && <div className="refinery-section"><div className="refinery-section-heading"><div><strong>Capacidades por terminal</strong><span>Capacidades estimadas disponíveis no catálogo UEX.</span></div><b>{filteredCapacities.length} resultados</b></div>{filteredCapacities.length > 0 ? <div className="uex-insights-table-wrap refinery-table-wrap"><table className="uex-insights-table refinery-table"><thead><tr><th>Commodity</th><th>Terminal</th><th>Capacidade</th><th>Detalhe</th></tr></thead><tbody>{filteredCapacities.slice(0, 100).map((row, index) => { const capacity = rawCapacity(row); return <tr key={row.id || index}><td>{commodityName(row)}</td><td>{terminalName(row)}</td><td><strong>{capacity === null || capacity === undefined || capacity === '' ? '—' : Number.isFinite(Number(capacity)) ? `${Number(capacity).toLocaleString('pt-BR')} SCU` : String(capacity)}</strong></td><td>{row.type || row.category || row.description || 'Catálogo UEX'}</td></tr>; })}</tbody></table></div> : <EmptyState text="Nenhuma capacidade corresponde aos filtros atuais." />}</div>}
    {jobs.length > 0 && <div className="refinery-section"><div className="refinery-section-heading"><div><strong>Jobs da conta UEX</strong><span>A consulta de jobs exige token e secret-key configurados.</span></div><b>{filteredJobs.length} resultados</b></div>{filteredJobs.length > 0 ? <div className="uex-insights-table-wrap refinery-table-wrap"><table className="uex-insights-table refinery-table"><thead><tr><th>Terminal</th><th>Método</th><th>Custo</th><th>Duração</th><th>Expiração</th><th>Itens</th></tr></thead><tbody>{filteredJobs.map((row, index) => <tr key={row.id || index}><td>{terminalName(row)}</td><td>{row.id_refinery_method || row.method_name || '—'}</td><td>{formatUec(row.cost)}</td><td>{row.time_minutes ?? '—'} min</td><td>{formatUexDate(row.date_expiration)}</td><td>{Array.isArray(row.items) ? row.items.length : '—'}</td></tr>)}</tbody></table></div> : <EmptyState text="Nenhum job corresponde aos filtros atuais." />}</div>}
  </div>;
}

export default function UexInsightsPage({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('market');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion(value => value + 1);
    window.addEventListener(UEX_INSIGHTS_EVENT, refresh);
    return () => window.removeEventListener(UEX_INSIGHTS_EVENT, refresh);
  }, []);
  void version;
  return <div className="page-shell uex-insights-page" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}>
    <div className="page-header" style={{ marginBottom: 16 }}><div><div className="eyebrow"><Database size={13} /> UEX CORP · INSIGHTS</div><h1>Inteligência UEX</h1><p className="page-subtitle">Mercado por qualidade, análise de oportunidades, histórico de preços e acompanhamento de refinarias em uma única tela. As consultas são manuais e os resultados ficam disponíveis localmente.</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" onClick={() => onNavigate?.('uexapi')} style={buttonStyle('blue')}><SlidersHorizontal size={14} /> UEX API (Live)</button></div></div>
    <div className="uex-insights-tabs">{TABS.map(tab => { const Icon = tab.icon; return <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} className={activeTab === tab.id ? 'active' : ''} style={{ '--tab-color': tab.color }}><Icon size={14} />{tab.label}</button>; })}</div>
    <div className="uex-insights-scroll"><div key={activeTab} className="uex-insights-panel-enter">{activeTab === 'market' && <MarketTab />}{activeTab === 'analysis' && <ProfitAnalysisTab />}{activeTab === 'refineries' && <RefineriesTab />}</div></div>
  </div>;
}
