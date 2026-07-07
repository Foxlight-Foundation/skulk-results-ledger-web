/**
 * The Foxlight dark theme, ported from FoxlightWeb src/theme/dark.ts. Colors
 * trace to the foxlight.ai design system: night canvas, warm-cream moonlight
 * (never pure white), Foxfire amber CTAs, Starlight cyan for the technical
 * register, glow-over-shadow elevation.
 *
 * The ledger adds a small set of semantic status colors (pass / fail / warn /
 * neutral) that the marketing site does not need, derived to sit within the
 * same palette.
 */

import { breakpoints, radii, spacing, typography, zIndex } from './tokens';

export const theme = {
  mode: 'dark' as const,
  colors: {
    // Night: page canvas
    night: '#060914',
    nightMid: '#080e1c',
    dusk: '#0d1428',
    duskLift: '#111b35',
    panelBg: 'rgba(11, 17, 36, 0.72)',

    // Moonlight: warm cream, never pure white
    moon: '#f0ede8',
    moonDim: '#c8c4be',

    // Text scale
    text1: '#f0ede8',
    text2: '#c8c4be',
    text3: '#8a8680',
    text4: '#5a5652',

    // Foxfire amber
    amber: '#FF9500',
    amberHi: '#FFB800',
    amberLo: '#E06500',
    amberWash: 'rgba(255,149,0,0.14)',
    amberGhost: 'rgba(255,149,0,0.065)',

    moonWash: 'rgba(240,237,232,0.08)',

    // Starlight cyan: the technical/intelligence register
    cyan: '#4FC3C8',
    cyanWash: 'rgba(79,195,200,0.10)',

    // Indigo: atmospheric only
    indigoDeep: '#2a2860',
    indigoMid: '#38368a',
    indigoWash: 'rgba(55,52,140,0.14)',
    indigoHint: 'rgba(55,52,140,0.07)',

    // Borders
    border0: 'rgba(240,237,232,0.05)',
    border1: 'rgba(240,237,232,0.09)',
    border2: 'rgba(240,237,232,0.14)',
    borderAmber: 'rgba(255,149,0,0.28)',
    borderMoon: 'rgba(240,237,232,0.22)',
    borderIndigo: 'rgba(80,75,180,0.20)',

    // Ledger status semantics (within-palette, not borrowed from elsewhere)
    pass: '#5fd0a6',
    passWash: 'rgba(95,208,166,0.12)',
    fail: '#ff7a6b',
    failWash: 'rgba(255,122,107,0.12)',
    warn: '#FFB800',
    warnWash: 'rgba(255,184,0,0.12)',
    neutral: '#7f8aa3',
  },
  shadows: {
    card: '0 4px 40px rgba(0,0,0,0.60)',
    glowSm: '0 0 22px rgba(255,149,0,0.45)',
    glowMd: '0 0 40px rgba(255,185,0,0.50)',
    glowLg: '0 0 70px rgba(255,185,0,0.42)',
    nav: [
      '0 0 0 1px rgba(240,237,232,0.04)',
      '0 8px 32px rgba(0,0,0,0.45)',
      '0 2px 8px rgba(0,0,0,0.30)',
      'inset 0 1px 0 rgba(240,237,232,0.06)',
    ].join(', '),
  },
  spacing,
  radii,
  typography,
  zIndex,
  breakpoints,
} as const;

export type AppTheme = typeof theme;
