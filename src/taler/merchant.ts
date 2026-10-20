// Minimal client for the GNU Taler merchant backend REST API. HTTP only: no Taler library is
// imported, vendored or linked. Endpoint behaviour was probed against https://backend.demo.taler.net
// on 2026-10-20 (see docs/proof-taler-demo.md).

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
}

export interface CreatedOrder {
  orderId: string;
  /** Seconds since epoch, from the backend's reply, if it returned one. */
  payDeadlineS?: number;
}

export interface OrderStatus {
  status: "unpaid" | "claimed" | "paid";
  talerPayUri?: string;
  orderStatusUrl?: string;
  /** contract_terms (paid, claimed) or proto_contract_terms (unpaid). */
  terms?: { amount?: string; summary?: string; fulfillment_url?: string; pay_deadline?: { t_s?: number | "never" } };
  raw: unknown;
}

export interface PublicOrder {
  httpStatus: number;
  talerPayUri?: string;
  fulfillmentUrl?: string;
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
      body: { scope: "order-full", duration: { d_us: 3_600_000_000 }, description: "arvuna prototype" },
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

  /** GET /config on the backend root: currency fractional digits etc. */
  async config(): Promise<{ currency: string; fractionalDigits: number; raw: unknown }> {
    const res = await this.f(`${this.o.baseUrl.replace(/\/+$/, "")}/config`, { signal: AbortSignal.timeout(this.o.timeoutMs ?? 15000) });
    const j = (await res.json()) as { currency?: string; currencies?: Record<string, { num_fractional_normal_digits?: number }> };
    const cur = j.currency ?? "";
    const digits = j.currencies?.[cur]?.num_fractional_normal_digits ?? 2;
    return { currency: cur, fractionalDigits: digits, raw: j };
  }

  /** POST /private/orders. The fulfillment URL is where the wallet is sent after paying. */
  async createOrder(o: { amount: string; summary: string; fulfillmentUrl: string; payDeadlineS?: number }): Promise<CreatedOrder> {
    const order: Record<string, unknown> = { amount: o.amount, summary: o.summary, fulfillment_url: o.fulfillmentUrl };
    if (o.payDeadlineS !== undefined) order.pay_deadline = { t_s: o.payDeadlineS };
    const { res, json } = await this.priv("POST", "/private/orders", { body: { order, create_token: false } });
    const j = json as { order_id?: string; pay_deadline?: { t_s?: number } } | undefined;
    if (!res.ok || !j?.order_id) throw new MerchantError(`create order failed (${res.status})`, res.status, json);
    return { orderId: j.order_id, ...(typeof j.pay_deadline?.t_s === "number" ? { payDeadlineS: j.pay_deadline.t_s } : {}) };
  }

  /** GET /private/orders/{id}. With timeoutMs the backend long-polls while the order is still unpaid. */
  async orderStatus(orderId: string, opts: { timeoutMs?: number } = {}): Promise<OrderStatus> {
    const q = opts.timeoutMs ? `?timeout_ms=${Math.floor(opts.timeoutMs)}` : "";
    const { res, json } = await this.priv("GET", `/private/orders/${encodeURIComponent(orderId)}${q}`, { extraMs: opts.timeoutMs ?? 0 });
    const j = json as
      | { order_status?: string; taler_pay_uri?: string; order_status_url?: string; contract_terms?: OrderStatus["terms"]; proto_contract_terms?: OrderStatus["terms"] }
      | undefined;
    if (!res.ok || !j?.order_status) throw new MerchantError(`order status failed (${res.status})`, res.status, json);
    if (j.order_status !== "unpaid" && j.order_status !== "claimed" && j.order_status !== "paid") {
      throw new MerchantError(`unknown order_status ${j.order_status}`, res.status, json);
    }
    const terms = j.contract_terms ?? j.proto_contract_terms;
    return {
      status: j.order_status,
      ...(j.taler_pay_uri ? { talerPayUri: j.taler_pay_uri } : {}),
      ...(j.order_status_url ? { orderStatusUrl: j.order_status_url } : {}),
      ...(terms ? { terms } : {}),
      raw: json,
    };
  }

  /** Unauthenticated GET /orders/{id}: a 402 with taler_pay_uri while the order is unpaid. */
  async publicOrder(orderId: string): Promise<PublicOrder> {
    const { res, json } = await this.req("GET", `/orders/${encodeURIComponent(orderId)}`);
    const j = json as { taler_pay_uri?: string; fulfillment_url?: string } | undefined;
    return { httpStatus: res.status, ...(j?.taler_pay_uri ? { talerPayUri: j.taler_pay_uri } : {}), ...(j?.fulfillment_url ? { fulfillmentUrl: j.fulfillment_url } : {}) };
  }
}
