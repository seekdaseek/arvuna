// WWW-Authenticate parsing and formatting for the Payment scheme (RFC 9110 §11 auth-params),
// plus the HMAC-SHA256 challenge binding from draft-httpauth-payment-01.
import { createHmac, timingSafeEqual } from "node:crypto";
import { b64urlEncode } from "./encoding.ts";

export interface AuthParam {
  name: string;
  value: string;
  quoted: boolean;
}

export interface ParsedChallenge {
  scheme: string;
  params: AuthParam[];
  /** Lower-cased name -> value (first occurrence wins). */
  map: Map<string, string>;
  duplicates: string[];
  /** Syntax problems found while parsing this challenge. */
  errors: string[];
}

const TCHAR = /[!#$%&'*+\-.^_`|~0-9A-Za-z]/;
const isWs = (c: string | undefined) => c === " " || c === "\t";

/**
 * Parses a WWW-Authenticate field value that may hold several challenges
 * (several header lines are joined with ", " by fetch()). Tolerant: it reports problems
 * in `errors` rather than throwing.
 */
export function parseWwwAuthenticate(header: string): ParsedChallenge[] {
  const out: ParsedChallenge[] = [];
  let i = 0;
  const n = header.length;
  let cur: ParsedChallenge | null = null;

  const skipWs = () => {
    while (i < n && isWs(header[i])) i++;
  };
  const readToken = (): string => {
    const start = i;
    while (i < n && TCHAR.test(header[i]!)) i++;
    return header.slice(start, i);
  };
  const readQuoted = (): { value: string; ok: boolean } => {
    i++; // opening quote
    let v = "";
    while (i < n) {
      const c = header[i]!;
      if (c === "\\") {
        if (i + 1 >= n) return { value: v, ok: false };
        v += header[i + 1];
        i += 2;
      } else if (c === '"') {
        i++;
        return { value: v, ok: true };
      } else {
        v += c;
        i++;
      }
    }
    return { value: v, ok: false };
  };

  while (i < n) {
    skipWs();
    while (header[i] === ",") {
      i++;
      skipWs();
    }
    if (i >= n) break;
    const token = readToken();
    if (token === "") {
      // Unparseable byte: record against the current challenge and skip to the next comma.
      (cur?.errors ?? []).push(`unexpected character ${JSON.stringify(header[i])} at offset ${i}`);
      while (i < n && header[i] !== ",") i++;
      continue;
    }
    skipWs();
    const isParam = header[i] === "=" && header[i + 1] !== "=" && i + 1 < n;
    if (isParam && cur) {
      i++; // '='
      skipWs();
      let value: string;
      let quoted = false;
      if (header[i] === '"') {
        const q = readQuoted();
        value = q.value;
        quoted = true;
        if (!q.ok) cur.errors.push(`unterminated quoted-string for "${token}"`);
      } else {
        value = readToken();
        if (value === "") cur.errors.push(`empty value for "${token}"`);
      }
      const lname = token.toLowerCase();
      if (cur.map.has(lname)) cur.duplicates.push(lname);
      else cur.map.set(lname, value);
      cur.params.push({ name: token, value, quoted });
    } else {
      // A new challenge scheme. A token68 argument of some other scheme (Negotiate abc==)
      // shows up as a pseudo-scheme here, which callers filter out by scheme name.
      cur = { scheme: token, params: [], map: new Map(), duplicates: [], errors: [] };
      out.push(cur);
    }
  }
  return out;
}

export function quote(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export interface PaymentChallengeFields {
  id: string;
  realm: string;
  method: string;
  intent: string;
  request: string; // base64url of the JCS-serialised request
  expires?: string;
  digest?: string;
  description?: string;
  header?: string;
  opaque?: string;
}

export function formatPaymentChallenge(c: PaymentChallengeFields): string {
  const parts = [
    `id=${quote(c.id)}`,
    `realm=${quote(c.realm)}`,
    `method=${quote(c.method)}`,
    `intent=${quote(c.intent)}`,
  ];
  if (c.expires !== undefined) parts.push(`expires=${quote(c.expires)}`);
  if (c.digest !== undefined) parts.push(`digest=${quote(c.digest)}`);
  if (c.description !== undefined) parts.push(`description=${quote(c.description)}`);
  if (c.header !== undefined) parts.push(`header=${quote(c.header)}`);
  if (c.opaque !== undefined) parts.push(`opaque=${quote(c.opaque)}`);
  parts.push(`request=${quote(c.request)}`);
  return `Payment ${parts.join(", ")}`;
}

/**
 * Challenge id per draft-httpauth-payment-01, "Recommended: HMAC-SHA256 Binding":
 * HMAC over realm|method|intent|request|expires|digest[|header]|opaque, base64url without padding.
 */
export function challengeId(secret: string | Uint8Array, c: Omit<PaymentChallengeFields, "id" | "description">): string {
  const slots = [c.realm, c.method, c.intent, c.request, c.expires ?? "", c.digest ?? ""];
  if (c.header !== undefined) slots.push(c.header);
  slots.push(c.opaque ?? "");
  return b64urlEncode(createHmac("sha256", secret).update(slots.join("|"), "utf8").digest());
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
