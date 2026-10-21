// The merchant's payment signature, draft-taler-charge-03, "Merchant Payment Signature".
//
// What is signed is `struct TALER_PaymentResponsePS` in the exchange repository, src/util/merchant_signatures.c:
//   struct GNUNET_CRYPTO_SignaturePurpose purpose;   // u32 size, u32 purpose, both big-endian (htonl in the source)
//   struct TALER_PrivateContractHashP h_contract_terms;   // 64 bytes
// with purpose TALER_SIGNATURE_MERCHANT_PAYMENT_OK = 1104 (src/include/taler/taler_signatures.h) and size = sizeof(struct) = 72.
// The framing (size, then purpose, then the fields, the whole struct signed) is the one the documentation gives in
// docs.taler.net/core/api-common.html, "Signatures". The signature is EdDSA with the merchant's public key.
import { createPublicKey, verify } from "node:crypto";
import { crockfordDecode } from "./crockford.ts";

export const TALER_SIGNATURE_MERCHANT_PAYMENT_OK = 1104;
export const PAYMENT_RESPONSE_SIZE = 72;
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** The 72 bytes the merchant signs for a contract hash (64 bytes), or undefined if `hContract` is not a Taler hash code. */
export function paymentResponseMessage(hContract: string): Buffer | undefined {
  const h = crockfordDecode(hContract, 64);
  if (!h) return undefined;
  const m = Buffer.alloc(PAYMENT_RESPONSE_SIZE);
  m.writeUInt32BE(PAYMENT_RESPONSE_SIZE, 0);
  m.writeUInt32BE(TALER_SIGNATURE_MERCHANT_PAYMENT_OK, 4);
  Buffer.from(h).copy(m, 8);
  return m;
}

/** True only if `merchantSig` (EdDSA, 64 bytes, Crockford Base32) is the merchant's signature over `hContract`. Never throws. */
export function verifyMerchantSig(hContract: string, merchantSig: string, merchantPub: string): boolean {
  try {
    const msg = paymentResponseMessage(hContract);
    const sig = crockfordDecode(merchantSig, 64);
    const pub = crockfordDecode(merchantPub, 32);
    if (!msg || !sig || !pub) return false;
    const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, pub]), format: "der", type: "spki" });
    return verify(null, msg, key, Buffer.from(sig));
  } catch {
    return false;
  }
}
