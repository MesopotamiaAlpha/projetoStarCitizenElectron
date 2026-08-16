import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Edit3, Filter, FolderTree, Plus, Save,
  Search, ToggleLeft, ToggleRight, Trash2, X,
} from 'lucide-react';
import {
  INVENTORY_TAXONOMY_UPDATED_EVENT,
  getInventoryTaxonomyStats,
  loadInventoryTaxonomy,
  removeInventoryCategory,
  removeInventorySubcategory,
  saveInventoryTaxonomy,
  toggleInventoryCategory,
  toggleInventorySubcategory,
  upsertInventoryCategory,
  upsertInventorySubcategory,
} from '../data/inventoryTaxonomy';

const EMPTY_CATEGORY = { id: null, name: '', color: '#38bdf8', notes: '', active: true };
const EMPTY_SUBCATEGORY = { id: null, name: '', notes: '', active: true };

function CategoryForm({ value, onChange, onSave, onCancel, error }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return (
    <div className="system-taxonomy-form">
      <div className="system-taxonomy-form-header">
        <div>
          <div className="system-taxonomy-form-title">{value.id ? <Edit3 size={15} /> : <Plus size={15} />} {value.id ? 'EDITAR CATEGORIA' : 'ADICIONAR CATEGORIA'}</div>
          <div className="system-taxonomy-form-subtitle">Categorias usadas nos cards, filtros e formulários do Inventário</div>
        </div>
        <button type="button" onClick={onCancel} className="system-taxonomy-icon-button" title="Cancelar"><X size={14} /></button>
      </div>
      {error && <div className="system-taxonomy-error"><AlertTriangle size={13} /> {error}</div>}
      <div className="system-taxonomy-form-grid">
        <label>Nome *<input autoFocus value={value.name} onChange={event => set('name', event.target.value)} placeholder="Ex.: Equipamento médico" /></label>
        <label>Cor<input type="color" value={value.color || '#38bdf8'} onChange={event => set('color', event.target.value)} /></label>
        <label className="system-taxonomy-form-wide">Observações<input value={value.notes || ''} onChange={event => set('notes', event.target.value)} placeholder="Descrição opcional" /></label>
      </div>
      <label className="system-taxonomy-active"><input type="checkbox" checked={value.active !== false} onChange={event => set('active', event.target.checked)} /> Disponível nos seletores do Inventário</label>
      <div className="system-taxonomy-form-actions"><button type="button" onClick={onCancel} className="system-taxonomy-secondary"><X size={12} /> Cancelar</button><button type="button" onClick={onSave} disabled={!value.name.trim()} className="system-taxonomy-primary"><Save size={12} /> Salvar categoria</button></div>
    </div>
  );
}

function SubcategoryForm({ category, value, onChange, onSave, onCancel, error }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return (
    <div className="system-taxonomy-subform">
      <div className="system-taxonomy-subform-title">{value.id ? <Edit3 size={13} /> : <Plus size={13} />} {value.id ? 'Editar subcategoria' : 'Nova subcategoria'} <span>· {category.name}</span></div>
      {error && <div className="system-taxonomy-error"><AlertTriangle size={12} /> {error}</div>}
      <div className="system-taxonomy-subform-grid"><label>Nome *<input autoFocus value={value.name} onChange={event => set('name', event.target.value)} placeholder="Ex.: Equipamento raro" /></label><label>Observações<input value={value.notes || ''} onChange={event => set('notes', event.target.value)} placeholder="Descrição opcional" /></label><label className="system-taxonomy-inline-check"><input type="checkbox" checked={value.active !== false} onChange={event => set('active', event.target.checked)} /> Ativa</label></div>
      <div className="system-taxonomy-form-actions"><button type="button" onClick={onCancel} className="system-taxonomy-secondary"><X size={11} /> Cancelar</button><button type="button" onClick={onSave} disabled={!value.name.trim()} className="system-taxonomy-primary"><Save size={11} /> Salvar subcategoria</button></div>
    </div>
  );
}

