// Fluid's WebSocket -> TCP proxy for Lightning peer connections.
//
// Browsers cannot open raw TCP sockets, and Lightning peers speak
// raw TCP (BOLT 8 Noise over port 9735). This proxy is the dumb pipe
// between them: a browser opens a WebSocket to /<host>/<port> here,
// the proxy opens TCP to that host:port, and bytes flow both ways.
//
// It is deliberately stupid: no accounts, no state beyond the live
// sockets, no logging of payloads (it could not read them anyway —
// see README.md for the trust model). Node.js standard library only.
//
// Run: PORT=8788 node server.mjs   (put a TLS terminator in front —
// browsers require wss:// from an https page)

import http from "node:http";
import net from "node:net";
import { createHash } from "node:crypto";

const PORT = Number(process.env.PORT || 8788);
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

// --- minimal WebSocket framing (RFC 6455) ---------------------------
// Client -> proxy frames are masked; proxy -> client frames are not.
// Only the byte stream matters: fragmented messages are reassembled,
// ping is answered with pong, close ends both sides.

function encodeFrame(payload) {
  const len = payload.length;
  let head;
  if (len < 126) {
    head = Buffer.from([0x82, len]);
  } else if (len < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x82; head[1] = 126; head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x82; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([head, payload]);
}

function makeFrameFeeder({ onPayload, onPing, onClose }) {
  let buf = Buffer.alloc(0);
  let fragments = [];
  return (chunk) => {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    for (;;) {
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0;
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < off + 2) return;
        len = buf.readUInt16BE(off); off += 2;
      } else if (len === 127) {
        if (buf.length < off + 8) return;
        len = Number(buf.readBigUInt64BE(off)); off += 8;
      }
      let mask = null;
      if (masked) {
        if (buf.length < off + 4) return;
        mask = buf.subarray(off, off + 4); off += 4;
      }
      if (buf.length < off + len) return;
      let payload = buf.subarray(off, off + len);
      if (mask) {
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      }
      buf = buf.subarray(off + len);
      if (opcode === 0x8) { onClose(); return; }
      if (opcode === 0x9) { onPing(payload); continue; }
      if (opcode === 0xA) continue; // pong: nothing to do
      fragments.push(payload);
      if (fin) {
        onPayload(Buffer.concat(fragments));
        fragments = [];
      }
    }
  };
}

// --- the proxy ------------------------------------------------------

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("fluid ws-proxy: open a WebSocket to /<host>/<port> and your bytes are carried over TCP to that Lightning peer.\n");
});

server.on("upgrade", (req, socket, head) => {
  const key = req.headers["sec-websocket-key"];
  const m = /^\/([^/]+)\/(\d{1,5})\/?$/.exec(String(req.url || "").split("?")[0]);
  if (!key || !m) { socket.destroy(); return; }
  let host;
  try { host = decodeURIComponent(m[1]); } catch { socket.destroy(); return; }
  const port = Number(m[2]);
  if (!host || port < 1 || port > 65535) { socket.destroy(); return; }

  const upstream = net.connect(port, host);
  let open = false;
  const closeBoth = () => {
    try { socket.destroy(); } catch { /* already gone */ }
    try { upstream.destroy(); } catch { /* already gone */ }
  };
  upstream.on("error", closeBoth);
  socket.on("error", closeBoth);
  socket.on("close", () => { try { upstream.destroy(); } catch { /* already gone */ } });
  upstream.on("close", () => { try { socket.destroy(); } catch { /* already gone */ } });

  upstream.on("connect", () => {
    const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    open = true;
    const feed = makeFrameFeeder({
      onPayload: (payload) => { if (!upstream.destroyed) upstream.write(payload); },
      onPing: (payload) => {
        // Pong: FIN + opcode 0xA, unmasked, same payload.
        const pong = Buffer.from(payload);
        const headBuf = pong.length < 126
          ? Buffer.from([0x8a, pong.length])
          : Buffer.from([0x8a, 126, (pong.length >> 8) & 0xff, pong.length & 0xff]);
        try { socket.write(Buffer.concat([headBuf, pong])); } catch { /* gone */ }
      },
      onClose: closeBoth,
    });
    if (head && head.length) feed(head);
    socket.on("data", feed);
    upstream.on("data", (chunk) => {
      if (!socket.destroyed) socket.write(encodeFrame(chunk));
    });
    if (!open) closeBoth();
  });
});

server.listen(PORT, () => {
  console.log(`fluid ws-proxy listening on :${PORT} (ws://.../<host>/<port> -> tcp host:port)`);
});
