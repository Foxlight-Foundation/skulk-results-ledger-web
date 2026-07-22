import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import type { PerformanceSeries, SeriesSummary } from '../../data/schema';
import { FAMILY_META, formatSeconds, formatTps } from '../../data/format';
import {
  ChartCard,
  ChartHeading,
  ChartHint,
  ChartTitle,
  TooltipShell,
  useChartPalette,
} from './ChartFrame';

export interface ExplorerSeriesRow {
  series: PerformanceSeries;
  summary: SeriesSummary;
}

interface ScatterPoint {
  x: number;
  y: number;
  z: number;
  slug: string;
  seriesId: string;
  suiteId: string;
  testName: string;
  name: string;
  hardware: string;
  backend: string;
  source: string;
  protocol: string;
  tier: string;
  repetitions: number;
  latestRunId: string | null;
  skulkVersion: string | null;
  skulkCommit: string | null;
  runs: number;
  fill: string;
}

/** Speed and latency from the same exact series population. */
export function SpeedScatter({ rows }: { rows: ExplorerSeriesRow[] }) {
  const palette = useChartPalette();
  const navigate = useNavigate();
  const points: ScatterPoint[] = rows
    .filter((row) => row.summary.medianTps != null && row.summary.medianTtftS != null)
    .map(({ series, summary }) => {
      const familyColor = FAMILY_META[series.family].color;
      return {
        x: summary.medianTtftS as number,
        y: summary.medianTps as number,
        z: Math.max(summary.runCount, 1),
        slug: series.slug,
        seriesId: series.seriesId,
        suiteId: series.suiteId,
        testName: series.testName,
        name: series.displayName,
        hardware: series.hardware.label,
        backend: series.resolvedBackends.join(', '),
        source: series.source,
        protocol: series.protocolId ?? 'legacy',
        tier: series.tier,
        repetitions: summary.repetitionCount,
        latestRunId: series.points.at(-1)?.runId ?? null,
        skulkVersion: series.points.at(-1)?.skulkVersion ?? null,
        skulkCommit: series.points.at(-1)?.skulkCommit ?? null,
        runs: summary.runCount,
        fill:
          familyColor === 'cyan'
            ? palette.cyan
            : familyColor === 'amber'
              ? palette.amber
              : palette.neutral,
      };
    });

  return (
    <ChartCard>
      <ChartHeading>
        <ChartTitle>Speed vs. latency</ChartTitle>
        <ChartHint>same test, protocol, source, hardware, and backend per point</ChartHint>
      </ChartHeading>
      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 12, right: 24, bottom: 28, left: 8 }}>
          <CartesianGrid stroke={palette.grid} />
          <XAxis
            type="number"
            dataKey="x"
            stroke={palette.axis}
            tick={{ fill: palette.axis, fontFamily: palette.font, fontSize: 11 }}
            tickFormatter={(value: number) => formatSeconds(value)}
            label={{ value: 'median time to first token', position: 'bottom', fill: palette.axis, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            stroke={palette.axis}
            tick={{ fill: palette.axis, fontFamily: palette.font, fontSize: 11 }}
            label={{ value: 'median decode tok/s', angle: -90, position: 'insideLeft', fill: palette.axis, fontSize: 11 }}
          />
          <ZAxis type="number" dataKey="z" range={[60, 420]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: palette.axis }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as ScatterPoint;
              return (
                <TooltipShell>
                  <strong>{point.name}</strong>
                  <div>{point.hardware}</div>
                  <div>{point.backend} · {point.source.replace('_', ' ')}</div>
                  <div>{point.tier} · protocol {point.protocol.slice(0, 12)}</div>
                  <div>median {formatTps(point.y)} tok/s · TTFT {formatSeconds(point.x)}</div>
                  <div style={{ opacity: 0.7 }}>{point.runs} distinct run(s) · {point.repetitions} repetitions</div>
                  <div style={{ opacity: 0.7 }}>Skulk {point.skulkVersion ?? 'unknown'}{point.skulkCommit ? ` · ${point.skulkCommit.slice(0, 8)}` : ''}</div>
                  {point.latestRunId && <button type="button" onClick={() => navigate(`/run/${point.latestRunId}`)} style={{ all: 'unset', cursor: 'pointer', color: palette.cyan }}>Open latest run</button>}
                </TooltipShell>
              );
            }}
          />
          <Scatter
            data={points}
            fillOpacity={0.85}
            onClick={(raw: unknown) => {
              const point = raw as ScatterPoint;
              if (point.slug) navigate(`/model/${point.slug}?suite=${encodeURIComponent(point.suiteId)}&test=${encodeURIComponent(point.testName)}&protocol=${encodeURIComponent(point.protocol)}&source=${point.source}&tier=${point.tier}&hardware=${point.seriesId}`);
            }}
            style={{ cursor: 'pointer' }}
            shape="circle"
          >
            {points.map((point) => (
              <Cell key={point.seriesId} fill={point.fill} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
