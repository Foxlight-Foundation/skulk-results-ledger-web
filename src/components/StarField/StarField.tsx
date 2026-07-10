/**
 * StarField - the twinkling night sky.
 *
 * Soft, blurry-edged circles (radial gradient, not hard dots) that fade
 * in at staggered intervals and then shimmer via a `brightness()`
 * oscillation. All stars are confined to the upper 40% of the viewport.
 *
 * Two animation layers, no conflicts:
 *
 * 1. **Appear** (`starfield-appear`) - a one-shot opacity fade from 0→1.
 *    Staggered per star via `--delay`. Gives the sky a "revealing" feeling
 *    on page load.
 * 2. **Shimmer** (`starfield-shimmer`) - an infinite `filter: brightness()`
 *    + `transform: scale()` cycle that oscillates between `--peak-b` and
 *    `--dim-b`. Brightness never drops below 50%. Each star has its own
 *    speed + phase offset so they're desynchronized.
 *
 * Because appear uses `opacity` and shimmer uses `filter: brightness()`,
 * they compose on the same element without conflicting.
 *
 * Respects `prefers-reduced-motion`.
 *
 * @example
 * ```tsx
 * <StarField />
 * <StarField density={240} />
 * ```
 */
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { breakpoints } from '../../theme/tokens';
import type { StarFieldProps } from './StarField.types';

const SMALL_BREAKPOINT_QUERY = `(max-width: ${breakpoints.md})`;

const Layer = styled.div<{ $absolute: boolean }>`
  position: ${({ $absolute }) => ($absolute ? 'absolute' : 'fixed')};
  top: 0;
  left: 0;
  right: 0;
  /* Stars belong in the sky, not the hills - hard-clip at 40%. */
  height: 40%;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
`;

const Star = styled.span`
  position: absolute;
  border-radius: 50%;
  /*
   * Soft circle via radial-gradient - the star core is a bright center
   * that fades to transparent at the edge. No filter:blur needed for
   * the base shape, which saves a compositing pass per star.
   */
  background: radial-gradient(
    circle,
    rgba(210, 225, 255, 0.95) 0%,
    rgba(210, 225, 255, 0.4) 35%,
    rgba(210, 225, 255, 0) 70%
  );

  /*
   * Two animations, carefully aligned so there's no handoff seam:
   *
   * 1. starfield-appear (one-shot) - fades opacity 0→1 AND ramps
   *    filter from brightness(0) to brightness(--base-b). Ends at
   *    exactly the shimmer's starting brightness.
   * 2. starfield-shimmer (infinite, delayed past appear) - oscillates
   *    filter:brightness between --dim-b and --peak-b, starting and
   *    ending each cycle at --base-b.
   *
   * Both touch the filter property, but they never overlap: appear runs
   * and holds via forwards, then shimmer starts (listed later in the
   * animation shorthand, so it wins once active) at the identical
   * brightness level. No drop, no black dot.
   */
  opacity: 0;
  filter: brightness(var(--base-b, 0.8));
  animation:
    starfield-appear 1.5s var(--delay, 0s) ease-out forwards,
    starfield-shimmer var(--d, 4s) var(--shimmer-start, 1.5s) ease-in-out infinite;

  @keyframes starfield-appear {
    from {
      opacity: 0;
      filter: brightness(0);
      transform: scale(0.6);
    }
    to {
      opacity: 1;
      filter: brightness(var(--base-b, 0.8));
      transform: scale(1);
    }
  }

  @keyframes starfield-shimmer {
    0% {
      filter: brightness(var(--base-b, 0.8));
      transform: scale(1);
    }
    30% {
      filter: brightness(var(--peak-b, 1.3));
      transform: scale(1.12);
    }
    55% {
      filter: brightness(var(--dim-b, 0.5));
      transform: scale(0.9);
    }
    80% {
      filter: brightness(var(--base-b, 0.8));
      transform: scale(1.04);
    }
    100% {
      filter: brightness(var(--base-b, 0.8));
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
  }
`;

/**
 * Tiny seeded PRNG (mulberry32). Good enough for deterministic layouts in
 * tests and stories; not for cryptography.
 */
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

