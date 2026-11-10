import { ImageResponse } from "next/og";
import { HERO, REFERENCE_YEAR } from "@/lib/communes/config";
import { getCommuneBySlug, getCommuneYears, getYearActuals } from "@/lib/communes/data";
import { computeHero, heroKeys } from "@/lib/communes/headline";
import { deCommune } from "@/lib/communes/grammar";
import { ogFigures } from "@/lib/communes/og";

// Share image of a commune card: the hero trio of the reference year, as on the card. Facts only (no vote, no rank).
export const alt = "Les comptes de la commune : trois chiffres clés, source OFGL d'après DGFiP";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const commune = await getCommuneBySlug((await params).slug);
  const year = REFERENCE_YEAR;
  const [years, rows] = await Promise.all([getCommuneYears(year), getYearActuals(year, heroKeys(HERO))]);
  const stratumOf = new Map(years.map((y) => [y.commune_code, y.stratum]));
  const figures = commune ? ogFigures(computeHero(HERO, commune.code, rows, stratumOf)) : [];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "56px 64px",
                    background: "#f8fafc", color: "#0f172a", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 30, color: "#475569" }}>Vwapepla · les comptes des communes de Martinique</div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, marginTop: 12, lineHeight: 1.1 }}>
          {commune ? `Commune ${deCommune(commune.name)}` : "Commune"}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#475569", marginTop: 8 }}>Trois chiffres clés, comptes {year}</div>
        <div style={{ display: "flex", gap: 24, marginTop: 40 }}>
          {figures.map((f) => (
            <div key={f.label} style={{ display: "flex", flexDirection: "column", flex: 1, background: "#ffffff",
                                        border: "2px solid #e2e8f0", borderRadius: 20, padding: "24px 28px" }}>
              <div style={{ display: "flex", fontSize: 26, color: "#475569" }}>{f.label}</div>
              <div style={{ display: "flex", fontSize: 52, fontWeight: 700, marginTop: 10 }}>{f.value}</div>
              <div style={{ display: "flex", fontSize: 20, color: "#64748b", marginTop: 12 }}>{f.median}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 22, color: "#64748b" }}>
          {`Source : OFGL, d'après DGFiP, comptes consolidés ${year} · vwapepla.org`}
        </div>
      </div>
    ),
    size,
  );
}
