"use client";

import { useState } from "react";

// Client part of the votes block: filter by part of the published rule, and show the list 20 lines at a time.
// Rendered from server data; no figure is computed here.

export type VoteItem = {
  id: string; number: number; dateLabel: string; title: string; url: string; parts: string[]; position: string;
  groupPosition: string | null; result: string | null; byDelegation: boolean; correction: string | null;
  status: string | null;
};

const STEP = 20;

export function VoteList({ items, parts, labels }: {
  items: VoteItem[]; parts: { key: string; label: string }[];
  labels: { all: string; more: string; position: string; group: string; result: string; delegation: string; correction: string;
            status: string };
}) {
  const [part, setPart] = useState<string | null>(null);
  const [shown, setShown] = useState(STEP);
  const list = part ? items.filter((i) => i.parts.includes(part)) : items;
  const chip = (key: string | null, label: string) => (
    <button key={key ?? "all"} type="button" onClick={() => { setPart(key); setShown(STEP); }}
            aria-pressed={part === key}
            className={`rounded-full border px-3 py-1 text-xs ${part === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}>
      {label}
    </button>
  );
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">{chip(null, labels.all)}{parts.map((p) => chip(p.key, p.label))}</div>
      <ol className="mt-3 space-y-2 text-sm">
        {list.slice(0, shown).map((v) => (
          <li key={v.id} className="rounded-lg bg-slate-50 p-2">
            <p className="text-xs text-slate-500">
              {v.dateLabel} · scrutin n° {v.number}
            </p>
            <a href={v.url} className="underline" target="_blank" rel="noopener noreferrer">{v.title}</a>
            <dl className="mt-1 grid grid-cols-1 gap-x-4 text-xs sm:grid-cols-3">
              <div><dt className="inline text-slate-500">{labels.position} : </dt>
                <dd className="inline font-medium">{v.position}{v.byDelegation && ` (${labels.delegation})`}</dd></div>
              {v.status && <div><dt className="inline text-slate-500">{labels.status} : </dt><dd className="inline">{v.status}</dd></div>}
              {v.groupPosition && <div><dt className="inline text-slate-500">{labels.group} : </dt><dd className="inline">{v.groupPosition}</dd></div>}
              {v.result && <div><dt className="inline text-slate-500">{labels.result} : </dt><dd className="inline">{v.result}</dd></div>}
            </dl>
            {v.correction && <p className="mt-1 text-xs text-slate-600">{labels.correction.replace("{position}", v.correction)}</p>}
          </li>
        ))}
      </ol>
      {list.length > shown && (
        <button type="button" onClick={() => setShown(shown + STEP * 5)} className="mt-3 text-sm underline">
          {labels.more.replace("{n}", String(Math.min(STEP * 5, list.length - shown)))}
        </button>
      )}
    </div>
  );
}
