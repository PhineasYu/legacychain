'use client';

import { Fingerprint, KeyRound, Link2, ShieldCheck, Sparkles, CornerDownRight } from 'lucide-react';
import type { ProvenanceRecord } from '@/lib/types';
import { ProvenanceBadge } from './provenance-badge';
import { AnchorStatusPill } from './anchor-proof';
import { truncateDigest } from '@/lib/services/hashing';
import { cn } from '@/lib/utils';

/**
 * The provenance chain, oldest first.
 *
 * Derived records are indented under the record they came from, so the
 * shape of the timeline shows at a glance that transformations branch
 * off the original rather than replacing it.
 */
export function ProvenanceTimeline({ records }: { records: ProvenanceRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="rounded-3xl bg-muted/60 px-6 py-8 text-center text-sm text-muted-foreground">
        No provenance records yet.
      </p>
    );
  }

  const ordered = [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="relative">
      <div className="absolute bottom-6 left-[27px] top-6 w-0.5 bg-gradient-to-b from-heritage-sky/50 via-heritage-sand-deep/40 to-transparent" />

      <div className="space-y-3">
        {ordered.map((record, index) => (
          <div
            key={record.id}
            className="animate-fade-in-up relative flex gap-5"
            style={{ animationDelay: `${index * 120}ms` }}
          >
            <div className="relative z-10 flex-shrink-0">
              <span
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-2xl shadow-heritage',
                  record.kind === 'ORIGINAL'
                    ? 'bg-heritage-sky/25 text-heritage-sky-deep ring-1 ring-heritage-sky/40'
                    : 'bg-heritage-sand/50 text-heritage-mocha ring-1 ring-heritage-sand-deep/50'
                )}
              >
                {record.kind === 'ORIGINAL' ? (
                  <ShieldCheck className="h-6 w-6" />
                ) : (
                  <Sparkles className="h-6 w-6" />
                )}
              </span>
            </div>

            <div
              className={cn(
                'flex-1 rounded-3xl p-5 shadow-heritage transition-shadow hover:shadow-heritage-lg',
                record.kind === 'ORIGINAL'
                  ? 'bg-card'
                  : 'ml-0 bg-heritage-sand/15 sm:ml-6'
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-display text-3xl font-bold text-foreground">
                  {record.year}
                </span>
                <ProvenanceBadge kind={record.kind} />
                {record.blockchain && (
                  <AnchorStatusPill status={record.blockchain.status} />
                )}
              </div>

              <h3 className="mt-2 font-display text-lg font-semibold text-foreground">
                {record.title}
              </h3>

              {record.transformType && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-heritage-mocha">
                  <CornerDownRight className="h-3.5 w-3.5" />
                  Transform: {record.transformType}
                </p>
              )}

              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                {record.description}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-3">
                <ProtocolChip
                  icon={Fingerprint}
                  label={truncateDigest(record.digitalDna, 8, 6)}
                  active={record.hasDigitalDna}
                />
                <ProtocolChip
                  icon={KeyRound}
                  label={record.hasPqc ? 'ML-DSA-44' : 'Unsigned'}
                  active={record.hasPqc}
                />
                <ProtocolChip
                  icon={Link2}
                  label={record.blockchain?.status === 'anchored' ? 'On-chain' : 'Local anchor'}
                  active={Boolean(record.blockchain)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProtocolChip({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof Fingerprint;
  label: string;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[11px]',
        active ? 'text-heritage-sky-deep' : 'text-muted-foreground/60'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
