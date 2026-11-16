import Link from "next/link";
import { FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { meur, perHab } from "@/lib/core/format";
import type { Act } from "@/lib/ctm/acts";
import type { OctroiFigure, OctroiKind } from "@/lib/ctm/octroi";
import { ctm } from "@/i18n";

const KIND_LABEL: Record<OctroiKind, string> = {
  repartition: ctm.octroiKindRepartition.fr, tarifs: ctm.octroiKindTarifs.fr, vie_chere: ctm.octroiKindVieChere.fr,
  exonerations: ctm.octroiKindExonerations.fr, reforme: ctm.octroiKindReforme.fr, autre: ctm.octroiKindAutre.fr,
};
const num = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** The 34 communes' octroi de mer and the CTM's octroi de mer régional, per year, in two columns (never a total). */
export function OctroiTotals({ rows, range, sources }: {
  rows: { year: number; communes: number; communesCount: number; ctm: number | null; provisional: boolean }[];
  range: string; sources: Source[];
}) {
  return (
    <FactBlock title={<>{ctm.octroiTotalsTitle.fr} {range}</>} sources={sources} year={range}>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1 pr-2 font-medium">{ctm.colYear.fr}</th>
              <th className="py-1 pr-2 text-right font-medium">{ctm.octroiColCommunes.fr}</th>
              <th className="py-1 text-right font-medium">{ctm.octroiColCtm.fr}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year} className={`border-b border-slate-100 ${r.provisional ? "italic text-slate-500" : ""}`}>
                <td className="py-1.5 pr-2">{r.year}{r.provisional && " (provisoire)"}</td>
                <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums">
                  {meur(r.communes)}{r.communesCount !== 34 && <span className="block text-xs">{r.communesCount} communes</span>}
                </td>
                <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{meur(r.ctm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">{ctm.octroiTotalsNote.fr}</p>
    </FactBlock>
  );
}

/** One row per commune, alphabetical, collapsed by default; each row links to the commune's card. */
export function OctroiCommunes({ year, rows, sources }: {
  year: number; rows: { code: string; name: string; slug: string; amount: number | null; perHab: number | null }[];
  sources: Source[];
}) {
  return (
    <FactBlock title={ctm.octroiCommunesTitle.fr.replace("{year}", String(year))} sources={sources} year={year}>
      <details className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold">{ctm.octroiCommunesSummary.fr}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1 pr-2 font-medium">{ctm.octroiColCommune.fr}</th>
                <th className="py-1 pr-2 text-right font-medium">{ctm.octroiColAmount.fr}</th>
                <th className="py-1 text-right font-medium">{ctm.octroiColPerHab.fr}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2"><Link href={`/communes/${r.slug}`} className="underline">{r.name}</Link></td>
                  <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums">{meur(r.amount)}</td>
                  <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{perHab(r.perHab)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="mt-2 text-xs text-slate-500">{ctm.octroiCommunesNote.fr}</p>
    </FactBlock>
  );
}

/** A transcribed figure, linked to its page, with the exact wording as a tooltip. */
function Fig({ f, url }: { f: OctroiFigure | undefined; url: string | null }) {
  if (!f) return <>—</>;
  const v = f.unit === "%" ? `${num.format(f.value)} %` : num.format(f.value);
  return (
    <span title={`« ${f.quote} »`}>
      <strong>{v}</strong>{" "}
      <span className="text-xs text-slate-500">
        ({url
          ? <a href={`${url}#page=${f.page}`} className="underline" target="_blank" rel="noopener noreferrer">p. {f.page}</a>
          : `p. ${f.page}`})
      </span>
    </span>
  );
}

/** The split rule (25-198-2) and the octroi de mer régional rate (24-300-2), each figure linked to its page; then all acts. */
export function OctroiDecisions({ rule, omr, ruleUrl, omrUrl, groups, sources }: {
  rule: Map<string, OctroiFigure>; omr: Map<string, OctroiFigure>; ruleUrl: string | null; omrUrl: string | null;
  groups: { kind: OctroiKind; acts: Act[] }[]; sources: Source[];
}) {
  const v = (m: Map<string, OctroiFigure>, k: string) => {
    const f = m.get(k);
    return f ? (f.unit === "année" ? String(f.value) : num.format(f.value)) : "—";
  };
  const n = groups.reduce((s, g) => s + g.acts.length, 0);
  return (
    <FactBlock title={ctm.octroiDecisionsTitle.fr} sources={sources} year="2023-2026">
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {rule.size > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="font-semibold">{ctm.octroiRuleTitle.fr.replace("{year}", v(rule, "entree_en_vigueur"))}</p>
            <p className="text-xs text-slate-500">{ctm.caDeliberation.fr.replace("{n}", "25-198-2")}</p>
            <ul className="mt-2 space-y-1">
              {["part_population", "part_egale", "part_potentiel_fiscal"].map((k) => (
                <li key={k}><Fig f={rule.get(k)} url={ruleUrl} /> — {rule.get(k)?.label}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-600">
              {ctm.octroiRuleVote.fr.replace("{pour}", v(rule, "votes_pour")).replace("{contre}", v(rule, "votes_contre"))
                .replace("{abst}", v(rule, "abstentions"))}
            </p>
          </div>
        )}
        {omr.size > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="font-semibold">{ctm.octroiOmrTitle.fr}</p>
            <p className="text-xs text-slate-500">{ctm.caDeliberation.fr.replace("{n}", "24-300-2")}</p>
            <p className="mt-2"><Fig f={omr.get("omr_taux_normal")} url={omrUrl} /></p>
            <p className="mt-1">
              {ctm.octroiOmrText.fr.replace("{from}", v(omr, "omr_taux_normal_avant")).replace("{to}", v(omr, "omr_taux_normal"))}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              {ctm.octroiOmrVote.fr.replace("{pour}", v(omr, "votes_pour")).replace("{contre}", v(omr, "votes_contre"))
                .replace("{npp}", v(omr, "ne_prend_pas_part"))}
            </p>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">{ctm.octroiQuoteNote.fr}</p>
      <h3 className="mt-4 text-sm font-semibold">{ctm.octroiActsTitle.fr.replace("{n}", String(n))}</h3>
      {groups.map((g) => (
        <details key={g.kind} className="mt-2 rounded-lg border border-slate-200 bg-white p-3" open={g.kind === "repartition"}>
          <summary className="cursor-pointer text-sm font-semibold">{KIND_LABEL[g.kind]} ({g.acts.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {g.acts.map((a) => (
              <li key={a.id}>
                <a href={a.page_url} className="underline" target="_blank" rel="noopener noreferrer">{a.number}</a> — {a.title}
              </li>
            ))}
          </ul>
        </details>
      ))}
      <p className="mt-2 text-xs text-slate-500">{ctm.octroiActsNote.fr}</p>
    </FactBlock>
  );
}
