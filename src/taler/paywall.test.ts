import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { startFakeMerchant, type FakeMerchant } from "./fake-merchant.ts";
import { MerchantClient } from "./merchant.ts";
import { Paywall, paywallHandler } from "./paywall.ts";
import { parseWwwAuthenticate, challengeId } from "../common/challenge.ts";
import { b64Decode, b64Encode, b64urlDecode, b64urlEncode, jcs, utf8 } from "../common/encoding.ts";

let fm: FakeMerchant;
let srv: Server;
let base: string;
let clock = Date.now();
const SECRET = "unit-test-secret";

before(async () => {
  fm = await startFakeMerchant();
  const merchant = new MerchantClient({ baseUrl: fm.url, instance: "sandbox", auth: { kind: "password", password: "sandbox" }, timeoutMs: 3000 });
  // The server needs its own public URL before the Paywall is built, so bind first.
  srv = createServer();
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const pw = new Paywall({ merchant, price: "KUDOS:0.1", fractionalDigits: 2, secret: SECRET, realm: "arvuna.test", baseUrl: base, payWindowS: 600, now: () => clock });
  srv.on("request", (req, res) => {
    if (req.url?.startsWith("/free")) { res.end("free"); return; }
    void paywallHandler(pw, (_rq, rs) => { rs.setHeader("content-type", "application/json"); rs.end('{"secret":"the paid thing"}'); })(req, res);
  });
});
after(async () => { await fm.close(); srv.closeAllConnections(); srv.close(); });

const body = (r: Response) => r.json() as Promise<any>;
const get = (path: string, headers: Record<string, string> = {}, method = "GET") => fetch(base + path, { method, headers });
const ietfCred = (challenge: Record<string, unknown>, payload: Record<string, unknown>) => `Payment ${b64urlEncode(JSON.stringify({ challenge, payload }))}`;

/** Fetch a 402 and return the pieces both formats expose. */
async function challenge(path = "/api/quote") {
  const res = await get(path);
  assert.equal(res.status, 402);
  const www = parseWwwAuthenticate(res.headers.get("www-authenticate")!)[0]!;
  const echoed = Object.fromEntries(www.params.filter((p) => p.name !== "description").map((p) => [p.name, p.value]));
  const request = JSON.parse(utf8(b64urlDecode(www.map.get("request")!)!)!);
  const x = JSON.parse(utf8(b64Decode(res.headers.get("payment-required")!)!)!);
  return { res, www, echoed, request, x, orderId: request.methodDetails.orderId as string };
}

