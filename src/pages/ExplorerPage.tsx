import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { CaveatList, FamilyBadge, PassRateChip } from '../components/Chip';
import { SpeedScatter } from '../components/charts/SpeedScatter';
import { Eyebrow, Muted, Page, Panel, Row } from '../components/primitives';
import { SortableTable, type Column } from '../components/SortableTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { Caveat, EngineFamily, ModelRollup } from '../data/schema';
import { FAMILY_META, formatSeconds, formatTps } from '../data/format';
import { useIndex } from '../data/useLedger';
import { useWindow } from '../data/useWindow';
import {
  hasTextGenerationWorkload,
  NON_TEXT_WORKLOADS,
  TEXT_GENERATION_WORKLOADS,
  workloadLabel,
} from '../data/workload';
import { isWithinWindow, type WindowedRollup, windowRollup } from '../data/window';

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
  /* Deliberate full-opacity white, overriding the theme's warm-cream text
     ceiling: the muted token was illegible against the starfield background
     and this note must always read. */
  color: #ffffff;
`;

const SectionNote = styled.p`
  color: ${({ theme }) => theme.colors.text2};
  margin: ${({ theme }) => `-${theme.spacing.sm} 0 ${theme.spacing.md}`};
  max-width: 74ch;
`;

const IndicativeMark = styled.span`
  display: block;
  color: ${({ theme }) => theme.colors.amberHi};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  font-weight: 500;
  line-height: 1.2;
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

function scopedModel(model: ModelRollup, scoped: WindowedRollup): ModelRollup {
  const caveats: Caveat[] = model.caveats.filter((caveat) => caveat !== 'has_failures');
  if (scoped.hasFailuresInWindow) caveats.push('has_failures');
  return {
    ...model,
    decodeTpsTypical: scoped.decodeTpsTypical,
    decodeTpsIndicative: scoped.decodeTpsIndicative,
    decodeTpsLatest: scoped.decodeTpsLatest,
    decodeTpsLatestIndicative: scoped.decodeTpsLatestIndicative,
    ttftLatestMedian: scoped.ttftLatestMedian,
    hardwareCells: scoped.hardwareCells,
    credibleRunCount: scoped.credibleRunCount,
    indicativeRunCount: scoped.indicativeRunCount,
    runCount: scoped.runCountInWindow,
    communityRunCount: scoped.communityRunCount,
    passRate: scoped.passRate,
    caveats,
    nodeCountsObserved: scoped.nodeCountsObserved,
  };
}

function throughputSortValue(model: ModelRollup): number {
  return model.decodeTpsTypical ?? model.decodeTpsIndicative ?? -1;
}

function ThroughputValue({ model }: { model: ModelRollup }) {
  if (model.decodeTpsTypical != null) {
    return <strong style={{ color: '#f0ede8' }}>{formatTps(model.decodeTpsTypical)}</strong>;
  }
  if (model.decodeTpsIndicative != null) {
    return (
      <span title="Measured, physically plausible throughput from low-sample runs; not a credible headline.">
        <strong style={{ color: '#f0ede8', opacity: 0.78 }}>
          {formatTps(model.decodeTpsIndicative)}
        </strong>
        <IndicativeMark>indicative</IndicativeMark>
      </span>
    );
  }
  return <Muted title="No usable generated-text throughput measurement in this period.">N/A</Muted>;
}

