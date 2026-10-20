# arvuna-taler-prototype

Part A prototype, running locally against the public Taler demo merchant

**Target:** http://127.0.0.1:8402/api/quote  
**Request:** GET, no credential sent. **Response:** 402. **Observed:** 2026-10-20T12:33:53.742Z  
**Offers:** IETF Payment yes, x402 yes. **Summary:** 29 pass, 0 fail, 0 warn, 0 n/a

| Rule | Result | Check | Spec | Detail |
|---|---|---|---|---|
| IETF-01 | PASS | Challenge is sent with status 402 | draft-httpauth-payment-01, Status Codes | status 402 |
| IETF-02 | PASS | 402 carries Cache-Control: no-store | draft-httpauth-payment-01, Caching | Cache-Control: no-store |
| IETF-03 | PASS | Challenge syntax is valid auth-params, no duplicate parameters | draft-httpauth-payment-01, Challenge (WWW-Authenticate) |  |
| IETF-04 | PASS | id present and non-empty | draft-httpauth-payment-01, Required Parameters (id) |  |
| IETF-05 | PASS | realm present | draft-httpauth-payment-01, Required Parameters (realm) |  |
| IETF-06 | PASS | method present, lowercase ASCII letters only | draft-httpauth-payment-01, Method Identifier Format (payment-method-id = 1*LOWERALPHA) | method="taler" |
| IETF-07 | PASS | intent syntax valid and defined in a published intent spec | draft-httpauth-payment-01, Intent Identifiers | intent="charge" |
| IETF-08 | PASS | request present, base64url without padding, JSON object | draft-httpauth-payment-01, Required Parameters (request) |  |
| IETF-09 | PASS | request JSON is serialised with JCS (RFC 8785) | draft-httpauth-payment-01, Required Parameters (request) |  |
| IETF-10 | PASS | charge: request.amount is a string of base units | draft-payment-intent-charge-00, Shared Fields (Required) | amount="10" |
| IETF-11 | PASS | charge: request.currency present; ISO 4217 codes lowercase | draft-payment-intent-charge-00, Currency Formats | currency="kudos" |
| IETF-12 | PASS | charge: optional request fields have the right types | draft-payment-intent-charge-00, Shared Fields (Optional) |  |
| IETF-13 | PASS | charge: request does not duplicate the expiry | draft-payment-intent-charge-00, Shared Fields (expiry paragraph) |  |
| IETF-14 | PASS | expires present (SHOULD), RFC 3339, in the future | draft-httpauth-payment-01, Optional Parameters (expires) | expires="2026-10-20T12:43:53Z" (599 s ahead) |
| X402-01 | PASS | Payment requirement is sent with status 402 | x402 transports-v2/http.md, Payment Required Signaling | status 402 |
| X402-02 | PASS | PAYMENT-REQUIRED header present (canonical v2 location) | x402 transports-v2/http.md, Payment Required Signaling |  |
| X402-03 | PASS | Header value is base64 (standard alphabet) | x402 transports-v2/http.md, Payment Required Signaling |  |
| X402-04 | PASS | Header decodes to a JSON object | x402 transports-v2/http.md, Payment Required Signaling |  |
| X402-05 | PASS | x402Version is 2 | x402 v2 spec, 5.1.2 Field Descriptions | x402Version=2 |
| X402-06 | PASS | error, if present, is a string | x402 v2 spec, 5.1.2 |  |
| X402-07 | PASS | resource object present with an absolute url | x402 v2 spec, 5.1.2 (ResourceInfo) |  |
| X402-08 | PASS | optional ResourceInfo fields follow their limits | x402 v2 spec, 5.1.2 (ResourceInfo) |  |
| X402-09 | PASS | accepts is a non-empty array | x402 v2 spec, 5.1.2 | 1 option(s) |
| X402-10 | PASS | required fields present with the right types | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11 | PASS | network is a CAIP-2 identifier | x402 v2 spec, 11.1 Network Identifiers | network="taler:KUDOS" |
| X402-12 | PASS | amount is a string of atomic units | x402 v2 spec, 5.1.2 (amount) | amount="10" |
| X402-13 | PASS | maxTimeoutSeconds is a positive integer | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=599 |
| X402-14 | PASS | extra, if present, is an object | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15 | PASS | scheme is defined in the x402 repository | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
