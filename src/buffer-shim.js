// @solana/web3.js expects Node's Buffer global in the browser. Install
// the polyfill before any wallet code evaluates — this module must stay
// the very first import of app.js.
import { Buffer } from "buffer";
if (!globalThis.Buffer) globalThis.Buffer = Buffer;
