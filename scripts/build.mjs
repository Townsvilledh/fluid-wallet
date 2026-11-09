// Build: bundle JS, copy pages, and produce a single-file wallet.
import { build } from "esbuild";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
mkdirSync("dist", { recursive: true });
await build({ entryPoints: ["src/app.js"], bundle: true, minify: true, outfile: "dist/app.bundle.js", external: ["./lightning.chunk.js", "./walletconnect.chunk.js"] });
// Lightning node chunk: built separately and loaded lazily by app.js
// only when the Lightning panel opens. The WASM binary ships beside it
// under the exact name the chunk's init() resolves via import.meta.url.
await build({ entryPoints: ["src/lightning-node.js"], bundle: true, minify: true, format: "esm", outfile: "dist/lightning.chunk.js" });
// WalletConnect chunk: the Reown/WalletKit SDK, built separately and
// loaded lazily by app.js only when the WalletConnect panel opens.
await build({ entryPoints: ["src/walletconnect.js"], bundle: true, minify: true, format: "esm", outfile: "dist/walletconnect.chunk.js" });
copyFileSync("lightning/pkg-web/fluid_lightning_bg.wasm", "dist/fluid_lightning_bg.wasm");
copyFileSync("src/sw.js", "dist/sw.js");
copyFileSync("src/index.html", "dist/index.html");
copyFileSync("tools/recovery.html", "dist/recovery.html");
copyFileSync("names.json", "dist/names.json");
copyFileSync("public/_headers", "dist/_headers");
// Agent manifest (agent kit, 2026-11-09): served at the root AND at the
// well-known path — one source file, two published copies.
mkdirSync("dist/.well-known", { recursive: true });
copyFileSync("public/fluid-agent.json", "dist/fluid-agent.json");
copyFileSync("public/fluid-agent.json", "dist/.well-known/fluid-agent.json");
copyFileSync("public/robots.txt", "dist/robots.txt");
copyFileSync("public/sitemap.xml", "dist/sitemap.xml");
copyFileSync("public/og-image.png", "dist/og-image.png");
copyFileSync("public/favicon.png", "dist/favicon.png");
copyFileSync("public/CNAME", "dist/CNAME");
mkdirSync("dist/fonts", { recursive: true });
copyFileSync("public/fonts/inter-var.woff2", "dist/fonts/inter-var.woff2");
copyFileSync("public/fonts/space-grotesk-var.woff2", "dist/fonts/space-grotesk-var.woff2");
// Cache-bust the bundle: stamp dist/index.html with app.bundle.js?v=<hash> so
// every deploy is a new URL and browsers never sit on a stale bundle.
const bundleHash = createHash("sha256").update(readFileSync("dist/app.bundle.js")).digest("hex").slice(0, 10);
const distHtml = readFileSync("dist/index.html", "utf8");
writeFileSync("dist/index.html", distHtml
  .replace('<script src="app.bundle.js"></script>', `<script src="app.bundle.js?v=${bundleHash}"></script>`)
  .replace("</head>", `<meta name="fluid-build" content="${bundleHash}"></head>`));
const html = readFileSync("src/index.html", "utf8");
const js = readFileSync("dist/app.bundle.js", "utf8");
// The single-file build inlines the bundle, so the strict CSP in
// index.html (script-src 'self') would block it. Give ONLY the single
// file a hash allowance for its exact inline script bytes: compute the
// sha256 of the precise text placed between <script>...</script> and add
// 'sha256-...' to its script-src. Any modification of the inlined script
// changes the hash and the script stops running.
const inlinedJs = js.replace(/<\/script>/g, "<\\/script>");
const singleFileHash = createHash("sha256").update(inlinedJs, "utf8").digest("base64");
const single = html
  .replace('<script src="app.bundle.js"></script>', () => "<script>" + inlinedJs + "</script>")
  .replace("script-src 'self'", `script-src 'self' 'sha256-${singleFileHash}'`);
writeFileSync("dist/fluid-wallet.html", single);
console.log("built dist/{index.html, app.bundle.js, recovery.html, fluid-wallet.html}", (single.length / 1024).toFixed(0) + "KB single file");
