// Which exchanges an order accepts, and what unit its amount is written in
// (draft-taler-charge-02, "Exchanges" and "Amount").
//   - the list comes from the merchant backend's GET /config (exchanges: base_url, currency, master_pub),
//     filtered to the order's currency;
//   - the unit comes from the exchange's own GET /keys (currency_specification.num_fractional_input_digits),
//     not from the merchant's /config, which the documentation calls a hint. Where no listed exchange publishes
//     one, or they disagree, the unit is 10^-8 (the Taler amount precision).
import type { MerchantClient } from "./merchant.ts";

export interface ListedExchange {
  url: string;
  masterPub: string;
}

export interface ExchangeInfo {
  exchanges: ListedExchange[];
  /** d in "base unit = 10^-d of the currency". */
  digits: number;
  /** What each listed exchange published, for logs and tests. */
  published: { url: string; digits?: number }[];
}

export async function discoverExchanges(merchant: MerchantClient, currency: string, f: typeof fetch = fetch, timeoutMs = 15000): Promise<ExchangeInfo> {
  const cfg = await merchant.exchangesFromConfig();
  const wanted = currency.toLowerCase();
  const listed = cfg.filter((e) => e.currency.toLowerCase() === wanted);
  if (listed.length === 0) throw new Error(`the merchant backend trusts no exchange for ${currency}`);
  const published: ExchangeInfo["published"] = [];
  const exchanges: ListedExchange[] = [];
  for (const e of listed) {
    const base = e.baseUrl.endsWith("/") ? e.baseUrl : e.baseUrl + "/";
    const res = await f(`${base}keys`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`exchange ${base} answered ${res.status} for /keys`);
    const keys = (await res.json()) as { master_public_key?: string; currency_specification?: { num_fractional_input_digits?: number } };
    // The merchant trusts an exchange only for the master key it configured; if the exchange says otherwise, do not list it.
    if (keys.master_public_key !== e.masterPub) continue;
    exchanges.push({ url: base, masterPub: e.masterPub });
    const d = keys.currency_specification?.num_fractional_input_digits;
    published.push({ url: base, ...(Number.isInteger(d) && d! >= 0 && d! <= 8 ? { digits: d! } : {}) });
  }
  if (exchanges.length === 0) throw new Error(`no configured exchange for ${currency} confirmed its master public key`);
  const ds = new Set(published.map((p) => p.digits).filter((d): d is number => d !== undefined));
  const digits = ds.size === 1 ? [...ds][0]! : 8;
  return { exchanges, digits, published };
}
