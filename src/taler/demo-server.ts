// Runnable demo: one paid route, backed by the public GNU Taler demo merchant (KUDOS, no real money).
//   node src/taler/demo-server.ts
// Environment (all optional):
//   PORT=8402  PUBLIC_URL=http://127.0.0.1:8402  PRICE="KUDOS:0.1"  WAIT_MS=20000  STORE_PATH=.arvuna/store.sqlite
//   TALER_BACKEND=https://backend.demo.taler.net  TALER_INSTANCE=sandbox  TALER_PASSWORD=sandbox
// "sandbox" is the published password of the public demo instance, not a secret.
// The store (issued orders and consumption keys) is a SQLite file, so a restart does not forget which proofs were used.
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { MerchantClient } from "./merchant.ts";
import { Paywall, paywallHandler } from "./paywall.ts";
import { Store } from "./store.ts";

const port = Number(process.env["PORT"] ?? 8402);
const baseUrl = process.env["PUBLIC_URL"] ?? `http://127.0.0.1:${port}`;
const backend = process.env["TALER_BACKEND"] ?? "https://backend.demo.taler.net";
const storePath = process.env["STORE_PATH"] ?? ".arvuna/store.sqlite";
mkdirSync(dirname(storePath), { recursive: true });

const merchant = new MerchantClient({
  baseUrl: backend,
  instance: process.env["TALER_INSTANCE"] ?? "sandbox",
  auth: { kind: "password", password: process.env["TALER_PASSWORD"] ?? "sandbox" },
});
const store = new Store(storePath);
const paywall = new Paywall({
  merchant,
  store,
  price: process.env["PRICE"] ?? "KUDOS:0.1",
  secret: process.env["ARVUNA_SECRET"] ?? randomBytes(32).toString("hex"),
  realm: new URL(baseUrl).host,
  baseUrl,
  waitMs: Number(process.env["WAIT_MS"] ?? 20000),
  describe: (url) => `arvuna demo: ${new URL(url).pathname}`,
});

const paid = paywallHandler(paywall, (_req, res) => {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ message: "paid content", servedAt: new Date().toISOString() }));
});

createServer((req, res) => {
  if (req.url === "/health") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, backend }));
    return;
  }
  if (req.url?.startsWith("/api/quote")) {
    paid(req, res).catch((e) => {
      console.error(e);
      res.statusCode = 500;
      res.end();
    });
    return;
  }
  res.statusCode = 404;
  res.end("not found");
}).listen(port, "127.0.0.1", () => console.log(`arvuna demo on ${baseUrl}  paid route: /api/quote  backend: ${backend}  store: ${storePath}`));
