# Taler method prototype: proof run, 2026-10-20

**Status: the paid run was completed on 2026-10-20, for both formats, after one bug found by the first attempt was fixed.** A Taler wallet paid a real order on the public GNU Taler demo (KUDOS, demo money with no value) and the protected route then returned `HTTP 200` with a receipt, once through the IETF Payment format and once through x402 v2. The merchant backend independently reports the orders as `paid`. Sections 1 to 4 are the work before the wallet held any money; section 5 is the paid run, including the failed first attempt.

## What was run, and what it showed

All commands ran on 2026-10-20 against `https://backend.demo.taler.net` (merchant backend 1.6.23, currency KUDOS, demo money with no value).

### 1. Which Authorization header the demo backend takes

The brief named two forms. Probed with `POST …/private/orders`:

| Request | Result |
|---|---|
| `Authorization: ApiKey sandbox` | **rejected**: `code 26`, detail `'secret-token:' prefix or 'Bearer' missing in 'Authorization' header` (HTTP 401) |
| `Authorization: Bearer secret-token:sandbox`, path `/private/orders` | rejected: `code 2015`, `Check credentials` (HTTP 401). This is the default `admin` instance, not the demo instance |
| `Authorization: Bearer secret-token:sandbox`, path `/instances/sandbox/private/orders` | **works** (HTTP 200). Documented as deprecated: the instance password used directly as a bearer token |
| Login token: `POST /instances/sandbox/private/token` with Basic `sandbox:sandbox`, body `{"scope":"order-full",…}`, then `Authorization: Bearer secret-token:<token>` | **works**, and is the documented current method |

Conclusions recorded for the code: the tutorial URL named in the brief (`docs.taler.net/taler-merchant-api-tutorial.html`) now returns 404; the demo merchant instance is `sandbox`, reached under `/instances/sandbox/`; the `ApiKey` header no longer works. `src/taler/merchant.ts` uses the login token with scope `order-full` and renews it on a 401.

### 2. Merchant client, live

`node scripts/probe-merchant.ts`:

```
config: KUDOS fractionalDigits 2 -> 10 base units for KUDOS:0.1
created: { orderId: '2026.293-D3VDQYD88AE8C', payDeadlineS: 1792499882 }
public GET /orders/{id}: {
  httpStatus: 402,
  talerPayUri: 'taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-D3VDQYD88AE8C/',
  fulfillmentUrl: 'https://example.org/f'
}
private status after 2102 ms long-poll: unpaid KUDOS:0.1 { t_s: 1792499882 } taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-D3VDQYD88AE8C/
```

Order creation, the public 402 with `taler_pay_uri`, and the `timeout_ms` long-poll (it held for 2.1 s while the order stayed unpaid) all work as the brief described.

### 3. The protected route answers 402 in both formats

`node src/taler/demo-server.ts`, then `curl -i http://127.0.0.1:8402/api/quote`:

```
HTTP/1.1 402 Payment Required
cache-control: no-store
content-type: application/problem+json
www-authenticate: Payment id="KJ30fbWNCL0vP9aOlI_gecrvLwJ8Ny-oaKpkG72q8pI", realm="127.0.0.1:8402", method="taler", intent="charge", expires="2026-10-20T12:45:40Z", description="arvuna demo: /api/quote", request="eyJhbW91bnQiOiIxMCIs…"
payment-required: eyJ4NDAyVmVyc2lvbiI6Mi…
```

`request` decoded (JCS-serialised):

```json
{"amount":"10","currency":"kudos","description":"arvuna demo: /api/quote","externalId":"2026.293-780D7DPPD3HEY","methodDetails":{"orderId":"2026.293-780D7DPPD3HEY","talerPayUri":"taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-780D7DPPD3HEY/"}}
```

`payment-required` decoded:

