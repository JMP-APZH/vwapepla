import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Official photos are served from our own Supabase Storage bucket "media" (copied with credit, removable).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "eiwmksgeudkjsugnvsdh.supabase.co", pathname: "/storage/v1/object/public/media/**" }],
  },
  partialPrefetching: true,
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
