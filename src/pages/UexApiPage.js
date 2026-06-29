import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Globe, RefreshCw, Search, Package, Cpu, TrendingUp,
  Pickaxe, Shield, Database, ChevronDown, ChevronUp,
  ExternalLink, AlertTriangle, CheckCircle2, Zap,
  Download, Info , Star, Filter, Key, Eye, EyeOff, Save, Lock, X
} from 'lucide-react';
import { setBatchProvenance, SOURCES } from '../data/provenance';
import { ProvenanceBadge, ProvenanceSummaryWidget } from '../components/ProvenanceBadge';

// ── UEX Corp API 2.0 ──────────────────────────────────────────────────────────
const UEX_BASE = 'https://api.uexcorp.uk/2.0';
const TOKEN_KEY = 'sc_uex_token_v1';
function loadToken()    { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
function saveToken(t)   { localStorage.setItem(TOKEN_KEY, t); }
function clearToken()   { localStorage.removeItem(TOKEN_KEY); }

// No auth required for public endpoints
async function uexFetch(endpoint, params = {}, token = '') {
  const t = token || loadToken();

  // In Electron: use IPC proxy to avoid CORS
  if (window.electronAPI?.uexFetch) {
    const result = await window.electronAPI.uexFetch({ endpoint, token: t });
    if (result.success) return result.data;
    throw new Error(result.message || 'Erro na API');
  }

  // Browser fallback: direct fetch (only works for public endpoints without token)
  const qs = Object.entries(params)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `${UEX_BASE}/${endpoint}${qs ? '?' + qs : ''}`;
  const headers = { 'Content-Type': 'application/json' };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'ok') throw new Error(json.message || json.status);
  return json.data;
}

// ── Tabs config ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'commodities', label: 'Commodities', icon: TrendingUp,  color: '#ffc436', desc: 'Preços de commodities em tempo real — minérios, combustíveis, mercadorias' },
  { id: 'itens',       label: 'Itens',       icon: Package,     color: '#00d4ff', desc: 'Armaduras, armas, componentes, gadgets e todos os itens do jogo' },
  { id: 'veículos',    label: 'Veículos',    icon: Zap,         color: '#ff8c00', desc: 'Todas as naves e veículos com especificações completas' },
  { id: 'mining',      label: 'Mineiroação',   icon: Pickaxe,     color: '#00e5a0', desc: 'Minérios brutos, preços de refinamento e locais de mineração' },
  { id: 'locations',   label: 'Locais',      icon: Globe,       color: '#b44cff', desc: 'Sistemas, planetas, luas, estações e terminais de comércio' },
  { id: 'terminais',   label: 'Terminais',   icon: Database,    color: '#74b9ff', desc: 'Terminais de trade com preços de compra/venda por localização' },
];


