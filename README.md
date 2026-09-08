# LegacyChain — Sovereign History Vault

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FPhineasYu%2Flegacychain&project-name=legacychain&repository-name=legacychain)

> AI opens the archive. Provenance keeps it honest.

A private vault for family heritage. AI makes unreadable sources readable —
faded handwriting, old scripts, recordings nobody has time to listen through.
Every reading it produces stays attached to the exact bytes it was read from,
in a record no one can quietly change. Not the family. Not the people running
the service.

---

## Share it with your team

**Click the Deploy button above.** Vercel will fork the repo to your account,
build it and hand you a public URL — no configuration needed. The deployed app
runs in **demo mode**: everything works (upload, fingerprint, sign, verify,
derive, attest), but because there is no database yet it holds data in memory
and says so in a banner at the top of every page.

### Making it persist (about two minutes)

Teammates each get their own short-lived copy until you add a database. To make
the vault shared and permanent:

1. In your Vercel project, open **Storage → Create Database → Neon**. Vercel
   provisions it and sets `DATABASE_URL` for you.
2. Redeploy (**Deployments → ⋯ → Redeploy**).

That is the whole procedure — the tables are created automatically on the first
connection. The banner disappears and everyone now sees the same vault: one
person uploads an original, another verifies it or registers a derived version.

If `DATABASE_URL` is set but the database cannot be reached, the app keeps
running and says so in a red banner with the connection error, rather than
silently falling back and looking like the setting never applied.

### Optional extras

| Add | To get |
| --- | --- |
| `ANTHROPIC_API_KEY` | Real vision-based AI enrichment instead of metadata heuristics |
| `NEURO_*` (see below) | A real, live-checked Legal Identity for the guardian instead of "Unverified" |
| `ETH_RPC_URL` + `ETH_PRIVATE_KEY` + `HERITAGE_REGISTRY_ADDRESS` | Anchors actually mined on Sepolia instead of labelled `simulated` |
| `PQC_GUARDIAN_SEED` | Your own post-quantum signing key instead of the public dev seed |

Set them in **Settings → Environment Variables**, then redeploy. Nothing breaks
if they are missing — each subsystem degrades to a labelled local mode.

---

## Quick start

```bash
npm install
npm run dev
```

That is the whole setup. With no configuration the app runs in **local mode**:
a JSON file store, locally derived anchors and heuristic enrichment. The vault
seeds itself with four demo items on first run, put through the *real*
pipeline — real bytes, really hashed, really signed. Download a seeded
original from its certificate and re-upload it on the Verify page and it
genuinely verifies.

Fill in `.env.local` (copy from `.env.example`) to promote any subsystem to
live. The home page and `/api/health` always report which mode each subsystem
is actually in.

---

## The three protocols

Every heritage record aims to satisfy all three:

| Protocol | Question it answers | Implementation |
| --- | --- | --- |
| **Digital DNA** | Is this the exact original file? | SHA-256 over the raw bytes (`lib/services/hashing.ts`) |
| **PQC Signature** | Will the claim survive future cryptography? | ML-DSA-44 / FIPS-204 via `@noble/post-quantum` (`lib/services/pqc.ts`) |
| **Immutable Ledger** | Can anyone check it independently? | `HeritageRegistry.sol` on Ethereum (`lib/server/blockchain.ts`) |

The certificate page re-verifies the ML-DSA-44 signature **in the visitor's
own browser** against the published public key — it does not simply assert
that it is valid.

## Originals and derived versions

An AI-restored photograph has different bytes, so it has a different
fingerprint. LegacyChain treats that as a new **derived** record that points
back at its parent, never as a replacement:

```
ORIGINAL  1968 Wedding Photograph
   │
   ├── DERIVED  AI Restored Version    (own hash, own signature, own anchor)
   └── DERIVED  AI Colorized Version
```

The `register` function in the contract rejects a second write to the same
record id and requires a derived record's parent to already exist, so the
chain can only ever grow.

## What AI is for here

A letter from 1982 in another era's handwriting is not readable by the
grandchild who inherits it. AI transcribes it in seconds, and that is the
point — it opens an archive that was effectively closed.

But a transcript is a *reading of* a letter, not the letter. Models misread
handwriting, fill in faded words, and normalise dialect. And two generations
on, people will read the transcript, because it is the convenient one — the
scan will sit unopened in a folder. That is not AI behaving badly; it is what
happens whenever a convenient derivative replaces an inconvenient source.

So every reading is stored beside the source and traceable back to it. Anyone
can ask to see the exact bytes a transcript was made from, and get them.

