// Live probe of the public Taler demo backend. Not a unit test: it needs the network.
import { MerchantClient } from "../src/taler/merchant.ts";
import { discoverExchanges } from "../src/taler/exchange.ts";
import { parseAmount, toBaseUnits } from "../src/taler/amount.ts";
import { parsePayUri } from "../src/taler/payuri.ts";

const m = new MerchantClient({ baseUrl: "https://backend.demo.taler.net", instance: "sandbox", auth: { kind: "password", password: "sandbox" } });
const info = await discoverExchanges(m, "KUDOS");
console.log("exchanges for KUDOS:", JSON.stringify(info.exchanges), "| published:", JSON.stringify(info.published));
console.log(`unit 10^-${info.digits}:`, toBaseUnits(parseAmount("KUDOS:0.1"), info.digits), "base units for KUDOS:0.1");
const now = Math.floor(Date.now() / 1000);
const o = await m.createOrder({ amount: "KUDOS:0.1", summary: "arvuna live probe", fulfillmentUrl: "https://example.org/f?order=${ORDER_ID}", payDeadlineS: now + 600, refundDeadlineS: now + 4200 });
console.log("created:", o);
const st = await m.orderStatus(o.orderId, { timeoutMs: 2000 });
const uri = parsePayUri(st.talerPayUri!);
console.log("status:", st.status, "| pay URI order id matches:", uri.orderId === o.orderId, "| claim token present:", !!uri.claimToken, "| base:", uri.merchantBaseUrl);
console.log("contract fulfillment_url:", st.terms?.fulfillment_url);
