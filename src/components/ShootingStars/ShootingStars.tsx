/**
 * ShootingStars - episodic shooting stars drawn on top of the sky.
 *
 * A positioned layer that, on a random interval, spawns a short-lived
 * linear-gradient "comet" that sweeps across a portion of the viewport
 * at a random angle, with a fixed-length tail. Each star animates with
 * the Web Animations API (linear easing - real shooting stars don't
 * accelerate or decelerate) and removes itself on finish.
 *
 * Design notes:
 * - Spawn interval is random between `minIntervalMs` and `maxIntervalMs`
 *   (default 2.5–9s) so the rhythm feels organic, never metronomic.
 * - Stars start in the upper-left quadrant (top 3–53%, left 2–34%) and
 *   travel down-right across 280–460px at 15–55° angles. This keeps them
 *   inside the hero sky region even on wide displays.
 * - `prefers-reduced-motion` disables the layer entirely.
 * - Clean up both the active timeout and any in-flight animations on
 *   unmount so the component doesn't leak during route transitions.
 *
 * @example
 * ```tsx
 * <ShootingStars />
 * <ShootingStars absolute minIntervalMs={1500} maxIntervalMs={4000} />
 * ```
 */
import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import type { ShootingStarsProps } from './ShootingStars.types';

const Layer = styled.div<{ $absolute: boolean }>`
  position: ${({ $absolute }) => ($absolute ? 'absolute' : 'fixed')};
  top: 0;
  left: 0;
  right: 0;
  /* Hard-clip at 40% from the top - shooting stars belong in the sky,
     never the hills. This is simpler and more robust than trying to
     calculate where each star's travel arc ends. */
  height: 40%;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`;

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Renders a random shooting star inside `host`. Returns the spawned element
 * so callers can track it for cleanup.
 */
const spawnShootingStar = (host: HTMLDivElement): HTMLDivElement | null => {
  const startY = 3 + Math.random() * 35; // top 3–38% of the layer (which is 40vh)
  const startX = 2 + Math.random() * 32; // left 2–34%
  const tailLen = 80 + Math.random() * 220; // 80–300px
  const angle = 15 + Math.random() * 40; // 15–55°
  const travel = 280 + Math.random() * 180; // 280–460px
  const dur = 500 + Math.random() * 700; // 0.5–1.2s
  const bright = 0.55 + Math.random() * 0.45;
  const thick = 0.8 + Math.random() * 0.9; // 0.8–1.7px

  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute;
    top: ${startY}%;
    left: ${startX}%;
    width: ${tailLen}px;
    height: ${thick}px;
    background: linear-gradient(to right,
      rgba(255,255,255,0) 0%,
      rgba(210,228,255,${bright * 0.3}) 25%,
      rgba(240,248,255,${bright * 0.75}) 65%,
      rgba(255,255,255,${bright}) 100%);
    border-radius: 9999px;
    transform: rotate(${angle}deg) translateX(0px);
    transform-origin: 0% 50%;
    pointer-events: none;
    z-index: 3;
  `;
  host.appendChild(el);

  // Web Animations API - may not exist in older jsdom. Fall back to a
  // plain removal if the element can't animate.
  if (typeof el.animate !== 'function') {
    setTimeout(() => el.remove(), dur);
    return el;
  }

  const anim = el.animate(
    [
      { opacity: 0, transform: `rotate(${angle}deg) translateX(-${tailLen}px)` },
      { opacity: bright, transform: `rotate(${angle}deg) translateX(0px)`, offset: 0.05 },
      {
        opacity: bright,
        transform: `rotate(${angle}deg) translateX(${travel}px)`,
        offset: 0.82,
      },
      {
        opacity: 0,
        transform: `rotate(${angle}deg) translateX(${travel + tailLen * 0.3}px)`,
      },
    ],
    { duration: dur, easing: 'linear', fill: 'forwards' },
  );
  anim.onfinish = () => el.remove();
  return el;
};

/**
 * Mounts a shooting-star layer. Spawns stars on a random interval until
 * the component unmounts. Respects `prefers-reduced-motion`.
 */
export const ShootingStars: React.FC<ShootingStarsProps> = ({
  minIntervalMs = 2500,
  maxIntervalMs = 9000,
  initialDelayMs = 1800,
  absolute = false,
  className,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = (): void => {
      const interval = minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs);
      timeoutId = setTimeout(() => {
        if (cancelled || !hostRef.current) return;
        spawnShootingStar(hostRef.current);
        scheduleNext();
      }, interval);
    };

    timeoutId = setTimeout(scheduleNext, initialDelayMs);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      // Remove any in-flight star elements so they don't leak through
      // a route transition.
      while (host.firstChild) host.removeChild(host.firstChild);
    };
  }, [minIntervalMs, maxIntervalMs, initialDelayMs]);

  return <Layer ref={hostRef} $absolute={absolute} className={className} aria-hidden="true" />;
};
