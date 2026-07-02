import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FlaskConical, Pickaxe, CheckCircle2, Trash2, Plus,
  Minus, RefreshCw, Package, MapPin, ChevronDown,
  ChevronUp, ShoppingCart, AlertTriangle, Star, X, Archive, Gift
} from 'lucide-react';
import {
  loadQueue, saveQueue, calcShoppingList,
  collectMaterial, resetMaterialCollected, dequeueBlueprint,
  updateQueuedQty, clearCompleted,
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
function CollectInput({ material, unit, onCollect }) {
  const [amount, setQuantidade] = useState('');
  const isSCU = unit === 'SCU' || unit === 'cSCU';
  function submit() {
    const n = isSCU ? parseFloat(amount) : Number(amount);
    if (!n || n <= 0) return;
    onCollect(material, n);
    setQuantidade('');
  }
  const fmt = amount && !isNaN(parseFloat(amount)) ? fmtSCU(parseFloat(amount), unit) : null;
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:3,alignItems:'flex-end' }}>
      <div style={{ display:'flex',gap:6,alignItems:'center' }}>
        <input
          type="number" min="0" step={isSCU?'0.01':'1'} value={amount}
          onChange={e => setQuantidade(e.target.value)}
          onKeyDown={e => e.key==='Enter' && submit()}
          placeholder={`Qtd${unit?' ('+unit+')':''}...`}
          style={{ width:120,padding:'5px 8px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-primary)',fontFamily:'Share Tech Mono,monospace',fontSize:12,outline:'none' }}
        />
        <button onClick={submit} style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 12px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.3)',borderRadius:5,color:'var(--accent-green)',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Rajdhani,sans-serif',textTransform:'uppercase',whiteSpace:'nowrap' }}>
          <CheckCircle2 size={12}/> Coletei
        </button>
      </div>
      {fmt?.secondary && (
        <span style={{ fontFamily:'Share Tech Mono,monospace',fontSize:10,color:'var(--accent-gold)' }}>{fmt.primary} = {fmt.secondary}</span>
      )}
    </div>
  );
}

// ── Material row ──────────────────────────────────────────────────────────────
function MaterialRow({ item, onCollect, onReset, onToggleExpandir, expanded, onUseFromVault }) {
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
            {isMinable && !isDone && <span style={{ fontSize:10,color:'var(--accent-gold)',display:'flex',alignItems:'center',gap:3 }}><Pickaxe size={10}/>Mineiroável</span>}
            {item.quality_min > 0 && <span style={{ fontSize:10,color:'var(--text-muted)',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',padding:'1px 6px',borderRadius:3 }}>Q≥{item.quality_min}</span>}
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
            <CollectInput material={item.material_name} unit={item.unit} onCollect={onCollect}/>
          </div>
        )}
        {isDone && (
          <button onClick={e=>{e.stopPropagation();onReset(item.material_name);}} title="Resetar coleta" style={{ padding:'5px 10px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-muted)',cursor:'pointer',fontSize:11 }}>
            <RefreshCw size={11}/>
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

// ── Queue panel ───────────────────────────────────────────────────────────────
function QueuePanel({ queue, onAtualizar }) {
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
        <div key={bp.bpId} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:'var(--bg-card)',border:'1px solid rgba(255,196,54,0.2)',borderRadius:7 }}>
          <ShoppingCart size={14} style={{ color:'var(--accent-gold)',flexShrink:0 }}/>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{bp.bpName}</div>
            <div style={{ fontSize:10,color:'var(--text-muted)' }}>{bp.category} · {bp.ingredients?.length||0} materiais</div>
          </div>
          {/* Qty */}
          <div style={{ display:'flex',alignItems:'center',gap:5,flexShrink:0 }}>
            <button onClick={()=>handleQtyChange(bp.bpId,bp.quantity-1)} disabled={bp.quantity<=1} style={{ width:22,height:22,borderRadius:4,border:'1px solid var(--border-subtle)',background:'transparent',color:'var(--text-secondary)',cursor:bp.quantity>1?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',opacity:bp.quantity<=1?0.4:1 }}><Minus size={10}/></button>
            <span style={{ fontFamily:'Orbitron,monospace',fontSize:13,fontWeight:700,color:'var(--accent-gold)',minWidth:24,textAlign:'center' }}>{bp.quantity}</span>
            <button onClick={()=>handleQtyChange(bp.bpId,bp.quantity+1)} style={{ width:22,height:22,borderRadius:4,border:'1px solid var(--border-subtle)',background:'transparent',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><Plus size={10}/></button>
          </div>
          <button onClick={()=>handleRemove(bp.bpId)} style={{ width:26,height:26,borderRadius:5,border:'1px solid rgba(255,68,102,0.2)',background:'rgba(255,68,102,0.08)',color:'var(--accent-red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><X size={12}/></button>
        </div>
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
    collectMaterial(materialNome, amount);
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
          <QueuePanel queue={queue} onAtualizar={refresh}/>

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
                  onReset={handleReset}
                  expanded={expandedMat===item.material_name}
                  onToggleExpandir={()=>setExpandiredMat(expandedMat===item.material_name?null:item.material_name)}
                  onUseFromVault={(matName, qty) => { collectMaterial(matName, qty); refresh(); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
