import { getSources } from "@/lib/core/data";
import { toCsv } from "@/lib/parlement/csv";
import { getAmendments, getMember, getMembers } from "@/lib/parlement/data";

// Amendments co-signed by the member during the current term: listed, never totalled on the card (charter §3.3).

export async function generateStaticParams() {
  return (await getMembers()).map((m) => ({ slug: m.slug }));
}

export async function GET(_req: Request, ctx: RouteContext<"/parlementaires/[slug]/cosignatures.csv">) {
  const m = await getMember((await ctx.params).slug);
  if (!m) return new Response("Not found", { status: 404 });
  const [rows, sources] = await Promise.all([getAmendments(m.personId, "cosignataire"), getSources()]);
  const sorted = [...rows].sort((a, b) => (a.filed ?? "").localeCompare(b.filed ?? "") || a.id.localeCompare(b.id));
  const body = toCsv(`Amendements cosignés — ${m.firstName} ${m.lastName} (mandat en cours)`,
    [m.chamber === "AN" ? "an-amendements-17" : "senat-amendements-972"].map((id) => sources.get(id)).filter((s) => s != null),
    ["Un groupe dépose souvent ses amendements au nom de tous ses membres : la cosignature ne mesure pas un travail personnel."],
    ["date de dépôt", "numéro", "texte", "article", "nombre de signataires", "issue", "lien"],
    sorted.map((a) => [a.filed, a.number, a.text_title ?? (a.text_number ? `Texte n° ${a.text_number}` : ""), a.article,
      a.signatories, a.outcome ?? "sans issue publiée", a.url]));
  return new Response(body, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="amendements-cosignes-${m.slug}.csv"`,
  } });
}
