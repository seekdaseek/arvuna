# arvuna

Open payment methods for HTTP 402 on public payment rails.

## Status

**Prototype** (2026-10-20). It shows that the idea is feasible. It is not the finished project: the production work is listed as milestones in [docs/ROADMAP.md](docs/ROADMAP.md), and none of that has been started.

What runs, each part with tests that were executed (`npm test`: 45 tests, all passing):

- **A Taler adapter** (`src/taler/`). One protected route answers `402` in both formats at once, built from a real order on a GNU Taler merchant backend: the IETF `WWW-Authenticate: Payment` challenge and the x402 v2 `PAYMENT-REQUIRED` header. It accepts a retry in either format, asks the merchant whether the order is paid, and returns a receipt. It talks to Taler over HTTP only.
- **A conformance checker** (`src/conformance/`). `arvuna-check URL` makes one request, expects `402`, and checks what it finds against the two specifications, one rule at a time with the section cited. It never pays and never sends a credential. Results of a run against six public endpoints, including two findings, are in [docs/conformance-run-20261020.md](docs/conformance-run-20261020.md).

A paid run on the public Taler demo has been done: a Taler wallet paid a real demo order and the route returned `200` with a receipt, once in each format. The transcript, a bug it exposed and how it was fixed, and what it does not show, are in [docs/proof-taler-demo-20261020.md](docs/proof-taler-demo-20261020.md). It used demo money (KUDOS) only.

What does not run yet:

- No SEPA Instant method, no settlement watcher, no packaging, no pilot.

Try it (Node 24 or later):

```
npm install
npm test
node src/conformance/cli.ts https://example.org/some-paid-url
npm run demo        # the Taler-backed paywall on http://127.0.0.1:8402/api/quote
```

## The problem

HTTP has a status code for "pay first": 402. Two standards now define how a server asks for payment and how a client pays:

- the IETF **Payment** HTTP authentication scheme, `draft-httpauth-payment-01`, which uses `WWW-Authenticate: Payment` and keeps a registry of payment methods;
- **x402** v2, maintained by the x402 Foundation under the Linux Foundation, which uses the `PAYMENT-REQUIRED` header and pluggable schemes.

Both are designed to carry any payment method. So far every published method is a card network or a blockchain. Neither standard has a method for the public payment rails Europe already runs: GNU Taler, SEPA Instant Credit Transfer, or national instant payment systems. Nothing tests implementations of either standard against each other.

## What arvuna adds

1. **`taler` method.** A method specification for the IETF Payment registry and a matching x402 scheme for GNU Taler. A reference adapter maps the Taler merchant backend's existing 402 response (`taler_pay_uri`) to both formats, and maps payment status back into a receipt. The adapter talks to the merchant backend only over its HTTP API.
2. **`rtp` method.** A request-to-pay method for bank instant payments: SEPA Instant through the EPC QR code standard, plus national instant rails. The recipient is a `payto:` URI (RFC 8905).
3. **Settlement watcher.** EU law requires the receiving bank to credit an instant transfer within ten seconds, but it does not require the bank to tell the payee. arvuna defines one watcher interface in the shape of the Taler Bank Revenue API, with these backends in order of preference:
   - LibEuFin Nexus over EBICS;
   - bank-native webhooks;
   - account-information aggregators, as a slow fallback.
4. **Conformance suite.** A method-neutral test harness and test vectors for both standards: challenge and credential format, replay and idempotency, expiry, error semantics and receipts. It runs from the command line and in CI against any server or client.

An optional reference adapter covers Moldova's MIA instant payment system through a bank's merchant API.

## Design rules

- **Non-custodial.** arvuna never holds or moves anyone's money. Funds go from the payer's wallet or bank to the payee's own account or exchange.
- **Upstream first.** Method specifications are proposed to the standards' own repositories, and changes to Taler are offered as patches.
- **No vendor lock.** Every rail sits behind the same interfaces, and every backend is replaceable.

## Use of generative AI

See [GENAI-LOG.md](GENAI-LOG.md).

## Licence

To be confirmed. All code and specifications will be released under a recognised free software licence.

## Contact

seekdaseek. Issues and pull requests are welcome here.
