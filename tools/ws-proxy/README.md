# Fluid WebSocket proxy (browser → Lightning peer transport)

Browsers cannot open raw TCP sockets. Lightning peers speak raw TCP
(BOLT 8 Noise, usually port 9735). This proxy is the bridge: the
browser opens a WebSocket to

```
wss://<proxy-host>/<peer-host>/<peer-port>
```

and the proxy opens a plain TCP connection to `<peer-host>:<peer-port>`
and carries bytes in both directions. It is the same operational
shape as `tools/notification-relay/`: one small Node file, standard
library only, no accounts, no database.

## Trust model — read this before deploying

- **The proxy sees only Noise-encrypted bytes.** A Lightning peer
  connection is an encrypted, authenticated Noise_XK session between
  the two nodes' keys (BOLT 8). The proxy carries ciphertext; it
  cannot read payment amounts, invoices, or channel state, and it
  cannot alter a single byte without the receiving node detecting it
  and dropping the connection.
- **It holds no keys and no funds.** There is nothing on the proxy to
  steal. It is not a custodian, a signer, or a router — it never
  appears in a route; it is a wire, not a hop.
- **Its worst failure is refusing to carry bytes.** A dead,
  compromised, or malicious proxy can drop or delay connections
  (a liveness failure — payments simply don't flow while it's down).
  It cannot redirect a payment, forge a message, or spend anything:
  every message it carries is authenticated end-to-end by the two
  nodes it connects.
- **It is an open relay by design** (any host:port path is carried),
  like the peer connections themselves are permissionless. It logs
  nothing about payloads (there is nothing readable to log) — only
  socket-level errors to stderr. Rate-limit at your edge if abuse
  (connection floods) ever matters; a flooded proxy is, again, only a
  liveness problem.

Running it is therefore an ops decision about *liveness*, not a
trust decision about funds. Fluid points the app at a deployed
instance by setting `LN_DEFAULT_WS_PROXY` in `src/lightning-node.js`
to the proxy's URL template, e.g. `wss://proxy.example.com/{host}/{port}`.
Until that constant is set, the panel's peer features work only with
peers that serve their own `wss://` endpoints, or with a proxy
template the user sets themselves under the panel's Advanced section.

## Run

```sh
PORT=8788 node server.mjs
```

Put a TLS terminator (Caddy, nginx, a PaaS) in front: browsers will
only open `wss://` sockets from an `https://` page. Any host that can
run a single Node file and terminate TLS can host it.
