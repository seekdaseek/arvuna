// Runs arvuna-check against a fixed target list, writes one full table per target under docs/conformance/
// and prints a summary plus every non-PASS row. Each target gets one unauthenticated request.
import { mkdirSync, writeFileSync } from "node:fs";
import { observe } from "../src/conformance/observe.ts";
import { evaluate, renderMarkdown } from "../src/conformance/report.ts";

const day = process.argv[2] ?? new Date().toISOString().slice(0, 10).replaceAll("-", "");
const targets: { name: string; url: string; note: string }[] = [
  { name: "arvuna-taler-prototype", url: "http://127.0.0.1:8402/api/quote", note: "Part A prototype, running locally against the public Taler demo merchant" },
  { name: "agentfeed", url: "https://x402.ochinimus.app/api/sol-price", note: "Maintainer's own service; route chosen from /.well-known/x402.json" },
  { name: "2s-io", url: "https://2s.io/api/weather/zip?zip=94103", note: "Third party, x402 v2; found through the 2s.io x402 example page" },
  { name: "abstract-mpp-demo", url: "https://mpp.abs.xyz/api/charge", note: "Third party, IETF Payment; Abstract's MPP demo" },
  { name: "mpp-dev-ping", url: "https://mpp.dev/api/ping/paid", note: "Third party, IETF Payment; the MPP project's own demo route" },
  { name: "x402-org-protected", url: "https://www.x402.org/protected", note: "Third party; x402.org demo route (redirects)" },
];
mkdirSync("docs/conformance", { recursive: true });
const rows: string[] = [];
for (const t of targets) {
  try {
    const o = await observe(t.url);
    const r = evaluate(o);
    writeFileSync(`docs/conformance/${day}-${t.name}.md`, `# ${t.name}\n\n${t.note}\n\n${renderMarkdown(r)}\n`);
    rows.push(`| ${t.name} | ${t.url} | ${r.status} | ${r.offers.ietf ? "yes" : "no"} | ${r.offers.x402 ? "yes" : "no"} | ${r.counts.PASS} | ${r.counts.FAIL} | ${r.counts.WARN} | ${r.counts["N/A"]} |`);
    console.log(`\n### ${t.name}  ${t.url}  -> ${r.status}  pass ${r.counts.PASS} fail ${r.counts.FAIL} warn ${r.counts.WARN}`);
    for (const x of r.results.filter((x) => x.status === "FAIL" || x.status === "WARN")) console.log(`  ${x.status} ${x.id} ${x.rule} — ${x.detail ?? ""}`);
    if (r.finalUrl !== t.url) console.log(`  (redirected to ${r.finalUrl})`);
  } catch (e) {
    rows.push(`| ${t.name} | ${t.url} | unreachable | - | - | - | - | - | - |`);
    console.log(`\n### ${t.name}  ${t.url}  -> UNREACHABLE: ${(e as Error).message}`);
  }
}
console.log("\n| Target | URL | HTTP | IETF | x402 | pass | fail | warn | n/a |\n|---|---|---|---|---|---|---|---|---|\n" + rows.join("\n"));
