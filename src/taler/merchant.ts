// Minimal client for the GNU Taler merchant backend REST API. HTTP only: no Taler library is
// imported, vendored or linked. Endpoint behaviour was probed against https://backend.demo.taler.net
// (see docs/proof-taler-demo.md).

export type MerchantAuth =
  | { kind: "password"; password: string } // exchanged for a login token at /private/token
  | { kind: "token"; token: string }; // a ready "secret-token:..." string, sent as a Bearer token

export interface MerchantOptions {
  /** e.g. https://backend.demo.taler.net */
  baseUrl: string;
  /** Instance id; the demo backend uses "sandbox". */
  instance: string;
  auth: MerchantAuth;
  fetch?: typeof fetch;
  /** Per-request timeout, ms. Long-polls get their poll time added. */
  timeoutMs?: number;
  /**
   * Scope requested for the login token. The default, "order-simple", is orders-read plus orders-write: it
   * "allows the creation of orders and checking of payment status", which is all this client does
   * (docs.taler.net/core/api-merchant.html, "Scopes and permissions").
   */
  scope?: string;
}

export interface CreatedOrder {
  orderId: string;
  /** Seconds since epoch, from the backend's reply, if it returned one. */
  payDeadlineS?: number;
}

export interface ContractTermsView {
  amount?: string;
  summary?: string;
  order_id?: string;
  fulfillment_url?: string;
  fulfillment_message?: string;
  merchant_base_url?: string;
  /** The merchant's public key (Crockford Base32), which verifies the merchant's payment signature. */
  merchant_pub?: string;
  pay_deadline?: { t_s?: number | "never" };
  refund_deadline?: { t_s?: number | "never" };
  exchanges?: { url?: string; master_pub?: string }[];
}

export interface OrderStatus {
  status: "unpaid" | "claimed" | "paid";
  /** For an order with a claim token this already carries the "c" parameter. Treat as a secret. */
  talerPayUri?: string;
  /** contract_terms (paid, claimed) or proto_contract_terms (unpaid). */
  terms?: ContractTermsView;
  /** last_payment, seconds since epoch (paid orders). */
  lastPaymentS?: number;
  refunded?: boolean;
  refundAmount?: string;
  raw: unknown;
}

export interface ConfiguredExchange {
  baseUrl: string;
  currency: string;
  masterPub: string;
}

export interface PublicStatus {
  httpStatus: number;
}

export class MerchantError extends Error {
  httpStatus: number;
  body: unknown;
  constructor(message: string, httpStatus: number, body: unknown) {
    super(message);
    this.name = "MerchantError";
    this.httpStatus = httpStatus;
    this.body = body;
  }
}

export class MerchantClient {
  readonly instanceUrl: string;
  private readonly o: MerchantOptions;
  private readonly f: typeof fetch;
  private bearer: string | null = null;
  private bearerExpiresMs = 0;

  constructor(o: MerchantOptions) {
    this.o = o;
    this.f = o.fetch ?? fetch;
    this.instanceUrl = `${o.baseUrl.replace(/\/+$/, "")}/instances/${encodeURIComponent(o.instance)}`;
  }