function TtftValue({ value }: { value: number | null }) {
  return value == null ? (
    <Muted title="No time-to-first-token measurement in this period.">N/A</Muted>
  ) : (
    <>{formatSeconds(value)}</>
  );
}

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
  const { textModels, otherModels, hiddenByWindow } = useMemo(() => {
    if (!data) {
      return {
        textModels: [] as ModelRollup[],
        otherModels: [] as ModelRollup[],
        hiddenByWindow: 0,
      };
    }
    const base = data.models.filter((m) => {
      if (family !== 'all' && m.family !== family) return false;
      if (query && !m.displayName.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    const visibleText: ModelRollup[] = [];
    const visibleOther: ModelRollup[] = [];
    let hidden = 0;
    for (const m of base) {
      const isTextGeneration = hasTextGenerationWorkload(m.workloads);
      const workloads = isTextGeneration ? TEXT_GENERATION_WORKLOADS : NON_TEXT_WORKLOADS;
      // The period indicator counts models with no data in the window at all,
      // independent of the hardware filter, so compute the unscoped rollup for
      // that decision first.
      const w = windowRollup(m, window, now, undefined, workloads);
      if (!w.hasWindowData) {
        if (isTextGeneration) hidden += 1;
        continue;
      }
      // When a specific hardware is selected, recompute the row from ONLY that
      // hardware's points so every displayed metric (typical tok/s, TTFT,
      // nodes, runs, pass rate) reflects that hardware and never blends the
      // other shapes the model also ran on in the window. A model not run on
      // the selected hardware in the period drops out here (hidden by hardware,
      // not by window, so it is not counted in the period indicator).
      const scoped =
        hardware === 'all' ? w : windowRollup(m, window, now, hardware, workloads);
      // Require a first-party (foxlight) cell on the selected hardware, not just
      // any windowed point: hardwareCells are foxlight-only, so a model with
      // only community points on this shape in the period has an empty scoped
      // cell and no headline number, and must not surface under the hardware
      // filter (this preserves the pre-fix `hardwareCells.some(...)` predicate,
      // which keyed on foxlight cells; tiers never blend).
      if (hardware !== 'all' && !scoped.hardwareCells.some((c) => c.label === hardware))
        continue;
      const visible = scopedModel(m, scoped);
      if (isTextGeneration) visibleText.push(visible);
      else visibleOther.push(visible);
    }
    visibleText.sort((a, b) => throughputSortValue(b) - throughputSortValue(a));
    visibleOther.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return { textModels: visibleText, otherModels: visibleOther, hiddenByWindow: hidden };
  }, [data, family, hardware, query, window, now]);

  // The Period control sits above these tiles, so the tiles reflect the same
  // window: runs, models, suites, and versions observed in the selected period
  // (all-time when the window is All). Computed from the index run summaries,
  // which carry the timestamp / test set / version each tile needs.
  const periodStats = useMemo(() => {
    if (!data) return { runCount: 0, modelCount: 0, suiteCount: 0, versionCount: 0 };
    const runs = data.runs.filter((r) => isWithinWindow(r.finishedAt ?? r.startedAt, window, now));
    const suites = new Set(runs.map((r) => r.testSet));
    const versions = new Set(
      runs.map((r) => r.skulkVersion).filter((v): v is string => v != null),
    );
    const modelCount = data.models.filter(
      (m) =>
        hasTextGenerationWorkload(m.workloads) &&
        windowRollup(m, window, now, undefined, TEXT_GENERATION_WORKLOADS).hasWindowData,
    ).length;
    const versionCount =
      window == null ? Math.max(versions.size, SKULK_VERSION_BASELINE) : versions.size;
    return { runCount: runs.length, modelCount, suiteCount: suites.size, versionCount };
  }, [data, window, now]);

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
      sortValue: throughputSortValue,
      render: (m) => <ThroughputValue model={m} />,
    },
    {
      key: 'ttft',
      header: 'TTFT',
      align: 'right',
      sortValue: (m) => m.ttftLatestMedian ?? Number.MAX_SAFE_INTEGER,
      render: (m) => <TtftValue value={m.ttftLatestMedian} />,
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
          {m.runCount}{' '}
          <Muted>
            ({m.credibleRunCount} cred
            {m.indicativeRunCount > 0 ? ` · ${m.indicativeRunCount} ind` : ''})
          </Muted>
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

  const otherColumns: Column<ModelRollup>[] = [
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
      key: 'workload',
      header: 'Workload',
      sortValue: (m) => workloadLabel(m.workloads),
      render: (m) => workloadLabel(m.workloads),
    },
    {
      key: 'nodes',
      header: 'Nodes',
      align: 'center',
      sortValue: (m) => m.nodeCountsObserved[0] ?? 0,
      render: (m) => (m.nodeCountsObserved.length ? m.nodeCountsObserved.join(', ') : 'N/A'),
    },
    {
      key: 'runs',
      header: 'Runs',
      align: 'right',
      sortValue: (m) => m.runCount,
      render: (m) => m.runCount,
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
          Generated-text performance across the Foxlight fleet. Credible throughput remains the
          headline; physically plausible low-sample measurements are labeled indicative instead of
          appearing missing. Click any point or row for the full run behind it.
        </Sub>
      </Hero>

      <Stats>
        <Stat>
          <StatNum>{periodStats.runCount}</StatNum>
          <StatLabel>runs recorded</StatLabel>
        </Stat>
        <Stat>
          <StatNum>{periodStats.modelCount}</StatNum>
          <StatLabel>text models measured</StatLabel>
        </Stat>
        <Stat>
          <StatNum>{periodStats.suiteCount}</StatNum>
          <StatLabel>test suites</StatLabel>
        </Stat>
        <Stat>
          <StatNum>{periodStats.versionCount}</StatNum>
          <StatLabel>Skulk versions</StatLabel>
        </Stat>
      </Stats>

      {textModels.some(
        (m) =>
          (m.decodeTpsTypical != null || m.decodeTpsIndicative != null) &&
          m.ttftLatestMedian != null,
      ) ? (
        <SpeedScatter models={textModels} />
      ) : (
        <EmptyState label="No text models have measured throughput and TTFT under this filter." />
      )}

      <Controls $gap="8px">
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

      <SectionLabel>Text generation</SectionLabel>
      <SectionNote>
        Chat, code, tools, and vision-to-text workloads. Indicative values are measured and
        physically plausible, but do not meet the strict per-run sample threshold.
      </SectionNote>
      {hiddenByWindow > 0 && (
        <HiddenNote>
          {hiddenByWindow} {hiddenByWindow === 1 ? 'model' : 'models'} hidden with no runs in this
          period. Widen the window to see them.
        </HiddenNote>
      )}
      {textModels.length === 0 ? (
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
          rows={textModels}
          rowKey={(m) => m.slug}
          onRowClick={(m) => navigate(`/model/${m.slug}`)}
          initialSortKey="decode"
          initialSortDir="desc"
        />
      )}

      {otherModels.length > 0 && (
        <>
          <SectionLabel>Other workloads</SectionLabel>
          <SectionNote>
            Speech, audio, and embedding runs use task-specific performance units, so they are not
            presented as generated tokens per second or time to first token.
          </SectionNote>
          <SortableTable
            columns={otherColumns}
            rows={otherModels}
            rowKey={(m) => m.slug}
            onRowClick={(m) => navigate(`/model/${m.slug}`)}
            initialSortKey="workload"
            initialSortDir="asc"
          />
        </>
      )}
    </Page>
  );
}