```json
{
  "x402Version": 2,
  "error": "PAYMENT-SIGNATURE header is required",
  "resource": { "url": "http://127.0.0.1:8402/api/quote", "description": "arvuna demo: /api/quote", "mimeType": "application/json" },
  "accepts": [{
    "scheme": "exact",
    "network": "taler:KUDOS",
    "amount": "10",
    "asset": "KUDOS",
    "payTo": "https://backend.demo.taler.net/instances/sandbox",
    "maxTimeoutSeconds": 599,
    "extra": { "orderId": "2026.293-780D7DPPD3HEY", "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-780D7DPPD3HEY/" }
  }]
}
```

The order id and pay URI come from a real order created on the demo merchant. `amount` is `10` because KUDOS has two fractional digits, so `KUDOS:0.1` is 10 base units. `arvuna-check` passes all 29 of its rules on this response (see [conformance-run.md](conformance-run.md)).

### 4. The wallet CLI reads the order (before funding)

The Taler wallet CLI is used as an external program only, in a throwaway Docker container (`tools/wallet/Dockerfile`); nothing from it is vendored or linked.

- Version: `taler-wallet-cli 1.6.46 d2192da12ca9a34ec78458420f3d35fd0d39e875`.
- **Deviation:** the npm package `@gnu-taler/taler-wallet-cli` was last published in 2022 (0.8.1), and the Taler apt repository's signing key published at taler.net expired on 2025-01-10, so apt refuses the repository. The image therefore downloads the `.deb` over TLS from `deb.taler.net` and checks its SHA-256 against the repository's `Packages` index. That is weaker than a signature check and is acceptable only for a throwaway dev tool.
- The wallet accepted `https://exchange.demo.taler.net/` as the KUDOS exchange and reported `KUDOS:0`.
- `taler-wallet-cli advanced pay-prepare <taler_pay_uri>` on an order from our server (it claims the order, moves no money) parsed the contract, matched it to the exchange and returned:

  ```
  "status": "insufficient-balance",
  "amountRaw": "KUDOS:0.1",
  "causeHint": "wallet-balance-available-insufficient"
  ```

- The full script, `node scripts/e2e-taler-demo.ts ietf`, then fails at the payment step with exactly:

  ```
  wallet balance before:
  KUDOS:0 in=KUDOS:0 out=KUDOS:0 @e:exchange.demo.taler.net

  === ietf ===  GET http://127.0.0.1:8402/api/quote
  402 received. order 2026.293-NV7MCY5GJR044
  paying with the wallet CLI ...
  FAILED: Command failed: scripts/taler-wallet.sh handle-uri -y taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-NV7MCY5GJR044/
  error: insufficient balance for the selected choice
  ```

That was the state before the wallet was funded: the wallet parsed the contract and the only failure reason it gave was the empty balance. Section 5 is what happened once it held KUDOS.

## 5. The paid run

### Funding the wallet

On 2026-10-20 a throwaway account was registered at bank.demo.taler.net by the maintainer, who created a withdrawal to a Taler wallet and confirmed it in the bank's web page. The wallet CLI (the same Docker image as above) was given the `taler://withdraw/…` link with `scripts/taler-wallet.sh handle-uri -y --withdrawal-exchange https://exchange.demo.taler.net/ '<link>'`. Observed:

- The wallet accepted the link: operation pending, `KUDOS:10`, exchange `https://exchange.demo.taler.net/`.
- It then stopped at the exchange's terms-of-service prompt (`-y` does not answer it when stdin is not a terminal), so the terms were accepted with `taler-wallet-cli exchanges accept-tos https://exchange.demo.taler.net/`, on the maintainer's `-y` instruction.
- The wallet process must stay alive for the withdrawal to progress: until `taler-wallet-cli wait-tx <withdrawal>` was running, the bank reported the operation as not yet selected. After the maintainer confirmed in the bank page: `matched done after 335.8s`, and the balance read `KUDOS:10 in=KUDOS:0 out=KUDOS:0 @e:exchange.demo.taler.net`.

### Attempt 1: IETF passes, x402 fails (a bug in this repository)

Raw output: [proof-taler-paid-run-raw-attempt1.txt](proof-taler-paid-run-raw-attempt1.txt).

