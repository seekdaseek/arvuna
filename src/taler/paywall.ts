// A 402 paywall backed by a GNU Taler merchant backend, following docs/specs/draft-taler-charge-02.md.
// One protected resource answers 402 in BOTH formats at once and accepts a retry in EITHER:
//   - IETF Payment scheme: WWW-Authenticate: Payment ... method="taler" intent="charge"
//   - x402 v2, "exact" in the client-submitted family, payment flow "upfront": PAYMENT-REQUIRED /
//     PAYMENT-SIGNATURE / PAYMENT-RESPONSE
// The paywall never touches money. It asks the merchant backend for an order, publishes the order's Taler Pay URI,
// and later asks whether that order is paid. State (issued orders, consumption keys) lives in a Store.
import type { IncomingMessage, ServerResponse } from "node:http";
import { b64Decode, b64Encode, b64urlDecode, b64urlEncode, isObject, jcs, parseJson, utf8 } from "../common/encoding.ts";
import { challengeId, formatPaymentChallenge, safeEqual } from "../common/challenge.ts";
import { parseAmount, sameAmount, toBaseUnits } from "./amount.ts";
import { discoverExchanges, type ExchangeInfo } from "./exchange.ts";
import { MerchantClient, MerchantError, publicOrderStatus, type OrderStatus } from "./merchant.ts";
import { parsePayUri } from "./payuri.ts";
import { Store, type IssuedRecord } from "./store.ts";

export const METHOD = "taler";
export const INTENT = "charge";
const PROBLEM_BASE = "https://paymentauth.org/problems/";
const HASH_CODE = /^[0-9A-Z]{103}$/; // a 64-byte hash in Crockford Base32 (docs.taler.net/core/api-common.html, "Hash codes")

/** Settlement error reasons, draft-taler-charge-02, "Settlement Errors". */
export type X402Reason =
  | "invalid_exact_taler_payment_flow"
  | "invalid_exact_taler_network"
  | "invalid_exact_taler_order_mismatch"
  | "invalid_exact_taler_h_contract_malformed"
  | "invalid_exact_taler_order_expired"
  | "invalid_exact_taler_order_unpaid"
  | "invalid_exact_taler_h_contract_mismatch"
  | "invalid_exact_taler_order_unknown"
  | "invalid_exact_taler_backend_error"
  | "duplicate_settlement";

export interface PaywallOptions {
  merchant: MerchantClient;
  store: Store;
  /** Taler amount, e.g. "KUDOS:0.1". */
  price: string;
  /** HMAC key for challenge ids. */
  secret: string;
  realm: string;
  /** Public origin of this server, e.g. http://127.0.0.1:8402. Used for resource URLs; never taken from the Host header. */
  baseUrl: string;
  /** How long a challenge stays payable, seconds. Default 600. */
  payWindowS?: number;
  /** The refund deadline is the pay deadline plus this many seconds. Default 3600. Set it to match your refund policy. */
  refundWindowS?: number;
  /** If the order is not yet paid when a proof arrives, wait this long (ms) at the merchant before answering 402. Default 0. */
  waitMs?: number;
  /** Fetch used for the exchanges and for the public order status; tests substitute it. */
  fetch?: typeof fetch;
  /** How long a discovered exchange list stays valid, ms. Default ten minutes. */
  exchangeTtlMs?: number;
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

const isoSeconds = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
const sameUrl = (a: string, b: string) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

const REASON_PROBLEM: Record<X402Reason, Problem> = {
  invalid_exact_taler_payment_flow: "invalid-challenge",
  invalid_exact_taler_network: "invalid-challenge",
  invalid_exact_taler_order_mismatch: "invalid-challenge",
  invalid_exact_taler_h_contract_malformed: "invalid-payload",
  invalid_exact_taler_order_expired: "payment-expired",
  invalid_exact_taler_order_unpaid: "verification-failed",
  invalid_exact_taler_h_contract_mismatch: "verification-failed",
  invalid_exact_taler_order_unknown: "verification-failed",
  invalid_exact_taler_backend_error: "verification-failed",
  duplicate_settlement: "invalid-challenge",
};

export class Paywall {
  private readonly o: PaywallOptions;
  private readonly f: typeof fetch;
  private readonly currency: string; // as written in the price, e.g. KUDOS
  private info?: { at: number; value: ExchangeInfo };

  constructor(o: PaywallOptions) {
    this.o = o;
    this.f = o.fetch ?? fetch;
    this.currency = parseAmount(o.price).currency;
  }

  private now() {
    return (this.o.now ?? Date.now)();
  }

