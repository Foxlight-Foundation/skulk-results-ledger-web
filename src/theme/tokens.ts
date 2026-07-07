/**
 * Structural design tokens, ported from the foxlight.ai design system
 * (FoxlightWeb src/theme/tokens.ts) so the ledger reads as part of the same
 * product. Spacing, radii, typography, z-index, breakpoints do not vary by
 * theme; the color palette + glows live in theme.ts.
 */

export const spacing = {
  none: '0',
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  xxl: '4rem',
  xxxl: '6rem',
  hero: '9rem',
} as const;

export const radii = {
  none: '0',
  sm: '8px',
  md: '12px',
  card: '16px',
  featured: '20px',
  glass: '22px',
  pill: '9999px',
} as const;

export const typography = {
  fontFamily: {
    display: '"DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    body: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  fontSize: {
    eyebrow: '0.6875rem',
    code: '0.8125rem',
    xs: '0.8125rem',
    sm: '0.9375rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    navBrand: '1.125rem',
    sectionH: 'clamp(1.9rem, 3.6vw, 2.9rem)',
    hero: 'clamp(2.6rem, 6vw, 4.4rem)',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
  lineHeight: {
    display: 1.06,
    section: 1.1,
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.68,
  },
  letterSpacing: {
    tight: '-1.8px',
    section: '-1.2px',
    brand: '-0.4px',
    normal: '0',
    eyebrow: '0.65px',
  },
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 100,
  nav: 200,
  sticky: 300,
  overlay: 1000,
  modal: 1100,
  toast: 1200,
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  wide: '1440px',
} as const;
