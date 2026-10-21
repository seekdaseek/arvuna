import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { startFakeMerchant, MASTER_A, MASTER_B, VECTOR, type FakeMerchant } from "./fake-merchant.ts";
import { MerchantClient } from "./merchant.ts";
import { Paywall, paywallHandler } from "./paywall.ts";
import { Store } from "./store.ts";
import { payAndRetry } from "./client.ts";
import { parsePayUri } from "./payuri.ts";
import { amountMismatch, parseAmount } from "./amount.ts";
import { parseWwwAuthenticate, challengeId } from "../common/challenge.ts";
import { b64Decode, b64Encode, b64urlDecode, b64urlEncode, jcs, utf8 } from "../common/encoding.ts";

const SECRET = "unit-test-secret";
const NET_A = `taler:${MASTER_A.slice(0, 32)}`;
const NET_B = `taler:${MASTER_B.slice(0, 32)}`;

interface H {
  fm: FakeMerchant;
  store: Store;
  pw: Paywall;
  base: string;
  clock: { t: number };
  storePath: string | undefined;
  get(path: string, headers?: Record<string, string>, method?: string): Promise<Response>;
  /** Opens the store again from its file and builds a new Paywall on it: a process restart. */
  restart(): void;
  close(): Promise<void>;
}

const open: H[] = [];
afterEach(async () => {
  for (const h of open.splice(0)) await h.close();
});

