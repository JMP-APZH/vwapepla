"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Point } from "@/lib/ctm/budget";

const INK = "#334155"; // slate-700: one series per chart, identity carried by the title
const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export type Unit = "meur" | "years";
const UNIT: Record<Unit, { caption: string; axis: (v: number) => string; tip: (v: number) => string }> = {
  meur: { caption: "M€", axis: (v) => fmt.format(v / 1e6), tip: (v) => `${fmt1.format(v / 1e6)} M€` },
  years: { caption: "années", axis: (v) => fmt.format(v), tip: (v) => `${fmt1.format(v)} ans` },
};

/** One CTM indicator per year. The provisional year is drawn with a hollow dot and named in the tooltip. */
export function TrendChart({ title, points, unit = "meur" }: { title: string; points: Point[]; unit?: Unit }) {
  const u = UNIT[unit];
  return (
    <figure className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-3">
      <figcaption className="text-sm font-medium">{title} <span className="font-normal text-slate-500">({u.caption})</span></figcaption>
      <div className="mt-2 h-40">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 300, height: 160 }}>
          <LineChart data={points} margin={{ top: 12, right: 14, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} tickCount={6} allowDecimals={false}
                   tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
            <YAxis width={44} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false}
                   tickFormatter={(v: number) => u.axis(v)} />
            <Tooltip
              formatter={(v) => [u.tip(Number(v)), title]}
              labelFormatter={(y) => `${y}${points.find((p) => p.year === Number(y))?.provisional ? " (provisoire)" : ""}`}
            />
            <Line type="linear" dataKey="value" stroke={INK} strokeWidth={2} connectNulls={false} isAnimationActive={false}
                  activeDot={{ r: 5 }}
                  dot={(p: { cx?: number; cy?: number; index?: number }) => p.cx == null || p.cy == null
                    ? <g key={p.index} />
                    : <circle key={p.index} cx={p.cx} cy={p.cy} r={3} stroke={INK} strokeWidth={1.5}
                              fill={points[p.index ?? 0]?.provisional ? "#fff" : INK} />} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
