# agentfeed

Maintainer's own service; route chosen from /.well-known/x402.json

**Target:** https://x402.ochinimus.app/api/sol-price  
**Request:** GET, no credential sent. **Response:** 402. **Observed:** 2026-10-20T12:33:54.055Z  
**Offers:** IETF Payment yes, x402 yes. **Summary:** 128 pass, 1 fail, 0 warn, 0 n/a

| Rule | Result | Check | Spec | Detail |
|---|---|---|---|---|
| IETF-01 | PASS | Challenge is sent with status 402 | draft-httpauth-payment-01, Status Codes | status 402 |
| IETF-02 | PASS | 402 carries Cache-Control: no-store | draft-httpauth-payment-01, Caching | Cache-Control: no-store |
| IETF-03.1 | PASS | Challenge syntax is valid auth-params, no duplicate parameters [challenge 1] | draft-httpauth-payment-01, Challenge (WWW-Authenticate) |  |
| IETF-04.1 | PASS | id present and non-empty [challenge 1] | draft-httpauth-payment-01, Required Parameters (id) |  |
| IETF-05.1 | PASS | realm present [challenge 1] | draft-httpauth-payment-01, Required Parameters (realm) |  |
| IETF-06.1 | PASS | method present, lowercase ASCII letters only [challenge 1] | draft-httpauth-payment-01, Method Identifier Format (payment-method-id = 1*LOWERALPHA) | method="solana" |
| IETF-07.1 | PASS | intent syntax valid and defined in a published intent spec [challenge 1] | draft-httpauth-payment-01, Intent Identifiers | intent="charge" |
| IETF-08.1 | PASS | request present, base64url without padding, JSON object [challenge 1] | draft-httpauth-payment-01, Required Parameters (request) |  |
| IETF-09.1 | PASS | request JSON is serialised with JCS (RFC 8785) [challenge 1] | draft-httpauth-payment-01, Required Parameters (request) |  |
| IETF-10.1 | PASS | charge: request.amount is a string of base units [challenge 1] | draft-payment-intent-charge-00, Shared Fields (Required) | amount="1000" |
| IETF-11.1 | PASS | charge: request.currency present; ISO 4217 codes lowercase [challenge 1] | draft-payment-intent-charge-00, Currency Formats | currency="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" |
| IETF-12.1 | PASS | charge: optional request fields have the right types [challenge 1] | draft-payment-intent-charge-00, Shared Fields (Optional) |  |
| IETF-13.1 | PASS | charge: request does not duplicate the expiry [challenge 1] | draft-payment-intent-charge-00, Shared Fields (expiry paragraph) |  |
| IETF-14.1 | PASS | expires present (SHOULD), RFC 3339, in the future [challenge 1] | draft-httpauth-payment-01, Optional Parameters (expires) | expires="2026-10-20T12:38:54.193Z" (300 s ahead) |
| IETF-15.1 | PASS | opaque is base64url of a JCS flat string-to-string JSON object [challenge 1] | draft-httpauth-payment-01, Optional Parameters (opaque) |  |
| IETF-03.2 | PASS | Challenge syntax is valid auth-params, no duplicate parameters [challenge 2] | draft-httpauth-payment-01, Challenge (WWW-Authenticate) |  |
| IETF-04.2 | PASS | id present and non-empty [challenge 2] | draft-httpauth-payment-01, Required Parameters (id) |  |
| IETF-05.2 | PASS | realm present [challenge 2] | draft-httpauth-payment-01, Required Parameters (realm) |  |
| IETF-06.2 | PASS | method present, lowercase ASCII letters only [challenge 2] | draft-httpauth-payment-01, Method Identifier Format (payment-method-id = 1*LOWERALPHA) | method="tempo" |
| IETF-07.2 | PASS | intent syntax valid and defined in a published intent spec [challenge 2] | draft-httpauth-payment-01, Intent Identifiers | intent="charge" |
| IETF-08.2 | PASS | request present, base64url without padding, JSON object [challenge 2] | draft-httpauth-payment-01, Required Parameters (request) |  |
| IETF-09.2 | PASS | request JSON is serialised with JCS (RFC 8785) [challenge 2] | draft-httpauth-payment-01, Required Parameters (request) |  |
| IETF-10.2 | PASS | charge: request.amount is a string of base units [challenge 2] | draft-payment-intent-charge-00, Shared Fields (Required) | amount="1000" |
| IETF-11.2 | PASS | charge: request.currency present; ISO 4217 codes lowercase [challenge 2] | draft-payment-intent-charge-00, Currency Formats | currency="0x20c0000000000000000000006a37da5c996874be" |
| IETF-12.2 | PASS | charge: optional request fields have the right types [challenge 2] | draft-payment-intent-charge-00, Shared Fields (Optional) |  |
| IETF-13.2 | PASS | charge: request does not duplicate the expiry [challenge 2] | draft-payment-intent-charge-00, Shared Fields (expiry paragraph) |  |
| IETF-14.2 | PASS | expires present (SHOULD), RFC 3339, in the future [challenge 2] | draft-httpauth-payment-01, Optional Parameters (expires) | expires="2026-10-20T12:38:54.191Z" (300 s ahead) |
| IETF-15.2 | PASS | opaque is base64url of a JCS flat string-to-string JSON object [challenge 2] | draft-httpauth-payment-01, Optional Parameters (opaque) |  |
| IETF-03.3 | PASS | Challenge syntax is valid auth-params, no duplicate parameters [challenge 3] | draft-httpauth-payment-01, Challenge (WWW-Authenticate) |  |
| IETF-04.3 | PASS | id present and non-empty [challenge 3] | draft-httpauth-payment-01, Required Parameters (id) |  |
| IETF-05.3 | PASS | realm present [challenge 3] | draft-httpauth-payment-01, Required Parameters (realm) |  |
| IETF-06.3 | PASS | method present, lowercase ASCII letters only [challenge 3] | draft-httpauth-payment-01, Method Identifier Format (payment-method-id = 1*LOWERALPHA) | method="tempo" |
| IETF-07.3 | PASS | intent syntax valid and defined in a published intent spec [challenge 3] | draft-httpauth-payment-01, Intent Identifiers | intent="charge" |
| IETF-08.3 | PASS | request present, base64url without padding, JSON object [challenge 3] | draft-httpauth-payment-01, Required Parameters (request) |  |
| IETF-09.3 | PASS | request JSON is serialised with JCS (RFC 8785) [challenge 3] | draft-httpauth-payment-01, Required Parameters (request) |  |
| IETF-10.3 | PASS | charge: request.amount is a string of base units [challenge 3] | draft-payment-intent-charge-00, Shared Fields (Required) | amount="1000" |
| IETF-11.3 | PASS | charge: request.currency present; ISO 4217 codes lowercase [challenge 3] | draft-payment-intent-charge-00, Currency Formats | currency="0x20c000000000000000000000b9537d11c60e8b50" |
| IETF-12.3 | PASS | charge: optional request fields have the right types [challenge 3] | draft-payment-intent-charge-00, Shared Fields (Optional) |  |
| IETF-13.3 | PASS | charge: request does not duplicate the expiry [challenge 3] | draft-payment-intent-charge-00, Shared Fields (expiry paragraph) |  |
| IETF-14.3 | PASS | expires present (SHOULD), RFC 3339, in the future [challenge 3] | draft-httpauth-payment-01, Optional Parameters (expires) | expires="2026-10-20T12:38:54.192Z" (300 s ahead) |
| IETF-15.3 | PASS | opaque is base64url of a JCS flat string-to-string JSON object [challenge 3] | draft-httpauth-payment-01, Optional Parameters (opaque) |  |
| IETF-17 | PASS | Challenge ids are unique across multiple challenges | draft-httpauth-payment-01, Multiple Payment Options |  |
| X402-01 | PASS | Payment requirement is sent with status 402 | x402 transports-v2/http.md, Payment Required Signaling | status 402 |
| X402-02 | PASS | PAYMENT-REQUIRED header present (canonical v2 location) | x402 transports-v2/http.md, Payment Required Signaling |  |
| X402-03 | PASS | Header value is base64 (standard alphabet) | x402 transports-v2/http.md, Payment Required Signaling |  |
| X402-04 | PASS | Header decodes to a JSON object | x402 transports-v2/http.md, Payment Required Signaling |  |
| X402-05 | PASS | x402Version is 2 | x402 v2 spec, 5.1.2 Field Descriptions | x402Version=2 |
| X402-06 | PASS | error, if present, is a string | x402 v2 spec, 5.1.2 |  |
| X402-07 | PASS | resource object present with an absolute url | x402 v2 spec, 5.1.2 (ResourceInfo) |  |
| X402-08 | PASS | optional ResourceInfo fields follow their limits | x402 v2 spec, 5.1.2 (ResourceInfo) |  |
| X402-09 | PASS | accepts is a non-empty array | x402 v2 spec, 5.1.2 | 13 option(s) |
| X402-10.1 | PASS | required fields present with the right types [accepts 1] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.1 | PASS | network is a CAIP-2 identifier [accepts 1] | x402 v2 spec, 11.1 Network Identifiers | network="solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" |
| X402-12.1 | PASS | amount is a string of atomic units [accepts 1] | x402 v2 spec, 5.1.2 (amount) | amount="1000" |
| X402-13.1 | PASS | maxTimeoutSeconds is a positive integer [accepts 1] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.1 | PASS | extra, if present, is an object [accepts 1] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.1 | PASS | scheme is defined in the x402 repository [accepts 1] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| X402-10.2 | PASS | required fields present with the right types [accepts 2] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.2 | PASS | network is a CAIP-2 identifier [accepts 2] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:8453" |
| X402-12.2 | PASS | amount is a string of atomic units [accepts 2] | x402 v2 spec, 5.1.2 (amount) | amount="1000" |
| X402-13.2 | PASS | maxTimeoutSeconds is a positive integer [accepts 2] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.2 | PASS | extra, if present, is an object [accepts 2] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.2 | PASS | scheme is defined in the x402 repository [accepts 2] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| X402-10.3 | PASS | required fields present with the right types [accepts 3] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.3 | PASS | network is a CAIP-2 identifier [accepts 3] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:137" |
| X402-12.3 | PASS | amount is a string of atomic units [accepts 3] | x402 v2 spec, 5.1.2 (amount) | amount="1000" |
| X402-13.3 | PASS | maxTimeoutSeconds is a positive integer [accepts 3] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.3 | PASS | extra, if present, is an object [accepts 3] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.3 | PASS | scheme is defined in the x402 repository [accepts 3] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| X402-10.4 | PASS | required fields present with the right types [accepts 4] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.4 | PASS | network is a CAIP-2 identifier [accepts 4] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:42161" |
| X402-12.4 | PASS | amount is a string of atomic units [accepts 4] | x402 v2 spec, 5.1.2 (amount) | amount="1000" |
| X402-13.4 | PASS | maxTimeoutSeconds is a positive integer [accepts 4] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.4 | PASS | extra, if present, is an object [accepts 4] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.4 | PASS | scheme is defined in the x402 repository [accepts 4] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| X402-10.5 | PASS | required fields present with the right types [accepts 5] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.5 | PASS | network is a CAIP-2 identifier [accepts 5] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:5042" |
| X402-12.5 | PASS | amount is a string of atomic units [accepts 5] | x402 v2 spec, 5.1.2 (amount) | amount="1000" |
| X402-13.5 | PASS | maxTimeoutSeconds is a positive integer [accepts 5] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.5 | PASS | extra, if present, is an object [accepts 5] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.5 | PASS | scheme is defined in the x402 repository [accepts 5] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| X402-10.6 | PASS | required fields present with the right types [accepts 6] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.6 | FAIL | network is a CAIP-2 identifier [accepts 6] | x402 v2 spec, 11.1 Network Identifiers | network="algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=" |
| X402-12.6 | PASS | amount is a string of atomic units [accepts 6] | x402 v2 spec, 5.1.2 (amount) | amount="1000" |
| X402-13.6 | PASS | maxTimeoutSeconds is a positive integer [accepts 6] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.6 | PASS | extra, if present, is an object [accepts 6] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.6 | PASS | scheme is defined in the x402 repository [accepts 6] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| X402-10.7 | PASS | required fields present with the right types [accepts 7] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.7 | PASS | network is a CAIP-2 identifier [accepts 7] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:8453" |
| X402-12.7 | PASS | amount is a string of atomic units [accepts 7] | x402 v2 spec, 5.1.2 (amount) | amount="500" |
| X402-13.7 | PASS | maxTimeoutSeconds is a positive integer [accepts 7] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.7 | PASS | extra, if present, is an object [accepts 7] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.7 | PASS | scheme is defined in the x402 repository [accepts 7] | x402 v2 spec, Document Scope (schemes) | scheme="batch-settlement" |
| X402-10.8 | PASS | required fields present with the right types [accepts 8] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.8 | PASS | network is a CAIP-2 identifier [accepts 8] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:137" |
| X402-12.8 | PASS | amount is a string of atomic units [accepts 8] | x402 v2 spec, 5.1.2 (amount) | amount="500" |
| X402-13.8 | PASS | maxTimeoutSeconds is a positive integer [accepts 8] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.8 | PASS | extra, if present, is an object [accepts 8] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.8 | PASS | scheme is defined in the x402 repository [accepts 8] | x402 v2 spec, Document Scope (schemes) | scheme="batch-settlement" |
| X402-10.9 | PASS | required fields present with the right types [accepts 9] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.9 | PASS | network is a CAIP-2 identifier [accepts 9] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:42161" |
| X402-12.9 | PASS | amount is a string of atomic units [accepts 9] | x402 v2 spec, 5.1.2 (amount) | amount="500" |
| X402-13.9 | PASS | maxTimeoutSeconds is a positive integer [accepts 9] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.9 | PASS | extra, if present, is an object [accepts 9] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.9 | PASS | scheme is defined in the x402 repository [accepts 9] | x402 v2 spec, Document Scope (schemes) | scheme="batch-settlement" |
| X402-10.10 | PASS | required fields present with the right types [accepts 10] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.10 | PASS | network is a CAIP-2 identifier [accepts 10] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:5042" |
| X402-12.10 | PASS | amount is a string of atomic units [accepts 10] | x402 v2 spec, 5.1.2 (amount) | amount="500" |
| X402-13.10 | PASS | maxTimeoutSeconds is a positive integer [accepts 10] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=604900 |
| X402-14.10 | PASS | extra, if present, is an object [accepts 10] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.10 | PASS | scheme is defined in the x402 repository [accepts 10] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| X402-10.11 | PASS | required fields present with the right types [accepts 11] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.11 | PASS | network is a CAIP-2 identifier [accepts 11] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:10" |
| X402-12.11 | PASS | amount is a string of atomic units [accepts 11] | x402 v2 spec, 5.1.2 (amount) | amount="1000" |
| X402-13.11 | PASS | maxTimeoutSeconds is a positive integer [accepts 11] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.11 | PASS | extra, if present, is an object [accepts 11] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.11 | PASS | scheme is defined in the x402 repository [accepts 11] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| X402-10.12 | PASS | required fields present with the right types [accepts 12] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.12 | PASS | network is a CAIP-2 identifier [accepts 12] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:143" |
| X402-12.12 | PASS | amount is a string of atomic units [accepts 12] | x402 v2 spec, 5.1.2 (amount) | amount="1000" |
| X402-13.12 | PASS | maxTimeoutSeconds is a positive integer [accepts 12] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.12 | PASS | extra, if present, is an object [accepts 12] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.12 | PASS | scheme is defined in the x402 repository [accepts 12] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
| X402-10.13 | PASS | required fields present with the right types [accepts 13] | x402 v2 spec, 5.1.2 (PaymentRequirements) |  |
| X402-11.13 | PASS | network is a CAIP-2 identifier [accepts 13] | x402 v2 spec, 11.1 Network Identifiers | network="eip155:43114" |
| X402-12.13 | PASS | amount is a string of atomic units [accepts 13] | x402 v2 spec, 5.1.2 (amount) | amount="1000" |
| X402-13.13 | PASS | maxTimeoutSeconds is a positive integer [accepts 13] | x402 v2 spec, 5.1.2 (maxTimeoutSeconds) | maxTimeoutSeconds=300 |
| X402-14.13 | PASS | extra, if present, is an object [accepts 13] | x402 v2 spec, 5.1.2 (extra) |  |
| X402-15.13 | PASS | scheme is defined in the x402 repository [accepts 13] | x402 v2 spec, Document Scope (schemes) | scheme="exact" |
