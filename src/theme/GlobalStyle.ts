import { createGlobalStyle } from 'styled-components';

/**
 * Global reset + canvas, ported 1:1 from foxlight.ai (FoxlightWeb
 * AppThemeProvider) so a visitor moving between foxlight.ai and
 * benchmarks.foxlight.ai never perceives a host change: the same fixed
 * starry-sky image, the same top/bottom gradient veil, and the same
 * text-shadow treatment that lets type sit on the sky.
 */
export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }

  html, body, #root { height: 100%; }

  html { color-scheme: dark; }

  body {
    margin: 0;
    min-height: 100vh;
    font-family: ${({ theme }) => theme.typography.fontFamily.body};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    line-height: ${({ theme }) => theme.typography.lineHeight.normal};
    color: ${({ theme }) => theme.colors.text2};
    background-color: ${({ theme }) => theme.colors.night};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  /*
   * Starry background image as a fixed pseudo-element, identical to
   * foxlight.ai. Works on all devices including mobile browsers that don't
   * support background-attachment: fixed; the image stays stationary while
   * content scrolls over it.
   */
  body::after {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background-image: url('/starry_bg.webp');
    background-size: cover;
    background-position: center center;
    background-repeat: no-repeat;
  }

  /*
   * Full-viewport veil: fixed gradient darkening the top and bottom edges of
   * the sky while leaving the middle clear. Sits under all content
   * (z-index: 0); page content renders above it via #root's stacking context.
   */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      rgba(4, 6, 16, 0.70) 0%,
      rgba(4, 6, 16, 0) 30%,
      rgba(4, 6, 16, 0) 70%,
      rgba(4, 6, 16, 0.70) 100%
    );
  }

  /* Lift the app above the veil (body::before is z-index 0). */
  #root {
    position: relative;
    z-index: 1;
  }

  h1, h2, h3, h4 {
    font-family: ${({ theme }) => theme.typography.fontFamily.display};
    color: ${({ theme }) => theme.colors.text1};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    margin: 0;
    line-height: ${({ theme }) => theme.typography.lineHeight.section};
    text-shadow: 0 2px 24px rgba(4, 6, 16, 0.9);
  }

  p {
    text-shadow: 0 1px 16px rgba(4, 6, 16, 0.85);
  }

  a { color: inherit; text-decoration: none; }

  button { font-family: inherit; }

  code, pre, kbd {
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  }

  ::selection { background: ${({ theme }) => theme.colors.amberWash}; color: ${({ theme }) => theme.colors.moon}; }

  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border2};
    border-radius: ${({ theme }) => theme.radii.pill};
  }
  ::-webkit-scrollbar-thumb:hover { background: ${({ theme }) => theme.colors.borderMoon}; }
`;
