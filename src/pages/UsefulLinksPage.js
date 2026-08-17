import React, { useMemo, useState } from 'react';
import { ExternalLink, Link2, Plus, Search, Edit3, Trash2, X, Save, Star } from 'lucide-react';

const STORAGE_KEY = 'companheiro_emoto_useful_links_v1';
const CATEGORIES = ['Star Citizen', 'UEX', 'SCDB', 'Ferramentas', 'Comunidade', 'Outro'];

function loadLinks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveLinks(links) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function emptyLink() {
  return { id: null, title: '', url: '', category: 'Star Citizen', description: '', favorite: false };
}

export default function UsefulLinksPage() {
  const [links, setLinks] = useState(loadLinks);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(emptyLink);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...links]
      .filter(link => category === 'Todas' || link.category === category)
      .filter(link => !normalized || [link.title, link.url, link.category, link.description].join(' ').toLowerCase().includes(normalized))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title, 'pt-BR'));
  }, [links, query, category]);

  function openNew() {
    setEditing(null); setDraft(emptyLink()); setError(''); setShowForm(true);
  }

  function openEdit(link) {
    setEditing(link.id); setDraft({ ...emptyLink(), ...link }); setError(''); setShowForm(true);
  }

  function updateDraft(key, value) { setDraft(previous => ({ ...previous, [key]: value })); }

  function submit(event) {
    event.preventDefault();
    const title = draft.title.trim();
    const url = normalizeUrl(draft.url);
    if (!title || !url) { setError('Informe um nome e uma URL válida.'); return; }
    try { new URL(url); } catch { setError('A URL informada não é válida.'); return; }
    const next = editing
      ? links.map(link => link.id === editing ? { ...draft, id: editing, title, url, updatedAt: new Date().toISOString() } : link)
      : [...links, { ...draft, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, url, createdAt: new Date().toISOString() }];
    setLinks(next); saveLinks(next); setShowForm(false); setEditing(null); setDraft(emptyLink());
  }

  function remove(link) {
    if (!window.confirm(`Apagar o link “${link.title}”?`)) return;
    const next = links.filter(item => item.id !== link.id);
    setLinks(next); saveLinks(next);
  }

  function toggleFavorite(link) {
    const next = links.map(item => item.id === link.id ? { ...item, favorite: !item.favorite } : item);
    setLinks(next); saveLinks(next);
  }

  function openLink(link) {
    window.open(normalizeUrl(link.url), '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="page-container useful-links-page">
      <div className="page-header">
        <div>
          <div className="page-kicker"><Link2 size={14}/> SISTEMA · ORGANIZAÇÃO</div>
          <h1>Links Úteis</h1>
          <div className="page-subtitle">Guarde sites importantes do Star Citizen em um só lugar e abra-os com um clique.</div>
        </div>
        <button className="primary-btn" onClick={openNew}><Plus size={15}/> Novo link</button>
      </div>

      <section className="useful-links-toolbar">
        <div className="useful-links-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar por nome, site ou descrição..." /></div>
        <select value={category} onChange={event => setCategory(event.target.value)}><option>Todas</option>{CATEGORIES.map(item => <option key={item}>{item}</option>)}</select>
        <span className="useful-links-count">{filtered.length} de {links.length} links</span>
      </section>

      {showForm && <div className="useful-links-form-card">
        <div className="useful-links-form-title"><span>{editing ? 'Editar link' : 'Cadastrar link'}</span><button onClick={() => setShowForm(false)} aria-label="Fechar"><X size={16}/></button></div>
        <form onSubmit={submit} className="useful-links-form">
          <label>Nome do site<input autoFocus value={draft.title} onChange={event => updateDraft('title', event.target.value)} placeholder="Ex.: UEX Marketplace" /></label>
          <label>URL<input value={draft.url} onChange={event => updateDraft('url', event.target.value)} placeholder="https://exemplo.com" /></label>
          <label>Categoria<select value={draft.category} onChange={event => updateDraft('category', event.target.value)}>{CATEGORIES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Descrição <span>(opcional)</span><input value={draft.description} onChange={event => updateDraft('description', event.target.value)} placeholder="Para que este site é útil?" /></label>
          <label className="useful-links-favorite"><input type="checkbox" checked={!!draft.favorite} onChange={event => updateDraft('favorite', event.target.checked)} /> Favoritar este link</label>
          {error && <div className="useful-links-error">{error}</div>}
          <div className="useful-links-form-actions"><button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="primary-btn"><Save size={14}/> Salvar link</button></div>
        </form>
      </div>}

      {filtered.length === 0 ? <div className="useful-links-empty"><Link2 size={30}/><strong>{links.length ? 'Nenhum link encontrado' : 'Sua lista está vazia'}</strong><span>{links.length ? 'Tente outra busca ou categoria.' : 'Cadastre sites que você acessa com frequência.'}</span>{!links.length && <button className="primary-btn" onClick={openNew}><Plus size={14}/> Cadastrar primeiro link</button>}</div> : <div className="useful-links-grid">
        {filtered.map(link => <article className={`useful-link-card ${link.favorite ? 'is-favorite' : ''}`} key={link.id}>
          <div className="useful-link-card-head"><div className="useful-link-icon"><Link2 size={18}/></div><div className="useful-link-card-title"><strong>{link.title}</strong><span>{link.category}</span></div><button className="useful-link-star" onClick={() => toggleFavorite(link)} title={link.favorite ? 'Remover favorito' : 'Favoritar'}><Star size={15} fill={link.favorite ? 'currentColor' : 'none'}/></button></div>
          {link.description && <p>{link.description}</p>}
          <div className="useful-link-url" title={link.url}>{link.url}</div>
          <div className="useful-link-card-actions"><button className="primary-btn" onClick={() => openLink(link)}><ExternalLink size={14}/> Abrir site</button><button className="icon-btn" onClick={() => openEdit(link)} title="Editar"><Edit3 size={14}/></button><button className="icon-btn danger" onClick={() => remove(link)} title="Apagar"><Trash2 size={14}/></button></div>
        </article>)}
      </div>}
    </div>
  );
}

export { loadLinks, normalizeUrl, STORAGE_KEY };
