import React, { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileImage, FileText, LoaderCircle, Paperclip, Plus, Trash2 } from 'lucide-react';

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const BROWSER_FALLBACK_MAX_BYTES = 4 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name) {
  const match = String(name || '').toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : '';
}

function attachmentName(attachment) {
  return attachment?.originalName || attachment?.name || attachment?.filename || attachment?.storedName || 'Anexo';
}

function attachmentStoredName(attachment) {
  return attachment?.filename || attachment?.storedName || '';
}

function isImageAttachment(attachment) {
  const mime = String(attachment?.mimeType || '').toLowerCase();
  return mime.startsWith('image/') || IMAGE_EXTENSIONS.has(fileExtension(attachmentName(attachment)));
}

function isPdfAttachment(attachment) {
  return String(attachment?.mimeType || '').toLowerCase() === 'application/pdf' || fileExtension(attachmentName(attachment)) === '.pdf';
}

function isSupportedFile(file) {
  const mime = String(file?.type || '').toLowerCase();
  const extension = fileExtension(file?.name);
  return mime.startsWith('image/') || mime === 'application/pdf' || extension === '.pdf' || IMAGE_EXTENSIONS.has(extension);
}

function makeAttachmentId() {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

function AttachmentPreview({ attachment }) {
  const [src, setSrc] = useState(attachment?.dataUrl || '');
  const [loading, setLoading] = useState(Boolean(!src && attachmentStoredName(attachment)));
  const image = isImageAttachment(attachment);
  const pdf = isPdfAttachment(attachment);

  useEffect(() => {
    let active = true;
    const storedName = attachmentStoredName(attachment);
    if (src || !storedName || !window.electronAPI?.notesReadAttachment) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    window.electronAPI.notesReadAttachment(storedName)
      .then(result => {
        if (!active) return;
        if (result?.success && result.base64) {
          const mime = result.mimeType || attachment.mimeType || (image ? 'image/*' : 'application/pdf');
          setSrc(`data:${mime};base64,${result.base64}`);
        }
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [attachment, image, src]);

  if (loading) return <span className="note-attachment-loading"><LoaderCircle size={19}/></span>;
  if (image && src) return <img className="note-attachment-thumb" src={src} alt="Pré-visualização do anexo" />;
  if (pdf) return <span className="note-attachment-file-icon"><FileText size={22}/><small>PDF</small></span>;
  return <span className="note-attachment-file-icon"><FileImage size={22}/><small>ARQUIVO</small></span>;
}

function AttachmentCard({ attachment, onOpen, onDownload, onDelete }) {
  const image = isImageAttachment(attachment);
  return (
    <article className="note-attachment-card">
      <button
        type="button"
        className="note-attachment-preview"
        onClick={() => onOpen(attachment)}
        data-help={image ? 'Clique para abrir a imagem em uma nova janela.' : 'Clique para abrir o PDF no visualizador padrão do Windows.'}
        aria-label={`Abrir anexo ${attachmentName(attachment)}`}
      >
        <AttachmentPreview attachment={attachment}/>
      </button>
      <div className="note-attachment-info">
        <span className="note-attachment-name" title={attachmentName(attachment)}>{attachmentName(attachment)}</span>
        <span className="note-attachment-meta">{image ? 'Imagem' : 'PDF'} · {formatBytes(attachment.size)}</span>
      </div>
      <div className="note-attachment-actions">
        <button type="button" onClick={() => onOpen(attachment)} title="Abrir anexo" aria-label={`Abrir ${attachmentName(attachment)}`}><ExternalLink size={12}/></button>
        <button type="button" onClick={() => onDownload(attachment)} title="Baixar anexo" aria-label={`Baixar ${attachmentName(attachment)}`}><Download size={12}/></button>
        <button type="button" className="danger" onClick={() => onDelete(attachment)} title="Excluir anexo" aria-label={`Excluir ${attachmentName(attachment)}`}><Trash2 size={12}/></button>
      </div>
    </article>
  );
}

export default function NoteAttachments({ noteId, attachments = [], onChange, onError }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const normalizedAttachments = Array.isArray(attachments) ? attachments : [];

  function reportError(error) {
    const text = error?.message || String(error || 'Não foi possível processar o anexo.');
    setMessage(text);
    if (typeof onError === 'function') onError(text);
  }

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setMessage('');
    if (typeof onError === 'function') onError('');
    try {
      const next = [...normalizedAttachments];
      for (const file of files) {
        if (!isSupportedFile(file)) throw new Error(`“${file.name}” não é uma imagem ou PDF permitido.`);
        if (!file.size || file.size > MAX_ATTACHMENT_BYTES) throw new Error(`“${file.name}” excede o limite de 20 MB.`);
        const id = makeAttachmentId();
        const mimeType = file.type || (fileExtension(file.name) === '.pdf' ? 'application/pdf' : 'image/*');
        const api = window.electronAPI;
        let attachment;
        if (api?.notesSaveAttachment) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const result = await api.notesSaveAttachment({ noteId: String(noteId || 'nota'), id, originalName: file.name, mimeType, data: bytes });
          if (!result?.success) throw new Error(result?.error || `Não foi possível salvar “${file.name}”.`);
          attachment = result.attachment || {
            id,
            filename: result.storedName,
            originalName: result.name || file.name,
            mimeType: result.mimeType || mimeType,
            size: result.size || file.size,
            addedAt: new Date().toISOString(),
          };
        } else {
          if (file.size > BROWSER_FALLBACK_MAX_BYTES) throw new Error(`“${file.name}” excede 4 MB no modo de navegador.`);
          attachment = {
            id,
            originalName: file.name,
            mimeType,
            size: file.size,
            dataUrl: await readAsDataUrl(file),
            addedAt: new Date().toISOString(),
          };
        }
        next.push(attachment);
      }
      onChange(next);
      setMessage(`${files.length} anexo${files.length !== 1 ? 's' : ''} adicionado${files.length !== 1 ? 's' : ''}.`);
      if (typeof onError === 'function') onError('');
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function readAttachment(attachment) {
    if (attachment.dataUrl) return attachment.dataUrl;
    const storedName = attachmentStoredName(attachment);
    if (!storedName || !window.electronAPI?.notesReadAttachment) throw new Error('O arquivo anexado não está disponível.');
    const result = await window.electronAPI.notesReadAttachment(storedName);
    if (!result?.success || !result.base64) throw new Error(result?.error || 'Não foi possível ler o anexo.');
    return result.dataUrl || `data:${result.mimeType || attachment.mimeType || (isPdfAttachment(attachment) ? 'application/pdf' : 'image/*')};base64,${result.base64}`;
  }

  async function openAttachment(attachment) {
    try {
      const storedName = attachmentStoredName(attachment);
      if (storedName && window.electronAPI?.notesOpenAttachment) {
        const result = await window.electronAPI.notesOpenAttachment(storedName);
        if (!result?.success) throw new Error(result?.error || 'Não foi possível abrir o anexo.');
        return;
      }
      const src = await readAttachment(attachment);
      window.open(src, '_blank', 'noopener,noreferrer');
    } catch (error) {
      reportError(error);
    }
  }

  async function downloadAttachment(attachment) {
    try {
      const storedName = attachmentStoredName(attachment);
      const name = attachmentName(attachment);
      if (storedName && window.electronAPI?.notesDownloadAttachment) {
        const result = await window.electronAPI.notesDownloadAttachment({ storedName, filename: storedName, originalName: name, name });
        if (!result?.success && !result?.canceled) throw new Error(result?.error || 'Não foi possível baixar o anexo.');
        return;
      }
      const src = await readAttachment(attachment);
      const link = document.createElement('a');
      link.href = src;
      link.download = attachmentName(attachment) || 'anexo';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      reportError(error);
    }
  }

  async function deleteAttachment(attachment) {
    const name = attachmentName(attachment);
    if (!window.confirm(`Excluir o anexo “${name}”?`)) return;
    try {
      const storedName = attachmentStoredName(attachment);
      if (storedName && window.electronAPI?.notesDeleteAttachment) {
        const result = await window.electronAPI.notesDeleteAttachment(storedName);
        if (!result?.success) throw new Error(result?.error || 'Não foi possível excluir o arquivo.');
      }
      onChange(normalizedAttachments.filter(item => item.id !== attachment.id));
      setMessage('Anexo excluído.');
    } catch (error) {
      reportError(error);
    }
  }

  return (
    <section className="note-attachments-section">
      <div className="note-attachments-header">
        <div className="note-attachments-heading"><Paperclip size={14}/><span>ANEXOS DA NOTA</span><strong>{normalizedAttachments.length}</strong></div>
        <label className={`note-attachments-add${busy ? ' is-busy' : ''}`} data-help="Adicione uma ou mais imagens ou PDFs à anotação. Os arquivos ficam na pasta central de dados do Companheiro Emoto.">
          {busy ? <LoaderCircle size={13} className="note-attachment-spinner"/> : <Plus size={13}/>} {busy ? 'Salvando...' : 'Adicionar imagem/PDF'}
          <input ref={inputRef} type="file" accept="image/*,application/pdf,.pdf" multiple disabled={busy} onChange={handleFiles}/>
        </label>
      </div>
      {normalizedAttachments.length > 0 ? (
        <div className="note-attachments-grid">
          {normalizedAttachments.map(attachment => (
            <AttachmentCard key={attachment.id || attachment.filename || attachment.storedName || attachment.name} attachment={attachment} onOpen={openAttachment} onDownload={downloadAttachment} onDelete={deleteAttachment}/>
          ))}
        </div>
      ) : (
        <div className="note-attachments-empty">Adicione mapas, imagens de referência ou PDFs relacionados a esta anotação.</div>
      )}
      {message && <div className="note-attachments-message">{message}</div>}
    </section>
  );
}
