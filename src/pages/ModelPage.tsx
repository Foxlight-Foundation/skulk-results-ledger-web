import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';

import { CaveatList, Chip, FamilyBadge, PassRateChip } from '../components/Chip';
import { TrendChart } from '../components/charts/TrendChart';
import { BigNumber, Eyebrow, Grid, InlineLink, Muted, Page, Panel, Row } from '../components/primitives';
import { SortableTable, type Column } from '../components/SortableTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { ModelTimePoint } from '../data/schema';
import { formatDate, formatSeconds, formatTps } from '../data/format';
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
  const timeline = data.timeline.filter((t) => isWithinWindow(t.startedAt, window, now));

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
          {data.nodeCountsObserved.length > 0 && (
            <Chip>{data.nodeCountsObserved.join('/')}-node</Chip>
          )}
          {w.hardwareCells
            .filter((c) => c.classes.some((x) => x !== 'unknown'))
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
        <>
          <TrendChart timeline={timeline} />

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
