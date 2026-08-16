import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Edit3, Filter, Globe2, MapPin,
  Plus, RefreshCw, Save, Search, Trash2, X, ToggleLeft, ToggleRight,
} from 'lucide-react';
import {
  DEFAULT_SYSTEMS,
  LOCATION_TYPES,
  createManagedLocation,
  getManagedLocationStats,
  loadManagedLocations,
  removeManagedLocation,
  saveManagedLocations,
  upsertManagedLocation,
} from '../data/locations';

const EMPTY_FORM = {
  id: null,
  name: '',
  system: 'Stanton',
  type: 'Outros',
  notes: '',
  active: true,
};

const TYPE_COLORS = {
  'Sistema': '#a78bfa',
  'Planeta': '#38bdf8',
  'Lua': '#60a5fa',
  'Cidade': '#34d399',
  'Estação Espacial': '#fbbf24',
  'Estação L (Lagrange)': '#f59e0b',
  'Posto Avançado': '#fb923c',
  'Instalação / Complexo': '#fb7185',
  'Área de Mineração': '#c084fc',
  'Centro de Distribuição': '#f472b6',
  'Hangar': '#94a3b8',
  'Terminal': '#22d3ee',
  'Gateway / Jump Point': '#818cf8',
  'Ponto de Comunicação': '#2dd4bf',
  'Refinaria': '#84cc16',
  'Scrapyard': '#a8a29e',
  'OLP': '#e879f9',
  'Outros': '#64748b',
};

function formatDate(value) {
  if (!value) return 'base inicial';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function emptyFormFrom(location) {
  return location ? { ...location } : { ...EMPTY_FORM };
}

function LocationForm({ value, onChange, onSave, onCancel, error }) {
  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px',
    background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
    borderRadius: 6, color: 'var(--text-primary)', fontFamily: '"Exo 2",sans-serif',
    fontSize: 13, outline: 'none',
  };
  const selectStyle = { ...inputStyle, appearance: 'none', WebkitAppearance: 'none', paddingRight: 28 };
  const labelStyle = { display: 'block', marginBottom: 5, color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' };
  const set = (key, next) => onChange({ ...value, [key]: next });

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 9, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)', fontFamily: 'Michroma,sans-serif', fontSize: 13, fontWeight: 700 }}>
            {value.id ? <Edit3 size={15} /> : <Plus size={15} />}
            {value.id ? 'EDITAR LOCAL' : 'ADICIONAR LOCAL'}
          </div>
          <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 11 }}>
            O local ficará disponível nos seletores do Inventário, Baú de Minério e Mineração.
          </div>
        </div>
        <button type="button" onClick={onCancel} title="Cancelar edição" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 5, color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
      </div>

      {error && <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', marginBottom: 12, background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.3)', borderRadius: 6, color: 'var(--accent-red)', fontSize: 11 }}><AlertTriangle size={13} />{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.25fr', gap: 10, marginBottom: 11 }}>
        <div><label style={labelStyle}>Nome do local *</label><input autoFocus value={value.name} onChange={e => set('name', e.target.value)} placeholder="Ex.: Nova estação orbital" style={inputStyle} /></div>
        <div><label style={labelStyle}>Sistema *</label><input list="location-systems" value={value.system} onChange={e => set('system', e.target.value)} placeholder="Ex.: Stanton" style={inputStyle} /><datalist id="location-systems">{DEFAULT_SYSTEMS.map(system => <option key={system} value={system} />)}</datalist></div>
        <div><label style={labelStyle}>Tipo de local *</label><select value={value.type} onChange={e => set('type', e.target.value)} style={selectStyle}>{LOCATION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></div>
      </div>
      <div style={{ marginBottom: 12 }}><label style={labelStyle}>Observações</label><textarea value={value.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Correções, localização no sistema, serviços ou observações pessoais..." style={{ ...inputStyle, minHeight: 66, resize: 'vertical', lineHeight: 1.5 }} /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', marginBottom: 14 }}><input type="checkbox" checked={value.active !== false} onChange={e => set('active', e.target.checked)} />Disponível nos seletores do aplicativo</label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
        <button type="button" onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 5, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}><X size={12} /> Cancelar</button>
        <button type="button" onClick={onSave} disabled={!value.name.trim() || !String(value.system || '').trim()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 5, color: 'var(--accent-green)', cursor: value.name.trim() && String(value.system || '').trim() ? 'pointer' : 'not-allowed', fontSize: 11, fontWeight: 700, opacity: value.name.trim() && String(value.system || '').trim() ? 1 : 0.5 }}><Save size={12} /> Salvar local</button>
      </div>
    </div>
  );
}

