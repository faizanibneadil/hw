// Minimal static server for the exported `out/` folder (used by the e2e checks).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../out/", import.meta.url).pathname;
const port = Number(process.env.PORT ?? 4173);
const types = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".wasm": "application/wasm", ".woff2": "font/woff2", ".ico": "image/x-icon",
  ".txt": "text/plain", ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  let file = join(root, path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(root, "404.html");
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`serving out/ on http://localhost:${port}`));
