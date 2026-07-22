import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

import { Chip, FamilyBadge, SeriesStatusChip } from '../components/Chip';
import { ConcurrencyChart } from '../components/charts/ConcurrencyChart';
import { TrendChart, type TrendSeriesRow } from '../components/charts/TrendChart';
import { BigNumber, Eyebrow, Grid, Muted, Page, Panel, Row } from '../components/primitives';
import { SortableTable, type Column } from '../components/SortableTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { MetricSource, ProvenanceTier } from '../data/schema';
import { formatDate, formatPercent, formatSeconds, formatTps } from '../data/format';
import { chooseDefaultContext, matchesContext, pointsInWindow, summarizeSeries } from '../data/series';
import { useModelHistory } from '../data/useLedger';
import { useWindow } from '../data/useWindow';
import { isWithinWindow } from '../data/window';

const Name = styled.h1`font-size: ${({ theme }) => theme.typography.fontSize.sectionH}; word-break: break-word;`;
const Section = styled.h2`font-size: ${({ theme }) => theme.typography.fontSize.xl}; margin: ${({ theme }) => `${theme.spacing.xl} 0 ${theme.spacing.md}`};`;
const StatCard = styled(Panel)`padding: ${({ theme }) => theme.spacing.md};`;
const StatLabel = styled.div`font-family: ${({ theme }) => theme.typography.fontFamily.mono}; font-size: ${({ theme }) => theme.typography.fontSize.eyebrow}; text-transform: uppercase; color: ${({ theme }) => theme.colors.text3}; margin-top: 6px;`;
const Controls = styled(Panel)`display: grid; grid-template-columns: repeat(5,minmax(130px,1fr)); gap: 10px; padding: 14px; margin: 18px 0; @media(max-width:900px){grid-template-columns:repeat(2,1fr)} @media(max-width:560px){grid-template-columns:1fr}`;
const Label = styled.label`display:grid; gap:5px; font: 10px monospace; text-transform:uppercase; color:#8a8680;`;
const Select = styled.select`width:100%; background:#0b1124; color:#f0ede8; border:1px solid rgba(240,237,232,.14); border-radius:8px; padding:9px; text-transform:none;`;
const ConcurrencyCharts = styled.div`display:grid; gap: ${({ theme }) => theme.spacing.xl};`;

