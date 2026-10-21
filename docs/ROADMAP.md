# Roadmap

Two parts: what exists now (a prototype, built before any funding decision) and what is planned as grant milestones M1 to M6. **Nothing in the second part has been started.** The prototype is a feasibility proof and is not a delivery of any milestone; milestone work will be new production work, done and reported after selection.

## Prototype: done

The prototype follows [draft-taler-charge-03](specs/draft-taler-charge-03.md) and has been paid in both formats on the public Taler demo, with the demo wallet and demo money only.

| Piece | State | Where |
|---|---|---|
| Taler merchant client over HTTP: order creation with a claim token and an explicit refund deadline, status with long-polling, the exchanges the merchant trusts, and the public order status used to settle | runs, probed live against the Taler demo backend; requests the narrowest token scope (`order-simple`) | `src/taler/merchant.ts`, `src/taler/exchange.ts`, `src/taler/payuri.ts` |
| One protected route that answers 402 in both the IETF Payment format and x402 v2, with the exchange list, one `accepts[]` entry per exchange, payment flow `upfront`, the amount in units of 10^-8 beside the Taler amount string, and an optional merchant payment signature that is verified when sent; verifies a retry in either format; returns `Payment-Receipt` or `PAYMENT-RESPONSE`; single-use across formats and across restarts; no verb bypass | runs; 29 paywall and client tests and 5 merchant-signature tests (against a real signature) against an offline stand-in for the merchant and its exchanges; live 402 and verified payments against the demo | `src/taler/paywall.ts` |
| Durable state: issued orders and consumption keys (`network:orderId`) in SQLite, one atomic claim, kept until the later of the pay and refund deadlines | runs; 3 store tests including a restart | `src/taler/store.ts` |
| Reference client, which takes the contract hash from the wallet's payment record and refuses to pay if the amount and the Taler amount differ | runs in tests and in the live paid run | `src/taler/client.ts` |
| Paid end-to-end run with the Taler wallet | **done three times**: first run exposed and fixed a bug; the second, against draft -02, and the third, against draft -03, paid both formats and refused a replay of each, also in the other format | [proof-taler-demo.md](proof-taler-demo.md) |
| Conformance checker `arvuna-check`: one unauthenticated request, parses the IETF challenge and the x402 requirement, 17 IETF and 15 x402 rule groups with spec citations, never pays | runs; 17 tests with spec fixtures; run against six public endpoints and against the prototype's own 402 | `src/conformance/`, [conformance-run.md](conformance-run.md) |

Still missing against the draft, and known limits of the prototype:

- No separate facilitator. The resource server settles against its own merchant backend, so the draft's remark that a facilitator can settle from the public order status alone is not exercised.
- Per-product fulfillment URLs (repurchase detection), orders with a fulfillment message, and the browser case (a session-bound payment) are not implemented. The draft describes them from the Taler documentation and marks them untested.
- Refunds are not granted by the prototype. It sets the refund deadline and refuses an order refunded in full.
- Every unauthenticated request still creates a merchant order. There is no rate limit, no reuse of an open order and no removal of expired unpaid orders.
- Only the demo exchange has been used live. Several exchanges, and exchanges that publish a currency specification the prototype must ignore, are tested against the offline stand-in only.
- The store is one SQLite file for one process, and its consumption key is not prefixed with the merchant base URL, which the draft suggests for a store shared by several merchant instances.
- The merchant payment signature is verified when the client sends it, but never replaces the public order status read: the signature does not bind the contract hash to the order, and the prototype cannot learn the hash of its own order (draft OQ-14). wallet-core does not return the signature to an application (draft OQ-11); the live run read it from the wallet database.
- The checker looks at the challenge only and cannot check anything that needs the server's secret; it does not know the Taler draft's own fields.

## Planned grant milestones (proposed, not done)

| | Work | Hours |
|---|---|---|
| M1 | **Open test suite.** A method-neutral test harness and test vectors for the IETF Payment scheme and x402 v2: challenge and credential format, replay and idempotency, expiry, error semantics and receipts. Runs against any server or client, from the command line and in CI. | 200 |
| M2 | **Taler method.** A draft of the method specification exists ([draft-taler-charge-03](specs/draft-taler-charge-03.md)) and the Taler developers have reviewed it in public. M2 takes it from draft to submission: its open questions closed with the Taler developers and the standards maintainers, the matching x402 scheme document in that project's own format, a production adapter with refunds, the browser case, rate limits and the cleanup of unpaid orders, a run against a self-hosted Taler exchange and bank beyond the public demo, a security review, and upstream patches where Taler itself needs a change, such as wallet-core giving the merchant's payment signature to the paying application. | 200 |
| M3 | **Bank instant method and settlement watcher.** Request-to-Pay with QR, generic over SEPA Instant through the EPC QR standard and national rails, with a settlement watcher interface shaped like the Taler Bank Revenue API. Moldova's MIA is an optional reference rail. | 300 |
| M4 | **Sessions on public rails: pay once, spend many times.** A reader tops up a small balance once over Taler or SEPA Instant and spends it across many requests. The reader chooses whether leftover money is refunded or kept. The balance can be spent only on the site that sold it. It becomes a session method for both standards. | 120 |
| M5 | **Shop backends behind arvuna.** An adapter interface that lets an open source shop keep its orders and payment methods while arvuna answers the 402, with a first adapter for one real open source shop platform and a guide for the existing Taler shop plugins. | 80 |
| M6 | **Pilot, packaging, upstream submission.** One live pilot site charging per request, reproducible packages (Guix or Nix), documentation, an accessibility pass, and both method drafts sent to the IETF and x402 maintainers. | 180 |
| | **Project work** across the six milestones. | 60 |
| | **Total** | **1,140** |

Code is under Apache-2.0 (see LICENSE); specifications are released under CC BY 4.0.
