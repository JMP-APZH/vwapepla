import Link from "next/link";
import { getCommunes, getCommuneYears } from "@/lib/data";
import { REFERENCE_YEAR } from "@/lib/config";
import { int } from "@/lib/format";
import { t } from "@/i18n/strings";

export default async function Home() {
  const [communes, years] = await Promise.all([getCommunes(), getCommuneYears(REFERENCE_YEAR)]);
  const pop = new Map(years.map((y) => [y.commune_code, y.population]));
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t.homeTitle.fr}</h1>
      <p className="mt-2 text-slate-600">{t.homeIntro.fr}</p>
      <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {communes.map((c) => (
          <li key={c.code}>
            <Link
              href={`/commune/${c.slug}`}
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
