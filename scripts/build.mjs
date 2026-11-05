// Build: bundle JS, copy pages, and produce a single-file wallet.
import { build } from "esbuild";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
mkdirSync("dist", { recursive: true });
await build({ entryPoints: ["src/app.js"], bundle: true, minify: true, outfile: "dist/app.bundle.js" });
copyFileSync("src/index.html", "dist/index.html");
copyFileSync("tools/recovery.html", "dist/recovery.html");
copyFileSync("names.json", "dist/names.json");
const html = readFileSync("src/index.html", "utf8");
const js = readFileSync("dist/app.bundle.js", "utf8");
const single = html.replace('<script src="app.bundle.js"></script>', () => "<script>" + js.replace(/<\/script>/g, "<\\/script>") + "</script>");
writeFileSync("dist/fluid-wallet.html", single);
console.log("built dist/{index.html, app.bundle.js, recovery.html, fluid-wallet.html}", (single.length / 1024).toFixed(0) + "KB single file");
