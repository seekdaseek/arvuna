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
- **Review and testing:** every command in the table and every output block was run for real before it was written down: `npm test` (45 of 45), the checker against a public endpoint, the demo server's start line, the merchant-side `paid` check for both order ids, and the two `FAIL` rows for the findings. The one observation timestamp in the checker output is replaced by an ellipsis, and the README says so. Maintainer review of this change: not recorded yet.
- **Prompts and outputs:** summary only. One brief asking for the README polish and the licence; the model returned the edits above.

### 2026-10-20: roadmap and README brought in line with the six-milestone proposal
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** rewriting the milestone list in `docs/ROADMAP.md` (six milestones with hours) and adding items 5 and 6 to "What arvuna adds" in `README.md`.
- **Human part:** the maintainer decided the milestones, their names and hours, and described the content of M4 and M5; the model wrote the prose from the project's business plan and the brief.
- **Review and testing:** the hours were checked to add up to the total in the plan (1,140). No code changed; `npm test` still passes 45 of 45 and the personal-information search of the tree is empty. Maintainer review of this change: not recorded yet.
- **Prompts and outputs:** summary only. One brief asking for the repository to match the proposal; the model returned the edits above.

New entries are added here whenever generated content goes into a commit, with the model, how it was used and a summary of the prompts and outputs.
