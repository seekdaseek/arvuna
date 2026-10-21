// Which exchanges an order accepts (draft-taler-charge-03, "Exchanges").
//   - the list comes from the merchant backend's GET /config (exchanges: base_url, currency, master_pub),
//     filtered to the order's currency;
//   - each exchange is asked for its own /keys, and is listed only if it confirms the master public key the merchant configured.
// The amount unit does not come from here: it is always 10^-8 (draft-taler-charge-03, "Amount").
import type { MerchantClient } from "./merchant.ts";

export interface ListedExchange {
  url: string;
  masterPub: string;
}

export interface ExchangeInfo {
  exchanges: ListedExchange[];
}

export async function discoverExchanges(merchant: MerchantClient, currency: string, f: typeof fetch = fetch, timeoutMs = 15000): Promise<ExchangeInfo> {
  const cfg = await merchant.exchangesFromConfig();
  const wanted = currency.toLowerCase();
  const listed = cfg.filter((e) => e.currency.toLowerCase() === wanted);
  if (listed.length === 0) throw new Error(`the merchant backend trusts no exchange for ${currency}`);
  const exchanges: ListedExchange[] = [];
  for (const e of listed) {
    const base = e.baseUrl.endsWith("/") ? e.baseUrl : e.baseUrl + "/";
    const res = await f(`${base}keys`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`exchange ${base} answered ${res.status} for /keys`);
    const keys = (await res.json()) as { master_public_key?: string };
    // The merchant trusts an exchange only for the master key it configured; if the exchange says otherwise, do not list it.
    if (keys.master_public_key !== e.masterPub) continue;
    exchanges.push({ url: base, masterPub: e.masterPub });
  }
  if (exchanges.length === 0) throw new Error(`no configured exchange for ${currency} confirmed its master public key`);
  return { exchanges };
}
