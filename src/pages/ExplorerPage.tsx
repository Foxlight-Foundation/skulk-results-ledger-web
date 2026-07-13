import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { CaveatList, FamilyBadge, PassRateChip } from '../components/Chip';
import { SpeedScatter } from '../components/charts/SpeedScatter';
import { Eyebrow, Muted, Page, Panel, Row } from '../components/primitives';
import { SortableTable, type Column } from '../components/SortableTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { EngineFamily, ModelRollup } from '../data/schema';
import { FAMILY_META, formatSeconds, formatTps } from '../data/format';
import { useIndex } from '../data/useLedger';
import { useWindow } from '../data/useWindow';
import { windowRollup } from '../data/window';
import { TimeWindowControl } from '../components/TimeWindowControl';

const Hero = styled.header`
  padding: ${({ theme }) => `${theme.spacing.xl} 0 ${theme.spacing.lg}`};
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.hero};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.tight};
  line-height: ${({ theme }) => theme.typography.lineHeight.display};
  max-width: 16ch;
`;

const Sub = styled.p`
  color: ${({ theme }) => theme.colors.text2};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  max-width: 62ch;
  margin-top: ${({ theme }) => theme.spacing.md};
`;

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.lg} 0 ${({ theme }) => theme.spacing.xl};
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const Stat = styled(Panel)`
  padding: ${({ theme }) => theme.spacing.md};
`;

const StatNum = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.display};
  font-size: 1.9rem;
  color: ${({ theme }) => theme.colors.text1};
`;

const StatLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.eyebrow};
  color: ${({ theme }) => theme.colors.text3};
  margin-top: 4px;
`;

const Controls = styled(Row)`
  margin: ${({ theme }) => theme.spacing.xl} 0 ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`;

const Search = styled.input`
  flex: 1;
  min-width: 200px;
  background: ${({ theme }) => theme.colors.dusk};
  border: 1px solid ${({ theme }) => theme.colors.border1};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 10px 16px;
  color: ${({ theme }) => theme.colors.text1};
  font-family: ${({ theme }) => theme.typography.fontFamily.body};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  &::placeholder {
    color: ${({ theme }) => theme.colors.text4};
  }
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.borderAmber};
  }
`;

const FilterBtn = styled.button<{ $active?: boolean }>`
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 8px 15px;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  cursor: pointer;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.borderAmber : theme.colors.border1)};
  background: ${({ theme, $active }) => ($active ? theme.colors.amberWash : 'transparent')};
  color: ${({ theme, $active }) => ($active ? theme.colors.amberHi : theme.colors.text2)};
  transition: all 130ms ease;
  &:hover {
    border-color: ${({ theme }) => theme.colors.border2};
    color: ${({ theme }) => theme.colors.text1};
  }
`;

const SectionLabel = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  margin: ${({ theme }) => theme.spacing.xl} 0 ${({ theme }) => theme.spacing.md};
`;

const HiddenNote = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  color: ${({ theme }) => theme.colors.text3};
`;

const FAMILIES: (EngineFamily | 'all')[] = ['all', 'mlx', 'llama_cpp'];

const HardwareSelect = styled.select`
  background: ${({ theme }) => theme.colors.dusk};
  border: 1px solid ${({ theme }) => theme.colors.border1};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 9px 14px;
  color: ${({ theme }) => theme.colors.text2};
  font-family: ${({ theme }) => theme.typography.fontFamily.body};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  max-width: 320px;
  cursor: pointer;
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.borderAmber};
  }
`;

// Floor for the "Skulk versions" stat: the count of released versions in the
// Skulk CHANGELOG at build time (8, excluding [Unreleased]). Older runs predate
// runtime fingerprints and so report no version, which would understate history
// to zero. The displayed count never drops below this baseline.
const SKULK_VERSION_BASELINE = 8;

