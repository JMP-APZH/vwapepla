import type { Metadata } from "next";
import { getSources } from "@/lib/data";
import { PROVISIONAL_YEARS, REFERENCE_YEAR } from "@/lib/config";
import { date } from "@/lib/format";
import { t } from "@/i18n/strings";

export const metadata: Metadata = { title: "Méthodologie" };

// First version: principles, caveats and the list of sources. Definitions per metric come next (Phase 4).
export default async function Methodologie() {
  const sources = [...(await getSources()).values()].sort((a, b) => a.id.localeCompare(b.id));
  return (
    <article className="prose-sm space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.methodology.fr}</h1>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Nos principes</h2>
        <ul className="list-disc space-y-1 pl-5 text-slate-700">
          <li>Chaque chiffre renvoie à sa source officielle, avec l&apos;année et la date de récupération.</li>
          <li>Neutralité : pas de note globale ni de classement. Les chiffres sont présentés côte à côte.</li>
          <li>Comparaisons équitables : montants par habitant, médianes des communes de même taille.</li>
          <li>Les faits sont séparés des opinions. Chaque commune dispose d&apos;un droit de réponse.</li>
          <li>Les données sont importées par des scripts publics et reproductibles, jamais saisies à la main.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Précautions de lecture</h2>
        <ul className="list-disc space-y-1 pl-5 text-slate-700">
          <li>{t.caveatEpci.fr}</li>
          <li>
            Année de référence : {REFERENCE_YEAR}. Les comptes {PROVISIONAL_YEARS.join(", ")} sont provisoires jusqu&apos;à
            la publication des comptes définitifs par la DGFiP (fin décembre).
          </li>
          <li>Les chiffres portent sur le budget principal et les budgets annexes de chaque commune, consolidés (flux entre eux neutralisés), comme l&apos;Observatoire des communes de l&apos;AFD.</li>
          <li>Les communes sont passées de la nomenclature comptable M14 à la M57 en 2023-2024, ce qui peut créer de légères ruptures de séries.</li>
          <li>2026 est une année partagée entre l&apos;équipe sortante (janvier-mars) et la nouvelle équipe municipale.</li>
          <li>Rivière-Pilote affiche une dette nulle de 2013 à 2025 dans les données officielles ; ce point est en cours de vérification.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t.sources.fr}</h2>
        <ul className="space-y-1 text-sm text-slate-700">
          {sources.map((s) => (
            <li key={s.id}>
              <a href={s.dataset_page ?? s.url} className="underline" target="_blank" rel="noopener noreferrer">{s.id}</a>{" "}
              — {s.credit}, {s.licence}, récupéré le {date(s.retrieved)}.
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