async function harness(over: { price?: string; storePath?: string; configure?: (fm: FakeMerchant) => void } = {}): Promise<H> {
  const fm = await startFakeMerchant();
  over.configure?.(fm);
  const merchant = new MerchantClient({ baseUrl: fm.url, instance: "sandbox", auth: { kind: "password", password: "sandbox" }, timeoutMs: 3000 });
  const clock = { t: Date.now() };
  const srv: Server = createServer();
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const make = (store: Store) =>
    new Paywall({ merchant, store, price: over.price ?? "KUDOS:0.1", secret: SECRET, realm: "arvuna.test", baseUrl: base, payWindowS: 600, refundWindowS: 3600, fetch: fm.fetchViaHttp, now: () => clock.t });
  const h: H = {
    fm, base, clock, storePath: over.storePath,
    store: new Store(over.storePath),
    pw: undefined as unknown as Paywall,
    get: (path, headers = {}, method = "GET") => fetch(base + path, { method, headers }),
    restart() {
      h.store.close();
      h.store = new Store(over.storePath);
      h.pw = make(h.store);
    },
    close: async () => { await fm.close(); srv.closeAllConnections(); srv.close(); try { h.store.close(); } catch { /* closed */ } },
  };
  h.pw = make(h.store);
  srv.on("request", (req, res) => {
    if (req.url?.startsWith("/free")) { res.end("free"); return; }
    void paywallHandler(h.pw, (_rq, rs) => { rs.setHeader("content-type", "application/json"); rs.end('{"secret":"the paid thing"}'); })(req, res);
  });
  open.push(h);
  return h;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const J = (r: Response) => r.json() as Promise<any>;

/** Fetches a 402 and returns the pieces both formats expose. */
async function challenge(h: H, path = "/api/quote") {
  const res = await h.get(path);
  assert.equal(res.status, 402);
  const www = parseWwwAuthenticate(res.headers.get("www-authenticate")!)[0]!;
  const echoed = Object.fromEntries(www.params.filter((p) => p.name !== "description").map((p) => [p.name, p.value]));
  const request = JSON.parse(utf8(b64urlDecode(www.map.get("request")!)!)!);
  const x = JSON.parse(utf8(b64Decode(res.headers.get("payment-required")!)!)!);
  return { res, www, echoed, request, x, accepts: x.accepts as Record<string, unknown>[], orderId: request.methodDetails.orderId as string };
}
type C = Awaited<ReturnType<typeof challenge>>;

const ietfCred = (c: C, payload: Record<string, unknown> = { orderId: c.orderId }, echoed: Record<string, unknown> = c.echoed) =>
  `Payment ${b64urlEncode(JSON.stringify({ challenge: echoed, payload }))}`;
const xsig = (c: C, hContract: string, o: { accepted?: unknown; payload?: unknown } = {}) =>
  b64Encode(JSON.stringify({ x402Version: 2, resource: c.x.resource, accepted: o.accepted ?? c.accepts[0], payload: o.payload ?? { orderId: c.orderId, hContract } }));
const reasonOf = (r: Response) => {
  const hdr = r.headers.get("payment-response");
  return hdr ? (JSON.parse(utf8(b64Decode(hdr)!)!) as { errorReason?: string }).errorReason : undefined;
};
const iso = (s: number) => new Date(s * 1000).toISOString().replace(/\.\d+Z$/, "Z");
const A103 = "A".repeat(103);

// ---- the 402 itself ---------------------------------------------------------------------------

test("402 carries both formats, built from the merchant's order; gaps 1, 2, 3, 7, 9, 11", async () => {
  const h = await harness();
  const c = await challenge(h);
  assert.equal(c.res.headers.get("cache-control"), "no-store");
  // IETF Payment
  assert.equal(c.www.map.get("method"), "taler");
  assert.equal(c.www.map.get("intent"), "charge");
  assert.equal(c.www.map.get("id"), challengeId(SECRET, { realm: "arvuna.test", method: "taler", intent: "charge", request: c.www.map.get("request")!, expires: c.www.map.get("expires")! }));
  assert.equal(b64urlEncode(jcs(c.request)), c.www.map.get("request"), "request is JCS-serialised");
  assert.equal(c.request.amount, "10000000", "-03: KUDOS:0.1 in base units of 10^-8");
  assert.equal(c.request.currency, "kudos");
  const md = c.request.methodDetails;
  assert.deepEqual(md.exchanges, [{ url: `${h.fm.url}/exchange-a/`, masterPub: MASTER_A }], "gap 1: only the exchange for this currency, as {url, masterPub}");
  assert.equal(md.merchantBaseUrl, `https://${h.fm.host}/instances/sandbox/`);
  assert.equal(md.talerAmount, "KUDOS:0.1", "-03: methodDetails.talerAmount is the Taler amount string, currency spelled as the order has it");
  assert.deepEqual(parsePayUri(md.talerPayUri).orderId, md.orderId);
  // x402
  assert.equal(c.x.x402Version, 2);
  assert.equal(c.accepts.length, 1);
  const a = c.accepts[0]!;
  assert.deepEqual([a["scheme"], a["network"], a["amount"], a["asset"]], ["exact", NET_A, "10000000", "KUDOS"], "gap 2: network is taler: + first 32 characters of the master key");
  assert.equal(a["payTo"], `https://${h.fm.host}/instances/sandbox/`, "gap 11: the merchant base URL, trailing slash included");
  assert.equal(a["payTo"], parsePayUri((a["extra"] as { talerPayUri: string }).talerPayUri).merchantBaseUrl);
  assert.deepEqual(a["extra"], { paymentFlow: "upfront", talerAmount: "KUDOS:0.1", talerPayUri: md.talerPayUri }, "gap 3: paymentFlow upfront, extra.talerAmount (-03), and no extra.orderId");
});

test("gap 2: one accepts[] entry per listed exchange; each network is accepted, an unlisted one is not", async () => {
  const h = await harness({ configure: (fm) => { fm.exchanges.push({ path: "/exchange-b", masterPub: MASTER_B, currency: "KUDOS", digits: 2 }); } });
  const c = await challenge(h);
  assert.deepEqual(c.accepts.map((a) => a["network"]), [NET_A, NET_B]);
  assert.equal(new Set(c.accepts.map((a) => (a["extra"] as { talerPayUri: string }).talerPayUri)).size, 1, "all entries name the same order");
  assert.equal(c.request.methodDetails.exchanges.length, 2);
  const hc = h.fm.pay(c.orderId);
  const ok = await h.get("/api/quote", { "payment-signature": xsig(c, hc, { accepted: c.accepts[1] }) });
  assert.equal(ok.status, 200, "the second exchange's entry settles");
  assert.equal(JSON.parse(utf8(b64Decode(ok.headers.get("payment-response")!)!)!).network, NET_B);
  assert.ok(h.store.hasConsumed(`${NET_B}:${c.orderId}`), "gap 5: the consumption key is network + \":\" + orderId");
  const c2 = await challenge(h);
  const hc2 = h.fm.pay(c2.orderId);
  const bad = await h.get("/api/quote", { "payment-signature": xsig(c2, hc2, { accepted: { ...c2.accepts[0], network: "taler:ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ" } }) });
  assert.equal(reasonOf(bad), "invalid_exact_taler_network");
});

test("gap 3: a requirement without paymentFlow upfront is refused", async () => {
  const h = await harness();
  const c = await challenge(h);
  const hc = h.fm.pay(c.orderId);
  const a0 = c.accepts[0] as { extra: Record<string, unknown> };
  for (const extra of [{ talerPayUri: a0.extra["talerPayUri"] }, { ...a0.extra, paymentFlow: "authorization" }]) {
    const r = await h.get("/api/quote", { "payment-signature": xsig(c, hc, { accepted: { ...a0, extra } }) });
    assert.equal(r.status, 402);
    assert.equal(reasonOf(r), "invalid_exact_taler_payment_flow");
  }
});

// ---- x402 settle: gap 4, 5, 12 ------------------------------------------------------------------

test("gap 4: x402 settles on {orderId, hContract} with the PUBLIC order status and no credential; the receipt has no payer", async () => {
  const h = await harness();
  const c = await challenge(h);
  const hc = h.fm.pay(c.orderId);
  const ok = await h.get("/api/quote", { "payment-signature": xsig(c, hc) });
  assert.equal(ok.status, 200);
  assert.equal((await J(ok)).secret, "the paid thing");
  assert.equal(ok.headers.get("cache-control"), "private");
  const r = JSON.parse(utf8(b64Decode(ok.headers.get("payment-response")!)!)!);
  assert.deepEqual(r, { success: true, transaction: c.orderId, network: NET_A, amount: "10000000" });
  assert.equal("payer" in r, false, "Taler does not reveal the payer");
  const pub = h.fm.publicRequests.filter((q) => q.query.includes(`h_contract=${hc}`));
  assert.ok(pub.length >= 1, "the contract hash the client presented was sent to the merchant");
  assert.equal(pub.every((q) => !q.hadAuthorization), true, "the public status request carried no Authorization header");
});

test("gap 5: the proof is single-use across formats and concurrent presentations", async () => {
  const h = await harness();
  // x402 then x402
  const c = await challenge(h);
  const hc = h.fm.pay(c.orderId);
  const sig = xsig(c, hc);
  assert.equal((await h.get("/api/quote", { "payment-signature": sig })).status, 200);
  const again = await h.get("/api/quote", { "payment-signature": sig });
  assert.equal(again.status, 402);
  assert.equal(reasonOf(again), "duplicate_settlement");
  // x402 then IETF credential for the same order
  const cross = await h.get("/api/quote", { authorization: ietfCred(c) });
  assert.equal(cross.status, 402);
  assert.equal((await J(cross)).type, "https://paymentauth.org/problems/invalid-challenge");
  // IETF then x402
  const d = await challenge(h);
  const hd = h.fm.pay(d.orderId);
  assert.equal((await h.get("/api/quote", { authorization: ietfCred(d) })).status, 200);
  assert.equal(reasonOf(await h.get("/api/quote", { "payment-signature": xsig(d, hd) })), "duplicate_settlement");
  // two presentations at once: exactly one wins
  const e = await challenge(h);
  const he = h.fm.pay(e.orderId);
  const rs = await Promise.all([1, 2, 3].map(() => h.get("/api/quote", { "payment-signature": xsig(e, he) })));
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 402, 402]);
});

