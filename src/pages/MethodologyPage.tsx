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
      <Title>Methodology</Title>
      <Lead>
        These numbers come from the Skulk test harness running chat, code, and tool workloads
        against real hardware. All runs included.
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
        We also apply a physical-plausibility ceiling. Implausible tokens-per-second, invalid text
        generation, etc. are excluded from headline numbers and are shown dimmed in the history
        rather than deleted.
      </P>

      <H2>Why comparisons carry warnings</H2>
      <P>
        A faster number on a different node set, a warmer cache, or a newer Skulk version is not a
        real speedup. The compare view surfaces those differences as guards instead of hiding them.
      </P>

      <H2>The caveat vocabulary</H2>
      <P>Every chip on the site means exactly one of these:</P>
      {ALL_CAVEATS.map((c) => (
        <CaveatCard key={c}>
          <CaveatChip caveat={c} />
          <CaveatDesc>{CAVEAT_META[c].description}</CaveatDesc>
        </CaveatCard>
      ))}

      <H2>Community submissions</H2>
      <P>
        Operators running skulk-test-harness against their own clusters can submit results.
        Submissions authenticate with a GitHub account, pass the same structural and plausibility
        gates as first-party data, and wait for manual approval before appearing. Community runs
        are always badged with their submitter and never blend into headline numbers: typical
        throughput and the hardware matrix rest on first-party runs only. Submit by POSTing a
        harness report to the ingest API; a first-class harness command is on the way.
      </P>

      <H2>How hardware is classified</H2>
      <P>
        Each run&apos;s fingerprint records raw facts per node (accelerator vendor, total memory).
        At import those map to canonical classes: vendor plus the nearest standard memory tier, so
        a node reporting 61GiB usable reads as AMD 64GB. A run&apos;s hardware is the multiset of
        its node classes; a model&apos;s hardware is the classes of the nodes that actually served
        it where the run recorded placement (marked exact), or the whole-cluster shape otherwise
        (marked cluster). Runs that predate hardware fingerprints show as unknown hardware rather
        than being guessed. Classification lives in the site importer, not the harness, so a
        taxonomy fix reclassifies all history on the next rebuild.
      </P>

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
