import { Link } from 'react-router-dom';
import styled, { css } from 'styled-components';

/** Centered page column with responsive gutters. */
export const Page = styled.div`
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.spacing.xl} ${theme.spacing.lg} ${theme.spacing.xxl}`};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: ${({ theme }) => `${theme.spacing.lg} ${theme.spacing.md} ${theme.spacing.xxl}`};
  }
`;

/** Uppercase monospace eyebrow label (the foxlight technical register). */
export const Eyebrow = styled.p`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.eyebrow};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.cyan};
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
`;

export const SectionTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.sectionH};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.section};
`;

export const Muted = styled.span`
  color: ${({ theme }) => theme.colors.text3};
`;

export const Mono = styled.span`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.code};
`;

/** Glass panel with the design system's blur + grounding shadow. */
export const Panel = styled.div`
  background: ${({ theme }) => theme.colors.panelBg};
  backdrop-filter: blur(14px);
  border: 1px solid ${({ theme }) => theme.colors.border1};
  border-radius: ${({ theme }) => theme.radii.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const interactiveCard = css`
  transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
  &:hover {
    border-color: ${({ theme }) => theme.colors.borderAmber};
    transform: translateY(-2px);
  }
`;

export const CardLink = styled(Link)`
  display: block;
  background: ${({ theme }) => theme.colors.panelBg};
  backdrop-filter: blur(14px);
  border: 1px solid ${({ theme }) => theme.colors.border1};
  border-radius: ${({ theme }) => theme.radii.card};
  padding: ${({ theme }) => theme.spacing.lg};
  ${interactiveCard};
`;

export const Row = styled.div<{ $gap?: string; $wrap?: boolean; $align?: string; $justify?: string }>`
  display: flex;
  align-items: ${({ $align }) => $align ?? 'center'};
  justify-content: ${({ $justify }) => $justify ?? 'flex-start'};
  gap: ${({ $gap, theme }) => $gap ?? theme.spacing.sm};
  flex-wrap: ${({ $wrap }) => ($wrap ? 'wrap' : 'nowrap')};
`;

export const Grid = styled.div<{ $min?: string; $gap?: string }>`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${({ $min }) => $min ?? '260px'}, 1fr));
  gap: ${({ $gap, theme }) => $gap ?? theme.spacing.md};
`;

export const BigNumber = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.display};
  font-size: 2rem;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text1};
  line-height: 1.1;
`;

export const InlineLink = styled(Link)`
  color: ${({ theme }) => theme.colors.amberHi};
  border-bottom: 1px solid transparent;
  transition: border-color 140ms ease;
  &:hover {
    border-color: ${({ theme }) => theme.colors.amberHi};
  }
`;