test("gap 5: a restart does not forget a used proof (file-backed store, claimed, restarted, presented again)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arvuna-restart-"));
  try {
    const h = await harness({ storePath: join(dir, "store.sqlite") });
    const c = await challenge(h);
    const hc = h.fm.pay(c.orderId);
    const sig = xsig(c, hc);
    assert.equal((await h.get("/api/quote", { "payment-signature": sig })).status, 200);
    h.restart(); // new process: new store connection, new Paywall, nothing in memory
    const again = await h.get("/api/quote", { "payment-signature": sig });
    assert.equal(again.status, 402);
    assert.equal(reasonOf(again), "duplicate_settlement", "the duplicate error, not an unknown-order error");
    // and an order issued before the restart can still be paid and redeemed afterwards
    const d = await challenge(h);
    h.restart();
    const hd = h.fm.pay(d.orderId);
    assert.equal((await h.get("/api/quote", { "payment-signature": xsig(d, hd) })).status, 200);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gap 12: every settlement error reason is produced, with the right cause", async () => {
  const h = await harness();
  const seen = new Set<string>();
  const expectReason = async (reason: string, mk: () => Promise<{ c: C; hc: string; over?: { accepted?: unknown; payload?: unknown } }>) => {
    const { c, hc, over } = await mk();
    const r = await h.get("/api/quote", { "payment-signature": xsig(c, hc, over) });
    assert.equal(reasonOf(r), reason, reason);
    assert.equal(r.status, 402, reason);
    assert.equal((await J(r)).reason, reason);
    seen.add(reason);
  };
  const a0 = (c: C) => c.accepts[0] as { extra: Record<string, unknown> };
  await expectReason("invalid_exact_taler_payment_flow", async () => { const c = await challenge(h); return { c, hc: h.fm.pay(c.orderId), over: { accepted: { ...a0(c), extra: { talerPayUri: a0(c).extra["talerPayUri"] } } } }; });
  await expectReason("invalid_exact_taler_order_mismatch", async () => { const c = await challenge(h); return { c, hc: h.fm.pay(c.orderId), over: { accepted: { ...a0(c), extra: { ...a0(c).extra, talerAmount: "KUDOS:0.01" } } } }; }); // -03: a tampered talerAmount
  await expectReason("invalid_exact_taler_network", async () => { const c = await challenge(h); return { c, hc: h.fm.pay(c.orderId), over: { accepted: { ...a0(c), network: "taler:ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ" } } }; });
  await expectReason("invalid_exact_taler_order_mismatch", async () => { const c = await challenge(h); return { c, hc: h.fm.pay(c.orderId), over: { accepted: { ...a0(c), amount: "1" } } }; });
  await expectReason("invalid_exact_taler_order_mismatch", async () => { const c = await challenge(h); return { c, hc: h.fm.pay(c.orderId), over: { payload: { orderId: "someone-else", hContract: A103 } } }; });
  await expectReason("invalid_exact_taler_h_contract_malformed", async () => { const c = await challenge(h); h.fm.pay(c.orderId); return { c, hc: "too-short" }; });
  await expectReason("invalid_exact_taler_h_contract_malformed", async () => { const c = await challenge(h); h.fm.pay(c.orderId); return { c, hc: "x", over: { payload: { orderId: c.orderId } } }; });
  await expectReason("invalid_exact_taler_order_unpaid", async () => { const c = await challenge(h); return { c, hc: h.fm.claim(c.orderId) }; }); // claimed, not paid
  await expectReason("invalid_exact_taler_h_contract_mismatch", async () => { const c = await challenge(h); h.fm.pay(c.orderId); return { c, hc: A103 }; });
  await expectReason("invalid_exact_taler_order_unknown", async () => { const c = await challenge(h); const hc = h.fm.pay(c.orderId); h.fm.forget(c.orderId); return { c, hc }; });
  { // merchantSig present and wrong: the real vector's signature, presented for a contract hash it does not sign
    const c = await challenge(h); const hc = h.fm.pay(c.orderId);
    const r = await h.get("/api/quote", { "payment-signature": xsig(c, hc, { payload: { orderId: c.orderId, hContract: hc, merchantSig: VECTOR.merchantSig } }) });
    assert.equal(reasonOf(r), "invalid_exact_taler_merchant_sig"); assert.equal(r.status, 402); seen.add("invalid_exact_taler_merchant_sig");
  }
  { // duplicate
    const c = await challenge(h); const hc = h.fm.pay(c.orderId);
    assert.equal((await h.get("/api/quote", { "payment-signature": xsig(c, hc) })).status, 200);
    const r = await h.get("/api/quote", { "payment-signature": xsig(c, hc) });
    assert.equal(reasonOf(r), "duplicate_settlement"); seen.add("duplicate_settlement");
  }
  { // expired: the pay deadline has passed
    const c = await challenge(h); const hc = h.fm.pay(c.orderId);
    h.clock.t += 3_600_000;
    const r = await h.get("/api/quote", { "payment-signature": xsig(c, hc) });
    assert.equal(reasonOf(r), "invalid_exact_taler_order_expired"); seen.add("invalid_exact_taler_order_expired");
    h.clock.t -= 3_600_000;
  }
  { // the merchant backend cannot be asked: fail closed, 500
    const c = await challenge(h); const hc = h.fm.pay(c.orderId);
    h.fm.failWith.status = 503;
    const r = await h.get("/api/quote", { "payment-signature": xsig(c, hc) });
    h.fm.failWith.status = 0;
    assert.equal(r.status, 500);
    assert.equal(reasonOf(r), "invalid_exact_taler_backend_error"); seen.add("invalid_exact_taler_backend_error");
    // nothing was consumed: the same proof works once the backend is back
    assert.equal((await h.get("/api/quote", { "payment-signature": xsig(c, hc) })).status, 200);
  }
  assert.deepEqual([...seen].sort(), [
    "duplicate_settlement", "invalid_exact_taler_backend_error", "invalid_exact_taler_h_contract_malformed", "invalid_exact_taler_h_contract_mismatch",
    "invalid_exact_taler_merchant_sig", "invalid_exact_taler_network", "invalid_exact_taler_order_expired", "invalid_exact_taler_order_mismatch", "invalid_exact_taler_order_unknown",
    "invalid_exact_taler_order_unpaid", "invalid_exact_taler_payment_flow",
  ]);
});

