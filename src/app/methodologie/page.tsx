import type { Metadata } from "next";
import Link from "next/link";
import { getSources } from "@/lib/core/data";
import { PROVISIONAL_YEARS, REFERENCE_YEAR } from "@/lib/communes/config";
import { CONTACT_EMAIL } from "@/lib/core/config";
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
            Les chiffres sont aussi comparés aux comptes administratifs votés par l&apos;Assemblée (2022-2025, budget principal) :
            mêmes montants que la DGFiP, l&apos;écart avec l&apos;OFGL venant de montants comptés bruts par le compte administratif.
          </li>
          <li>
            Prévisionnel : les budgets primitifs votés par l&apos;Assemblée (2024-2026, budget principal) sont lus page par page
            et affichés à part, marqués « Prévisionnel », à côté du compte administratif (réalisé) mais jamais sur la même
            série ; les budgets supplémentaires, décisions modificatives et rapports d&apos;orientations budgétaires sont liés.
          </li>
          <li>
            « Fiscalité spécifique ultramarine » = compte 734 de la nomenclature M57 (ce que la Chambre régionale des comptes
            appelle « produits liés à l&apos;octroi de mer »). « Octroi de mer » désigne uniquement l&apos;octroi de mer régional
            (compte 73432). Pour 2016-2017, avant la renumérotation de la nomenclature M57 en 2018, chaque ligne est rattachée
            à l&apos;ancien compte de même libellé (octroi de mer régional = compte 7374 « Taxe additionnelle à l&apos;octroi de mer »).
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
        <h2 className="text-lg font-semibold">Députés et sénateurs</h2>
        <p className="text-slate-700">
          Données ouvertes de l&apos;Assemblée nationale (depuis la XIVe législature, juin 2012) et du Sénat (depuis le
          renouvellement d&apos;octobre 2011). La règle de choix des votes présentés sur les fiches, les données que les
          sources officielles ne publient pas et la façon dont elles sont signalées sont décrites sur la page{" "}
          <Link href="/parlementaires/methode" className="underline">méthode des fiches parlementaires</Link>.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Données personnelles</h2>
        <ul className="list-disc space-y-1 pl-5 text-slate-700">
          <li>
            Vwapepla informe le public sur l&apos;exercice de fonctions publiques : élus (maires et conseils municipaux,
            parlementaires, CTM) et responsables nommés de l&apos;État (préfet, sous-préfets, secrétaire général, directeur
            de cabinet). Base légale : traitement à des fins journalistiques et d&apos;information du public (article 85 du
            RGPD, article 80 de la loi Informatique et libertés).
          </li>
          <li>
            Ce qui est publié : nom, fonction et dates, tels qu&apos;ils figurent dans les sources officielles (Journal
            officiel, Répertoire national des élus, résultats électoraux, déclarations publiées par la HATVP) ; le parcours
            dans les fonctions publiques, d&apos;après les décrets de nomination ; le lieu de naissance seulement quand une
            biographie officielle l&apos;indique ; une photo officielle, toujours créditée à sa source.
          </li>
          <li>
            Ce qui n&apos;est jamais publié : la date de naissance, la vie privée, l&apos;origine ou l&apos;appartenance
            ethnique, ni aucune information déduite d&apos;une photo. Une fiche décrit une fonction, jamais la valeur
            d&apos;une personne : pas de note, pas de classement.
          </li>
          <li>
            Avis des visiteurs : aucune adresse IP n&apos;est conservée. Un identifiant anonyme, calculé avec une clé secrète
            qui change chaque mois, sert seulement à limiter les votes à un par sujet et par mois ; il est effacé après 60
            jours. Le vote est protégé contre les robots par Cloudflare Turnstile.
          </li>
          <li>
            Rectification, droit de réponse ou retrait d&apos;une photo : écrivez à{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>, ou utilisez le lien « Droit de
            réponse » de chaque fiche. Une erreur avérée est corrigée dans le script d&apos;import, pour ne pas revenir à la
            mise à jour suivante.
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
