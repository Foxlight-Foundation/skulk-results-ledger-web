import styled from 'styled-components';

import { CaveatChip } from '../components/Chip';
import { Eyebrow, Page, Panel } from '../components/primitives';
import type { Caveat } from '../data/schema';
import { CAVEAT_META } from '../data/format';

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.sectionH};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.section};
  max-width: 20ch;
`;

const Lead = styled.p`
  color: ${({ theme }) => theme.colors.text2};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  max-width: 64ch;
  margin: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.xl};
`;

const H2 = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  margin: ${({ theme }) => theme.spacing.xl} 0 ${({ theme }) => theme.spacing.sm};
`;

const P = styled.p`
  color: ${({ theme }) => theme.colors.text2};
  max-width: 68ch;
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const CaveatCard = styled(Panel)`
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: flex-start;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const CaveatDesc = styled.div`
  color: ${({ theme }) => theme.colors.text3};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const ALL_CAVEATS = Object.keys(CAVEAT_META) as Caveat[];

export function MethodologyPage() {
  return (
    <Page>
      <Eyebrow>How to read this</Eyebrow>
      <Title>A ledger, not a leaderboard.</Title>
      <Lead>
        These numbers come from the Skulk test harness running real chat, code, and tool workloads
        against real hardware. Nothing here is a synthetic benchmark or a marketing figure. Every
        run, including the disappointing ones, is kept.
      </Lead>

      <H2>How throughput is computed</H2>
      <P>
        The headline "typical decode tok/s" for a model is the median across that model's{' '}
        <strong>credible</strong> per-run medians. A run is credible when it has at least three timed
        samples and is not dominated by short outputs. A five-token answer can finish in a moment and
        report a nonsensical four-hundred tokens per second; those samples are excluded from every
        median and counted separately, so they can never set a record.
      </P>
      <P>
        When Skulk reports a native decode rate we use it. When it does not (some engines only expose
        a wall-clock figure that folds in prompt time) we fall back to wall throughput and mark the
        number as an estimate. We never silently mix the two.
      </P>
      <P>
        We also apply a physical-plausibility ceiling. A four-digit tokens-per-second figure comes
        from a near-zero elapsed time, a cache hit or the clock-resolution floor, not real
        generation, so those points are excluded from every headline number and shown dimmed in the
        history rather than deleted.
      </P>

      <H2>Why comparisons carry warnings</H2>
      <P>
        A faster number on a different node set, a warmer cache, or a newer Skulk version is not a
        real speedup. The compare view surfaces those differences as guards instead of hiding them,
        because a delta without its conditions is not evidence.
      </P>

      <H2>The caveat vocabulary</H2>
      <P>Every chip on the site means exactly one of these:</P>
      {ALL_CAVEATS.map((c) => (
        <CaveatCard key={c}>
          <CaveatChip caveat={c} />
          <CaveatDesc>{CAVEAT_META[c].description}</CaveatDesc>
        </CaveatCard>
      ))}

      <H2>Where the data comes from</H2>
      <P>
        Each run is a set of harness artifacts (a machine-readable report, an event log, a summary).
        This site is a static view generated from those artifacts. There is no database and no live
        API: the numbers you see were fixed at import time, and every row links back to the run that
        produced it.
      </P>
    </Page>
  );
}
