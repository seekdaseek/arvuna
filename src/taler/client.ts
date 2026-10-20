// Reference client for the paywall: reads the 402, pays through an injected function, retries with
// the credential for the chosen format. The payment itself (a Taler wallet) stays outside this code.
import { b64Decode, b64Encode, b64urlDecode, b64urlEncode, isObject, parseJson, utf8 } from "../common/encoding.ts";
import { parseWwwAuthenticate } from "../common/challenge.ts";

export type Format = "ietf" | "x402";

export interface PayContext {
  talerPayUri: string;
  orderId: string;
  format: Format;
}

export interface ClientResult {
  format: Format;
  challengeStatus: number;
  talerPayUri: string;
  orderId: string;
  finalStatus: number;
  receipt: unknown;
  body: string;
}

function decodeJson(bytes: Uint8Array | null): unknown {
  const t = bytes ? utf8(bytes) : null;
  const p = t !== null ? parseJson(t) : null;
  return p?.ok ? p.value : undefined;
}

export async function payAndRetry(url: string, format: Format, pay: (c: PayContext) => Promise<void>): Promise<ClientResult> {
  const first = await fetch(url);
  if (first.status !== 402) throw new Error(`expected 402, got ${first.status}`);
  let talerPayUri: string, orderId: string;
  let credHeader: [string, string];

  if (format === "ietf") {
    const ch = parseWwwAuthenticate(first.headers.get("www-authenticate") ?? "").find((c) => c.scheme.toLowerCase() === "payment" && c.map.get("method") === "taler");
    if (!ch) throw new Error("no Payment challenge with method=taler");
    const req = decodeJson(b64urlDecode(ch.map.get("request") ?? ""));
    const md = isObject(req) ? req["methodDetails"] : undefined;
    if (!isObject(md) || typeof md["orderId"] !== "string" || typeof md["talerPayUri"] !== "string") throw new Error("challenge request lacks methodDetails.orderId/talerPayUri");
    orderId = md["orderId"];
    talerPayUri = md["talerPayUri"];
    const challenge = Object.fromEntries(ch.params.map((p) => [p.name, p.value]));
    credHeader = ["authorization", `Payment ${b64urlEncode(JSON.stringify({ challenge, payload: { orderId } }))}`];
  } else {
    const pr = decodeJson(b64Decode(first.headers.get("payment-required") ?? ""));
    const acc = isObject(pr) && Array.isArray(pr["accepts"]) ? pr["accepts"].find((a) => isObject(a) && typeof a["network"] === "string" && a["network"].startsWith("taler:")) : undefined;
    const extra = isObject(acc) ? acc["extra"] : undefined;
    if (!isObject(acc) || !isObject(extra) || typeof extra["orderId"] !== "string" || typeof extra["talerPayUri"] !== "string") throw new Error("no taler: requirement with extra.orderId/talerPayUri");
    orderId = extra["orderId"];
    talerPayUri = extra["talerPayUri"];
    credHeader = ["payment-signature", b64Encode(JSON.stringify({ x402Version: 2, resource: (pr as Record<string, unknown>)["resource"], accepted: acc, payload: { orderId } }))];
  }

  await pay({ talerPayUri, orderId, format });
  const second = await fetch(url, { headers: { [credHeader[0]]: credHeader[1] } });
  const rh = format === "ietf" ? second.headers.get("payment-receipt") : second.headers.get("payment-response");
  const receipt = rh ? decodeJson(format === "ietf" ? b64urlDecode(rh) : b64Decode(rh)) : undefined;
  return { format, challengeStatus: first.status, talerPayUri, orderId, finalStatus: second.status, receipt, body: await second.text() };
}
