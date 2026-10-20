# x402-org-protected

Third party; x402.org demo route (redirects)

**Target:** https://www.x402.org/protected (final: https://x402.org/protected)  
**Request:** GET, no credential sent. **Response:** 402. **Observed:** 2026-10-20T12:33:55.378Z  
**Offers:** IETF Payment no, x402 yes. **Summary:** 21 pass, 0 fail, 0 warn, 1 n/a

| Rule | Result | Check | Spec | Detail |
|---|---|---|---|---|
| X402-01 | PASS | Payment requirement is sent with status 402 | x402 transports-v2/http.md, Payment Required Signaling | status 402 |
| X402-02 | PASS | PAYMENT-REQUIRED header present (canonical v2 location) | x402 transports-v2/http.md, Payment Required Signaling |  |
| X402-03 | PASS | Header value is base64 (standard alphabet) | x402 transports-v2/http.md, Payment Required Signaling |  |
| X402-04 | PASS | Header decodes to a JSON object | x402 transports-v2/http.md, Payment Required Signaling |  |
| X402-05 | PASS | x402Version is 2 | x402 v2 spec, 5.1.2 Field Descriptions | x402Version=2 |
| X402-06 | PASS | error, if present, is a string | x402 v2 spec, 5.1.2 |  |
| X402-07 | PASS | resource object present with an absolute url | x402 v2 spec, 5.1.2 (ResourceInfo) |  |
| X402-08 | PASS | optional ResourceInfo fields follow their limits | x402 v2 spec, 5.1.2 (ResourceInfo) |  |
| X402-09 | PASS | accepts is a non-empty array | x402 v2 spec, 5.1.2 | 2 option(s) |
| X402-10.1 | PASS | required fields present with the right types [accepts 1] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.1 | PASS | network is a CAIP-2 identifier [accepts 1] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:84532" |
| X402-12.1 | PASS | amount is a string of atomic units [accepts 1] | x402 v2 spec, 5.1.2 (amount) | amount="10000" |
| X402-13.1 | PASS | maxTimeoutSeconds is a positive integer [accepts 1] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.1 | PASS | extra, if present, is an object [accepts 1] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.1 | PASS | scheme is defined in the x402 repository [accepts 1] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| X402-10.2 | PASS | required fields present with the right types [accepts 2] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.2 | PASS | network is a CAIP-2 identifier [accepts 2] | x402 v2 spec, 11.1 Network Identifiers | network="solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" |
| X402-12.2 | PASS | amount is a string of atomic units [accepts 2] | x402 v2 spec, 5.1.2 (amount) | amount="10000" |
| X402-13.2 | PASS | maxTimeoutSeconds is a positive integer [accepts 2] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.2 | PASS | extra, if present, is an object [accepts 2] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.2 | PASS | scheme is defined in the x402 repository [accepts 2] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| IETF-00 | N/A | Server offers a Payment challenge | draft-httpauth-payment-01 | no WWW-Authenticate header |
