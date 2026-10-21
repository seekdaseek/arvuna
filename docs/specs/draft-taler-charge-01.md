---
title: Taler Charge Intent for HTTP Payment Authentication
abbrev: Taler Charge
docname: draft-taler-charge-01
version: "01"
category: info
ipr: noModificationTrust200902
submissiontype: IETF
consensus: true

author:
  - name: seekdaseek
    org: seekdaseek

normative:
  RFC2119:
  RFC3339:
  RFC4648:
  RFC8174:
  RFC8259:
  RFC8785:
  RFC9457:
  I-D.httpauth-payment:
    title: "The 'Payment' HTTP Authentication Scheme"
    target: https://datatracker.ietf.org/doc/draft-ryan-httpauth-payment/
    author:
      - name: Jake Moxey
    date: 2026-01
  I-D.payment-intent-charge:
    title: "'charge' Intent for HTTP Payment Authentication"
    target: https://datatracker.ietf.org/doc/draft-payment-intent-charge/
    author:
      - name: Jake Moxey
      - name: Brendan Ryan
      - name: Tom Meagher
    date: 2026
  LSD0006:
    title: "The 'taler' URI scheme for GNU Taler Wallet interactions"
    target: https://lsd.gnunet.org/lsd0006/
    author:
      - org: GNUnet LSD series
  TALER-MERCHANT-API:
    title: "GNU Taler documentation: Merchant Backend RESTful API"
    target: https://docs.taler.net/core/api-merchant.html
    author:
      - org: GNU Taler project
  TALER-COMMON-API:
    title: "GNU Taler documentation: Conventions for Taler RESTful APIs"
    target: https://docs.taler.net/core/api-common.html
    author:
      - org: GNU Taler project
  TALER-EXCHANGE-API:
    title: "GNU Taler documentation: Exchange RESTful API"
    target: https://docs.taler.net/core/api-exchange.html
    author:
      - org: GNU Taler project
  TALER-FULFILLMENT:
    title: "GNU Taler documentation: Merchant backend API tutorial, Understanding fulfillment URLs"
    target: https://tutorials.taler.net/dev/merchant-api/repurchase
    author:
      - org: GNU Taler project
  TALER-REFUNDS:
    title: "GNU Taler documentation: Merchant backend API tutorial, Refunding orders"
    target: https://tutorials.taler.net/dev/merchant-api/order2
    author:
      - org: GNU Taler project

informative:
  RFC8905:
  TALER-PAIVANA:
    title: "GNU Taler documentation: Paivana Operator Manual"
    target: https://docs.taler.net/taler-paivana-manual.html
    author:
      - org: GNU Taler project
  TALER-WIREWATCH:
    title: "GNU Taler documentation: taler-merchant-wirewatch(1)"
    target: https://docs.taler.net/manpages/taler-merchant-wirewatch.1.html
    author:
      - org: GNU Taler project
  TALER-FEATURES:
    title: "GNU Taler: Features"
    target: https://www.taler.net/en/features.html
    author:
      - org: GNU Taler project
  X402:
    title: "x402 Protocol Specification, version 2"
    target: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
    author:
      - org: x402 Foundation
  X402-HTTP:
    title: "x402 Transport: HTTP"
    target: https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md
    author:
      - org: x402 Foundation
  CAIP-2:
    title: "CAIP-2: Blockchain ID Specification"
    target: https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
    author:
      - org: Chain Agnostic Standards Alliance
  ARVUNA-PROTOTYPE:
    title: "arvuna: prototype of this method and a conformance checker"
    target: https://github.com/seekdaseek/arvuna
    author:
      - org: seekdaseek
---

--- abstract

This document defines the "charge" intent for the "taler" payment
method within the Payment HTTP Authentication Scheme
{{I-D.httpauth-payment}}. The server asks a GNU Taler merchant backend
for an order and returns the order's Taler payment URI in the
challenge; the client pays it with a Taler wallet and proves payment
by naming the order, which the server then checks against the merchant
backend. An appendix maps the same flow to x402 version 2.

--- middle

# Introduction

HTTP Payment Authentication {{I-D.httpauth-payment}} defines a
challenge-response mechanism that gates access to resources behind
payments. This document defines the "charge" intent for the "taler"
payment method, which uses GNU Taler, a payment system in which
customers can stay anonymous {{TALER-FEATURES}}.

The server does not handle Taler coins. A GNU Taler merchant backend
creates and tracks orders, and a Taler wallet, operated by the client
or its user, pays them. The server only creates an order, publishes its
payment URI in the challenge, and later asks the merchant backend
whether that order is paid. This specification therefore depends on
the merchant backend's HTTP API as documented in
{{TALER-MERCHANT-API}} and on nothing inside a Taler implementation.

Every statement about the behaviour of Taler components in this
document cites the page of the Taler documentation it comes from, or is
marked as observed in an implementation. Where the documentation does
not settle a point, the text is marked OPEN QUESTION and collected in
{{open-questions}}. This is version 01; {{changes}} lists what changed
from version 00 after review by the GNU Taler developers.

## Taler Charge Flow

~~~
 Client              Server         Merchant Backend     Wallet
    |                   |                   |                |
    | (1) GET /resource |                   |                |
    |------------------>|                   |                |
    |                   | (2) create order  |                |
    |                   |------------------>|                |
    |                   | (3) order_id,     |                |
    |                   |     taler_pay_uri |                |
    |                   |<------------------|                |
    | (4) 402 Payment   |                   |                |
    |     Required      |                   |                |
    |     taler_pay_uri |                   |                |
    |<------------------|                   |                |
    | (5) hand taler_pay_uri to the wallet  |                |
    |---------------------------------------------------------->
    |                   |                   | (6) claim and  |
    |                   |                   |     pay order  |
    |                   |                   |<---------------|
    | (7) GET /resource |                   |                |
    |     Authorization:|                   |                |
    |     Payment <cred>|                   |                |
    |------------------>|                   |                |
    |                   | (8) order status  |                |
    |                   |------------------>|                |
    |                   | (9) "paid"        |                |
    |                   |<------------------|                |
    | (10) 200 OK       |                   |                |
    |      Payment-     |                   |                |
    |      Receipt      |                   |                |
    |<------------------|                   |                |
~~~

## Relationship to the Payment Scheme and the Charge Intent

This document is a payment method specification as described in
{{I-D.httpauth-payment}}. It defines the `request` and `payload`
structures for the "taler" method, together with its verification and
settlement procedures. It inherits the shared request fields and the
semantics of the "charge" intent from {{I-D.payment-intent-charge}}
and defines only what is specific to Taler.

# Requirements Language

{::boilerplate bcp14-tagged}

# Terminology

Merchant Backend
: The GNU Taler merchant backend that the server operates or uses. It
  exposes a private API, authenticated by the server, to create orders
  and to read their status, and a public API used by wallets
  ({{TALER-MERCHANT-API}}).

