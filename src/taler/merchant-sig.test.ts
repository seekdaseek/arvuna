import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { crockfordDecode, crockfordEncode } from "./crockford.ts";
import { paymentResponseMessage, verifyMerchantSig, TALER_SIGNATURE_MERCHANT_PAYMENT_OK } from "./merchant-sig.ts";

// A real vector: a merchant payment signature that the public demo merchant made, read from a GNU Taler wallet's own database
// (see src/taler/testdata/merchant-pay-sig-vector.json). Nothing in it was produced by this repository.
const V = JSON.parse(readFileSync(new URL("./testdata/merchant-pay-sig-vector.json", import.meta.url), "utf8")) as {
  merchantPub: string; hContract: string; merchantSig: string; orderId: string;
};

test("Crockford Base32: round trip, sizes of hash, key and signature, and strictness", () => {
  for (const [text, n] of [[V.hContract, 64], [V.merchantSig, 64], [V.merchantPub, 32]] as const) {
    const b = crockfordDecode(text, n);
    assert.ok(b, text.slice(0, 8));
    assert.equal(crockfordEncode(b!), text);
  }
  assert.equal(V.hContract.length, 103);
  assert.equal(V.merchantPub.length, 52);
  assert.equal(crockfordDecode(V.merchantPub.toLowerCase(), 32), undefined, "uppercase only");
  assert.equal(crockfordDecode(V.merchantPub.slice(1), 32), undefined, "length");
  assert.equal(crockfordDecode(V.merchantPub.slice(0, 51) + "U", 32), undefined, "no U in the alphabet");
  assert.equal(crockfordDecode(V.merchantPub.slice(0, 51) + "1", 32), undefined, "non-zero pad bits are not canonical");
});

test("the signed message is size 72, purpose 1104, then the 64-byte contract hash (taler_signatures.h, merchant_signatures.c)", () => {
  assert.equal(TALER_SIGNATURE_MERCHANT_PAYMENT_OK, 1104);
  const m = paymentResponseMessage(V.hContract)!;
  assert.equal(m.length, 72);
  assert.equal(m.subarray(0, 8).toString("hex"), "0000004800000450");
  assert.equal(m.subarray(8).toString("hex"), Buffer.from(crockfordDecode(V.hContract, 64)!).toString("hex"));
  assert.equal(paymentResponseMessage("short"), undefined);
});

test("a real merchant signature verifies under the real merchant key", () => {
  assert.equal(verifyMerchantSig(V.hContract, V.merchantSig, V.merchantPub), true);
});

test("the same signature does not verify for another hash, another key, or with a flipped bit", () => {
  const h = crockfordDecode(V.hContract, 64)!.slice();
  h[63]! ^= 1;
  assert.equal(verifyMerchantSig(crockfordEncode(h), V.merchantSig, V.merchantPub), false, "other hash");
  const k = crockfordDecode(V.merchantPub, 32)!.slice();
  k[0]! ^= 1;
  assert.equal(verifyMerchantSig(V.hContract, V.merchantSig, crockfordEncode(k)), false, "other key");
  const s = crockfordDecode(V.merchantSig, 64)!.slice();
  s[10]! ^= 1;
  assert.equal(verifyMerchantSig(V.hContract, crockfordEncode(s), V.merchantPub), false, "flipped signature bit");
  // the framing matters: a signature over the bare hash, or over the purpose alone, is not accepted
  assert.equal(verifyMerchantSig(V.hContract, V.merchantSig.replace(/.$/, "0"), V.merchantPub), false);
  assert.equal(verifyMerchantSig("x", V.merchantSig, V.merchantPub), false, "malformed input never throws");
});

test("the specification's test vector and example payload are the fixture's values", () => {
  const spec = readFileSync(new URL("../../docs/specs/draft-taler-charge-03.md", import.meta.url), "utf8");
  for (const v of [V.merchantPub, V.hContract, V.merchantSig, V.orderId]) assert.ok(spec.includes(v), v.slice(0, 12));
  assert.ok(spec.includes(Buffer.from(crockfordDecode(V.merchantSig, 64)!).toString("hex")), "hex of the signature");
  assert.ok(spec.includes(paymentResponseMessage(V.hContract)!.subarray(8, 40).toString("hex")), "first half of the signed hash");
});
