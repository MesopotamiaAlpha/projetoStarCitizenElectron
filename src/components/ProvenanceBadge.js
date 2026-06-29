import React, { useState, useEffect, useRef } from 'react';
import { Globe, Database, Edit3, Star, Info , X, ExternalLink, Clock } from 'lucide-react';
import { getProvenance, formatImportedAt, SOURCE_META } from '../data/provenance';

const ICONS = { globe: Globe, database: Database, edit: Edit3, star: Star };

// ── Small inline badge ────────────────────────────────────────────────────────
// Usage: <ProvenanceBadge category="commodity" name="Quantainium" />
export function ProvenanceBadge({ category, name, style: extraStyle }) {
  const [prov, setProv] = useState(null);
  const [open, setAbrir] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setProv(getProvenance(category, name));
  }, [category, name]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setAbrir(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!prov) return null;

  const Icon = ICONS[prov.icon] || Info ;

  return (
    <span ref={ref} style={{ position:'relative',display:'inline-flex',alignItems:'center',...extraStyle }}>
      {/* Badge pill */}
      <button
        onClick={e => { e.stopPropagation(); setAbrir(o => !o); }}
        title={`Origem: ${prov.label} — clique para detalhes`}
        style={{
          display:'inline-flex',alignItems:'center',gap:4,
          padding:'2px 7px',borderRadius:10,
          background: prov.bgColor,
          border: `1px solid ${prov.border}`,
          color: prov.color,
          cursor:'pointer',fontSize:10,fontWeight:700,
          letterSpacing:'0.06em',
          transition:'all 0.15s',
          lineHeight:1.4,
        }}
        onMouseEnter={e => e.currentTarget.style.opacity='0.8'}
        onMouseLeave={e => e.currentTarget.style.opacity='1'}
      >
        <Icon size={10} strokeWidth={2.5}/>
        {prov.shortLabel}
      </button>

      {/* Popover */}
      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position:'absolute',bottom:'calc(100% + 8px)',left:'50%',transform:'translateX(-50%)',
          minWidth:240,maxWidth:300,
          background:'var(--bg-card)',
          border:`1px solid ${prov.border}`,
          borderRadius:8,padding:'12px 14px',
          boxShadow:'0 8px 24px rgba(0,0,0,0.5)',
          zIndex:9999,
          animation:'fadeIn 0.1s ease',
        }}>
          {/* Arrow */}
          <div style={{
            position:'absolute',bottom:-6,left:'50%',transform:'translateX(-50%)',
            width:10,height:10,background:'var(--bg-card)',
            border:`1px solid ${prov.border}`,
            borderTop:'none',borderLeft:'none',
            transform:'translateX(-50%) rotate(45deg)',
          }}/>

          {/* Header */}
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
            <div style={{ display:'flex',alignItems:'center',gap:6 }}>
              <div style={{ width:24,height:24,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',background:prov.bgColor,border:`1px solid ${prov.border}` }}>
                <Icon size={13} style={{ color:prov.color }}/>
              </div>
              <div>
                <div style={{ fontSize:12,fontWeight:700,color:prov.color }}>{prov.label}</div>
                <div style={{ fontSize:10,color:'var(--text-muted)',marginTop:1 }}>Origem dos dados</div>
              </div>
            </div>
            <button onClick={()=>setAbrir(false)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:0,lineHeight:1 }}><X size={12}/></button>
          </div>

          {/* Descrição */}
          <div style={{ fontSize:11,color:'var(--text-secondary)',lineHeight:1.5,marginBottom:8 }}>
            {prov.desc}
          </div>

          {/* Fields */}
          <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
            {prov.importedAt && (
              <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11 }}>
                <Clock size={10} style={{ color:'var(--text-muted)',flexShrink:0 }}/>
                <span style={{ color:'var(--text-muted)' }}>Importarado em:</span>
                <span style={{ color:'var(--text-primary)',fontFamily:'Share Tech Mono,monospace',fontSize:10 }}>
                  {formatImportedAt(prov.importedAt)}
                </span>
              </div>
            )}
            {prov.gameVersion && (
              <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11 }}>
                <Star size={10} style={{ color:'var(--text-muted)',flexShrink:0 }}/>
                <span style={{ color:'var(--text-muted)' }}>Versão do jogo:</span>
                <span style={{ color:'var(--text-primary)',fontFamily:'Share Tech Mono,monospace',fontSize:10 }}>
                  SC {prov.gameVersion}
                </span>
              </div>
            )}
            {prov.endpoint && (
              <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11 }}>
                <Database size={10} style={{ color:'var(--text-muted)',flexShrink:0 }}/>
                <span style={{ color:'var(--text-muted)' }}>Endpoint:</span>
                <span style={{ color:'var(--text-primary)',fontFamily:'Share Tech Mono,monospace',fontSize:10 }}>
                  /2.0/{prov.endpoint}
                </span>
              </div>
            )}
          </div>

          {/* Link */}
          {prov.url && (
            <a href={prov.url} target="_blank" rel="noreferrer" style={{
              display:'flex',alignItems:'center',gap:5,marginTop:10,
              padding:'6px 10px',background:prov.bgColor,
              border:`1px solid ${prov.border}`,borderRadius:5,
              color:prov.color,fontSize:11,fontWeight:700,textDecoration:'none',
            }}>
              <ExternalLink size={11}/>Abrir {prov.label}
            </a>
          )}
        </div>
      )}
    </span>
  );
}

