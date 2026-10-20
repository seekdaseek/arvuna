import { test } from "node:test";
import assert from "node:assert/strict";
import { b64urlDecode, b64urlEncode, b64Decode, jcs, utf8 } from "./encoding.ts";
import { challengeId, formatPaymentChallenge, parseWwwAuthenticate } from "./challenge.ts";
import * as F from "../fixtures/spec.ts";

test("b64url: strict, no padding, no standard alphabet", () => {
  assert.equal(b64urlEncode('{"a":1}'), "eyJhIjoxfQ");
  assert.equal(utf8(b64urlDecode("eyJhIjoxfQ")!), '{"a":1}');
  assert.equal(b64urlDecode("eyJhIjoxfQ=="), null, "padding is forbidden");
  assert.equal(b64urlDecode("ab+/"), null, "standard alphabet is forbidden");
  assert.equal(b64urlDecode(""), null);
  assert.equal(b64urlDecode("a"), null, "length 1 mod 4 is impossible");
});

test("b64 standard: padding optional, url-safe chars rejected", () => {
  assert.equal(utf8(b64Decode("eyJhIjoxfQ==")!), '{"a":1}');
  assert.equal(utf8(b64Decode("eyJhIjoxfQ")!), '{"a":1}');
  assert.equal(b64Decode("ab-_"), null);
});

test("jcs: sorted keys, no whitespace, RFC 8785 examples", () => {
  assert.equal(jcs({ b: 1, a: [true, null, "x"], c: { z: 1, y: 2 } }), '{"a":[true,null,"x"],"b":1,"c":{"y":2,"z":1}}');
  assert.equal(jcs({ amount: "1000000" }), '{"amount":"1000000"}');
  assert.equal(jcs({ "€": 1, "\r": 2, "1": 3 }), '{"\\r":2,"1":3,"€":1}');
});

test("parse: CORE example challenge", () => {
  const [c, ...rest] = parseWwwAuthenticate(F.CORE_EXAMPLE_CHALLENGE);
  assert.equal(rest.length, 0);
  assert.equal(c!.scheme, "Payment");
  assert.equal(c!.map.get("id"), "x7Tg2pLqR9mKvNwY3hBcZa");
  assert.equal(c!.map.get("realm"), "api.example.com");
  assert.equal(c!.map.get("method"), "example");
  assert.equal(c!.map.get("intent"), "charge");
  assert.equal(c!.map.get("expires"), "2025-01-15T12:05:00Z");
  assert.equal(c!.map.get("request"), F.CORE_EXAMPLE_REQUEST_B64);
  assert.deepEqual(c!.errors, []);
  assert.deepEqual(c!.duplicates, []);
});

test("parse: CORE multiple payment options in one field", () => {
  const cs = parseWwwAuthenticate(F.CORE_MULTIPLE);
  assert.deepEqual(cs.map((c) => c.map.get("method")), ["invoice", "signed"]);
});

test("parse: other schemes alongside Payment, quoted-pair, duplicates, unterminated quote", () => {
  const cs = parseWwwAuthenticate('Basic realm="x", Bearer, Payment id="a\\"b", id="dup", method=card');
  assert.deepEqual(cs.map((c) => c.scheme), ["Basic", "Bearer", "Payment"]);
  const p = cs[2]!;
  assert.equal(p.map.get("id"), 'a"b');
  assert.deepEqual(p.duplicates, ["id"]);
  assert.equal(p.map.get("method"), "card");
  const bad = parseWwwAuthenticate('Payment id="oops');
  assert.match(bad[0]!.errors[0]!, /unterminated/);
});

test("format: round-trips through the parser", () => {
  const line = formatPaymentChallenge({ id: "i", realm: "r", method: "taler", intent: "charge", request: "e30", expires: "2026-01-01T00:00:00Z", description: 'say "hi"' });
  const c = parseWwwAuthenticate(line)[0]!;
  assert.equal(c.map.get("description"), 'say "hi"');
  assert.equal(c.map.get("expires"), "2026-01-01T00:00:00Z");
});

for (const v of F.CORE_HMAC_VECTORS) {
  test(`challenge id: CORE HMAC test vector (${v.name})`, () => {
    const id = challengeId(F.CORE_HMAC_SECRET, {
      realm: "api.example.com",
      method: "tempo",
      intent: "charge",
      request: F.CORE_HMAC_REQUEST_B64,
      ...(v.header !== undefined ? { header: v.header } : {}),
      ...(v.opaque !== undefined ? { opaque: v.opaque } : {}),
    });
    assert.equal(id, v.id);
  });
}

test("fixture sanity: CORE_HMAC_REQUEST_B64 is the JCS form of {amount:1000000}", () => {
  assert.equal(b64urlEncode(jcs({ amount: "1000000" })), F.CORE_HMAC_REQUEST_B64);
});
