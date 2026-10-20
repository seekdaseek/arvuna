# mpp-dev-ping

Third party, IETF Payment; the MPP project's own demo route

**Target:** https://mpp.dev/api/ping/paid  
**Request:** GET, no credential sent. **Response:** 402. **Observed:** 2026-10-20T12:33:54.921Z  
**Offers:** IETF Payment yes, x402 no. **Summary:** 15 pass, 0 fail, 0 warn, 1 n/a

| Rule | Result | Check | Spec | Detail |
|---|---|---|---|---|
| IETF-01 | PASS | Challenge is sent with status 402 | draft-httpauth-payment-01, Status Codes | status 402 |
| IETF-02 | PASS | 402 carries Cache-Control: no-store | draft-httpauth-payment-01, Caching | Cache-Control: no-store |
| IETF-03 | PASS | Challenge syntax is valid auth-params, no duplicate parameters | draft-httpauth-payment-01, Challenge (WWW-Authenticate) |  |
| IETF-04 | PASS | id present and non-empty | draft-httpauth-payment-01, Required Parameters (id) |  |
| IETF-05 | PASS | realm present | draft-httpauth-payment-01, Required Parameters (realm) |  |
| IETF-06 | PASS | method present, lowercase ASCII letters only | draft-httpauth-payment-01, Method Identifier Format (payment-method-id = 1*LOWERALPHA) | method="tempo" |
| IETF-07 | PASS | intent syntax valid and defined in a published intent spec | draft-httpauth-payment-01, Intent Identifiers | intent="charge" |
| IETF-08 | PASS | request present, base64url without padding, JSON object | draft-httpauth-payment-01, Required Parameters (request) |  |
| IETF-09 | PASS | request JSON is serialised with JCS (RFC 8785) | draft-httpauth-payment-01, Required Parameters (request) |  |
| IETF-10 | PASS | charge: request.amount is a string of base units | draft-payment-intent-charge-00, Shared Fields (Required) | amount="100000" |
| IETF-11 | PASS | charge: request.currency present; ISO 4217 codes lowercase | draft-payment-intent-charge-00, Currency Formats | currency="0x20c0000000000000000000000000000000000000" |
| IETF-12 | PASS | charge: optional request fields have the right types | draft-payment-intent-charge-00, Shared Fields (Optional) |  |
| IETF-13 | PASS | charge: request does not duplicate the expiry | draft-payment-intent-charge-00, Shared Fields (expiry paragraph) |  |
| IETF-14 | PASS | expires present (SHOULD), RFC 3339, in the future | draft-httpauth-payment-01, Optional Parameters (expires) | expires="2026-10-20T12:38:55.070Z" (300 s ahead) |
| IETF-15 | PASS | opaque is base64url of a JCS flat string-to-string JSON object | draft-httpauth-payment-01, Optional Parameters (opaque) |  |
| X402-00 | N/A | Server offers an x402 payment requirement | x402 transports-v2/http.md | no PAYMENT-REQUIRED header and no x402 JSON body |
