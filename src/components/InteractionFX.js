import { useEffect } from 'react';

const INTERACTIVE_SELECTOR = 'button, a, [role="button"], input[type="checkbox"], input[type="radio"]';

export default function InteractionFX({ allowMotion = false }) {
  useEffect(() => {
    let lastSpark = 0;
    function handleClick(event) {
      if (!allowMotion && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const target = event.target?.closest?.(INTERACTIVE_SELECTOR);
      if (!target || target.disabled || target.dataset.noSpark === 'true') return;
      const now = performance.now();
      if (now - lastSpark < 85) return;
      lastSpark = now;

      const spark = document.createElement('span');
      spark.className = 'interaction-spark';
      spark.style.left = `${event.clientX}px`;
      spark.style.top = `${event.clientY}px`;
      document.body.appendChild(spark);
      window.setTimeout(() => spark.remove(), 620);
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [allowMotion]);

  return null;
}
