// Test stub for the Workers-only `cloudflare:sockets` module, so
// the bundled worker can be imported and driven under Node.
export function connect() {
  throw new Error("cloudflare:sockets is not available under Node");
}
