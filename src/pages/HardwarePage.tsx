import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { FamilyBadge } from '../components/Chip';
import { Eyebrow, Muted, Page, Row } from '../components/primitives';
import { ErrorState, LoadingState } from '../components/States';
import type { ModelRollup } from '../data/schema';
import { formatTps } from '../data/format';
import { hasFullyKnownHardware } from '../data/hardware';
import { useIndex } from '../data/useLedger';
import { useWindow } from '../data/useWindow';
import { hasTextGenerationWorkload, TEXT_GENERATION_WORKLOADS } from '../data/workload';
import { windowRollup } from '../data/window';

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.sectionH};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.section};
`;

const Sub = styled.p`
  color: ${({ theme }) => theme.colors.text2};
  max-width: 68ch;
  margin: ${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.lg};
`;

const Scroll = styled.div`
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.colors.border1};
  border-radius: ${({ theme }) => theme.radii.card};
  background: ${({ theme }) => theme.colors.panelBg};
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  th {
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: 10px;
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.text3};
    text-align: right;
    padding: 14px 16px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border1};
    white-space: nowrap;
  }
  th:first-child {
    text-align: left;
  }
  td {
    padding: 12px 16px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border0};
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  td:first-child {
    text-align: left;
  }
  tbody tr {
    cursor: pointer;
    transition: background 120ms ease;
  }
  tbody tr:hover {
    background: ${({ theme }) => theme.colors.moonWash};
  }
`;

const Cell = styled.span<{ $credible: boolean }>`
  color: ${({ theme, $credible }) => ($credible ? theme.colors.text1 : theme.colors.text4)};
`;

const FootNote = styled.p`
  color: ${({ theme }) => theme.colors.text3};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  margin-top: ${({ theme }) => theme.spacing.md};
  max-width: 72ch;
`;

/**
 * Model-by-hardware matrix: one row per model, one column per distinct
 * hardware shape observed, cell = typical credible decode tok/s on that
 * hardware. A physically plausible low-sample result is shown as indicative;
 * cells without usable generated-text throughput show the run count dimmed,
 * so "we ran it but no number cleared either bar" stays distinguishable from
 * "never ran there".
 */
export function HardwarePage() {
  const { data, error, loading } = useIndex();
  const navigate = useNavigate();

  const { window, now } = useWindow();

  const { labels, rows } = useMemo(() => {
    if (!data) return { labels: [] as string[], rows: [] as ModelRollup[] };
    // Window each model's per-hardware cells, then build the columns and rows
    // from the windowed cells so the whole matrix reflects the selected period;
    // a model with no windowed hardware cells drops out.
    const windowed: ModelRollup[] = data.models
      .filter((model) => hasTextGenerationWorkload(model.workloads))
      .map((model) => ({
        ...model,
        hardwareCells: windowRollup(
          model,
          window,
          now,
          undefined,
          TEXT_GENERATION_WORKLOADS,
        ).hardwareCells,
      }));
    // Columns: known hardware shapes actually observed in the window, widest
    // coverage first so the interesting columns lead.
    const coverage = new Map<string, number>();
    for (const m of windowed) {
      for (const c of m.hardwareCells) {
        if (hasFullyKnownHardware(c.classes)) {
          coverage.set(c.label, (coverage.get(c.label) ?? 0) + 1);
        }
      }
    }
    const labels = [...coverage.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
    const rows = windowed.filter((m) =>
      m.hardwareCells.some((c) => hasFullyKnownHardware(c.classes)),
    );
    return { labels, rows };
  }, [data, window, now]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <ErrorState error="No index." />;

  return (
    <Page>
      <Eyebrow>Hardware</Eyebrow>
      <Title>Same model, different metal.</Title>
      <Sub>
        Generated-text decode tok/s per hardware shape. Credible per-run medians remain the
        headline; a physically plausible low-sample median is explicitly marked indicative.
        Attribution is exact where the run recorded placement nodes.
      </Sub>

      <Scroll>
        <Table>
          <thead>
            <tr>
              <th>Model</th>
              {labels.map((l) => (
                <th key={l}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.slug} onClick={() => navigate(`/model/${m.slug}`)}>
                <td>
                  <Row $gap="8px">
                    <strong style={{ color: '#f0ede8' }}>{m.displayName}</strong>
                    <FamilyBadge family={m.family} />
                  </Row>
                </td>
                {labels.map((label) => {
                  const cell = m.hardwareCells.find((c) => c.label === label);
                  if (!cell) return <td key={label}>{'·'}</td>;
                  const clusterNote =
                    cell.clusterAttributedRunCount > 0
                      ? `; ${cell.clusterAttributedRunCount} cluster-fallback (whole-cluster shape, placement not recorded)`
                      : '';
                  return (
                    <td
                      key={label}
                      title={`${cell.runCount} run(s), ${cell.credibleRunCount} credible, ${cell.indicativeRunCount} indicative${clusterNote}`}
                    >
                      {cell.decodeTpsTypical != null ? (
                        <Cell $credible>
                          {formatTps(cell.decodeTpsTypical)}
                          {cell.clusterAttributedRunCount > 0 && <Muted>*</Muted>}
                        </Cell>
                      ) : cell.decodeTpsIndicative != null ? (
                        <Cell $credible={false}>
                          {formatTps(cell.decodeTpsIndicative)} indicative
                          {cell.clusterAttributedRunCount > 0 && '*'}
                        </Cell>
                      ) : (
                        <Cell $credible={false}>
                          {cell.runCount} run{cell.runCount === 1 ? '' : 's'}
                          {cell.clusterAttributedRunCount > 0 && '*'}
                        </Cell>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Scroll>

      <FootNote>
        Cells marked * include cluster-fallback samples: the run did not record which nodes
        served the model, so the shape shown is the whole cluster (an upper bound), not
        verified placement. Hardware classes are vendor + memory tier, derived from each run&apos;s fingerprint;
        chip-level classes (M4 vs M5, specific GPUs) arrive as newer runs record accelerator
        names. Reports with incomplete hardware profiles remain archived but are omitted from every
        dashboard view and aggregate.
      </FootNote>
    </Page>
  );
}
