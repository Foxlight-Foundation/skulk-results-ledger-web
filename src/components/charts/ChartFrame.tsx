import type { ReactNode } from 'react';
import styled, { useTheme } from 'styled-components';

/** Shared chrome + axis/grid styling helpers for the recharts wrappers. */

export const ChartCard = styled.div`
  background: ${({ theme }) => theme.colors.panelBg};
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  border: 1px solid ${({ theme }) => theme.colors.border1};
  border-radius: ${({ theme }) => theme.radii.card};
  padding: ${({ theme }) => theme.spacing.lg};
`;

export const ChartHeading = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`;

export const ChartTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
`;

export const ChartHint = styled.span`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.eyebrow};
  color: ${({ theme }) => theme.colors.text3};
`;

/**
 * Infographic-style headline block for a chart card: a row of big stat
 * callouts (value + label) plus a short plain-language explainer, so a reader
 * gets the chart's takeaway before parsing axes. Reusable by any chart card;
 * see ConcurrencyChart for the pattern. The wrapper insets the content so its
 * left edge aligns with the chart's vertical axis line (recharts margin.left
 * 4px + the explicit YAxis width of 60px the wrapped charts set); on narrow
 * screens the inset would waste scarce width, so it collapses at md.
 */
export const HeadlineBlock = styled.div`
  padding-left: 64px;

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    padding-left: 0;
  }
`;

export const HeadlineRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xl};
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.spacing.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    gap: ${({ theme }) => theme.spacing.lg};
  }
`;

export const HeadlineStat = styled.div``;

export const HeadlineValue = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.display};
  font-size: 2rem;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text1};
  line-height: 1.1;

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    font-size: 1.5rem;
  }
`;

export const HeadlineLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.eyebrow};
  color: ${({ theme }) => theme.colors.text3};
  margin-top: 4px;
`;

export const HeadlineNote = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text2};
  max-width: 560px;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  line-height: 1.5;
`;

/** Small pill toggle for switching a chart's rendering (e.g. bars/line). */
export const ChartToggleGroup = styled.div`
  display: inline-flex;
  border: 1px solid ${({ theme }) => theme.colors.border1};
  border-radius: ${({ theme }) => theme.radii.sm};
  overflow: hidden;
`;

export const ChartToggleButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 9px;
  border: none;
  cursor: pointer;
  background: ${({ theme, $active }) => ($active ? theme.colors.border1 : 'transparent')};
  color: ${({ theme, $active }) => ($active ? theme.colors.text1 : theme.colors.text3)};
  transition: color 120ms ease, background 120ms ease;

  &:hover {
    color: ${({ theme }) => theme.colors.text1};
  }

  svg {
    display: block;
    width: 15px;
    height: 15px;
  }
`;

/**
 * Inline chart-style glyphs (Material-symbol shapes, redrawn as minimal
 * paths). The site takes no icon dependency -- the house style is inline SVG
 * components (FoxlightMark, InfoPopover) -- and currentColor keeps them on
 * the toggle's active/inactive palette.
 */
export function BarsGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="12" width="4" height="8" rx="1" />
      <rect x="10" y="6" width="4" height="14" rx="1" />
      <rect x="16" y="9" width="4" height="11" rx="1" />
    </svg>
  );
}

export function LineGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3.5,17 9,10.5 13.5,14 20.5,6" />
    </svg>
  );
}

const TooltipBox = styled.div`
  background: ${({ theme }) => theme.colors.dusk};
  border: 1px solid ${({ theme }) => theme.colors.border2};
  border-radius: ${({ theme }) => theme.radii.sm};
  padding: 10px 12px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text2};
  max-width: 260px;
`;

export function TooltipShell({ children }: { children: ReactNode }) {
  return <TooltipBox>{children}</TooltipBox>;
}

/** Axis/grid palette pulled from the theme for recharts props. */
export function useChartPalette() {
  const theme = useTheme();
  return {
    axis: theme.colors.text3,
    grid: theme.colors.border0,
    amber: theme.colors.amber,
    cyan: theme.colors.cyan,
    neutral: theme.colors.neutral,
    pass: theme.colors.pass,
    fail: theme.colors.fail,
    font: theme.typography.fontFamily.mono,
  };
}
