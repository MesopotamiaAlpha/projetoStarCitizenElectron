import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bug, Clipboard, Download, RefreshCw, X, CheckCircle2, AlertTriangle } from 'lucide-react';

const ERROR_KEY = '__EMOTO_VISUAL_ERRORS__';

function getStoredErrors() {
  try { return Array.isArray(window[ERROR_KEY]) ? window[ERROR_KEY].slice(-30) : []; } catch { return []; }
}

function safeStorage(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

const LAYOUT_TARGET_SELECTOR = [
  '.stat-card', '.dashboard-mini-metric', '.dashboard-overview-card', '.dashboard-activity-card', '.dashboard-chart-card',
  '.armor-card', '.inventory-item-card', '.blueprint-card', '.material-tracker-row', '.bp-queue-card',
  '.mission-card-responsive', '.hangar-vehicle-card', '.hangar-owned-card', '.notes-card', '.note-card',
  '.clan-vault-card', '.ore-card', '.uex-insights-card', '.market-alert-group-card', '.useful-link-card',
].join(',');

function layoutSnapshot(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const children = Array.from(element.children).slice(0, 8).map((child, index) => {
    const childRect = child.getBoundingClientRect();
    const childStyle = getComputedStyle(child);
    return {
      index,
      tagName: child.tagName,
      className: String(child.className || ''),
      x: Number(childRect.x.toFixed(2)),
      y: Number(childRect.y.toFixed(2)),
      width: Number(childRect.width.toFixed(2)),
      height: Number(childRect.height.toFixed(2)),
      transform: childStyle.transform,
    };
  });
  return {
    tagName: element.tagName,
    className: String(element.className || ''),
    text: String(element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120),
    rect: { x: Number(rect.x.toFixed(2)), y: Number(rect.y.toFixed(2)), width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) },
    scroll: { clientWidth: element.clientWidth, clientHeight: element.clientHeight, scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight },
    overflow: { horizontal: element.scrollWidth > element.clientWidth + 1, vertical: element.scrollHeight > element.clientHeight + 1 },
    computed: { display: style.display, position: style.position, transform: style.transform, transition: style.transition, overflow: style.overflow, overflowX: style.overflowX, overflowY: style.overflowY },
    children,
  };
}

function inspectGraphics() {
  const canvas = document.createElement('canvas');
  let webgl = false;
  let webgl2 = false;
  try { webgl = !!canvas.getContext('webgl'); } catch {}
  try { webgl2 = !!canvas.getContext('webgl2'); } catch {}
  return { webgl, webgl2 };
}

