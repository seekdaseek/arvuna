// A tiny stand-in for the Taler merchant backend and its exchanges, for offline tests. It speaks only what the
// prototype uses, with the response shapes and status codes observed on backend.demo.taler.net:
//   GET /config                       the exchanges the merchant trusts (and a decoy currency specification)
//   GET <exchange>/keys               master_public_key and currency_specification
//   POST /instances/sandbox/private/token, POST|GET /private/orders[/id]
//   GET /instances/sandbox/orders/id  public status: 200 paid, 402 unpaid, 403 hash mismatch, 404 unknown
import { createServer, type IncomingMessage, type Server } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { crockfordEncode as crockford } from "./crockford.ts";
import type { AddressInfo } from "node:net";

export interface FakeOrder {
  id: string;
  amount: string;
  summary: string;
  fulfillmentTemplate: string;
  fulfillmentUrl: string;
  payDeadlineS: number;
  refundDeadlineS: number;
  token: string | undefined;
  claimed: boolean;
  paid: boolean;
  lastPaymentS: number;
  refundAmount: string;
  /** If set, the contract hash this order reports instead of the one derived from its fields (see useContractHash). */
  hOverride?: string;
}

export interface FakeExchange {
  /** Path prefix, e.g. "/exchange-a". */
  path: string;
  masterPub: string;
  currency: string;
  /** num_fractional_input_digits to publish; null publishes no currency specification. The paywall must ignore it (draft-taler-charge-03, "Amount"). */
  digits: number | null;
  /** What the exchange itself reports as its master key, if it should disagree with the merchant's configuration. */
  reportedMasterPub?: string;
}

export interface FakeMerchant {
  url: string;
  /** host:port, as it appears in a taler://pay URI. */
  host: string;
  orders: Map<string, FakeOrder>;
  exchanges: FakeExchange[];
  /** Exchanges the paid contract should list; defaults to every configured exchange of the order's currency. */
  contractExchanges: { url: string; master_pub: string }[] | undefined;
  failWith: { status: number };
  /** Scopes requested at /private/token. */
  scopes: string[];
  /** For each created order, whether create_token was left on. */
  createToken: boolean[];
  /** Public status requests seen: the path, the query and whether any Authorization header came with them. */
  publicRequests: { path: string; query: string; hadAuthorization: boolean }[];
  /** A wallet claims the order (pay-prepare); returns the contract hash the wallet would record. */
  claim(orderId: string): string;
  /** A wallet pays the order; returns the contract hash. */
  pay(orderId: string): string;
  contractHash(orderId: string): string;
  /** Makes the order report this contract hash, e.g. one for which a real merchant signature is known. */
  useContractHash(orderId: string, h: string): void;
  setRefund(orderId: string, amount: string): void;
  forget(orderId: string): void;
  /** Rewrites https://host:port to the fake's plain-http URL, for the paywall's fetch. */
  fetchViaHttp: typeof fetch;
  close(): Promise<void>;
}

export const MASTER_A = "F80MFRG8HVH6R9CQ47KRFQSJP3T6DBJ4K1D9B703RJY3Z39TBMJ0"; // the public demo exchange's key
export const MASTER_B = "0123456789ABCDEFGHJKMNPQRSTVWXYZ0123456789ABCDEFGHJK";
export const MASTER_CHF = "9V0G82S7JQW2ZRYF7BMGKKQ1TNR1VNVXZJSNQ2VSDGWC80D9W0YG";

/** The merchant public key of a real payment on the demo backend: the fake serves it as `merchant_pub` of every contract, and
 *  holds no private key, so only signatures that a real merchant made (src/taler/testdata) can verify against it. */
export const VECTOR = JSON.parse(readFileSync(new URL("./testdata/merchant-pay-sig-vector.json", import.meta.url), "utf8")) as {
  merchantPub: string; hContract: string; merchantSig: string; orderId: string;
};

