#!/usr/bin/env node
// arvuna-check URL: asks a paid URL for its payment terms and checks them against the specs.
// It never pays and never sends a credential.
import { observe } from "./observe.ts";
import { evaluate, renderMarkdown, renderText } from "./report.ts";

const USAGE = `usage: arvuna-check [--method GET|POST|HEAD] [--data JSON] [--json | --markdown] [--timeout MS] URL

Requests URL once without any credential, expects HTTP 402, and checks whatever payment
terms it offers (IETF "Payment" scheme, x402 v2, or both) against the specifications.
It never pays and never sends a credential.

exit status: 0 no rule failed, 1 at least one rule failed, 2 could not reach the target`;

const args = process.argv.slice(2);
let method: string | undefined, data: string | undefined, format: "text" | "json" | "markdown" = "text", timeoutMs: number | undefined, url: string | undefined;
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === "--method") method = args[++i];
  else if (a === "--data") data = args[++i];
  else if (a === "--json") format = "json";
  else if (a === "--markdown") format = "markdown";
  else if (a === "--timeout") timeoutMs = Number(args[++i]);
  else if (a === "-h" || a === "--help") { console.log(USAGE); process.exit(0); }
  else if (a.startsWith("-")) { console.error(`unknown option ${a}\n\n${USAGE}`); process.exit(2); }
  else url = a;
}
if (!url) { console.error(USAGE); process.exit(2); }

try {
  const o = await observe(url, { ...(method ? { method } : {}), ...(data ? { data } : {}), ...(timeoutMs ? { timeoutMs } : {}) });
  const r = evaluate(o);
  console.log(format === "json" ? JSON.stringify(r, null, 2) : format === "markdown" ? renderMarkdown(r) : renderText(r));
  process.exit(r.counts.FAIL > 0 ? 1 : 0);
} catch (e) {
  console.error(`arvuna-check: could not observe ${url}: ${(e as Error).message}`);
  process.exit(2);
}
