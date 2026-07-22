import { useState } from 'react';
import {
  Bar,
  BarChart,
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
  BarsGlyph,
  ChartCard,
  ChartHeading,
  ChartHint,
  ChartTitle,
  ChartToggleButton,
  ChartToggleGroup,
  HeadlineBlock,
  HeadlineLabel,
  HeadlineNote,
  HeadlineRow,
  HeadlineStat,
  HeadlineValue,
  LineGlyph,
  TooltipShell,
  useChartPalette,
} from './ChartFrame';

/**
 * Throughput vs concurrency for one sweep: aggregate tok/s (climbs as batching
 * amortizes work across simultaneous clients) against per-request p50 tok/s
 * (falls as each client shares the engine). Headline callouts surface the
 * takeaway -- peak aggregate and the per-request rate at that same level --
 * before the reader parses axes, with a plain-language explainer beneath.
 * Renders as grouped bars by default (levels are discrete sweep points, not a
 * continuum); a toggle offers the line view for tracing the trend.
 */
export function ConcurrencyChart({ curve }: { curve: ConcurrencyCurve }) {
  const palette = useChartPalette();
  const [mode, setMode] = useState<'bars' | 'line'>('bars');

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

  // Headline: the peak-aggregate level and its per-request share, plus the
  // single-stream baseline when the sweep includes concurrency 1.
  const peak = series.reduce((best, p) =>
    (p.aggregate ?? -1) > (best.aggregate ?? -1) ? p : best,
  );
  const single = series.find((p) => p.concurrency === 1);
  const scaling =
    single?.aggregate && peak.aggregate && peak.concurrency !== 1
      ? peak.aggregate / single.aggregate
      : null;

  const axisProps = {
    stroke: palette.axis,
    tick: { fill: palette.axis, fontFamily: palette.font, fontSize: 11 },
  };
  const xLabel = {
    value: 'concurrent clients',
    position: 'insideBottom' as const,
    offset: -4,
    fill: palette.axis,
    fontSize: 11,
  };
  const yLabel = {
    value: 'tok/s',
    angle: -90,
    position: 'insideLeft' as const,
    fill: palette.axis,
    fontSize: 11,
  };
  const tooltip = (
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
  );
  const legend = (
    <Legend wrapperStyle={{ fontFamily: palette.font, fontSize: 11, color: palette.axis }} />
  );

  return (
    <ChartCard>
      <ChartHeading>
        <ChartTitle>Throughput vs concurrency</ChartTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ChartHint>
            {curve.hardware.label} · {curve.resolvedBackends.join(', ') || 'backend unrecorded'} · {formatDate(curve.startedAt)}
          </ChartHint>
          <ChartToggleGroup role="group" aria-label="chart style">
            <ChartToggleButton
              $active={mode === 'bars'}
              onClick={() => setMode('bars')}
              aria-label="bar chart"
              title="Bar chart"
            >
              <BarsGlyph />
            </ChartToggleButton>
            <ChartToggleButton
              $active={mode === 'line'}
              onClick={() => setMode('line')}
              aria-label="line chart"
              title="Line chart"
            >
              <LineGlyph />
            </ChartToggleButton>
          </ChartToggleGroup>
        </div>
      </ChartHeading>

      <HeadlineBlock>
        <HeadlineRow>
        {peak.aggregate != null && (
          <HeadlineStat>
            <HeadlineValue>{formatTps(peak.aggregate)} tok/s</HeadlineValue>
            <HeadlineLabel>peak aggregate · {peak.concurrency} concurrent</HeadlineLabel>
          </HeadlineStat>
        )}
        {peak.perRequest != null && (
          <HeadlineStat>
            <HeadlineValue>{formatTps(peak.perRequest)} tok/s</HeadlineValue>
            <HeadlineLabel>per request at peak</HeadlineLabel>
          </HeadlineStat>
        )}
        {single?.aggregate != null && peak.concurrency !== 1 && (
          <HeadlineStat>
            <HeadlineValue>{formatTps(single.aggregate)} tok/s</HeadlineValue>
            <HeadlineLabel>single stream</HeadlineLabel>
          </HeadlineStat>
        )}
      </HeadlineRow>
      <HeadlineNote>
        {scaling != null && scaling > 1.2
          ? `Batching scales this model: at ${peak.concurrency} concurrent clients it sustains ` +
            `${formatTps(peak.aggregate as number)} tok/s in total -- ${scaling.toFixed(1)}x its ` +
            `single-stream rate -- while each request still decodes at ` +
            `${peak.perRequest != null ? formatTps(peak.perRequest) : '?'} tok/s.`
          : `Aggregate throughput stays roughly flat as clients are added, so concurrent requests ` +
            `share the engine serially -- each request's rate falls with every client added.`}
        </HeadlineNote>
      </HeadlineBlock>

      <ResponsiveContainer width="100%" height={300}>
        {mode === 'bars' ? (
          <BarChart data={series} margin={{ top: 12, right: 20, bottom: 8, left: 4 }} barCategoryGap="25%">
            <CartesianGrid stroke={palette.grid} vertical={false} />
            <XAxis dataKey="concurrency" type="category" {...axisProps} label={xLabel} />
            <YAxis width={60} {...axisProps} label={yLabel} />
            {tooltip}
            {legend}
            <Bar
              dataKey="aggregate"
              name="aggregate"
              fill={palette.amber}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="perRequest"
              name="per-request p50"
              fill={palette.cyan}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        ) : (
          <LineChart data={series} margin={{ top: 12, right: 20, bottom: 8, left: 4 }}>
            <CartesianGrid stroke={palette.grid} />
            <XAxis
              dataKey="concurrency"
              type="number"
              scale="log"
              domain={['dataMin', 'dataMax']}
              ticks={series.map((s) => s.concurrency)}
              {...axisProps}
              label={xLabel}
            />
            <YAxis width={60} {...axisProps} label={yLabel} />
            {tooltip}
            {legend}
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
        )}
      </ResponsiveContainer>
    </ChartCard>
  );
}
