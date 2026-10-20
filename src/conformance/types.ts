export type Status = "PASS" | "FAIL" | "WARN" | "N/A";

export interface RuleResult {
  /** Stable rule id, e.g. IETF-06 or X402-08. */
  id: string;
  status: Status;
  rule: string;
  /** Where the rule comes from. */
  spec: string;
  detail?: string;
}

/** What one unauthenticated request to the target returned. */
export interface Observed {
  url: string;
  finalUrl: string;
  method: string;
  status: number;
  /** Lower-cased header name -> value. Repeated lines are joined with ", " by fetch(). */
  headers: Record<string, string>;
  body: string;
  bodyTruncated: boolean;
  /** Time of observation, ms since epoch; expiry checks compare against it. */
  at: number;
}

// Short names for the sources, so every row can cite one.
export const HTTPAUTH = "draft-httpauth-payment-01";
export const CHARGE = "draft-payment-intent-charge-00";
export const X402 = "x402 v2 spec";
export const X402HTTP = "x402 transports-v2/http.md";
