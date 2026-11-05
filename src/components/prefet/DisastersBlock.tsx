import Link from "next/link";
import { Caveat, FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import type { DisasterEvent } from "@/lib/prefet/disasters";
import { prefet } from "@/i18n";

/** Natural disaster recognitions decided by the State (interministerial decrees), events since the cut-off year. */
export function DisastersBlock({ events, perYear, communes, from, sources }: {
  events: DisasterEvent[]; perYear: { year: number; events: number }[];
  communes: Map<string, { name: string; slug: string }>; from: number; sources: Source[];
}) {
  const max = Math.max(...perYear.map((p) => p.events), 1);
  return (
    <FactBlock title={prefet.catnatTitle.fr} sources={sources} year={`${from}–`}>
      <p className="mt-1 text-sm text-slate-600">{prefet.catnatIntro.fr}</p>
      <ul className="mt-3 space-y-1">
        {perYear.map((p) => (
          <li key={p.year} className="grid grid-cols-[3rem_1fr_2rem] items-center gap-2 text-sm">
            <span className="font-medium">{p.year}</span>
            <div className="h-3 rounded bg-slate-100"><div className="h-3 rounded bg-sky-800" style={{ width: `${(p.events / max) * 100}%` }} /></div>
            <span className="text-right tabular-nums text-slate-600">{p.events}</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-5 text-sm font-semibold">{prefet.catnatList.fr}</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {events.map((e) => (
          <li key={e.key} className="rounded-lg bg-slate-50 p-2">
            <p><span className="font-medium">{e.risk}</span>{" · "}
              {e.start && (e.end && e.end !== e.start ? `${date(e.start)} – ${date(e.end)}` : date(e.start))}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {e.communes.map((c, i) => {
                const k = communes.get(c);
                return <span key={c}>{i > 0 && ", "}{k ? <Link href={`/communes/${k.slug}`} className="underline">{k.name}</Link> : c}</span>;
              })}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {prefet.catnatDecree.fr} {e.nor}{e.decree && <> {prefet.catnatOf.fr} {date(e.decree)}</>}
              {e.jo && <> · {prefet.catnatJo.fr} {date(e.jo)}</>}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-3"><Caveat>{prefet.catnatCaveat.fr}</Caveat></div>
    </FactBlock>
  );
}
