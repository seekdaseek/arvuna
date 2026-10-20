import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { checkIetf } from "./ietf.ts";
import { checkX402 } from "./x402.ts";
import { evaluate } from "./report.ts";
import { observe } from "./observe.ts";
import { b64Encode, b64urlEncode, jcs } from "../common/encoding.ts";
import type { Observed, RuleResult } from "./types.ts";
import * as F from "../fixtures/spec.ts";

const AT = Date.parse("2025-01-15T12:00:00Z"); // five minutes before the CORE example challenge expires

function obs(headers: Record<string, string>, over: Partial<Observed> = {}): Observed {
  return { url: "https://api.example.com/x", finalUrl: "https://api.example.com/x", method: "GET", status: 402, headers: { "cache-control": "no-store", ...headers }, body: "", bodyTruncated: false, at: AT, ...over };
}
const byId = (rs: RuleResult[], id: string) => rs.find((r) => r.id === id);
const status = (rs: RuleResult[], id: string) => byId(rs, id)?.status;
const challenge = (over: Record<string, string | null>, req?: unknown) => {
  const base: Record<string, string> = { id: "abc", realm: "api.example.com", method: "taler", intent: "charge", expires: "2025-01-15T12:05:00Z", request: b64urlEncode(jcs(req ?? { amount: "10", currency: "kudos" })) };
  for (const [k, v] of Object.entries(over)) { if (v === null) delete base[k]; else base[k] = v; }
  return "Payment " + Object.entries(base).map(([k, v]) => `${k}="${v}"`).join(", ");
};
const ietf = (over: Record<string, string | null>, req?: unknown) => checkIetf(obs({ "www-authenticate": challenge(over, req) }));
const x402 = (pr: unknown) => checkX402(obs({ "payment-required": b64Encode(JSON.stringify(pr)) }));

// ---- IETF -----------------------------------------------------------------------------------

test("IETF: a well-formed taler challenge passes every rule", () => {
  const rs = ietf({});
  assert.deepEqual(rs.filter((r) => r.status !== "PASS").map((r) => r.id), []);
});

test("IETF: the CORE spec's own example challenge is checked, and its uppercase USD is reported", () => {
  const rs = checkIetf(obs({ "www-authenticate": F.CORE_EXAMPLE_CHALLENGE }));
  for (const id of ["IETF-01", "IETF-02", "IETF-03", "IETF-04", "IETF-05", "IETF-06", "IETF-07", "IETF-08", "IETF-09", "IETF-10", "IETF-12", "IETF-13", "IETF-14"]) {
    assert.equal(status(rs, id), "PASS", id);
  }
  // The base64 in the spec's example decodes to "USD", the charge intent wants lowercase ISO 4217 codes.
  assert.equal(status(rs, "IETF-11"), "FAIL");
  assert.match(byId(rs, "IETF-11")!.detail!, /USD/);
});

test("IETF: the CORE spec's example challenge is expired once the clock passes it", () => {
  const rs = checkIetf(obs({ "www-authenticate": F.CORE_EXAMPLE_CHALLENGE }, { at: Date.parse("2025-01-15T12:06:00Z") }));
  assert.equal(status(rs, "IETF-14"), "FAIL");
});

test("IETF: CHARGE spec request examples pass the request-shape rules", () => {
  for (const req of [F.CHARGE_EXAMPLE_LIGHTNING, F.CHARGE_EXAMPLE_STRIPE]) {
    const rs = ietf({ method: "example" }, req);
    assert.equal(status(rs, "IETF-10"), "PASS");
    assert.equal(status(rs, "IETF-11"), "PASS");
    assert.equal(status(rs, "IETF-12"), "PASS");
  }
});

test("IETF: no Payment scheme means N/A, not pass", () => {
  assert.equal(checkIetf(obs({})).at(0)?.status, "N/A");
  assert.equal(checkIetf(obs({ "www-authenticate": 'Bearer realm="x"' })).at(0)?.status, "N/A");
});