- IETF: 402, wallet paid order `2026.293-CNZGQSBYQEPPY`, retry returned **HTTP 200** and the receipt `{"status":"success","method":"taler","timestamp":"2026-10-20T13:05:02Z","reference":"2026.293-CNZGQSBYQEPPY"}`.
- x402: 402 with order `2026.293-2KYJZCMZX8KY4`, but the wallet printed `Repurchase detected (txn:payment:SG06WP0B…)` and did not pay. The retry returned **HTTP 402**, `Order is not paid yet (status: claimed)`. The wallet balance fell by only 0.1 (to 9.9).
- Cause: the paywall gave every order the same `fulfillment_url` (the resource URL). The Taler wallet treats an order whose `fulfillment_url` matches one it already paid as the same purchase and will not pay it again, so a second purchase of the same resource could never be paid. The paywall was correct to refuse the unpaid order; the defect was in how it created orders.
- Fix: each order now gets a unique `fulfillment_url` (the resource URL plus an `arvuna_order=<uuid>` query parameter). The resource named in the 402 and checked on redemption is unchanged. A failing test was written first (`each order gets its own fulfillment_url…`, it failed before the change) and the suite then passed: 45 of 45.

### Attempt 2, after the fix: both formats pass

Raw output: [proof-taler-paid-run-raw.txt](proof-taler-paid-run-raw.txt). Both are second or later purchases of the same resource, the case that failed above.

```
wallet balance before:
KUDOS:9.9 in=KUDOS:0 out=KUDOS:0 @e:exchange.demo.taler.net

=== ietf ===  GET http://127.0.0.1:8402/api/quote
402 received. order 2026.293-Z2SX6Z5QR12R2
  taler_pay_uri taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-Z2SX6Z5QR12R2/
paying with the wallet CLI ...
Waiting for transaction 'txn:payment:EX3SEMWWKBSDCMYGETS6H9HHQGZJXHFH4QB2J143ZR750WK9ZZ00' to finish
Finished with status 'done'.
retry with ietf credential -> HTTP 200
receipt header decoded: {"status":"success","method":"taler","timestamp":"2026-10-20T13:06:02Z","reference":"2026.293-Z2SX6Z5QR12R2"}
body: {"message":"paid content","servedAt":"2026-10-20T13:06:02.348Z"}

=== x402 ===  GET http://127.0.0.1:8402/api/quote
402 received. order 2026.293-CXZDGE1S3PW1M
  taler_pay_uri taler://pay/backend.demo.taler.net/instances/sandbox/2026.293-CXZDGE1S3PW1M/
paying with the wallet CLI ...
Waiting for transaction 'txn:payment:G5DDX4706H4HQ6WY7PTQARNSKWR5QF6DB38RRHNZ0KXMGXGX3RQG' to finish
Finished with status 'done'.
retry with x402 credential -> HTTP 200
receipt header decoded: {"success":true,"transaction":"2026.293-CXZDGE1S3PW1M","network":"taler:KUDOS","amount":"10"}
body: {"message":"paid content","servedAt":"2026-10-20T13:06:05.866Z"}

wallet balance after:
KUDOS:9.7 in=KUDOS:0 out=KUDOS:0 @e:exchange.demo.taler.net
```