  private async exchangeInfo(): Promise<ExchangeInfo> {
    const ttl = this.o.exchangeTtlMs ?? 600_000;
    if (!this.info || this.now() - this.info.at > ttl) {
      this.info = { at: this.now(), value: await discoverExchanges(this.o.merchant, this.currency, this.f) };
    }
    return this.info.value;
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

  // ---- IETF Payment credential ---------------------------------------------------------------

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

    const r = await this.redeemIetf(orderId, resource);
    if (!r.ok) return r.status === 500 ? this.error500(r.detail) : this.challenge(resource, r.problem, r.detail, orderId);
    return {
      action: "serve",
      headers: {
        "cache-control": "private",
        "payment-receipt": b64urlEncode(JSON.stringify({ status: "success", method: METHOD, timestamp: isoSeconds(r.paidAtMs), reference: orderId })),
      },
    };
  }

  /** draft-taler-charge-02, "Verification". */
  private async redeemIetf(orderId: string, resource: string): Promise<{ ok: true; paidAtMs: number } | { ok: false; status: 402 | 500; problem: Problem; detail: string }> {
    const rec = this.o.store.getIssued(orderId);
    if (!rec) return { ok: false, status: 402, problem: "invalid-challenge", detail: "Unknown order." };
    if (rec.resource !== resource) return { ok: false, status: 402, problem: "invalid-challenge", detail: "Order was issued for a different resource." };
    if (rec.redeemed) return { ok: false, status: 402, problem: "invalid-challenge", detail: "Order already used." };
    if (this.now() > rec.payDeadlineMs) return { ok: false, status: 402, problem: "payment-expired", detail: "Challenge has expired." };
    let st: OrderStatus;
    try {
      st = await this.o.merchant.orderStatus(orderId, { timeoutMs: this.o.waitMs ?? 0 });
    } catch (e) {
      return { ok: false, status: 500, problem: "verification-failed", detail: backendDetail(e) };
    }
    if (st.status !== "paid") return { ok: false, status: 402, problem: "verification-failed", detail: `Order is not paid yet (status: ${st.status}).` };
    const bad = checkPaidContract(st, rec);
    if (bad) return { ok: false, status: 402, problem: "verification-failed", detail: bad };
    if (this.o.store.claim(orderId, `ietf:${orderId}`) !== "ok") return { ok: false, status: 402, problem: "invalid-challenge", detail: "Order already used." };
    return { ok: true, paidAtMs: st.lastPaymentS !== undefined ? st.lastPaymentS * 1000 : this.now() };
  }

  // ---- x402 settle ---------------------------------------------------------------------------

  /** draft-taler-charge-02, "Payload and Settle": the facilitator's /settle, done here by the resource server. */
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

