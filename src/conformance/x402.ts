// Checks of an x402 v2 PaymentRequired signal against specs/x402-specification-v2.md and
// specs/transports-v2/http.md in github.com/x402-foundation/x402.
import { b64Decode, isObject, parseJson, utf8 } from "../common/encoding.ts";
import { X402, X402HTTP, type Observed, type RuleResult, type Status } from "./types.ts";

const CAIP2 = /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/;
const SCHEMES = new Set(["exact", "upto", "batch-settlement", "auth-capture"]); // specs/schemes in the x402 repo
const PRINTABLE = /^[\x20-\x7e]*$/;

export interface X402Offer {
  source: "header" | "body";
  value: Record<string, unknown> | undefined;
}

/** Locates an x402 payload: v2 puts it in the PAYMENT-REQUIRED header; older servers put JSON in the body. */
export function findX402(o: Observed): { header?: string; bodyJson?: Record<string, unknown> } {
  const header = o.headers["payment-required"];
  let bodyJson: Record<string, unknown> | undefined;
  if (o.body) {
    const p = parseJson(o.body);
    if (p.ok && isObject(p.value) && ("x402Version" in p.value || "accepts" in p.value)) bodyJson = p.value;
  }
  return { ...(header !== undefined ? { header } : {}), ...(bodyJson ? { bodyJson } : {}) };
}

