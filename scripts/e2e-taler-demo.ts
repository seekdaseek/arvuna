// End-to-end paid run against the public Taler demo: protected route -> 402 -> pay with the external
// wallet CLI (Docker image from tools/wallet) -> retry -> 200 plus receipt -> replay of the same proof (must be refused).
// Needs the demo server running (npm run demo) and demo KUDOS in the test wallet (see docs/proof-taler-demo.md).
//   node scripts/e2e-taler-demo.ts [ietf|x402|both]
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { payAndRetry, type Format } from "../src/taler/client.ts";
import { MerchantClient } from "../src/taler/merchant.ts";

const run = promisify(execFile);
const url = process.env["ARVUNA_URL"] ?? "http://127.0.0.1:8402/api/quote";
const which = process.argv[2] ?? "both";
const formats: Format[] = which === "both" ? ["ietf", "x402"] : [which as Format];
const wallet = (...a: string[]) => run("scripts/taler-wallet.sh", a, { timeout: 180_000, maxBuffer: 20_000_000 });
const merchant = new MerchantClient({ baseUrl: process.env["TALER_BACKEND"] ?? "https://backend.demo.taler.net", instance: process.env["TALER_INSTANCE"] ?? "sandbox", auth: { kind: "password", password: process.env["TALER_PASSWORD"] ?? "sandbox" } });

/** The wallet's payment record for an order carries the contract hash, as info.contractTermsHash. */
async function contractHashFromWallet(orderId: string): Promise<string> {
  const out = (await wallet("transactions")).stdout;
  const start = Math.min(...[out.indexOf("{"), out.indexOf("[")].filter((i) => i >= 0));
  const j = JSON.parse(out.slice(start)) as unknown;
  const list = (Array.isArray(j) ? j : (j as { transactions: unknown[] }).transactions) as { type: string; info?: { orderId?: string; contractTermsHash?: string } }[];
  const tx = list.find((t) => t.type === "payment" && t.info?.orderId === orderId);
  if (!tx?.info?.contractTermsHash) throw new Error(`no payment record with a contract hash for ${orderId}`);
  return tx.info.contractTermsHash;
}

console.log("wallet balance before:");
console.log((await wallet("balance", "--pretty")).stdout.trim() || "(empty)");

let failed = false;
for (const format of formats) {
  console.log(`\n=== ${format} ===  GET ${url}`);
  try {
    const r = await payAndRetry(url, format, async (c) => {
      console.log(`402 received. order ${c.orderId}\n  exchanges listed: ${c.exchanges.map((e) => e.url).join(", ") || "(none)"}\n  taler_pay_uri ${c.talerPayUri.replace(/(c=)[^&]+/, "$1<claim token>")}\npaying with the wallet CLI ...`);
      const out = await wallet("handle-uri", "-y", c.talerPayUri);
      console.log(out.stdout.trim().split("\n").slice(-3).join("\n"));
      return { hContract: await contractHashFromWallet(c.orderId) };
    });
    console.log(`retry with ${format} credential -> HTTP ${r.finalStatus}`);
    console.log(`receipt header decoded: ${JSON.stringify(r.receipt)}`);
    console.log(`body: ${r.body.slice(0, 200)}`);
    if (r.finalStatus !== 200) failed = true;
    const st = await merchant.orderStatus(r.orderId);
    console.log(`merchant order_status for ${r.orderId}: ${st.status}`);
    if (st.status !== "paid") failed = true;
    // replay: the same credential again must be refused
    const again = await fetch(url, { headers: { [r.credential[0]]: r.credential[1] } });
    const problem = (await again.json().catch(() => ({}))) as { type?: string; reason?: string };
    console.log(`REPLAY of the same ${format} credential -> HTTP ${again.status} ${problem.reason ?? problem.type ?? ""}`);
    if (again.status === 200) failed = true;
    console.log(`order id: ${r.orderId}`);
  } catch (e) {
    failed = true;
    const err = e as { stdout?: string; stderr?: string; message: string };
    console.log(`FAILED: ${err.message.split("\n")[0]}`);
    if (err.stdout) console.log(err.stdout.split("\n").slice(0, 12).join("\n"));
    if (err.stderr) console.log(err.stderr.split("\n").slice(0, 6).join("\n"));
  }
}
console.log("\nwallet balance after:");
console.log((await wallet("balance", "--pretty")).stdout.trim() || "(empty)");
process.exit(failed ? 1 : 0);