## Two kinds of truth

Cryptography answers *"has this file changed?"* completely. It cannot answer
*"who is this person?"* — that is what **family attestations** are for. A
relative can confirm, correct or dispute a record; the statement is stored
beside the record and never over it, so disagreement is preserved as part of
the history.

Each attestation is anchored too, by hash, against the record it is about —
`attest()` on the registry. Only the hash goes on chain; who said what stays
in the private vault. This matters for a different reason than anchoring a
file: a family's account of its own history is exactly the kind of thing that
gets quietly revised later.

AI is a reader, never the authority. Its output arrives as
`status: 'pending'` and only a person can move it to accepted, edited or
rejected — `PATCH /api/heritage/:id/enrichment` is the only route that can,
and it cannot touch the file, its fingerprint, its signature or its provenance
chain. The source (model name, or `heuristic`) is shown wherever a reading
appears, and a rejected one is reported as rejected rather than rendered as
description.

## Privacy

Nothing private is ever written on-chain. The registry stores only:

```
recordId · fileHash · pqcSignatureHash · parentRecordId · guardian · timestamp
```

Photographs, names, locations and stories stay in the private vault. The
public certificate deliberately omits the family's story and location.

---

## Architecture

```
        Next.js App Router (React, Tailwind)
                     │
     server components  │  client mutations
                     ▼
              Route handlers (app/api/*)
                     │
        ┌────────────┼─────────────┬──────────────┐
        ▼            ▼             ▼              ▼
   HeritageStore  PQC signer   Anchoring      AI enrichment
   Neon | local   ML-DSA-44    ethers v6      Claude | heuristic
                                   │
                                   ▼
                          HeritageRegistry.sol
                          Ethereum Sepolia
```

Every external system is optional and degrades to a labelled local mode.
A failed anchor never blocks preservation — the fingerprint and the signature
are the durable proof; the chain is the public witness.

### Layout

```
app/
  api/                  route handlers (heritage, verify, derived,
                        attestations, ai, files, certificate, qr, health)
  add|verify|vault|provenance|certificate/
components/             UI, incl. protocol-badges, anchor-proof,
                        provenance-timeline, attestation-panel
contracts/              HeritageRegistry.sol + compiled artifacts
lib/
  db/                   store interface, Neon driver, local driver, schema, seed
  server/               pipeline, PQC custody, anchoring, AI, config
  services/             hashing and PQC primitives (isomorphic)
scripts/                contract:compile, contract:deploy
tests/                  vitest specs for hashing, PQC and anchoring
```

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Which subsystems are live |
| `GET` `POST` | `/api/heritage` | List items · preserve an original |
| `GET` `DELETE` | `/api/heritage/:id` | Full record with provenance · remove it from the vault |
| `POST` | `/api/heritage/:id/derived` | Register a transformed version |
| `PATCH` | `/api/heritage/:id/enrichment` | Record a human verdict on an AI suggestion |
| `GET` `POST` | `/api/heritage/:id/attestations` | Family attestations, each anchored by hash |
| `POST` | `/api/verify` | Fingerprint an upload and look it up |
| `POST` | `/api/ai/enrich` | Transcribe and describe a source (never stored as fact) |
| `GET` | `/api/files/:sha256` | Serve a preserved original |
| `GET` | `/api/certificate/:id` | Public, independently checkable certificate |
| `GET` | `/api/certificate/:id/qr` | QR code for the certificate |

## Going live

**Database (Neon)** — set `DATABASE_URL`. The schema in `lib/db/schema.ts` is
applied automatically on the first connection.

**Blockchain (Sepolia)**
```bash
npm run contract:compile
npm run contract:deploy      # prints HERITAGE_REGISTRY_ADDRESS
```
Set `ETH_RPC_URL` (Dwellir), `ETH_PRIVATE_KEY` and the printed address. Until
all three are present, anchors are marked `simulated` in the UI and are never
presented as mined.

**AI** — set `ANTHROPIC_API_KEY`.

**PQC key** — set `PQC_GUARDIAN_SEED` to 32 bytes of hex:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Without it a fixed, public development seed is used. The secret key is derived
server-side and never reaches the browser.

## Identity (Neuro)

The guardian on a certificate shows as **Unverified** until an identity
provider backs it — a badge the application cannot check is worse than no
badge. Neuro issues a reviewed Legal Identity that fills that gap.

