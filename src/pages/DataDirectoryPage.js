import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Copy, Database, Download, ExternalLink, FolderCog,
  HardDrive, Info, RefreshCw, ShieldCheck, Upload, AlertTriangle, Trash2, LockKeyhole,
  Smartphone, Power, RotateCw, Wifi, Shield,
} from 'lucide-react';
import { SELECTIVE_CLEANUP_CATEGORIES, clearCategoryLocalStorage } from '../data/selectiveCleanup';
import QRCode from 'qrcode';

const isElectron = () => Boolean(window.electronAPI?.dataGetInfo);

function collectLocalStorage() {
  const data = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key) data[key] = localStorage.getItem(key);
  }
  return data;
}

function getLocalCategoryKeyCount(category) {
  return category.localStorageKeys.filter(key => localStorage.getItem(key) !== null).length;
}

function SelectiveCleanupPanel({ setMessage, setPendingRestart }) {
  const [selectedId, setSelectedId] = useState('');
  const [counts, setCounts] = useState({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);

  async function refreshCounts() {
    setLoadingCounts(true);
    try {
      if (!isElectron()) {
        setCounts({});
        return;
      }
      const result = await window.electronAPI.dataSelectiveCounts();
      if (!result.success) throw new Error(result.error || 'Não foi possível contar os dados.');
      setCounts(result.counts || {});
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Não foi possível ler as contagens de limpeza.' });
    } finally {
      setLoadingCounts(false);
    }
  }

  useEffect(() => { refreshCounts(); }, []);

  const selected = SELECTIVE_CLEANUP_CATEGORIES.find(category => category.id === selectedId) || null;
  const localKeyCount = selected ? getLocalCategoryKeyCount(selected) : 0;

  function selectCategory(categoryId) {
    setSelectedId(categoryId);
    setConfirmText('');
    setMessage(null);
  }

  async function clearSelected() {
    if (!selected) return;
    if (confirmText.trim().toUpperCase() !== 'LIMPAR') {
      setMessage({ type: 'error', text: 'Digite LIMPAR no campo de confirmação para autorizar esta exclusão.' });
      return;
    }
    setClearing(true);
    setMessage(null);
    try {
      let result = { success: true, before: counts[selected.id] || 0, after: 0, snapshotPath: null };
      if (selected.databaseScope) {
        if (!isElectron()) throw new Error('Esta categoria exige o aplicativo Electron instalado.');
        result = await window.electronAPI.dataSelectiveClear(selected.id);
        if (!result.success) throw new Error(result.error || 'Não foi possível limpar os dados.');
      }
      const removedKeys = clearCategoryLocalStorage(selected.id);
      setCounts(previous => ({ ...previous, [selected.id]: result.after ?? 0 }));
      setConfirmText('');
      if (selected.databaseScope) setPendingRestart(true);
      setMessage({
        type: 'success',
        text: `${selected.label} limpo com segurança. ${result.before || 0} registro(s) SQLite e ${removedKeys} chave(s) local(is) foram processados${result.snapshotPath ? `; snapshot criado em ${result.snapshotPath}` : ''}. Reinicie o aplicativo para atualizar todas as telas.`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Não foi possível concluir a limpeza seletiva.' });
    } finally {
      setClearing(false);
    }
  }

  return (
    <section style={{ marginTop: 18, background: 'var(--bg-card)', border: '1px solid rgba(251,113,133,.32)', borderRadius: 10, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 15 }}>
        <Trash2 size={17} style={{ color: 'var(--accent-red)', marginTop: 2, flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: 'Michroma,sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '.05em' }}>LIMPEZA SELETIVA</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.6, marginTop: 5 }}>Apague somente os dados de uma função específica. O catálogo-base, tokens UEX e preferências não são apagados por esta ferramenta.</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 9 }}>
        {SELECTIVE_CLEANUP_CATEGORIES.map(category => {
          const active = category.id === selectedId;
          const databaseCount = counts[category.id] || 0;
          const localCount = getLocalCategoryKeyCount(category);
          return (
            <button key={category.id} type="button" onClick={() => selectCategory(category.id)} aria-pressed={active} style={{ textAlign: 'left', padding: 12, background: active ? 'rgba(251,113,133,.1)' : 'var(--bg-panel)', border: `1px solid ${active ? 'rgba(251,113,133,.55)' : 'var(--border-subtle)'}`, borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{category.label}</div>
              <div style={{ display: 'flex', gap: 9, marginTop: 7, color: 'var(--text-muted)', fontSize: 10, fontFamily: 'Share Tech Mono,monospace' }}><span>SQLite: {loadingCounts ? '…' : databaseCount}</span><span>Local: {localCount}</span></div>
            </button>
          );
        })}
      </div>
      {selected && (
        <div style={{ marginTop: 14, padding: 14, background: 'rgba(251,113,133,.06)', border: '1px solid rgba(251,113,133,.24)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-red)', fontWeight: 800, fontSize: 12 }}><LockKeyhole size={14} /> {selected.label}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.6, marginTop: 7 }}>{selected.description}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 8 }}>Antes da exclusão será criado um snapshot do banco SQLite em <code>backup/limpeza-seletiva</code>. Registros do SQLite: <strong>{counts[selected.id] || 0}</strong>. Chaves locais: <strong>{localKeyCount}</strong>.</div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
            <input value={confirmText} onChange={event => setConfirmText(event.target.value)} placeholder="Digite LIMPAR" aria-label="Digite LIMPAR para confirmar" style={{ minWidth: 180, minHeight: 38, padding: '8px 10px', background: 'var(--bg-base)', border: '1px solid rgba(251,113,133,.35)', borderRadius: 6, color: 'var(--text-primary)' }} />
            <ActionButton icon={Trash2} tone="gold" onClick={clearSelected} disabled={clearing || confirmText.trim().toUpperCase() !== 'LIMPAR'}>{clearing ? 'Limpando...' : `Limpar ${selected.label}`}</ActionButton>
          </div>
        </div>
      )}
    </section>
  );
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

function PathRow({ label, value, onCopy }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</span>
      <code style={{ minWidth: 0, color: 'var(--text-primary)', fontSize: 11, overflowWrap: 'anywhere' }}>{value || '—'}</code>
      {value ? (
        <button onClick={() => onCopy(value)} title={`Copiar ${label}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 8px', border: '1px solid var(--border-subtle)', borderRadius: 5, background: 'var(--bg-panel)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}>
          <Copy size={12} /> Copiar
        </button>
      ) : <span />}
    </div>
  );
}

function ActionButton({ children, onClick, disabled = false, tone = 'blue', icon: Icon }) {
  const tones = {
    blue: { background: 'rgba(56,189,248,.1)', border: 'rgba(56,189,248,.35)', color: 'var(--accent-primary)' },
    green: { background: 'rgba(52,211,153,.1)', border: 'rgba(52,211,153,.35)', color: 'var(--accent-green)' },
    gold: { background: 'rgba(251,191,36,.1)', border: 'rgba(251,191,36,.35)', color: 'var(--accent-gold)' },
    purple: { background: 'rgba(162,155,254,.1)', border: 'rgba(162,155,254,.35)', color: '#a29bfe' },
  };
  const current = tones[tone] || tones.blue;
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 38, padding: '9px 13px', background: disabled ? 'rgba(255,255,255,.03)' : current.background, border: `1px solid ${disabled ? 'var(--border-subtle)' : current.border}`, borderRadius: 7, color: disabled ? 'var(--text-muted)' : current.color, fontFamily: '"Exo 2", sans-serif', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .65 : 1 }}>
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

function MobileServerPanel({ setMessage }) {
  const [status, setStatus] = useState({ running: false, port: 47821, urls: [], addresses: [] });
  const [port, setPort] = useState('47821');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  async function refresh() {
    if (!window.electronAPI?.mobileServerStatus) return;
    try {
      const result = await window.electronAPI.mobileServerStatus();
      if (result?.success) {
        setStatus(result);
        if (result.port) setPort(String(result.port));
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Não foi possível consultar o servidor mobile.' });
    }
  }

  useEffect(() => { refresh(); }, []);

  const primaryUrl = status.urls?.[0] || '';
  useEffect(() => {
    let active = true;
    if (!status.running || !primaryUrl) {
      setQrDataUrl('');
      return () => { active = false; };
    }
    QRCode.toDataURL(primaryUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 230,
      color: { dark: '#07101d', light: '#f4fbff' },
    }).then(dataUrl => {
      if (active) setQrDataUrl(dataUrl);
    }).catch(() => {
      if (active) setQrDataUrl('');
    });
    return () => { active = false; };
  }, [status.running, primaryUrl]);

  async function toggle() {
    setBusy(true); setMessage(null);
    try {
      const result = status.running
        ? await window.electronAPI.mobileServerStop()
        : await window.electronAPI.mobileServerStart(Math.max(1024, Math.min(65535, Number(port) || 47821)));
      if (!result?.success) throw new Error(result?.error || 'Não foi possível alterar o servidor mobile.');
      setStatus(result);
      setMessage({ type: 'success', text: result.running ? 'Servidor mobile ligado somente na rede local.' : 'Servidor mobile desligado. Os celulares não podem mais acessar o projeto.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Não foi possível alterar o servidor mobile.' });
    } finally { setBusy(false); }
  }

  async function rotateToken() {
    setBusy(true); setMessage(null);
    try {
      const result = await window.electronAPI.mobileServerRotateToken();
      if (!result?.success) throw new Error(result?.error || 'Não foi possível renovar o token.');
      setStatus(result);
      setMessage({ type: 'success', text: 'Token renovado. Links antigos foram invalidados e um novo QR Code foi gerado.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Não foi possível renovar o token.' });
    } finally { setBusy(false); }
  }

  async function copy(value, label) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setMessage({ type: 'error', text: 'Não foi possível copiar o endereço.' });
    }
  }

  const runningColor = status.running ? 'var(--accent-green)' : 'var(--text-muted)';
  return (
    <section style={{ marginTop: 18, background: 'linear-gradient(135deg, rgba(56,189,248,.12), rgba(12,24,40,.96) 58%, rgba(162,155,254,.08))', border: '1px solid rgba(56,189,248,.4)', borderRadius: 16, padding: 22, boxShadow: '0 14px 40px rgba(0,0,0,.18)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 17 }}>
        <div style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 12, background: 'rgba(56,189,248,.14)', border: '1px solid rgba(56,189,248,.35)', flexShrink: 0 }}><Smartphone size={21} style={{ color: 'var(--accent-primary)' }} /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'Michroma,sans-serif', fontSize: 14, fontWeight: 700, letterSpacing: '.05em' }}>SERVIDOR MOBILE <span style={{ color: 'var(--accent-primary)', fontSize: 11 }}>V3.0.0</span></div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.65, marginTop: 6 }}>Transforme o computador em um servidor pessoal e acesse o Companheiro Emoto pelo navegador do celular na mesma rede Wi-Fi.</div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 999, background: status.running ? 'rgba(52,211,153,.12)' : 'rgba(148,163,184,.08)', border: `1px solid ${status.running ? 'rgba(52,211,153,.36)' : 'var(--border-subtle)'}`, color: runningColor, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: runningColor, boxShadow: status.running ? `0 0 12px ${runningColor}` : 'none' }} />{status.running ? 'ONLINE' : 'OFFLINE'}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(250px, .82fr)', gap: 18, alignItems: 'stretch' }}>
        <div style={{ display: 'grid', gap: 13 }}>
          <div style={{ padding: '12px 14px', background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.6 }}><Shield size={14} style={{ color: 'var(--accent-gold)', verticalAlign: 'middle', marginRight: 7 }} /><strong>Rede confiável:</strong> qualquer pessoa que possua a URL completa e o token poderá consultar os módulos liberados.</div>
          <div style={{ padding: 15, background: 'rgba(5,12,22,.38)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>1. Ative o servidor</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>Porta <input value={port} disabled={status.running || busy} onChange={event => setPort(event.target.value.replace(/[^0-9]/g, '').slice(0, 5))} inputMode="numeric" style={{ width: 88, marginLeft: 6, minHeight: 38, padding: '7px 9px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 7, color: 'var(--text-primary)' }} /></label>
              <ActionButton icon={Power} tone={status.running ? 'gold' : 'green'} onClick={toggle} disabled={busy || !isElectron()}>{busy ? 'Aguarde...' : status.running ? 'Desligar servidor' : 'Ligar servidor'}</ActionButton>
              {status.running && <ActionButton icon={RotateCw} tone="purple" onClick={rotateToken} disabled={busy}>Renovar acesso</ActionButton>}
            </div>
          </div>
          {status.running && <div style={{ padding: 15, background: 'rgba(5,12,22,.38)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>2. Abra no celular</div>
            <div style={{ display: 'grid', gap: 9 }}>
              {(status.urls || []).map((url, index) => <div key={url} style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}><Wifi size={14} style={{ color: 'var(--accent-green)', flexShrink: 0 }} /><code style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', color: 'var(--text-primary)', fontSize: 11 }}>{url}</code><button onClick={() => copy(url, `url-${index}`)} title="Copiar endereço completo" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 9px', border: '1px solid var(--border-subtle)', borderRadius: 7, background: 'var(--bg-panel)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}><Copy size={12} />{copied === `url-${index}` ? 'Copiado' : 'Copiar'}</button></div>)}
              <div style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.55 }}>Escaneie o QR Code ao lado ou copie a URL completa. O token já está incluído no endereço.</div>
            </div>
          </div>}
        </div>

        <div style={{ display: 'grid', placeItems: 'center', minHeight: 250, padding: 16, background: status.running ? 'linear-gradient(145deg, rgba(244,251,255,.97), rgba(217,239,249,.94))' : 'rgba(5,12,22,.38)', border: `1px solid ${status.running ? 'rgba(56,189,248,.6)' : 'var(--border-subtle)'}`, borderRadius: 14, color: status.running ? '#07101d' : 'var(--text-muted)' }}>
          {status.running && qrDataUrl ? <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}><img src={qrDataUrl} alt="QR Code com endereço completo e token do Servidor Mobile" style={{ width: 210, height: 210, display: 'block', borderRadius: 8 }} /><strong style={{ fontSize: 12, letterSpacing: '.05em' }}>ESCANEIE PARA CONECTAR</strong><span style={{ fontSize: 10, opacity: .72, textAlign: 'center' }}>O código contém o endereço e o token temporário.</span></div> : <div style={{ textAlign: 'center' }}><Smartphone size={32} style={{ opacity: .5, marginBottom: 8 }} /><div style={{ fontSize: 12, fontWeight: 800 }}>{status.running ? 'Gerando QR Code...' : 'QR Code ficará disponível quando o servidor estiver online'}</div></div>}
        </div>
      </div>

      {status.running && <div style={{ marginTop: 14, padding: '11px 13px', background: 'rgba(162,155,254,.08)', border: '1px solid rgba(162,155,254,.25)', borderRadius: 10 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 11 }}><ShieldCheck size={14} style={{ color: '#a29bfe', flexShrink: 0 }} /><span><strong>Token temporário ativo.</strong> Renovar o acesso invalida imediatamente todas as URLs e QR Codes anteriores.</span></div></div>}
      {!isElectron() && <div style={{ color: 'var(--accent-gold)', fontSize: 11, marginTop: 12 }}>O servidor mobile só pode ser ligado na versão Electron instalada.</div>}
    </section>
  );
}

export default function DataDirectoryPage() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const [pendingRestart, setPendingRestart] = useState(false);
  const [copied, setCopied] = useState(false);

  const localStorageCount = useMemo(() => localStorage.length, [message]);

  async function refreshInfo() {
    if (!isElectron()) {
      setInfo({ success: false, dataRoot: null, databasePath: null, backupPath: null, exportPath: null });
      setLoading(false);
      return;
    }
    try {
      const result = await window.electronAPI.dataGetInfo();
      setInfo(result);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Não foi possível ler o diretório de dados.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshInfo(); }, []);

  async function copyPath(value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage({ type: 'error', text: 'Não foi possível copiar o caminho.' });
    }
  }

  async function chooseDirectory() {
    setBusy('choose');
    setMessage(null);
    try {
      const result = await window.electronAPI.dataChooseDirectory();
      if (result.canceled) return;
      if (!result.success) throw new Error(result.error || 'Não foi possível trocar o diretório.');
      setPendingRestart(true);
      setInfo(previous => ({ ...previous, dataRoot: result.dataRoot, migration: result.migration }));
      setMessage({ type: 'success', text: 'Novo diretório preparado. Reinicie o aplicativo para começar a usá-lo.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Não foi possível trocar o diretório.' });
    } finally {
      setBusy('');
    }
  }

  async function restartApp() {
    setBusy('restart');
    try {
      await window.electronAPI.dataRestartApp();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Feche e abra o aplicativo novamente.' });
      setBusy('');
    }
  }

  async function openFolder() {
    setBusy('open');
    try {
      const result = await window.electronAPI.dataOpenFolder();
      if (!result.success) throw new Error(result.error || 'Não foi possível abrir a pasta.');
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Não foi possível abrir a pasta.' });
    } finally {
      setBusy('');
    }
  }

  async function exportFullBackup() {
    setBusy('export');
    setMessage(null);
    try {
      if (isElectron()) {
        const result = await window.electronAPI.dataExportFull({
          localStorage: collectLocalStorage(),
          filename: `companheiro-emoto-backup-${new Date().toISOString().slice(0, 10)}.json`,
        });
        if (!result.success) throw new Error(result.error || 'Falha ao exportar o backup.');
        setMessage({ type: 'success', text: `Backup completo salvo em ${result.filePath}. Foram exportadas ${result.exportedKeys} chaves do localStorage e uma cópia do banco SQLite.` });
      } else {
        const blob = new Blob([JSON.stringify({ app: 'CompanheiroEmoto', format: 'full-data-export', version: 1, exported_at: new Date().toISOString(), localStorage: collectLocalStorage() }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `companheiro-emoto-backup-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'Backup do localStorage baixado pelo navegador.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Não foi possível exportar o backup.' });
    } finally {
      setBusy('');
    }
  }

  async function importFullBackup() {
    setBusy('import');
    setMessage(null);
    try {
      if (!isElectron()) throw new Error('A importação completa está disponível no aplicativo Electron instalado.');
      const result = await window.electronAPI.dataImportFull();
      if (result.canceled) return;
      if (!result.success) throw new Error(result.error || 'Falha ao importar o backup.');
      const imported = result.backup.localStorage || {};
      Object.entries(imported).forEach(([key, value]) => {
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      });
      if (result.pendingRestart) setPendingRestart(true);
      setMessage({ type: 'success', text: result.databaseRestored
        ? `Backup importado com ${Object.keys(imported).length} chaves e banco SQLite restaurado. Reinicie o aplicativo para aplicar tudo.`
        : `Backup importado com ${Object.keys(imported).length} chaves. Recarregue o aplicativo para atualizar as telas.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Não foi possível importar o backup.' });
    } finally {
      setBusy('');
    }
  }

  const migration = info?.migration || {};

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><FolderCog size={20} style={{ color: 'var(--accent-primary)' }} /> DIRETÓRIO DE DADOS</div>
          <div className="page-subtitle">Todos os dados do Companheiro Emoto em uma pasta fácil de localizar e copiar</div>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 15px', background: 'rgba(56,189,248,.05)', border: '1px solid rgba(56,189,248,.18)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6, marginBottom: 18 }}>
          <Info size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2 }} />
          <div><strong>Como funciona:</strong> a execução de desenvolvimento usa uma pasta separada chamada <strong>CompanheiroEmoto-Dev</strong>. A versão instalada usa <strong>CompanheiroEmoto</strong>. O SQLite fica em <code>dados</code>, os backups em <code>backup</code> e o localStorage do Electron permanece dentro da pasta do ambiente correspondente.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(300px, .65fr)', gap: 18, alignItems: 'start' }}>
          <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border-normal)', borderRadius: 10, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><HardDrive size={16} style={{ color: 'var(--accent-primary)' }} /><span style={{ fontFamily: 'Michroma,sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '.05em' }}>LOCALIZAÇÃO ATIVA</span></div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 12 }}>Este é o diretório que deve ser copiado para backup manual ou manutenção.</div>
            {loading ? <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '18px 0' }}>Lendo configuração...</div> : (
              <div>
                <PathRow label="Ambiente" value={info?.environment === 'development' ? 'Desenvolvimento — CompanheiroEmoto-Dev' : 'Produção — CompanheiroEmoto'} onCopy={copyPath} />
                <PathRow label="Pasta principal" value={info?.dataRoot} onCopy={copyPath} />
                <PathRow label="Banco SQLite" value={info?.databasePath} onCopy={copyPath} />
                <PathRow label="Backups" value={info?.backupPath} onCopy={copyPath} />
                <PathRow label="Exportações" value={info?.exportPath} onCopy={copyPath} />
                <PathRow label="Configuração ponte" value={info?.pointerConfigPath} onCopy={copyPath} />
              </div>
            )}
            {copied && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-green)', fontSize: 11, marginTop: 10 }}><CheckCircle2 size={13} /> Caminho copiado.</div>}
            {migration.warnings?.length > 0 && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 12, padding: '9px 10px', background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 6, color: 'var(--accent-gold)', fontSize: 11, lineHeight: 1.5 }}><AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /><span>{migration.warnings.join(' ')}</span></div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
              <ActionButton icon={ExternalLink} onClick={openFolder} disabled={!isElectron() || busy === 'open'}>Abrir pasta</ActionButton>
              <ActionButton icon={FolderCog} tone="gold" onClick={chooseDirectory} disabled={!isElectron() || busy === 'choose'}>{busy === 'choose' ? 'Abrindo...' : 'Trocar diretório'}</ActionButton>
              {pendingRestart && <ActionButton icon={RefreshCw} tone="green" onClick={restartApp} disabled={busy === 'restart'}>{busy === 'restart' ? 'Reiniciando...' : 'Reiniciar agora'}</ActionButton>}
            </div>
          </section>

          <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border-normal)', borderRadius: 10, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><Database size={16} style={{ color: 'var(--accent-green)' }} /><span style={{ fontFamily: 'Michroma,sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '.05em' }}>BACKUP COMPLETO</span></div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.6, marginBottom: 14 }}>Exporta todas as chaves do localStorage e uma cópia do banco SQLite. O arquivo JSON e o banco ficam em <code>CompanheiroEmoto/backup</code>.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ActionButton icon={Download} tone="green" onClick={exportFullBackup} disabled={busy === 'export'}>{busy === 'export' ? 'Exportando...' : 'Exportar todos os dados'}</ActionButton>
              <ActionButton icon={Upload} tone="purple" onClick={importFullBackup} disabled={busy === 'import'}>{busy === 'import' ? 'Importando...' : 'Importar backup completo'}</ActionButton>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 14, padding: '9px 10px', background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.18)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.5 }}><ShieldCheck size={14} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} /> O backup pode conter tokens e configurações da UEX. Guarde-o em local seguro.</div>
          </section>
        </div>

        <MobileServerPanel setMessage={setMessage} />
        <SelectiveCleanupPanel setMessage={setMessage} setPendingRestart={setPendingRestart} />
        {message && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 18, padding: '11px 13px', background: message.type === 'error' ? 'rgba(251,113,133,.08)' : 'rgba(52,211,153,.08)', border: `1px solid ${message.type === 'error' ? 'rgba(251,113,133,.25)' : 'rgba(52,211,153,.25)'}`, borderRadius: 7, color: message.type === 'error' ? 'var(--accent-red)' : 'var(--accent-green)', fontSize: 12, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{message.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}{message.text}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 18 }}>
          <div style={{ padding: 13, background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 7 }}><div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Chaves localStorage nesta sessão</div><div style={{ color: 'var(--text-primary)', fontFamily: 'Share Tech Mono,monospace', fontSize: 20, marginTop: 5 }}>{localStorageCount}</div></div>
          <div style={{ padding: 13, background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 7 }}><div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Arquivos migrados</div><div style={{ color: 'var(--accent-green)', fontFamily: 'Share Tech Mono,monospace', fontSize: 20, marginTop: 5 }}>{migration.copied?.length || 0}</div></div>
          <div style={{ padding: 13, background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 7 }}><div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Última migração registrada</div><div style={{ color: 'var(--text-primary)', fontSize: 12, marginTop: 8 }}>{formatDate(info?.migration?.at)}</div></div>
        </div>

        {!isElectron() && <div style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 11 }}>Esta prévia está rodando no navegador. A seleção de pasta, o SQLite e a abertura do diretório funcionam na versão Electron instalada.</div>}
      </div>
    </>
  );
}

