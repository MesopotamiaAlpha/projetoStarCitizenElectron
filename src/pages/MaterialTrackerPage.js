import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FlaskConical, Pickaxe, CheckCircle2, Trash2, Plus,
  Minus, RefreshCw, Package, MapPin, ChevronDown,
  ChevronUp, ShoppingCart, AlertTriangle, Star, X, Archive, Gift
} from 'lucide-react';
import {
  loadQueue, saveQueue, calcShoppingList,
  collectMaterial, uncollectMaterial, resetMaterialCollected, dequeueBlueprint,
  updateQueuedQty, clearCompleted, addManualMaterial, removeManualMaterial,
} from '../data/materialQueue';
import { loadVault, deductOreEntry, findVaultMatches } from '../data/oreVault';


// ── Vault Match Banner ────────────────────────────────────────────────────────
// Mostrado no topo quando há minérios no baú que batem com a lista de materiais
function VaultMatchBanner({ shoppingList, onNavigateVault }) {
  const matches = useMemo(() => {
    return shoppingList
      .filter(item => item.remaining > 0)
      .map(item => {
        const vaultEntries = findVaultMatches(item.material_name);
        const vaultTotal   = vaultEntries.reduce((a,e) => a+(e.quantity||0), 0);
        return vaultTotal > 0 ? { ...item, vaultTotal, vaultEntries } : null;
      })
      .filter(Boolean);
  }, [shoppingList]);

  if (matches.length === 0) return null;

  return (
    <div style={{
      margin:'0 0 12px 0',
      background:'rgba(255,200,0,0.06)',
      border:'1px solid rgba(255,200,0,0.3)',
      borderRadius:9,
      padding:'11px 14px',
      display:'flex',
      alignItems:'center',
      gap:12,
      flexWrap:'wrap',
    }}>
      <Archive size={16} style={{color:'var(--accent-gold)',flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:700,color:'var(--accent-gold)',marginBottom:3,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase',letterSpacing:'0.06em'}}>
          🎁 Baú de Minério — {matches.length} material{matches.length!==1?'is':''} disponíveis!
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
          {matches.map(m => (
            <span key={m.material_name} style={{
              fontSize:11,padding:'2px 8px',borderRadius:12,
              background:'rgba(255,200,0,0.1)',border:'1px solid rgba(255,200,0,0.25)',
              color:'var(--text-primary)',fontFamily:'Share Tech Mono,monospace',
            }}>
              {m.material_name}: <span style={{color:'var(--accent-gold)',fontWeight:700}}>{m.vaultTotal} {m.unit||'un'}</span>
              {m.remaining > 0 && <span style={{color:'var(--text-muted)'}}> / {fmtSCU(m.remaining, m.unit).primary} necessário</span>}
            </span>
          ))}
        </div>
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',flexShrink:0}}>
        Expanda um material abaixo para usar do baú.
      </div>
    </div>
  );
}

// ── Vault Use Panel ───────────────────────────────────────────────────────────
// Painel dentro do MaterialRow para usar minério do baú
function VaultUsePanel({ materialName, needed, onUseFromVault }) {
  const [vault, setVault] = useState(() => loadVault());
  const [pending, setPending] = useState({}); // entryId -> quantidade a usar

  function refresh() { setVault(loadVault()); }

  const matches = useMemo(() => findVaultMatches(materialName), [vault, materialName]);

  if (matches.length === 0) return null;

  function toggleEntry(id, maxQty) {
    setPending(prev => {
      const next = {...prev};
      if (next[id] !== undefined) { delete next[id]; }
      else { next[id] = Math.min(maxQty, needed); }
      return next;
    });
  }
  function setQty(id, val) {
    const n = Math.max(0, parseFloat(val)||0);
    setPending(prev => ({...prev, [id]: n}));
  }

  const totalPending = Object.entries(pending).reduce((a,[id,q]) => a + q, 0);

  function handleConfirm() {
    const uses = Object.entries(pending)
      .filter(([,q]) => q > 0)
      .map(([id, qty]) => ({ id: Number(id), qty }));
    if (uses.length === 0) return;
    uses.forEach(({id, qty}) => deductOreEntry(id, qty));
    onUseFromVault(totalPending);
    refresh();
    setPending({});
  }

  return (
    <div style={{
      marginTop:10,
      background:'rgba(255,200,0,0.04)',
      border:'1px solid rgba(255,200,0,0.25)',
      borderRadius:8,
      padding:'10px 12px',
    }}>
      <div style={{fontSize:10,fontWeight:700,color:'var(--accent-gold)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8,display:'flex',alignItems:'center',gap:5}}>
        <Archive size={10}/> Disponível no Baú de Minério
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:8}}>
        {matches.map(entry => {
          const isSelected = pending[entry.id] !== undefined;
          return (
            <div key={entry.id} style={{
              display:'flex',alignItems:'center',gap:8,padding:'7px 10px',
              background: isSelected ? 'rgba(255,200,0,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isSelected ? 'rgba(255,200,0,0.4)' : 'var(--border-subtle)'}`,
              borderRadius:6,transition:'all 0.15s',
            }}>
              {/* Checkbox */}
              <button onClick={() => toggleEntry(entry.id, entry.quantity)} style={{
                width:16,height:16,borderRadius:3,flexShrink:0,cursor:'pointer',
                border:`2px solid ${isSelected?'var(--accent-gold)':'var(--border-normal)'}`,
                background:isSelected?'rgba(255,200,0,0.2)':'transparent',
                display:'flex',alignItems:'center',justifyContent:'center',
              }}>
                {isSelected && <div style={{width:7,height:7,borderRadius:1,background:'var(--accent-gold)'}}/>}
              </button>

              {/* Info da entrada */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,fontWeight:700,color:'var(--text-primary)'}}>{entry.ore_name}</span>
                  {entry.refined && <span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:'rgba(0,229,160,0.1)',color:'var(--accent-green)',border:'1px solid rgba(0,229,160,0.2)',fontWeight:700}}>REFINADO</span>}
                  {entry.quality && <span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:'rgba(255,200,0,0.1)',color:'var(--accent-gold)',border:'1px solid rgba(255,200,0,0.2)',fontWeight:700}}>★ {entry.quality}</span>}
                  {entry.location && <span style={{fontSize:10,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:2}}><MapPin size={8}/>{entry.location}</span>}
                </div>
              </div>

              {/* Quantidade disponível e input */}
              <div style={{display:'flex',alignItems:'center',gap:7,flexShrink:0}}>
                <span style={{fontSize:11,color:'var(--text-muted)'}}>Disponível:</span>
                <span style={{fontFamily:'Share Tech Mono,monospace',fontSize:12,color:'var(--accent-gold)',fontWeight:700}}>{entry.quantity} {entry.unit}</span>
                {isSelected && (
                  <>
                    <span style={{fontSize:11,color:'var(--text-muted)'}}>Usar:</span>
                    <input
                      type="number" min="0" max={entry.quantity} step="1"
                      value={pending[entry.id]}
                      onChange={e => setQty(entry.id, e.target.value)}
                      style={{width:70,padding:'4px 7px',background:'var(--bg-base)',border:'1px solid rgba(255,200,0,0.4)',borderRadius:4,color:'var(--accent-gold)',fontFamily:'Share Tech Mono,monospace',fontSize:12,outline:'none',textAlign:'center'}}
                    />
                    <span style={{fontSize:10,color:'var(--text-muted)'}}>{entry.unit}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Botões de confirmação */}
      {totalPending > 0 && (
        <div style={{display:'flex',alignItems:'center',gap:10,justifyContent:'flex-end'}}>
          <span style={{fontSize:12,color:'var(--text-secondary)'}}>
            Usar <span style={{fontFamily:'Share Tech Mono,monospace',color:'var(--accent-gold)',fontWeight:700}}>{totalPending}</span> do baú
            {needed > 0 && <span style={{color:'var(--text-muted)'}}> (precisa de {needed})</span>}
          </span>
          <button onClick={() => setPending({})} style={{padding:'5px 10px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase'}}>
            Cancelar
          </button>
          <button onClick={handleConfirm} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',background:'rgba(255,200,0,0.1)',border:'1px solid rgba(255,200,0,0.4)',borderRadius:5,color:'var(--accent-gold)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase'}}>
            <CheckCircle2 size={11}/> Confirmar Uso
          </button>
        </div>
      )}
    </div>
  );
}

// ── Conversão SCU/cSCU ───────────────────────────────────────────────────────
// 1 SCU = 100 cSCU
function fmtSCU(qty, unit) {
  if (unit === 'SCU') {
    const scu  = qty;
    const cscu = qty * 100;
    return { primary: `${Number(scu).toLocaleString('pt-BR')} SCU`, secondary: `${Number(cscu).toLocaleString('pt-BR')} cSCU` };
  }
  if (unit === 'cSCU') {
    const cscu = qty;
    const scu  = (qty / 100).toFixed(qty % 100 === 0 ? 0 : 2);
    return { primary: `${Number(cscu).toLocaleString('pt-BR')} cSCU`, secondary: `${scu} SCU` };
  }
  return { primary: `${Number(qty).toLocaleString('pt-BR')} ${unit||'un'}`, secondary: null };
}

function QtyDisplay({ qty, unit, color, size=12 }) {
  const fmt = fmtSCU(qty, unit);
  return (
    <span style={{ display:'inline-flex', flexDirection:'column', alignItems:'flex-start' }}>
      <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:size, fontWeight:700, color }}>{fmt.primary}</span>
      {fmt.secondary && <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:size-2, color:'var(--text-muted)' }}>{fmt.secondary}</span>}
    </span>
  );
}

