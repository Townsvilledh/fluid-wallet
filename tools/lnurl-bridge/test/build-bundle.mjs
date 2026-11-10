// Bundle the Worker exactly as the deploy does: one ES module,
// cloudflare:sockets external (a Workers runtime builtin).
// For the Node smoke test, a second bundle aliases
// cloudflare:sockets to a stub so Node can import it.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "..", "src", "worker.js");

await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "neutral",
  external: ["cloudflare:sockets"],
  outfile: join(here, "..", "worker.deploy.mjs"),
});
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "neutral",
  alias: { "cloudflare:sockets": join(here, "cf-sockets-stub.mjs") },
  outfile: join(here, "..", "worker.bundle.mjs"),
});
console.log("bundles written: worker.deploy.mjs (cloudflare:sockets external), worker.bundle.mjs (stubbed for Node)");
