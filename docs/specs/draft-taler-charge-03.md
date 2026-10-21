---
title: Taler Charge Intent for HTTP Payment Authentication
abbrev: Taler Charge
docname: draft-taler-charge-03
version: "03"
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
  X402-EXACT:
    title: "x402 Scheme: exact"
    target: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact.md
    author:
      - org: x402 Foundation
  X402-LNBTC:
    title: "x402 Scheme: exact on Bitcoin Lightning (lnbtc)"
    target: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_lnbtc.md
    author:
      - org: x402 Foundation
  BIP122-CAIP2:
    title: "BIP122 Namespace - Chains"
    target: https://namespaces.chainagnostic.org/bip122/caip2
    author:
      - org: Chain Agnostic Standards Alliance
  TALER-LIST:
    title: "Re: [Taler] Taler as a payment method for the HTTP 402 standards (IETF Payment auth and x402)"
    target: https://lists.gnu.org/archive/html/taler/2026-10/msg00008.html
    author:
      - org: taler@gnu.org mailing list
  TALER-LIST-IDENTIFIER:
    title: "Re: [Taler] Taler as a payment method for the HTTP 402 standards (IETF Payment auth and x402)"
    target: https://lists.gnu.org/archive/html/taler/2026-10/msg00011.html
    author:
      - org: taler@gnu.org mailing list
  TALER-LIST-AMOUNT:
    title: "Re: [Taler] Taler as a payment method for the HTTP 402 standards (IETF Payment auth and x402)"
    target: https://lists.gnu.org/archive/html/taler/2026-10/msg00012.html
    author:
      - org: taler@gnu.org mailing list
  TALER-BUG-11886:
    title: "GNUnet bug tracker, issue 11886"
    target: https://bugs.gnunet.org/view.php?id=11886
    author:
      - org: GNUnet bug tracker
  TALER-SIGNATURES-H:
    title: "taler_signatures.h (src/include/taler/taler_signatures.h in the exchange repository)"
    target: https://git.taler.net/taler/exchange/file/src/include/taler/taler_signatures.h.html
    author:
      - org: GNU Taler project
  TALER-MERCHANT-SIGNATURES-C:
    title: "merchant_signatures.c (src/util/merchant_signatures.c in the exchange repository)"
    target: https://git.taler.net/taler/exchange/file/src/util/merchant_signatures.c.html
    author:
      - org: GNU Taler project
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
{{open-questions}}. This is version 03; {{changes}} lists what changed
from version 02.

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

Exchange
: The Taler service that issues coins and holds the funds in escrow
  until they are deposited. A merchant backend is configured with the
  exchanges it trusts; each is described by its base URL (`base_url`),
  the currency it is trusted for and its offline master public key
  (`master_pub`) ({{TALER-MERCHANT-API}}, "Configuration API").

Master Public Key
: The offline public key of an exchange, in the encoding used by Taler,
  52 characters long. The exchange's keys data "must be signed with this
  public key for us to trust it" ({{TALER-MERCHANT-API}}, "Configuration
  API").

Contract Hash
: The hash of the contract terms of an order, called `h_contract` by the
  merchant backend. It "is used to authenticate the wallet/customer"
  ({{TALER-MERCHANT-API}}, "Demonstrating payment").

Taler Amount
: An amount written as `CURRENCY:VALUE[.FRACTION]`, the format of
  {{TALER-COMMON-API}}, "Amounts" ({{amount}}).

Merchant Public Key
: The EdDSA public key of the merchant in the contract terms of an
  order, `merchant_pub`. It verifies the merchant's signatures on that
  order ({{TALER-MERCHANT-API}}, "Contract base terms").

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
| `amount` | string | REQUIRED | Amount in base units of 10^-8 ({{amount}}) |
| `currency` | string | REQUIRED | Taler currency code, lowercase ({{currency}}) |
| `description` | string | OPTIONAL | The order's `summary` |
| `externalId` | string | RECOMMENDED | The Order Identifier |

### Method Details

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `methodDetails.merchantBaseUrl` | string | REQUIRED | Base URL of the merchant instance |
| `methodDetails.exchanges` | array | REQUIRED | The exchanges the merchant accepts for this order ({{exchanges}}) |
| `methodDetails.orderId` | string | REQUIRED | The Order Identifier |
| `methodDetails.talerAmount` | string | REQUIRED | The order amount as a Taler amount, `CURRENCY:VALUE[.FRACTION]` ({{amount}}) |
| `methodDetails.talerPayUri` | string | REQUIRED | The Taler Pay URI of the order, with the Claim Token |

If `externalId` is present it MUST equal `methodDetails.orderId`. As
for every challenge, expiry is conveyed only by the `expires`
auth-param and MUST NOT be repeated in `request`
{{I-D.payment-intent-charge}}.

`methodDetails.orderId` and `methodDetails.merchantBaseUrl` repeat
information that is in `methodDetails.talerPayUri`. They MUST equal the
values derived from it as described in {{pay-uri}}, and a client that
finds a difference MUST NOT pay. `amount` and `methodDetails.talerAmount`
also state one value twice; a client that finds that they differ MUST
NOT pay ({{amount}}).

**Example** (the encoded form is in {{ex-challenge}}):

