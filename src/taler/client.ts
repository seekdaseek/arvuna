// Reference client for the paywall: reads the 402, pays through an injected function, retries with
// the credential for the chosen format. The payment itself (a Taler wallet) stays outside this code.
import { b64Decode, b64Encode, b64urlDecode, b64urlEncode, isObject, jcs, parseJson, utf8 } from "../common/encoding.ts";
import { parseWwwAuthenticate } from "../common/challenge.ts";
import { parsePayUri } from "./payuri.ts";

export type Format = "ietf" | "x402";

export interface PayContext {
  talerPayUri: string;
  orderId: string;
  format: Format;
  /** The exchanges the challenge lists, for the wallet to check. */
  exchanges: { url: string; masterPub: string }[];
}

/** What the wallet hands back after paying. hContract is the wallet's record of the contract hash (info.contractTermsHash). */
export interface PayResult {
  hContract?: string;
}

export interface ClientResult {
  format: Format;
  challengeStatus: number;
  talerPayUri: string;
  orderId: string;
  finalStatus: number;
  /** The decoded receipt header; present only when the final answer is a 200. */
  receipt: unknown;
  /** For an x402 failure: the errorReason in the PAYMENT-RESPONSE header. */
  failureReason?: string;
  body: string;
  /** The header that carried the credential, so a test or script can replay it. */
  credential: [string, string];
  /** The x402 payload that was sent, if any. */
  payload?: unknown;
}

function decodeJson(bytes: Uint8Array | null): unknown {
  const t = bytes ? utf8(bytes) : null;
  const p = t !== null ? parseJson(t) : null;
  return p?.ok ? p.value : undefined;
}

export async function payAndRetry(url: string, format: Format, pay: (c: PayContext) => Promise<PayResult | void>): Promise<ClientResult> {
  const first = await fetch(url);
  if (first.status !== 402) throw new Error(`expected 402, got ${first.status}`);
  let talerPayUri: string, orderId: string;
  let exchanges: PayContext["exchanges"] = [];
  let build: (hContract: string | undefined) => { header: [string, string]; payload?: unknown };

  if (format === "ietf") {
    const ch = parseWwwAuthenticate(first.headers.get("www-authenticate") ?? "").find((c) => c.scheme.toLowerCase() === "payment" && c.map.get("method") === "taler");
    if (!ch) throw new Error("no Payment challenge with method=taler");
    const req = decodeJson(b64urlDecode(ch.map.get("request") ?? ""));
    const md = isObject(req) ? req["methodDetails"] : undefined;
    if (!isObject(md) || typeof md["orderId"] !== "string" || typeof md["talerPayUri"] !== "string") throw new Error("challenge request lacks methodDetails.orderId/talerPayUri");
    talerPayUri = md["talerPayUri"];
    orderId = md["orderId"];
    if (parsePayUri(talerPayUri).orderId !== orderId) throw new Error("methodDetails.orderId differs from the Taler Pay URI");
    exchanges = Array.isArray(md["exchanges"]) ? (md["exchanges"] as PayContext["exchanges"]) : [];
    const challenge = Object.fromEntries(ch.params.map((p) => [p.name, p.value]));
    build = () => ({ header: ["authorization", `Payment ${b64urlEncode(JSON.stringify({ challenge, payload: { orderId } }))}`] });
  } else {
    const pr = decodeJson(b64Decode(first.headers.get("payment-required") ?? ""));
    const list = isObject(pr) && Array.isArray(pr["accepts"]) ? (pr["accepts"] as unknown[]) : [];
    const acc = list.find((a) => isObject(a) && typeof a["network"] === "string" && a["network"].startsWith("taler:"));
    const extra = isObject(acc) ? acc["extra"] : undefined;
    if (!isObject(acc) || !isObject(extra) || typeof extra["talerPayUri"] !== "string") throw new Error("no taler: requirement with extra.talerPayUri");
    if (extra["paymentFlow"] !== "upfront") throw new Error("the requirement does not use the upfront payment flow");
    talerPayUri = extra["talerPayUri"];
    orderId = parsePayUri(talerPayUri).orderId;
    const resource = (pr as Record<string, unknown>)["resource"];
    build = (hContract) => {
      if (!hContract) throw new Error("the wallet did not give a contract hash");
      const payload = { orderId, hContract };
      return { header: ["payment-signature", b64Encode(jcs({ x402Version: 2, resource, accepted: acc, payload }))], payload };
    };
  }

  const paid = await pay({ talerPayUri, orderId, format, exchanges });
  const { header, payload } = build(paid ? paid.hContract : undefined);
  const second = await fetch(url, { headers: { [header[0]]: header[1] } });
  const rh = format === "ietf" ? second.headers.get("payment-receipt") : second.headers.get("payment-response");
  const decoded = rh ? decodeJson(format === "ietf" ? b64urlDecode(rh) : b64Decode(rh)) : undefined;
  const receipt = second.status === 200 ? decoded : undefined; // a PAYMENT-RESPONSE on an error is a failure record, not a receipt
  const failureReason = second.status !== 200 && isObject(decoded) && typeof decoded["errorReason"] === "string" ? decoded["errorReason"] : undefined;
  return {
    format, challengeStatus: first.status, talerPayUri, orderId, finalStatus: second.status, receipt,
    ...(failureReason !== undefined ? { failureReason } : {}), body: await second.text(), credential: header, ...(payload !== undefined ? { payload } : {}),
  };
}
