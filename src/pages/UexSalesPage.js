import React, { useState, useMemo, useCallback, useEffect, useDeferredValue } from 'react';
import {
  TrendingUp, TrendingDown, RefreshCw, Plus, Edit3, Trash2,
  Save, X, Search, Package, DollarSign, BarChart3, ShoppingBag,
  CheckCircle2, AlertTriangle, Archive, Star, Eye, ChevronDown,
  ChevronUp, Globe, Clock, Minus, Info, ExternalLink, MapPin, Filter
} from 'lucide-react';
import {
  loadUexSales, saveUexSales, loadUexCatalog, saveUexCatalog,
} from '../data/uexSales';
import { normalizeUexItemName } from '../data/uexItemsDB';
import { buildUexListingUrl } from '../data/uexNegotiations';
import { buildManagedLocationOptions, LOCATIONS_UPDATED_EVENT } from '../data/locations';
import { INVENTORY_UPDATED_EVENT } from '../data/inventoryEvents';
import { loadVault, consumeVaultEntries } from '../data/oreVault';
import { CARGO_UNITS, isCargoUnit, areCargoUnitsCompatible, normalizeCargoUnit, cargoEquivalentTotal, toCargoBase } from '../data/cargoUnits';
import { recommendDiscount, extractActiveCompetitorPrices } from '../data/uexDiscount';

// ── Storage ───────────────────────────────────────────────────────────────────
const TOKEN_KEY    = 'sc_uex_token_v1';
const USERNAME_KEY = 'sc_uex_username_v1';

function loadToken()    { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
function loadUsername() { try { return localStorage.getItem(USERNAME_KEY) || ''; } catch { return ''; } }
function saveUsername(u){ localStorage.setItem(USERNAME_KEY, u); }
const loadSales = loadUexSales;
const saveSales = saveUexSales;
const loadCatalog = loadUexCatalog;
const saveCatalog = saveUexCatalog;

// ── UEX API ───────────────────────────────────────────────────────────────────
const UEX_BASE = 'https://api.uexcorp.uk/2.0';

async function uexFetch(endpoint, token = '') {
  const t = token || loadToken();
  if (window.electronAPI?.uexFetch) {
    const result = await window.electronAPI.uexFetch({ endpoint, token: t });
    if (result.success) return result.data;
    throw new Error(result.message || 'Erro na API');
  }
  const url = `${UEX_BASE}/${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'ok') throw new Error(json.message || json.status);
  return json.data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ptMoney(v)  { return Number(v||0).toLocaleString('pt-BR', { minimumFractionDigits:0, maximumFractionDigits:0 }); }
function ptDecimal(v){ return Number(v||0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
function toTimestampMs(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim()))) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric < 100000000000 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function ptDate(ts)  {
  const ms = toTimestampMs(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function ptDateTime(ts) {
  const ms = toTimestampMs(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function daysSince(ts) {
  const ms = toTimestampMs(ts);
  if (!ms) return 0;
  return Math.floor((Date.now() - ms) / 86400000);
}

function normalizeInventoryName(value) {
  return normalizeUexItemName(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function getInventoryReservedQuantity(item) {
  let rows = item?.reservations;
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows); } catch { rows = []; }
  }
  if (!Array.isArray(rows)) rows = [];
  const total = Math.max(0, Number(item?.quantity) || 0);
  const reserved = rows.reduce((sum, row) => sum + Math.max(0, Number(row?.quantity ?? row?.amount) || 0), 0);
  return Math.min(total, reserved);
}

function getInventoryAvailableQuantity(item) {
  return Math.max(0, (Number(item?.quantity) || 0) - getInventoryReservedQuantity(item));
}

function getCatalogListingTarget(item = {}) {
  const directUrl = [
    item.listing_url,
    item.listingUrl,
    item.source_listing_url,
    item.sourceListingUrl,
    item.url,
    item.link,
  ].map(value => String(value || '').trim()).find(value => /^https?:\/\//i.test(value));
  if (directUrl) return { url: directUrl, exact: true };

  const slug = item.listing_slug || item.listingSlug || item.source_listing_slug || item.sourceListingSlug || item.slug;
  if (slug) return { url: buildUexListingUrl(slug), exact: true };

  const title = String(item.title || '').trim();
  return {
    url: title ? `https://uexcorp.space/marketplace/home/?search=${encodeURIComponent(title)}` : 'https://uexcorp.space/marketplace/',
    exact: false,
  };
}

function normalizeMarketSlug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function findMarketTrendForItem(item, trendData = []) {
  const targetName = normalizeInventoryName(item?.title);
  const targetSlug = normalizeMarketSlug(item?.item_slug || item?.slug);
  const targetId = item?.id_item ?? item?.uex_item_id;
  const rows = Array.isArray(trendData) ? trendData : [];
  if (targetId !== null && targetId !== undefined && String(targetId).trim()) {
    const byId = rows.find(row => String(row?.id_item ?? row?.uex_item_id ?? '').trim() === String(targetId).trim());
    if (byId) return byId;
  }
  if (targetSlug) {
    const bySlug = rows.find(row => normalizeMarketSlug(row?.item_slug || row?.slug) === targetSlug);
    if (bySlug) return bySlug;
  }
  if (!targetName) return null;
  return rows.find(row => normalizeInventoryName(row?.item_name || row?.name) === targetName) || null;
}

function inventoryLocationKey(item) {
  return `${String(item?.system || 'Outro').trim()}::${String(item?.location_type || 'Outros').trim()}::${String(item?.location_name || 'Local não informado').trim()}`;
}

function getInventoryBinding(item) {
  const raw = item?.inventory_binding || {};
  // Compatibilidade: versões antigas guardavam `locationKey` singular.
  // A leitura converte automaticamente o formato antigo para a lista nova.
  const candidates = [
    ...(Array.isArray(raw.locationKeys) ? raw.locationKeys : []),
    ...(Array.isArray(raw.location_keys) ? raw.location_keys : []),
    ...(Array.isArray(raw.locations) ? raw.locations : []),
    ...(raw.locationKey ? [raw.locationKey] : []),
  ];
  const locationKeys = [...new Set(candidates.map(key => String(key || '').trim()).filter(Boolean))];
  const armorPieceIds = [...new Set((Array.isArray(raw.armorPieceIds) ? raw.armorPieceIds : Array.isArray(raw.armor_piece_ids) ? raw.armor_piece_ids : []).map(id => String(id || '').trim()).filter(Boolean))];
  const armorSetIds = [...new Set((Array.isArray(raw.armorSetIds) ? raw.armorSetIds : Array.isArray(raw.armor_set_ids) ? raw.armor_set_ids : []).map(id => String(id || '').trim()).filter(Boolean))];
  return { locationKeys, armorPieceIds, armorSetIds, linked: locationKeys.length > 0 || armorPieceIds.length > 0 || armorSetIds.length > 0, updatedAt: raw.updatedAt || null };
}

function getVaultBinding(item) {
  const raw = item?.vault_binding || {};
  const entryIds = Array.isArray(raw.entryIds)
    ? [...new Set(raw.entryIds.map(id => String(id || '').trim()).filter(Boolean))]
    : [];
  const boxUnit = normalizeCargoUnit(raw.boxUnit || 'un');
  const boxQuantity = Number(raw.boxQuantity);
  return {
    entryIds,
    boxUnit,
    boxQuantity: Number.isFinite(boxQuantity) && boxQuantity > 0 ? boxQuantity : 1,
    quality: raw.quality || '',
    linked: entryIds.length > 0,
    updatedAt: raw.updatedAt || null,
  };
}

function vaultEntryLabel(entry) {
  const quality = String(entry?.quality || '').trim() || 'Qualidade não informada';
  const location = String(entry?.location || '').trim() || 'Local não informado';
  return `${quality} · ${location}`;
}

function getVaultStockSummary(listing, vaultEntries = []) {
  const name = normalizeInventoryName(listing?.title);
  const matches = (Array.isArray(vaultEntries) ? vaultEntries : [])
    .filter(entry => normalizeInventoryName(entry?.ore_name) === name);
  const binding = getVaultBinding(listing);
  const selected = matches.filter(entry => binding.entryIds.includes(String(entry.id)));
  const unitsCompatible = selected.length > 0 && selected.every(entry => isCargoUnit(binding.boxUnit)
    ? areCargoUnitsCompatible(entry.unit, binding.boxUnit)
    : normalizeCargoUnit(entry.unit || 'un') === binding.boxUnit);
  const total = selected.length && unitsCompatible
    ? cargoEquivalentTotal(selected, binding.boxUnit).total
    : selected.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
  const boxBase = isCargoUnit(binding.boxUnit) ? toCargoBase(binding.boxQuantity, binding.boxUnit) : binding.boxQuantity;
  const stockBase = isCargoUnit(binding.boxUnit) ? toCargoBase(total, binding.boxUnit) : total;
  const boxesAvailable = boxBase > 0 && unitsCompatible ? Math.floor((stockBase + 1e-9) / boxBase) : 0;
  return {
    name,
    matches,
    selected,
    binding,
    hasMatch: matches.length > 0,
    isLinked: binding.linked && selected.length > 0,
    unitsCompatible,
    total,
    boxesAvailable,
    boxesAfterListing: boxesAvailable - Math.max(0, Number(listing?.in_stock) || 0),
  };
}

