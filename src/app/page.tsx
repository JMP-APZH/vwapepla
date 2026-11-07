import Link from "next/link";
import { common, communes, ctm, parlement, prefet } from "@/i18n";

// Home: the four domains; "ready" marks the published ones (the others are reserved for their teams).
const SECTIONS = [
  { href: "/communes", ns: communes, ready: true },
  { href: "/parlementaires", ns: parlement, ready: false },
  { href: "/ctm", ns: ctm, ready: true },
  { href: "/prefet", ns: prefet, ready: false },
] as const;

export default function Home() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{common.homeTitle.fr}</h1>
      <p className="mt-2 text-slate-600">{common.homeIntro.fr}</p>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href}
                  className={`block h-full rounded-xl border bg-white p-4 ${s.ready ? "border-slate-300 hover:border-slate-500" : "border-dashed border-slate-300"}`}>
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{s.ns.sectionTitle.fr}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${s.ready ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-600"}`}>
                  {s.ready ? common.available.fr : common.comingSoon.fr}
                </span>
              </span>
              <span className="mt-1 block text-sm text-slate-600">{s.ns.sectionIntro.fr}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
