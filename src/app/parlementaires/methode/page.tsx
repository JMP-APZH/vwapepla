import type { Metadata } from "next";
import Link from "next/link";
import { DataGapsBlock } from "@/components/parlement/DataGaps";
import { getSources } from "@/lib/core/data";
import { getDataGaps } from "@/lib/parlement/data";
import { parlement } from "@/i18n";

export const metadata: Metadata = { title: parlement.methodTitle.fr };

// Same list as scripts/parlement/votes.py (OVERSEAS): the rule applied by the build, published here word for word.
const OVERSEAS = ["outre-mer", "ultramarin", "Martinique", "Antilles", "Guadeloupe", "Guyane", "La Réunion", "Mayotte",
  "octroi de mer", "DROM", "collectivités territoriales de Guyane et de Martinique"];

export default async function MethodPage() {
  const [gaps, sources] = await Promise.all([getDataGaps(), getSources()]);
  return (
    <article className="max-w-none space-y-4 text-sm">
      <h1 className="text-3xl font-semibold tracking-tight">{parlement.methodTitle.fr}</h1>
      <p>{parlement.methodIntro.fr}</p>

      <h2 className="text-xl font-semibold">Ce que montrent les fiches</h2>
      <ul className="list-disc pl-5">
        <li>Le mandat en cours : XVIIe législature (depuis juillet 2024) pour les députés, mandat commencé le 2 octobre 2023 pour les sénateurs.</li>
        <li>Les mandats précédents depuis 2012 : XIVe, XVe et XVIe législatures pour les députés (anciens députés compris), mandats sénatoriaux en cours au renouvellement d&apos;octobre 2011 pour les sénateurs. Chaque mandat a son résumé (votes retenus par la même règle, amendements, questions), sans comparaison entre mandats : le nombre de scrutins publics et les données publiées changent d&apos;une législature à l&apos;autre.</li>
        <li>Les groupes, commissions et fonctions, avec les intitulés et les dates publiés par l&apos;Assemblée nationale et le Sénat. Aucune étiquette politique ajoutée par nous.</li>
        <li>Des chiffres d&apos;activité, toujours accompagnés d&apos;un avertissement : ils ne mesurent pas tout le travail parlementaire (commission, rapports, auditions, circonscription).</li>
        <li>Aucun score, aucun classement, aucun taux de présence, aucune comparaison entre parlementaires.</li>
      </ul>

      <h2 className="text-xl font-semibold">Votes : règle V1 (version du 5 novembre 2026)</h2>
      <p>Les votes affichés sur la fiche d&apos;un parlementaire sont choisis automatiquement par cette règle, jamais à la main. Un scrutin public est retenu s&apos;il remplit au moins une condition :</p>
      <ol className="list-[lower-alpha] pl-5">
        <li>c&apos;est un scrutin public solennel ;</li>
        <li>il porte sur l&apos;ensemble d&apos;un texte (« l&apos;ensemble du projet de loi / de la proposition de loi / du texte ») ;</li>
        <li>son objet, ou le titre du dossier législatif, contient l&apos;un de ces mots : {OVERSEAS.map((k) => `« ${k} »`).join(", ")} ;</li>
        <li>c&apos;est une motion de censure.</li>
      </ol>
      <p>Non appliqué à ce jour : « dossier examiné par la Délégation aux outre-mer », car les fichiers de dossiers publiés ne disent pas quelle délégation les a examinés.</p>
      <p>Tous les scrutins publics de la législature restent téléchargeables depuis chaque fiche (liste complète, non filtrée). Toute modification de la règle sera une nouvelle version, datée et annoncée ici.</p>
      <p>« Pas de vote enregistré » n&apos;est pas une absence : la plupart des votes se font à main levée et ne sont pas nominatifs.</p>
      <p>Sénat : la même règle s&apos;applique aux scrutins publics de la base Dosleg du Sénat (data.senat.fr), qui donne la position de chaque sénateur depuis la session 2006-2007. Les parties (b) et (c) s&apos;appliquent à l&apos;objet du scrutin et au titre du dossier législatif. La partie (a) ne peut pas s&apos;appliquer, car Dosleg ne signale pas les scrutins solennels, et la partie (d) non plus, car la motion de censure n&apos;existe qu&apos;à l&apos;Assemblée. Le résultat est « adopté » quand les « pour » dépassent les « contre » (majorité absolue des suffrages exprimés), comme sur senat.fr ; les abstentions sont les votants moins les suffrages exprimés. Au Sénat, un délégué de chaque groupe peut déposer les bulletins de tous les membres du groupe : une position publiée ne prouve pas la présence en séance.</p>

      <h2 className="text-xl font-semibold">Amendements et questions</h2>
      <p>Seuls les amendements déposés comme premier signataire sont comptés, par issue publiée (adopté, rejeté, retiré, tombé…). Les amendements cosignés sont téléchargeables mais ne sont pas totalisés : un groupe dépose souvent ses amendements au nom de tous ses membres. Au Sénat, le premier signataire est le premier nom publié sur l&apos;amendement.</p>

      <h2 className="text-xl font-semibold">Déclarations à la HATVP</h2>
      <p>Toutes les déclarations publiées sont listées avec leurs dates et un lien vers hatvp.fr. Les activités et intérêts déclarés sont recopiés tels quels depuis la déclaration d&apos;intérêts la plus récente, rubriques concernant le parlementaire lui-même seulement (pas celles sur le conjoint ou les collaborateurs). Les déclarations de situation patrimoniale ne sont jamais reproduites.</p>

      <h2 className="text-xl font-semibold">Disponibilité des données</h2>
      <p>Pour juger le travail d&apos;un élu, il faut d&apos;abord savoir ce qui est publié. Chaque manque ci-dessous est mesuré par le programme d&apos;import sur les fichiers officiels, daté, et repris sur les fiches concernées. Un manque peut venir de la source (donnée jamais publiée, incomplète ou incohérente) ou de Vwapepla (donnée publiée mais pas encore chargée) : le texte le précise.</p>
      <DataGapsBlock gaps={gaps} sources={sources} intro={false} />

      <h2 className="text-xl font-semibold">Sources</h2>
      <p>Assemblée nationale (data.assemblee-nationale.fr), Sénat (data.senat.fr : sénateurs, Dosleg, Ameli, Questions), ministère de l&apos;Intérieur (Répertoire national des élus ; candidatures aux élections législatives de 2024, pour les suppléants), HATVP. Licence Ouverte 2.0. Chaque bloc indique sa source et la date de récupération des données. Droit de réponse : un lien figure sur chaque fiche.</p>

      <p><Link href="/parlementaires" className="underline">{parlement.backToList.fr}</Link></p>
    </article>
  );
}
