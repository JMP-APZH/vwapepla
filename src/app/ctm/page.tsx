import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/card/SectionPlaceholder";
import { ctm } from "@/i18n";

// Reserved for its team (see docs/branches/). Placeholder until the first cards are published.
export const metadata: Metadata = { title: ctm.sectionTitle.fr };

export default function Page() {
  return <SectionPlaceholder title={ctm.sectionTitle} intro={ctm.sectionIntro} />;
}
