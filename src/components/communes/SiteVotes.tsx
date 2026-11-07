"use client";

import { useActionState } from "react";
import { Turnstile } from "@/components/card/Turnstile";
import { castSiteVote, type VoteState } from "@/app/communes/[slug]/actions";
import { MIN_VOTES, QUESTIONS, type VoteSummary } from "@/lib/communes/vote-questions";
import { communes } from "@/i18n";

const avg = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Opinion layer, kept apart from the facts: visitor ratings of the town hall's website (shown from 20 votes). */
export function SiteVotes({ code, summary }: { code: string; summary: VoteSummary[] }) {
  const [state, action, pending] = useActionState<VoteState, FormData>(castSiteVote, { status: null });
  const done = state.status === "ok" || state.status === "already_voted";
  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-4" aria-labelledby="votes-title">
      <h3 id="votes-title" className="font-semibold text-violet-950">{communes.votesTitle.fr}</h3>

      <dl className="mt-2 space-y-1.5 text-sm">
        {summary.map((s) => (
          <div key={s.question} className="flex items-baseline justify-between gap-3">
            <dt className="min-w-0 text-slate-700">{communes[`q_${s.question}`].fr}</dt>
            <dd className="shrink-0 tabular-nums text-slate-900">
              {s.votes >= MIN_VOTES && s.average != null
                ? <><span className="font-semibold">{avg.format(s.average)}</span> / 5 <span className="text-xs text-slate-500">({s.votes} avis)</span></>
                : <span className="text-xs text-slate-500">{communes.votesNotEnough.fr} ({s.votes} / {MIN_VOTES})</span>}
            </dd>
          </div>
        ))}
      </dl>

      {done ? (
        <p role="status" className="mt-3 text-sm text-violet-900">{communes[`votes_${state.status!}`].fr}</p>
      ) : (
        <form action={action} className="mt-4 space-y-3 border-t border-violet-200 pt-3">
          <p className="text-xs text-slate-600">{communes.votesIntro.fr}</p>
          <input type="hidden" name="commune" value={code} />
          {/* Honeypot: invisible to people, filled by naive bots. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>Ne pas remplir <input type="text" name="site_web_confirm" tabIndex={-1} autoComplete="off" /></label>
          </div>
          {QUESTIONS.map((q) => (
            <fieldset key={q}>
              <legend className="text-sm text-slate-800">{communes[`q_${q}`].fr}</legend>
              <div className="mt-1 grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="relative">
                    <input type="radio" name={q} value={n} className="peer sr-only" />
                    <span className="flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white text-sm tabular-nums peer-checked:border-violet-900 peer-checked:bg-violet-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500">
                      {n}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <Turnstile action="vote-site" resetKey={state} />
          {state.status && <p role="alert" className="text-sm text-red-800">{communes[`votes_${state.status}`].fr}</p>}
          <button type="submit" disabled={pending}
                  className="min-h-11 w-full rounded-lg bg-violet-900 px-4 text-sm font-medium text-white disabled:opacity-60">
            {pending ? "Envoi…" : communes.votesSubmit.fr}
          </button>
        </form>
      )}
      <p className="mt-3 text-[11px] leading-snug text-slate-500">{communes.votesDisclaimer.fr}</p>
    </section>
  );
}
