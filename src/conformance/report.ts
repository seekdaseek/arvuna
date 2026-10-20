import { checkIetf, paymentChallenges } from "./ietf.ts";
import { checkX402, findX402 } from "./x402.ts";
import type { Observed, RuleResult } from "./types.ts";

export interface Report {
  target: string;
  finalUrl: string;
  method: string;
  status: number;
  observedAt: string;
  offers: { ietf: boolean; x402: boolean };
  results: RuleResult[];
  counts: { PASS: number; FAIL: number; WARN: number; "N/A": number };
}

export function evaluate(o: Observed): Report {
  const ietf = checkIetf(o);
  const x402 = checkX402(o);
  const offers = { ietf: paymentChallenges(o).length > 0, x402: findX402(o).header !== undefined || findX402(o).bodyJson !== undefined };
  const results: RuleResult[] = [];
  if (o.status !== 402) {
    results.push({ id: "GEN-01", status: "FAIL", rule: "Unauthenticated request to a paid resource answers 402", spec: "RFC 9110 section 15.5.3; draft-httpauth-payment-01, Status Codes", detail: `status ${o.status}` });
  }
  if (!offers.ietf && !offers.x402) {
    results.push({ id: "GEN-02", status: "FAIL", rule: "Response offers at least one payment format (IETF Payment or x402)", spec: "draft-httpauth-payment-01; x402 transports-v2/http.md", detail: "neither format found" });
  }
  // Only report a format's rule rows when it is offered, or when it is the only thing we can say.
  if (offers.ietf) results.push(...ietf);
  if (offers.x402) results.push(...x402);
  if (!offers.ietf) results.push(...ietf);
  if (!offers.x402) results.push(...x402);
  const counts = { PASS: 0, FAIL: 0, WARN: 0, "N/A": 0 };
  for (const r of results) counts[r.status]++;
  return { target: o.url, finalUrl: o.finalUrl, method: o.method, status: o.status, observedAt: new Date(o.at).toISOString(), offers, results, counts };
}

const cell = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + "…" : s.padEnd(w));

export function renderText(r: Report): string {
  const lines: string[] = [];
  lines.push(`Target   ${r.target}${r.finalUrl !== r.target ? `  (final: ${r.finalUrl})` : ""}`);
  lines.push(`Request  ${r.method}, no credential sent   Response ${r.status}   Observed ${r.observedAt}`);
  lines.push(`Offers   IETF Payment: ${r.offers.ietf ? "yes" : "no"}   x402: ${r.offers.x402 ? "yes" : "no"}`);
  lines.push("");
  lines.push(`${cell("RULE", 10)} ${cell("RESULT", 6)} ${cell("CHECK", 66)} SPEC / DETAIL`);
  for (const x of r.results) {
    lines.push(`${cell(x.id, 10)} ${cell(x.status, 6)} ${cell(x.rule, 66)} ${x.spec}${x.detail ? `  — ${x.detail}` : ""}`);
  }
  lines.push("");
  lines.push(`Summary  ${r.counts.PASS} pass, ${r.counts.FAIL} fail, ${r.counts.WARN} warn, ${r.counts["N/A"]} n/a`);
  return lines.join("\n");
}

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderMarkdown(r: Report): string {
  const rows = r.results.map((x) => `| ${x.id} | ${x.status} | ${esc(x.rule)} | ${esc(x.spec)} | ${esc(x.detail ?? "")} |`);
  return [
    `**Target:** ${r.target}${r.finalUrl !== r.target ? ` (final: ${r.finalUrl})` : ""}  `,
    `**Request:** ${r.method}, no credential sent. **Response:** ${r.status}. **Observed:** ${r.observedAt}  `,
    `**Offers:** IETF Payment ${r.offers.ietf ? "yes" : "no"}, x402 ${r.offers.x402 ? "yes" : "no"}. **Summary:** ${r.counts.PASS} pass, ${r.counts.FAIL} fail, ${r.counts.WARN} warn, ${r.counts["N/A"]} n/a`,
    "",
    "| Rule | Result | Check | Spec | Detail |",
    "|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}