(The raw file also contains the wallet's contract printout, which is omitted above.)

### Checked at the merchant, not only on our server

`GET /instances/sandbox/private/orders/{id}` on `backend.demo.taler.net`, after the runs:

| Order | Run | Merchant `order_status` |
|---|---|---|
| `2026.293-CNZGQSBYQEPPY` | attempt 1, IETF | `paid`, `KUDOS:0.1` |
| `2026.293-2KYJZCMZX8KY4` | attempt 1, x402 (wallet refused as repurchase) | `claimed`, never paid |
| `2026.293-Z2SX6Z5QR12R2` | attempt 2, IETF | `paid`, `KUDOS:0.1` |
| `2026.293-CXZDGE1S3PW1M` | attempt 2, x402 | `paid`, `KUDOS:0.1` |

Wallet balance: 10 → 9.9 → 9.7, that is three payments of 0.1, matching the three paid orders.

### What this shows, and what it does not

Shown: a real Taler wallet paid a real merchant order that this prototype created, and the prototype verified the payment with the merchant and served the resource with a receipt, in both the IETF Payment format and the x402 v2 format. The unpaid order was refused.

Not shown: the paid run was done by one wallet, one resource and one merchant instance, on a demo exchange, with the paywall and the wallet on the same machine; the replay and tamper cases are covered by the offline tests, not re-run live; no Taler production exchange or real currency was involved; deposits to the merchant's bank account (`deposit_total` read `KUDOS:0` at the time of the check) were not examined.

## Limits of this prototype's Taler verification

These limits describe the prototype of the first two runs (sections 1 to 5). The prototype now follows draft-taler-charge-02 and some of them are gone: see "Paid run against -02" below for what it does and what is still missing.

- The server asks the merchant whether the order is paid; it does not look at any Taler token or deposit itself.
- An unauthenticated request creates one order on the merchant. There is no rate limit or order reuse yet.
- State (issued orders, used credentials) is in memory and is lost on restart.
- The x402 `PAYMENT-RESPONSE.transaction` field is documented as a blockchain hash; Taler has none, so the order id is used.

## Paid run against -02

The prototype was brought in line with [draft-taler-charge-02](specs/draft-taler-charge-02.md), and the paid run was repeated against the public Taler demo (`backend.demo.taler.net`) with the demo wallet: once in the IETF Payment format, once in x402, and each credential was then presented a second time. Demo money only (KUDOS on the public demo); no real exchange and no real money were involved. Sections 1 to 5 above are the record of the earlier runs and are kept unchanged. Where they say the client requests the token scope `order-full` or that every order's fulfillment URL has a random query parameter, the current code does what this section says.

### What changed in the code

| Gap | What the code does now | Tested by |
|---|---|---|
| 1. Exchanges | `methodDetails.exchanges` is `{url, masterPub}` for each exchange in the merchant's `/config` that is trusted for the order's currency | `exchange.test.ts`, "402 carries both formats" |
| 2. x402 network | `taler:` plus the first 32 characters of the exchange master public key, one `accepts[]` entry per listed exchange | "one accepts[] entry per listed exchange" |
| 3. Payment flow | `extra.paymentFlow` is `"upfront"` and `extra` holds only that and `talerPayUri`; a requirement without it is refused | "a requirement without paymentFlow upfront is refused" |
| 4. Payload and settle | payload `{orderId, hContract}`; the client takes `hContract` from the wallet's payment record (`info.contractTermsHash`); settle asks the public `GET orders/$ORDER_ID?h_contract=...` with no credential | "x402 settles on {orderId, hContract} with the PUBLIC order status" |
| 5. Consumption key | `network + ":" + orderId` in a SQLite file, inserted atomically in one transaction with the order's redeemed flag, kept until the later of the pay and refund deadlines | store tests; "a restart does not forget a used proof" |
| 6. Contract exchanges | every exchange in the paid contract must be in the advertised list, in both formats | "a paid contract that names an exchange the challenge did not list is refused" |
| 7. Claim token | orders are created with `create_token` on; the token reaches the client only inside the Taler Pay URI | "the claim token travels only inside the Taler Pay URI" |
| 8. Fulfillment | `fulfillment_url` ends in `?order=${ORDER_ID}` and the backend substitutes the id; the refund deadline is set explicitly (pay deadline plus one hour) | "fulfillment_url uses the ${ORDER_ID} placeholder" |
| 9. Unit | taken from the exchange's `/keys` (`num_fractional_input_digits`), 10^-8 when none is published or they differ; the merchant's `/config` is not used | "the unit comes from the exchange" |
| 10. Token scope | `order-simple` (orders-read and orders-write), instead of `order-full` | "the login token is requested with the narrowest scope" |
| 11. `payTo` | the merchant base URL derived from the Taler Pay URI, trailing slash included | "402 carries both formats" |
| 12. Errors | the ten settlement reasons of the draft | "every settlement error reason is produced" |

The paywall also checks the paid contract through the private status (amount, merchant, fulfillment URL, exchange list, refund status) before it consumes an x402 proof, as the draft advises for a server with private access, and the IETF receipt time is the merchant's `last_payment`.

Tests: 45 before, 61 now (11 common, 17 checker, 3 pay URI, 3 store, 4 exchange, 23 paywall and client), all passing, and `tsc` is clean. Five deliberate breaks of the code (never claim a proof, skip the contract exchange check, use the whole master key as the network, request the `order-full` scope, take the unit from the first exchange only) were each caught by the test written for it.

### The 402 the prototype now sends

From the demo server running against the demo backend (the claim token is masked here; the order was not paid):

```json
{
  "amount": "10",
  "currency": "kudos",
  "description": "arvuna demo: /api/quote",
  "externalId": "2026.294-VW4R4WM6TX7N4",
  "methodDetails": {
    "exchanges": [{ "masterPub": "F80MFRG8HVH6R9CQ47KRFQSJP3T6DBJ4K1D9B703RJY3Z39TBMJ0", "url": "https://exchange.demo.taler.net/" }],
    "merchantBaseUrl": "https://backend.demo.taler.net/instances/sandbox/",
    "orderId": "2026.294-VW4R4WM6TX7N4",
    "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.294-VW4R4WM6TX7N4/?c=<claim token>"
  }
}
```

and the decoded `PAYMENT-REQUIRED`:

```json
{
  "accepts": [{
    "amount": "10",
    "asset": "KUDOS",
    "extra": {
      "paymentFlow": "upfront",
      "talerPayUri": "taler://pay/backend.demo.taler.net/instances/sandbox/2026.294-VW4R4WM6TX7N4/?c=<claim token>"
    },
    "maxTimeoutSeconds": 598,
    "network": "taler:F80MFRG8HVH6R9CQ47KRFQSJP3T6DBJ4",
    "payTo": "https://backend.demo.taler.net/instances/sandbox/",
    "scheme": "exact"
  }],
  "error": "PAYMENT-SIGNATURE header is required",
  "resource": { "description": "arvuna demo: /api/quote", "mimeType": "application/json", "url": "http://127.0.0.1:8402/api/quote" },
  "x402Version": 2
}
```

### The run

`npm run e2e` against a fresh store. Raw output: [proof-taler-paid-run-02-raw.txt](proof-taler-paid-run-02-raw.txt).

```

> arvuna@0.0.1 e2e
> node scripts/e2e-taler-demo.ts

wallet balance before:
KUDOS:9.7 in=KUDOS:0 out=KUDOS:0 @e:exchange.demo.taler.net

=== ietf ===  GET http://127.0.0.1:8402/api/quote
402 received. order 2026.294-063HKCN4RQXMM
  exchanges listed: https://exchange.demo.taler.net/
  taler_pay_uri taler://pay/backend.demo.taler.net/instances/sandbox/2026.294-063HKCN4RQXMM/?c=<claim token>
paying with the wallet CLI ...
}
Waiting for transaction 'txn:payment:P5D1FHM3DTN3A4HT0H6804NPHFQ4EQ8DAKQT7HEAEBP7Z98KZ97G' to finish
Finished with status 'done'.
retry with ietf credential -> HTTP 200
receipt header decoded: {"status":"success","method":"taler","timestamp":"2026-10-21T09:20:28Z","reference":"2026.294-063HKCN4RQXMM"}
body: {"message":"paid content","servedAt":"2026-10-21T09:20:38.718Z"}
merchant order_status for 2026.294-063HKCN4RQXMM: paid
REPLAY of the same ietf credential -> HTTP 402 https://paymentauth.org/problems/invalid-challenge
order id: 2026.294-063HKCN4RQXMM

=== x402 ===  GET http://127.0.0.1:8402/api/quote
402 received. order 2026.294-QBWSJ3XQ0ZNR4
  exchanges listed: (none)
  taler_pay_uri taler://pay/backend.demo.taler.net/instances/sandbox/2026.294-QBWSJ3XQ0ZNR4/?c=<claim token>
paying with the wallet CLI ...
}
Waiting for transaction 'txn:payment:7CHMPXX373N1J55T5WFWFKQNHT62KCY1XWC4C0MBGNHEH4E3E3BG' to finish
Finished with status 'done'.
retry with x402 credential -> HTTP 200
receipt header decoded: {"amount":"10","network":"taler:F80MFRG8HVH6R9CQ47KRFQSJP3T6DBJ4","success":true,"transaction":"2026.294-QBWSJ3XQ0ZNR4"}
body: {"message":"paid content","servedAt":"2026-10-21T09:20:43.089Z"}
merchant order_status for 2026.294-QBWSJ3XQ0ZNR4: paid
REPLAY of the same x402 credential -> HTTP 402 duplicate_settlement
order id: 2026.294-QBWSJ3XQ0ZNR4

wallet balance after:
KUDOS:9.5 in=KUDOS:0 out=KUDOS:0 @e:exchange.demo.taler.net
```

(The single `}` lines are the end of the wallet's own printout of the contract, which the script shortens to its last lines.)

| | IETF Payment | x402 |
|---|---|---|
| Order | `2026.294-063HKCN4RQXMM` | `2026.294-QBWSJ3XQ0ZNR4` |
| Wallet paid, then the retry returned | HTTP 200 and `Payment-Receipt` | HTTP 200 and `PAYMENT-RESPONSE` |
| Merchant `order_status`, read by the script | `paid` | `paid` |
| The same credential presented again | HTTP 402, `invalid-challenge` | HTTP 402, `duplicate_settlement` |

The wallet balance went from 9.7 to 9.5, two payments of 0.1.

### Checked at the merchant afterwards

Asked directly with a fresh `order-simple` login token (`GET /instances/sandbox/private/orders/{id}`), not through the prototype:

| | IETF order | x402 order |
|---|---|---|
| `order_status` | `paid` | `paid` |
| `contract_terms.fulfillment_url` | `http://127.0.0.1:8402/api/quote?order=2026.294-063HKCN4RQXMM` | `http://127.0.0.1:8402/api/quote?order=2026.294-QBWSJ3XQ0ZNR4` |
| `refund_deadline` minus `pay_deadline` | 3600 s | 3600 s |
| `contract_terms.exchanges` | the demo exchange, master key `F80MFRG8HV...TBMJ0` | the same |
| `merchant_base_url` | `https://backend.demo.taler.net/instances/sandbox/` | the same |
| `last_payment` | `2026-10-21T09:20:28Z`, the receipt time | `2026-10-21T09:20:41Z` |

### The conformance checker on this 402

`node src/conformance/cli.ts http://127.0.0.1:8402/api/quote` reported 29 pass, 0 fail, 0 warn: see [conformance/arvuna-taler-prototype.md](conformance/arvuna-taler-prototype.md). The checker is generic and does not know the draft's own fields (the exchange list, the network reference, the payment flow, the payload); those are covered by the tests above and by `scripts/check-spec-examples.py` on the draft.

### What this shows, and what it does not

Shown: with the prototype following draft -02, a real Taler wallet paid a real demo order in each format, the paywall verified the payment with the merchant backend (x402 through the public order status with the wallet's contract hash, and no merchant credential), served the resource with a receipt, and refused a second presentation of each credential.

Not shown, and still missing against the draft:

- The restart case was tested with the store, and in the paywall tests with a file-backed store, but not in this live run.
- The live demo has one exchange for KUDOS. Several exchanges, differing units and a missing specification are tested only against the offline stand-in.
- There is no separate facilitator: the resource server settles against its own merchant backend. The draft's note that a facilitator can do it with the public status alone is not exercised.
- Per-product fulfillment URLs (repurchase detection) and orders with a `fulfillment_message` are not implemented, and the browser case (a session-bound payment) is not either.
- Refunds are not granted by the prototype; it sets the refund deadline and refuses an order refunded in full.
- Orders are still created on every unauthenticated request, with no rate limit, no reuse of an open order and no removal of expired unpaid orders.
- The consumption key is not prefixed with the merchant base URL, which the draft suggests for a store shared by several merchant instances; this store serves one.
- The store is a single SQLite file for one process.
- The merchant payment signature (draft question OQ-11) is not used; the proof check relies on the public order status.
