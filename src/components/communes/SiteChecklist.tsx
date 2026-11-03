import type { AuditCriterion, SiteAudit } from "@/lib/communes/data";
import { date } from "@/lib/core/format";
import { communes } from "@/i18n";

// Town-hall website checklist (FACTS: dated observations with evidence). No overall score, no ranking
// (CLAUDE.md principle 2, JM's amendment of 31 Oct 2026): counts are shown per theme only.

const THEMES: { id: string; title: string }[] = [
  { id: "site", title: "Le site de base" },
  { id: "argent_public", title: "Suivre et contrôler l'argent public" },
  { id: "information", title: "S'informer sur la commune et son action" },
  { id: "suivi_usagers", title: "Être tenu informé en tant qu'usager" },
  { id: "participation", title: "Participer aux décisions" },
];
const FAMILY: Record<AuditCriterion["family"], string> = {
  legal: "Obligation légale", quality: "Qualité de service", civic: "Bonne pratique",
};
const STATUS = {
  yes: { mark: "✓", label: "présent", cls: "bg-emerald-700 text-white" },
  partial: { mark: "◐", label: "partiel", cls: "bg-amber-500 text-white" },
  no: { mark: "✗", label: "non trouvé", cls: "bg-slate-500 text-white" },
  na: { mark: "–", label: "sans objet", cls: "bg-slate-200 text-slate-600" },
} as const;

export function SiteChecklist({ audit, criteria }: { audit: SiteAudit | null; criteria: AuditCriterion[] }) {
  if (!audit) {
    return <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{communes.auditPending.fr}</p>;
  }
  const byKey = new Map(audit.items.map((i) => [i.criterion_key, i]));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">{communes.auditTitle.fr}</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        Constaté le {date(audit.audited_on)}, relu par {audit.reviewed_by}. {communes.auditIntro.fr}
      </p>
      <div className="mt-3 space-y-2">
        {THEMES.map((th, n) => {
          const rows = criteria.filter((c) => c.theme === th.id).map((c) => ({ c, i: byKey.get(c.key) })).filter((r) => r.i);
          const applicable = rows.filter((r) => r.i!.status !== "na");
          const yes = applicable.filter((r) => r.i!.status === "yes").length;
          const partial = applicable.filter((r) => r.i!.status === "partial").length;
          return (
            <details key={th.id} open={n === 0} className="group rounded-lg border border-slate-200">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="font-medium">{th.title}</span>
                <span className="shrink-0 tabular-nums text-xs text-slate-600">
                  {yes} sur {applicable.length}{partial > 0 && ` · ${partial} partiel${partial > 1 ? "s" : ""}`}
                  <span aria-hidden className="ml-2 inline-block transition-transform group-open:rotate-90">›</span>
                </span>
              </summary>
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {rows.map(({ c, i }) => {
                  const s = STATUS[i!.status];
                  return (
                    <li key={c.key} className="flex gap-3 px-3 py-2 text-sm">
                      <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${s.cls}`}>{s.mark}</span>
                      <div className="min-w-0">
                        <p>
                          {c.label_fr} <span className="sr-only">: {s.label}</span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {FAMILY[c.family]}{c.family === "legal" && c.legal_ref && ` — ${c.legal_ref}`}
                        </p>
                        {i!.note && <p className="mt-0.5 text-xs text-slate-600">{i!.note}</p>}
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                          {i!.evidence_url && (
                            <a href={i!.evidence_url} className="underline" target="_blank" rel="noopener noreferrer">voir la page</a>
                          )}
                          {i!.archive_url && (
                            <a href={i!.archive_url} className="underline" target="_blank" rel="noopener noreferrer">copie archivée</a>
                          )}
                          <span>{i!.method === "manual" ? "vérifié à la main" : "relevé automatique"}</span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-snug text-slate-500">{communes.auditDisclaimer.fr}</p>
    </div>
  );
}