export function ExplorerPage() {
  const { data, error, loading } = useIndex();
  const navigate = useNavigate();
  const [family, setFamily] = useState<EngineFamily | 'all'>('all');
  const [hardware, setHardware] = useState('all');
  const [query, setQuery] = useState('');

  const { window, now } = useWindow();

  // Window each rollup's headline medians and cells, then apply filters. The
  // windowed decodeTpsTypical / ttft / hardwareCells / counts override the
  // all-time baked values so every number reflects the selected period; a
  // model with no runs in the window is hidden (its absence is bound to the
  // period, not "never tested"), and counted for the indicator below.
  const { models, hiddenByWindow } = useMemo(() => {
    if (!data) return { models: [] as ModelRollup[], hiddenByWindow: 0 };
    const base = data.models.filter((m) => {
      if (family !== 'all' && m.family !== family) return false;
      if (query && !m.displayName.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    const visible: ModelRollup[] = [];
    let hidden = 0;
    for (const m of base) {
      const w = windowRollup(m, window, now);
      if (!w.hasWindowData) {
        hidden += 1;
        continue;
      }
      if (hardware !== 'all' && !w.hardwareCells.some((c) => c.label === hardware)) continue;
      visible.push({
        ...m,
        decodeTpsTypical: w.decodeTpsTypical,
        decodeTpsLatest: w.decodeTpsLatest,
        ttftLatestMedian: w.ttftLatestMedian,
        hardwareCells: w.hardwareCells,
        credibleRunCount: w.credibleRunCount,
        runCount: w.runCountInWindow,
        communityRunCount: w.communityRunCount,
      });
    }
    visible.sort((a, b) => (b.decodeTpsTypical ?? -1) - (a.decodeTpsTypical ?? -1));
    return { models: visible, hiddenByWindow: hidden };
  }, [data, family, hardware, query, window, now]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <ErrorState error="No index." />;

  const columns: Column<ModelRollup>[] = [
    {
      key: 'name',
      header: 'Model',
      sortValue: (m) => m.displayName,
      render: (m) => (
        <Row $gap="10px">
          <strong style={{ color: 'inherit' }}>{m.displayName}</strong>
          <FamilyBadge family={m.family} />
        </Row>
      ),
    },
    {
      key: 'decode',
      header: 'Typical tok/s',
      align: 'right',
      sortValue: (m) => m.decodeTpsTypical ?? -1,
      render: (m) => <strong style={{ color: '#f0ede8' }}>{formatTps(m.decodeTpsTypical)}</strong>,
    },
    {
      key: 'ttft',
      header: 'TTFT',
      align: 'right',
      sortValue: (m) => m.ttftLatestMedian ?? Number.MAX_SAFE_INTEGER,
      render: (m) => formatSeconds(m.ttftLatestMedian),
    },
    {
      key: 'nodes',
      header: 'Nodes',
      align: 'center',
      sortValue: (m) => m.nodeCountsObserved[0] ?? 0,
      render: (m) => (m.nodeCountsObserved.length ? m.nodeCountsObserved.join(', ') : '—'),
    },
    {
      key: 'runs',
      header: 'Runs',
      align: 'right',
      sortValue: (m) => m.runCount,
      render: (m) => (
        <span>
          {m.runCount} <Muted>({m.credibleRunCount} cred)</Muted>
        </span>
      ),
    },
    {
      key: 'pass',
      header: 'Pass rate',
      align: 'center',
      sortValue: (m) => m.passRate,
      render: (m) => <PassRateChip passRate={m.passRate} />,
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
      <Hero>
        <Eyebrow>Skulk results ledger</Eyebrow>
        <Title>Skulk performance.</Title>
        <Sub>
          Every benchmark run across the Foxlight fleet. Throughput is the median of valid samples
          only. Click any point or row for the full run behind it.
        </Sub>
      </Hero>

      <Stats>
        <Stat>
          <StatNum>{data.runCount}</StatNum>
          <StatLabel>runs recorded</StatLabel>
        </Stat>
        <Stat>
          <StatNum>{data.modelCount}</StatNum>
          <StatLabel>models measured</StatLabel>
        </Stat>
        <Stat>
          <StatNum>{data.suiteCount}</StatNum>
          <StatLabel>test suites</StatLabel>
        </Stat>
        <Stat>
          <StatNum>{Math.max(data.skulkVersions.length, SKULK_VERSION_BASELINE)}</StatNum>
          <StatLabel>Skulk versions</StatLabel>
        </Stat>
      </Stats>

      {models.some((m) => m.decodeTpsTypical != null && m.ttftLatestMedian != null) ? (
        <SpeedScatter models={models} />
      ) : (
        <EmptyState label="No models have both a credible throughput and a TTFT under this filter." />
      )}

      <Controls $gap="8px">
        <TimeWindowControl />
        <Search
          placeholder="Filter models…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {FAMILIES.map((f) => (
          <FilterBtn key={f} $active={family === f} onClick={() => setFamily(f)}>
            {f === 'all' ? 'All engines' : FAMILY_META[f].label}
          </FilterBtn>
        ))}
        <HardwareSelect value={hardware} onChange={(e) => setHardware(e.target.value)}>
          <option value="all">All hardware</option>
          {data.hardwareLabels.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </HardwareSelect>
      </Controls>

      <SectionLabel>All models</SectionLabel>
      {hiddenByWindow > 0 && (
        <HiddenNote>
          {hiddenByWindow} {hiddenByWindow === 1 ? 'model' : 'models'} hidden with no runs in this
          period. Widen the window to see them.
        </HiddenNote>
      )}
      {models.length === 0 ? (
        <EmptyState
          label={
            hiddenByWindow > 0
              ? 'No runs in this period. Widen the window, or select All.'
              : 'No models match your filter.'
          }
        />
      ) : (
        <SortableTable
          columns={columns}
          rows={models}
          rowKey={(m) => m.slug}
          onRowClick={(m) => navigate(`/model/${m.slug}`)}
          initialSortKey="decode"
          initialSortDir="desc"
        />
      )}
    </Page>
  );
}
