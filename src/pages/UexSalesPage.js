import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, RefreshCw, Plus, Edit3, Trash2,
  Save, X, Search, Package, DollarSign, BarChart3, ShoppingBag,
  CheckCircle2, AlertTriangle, Archive, Star, Eye, ChevronDown,
  ChevronUp, Globe, Clock, Minus, Info, ExternalLink
} from 'lucide-react';

// ── Storage ───────────────────────────────────────────────────────────────────
const SALES_KEY    = 'sc_uex_sales_v1';
const CATALOG_KEY  = 'sc_uex_catalog_v1';
const TOKEN_KEY    = 'sc_uex_token_v1';
const USERNAME_KEY = 'sc_uex_username_v1';

function loadToken()    { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
function loadUsername() { try { return localStorage.getItem(USERNAME_KEY) || ''; } catch { return ''; } }
function saveUsername(u){ localStorage.setItem(USERNAME_KEY, u); }
function loadSales()    { try { return JSON.parse(localStorage.getItem(SALES_KEY)) || []; } catch { return []; } }
function saveSales(d)   { localStorage.setItem(SALES_KEY, JSON.stringify(d)); }
function loadCatalog()  { try { return JSON.parse(localStorage.getItem(CATALOG_KEY)) || []; } catch { return []; } }
function saveCatalog(d) { localStorage.setItem(CATALOG_KEY, JSON.stringify(d)); }

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
function ptDate(ts)  {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function ptDateTime(ts) {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function daysSince(ts) {
  if (!ts) return 0;
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
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

  function handleSave() {
    if (!itemName.trim()) { setError('Nome do item obrigatório.'); return; }
    if (!price || parseFloat(price) <= 0) { setError('Preço deve ser maior que zero.'); return; }
    onSave({
      id: Date.now(),
      title: itemName.trim(), price: parseFloat(price), qty: parseInt(qty)||1,
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
function CatalogItemCard({ item, sales, onEditStock, onDelete, trendData }) {
  const [expanded, setExpanded]   = useState(false);
  const [editStock, setEditStock]     = useState(false);
  const [stockVal, setStockVal]       = useState(String(item.in_stock || 0));
  const [internalVal, setInternalVal] = useState(String(item.internal_stock || 0));
  const [delConf, setDelConf]     = useState(false);

  const itemSales = sales.filter(s => s.title?.toLowerCase() === item.title?.toLowerCase() && s.type === 'sold');
  const totalSold = itemSales.reduce((a,s) => a + (s.total_revenue || 0), 0);
  const qtyListed = item.in_stock || 0;

  // Dados de tendência da UEX para este item
  const trend = trendData?.find(t => t.item_name?.toLowerCase().includes(item.title?.split(' ')[0]?.toLowerCase() || ''));

  // Detectar qualidade no título
  const suggestedQ = extractQualityFromTitle(item.title || '');

  // Calcular variação de preço (preço atual vs média 30 dias)
  let priceVariation = null;
  if (trend?.price_avg_sell && trend?.price_avg_month_sell) {
    priceVariation = ((trend.price_avg_sell - trend.price_avg_month_sell) / trend.price_avg_month_sell) * 100;
  }

  const expiresIn = item.date_expiration ? Math.max(0, Math.floor((item.date_expiration * 1000 - Date.now()) / 86400000)) : null;
  const isExpiringSoon = expiresIn !== null && expiresIn <= 2;

  return (
    <div style={{
      background:'var(--bg-card)',
      border:`1px solid ${isExpiringSoon ? 'rgba(251,113,133,0.4)' : 'var(--border-subtle)'}`,
      borderRadius:8, overflow:'hidden', marginBottom:6,
    }}>
      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 13px', cursor:'pointer' }} onClick={() => setExpanded(!expanded)}>
        <Package size={14} style={{ color:'var(--accent-primary)', flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:2 }}>
            <span style={{ fontFamily:'"Exo 2",sans-serif', fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{item.title}</span>
            {item.quality && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(255,200,0,0.1)', color:'var(--accent-gold)', border:'1px solid rgba(255,200,0,0.3)', fontWeight:700 }}>★ {item.quality}</span>}
            {suggestedQ && !item.quality && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(255,200,0,0.06)', color:'rgba(255,200,0,0.7)', border:'1px solid rgba(255,200,0,0.2)', fontStyle:'italic' }}>Q sugerida: {suggestedQ}</span>}
            {item.is_sold_out ? <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(251,113,133,0.1)', color:'var(--accent-red)', border:'1px solid rgba(251,113,133,0.3)', fontWeight:700 }}>ESGOTADO</span>
              : <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(52,211,153,0.1)', color:'var(--accent-green)', border:'1px solid rgba(52,211,153,0.3)', fontWeight:700 }}>ATIVO</span>}
            {isExpiringSoon && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(251,113,133,0.15)', color:'var(--accent-red)', fontWeight:700 }}>⚠ Expira em {expiresIn}d</span>}
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
            <span style={{ color:'var(--accent-primary)' }}>Estoque: {item.internal_stock || 0}</span>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display:'flex', gap:4, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
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
                  ['Expira em', expiresIn !== null ? `${expiresIn} dia${expiresIn!==1?'s':''}` : '—'],
                  ['Adicionado', ptDate(item.date_added)],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'2px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                    <span style={{ color:'var(--text-muted)' }}>{k}</span>
                    <span style={{ color:'var(--text-primary)', fontFamily:'Share Tech Mono,monospace' }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Controle de estoque interno */}
              <div style={{ marginTop:10, padding:'10px 12px', background:'rgba(56,189,248,0.05)', border:'1px solid rgba(56,189,248,0.15)', borderRadius:7 }}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--accent-primary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7 }}>📦 Estoque Interno</div>
                {editStock ? (
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" min="0" value={stockVal} onChange={e=>setStockVal(e.target.value)}
                      style={{ width:80, padding:'5px 8px', background:'var(--bg-base)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:4, color:'var(--text-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:13, outline:'none' }}/>
                    <button onClick={()=>{onEditStock(item.id, parseInt(stockVal)||0); setEditStock(false);}}
                      style={{ padding:'5px 10px', background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:4, color:'var(--accent-primary)', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'"Exo 2",sans-serif' }}>
                      <Save size={10}/> Salvar
                    </button>
                    <button onClick={()=>setEditStock(false)} style={{ padding:'5px 8px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:4, color:'var(--text-muted)', cursor:'pointer', fontSize:10 }}><X size={10}/></button>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontFamily:'Michroma,sans-serif', fontSize:20, fontWeight:800, color:'var(--accent-primary)' }}>{item.internal_stock || 0}</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>unidades no inventário</span>
                    <button onClick={()=>{setStockVal(String(item.internal_stock||0)); setEditStock(true);}}
                      style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, padding:'4px 9px', background:'rgba(56,189,248,0.08)', border:'1px solid var(--border-subtle)', borderRadius:4, color:'var(--accent-primary)', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'"Exo 2",sans-serif', textTransform:'uppercase' }}>
                      <Edit3 size={9}/> Editar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Coluna 2: Dados de mercado UEX + histórico de vendas */}
            <div>
              {trend ? (
                <div>
                  <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7, display:'flex', alignItems:'center', gap:5 }}>
                    <Globe size={9}/> Mercado UEX — {trend.item_name}
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
  );
}

// ── Tab: Meus Itens (catálogo) ────────────────────────────────────────────────
function MyItemsTab({ catalog, sales, trendData, onEditStock, onDeleteItem, onAddEsgotado }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  const filtered = useMemo(() => {
    let list = catalog;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.title?.toLowerCase().includes(q) || i.location?.toLowerCase().includes(q));
    }
    if (filterStatus === 'active')   list = list.filter(i => !i.is_sold_out && (i.in_stock === undefined || i.in_stock > 0));
    if (filterStatus === 'soldout')  list = list.filter(i => i.is_sold_out || (i.in_stock !== undefined && i.in_stock <= 0));
    if (filterStatus === 'expiring') list = list.filter(i => {
      if (!i.date_expiration) return false;
      return Math.floor((i.date_expiration * 1000 - Date.now()) / 86400000) <= 2;
    });
    if (sortBy === 'price_asc')  list = [...list].sort((a,b) => (a.price||0) - (b.price||0));
    if (sortBy === 'price_desc') list = [...list].sort((a,b) => (b.price||0) - (a.price||0));
    if (sortBy === 'date')       list = [...list].sort((a,b) => (b.date_added||0) - (a.date_added||0));
    if (sortBy === 'name')       list = [...list].sort((a,b) => (a.title||'').localeCompare(b.title||''));
    if (sortBy === 'stock')      list = [...list].sort((a,b) => (b.internal_stock||0) - (a.internal_stock||0));
    return list;
  }, [catalog, search, filterStatus, sortBy]);

  const SS = { padding:'5px 22px 5px 8px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none', appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 5px center' };

  return (
    <div>
      {/* Cabeçalho com totais */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
        {[
          { label:'Total de Itens', value:catalog.length, color:'var(--accent-primary)', sub:'no catálogo' },
          { label:'Ativos', value:catalog.filter(i=>!i.is_sold_out && (i.in_stock===undefined||i.in_stock>0)).length, color:'var(--accent-green)', sub:'listados ativamente' },
          { label:'Esgotados', value:catalog.filter(i=>i.is_sold_out||(i.in_stock!==undefined&&i.in_stock<=0)).length, color:'var(--accent-red)', sub:'sem estoque' },
          { label:'Estoque Total', value:catalog.reduce((a,i)=>a+(i.internal_stock||0),0), color:'var(--accent-gold)', sub:'no inventário' },
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
          <option value="expiring">Expirando em breve</option>
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
        <span style={{ marginLeft:'auto', fontFamily:'Share Tech Mono,monospace', fontSize:11, color:'var(--text-muted)' }}>{filtered.length} item{filtered.length!==1?'s':''}</span>
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
        filtered.map(item => (
          <CatalogItemCard
            key={item.id}
            item={item}
            sales={sales}
            trendData={trendData}
            onEditStock={onEditStock}
            onDelete={onDeleteItem}
          />
        ))
      )}
    </div>
  );
}

// ── Tab: Vendas / Ocorrências ─────────────────────────────────────────────────
function SalesTab({ sales, onDelete }) {
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [delConf, setDelConf] = useState(null);

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
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:7 }}>
                <span style={{ fontSize:14 }}>{typeIcon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>
                    {ptDateTime(s.date)}
                    {s.quality && <span style={{ marginLeft:8, color:'var(--accent-gold)' }}>★ {s.quality}</span>}
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
                {delConf===s.id ? (
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={()=>{onDelete(s.id);setDelConf(null);}} style={{ padding:'3px 7px', background:'rgba(251,113,133,0.15)', border:'1px solid rgba(251,113,133,0.4)', borderRadius:3, color:'var(--accent-red)', cursor:'pointer', fontSize:10, fontWeight:700 }}>Sim</button>
                    <button onClick={()=>setDelConf(null)} style={{ padding:'3px 7px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:3, color:'var(--text-secondary)', cursor:'pointer', fontSize:10 }}>Não</button>
                  </div>
                ) : (
                  <button onClick={()=>setDelConf(s.id)} style={{ width:24, height:24, borderRadius:4, border:'1px solid rgba(251,113,133,0.2)', background:'rgba(251,113,133,0.08)', color:'var(--accent-red)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Trash2 size={10}/>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab: Tendências do Mercado ────────────────────────────────────────────────
function TrendsTab({ catalog, trendData, loading, onRefresh }) {
  const [search, setSearch] = useState('');

  const myItems = useMemo(() => {
    if (!trendData || trendData.length === 0 || catalog.length === 0) return [];
    return catalog.map(item => {
      const keyword = (item.title||'').split(' ')[0]?.toLowerCase();
      const trend = trendData.find(t => t.item_name?.toLowerCase().includes(keyword || ''));
      return trend ? { ...item, trend } : null;
    }).filter(Boolean);
  }, [catalog, trendData]);

  const filtered = search.trim()
    ? myItems.filter(i => i.title?.toLowerCase().includes(search.toLowerCase()) || i.trend?.item_name?.toLowerCase().includes(search.toLowerCase()))
    : myItems;

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center' }}>
        <div style={{ position:'relative', flex:1 }}>
          <Search size={11} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
          <input style={{ width:'100%', padding:'6px 10px 6px 26px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'"Exo 2",sans-serif', fontSize:12, outline:'none', boxSizing:'border-box' }}
            placeholder="Filtrar por item..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <button onClick={onRefresh} disabled={loading} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', background:'rgba(56,189,248,0.06)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--accent-primary)', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'"Exo 2",sans-serif', textTransform:'uppercase', opacity:loading?0.5:1 }}>
          <RefreshCw size={11} style={{ animation:loading?'spin 1s linear infinite':'none' }}/> Atualizar
        </button>
        <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:11, color:'var(--text-muted)' }}>{filtered.length} com dados</span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
          <Globe size={36} style={{ display:'block', margin:'0 auto 10px', opacity:0.15 }}/>
          <div style={{ fontSize:12 }}>
            {loading ? 'Carregando dados de mercado...' : catalog.length === 0 ? 'Sincronize primeiro para ver tendências.' : 'Nenhum item do seu catálogo encontrado nos trends da UEX.'}
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {filtered.map(item => {
            const t = item.trend;
            const variation = t.price_avg_sell && t.price_avg_month_sell
              ? ((t.price_avg_sell - t.price_avg_month_sell) / t.price_avg_month_sell) * 100 : null;
            const recommended = t.price_avg_sell ? Math.round(t.price_avg_sell * 0.95) : null;
            const priceDiff = recommended && item.price ? recommended - item.price : null;

            return (
              <div key={item.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:8, padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'"Exo 2",sans-serif', fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{item.title}</span>
                      {item.quality && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'rgba(255,200,0,0.1)', color:'var(--accent-gold)', border:'1px solid rgba(255,200,0,0.25)', fontWeight:700 }}>★ {item.quality}</span>}
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function UexSalesPage() {
  const [catalog,   setCatalog]   = useState(() => loadCatalog());
  const [sales,     setSales]     = useState(() => loadSales());
  const [trendData, setTrendData] = useState([]);
  const [username,  setUsername]  = useState(() => loadUsername());
  const [activeTab, setActiveTab] = useState('items');
  const [loading,   setLoading]   = useState(false);
  const [syncMsg,   setSyncMsg]   = useState('');
  const [importQueue, setImportQueue] = useState([]); // listagens aguardando confirmação
  const [showManualSale, setShowManualSale] = useState(false);
  const [showEsgotadoForm, setShowEsgotadoForm] = useState(false);
  const [usernameInput, setUsernameInput] = useState(username);
  // Refs para evitar closure stale no fluxo de importação
  const catalogRef    = React.useRef(catalog);
  const importQueueRef = React.useRef([]);

  // Sincronizar refs com state
  useEffect(() => { catalogRef.current = catalog; }, [catalog]);

  function refreshCatalog(d) { catalogRef.current = d; setCatalog(d); saveCatalog(d); }
  function refreshSales(d)   { setSales(d); saveSales(d); }

  // ── Sincronizar listagens da UEX ──
  async function syncFromUEX() {
    if (!username.trim()) { setSyncMsg('⚠ Configure seu IGN da UEX primeiro.'); return; }
    setLoading(true); setSyncMsg('Buscando seus anúncios na UEX...');
    try {
      const data = await uexFetch(`marketplace_listings?username=${encodeURIComponent(username.trim())}`);
      if (!data || data.length === 0) { setSyncMsg('Nenhum anúncio encontrado para este username.'); setLoading(false); return; }

      // Usar catalogRef.current para leitura mais recente (evita closure stale)
      const currentCatalog = catalogRef.current;
      // Normalizar ids para string para evitar mismatch número/string
      const existingIds = new Set(currentCatalog.map(i => String(i.id)));
      const newListings = data.filter(l => !existingIds.has(String(l.id)));

      // Atualizar sempre os existentes (preço, estoque API, etc.) preservando dados internos
      const updatedExisting = currentCatalog.map(cat => {
        const fresh = data.find(d => String(d.id) === String(cat.id));
        if (!fresh) return cat;
        // Recalcular is_sold_out baseado no in_stock recebido da API
        const newInStock = fresh.in_stock !== undefined ? Number(fresh.in_stock) : (cat.in_stock || 0);
        return {
          ...cat,
          ...fresh,
          in_stock:       newInStock,
          is_sold_out:    newInStock <= 0 ? 1 : 0, // forçar recálculo correto
          internal_stock: cat.internal_stock,       // preservar estoque interno
          notes:          cat.notes,                // preservar notas
        };
      });
      refreshCatalog(updatedExisting);

      if (newListings.length === 0) {
        setSyncMsg(`✓ Catálogo atualizado. ${updatedExisting.length} item${updatedExisting.length!==1?'s':''} sincronizados.`);
      } else {
        setSyncMsg(`${newListings.length} novo${newListings.length!==1?'s':''} anúncio${newListings.length!==1?'s':''} encontrado${newListings.length!==1?'s':''}. Confirme cada um...`);
        // Guardar fila na ref E no state
        importQueueRef.current = newListings;
        setImportQueue([...newListings]);
      }
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
      const data = await uexFetch('marketplace_trends');
      setTrendData(data || []);
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
      // Recalcular is_sold_out baseado no in_stock atualizado
      const newInStock = patch.in_stock !== undefined ? patch.in_stock : i.in_stock;
      return { ...i, ...patch, is_sold_out: newInStock <= 0 ? 1 : 0 };
    });
    refreshCatalog(updated);
  }
  function handleDeleteItem(itemId) {
    refreshCatalog(catalog.filter(i => i.id !== itemId));
  }
  function handleManualSale(sale) {
    refreshSales([sale, ...sales]);
    setShowManualSale(false);
  }
  function handleDeleteSale(saleId) {
    refreshSales(sales.filter(s => s.id !== saleId));
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
            {t.badge && <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:10, padding:'1px 6px', background:activeTab===t.id?'rgba(56,189,248,0.15)':'rgba(255,255,255,0.05)', borderRadius:8 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="page-body">
        {activeTab==='items' && (
          <MyItemsTab catalog={catalog} sales={sales} trendData={trendData}
            onEditStock={handleEditStock} onDeleteItem={handleDeleteItem} onAddEsgotado={handleAddEsgotado}/>
        )}
        {activeTab==='sales' && (
          <SalesTab sales={sales} onDelete={handleDeleteSale}/>
        )}
        {activeTab==='trends' && (
          <TrendsTab catalog={catalog} trendData={trendData} loading={trendsLoading} onRefresh={fetchTrends}/>
        )}
      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}