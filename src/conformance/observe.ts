import type { Observed } from "./types.ts";

// The checker looks; it never pays. These request headers carry credentials or payments and are refused outright.
const FORBIDDEN = /^(authorization|payment-authorization|payment-signature|x-payment|x-payment-signature|cookie|proxy-authorization)$/i;

export interface ObserveOptions {
  method?: string;
  /** Request body for POST endpoints. Sent as application/json. Not a credential. */
  data?: string;
  /** Extra non-credential headers. */
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function observe(url: string, opts: ObserveOptions = {}): Promise<Observed> {
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("only http(s) URLs");
  for (const k of Object.keys(opts.headers ?? {})) {
    if (FORBIDDEN.test(k)) throw new Error(`refusing to send ${k}: arvuna-check never sends a credential`);
  }
  const method = (opts.method ?? "GET").toUpperCase();
  const res = await fetch(u, {
    method,
    headers: { "user-agent": "arvuna-check/0.0.1 (+https://github.com/seekdaseek/arvuna)", accept: "application/json, */*;q=0.5", ...(opts.data ? { "content-type": "application/json" } : {}), ...opts.headers },
    ...(opts.data ? { body: opts.data } : {}),
    redirect: "follow",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20000),
  });
  const at = Date.now();
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const buf = Buffer.from(await res.arrayBuffer());
  const LIMIT = 262_144;
  return {
    url, finalUrl: res.url || url, method, status: res.status, headers,
    body: buf.subarray(0, LIMIT).toString("utf8"), bodyTruncated: buf.length > LIMIT, at,
  };
}
