import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Clock, Copy, Edit3, MessageSquare, Plus, Search,
  Save, Star, Tag, Trash2, X, BookOpen, ClipboardList, Pickaxe,
  Package, Crosshair, Lightbulb, ShoppingCart, Handshake, FileText, Paperclip
} from 'lucide-react';
import NoteAttachments from '../components/NoteAttachments';
import { UEX_TEXTS_UPDATED_EVENT, dispatchUexUiEvent } from '../data/uexUiEvents';

const NOTES_KEY = 'sc_notes_v1';
const UEX_TEXTS_KEY = 'sc_uex_texts_v1';
const NOTE_CATEGORIES = ['Geral', 'Planejamento', 'Mineração', 'Inventário', 'Missões', 'Ideias'];
const UEX_CATEGORIES = ['Negociação', 'Compra', 'Venda', 'Troca', 'Mensagem geral'];

const NOTE_VISUALS = {
  Geral:         { color:'#38bdf8', soft:'rgba(56,189,248,0.10)', icon:BookOpen,      label:'Anotação geral',      hint:'Registro pessoal' },
  Planejamento:  { color:'#a78bfa', soft:'rgba(167,139,250,0.10)', icon:ClipboardList, label:'Planejamento',        hint:'Organização e metas' },
  Mineração:     { color:'#fbbf24', soft:'rgba(251,191,36,0.10)', icon:Pickaxe,       label:'Mineração',           hint:'Extração e recursos' },
  Inventário:    { color:'#34d399', soft:'rgba(52,211,153,0.10)', icon:Package,       label:'Inventário',          hint:'Itens e equipamentos' },
  Missões:       { color:'#fb7185', soft:'rgba(251,113,133,0.10)', icon:Crosshair,     label:'Missões',             hint:'Objetivos e operações' },
  Ideias:        { color:'#f59e0b', soft:'rgba(245,158,11,0.10)', icon:Lightbulb,      label:'Ideias',              hint:'Rascunhos e inspirações' },
};

const UEX_VISUALS = {
  Negociação:     { color:'#38bdf8', soft:'rgba(56,189,248,0.10)', icon:Handshake,    label:'Negociação',        hint:'Conversas com compradores' },
  Compra:         { color:'#34d399', soft:'rgba(52,211,153,0.10)', icon:ShoppingCart, label:'Compra',            hint:'Mensagens para comprar' },
  Venda:          { color:'#fbbf24', soft:'rgba(251,191,36,0.10)', icon:Tag,          label:'Venda',             hint:'Mensagens para vender' },
  Troca:          { color:'#a78bfa', soft:'rgba(167,139,250,0.10)', icon:FileText,    label:'Troca',             hint:'Propostas de troca' },
  'Mensagem geral': { color:'#fb7185', soft:'rgba(251,113,133,0.10)', icon:MessageSquare, label:'Mensagem geral', hint:'Comunicação rápida' },
};

const DEFAULT_NOTE_VISUAL = { color:'#94a3b8', soft:'rgba(148,163,184,0.10)', icon:FileText, label:'Nota', hint:'Registro salvo' };

function getEntryVisual(entry, isUex) {
  const table = isUex ? UEX_VISUALS : NOTE_VISUALS;
  return table[entry?.category] || (isUex ? UEX_VISUALS['Mensagem geral'] : DEFAULT_NOTE_VISUAL);
}

function EntryVisualBadge({ entry, isUex, compact = false }) {
  const visual = getEntryVisual(entry, isUex);
  const Icon = visual.icon;
  return (
    <span
      className={`notes-entry-category-badge${compact ? ' compact' : ''}`}
      style={{color:visual.color,background:visual.soft,borderColor:`${visual.color}55`}}
    >
      <Icon size={compact ? 9 : 11}/>
      <span>{visual.label}</span>
    </span>
  );
}

