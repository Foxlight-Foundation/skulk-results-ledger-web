import { useMemo, useState } from 'react';
import styled from 'styled-components';

import { Chip } from '../components/Chip';
import { Eyebrow, Muted, Page, Panel } from '../components/primitives';
import { SortableTable, type Column } from '../components/SortableTable';
import { ErrorState, LoadingState } from '../components/States';
import type { RunSummary } from '../data/schema';
import { formatSignedPercent, formatTps } from '../data/format';
import { joinRunSeries, type RunComparisonJoin } from '../data/series';
import { useIndex } from '../data/useLedger';

const Title=styled.h1`font-size:${({theme})=>theme.typography.fontSize.sectionH};`;
const Sub=styled.p`color:${({theme})=>theme.colors.text2};max-width:70ch;margin:10px 0 20px;`;
const Pickers=styled.div`display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;@media(max-width:640px){grid-template-columns:1fr}`;
const Picker=styled(Panel)`padding:14px;`;
const Label=styled.label`display:block;font:10px monospace;text-transform:uppercase;color:#8a8680;margin-bottom:7px;`;
const Select=styled.select`width:100%;background:#0b1124;color:#f0ede8;border:1px solid rgba(240,237,232,.14);border-radius:8px;padding:10px;`;

function runLabel(run:RunSummary){return `${run.runId} · ${run.passCount}/${run.passCount+run.failCount}`}

export function ComparePage(){
  const {data,error,loading}=useIndex();
  const [baselineId,setBaselineId]=useState('');
  const [candidateId,setCandidateId]=useState('');
  const rows=useMemo<RunComparisonJoin[]>(()=>{
    if(!data||!baselineId||!candidateId)return[];
    return joinRunSeries(data.series,baselineId,candidateId).sort((a,b)=>(b.percentDelta??-Infinity)-(a.percentDelta??-Infinity));
  },[data,baselineId,candidateId]);
  if(loading)return <LoadingState/>;
  if(error)return <ErrorState error={error}/>;
  if(!data)return <ErrorState error="No index."/>;
  const columns:Column<RunComparisonJoin>[]=[
    {key:'model',header:'Model / test',render:(row)=><span><strong>{row.series.displayName}</strong><br/><Muted>{row.series.suiteId} · {row.series.testName}</Muted></span>},
    {key:'profile',header:'Exact series',render:(row)=><span>{row.series.hardware.label} · {row.series.resolvedBackends.join(', ')||'backend unrecorded'}<br/><Muted>{row.series.source.replace('_',' ')} · {row.series.protocolId?.slice(0,12)??'protocol unrecorded'} · {row.series.sharding??'shape unrecorded'}</Muted></span>},
    {key:'baseline',header:'Baseline TPS',align:'right',render:(row)=>formatTps(row.baseline?.decodeTps)},
    {key:'candidate',header:'Candidate TPS',align:'right',render:(row)=>formatTps(row.candidate?.decodeTps)},
    {key:'delta',header:'Δ',align:'right',sortValue:(row)=>row.percentDelta??-Infinity,render:(row)=>row.comparable?<span style={{color:(row.percentDelta??0)>=0?'#5fd0a6':'#ff7a6b'}}>{formatSignedPercent(row.percentDelta)}</span>:<Chip $tone="neutral">not comparable</Chip>},
    {key:'reason',header:'Reason',render:(row)=><Muted>{row.reason??'full series identity match'}</Muted>},
  ];
  return <Page><Eyebrow>Like-for-like</Eyebrow><Title>Compare matching series</Title><Sub>Deltas join only full series identities and use each run&apos;s repetition median. Hardware, backend, protocol, source, test, tier, or placement mismatches stay separate and read “not comparable.”</Sub><Pickers><Picker><Label htmlFor="baseline">Baseline</Label><Select id="baseline" value={baselineId} onChange={(event)=>setBaselineId(event.target.value)}><option value="">Select a run…</option>{data.runs.map((run)=><option key={run.runId} value={run.runId}>{runLabel(run)}</option>)}</Select></Picker><Picker><Label htmlFor="candidate">Candidate</Label><Select id="candidate" value={candidateId} onChange={(event)=>setCandidateId(event.target.value)}><option value="">Select a run…</option>{data.runs.map((run)=><option key={run.runId} value={run.runId}>{runLabel(run)}</option>)}</Select></Picker></Pickers>{!baselineId||!candidateId?<Panel style={{padding:28,textAlign:'center'}}><Muted>Choose both runs.</Muted></Panel>:<SortableTable columns={columns} rows={rows} rowKey={(row)=>row.series.seriesId} initialSortKey="delta" initialSortDir="desc"/>}</Page>;
}
