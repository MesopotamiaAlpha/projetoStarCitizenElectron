import { useEffect } from 'react';

const CARD_SELECTOR = [
  '.stat-card',
  '.dashboard-overview-card',
  '.dashboard-activity-card',
  '.dashboard-panel',
  '.armor-card',
  '.inventory-item-card',
  '.bp-queue-card',
  '.system-taxonomy-category-card',
  '.note-attachment-card',
  '.ship-card',
  '.mission-card',
  '.wikelo-card',
  '.market-alert-card',
  '.uex-card',
  '.uex-insights-panel',
  '.material-tracker-progress-card',
  '.material-tracker-help-card',
  '.materials-queue-panel',
  '.materials-list-panel',
  '.inventory-summary-card',
  '[data-border-glow-card="true"]',
].join(',');

const SECTION_COLORS = {
  dashboard: '#38bdf8',
  all: '#a78bfa',
  collection: '#a78bfa',
  inventory: '#34d399',
  blueprints: '#fbbf24',
  materials: '#22d3ee',
  mining: '#f59e0b',
  mininggroup: '#f59e0b',
  clanvault: '#fb7185',
  missions: '#4ade80',
  orevault: '#f59e0b',
  uexsales: '#fbbf24',
  uexnegotiations: '#60a5fa',
  wikelo: '#c084fc',
  uexapi: '#22d3ee',
  uexinsights: '#c084fc',
  uexalerts: '#fb923c',
  shiphangar: '#60a5fa',
};

function accentFor(card) {
  const page = card.closest('[data-active-page]')?.getAttribute('data-active-page');
  return SECTION_COLORS[page] || '#38bdf8';
}

function prepareCard(card) {
  if (!(card instanceof HTMLElement) || card.dataset.borderGlowPrepared === 'true') return;
  if (card.dataset.noBorderGlow === 'true') return;
  card.dataset.borderGlowPrepared = 'true';
  card.classList.add('border-glow-card');
  card.style.setProperty('--border-glow-color', accentFor(card));
}

function prepareAll(root = document) {
  root.querySelectorAll?.(CARD_SELECTOR).forEach(prepareCard);
}

export default function BorderGlowController({ mode = 'economic' }) {
  useEffect(() => {
    prepareAll(document);
    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches?.(CARD_SELECTOR)) prepareCard(node);
        prepareAll(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const pending = new WeakMap();
    const handleMove = event => {
      const card = event.target?.closest?.('.border-glow-card');
      if (!card || mode === 'off') return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const edgeDistance = Math.min(x, y, rect.width - x, rect.height - y);
      const intensity = Math.max(0, Math.min(1, 1 - edgeDistance / 86));
      const angle = Math.atan2(y - rect.height / 2, x - rect.width / 2) * 180 / Math.PI + 90;
      const existing = pending.get(card);
      if (existing) cancelAnimationFrame(existing);
      pending.set(card, requestAnimationFrame(() => {
        card.style.setProperty('--border-glow-x', `${x}px`);
        card.style.setProperty('--border-glow-y', `${y}px`);
        card.style.setProperty('--border-glow-angle', `${angle}deg`);
        card.style.setProperty('--border-glow-opacity', `${mode === 'immersive' ? intensity : intensity * 0.72}`);
        card.classList.toggle('border-glow-near', intensity > 0.04);
        pending.delete(card);
      }));
    };
    const handleLeave = event => {
      const card = event.target?.closest?.('.border-glow-card');
      if (!card) return;
      card.style.setProperty('--border-glow-opacity', '0');
      card.classList.remove('border-glow-near');
    };
    document.addEventListener('pointermove', handleMove, { passive: true });
    document.addEventListener('pointerout', handleLeave, { passive: true });
    return () => {
      observer.disconnect();
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerout', handleLeave);
      document.querySelectorAll('.border-glow-card').forEach(card => {
        card.classList.remove('border-glow-card', 'border-glow-near');
        card.removeAttribute('data-border-glow-prepared');
        card.style.removeProperty('--border-glow-color');
        card.style.removeProperty('--border-glow-x');
        card.style.removeProperty('--border-glow-y');
        card.style.removeProperty('--border-glow-angle');
        card.style.removeProperty('--border-glow-opacity');
      });
    };
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.borderGlowMode = mode;
    document.querySelectorAll('.border-glow-card').forEach(card => {
      card.style.setProperty('--border-glow-opacity', '0');
      card.classList.toggle('border-glow-disabled', mode === 'off');
    });
  }, [mode]);

  return null;
}

export { CARD_SELECTOR };
