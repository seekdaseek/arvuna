// Live probe of the public Taler demo backend. Not a unit test: it needs the network.
import { MerchantClient } from "../src/taler/merchant.ts";
import { parseAmount, toBaseUnits } from "../src/taler/amount.ts";

const m = new MerchantClient({ baseUrl: "https://backend.demo.taler.net", instance: "sandbox", auth: { kind: "password", password: "sandbox" } });
const cfg = await m.config();
console.log("config:", cfg.currency, "fractionalDigits", cfg.fractionalDigits, "->", toBaseUnits(parseAmount("KUDOS:0.1"), cfg.fractionalDigits), "base units for KUDOS:0.1");
const o = await m.createOrder({ amount: "KUDOS:0.1", summary: "arvuna live probe", fulfillmentUrl: "https://example.org/f", payDeadlineS: Math.floor(Date.now() / 1000) + 600 });
console.log("created:", o);
const pub = await m.publicOrder(o.orderId);
console.log("public GET /orders/{id}:", pub);
const t0 = Date.now();
const st = await m.orderStatus(o.orderId, { timeoutMs: 2000 });
console.log("private status after", Date.now() - t0, "ms long-poll:", st.status, st.terms?.amount, st.terms?.pay_deadline, st.talerPayUri);
