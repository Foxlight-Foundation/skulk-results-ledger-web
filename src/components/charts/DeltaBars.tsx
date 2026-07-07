import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatSignedPercent, formatTps } from '../../data/format';
import { ChartCard, ChartHeading, ChartHint, ChartTitle, TooltipShell, useChartPalette } from './ChartFrame';

interface DeltaRow {
  modelId: string;
  baseline: number | null;
  candidate: number | null;
  percent: number | null;
}

/** Horizontal diverging bars: candidate-vs-baseline decode-throughput deltas. */
export function DeltaBars({ rows }: { rows: DeltaRow[] }) {
  const palette = useChartPalette();
  const data = rows
    .filter((r) => r.percent != null)
    .map((r) => ({
      name: r.modelId.split('/').pop() ?? r.modelId,
      percent: r.percent as number,
      baseline: r.baseline,
      candidate: r.candidate,
    }));

  if (data.length === 0) {
    return (
      <ChartCard>
        <ChartTitle>Per-model delta</ChartTitle>
        <p style={{ color: palette.axis, marginTop: 12 }}>No models are present in both runs.</p>
      </ChartCard>
    );
  }

  const height = Math.max(160, data.length * 34 + 60);

  return (
    <ChartCard>
      <ChartHeading>
        <ChartTitle>Per-model delta</ChartTitle>
        <ChartHint>candidate vs baseline · decode tok/s</ChartHint>
      </ChartHeading>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
          <XAxis
            type="number"
            stroke={palette.axis}
            tick={{ fill: palette.axis, fontFamily: palette.font, fontSize: 11 }}
            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
            domain={['dataMin', 'dataMax']}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            stroke={palette.axis}
            tick={{ fill: palette.axis, fontFamily: palette.font, fontSize: 11 }}
          />
          <ReferenceLine x={0} stroke={palette.axis} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof data)[number];
              return (
                <TooltipShell>
                  <strong>{p.name}</strong>
                  <div>
                    {formatTps(p.baseline)} → {formatTps(p.candidate)} tok/s
                  </div>
                  <div style={{ color: p.percent >= 0 ? palette.pass : palette.fail }}>
                    {formatSignedPercent(p.percent)}
                  </div>
                </TooltipShell>
              );
            }}
          />
          <Bar dataKey="percent" radius={[3, 3, 3, 3]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.percent >= 0 ? palette.pass : palette.fail} />
            ))}
            <LabelList
              dataKey="percent"
              position="right"
              formatter={(v: number) => formatSignedPercent(v)}
              style={{ fill: palette.axis, fontFamily: palette.font, fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
