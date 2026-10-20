// A tiny stand-in for the Taler merchant backend, for offline tests. It speaks only the four
// endpoints the prototype uses, with the response shapes observed on backend.demo.taler.net.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface FakeOrder {
  id: string;
  amount: string;
  summary: string;
  fulfillment_url: string;
  pay_deadline_s: number;
  paid: boolean;
}

export interface FakeMerchant {
  url: string;
  orders: Map<string, FakeOrder>;
  /** Make the next requests fail with this status, or 0 to stop failing. */
  failWith: { status: number };
  pay(orderId: string): void;
  close(): Promise<void>;
}

export async function startFakeMerchant(instance = "sandbox"): Promise<FakeMerchant> {
  const orders = new Map<string, FakeOrder>();
  const failWith = { status: 0 };
  let n = 0;
  const base = `/instances/${instance}`;
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      const u = new URL(req.url ?? "/", "http://x");
      const path = u.pathname;
      if (failWith.status) return send(failWith.status, { code: 1, hint: "injected failure" });
      if (req.method === "GET" && path === "/config") {
        return send(200, { currency: "KUDOS", currencies: { KUDOS: { num_fractional_normal_digits: 2 } } });
      }
      if (!path.startsWith(base)) return send(404, { code: 2 });
      const p = path.slice(base.length);
      if (req.method === "POST" && p === "/private/token") {
        if (!/^Basic /.test(req.headers.authorization ?? "")) return send(401, { code: 2015 });
        return send(200, { access_token: "secret-token:faketoken", expiration: { t_s: Math.floor(Date.now() / 1000) + 3600 } });
      }
      const authed = req.headers.authorization === "Bearer secret-token:faketoken";
      if (req.method === "POST" && p === "/private/orders") {
        if (!authed) return send(401, { code: 2015 });
        const o = JSON.parse(Buffer.concat(chunks).toString()).order;
        const id = `fake-${++n}`;
        const deadline = o.pay_deadline?.t_s ?? Math.floor(Date.now() / 1000) + 86400;
        orders.set(id, { id, amount: o.amount, summary: o.summary, fulfillment_url: o.fulfillment_url, pay_deadline_s: deadline, paid: false });
        return send(200, { order_id: id, pay_deadline: { t_s: deadline } });
      }
      let m = /^\/private\/orders\/([^/]+)$/.exec(p);
      if (req.method === "GET" && m) {
        if (!authed) return send(401, { code: 2015 });
        const o = orders.get(decodeURIComponent(m[1]!));
        if (!o) return send(404, { code: 2000 });
        const terms = { amount: o.amount, summary: o.summary, fulfillment_url: o.fulfillment_url, pay_deadline: { t_s: o.pay_deadline_s } };
        return o.paid
          ? send(200, { order_status: "paid", contract_terms: terms, wired: false })
          : send(200, { order_status: "unpaid", proto_contract_terms: terms, taler_pay_uri: payUri(o.id) });
      }
      m = /^\/orders\/([^/]+)$/.exec(p);
      if (req.method === "GET" && m) {
        const o = orders.get(decodeURIComponent(m[1]!));
        if (!o) return send(404, { code: 2000 });
        return o.paid ? send(200, { order_status: "paid" }) : send(402, { taler_pay_uri: payUri(o.id), fulfillment_url: o.fulfillment_url });
      }
      send(404, { code: 404 });
    });
  });
  const payUri = (id: string) => `taler://pay/fake.example/instances/${instance}/${id}/`;
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    orders,
    failWith,
    pay: (id) => {
      const o = orders.get(id);
      if (!o) throw new Error("no such order " + id);
      o.paid = true;
    },
    close: () => new Promise<void>((r) => { server.close(() => r()); server.closeAllConnections(); }),
  };
}