// ── Mining location recommendations per material ──────────────────────────────
const MATERIAL_MINING_TIPS = {
  'Titanium':            { locations:['Daymar','Aberdeen','Yela','Cellin','Arial'],       tips:'Muito comum. Priorize luas rochosas de Crusader e Hurston.' },
  'Copper':              { locations:['Yela Asteroid Belt','Daymar','Aberdeen','Cellin'], tips:'Bom no cinturão de Yela. Mining em asteroides rende mais.' },
  'Orotite':             { locations:['Daymar','Cellin','Aberdeen','Yela'],              tips:'Moderadamente comum. Luas de Crusader são as mais acessíveis.' },
  'Caranite':            { locations:['Ita','Arial','Magda','Aberdeen'],                 tips:'Luas de Hurston têm maior concentração. Use laser de média potência.' },
  'Steel':               { locations:['Hurston','Ita','Arial'],                          tips:'Obtido em Hurston e luas rochosas próximas.' },
  'Polymer':             { locations:['Obtido por Desmontagem','Bunker Loot'],           tips:'Não é minério — desmonte itens plásticos ou colete em bunkers.' },
  'Industrial Polymer':  { locations:['Obtido por Desmontagem','Bunker Loot'],           tips:'Desmonte equipamentos industriais ou colete em DCs.' },
  'Medical Grade Polymer':{ locations:['Medical Facilities','Klescher','Bunker Loot'],  tips:'Encontrado em facilidades médicas e prisão de Klescher.' },
  'Inert Material':      { locations:['Bunker Loot','Desmontagem de qualquer item'],    tips:'Desmonte qualquer item básico de bunker. Muito comum.' },
  'Reactive Material':   { locations:['Instalações Especiais','Bunker Loot (raro)'],    tips:'Raro. Encontrado em bunkers de nível alto e instalações especiais.' },
  'Tungsten':            { locations:['HUR-L3','HUR-L5','Arial','Ita','Magda'],          tips:'Luas externas de Hurston. Use Prospector ou MOLE para eficiência.' },
  'Bexalite':            { locations:['Aberdeen','Daymar','Yela','Aaron Halo'],          tips:'Priorize asteroid belt de Aaron Halo e Yela para maior concentração.' },
  'Laranite':            { locations:['Hurston','Arial','Ita','Magda'],                  tips:'Concentrado em Hurston e suas luas. Boa opção para mineração superficial.' },
  'Taranite':            { locations:['microTech','Calliope','Clio','Euterpe'],          tips:'Luas geladas de microTech. Use cooler adequado para evitar superaquecimento.' },
  'Gold':                { locations:['Hurston','Aberdeen','Ita'],                       tips:'Veios maiores que a média. Vale a pena juntar com Laranite.' },
  'Diamond':             { locations:['Calliope','Clio','Euterpe'],                      tips:'Exclusivo das luas de microTech. Alto valor por unidade.' },
  'Quantainium':         { locations:['Yela Asteroid Belt','Aaron Halo','Cellin'],       tips:'⚠️ INSTÁVEL! Use laser em baixa potência. Maior valor do jogo.' },
  'Hephaestanite':       { locations:['Cellin','Daymar','Aberdeen'],                     tips:'Luas de Crusader. Frequentemente junto com outros minérios.' },
  'Dolivine':            { locations:['Daymar','Yela','Cellin'],                         tips:'Crusader luas. Boa opção para complementar carga.' },
  'Corundum':            { locations:['Calliope','Clio','Euterpe'],                      tips:'Junto com Taranite nas luas de microTech.' },
  'Aluminum':            { locations:['Cellin','Daymar','Yela'],                         tips:'Muito comum em luas de Crusader. Mining rápida em campos rasos.' },
  'Iron':                { locations:['Hurston','Aberdeen','Arial','Ita'],               tips:'Muito comum. Use só como complemento de carga.' },
  'Borase':              { locations:['Arial','Ita','Aberdeen'],                         tips:'Luas de Hurston. Veios médios com boa pureza.' },
  'Agricium':            { locations:['Cellin','Daymar'],                                tips:'Crusader luas. Frequentemente junto com Dolivine.' },
};

