// GNU Taler amounts are "CURRENCY:VALUE[.FRACTION]" (docs.taler.net/core/api-common.html, "Amounts"): a currency of at most
// 11 ASCII letters, an integer part of at most 2^52 and a fraction of at most 8 decimal digits. Both 402 formats carry the amount
// as an integer in base units, and the base unit is always 10^-8 of the currency (draft-taler-charge-03, "Amount"), so no
// currency specification is ever looked up. Each format also carries the Taler amount string itself (`talerAmount`).

export interface TalerAmount {
  currency: string;
  /** Value in units of 1e-8. */
  atoms: bigint;
}

const AMOUNT = /^([A-Za-z]{1,11}):(\d+)(?:\.(\d{1,8}))?$/;
const SCALE = 8;
const MAX_VALUE = 2n ** 52n;

export function parseAmount(s: string): TalerAmount {
  const m = AMOUNT.exec(s);
  if (!m || BigInt(m[2]!) > MAX_VALUE) throw new Error(`invalid Taler amount: ${JSON.stringify(s)}`);
  const whole = BigInt(m[2]!);
  const frac = BigInt((m[3] ?? "").padEnd(SCALE, "0") || "0");
  return { currency: m[1]!, atoms: whole * 10n ** BigInt(SCALE) + frac };
}

/** The `amount` field: the value in units of 10^-8, as a decimal integer string with no leading zeros. */
export function toBaseUnits(a: TalerAmount): string {
  return a.atoms.toString();
}

export function sameAmount(a: string, b: string): boolean {
  try {
    const x = parseAmount(a);
    const y = parseAmount(b);
    return x.currency === y.currency && x.atoms === y.atoms;
  } catch {
    return false;
  }
}

/**
 * The client's check of draft-taler-charge-03, "Amount": `amount` (base units) and `talerAmount` describe the same value, as
 * exact decimals, and `currency` is the same currency (compared without regard to case). Returns a reason, or undefined if they agree.
 */
export function amountMismatch(amount: unknown, currency: unknown, talerAmount: unknown): string | undefined {
  if (typeof talerAmount !== "string") return "talerAmount is missing";
  if (typeof amount !== "string" || !/^(0|[1-9]\d*)$/.test(amount)) return "amount is not a decimal integer string";
  if (typeof currency !== "string") return "currency is missing";
  let t: TalerAmount;
  try {
    t = parseAmount(talerAmount);
  } catch {
    return "talerAmount is not a Taler amount";
  }
  if (currency.toLowerCase() !== t.currency.toLowerCase()) return "currency differs from talerAmount";
  if (BigInt(amount) !== t.atoms) return "amount differs from talerAmount";
  return undefined;
}
