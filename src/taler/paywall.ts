// A 402 paywall backed by a GNU Taler merchant backend. One protected resource answers 402 in BOTH
// formats at once and accepts a retry in EITHER:
//   - IETF Payment scheme (draft-httpauth-payment-01): WWW-Authenticate: Payment ... method="taler" intent="charge"
//   - x402 v2 (x402-specification-v2.md, transports-v2/http.md): PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE
// The paywall never touches money. It asks the merchant backend for an order and later asks whether that order is paid.
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { b64Decode, b64Encode, b64urlDecode, b64urlEncode, isObject, jcs, parseJson, utf8 } from "../common/encoding.ts";
import { challengeId, formatPaymentChallenge, safeEqual } from "../common/challenge.ts";
import { parseAmount, sameAmount, toBaseUnits } from "./amount.ts";
import { MerchantClient, MerchantError } from "./merchant.ts";

export const METHOD = "taler";
export const INTENT = "charge";
const PROBLEM_BASE = "https://paymentauth.org/problems/";

export interface PaywallOptions {
  merchant: MerchantClient;
  /** Taler amount, e.g. "KUDOS:0.1". */
  price: string;
  /** Fractional digits of the currency (from the backend /config; KUDOS: 2). */
  fractionalDigits: number;
  /** HMAC key for challenge ids. */
  secret: string;
  realm: string;
  /** Public origin of this server, e.g. http://127.0.0.1:8402. Used for resource URLs; never taken from the Host header. */
  baseUrl: string;
  /** How long a challenge stays payable, seconds. Default 600. */
  payWindowS?: number;
  /** If the order is not yet paid when a credential arrives, wait this long (ms) at the merchant before answering 402. Default 0. */
  waitMs?: number;
  mimeType?: string;
  describe?: (resourceUrl: string) => string;
  now?: () => number;
}

export interface PaywallRequest {
  method: string;
  /** Request target: path and query. */
  url: string;
  /** Lower-cased header names. */
  headers: Record<string, string | undefined>;
}

export type PaywallResult =
  | { action: "respond"; status: number; headers: Record<string, string>; body: string }
  | { action: "serve"; headers: Record<string, string> };

type Problem = "payment-required" | "malformed-credential" | "invalid-challenge" | "payment-expired" | "verification-failed" | "invalid-payload";

interface Issued {
  orderId: string;
  resource: string;
  amount: string;
  baseUnits: string;
  currency: string;
  expiresMs: number;
  talerPayUri: string;
  summary: string;
  state: "open" | "verifying" | "redeemed";
}

const isoSeconds = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

export class Paywall {
  private readonly o: PaywallOptions;
  private readonly issued = new Map<string, Issued>();
  private readonly currency: string;
  private readonly baseUnits: string;

  constructor(o: PaywallOptions) {
    this.o = o;
    const a = parseAmount(o.price);
    this.currency = a.currency;
    this.baseUnits = toBaseUnits(a, o.fractionalDigits); // throws if the price is not representable
  }

  private now() {
    return (this.o.now ?? Date.now)();
  }

  private network() {
    return `taler:${this.currency}`;
  }

  async handle(req: PaywallRequest): Promise<PaywallResult> {
    const resource = this.o.baseUrl.replace(/\/+$/, "") + req.url;
    const authz = req.headers["authorization"];
    const ietf = authz !== undefined && /^Payment(\s|$)/i.test(authz);
    const x402 = req.headers["payment-signature"];

    if (ietf) return this.handleIetf(resource, authz!);
    if (x402 !== undefined) return this.handleX402(resource, x402);
    return this.challenge(resource, "payment-required", "Payment is required to access this resource.");
  }

  // ---- credentials -------------------------------------------------------------------------