  private async req(method: string, path: string, init: { body?: unknown; headers?: Record<string, string>; extraMs?: number } = {}) {
    const res = await this.f(`${this.instanceUrl}${path}`, {
      method,
      headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...init.headers },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout((this.o.timeoutMs ?? 15000) + (init.extraMs ?? 0)),
    });
    const text = await res.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      /* non-JSON body */
    }
    return { res, json, text };
  }

  /** Returns an Authorization header value, logging in first if a password was configured. */
  private async authHeader(force = false): Promise<string> {
    const a = this.o.auth;
    if (a.kind === "token") return `Bearer ${a.token}`;
    if (!force && this.bearer && Date.now() < this.bearerExpiresMs - 30_000) return this.bearer;
    const basic = Buffer.from(`${this.o.instance}:${a.password}`).toString("base64");
    const { res, json } = await this.req("POST", "/private/token", {
      body: { scope: this.o.scope ?? "order-simple", duration: { d_us: 3_600_000_000 }, description: "arvuna prototype" },
      headers: { authorization: `Basic ${basic}` },
    });
    const j = json as { access_token?: string; expiration?: { t_s?: number } } | undefined;
    if (!res.ok || !j?.access_token) throw new MerchantError(`login failed (${res.status})`, res.status, json);
    this.bearer = j.access_token.startsWith("Bearer ") ? j.access_token : `Bearer ${j.access_token}`;
    this.bearerExpiresMs = typeof j.expiration?.t_s === "number" ? j.expiration.t_s * 1000 : Date.now() + 3_000_000;
    return this.bearer;
  }

  private async priv(method: string, path: string, init: { body?: unknown; extraMs?: number } = {}) {
    let r = await this.req(method, path, { ...init, headers: { authorization: await this.authHeader() } });
    if (r.res.status === 401 && this.o.auth.kind === "password") {
      r = await this.req(method, path, { ...init, headers: { authorization: await this.authHeader(true) } });
    }
    return r;
  }

  /**
   * GET /config on the backend root: the exchanges the merchant trusts, each with base_url, the currency it is
   * trusted for and its master public key (docs.taler.net/core/api-merchant.html, "Configuration API").
   */
  async exchangesFromConfig(): Promise<ConfiguredExchange[]> {
    const res = await this.f(`${this.o.baseUrl.replace(/\/+$/, "")}/config`, { signal: AbortSignal.timeout(this.o.timeoutMs ?? 15000) });
    if (!res.ok) throw new MerchantError(`config failed (${res.status})`, res.status, undefined);
    const j = (await res.json()) as { exchanges?: { base_url?: string; currency?: string; master_pub?: string }[] };
    return (j.exchanges ?? [])
      .filter((e) => typeof e.base_url === "string" && typeof e.currency === "string" && typeof e.master_pub === "string")
      .map((e) => ({ baseUrl: e.base_url!, currency: e.currency!, masterPub: e.master_pub! }));
  }

  /**
   * POST /private/orders. create_token is left at its default (true), so the order has a claim token; the token
   * is not returned from here: it reaches the client only inside the Taler Pay URI (draft-taler-charge-03, "Binding").
   * The fulfillment URL may hold the placeholder ${ORDER_ID}, which the backend replaces with the order identifier.
   */
  async createOrder(o: { amount: string; summary: string; fulfillmentUrl: string; payDeadlineS?: number; refundDeadlineS?: number }): Promise<CreatedOrder> {
    const order: Record<string, unknown> = { amount: o.amount, summary: o.summary, fulfillment_url: o.fulfillmentUrl };
    if (o.payDeadlineS !== undefined) order.pay_deadline = { t_s: o.payDeadlineS };
    if (o.refundDeadlineS !== undefined) order.refund_deadline = { t_s: o.refundDeadlineS };
    const { res, json } = await this.priv("POST", "/private/orders", { body: { order } });
    const j = json as { order_id?: string; pay_deadline?: { t_s?: number } } | undefined;
    if (!res.ok || !j?.order_id) throw new MerchantError(`create order failed (${res.status})`, res.status, json);
    return { orderId: j.order_id, ...(typeof j.pay_deadline?.t_s === "number" ? { payDeadlineS: j.pay_deadline.t_s } : {}) };
  }

  /** GET /private/orders/{id}. With timeoutMs the backend long-polls while the order is still unpaid. */
  async orderStatus(orderId: string, opts: { timeoutMs?: number } = {}): Promise<OrderStatus> {
    const q = opts.timeoutMs ? `?timeout_ms=${Math.floor(opts.timeoutMs)}` : "";
    const { res, json } = await this.priv("GET", `/private/orders/${encodeURIComponent(orderId)}${q}`, { extraMs: opts.timeoutMs ?? 0 });
    const j = json as
      | {
          order_status?: string;
          taler_pay_uri?: string;
          contract_terms?: ContractTermsView;
          proto_contract_terms?: ContractTermsView;
          last_payment?: { t_s?: number };
          refunded?: boolean;
          refund_amount?: string;
        }
      | undefined;
    if (!res.ok || !j?.order_status) throw new MerchantError(`order status failed (${res.status})`, res.status, json);
    if (j.order_status !== "unpaid" && j.order_status !== "claimed" && j.order_status !== "paid") {
      throw new MerchantError(`unknown order_status ${j.order_status}`, res.status, json);
    }
    const terms = j.contract_terms ?? j.proto_contract_terms;
    return {
      status: j.order_status,
      ...(j.taler_pay_uri ? { talerPayUri: j.taler_pay_uri } : {}),
      ...(terms ? { terms } : {}),
      ...(typeof j.last_payment?.t_s === "number" ? { lastPaymentS: j.last_payment.t_s } : {}),
      ...(typeof j.refunded === "boolean" ? { refunded: j.refunded } : {}),
      ...(typeof j.refund_amount === "string" ? { refundAmount: j.refund_amount } : {}),
      raw: json,
    };
  }
}

/**
 * The public, credential-free order status used by x402 settle (draft-taler-charge-03, "Payload and Settle"):
 * GET {merchantBaseUrl}orders/{orderId}?h_contract=... The answer is read from the status code alone:
 * 200 paid, 402 not paid, 403 hash mismatch, 404 unknown. No Authorization header is sent.
 */
export async function publicOrderStatus(f: typeof fetch, merchantBaseUrl: string, orderId: string, hContract: string, opts: { timeoutMs?: number; waitMs?: number } = {}): Promise<PublicStatus> {
  const q = new URLSearchParams({ h_contract: hContract });
  if (opts.waitMs) q.set("timeout_ms", String(Math.floor(opts.waitMs)));
  const res = await f(`${merchantBaseUrl}orders/${encodeURIComponent(orderId)}?${q}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout((opts.timeoutMs ?? 15000) + (opts.waitMs ?? 0)),
  });
  await res.arrayBuffer(); // drain
  return { httpStatus: res.status };
}
