// Post-build checks for Cloudflare Pages (static `out/`):
// 1. Remove the ONNX Runtime .wasm binaries the bundler copied into `out/`. They are never
//    loaded: Transformers.js sets `env.backends.onnx.wasm.wasmPaths` to the jsDelivr CDN
//    (onnxruntime-web/dist) at runtime, and the file (~26 MB) exceeds the 25 MiB limit.
// 2. Fail if any remaining file exceeds Cloudflare Pages' 25 MiB per-file limit.
import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

const OUT = new URL("../out/", import.meta.url).pathname;
const LIMIT = 25 * 1024 * 1024;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const removed = [];
const tooLarge = [];
let largest = { path: "", size: 0 };
for await (const path of walk(OUT)) {
  if (/\/ort-wasm[^/]*\.wasm$/.test(path)) {
    await unlink(path);
    removed.push(path.slice(OUT.length));
    continue;
  }
  const { size } = await stat(path);
  if (size > largest.size) largest = { path: path.slice(OUT.length), size };
  if (size > LIMIT) tooLarge.push(`${path.slice(OUT.length)} (${(size / 1048576).toFixed(1)} MiB)`);
}

if (removed.length) console.log(`postbuild: removed unused ONNX Runtime wasm (loaded from CDN): ${removed.join(", ")}`);
console.log(`postbuild: largest file ${largest.path} (${(largest.size / 1048576).toFixed(2)} MiB)`);
if (tooLarge.length) {
  console.error(`postbuild: files over the 25 MiB Cloudflare Pages limit:\n  ${tooLarge.join("\n  ")}`);
  process.exit(1);
}
