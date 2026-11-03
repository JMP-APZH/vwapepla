import type { Metadata } from "next";
import Link from "next/link";
import { getCommunes, getCommuneYears } from "@/lib/communes/data";
import { REFERENCE_YEAR } from "@/lib/communes/config";
import { int } from "@/lib/core/format";
import { communes } from "@/i18n";

export const metadata: Metadata = { title: "Les comptes des communes de Martinique" };

export default async function CommunesPage() {
  const [list, years] = await Promise.all([getCommunes(), getCommuneYears(REFERENCE_YEAR)]);
  const pop = new Map(years.map((y) => [y.commune_code, y.population]));
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{communes.homeTitle.fr}</h1>
      <p className="mt-2 text-slate-600">{communes.homeIntro.fr}</p>
      <p className="mt-2 text-sm">
        <Link href="/communes/comparer" className="underline">{communes.compare.fr} des communes →</Link>
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((c) => (
          <li key={c.code}>
            <Link
              href={`/communes/${c.slug}`}
              className="block rounded-lg border border-slate-200 bg-white px-3 py-3 hover:border-slate-400"
            >
              <span className="block font-medium">{c.name}</span>
              <span className="block text-xs text-slate-500">{int(pop.get(c.code))} hab.</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