// ── Token Configuration Panel ─────────────────────────────────────────────────
function TokenConfigPanel({ onTokenChange }) {
  const [token,      setToken]     = React.useState(loadToken);
  const [showToken,  setShowToken] = React.useState(false);
  const [testStatus, setTestStatus]= React.useState(null); // null | 'testing' | 'ok' | 'error'
  const [testMsg,    setTestMsg]   = React.useState('');
  const [saved,      setSaved]     = React.useState(false);
  const [expanded,   setExpandired]  = React.useState(false);
  const hasToken = !!loadToken();

  function handleSave() {
    saveToken(token.trim());
    setSaved(true);
    onTokenChange && onTokenChange(token.trim());
    setTimeout(() => setSaved(false), 2000);
  }

  function handleLimpar() {
    clearToken();
    setToken('');
    setTestStatus(null);
    setTestMsg('');
    onTokenChange && onTokenChange('');
  }

  async function handleTest() {
    const t = token.trim();
    if (!t) { setTestStatus('error'); setTestMsg('Nenhum token configurado.'); return; }
    setTestStatus('testing'); setTestMsg('Testando conexão com a API UEX...');
    try {
      // In Electron: use IPC proxy (avoids CORS)
      if (window.electronAPI?.uexTestToken) {
        const result = await window.electronAPI.uexTestToken(t);
        if (result.success) {
          setTestStatus('ok');
          setTestMsg(`✓ ${result.message}`);
        } else {
          setTestStatus('error');
          setTestMsg(`✗ ${result.message}`);
        }
      } else {
        // Browser fallback: try public endpoint only (no auth header to avoid CORS preflight)
        const res = await fetch(`${UEX_BASE}/game_versions`);
        const json = await res.json();
        if (json.status === 'ok') {
          setTestStatus('ok');
          setTestMsg('✓ API acessível. Token será usado nas chamadas autenticadas (teste completo disponível apenas no app Electron).');
        } else {
          setTestStatus('error');
          setTestMsg('Não foi possível conectar à API UEX.');
        }
      }
    } catch (e) {
      setTestStatus('error');
      setTestMsg(`✗ Erro de conexão: ${e.message}`);
    }
  }

  return (
    <div style={{
      background: hasToken ? 'rgba(0,229,160,0.04)' : 'rgba(255,196,54,0.04)',
      border: `1px solid ${hasToken ? 'rgba(0,229,160,0.25)' : 'rgba(255,196,54,0.25)'}`,
      borderRadius: 8, marginBottom: 14, overflow: 'hidden',
    }}>
      {/* Header toggle */}
      <button onClick={() => setExpandired(!expanded)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Key size={14} style={{ color: hasToken ? 'var(--accent-green)' : 'var(--accent-gold)', flexShrink: 0 }}/>
          <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Token API UEX Corp
          </span>
          {hasToken ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.3)', padding: '1px 7px', borderRadius: 10 }}>
              ✓ CONFIGURADO
            </span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-gold)', background: 'rgba(255,196,54,0.1)', border: '1px solid rgba(255,196,54,0.3)', padding: '1px 7px', borderRadius: 10 }}>
              SEM TOKEN
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }}/>
          : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }}/>}
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
            O token é salvo <strong>apenas no seu computador</strong> (localStorage) e nunca é enviado para nenhum outro serviço além da UEX Corp API.
            Obtenha seu token em <a href="https://uexcorp.space/account/api" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>uexcorp.space/account/api</a>.
          </div>

          {/* Token input */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Lock size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}/>
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Cole seu token aqui..."
                style={{
                  width: '100%', padding: '9px 40px 9px 32px',
                  background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
                  borderRadius: 6, color: 'var(--text-primary)',
                  fontFamily: 'Share Tech Mono,monospace', fontSize: 13, outline: 'none',
                }}
              />
              <button onClick={() => setShowToken(!showToken)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              }}>
                {showToken ? <EyeOff size={13}/> : <Eye size={13}/>}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleSave} disabled={!token.trim()} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.35)',
              borderRadius: 6, color: 'var(--accent-green)',
              fontFamily: 'Rajdhani,sans-serif', fontSize: 12, fontWeight: 700,
              cursor: token.trim() ? 'pointer' : 'not-allowed', textTransform: 'uppercase',
              opacity: token.trim() ? 1 : 0.5, letterSpacing: '0.06em',
            }}>
              <Save size={13}/>
              {saved ? '✓ Salvo!' : 'Salvar Token'}
            </button>

            <button onClick={handleTest} disabled={!token.trim() || testStatus === 'testing'} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: 6, color: 'var(--accent-primary)',
              fontFamily: 'Rajdhani,sans-serif', fontSize: 12, fontWeight: 700,
              cursor: (token.trim() && testStatus !== 'testing') ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              opacity: (token.trim() && testStatus !== 'testing') ? 1 : 0.5,
            }}>
              {testStatus === 'testing'
                ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }}/> Testando...</>
                : <><Globe size={13}/> Testar Conexão</>}
            </button>

            {hasToken && (
              <button onClick={handleLimpar} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.2)',
                borderRadius: 6, color: 'var(--accent-red)',
                fontFamily: 'Rajdhani,sans-serif', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <X size={13}/> Remover Token
              </button>
            )}
          </div>

          {/* Test result */}
          {testStatus && testStatus !== 'testing' && (
            <div style={{
              marginTop: 10, padding: '9px 14px',
              background: testStatus === 'ok' ? 'rgba(0,229,160,0.08)' : 'rgba(255,68,102,0.08)',
              border: `1px solid ${testStatus === 'ok' ? 'rgba(0,229,160,0.3)' : 'rgba(255,68,102,0.3)'}`,
              borderRadius: 6, fontSize: 12, fontWeight: 600,
              color: testStatus === 'ok' ? 'var(--accent-green)' : 'var(--accent-red)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {testStatus === 'ok'
                ? <CheckCircle2 size={14}/>
                : <AlertTriangle size={14}/>}
              {testMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ ok }) {
  return (
    <span style={{ display:'inline-flex',alignItems:'center',gap:4,fontSize:10,fontWeight:700,
      padding:'2px 7px',borderRadius:10,
      background: ok ? 'rgba(0,229,160,0.12)' : 'rgba(255,68,102,0.1)',
      border: `1px solid ${ok ? 'rgba(0,229,160,0.3)' : 'rgba(255,68,102,0.3)'}`,
      color: ok ? 'var(--accent-green)' : 'var(--accent-red)',
    }}>
      {ok ? <CheckCircle2 size={10}/> : <AlertTriangle size={10}/>}
      {ok ? 'Online' : 'Erro'}
    </span>
  );
}

// ── Generic table renderer ────────────────────────────────────────────────────
function DataTable({ data, columns, onRowClick, selectedId }) {
  if (!data || data.length === 0) {
    return <div style={{ textAlign:'center',padding:'40px 20px',color:'var(--text-muted)',fontSize:13 }}>Sem dados</div>;
  }
  return (
    <div style={{ overflowX:'auto',border:'1px solid var(--border-subtle)',borderRadius:8 }}>
      <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
        <thead>
          <tr style={{ background:'var(--bg-panel)' }}>
            {columns.map(col => (
              <th key={col.key} style={{ padding:'8px 12px',textAlign:'left',borderBottom:'1px solid var(--border-subtle)',
                color:'var(--accent-primary)',fontWeight:700,whiteSpace:'nowrap',
                fontFamily:'Rajdhani,sans-serif',fontSize:11,textTransform:'uppercase',letterSpacing:'0.06em' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id || row.uuid || i}
              onClick={() => onRowClick && onRowClick(row)}
              style={{
                borderBottom:'1px solid var(--border-subtle)',
                background: selectedId && (row.id === selectedId || row.uuid === selectedId)
                  ? 'rgba(0,212,255,0.08)' : i%2===0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                cursor: onRowClick ? 'pointer' : 'default',
                transition:'background 0.15s',
              }}
              onMouseEnter={e => onRowClick && (e.currentTarget.style.background='rgba(0,212,255,0.05)')}
              onMouseLeave={e => onRowClick && (e.currentTarget.style.background = selectedId && (row.id === selectedId || row.uuid === selectedId) ? 'rgba(0,212,255,0.08)' : i%2===0 ? 'transparent' : 'rgba(255,255,255,0.015)')}
            >
              {columns.map(col => (
                <td key={col.key} style={{ padding:'7px 12px',color:'var(--text-secondary)',verticalAlign:'middle' }}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Preço cell ────────────────────────────────────────────────────────────────
function Preço({ value, unit='SCU', color }) {
  if (!value || value === 0) return <span style={{ color:'var(--text-muted)' }}>—</span>;
  return (
    <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:12,color: color||'var(--accent-gold)',fontWeight:700 }}>
      {Number(value).toLocaleString('pt-BR', { maximumFractionDigits:2 })}
      <span style={{ fontSize:9,color:'var(--text-muted)',marginLeft:3 }}>aUEC/{unit}</span>
    </span>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ item, onClose, tab }) {
  if (!item) return null;
  const fields = Object.entries(item).filter(([k]) => !['id','id_parent','slug','uuid','wiki','date_added','date_modified','is_temporary','is_buggy','is_visible','is_available'].includes(k));
  return (
    <div style={{ position:'fixed',top:0,right:0,width:380,height:'100vh',background:'var(--bg-card)',
      borderLeft:'1px solid var(--border-normal)',zIndex:100,overflowY:'auto',boxShadow:'-4px 0 24px rgba(0,0,0,0.4)' }}>
      <div style={{ padding:'16px 18px',borderBottom:'1px solid var(--border-subtle)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--bg-panel)',position:'sticky',top:0,zIndex:1 }}>
        <div style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.05em' }}>
          {item.name || item.code || '—'}
        </div>
        <button onClick={onClose} style={{ background:'none',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',padding:'4px 8px',fontSize:14 }}>✕</button>
      </div>
      <div style={{ padding:'16px 18px' }}>
        {item.kind && <div style={{ marginBottom:8,fontSize:11,color:'var(--accent-primary)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em' }}>{item.kind}</div>}
        {item.category_name && <div style={{ marginBottom:8,fontSize:11,color:'var(--text-muted)' }}>Categoria: {item.category_name}</div>}
        {item.company_name && <div style={{ marginBottom:8,fontSize:11,color:'var(--text-muted)' }}>Fabricante: <span style={{ color:'var(--text-secondary)' }}>{item.company_name}</span></div>}
        {item.price_buy > 0 && (
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12,padding:'10px',background:'var(--bg-panel)',borderRadius:6,border:'1px solid var(--border-subtle)' }}>
            <div><div style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:3 }}>Preço Compra</div><Preço value={item.price_buy} unit='un' color='var(--accent-red)'/></div>
            <div><div style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:3 }}>Preço Venda</div><Preço value={item.price_sell} unit='un' color='var(--accent-green)'/></div>
          </div>
        )}
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10 }}>Todos os Atributos</div>
          {fields.map(([k,v]) => (
            typeof v !== 'object' && (
              <div key={k} style={{ display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--border-subtle)',fontSize:11 }}>
                <span style={{ color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace' }}>{k}</span>
                <span style={{ color: v===1?'var(--accent-green)':v===0&&typeof v==='number'?'var(--text-muted)':'var(--text-secondary)',fontFamily:'Share Tech Mono,monospace',textAlign:'right' }}>
                  {typeof v === 'number' && (k.includes('is_') || k.includes('_flag'))
                    ? (v ? '✓ sim' : '✗ não')
                    : String(v??'—')}
                </span>
              </div>
            )
          ))}
        </div>
        {item.wiki && (
          <a href={item.wiki} target="_blank" rel="noreferrer" style={{ display:'flex',alignItems:'center',gap:6,marginTop:12,padding:'8px 12px',background:'rgba(0,212,255,0.06)',border:'1px solid var(--border-normal)',borderRadius:6,color:'var(--accent-primary)',fontSize:12,fontWeight:700,textDecoration:'none' }}>
            <ExternalLink size={13}/> Ver no Wiki
          </a>
        )}
      </div>
    </div>
  );
}

// ── COMMODITIES tab ───────────────────────────────────────────────────────────
function CommoditiesTab() {
  const [data, setDate]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all'); // all | mineral | refined | illegal | fuel
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const result = await uexFetch('commodities');
      setDate(result);
      // Record provenance for all commodities
      setBatchProvenance('commodity', result.map(c => c.name), SOURCES.UEX_API, {
        endpoint: 'commodities', gameVersion: '4.8.1',
      });
    }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return data.filter(c => {
      if (search && !c.name?.toLowerCase().includes(search.toLowerCase()) && !c.code?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === 'mineral')  return c.is_mineral;
      if (filter === 'refined')  return c.is_refined;
      if (filter === 'raw')      return c.is_raw;
      if (filter === 'illegal')  return c.is_illegal;
      if (filter === 'fuel')     return c.is_fuel;
      if (filter === 'buyable')  return c.is_buyable;
      return true;
    });
  }, [data, search, filter]);

  const cols = [
    { key:'name', label:'Nome', render:(v,r)=>(
      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
        <span style={{ fontWeight:700,color:'var(--text-primary)' }}>{v}</span>
        <ProvenanceBadge category="commodity" name={v}/>
      </div>
    )},
    { key:'code', label:'Código', render:v=><span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--accent-primary)' }}>{v}</span> },
    { key:'kind', label:'Tipo', render:v=><span style={{ fontSize:11,color:'var(--text-muted)' }}>{v||'—'}</span> },
    { key:'price_buy',  label:'Compra (aUEC/SCU)',  render:v=><Preço value={v} color='var(--accent-red)'/> },
    { key:'price_sell', label:'Venda (aUEC/SCU)',   render:v=><Preço value={v} color='var(--accent-green)'/> },
    { key:'is_illegal',   label:'Legal?', render:v=><span style={{ color:v?'var(--accent-red)':'var(--accent-green)',fontSize:11,fontWeight:700 }}>{v?'⚠ Ilegal':'✓ Legal'}</span> },
    { key:'is_extractable', label:'Mineiroável', render:v=><span style={{ color:v?'var(--accent-gold)':'var(--text-muted)',fontSize:11 }}>{v?'✓':'—'}</span> },
    { key:'is_refined',  label:'Refinado', render:v=><span style={{ color:v?'#a29bfe':'var(--text-muted)',fontSize:11 }}>{v?'✓':'—'}</span> },
  ];

  return (
    <div>
      <div style={{ display:'flex',gap:8,marginBottom:12,flexWrap:'wrap' }}>
        <div style={{ position:'relative',flex:'1 1 180px' }}>
          <Search size={12} style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }}/>
          <input className="search-input" style={{ paddingLeft:30,width:'100%' }} placeholder="Buscar commodity..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {[{v:'all',l:'Todos'},{v:'mineral',l:'Minérios'},{v:'raw',l:'Brutos'},{v:'refined',l:'Refinados'},{v:'illegal',l:'⚠ Ilegais'},{v:'fuel',l:'Combustível'},{v:'buyable',l:'Compráveis'}].map(o=>(
          <button key={o.v} className={`filter-chip ${filter===o.v?'active':''}`} onClick={()=>setFilter(o.v)}>{o.l}</button>
        ))}
        <button onClick={load} style={{ padding:'7px 12px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:12 }}>
          <RefreshCw size={12}/> Atualizar
        </button>
      </div>
      {error && <div style={{ color:'var(--accent-red)',fontSize:12,marginBottom:10,padding:'8px 12px',background:'rgba(255,68,102,0.08)',borderRadius:5,border:'1px solid rgba(255,68,102,0.2)' }}>Erro: {error}</div>}
      <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:8 }}>{filtered.length} de {data.length} commodities · Dados da UEX Corp API (community crowdsourced)</div>
      {loading ? (
        <div style={{ textAlign:'center',padding:60,color:'var(--text-muted)' }}><RefreshCw size={24} style={{ animation:'spin 1s linear infinite',display:'block',margin:'0 auto 10px' }}/> Carregando da UEX API...</div>
      ) : (
        <DataTable data={filtered} columns={cols} onRowClick={setSelected} selectedId={selected?.id}/>
      )}
      <DetailPanel item={selected} onClose={()=>setSelected(null)} tab="commodities"/>
    </div>
  );
}

