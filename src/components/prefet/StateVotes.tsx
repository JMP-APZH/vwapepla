"use client";

import { useActionState } from "react";
import { castStateVote, type StateVoteState } from "@/app/prefet/actions";
import { LEVELS, MIN_VOTES, type Distribution, type VoteCriterion } from "@/lib/prefet/votes";
import { prefet } from "@/i18n";

const LEVEL_LABEL = [prefet.level1, prefet.level2, prefet.level3, prefet.level4, prefet.level5];
const pct = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const FACT_LABEL: Record<string, string> = {
  dpt_par_programme: prefet.creditsTitle.fr, subventions_etat: prefet.grantsTitle.fr,
  delinquance_enregistree: prefet.crimeTitle.fr, contexte_social_insee: prefet.socialTitle.fr,
};

function Results({ d }: { d: Distribution }) {
  if (!d.counts) {
    return <p className="mt-1 text-xs text-slate-500">{prefet.votesNotEnough.fr} ({d.total} / {MIN_VOTES})</p>;
  }
  return (
    <ul className="mt-2 space-y-1 text-xs" aria-label={prefet.votesDistribution.fr}>
      {LEVELS.map((l) => (
        <li key={l} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-2">
          <span className="truncate text-slate-700">{LEVEL_LABEL[l - 1].fr}</span>
          <div className="h-2.5 rounded bg-violet-100">
            <div className="h-2.5 rounded bg-violet-700" style={{ width: `${(d.counts![l] / d.total) * 100}%` }} />
          </div>
          <span className="tabular-nums text-slate-600">{d.counts![l]} · {pct.format(d.counts![l] / d.total)}</span>
        </li>
      ))}
      <li className="text-slate-500">{d.total} {prefet.votesCount.fr}</li>
    </ul>
  );
}

/** Opinion layer, kept apart from the facts: visitors' views on the State's action, per policy area (from 20 votes). */
export function StateVotes({ criteria, summary }: { criteria: VoteCriterion[]; summary: Distribution[] }) {
  const [state, action, pending] = useActionState<StateVoteState, FormData>(castStateVote, { status: null });
  const done = state.status === "ok" || state.status === "already_voted";
  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-4" aria-labelledby="state-votes-title">
      <h2 id="state-votes-title" className="text-xl font-semibold tracking-tight text-violet-950">{prefet.votesTitle.fr}</h2>
      <p className="mt-1 text-sm text-slate-700">{prefet.votesIntro.fr}</p>

      <form action={action} className="mt-3 space-y-4">
        {/* Honeypot: invisible to people, filled by naive bots. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Ne pas remplir <input type="text" name="avis_confirm" tabIndex={-1} autoComplete="off" /></label>
        </div>
        {criteria.map((c) => {
          const d = summary.find((s) => s.criterion === c.key)!;
          const facts = c.fact_blocks.map((f) => FACT_LABEL[f]).filter(Boolean);
          return (
            <fieldset key={c.key} className="border-t border-violet-200 pt-3">
              <legend className="text-sm font-medium text-slate-900">{c.label_fr}</legend>
              <p className="mt-1 text-xs text-slate-600">
                <span className="font-medium">
                  {c.competence === "etat" ? prefet.competenceEtat.fr : `${prefet.competencePartagee.fr} ${c.others.join(", ")}`}
                </span>{" — "}{c.state_role_fr}
              </p>
              {facts.length > 0 && <p className="mt-0.5 text-xs text-slate-500">{prefet.votesFacts.fr} : {facts.join(" · ")}</p>}
              <Results d={d} />
              {!done && (
                <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {[...LEVELS, 0].map((n) => (
                    <label key={n} className="relative">
                      <input type="radio" name={c.key} value={n} defaultChecked={n === 0} className="peer sr-only" />
                      <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-1 text-center text-[11px] leading-tight peer-checked:border-violet-900 peer-checked:bg-violet-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500">
                        {n === 0 ? prefet.levelNone.fr : LEVEL_LABEL[n - 1].fr}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          );
        })}
        {done ? (
          <p role="status" className="text-sm text-violet-900">{prefet[`votes_${state.status!}`].fr}</p>
        ) : (
          <>
            {state.status && <p role="alert" className="text-sm text-red-800">{prefet[`votes_${state.status}`].fr}</p>}
            <button type="submit" disabled={pending}
                    className="min-h-11 w-full rounded-lg bg-violet-900 px-4 text-sm font-medium text-white disabled:opacity-60">
              {pending ? "Envoi…" : prefet.votesSubmit.fr}
            </button>
          </>
        )}
      </form>
      <p className="mt-3 text-[11px] leading-snug text-slate-500">{prefet.votesDisclaimer.fr}</p>
    </section>
  );
}
