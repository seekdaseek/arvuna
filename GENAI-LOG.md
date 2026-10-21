# Generative AI use in arvuna

This log records every substantive use of generative AI in this project. It follows the NLnet Foundation's policy on generative AI, v1.1. The maintainer directs the work, reviews every output and is responsible for everything committed here.

## Model

Anthropic Claude, used through the Claude app, configured as `claude-opus-5-5`. The serving model can differ from the configured one; each entry records what the app reported at the time.

## Entries

### 2026-10-20: research and the first README
- **Used for:**
  - research into the HTTP 402 standards, GNU Taler, SEPA Instant settlement and prior work;
  - fact-checking;
  - a first draft of `README.md` and of this file.
- **Human part:**
  - the scope, the milestones, the design rules and the project name were the maintainer's decisions;
  - the maintainer reviewed and edited the README before committing it.
- **Prompts and outputs:** summary only. The research covered the IETF draft-httpauth-payment-01 method registry, x402 v2 scheme rules, the Taler merchant 402 response and paivana, LibEuFin's Bank Revenue API, the EU Instant Payments Regulation and the EPC QR standard. No code was generated.

### 2026-10-20: prototype scaffold and shared encoding code
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** the TypeScript project scaffold (`package.json`, `tsconfig.json`), `src/common/` (base64 and base64url helpers, JSON Canonicalization, a `WWW-Authenticate` parser, the HMAC challenge binding) and its unit tests, plus fixtures copied from the two specifications, and `tools/wallet/Dockerfile` (a throwaway container that installs the GNU Taler wallet CLI as an external dev tool).
- **Human part:** the maintainer wrote the brief, which fixed the language, the licensing constraints and the scope.
- **Review and testing:** the code was written against the spec text (draft-httpauth-payment-01 and x402 v2), which the model fetched and read during the session. The three HMAC test vectors published in the draft pass, which is an independent check on the challenge binding. `npm test` and `tsc` ran with the output observed. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. One brief asking for a Taler method prototype and a conformance checker; the model returned the files listed above.

### 2026-10-20: Taler merchant client and dual-format paywall
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** `src/taler/` (an HTTP-only client for the GNU Taler merchant backend API, amount conversion, the paywall that answers 402 in both the IETF Payment format and x402 v2 and verifies the retry, an offline fake merchant for tests, a demo server) and `scripts/probe-merchant.ts`, with their tests.
- **Human part:** the maintainer's brief set the architecture: talk to Taler over HTTP only, no Taler library, both formats on one route.
- **Review and testing:** field names were taken from the fetched spec text and the merchant API documentation, and the merchant endpoints were probed live on backend.demo.taler.net before the client was written. 23 tests pass. Three deliberate code breaks (never mark a credential used, accept unpaid orders, skip the challenge-binding check) were each caught by a failing test, so the tests do detect those faults. The live demo server returned a real 402 backed by a real KUDOS order. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. Continuation of the same brief; the model returned the files listed above.

### 2026-10-20: conformance checker prototype
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** `src/conformance/` (the `arvuna-check` command-line tool: a request observer that never sends a credential, rule checks for the IETF Payment challenge and for the x402 v2 payment requirement, report rendering) and its tests.
- **Human part:** the maintainer's brief fixed what the tool may and may not do: one request, expect 402, never pay, never send a credential, cite the spec for every rule.
- **Review and testing:** every rule was written from the fetched spec text and cites its section. The tests use fixtures copied from the specifications as the known-good side and deliberately broken variants as the known-bad side, so each rule is shown to be able to fail. 40 tests pass in total. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. Continuation of the same brief; the model returned the files listed above.

### 2026-10-20: reference client, end-to-end and conformance run scripts
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** `src/taler/client.ts` (a reference client that reads the 402, pays through an injected function and retries with the right credential), `scripts/e2e-taler-demo.ts`, `scripts/taler-wallet.sh`, `scripts/run-conformance.ts`, and four added tests.
- **Human part:** the maintainer's brief; the paid step itself needs a person and was not run by the model.
- **Review and testing:** the client is tested against the paywall in both formats, with a payment stand-in; the end-to-end script was run once and failed at the payment step for want of demo money, and that output is recorded as it was. `scripts/run-conformance.ts` ran against six public endpoints and its output is kept under `docs/conformance/`. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. Continuation of the same brief.