// ── ITEMS tab ─────────────────────────────────────────────────────────────────
function ItensTab() {
  const [data,     setDate]     = useState([]);
  const [cats,     setCats]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');
  const [catFilter,setCatFilter]= useState('');
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const [itens, categories] = await Promise.all([
        uexFetch('items'),
        uexFetch('categories'),
      ]);
      setDate(itens);
      setCats(categories);
      setBatchProvenance('item', itens.map(i => i.name), SOURCES.UEX_API, {
        endpoint: 'itens', gameVersion: '4.8.1',
      });
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return data.filter(item => {
      if (search && !item.name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (catFilter && item.id_category !== Number(catFilter)) return false;
      return true;
    });
  }, [data, search, catFilter]);

  const SS = { padding:'7px 26px 7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none',appearance:'none',WebkitAppearance:'none' };

  const cols = [
    { key:'name', label:'Nome', render:(v,r)=>(
      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
        <span style={{ fontWeight:700,color:'var(--text-primary)' }}>{v}</span>
        <ProvenanceBadge category="item" name={v}/>
      </div>
    )},
    { key:'company_name', label:'Fabricante', render:v=><span style={{ fontSize:11,color:'var(--text-secondary)' }}>{v||'—'}</span> },
    { key:'category_name', label:'Categoria', render:v=><span style={{ fontSize:11,color:'var(--accent-primary)',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3 }}>{v||'—'}</span> },
    { key:'size', label:'Tamanho', render:v=><span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11 }}>{v||'—'}</span> },
    { key:'price_buy',  label:'Compra', render:v=><Preço value={v} unit='un' color='var(--accent-red)'/> },
    { key:'price_sell', label:'Venda',  render:v=><Preço value={v} unit='un' color='var(--accent-green)'/> },
    { key:'is_available_live', label:'Disponível', render:v=><span style={{ color:v?'var(--accent-green)':'var(--text-muted)',fontSize:11 }}>{v?'✓':'✗'}</span> },
  ];

  return (
    <div>
      <div style={{ display:'flex',gap:8,marginBottom:12,flexWrap:'wrap' }}>
        <div style={{ position:'relative',flex:'1 1 200px' }}>
          <Search size={12} style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }}/>
          <input className="search-input" style={{ paddingLeft:30,width:'100%' }} placeholder="Buscar item (armadura, arma, componente...)..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select style={SS} value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
          <option value="">Todas Categorias</option>
          {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={load} style={{ padding:'7px 12px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:12 }}>
          <RefreshCw size={12}/> Atualizar
        </button>
      </div>
      {error && <div style={{ color:'var(--accent-red)',fontSize:12,marginBottom:10,padding:'8px 12px',background:'rgba(255,68,102,0.08)',borderRadius:5,border:'1px solid rgba(255,68,102,0.2)' }}>Erro: {error}</div>}
      <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:8 }}>{filtered.length} de {data.length} itens</div>
      {loading ? (
        <div style={{ textAlign:'center',padding:60,color:'var(--text-muted)' }}><RefreshCw size={24} style={{ animation:'spin 1s linear infinite',display:'block',margin:'0 auto 10px' }}/> Carregando itens...</div>
      ) : (
        <DataTable data={filtered} columns={cols} onRowClick={setSelected} selectedId={selected?.id}/>
      )}
      <DetailPanel item={selected} onClose={()=>setSelected(null)} tab="itens"/>
    </div>
  );
}

