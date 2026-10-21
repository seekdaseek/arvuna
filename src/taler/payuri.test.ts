import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePayUri } from "./payuri.ts";

// LSD 0006 (https://lsd.gnunet.org/lsd0006/), section "Examples", action "pay".
test("the LSD 0006 example: order id is the segment between the last two slashes", () => {
  const u = parsePayUri("taler://pay/example.com/2022.268-03G33PTAY2C6T/00f68430-363a-46b7-8e33-241a0e49c430?c=KKBWMSTF4AZSP8XS0FFNE9KM5M");
  assert.equal(u.orderId, "2022.268-03G33PTAY2C6T");
  assert.equal(u.sessionId, "00f68430-363a-46b7-8e33-241a0e49c430");
  assert.equal(u.merchantBaseUrl, "https://example.com/");
  assert.equal(u.claimToken, "KKBWMSTF4AZSP8XS0FFNE9KM5M");
});

test("LSD 0006 syntax table: empty session id, prefix path, no token", () => {
  const a = parsePayUri("taler://pay/merchant.example.com/42/");
  assert.deepEqual([a.orderId, a.sessionId, a.merchantBaseUrl, a.claimToken], ["42", "", "https://merchant.example.com/", undefined]);
  const b = parsePayUri("taler://pay/backend.demo.taler.net/instances/sandbox/2026.294-CDE03CQNS74TW/?c=ABC");
  assert.deepEqual([b.orderId, b.sessionId, b.merchantBaseUrl, b.claimToken], ["2026.294-CDE03CQNS74TW", "", "https://backend.demo.taler.net/instances/sandbox/", "ABC"]);
});

test("the scheme and action are case-insensitive; other actions and malformed URIs are refused", () => {
  assert.equal(parsePayUri("TALER://PAY/Example.com/42/").orderId, "42");
  for (const bad of ["taler://withdraw/bank.example.com/wid", "taler+http://pay/h/1/", "https://example.com/1/", "taler://pay/host", "taler://pay//42/", "taler://pay/host//"]) {
    assert.throws(() => parsePayUri(bad), /./, bad);
  }
});
