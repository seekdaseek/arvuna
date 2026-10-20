---
title: Taler Charge Intent for HTTP Payment Authentication
abbrev: Taler Charge
docname: draft-taler-charge-00
version: 00
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
  RFC8905:
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

informative:
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

Every statement about the behaviour of the merchant backend in this
document cites the page of the Taler documentation it comes from.
Where the documentation does not settle a point, the text is marked
OPEN QUESTION and collected in {{open-questions}}.

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

Taler Pay URI
: The `taler://pay/...` URI that a wallet processes to pay an order. It
  is called `taler_pay_uri` by the merchant backend
  ({{TALER-MERCHANT-API}}, "Querying payment status").

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
defined here.

### Shared Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | string | REQUIRED | Amount in units of 10^-8 of the currency ({{amount}}) |
| `currency` | string | REQUIRED | Taler currency code in lowercase ({{currency}}) |
| `description` | string | OPTIONAL | The order's `summary` |
| `externalId` | string | RECOMMENDED | The Order Identifier |
| `recipient` | string | OPTIONAL | A payto URI {{RFC8905}} ({{recipient}}) |

### Method Details

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `methodDetails.merchantBaseUrl` | string | REQUIRED | Base URL of the merchant instance, absolute, ending in "/" |
| `methodDetails.orderId` | string | REQUIRED | The Order Identifier |
| `methodDetails.talerPayUri` | string | REQUIRED | The Taler Pay URI of the order |

If `externalId` is present it MUST equal `methodDetails.orderId`. As
for every challenge, expiry is conveyed only by the `expires`
auth-param and MUST NOT be repeated in `request`
{{I-D.payment-intent-charge}}.

**Example** (the encoded form is in {{ex-challenge}}):

~~~json
{
  "amount": "10000000",
  "currency": "kudos",
  "description": "Access to /api/quote",
  "externalId": "2026.293-Z2SX6Z5QR12R2",
  "methodDetails": {
    "merchantBaseUrl": "https://backend.demo.taler.net/instances/sandbox/",
    "orderId": "2026.293-Z2SX6Z5QR12R2",
    "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-Z2SX6Z5QR12R2/"
  }
}
~~~

### Amount {#amount}

The merchant backend serializes amounts as `CURRENCY:VALUE`, where the
value has at most 8 decimal digits and Taler treats amounts as
"fixed-precision numbers, with 8 decimal places"
({{TALER-COMMON-API}}, "Amounts"). The `amount` field of this method is
the order's amount expressed as an integer number of units of 10^-8 of
the currency, written as a decimal string with no sign, no fraction and
no leading zeros. The order amount "KUDOS:0.1" is therefore "10000000".

Servers MUST NOT emit an amount that the merchant backend would not
accept as an order amount. Clients SHOULD check that `amount`, after
converting it back, equals the amount of the contract their wallet
shows, and SHOULD NOT pay if they differ.

**OPEN QUESTION (OQ-1):** the merchant backend publishes, for each of
its currencies, a currency specification that gives a number of
fractional digits, but the documentation calls it "a *hint*" for
rendering that applications "may ignore" ({{TALER-MERCHANT-API}},
"Configuration API"). This draft therefore does not use it to define the
unit of `amount`, and fixes the unit at the documented precision of
10^-8 instead. Is that the unit the Taler developers would choose, or
should the base unit be the currency's smallest displayed unit (for
KUDOS, 10^-2)?

### Currency {#currency}

A Taler currency code consists of at most 11 ASCII letters
({{TALER-COMMON-API}}, "Amounts"), for example "KUDOS", "CHF" or "EUR".
The `currency` field is that code converted to lowercase ASCII:
"kudos", "chf", "eur".

The charge intent writes ISO 4217 codes in lowercase and allows other,
method-defined formats {{I-D.payment-intent-charge}}. Taler codes are
not all ISO 4217 codes (KUDOS is not), and applying the lowercase rule
to all of them keeps one rule for the method, keeps the field uniform
for generic clients, and matches how the charge intent treats codes
that are ISO 4217. The case of the code is recoverable, because the
exact code is part of the order's amount in the contract that the
wallet reads from the merchant backend.

