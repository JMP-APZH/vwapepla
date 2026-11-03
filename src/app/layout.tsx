import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { common } from "@/i18n";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://vwapepla.org"),
  title: { default: "Vwapepla — les élus de Martinique, en chiffres sourcés", template: "%s · Vwapepla" },
  description: common.tagline.fr,
  // Not indexed until the public launch (see docs/PLAN.md).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f172a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col overflow-x-clip bg-slate-50 text-slate-900">
        <header className="bg-slate-900 text-white">
          <div className="mx-auto max-w-3xl px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-3">
            <Link href="/" className="shrink-0 whitespace-nowrap font-semibold tracking-tight">
              {common.siteName.fr} <span className="hidden font-normal text-slate-400 sm:inline">· {common.siteName.kr}</span>
            </Link>
            {/* Phone: second row, scrolls sideways if needed. One link per domain, then the shared pages. */}
            <nav className="-mx-4 mt-2 flex gap-4 overflow-x-auto whitespace-nowrap px-4 pb-1 text-sm text-slate-300 sm:mx-0 sm:mt-0 sm:px-0 sm:pb-0">
              <Link href="/communes" className="hover:text-white">{common.navCommunes.fr}</Link>
              <Link href="/parlementaires" className="hover:text-white">{common.navParlement.fr}</Link>
              <Link href="/ctm" className="hover:text-white">{common.navCtm.fr}</Link>
              <Link href="/prefet" className="hover:text-white">{common.navPrefet.fr}</Link>
              <Link href="/methodologie" className="hover:text-white">{common.methodology.fr}</Link>
              <Link href="/sources" className="hover:text-white">{common.sources.fr}</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-slate-200 bg-white text-sm text-slate-600">
          <div className="mx-auto max-w-3xl space-y-2 px-4 py-6">
            <p>{common.noRanking.fr}</p>
            <p>
              {common.otherProjects.fr} :{" "}
              <a href="https://prix-martinique.org" className="underline">prix-martinique.org</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
