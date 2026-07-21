import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';

import { CaveatList, Chip, FamilyBadge, PassRateChip } from '../components/Chip';
import { ConcurrencyChart } from '../components/charts/ConcurrencyChart';
import { TrendChart } from '../components/charts/TrendChart';
import { BigNumber, Eyebrow, Grid, InlineLink, Muted, Page, Panel, Row } from '../components/primitives';
import { SortableTable, type Column } from '../components/SortableTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { ModelTimePoint } from '../data/schema';
import { formatDate, formatSeconds, formatTps } from '../data/format';
import { hasFullyKnownHardware } from '../data/hardware';
import { useModelHistory } from '../data/useLedger';
import { useWindow } from '../data/useWindow';
import { isWithinWindow, windowRollup } from '../data/window';

const Header = styled.header`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const Name = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.sectionH};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.section};
  word-break: break-word;
`;

const StatCard = styled(Panel)`
  padding: ${({ theme }) => theme.spacing.md};
`;

const StatLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.eyebrow};
  color: ${({ theme }) => theme.colors.text3};
  margin-top: 6px;
`;

const Section = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  margin: ${({ theme }) => theme.spacing.xl} 0 ${({ theme }) => theme.spacing.md};
`;

const ConcurrencyCharts = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export function ModelPage() {
  const { slug } = useParams();
  const { data, error, loading } = useModelHistory(slug);
  const { window, now } = useWindow();
  const navigate = useNavigate();

  if (loading) return <LoadingState label="Loading model…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <ErrorState error="Model not found." />;

  // Scope the model's headline, hardware cells, and history to the selected
  // period. Everything below reflects only runs in the window.
  const w = windowRollup(data, window, now);
  const timeline = data.timeline.filter(
    (t) => hasFullyKnownHardware(t.hardware.classes) && isWithinWindow(t.startedAt, window, now),
  );
  // Latest foxlight concurrency sweep per hardware label, respecting the
  // selected time window; curves are already sorted by run start, so the last
  // per label wins. Community curves stay out of this headline view (tiers
  // never blend), same rule as hardware cells.
  const concurrencyCurves = [
    ...new Map(
      (data.concurrencyCurves ?? [])
        .filter(
          (c) =>
            c.tier === 'foxlight' &&
            hasFullyKnownHardware(c.hardwareClasses) &&
            isWithinWindow(c.startedAt, window, now) &&
            // Only curves the chart can actually draw compete for the
            // latest-per-hardware slot: a newer sweep whose levels all failed
            // (no throughput recorded) must not shadow an older valid curve
            // and leave the section blank.
            c.points.some((p) => p.aggregateTps != null || p.perRequestTpsP50 != null),
        )
        .map((c) => [c.hardwareLabel, c] as const),
    ).values(),
  ];

  const columns: Column<ModelTimePoint>[] = [
    {
      key: 'date',
      header: 'Run',
      sortValue: (t) => t.startedAt ?? '',
      render: (t) => <InlineLink to={`/run/${t.runId}`}>{formatDate(t.startedAt)}</InlineLink>,
    },
    {
      key: 'decode',
      header: 'Decode tok/s',
      align: 'right',
      sortValue: (t) => t.decodeTpsMedian ?? -1,
      render: (t) => (
        <span style={{ opacity: t.credible ? 1 : 0.55 }}>{formatTps(t.decodeTpsMedian)}</span>
      ),
    },
    {
      key: 'ttft',
      header: 'TTFT',
      align: 'right',
      sortValue: (t) => t.ttftMedian ?? Number.MAX_SAFE_INTEGER,
      render: (t) => formatSeconds(t.ttftMedian),
    },
    {
      key: 'n',
      header: 'Samples',
      align: 'center',
      sortValue: (t) => t.sampleCount,
      render: (t) => t.sampleCount,
    },
    {
      key: 'hardware',
      header: 'Hardware',
      sortValue: (t) => (t.hardware.known ? t.hardware.label : ''),
      render: (t) =>
        t.hardware.known ? (
          <span style={{ whiteSpace: 'nowrap' }}>{t.hardware.label}</span>
        ) : (
          <Muted>{t.nodeCount ? `${t.nodeCount} nodes` : 'unknown'}</Muted>
        ),
    },
    {
      key: 'version',
      header: 'Skulk',
      render: (t) => (t.skulkVersion ? <Muted>{t.skulkVersion}</Muted> : <Muted>—</Muted>),
    },
    {
      key: 'pass',
      header: 'Pass',
      align: 'center',
      sortValue: (t) => t.passRate,
      render: (t) => <PassRateChip passRate={t.passRate} />,
    },
    {
      key: 'caveats',
      header: 'Caveats',
      render: (t) => (
        <Row $gap="5px" $wrap>
          {t.tier === 'community' && <Chip $tone="amber">community</Chip>}
          <CaveatList caveats={t.caveats} />
        </Row>
      ),
    },
  ];

  return (
    <Page>
      <Header>
        <Eyebrow>Model</Eyebrow>
        <Name>{data.displayName}</Name>
        <Row $gap="8px" $wrap style={{ marginTop: 12 }}>
          <FamilyBadge family={data.family} />
          <PassRateChip passRate={w.passRate} />
          {w.nodeCountsObserved.length > 0 && (
            <Chip>{w.nodeCountsObserved.join('/')}-node</Chip>
          )}
          {w.hardwareCells
            .filter((c) => hasFullyKnownHardware(c.classes))
            .map((c) => (
              <Chip
                key={c.label}
                $tone="cyan"
                title={
                  c.clusterAttributedRunCount > 0
                    ? 'Includes cluster-fallback runs (placement not recorded; shape is an upper bound)'
                    : undefined
                }
              >
                {c.label}
                {c.clusterAttributedRunCount === c.runCount && ' (cluster)'}
              </Chip>
            ))}
          <Muted>{data.modelId}</Muted>
        </Row>
      </Header>

      <Grid $min="180px">
        <StatCard>
          <BigNumber>{formatTps(w.decodeTpsTypical)}</BigNumber>
          <StatLabel>typical decode tok/s</StatLabel>
        </StatCard>
        <StatCard>
          <BigNumber>{formatTps(w.decodeTpsLatest)}</BigNumber>
          <StatLabel>latest credible tok/s</StatLabel>
        </StatCard>
        <StatCard>
          <BigNumber>{formatSeconds(w.ttftLatestMedian)}</BigNumber>
          <StatLabel>latest TTFT</StatLabel>
        </StatCard>
        <StatCard>
          <BigNumber>
            {w.credibleRunCount}
            <Muted style={{ fontSize: '1rem' }}> / {w.runCountInWindow}</Muted>
          </BigNumber>
          <StatLabel>credible / total runs</StatLabel>
        </StatCard>
      </Grid>

      <Section>Throughput history</Section>
      {timeline.length === 0 ? (
        <EmptyState label="No runs for this model in the selected period. Widen the window, or select All." />
      ) : (
        <TrendChart timeline={timeline} />
      )}

      {concurrencyCurves.length > 0 && (
        <>
          <Section>Concurrency</Section>
          <ConcurrencyCharts>
            {concurrencyCurves.map((curve) => (
              <ConcurrencyChart key={curve.runId + curve.hardwareLabel} curve={curve} />
            ))}
          </ConcurrencyCharts>
        </>
      )}

      {timeline.length > 0 && (
        <>
          <Section>Every run</Section>
          <SortableTable
            columns={columns}
            rows={timeline}
            rowKey={(t) => t.runId}
            onRowClick={(t) => navigate(`/run/${t.runId}`)}
            initialSortKey="date"
            initialSortDir="desc"
          />
        </>
      )}
    </Page>
  );
}
