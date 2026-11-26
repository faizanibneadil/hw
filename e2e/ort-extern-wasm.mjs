// Cloudflare Pages limit: the build must not contain the ~26 MB ONNX Runtime .wasm, and the
// ONNX Runtime module the app bundles must still run with the wasm loaded from the CDN the way
// Transformers.js configures it (env.backends.onnx.wasm.wasmPaths -> jsDelivr onnxruntime-web/dist).
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { chromium, BASE } from "./helpers.mjs";

const fail = (msg) => {
  throw new Error(msg);
};
const outMedia = new URL("../out/_next/static/media/", import.meta.url).pathname;
const media = await readdir(outMedia);
if (media.some((f) => f.endsWith(".wasm"))) fail(`wasm emitted into out/: ${media.filter((f) => f.endsWith(".wasm"))}`);
const ortModule = media.find((f) => /^ort\.webgpu\.min\..*\.mjs$/.test(f));
if (!ortModule) fail("bundled ort.webgpu.min.mjs (external-wasm build) not found");

// Serve the CDN files from the installed onnxruntime-web package (the sandbox may block the CDN).
const req = createRequire(createRequire(import.meta.url).resolve("@huggingface/transformers"));
const ortDist = dirname(req.resolve("onnxruntime-web/webgpu"));
const browser = await chromium.launch();
const page = await browser.newPage();
const cdnHits = [];
await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/onnxruntime-web@[^/]+\/dist\/(.+)$/, async (route) => {
  const file = new URL(route.request().url()).pathname.split("/").pop();
  cdnHits.push(file);
  await route.fulfill({
    body: await readFile(join(ortDist, file)),
    headers: { "content-type": file.endsWith(".wasm") ? "application/wasm" : "text/javascript", "access-control-allow-origin": "*" },
  });
});
await page.goto(`${BASE}404.html`);
const model = [...(await readFile(new URL("./fixtures/add.onnx", import.meta.url)))];
const result = await page.evaluate(
  async ({ src, model }) => {
    const ort = await import(src);
    const prefix = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
    // Same configuration Transformers.js applies in the browser.
    ort.env.wasm.wasmPaths = {
      mjs: `${prefix}ort-wasm-simd-threaded.asyncify.mjs`,
      wasm: `${prefix}ort-wasm-simd-threaded.asyncify.wasm`,
    };
    ort.env.wasm.proxy = false;
    ort.env.wasm.numThreads = 1;
    const session = await ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ["wasm"] });
    const t = (v) => new ort.Tensor("float32", Float32Array.from(v), [3]);
    const out = await session.run({ a: t([1, 2, 3]), b: t([10, 20, 30]) });
    return Array.from(out.c.data);
  },
  { src: `/_next/static/media/${ortModule}`, model },
);
await browser.close();
if (result.join(",") !== "11,22,33") fail(`wrong result ${result}`);
if (!cdnHits.some((f) => f.endsWith(".wasm"))) fail("wasm was not loaded from the CDN");
console.log(`ort-extern-wasm OK (no wasm in out/, CDN files: ${cdnHits.join(", ")})`);
