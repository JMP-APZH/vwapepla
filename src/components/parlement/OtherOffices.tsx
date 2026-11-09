import Link from "next/link";
import { FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import type { OtherOffice } from "@/lib/parlement/links";
import { fill } from "@/lib/parlement/text";
import { parlement } from "@/i18n";

/** Offices of the same person shown elsewhere on Vwapepla (mayor, CTM…). Only links reviewed by a person, each with
 *  the evidence that shows both offices (core person_links): never inferred from a name. */
export function OtherOfficesBlock({ offices, sources }: { offices: OtherOffice[]; sources: Source[] }) {
  if (offices.length === 0) return null;
  const evidence = [...new Map(offices.map((o) => [o.evidenceUrl + o.evidenceLabel, o])).values()];
  return (
    <FactBlock title={parlement.otherOfficesTitle.fr} sources={sources} year={parlement.otherOfficesPeriod.fr}>
      <p className="mt-1 text-sm text-slate-600">{parlement.otherOfficesIntro.fr}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {offices.map((o) => (
          <li key={`${o.label}:${o.place}:${o.start}`}>
            <span className="font-medium">{o.label}</span> · {o.place}
            <span className="text-slate-500"> · {o.end ? fill(parlement.termDates.fr, { from: date(o.start), to: date(o.end) })
              : fill(parlement.otherOfficesSince.fr, { from: date(o.start) })}</span>
            {o.href && <> · <Link href={o.href} className="underline">{parlement.otherOfficesSee.fr}</Link></>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        {parlement.otherOfficesEvidence.fr}{" "}
        {evidence.map((o, i) => (
          <span key={o.evidenceUrl + o.evidenceLabel}>
            {i > 0 && " ; "}
            <a href={o.evidenceUrl} className="underline" target="_blank" rel="noopener noreferrer">{o.evidenceLabel}</a>
          </span>
        ))}
        {" · "}{fill(parlement.otherOfficesChecked.fr, { who: evidence[0].verifiedBy, date: date(evidence[0].verifiedAt) })}
      </p>
    </FactBlock>
  );
}
