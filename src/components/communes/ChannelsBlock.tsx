import type { ChannelObservation } from "@/lib/communes/data";
import { BASIS_LABEL, PLATFORM_LABEL, type PlatformStatus } from "@/lib/communes/channels";
import { date, int } from "@/lib/core/format";
import { communes } from "@/i18n";

const STREAMED: Record<string, string> = { yes: "oui", no: "non trouvé", unknown: "non vérifié" };

function Account({ a }: { a: ChannelObservation }) {
  return (
    <div className="mt-1">
      <p>
        <a href={a.account_url!} className="break-all font-medium underline" target="_blank" rel="noopener noreferrer">
          {a.account_name ?? a.account_url!.replace(/^https?:\/\/(www\.)?/, "")}
        </a>{" "}
        <span className="text-slate-600">
          · {a.official === "yes"
            ? <>compte officiel ({a.official_basis && BASIS_LABEL[a.official_basis]
              ? (a.official_evidence_url
                ? <a href={a.official_evidence_url} className="underline" target="_blank" rel="noopener noreferrer">{BASIS_LABEL[a.official_basis]}</a>
                : BASIS_LABEL[a.official_basis])
              : "source indiquée"})</>
            : a.official === "no" ? "compte non officiel" : "non confirmé comme officiel"}
        </span>
      </p>
      <ul className="mt-0.5 space-y-0.5 text-xs text-slate-600 tabular-nums">
        <li>Dernière publication : {a.last_post_date ? date(a.last_post_date) : "non relevée"}</li>
        <li>Publications sur les 90 derniers jours : {a.posts_last_90_days != null ? int(a.posts_last_90_days) : "non comptées"}</li>
        <li>
          Conseils municipaux diffusés : {a.council_meetings_streamed ? STREAMED[a.council_meetings_streamed] : "non vérifié"}
          {a.council_meetings_streamed === "yes" && a.council_stream_evidence_url && (
            <> (<a href={a.council_stream_evidence_url} className="underline" target="_blank" rel="noopener noreferrer">exemple</a>)</>
          )}
        </li>
        {(a.followers_display ?? a.followers) != null && (
          <li>Abonnés : {a.followers_display ?? int(a.followers)} (affiché le jour du relevé)</li>
        )}
      </ul>
    </div>
  );
}

/** Facts only: the town hall's accounts as observed by the team on a given day. No verdict, no comparison. */
export function ChannelsBlock({ status }: { status: PlatformStatus[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">{communes.channelsTitle.fr}</h3>
      <p className="mt-1 text-xs text-slate-500">{communes.channelsIntro.fr}</p>
      <ul className="mt-2 divide-y divide-slate-100 text-sm">
        {status.map((s) => (
          <li key={s.platform} className="py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {PLATFORM_LABEL[s.platform]}
              {s.kind !== "not_observed" && (
                <span className="font-normal normal-case tracking-normal">
                  {" "}· relevé du {date(s.observedOn)}{s.stale && <span className="text-amber-800"> (relevé ancien)</span>}
                </span>
              )}
            </p>
            {s.kind === "accounts" && s.accounts.map((a) => <Account key={a.id} a={a} />)}
            {s.kind === "none_found" && <p className="mt-1 text-slate-700">{communes.channelsNoneFound.fr}{s.note && <span className="text-xs text-slate-500"> — {s.note}</span>}</p>}
            {s.kind === "not_observed" && <p className="mt-1 text-slate-500">{communes.channelsNotObserved.fr}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-snug text-slate-500">{communes.channelsSource.fr}</p>
    </section>
  );
}
