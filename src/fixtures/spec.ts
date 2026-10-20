// Fixtures copied from the specifications. Each constant cites its source.
// Sources, fetched 2026-10-20:
//   CORE    github.com/tempoxyz/mpp-specs  specs/core/draft-httpauth-payment-01.md
//   CHARGE  github.com/tempoxyz/mpp-specs  specs/intents/draft-payment-intent-charge-00.md
//   X402    github.com/x402-foundation/x402  specs/x402-specification-v2.md
//   X402HTTP github.com/x402-foundation/x402 specs/transports-v2/http.md

/** CORE, section "Example Challenge". */
export const CORE_EXAMPLE_CHALLENGE =
  'Payment id="x7Tg2pLqR9mKvNwY3hBcZa", realm="api.example.com", method="example", intent="charge", ' +
  'expires="2025-01-15T12:05:00Z", request="eyJhbW91bnQiOiIxMDAwIiwiY3VycmVuY3kiOiJVU0QiLCJyZWNpcGllbnQiOiJhY2N0XzEyMyJ9"';

/** CORE, "Example Challenge": the `request` value, whose base64url decodes to currency "USD" although
 *  the spec's own "Decoded request example" under it shows "usd". */
export const CORE_EXAMPLE_REQUEST_B64 = "eyJhbW91bnQiOiIxMDAwIiwiY3VycmVuY3kiOiJVU0QiLCJyZWNpcGllbnQiOiJhY2N0XzEyMyJ9";

/** CORE, section "Multiple Payment Options": two challenges, as fetch() joins two header lines. */
export const CORE_MULTIPLE =
  'Payment id="pT7yHnKmQ2wErXsZ5vCbNl", realm="api.example.com", method="invoice", intent="charge", request="e30", ' +
  'Payment id="mF8uJkLpO3qRtYsA6wDcVb", realm="api.example.com", method="signed", intent="charge", request="e30"';

/** CORE, section "HMAC-SHA256 Test Vectors". Secret is the UTF-8 string below; request is {"amount":"1000000"}. */
export const CORE_HMAC_SECRET = "test-vector-secret";
export const CORE_HMAC_REQUEST_B64 = "eyJhbW91bnQiOiIxMDAwMDAwIn0";
export const CORE_HMAC_VECTORS = [
  { name: "legacy layout, neither header nor opaque", header: undefined, opaque: undefined, id: "X6v1eo7fJ76gAxqY0xN9Jd__4lUyDDYmriryOM-5FO4" },
  { name: "header only", header: "Payment-Authorization", opaque: undefined, id: "S91xi-OFGZPMs-j7GsX0FDpIkmCcZT1P9XyV58WNy_U" },
  { name: "header and opaque", header: "Payment-Authorization", opaque: "eyJwaSI6InBpXzEyMyJ9", id: "CJ4X1O4aTDmS59hfdhnhBtxIQjWDOf0bcrhsswwMOW8" },
] as const;

/** CORE, section "Example Credential": the base64url credential and what it decodes to. */
export const CORE_EXAMPLE_CREDENTIAL_B64 =
  "eyJjaGFsbGVuZ2UiOnsiaWQiOiJ4N1RnMnBMcVI5bUt2TndZM2hCY1phIiwicmVhbG0iOiJhcGkuZXhhbXBsZS5jb20iLCJtZXRob2QiOiJleGFtcGxlIiwiaW50ZW50IjoiY2hhcmdlIiwicmVxdWVzdCI6ImV5SmhiVzkxYm5RaU9pSXhNREF3SWl3aVkzVnljbVZ1WTNraU9pSlZVMFFpTENKeVpXTnBjR2xsYm5RaU9pSmhZMk4wWHpFeU15SjkiLCJleHBpcmVzIjoiMjAyNS0wMS0xNVQxMjowNTowMFoifSwicGF5bG9hZCI6eyJwcm9vZiI6IjB4YWJjMTIzLi4uIn19";

/** CHARGE, "Examples", Lightning: request object. */
export const CHARGE_EXAMPLE_LIGHTNING = { amount: "100000", currency: "sat", methodDetails: { invoice: "lnbc1000n1pj9..." } };
/** CHARGE, "Examples", Stripe: request object. */
export const CHARGE_EXAMPLE_STRIPE = {
  amount: "5000",
  currency: "usd",
  description: "Premium API access",
  externalId: "order_12345",
  methodDetails: { networkId: "profile_1MqDcVKA5fEO2tZvKQm9g8Yj", paymentMethodTypes: ["card", "link"] },
};

/** X402HTTP, "Payment Required Signaling": the PAYMENT-REQUIRED header value. */
export const X402_HTTP_PAYMENT_REQUIRED_B64 =
  "eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQQVlNRU5ULVNJR05BVFVSRSBoZWFkZXIgaXMgcmVxdWlyZWQiLCJyZXNvdXJjZSI6eyJ1cmwiOiJodHRwczovL2FwaS5leGFtcGxlLmNvbS9wcmVtaXVtLWRhdGEiLCJkZXNjcmlwdGlvbiI6IkFjY2VzcyB0byBwcmVtaXVtIG1hcmtldCBkYXRhIiwibWltZVR5cGUiOiJhcHBsaWNhdGlvbi9qc29uIn0sImFjY2VwdHMiOlt7InNjaGVtZSI6ImV4YWN0IiwibmV0d29yayI6ImVpcDE1NTo4NDUzMiIsImFtb3VudCI6IjEwMDAwIiwiYXNzZXQiOiIweDAzNkNiRDUzODQyYzU0MjY2MzRlNzkyOTU0MWVDMjMxOGYzZENGN2UiLCJwYXlUbyI6IjB4MjA5NjkzQmM2YWZjMEM1MzI4YkEzNkZhRjAzQzUxNEVGMzEyMjg3QyIsIm1heFRpbWVvdXRTZWNvbmRzIjo2MCwiZXh0cmEiOnsibmFtZSI6IlVTREMiLCJ2ZXJzaW9uIjoiMiJ9fV19";

/** X402 section 5.1.1 / X402HTTP: the decoded PaymentRequired example. */
export const X402_PAYMENT_REQUIRED = {
  x402Version: 2,
  error: "PAYMENT-SIGNATURE header is required",
  resource: { url: "https://api.example.com/premium-data", description: "Access to premium market data", mimeType: "application/json" },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:84532",
      amount: "10000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      maxTimeoutSeconds: 60,
      extra: { name: "USDC", version: "2" },
    },
  ],
};

/** X402HTTP, "Settlement Response Delivery": the PAYMENT-RESPONSE success example, decoded. */
export const X402_SETTLEMENT_RESPONSE = {
  success: true,
  transaction: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  network: "eip155:84532",
  payer: "0x857b06519E91e3A54538791bDbb0E22373e36b66",
};
