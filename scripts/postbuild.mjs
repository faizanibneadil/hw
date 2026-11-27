// Post-build check for Cloudflare Workers static assets (`out/`, served by wrangler.jsonc's
// `assets.directory`), run by `pnpm build`. Limits from
// https://developers.cloudflare.com/workers/platform/limits/#static-assets :
// - each static asset file: 25 MiB (Workers Free and Paid),
// - files per Worker version: 20,000 on Workers Free (100,000 on Paid).
// next.config.ts already aliases onnxruntime-web to its external-wasm build, so no ONNX Runtime
// .wasm should be emitted (Offline mode loads it from the jsDelivr CDN at runtime). This script:
// 1. removes any ONNX Runtime .wasm that still ends up in `out/` (belt and braces),
// 2. fails if any file exceeds the per-file limit or there are too many files.
import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

const OUT = new URL("../out/", import.meta.url).pathname;
const FILE_LIMIT = 25 * 1024 * 1024;
const COUNT_LIMIT = 20_000;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const removed = [];
const tooLarge = [];
let count = 0;
let largest = { path: "", size: 0 };
for await (const path of walk(OUT)) {
  if (/\/ort-wasm[^/]*\.wasm$/.test(path)) {
    await unlink(path);
    removed.push(path.slice(OUT.length));
    continue;
  }
  count++;
  const { size } = await stat(path);
  if (size > largest.size) largest = { path: path.slice(OUT.length), size };
  if (size > FILE_LIMIT) tooLarge.push(`${path.slice(OUT.length)} (${(size / 1048576).toFixed(1)} MiB)`);
}

if (removed.length) console.log(`postbuild: removed unused ONNX Runtime wasm (loaded from CDN): ${removed.join(", ")}`);
console.log(`postbuild: ${count} files, largest ${largest.path} (${(largest.size / 1048576).toFixed(2)} MiB)`);
let failed = false;
if (tooLarge.length) {
  console.error(`postbuild: files over the 25 MiB Workers static asset limit:\n  ${tooLarge.join("\n  ")}`);
  failed = true;
}
if (count > COUNT_LIMIT) {
  console.error(`postbuild: ${count} files, over the ${COUNT_LIMIT} static assets per Worker version on Workers Free`);
  failed = true;
}
if (failed) process.exit(1);
