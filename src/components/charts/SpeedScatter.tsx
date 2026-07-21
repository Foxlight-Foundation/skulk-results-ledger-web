import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Cell,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  ResponsiveContainer,
} from 'recharts';

import type { ModelRollup } from '../../data/schema';
import { FAMILY_META, formatSeconds, formatTps } from '../../data/format';
import { ChartCard, ChartHeading, ChartHint, ChartTitle, TooltipShell, useChartPalette } from './ChartFrame';

interface Point {
  x: number;
  y: number;
  z: number;
  slug: string;
  name: string;
  family: string;
  fill: string;
  confidence: 'credible' | 'indicative';
}

/**
 * Speed-vs-latency scatter: y = typical decode tok/s, x = independently
 * measured TTFT.
 * The upper-left is the sweet spot (fast decode, low latency). Colored by
 * engine family and sized by run count. Credible points are solid; a model
 * with only physically plausible low-sample measurements is shown dimmed and
 * labeled indicative rather than silently disappearing.
 */
export function SpeedScatter({ models }: { models: ModelRollup[] }) {
  const palette = useChartPalette();
  const navigate = useNavigate();

  const points: Point[] = models
    .filter(
      (m) =>
        (m.decodeTpsTypical != null || m.decodeTpsIndicative != null) &&
        m.ttftLatestMedian != null,
    )
    .map((m) => {
      const fam = FAMILY_META[m.family].color;
      const confidence = m.decodeTpsTypical != null ? 'credible' : 'indicative';
      return {
        x: m.ttftLatestMedian as number,
        y: (m.decodeTpsTypical ?? m.decodeTpsIndicative) as number,
        z: Math.max(m.runCount, 1),
        slug: m.slug,
        name: m.displayName,
        family: FAMILY_META[m.family].label,
        fill: fam === 'cyan' ? palette.cyan : fam === 'amber' ? palette.amber : palette.neutral,
        confidence,
      };
    });

  return (
    <ChartCard>
      <ChartHeading>
        <ChartTitle>Speed vs. latency</ChartTitle>
        <ChartHint>
          y: decode tok/s · x: time to first token · size: runs · dim: indicative
        </ChartHint>
      </ChartHeading>
      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 12, right: 24, bottom: 28, left: 8 }}>
          <CartesianGrid stroke={palette.grid} />
          <XAxis
            type="number"
            dataKey="x"
            name="TTFT"
            stroke={palette.axis}
            tick={{ fill: palette.axis, fontFamily: palette.font, fontSize: 11 }}
            tickFormatter={(v: number) => formatSeconds(v)}
            label={{ value: 'time to first token', position: 'bottom', fill: palette.axis, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="decode tok/s"
            stroke={palette.axis}
            tick={{ fill: palette.axis, fontFamily: palette.font, fontSize: 11 }}
            label={{ value: 'decode tok/s', angle: -90, position: 'insideLeft', fill: palette.axis, fontSize: 11 }}
          />
          <ZAxis type="number" dataKey="z" range={[60, 420]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: palette.axis }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <TooltipShell>
                  <strong>{p.name}</strong>
                  <div>{p.family}</div>
                  <div>
                    decode {formatTps(p.y)} tok/s · TTFT {formatSeconds(p.x)}
                  </div>
                  <div style={{ opacity: 0.7 }}>
                    {p.confidence} · {p.z} run(s) · click to open
                  </div>
                </TooltipShell>
              );
            }}
          />
          <Scatter
            data={points}
            fillOpacity={0.85}
            onClick={(p: unknown) => {
              const point = p as Point;
              if (point?.slug) navigate(`/model/${point.slug}`);
            }}
            style={{ cursor: 'pointer' }}
            shape="circle"
          >
            {points.map((p) => (
              <Cell key={p.slug} fill={p.fill} fillOpacity={p.confidence === 'credible' ? 0.85 : 0.35} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