Instance
: A tenant of a merchant backend. The base URL of the instance is the
  prefix of every API path ({{TALER-MERCHANT-API}}, "Base URLs and
  Instances").

Order
: A purchase offer created by the server at the merchant backend. Once
  claimed by a wallet it becomes a contract with fixed terms
  ({{TALER-MERCHANT-API}}, "Orders" and "Contract base terms").

Order Identifier
: The identifier of an order, unique within an instance, called
  `order_id` by the merchant backend.

Claim Token
: A high-entropy secret that authorizes a wallet to claim an order. The
  merchant backend returns it as `token` when an order is created with
  `create_token` set (the default), and it appears as the `c` query
  parameter of the Taler Pay URI ({{TALER-MERCHANT-API}}, "Creating
  orders"; {{LSD0006}}, action "pay", where the argument is called
  `ct`).

Taler Pay URI
: The `taler://pay/...` URI that a wallet processes to pay an order. It
  is called `taler_pay_uri` by the merchant backend
  ({{TALER-MERCHANT-API}}, "Querying payment status") and has the
  syntax defined in {{LSD0006}} ({{pay-uri}}).

Fulfillment URL
: The `fulfillment_url` of an order: the URL a customer is sent to
  after paying. It is also what a wallet uses to recognise a repeated
  purchase ({{fulfillment}}).

Wallet
: Software that holds the client's Taler money and pays orders.

Paid
: The `order_status` of an order once the merchant backend has
  accepted the payment ({{TALER-MERCHANT-API}}, "Inspecting orders").
  Paid does not mean that the money has reached the merchant's bank
  account; see {{finality}}.

# Method Identifier

This specification registers the following payment method identifier:

~~~
taler
~~~

The identifier is case-sensitive and MUST be lowercase.

# Supported Intents

| Intent | Support | Reference |
|--------|---------|-----------|
| `charge` | REQUIRED | {{intent-charge}} |

No other intent is defined by this document. The "authorize" and
"subscription" intents are not defined for this method.

# Intent: "charge" {#intent-charge}

The "charge" intent is a one-time payment of a stated amount in
exchange for access to a resource. For the "taler" method the server
creates one order per challenge. The client pays the order with a Taler
wallet and presents the order identifier as its credential. The server
verifies the payment with the merchant backend and trusts nothing the
client says about it.

## Request Schema

The `request` parameter of the challenge is a base64url-encoded JSON
object, serialized with JCS {{RFC8785}} first, as required by
{{I-D.httpauth-payment}}. It uses the shared fields of the "charge"
intent {{I-D.payment-intent-charge}} and the `methodDetails` object
defined here. This method defines no `recipient` field ({{privacy}}).

### Shared Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | string | REQUIRED | Amount in base units ({{amount}}) |
| `currency` | string | REQUIRED | Taler currency code, lowercase ({{currency}}) |
| `description` | string | OPTIONAL | The order's `summary` |
| `externalId` | string | RECOMMENDED | The Order Identifier |

### Method Details

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `methodDetails.merchantBaseUrl` | string | REQUIRED | Base URL of the merchant instance |
| `methodDetails.orderId` | string | REQUIRED | The Order Identifier |
| `methodDetails.talerPayUri` | string | REQUIRED | The Taler Pay URI of the order, with the Claim Token |

If `externalId` is present it MUST equal `methodDetails.orderId`. As
for every challenge, expiry is conveyed only by the `expires`
auth-param and MUST NOT be repeated in `request`
{{I-D.payment-intent-charge}}.

`methodDetails.orderId` and `methodDetails.merchantBaseUrl` repeat
information that is in `methodDetails.talerPayUri`. They MUST equal the
values derived from it as described in {{pay-uri}}, and a client that
finds a difference MUST NOT pay.

**Example** (the encoded form is in {{ex-challenge}}):

~~~json
{
  "amount": "10",
  "currency": "kudos",
  "description": "Access to /api/quote",
  "externalId": "2026.293-Z2SX6Z5QR12R2",
  "methodDetails": {
    "merchantBaseUrl": "https://backend.demo.taler.net/instances/sandbox/",
    "orderId": "2026.293-Z2SX6Z5QR12R2",
    "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-Z2SX6Z5QR12R2/?c=H3QZ8MXK2V9TRW5NB7DYC4F6JA"
  }
}
~~~

### The Taler Pay URI {#pay-uri}

The syntax of the `taler://pay` URI is defined in {{LSD0006}}, action
"pay":

~~~
taler://pay/{merchant_host}{/merchant_prefix_path*}/{order_id}/{session_id}{?c=ct}
~~~

The `session_id` may be an empty string, and the claim token `ct` is
carried in the query parameter `c`. A `taler://` URI means that a
wallet uses HTTP over TLS to reach the merchant ({{LSD0006}},
"Semantics"); servers MUST NOT emit `taler+http://` URIs.

From a Taler Pay URI, a reader derives:

order identifier
: after removing the query (everything from the first "?"), the path
  segment between the last two slashes. With an empty `session_id` that
  is the segment before the final slash; with a non-empty one, the
  segment before the `session_id`.

merchant base URL
: `https://` followed by `merchant_host` and the `merchant_prefix_path`
  segments, followed by a final "/". For the URI in the example this is
  `https://backend.demo.taler.net/instances/sandbox/`, which is also how
  the merchant backend writes `merchant_base_url` in its contract terms
  ("an absolute URL that ends with a slash", {{TALER-MERCHANT-API}},
  "Contract base terms").

A Taler Pay URI that carries a claim token MUST be treated as a secret
by both server and client ({{binding}}).

### Amount {#amount}

The charge intent defines `amount` as an integer in base units, the
smallest denomination of the currency, and gives US dollar cents as its
example ({{I-D.payment-intent-charge}}). For Taler, the base unit is
taken from the currency specification of the exchange, where one is
published:

1. The exchange publishes `currency_specification` in its keys
   response ("How wallets should render this currency"); it contains
   `num_fractional_input_digits`, "how many digits the user may enter
   after the decimal_separator" ({{TALER-EXCHANGE-API}}, "GET /keys").
   The base unit is 10^-d of the currency, where d is the value of that
   field. For EUR and CHF, with two digits, the base unit is the cent,
   and the order amount "EUR:12.34" is "1234".
2. Where no currency specification is published, the base unit is
   10^-8. The Taler amount format has "8 decimal places"
   ({{TALER-COMMON-API}}, "Amounts"), so this is the finest unit any
   Taler amount can express.

`amount` is the order amount as a decimal integer string of base units,
with no sign, no fraction and no leading zeros. If the order amount has
a finer fraction than the base unit, so that it is not an integer
number of base units, the server MUST NOT issue the order. Clients
SHOULD check that `amount`, converted back with the same unit, equals
the amount of the contract their wallet shows, and SHOULD NOT pay if
they differ.

The demo exchange publishes two digits for KUDOS (observed in its keys
response), so the order amount "KUDOS:0.1" is "10".

**OPEN QUESTION (OQ-1), addressed to the GNU Taler developers:** this
is a proposal and has not been confirmed. The currency specification is
documented as a rendering hint: the exchange describes it as how
wallets "should render" the currency, and the merchant backend as a
*hint* that applications "may ignore" ({{TALER-MERCHANT-API}},
"Configuration API"). Is it acceptable as the source of a wire unit?
If so: (a) is `num_fractional_input_digits` the right field, or
`num_fractional_normal_digits`? (b) when a merchant accepts several
exchanges for one currency, whose specification applies? (c) a client
that has no access to the exchange cannot interpret `amount`; should
`methodDetails` also carry the Taler amount string, such as
"EUR:12.34", as the authoritative value? The fallback is a fixed
10^-8 unit for every currency, which needs no external data but gives
every EUR amount eight decimal digits.

### Currency {#currency}

A Taler currency code consists of at most 11 ASCII letters
({{TALER-COMMON-API}}, "Amounts"), for example "KUDOS", "CHF" or "EUR".
On the wire, in the `currency` field, the code is written in lowercase:
"kudos", "chf", "eur". Implementations MUST compare currency codes
without regard to case, so that "kudos", "KUDOS" and "Kudos" denote the
same currency.

The case-insensitive comparison follows the review of version 00 by
the GNU Taler developers. {{RFC8905}} defines the currency of a payto
`amount` option as `1*ALPHA` and requires an ISO 4217 alphabetic code
for three-letter codes; it does not itself state a case rule, so this
document does not rely on it for one. The lowercase spelling follows the
charge intent, which writes ISO 4217 codes in lowercase and allows
other, method-defined formats {{I-D.payment-intent-charge}}. Lowercase
for every code keeps one rule for the method, and generic clients can
treat the field uniformly. The Taler amount in the contract, which the
wallet reads from the merchant backend, keeps the code as the backend
spells it.

### Obtaining the Order and the Pay URI {#order-creation}

The server creates the order with
`POST [/instances/$INSTANCE]/private/orders`
({{TALER-MERCHANT-API}}, "Creating orders"). It sets at least:

amount
: the order amount as a Taler amount string.

summary
: a human-readable description of the purchase, used as `description`.

fulfillment_url or fulfillment_message
: as required by {{fulfillment}}. Every order must contain one of them
  ({{TALER-MERCHANT-API}}, "Contract base terms").

pay_deadline
: a deadline in the future. The challenge `expires` MUST NOT be later
  than this deadline ({{expiry}}). The merchant backend returns the
  deadline in its response since protocol version 21
  ({{TALER-MERCHANT-API}}, "Creating orders").

refund_deadline
: set explicitly to match the server's refund policy ({{refunds}}).

The server MUST create the order with `create_token` at its default,
true, so that the order has a Claim Token ({{binding}}). It SHOULD let
the merchant backend choose the `order_id`; the documentation says that
creating an order without an explicit `order_id` is not idempotent
({{TALER-MERCHANT-API}}, "Creating orders").

The response to order creation contains the order identifier, the pay
deadline and the claim token, but not the Taler Pay URI. The server
reads the Taler Pay URI from the merchant backend: from the private
order status (`taler_pay_uri` in the unpaid-status response, "Inspecting
orders"), or from the public
`GET [/instances/$INSTANCE]/orders/$ORDER_ID` with the claim token as
the `token` parameter ("Querying payment status"). On the demo
backend, for an order with a claim token, both requests return the URI
with the `c` parameter filled in (observed), while the public request
without the `token` parameter is refused with HTTP 403. The server
SHOULD NOT construct the URI: the documentation says that the payment
URI "is not unique for every order: there might be varying parameters
such as the session id"
({{TALER-MERCHANT-API}}, "Creating orders"). The server MUST copy the
URI into `methodDetails.talerPayUri` unchanged.

The order has to exist before the challenge can be sent, because the
Taler Pay URI contains the order identifier and the claim token
({{pay-uri}}). In terms of {{I-D.httpauth-payment}}, which says that an
unpaid request MUST NOT modify server state beyond recording the
challenge itself, recording the challenge for this method *is* creating
the order at the merchant backend. A server that follows this
specification does exactly that and nothing else on an unpaid request.
Servers can limit the cost by reusing an open order for the same
resource, by short pay deadlines, by rate limiting, and by deleting
unpaid orders that were never claimed
(`DELETE [/instances/$INSTANCE]/private/orders/$ORDER_ID`, "Private
order data cleanup", which the documentation says fails for paid or
claimed-but-unpaid orders). The behaviour was observed on the demo
backend: an unclaimed unpaid order was deleted with HTTP 204.

**CORE SPECIFICATION ISSUE (CSI-1), to be raised upstream:** the
Paivana design in the Taler documentation shows that an unpaid response
can be stateless and cacheable. The Paivana operator manual describes
an unpaid page that "is identical for every visitor without the
cookie", so that the page cache "serves it without per-request work",
and says that its script "does not create an order in the merchant
backend" until the visitor's wallet engages; the payment request is a
`taler://pay-template/...` URI ({{TALER-PAIVANA}}, "The visitor
experience"; the action is registered in {{LSD0006}}). The core
specification does not allow this: it requires every 402 to carry a
unique challenge identifier and `Cache-Control: no-store`
({{I-D.httpauth-payment}}, "Caching"). Whether the core scheme should
allow a static, cacheable challenge for methods whose payment request is
created when the payer engages is a question for the authors of the
core specification, and this document does not settle it. For this
method, the question is closed: a challenge is per-request and creates
an order.

## Credential Schema

The credential is the base64url-encoded JSON object defined by
{{I-D.httpauth-payment}}, with a `challenge` echo and a `payload`.

The `payload` object has one field:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderId` | string | REQUIRED | The Order Identifier the client paid |

The payload carries no proof. The proof is the state of the order at the
merchant backend, which only the server can read. A client cannot make
an order paid by saying so.

The `source` field of the credential SHOULD be omitted by clients and
MUST NOT be required by servers; see {{privacy}}.

**Example** (the encoded form is in {{ex-credential}}):

~~~json
{
  "payload": {
    "orderId": "2026.293-Z2SX6Z5QR12R2"
  }
}
~~~

## Verification {#verification}

On receiving a credential, in addition to the generic checks of
{{I-D.httpauth-payment}} (challenge binding, `expires`, single use), the
server MUST:

1. Decode the echoed `request` and take `methodDetails.orderId` from it.
   Verify that `payload.orderId` is a string equal to it.
2. Look up the order in the server's own record of orders it created.
   If there is none, or it was created for a different resource, or it
   has already been redeemed, reject the credential. The client's
   claims about the order are never used to find it.
3. Read the order status from the merchant backend with
   `GET [/instances/$INSTANCE]/private/orders/$ORDER_ID`
   ({{TALER-MERCHANT-API}}, "Inspecting orders"). The server MAY pass
   `timeout_ms` to have the backend wait for the payment ("long
   polling"); the documentation says to wait only "if the answer would
   otherwise be negative", and a server MUST NOT depend on the wait.
4. Require `order_status` to be `"paid"`. The values `"unpaid"` and
   `"claimed"` mean that the payment has not happened; the server
   rejects the credential as not verified, and MAY re-issue the same
   challenge while the order can still be paid.
5. Require the `contract_terms` of the paid order to match what the
   server issued: `amount` equal to the order amount (compare as Taler
   amounts, not as strings), `order_id` equal to the Order Identifier,
   `merchant_base_url` equal to `methodDetails.merchantBaseUrl`, and
   `fulfillment_url` equal to the one the server set (or
   `fulfillment_message`, if that was used). The documentation lists
   these as fields of the contract terms ({{TALER-MERCHANT-API}},
   "Contract base terms").
6. Apply the refund rule of {{refunds}}.
7. Mark the order as redeemed in the same atomic step that decides to
   grant access ({{replay}}), then answer 200 with a receipt
   ({{receipt}}).

The server MUST NOT grant access if the merchant backend cannot be
reached or answers with an error; it answers 500 with the problem type
`internal-payment-error` instead.

If verification fails for any other reason the server answers 402 with a
challenge and the problem type from {{I-D.httpauth-payment}}
(`invalid-challenge`, `payment-expired`, `verification-failed`,
`malformed-credential` or `invalid-payload`).

## Settlement {#settlement}

Settlement is the merchant backend's concern. When the server reads
`order_status` as `"paid"` the customer has paid the order. The
exchange transfers the money to the merchant's bank account later,
by the order's wire transfer deadline; the backend reports that as
`wired` ({{TALER-MERCHANT-API}}, "Inspecting orders").

How the backend learns of the transfer depends on how its operator has
set it up. The backend can be told about incoming bank transfers
through its API ("Informing the backend about incoming wire
transfers"), or import them with a tool such as
`taler-merchant-wirewatch`, which imports "information about incoming
bank transfers into a Taler merchant backend", "allow[ing] the merchant
backend to validate that the exchange paid the merchant correctly"
({{TALER-WIREWATCH}}). `wired` therefore says something about the
operator's reconciliation, not about the payer, and a server MUST NOT
make access depend on it.

### Finality {#finality}

Servers SHOULD grant access when the order is paid and SHOULD NOT wait
for `wired`. A paid order may still be refunded until its refund
deadline ({{refunds}}), so a paid order is not irrevocable. The server
chooses the refund deadline when it creates the order
({{order-creation}}).

### Failure Handling

If an order expires unpaid, it can no longer be paid; the server issues
a new challenge with a new order on the next request. A payment that
is in progress in the wallet when the deadline passes may fail, and the
wallet reports that to its user; nothing in the Payment scheme is
affected.

# Expiry, Replay and Idempotency {#expiry-and-replay}

## Expiry {#expiry}

The challenge `expires` is the order's pay deadline, in {{RFC3339}}
format. After it the merchant backend does not accept payment for the
order ({{TALER-MERCHANT-API}}, "Orders": "After this deadline, the
merchant won't accept payments for the contract"). A credential for an
expired challenge is answered with `payment-expired`.

## Replay and Idempotency {#replay}

A challenge, and so its order, is single-use. After a credential has
been accepted the same credential, or any other credential for the same
order, MUST be rejected with `invalid-challenge`. Servers MUST make the
transition from "open" to "redeemed" atomic, so that concurrent
requests carrying the same credential produce at most one 200
({{I-D.httpauth-payment}}, concurrent request handling). A request that
is being verified is not open: a second request for the same order
while the first is in flight is rejected, and the order returns to
"open" if verification fails.

The server applies the same check to every HTTP method on the protected
resource, HEAD included.

Servers SHOULD accept an `Idempotency-Key` header on non-idempotent
requests as described in {{I-D.httpauth-payment}}.

## Fulfillment URL and Fulfillment Message {#fulfillment}

Every Taler order contains either a `fulfillment_url` or a
`fulfillment_message`, which the wallet uses after the contract has been
paid ({{TALER-FULFILLMENT}}; {{TALER-MERCHANT-API}}, "Contract base
terms"). The fulfillment URL has a second purpose besides redirecting
the customer: it is what wallets use for repurchase detection
({{TALER-FULFILLMENT}}). The choice between the two, and between kinds
of URL, depends on what the server sells.

**Resources paid per request.** For a resource that is paid for again
on every request, such as an API call or a file the payer fetches once,
the server MUST give every order its own `fulfillment_url`. The Taler
tutorial says that "merchants must make sure to not use the same
fulfillment URL for different products or for physical products where
customers may be expected to buy the article repeatedly", and that "A
convenient way to create a unique fulfillment URL is to embed the order
ID in the fulfillment URL". The merchant backend replaces the
placeholder `${ORDER_ID}` in the `fulfillment_url` it is given with the
actual order identifier before storing the contract, and the placeholder
can be used once ({{TALER-FULFILLMENT}}; {{TALER-MERCHANT-API}},
"Contract base terms"). A server SHOULD use that placeholder, for
example `https://api.example.com/api/quote?order=${ORDER_ID}`. Its
effect was observed on the demo backend: the stored `fulfillment_url`
had the order identifier in place of the placeholder.

This was also observed as a defect in an implementation of this method
{{ARVUNA-PROTOTYPE}}. In its first version every order for a resource
used the resource's URL as `fulfillment_url`. The first purchase worked.
For the second, the wallet reported "Repurchase detected" and did not
pay; the order stayed `claimed`, and the server, correctly, answered
402 to the retried request. Giving each order a unique fulfillment URL
(the resource URL plus a random query parameter) fixed it: both
formats were then paid for the same resource on the same wallet.

**Products to which the payer should keep access.** For a digital
product that a customer may want to open again, possibly on another
device, the tutorial describes repurchase detection: when a wallet that
has paid for a fulfillment URL claims a new order with the same
URL, it "will claim the contract, detect that the fulfillment URL is
identical to one that it already has made a payment for in the past, and
initiate repurchase redirection", replaying its earlier payment under
the browser's current session ID. The tutorial says it is "crucial that
merchants consistently use the same fulfillment URL for the same digital
product where repurchase detection is desired" ({{TALER-FULFILLMENT}}).
A server that sells access to a product in this way uses one
fulfillment URL per product, for example the URL of the article.

In this case a wallet that has already paid does not pay the new
order; so the new order stays unpaid, and the server's verification
({{verification}}) cannot succeed on it. The merchant backend reports an
earlier paid order of the same session through `already_paid_order_id`
and `already_paid_fulfillment_url` in the unpaid-status responses, and
the order can be bound to a session with `session_id` when it is created
({{TALER-MERCHANT-API}}, "Querying payment status", "Inspecting orders"
and "Creating orders"). A server that offers per-product access MUST
therefore decide on that earlier payment. This document does not define
how, and the prototype {{ARVUNA-PROTOTYPE}} implements only the
per-request case; per-product access is described here from the
documentation and is untested.

**No URL.** If the server has no URL to send the customer to, the order
carries a `fulfillment_message` instead: text the wallet shows after the
purchase, used "when the merchant does not have a fulfillment URL to
redirect the user to" ({{TALER-FULFILLMENT}}). The tutorial warns that
wallets learn the text before the purchase is made, so it "should not
contain any actual credentials or information that the user might be
buying". With a message there is no fulfillment URL for the wallet to
compare. The demo backend accepted an order that had only a
`fulfillment_message` and returned it in the claimed contract
(observed); what a wallet does after paying such an order was not
tested, and the prototype used a URL.

The fulfillment URL and the fulfillment message MUST NOT contain
anything that identifies the payer.

# Receipt {#receipt}

On success the server returns `Payment-Receipt` as defined by
{{I-D.httpauth-payment}}, and `Cache-Control: private`. The receipt
contains:

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `"success"` |
| `method` | string | `"taler"` |
| `timestamp` | string | {{RFC3339}} time of the payment |
| `reference` | string | The Order Identifier |

`timestamp` SHOULD be the `last_payment` time that the merchant backend
reports for the order ({{TALER-MERCHANT-API}}, "Inspecting orders"),
converted to {{RFC3339}} in UTC.

**Example** (the encoded form is in {{ex-receipt}}):

~~~json
{
  "method": "taler",
  "reference": "2026.293-Z2SX6Z5QR12R2",
  "status": "success",
  "timestamp": "2026-10-20T13:06:02Z"
}
~~~

# Refunds {#refunds}

Refunds are not part of the HTTP exchange. A Taler refund is granted by
the merchant, not requested by the client: the merchant calls
`POST [/instances/$INSTANCE]/private/orders/$ORDER_ID/refund` with an
amount and a reason, and the backend returns a `taler://refund/...`
URI that the wallet processes
({{TALER-MERCHANT-API}}, "Approving Refunds"). The wallet then collects
the refund from the backend with
`POST [/instances/$INSTANCE]/orders/$ORDER_ID/refund` ("Obtaining
refunds").

Refunds are time-limited: "Refunds are time-limited and can only happen
while the exchange holds funds for a particular payment in escrow. The
time during which a refund is possible can be controlled by setting the
refund_deadline in an order. The default value for this refund deadline
is specified in the configuration of the merchant's backend"
({{TALER-REFUNDS}}). The refund deadline is therefore configurable by
default, in the backend, and per order, in the order. After the
deadline "no refunds will be accepted" ({{TALER-MERCHANT-API}},
"Orders"). A `refund_deadline` of 0 lies in the past, so by that
sentence an order with that value accepts no refund (not tested). The
demo instance's contract terms for orders created without an explicit
deadline showed `{"t_s": 0}` (observed); the documentation neither
explains that default nor gives the value 0 a special meaning beyond
being in the past.

The documentation states further limits, which this method inherits:

- A refund cannot exceed the amount paid, and cannot be granted for an
  unpaid order (409).
- A refund can be refused as "too late" (410) because "the exchange may
  have already wired the funds to the merchant".
- If the order's refund delay was zero, refunds are "categorically not
  allowed" (403).

A server that delivers something that cannot be given back therefore
sets a refund deadline that matches its policy when it creates the
order ({{order-creation}}), instead of relying on the backend's
default. A server that allows refunds sets a deadline that covers the
period during which it will honour them.

The refund status is part of the order status: `refunded`,
`refund_pending`, `refund_amount` and the list `refund_details`
("Inspecting orders"). A server SHOULD NOT grant access for an order
whose `refund_amount` equals the order amount. What it does for a
partial refund is its own policy.

The single-use credential is consumed at the first success, so a refund
granted later does not revoke access already given. That is the
behaviour of a "charge" whose reversibility the charge intent describes
as method-dependent {{I-D.payment-intent-charge}}: for this method it is
bounded by the refund deadline the server chose.

# Security Considerations

## Transport Security

All communication MUST use TLS 1.2 or higher, between the client and
the server and between the server and the merchant backend.

## Merchant Credentials

The server authenticates to the private API of the merchant backend
with an access token. The server MUST keep it secret, MUST NOT expose
it to clients, and SHOULD use a token whose scope contains only the
permissions it needs. The documented scope `order-simple` consists of
`orders-read` and `orders-write` and "allows the creation of orders and
checking of payment status" ({{TALER-MERCHANT-API}}, "Scopes and
permissions"), which is all this method uses. Scopes that also grant
refunds or inventory permissions SHOULD NOT be used. Login tokens
are "commonly only valid for a limited period of time"
("Authentication"), and the documentation marks sending the instance
password itself as a bearer token as deprecated. Servers SHOULD
therefore obtain login tokens from the token endpoint and renew them
before they expire.

## Who Is Paid

A challenge names the merchant backend in `merchantBaseUrl` and in the
Taler Pay URI. A malicious server could name a merchant other than the
one that provides the resource. Clients SHOULD check that the merchant
is acceptable to them before paying, for example by comparing the
merchant named in the contract that the wallet displays, and wallets
already show that merchant to their user.

## Binding the Order to the Requesting Client {#binding}

The challenge carries the Claim Token in the `c` parameter of the Taler
Pay URI ({{pay-uri}}). The wallet presents it when it claims the order:
the claim request has a `token` field, "the token that authorizes the
wallet to claim the order" ({{TALER-MERCHANT-API}}, "Claiming an
order"), and the backend returns the token to the server only when the
order is created with `create_token` set ("Creating orders"). On the
demo backend, with a token-protected order, a claim without the token
and a claim with a wrong token were both refused with HTTP 404 ("the
backend is unaware of it") and left the order unclaimed; a claim with
the right token succeeded; and a second claim with the right token but
another nonce was refused with HTTP 409 ("another client claimed it
first"), as the documentation describes for the claim endpoint
(observed). The token is delivered only in the challenge response, over
TLS, to the client that made the request. Only that client, or someone
it shares the challenge with, can therefore make a wallet claim and pay
the order. Without the token, anyone who learned an order identifier
could try to claim the order first and keep the real client from paying
it.

The token is a random value and does not identify the payer, so the
binding does not conflict with the privacy goal of Taler ({{privacy}}).

The credential itself still contains no secret: whoever presents the
echoed challenge and the order identifier for a paid order receives the
resource. The challenge, and the Taler Pay URI inside it, are therefore
confidential to the client that received them. Servers MUST send
challenges over TLS only, MUST NOT log them where third parties can
read them, and MUST NOT create orders with `create_token` set to false.

## Amount and Resource Verification

The server MUST verify, as in {{verification}}, that the paid contract
matches the order it issued, including the amount and the fulfillment
URL. Without this a client could pay a cheap order created through
another channel of the same merchant instance and redeem it here. The
server's own record of the orders it issued is what prevents it.

## Denial of Service

An unauthenticated request makes the server create an order
({{order-creation}}). A server SHOULD limit the rate at which it creates
orders, SHOULD reuse an open order for a resource when it can do so
without identifying clients, SHOULD use short pay deadlines, and SHOULD
delete unpaid unclaimed orders after they expire.

## Merchant Backend Availability and Consistency

The merchant backend is the only source of truth for payment. If it is
unavailable the server fails closed ({{verification}}). The server
reads the order status at verification time and acts on it in the same
atomic step ({{replay}}); a status read earlier MUST NOT be reused.

## Clock

`expires` is compared with the server's clock, and the merchant backend
applies the pay deadline with its own. Servers SHOULD keep their clocks
synchronized and SHOULD set `expires` no later than the deadline the
backend reports.

# Privacy Considerations {#privacy}

GNU Taler describes itself as a privacy-preserving payment system in
which "customers can stay anonymous" and do not have to register with
the merchant ({{TALER-FEATURES}}). This method is meant to preserve
that, and the following apply:

- The credential payload contains an order identifier and nothing about
  the payer. Clients SHOULD omit `source`, and servers MUST NOT require
  or store it.
- Servers SHOULD NOT bind an order to an IP address, a cookie or any
  other client identifier, except where an explicit design needs it. The
  Claim Token is random and is not such an identifier ({{binding}}).
- The fulfillment URL, the fulfillment message, the order summary,
  `externalId` and any other field of the order MUST NOT contain data
  that identifies the payer.
- The merchant backend and the server learn what the client asks for and
  when it pays; they do not learn who the payer is from the Payment
  exchange. Network-level information such as IP addresses is outside
  this specification and is visible to the server as for any HTTP
  request.
- This method has no `recipient` field. The challenge does not carry the
  merchant's bank account. The contract terms that the merchant backend
  hands to a wallet do not contain the payto URI either: they carry
  `h_wire`, "the hash of the merchant instance's wire details", and the
  `wire_method` ({{TALER-MERCHANT-API}}, "Contract base terms"). The
  backend computes `h_wire` as a "hash over the wire details (including
  over the salt)" and the salt is kept with the account, in the
  instance's authenticated management data ("Instance management"). The
  contract terms of a paid order, read from the demo backend, contain
  `h_wire` and no salt (observed). A client therefore cannot recover the
  payto URI from a contract, and a server that put it into the
  challenge would disclose to every requester an account that Taler's
  contract design keeps from them. The charge intent lists `recipient`
  as OPTIONAL, so omitting it conforms {{I-D.payment-intent-charge}}.

# IANA Considerations

## Payment Method Registration

This specification registers the "taler" payment method in the "HTTP
Payment Methods" registry established by {{I-D.httpauth-payment}}:

| Field | Value |
|-------|-------|
| Method Identifier | `taler` |
| Description | GNU Taler payments, settled through a Taler merchant backend |
| Reference | This document |
| Contact | seekdaseek, https://github.com/seekdaseek/arvuna/issues |

**OPEN QUESTION (OQ-8):** the contact is a placeholder. Registrations
need a contact that will remain valid; who should be named?

## Payment Intent Registration

The "charge" intent is registered by {{I-D.payment-intent-charge}}.
This document registers no new intent.

--- back

# Examples

The values below have the shape of a payment made on the public Taler
demo backend with the wallet command-line tool, whose transcript is in
{{ARVUNA-PROTOTYPE}}. The merchant base URL, order identifier, deadline,
receipt time and amount are the ones from that run. The challenge
identifier and the claim token are illustrative (the paid run created
its orders without a token). Every encoded value is JCS-serialized and
then base64url encoded without padding, and decodes to the JSON shown
under it.

## Order Creation (server to merchant backend)

~~~http
POST /instances/sandbox/private/orders HTTP/1.1
Host: backend.demo.taler.net
Authorization: Bearer secret-token:...
Content-Type: application/json

{
  "order": {
    "amount": "KUDOS:0.1",
    "summary": "Access to /api/quote",
    "fulfillment_url": "https://api.example.com/api/quote?order=${ORDER_ID}",
    "pay_deadline": { "t_s": 1792502159 },
    "refund_deadline": { "t_s": 1792502159 }
  }
}
~~~

The response has the form (see "Creating orders"); the claim token is
returned because `create_token` is not set to false:

~~~json
{
  "order_id": "2026.293-Z2SX6Z5QR12R2",
  "pay_deadline": { "t_s": 1792502159 },
  "token": "H3QZ8MXK2V9TRW5NB7DYC4F6JA"
}
~~~

## Challenge {#ex-challenge}

~~~http
HTTP/1.1 402 Payment Required
Cache-Control: no-store
Content-Type: application/problem+json
WWW-Authenticate: Payment id="x9Qm2LrT7vNbK4cWyP3hSa",
    realm="api.example.com",
    method="taler",
    intent="charge",
    expires="2026-10-20T13:15:59Z",
    request="eyJhbW91bnQiOiIxMCIsImN1cnJlbmN5Ijoia3Vkb3MiLCJkZXNjcmlwdGlvbiI6IkFjY2VzcyB0byAvYXBpL3F1b3RlIiwiZXh0ZXJuYWxJZCI6IjIwMjYuMjkzLVoyU1g2WjVRUjEyUjIiLCJtZXRob2REZXRhaWxzIjp7Im1lcmNoYW50QmFzZVVybCI6Imh0dHBzOi8vYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8iLCJvcmRlcklkIjoiMjAyNi4yOTMtWjJTWDZaNVFSMTJSMiIsInRhbGVyUGF5VXJpIjoidGFsZXI6Ly9wYXkvYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8yMDI2LjI5My1aMlNYNlo1UVIxMlIyLz9jPUgzUVo4TVhLMlY5VFJXNU5CN0RZQzRGNkpBIn19"
~~~

Decoded `request`:

~~~json
{
  "amount": "10",
  "currency": "kudos",
  "description": "Access to /api/quote",
  "externalId": "2026.293-Z2SX6Z5QR12R2",
  "methodDetails": {
    "merchantBaseUrl": "https://backend.demo.taler.net/instances/sandbox/",
    "orderId": "2026.293-Z2SX6Z5QR12R2",
    "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-Z2SX6Z5QR12R2/?c=H3QZ8MXK2V9TRW5NB7DYC4F6JA"
  }
}
~~~

## Credential {#ex-credential}

The client has handed the Taler Pay URI from the challenge to its
wallet, which claimed and paid the order. It repeats the request:

~~~http
GET /api/quote HTTP/1.1
Host: api.example.com
Authorization: Payment eyJjaGFsbGVuZ2UiOnsiZXhwaXJlcyI6IjIwMjYtMTAtMjBUMTM6MTU6NTlaIiwiaWQiOiJ4OVFtMkxyVDd2TmJLNGNXeVAzaFNhIiwiaW50ZW50IjoiY2hhcmdlIiwibWV0aG9kIjoidGFsZXIiLCJyZWFsbSI6ImFwaS5leGFtcGxlLmNvbSIsInJlcXVlc3QiOiJleUpoYlc5MWJuUWlPaUl4TUNJc0ltTjFjbkpsYm1ONUlqb2lhM1ZrYjNNaUxDSmtaWE5qY21sd2RHbHZiaUk2SWtGalkyVnpjeUIwYnlBdllYQnBMM0YxYjNSbElpd2laWGgwWlhKdVlXeEpaQ0k2SWpJd01qWXVNamt6TFZveVUxZzJXalZSVWpFeVVqSWlMQ0p0WlhSb2IyUkVaWFJoYVd4eklqcDdJbTFsY21Ob1lXNTBRbUZ6WlZWeWJDSTZJbWgwZEhCek9pOHZZbUZqYTJWdVpDNWtaVzF2TG5SaGJHVnlMbTVsZEM5cGJuTjBZVzVqWlhNdmMyRnVaR0p2ZUM4aUxDSnZjbVJsY2tsa0lqb2lNakF5Tmk0eU9UTXRXakpUV0RaYU5WRlNNVEpTTWlJc0luUmhiR1Z5VUdGNVZYSnBJam9pZEdGc1pYSTZMeTl3WVhrdlltRmphMlZ1WkM1a1pXMXZMblJoYkdWeUxtNWxkQzlwYm5OMFlXNWpaWE12YzJGdVpHSnZlQzh5TURJMkxqSTVNeTFhTWxOWU5sbzFVVkl4TWxJeUx6OWpQVWd6VVZvNFRWaExNbFk1VkZKWE5VNUNOMFJaUXpSR05rcEJJbjE5In0sInBheWxvYWQiOnsib3JkZXJJZCI6IjIwMjYuMjkzLVoyU1g2WjVRUjEyUjIifX0
~~~

Decoded credential:

~~~json
{
  "challenge": {
    "expires": "2026-10-20T13:15:59Z",
    "id": "x9Qm2LrT7vNbK4cWyP3hSa",
    "intent": "charge",
    "method": "taler",
    "realm": "api.example.com",
    "request": "eyJhbW91bnQiOiIxMCIsImN1cnJlbmN5Ijoia3Vkb3MiLCJkZXNjcmlwdGlvbiI6IkFjY2VzcyB0byAvYXBpL3F1b3RlIiwiZXh0ZXJuYWxJZCI6IjIwMjYuMjkzLVoyU1g2WjVRUjEyUjIiLCJtZXRob2REZXRhaWxzIjp7Im1lcmNoYW50QmFzZVVybCI6Imh0dHBzOi8vYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8iLCJvcmRlcklkIjoiMjAyNi4yOTMtWjJTWDZaNVFSMTJSMiIsInRhbGVyUGF5VXJpIjoidGFsZXI6Ly9wYXkvYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8yMDI2LjI5My1aMlNYNlo1UVIxMlIyLz9jPUgzUVo4TVhLMlY5VFJXNU5CN0RZQzRGNkpBIn19"
  },
  "payload": {
    "orderId": "2026.293-Z2SX6Z5QR12R2"
  }
}
~~~

## Receipt {#ex-receipt}

~~~http
HTTP/1.1 200 OK
Cache-Control: private
Payment-Receipt: eyJtZXRob2QiOiJ0YWxlciIsInJlZmVyZW5jZSI6IjIwMjYuMjkzLVoyU1g2WjVRUjEyUjIiLCJzdGF0dXMiOiJzdWNjZXNzIiwidGltZXN0YW1wIjoiMjAyNi0xMC0yMFQxMzowNjowMloifQ
~~~

Decoded receipt:

~~~json
{
  "method": "taler",
  "reference": "2026.293-Z2SX6Z5QR12R2",
  "status": "success",
  "timestamp": "2026-10-20T13:06:02Z"
}
~~~

# Mapping to x402 Version 2 {#x402-mapping}

x402 version 2 {{X402}} carries the same exchange in HTTP headers
{{X402-HTTP}}. This appendix is informative. The flow is the same:
the server creates an order, answers 402 with the order in
`PAYMENT-REQUIRED`, the client pays with a Taler wallet and retries with
`PAYMENT-SIGNATURE`, and the server verifies as in {{verification}} and
answers with `PAYMENT-RESPONSE`. A server MAY offer the IETF challenge
and the x402 requirement in the same 402 response; they MUST refer to
the same order.

The order identifier and the merchant base URL are taken from the Taler
Pay URI as described in {{pay-uri}}, so the requirement does not repeat
them.

| x402 field | Value for Taler |
|------------|-----------------|
| `scheme` | `exact` |
| `network` | `taler:` followed by the Taler currency code verbatim, for example `taler:KUDOS`. It is a CAIP-2 {{CAIP-2}} identifier: the code has at most 11 letters and CAIP-2 allows up to 32 characters of letters, digits, "-" and "_" in the reference part. |
| `amount` | As `amount` in {{amount}} |
| `asset` | The Taler currency code verbatim, for example `KUDOS` |
| `payTo` | The merchant base URL derived from the Taler Pay URI ({{pay-uri}}) |
| `maxTimeoutSeconds` | Seconds until the order's pay deadline |
| `extra.talerPayUri` | The Taler Pay URI, with the Claim Token |

The `PaymentPayload` sent in `PAYMENT-SIGNATURE` carries the
requirement the client accepted in `accepted` and an empty `payload`
object: the proof is the state of the order, not anything the client
sends. The server MUST check that `accepted` equals the requirement it
issued for that order (ignoring `maxTimeoutSeconds`, which changes with
time), takes the order identifier from `accepted.extra.talerPayUri`
({{pay-uri}}), and then verifies the order as in {{verification}}.

In `PAYMENT-RESPONSE`, `success` is true, `network` is the network of
the requirement and `amount` is the paid amount in the same unit.
x402 defines `transaction` as a blockchain transaction hash
{{X402-HTTP}}. Taler has none, and the identifier of the payment is the
order identifier, which {{LSD0006}} places in the Taler Pay URI as the
segment before the session identifier; `transaction` is that order
identifier.

## x402 Examples

`PAYMENT-REQUIRED` (the header value is standard base64 of the JCS
serialization of the JSON shown):

~~~http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJhY2NlcHRzIjpbeyJhbW91bnQiOiIxMCIsImFzc2V0IjoiS1VET1MiLCJleHRyYSI6eyJ0YWxlclBheVVyaSI6InRhbGVyOi8vcGF5L2JhY2tlbmQuZGVtby50YWxlci5uZXQvaW5zdGFuY2VzL3NhbmRib3gvMjAyNi4yOTMtQ1haREdFMVMzUFcxTS8/Yz1QNldOMlhUOEtRNFlCOVpEM1ZNQzdSSEY1RSJ9LCJtYXhUaW1lb3V0U2Vjb25kcyI6NTk5LCJuZXR3b3JrIjoidGFsZXI6S1VET1MiLCJwYXlUbyI6Imh0dHBzOi8vYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8iLCJzY2hlbWUiOiJleGFjdCJ9XSwiZXJyb3IiOiJQQVlNRU5ULVNJR05BVFVSRSBoZWFkZXIgaXMgcmVxdWlyZWQiLCJyZXNvdXJjZSI6eyJkZXNjcmlwdGlvbiI6IkFjY2VzcyB0byAvYXBpL3F1b3RlIiwibWltZVR5cGUiOiJhcHBsaWNhdGlvbi9qc29uIiwidXJsIjoiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20vYXBpL3F1b3RlIn0sIng0MDJWZXJzaW9uIjoyfQ==
~~~

Decoded `PAYMENT-REQUIRED`:

~~~json
{
  "accepts": [
    {
      "amount": "10",
      "asset": "KUDOS",
      "extra": {
        "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-CXZDGE1S3PW1M/?c=P6WN2XT8KQ4YB9ZD3VMC7RHF5E"
      },
      "maxTimeoutSeconds": 599,
      "network": "taler:KUDOS",
      "payTo": "https://backend.demo.taler.net/instances/sandbox/",
      "scheme": "exact"
    }
  ],
  "error": "PAYMENT-SIGNATURE header is required",
  "resource": {
    "description": "Access to /api/quote",
    "mimeType": "application/json",
    "url": "https://api.example.com/api/quote"
  },
  "x402Version": 2
}
~~~

After paying, the client retries:

~~~http
GET /api/quote HTTP/1.1
Host: api.example.com
PAYMENT-SIGNATURE: eyJhY2NlcHRlZCI6eyJhbW91bnQiOiIxMCIsImFzc2V0IjoiS1VET1MiLCJleHRyYSI6eyJ0YWxlclBheVVyaSI6InRhbGVyOi8vcGF5L2JhY2tlbmQuZGVtby50YWxlci5uZXQvaW5zdGFuY2VzL3NhbmRib3gvMjAyNi4yOTMtQ1haREdFMVMzUFcxTS8/Yz1QNldOMlhUOEtRNFlCOVpEM1ZNQzdSSEY1RSJ9LCJtYXhUaW1lb3V0U2Vjb25kcyI6NTk5LCJuZXR3b3JrIjoidGFsZXI6S1VET1MiLCJwYXlUbyI6Imh0dHBzOi8vYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8iLCJzY2hlbWUiOiJleGFjdCJ9LCJwYXlsb2FkIjp7fSwicmVzb3VyY2UiOnsiZGVzY3JpcHRpb24iOiJBY2Nlc3MgdG8gL2FwaS9xdW90ZSIsIm1pbWVUeXBlIjoiYXBwbGljYXRpb24vanNvbiIsInVybCI6Imh0dHBzOi8vYXBpLmV4YW1wbGUuY29tL2FwaS9xdW90ZSJ9LCJ4NDAyVmVyc2lvbiI6Mn0=
~~~

Decoded `PAYMENT-SIGNATURE`:

~~~json
{
  "accepted": {
    "amount": "10",
    "asset": "KUDOS",
    "extra": {
      "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-CXZDGE1S3PW1M/?c=P6WN2XT8KQ4YB9ZD3VMC7RHF5E"
    },
    "maxTimeoutSeconds": 599,
    "network": "taler:KUDOS",
    "payTo": "https://backend.demo.taler.net/instances/sandbox/",
    "scheme": "exact"
  },
  "payload": {},
  "resource": {
    "description": "Access to /api/quote",
    "mimeType": "application/json",
    "url": "https://api.example.com/api/quote"
  },
  "x402Version": 2
}
~~~

~~~http
HTTP/1.1 200 OK
PAYMENT-RESPONSE: eyJhbW91bnQiOiIxMCIsIm5ldHdvcmsiOiJ0YWxlcjpLVURPUyIsInN1Y2Nlc3MiOnRydWUsInRyYW5zYWN0aW9uIjoiMjAyNi4yOTMtQ1haREdFMVMzUFcxTSJ9
~~~

Decoded `PAYMENT-RESPONSE`:

~~~json
{
  "amount": "10",
  "network": "taler:KUDOS",
  "success": true,
  "transaction": "2026.293-CXZDGE1S3PW1M"
}
~~~

# Changes from Version 00 {#changes}

This appendix is to be removed before submission. Version 01 follows
the review of version 00 by the GNU Taler developers on the
taler@gnu.org mailing list.

* Amount ({{amount}}): the base unit now comes from the exchange's
  currency specification where one is published, so that EUR and CHF
  use cents, and falls back to 10^-8 only where none is given. Version
  00 always used 10^-8. This stays open as OQ-1, addressed to the Taler
  developers.
* Currency ({{currency}}): comparison is case-insensitive and the
  lowercase form is used on the wire. This closes OQ-2 of version 00.
  The review is the source for the case rule; the text says that
  {{RFC8905}} does not state one.
* Recipient: removed from the request, and the privacy considerations
  explain why ({{privacy}}). This closes OQ-3 of version 00.
* Order creation ({{order-creation}}): the text states that recording
  the challenge requires creating the order at the merchant, and records
  the stateless, cacheable Paivana alternative that the core
  specification does not allow as a core specification issue (CSI-1).
  This closes OQ-4 of version 00 for this method.
* Fulfillment ({{fulfillment}}): follows the Taler tutorial. One unique
  URL with the `${ORDER_ID}` placeholder for resources paid per
  request, one URL per product where repurchase detection is wanted,
  and `fulfillment_message` when there is no URL. This closes OQ-5 of
  version 00.
* Refunds ({{refunds}}): the refund deadline is configurable by
  default and per order, and a deadline of 0 allows no refund. This
  closes OQ-6 of version 00.
* Binding ({{binding}}): the challenge carries the Claim Token, so only
  the requesting client can claim the order. Orders are created with
  `create_token` true. This closes OQ-7 of version 00.
* x402 ({{x402-mapping}}): the order identifier and the merchant base
  URL are taken from the Taler Pay URI as {{LSD0006}} defines it,
  `transaction` is the order identifier, `payTo` is the merchant base
  URL, and the payload is empty. This closes OQ-9 of version 00.
* New: the Taler Pay URI syntax and the derivation of the order
  identifier and merchant base URL ({{pay-uri}}); how the merchant
  backend learns of wire transfers ({{settlement}}).
* Unchanged: OQ-8, the IANA contact.

# Open Questions for Reviewers {#open-questions}

This appendix is to be removed before submission.

## Open

| # | Question | Draft's current answer |
|---|----------|------------------------|
| OQ-1 | Is the exchange's currency specification an acceptable source for the unit of `amount`, and which field, which exchange, and should `methodDetails` also carry the Taler amount string? (Addressed to the Taler developers; not yet answered.) | `num_fractional_input_digits` of the exchange's specification, else 10^-8 |
| OQ-8 | IANA contact | Placeholder |

## Core specification issue, to be raised upstream

| # | Issue |
|---|-------|
| CSI-1 | Should the core scheme allow a static, cacheable challenge, as in the Paivana design, for methods whose payment request is created when the payer engages? Today it requires a unique identifier and `Cache-Control: no-store` in every 402. |

## Closed in this version

| # | Resolution |
|---|------------|
| OQ-2 | Lowercase on the wire, compared case-insensitively |
| OQ-3 | No `recipient` field |
| OQ-4 | For this method, recording the challenge is creating the order; the alternative is CSI-1 |
| OQ-5 | Per-request unique URL with `${ORDER_ID}`; per-product URL where repurchase detection is wanted; `fulfillment_message` when there is no URL |
| OQ-6 | Refund deadline configurable by default and per order; the server sets it explicitly |
| OQ-7 | The Claim Token in the Taler Pay URI |
| OQ-9 | Order identifier and base URL taken from the Taler Pay URI |

The Paivana point of version 00 is now CSI-1.