test("an unpaid proof does not consume anything: the order can still be paid and settled afterwards", async () => {
  const h = await harness();
  const c = await challenge(h);
  const hc = h.fm.claim(c.orderId);
  const early = await h.get("/api/quote", { "payment-signature": xsig(c, hc) });
  assert.equal(reasonOf(early), "invalid_exact_taler_order_unpaid");
  assert.equal(h.store.hasConsumed(`${NET_A}:${c.orderId}`), false);
  // the 402 offers the SAME order again, with a fresh requirement
  const again = JSON.parse(utf8(b64Decode(early.headers.get("payment-required")!)!)!);
  assert.equal(again.accepts[0].extra.talerPayUri, (c.accepts[0]!["extra"] as { talerPayUri: string }).talerPayUri);
  h.fm.pay(c.orderId);
  assert.equal((await h.get("/api/quote", { "payment-signature": xsig(c, hc) })).status, 200);
});

// ---- IETF Payment format -------------------------------------------------------------------------

test("IETF: unpaid gets 402 verification-failed and the SAME order back; paid gets 200, a receipt, and no replay", async () => {
  const h = await harness();
  const c = await challenge(h);
  const early = await h.get("/api/quote", { authorization: ietfCred(c) });
  assert.equal(early.status, 402);
  assert.equal((await J(early)).type, "https://paymentauth.org/problems/verification-failed");
  const back = parseWwwAuthenticate(early.headers.get("www-authenticate")!)[0]!;
  assert.equal(JSON.parse(utf8(b64urlDecode(back.map.get("request")!)!)!).methodDetails.orderId, c.orderId);
  h.fm.pay(c.orderId);
  const ok = await h.get("/api/quote", { authorization: ietfCred(c) });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "private");
  const receipt = JSON.parse(utf8(b64urlDecode(ok.headers.get("payment-receipt")!)!)!);
  assert.deepEqual([receipt.status, receipt.method, receipt.reference], ["success", "taler", c.orderId]);
  assert.equal(receipt.timestamp, iso(h.fm.orders.get(c.orderId)!.lastPaymentS), "the receipt time is the merchant's last_payment");
  const replay = await h.get("/api/quote", { authorization: ietfCred(c) });
  assert.equal(replay.status, 402);
  assert.equal((await J(replay)).type, "https://paymentauth.org/problems/invalid-challenge");
});

