import styled, { css } from 'styled-components';

import type { Caveat, EngineFamily, SeriesStatus } from '../data/schema';
import { CAVEAT_META, FAMILY_META } from '../data/format';

type Tone = 'warn' | 'fail' | 'neutral' | 'pass' | 'amber' | 'cyan';

const toneStyles = (tone: Tone) => css`
  ${({ theme }) => {
    const map: Record<Tone, { fg: string; bg: string; bd: string }> = {
      warn: { fg: theme.colors.warn, bg: theme.colors.warnWash, bd: 'rgba(255,184,0,0.3)' },
      fail: { fg: theme.colors.fail, bg: theme.colors.failWash, bd: 'rgba(255,122,107,0.3)' },
      pass: { fg: theme.colors.pass, bg: theme.colors.passWash, bd: 'rgba(95,208,166,0.3)' },
      cyan: { fg: theme.colors.cyan, bg: theme.colors.cyanWash, bd: 'rgba(79,195,200,0.3)' },
      amber: { fg: theme.colors.amberHi, bg: theme.colors.amberWash, bd: theme.colors.borderAmber },
      neutral: { fg: theme.colors.text3, bg: theme.colors.moonWash, bd: theme.colors.border1 },
    };
    const c = map[tone];
    return css`
      color: ${c.fg};
      background: ${c.bg};
      border: 1px solid ${c.bd};
    `;
  }}
`;

export const Chip = styled.span<{ $tone?: Tone }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  letter-spacing: 0.3px;
  padding: 3px 9px;
  border-radius: ${({ theme }) => theme.radii.pill};
  white-space: nowrap;
  ${({ $tone }) => toneStyles($tone ?? 'neutral')};
`;

/** A caveat chip that carries its explanation in a native tooltip. */
export function CaveatChip({ caveat }: { caveat: Caveat }) {
  const meta = CAVEAT_META[caveat];
  return (
    <Chip $tone={meta.tone} title={meta.description}>
      {meta.label}
    </Chip>
  );
}

export function CaveatList({ caveats }: { caveats: Caveat[] }) {
  if (caveats.length === 0) return null;
  return (
    <>
      {caveats.map((c) => (
        <CaveatChip key={c} caveat={c} />
      ))}
    </>
  );
}

export function FamilyBadge({ family }: { family: EngineFamily }) {
  const meta = FAMILY_META[family];
  const tone: Tone = meta.color === 'cyan' ? 'cyan' : meta.color === 'amber' ? 'amber' : 'neutral';
  return <Chip $tone={tone}>{meta.label}</Chip>;
}

export function PassRateChip({ passRate }: { passRate: number }) {
  const tone: Tone = passRate >= 0.999 ? 'pass' : passRate >= 0.9 ? 'warn' : 'fail';
  return <Chip $tone={tone}>{(passRate * 100).toFixed(0)}% pass</Chip>;
}

/** Factual longitudinal status for one exact performance series. */
export function SeriesStatusChip({ status }: { status: SeriesStatus }) {
  const tone: Tone =
    status === 'Stable'
      ? 'pass'
      : status === 'Variable'
        ? 'warn'
        : status === 'Observed'
          ? 'cyan'
          : 'neutral';
  return <Chip $tone={tone}>{status}</Chip>;
}