// ── VEHICLES tab ──────────────────────────────────────────────────────────────
function VeículosTab() {
  const [data,    setDate]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');
  const [selected,setSelected]= useState(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const result = await uexFetch('vehicles');
      setDate(result);
      setBatchProvenance('vehicle', result.map(v => v.name), SOURCES.UEX_API, {
        endpoint: 'veículos', gameVersion: '4.8.1',
      });
    }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return data.filter(v => {
      if (search && !v.name?.toLowerCase().includes(search.toLowerCase()) && !v.company_name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter !== 'all' && v.role?.toLowerCase() !== filter) return false;
      return true;
    });
  }, [data, search, filter]);

  const roles = useMemo(() => [...new Set(data.map(v=>v.role).filter(Boolean))].sort(), [data]);

  const SS = { padding:'7px 26px 7px 10px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Rajdhani,sans-serif',fontSize:13,outline:'none',appearance:'none',WebkitAppearance:'none' };

  const cols = [
    { key:'name', label:'Nome', render:(v,r)=>(
      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
        <span style={{ fontWeight:700,color:'var(--text-primary)' }}>{v}</span>
        <ProvenanceBadge category="vehicle" name={v}/>
      </div>
    )},
    { key:'company_name', label:'Fabricante', render:v=><span style={{ fontSize:11,color:'var(--text-secondary)' }}>{v}</span> },
    { key:'role', label:'Papel', render:v=><span style={{ fontSize:11,color:'var(--accent-primary)',background:'rgba(0,212,255,0.08)',padding:'1px 6px',borderRadius:3 }}>{v||'—'}</span> },
    { key:'size', label:'Tamanho', render:v=><span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11 }}>{v||'—'}</span> },
    { key:'crew', label:'Tripulação', render:v=><span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11 }}>{v||'—'}</span> },
    { key:'cargo', label:'Carga (SCU)', render:v=><span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--accent-gold)' }}>{v||0}</span> },
    { key:'price', label:'Preço (aUEC)', render:v=><Preço value={v} unit='un'/> },
    { key:'is_available_live', label:'In-Game', render:v=><span style={{ color:v?'var(--accent-green)':'var(--text-muted)',fontSize:11 }}>{v?'✓':'✗'}</span> },
  ];

  return (
    <div>
      <div style={{ display:'flex',gap:8,marginBottom:12,flexWrap:'wrap' }}>
        <div style={{ position:'relative',flex:'1 1 180px' }}>
          <Search size={12} style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }}/>
          <input className="search-input" style={{ paddingLeft:30,width:'100%' }} placeholder="Buscar nave..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select style={SS} value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">Todos os Papéis</option>
          {roles.map(r=><option key={r} value={r.toLowerCase()}>{r}</option>)}
        </select>
        <button onClick={load} style={{ padding:'7px 12px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:12 }}>
          <RefreshCw size={12}/>
        </button>
      </div>
      {error && <div style={{ color:'var(--accent-red)',fontSize:12,marginBottom:10,padding:'8px 12px',background:'rgba(255,68,102,0.08)',borderRadius:5,border:'1px solid rgba(255,68,102,0.2)' }}>Erro: {error}</div>}
      <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:8 }}>{filtered.length} de {data.length} veículos</div>
      {loading ? (
        <div style={{ textAlign:'center',padding:60,color:'var(--text-muted)' }}><RefreshCw size={24} style={{ animation:'spin 1s linear infinite',display:'block',margin:'0 auto 10px' }}/> Carregando veículos...</div>
      ) : (
        <DataTable data={filtered} columns={cols} onRowClick={setSelected} selectedId={selected?.id}/>
      )}
      <DetailPanel item={selected} onClose={()=>setSelected(null)} tab="veículos"/>
    </div>
  );
}

