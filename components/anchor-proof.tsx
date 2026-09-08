import { Link2, ExternalLink, CircleAlert, CircleDashed } from 'lucide-react';
import type { BlockchainAnchor } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Displays a blockchain anchor honestly.
 *
 * A simulated anchor is labelled as simulated. The demo never claims a
 * transaction was mined when no wallet was configured — the point of the
 * product is that its claims can be checked.
 */
export function AnchorProof({
  anchor,
  className,
}: {
  anchor?: BlockchainAnchor;
  className?: string;
}) {
  if (!anchor) {
    return (
      <div
        className={cn(
          'flex items-start gap-3 rounded-2xl bg-muted/60 px-5 py-4 ring-1 ring-border',
          className
        )}
      >
        <CircleDashed className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          This record has not been anchored.
        </p>
      </div>
    );
  }

  const tone =
    anchor.status === 'anchored'
      ? 'bg-heritage-sky/12 ring-heritage-sky/35'
      : anchor.status === 'failed'
        ? 'bg-destructive/8 ring-destructive/25'
        : 'bg-heritage-sand/30 ring-heritage-sand-deep/40';

  const Icon = anchor.status === 'failed' ? CircleAlert : Link2;

  return (
    <div className={cn('rounded-2xl px-5 py-4 ring-1', tone, className)}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
            anchor.status === 'anchored'
              ? 'bg-heritage-sky/25 text-heritage-sky-deep'
              : anchor.status === 'failed'
                ? 'bg-destructive/12 text-destructive'
                : 'bg-heritage-sand/50 text-heritage-mocha'
          )}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
              Immutable Ledger
            </p>
            <AnchorStatusPill status={anchor.status} />
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">
            {anchor.network} · chain {anchor.chainId}
          </p>

          <dl className="mt-3 space-y-1.5">
            <ProofRow label="Record ID" value={anchor.recordId} />
            {anchor.txHash && <ProofRow label="Transaction" value={anchor.txHash} />}
            {typeof anchor.blockNumber === 'number' && (
              <ProofRow label="Block" value={String(anchor.blockNumber)} mono={false} />
            )}
            {anchor.contractAddress && (
              <ProofRow label="Registry" value={anchor.contractAddress} />
            )}
          </dl>

          {anchor.note && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {anchor.note}
            </p>
          )}

          {anchor.explorerUrl && (
            <a
              href={anchor.explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-heritage-sky-deep hover:underline"
            >
              View on block explorer
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnchorStatusPill({ status }: { status: BlockchainAnchor['status'] }) {
  const config: Record<BlockchainAnchor['status'], { label: string; className: string }> = {
    anchored: {
      label: 'On-chain',
      className: 'bg-heritage-sky/25 text-heritage-sky-deep ring-heritage-sky/45',
    },
    simulated: {
      label: 'Simulated',
      className: 'bg-heritage-sand/60 text-heritage-mocha ring-heritage-sand-deep/50',
    },
    pending: {
      label: 'Pending',
      className: 'bg-warning/12 text-warning ring-warning/25',
    },
    failed: {
      label: 'Not anchored',
      className: 'bg-destructive/10 text-destructive ring-destructive/25',
    },
  };
  const { label, className } = config[status];

  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold tracking-label ring-1',
        className
      )}
    >
      {label}
    </span>
  );
}

function ProofRow({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="w-20 flex-shrink-0 text-[10px] font-semibold tracking-label text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'min-w-0 break-all text-xs text-foreground/80',
          mono && 'font-mono'
        )}
      >
        {value}
      </dd>
    </div>
  );
}