test("IETF: each deliberate fault is caught by its own rule", () => {
  assert.equal(status(ietf({ id: "" }), "IETF-04"), "FAIL");
  assert.equal(status(ietf({ id: null }), "IETF-04"), "FAIL");
  assert.equal(status(ietf({ realm: null }), "IETF-05"), "FAIL");
  assert.equal(status(ietf({ method: "Taler" }), "IETF-06"), "FAIL");
  assert.equal(status(ietf({ method: "ta1er" }), "IETF-06"), "FAIL");
  assert.equal(status(ietf({ method: null }), "IETF-06"), "FAIL");
  assert.equal(status(ietf({ intent: "Charge" }), "IETF-07"), "FAIL");
  assert.equal(status(ietf({ intent: "mystery" }), "IETF-07"), "WARN");
  assert.equal(status(ietf({ request: null }), "IETF-08"), "FAIL");
  assert.equal(status(ietf({ request: b64urlEncode('{"amount":"10"}') + "==" }), "IETF-08"), "FAIL", "padding");
  assert.equal(status(ietf({ request: "ab+/" }), "IETF-08"), "FAIL", "standard alphabet");
  assert.equal(status(ietf({ request: b64urlEncode("[1]") }), "IETF-08"), "FAIL", "not an object");
  assert.equal(status(ietf({ request: b64urlEncode('{ "currency": "kudos", "amount": "10" }') }), "IETF-09"), "FAIL", "not JCS");
  assert.equal(status(ietf({}, { amount: 10, currency: "kudos" }), "IETF-10"), "FAIL", "number amount");
  assert.equal(status(ietf({}, { amount: "1.5", currency: "usd" }), "IETF-10"), "FAIL", "decimal amount");
  assert.equal(status(ietf({}, { amount: "10" }), "IETF-11"), "FAIL", "no currency");
  assert.equal(status(ietf({}, { amount: "10", currency: "USD" }), "IETF-11"), "FAIL", "uppercase ISO code");
  assert.equal(status(ietf({}, { amount: "10", currency: "USDC" }), "IETF-11"), "WARN", "uppercase token symbol");
  assert.equal(status(ietf({}, { amount: "10", currency: "usd", methodDetails: "x" }), "IETF-12"), "FAIL");
  assert.equal(status(ietf({}, { amount: "10", currency: "usd", expires: "2026-01-01T00:00:00Z" }), "IETF-13"), "FAIL");
  assert.equal(status(ietf({ expires: "tomorrow" }), "IETF-14"), "FAIL");
  assert.equal(status(ietf({ expires: "2025-01-15T11:00:00Z" }), "IETF-14"), "FAIL", "past");
  assert.equal(status(ietf({ expires: null }), "IETF-14"), "WARN", "absent is a SHOULD");
  assert.equal(status(ietf({ opaque: b64urlEncode('{"a":1}') }), "IETF-15"), "FAIL", "non-string value");
  assert.equal(status(ietf({ opaque: b64urlEncode('{"a":"b"}') }), "IETF-15"), "PASS");
  assert.equal(status(ietf({ header: "X-Other" }), "IETF-16"), "FAIL");
  assert.equal(status(ietf({ header: "Payment-Authorization" }), "IETF-16"), "PASS");
});

test("IETF: status and Cache-Control are checked on the response", () => {
  const rs = checkIetf(obs({ "www-authenticate": challenge({}), "cache-control": "max-age=60" }, { status: 200 }));
  assert.equal(status(rs, "IETF-01"), "FAIL");
  assert.equal(status(rs, "IETF-02"), "FAIL");
});

test("IETF: two challenges are numbered, and a shared id fails", () => {
  const two = challenge({ id: "same" }) + ", " + challenge({ id: "same", method: "card" });
  const rs = checkIetf(obs({ "www-authenticate": two }));
  assert.ok(byId(rs, "IETF-04.1") && byId(rs, "IETF-04.2"));
  assert.equal(status(rs, "IETF-17"), "FAIL");
});

// ---- x402 -----------------------------------------------------------------------------------

test("x402: the spec's example PAYMENT-REQUIRED header passes every rule", () => {
  const rs = checkX402(obs({ "payment-required": F.X402_HTTP_PAYMENT_REQUIRED_B64 }));
  assert.deepEqual(rs.filter((r) => r.status !== "PASS").map((r) => r.id), []);
});

test("x402: the spec example object, re-encoded, passes; a taler requirement passes", () => {
  assert.equal(x402(F.X402_PAYMENT_REQUIRED).every((r) => r.status === "PASS"), true);
  const taler = { ...F.X402_PAYMENT_REQUIRED, accepts: [{ scheme: "exact", network: "taler:KUDOS", amount: "10", asset: "KUDOS", payTo: "https://backend.demo.taler.net/instances/sandbox", maxTimeoutSeconds: 599, extra: { orderId: "1", talerPayUri: "taler://pay/x" } }] };
  assert.equal(x402(taler).every((r) => r.status === "PASS"), true);
});

