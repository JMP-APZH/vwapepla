import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/card/SectionPlaceholder";
import { prefet } from "@/i18n";

// Reserved for its team (see docs/branches/). Placeholder until the first cards are published.
export const metadata: Metadata = { title: prefet.sectionTitle.fr };

export default function Page() {
  return <SectionPlaceholder title={prefet.sectionTitle} intro={prefet.sectionIntro} />;
}
