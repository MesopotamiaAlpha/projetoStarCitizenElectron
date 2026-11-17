import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export default function AnimatedContent({
  children,
  className = '',
  direction = 'vertical',
  distance = 22,
  duration = 0.55,
  delay = 0,
  threshold = 0.08,
  once = true,
  allowMotion = false,
}) {
  const ref = useRef(null);
  const playedRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (!allowMotion && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(node, { clearProps: 'all' });
      return undefined;
    }

    const axis = direction === 'horizontal' ? 'x' : 'y';
    const start = { opacity: 0 };
    start[axis] = distance;
    gsap.set(node, start);

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || (once && playedRef.current)) return;
      playedRef.current = true;
      const target = { opacity: 1 };
      target[axis] = 0;
      gsap.to(node, { ...target, duration, delay, ease: 'power3.out', overwrite: true });
      if (once) observer.disconnect();
    }, { threshold });

    observer.observe(node);
    return () => {
      observer.disconnect();
      gsap.killTweensOf(node);
    };
  }, [direction, distance, duration, delay, threshold, once, allowMotion]);

  return <div ref={ref} className={`animated-content ${className}`}>{children}</div>;
}
