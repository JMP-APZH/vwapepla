import { getSources } from "@/lib/core/data";
import { toCsv } from "@/lib/parlement/csv";
import { amendmentsNotLoaded } from "@/lib/parlement/activity";
import { getAmendments, getDataGaps, getPeople, getPerson } from "@/lib/parlement/data";
import { inTermRow, termPeriod } from "@/lib/parlement/members";

// Amendments co-signed by the member during each loaded mandate: listed, never totalled on the card (charter §3.3).

export async function generateStaticParams() {
  return (await getPeople()).map((p) => ({ slug: p.slug }));
}

export async function GET(_req: Request, ctx: RouteContext<"/parlementaires/[slug]/cosignatures.csv">) {
  const p = await getPerson((await ctx.params).slug);
  if (!p) return new Response("Not found", { status: 404 });
  const [rows, sources, gaps] = await Promise.all([getAmendments(p.personId, "cosignataire"), getSources(), getDataGaps()]);
  const missing = amendmentsNotLoaded(gaps);
  const notLoaded = p.terms.filter((t) => t.legislature && missing.has(t.legislature))
    .map((t) => `${termPeriod(t)} : amendements pas encore chargés (serveur d'archives de l'Assemblée interrompu), absents de ce fichier.`);
  const sorted = [...rows].sort((a, b) => (a.filed ?? "").localeCompare(b.filed ?? "") || a.id.localeCompare(b.id));
  const term = (a: (typeof rows)[number]) => p.terms.find((t) => inTermRow(a, a.filed, t));
  const ids = p.terms[0].chamber === "AN"
    ? [...new Set(p.terms.map((t) => `an-amendements-${t.legislature}`))] : ["senat-amendements-972"];
  const body = toCsv(`Amendements cosignés — ${p.firstName} ${p.lastName}`,
    ids.map((id) => sources.get(id)).filter((s) => s != null),
    ["Un groupe dépose souvent ses amendements au nom de tous ses membres : la cosignature ne mesure pas un travail personnel.", ...notLoaded],
    ["mandat", "date de dépôt", "numéro", "texte", "article", "nombre de signataires", "issue", "lien"],
    sorted.map((a) => {
      const t = term(a);
      return [t ? termPeriod(t) : "", a.filed, a.number, a.text_title ?? (a.text_number ? `Texte n° ${a.text_number}` : ""),
        a.article, a.signatories, a.outcome ?? "sans issue publiée", a.url];
    }));
  return new Response(body, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="amendements-cosignes-${p.slug}.csv"`,
  } });
}
