import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ModelTimePoint } from '../../data/schema';
import { formatDate, formatTps } from '../../data/format';
import {
  ChartCard,
  ChartHeading,
  ChartHint,
  ChartTitle,
  TooltipShell,
  useChartPalette,
} from './ChartFrame';

/**
 * Decode throughput over time for one model. The line connects only credible
 * points. Physically plausible low-sample runs are shown as amber indicative
 * dots; rejected/noisy runs remain neutral, so the history is complete without
 * letting either group drive the credible trend line.
 */
export function TrendChart({ timeline }: { timeline: ModelTimePoint[] }) {
  const palette = useChartPalette();

  const withValue = timeline.filter((t) => t.decodeTpsMedian != null);
  // Real temporal x when timestamps exist (so sparse credible points sit where
  // they actually happened), falling back to ordinal index otherwise.
  const series = withValue.map((t, i) => ({
    idx: t.startedAt ? new Date(t.startedAt).getTime() : i,
    runId: t.runId,
    label: formatDate(t.startedAt),
    value: t.decodeTpsMedian as number,
    credible: t.credible,
    indicative: t.indicative,
    version: t.skulkVersion,
    line: t.credible ? (t.decodeTpsMedian as number) : null,
  }));

  // Scale the axis to the credible points so a dimmed artifact (an implausible
  // wall-throughput spike) clips out of view instead of crushing the real signal.
  const scaleValues = series.filter((s) => s.credible || s.indicative).map((s) => s.value);
  const yMax = scaleValues.length
    ? Math.ceil((Math.max(...scaleValues) * 1.2) / 10) * 10
    : 'auto';

  if (series.length === 0) {
    return (
      <ChartCard>
        <ChartTitle>Decode throughput over time</ChartTitle>
        <p style={{ color: palette.axis, marginTop: 12 }}>No timed throughput samples for this model yet.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard>
      <ChartHeading>
        <ChartTitle>Decode throughput over time</ChartTitle>
        <ChartHint>line = credible · amber dot = indicative · gray dot = rejected</ChartHint>
      </ChartHeading>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={series} margin={{ top: 12, right: 20, bottom: 8, left: 4 }}>
          <CartesianGrid stroke={palette.grid} />
          <XAxis
            dataKey="idx"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            stroke={palette.axis}
            tick={{ fill: palette.axis, fontFamily: palette.font, fontSize: 10 }}
            tickFormatter={(v: number) => formatDate(new Date(v).toISOString())}
            minTickGap={40}
          />
          <YAxis
            stroke={palette.axis}
            domain={[0, yMax]}
            allowDataOverflow
            tick={{ fill: palette.axis, fontFamily: palette.font, fontSize: 11 }}
            label={{ value: 'tok/s', angle: -90, position: 'insideLeft', fill: palette.axis, fontSize: 11 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof series)[number];
              return (
                <TooltipShell>
                  <strong>{formatTps(p.value)} tok/s</strong>
                  <div>{p.label}</div>
                  {p.version && <div>Skulk {p.version}</div>}
                  <div style={{ opacity: 0.7 }}>
                    {p.credible ? 'credible' : p.indicative ? 'indicative' : 'excluded from rollups'}
                  </div>
                </TooltipShell>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="line"
            stroke={palette.amber}
            strokeWidth={2}
            dot={{ r: 3, fill: palette.amber }}
            connectNulls
            isAnimationActive={false}
          />
          {series
            .filter((p) => !p.credible)
            .map((p) => (
              <ReferenceDot
                key={p.runId}
                x={p.idx}
                y={p.value}
                r={3}
                fill={p.indicative ? palette.amber : palette.neutral}
                stroke="none"
                fillOpacity={p.indicative ? 0.65 : 0.4}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
