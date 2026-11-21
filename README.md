# From a Mastra agent to a verified receipt in under ten minutes

A small [Mastra](https://mastra.ai) agent (TypeScript) wired to
[Reede](https://github.com/NMA-vc/reede) through Mastra's OpenTelemetry exporter. It runs on a
mock model, so it needs **no API key and makes no network model call**. Reede seals every span
the agent emits into a signed, hash-chained receipt that you verify offline.

What you get is a **reported** receipt: it proves what the agent reported and when this machine
sealed it. It does not prove the report is true, and it carries no trusted timestamp (signed, not
timestamped). A hosted Reede path is coming; this is the local, open-source flow.

Repository: <https://github.com/NMA-vc/mastra-to-reede>. The one helper it uses,
[`@reede/otel`](https://github.com/NMA-vc/reede-otel), is installed from GitHub (not on npm yet).

## Steps

Needs Node 20+ and a Rust toolchain (for step 1 only).

**1. Install reede** (one-off compile; the crate is not on crates.io yet):

```text
cargo install --git https://github.com/NMA-vc/reede --features ingest
```

Once published, `cargo install reede --features ingest` does the same.

**2. Get the example and its pinned dependencies:**

```text
git clone https://github.com/NMA-vc/mastra-to-reede && cd mastra-to-reede
npm install
```

**3. Start the receipt server** (own terminal; OTLP/HTTP on 127.0.0.1:4318):

```text
reede serve --out ./ingest
```

**4. Run the agent.** The whole integration is one exporter in the Observability config
(`agent.js`):

```js
import { reedeOtel } from '@reede/otel';          // { endpoint, headers }
const { endpoint, headers } = reedeOtel();         // default http://127.0.0.1:4318, no auth

new Observability({ configs: { reede: { serviceName: 'my-agent', exporters: [
  new OtelExporter({ provider: { custom: { endpoint, headers, protocol: 'http/protobuf' } } }),
] } } })
```

`endpoint` is a base URL; the exporter appends `/v1/traces`. Use `protocol: 'http/protobuf'`:
`reede serve` takes protobuf or JSON over HTTP, no gRPC. Without the helper, just write the
endpoint yourself.

```text
node agent.js
```

The `reede serve` terminal prints `sealed receipts seq 1..N`.

**5. Check the sealed spans against their receipts:**

```text
reede ingest check --out ./ingest --pubkey "$(cat ingest/pubkey.hex)"
```

**6. Verify the chain offline:**

```text
reede receipt verify --chain ingest/chain.json --pubkey "$(cat ingest/pubkey.hex)"
```

Expected ending:

```text
CHAIN:      VERIFIED
SIGNATURES: VERIFIED
HASH:       VERIFIED
TIMESTAMP:  ABSENT
VERDICT:    SIGNED, NOT TIMESTAMPED (authentic; not fully qualified evidence)
```

## What the verdict means

- **CHAIN / SIGNATURES / HASH verified**: no receipt was altered, removed from the middle or
  reordered, and each was signed by the key you pinned.
- **TIMESTAMP ABSENT**: nothing independent vouches for *when*. Whoever runs `reede serve` holds
  the signing key and could seal anything. Pinning `pubkey.hex` from the same directory, as here,
  only shows the form; a real verifier pins a key obtained separately.
- **Not proven**: that the agent's report is true.
- **Privacy**: spans may carry prompts and completions in clear and are stored unredacted in
  `ingest/spans/`. Keep that directory as private as the data. Never commit
  `ingest/signing.key`.

`./run.sh` does steps 2 to 6 in a scratch directory (set `REEDE_BIN` if `reede` is not on PATH;
`REEDE_PORT` if 4318 is taken).

## Optional: a real model

Any OpenAI-compatible endpoint works; use the one you already run or trust.

```text
export REEDE_EXAMPLE_BASE_URL=<your OpenAI-compatible base URL>
export REEDE_EXAMPLE_API_KEY=<key>
export REEDE_EXAMPLE_MODEL=<model id>
node agent.js
```

Not run in CI; the mock-model path above is what was timed. Real prompts and completions
will be sealed into `ingest/spans/` in clear.

## Versions

Run against Node 25, `@mastra/core` 1.85.0, `@mastra/observability` 1.24.2,
`@mastra/otel-exporter` 1.6.1 (pinned in `package.json`; `@reede/otel` tracks the repo's default
branch until it is published).

Apache-2.0.
