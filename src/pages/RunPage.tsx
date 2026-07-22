import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';

import { CaveatList, Chip, PassRateChip } from '../components/Chip';
import { ConcurrencyChart } from '../components/charts/ConcurrencyChart';
import { Eyebrow, Grid, Muted, Page, Panel, Row } from '../components/primitives';
import { SortableTable, type Column } from '../components/SortableTable';
import { ErrorState, LoadingState } from '../components/States';
import type { PerformanceObservation } from '../data/schema';
import { formatDateTime, formatSeconds, formatTps } from '../data/format';
import { useRunDetail } from '../data/useLedger';

const Title=styled.h1`font:16px ${({theme})=>theme.typography.fontFamily.mono};word-break:break-all;color:${({theme})=>theme.colors.text1};`;
const Section=styled.h2`font-size:${({theme})=>theme.typography.fontSize.xl};margin:${({theme})=>`${theme.spacing.xl} 0 ${theme.spacing.md}`};`;
const Meta=styled(Panel)`padding:${({theme})=>theme.spacing.md};`;
const MetaLabel=styled.div`font:10px monospace;text-transform:uppercase;color:#8a8680;`;
const MetaValue=styled.div`margin-top:5px;color:#f0ede8;word-break:break-word;`;
const Issue=styled(Panel)<{$severity:string}>`padding:12px;margin-bottom:8px;border-color:${({$severity})=>$severity==='error'?'rgba(255,122,107,.35)':'rgba(255,184,0,.25)'};`;
const Curves=styled.div`display:grid;gap:24px;`;

interface AuditRow {
  key:string;
  modelId:string;
  testName:string;
  kind:string|null;
  repetition:number;
  passed:boolean;
  exact:PerformanceObservation;
  engine:PerformanceObservation;
  approximate:PerformanceObservation;
}

