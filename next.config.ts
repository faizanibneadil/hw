import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import type { NextConfig } from "next";

const emptyModule = "./lib/empty-module.ts";

/**
 * ONNX Runtime build without a bundled .wasm (its `onnxruntime-web-use-extern-wasm` export).
 * The default `onnxruntime-web/webgpu` build makes the bundler copy a 25.6 MiB .wasm into `out/`,
 * which exceeds Cloudflare Pages' 25 MiB file limit. Transformers.js loads the wasm from the
 * jsDelivr CDN at runtime (`env.backends.onnx.wasm.wasmPaths`), so the external build is all we need.
 */
const requireFromTransformers = createRequire(createRequire(import.meta.url).resolve("@huggingface/transformers"));
const ortWebgpuExternWasm = join(
  dirname(requireFromTransformers.resolve("onnxruntime-web/webgpu")),
  "ort.webgpu.min.mjs",
);
const ortWebgpuExternWasmRelative = `./${relative(process.cwd(), ortWebgpuExternWasm).split("\\").join("/")}`;

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
      "onnxruntime-web/webgpu": { browser: ortWebgpuExternWasmRelative },
    },
  },
  // Same exclusion for `next build --webpack`, as described in the Transformers.js tutorial.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
      "onnxruntime-web/webgpu$": ortWebgpuExternWasm,
    };
    return config;
  },
};

export default nextConfig;
