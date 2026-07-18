import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ConcurrencyCurve } from '../../data/schema';
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
 * Throughput vs concurrency for one sweep: aggregate tok/s (climbs as batching
 * amortizes work across simultaneous clients) against per-request p50 tok/s
 * (falls as each client shares the engine). The crossing pair IS the batching
 * story -- a flat aggregate line means the engine serializes; a rising one
 * means added clients buy real throughput. X is the sweep's concurrency level
 * on a log scale so 1..64 spreads evenly.
 */
export function ConcurrencyChart({ curve }: { curve: ConcurrencyCurve }) {
  const palette = useChartPalette();

  const series = curve.points
    .filter((p) => p.aggregateTps != null || p.perRequestTpsP50 != null)
    .map((p) => ({
      concurrency: p.concurrency,
      aggregate: p.aggregateTps,
      perRequest: p.perRequestTpsP50,
      perRequestP90: p.perRequestTpsP90,
      ttftP50S: p.ttftP50S,
      succeeded: p.succeeded,
      failed: p.failed,
    }));

  if (series.length === 0) return null;

  return (
    <ChartCard>
      <ChartHeading>
        <ChartTitle>Throughput vs concurrency</ChartTitle>
        <ChartHint>
          {curve.hardwareLabel} · {formatDate(curve.startedAt)}
        </ChartHint>
      </ChartHeading>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={series} margin={{ top: 12, right: 20, bottom: 8, left: 4 }}>
          <CartesianGrid stroke={palette.grid} />
          <XAxis
            dataKey="concurrency"
            type="number"
            scale="log"
            domain={['dataMin', 'dataMax']}
            ticks={series.map((s) => s.concurrency)}
            stroke={palette.axis}
            tick={{ fill: palette.axis, fontFamily: palette.font, fontSize: 11 }}
            label={{
              value: 'concurrent clients',
              position: 'insideBottom',
              offset: -4,
              fill: palette.axis,
              fontSize: 11,
            }}
          />
          <YAxis
            stroke={palette.axis}
            tick={{ fill: palette.axis, fontFamily: palette.font, fontSize: 11 }}
            label={{ value: 'tok/s', angle: -90, position: 'insideLeft', fill: palette.axis, fontSize: 11 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof series)[number];
              return (
                <TooltipShell>
                  <strong>{p.concurrency} concurrent</strong>
                  {p.aggregate != null && <div>aggregate {formatTps(p.aggregate)} tok/s</div>}
                  {p.perRequest != null && <div>per-request p50 {formatTps(p.perRequest)} tok/s</div>}
                  {p.ttftP50S != null && <div>TTFT p50 {p.ttftP50S.toFixed(2)}s</div>}
                  {p.succeeded != null && (
                    <div style={{ opacity: 0.7 }}>
                      {p.succeeded} ok{p.failed ? ` · ${p.failed} failed` : ''}
                    </div>
                  )}
                </TooltipShell>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontFamily: palette.font, fontSize: 11, color: palette.axis }}
          />
          <Line
            type="monotone"
            dataKey="aggregate"
            name="aggregate"
            stroke={palette.amber}
            strokeWidth={2}
            dot={{ r: 3, fill: palette.amber }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="perRequest"
            name="per-request p50"
            stroke={palette.cyan}
            strokeWidth={2}
            dot={{ r: 3, fill: palette.cyan }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
