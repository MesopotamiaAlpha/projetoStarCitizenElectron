import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Anchor, ArrowDownAZ, ArrowUpAZ, BatteryCharging, CalendarDays,
  Check, ChevronDown, ChevronUp, CircleHelp, ExternalLink, Fuel, Gauge, Globe2,
  HandCoins, Info, LandPlot, LayoutGrid, List, Loader2, MapPin, Package, Pencil, Plus, RefreshCw,
  Rocket, Search, Shield, ShoppingCart, Trash2, Truck, Users, X, Zap,
} from 'lucide-react';
import {
  addToMyHangar,
  fetchVehicleLoaners,
  fetchVehicleMarketDetails,
  fetchUserFleet,
  getCatalogStats,
  getPurchaseRows,
  getRentalRows,
  getVehicleRoles,
  loadMyHangar,
  loadVehicleCatalog,
  removeFromMyHangar,
  updateMyHangarEntry,
  getPurchasedAuecTotal,
  getVehiclePurchaseAverage,
  ensureVehicleCatalog,
  UEX_VEHICLES_UPDATED_EVENT,
  VEHICLE_ROLE_LABELS,
} from '../data/uexVehicles';
import { UEX_INSIGHTS_KEYS, saveUexInsight } from '../data/uexInsights';

const HANGAR_VIEW_KEY = 'sc_hangar_view_v1';
const CATALOG_VIEW_KEY = 'sc_hangar_catalog_view_v1';
const OWNED_VIEW_KEY = 'sc_hangar_owned_view_v1';

function loadViewMode(key) {
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'list' || saved === 'cards') return saved;
    const legacy = localStorage.getItem(HANGAR_VIEW_KEY);
    return legacy === 'list' ? 'list' : 'cards';
  } catch { return 'cards'; }
}

const TABS = [
  { id: 'catalog', label: 'Naves UEX', icon: Rocket },
  { id: 'hangar', label: 'Meu Hangar', icon: Anchor },
];

const ROLE_FILTERS = [
  ['is_cargo', 'Carga'],
  ['is_mining', 'Mineração'],
  ['is_salvage', 'Salvamento'],
  ['is_medical', 'Médica'],
  ['is_exploration', 'Exploração'],
  ['is_military', 'Militar'],
  ['is_passenger', 'Passageiros'],
  ['is_ground_vehicle', 'Terrestre'],
];

const COLORS = {
  orange: '#fb923c',
  green: '#34d399',
  blue: '#38bdf8',
  purple: '#a78bfa',
  gold: '#fbbf24',
  red: '#fb7185',
};

function formatNumber(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('pt-BR', { maximumFractionDigits }) : '—';
}

function formatAuec(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `${formatNumber(value)} aUEC`;
}

function getEntryCost(entry) {
  if (!entry || entry.source === 'wikelo') return 0;
  const stored = Number(entry.totalCostAuec);
  const unit = Number(entry.unitPriceAuec ?? entry.purchasePriceAuec ?? entry.priceAuec ?? entry.price_auec);
  if (Number.isFinite(stored) && stored > 0) return Math.max(0, stored);
  const quantity = Math.max(0, Number(entry.quantity) || 0);
  return Number.isFinite(unit) ? Math.max(0, unit * quantity) : 0;
}

function getEntrySourceLabel(entry) {
  return entry?.source === 'wikelo' ? 'Edição Wikelo' : 'Comprada';
}

function formatEntryCost(entry) {
  if (entry?.source === 'wikelo') return 'Sem custo · Wikelo';
  const cost = getEntryCost(entry);
  return cost > 0 ? formatAuec(cost) : 'Custo não informado';
}

