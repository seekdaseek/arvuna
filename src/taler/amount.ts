// GNU Taler amounts are "CURRENCY:VALUE[.FRACTION]" with at most 8 fractional digits.
// Both 402 formats want integer "base units" strings, so we convert using the number of
// fractional digits the backend reports for the currency (KUDOS: 2).

export interface TalerAmount {
  currency: string;
  /** Value in units of 1e-8. */
  atoms: bigint;
}

const AMOUNT = /^([A-Za-z0-9_-]{1,11}):(\d+)(?:\.(\d{1,8}))?$/;
const SCALE = 8;

export function parseAmount(s: string): TalerAmount {
  const m = AMOUNT.exec(s);
  if (!m) throw new Error(`invalid Taler amount: ${JSON.stringify(s)}`);
  const whole = BigInt(m[2]!);
  const frac = BigInt((m[3] ?? "").padEnd(SCALE, "0") || "0");
  return { currency: m[1]!, atoms: whole * 10n ** BigInt(SCALE) + frac };
}

/** Integer string in units of 10^-digits of the currency. Throws if the amount is not representable. */
export function toBaseUnits(a: TalerAmount, digits: number): string {
  if (!Number.isInteger(digits) || digits < 0 || digits > SCALE) throw new Error(`bad digits: ${digits}`);
  const div = 10n ** BigInt(SCALE - digits);
  if (a.atoms % div !== 0n) throw new Error(`amount not representable with ${digits} fractional digits`);
  return (a.atoms / div).toString();
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
