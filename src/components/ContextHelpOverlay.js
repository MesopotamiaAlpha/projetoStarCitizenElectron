import { useEffect, useRef, useState } from 'react';

const HELP_DELAY_MS = 10000;
const INTERACTIVE_SELECTOR = [
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="tab"]',
  '[data-help]',
].join(',');

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getLabelText(element) {
  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label) return cleanText(label.textContent);
  }
  const parentLabel = element.closest('label');
  return parentLabel ? cleanText(parentLabel.textContent) : '';
}

function getElementHelp(element) {
  if (!element || element.closest('[data-context-help-ignore]')) return '';
  if (element.disabled || element.getAttribute('aria-disabled') === 'true') return '';
  if (element.matches('.calculator-key, [data-tooltip]')) return '';

  const explicit = cleanText(element.getAttribute('data-help'));
  if (explicit) return explicit;

  const aria = cleanText(element.getAttribute('aria-label'));
  const title = cleanText(element.getAttribute('title'));
  const label = getLabelText(element);
  const placeholder = cleanText(element.getAttribute('placeholder'));
  const text = cleanText(element.textContent);

  const tag = element.tagName.toLowerCase();
  const type = cleanText(element.getAttribute('type')).toLowerCase();
  const value = cleanText(element.getAttribute('value'));

  if (title) return title;
  if (aria) return `Função: ${aria}.`;
  if (label && (tag === 'input' || tag === 'select' || tag === 'textarea')) {
    return `Campo “${label}”. Preencha ou selecione esta informação para continuar.`;
  }
  if (placeholder && (tag === 'input' || tag === 'textarea')) {
    return `Campo de preenchimento. Exemplo ou orientação: ${placeholder}.`;
  }

  if (tag === 'select') return 'Selecione uma opção para filtrar ou preencher esta informação.';
  if (type === 'file') return 'Selecione um arquivo do computador para importar dados para o projeto.';
  if (type === 'checkbox' || element.getAttribute('role') === 'checkbox') {
    return 'Marque ou desmarque para ativar esta opção.';
  }
  if (type === 'number') return 'Informe um valor numérico válido neste campo.';
  if (tag === 'button' || element.getAttribute('role') === 'button' || element.getAttribute('role') === 'tab') {
    const action = text || value || 'esta ação';
    return `Clique para executar: ${action}.`;
  }

  return '';
}

function getPosition(element, pointer) {
  if (pointer) return { x: pointer.x, y: pointer.y };
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.bottom };
}

function clampPosition(position) {
  const width = Math.min(320, window.innerWidth - 28);
  const x = Math.max(14, Math.min(position.x, window.innerWidth - width - 14));
  const y = Math.max(14, Math.min(position.y + 12, window.innerHeight - 118));
  return { x, y, width };
}

function suppressNativeTitle(element, titleStore) {
  if (!element.hasAttribute('title')) return;
  const title = element.getAttribute('title');
  titleStore.current = { element, title };
  element.removeAttribute('title');
}

function restoreNativeTitle(titleStore) {
  const stored = titleStore.current;
  if (!stored) return;
  if (!stored.element.hasAttribute('title')) stored.element.setAttribute('title', stored.title);
  titleStore.current = null;
}

export default function ContextHelpOverlay() {
  const [help, setHelp] = useState(null);
  const activeElement = useRef(null);
  const timer = useRef(null);
  const pointer = useRef(null);
  const titleStore = useRef(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };

    const closeHelp = () => {
      clearTimer();
      activeElement.current = null;
      pointer.current = null;
      restoreNativeTitle(titleStore);
      setHelp(null);
    };

    const scheduleHelp = (element, point = null) => {
      const description = getElementHelp(element);
      if (!description) return;
      clearTimer();
      activeElement.current = element;
      pointer.current = point;
      suppressNativeTitle(element, titleStore);
      setHelp(null);
      timer.current = window.setTimeout(() => {
        if (activeElement.current !== element) return;
        setHelp({
          text: description,
          position: clampPosition(getPosition(element, pointer.current)),
        });
      }, HELP_DELAY_MS);
    };

    const getInteractiveTarget = target => {
      if (!(target instanceof Element)) return null;
      return target.closest(INTERACTIVE_SELECTOR);
    };

    const onPointerOver = event => {
      const element = getInteractiveTarget(event.target);
      if (!element || (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) return;
      scheduleHelp(element, { x: event.clientX, y: event.clientY });
    };

    const onPointerMove = event => {
      const element = activeElement.current;
      if (!element || !element.contains(event.target)) return;
      pointer.current = { x: event.clientX, y: event.clientY };
      setHelp(current => current ? { ...current, position: clampPosition(pointer.current) } : current);
    };

    const onPointerOut = event => {
      const element = activeElement.current;
      if (!element || (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) return;
      closeHelp();
    };

    const onFocusIn = event => {
      const element = getInteractiveTarget(event.target);
      if (element) scheduleHelp(element);
    };

    const onFocusOut = event => {
      const element = activeElement.current;
      if (!element || (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) return;
      closeHelp();
    };

    const onClick = event => {
      const element = getInteractiveTarget(event.target);
      if (element && element === activeElement.current) closeHelp();
    };

    document.addEventListener('pointerover', onPointerOver, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerout', onPointerOut, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('click', onClick, true);

    return () => {
      closeHelp();
      document.removeEventListener('pointerover', onPointerOver, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerout', onPointerOut, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  if (!help) return null;

  return (
    <div
      className="context-help-overlay"
      role="tooltip"
      aria-live="polite"
      style={{ left: help.position.x, top: help.position.y, width: help.position.width }}
    >
      <span className="context-help-kicker">AJUDA DE FUNÇÃO</span>
      <span className="context-help-text">{help.text}</span>
    </div>
  );
}
