import React, { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Ticker } from 'pixi.js';

const MODE_CONFIG = {
  off: { stars: 0, speed: 0, alpha: 0 },
  economic: { stars: 70, speed: 0.12, alpha: 0.52 },
  immersive: { stars: 150, speed: 0.2, alpha: 0.78 },
};

const PAGE_ACCENTS = {
  dashboard: 0x38bdf8,
  uexsales: 0xfbbf24,
  uexinsights: 0xa78bfa,
  uexalerts: 0xfb923c,
  missions: 0x34d399,
  materials: 0x22d3ee,
  inventory: 0x38bdf8,
};

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createStar(accent, width, height) {
  const star = new Graphics();
  const radius = randomBetween(0.45, 1.35);
  star.circle(0, 0, radius).fill({ color: accent, alpha: randomBetween(0.28, 0.95) });
  star.x = Math.random() * width;
  star.y = Math.random() * height;
  star.alpha = randomBetween(0.35, 0.95);
  star.rotation = Math.random() * Math.PI;
  star._emotoVelocity = randomBetween(0.35, 1.15);
  star._emotoDrift = randomBetween(-0.08, 0.08);
  return star;
}

function drawHudLayer(container, accent, width, height, alpha) {
  const hud = new Container();
  hud.alpha = alpha;

  const topLine = new Graphics();
  topLine.moveTo(0, Math.min(92, height * 0.18)).lineTo(width, Math.min(92, height * 0.18)).stroke({ color: accent, alpha: 0.07, width: 1 });
  hud.addChild(topLine);

  const bottomLine = new Graphics();
  bottomLine.moveTo(0, Math.max(0, height - 62)).lineTo(width, Math.max(0, height - 62)).stroke({ color: accent, alpha: 0.05, width: 1 });
  hud.addChild(bottomLine);

  const reticle = new Graphics();
  const cx = width * 0.82;
  const cy = height * 0.18;
  reticle.circle(cx, cy, 28).stroke({ color: accent, alpha: 0.10, width: 1 });
  reticle.circle(cx, cy, 39).stroke({ color: accent, alpha: 0.045, width: 1 });
  reticle.moveTo(cx - 52, cy).lineTo(cx - 18, cy).stroke({ color: accent, alpha: 0.08, width: 1 });
  reticle.moveTo(cx + 18, cy).lineTo(cx + 52, cy).stroke({ color: accent, alpha: 0.08, width: 1 });
  reticle.moveTo(cx, cy - 52).lineTo(cx, cy - 18).stroke({ color: accent, alpha: 0.08, width: 1 });
  reticle.moveTo(cx, cy + 18).lineTo(cx, cy + 52).stroke({ color: accent, alpha: 0.08, width: 1 });
  hud.addChild(reticle);

  const scan = new Graphics();
  scan.rect(0, 0, Math.max(width, 1), 2).fill({ color: accent, alpha: 0.055 });
  scan.y = Math.min(110, height * 0.22);
  scan._emotoScan = true;
  hud.addChild(scan);

  container.addChild(hud);
  return { hud, scan };
}

export function PixiVisualLayer({ mode = 'economic', activePage = 'dashboard' }) {
  const hostRef = useRef(null);
  const appRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    const config = MODE_CONFIG[mode] || MODE_CONFIG.economic;
    if (!host || config.stars === 0) return undefined;

    const app = new Application();
    let animationTicker = null;
    appRef.current = app;

    (async () => {
      try {
        await app.init({
          resizeTo: host,
          backgroundAlpha: 0,
          antialias: false,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 1.5),
          preference: 'webgl',
          powerPreference: 'low-power',
          autoStart: false,
        });
        if (disposed) {
          app.destroy(true);
          return;
        }

        host.appendChild(app.canvas);
        app.canvas.setAttribute('aria-hidden', 'true');
        app.canvas.className = 'pixi-visual-canvas';

        const accent = PAGE_ACCENTS[activePage] || 0x38bdf8;
        const width = Math.max(host.clientWidth, 1);
        const height = Math.max(host.clientHeight, 1);
        const scene = new Container();
        scene.alpha = config.alpha;
        app.stage.addChild(scene);

        const nebula = new Graphics();
        nebula.circle(width * 0.78, height * 0.18, Math.min(width, height) * 0.23).fill({ color: accent, alpha: 0.022 });
        nebula.circle(width * 0.14, height * 0.82, Math.min(width, height) * 0.30).fill({ color: 0x6366f1, alpha: 0.018 });
        scene.addChild(nebula);

        const stars = new Container();
        for (let index = 0; index < config.stars; index += 1) {
          stars.addChild(createStar(accent, width, height));
        }
        scene.addChild(stars);

        const hud = drawHudLayer(scene, accent, width, height, mode === 'immersive' ? 1 : 0.68);
        animationTicker = new Ticker();
        animationTicker.maxFPS = mode === 'immersive' ? 36 : 24;
        animationTicker.add((ticker) => {
          const delta = Math.min(ticker.deltaTime, 2);
          stars.children.forEach(star => {
            star.y += config.speed * star._emotoVelocity * delta;
            star.x += star._emotoDrift * delta;
            if (star.y > height + 4) star.y = -4;
            if (star.x > width + 4) star.x = -4;
            if (star.x < -4) star.x = width + 4;
            star.alpha += Math.sin((performance.now() / 900) + star.x) * 0.0015;
          });
          hud.scan.y += config.speed * 2.2 * delta;
          if (hud.scan.y > height) hud.scan.y = -3;
        });
        animationTicker.start();
      } catch (error) {
        console.warn('PixiJS visual layer disabled:', error);
      }
    })();

    return () => {
      disposed = true;
      if (animationTicker) {
        try { animationTicker.stop(); animationTicker.destroy(); } catch { /* ticker já pode ter sido destruído */ }
        animationTicker = null;
      }
      if (appRef.current) {
        try { appRef.current.destroy(true); } catch { /* renderer já pode ter sido destruído */ }
        appRef.current = null;
      }
      if (host) host.replaceChildren();
    };
  }, [mode, activePage]);

  return <div ref={hostRef} className={`pixi-visual-layer pixi-mode-${mode}`} aria-hidden="true" />;
}
