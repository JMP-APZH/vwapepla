import Image from "next/image";
import { mediaUrl, type Media, type Officeholder, type Source } from "@/lib/data";
import { date } from "@/lib/format";

function fn(o: Officeholder) {
  if (o.role === "maire") return "Maire";
  if (o.role === "adjoint") return `${o.rank === 1 ? "1er" : `${o.rank}e`} adjoint·e`;
  return null;
}

/** Whole municipal council as published in the RNE. Neutral: no list affiliation, no wording about responsibility. */
export function CouncilList({ council, photo, source }: { council: Officeholder[]; photo?: Media; source?: Source }) {
  const executive = council.filter((o) => o.role !== "conseiller");
  const others = council.filter((o) => o.role === "conseiller");
  const elected = council[0]?.mandate_start;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Conseil municipal</h2>
      <p className="text-sm text-slate-600">
        {council.length} élu·e·s{elected && `, mandat commencé le ${date(elected)}`}.
      </p>
      {photo && (
        <figure className="mt-3">
          <Image src={mediaUrl(photo)} alt="Photo officielle du conseil municipal" width={640} height={360}
                 className="w-full rounded-lg object-cover" />
          <figcaption className="mt-1 text-[11px] text-slate-500">
            <a href={photo.source_page_url} className="underline" target="_blank" rel="noopener noreferrer">{photo.credit}</a>
          </figcaption>
        </figure>
      )}
      <ul className="mt-3 divide-y divide-slate-100 text-sm">
        {executive.map((o) => (
          <li key={`${o.last_name}-${o.first_name}`} className="flex justify-between gap-3 py-1.5">
            <span>{o.first_name} {o.last_name}</span>
            <span className="text-slate-500">{fn(o)}</span>
          </li>
        ))}
      </ul>
      {others.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer py-1 text-slate-700 underline">Voir les {others.length} conseiller·e·s municipaux</summary>
          <ul className="mt-1 columns-1 gap-4 sm:columns-2">
            {others.map((o) => (
              <li key={`${o.last_name}-${o.first_name}`} className="py-0.5">{o.first_name} {o.last_name}</li>
            ))}
          </ul>
        </details>
      )}
      {source && (
        <p className="mt-3 text-xs text-slate-500">
          {source.credit} — {source.title}, données récupérées le {date(source.retrieved)}.
        </p>
      )}
    </section>
  );
}
