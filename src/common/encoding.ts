// Base64 variants and JSON Canonicalization (RFC 8785) used by both 402 formats.

const B64URL = /^[A-Za-z0-9_-]*$/;
const B64STD = /^[A-Za-z0-9+/]*={0,2}$/;

export function b64urlEncode(data: string | Uint8Array): string {
  return Buffer.from(data).toString("base64url");
}

/** Strict base64url without padding (draft-httpauth-payment-01, ABNF base64url-nopad). Returns null if malformed. */
export function b64urlDecode(s: string): Uint8Array | null {
  if (s.length === 0 || !B64URL.test(s) || s.length % 4 === 1) return null;
  return Buffer.from(s, "base64url");
}

export function b64Encode(data: string | Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

/** Standard-alphabet base64, as used by the x402 HTTP headers. Padding optional. Returns null if malformed. */
export function b64Decode(s: string): Uint8Array | null {
  if (s.length === 0 || !B64STD.test(s)) return null;
  const bare = s.replace(/=+$/, "");
  if (bare.length % 4 === 1) return null;
  return Buffer.from(bare, "base64");
}

export function utf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** JSON Canonicalization Scheme, RFC 8785. Sufficient for strings, finite numbers, booleans, null, arrays, objects. */
export function jcs(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("jcs: non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${jcs(o[k])}`).join(",")}}`;
  }
  throw new TypeError(`jcs: unsupported type ${typeof value}`);
}

export function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
