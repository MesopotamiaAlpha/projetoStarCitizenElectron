import { useEffect } from 'react';
import { ENABLE_PROFILE_DEBUG } from '../config/debugFlags';

const PROFILE_SELECTOR = '.inventory-item-card, .hangar-vehicle-card, .hangar-owned-card, .hangar-vehicle-list-row, .hangar-owned-list-row';
const CARD_SELECTOR = PROFILE_SELECTOR;

function getDebug() {
  if (!ENABLE_PROFILE_DEBUG || typeof window === 'undefined') return null;
  if (!window.__EMOTO_PROFILE_DEBUG__) {
    window.__EMOTO_PROFILE_DEBUG__ = {
      initialized: false,
      mode: null,
      selector: PROFILE_SELECTOR,
      prepareCalls: 0,
      preparedCards: 0,
      pointerMoveEvents: 0,
      pointerOutEvents: 0,
      activeCards: 0,
      lastCard: null,
      lastError: null,
      lastUpdatedAt: null,
    };
  }
  return window.__EMOTO_PROFILE_DEBUG__;
}

function prepare(card) {
  if (!(card instanceof HTMLElement) || card.dataset.glareProfileReady === 'true') return;
  const debug = getDebug();
  if (debug) {
    debug.prepareCalls += 1;
    debug.preparedCards += 1;
    debug.lastUpdatedAt = new Date().toISOString();
  }
  card.dataset.glareProfileReady = 'true';
  card.classList.add('glare-profile-card');
}

function prepareAll(root = document) {
  root.querySelectorAll?.(CARD_SELECTOR).forEach(prepare);
}

export default function GlareProfileController({ mode = 'economic' }) {
  useEffect(() => {
    const debug = getDebug();
    if (debug) {
      debug.initialized = true;
      debug.mode = mode;
      debug.selector = PROFILE_SELECTOR;
      debug.lastError = null;
      debug.lastUpdatedAt = new Date().toISOString();
    }
    prepareAll(document);
    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches?.(CARD_SELECTOR)) prepare(node);
        prepareAll(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const pending = new WeakMap();
    const handleMove = event => {
      const debug = getDebug();
      if (debug) {
        debug.pointerMoveEvents += 1;
        debug.lastUpdatedAt = new Date().toISOString();
      }
      const card = event.target?.closest?.(CARD_SELECTOR);
      if (!card || mode === 'off') return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const px = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const py = Math.max(0, Math.min(100, (y / rect.height) * 100));
      const tiltEnabled = card.matches(PROFILE_SELECTOR);
      const isInventoryCard = card.matches('.inventory-item-card');
      const isHangarCard = card.matches('.hangar-vehicle-card, .hangar-owned-card, .hangar-vehicle-list-row, .hangar-owned-list-row');
      const profileIntensityCard = isInventoryCard || isHangarCard;
      const maxTilt = mode === 'immersive'
        ? (profileIntensityCard ? 4.6 : 3.8)
        : (profileIntensityCard ? 2.4 : 2.0);
      const lift = mode === 'immersive' ? (profileIntensityCard ? 9 : 7) : (profileIntensityCard ? 4 : 3);
      const scale = mode === 'immersive' ? (profileIntensityCard ? 1.018 : 1.014) : 1.008;
      const rotateY = ((px - 50) / 50) * maxTilt;
      const rotateX = ((50 - py) / 50) * maxTilt;
      const existing = pending.get(card);
      if (existing) cancelAnimationFrame(existing);
      pending.set(card, requestAnimationFrame(() => {
        card.style.setProperty('--glare-x', `${px}%`);
        card.style.setProperty('--glare-y', `${py}%`);
        if (tiltEnabled) {
          card.style.setProperty('--profile-rotate-x', `${rotateX}deg`);
          card.style.setProperty('--profile-rotate-y', `${rotateY}deg`);
          card.style.setProperty('--profile-lift', `${lift}px`);
          card.style.setProperty('--profile-scale', `${scale}`);
          // Transformação inline: impede que regras globais de media query ou hover anulem o 3D.
          card.style.transformStyle = 'preserve-3d';
          card.style.transformOrigin = 'center center';
          card.style.willChange = 'transform';
          card.style.transform = `perspective(900px) translateZ(${lift}px) scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        }
        card.classList.add('glare-profile-active');
        const state = getDebug();
        if (state) {
          state.activeCards = document.querySelectorAll('.glare-profile-card.glare-profile-active').length;
          const computed = getComputedStyle(card);
          state.lastCard = {
            className: card.className,
            tagName: card.tagName,
            width: rect.width,
            height: rect.height,
            rotateX: card.style.getPropertyValue('--profile-rotate-x'),
            rotateY: card.style.getPropertyValue('--profile-rotate-y'),
            transform: computed.transform,
            effectiveTransform: card.style.transform || computed.transform,
            computedTransformStyle: computed.transformStyle,
            computedPerspective: computed.perspective,
            inlineTransform: card.style.transform,
            inlineTransformOrigin: card.style.transformOrigin,
            inlineWillChange: card.style.willChange,
            depthApplied: card.style.transform.includes('perspective') && card.style.transform.includes('translateZ') && computed.transform !== 'none',
            pointerType: event.pointerType || 'unknown',
            pointer: { clientX: event.clientX, clientY: event.clientY, px, py },
            at: new Date().toISOString(),
          };
        }
        pending.delete(card);
      }));
    };
    const reset = event => {
      const debug = getDebug();
      if (debug) {
        debug.pointerOutEvents += 1;
        debug.lastUpdatedAt = new Date().toISOString();
      }
      const card = event.target?.closest?.(CARD_SELECTOR);
      if (!card) return;
      const related = event.relatedTarget;
      if (related && card.contains(related)) return;
      card.style.setProperty('--profile-rotate-x', '0deg');
      card.style.setProperty('--profile-rotate-y', '0deg');
      card.style.setProperty('--profile-lift', '0px');
      card.style.setProperty('--profile-scale', '1');
      card.style.transform = '';
      card.style.transformOrigin = '';
      card.style.willChange = '';
      card.classList.remove('glare-profile-active');
    };
    document.addEventListener('pointermove', handleMove, { passive: true });
    document.addEventListener('pointerout', reset, { passive: true });
    return () => {
      const state = getDebug();
      if (state) {
        state.initialized = false;
        state.activeCards = 0;
        state.lastUpdatedAt = new Date().toISOString();
      }
      observer.disconnect();
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerout', reset);
      document.querySelectorAll('.glare-profile-card').forEach(card => {
        card.classList.remove('glare-profile-card', 'glare-profile-active');
        card.removeAttribute('data-glare-profile-ready');
        card.style.removeProperty('--glare-x');
        card.style.removeProperty('--glare-y');
        card.style.removeProperty('--profile-rotate-x');
        card.style.removeProperty('--profile-rotate-y');
        card.style.removeProperty('transform');
        card.style.removeProperty('transform-origin');
        card.style.removeProperty('will-change');
      });
    };
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.glareProfileMode = mode;
    const debug = getDebug();
    if (debug) {
      debug.mode = mode;
      debug.lastUpdatedAt = new Date().toISOString();
    }
    document.querySelectorAll('.glare-profile-card').forEach(card => card.classList.toggle('glare-profile-disabled', mode === 'off'));
  }, [mode]);

  return null;
}
