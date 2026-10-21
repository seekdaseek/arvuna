// Crockford Base32 as Taler writes hashes, keys and signatures (docs.taler.net/core/api-common.html, "Hash codes",
// "Public keys", "Signatures"): bytes are read most-significant bit first, five bits to a character, and the unused low
// bits of the last character are zero (a 64-byte value is 103 characters, a 32-byte value 52). The alphabet has no I, L, O, U.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function crockfordEncode(bytes: Uint8Array): string {
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  while (bits.length % 5) bits += "0";
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

/** Decodes exactly `byteLength` bytes, or returns undefined if the text is not the canonical encoding of that many bytes. */
export function crockfordDecode(text: string, byteLength: number): Uint8Array | undefined {
  if (text.length !== Math.ceil((byteLength * 8) / 5)) return undefined;
  let bits = "";
  for (const c of text) {
    const v = ALPHABET.indexOf(c);
    if (v < 0) return undefined;
    bits += v.toString(2).padStart(5, "0");
  }
  if (/1/.test(bits.slice(byteLength * 8))) return undefined; // the pad bits must be zero
  const out = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}
