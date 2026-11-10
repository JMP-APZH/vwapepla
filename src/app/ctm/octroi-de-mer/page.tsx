import type { Metadata } from "next";
import Link from "next/link";
import { CardHeader, CardShell, Caveat, MissingInfo, RightOfReply } from "@/components/card/Card";
import { Portrait } from "@/components/card/Portrait";
import { OctroiCommunes, OctroiDecisions, OctroiTotals } from "@/components/ctm/Octroi";
import { getSources } from "@/lib/core/data";
import { meur } from "@/lib/core/format";
import { CTM } from "@/lib/ctm/budget";
import { getActuals, getOctroi } from "@/lib/ctm/data";
import { actsByKind, communeRows, figuresOf, FROM_YEAR, totalsByYear, type OctroiFigure } from "@/lib/ctm/octroi";
import { text } from "@/lib/ctm/textes";
import { ctm } from "@/i18n";

export const metadata: Metadata = { title: ctm.octroiTitle.fr };

const REFERENCE_YEAR = 2024; // last final year (2025 provisional), as on the commune cards

// Octroi de mer: what the Assemblée decides (rates, exemptions, split between communes) and what the communes and the CTM
// receive, side by side, never summed (B3-MAPPING §I). The communes' rows are team B1's data, read-only.
export default async function OctroiPage() {
  const [octroi, actuals, sources] = await Promise.all([getOctroi(), getActuals(), getSources()]);
  const totals = totalsByYear(octroi.rows, actuals);
  const range = totals.length ? `${totals[0].year}-${totals.at(-1)!.year}` : "";
  const ref = totals.find((t) => t.year === REFERENCE_YEAR);
  const src = (ids: string[]) => [...new Set(ids)].map((id) => sources.get(id)).filter((s) => s != null);
  const comSources = (years: number[]) => octroi.rows.filter((r) => years.includes(r.year)).map((r) => r.source_id);
  const ctmSources = actuals
    .filter((a) => a.entity_siren === CTM && a.metric_key === "fum_octroi_de_mer" && a.year >= FROM_YEAR)
    .map((a) => a.source_id);
  const rule = figuresOf(octroi.figures, "25-198-2"), omr = figuresOf(octroi.figures, "24-300-2");
  const url = (m: Map<string, OctroiFigure>) => sources.get([...m.values()][0]?.source_id ?? "")?.url ?? null;
  const law = text("loi-2004-639");

  return (
    <CardShell
      header={
        <CardHeader
          portrait={<Portrait name="Octroi de mer" removalSubject="Octroi de mer — Collectivité Territoriale de Martinique" />}
          title={ctm.octroiTitle.fr}
          facts={[
            { label: <>{ctm.octroiColCommunes.fr} {REFERENCE_YEAR}</>, value: meur(ref?.communes) },
            { label: <>{ctm.octroiColCtm.fr} {REFERENCE_YEAR}</>, value: meur(ref?.ctm) },
          ]}
          note={
            <>
              {ctm.octroiIntro.fr}
              {law && <> (<a href={law.url} className="underline" target="_blank" rel="noopener noreferrer">{ctm.octroiLawLink.fr}</a>)</>}{" "}
              <Link href="/ctm" className="underline">← {ctm.cardTitle.fr}</Link>
            </>
          }
        />
      }
      caveats={<Caveat>{ctm.octroiCaveat.fr}</Caveat>}
      rightOfReply={<RightOfReply text={ctm.rightOfReplyCtm.fr} subject="Droit de réponse — octroi de mer, Collectivité Territoriale de Martinique" />}
    >
      <MissingInfo items={[ctm.octroiMissingFrde.fr, ctm.octroiMissingCustoms.fr, ctm.octroiMissingDgg.fr, ctm.octroiMissingBefore.fr]} />
      <OctroiTotals rows={totals} range={range} sources={src([...comSources(totals.map((t) => t.year)), ...ctmSources])} />
      <OctroiCommunes year={REFERENCE_YEAR} rows={communeRows(octroi.rows, octroi.communes, REFERENCE_YEAR)}
                      sources={src(comSources([REFERENCE_YEAR]))} />
      <OctroiDecisions rule={rule} omr={omr} ruleUrl={url(rule)} omrUrl={url(omr)}
                       groups={actsByKind(octroi.kinds, octroi.acts)}
                       sources={src([...octroi.figures.map((f) => f.source_id), ...octroi.acts.map((a) => a.source_id)])} />
    </CardShell>
  );
}