// ── MINING tab ────────────────────────────────────────────────────────────────
function MineiroaçãoTab() {
  const [rawPreços, setBrutosPreços] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const all = await uexFetch('commodities');
      const minerals = all.filter(c => c.is_mineral || c.is_raw || c.is_extractable);
      setBrutosPreços(minerals);
      setBatchProvenance('mining_ore', minerals.map(m => m.name), SOURCES.UEX_API, {
        endpoint: 'commodities', gameVersion: '4.8.1',
      });
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    rawPreços.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()))
  , [rawPreços, search]);

  const cols = [
    { key:'name', label:'Minério', render:(v,r)=>(
      <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}>
        <span style={{ fontWeight:700,color:'var(--text-primary)' }}>{v}</span>
        <ProvenanceBadge category="mining_ore" name={v}/>
        {r.is_volatile_time && <span style={{ fontSize:9,color:'var(--accent-red)',fontWeight:700,background:'rgba(255,68,102,0.1)',border:'1px solid rgba(255,68,102,0.2)',padding:'1px 5px',borderRadius:3 }}>VOLÁTIL</span>}
        {r.is_explosive    && <span style={{ fontSize:9,color:'var(--accent-orange)',fontWeight:700,background:'rgba(255,140,0,0.1)',border:'1px solid rgba(255,140,0,0.2)',padding:'1px 5px',borderRadius:3 }}>EXPLOSIVO</span>}
      </div>
    )},
    { key:'code', label:'Código', render:v=><span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--accent-primary)' }}>{v}</span> },
    { key:'kind', label:'Tipo', render:v=><span style={{ fontSize:11,color:'var(--text-muted)' }}>{v||'—'}</span> },
    { key:'price_sell', label:'Preço Venda (aUEC/SCU)', render:v=><Preço value={v} color='var(--accent-green)'/> },
    { key:'price_buy',  label:'Preço Compra (aUEC/SCU)', render:v=><Preço value={v} color='var(--accent-red)'/> },
    { key:'is_raw',      label:'Bruto',    render:v=><span style={{ color:v?'#fdcb6e':'var(--text-muted)',fontSize:11 }}>{v?'✓':'—'}</span> },
    { key:'is_refined',  label:'Refinado', render:v=><span style={{ color:v?'#a29bfe':'var(--text-muted)',fontSize:11 }}>{v?'✓':'—'}</span> },
    { key:'is_refinable',label:'Refinável',render:v=><span style={{ color:v?'#00cec9':'var(--text-muted)',fontSize:11 }}>{v?'✓':'—'}</span> },
  ];

  return (
    <div>
      <div style={{ display:'flex',gap:8,marginBottom:12 }}>
        <div style={{ position:'relative',flex:1 }}>
          <Search size={12} style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }}/>
          <input className="search-input" style={{ paddingLeft:30,width:'100%' }} placeholder="Buscar minério..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <button onClick={load} style={{ padding:'7px 12px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:12 }}>
          <RefreshCw size={12}/>
        </button>
      </div>
      {error && <div style={{ color:'var(--accent-red)',fontSize:12,marginBottom:10,padding:'8px 12px',background:'rgba(255,68,102,0.08)',borderRadius:5 }}>Erro: {error}</div>}
      <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:8 }}>{filtered.length} minérios/recursos · Dados crowdsourced UEX</div>
      {loading ? (
        <div style={{ textAlign:'center',padding:60,color:'var(--text-muted)' }}><RefreshCw size={24} style={{ animation:'spin 1s linear infinite',display:'block',margin:'0 auto 10px' }}/> Carregando...</div>
      ) : (
        <DataTable data={filtered} columns={cols} onRowClick={setSelected} selectedId={selected?.id}/>
      )}
      <DetailPanel item={selected} onClose={()=>setSelected(null)} tab="mining"/>
    </div>
  );
}

