import { Fingerprint, KeyRound, Link2, Check, Minus } from 'lucide-react';
import type { AnchorStatus, ProtocolStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * The three Alexandria protocols, shown together on every record.
 *
 * A protocol is either satisfied or it is not — there is no partial
 * credit and no decorative green tick. Sky blue means proven.
 */

/** How the ledger row reads for each anchor state. */
const ANCHOR_DETAIL: Record<AnchorStatus, string> = {
  anchored: 'On-chain',
  simulated: 'Simulated',
  pending: 'Pending',
  failed: 'Not anchored',
};

const PROTOCOLS = [
  { key: 'digitalDna', icon: Fingerprint, label: 'Digital DNA', detail: 'SHA-256' },
  { key: 'pqcSignature', icon: KeyRound, label: 'PQC Signature', detail: 'ML-DSA-44' },
  { key: 'blockchain', icon: Link2, label: 'Immutable Ledger', detail: 'Anchored' },
] as const;

export function ProtocolBadges({
  protocols,
  anchorStatus,
  variant = 'full',
  className,
}: {
  protocols: ProtocolStatus;
  /** Refines the ledger label so a simulated anchor is never shown as mined. */
  anchorStatus?: AnchorStatus;
  variant?: 'full' | 'compact';
  className?: string;
}) {
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        {PROTOCOLS.map(({ key, icon: Icon, label }) => {
          const active = protocols[key];
          return (
            <span
              key={key}
              title={`${label}: ${active ? 'verified' : 'not present'}`}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                active
                  ? 'bg-heritage-sky/25 text-heritage-sky-deep ring-1 ring-heritage-sky/45'
                  : 'bg-muted text-muted-foreground/50 ring-1 ring-border'
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-2.5 sm:grid-cols-3', className)}>
      {PROTOCOLS.map(({ key, icon: Icon, label, detail }) => {
        const active = protocols[key];
        const activeDetail =
          key === 'blockchain' && anchorStatus ? ANCHOR_DETAIL[anchorStatus] : detail;
        return (
          <div
            key={key}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors',
              active
                ? 'bg-heritage-sky/12 ring-1 ring-heritage-sky/35'
                : 'bg-muted/60 ring-1 ring-border'
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
                active
                  ? 'bg-heritage-sky/25 text-heritage-sky-deep'
                  : 'bg-background text-muted-foreground/60'
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold tracking-label text-muted-foreground">
                {label}
              </p>
              <p
                className={cn(
                  'truncate text-sm font-medium',
                  active ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {active ? activeDetail : 'Not present'}
              </p>
            </div>
            {active ? (
              <Check className="h-4 w-4 flex-shrink-0 text-heritage-sky-deep" />
            ) : (
              <Minus className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
            )}
          </div>
        );
      })}
    </div>
  );
}
