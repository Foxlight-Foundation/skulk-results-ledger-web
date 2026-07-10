import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';

import { CaveatList, Chip, PassRateChip } from '../components/Chip';
import { Eyebrow, Grid, InlineLink, Muted, Page, Panel, Row } from '../components/primitives';
import { SortableTable, type Column } from '../components/SortableTable';
import { ErrorState, LoadingState } from '../components/States';
import type { RunModelResult } from '../data/schema';
import { formatBytes, formatDateTime, formatSeconds, formatTps } from '../data/format';
import { useRunDetail } from '../data/useLedger';

const Title = styled.h1`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  color: ${({ theme }) => theme.colors.text1};
  word-break: break-all;
`;

const Section = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  margin: ${({ theme }) => theme.spacing.xl} 0 ${({ theme }) => theme.spacing.md};
`;

const Meta = styled(Panel)`
  padding: ${({ theme }) => theme.spacing.md};
`;

const MetaLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.eyebrow};
  color: ${({ theme }) => theme.colors.text3};
`;

const MetaValue = styled.div`
  color: ${({ theme }) => theme.colors.text1};
  margin-top: 4px;
  word-break: break-word;
`;

const IssueRow = styled.div<{ $sev: string }>`
  padding: 10px 14px;
  border-left: 3px solid
    ${({ theme, $sev }) => ($sev === 'error' ? theme.colors.fail : theme.colors.warn)};
  background: ${({ theme, $sev }) => ($sev === 'error' ? theme.colors.failWash : theme.colors.warnWash)};
  border-radius: ${({ theme }) => theme.radii.sm};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

export function RunPage() {
  const { runId } = useParams();
  const { data, error, loading } = useRunDetail(runId);
  const navigate = useNavigate();

  if (loading) return <LoadingState label="Loading run…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <ErrorState error="Run not found." />;

  const total = data.passCount + data.failCount;

  const columns: Column<RunModelResult>[] = [
    {
      key: 'model',
      header: 'Model',
      sortValue: (m) => m.modelId,
      render: (m) => (
        <InlineLink to={`/model/${m.modelId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}>
          {m.modelId.split('/').pop()}
        </InlineLink>
      ),
    },
    {
      key: 'decode',
      header: 'Decode tok/s',
      align: 'right',
      sortValue: (m) => m.decodeTps.median ?? -1,
      render: (m) => formatTps(m.decodeTps.median),
    },
    {
      key: 'ttft',
      header: 'TTFT',
      align: 'right',
      sortValue: (m) => m.ttft.median ?? Number.MAX_SAFE_INTEGER,
      render: (m) => formatSeconds(m.ttft.median),
    },
    {
      key: 'hardware',
      header: 'Hardware',
      sortValue: (m) => (m.hardware.known ? m.hardware.label : ''),
      render: (m) =>
        m.hardware.known ? (
          <span
            style={{ whiteSpace: 'nowrap' }}
            title={
              m.hardwareAttribution === 'placement'
                ? 'Exact: from this run\u2019s recorded placement nodes'
                : 'Whole-cluster shape; placement nodes not recorded'
            }
          >
            {m.hardware.label}
            {m.hardwareAttribution === 'cluster' && <Muted> (cluster)</Muted>}
          </span>
        ) : (
          <Muted>unknown</Muted>
        ),
    },
    {
      key: 'samples',
      header: 'Samples',
      align: 'center',
      render: (m) => (
        <span>
          {m.decodeTps.sampleCount}
          {m.decodeTps.shortSampleCount > 0 && <Muted> +{m.decodeTps.shortSampleCount} short</Muted>}
        </span>
      ),
    },
    {
      key: 'pass',
      header: 'Results',
      align: 'center',
      sortValue: (m) => m.passCount,
      render: (m) => `${m.passCount}/${m.passCount + m.failCount}`,
    },
    {
      key: 'caveats',
      header: 'Caveats',
      render: (m) => (
        <Row $gap="5px" $wrap>
          <CaveatList caveats={m.caveats} />
        </Row>
      ),
    },
  ];

  return (
    <Page>
      <Eyebrow>Run</Eyebrow>
      <Title>{data.runId}</Title>
      <Row $gap="8px" $wrap style={{ margin: '12px 0 4px' }}>
        <PassRateChip passRate={total ? data.passCount / total : 0} />
        <Chip $tone="neutral">{data.mode}</Chip>
        <Chip $tone="neutral">{data.cacheClass} cache</Chip>
        {data.topologyLabel && <Chip>{data.topologyLabel}</Chip>}
        {data.hardware.known && <Chip $tone="cyan">{data.hardware.label}</Chip>}
        <CaveatList caveats={data.caveats} />
      </Row>

      <Section>Provenance</Section>
      <Grid $min="220px">
        <Meta>
          <MetaLabel>Started</MetaLabel>
          <MetaValue>{formatDateTime(data.startedAt)}</MetaValue>
        </Meta>
        <Meta>
          <MetaLabel>Suite · models</MetaLabel>
          <MetaValue>
            {data.testSet} · {data.modelSet}
          </MetaValue>
        </Meta>
        <Meta>
          <MetaLabel>Skulk</MetaLabel>
          <MetaValue>
            {data.skulkVersion ?? 'unknown'}
            {data.skulkCommit ? ` · ${data.skulkCommit}` : ''}
          </MetaValue>
        </Meta>
        <Meta>
          <MetaLabel>Runtime</MetaLabel>
          <MetaValue>{data.platform ?? 'unknown'}{data.python ? ` · py ${data.python}` : ''}</MetaValue>
        </Meta>
        {data.repositories.map((r) => (
          <Meta key={r.name}>
            <MetaLabel>{r.name.split('/').pop()}</MetaLabel>
            <MetaValue>
              {r.branch ?? '—'} {r.commit ? `· ${r.commit}` : ''}
            </MetaValue>
          </Meta>
        ))}
      </Grid>

      {data.nodes.length > 0 && (
        <>
          <Section>Cluster</Section>
          <Grid $min="200px">
            {data.nodes.map((n) => (
              <Meta key={n.nodeId}>
                <MetaLabel>{n.friendlyName ?? n.nodeId.slice(0, 10)}</MetaLabel>
                <MetaValue>
                  {formatBytes(n.ramTotalBytes)}
                  {n.acceleratorVendor ? ` · ${n.acceleratorVendor}` : ''}
                  {n.skulkVersion ? ` · ${n.skulkVersion}` : ''}
                </MetaValue>
              </Meta>
            ))}
          </Grid>
        </>
      )}

      <Section>Per-model results</Section>
      <SortableTable
        columns={columns}
        rows={data.models}
        rowKey={(m) => m.modelId}
        onRowClick={(m) =>
          navigate(`/model/${m.modelId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`)
        }
        initialSortKey="decode"
        initialSortDir="desc"
      />

      {data.issues.length > 0 && (
        <>
          <Section>Issues ({data.issues.length})</Section>
          {data.issues.map((issue, i) => (
            <IssueRow key={i} $sev={issue.severity}>
              <strong>{issue.severity}</strong> · {issue.message}
            </IssueRow>
          ))}
        </>
      )}
    </Page>
  );
}
