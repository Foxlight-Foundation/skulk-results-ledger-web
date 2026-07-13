import { useMemo } from 'react';
import styled from 'styled-components';

import { PassRateChip } from '../components/Chip';
import { BigNumber, Eyebrow, Grid, Muted, Page, Panel, Row } from '../components/primitives';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { formatDate } from '../data/format';
import { useIndex } from '../data/useLedger';
import { useWindow } from '../data/useWindow';
import { isWithinWindow } from '../data/window';

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.sectionH};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.section};
`;

const Sub = styled.p`
  color: ${({ theme }) => theme.colors.text2};
  max-width: 58ch;
  margin: ${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.lg};
`;

const Card = styled(Panel)`
  padding: ${({ theme }) => theme.spacing.lg};
`;

const SuiteName = styled.h3`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  color: ${({ theme }) => theme.colors.text1};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  word-break: break-word;
`;

const Line = styled(Row)`
  justify-content: space-between;
  padding: 6px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border0};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

export function SuitesPage() {
  const { data, error, loading } = useIndex();
  const { window, now } = useWindow();

  // Recompute each suite's stats for the selected period from the run
  // summaries (which carry test set / timestamp / pass-fail counts). Distinct
  // models-covered cannot be reconstructed per window from the index (run rows
  // do not carry model ids), so for a narrowed period the coverage figure is a
  // proxy: the largest single run's model count in the window (period-accurate,
  // never overstated). For the All period it uses the importer's exact distinct
  // union from the baked suite rollup, so All matches the baked data.
  const suites = useMemo(() => {
    if (!data) return [];
    const bakedModelCount = new Map(data.suites.map((s) => [s.testSet, s.modelCount]));
    const byTest = new Map<string, typeof data.runs>();
    for (const r of data.runs) {
      if (!isWithinWindow(r.finishedAt ?? r.startedAt, window, now)) continue;
      const arr = byTest.get(r.testSet) ?? [];
      arr.push(r);
      byTest.set(r.testSet, arr);
    }
    return [...byTest.entries()]
      .map(([testSet, runs]) => {
        const pass = runs.reduce((n, r) => n + r.passCount, 0);
        const totalResults = runs.reduce((n, r) => n + r.passCount + r.failCount, 0);
        const lastRunAt =
          runs
            .map((r) => r.finishedAt ?? r.startedAt)
            .filter((v): v is string => v != null)
            .sort()
            .at(-1) ?? null;
        const modelCount =
          window == null
            ? bakedModelCount.get(testSet) ?? runs.reduce((mx, r) => Math.max(mx, r.modelCount), 0)
            : runs.reduce((mx, r) => Math.max(mx, r.modelCount), 0);
        return {
          testSet,
          runCount: runs.length,
          modelCount,
          totalResults,
          passRate: totalResults ? pass / totalResults : 0,
          lastRunAt,
        };
      })
      .sort((a, b) => b.runCount - a.runCount);
  }, [data, window, now]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <ErrorState error="No index." />;

  return (
    <Page>
      <Eyebrow>Coverage</Eyebrow>
      <Title>Test suites</Title>
      <Sub>
        Each suite is a named battery of assertions run against a set of models. Stats reflect the
        selected period; pass rate is across the suite's results in that window.
      </Sub>
      {suites.length === 0 ? (
        <EmptyState label="No suite runs in the selected period. Widen the window, or select All." />
      ) : (
      <Grid $min="300px">
        {suites.map((s) => (
          <Card key={s.testSet}>
            <SuiteName>{s.testSet}</SuiteName>
            <Row $justify="space-between">
              <div>
                <BigNumber>{s.runCount}</BigNumber>
                <Muted>runs</Muted>
              </div>
              <PassRateChip passRate={s.passRate} />
            </Row>
            <div style={{ marginTop: 16 }}>
              <Line>
                <Muted>Models covered</Muted>
                <span>{s.modelCount}</span>
              </Line>
              <Line>
                <Muted>Total results</Muted>
                <span>{s.totalResults}</span>
              </Line>
              <Line>
                <Muted>Last run</Muted>
                <span>{formatDate(s.lastRunAt)}</span>
              </Line>
            </div>
          </Card>
        ))}
      </Grid>
      )}
    </Page>
  );
}