export function collectVisualEffectsDiagnostics({ mode, activePage }) {
  const layer = document.querySelector('[data-visual-effects]');
  const stars = layer ? layer.querySelectorAll('.visual-effects-star') : [];
  const animated = document.querySelector('.animated-content');
  const layerStyle = layer ? getComputedStyle(layer) : null;
  const rect = layer?.getBoundingClientRect?.();
  const graphics = inspectGraphics();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const profileSelector = '.inventory-item-card, .hangar-vehicle-card, .hangar-owned-card, .hangar-vehicle-list-row, .hangar-owned-list-row';
  const profileCards = Array.from(document.querySelectorAll(profileSelector));
  const preparedProfileCards = profileCards.filter(card => card.classList.contains('glare-profile-card'));
  const activeProfileCards = profileCards.filter(card => card.classList.contains('glare-profile-active'));
  const sampleProfileCard = activeProfileCards[0] || preparedProfileCards[0] || profileCards[0] || null;
  const sampleProfileStyle = sampleProfileCard ? getComputedStyle(sampleProfileCard) : null;
  const profileDebug = (() => { try { return window.__EMOTO_PROFILE_DEBUG__ || null; } catch { return null; } })();
  const layoutDebug = (() => { try { return window.__EMOTO_LAYOUT_DEBUG__ || null; } catch { return null; } })();
  const calculatorPanel = document.querySelector('.calculator-magic-bento');
  const calculatorKeypad = document.querySelector('.calculator-bento-keypad');
  const calculatorButtons = calculatorKeypad ? Array.from(calculatorKeypad.querySelectorAll('.calculator-bento-action')) : [];
  const calculatorDebug = (() => { try { return window.__EMOTO_CALCULATOR_DEBUG__ || null; } catch { return null; } })();
  const calculatorPanelStyle = calculatorPanel ? getComputedStyle(calculatorPanel) : null;
  const calculatorKeypadStyle = calculatorKeypad ? getComputedStyle(calculatorKeypad) : null;
  const version = document.querySelector('.version-badge')?.textContent?.trim() || 'não encontrado';
  const diagnostics = {
    generatedAt: new Date().toISOString(),
    application: {
      version,
      url: window.location.href,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
      screen: { width: window.screen?.width, height: window.screen?.height },
    },
    visualState: {
      mode,
      activePage,
      savedMode: safeStorage('companheiro_emoto_visual_mode_v2'),
      reducedMotion,
      internalMotionOverride: mode !== 'off',
      documentVisibility: document.visibilityState,
    },
    visualLayer: {
      exists: !!layer,
      tagName: layer?.tagName || null,
      className: layer?.className || null,
      dataMode: layer?.getAttribute('data-visual-effects') || null,
      starCount: stars.length,
      effectiveVisible: !!layer && layerStyle?.display !== 'none' && !!rect && rect.width > 0 && rect.height > 0,
      rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      computed: layerStyle ? {
        display: layerStyle.display,
        visibility: layerStyle.visibility,
        opacity: layerStyle.opacity,
        zIndex: layerStyle.zIndex,
        position: layerStyle.position,
        pointerEvents: layerStyle.pointerEvents,
        animationName: layerStyle.animationName,
        animationPlayState: layerStyle.animationPlayState,
      } : null,
    },
    layoutStability: layoutDebug,
    calculator: {
      panelExists: !!calculatorPanel,
      keypadExists: !!calculatorKeypad,
      buttonCount: calculatorButtons.length,
      panelVisible: !!calculatorPanel && calculatorPanelStyle?.display !== 'none' && calculatorPanelStyle?.visibility !== 'hidden',
      spotlightBehindKeypad: calculatorDebug?.spotlightBehindKeypad === true,
      spotlightVariables: calculatorKeypad ? {
        x: calculatorKeypad.style.getPropertyValue('--key-spotlight-x') || null,
        y: calculatorKeypad.style.getPropertyValue('--key-spotlight-y') || null,
      } : null,
      magnetism: calculatorDebug?.magnetism === true,
      tilt: calculatorDebug?.tilt === true,
      clickEffect: calculatorDebug?.clickEffect === true,
      debugState: calculatorDebug,
      panelComputed: calculatorPanelStyle ? {
        display: calculatorPanelStyle.display,
        opacity: calculatorPanelStyle.opacity,
        zIndex: calculatorPanelStyle.zIndex,
        transform: calculatorPanelStyle.transform,
      } : null,
      keypadComputed: calculatorKeypadStyle ? {
        position: calculatorKeypadStyle.position,
        isolation: calculatorKeypadStyle.isolation,
        overflow: calculatorKeypadStyle.overflow,
        backgroundImage: calculatorKeypadStyle.backgroundImage,
      } : null,
    },
    contextualSpotlight: {
      enabled: mode !== 'off',
      activeTargets: document.querySelectorAll('.contextual-spotlight-target').length,
      spotlightNodes: document.querySelectorAll('.contextual-spotlight').length,
    },
    profileCard: {
      selector: profileSelector,
      countsByType: {
        inventory: document.querySelectorAll('.inventory-item-card').length,
        hangarCatalog: document.querySelectorAll('.hangar-vehicle-card').length,
        hangarOwnedCards: document.querySelectorAll('.hangar-owned-card').length,
        hangarCatalogRows: document.querySelectorAll('.hangar-vehicle-list-row').length,
        hangarOwnedRows: document.querySelectorAll('.hangar-owned-list-row').length,
      },
      totalCards: profileCards.length,
      preparedCards: preparedProfileCards.length,
      activeCards: activeProfileCards.length,
      sample: sampleProfileCard ? {
        tagName: sampleProfileCard.tagName,
        className: sampleProfileCard.className,
        rect: (() => { const r = sampleProfileCard.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
        transform: sampleProfileStyle?.transform || null,
        transformStyle: sampleProfileStyle?.transformStyle || null,
        perspective: sampleProfileStyle?.perspective || null,
        transition: sampleProfileStyle?.transition || null,
        pointerEvents: sampleProfileStyle?.pointerEvents || null,
        overflow: sampleProfileStyle?.overflow || null,
        rotateX: sampleProfileCard.style.getPropertyValue('--profile-rotate-x') || null,
        rotateY: sampleProfileCard.style.getPropertyValue('--profile-rotate-y') || null,
        inlineTransform: sampleProfileCard.style.transform || null,
        inlineTransformOrigin: sampleProfileCard.style.transformOrigin || null,
        inlineWillChange: sampleProfileCard.style.willChange || null,
        depthApplied: Boolean(sampleProfileCard.style.transform && sampleProfileCard.style.transform.includes('perspective') && sampleProfileCard.style.transform.includes('translateZ')),
        pointerTargetActive: sampleProfileCard.classList.contains('glare-profile-active'),
        glareOpacity: sampleProfileStyle ? getComputedStyle(sampleProfileCard, '::before').opacity : null,
      } : null,
      controller: profileDebug,
    },
    pageAnimation: {
      exists: !!animated,
      className: animated?.className || null,
      computed: animated ? (() => { const s = getComputedStyle(animated); return { opacity: s.opacity, transform: s.transform, animationName: s.animationName, transition: s.transition }; })() : null,
    },
    capabilities: {
      ...graphics,
      cssAnimations: typeof window.CSS !== 'undefined' && CSS.supports?.('animation-name: emoto-star-float') === true,
      intersectionObserver: 'IntersectionObserver' in window,
      requestAnimationFrame: 'requestAnimationFrame' in window,
      clipboard: !!navigator.clipboard,
      downloadBlob: typeof Blob !== 'undefined' && typeof URL?.createObjectURL === 'function',
    },
    errors: getStoredErrors(),
  };
  return diagnostics;
}

export default function VisualEffectsDiagnostics({ mode, activePage }) {
  const [open, setOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!window[ERROR_KEY]) window[ERROR_KEY] = [];
    const pushError = (type, value) => {
      try {
        window[ERROR_KEY].push({ at: new Date().toISOString(), type, value: String(value?.message || value || 'erro desconhecido') });
        window[ERROR_KEY] = window[ERROR_KEY].slice(-30);
      } catch {}
    };
    const onError = event => pushError('window.error', event.error || event.message);
    const onRejection = event => pushError('unhandledrejection', event.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);

  useEffect(() => {
    const timers = new Set();
    const state = {
      initialized: true,
      selector: LAYOUT_TARGET_SELECTOR,
      events: [],
      lastTarget: null,
      lastComparison: null,
      updatedAt: new Date().toISOString(),
    };
    window.__EMOTO_LAYOUT_DEBUG__ = state;

    const compare = (before, after, phase) => {
      if (!before || !after) return;
      const cardDelta = {
        x: Number((after.rect.x - before.rect.x).toFixed(2)),
        y: Number((after.rect.y - before.rect.y).toFixed(2)),
        width: Number((after.rect.width - before.rect.width).toFixed(2)),
        height: Number((after.rect.height - before.rect.height).toFixed(2)),
      };
      const childDeltas = after.children.map((child, index) => {
        const previous = before.children[index];
        if (!previous) return { index, missingBefore: true };
        return {
          index,
          className: child.className,
          x: Number((child.x - previous.x).toFixed(2)),
          y: Number((child.y - previous.y).toFixed(2)),
          width: Number((child.width - previous.width).toFixed(2)),
          height: Number((child.height - previous.height).toFixed(2)),
          transformBefore: previous.transform,
          transformAfter: child.transform,
        };
      });
      const largestChildMove = childDeltas.reduce((max, item) => Math.max(max, Math.abs(item.x || 0), Math.abs(item.y || 0)), 0);
      const stable = Math.abs(cardDelta.x) < 0.75 && Math.abs(cardDelta.y) < 0.75 && Math.abs(cardDelta.width) < 0.75 && Math.abs(cardDelta.height) < 0.75 && largestChildMove < 0.75 && !after.overflow.horizontal && !after.overflow.vertical;
      const comparison = {
        phase,
        stable,
        target: after.className,
        targetText: after.text,
        cardDelta,
        largestChildMove: Number(largestChildMove.toFixed(2)),
        overflowAfter: after.overflow,
        before: { rect: before.rect, computed: before.computed, children: before.children },
        after: { rect: after.rect, computed: after.computed, children: after.children },
        at: new Date().toISOString(),
      };
      state.lastTarget = after;
      state.lastComparison = comparison;
      state.events = [...state.events, comparison].slice(-20);
      state.updatedAt = comparison.at;
    };

    const handleOver = event => {
      const card = event.target?.closest?.(LAYOUT_TARGET_SELECTOR);
      if (!card || event.relatedTarget && card.contains(event.relatedTarget)) return;
      const before = layoutSnapshot(card);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        compare(before, layoutSnapshot(card), 'after-hover-160ms');
      }, 160);
      timers.add(timer);
    };

    const handleOut = event => {
      const card = event.target?.closest?.(LAYOUT_TARGET_SELECTOR);
      if (!card || event.relatedTarget && card.contains(event.relatedTarget)) return;
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        const after = layoutSnapshot(card);
        if (state.lastComparison?.target === after?.className) {
          state.lastComparison = { ...state.lastComparison, afterLeave: after, leaveTransform: after?.computed?.transform, at: new Date().toISOString() };
          state.updatedAt = state.lastComparison.at;
        }
      }, 180);
      timers.add(timer);
    };

    document.addEventListener('pointerover', handleOver, { passive: true });
    document.addEventListener('pointerout', handleOut, { passive: true });
    return () => {
      document.removeEventListener('pointerover', handleOver);
      document.removeEventListener('pointerout', handleOut);
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
      state.initialized = false;
      state.updatedAt = new Date().toISOString();
    };
  }, []);

  const refresh = useCallback(() => setDiagnostics(collectVisualEffectsDiagnostics({ mode, activePage })), [mode, activePage]);
  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  const text = useMemo(() => diagnostics ? JSON.stringify(diagnostics, null, 2) : '', [diagnostics]);

  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const area = document.createElement('textarea');
      area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    }
  };

  const downloadLog = () => {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `companheiro-emoto-efeitos-${Date.now()}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  return (
    <>
      <button className="visual-diagnostics-trigger" type="button" onClick={() => setOpen(true)} title="Diagnosticar efeitos visuais" aria-label="Diagnosticar efeitos visuais">
        <Bug size={13} /> <span>Diagnóstico FX</span>
      </button>
      {open && createPortal(
        <div className="visual-diagnostics-backdrop" role="dialog" aria-modal="true" aria-label="Diagnóstico dos efeitos visuais">
          <div className="visual-diagnostics-panel">
            <div className="visual-diagnostics-header">
              <div><strong><Bug size={16} /> Diagnóstico de Efeitos 2.0</strong><small>Coleta somente informações técnicas locais; nenhum dado do inventário é incluído.</small></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar diagnóstico"><X size={17} /></button>
            </div>
            {diagnostics && (
              <div className="visual-diagnostics-summary">
                <span className={diagnostics.visualLayer.effectiveVisible ? 'diag-ok' : 'diag-fail'}>{diagnostics.visualLayer.effectiveVisible ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} Camada: {diagnostics.visualLayer.effectiveVisible ? 'visível' : 'oculta'}</span>
                <span className={diagnostics.visualLayer.starCount > 0 ? 'diag-ok' : 'diag-fail'}>Estrelas: {diagnostics.visualLayer.starCount}</span>
                <span>Modo: {diagnostics.visualState.mode}</span>
                <span>CSS: {diagnostics.capabilities.cssAnimations ? 'suportado' : 'não detectado'}</span>
                <span className={diagnostics.profileCard?.preparedCards > 0 ? 'diag-ok' : 'diag-fail'}>3D: {diagnostics.profileCard?.preparedCards || 0}/{diagnostics.profileCard?.totalCards || 0}</span>
                <span className={diagnostics.calculator?.panelVisible ? 'diag-ok' : 'diag-fail'}>Calculadora: {diagnostics.calculator?.panelVisible ? `${diagnostics.calculator.buttonCount} teclas` : 'fechada'}</span>
                <span className={diagnostics.layoutStability?.lastComparison?.stable ? 'diag-ok' : diagnostics.layoutStability?.lastComparison ? 'diag-fail' : ''}>Layout: {diagnostics.layoutStability?.lastComparison ? (diagnostics.layoutStability.lastComparison.stable ? 'estável' : 'deslocamento detectado') : 'passe o mouse em um card'}</span>
                <span className={diagnostics.calculator?.spotlightBehindKeypad && diagnostics.calculator?.magnetism && diagnostics.calculator?.tilt && diagnostics.calculator?.clickEffect ? 'diag-ok' : 'diag-fail'}>Bento: {diagnostics.calculator?.spotlightBehindKeypad && diagnostics.calculator?.magnetism && diagnostics.calculator?.tilt && diagnostics.calculator?.clickEffect ? 'ativo' : 'verificar'}</span>
                <span className={diagnostics.contextualSpotlight?.enabled ? 'diag-ok' : 'diag-fail'}>Spotlight global: {diagnostics.contextualSpotlight?.enabled ? `${diagnostics.contextualSpotlight.activeTargets} alvo(s)` : 'desligado'}</span>
              </div>
            )}
            <pre className="visual-diagnostics-log">{text || 'Clique em Atualizar diagnóstico.'}</pre>
            <div className="visual-diagnostics-actions">
              <button type="button" onClick={refresh}><RefreshCw size={14} /> Atualizar</button>
              <button type="button" onClick={copyLog} disabled={!text}><Clipboard size={14} /> {copied ? 'Copiado' : 'Copiar log'}</button>
              <button type="button" onClick={downloadLog} disabled={!text}><Download size={14} /> Baixar arquivo</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
