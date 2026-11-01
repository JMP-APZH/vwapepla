import type { Metadata } from "next";
import { getSources, type Source } from "@/lib/data";
import { date } from "@/lib/format";

export const metadata: Metadata = { title: "Sources" };

// Every dataset behind the site, as recorded in data/raw/manifest.json by scripts/download_sources.py.
const GROUPS: { title: string; match: (s: Source) => boolean }[] = [
  { title: "Comptes des communes", match: (s) => /^ofgl-base-communes|^balances-comptables|^actifs_communes|^disponibilite/.test(s.id) },
  { title: "Élus", match: (s) => /^rne-|historique-maires/.test(s.id) },
  { title: "Élections municipales", match: (s) => /^municipales-/.test(s.id) },
  { title: "Intercommunalités, syndicats, CCAS et autres organismes", match: (s) => /^ofgl-base-|flux-financiers|compositions_intercommunales/.test(s.id) },
  { title: "Dotations, fiscalité et populations", match: (s) => /dotations|fiscal|^rei$|populations/.test(s.id) },
  { title: "Méthodologie et nomenclatures", match: () => true },
];

export default async function SourcesPage() {
  const all = [...(await getSources()).values()].sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id, "fr"));
  const seen = new Set<string>();
  const groups = GROUPS.map((g) => {
    const items = all.filter((s) => !seen.has(s.id) && g.match(s));
    items.forEach((s) => seen.add(s.id));
    return { ...g, items };
  }).filter((g) => g.items.length);

  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
        <p className="mt-2 text-slate-600">
          Tous les jeux de données utilisés, téléchargés par script depuis les sites officiels, sans saisie à la main.
          Chaque chiffre du site renvoie à l&apos;un d&apos;eux.
        </p>
      </header>
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="text-lg font-semibold">{g.title}</h2>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {g.items.map((s) => (
              <li key={s.id} className="p-3">
                <a href={s.dataset_page ?? s.url} className="font-medium underline" target="_blank" rel="noopener noreferrer">
                  {s.title ?? s.id}
                </a>
                <p className="mt-0.5 text-xs text-slate-500">
                  {s.credit} · {s.licence} · récupéré le {date(s.retrieved)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