test("x402: each deliberate fault is caught by its own rule", () => {
  const good = F.X402_PAYMENT_REQUIRED;
  const acc = (o: Record<string, unknown>) => ({ ...good, accepts: [{ ...good.accepts[0], ...o }] });
  assert.equal(status(x402({ ...good, x402Version: 1 }), "X402-05"), "FAIL");
  assert.equal(status(x402({ ...good, error: 5 }), "X402-06"), "FAIL");
  assert.equal(status(x402({ ...good, resource: undefined }), "X402-07"), "FAIL");
  assert.equal(status(x402({ ...good, resource: { url: "not a url" } }), "X402-07"), "FAIL");
  assert.equal(status(x402({ ...good, resource: { ...good.resource, serviceName: "x".repeat(33) } }), "X402-08"), "FAIL");
  assert.equal(status(x402({ ...good, accepts: [] }), "X402-09"), "FAIL");
  assert.equal(status(x402(acc({ payTo: undefined })), "X402-10"), "FAIL");
  assert.equal(status(x402(acc({ maxTimeoutSeconds: "60" })), "X402-10"), "FAIL");
  assert.equal(status(x402(acc({ network: "base" })), "X402-11"), "FAIL");
  assert.equal(status(x402(acc({ network: "Taler:KUDOS" })), "X402-11"), "FAIL", "namespace is lowercase");
  assert.equal(status(x402(acc({ network: "taler:KUDOS" })), "X402-11"), "PASS");
  assert.equal(status(x402(acc({ amount: 10 })), "X402-12"), "FAIL");
  assert.equal(status(x402(acc({ amount: "0.01" })), "X402-12"), "FAIL");
  assert.equal(status(x402(acc({ maxTimeoutSeconds: 0 })), "X402-13"), "FAIL");
  assert.equal(status(x402(acc({ extra: "x" })), "X402-14"), "FAIL");
  assert.equal(status(x402(acc({ scheme: "mystery" })), "X402-15"), "WARN");
});

test("x402: header encoding faults", () => {
  const json = JSON.stringify(F.X402_PAYMENT_REQUIRED);
  assert.equal(status(checkX402(obs({ "payment-required": "%%%" })), "X402-03"), "FAIL");
  assert.equal(status(checkX402(obs({ "payment-required": b64Encode("not json") })), "X402-04"), "FAIL");
  assert.equal(status(checkX402(obs({ "payment-required": b64Encode("[]") })), "X402-04"), "FAIL");
  const urlsafe = Buffer.from(json + "??>").toString("base64url");
  assert.equal(status(checkX402(obs({ "payment-required": urlsafe })), "X402-03"), "WARN");
});

test("x402: a v1 body with no header is reported, not silently passed", () => {
  const rs = checkX402(obs({}, { body: JSON.stringify({ x402Version: 1, accepts: [{ scheme: "exact", network: "base", maxAmountRequired: "10000" }] }) }));
  assert.equal(status(rs, "X402-02"), "FAIL");
  assert.equal(status(rs, "X402-05"), "FAIL");
});

test("x402: nothing offered is N/A", () => {
  assert.equal(checkX402(obs({})).at(0)?.status, "N/A");
});

// ---- whole report -----------------------------------------------------------------------------

test("report: a 200 with no payment terms fails GEN-01 and GEN-02", () => {
  const r = evaluate(obs({}, { status: 200 }));
  assert.equal(status(r.results, "GEN-01"), "FAIL");
  assert.equal(status(r.results, "GEN-02"), "FAIL");
  assert.ok(r.counts.FAIL >= 2);
});

test("report: both formats offered are both checked", () => {
  const r = evaluate(obs({ "www-authenticate": challenge({}), "payment-required": F.X402_HTTP_PAYMENT_REQUIRED_B64 }));
  assert.deepEqual(r.offers, { ietf: true, x402: true });
  assert.equal(r.counts.FAIL, 0);
});

// ---- the checker never sends a credential ---------------------------------------------------

test("observe: refuses credential headers and sends none of its own", async () => {
  await assert.rejects(observe("http://127.0.0.1:1/", { headers: { Authorization: "Payment abc" } }), /never sends a credential/);
  await assert.rejects(observe("http://127.0.0.1:1/", { headers: { "payment-signature": "abc" } }), /never sends a credential/);
  await assert.rejects(observe("http://127.0.0.1:1/", { headers: { "X-PAYMENT": "abc" } }), /never sends a credential/);
  let seen: Record<string, unknown> = {};
  const srv = createServer((req, res) => { seen = req.headers; res.writeHead(402, { "cache-control": "no-store" }); res.end("{}"); });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  try {
    const o = await observe(`http://127.0.0.1:${(srv.address() as AddressInfo).port}/p`);
    assert.equal(o.status, 402);
    for (const h of ["authorization", "payment-authorization", "payment-signature", "x-payment", "cookie"]) assert.equal(seen[h], undefined, h);
  } finally {
    srv.closeAllConnections(); srv.close();
  }
});
