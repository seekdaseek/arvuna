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
- **Review and testing:** the code was written against the spec text (draft-httpauth-payment-01 and x402 v2), which the model fetched and read during the session. The three HMAC test vectors published in the draft pass, which is an independent check on the challenge binding. `npm test` and `tsc` ran with the output observed. The maintainer has not yet read the code line by line; this entry will be updated when that review is done.
- **Prompts and outputs:** summary only. One brief asking for a Taler method prototype and a conformance checker; the model returned the files listed above.

### 2026-10-20: Taler merchant client and dual-format paywall
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** `src/taler/` (an HTTP-only client for the GNU Taler merchant backend API, amount conversion, the paywall that answers 402 in both the IETF Payment format and x402 v2 and verifies the retry, an offline fake merchant for tests, a demo server) and `scripts/probe-merchant.ts`, with their tests.
- **Human part:** the maintainer's brief set the architecture: talk to Taler over HTTP only, no Taler library, both formats on one route.
- **Review and testing:** field names were taken from the fetched spec text and the merchant API documentation, and the merchant endpoints were probed live on backend.demo.taler.net before the client was written. 23 tests pass. Three deliberate code breaks (never mark a credential used, accept unpaid orders, skip the challenge-binding check) were each caught by a failing test, so the tests do detect those faults. The live demo server returned a real 402 backed by a real KUDOS order. The maintainer has not yet read the code line by line; this entry will be updated when that review is done.
- **Prompts and outputs:** summary only. Continuation of the same brief; the model returned the files listed above.

### 2026-10-20: conformance checker prototype
- **Model:** `claude-sonnet-5-5`, as reported by Claude Code at the time.
- **Used for:** `src/conformance/` (the `arvuna-check` command-line tool: a request observer that never sends a credential, rule checks for the IETF Payment challenge and for the x402 v2 payment requirement, report rendering) and its tests.
- **Human part:** the maintainer's brief fixed what the tool may and may not do: one request, expect 402, never pay, never send a credential, cite the spec for every rule.
- **Review and testing:** every rule was written from the fetched spec text and cites its section. The tests use fixtures copied from the specifications as the known-good side and deliberately broken variants as the known-bad side, so each rule is shown to be able to fail. 40 tests pass in total. The maintainer has not yet read the code line by line; this entry will be updated when that review is done.
- **Prompts and outputs:** summary only. Continuation of the same brief; the model returned the files listed above.

New entries are added here whenever generated content goes into a commit, with the model, how it was used and a summary of the prompts and outputs.
