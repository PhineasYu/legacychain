import { BadgeCheck, ExternalLink, ShieldQuestion, UserCheck } from 'lucide-react';
import type { Contributor } from '@/lib/types';
import type { NeuroIdentity } from '@/lib/server/neuro';
import { cn } from '@/lib/utils';

/**
 * Who preserved this record, and whether anyone actually vouches for them.
 *
 * When a Neuro Legal Identity is configured, its state is read back from the
 * issuing Neuron on every render and shown with the identity id — so the
 * badge points at something checkable. Without one it says "Unverified"
 * rather than displaying a claim the application cannot support.
 *
 * A sandbox identity is labelled as such: it proves the identity exists and
 * is approved on that Neuron, not that a real person was verified.
 */
export function GuardianIdentity({
  contributor,
  identity,
}: {
  contributor: Contributor;
  identity?: NeuroIdentity | null;
}) {
  const verified = Boolean(identity?.approved);

  return (
    <section
      className={cn(
        'rounded-3xl px-6 py-5 ring-1',
        verified ? 'bg-heritage-sky/12 ring-heritage-sky/35' : 'bg-card ring-border'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl',
              verified
                ? 'bg-heritage-sky/25 text-heritage-sky-deep'
                : 'bg-heritage-sand/50 text-heritage-mocha'
            )}
          >
            <UserCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
              Guardian
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {contributor.name}
              {contributor.relationship && ` · ${contributor.relationship}`}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {verified
                ? `Legal Identity approved by ${identity!.issuer}, re-read at render time.`
                : 'No identity provider is configured, so this name is not backed by a verified identity.'}
            </p>
          </div>
        </div>

        <span
          className={cn(
            'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1',
            verified
              ? 'bg-heritage-sky/25 text-heritage-sky-deep ring-heritage-sky/45'
              : 'bg-muted text-muted-foreground ring-border'
          )}
        >
          {verified ? (
            <BadgeCheck className="h-3.5 w-3.5" />
          ) : (
            <ShieldQuestion className="h-3.5 w-3.5" />
          )}
          {verified ? 'Verified Identity' : 'Unverified'}
        </span>
      </div>

      {identity && (
        <dl className="mt-4 space-y-1.5 border-t border-border/50 pt-3">
          <Row label="Legal ID" value={identity.legalId} />
          <Row label="State" value={identity.state} mono={false} />
          <Row label="Issuer" value={identity.issuer} mono={false} />
        </dl>
      )}

      {identity?.isSandbox && (
        <p className="mt-3 rounded-xl bg-warning/10 px-4 py-2.5 text-xs leading-relaxed text-warning ring-1 ring-warning/20">
          Sandbox identity. It is approved automatically, which proves the
          identity exists on this Neuron — not that a real person was verified.
        </p>
      )}

      {identity && (
        <a
          href={`https://${identity.issuer}`}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-heritage-sky-deep hover:underline"
        >
          Issued by {identity.issuer}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </section>
  );
}

function Row({
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
        className={cn('min-w-0 break-all text-xs text-foreground/80', mono && 'font-mono')}
      >
        {value}
      </dd>
    </div>
  );
}
