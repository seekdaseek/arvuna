# Roadmap

Two parts: what exists now (a prototype, built before any funding decision) and what is planned as grant milestones M1 to M6. **Nothing in the second part has been started.** The prototype is a feasibility proof and is not a delivery of any milestone; milestone work will be new production work, done and reported after selection.

## Prototype: done 2026-10-20

| Piece | State | Where |
|---|---|---|
| Taler merchant client over HTTP: order creation, status with long-polling, public 402 with `taler_pay_uri` | runs, probed live against the Taler demo backend | `src/taler/merchant.ts` |
| One protected route that answers 402 in both the IETF Payment format and x402 v2, verifies a retry in either format, returns `Payment-Receipt` or `PAYMENT-RESPONSE`, single-use, no verb bypass | runs; 17 tests against an offline stand-in for the merchant; live 402 and verified payments against the demo merchant | `src/taler/paywall.ts` |
| Reference client | runs in tests and in the live paid run | `src/taler/client.ts` |
| Paid end-to-end run with the Taler wallet | **done 2026-10-20**: both formats paid with demo KUDOS and served with a receipt, after a first attempt exposed and fixed a bug; transcript in the proof document | [proof-taler-demo-20261020.md](proof-taler-demo-20261020.md) |
| Conformance checker `arvuna-check`: one unauthenticated request, parses the IETF challenge and the x402 requirement, 17 IETF and 15 x402 rule groups with spec citations, never pays | runs; 17 tests with spec fixtures; run against six public endpoints | `src/conformance/`, [conformance-run-20261020.md](conformance-run-20261020.md) |

Known limits of the prototype: issued orders and used credentials are held in memory; every unauthenticated request creates a merchant order; the checker looks at the challenge only and cannot check anything that needs the server's secret.

## Planned grant milestones (proposed, not done)

| | Work | Hours |
|---|---|---|
| M1 | **Open test suite.** A method-neutral test harness and test vectors for the IETF Payment scheme and x402 v2: challenge and credential format, replay and idempotency, expiry, error semantics and receipts. Runs against any server or client, from the command line and in CI. | 200 |
| M2 | **Taler method.** A method specification for the IETF Payment registry and an x402 scheme for Taler, with a reference adapter that bridges the Taler merchant 402 to both standards. Tested against the Taler demo and an eCHF exchange, built with the Taler developers, specifications offered upstream. | 200 |
| M3 | **Bank instant method and settlement watcher.** Request-to-Pay with QR, generic over SEPA Instant through the EPC QR standard and national rails, with a settlement watcher interface shaped like the Taler Bank Revenue API. Moldova's MIA is an optional reference rail. | 300 |
| M4 | **Sessions on public rails: pay once, spend many times.** A reader tops up a small balance once over Taler or SEPA Instant and spends it across many requests. The reader chooses whether leftover money is refunded or kept. The balance can be spent only on the site that sold it. It becomes a session method for both standards. | 120 |
| M5 | **Shop backends behind arvuna.** An adapter interface that lets an open source shop keep its orders and payment methods while arvuna answers the 402, with a first adapter for one real open source shop platform and a guide for the existing Taler shop plugins. | 80 |
| M6 | **Pilot, packaging, upstream submission.** One live pilot site charging per request, reproducible packages (Guix or Nix), documentation, an accessibility pass, and both method drafts sent to the IETF and x402 maintainers. | 180 |
| | **Project work** across the six milestones. | 60 |
| | **Total** | **1,140** |

Code is under Apache-2.0 (see LICENSE); specifications are released under CC BY 4.0.