~~~json
{
  "amount": "10000000",
  "currency": "kudos",
  "description": "Access to /api/quote",
  "externalId": "2026.293-Z2SX6Z5QR12R2",
  "methodDetails": {
    "exchanges": [
      {
        "masterPub": "F80MFRG8HVH6R9CQ47KRFQSJP3T6DBJ4K1D9B703RJY3Z39TBMJ0",
        "url": "https://exchange.demo.taler.net/"
      }
    ],
    "merchantBaseUrl": "https://backend.demo.taler.net/instances/sandbox/",
    "orderId": "2026.293-Z2SX6Z5QR12R2",
    "talerAmount": "KUDOS:0.1",
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

### Exchanges {#exchanges}

`methodDetails.exchanges` is REQUIRED. It is a non-empty array of
objects, one per exchange the merchant accepts for this order:

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | The exchange's base URL (`base_url`) |
| `masterPub` | string | The exchange's Master Public Key (`master_pub`) |

The server takes the list from the merchant backend's configuration,
`GET /config`, whose `exchanges` array describes the "array of exchanges
trusted by the merchant"; each entry has `base_url`, `master_pub` and
the `currency` "for which the merchant is configured to trust the
exchange" ({{TALER-MERCHANT-API}}, "Configuration API"). The list
contains the entries whose currency is the currency of the order. If
there is none, the server MUST NOT issue the order. The contract terms
of the order carry their own list of accepted exchanges, with `url` and
`master_pub` for each ({{TALER-MERCHANT-API}}, "Contract base terms").
The demo backend's `/config` and the contract terms of a paid order both
named the demo exchange with the same master public key (observed).

A client MUST NOT pay with coins from an exchange that is not in the
list.

The currency code alone does not identify a currency. A post on the
Taler mailing list, quoted here, describes a convention: only ISO 4217
currencies use three-letter codes, and "all regional currencies SHOULD
use acronyms with four letters or more, up to eleven". It continues:
"two different exchanges could use the same name and/or acronym for
their regional currency, even if they are not referring to the same
currency", so that "name and acronym are not enough to specify a
regional currency, you also need the exchange baseURL" ({{TALER-LIST}}).
For a currency code of four letters or more, clients therefore MUST
identify the currency by exchange, never by the code alone: money counts
as being in the order's currency only if it was issued by an exchange in
`methodDetails.exchanges`. For a three-letter code the post says that
the code names an ISO 4217 currency, and the list still applies.
`masterPub` identifies an exchange independently of the host that serves
it, and `url` says where to reach it.

**Naming an exchange to a person.** The two identifiers have different
users. A Taler developer, asked which identifier is stable, answered that
"it depends on the use-case": for humans the DNS domain name of the
exchange is what is used; an exchange can be migrated to another domain
name, which needs wallet software updates each time, so the domain is
slightly less stable than the master public key; but cryptographic
material is generally not shown to humans, and the domain is assumed to
be stable in practice ({{TALER-LIST-IDENTIFIER}}). This document follows
that. The Master Public Key is the identifier for software: it is what
the x402 `network` is built from ({{x402-namespace}}). The `url` in the
list is the identifier for people. A client that tells its user which
exchange it will pay with SHOULD show the domain name of `url`, and MUST
NOT show a Master Public Key or an x402 `network` string to the user.

### Amount {#amount}

The charge intent defines `amount` as an integer in base units, the
smallest denomination of the currency, and gives US dollar cents as its
example ({{I-D.payment-intent-charge}}). For Taler, the base unit is
always 10^-8 of the currency, for every Taler currency. The Taler
amount format has a fraction of at most 8 decimal digits
({{TALER-COMMON-API}}, "Amounts"), so 10^-8 is the finest unit any Taler
amount can express and every Taler amount is a whole number of these
units. No currency specification is consulted, and none is needed.

`amount` is the order amount in units of 10^-8, written as a decimal
integer string with no sign, no fraction and no leading zeros; zero is
"0". For example, 1 EUR is "100000000", 0.1 KUDOS is "10000000" and
0.001 KUDOS is "100000".

The unit is not taken from the currency specification because that
specification is a rendering hint. The exchange describes it as how
wallets "should render" the currency ({{TALER-EXCHANGE-API}}, "GET
/keys"), and the merchant backend as a hint that applications "may
ignore" ({{TALER-MERCHANT-API}}, "Configuration API"). A Taler developer
confirmed that taking the base unit from it is not acceptable: the
exchange can offer smaller denominations, the hint can differ between
exchanges for the same currency and between a merchant and an exchange,
and it is advice on how to render amounts, never normative; "if you have
no fractions, you can only use the 10^-8 as the base unit"
({{TALER-LIST-AMOUNT}}). Versions 01 and 02 of this document took the
unit from `num_fractional_input_digits` of the exchange; that rule and its
fallback are removed.

An integer of base units is hard to read for a person and easy to
misread as another unit. The same developer asked for a second field
carrying the amount in Taler's own notation, strictly redundant, because
"it is more clear what the number represents"
({{TALER-LIST-AMOUNT}}). The list post sketched it as `taler_amount`;
this document names it `talerAmount`, as every other field of the
request object is written in camelCase.

**The Taler amount string.** `methodDetails.talerAmount` (and
`extra.talerAmount` in x402, {{x402-requirements}}) is REQUIRED. It is
the order amount as a Taler amount, in the format of the Taler
documentation ({{TALER-COMMON-API}}, "Amounts"):

~~~
CURRENCY:VALUE[.FRACTION]
~~~

- `CURRENCY` is at most 11 ASCII letters, `a-zA-Z`. The documentation
  gives no minimum; the empty code names no currency and is not allowed
  here, as {{RFC8905}} requires `1*ALPHA`.
- `VALUE` is the integer part, at most 2^52.
- `FRACTION` is optional, with at most 8 decimal digits.
- The documentation's valid examples are "EUR:1.50" and "EUR:10"; its
  invalid ones are "A:B:1.5", "EUR:4503599627370501.0", "EUR:1." and
  "EUR:.1".

The syntax follows the Taler documentation, not {{RFC8905}}. RFC 8905
defines the amount of a payto URI as `currency ":" unit [ "." fraction ]`
and agrees on the shape: an alphabetic currency, an optional fraction of
at most 8 decimal digits. It differs in three details: its currency has
no length limit, its `unit` must be smaller than 2^53 (the Taler
documentation says at most 2^52), and it allows commas in `unit` and
`fraction` "for readability", which "MUST be ignored". `talerAmount` has
no commas. The currency code keeps the spelling it has in the order, for
example "KUDOS".

**Checks.** The client MUST check that `amount` and `talerAmount`
describe the same value and the same currency, and MUST NOT pay if they
differ, if `talerAmount` is missing, or if it does not have the syntax
above. The comparison is of exact decimals and uses integer arithmetic,
not floating point: the value of `talerAmount` in units of 10^-8 equals
`amount`, and the currency of `talerAmount` equals `currency` (in x402,
`asset`) without regard to case ({{currency}}). Clients SHOULD also check
that `talerAmount` equals the amount of the contract their wallet shows,
and SHOULD NOT pay if they differ.

The server MUST create the order for exactly `talerAmount` ({{order-creation}}),
and MUST verify the paid contract against it ({{verification}}). If the
order amount has more than 8 fractional digits the server cannot
express it as a Taler amount, and MUST NOT issue the order.

One order has one amount: every format offered for it, and every
exchange in the list, uses the same `amount` and `talerAmount`.

### Currency {#currency}

A Taler currency code consists of at most 11 ASCII letters
({{TALER-COMMON-API}}, "Amounts"), for example "KUDOS", "CHF" or "EUR".
On the wire, in the `currency` field, the code is written in lowercase:
"kudos", "chf", "eur". Implementations MUST compare currency codes
without regard to case, so that "kudos", "KUDOS" and "Kudos" denote the
same currency.

The case-insensitive comparison follows the Taler developers: asked
whether two Taler currencies can differ only by case, the answer on the
mailing list was "No. We defined them specifically as case-insensitive,
see also RFC 8905" ({{TALER-LIST}}). {{RFC8905}} defines the currency of
a payto `amount` option as `1*ALPHA` and requires an ISO 4217 alphabetic
code for three-letter codes; it does not itself state a case rule, so
this document takes the rule from the Taler definition, not from that
RFC. The lowercase spelling follows the
charge intent, which writes ISO 4217 codes in lowercase and allows
other, method-defined formats {{I-D.payment-intent-charge}}. Lowercase
for every code keeps one rule for the method, and generic clients can
treat the field uniformly. The Taler amount in the contract, which the
wallet reads from the merchant backend, and `talerAmount` keep the code
as the backend spells it.

### Obtaining the Order and the Pay URI {#order-creation}

The server creates the order with
`POST [/instances/$INSTANCE]/private/orders`
({{TALER-MERCHANT-API}}, "Creating orders"). It sets at least:

amount
: the order amount as a Taler amount string, equal to
  `methodDetails.talerAmount` ({{amount}}).

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
orders"), or from the public `GET
[/instances/$INSTANCE]/orders/$ORDER_ID` with the claim token as the
`token` parameter ("Querying payment status"). On the demo backend, for
an order with a claim token, both requests return the URI with the `c`
parameter filled in (observed), while the public request without the
`token` parameter is refused with HTTP 403. The server SHOULD NOT
construct the URI: the documentation says that the payment URI "is not
unique for every order: there might be varying parameters such as the
session id" ({{TALER-MERCHANT-API}}, "Creating orders"). The server MUST
copy the URI into `methodDetails.talerPayUri` unchanged.

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
   `merchant_base_url` equal to `methodDetails.merchantBaseUrl`,
   `fulfillment_url` equal to the one the server set (or
   `fulfillment_message`, if that was used), and every exchange in its
   `exchanges` present in `methodDetails.exchanges` (by `url` and
   `master_pub`). The documentation lists these as fields of the
   contract terms ({{TALER-MERCHANT-API}}, "Contract base terms").
6. Apply the refund rule of {{refunds}}.
7. Mark the order as redeemed in the same atomic step that decides to
   grant access ({{replay}}), then answer 200 with a receipt
   ({{receipt}}).

The server MUST NOT grant access if the merchant backend cannot be
reached or answers with an error.

### Response to a Failed Verification {#failure-response}

A failed verification is answered as follows. Nothing is consumed by a
failure: the order stays open for as long as it can be paid.

402 with a fresh challenge
: Every failure except an unreachable merchant backend. The response is
  a 402 as in {{order-creation}}: `WWW-Authenticate: Payment` with a
  new challenge, `Cache-Control: no-store`, and a body of media type
  `application/problem+json` {{RFC9457}} whose `type` is a problem type
  of {{I-D.httpauth-payment}} and whose `status` is 402. The challenge
  offers the same order again if it is still open and can still be paid,
  and a new order otherwise. The same 402 also carries the x402
  requirements for that order ({{x402-mapping}}).

500 without a challenge
: The merchant backend cannot be reached or answers with an error. The
  response is a 500 with the problem type `internal-payment-error`, in
  `application/problem+json`, and no challenge: the failure is the
  server's, and the same credential can be presented again.

The problem type for each cause:

| Cause | Status | Problem type |
|-------|--------|--------------|
| The credential is not base64url-encoded JSON, or has no `challenge` and `payload` objects, or a member of `challenge` is missing | 402 | `malformed-credential` |
| The echoed challenge is not one this server issued: unknown `method`, `intent` or `realm`, a `header` parameter, a binding that does not verify, or no `orderId` in the request | 402 | `invalid-challenge` |
| The order is unknown, was issued for another resource, or has already been redeemed | 402 | `invalid-challenge` |
| The challenge `expires`, or the order's pay deadline, has passed | 402 | `payment-expired` |
| `payload.orderId` differs from the order of the challenge | 402 | `invalid-payload` |
| The order is not paid, the paid contract does not match ({{verification}}, step 5), or the order was refunded in full | 402 | `verification-failed` |
| The merchant backend cannot be reached, or answers with an error | 500 | `internal-payment-error` |

The x402 side has its own failure responses ({{x402-failure}}).

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

**One order, both formats.** When one order is offered in both formats,
that is, when one 402 response carries the IETF challenge and the x402
requirements for the same order, the single-use record is per order and
is shared by both formats. A proof accepted in one format is rejected in
the other. Each format has a consumption key, and both keys are entries
of the one record of the order:

| Format | Consumption key |
|--------|-----------------|
| IETF Payment | `ietf` + ":" + orderId |
| x402 | network + ":" + orderId, with `network` the `taler` network of the accepted requirement ({{x402-requirements-family}}) |

The `ietf` prefix cannot be taken for a network, which starts with
`taler:`. Inserting either key marks the order redeemed, in one atomic
step, and the insert fails if the order is already redeemed, whether by
the same key, by the key of the other format, or by the key of another
network of the same order. The second presentation is answered with the
error of its own format: `invalid-challenge` for the IETF credential
({{failure-response}}), `duplicate_settlement` for the x402 payload
({{x402-errors}}). A server that offers both formats therefore keeps the
record itself; a facilitator that settles only the x402 payloads sees
only the x402 keys ({{x402-facilitators}}).

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
default, in the backend, and per order, in the order. After the deadline
"no refunds will be accepted" ({{TALER-MERCHANT-API}}, "Orders"). A
`refund_deadline` of 0 lies in the past, so by that sentence an order
with that value accepts no refund (not tested). The demo instance's
contract terms for orders created without an explicit deadline showed
`{"t_s": 0}` (observed); the documentation neither explains that default
nor gives the value 0 a special meaning beyond being in the past.

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
Taler Pay URI, and the exchanges whose money it accepts in
`methodDetails.exchanges`. A malicious server could name a merchant
other than the one that provides the resource, or list an exchange whose
currency of the same name is not the one the client expects
({{exchanges}}). Clients MUST pay only with money from the listed
exchanges, and SHOULD check that these are exchanges they trust. Clients
SHOULD check that the merchant is acceptable to them before paying, for
example by comparing the merchant named in the contract that the wallet
displays, and wallets already show that merchant to their user.

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

The challenge states the amount twice, as an integer of base units and as
a Taler amount ({{amount}}). The integer alone is easy to read in the
wrong unit, by a factor of a million for 10^-8 against the cent. A
client that pays on the integer without checking it against the Taler
amount, or the reverse, can be made to pay more than it understood, so the
check of {{amount}} is a MUST.

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
    request="eyJhbW91bnQiOiIxMDAwMDAwMCIsImN1cnJlbmN5Ijoia3Vkb3MiLCJkZXNjcmlwdGlvbiI6IkFjY2VzcyB0byAvYXBpL3F1b3RlIiwiZXh0ZXJuYWxJZCI6IjIwMjYuMjkzLVoyU1g2WjVRUjEyUjIiLCJtZXRob2REZXRhaWxzIjp7ImV4Y2hhbmdlcyI6W3sibWFzdGVyUHViIjoiRjgwTUZSRzhIVkg2UjlDUTQ3S1JGUVNKUDNUNkRCSjRLMUQ5QjcwM1JKWTNaMzlUQk1KMCIsInVybCI6Imh0dHBzOi8vZXhjaGFuZ2UuZGVtby50YWxlci5uZXQvIn1dLCJtZXJjaGFudEJhc2VVcmwiOiJodHRwczovL2JhY2tlbmQuZGVtby50YWxlci5uZXQvaW5zdGFuY2VzL3NhbmRib3gvIiwib3JkZXJJZCI6IjIwMjYuMjkzLVoyU1g2WjVRUjEyUjIiLCJ0YWxlckFtb3VudCI6IktVRE9TOjAuMSIsInRhbGVyUGF5VXJpIjoidGFsZXI6Ly9wYXkvYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8yMDI2LjI5My1aMlNYNlo1UVIxMlIyLz9jPUgzUVo4TVhLMlY5VFJXNU5CN0RZQzRGNkpBIn19"
~~~

Decoded `request`:

~~~json
{
  "amount": "10000000",
  "currency": "kudos",
  "description": "Access to /api/quote",
  "externalId": "2026.293-Z2SX6Z5QR12R2",
  "methodDetails": {
    "exchanges": [
      {
        "masterPub": "F80MFRG8HVH6R9CQ47KRFQSJP3T6DBJ4K1D9B703RJY3Z39TBMJ0",
        "url": "https://exchange.demo.taler.net/"
      }
    ],
    "merchantBaseUrl": "https://backend.demo.taler.net/instances/sandbox/",
    "orderId": "2026.293-Z2SX6Z5QR12R2",
    "talerAmount": "KUDOS:0.1",
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
Authorization: Payment eyJjaGFsbGVuZ2UiOnsiZXhwaXJlcyI6IjIwMjYtMTAtMjBUMTM6MTU6NTlaIiwiaWQiOiJ4OVFtMkxyVDd2TmJLNGNXeVAzaFNhIiwiaW50ZW50IjoiY2hhcmdlIiwibWV0aG9kIjoidGFsZXIiLCJyZWFsbSI6ImFwaS5leGFtcGxlLmNvbSIsInJlcXVlc3QiOiJleUpoYlc5MWJuUWlPaUl4TURBd01EQXdNQ0lzSW1OMWNuSmxibU41SWpvaWEzVmtiM01pTENKa1pYTmpjbWx3ZEdsdmJpSTZJa0ZqWTJWemN5QjBieUF2WVhCcEwzRjFiM1JsSWl3aVpYaDBaWEp1WVd4SlpDSTZJakl3TWpZdU1qa3pMVm95VTFnMldqVlJVakV5VWpJaUxDSnRaWFJvYjJSRVpYUmhhV3h6SWpwN0ltVjRZMmhoYm1kbGN5STZXM3NpYldGemRHVnlVSFZpSWpvaVJqZ3dUVVpTUnpoSVZrZzJVamxEVVRRM1MxSkdVVk5LVUROVU5rUkNTalJMTVVRNVFqY3dNMUpLV1ROYU16bFVRazFLTUNJc0luVnliQ0k2SW1oMGRIQnpPaTh2WlhoamFHRnVaMlV1WkdWdGJ5NTBZV3hsY2k1dVpYUXZJbjFkTENKdFpYSmphR0Z1ZEVKaGMyVlZjbXdpT2lKb2RIUndjem92TDJKaFkydGxibVF1WkdWdGJ5NTBZV3hsY2k1dVpYUXZhVzV6ZEdGdVkyVnpMM05oYm1SaWIzZ3ZJaXdpYjNKa1pYSkpaQ0k2SWpJd01qWXVNamt6TFZveVUxZzJXalZSVWpFeVVqSWlMQ0owWVd4bGNrRnRiM1Z1ZENJNklrdFZSRTlUT2pBdU1TSXNJblJoYkdWeVVHRjVWWEpwSWpvaWRHRnNaWEk2THk5d1lYa3ZZbUZqYTJWdVpDNWtaVzF2TG5SaGJHVnlMbTVsZEM5cGJuTjBZVzVqWlhNdmMyRnVaR0p2ZUM4eU1ESTJMakk1TXkxYU1sTllObG8xVVZJeE1sSXlMejlqUFVnelVWbzRUVmhMTWxZNVZGSlhOVTVDTjBSWlF6UkdOa3BCSW4xOSJ9LCJwYXlsb2FkIjp7Im9yZGVySWQiOiIyMDI2LjI5My1aMlNYNlo1UVIxMlIyIn19
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
    "request": "eyJhbW91bnQiOiIxMDAwMDAwMCIsImN1cnJlbmN5Ijoia3Vkb3MiLCJkZXNjcmlwdGlvbiI6IkFjY2VzcyB0byAvYXBpL3F1b3RlIiwiZXh0ZXJuYWxJZCI6IjIwMjYuMjkzLVoyU1g2WjVRUjEyUjIiLCJtZXRob2REZXRhaWxzIjp7ImV4Y2hhbmdlcyI6W3sibWFzdGVyUHViIjoiRjgwTUZSRzhIVkg2UjlDUTQ3S1JGUVNKUDNUNkRCSjRLMUQ5QjcwM1JKWTNaMzlUQk1KMCIsInVybCI6Imh0dHBzOi8vZXhjaGFuZ2UuZGVtby50YWxlci5uZXQvIn1dLCJtZXJjaGFudEJhc2VVcmwiOiJodHRwczovL2JhY2tlbmQuZGVtby50YWxlci5uZXQvaW5zdGFuY2VzL3NhbmRib3gvIiwib3JkZXJJZCI6IjIwMjYuMjkzLVoyU1g2WjVRUjEyUjIiLCJ0YWxlckFtb3VudCI6IktVRE9TOjAuMSIsInRhbGVyUGF5VXJpIjoidGFsZXI6Ly9wYXkvYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8yMDI2LjI5My1aMlNYNlo1UVIxMlIyLz9jPUgzUVo4TVhLMlY5VFJXNU5CN0RZQzRGNkpBIn19"
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

This appendix defines how the method is offered through x402 version 2
{{X402}} over the HTTP transport {{X402-HTTP}}. It is normative for
servers and facilitators that offer or settle the method through x402;
the Payment scheme format in the main body does not depend on it. The
flow is the same as in the main body: the server creates an order,
answers 402 with the order in `PAYMENT-REQUIRED`, the client pays with a
Taler wallet and retries with `PAYMENT-SIGNATURE`, and the server (or a
facilitator) settles and answers with `PAYMENT-RESPONSE`. A server MAY
offer the IETF challenge and the x402 requirements in the same 402
response; they MUST refer to the same order.

The order identifier and the merchant base URL are taken from the Taler
Pay URI as described in {{pay-uri}}, so the requirement does not repeat
them.

## Scheme, Family and Payment Flow {#x402-family}

The method is a mechanism of the `exact` scheme {{X402-EXACT}}, in the
family called "Client-submitted (payment proof)": the client submits the
payment itself, with its wallet, and presents a proof of it; settle
validates the proof and binds it to the request. The `exact` scheme
document says that methods in this family "MUST use `upfront`", because
the payment is already submitted when the payload is presented
({{X402-EXACT}}, "Asset Transfer Method Families"). Hence:

- `scheme` MUST be `"exact"`.
- The only payment flow is `upfront` (settle, then resource, then
  respond; `/verify` is not part of this ordering). The x402
  specification requires `accepts[].extra.paymentFlow` to be present
  whenever the resolved flow is not `authorization`
  ({{X402}}, "Asset Transfer Methods and Payment Flow Models"), so
  `extra.paymentFlow` MUST be `"upfront"` in every requirement. Clients
  and servers MUST reject any other value, and the server MUST NOT call
  `/verify` for this method.
- No asset transfer method is defined, and `extra.assetTransferMethod`
  MUST be omitted.

Under `upfront` the payment commits before the resource handler runs, so
a handler failure leaves the client charged. The `exact` scheme document
says that it "defines no refund, and any remedy is the resource server's
own arrangement" ({{X402-EXACT}}, "Payment Flow");
{{x402-requirements-family}} gives this method's arrangement.

## The `taler` Namespace {#x402-namespace}

This document defines the namespace `taler` in CAIP-2 format {{CAIP-2}},
as the Lightning mechanism of `exact` defines the namespace `lnbtc` in
its own document {{X402-LNBTC}}. A `taler` network identifies one
exchange. Its reference MUST be the first 32 characters of the
exchange's Master Public Key, as the merchant backend publishes it in
`GET /config` (`master_pub`) and the exchange in its keys response
(`master_public_key`, "EdDSA master public key of the exchange")
({{TALER-MERCHANT-API}}, "Configuration API"; {{TALER-EXCHANGE-API}},
"GET /keys").

The reasoning follows the BIP-122 profile of CAIP-2, which writes its
chain identifier as "a 32-character prefix from the hash of the genesis
block" ({{BIP122-CAIP2}}). A CAIP-2 reference allows at most 32
characters of letters, digits, "-" and "_" {{CAIP-2}}, and a Master
Public Key has 52 characters. A prefix of 32 characters is 160 bits of
the key's base32 encoding. For the demo exchange the network is
`taler:F80MFRG8HVH6R9CQ47KRFQSJP3T6DBJ4` (observed: both the demo merchant
backend and the demo exchange publish the key
`F80MFRG8HVH6R9CQ47KRFQSJP3T6DBJ4K1D9B703RJY3Z39TBMJ0`). The namespace
is defined here for use in x402; this document does not register it
anywhere else.

The network is the machine identifier of an exchange, and the Master
Public Key is the more stable one: a Taler developer answered that an
exchange can be migrated to another domain name, which needs wallet
software updates each time, so the domain is slightly less stable than the
key ({{TALER-LIST-IDENTIFIER}}). The network string is cryptographic
material, which Taler software does not show to people, so a client
MUST NOT show it to its user. The identifier for people is the domain of
the exchange's `url` in the list of {{exchanges}}, which a client
SHOULD show instead.

An x402 requirement carries only the network. A client can map it to the
domain where it knows the exchange list of the same order, for example
from the IETF challenge in the same 402 response (the network of a listed
exchange is `taler:` and the first 32 characters of its `masterPub`). A
client that knows no domain for a network MUST NOT show the network
string in its place. See OQ-13 ({{open-questions}}).

## Payment Requirements {#x402-requirements}

A merchant that accepts several exchanges for the order
({{exchanges}}) lists one `accepts[]` entry per exchange. All entries
refer to the same order: they differ only in `network`.

| x402 field | Value for Taler |
|------------|-----------------|
| `scheme` | `exact` |
| `network` | `taler:` followed by the first 32 characters of the exchange's Master Public Key ({{x402-namespace}}) |
| `amount` | As `amount` in {{amount}}, the same in every entry |
| `asset` | The Taler currency code verbatim, for example `KUDOS` |
| `payTo` | The merchant base URL derived from the Taler Pay URI ({{pay-uri}}) |
| `maxTimeoutSeconds` | Seconds until the order's pay deadline |
| `extra.paymentFlow` | `"upfront"` |
| `extra.talerAmount` | REQUIRED. The order amount as a Taler amount ({{amount}}), the same in every entry |
| `extra.talerPayUri` | The Taler Pay URI, with the Claim Token, the same in every entry |

The client MUST check `amount`, `asset` and `extra.talerAmount` against
each other as {{amount}} requires, before it pays. Settle compares
`accepted` with the requirements the server issued, and `extra` is part of
that comparison, so a changed `talerAmount` is a mismatch.

The payment instrument that the client must satisfy is the order named
by `extra.talerPayUri`, and its validity window is `maxTimeoutSeconds`,
as the family requires ({{X402-EXACT}}, "Instrument and proof").

## Payload and Settle {#x402-settle}

The `payload` of the `PaymentPayload` carries the proof:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderId` | string | REQUIRED | The Order Identifier; MUST equal the identifier derived from `accepted.extra.talerPayUri` ({{pay-uri}}) |
| `hContract` | string | REQUIRED | The Contract Hash of the order, as a Taler hash code |
| `merchantSig` | string | OPTIONAL | The merchant's signature that the order was paid ({{merchant-sig}}), 64 bytes in Crockford Base32, 103 characters |

A Taler hash code is the Crockford Base32 encoding of a 64-byte hash
({{TALER-COMMON-API}}, "Hash codes"); the contract hash in the demo
backend is 103 characters long (observed). The client takes `hContract`
from its wallet after paying. In the wallet-core version tested
(`taler-wallet-cli` 1.6.46), the call that pays returns the contract
terms and a transaction identifier, and the payment transaction record
contains `info.contractTermsHash` next to `orderId` (observed).

Settle, done by the resource server or by a facilitator, treats the
payload and the echoed requirements as untrusted and performs these
checks in order before it records the payment:

1. `accepted` equals the requirements the server issued for this
   request, except for `maxTimeoutSeconds`, which changes with time.
   `network` is a `taler` network whose reference is the 32-character
   prefix of the Master Public Key of an exchange in the order's list.
   `extra.paymentFlow` is `"upfront"`.
2. `payload.orderId` equals the identifier derived from
   `accepted.extra.talerPayUri`, and `payload.hContract` is a Taler
   hash code.
3. The order's pay deadline has not passed. A facilitator cannot
   compute the deadline from the relative `maxTimeoutSeconds`; the
   resource server MUST NOT submit a settle for an order whose pay
   deadline has passed, and otherwise fails with
   `invalid_exact_taler_order_expired`.
4. If `payload.merchantSig` is present, it verifies against the Merchant
   Public Key of the order ({{merchant-sig}}). If it does not, fail with
   `invalid_exact_taler_merchant_sig`. A payload with a `merchantSig` that
   does not verify is never treated as one without.
5. The merchant backend reports the order as paid. Settle sends the
   public request
   `GET [/instances/$INSTANCE]/orders/$ORDER_ID?h_contract=$H_CONTRACT`
   to the merchant base URL, which needs no merchant credential
   ({{TALER-MERCHANT-API}}, "Querying payment status": "unauthenticated
   way to query the order status"). The answers are:
   - 200, a paid-status response: the order is paid. Continue.
   - 402, an unpaid-status response: the order is not paid. Fail with
     `invalid_exact_taler_order_unpaid`.
   - 403: `h_contract` does not match the order. Fail with
     `invalid_exact_taler_h_contract_mismatch`.
   - 404: the order is unknown. Fail with
     `invalid_exact_taler_order_unknown`.
   - Any other answer, or no answer: fail with
     `invalid_exact_taler_backend_error`. Settle fails closed.
   All four answers were observed on the demo backend, for a paid
   order with the right hash (200), a claimed but unpaid order with its
   hash (402), a wrong hash (403), and a purged order (404). When step 4
   verified a `merchantSig`, settle MAY skip this step, but only under
   the condition of {{merchant-sig}}; otherwise it MUST NOT.
6. Atomically record the consumption key ({{x402-requirements-family}}).
   If it already exists, or the order is already redeemed in either
   format ({{replay}}), fail with `duplicate_settlement`.

Steps 4 and 5 may be done in either order.

Only after step 6 succeeds does the resource server run the handler.

On success, `SettlementResponse.success` is true, `transaction` is the
Order Identifier, `network` is the network of the accepted requirement
and `amount` is the order amount. `payer` MUST be omitted: Taler does
not reveal the payer ({{privacy}}). x402 defines `transaction` as a
blockchain transaction hash {{X402-HTTP}}; Taler has none, and the
identifier of the payment is the order identifier.

The public request is checked with the hash the client presented, so,
where the backend enforces the hash, the answer shows that whoever
presented it knew the contract hash of the claimed order. The status response carries the fulfillment URL and
the refund status, not the amount and not the merchant's other contract
fields ({{TALER-MERCHANT-API}}, "Querying payment status"). A settle
that has only the public status therefore cannot check the amount; that
is guaranteed by the server creating the order with the amount of the
requirement, and a server or facilitator with private access SHOULD
compare `contract_terms.amount` as in {{verification}} as well.

The documentation says `h_contract` is "required once an order was
claimed" ({{TALER-MERCHANT-API}}, "Querying payment status"), and the
demo backend answered a request for a claimed and paid order without
`h_contract` with the same 200 as with it (observed). That was reported to
the Taler developers, who filed it as bug 11886 ({{TALER-BUG-11886}},
{{TALER-LIST-IDENTIFIER}}). This method does not rely on the behaviour
either way. Settle always sends the `hContract` the client presented and
accepts only a 200 as "paid". Where the backend enforces the hash, a wrong
hash is answered with 403; where it does not, the answer is the one the
IETF format gets, which carries no hash.

## Merchant Payment Signature {#merchant-sig}

When a wallet pays, the merchant answers with a signature that the order
was paid. The payment signature is a signature on `TALER_PaymentResponsePS`
with the merchant instance's key, a structure that holds only the contract
hash ({{TALER-COMMON-API}}, "Signatures"), and `POST
[/instances/$INSTANCE]/orders/$ORDER_ID/paid` takes it with `h_contract` so
that the merchant can verify it "before checking with its own database"
({{TALER-MERCHANT-API}}, "Demonstrating payment"). It is a proof the
family prefers: it removes a liveness and trust dependency from settle
({{X402-EXACT}}, "Client-submitted (payment proof)"). The Taler developers
said that wallet-core could return it to the application, that long-term
plans exist to export and validate such a proof externally, and that it is
"totally fine" to put it into protocols and to give it to non-human agents
({{TALER-LIST-IDENTIFIER}}).

The payload field `merchantSig` is OPTIONAL. A client that has the
signature MAY send it; a client that does not, omits the field and settle
uses the path of {{x402-settle}} without step 4.

**What is signed.** The signed data is `struct TALER_PaymentResponsePS`,
declared in {{TALER-MERCHANT-SIGNATURES-C}} with two members: `purpose`
(a `GNUNET_CRYPTO_SignaturePurpose`) and `h_contract_terms` (a
`TALER_PrivateContractHashP`, a 64-byte hash). The same file signs it
with `purpose.purpose` set to `TALER_SIGNATURE_MERCHANT_PAYMENT_OK`, the
size to the size of the structure, both with `htonl`, and verifies it
with the same structure. The constant is defined in
{{TALER-SIGNATURES-H}} as 1104, with the comment that the merchant
confirms with it that the payment was successful. The documentation
gives the framing of every signed structure: a purpose header of the
`size` (the number of bytes being signed) and the `purpose`, followed by
the members in order ({{TALER-COMMON-API}}, "Signatures"). The bytes are
therefore:

| Offset | Bytes | Member | Value |
|--------|-------|--------|-------|
| 0 | 4 | `size` | 72, as a big-endian unsigned integer (`00000048`) |
| 4 | 4 | `purpose` | 1104, big-endian (`00000450`) |
| 8 | 64 | `h_contract_terms` | `hContract`, decoded from Crockford Base32 |

`merchantSig` is an EdDSA signature of 64 bytes ({{TALER-COMMON-API}},
"Signatures") over these 72 bytes, in Crockford Base32 (103 characters,
the last 3 bits zero). The Merchant Public Key is 32 bytes, 52 characters.
That the signing code passes exactly this structure to the EdDSA function
follows the documentation and the source of the structure; the code of
GNUnet itself was not read. It is confirmed by observation: the test
vector of {{merchant-sig-vector}} is a signature that a merchant
backend made for a real payment, and it verifies as Ed25519 over these 72
bytes (observed, with Node.js and with OpenSSL), and fails when one bit of
the message, the key or the signature is changed. Four more real
signatures from the same wallet verified the same way (observed).

**Whose key.** The Merchant Public Key is `merchant_pub` of the contract
terms of the order: "Merchant's public key used to sign this proposal;
this information is typically added by the backend. Note that this can
be an ephemeral key" ({{TALER-MERCHANT-API}}, "Contract base terms").
Settle takes it from the contract terms that it reads from the merchant
backend, never from the client. A facilitator without access to the
merchant instance has to be given the key by the resource server.

**Rules.** When `payload.merchantSig` is present, settle MUST verify it
against the Merchant Public Key of the order and the `hContract` of the
payload, and MUST fail with `invalid_exact_taler_merchant_sig` if it is
not a signature of the right form that verifies. When it verifies, settle
MAY skip the public status request of {{x402-settle}}, step 5, only if it
knows from a source it trusts that `hContract` is the contract hash of
this order. The reason is in the structure: the signature covers the
contract hash and nothing else, not the order identifier. A valid signature
shows that the merchant confirmed the payment of some contract with that
hash; a signature for another, paid contract of the same merchant verifies
just the same. Without the hash of this order, only the public request
ties `hContract` to the order, since it answers 403 for a hash that does
not match. A facilitator, which has no access to the merchant instance,
does not know the hash of the order and MUST NOT skip the request. How a
server learns the hash of the contract of its own order is not settled
here (OQ-14): the documented responses of the private order status
return the contract terms but no contract hash ({{TALER-MERCHANT-API}},
"Inspecting orders"), and computing the hash from the contract terms is a
definition of Taler that this document does not repeat. Whatever settle
skips, the refund rule of {{refunds}} still applies and needs the order
status.

**OPEN QUESTION (OQ-11):** wallet-core does not return the signature to
the paying application today. In the version tested (`taler-wallet-cli`
1.6.46) the call that pays returns the contract terms and a transaction
identifier, and the payment transaction record has no signature (observed).
The wallet's own database holds the signature of every paid purchase as
`merchant_pay_sig` (observed), but a database layout is not an interface.
So no application can send `merchantSig` through the wallet's interface
today. The Taler developers said it could ({{TALER-LIST-IDENTIFIER}});
until a wallet does, the field is OPTIONAL and the public status request
is the default. The question for the developers is which interface will
return it, and whether the proof would come with the merchant public key.

## Requirements of the Client-Submitted Family {#x402-requirements-family}

The `exact` scheme document lists what a method in this family has to
define ({{X402-EXACT}}, "Client-submitted (payment proof)"). For this
method:

**Instrument and proof.** The instrument is the order and its Claim
Token, advertised in `extra.talerPayUri` with its validity window in
`maxTimeoutSeconds` ({{x402-requirements}}); the proof is in the
payload ({{x402-settle}}). The family prefers a self-verifying proof,
for it can "remove a liveness and trust dependency from settle". The
merchant's payment signature is one ({{merchant-sig}}), and the payload
may carry it. Because wallets do not hand it to applications today
(OQ-11), the default proof check is the public order status, and settle
then depends on the merchant backend being reachable. The `/paid`
request also requires a non-empty session identifier.

**Request binding.** A proof shows that a payment happened, not that it
was made for this request. The server creates a fresh order with its own
Claim Token for every request ({{binding}}). That order is "an
instrument unique to this request", one of the ways the family allows to
bind a payment to a request: a payment for it cannot be presented for
another request, and the settling party needs no store beyond its own.

**Single-use claim.** The record is per order and shared by both
formats ({{replay}}). The canonical consumption key of this format is the
ASCII string

~~~
network + ":" + orderId
~~~

with `network` the concrete `taler` network of the accepted requirement
and `orderId` the Order Identifier, joined by one colon. Settle MUST
insert the key atomically into a restart-durable store, MUST fail if it
already exists or if the order is already redeemed in either format, and
the handler MUST NOT run before the insert has succeeded. Of two concurrent presentations exactly one succeeds. The
order identifier is unique only within a merchant instance
({{TALER-MERCHANT-API}}, "Contract base terms"), and the network names
the exchange rather than the merchant, so a store that serves several
merchant instances SHOULD prefix the key with the merchant base URL.

**Retention bound.** A proof is presentable until the order's pay
deadline ({{x402-settle}}, step 3), which bounds its age. The record of
a consumed key MUST be kept until the later of the pay deadline and the
refund deadline of the order. Both are absolute times in the contract
terms ({{TALER-MERCHANT-API}}, "Contract base terms").

**Amount acceptance.** The amount follows the semantics of `exact`: the
client does not choose it. The contract fixes the amount, and the wallet
pays the amount of the contract (observed: three payments of the order
amount `KUDOS:0.1` reduced the wallet balance from 10 to 9.7, and the
merchant reported each order as paid). A payment that does not complete
the contract leaves the order unpaid, and settle then fails with
`invalid_exact_taler_order_unpaid`; there is no underpayment or
overpayment for settle to accept or to return.

**Finality.** The payment is final from the resource server's point of
view when the merchant backend reports the order as paid. The later wire
transfer to the merchant's bank account, which the backend reports as
`wired`, is not the finality boundary ({{settlement}}). The merchant
API has no confirmation depth to set: it reports an order as unpaid,
claimed or paid ({{TALER-MERCHANT-API}}, "Inspecting orders"). Until the
order is paid, but while it can still be paid, settle MUST NOT record
the key and MUST NOT run the handler, and MUST return
`invalid_exact_taler_order_unpaid`. Because the key is recorded only
after the check succeeds ({{x402-settle}}, step 6), settle holds no
claim while it waits on the merchant backend, and a settle that ends
abnormally leaves nothing claimed.

**Failure disposition.** If the order expires unpaid, the payer has paid
nothing. If a payment is in progress in the wallet at the deadline, the
wallet can abort it and recover the coins already spent: "aborts do not
require approval by the merchant because aborts always are for
incomplete payments for an order and never for established contracts"
({{TALER-MERCHANT-API}}, "Aborting incomplete payments"). Once the order
is paid, a return of the money is a refund granted by the merchant
within the refund deadline ({{refunds}}). A server that cannot deliver
for a paid order, for example because the proof was presented after the
pay deadline, SHOULD refund it where the refund deadline allows. Clients
MUST NOT assume that a return path exists.

## Settlement Errors {#x402-errors}

Facilitators and servers use these `errorReason` strings, in the style
of {{X402-LNBTC}}. The strings are proposed by this document.

| Reason | Meaning |
|--------|---------|
| `invalid_exact_taler_payment_flow` | `extra.paymentFlow` is missing or not `upfront`, on either side. |
| `invalid_exact_taler_network` | `network` is not a `taler` network of an exchange in the order's list, or differs from the requirement. |
| `invalid_exact_taler_order_mismatch` | `accepted` differs from the requirement, or `payload.orderId` differs from the identifier derived from the Taler Pay URI. |
| `invalid_exact_taler_h_contract_malformed` | `payload.hContract` is missing or not a Taler hash code. |
| `invalid_exact_taler_order_expired` | The pay deadline has passed. |
| `invalid_exact_taler_order_unpaid` | The merchant backend reports the order as unpaid; it may still be paid. |
| `invalid_exact_taler_h_contract_mismatch` | The merchant backend answered 403 for the presented hash. |
| `invalid_exact_taler_merchant_sig` | `payload.merchantSig` is present and is not a signature of the right form that verifies against the Merchant Public Key of the order ({{merchant-sig}}). |
| `invalid_exact_taler_order_unknown` | The merchant backend does not know the order. |
| `invalid_exact_taler_backend_error` | The merchant backend could not be asked, or answered with an error. |
| `duplicate_settlement` | The consumption key is already used, or settle lost an atomic race. |

### Settlement Failure Response {#x402-failure}

The x402 HTTP transport maps its errors to status codes: an invalid
payment, "malformed payment payload or requirements", to 400; a payment
whose verification or settlement failed to 402; an internal error to 500
({{X402-HTTP}}, "Error Handling"). It shows a failed settlement as a 402
with a `PAYMENT-RESPONSE` header whose `success` is false and whose
`errorReason` says why ({{X402-HTTP}}, "Settlement Response Delivery").
This document specifies:

402 with `PAYMENT-RESPONSE`
: Every failure with a reason from {{x402-errors}} except
  `invalid_exact_taler_backend_error`. `PAYMENT-RESPONSE` is the base64
  of the JCS serialization of a `SettlementResponse` with `success`
  false, `errorReason` the reason, `transaction` the empty string, and
  `network` the network of the accepted requirement (or, where none can
  be read, of the first requirement offered). `PAYMENT-REQUIRED` carries
  fresh requirements, for the same order if it can still be paid and for
  a new one otherwise, with `error` set to the reason. The body, which the
  transport leaves to the server, SHOULD be `application/problem+json`
  with a `reason` member holding the same string.

500 with `PAYMENT-RESPONSE`
: The merchant backend cannot be reached or answers with an error:
  `invalid_exact_taler_backend_error`. The `PAYMENT-RESPONSE` is as
  above, with no new requirements. Nothing is consumed, so the same
  payload can be presented again.

400 without `PAYMENT-RESPONSE`
: The `PAYMENT-SIGNATURE` header is not a `PaymentPayload`: it is not
  base64-encoded JSON, its `x402Version` is not 2, or it has no
  `accepted` and `payload` objects. Nothing was settled, so there is
  nothing to answer with a `SettlementResponse`.

The IETF format answers its failures as in {{failure-response}}.

## Facilitators {#x402-facilitators}

This paragraph is informative. Settle needs only the public order
status, which requires no merchant credential, so a facilitator can
settle without any access to the merchant instance, and the method works
with a facilitator as well as with a resource server that settles
against its own merchant backend. The x402 specification allows both:
for client-prepaid methods, settle "MAY bind a payment proof to the
request ... after read-only observation of ledger or backend state"
({{X402}}, "POST /settle"). A facilitator keeps its own store of
consumption keys, which covers the payloads it settles; a server that
also accepts the IETF format keeps the per-order record itself
({{replay}}). The binding of the order to the request means that it
needs no store shared with other facilitators ({{X402-EXACT}}).

## x402 Examples {#x402-examples}

The merchant accepts one exchange. `PAYMENT-REQUIRED` (the header value
is standard base64 of the JCS serialization of the JSON shown):

~~~http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJhY2NlcHRzIjpbeyJhbW91bnQiOiIxMDAwMDAwMCIsImFzc2V0IjoiS1VET1MiLCJleHRyYSI6eyJwYXltZW50RmxvdyI6InVwZnJvbnQiLCJ0YWxlckFtb3VudCI6IktVRE9TOjAuMSIsInRhbGVyUGF5VXJpIjoidGFsZXI6Ly9wYXkvYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8yMDI2LjI5My1DWFpER0UxUzNQVzFNLz9jPVA2V04yWFQ4S1E0WUI5WkQzVk1DN1JIRjVFIn0sIm1heFRpbWVvdXRTZWNvbmRzIjo1OTksIm5ldHdvcmsiOiJ0YWxlcjpGODBNRlJHOEhWSDZSOUNRNDdLUkZRU0pQM1Q2REJKNCIsInBheVRvIjoiaHR0cHM6Ly9iYWNrZW5kLmRlbW8udGFsZXIubmV0L2luc3RhbmNlcy9zYW5kYm94LyIsInNjaGVtZSI6ImV4YWN0In1dLCJlcnJvciI6IlBBWU1FTlQtU0lHTkFUVVJFIGhlYWRlciBpcyByZXF1aXJlZCIsInJlc291cmNlIjp7ImRlc2NyaXB0aW9uIjoiQWNjZXNzIHRvIC9hcGkvcXVvdGUiLCJtaW1lVHlwZSI6ImFwcGxpY2F0aW9uL2pzb24iLCJ1cmwiOiJodHRwczovL2FwaS5leGFtcGxlLmNvbS9hcGkvcXVvdGUifSwieDQwMlZlcnNpb24iOjJ9
~~~

Decoded `PAYMENT-REQUIRED`:

~~~json
{
  "accepts": [
    {
      "amount": "10000000",
      "asset": "KUDOS",
      "extra": {
        "paymentFlow": "upfront",
        "talerAmount": "KUDOS:0.1",
        "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-CXZDGE1S3PW1M/?c=P6WN2XT8KQ4YB9ZD3VMC7RHF5E"
      },
      "maxTimeoutSeconds": 599,
      "network": "taler:F80MFRG8HVH6R9CQ47KRFQSJP3T6DBJ4",
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

After paying, the client retries with the contract hash that its wallet
holds for the order:

~~~http
GET /api/quote HTTP/1.1
Host: api.example.com
PAYMENT-SIGNATURE: eyJhY2NlcHRlZCI6eyJhbW91bnQiOiIxMDAwMDAwMCIsImFzc2V0IjoiS1VET1MiLCJleHRyYSI6eyJwYXltZW50RmxvdyI6InVwZnJvbnQiLCJ0YWxlckFtb3VudCI6IktVRE9TOjAuMSIsInRhbGVyUGF5VXJpIjoidGFsZXI6Ly9wYXkvYmFja2VuZC5kZW1vLnRhbGVyLm5ldC9pbnN0YW5jZXMvc2FuZGJveC8yMDI2LjI5My1DWFpER0UxUzNQVzFNLz9jPVA2V04yWFQ4S1E0WUI5WkQzVk1DN1JIRjVFIn0sIm1heFRpbWVvdXRTZWNvbmRzIjo1OTksIm5ldHdvcmsiOiJ0YWxlcjpGODBNRlJHOEhWSDZSOUNRNDdLUkZRU0pQM1Q2REJKNCIsInBheVRvIjoiaHR0cHM6Ly9iYWNrZW5kLmRlbW8udGFsZXIubmV0L2luc3RhbmNlcy9zYW5kYm94LyIsInNjaGVtZSI6ImV4YWN0In0sInBheWxvYWQiOnsiaENvbnRyYWN0IjoiOE1TRTFZRjVSVDhRM1NWNVlFNDlOUDROUUFTS1dTWEo3NlpXRVFLR1lQWDNGMVhSRVNaMlNFMThFVjM0OTYxU1pSRFNHMzRYVE1LUDdWRjdUUTFUNDdUUDdYVkFCRzY3OFkyNVk4OCIsIm9yZGVySWQiOiIyMDI2LjI5My1DWFpER0UxUzNQVzFNIn0sInJlc291cmNlIjp7ImRlc2NyaXB0aW9uIjoiQWNjZXNzIHRvIC9hcGkvcXVvdGUiLCJtaW1lVHlwZSI6ImFwcGxpY2F0aW9uL2pzb24iLCJ1cmwiOiJodHRwczovL2FwaS5leGFtcGxlLmNvbS9hcGkvcXVvdGUifSwieDQwMlZlcnNpb24iOjJ9
~~~

Decoded `PAYMENT-SIGNATURE`:

~~~json
{
  "accepted": {
    "amount": "10000000",
    "asset": "KUDOS",
    "extra": {
      "paymentFlow": "upfront",
      "talerAmount": "KUDOS:0.1",
      "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-CXZDGE1S3PW1M/?c=P6WN2XT8KQ4YB9ZD3VMC7RHF5E"
    },
    "maxTimeoutSeconds": 599,
    "network": "taler:F80MFRG8HVH6R9CQ47KRFQSJP3T6DBJ4",
    "payTo": "https://backend.demo.taler.net/instances/sandbox/",
    "scheme": "exact"
  },
  "payload": {
    "hContract": "8MSE1YF5RT8Q3SV5YE49NP4NQASKWSXJ76ZWEQKGYPX3F1XRESZ2SE18EV34961SZRDSG34XTMKP7VF7TQ1T47TP7XVABG678Y25Y88",
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

A client whose wallet gives it the merchant's payment signature adds it
to the payload ({{merchant-sig}}). The payload for a payment of order
`2026.294-QBWSJ3XQ0ZNR4`, which is the payment of the test vector in
{{merchant-sig-vector}}, is:

~~~json
{
  "hContract": "EQWFW7BVNC16S8VJ0F69MS9V8VZTA78M514SKQY0H462CQ5FG4YDFEZRB46KXZBPT9DAV8ZABN9EPQX9TSSGXV4BQTJD18WPRXJ6WBR",
  "merchantSig": "S41FPWEZB7WFRY6XCE09Z9CA1D38CXTBT0EHG1FG4EZ4TV0C01E1RWYG5AF38YPAH7H630A62AN813RMJC1KD2KM1YSAK8NBK2QAM3R",
  "orderId": "2026.294-QBWSJ3XQ0ZNR4"
}
~~~

Settle asks the merchant backend, without any credential:

~~~http
GET /instances/sandbox/orders/2026.293-CXZDGE1S3PW1M?h_contract=8MSE1YF5RT8Q3SV5YE49NP4NQASKWSXJ76ZWEQKGYPX3F1XRESZ2SE18EV34961SZRDSG34XTMKP7VF7TQ1T47TP7XVABG678Y25Y88 HTTP/1.1
Host: backend.demo.taler.net
~~~

~~~http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "fulfillment_url": "https://api.example.com/api/quote?order=2026.293-CXZDGE1S3PW1M",
  "refund_amount": "KUDOS:0",
  "refund_pending": false,
  "refund_taken": "KUDOS:0",
  "refunded": false
}
~~~

~~~http
HTTP/1.1 200 OK
PAYMENT-RESPONSE: eyJhbW91bnQiOiIxMDAwMDAwMCIsIm5ldHdvcmsiOiJ0YWxlcjpGODBNRlJHOEhWSDZSOUNRNDdLUkZRU0pQM1Q2REJKNCIsInN1Y2Nlc3MiOnRydWUsInRyYW5zYWN0aW9uIjoiMjAyNi4yOTMtQ1haREdFMVMzUFcxTSJ9
~~~

Decoded `PAYMENT-RESPONSE`:

~~~json
{
  "amount": "10000000",
  "network": "taler:F80MFRG8HVH6R9CQ47KRFQSJP3T6DBJ4",
  "success": true,
  "transaction": "2026.293-CXZDGE1S3PW1M"
}
~~~

# Test Vector for merchantSig {#merchant-sig-vector}

This vector is a real payment signature, not one made for this document.
It was read from the database of a GNU Taler wallet that had paid order
`2026.294-QBWSJ3XQ0ZNR4` at the public demo merchant backend: the signature is the
wallet's `merchant_pay_sig` of that purchase, the contract hash is the
`contractTermsHash` of its payment, and the public key is `merchant_pub` of
the contract terms the wallet stored for it. Orders for other payments at
the same backend gave four more such signatures, which verified the same
way (observed). The prototype {{ARVUNA-PROTOTYPE}} keeps the vector in
`src/taler/testdata/merchant-pay-sig-vector.json` and tests against it.

~~~
merchant_pub (Crockford Base32, 32 bytes):
  74DV5N6T2ANY1DJFMD41BN7KJYXK70S18CM22TQABEYMA2GSDRD0
  hex: 391bb2d4da12abe0b64fa34815d4f397bb3383214328216aea5bbd450a196e1a

h_contract_terms (Crockford Base32, 64 bytes):
  EQWFW7BVNC16S8VJ0F69MS9V8VZTA78M514SKQY0H462CQ5FG4YDFEZRB46KXZBPT9DAV8ZABN9EPQX9TSSGXV4BQTJD18WPRXJ6WBR

signed message (72 bytes, hex):
  00000048                         size = 72
  00000450                         purpose = 1104
  75f8fe1d7bab026ca37203cc9a653b46ffa51d14284999dfc0890c265caf813c
  d7bbf8590d3efd76d25aada3ea5d52eb5fa9d6730eec8bbea4d0a396c7646e2f      h_contract_terms

merchantSig (Crockford Base32, 64 bytes):
  S41FPWEZB7WFRY6XCE09Z9CA1D38CXTBT0EHG1FG4EZ4TV0C01E1RWYG5AF38YPAH7H630A62AN813RMJC1KD2KM1YSAK8NBK2QAM3R
  hex: c902fb71df59f8fc78dd63809fa58a0b4686774bd01d1805f023be4d6c0c005c1c73d02a9e347aca89e261814612aa808f149303368a740fb2a9a2ab98aeaa0f

Ed25519 verification of merchantSig over the signed message
under merchant_pub: valid.
Any one bit of the message, the key or the signature changed: invalid.
~~~

# Changes from Version 02 {#changes}

This appendix is to be removed before submission.

* Amount ({{amount}}): the base unit is always 10^-8 of the currency, for
  every Taler currency, with no lookup of any currency specification. The
  rule that took the unit from `num_fractional_input_digits`, and its
  fallback, are removed. The reason is the answer of a Taler developer
  ({{TALER-LIST-AMOUNT}}): the specification is a rendering hint and not
  normative. OQ-1 is closed. Examples: 1 EUR is "100000000", 0.1 KUDOS is
  "10000000".
* `methodDetails.talerAmount` (Payment format) and `extra.talerAmount`
  (x402) are new and REQUIRED: the order amount as a Taler amount
  `CURRENCY:VALUE[.FRACTION]`. The client MUST check that it and `amount`
  describe the same value and currency, and MUST NOT pay if they differ;
  the server MUST create the order for exactly that amount. The grammar is
  the one of the Taler documentation, which differs from {{RFC8905}} in the
  length of the currency, the limit of the integer part and the commas
  ({{amount}}). The Taler developer wrote the field as `taler_amount`; it
  is `talerAmount` here, like the other fields.
* Exchange identity ({{exchanges}}, {{x402-namespace}}): OQ-10 is closed.
  The x402 `network` stays the prefix of the Master Public Key, the more
  stable identifier for software; the `url` in the exchanges list is the
  identifier for people. Clients MUST NOT show the network string and
  SHOULD show the exchange's domain ({{TALER-LIST-IDENTIFIER}}). New:
  OQ-13 on how an x402-only client learns the domain.
* Merchant payment signature ({{merchant-sig}}): the x402 payload MAY carry
  `merchantSig`. When present, settle MUST verify it against the Merchant
  Public Key of the order, with the byte layout and the purpose constant
  read from the Taler source, and MAY then skip the public status request,
  but only when it knows the contract hash of the order, because the
  signature covers the hash and not the order identifier. New reason
  `invalid_exact_taler_merchant_sig`, a test vector from a real payment
  ({{merchant-sig-vector}}), and a settle step 4. OQ-11 is narrowed to the
  open part: wallet-core does not return the signature to the application
  today. New: OQ-14 on the contract hash.
* OQ-12 is closed: reported as bug 11886 ({{TALER-BUG-11886}}), and the
  method does not rely on the behaviour either way ({{x402-settle}}).
* Single use across formats ({{replay}}): the record is per order and is
  shared by both formats. The consumption key is `ietf:` plus the order
  identifier for the IETF format and `network:orderId` for x402; both map to
  the same order record.
* Failure responses: a table of status and problem type for the IETF format
  ({{failure-response}}) and the x402 responses, 402 with `PAYMENT-RESPONSE`,
  500 when the merchant backend cannot be asked, and 400 for a payload that
  is not a `PaymentPayload`, which is what the x402 HTTP transport specifies
  ({{x402-failure}}).
* Settle ({{x402-settle}}): the steps are now six, with the signature check
  as step 4; the consumption key is step 6.
* The encoded examples are regenerated for the new amount and `talerAmount`,
  and one example shows a payload with `merchantSig`.

# Open Questions for Reviewers {#open-questions}

This appendix is to be removed before submission.

## Open

| # | Question | Draft's current answer |
|---|----------|------------------------|
| OQ-8 | IANA contact | Placeholder |
| OQ-11 | Which interface of wallet-core will return the merchant payment signature to the paying application, and will it come with the merchant public key? (The developers said it could; it does not today.) | `merchantSig` is OPTIONAL; the public order status is the default proof check |
| OQ-13 | An x402 requirement identifies an exchange only by `network`, so an x402-only client has no domain to show to its user. Should `extra` carry the exchange's URL? | No. The domain is shown where the client knows the exchange list of the same order ({{x402-namespace}}) |
| OQ-14 | A server that has the merchant's payment signature can skip the public status request only if it knows the contract hash of its own order. Does the merchant backend give that hash to the server that created the order, or must the server compute it? | The request is not skipped unless the server knows the hash ({{merchant-sig}}) |

## Core specification issue, to be raised upstream

| # | Issue |
|---|-------|
| CSI-1 | Should the core scheme allow a static, cacheable challenge, as in the Paivana design, for methods whose payment request is created when the payer engages? Today it requires a unique identifier and `Cache-Control: no-store` in every 402. |

## Closed in this version

| # | Answer | Source |
|---|--------|--------|
| OQ-1 | The base unit is always 10^-8. The currency specification is a rendering hint and is not consulted. The Taler amount is carried in an extra field, `talerAmount`. | {{TALER-LIST-AMOUNT}} |
| OQ-10 | The `network` stays the prefix of the Master Public Key (software); the exchange's domain is what people see; clients MUST NOT show the network string. | {{TALER-LIST-IDENTIFIER}} |
| OQ-12 | Reported by us and filed upstream as bug 11886. The method does not rely on the behaviour either way. | {{TALER-BUG-11886}}, {{TALER-LIST-IDENTIFIER}} |

## Closed in earlier versions

OQ-2 (currency case), OQ-3 (recipient), OQ-4 (order creation; the
alternative is CSI-1), OQ-5 (fulfillment URL), OQ-6 (refund deadline),
OQ-7 (binding) and OQ-9 (x402 `transaction` and `payTo`) were closed in
version 01.
