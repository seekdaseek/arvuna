// Parsing of the taler://pay URI as defined in LSD 0006 (https://lsd.gnunet.org/lsd0006/), action "pay":
//   taler://pay/{merchant_host}{/merchant_prefix_path*}/{order_id}/{session_id}{?c=ct}
// session_id may be empty. The order identifier is the path segment between the last two slashes once the
// query is removed; the merchant base URL is https:// + host + prefix path + "/" (a taler:// URI means TLS).

export interface PayUri {
  orderId: string;
  /** Absolute, ends with "/". */
  merchantBaseUrl: string;
  sessionId: string;
  /** The claim token, from the "c" query parameter. Treat as a secret. */
  claimToken?: string;
}

export function parsePayUri(uri: string): PayUri {
  const m = /^taler:\/\/pay\/([^?]*)(?:\?(.*))?$/i.exec(uri);
  if (!m) throw new Error("not a taler://pay URI");
  const segs = m[1]!.split("/");
  // host, optional prefix path, order id, session id (possibly empty)
  if (segs.length < 3) throw new Error("taler://pay URI needs host, order id and session id");
  const host = segs[0]!;
  const orderId = segs[segs.length - 2]!;
  const sessionId = segs[segs.length - 1]!;
  if (host === "" || orderId === "") throw new Error("taler://pay URI has an empty host or order id");
  const merchantBaseUrl = "https://" + segs.slice(0, -2).join("/") + "/";
  const token = m[2] === undefined ? undefined : new URLSearchParams(m[2]).get("c") ?? undefined;
  return { orderId, merchantBaseUrl, sessionId, ...(token ? { claimToken: token } : {}) };
}
