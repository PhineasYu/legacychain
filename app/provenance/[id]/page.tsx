import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Award, GitBranch, Sparkles } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ProvenanceTimeline } from '@/components/provenance-timeline';
import { AttestationPanel } from '@/components/attestation-panel';
import { Button } from '@/components/ui/button';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ProvenancePage({
  params,
}: {
  params: { id: string };
}) {
  const store = await getStore();
  const item = await store.getHeritage(params.id);
  if (!item) notFound();

  const derivedCount = item.provenance.filter(
    (record) => record.kind === 'DERIVED'
  ).length;

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

        <div className="rounded-[1.75rem] bg-mocha-panel px-8 py-10 shadow-heritage-lg sm:px-12">
          <p className="text-[11px] font-semibold tracking-label text-heritage-sky">
            Provenance Chain
          </p>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {item.title}
          </h1>
          <p className="mt-3 text-heritage-sand/90">
            {item.year} · {item.type}
            {item.location && ` · ${item.location}`}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-heritage-sand/15 px-4 py-2 text-sm text-white ring-1 ring-heritage-sand/25">
              <Sparkles className="h-4 w-4" />
              1 original
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-heritage-sand/15 px-4 py-2 text-sm text-white ring-1 ring-heritage-sand/25">
              <GitBranch className="h-4 w-4" />
              {derivedCount} derived {derivedCount === 1 ? 'version' : 'versions'}
            </span>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="mb-6 font-display text-2xl font-semibold text-foreground">
            The chain
          </h2>
          <ProvenanceTimeline records={item.provenance} />
        </section>

        <div className="mt-10">
          <AttestationPanel
            heritageId={item.id}
            initialAttestations={item.attestations}
          />
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href={`/certificate/${item.id}`} className="flex-1">
            <Button size="lg" className="w-full gap-2 rounded-full">
              <Award className="h-5 w-5" />
              Heritage certificate
            </Button>
          </Link>
          <Link href="/verify" className="flex-1">
            <Button
              size="lg"
              variant="outline"
              className="w-full gap-2 rounded-full"
            >
              <GitBranch className="h-5 w-5" />
              Add another version
            </Button>
          </Link>
        </div>

        <div className="mt-12 rounded-[1.75rem] bg-heritage-sand/25 px-8 py-10 text-center">
          <p className="mx-auto max-w-xl font-display text-xl font-semibold leading-snug text-foreground text-balance">
            The original is never modified. A transformation adds a record; it
            can never replace one.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
