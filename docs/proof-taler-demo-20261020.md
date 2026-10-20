# Taler method prototype: proof run, 2026-10-20

**Status: the paid step has NOT been run.** Everything up to the payment runs live against the public GNU Taler demo. The payment itself needs demo KUDOS in a wallet, and getting demo KUDOS needs a (free, throwaway) account at bank.demo.taler.net. That account has to be created by a person, so this document records the blocker and the exact steps that finish the run. No result below is claimed beyond what is shown.

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

The order id and pay URI come from a real order created on the demo merchant. `amount` is `10` because KUDOS has two fractional digits, so `KUDOS:0.1` is 10 base units. `arvuna-check` passes all 29 of its rules on this response (see [conformance-run-20261020.md](conformance-run-20261020.md)).

### 4. The wallet CLI reads the order

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

That is the blocker. The wallet parsed the contract and the failure reason it gives is the empty balance; whether the payment then completes has not been observed.

## Why the run stops here

Demo KUDOS come from `https://bank.demo.taler.net/`, which requires registering a bank account (registration is open, `allow_registrations: true`) and confirming each withdrawal while logged in. Registering an account on a third-party service and signing in to it is a step this work does not do automatically, so it is left to the maintainer.

## Finishing the run (about two minutes, by hand)

1. In a browser, register a throwaway account at https://bank.demo.taler.net/ and log in. Use a password you do not use anywhere else.
2. In the bank's web page choose to withdraw to a Taler wallet, and copy the `taler://withdraw/…` link it shows.
3. Terminal 1: `npm run demo`
4. Terminal 2, withdraw (confirm the withdrawal in the bank page while this runs):

   ```
   scripts/taler-wallet.sh handle-uri -y --withdrawal-exchange https://exchange.demo.taler.net/ 'taler://withdraw/…'
   scripts/taler-wallet.sh balance --pretty
   ```

5. Terminal 2, the paid run for both formats:

   ```
   npm run e2e 2>&1 | tee docs/proof-taler-paid-run-raw.txt
   ```

   Expected: for each format a 402, a payment through the wallet, a retry that returns `HTTP 200`, and a decoded receipt (`Payment-Receipt` for the IETF format, `PAYMENT-RESPONSE` for x402). The second order is a fresh one, so the first receipt does not satisfy it.

Until that has been run and its output pasted here, treat the paid flow as **not demonstrated end to end**. What is demonstrated: both 402 formats against a real merchant order (section 3), the paid-order verification and receipts against a faithful offline stand-in for the merchant (`src/taler/paywall.test.ts`, 16 tests), and the wallet recognising the order (section 4).

## Limits of this prototype's Taler verification

- The server asks the merchant whether the order is paid; it does not look at any Taler token or deposit itself.
- An unauthenticated request creates one order on the merchant. There is no rate limit or order reuse yet.
- State (issued orders, used credentials) is in memory and is lost on restart.
- The x402 `PAYMENT-RESPONSE.transaction` field is documented as a blockchain hash; Taler has none, so the order id is used.
