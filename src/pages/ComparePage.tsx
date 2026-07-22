import { useMemo, useState } from 'react';
import styled from 'styled-components';

import { DeltaBars } from '../components/charts/DeltaBars';
import { Eyebrow, Muted, Page, Panel, Row } from '../components/primitives';
import { SortableTable, type Column } from '../components/SortableTable';
import { ErrorState, LoadingState } from '../components/States';
import type { RunDetail, RunSummary } from '../data/schema';
import { formatSignedPercent, formatTps } from '../data/format';
import { useIndex, useRunDetail } from '../data/useLedger';

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.sectionH};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.section};
`;

const Sub = styled.p`
  color: ${({ theme }) => theme.colors.text2};
  max-width: 60ch;
  margin: ${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.lg};
`;

const Pickers = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
  }
`;

const PickerCard = styled(Panel)`
  padding: ${({ theme }) => theme.spacing.md};
`;

const PickerLabel = styled.label`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.eyebrow};
  color: ${({ theme }) => theme.colors.text3};
  display: block;
  margin-bottom: 8px;
`;

const Select = styled.select`
  width: 100%;
  background: ${({ theme }) => theme.colors.night};
  border: 1px solid ${({ theme }) => theme.colors.border1};
  border-radius: ${({ theme }) => theme.radii.sm};
  padding: 10px 12px;
  color: ${({ theme }) => theme.colors.text1};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.borderAmber};
  }
`;

interface DeltaRow {
  modelId: string;
  baseline: number | null;
  candidate: number | null;
  percent: number | null;
}

function runLabel(r: RunSummary): string {
  return `${r.runId}  ·  ${r.passCount}/${r.passCount + r.failCount}`;
}

function decodeByModel(detail: RunDetail | null): Map<string, number | null> {
  const map = new Map<string, number | null>();
  if (!detail) return map;
  for (const m of detail.models) map.set(m.modelId, m.decodeTps.median);
  return map;
}

export function ComparePage() {
  const index = useIndex();
  const [baselineId, setBaselineId] = useState<string>('');
  const [candidateId, setCandidateId] = useState<string>('');

  const baseline = useRunDetail(baselineId || undefined);
  const candidate = useRunDetail(candidateId || undefined);

  const rows = useMemo<DeltaRow[]>(() => {
    const b = decodeByModel(baseline.data);
    const c = decodeByModel(candidate.data);
    const models = new Set([...b.keys(), ...c.keys()]);
    return [...models]
      .map((modelId) => {
        const bv = b.get(modelId) ?? null;
        const cv = c.get(modelId) ?? null;
        const percent = bv != null && cv != null && bv !== 0 ? ((cv - bv) / Math.abs(bv)) * 100 : null;
        return { modelId, baseline: bv, candidate: cv, percent };
      })
      .sort((x, y) => (y.percent ?? -999) - (x.percent ?? -999));
  }, [baseline.data, candidate.data]);

  if (index.loading) return <LoadingState />;
  if (index.error) return <ErrorState error={index.error} />;
  if (!index.data) return <ErrorState error="No index." />;

  const runs = index.data.runs;
  const bothChosen = baselineId && candidateId;

  const columns: Column<DeltaRow>[] = [
    {
      key: 'model',
      header: 'Model',
      sortValue: (r) => r.modelId,
      render: (r) => r.modelId.split('/').pop(),
    },
    {
      key: 'baseline',
      header: 'Baseline tok/s',
      align: 'right',
      sortValue: (r) => r.baseline ?? -1,
      render: (r) => formatTps(r.baseline),
    },
    {
      key: 'candidate',
      header: 'Candidate tok/s',
      align: 'right',
      sortValue: (r) => r.candidate ?? -1,
      render: (r) => formatTps(r.candidate),
    },
    {
      key: 'delta',
      header: 'Δ',
      align: 'right',
      sortValue: (r) => r.percent ?? -999,
      render: (r) =>
        r.percent == null ? (
          <Muted>one side only</Muted>
        ) : (
          <span style={{ color: r.percent >= 0 ? '#5fd0a6' : '#ff7a6b', fontVariantNumeric: 'tabular-nums' }}>
            {formatSignedPercent(r.percent)}
          </span>
        ),
    },
  ];

  const guards: string[] = [];
  if (baseline.data && candidate.data) {
    if (baseline.data.topologyLabel !== candidate.data.topologyLabel) guards.push('node set differs');
    if (baseline.data.cacheClass !== candidate.data.cacheClass) guards.push('cache warmth differs');
    if (baseline.data.skulkVersion !== candidate.data.skulkVersion) guards.push('Skulk version differs');
    if (!baseline.data.hasFingerprint || !candidate.data.hasFingerprint) guards.push('missing fingerprint');
  }

  return (
    <Page>
      <Eyebrow>Like-for-like</Eyebrow>
      <Title>Compare two runs</Title>
      <Sub>
        Pick a baseline and a candidate run to see per-model decode-throughput deltas. Positive is
        faster. The guards below warn when the two runs are not truly comparable (different node set,
        cache warmth, or Skulk version) so a delta is never read out of context.
      </Sub>

      <Pickers>
        <PickerCard>
          <PickerLabel htmlFor="baseline">Baseline</PickerLabel>
          <Select id="baseline" value={baselineId} onChange={(e) => setBaselineId(e.target.value)}>
            <option value="">Select a run…</option>
            {runs.map((r) => (
              <option key={r.runId} value={r.runId}>
                {runLabel(r)}
              </option>
            ))}
          </Select>
        </PickerCard>
        <PickerCard>
          <PickerLabel htmlFor="candidate">Candidate</PickerLabel>
          <Select id="candidate" value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
            <option value="">Select a run…</option>
            {runs.map((r) => (
              <option key={r.runId} value={r.runId}>
                {runLabel(r)}
              </option>
            ))}
          </Select>
        </PickerCard>
      </Pickers>

      {!bothChosen ? (
        <Panel style={{ padding: 32, textAlign: 'center', color: '#8a8680' }}>
          Choose a baseline and a candidate to compare.
        </Panel>
      ) : baseline.loading || candidate.loading ? (
        <LoadingState label="Loading runs…" />
      ) : (
        <>
          {guards.length > 0 && (
            <Row $gap="8px" $wrap style={{ marginBottom: 16 }}>
              <Muted>Not like-for-like:</Muted>
              {guards.map((g) => (
                <span
                  key={g}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: '#FFB800',
                    background: 'rgba(255,184,0,0.12)',
                    border: '1px solid rgba(255,184,0,0.3)',
                    borderRadius: 999,
                    padding: '3px 9px',
                  }}
                >
                  {g}
                </span>
              ))}
            </Row>
          )}
          <DeltaBars rows={rows.filter((r) => r.percent != null)} />
          <div style={{ marginTop: 24 }}>
            <SortableTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.modelId}
              initialSortKey="delta"
              initialSortDir="desc"
            />
          </div>
        </>
      )}
    </Page>
  );
}
