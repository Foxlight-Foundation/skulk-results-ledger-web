import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

import { FamilyBadge, SeriesStatusChip } from '../components/Chip';
import { SpeedScatter, type ExplorerSeriesRow } from '../components/charts/SpeedScatter';
import { Eyebrow, Muted, Page, Panel, Row } from '../components/primitives';
import { SortableTable, type Column } from '../components/SortableTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { EngineFamily, MetricSource, ProvenanceTier } from '../data/schema';
import { FAMILY_META, formatPercent, formatSeconds, formatTps } from '../data/format';
import {
  chooseDefaultContext,
  contextFromSearch,
  matchesContext,
  summarizeSeries,
  type SeriesContext,
} from '../data/series';
import { useIndex } from '../data/useLedger';
import { useWindow } from '../data/useWindow';

const Hero = styled.header`
  padding: ${({ theme }) => `${theme.spacing.xl} 0 ${theme.spacing.lg}`};
`;
const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.hero};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.tight};
  line-height: ${({ theme }) => theme.typography.lineHeight.display};
`;
const Sub = styled.p`
  color: ${({ theme }) => theme.colors.text2};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  max-width: 68ch;
  margin-top: ${({ theme }) => theme.spacing.md};
`;
const Controls = styled(Panel)`
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => `${theme.spacing.lg} 0`};
  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
  }
`;
const Control = styled.label`
  display: grid;
  gap: 5px;
  color: ${({ theme }) => theme.colors.text3};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  text-transform: uppercase;
`;
const controlCss = `
  width: 100%;
  border: 1px solid rgba(240,237,232,.14);
  border-radius: 8px;
  padding: 9px 10px;
  background: #0b1124;
  color: #f0ede8;
  font: inherit;
  text-transform: none;
`;
const Select = styled.select`${controlCss}`;
const Search = styled.input`${controlCss}`;
const Section = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  margin: ${({ theme }) => `${theme.spacing.xl} 0 ${theme.spacing.md}`};
`;
const Coverage = styled(Panel)`
  padding: ${({ theme }) => theme.spacing.md};
`;

const CONTEXT_STORAGE = 'skulk-ledger-series-context';

function sessionContext(): Partial<SeriesContext> {
  try {
    return JSON.parse(sessionStorage.getItem(CONTEXT_STORAGE) ?? '{}') as Partial<SeriesContext>;
  } catch {
    return {};
  }
}

function setParam(
  params: globalThis.URLSearchParams,
  update: (next: globalThis.URLSearchParams) => void,
  key: string,
  value: string,
): void {
  const next = new globalThis.URLSearchParams(params);
  next.set(key, value);
  update(next);
}