**OPEN QUESTION (OQ-2):** the Taler documentation limits the character
set of the code but does not say whether two codes that differ only in
case could both exist. If they can, lowercasing is lossy. The
alternative is to carry the code verbatim, uppercase, as a
method-defined format; it would then differ from the lowercase rule of
the charge intent for real ISO 4217 codes such as CHF. Which rule do the
Taler developers prefer? The x402 mapping in {{x402-mapping}} carries
the code verbatim in `asset` in any case.

### Recipient {#recipient}

`recipient` is OPTIONAL. When present it MUST be a payto URI as defined
in {{RFC8905}} that identifies the merchant bank account the order will
be settled to, and SHOULD NOT carry the `amount` or `message` options,
because the amount and the description are carried by other fields.

A wallet does not need this field to pay: it works from the Taler Pay
URI. The merchant's payto URIs appear in the merchant backend only in
authenticated instance management ({{TALER-MERCHANT-API}}, "Instance
management"); the public contract terms carry a hash of the wire
details (`h_wire`) and the wire method (`wire_method`) instead
({{TALER-MERCHANT-API}}, "Contract base terms").

**OPEN QUESTION (OQ-3):** publishing a bank account in every challenge
discloses it to anyone who asks, and no Taler wallet is known to use
it. Should this field be dropped from the method, kept as OPTIONAL as
written, or defined as a Taler-specific identifier instead of a payto
URI?

### Obtaining the Order and the Pay URI {#order-creation}

The server creates the order with
`POST [/instances/$INSTANCE]/private/orders`
({{TALER-MERCHANT-API}}, "Creating orders"). It sets at least:

amount
: the order amount as a Taler amount string.

summary
: a human-readable description of the purchase, used as `description`.

fulfillment_url
: unique for every order ({{fulfillment}}).

pay_deadline
: a deadline in the future. The challenge `expires` MUST NOT be later
  than this deadline ({{expiry}}). The merchant backend returns the
  deadline in its response since protocol version 21
  ({{TALER-MERCHANT-API}}, "Creating orders").

The server SHOULD let the merchant backend choose the `order_id`. The
documentation says that creating an order without an explicit
`order_id` is not idempotent, and that a claim token can be omitted
(`create_token` set to false) when the order identifier "is
sufficiently high entropy to prevent adversarial claims (like it is if
the backend auto-generates one)" ({{TALER-MERCHANT-API}}, "Creating
orders"). A server that sets its own `order_id` MUST make it
unguessable, or MUST NOT set `create_token` to false.

The response to order creation does not contain the Taler Pay URI. The
server SHOULD read it from the merchant backend, either from the 402
answer of the public `GET [/instances/$INSTANCE]/orders/$ORDER_ID`
(`taler_pay_uri` in the unpaid-status response, "Querying payment
status") or from the private order status ("Inspecting orders"), and
SHOULD NOT construct it. The documentation says it is possible to
construct the URI but that it "is not unique for every order: there
might be varying parameters such as the session id"
({{TALER-MERCHANT-API}}, "Creating orders"). The server MUST copy the
URI into `methodDetails.talerPayUri` unchanged.

**OPEN QUESTION (OQ-4):** {{I-D.httpauth-payment}} says an unpaid
request "MUST NOT modify server state beyond recording the challenge
itself".
Creating an order is a write at the merchant backend that must happen
before the 402 can be sent, because the pay URI contains the order
identifier. Is creating an order "recording the challenge"? Servers can
reduce the exposure by reusing an open order for the same resource,
by short pay deadlines, by rate limiting, and by deleting unpaid
orders that were never claimed
(`DELETE [/instances/$INSTANCE]/private/orders/$ORDER_ID`, "Private
order data cleanup", which the documentation says fails for paid or
claimed-but-unpaid orders). Is that enough?

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
   `fulfillment_url` equal to the one the server set. The documentation
   lists these as fields of the contract terms ({{TALER-MERCHANT-API}},
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

## Fulfillment URL {#fulfillment}

The server MUST give every order its own `fulfillment_url`.

The reason is a behaviour of Taler wallets. The documentation says that
with a non-unique fulfillment URL "a customer can only buy the order
once and will be redirected to a previous purchase when trying to buy
an order with the same fulfillment URL a second time" while the earlier
purchase's `max_pickup_time` permits, and that "for orders where the
customer is expected to be able to make repeated purchases ... the
fulfillment URL should be made unique for every order. The easiest way
to do this is to include a unique order ID in the fulfillment URL"
({{TALER-MERCHANT-API}}, "Contract base terms"). The documentation
provides a placeholder, `${ORDER_ID}`, that the backend replaces with
the order identifier.

This was observed in an implementation of this method
{{ARVUNA-PROTOTYPE}}. In the first version, every order for a resource
used the resource's URL as `fulfillment_url`. The first purchase worked.
For the second, the wallet reported "Repurchase detected" and did not
pay; the order stayed `claimed`, and the server, correctly, answered
402 to the retried request. Giving each order a unique fulfillment URL
(the resource URL plus a random query parameter) fixed it: both
formats were then paid for the same resource on the same wallet.

The fulfillment URL MUST NOT contain anything that identifies the payer.

**OPEN QUESTION (OQ-5):** after paying, a wallet used in a browser sends
the customer to the fulfillment URL. With a unique URL per order, that
page must show something useful, which means the server must be able to
recognise a paid order there, for example by a session. This
specification defines the HTTP flow only, with single-use credentials.
Should the method also define the browser case, using the Taler
session mechanism ({{TALER-MERCHANT-API}}, "Session IDs")?

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

The documentation states these limits, which this method inherits:

- A refund cannot exceed the amount paid, and cannot be granted for an
  unpaid order (409).
- A refund can be refused as "too late" (410) because "the exchange may
  have already wired the funds to the merchant".
- If the order's refund delay was zero, refunds are "categorically not
  allowed" (403).

A server that delivers something that cannot be given back therefore
chooses a refund deadline at order creation ({{order-creation}}) that
matches its policy.

The refund status is part of the order status: `refunded`,
`refund_pending`, `refund_amount` and the list `refund_details`
("Inspecting orders"). A server SHOULD NOT grant access for an order
whose `refund_amount` equals the order amount. What it does for a
partial refund is its own policy.

**OPEN QUESTION (OQ-6):** the single-use credential is consumed at the
first success, so a refund granted later cannot revoke access already
given. Is that acceptable for a "charge", or should the method say more
about refunds of already-delivered content? On the Taler demo instance
the orders created by the prototype had a `refund_deadline` of 0 in
their contract terms; this document does not explain why.

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

## Bearer Property of the Order Identifier

The credential contains no secret. Whoever presents the echoed
challenge and the order identifier first, after the order is paid,
receives the resource. The challenge and the order identifier are
therefore confidential to the client that received them. Servers MUST
send challenges over TLS only, MUST NOT log them where third parties
can read them, and SHOULD use unguessable order identifiers
({{order-creation}}).

**OPEN QUESTION (OQ-7):** binding the order to the client that asked
for the challenge would close this, but would require an identifier for
the client, which conflicts with Taler's privacy goal ({{privacy}}). Is
there a binding that does not identify the payer, for example a random
value in the order's session that the client must present?

## Amount and Resource Verification

The server MUST verify, as in {{verification}}, that the paid contract
matches the order it issued, including the amount and the fulfillment
URL. Without this a client could pay a cheap order created through
another channel of the same merchant instance and redeem it here. The
server's own record of the orders it issued is what prevents it.

## Denial of Service

An unauthenticated request makes the server create an order
(OQ-4). A server SHOULD limit the rate at which it creates orders,
SHOULD reuse an open order for a resource when it can do so without
identifying clients, SHOULD use short pay deadlines, and SHOULD delete
unpaid unclaimed orders after they expire.

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
  other client identifier, except where an explicit design needs it.
- The fulfillment URL, the order summary, `externalId` and any other
  field of the order MUST NOT contain data that identifies the payer.
- The merchant backend and the server learn what the client asks for and
  when it pays; they do not learn who the payer is from the Payment
  exchange. Network-level information such as IP addresses is outside
  this specification and is visible to the server as for any HTTP
  request.
- `recipient` publishes the merchant's account in the challenge (OQ-3).
  It concerns the merchant, not the payer.

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
{{ARVUNA-PROTOTYPE}}. The merchant base URL, order identifier, Taler Pay
URI, deadline and receipt time are the ones from that run. The
challenge identifier is illustrative, and `amount` follows
{{amount}}: the prototype run itself used 10 (two decimal digits).
Every encoded value is JCS-serialized and then base64url encoded
without padding, and decodes to the JSON shown under it.

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
    "fulfillment_url": "https://api.example.com/api/quote?order=3f6c",
    "pay_deadline": { "t_s": 1792502159 }
  },
  "create_token": false
}
~~~

The response has the form (see "Creating orders"):

~~~json
{
  "order_id": "2026.293-Z2SX6Z5QR12R2",
  "pay_deadline": { "t_s": 1792502159 }
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
    request="eyJhbW91bnQiOiIxMDAwMDAwMCIsImN1cnJlbmN5Ijoia3Vkb3MiLCJkZXNjcmlwdGlvbiI6IkFjY2VzcyB0byAvYXBpL3F1b3RlIiwiZXh0ZXJuYWxJZCI6IjIwMjYuMjkzLVoyU1g2WjVRUjEyUjIiLCJtZXRob2REZXRhaWxzIjp7Im1lcmNoYW50QmFzZVVybCI6Imh0dHBzOi8vYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8iLCJvcmRlcklkIjoiMjAyNi4yOTMtWjJTWDZaNVFSMTJSMiIsInRhbGVyUGF5VXJpIjoidGFsZXI6Ly9wYXkvYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8yMDI2LjI5My1aMlNYNlo1UVIxMlIyLyJ9fQ"
~~~

Decoded `request`:

~~~json
{
  "amount": "10000000",
  "currency": "kudos",
  "description": "Access to /api/quote",
  "externalId": "2026.293-Z2SX6Z5QR12R2",
  "methodDetails": {
    "merchantBaseUrl": "https://backend.demo.taler.net/instances/sandbox/",
    "orderId": "2026.293-Z2SX6Z5QR12R2",
    "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-Z2SX6Z5QR12R2/"
  }
}
~~~

## Credential {#ex-credential}

The client has handed `taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-Z2SX6Z5QR12R2/`
to its wallet, which paid the order. It repeats the request:

~~~http
GET /api/quote HTTP/1.1
Host: api.example.com
Authorization: Payment eyJjaGFsbGVuZ2UiOnsiZXhwaXJlcyI6IjIwMjYtMTAtMjBUMTM6MTU6NTlaIiwiaWQiOiJ4OVFtMkxyVDd2TmJLNGNXeVAzaFNhIiwiaW50ZW50IjoiY2hhcmdlIiwibWV0aG9kIjoidGFsZXIiLCJyZWFsbSI6ImFwaS5leGFtcGxlLmNvbSIsInJlcXVlc3QiOiJleUpoYlc5MWJuUWlPaUl4TURBd01EQXdNQ0lzSW1OMWNuSmxibU41SWpvaWEzVmtiM01pTENKa1pYTmpjbWx3ZEdsdmJpSTZJa0ZqWTJWemN5QjBieUF2WVhCcEwzRjFiM1JsSWl3aVpYaDBaWEp1WVd4SlpDSTZJakl3TWpZdU1qa3pMVm95VTFnMldqVlJVakV5VWpJaUxDSnRaWFJvYjJSRVpYUmhhV3h6SWpwN0ltMWxjbU5vWVc1MFFtRnpaVlZ5YkNJNkltaDBkSEJ6T2k4dlltRmphMlZ1WkM1a1pXMXZMblJoYkdWeUxtNWxkQzlwYm5OMFlXNWpaWE12YzJGdVpHSnZlQzhpTENKdmNtUmxja2xrSWpvaU1qQXlOaTR5T1RNdFdqSlRXRFphTlZGU01USlNNaUlzSW5SaGJHVnlVR0Y1VlhKcElqb2lkR0ZzWlhJNkx5OXdZWGt2WW1GamEyVnVaQzVrWlcxdkxuUmhiR1Z5TG01bGRDOXBibk4wWVc1alpYTXZjMkZ1WkdKdmVDOHlNREkyTGpJNU15MWFNbE5ZTmxvMVVWSXhNbEl5THlKOWZRIn0sInBheWxvYWQiOnsib3JkZXJJZCI6IjIwMjYuMjkzLVoyU1g2WjVRUjEyUjIifX0
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
    "request": "eyJhbW91bnQiOiIxMDAwMDAwMCIsImN1cnJlbmN5Ijoia3Vkb3MiLCJkZXNjcmlwdGlvbiI6IkFjY2VzcyB0byAvYXBpL3F1b3RlIiwiZXh0ZXJuYWxJZCI6IjIwMjYuMjkzLVoyU1g2WjVRUjEyUjIiLCJtZXRob2REZXRhaWxzIjp7Im1lcmNoYW50QmFzZVVybCI6Imh0dHBzOi8vYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8iLCJvcmRlcklkIjoiMjAyNi4yOTMtWjJTWDZaNVFSMTJSMiIsInRhbGVyUGF5VXJpIjoidGFsZXI6Ly9wYXkvYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8yMDI2LjI5My1aMlNYNlo1UVIxMlIyLyJ9fQ"
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

| x402 field | Value for Taler |
|------------|-----------------|
| `scheme` | `exact` |
| `network` | `taler:` followed by the Taler currency code verbatim, for example `taler:KUDOS`. It is a CAIP-2 {{CAIP-2}} identifier: the code has at most 11 letters and CAIP-2 allows up to 32 characters of letters, digits, "-" and "_" in the reference part. |
| `amount` | As `amount` in {{amount}} |
| `asset` | The Taler currency code verbatim, for example `KUDOS` |
| `payTo` | The merchant base URL, as `methodDetails.merchantBaseUrl` |
| `maxTimeoutSeconds` | Seconds until the order's pay deadline |
| `extra.orderId` | The Order Identifier |
| `extra.talerPayUri` | The Taler Pay URI |

The `PaymentPayload` sent in `PAYMENT-SIGNATURE` carries the
requirement the client accepted in `accepted` and `{"orderId": ...}` in
`payload`. The server MUST check that `accepted` equals the requirement
it issued for that order (ignoring `maxTimeoutSeconds`, which changes
with time) and then verifies the order as in {{verification}}.

In `PAYMENT-RESPONSE`, `success` is true, `network` is the network of
the requirement and `amount` is the paid amount in the same unit.
`transaction` is defined by x402 as a blockchain transaction hash;
Taler has none, so the Order Identifier is used.

**OPEN QUESTION (OQ-9):** is the Order Identifier an acceptable value
for `transaction`, or should the contract hash, or an empty string as
x402 allows when no transaction was broadcast, be used? And is the
merchant base URL the right value for `payTo`, which x402 describes as a
"Recipient wallet address or role constant"?

## x402 Examples

`PAYMENT-REQUIRED` (the header value is standard base64 of the JCS
serialization of the JSON shown):

~~~http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJhY2NlcHRzIjpbeyJhbW91bnQiOiIxMDAwMDAwMCIsImFzc2V0IjoiS1VET1MiLCJleHRyYSI6eyJvcmRlcklkIjoiMjAyNi4yOTMtQ1haREdFMVMzUFcxTSIsInRhbGVyUGF5VXJpIjoidGFsZXI6Ly9wYXkvYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8yMDI2LjI5My1DWFpER0UxUzNQVzFNLyJ9LCJtYXhUaW1lb3V0U2Vjb25kcyI6NTk5LCJuZXR3b3JrIjoidGFsZXI6S1VET1MiLCJwYXlUbyI6Imh0dHBzOi8vYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8iLCJzY2hlbWUiOiJleGFjdCJ9XSwiZXJyb3IiOiJQQVlNRU5ULVNJR05BVFVSRSBoZWFkZXIgaXMgcmVxdWlyZWQiLCJyZXNvdXJjZSI6eyJkZXNjcmlwdGlvbiI6IkFjY2VzcyB0byAvYXBpL3F1b3RlIiwibWltZVR5cGUiOiJhcHBsaWNhdGlvbi9qc29uIiwidXJsIjoiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20vYXBpL3F1b3RlIn0sIng0MDJWZXJzaW9uIjoyfQ==
~~~

Decoded `PAYMENT-REQUIRED`:

~~~json
{
  "accepts": [
    {
      "amount": "10000000",
      "asset": "KUDOS",
      "extra": {
        "orderId": "2026.293-CXZDGE1S3PW1M",
        "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-CXZDGE1S3PW1M/"
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
PAYMENT-SIGNATURE: eyJhY2NlcHRlZCI6eyJhbW91bnQiOiIxMDAwMDAwMCIsImFzc2V0IjoiS1VET1MiLCJleHRyYSI6eyJvcmRlcklkIjoiMjAyNi4yOTMtQ1haREdFMVMzUFcxTSIsInRhbGVyUGF5VXJpIjoidGFsZXI6Ly9wYXkvYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8yMDI2LjI5My1DWFpER0UxUzNQVzFNLyJ9LCJtYXhUaW1lb3V0U2Vjb25kcyI6NTk5LCJuZXR3b3JrIjoidGFsZXI6S1VET1MiLCJwYXlUbyI6Imh0dHBzOi8vYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8iLCJzY2hlbWUiOiJleGFjdCJ9LCJwYXlsb2FkIjp7Im9yZGVySWQiOiIyMDI2LjI5My1DWFpER0UxUzNQVzFNIn0sInJlc291cmNlIjp7ImRlc2NyaXB0aW9uIjoiQWNjZXNzIHRvIC9hcGkvcXVvdGUiLCJtaW1lVHlwZSI6ImFwcGxpY2F0aW9uL2pzb24iLCJ1cmwiOiJodHRwczovL2FwaS5leGFtcGxlLmNvbS9hcGkvcXVvdGUifSwieDQwMlZlcnNpb24iOjJ9
~~~

Decoded `PAYMENT-SIGNATURE`:

~~~json
{
  "accepted": {
    "amount": "10000000",
    "asset": "KUDOS",
    "extra": {
      "orderId": "2026.293-CXZDGE1S3PW1M",
      "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-CXZDGE1S3PW1M/"
    },
    "maxTimeoutSeconds": 599,
    "network": "taler:KUDOS",
    "payTo": "https://backend.demo.taler.net/instances/sandbox/",
    "scheme": "exact"
  },
  "payload": {
    "orderId": "2026.293-CXZDGE1S3PW1M"
  },
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
PAYMENT-RESPONSE: eyJhbW91bnQiOiIxMDAwMDAwMCIsIm5ldHdvcmsiOiJ0YWxlcjpLVURPUyIsInN1Y2Nlc3MiOnRydWUsInRyYW5zYWN0aW9uIjoiMjAyNi4yOTMtQ1haREdFMVMzUFcxTSJ9
~~~

Decoded `PAYMENT-RESPONSE`:

~~~json
{
  "amount": "10000000",
  "network": "taler:KUDOS",
  "success": true,
  "transaction": "2026.293-CXZDGE1S3PW1M"
}
~~~

# Open Questions for Reviewers {#open-questions}

This appendix is to be removed before submission. Each question is
also marked where it arises.

| # | Question | Draft's current answer |
|---|----------|------------------------|
| OQ-1 | Unit of `amount`: 10^-8 or the currency's displayed unit? | 10^-8, because only that precision is documented as normative |
| OQ-2 | `currency` case: lowercase or verbatim? | Lowercase, as the charge intent does for ISO 4217 |
| OQ-3 | Should `recipient` (a payto URI) exist at all? | OPTIONAL |
| OQ-4 | Is creating an order "recording the challenge"? | Yes, with mitigations |
| OQ-5 | Browser case: session binding for the fulfillment URL? | Not defined |
| OQ-6 | Refunds of already-delivered content | Out of band; policy of the server |
| OQ-7 | Binding the order to the requesting client without identifying the payer | None defined |
| OQ-8 | IANA contact | Placeholder |
| OQ-9 | x402 `transaction` and `payTo` values | Order id; merchant base URL |

One further point is not a question about the text but about how this
draft relates to existing Taler work. The Taler documentation names
Paivana among the integrations that use the session endpoint
({{TALER-MERCHANT-API}}, "Session IDs"), and the wallet command-line
tool accepts "a taler:// URI or an HTTP(S) Paivana URL". The author has
not studied Paivana and this draft does not describe how it relates to
it. The Taler developers are best placed to say whether a "taler"
method should reuse parts of it.
