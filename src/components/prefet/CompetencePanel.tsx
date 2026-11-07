import { prefet } from "@/i18n";

/** Who does what in Martinique: the State's competences next to the CTM's, the communes' and the intercommunalities'. */
export function CompetencePanel() {
  const items = [prefet.competenceState, prefet.competenceCtm, prefet.competenceCommunes, prefet.competenceEpci];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-xl font-semibold tracking-tight">{prefet.competenceTitle.fr}</h2>
      <p className="mt-1 text-sm text-slate-600">{prefet.competenceIntro.fr}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((it) => {
          const [who, what] = it.fr.split(" : ");
          return <li key={who}><span className="font-semibold">{who}</span> : {what}</li>;
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-500">{prefet.competenceNote.fr}</p>
    </section>
  );
}
