# arvuna

Open payment methods for HTTP 402 on public payment rails.

## Status

**Prototype.** It shows that the idea is feasible. It is not the finished project: the production work is listed as milestones in [docs/ROADMAP.md](docs/ROADMAP.md), and none of that has been started.

What runs, each part with tests that were executed (`npm test`: 45 tests, all passing):

- **A Taler adapter** (`src/taler/`). One protected route answers `402` in both formats at once, built from a real order on a GNU Taler merchant backend: the IETF `WWW-Authenticate: Payment` challenge and the x402 v2 `PAYMENT-REQUIRED` header. It accepts a retry in either format, asks the merchant whether the order is paid, and returns a receipt. It talks to Taler over HTTP only.
- **A conformance checker** (`src/conformance/`). `arvuna-check URL` makes one request, expects `402`, and checks what it finds against the two specifications, one rule at a time with the section cited. It never pays and never sends a credential. Results of a run against six public endpoints, including two findings, are in [docs/conformance-run.md](docs/conformance-run.md).

A paid run on the public Taler demo has been done: a Taler wallet paid a real demo order and the route returned `200` with a receipt, once in each format. The transcript, a bug it exposed and how it was fixed, and what it does not show, are in [docs/proof-taler-demo.md](docs/proof-taler-demo.md). It used demo money (KUDOS) only.

What does not run yet:

- No SEPA Instant method, no settlement watcher, no packaging, no pilot.

Try it (Node 24 or later). The expected output below was produced by running each command.

```
npm install
```

```
npm test
```

Expected output (summary lines):

```
ℹ tests 45
ℹ suites 0
ℹ pass 45
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

```
node src/conformance/cli.ts https://mpp.dev/api/ping/paid
```

Expected output (first 15 lines; the observation timestamp is elided, the rest is as printed, and a live endpoint can change its answer):

```
Target   https://mpp.dev/api/ping/paid
Request  GET, no credential sent   Response 402   Observed …
Offers   IETF Payment: yes   x402: no

RULE       RESULT CHECK                                                              SPEC / DETAIL
IETF-01    PASS   Challenge is sent with status 402                                  draft-httpauth-payment-01, Status Codes  — status 402
IETF-02    PASS   402 carries Cache-Control: no-store                                draft-httpauth-payment-01, Caching  — Cache-Control: no-store
IETF-03    PASS   Challenge syntax is valid auth-params, no duplicate parameters     draft-httpauth-payment-01, Challenge (WWW-Authenticate)
IETF-04    PASS   id present and non-empty                                           draft-httpauth-payment-01, Required Parameters (id)
IETF-05    PASS   realm present                                                      draft-httpauth-payment-01, Required Parameters (realm)
IETF-06    PASS   method present, lowercase ASCII letters only                       draft-httpauth-payment-01, Method Identifier Format (payment-method-id = 1*LOWERALPHA)  — method="tempo"
IETF-07    PASS   intent syntax valid and defined in a published intent spec         draft-httpauth-payment-01, Intent Identifiers  — intent="charge"
IETF-08    PASS   request present, base64url without padding, JSON object            draft-httpauth-payment-01, Required Parameters (request)
IETF-09    PASS   request JSON is serialised with JCS (RFC 8785)                     draft-httpauth-payment-01, Required Parameters (request)
IETF-10    PASS   charge: request.amount is a string of base units                   draft-payment-intent-charge-00, Shared Fields (Required)  — amount="100000"
```

```
npm run demo
```

Expected output (the Taler-backed paywall, which needs network access to the public Taler demo; leave it running and `curl -i http://127.0.0.1:8402/api/quote` answers `402`):

```
arvuna demo on http://127.0.0.1:8402  paid route: /api/quote  backend: https://backend.demo.taler.net
```

`npm run e2e` needs demo money in a Taler test wallet and is described in [docs/proof-taler-demo.md](docs/proof-taler-demo.md); it is not part of this quick check.

## Verify in five minutes

