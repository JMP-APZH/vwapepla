// CSV downloads of the parliament cards (complete lists, not curated). Semicolon-separated, UTF-8 with BOM so that
// spreadsheet software opens accents correctly. The first lines say what the file is, its source, licence and date.

import type { Source } from "@/lib/core/data";

function cell(v: string | number | boolean | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(title: string, sources: Source[], notes: string[], header: string[],
                      rows: (string | number | boolean | null)[][]): string {
  const meta = [
    [`# ${title}`],
    ...sources.map((s) => [`# ${s.credit} — ${s.title ?? s.id} — ${s.licence} — récupéré le ${s.retrieved} — ${s.dataset_page ?? s.url}`]),
    ...notes.map((n) => [`# ${n}`]),
    ["# Généré par vwapepla.org à partir des données officielles ci-dessus."],
  ];
  return "﻿" + [...meta, header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
