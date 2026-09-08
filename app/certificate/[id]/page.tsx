import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Calendar,
  Download,
  Eye,
  MapPin,
  Search,
  Sparkles,
} from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { AnchorProof } from '@/components/anchor-proof';
import { ProtocolBadges } from '@/components/protocol-badges';
import { PqcVerification } from '@/components/pqc-verification';
import { PlainProof } from '@/components/plain-proof';
import { GuardianIdentity } from '@/components/guardian-identity';
import { getGuardianIdentity } from '@/lib/server/neuro';
import { getStore } from '@/lib/db';
import { getProtocolStatus } from '@/lib/server/heritage-service';
import type { AiEnrichment } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CertificatePage({
  params,
}: {
  params: { id: string };
}) {
  const store = await getStore();
  const item = await store.getHeritage(params.id);
  if (!item) notFound();

  const protocols = getProtocolStatus(item);
  // Read the guardian's Legal Identity back from its Neuron rather than
  // trusting the status stored alongside the record.
  const identity = await getGuardianIdentity();

  return (
    <div className="min-h-screen bg-paper-grain">
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/vault"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the vault
        </Link>

        <article className="animate-scale-in overflow-hidden rounded-[2rem] bg-certificate shadow-heritage-lg">
          {/* Certificate head */}
          <header className="bg-mocha-panel px-8 py-10 text-center sm:px-12">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-heritage-sand/20">
              <Award className="h-7 w-7 text-heritage-sky" />
            </span>
            <p className="mt-5 text-[11px] font-semibold tracking-label text-heritage-sky">
              LegacyChain
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Heritage Certificate
            </h1>
            <p className="mt-3 font-mono text-[11px] text-heritage-sand/60">
              {item.id}
            </p>
          </header>

          <div className="px-8 py-10 sm:px-12">
            {/* The artifact */}
            <div className="flex justify-center">
              <div className="overflow-hidden rounded-3xl bg-heritage-sand/25 shadow-heritage">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="max-h-72 w-auto object-contain"
                />
              </div>
            </div>

            <div className="mt-8 text-center">
              <h2 className="font-display text-4xl font-bold tracking-tight text-foreground">
                {item.title}
              </h2>
              <p className="mt-2 font-display text-2xl font-semibold text-heritage-sand-deep">
                {item.year}
              </p>
            </div>

            <PlainProof
              preservedAt={item.createdAt}
              guardianName={item.contributor.name}
              anchor={item.blockchain}
            >
              <ProtocolBadges
                protocols={protocols}
                anchorStatus={item.blockchain?.status}
              />
              <ProofDetail item={item} />
            </PlainProof>

            {/* Metadata */}
            <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetaItem icon={Calendar} label="Year" value={String(item.year)} />
              <MetaItem icon={MapPin} label="Location" value={item.location || '—'} />
              <MetaItem icon={Award} label="Type" value={item.type} />
            </dl>

            {/* Guardian */}
            <div className="mt-4">
              <GuardianIdentity contributor={item.contributor} identity={identity} />
            </div>

            {/* Story */}
            {item.story && (
              <section className="mt-4 rounded-3xl bg-heritage-sand/20 px-6 py-5">
                <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
                  Story
                </p>
                <p className="mt-2 font-serif-body text-sm italic leading-relaxed text-foreground">
                  “{item.story}”
                </p>
              </section>
            )}

            {/* AI enrichment — a rejected suggestion is reported as rejected,
                never rendered as if it described the item. */}
            {item.aiEnrichment && (
              <section className="mt-4 rounded-3xl bg-card px-6 py-5 shadow-heritage">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="h-4 w-4 text-heritage-mocha" />
                  <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
                    AI reading · {item.aiEnrichment.source}
                  </p>
                  <EnrichmentVerdict status={item.aiEnrichment.status} />
                </div>

                {item.aiEnrichment.transcript &&
                  item.aiEnrichment.status !== 'rejected' && (
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold tracking-label text-muted-foreground">
                        Transcript
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap font-serif-body text-sm leading-relaxed text-foreground">
                        {item.aiEnrichment.transcript}
                      </p>
                    </div>
                  )}

                {item.aiEnrichment.status === 'rejected' ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    The family reviewed this suggestion and rejected it. It is
                    not part of this record.
                  </p>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-foreground">
                    {item.aiEnrichment.description}
                  </p>
                )}

                <p className="mt-3 text-xs italic text-muted-foreground">
                  {item.aiEnrichment.status === 'pending'
                    ? 'No one has reviewed this suggestion yet, so it carries no more weight than a guess.'
                    : item.aiEnrichment.note}
                </p>
              </section>
            )}

            {/* Attestations summary */}
            {item.attestations.length > 0 && (
              <section className="mt-4 rounded-3xl bg-card px-6 py-5 shadow-heritage">
                <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
                  Family attestations
                </p>
                <ul className="mt-3 space-y-3">
                  {item.attestations.slice(0, 3).map((attestation) => (
                    <li key={attestation.id}>
                      <p className="font-serif-body text-sm italic text-foreground">
                        “{attestation.statement}”
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        — {attestation.attesterName}
                        {attestation.relationship && `, ${attestation.relationship}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* QR + footer */}
            <footer className="mt-10 flex flex-col items-center border-t border-heritage-sand-deep/25 pt-8 text-center">
              {/* Served as SVG so a printed certificate stays verifiable. */}
              <img
                src={`/api/certificate/${item.id}/qr`}
                alt={`QR code linking to the certificate for ${item.title}`}
                className="h-28 w-28"
              />
              <p className="mt-4 text-[11px] font-semibold tracking-label text-muted-foreground">
                Scan to verify
              </p>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-muted-foreground">
                This certificate attests to the provenance of a preserved record.
                The content itself remains private to the family; only proofs are
                published.
              </p>
            </footer>
          </div>
        </article>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={`/provenance/${item.id}`} className="flex-1">
            <Button size="lg" variant="outline" className="w-full gap-2 rounded-full">
              <Eye className="h-5 w-5" />
              View provenance
            </Button>
          </Link>
          <Link href="/verify" className="flex-1">
            <Button size="lg" className="w-full gap-2 rounded-full">
              <Search className="h-5 w-5" />
              Verify a file
            </Button>
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/** The cryptographic evidence, shown only when someone asks for it. */
function ProofDetail({
  item,
}: {
  item: NonNullable<
    Awaited<ReturnType<Awaited<ReturnType<typeof getStore>>['getHeritage']>>
  >;
}) {
  return (
    <>
            {/* Digital DNA */}
      <section className="mt-6 rounded-3xl bg-card p-6 shadow-heritage">
        <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
          Digital DNA · SHA-256
        </p>
        <p className="mt-2 break-all font-mono text-sm text-foreground">
          {item.digitalDna}
        </p>
        <a
          href={`/api/files/${item.digitalDna}?download`}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-heritage-sky-deep hover:underline"
        >
          <Download className="h-3.5 w-3.5" />
          Download the preserved original
        </a>
      </section>

      {/* PQC — verified in the browser, not merely asserted */}
      <div className="mt-4">
        <PqcVerification signature={item.pqcSignature} />
      </div>

      {/* Blockchain */}
      <div className="mt-4">
        <AnchorProof anchor={item.blockchain} />
      </div>

    </>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-heritage">
      <Icon className="h-4 w-4 flex-shrink-0 text-heritage-sky-deep" />
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold tracking-label text-muted-foreground">
          {label}
        </dt>
        <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

/** How a human ruled on the AI's suggestion. */
function EnrichmentVerdict({ status }: { status: AiEnrichment['status'] }) {
  const config: Record<AiEnrichment['status'], { label: string; className: string }> = {
    pending: {
      label: 'Awaiting review',
      className: 'bg-warning/15 text-warning ring-warning/25',
    },
    accepted: {
      label: 'Accepted by family',
      className: 'bg-heritage-sky/25 text-heritage-sky-deep ring-heritage-sky/45',
    },
    edited: {
      label: 'Edited by family',
      className: 'bg-heritage-sky/25 text-heritage-sky-deep ring-heritage-sky/45',
    },
    rejected: {
      label: 'Rejected by family',
      className: 'bg-muted text-muted-foreground ring-border',
    },
  };
  const { label, className } = config[status];

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-label ring-1 ${className}`}
    >
      {label}
    </span>
  );
}
