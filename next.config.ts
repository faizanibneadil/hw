import type { NextConfig } from "next";

const emptyModule = "./lib/empty-module.ts";

const nextConfig: NextConfig = {
  // Fully static site for Cloudflare Pages: no server, no API routes.
  output: "export",
  images: { unoptimized: true },
  experimental: {
    agentFeedback: true,
  },
  // cacheComponents / partialPrefetching (PPR) are not supported with `output: "export"`.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    // Transformers.js only needs the browser runtime. Exclude Node-only packages
    // from the browser bundle (Turbopack equivalent of the tutorial's webpack alias).
    resolveAlias: {
      sharp: { browser: emptyModule },
      "onnxruntime-node": { browser: emptyModule },
    },
  },
  // Same exclusion for `next build --webpack`, as described in the Transformers.js tutorial.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;
