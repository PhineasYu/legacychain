import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, GitBranch, Sparkles } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { listHeritageSummaries } from '@/lib/server/heritage-service';

export const dynamic = 'force-dynamic';

/**
 * Index of provenance chains.
 *
 * With a single item there is nothing to choose between, so this jumps
 * straight to that item's chain.
 */
export default async function ProvenanceIndexPage() {
  const items = await listHeritageSummaries();

  if (items.length === 1) {
    redirect(`/provenance/${items[0].id}`);
  }

  return (
    <div className="min-h-screen bg-paper-grain">
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10">
          <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
            Provenance
          </p>
          <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight text-foreground">
            Every version, in order
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Choose a heritage item to see its full chain: the original, every
            transformation derived from it, and what each version can prove.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-[1.75rem] bg-card px-8 py-16 text-center shadow-heritage">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              Nothing to trace yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Preserve a memory first, then transform it — the chain builds
              itself from there.
            </p>
            <Link href="/add">
              <Button className="mt-6 rounded-full">Add heritage</Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/provenance/${item.id}`}
                  className="flex items-center justify-between gap-6 rounded-3xl bg-card px-6 py-5 shadow-heritage transition-all hover:-translate-y-0.5 hover:shadow-heritage-lg"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="font-display text-3xl font-bold text-heritage-sky-deep">
                        {item.year}
                      </span>
                      <span className="font-display text-lg font-semibold text-foreground">
                        {item.title}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span>{item.type}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5" />
                        {item.derivedCount} derived{' '}
                        {item.derivedCount === 1 ? 'version' : 'versions'}
                      </span>
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-14 rounded-[1.75rem] bg-mocha-panel px-8 py-12 text-center shadow-heritage-lg">
          <Sparkles className="mx-auto h-8 w-8 text-heritage-sky" />
          <p className="mx-auto mt-5 max-w-xl font-display text-2xl font-semibold leading-snug text-white text-balance">
            Every reading stays attached to what it read.
          </p>
          <p className="mt-3 text-sm text-heritage-sand/75">
            A transcript is useful precisely because it is easier than the
            source. That is also why it must always point back at it.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
