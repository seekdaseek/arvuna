# Conformance run: arvuna-check against six 402 endpoints, 2026-10-20

Tool: `arvuna-check` from this repository (`node src/conformance/cli.ts URL`), run from the working tree before the commit that adds this document. Each target received **one unauthenticated GET**. No credential was sent and nothing was paid. Full per-target rule tables are in [docs/conformance/](conformance/), regenerated with `node scripts/run-conformance.ts 20261020`.

Rules come from the specifications as fetched on 2026-10-20:

- `draft-httpauth-payment-01` and `draft-payment-intent-charge-00`, github.com/tempoxyz/mpp-specs (`specs/core`, `specs/intents`);
- x402 v2: `specs/x402-specification-v2.md` and `specs/transports-v2/http.md`, github.com/x402-foundation/x402;
- CAIP-2, for the network identifier, which the x402 spec points to in section 11.1.

The checker does not verify anything that needs the server's secret (for example the HMAC challenge id binding), does not check that a challenge can actually be paid, and treats SHOULD rules as warnings. Its rules are my reading of the spec text and are open to correction. A FAIL here means "differs from the text of the spec as read", not "broken service".

## Results

| Target | Offers | Rules: pass / fail / warn |
|---|---|---|
| arvuna Taler prototype, `http://127.0.0.1:8402/api/quote` (local, backed by the live Taler demo merchant) | IETF Payment + x402 v2 | 29 / 0 / 0 |
| AgentFeed, `https://x402.ochinimus.app/api/sol-price` (maintainer's own service) | IETF Payment (3 challenges) + x402 v2 (13 options) | 128 / **1** / 0 |
| 2s.io, `https://2s.io/api/weather/zip?zip=94103` | x402 v2 | 20 / **1** / 0 |
| Abstract MPP demo, `https://mpp.abs.xyz/api/charge` | IETF Payment | 14 / 0 / 0 |
| MPP project demo, `https://mpp.dev/api/ping/paid` | IETF Payment | 15 / 0 / 0 |
| x402.org demo, `https://www.x402.org/protected` (redirects to `https://x402.org/protected`) | x402 v2 | 21 / 0 / 0 |

All six answered `402`. Where a target offers only one format, the other format's rules report N/A rather than pass.

## Findings

Reported as facts about the observed responses, not as attacks. Each is reproducible with the command shown.

### F1. AgentFeed: Algorand network id exceeds the CAIP-2 length limit

- Rule X402-11 (network is a CAIP-2 identifier), x402 spec section 11.1.
- Observed: `accepts[5].network = "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="`. The reference part is 44 characters and ends in `=`.
- CAIP-2 grammar: `reference: [-_a-zA-Z0-9]{1,32}`. Both the length and the `=` fall outside it.
- Context: the value is the Algorand genesis hash in full, which appears to be the convention used by x402 on Algorand (not verified here). If so, the divergence is between that convention and the CAIP-2 grammar the x402 spec cites, and other servers following it would show the same result. Which side should change is a question for the x402 and CAIP maintainers.
- Reproduce: `node src/conformance/cli.ts https://x402.ochinimus.app/api/sol-price | grep FAIL`

### F2. 2s.io: more tags than the x402 spec allows

- Rule X402-08 (optional ResourceInfo fields follow their limits), x402 spec section 5.1.2.
- Observed: `resource.tags` holds 8 entries (`public-records`, `identifiers`, `ai-agents`, `us-gov-data`, `x402`, `upto-billing`, `ai-gateway`, `agent-infrastructure`). The spec says "Max 5 entries".
- Reproduce: `node src/conformance/cli.ts 'https://2s.io/api/weather/zip?zip=94103' | grep FAIL`

### F3. In the spec's own example: `USD` against `usd`

Not a target result, but found while writing the tests. In `draft-httpauth-payment-01`, section "Example Challenge", the `request` value `eyJhbW91bnQiOiIxMDAwIiwiY3VycmVuY3kiOiJVU0QiLCJyZWNpcGllbnQiOiJhY2N0XzEyMyJ9` decodes to `{"amount":"1000","currency":"USD","recipient":"acct_123"}`, while the "Decoded request example" printed directly under it shows `"currency": "usd"`, and `draft-payment-intent-charge-00` (Currency Formats) says ISO 4217 codes are lowercase. Feeding the spec's example challenge to `arvuna-check` therefore fails rule IETF-11, which is covered by a unit test. This is a candidate upstream fix to the draft.

### Observations that are not failures

- AgentFeed offers three IETF challenges (`solana`, `tempo`, `tempo`) and thirteen x402 options on one route; all pass except F1. The `request` objects, ids, expiries (300 s) and `opaque` values all validate.
- `abs.xyz` and `mpp.dev` use `method="abstract"` / `method="tempo"`; both pass every rule that applies.
- The checker reported `WARN` for nothing on these targets. It does warn on an absent `expires`, on an uppercase non-ISO currency symbol, on an `intent` outside charge/session/subscription, and on x402 schemes outside the x402 repository's list; those paths are covered by unit tests, not by this run.

## How the rules were tested

`npm test` runs 45 tests in total, 17 of them for the checker. The known-good side of the checker tests uses fixtures copied from the specifications, with the source cited in each fixture (`src/fixtures/spec.ts`): the core example challenge, the multiple-challenge example, the three published HMAC test vectors, the x402 `PAYMENT-REQUIRED` example header and its decoded object, and the charge intent's request examples. The known-bad side deliberately breaks one field at a time (padding on a base64url value, an uppercase method, a numeric amount, a decimal amount, a network id without a namespace, an expired `expires`, and so on) and asserts that the matching rule reports FAIL. A test also confirms the observer refuses to send an `Authorization`, `Payment-Authorization`, `PAYMENT-SIGNATURE`, `X-PAYMENT` or `Cookie` header and sends none of its own.
