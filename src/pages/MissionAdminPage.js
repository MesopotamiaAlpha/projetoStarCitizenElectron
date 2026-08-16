import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Edit3, Filter, ListChecks, Plus, Save, Search,
  ToggleLeft, ToggleRight, Trash2, X,
} from 'lucide-react';
import {
  MISSION_ADMIN_LABELS,
  MISSION_ADMIN_UPDATED_EVENT,
  getMissionAdminStats,
  loadMissionAdmin,
  removeMissionAdminOption,
  toggleMissionAdminOption,
  upsertMissionAdminOption,
} from '../data/missionAdmin';

const EMPTY_FORM = { id: null, name: '', notes: '', active: true, _originalKind: 'factions' };
const KIND_COLORS = { factions: '#fb923c', types: '#38bdf8', systems: '#a78bfa' };

function formatKind(kind) {
  return MISSION_ADMIN_LABELS[kind] || kind;
}

function MissionOptionForm({ kind, value, onChange, onSave, onCancel, error, onCategoryChange }) {
  const color = KIND_COLORS[kind] || 'var(--accent-primary)';
  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: '"Exo 2",sans-serif', fontSize: 13, outline: 'none' };
  const labelStyle = { display: 'block', marginBottom: 5, color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' };
  const set = (key, next) => onChange({ ...value, [key]: next });
  const canSave = value.name.trim();

  return (
    <div className="mission-catalog-form" style={{ '--mission-catalog-color': color }}>
      <div className="mission-catalog-form-header">
        <div>
          <div className="mission-catalog-form-title">{value.id ? <Edit3 size={15} /> : <Plus size={15} />} {value.id ? 'EDITAR OPÇÃO' : 'ADICIONAR OPÇÃO'}</div>
          <div className="mission-catalog-form-subtitle">{formatKind(kind)} · valores usados nos campos da missão</div>
        </div>
        <button type="button" onClick={onCancel} title="Cancelar edição" className="mission-catalog-icon-button"><X size={14} /></button>
      </div>
      {error && <div className="mission-catalog-error"><AlertTriangle size={13} /> {error}</div>}
      <div className="mission-catalog-form-grid">
        <div><label style={labelStyle}>Categoria *</label><select value={value._originalKind || kind} onChange={event => onCategoryChange(event.target.value)} style={inputStyle}>{Object.keys(MISSION_ADMIN_LABELS).map(key => <option key={key} value={key}>{formatKind(key)}</option>)}</select></div>
        <div><label style={labelStyle}>Nome *</label><input autoFocus value={value.name} onChange={event => set('name', event.target.value)} placeholder={kind === 'factions' ? 'Ex.: The Division of Peace' : kind === 'types' ? 'Ex.: Resgate' : 'Ex.: Stanton'} style={inputStyle} /></div>
        <div><label style={labelStyle}>Observações</label><input value={value.notes || ''} onChange={event => set('notes', event.target.value)} placeholder="Descrição opcional" style={inputStyle} /></div>
      </div>
      <label className="mission-catalog-active-toggle"><input type="checkbox" checked={value.active !== false} onChange={event => set('active', event.target.checked)} /> Disponível nos seletores do Rastreador de Missões</label>
      <div className="mission-catalog-form-actions">
        <button type="button" onClick={onCancel} className="mission-catalog-secondary-button"><X size={12} /> Cancelar</button>
        <button type="button" onClick={onSave} disabled={!canSave} className="mission-catalog-primary-button"><Save size={12} /> Salvar opção</button>
      </div>
    </div>
  );
}

