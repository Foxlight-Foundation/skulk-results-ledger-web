import { createGlobalStyle } from 'styled-components';

/**
 * Global reset + canvas. The night background uses two faint indigo radial
 * pools (top-left, bottom-right) over the near-black night base, echoing the
 * foxlight.ai hero atmosphere without competing with foreground charts.
 */
export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }

  html, body, #root { height: 100%; }

  body {
    margin: 0;
    font-family: ${({ theme }) => theme.typography.fontFamily.body};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    line-height: ${({ theme }) => theme.typography.lineHeight.normal};
    color: ${({ theme }) => theme.colors.text2};
    background:
      radial-gradient(ellipse 80% 60% at 12% -8%, ${({ theme }) => theme.colors.indigoWash} 0%, transparent 60%),
      radial-gradient(ellipse 70% 55% at 100% 100%, ${({ theme }) => theme.colors.indigoHint} 0%, transparent 55%),
      ${({ theme }) => theme.colors.night};
    background-attachment: fixed;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  h1, h2, h3, h4 {
    font-family: ${({ theme }) => theme.typography.fontFamily.display};
    color: ${({ theme }) => theme.colors.text1};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    margin: 0;
    line-height: ${({ theme }) => theme.typography.lineHeight.section};
  }

  a { color: inherit; text-decoration: none; }

  button { font-family: inherit; }

  ::selection { background: ${({ theme }) => theme.colors.amberWash}; color: ${({ theme }) => theme.colors.moon}; }

  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border2};
    border-radius: ${({ theme }) => theme.radii.pill};
  }
  ::-webkit-scrollbar-thumb:hover { background: ${({ theme }) => theme.colors.borderMoon}; }
`;