function LocationRow({ location, selected, onEdit, onToggle, onDelete }) {
  const color = TYPE_COLORS[location.type] || TYPE_COLORS.Outros;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) minmax(100px, 0.9fr) minmax(150px, 1.25fr) 90px 104px', alignItems: 'center', gap: 10, padding: '10px 11px', marginBottom: 5, border: `1px solid ${selected ? `${color}66` : 'var(--border-subtle)'}`, borderRadius: 7, background: selected ? `${color}0d` : 'rgba(255,255,255,0.015)', opacity: location.active === false ? 0.56 : 1 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}><MapPin size={12} style={{ color, flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location.name}</span></div>
        {location.notes && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3, color: 'var(--text-muted)', fontSize: 10 }}>{location.notes}</div>}
      </div>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--accent-primary)', fontFamily: 'Share Tech Mono,monospace', fontSize: 11 }}>{location.system}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color, fontSize: 10, fontWeight: 700 }}>{location.type}</span>
      <span style={{ color: location.active === false ? 'var(--accent-red)' : 'var(--accent-green)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{location.active === false ? 'Inativo' : 'Ativo'}</span>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
        <button type="button" onClick={() => onToggle(location)} title={location.active === false ? 'Ativar local' : 'Desativar local'} style={{ width: 27, height: 27, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 4, color: location.active === false ? 'var(--accent-green)' : 'var(--text-muted)', cursor: 'pointer' }}>{location.active === false ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}</button>
        <button type="button" onClick={() => onEdit(location)} title="Editar local" style={{ width: 27, height: 27, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.22)', borderRadius: 4, color: 'var(--accent-primary)', cursor: 'pointer' }}><Edit3 size={12} /></button>
        <button type="button" onClick={() => onDelete(location)} title="Excluir local" style={{ width: 27, height: 27, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(251,113,133,0.07)', border: '1px solid rgba(251,113,133,0.2)', borderRadius: 4, color: 'var(--accent-red)', cursor: 'pointer' }}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

export default function LocationsAdminPage({ embedded = false } = {}) {
  const [locations, setLocations] = useState(() => loadManagedLocations());
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [systemFilter, setSystemFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [savedMessage, setSavedMessage] = useState('');

  const systems = useMemo(() => [...new Set(locations.map(location => location.system).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [locations]);
  const stats = useMemo(() => getManagedLocationStats(locations), [locations]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...locations]
      .filter(location => statusFilter === 'all' || (statusFilter === 'active' ? location.active !== false : location.active === false))
      .filter(location => systemFilter === 'all' || location.system === systemFilter)
      .filter(location => typeFilter === 'all' || location.type === typeFilter)
      .filter(location => !query || `${location.name} ${location.system} ${location.type} ${location.notes}`.toLowerCase().includes(query))
      .sort((a, b) => a.system.localeCompare(b.system) || a.name.localeCompare(b.name));
  }, [locations, search, systemFilter, typeFilter, statusFilter]);

  function beginCreate() {
    setEditing({ ...EMPTY_FORM });
    setFormError('');
    setDeleteConfirm(null);
  }

  function beginEdit(location) {
    setEditing(emptyFormFrom(location));
    setFormError('');
    setDeleteConfirm(null);
  }

  function handleSave() {
    try {
      const item = createManagedLocation(editing);
      if (!item.name) throw new Error('Nome do local é obrigatório.');
      const next = upsertManagedLocation(item);
      setLocations(loadManagedLocations());
      setEditing(null);
      setFormError('');
      setSavedMessage(`${next.name} salvo com sucesso.`);
      window.setTimeout(() => setSavedMessage(''), 2200);
    } catch (error) {
      setFormError(error.message || 'Não foi possível salvar o local.');
    }
  }

  function handleToggle(location) {
    const next = locations.map(item => item.id === location.id ? { ...item, active: item.active === false, updatedAt: new Date().toISOString() } : item);
    setLocations(saveManagedLocations(next));
  }

  function handleDelete(location) {
    if (deleteConfirm !== location.id) {
      setDeleteConfirm(location.id);
      return;
    }
    const next = removeManagedLocation(location.id);
    setLocations(next);
    setDeleteConfirm(null);
    if (editing?.id === location.id) setEditing(null);
  }

  function cancelForm() {
    setEditing(null);
    setFormError('');
  }

  const inputStyle = { flex: 1, minWidth: 150, padding: '8px 10px 8px 29px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 5, color: 'var(--text-primary)', fontFamily: '"Exo 2",sans-serif', fontSize: 12, outline: 'none' };
  const selectStyle = { padding: '8px 25px 8px 9px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 5, color: 'var(--text-secondary)', fontFamily: '"Exo 2",sans-serif', fontSize: 11, outline: 'none' };

  return (
    <div className={embedded ? 'system-admin-child system-admin-child-locations' : ''} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {!embedded && <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Globe2 size={18} /> ADICIONAR LOCAL</div>
          <div className="page-subtitle">Administre sistemas, planetas, estações, cidades, hangares e demais locais usados pelo aplicativo</div>
        </div>
        <button type="button" onClick={beginCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 6, color: 'var(--accent-green)', cursor: 'pointer', fontFamily: '"Exo 2",sans-serif', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}><Plus size={13} /> Adicionar local</button>
      </div>}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: embedded ? '0 8px 20px' : '0 32px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(110px, 1fr))', gap: 9, marginBottom: 14 }}>
          {[['Locais cadastrados', stats.total, 'var(--accent-primary)'], ['Ativos', stats.active, 'var(--accent-green)'], ['Inativos', stats.inactive, 'var(--accent-red)'], ['Sistemas', stats.systems, 'var(--accent-purple)'], ['Tipos', stats.types, 'var(--accent-gold)']].map(([label, value, color]) => <div key={label} style={{ padding: '11px 12px', background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 7 }}><div style={{ color: 'var(--text-muted)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div><div style={{ marginTop: 4, color, fontFamily: 'Share Tech Mono,monospace', fontSize: 21, fontWeight: 700 }}>{value}</div></div>)}
        </div>

        {savedMessage && <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 11px', marginBottom: 12, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 6, color: 'var(--accent-green)', fontSize: 11 }}><CheckCircle2 size={13} />{savedMessage}</div>}
        {editing && <LocationForm value={editing} onChange={setEditing} onSave={handleSave} onCancel={cancelForm} error={formError} />}

        <section style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 9, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', padding: 11, borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 190 }}><Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, sistema ou tipo..." style={inputStyle} /></div>
            <select value={systemFilter} onChange={e => setSystemFilter(e.target.value)} style={selectStyle}><option value="all">Todos os sistemas</option>{systems.map(system => <option key={system} value={system}>{system}</option>)}</select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}><option value="all">Todos os tipos</option>{LOCATION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}><option value="active">Ativos</option><option value="all">Todos</option><option value="inactive">Inativos</option></select>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 10 }}><Filter size={11} /> {filtered.length} resultado{filtered.length === 1 ? '' : 's'}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) minmax(100px, 0.9fr) minmax(150px, 1.25fr) 90px 104px', gap: 10, padding: '8px 11px', color: 'var(--text-muted)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}><span>Local</span><span>Sistema</span><span>Tipo</span><span>Status</span><span style={{ textAlign: 'right' }}>Ações</span></div>
          <div style={{ padding: '0 8px 8px', maxHeight: 'calc(100vh - 360px)', minHeight: 260, overflowY: 'auto' }}>
            {filtered.length === 0 ? <div style={{ padding: '38px 14px', color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.6, textAlign: 'center' }}>Nenhum local encontrado com os filtros atuais.<br />Use <strong style={{ color: 'var(--accent-primary)' }}>Adicionar local</strong> para cadastrar um novo ponto.</div> : filtered.map(location => <React.Fragment key={location.id}><LocationRow location={location} selected={editing?.id === location.id} onEdit={beginEdit} onToggle={handleToggle} onDelete={handleDelete} />{deleteConfirm === location.id && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '7px 10px', margin: '-2px 0 6px', background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.25)', borderRadius: 5, color: 'var(--accent-red)', fontSize: 10 }}><span>Excluir <strong>{location.name}</strong>? Registros já salvos continuarão com o nome, mas o local sairá dos seletores.</span><div style={{ display: 'flex', gap: 5 }}><button type="button" onClick={() => setDeleteConfirm(null)} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 10 }}>Cancelar</button><button type="button" onClick={() => handleDelete(location)} style={{ padding: '4px 8px', background: 'rgba(251,113,133,0.14)', border: '1px solid rgba(251,113,133,0.35)', borderRadius: 4, color: 'var(--accent-red)', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Excluir definitivamente</button></div></div>}</React.Fragment>)}
          </div>
        </section>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.5 }}><RefreshCw size={11} />A lista inicial contém os locais enviados por você. Alterações são salvas localmente e os locais inativos deixam de aparecer nos seletores sem apagar os registros históricos.</div>
      </div>
    </div>
  );
}
