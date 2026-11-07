"use client";

import { useActionState, useState } from "react";
import { castCriteriaVote, type CriteriaVoteState } from "@/app/communes/[slug]/actions";
import { Turnstile } from "@/components/card/Turnstile";
import {
  DONT_KNOW, LEVELS, type CommuneVoteCriterion, type CriteriaResults, type CriterionResult,
} from "@/lib/communes/criteria-votes";
import { communes as t } from "@/i18n";

const LEVEL_LABEL = [t.critLevel1, t.critLevel2, t.critLevel3, t.critLevel4, t.critLevel5];
const pct = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

function Results({ r }: { r: CriterionResult }) {
  const answered = r.rated + r.dontKnow;
  const dk = answered > 0 && r.dontKnow > 0
    ? <> · {r.dontKnow} {t.critDontKnowShare.fr} ({pct.format(r.dontKnow / answered)})</> : null;
  if (!r.counts) {
    return <p className="mt-1 text-xs text-slate-500">{r.rated} {t.critRated.fr} — {t.critNotEnough.fr}{dk}</p>;
  }
  return (
    <ul className="mt-2 space-y-1 text-xs" aria-label={t.critDistribution.fr}>
      {LEVELS.map((l) => (
        <li key={l} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-2">
          <span className="truncate text-slate-700">{LEVEL_LABEL[l - 1].fr}</span>
          <div className="h-2.5 rounded bg-violet-100">
            <div className="h-2.5 rounded bg-violet-700" style={{ width: `${(r.counts![l] / r.rated) * 100}%` }} />
          </div>
          <span className="tabular-nums text-slate-600">{r.counts![l]} · {pct.format(r.counts![l] / r.rated)}</span>
        </li>
      ))}
      <li className="text-slate-500">{r.rated} {t.critRated.fr}{dk}</li>
    </ul>
  );
}

/**
 * Opinion layer, kept apart from the facts: visitors' views on the commune's action, per criterion, current term.
 * The form (and the Turnstile script) loads only when the visitor opens it. Closed during pre-election periods.
 */
export function CriteriaVotes({ code, criteria, results, epciName }: {
  code: string; criteria: CommuneVoteCriterion[]; results: CriteriaResults; epciName: string | null;
}) {
  const [state, action, pending] = useActionState<CriteriaVoteState, FormData>(castCriteriaVote, { status: null });
  const [open, setOpen] = useState(false);
  const done = state.status === "ok" || state.status === "already_voted" || state.status === "closed";
  const voting = open && !done && !results.closed;
  return (
    <section id="avis-commune" className="scroll-mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4"
             aria-labelledby="crit-votes-title">
      <h2 id="crit-votes-title" className="text-xl font-semibold tracking-tight text-violet-950">{t.critTitle.fr}</h2>
      <p className="mt-1 text-sm text-slate-700">{t.critIntro.fr}</p>
      {results.closed && <p role="status" className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{t.critClosed.fr}</p>}

      <form action={action} className="mt-3 space-y-4">
        <input type="hidden" name="commune" value={code} />
        {/* Honeypot: invisible to people, filled by naive bots. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Ne pas remplir <input type="text" name="avis_commune_confirm" tabIndex={-1} autoComplete="off" /></label>
        </div>
        {criteria.map((c) => {
          const r = results.results.find((x) => x.criterion === c.key)!;
          return (
            <fieldset key={c.key} className="border-t border-violet-200 pt-3">
              <legend className="text-sm font-medium text-slate-900">{t.critStem.fr} {c.label_fr} ?</legend>
              <p className="mt-1 text-xs text-slate-600">
                <span className="font-medium">
                  {c.competence === "commune" ? t.critCompetenceCommune.fr : `${t.critCompetencePartagee.fr} ${c.others.join(", ")}`}
                </span>{" — "}{c.commune_role_fr}
              </p>
              {!results.closed && <Results r={r} />}
              {voting && (
                <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {[...LEVELS, DONT_KNOW].map((n) => (
                    <label key={n} className="relative">
                      <input type="radio" name={c.key} value={n} className="peer sr-only" />
                      <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-1 text-center text-[11px] leading-tight peer-checked:border-violet-900 peer-checked:bg-violet-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500">
                        {n === DONT_KNOW ? t.critDontKnow.fr : LEVEL_LABEL[(n as number) - 1].fr}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          );
        })}
        {criteria.some((c) => c.ref_status === "to_confirm") && <p className="text-xs text-slate-500">{t.critToConfirm.fr}</p>}

        {done && <p role="status" className="text-sm text-violet-900">{t[`crit_${state.status!}`].fr}</p>}
        {!done && !results.closed && !open && (
          <button type="button" onClick={() => setOpen(true)}
                  className="min-h-11 w-full rounded-lg border border-violet-900 bg-white px-4 text-sm font-medium text-violet-900">
            {t.critOpen.fr}
          </button>
        )}
        {voting && (
          <>
            <p className="text-xs text-slate-600">{t.critPrivacy.fr}</p>
            <Turnstile action="vote-commune" resetKey={state} />
            {state.status && <p role="alert" className="text-sm text-red-800">{t[`crit_${state.status}`].fr}</p>}
            <button type="submit" disabled={pending}
                    className="min-h-11 w-full rounded-lg bg-violet-900 px-4 text-sm font-medium text-white disabled:opacity-60">
              {pending ? "Envoi…" : t.critSubmit.fr}
            </button>
          </>
        )}
      </form>

      <div className="mt-4 border-t border-violet-200 pt-3 text-xs text-slate-600">
        <p>{t.critNotAskedTitle.fr}</p>
        <ul className="mt-1 list-disc pl-5">
          <li>{t.critNotAskedWater.fr.replace("{epci}", epciName ?? t.critNotAskedEpciFallback.fr)}</li>
          <li>{t.critNotAskedTransport.fr}</li>
          <li>{t.critNotAskedSchools.fr}</li>
        </ul>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-slate-500">{t.critDisclaimer.fr}</p>
    </section>
  );
}
