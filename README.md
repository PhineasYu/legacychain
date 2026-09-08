# LegacyChain — Sovereign History Vault

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FPhineasYu%2Flegacychain&project-name=legacychain&repository-name=legacychain)

> Preserve the original. Preserve its provenance. Let AI understand history
> without letting AI rewrite it.

A private, post-quantum, blockchain-backed vault for family heritage.
Photographs, recordings, letters and documents are preserved with a
cryptographic fingerprint, an ML-DSA-44 signature and an immutable anchor —
while the family's actual content never leaves their private vault.

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
2. Locally, create the tables:
   ```bash
   DATABASE_URL="<the connection string from Vercel>" npm run db:init
   ```
3. Redeploy (**Deployments → ⋯ → Redeploy**).

The banner disappears and everyone now sees the same vault: one person uploads
an original, another verifies it or registers a derived version.

### Optional extras

| Add | To get |
| --- | --- |
| `ANTHROPIC_API_KEY` | Real vision-based AI enrichment instead of metadata heuristics |
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

## Two kinds of truth

Cryptography answers *"has this file changed?"* completely. It cannot answer
*"who is this person?"* — that is what **family attestations** are for. A
relative can confirm, correct or dispute a record; the statement is stored
beside the record and never over it, so disagreement is preserved as part of
the history.

AI is an assistant, never the authority. Suggestions come back with
`status: 'pending'` and a note that they are not historical facts, and the
source (model name, or `heuristic`) is shown wherever a suggestion appears.

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
  db/                   store interface, Neon driver, local driver, seed
  server/               pipeline, PQC custody, anchoring, AI, config
  services/             hashing and PQC primitives (isomorphic)
scripts/                db:init, contract:compile, contract:deploy
tests/                  vitest specs for hashing, PQC and anchoring
```

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Which subsystems are live |
| `GET` `POST` | `/api/heritage` | List items · preserve an original |
| `GET` | `/api/heritage/:id` | Full record with provenance |
| `POST` | `/api/heritage/:id/derived` | Register a transformed version |
| `GET` `POST` | `/api/heritage/:id/attestations` | Family attestations |
| `POST` | `/api/verify` | Fingerprint an upload and look it up |
| `POST` | `/api/ai/enrich` | AI suggestions (never stored as fact) |
| `GET` | `/api/files/:sha256` | Serve a preserved original |
| `GET` | `/api/certificate/:id` | Public, independently checkable certificate |
| `GET` | `/api/certificate/:id/qr` | QR code for the certificate |

## Going live

**Database (Neon)**
```bash
DATABASE_URL=postgres://... npm run db:init
```

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

## Commands

```bash
npm run dev               # development server
npm run build             # production build
npm test                  # vitest
npm run typecheck         # tsc --noEmit
npm run db:init           # apply lib/db/schema.sql to DATABASE_URL
npm run contract:compile  # solc -> contracts/artifacts
npm run contract:deploy   # deploy HeritageRegistry
```

To reset the local vault and re-seed, delete `.data/`.