test("IETF: tampering, another resource, malformed credentials and other schemes are all refused", async () => {
  const h = await harness();
  const c = await challenge(h);
  h.fm.pay(c.orderId);
  const cheaper = b64urlEncode(jcs({ ...c.request, amount: "1" }));
  let r = await h.get("/api/quote", { authorization: ietfCred(c, undefined, { ...c.echoed, request: cheaper }) });
  assert.equal((await J(r)).type, "https://paymentauth.org/problems/invalid-challenge");
  r = await h.get("/api/quote", { authorization: ietfCred(c, undefined, { ...c.echoed, id: "AAAA" }) });
  assert.equal(r.status, 402);
  r = await h.get("/api/other", { authorization: ietfCred(c) });
  assert.equal((await J(r)).type, "https://paymentauth.org/problems/invalid-challenge", "a credential cannot unlock another resource");
  for (const authorization of ["Payment !!!notbase64", `Payment ${b64urlEncode("not json")}`, `Payment ${b64urlEncode("{}")}`]) {
    r = await h.get("/api/quote", { authorization });
    assert.equal((await J(r)).type, "https://paymentauth.org/problems/malformed-credential");
  }
  r = await h.get("/api/quote", { authorization: "Bearer abc" });
  assert.equal((await J(r)).type, "https://paymentauth.org/problems/payment-required");
  r = await h.get("/api/quote", { "payment-signature": "%%%" });
  assert.equal(r.status, 400, "-03: an x402 payload that is not a PaymentPayload is Invalid Payment, 400 in the x402 HTTP transport");
  assert.equal(r.headers.get("payment-response"), null, "it is not a settlement, so there is no PAYMENT-RESPONSE");
  assert.equal((await J(r)).type, "https://paymentauth.org/problems/malformed-credential");
  for (const bad of [{ x402Version: 1 }, { x402Version: 2, accepted: {} }, { x402Version: 2, payload: {} }]) {
    assert.equal((await h.get("/api/quote", { "payment-signature": b64Encode(JSON.stringify(bad)) })).status, 400);
  }
  assert.equal((await h.get("/api/quote", { authorization: ietfCred(c) })).status, 200, "none of the above consumed the order");
});

test("IETF: an expired challenge is payment-expired and a new order is issued; HEAD is gated like GET", async () => {
  const h = await harness();
  assert.equal((await h.get("/api/quote", {}, "HEAD")).status, 402);
  const c = await challenge(h);
  h.fm.pay(c.orderId);
  h.clock.t += 3_600_000;
  const r = await h.get("/api/quote", { authorization: ietfCred(c) });
  assert.equal((await J(r)).type, "https://paymentauth.org/problems/payment-expired");
  const fresh = parseWwwAuthenticate(r.headers.get("www-authenticate")!)[0]!;
  assert.notEqual(JSON.parse(utf8(b64urlDecode(fresh.map.get("request")!)!)!).methodDetails.orderId, c.orderId);
});

test("IETF: the merchant backend down gives 500 and never a free resource; state is kept", async () => {
  const h = await harness();
  const c = await challenge(h);
  h.fm.pay(c.orderId);
  h.fm.failWith.status = 503;
  const r = await h.get("/api/quote", { authorization: ietfCred(c) });
  h.fm.failWith.status = 0;
  assert.equal(r.status, 500);
  assert.equal((await J(r)).type, "https://paymentauth.org/problems/internal-payment-error");
  assert.equal((await h.get("/api/quote", { authorization: ietfCred(c) })).status, 200);
});