Grab the API key and secret for your Sandbox from
[the FIRSTBLOCK-ATHON sandbox page](https://blockathon.neuro-tech.io/sandbox.html#api-access),
then run once:

```bash
NEURO_API_KEY=<key> NEURO_API_SECRET=<secret> npm run neuro:provision
```

It creates an account, enables it, creates a signing key, applies for a Legal
Identity, waits for approval, and prints four environment variables. Paste them
into your host and redeploy.

The certificate then re-reads the identity from its Neuron on every render and
shows the legal id, state and issuer — rather than trusting what was stored
alongside the record. Sandbox identities are approved automatically, so the
certificate labels them as sandbox: they prove the identity exists and is
approved on that Neuron, not that a real person was verified.

Note that Neuro's signing algorithms are all elliptic-curve
(`GetAlgorithms` reports `pqc: false` for every one). Neuro answers *who
vouches for this person*; LegacyChain's own ML-DSA-44 answers *will this
signature survive a quantum adversary*. They are complementary, not redundant.

## The certificate

The certificate opens with the claim in ordinary words — this is the original,
preserved by whom and when, any copy checks yes or no — and the part a family
can act on: the record cannot be quietly changed by anyone, including us, so
the proof outlives this service.

The cryptography sits behind a **Show the proof** disclosure: the SHA-256
fingerprint, the ML-DSA-44 signature (re-verified in the visitor's own browser
against the published public key) and the on-chain anchor, read back from the
registry rather than asserted. Nobody should have to learn cryptography to
trust the page, and nobody should have to take its word for it either.

## Checking what is switched on

Two views of the same state:

- **`/status`** — plain language. What each subsystem does right now, what is
  lost while it is reduced, and the exact setting that switches it on. Gaps are
  separated by whether they actually break a live demo.
- **`/api/health`** — the same facts as JSON, plus which environment variables
  the running process can see (names only, never values). Useful when a setting
  was added in a hosting dashboard but has not reached the deployment.

## Testing

```bash
npm test                                        # unit tests
npm run test:e2e                                # against localhost:3000
BASE_URL=https://your-deployment npm run test:e2e
```

`test:e2e` walks the demo narrative and asserts each claim — 44 checks covering
the fingerprint, the PQC signature and its binding to the file hash and parent
version, anchoring, authentic vs different verification, derived-version
linkage, the original staying unchanged, human review of AI output, and
attestation. Run it against a deployment before demoing it.

## Commands

```bash
npm run dev               # development server
npm run build             # production build
npm test                  # unit tests (hashing, PQC, anchoring)
npm run test:e2e          # walks the whole demo against a running server
npm run typecheck         # tsc --noEmit
npm run neuro:provision   # one-time Neuro account + Legal Identity
npm run contract:compile  # solc -> contracts/artifacts
npm run contract:deploy   # deploy HeritageRegistry
```

To reset the local vault and re-seed, delete `.data/`.

---

## Taking this over

A clone builds and runs with no configuration: `npm install && npm run dev`.
Everything below is optional and each subsystem degrades to a labelled local
mode, so nothing is a blocker to getting started.

**No secrets are in this repository, by design.** To run a deployment with the
same capabilities, you need these — none can be recovered from the code:

| Variable | Where it comes from |
| --- | --- |
| `DATABASE_URL` (or any `*_URL` holding a Postgres string) | Vercel → Storage → Neon. Tables are created automatically on first connect. |
| `NEURO_HOST` `NEURO_USERNAME` `NEURO_ACCOUNT_PASSWORD` `NEURO_LEGAL_ID` | `npm run neuro:provision` prints all four. Needs an API key/secret from the [sandbox page](https://blockathon.neuro-tech.io/sandbox.html#api-access). |
| `PQC_GUARDIAN_SEED` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Changing it changes the guardian's public key, so existing signatures stop verifying against the new one. |
| `ETH_RPC_URL` `ETH_PRIVATE_KEY` `HERITAGE_REGISTRY_ADDRESS` | An RPC provider, a funded Sepolia wallet, and `npm run contract:deploy`. |
| `ANTHROPIC_API_KEY` | console.anthropic.com |

**Two things to know before changing anything:**

1. *The preservation pipeline runs in a fixed order* — fingerprint, store,
   sign, anchor, then persist. Persistence is last so a half-preserved record
   is never written. `lib/server/heritage-service.ts` is the only place that
   should orchestrate it.
2. *Honesty is a feature, not politeness.* A simulated anchor is labelled
   simulated; an unverified identity says unverified; a suggestion nobody has
   reviewed says so. Several reviewers will look for exactly this. Do not
   "clean up" those labels into something that reads better.