export function ModelPage() {
  const { slug } = useParams();
  const { data, error, loading } = useModelHistory(slug);
  const { window, now } = useWindow();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const defaultContext = useMemo(() => data ? chooseDefaultContext(data.series, window, now) : null, [data, window, now]);

  if (loading) return <LoadingState label="Loading model…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <ErrorState error="Model not found." />;

  const suiteId = params.get('suite') ?? defaultContext?.suiteId ?? data.series[0]?.suiteId ?? '';
  const testName = params.get('test') ?? defaultContext?.testName ?? data.series[0]?.testName ?? '';
  const protocolId = params.get('protocol') ?? defaultContext?.protocolId ?? data.series.find((item) => item.protocolId)?.protocolId ?? '';
  const source = (params.get('source') ?? defaultContext?.source ?? 'client_exact') as MetricSource;
  const tier = (params.get('tier') ?? 'foxlight') as ProvenanceTier;
  const hardware = params.get('hardware') ?? params.get('series') ?? 'all';
  const context = { suiteId, testName, protocolId, source };
  const selectedProfile = hardware === 'all'
    ? null
    : data.series.find((item) => item.seriesId === hardware) ?? null;
  const exactRows: TrendSeriesRow[] = data.series
    .filter((item) => item.tier === tier && item.comparable && matchesContext(item, context))
    .filter((item) => hardware === 'all' || item.seriesId === hardware)
    .map((series) => ({ series, summary: summarizeSeries(series, window, now) }))
    .filter((row) => row.summary.runCount > 0);
  const legacy = data.series
    .filter((item) => item.tier === tier && !item.comparable && item.suiteId === suiteId && item.testName === testName && item.source === source)
    .filter(
      (item) => selectedProfile == null || item.hardware.profileId === selectedProfile.hardware.profileId,
    )
    .map((item) => ({ ...item, points: pointsInWindow(item.points, window, now) }))
    .filter((item) => item.points.length > 0);
  const options = {
    suites: [...new Set(data.series.map((item) => item.suiteId))].sort(),
    tests: [...new Set(data.series.filter((item) => item.suiteId === suiteId).map((item) => item.testName))].sort(),
    protocols: [...new Set(data.series.filter((item) => item.suiteId === suiteId && item.testName === testName).map((item) => item.protocolId).filter((value): value is string => value != null))].sort(),
  };
  const update = (key: string, value: string) => { const next = new globalThis.URLSearchParams(params); next.set(key, value); setParams(next); };
  const updateContext = (nextSuite: string, nextTest?: string) => {
    const test = nextTest ?? data.series.find((item) => item.suiteId === nextSuite)?.testName ?? '';
    const protocol = data.series.find(
      (item) => item.suiteId === nextSuite && item.testName === test && item.protocolId != null,
    )?.protocolId ?? '';
    const next = new globalThis.URLSearchParams(params);
    next.set('suite', nextSuite);
    next.set('test', test);
    next.set('protocol', protocol);
    next.delete('hardware');
    next.delete('series');
    setParams(next);
  };
  const selected = exactRows.length === 1 ? exactRows[0] : null;

  const summaryColumns: Column<TrendSeriesRow>[] = [
    { key:'hardware', header:'Hardware / backend', render:(row)=><span>{row.series.hardware.label}<Muted> · {row.series.resolvedBackends.join(', ')}</Muted></span> },
    { key:'tier', header:'Provenance', render:(row)=>row.series.tier },
    { key:'median', header:'Median TPS', align:'right', render:(row)=>formatTps(row.summary.medianTps), sortValue:(row)=>row.summary.medianTps ?? -1 },
    { key:'latest', header:'Latest TPS', align:'right', render:(row)=>formatTps(row.summary.latestTps) },
    { key:'runs', header:'Distinct runs', align:'right', render:(row)=>row.summary.runCount },
    { key:'reps', header:'Repetitions', align:'right', render:(row)=>row.summary.repetitionCount },
    { key:'cv', header:'CV', align:'right', render:(row)=>formatPercent(row.summary.coefficientOfVariation,1) },
    { key:'span', header:'Date span', render:(row)=><span>{formatDate(row.summary.firstObservedAt)} – {formatDate(row.summary.lastObservedAt)}</span> },
    { key:'status', header:'Status', render:(row)=><SeriesStatusChip status={row.summary.status} /> },
  ];

  const pointRows = exactRows.flatMap((row) => pointsInWindow(row.series.points, window, now).map((point) => ({ row, point })));
  const pointColumns: Column<(typeof pointRows)[number]>[] = [
    { key:'date', header:'Run', render:(item)=><button onClick={(event)=>{event.stopPropagation();navigate(`/run/${item.point.runId}`)}} style={{all:'unset',cursor:'pointer',color:'#4fc3c8'}}>{formatDate(item.point.startedAt)}</button> },
    { key:'hardware', header:'Hardware', render:(item)=>item.row.series.hardware.label },
    { key:'backend', header:'Backend', render:(item)=>item.row.series.resolvedBackends.join(', ') },
    { key:'tier', header:'Provenance', render:(item)=>item.row.series.tier },
    { key:'tps', header:'TPS', align:'right', render:(item)=>formatTps(item.point.decodeTps) },
    { key:'ttft', header:'TTFT', align:'right', render:(item)=>formatSeconds(item.point.ttftS) },
    { key:'reps', header:'Valid / repetitions', align:'right', render:(item)=>`${item.point.validRepetitionCount}/${item.point.repetitionCount}` },
    { key:'skulk', header:'Skulk', render:(item)=><Muted>{item.point.skulkVersion ?? '—'}{item.point.skulkCommit ? ` · ${item.point.skulkCommit.slice(0,8)}` : ''}</Muted> },
  ];

  const concurrencyCurves = data.concurrencyCurves.filter((curve) =>
    isWithinWindow(curve.startedAt, window, now),
  );

  return <Page>
    <Eyebrow>Model</Eyebrow><Name>{data.displayName}</Name><Row $gap="8px" $wrap><FamilyBadge family={data.family}/><Muted>{data.modelId}</Muted></Row>
    <Controls>
      <Label>Suite<Select value={suiteId} onChange={(e)=>updateContext(e.target.value)}>{options.suites.map((value)=><option key={value}>{value}</option>)}</Select></Label>
      <Label>Test<Select value={testName} onChange={(e)=>updateContext(suiteId,e.target.value)}>{options.tests.map((value)=><option key={value}>{value}</option>)}</Select></Label>
      <Label>Protocol<Select value={protocolId} onChange={(e)=>update('protocol',e.target.value)}>{options.protocols.map((value)=><option key={value} value={value}>{value.slice(0,12)}</option>)}</Select></Label>
      <Label>Source<Select value={source} onChange={(e)=>update('source',e.target.value)}><option value="client_exact">Client exact</option><option value="engine_reported">Engine reported</option><option value="client_approx">Client approximate</option></Select></Label>
      <Label>Provenance<Select value={tier} onChange={(e)=>update('tier',e.target.value)}><option value="foxlight">Foxlight</option><option value="community">Community</option></Select></Label>
      <Label>Hardware<Select value={hardware} onChange={(e)=>update('hardware',e.target.value)}><option value="all">All hardware</option>{data.series.filter((item)=>item.tier===tier&&item.comparable&&matchesContext(item,context)).map((item)=><option key={item.seriesId} value={item.seriesId}>{item.hardware.label} · {item.resolvedBackends.join(', ')}</option>)}</Select></Label>
    </Controls>
    {selected ? <Grid $min="180px"><StatCard><BigNumber>{formatTps(selected.summary.medianTps)}</BigNumber><StatLabel>median TPS</StatLabel></StatCard><StatCard><BigNumber>{formatTps(selected.summary.latestTps)}</BigNumber><StatLabel>latest TPS</StatLabel></StatCard><StatCard><BigNumber>{selected.summary.runCount}</BigNumber><StatLabel>distinct runs</StatLabel></StatCard><StatCard><BigNumber>{formatPercent(selected.summary.coefficientOfVariation,1)}</BigNumber><StatLabel>CV · {selected.summary.spanDays?.toFixed(1) ?? '—'} days</StatLabel></StatCard></Grid> : exactRows.length > 0 ? <SortableTable columns={summaryColumns} rows={exactRows} rowKey={(row)=>row.series.seriesId} /> : <EmptyState label="No complete series in this context." />}
    <Section>Throughput history</Section><TrendChart rows={exactRows} legacy={legacy}/>
    {legacy.length > 0 && <Row $gap="8px" $wrap style={{marginTop:10}}><Chip $tone="neutral">Legacy</Chip><Muted>{legacy.reduce((total,item)=>total+item.points.length,0)} unconnected point(s); missing comparability metadata and stability-ineligible.</Muted></Row>}
    {concurrencyCurves.length > 0 && <><Section>Concurrency</Section><ConcurrencyCharts>{concurrencyCurves.map((curve)=><ConcurrencyChart key={`${curve.runId}-${curve.testName}-${curve.hardware.profileId}`} curve={curve}/>)}</ConcurrencyCharts></>}
    {pointRows.length > 0 && <><Section>Every run</Section><SortableTable columns={pointColumns} rows={pointRows} rowKey={(item)=>`${item.row.series.seriesId}-${item.point.runId}`} /></>}
  </Page>;
}