    const net = typeof acc["network"] === "string" ? acc["network"] : undefined;
    const fail = (reason: X402Reason, detail: string, orderId?: string) => this.x402Failure(resource, reason, detail, orderId, net);
    const extra = acc["extra"];
    // 1. accepted equals the requirement this server issued (except maxTimeoutSeconds), payment flow upfront
    if (!isObject(extra) || extra["paymentFlow"] !== "upfront") return fail("invalid_exact_taler_payment_flow", "extra.paymentFlow must be \"upfront\".");
    const uriStr = extra["talerPayUri"];
    let uri;
    try {
      uri = parsePayUri(typeof uriStr === "string" ? uriStr : "");
    } catch {
      return fail("invalid_exact_taler_order_mismatch", "accepted.extra.talerPayUri is not a Taler Pay URI.");
    }
    const rec = this.o.store.getIssued(uri.orderId);
    if (!rec || rec.resource !== resource) return fail("invalid_exact_taler_order_mismatch", "No order was issued for this resource under that identifier.");
    const want = this.requirements(rec);
    const w = want.find((r) => r.network === net);
    if (!w) return fail("invalid_exact_taler_network", "network is not a taler network of an exchange in the order's list.", rec.orderId);
    const { maxTimeoutSeconds: _a, ...accRest } = acc as Record<string, unknown>;
    const { maxTimeoutSeconds: _b, ...wRest } = w;
    if (jcs(accRest) !== jcs(wRest)) return fail("invalid_exact_taler_order_mismatch", "accepted differs from the requirement issued for this order.", rec.orderId);
    // 2. payload
    if (payload["orderId"] !== rec.orderId) return fail("invalid_exact_taler_order_mismatch", "payload.orderId must equal the identifier in the Taler Pay URI.", rec.orderId);
    const hContract = payload["hContract"];
    if (typeof hContract !== "string" || !HASH_CODE.test(hContract)) return fail("invalid_exact_taler_h_contract_malformed", "payload.hContract is not a Taler hash code.", rec.orderId);
    // 3. the pay deadline has not passed
    if (this.now() > rec.payDeadlineMs) return fail("invalid_exact_taler_order_expired", "The pay deadline has passed.", rec.orderId);
    // 4. the merchant backend reports the order as paid: public request, no credential
    let pub;
    try {
      pub = await publicOrderStatus(this.f, rec.merchantBaseUrl, rec.orderId, hContract, { waitMs: this.o.waitMs ?? 0 });
    } catch {
      return this.x402Backend(resource, "Merchant backend unreachable.", net);
    }
    if (pub.httpStatus === 402) return fail("invalid_exact_taler_order_unpaid", "The merchant backend reports the order as unpaid.", rec.orderId);
    if (pub.httpStatus === 403) return fail("invalid_exact_taler_h_contract_mismatch", "The merchant backend does not accept this contract hash.", rec.orderId);
    if (pub.httpStatus === 404) return fail("invalid_exact_taler_order_unknown", "The merchant backend does not know the order.", rec.orderId);
    if (pub.httpStatus !== 200) return this.x402Backend(resource, `Merchant backend answered ${pub.httpStatus}.`, net);
    // This server has private access, so it also checks the paid contract itself, as the specification advises:
    // amount, merchant, fulfillment URL, accepted exchanges, refund status.
    try {
      const st = await this.o.merchant.orderStatus(rec.orderId);
      if (st.status !== "paid") return fail("invalid_exact_taler_order_unpaid", "The merchant backend reports the order as unpaid.", rec.orderId);
      const bad = checkPaidContract(st, rec);
      if (bad) return fail("invalid_exact_taler_order_mismatch", bad, rec.orderId);
    } catch (e) {
      return this.x402Backend(resource, backendDetail(e), net);
    }
    // 5. atomically record the consumption key network + ":" + orderId
    if (this.o.store.claim(rec.orderId, `${net}:${rec.orderId}`) !== "ok") return fail("duplicate_settlement", "The proof was already used.", rec.orderId);
    return {
      action: "serve",
      headers: {
        "cache-control": "private",
        // payer is omitted: Taler does not reveal the payer. transaction is the order identifier (there is no blockchain hash).
        "payment-response": b64Encode(jcs({ success: true, transaction: rec.orderId, network: net, amount: rec.baseUnits })),
      },
    };
  }

  // ---- challenges ----------------------------------------------------------------------------

  /** One requirement per exchange in the order's list. They differ only in network. */
  private requirements(rec: IssuedRecord) {
    return rec.exchanges.map((e) => ({
      scheme: "exact",
      network: `taler:${e.masterPub.slice(0, 32)}`,
      amount: rec.baseUnits,
      asset: rec.currency,
      payTo: rec.merchantBaseUrl,
      maxTimeoutSeconds: Math.max(1, Math.floor((rec.payDeadlineMs - this.now()) / 1000)),
      extra: { paymentFlow: "upfront", talerPayUri: rec.talerPayUri },
    }));
  }

  private async issue(resource: string): Promise<IssuedRecord> {
    const nowMs = this.now();
    this.o.store.purge(nowMs);
    const info = await this.exchangeInfo();
    const baseUnits = toBaseUnits(parseAmount(this.o.price), info.digits); // throws if the price is finer than the unit
    const summary = this.o.describe?.(resource) ?? `Access to ${resource}`;
    const payDeadlineS = Math.floor(nowMs / 1000) + (this.o.payWindowS ?? 600);
    const refundDeadlineS = payDeadlineS + (this.o.refundWindowS ?? 3600);
    // Each order gets its own fulfillment_url, through the backend's ${ORDER_ID} placeholder, so that a wallet's
    // repurchase detection never mistakes a second purchase for the first (draft-taler-charge-02, "Fulfillment URL").
    const template = resource + (resource.includes("?") ? "&" : "?") + "order=${ORDER_ID}";
    const created = await this.o.merchant.createOrder({ amount: this.o.price, summary, fulfillmentUrl: template, payDeadlineS, refundDeadlineS });
    const st = await this.o.merchant.orderStatus(created.orderId);
    if (!st.talerPayUri) throw new MerchantError("merchant returned no taler_pay_uri", 200, undefined);
    const uri = parsePayUri(st.talerPayUri);
    if (uri.orderId !== created.orderId) throw new MerchantError("taler_pay_uri names another order", 200, undefined);
    if (!uri.claimToken) throw new MerchantError("taler_pay_uri carries no claim token", 200, undefined); // create_token is on, so it must
    const rec: IssuedRecord = {
      orderId: created.orderId, resource, amount: this.o.price, baseUnits, currency: this.currency, summary,
      talerPayUri: st.talerPayUri, merchantBaseUrl: uri.merchantBaseUrl, fulfillmentTemplate: template,
      exchanges: info.exchanges, payDeadlineMs: (created.payDeadlineS ?? payDeadlineS) * 1000, refundDeadlineMs: refundDeadlineS * 1000,
    };
    this.o.store.putIssued(rec);
    return rec;
  }

