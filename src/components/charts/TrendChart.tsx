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
import { useNavigate } from 'react-router-dom';

import type { PerformanceSeries, SeriesSummary } from '../../data/schema';
import { formatDate, formatTps } from '../../data/format';
import {
  ChartCard,
  ChartHeading,
  ChartHint,
  ChartTitle,
  TooltipShell,
  useChartPalette,
} from './ChartFrame';

export interface TrendSeriesRow {
  series: PerformanceSeries;
  summary: SeriesSummary;
}

/** Separate linear traces per exact execution profile; legacy stays unconnected. */
export function TrendChart({ rows, legacy }: { rows: TrendSeriesRow[]; legacy: PerformanceSeries[] }) {
  const palette = useChartPalette();
  const navigate = useNavigate();
  const colors = [palette.amber, palette.cyan, '#a78bfa', '#5fd0a6', '#ff7a6b', '#f472b6'];
  const byX = new Map<number, Record<string, number | string | null>>();
  for (const row of rows) {
    row.series.points.forEach((point, index) => {
      const x = point.startedAt ? Date.parse(point.startedAt) : index;
      const record = byX.get(x) ?? { x };
      record[row.series.seriesId] = point.decodeTps;
      byX.set(x, record);
    });
  }
  for (const series of legacy) {
    series.points.forEach((point, index) => {
      const x = point.startedAt ? Date.parse(point.startedAt) : index;
      const record = byX.get(x) ?? { x };
      record[`legacy:${series.seriesId}`] = point.decodeTps;
      byX.set(x, record);
    });
  }
  const data = [...byX.values()].sort((a, b) => Number(a.x) - Number(b.x));

  if (data.length === 0) {
    return <ChartCard><ChartTitle>Decode throughput over time</ChartTitle><p style={{ color: palette.axis }}>No observations in this context.</p></ChartCard>;
  }

  return (
    <ChartCard>
      <ChartHeading>
        <ChartTitle>Decode throughput over time</ChartTitle>
        <ChartHint>one line per exact hardware/backend profile · neutral dots are legacy</ChartHint>
      </ChartHeading>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 12, right: 20, bottom: 8, left: 4 }}>
          <CartesianGrid stroke={palette.grid} />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} scale="time" stroke={palette.axis} tick={{ fill: palette.axis, fontFamily: palette.font, fontSize: 10 }} tickFormatter={(value: number) => formatDate(new Date(value).toISOString())} minTickGap={40} />
          <YAxis stroke={palette.axis} tick={{ fill: palette.axis, fontFamily: palette.font, fontSize: 11 }} label={{ value: 'tok/s', angle: -90, position: 'insideLeft', fill: palette.axis, fontSize: 11 }} />
          <Tooltip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return <TooltipShell><strong>{formatDate(new Date(Number(label)).toISOString())}</strong>{payload.filter((item) => item.value != null).map((item) => { const key = String(item.dataKey); const row = rows.find((candidate) => candidate.series.seriesId === key); const legacySeries = key.startsWith('legacy:') ? legacy.find((candidate) => candidate.seriesId === key.slice(7)) : undefined; const series = row?.series ?? legacySeries; const point = series?.points.find((candidate) => candidate.startedAt != null && Date.parse(candidate.startedAt) === Number(label)); return series ? <div key={key}><strong>{formatTps(Number(item.value))} tok/s</strong> · {series.hardware.label} · {series.resolvedBackends.join(', ') || 'backend unrecorded'}<div>{series.tier} · {series.source.replace('_', ' ')} · protocol {series.protocolId?.slice(0, 12) ?? 'legacy'}</div><div>{point?.validRepetitionCount ?? '—'}/{point?.repetitionCount ?? '—'} valid repetitions · Skulk {point?.skulkVersion ?? 'unknown'}{point?.skulkCommit ? ` · ${point.skulkCommit.slice(0, 8)}` : ''}</div>{legacySeries && <div>Legacy · comparison and stability ineligible</div>}{point && <button type="button" onClick={() => navigate(`/run/${point.runId}`)} style={{ all: 'unset', cursor: 'pointer', color: palette.cyan }}>Open run</button>}</div> : null; })}</TooltipShell>;
          }} />
          <Legend formatter={(value: string) => { const row = rows.find((candidate) => candidate.series.seriesId === value); return row ? `${row.series.hardware.label} · ${row.series.resolvedBackends.join(', ')} · ${row.series.tier}` : value; }} wrapperStyle={{ fontFamily: palette.font, fontSize: 10 }} />
          {rows.map((row, index) => <Line key={row.series.seriesId} type="linear" dataKey={row.series.seriesId} name={row.series.seriesId} stroke={colors[index % colors.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />)}
          {legacy.map((series) => <Line key={`legacy:${series.seriesId}`} type="linear" dataKey={`legacy:${series.seriesId}`} name={`legacy:${series.seriesId}`} stroke="transparent" strokeWidth={0} dot={{ r: 4, fill: palette.neutral, stroke: 'none', fillOpacity: 0.65 }} activeDot={{ r: 5, fill: palette.neutral, stroke: 'none' }} connectNulls={false} legendType="none" isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
