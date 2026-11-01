"use client";

import { useState } from "react";
import type { LineValue, Reference } from "@/lib/breakdown";
import type { Source } from "@/lib/data";
import { meur, pct, perHab, years as yrs } from "@/lib/format";
import { SourceNote } from "./SourceNote";
import { t } from "@/i18n/strings";

export type BlockYear = { id: string; title: string; values: LineValue[]; reference: Reference; sources: Source[] };
export type BudgetYear = { year: number; provisional: boolean; blocks: BlockYear[] };

function refLabel(r: Reference) {
  return r.kind === "stratum" ? `${t.medianStratum.fr} (${r.size} communes)` : `${t.medianMartinique.fr} (${r.size} communes)`;
}

function Line({ v, scale, bars }: { v: LineValue; scale: number; bars: boolean }) {
  const isEur = v.unit === "eur";
  const main = isEur ? perHab(v.perHab) : v.unit === "years" ? yrs(v.amount) : pct(v.amount);
  const width = bars && isEur && v.perHab != null && v.perHab > 0 && scale > 0 ? Math.min(1, v.perHab / scale) : 0;
  return (
    <li className={v.depth === 0 ? "pt-2" : ""} style={{ paddingLeft: `${v.depth * 0.9}rem` }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`min-w-0 ${v.depth === 0 ? "font-medium" : ""} ${v.subset ? "italic text-slate-600" : ""}`}>
          {v.label}
        </span>
        <span className={`shrink-0 tabular-nums ${v.depth === 0 ? "font-semibold" : ""}`}>{main}</span>
      </div>
      {width > 0 && (
        <div className="mt-1 h-1.5 rounded-full bg-slate-100" aria-hidden>
          <div className={`h-1.5 rounded-full ${v.subset ? "bg-slate-300" : "bg-slate-600"}`} style={{ width: `${width * 100}%` }} />
        </div>
      )}
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500 tabular-nums">
        {isEur && <>{meur(v.amount)}</>}
        {isEur && v.share != null && <> · {pct(v.share)} {v.subset ? "de la ligne au-dessus" : "du total"}</>}
        {isEur && " · "}médiane : {isEur ? perHab(v.median) : v.unit === "years" ? yrs(v.median) : pct(v.median)}
      </p>
      {v.key === "capacite_desendettement" && (
        <p className="text-[11px] leading-snug text-slate-500">
          {v.amount == null
            ? "Non calculable : l'épargne brute est négative ou nulle cette année-là."
            : "Années d'épargne brute nécessaires pour rembourser toute la dette."}
        </p>
      )}
    </li>
  );
}

/** Income, spending, investment and debt blocks for one commune, with a year switcher (all years pre-rendered). */
export function BudgetBreakdown({ data, defaultYear }: { data: BudgetYear[]; defaultYear: number }) {
  const [year, setYear] = useState(defaultYear);
  const current = data.find((d) => d.year === year) ?? data.at(-1)!;
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Le budget en détail</h2>
      <p className="mt-1 text-sm text-slate-600">
        Comptes consolidés (budget principal et budgets annexes), en euros par habitant.
      </p>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Exercice">
        {data.map((d) => (
          <button
            key={d.year}
            type="button"
            aria-pressed={d.year === year}
            onClick={() => setYear(d.year)}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm tabular-nums ${
              d.year === year ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}
          >
            {d.year}{d.provisional && <span className="ml-1 text-[10px] uppercase opacity-75">{t.provisional.fr}</span>}
          </button>
        ))}
      </div>
      {current.provisional && <p className="mt-2 text-xs text-amber-800">{t.provisionalNote.fr}</p>}
      <div className="mt-3 space-y-3">
        {current.blocks.map((b) => {
          const bars = b.id !== "savings_debt";
          const scale = Math.max(0, ...b.values.filter((v) => v.depth === 0).map((v) => v.perHab ?? 0));
          return (
            <section key={b.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold">{b.title} <span className="font-normal text-slate-500">· {current.year}</span></h3>
              <p className="text-[11px] text-slate-500">Médiane : {refLabel(b.reference)}</p>
              <ul className="mt-1 space-y-2 text-sm">
                {b.values.map((v) => <Line key={v.key} v={v} scale={scale} bars={bars} />)}
              </ul>
              <SourceNote sources={b.sources} year={current.year} />
            </section>
          );
        })}
      </div>
    </section>
  );
}
