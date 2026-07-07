import type { ReactNode } from 'react';
import styled, { useTheme } from 'styled-components';

/** Shared chrome + axis/grid styling helpers for the recharts wrappers. */

export const ChartCard = styled.div`
  background: ${({ theme }) => theme.colors.panelBg};
  backdrop-filter: blur(14px);
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
