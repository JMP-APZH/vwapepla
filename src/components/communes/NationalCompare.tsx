import type { NationalLine } from "@/lib/communes/national";
import { debtYears, pctDec } from "@/lib/communes/format";
import { perHab } from "@/lib/core/format";
import { communes } from "@/i18n";

export function formatNational(line: Pick<NationalLine, "unit">, v: number | null) {
  return line.unit === "pct" ? pctDec(v) : line.unit === "years" ? debtYears(v) : perHab(v);
}

/**
 * Option A (JM, 4 Nov 2026): the official national average of the DGFiP stratum, on its own line, next to the
 * commune's own DGFiP figure (main budget only) — never next to the card's consolidated figure.
 */
export function NationalCompare({ line, stratum, showBasis = false }: {
  line: NationalLine; stratum: string | null; showBasis?: boolean; // basis note: once per block
}) {
  return (
    <div className="mt-2 border-t border-dashed border-slate-200 pt-2 text-xs leading-snug text-slate-600">
      <p><span className="font-medium text-slate-700">Repère national</span> (DGFiP, budget principal) · {line.label}</p>
      <p className="tabular-nums">
        {communes.nationalLine.fr
          .replace("{stratum}", stratum ?? "même strate")
          .replace("{avg}", formatNational(line, line.average))
          .replace("{mine}", formatNational(line, line.commune))}
      </p>
      {showBasis && <p className="text-[11px] text-slate-500">{communes.nationalBasis.fr}</p>}
    </div>
  );
}
