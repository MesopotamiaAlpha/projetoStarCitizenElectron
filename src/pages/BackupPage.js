import React, { useState, useRef, useEffect } from 'react';
import {
  Save, Upload, Download, CheckSquare, Square, AlertTriangle, CheckCircle2,
  RefreshCw, FileWarning, Info, Shield
} from 'lucide-react';
import {
  BACKUP_CATEGORIES, UNSUPPORTED_CATEGORIES, countCategoryItems,
  countCategoryItemsFromBackup, downloadBackup, readBackupFile,
  categoriesInBackup, restoreBackup,
} from '../data/backupManager';

function fmtData(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
}

// ── Seção: Fazer Backup ────────────────────────────────────────────────────────
function BackupSection() {
  const [selected, setSelected] = useState(() => BACKUP_CATEGORIES.map(c => c.id));
  const [done, setDone] = useState(null); // resumo do último backup gerado
  const [counts, setCounts] = useState({});
  const [countsLoading, setCountsLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCountsLoading(true);
    Promise.all(BACKUP_CATEGORIES.map(async cat => [cat.id, await countCategoryItems(cat)]))
      .then(pairs => { if (!cancelled) { setCounts(Object.fromEntries(pairs)); setCountsLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
    setDone(null);
  }
  function selectAll()  { setSelected(BACKUP_CATEGORIES.map(c=>c.id)); setDone(null); }
  function selectNone() { setSelected([]); setDone(null); }

  async function handleDownload() {
    if (selected.length === 0) return;
    setDownloading(true);
    try {
      const backup = await downloadBackup(selected);
      setDone({ count: selected.length, at: backup.exported_at });
    } finally { setDownloading(false); }
  }

  return (
    <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:10,padding:20 }}>
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
        <Save size={16} style={{ color:'var(--accent-primary)' }}/>
        <span style={{ fontFamily:'Michroma,sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.06em' }}>FAZER BACKUP</span>
      </div>
      <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:14 }}>
        Escolha o que incluir — pode ser tudo, uma seção só, ou uma combinação.
      </div>

      <div style={{ display:'flex',gap:8,marginBottom:12 }}>
        <button onClick={selectAll} style={{ fontSize:11,fontWeight:700,color:'var(--accent-primary)',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4 }}>
          <CheckSquare size={12}/> Marcar todos
        </button>
        <button onClick={selectNone} style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4 }}>
          <Square size={12}/> Desmarcar todos
        </button>
      </div>

      <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:16 }}>
        {BACKUP_CATEGORIES.map(cat => {
          const checked = selected.includes(cat.id);
          const count = counts[cat.id];
          return (
            <label key={cat.id} style={{
              display:'flex',alignItems:'center',gap:10,padding:'9px 12px',cursor:'pointer',
              background: checked ? 'rgba(56,189,248,0.05)' : 'var(--bg-panel)',
              border:`1px solid ${checked?'rgba(56,189,248,0.25)':'var(--border-subtle)'}`, borderRadius:7,
            }}>
              <input type="checkbox" checked={checked} onChange={()=>toggle(cat.id)} style={{ flexShrink:0 }}/>
              <span style={{ flex:1,fontSize:13,color:'var(--text-primary)',fontWeight:600 }}>{cat.label}</span>
              {cat.sensitive && <Shield size={12} title="Contém seu token da UEX — mantenha o arquivo em local seguro." style={{ color:'var(--accent-gold)',flexShrink:0 }}/>}
              <span style={{ fontSize:11,color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace',flexShrink:0 }}>
                {countsLoading ? '...' : `${count ?? 0} registro${count!==1?'s':''}`}
              </span>
            </label>
          );
        })}
      </div>

      <button onClick={handleDownload} disabled={selected.length===0||downloading} style={{
        display:'flex',alignItems:'center',gap:8,padding:'11px 22px',
        background: selected.length? 'rgba(52,211,153,0.12)':'rgba(255,255,255,0.03)',
        border:`1px solid ${selected.length?'rgba(52,211,153,0.4)':'var(--border-subtle)'}`, borderRadius:8,
        color: selected.length?'var(--accent-green)':'var(--text-muted)',
        fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,textTransform:'uppercase',
        cursor: selected.length&&!downloading?'pointer':'not-allowed',
      }}>
        {downloading ? <RefreshCw size={15} style={{ animation:'spin 1s linear infinite' }}/> : <Download size={15}/>}
        {downloading ? 'Gerando...' : `Baixar Backup (${selected.length} ${selected.length===1?'seção':'seções'})`}
      </button>

      {done && (
        <div style={{ display:'flex',alignItems:'center',gap:7,marginTop:12,padding:'9px 12px',background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.25)',borderRadius:6,fontSize:12,color:'var(--accent-green)' }}>
          <CheckCircle2 size={13}/> Backup gerado com {done.count} seção{done.count!==1?'ões':''} — verifique sua pasta de downloads.
        </div>
      )}
    </div>
  );
}

// ── Seção: Restaurar Backup ────────────────────────────────────────────────────
function RestoreSection() {
  const fileRef = useRef(null);
  const [backup, setBackup] = useState(null);
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setResult(null); setBackup(null); setConfirming(false);
    try {
      const parsed = await readBackupFile(file);
      const found = categoriesInBackup(parsed);
      if (found.length === 0) throw new Error('Este backup não contém nenhuma seção reconhecida.');
      setBackup(parsed);
      setAvailable(found);
      setSelected(found.map(c=>c.id));
    } catch(err) { setError(err.message); }
    finally { e.target.value = ''; }
  }

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }

  const [restoring, setRestoring] = useState(false);

  async function handleRestore() {
    setRestoring(true);
    try {
      const res = await restoreBackup(backup, selected);
      setResult(res);
      setConfirming(false);
    } finally { setRestoring(false); }
  }

  return (
    <div style={{ background:'var(--bg-card)',border:'1px solid var(--border-normal)',borderRadius:10,padding:20 }}>
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
        <Upload size={16} style={{ color:'#a29bfe' }}/>
        <span style={{ fontFamily:'Michroma,sans-serif',fontSize:13,fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.06em' }}>RESTAURAR BACKUP</span>
      </div>
      <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:14 }}>
        Escolha um arquivo de backup gerado anteriormente pelo Companheiro Emoto.
      </div>

      <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} style={{ display:'none' }}/>
      <button onClick={()=>fileRef.current?.click()} style={{
        display:'flex',alignItems:'center',gap:8,padding:'10px 18px',
        background:'rgba(162,155,254,0.1)',border:'1px solid rgba(162,155,254,0.35)',borderRadius:7,
        color:'#a29bfe',fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,textTransform:'uppercase',cursor:'pointer',marginBottom:14,
      }}>
        <FileWarning size={14}/> Escolher Arquivo de Backup
      </button>

      {error && (
        <div style={{ display:'flex',alignItems:'center',gap:7,padding:'9px 12px',background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.25)',borderRadius:6,fontSize:12,color:'var(--accent-red)',marginBottom:14 }}>
          <AlertTriangle size={13}/>{error}
        </div>
      )}

      {backup && (
        <>
          <div style={{ fontSize:11,color:'var(--text-secondary)',marginBottom:12 }}>
            Backup de <strong>{fmtData(backup.exported_at)}</strong> — {available.length} seç{available.length!==1?'ões':'ão'} encontrada{available.length!==1?'s':''}.
          </div>

          <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:14 }}>
            {available.map(cat => {
              const checked = selected.includes(cat.id);
              const count = countCategoryItemsFromBackup(cat, backup);
              return (
                <label key={cat.id} style={{
                  display:'flex',alignItems:'center',gap:10,padding:'9px 12px',cursor:'pointer',
                  background: checked ? 'rgba(162,155,254,0.06)' : 'var(--bg-panel)',
                  border:`1px solid ${checked?'rgba(162,155,254,0.3)':'var(--border-subtle)'}`, borderRadius:7,
                }}>
                  <input type="checkbox" checked={checked} onChange={()=>toggle(cat.id)} style={{ flexShrink:0 }}/>
                  <span style={{ flex:1,fontSize:13,color:'var(--text-primary)',fontWeight:600 }}>{cat.label}</span>
                  <span style={{ fontSize:11,color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace',flexShrink:0 }}>{count} registro{count!==1?'s':''}</span>
                </label>
              );
            })}
          </div>

          <div style={{ display:'flex',alignItems:'center',gap:7,padding:'9px 12px',background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:6,fontSize:11,color:'var(--text-secondary)',marginBottom:14 }}>
            <AlertTriangle size={13} style={{ color:'var(--accent-gold)',flexShrink:0 }}/>
            Restaurar substitui os dados atuais das seções marcadas — essa ação não pode ser desfeita.
          </div>

          {!confirming ? (
            <button onClick={()=>setConfirming(true)} disabled={selected.length===0} style={{
              display:'flex',alignItems:'center',gap:8,padding:'11px 22px',
              background: selected.length?'rgba(251,191,36,0.1)':'rgba(255,255,255,0.03)',
              border:`1px solid ${selected.length?'rgba(251,191,36,0.35)':'var(--border-subtle)'}`, borderRadius:8,
              color: selected.length?'var(--accent-gold)':'var(--text-muted)',
              fontFamily:'"Exo 2",sans-serif',fontSize:13,fontWeight:700,textTransform:'uppercase',
              cursor: selected.length?'pointer':'not-allowed',
            }}>
              <Upload size={15}/> Restaurar {selected.length} Seç{selected.length!==1?'ões':'ão'}
            </button>
          ) : (
            <div style={{ display:'flex',gap:8,alignItems:'center' }}>
              <span style={{ fontSize:12,color:'var(--accent-red)',fontWeight:700 }}>Tem certeza?</span>
              <button onClick={handleRestore} disabled={restoring} style={{ padding:'8px 16px',background:'rgba(251,113,133,0.15)',border:'1px solid rgba(251,113,133,0.4)',borderRadius:6,color:'var(--accent-red)',fontWeight:700,fontSize:12,cursor:restoring?'not-allowed':'pointer',opacity:restoring?0.6:1 }}>{restoring?'Restaurando...':'Sim, restaurar'}</button>
              <button onClick={()=>setConfirming(false)} style={{ padding:'8px 16px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-secondary)',fontSize:12,cursor:'pointer' }}>Cancelar</button>
            </div>
          )}
        </>
      )}

      {result && (
        <div style={{ marginTop:14 }}>
          <div style={{ display:'flex',alignItems:'center',gap:7,padding:'9px 12px',background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.25)',borderRadius:6,fontSize:12,color:'var(--accent-green)',marginBottom:10 }}>
            <CheckCircle2 size={13}/> Restaurado: {result.categories.join(', ')}.
          </div>
          <button onClick={()=>window.location.reload()} style={{
            display:'flex',alignItems:'center',gap:8,padding:'10px 18px',
            background:'rgba(56,189,248,0.1)',border:'1px solid rgba(56,189,248,0.35)',borderRadius:7,
            color:'var(--accent-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,textTransform:'uppercase',cursor:'pointer',
          }}>
            <RefreshCw size={13}/> Recarregar o App Agora
          </button>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function BackupPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display:'flex',alignItems:'center',gap:10 }}>
            <Save size={20} style={{ color:'var(--accent-primary)' }}/> BACKUP & RESTAURAÇÃO
          </div>
          <div className="page-subtitle">Exporte e restaure os dados do seu Companheiro Emoto</div>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'12px 16px',background:'rgba(56,189,248,0.05)',border:'1px solid rgba(56,189,248,0.15)',borderRadius:8,fontSize:12,color:'var(--text-secondary)',marginBottom:20,lineHeight:1.6 }}>
          <Info size={15} style={{ color:'var(--accent-primary)',flexShrink:0,marginTop:1 }}/>
          <div>
            Ainda não cobertas por este backup (ficam num banco separado do Electron): <strong>{UNSUPPORTED_CATEGORIES.join(', ')}</strong>.
            Essas seções vão ganhar backup próprio em uma atualização futura.
          </div>
        </div>

        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(420px, 1fr))',gap:20 }}>
          <BackupSection/>
          <RestoreSection/>
        </div>
      </div>
    </>
  );
}