function loadList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveList(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function newEntry(kind) {
  const now = new Date().toISOString();
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: kind === 'uex' ? 'Novo texto UEX' : 'Nova anotação',
    category: kind === 'uex' ? UEX_CATEGORIES[0] : NOTE_CATEGORIES[0],
    content: '',
    pinned: false,
    created_at: now,
    updated_at: now,
    attachments: [],
  };
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function EmptyEditor({ kind, onNew }) {
  return (
    <div style={{height:'100%',minHeight:360,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',textAlign:'center',padding:30}}>
      {kind === 'uex' ? <MessageSquare size={42} style={{opacity:0.18,marginBottom:12}}/> : <Edit3 size={42} style={{opacity:0.18,marginBottom:12}}/>}
      <div style={{fontFamily:'Michroma,sans-serif',fontSize:13,fontWeight:700,marginBottom:7}}>{kind === 'uex' ? 'NENHUM TEXTO UEX SELECIONADO' : 'NENHUMA NOTA SELECIONADA'}</div>
      <div style={{fontSize:12,maxWidth:330,lineHeight:1.5,marginBottom:14}}>Escolha um item na lista ou crie um novo registro para começar.</div>
      <button onClick={onNew} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'rgba(56,189,248,0.1)',border:'1px solid rgba(56,189,248,0.3)',borderRadius:6,color:'var(--accent-primary)',cursor:'pointer',fontFamily:'"Exo 2",sans-serif',fontSize:11,fontWeight:700,textTransform:'uppercase'}}><Plus size={13}/> Criar agora</button>
    </div>
  );
}

export default function NotesPage() {
  const [activeTab, setActiveTab] = useState('notes');
  const [notes, setNotes] = useState(() => loadList(NOTES_KEY));
  const [uexTexts, setUexTexts] = useState(() => loadList(UEX_TEXTS_KEY));
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [attachmentError, setAttachmentError] = useState('');

  const isUex = activeTab === 'uex';
  const storageKey = isUex ? UEX_TEXTS_KEY : NOTES_KEY;
  const categories = isUex ? UEX_CATEGORIES : NOTE_CATEGORIES;
  const entries = isUex ? uexTexts : notes;

  useEffect(() => {
    setSelectedId(null);
    setEditing(null);
    setSearch('');
    setCategoryFilter('all');
  }, [activeTab]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...entries]
      .filter(entry => categoryFilter === 'all' || entry.category === categoryFilter)
      .filter(entry => !query || `${entry.title} ${entry.category} ${entry.content}`.toLowerCase().includes(query))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  }, [entries, search, categoryFilter]);

  const selectedEntry = entries.find(entry => entry.id === selectedId) || null;

  function updateState(next) {
    if (isUex) setUexTexts(next);
    else setNotes(next);
    saveList(storageKey, next);
    if (isUex) dispatchUexUiEvent(UEX_TEXTS_UPDATED_EVENT, { texts: next });
  }

  function createEntry() {
    const entry = newEntry(isUex ? 'uex' : 'note');
    updateState([entry, ...entries]);
    setSelectedId(entry.id);
    setEditing({ ...entry });
  }

  function startEditing(entry) {
    setSelectedId(entry.id);
    setEditing({ ...entry });
  }

  function cancelEditing() {
    setEditing(null);
  }

  function saveEditing() {
    if (!editing || !editing.title.trim()) return;
    const normalized = {
      ...editing,
      title: editing.title.trim(),
      content: editing.content || '',
      category: editing.category || categories[0],
      attachments: Array.isArray(editing.attachments) ? editing.attachments : [],
      updated_at: new Date().toISOString(),
    };
    updateState(entries.some(entry => entry.id === normalized.id)
      ? entries.map(entry => entry.id === normalized.id ? normalized : entry)
      : [normalized, ...entries]);
    setSelectedId(normalized.id);
    setEditing(null);
  }

  async function removeEntry(id) {
    const entry = entries.find(item => item.id === id);
    const attachments = Array.isArray(entry?.attachments) ? entry.attachments : [];
    if (window.electronAPI?.notesDeleteAttachment) {
      const storedAttachments = attachments
        .map(attachment => attachment?.filename || attachment?.storedName)
        .filter(Boolean);
      const results = await Promise.all(storedAttachments.map(filename => window.electronAPI.notesDeleteAttachment(filename)));
      const failed = results.some(result => !result?.success);
      if (failed) console.warn('Alguns anexos não puderam ser removidos do disco.');
    }
    updateState(entries.filter(item => item.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setEditing(null);
    }
    setDeleteConfirm(null);
  }

  function togglePinned(entry) {
    updateState(entries.map(item => item.id === entry.id ? { ...item, pinned: !item.pinned, updated_at:new Date().toISOString() } : item));
  }

  async function handleCopy(entry) {
    try {
      await copyToClipboard(entry.content || '');
      setCopiedId(entry.id);
      window.setTimeout(() => setCopiedId(current => current === entry.id ? null : current), 1600);
    } catch (error) {
      console.error('Não foi possível copiar o texto:', error);
    }
  }

  function handleAttachmentsChange(nextAttachments) {
    const current = editing || selectedEntry;
    if (!current) return;
    const updated = {
      ...current,
      attachments: Array.isArray(nextAttachments) ? nextAttachments : [],
      updated_at: new Date().toISOString(),
    };
    const nextEntries = entries.some(entry => entry.id === updated.id)
      ? entries.map(entry => entry.id === updated.id ? updated : entry)
      : [updated, ...entries];
    updateState(nextEntries);
    setSelectedId(updated.id);
    setEditing(previous => previous ? { ...previous, ...updated } : null);
  }

  const editor = editing || selectedEntry;
  const editorVisual = getEntryVisual(editor, isUex);
  const EditorIcon = editorVisual.icon;

  const inputStyle = {width:'100%',boxSizing:'border-box',padding:'9px 11px',background:'var(--bg-base)',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text-primary)',fontFamily:'"Exo 2",sans-serif',fontSize:13,outline:'none'};
  const selectStyle = { ...inputStyle, appearance:'none', WebkitAppearance:'none', paddingRight:28 };
  const labelStyle = {fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:5};

  return (
    <div className="notes-page" style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div className="page-header">
        <div>
          <div className="page-title" style={{display:'flex',alignItems:'center',gap:9}}><Edit3 size={18}/> BLOCO DE NOTAS</div>
          <div className="page-subtitle">Anotações organizadas e textos reutilizáveis para suas negociações na UEX</div>
        </div>
        <button onClick={createEntry} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 13px',background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:6,color:'var(--accent-green)',cursor:'pointer',fontFamily:'"Exo 2",sans-serif',fontSize:11,fontWeight:700,textTransform:'uppercase'}}><Plus size={13}/> {isUex ? 'Novo texto UEX' : 'Nova nota'}</button>
      </div>

      <div style={{display:'flex',gap:0,padding:'0 32px',borderBottom:'1px solid var(--border-subtle)',background:'var(--bg-panel)',flexShrink:0}}>
        {[
          {id:'notes',label:'Notas livres',icon:Edit3,count:notes.length},
          {id:'uex',label:'Textos UEX',icon:MessageSquare,count:uexTexts.length},
        ].map(tab => {
          const Icon = tab.icon;
          return <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{display:'flex',alignItems:'center',gap:7,padding:'11px 17px',background:'transparent',border:'none',borderBottom:`2px solid ${activeTab===tab.id?'var(--accent-primary)':'transparent'}`,color:activeTab===tab.id?'var(--accent-primary)':'var(--text-secondary)',fontFamily:'"Exo 2",sans-serif',fontSize:12,fontWeight:700,textTransform:'uppercase',cursor:'pointer'}}><Icon size={13}/>{tab.label}<span style={{fontFamily:'Share Tech Mono,monospace',fontSize:10,padding:'1px 6px',borderRadius:8,background:'rgba(255,255,255,0.06)'}}>{tab.count}</span></button>;
        })}
      </div>

      <div className="notes-workspace" style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:'minmax(260px,330px) minmax(0,1fr)',gap:14,padding:'14px 32px 22px',overflow:'hidden'}}>
        <section className="notes-list-panel" style={{minHeight:0,display:'flex',flexDirection:'column',background:'var(--bg-panel)',border:'1px solid var(--border-subtle)',borderRadius:9,overflow:'hidden'}}>
          <div style={{padding:11,borderBottom:'1px solid var(--border-subtle)'}}>
            <div style={{display:'flex',gap:6,marginBottom:8}}>
              <div style={{position:'relative',flex:1}}><Search size={12} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={isUex?'Buscar textos UEX...':'Buscar notas...'} style={{...inputStyle,padding:'7px 9px 7px 27px',fontSize:12}}/></div>
              <button onClick={createEntry} title="Novo registro" style={{width:31,height:31,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(56,189,248,0.08)',border:'1px solid rgba(56,189,248,0.25)',borderRadius:5,color:'var(--accent-primary)',cursor:'pointer'}}><Plus size={14}/></button>
            </div>
            <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} style={{...selectStyle,padding:'7px 9px',fontSize:11}}>
              <option value="all">Todas as categorias</option>
              {categories.map(category=><option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:8}}>
            {filteredEntries.length === 0 ? (
              <div style={{padding:'35px 12px',textAlign:'center',color:'var(--text-muted)',fontSize:11,lineHeight:1.5}}>Nenhum registro encontrado.<br/>Crie o primeiro usando o botão +.</div>
            ) : filteredEntries.map(entry => {
              const visual = getEntryVisual(entry, isUex);
              const VisualIcon = visual.icon;
              const isSelected = selectedId === entry.id;
              return (
                <div
                  key={entry.id}
                  className={`notes-entry-card${isSelected ? ' selected' : ''}${isUex ? ' uex-entry' : ' note-entry'}`}
                  onClick={()=>{setSelectedId(entry.id);setEditing(null);}}
                  style={{
                    '--note-color': visual.color,
                    '--note-soft': visual.soft,
                    borderColor: isSelected ? `${visual.color}88` : 'var(--border-subtle)',
                    background: isSelected ? visual.soft : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div className="notes-entry-card-topline">
                    <div className="notes-entry-icon" style={{color:visual.color,background:visual.soft,borderColor:`${visual.color}55`}}>
                      <VisualIcon size={14}/>
                    </div>
                    <div className="notes-entry-heading">
                      <div className="notes-entry-title-row">
                        <div className="notes-entry-title">{entry.title}</div>
                        {entry.pinned && <Star className="notes-entry-pin" size={11} style={{color:'var(--accent-gold)',fill:'var(--accent-gold)'}}/>}
                      </div>
                      <div className="notes-entry-meta">
                        <EntryVisualBadge entry={entry} isUex={isUex} compact/>
                        {Array.isArray(entry.attachments) && entry.attachments.length > 0 && <span className="notes-entry-attachments"><Paperclip size={9}/>{entry.attachments.length}</span>}
                        <span className="notes-entry-date"><Clock size={9}/>{formatDate(entry.updated_at)}</span>
                      </div>
                    </div>
                    {isUex && <button onClick={e=>{e.stopPropagation();handleCopy(entry);}} title="Copiar texto" className={`notes-copy-button${copiedId===entry.id ? ' copied' : ''}`}>{copiedId===entry.id?<CheckCircle2 size={12}/>:<Copy size={12}/>}</button>}
                  </div>
                  <div className="notes-entry-preview">{entry.content || 'Sem conteúdo ainda.'}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="notes-editor-panel" style={{minHeight:0,overflowY:'auto',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:9}}>
          {!editor ? <EmptyEditor kind={isUex?'uex':'notes'} onNew={createEntry}/> : (
            <div className="notes-editor-content" style={{padding:'20px 22px',maxWidth:900}}>
              <div className="notes-editor-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:17}}>
                <div className="notes-editor-identity">
                  <div className="notes-editor-icon" style={{color:editorVisual.color,background:editorVisual.soft,borderColor:`${editorVisual.color}66`}}><EditorIcon size={17}/></div>
                  <div className="notes-editor-heading">
                    <div className="notes-editor-type" style={{color:editorVisual.color}}>{isUex?'TEXTO UEX':'NOTA LIVRE'}</div>
                    <div className="notes-editor-description">{editorVisual.hint} · salvo localmente no dispositivo</div>
                  </div>
                </div>
                <div className="notes-editor-actions" style={{display:'flex',gap:6}}>
                  <button onClick={()=>togglePinned(editor)} title={editor.pinned?'Desafixar':'Fixar no topo'} style={{width:29,height:29,display:'flex',alignItems:'center',justifyContent:'center',background:editor.pinned?'rgba(251,191,36,0.12)':'transparent',border:`1px solid ${editor.pinned?'rgba(251,191,36,0.35)':'var(--border-subtle)'}`,borderRadius:5,color:editor.pinned?'var(--accent-gold)':'var(--text-muted)',cursor:'pointer'}}><Star size={13} fill={editor.pinned?'currentColor':'none'}/></button>
                  {isUex && <button onClick={()=>handleCopy(editor)} style={{display:'flex',alignItems:'center',gap:5,padding:'6px 10px',background:copiedId===editor.id?'rgba(52,211,153,0.12)':'rgba(56,189,248,0.08)',border:`1px solid ${copiedId===editor.id?'rgba(52,211,153,0.35)':'rgba(56,189,248,0.25)'}`,borderRadius:5,color:copiedId===editor.id?'var(--accent-green)':'var(--accent-primary)',cursor:'pointer',fontSize:10,fontWeight:700,textTransform:'uppercase'}}>{copiedId===editor.id?<CheckCircle2 size={12}/>:<Copy size={12}/>} {copiedId===editor.id?'Copiado':'Copiar texto'}</button>}
                  <button onClick={()=>setDeleteConfirm(editor.id)} title="Excluir" style={{width:29,height:29,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(251,113,133,0.07)',border:'1px solid rgba(251,113,133,0.2)',borderRadius:5,color:'var(--accent-red)',cursor:'pointer'}}><Trash2 size={13}/></button>
                </div>
              </div>

              {deleteConfirm===editor.id && <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'9px 11px',marginBottom:12,background:'rgba(251,113,133,0.08)',border:'1px solid rgba(251,113,133,0.25)',borderRadius:6,fontSize:11,color:'var(--accent-red)'}}><span>Excluir este registro?</span><div style={{display:'flex',gap:5}}><button onClick={()=>removeEntry(editor.id)} style={{padding:'4px 9px',background:'rgba(251,113,133,0.15)',border:'1px solid rgba(251,113,133,0.35)',borderRadius:4,color:'var(--accent-red)',cursor:'pointer',fontSize:10,fontWeight:700}}>Excluir</button><button onClick={()=>setDeleteConfirm(null)} style={{padding:'4px 9px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-secondary)',cursor:'pointer',fontSize:10}}>Cancelar</button></div></div>}

              <div className="notes-editor-fields" style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10,marginBottom:12}}>
                <div><label style={labelStyle}>Título</label><input value={editor.title} onChange={e=>setEditing({...editor,title:e.target.value})} style={inputStyle} placeholder={isUex?'Ex: Mensagem padrão de compra':'Título da anotação'}/></div>
                <div><label style={labelStyle}>Categoria</label><select value={editor.category} onChange={e=>setEditing({...editor,category:e.target.value})} style={selectStyle}>{categories.map(category=><option key={category}>{category}</option>)}</select></div>
              </div>
              <div style={{marginBottom:14}}><label style={labelStyle}>{isUex?'Texto para copiar e reutilizar':'Conteúdo da nota'}</label><textarea autoFocus value={editor.content} onChange={e=>setEditing({...editor,content:e.target.value})} placeholder={isUex?'Digite aqui a mensagem que você usa nas negociações...':'Escreva sua anotação aqui...'} style={{...inputStyle,minHeight:330,resize:'vertical',lineHeight:1.6,fontSize:13}}/></div>
              <NoteAttachments
                noteId={editor.id}
                attachments={editor.attachments || []}
                onChange={handleAttachmentsChange}
                onError={setAttachmentError}
              />
              {attachmentError && <div className="note-attachment-error">{attachmentError}</div>}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span style={{fontSize:10,color:'var(--text-muted)'}}>{editor.content.length} caracteres · atualizado em {formatDate(editor.updated_at)}</span>
                <div style={{display:'flex',gap:7}}>
                  {editing && <button onClick={cancelEditing} style={{display:'flex',alignItems:'center',gap:5,padding:'8px 13px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:5,color:'var(--text-secondary)',cursor:'pointer',fontSize:11,fontWeight:700}}><X size={12}/> Cancelar</button>}
                  <button onClick={saveEditing} disabled={!editor.title.trim()} style={{display:'flex',alignItems:'center',gap:5,padding:'8px 15px',background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:5,color:'var(--accent-green)',cursor:'pointer',fontSize:11,fontWeight:700,opacity:editor.title.trim()?1:0.5}}><Save size={12}/> Salvar {isUex?'texto':'nota'}</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
