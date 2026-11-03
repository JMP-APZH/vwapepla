"use client";

import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ChartPoint = { year: number; value: number | null; provisional: boolean };
export type TermBand = { id: string; from: number; to: number; electionYear: number };

const INK = "#334155"; // slate-700: one series per chart, identity carried by the title
// Election years: warm amber, clearly distinct from the slate series and the grid (also readable for colour-blind users,
// and doubled by a dashed line + text label so colour is never the only cue).
export const ELECTION_FILL = "#fde68a"; // amber-200
export const ELECTION_INK = "#b45309"; // amber-700
const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** One indicator, € / inhabitant per year, with term bands and the shared election years shaded. */
export function TermsChart({ title, points, bands }: { title: string; points: ChartPoint[]; bands: TermBand[] }) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-3">
      <figcaption className="text-sm font-medium">{title} <span className="font-normal text-slate-500">(€ / hab.)</span></figcaption>
      <div className="mt-2 h-40">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 300, height: 160 }}>
          <LineChart data={points} margin={{ top: 16, right: 18, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            {bands.map((b) => (
              <ReferenceArea key={b.id} x1={b.electionYear - 0.5} x2={b.electionYear + 0.5} fill={ELECTION_FILL}
                             fillOpacity={0.55} ifOverflow="hidden" />
            ))}
            {bands.map((b) => (
              <ReferenceLine key={`l-${b.id}`} x={b.electionYear} stroke={ELECTION_INK} strokeDasharray="3 3" strokeWidth={1.5}
                             ifOverflow="hidden"
                             label={{ value: `élection ${b.electionYear}`, position: "insideTop", fontSize: 10, fontWeight: 600, fill: ELECTION_INK }} />
            ))}
            <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} tickCount={8} allowDecimals={false}
                   tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
            <YAxis width={44} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false}
                   tickFormatter={(v: number) => fmt.format(v)} />
            <Tooltip
              formatter={(v) => [`${fmt.format(Number(v))} € / hab.`, title]}
              labelFormatter={(y) => {
                const p = points.find((x) => x.year === Number(y));
                return `${y}${p?.provisional ? " (provisoire)" : ""}${bands.some((b) => b.electionYear === Number(y)) ? " — année d'élection" : ""}`;
              }}
            />
            <Line type="monotone" dataKey="value" stroke={INK} strokeWidth={2} dot={{ r: 2.5, fill: INK }}
                  activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