  private async handleIetf(resource: string, authz: string): Promise<PaywallResult> {
    const m = /^Payment\s+([A-Za-z0-9_-]+)\s*$/i.exec(authz);
    const bytes = m ? b64urlDecode(m[1]!) : null;
    const text = bytes ? utf8(bytes) : null;
    const parsed = text !== null ? parseJson(text) : { ok: false as const };
    if (!parsed.ok || !isObject(parsed.value)) return this.challenge(resource, "malformed-credential", "Credential is not base64url-encoded JSON.");
    const cred = parsed.value;
    const ch = cred["challenge"];
    const payload = cred["payload"];
    if (!isObject(ch) || !isObject(payload)) return this.challenge(resource, "malformed-credential", "Credential needs a challenge object and a payload object.");
    for (const k of ["id", "realm", "method", "intent", "request"]) {
      if (typeof ch[k] !== "string" || ch[k] === "") return this.challenge(resource, "malformed-credential", `Credential challenge.${k} is missing.`);
    }
    const s = (k: string) => (typeof ch[k] === "string" ? (ch[k] as string) : undefined);
    if (s("header") !== undefined) return this.challenge(resource, "invalid-challenge", "This server issues no header parameter.");
    if (s("method") !== METHOD || s("intent") !== INTENT || s("realm") !== this.o.realm) {
      return this.challenge(resource, "invalid-challenge", "Challenge method, intent or realm is not ours.");
    }
    const expectId = challengeId(this.o.secret, {
      realm: s("realm")!, method: s("method")!, intent: s("intent")!, request: s("request")!,
      ...(s("expires") !== undefined ? { expires: s("expires")! } : {}),
      ...(s("digest") !== undefined ? { digest: s("digest")! } : {}),
      ...(s("opaque") !== undefined ? { opaque: s("opaque")! } : {}),
    });
    if (!safeEqual(expectId, s("id")!)) return this.challenge(resource, "invalid-challenge", "Challenge binding does not verify.");
    const rb = b64urlDecode(s("request")!);
    const rt = rb ? utf8(rb) : null;
    const rj = rt !== null ? parseJson(rt) : { ok: false as const };
    const md = rj.ok && isObject(rj.value) ? rj.value["methodDetails"] : undefined;
    const orderId = isObject(md) && typeof md["orderId"] === "string" ? md["orderId"] : undefined;
    if (orderId === undefined) return this.challenge(resource, "invalid-challenge", "Challenge request carries no orderId.");
    const exp = s("expires");
    if (exp !== undefined && !(Date.parse(exp) > this.now())) return this.challenge(resource, "payment-expired", "Challenge has expired.", orderId);
    if (payload["orderId"] !== orderId) return this.challenge(resource, "invalid-payload", "payload.orderId must equal the order in the challenge.", orderId);

    const r = await this.redeem(orderId, resource);
    if (!r.ok) return r.status === 500 ? this.error500(r.detail) : this.challenge(resource, r.problem, r.detail, orderId);
    return {
      action: "serve",
      headers: {
        "cache-control": "private",
        "payment-receipt": b64urlEncode(JSON.stringify({ status: "success", method: METHOD, timestamp: isoSeconds(this.now()), reference: orderId })),
      },
    };
  }

