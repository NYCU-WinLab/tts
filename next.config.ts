import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // No cacheComponents: every page reads the session, so nothing here
  // prerenders, and the model would only ask for Suspense around each read.
  output: "standalone",
  // The voice form sends two recordings (up to 10 MB each) in one action.
  experimental: { serverActions: { bodySizeLimit: "21mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
