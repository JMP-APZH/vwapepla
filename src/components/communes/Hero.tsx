import type { HeroValue } from "@/lib/communes/headline";
import { STRATA, VERY_LONG_DEBT_YEARS } from "@/lib/communes/config";
import { debtYears, pctDec } from "@/lib/communes/format";
import { eur } from "@/lib/core/format";
import { communes } from "@/i18n";
import type { NationalLine } from "@/lib/communes/national";
import { NationalCompare } from "./NationalCompare";
import { SpreadStrip } from "./SpreadStrip";

const HELP: Record<HeroValue["figure"]["kind"], string> = {
  ratio: communes.heroRateHelp.fr, years: communes.heroDebtYearsHelp.fr, per_hab: communes.heroEquipmentHelp.fr,
};

function show(h: HeroValue, v: number | null) {
  return h.figure.kind === "ratio" ? pctDec(v) : h.figure.kind === "years" ? debtYears(v) : eur(v);
}

/** Name of the group the median is taken on ("Médiane des 5 communes de 10 000 à 19 999 hab."). */
export function medianLabel(h: Pick<HeroValue, "reference">, stratum: string | null) {
  return h.reference.kind === "stratum" && stratum && STRATA[stratum]
    ? communes.medianOfStratum.fr.replace("{n}", String(h.reference.size)).replace("{stratum}", STRATA[stratum])
    : communes.medianOfMartinique.fr.replace("{n}", String(h.reference.size));
}

/** "Bidjé-a an 3 chif": the hero trio — the commune's value, what it means, and one median. No score, no rank. */
export function Hero({ values, stratum, national, nationalStratum, help = {} }: {
  values: HeroValue[]; stratum: string | null; help?: Record<string, string>; // help text by figure key (default: by kind)
  national: Record<string, NationalLine | null>; nationalStratum: string | null; // DGFiP, main budget (Option A)
}) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {values.map((h) => {
        const veryLong = h.figure.kind === "years" && h.value != null && h.value > VERY_LONG_DEBT_YEARS;
        return (
          <section key={h.figure.key} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-medium text-slate-600">{h.figure.label}</h3>
            <p className={`mt-1 text-3xl font-semibold leading-tight tabular-nums ${veryLong ? "text-red-800" : ""}`}>
              {show(h, h.value)}
              {h.figure.kind === "per_hab" && h.value != null && <span className="text-base font-normal text-slate-500"> / hab.</span>}
            </p>
            {h.figure.kind === "years" && h.value == null && (
              <p className="mt-1 text-xs leading-snug text-slate-700">{communes.heroDebtYearsNa.fr}</p>
            )}
            {veryLong && <p className="mt-1 text-xs leading-snug text-red-900">{communes.heroDebtYearsVeryLong.fr}</p>}
            <p className="mt-1 text-xs leading-snug text-slate-500">{help[h.figure.key] ?? HELP[h.figure.kind]}</p>
            <p className="mt-2 text-xs text-slate-600 tabular-nums">
              {medianLabel(h, stratum)} : <span className="font-medium">{show(h, h.median)}</span>
              {h.figure.kind === "per_hab" && h.median != null && " / hab."}
            </p>
            {h.spread && (
              <SpreadStrip spread={h.spread} median={h.median} value={h.value} groupLabel={medianLabel(h, stratum)}
                           format={(v) => show(h, v) + (h.figure.kind === "per_hab" ? " / hab." : "")} />
            )}
            {national[h.figure.key] && <NationalCompare line={national[h.figure.key]!} stratum={nationalStratum} />}
          </section>
        );
      })}
    </div>
  );
}