### 2026-10-20: proof and conformance documents, README status, roadmap
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** drafting `docs/proof-taler-demo.md`, `docs/conformance-run.md`, `docs/ROADMAP.md`, the generated per-target tables in `docs/conformance/`, and the Status section of `README.md`.
- **Human part:** the milestone descriptions in the roadmap are the maintainer's, taken from the project notes; the model wrote the prose around them. The findings were each re-checked against the raw responses before being written down.
- **Review and testing:** every output quoted in the documents was produced by a command run during the session. Counts in the documents (44 tests, 6 targets) were checked against the actual test and run output. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. Continuation of the same brief.

### 2026-10-20: unique fulfillment URL per order (fix found by the paid run)
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** diagnosing why the second paid attempt in the live run was refused by the Taler wallet (`Repurchase detected`), a failing test that reproduces the cause, and the fix in `src/taler/paywall.ts` (each order's `fulfillment_url` now carries a unique query parameter).
- **Human part:** the maintainer created the demo bank account, made the withdrawal and confirmed it in the bank's web page, and instructed the terms-of-service acceptance; the model ran the wallet and the end-to-end script.
- **Review and testing:** the test was written first and failed before the change; afterwards `npm test` passed 45 of 45 and the live run was repeated: both formats paid and returned `200` with a receipt, and the merchant backend reports those orders as paid. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. Instruction to finish the paid run per the proof document; the model returned the fix, the test and the transcript.

### 2026-10-20: proof document rewritten from the paid run
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** rewriting `docs/proof-taler-demo.md` around the real transcripts (both attempts, the bug, the merchant-side check), and updating the status lines in `README.md`, `docs/ROADMAP.md` and `docs/conformance-run.md`.
- **Human part:** none of the facts were supplied by the model from memory: every quoted line comes from the raw transcript files `docs/proof-taler-paid-run-raw*.txt` or from the merchant backend queries shown. Reviewed by the maintainer.
- **Review and testing:** the raw transcripts were scanned for personal data and secrets before publication (none found). Stale statements ("not run", test counts) were located with a search and corrected.
- **Prompts and outputs:** summary only.

### 2026-10-20: README verify table, real expected output, licence file
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** the "Verify in five minutes" table and the "Expected output" blocks in `README.md`, the licence line, and the `license` field in `package.json`. The `LICENSE` file is the unmodified Apache License 2.0 text downloaded from apache.org (11,358 bytes, byte-identical to the download), not generated.
- **Human part:** the maintainer decided the licence (Apache-2.0 for code, CC BY 4.0 for specifications) and the structure of the README changes.
- **Review and testing:** every command in the table and every output block was run for real before it was written down: `npm test` (45 of 45), the checker against a public endpoint, the demo server's start line, the merchant-side `paid` check for both order ids, and the two `FAIL` rows for the findings. The one observation timestamp in the checker output is replaced by an ellipsis, and the README says so. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. One brief asking for the README polish and the licence; the model returned the edits above.

### 2026-10-20: roadmap and README brought in line with the six-milestone proposal
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** rewriting the milestone list in `docs/ROADMAP.md` (six milestones with hours) and adding items 5 and 6 to "What arvuna adds" in `README.md`.
- **Human part:** the maintainer decided the milestones, their names and hours, and described the content of M4 and M5; the model wrote the prose from the project's business plan and the brief.
- **Review and testing:** the hours were checked to add up to the total in the plan (1,140). No code changed; `npm test` still passes 45 of 45 and the personal-information search of the tree is empty. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. One brief asking for the repository to match the proposal; the model returned the edits above.

### 2026-10-20: draft-taler-charge-00, the taler method specification
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** drafting `docs/specs/draft-taler-charge-00.md` (a payment method specification for the IETF Payment scheme, in the structure of the upstream method template and the Stripe and Lightning method specifications, with an appendix mapping the flow to x402 version 2) and `scripts/check-spec-examples.py` (a script that checks every encoded example in a specification against the JSON shown under it).
- **Human part:** the maintainer's brief set the scope, the rule that every statement about the Taler merchant backend must cite the Taler documentation or be marked OPEN QUESTION, and that nothing is sent to the Taler developers before the maintainer has read and approved it.
- **Review and testing:** the model read the upstream template, the core scheme, the charge intent and two existing methods, and the Taler merchant API and common API documentation, and queried the public Taler demo backend for the fields of a paid order. Every claim about the backend names the documentation section it comes from; nine points the documentation does not settle are marked OPEN QUESTION (OQ-1 to OQ-9) and listed in an appendix. The encoded examples were generated from the JSON shown, and the check script reports 0 mismatches on them; it was shown to fail on five deliberately broken copies. The upstream tooling (`make lint`, `make check`) was run on a copy of the file placed in a clone of the upstream repository, uncommitted, and both passed. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. One brief asking for the draft; the model returned the specification and the script.

### 2026-10-21: draft-taler-charge-01, the taler method specification after Taler review
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** writing `docs/specs/draft-taler-charge-01.md` as the revision of version 00 (version 00 is kept), and extending `scripts/check-spec-examples.py` with a check of the Taler Pay URI derivation rule.
- **Human part:** the maintainer's brief listed the changes, one per point of the review of version 00 by the GNU Taler developers, and decided that the amount unit stays an open question addressed to them.
- **Review and testing:** before writing, the model read the Taler repurchase and refund tutorials, LSD 0006, RFC 8905, the Paivana operator manual, the wirewatch manual page and the exchange API documentation, and checked the brief's claims against them. Three claims did not hold as stated and the text says what the sources say: RFC 8905 does not state that currency codes are case-insensitive; no source states that a refund deadline of 0 is special; and the merchant documentation calls the currency specification a rendering hint. Behaviour of the public Taler demo backend that the text reports as observed (claim token in the pay URI, refused claims, the order identifier placeholder, deletion of unpaid orders) was probed live. The encoded examples were generated from the JSON shown; `scripts/check-spec-examples.py` reports 0 mismatches and fails on deliberately broken copies (five for the encodings, four for the derivation rule). The upstream tooling was run on an uncommitted copy in a clone of the upstream repository: `make lint` first failed on an unquoted version number, which was fixed, and then both `make lint` and `make check` passed. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. One brief with eight review points; the model returned the revised specification and the script change.

### 2026-10-21: draft-taler-charge-02, exchange identity and the x402 client-submitted family
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** writing `docs/specs/draft-taler-charge-02.md` as the revision of version 01 (versions 00 and 01 are kept), and extending `scripts/check-spec-examples.py` with checks of the exchange list, the x402 network reference, the payment flow and the payload.
- **Human part:** the maintainer's brief listed the seven changes and the sources, and decided that the amount unit stays an open question addressed to the GNU Taler developers.
- **Review and testing:** before writing, the model read the x402 specification sections on payment flows and settle, the `exact` scheme and its client-submitted family, the Lightning mechanism that defines its own namespace, the CAIP-2 and BIP-122 namespace documents, the Taler mailing list post, the merchant, exchange and common API documentation, and the bundled wallet-core code. It checked the brief's claims against them, and probed the public Taler demo backend for what the text reports as observed: the exchange list and master key in the merchant configuration and the exchange keys, the public order status with a right, a wrong and no contract hash, and the status of a claimed but unpaid order. The wallet's payment record turned out to expose the contract hash, which the brief did not say. The brief's own phrase for the retention bound was read as the later of the two deadlines, since the deadlines are absolute times. The encoded examples were generated from the JSON shown; `scripts/check-spec-examples.py` reports 0 mismatches and fails on deliberately broken copies for each new check. The upstream tooling was run on an uncommitted copy in a clone of the upstream repository: the first `make check` failed because the model's own line-wrapping had split a heading from its anchor, which was fixed, and then `make lint` and `make check` both passed. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. One brief with seven changes; the model returned the revised specification and the script change.

### 2026-10-21: prototype brought to draft-taler-charge-02, paid run in both formats
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** rewriting the prototype in `src/taler/` to follow the draft (the paywall and its settle procedure, the merchant client, a SQLite store, exchange discovery, a pay-URI parser, the reference client, the offline stand-in for the merchant and its exchanges), the demo server, the end-to-end and probe scripts, 16 more tests, and the documentation changes: a new section of `docs/proof-taler-demo.md`, a section of `docs/conformance/arvuna-taler-prototype.md`, the README and the roadmap.
- **Human part:** the maintainer's brief listed the twelve gaps, fixed the draft as the authority, and set the rules for the paid run (demo money only, no run claimed that was not observed).
- **Review and testing:** the suite went from 45 to 61 tests, all passing, and `tsc` is clean. Five deliberate breaks of the code, one each for a different gap, were each caught by the test written for it. Behaviour of the public Taler demo backend that the code relies on was checked live before it was written (the `order-simple` token scope, an explicit refund deadline, the `${ORDER_ID}` placeholder, the claim token in the pay URI, the exchange list in the contract terms). The paid run used the demo wallet and demo money: both formats were paid, the merchant backend reports both orders as paid, and a second presentation of each credential was refused. The merchant status of both orders was then read again directly, without the prototype. The model found a defect in its own client (an x402 failure record was reported as a receipt), a hang when a name pattern filtered every test of a file that started a server outside any test, and a README command that would have matched no test after a rename; all three were fixed. Two points where the draft is silent are reported to the maintainer and the draft was not edited: which HTTP status a failed settle returns, and that the single-use record must be per order across the two formats. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. One brief with twelve gaps and a paid run; the model returned the code, the tests, the transcripts and the documentation.

### 2026-10-21: draft-taler-charge-03 after the Taler answers, and the prototype brought to it
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** writing `docs/specs/draft-taler-charge-03.md` as the revision of version 02 (versions 00 to 02 are kept); extending `scripts/check-spec-examples.py` (amount and `talerAmount` agreement, the payload with `merchantSig`, and a check of the merchant-signature test vector, including an Ed25519 verification with OpenSSL); changing the prototype in `src/taler/` (a fixed 10^-8 unit, `talerAmount` on both sides, the client's amount check, a Crockford codec, verification of an optional `merchantSig`, the cross-format credential in the client, a 400 for an x402 payload that is not a `PaymentPayload`), the tests, the end-to-end script, and the documentation: a new section of `docs/proof-taler-demo.md`, a section of `docs/conformance/arvuna-taler-prototype.md`, the README and the roadmap.
- **Human part:** the maintainer's brief listed the six changes, named the sources (the replies of the GNU Taler developer on the mailing list, the Taler source for the signature layout and the amount documentation), and set the rules for the paid run (demo money only, no run claimed that was not observed).
- **Review and testing:** before writing, the model read the archived replies, `merchant_signatures.c` and `taler_signatures.h` of the exchange repository, the Taler documentation on amounts, signatures and the contract terms, RFC 8905 and the x402 HTTP transport, and checked the brief against them. It looked for a real test vector instead of making a key: the demo wallet's database stores the merchant's payment signature of every paid purchase, and five of them verified as Ed25519 over `size 72, purpose 1104, contract hash` under the `merchant_pub` of the stored contract terms; one bit changed in the message, key or signature made each fail, and OpenSSL gave the same answers. That vector is in `src/taler/testdata`, in the draft's appendix, and tested. Two findings changed the text: the signature covers the contract hash and not the order identifier, so the draft allows skipping the public status read only for a server that knows the hash of its own order, and the prototype does not skip it (a test presents a real signature of another contract under a fresh order and it is refused); and the x402 HTTP transport maps an invalid payment payload to 400, where the prototype answered 402, which was fixed. The grammar of the Taler documentation differs from RFC 8905 in three details and the draft follows the documentation and says so. The suite went from 61 to 70 tests, all passing, and `tsc` is clean. Eight deliberate breaks of the code were run on a scratch copy; seven were caught by existing tests and the eighth (digits allowed in a currency code) was not, so tests were added and it is caught now. The example checker was shown to fail on five deliberately broken copies of the draft (a wrong amount, a `talerAmount` with too many digits, a wrong currency, a changed purpose in the signed message, a changed signature). The paid run used the demo wallet and demo money: three orders were paid (IETF, x402, and x402 with `merchantSig` read from the wallet database, which is not an interface), the merchant backend reports all three as `paid`, and for each the same credential and the other format's credential were refused. The upstream tooling was run on an uncommitted copy in a clone of the upstream repository, which was removed afterwards: `make lint` and `make check` both passed. The model made three mistakes of its own on the way, all found by running things and fixed: it first decoded the Base32 with the padding at the front of the string instead of the end, so no signature verified; a test harness that threw in its constructor left a server open and hung the suite; and a negative test of the checker used GNU `sed` syntax that BSD `sed` rejects, which made it pass vacuously until redone in Python. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. One brief with six changes and a paid run; the model returned the specification, the script change, the code, the tests, the transcripts and the documentation.

### 2026-10-21: roadmap M2 row aligned with the proposal
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** replacing the text cell of the M2 row of `docs/ROADMAP.md` with the wording of the approved proposal text, and recording the maintainer's review of the four earlier changes in this log.
- **Human part:** the wording is the maintainer's approved milestone 2 text from the proposal, and he read this row before the brief was run. The row no longer names an eCHF exchange, which the proposal dropped.
- **Review and testing:** the model changed nothing but the M2 text cell and the review sentences, searched the README and `docs/` for other mentions of the dropped item and left them as they were, and re-ran the test suite and the README link check. Reviewed by the maintainer.
- **Prompts and outputs:** summary only. One brief; the model returned the one-row change and the log edits.

New entries are added here whenever generated content goes into a commit, with the model, how it was used and a summary of the prompts and outputs.