const MATERIAL_COLORS = {
  'Titanium':'#74b9ff','Copper':'#fdcb6e','Orotite':'#a29bfe',
  'Caranite':'#fd79a8','Steel':'#b2bec3','Polymer':'#00cec9',
  'Industrial Polymer':'#55efc4','Medical Grade Polymer':'#00e5a0',
  'Inert Material':'#7a90b0','Reactive Material':'#ff4466','Tungsten':'#dfe6e9',
  'Bexalite':'#a29bfe','Laranite':'#fd79a8','Taranite':'#74b9ff',
  'Gold':'#ffc436','Diamond':'#dfe6e9','Quantainium':'#00e5a0',
};

function getMaterialColor(name) {
  return MATERIAL_COLORS[name] || '#7a90b0';
}

// ── Circular progress ring ─────────────────────────────────────────────────────
function ProgressoRing({ pct, size=48, stroke=5, color='var(--accent-green)' }) {
  const r = (size-stroke*2)/2;
  const circ = 2*Math.PI*r;
  const defset = circ*(1-Math.min(pct,100)/100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={defset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition:'stroke-dashdefset 0.5s ease' }}/>
      <text x={size/2} y={size/2+4} textAnchor="middle" fill="var(--text-primary)" fontSize={11} fontWeight={700} fontFamily="Orbitron,monospace">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

// ── Material collect input ─────────────────────────────────────────────────────
function CollectInput({ material, unit, onCollect, onUncollect }) {
  const [amount, setQuantidade] = useState('');
  const [mode, setMode]         = useState('add'); // 'add' | 'remove'
  const isSCU = unit === 'SCU' || unit === 'cSCU';
  function submit() {
    const n = isSCU ? parseFloat(amount) : Number(amount);
    if (!n || n <= 0) return;
    if (mode === 'add') onCollect(material, n);
    else onUncollect(material, n);
    setQuantidade('');
  }
  const fmt = amount && !isNaN(parseFloat(amount)) ? fmtSCU(parseFloat(amount), unit) : null;
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end' }}>
      {/* Toggle add/remove */}
      <div style={{ display:'flex',borderRadius:5,overflow:'hidden',border:'1px solid var(--border-subtle)' }}>
        <button onClick={()=>setMode('add')} style={{ padding:'3px 8px',background:mode==='add'?'rgba(0,229,160,0.15)':'transparent',border:'none',borderRight:'1px solid var(--border-subtle)',color:mode==='add'?'var(--accent-green)':'var(--text-muted)',cursor:'pointer',fontSize:10,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase' }}>
          + Coletei
        </button>
        <button onClick={()=>setMode('remove')} style={{ padding:'3px 8px',background:mode==='remove'?'rgba(255,68,102,0.12)':'transparent',border:'none',color:mode==='remove'?'var(--accent-red)':'var(--text-muted)',cursor:'pointer',fontSize:10,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase' }}>
          − Remover
        </button>
      </div>
      <div style={{ display:'flex',gap:6,alignItems:'center' }}>
        <input
          type="number" min="0" step={isSCU?'0.01':'1'} value={amount}
          onChange={e => setQuantidade(e.target.value)}
          onKeyDown={e => e.key==='Enter' && submit()}
          placeholder={`Qtd (${unit||'un'})...`}
          style={{ width:110,padding:'5px 8px',background:'var(--bg-base)',border:`1px solid ${mode==='remove'?'rgba(255,68,102,0.3)':'var(--border-subtle)'}`,borderRadius:5,color:'var(--text-primary)',fontFamily:'Share Tech Mono,monospace',fontSize:12,outline:'none' }}
        />
        <button onClick={submit} style={{ display:'flex',alignItems:'center',gap:4,padding:'5px 10px',background:mode==='add'?'rgba(0,229,160,0.1)':'rgba(255,68,102,0.1)',border:`1px solid ${mode==='add'?'rgba(0,229,160,0.3)':'rgba(255,68,102,0.3)'}`,borderRadius:5,color:mode==='add'?'var(--accent-green)':'var(--accent-red)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase',whiteSpace:'nowrap' }}>
          {mode==='add'?<><CheckCircle2 size={11}/> OK</>:<><Minus size={11}/> OK</>}
        </button>
      </div>
      {fmt?.secondary && (
        <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:10,color:'var(--accent-gold)' }}>{fmt.primary} = {fmt.secondary}</span>
      )}
    </div>
  );
}

// ── Material row ──────────────────────────────────────────────────────────────
function MaterialRow({ item, onCollect, onUncollect, onReset, onToggleExpandir, expanded, onUseFromVault, isManual, onRemoveManual }) {
  const color    = getMaterialColor(item.material_name);
  const tips     = MATERIAL_MINING_TIPS[item.material_name];
  const pct      = item.needed_total > 0 ? (item.collected / item.needed_total) * 100 : 0;
  const isDone   = item.remaining === 0;
  const isMinable= tips && !tips.locations[0]?.includes('Desmontagem') && !tips.locations[0]?.includes('Loot') && !tips.locations[0]?.includes('Facilidades');

  return (
    <div style={{
      background: isDone ? 'rgba(0,229,160,0.05)' : 'var(--bg-card)',
      border: `1px solid ${isDone ? 'rgba(0,229,160,0.3)' : color+'33'}`,
      borderLeft: `3px solid ${isDone ? 'var(--accent-green)' : color}`,
      borderRadius:8,overflow:'hidden',transition:'all 0.2s',
    }}>
      {/* Main row */}
      <div style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 14px',cursor:'pointer' }} onClick={onToggleExpandir}>
        <ProgressoRing pct={pct} color={isDone?'var(--accent-green)':color}/>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap' }}>
            <span style={{ fontFamily:'Rajdhani,sans-serif',fontSize:14,fontWeight:700,color:isDone?'var(--accent-green)':color }}>
              {item.material_name}
            </span>
            {isDone && <span style={{ fontSize:10,fontWeight:700,color:'var(--accent-green)',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',padding:'1px 6px',borderRadius:3 }}>✓ COMPLETO</span>}
            {isMinable && !isDone && <span style={{ fontSize:10,color:'var(--accent-gold)',display:'flex',alignItems:'center',gap:3 }}><Pickaxe size={10}/>Minerável</span>}
            {item.quality_min > 0 && <span style={{ fontSize:10,color:'var(--text-muted)',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3 }}>Q≥{item.quality_min}</span>}
            {isManual && <span style={{ fontSize:9,color:'var(--accent-primary)',background:'rgba(0,212,255,0.08)',border:'1px solid rgba(0,212,255,0.2)',padding:'1px 6px',borderRadius:3,fontWeight:700 }}>MANUAL</span>}
          </div>
          {/* Progresso bar */}
          <div style={{ height:4,background:'var(--border-subtle)',borderRadius:2,overflow:'hidden',marginBottom:5 }}>
            <div style={{ height:'100%',width:`${Math.min(pct,100)}%`,background:isDone?'var(--accent-green)':color,borderRadius:2,transition:'width 0.5s ease',boxShadow:`0 0 6px ${color}55` }}/>
          </div>
          <div style={{ display:'flex',gap:16,fontSize:11,color:'var(--text-muted)',flexWrap:'wrap',alignItems:'flex-start' }}>
            <span style={{display:'flex',alignItems:'flex-start',gap:4}}>Necessário: <QtyDisplay qty={item.needed_total} unit={item.unit} color='var(--text-primary)' size={11}/></span>
            <span style={{display:'flex',alignItems:'flex-start',gap:4}}>Coletado: <QtyDisplay qty={item.collected} unit={item.unit} color='var(--accent-green)' size={11}/></span>
            <span style={{display:'flex',alignItems:'flex-start',gap:4}}>Restante: <QtyDisplay qty={item.remaining} unit={item.unit} color={isDone?'var(--accent-green)':'var(--accent-red)'} size={11}/></span>
          </div>
        </div>
        {/* Collect input */}
        {!isDone && (
          <div onClick={e=>e.stopPropagation()}>
            <CollectInput material={item.material_name} unit={item.unit} onCollect={onCollect} onUncollect={onUncollect}/>
          </div>
        )}
        {isDone && (
          <button onClick={e=>{e.stopPropagation();onReset(item.material_name);}} title="Resetar coleta" style={{ padding:'5px 10px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-muted)',cursor:'pointer',fontSize:11 }}>
            <RefreshCw size={11}/>
          </button>
        )}
        {isManual && onRemoveManual && (
          <button onClick={e=>{e.stopPropagation();onRemoveManual(item.material_name);}} title="Remover da lista manual" style={{ padding:'5px 8px',background:'rgba(255,68,102,0.08)',border:'1px solid rgba(255,68,102,0.2)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer',fontSize:11,flexShrink:0 }}>
            <Trash2 size={11}/>
          </button>
        )}
        {expanded ? <ChevronUp size={14} style={{ color:'var(--text-muted)',flexShrink:0 }}/> : <ChevronDown size={14} style={{ color:'var(--text-muted)',flexShrink:0 }}/>}
      </div>

      {/* Expandired: tips + used by */}
      {expanded && (
        <div style={{ padding:'0 14px 14px 14px',borderTop:'1px solid var(--border-subtle)',background:'rgba(0,0,0,0.1)' }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,paddingTop:12 }}>
            {/* Mining tips */}
            {tips && (
              <div>
                <div style={{ fontSize:10,fontWeight:700,color:'var(--accent-gold)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8,display:'flex',alignItems:'center',gap:5 }}>
                  <Pickaxe size={11}/> {isMinable?'Onde Mineiroar':'Como Obter'}
                </div>
                <div style={{ display:'flex',gap:5,flexWrap:'wrap',marginBottom:8 }}>
                  {tips.locations.map(loc => (
                    <span key={loc} style={{ fontSize:11,padding:'3px 8px',borderRadius:5,background:'rgba(255,196,54,0.08)',border:'1px solid rgba(255,196,54,0.2)',color:'var(--accent-gold)',display:'flex',alignItems:'center',gap:4 }}>
                      <MapPin size={9}/>{loc}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize:11,color:'var(--text-secondary)',lineHeight:1.5 }}>{tips.tips}</div>
              </div>
            )}
            {/* Used by blueprints */}
            <div>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--accent-primary)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8,display:'flex',alignItems:'center',gap:5 }}>
                <FlaskConical size={11}/> Usado por
              </div>
              {item.usedBy.map((u,i) => (
                <div key={i} style={{ display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid var(--border-subtle)',fontSize:11 }}>
                  <span style={{ color:'var(--text-secondary)' }}>{u.bpName}</span>
                  <span style={{ color:color,fontFamily:'Share Tech Mono,monospace',fontWeight:700 }}>×{u.qty}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Vault use panel */}
          {!isDone && (
            <VaultUsePanel
              materialName={item.material_name}
              needed={item.remaining}
              onUseFromVault={(qty) => { onUseFromVault(item.material_name, qty); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Formulário de adição manual de material ──────────────────────────────────
const KNOWN_MATERIALS = [
  'Titanium','Copper','Orotite','Caranite','Steel','Laranite','Taranite',
  'Bexalite','Quantainium','Hephaestanite','Dolivine','Corundum','Aluminum',
  'Iron','Borase','Agricium','Gold','Diamond','Tungsten','Inert Material',
  'Reactive Material','Polymer','Industrial Polymer','Medical Grade Polymer',
];
const MANUAL_UNITS = ['un','SCU','cSCU','kg'];

function AddManualMaterialForm({ onAdd }) {
  const [open,    setOpen]    = useState(false);
  const [name,    setName]    = useState('');
  const [qty,     setQty]     = useState('');
  const [unit,    setUnit]    = useState('un');
  const [qmin,    setQmin]    = useState('');
  const [error,   setError]   = useState('');

  const isSCU = unit === 'SCU' || unit === 'cSCU';

  function handleAdd() {
    if (!name.trim()) { setError('Nome obrigatório.'); return; }
    const n = isSCU ? parseFloat(qty) : parseInt(qty, 10);
    if (!n || n <= 0) { setError('Quantidade deve ser maior que zero.'); return; }
    onAdd(name.trim(), n, unit, parseInt(qmin)||0);
    setName(''); setQty(''); setQmin(''); setError(''); setOpen(false);
  }

  const IS = { padding:'6px 9px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'Rajdhani,sans-serif', fontSize:12, outline:'none' };
  const SS = { ...IS, appearance:'none', WebkitAppearance:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a90b0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat:'no-repeat', backgroundPosition:'right 5px center', paddingRight:22 };

  return (
    <div style={{ marginBottom:12 }}>
      {!open ? (
        <button onClick={()=>setOpen(true)} style={{ display:'flex',alignItems:'center',gap:5,padding:'6px 12px',background:'rgba(0,212,255,0.06)',border:'1px dashed rgba(0,212,255,0.25)',borderRadius:6,color:'var(--accent-primary)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase' }}>
          <Plus size={11}/> Adicionar Minério Manual
        </button>
      ) : (
        <div style={{ padding:'10px 12px',background:'rgba(0,212,255,0.04)',border:'1px solid rgba(0,212,255,0.2)',borderRadius:8 }}>
          <div style={{ fontSize:10,fontWeight:700,color:'var(--accent-primary)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8 }}>+ Adicionar Minério à Lista</div>
          <div style={{ display:'grid',gridTemplateColumns:'2fr 90px 80px 80px auto',gap:6,alignItems:'center' }}>
            <input style={{...IS,width:'100%'}} list="mat-names" placeholder="Nome do minério..." value={name} onChange={e=>setName(e.target.value)}/>
            <datalist id="mat-names">{KNOWN_MATERIALS.map(m=><option key={m} value={m}/>)}</datalist>
            <input style={{...IS,textAlign:'center',fontFamily:'Share Tech Mono,monospace'}} type="number" min="0" step={isSCU?'0.01':'1'} placeholder="Qtd" value={qty} onChange={e=>setQty(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()}/>
            <select style={SS} value={unit} onChange={e=>setUnit(e.target.value)}>
              {MANUAL_UNITS.map(u=><option key={u}>{u}</option>)}
            </select>
            <input style={{...IS,textAlign:'center',width:60}} type="number" min="0" placeholder="Q min" value={qmin} onChange={e=>setQmin(e.target.value)}/>
            <div style={{ display:'flex',gap:5 }}>
              <button onClick={handleAdd} style={{ display:'flex',alignItems:'center',gap:4,padding:'6px 10px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',borderRadius:5,color:'var(--accent-green)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase',whiteSpace:'nowrap' }}>
                <Plus size={10}/> Adicionar
              </button>
              <button onClick={()=>{setOpen(false);setError('');}} style={{ width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-muted)',cursor:'pointer' }}><X size={11}/></button>
            </div>
          </div>
          {error && <div style={{ fontSize:10,color:'var(--accent-red)',marginTop:5 }}>{error}</div>}
          <div style={{ fontSize:10,color:'var(--text-muted)',marginTop:6 }}>Q min = qualidade mínima (opcional). O item aparecerá na lista de materiais separado dos blueprints.</div>
        </div>
      )}
    </div>
  );
}

// ── Blueprint queue card com indicador de progresso ──────────────────────────
function BpQueueCard({ bp, shoppingList, onQtyChange, onRemove }) {
  // Verificar se todos os ingredientes deste BP estão coletados
  const bpMaterials = bp.ingredients || [];
  const totalMats   = bpMaterials.length;
  const doneMats    = bpMaterials.filter(ing => {
    const sl = shoppingList.find(s => s.material_name.toLowerCase() === ing.material_name.toLowerCase());
    return sl && sl.remaining === 0;
  }).length;
  const isComplete  = totalMats > 0 && doneMats === totalMats;
  const pct         = totalMats > 0 ? Math.round(doneMats / totalMats * 100) : 0;

  return (
    <div style={{
      display:'flex',alignItems:'center',gap:10,padding:'9px 12px',
      background: isComplete ? 'rgba(0,229,160,0.07)' : 'var(--bg-card)',
      border: `1px solid ${isComplete ? 'rgba(0,229,160,0.4)' : 'rgba(255,196,54,0.2)'}`,
      borderRadius:7, transition:'all 0.2s',
    }}>
      {/* Ícone / status */}
      {isComplete
        ? <CheckCircle2 size={16} style={{ color:'var(--accent-green)',flexShrink:0 }}/>
        : <ShoppingCart size={14} style={{ color:'var(--accent-gold)',flexShrink:0 }}/>
      }
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
          <div style={{ fontSize:13,fontWeight:700,color:isComplete?'var(--accent-green)':'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1 }}>{bp.bpName}</div>
          {isComplete && <span style={{ fontSize:9,padding:'1px 6px',borderRadius:3,background:'rgba(0,229,160,0.15)',color:'var(--accent-green)',border:'1px solid rgba(0,229,160,0.4)',fontWeight:700,flexShrink:0 }}>✓ PRONTO</span>}
        </div>
        {/* Mini progress bar */}
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <div style={{ flex:1,height:3,background:'var(--border-subtle)',borderRadius:2,overflow:'hidden' }}>
            <div style={{ height:'100%',width:`${pct}%`,background:isComplete?'var(--accent-green)':'var(--accent-gold)',borderRadius:2,transition:'width 0.4s' }}/>
          </div>
          <span style={{ fontSize:9,color:isComplete?'var(--accent-green)':'var(--text-muted)',fontFamily:'Share Tech Mono,monospace',flexShrink:0 }}>{doneMats}/{totalMats}</span>
        </div>
        <div style={{ fontSize:10,color:'var(--text-muted)',marginTop:2 }}>{bp.category}</div>
      </div>
      {/* Qty */}
      <div style={{ display:'flex',alignItems:'center',gap:4,flexShrink:0 }}>
        <button onClick={()=>onQtyChange(bp.bpId,bp.quantity-1)} disabled={bp.quantity<=1} style={{ width:20,height:20,borderRadius:3,border:'1px solid var(--border-subtle)',background:'transparent',color:'var(--text-secondary)',cursor:bp.quantity>1?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',opacity:bp.quantity<=1?0.4:1 }}><Minus size={9}/></button>
        <span style={{ fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,color:'var(--accent-gold)',minWidth:20,textAlign:'center' }}>{bp.quantity}</span>
        <button onClick={()=>onQtyChange(bp.bpId,bp.quantity+1)} style={{ width:20,height:20,borderRadius:3,border:'1px solid var(--border-subtle)',background:'transparent',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><Plus size={9}/></button>
      </div>
      <button onClick={()=>onRemove(bp.bpId)} style={{ width:24,height:24,borderRadius:4,border:'1px solid rgba(255,68,102,0.2)',background:'rgba(255,68,102,0.08)',color:'var(--accent-red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><X size={11}/></button>
    </div>
  );
}

// ── Queue panel ───────────────────────────────────────────────────────────────
function QueuePanel({ queue, onAtualizar, shoppingList }) {
  function handleQtyChange(bpId, qty) {
    updateQueuedQty(bpId, qty);
    onAtualizar();
  }
  function handleRemove(bpId) {
    dequeueBlueprint(bpId);
    onAtualizar();
  }

  if (queue.queuedBlueprints.length === 0) {
    return (
      <div style={{ textAlign:'center',padding:'24px 16px',color:'var(--text-muted)',fontSize:13,border:'1px dashed var(--border-subtle)',borderRadius:8 }}>
        <ShoppingCart size={32} style={{ display:'block',margin:'0 auto 8px',opacity:0.3 }}/>
        Nenhum blueprint na fila.<br/>
        <span style={{ fontSize:11 }}>Vá para a aba Blueprints e clique em "Quero Craftar".</span>
      </div>
    );
  }

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:7 }}>
      {queue.queuedBlueprints.map(bp => (
        <BpQueueCard key={bp.bpId} bp={bp} shoppingList={shoppingList} onQtyChange={handleQtyChange} onRemove={handleRemove}/>

      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MaterialTrackerPage() {
  const [queue,        setQueueState] = useState(loadQueue);
  const [expandedMat,  setExpandiredMat]= useState(null);
  const [showDone,     setShowDone]   = useState(false);
  const [filterMinable,setFilterMinable]=useState(false);

  const refresh = useCallback(() => setQueueState(loadQueue()), []);

  // Atualizar on storage events (from BlueprintPage)
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [refresh]);

  const shoppingList = useMemo(() => calcShoppingList(queue), [queue]);
  const pending  = shoppingList.filter(i => i.remaining > 0);
  const done     = shoppingList.filter(i => i.remaining === 0);
  const display  = [
    ...(filterMinable
      ? pending.filter(i => {
          const tips = MATERIAL_MINING_TIPS[i.material_name];
          return tips && !tips.locations[0]?.includes('Desmontagem') && !tips.locations[0]?.includes('Loot') && !tips.locations[0]?.includes('Facilidades');
        })
      : pending),
    ...(showDone ? done : []),
  ];

  const totalMats = shoppingList.length;
  const doneMats  = done.length;
  const overallPct= totalMats > 0 ? Math.round((doneMats/totalMats)*100) : 0;

  function handleCollect(materialNome, amount) {
    // Buscar a unit do material na shoppingList para normalização correta
    const sl = shoppingList.find(s => s.material_name.toLowerCase() === materialNome.toLowerCase());
    collectMaterial(materialNome, amount, sl?.unit || 'un');
    refresh();
  }
  function handleUncollect(materialNome, amount) {
    const sl = shoppingList.find(s => s.material_name.toLowerCase() === materialNome.toLowerCase());
    uncollectMaterial(materialNome, amount, sl?.unit || 'un');
    refresh();
  }
  function handleReset(materialNome) {
    resetMaterialCollected(materialNome);
    refresh();
  }
  function handleLimparConcluída() {
    clearCompleted();
    refresh();
  }

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' }}>
      <div className="page-header">
        <div>
          <div className="page-title">TRACKING DE MATERIAIS</div>
          <div className="page-subtitle">
            Materiais necessários para seus blueprints na fila · {pending.length} pendentes · {doneMats} coletados
          </div>
        </div>
        <button onClick={refresh} style={{ padding:'8px 12px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:12 }}>
          <RefreshCw size={13}/>
        </button>
      </div>

      <div style={{ flex:1,display:'grid',gridTemplateColumns:'300px 1fr',overflow:'hidden' }}>

        {/* ── LEFT: Queue panel ── */}
        <div style={{ borderRight:'1px solid var(--border-subtle)',overflowY:'auto',padding:'14px' }}>
          <div style={{ fontFamily:'Orbitron,monospace',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10,display:'flex',alignItems:'center',gap:7 }}>
            <ShoppingCart size={12}/> Fila de Craft ({queue.queuedBlueprints.length})
          </div>
          <QueuePanel queue={queue} onAtualizar={refresh} shoppingList={shoppingList}/>

          {/* Overall progress */}
          {totalMats > 0 && (
            <div style={{ marginTop:16,padding:'12px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8 }}>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8 }}>Progresso Geral</div>
              <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                <div style={{ flex:1,height:8,background:'var(--border-subtle)',borderRadius:4,overflow:'hidden' }}>
                  <div style={{ height:'100%',width:`${overallPct}%`,background:'linear-gradient(to right,var(--accent-secondary),var(--accent-green))',borderRadius:4,transition:'width 0.5s' }}/>
                </div>
                <span style={{ fontFamily:'Orbitron,monospace',fontSize:14,fontWeight:800,color:'var(--accent-green)',flexShrink:0 }}>{overallPct}%</span>
              </div>
              <div style={{ fontSize:11,color:'var(--text-muted)' }}>{doneMats}/{totalMats} materiais coletados</div>
              {doneMats > 0 && (
                <button onClick={handleLimparConcluída} style={{ display:'flex',alignItems:'center',gap:5,marginTop:8,padding:'5px 10px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:5,color:'var(--accent-green)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase' }}>
                  <CheckCircle2 size={11}/> Limpar Concluídos
                </button>
              )}
            </div>
          )}

          {/* Legend */}
          <div style={{ marginTop:14,padding:'10px 12px',background:'rgba(0,119,255,0.05)',border:'1px solid rgba(0,119,255,0.12)',borderRadius:7 }}>
            <div style={{ fontSize:10,fontWeight:700,color:'var(--accent-primary)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Como usar</div>
            <div style={{ fontSize:11,color:'var(--text-secondary)',lineHeight:1.6 }}>
              1. Vá para <strong>Blueprints</strong> e clique em <strong>🛒 Quero Craftar</strong><br/>
              2. Os materiais aparecem aqui consolidados<br/>
              3. Ajuste a <strong>quantidade</strong> de blueprints na fila<br/>
              4. Mineiroe e clique <strong>✓ Coletei</strong> ao coletar cada material<br/>
              5. A barra de progresso atualiza em tempo real
            </div>
          </div>
        </div>

        {/* ── RIGHT: Material shopping list ── */}
        <div style={{ overflowY:'auto',padding:'14px 18px' }}>
          {/* Vault match banner */}
          <VaultMatchBanner shoppingList={shoppingList}/>

          {/* Formulário adição manual */}
          <AddManualMaterialForm onAdd={(name,qty,unit,qmin)=>{addManualMaterial(name,qty,unit,qmin);refresh();}}/>

          {/* Controls */}
          <div style={{ display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center' }}>
            <span style={{ fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.05em',display:'flex',alignItems:'center',gap:7 }}>
              <FlaskConical size={14} style={{ color:'var(--accent-primary)' }}/> Lista de Materiais
            </span>
            <button className={`filter-chip ${filterMinable?'active':''}`} onClick={()=>setFilterMinable(!filterMinable)} style={{ display:'flex',alignItems:'center',gap:5 }}>
              <Pickaxe size={11}/> Só Mineiroáveis
            </button>
            <button className={`filter-chip ${showDone?'active':''}`} onClick={()=>setShowDone(!showDone)}>
              ✓ Mostrar Concluídos ({doneMats})
            </button>
            <span style={{ marginLeft:'auto',fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-muted)' }}>
              {pending.length} pendentes · {doneMats} coletados
            </span>
          </div>

          {queue.queuedBlueprints.length === 0 ? (
            <div style={{ textAlign:'center',padding:'60px 20px',color:'var(--text-muted)' }}>
              <FlaskConical size={48} style={{ display:'block',margin:'0 auto 14px',opacity:0.2 }}/>
              <div style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,letterSpacing:'0.06em',marginBottom:8 }}>NENHUM BLUEPRINT NA FILA</div>
              <div style={{ fontSize:12,lineHeight:1.6 }}>
                Vá para a aba <strong style={{ color:'var(--accent-primary)' }}>Blueprints</strong> e clique em<br/>
                <strong style={{ color:'var(--accent-gold)' }}>🛒 Quero Craftar</strong> nos blueprints que deseja criar.<br/>
                Os materiais necessários aparecerão aqui automaticamente.
              </div>
            </div>
          ) : display.length === 0 ? (
            <div style={{ textAlign:'center',padding:'40px 20px',color:'var(--text-muted)' }}>
              <CheckCircle2 size={40} style={{ display:'block',margin:'0 auto 12px',color:'var(--accent-green)',opacity:0.6 }}/>
              <div style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--accent-green)',marginBottom:6 }}>
                {filterMinable ? 'NENHUM MINÉRIO PENDENTE!' : 'TODOS OS MATERIAIS COLETADOS!'}
              </div>
              <div style={{ fontSize:12 }}>
                {filterMinable ? 'Todos os minérios já foram coletados.' : 'Você pode craftar todos os blueprints da fila!'}
              </div>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {display.map(item => (
                <MaterialRow
                  key={item.material_name}
                  item={item}
                  onCollect={handleCollect}
                  onUncollect={handleUncollect}
                  onReset={handleReset}
                  expanded={expandedMat===item.material_name}
                  onToggleExpandir={()=>setExpandiredMat(expandedMat===item.material_name?null:item.material_name)}
                  onUseFromVault={(matName, qty) => { collectMaterial(matName, qty, item.unit); refresh(); }}
                  isManual={item.is_manual}
                  onRemoveManual={item.is_manual ? (name)=>{removeManualMaterial(name);refresh();} : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}