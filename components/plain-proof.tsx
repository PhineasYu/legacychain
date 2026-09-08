import { ShieldCheck, ChevronDown } from 'lucide-react';
import type { BlockchainAnchor } from '@/lib/types';

/**
 * The certificate's promise, in the words a family would use.
 *
 * The cryptography is the reason this holds, but nobody should have to learn
 * it to trust the page — the same way nobody learns TCP to send an email. The
 * proof stays one click away for anyone who wants to check it, and the claim
 * made here is deliberately the narrow one the system can actually keep.
 */
export function PlainProof({
  preservedAt,
  guardianName,
  anchor,
  children,
}: {
  preservedAt: string;
  guardianName: string;
  anchor?: BlockchainAnchor;
  children: React.ReactNode;
}) {
  const onChain = anchor?.status === 'anchored';
  const date = new Date(preservedAt).toISOString().slice(0, 10);

  return (
    <section className="mt-8">
      <div className="rounded-3xl bg-heritage-sky/12 px-6 py-6 ring-1 ring-heritage-sky/30 sm:px-8">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-heritage-sky/25 text-heritage-sky-deep">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              This is the original.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground/80">
              Preserved by {guardianName} on {date}. Any copy of this file can be
              checked against this record and will come back yes or no — there is
              no maybe.
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground/80">
              {onChain
                ? 'The record was published where no one can quietly change it — not the family, not us. If this service shut down tomorrow, the proof would still hold.'
                : 'The record is built to be published where no one can quietly change it — not the family, not us — so that if this service shut down tomorrow, the proof would still hold.'}
            </p>
          </div>
        </div>
      </div>

      {/* The evidence, for anyone who wants it — and out of the way for
          everyone who does not. */}
      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl bg-secondary/60 px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          Show the proof
        </summary>
        <div className="mt-3 space-y-4">{children}</div>
      </details>
    </section>
  );
}
