import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { t } from "@/i18n/strings";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://vwapepla.org"),
  title: { default: "Vwapepla — les comptes des communes de Martinique", template: "%s · Vwapepla" },
  description: t.tagline.fr,
  // Not indexed until the public launch (see docs/PLAN.md).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f172a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <header className="bg-slate-900 text-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              {t.siteName.fr} <span className="font-normal text-slate-400">· {t.siteName.kr}</span>
            </Link>
            <nav className="flex gap-4 text-sm text-slate-300">
              <Link href="/comparer" className="hover:text-white">{t.compare.fr}</Link>
              <Link href="/methodologie" className="hover:text-white">{t.methodology.fr}</Link>
              <Link href="/sources" className="hover:text-white">{t.sources.fr}</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-slate-200 bg-white text-sm text-slate-600">
          <div className="mx-auto max-w-3xl space-y-2 px-4 py-6">
            <p>{t.noRanking.fr}</p>
            <p>
              {t.otherProjects.fr} :{" "}
              <a href="https://prix-martinique.org" className="underline">prix-martinique.org</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