export function checkX402(o: Observed): RuleResult[] {
  const { header, bodyJson } = findX402(o);
  if (header === undefined && !bodyJson) {
    return [{ id: "X402-00", status: "N/A", rule: "Server offers an x402 payment requirement", spec: X402HTTP, detail: "no PAYMENT-REQUIRED header and no x402 JSON body" }];
  }
  const out: RuleResult[] = [];
  const add = (id: string, status: Status, rule: string, spec: string, detail?: string) => out.push({ id, status, rule, spec, ...(detail !== undefined ? { detail } : {}) });

  add("X402-01", o.status === 402 ? "PASS" : "FAIL", "Payment requirement is sent with status 402", `${X402HTTP}, Payment Required Signaling`, `status ${o.status}`);

  let pr: Record<string, unknown> | undefined;
  if (header === undefined) {
    add("X402-02", "FAIL", "PAYMENT-REQUIRED header present (canonical v2 location)", `${X402HTTP}, Payment Required Signaling`, `x402 JSON found only in the body${typeof bodyJson?.["x402Version"] === "number" ? ` (x402Version ${bodyJson["x402Version"]})` : ""}; v2 carries it in the header`);
    pr = bodyJson; // keep checking the body so the remaining rules still say something useful
  } else {
    add("X402-02", "PASS", "PAYMENT-REQUIRED header present (canonical v2 location)", `${X402HTTP}, Payment Required Signaling`);
    const std = b64Decode(header);
    const urlsafe = !std && /^[A-Za-z0-9_-]+={0,2}$/.test(header) ? Buffer.from(header, "base64url") : null;
    const bytes = std ?? urlsafe;
    add("X402-03", std ? "PASS" : urlsafe ? "WARN" : "FAIL", "Header value is base64 (standard alphabet)", `${X402HTTP}, Payment Required Signaling`, std ? undefined : urlsafe ? "decodes only as URL-safe base64" : "not valid base64");
    const text = bytes ? utf8(bytes) : null;
    const parsed = text !== null ? parseJson(text) : ({ ok: false } as const);
    if (!parsed.ok || !isObject(parsed.value)) add("X402-04", "FAIL", "Header decodes to a JSON object", `${X402HTTP}, Payment Required Signaling`, "base64 payload is not a JSON object");
    else { add("X402-04", "PASS", "Header decodes to a JSON object", `${X402HTTP}, Payment Required Signaling`); pr = parsed.value; }
  }
  if (!pr) return out;

  add("X402-05", pr["x402Version"] === 2 ? "PASS" : "FAIL", "x402Version is 2", `${X402}, 5.1.2 Field Descriptions`, `x402Version=${JSON.stringify(pr["x402Version"])}`);
  if (pr["error"] !== undefined) add("X402-06", typeof pr["error"] === "string" ? "PASS" : "FAIL", "error, if present, is a string", `${X402}, 5.1.2`, typeof pr["error"] === "string" ? undefined : `type ${typeof pr["error"]}`);

  // resource
  const res = pr["resource"];
  if (!isObject(res)) add("X402-07", "FAIL", "resource object present with an absolute url", `${X402}, 5.1.2 (ResourceInfo)`, res === undefined ? "missing" : "not an object");
  else {
    const u = res["url"];
    let okUrl = false;
    if (typeof u === "string") { try { const p = new URL(u); okUrl = p.protocol === "https:" || p.protocol === "http:"; } catch { /* */ } }
    add("X402-07", okUrl ? "PASS" : "FAIL", "resource object present with an absolute url", `${X402}, 5.1.2 (ResourceInfo)`, okUrl ? undefined : `url=${JSON.stringify(u)}`);
    const bad: string[] = [];
    for (const k of ["description", "mimeType", "serviceName", "iconUrl"]) if (res[k] !== undefined && typeof res[k] !== "string") bad.push(`${k} must be a string`);
    if (typeof res["serviceName"] === "string" && (res["serviceName"].length > 32 || !PRINTABLE.test(res["serviceName"]))) bad.push("serviceName must be printable ASCII, max 32 chars");
    if (res["tags"] !== undefined) {
      const t = res["tags"];
      if (!Array.isArray(t) || t.length > 5 || t.some((x) => typeof x !== "string" || x.length > 32 || !PRINTABLE.test(x))) bad.push("tags must be at most 5 printable-ASCII strings of at most 32 chars");
    }
    if (typeof res["iconUrl"] === "string" && res["iconUrl"].length > 2048) bad.push("iconUrl longer than 2048");
    add("X402-08", bad.length === 0 ? "PASS" : "FAIL", "optional ResourceInfo fields follow their limits", `${X402}, 5.1.2 (ResourceInfo)`, bad.join("; ") || undefined);
  }

  // accepts
  const acc = pr["accepts"];
  if (!Array.isArray(acc) || acc.length === 0) { add("X402-09", "FAIL", "accepts is a non-empty array", `${X402}, 5.1.2`, acc === undefined ? "missing" : "empty or not an array"); return out; }
  add("X402-09", "PASS", "accepts is a non-empty array", `${X402}, 5.1.2`, `${acc.length} option(s)`);
  const many = acc.length > 1;
  acc.forEach((a, i) => {
    const t = many ? ` [accepts ${i + 1}]` : "";
    const id = (n: string) => `X402-${n}${many ? "." + (i + 1) : ""}`;
    if (!isObject(a)) { add(id("10"), "FAIL", `accepts entry is an object${t}`, `${X402}, 5.1.2 (PaymentRequirements)`); return; }
    const missing: string[] = [];
    for (const k of ["scheme", "network", "amount", "asset", "payTo"]) if (typeof a[k] !== "string" || a[k] === "") missing.push(k);
    if (typeof a["maxTimeoutSeconds"] !== "number") missing.push("maxTimeoutSeconds");
    add(id("10"), missing.length === 0 ? "PASS" : "FAIL", `required fields present with the right types${t}`, `${X402}, 5.1.2 (PaymentRequirements)`, missing.length ? `missing or wrong type: ${missing.join(", ")}` : undefined);
    const net = a["network"];
    add(id("11"), typeof net === "string" && CAIP2.test(net) ? "PASS" : "FAIL", `network is a CAIP-2 identifier${t}`, `${X402}, 11.1 Network Identifiers`, `network=${JSON.stringify(net)}`);
    const amt = a["amount"];
    add(id("12"), typeof amt === "string" && /^[0-9]+$/.test(amt) ? "PASS" : "FAIL", `amount is a string of atomic units${t}`, `${X402}, 5.1.2 (amount)`, `amount=${JSON.stringify(amt)}`);
    const mt = a["maxTimeoutSeconds"];
    add(id("13"), typeof mt === "number" && Number.isInteger(mt) && mt > 0 ? "PASS" : "FAIL", `maxTimeoutSeconds is a positive integer${t}`, `${X402}, 5.1.2 (maxTimeoutSeconds)`, `maxTimeoutSeconds=${JSON.stringify(mt)}`);
    if (a["extra"] !== undefined) add(id("14"), isObject(a["extra"]) ? "PASS" : "FAIL", `extra, if present, is an object${t}`, `${X402}, 5.1.2 (extra)`);
    const sc = a["scheme"];
    add(id("15"), typeof sc === "string" && SCHEMES.has(sc) ? "PASS" : "WARN", `scheme is defined in the x402 repository${t}`, `${X402}, Document Scope (schemes)`, typeof sc === "string" && SCHEMES.has(sc) ? `scheme="${sc}"` : `scheme=${JSON.stringify(sc)} is not one of ${[...SCHEMES].join(", ")}`);
  });
  return out;
}
