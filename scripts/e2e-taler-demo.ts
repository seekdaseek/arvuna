// End-to-end paid run against the public Taler demo: protected route -> 402 -> pay with the external
// wallet CLI (Docker image from tools/wallet) -> retry -> 200 plus receipt.
// Needs the demo server running (npm run demo) and demo KUDOS in the test wallet (see docs/proof-taler-demo-20261020.md).
//   node scripts/e2e-taler-demo.ts [ietf|x402|both]
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { payAndRetry, type Format } from "../src/taler/client.ts";

const run = promisify(execFile);
const url = process.env["ARVUNA_URL"] ?? "http://127.0.0.1:8402/api/quote";
const which = process.argv[2] ?? "both";
const formats: Format[] = which === "both" ? ["ietf", "x402"] : [which as Format];
const wallet = (...a: string[]) => run("scripts/taler-wallet.sh", a, { timeout: 180_000, maxBuffer: 10_000_000 });

console.log("wallet balance before:");
console.log((await wallet("balance", "--pretty")).stdout.trim() || "(empty)");

let failed = false;
for (const format of formats) {
  console.log(`\n=== ${format} ===  GET ${url}`);
  try {
    const r = await payAndRetry(url, format, async (c) => {
      console.log(`402 received. order ${c.orderId}\n  taler_pay_uri ${c.talerPayUri}\npaying with the wallet CLI ...`);
      const out = await wallet("handle-uri", "-y", c.talerPayUri);
      console.log(out.stdout.trim().split("\n").slice(-6).join("\n"));
    });
    console.log(`retry with ${format} credential -> HTTP ${r.finalStatus}`);
    console.log(`receipt header decoded: ${JSON.stringify(r.receipt)}`);
    console.log(`body: ${r.body.slice(0, 200)}`);
    if (r.finalStatus !== 200) failed = true;
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