function VaultStockLinkModal({ listing, vaultEntries, onSave, onClose }) {
  const summary = getVaultStockSummary(listing, vaultEntries);
  const [selectedIds, setSelectedIds] = useState(() => summary.binding.entryIds);
  const [boxQuantity, setBoxQuantity] = useState(String(summary.binding.boxQuantity || 1));
  const [boxUnit, setBoxUnit] = useState(summary.binding.linked ? summary.binding.boxUnit : normalizeCargoUnit(summary.matches[0]?.unit || 'un'));
  const selectedEntries = summary.matches.filter(entry => selectedIds.includes(String(entry.id)));
  const selectedTotal = selectedEntries.length && (isCargoUnit(boxUnit) ? selectedEntries.every(entry => isCargoUnit(entry.unit)) : selectedEntries.every(entry => normalizeCargoUnit(entry.unit || 'un') === boxUnit))
    ? cargoEquivalentTotal(selectedEntries, boxUnit).total
    : selectedEntries.reduce((total, entry) => total + (Number(entry.quantity) || 0), 0);
  const numericBoxQuantity = Number(String(boxQuantity).replace(',', '.')) || 0;
  const boxesAvailable = numericBoxQuantity > 0 && selectedEntries.length
    ? (isCargoUnit(boxUnit) ? Math.floor((toCargoBase(selectedTotal, boxUnit) + 1e-9) / toCargoBase(numericBoxQuantity, boxUnit)) : Math.floor(selectedTotal / numericBoxQuantity))
    : 0;

  function toggleEntry(entry) {
    const id = String(entry.id);
    setSelectedIds(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
  }

  function handleSave() {
    if (!selectedIds.length || numericBoxQuantity <= 0) return;
    const qualities = [...new Set(selectedEntries.map(entry => String(entry.quality || '').trim()).filter(Boolean))];
    onSave({ entryIds: selectedIds, boxQuantity: numericBoxQuantity, boxUnit: normalizeCargoUnit(boxUnit), quality: qualities.length === 1 ? qualities[0] : qualities.join(' + '), updatedAt: new Date().toISOString() });
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1350, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div style={{ width:'min(650px,100%)', maxHeight:'92vh', overflowY:'auto', background:'var(--bg-card)', border:'1px solid rgba(52,211,153,0.36)', borderRadius:12, padding:18, boxShadow:'0 24px 80px rgba(0,0,0,0.7)' }} onMouseDown={event => event.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:12 }}>
          <div>
            <div style={{ fontSize:9, fontWeight:800, color:'var(--accent-green)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Vínculo com o Baú de Minério</div>
            <h3 style={{ margin:'5px 0 0', color:'var(--text-primary)', fontFamily:'Michroma,sans-serif', fontSize:15 }}>{listing.title}</h3>
            <div style={{ marginTop:4, color:'var(--text-muted)', fontSize:11 }}>Selecione a qualidade e os locais exatos que fornecem cada caixa anunciada.</div>
          </div>
          <button onClick={onClose} title="Fechar" style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid var(--border-subtle)', borderRadius:5, background:'transparent', color:'var(--text-muted)', cursor:'pointer' }}><X size={14}/></button>
        </div>

        {!summary.hasMatch ? (
          <div style={{ padding:12, border:'1px solid rgba(251,191,36,0.28)', background:'rgba(251,191,36,0.07)', borderRadius:7, color:'var(--accent-gold)', fontSize:11, lineHeight:1.55 }}>Este minério ainda não existe no Baú. Cadastre primeiro a quantidade, a unidade, a qualidade e o local no Baú de Minério.</div>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <div>
                <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>Quantidade por caixa</label>
                <input type="text" inputMode="decimal" value={boxQuantity} onChange={event => setBoxQuantity(event.target.value)} style={{ width:'100%', boxSizing:'border-box', padding:'7px 9px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:12, outline:'none' }}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>Unidade da caixa</label>
                <select value={boxUnit} onChange={event => setBoxUnit(event.target.value)} style={{ width:'100%', boxSizing:'border-box', padding:'7px 9px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:12, outline:'none' }}>
                  <option value="un">un</option>
                  {CARGO_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom:10 }}>
              <div style={{ padding:'8px 9px', border:'1px solid rgba(52,211,153,0.2)', background:'rgba(52,211,153,0.06)', borderRadius:6 }}><div style={{ fontSize:9, color:'var(--text-muted)' }}>Estoque selecionado</div><strong style={{ color:'var(--accent-green)', fontFamily:'Share Tech Mono,monospace', fontSize:12 }}>{selectedTotal} {boxUnit}</strong></div>
              <div style={{ padding:'8px 9px', border:'1px solid rgba(56,189,248,0.2)', background:'rgba(56,189,248,0.05)', borderRadius:6 }}><div style={{ fontSize:9, color:'var(--text-muted)' }}>Caixas possíveis</div><strong style={{ color:'var(--accent-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:12 }}>{boxesAvailable}</strong></div>
              <div style={{ padding:'8px 9px', border:'1px solid rgba(251,191,36,0.2)', background:'rgba(251,191,36,0.05)', borderRadius:6 }}><div style={{ fontSize:9, color:'var(--text-muted)' }}>Qualidade</div><strong style={{ color:'var(--accent-gold)', fontSize:11 }}>{[...new Set(selectedEntries.map(entry => String(entry.quality || '').trim()).filter(Boolean))].join(' + ') || '—'}</strong></div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {summary.matches.map(entry => {
                const selected = selectedIds.includes(String(entry.id));
                return <label key={entry.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 10px', border:`1px solid ${selected ? 'rgba(52,211,153,0.45)' : 'var(--border-subtle)'}`, background:selected ? 'rgba(52,211,153,0.09)' : 'rgba(255,255,255,0.02)', borderRadius:7, cursor:'pointer' }}>
                  <input type="checkbox" checked={selected} onChange={() => toggleEntry(entry)} />
                  <span style={{ flex:1, minWidth:0, color:'var(--text-secondary)', fontSize:11 }}><strong style={{ color:'var(--accent-gold)' }}>{entry.quality || 'Qualidade não informada'}</strong> · {entry.location || 'Local não informado'}</span>
                  <strong style={{ color:'var(--text-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:12 }}>{entry.quantity} {entry.unit || 'un'}</strong>
                </label>;
              })}
            </div>
            <div style={{ marginTop:9, color:'var(--text-muted)', fontSize:10, lineHeight:1.45 }}>Para minérios em SCU/cSCU/mSCU/μSCU, a quantidade acima representa uma caixa. Para Sadaryx e outros registros em `un`, cada caixa equivale a uma unidade.</div>
          </>
        )}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:7, marginTop:15 }}>
          <button onClick={onClose} style={{ padding:'7px 12px', border:'1px solid var(--border-subtle)', borderRadius:5, background:'transparent', color:'var(--text-secondary)', cursor:'pointer', fontSize:11, fontWeight:700 }}>Cancelar</button>
          {summary.binding.linked && <button onClick={() => onSave(null)} style={{ padding:'7px 12px', border:'1px solid rgba(251,113,133,0.28)', borderRadius:5, background:'rgba(251,113,133,0.07)', color:'var(--accent-red)', cursor:'pointer', fontSize:11, fontWeight:700 }}>Remover vínculo</button>}
          <button onClick={handleSave} disabled={!summary.hasMatch || !selectedIds.length || numericBoxQuantity <= 0} style={{ padding:'7px 12px', border:'1px solid rgba(52,211,153,0.35)', borderRadius:5, background:'rgba(52,211,153,0.1)', color:'var(--accent-green)', cursor:'pointer', opacity:summary.hasMatch && selectedIds.length && numericBoxQuantity > 0 ? 1 : 0.5, fontSize:11, fontWeight:700 }}><Save size={11}/> Salvar vínculo</button>
        </div>
      </div>
    </div>
  );
}

function armorPieceQuantity(piece) {
  return piece?.owned ? Math.max(0, Number(piece.quantity ?? 1) || 0) : 0;
}

function getArmorCollectionMatches(listing, armorSets = []) {
  const target = normalizeInventoryName(listing?.title);
  if (!target) return [];
  return (Array.isArray(armorSets) ? armorSets : []).flatMap(set => (set.pieces || []).map(piece => ({ ...piece, armor_set_id: set.id, armor_set_name: set.base_name || set.set_name || '', armor_variant_name: set.variant_name || '' })))
    .filter(piece => normalizeInventoryName(piece.piece_name) === target);
}

function getCompleteArmorSetQuantity(set) {
  const pieces = Array.isArray(set?.pieces) ? set.pieces : [];
  if (!pieces.length) return 0;
  const byType = new Map();
  pieces.forEach(piece => {
    const type = String(piece.piece_type || piece.type || piece.id);
    const current = byType.get(type);
    const quantity = armorPieceQuantity(piece);
    byType.set(type, current === undefined ? quantity : Math.min(current, quantity));
  });
  return Math.max(0, Math.min(...byType.values()));
}

export function normalizeArmorSetListingName(value) {
  let normalized = normalizeInventoryName(value);
  // A UEX costuma acrescentar um descritor comercial ao título do anúncio.
  // Esses termos não devem obrigar o usuário a renomear o set na coleção.
  normalized = normalized
    .replace(/\s+(?:suit\s+set|armor\s+set|armour\s+set|complete\s+set|set\s+completo)$/i, '')
    .replace(/\s+(?:suit|armor|armour)$/i, '')
    .trim();
  return normalized;
}

export function getArmorSetNameCandidates(set) {
  const base = String(set?.base_name || set?.set_name || '').trim();
  const variant = String(set?.variant_name || '').trim();
  const candidates = [base, set?.set_name];
  if (variant && normalizeArmorSetListingName(variant) !== 'base') candidates.push(`${base} ${variant}`);
  return [...new Set(candidates.map(normalizeArmorSetListingName).filter(Boolean))];
}

export function getArmorSetOptions(listing, armorSets = []) {
  const target = normalizeArmorSetListingName(listing?.title);
  if (!target) return [];
  return (Array.isArray(armorSets) ? armorSets : [])
    .map(set => ({ ...set, completeQuantity: getCompleteArmorSetQuantity(set), armorMatchName: getArmorSetNameCandidates(set).find(candidate => candidate === target) }))
    .filter(set => Boolean(set.armorMatchName));
}

function getInventoryStockSummary(listing, inventoryItems = [], managedLocations = [], armorSets = []) {
  const name = normalizeInventoryName(listing?.title);
  const matches = (Array.isArray(inventoryItems) ? inventoryItems : [])
    .filter(entry => normalizeInventoryName(entry?.name) === name);
  const binding = getInventoryBinding(listing);
  const armorMatches = getArmorCollectionMatches(listing, armorSets);
  const armorSetOptions = getArmorSetOptions(listing, armorSets);
  const linkedArmor = armorMatches.filter(piece => binding.armorPieceIds.includes(String(piece.id)));
  const linkedSets = armorSetOptions.filter(set => binding.armorSetIds.includes(String(set.id)));
  const armorPieceQuantityTotal = linkedArmor.reduce((total, piece) => total + armorPieceQuantity(piece), 0);
  const armorSetQuantity = linkedSets.reduce((total, set) => total + set.completeQuantity, 0);
  const armorQuantity = armorPieceQuantityTotal + armorSetQuantity;
  const locationMap = new Map((managedLocations || []).map(location => [location.key, location]));
  const locationRows = [...new Map(matches.map(entry => {
    const key = inventoryLocationKey(entry);
    const managed = locationMap.get(key);
    return [key, {
      key,
      label: managed?.label || `${entry.location_name || 'Local não informado'} · ${entry.system || 'Outro'} · ${entry.location_type || 'Outros'}`,
      system: entry.system || 'Outro',
      location_type: entry.location_type || 'Outros',
      location_name: entry.location_name || 'Local não informado',
      quantity: 0,
      reservedQuantity: 0,
    }];
  })).values()];
  matches.forEach(entry => {
    const row = locationRows.find(candidate => candidate.key === inventoryLocationKey(entry));
    if (row) {
      row.quantity += getInventoryAvailableQuantity(entry);
      row.reservedQuantity += getInventoryReservedQuantity(entry);
    }
  });
  binding.locationKeys.forEach(key => {
    if (locationRows.some(row => row.key === key)) return;
    const [system = 'Outro', location_type = 'Outros', location_name = 'Local não informado'] = key.split('::');
    const managed = locationMap.get(key);
    locationRows.push({ key, label: managed?.label || `${location_name} · ${system} · ${location_type}`, system, location_type, location_name, quantity: 0, reservedQuantity: 0 });
  });
  const allQuantity = matches.reduce((total, entry) => total + getInventoryAvailableQuantity(entry), 0);
  const allReservedQuantity = matches.reduce((total, entry) => total + getInventoryReservedQuantity(entry), 0);
  const linkedMatches = binding.linked ? matches.filter(entry => binding.locationKeys.includes(inventoryLocationKey(entry))) : [];
  const linkedQuantity = linkedMatches.reduce((total, entry) => total + getInventoryAvailableQuantity(entry), 0);
  const linkedReservedQuantity = linkedMatches.reduce((total, entry) => total + getInventoryReservedQuantity(entry), 0);
  const quantity = (binding.locationKeys.length > 0 ? linkedQuantity : allQuantity) + armorQuantity;
  const reservedQuantity = (binding.locationKeys.length > 0 ? linkedReservedQuantity : allReservedQuantity);
  return {
    name,
    matches,
    armorMatches,
    armorSetOptions,
    linkedArmor,
    linkedSets,
    armorPieceQuantityTotal,
    armorSetQuantity,
    armorQuantity,
    locationRows,
    binding,
    hasMatch: matches.length > 0 || armorMatches.length > 0 || armorSetOptions.length > 0,
    isLinked: binding.linked,
    allQuantity,
    allReservedQuantity,
    linkedQuantity,
    linkedReservedQuantity,
    reservedQuantity,
    quantity,
    surplus: quantity - Math.max(0, Number(listing?.in_stock) || 0),
  };
}

function listingExpiryState(listing, now = Date.now()) {
  const expirationMs = toTimestampMs(listing?.date_expiration);
  if (!expirationMs) return { status:'unknown', days:null, expirationMs:null };
  const difference = expirationMs - now;
  if (difference <= 0) return { status:'expired', days:0, expirationMs };
  const days = Math.ceil(difference / 86400000);
  return { status: days <= 10 ? 'expiring' : 'active', days, expirationMs };
}

function normalizedListingValue(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function listingIdentityMatches(previous, fresh) {
  const previousTitle = normalizedListingValue(previous?.title || previous?.name);
  const freshTitle = normalizedListingValue(fresh?.title || fresh?.name);
  if (!previousTitle || !freshTitle || previousTitle !== freshTitle) return false;
  const previousLocation = normalizedListingValue(previous?.location);
  const freshLocation = normalizedListingValue(fresh?.location);
  if (previousLocation && freshLocation && previousLocation !== freshLocation) return false;
  const previousQuality = normalizedListingValue(previous?.quality);
  const freshQuality = normalizedListingValue(fresh?.quality);
  if (previousQuality && freshQuality && previousQuality !== freshQuality) return false;
  return true;
}

function sameRenewedListing(previous, fresh) {
  if (!listingIdentityMatches(previous, fresh)) return false;
  const previousState = listingExpiryState(previous);
  const freshState = listingExpiryState(fresh);
  return previousState.status === 'expired' && freshState.status !== 'expired';
}

// Detectar qualidade no título: "Caranite 716 Q" → 716
function extractQualityFromTitle(title) {
  const match = title.match(/(\d+)\s*Q\b/i);
  return match ? parseInt(match[1], 10) : null;
}

// Mapear qualidade numérica para tier da UEX API
function qualityToTier(q) {
  if (!q || q === 0) return 0;
  if (q < 500)  return 1;
  if (q < 600)  return 2;
  if (q < 700)  return 3;
  if (q < 800)  return 4;
  if (q < 900)  return 5;
  if (q < 950)  return 6;
  return 7;
}

// Label de tier de qualidade
function qualityTierLabel(tier) {
  return ['Todos','Q1-499','Q500-599','Q600-699','Q700-799','Q800-899','Q900-949','Q950+'][tier] || 'Todos';
}

// ── Constantes ────────────────────────────────────────────────────────────────
const AVAILABILITY_LABELS = {
  immediate:'Imediato', ready_pickup:'Pronto p/ Retirada', on_demand:'Sob Demanda',
  pre_order:'Pré-Venda', work_order:'Sob Encomenda', reserve_only:'Reserva',
  scheduled:'Agendado', in_progress:'Em Andamento', negotiable:'Negociável',
};
const SOURCE_LABELS = {
  looted:'Lootado', pledged:'Pledge', purchased_in_game:'Comprado', pirated:'Piratado', gifted:'Presente',
};

// ── Componente: Gráfico de barras simples ─────────────────────────────────────
function MiniBarChart({ data, color='var(--accent-primary)', height=80 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value || 0), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:3, height, padding:'0 2px' }}>
      {data.map((d, i) => {
        const pct = (d.value || 0) / max;
        const barH = Math.max(pct * (height - 20), 2);
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
            <div title={`${d.label}: ${ptMoney(d.value)} aUEC`}
              style={{ width:'100%', height:barH, background:color, borderRadius:'2px 2px 0 0', minHeight:2, opacity:0.85 }}/>
            <div style={{ fontSize:8, color:'var(--text-muted)', textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%' }}>
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Modal de vínculo com o Inventário de Itens ─────────────────────────────────
function InventoryStockLinkModal({ listing, inventoryItems, managedLocations, armorSets = [], onSave, onClose }) {
  const summary = getInventoryStockSummary(listing, inventoryItems, managedLocations, armorSets);
  const [selectedKeys, setSelectedKeys] = useState(() => summary.binding.locationKeys);
  const [selectedArmorIds, setSelectedArmorIds] = useState(() => summary.binding.armorPieceIds);
  const [selectedArmorSetIds, setSelectedArmorSetIds] = useState(() => summary.binding.armorSetIds);
  const selectedQuantity = summary.locationRows
    .filter(row => selectedKeys.includes(row.key))
    .reduce((total, row) => total + row.quantity, 0);
  const selectedArmorQuantity = summary.armorMatches.filter(piece => selectedArmorIds.includes(String(piece.id))).reduce((total, piece) => total + armorPieceQuantity(piece), 0);
  const selectedArmorSetQuantity = summary.armorSetOptions.filter(set => selectedArmorSetIds.includes(String(set.id))).reduce((total, set) => total + set.completeQuantity, 0);

  function toggleLocation(key) {
    setSelectedKeys(previous => previous.includes(key)
      ? previous.filter(value => value !== key)
      : [...previous, key]);
  }

  function toggleArmor(id) {
    const key = String(id);
    setSelectedArmorIds(previous => previous.includes(key) ? previous.filter(value => value !== key) : [...previous, key]);
  }

  function toggleArmorSet(id) {
    const key = String(id);
    setSelectedArmorSetIds(previous => previous.includes(key) ? previous.filter(value => value !== key) : [...previous, key]);
  }

  function handleSave() {
    onSave(selectedKeys.length || selectedArmorIds.length || selectedArmorSetIds.length ? { locationKeys: selectedKeys, armorPieceIds: selectedArmorIds, armorSetIds: selectedArmorSetIds, updatedAt: new Date().toISOString() } : null);
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1300, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div style={{ width:'min(560px,100%)', maxHeight:'90vh', overflowY:'auto', background:'var(--bg-card)', border:'1px solid rgba(56,189,248,0.36)', borderRadius:12, padding:18, boxShadow:'0 24px 80px rgba(0,0,0,0.7)' }} onMouseDown={event => event.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:12 }}>
          <div>
            <div style={{ fontSize:9, fontWeight:800, color:'var(--accent-primary)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Vínculo de estoque interno</div>
            <h3 style={{ margin:'5px 0 0', color:'var(--text-primary)', fontFamily:'Michroma,sans-serif', fontSize:15 }}>{listing.title}</h3>
            <div style={{ marginTop:4, color:'var(--text-muted)', fontSize:11 }}>Escolha um ou mais locais do Inventário de Itens que devem alimentar este anúncio.</div>
          </div>
          <button onClick={onClose} title="Fechar" style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid var(--border-subtle)', borderRadius:5, background:'transparent', color:'var(--text-muted)', cursor:'pointer' }}><X size={14}/></button>
        </div>

        {!summary.hasMatch ? (
          <div style={{ padding:12, border:'1px solid rgba(251,191,36,0.28)', background:'rgba(251,191,36,0.07)', borderRadius:7, color:'var(--accent-gold)', fontSize:11, lineHeight:1.55 }}>
            Este item ainda não existe no Inventário de Itens nem na Coleção de Armaduras. Cadastre <strong>{listing.title}</strong> em uma dessas telas para vincular o estoque.
          </div>
        ) : (
          <>
            {(summary.armorMatches.length > 0 || summary.armorSetOptions.length > 0) && (
              <div style={{ marginBottom:12, padding:10, border:'1px solid rgba(167,139,250,0.28)', background:'rgba(167,139,250,0.06)', borderRadius:7 }}>
                <div style={{ color:'var(--accent-purple)', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Coleção de armaduras</div>
                <div style={{ color:'var(--text-muted)', fontSize:10, marginBottom:8 }}>Escolha peças avulsas ou um set completo. A quantidade é lida diretamente da sua coleção e a baixa será feita somente após a venda.</div>
                {summary.armorSetOptions.length > 0 && <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:8 }}>
                  {summary.armorSetOptions.map(set => {
                    const selected = selectedArmorSetIds.includes(String(set.id));
                    return <label key={`set-${set.id}`} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', border:`1px solid ${selected ? 'rgba(52,211,153,0.48)' : 'var(--border-subtle)'}`, background:selected ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.02)', borderRadius:6, cursor:set.completeQuantity > 0 ? 'pointer' : 'not-allowed', opacity:set.completeQuantity > 0 ? 1 : 0.55 }}>
                      <input type="checkbox" checked={selected} disabled={set.completeQuantity <= 0} onChange={() => toggleArmorSet(set.id)} />
                      <span style={{ flex:1, minWidth:0, color:'var(--text-secondary)', fontSize:11 }}><strong style={{ color:'var(--accent-green)' }}>SET COMPLETO</strong> · {set.base_name || set.set_name}{set.variant_name && set.variant_name !== 'Base' ? ` · ${set.variant_name}` : ''}<small style={{ display:'block', marginTop:3, color:'var(--text-muted)', fontSize:9 }}>Correspondência automática: o sufixo descritivo do anúncio foi ignorado.</small></span>
                      <strong style={{ color:'var(--accent-green)', fontFamily:'Share Tech Mono,monospace', fontSize:11 }}>{set.completeQuantity} set{set.completeQuantity === 1 ? '' : 's'}</strong>
                    </label>;
                  })}
                </div>}
                {summary.armorMatches.length > 0 && <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {summary.armorMatches.map(piece => {
                    const quantity = Math.max(0, Number(piece.quantity ?? (piece.owned ? 1 : 0)) || 0);
                    const selected = selectedArmorIds.includes(String(piece.id));
                    return <label key={piece.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', border:`1px solid ${selected ? 'rgba(167,139,250,0.45)' : 'var(--border-subtle)'}`, background:selected ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.02)', borderRadius:6, cursor:quantity > 0 ? 'pointer' : 'not-allowed', opacity:quantity > 0 ? 1 : 0.55 }}>
                      <input type="checkbox" checked={selected} disabled={quantity <= 0} onChange={() => toggleArmor(piece.id)} />
                      <span style={{ flex:1, minWidth:0, color:'var(--text-secondary)', fontSize:11 }}>{piece.armor_set_name}{piece.armor_variant_name && piece.armor_variant_name !== 'Base' ? ` · ${piece.armor_variant_name}` : ''}</span>
                      <strong style={{ color:'var(--accent-purple)', fontFamily:'Share Tech Mono,monospace', fontSize:11 }}>{quantity} un</strong>
                    </label>;
                  })}
                </div>}
                <div style={{ marginTop:8, color:'var(--text-secondary)', fontSize:10 }}>Coleção selecionada: <strong style={{ color:'var(--accent-purple)' }}>{selectedArmorQuantity} peças + {selectedArmorSetQuantity} sets completos</strong></div>
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:9 }}>
              <div style={{ padding:'8px 10px', border:'1px solid rgba(56,189,248,0.18)', background:'rgba(56,189,248,0.05)', borderRadius:7 }}>
                <div style={{ color:'var(--text-muted)', fontSize:10 }}>Locais selecionados</div>
                <strong style={{ color:'var(--accent-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:13 }}>{selectedKeys.length}</strong>
              </div>
              <div style={{ padding:'8px 10px', border:'1px solid rgba(56,189,248,0.18)', background:'rgba(56,189,248,0.05)', borderRadius:7 }}>
                <div style={{ color:'var(--text-muted)', fontSize:10 }}>Quantidade selecionada</div>
                <strong style={{ color:'var(--accent-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:13 }}>{selectedQuantity + selectedArmorQuantity + selectedArmorSetQuantity} unidade{selectedQuantity + selectedArmorQuantity + selectedArmorSetQuantity === 1 ? '' : 's'}</strong>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {summary.locationRows.map(row => (

                <label key={row.key} style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 10px', border:`1px solid ${selectedKeys.includes(row.key) ? 'rgba(56,189,248,0.45)' : 'var(--border-subtle)'}`, background:selectedKeys.includes(row.key) ? 'rgba(56,189,248,0.09)' : 'rgba(255,255,255,0.02)', borderRadius:7, cursor:'pointer' }}>
                  <input type="checkbox" checked={selectedKeys.includes(row.key)} onChange={() => toggleLocation(row.key)} />
                  <span style={{ flex:1, minWidth:0, color:'var(--text-secondary)', fontSize:11 }}>{row.label}</span>
                  <strong style={{ color:'var(--text-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:12 }}>{row.quantity}</strong>
                </label>
              ))}
            </div>
            <div style={{ marginTop:9, color:'var(--text-muted)', fontSize:10, lineHeight:1.45 }}>Se nenhum local for selecionado, o vínculo será removido. Alterações futuras no Inventário atualizarão este anúncio automaticamente.</div>
          </>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:7, marginTop:15 }}>
          <button onClick={onClose} style={{ padding:'7px 12px', border:'1px solid var(--border-subtle)', borderRadius:5, background:'transparent', color:'var(--text-secondary)', cursor:'pointer', fontSize:11, fontWeight:700 }}>Cancelar</button>
          {summary.binding.linked && <button onClick={() => onSave(null)} style={{ padding:'7px 12px', border:'1px solid rgba(251,113,133,0.28)', borderRadius:5, background:'rgba(251,113,133,0.07)', color:'var(--accent-red)', cursor:'pointer', fontSize:11, fontWeight:700 }}>Remover vínculo</button>}
          <button onClick={handleSave} disabled={!summary.hasMatch} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 12px', border:'1px solid rgba(56,189,248,0.35)', borderRadius:5, background:'rgba(56,189,248,0.1)', color:'var(--accent-primary)', cursor:summary.hasMatch ? 'pointer' : 'not-allowed', opacity:summary.hasMatch ? 1 : 0.5, fontSize:11, fontWeight:700 }}><Save size={11}/> Salvar vínculo</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de confirmação / edição de listagem importada ───────────────────────
function ImportConfirmModal({ listing, onConfirm, onSkip }) {
  const suggestedQ = extractQualityFromTitle(listing.title || '');
  const [title,    setTitle]    = useState(listing.title || '');
  const [price,    setPrice]    = useState(String(listing.price || 0));
  const [quality,  setQuality]  = useState(listing.quality || (suggestedQ ? String(suggestedQ) : ''));
  const [location, setLocation] = useState(listing.location || '');
  const [avail,    setAvail]    = useState(listing.availability || 'immediate');
  const [inStock,  setInStock]  = useState(String(listing.in_stock || 1));
  const [source,   setSource]   = useState(listing.source || 'looted');
  const [notes,    setNotes]    = useState('');

  const IS = { width:'100%', padding:'7px 10px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:13, outline:'none' };
  const SS = { ...IS, appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 7px center', paddingRight:26 };
  const LS = { fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:4 };

  function handleConfirm() {
    onConfirm({
      ...listing,
      title, price: parseFloat(price) || 0, quality,
      location, availability: avail, in_stock: parseInt(inStock)||1,
      source, notes,
    });
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <div style={{ background:'var(--bg-card)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:12, padding:22, width:'100%', maxWidth:560, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
          <CheckCircle2 size={16} style={{ color:'var(--accent-primary)' }}/>
          <span style={{ fontFamily:'Michroma,sans-serif', fontSize:12, fontWeight:700, color:'var(--accent-primary)', letterSpacing:'0.06em' }}>CONFIRMAR LISTAGEM</span>
        </div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:16, paddingLeft:26 }}>
          Revise e edite os dados antes de adicionar ao seu histórico.
          {suggestedQ && <span style={{ marginLeft:8, color:'var(--accent-gold)', fontWeight:700 }}>★ Qualidade detectada no título: {suggestedQ}</span>}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:9 }}>
          <div style={{ gridColumn:'span 2' }}>
            <label style={LS}>Título do Anúncio</label>
            <input style={IS} value={title} onChange={e=>setTitle(e.target.value)}/>
          </div>
          <div>
            <label style={LS}>Preço (aUEC)</label>
            <input style={{ ...IS, fontFamily:'Share Tech Mono,monospace' }} type="number" value={price} onChange={e=>setPrice(e.target.value)}/>
          </div>
          <div>
            <label style={LS}>Qualidade <span style={{ color:'var(--accent-gold)' }}>(0–1000)</span></label>
            <input style={IS} placeholder="ex: 716, Pristine..." value={quality} onChange={e=>setQuality(e.target.value)}/>
          </div>
          <div>
            <label style={LS}>Localização</label>
            <input style={IS} placeholder="ex: Port Tressler" value={location} onChange={e=>setLocation(e.target.value)}/>
          </div>
          <div>
            <label style={LS}>Em Estoque (qtd listada)</label>
            <input style={IS} type="number" min="0" value={inStock} onChange={e=>setInStock(e.target.value)}/>
          </div>
          <div>
            <label style={LS}>Disponibilidade</label>
            <select style={SS} value={avail} onChange={e=>setAvail(e.target.value)}>
              {Object.entries(AVAILABILITY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={LS}>Origem do Item</label>
            <select style={SS} value={source} onChange={e=>setSource(e.target.value)}>
              {Object.entries(SOURCE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={LS}>Notas Pessoais</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)}
              placeholder="Observações sobre este item..."
              style={{ ...IS, minHeight:48, resize:'vertical' }}/>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onSkip} style={{ padding:'7px 14px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:6, color:'var(--text-secondary)', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>
            Pular
          </button>
          <button onClick={handleConfirm} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 16px', background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:6, color:'var(--accent-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>
            <CheckCircle2 size={12}/> Confirmar e Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de venda manual ─────────────────────────────────────────────────────
function ManualSaleModal({ catalogItems, onSave, onClose }) {
  const [itemName,   setItemName]  = useState('');
  const [listingId,  setListingId] = useState('');
  const [price,      setPrice]     = useState('');
  const [qty,        setQty]       = useState('1');
  const [quality,    setQuality]   = useState('');
  const [buyer,      setBuyer]     = useState('');
  const [date,       setDate]      = useState(new Date().toISOString().slice(0,10));
  const [type,       setType]      = useState('sold');   // sold | failed | expired
  const [notes,      setNotes]     = useState('');
  const [error,      setError]     = useState('');

  const IS = { width:'100%', padding:'7px 10px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:13, outline:'none' };
  const SS = { ...IS, appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 7px center', paddingRight:26 };
  const LS = { fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:4 };

  const total = (parseFloat(price)||0) * (parseInt(qty)||1);
  const matchingListings = (catalogItems || []).filter(item => normalizeInventoryName(item.title) === normalizeInventoryName(itemName));

  function handleSave() {
    if (!itemName.trim()) { setError('Nome do item obrigatório.'); return; }
    if (!price || parseFloat(price) <= 0) { setError('Preço deve ser maior que zero.'); return; }
    onSave({
      id: Date.now(),
      title: itemName.trim(), listingId: listingId || null, price: parseFloat(price), qty: parseInt(qty)||1,
      total_revenue: type === 'sold' ? total : 0,
      quality, buyer, type,
      date: new Date(date).getTime() / 1000,
      notes, is_manual: true,
      created_at: new Date().toISOString(),
    });
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <div style={{ background:'var(--bg-card)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:12, padding:22, width:'100%', maxWidth:500, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div style={{ fontFamily:'Michroma,sans-serif', fontSize:12, fontWeight:700, color:'var(--accent-green)', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:7 }}>
            <Plus size={14}/> REGISTRAR VENDA / OCORRÊNCIA MANUAL
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={14}/></button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:9 }}>
          <div style={{ gridColumn:'span 2' }}>
            <label style={LS}>Item</label>
            <input style={IS} list="catalog-list" value={itemName} onChange={e=>setItemName(e.target.value)} placeholder="Nome do item vendido..."/>
            <datalist id="catalog-list">
              {[...new Set(catalogItems.map(c=>c.title))].map(t=><option key={t} value={t}/>)}
            </datalist>
            {matchingListings.length > 0 && (
              <select value={listingId} onChange={e=>setListingId(e.target.value)} style={{ width:'100%', marginTop:6, padding:'6px 8px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:4, color:'var(--text-secondary)', fontSize:11, outline:'none' }}>
                <option value="">Selecionar anúncio específico (opcional)</option>
                {matchingListings.map(item => <option key={item.id} value={item.id}>{item.title} · {item.location || 'local não informado'}{item.vault_binding ? ' · Baú vinculado' : ''}</option>)}
              </select>
            )}
          </div>
          <div>
            <label style={LS}>Tipo</label>
            <select style={SS} value={type} onChange={e=>setType(e.target.value)}>
              <option value="sold">✅ Venda Concretizada</option>
              <option value="failed">❌ Venda Não Concretizada</option>
              <option value="expired">⏰ Listagem Expirada</option>
            </select>
          </div>
          <div>
            <label style={LS}>Data</label>
            <input style={IS} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          </div>
          <div>
            <label style={LS}>Preço Unitário (aUEC)</label>
            <input style={{ ...IS, fontFamily:'Share Tech Mono,monospace' }} type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="ex: 50000"/>
          </div>
          <div>
            <label style={LS}>Quantidade</label>
            <input style={IS} type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)}/>
          </div>
          <div>
            <label style={LS}>Qualidade</label>
            <input style={IS} placeholder="ex: 716, Grade A..." value={quality} onChange={e=>setQuality(e.target.value)}/>
          </div>
          <div>
            <label style={LS}>Comprador (IGN)</label>
            <input style={IS} placeholder="ex: PlayerName (opcional)" value={buyer} onChange={e=>setBuyer(e.target.value)}/>
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={LS}>Notas</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observações..."
              style={{ ...IS, minHeight:44, resize:'vertical' }}/>
          </div>
        </div>

        {total > 0 && type === 'sold' && (
          <div style={{ marginBottom:12, padding:'8px 12px', background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:6, display:'flex', gap:16, alignItems:'center' }}>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Total:</span>
            <span style={{ fontFamily:'Michroma,sans-serif', fontSize:16, fontWeight:800, color:'var(--accent-green)' }}>{ptMoney(total)} aUEC</span>
          </div>
        )}

        {error && <div style={{ color:'var(--accent-red)', fontSize:12, marginBottom:9 }}><AlertTriangle size={12} style={{ display:'inline', marginRight:4 }}/>{error}</div>}

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'7px 14px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:6, color:'var(--text-secondary)', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>Cancelar</button>
          <button onClick={handleSave} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 16px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:6, color:'var(--accent-green)', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'uppercase' }}>
            <Save size={12}/> Registrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card de item do catálogo com dados de mercado ─────────────────────────────
function CatalogItemCard({ item, sales, itemSales: indexedItemSales, inventorySummary: indexedInventorySummary, vaultSummary: indexedVaultSummary, marketTrend, onEditStock, onDelete, trendData, trendDataFetchedAt, inventoryItems, managedLocations, armorSets, vaultEntries, onOpenStockLink, onOpenVaultStockLink }) {
  const [expanded, setExpanded]   = useState(false);
  const [editStock, setEditStock]     = useState(false);
  const [stockVal, setStockVal]       = useState(String(item.in_stock || 0));
  const [internalVal, setInternalVal] = useState(String(item.internal_stock || 0));
  const [delConf, setDelConf]     = useState(false);
  const [discountAnalysis, setDiscountAnalysis] = useState(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState('');
  const inventorySummary = indexedInventorySummary || getInventoryStockSummary(item, inventoryItems, managedLocations, armorSets);
  const vaultSummary = indexedVaultSummary || getVaultStockSummary(item, vaultEntries);
  const displayedInternalStock = inventorySummary.isLinked ? inventorySummary.quantity : Number(item.internal_stock) || 0;

  const itemSales = indexedItemSales || sales.filter(s => s.title?.toLowerCase() === item.title?.toLowerCase() && s.type === 'sold');
  const totalSold = itemSales.reduce((a,s) => a + (s.total_revenue || 0), 0);
  const qtyListed = item.in_stock || 0;
  const listingTarget = getCatalogListingTarget(item);

  async function analyzeDiscount() {
    const itemId = marketTrend?.id_item ?? marketTrend?.uex_item_id ?? listingTarget.itemId;
    if (itemId === null || itemId === undefined || String(itemId).trim() === '') {
      setDiscountError('A UEX não retornou o identificador deste item para comparar concorrentes.');
      setDiscountAnalysis(null);
      return;
    }
    setDiscountLoading(true);
    setDiscountError('');
    try {
      const response = await uexFetch(`marketplace_listings?id_item=${encodeURIComponent(itemId)}&operation=sell`);
      const competitorPrices = extractActiveCompetitorPrices(response, {
        itemId,
        ownListingId: item.id,
        ownSourceListingId: item.source_listing_id,
      });
      setDiscountAnalysis(recommendDiscount({ currentPrice: item.price, competitorPrices }));
    } catch (error) {
      setDiscountAnalysis(null);
      setDiscountError(error.message || 'Não foi possível consultar os anúncios concorrentes.');
    } finally {
      setDiscountLoading(false);
    }
  }

  // Dados de tendência da UEX: correspondência exata por ID, slug ou nome.
  // Nunca usar apenas o primeiro termo do título, pois isso mistura itens como
  // Yormandi Tongue e Yormandi Eye.
  const trend = marketTrend || findMarketTrendForItem(item, trendData);

  // Detectar qualidade no título
  const suggestedQ = extractQualityFromTitle(item.title || '');

  // Calcular variação de preço (preço atual vs média 30 dias)
  let priceVariation = null;
  if (trend?.price_avg_sell && trend?.price_avg_month_sell) {
    priceVariation = ((trend.price_avg_sell - trend.price_avg_month_sell) / trend.price_avg_month_sell) * 100;
  }

  const expiry = listingExpiryState(item);
  const expiresIn = expiry.days;
  const isExpired = expiry.status === 'expired';
  const isExpiringSoon = expiry.status === 'expiring';
  const expiryBorder = isExpired ? 'rgba(251,113,133,0.5)' : isExpiringSoon ? 'rgba(251,191,36,0.55)' : 'var(--border-subtle)';
  const expiryBackground = isExpired ? 'rgba(251,113,133,0.045)' : isExpiringSoon ? 'rgba(251,191,36,0.045)' : 'var(--bg-card)';

  return (
    <>
    <div style={{
      background:expiryBackground,
      border:`1px solid ${expiryBorder}`,
      borderRadius:8, overflow:'hidden', marginBottom:6,
    }}>
      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 13px', cursor:'pointer' }} onClick={() => setExpanded(!expanded)}>
        <Package size={14} style={{ color:'var(--accent-primary)', flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:2 }}>
            <span style={{ fontFamily:'"Exo 2",sans-serif', fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{item.title}</span>
            {item.quality !== null && item.quality !== undefined && String(item.quality).trim() !== '' && Number(item.quality) > 0 && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(255,200,0,0.1)', color:'var(--accent-gold)', border:'1px solid rgba(255,200,0,0.3)', fontWeight:700 }}>★ {item.quality}</span>}
            {suggestedQ && !item.quality && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(255,200,0,0.06)', color:'rgba(255,200,0,0.7)', border:'1px solid rgba(255,200,0,0.2)', fontStyle:'italic' }}>Q sugerida: {suggestedQ}</span>}
            {isExpired ? <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(251,113,133,0.15)', color:'var(--accent-red)', border:'1px solid rgba(251,113,133,0.35)', fontWeight:700 }}>⚠ ANÚNCIO EXPIRADO</span>
              : item.is_sold_out ? <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(251,113,133,0.1)', color:'var(--accent-red)', border:'1px solid rgba(251,113,133,0.3)', fontWeight:700 }}>ESGOTADO</span>
              : <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(52,211,153,0.1)', color:'var(--accent-green)', border:'1px solid rgba(52,211,153,0.3)', fontWeight:700 }}>ATIVO</span>}
            {isExpiringSoon && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(251,191,36,0.16)', color:'var(--accent-gold)', border:'1px solid rgba(251,191,36,0.4)', fontWeight:700 }}>⚠ Expira em {expiresIn}d</span>}
          </div>
          <div style={{ display:'flex', gap:10, fontSize:10, color:'var(--text-muted)', flexWrap:'wrap' }}>
            {item.location && <span>📍 {item.location}</span>}
            {item.availability && <span>{AVAILABILITY_LABELS[item.availability] || item.availability}</span>}
            {item.source && <span>{SOURCE_LABELS[item.source] || item.source}</span>}
            {itemSales.length > 0 && <span style={{ color:'var(--accent-green)' }}>✓ {itemSales.length} venda{itemSales.length!==1?'s':''}</span>}
          </div>
        </div>

        {/* Preço + estoque */}
        <div style={{ textAlign:'right', flexShrink:0, marginRight:6 }}>
          <div style={{ fontFamily:'Michroma,sans-serif', fontSize:15, fontWeight:800, color:'var(--accent-gold)' }}>{ptMoney(item.price)} <span style={{ fontSize:10, color:'var(--text-muted)' }}>aUEC</span></div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
            <span>Listado: {qtyListed}</span>
            <span style={{ color: inventorySummary.isLinked ? 'var(--accent-green)' : inventorySummary.hasMatch ? 'var(--accent-gold)' : 'var(--accent-red)' }}>
              Estoque: {inventorySummary.isLinked ? displayedInternalStock : inventorySummary.hasMatch ? 'não vinculado' : 'desconhecido'}
              {inventorySummary.isLinked && inventorySummary.reservedQuantity > 0 && <span style={{ color:'var(--accent-gold)' }}> · {inventorySummary.reservedQuantity} reservado</span>}
            </span>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display:'flex', gap:4, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
          <a href={listingTarget.url} target="_blank" rel="noreferrer" aria-label={listingTarget.exact ? 'Ver anúncio na UEX' : 'Pesquisar item na UEX'} title={listingTarget.exact ? 'Ver este anúncio diretamente na UEX' : 'Anúncio sem URL direta; pesquisar item na UEX'} style={{ width:26, height:26, borderRadius:4, border:'1px solid rgba(56,189,248,0.28)', background:'rgba(56,189,248,0.08)', color:'var(--accent-primary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
            <ExternalLink size={11}/>
          </a>
          {delConf ? (
            <>
              <button onClick={() => onDelete(item.id)} style={{ padding:'3px 7px', background:'rgba(251,113,133,0.15)', border:'1px solid rgba(251,113,133,0.4)', borderRadius:3, color:'var(--accent-red)', cursor:'pointer', fontSize:10, fontWeight:700 }}>Sim</button>
              <button onClick={() => setDelConf(false)} style={{ padding:'3px 7px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:3, color:'var(--text-secondary)', cursor:'pointer', fontSize:10 }}>Não</button>
            </>
          ) : (
            <button onClick={() => setDelConf(true)} style={{ width:26, height:26, borderRadius:4, border:'1px solid rgba(251,113,133,0.2)', background:'rgba(251,113,133,0.08)', color:'var(--accent-red)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Trash2 size={10}/>
            </button>
          )}
          {expanded ? <ChevronUp size={13} style={{ color:'var(--text-muted)' }}/> : <ChevronDown size={13} style={{ color:'var(--text-muted)' }}/>}
        </div>
      </div>

      {/* Expanded: detalhes + mercado + estoque interno */}
      {expanded && (
        <div style={{ padding:'8px 38px 14px', borderTop:'1px solid var(--border-subtle)', background:'rgba(0,0,0,0.08)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

            {/* Coluna 1: Dados do item + estoque interno */}
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7 }}>Detalhes do Anúncio</div>
              {item.description && <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:8, lineHeight:1.5 }}>{item.description}</div>}
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {[
                  ['Preço', `${ptMoney(item.price)} aUEC`],
                  ['Preço anterior', item.price_old ? `${ptMoney(item.price_old)} aUEC` : '—'],
                  ['Qualidade', item.quality || (suggestedQ ? `${suggestedQ} (sugerida do título)` : '—')],
                  ['Durabilidade', item.durability ? `${item.durability}%` : '—'],
                  ['Expiração', isExpired ? 'Expirado' : expiresIn !== null ? `${expiresIn} dia${expiresIn!==1?'s':''}` : '—'],
                  ['Adicionado', ptDate(item.date_added)],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'2px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                    <span style={{ color:'var(--text-muted)' }}>{k}</span>
                    <span style={{ color:'var(--text-primary)', fontFamily:'Share Tech Mono,monospace' }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Atalho do anúncio</div>
                <a href={listingTarget.url} target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 9px', background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.28)', borderRadius:5, color:'var(--accent-primary)', fontSize:10, fontWeight:700, textDecoration:'none' }} title={listingTarget.exact ? 'Abrir este anúncio diretamente na UEX' : 'Pesquisar este item na UEX'}>
                  <ExternalLink size={11}/> {listingTarget.exact ? 'Ver anúncio na UEX' : 'Pesquisar na UEX'}
                </a>
              </div>

              {/* Controle de estoque interno */}
              <div style={{ marginTop:10, padding:'10px 12px', background:inventorySummary.isLinked ? 'rgba(52,211,153,0.06)' : inventorySummary.hasMatch ? 'rgba(251,191,36,0.06)' : 'rgba(251,113,133,0.05)', border:`1px solid ${inventorySummary.isLinked ? 'rgba(52,211,153,0.2)' : inventorySummary.hasMatch ? 'rgba(251,191,36,0.24)' : 'rgba(251,113,133,0.22)'}`, borderRadius:7 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', marginBottom:7 }}>
                  <div style={{ fontSize:9, fontWeight:700, color:inventorySummary.isLinked ? 'var(--accent-green)' : inventorySummary.hasMatch ? 'var(--accent-gold)' : 'var(--accent-red)', textTransform:'uppercase', letterSpacing:'0.08em' }}>📦 Estoque Interno</div>
                  {inventorySummary.isLinked && <span style={{ fontSize:9, color:'var(--accent-green)', fontWeight:700 }}>{inventorySummary.binding.locationKeys.length > 0 && `VINCULADO A ${inventorySummary.binding.locationKeys.length} LOCAL${inventorySummary.binding.locationKeys.length === 1 ? '' : 'IS'}`}{inventorySummary.binding.locationKeys.length > 0 && inventorySummary.binding.armorPieceIds.length > 0 ? ' + ' : ''}{inventorySummary.binding.armorPieceIds.length > 0 && `${inventorySummary.binding.armorPieceIds.length} PEÇA${inventorySummary.binding.armorPieceIds.length === 1 ? '' : 'S'} DA COLEÇÃO`}</span>}
                </div>
                {inventorySummary.isLinked ? (
                  <>
                    <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'Michroma,sans-serif', fontSize:20, fontWeight:800, color:'var(--accent-green)' }}>{displayedInternalStock}</span>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>unidade{displayedInternalStock === 1 ? '' : 's'} livres no inventário selecionado</span>
                    </div>
                    {inventorySummary.reservedQuantity > 0 && <div style={{ marginTop:5, fontSize:10, color:'var(--accent-gold)' }}><strong>{inventorySummary.reservedQuantity} unidade{inventorySummary.reservedQuantity === 1 ? '' : 's'}</strong> reservada{inventorySummary.reservedQuantity === 1 ? '' : 's'} para outra pessoa; não entra no saldo de venda.</div>}
                    <div style={{ marginTop:5, fontSize:10, color:inventorySummary.surplus >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      Após vender as {qtyListed} listadas: <strong>{inventorySummary.surplus >= 0 ? `${inventorySummary.surplus} sobrando` : `${Math.abs(inventorySummary.surplus)} em falta`}</strong>
                    </div>
                    <div style={{ marginTop:5, fontSize:10, color:'var(--text-muted)', lineHeight:1.45 }}>
                      Fontes: {[...inventorySummary.locationRows.filter(row => inventorySummary.binding.locationKeys.includes(row.key)).map(row => row.label), ...(inventorySummary.binding.armorPieceIds.length > 0 ? [`Coleção de Armaduras (${inventorySummary.binding.armorPieceIds.length} peça${inventorySummary.binding.armorPieceIds.length === 1 ? '' : 's'})`] : [])].join(' · ') || '—'}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize:11, color:inventorySummary.hasMatch ? 'var(--accent-gold)' : 'var(--accent-red)', lineHeight:1.45 }}>
                    <strong>{inventorySummary.hasMatch ? 'Estoque não vinculado' : 'Estoque desconhecido'}</strong>
                    <div>{inventorySummary.hasMatch ? 'O item existe no inventário, mas nenhum local foi selecionado.' : 'Cadastre este item no Inventário de Itens para descobrir a quantidade disponível.'}</div>
                  </div>
                )}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, flexWrap:'wrap' }}>
                  <button onClick={() => onOpenStockLink(item)} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 9px', background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.25)', borderRadius:4, color:'var(--accent-primary)', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'"Exo 2",sans-serif' }}><MapPin size={10}/> {inventorySummary.isLinked ? 'Editar locais' : 'Vincular estoque'}</button>
                  {!inventorySummary.isLinked && <button onClick={() => { setStockVal(String(item.internal_stock || 0)); setEditStock(true); }} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 9px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:4, color:'var(--text-muted)', cursor:'pointer', fontSize:10, fontWeight:700 }}><Edit3 size={9}/> Informar manualmente</button>}
                </div>
                {editStock && !inventorySummary.isLinked && <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:8 }}><input type="number" min="0" value={stockVal} onChange={e=>setStockVal(e.target.value)} style={{ width:80, padding:'5px 8px', background:'var(--bg-base)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:4, color:'var(--text-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:13, outline:'none' }}/><button onClick={() => { onEditStock(item.id, parseInt(stockVal, 10) || 0); setEditStock(false); }} style={{ padding:'5px 10px', background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:4, color:'var(--accent-primary)', cursor:'pointer', fontSize:10, fontWeight:700 }}><Save size={10}/> Salvar</button><button onClick={() => setEditStock(false)} style={{ padding:'5px 8px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:4, color:'var(--text-muted)', cursor:'pointer', fontSize:10 }}><X size={10}/></button></div>}

                {/* Vínculo opcional com o Baú de Minério */}
                <div style={{ marginTop:10, padding:'10px 12px', background:vaultSummary.isLinked ? 'rgba(52,211,153,0.06)' : vaultSummary.hasMatch ? 'rgba(251,191,36,0.05)' : 'rgba(255,255,255,0.025)', border:`1px solid ${vaultSummary.isLinked ? 'rgba(52,211,153,0.2)' : vaultSummary.hasMatch ? 'rgba(251,191,36,0.2)' : 'var(--border-subtle)'}`, borderRadius:7 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:vaultSummary.isLinked ? 'var(--accent-green)' : vaultSummary.hasMatch ? 'var(--accent-gold)' : 'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>⛏ Baú de Minério</div>
                    {vaultSummary.isLinked && <span style={{ fontSize:9, color:'var(--accent-green)', fontWeight:700 }}>QUALIDADE: {vaultSummary.binding.quality || 'SELECIONADA'}</span>}
                  </div>
                  {vaultSummary.isLinked ? (
                    <>
                      <div style={{ marginTop:5, fontSize:11, color:'var(--text-secondary)' }}><strong style={{ color:'var(--accent-green)', fontFamily:'Share Tech Mono,monospace' }}>{vaultSummary.binding.boxQuantity} {vaultSummary.binding.boxUnit}</strong> por caixa · <strong style={{ color:'var(--accent-primary)' }}>{vaultSummary.boxesAvailable}</strong> caixas disponíveis</div>
                      <div style={{ marginTop:4, fontSize:10, color:vaultSummary.boxesAfterListing >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>Após vender as {qtyListed} caixas listadas: <strong>{vaultSummary.boxesAfterListing >= 0 ? `${vaultSummary.boxesAfterListing} caixas sobrando` : `${Math.abs(vaultSummary.boxesAfterListing)} caixas em falta`}</strong></div>
                    </>
                  ) : <div style={{ marginTop:5, fontSize:10, color:vaultSummary.hasMatch ? 'var(--accent-gold)' : 'var(--text-muted)' }}>{vaultSummary.hasMatch ? 'Escolha a qualidade e a entrada no Baú para vincular.' : 'Nenhuma entrada deste item foi encontrada no Baú.'}</div>}
                  <button onClick={() => onOpenVaultStockLink(item)} style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:7, padding:'5px 9px', background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:4, color:'var(--accent-green)', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'"Exo 2",sans-serif' }}><MapPin size={10}/> {vaultSummary.isLinked ? 'Editar vínculo do Baú' : 'Vincular ao Baú'}</button>
                </div>
              </div>
            </div>

            {/* Coluna 2: Dados de mercado UEX + histórico de vendas */}
            <div>
              {trend ? (
                <div>
                  <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2, display:'flex', alignItems:'center', gap:5 }}>
                    <Globe size={9}/> Mercado UEX — {trend.item_name}
                  </div>
                  <div style={{ fontSize:9, color:'var(--text-muted)', marginBottom:7 }}>
                    Fonte: <span style={{ color:'var(--accent-primary)' }}>marketplace_trends</span> · {trend.currency || 'UEC'} · snapshot {trendDataFetchedAt ? ptDate(trendDataFetchedAt) : 'não registrado'} · cache da UEX: até 1h
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:10 }}>
                    {[
                      { label:'Preço médio venda', value:`${ptMoney(trend.price_avg_sell)} aUEC`, color:'var(--accent-green)' },
                      { label:'Média 30 dias', value:`${ptMoney(trend.price_avg_month_sell)} aUEC`, color:'var(--text-secondary)' },
                      { label:'Mínimo venda', value:`${ptMoney(trend.price_min_sell)} aUEC`, color:'var(--text-muted)' },
                      { label:'Máximo venda', value:`${ptMoney(trend.price_max_sell)} aUEC`, color:'var(--accent-gold)' },
                      { label:'Anúncios ativos', value:trend.listings_count_sell || '—', color:'var(--text-primary)' },
                      { label:'Negociações', value:trend.negotiations_count || '—', color:'var(--accent-primary)' },
                    ].map(({label,value,color}) => (
                      <div key={label} style={{ padding:'6px 8px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-subtle)', borderRadius:5 }}>
                        <div style={{ fontFamily:'Share Tech Mono,monospace', fontSize:12, fontWeight:700, color }}>{value}</div>
                        <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:1 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Variação de preço */}
                  {priceVariation !== null && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', background: priceVariation >= 0 ? 'rgba(52,211,153,0.06)' : 'rgba(251,113,133,0.06)', border:`1px solid ${priceVariation>=0?'rgba(52,211,153,0.2)':'rgba(251,113,133,0.2)'}`, borderRadius:6, marginBottom:8 }}>
                      {priceVariation >= 0 ? <TrendingUp size={12} style={{ color:'var(--accent-green)' }}/> : <TrendingDown size={12} style={{ color:'var(--accent-red)' }}/>}
                      <span style={{ fontSize:11, color: priceVariation >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight:700 }}>
                        {priceVariation >= 0 ? '+' : ''}{ptDecimal(priceVariation)}% vs média 30 dias
                      </span>
                    </div>
                  )}

                  {/* Preço recomendado */}
                  {trend.price_avg_sell > 0 && (
                    <div style={{ padding:'8px 10px', background:'rgba(255,200,0,0.06)', border:'1px solid rgba(255,200,0,0.25)', borderRadius:6 }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'var(--accent-gold)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>💡 Preço Recomendado</div>
                      <div style={{ fontFamily:'Michroma,sans-serif', fontSize:14, fontWeight:800, color:'var(--accent-gold)' }}>
                        {ptMoney(Math.round(trend.price_avg_sell * 0.95))} aUEC
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
                        5% abaixo da média atual ({ptMoney(trend.price_avg_sell)} aUEC) para competitividade
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop:9, padding:'9px 10px', background:'rgba(56,189,248,0.045)', border:'1px solid rgba(56,189,248,0.2)', borderRadius:6 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', marginBottom:5 }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'var(--accent-primary)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Análise de desconto competitivo</div>
                      <button onClick={event => { event.stopPropagation(); analyzeDiscount(); }} disabled={discountLoading} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 8px', color:'var(--accent-primary)', background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:4, cursor:discountLoading?'not-allowed':'pointer', fontSize:10, fontWeight:700, opacity:discountLoading?0.65:1 }}>
                        <RefreshCw size={10} style={{ animation:discountLoading?'spin 1s linear infinite':'none' }}/> {discountLoading ? 'Analisando...' : discountAnalysis ? 'Atualizar análise' : 'Analisar concorrentes'}
                      </button>
                    </div>
                    {!discountAnalysis && !discountError && <div style={{ fontSize:10, color:'var(--text-muted)', lineHeight:1.45 }}>Consulte os anúncios ativos do mesmo item para calcular uma sugestão. O preço não será alterado automaticamente.</div>}
                    {discountError && <div style={{ fontSize:10, color:'var(--accent-red)', lineHeight:1.45 }}>{discountError}</div>}
                    {discountAnalysis && (
                      <div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                          <div><div style={{ fontSize:9, color:'var(--text-muted)' }}>Preço anterior</div><strong style={{ fontFamily:'Share Tech Mono,monospace', color:'var(--text-primary)' }}>{ptMoney(discountAnalysis.previousPrice)} aUEC</strong></div>
                          <div><div style={{ fontSize:9, color:'var(--text-muted)' }}>Menor concorrente</div><strong style={{ fontFamily:'Share Tech Mono,monospace', color:'var(--accent-gold)' }}>{discountAnalysis.competitorLowest ? `${ptMoney(discountAnalysis.competitorLowest)} aUEC` : '—'}</strong></div>
                          <div><div style={{ fontSize:9, color:'var(--text-muted)' }}>Concorrentes analisados</div><strong style={{ fontFamily:'Share Tech Mono,monospace', color:'var(--accent-primary)' }}>{discountAnalysis.competitorCount}</strong></div>
                        </div>
                        {discountAnalysis.status === 'discount_recommended' && <div style={{ marginTop:7, padding:'7px 8px', background:'rgba(52,211,153,0.07)', border:'1px solid rgba(52,211,153,0.22)', borderRadius:5 }}><div style={{ fontSize:10, color:'var(--accent-green)', fontWeight:700 }}>Sugestão: aplicar desconto de {ptDecimal(discountAnalysis.discountPercent)}% ({ptMoney(discountAnalysis.discountValue)} aUEC)</div><div style={{ fontSize:10, color:'var(--text-secondary)', marginTop:2 }}>Preço sugerido: <strong>{ptMoney(discountAnalysis.suggestedPrice)} aUEC</strong>, cerca de 1% abaixo do menor concorrente ativo.</div></div>}
                        {discountAnalysis.status === 'already_competitive' && <div style={{ marginTop:7, fontSize:10, color:'var(--accent-green)', lineHeight:1.45 }}>Seu preço já está igual ou abaixo do menor concorrente ativo. Nenhum desconto é recomendado.</div>}
                        {discountAnalysis.status === 'insufficient_data' && <div style={{ marginTop:7, fontSize:10, color:'var(--text-muted)', lineHeight:1.45 }}>Não há anúncios concorrentes ativos suficientes para sugerir um desconto.</div>}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize:11, color:'var(--text-muted)', padding:'20px 0', textAlign:'center' }}>
                  <Globe size={24} style={{ display:'block', margin:'0 auto 8px', opacity:0.2 }}/>
                  Dados de mercado não disponíveis.<br/>Sincronize com a API UEX.
                </div>
              )}

              {/* Histórico de vendas deste item */}
              {itemSales.length > 0 && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Vendas Registradas</div>
                  {itemSales.slice(0,5).map(s => (
                    <div key={s.id} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'3px 0', borderBottom:'1px solid var(--border-subtle)', color:'var(--text-secondary)' }}>
                      <span>{ptDate(s.date)}{s.buyer?` → ${s.buyer}`:''}</span>
                      <span style={{ fontFamily:'Share Tech Mono,monospace', color:'var(--accent-green)', fontWeight:700 }}>{ptMoney(s.total_revenue)} aUEC</span>
                    </div>
                  ))}
                  <div style={{ fontSize:10, color:'var(--accent-green)', fontWeight:700, marginTop:4 }}>
                    Total: {ptMoney(totalSold)} aUEC
                  </div>
                </div>
              )}
            </div>
          </div>

          {item.notes && (
            <div style={{ marginTop:10, padding:'6px 10px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-subtle)', borderRadius:5, fontSize:11, color:'var(--text-secondary)' }}>
              📝 {item.notes}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}

// ── Tab: Meus Itens (catálogo) ────────────────────────────────────────────────
function MyItemsTab({ catalog, sales, trendData, trendDataFetchedAt, inventoryItems = [], managedLocations = [], armorSets = [], vaultEntries = [], onEditStock, onDeleteItem, onAddEsgotado, onOpenStockLink, onOpenVaultStockLink }) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const stockById = useMemo(() => new Map(catalog.map(item => [String(item.id), getInventoryStockSummary(item, inventoryItems, managedLocations, armorSets)])), [catalog, inventoryItems, managedLocations, armorSets]);
  const vaultById = useMemo(() => new Map(catalog.map(item => [String(item.id), getVaultStockSummary(item, vaultEntries)])), [catalog, vaultEntries]);
  const expiryById = useMemo(() => new Map(catalog.map(item => [String(item.id), listingExpiryState(item)])), [catalog]);
  const salesByTitle = useMemo(() => {
    const map = new Map();
    for (const sale of sales) {
      if (sale.type !== 'sold') continue;
      const key = String(sale.title || '').trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(sale);
    }
    return map;
  }, [sales]);
  const trendById = useMemo(() => new Map(catalog.map(item => [String(item.id), findMarketTrendForItem(item, trendData)])), [catalog, trendData]);
  const displayedStock = item => {
    const summary = stockById.get(String(item.id));
    return summary?.isLinked ? summary.quantity : Number(item.internal_stock) || 0;
  };
  useEffect(() => { setPage(1); }, [deferredSearch, filterStatus, sortBy, catalog.length]);

  const filtered = useMemo(() => {
    let list = catalog;
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();
      list = list.filter(i => i.title?.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q));
    }
    if (filterStatus === 'active')   list = list.filter(i => !i.is_sold_out && (i.in_stock === undefined || i.in_stock > 0));
    if (filterStatus === 'soldout')  list = list.filter(i => i.is_sold_out || (i.in_stock !== undefined && i.in_stock <= 0));
    if (filterStatus === 'expired')  list = list.filter(i => expiryById.get(String(i.id))?.status === 'expired');
    if (filterStatus === 'expiring') list = list.filter(i => expiryById.get(String(i.id))?.status === 'expiring');
    if (sortBy === 'price_asc')  list = [...list].sort((a,b) => (a.price||0) - (b.price||0));
    if (sortBy === 'price_desc') list = [...list].sort((a,b) => (b.price||0) - (a.price||0));
    if (sortBy === 'date')       list = [...list].sort((a,b) => (b.date_added||0) - (a.date_added||0));
    if (sortBy === 'name')       list = [...list].sort((a,b) => (a.title||'').localeCompare(b.title||''));
    if (sortBy === 'stock')      list = [...list].sort((a,b) => displayedStock(b) - displayedStock(a));
    return list;
  }, [catalog, deferredSearch, filterStatus, sortBy, stockById, expiryById]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleItems = useMemo(() => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filtered, safePage]);
  const catalogStats = useMemo(() => {
    let active = 0; let soldout = 0; let totalStock = 0;
    for (const item of catalog) {
      totalStock += displayedStock(item);
      if (item.is_sold_out || (item.in_stock !== undefined && item.in_stock <= 0)) soldout += 1; else active += 1;
    }
    return { active, soldout, totalStock };
  }, [catalog, stockById]);

  const SS = { padding:'5px 22px 5px 8px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none', appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 5px center' };

  return (
    <div>
      {/* Cabeçalho com totais */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', marginBottom:8, padding:'7px 10px', background:'rgba(56,189,248,0.04)', border:'1px solid rgba(56,189,248,0.14)', borderRadius:6 }}>
        <span style={{ fontSize:10, color:'var(--text-muted)' }}>Fonte: <strong style={{ color:'var(--accent-primary)' }}>UEX · marketplace_trends</strong> · médias de venda, faixa de preços, anúncios ativos e negociações</span>
        <span style={{ fontSize:10, color:trendDataFetchedAt ? 'var(--accent-green)' : 'var(--accent-gold)', fontFamily:'Share Tech Mono,monospace' }}>{trendDataFetchedAt ? `Consultado em ${ptDate(trendDataFetchedAt)}` : 'Ainda não consultado'}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        {[
          { label:'Total de Itens', value:catalog.length, color:'var(--accent-primary)', sub:'no catálogo' },
          { label:'Ativos', value:catalogStats.active, color:'var(--accent-green)', sub:'listados ativamente' },
          { label:'Esgotados', value:catalogStats.soldout, color:'var(--accent-red)', sub:'sem estoque' },
          { label:'Estoque Total', value:catalogStats.totalStock, color:'var(--accent-gold)', sub:'no inventário/vínculos' },
        ].map(({label,value,color,sub}) => (
          <div key={label} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontFamily:'Michroma,sans-serif', fontSize:18, fontWeight:800, color }}>{value}</div>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontStyle:'italic' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:160 }}>
          <Search size={11} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
          <input style={{ width:'100%', padding:'6px 10px 6px 26px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none', boxSizing:'border-box' }}
            placeholder="Buscar item ou local..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select style={SS} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="soldout">Esgotados</option>
          <option value="expired">Anúncios expirados</option>
          <option value="expiring">Expira em até 10 dias</option>
        </select>
        <select style={SS} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="date">Mais recente</option>
          <option value="name">Nome A-Z</option>
          <option value="price_desc">Maior preço</option>
          <option value="price_asc">Menor preço</option>
          <option value="stock">Maior estoque</option>
        </select>
        <button onClick={onAddEsgotado} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:'rgba(251,113,133,0.08)', border:'1px solid rgba(251,113,133,0.25)', borderRadius:5, color:'var(--accent-red)', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'"Exo 2",sans-serif', textTransform:'uppercase', whiteSpace:'nowrap' }}>
          <Plus size={11}/> Esgotado Manual
        </button>
        <span style={{ marginLeft:'auto', fontFamily:'Share Tech Mono,monospace', fontSize:11, color:'var(--text-muted)' }}>{filtered.length} item{filtered.length!==1?'s':''}{filtered.length > PAGE_SIZE ? ` · página ${safePage}/${totalPages}` : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'50px 0', color:'var(--text-muted)' }}>
          <ShoppingBag size={40} style={{ display:'block', margin:'0 auto 12px', opacity:0.15 }}/>
          <div style={{ fontSize:13, fontFamily:'Michroma,sans-serif', fontWeight:700 }}>
            {catalog.length === 0 ? 'NENHUM ITEM' : 'NENHUM RESULTADO'}
          </div>
          <div style={{ fontSize:12, marginTop:6 }}>
            {catalog.length === 0 ? 'Sincronize com a UEX para importar seus anúncios.' : 'Ajuste os filtros de busca.'}
          </div>
        </div>
      ) : (
        visibleItems.map(item => (
          <CatalogItemCard
            key={item.id}
            item={item}
            sales={sales}
            itemSales={salesByTitle.get(String(item.title || '').trim().toLowerCase()) || []}
            inventorySummary={stockById.get(String(item.id))}
            vaultSummary={vaultById.get(String(item.id))}
            marketTrend={trendById.get(String(item.id))}
            trendData={trendData}
            trendDataFetchedAt={trendDataFetchedAt}
            inventoryItems={inventoryItems}
            managedLocations={managedLocations}
            armorSets={armorSets}
            vaultEntries={vaultEntries}
            onOpenStockLink={onOpenStockLink}
            onOpenVaultStockLink={onOpenVaultStockLink}
            onEditStock={onEditStock}
            onDelete={onDeleteItem}
          />
                ))
      )}
      {filtered.length > PAGE_SIZE && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, padding:'14px 0' }}>
          <button className="filter-chip" disabled={safePage <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>‹ Anterior</button>
          <span style={{ color:'var(--text-muted)', fontSize:11, fontFamily:'Share Tech Mono,monospace' }}>{safePage} / {totalPages}</span>
          <button className="filter-chip" disabled={safePage >= totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>Próxima ›</button>
        </div>
      )}
    </div>
  );
}
// ── Modal de detalhes e edição de venda ────────────────────────────────────────
function SaleDetailsModal({ sale, onClose, onSave }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(sale.title || '');
  const [type, setType] = useState(sale.type || 'sold');
  const [date, setDate] = useState(() => {
    const ms = toTimestampMs(sale.date);
    if (!ms) return '';
    const value = new Date(ms);
    const pad = number => String(number).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  });
  const [price, setPrice] = useState(String(sale.price ?? ''));
  const [qty, setQty] = useState(String(sale.qty ?? 1));
  const [quality, setQuality] = useState(sale.quality || '');
  const [buyer, setBuyer] = useState(sale.buyer || '');
  const [location, setLocation] = useState(sale.location || '');
  const [currency, setCurrency] = useState(sale.currency || 'aUEC');
  const [notes, setNotes] = useState(sale.notes || '');
  const [error, setError] = useState('');

  const IS = { width:'100%', boxSizing:'border-box', padding:'8px 10px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:13, outline:'none' };
  const SS = { ...IS, appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center', paddingRight:28 };
  const LS = { display:'block', marginBottom:4, fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em' };
  const typeLabel = type === 'sold' ? 'Venda concretizada' : type === 'failed' ? 'Venda não concretizada' : 'Listagem expirada';
  const typeColor = type === 'sold' ? 'var(--accent-green)' : type === 'failed' ? 'var(--accent-red)' : 'var(--text-muted)';
  const typeIcon = type === 'sold' ? '✅' : type === 'failed' ? '❌' : '⏰';
  const numericPrice = Number(String(price).replace(',', '.')) || 0;
  const numericQty = Math.max(1, parseInt(qty, 10) || 1);
  const calculatedTotal = type === 'sold' ? Math.round(numericPrice * numericQty) : 0;

  function cancelEditing() {
    setTitle(sale.title || '');
    setType(sale.type || 'sold');
    setPrice(String(sale.price ?? ''));
    setQty(String(sale.qty ?? 1));
    setQuality(sale.quality || '');
    setBuyer(sale.buyer || '');
    setLocation(sale.location || '');
    setCurrency(sale.currency || 'aUEC');
    setNotes(sale.notes || '');
    setError('');
    setEditing(false);
  }

  function handleSave() {
    if (!title.trim()) { setError('Informe o nome do item.'); return; }
    if (numericPrice <= 0) { setError('O preço unitário deve ser maior que zero.'); return; }
    const timestamp = date ? new Date(`${date}T12:00:00`).getTime() / 1000 : sale.date;
    const updated = {
      ...sale,
      title: title.trim(),
      type,
      date: Number.isFinite(timestamp) ? timestamp : sale.date,
      price: Math.round(numericPrice),
      qty: numericQty,
      total_revenue: calculatedTotal,
      quality: quality.trim(),
      buyer: buyer.trim(),
      location: location.trim(),
      currency: currency.trim() || 'aUEC',
      notes: notes.trim(),
      edited_at: new Date().toISOString(),
    };
    onSave(updated);
    setEditing(false);
    setError('');
  }

  const detailRows = [
    ['Item', sale.title || '—'],
    ['Status', `${typeIcon} ${typeLabel}`],
    ['Data do registro', ptDateTime(sale.date)],
    ['Preço unitário', `${ptMoney(sale.price)} ${sale.currency || 'aUEC'}`],
    ['Quantidade', `${sale.qty || 1}`],
    ['Receita total', `${ptMoney(sale.total_revenue || 0)} ${sale.currency || 'aUEC'}`],
    ['Qualidade', sale.quality || 'Não informada'],
    ['Comprador / IGN', sale.buyer || 'Não informado'],
    ['Localização', sale.location || 'Não informada'],
    ['Origem', sale.is_manual ? 'Registro manual' : sale.source === 'uex_negotiation' ? 'Negociação UEX' : sale.source || 'Não informada'],
  ];
  const technicalRows = [
    ['ID do histórico', sale.id],
    ['Hash da negociação', sale.source_negotiation_hash],
    ['ID do anúncio', sale.source_listing_id],
    ['Slug do anúncio', sale.source_listing_slug],
    ['Título original do anúncio', sale.listing_title],
    ['Papel na negociação', sale.negotiation_role],
    ['Data de encerramento UEX', sale.date_closed ? ptDateTime(sale.date_closed) : null],
    ['Criado em', sale.created_at ? ptDateTime(sale.created_at) : null],
    ['Editado em', sale.edited_at ? ptDateTime(sale.edited_at) : null],
  ].filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '');

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1200, padding:16, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center' }} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div style={{ width:'min(760px, 100%)', maxHeight:'92vh', overflowY:'auto', background:'var(--bg-card)', border:'1px solid rgba(56,189,248,0.35)', borderRadius:12, boxShadow:'0 24px 80px rgba(0,0,0,0.72)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'14px 18px', borderBottom:'1px solid var(--border-subtle)', background:'rgba(56,189,248,0.07)' }}>
          <div style={{ minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--accent-primary)', fontFamily:'Michroma,sans-serif', fontSize:12, fontWeight:700, letterSpacing:'0.05em' }}><Eye size={15}/> DETALHES DA VENDA</div>
            <div style={{ marginTop:5, color:'var(--text-muted)', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sale.title || 'Registro sem título'}</div>
          </div>
          <button onClick={onClose} title="Fechar detalhes" aria-label="Fechar detalhes" style={{ width:28, height:28, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-muted)', cursor:'pointer' }}><X size={14}/></button>
        </div>

        <div style={{ padding:18 }}>
          {!editing ? (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, padding:'9px 11px', background:type === 'sold' ? 'rgba(52,211,153,0.07)' : 'rgba(251,113,133,0.06)', border:`1px solid ${type === 'sold' ? 'rgba(52,211,153,0.24)' : 'rgba(251,113,133,0.2)'}`, borderRadius:7 }}>
                <span style={{ fontSize:17 }}>{typeIcon}</span>
                <div><div style={{ color:typeColor, fontSize:12, fontWeight:700 }}>{typeLabel}</div><div style={{ color:'var(--text-muted)', fontSize:10, marginTop:2 }}>Clique em editar para corrigir ou complementar os dados deste histórico.</div></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:7 }}>
                {detailRows.map(([label, value]) => (
                  <div key={label} style={{ padding:'8px 10px', background:'rgba(255,255,255,0.025)', border:'1px solid var(--border-subtle)', borderRadius:6 }}>
                    <div style={{ color:'var(--text-muted)', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
                    <div style={{ marginTop:4, color:label === 'Receita total' ? 'var(--accent-green)' : 'var(--text-primary)', fontFamily:label === 'Preço unitário' || label === 'Receita total' ? 'Share Tech Mono,monospace' : '"Exo 2",sans-serif', fontSize:12, fontWeight:label === 'Receita total' ? 800 : 600, wordBreak:'break-word' }}>{value}</div>
                  </div>
                ))}
              </div>
              {sale.notes && <div style={{ marginTop:12, padding:'10px 12px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-subtle)', borderRadius:6, color:'var(--text-secondary)', fontSize:12, lineHeight:1.5, whiteSpace:'pre-wrap' }}><strong style={{ color:'var(--text-muted)', fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Notas</strong><div style={{ marginTop:5 }}>{sale.notes}</div></div>}
              {technicalRows.length > 0 && (
                <details style={{ marginTop:12 }}>
                  <summary style={{ cursor:'pointer', color:'var(--accent-primary)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>Metadados técnicos da origem UEX</summary>
                  <div style={{ marginTop:7, display:'flex', flexDirection:'column', gap:4 }}>
                    {technicalRows.map(([label, value]) => <div key={label} style={{ display:'flex', justifyContent:'space-between', gap:14, padding:'5px 0', borderBottom:'1px solid var(--border-subtle)', fontSize:10 }}><span style={{ color:'var(--text-muted)' }}>{label}</span><span style={{ color:'var(--text-secondary)', fontFamily:'Share Tech Mono,monospace', textAlign:'right', wordBreak:'break-all' }}>{value}</span></div>)}
                  </div>
                </details>
              )}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
                <button onClick={onClose} style={{ padding:'8px 14px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:6, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700 }}>Fechar</button>
                <button onClick={()=>setEditing(true)} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:6, color:'var(--accent-primary)', cursor:'pointer', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700 }}><Edit3 size={12}/> Editar histórico</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:10 }}>
                <div style={{ gridColumn:'1 / -1' }}><label style={LS}>Nome do item</label><input style={IS} value={title} onChange={event=>setTitle(event.target.value)} /></div>
                <div><label style={LS}>Tipo do registro</label><select style={SS} value={type} onChange={event=>setType(event.target.value)}><option value="sold">✅ Venda concretizada</option><option value="failed">❌ Venda não concretizada</option><option value="expired">⏰ Listagem expirada</option></select></div>
                <div><label style={LS}>Data</label><input style={IS} type="date" value={date} onChange={event=>setDate(event.target.value)} /></div>
                <div><label style={LS}>Preço unitário</label><input style={{ ...IS, fontFamily:'Share Tech Mono,monospace' }} type="number" min="0" value={price} onChange={event=>setPrice(event.target.value)} /></div>
                <div><label style={LS}>Quantidade</label><input style={IS} type="number" min="1" step="1" value={qty} onChange={event=>setQty(event.target.value)} /></div>
                <div><label style={LS}>Moeda</label><input style={IS} value={currency} onChange={event=>setCurrency(event.target.value)} /></div>
                <div><label style={LS}>Qualidade</label><input style={IS} placeholder="ex.: 716, Grade A..." value={quality} onChange={event=>setQuality(event.target.value)} /></div>
                <div><label style={LS}>Comprador / IGN</label><input style={IS} value={buyer} onChange={event=>setBuyer(event.target.value)} /></div>
                <div><label style={LS}>Localização</label><input style={IS} value={location} onChange={event=>setLocation(event.target.value)} /></div>
                <div style={{ gridColumn:'1 / -1' }}><label style={LS}>Notas</label><textarea style={{ ...IS, minHeight:74, resize:'vertical' }} value={notes} onChange={event=>setNotes(event.target.value)} /></div>
              </div>
              <div style={{ marginTop:12, padding:'9px 11px', background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:6, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}><span style={{ color:'var(--text-muted)', fontSize:11 }}>Receita recalculada</span><strong style={{ color:'var(--accent-green)', fontFamily:'Share Tech Mono,monospace', fontSize:14 }}>{ptMoney(calculatedTotal)} {currency || 'aUEC'}</strong></div>
              {error && <div style={{ marginTop:10, color:'var(--accent-red)', fontSize:11 }}><AlertTriangle size={12} style={{ verticalAlign:'-2px', marginRight:4 }}/>{error}</div>}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
                <button onClick={cancelEditing} style={{ padding:'8px 14px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:6, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700 }}>Cancelar</button>
                <button onClick={handleSave} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:6, color:'var(--accent-green)', cursor:'pointer', fontFamily:'"Exo 2",sans-serif', fontSize:11, fontWeight:700 }}><Save size={12}/> Salvar alterações</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Vendas / Ocorrências ─────────────────────────────────────────────────
function SalesTab({ sales, onDelete, onUpdate }) {
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [delConf, setDelConf] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);

  const filtered = useMemo(() => {
    let list = [...sales].sort((a,b) => (b.date||0) - (a.date||0));
    if (filterType !== 'all') list = list.filter(s => s.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.title?.toLowerCase().includes(q) || s.buyer?.toLowerCase().includes(q));
    }
    return list;
  }, [sales, filterType, search]);

  const totalRevenue = sales.filter(s=>s.type==='sold').reduce((a,s)=>a+(s.total_revenue||0),0);
  const totalSold    = sales.filter(s=>s.type==='sold').length;
  const totalFailed  = sales.filter(s=>s.type==='failed').length;
  const totalExpired = sales.filter(s=>s.type==='expired').length;

  const SS = { padding:'5px 22px 5px 8px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none', appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 5px center' };

  // Dados para gráfico: receita por dia (últimos 14 dias)
  const chartData = useMemo(() => {
    const days = [];
    for (let i=13; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const ds = d.toISOString().slice(0,10);
      const dayRevenue = sales
        .filter(s => s.type==='sold' && s.date && new Date(s.date*1000).toISOString().slice(0,10) === ds)
        .reduce((a,s) => a+(s.total_revenue||0), 0);
      days.push({ label:`${d.getDate()}/${d.getMonth()+1}`, value:dayRevenue });
    }
    return days;
  }, [sales]);

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        {[
          { label:'Receita Total', value:`${ptMoney(totalRevenue)} aUEC`, color:'var(--accent-green)' },
          { label:'Vendas Concretizadas', value:totalSold, color:'var(--accent-primary)' },
          { label:'Não Concretizadas', value:totalFailed, color:'var(--accent-red)' },
          { label:'Expiradas', value:totalExpired, color:'var(--text-muted)' },
        ].map(({label,value,color}) => (
          <div key={label} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontFamily:'Michroma,sans-serif', fontSize:16, fontWeight:800, color }}>{value}</div>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Gráfico de receita */}
      {totalRevenue > 0 && (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:8, padding:'12px 14px', marginBottom:14 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
            <TrendingUp size={10} style={{ display:'inline', marginRight:4 }}/> Receita por Dia — últimos 14 dias
          </div>
          <MiniBarChart data={chartData} color="var(--accent-green)" height={80}/>
        </div>
      )}

      {/* Filtros + lista */}
      <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:140 }}>
          <Search size={11} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
          <input style={{ width:'100%', padding:'6px 10px 6px 26px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none', boxSizing:'border-box' }}
            placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select style={SS} value={filterType} onChange={e=>setFilterType(e.target.value)}>
          <option value="all">Todos os tipos</option>
          <option value="sold">✅ Vendas</option>
          <option value="failed">❌ Não concretizadas</option>
          <option value="expired">⏰ Expiradas</option>
        </select>
        <span style={{ marginLeft:'auto', fontFamily:'Share Tech Mono,monospace', fontSize:11, color:'var(--text-muted)' }}>{filtered.length} registro{filtered.length!==1?'s':''}</span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)', fontSize:12 }}>Nenhum registro encontrado.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {filtered.map(s => {
            const typeIcon   = s.type==='sold'?'✅':s.type==='failed'?'❌':'⏰';
            const typeColor  = s.type==='sold'?'var(--accent-green)':s.type==='failed'?'var(--accent-red)':'var(--text-muted)';
            return (
              <div key={s.id} role="button" tabIndex={0} onClick={()=>setSelectedSale(s)} onKeyDown={event=>{ if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedSale(s); } }} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:7, cursor:'pointer', transition:'border-color 0.16s, background 0.16s' }} onMouseEnter={event=>{event.currentTarget.style.borderColor='rgba(56,189,248,0.38)'; event.currentTarget.style.background='rgba(56,189,248,0.045)';}} onMouseLeave={event=>{event.currentTarget.style.borderColor='var(--border-subtle)'; event.currentTarget.style.background='var(--bg-card)';}}>
                <span style={{ fontSize:14 }}>{typeIcon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>
                    {ptDateTime(s.date)}
                    {s.quality !== null && s.quality !== undefined && String(s.quality).trim() !== '' && Number(s.quality) > 0 && <span style={{ marginLeft:8, color:'var(--accent-gold)' }}>★ {s.quality}</span>}
                    {s.buyer && <span style={{ marginLeft:8 }}>→ {s.buyer}</span>}
                    {s.notes && <span style={{ marginLeft:8, fontStyle:'italic' }}>{s.notes}</span>}
                  </div>
                </div>
                {s.type === 'sold' && (
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontFamily:'Share Tech Mono,monospace', fontSize:12, fontWeight:700, color:'var(--accent-green)' }}>{ptMoney(s.total_revenue)} aUEC</div>
                    {s.qty > 1 && <div style={{ fontSize:10, color:'var(--text-muted)' }}>{s.qty}× {ptMoney(s.price)}</div>}
                  </div>
                )}
                <button onClick={event=>{event.stopPropagation(); setSelectedSale(s);}} title="Ver detalhes da venda" aria-label={`Ver detalhes de ${s.title || 'venda'}`} style={{ width:28, height:28, borderRadius:5, border:'1px solid rgba(56,189,248,0.24)', background:'rgba(56,189,248,0.07)', color:'var(--accent-primary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Eye size={12}/></button>
                {delConf===s.id ? (
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={event=>{event.stopPropagation(); onDelete(s.id); setDelConf(null);}} style={{ padding:'3px 7px', background:'rgba(251,113,133,0.15)', border:'1px solid rgba(251,113,133,0.4)', borderRadius:3, color:'var(--accent-red)', cursor:'pointer', fontSize:10, fontWeight:700 }}>Sim</button>
                    <button onClick={event=>{event.stopPropagation(); setDelConf(null);}} style={{ padding:'3px 7px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:3, color:'var(--text-secondary)', cursor:'pointer', fontSize:10 }}>Não</button>
                  </div>
                ) : (
                  <button onClick={event=>{event.stopPropagation(); setDelConf(s.id);}} title="Excluir registro" aria-label={`Excluir ${s.title || 'venda'}`} style={{ width:24, height:24, borderRadius:4, border:'1px solid rgba(251,113,133,0.2)', background:'rgba(251,113,133,0.08)', color:'var(--accent-red)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Trash2 size={10}/>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedSale && <SaleDetailsModal sale={selectedSale} onClose={()=>setSelectedSale(null)} onSave={updated=>{ onUpdate(updated); setSelectedSale(updated); }} />}
    </div>
  );
}

// ── Tab: Tendências do Mercado ────────────────────────────────────────────────
function TrendsTab({ catalog, trendData, trendDataFetchedAt, loading, onRefresh }) {
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState('variation_desc');
  const [filters, setFilters] = useState({
    avgSellMin:'', avgSellMax:'', monthAvgMin:'', monthAvgMax:'',
    minSellMin:'', minSellMax:'', maxSellMin:'', maxSellMax:'',
    listingsMin:'', listingsMax:'', negotiationsMin:'', negotiationsMax:'',
    variationMin:'', variationMax:'',
  });

  const toMetricNumber = value => {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const myItems = useMemo(() => {
    if (!Array.isArray(trendData) || trendData.length === 0 || catalog.length === 0) return [];
    return catalog.map(item => {
      const trend = findMarketTrendForItem(item, trendData);
      if (!trend) return null;
      const avgSell = toMetricNumber(trend.price_avg_sell);
      const monthAvg = toMetricNumber(trend.price_avg_month_sell);
      const variation = monthAvg > 0 ? ((avgSell - monthAvg) / monthAvg) * 100 : null;
      const recommended = avgSell > 0 ? Math.round(avgSell * 0.95) : null;
      const ownPrice = toMetricNumber(item.price);
      const directListingUrl = [item.listing_url, item.listingUrl, item.url, item.link, item.source_listing_url]
        .map(value => String(value || '').trim())
        .find(value => /^https?:\/\//i.test(value));
      const listingSlug = item.source_listing_slug || item.listing_slug || item.slug;
      const listingUrl = directListingUrl || (listingSlug ? buildUexListingUrl(listingSlug) : (trend.link_prices || 'https://uexcorp.space/marketplace/'));
      return {
        item,
        trend,
        listingUrl,
        avgSell,
        monthAvg,
        minSell: toMetricNumber(trend.price_min_sell),
        maxSell: toMetricNumber(trend.price_max_sell),
        listings: toMetricNumber(trend.listings_count_sell),
        negotiations: toMetricNumber(trend.negotiations_count),
        variation,
        recommended,
        priceDiff: recommended && ownPrice ? recommended - ownPrice : null,
      };
    }).filter(Boolean);
  }, [catalog, trendData]);

  const setFilter = (key, value) => setFilters(previous => ({ ...previous, [key]: value }));
  const withinRange = (value, min, max) => {
    const minValue = min === '' ? null : toMetricNumber(min);
    const maxValue = max === '' ? null : toMetricNumber(max);
    return (minValue === null || value >= minValue) && (maxValue === null || value <= maxValue);
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = myItems.filter(row => {
      const matchesSearch = !query || row.item.title?.toLowerCase().includes(query) || row.trend.item_name?.toLowerCase().includes(query);
      return matchesSearch
        && withinRange(row.avgSell, filters.avgSellMin, filters.avgSellMax)
        && withinRange(row.monthAvg, filters.monthAvgMin, filters.monthAvgMax)
        && withinRange(row.minSell, filters.minSellMin, filters.minSellMax)
        && withinRange(row.maxSell, filters.maxSellMin, filters.maxSellMax)
        && withinRange(row.listings, filters.listingsMin, filters.listingsMax)
        && withinRange(row.negotiations, filters.negotiationsMin, filters.negotiationsMax)
        && ((filters.variationMin === '' && filters.variationMax === '') || (row.variation !== null && withinRange(row.variation, filters.variationMin, filters.variationMax)));
    });
    const direction = sortBy.endsWith('_asc') ? 1 : -1;
    const metricKey = sortBy.replace(/_(?:asc|desc)$/, '');
    return [...list].sort((a, b) => {
      if (metricKey === 'name') return a.item.title.localeCompare(b.item.title) * direction;
      const aValue = a[metricKey] === null ? Number.NEGATIVE_INFINITY : a[metricKey];
      const bValue = b[metricKey] === null ? Number.NEGATIVE_INFINITY : b[metricKey];
      return (aValue - bValue) * direction;
    });
  }, [myItems, search, filters, sortBy]);

  const activeFilterCount = Object.values(filters).filter(value => value !== '').length;
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [referenceAds, setReferenceAds] = useState({});
  const [referenceLoadingId, setReferenceLoadingId] = useState(null);
  const [referenceErrors, setReferenceErrors] = useState({});

  async function toggleReferenceAds(row) {
    const key = String(row.item.id);
    if (expandedItemId === key) {
      setExpandedItemId(null);
      return;
    }
    setExpandedItemId(key);
    if (Object.prototype.hasOwnProperty.call(referenceAds, key)) return;
    const itemId = row.trend?.id_item ?? row.trend?.uex_item_id;
    if (itemId === null || itemId === undefined || String(itemId).trim() === '') {
      setReferenceErrors(previous => ({ ...previous, [key]: 'A UEX não retornou o id_item necessário para consultar os anúncios.' }));
      return;
    }
    setReferenceLoadingId(key);
    setReferenceErrors(previous => ({ ...previous, [key]: '' }));
    try {
      const response = await uexFetch(`marketplace_listings?id_item=${encodeURIComponent(itemId)}&operation=sell`);
      const data = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
      const references = data
        .filter(ad => String(ad?.id_item ?? '') === String(itemId) && String(ad?.operation || 'sell').toLowerCase() === 'sell' && Number(ad?.is_sold_out) !== 1 && String(ad?.id ?? '') !== String(row.item.id))
        .sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0))
        .slice(0, 3);
      setReferenceAds(previous => ({ ...previous, [key]: references }));
    } catch (error) {
      setReferenceErrors(previous => ({ ...previous, [key]: error.message || 'Não foi possível carregar os anúncios de referência.' }));
    } finally {
      setReferenceLoadingId(null);
    }
  }

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:'1 1 220px', minWidth:180 }}>
          <Search size={11} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
          <input style={{ width:'100%', padding:'7px 10px 7px 26px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none', boxSizing:'border-box' }}
            placeholder="Buscar item..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ padding:'7px 24px 7px 8px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontSize:11, outline:'none' }}>
          <option value="variation_desc">Maior alta vs 30 dias</option>
          <option value="variation_asc">Menor alta vs 30 dias</option>
          <option value="avgSell_desc">Maior média atual</option>
          <option value="avgSell_asc">Menor média atual</option>
          <option value="listings_desc">Mais anúncios ativos</option>
          <option value="negotiations_desc">Mais negociações</option>
          <option value="name_asc">Nome A-Z</option>
        </select>
        <button onClick={() => setFiltersOpen(value => !value)} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 10px', background:activeFilterCount ? 'rgba(251,191,36,0.12)' : 'rgba(56,189,248,0.06)', border:`1px solid ${activeFilterCount ? 'rgba(251,191,36,0.35)' : 'var(--border-subtle)'}`, borderRadius:5, color:activeFilterCount ? 'var(--accent-gold)' : 'var(--accent-primary)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
          <Filter size={11}/> Filtros {activeFilterCount ? `(${activeFilterCount})` : ''}
        </button>
        <button onClick={onRefresh} disabled={loading} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 10px', background:'rgba(56,189,248,0.06)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--accent-primary)', cursor:loading?'not-allowed':'pointer', fontSize:11, fontWeight:700, opacity:loading?0.5:1 }}>
          <RefreshCw size={11} style={{ animation:loading?'spin 1s linear infinite':'none' }}/> Atualizar
        </button>
        <span style={{ marginLeft:'auto', fontFamily:'Share Tech Mono,monospace', fontSize:11, color:'var(--text-muted)' }}>{filtered.length}/{myItems.length} com dados</span>
      </div>
      <div style={{ marginBottom:10, fontSize:10, color:'var(--text-muted)' }}>
        Fonte: <strong style={{ color:'var(--accent-primary)' }}>UEX · marketplace_trends</strong> · {trendDataFetchedAt ? `snapshot consultado em ${ptDate(trendDataFetchedAt)}` : 'snapshot ainda não consultado'} · cache informado pela UEX: até 1h.
      </div>
      {filtersOpen && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))', gap:8, marginBottom:12, padding:10, background:'rgba(56,189,248,0.04)', border:'1px solid rgba(56,189,248,0.18)', borderRadius:7 }}>
          {[
            ['avgSell','Média atual de venda','aUEC'],
            ['monthAvg','Média de 30 dias','aUEC'],
            ['minSell','Mínimo de venda','aUEC'],
            ['maxSell','Máximo de venda','aUEC'],
            ['listings','Anúncios ativos','qtd.'],
            ['negotiations','Negociações','qtd.'],
            ['variation','Variação vs 30 dias','%'],
          ].map(([key, label, unit]) => (
            <div key={key} style={{ padding:8, background:'rgba(255,255,255,0.025)', border:'1px solid var(--border-subtle)', borderRadius:5 }}>
              <div style={{ fontSize:9, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>{label} · {unit}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                <input type="number" value={filters[`${key}Min`]} onChange={e=>setFilter(`${key}Min`, e.target.value)} placeholder="Mín." style={{ width:'100%', boxSizing:'border-box', padding:'5px 6px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:4, color:'var(--text-primary)', fontSize:11, outline:'none' }}/>
                <input type="number" value={filters[`${key}Max`]} onChange={e=>setFilter(`${key}Max`, e.target.value)} placeholder="Máx." style={{ width:'100%', boxSizing:'border-box', padding:'5px 6px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:4, color:'var(--text-primary)', fontSize:11, outline:'none' }}/>
              </div>
            </div>
          ))}
          <button onClick={() => setFilters({ avgSellMin:'', avgSellMax:'', monthAvgMin:'', monthAvgMax:'', minSellMin:'', minSellMax:'', maxSellMin:'', maxSellMax:'', listingsMin:'', listingsMax:'', negotiationsMin:'', negotiationsMax:'', variationMin:'', variationMax:'' })} style={{ alignSelf:'end', padding:'7px 10px', border:'1px solid rgba(251,113,133,0.28)', borderRadius:5, background:'rgba(251,113,133,0.07)', color:'var(--accent-red)', cursor:'pointer', fontSize:11, fontWeight:700 }}>Limpar filtros</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
          <Globe size={36} style={{ display:'block', margin:'0 auto 10px', opacity:0.15 }}/>
          <div style={{ fontSize:12 }}>
            {loading ? 'Carregando dados de mercado...' : catalog.length === 0 ? 'Sincronize primeiro para ver tendências.' : 'Nenhum item do seu catálogo encontrado nos trends da UEX.'}
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {filtered.map(row => {
            const { item, trend: t, listingUrl, variation, recommended, priceDiff } = row;

            return (
              <div key={item.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:8, padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'"Exo 2",sans-serif', fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{item.title}</span>
                      {item.quality !== null && item.quality !== undefined && String(item.quality).trim() !== '' && Number(item.quality) > 0 && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(255,200,0,0.1)', color:'var(--accent-gold)', border:'1px solid rgba(255,200,0,0.25)', fontWeight:700 }}>★ {item.quality}</span>}
                      {variation !== null && (
                        <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, color: variation>=0?'var(--accent-green)':'var(--accent-red)', fontWeight:700 }}>
                          {variation >= 0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                          {variation>=0?'+':''}{ptDecimal(variation)}%
                        </span>
                      )}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                      <div style={{ padding:'6px 8px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-subtle)', borderRadius:5 }}>
                        <div style={{ fontFamily:'Share Tech Mono,monospace', fontSize:12, color:'var(--accent-green)', fontWeight:700 }}>{ptMoney(t.price_avg_sell)}</div>
                        <div style={{ fontSize:9, color:'var(--text-muted)' }}>Média atual</div>
                      </div>
                      <div style={{ padding:'6px 8px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border-subtle)', borderRadius:5 }}>
                        <div style={{ fontFamily:'Share Tech Mono,monospace', fontSize:12, color:'var(--text-secondary)', fontWeight:700 }}>{ptMoney(t.price_avg_month_sell)}</div>
                        <div style={{ fontSize:9, color:'var(--text-muted)' }}>Média 30 dias</div>
                      </div>
                      <div style={{ padding:'6px 8px', background:'rgba(255,200,0,0.06)', border:'1px solid rgba(255,200,0,0.2)', borderRadius:5 }}>
                        <div style={{ fontFamily:'Share Tech Mono,monospace', fontSize:12, color:'var(--accent-gold)', fontWeight:700 }}>{recommended ? ptMoney(recommended) : '—'}</div>
                        <div style={{ fontSize:9, color:'var(--text-muted)' }}>Recomendado</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>Seu preço:</div>
                    <div style={{ fontFamily:'Michroma,sans-serif', fontSize:14, fontWeight:800, color:'var(--accent-primary)' }}>{ptMoney(item.price)}</div>
                    {priceDiff !== null && (
                      <div style={{ fontSize:10, marginTop:2, color: priceDiff > 0 ? 'var(--accent-red)' : priceDiff < 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                        {priceDiff > 0 ? `Abaixo do recomendado por ${ptMoney(priceDiff)}` : priceDiff < 0 ? `Acima do recomendado por ${ptMoney(-priceDiff)}` : 'No preço ideal'}
                      </div>
                    )}
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>
                      {t.negotiations_count} negoc. · {t.listings_count_sell} anúncios
                    </div>
                    <a href={listingUrl} target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5, marginTop:8, padding:'6px 9px', background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.28)', borderRadius:5, color:'var(--accent-primary)', fontSize:10, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }} title="Abrir este anúncio na UEX">
                      <ExternalLink size={11}/> Abrir anúncio UEX
                    </a>
                    <button type="button" onClick={() => toggleReferenceAds(row)} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5, marginTop:6, padding:'6px 9px', background:expandedItemId === String(item.id) ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.03)', border:`1px solid ${expandedItemId === String(item.id) ? 'rgba(251,191,36,0.3)' : 'var(--border-subtle)'}`, borderRadius:5, color:expandedItemId === String(item.id) ? 'var(--accent-gold)' : 'var(--text-secondary)', cursor:'pointer', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }} title="Mostrar até três anúncios de referência">
                      {expandedItemId === String(item.id) ? <ChevronUp size={11}/> : <ChevronDown size={11}/>} {expandedItemId === String(item.id) ? 'Ocultar referências' : 'Comparar 3 anúncios'}
                    </button>
                  </div>
                </div>
                {expandedItemId === String(item.id) && (
                  <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid rgba(148,163,184,0.16)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                      <div>
                        <div style={{ fontSize:10, color:'var(--accent-gold)', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em' }}>Anúncios de referência</div>
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>Até 3 anúncios ativos de venda do mesmo item usados para contextualizar o mercado.</div>
                      </div>
                      <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'Share Tech Mono,monospace' }}>{(referenceAds[String(item.id)] || []).length}/3 encontrados</span>
                    </div>
                    {referenceLoadingId === String(item.id) ? (
                      <div style={{ padding:'12px 8px', color:'var(--text-muted)', fontSize:11 }}>Consultando anúncios ativos da UEX...</div>
                    ) : referenceErrors[String(item.id)] ? (
                      <div style={{ padding:'9px 10px', color:'var(--accent-red)', background:'rgba(251,113,133,0.06)', border:'1px solid rgba(251,113,133,0.2)', borderRadius:5, fontSize:11 }}>{referenceErrors[String(item.id)]}</div>
                    ) : (referenceAds[String(item.id)] || []).length === 0 ? (
                      <div style={{ padding:'9px 10px', color:'var(--text-muted)', background:'rgba(255,255,255,0.025)', border:'1px solid var(--border-subtle)', borderRadius:5, fontSize:11 }}>Nenhum anúncio ativo de venda foi encontrado para este item.</div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:7 }}>
                        {(referenceAds[String(item.id)] || []).map((ad, index) => {
                          const directAdUrl = [ad.url, ad.link, ad.listing_url, ad.listingUrl]
                            .map(value => String(value || '').trim())
                            .find(value => /^https?:\/\//i.test(value));
                          const adUrl = directAdUrl || (ad.slug ? buildUexListingUrl(ad.slug) : 'https://uexcorp.space/marketplace/');
                          return (
                            <article key={ad.id || ad.slug || `${item.id}-reference-${index}`} style={{ padding:'9px 10px', background:'rgba(255,255,255,0.025)', border:'1px solid var(--border-subtle)', borderRadius:6 }}>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:6 }}>
                                <span style={{ fontSize:9, color:'var(--text-muted)', fontFamily:'Share Tech Mono,monospace' }}>REF. {index + 1}</span>
                                <strong style={{ fontSize:13, color:'var(--accent-green)', fontFamily:'Share Tech Mono,monospace' }}>{ptMoney(ad.price)} {ad.currency || t.currency || 'UEC'}</strong>
                              </div>
                              <div style={{ display:'grid', gap:3, fontSize:10, color:'var(--text-secondary)' }}>
                                <span><strong>Vendedor:</strong> {ad.user_username || ad.user_name || 'Não informado'}</span>
                                <span><strong>Local:</strong> {ad.location || 'Não informado'}</span>
                                <span><strong>Qualidade:</strong> {ad.quality !== null && ad.quality !== undefined && ad.quality !== '' ? ad.quality : '—'} · <strong>Durabilidade:</strong> {ad.durability !== null && ad.durability !== undefined && ad.durability !== '' ? ad.durability : '—'}</span>
                                <span><strong>Estoque:</strong> {ad.in_stock ?? '—'} · <strong>Origem:</strong> {ad.source || 'Não informada'}</span>
                                <span><strong>Expira:</strong> {ad.date_expiration ? ptDate(ad.date_expiration) : ad.hours_expiration ? `${ad.hours_expiration}h` : 'Não informado'}</span>
                              </div>
                              <a href={adUrl} target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()} style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:8, color:'var(--accent-primary)', fontSize:10, fontWeight:700, textDecoration:'none' }}>
                                <ExternalLink size={10}/> Abrir referência na UEX
                              </a>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function UexSalesPage({ armorSets = [], onConsumeArmorStock }) {
  const [catalog,   setCatalog]   = useState(() => loadCatalog());
  const [sales,     setSales]     = useState(() => loadSales());
  const [trendData, setTrendData] = useState([]);
  const [trendDataFetchedAt, setTrendDataFetchedAt] = useState(null);
  const [username,  setUsername]  = useState(() => loadUsername());
  const [activeTab, setActiveTab] = useState('items');
  const [loading,   setLoading]   = useState(false);
  const [syncMsg,   setSyncMsg]   = useState('');
  const [importQueue, setImportQueue] = useState([]); // listagens aguardando confirmação
  const [showManualSale, setShowManualSale] = useState(false);
  const [showEsgotadoForm, setShowEsgotadoForm] = useState(false);
  const [usernameInput, setUsernameInput] = useState(username);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [vaultEntries, setVaultEntries] = useState(() => loadVault().entries);
  const [managedLocations, setManagedLocations] = useState(() => buildManagedLocationOptions());
  const [stockLinkItem, setStockLinkItem] = useState(null);
  const [vaultLinkItem, setVaultLinkItem] = useState(null);
  // Refs para evitar closure stale no fluxo de importação
  const catalogRef    = React.useRef(catalog);
  const importQueueRef = React.useRef([]);

  // Sincronizar refs com state
  useEffect(() => { catalogRef.current = catalog; }, [catalog]);

  const loadInventoryForStock = useCallback(async () => {
    try {
      const result = window.electronAPI?.inventoryGetAll
        ? await window.electronAPI.inventoryGetAll()
        : (() => {
          try { return JSON.parse(localStorage.getItem('sc_inventory_v1') || '{}').itens || []; } catch { return []; }
        })();
      const items = (Array.isArray(result) ? result : []).map(item => ({ ...item, name: normalizeUexItemName(item.name) }));
      setInventoryItems(items);
      return items;
    } catch {
      setInventoryItems([]);
      return [];
    }
  }, []);

  useEffect(() => {
    loadInventoryForStock();
    setVaultEntries(loadVault().entries);
    const refreshInventory = event => {
      if (Array.isArray(event.detail?.items)) setInventoryItems(event.detail.items.map(item => ({ ...item, name: normalizeUexItemName(item.name) })));
      else loadInventoryForStock();
    };
    const refreshVault = event => {
      if (Array.isArray(event.detail?.vault?.entries)) setVaultEntries(event.detail.vault.entries);
      else setVaultEntries(loadVault().entries);
    };
    const refreshLocations = () => setManagedLocations(buildManagedLocationOptions());
    window.addEventListener(INVENTORY_UPDATED_EVENT, refreshInventory);
    window.addEventListener('sc_ore_vault_updated', refreshVault);
    window.addEventListener(LOCATIONS_UPDATED_EVENT, refreshLocations);
    return () => {
      window.removeEventListener(INVENTORY_UPDATED_EVENT, refreshInventory);
      window.removeEventListener('sc_ore_vault_updated', refreshVault);
      window.removeEventListener(LOCATIONS_UPDATED_EVENT, refreshLocations);
    };
  }, [loadInventoryForStock]);

  useEffect(() => {
    const refreshFromNegotiation = () => {
      const nextCatalog = loadCatalog();
      const nextSales = loadSales();
      catalogRef.current = nextCatalog;
      setCatalog(nextCatalog);
      setSales(nextSales);
    };
    window.addEventListener('sc_uex_sales_updated', refreshFromNegotiation);
    return () => window.removeEventListener('sc_uex_sales_updated', refreshFromNegotiation);
  }, []);

  function refreshCatalog(d) { catalogRef.current = d; setCatalog(d); saveCatalog(d); }
  function refreshSales(d) {
    setSales(d);
    saveSales(d);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sc_uex_sales_updated'));
  }

  // ── Sincronizar listagens da UEX ──
  async function syncFromUEX() {
    if (!username.trim()) { setSyncMsg('⚠ Configure seu IGN da UEX primeiro.'); return; }
    setLoading(true); setSyncMsg('Buscando seus anúncios na UEX...');
    try {
      const data = await uexFetch(`marketplace_listings?username=${encodeURIComponent(username.trim())}`);
      if (!data || data.length === 0) { setSyncMsg('Nenhum anúncio encontrado para este username.'); setLoading(false); return; }

      // Usar catalogRef.current para leitura mais recente (evita closure stale).
      // A UEX pode criar um novo ID ao renovar o anúncio; por isso, depois de
      // tentar o ID, fazemos uma correspondência segura por título, local e qualidade.
      const currentCatalog = catalogRef.current;
      const unusedFreshIndexes = new Set(data.map((_, index) => index));
      const findFreshListing = cat => {
        let index = data.findIndex((fresh, candidateIndex) => unusedFreshIndexes.has(candidateIndex) && cat.id !== null && cat.id !== undefined && fresh.id !== null && fresh.id !== undefined && String(fresh.id) === String(cat.id));
        if (index < 0 && !cat.is_manual) {
          index = data.findIndex((fresh, candidateIndex) => unusedFreshIndexes.has(candidateIndex) && listingIdentityMatches(cat, fresh));
        }
        if (index < 0) return null;
        unusedFreshIndexes.delete(index);
        return data[index];
      };

      // Atualiza preço, estoque e principalmente date_expiration da API,
      // preservando os campos internos do usuário. Se o ID mudou por renovação,
      // o registro antigo expirado é substituído pelo registro vigente.
      let renewedCount = 0;
      const updatedExisting = currentCatalog.map(cat => {
        const fresh = findFreshListing(cat);
        if (!fresh) return cat;
        const renewed = sameRenewedListing(cat, fresh);
        if (renewed) renewedCount += 1;
        const newInStock = fresh.in_stock !== undefined ? Number(fresh.in_stock) : (cat.in_stock || 0);
        return {
          ...cat,
          ...fresh,
          id: fresh.id ?? cat.id,
          in_stock:       newInStock,
          is_sold_out:    newInStock <= 0 ? 1 : 0,
          internal_stock: cat.internal_stock,
          notes:          cat.notes,
          imported_at:    cat.imported_at,
          last_synced_at: new Date().toISOString(),
          renewed_at:     renewed ? new Date().toISOString() : cat.renewed_at,
        };
      });
      const newListings = data.filter((_, index) => unusedFreshIndexes.has(index));
      refreshCatalog(updatedExisting);

      if (newListings.length === 0) {
        setSyncMsg(`✓ Catálogo atualizado. ${updatedExisting.length} item${updatedExisting.length!==1?'s':''} sincronizado${updatedExisting.length!==1?'s':''}${renewedCount ? ` · ${renewedCount} anúncio${renewedCount!==1?'s':''} renovado${renewedCount!==1?'s':''} reconhecido${renewedCount!==1?'s':''}` : ''}.`);
      } else {
        setSyncMsg(`${newListings.length} novo${newListings.length!==1?'s':''} anúncio${newListings.length!==1?'s':''} encontrado${newListings.length!==1?'s':''}. Confirme cada um...`);
        // Guardar fila na ref E no state
        importQueueRef.current = newListings;
        setImportQueue([...newListings]);
      }
      // A mesma ação de sincronização atualiza também o snapshot de mercado.
      // O endpoint da UEX possui cache próprio de aproximadamente uma hora.
      await fetchTrends();
    } catch (err) {
      setSyncMsg(`❌ Erro: ${err.message}`);
    }
    setLoading(false);
  }

  // ── Confirmação de import — usa ref para evitar closure stale ──
  function handleImportConfirm(listing) {
    // Adicionar ao catálogo usando ref (valor sempre atualizado)
    const entry = { ...listing, id: listing.id, internal_stock: listing.in_stock || 0, notes: listing.notes || '', imported_at: new Date().toISOString() };
    const updatedCatalog = [...catalogRef.current, entry];
    refreshCatalog(updatedCatalog);

    // Avançar fila pela ref
    importQueueRef.current = importQueueRef.current.slice(1);
    const remaining = [...importQueueRef.current];
    setImportQueue(remaining);
    if (remaining.length === 0) setSyncMsg(`✓ ${updatedCatalog.length} item${updatedCatalog.length!==1?'s':''} no catálogo.`);
  }

  function handleImportSkip() {
    // Avançar fila pela ref sem adicionar ao catálogo
    importQueueRef.current = importQueueRef.current.slice(1);
    const remaining = [...importQueueRef.current];
    setImportQueue(remaining);
    if (remaining.length === 0) setSyncMsg('✓ Importação concluída.');
  }

  // ── Buscar trends da UEX para os meus itens ──
  // Usa estado separado de loading para não interferir com o fluxo de importação
  const [trendsLoading, setTrendsLoading] = useState(false);
  async function fetchTrends() {
    setTrendsLoading(true);
    try {
      const response = await uexFetch('marketplace_trends');
      const data = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
      setTrendData(data);
      setTrendDataFetchedAt(new Date().toISOString());
    } catch (err) {
      console.warn('Trends error:', err.message);
    }
    setTrendsLoading(false);
  }

  // Buscar trends apenas uma vez na montagem, não a cada item adicionado
  const trendsFetchedRef = React.useRef(false);
  useEffect(() => {
    if (catalog.length > 0 && !trendsFetchedRef.current) {
      trendsFetchedRef.current = true;
      fetchTrends();
    }
  }, []); // eslint-disable-line

  // ── Ações ──
  function handleEditStock(itemId, fields) {
    // fields pode ser número (só internal_stock) ou objeto { internal_stock, in_stock }
    const updated = catalog.map(i => {
      if (i.id !== itemId) return i;
      const patch = typeof fields === 'number'
        ? { internal_stock: fields }
        : fields;
      const newInStock = patch.in_stock !== undefined ? patch.in_stock : i.in_stock;
      return { ...i, ...patch, is_sold_out: newInStock <= 0 ? 1 : 0 };
    });
    refreshCatalog(updated);
  }
  function handleSaveVaultStockLink(itemId, binding) {
    const entryIds = [...new Set((Array.isArray(binding?.entryIds) ? binding.entryIds : []).map(id => String(id || '').trim()).filter(Boolean))];
    const boxQuantity = Number(String(binding?.boxQuantity ?? '').replace(',', '.')) || 0;
    const boxUnit = normalizeCargoUnit(binding?.boxUnit || 'un');
    const normalizedBinding = entryIds.length && boxQuantity > 0
      ? { entryIds, boxQuantity, boxUnit, quality: String(binding?.quality || '').trim(), updatedAt: binding?.updatedAt || new Date().toISOString() }
      : null;
    const updated = catalogRef.current.map(item => item.id === itemId
      ? { ...item, vault_binding: normalizedBinding }
      : item);
    refreshCatalog(updated);
    setVaultLinkItem(null);
    setSyncMsg(normalizedBinding ? `✓ Baú vinculado: ${boxQuantity} ${boxUnit} por caixa.` : '✓ Vínculo com o Baú removido.');
  }

  function handleSaveStockLink(itemId, binding) {
    const candidates = [
      ...(Array.isArray(binding?.locationKeys) ? binding.locationKeys : []),
      ...(binding?.locationKey ? [binding.locationKey] : []),
    ];
    const locationKeys = [...new Set(candidates.map(key => String(key || '').trim()).filter(Boolean))];
    const armorPieceIds = [...new Set((Array.isArray(binding?.armorPieceIds) ? binding.armorPieceIds : []).map(id => String(id || '').trim()).filter(Boolean))];
    const armorSetIds = [...new Set((Array.isArray(binding?.armorSetIds) ? binding.armorSetIds : []).map(id => String(id || '').trim()).filter(Boolean))];
    const normalizedBinding = locationKeys.length || armorPieceIds.length || armorSetIds.length
      ? { locationKeys, armorPieceIds, armorSetIds, updatedAt: binding?.updatedAt || new Date().toISOString() }
      : null;
    const updated = catalogRef.current.map(item => item.id === itemId
      ? { ...item, inventory_binding: normalizedBinding }
      : item);
    refreshCatalog(updated);
    setStockLinkItem(null);
    setSyncMsg(normalizedBinding ? `✓ Estoque vinculado a ${locationKeys.length} local${locationKeys.length === 1 ? '' : 'is'} do Inventário de Itens.` : '✓ Vínculo removido; o estoque manual foi preservado.');
  }
  function handleDeleteItem(itemId) {
    refreshCatalog(catalog.filter(i => i.id !== itemId));
  }
  async function consumeBoundArmor(target, quantity) {
    if (!target || !onConsumeArmorStock || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) return { success:true, consumed:false };
    const binding = getInventoryBinding(target);
    if (!binding.armorPieceIds.length && !binding.armorSetIds.length) return { success:true, consumed:false };
    return onConsumeArmorStock({ pieceIds: binding.armorPieceIds, setIds: binding.armorSetIds, quantity: Number(quantity) });
  }

  async function handleManualSale(sale) {
    let nextSale = sale;
    let updatedCatalog = catalogRef.current;
    const boundCandidates = updatedCatalog.filter(item => {
      if (normalizeInventoryName(item.title) !== normalizeInventoryName(sale.title)) return false;
      const vault = getVaultBinding(item);
      const inventory = getInventoryBinding(item);
      return vault.linked || inventory.linked;
    });
    const target = sale.listingId
      ? updatedCatalog.find(item => String(item.id) === String(sale.listingId))
      : boundCandidates.length === 1 ? boundCandidates[0] : null;
    if (sale.type === 'sold' && target) {
      const binding = target.vault_binding;
      const armorConsumption = await consumeBoundArmor(target, sale.qty);
      if (!armorConsumption.success) {
        setSyncMsg(`⚠ Venda registrada sem baixa da armadura: ${armorConsumption.message || 'estoque insuficiente.'}`);
      }
      const boxQuantity = Number(binding?.boxQuantity) || 1;
      const boxUnit = normalizeCargoUnit(binding?.boxUnit || 'un');
      const vaultConsumption = binding?.entryIds?.length ? consumeVaultEntries(binding.entryIds, boxQuantity * sale.qty, boxUnit) : { success:true, consumed:false };
      nextSale = { ...sale, armor_consumption_status: armorConsumption.success ? (armorConsumption.consumed ? 'consumed' : 'not_bound') : 'failed', armor_consumed_at: armorConsumption.consumed ? new Date().toISOString() : null, armor_consumption_message: armorConsumption.message || '', vault_consumption_status: vaultConsumption.success ? 'consumed' : 'failed', vault_consumed_at: vaultConsumption.success ? new Date().toISOString() : null, vault_consumption_message: vaultConsumption.message || '', vault_box_quantity:boxQuantity, vault_box_unit:boxUnit, vault_quality:binding?.quality || '' };
      const nextStock = Math.max(0, (Number(target.in_stock) || 0) - sale.qty);
      updatedCatalog = updatedCatalog.map(item => String(item.id) === String(target.id) ? { ...item, in_stock:nextStock, is_sold_out:nextStock <= 0 ? 1 : 0, last_sale_at:new Date().toISOString() } : item);
      refreshCatalog(updatedCatalog);
    }
    refreshSales([nextSale, ...sales]);
    setShowManualSale(false);
  }
  function handleDeleteSale(saleId) {
    refreshSales(sales.filter(s => String(s.id) !== String(saleId)));
  }
  function handleUpdateSale(updatedSale) {
    refreshSales(sales.map(s => String(s.id) === String(updatedSale.id) ? updatedSale : s));
  }
  function handleAddEsgotado() { setShowEsgotadoForm(true); }

  // Adicionar item esgotado manualmente (não aparece na API)
  function handleEsgotadoSave(entry) {
    const item = {
      id: Date.now(),
      title: entry.title,
      price: entry.price,
      quality: entry.quality || '',
      location: entry.location || '',
      availability: 'immediate',
      source: entry.source || 'looted',
      in_stock: 0,
      is_sold_out: 1,
      internal_stock: entry.internal_stock || 0,
      notes: entry.notes || '',
      date_added: Math.floor(Date.now()/1000),
      is_manual: true,
      imported_at: new Date().toISOString(),
    };
    refreshCatalog([...catalog, item]);
    setShowEsgotadoForm(false);
  }

  const totalRevenue = sales.filter(s=>s.type==='sold').reduce((a,s)=>a+(s.total_revenue||0),0);

  const TABS = [
    { id:'items',  label:'Meus Itens',  icon:Package,    badge:catalog.length > 0 ? String(catalog.length) : null },
    { id:'sales',  label:'Vendas',      icon:DollarSign, badge:sales.filter(s=>s.type==='sold').length > 0 ? String(sales.filter(s=>s.type==='sold').length) : null },
    { id:'trends', label:'Tendências',  icon:TrendingUp, badge:null },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Modais */}
      {importQueue.length > 0 && (
        <ImportConfirmModal
          key={importQueue[0]?.id || importQueue[0]?.title || 0}
          listing={importQueue[0]}
          onConfirm={handleImportConfirm}
          onSkip={handleImportSkip}
        />
      )}
      {showManualSale && (
        <ManualSaleModal catalogItems={catalog} onSave={handleManualSale} onClose={()=>setShowManualSale(false)}/>
      )}
      {stockLinkItem && (
        <InventoryStockLinkModal
          listing={stockLinkItem}
          inventoryItems={inventoryItems}
          managedLocations={managedLocations}
          armorSets={armorSets}
          onSave={binding => handleSaveStockLink(stockLinkItem.id, binding)}
          onClose={() => setStockLinkItem(null)}
        />
      )}
      {vaultLinkItem && (
        <VaultStockLinkModal
          listing={vaultLinkItem}
          vaultEntries={vaultEntries}
          onSave={binding => handleSaveVaultStockLink(vaultLinkItem.id, binding)}
          onClose={() => setVaultLinkItem(null)}
        />
      )}
      {showEsgotadoForm && (
        <ManualSaleModal
          catalogItems={catalog}
          onSave={handleEsgotadoSave}
          onClose={()=>setShowEsgotadoForm(false)}
          title="ADICIONAR ITEM ESGOTADO"
        />
      )}

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display:'flex', alignItems:'center', gap:10 }}>
            <ShoppingBag size={18} style={{ color:'var(--accent-primary)' }}/> ACOMPANHAMENTO UEX
          </div>
          <div className="page-subtitle">
            {catalog.length} item{catalog.length!==1?'s':''} no catálogo
            {totalRevenue > 0 && <span style={{ marginLeft:8, color:'var(--accent-green)' }}>· {ptMoney(totalRevenue)} aUEC ganhos</span>}
          </div>
        </div>

        {/* Controles do header */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {/* Username */}
          <div style={{ display:'flex', gap:5, alignItems:'center' }}>
            <input
              style={{ width:140, padding:'6px 10px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none' }}
              placeholder="Seu IGN na UEX..."
              value={usernameInput}
              onChange={e=>setUsernameInput(e.target.value)}
              onBlur={()=>{ setUsername(usernameInput.trim()); saveUsername(usernameInput.trim()); }}
              onKeyDown={e=>{ if(e.key==='Enter'){ setUsername(usernameInput.trim()); saveUsername(usernameInput.trim()); }}}
            />
          </div>
          <button onClick={syncFromUEX} disabled={loading || !username.trim()} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.35)', borderRadius:7, color:'var(--accent-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, fontWeight:700, textTransform:'uppercase', cursor:'pointer', opacity: loading || !username.trim() ? 0.5 : 1 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/> Sincronizar UEX
          </button>
          <button onClick={()=>setShowManualSale(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:7, color:'var(--accent-green)', fontFamily:'"Exo 2",sans-serif', fontSize:12, fontWeight:700, textTransform:'uppercase', cursor:'pointer' }}>
            <Plus size={13}/> Venda Manual
          </button>
        </div>
      </div>

      {/* Msg de sync */}
      {syncMsg && (
        <div style={{ margin:'0 24px 0', padding:'7px 14px', background: syncMsg.startsWith('❌')?'rgba(251,113,133,0.08)':syncMsg.startsWith('⚠')?'rgba(255,200,0,0.08)':'rgba(52,211,153,0.06)', border:`1px solid ${syncMsg.startsWith('❌')?'rgba(251,113,133,0.25)':syncMsg.startsWith('⚠')?'rgba(255,200,0,0.25)':'rgba(52,211,153,0.2)'}`, borderRadius:7, fontSize:11, color:'var(--text-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>{syncMsg}</span>
          <button onClick={()=>setSyncMsg('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={12}/></button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding:'0 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-panel)', display:'flex', flexShrink:0, marginTop:syncMsg?8:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', background:'transparent', border:'none', borderBottom:`2px solid ${activeTab===t.id?'var(--accent-primary)':'transparent'}`, color:activeTab===t.id?'var(--accent-primary)':'var(--text-secondary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer', transition:'all 0.2s' }}>
            <t.icon size={12}/>{t.label}
            {t.badge !== null && t.badge !== undefined && String(t.badge).trim() !== '' && <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:10, padding:'1px 6px', background:activeTab===t.id?'rgba(56,189,248,0.15)':'rgba(255,255,255,0.05)', borderRadius:8 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="page-body">
        {activeTab==='items' && (
          <MyItemsTab catalog={catalog} sales={sales} trendData={trendData} trendDataFetchedAt={trendDataFetchedAt}
            inventoryItems={inventoryItems} managedLocations={managedLocations} armorSets={armorSets} vaultEntries={vaultEntries}
            onOpenStockLink={setStockLinkItem} onOpenVaultStockLink={setVaultLinkItem}
            onEditStock={handleEditStock} onDeleteItem={handleDeleteItem} onAddEsgotado={handleAddEsgotado}/>
        )}
        {activeTab==='sales' && (
          <SalesTab sales={sales} onDelete={handleDeleteSale} onUpdate={handleUpdateSale}/>
        )}
        {activeTab==='trends' && (
          <TrendsTab catalog={catalog} trendData={trendData} trendDataFetchedAt={trendDataFetchedAt} loading={trendsLoading} onRefresh={fetchTrends}/>
        )}
      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}