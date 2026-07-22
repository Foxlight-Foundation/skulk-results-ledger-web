import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

import { FamilyBadge, SeriesStatusChip } from '../components/Chip';
import { Eyebrow, Muted, Page, Panel, Row } from '../components/primitives';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { MetricSource, PerformanceSeries, ProvenanceTier } from '../data/schema';
import { formatTps } from '../data/format';
import { chooseDefaultContext, matchesContext, summarizeSeries } from '../data/series';
import { useIndex } from '../data/useLedger';
import { useWindow } from '../data/useWindow';

const Title = styled.h1`font-size:${({ theme }) => theme.typography.fontSize.sectionH};`;
const Sub = styled.p`color:${({ theme }) => theme.colors.text2}; max-width:70ch; margin:10px 0 20px;`;
const Controls = styled(Panel)`display:grid; grid-template-columns:repeat(4,minmax(150px,1fr)); gap:10px; padding:14px; margin-bottom:18px; @media(max-width:760px){grid-template-columns:1fr 1fr} @media(max-width:520px){grid-template-columns:1fr}`;
const Label = styled.label`display:grid;gap:5px;font:10px monospace;text-transform:uppercase;color:#8a8680;`;
const Select = styled.select`background:#0b1124;color:#f0ede8;border:1px solid rgba(240,237,232,.14);border-radius:8px;padding:9px;text-transform:none;`;
const Scroll = styled.div`overflow-x:auto;border:1px solid ${({theme})=>theme.colors.border1};border-radius:${({theme})=>theme.radii.card};background:${({theme})=>theme.colors.panelBg};`;
const Table = styled.table`width:100%;border-collapse:collapse;font-size:13px;th,td{padding:12px 14px;border-bottom:1px solid rgba(240,237,232,.07);white-space:nowrap;text-align:right}th:first-child,td:first-child{text-align:left}th{font:10px monospace;text-transform:uppercase;color:#8a8680}tbody tr{cursor:pointer}tbody tr:hover{background:rgba(255,255,255,.04)}`;

function profileKey(series: PerformanceSeries): string {
  return [series.hardware.profileId, series.resolvedBackends.join(','), series.instanceType, series.sharding, series.shardTypes.join(',')].join('|');
}

export function HardwarePage() {
  const { data, error, loading } = useIndex();
  const { window, now } = useWindow();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const fallback = useMemo(()=>data?chooseDefaultContext(data.series,window,now):null,[data,window,now]);
  if (loading) return <LoadingState/>;
  if (error) return <ErrorState error={error}/>;
  if (!data || !fallback) return <EmptyState label="No exact hardware series available."/>;
  const context = {
    suiteId: params.get('suite') ?? fallback.suiteId,
    testName: params.get('test') ?? fallback.testName,
    protocolId: params.get('protocol') ?? fallback.protocolId,
    source: (params.get('source') ?? fallback.source) as MetricSource,
  };
  const tier=(params.get('tier')??'foxlight') as ProvenanceTier;
  const candidates = data.series.filter((item)=>item.tier===tier && item.comparable && matchesContext(item,context)).map((series)=>({series,summary:summarizeSeries(series,window,now)})).filter((item)=>item.summary.runCount>0);
  const profiles = [...new Map(candidates.map((item)=>[profileKey(item.series),item.series] as const)).entries()].map(([key,series])=>({key,series}));
  const rows = data.models.filter((model)=>candidates.some((item)=>item.series.modelId===model.modelId));
  const suites=[...new Set(data.series.filter((item)=>item.comparable).map((item)=>item.suiteId))].sort();
  const tests=[...new Set(data.series.filter((item)=>item.comparable&&item.suiteId===context.suiteId).map((item)=>item.testName))].sort();
  const protocols=[...new Set(data.series.filter((item)=>item.comparable&&item.suiteId===context.suiteId&&item.testName===context.testName).map((item)=>item.protocolId).filter((value):value is string=>value!=null))].sort();
  const update=(key:string,value:string)=>{const next=new globalThis.URLSearchParams(params);next.set(key,value);setParams(next)};
  const updateContext=(nextSuite:string,nextTest?:string)=>{const test=nextTest??data.series.find((item)=>item.comparable&&item.suiteId===nextSuite)?.testName??'';const protocol=data.series.find((item)=>item.comparable&&item.suiteId===nextSuite&&item.testName===test&&item.protocolId!=null)?.protocolId??'';const next=new globalThis.URLSearchParams(params);next.set('suite',nextSuite);next.set('test',test);next.set('protocol',protocol);setParams(next)};
  return <Page>
    <Eyebrow>Hardware</Eyebrow><Title>Same protocol, different metal.</Title><Sub>Every matrix cell uses the selected suite, test, protocol revision, and metric source. Columns are exact hardware/backend/placement profiles; no cell blends tests or engines.</Sub>
    <Controls>
      <Label>Suite<Select value={context.suiteId} onChange={(e)=>updateContext(e.target.value)}>{suites.map((value)=><option key={value}>{value}</option>)}</Select></Label>
      <Label>Test<Select value={context.testName} onChange={(e)=>updateContext(context.suiteId,e.target.value)}>{tests.map((value)=><option key={value}>{value}</option>)}</Select></Label>
      <Label>Protocol<Select value={context.protocolId} onChange={(e)=>update('protocol',e.target.value)}>{protocols.map((value)=><option key={value} value={value}>{value.slice(0,12)}</option>)}</Select></Label>
      <Label>Source<Select value={context.source} onChange={(e)=>update('source',e.target.value)}><option value="client_exact">Client exact</option><option value="engine_reported">Engine reported</option><option value="client_approx">Client approximate</option></Select></Label>
      <Label>Provenance<Select value={tier} onChange={(e)=>update('tier',e.target.value)}><option value="foxlight">Foxlight</option><option value="community">Community</option></Select></Label>
    </Controls>
    {rows.length===0?<EmptyState label="No hardware cells match this context."/>:<Scroll><Table><thead><tr><th>Model</th>{profiles.map(({key,series})=><th key={key}>{series.hardware.label}<br/><Muted>{series.resolvedBackends.join(', ')}</Muted></th>)}</tr></thead><tbody>{rows.map((model)=><tr key={model.modelId} onClick={()=>navigate(`/model/${model.slug}?suite=${encodeURIComponent(context.suiteId)}&test=${encodeURIComponent(context.testName)}&protocol=${context.protocolId}&source=${context.source}&tier=${tier}`)}><td><Row $gap="8px"><strong>{model.displayName}</strong><FamilyBadge family={model.family}/></Row></td>{profiles.map(({key})=>{const cell=candidates.find((item)=>item.series.modelId===model.modelId&&profileKey(item.series)===key);return <td key={key}>{cell?<div><strong>{formatTps(cell.summary.medianTps)}</strong> / {formatTps(cell.summary.latestTps)}<br/><Muted>N={cell.summary.runCount}</Muted> <SeriesStatusChip status={cell.summary.status}/></div>:'·'}</td>})}</tr>)}</tbody></Table></Scroll>}
  </Page>;
}
