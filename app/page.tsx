import Link from 'next/link';
import {
  ArrowRight,
  Fingerprint,
  KeyRound,
  Link2,
  Sparkles,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { listHeritageSummaries } from '@/lib/server/heritage-service';
import { getRuntimeMode } from '@/lib/server/config';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const items = await listHeritageSummaries();
  const mode = getRuntimeMode();
  const timeline = [...items].sort((a, b) => a.year - b.year).slice(0, 5);

  return (
    <div className="min-h-screen bg-paper-grain">
      <SiteHeader />

      {/* Hero — the portfolio's editorial split: mocha panel, cream type */}
      <section className="mx-auto max-w-6xl px-6 pt-12">
        <div className="overflow-hidden rounded-[2rem] bg-mocha-panel shadow-heritage-lg">
          <div className="grid gap-10 px-8 py-14 sm:px-14 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold tracking-label text-heritage-sky">
                Sovereign History Vault
              </p>
              <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">
                Preserve the
                <br />
                original.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-heritage-sand/85">
                Every family has memories that survived by accident — a
                photograph, a letter, a recorded voice. LegacyChain gives them a
                fingerprint, a post-quantum signature and an immutable anchor,
                so a hundred years from now anyone can still tell which version
                was the original.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/add">
                  <Button
                    size="lg"
                    className="gap-2 rounded-full bg-heritage-sky px-7 text-heritage-mocha-deep hover:bg-heritage-sky/90"
                  >
                    Preserve a memory
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/vault">
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 rounded-full border-heritage-sand/35 bg-transparent px-7 text-heritage-sand hover:bg-heritage-sand/10 hover:text-white"
                  >
                    Open the vault
                  </Button>
                </Link>
              </div>
            </div>

            {/* The one-line thesis, set as a quotation panel */}
            <div className="rounded-[1.75rem] bg-heritage-sand/12 p-8 ring-1 ring-heritage-sand/20 backdrop-blur-sm">
              <Sparkles className="h-7 w-7 text-heritage-sky" />
              <p className="mt-5 font-display text-2xl font-semibold leading-snug text-white text-balance">
                AI can transform heritage, but it cannot erase provenance.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-heritage-sand/75">
                Restore a photograph, colorize it, enhance it — every version
                gets its own record and links back to the original. The chain
                only ever grows.
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6">
        {/* The three protocols */}
        <section className="mt-20">
          <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
            Three Protocols
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight text-foreground">
            What it takes to prove a memory is real
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <ProtocolCard
              icon={Fingerprint}
              index="01"
              title="Digital DNA"
              question="Is this the exact original file?"
              body="The file's bytes are hashed with SHA-256. Change one pixel and the fingerprint changes completely."
            />
            <ProtocolCard
              icon={KeyRound}
              index="02"
              title="Post-Quantum Signature"
              question="Will the claim survive future cryptography?"
              body="The provenance record is signed with ML-DSA-44, the NIST-standardised post-quantum algorithm."
            />
            <ProtocolCard
              icon={Link2}
              index="03"
              title="Immutable Ledger"
              question="Can anyone check it independently?"
              body="Only hashes go on-chain. The photographs, names and stories stay in the family's private vault."
            />
          </div>
        </section>

        {/* How truth is decided */}
        <section className="mt-20 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[1.75rem] bg-card p-8 shadow-heritage">
            <ShieldCheck className="h-7 w-7 text-heritage-sky-deep" />
            <h3 className="mt-5 font-display text-2xl font-semibold text-foreground">
              Cryptographic truth
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              “Has this file changed?” A hash and a signature answer that
              completely, and no one can argue with the answer.
            </p>
          </div>
          <div className="rounded-[1.75rem] bg-heritage-sand/25 p-8 shadow-heritage">
            <Users className="h-7 w-7 text-heritage-mocha" />
            <h3 className="mt-5 font-display text-2xl font-semibold text-foreground">
              Human truth
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              “Who is this person? Where was this taken?” AI can suggest.
              Only family can attest — and their attestations are preserved
              beside the record, never over it.
            </p>
          </div>
        </section>

        {/* What is already in the vault */}
        {timeline.length > 0 && (
          <section className="mt-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
                  In the vault
                </p>
                <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground">
                  A family, in order
                </h2>
              </div>
              <Link
                href="/vault"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-heritage-sky-deep hover:underline"
              >
                See all {items.length}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <ol className="mt-8 space-y-2">
              {timeline.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/certificate/${item.id}`}
                    className="flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-2xl bg-card px-6 py-4 shadow-heritage transition-all hover:-translate-y-0.5 hover:shadow-heritage-lg"
                  >
                    <span className="font-display text-3xl font-bold text-heritage-sky-deep">
                      {item.year}
                    </span>
                    <span className="font-display text-lg font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="text-sm text-muted-foreground">{item.type}</span>
                    {item.derivedCount > 0 && (
                      <span className="text-xs font-medium text-heritage-mocha">
                        +{item.derivedCount} derived
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Runtime transparency — the app says what is actually live */}
        <section className="mt-20 rounded-[1.75rem] bg-secondary/60 px-8 py-7">
          <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
            Running configuration
          </p>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <ModeChip label="Database" mode={mode.database} liveLabel="Neon Postgres" localLabel="Local file store" />
            <ModeChip label="Blockchain" mode={mode.blockchain} liveLabel="Ethereum" localLabel="Simulated anchors" />
            <ModeChip label="AI" mode={mode.ai} liveLabel="Claude" localLabel="Heuristic only" />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function ProtocolCard({
  icon: Icon,
  index,
  title,
  question,
  body,
}: {
  icon: typeof Fingerprint;
  index: string;
  title: string;
  question: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.75rem] bg-card p-7 shadow-heritage transition-transform hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-heritage-sky/20 text-heritage-sky-deep">
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-display text-2xl font-bold text-heritage-sand-deep/60">
          {index}
        </span>
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-2 font-serif-body text-sm italic text-heritage-mocha">
        {question}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function ModeChip({
  label,
  mode,
  liveLabel,
  localLabel,
}: {
  label: string;
  mode: 'live' | 'local';
  liveLabel: string;
  localLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={
          mode === 'live'
            ? 'h-2 w-2 rounded-full bg-heritage-sky-deep'
            : 'h-2 w-2 rounded-full bg-heritage-sand-deep'
        }
      />
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-muted-foreground">
        {mode === 'live' ? liveLabel : localLabel}
      </span>
    </span>
  );
}
