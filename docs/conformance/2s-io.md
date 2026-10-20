# 2s-io

Third party, x402 v2; found through the 2s.io x402 example page

**Target:** https://2s.io/api/weather/zip?zip=94103  
**Request:** GET, no credential sent. **Response:** 402. **Observed:** 2026-10-20T12:33:54.320Z  
**Offers:** IETF Payment no, x402 yes. **Summary:** 20 pass, 1 fail, 0 warn, 1 n/a

| Rule | Result | Check | Spec | Detail |
|---|---|---|---|---|
| X402-01 | PASS | Payment requirement is sent with status 402 | x402 transports-v2/http.md, Payment Required Signaling | status 402 |
| X402-02 | PASS | PAYMENT-REQUIRED header present (canonical v2 location) | x402 transports-v2/http.md, Payment Required Signaling |  |
| X402-03 | PASS | Header value is base64 (standard alphabet) | x402 transports-v2/http.md, Payment Required Signaling |  |
| X402-04 | PASS | Header decodes to a JSON object | x402 transports-v2/http.md, Payment Required Signaling |  |
| X402-05 | PASS | x402Version is 2 | x402 v2 spec, 5.1.2 Field Descriptions | x402Version=2 |
| X402-06 | PASS | error, if present, is a string | x402 v2 spec, 5.1.2 |  |
| X402-07 | PASS | resource object present with an absolute url | x402 v2 spec, 5.1.2 (ResourceInfo) |  |
| X402-08 | FAIL | optional ResourceInfo fields follow their limits | x402 v2 spec, 5.1.2 (ResourceInfo) | tags must be at most 5 printable-ASCII strings of at most 32 chars |
| X402-09 | PASS | accepts is a non-empty array | x402 v2 spec, 5.1.2 | 2 option(s) |
| X402-10.1 | PASS | required fields present with the right types [accepts 1] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.1 | PASS | network is a CAIP-2 identifier [accepts 1] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:8453" |
| X402-12.1 | PASS | amount is a string of atomic units [accepts 1] | x402 v2 spec, 5.1.2 (amount) | amount="3000" |
| X402-13.1 | PASS | maxTimeoutSeconds is a positive integer [accepts 1] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=60 |
| X402-14.1 | PASS | extra, if present, is an object [accepts 1] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.1 | PASS | scheme is defined in the x402 repository [accepts 1] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| X402-10.2 | PASS | required fields present with the right types [accepts 2] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.2 | PASS | network is a CAIP-2 identifier [accepts 2] | x402 v2 spec, 11.1 Network Identifiers | network="solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" |
| X402-12.2 | PASS | amount is a string of atomic units [accepts 2] | x402 v2 spec, 5.1.2 (amount) | amount="3000" |
| X402-13.2 | PASS | maxTimeoutSeconds is a positive integer [accepts 2] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=60 |
| X402-14.2 | PASS | extra, if present, is an object [accepts 2] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.2 | PASS | scheme is defined in the x402 repository [accepts 2] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| IETF-00 | N/A | Server offers a Payment challenge | draft-httpauth-payment-01 | no WWW-Authenticate header |
