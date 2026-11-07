import type { Spread } from "@/lib/communes/headline";

/**
 * Where the commune sits among the communes of its group: a thin strip with the middle half of the group (P25-P75),
 * the median tick and the commune's mark. No names of other communes, no rank (Step 3, B1-COMPARISONS.md §2).
 * Far-away values (beyond 1.5 x the middle half) are drawn at the edge with an arrow, so one outlier does not
 * squeeze the band; the exact value is always written in the text above.
 */
export function SpreadStrip({ spread, median, value, format, groupLabel }: {
  spread: Spread; median: number | null; value: number | null; format: (v: number) => string; groupLabel: string;
}) {
  const iqr = spread.p75 - spread.p25;
  const lo = Math.max(spread.min, spread.p25 - 1.5 * iqr), hi = Math.min(spread.max, spread.p75 + 1.5 * iqr);
  const span = hi - lo || 1;
  const at = (v: number) => Math.min(100, Math.max(0, ((v - lo) / span) * 100));
  const off = value == null ? null : value < lo ? "left" : value > hi ? "right" : null;
  const label = `${groupLabel} : la moitié des communes entre ${format(spread.p25)} et ${format(spread.p75)}`
    + (value != null ? ` ; cette commune : ${format(value)}.` : ".");
  return (
    <div className="mt-2">
      <div role="img" aria-label={label} className="relative mx-1.5 h-4">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-100" />
        <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm bg-slate-300"
             style={{ left: `${at(spread.p25)}%`, width: `${Math.max(at(spread.p75) - at(spread.p25), 1)}%` }} />
        {median != null && (
          <div className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-slate-600" style={{ left: `${at(median)}%` }} />
        )}
        {value != null && (
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${at(value)}%` }}>
            {off
              ? <span aria-hidden className="block text-xs font-bold leading-none text-slate-900">{off === "left" ? "◀" : "▶"}</span>
              : <span aria-hidden className="block h-3 w-3 rounded-full border-2 border-white bg-slate-900 shadow" />}
          </div>
        )}
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500 tabular-nums">
        <span aria-hidden className="mr-1 inline-block h-2 w-3 rounded-sm bg-slate-300 align-middle" />
        la moitié des communes : {format(spread.p25)} – {format(spread.p75)}
        <span aria-hidden className="mx-1 inline-block h-2.5 w-2.5 rounded-full bg-slate-900 align-middle" />
        cette commune
      </p>
    </div>
  );
}