test("IETF: an order refunded in full is not honoured", async () => {
  const h = await harness();
  const c = await challenge(h);
  h.fm.pay(c.orderId);
  h.fm.setRefund(c.orderId, "KUDOS:0.1");
  const r = await h.get("/api/quote", { authorization: ietfCred(c) });
  assert.equal(r.status, 402);
  assert.match((await J(r)).detail, /refunded in full/);
});

test("unprotected routes are untouched", async () => {
  const h = await harness();
  assert.equal(await (await h.get("/free")).text(), "free");
});

// ---- the other gaps ---------------------------------------------------------------------------------

test("gap 6: a paid contract that names an exchange the challenge did not list is refused, in both formats", async () => {
  const h = await harness({ configure: (fm) => { fm.contractExchanges = [{ url: "http://elsewhere.example/", master_pub: "Q".repeat(52) }]; } });
  const c = await challenge(h);
  const hc = h.fm.pay(c.orderId);
  const i = await h.get("/api/quote", { authorization: ietfCred(c) });
  assert.equal(i.status, 402);
  assert.match((await J(i)).detail, /exchange that the challenge did not list/);
  const x = await h.get("/api/quote", { "payment-signature": xsig(c, hc) });
  assert.equal(reasonOf(x), "invalid_exact_taler_order_mismatch");
  assert.equal(h.store.hasConsumed(`${NET_A}:${c.orderId}`), false, "nothing was consumed");
  // the same order, with the contract listing only listed exchanges, goes through
  h.fm.contractExchanges = [{ url: `${h.fm.url}/exchange-a/`, master_pub: MASTER_A }];
  assert.equal((await h.get("/api/quote", { "payment-signature": xsig(c, hc) })).status, 200);
});

test("gap 7: orders are created with create_token on, and the claim token travels only inside the Taler Pay URI", async () => {
  const h = await harness();
  const c = await challenge(h);
  assert.deepEqual(h.fm.createToken, [true]);
  const token = h.fm.orders.get(c.orderId)!.token!;
  assert.ok(token.length >= 20);
  const uri = c.request.methodDetails.talerPayUri as string;
  assert.equal(parsePayUri(uri).claimToken, token, "the pay URI carries the token as c");
  // everything the client receives, with the pay URI removed, contains no trace of the token
  const everything = [c.res.headers.get("www-authenticate"), utf8(b64urlDecode(c.www.map.get("request")!)!), utf8(b64Decode(c.res.headers.get("payment-required")!)!), JSON.stringify(c.x), JSON.stringify(c.request)].join("\n");
  assert.ok(everything.includes(token), "sanity: the token is in the response");
  assert.equal(everything.split(uri).join("").includes(token), false);
});

test("gap 8: fulfillment_url uses the ${ORDER_ID} placeholder, so every order's URL is its own; the refund deadline is explicit", async () => {
  const h = await harness();
  const a = await challenge(h);
  const b = await challenge(h);
  assert.notEqual(a.orderId, b.orderId);
  for (const c of [a, b]) {
    const o = h.fm.orders.get(c.orderId)!;
    assert.equal(o.fulfillmentTemplate, `${h.base}/api/quote?order=\${ORDER_ID}`, "the template sent to the merchant");
    assert.equal(o.fulfillmentUrl, `${h.base}/api/quote?order=${c.orderId}`, "what the merchant stored");
    assert.equal(o.fulfillmentUrl.includes("arvuna_order"), false);
    assert.equal(o.refundDeadlineS, o.payDeadlineS + 3600, "gap: an explicit refund deadline, not the backend default");
  }
  assert.notEqual(h.fm.orders.get(a.orderId)!.fulfillmentUrl, h.fm.orders.get(b.orderId)!.fulfillmentUrl);
});

test("-03 amount: the unit is always 10^-8 and no exchange or /config currency specification is consulted", async () => {
  // the fake exchange publishes 2 digits and /config carries a decoy of 3; neither may change the amount
  let h = await harness();
  assert.equal((await challenge(h)).request.amount, "10000000");
  await h.close(); open.pop();
  for (const digits of [0, 3, null]) {
    h = await harness({ configure: (fm) => { fm.exchanges[0]!.digits = digits; } });
    assert.equal((await challenge(h)).request.amount, "10000000", `exchange digits ${digits}`);
    await h.close(); open.pop();
  }
  h = await harness({ price: "KUDOS:0.001" });
  const c = await challenge(h);
  assert.equal(c.request.amount, "100000", "a fine amount needs no refusal any more: 0.001 KUDOS is 100000 units");
  assert.equal(c.request.methodDetails.talerAmount, "KUDOS:0.001");
  await h.close(); open.pop();
  h = await harness({ price: "KUDOS:1" });
  assert.equal((await challenge(h)).request.amount, "100000000", "one whole unit of any currency is 10^8");
  await h.close(); open.pop();
  assert.throws(() => parseAmount("KUDOS:abc"), /invalid Taler amount/, "a price that is not a Taler amount is refused when the paywall is built");
});

