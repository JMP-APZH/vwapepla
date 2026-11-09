import { getSources } from "@/lib/core/data";
import { POSITION_FR, NO_VOTE } from "@/lib/parlement/activity";
import { toCsv } from "@/lib/parlement/csv";
import { getAllScrutins, getGroupLabels, getPeople, getPerson, getVotes } from "@/lib/parlement/data";
import { termPeriod } from "@/lib/parlement/members";

// Every public vote of each of the member's loaded mandates with their recorded position: the complete list, not curated
// (JM, 5 Nov 2026). AN: every public vote held during each mandate (AN open data). Sénat: same, from Dosleg.

export async function generateStaticParams() {
  return (await getPeople()).map((p) => ({ slug: p.slug }));
}

export async function GET(_req: Request, ctx: RouteContext<"/parlementaires/[slug]/votes.csv">) {
  const p = await getPerson((await ctx.params).slug);
  if (!p) return new Response("Not found", { status: 404 });
  const terms = [...p.terms].reverse(); // oldest first, like the rows
  const an = terms[0].chamber === "AN";
  const [perTerm, votes, groups, sources] = await Promise.all([
    Promise.all(terms.map((t) => getAllScrutins(t))), getVotes(p.personId), getGroupLabels(), getSources()]);
  const mine = new Map(votes.map((v) => [v.scrutin_id, v]));
  const pos = (x: string | null | undefined) => (x ? POSITION_FR[x] ?? x : "");
  const name = `${p.firstName} ${p.lastName}`;
  const rule = "Colonne « règle » : parties de la règle V1 qui retiennent le scrutin sur la fiche (vide = non retenu).";
  const rows = terms.flatMap((t, i) => [...perTerm[i]].sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number)
    .map((s) => {
      const v = mine.get(s.id);
      return an
        ? [termPeriod(t), s.date, s.number, s.type_label, s.title, v ? pos(v.position) : NO_VOTE,
           v?.by_delegation ? "oui" : v ? "non" : "", v?.group_id ? groups.get(v.group_id) ?? v.group_id : "",
           pos(v?.group_position), v?.mise_au_point ? pos(v.mise_au_point.replace(/^dysfonctionnement:/, "")) : "",
           s.result_label, s.pour, s.contre, s.abstentions, s.selected_by.join(" "), s.url]
        : [termPeriod(t), s.date, `${s.legislature}-${Number(s.legislature) + 1}`, s.number, s.title,
           v ? pos(v.position) : NO_VOTE, v?.cause ?? "", v?.by_delegation ? "oui" : v ? "non" : "", s.result_label,
           s.voters, s.pour, s.contre, s.abstentions, s.selected_by.join(" "), s.url];
    }));
  const body = an
    ? toCsv(`Scrutins publics de l'Assemblée pendant ses mandats — ${name}`,
        terms.flatMap((t) => [`an-scrutins-${t.legislature}`, `an-scrutins-${t.legislature}-liste`])
          .map((id) => sources.get(id)).filter((s) => s != null),
        ["« Pas de vote enregistré » n'est pas une absence : la plupart des votes se font à main levée.",
         "Législatures XIV et XV : les scrutins ne sont pas rattachés à leur dossier législatif dans les données de l'Assemblée.", rule],
        ["mandat", "date", "scrutin", "type", "titre", "position", "par délégation", "groupe", "position majoritaire du groupe",
         "mise au point", "résultat", "pour", "contre", "abstentions", "règle", "lien"], rows)
    : toCsv(`Scrutins publics du Sénat pendant ses mandats — ${name}`,
        ["senat-votes-972", "senat-scrutins"].map((id) => sources.get(id)).filter((s) => s != null),
        ["Au Sénat, un délégué de chaque groupe peut déposer les bulletins de tous ses membres : une position ne prouve pas la présence.",
         "Résultat : adopté quand les « pour » dépassent les « contre » (majorité absolue des suffrages exprimés). Abstentions = votants - suffrages exprimés.",
         "Scrutins dont la base Dosleg ne donne ni date ni objet : absents de ce fichier (voir « Données manquantes » sur la fiche).", rule],
        ["mandat", "date", "session", "scrutin", "objet", "position", "statut publié", "par délégation", "résultat", "votants",
         "pour", "contre", "abstentions", "règle", "lien"], rows);
  return new Response(body, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="votes-${p.slug}.csv"`,
  } });
}