export function ExplorerPage() {
  const { data, error, loading } = useIndex();
  const { window, now } = useWindow();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const stored = useMemo(sessionContext, []);
  const defaultContext = useMemo(
    () => (data ? chooseDefaultContext(data.series, window, now) : null),
    [data, window, now],
  );
  const context = useMemo<SeriesContext | null>(
    () => contextFromSearch(params, defaultContext, stored),
    [defaultContext, params, stored],
  );
  const hardware = params.get('hardware') ?? 'all';
  const backend = params.get('backend') ?? 'all';
  const family = (params.get('family') ?? 'all') as EngineFamily | 'all';
  const tier = (params.get('tier') ?? 'foxlight') as ProvenanceTier;
  const query = params.get('q') ?? '';

  useEffect(() => {
    if (context == null) return;
    try {
      sessionStorage.setItem(CONTEXT_STORAGE, JSON.stringify(context));
    } catch {
      // URL state remains authoritative when session storage is unavailable.
    }
    const required = { suite: context.suiteId, test: context.testName, protocol: context.protocolId, source: context.source };
    if (Object.entries(required).some(([key]) => params.get(key) == null)) {
      const next = new globalThis.URLSearchParams(params);
      for (const [key, value] of Object.entries(required)) if (next.get(key) == null) next.set(key, value);
      setParams(next, { replace: true });
    }
  }, [context, params, setParams]);

  const options = useMemo(() => {
    const series = data?.series.filter((item) => item.tier === 'foxlight' && item.comparable) ?? [];
    const suites = [...new Set(series.map((item) => item.suiteId))].sort();
    const tests = [...new Set(series.filter((item) => item.suiteId === context?.suiteId).map((item) => item.testName))].sort();
    const protocols = [...new Set(series.filter((item) => item.suiteId === context?.suiteId && item.testName === context?.testName).map((item) => item.protocolId).filter((value): value is string => value != null))].sort();
    return { suites, tests, protocols };
  }, [data, context?.suiteId, context?.testName]);

  const rows = useMemo<ExplorerSeriesRow[]>(() => {
    if (!data || context == null) return [];
    return data.series
      .filter((item) => item.tier === tier && item.comparable && matchesContext(item, context))
      .filter((item) => hardware === 'all' || item.hardware.label === hardware)
      .filter((item) => backend === 'all' || item.resolvedBackends.includes(backend))
      .filter((item) => family === 'all' || item.family === family)
      .filter((item) => !query || item.displayName.toLowerCase().includes(query.toLowerCase()))
      .map((series) => ({ series, summary: summarizeSeries(series, window, now) }))
      .filter((row) => row.summary.runCount > 0)
      .sort((a, b) => (b.summary.medianTps ?? -1) - (a.summary.medianTps ?? -1));
  }, [data, context, hardware, backend, family, tier, query, window, now]);

  const notObserved = useMemo(() => {
    if (!data) return [];
    const observed = new Set(rows.map((row) => row.series.modelId));
    return data.models.filter(
      (model) =>
        !observed.has(model.modelId) &&
        (family === 'all' || model.family === family) &&
        (!query || model.displayName.toLowerCase().includes(query.toLowerCase())),
    );
  }, [data, rows, family, query]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data || context == null) return <EmptyState label="No exact client observations are available." />;

  const columns: Column<ExplorerSeriesRow>[] = [
    {
      key: 'model', header: 'Model', sortValue: (row) => row.series.displayName,
      render: (row) => <Row $gap="8px"><strong>{row.series.displayName}</strong><FamilyBadge family={row.series.family} /></Row>,
    },
    { key: 'hardware', header: 'Hardware', sortValue: (row) => row.series.hardware.label, render: (row) => row.series.hardware.label },
    { key: 'backend', header: 'Backend', render: (row) => row.series.resolvedBackends.join(', ') },
    { key: 'tier', header: 'Provenance', render: (row) => row.series.tier },
    { key: 'test', header: 'Test', render: (row) => row.series.testName },
    { key: 'median', header: 'Median TPS', align: 'right', sortValue: (row) => row.summary.medianTps ?? -1, render: (row) => <strong>{formatTps(row.summary.medianTps)}</strong> },
    { key: 'latest', header: 'Latest TPS', align: 'right', sortValue: (row) => row.summary.latestTps ?? -1, render: (row) => formatTps(row.summary.latestTps) },
    { key: 'ttft', header: 'Median TTFT', align: 'right', render: (row) => formatSeconds(row.summary.medianTtftS) },
    { key: 'runs', header: 'Runs', align: 'right', sortValue: (row) => row.summary.runCount, render: (row) => row.summary.runCount },
    { key: 'cv', header: 'CV', align: 'right', sortValue: (row) => row.summary.coefficientOfVariation ?? Number.MAX_SAFE_INTEGER, render: (row) => formatPercent(row.summary.coefficientOfVariation, 1) },
    { key: 'status', header: 'Status', render: (row) => <SeriesStatusChip status={row.summary.status} /> },
  ];

  const updateContext = (updates: Partial<SeriesContext>) => {
    const next = new globalThis.URLSearchParams(params);
    const merged = { ...context, ...updates };
    next.set('suite', merged.suiteId);
    next.set('test', merged.testName);
    next.set('protocol', merged.protocolId);
    next.set('source', merged.source);
    setParams(next);
  };

  return (
    <Page>
      <Hero>
        <Eyebrow>Skulk results ledger</Eyebrow>
        <Title>Performance in context.</Title>
        <Sub>Every row is one model plus exact hardware, backend, test protocol, and metric source. “All hardware” expands the comparison; it never averages the fleet.</Sub>
      </Hero>
      <Controls aria-label="Benchmark context">
        <Control>Suite<Select value={context.suiteId} onChange={(event) => { const suiteId = event.target.value; const testName = data.series.find((item) => item.suiteId === suiteId && item.comparable)?.testName ?? ''; const protocolId = data.series.find((item) => item.suiteId === suiteId && item.testName === testName && item.protocolId)?.protocolId ?? ''; updateContext({ suiteId, testName, protocolId }); }}>{options.suites.map((value) => <option key={value}>{value}</option>)}</Select></Control>
        <Control>Test<Select value={context.testName} onChange={(event) => { const testName = event.target.value; const protocolId = data.series.find((item) => item.suiteId === context.suiteId && item.testName === testName && item.protocolId)?.protocolId ?? ''; updateContext({ testName, protocolId }); }}>{options.tests.map((value) => <option key={value}>{value}</option>)}</Select></Control>
        <Control>Protocol<Select value={context.protocolId} onChange={(event) => updateContext({ protocolId: event.target.value })}>{options.protocols.map((value) => <option key={value} value={value}>{value.slice(0, 12)}</option>)}</Select></Control>
        <Control>Metric source<Select value={context.source} onChange={(event) => updateContext({ source: event.target.value as MetricSource })}><option value="client_exact">Client exact</option><option value="engine_reported">Engine reported</option><option value="client_approx">Client approximate</option></Select></Control>
        <Control>Hardware<Select value={hardware} onChange={(event) => setParam(params, setParams, 'hardware', event.target.value)}><option value="all">All hardware</option>{data.hardwareLabels.map((value) => <option key={value}>{value}</option>)}</Select></Control>
        <Control>Backend<Select value={backend} onChange={(event) => setParam(params, setParams, 'backend', event.target.value)}><option value="all">All backends</option>{data.backends.map((value) => <option key={value}>{value}</option>)}</Select></Control>
        <Control>Family<Select value={family} onChange={(event) => setParam(params, setParams, 'family', event.target.value)}><option value="all">All families</option>{(['mlx', 'llama_cpp', 'llama_server'] as EngineFamily[]).map((value) => <option key={value} value={value}>{FAMILY_META[value].label}</option>)}</Select></Control>
        <Control>Provenance<Select value={tier} onChange={(event) => setParam(params, setParams, 'tier', event.target.value)}><option value="foxlight">Foxlight</option><option value="community">Community</option></Select></Control>
        <Control>Search<Search value={query} placeholder="Model name" onChange={(event) => setParam(params, setParams, 'q', event.target.value)} /></Control>
      </Controls>

      {rows.length > 0 ? <SpeedScatter rows={rows} /> : <EmptyState label="No observations match this exact context." />}
      <Section>Observed in this context</Section>
      {rows.length > 0 && <SortableTable columns={columns} rows={rows} rowKey={(row) => row.series.seriesId} onRowClick={(row) => navigate(`/model/${row.series.slug}?suite=${encodeURIComponent(row.series.suiteId)}&test=${encodeURIComponent(row.series.testName)}&protocol=${encodeURIComponent(row.series.protocolId ?? '')}&source=${row.series.source}&tier=${row.series.tier}&hardware=${row.series.seriesId}`)} initialSortKey="median" initialSortDir="desc" />}

      <Section>Not observed in this context</Section>
      <Coverage>
        {notObserved.length ? <Row $gap="8px" $wrap>{notObserved.map((model) => <Muted key={model.modelId}>{model.displayName}</Muted>)}</Row> : <Muted>Every matching model has an observation in this context.</Muted>}
      </Coverage>
    </Page>
  );
}