test("402 carries both formats, built from the merchant's order", async () => {
  const c = await challenge();
  assert.equal(c.res.headers.get("cache-control"), "no-store");
  assert.match(c.res.headers.get("content-type")!, /application\/problem\+json/);
  // IETF Payment
  assert.equal(c.www.scheme, "Payment");
  assert.equal(c.www.map.get("method"), "taler");
  assert.equal(c.www.map.get("intent"), "charge");
  assert.equal(c.www.map.get("realm"), "arvuna.test");
  assert.match(c.www.map.get("expires")!, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(c.request.amount, "10");
  assert.equal(c.request.currency, "kudos");
  assert.equal(c.request.externalId, c.orderId);
  assert.match(c.request.methodDetails.talerPayUri, /^taler:\/\/pay\//);
  assert.equal(b64urlEncode(jcs(c.request)), c.www.map.get("request"), "request is JCS-serialised");
  assert.equal(c.www.map.get("id"), challengeId(SECRET, { realm: "arvuna.test", method: "taler", intent: "charge", request: c.www.map.get("request")!, expires: c.www.map.get("expires")! }));
  // x402 v2
  assert.equal(c.x.x402Version, 2);
  assert.equal(c.x.resource.url, base + "/api/quote");
  const a = c.x.accepts[0];
  assert.deepEqual([a.scheme, a.network, a.amount, a.asset], ["exact", "taler:KUDOS", "10", "KUDOS"]);
  assert.equal(a.payTo, `${fm.url}/instances/sandbox`);
  assert.equal(a.extra.orderId, c.orderId);
  assert.equal(a.extra.talerPayUri, c.request.methodDetails.talerPayUri);
  assert.ok(a.maxTimeoutSeconds > 0 && a.maxTimeoutSeconds <= 600);
});

test("HEAD is gated like GET (no verb bypass)", async () => {
  const res = await get("/api/quote", {}, "HEAD");
  assert.equal(res.status, 402);
  assert.ok(res.headers.get("www-authenticate"));
});

test("unpaid order: IETF retry gets 402 verification-failed and the SAME order back", async () => {
  const c = await challenge();
  const res = await get("/api/quote", { authorization: ietfCred(c.echoed, { orderId: c.orderId }) });
  assert.equal(res.status, 402);
  assert.equal((await body(res)).type, "https://paymentauth.org/problems/verification-failed");
  const again = parseWwwAuthenticate(res.headers.get("www-authenticate")!)[0]!;
  assert.equal(JSON.parse(utf8(b64urlDecode(again.map.get("request")!)!)!).methodDetails.orderId, c.orderId);
});

test("paid order: IETF retry gets 200, a Payment-Receipt, and cannot be replayed", async () => {
  const c = await challenge();
  fm.pay(c.orderId);
  const cred = ietfCred(c.echoed, { orderId: c.orderId });
  const ok = await get("/api/quote", { authorization: cred });
  assert.equal(ok.status, 200);
  assert.equal((await body(ok)).secret, "the paid thing");
  assert.equal(ok.headers.get("cache-control"), "private");
  const receipt = JSON.parse(utf8(b64urlDecode(ok.headers.get("payment-receipt")!)!)!);
  assert.equal(receipt.status, "success");
  assert.equal(receipt.method, "taler");
  assert.equal(receipt.reference, c.orderId);
  assert.ok(!Number.isNaN(Date.parse(receipt.timestamp)));
  const replay = await get("/api/quote", { authorization: cred });
  assert.equal(replay.status, 402);
  assert.equal((await body(replay)).type, "https://paymentauth.org/problems/invalid-challenge");
});

test("paid order: x402 retry gets 200 and a PAYMENT-RESPONSE", async () => {
  const c = await challenge();
  fm.pay(c.orderId);
  const sig = b64Encode(JSON.stringify({ x402Version: 2, resource: c.x.resource, accepted: c.x.accepts[0], payload: { orderId: c.orderId } }));
  const ok = await get("/api/quote", { "payment-signature": sig });
  assert.equal(ok.status, 200);
  const r = JSON.parse(utf8(b64Decode(ok.headers.get("payment-response")!)!)!);
  assert.deepEqual([r.success, r.transaction, r.network], [true, c.orderId, "taler:KUDOS"]);
  const replay = await get("/api/quote", { "payment-signature": sig });
  assert.equal(replay.status, 402);
});

test("a credential cannot unlock a different resource", async () => {
  const c = await challenge("/api/quote");
  fm.pay(c.orderId);
  const res = await get("/api/other", { authorization: ietfCred(c.echoed, { orderId: c.orderId }) });
  assert.equal(res.status, 402);
  assert.equal((await body(res)).type, "https://paymentauth.org/problems/invalid-challenge");
});

test("tampering is rejected: altered request, wrong id, forged x402 amount", async () => {
  const c = await challenge();
  fm.pay(c.orderId);
  const cheaper = b64urlEncode(jcs({ ...c.request, amount: "1" }));
  let res = await get("/api/quote", { authorization: ietfCred({ ...c.echoed, request: cheaper }, { orderId: c.orderId }) });
  assert.equal((await body(res)).type, "https://paymentauth.org/problems/invalid-challenge");
  res = await get("/api/quote", { authorization: ietfCred({ ...c.echoed, id: "AAAA" }, { orderId: c.orderId }) });
  assert.equal(res.status, 402);
  const sig = b64Encode(JSON.stringify({ x402Version: 2, accepted: { ...c.x.accepts[0], amount: "1" }, payload: {} }));
  res = await get("/api/quote", { "payment-signature": sig });
  assert.equal((await body(res)).type, "https://paymentauth.org/problems/invalid-challenge");
  // the order was never redeemed by any of the above
  const ok = await get("/api/quote", { authorization: ietfCred(c.echoed, { orderId: c.orderId }) });
  assert.equal(ok.status, 200);
});

test("malformed credentials give malformed-credential with a fresh challenge", async () => {
  for (const authorization of ["Payment !!!notbase64", `Payment ${b64urlEncode("not json")}`, `Payment ${b64urlEncode("{}")}`]) {
    const res = await get("/api/quote", { authorization });
    assert.equal(res.status, 402);
    assert.equal((await body(res)).type, "https://paymentauth.org/problems/malformed-credential");
    assert.ok(res.headers.get("www-authenticate")?.startsWith("Payment "));
  }
  const res = await get("/api/quote", { "payment-signature": "%%%" });
  assert.equal((await body(res)).type, "https://paymentauth.org/problems/malformed-credential");
});

test("expired challenge: payment-expired, then a new order is issued", async () => {
  const c = await challenge();
  fm.pay(c.orderId);
  const real = clock;
  clock += 3_600_000;
  try {
    const res = await get("/api/quote", { authorization: ietfCred(c.echoed, { orderId: c.orderId }) });
    assert.equal(res.status, 402);
    assert.equal((await body(res)).type, "https://paymentauth.org/problems/payment-expired");
    const fresh = parseWwwAuthenticate(res.headers.get("www-authenticate")!)[0]!;
    assert.notEqual(JSON.parse(utf8(b64urlDecode(fresh.map.get("request")!)!)!).methodDetails.orderId, c.orderId);
  } finally {
    clock = real;
  }
});

test("a non-Payment Authorization header is just 'no credential'", async () => {
  const res = await get("/api/quote", { authorization: "Bearer abc" });
  assert.equal(res.status, 402);
  assert.equal((await body(res)).type, "https://paymentauth.org/problems/payment-required");
});

test("merchant backend down: 500 internal-payment-error, never a free resource", async () => {
  const c = await challenge();
  fm.pay(c.orderId);
  fm.failWith.status = 503;
  try {
    const res = await get("/api/quote", { authorization: ietfCred(c.echoed, { orderId: c.orderId }) });
    assert.equal(res.status, 500);
    assert.equal((await body(res)).type, "https://paymentauth.org/problems/internal-payment-error");
  } finally {
    fm.failWith.status = 0;
  }
  const ok = await get("/api/quote", { authorization: ietfCred(c.echoed, { orderId: c.orderId }) });
  assert.equal(ok.status, 200, "state was restored, so the paid order still redeems");
});

test("unprotected routes are untouched", async () => {
  assert.equal(await (await get("/free")).text(), "free");
});

// ---- the reference client, end to end against the same paywall -----------------------------------

import { payAndRetry } from "./client.ts";

for (const format of ["ietf", "x402"] as const) {
  test(`reference client pays and unlocks the resource (${format})`, async () => {
    const r = await payAndRetry(base + "/api/quote", format, async (c) => {
      assert.match(c.talerPayUri, /^taler:\/\/pay\//);
      fm.pay(c.orderId); // stands in for a Taler wallet paying the order
    });
    assert.equal(r.challengeStatus, 402);
    assert.equal(r.finalStatus, 200);
    assert.equal(JSON.parse(r.body).secret, "the paid thing");
    assert.ok(r.receipt, "a receipt header came back");
  });

  test(`reference client that does not pay stays locked (${format})`, async () => {
    const r = await payAndRetry(base + "/api/quote", format, async () => { /* wallet declined */ });
    assert.equal(r.finalStatus, 402);
    assert.equal(r.receipt, undefined);
  });
}
