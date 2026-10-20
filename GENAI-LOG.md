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

New entries are added here whenever generated content goes into a commit, with the model, how it was used and a summary of the prompts and outputs.