export async function startFakeMerchant(): Promise<FakeMerchant> {
  const orders = new Map<string, FakeOrder>();
  const failWith = { status: 0 };
  const scopes: string[] = [];
  const createToken: boolean[] = [];
  const publicRequests: FakeMerchant["publicRequests"] = [];
  let n = 0;
  let port = 0;
  const exchanges: FakeExchange[] = [
    { path: "/exchange-a", masterPub: MASTER_A, currency: "KUDOS", digits: 2 },
    { path: "/exchange-chf", masterPub: MASTER_CHF, currency: "CHF", digits: 2 },
  ];
  const state = { contractExchanges: undefined as FakeMerchant["contractExchanges"] };
  const base = "/instances/sandbox";
  const host = () => `127.0.0.1:${port}`;
  const merchantBaseUrl = () => `https://${host()}${base}/`;
  const exUrl = (e: FakeExchange) => `http://${host()}${e.path}/`;
  const hashOf = (o: FakeOrder) => o.hOverride ?? crockford(createHash("sha512").update(JSON.stringify([o.id, o.amount, o.fulfillmentUrl, o.payDeadlineS])).digest());
  const terms = (o: FakeOrder) => ({
    amount: o.amount, summary: o.summary, order_id: o.id, fulfillment_url: o.fulfillmentUrl,
    merchant_base_url: merchantBaseUrl(), merchant_pub: VECTOR.merchantPub, pay_deadline: { t_s: o.payDeadlineS }, refund_deadline: { t_s: o.refundDeadlineS },
    exchanges: state.contractExchanges ?? exchanges.filter((e) => e.currency === o.amount.split(":")[0]).map((e) => ({ url: exUrl(e), priority: 1024, master_pub: e.masterPub })),
  });
  const payUri = (o: FakeOrder) => `taler://pay/${host()}${base}/${o.id}/${o.token && !o.claimed ? `?c=${o.token}` : ""}`;

  const server: Server = createServer((req: IncomingMessage, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      const u = new URL(req.url ?? "/", "http://x");
      const path = u.pathname;
      if (req.method === "GET" && path === "/config") {
        return send(200, {
          currency: "KUDOS",
          // A decoy: the paywall must NOT take its amount unit from here (the documentation calls it a hint).
          currencies: { KUDOS: { num_fractional_normal_digits: 3, num_fractional_input_digits: 3 } },
          exchanges: exchanges.map((e) => ({ base_url: exUrl(e), currency: e.currency, master_pub: e.masterPub })),
        });
      }
      const ex = exchanges.find((e) => path === `${e.path}/keys`);
      if (req.method === "GET" && ex) {
        return send(200, {
          master_public_key: ex.reportedMasterPub ?? ex.masterPub, currency: ex.currency, base_url: exUrl(ex),
          ...(ex.digits === null ? {} : { currency_specification: { name: ex.currency, num_fractional_input_digits: ex.digits, num_fractional_normal_digits: ex.digits, num_fractional_trailing_zero_digits: ex.digits, alt_unit_names: { "0": ex.currency }, common_amounts: [] } }),
        });
      }
      if (!path.startsWith(base)) return send(404, { code: 2 });
      const p = path.slice(base.length);

      // public order status
      let m = /^\/orders\/([^/]+)$/.exec(p);
      if (req.method === "GET" && m) {
        publicRequests.push({ path: p, query: u.search, hadAuthorization: req.headers.authorization !== undefined });
        if (failWith.status) return send(failWith.status, { code: 1 });
        const o = orders.get(decodeURIComponent(m[1]!));
        if (!o) return send(404, { code: 2005, hint: "The proposal is not known to the backend." });
        const h = u.searchParams.get("h_contract");
        if (h !== null && o.claimed && h !== hashOf(o)) return send(403, { code: 2009, hint: "The order we found does not match the provided contract hash." });
        if (o.paid) return send(200, { fulfillment_url: o.fulfillmentUrl, refunded: false, refund_pending: false, refund_taken: "KUDOS:0", refund_amount: "KUDOS:0" });
        if (o.claimed && h !== null) return send(402, { taler_pay_uri: payUri(o), fulfillment_url: o.fulfillmentUrl });
        return send(403, { code: 2105, hint: "The claim token used to authenticate the client is invalid for this order." });
      }

      if (failWith.status) return send(failWith.status, { code: 1, hint: "injected failure" });
      if (req.method === "POST" && p === "/private/token") {
        if (!/^Basic /.test(req.headers.authorization ?? "")) return send(401, { code: 2015 });
        scopes.push(JSON.parse(Buffer.concat(chunks).toString() || "{}").scope);
        return send(200, { access_token: "secret-token:faketoken", expiration: { t_s: Math.floor(Date.now() / 1000) + 3600 } });
      }
      const authed = req.headers.authorization === "Bearer secret-token:faketoken";
      if (req.method === "POST" && p === "/private/orders") {
        if (!authed) return send(401, { code: 2015 });
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const o = body.order;
        const id = `fake-${++n}`;
        const wantsToken = body.create_token !== false;
        createToken.push(wantsToken);
        const pay = o.pay_deadline?.t_s ?? Math.floor(Date.now() / 1000) + 86400;
        const order: FakeOrder = {
          id, amount: o.amount, summary: o.summary, fulfillmentTemplate: o.fulfillment_url, fulfillmentUrl: String(o.fulfillment_url).replace("${ORDER_ID}", id),
          payDeadlineS: pay, refundDeadlineS: o.refund_deadline?.t_s ?? 0, token: wantsToken ? `TOK${String(n).padStart(23, "0")}` : undefined,
          claimed: false, paid: false, lastPaymentS: 0, refundAmount: `${o.amount.split(":")[0]}:0`,
        };
        orders.set(id, order);
        return send(200, { order_id: id, pay_deadline: { t_s: pay }, ...(order.token ? { token: order.token } : {}) });
      }
      m = /^\/private\/orders\/([^/]+)$/.exec(p);
      if (req.method === "GET" && m) {
        if (!authed) return send(401, { code: 2015 });
        const o = orders.get(decodeURIComponent(m[1]!));
        if (!o) return send(404, { code: 2000 });
        if (o.paid) return send(200, { order_status: "paid", contract_terms: terms(o), last_payment: { t_s: o.lastPaymentS }, refunded: o.refundAmount.split(":")[1] !== "0", refund_amount: o.refundAmount, wired: false });
        if (o.claimed) return send(200, { order_status: "claimed", contract_terms: terms(o), order_status_url: "" });
        return send(200, { order_status: "unpaid", proto_contract_terms: terms(o), taler_pay_uri: payUri(o) });
      }
      send(404, { code: 404 });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${port}`;
  const get = (id: string) => {
    const o = orders.get(id);
    if (!o) throw new Error("no such order " + id);
    return o;
  };
  return {
    url: origin, host: host(), orders, exchanges, failWith, scopes, createToken, publicRequests,
    get contractExchanges() { return state.contractExchanges; },
    set contractExchanges(v) { state.contractExchanges = v; },
    claim: (id) => { const o = get(id); o.claimed = true; return hashOf(o); },
    pay: (id) => { const o = get(id); o.claimed = true; o.paid = true; o.lastPaymentS = Math.floor(Date.now() / 1000); return hashOf(o); },
    contractHash: (id) => hashOf(get(id)),
    useContractHash: (id, h) => { get(id).hOverride = h; },
    setRefund: (id, a) => { get(id).refundAmount = a; },
    forget: (id) => { orders.delete(id); },
    fetchViaHttp: ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const s = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return fetch(s.replace(`https://${host()}`, origin), init);
    }) as typeof fetch,
    close: () => new Promise<void>((r) => { server.close(() => r()); server.closeAllConnections(); }),
  };
}
