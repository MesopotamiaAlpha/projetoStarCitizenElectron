import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FlaskConical, CheckCircle2, Trash2, Plus,
  Minus, RefreshCw, MapPin, ChevronDown,
  ChevronUp, ShoppingCart, AlertTriangle, Star, X, Archive
} from 'lucide-react';
import {
  loadQueue, calcShoppingList, loadMaterialOrder, saveMaterialOrder,
  dequeueBlueprint, updateQueuedQty, clearCompleted, removeManualMaterial,
  materialKey, normalizeQualityMin, toBase, fromBase,
} from '../data/materialQueue';
import { loadVault, deductOreEntries, findExactVaultMatches } from '../data/oreVault';
import { normalizeCargoUnit, areCargoUnitsCompatible, isCargoUnit, toCargoBase, fromCargoBase, parseCargoInput, formatCargoNumber, cargoEquivalentTotal } from '../data/cargoUnits';
import { getOreColor as getSharedOreColor, getOreColorSoft } from '../data/oreColors';


// ── Vault Match Banner ────────────────────────────────────────────────────────
// Mostrado no topo quando há minérios no baú que batem com a lista de materiais
function VaultMatchBanner({ shoppingList, onNavigateVault }) {
  const matches = useMemo(() => {
    return shoppingList
      .filter(item => item.remaining > 0)
      .map(item => {
        const vaultEntries = findExactVaultMatches(item.material_name, item.quality_min).filter(e => {
          if (!item.unit) return true;
          const entryUnit = normalizeCargoUnit(e.unit || 'un');
          const requiredUnit = normalizeCargoUnit(item.unit || 'un');
          return isCargoUnit(requiredUnit) && isCargoUnit(entryUnit)
            ? areCargoUnitsCompatible(requiredUnit, entryUnit)
            : entryUnit === requiredUnit;
        });
        const vaultTotalData = cargoEquivalentTotal(vaultEntries, item.unit || 'un');
        const vaultTotal = vaultTotalData.total;
        return vaultTotal > 0 ? { ...item, vaultTotal, vaultUnit: vaultTotalData.unit, vaultEntries } : null;
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
        <div style={{fontSize:12,fontWeight:700,color:'var(--accent-gold)',marginBottom:3,fontFamily:'"Exo 2",sans-serif',textTransform:'uppercase',letterSpacing:'0.06em'}}>
          🎁 Baú de Minério — {matches.length} material{matches.length!==1?'is':''} disponíveis!
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
          {matches.map(m => {
            const materialColor = getMaterialColor(m.material_name);
            const quality = getQualityAccent(m.quality_min);
            return (
              <span key={m.key} className="material-vault-match-chip" style={{
                '--material-color': materialColor,
                fontSize:11,padding:'3px 8px',borderRadius:12,
                background:getOreColorSoft(m.material_name, 0.12),border:`1px solid ${materialColor}55`,
                color:'var(--text-primary)',fontFamily:'Share Tech Mono,monospace',
              }}>
                <strong style={{color:materialColor}}>{m.material_name}</strong>
                {m.quality_min > 0 && <span className="material-quality-badge material-quality-badge-inline" style={{color:quality.color,background:quality.soft,borderColor:quality.border}}>Q≥{m.quality_min}</span>}
                : <span style={{color:materialColor,fontWeight:700}}>{m.vaultTotal} {m.vaultUnit||m.unit||'un'}</span>
                {m.remaining > 0 && <span style={{color:'var(--text-muted)'}}> / {fmtSCU(m.remaining, m.unit).primary} necessário</span>}
              </span>
            );
          })}
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
function VaultUsePanel({ materialName, qualityMin = 0, needed, unit = 'un', onVaultChanged }) {
  const [vault, setVault] = useState(() => loadVault());
  const [pending, setPending] = useState({}); // entryId -> quantidade a usar

  function refresh() { setVault(loadVault()); }

  const matches = useMemo(() => findExactVaultMatches(materialName, qualityMin).filter(e => {
    if (!unit) return true;
    return isCargoUnit(unit) && isCargoUnit(e.unit)
      ? areCargoUnitsCompatible(e.unit, unit)
      : e.unit === unit;
  }), [vault, materialName, qualityMin, unit]);
    const quality = getQualityAccent(qualityMin);

  if (matches.length === 0) return null;

  const toRequirementBase = value => isCargoUnit(unit) ? toCargoBase(value, unit) : Number(value) || 0;
  const fromRequirementBase = value => isCargoUnit(unit) ? fromCargoBase(value, unit) : value;
  const entryToRequirementBase = (entry, value = entry.quantity) => {
    if (!isCargoUnit(unit) || !isCargoUnit(entry.unit)) return Number(value) || 0;
    return toCargoBase(value, entry.unit);
  };
  const fromRequirementBaseToEntry = (entry, value) => {
    if (!entry || !isCargoUnit(unit) || !isCargoUnit(entry.unit)) return value;
    return fromCargoBase(value, entry.unit);
  };
  const otherPendingBase = prev => Object.entries(prev).reduce((total, [entryId, quantity]) => {
    const entry = matches.find(item => String(item.id) === String(entryId));
    return total + (entry ? entryToRequirementBase(entry, quantity) : 0);
  }, 0);

  function toggleEntry(id) {
    setPending(prev => {
      const next = {...prev};
      if (next[id] !== undefined) { delete next[id]; }
      else {
        const entry = matches.find(item => String(item.id) === String(id));
        const availableBase = entry ? entryToRequirementBase(entry) : 0;
        const remainingBase = Math.max(0, toRequirementBase(needed) - otherPendingBase(prev));
        next[id] = fromRequirementBaseToEntry(entry, Math.min(availableBase, remainingBase));
      }
      return next;
    });
  }
  function setQty(id, val) {
    setPending(prev => {
      const entry = matches.find(e => String(e.id) === String(id));
      const requested = Math.max(0, parseCargoInput(val, entry?.unit || unit));
      const otherBase = otherPendingBase(Object.fromEntries(Object.entries(prev).filter(([entryId]) => String(entryId) !== String(id))));
      const maxBase = Math.max(0, toRequirementBase(needed) - otherBase);
      const availableBase = entry ? entryToRequirementBase(entry) : 0;
      const requestedBase = entry ? entryToRequirementBase(entry, requested) : toRequirementBase(requested);
      return {...prev, [id]: fromRequirementBaseToEntry(entry, Math.min(availableBase, maxBase, requestedBase)) };
    });
  }

  const totalPendingBase = Object.entries(pending).reduce((total, [entryId, quantity]) => {
    const entry = matches.find(item => String(item.id) === String(entryId));
    return total + (entry ? entryToRequirementBase(entry, quantity) : 0);
  }, 0);
  const totalPending = fromRequirementBase(totalPendingBase);

  function handleConfirm() {
    const uses = Object.entries(pending)
      .filter(([,q]) => q > 0)
      .map(([id, qty]) => ({ id: Number(id), qty }));
    if (uses.length === 0) return;
    deductOreEntries(uses.map(({id, qty}) => ({ id, amount: qty })));
    onVaultChanged();
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
        <Archive size={10}/> Disponível no Baú de Minério{Number(qualityMin) > 0 && <span className="material-quality-badge material-quality-badge-inline" style={{color:quality.color,background:quality.soft,borderColor:quality.border}}>somente Q≥{qualityMin}</span>}
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
                <button onClick={() => toggleEntry(entry.id)} style={{
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
                  <span style={{fontSize:12,fontWeight:700,color:getMaterialColor(entry.ore_name)}}>{entry.ore_name}</span>
                  {entry.refined && <span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:'rgba(52,211,153,0.1)',color:'var(--accent-green)',border:'1px solid rgba(52,211,153,0.2)',fontWeight:700}}>REFINADO</span>}
                  {entry.quality && (() => { const quality = getQualityAccent(entry.quality); return <span className="material-quality-badge" style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:quality.soft,color:quality.color,border:`1px solid ${quality.border}`,fontWeight:700}}>★ {entry.quality}</span>; })()}
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
                      type="text" inputMode="decimal"
                      value={pending[entry.id]}
                      onChange={e => setQty(entry.id, e.target.value)}
                      placeholder={isCargoUnit(unit) ? `ex: ${unit === 'SCU' ? '1,5' : '150'}` : 'Qtd'}
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
          <button onClick={() => setPending({})} style={{padding:'5px 10px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'"Exo 2",sans-serif',textTransform:'uppercase'}}>
            Cancelar
          </button>
          <button onClick={handleConfirm} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',background:'rgba(255,200,0,0.1)',border:'1px solid rgba(255,200,0,0.4)',borderRadius:5,color:'var(--accent-gold)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'"Exo 2",sans-serif',textTransform:'uppercase'}}>
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
  const normalized = normalizeCargoUnit(unit || 'un');
  if (isCargoUnit(normalized)) {
    const base = toCargoBase(qty, normalized);
    const scu = fromCargoBase(base, 'SCU');
    const cscu = fromCargoBase(base, 'cSCU');
    const primary = `${formatCargoNumber(qty, 9)} ${normalized}`;
    const secondary = normalized === 'SCU'
      ? `${formatCargoNumber(cscu, 9)} cSCU`
      : `${formatCargoNumber(scu, 9)} SCU`;
    return { primary, secondary };
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

const MATERIAL_COLORS = {
  'Titanium':'#74b9ff','Copper':'#fdcb6e','Orotite':'#a29bfe',
  'Caranite':'#fd79a8','Steel':'#b2bec3','Polymer':'#00cec9',
  'Industrial Polymer':'#55efc4','Medical Grade Polymer':'#34d399',
  'Inert Material':'#7a90b0','Reactive Material':'#fb7185','Tungsten':'#dfe6e9',
  'Bexalite':'#a29bfe','Laranite':'#fd79a8','Taranite':'#74b9ff',
  'Gold':'#fbbf24','Diamond':'#dfe6e9','Quantainium':'#34d399',
};

function getMaterialColor(name) {
  return getSharedOreColor(name);
}

function getQualityAccent(value) {
  const text = String(value ?? '').trim().toLowerCase();
  const numeric = Number(value) || 0;
  if (numeric >= 1000 || text === 'pristine' || text === 'grade a' || text === 'high') {
    return { color:'#fb7185', soft:'rgba(251,113,133,0.14)', border:'rgba(251,113,133,0.42)' };
  }
  if (numeric >= 800 || text === 'grade b' || text === 'medium') {
    return { color:'#a78bfa', soft:'rgba(167,139,250,0.14)', border:'rgba(167,139,250,0.42)' };
  }
  if (numeric > 0 || text === 'grade c' || text === 'low' || text === 'raw') {
    return { color:'#fbbf24', soft:'rgba(251,191,36,0.14)', border:'rgba(251,191,36,0.42)' };
  }
  return { color:'#94a3b8', soft:'rgba(148,163,184,0.12)', border:'rgba(148,163,184,0.34)' };
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
      <text x={size/2} y={size/2+4} textAnchor="middle" fill="var(--text-primary)" fontSize={11} fontWeight={700} fontFamily="Michroma,sans-serif">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

// ── Material row ──────────────────────────────────────────────────────────────
function MaterialRow({ item, onToggleExpandir, expanded, onVaultChanged, isManual, onRemoveManual, onDragStart, onDragOver, onDrop, onDragEnd, isDragging, isDragOver }) {
  const color    = getMaterialColor(item.material_name);
  const pct      = item.needed_total > 0 ? (item.collected / item.needed_total) * 100 : 0;
  const isDone   = item.remaining === 0;
  const quality = getQualityAccent(item.quality_min);

  return (
    <div
      className={`material-tracker-row ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        background: isDone ? 'rgba(52,211,153,0.05)' : 'var(--bg-card)',
        border: `1px solid ${isDone ? 'rgba(52,211,153,0.3)' : color+'33'}`,
        borderLeft: `3px solid ${isDone ? 'var(--accent-green)' : color}`,
        borderRadius:8,overflow:'hidden',transition:'all 0.2s',
      }}
    >
      {/* Main row */}
      <div className="material-row-main" style={{ display:'flex',alignItems:'flex-start',gap:12,padding:'12px 14px',cursor:'pointer',flexWrap:'wrap' }} onClick={onToggleExpandir}>
        <div className="material-drag-handle" title="Arraste para alterar a prioridade" aria-label="Arraste para alterar a prioridade" onClick={e => e.stopPropagation()}>
          <span>⋮⋮</span>
        </div>
        <ProgressoRing pct={pct} color={isDone?'var(--accent-green)':color}/>
          <div className="material-row-info" style={{ flex:'1 1 180px',minWidth:0 }}>
          <div className="material-row-title" style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap' }}>
            <span style={{ fontFamily:'"Exo 2",sans-serif',fontSize:14,fontWeight:700,color:isDone?'var(--accent-green)':color }}>
              {item.material_name}
            </span>
            {isDone && <span style={{ fontSize:10,fontWeight:700,color:'var(--accent-green)',background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.3)',padding:'1px 6px',borderRadius:3 }}>✓ COMPLETO</span>}
            {item.quality_min > 0 && <span className="material-quality-badge material-quality-badge-prominent" style={{ fontSize:10,color:quality.color,background:quality.soft,border:`1px solid ${quality.border}`,padding:'2px 7px',borderRadius:4 }}><Star size={9} fill="currentColor"/> Q≥{item.quality_min}</span>}
            {isManual && <span style={{ fontSize:9,color:'var(--accent-primary)',background:'rgba(56,189,248,0.08)',border:'1px solid rgba(56,189,248,0.2)',padding:'1px 6px',borderRadius:3,fontWeight:700 }}>MANUAL</span>}
          </div>
          {/* Progresso bar */}
          <div style={{ height:4,background:'var(--border-subtle)',borderRadius:2,overflow:'hidden',marginBottom:5 }}>
            <div style={{ height:'100%',width:`${Math.min(pct,100)}%`,background:isDone?'var(--accent-green)':color,borderRadius:2,transition:'width 0.5s ease',boxShadow:`0 0 6px ${color}55` }}/>
          </div>
          <div className="material-row-metrics">
            <div className="material-metric material-metric-needed">
              <span className="material-metric-label">Necessário</span>
              <QtyDisplay qty={item.needed_total} unit={item.unit} color='var(--text-primary)' size={12}/>
            </div>
            <div className="material-metric material-metric-collected">
              <span className="material-metric-label">Já tenho</span>
              <QtyDisplay qty={item.collected} unit={item.unit} color='var(--accent-green)' size={12}/>
            </div>
            <div className={`material-metric ${isDone ? 'material-metric-complete' : 'material-metric-missing'}`}>
              <span className="material-metric-label">Falta</span>
              <QtyDisplay qty={item.remaining} unit={item.unit} color={isDone?'var(--accent-green)':'var(--accent-red)'} size={12}/>
            </div>
          </div>
        </div>
        {!isDone && (
          <span className="material-vault-source-badge" title="A quantidade Já tenho é calculada diretamente no Baú de Minério">
            <Archive size={11}/> Fonte: Baú
          </span>
        )}
        {isManual && onRemoveManual && (
          <button draggable={false} onClick={e=>{e.stopPropagation();onRemoveManual(item.material_name);}} title="Remover da lista manual" style={{ padding:'5px 8px',background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.2)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer',fontSize:11,flexShrink:0 }}>
            <Trash2 size={11}/>
          </button>
        )}
        {expanded ? <ChevronUp size={14} style={{ color:'var(--text-muted)',flexShrink:0 }}/> : <ChevronDown size={14} style={{ color:'var(--text-muted)',flexShrink:0 }}/>}
      </div>

      {/* Expandido: uso em blueprints e dados do Baú */}
      {expanded && (
        <div style={{ padding:'0 14px 14px 14px',borderTop:'1px solid var(--border-subtle)',background:'rgba(0,0,0,0.1)' }}>
          <div className="material-expanded-grid" style={{ display:'grid',gridTemplateColumns:'1fr',gap:12,paddingTop:12 }}>
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
              qualityMin={item.quality_min}
              needed={item.remaining}
              unit={item.unit}
              onVaultChanged={onVaultChanged}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Planejamento de consumo de uma blueprint a partir do Baú ──────────────────
function buildBlueprintRequirements(bp) {
  const map = {};
  for (const ing of bp.ingredients || []) {
    const qualityMin = normalizeQualityMin(ing.quality_min);
    const unit = ing.unit || 'un';
    const key = materialKey(ing.material_name, qualityMin);
    if (!map[key]) {
      map[key] = { key, material_name: ing.material_name, quality_min: qualityMin, unit, quantity: 0 };
    }
    map[key].quantity += (Number(ing.quantity) || 0) * (Number(bp.quantity) || 1);
  }

  return Object.values(map);
}

function planBlueprintConsumption(bp) {
  const requirements = buildBlueprintRequirements(bp);
  const reserved = new Map();
  const usages = [];
  const collectedByKey = new Map();
  const missing = [];

  // Qualidades mais altas são reservadas primeiro, evitando que um minério Q≥800
  // seja consumido antes de atender uma exigência mais específica.
  requirements.sort((a, b) => b.quality_min - a.quality_min);

  for (const req of requirements) {
    let remainingBase = toBase(req.quantity, req.unit);
    const matches = findExactVaultMatches(req.material_name, req.quality_min)
      .filter(entry => {
        if (!req.unit) return true;
        return isCargoUnit(req.unit) && isCargoUnit(entry.unit)
          ? areCargoUnitsCompatible(req.unit, entry.unit)
          : entry.unit === req.unit;
      });

    for (const entry of matches) {
      if (remainingBase <= 0) break;
      const availableBase = Math.max(0, toBase(Number(entry.quantity) || 0, entry.unit) - (reserved.get(entry.id) || 0));
      const takeBase = Math.min(availableBase, remainingBase);
      if (takeBase <= 0) continue;
      reserved.set(entry.id, (reserved.get(entry.id) || 0) + takeBase);
      const taken = fromBase(takeBase, entry.unit);
      const collectedInRequirementUnit = fromBase(takeBase, req.unit);
      usages.push({ id: entry.id, amount: taken });
      collectedByKey.set(req.key, (collectedByKey.get(req.key) || 0) + collectedInRequirementUnit);
      remainingBase -= takeBase;
    }

    if (remainingBase > 0) {
      missing.push({ ...req, missing: fromBase(remainingBase, req.unit) });
    }
  }

  return { requirements, usages, collectedByKey, missing, success: missing.length === 0 && usages.length > 0 };
}

// ── Blueprint queue card com indicador de progresso ──────────────────────────
function BpQueueCard({ bp, shoppingList, onQtyChange, onRemove, onConsume, consuming }) {
  // Verificar se todos os ingredientes deste BP estão coletados
  const bpMaterials = bp.ingredients || [];
  const totalMats   = bpMaterials.length;
  const doneMats    = bpMaterials.filter(ing => {
    const sl = shoppingList.find(s => s.key === materialKey(ing.material_name, ing.quality_min));
    return sl && sl.remaining === 0;
  }).length;
  const isComplete  = totalMats > 0 && doneMats === totalMats;
  const pct         = totalMats > 0 ? Math.round(doneMats / totalMats * 100) : 0;

  return (
    <article className={`bp-queue-card ${isComplete ? 'is-complete' : ''}`} style={{
      background: isComplete ? 'rgba(52,211,153,0.07)' : 'var(--bg-card)',
      border: `1px solid ${isComplete ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.2)'}`,
    }}>
      <div className="bp-queue-card-head">
        <div className="bp-queue-status-icon">
          {isComplete
            ? <CheckCircle2 size={17}/>
            : <ShoppingCart size={15}/>
          }
        </div>
        <div className="bp-queue-info">
          <div className="bp-queue-title-line">
            <strong className="bp-queue-name" title={bp.bpName}>{bp.bpName}</strong>
            {isComplete && <span className="bp-queue-ready-badge">✓ PRONTO</span>}
          </div>
          <div className="bp-queue-meta-line">
            <span>{bp.category || 'Blueprint'}</span>
            <span className="bp-queue-material-count">{doneMats} de {totalMats} materiais</span>
          </div>
          <div className="bp-queue-progress-track" aria-label={`Progresso ${pct}%`}>
            <span style={{ width:`${pct}%`, background:isComplete ? 'var(--accent-green)' : 'var(--accent-gold)' }}/>
          </div>
        </div>
        <button className="bp-queue-remove" onClick={() => onRemove(bp.bpId)} title="Remover blueprint da fila" aria-label={`Remover ${bp.bpName} da fila`}>
          <X size={12}/>
        </button>
      </div>

      <div className="bp-queue-card-footer">
        <div className="bp-queue-quantity-wrap">
          <span className="bp-queue-action-label">Quantidade</span>
          <div className="bp-queue-qty">
            <button onClick={() => onQtyChange(bp.bpId, bp.quantity - 1)} disabled={bp.quantity <= 1} title="Diminuir quantidade" aria-label="Diminuir quantidade" style={{ opacity:bp.quantity <= 1 ? 0.4 : 1 }}><Minus size={10}/></button>
            <strong>{bp.quantity}</strong>
            <button onClick={() => onQtyChange(bp.bpId, bp.quantity + 1)} title="Aumentar quantidade" aria-label="Aumentar quantidade"><Plus size={10}/></button>
          </div>
        </div>
        <button
          className="bp-queue-consume bp-queue-consume-icon"
          onClick={() => onConsume(bp)}
          disabled={consuming}
          title={consuming ? 'Calculando o uso do Baú' : isComplete ? 'Concluir e consumir do Baú' : 'Tentar concluir pelo Baú'}
          aria-label={consuming ? `Calculando o uso do Baú para ${bp.bpName}` : `Concluir ${bp.bpName} usando os minérios elegíveis do Baú`}
          aria-busy={consuming}
          data-tooltip={consuming ? 'Calculando o uso do Baú...' : 'Concluir e consumir do Baú: usa os minérios elegíveis e mantém o estoque atualizado.'}
        >
          {consuming ? <RefreshCw size={14} className="bp-queue-spinner"/> : <Archive size={14}/>} 
        </button>
      </div>
    </article>
  );
}

// ── Queue panel ───────────────────────────────────────────────────────────────
function QueuePanel({ queue, onAtualizar, shoppingList, onConsumeBlueprint, consumingBpId }) {
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
        <BpQueueCard key={bp.bpId} bp={bp} shoppingList={shoppingList} onQtyChange={handleQtyChange} onRemove={handleRemove} onConsume={onConsumeBlueprint} consuming={consumingBpId === bp.bpId}/>

      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MaterialTrackerPage() {
  const [queue,        setQueueState] = useState(loadQueue);
  const [vault,        setVaultState] = useState(loadVault);
  const [materialOrder, setMaterialOrder] = useState(loadMaterialOrder);
  const [expandedMat,  setExpandiredMat]= useState(null);
  const [showDone,     setShowDone]   = useState(false);
  const [consumingBpId, setConsumingBpId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [draggedMaterialKey, setDraggedMaterialKey] = useState(null);
  const [dragOverMaterialKey, setDragOverMaterialKey] = useState(null);

  const refresh = useCallback(() => {
    setQueueState(loadQueue());
    setVaultState(loadVault());
    setMaterialOrder(loadMaterialOrder());
  }, []);

  // Atualizar on storage events (from BlueprintPage)
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [refresh]);

  const shoppingList = useMemo(() => calcShoppingList(queue, vault.entries), [queue, vault]);
  const orderedShoppingList = useMemo(() => {
    const byKey = new Map(shoppingList.map(item => [String(item.key), item]));
    const used = new Set();
    const manualItems = materialOrder
      .map(key => byKey.get(String(key)))
      .filter(Boolean)
      .filter(item => {
        if (used.has(item.key)) return false;
        used.add(item.key);
        return true;
      });
    const newItems = shoppingList.filter(item => !used.has(item.key));
    return [...manualItems, ...newItems];
  }, [shoppingList, materialOrder]);
  const pending  = orderedShoppingList.filter(i => i.remaining > 0);
  const done     = orderedShoppingList.filter(i => i.remaining === 0);
  const display  = [
    ...pending,
    ...(showDone ? done : []),
  ];

  const totalMats = shoppingList.length;
  const doneMats  = done.length;
  const overallPct= totalMats > 0 ? Math.round((doneMats/totalMats)*100) : 0;
  const priorityMaterial = pending[0] || null;

  function handleVaultChanged() {
    setVaultState(loadVault());
    setActionMessage({ type:'success', text:'Baú atualizado. O progresso do Tracking foi recalculado usando o estoque real.' });
  }
  function handleLimparConcluída() {
    clearCompleted();
    refresh();
  }

  function handleDragStart(event, item) {
    event.stopPropagation();
    setDraggedMaterialKey(item.key);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.key);
  }

  function handleDragOver(event, item) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    if (draggedMaterialKey && draggedMaterialKey !== item.key) setDragOverMaterialKey(item.key);
  }

  function handleDrop(event, targetItem) {
    event.preventDefault();
    event.stopPropagation();
    const sourceKey = draggedMaterialKey || event.dataTransfer.getData('text/plain');
    if (!sourceKey || sourceKey === targetItem.key) {
      setDraggedMaterialKey(null);
      setDragOverMaterialKey(null);
      return;
    }
    const keys = orderedShoppingList.map(item => item.key);
    const sourceIndex = keys.indexOf(sourceKey);
    const targetIndex = keys.indexOf(targetItem.key);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [movedKey] = keys.splice(sourceIndex, 1);
    keys.splice(keys.indexOf(targetItem.key), 0, movedKey);
    setMaterialOrder(saveMaterialOrder(keys));
    setDraggedMaterialKey(null);
    setDragOverMaterialKey(null);
  }

  function handleDragEnd() {
    setDraggedMaterialKey(null);
    setDragOverMaterialKey(null);
  }

  function handleConsumeBlueprint(bp) {
    setConsumingBpId(bp.bpId);
    setActionMessage(null);
    try {
      const plan = planBlueprintConsumption(bp);
      if (!plan.success) {
        const details = plan.missing.map(m => `${m.material_name}${m.quality_min > 0 ? ` Q≥${m.quality_min}` : ''}: faltam ${m.missing} ${m.unit}`).join(' · ');
        setActionMessage({ type:'error', text: details ? `Estoque elegível insuficiente. ${details}` : 'Nenhum material elegível encontrado no Baú.' });
        return;
      }

      // Só deduz depois que todos os requisitos passam na validação.
      // O Baú é a fonte única: não gravar a mesma coleta em collectedMaterials.
      deductOreEntries(plan.usages);
      refresh();
      setActionMessage({ type:'success', text:`Blueprint "${bp.bpName}" concluída. ${plan.usages.length} entrada(s) do Baú foram atualizadas.` });
    } catch (e) {
      console.error(e);
      setActionMessage({ type:'error', text:`Não foi possível concluir a blueprint: ${e.message}` });
    } finally {
      setConsumingBpId(null);
    }
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

      {actionMessage && (
        <div style={{ margin:'0 14px 10px',padding:'9px 12px',borderRadius:7,fontSize:11,lineHeight:1.5,background:actionMessage.type==='success'?'rgba(52,211,153,0.08)':'rgba(251,113,133,0.08)',border:`1px solid ${actionMessage.type==='success'?'rgba(52,211,153,0.28)':'rgba(251,113,133,0.28)'}`,color:actionMessage.type==='success'?'var(--accent-green)':'var(--accent-red)',display:'flex',alignItems:'flex-start',gap:7}}>
          {actionMessage.type==='success' ? <CheckCircle2 size={13} style={{flexShrink:0,marginTop:2}}/> : <AlertTriangle size={13} style={{flexShrink:0,marginTop:2}}/>}
          <span style={{flex:1}}>{actionMessage.text}</span>
          <button onClick={()=>setActionMessage(null)} style={{background:'none',border:'none',color:'inherit',cursor:'pointer',padding:0}}><X size={13}/></button>
        </div>
      )}

      <section className="material-tracker-summary" aria-label="Resumo da coleta">
        <div className="material-summary-priority">
          <div className="material-summary-kicker"><FlaskConical size={13}/> Próxima prioridade</div>
          <strong>{priorityMaterial ? priorityMaterial.material_name : 'Nenhum material pendente'}</strong>
          <span>{priorityMaterial ? `Falta ${fmtSCU(priorityMaterial.remaining, priorityMaterial.unit).primary}` : 'Tudo atualizado para a fila atual.'}</span>
        </div>
        <div className="material-summary-stats">
          <div className="material-summary-stat material-summary-stat-progress">
            <span className="material-summary-stat-label">Progresso</span>
            <strong>{overallPct}%</strong>
            <div className="material-summary-progress"><span style={{ width:`${overallPct}%` }}/></div>
          </div>
          <div className="material-summary-stat">
            <span className="material-summary-stat-label">Para coletar</span>
            <strong>{pending.length}</strong>
            <small>materiais pendentes</small>
          </div>
          <div className="material-summary-stat material-summary-stat-done">
            <span className="material-summary-stat-label">Já tenho</span>
            <strong>{doneMats}</strong>
            <small>materiais completos</small>
          </div>
        </div>
      </section>

      <div className="materials-layout" style={{ flex:1,display:'grid',gridTemplateColumns:'minmax(230px,300px) minmax(0,1fr)',overflow:'hidden' }}>

        {/* ── LEFT: Queue panel ── */}
        <div className="materials-queue-panel" style={{ borderRight:'1px solid var(--border-subtle)',overflowY:'auto',padding:'14px',minWidth:0 }}>
          <div className="material-tracker-section-heading" style={{ fontFamily:'Michroma,sans-serif',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10,display:'flex',alignItems:'center',gap:7 }}>
            <ShoppingCart size={12}/> Fila de Craft ({queue.queuedBlueprints.length})
          </div>
          <QueuePanel queue={queue} onAtualizar={refresh} shoppingList={shoppingList} onConsumeBlueprint={handleConsumeBlueprint} consumingBpId={consumingBpId}/>

          {/* Overall progress */}
          {totalMats > 0 && (
            <div className="material-tracker-progress-card" style={{ marginTop:16,padding:'12px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:8 }}>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8 }}>Progresso Geral</div>
              <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                <div style={{ flex:1,height:8,background:'var(--border-subtle)',borderRadius:4,overflow:'hidden' }}>
                  <div style={{ height:'100%',width:`${overallPct}%`,background:'linear-gradient(to right,var(--accent-secondary),var(--accent-green))',borderRadius:4,transition:'width 0.5s' }}/>
                </div>
                <span style={{ fontFamily:'Michroma,sans-serif',fontSize:14,fontWeight:800,color:'var(--accent-green)',flexShrink:0 }}>{overallPct}%</span>
              </div>
              <div style={{ fontSize:11,color:'var(--text-muted)' }}>{doneMats}/{totalMats} materiais coletados</div>
              {doneMats > 0 && (
                <button onClick={handleLimparConcluída} style={{ display:'flex',alignItems:'center',gap:5,marginTop:8,padding:'5px 10px',background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.2)',borderRadius:5,color:'var(--accent-green)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'"Exo 2",sans-serif',textTransform:'uppercase' }}>
                  <CheckCircle2 size={11}/> Limpar Concluídos
                </button>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="material-tracker-help-card" style={{ marginTop:14,padding:'10px 12px',background:'rgba(99,102,241,0.05)',border:'1px solid rgba(99,102,241,0.12)',borderRadius:7 }}>
            <div style={{ fontSize:10,fontWeight:700,color:'var(--accent-primary)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Como usar</div>
            <div style={{ fontSize:11,color:'var(--text-secondary)',lineHeight:1.6 }}>
              1. Vá para <strong>Blueprints</strong> e clique em <strong>🛒 Quero Craftar</strong><br/>
              2. Os materiais aparecem aqui consolidados<br/>
              3. Ajuste a <strong>quantidade</strong> de blueprints na fila<br/>
              4. Cadastre o minério uma única vez no <strong>Baú de Minério</strong>, com qualidade e local corretos<br/>
              5. Expanda o material e use somente as entradas elegíveis do Baú; ao completar, a blueprint deduz o estoque automaticamente
            </div>
          </div>
        </div>

        {/* ── RIGHT: Material shopping list ── */}
        <div className="materials-list-panel" style={{ overflowY:'auto',padding:'14px 18px',minWidth:0 }}>
          {/* Vault match banner */}
          <VaultMatchBanner shoppingList={shoppingList}/>

          <div className="material-tracker-source-note" style={{ marginBottom:12, padding:'9px 11px', background:'rgba(56,189,248,0.05)', border:'1px solid rgba(56,189,248,0.18)', borderRadius:7, color:'var(--text-secondary)', fontSize:11, lineHeight:1.5 }}>
            <strong style={{ color:'var(--accent-primary)' }}>Fonte única de estoque:</strong> cadastre cada minério no <strong>Baú de Minério</strong> uma única vez, informando a qualidade real. O Tracking apenas consulta, filtra por qualidade e deduz o Baú quando a blueprint for concluída.
          </div>

          {/* Controls */}
          <div className="materials-toolbar material-tracker-toolbar" style={{ display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center' }}>
            <span className="material-list-title" style={{ fontFamily:'Michroma,sans-serif',fontSize:12,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.05em',display:'flex',alignItems:'center',gap:7 }}>
              <FlaskConical size={14} style={{ color:'var(--accent-primary)' }}/> Lista de Materiais
            </span>
            <button className={`filter-chip ${showDone?'active':''}`} onClick={()=>setShowDone(!showDone)}>
              ✓ Mostrar Concluídos ({doneMats})
            </button>
            <span className="material-order-hint" title="Arraste os materiais para definir a prioridade">
              ⋮⋮ Arraste para ordenar
            </span>
            <span className="material-list-count" style={{ marginLeft:'auto',fontFamily:'Share Tech Mono,monospace',fontSize:11,color:'var(--text-muted)' }}>
              {pending.length} pendentes · {doneMats} coletados
            </span>
          </div>

          {queue.queuedBlueprints.length === 0 && (queue.manualMaterials||[]).length === 0 ? (
            <div className="material-tracker-empty" style={{ textAlign:'center',padding:'60px 20px',color:'var(--text-muted)' }}>
              <FlaskConical size={48} style={{ display:'block',margin:'0 auto 14px',opacity:0.2 }}/>
              <div style={{ fontFamily:'Michroma,sans-serif',fontSize:13,fontWeight:700,letterSpacing:'0.06em',marginBottom:8 }}>NENHUM BLUEPRINT NA FILA</div>
              <div style={{ fontSize:12,lineHeight:1.6 }}>
                Vá para a aba <strong style={{ color:'var(--accent-primary)' }}>Blueprints</strong> e clique em<br/>
                <strong style={{ color:'var(--accent-gold)' }}>🛒 Quero Craftar</strong> nos blueprints que deseja criar.<br/>
                Os materiais necessários aparecerão aqui automaticamente.<br/>
                Cadastre os minérios necessários no <strong style={{ color:'var(--accent-primary)' }}>Baú de Minério</strong> para que o Tracking calcule automaticamente o que já está disponível.
              </div>
            </div>
          ) : display.length === 0 ? (
            <div style={{ textAlign:'center',padding:'40px 20px',color:'var(--text-muted)' }}>
              <CheckCircle2 size={40} style={{ display:'block',margin:'0 auto 12px',color:'var(--accent-green)',opacity:0.6 }}/>
              <div style={{ fontFamily:'Michroma,sans-serif',fontSize:13,fontWeight:700,color:'var(--accent-green)',marginBottom:6 }}>
                {'TODOS OS MATERIAIS COLETADOS!'}
              </div>
              <div style={{ fontSize:12 }}>
                {'Você pode craftar todos os blueprints da fila!'}
              </div>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {display.map(item => (
                <MaterialRow
                  key={item.key}
                  item={item}
                  expanded={expandedMat===item.key}
                  onToggleExpandir={()=>setExpandiredMat(expandedMat===item.key?null:item.key)}
                  onVaultChanged={handleVaultChanged}
                  isManual={item.is_manual}
                  onRemoveManual={item.is_manual ? (name)=>{removeManualMaterial(name);refresh();} : undefined}
                  onDragStart={event => handleDragStart(event, item)}
                  onDragOver={event => handleDragOver(event, item)}
                  onDrop={event => handleDrop(event, item)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedMaterialKey === item.key}
                  isDragOver={dragOverMaterialKey === item.key}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}