export default function InventoryTaxonomyAdminPage({ embedded = false }) {
  const [categories, setCategories] = useState(() => loadInventoryTaxonomy());
  const [selectedId, setSelectedId] = useState(() => loadInventoryTaxonomy()[0]?.id || '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [categoryEditing, setCategoryEditing] = useState(null);
  const [subcategoryEditing, setSubcategoryEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteSubConfirm, setDeleteSubConfirm] = useState('');

  useEffect(() => {
    const refresh = event => {
      const next = Array.isArray(event?.detail) ? event.detail : loadInventoryTaxonomy();
      setCategories(next);
      setSelectedId(current => next.some(category => category.id === current) ? current : next[0]?.id || '');
    };
    window.addEventListener(INVENTORY_TAXONOMY_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(INVENTORY_TAXONOMY_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const stats = useMemo(() => getInventoryTaxonomyStats(categories), [categories]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return categories.filter(category => statusFilter === 'all' || (statusFilter === 'active' ? category.active !== false : category.active === false)).filter(category => !query || `${category.name} ${category.notes || ''} ${category.subcategories.map(item => item.name).join(' ')}`.toLocaleLowerCase().includes(query));
  }, [categories, search, statusFilter]);
  const selected = categories.find(category => category.id === selectedId) || filtered[0] || categories[0] || null;

  function showSaved(message) {
    setSavedMessage(message);
    window.setTimeout(() => setSavedMessage(''), 2200);
  }

  function beginCategoryCreate() {
    setCategoryEditing({ ...EMPTY_CATEGORY });
    setSubcategoryEditing(null);
    setFormError('');
  }

  function beginCategoryEdit(category) {
    setCategoryEditing({ id: category.id, name: category.name, color: category.color, notes: category.notes, active: category.active !== false });
    setSubcategoryEditing(null);
    setFormError('');
  }

  function saveCategory() {
    try {
      const next = upsertInventoryCategory(categoryEditing);
      setCategories(next);
      const saved = next.find(category => category.name.toLocaleLowerCase() === categoryEditing.name.trim().toLocaleLowerCase());
      setSelectedId(saved?.id || selectedId);
      setCategoryEditing(null);
      setFormError('');
      showSaved(`${categoryEditing.name} salvo com sucesso.`);
    } catch (error) {
      setFormError(error.message || 'Não foi possível salvar a categoria.');
    }
  }

  function toggleCategory(category) {
    const next = toggleInventoryCategory(category.id);
    setCategories(next);
  }

  function deleteCategory(category) {
    if (deleteConfirm !== category.id) {
      setDeleteConfirm(category.id);
      return;
    }
    const next = removeInventoryCategory(category.id);
    setCategories(next);
    setSelectedId(current => current === category.id ? next[0]?.id || '' : current);
    setDeleteConfirm('');
    if (categoryEditing?.id === category.id) setCategoryEditing(null);
  }

  function beginSubcategoryCreate(category) {
    setSelectedId(category.id);
    setSubcategoryEditing({ categoryId: category.id, ...EMPTY_SUBCATEGORY });
    setCategoryEditing(null);
    setFormError('');
  }

  function beginSubcategoryEdit(category, subcategory) {
    setSelectedId(category.id);
    setSubcategoryEditing({ categoryId: category.id, id: subcategory.id, name: subcategory.name, notes: subcategory.notes, active: subcategory.active !== false });
    setCategoryEditing(null);
    setFormError('');
  }

  function saveSubcategory() {
    try {
      const next = upsertInventorySubcategory(subcategoryEditing.categoryId, subcategoryEditing);
      setCategories(next);
      setSubcategoryEditing(null);
      setFormError('');
      showSaved(`${subcategoryEditing.name} salvo com sucesso.`);
    } catch (error) {
      setFormError(error.message || 'Não foi possível salvar a subcategoria.');
    }
  }

  function toggleSubcategory(category, subcategory) {
    setCategories(toggleInventorySubcategory(category.id, subcategory.id));
  }

  function deleteSubcategory(category, subcategory) {
    const key = `${category.id}:${subcategory.id}`;
    if (deleteSubConfirm !== key) {
      setDeleteSubConfirm(key);
      return;
    }
    setCategories(removeInventorySubcategory(category.id, subcategory.id));
    setDeleteSubConfirm('');
    if (subcategoryEditing?.id === subcategory.id) setSubcategoryEditing(null);
  }

  const content = (
    <>
      <div className="system-taxonomy-toolbar"><div className="system-taxonomy-search"><Search size={12} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar categoria ou subcategoria..." /></div><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="active">Ativas</option><option value="all">Todas</option><option value="inactive">Inativas</option></select><span className="system-taxonomy-result"><Filter size={11} /> {filtered.length} categoria{filtered.length === 1 ? '' : 's'}</span></div>
      {categoryEditing && <CategoryForm value={categoryEditing} onChange={setCategoryEditing} onSave={saveCategory} onCancel={() => { setCategoryEditing(null); setFormError(''); }} error={formError} />}
      {subcategoryEditing && selected && <SubcategoryForm category={selected} value={subcategoryEditing} onChange={setSubcategoryEditing} onSave={saveSubcategory} onCancel={() => { setSubcategoryEditing(null); setFormError(''); }} error={formError} />}
      <div className="system-taxonomy-category-grid">
        {filtered.length === 0 ? <div className="system-taxonomy-empty">Nenhuma categoria encontrada. Use <strong>Adicionar categoria</strong> para cadastrar uma nova entrada.</div> : filtered.map(category => {
          const categorySelected = selected?.id === category.id;
          return <section key={category.id} className={`system-taxonomy-category-card${categorySelected ? ' selected' : ''}`} style={{ '--taxonomy-color': category.color || '#38bdf8' }}>
            <div className="system-taxonomy-category-header" onClick={() => setSelectedId(category.id)} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && setSelectedId(category.id)}>
              <div className="system-taxonomy-category-title"><FolderTree size={15} /><strong>{category.name}</strong>{category.builtIn && <span className="system-taxonomy-built-in">base</span>}</div>
              <div className="system-taxonomy-category-actions"><span className={category.active === false ? 'system-taxonomy-status inactive' : 'system-taxonomy-status'}>{category.active === false ? 'Inativa' : 'Ativa'}</span><button type="button" onClick={() => toggleCategory(category)} title={category.active === false ? 'Ativar categoria' : 'Desativar categoria'} className="system-taxonomy-icon-button">{category.active === false ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}</button><button type="button" onClick={() => beginCategoryEdit(category)} title="Editar categoria" className="system-taxonomy-icon-button"><Edit3 size={13} /></button><button type="button" onClick={() => deleteCategory(category)} title="Excluir categoria" className="system-taxonomy-icon-button delete"><Trash2 size={13} /></button></div>
            </div>
            {deleteConfirm === category.id && <div className="system-taxonomy-delete-confirm"><span>Excluir esta categoria e suas subcategorias?</span><div><button type="button" onClick={() => setDeleteConfirm('')}>Cancelar</button><button type="button" onClick={() => deleteCategory(category)}>Excluir definitivamente</button></div></div>}
            {category.notes && <div className="system-taxonomy-category-notes">{category.notes}</div>}
            <div className="system-taxonomy-subcategory-heading"><span>{category.subcategories.length} subcategoria{category.subcategories.length === 1 ? '' : 's'}</span><button type="button" onClick={() => beginSubcategoryCreate(category)}><Plus size={11} /> Adicionar</button></div>
            <div className="system-taxonomy-subcategory-list">{category.subcategories.length === 0 ? <span className="system-taxonomy-no-subcategory">Nenhuma subcategoria cadastrada.</span> : category.subcategories.map(subcategory => <div key={subcategory.id} className="system-taxonomy-subcategory-row" style={{ opacity: subcategory.active === false ? 0.55 : 1 }}><span>{subcategory.name}{subcategory.builtIn && <small>base</small>}</span><em>{subcategory.active === false ? 'Inativa' : 'Ativa'}</em><button type="button" onClick={() => toggleSubcategory(category, subcategory)} title={subcategory.active === false ? 'Ativar subcategoria' : 'Desativar subcategoria'}>{subcategory.active === false ? <ToggleLeft size={12} /> : <ToggleRight size={12} />}</button><button type="button" onClick={() => beginSubcategoryEdit(category, subcategory)} title="Editar subcategoria"><Edit3 size={11} /></button><button type="button" onClick={() => deleteSubcategory(category, subcategory)} title="Excluir subcategoria"><Trash2 size={11} /></button>{deleteSubConfirm === `${category.id}:${subcategory.id}` && <div className="system-taxonomy-subdelete"><span>Excluir?</span><button type="button" onClick={() => setDeleteSubConfirm('')}>Não</button><button type="button" onClick={() => deleteSubcategory(category, subcategory)}>Sim</button></div>}</div>)}</div>
          </section>;
        })}
      </div>
      <div className="system-taxonomy-help"><AlertTriangle size={12} /> Desativar mantém os dados antigos intactos e apenas remove a opção dos novos formulários. As categorias e subcategorias administradas são compartilhadas com o Inventário.</div>
    </>
  );

  return <div className={embedded ? 'system-taxonomy-page system-taxonomy-page-embedded' : 'system-taxonomy-page'}>{!embedded && <div className="page-header"><div><div className="page-title"><FolderTree size={18} /> CATEGORIAS E SUBCATEGORIAS</div><div className="page-subtitle">Administre a estrutura usada pelo Inventário de Itens</div></div><button type="button" onClick={beginCategoryCreate} className="system-taxonomy-add-button"><Plus size={13} /> Adicionar categoria</button></div>}<div className="system-taxonomy-scroll">{embedded && <div className="system-taxonomy-inline-header"><div><strong>Categorias e Subcategorias</strong><span>Estrutura compartilhada pelo Inventário de Itens</span></div><button type="button" onClick={beginCategoryCreate} className="system-taxonomy-add-button"><Plus size={13} /> Adicionar categoria</button></div>}<div className="system-taxonomy-stats">{[['Categorias', stats.categories, 'var(--accent-primary)'], ['Ativas', stats.activeCategories, 'var(--accent-green)'], ['Subcategorias', stats.subcategories, 'var(--accent-purple)'], ['Subcategorias ativas', stats.activeSubcategories, 'var(--accent-gold)']].map(([label, value, color]) => <div key={label}><span>{label}</span><strong style={{ color }}>{value}</strong></div>)}</div>{savedMessage && <div className="system-taxonomy-success"><CheckCircle2 size={13} /> {savedMessage}</div>}{content}</div></div>;
}