test("-03 amount: the client refuses to pay when amount and talerAmount differ, in either format", async () => {
  for (const format of ["ietf", "x402"] as const) {
    // a server that lies: it rewrites the 402 so the base-unit amount no longer matches talerAmount
    const h = await harness();
    const liar = createServer(async (rq, rs) => {
      const up = await fetch(h.base + "/api/quote");
      const hdrs: Record<string, string> = { "content-type": "application/problem+json" };
      const www = up.headers.get("www-authenticate")!;
      const xr = up.headers.get("payment-required")!;
      const x = JSON.parse(utf8(b64Decode(xr)!)!);
      x.accepts[0].amount = "1";
      hdrs["payment-required"] = b64Encode(jcs(x));
      const w = parseWwwAuthenticate(www)[0]!;
      const req = JSON.parse(utf8(b64urlDecode(w.map.get("request")!)!)!);
      req.amount = "1";
      hdrs["www-authenticate"] = www.replace(w.map.get("request")!, b64urlEncode(jcs(req)));
      rs.writeHead(402, hdrs); rs.end("{}"); void rq;
    });
    await new Promise<void>((r) => liar.listen(0, "127.0.0.1", r));
    let paid = false;
    try {
      await assert.rejects(
        payAndRetry(`http://127.0.0.1:${(liar.address() as AddressInfo).port}/`, format, async () => { paid = true; }),
        /refusing to pay: amount differs from talerAmount/,
      );
      assert.equal(paid, false, "the wallet was never asked to pay");
    } finally {
      liar.closeAllConnections(); liar.close();
    }
  }
});

test("-03 amount: amountMismatch compares exact decimals and currencies", () => {
  assert.equal(amountMismatch("10000000", "kudos", "KUDOS:0.1"), undefined);
  assert.equal(amountMismatch("100000000", "eur", "EUR:1"), undefined);
  assert.equal(amountMismatch("100000000", "eur", "EUR:1.00000000"), undefined);
  assert.equal(amountMismatch("10000001", "kudos", "KUDOS:0.1"), "amount differs from talerAmount");
  assert.equal(amountMismatch("10000000", "eur", "KUDOS:0.1"), "currency differs from talerAmount");
  assert.equal(amountMismatch("10000000", "kudos", undefined), "talerAmount is missing");
  assert.equal(amountMismatch("0.1", "kudos", "KUDOS:0.1"), "amount is not a decimal integer string");
  assert.equal(amountMismatch("010000000", "kudos", "KUDOS:0.1"), "amount is not a decimal integer string");
  assert.equal(amountMismatch("1", "kudos", "KUDOS:0.100000001"), "talerAmount is not a Taler amount", "more than 8 fractional digits");
  assert.equal(amountMismatch("1", "kudos", "KUDOS:4503599627370497"), "talerAmount is not a Taler amount", "integer part above 2^52");
  assert.equal(amountMismatch("1", "kudos", "KUDOS:1."), "talerAmount is not a Taler amount");
  assert.equal(amountMismatch("1", "kudos", "KUDOS:.1"), "talerAmount is not a Taler amount");
  assert.equal(amountMismatch("1", "kudos", "A:B:1.5"), "talerAmount is not a Taler amount");
  assert.equal(amountMismatch("1", "kud0s", "KUD0S:0.00000001"), "talerAmount is not a Taler amount", "the currency is ASCII letters only");
  assert.equal(amountMismatch("1", "abcdefghijkl", "ABCDEFGHIJKL:0.00000001"), "talerAmount is not a Taler amount", "twelve letters are one too many");
  assert.equal(amountMismatch("450359962737049600000000", "eur", "EUR:4503599627370496"), undefined, "2^52 itself is allowed");
  assert.equal(amountMismatch("1", "kudos", "KUDOS:1,000"), "talerAmount is not a Taler amount", "the Taler grammar has no commas (RFC 8905 would ignore them)");
});

