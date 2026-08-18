import React, { useMemo } from 'react';

const MODE_CONFIG = {
  off: { count: 0, opacity: 0 },
  economic: { count: 42, opacity: 0.82 },
  immersive: { count: 86, opacity: 1 },
};

const PAGE_ACCENTS = {
  dashboard: '#38bdf8',
  uexsales: '#fbbf24',
  uexinsights: '#a78bfa',
  uexalerts: '#fb923c',
  missions: '#34d399',
  materials: '#22d3ee',
  inventory: '#38bdf8',
};

export default function VisualEffectsLayer({ mode = 'economic', activePage = 'dashboard' }) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.economic;
  const accent = PAGE_ACCENTS[activePage] || PAGE_ACCENTS.dashboard;
  const stars = useMemo(() => Array.from({ length: 86 }, (_, index) => ({
    id: index,
    left: `${(index * 47 + 13) % 100}%`,
    top: `${(index * 71 + 19) % 100}%`,
    size: `${index % 11 === 0 ? 3 : index % 4 === 0 ? 2 : 1}px`,
    duration: `${10 + (index % 9) * 1.8}s`,
    delay: `${(index % 13) * -0.85}s`,
    drift: `${((index % 7) - 3) * 7}px`,
    color: index % 9 === 0 ? '#fbbf24' : index % 5 === 0 ? '#a78bfa' : accent,
  })), [accent]);

  return (
    <div
      className={`visual-effects-layer visual-effects-${mode}`}
      data-visual-effects={mode}
      style={{ '--visual-accent': accent, '--visual-opacity': config.opacity }}
      aria-hidden="true"
    >
      {stars.slice(0, config.count).map(star => (
        <span
          key={star.id}
          className="visual-effects-star"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            background: star.color,
            boxShadow: `0 0 8px ${star.color}`,
            animationDuration: star.duration,
            animationDelay: star.delay,
            '--star-drift': star.drift,
          }}
        />
      ))}
      <span className="visual-effects-corner visual-effects-corner-top" />
      <span className="visual-effects-corner visual-effects-corner-bottom" />
    </div>
  );
}
