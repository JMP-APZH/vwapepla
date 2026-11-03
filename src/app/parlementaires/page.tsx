import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/card/SectionPlaceholder";
import { parlement } from "@/i18n";

// Reserved for its team (see docs/branches/). Placeholder until the first cards are published.
export const metadata: Metadata = { title: parlement.sectionTitle.fr };

export default function Page() {
  return <SectionPlaceholder title={parlement.sectionTitle} intro={parlement.sectionIntro} />;
}
