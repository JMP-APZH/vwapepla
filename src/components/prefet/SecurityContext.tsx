import { Caveat, FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { meur, pct } from "@/lib/core/format";
import type { ContextFigure, CrimeLine, CrimeStat, SplitLine, UnemploymentRow } from "@/lib/prefet/context";
import { prefet } from "@/i18n";

const rate = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pc = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const r = (s: CrimeStat | undefined) => (s?.rate_per_1000 == null ? "—" : rate.format(s.rate_per_1000));
const v = (x: number | null | undefined) => (x == null ? "—" : `${pc.format(x)} %`);

/** Recorded crime per 1,000 inhabitants: Martinique first and last year; Guadeloupe, Guyane, La Réunion and France the last year. */
export function CrimeBlock({ years, groups, sources }: {
  years: [number, number]; groups: { label: string; lines: CrimeLine[] }[]; sources: Source[];
}) {
  const [y0, y1] = years;
  return (
    <FactBlock title={prefet.crimeTitle.fr} sources={sources} year={`${y0}–${y1}`}>
      <p className="mt-1 text-sm text-slate-600">{prefet.crimeIntro.fr}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1 pr-2 font-medium">{prefet.crimeIndicator.fr}</th>
              <th className="py-1 pr-2 text-right font-medium">Martinique {y0}</th>
              <th className="py-1 pr-2 text-right font-medium">Martinique {y1}</th>
              <th className="py-1 pr-2 text-right font-medium">Guadeloupe {y1}</th>
              <th className="py-1 pr-2 text-right font-medium">Guyane {y1}</th>
              <th className="py-1 pr-2 text-right font-medium">La Réunion {y1}</th>
              <th className="py-1 text-right font-medium">France {y1}</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.label}>
              <tr>
                <th colSpan={7} className="pt-3 pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{g.label}</th>
              </tr>
              {g.lines.map((l) => (
                <tr key={l.indicator} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2">
                    {l.indicator}
                    <span className="block text-[11px] text-slate-500">
                      {l.unit}{l.indicator.startsWith("Cambriolages") ? ` · ${prefet.perDwelling.fr}` : ""}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-slate-600">{r(l.first)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums font-medium">{r(l.last)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-slate-600">{r(l.guadeloupe)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-slate-600">{r(l.guyane)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-slate-600">{r(l.reunion)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600">{r(l.france)}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-500">{prefet.crimeUnitNote.fr}</p>
      <div className="mt-3"><Caveat>{prefet.crimeCaveat.fr}</Caveat></div>
    </FactBlock>
  );
}

/** Unemployment (INSEE, ILO, annual average) and poverty (INSEE study, 2021), Martinique next to France. */
export function SocialContext({ rows, poverty, sources }: { rows: UnemploymentRow[]; poverty: ContextFigure[]; sources: Source[] }) {
  const pov = (geo: string, group: string) => poverty.find((p) => p.geo === geo && p.group_label === group);
  const groups = [...new Set(poverty.map((p) => p.group_label))];
  return (
    <FactBlock title={prefet.socialTitle.fr} sources={sources} year={`${rows[0]?.year ?? ""}–${rows.at(-1)?.year ?? ""}`}>
      <h3 className="mt-2 text-sm font-semibold">{prefet.unemploymentTitle.fr}</h3>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full min-w-[24rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1 pr-2 font-medium">Année</th>
              <th className="py-1 pr-2 text-right font-medium">Martinique</th>
              <th className="py-1 pr-2 text-right font-medium">France métro.</th>
              <th className="py-1 pr-2 text-right font-medium">Martinique 15-24 ans</th>
              <th className="py-1 text-right font-medium">France métro. 15-24 ans</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((u) => (
              <tr key={u.year} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 font-medium">{u.year}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums font-medium">{v(u.mq)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-slate-600">{v(u.fm)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{v(u.mqYouth)}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">{v(u.fmYouth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-500">{prefet.unemploymentNote.fr}</p>

      {poverty.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-semibold">{prefet.povertyTitle.fr} ({poverty[0].period})</h3>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g} className="rounded-lg bg-slate-50 p-3 text-sm">
                <dt className="text-xs text-slate-500">{g}</dt>
                <dd>
                  <span className="text-lg font-semibold">{v(pov("972", g)?.value)}</span> {prefet.inMartinique.fr}
                  {" · "}{v(pov("FH", g)?.value)} {prefet.inHexagone.fr}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 text-xs text-slate-500">{pov("972", groups[0])?.note} « {pov("972", groups[0])?.quote} »</p>
          <p className="mt-1 text-xs text-slate-500">{prefet.povertyMissing.fr}</p>
        </>
      )}
    </FactBlock>
  );
}

/** Executed State credits of one year by policy area (Vwapepla's grouping of the DPT missions, shown in full). */
export function StateSplit({ year, total, lines, sources }: { year: number; total: number; lines: SplitLine[]; sources: Source[] }) {
  const color = (k: string) => (k === "securite" ? "bg-sky-700" : k === "social" ? "bg-emerald-700" : "bg-slate-500");
  return (
    <FactBlock title={`${prefet.splitTitle.fr} ${year}`} sources={sources} year={year}>
      <p className="mt-1 text-sm text-slate-600">{prefet.splitIntro.fr} {meur(total)}.</p>
      <ul className="mt-3 space-y-2">
        {lines.map((l) => (
          <li key={l.key} className="text-sm">
            <div className="flex justify-between gap-3">
              <span className={l.key === "securite" || l.key === "social" ? "font-semibold" : ""}>{l.label}</span>
              <span className="shrink-0 tabular-nums text-slate-600">{meur(l.cp)} · {pct(l.share)}</span>
            </div>
            <div className="mt-0.5 h-2 rounded bg-slate-100">
              <div className={`h-2 rounded ${color(l.key)}`} style={{ width: `${Math.max(1, l.share * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer">{prefet.splitMapping.fr}</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {lines.map((l) => <li key={l.key}><span className="font-medium">{l.label}</span> : {l.missions.join(" · ")}</li>)}
        </ul>
      </details>
      <div className="mt-3"><Caveat>{prefet.splitCaveat.fr}</Caveat></div>
    </FactBlock>
  );
}
