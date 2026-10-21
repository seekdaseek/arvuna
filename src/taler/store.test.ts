import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, type IssuedRecord } from "./store.ts";

const rec = (orderId: string, over: Partial<IssuedRecord> = {}): IssuedRecord => ({
  orderId, resource: "https://api.example.com/q", amount: "KUDOS:0.1", baseUnits: "10", currency: "KUDOS", summary: "s",
  talerPayUri: `taler://pay/h/${orderId}/?c=T`, merchantBaseUrl: "https://h/", fulfillmentTemplate: "https://api.example.com/q?order=${ORDER_ID}",
  exchanges: [{ url: "https://x/", masterPub: "M".repeat(52) }], payDeadlineMs: 1_000_000, refundDeadlineMs: 5_000_000, ...over,
});

test("claim is atomic: the second claim of an order, or of a key, is a duplicate", () => {
  const s = new Store();
  s.putIssued(rec("o1"));
  assert.equal(s.claim("o1", "taler:AAA:o1"), "ok");
  assert.equal(s.claim("o1", "taler:AAA:o1"), "duplicate");
  assert.equal(s.claim("o1", "taler:BBB:o1"), "duplicate", "a different key for the same order is still refused: one payment, one resource");
  assert.equal(s.claim("nope", "taler:AAA:nope"), "unknown");
  assert.equal(s.getIssued("o1")?.redeemed, true);
  assert.equal(s.hasConsumed("taler:AAA:o1"), true);
  assert.equal(s.hasConsumed("taler:BBB:o1"), false, "the refused key was not recorded");
});

test("a claimed order stays claimed across a restart of the store (file-backed)", () => {
  const dir = mkdtempSync(join(tmpdir(), "arvuna-store-"));
  const path = join(dir, "store.sqlite");
  try {
    const s1 = new Store(path);
    s1.putIssued(rec("o2"));
    assert.equal(s1.claim("o2", "taler:AAA:o2"), "ok");
    s1.close(); // the process "restarts"
    const s2 = new Store(path);
    assert.equal(s2.getIssued("o2")?.redeemed, true, "the issued record and its redeemed flag survived");
    assert.equal(s2.hasConsumed("taler:AAA:o2"), true, "the consumption key survived");
    assert.equal(s2.claim("o2", "taler:AAA:o2"), "duplicate", "presenting the same proof after the restart is refused");
    s2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("retention bound: records are kept until the later of the pay deadline and the refund deadline", () => {
  const s = new Store();
  s.putIssued(rec("o3", { payDeadlineMs: 1_000, refundDeadlineMs: 9_000 })); // refund deadline later
  s.putIssued(rec("o4", { payDeadlineMs: 9_000, refundDeadlineMs: 1_000 })); // pay deadline later
  s.claim("o3", "k3"); s.claim("o4", "k4");
  assert.equal(Store.retainUntil(rec("x", { payDeadlineMs: 1_000, refundDeadlineMs: 9_000 })), 9_000);
  assert.equal(s.purge(8_999), 0, "nothing is forgotten while an order can still be presented or refunded");
  assert.ok(s.hasConsumed("k3") && s.hasConsumed("k4"));
  assert.equal(s.purge(9_001), 4, "both orders and both keys go after the later deadline");
  assert.equal(s.hasConsumed("k3"), false);
  assert.equal(s.getIssued("o3"), undefined);
});
