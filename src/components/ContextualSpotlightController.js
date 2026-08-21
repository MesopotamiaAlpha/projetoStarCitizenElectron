import { useEffect } from 'react';

const TARGET_SELECTOR = [
  'button:not([disabled])',
  '[role="button"]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '.border-glow-card',
  '[data-spotlight="true"]',
].join(',');

function isIgnored(element) {
  return !element || element.closest?.('.visual-diagnostics-backdrop, .calculator-magic-bento') || element.classList?.contains('contextual-spotlight-ignore');
}

export default function ContextualSpotlightController({ mode = 'economic' }) {
  useEffect(() => {
    const state = { current: null, frame: 0, x: 0, y: 0 };
    const enabled = mode !== 'off';

    const removeTarget = target => {
      if (!target) return;
      target.classList.remove('contextual-spotlight-target');
      target.querySelector(':scope > .contextual-spotlight')?.remove();
    };

    const setTarget = target => {
      if (!enabled || isIgnored(target)) return;
      if (state.current === target) return;
      removeTarget(state.current);
      state.current = target;
      target.classList.add('contextual-spotlight-target');
      if (!target.querySelector(':scope > .contextual-spotlight')) {
        const spotlight = document.createElement('span');
        spotlight.className = 'contextual-spotlight';
        spotlight.setAttribute('aria-hidden', 'true');
        target.prepend(spotlight);
      }
    };

    const updatePosition = () => {
      state.frame = 0;
      const target = state.current;
      if (!target || !target.isConnected || typeof target.getBoundingClientRect !== 'function') {
        state.current = null;
        return;
      }
      const rect = target.getBoundingClientRect();
      const spotlight = target.querySelector(':scope > .contextual-spotlight');
      if (!spotlight || !rect.width || !rect.height) return;
      spotlight.style.removeProperty('left');
      spotlight.style.removeProperty('top');
      target.style.setProperty('--contextual-spotlight-x', `${state.x - rect.left}px`);
      target.style.setProperty('--contextual-spotlight-y', `${state.y - rect.top}px`);
      target.style.setProperty('--contextual-spotlight-opacity', mode === 'immersive' ? '0.42' : '0.30');
    };

    const handlePointerMove = event => {
      if (!enabled) return;
      const target = event.target?.closest?.(TARGET_SELECTOR);
      if (!target || !target.isConnected || isIgnored(target)) {
        removeTarget(state.current);
        state.current = null;
        return;
      }
      setTarget(target);
      state.x = event.clientX;
      state.y = event.clientY;
      if (!state.frame) state.frame = requestAnimationFrame(updatePosition);
    };

    const handlePointerOut = event => {
      const target = event.target?.closest?.(TARGET_SELECTOR);
      const next = event.relatedTarget;
      if (target && target.isConnected && (!next || !target.contains(next))) {
        removeTarget(target);
        if (state.current === target) state.current = null;
      }
    };

    if (enabled) {
      document.addEventListener('pointermove', handlePointerMove, { passive: true });
      document.addEventListener('pointerout', handlePointerOut, { passive: true });
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerout', handlePointerOut);
      if (state.frame) cancelAnimationFrame(state.frame);
      removeTarget(state.current);
    };
  }, [mode]);

  return null;
}