  private async handleX402(resource: string, header: string): Promise<PaywallResult> {
    const bytes = b64Decode(header);
    const text = bytes ? utf8(bytes) : null;
    const parsed = text !== null ? parseJson(text) : { ok: false as const };
    if (!parsed.ok || !isObject(parsed.value)) return this.challenge(resource, "malformed-credential", "PAYMENT-SIGNATURE is not base64-encoded JSON.");
    const p = parsed.value;
    if (p["x402Version"] !== 2) return this.challenge(resource, "malformed-credential", "x402Version must be 2.");
    const acc = p["accepted"];
    const payload = p["payload"];
    if (!isObject(acc) || !isObject(payload)) return this.challenge(resource, "malformed-credential", "PaymentPayload needs accepted and payload objects.");
    const extra = acc["extra"];
    const orderId = isObject(extra) && typeof extra["orderId"] === "string" ? extra["orderId"] : undefined;
    if (orderId === undefined) return this.challenge(resource, "invalid-challenge", "accepted.extra.orderId is missing.");
    const rec = this.issued.get(orderId);
    if (!rec) return this.challenge(resource, "invalid-challenge", "Unknown order.");
    const want = this.requirements(rec);
    if (acc["scheme"] !== want.scheme || acc["network"] !== want.network || acc["amount"] !== want.amount || acc["asset"] !== want.asset || acc["payTo"] !== want.payTo) {
      return this.challenge(resource, "invalid-challenge", "accepted does not match what this server asked for.", orderId);
    }
    if (payload["orderId"] !== undefined && payload["orderId"] !== orderId) {
      return this.challenge(resource, "invalid-payload", "payload.orderId must equal accepted.extra.orderId.", orderId);
    }
    const r = await this.redeem(orderId, resource);
    if (!r.ok) return r.status === 500 ? this.error500(r.detail) : this.challenge(resource, r.problem, r.detail, orderId);
    return {
      action: "serve",
      headers: {
        "cache-control": "private",
        // x402 SettlementResponse. `transaction` is documented as a blockchain hash; Taler has none, so the order id stands in.
        "payment-response": b64Encode(JSON.stringify({ success: true, transaction: orderId, network: this.network(), amount: rec.baseUnits })),
      },
    };
  }

  // ---- verification ------------------------------------------------------------------------

  private async redeem(orderId: string, resource: string): Promise<{ ok: true } | { ok: false; status: 402 | 500; problem: Problem; detail: string }> {
    const rec = this.issued.get(orderId);
    if (!rec) return { ok: false, status: 402, problem: "invalid-challenge", detail: "Unknown order." };
    if (rec.resource !== resource) return { ok: false, status: 402, problem: "invalid-challenge", detail: "Order was issued for a different resource." };
    if (rec.state !== "open") return { ok: false, status: 402, problem: "invalid-challenge", detail: "Order already used." };
    if (this.now() > rec.expiresMs) return { ok: false, status: 402, problem: "payment-expired", detail: "Challenge has expired." };
    rec.state = "verifying"; // single-use even under concurrent retries
    try {
      const st = await this.o.merchant.orderStatus(orderId, { timeoutMs: this.o.waitMs ?? 0 });
      if (st.status !== "paid") {
        rec.state = "open";
        return { ok: false, status: 402, problem: "verification-failed", detail: `Order is not paid yet (status: ${st.status}).` };
      }
      if (!st.terms?.amount || !sameAmount(st.terms.amount, rec.amount)) {
        rec.state = "open";
        return { ok: false, status: 402, problem: "verification-failed", detail: "Paid amount does not match." };
      }
      rec.state = "redeemed";
      return { ok: true };
    } catch (e) {
      rec.state = "open";
      const detail = e instanceof MerchantError ? `Merchant backend error (${e.httpStatus}).` : "Merchant backend unreachable.";
      return { ok: false, status: 500, problem: "verification-failed", detail };
    }
  }

  // ---- challenges --------------------------------------------------------------------------

  private requirements(rec: Issued) {
    return {
      scheme: "exact",
      network: this.network(),
      amount: rec.baseUnits,
      asset: this.currency,
      payTo: this.o.merchant.instanceUrl,
      maxTimeoutSeconds: Math.max(1, Math.floor((rec.expiresMs - this.now()) / 1000)),
      extra: { orderId: rec.orderId, talerPayUri: rec.talerPayUri },
    };
  }

