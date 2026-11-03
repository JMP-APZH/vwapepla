import Link from "next/link";
import type { Pair } from "@/i18n";
import { common } from "@/i18n";

/** Reserved section (B2-B4) not yet published: title, scope and the method it will follow. */
export function SectionPlaceholder({ title, intro }: { title: Pair; intro: Pair }) {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title.fr}</h1>
      <p className="text-slate-600">{intro.fr}</p>
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-700">{common.placeholderText.fr}</p>
      <p className="text-sm"><Link href="/" className="underline">← {common.siteName.fr}</Link></p>
    </section>
  );
}
