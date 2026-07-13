import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { CaveatList, Chip } from '../components/Chip';
import { Eyebrow, Muted, Page, Row } from '../components/primitives';
import { SortableTable, type Column } from '../components/SortableTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { RunSummary } from '../data/schema';
import { formatDateTime } from '../data/format';
import { useIndex } from '../data/useLedger';
import { useWindow } from '../data/useWindow';
import { isWithinWindow } from '../data/window';

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.sectionH};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.section};
`;

const Sub = styled.p`
  color: ${({ theme }) => theme.colors.text2};
  max-width: 60ch;
  margin: ${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.lg};
`;

const Search = styled.input`
  width: 100%;
  max-width: 360px;
  background: ${({ theme }) => theme.colors.dusk};
  border: 1px solid ${({ theme }) => theme.colors.border1};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 10px 16px;
  color: ${({ theme }) => theme.colors.text1};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.borderAmber};
  }
`;

function ResultBar({ pass, fail }: { pass: number; fail: number }) {
  const total = pass + fail || 1;
  return (
    <Row $gap="8px">
      <span style={{ color: fail > 0 ? '#ff7a6b' : '#5fd0a6', fontVariantNumeric: 'tabular-nums' }}>
        {pass}/{pass + fail}
      </span>
      <div
        style={{
          width: 60,
          height: 6,
          borderRadius: 3,
          overflow: 'hidden',
          background: 'rgba(255,122,107,0.4)',
        }}
      >
        <div style={{ width: `${(pass / total) * 100}%`, height: '100%', background: '#5fd0a6' }} />
      </div>
    </Row>
  );
}

export function RunsPage() {
  const { data, error, loading } = useIndex();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const { window, now } = useWindow();

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.toLowerCase();
    // A run's timestamp is its finish (fall back to start); the window scopes
    // the feed to the selected period, a null timestamp is never hidden.
    return data.runs.filter((r) => {
      if (!isWithinWindow(r.finishedAt ?? r.startedAt, window, now)) return false;
      if (!q) return true;
      return (
        r.runId.toLowerCase().includes(q) ||
        r.modelSet.toLowerCase().includes(q) ||
        r.testSet.toLowerCase().includes(q)
      );
    });
  }, [data, query, window, now]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <ErrorState error="No index." />;

  const columns: Column<RunSummary>[] = [
    {
      key: 'date',
      header: 'When',
      sortValue: (r) => r.startedAt ?? '',
      render: (r) => formatDateTime(r.startedAt),
    },
    {
      key: 'suite',
      header: 'Suite / models',
      sortValue: (r) => r.testSet,
      render: (r) => (
        <span>
          <strong style={{ color: '#f0ede8' }}>{r.testSet}</strong> <Muted>· {r.modelSet}</Muted>{' '}
          {r.tier === 'community' && (
            <Chip $tone="amber" title={`Community submission by ${r.submitter ?? 'unknown'}; not independently verified`}>
              community
            </Chip>
          )}
        </span>
      ),
    },
    {
      key: 'results',
      header: 'Results',
      sortValue: (r) => (r.passCount + r.failCount ? r.passCount / (r.passCount + r.failCount) : 0),
      render: (r) => <ResultBar pass={r.passCount} fail={r.failCount} />,
    },
    {
      key: 'hardware',
      header: 'Hardware',
      sortValue: (r) => (r.hardware.known ? r.hardware.label : ''),
      render: (r) =>
        r.hardware.known ? (
          <span style={{ whiteSpace: 'nowrap' }}>{r.hardware.label}</span>
        ) : (
          <Muted>{r.nodeCount ? `${r.nodeCount} nodes` : 'unknown'}</Muted>
        ),
    },
    {
      key: 'version',
      header: 'Skulk',
      render: (r) => (r.skulkVersion ? <Muted>{r.skulkVersion}</Muted> : <Muted>—</Muted>),
    },
    {
      key: 'cache',
      header: 'Cache',
      align: 'center',
      render: (r) => <Chip $tone="neutral">{r.cacheClass}</Chip>,
    },
    {
      key: 'caveats',
      header: 'Caveats',
      render: (r) => (
        <Row $gap="5px" $wrap>
          <CaveatList caveats={r.caveats} />
        </Row>
      ),
    },
  ];

  return (
    <Page>
      <Eyebrow>Audit trail</Eyebrow>
      <Title>Every run</Title>
      <Sub>
        Reverse-chronological, unfiltered; Failed, partial, and issue-marked runs included.{' '}
        {data.runCount} runs in the current data set.
      </Sub>
      <Search placeholder="Filter by run id, suite, or model set…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {rows.length === 0 ? (
        <EmptyState label="No runs in this period. Widen the window, or select All." />
      ) : (
        <SortableTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.runId}
          onRowClick={(r) => navigate(`/run/${r.runId}`)}
          initialSortKey="date"
          initialSortDir="desc"
        />
      )}
    </Page>
  );
}