// ── LOCATIONS tab ─────────────────────────────────────────────────────────────
function LocalizaçãosTab() {
  const [systems,  setSistemas]  = useState([]);
  const [planets,  setPlanetas]  = useState([]);
  const [moons,    setLuas]    = useState([]);
  const [stations, setEstações] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [subTab,   setSubTab]   = useState('systems');

  async function load() {
    setLoading(true); setError('');
    try {
      const [sys, pla, mon, sta] = await Promise.all([
        uexFetch('star_systems'),
        uexFetch('planets'),
        uexFetch('moons'),
        uexFetch('space_stations'),
      ]);
      setSistemas(sys); setPlanetas(pla); setLuas(mon); setEstações(sta);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const SUBTABS = [
    { id:'systems',  label:`Sistemas (${systems.length})` },
    { id:'planets',  label:`Planetas (${planets.length})` },
    { id:'moons',    label:`Luas (${moons.length})` },
    { id:'stations', label:`Estações (${stations.length})` },
  ];

  const sysCols = [
    { key:'name', label:'Sistema', render:v=><span style={{ fontWeight:700,color:'var(--accent-primary)' }}>{v}</span> },
    { key:'code', label:'Código',  render:v=><span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:11 }}>{v}</span> },
    { key:'is_available', label:'Disponível', render:v=><span style={{ color:v?'var(--accent-green)':'var(--text-muted)' }}>{v?'✓':'✗'}</span> },
  ];
  const locCols = [
    { key:'name', label:'Nome', render:v=><span style={{ fontWeight:700,color:'var(--text-primary)' }}>{v}</span> },
    { key:'star_system_name', label:'Sistema', render:v=><span style={{ fontSize:11,color:'var(--accent-primary)' }}>{v||'—'}</span> },
    { key:'is_available', label:'Disponível', render:v=><span style={{ color:v?'var(--accent-green)':'var(--text-muted)' }}>{v?'✓':'✗'}</span> },
    { key:'is_lagrange', label:'Lagrange', render:v=>v?<span style={{ fontSize:11,color:'var(--accent-gold)' }}>✓</span>:<span style={{ color:'var(--text-muted)' }}>—</span> },
  ];
  const staCols = [
    { key:'name', label:'Estação', render:v=><span style={{ fontWeight:700,color:'var(--text-primary)' }}>{v}</span> },
    { key:'star_system_name', label:'Sistema', render:v=><span style={{ fontSize:11,color:'var(--accent-primary)' }}>{v||'—'}</span> },
    { key:'planet_name', label:'Planeta/Lua', render:v=><span style={{ fontSize:11,color:'var(--text-secondary)' }}>{v||'—'}</span> },
    { key:'is_available', label:'Disponível', render:v=><span style={{ color:v?'var(--accent-green)':'var(--text-muted)' }}>{v?'✓':'✗'}</span> },
    { key:'has_trade', label:'Trade', render:v=>v?<span style={{ fontSize:11,color:'var(--accent-gold)' }}>✓</span>:<span style={{ color:'var(--text-muted)' }}>—</span> },
  ];

  const currentData   = subTab==='systems'?systems:subTab==='planets'?planets:subTab==='moons'?moons:stations;
  const currentCols   = subTab==='systems'?sysCols:subTab==='stations'?staCols:locCols;

  return (
    <div>
      <div style={{ display:'flex',gap:0,marginBottom:14,border:'1px solid var(--border-subtle)',borderRadius:7,overflow:'hidden',width:'fit-content' }}>
        {SUBTABS.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)} style={{ padding:'8px 14px',background:subTab===t.id?'rgba(0,212,255,0.1)':'transparent',border:'none',borderRight:'1px solid var(--border-subtle)',color:subTab===t.id?'var(--accent-primary)':'var(--text-secondary)',fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,cursor:'pointer',letterSpacing:'0.04em' }}>
            {t.label}
          </button>
        ))}
        <button onClick={load} style={{ padding:'8px 12px',background:'transparent',border:'none',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center' }}>
          <RefreshCw size={12}/>
        </button>
      </div>
      {error && <div style={{ color:'var(--accent-red)',fontSize:12,marginBottom:10,padding:'8px 12px',background:'rgba(255,68,102,0.08)',borderRadius:5 }}>Erro: {error}</div>}
      {loading ? (
        <div style={{ textAlign:'center',padding:60,color:'var(--text-muted)' }}><RefreshCw size={24} style={{ animation:'spin 1s linear infinite',display:'block',margin:'0 auto 10px' }}/> Carregando locais...</div>
      ) : (
        <DataTable data={currentData} columns={currentCols}/>
      )}
    </div>
  );
}

