import type { Metadata } from "next";
import Link from "next/link";
import { Portrait } from "@/components/card/Portrait";
import { getMedia } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import { getMembers } from "@/lib/parlement/data";
import { seatLabel, type Member } from "@/lib/parlement/members";
import { parlement } from "@/i18n";

export const metadata: Metadata = { title: parlement.sectionTitle.fr };

// The 4 deputies by circonscription, then the 2 senators in alphabetical order: never sorted by any figure (charter §3.2).
export default async function ParlementairesPage() {
  const [members, anMedia, senMedia] = await Promise.all([getMembers(), getMedia("assemblee-nationale"), getMedia("senat")]);
  const photos = new Map([...anMedia, ...senMedia].filter((m) => m.person_id).map((m) => [m.person_id!, m]));
  const tile = (m: Member) => {
    const name = `${m.firstName} ${m.lastName}`;
    return (
      <li key={m.personId} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-4">
          <Portrait name={name} photo={photos.get(m.personId)} removalSubject={`${name} (${seatLabel(m)})`} />
          <div>
            <p className="text-lg font-semibold">{name}</p>
            <p className="text-sm text-slate-600">{seatLabel(m)}</p>
            <p className="text-xs text-slate-500">{parlement.mandateSince.fr} {date(m.start)}</p>
            <Link href={`/parlementaires/${m.slug}`} className="mt-1 inline-block text-sm underline">{parlement.openCard.fr}</Link>
          </div>
        </div>
      </li>
    );
  };
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{parlement.listTitle.fr}</h1>
        <p className="mt-2 text-slate-600">{parlement.listIntro.fr}</p>
      </header>
      <section>
        <h2 className="text-xl font-semibold">{parlement.deputies.fr}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">{members.filter((m) => m.chamber === "AN").map(tile)}</ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">{parlement.senators.fr}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">{members.filter((m) => m.chamber === "SEN").map(tile)}</ul>
      </section>
      <p className="text-sm"><Link href="/parlementaires/methode" className="underline">{parlement.methodTitle.fr}</Link></p>
    </div>
  );
}
