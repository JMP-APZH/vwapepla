import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Official photos are served from our own Supabase Storage bucket "media" (copied with credit, removable).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "eiwmksgeudkjsugnvsdh.supabase.co", pathname: "/storage/v1/object/public/media/**" }],
  },
  partialPrefetching: true,
  // QR code read on SEM radio's show: one short URL, tagged for (cookieless) analytics.
  async redirects() {
    return [{ source: "/sem", destination: "/?utm_source=sem&utm_medium=radio&utm_campaign=mvp2", permanent: true }];
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