  /** Builds the 402. Reuses the still-open order named by `orderId` if there is one; otherwise asks the merchant for a new order. */
  private async challenge(resource: string, problem: Problem, detail: string, orderId?: string, reason?: { reason: X402Reason; network?: string }): Promise<PaywallResult> {
    let rec: IssuedRecord | undefined;
    const existing = orderId ? this.o.store.getIssued(orderId) : undefined;
    if (existing && !existing.redeemed && existing.resource === resource && this.now() <= existing.payDeadlineMs) rec = existing;
    if (!rec) {
      try {
        rec = await this.issue(resource);
      } catch (e) {
        return this.error500(backendDetail(e));
      }
    }
    const request = {
      amount: rec.baseUnits,
      currency: rec.currency.toLowerCase(),
      description: rec.summary,
      externalId: rec.orderId,
      methodDetails: { exchanges: rec.exchanges, merchantBaseUrl: rec.merchantBaseUrl, orderId: rec.orderId, talerPayUri: rec.talerPayUri },
    };
    const requestB64 = b64urlEncode(jcs(request));
    const expires = isoSeconds(rec.payDeadlineMs);
    const fields = { realm: this.o.realm, method: METHOD, intent: INTENT, request: requestB64, expires };
    const www = formatPaymentChallenge({ ...fields, id: challengeId(this.o.secret, fields), description: rec.summary });
    const pr = {
      x402Version: 2,
      error: reason ? reason.reason : problem === "payment-required" ? "PAYMENT-SIGNATURE header is required" : detail,
      resource: { url: resource, description: rec.summary, mimeType: this.o.mimeType ?? "application/json" },
      accepts: this.requirements(rec),
    };
    const headers: Record<string, string> = {
      "cache-control": "no-store",
      "content-type": "application/problem+json",
      "www-authenticate": www,
      "payment-required": b64Encode(jcs(pr)),
    };
    if (reason) {
      headers["payment-response"] = b64Encode(jcs({ success: false, errorReason: reason.reason, transaction: "", network: reason.network ?? pr.accepts[0]!.network }));
    }
    return {
      action: "respond",
      status: 402,
      headers,
      body: JSON.stringify({ type: PROBLEM_BASE + problem, title: titles[problem], status: 402, detail, ...(reason ? { reason: reason.reason } : {}) }),
    };
  }

  private x402Failure(resource: string, reason: X402Reason, detail: string, orderId: string | undefined, network: string | undefined) {
    return this.challenge(resource, REASON_PROBLEM[reason], detail, orderId, { reason, ...(network ? { network } : {}) });
  }

  private x402Backend(_resource: string, detail: string, network: string | undefined): PaywallResult {
    const r = this.error500(detail);
    if (r.action !== "respond") return r;
    r.headers["payment-response"] = b64Encode(jcs({ success: false, errorReason: "invalid_exact_taler_backend_error", transaction: "", network: network ?? "" }));
    return r;
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

const backendDetail = (e: unknown) => (e instanceof MerchantError ? `Merchant backend error (${e.httpStatus}).` : "Merchant backend unreachable.");

/**
 * draft-taler-charge-02, "Verification", step 5: the paid contract matches what this server issued. Returns a
 * description of the first mismatch, or undefined.
 */
export function checkPaidContract(st: OrderStatus, rec: IssuedRecord): string | undefined {
  const t = st.terms;
  if (!t?.amount || !sameAmount(t.amount, rec.amount)) return "Paid amount does not match.";
  if (t.order_id !== rec.orderId) return "Contract order_id does not match.";
  if (typeof t.merchant_base_url !== "string" || !sameUrl(t.merchant_base_url, rec.merchantBaseUrl)) return "Contract merchant_base_url does not match.";
  if (t.fulfillment_url !== rec.fulfillmentTemplate.replace("${ORDER_ID}", rec.orderId)) return "Contract fulfillment_url does not match.";
  for (const ex of t.exchanges ?? []) {
    const ok = rec.exchanges.some((e) => typeof ex.url === "string" && sameUrl(e.url, ex.url) && e.masterPub === ex.master_pub);
    if (!ok) return "Contract names an exchange that the challenge did not list.";
  }
  if (st.refundAmount && sameAmount(st.refundAmount, rec.amount)) return "Order was refunded in full.";
  return undefined;
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