test("-03 merchantSig: a real merchant signature verifies; the same signature on another hash, key or byte does not", async () => withSigHarness(async (h) => {
  // wiring: the order reports the real contract hash, and the contract names the real merchant key
  const c = await challenge(h);
  h.fm.pay(c.orderId); h.fm.useContractHash(c.orderId, VECTOR.hContract);
  const sigHeader = (merchantSig: unknown) => xsig(c, VECTOR.hContract, { payload: { orderId: c.orderId, hContract: VECTOR.hContract, ...(merchantSig === undefined ? {} : { merchantSig }) } });
  const flip = VECTOR.merchantSig.slice(0, 40) + (VECTOR.merchantSig[40] === "0" ? "1" : "0") + VECTOR.merchantSig.slice(41);
  for (const bad of [flip, "A".repeat(103), VECTOR.merchantSig.slice(1), 5]) {
    const r = await h.get("/api/quote", { "payment-signature": sigHeader(bad) });
    assert.equal(r.status, 402);
    assert.equal(reasonOf(r), "invalid_exact_taler_merchant_sig", String(bad).slice(0, 12));
  }
  assert.equal(h.store.getIssued(c.orderId)!.redeemed, false, "a bad signature consumes nothing");
  const ok = await h.get("/api/quote", { "payment-signature": sigHeader(VECTOR.merchantSig) });
  assert.equal(ok.status, 200, "the real signature, over the real hash, under the real key");
  assert.equal(reasonOf(await h.get("/api/quote", { "payment-signature": sigHeader(VECTOR.merchantSig) })), "duplicate_settlement");
}));

test("-03 merchantSig: absent means the -02 path; present does not replace the public status read", async () => withSigHarness(async (h) => {
  const c = await challenge(h);
  const hc = h.fm.pay(c.orderId);
  assert.equal((await h.get("/api/quote", { "payment-signature": xsig(c, hc) })).status, 200, "no merchantSig: settles on the public read");
  // a real signature for ANOTHER contract of the same merchant, presented under this order: it verifies, but the public read says 403
  const d = await challenge(h);
  h.fm.pay(d.orderId);
  const r = await h.get("/api/quote", { "payment-signature": xsig(d, VECTOR.hContract, { payload: { orderId: d.orderId, hContract: VECTOR.hContract, merchantSig: VECTOR.merchantSig } }) });
  assert.equal(reasonOf(r), "invalid_exact_taler_h_contract_mismatch", "the signature does not bind the contract hash to this order; the public read does");
  assert.equal(h.store.getIssued(d.orderId)!.redeemed, false);
}));

async function withSigHarness(body: (h: H) => Promise<void>) {
  await body(await harness());
}

test("gap 10: the login token is requested with the narrowest scope the specification allows, order-simple", async () => {
  const h = await harness();
  const c = await challenge(h);
  h.fm.pay(c.orderId);
  await h.get("/api/quote", { authorization: ietfCred(c) });
  assert.ok(h.fm.scopes.length >= 1);
  assert.deepEqual([...new Set(h.fm.scopes)], ["order-simple"]);
});

// ---- the reference client, end to end against the same paywall ------------------------------------------

for (const format of ["ietf", "x402"] as const) {
  test(`reference client pays and unlocks the resource (${format}); the credential cannot be replayed`, async () => {
    const h = await harness();
    const r = await payAndRetry(h.base + "/api/quote", format, async (c) => {
      assert.match(c.talerPayUri, /^taler:\/\/pay\//);
      assert.equal(c.exchanges.length, format === "ietf" ? 1 : 0);
      return { hContract: h.fm.pay(c.orderId) }; // stands in for a Taler wallet paying the order and recording the hash
    });
    assert.equal(r.challengeStatus, 402);
    assert.equal(r.finalStatus, 200);
    assert.equal(JSON.parse(r.body).secret, "the paid thing");
    assert.ok(r.receipt, "a receipt header came back");
    if (format === "x402") assert.deepEqual(Object.keys(r.payload as object).sort(), ["hContract", "orderId"], "no merchantSig: the wallet did not give one");
    const again = await fetch(h.base + "/api/quote", { headers: { [r.credential[0]]: r.credential[1] } });
    assert.equal(again.status, 402);
  });

  test(`reference client: after ${format} is accepted, the other format's credential for the same order is refused`, async () => {
    const h = await harness();
    const r = await payAndRetry(h.base + "/api/quote", format, async (c) => ({ hContract: h.fm.pay(c.orderId) }));
    assert.equal(r.finalStatus, 200);
    assert.ok(r.other, "the client built the other format's credential from the same 402");
    const cross = await fetch(h.base + "/api/quote", { headers: { [r.other![0]]: r.other![1] } });
    assert.equal(cross.status, 402);
    assert.equal(h.store.hasConsumed(`${format === "ietf" ? "ietf" : NET_A}:${r.orderId}`), true);
    assert.equal(h.store.hasConsumed(`${format === "ietf" ? NET_A : "ietf"}:${r.orderId}`), false, "only one key was inserted: the other format found the order redeemed");
  });

  test(`reference client whose wallet claims but does not pay stays locked (${format})`, async () => {
    const h = await harness();
    const r = await payAndRetry(h.base + "/api/quote", format, async (c) => ({ hContract: h.fm.claim(c.orderId) }));
    assert.equal(r.finalStatus, 402);
    assert.equal(r.receipt, undefined, "no receipt is reported for a refused proof");
    if (format === "x402") assert.equal(r.failureReason, "invalid_exact_taler_order_unpaid");
  });
}