interface StarSpec {
  id: string;
  left: number;
  top: number;
  /** Element size in px. The visible "core" is ~35% of this; the rest is halo. */
  size: number;
  /** Shimmer cycle duration in seconds. */
  duration: number;
  /** Appear delay in seconds (stagger). */
  delay: number;
  /**
   * Base brightness for the shimmer cycle (0–1 scale). 1 = the gradient
   * renders at its natural intensity; lower = dimmer baseline.
   */
  baseBrightness: number;
  /** Optional box-shadow glow for the brightest stars. */
  glow?: string;
}

const buildStars = (density: number, brightCount: number, seed?: number): StarSpec[] => {
  const rand = seed !== undefined ? mulberry32(seed) : Math.random;
  const out: StarSpec[] = [];

  for (let i = 0; i < density; i++) {
    const x = rand() * 100;
    // Y capped at 95% of the 40%-height layer - some padding off the clip edge.
    const y = Math.pow(rand(), 1.4) * 95;
    // Soft circles: most 4-7px, ~6% brighter at 6-9px.
    const size = rand() < 0.06 ? 6 + rand() * 3 : 4 + rand() * 3;
    // Base brightness: sky-half stars are brighter, ground-half are dimmer.
    const baseBr = y < 50 ? 0.5 + rand() * 0.5 : 0.3 + rand() * 0.3;
    out.push({
      id: `s-${i}`,
      left: x,
      top: y,
      size,
      duration: 3 + rand() * 7,
      delay: rand() * 6,
      baseBrightness: Number(baseBr.toFixed(2)),
    });
  }

  // Bright cross stars - larger, with a box-shadow glow and faster shimmer.
  const brightPositions: Array<[number, number]> = [
    [22, 12],
    [48, 8],
    [68, 15],
    [80, 22],
    [35, 6],
    [90, 18],
    [12, 30],
  ];
  for (let i = 0; i < Math.min(brightCount, brightPositions.length); i++) {
    const pos = brightPositions[i];
    if (!pos) continue;
    const [x, y] = pos;
    const size = 5 + rand() * 4;
    out.push({
      id: `b-${i}`,
      left: x,
      top: y,
      size,
      duration: 2.5 + rand() * 4,
      delay: rand() * 4,
      baseBrightness: Number((0.8 + rand() * 0.2).toFixed(2)),
      glow: `0 0 ${4 + rand() * 6}px rgba(210,225,255,0.6)`,
    });
  }

  return out;
};

const shouldRenderStars = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return !window.matchMedia(SMALL_BREAKPOINT_QUERY).matches;
};

/**
 * Decorative star field overlay. See {@link StarFieldProps} for options.
 */
export const StarField: React.FC<StarFieldProps> = ({
  density = 300,
  brightCount = 7,
  seed,
  absolute = false,
  className,
}) => {
  const [enabled, setEnabled] = useState(shouldRenderStars);
  const stars = useMemo(
    () => (enabled ? buildStars(density, brightCount, seed) : []),
    [enabled, density, brightCount, seed],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia(SMALL_BREAKPOINT_QUERY);
    const handleChange = (event: MediaQueryListEvent): void => {
      setEnabled(!event.matches);
    };

    setEnabled(!mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  if (!enabled) return null;

  return (
    <Layer $absolute={absolute} className={className} aria-hidden="true">
      {stars.map((s) => {
        // Shimmer oscillates between dim-b and peak-b.
        // Floor is 0.5 - star never drops below 50% brightness.
        // Tighter oscillation band: ±~20% from base, floored at 0.5.
        const dimB = Math.max(0.5, s.baseBrightness * 0.7);
        const peakB = Math.min(1.35, s.baseBrightness * 1.3);
        return (
          <Star
            key={s.id}
            style={
              {
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                boxShadow: s.glow,
                '--d': `${s.duration}s`,
                '--delay': `${s.delay}s`,
                '--shimmer-start': `${s.delay + 1.5}s`,
                '--base-b': String(s.baseBrightness),
                '--peak-b': String(peakB.toFixed(2)),
                '--dim-b': String(dimB.toFixed(2)),
              } as React.CSSProperties
            }
          />
        );
      })}
    </Layer>
  );
};
