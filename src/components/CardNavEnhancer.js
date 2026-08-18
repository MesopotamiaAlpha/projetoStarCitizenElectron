import { useEffect } from 'react';
import { gsap } from 'gsap';

const GROUP_SELECTOR = '.sidebar .nav-group';

function animateItems(group, mode) {
  const items = group.querySelectorAll('.nav-group-items .nav-item');
  if (!items.length || mode === 'off') return;
  gsap.fromTo(items, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: mode === 'immersive' ? 0.34 : 0.22, stagger: 0.025, ease: 'power3.out', overwrite: true });
}

export default function CardNavEnhancer({ mode = 'economic' }) {
  useEffect(() => {
    const groups = document.querySelectorAll(GROUP_SELECTOR);
    groups.forEach((group, index) => {
      group.dataset.cardNavReady = 'true';
      group.style.setProperty('--card-nav-index', index);
    });

    const onOver = event => {
      const group = event.target?.closest?.(GROUP_SELECTOR);
      if (!group || mode === 'off') return;
      const related = event.relatedTarget;
      if (related && group.contains(related)) return;
      gsap.to(group, { y: mode === 'immersive' ? -3 : -1, duration: 0.24, ease: 'power3.out', overwrite: true });
      const header = group.querySelector('.nav-group-header');
      if (header) gsap.to(header, { paddingLeft: mode === 'immersive' ? 15 : 13, duration: 0.24, ease: 'power3.out', overwrite: true });
    };
    const onOut = event => {
      const group = event.target?.closest?.(GROUP_SELECTOR);
      if (!group) return;
      const related = event.relatedTarget;
      if (related && group.contains(related)) return;
      gsap.to(group, { y: 0, duration: 0.22, ease: 'power2.out', overwrite: true });
      const header = group.querySelector('.nav-group-header');
      if (header) gsap.to(header, { paddingLeft: '', duration: 0.22, ease: 'power2.out', overwrite: true });
    };
    const onClick = event => {
      const group = event.target?.closest?.(GROUP_SELECTOR);
      if (!group || mode === 'off') return;
      const items = group.querySelector('.nav-group-items');
      if (items) animateItems(group, mode);
    };
    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        const group = node.matches?.(GROUP_SELECTOR) ? node : node.querySelector?.(GROUP_SELECTOR);
        if (group) animateItems(group, mode);
      }));
    });
    document.addEventListener('pointerover', onOver, true);
    document.addEventListener('pointerout', onOut, true);
    document.addEventListener('click', onClick, true);
    observer.observe(document.querySelector('.sidebar-nav') || document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener('pointerover', onOver, true);
      document.removeEventListener('pointerout', onOut, true);
      document.removeEventListener('click', onClick, true);
      observer.disconnect();
      groups.forEach(group => { gsap.killTweensOf(group); const header = group.querySelector('.nav-group-header'); if (header) gsap.killTweensOf(header); });
    };
  }, [mode]);

  return null;
}