| Claim | How to check | Evidence |
|---|---|---|
| 45 tests pass | `npm install && npm test` | Output above; tests in [common](src/common/common.test.ts), [paywall](src/taler/paywall.test.ts), [conformance](src/conformance/conformance.test.ts) |
| A protected route answers 402 in both formats at once | `npm run demo`, then `curl -i http://127.0.0.1:8402/api/quote`: look for `www-authenticate: Payment` and `payment-required` headers | [Decoded response, from a real merchant order](docs/proof-taler-demo.md#3-the-protected-route-answers-402-in-both-formats) |
| A real Taler demo order was paid in each format: IETF order `2026.293-Z2SX6Z5QR12R2`, x402 order `2026.293-CXZDGE1S3PW1M` | `curl -s -H 'Authorization: Bearer secret-token:sandbox' https://backend.demo.taler.net/instances/sandbox/private/orders/2026.293-Z2SX6Z5QR12R2 \| grep -o '"order_status": *"[a-z]*"'` prints `paid`; repeat with the other id. `sandbox` is the published password of the public demo instance, and the money is demo money | [Paid-run transcript and merchant check](docs/proof-taler-demo.md#5-the-paid-run), [raw output](docs/proof-taler-paid-run-raw.txt) |
| The conformance checker was run on six public endpoints and found two things | `node src/conformance/cli.ts 'https://2s.io/api/weather/zip?zip=94103' \| grep FAIL` and `node src/conformance/cli.ts https://x402.ochinimus.app/api/sol-price \| grep FAIL` each print one `FAIL` row | [Six endpoints, two findings](docs/conformance-run.md), [per-target tables](docs/conformance) |
| A bug found by the paid run (every order had the same fulfillment URL, so a wallet refused to pay a repeat purchase) was fixed, with a test written first | `node --test --test-name-pattern="own fulfillment_url" src/taler/paywall.test.ts` | [First attempt and cause](docs/proof-taler-demo.md#attempt-1-ietf-passes-x402-fails-a-bug-in-this-repository), [fix commit 33fcd57](https://github.com/seekdaseek/arvuna/commit/33fcd57), [raw first attempt](docs/proof-taler-paid-run-raw-attempt1.txt) |

## The problem

HTTP has a status code for "pay first": 402. Two standards now define how a server asks for payment and how a client pays:

- the IETF **Payment** HTTP authentication scheme, `draft-httpauth-payment-01`, which uses `WWW-Authenticate: Payment` and keeps a registry of payment methods;
- **x402** v2, maintained by the x402 Foundation under the Linux Foundation, which uses the `PAYMENT-REQUIRED` header and pluggable schemes.

Both are designed to carry any payment method. So far every published method is a card network or a blockchain. Neither standard has a method for the public payment rails Europe already runs: GNU Taler, SEPA Instant Credit Transfer, or national instant payment systems. Nothing tests implementations of either standard against each other.

## What arvuna adds

1. **`taler` method.** A method specification for the IETF Payment registry and a matching x402 scheme for GNU Taler. A reference adapter maps the Taler merchant backend's existing 402 response (`taler_pay_uri`) to both formats, and maps payment status back into a receipt. The adapter talks to the merchant backend only over its HTTP API. The method specification is drafted in [docs/specs/draft-taler-charge-02.md](docs/specs/draft-taler-charge-02.md), with open questions marked for review.
2. **`rtp` method.** A request-to-pay method for bank instant payments: SEPA Instant through the EPC QR code standard, plus national instant rails. The recipient is a `payto:` URI (RFC 8905).
3. **Settlement watcher.** EU law requires the receiving bank to credit an instant transfer within ten seconds, but it does not require the bank to tell the payee. arvuna defines one watcher interface in the shape of the Taler Bank Revenue API, with these backends in order of preference:
   - LibEuFin Nexus over EBICS;
   - bank-native webhooks;
   - account-information aggregators, as a slow fallback.
4. **Conformance suite.** A method-neutral test harness and test vectors for both standards: challenge and credential format, replay and idempotency, expiry, error semantics and receipts. It runs from the command line and in CI against any server or client.
5. **Pay once, spend many times.** A session method for both standards. A reader tops up a small balance once, over Taler or SEPA Instant, and spends it across many requests. The reader chooses whether leftover money is refunded or kept, and the balance can be spent only on the site that sold it.
6. **Shop backends.** An adapter interface that lets an open source shop keep its own orders and payment methods while arvuna answers the 402. A first adapter covers one real open source shop platform, and a guide covers the existing Taler shop plugins.

An optional reference adapter covers Moldova's MIA instant payment system through a bank's merchant API.

## Design rules

- **Non-custodial.** arvuna never holds or moves anyone's money. Funds go from the payer's wallet or bank to the payee's own account or exchange.
- **Upstream first.** Method specifications are proposed to the standards' own repositories, and changes to Taler are offered as patches.
- **No vendor lock.** Every rail sits behind the same interfaces, and every backend is replaceable.

## Use of generative AI

See [GENAI-LOG.md](GENAI-LOG.md).

## Licence

Apache-2.0. See [LICENSE](LICENSE). Specifications are released under CC BY 4.0.

## Contact

seekdaseek. Issues and pull requests are welcome here.