// ── Compact icon-only version ────────────────────────────────────────────────
export function ProvenanceIcon({ category, name }) {
  const [prov, setProv]   = useState(null);
  const [open, setAbrir]   = useState(false);
  const ref               = useRef(null);

  useEffect(() => { setProv(getProvenance(category, name)); }, [category, name]);

  useEffect(() => {
    if (!open) return;
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setAbrir(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  if (!prov) return null;
  const Icon = ICONS[prov.icon] || Info ;

  return (
    <span ref={ref} style={{ position:'relative',display:'inline-flex' }}>
      <button onClick={e=>{e.stopPropagation();setAbrir(o=>!o);}}
        style={{ background:'none',border:'none',cursor:'pointer',padding:2,
          color:prov.color,display:'flex',alignItems:'center',lineHeight:1 }}
        title={`Origem: ${prov.label} — ${formatImportedAt(prov.importedAt)}`}>
        <Icon size={13} strokeWidth={2.5}/>
      </button>
      {open && (
        <ProvenancePopover prov={prov} onClose={()=>setAbrir(false)}/>
      )}
    </span>
  );
}

// ── Standalone popover used by ProvenanceIcon ─────────────────────────────────
function ProvenancePopover({ prov, onClose }) {
  const Icon = ICONS[prov.icon] || Info ;
  return (
    <div onClick={e=>e.stopPropagation()} style={{
      position:'absolute',top:'calc(100% + 6px)',left:'50%',transform:'translateX(-50%)',
      minWidth:230,background:'var(--bg-card)',border:`1px solid ${prov.border}`,
      borderRadius:8,padding:'12px',boxShadow:'0 8px 24px rgba(0,0,0,0.5)',zIndex:9999,
    }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <Icon size={13} style={{ color:prov.color }}/>
          <span style={{ fontSize:12,fontWeight:700,color:prov.color }}>{prov.label}</span>
        </div>
        <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:0 }}><X size={11}/></button>
      </div>
      <div style={{ fontSize:11,color:'var(--text-secondary)',lineHeight:1.5,marginBottom:6 }}>{prov.desc}</div>
      {prov.importedAt && (
        <div style={{ fontSize:10,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:5 }}>
          <Clock size={10}/> {formatImportedAt(prov.importedAt)}
          {prov.gameVersion && <span style={{ marginLeft:6 }}>· SC {prov.gameVersion}</span>}
        </div>
      )}
    </div>
  );
}

// ── Summary widget: shows UEX import stats ────────────────────────────────────
export function ProvenanceSummaryWidget() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    // Dynamic import to avoid circular
    import('../data/provenance').then(m => {
      setSummary(m.getProvenanceSummary());
    });
  }, []);

  if (!summary || (summary.counts.uex_api === 0 && summary.counts.manual === 0)) return null;

  const entries = [
    { key:'uex_api', label:'UEX API', color: SOURCE_META.uex_api.color },
    { key:'seed',    label:'DB Local', color: SOURCE_META.seed.color },
    { key:'manual',  label:'Manual',   color: SOURCE_META.manual.color },
    { key:'custom',  label:'Custom',   color: SOURCE_META.custom.color },
  ].filter(e => summary.counts[e.key] > 0);

  return (
    <div style={{
      display:'flex',gap:8,alignItems:'center',padding:'6px 12px',
      background:'rgba(0,0,0,0.15)',border:'1px solid var(--border-subtle)',
      borderRadius:6,flexWrap:'wrap',
    }}>
      <Info size={11} style={{ color:'var(--text-muted)',flexShrink:0 }}/>
      <span style={{ fontSize:10,color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em' }}>Fontes:</span>
      {entries.map(e => (
        <span key={e.key} style={{ fontSize:10,color:e.color,fontWeight:700,display:'flex',alignItems:'center',gap:3 }}>
          {summary.counts[e.key]} {e.label}
        </span>
      ))}
      {summary.lastUexImportar && (
        <span style={{ fontSize:10,color:'var(--text-muted)',marginLeft:4,display:'flex',alignItems:'center',gap:4 }}>
          <Clock size={10}/> Última sync UEX: {formatImportedAt(summary.lastUexImportar)}
        </span>
      )}
    </div>
  );
}

export default ProvenanceBadge;