// ── TERMINALS tab ─────────────────────────────────────────────────────────────
function TerminaisTab() {
  const [data,    setDate]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');

  async function load() {
    setLoading(true); setError('');
    try {
      const result = await uexFetch('terminals');
      setDate(result);
      setBatchProvenance('terminal', result.map(t => t.name), SOURCES.UEX_API, {
        endpoint: 'terminais', gameVersion: '4.8.1',
      });
    }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    data.filter(t => {
      if (search && !t.name?.toLowerCase().includes(search.toLowerCase()) && !t.star_system_name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter==='commodity' && !t.has_commodity) return false;
      if (filter==='item'      && !t.has_item)      return false;
      if (filter==='vehicle'   && !t.has_vehicle)   return false;
      return true;
    })
  , [data, search, filter]);

  const cols = [
    { key:'name', label:'Terminal', render:v=><span style={{ fontWeight:700,color:'var(--text-primary)',fontSize:12 }}>{v}</span> },
    { key:'star_system_name', label:'Sistema', render:v=><span style={{ fontSize:11,color:'var(--accent-primary)' }}>{v||'—'}</span> },
    { key:'planet_name', label:'Local', render:v=><span style={{ fontSize:11,color:'var(--text-secondary)' }}>{v||'—'}</span> },
    { key:'type', label:'Tipo', render:v=><span style={{ fontSize:10,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3 }}>{v||'—'}</span> },
    { key:'has_commodity', label:'Commodity', render:v=><span style={{ color:v?'var(--accent-gold)':'var(--text-muted)',fontSize:11 }}>{v?'✓':'—'}</span> },
    { key:'has_item',      label:'Itens',     render:v=><span style={{ color:v?'var(--accent-primary)':'var(--text-muted)',fontSize:11 }}>{v?'✓':'—'}</span> },
    { key:'has_vehicle',   label:'Veículos',  render:v=><span style={{ color:v?'#ff8c00':'var(--text-muted)',fontSize:11 }}>{v?'✓':'—'}</span> },
    { key:'is_available',  label:'Online',    render:v=><StatusBadge ok={v}/> },
  ];

  return (
    <div>
      <div style={{ display:'flex',gap:8,marginBottom:12,flexWrap:'wrap' }}>
        <div style={{ position:'relative',flex:'1 1 180px' }}>
          <Search size={12} style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }}/>
          <input className="search-input" style={{ paddingLeft:30,width:'100%' }} placeholder="Buscar terminal, sistema..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {[{v:'all',l:'Todos'},{v:'commodity',l:'Commodity'},{v:'item',l:'Itens'},{v:'vehicle',l:'Veículos'}].map(o=>(
          <button key={o.v} className={`filter-chip ${filter===o.v?'active':''}`} onClick={()=>setFilter(o.v)}>{o.l}</button>
        ))}
        <button onClick={load} style={{ padding:'7px 12px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:12 }}>
          <RefreshCw size={12}/>
        </button>
      </div>
      {error && <div style={{ color:'var(--accent-red)',fontSize:12,marginBottom:10,padding:'8px 12px',background:'rgba(255,68,102,0.08)',borderRadius:5 }}>Erro: {error}</div>}
      <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:8 }}>{filtered.length} de {data.length} terminais</div>
      {loading ? (
        <div style={{ textAlign:'center',padding:60,color:'var(--text-muted)' }}><RefreshCw size={24} style={{ animation:'spin 1s linear infinite',display:'block',margin:'0 auto 10px' }}/> Carregando terminais...</div>
      ) : (
        <DataTable data={filtered} columns={cols}/>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UexApiPage() {
  const [activeTab, setActiveTab] = useState('commodities');
  const [apiStatus, setApiStatus] = useState(null); // null | true | false

  useEffect(() => {
    fetch(`${UEX_BASE}/game_versions`)
      .then(r => r.json())
      .then(j => setApiStatus(j.status === 'ok'))
      .catch(() => setApiStatus(false));
  }, []);

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ flexShrink:0 }}>
        <div>
          <div className="page-title" style={{ display:'flex',alignItems:'center',gap:10 }}>
            UEX CORP API
            {apiStatus !== null && <StatusBadge ok={apiStatus}/>}
          </div>
          <div className="page-subtitle">
            Dados em tempo real da comunidade Star Citizen via UEX Corp API 2.0 · api.uexcorp.uk/2.0
          </div>
        </div>
        <a href="https://uexcorp.space/api/documentation/" target="_blank" rel="noreferrer"
          style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'rgba(0,212,255,0.08)',border:'1px solid var(--border-normal)',borderRadius:6,color:'var(--accent-primary)',fontSize:12,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textDecoration:'none',textTransform:'uppercase',letterSpacing:'0.06em' }}>
          <ExternalLink size={13}/> Documentação
        </a>
      </div>

      {/* Info banner */}
      <div style={{ padding:'8px 32px',borderBottom:'1px solid var(--border-subtle)',background:'rgba(0,119,255,0.04)',flexShrink:0,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap' }}>
        <Info size={13} style={{ color:'var(--accent-primary)',flexShrink:0 }}/>
        <span style={{ fontSize:11,color:'var(--text-secondary)' }}>
          Dados crowdsourced pela comunidade Star Citizen. Preços são médias dos últimos 15 dias reportados por jogadminérios.
          API pública, sem key necessária para consultas básicas. Clique em qualquer linha para ver todos os atributos.
        </span>
        {TABS.map(t=>(
          <span key={t.id} style={{ display:'flex',alignItems:'center',gap:4,fontSize:11,color:t.color,fontWeight:600 }}>
            <t.icon size={11}/>{t.label}
          </span>
        ))}
      </div>

      {/* Token config */}
      <div style={{ padding:'12px 32px 0',flexShrink:0 }}>
        <TokenConfigPanel onTokenChange={() => setApiStatus(null)}/>
      </div>

      {/* Tab bar */}
      <div style={{ padding:'0 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',display:'flex',gap:0,flexShrink:0,overflowX:'auto' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            display:'flex',alignItems:'center',gap:7,padding:'12px 16px',
            background:activeTab===t.id?'rgba(0,212,255,0.08)':'transparent',
            border:'none',borderBottom:`2px solid ${activeTab===t.id?t.color:'transparent'}`,
            color:activeTab===t.id?t.color:'var(--text-secondary)',
            fontFamily:'Rajdhani,sans-serif',fontSize:12,fontWeight:700,
            letterSpacing:'0.05em',textTransform:'uppercase',cursor:'pointer',
            transition:'all 0.2s',whiteSpace:'nowrap',
          }}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="page-body" style={{ padding:'16px 32px' }}>
        <div style={{ marginBottom:12 }}><ProvenanceSummaryWidget/></div>
        {activeTab==='commodities' && <CommoditiesTab/>}
        {activeTab==='itens'       && <ItensTab/>}
        {activeTab==='veículos'    && <VeículosTab/>}
        {activeTab==='mining'      && <MineiroaçãoTab/>}
        {activeTab==='locations'   && <LocalizaçãosTab/>}
        {activeTab==='terminais'   && <TerminaisTab/>}
      </div>
    </div>
  );
}
