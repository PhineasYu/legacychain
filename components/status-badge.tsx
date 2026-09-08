import { CheckCircle2, ShieldCheck, Clock, GitBranch, HelpCircle } from 'lucide-react';
import type { VerificationStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: VerificationStatus;
  className?: string;
}

/**
 * Sky blue is reserved for states the system has actually proven.
 * A derived version is sand, not red — it is legitimate history, just
 * not the original.
 */
const statusConfig: Record<
  VerificationStatus,
  { icon: typeof CheckCircle2; className: string; label: string }
> = {
  'Original Preserved': {
    icon: CheckCircle2,
    className: 'bg-heritage-sky/20 text-heritage-sky-deep ring-1 ring-heritage-sky/40',
    label: 'Original Preserved',
  },
  Verified: {
    icon: ShieldCheck,
    className: 'bg-heritage-sky/20 text-heritage-sky-deep ring-1 ring-heritage-sky/40',
    label: 'Verified',
  },
  'Pending Verification': {
    icon: Clock,
    className: 'bg-warning/12 text-warning ring-1 ring-warning/25',
    label: 'Pending',
  },
  'Derived Version': {
    icon: GitBranch,
    className: 'bg-heritage-sand/45 text-heritage-mocha ring-1 ring-heritage-sand-deep/45',
    label: 'Derived Version',
  },
  Unverified: {
    icon: HelpCircle,
    className: 'bg-muted text-muted-foreground ring-1 ring-border',
    label: 'Unverified',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.Unverified;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        config.className,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}