function MissionOptionRow({ option, kind, selected, onEdit, onToggle, onDelete }) {
  const color = KIND_COLORS[kind] || 'var(--accent-primary)';
  return (
    <div className={`mission-catalog-row ${selected ? 'selected' : ''}`} style={{ '--mission-catalog-color': color, opacity: option.active === false ? 0.58 : 1 }}>
      <div className="mission-catalog-row-main">
        <div className="mission-catalog-row-title"><ListChecks size={13} /><strong>{option.name}</strong>{option.builtIn && <span className="mission-catalog-built-in">base</span>}</div>
        {option.notes && <small>{option.notes}</small>}
      </div>
      <span className={option.active === false ? 'mission-catalog-status inactive' : 'mission-catalog-status'}>{option.active === false ? 'Inativo' : 'Ativo'}</span>
      <div className="mission-catalog-row-actions">
        <button type="button" onClick={() => onToggle(option)} title={option.active === false ? 'Ativar opção' : 'Desativar opção'} className="mission-catalog-icon-button">{option.active === false ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}</button>
        <button type="button" onClick={() => onEdit(option)} title="Editar opção" className="mission-catalog-icon-button edit"><Edit3 size={13} /></button>
        <button type="button" onClick={() => onDelete(option)} title="Excluir opção" className="mission-catalog-icon-button delete"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function MissionAdminPage({ embedded = false } = {}) {
  const [catalog, setCatalog] = useState(() => loadMissionAdmin());
  const [kind, setKind] = useState('factions');
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formError, setFormError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    const refresh = () => setCatalog(loadMissionAdmin());
    const refreshFromStorage = event => {
      if (!event.key || event.key === 'sc_mission_admin_v1' || event.key === 'sc_mission_catalog_v1') refresh();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener(MISSION_ADMIN_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refreshFromStorage);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener(MISSION_ADMIN_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refreshFromStorage);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const stats = useMemo(() => getMissionAdminStats(catalog), [catalog]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (catalog[kind] || []).filter(option => statusFilter === 'all' || (statusFilter === 'active' ? option.active !== false : option.active === false)).filter(option => !query || `${option.name} ${option.notes || ''}`.toLocaleLowerCase().includes(query)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [catalog, kind, search, statusFilter]);

  function beginCreate() {
    setEditing({ ...EMPTY_FORM, _originalKind: kind });
    setFormError('');
    setDeleteConfirm(null);
  }

  function beginEdit(option) {
    setEditing({ ...option, _originalKind: kind });
    setFormError('');
    setDeleteConfirm(null);
  }

  function handleSave() {
    try {
      const next = upsertMissionAdminOption(kind, editing);
      setCatalog(next);
      setEditing(null);
      setFormError('');
      setSavedMessage(`${editing.name} salvo em ${formatKind(kind)}.`);
      window.setTimeout(() => setSavedMessage(''), 2200);
    } catch (error) {
      setFormError(error.message || 'Não foi possível salvar a opção.');
    }
  }

  function handleToggle(option) {
    setCatalog(toggleMissionAdminOption(kind, option.id));
  }

  function handleDelete(option) {
    if (deleteConfirm !== option.id) {
      setDeleteConfirm(option.id);
      return;
    }
    setCatalog(removeMissionAdminOption(kind, option.id));
    setDeleteConfirm(null);
    if (editing?.id === option.id) setEditing(null);
  }

  function cancelForm() {
    setEditing(null);
    setFormError('');
  }

  const kindStats = stats[kind] || { total: 0, active: 0, inactive: 0 };

  return (
    <div className={`mission-catalog-page${embedded ? ' mission-catalog-page-embedded' : ''}`}>
      {!embedded && <div className="page-header">
        <div>
          <div className="page-title mission-catalog-page-title"><ListChecks size={18} /> GERENCIADOR DE MISSÕES</div>
          <div className="page-subtitle">Administre as facções, tipos de missão e sistemas disponíveis no Rastreador de Missões</div>
        </div>
        <button type="button" onClick={beginCreate} className="mission-catalog-add-button"><Plus size={13} /> Adicionar opção</button>
      </div>}

      <div className="mission-catalog-scroll">
        {embedded && <div className="system-mission-inline-header"><div><strong>Gerenciador de Missões</strong><span>Facções, tipos e sistemas usados pelo Rastreador de Missões</span></div><button type="button" onClick={beginCreate} className="mission-catalog-add-button"><Plus size={13} /> Adicionar opção</button></div>}
        <div className="mission-catalog-stat-grid">
          {Object.keys(MISSION_ADMIN_LABELS).map(key => <button type="button" key={key} className={`mission-catalog-stat ${kind === key ? 'active' : ''}`} style={{ '--mission-catalog-color': KIND_COLORS[key] }} onClick={() => { setKind(key); setEditing(null); setDeleteConfirm(null); }}><span>{formatKind(key)}</span><strong>{stats[key].active}</strong><small>{stats[key].total} cadastradas · {stats[key].inactive} inativas</small></button>)}
        </div>

        {savedMessage && <div className="mission-catalog-success"><CheckCircle2 size={13} /> {savedMessage}</div>}
        {editing && <MissionOptionForm kind={kind} value={editing} onChange={setEditing} onCategoryChange={nextKind => { setKind(nextKind); setEditing(current => ({ ...current, _originalKind: nextKind })); setFormError(''); }} onSave={handleSave} onCancel={cancelForm} error={formError} />}

        <section className="mission-catalog-list-panel">
          <div className="mission-catalog-toolbar">
            <div className="mission-catalog-search"><Search size={12} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Buscar em ${formatKind(kind).toLocaleLowerCase()}...`} /></div>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="active">Ativos</option><option value="all">Todos</option><option value="inactive">Inativos</option></select>
            <span className="mission-catalog-result-count"><Filter size={11} /> {filtered.length} resultado{filtered.length === 1 ? '' : 's'}</span>
          </div>
          <div className="mission-catalog-list-header"><span>{formatKind(kind)}</span><span>Status</span><span>Ações</span></div>
          <div className="mission-catalog-list">
            {filtered.length === 0 ? <div className="mission-catalog-empty">Nenhuma opção encontrada. Use <strong>Adicionar opção</strong> para cadastrar uma nova entrada.</div> : filtered.map(option => <React.Fragment key={option.id}><MissionOptionRow option={option} kind={kind} selected={editing?.id === option.id} onEdit={beginEdit} onToggle={handleToggle} onDelete={handleDelete} />{deleteConfirm === option.id && <div className="mission-catalog-delete-confirm"><span>Excluir <strong>{option.name}</strong>? Missões antigas continuarão com o texto salvo, mas a opção sairá dos novos seletores.</span><div><button type="button" onClick={() => setDeleteConfirm(null)}>Cancelar</button><button type="button" onClick={() => handleDelete(option)}>Excluir definitivamente</button></div></div>}</React.Fragment>)}
          </div>
        </section>

        <div className="mission-catalog-help"><AlertTriangle size={12} /> Desativar uma opção é recomendado quando ela não deve aparecer em novas missões. O texto das missões antigas não será alterado nem apagado.</div>
        <div className="mission-catalog-current-stats">{formatKind(kind)}: <strong>{kindStats.active}</strong> ativas · <strong>{kindStats.inactive}</strong> inativas · <strong>{kindStats.total}</strong> total</div>
      </div>
    </div>
  );
}

export { MissionAdminPage };
export default MissionAdminPage;
