// UI strings, one namespace per domain: messages/<lang>/<namespace>.json.
//   fr  = French (complete; the reference: every key exists here)
//   gcf = Kréyòl (Martinican Creole, ISO 639-3 "gcf"); only the labels agreed with JM, others fall back to French.
// common = shared by every page (layout, card shell, sources); communes / parlement / ctm / prefet = one per team.
// Usage: import { communes } from "@/i18n";  communes.mayor.fr  ·  communes.headlineTitle.kr (null if not agreed).
// Metric labels live in the database (com_metric_definitions.label_fr / label_kreyol), not here.
import frCommon from "../../messages/fr/common.json";
import frCommunes from "../../messages/fr/communes.json";
import frCtm from "../../messages/fr/ctm.json";
import frParlement from "../../messages/fr/parlement.json";
import frPrefet from "../../messages/fr/prefet.json";
import gcfCommon from "../../messages/gcf/common.json";
import gcfCommunes from "../../messages/gcf/communes.json";
import gcfCtm from "../../messages/gcf/ctm.json";
import gcfParlement from "../../messages/gcf/parlement.json";
import gcfPrefet from "../../messages/gcf/prefet.json";

export type Pair = { fr: string; kr: string | null };

export function namespace<T extends Record<string, string>>(fr: T, gcf: Partial<Record<keyof T, string>>): { [K in keyof T]: Pair } {
  return Object.fromEntries(
    Object.entries(fr).map(([k, v]) => [k, { fr: v, kr: (gcf as Record<string, string | undefined>)[k] ?? null }]),
  ) as { [K in keyof T]: Pair };
}

export const MESSAGES = {
  common: { fr: frCommon, gcf: gcfCommon },
  communes: { fr: frCommunes, gcf: gcfCommunes },
  parlement: { fr: frParlement, gcf: gcfParlement },
  ctm: { fr: frCtm, gcf: gcfCtm },
  prefet: { fr: frPrefet, gcf: gcfPrefet },
} as const;

export const common = namespace(frCommon, gcfCommon);
export const communes = namespace(frCommunes, gcfCommunes);
export const parlement = namespace(frParlement, gcfParlement);
export const ctm = namespace(frCtm, gcfCtm);
export const prefet = namespace(frPrefet, gcfPrefet);