function formatDate(value) {
  if (!value) return '—';
  const timestamp = Number(value);
  const date = Number.isFinite(timestamp)
    ? new Date(timestamp < 100000000000 ? timestamp * 1000 : timestamp)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

function safeString(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function UexVehicleImage({ src, alt = '', containerStyle = {}, imageStyle = {}, fallbackColor = COLORS.orange }) {
  const [resolvedSrc, setResolvedSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolvedSrc('');
    setFailed(false);
    if (!src) return () => { cancelled = true; };

    if (window.electronAPI?.uexImage) {
      window.electronAPI.uexImage(src)
        .then(result => {
          if (cancelled) return;
          if (result?.success && result.dataUrl) setResolvedSrc(result.dataUrl);
          else setFailed(true);
        })
        .catch(() => { if (!cancelled) setFailed(true); });
    } else {
      // Fallback para navegador: pode funcionar quando o servidor permitir hotlink.
      setResolvedSrc(src);
    }
    return () => { cancelled = true; };
  }, [src]);

  if (resolvedSrc && !failed) {
    return <img src={resolvedSrc} alt={alt} onError={() => { setResolvedSrc(''); setFailed(true); }} style={imageStyle} />;
  }

  return (
    <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${fallbackColor}77` }} title="Imagem não disponível na UEX">
      <Rocket size={42} />
    </div>
  );
}

function getTypeLabel(vehicle) {
  if (vehicle?.is_ground_vehicle && !vehicle?.is_spaceship) return 'Veículo terrestre';
  if (vehicle?.is_addon) return 'Módulo / addon';
  if (vehicle?.is_concept) return 'Conceito';
  return 'Nave';
}

function getTerminalLabel(row) {
  return row?.terminal_name || row?.space_station_name || row?.city_name || row?.outpost_name || 'Terminal não informado';
}

function uniqueTerminals(rows) {
  return [...new Set((rows || []).map(getTerminalLabel).filter(Boolean))];
}

function Stat({ icon: Icon, label, value, color = COLORS.blue }) {
  return (
    <div style={{ minWidth: 0, padding: '10px 12px', background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-subtle)', borderRadius: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
        <Icon size={12} style={{ color }} />{label}
      </div>
      <strong style={{ display: 'block', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono,monospace', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</strong>
    </div>
  );
}

function MarketLines({ title, icon: Icon, color, rows, kind, onLoadDetails, loadingDetails }) {
  const terminals = uniqueTerminals(rows);
  if (!rows?.length) {
    return (
      <div style={{ padding: '9px 10px', border: '1px dashed var(--border-subtle)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11 }}>
        <Icon size={12} style={{ color, verticalAlign: 'middle', marginRight: 5 }} />{title}: sem registro na sincronização UEX.
      </div>
    );
  }
  const values = rows.map(row => kind === 'rent' ? (row.price_rent_avg ?? row.price_rent) : (row.price_buy_avg ?? row.price_buy)).filter(value => value !== null && value !== undefined);
  const average = values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : null;
  return (
    <div style={{ padding: '9px 10px', border: `1px solid ${color}33`, background: `${color}0b`, borderRadius: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
        <span style={{ color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}><Icon size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />{title}</span>
        <button onClick={onLoadDetails} disabled={loadingDetails} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: loadingDetails ? 'wait' : 'pointer', fontSize: 10 }}>
          {loadingDetails ? <Loader2 size={11} className="spin" /> : <Info size={11} />} detalhes
        </button>
      </div>
      <div style={{ color: 'var(--text-primary)', fontFamily: 'Share Tech Mono,monospace', fontSize: 12, fontWeight: 700 }}>
        Média: {kind === 'rent' ? formatAuec(average) : formatAuec(average)}
      </div>
      <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 10, lineHeight: 1.45 }}>
        {rows.length} registro(s) · {terminals.slice(0, 3).join(' · ')}{terminals.length > 3 ? ` · +${terminals.length - 3}` : ''}
      </div>
    </div>
  );
}

function VehicleDetails({ details, color = COLORS.blue, vehicleId, loaners = [], onLoadLoaners, loadingLoaners = false }) {
  if (!details) return null;
  const purchases = details.purchases || [];
  const rentals = details.rentals || [];
  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        <MapPin size={12} /> Locais e preços detalhados UEX
      </div>
      {details.errors?.length > 0 && <div style={{ color: COLORS.gold, fontSize: 10, marginBottom: 8 }}>Alguns detalhes não puderam ser carregados: {details.errors.join(' · ')}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
        <div>
          <div style={{ color: COLORS.green, fontSize: 10, fontWeight: 700, marginBottom: 5 }}>ONDE COMPRAR</div>
          {purchases.length ? purchases.map((row, index) => (
            <div key={`buy-${row.id || index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 10 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{getTerminalLabel(row)}</span><strong style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatAuec(row.price_buy)}</strong>
            </div>
          )) : <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Sem local de compra informado.</span>}
        </div>
        <div>
          <div style={{ color: COLORS.purple, fontSize: 10, fontWeight: 700, marginBottom: 5 }}>ONDE ALUGAR</div>
          {rentals.length ? rentals.map((row, index) => (
            <div key={`rent-${row.id || index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 10 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{getTerminalLabel(row)}</span><strong style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatAuec(row.price_rent)}</strong>
            </div>
          )) : <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Sem local de aluguel informado.</span>}
        </div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span style={{ color: COLORS.purple, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}><Rocket size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Loaners associados</span><button onClick={onLoadLoaners} disabled={loadingLoaners} style={{ ...secondaryButtonStyle, padding: '5px 8px' }}>{loadingLoaners ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />} Consultar</button></div>
        {loaners.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>{loaners.map((loaner, index) => <span key={loaner.id || loaner.id_vehicle || index} style={{ padding: '4px 6px', color: 'var(--text-secondary)', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 4, fontSize: 10 }}>{loaner.name_full || loaner.name || loaner.vehicle_name || 'Loaner'}</span>)}</div> : <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 10 }}>Clique em consultar para buscar os loaners documentados pela UEX.</div>}
      </div>
    </div>
  );
}

function BuyModal({ vehicle, defaultUnitPriceAuec = null, onClose, onConfirm }) {
  const [quantity, setQuantity] = useState('1');
  const [unitPriceAuec, setUnitPriceAuec] = useState(defaultUnitPriceAuec === null ? '' : String(Math.round(defaultUnitPriceAuec)));
  const [notes, setNotes] = useState('');
  if (!vehicle) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }} onMouseDown={onClose}>
      <div style={{ width: 'min(500px,100%)', background: 'var(--bg-card)', border: '1px solid rgba(251,146,60,0.45)', borderRadius: 10, padding: 18, boxShadow: '0 18px 60px rgba(0,0,0,0.45)' }} onMouseDown={event => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 15 }}>
          <div><div style={{ color: COLORS.orange, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Registrar aquisição</div><h3 style={{ margin: '5px 0 0', color: 'var(--text-primary)', fontFamily: 'Michroma,sans-serif', fontSize: 15 }}>{vehicle.name_full || vehicle.name}</h3></div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
        </div>
        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11 }}>Quantidade<input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} style={inputStyle} /></label>
        <label style={{ display: 'block', marginTop: 9, color: 'var(--text-muted)', fontSize: 11 }}>Preço pago por nave (aUEC)<input type="number" min="0" step="1" value={unitPriceAuec} onChange={event => setUnitPriceAuec(event.target.value)} placeholder={defaultUnitPriceAuec ? `Média UEX: ${formatNumber(defaultUnitPriceAuec)} aUEC` : 'Informe o preço pago'} style={inputStyle} /></label>
        <div style={{ marginTop: 6, color: defaultUnitPriceAuec ? 'var(--accent-green)' : 'var(--text-muted)', fontSize: 10, lineHeight: 1.4 }}>{defaultUnitPriceAuec ? `Média de compra UEX preenchida automaticamente: ${formatAuec(defaultUnitPriceAuec)}. Você pode substituir pelo valor realmente pago.` : 'Não há média de compra disponível no catálogo local. Informe o preço pago para incluir esta nave no total.'} O total será preço por nave × quantidade.</div>
        <label style={{ display: 'block', marginTop: 9, color: 'var(--text-muted)', fontSize: 11 }}>Observações<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Variante ou observações da aquisição" rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={secondaryButtonStyle}>Cancelar</button>
          <button onClick={() => onConfirm({ quantity, unitPriceAuec, notes })} style={primaryButtonStyle}><Check size={13} /> Comprei</button>
        </div>
      </div>
    </div>
  );
}

function WikeloModal({ vehicles = [], onClose, onConfirm }) {
  const [search, setSearch] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const options = useMemo(() => [...(vehicles || [])].sort((a, b) => String(a.name_full || a.name).localeCompare(String(b.name_full || b.name), 'pt-BR')), [vehicles]);
  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? options.filter(vehicle => `${vehicle.name} ${vehicle.name_full || ''} ${vehicle.company_name || ''}`.toLowerCase().includes(term)) : options;
  }, [options, search]);
  const selectedVehicle = options.find(vehicle => String(vehicle.id) === String(vehicleId));
  const canSave = Boolean(selectedVehicle);
  return (
    <div className="hangar-modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }} onMouseDown={onClose}>
      <div className="hangar-modal-panel hangar-wikelo-modal" style={{ width: 'min(560px,100%)', maxHeight: 'calc(100vh - 36px)', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid rgba(162,155,254,0.45)', borderRadius: 10, padding: 18, boxShadow: '0 18px 60px rgba(0,0,0,0.45)' }} onMouseDown={event => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}><div><div style={{ color: '#a29bfe', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Naves do Wikelo · catálogo UEX</div><h3 style={{ margin: '5px 0 0', color: 'var(--text-primary)', fontFamily: 'Michroma,sans-serif', fontSize: 15 }}>Adicionar Edição Wikelo</h3></div><button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button></div>
        {!options.length ? <div style={{ padding: 14, border: '1px dashed rgba(162,155,254,0.35)', borderRadius: 7, color: 'var(--text-muted)', fontSize: 11 }}>O catálogo local está vazio. Sincronize as naves em UEX API (Live) antes de registrar uma Edição Wikelo.</div> : <>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11 }}>Pesquisar no catálogo<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome ou fabricante..." style={inputStyle} /></label>
          <label style={{ display: 'block', marginTop: 9, color: 'var(--text-muted)', fontSize: 11 }}>Escolha a nave *<select value={vehicleId} onChange={event => setVehicleId(event.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}><option value="">Selecione uma nave do catálogo</option>{filteredOptions.map(vehicle => <option key={vehicle.id || vehicle.uuid || vehicle.name} value={vehicle.id}>{vehicle.name_full || vehicle.name}{vehicle.company_name ? ` · ${vehicle.company_name}` : ''}</option>)}</select></label>
          {selectedVehicle && <div className="hangar-wikelo-selected" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: 9, border: '1px solid rgba(162,155,254,0.28)', background: 'rgba(162,155,254,0.08)', borderRadius: 7 }}><UexVehicleImage src={selectedVehicle.url_photo} alt="" containerStyle={{ width: 62, height: 42, borderRadius: 5, background: 'rgba(162,155,254,0.12)' }} imageStyle={{ width: '100%', height: '100%', objectFit: 'cover' }} fallbackColor="#a29bfe" /><div style={{ minWidth: 0 }}><strong style={{ color: 'var(--text-primary)', fontSize: 11 }}>{selectedVehicle.name_full || selectedVehicle.name}</strong><div style={{ marginTop: 3, color: '#a29bfe', fontSize: 10 }}>Edição Wikelo · sem custo aUEC{selectedVehicle.company_name ? ` · ${selectedVehicle.company_name}` : ''}</div></div></div>}
          <label style={{ display: 'block', marginTop: 9, color: 'var(--text-muted)', fontSize: 11 }}>Quantidade<input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} style={inputStyle} /></label>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginTop: 8 }}>Observações<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Favor, recompensa, variante ou origem do Wikelo" rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}><button onClick={onClose} style={secondaryButtonStyle}>Cancelar</button><button disabled={!canSave} onClick={() => canSave && onConfirm({ vehicle: selectedVehicle, quantity, notes })} style={{ ...primaryButtonStyle, background: '#a29bfe', color: '#17152b', opacity: canSave ? 1 : 0.45, cursor: canSave ? 'pointer' : 'not-allowed' }}><StarIcon /> Adicionar Wikelo</button></div>
        </>}
      </div>
    </div>
  );
}

function StarIcon() { return <span style={{ fontSize: 13, lineHeight: 1 }}>★</span>; }

const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '8px 9px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 5, color: 'var(--text-primary)', outline: 'none', fontFamily: '"Exo 2",sans-serif', fontSize: 12 };
const secondaryButtonStyle = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 10px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 5, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 700 };
const primaryButtonStyle = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', background: COLORS.orange, border: 'none', borderRadius: 5, color: '#241406', cursor: 'pointer', fontSize: 11, fontWeight: 800 };

function getPurchasedQuantity(hangar = [], vehicle) {
  const vehicleId = Number(vehicle?.id);
  const vehicleName = String(vehicle?.name_full || vehicle?.name || '').trim().toLowerCase();
  return hangar
    .filter(entry => entry?.source !== 'wikelo')
    .filter(entry => {
      const entryId = Number(entry?.vehicleId);
      if (Number.isFinite(vehicleId) && Number.isFinite(entryId) && entryId > 0) return entryId === vehicleId;
      return String(entry?.vehicleName || '').trim().toLowerCase() === vehicleName;
    })
    .reduce((total, entry) => total + Math.max(0, Number(entry?.quantity) || 0), 0);
}

function VehicleCard({ vehicle, catalog, purchasedQuantity = 0, onBought, expanded, onToggleExpanded, details, onLoadDetails, loadingDetails, loaners, onLoadLoaners, loadingLoaners }) {
  const purchases = getPurchaseRows(catalog, vehicle.id);
  const rentals = getRentalRows(catalog, vehicle.id);
  const roles = getVehicleRoles(vehicle);
  const hasPurchased = purchasedQuantity > 0;
  const purchaseAccent = '#63e6be';
  return (
    <article style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-card)', border: `1px solid ${expanded ? `${COLORS.orange}77` : hasPurchased ? `${purchaseAccent}66` : 'var(--border-subtle)'}`, borderRadius: 9, overflow: 'hidden', boxShadow: hasPurchased ? `0 0 0 1px ${purchaseAccent}22, 0 0 18px ${purchaseAccent}12` : expanded ? `0 0 0 1px ${COLORS.orange}22` : 'none' }}>
      <div style={{ height: 138, background: 'linear-gradient(135deg, rgba(251,146,60,0.14), rgba(56,189,248,0.05))', position: 'relative', overflow: 'hidden' }}>
        <UexVehicleImage src={vehicle.url_photo} alt={vehicle.name_full || vehicle.name} containerStyle={{ width: '100%', height: '100%' }} imageStyle={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
        {hasPurchased && <span style={{ position: 'absolute', top: 9, right: 9, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 7px', borderRadius: 5, background: 'rgba(17,53,48,0.88)', border: `1px solid ${purchaseAccent}77`, color: purchaseAccent, fontFamily: 'Share Tech Mono,monospace', fontSize: 10, fontWeight: 800, boxShadow: `0 0 10px ${purchaseAccent}22` }}><Check size={11} /> x{formatNumber(purchasedQuantity)} comprada{purchasedQuantity === 1 ? '' : 's'}</span>}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(12,17,28,0.95), transparent 70%)' }} />
        <span style={{ position: 'absolute', top: 9, left: 9, padding: '3px 7px', borderRadius: 4, background: 'rgba(7,12,20,0.8)', border: `1px solid ${COLORS.orange}66`, color: COLORS.orange, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>{getTypeLabel(vehicle)}</span>
        <div style={{ position: 'absolute', left: 11, right: 11, bottom: 10 }}><h3 style={{ margin: 0, color: '#fff', fontFamily: 'Michroma,sans-serif', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vehicle.name_full || vehicle.name}</h3><div style={{ marginTop: 3, color: 'rgba(255,255,255,0.65)', fontSize: 10 }}>{vehicle.company_name || 'Fabricante não informado'}</div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 12, flex: 1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{roles.slice(0, 5).map(role => <span key={role} style={{ padding: '3px 5px', borderRadius: 3, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)', color: 'var(--text-secondary)', fontSize: 9 }}>{role}</span>)}{roles.length > 5 && <span style={{ color: 'var(--text-muted)', fontSize: 9, padding: '3px 2px' }}>+{roles.length - 5}</span>}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6 }}>
          <Stat icon={Package} label="Carga" value={vehicle.scu !== null ? `${formatNumber(vehicle.scu, 2)} SCU` : '—'} color={COLORS.gold} />
          <Stat icon={Users} label="Tripulação" value={safeString(vehicle.crew)} color={COLORS.blue} />
          <Stat icon={Gauge} label="Dimensões" value={vehicle.length && vehicle.width && vehicle.height ? `${formatNumber(vehicle.length, 0)}×${formatNumber(vehicle.width, 0)}×${formatNumber(vehicle.height, 0)} m` : '—'} color={COLORS.green} />
          <Stat icon={LandPlot} label="Pad" value={safeString(vehicle.pad_type)} color={COLORS.purple} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <MarketLines title="Compra" icon={ShoppingCart} color={COLORS.green} rows={purchases} kind="buy" onLoadDetails={onLoadDetails} loadingDetails={loadingDetails} />
          <MarketLines title="Aluguel" icon={HandCoins} color={COLORS.purple} rows={rentals} kind="rent" onLoadDetails={onLoadDetails} loadingDetails={loadingDetails} />
        </div>
        {expanded && <VehicleDetails details={details} color={COLORS.orange} vehicleId={vehicle.id} loaners={loaners} onLoadLoaners={onLoadLoaners} loadingLoaners={loadingLoaners} />}
        <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 2 }}>
          <button onClick={onBought} style={{ ...primaryButtonStyle, flex: 1, justifyContent: 'center' }}><Check size={13} /> Comprei</button>
          <button onClick={onToggleExpanded} style={{ ...secondaryButtonStyle, justifyContent: 'center' }} title={expanded ? 'Ocultar detalhes' : 'Ver detalhes'}>{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
          {(vehicle.url_store || vehicle.url_brochure || vehicle.url_hotsite) && <a href={vehicle.url_store || vehicle.url_brochure || vehicle.url_hotsite} target="_blank" rel="noreferrer" style={{ ...secondaryButtonStyle, textDecoration: 'none' }} title="Abrir fonte externa"><ExternalLink size={13} /></a>}
        </div>
      </div>
    </article>
  );
}

function VehicleListRow({ vehicle, catalog, purchasedQuantity = 0, onBought, expanded, onToggleExpanded, details, onLoadDetails, loadingDetails, loaners, onLoadLoaners, loadingLoaners }) {
  const purchases = getPurchaseRows(catalog, vehicle.id);
  const rentals = getRentalRows(catalog, vehicle.id);
  const roles = getVehicleRoles(vehicle);
  const hasPurchased = purchasedQuantity > 0;
  const purchaseAccent = '#63e6be';
  return (
    <article className="hangar-vehicle-list-row" style={{ background: 'var(--bg-card)', border: `1px solid ${hasPurchased ? `${purchaseAccent}66` : 'var(--border-subtle)'}`, borderRadius: 8, boxShadow: hasPurchased ? `0 0 0 1px ${purchaseAccent}18` : 'none' }}>
      <div className="hangar-list-thumb" style={{ position: 'relative', width: 72, height: 48, overflow: 'hidden', borderRadius: 5, background: 'rgba(251,146,60,0.1)' }}><UexVehicleImage src={vehicle.url_photo} alt={vehicle.name_full || vehicle.name} containerStyle={{ width: '100%', height: '100%' }} imageStyle={{ width: '100%', height: '100%', objectFit: 'cover' }} /><span style={{ position: 'absolute', left: 4, bottom: 4, padding: '2px 4px', borderRadius: 3, background: 'rgba(7,12,20,0.82)', color: 'var(--text-secondary)', fontSize: 8, fontWeight: 800 }}>{getTypeLabel(vehicle)}</span></div>
      <div className="hangar-list-main" style={{ minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><strong style={{ color: 'var(--text-primary)', fontFamily: 'Michroma,sans-serif', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vehicle.name_full || vehicle.name}</strong>{hasPurchased && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 5px', borderRadius: 4, background: 'rgba(17,53,48,0.72)', border: `1px solid ${purchaseAccent}66`, color: purchaseAccent, fontFamily: 'Share Tech Mono,monospace', fontSize: 9, fontWeight: 800 }}><Check size={10} /> x{formatNumber(purchasedQuantity)}</span>}</div><div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 10 }}>{vehicle.company_name || 'Fabricante não informado'}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>{roles.slice(0, 3).map(role => <span key={role} style={{ padding: '2px 4px', borderRadius: 3, background: 'rgba(56,189,248,0.08)', color: 'var(--text-muted)', fontSize: 8 }}>{role}</span>)}</div></div>
      <div className="hangar-list-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 5, color: 'var(--text-secondary)', fontSize: 10 }}><span><Package size={10} style={{ verticalAlign: 'middle', marginRight: 3, color: COLORS.gold }} />{vehicle.scu !== null ? `${formatNumber(vehicle.scu, 2)} SCU` : '—'}</span><span><Users size={10} style={{ verticalAlign: 'middle', marginRight: 3, color: COLORS.blue }} />{safeString(vehicle.crew)}</span><span><ShoppingCart size={10} style={{ verticalAlign: 'middle', marginRight: 3, color: COLORS.green }} />{purchases.length} compra{purchases.length === 1 ? '' : 's'}</span><span><HandCoins size={10} style={{ verticalAlign: 'middle', marginRight: 3, color: COLORS.purple }} />{rentals.length} aluguel{rentals.length === 1 ? '' : 'es'}</span></div>
      <div className="hangar-list-market" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, color: 'var(--text-muted)', fontSize: 9 }}><span>Compra: {purchases[0]?.terminal_name || '—'}</span><span>Aluguel: {rentals[0]?.terminal_name || '—'}</span></div>
      <div className="hangar-list-actions" style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}><button onClick={onBought} style={{ ...primaryButtonStyle, padding: '6px 8px' }} title="Registrar compra"><Check size={12} /> Comprei</button><button onClick={onToggleExpanded} style={{ ...secondaryButtonStyle, padding: '6px 8px' }} title={expanded ? 'Ocultar detalhes' : 'Ver detalhes'}>{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>{(vehicle.url_store || vehicle.url_brochure || vehicle.url_hotsite) && <a href={vehicle.url_store || vehicle.url_brochure || vehicle.url_hotsite} target="_blank" rel="noreferrer" style={{ ...secondaryButtonStyle, padding: '6px 8px', textDecoration: 'none' }} title="Abrir fonte externa"><ExternalLink size={12} /></a>}</div>
      {expanded && <div className="hangar-list-details" style={{ gridColumn: '1 / -1' }}><VehicleDetails details={details} color={COLORS.orange} vehicleId={vehicle.id} loaners={loaners} onLoadLoaners={onLoadLoaners} loadingLoaners={loadingLoaners} /></div>}
    </article>
  );
}

function HangarListRow({ entry, onChangeQuantity, onEdit, onRemove }) {
  const wikelo = entry.source === 'wikelo';
  const accent = wikelo ? '#a29bfe' : COLORS.orange;
  return (
    <article className={`hangar-owned-list-row ${wikelo ? 'hangar-wikelo-entry' : 'hangar-purchased-entry'}`} style={{ display: 'grid', gridTemplateColumns: '64px minmax(190px,1fr) minmax(155px,0.8fr) auto', gap: 12, alignItems: 'center', padding: 11, background: 'var(--bg-card)', border: `1px solid ${wikelo ? 'rgba(162,155,254,0.34)' : 'var(--border-subtle)'}`, borderRadius: 8, minWidth: 0 }}>
      <div style={{ width: 64, height: 54, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: wikelo ? 'rgba(162,155,254,0.1)' : 'rgba(251,146,60,0.1)', color: accent }}><UexVehicleImage src={entry.image} alt="" containerStyle={{ width: '100%', height: '100%' }} imageStyle={{ width: '100%', height: '100%', objectFit: 'cover' }} fallbackColor={accent} /></div>
      <div style={{ minWidth: 0 }}><div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}><strong style={{ color: 'var(--text-primary)', fontFamily: 'Michroma,sans-serif', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.vehicleName}</strong><span className="hangar-edition-badge" style={{ background: wikelo ? 'rgba(162,155,254,0.12)' : 'rgba(251,146,60,0.12)', color: accent }}>{getEntrySourceLabel(entry)}</span></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 5, color: 'var(--text-muted)', fontSize: 10 }}><span>{entry.manufacturer || 'Fabricante —'}</span>{entry.scu !== null && <span><Package size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{formatNumber(entry.scu, 2)} SCU</span>}<span><CalendarDays size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{formatDate(entry.acquiredAt)}</span></div>{entry.notes && <div style={{ marginTop: 5, color: 'var(--text-secondary)', fontSize: 10, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.notes}</div>}</div>
      <div className="hangar-owned-row-summary" style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 10 }}><span><strong style={{ color: 'var(--text-primary)' }}>{formatNumber(entry.quantity)}</strong> unidade(s)</span><span style={{ color: wikelo ? '#a29bfe' : 'var(--text-secondary)' }}>{formatEntryCost(entry)}</span></div>
      <div className="hangar-owned-actions" style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}><button onClick={() => onChangeQuantity(Math.max(1, entry.quantity - 1))} style={quantityButtonStyle} title="Diminuir quantidade">−</button><span style={{ minWidth: 28, textAlign: 'center', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono,monospace', fontSize: 13 }}>{entry.quantity}</span><button onClick={() => onChangeQuantity(entry.quantity + 1)} style={quantityButtonStyle} title="Aumentar quantidade">+</button><button onClick={onEdit} style={{ ...quantityButtonStyle, marginLeft: 4 }} title="Editar"><Pencil size={12} /></button><button onClick={onRemove} style={{ ...quantityButtonStyle, color: COLORS.red }} title="Remover"><Trash2 size={12} /></button></div>
    </article>
  );
}

function HangarCard({ entry, onChangeQuantity, onEdit, onRemove }) {
  const wikelo = entry.source === 'wikelo';
  const accent = wikelo ? '#a29bfe' : COLORS.orange;
  return (
    <article className={`hangar-owned-card ${wikelo ? 'hangar-wikelo-entry' : 'hangar-purchased-entry'}`} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', background: 'var(--bg-card)', border: `1px solid ${wikelo ? 'rgba(162,155,254,0.38)' : 'var(--border-subtle)'}`, borderRadius: 9, boxShadow: wikelo ? '0 0 16px rgba(162,155,254,0.08)' : 'none' }}>
      <div style={{ height: 124, position: 'relative', overflow: 'hidden', background: wikelo ? 'linear-gradient(135deg,rgba(162,155,254,0.2),rgba(56,189,248,0.06))' : 'linear-gradient(135deg,rgba(251,146,60,0.16),rgba(56,189,248,0.05))' }}><UexVehicleImage src={entry.image} alt={entry.vehicleName} containerStyle={{ width: '100%', height: '100%' }} imageStyle={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.82 }} fallbackColor={accent} /><div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(12,17,28,0.96),transparent 72%)' }} /><span className="hangar-edition-badge hangar-card-edition" style={{ position: 'absolute', top: 9, left: 9, background: wikelo ? 'rgba(31,25,61,0.9)' : 'rgba(53,30,10,0.9)', color: accent }}>{getEntrySourceLabel(entry)}</span><div style={{ position: 'absolute', left: 11, right: 11, bottom: 10 }}><h3 style={{ margin: 0, color: '#fff', fontFamily: 'Michroma,sans-serif', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.vehicleName}</h3><div style={{ marginTop: 3, color: 'rgba(255,255,255,0.68)', fontSize: 10 }}>{entry.manufacturer || 'Fabricante não informado'}</div></div></div>
      <div style={{ display: 'grid', gap: 8, padding: 12 }}><div className="hangar-owned-card-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6 }}><Stat icon={Package} label="Carga" value={entry.scu !== null ? `${formatNumber(entry.scu, 2)} SCU` : '—'} color={COLORS.gold} /><Stat icon={Anchor} label="Quantidade" value={`${formatNumber(entry.quantity)} unidade(s)`} color={accent} /><Stat icon={CalendarDays} label="Registro" value={formatDate(entry.acquiredAt)} color={COLORS.blue} /><Stat icon={HandCoins} label="Custo" value={wikelo ? '0 aUEC' : formatEntryCost(entry)} color={wikelo ? '#a29bfe' : COLORS.green} /></div>{entry.notes && <div style={{ color: 'var(--text-secondary)', fontSize: 10, lineHeight: 1.45 }}>{entry.notes}</div>}<div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', paddingTop: 2 }}><button onClick={() => onChangeQuantity(Math.max(1, entry.quantity - 1))} style={quantityButtonStyle} title="Diminuir quantidade">−</button><span style={{ minWidth: 28, textAlign: 'center', color: 'var(--text-primary)', fontFamily: 'Share Tech Mono,monospace', fontSize: 13 }}>{entry.quantity}</span><button onClick={() => onChangeQuantity(entry.quantity + 1)} style={quantityButtonStyle} title="Aumentar quantidade">+</button><button onClick={onEdit} style={{ ...secondaryButtonStyle, marginLeft: 'auto', padding: '6px 8px' }}><Pencil size={12} /> Editar</button><button onClick={onRemove} style={{ ...secondaryButtonStyle, padding: '6px 8px', color: COLORS.red, borderColor: 'rgba(251,113,133,0.28)' }}><Trash2 size={12} /> Remover</button></div></div>
    </article>
  );
}

const quantityButtonStyle = { width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)', borderRadius: 4, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 15 };

function EditHangarModal({ entry, onClose, onSave }) {
  const [notes, setNotes] = useState(entry.notes || '');
  const [unitPriceAuec, setUnitPriceAuec] = useState(entry.source === 'wikelo' ? '' : (entry.unitPriceAuec ?? ''));
  const isWikelo = entry.source === 'wikelo';
  return (
    <div className="hangar-modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }} onMouseDown={onClose}>
      <div className="hangar-modal-panel" style={{ width: 'min(470px,100%)', background: 'var(--bg-card)', border: `1px solid ${isWikelo ? 'rgba(162,155,254,0.45)' : 'var(--border-subtle)'}`, borderRadius: 10, padding: 18 }} onMouseDown={event => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}><div><div style={{ color: isWikelo ? '#a29bfe' : COLORS.orange, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>{isWikelo ? 'Edição Wikelo' : 'Compra registrada'}</div><h3 style={{ margin: '4px 0 0', color: 'var(--text-primary)', fontFamily: 'Michroma,sans-serif', fontSize: 14 }}>Editar {entry.vehicleName}</h3></div><button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button></div>
        {!isWikelo && <><label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11 }}>Preço pago por nave (aUEC)<input type="number" min="0" step="1" value={unitPriceAuec} onChange={event => setUnitPriceAuec(event.target.value)} placeholder="Informe para incluir no total gasto" style={inputStyle} /></label><div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: 10 }}>Quantidade atual: {formatNumber(entry.quantity)} · total calculado automaticamente.</div></>}
        {isWikelo && <div style={{ marginBottom: 9, padding: 8, borderRadius: 6, background: 'rgba(162,155,254,0.08)', color: '#c4b5fd', fontSize: 10 }}>Edições Wikelo são gratuitas e nunca entram no contador de aUEC gasto.</div>}
        <label style={{ display: 'block', marginTop: 10, color: 'var(--text-muted)', fontSize: 11 }}>Observações<textarea value={notes} onChange={event => setNotes(event.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} /></label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}><button onClick={onClose} style={secondaryButtonStyle}>Cancelar</button><button onClick={() => onSave({ notes, ...(isWikelo ? { unitPriceAuec: null, totalCostAuec: 0 } : { unitPriceAuec: unitPriceAuec === '' ? null : Number(unitPriceAuec), totalCostAuec: unitPriceAuec === '' ? 0 : Math.max(0, Number(unitPriceAuec) || 0) * Math.max(1, Number(entry.quantity) || 1) }) })} style={primaryButtonStyle}><Check size={13} /> Salvar</button></div>
      </div>
    </div>
  );
}

function UexFleetPanel({ rows, loading, onRefresh, onClose }) {
  return <div style={{ marginBottom: 12, padding: 12, border: '1px solid rgba(167,139,250,0.28)', borderRadius: 9, background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(56,189,248,0.04))' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><div><strong style={{ color: '#c4b5fd', fontSize: 12 }}><Rocket size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Comparar com frota UEX</strong><div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 10 }}>Somente leitura. A frota externa não altera o Meu Hangar local nem os contadores de compras.</div></div><div style={{ display: 'flex', gap: 6 }}><button onClick={onRefresh} disabled={loading} style={{ ...secondaryButtonStyle, padding: '6px 9px' }}>{loading ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />} Atualizar frota</button><button onClick={onClose} style={{ ...secondaryButtonStyle, padding: '6px 8px' }} title="Fechar"><X size={12} /></button></div></div>
    {rows.length > 0 ? <div style={{ marginTop: 10, overflowX: 'auto' }}><table className="uex-insights-table" style={{ minWidth: 610 }}><thead><tr><th>Modelo</th><th>Nome</th><th>Serial</th><th>Organização</th><th>Origem</th></tr></thead><tbody>{rows.slice(0, 40).map((row, index) => <tr key={row.id || index}><td>{row.model_name || row.vehicle_name || '—'}</td><td>{row.name || '—'}</td><td>{row.serial || row.serial_number || '—'}</td><td>{row.organization_name || row.org_name || '—'}</td><td>{row.source || 'UEX'}</td></tr>)}</tbody></table></div> : <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 11 }}>{loading ? 'Consultando a frota autenticada…' : 'Nenhuma frota carregada. Clique em Atualizar frota.'}</div>}
  </div>;
}

export default function ShipHangarPage({ onNavigate }) {
  const [tab, setTab] = useState('catalog');
  const [catalog, setCatalog] = useState(() => loadVehicleCatalog());
  const [hangar, setHangar] = useState(() => loadMyHangar());
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('name');
  const [catalogViewMode, setCatalogViewMode] = useState(() => loadViewMode(CATALOG_VIEW_KEY));
  const [hangarViewMode, setHangarViewMode] = useState(() => loadViewMode(OWNED_VIEW_KEY));
  const [hangarSearch, setHangarSearch] = useState('');
  const [hangarSource, setHangarSource] = useState('all');
  const [hangarSort, setHangarSort] = useState('name');
  const [buyVehicle, setBuyVehicle] = useState(null);
  const [showWikelo, setShowWikelo] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [loanersByVehicle, setLoanersByVehicle] = useState({});
  const [loadingLoaners, setLoadingLoaners] = useState(null);
  const [showUexFleet, setShowUexFleet] = useState(false);
  const [uexFleet, setUexFleet] = useState([]);
  const [loadingFleet, setLoadingFleet] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CATALOG_VIEW_KEY, catalogViewMode);
      localStorage.setItem(OWNED_VIEW_KEY, hangarViewMode);
      localStorage.setItem(HANGAR_VIEW_KEY, catalogViewMode);
    } catch { /* preferência opcional */ }
  }, [catalogViewMode, hangarViewMode]);

  useEffect(() => {
    const handleCatalogUpdated = event => {
      const nextCatalog = event.detail || loadVehicleCatalog();
      if (nextCatalog) {
        setCatalog(nextCatalog);
        setMessage(`Catálogo local atualizado pela UEX API Live: ${(nextCatalog.vehicles || []).length} veículos.`);
      }
    };
    window.addEventListener(UEX_VEHICLES_UPDATED_EVENT, handleCatalogUpdated);
    return () => window.removeEventListener(UEX_VEHICLES_UPDATED_EVENT, handleCatalogUpdated);
  }, []);

  const stats = useMemo(() => getCatalogStats(catalog), [catalog, hangar]);
  const vehicles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = (catalog?.vehicles || []).filter(vehicle => {
      const searchable = `${vehicle.name} ${vehicle.name_full} ${vehicle.company_name || ''} ${vehicle.slug || ''}`.toLowerCase();
      if (normalizedSearch && !searchable.includes(normalizedSearch)) return false;
      if (role !== 'all' && !vehicle[role]) return false;
      if (type === 'spaceship' && !vehicle.is_spaceship) return false;
      if (type === 'ground' && !vehicle.is_ground_vehicle) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === 'cargo') return (Number(b.scu) || 0) - (Number(a.scu) || 0);
      if (sort === 'crew') return String(a.crew || '').localeCompare(String(b.crew || ''), 'pt-BR', { numeric: true });
      return String(a.name_full || a.name).localeCompare(String(b.name_full || b.name), 'pt-BR');
    });
  }, [catalog, role, search, sort, type]);

  const filteredHangar = useMemo(() => {
    const normalizedSearch = hangarSearch.trim().toLowerCase();
    const filtered = (hangar || []).filter(entry => {
      const searchable = `${entry.vehicleName || ''} ${entry.manufacturer || ''} ${entry.notes || ''}`.toLowerCase();
      if (normalizedSearch && !searchable.includes(normalizedSearch)) return false;
      if (hangarSource !== 'all' && entry.source !== hangarSource) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (hangarSort === 'quantity') return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
      if (hangarSort === 'cost') return getEntryCost(b) - getEntryCost(a);
      if (hangarSort === 'date') return new Date(b.acquiredAt || 0).getTime() - new Date(a.acquiredAt || 0).getTime();
      return String(a.vehicleName || '').localeCompare(String(b.vehicleName || ''), 'pt-BR');
    });
  }, [hangar, hangarSearch, hangarSort, hangarSource]);

  const hangarSummary = useMemo(() => ({
    purchasedUnits: (hangar || []).filter(entry => entry.source !== 'wikelo').reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0),
    wikeloUnits: (hangar || []).filter(entry => entry.source === 'wikelo').reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0),
    purchasedTypes: (hangar || []).filter(entry => entry.source !== 'wikelo').length,
    wikeloTypes: (hangar || []).filter(entry => entry.source === 'wikelo').length,
  }), [hangar]);

  const sync = useCallback(async () => {
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await ensureVehicleCatalog();
      if (!result?.vehicles?.length) {
        setError('A UEX não retornou um catálogo de veículos. Verifique a conexão e tente novamente.');
        return;
      }
      setCatalog(result);
      setMessage(result.synced
        ? `Catálogo sincronizado: ${result.vehicles.length} veículos, ${result.purchasePrices?.length || 0} registros de compra e ${result.rentalPrices?.length || 0} registros de aluguel.`
        : `Catálogo local carregado: ${result.vehicles.length} veículos, ${result.purchasePrices?.length || 0} registros de compra e ${result.rentalPrices?.length || 0} registros de aluguel. Nenhuma nova consulta foi feita.`);
    } catch (err) {
      setError(err.message || 'Não foi possível sincronizar o catálogo de veículos da UEX.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Corrige o primeiro acesso: se o catálogo estiver vazio, o Hangar faz a
    // sincronização sem depender da montagem da aba Veículos na UEX Live.
    if (catalog?.vehicles?.length) return undefined;
    sync();
    return undefined;
  }, [catalog?.vehicles?.length, sync]);

  async function loadDetails(vehicleId) {
    if (details[vehicleId]) { setExpandedId(expandedId === vehicleId ? null : vehicleId); return; }
    setExpandedId(vehicleId); setLoadingDetails(vehicleId); setError('');
    try { const value = await fetchVehicleMarketDetails(vehicleId); setDetails(previous => ({ ...previous, [vehicleId]: value })); }
    catch (err) { setError(err.message || 'Não foi possível carregar os detalhes de mercado.'); }
    finally { setLoadingDetails(null); }
  }

  async function loadLoaners(vehicleId) {
    setLoadingLoaners(vehicleId); setError('');
    try {
      const rows = await fetchVehicleLoaners(vehicleId);
      setLoanersByVehicle(previous => ({ ...previous, [vehicleId]: rows }));
      saveUexInsight(UEX_INSIGHTS_KEYS.loaners, rows, { endpoint: 'vehicles_loaners', ttl: '12h' });
      setMessage(`${rows.length} loaner${rows.length === 1 ? '' : 's'} encontrado${rows.length === 1 ? '' : 's'} para o veículo.`);
    } catch (err) { setError(err.message || 'Não foi possível consultar os loaners.'); }
    finally { setLoadingLoaners(null); }
  }

  async function loadUexFleet() {
    setLoadingFleet(true); setError('');
    try {
      const rows = await fetchUserFleet();
      setUexFleet(rows);
      saveUexInsight(UEX_INSIGHTS_KEYS.fleet, rows, { endpoint: 'fleet', ttl: 'realtime' });
      setMessage(`Frota UEX carregada em modo somente leitura: ${rows.length} registro${rows.length === 1 ? '' : 's'}.`);
    } catch (err) { setError(err.message || 'Não foi possível consultar a frota UEX.'); }
    finally { setLoadingFleet(false); }
  }

  function confirmBought(vehicle, options) {
    const catalogAverage = getVehiclePurchaseAverage(catalog, vehicle.id);
    const typedPrice = options?.unitPriceAuec;
    const effectivePrice = typedPrice === '' || typedPrice === null || typedPrice === undefined
      ? catalogAverage
      : Number(typedPrice);
    const next = addToMyHangar(vehicle, { ...options, unitPriceAuec: Number.isFinite(effectivePrice) ? effectivePrice : null, source: 'compra' });
    setHangar(next); setBuyVehicle(null);
    setMessage(`${vehicle.name_full || vehicle.name} foi adicionada ao Meu Hangar${Number.isFinite(effectivePrice) ? ` com custo de ${formatAuec(effectivePrice)} por nave.` : ', mas sem preço de compra informado.'}`);
  }

  function confirmWikelo(options) {
    const vehicle = options?.vehicle;
    if (!vehicle) return;
    const next = addToMyHangar(vehicle, { source: 'wikelo', quantity: options.quantity, notes: options.notes });
    setHangar(next); setShowWikelo(false); setTab('hangar'); setMessage(`${vehicle.name_full || vehicle.name} foi adicionada ao Meu Hangar como Edição Wikelo, sem custo aUEC.`);
  }

  function changeQuantity(entry, quantity) { setHangar(updateMyHangarEntry(entry.id, { quantity })); }
  function saveEntry(entry, changes) { setHangar(updateMyHangarEntry(entry.id, changes)); setEditEntry(null); }
  function removeEntry(entry) { if (window.confirm(`Remover ${entry.vehicleName} do Meu Hangar?`)) setHangar(removeFromMyHangar(entry.id)); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="page-header" style={{ flexShrink: 0 }}><div><div className="page-title">HANGAR DE NAVES</div><div className="page-subtitle">Catálogo UEX de veículos, locais de compra/aluguel e controle das suas naves</div></div><button onClick={sync} disabled={loading} style={{ ...secondaryButtonStyle, padding: '8px 11px' }}>{loading ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />} Recarregar dados locais</button></div>
      {(error || message) && <div style={{ margin: '0 14px 10px', padding: '9px 12px', borderRadius: 6, fontSize: 11, lineHeight: 1.5, background: error ? 'rgba(251,113,133,0.08)' : 'rgba(52,211,153,0.08)', border: `1px solid ${error ? 'rgba(251,113,133,0.28)' : 'rgba(52,211,153,0.28)'}`, color: error ? COLORS.red : COLORS.green, display: 'flex', alignItems: 'flex-start', gap: 8 }}><Info size={13} style={{ flexShrink: 0, marginTop: 2 }} /><span style={{ flex: 1 }}>{error || message}</span><button onClick={() => { setError(''); setMessage(''); }} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer' }}><X size={13} /></button></div>}
      <div style={{ padding: '0 14px 12px', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 7, marginBottom: 12 }}><Stat icon={Rocket} label="Catálogo" value={stats.vehicles} color={COLORS.orange} /><Stat icon={Package} label="Naves" value={stats.spaceships} color={COLORS.blue} /><Stat icon={ShoppingCart} label="Compras UEX" value={stats.purchaseOffers} color={COLORS.green} /><Stat icon={HandCoins} label="Aluguéis UEX" value={stats.rentalOffers} color={COLORS.purple} /><Stat icon={Anchor} label="Meu Hangar" value={`${stats.ownedUnits} unidade(s)`} color={COLORS.gold} /><Stat icon={HandCoins} label="Gasto em compras" value={formatAuec(stats.purchasedAuecTotal)} color={COLORS.green} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>{TABS.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 5, border: `1px solid ${tab === id ? `${COLORS.orange}77` : 'var(--border-subtle)'}`, background: tab === id ? 'rgba(251,146,60,0.12)' : 'transparent', color: tab === id ? COLORS.orange : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}><Icon size={13} />{label}{id === 'hangar' && <span style={{ fontFamily: 'Share Tech Mono,monospace' }}>{stats.ownedUnits}</span>}</button>)}{catalog?.syncedAt && <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 10 }}>Última sincronização: {formatDate(catalog.syncedAt)}</span>}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 18px' }}>
        {tab === 'catalog' ? (
          <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><button onClick={() => { setShowUexFleet(value => !value); if (!showUexFleet && !uexFleet.length) loadUexFleet(); }} style={{ ...secondaryButtonStyle, padding: '6px 9px', color: '#c4b5fd', borderColor: 'rgba(167,139,250,0.3)' }}><Rocket size={12} /> {showUexFleet ? 'Ocultar frota UEX' : 'Comparar com frota UEX'}</button></div>
            {showUexFleet && <UexFleetPanel rows={uexFleet} loading={loadingFleet} onRefresh={loadUexFleet} onClose={() => setShowUexFleet(false)} />}
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}><div style={{ flex: '1 1 220px', position: 'relative' }}>
<Search size={14} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-muted)' }} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar nave, fabricante ou slug..." style={{ ...inputStyle, marginTop: 0, paddingLeft: 29 }} /></div><select value={type} onChange={event => setType(event.target.value)} style={{ ...inputStyle, marginTop: 0, width: 150 }}><option value="all">Todos os veículos</option><option value="spaceship">Somente naves</option><option value="ground">Somente terrestres</option></select><select value={role} onChange={event => setRole(event.target.value)} style={{ ...inputStyle, marginTop: 0, width: 145 }}><option value="all">Todas as funções</option>{ROLE_FILTERS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button onClick={() => setSort(sort === 'name' ? 'cargo' : sort === 'cargo' ? 'crew' : 'name')} style={{ ...secondaryButtonStyle, height: 32 }} title="Alterar ordenação">{sort === 'name' ? <ArrowDownAZ size={13} /> : sort === 'cargo' ? <Package size={13} /> : <Users size={13} />} {sort === 'name' ? 'Nome' : sort === 'cargo' ? 'Carga' : 'Tripulação'}</button><div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, border: '1px solid var(--border-subtle)', borderRadius: 5, marginLeft: 'auto' }}><button onClick={() => setCatalogViewMode('cards')} style={{ ...secondaryButtonStyle, padding: '6px 8px', border: 'none', background: catalogViewMode === 'cards' ? 'rgba(56,189,248,0.14)' : 'transparent', color: catalogViewMode === 'cards' ? 'var(--accent-primary)' : 'var(--text-muted)' }} title="Visualização em cards"><LayoutGrid size={13} /> Cards</button><button onClick={() => setCatalogViewMode('list')} style={{ ...secondaryButtonStyle, padding: '6px 8px', border: 'none', background: catalogViewMode === 'list' ? 'rgba(56,189,248,0.14)' : 'transparent', color: catalogViewMode === 'list' ? 'var(--accent-primary)' : 'var(--text-muted)' }} title="Visualização em lista"><List size={13} /> Lista</button></div></div>
            {!catalog?.vehicles?.length ? <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: 9 }}><Rocket size={42} style={{ opacity: 0.25, marginBottom: 10 }} /><div style={{ fontFamily: 'Michroma,sans-serif', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 7 }}>CATÁLOGO AINDA NÃO SINCRONIZADO</div><p style={{ maxWidth: 470, margin: '0 auto 14px', fontSize: 12, lineHeight: 1.6 }}>Primeiro sincronize a aba <strong>UEX API (Live) → Veículos</strong>. O Hangar reutiliza o catálogo salvo localmente, incluindo carga, fabricantes, características, compra e aluguel.</p><button onClick={() => onNavigate ? onNavigate('uexapi') : sync()} style={primaryButtonStyle}><Globe2 size={13} /> Abrir UEX API (Live)</button></div> : <><div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 8 }}>{vehicles.length} veículo(s) exibido(s) · os preços são dados comunitários da UEX e podem variar por patch</div>{catalogViewMode === 'cards' ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,330px),1fr))', gap: 10 }}>{vehicles.map(vehicle => <VehicleCard key={vehicle.id || vehicle.uuid || vehicle.name} vehicle={vehicle} catalog={catalog} purchasedQuantity={getPurchasedQuantity(hangar, vehicle)} onBought={() => setBuyVehicle(vehicle)} expanded={expandedId === vehicle.id} onToggleExpanded={() => loadDetails(vehicle.id)} details={details[vehicle.id]} onLoadDetails={() => loadDetails(vehicle.id)} loadingDetails={loadingDetails === vehicle.id} loaners={loanersByVehicle[vehicle.id] || []} onLoadLoaners={() => loadLoaners(vehicle.id)} loadingLoaners={loadingLoaners === vehicle.id} />)}</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{vehicles.map(vehicle => <VehicleListRow key={vehicle.id || vehicle.uuid || vehicle.name} vehicle={vehicle} catalog={catalog} purchasedQuantity={getPurchasedQuantity(hangar, vehicle)} onBought={() => setBuyVehicle(vehicle)} expanded={expandedId === vehicle.id} onToggleExpanded={() => loadDetails(vehicle.id)} details={details[vehicle.id]} onLoadDetails={() => loadDetails(vehicle.id)} loadingDetails={loadingDetails === vehicle.id} loaners={loanersByVehicle[vehicle.id] || []} onLoadLoaners={() => loadLoaners(vehicle.id)} loadingLoaners={loadingLoaners === vehicle.id} />)}</div>}</>}
          </>
        ) : (
          <div className="hangar-owned-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}><div><h2 style={{ margin: 0, color: 'var(--text-primary)', fontFamily: 'Michroma,sans-serif', fontSize: 15 }}>MEU HANGAR</h2><div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Naves compradas e Edições Wikelo usando o mesmo catálogo normal.</div></div><button onClick={() => setShowWikelo(true)} style={{ ...primaryButtonStyle, background: '#a29bfe', color: '#17152b' }}><Plus size={13} /> Naves do Wikelo</button></div>
            <div className="hangar-owned-kpis"><div><span>Gasto registrado em compras</span><strong>{formatAuec(stats.purchasedAuecTotal)}</strong><small>Naves do Wikelo não entram neste total</small></div><div><span>Unidades compradas</span><strong>{formatNumber(hangarSummary.purchasedUnits)}</strong><small>{hangarSummary.purchasedTypes} tipo(s) com origem compra</small></div><div className="hangar-wikelo-kpi"><span>Edições Wikelo</span><strong>{formatNumber(hangarSummary.wikeloUnits)}</strong><small>{hangarSummary.wikeloTypes} tipo(s) sem custo aUEC</small></div></div>
            <div className="hangar-owned-toolbar"><div className="hangar-owned-search"><Search size={14} /><input value={hangarSearch} onChange={event => setHangarSearch(event.target.value)} placeholder="Filtrar nave, fabricante ou observação..." /></div><select value={hangarSource} onChange={event => setHangarSource(event.target.value)}><option value="all">Todas as origens</option><option value="compra">Somente compradas</option><option value="wikelo">Somente Edição Wikelo</option></select><select value={hangarSort} onChange={event => setHangarSort(event.target.value)}><option value="name">Ordenar por nome</option><option value="quantity">Maior quantidade</option><option value="cost">Maior custo registrado</option><option value="date">Mais recentes</option></select><div className="hangar-view-toggle"><button onClick={() => setHangarViewMode('cards')} className={hangarViewMode === 'cards' ? 'active' : ''} title="Visualização em cards"><LayoutGrid size={13} /> Cards</button><button onClick={() => setHangarViewMode('list')} className={hangarViewMode === 'list' ? 'active' : ''} title="Visualização em lista"><List size={13} /> Lista</button></div></div>
            {!hangar.length ? <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: 9 }}><Anchor size={42} style={{ opacity: 0.25, marginBottom: 10 }} /><div style={{ fontFamily: 'Michroma,sans-serif', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 7 }}>SEU HANGAR ESTÁ VAZIO</div><p style={{ maxWidth: 470, margin: '0 auto', fontSize: 12, lineHeight: 1.6 }}>Na aba <strong>Naves UEX</strong>, clique em <strong>Comprei</strong> em uma nave para registrá-la. Para uma recompensa do Wikelo, use <strong>Naves do Wikelo</strong>.</p></div> : !filteredHangar.length ? <div className="hangar-empty-filter">Nenhuma nave corresponde aos filtros atuais.</div> : <><div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 8 }}>{filteredHangar.length} registro(s) exibido(s) de {hangar.length} · custo calculado apenas para compras com preço informado</div>{hangarViewMode === 'cards' ? <div className="hangar-owned-grid">{filteredHangar.map(entry => <HangarCard key={entry.id} entry={entry} onChangeQuantity={quantity => changeQuantity(entry, quantity)} onEdit={() => setEditEntry(entry)} onRemove={() => removeEntry(entry)} />)}</div> : <div className="hangar-owned-list">{filteredHangar.map(entry => <HangarListRow key={entry.id} entry={entry} onChangeQuantity={quantity => changeQuantity(entry, quantity)} onEdit={() => setEditEntry(entry)} onRemove={() => removeEntry(entry)} />)}</div>}</>}
          </div>
        )}
      </div>
      {buyVehicle && <BuyModal vehicle={buyVehicle} defaultUnitPriceAuec={getVehiclePurchaseAverage(catalog, buyVehicle.id)} onClose={() => setBuyVehicle(null)} onConfirm={options => confirmBought(buyVehicle, options)} />}
      {showWikelo && <WikeloModal vehicles={catalog?.vehicles || []} onClose={() => setShowWikelo(false)} onConfirm={confirmWikelo} />}
      {editEntry && <EditHangarModal entry={editEntry} onClose={() => setEditEntry(null)} onSave={changes => saveEntry(editEntry, changes)} />}
    </div>
  );
}
