import Link from "next/link";
import { Caveat, FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import { currentHolder, postLabel, SEAT_ORDER, seatTimeline, type Posting, type SeatKey } from "@/lib/prefet/postings";
import { prefet } from "@/i18n";

const SEAT_TITLE: Record<SeatKey, string> = {
  prefet: "Préfet de la région Martinique", secretaire_general: "Secrétaire général de la préfecture",
  directeur_cabinet: "Directeur de cabinet du préfet", "sous_prefet-2": "Sous-préfet de La Trinité",
  "sous_prefet-4": "Sous-préfet de Saint-Pierre", "sous_prefet-3": "Sous-préfet du Marin",
  charge_mission: "Sous-préfet chargé de mission",
};

function Period({ p }: { p: Posting }) {
  return <>{p.end ? `${date(p.start)} – ${date(p.end)}` : `${prefet.since.fr} ${date(p.start)}`}</>;
}

/** Who holds the seven posts today, then every posting found per post since 2007 (each linked to its own card). */
export function PostingsOverview({ postings, sources, today }: { postings: Posting[]; sources: Source[]; today: string }) {
  return (
    <FactBlock title={prefet.postings.fr} sources={sources} year={`2007–${today.slice(0, 4)}`}>
      <p className="mt-1 text-sm text-slate-600">{prefet.postingsIntro.fr}</p>
      <h3 className="mt-4 text-sm font-semibold">{prefet.postingsNow.fr}</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {SEAT_ORDER.map((seat) => {
          const p = currentHolder(postings, seat);
          return (
            <li key={seat} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <p className="text-xs text-slate-500">{SEAT_TITLE[seat]}</p>
              {p ? (
                <>
                  <Link href={`/prefet/${p.slug}`} className="font-medium underline">{p.firstName} {p.lastName}</Link>
                  <p className="text-xs text-slate-600"><Period p={p} /> · <a href={p.sourceUrl ?? undefined} className="underline" target="_blank" rel="noopener noreferrer">{prefet.decree.fr}</a></p>
                </>
              ) : <p className="italic text-slate-600">{prefet.noDecreeFound.fr}</p>}
            </li>
          );
        })}
      </ul>

      <h3 className="mt-5 text-sm font-semibold">{prefet.postingsHistory.fr}</h3>
      <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {SEAT_ORDER.map((seat) => {
          const t = seatTimeline(postings, seat);
          return (
            <details key={seat} className="px-3 py-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm">
                <span className="font-medium">{SEAT_TITLE[seat]}</span>
                <span className="shrink-0 text-slate-600">{t.length}</span>
              </summary>
              <ol className="space-y-1.5 pb-2 text-sm">
                {t.map((p) => (
                  <li key={p.slug} className="flex flex-wrap justify-between gap-x-3">
                    <Link href={`/prefet/${p.slug}`} className="underline">{p.firstName} {p.lastName}</Link>
                    <span className="text-xs text-slate-600">
                      {p.seats.length > 1 && <>{postLabel(p.seats, p.sex)} · </>}<Period p={p} />
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          );
        })}
      </div>
      <div className="mt-4"><Caveat>{prefet.postingsCaveat.fr}</Caveat></div>
    </FactBlock>
  );
}
