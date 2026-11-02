"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MAX_COMPARE } from "@/lib/compare";

type Option = { code: string; name: string };

/** 2 to 4 native selects (searchable by typing on phones) + the year. Updates the URL; the server renders the table. */
export function ComparePicker({ communes, codes, year, years }: {
  communes: Option[]; codes: string[]; year: number; years: number[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const slots = Array.from({ length: MAX_COMPARE }, (_, i) => codes[i] ?? "");
  const go = (next: string[], y: number) => {
    const c = [...new Set(next.filter(Boolean))].join(",");
    start(() => router.replace(`/comparer?${new URLSearchParams({ ...(c ? { c } : {}), annee: String(y) })}`, { scroll: false }));
  };
  return (
    <form className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-busy={pending} onSubmit={(e) => e.preventDefault()}>
      {slots.map((code, i) => (
        <label key={i} className="text-xs text-slate-500">
          Commune {i + 1}{i >= 2 && " (facultatif)"}
          <select
            value={code}
            onChange={(e) => go(slots.map((s, j) => (j === i ? e.target.value : s)), year)}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
          >
            <option value="">—</option>
            {communes.map((c) => (
              <option key={c.code} value={c.code} disabled={c.code !== code && codes.includes(c.code)}>{c.name}</option>
            ))}
          </select>
        </label>
      ))}
      <label className="text-xs text-slate-500">
        Exercice
        <select
          value={year}
          onChange={(e) => go(slots, Number(e.target.value))}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
    </form>
  );
}