  private async issue(resource: string): Promise<Issued> {
    const nowMs = this.now();
    for (const [id, r] of this.issued) if (r.expiresMs < nowMs - 3_600_000) this.issued.delete(id);
    const summary = this.o.describe?.(resource) ?? `Access to ${resource}`;
    const deadlineS = Math.floor(nowMs / 1000) + (this.o.payWindowS ?? 600);
    // A Taler wallet treats an order whose fulfillment_url equals that of an order it already paid as a
    // repurchase and does not pay again. Every order therefore gets its own fulfillment_url.
        const fulfill = new URL(resource);
        fulfill.searchParams.set("arvuna_order", randomUUID());
        const created = await this.o.merchant.createOrder({ amount: this.o.price, summary, fulfillmentUrl: fulfill.toString(), payDeadlineS: deadlineS });
    const pub = await this.o.merchant.publicOrder(created.orderId);
    if (pub.httpStatus !== 402 || !pub.talerPayUri) throw new MerchantError("merchant did not return a taler_pay_uri", pub.httpStatus, pub);
    const rec: Issued = {
      orderId: created.orderId, resource, amount: this.o.price, baseUnits: this.baseUnits, currency: this.currency,
      expiresMs: (created.payDeadlineS ?? deadlineS) * 1000, talerPayUri: pub.talerPayUri, summary, state: "open",
    };
    this.issued.set(rec.orderId, rec);
    return rec;
  }

  /** Builds the 402. Reuses the still-open order named by `orderId` if there is one; otherwise asks the merchant for a new order. */
  private async challenge(resource: string, problem: Problem, detail: string, orderId?: string): Promise<PaywallResult> {
    let rec = orderId ? this.issued.get(orderId) : undefined;
    if (!rec || rec.state !== "open" || rec.resource !== resource || this.now() > rec.expiresMs) {
      try {
        rec = await this.issue(resource);
      } catch (e) {
        return this.error500(e instanceof MerchantError ? `Merchant backend error (${e.httpStatus}).` : "Merchant backend unreachable.");
      }
    }
    const request = {
      amount: rec.baseUnits,
      currency: this.currency.toLowerCase(),
      description: rec.summary,
      externalId: rec.orderId,
      methodDetails: { orderId: rec.orderId, talerPayUri: rec.talerPayUri },
    };
    const requestB64 = b64urlEncode(jcs(request));
    const expires = isoSeconds(rec.expiresMs);
    const fields = { realm: this.o.realm, method: METHOD, intent: INTENT, request: requestB64, expires };
    const www = formatPaymentChallenge({ ...fields, id: challengeId(this.o.secret, fields), description: rec.summary });
    const pr = {
      x402Version: 2,
      error: problem === "payment-required" ? "PAYMENT-SIGNATURE header is required" : detail,
      resource: { url: resource, description: rec.summary, mimeType: this.o.mimeType ?? "application/json" },
      accepts: [this.requirements(rec)],
    };
    return {
      action: "respond",
      status: 402,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/problem+json",
        "www-authenticate": www,
        "payment-required": b64Encode(JSON.stringify(pr)),
      },
      body: JSON.stringify({ type: PROBLEM_BASE + problem, title: titles[problem], status: 402, detail }),
    };
  }

  private error500(detail: string): PaywallResult {
    return {
      action: "respond",
      status: 500,
      headers: { "cache-control": "no-store", "content-type": "application/problem+json" },
      body: JSON.stringify({ type: PROBLEM_BASE + "internal-payment-error", title: "Internal Payment Error", status: 500, detail }),
    };
  }
}

const titles: Record<Problem, string> = {
  "payment-required": "Payment Required",
  "malformed-credential": "Malformed Credential",
  "invalid-challenge": "Invalid Challenge",
  "payment-expired": "Payment Expired",
  "verification-failed": "Payment Verification Failed",
  "invalid-payload": "Invalid Payload",
};

/** node:http adapter. Every method, HEAD included, goes through the same check. */
export function paywallHandler(paywall: Paywall, serve: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v.join(", ") : v;
    const r = await paywall.handle({ method: req.method ?? "GET", url: req.url ?? "/", headers });
    if (r.action === "respond") {
      res.writeHead(r.status, r.headers);
      res.end(r.body);
      return;
    }
    for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
    await serve(req, res);
  };
}

