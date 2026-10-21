// End-to-end paid run against the public Taler demo: protected route -> 402 -> pay with the external
// wallet CLI (Docker image from tools/wallet) -> retry -> 200 plus receipt -> replay of the same proof (must be refused).
// Needs the demo server running (npm run demo) and demo KUDOS in the test wallet (see docs/proof-taler-demo.md).
//   node scripts/e2e-taler-demo.ts [ietf|x402|both|x402sig]
// "x402sig" is an x402 run whose payload also carries merchantSig. wallet-core does not return that signature to the
// application (draft-taler-charge-03, OQ-11), so this mode reads it from the wallet's own database, which is not an interface.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { payAndRetry, type Format } from "../src/taler/client.ts";
import { crockfordEncode } from "../src/taler/crockford.ts";
import { MerchantClient } from "../src/taler/merchant.ts";

const run = promisify(execFile);
const url = process.env["ARVUNA_URL"] ?? "http://127.0.0.1:8402/api/quote";
const which = process.argv[2] ?? "both";
const withSig = which === "x402sig";
const formats: Format[] = which === "both" ? ["ietf", "x402"] : withSig ? ["x402"] : [which as Format];
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

/** The merchant's payment signature for an order, from the wallet database (purchases.merchant_pay_sig), Crockford Base32. */
function merchantSigFromWalletDb(orderId: string): string {
  const db = new DatabaseSync(process.env["WALLET_DB"] ?? ".wallet/wallet.db", { readOnly: true });
  try {
    const row = db.prepare("select merchant_pay_sig from purchases where order_id = ?").get(orderId) as { merchant_pay_sig: Uint8Array | null } | undefined;
    if (!row?.merchant_pay_sig || row.merchant_pay_sig.length !== 64) throw new Error(`the wallet database holds no merchant signature for ${orderId}`);
    return crockfordEncode(row.merchant_pay_sig);
  } finally {
    db.close();
  }
}

console.log("wallet balance before:");
console.log((await wallet("balance", "--pretty")).stdout.trim() || "(empty)");

let failed = false;
for (const format of formats) {
  console.log(`\n=== ${format} ===  GET ${url}`);
  try {
    const r = await payAndRetry(url, format, async (c) => {
      console.log(`402 received. order ${c.orderId}\n  amount ${c.amount} (units of 10^-8) = ${c.talerAmount}\n  exchanges listed: ${c.exchanges.map((e) => e.url).join(", ") || "(none)"}\n  taler_pay_uri ${c.talerPayUri.replace(/(c=)[^&]+/, "$1<claim token>")}\npaying with the wallet CLI ...`);
      const out = await wallet("handle-uri", "-y", c.talerPayUri);
      console.log(out.stdout.trim().split("\n").slice(-3).join("\n"));
      const hContract = await contractHashFromWallet(c.orderId);
      if (!withSig) return { hContract };
      const merchantSig = merchantSigFromWalletDb(c.orderId);
      console.log(`merchantSig taken from the wallet database: ${merchantSig.length} characters`);
      return { hContract, merchantSig };
    });
    console.log(`retry with ${format} credential${withSig ? " (payload with merchantSig)" : ""} -> HTTP ${r.finalStatus}`);
    if (withSig) console.log(`payload sent: ${JSON.stringify({ ...(r.payload as object), merchantSig: "<103 characters>" })}`);
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
    // cross-format replay: the same order, offered in the other format by the same 402, must be refused as well (draft-taler-charge-03, "Replay and Idempotency")
    if (r.other) {
      const cross = await fetch(url, { headers: { [r.other[0]]: r.other[1] } });
      const cp = (await cross.json().catch(() => ({}))) as { type?: string; reason?: string };
      console.log(`CROSS-FORMAT replay of the same order as ${r.other[0]} -> HTTP ${cross.status} ${cp.reason ?? cp.type ?? ""}`);
      if (cross.status === 200) failed = true;
    }
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
