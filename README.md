# arvuna

Open payment methods for HTTP 402 on public payment rails.

*arvună* is Romanian for earnest money, the sum you pay upfront to seal a deal. It is what a server asks for when it answers `402 Payment Required`.

## Status

Prototype in progress: a Taler method adapter that answers 402 in both formats, and a conformance checker. What runs, and the proof runs, will be listed here as each piece passes its tests. The production milestones are in docs/ROADMAP.md.

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

Serghei Ochinca, Chisinau. Issues and pull requests are welcome here.
