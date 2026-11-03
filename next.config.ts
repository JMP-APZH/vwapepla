import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Official photos are served from our own Supabase Storage bucket "media" (copied with credit, removable).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "eiwmksgeudkjsugnvsdh.supabase.co", pathname: "/storage/v1/object/public/media/**" }],
  },
  partialPrefetching: true,
  async redirects() {
    return [
      // QR code read on SEM radio's show (mayors' budgets): one short URL, tagged for (cookieless) analytics.
      { source: "/sem", destination: "/communes?utm_source=sem&utm_medium=radio&utm_campaign=mvp2", permanent: true },
      // Commune pages moved under /communes (3 Nov 2026); old links keep working. The query string is passed on.
      { source: "/commune/:slug", destination: "/communes/:slug", permanent: true },
      { source: "/comparer", destination: "/communes/comparer", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
