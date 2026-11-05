import { getSources } from "@/lib/core/data";
import { POSITION_FR, NO_VOTE } from "@/lib/parlement/activity";
import { toCsv } from "@/lib/parlement/csv";
import { getAllScrutins, getGroupLabels, getMember, getMembers, getVotes } from "@/lib/parlement/data";

// Every public vote of the XVIIth legislature with the deputy's recorded position: the complete list, not curated
// (JM, 5 Nov 2026). Senators: no official open data of nominative votes, so no file.

export async function generateStaticParams() {
  return (await getMembers()).filter((m) => m.chamber === "AN").map((m) => ({ slug: m.slug }));
}

export async function GET(_req: Request, ctx: RouteContext<"/parlementaires/[slug]/votes.csv">) {
  const m = await getMember((await ctx.params).slug);
  if (!m || m.chamber !== "AN") return new Response("Not found", { status: 404 });
  const [scrutins, votes, groups, sources] = await Promise.all([getAllScrutins(), getVotes(m.personId), getGroupLabels(), getSources()]);
  const mine = new Map(votes.map((v) => [v.scrutin_id, v]));
  const rows = scrutins.map((s) => {
    const v = mine.get(s.id);
    return [s.date, s.number, s.type_label, s.title, v ? POSITION_FR[v.position] ?? v.position : NO_VOTE,
      v?.by_delegation ? "oui" : v ? "non" : "", v?.group_id ? groups.get(v.group_id) ?? v.group_id : "",
      v?.group_position ? POSITION_FR[v.group_position] ?? v.group_position : "",
      v?.mise_au_point ? POSITION_FR[v.mise_au_point.replace(/^dysfonctionnement:/, "")] ?? v.mise_au_point : "",
      s.result_label, s.pour, s.contre, s.abstentions, s.selected_by.join(" "), s.url];
  });
  const body = toCsv(`Votes publics de la XVIIe législature — ${m.firstName} ${m.lastName}`,
    ["an-scrutins-17", "an-scrutins-17-liste"].map((id) => sources.get(id)).filter((s) => s != null),
    ["« Pas de vote enregistré » n'est pas une absence : la plupart des votes se font à main levée.",
     "Colonne « règle » : parties de la règle V1 qui retiennent le scrutin sur la fiche (vide = non retenu)."],
    ["date", "scrutin", "type", "titre", "position", "par délégation", "groupe", "position majoritaire du groupe",
     "mise au point", "résultat", "pour", "contre", "abstentions", "règle", "lien"], rows);
  return new Response(body, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="votes-${m.slug}.csv"`,
  } });
}
