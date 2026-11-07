import type { Metadata } from "next";
import { getSources } from "@/lib/core/data";
import { PROVISIONAL_YEARS, REFERENCE_YEAR } from "@/lib/communes/config";
import { date } from "@/lib/core/format";
import { common, communes } from "@/i18n";

export const metadata: Metadata = { title: "Méthodologie" };

// First version: principles, caveats and the list of sources. Definitions per metric come next (Phase 4).
export default async function Methodologie() {
  const sources = [...(await getSources()).values()].sort((a, b) => a.id.localeCompare(b.id));
  return (
    <article className="prose-sm space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{common.methodology.fr}</h1>
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
          <li>{communes.caveatEpci.fr}</li>
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
        <h2 className="text-lg font-semibold">Collectivité Territoriale de Martinique (CTM)</h2>
        <ul className="list-disc space-y-1 pl-5 text-slate-700">
          <li>
            Comptes : OFGL, comptes consolidés des régions (la CTM y figure depuis 2016), et balances comptables de la DGFiP.
            Avant 2016, la Région et le Département sont présentés côte à côte, jamais additionnés : 2012-2015 d&apos;après
            l&apos;OFGL, 2008-2011 d&apos;après les comptes individuels de la DGFiP (budget principal seulement).
          </li>
          <li>
            Contrôle de cohérence : chaque agrégat de l&apos;OFGL est recalculé à partir des comptes de la DGFiP, et les montants
            sont comparés au rapport de la Chambre régionale des comptes (2026). Tolérance : 1 %, ou 50 000 € pour les petits
            montants. Le texte de ce rapport (p. 56) donne une dette 2021 différente de son propre tableau en annexe (p. 80) ;
            la fiche affiche les montants de l&apos;annexe, identiques à l&apos;OFGL, et le signale.
          </li>
          <li>
            « Fiscalité spécifique ultramarine » = compte 734 de la nomenclature M57 (ce que la Chambre régionale des comptes
            appelle « produits liés à l&apos;octroi de mer »). « Octroi de mer » désigne uniquement l&apos;octroi de mer régional
            (compte 73432). Série à partir de 2018 : la nomenclature M57 a été renumérotée cette année-là.
          </li>
          <li>
            Élus : l&apos;Assemblée d&apos;après le Répertoire national des élus (RNE). Le RNE ne liste qu&apos;une partie du Conseil
            exécutif ; les autres membres viennent des déclarations publiées par la HATVP et restent marqués « non vérifié »
            jusqu&apos;à l&apos;archivage de la délibération d&apos;élection.
          </li>
          <li>
            Listes électorales : résultats officiels du ministère de l&apos;Intérieur. Pour 2015, la liste de chaque élu est
            publiée ; pour 2021, elle est déduite des candidatures du 1er tour. Les groupes politiques de l&apos;Assemblée ne
            sont pas indiqués tant que la CTM ne publie pas les déclarations de groupe. Les listes sont présentées dans
            l&apos;ordre de leur numéro, jamais classées.
          </li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{common.sources.fr}</h2>
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
