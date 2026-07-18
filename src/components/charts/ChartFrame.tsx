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
 * see ConcurrencyChart for the pattern.
 */
export const HeadlineRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xl};
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

export const HeadlineStat = styled.div``;

export const HeadlineValue = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.display};
  font-size: 2rem;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text1};
  line-height: 1.1;
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
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.eyebrow};
  padding: 4px 10px;
  border: none;
  cursor: pointer;
  background: ${({ theme, $active }) => ($active ? theme.colors.border1 : 'transparent')};
  color: ${({ theme, $active }) => ($active ? theme.colors.text1 : theme.colors.text3)};
  transition: color 120ms ease, background 120ms ease;

  &:hover {
    color: ${({ theme }) => theme.colors.text1};
  }
`;

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