export function RunPage(){
  const {runId}=useParams();
  const {data,error,loading}=useRunDetail(runId);
  const navigate=useNavigate();
  const rows=useMemo<AuditRow[]>(()=>{
    if(!data)return[];
    const groups=new Map<string,PerformanceObservation[]>();
    for(const observation of data.observations){const key=[observation.modelId,observation.testName,observation.repetition].join('|');const values=groups.get(key)??[];values.push(observation);groups.set(key,values)}
    return [...groups.entries()].flatMap(([key,values])=>{const exact=values.find((item)=>item.source==='client_exact');const engine=values.find((item)=>item.source==='engine_reported');const approximate=values.find((item)=>item.source==='client_approx');return exact&&engine&&approximate?[{key,modelId:exact.modelId,testName:exact.testName,kind:exact.testKind,repetition:exact.repetition,passed:exact.passed,exact,engine,approximate}]:[]});
  },[data]);
  if(loading)return <LoadingState label="Loading run…"/>;
  if(error)return <ErrorState error={error}/>;
  if(!data)return <ErrorState error="Run not found."/>;
  const total=data.passCount+data.failCount;
  const columns:Column<AuditRow>[]=[
    {key:'model',header:'Model',render:(row)=><button onClick={(event)=>{event.stopPropagation();navigate(`/model/${row.modelId.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`)}} style={{all:'unset',cursor:'pointer',color:'#4fc3c8'}}>{row.modelId.split('/').at(-1)}</button>},
    {key:'test',header:'Test / kind',render:(row)=><span>{row.testName}<Muted> · {row.kind??'legacy unknown'}</Muted></span>},
    {key:'rep',header:'Rep',align:'right',render:(row)=>row.repetition},
    {key:'pass',header:'Pass',render:(row)=><Chip $tone={row.passed?'pass':'fail'}>{row.passed?'pass':'fail'}</Chip>},
    {key:'exact',header:'Client exact TPS',align:'right',render:(row)=><span title={`tokens=${row.exact.exactGeneratedTokens??'—'} / decode_s=${row.exact.decodeElapsedS??'—'}`}>{formatTps(row.exact.decodeTps)}</span>},
    {key:'engine',header:'Engine TPS',align:'right',render:(row)=>formatTps(row.engine.decodeTps)},
    {key:'approx',header:'Approx TPS',align:'right',render:(row)=><span title={`approx_tokens=${row.approximate.approximateGeneratedTokens??'—'}`}>{formatTps(row.approximate.decodeTps)}</span>},
    {key:'ttft',header:'TTFT',align:'right',render:(row)=>formatSeconds(row.exact.ttftS)},
    {key:'formula',header:'Formula inputs',render:(row)=><Muted>{row.exact.exactGeneratedTokens??'—'} exact tok · {row.approximate.approximateGeneratedTokens??'—'} approx tok · {row.exact.chunks??'—'} chunks · {row.exact.decodeElapsedS?.toFixed(3)??'—'}s decode</Muted>},
    {key:'profile',header:'Hardware / backend / protocol',render:(row)=><span>{row.exact.hardware.label}<br/><Muted>{row.exact.resolvedBackends.join(', ')||'backend unrecorded'} · {row.exact.protocolId?.slice(0,12)??'protocol unrecorded'} · {row.exact.sharding??'shape unrecorded'}</Muted></span>},
    {key:'excluded',header:'Exclusions',render:(row)=>{const reasons=[...new Set([row.exact,row.engine,row.approximate].flatMap((item)=>item.exclusionReasons))];return reasons.length?<Muted>{reasons.join(', ')}</Muted>:<Chip $tone="pass">valid</Chip>}},
  ];
  return <Page>
    <Eyebrow>Run audit</Eyebrow><Title>{data.runId}</Title><Row $gap="8px" $wrap style={{margin:'12px 0'}}><PassRateChip passRate={total?data.passCount/total:0}/><Chip>{data.mode}</Chip><Chip>{data.cacheClass} cache</Chip>{data.hardware.known&&<Chip $tone="cyan">{data.hardware.label}</Chip>}{data.tier==='community'&&<Chip $tone="amber">community · {data.submitter??'unknown'}</Chip>}<CaveatList caveats={data.caveats}/></Row>
    <Section>Provenance</Section><Grid $min="220px"><Meta><MetaLabel>Started</MetaLabel><MetaValue>{formatDateTime(data.startedAt)}</MetaValue></Meta><Meta><MetaLabel>Suite · models</MetaLabel><MetaValue>{data.testSet} · {data.modelSet}</MetaValue></Meta><Meta><MetaLabel>Skulk</MetaLabel><MetaValue>{data.skulkVersion??'unknown'}{data.skulkCommit?` · ${data.skulkCommit}`:''}</MetaValue></Meta><Meta><MetaLabel>Runtime</MetaLabel><MetaValue>{data.platform??'unknown'}{data.python?` · py ${data.python}`:''}</MetaValue></Meta>{data.repositories.map((repository)=><Meta key={repository.name}><MetaLabel>{repository.name.split('/').at(-1)}</MetaLabel><MetaValue>{repository.branch??'—'}{repository.commit?` · ${repository.commit}`:''}</MetaValue></Meta>)}</Grid>
    <Section>Per-test observations</Section><SortableTable columns={columns} rows={rows} rowKey={(row)=>row.key}/>
    {data.concurrencyCurves.length>0&&<><Section>Concurrency observations</Section><Curves>{data.concurrencyCurves.map((curve)=><ConcurrencyChart key={`${curve.modelId}-${curve.testName}-${curve.hardware.profileId}`} curve={curve}/>)}</Curves></>}
    {data.issues.length>0&&<><Section>Issues ({data.issues.length})</Section>{data.issues.map((issue,index)=><Issue key={index} $severity={issue.severity}><strong>{issue.severity}</strong> · {issue.message}</Issue>)}</>}
  </Page>;
}
