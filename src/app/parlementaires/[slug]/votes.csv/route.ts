import { getSources } from "@/lib/core/data";
import { POSITION_FR, NO_VOTE } from "@/lib/parlement/activity";
import { toCsv } from "@/lib/parlement/csv";
import { getAllScrutins, getGroupLabels, getMember, getMembers, getVotes } from "@/lib/parlement/data";

// Every public vote of the member's term with their recorded position: the complete list, not curated (JM, 5 Nov 2026).
// AN: XVIIth legislature (AN open data). Sénat: every public vote since the term began (Dosleg, data.senat.fr).

export async function generateStaticParams() {
  return (await getMembers()).map((m) => ({ slug: m.slug }));
}

export async function GET(_req: Request, ctx: RouteContext<"/parlementaires/[slug]/votes.csv">) {
  const m = await getMember((await ctx.params).slug);
  if (!m) return new Response("Not found", { status: 404 });
  const an = m.chamber === "AN";
  const [scrutins, votes, groups, sources] = await Promise.all([
    getAllScrutins(m.chamber, m.start), getVotes(m.personId), getGroupLabels(), getSources()]);
  const mine = new Map(votes.map((v) => [v.scrutin_id, v]));
  const sorted = [...scrutins].sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number);
  const pos = (p: string | null | undefined) => (p ? POSITION_FR[p] ?? p : "");
  const name = `${m.firstName} ${m.lastName}`;
  const rule = "Colonne « règle » : parties de la règle V1 qui retiennent le scrutin sur la fiche (vide = non retenu).";
  if (an) {
    const rows = sorted.map((s) => {
      const v = mine.get(s.id);
      return [s.date, s.number, s.type_label, s.title, v ? pos(v.position) : NO_VOTE,
        v?.by_delegation ? "oui" : v ? "non" : "", v?.group_id ? groups.get(v.group_id) ?? v.group_id : "",
        pos(v?.group_position), v?.mise_au_point ? pos(v.mise_au_point.replace(/^dysfonctionnement:/, "")) : "",
        s.result_label, s.pour, s.contre, s.abstentions, s.selected_by.join(" "), s.url];
    });
    return csv(m.slug, toCsv(`Votes publics de la XVIIe législature — ${name}`,
      ["an-scrutins-17", "an-scrutins-17-liste"].map((id) => sources.get(id)).filter((s) => s != null),
      ["« Pas de vote enregistré » n'est pas une absence : la plupart des votes se font à main levée.", rule],
      ["date", "scrutin", "type", "titre", "position", "par délégation", "groupe", "position majoritaire du groupe",
       "mise au point", "résultat", "pour", "contre", "abstentions", "règle", "lien"], rows));
  }
  const rows = sorted.map((s) => {
    const v = mine.get(s.id);
    return [s.date, `${s.legislature}-${Number(s.legislature) + 1}`, s.number, s.title, v ? pos(v.position) : NO_VOTE,
      v?.cause ?? "", v?.by_delegation ? "oui" : v ? "non" : "", s.result_label, s.voters, s.pour, s.contre,
      s.abstentions, s.selected_by.join(" "), s.url];
  });
  return csv(m.slug, toCsv(`Scrutins publics du Sénat depuis le ${m.start} — ${name}`,
    ["senat-votes-972", "senat-scrutins"].map((id) => sources.get(id)).filter((s) => s != null),
    ["Au Sénat, un délégué de chaque groupe peut déposer les bulletins de tous ses membres : une position ne prouve pas la présence.",
     "Résultat : adopté quand les « pour » dépassent les « contre » (majorité absolue des suffrages exprimés). Abstentions = votants - suffrages exprimés.",
     "Scrutins dont la base Dosleg ne donne ni date ni objet : absents de ce fichier (voir « Données manquantes » sur la fiche).", rule],
    ["date", "session", "scrutin", "objet", "position", "statut publié", "par délégation", "résultat", "votants", "pour",
     "contre", "abstentions", "règle", "lien"], rows));
}

function csv(slug: string, body: string) {
  return new Response(body, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="votes-${slug}.csv"`,
  } });
}
