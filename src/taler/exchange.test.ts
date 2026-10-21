import { test } from "node:test";
import assert from "node:assert/strict";
import { startFakeMerchant, MASTER_A, MASTER_B, type FakeMerchant } from "./fake-merchant.ts";
import { MerchantClient } from "./merchant.ts";
import { discoverExchanges } from "./exchange.ts";

const RESET = (fm: FakeMerchant) => {
  fm.exchanges.length = 0;
  fm.exchanges.push({ path: "/exchange-a", masterPub: MASTER_A, currency: "KUDOS", digits: 2 }, { path: "/exchange-chf", masterPub: "9V0G82S7JQW2ZRYF7BMGKKQ1TNR1VNVXZJSNQ2VSDGWC80D9W0YG", currency: "CHF", digits: 2 });
};

/** Each test starts its own fake backend and closes it itself, so no server outlives a filtered-out test. */
async function withFake(body: (fm: FakeMerchant, merchant: MerchantClient, reset: () => void) => Promise<void>) {
  const fm = await startFakeMerchant();
  const merchant = new MerchantClient({ baseUrl: fm.url, instance: "sandbox", auth: { kind: "password", password: "sandbox" }, timeoutMs: 3000 });
  try {
    await body(fm, merchant, () => RESET(fm));
  } finally {
    await fm.close();
  }
}

test("gap 1: the list is the merchant's /config exchanges for the order's currency, as {url, masterPub}", async () => withFake(async (fm, merchant, reset) => {
  reset();
  const i = await discoverExchanges(merchant, "KUDOS", fm.fetchViaHttp);
  assert.deepEqual(i.exchanges, [{ url: `${fm.url}/exchange-a/`, masterPub: MASTER_A }]);
  assert.deepEqual((await discoverExchanges(merchant, "kudos", fm.fetchViaHttp)).exchanges, i.exchanges, "currency match is case-insensitive");
  await assert.rejects(discoverExchanges(merchant, "EUR", fm.fetchViaHttp), /trusts no exchange for EUR/);
}));

test("an exchange that does not confirm the configured master key is not listed", async () => withFake(async (fm, merchant, reset) => {
  reset();
  fm.exchanges.push({ path: "/exchange-b", masterPub: MASTER_B, currency: "KUDOS", digits: 2, reportedMasterPub: "Z".repeat(52) });
  assert.deepEqual((await discoverExchanges(merchant, "KUDOS", fm.fetchViaHttp)).exchanges.map((e) => e.masterPub), [MASTER_A]);
  reset();
  fm.exchanges[0]!.reportedMasterPub = "Z".repeat(52);
  await assert.rejects(discoverExchanges(merchant, "KUDOS", fm.fetchViaHttp), /confirmed its master public key/);
  reset();
}));
